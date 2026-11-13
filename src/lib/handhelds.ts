// The handhelds DeckTune tunes for. Steam Deck profiles are stored per model; ROG Ally settings are
// converted from a game's Deck profile in code (profiles.ts), so every game with Deck settings has
// settings for every Ally too. The chip decides the conversion, so each Ally chip is its own entry.

// Class: 0 = about Steam Deck class (Z1, Z2 A), 1 = Z1 Extreme, 2 = Z2 Extreme.
// speed: graphics throughput in Silent / Performance / Turbo against a Deck at its 15 W limit.
// watts: Armoury Crate's power limit per mode on battery; showWatts is false where ASUS's figures
// aren't settled enough to print, and the watts then only feed the battery estimate.
export interface AllyChip {
  name: string;
  cls: 0 | 1 | 2;
  speed: [number, number, number];
  watts: [number, number, number];
  showWatts: boolean;
  turboNote: string;
  batteryWh: number;
  vram: string;
}

export interface Handheld {
  id: DeviceId;
  name: string;
  shortName: string;
  family: 'deck' | 'ally';
  chip?: AllyChip;
}

export type DeviceId = 'lcd' | 'oled' | 'ally' | 'allyz1' | 'allyx' | 'xally' | 'xallyx';

export const HANDHELDS: Handheld[] = [
  { id: 'lcd', name: 'Steam Deck LCD', shortName: 'Deck LCD', family: 'deck' },
  { id: 'oled', name: 'Steam Deck OLED', shortName: 'Deck OLED', family: 'deck' },
  { id: 'ally', name: 'ROG Ally (Z1 Extreme)', shortName: 'Ally Z1E', family: 'ally',
    chip: { name: 'Z1 Extreme', cls: 1, speed: [0.95, 1.25, 1.55], watts: [10, 15, 25], showWatts: true, turboNote: '30 W plugged in', batteryWh: 40, vram: '6 GB' } },
  { id: 'allyz1', name: 'ROG Ally (Z1)', shortName: 'Ally Z1', family: 'ally',
    chip: { name: 'Z1', cls: 0, speed: [0.55, 0.7, 0.8], watts: [10, 15, 25], showWatts: true, turboNote: '30 W plugged in', batteryWh: 40, vram: '4 GB' } },
  { id: 'allyx', name: 'ROG Ally X', shortName: 'Ally X', family: 'ally',
    chip: { name: 'Z1 Extreme', cls: 1, speed: [1.05, 1.35, 1.7], watts: [13, 17, 25], showWatts: true, turboNote: '30 W plugged in', batteryWh: 80, vram: '8 GB' } },
  { id: 'xally', name: 'ROG Xbox Ally (Z2 A)', shortName: 'Xbox Ally', family: 'ally',
    chip: { name: 'Z2 A', cls: 0, speed: [0.8, 0.95, 1.05], watts: [8, 13, 17], showWatts: false, turboNote: 'more when plugged in', batteryWh: 60, vram: '4 GB' } },
  { id: 'xallyx', name: 'ROG Xbox Ally X (Z2 Extreme)', shortName: 'Xbox Ally X', family: 'ally',
    chip: { name: 'Z2 Extreme', cls: 2, speed: [1.25, 1.6, 2.0], watts: [13, 17, 25], showWatts: false, turboNote: 'more when plugged in', batteryWh: 80, vram: '8 GB' } },
];

export const getHandheld = (id: string): Handheld => HANDHELDS.find((h) => h.id === id) ?? HANDHELDS[1];
export const isAlly = (id: string) => getHandheld(id).family === 'ally' && HANDHELDS.some((h) => h.id === id);
export const isDevice = (id: string): id is DeviceId => HANDHELDS.some((h) => h.id === id);

// The Deck profiles an Ally conversion can start from, best first: the OLED's are tuned for the
// stronger, newer Deck, so they're the closer starting point.
export const ALLY_BASES: DeviceId[] = ['oled', 'lcd'];

// ───────────────────────── Retail models ─────────────────────────

export interface DeckModel {
  id: string;
  generation: DeviceId;
  name: string;
  storage: string;
  storageNote: string;
  glass: string;
  batteryWh: number;
  apu: string;
  cpu: string;
  gpu: string;
  memory: string;
  display: string;
  minRefreshHz: number;
  maxRefreshHz: number;
  batteryClaim: string;
  maker: string;
}

const LCD_APU = 'AMD Aerith APU, 7 nm';
const OLED_APU = 'AMD Sephiroth APU, 6 nm';
const LCD_DISPLAY = '7.0" LCD, 1280×800, 400 nits';
const OLED_DISPLAY = '7.4" HDR OLED, 1280×800, up to 1,000 nits HDR';
const DECK_CPU = 'Zen 2, 4 cores / 8 threads, 2.4–3.5 GHz';
const DECK_GPU = 'RDNA 2, 8 compute units, 1.0–1.6 GHz';
const Z1E_APU = 'AMD Ryzen Z1 Extreme, 4 nm';
const Z1E_CPU = 'Zen 4, 8 cores / 16 threads, up to 5.1 GHz';
const Z1E_GPU = 'RDNA 3, 12 compute units, up to 2.7 GHz';
const ALLY_DISPLAY = '7" IPS, 1920×1080, 500 nits, FreeSync Premium (48–120 Hz VRR)';
const ALLY_GLASS = 'Gorilla Glass Victus with anti-reflection coating';
const XALLY_DISPLAY = '7" IPS, 1920×1080, 500 nits, FreeSync Premium, 120 Hz';
const XALLY_GLASS = 'Gorilla Glass Victus+ with anti-reflection coating';

const m = (id: string, generation: DeviceId, name: string, storage: string, storageNote: string, glass: string, batteryWh: number,
  apu: string, cpu: string, gpu: string, memory: string, display: string, minRefreshHz: number, maxRefreshHz: number,
  batteryClaim: string, maker: string): DeckModel =>
  ({ id, generation, name, storage, storageNote, glass, batteryWh, apu, cpu, gpu, memory, display, minRefreshHz, maxRefreshHz, batteryClaim, maker });

export const MODELS: DeckModel[] = [
  m('lcd-64', 'lcd', 'LCD 64 GB', '64 GB eMMC', 'Slower than the SSD models: longer loads and shader-cache builds.',
    'Standard glass', 40, LCD_APU, DECK_CPU, DECK_GPU, '16 GB LPDDR5, 5500 MT/s', LCD_DISPLAY, 40, 60, '2–8 hours', 'Valve'),
  m('lcd-256', 'lcd', 'LCD 256 GB', '256 GB NVMe SSD', 'Fast loads.',
    'Standard glass', 40, LCD_APU, DECK_CPU, DECK_GPU, '16 GB LPDDR5, 5500 MT/s', LCD_DISPLAY, 40, 60, '2–8 hours', 'Valve'),
  m('lcd-512', 'lcd', 'LCD 512 GB', '512 GB NVMe SSD', 'Fast loads.',
    'Premium anti-glare etched glass', 40, LCD_APU, DECK_CPU, DECK_GPU, '16 GB LPDDR5, 5500 MT/s', LCD_DISPLAY, 40, 60, '2–8 hours', 'Valve'),
  m('oled-512', 'oled', 'OLED 512 GB', '512 GB NVMe SSD', 'Fast loads.',
    'Standard glass', 50, OLED_APU, DECK_CPU, DECK_GPU, '16 GB LPDDR5, 6400 MT/s', OLED_DISPLAY, 45, 90, '3–12 hours', 'Valve'),
  m('oled-1tb', 'oled', 'OLED 1 TB', '1 TB NVMe SSD', 'Fast loads and the most room for games.',
    'Premium anti-glare etched glass', 50, OLED_APU, DECK_CPU, DECK_GPU, '16 GB LPDDR5, 6400 MT/s', OLED_DISPLAY, 45, 90, '3–12 hours', 'Valve'),
  m('ally-z1e', 'ally', 'Ally Z1 Extreme', '512 GB PCIe 4.0 SSD (M.2 2230)', 'Fast loads; a microSD slot adds room.',
    ALLY_GLASS, 40, Z1E_APU, Z1E_CPU, Z1E_GPU, '16 GB LPDDR5, 6400 MT/s', ALLY_DISPLAY, 60, 120, '', 'ASUS'),
  m('ally-z1', 'allyz1', 'Ally Z1', '512 GB PCIe 4.0 SSD (M.2 2230)', 'Fast loads; a microSD slot adds room.',
    ALLY_GLASS, 40, 'AMD Ryzen Z1, 4 nm', 'Zen 4, 6 cores / 12 threads, up to 4.9 GHz', 'RDNA 3, 4 compute units, up to 2.5 GHz',
    '16 GB LPDDR5, 6400 MT/s', ALLY_DISPLAY, 60, 120, '', 'ASUS'),
  m('allyx-1tb', 'allyx', 'Ally X 1 TB', '1 TB PCIe 4.0 SSD (M.2 2280)', 'Fast loads, and the full-size 2280 slot makes upgrades easy.',
    ALLY_GLASS, 80, Z1E_APU, Z1E_CPU, Z1E_GPU, '24 GB LPDDR5X, 7500 MT/s', ALLY_DISPLAY, 60, 120, '', 'ASUS'),
  m('xally-512', 'xally', 'Xbox Ally 512 GB', '512 GB PCIe 4.0 SSD (M.2 2280)', 'Fast loads, and the full-size 2280 slot makes upgrades easy.',
    XALLY_GLASS, 60, 'AMD Ryzen Z2 A', 'Zen 2, 4 cores / 8 threads', 'RDNA 2, 8 compute units',
    '16 GB LPDDR5X, 6400 MT/s', XALLY_DISPLAY, 60, 120, '', 'ASUS'),
  m('xallyx-1tb', 'xallyx', 'Xbox Ally X 1 TB', '1 TB PCIe 4.0 SSD (M.2 2280)', 'Fast loads, and the full-size 2280 slot makes upgrades easy.',
    XALLY_GLASS, 80, 'AMD Ryzen AI Z2 Extreme, 4 nm', 'Zen 5, 8 cores / 16 threads (3 Zen 5 + 5 Zen 5c), up to 5.0 GHz', 'RDNA 3.5, 16 compute units, up to 2.9 GHz',
    '24 GB LPDDR5X, 8000 MT/s', XALLY_DISPLAY, 60, 120, '', 'ASUS'),
];

const DEFAULTS: Record<DeviceId, string> = {
  lcd: 'lcd-256', oled: 'oled-512', ally: 'ally-z1e', allyz1: 'ally-z1', allyx: 'allyx-1tb', xally: 'xally-512', xallyx: 'xallyx-1tb',
};

// The chosen model when it belongs to the chosen generation, else that generation's default.
export function resolveModel(modelId: string, generation: DeviceId): DeckModel {
  return MODELS.find((x) => x.id === modelId && x.generation === generation) ?? MODELS.find((x) => x.id === DEFAULTS[generation])!;
}

export const familyOf = (model: DeckModel) => getHandheld(model.generation).family;
export const usableWh = (model: DeckModel, healthPct: number) => (model.batteryWh * Math.min(100, Math.max(1, healthPct))) / 100;
export const hours = (wh: number, watts: number) => (watts <= 0 ? 0 : wh / watts);

export function formatHours(h: number): string {
  let whole = Math.floor(h);
  let min = Math.round((h - whole) * 60);
  if (min === 60) {
    whole++;
    min = 0;
  }
  return whole === 0 ? `${min} min` : min === 0 ? `${whole} h` : `${whole} h ${String(min).padStart(2, '0')} min`;
}

// Profiles quote battery life for a new battery ("2.5-3 h"); scale every number by the battery's
// health so a worn battery gets an honest figure.
export function scaleBatteryLife(text: string, healthPct: number): string {
  if (healthPct >= 100 || !text) return text;
  return text.replace(/\d+(?:\.\d+)?/g, (n) => {
    const v = (parseFloat(n) * healthPct) / 100;
    return String(Math.round(v * 10) / 10);
  });
}
