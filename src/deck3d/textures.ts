import * as THREE from 'three';

// Small seeded random generator so procedural detail is identical on every load.
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// A circuit board: solder mask, copper pours and traces, vias, silkscreen outlines and reference text.
export function pcbTexture(seed: number, mask: string, trace: string, silk: string, label: string, aspect: number): THREE.CanvasTexture {
  const w = 1024;
  const h = Math.max(256, Math.round(1024 / aspect / 64) * 64);
  return canvasTexture(w, h, (ctx) => {
    const r = rng(seed);
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, w, h);

    // Copper pours, slightly lighter under the mask.
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = trace;
    for (let i = 0; i < 10; i++) ctx.fillRect(r() * w, r() * h, 60 + r() * 220, 40 + r() * 160);
    ctx.globalAlpha = 1;

    // Traces: runs with 45° jogs, in bundles.
    ctx.strokeStyle = trace;
    ctx.lineCap = 'round';
    for (let b = 0; b < 70; b++) {
      const x = r() * w;
      const y = r() * h;
      const lanes = 2 + Math.floor(r() * 6);
      const horizontal = r() > 0.5;
      const len = 80 + r() * 380;
      const jog = (r() - 0.5) * 120;
      ctx.lineWidth = 1.2 + r() * 1.8;
      for (let l = 0; l < lanes; l++) {
        const o = l * 6;
        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo(x, y + o);
          ctx.lineTo(x + len * 0.5, y + o);
          ctx.lineTo(x + len * 0.5 + Math.abs(jog), y + o + jog);
          ctx.lineTo(x + len, y + o + jog);
        } else {
          ctx.moveTo(x + o, y);
          ctx.lineTo(x + o, y + len * 0.5);
          ctx.lineTo(x + o + jog, y + len * 0.5 + Math.abs(jog));
          ctx.lineTo(x + o + jog, y + len);
        }
        ctx.stroke();
      }
    }

    // Vias.
    for (let i = 0; i < 900; i++) {
      const x = r() * w;
      const y = r() * h;
      ctx.fillStyle = '#c9a25a';
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(x, y, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Silkscreen: component outlines and reference designators.
    ctx.strokeStyle = silk;
    ctx.fillStyle = silk;
    ctx.lineWidth = 1.4;
    ctx.font = '10px monospace';
    for (let i = 0; i < 140; i++) {
      const x = r() * w;
      const y = r() * h;
      const cw = 8 + r() * 26;
      const ch = 6 + r() * 16;
      ctx.strokeRect(x, y, cw, ch);
      const prefix = ['C', 'R', 'L', 'U', 'Q', 'D', 'TP'][Math.floor(r() * 7)];
      ctx.fillText(`${prefix}${Math.floor(r() * 900 + 10)}`, x, y - 2);
    }
    ctx.font = 'bold 26px monospace';
    ctx.fillText(label, 24, h - 24);
  });
}

// The battery's white label panel: ratings, warnings, recycling marks and a QR-like code.
export function batteryLabelTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 512, (ctx) => {
    ctx.fillStyle = '#eef0f2';
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = '#16181b';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('Li-ion Polymer Battery', 40, 80);
    ctx.font = '32px sans-serif';
    ctx.fillText('7.7V   5313mAh   40.04Wh', 40, 135);
    ctx.font = '22px sans-serif';
    ['Do not puncture, crush or expose to heat above 60°C.', 'Do not short-circuit. Recycle properly.', 'Rechargeable battery pack · 2S1P'].forEach((l, i) => ctx.fillText(l, 40, 190 + i * 32));
    // QR-like block.
    const r = rng(7);
    for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
      const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      if (finder ? (x % 6 === 0 || y % 6 === 0 || x === 20 || y === 20 || (x % 7 > 1 && x % 7 < 5 && y % 7 > 1 && y % 7 < 5)) : r() > 0.5) {
        ctx.fillRect(780 + x * 10, 40 + y * 10, 10, 10);
      }
    }
    // Recycling / disposal marks.
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#16181b';
    ctx.strokeRect(40, 340, 90, 110);
    ctx.beginPath();
    ctx.moveTo(40, 340);
    ctx.lineTo(130, 450);
    ctx.moveTo(130, 340);
    ctx.lineTo(40, 450);
    ctx.stroke();
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('CE', 170, 420);
    ctx.beginPath();
    ctx.arc(330, 400, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('Li-ion', 290, 410);
  });
}

// Generic M.2 2230 drive label.
export function ssdLabelTexture(fresh: boolean): THREE.CanvasTexture {
  return canvasTexture(512, 384, (ctx) => {
    ctx.fillStyle = fresh ? '#0e1a2a' : '#1b1d22';
    ctx.fillRect(0, 0, 512, 384);
    ctx.fillStyle = fresh ? '#1a9fff' : '#d8dde3';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText(fresh ? '2TB' : '512GB', 30, 90);
    ctx.font = '30px sans-serif';
    ctx.fillStyle = '#d8dde3';
    ctx.fillText('NVMe M.2 2230', 30, 145);
    ctx.fillText('PCIe Gen3 x4', 30, 190);
    ctx.font = '20px monospace';
    ctx.fillText(fresh ? 'S/N 7F2C-91A0-NEW' : 'S/N 3B81-0C4E-221', 30, 250);
    const r = rng(fresh ? 11 : 5);
    for (let i = 0; i < 46; i++) {
      const bw = 2 + Math.floor(r() * 4);
      ctx.fillRect(30 + i * 9, 290, bw, 60);
    }
  });
}

// The fan's centre hub sticker.
export function fanStickerTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#e7e9ec';
    ctx.beginPath();
    ctx.arc(128, 128, 126, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1d21';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DC 5V', 128, 105);
    ctx.font = '22px sans-serif';
    ctx.fillText('0.50A', 128, 138);
    ctx.font = '16px monospace';
    ctx.fillText('BLOWER · 4P', 128, 168);
  });
}

// Amber flex cable with printed part number and trace lines.
export function flexTexture(text: string): THREE.CanvasTexture {
  const t = canvasTexture(1024, 64, (ctx) => {
    ctx.fillStyle = '#c87a1c';
    ctx.fillRect(0, 0, 1024, 64);
    ctx.strokeStyle = '#d99a3e';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 8 + i * 10);
      ctx.lineTo(1024, 8 + i * 10);
      ctx.stroke();
    }
    ctx.fillStyle = '#3b2108';
    ctx.font = 'bold 22px monospace';
    for (let x = 40; x < 1024; x += 360) ctx.fillText(text, x, 40);
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// Brushed metal for the board shield: fine streaks along one axis.
export function brushedTexture(base: string, seed: number): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    const r = rng(seed);
    for (let i = 0; i < 2200; i++) {
      const y = r() * 512;
      const a = 0.04 + r() * 0.08;
      ctx.strokeStyle = r() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      ctx.lineWidth = 0.6 + r();
      ctx.beginPath();
      const x = r() * 512;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 60 + r() * 300, y);
      ctx.stroke();
    }
  });
}

// A small white sticker with a QR-like code and a serial line (shield, boards).
export function stickerTexture(seed: number, text: string): THREE.CanvasTexture {
  return canvasTexture(256, 128, (ctx) => {
    ctx.fillStyle = '#f2f3f5';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#16181b';
    const r = rng(seed);
    for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) if (r() > 0.5 || x === 0 || y === 0) ctx.fillRect(12 + x * 8, 12 + y * 8, 8, 8);
    ctx.font = 'bold 18px monospace';
    ctx.fillText(text, 130, 50);
    ctx.font = '14px monospace';
    ctx.fillText(`${Math.floor(r() * 9e6 + 1e6)}`, 130, 80);
  });
}
