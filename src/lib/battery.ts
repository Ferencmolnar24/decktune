// Rough battery life for a preset: how much the handheld draws on it, against how much its battery
// holds. Deck presets draw their TDP limit (a capped game usually sits a little under it) plus the
// screen, memory and the rest; Ally presets work it out from the Armoury Crate mode (profiles.ts).
import type { DeckProfile } from './profiles';
import { resolveModel, usableWh, type DeckModel, type DeviceId } from './handhelds';

// Everything but the chip: the LCD's backlight costs about a watt more than the OLED panel.
const DECK_REST_W: Partial<Record<DeviceId, number>> = { lcd: 5, oled: 4 };

export function deckDrawWatts(p: DeckProfile, device: DeviceId): number {
  const tdp = p.TdpLimitWatts > 0 ? p.TdpLimitWatts : 15;
  return tdp * 0.9 + (DECK_REST_W[device] ?? 4.5);
}

// Hours for a battery holding `wh`, as a short honest range in half hours: "3–3.5 h".
export function batteryRange(wh: number, watts: number): string {
  const h = watts > 0 ? wh / watts : 0;
  const half = (x: number) => Math.max(0.5, Math.round(x * 2) / 2);
  const lo = half(h * 0.9);
  const hi = half(h * 1.1);
  return lo === hi ? `About ${lo} h` : `${lo}–${hi} h`;
}

export const batteryMid = (wh: number, watts: number) => (watts > 0 ? wh / watts : 0);

// The visitor's own model and battery health on their handheld; a stock model at full health on
// any other.
export function batteryFor(device: DeviceId, own: { device: DeviceId; model: DeckModel; health: number }) {
  const mine = device === own.device;
  const model = mine ? own.model : resolveModel('', device);
  return { model, wh: usableWh(model, mine ? own.health : 100), health: mine ? own.health : 100 };
}
