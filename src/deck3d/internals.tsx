import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Part, Screw } from './parts';
import { batteryLabelTexture, brushedTexture, fanStickerTexture, flexTexture, pcbTexture, rng, ssdLabelTexture, stickerTexture } from './textures';

// The Steam Deck's internals, laid out from iFixit's X-ray and teardown photos and fitted inside
// Valve's CAD shell. Coordinates are the scene's back view (Deck face-down, top edge at -z, the
// Deck's right side at -x), in units of 100 mm. Y0 is the top of the midframe.
const Y0 = 0.18;
// Inside face of the front shell (the screen side), from the CAD.
const FRONT_INNER = 0.125;

type Model = 'lcd' | 'oled';
type Pt = [number, number]; // world (x, z)

// The inside of Valve's shell across the height the internals occupy, measured from the CAD (the
// tightest cross-section between 1 and 14 mm behind the front face, 3 mm wall allowance), in world
// (x, z). Everything flat inside the Deck is cut to it, so nothing pokes out of the rounded grips.
const SHELL_INNER: Pt[] = [
  [-1.337, -0.017], [-1.346, -0.053], [-1.374, -0.09], [-1.383, -0.128],
  [-1.394, -0.167], [-1.391, -0.207], [-1.399, -0.251], [-1.401, -0.296],
  [-1.422, -0.35], [-1.433, -0.407], [-1.386, -0.451], [-1.309, -0.486],
  [-1.227, -0.518], [-1.138, -0.549], [-0.905, -0.501], [-0.795, -0.507],
  [-0.703, -0.521], [-0.615, -0.537], [-0.516, -0.543], [-0.421, -0.55],
  [-0.329, -0.558], [-0.229, -0.549], [-0.138, -0.554], [-0.046, -0.556],
  [0.046, -0.556], [0.137, -0.554], [0.23, -0.551], [0.327, -0.556],
  [0.42, -0.549], [0.513, -0.539], [0.616, -0.538], [0.71, -0.526],
  [0.796, -0.507], [0.905, -0.501], [1.142, -0.551], [1.23, -0.52],
  [1.313, -0.487], [1.391, -0.452], [1.425, -0.404], [1.42, -0.35],
  [1.401, -0.296], [1.399, -0.251], [1.391, -0.207], [1.394, -0.167],
  [1.383, -0.128], [1.374, -0.09], [1.342, -0.052], [1.337, -0.017],
  [1.325, 0.017], [1.319, 0.051], [1.315, 0.086], [1.298, 0.12],
  [1.291, 0.155], [1.268, 0.189], [1.254, 0.225], [1.23, 0.26],
  [1.221, 0.301], [1.202, 0.341], [1.182, 0.384], [1.123, 0.417],
  [1.106, 0.468], [1.026, 0.496], [0.943, 0.521], [0.855, 0.544],
  [0.735, 0.545], [0.627, 0.548], [0.514, 0.541], [0.413, 0.539],
  [0.312, 0.53], [0.223, 0.534], [0.133, 0.534], [0.044, 0.536],
  [-0.045, 0.536], [-0.133, 0.534], [-0.223, 0.534], [-0.316, 0.537],
  [-0.413, 0.539], [-0.514, 0.541], [-0.627, 0.548], [-0.739, 0.548],
  [-0.855, 0.544], [-0.943, 0.521], [-1.026, 0.496], [-1.106, 0.468],
  [-1.124, 0.417], [-1.164, 0.378], [-1.202, 0.341], [-1.221, 0.301],
  [-1.23, 0.26], [-1.254, 0.225], [-1.268, 0.189], [-1.276, 0.153],
  [-1.291, 0.12], [-1.308, 0.086], [-1.319, 0.052], [-1.325, 0.017],
];

function polygonArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

function pointInPolygon([x, z]: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// Sutherland–Hodgman: the part of `subject` inside `clip` (clip treated as convex enough here).
function clipPolygon(subject: Pt[], clip: Pt[]): Pt[] {
  const ccw = polygonArea(clip) > 0;
  const inside = (p: Pt, a: Pt, b: Pt) => {
    const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    return ccw ? cross >= 0 : cross <= 0;
  };
  const cut = (p: Pt, q: Pt, a: Pt, b: Pt): Pt => {
    const a1 = b[1] - a[1], b1 = a[0] - b[0], c1 = a1 * a[0] + b1 * a[1];
    const a2 = q[1] - p[1], b2 = p[0] - q[0], c2 = a2 * p[0] + b2 * p[1];
    const det = a1 * b2 - a2 * b1;
    return det === 0 ? p : [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det];
  };
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      if (inside(cur, a, b)) {
        if (!inside(prev, a, b)) out.push(cut(prev, cur, a, b));
        out.push(cur);
      } else if (inside(prev, a, b)) {
        out.push(cut(prev, cur, a, b));
      }
    }
  }
  return out;
}

// Shrink a polygon toward the Deck's centre (keeps parts clear of the shell walls).
function inset(poly: Pt[], by: number): Pt[] {
  return poly.map(([x, z]) => {
    const len = Math.hypot(x / 1.49, z / 0.59) || 1;
    return [x - (x / len / 1.49) * by * 1.49, z - (z / len / 0.59) * by * 0.59 * 2.5] as Pt;
  });
}

function rect(x0: number, z0: number, x1: number, z1: number): Pt[] {
  return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
}

// A flat part cut to `poly` (world x, z), extruded `depth` upward, with UVs spanning its bounds so
// a board texture covers it exactly. `origin` is subtracted so the geometry sits in a local group.
function slabGeometry(poly: Pt[], depth: number, origin: Pt = [0, 0]): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x - origin[0], -(z - origin[1]))));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const pos = g.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x);
    uv[i * 2 + 1] = 1 - (pos.getZ(i) - bb.min.z) / (bb.max.z - bb.min.z);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
type Rect = [number, number, number, number]; // x0, z0, x1, z1 (board-local)

// ───────────────────────── Shared helpers ─────────────────────────

// A memoised GPU resource (geometry, texture) that is disposed when it changes or unmounts.
function useDisposable<T extends { dispose: () => void }>(make: () => T, deps: unknown[]): T {
  // The callers pass their own dependency lists; this is a thin wrapper over useMemo.
  // eslint-disable-next-line @eslint-react/exhaustive-deps
  const value = useMemo(make, deps);
  useEffect(() => () => value.dispose(), [value]);
  return value;
}

// Hundreds of surface-mount parts (capacitors, resistors, inductors) as three instanced meshes.
function SmdField({ w, d, y, count, seed, avoid, region }: { w: number; d: number; y: number; count: number; seed: number; avoid: Rect[]; region?: Pt[] }) {
  const capRef = useRef<THREE.InstancedMesh>(null);
  const resRef = useRef<THREE.InstancedMesh>(null);
  const indRef = useRef<THREE.InstancedMesh>(null);

  const layout = useMemo(() => {
    const r = rng(seed);
    const caps: THREE.Matrix4[] = [];
    const res: THREE.Matrix4[] = [];
    const inds: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion();
    let tries = 0;
    while (caps.length + res.length + inds.length < count && tries++ < count * 20) {
      const x = (r() - 0.5) * w * 0.94;
      const z = (r() - 0.5) * d * 0.94;
      if (avoid.some(([x0, z0, x1, z1]) => x > x0 - 0.01 && x < x1 + 0.01 && z > z0 - 0.01 && z < z1 + 0.01)) continue;
      if (region && !pointInPolygon([x, z], region)) continue;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() > 0.5 ? 0 : Math.PI / 2);
      const kind = r();
      if (kind < 0.55) {
        const s = 0.6 + r() * 0.8;
        caps.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.003 * s, z), q, new THREE.Vector3(s, s, s)));
      } else if (kind < 0.92) {
        const s = 0.6 + r() * 0.6;
        res.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.0018 * s, z), q, new THREE.Vector3(s, s, s)));
      } else {
        const s = 0.7 + r() * 0.9;
        inds.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.008 * s, z), q, new THREE.Vector3(s, s, s)));
      }
    }
    return { caps, res, inds };
  }, [w, d, y, count, seed, avoid, region]);

  useEffect(() => {
    const apply = (mesh: THREE.InstancedMesh | null, list: THREE.Matrix4[]) => {
      if (!mesh) return;
      list.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
    };
    apply(capRef.current, layout.caps);
    apply(resRef.current, layout.res);
    apply(indRef.current, layout.inds);
  }, [layout]);

  return (
    <group>
      <instancedMesh ref={capRef} args={[undefined, undefined, layout.caps.length]} castShadow>
        <boxGeometry args={[0.012, 0.006, 0.007]} />
        <meshStandardMaterial color="#b59a72" roughness={0.55} metalness={0.15} />
      </instancedMesh>
      <instancedMesh ref={resRef} args={[undefined, undefined, layout.res.length]} castShadow>
        <boxGeometry args={[0.01, 0.0036, 0.005]} />
        <meshStandardMaterial color="#15161a" roughness={0.45} metalness={0.2} />
      </instancedMesh>
      <instancedMesh ref={indRef} args={[undefined, undefined, layout.inds.length]} castShadow>
        <boxGeometry args={[0.03, 0.016, 0.03]} />
        <meshStandardMaterial color="#5b6168" roughness={0.6} metalness={0.5} />
      </instancedMesh>
    </group>
  );
}

function Chip({ w, d, h = 0.008, color = '#15171b', dot = true }: { w: number; d: number; h?: number; color?: string; dot?: boolean }) {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.3} />
      </mesh>
      {dot && (
        <mesh position={[-w * 0.38, h / 2 + 0.0004, -d * 0.36]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[Math.min(w, d) * 0.06, 12]} />
          <meshStandardMaterial color="#3a3e45" roughness={0.6} />
        </mesh>
      )}
    </group>
  );
}

// A flat flex cable lying on a surface, with an optional printed texture.
function Flex({ length, width, map, color = '#c87a1c', rotationY = 0 }: { length: number; width: number; map?: THREE.Texture; color?: string; rotationY?: number }) {
  return (
    <mesh rotation={[0, rotationY, 0]} castShadow receiveShadow>
      <boxGeometry args={[length, 0.0025, width]} />
      <meshStandardMaterial color={map ? '#ffffff' : color} map={map ?? null} roughness={0.35} metalness={0.25} />
    </mesh>
  );
}

// A ZIF / board-to-board connector: body plus a coloured locking flap.
function Connector({ w, d, flap = '#2d6fb3' }: { w: number; d: number; flap?: string }) {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[w, 0.008, d]} />
        <meshStandardMaterial color="#e6e1d6" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.006, d * 0.15]}>
        <boxGeometry args={[w * 0.96, 0.004, d * 0.55]} />
        <meshStandardMaterial color={flap} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Sticker({ w, d, seed, text }: { w: number; d: number; seed: number; text: string }) {
  const map = useDisposable(() => stickerTexture(seed, text), [seed, text]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial map={map} roughness={0.7} />
    </mesh>
  );
}

// ───────────────────────── Midframe ─────────────────────────

// Screw bosses rise from the frame to just under the back-cover screws (~y 0.265).
const BOSS = 0.265 - Y0;

function Midframe() {
  const plate = useDisposable(() => slabGeometry(SHELL_INNER, Y0 - FRONT_INNER), []);

  // Ribs and screw bosses moulded into the frame.
  const ribs: [number, number, number, number][] = [
    [-0.885, 0, 0.012, 1.0], [0.885, 0, 0.012, 1.0], [-0.255, 0, 0.012, 1.04],
    [0.0, -0.56, 2.6, 0.012], [0.0, 0.535, 2.6, 0.012], [0.03, 0.03, 0.56, 0.01],
  ];
  const bosses: [number, number][] = [[1.08, 0.485], [-1.08, 0.485], [0.97, -0.52], [-0.97, -0.52], [0.283, 0.52], [-0.283, 0.52], [0.27, -0.4], [-0.27, -0.4]];

  return (
    <group>
      <mesh geometry={plate} position={[0, FRONT_INNER, 0]} receiveShadow>
        <meshStandardMaterial color="#1b1d21" roughness={0.85} metalness={0.15} />
      </mesh>
      {ribs.map(([x, z, w, d]) => (
        <mesh key={`rib-${x}-${z}`} position={[x, Y0 + 0.012, z]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.024, d]} />
          <meshStandardMaterial color="#202227" roughness={0.8} metalness={0.15} />
        </mesh>
      ))}
      {/* Bosses under the eight back-cover screws, rising to meet the cover */}
      {bosses.map(([x, z]) => (
        <group key={`boss-${x}-${z}`} position={[x, Y0, z]}>
          <mesh position={[0, BOSS / 2, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.036, BOSS, 20]} />
            <meshStandardMaterial color="#202227" roughness={0.75} metalness={0.2} />
          </mesh>
          <mesh position={[0, BOSS + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.009, 0.016, 20]} />
            <meshStandardMaterial color="#b8a172" metalness={0.9} roughness={0.35} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ───────────────────────── Mainboard ─────────────────────────

const MAIN = { x: -0.57, z: -0.005, w: 0.6, d: 1.07 };
const MAIN_POLY = clipPolygon(rect(-0.87, -0.54, -0.27, 0.53), inset(SHELL_INNER, 0.006));
const MAIN_LOCAL: Pt[] = MAIN_POLY.map(([x, z]) => [x - MAIN.x, z - MAIN.z]);
// Board-local keep-outs for the SMD scatter.
const MAIN_AVOID: Rect[] = [
  [-0.14, -0.27, 0.12, 0.0], // cold plate over APU
  [0.07, -0.37, 0.22, -0.25], [-0.25, -0.37, -0.07, -0.25], [0.07, -0.01, 0.22, 0.11], [-0.25, -0.01, -0.07, 0.11], // RAM
  [-0.08, 0.23, 0.29, 0.48], // SSD
  [-0.06, -0.54, 0.1, -0.47], // USB-C
  [-0.26, 0.39, -0.1, 0.54], // microSD
];

function Mainboard({ model }: { model: Model }) {
  const map = useDisposable(() => pcbTexture(21, '#123a24', '#2c6a3f', '#d9e4dc', model === 'oled' ? '1030-0002 GALILEO' : '1030-0001 JUPITER', MAIN.w / MAIN.d), [model]);
  const y = Y0 + 0.012;
  const ram: [number, number][] = [[0.145, -0.31], [-0.16, -0.31], [0.145, 0.05], [-0.16, 0.05]];
  const board = useDisposable(() => slabGeometry(MAIN_POLY, 0.012, [MAIN.x, MAIN.z]), []);

  return (
    <group position={[MAIN.x, 0, MAIN.z]}>
      <mesh geometry={board} position={[0, Y0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#ffffff" map={map} roughness={0.42} metalness={0.15} />
      </mesh>
      <SmdField w={MAIN.w} d={MAIN.d} y={y} count={650} seed={3} avoid={MAIN_AVOID} region={MAIN_LOCAL} />

      {/* APU package under its copper cold plate, held by a sprung cross bracket */}
      <group position={[-0.01, y, -0.14]}>
        <mesh position={[0, 0.002, 0]}>
          <boxGeometry args={[0.22, 0.004, 0.24]} />
          <meshStandardMaterial color="#244a2c" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.012, 0]} castShadow>
          <boxGeometry args={[0.24, 0.014, 0.26]} />
          <meshPhysicalMaterial color="#c4783e" metalness={1} roughness={0.28} clearcoat={0.3} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={`brk-${s}`} position={[0, 0.021, 0]} rotation={[0, s * Math.PI * 0.25, 0]} castShadow>
            <boxGeometry args={[0.42, 0.004, 0.035]} />
            <meshStandardMaterial color="#9aa2ab" metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
        {(
          [
            [-0.15, -0.15],
            [0.15, -0.15],
            [-0.15, 0.15],
            [0.15, 0.15],
          ] as [number, number][]
        ).map(([sx, sz]) => (
          <group key={`spring-${sx}-${sz}`} position={[sx, 0.03, sz]}>
            <Screw torx={model === 'oled'} size={0.013} length={0.02} />
          </group>
        ))}
      </group>

      {/* LPDDR5 packages around the APU */}
      {ram.map(([x, z]) => (
        <group key={`ram-${x}-${z}`} position={[x, y + 0.004, z]}>
          <Chip w={0.13} d={0.11} />
        </group>
      ))}

      {/* Power stages, controllers and odd chips */}
      {(
        [
          [0.17, 0.2, 0.07, 0.07],
          [-0.2, 0.2, 0.06, 0.06],
          [0.19, -0.44, 0.06, 0.05],
          [-0.21, -0.43, 0.08, 0.06],
          [0.0, 0.18, 0.05, 0.05],
        ] as [number, number, number, number][]
      ).map(([x, z, w, d]) => (
        <group key={`ic-${x}-${z}`} position={[x, y + 0.003, z]}>
          <Chip w={w} d={d} h={0.006} />
        </group>
      ))}

      {/* M.2 2230 socket */}
      <mesh position={[0.26, y + 0.006, 0.36]} castShadow>
        <boxGeometry args={[0.03, 0.012, 0.24]} />
        <meshStandardMaterial color="#1a1b1f" roughness={0.5} />
      </mesh>
      {/* SSD standoff */}
      <mesh position={[-0.065, y + 0.005, 0.36]}>
        <cylinderGeometry args={[0.012, 0.012, 0.01, 16]} />
        <meshStandardMaterial color="#c9b27a" metalness={0.9} roughness={0.35} />
      </mesh>

      {/* USB-C port on the top edge */}
      <group position={[0.02, y + 0.018, -0.505]}>
        <RoundedBox args={[0.1, 0.034, 0.075]} radius={0.012} smoothness={3} castShadow>
          <meshStandardMaterial color="#c7ccd2" metalness={1} roughness={0.22} />
        </RoundedBox>
      </group>
      {/* microSD reader cage on the bottom edge */}
      <group position={[-0.18, y + 0.008, 0.465]}>
        <mesh castShadow>
          <boxGeometry args={[0.15, 0.016, 0.15]} />
          <meshStandardMaterial color="#b8bec5" metalness={1} roughness={0.3} />
        </mesh>
      </group>

      {/* Board-to-board and ZIF connectors along the edges */}
      {(
        [
          [-0.27, -0.2, 0.025, 0.1, '#2d6fb3'],
          [-0.27, 0.15, 0.025, 0.12, '#2d6fb3'],
          [0.27, -0.12, 0.025, 0.08, '#1d1e22'],
          [0.27, 0.26, 0.025, 0.09, '#1d1e22'],
          [0.05, -0.47, 0.1, 0.025, '#1d1e22'],
        ] as [number, number, number, number, string][]
      ).map(([x, z, w, d, flap]) => (
        <group key={`con-${x}-${z}`} position={[x, y + 0.004, z]}>
          <Connector w={w} d={d} flap={flap} />
        </group>
      ))}
    </group>
  );
}

// Copper heat pipe from the APU cold plate to the fin stack at the top edge.
function HeatPipe() {
  const geometry = useDisposable(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.58, Y0 + 0.04, -0.14),
      new THREE.Vector3(-0.56, Y0 + 0.042, -0.3),
      new THREE.Vector3(-0.47, Y0 + 0.045, -0.47),
      new THREE.Vector3(-0.3, Y0 + 0.045, -0.535),
      new THREE.Vector3(-0.1, Y0 + 0.045, -0.545),
    ]);
    const g = new THREE.TubeGeometry(curve, 64, 0.02, 14, false);
    return g;
  }, []);
  return (
    <mesh geometry={geometry} scale={[1, 0.6, 1]} position={[0, Y0 * 0.4, 0]} castShadow>
      <meshPhysicalMaterial color="#c8743a" metalness={1} roughness={0.25} clearcoat={0.4} />
    </mesh>
  );
}

function FinStack() {
  const fins = useMemo(() => Array.from({ length: 44 }, (_, i) => -0.23 + i * 0.0115), []);
  return (
    <group position={[0.02, Y0, -0.557]}>
      {fins.map((x) => (
        <mesh key={`fin-${x.toFixed(4)}`} position={[x, 0.026, 0]} castShadow>
          <boxGeometry args={[0.0028, 0.048, 0.06]} />
          <meshStandardMaterial color="#c47b42" metalness={0.95} roughness={0.3} />
        </mesh>
      ))}
      {[0.002, 0.05].map((y) => (
        <mesh key={`fin-plate-${y}`} position={[0.02, y, 0]}>
          <boxGeometry args={[0.51, 0.003, 0.062]} />
          <meshStandardMaterial color="#b56c38" metalness={0.95} roughness={0.32} />
        </mesh>
      ))}
    </group>
  );
}

// ───────────────────────── Board shield ─────────────────────────

function Shield({ model }: { model: Model }) {
  const black = model === 'oled';
  const map = useDisposable(() => brushedTexture(black ? '#1e2024' : '#d3d9e0', black ? 5 : 9), [black]);
  const w = 0.62, h = 0.04;
  const can = useDisposable(() => slabGeometry(clipPolygon(rect(-0.88, -0.545, -0.26, 0.535), inset(SHELL_INNER, 0.004)), h, [MAIN.x, MAIN.z]), []);
  return (
    <group>
      <mesh geometry={can} position={[0, 0.0025, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#ffffff" map={map} metalness={black ? 0.55 : 0.62} roughness={black ? 0.5 : 0.34} />
      </mesh>
      {/* Embossed stiffening ribs */}
      {[-0.32, 0.0].map((z) => (
        <mesh key={`emboss-${z}`} position={[0, h + 0.004, z]}>
          <boxGeometry args={[w * 0.82, 0.004, 0.02]} />
          <meshStandardMaterial color={black ? '#25282d' : '#dde3e9'} metalness={0.65} roughness={0.3} />
        </mesh>
      ))}
      {/* Black insulating tape over the lower third, and the QR stickers */}
      <mesh position={[0, h + 0.0035, 0.36]} receiveShadow>
        <boxGeometry args={[w * 0.97, 0.002, 0.34]} />
        <meshStandardMaterial color="#0b0c0e" roughness={0.9} />
      </mesh>
      <group position={[-0.12, h + 0.004, -0.42]}>
        <Sticker w={0.16} d={0.08} seed={31} text="QA-PASS" />
      </group>
      <group position={[0.14, h + 0.004, -0.42]}>
        <Sticker w={0.12} d={0.06} seed={47} text="EMI" />
      </group>
    </group>
  );
}

// ───────────────────────── Fan ─────────────────────────

// Shape y maps to world -z once laid flat: the straight edge (+y) faces the fin stack, the rounded
// corners face the bottom of the Deck. OLED fans have rounder sides than the original's square ones.
function blowerOutline(oled: boolean): THREE.Shape {
  const s = new THREE.Shape();
  const w = 0.5, d = 0.5, r = oled ? 0.2 : 0.04;
  s.moveTo(-w / 2, d / 2);
  s.lineTo(w / 2, d / 2);
  s.lineTo(w / 2, -d / 2 + r);
  s.quadraticCurveTo(w / 2, -d / 2, w / 2 - r, -d / 2);
  s.lineTo(-w / 2 + r, -d / 2);
  s.quadraticCurveTo(-w / 2, -d / 2, -w / 2, -d / 2 + r);
  s.lineTo(-w / 2, d / 2);
  return s;
}

function Fan({ model, fresh = false }: { model: Model; fresh?: boolean }) {
  const oled = model === 'oled';
  const impellerRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (impellerRef.current) impellerRef.current.rotation.y += dt * (fresh ? 14 : 3);
  });

  const base = useDisposable(() => {
    const g = new THREE.ExtrudeGeometry(blowerOutline(oled), { depth: 0.004, bevelEnabled: false, curveSegments: 20 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [oled]);
  const walls = useDisposable(() => {
    const sh = blowerOutline(oled);
    const hole = new THREE.Path();
    hole.absarc(0, 0.03, 0.2, 0, Math.PI * 2, true);
    sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.042, bevelEnabled: false, curveSegments: 40 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [oled]);
  const cover = useDisposable(() => {
    const sh = blowerOutline(oled);
    const hole = new THREE.Path();
    hole.absarc(0, 0.03, 0.155, 0, Math.PI * 2, true);
    sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false, curveSegments: 48 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [oled]);
  const sticker = useDisposable(() => fanStickerTexture(), []);
  const blades = useMemo(() => Array.from({ length: 31 }, (_, i) => (i / 31) * Math.PI * 2), []);

  return (
    <group>
      {/* Base plate and moulded scroll housing around the impeller */}
      <mesh geometry={base} castShadow receiveShadow>
        <meshStandardMaterial color={fresh ? '#22262c' : '#17191d'} roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh geometry={walls} position={[0, 0.004, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={fresh ? '#22262c' : '#17191d'} roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Impeller: hub and 31 swept blades */}
      <group ref={impellerRef} position={[0, 0.008, -0.03]}>
        <mesh position={[0, 0.018, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.036, 40]} />
          <meshStandardMaterial color="#2a2e34" roughness={0.45} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.0365, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.062, 40]} />
          <meshStandardMaterial map={sticker} roughness={0.6} />
        </mesh>
        {blades.map((a) => (
          <mesh key={`blade-${a.toFixed(4)}`} position={[Math.cos(a) * 0.128, 0.018, Math.sin(a) * 0.128]} rotation={[0, -a + 0.45, 0]} castShadow>
            <boxGeometry args={[0.004, 0.034, 0.1]} />
            <meshStandardMaterial color={fresh ? '#3b4250' : '#2b3038'} roughness={0.5} metalness={0.2} />
          </mesh>
        ))}
        <mesh position={[0, 0.001, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.002, 48]} />
          <meshStandardMaterial color="#202329" roughness={0.6} />
        </mesh>
      </group>

      {/* Stamped metal top cover with the intake ring */}
      <mesh geometry={cover} position={[0, 0.046, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={oled ? '#2a2d33' : '#cdd3da'} metalness={oled ? 0.8 : 0.6} roughness={0.32} />
      </mesh>
      {/* Screw ears */}
      {/* Screw ears: the top pair takes two of the back-cover screws, the bottom pair the fan screws */}
      {(
        [
          [-0.25, -0.13],
          [0.25, -0.13],
          [-0.23, 0.24],
          [0.23, 0.24],
        ] as [number, number][]
      ).map(([x, z]) => (
        <mesh key={`ear-${x}-${z}`} position={[x, 0.046, z]}>
          <cylinderGeometry args={[0.03, 0.03, 0.004, 20]} />
          <meshStandardMaterial color={oled ? '#2a2d33' : '#cdd3da'} metalness={oled ? 0.8 : 0.6} roughness={0.32} />
        </mesh>
      ))}
      {/* Fan lead */}
      <mesh position={[-0.27, 0.01, 0.17]} rotation={[0, 0.5, 0]}>
        <boxGeometry args={[0.07, 0.006, 0.02]} />
        <meshStandardMaterial color="#1c1d21" roughness={0.6} />
      </mesh>
    </group>
  );
}

// ───────────────────────── Battery ─────────────────────────

function Battery() {
  const label = useDisposable(() => batteryLabelTexture(), []);
  const h = 0.055;
  return (
    <group>
      {/* Tall cell (right of the fan) and short cell (under the fan): the L-shaped 2-cell pack */}
      <group position={[0.59, Y0 + h / 2, -0.01]}>
        <RoundedBox args={[0.58, h, 0.98]} radius={0.012} smoothness={4} castShadow receiveShadow>
          <meshPhysicalMaterial color="#141518" roughness={0.38} metalness={0.1} clearcoat={0.8} clearcoatRoughness={0.25} />
        </RoundedBox>
        <mesh position={[0, h / 2 + 0.0008, -0.12]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
          <planeGeometry args={[0.62, 0.31]} />
          <meshStandardMaterial map={label} roughness={0.75} />
        </mesh>
        <group position={[-0.12, h / 2 + 0.001, 0.33]}>
          <Sticker w={0.18} d={0.09} seed={63} text="40.04Wh" />
        </group>
      </group>
      <group position={[0.04, Y0 + h / 2, 0.275]}>
        <RoundedBox args={[0.52, h, 0.41]} radius={0.012} smoothness={4} castShadow receiveShadow>
          <meshPhysicalMaterial color="#141518" roughness={0.38} metalness={0.1} clearcoat={0.8} clearcoatRoughness={0.25} />
        </RoundedBox>
        <group position={[0.05, h / 2 + 0.001, 0.0]}>
          <Sticker w={0.22} d={0.11} seed={71} text="CELL-B" />
        </group>
      </group>
      {/* Adhesive pull tabs */}
      {(
        [
          [0.45, 0.505],
          [0.75, 0.505],
          [-0.1, 0.495],
        ] as [number, number][]
      ).map(([x, z]) => (
        <mesh key={`tab-${x}`} position={[x, Y0 + 0.003, z]} castShadow>
          <boxGeometry args={[0.07, 0.002, 0.05]} />
          <meshStandardMaterial color="#e9edf1" roughness={0.6} />
        </mesh>
      ))}
      {/* Battery lead running to its connector */}
      <mesh position={[-0.255, Y0 + 0.02, 0.26]} castShadow>
        <boxGeometry args={[0.07, 0.004, 0.06]} />
        <meshStandardMaterial color="#191a1e" roughness={0.6} />
      </mesh>
    </group>
  );
}

// ───────────────────────── Controller boards ─────────────────────────

function StickModule({ fresh = false }: { fresh?: boolean }) {
  const frame = useDisposable(() => {
    const s = new THREE.Shape();
    const a = 0.14;
    s.moveTo(-a, -a);
    s.lineTo(a, -a);
    s.lineTo(a, a);
    s.lineTo(-a, a);
    s.lineTo(-a, -a);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.085, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.005, bevelEnabled: false, curveSegments: 40 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  return (
    <group>
      {/* Module body */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[0.24, 0.04, 0.24]} />
        <meshStandardMaterial color={fresh ? '#25282e' : '#16181b'} roughness={0.6} metalness={0.15} />
      </mesh>
      {/* Steel frame */}
      <mesh geometry={frame} position={[0, 0.04, 0]} castShadow>
        <meshStandardMaterial color="#c0c7cf" metalness={0.95} roughness={0.25} />
      </mesh>
      {/* Gimbal dome */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <sphereGeometry args={[0.07, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={fresh ? '#30343b' : '#202328'} roughness={0.45} metalness={0.2} />
      </mesh>
      {/* Two sensor housings on adjacent sides, with brass terminals */}
      {(
        [
          [0.15, 0, 0],
          [0, -0.15, Math.PI / 2],
        ] as [number, number, number][]
      ).map(([x, z, r]) => (
        <group key={`pot-${x}-${z}`} position={[x, 0.018, z]} rotation={[0, r, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.05, 0.034, 0.1]} />
            <meshStandardMaterial color="#121316" roughness={0.5} />
          </mesh>
          {[-0.03, 0, 0.03].map((tz) => (
            <mesh key={`pin-${tz}`} position={[0.03, -0.012, tz]}>
              <boxGeometry args={[0.02, 0.004, 0.008]} />
              <meshStandardMaterial color="#c9a95a" metalness={0.95} roughness={0.3} />
            </mesh>
          ))}
        </group>
      ))}
      {fresh && (
        <mesh position={[0, 0.0425, -0.11]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.07, 0.02]} />
          <meshStandardMaterial color="#1a9fff" emissive="#1a9fff" emissiveIntensity={0.6} />
        </mesh>
      )}
    </group>
  );
}

function ControllerBoard({ side, model }: { side: 1 | -1; model: Model }) {
  // side -1 = the Deck's right board (on the viewer's left from the back).
  const black = model === 'lcd';
  const map = useDisposable(
    () => pcbTexture(side < 0 ? 41 : 43, black ? '#141518' : '#17482b', black ? '#2a2c31' : '#2d6a40', '#e3e7ea', side < 0 ? 'R  1030-0010' : 'L  1030-0011', 0.5),
    [side, black],
  );
  const x = side * 1.16;
  const y = Y0 + 0.022;
  const poly = useMemo(() => clipPolygon(side < 0 ? rect(-1.42, -0.5, -0.91, 0.5) : rect(0.91, -0.5, 1.42, 0.5), inset(SHELL_INNER, 0.008)), [side]);
  const local = useMemo<Pt[]>(() => poly.map(([px, pz]) => [px - x, pz]), [poly, x]);
  const board = useDisposable(() => slabGeometry(poly, 0.012, [x, 0]), [poly, x]);
  const avoid = useMemo<Rect[]>(
    () => [
      [-side * 0.12 - 0.14, -0.47, -side * 0.12 + 0.14, -0.19],
      [-side * 0.18 - 0.12, 0.22, -side * 0.18 + 0.12, 0.42],
      [-0.26, -0.5, -0.2, 0.5],
      [0.2, -0.5, 0.26, 0.5],
    ],
    [side],
  );
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={board} position={[0, Y0 + 0.01, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#ffffff" map={map} roughness={0.42} metalness={0.15} />
      </mesh>
      <SmdField w={0.5} d={1.0} y={y} count={260} seed={side < 0 ? 51 : 53} avoid={avoid} region={local} />
      {/* Trackpad haptics can */}
      <group position={[-side * 0.18, y + 0.012, 0.32]}>
        <RoundedBox args={[0.22, 0.024, 0.18]} radius={0.01} smoothness={3} castShadow>
          <meshStandardMaterial color="#aeb5bd" metalness={0.95} roughness={0.3} />
        </RoundedBox>
      </group>
      {/* Controller MCU and gyro */}
      <group position={[side * 0.05, y + 0.003, 0.02]}>
        <Chip w={0.09} d={0.09} h={0.006} />
      </group>
      <group position={[side * -0.1, y + 0.002, 0.12]}>
        <Chip w={0.04} d={0.04} h={0.004} />
      </group>
      {/* ZIF connectors along the inner edge, blue latches */}
      {[-0.42, -0.1, 0.12, 0.4].map((z) => (
        <group key={`zif-${z}`} position={[side * -0.21, y + 0.004, z]}>
          <Connector w={0.03} d={0.11} />
        </group>
      ))}
      {/* Shoulder button module at the top corner */}
      <mesh position={[side * 0.08, Y0 + 0.03, -0.5]} castShadow>
        <boxGeometry args={[0.3, 0.05, 0.08]} />
        <meshStandardMaterial color="#141518" roughness={0.65} />
      </mesh>
      <group position={[side * 0.02, y + 0.001, 0.2]}>
        <Sticker w={0.14} d={0.07} seed={side < 0 ? 81 : 83} text={side < 0 ? 'R-BTN' : 'L-BTN'} />
      </group>
    </group>
  );
}

function coax(points: [number, number, number][]): THREE.TubeGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 48, 0.006, 8, false);
}

// Wi-Fi antenna leads from the mainboard to the top corners.
function Antennas() {
  const a = useDisposable(() => coax([[-0.42, Y0 + 0.02, -0.44], [-0.6, Y0 + 0.03, -0.53], [-0.88, Y0 + 0.03, -0.56], [-1.2, Y0 + 0.035, -0.555]]), []);
  const b = useDisposable(() => coax([[-0.38, Y0 + 0.02, -0.46], [-0.2, Y0 + 0.07, -0.585], [0.4, Y0 + 0.06, -0.59], [1.15, Y0 + 0.04, -0.56]]), []);
  return (
    <group>
      <mesh geometry={a} castShadow>
        <meshStandardMaterial color="#202226" roughness={0.5} />
      </mesh>
      <mesh geometry={b} castShadow>
        <meshStandardMaterial color="#8b9097" roughness={0.5} />
      </mesh>
      {(
        [
          [-0.42, -0.44],
          [-0.38, -0.46],
        ] as [number, number][]
      ).map(([x, z]) => (
        <mesh key={`ufl-${x}`} position={[x, Y0 + 0.021, z]}>
          <cylinderGeometry args={[0.012, 0.012, 0.01, 16]} />
          <meshStandardMaterial color="#d4b469" metalness={0.95} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

// ───────────────────────── SSD ─────────────────────────

export function Ssd({ fresh = false }: { fresh?: boolean }) {
  const label = useDisposable(() => ssdLabelTexture(fresh), [fresh]);
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.3, 0.008, 0.22]} />
        <meshStandardMaterial color={fresh ? '#14361f' : '#1d3b2a'} roughness={0.5} />
      </mesh>
      {/* Controller + NAND under the label */}
      <mesh position={[0.02, 0.008, 0]} castShadow>
        <boxGeometry args={[0.2, 0.008, 0.17]} />
        <meshStandardMaterial color="#111316" roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh position={[0.02, 0.0125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, 0.15]} />
        <meshStandardMaterial map={label} roughness={0.55} />
      </mesh>
      {/* ESD sleeve */}
      <mesh position={[0.02, 0.006, 0]}>
        <boxGeometry args={[0.22, 0.024, 0.226]} />
        <meshStandardMaterial color="#c3ccd6" metalness={0.95} roughness={0.2} opacity={0.28} transparent />
      </mesh>
      {/* Gold fingers at the socket end, screw notch at the other */}
      <mesh position={[0.155, 0, 0]}>
        <boxGeometry args={[0.024, 0.009, 0.2]} />
        <meshStandardMaterial color="#d4a73a" metalness={0.95} roughness={0.25} />
      </mesh>
      <mesh position={[-0.15, 0.001, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.0095, 16]} />
        <meshStandardMaterial color="#c9b27a" metalness={0.9} roughness={0.35} />
      </mesh>
    </group>
  );
}

// ───────────────────────── Assembly ─────────────────────────

export const SHIELD_SCREWS: Record<Model, [number, number][]> = {
  lcd: [[-0.83, -0.49], [-0.31, -0.49], [-0.83, 0.48]],
  oled: [[-0.83, -0.49], [-0.83, 0.48]],
};

export function Internals({ model }: { model: Model }) {
  const torx = model === 'oled';
  const audioFlex = useDisposable(() => flexTexture('17A-AUDIO-FPC  REV 2'), []);
  const sideFlex = useDisposable(() => flexTexture('1030-FLEX-B2B'), []);
  const sy = Y0 + 0.012; // board top

  return (
    <group>
      <Midframe />
      <Mainboard model={model} />
      <HeatPipe />
      <FinStack />
      <Battery />
      <ControllerBoard side={-1} model={model} />
      <ControllerBoard side={1} model={model} />
      <Antennas />

      {/* Audio flex along the bottom and the board-to-board flex up the side of the battery */}
      <group position={[-0.08, Y0 + 0.058, 0.507]}>
        <Flex length={1.9} width={0.035} map={audioFlex} />
      </group>
      <group position={[0.315, Y0 + 0.058, -0.02]} rotation={[0, Math.PI / 2, 0]}>
        <Flex length={0.96} width={0.035} map={sideFlex} />
      </group>

      {/* Screws holding the controller boards and the mainboard down */}
      {(
        [
          [-1.38, -0.45], [-0.94, -0.45], [-1.38, 0.45], [-0.94, 0.2],
          [1.38, -0.45], [0.94, -0.45], [1.38, 0.45], [0.94, 0.2],
          [-0.84, -0.3], [-0.3, -0.3], [-0.84, 0.2],
        ] as [number, number][]
      ).map(([x, z]) => (
        <group key={`bscrew-${x}-${z}`} position={[x, Y0 + 0.034, z]}>
          <Screw torx={torx} size={0.013} length={0.02} />
        </group>
      ))}

      {/* Left thumbstick (static) */}
      <group position={[1.04, Y0 + 0.022, -0.33]}>
        <StickModule />
      </group>

      {/* Right thumbstick: replaced in its guide */}
      <Part id="tstick-r" groups={['tstick']} position={[-1.04, Y0 + 0.022, -0.33]} exit={[-0.25, 0.85, 0]} tilt={-0.4}>
        <StickModule />
      </Part>
      <Part id="tstick-r-new" isNew position={[-1.04, Y0 + 0.022, -0.33]} exit={[-0.25, 0.85, 0]}>
        <StickModule fresh />
      </Part>
      {(
        [
          [-1.2, -0.48],
          [-0.88, -0.48],
          [-1.2, -0.18],
        ] as [number, number][]
      ).map(([x, z], i) => (
        <Part key={`ts-${x}-${z}`} id={`tstick-screw-${i}`} groups={['tstick-screws']} position={[x, Y0 + 0.05, z]} exit={[0, 0.5, 0]} spin>
          <Screw torx={torx} size={0.015} length={0.03} />
        </Part>
      ))}
      <Part id="tstick-cable" position={[-0.93, Y0 + 0.032, -0.2]} exit={[0.07, 0.02, 0]} stay>
        <Flex length={0.14} width={0.05} color="#2d6fb3" rotationY={Math.PI / 2} />
      </Part>

      {/* Fan, its lead, screws and heatsink sticker */}
      <Part id="fan" position={[0.02, Y0, -0.27]} exit={[0.1, 0.95, -0.2]} tilt={0.5}>
        <Fan model={model} />
      </Part>
      <Part id="fan-new" isNew position={[0.02, Y0, -0.27]} exit={[0.1, 0.95, -0.2]}>
        <Fan model={model} fresh />
      </Part>
      <Part id="fan-sticker" position={[0.02, Y0 + 0.054, -0.5]} exit={[0, 0.35, -0.1]} tilt={-0.6}>
        <mesh castShadow>
          <boxGeometry args={[0.46, 0.002, 0.09]} />
          <meshStandardMaterial color="#0c0d0f" roughness={0.85} />
        </mesh>
      </Part>
      <Part id="fan-cable" position={[-0.3, sy + 0.006, -0.12]} exit={[0, 0.06, 0]} stay>
        <mesh castShadow>
          <boxGeometry args={[0.035, 0.012, 0.06]} />
          <meshStandardMaterial color="#efece4" roughness={0.5} />
        </mesh>
      </Part>
      {(
        [
          [-0.21, -0.03],
          [0.25, -0.03],
        ] as [number, number][]
      ).map(([x, z], i) => (
        <Part key={`fs-${x}-${z}`} id={`fan-screw-${i}`} groups={['fan-screws']} position={[x, Y0 + 0.06, z]} exit={[0, 0.5, 0]} spin>
          <Screw torx={torx} size={0.015} length={0.03} />
        </Part>
      ))}

      {/* Battery connector */}
      <Part id="battery-cable" groups={['battery']} position={[-0.31, sy + 0.008, 0.26]} exit={[0.11, 0.03, 0]} stay>
        <mesh castShadow>
          <boxGeometry args={[0.04, 0.016, 0.075]} />
          <meshStandardMaterial color="#efece4" roughness={0.5} />
        </mesh>
        <mesh position={[0.04, 0.004, 0]}>
          <boxGeometry args={[0.05, 0.004, 0.05]} />
          <meshStandardMaterial color="#c43c3c" roughness={0.6} />
        </mesh>
      </Part>

      {/* SSD and its screw, on the lower mainboard */}
      <Part id="ssd" position={[-0.47, sy + 0.012, 0.355]} exit={[0.4, 0.7, 0.1]}>
        <Ssd />
      </Part>
      <Part id="ssd-new" isNew position={[-0.47, sy + 0.012, 0.355]} exit={[0.4, 0.7, 0.1]}>
        <Ssd fresh />
      </Part>
      <Part id="ssd-screw" position={[-0.635, sy + 0.03, 0.355]} exit={[0, 0.5, 0]} spin>
        <Screw torx={torx} size={0.013} length={0.02} />
      </Part>

      {/* OLED: the right button board's interconnect (C-R) runs over the shield */}
      {model === 'oled' && (
        <Part id="interconnect" position={[-0.66, Y0 + 0.062, -0.4]} exit={[0.6, 0.06, 0.45]} stay>
          <Flex length={0.52} width={0.05} map={sideFlex} />
        </Part>
      )}

      {/* Board shield and its screws */}
      <Part id="shield" position={[MAIN.x, sy, MAIN.z]} exit={[-0.2, 1.05, -0.35]} tilt={-0.35}>
        <Shield model={model} />
      </Part>
      {SHIELD_SCREWS[model].map(([x, z], i) => (
        <Part key={`ss-${x}-${z}`} id={`shield-screw-${i}`} groups={['shield-screws']} position={[x, sy + 0.058, z]} exit={[0, 0.55, 0]} spin>
          <Screw torx={torx} size={0.014} length={0.03} />
        </Part>
      ))}
      {model === 'lcd' && (
        <>
          <Part id="foil-tape" position={[-0.31, sy + 0.05, 0.1]} exit={[0.1, 0.35, 0.1]} tilt={0.8}>
            <mesh castShadow>
              <boxGeometry args={[0.09, 0.002, 0.09]} />
              <meshStandardMaterial color="#d9dde2" metalness={1} roughness={0.15} />
            </mesh>
          </Part>
          <Part id="shield-screw-hidden" groups={['shield-screws']} position={[-0.31, sy + 0.054, 0.1]} exit={[0, 0.55, 0]} spin>
            <Screw torx={false} size={0.013} length={0.02} />
          </Part>
        </>
      )}

      {/* microSD card in its slot on the bottom edge */}
      <Part id="microsd" position={[-0.75, 0.217, 0.53]} exit={[0, 0.12, 0.6]}>
        <mesh castShadow>
          <boxGeometry args={[0.11, 0.007, 0.15]} />
          <meshStandardMaterial color="#1f6fd6" roughness={0.4} />
        </mesh>
      </Part>
    </group>
  );
}
