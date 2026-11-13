import { Suspense, use, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, N8AO, SMAA } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { loadDeckShell, type DeckShell } from './shell-mesh';
import { Part, SceneContext, Screw, type DeckSceneState } from './parts';
import { Internals } from './internals';

export type { DeckSceneState } from './parts';

export interface DeckSceneProps {
  model: 'lcd' | 'oled';
  scene: DeckSceneState;
}

const FRONT_SHELL = { lcd: '#25282e', oled: '#1f2227' } as const;
const BACK_SHELL = { lcd: '#2d3037', oled: '#272a30' } as const;
const CONTROLS = '#16181b';

// ───────────────────────── The real shell ─────────────────────────

// One piece of Valve's CAD shell. The pieces are open surfaces (cut at the seam), so both sides render.
function ShellMesh({ geometry, color, roughness = 0.62 }: { geometry: THREE.BufferGeometry; color: string; roughness?: number }) {
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0.04} side={THREE.DoubleSide} />
    </mesh>
  );
}

// The eight back-cover screws, seated in the counterbored holes found in Valve's CAD shell
// (hole centres at ±108/-48.5, ±97/52, ±28.3/-52 and ±27/40 mm; y is the floor of each counterbore).
const BACK_SCREWS: [number, number, number][] = [
  [1.08, 0.28, 0.485], [-1.08, 0.28, 0.485],
  [0.97, 0.298, -0.52], [-0.97, 0.298, -0.52],
  [0.283, 0.296, 0.52], [-0.283, 0.296, 0.52],
  [0.27, 0.311, -0.4], [-0.27, 0.311, -0.4],
];

// ───────────────────────── The Deck ─────────────────────────

// Coordinates: the Deck lies face-down on the mat, top edge (triggers) away from the viewer (−z).
// Seen from the back the Deck's RIGHT side is on the viewer's left (−x). Units ≈ 10 cm.
const shellPromise = typeof window === 'undefined' ? null : loadDeckShell();

function Deck({ model, view }: { model: 'lcd' | 'oled'; view: 'back' | 'front' }) {
  const shell = use(shellPromise!);
  return <DeckModel model={model} view={view} shell={shell} />;
}

function DeckModel({ model, view, shell }: { model: 'lcd' | 'oled'; view: 'back' | 'front'; shell: DeckShell }) {
  const torx = model === 'oled';
  const flipRef = useRef<THREE.Group>(null);
  const angleRef = useRef(view === 'front' ? Math.PI : 0);

  useFrame((_, dt) => {
    const target = view === 'front' ? Math.PI : 0;
    angleRef.current += (target - angleRef.current) * (1 - Math.pow(0.004, dt));
    if (flipRef.current) {
      flipRef.current.rotation.z = angleRef.current;
      // Lift while turning so it doesn't sink into the mat.
      flipRef.current.position.y = 0.25 + Math.sin(angleRef.current) * 0.6;
    }
  });

  return (
    <group ref={flipRef} position={[0, 0.25, 0]}>
      <group position={[0, -0.25, 0]}>
        {/* Front shell and its sticks and buttons: Valve's CAD (what lies on the mat) */}
        <ShellMesh geometry={shell.front} color={FRONT_SHELL[model]} />
        <ShellMesh geometry={shell.controls} color={CONTROLS} roughness={0.5} />
        <Screen model={model} />
        {/* Everything inside: boards, cooling, battery, cables (laid out from iFixit's X-ray) */}
        <Internals model={model} />

        {/* Back cover and its eight screws */}
        <Part id="back-cover" position={[0, 0.0, 0]} exit={[0, 1.55, -0.75]} tilt={-0.45}>
          <ShellMesh geometry={shell.back} color={BACK_SHELL[model]} roughness={0.7} />
        </Part>
        {BACK_SCREWS.map(([x, y, z], i) => (
          <Part key={`bs-${x}-${z}`} id={`back-screw-${i}`} groups={['back-screws']} position={[x, y, z]} exit={[0, 0.6, 0]} spin>
            <Screw torx={torx} size={0.0175} length={0.05} />
          </Part>
        ))}
      </group>
    </group>
  );
}

// The screen faces the mat; drawn as a canvas texture so a step can show the BIOS line.
function Screen({ model }: { model: 'lcd' | 'oled' }) {
  const scene = use(SceneContext)!;
  const key = scene.screen.join('|');

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 1024, 640);
    grad.addColorStop(0, model === 'oled' ? '#04060a' : '#0b1220');
    grad.addColorStop(1, '#0d1a30');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 640);
    const lines = key ? key.split('|') : [];
    if (lines.length > 0) {
      ctx.fillStyle = '#1a9fff';
      ctx.font = 'bold 58px sans-serif';
      ctx.fillText(lines[0], 70, 150);
      ctx.fillStyle = '#e8edf5';
      ctx.font = '44px sans-serif';
      lines.slice(1).forEach((l, i) => ctx.fillText(l, 70, 250 + i * 72));
    } else {
      ctx.fillStyle = '#1a9fff';
      ctx.font = 'bold 120px sans-serif';
      ctx.fillText('STEAM', 330, 360);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    // The plane faces the mat; turn the image half a turn so it reads upright once the Deck is flipped over.
    t.center.set(0.5, 0.5);
    t.rotation = Math.PI;
    return t;
  }, [key, model]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={[0, 0.119, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1.51, 0.95]} />
      <meshStandardMaterial map={texture} emissiveMap={texture} emissive="#ffffff" emissiveIntensity={0.55} roughness={0.15} metalness={0.1} />
    </mesh>
  );
}

// ───────────────────────── Label ─────────────────────────

// Keeps a DOM label over a 3D point by projecting it every frame (no React re-render per frame).
function LabelTracker({ point, labelRef }: { point: [number, number, number]; labelRef: RefObject<HTMLDivElement | null> }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const el = labelRef.current;
    if (!el) return;
    v.set(point[0], point[1], point[2]).project(camera);
    const x = (v.x * 0.5 + 0.5) * size.width;
    const y = (-v.y * 0.5 + 0.5) * size.height;
    el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    el.style.opacity = v.z < 1 ? '1' : '0';
  });

  return null;
}

// ───────────────────────── Camera ─────────────────────────

function CameraRig({ focus, zoom, view, resetKey }: { focus: [number, number]; zoom: number; view: 'back' | 'front'; resetKey: number }) {
  const { camera, controls } = useThree();
  const flyingRef = useRef(1.6);

  useEffect(() => {
    flyingRef.current = 1.6;
  }, [focus, zoom, view, resetKey]);

  useFrame((_, dt) => {
    const c = controls as unknown as OrbitControlsImpl | null;
    if (!c || flyingRef.current <= 0) return;
    flyingRef.current -= dt;

    // Front view: the Deck is flipped over, so mirror x and look from the same side.
    const fx = view === 'front' ? -focus[0] : focus[0];
    const target = new THREE.Vector3(fx, view === 'front' ? 0.38 : 0.22, focus[1]);
    const dir = new THREE.Vector3(0, 1, 0.78).normalize();
    // A little extra distance so close-ups keep some context around the part.
    const pos = target.clone().addScaledVector(dir, zoom * 1.3);

    const k = 1 - Math.pow(0.02, dt);
    camera.position.lerp(pos, k);
    c.target.lerp(target, k);
    c.update();
  });

  return null;
}

// ───────────────────────── Canvas ─────────────────────────

// Software rendering (no GPU: VMs, remote desktops, some locked-down PCs) can't keep up with
// ambient occlusion and soft shadows, so those devices start in the light mode.
function hasSoftwareRenderer(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    const name = info && gl ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|basic render|llvmpipe|software|softpipe/i.test(name);
  } catch {
    return false;
  }
}

export default function DeckScene({ model, scene }: DeckSceneProps) {
  const [resetKey, setResetKey] = useState(0);
  // Full quality unless the device is software-rendered or the frame rate drops.
  const [high, setHigh] = useState(() => !hasSoftwareRenderer());
  const labelRef = useRef<HTMLDivElement>(null);
  const labelPos = useMemo<[number, number, number]>(
    () => [scene.view === 'front' ? -scene.focus[0] : scene.focus[0], scene.view === 'front' ? 0.95 : 0.7, scene.focus[1]],
    [scene.focus, scene.view],
  );

  return (
    <div className="deck3d-root">
      <Canvas shadows={high} dpr={high ? [1, 2] : 1} camera={{ position: [0, 3.2, 2.6], fov: 38 }} gl={{ antialias: true, alpha: true }}>
        {high && <PerformanceMonitor flipflops={1} onDecline={() => setHigh(false)} />}
        <SceneContext value={scene}>
          <hemisphereLight args={['#bcd7ff', '#0a0e16', 0.55]} />
          <directionalLight
            position={[2.5, 5, 2.2]}
            intensity={2.2}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-3}
            shadow-camera-right={3}
            shadow-camera-top={3}
            shadow-camera-bottom={-3}
          />
          <pointLight position={[-3, 1.5, -2]} intensity={6} color="#1a9fff" distance={8} />
          <pointLight position={[3, 1.2, 2.5]} intensity={3} color="#ffb36b" distance={7} />

          <Environment resolution={256}>
            <Lightformer form="rect" intensity={2.2} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[6, 3, 1]} />
            <Lightformer form="rect" intensity={1.2} color="#1a9fff" position={[-4, 1, 0]} rotation-y={Math.PI / 2} scale={[4, 2, 1]} />
            <Lightformer form="ring" intensity={1} color="#ffb36b" position={[4, 2, 3]} scale={1.5} />
          </Environment>

          <Suspense fallback={null}>
            <Deck model={model} view={scene.view} />
          </Suspense>

          <LabelTracker point={labelPos} labelRef={labelRef} />

          {/* Repair mat */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.075, 0]} receiveShadow>
            <planeGeometry args={[9, 6]} />
            <meshStandardMaterial color="#0d1626" roughness={0.95} />
          </mesh>
          <Grid
            position={[0, -0.072, 0]}
            args={[9, 6]}
            cellSize={0.1}
            cellThickness={0.6}
            cellColor="#1c2c46"
            sectionSize={0.5}
            sectionThickness={1.1}
            sectionColor="#1f4f80"
            fadeDistance={9}
            fadeStrength={1.5}
          />
          {/* Re-rendered every frame on capable devices; drawn once in the light mode. */}
          <ContactShadows position={[0, -0.07, 0]} opacity={0.55} scale={7} blur={2.6} far={1.5} frames={high ? Infinity : 1} />

          {high && (
            <EffectComposer multisampling={0} enableNormalPass={false}>
              <N8AO aoRadius={0.12} distanceFalloff={0.5} intensity={2.4} quality="medium" halfRes />
              <SMAA />
            </EffectComposer>
          )}

          <OrbitControls makeDefault enablePan={false} minDistance={0.9} maxDistance={6} maxPolarAngle={Math.PI * 0.49} />
          <CameraRig focus={scene.focus} zoom={scene.zoom} view={scene.view} resetKey={resetKey} />
        </SceneContext>
      </Canvas>

      <div className="deck3d-hud">
        <span>Drag to rotate · scroll or pinch to zoom</span>
        <button type="button" onClick={() => setResetKey((k) => k + 1)}>
          Reset view
        </button>
      </div>
      {scene.label && (
        <div ref={labelRef} className="deck3d-label-anchor">
          <div key={scene.label} className="deck3d-label">
            {scene.label}
          </div>
        </div>
      )}
      <div className="deck3d-note">
        Shell:{' '}
        <a href="https://gitlab.steamos.cloud/SteamHardware/SteamDeck" target="_blank" rel="noreferrer">
          Steam Deck CAD by Valve
        </a>
        ,{' '}
        <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">
          CC BY-NC-SA 4.0
        </a>
        , adapted · internals illustrative
      </div>
    </div>
  );
}
