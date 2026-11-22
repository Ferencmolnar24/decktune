// Frame rates people can actually lock to. A handheld paces evenly at a divisor of its refresh rate
// (30 and 60 at 60 Hz, 40 at 40 Hz, 45 and 90 on the 90 Hz OLED, 40/60/120 on the Ally's 120 Hz
// screen), so presets and reports speak in those numbers rather than "28-34".
import { getHandheld, type DeviceId } from './handhelds';

export const FPS_STEPS = [30, 40, 45, 60, 90, 120] as const;

export function fpsStepsFor(device: DeviceId): number[] {
  if (device === 'lcd') return [30, 40, 60];
  if (device === 'oled') return [30, 40, 45, 60, 90];
  return getHandheld(device).family === 'deck' ? [30, 40, 60] : [30, 40, 60, 90, 120];
}

// The step closest to a measured rate (by ratio, so 35 sits between 30 and 40 fairly); anything
// clearly under 30 is "under 30". Ties go to the lower step, which never oversells.
export function nearestStep(fps: number, steps: readonly number[] = FPS_STEPS): number | null {
  if (fps < 27) return null;
  let best = steps[0];
  for (const s of steps) {
    if (Math.abs(Math.log(fps / s)) < Math.abs(Math.log(fps / best)) - 1e-9) best = s;
  }
  return best;
}

const label = (step: number | null) => (step == null ? 'Under 30' : String(step));

// "28-33 fps" → "30 fps", "45–60 fps" → "45–60 fps", "40 fps (locked)" → "40 fps locked",
// "25-35 fps" → "Up to 30 fps". Text with no numbers ("Not playable") is kept as written.
export function formatFps(text: string, cap: number, device: DeviceId): string {
  const numbers = (text ?? '').match(/\d+(?:\.\d+)?/g)?.map(Number).filter((n) => n >= 10 && n <= 240).slice(0, 2) ?? [];
  if (numbers.length === 0) return text;
  const steps = fpsStepsFor(device);
  const lo = nearestStep(Math.min(...numbers), steps);
  const hi = nearestStep(Math.max(...numbers), steps);
  if (lo === hi) {
    const locked = lo != null && (/lock|stable|capped/i.test(text) || (cap > 0 && lo === cap && numbers.length === 1));
    return `${label(lo)} fps${locked ? ' locked' : ''}`;
  }
  return lo == null ? `Up to ${hi} fps` : `${lo}–${hi} fps`;
}
