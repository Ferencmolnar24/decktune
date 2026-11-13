import { createContext, use, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// What the C# side sends for the current step.
export interface DeckSceneState {
  removed: string[];
  shown: string[];
  highlight: string[];
  focus: [number, number];
  zoom: number;
  view: 'back' | 'front';
  label: string;
  screen: string[];
}

export const BRAND = new THREE.Color('#1a9fff');

// The scene state, read by every part to decide where it should be.
export const SceneContext = createContext<DeckSceneState | null>(null);

function matches(list: string[], id: string, groups: string[]): boolean {
  return list.includes(id) || groups.some((g) => list.includes(g));
}

// ───────────────────────── Animated part wrapper ─────────────────────────

interface PartProps {
  id: string;
  groups?: string[];
  position?: [number, number, number];
  rotationY?: number;
  // Where the part travels when it comes off (relative to home).
  exit?: [number, number, number];
  // Disconnected parts (cables, connectors) move but stay visible.
  stay?: boolean;
  spin?: boolean;
  // Replacement parts start hidden and arrive when a step lists them in `shown`.
  isNew?: boolean;
  tilt?: number;
  children: ReactNode;
}

export function Part({ id, groups = [], position = [0, 0, 0], rotationY = 0, exit = [0, 0.8, 0], stay = false, spin = false, isNew = false, tilt = 0, children }: PartProps) {
  const scene = use(SceneContext)!;
  const groupRef = useRef<THREE.Group>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const progressRef = useRef(isNew ? 1 : 0);
  const opacityRef = useRef(isNew ? 0 : 1);
  // A part that is about to come off glows in place for a moment first, so you see what's next.
  const leaveAtRef = useRef<number | null>(null);
  const wasOutRef = useRef(isNew);

  const removed = matches(scene.removed, id, groups);
  const shown = matches(scene.shown, id, groups);
  const out = isNew ? !shown : removed;
  const highlighted = matches(scene.highlight, id, groups);

  useEffect(() => {
    const list: THREE.MeshStandardMaterial[] = [];
    groupRef.current?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material instanceof THREE.MeshStandardMaterial) {
        // Remember the material's own look so fading and highlighting layer on top of it.
        mesh.material.userData.baseOpacity = mesh.material.opacity;
        mesh.material.userData.baseEmissive = mesh.material.emissive.clone();
        mesh.material.userData.baseEmissiveIntensity = mesh.material.emissiveIntensity;
        mesh.material.transparent = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        list.push(mesh.material);
      }
    });
    materialsRef.current = list;
  }, []);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;

    const now = state.clock.elapsedTime;
    if (out && !wasOutRef.current) {
      leaveAtRef.current = now + (isNew ? 0 : 0.8);
    }
    wasOutRef.current = out;
    const leaving = out && (leaveAtRef.current === null || now >= leaveAtRef.current);

    const k = 1 - Math.pow(0.0025, delta);
    progressRef.current += ((leaving ? 1 : 0) - progressRef.current) * k;
    const targetOpacity = leaving && !stay ? 0 : 1;
    opacityRef.current += (targetOpacity - opacityRef.current) * k;

    // Ease out along an arc: up first, then across.
    const p = progressRef.current;
    const lift = Math.sin(Math.min(p, 1) * Math.PI * 0.5);
    g.position.set(position[0] + exit[0] * p, position[1] + exit[1] * lift, position[2] + exit[2] * p);
    g.rotation.x = tilt * p;
    g.rotation.y = rotationY + (spin ? p * Math.PI * 6 : 0);
    g.visible = opacityRef.current > 0.02;

    const pulse = highlighted ? 0.55 + 0.45 * Math.sin(state.clock.elapsedTime * 4) : 0;
    for (const m of materialsRef.current) {
      const base = (m.userData.baseOpacity as number) ?? 1;
      m.opacity = base * opacityRef.current;
      m.depthWrite = base >= 1 && opacityRef.current > 0.98;
      if (highlighted) {
        m.emissive.copy(BRAND);
        m.emissiveIntensity = pulse * 0.9;
      } else {
        m.emissive.copy(m.userData.baseEmissive as THREE.Color);
        m.emissiveIntensity = m.userData.baseEmissiveIntensity as number;
      }
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
      {children}
    </group>
  );
}

// ───────────────────────── Screws ─────────────────────────

// A pan-head screw: domed head with a Torx (six-lobe) or Phillips recess, plus the threaded shank below.
export function Screw({ torx, size = 0.018, length = 0.05 }: { torx: boolean; size?: number; length?: number }) {
  const head = useMemo(() => {
    const g = new THREE.SphereGeometry(size, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.32);
    g.scale(1, 0.55, 1);
    g.translate(0, -size * 0.47, 0);
    return g;
  }, [size]);
  useEffect(() => () => head.dispose(), [head]);

  const recess = size * 0.55;
  return (
    <group>
      <mesh geometry={head}>
        <meshStandardMaterial color="#8e979f" metalness={0.95} roughness={0.28} />
      </mesh>
      <mesh position={[0, -size * 0.25, 0]}>
        <cylinderGeometry args={[size * 0.99, size * 0.99, size * 0.5, 24]} />
        <meshStandardMaterial color="#7f878f" metalness={0.95} roughness={0.32} />
      </mesh>
      {torx
        ? [0, 1, 2].map((i) => (
            <mesh key={`lobe-${i}`} position={[0, size * 0.05, 0]} rotation={[0, (i * Math.PI) / 3, 0]}>
              <boxGeometry args={[recess * 1.5, 0.003, recess * 0.42]} />
              <meshStandardMaterial color="#2a2e33" metalness={0.5} roughness={0.6} />
            </mesh>
          ))
        : [0, 1].map((i) => (
            <mesh key={`slot-${i}`} position={[0, size * 0.05, 0]} rotation={[0, (i * Math.PI) / 2, 0]}>
              <boxGeometry args={[recess * 1.7, 0.003, recess * 0.3]} />
              <meshStandardMaterial color="#2a2e33" metalness={0.5} roughness={0.6} />
            </mesh>
          ))}
      <mesh position={[0, -size * 0.5 - length / 2, 0]}>
        <cylinderGeometry args={[size * 0.5, size * 0.42, length, 12]} />
        <meshStandardMaterial color="#9aa2aa" metalness={0.95} roughness={0.4} />
      </mesh>
    </group>
  );
}
