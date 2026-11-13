import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
// Bundled by Vite as a separate hashed file, fetched only when the 3D viewer opens.
import shellUrl from './assets/steam-deck-shell.bin?url';

// The Steam Deck shell from Valve's official CAD (CC BY-NC-SA 4.0), packed by DeckTune into
// assets/steam-deck-shell.bin: front shell, controls (sticks, buttons) and back cover, already
// placed in the scene's axes (face-down, top edge away from the viewer, units of 100 mm).
export interface DeckShell {
  front: THREE.BufferGeometry;
  controls: THREE.BufferGeometry;
  back: THREE.BufferGeometry;
}

const CREASE = THREE.MathUtils.degToRad(32);

function parse(data: ArrayBuffer): DeckShell {
  const view = new DataView(data);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== 'SDK1') throw new Error('Unexpected shell file');

  const count = view.getUint32(4, true);
  const scale = view.getFloat32(8, true);
  let off = 12;
  const parts: Record<string, THREE.BufferGeometry> = {};

  for (let p = 0; p < count; p++) {
    let name = '';
    for (let i = 0; i < 16; i++) {
      const c = view.getUint8(off + i);
      if (c) name += String.fromCharCode(c);
    }
    const vertexCount = view.getUint32(off + 16, true);
    const indexCount = view.getUint32(off + 20, true);
    off += 24;

    const positions = new Float32Array(vertexCount * 3);
    const packed = new Int16Array(data, off, vertexCount * 3);
    for (let i = 0; i < positions.length; i++) positions[i] = packed[i] * scale;
    off += Math.ceil((vertexCount * 6) / 4) * 4;

    const wide = vertexCount > 65535;
    const indices = wide ? new Uint32Array(data.slice(off, off + indexCount * 4)) : new Uint16Array(data.slice(off, off + indexCount * 2));
    off += Math.ceil((indexCount * (wide ? 4 : 2)) / 4) * 4;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    // Smooth across the CAD's curved surfaces, keep its hard edges crisp.
    const shaded = toCreasedNormals(g, CREASE);
    g.dispose();
    shaded.computeBoundingBox();
    shaded.computeBoundingSphere();
    parts[name] = shaded;
  }

  return { front: parts.front, controls: parts.controls, back: parts.back };
}

let pending: Promise<DeckShell> | null = null;

// Loaded once per page; every viewer shares it.
export function loadDeckShell(): Promise<DeckShell> {
  pending ??= fetch(shellUrl)
    .then((r) => {
      if (!r.ok) throw new Error(`Shell download failed (${r.status})`);
      return r.arrayBuffer();
    })
    .then(parse)
    .catch((e: unknown) => {
      pending = null; // let a later mount try again
      throw e;
    });
  return pending;
}
