// Profile data as stored (exported from the old app, PascalCase as it was saved) and the
// device-neutral view the game page renders. Steam Deck presets map field for field; ROG Ally
// presets are converted from the game's Deck profile here, in code.
import { ALLY_BASES, getHandheld, type AllyChip, type DeviceId } from './handhelds';
import { fpsStepsFor, formatFps, nearestStep } from './fps';
import { deckDrawWatts } from './battery';

export interface GameSetting { Name: string; Value: string }

export interface DeckProfile {
  FrameLimit: number;
  RefreshRateHz: number;
  TdpLimitWatts: number;
  GpuClockMhz: number;
  Scaling: string;
  HalfRateShading: boolean;
  Resolution: string;
  InGameSettings: GameSetting[];
  LaunchOptions: string;
  ProtonVersion: string;
  ExpectedFps: string;
  ExpectedBatteryLife: string;
  Notes: string;
}

export interface DeckProfileSet {
  Summary: string;
  KnownIssues: string[];
  MaxBattery: DeckProfile;
  Optimal: DeckProfile;
  MaxPerformance: DeckProfile;
  Basis?: string;
  Confidence?: string;
  BasisNote?: string;
}

export interface StoredDevice { generated: string; sources: number; profiles: DeckProfileSet }
export interface GameProfiles { appId: number; name: string; devices: Partial<Record<DeviceId, StoredDevice>> }

export type ProfileKind = 'MaxBattery' | 'Optimal' | 'MaxPerformance';
export const PROFILE_KINDS: ProfileKind[] = ['MaxBattery', 'Optimal', 'MaxPerformance'];

export interface SystemSetting { icon: string; label: string; value: string }

export interface ProfileView {
  notes: string;
  systemTitle: string;
  system: SystemSetting[];
  resolution: string;
  inGameSettings: GameSetting[];
  launchOptions: string;
  compatTitle: string;
  compat: string;
  expectedFps: string;
  // What the whole handheld draws on this preset, for the battery estimate (lib/battery.ts).
  drawWatts: number;
  // The power setting in a few words, for comparisons: "12 W TDP", "Performance mode".
  power: string;
}

export interface ProfileViewSet {
  summary: string;
  knownIssues: string[];
  MaxBattery: ProfileView;
  Optimal: ProfileView;
  MaxPerformance: ProfileView;
  basis: string;
  confidence: string;
  basisNote: string;
  sourceDevice: DeviceId;
  generated: string;
  sources: number;
}

// Deck Verified: 0 unknown, 1 unsupported, 2 playable, 3 verified.
export type DeckVerified = 0 | 1 | 2 | 3;

// ───────────────────────── Steam Deck ─────────────────────────

function fromDeckProfile(p: DeckProfile, device: DeviceId): ProfileView {
  return {
    notes: p.Notes,
    systemTitle: 'Quick Access › Performance',
    system: [
      { icon: 'monitor', label: 'Refresh rate', value: `${p.RefreshRateHz} Hz` },
      { icon: 'timer', label: 'Frame limit', value: p.FrameLimit > 0 ? `${p.FrameLimit} fps` : 'Off' },
      { icon: 'cpu', label: 'TDP limit', value: p.TdpLimitWatts > 0 ? `${p.TdpLimitWatts} W` : 'No limit' },
      { icon: 'microchip', label: 'GPU clock', value: p.GpuClockMhz > 0 ? `${p.GpuClockMhz} MHz` : 'Auto' },
      { icon: 'scaling', label: 'Scaling filter', value: p.Scaling },
      { icon: 'grid-2x2', label: 'Half-rate shading', value: p.HalfRateShading ? 'On' : 'Off' },
    ],
    resolution: p.Resolution,
    inGameSettings: p.InGameSettings ?? [],
    launchOptions: p.LaunchOptions,
    compatTitle: 'Compatibility layer',
    compat: p.ProtonVersion,
    expectedFps: formatFps(p.ExpectedFps, p.FrameLimit, device),
    drawWatts: deckDrawWatts(p, device),
    power: p.TdpLimitWatts > 0 ? `${p.TdpLimitWatts} W TDP` : 'No TDP limit',
  };
}

export function viewForDevice(game: GameProfiles, device: DeviceId, verified: DeckVerified): ProfileViewSet | null {
  const handheld = getHandheld(device);
  if (handheld.family === 'deck') {
    const own = game.devices[device];
    if (!own) return null;
    const s = own.profiles;
    return {
      summary: s.Summary,
      knownIssues: s.KnownIssues ?? [],
      MaxBattery: fromDeckProfile(s.MaxBattery, device),
      Optimal: fromDeckProfile(s.Optimal, device),
      MaxPerformance: fromDeckProfile(s.MaxPerformance, device),
      basis: s.Basis ?? '',
      confidence: s.Confidence ?? '',
      basisNote: s.BasisNote ?? '',
      sourceDevice: device,
      generated: own.generated,
      sources: own.sources,
    };
  }
  const base = ALLY_BASES.find((b) => game.devices[b]);
  return base ? forAlly(game.devices[base]!, base, device, verified) : null;
}

// Whether a game has settings for this device (its own Deck profile, or one to convert from).
export function hasSettingsFor(devices: string[], device: DeviceId): boolean {
  return getHandheld(device).family === 'ally' ? ALLY_BASES.some((b) => devices.includes(b)) : devices.includes(device);
}

// ───────────────────────── ROG Ally ─────────────────────────

type Weight = 'Light' | 'Medium' | 'Heavy';
enum Mode { Silent = 0, Performance = 1, Turbo = 2 }
const MODE_NAMES = ['Silent', 'Performance', 'Turbo'];

interface Render { label: string; upscaler: string; megapixels: number }
interface Plan { mode: Mode; cap: number; render: Render; settings: DeckProfile }

const NATIVE: Render = { label: '1920×1080 (native)', upscaler: 'Off', megapixels: 2.07 };

function modeLabel(chip: AllyChip, mode: Mode): string {
  if (!chip.showWatts) return `${MODE_NAMES[mode]} mode`;
  return mode === Mode.Turbo ? `Turbo · ${chip.watts[2]} W (${chip.turboNote})` : `${MODE_NAMES[mode]} · ${chip.watts[mode]} W`;
}

function forAlly(deck: StoredDevice, baseDevice: DeviceId, device: DeviceId, verified: DeckVerified): ProfileViewSet {
  const handheld = getHandheld(device);
  const chip = handheld.chip ?? getHandheld('ally').chip!;
  const set = deck.profiles;
  const weight = weightOf(set);
  const upscaler = upscalerIn(set);

  const up = (quality: string, mp: number): Render => upscaler
    ? { label: `1920×1080 with ${upscaler} ${quality}`, upscaler: `In-game ${upscaler} ${quality}`, megapixels: mp }
    : { label: mp >= 1.4 ? '1600×900 + RSR' : '1280×720 + RSR', upscaler: 'RSR (Radeon Super Resolution)', megapixels: mp >= 1.4 ? 1.44 : 0.92 };
  const P = (mode: Mode, cap: number, render: Render, settings: DeckProfile): Plan => ({ mode, cap, render, settings });
  const { MaxBattery: b, Optimal: o, MaxPerformance: x } = set;

  // A Deck-class chip plays each preset like the Deck does. A Z1 Extreme takes the Deck's settings
  // one notch up (its battery preset plays like the Deck's balanced one), and a Z2 Extreme aims
  // higher still. Caps the chip can't hold are stepped down per preset.
  let plans: Plan[];
  if (chip.cls === 0) {
    plans = weight === 'Light'
      ? [P(Mode.Silent, 60, NATIVE, b), P(Mode.Silent, 60, NATIVE, o), P(Mode.Performance, 0, NATIVE, x)]
      : weight === 'Medium'
        ? [P(Mode.Silent, 30, up('Performance', 0.52), b), P(Mode.Performance, 40, up('Balanced', 0.72), o), P(Mode.Turbo, 60, up('Quality', 0.92), x)]
        : [P(Mode.Performance, 30, up('Performance', 0.52), b), P(Mode.Performance, 40, up('Performance', 0.52), o), P(Mode.Turbo, 40, up('Balanced', 0.72), x)];
  } else if (chip.cls === 1) {
    plans = weight === 'Light'
      ? [P(Mode.Silent, 60, NATIVE, o), P(Mode.Silent, 60, NATIVE, x), P(Mode.Performance, 0, NATIVE, x)]
      : weight === 'Medium'
        ? [P(Mode.Silent, 40, up('Balanced', 0.72), o), P(Mode.Performance, 60, up('Quality', 0.92), x), P(Mode.Turbo, 0, up('Quality', 0.92), x)]
        : [P(Mode.Performance, 30, up('Performance', 0.52), o), P(Mode.Performance, 40, up('Balanced', 0.72), x), P(Mode.Turbo, 60, up('Balanced', 0.72), x)];
  } else {
    plans = weight === 'Light'
      ? [P(Mode.Silent, 60, NATIVE, x), P(Mode.Silent, 0, NATIVE, x), P(Mode.Performance, 0, NATIVE, x)]
      : weight === 'Medium'
        ? [P(Mode.Silent, 40, up('Quality', 0.92), o), P(Mode.Performance, 60, NATIVE, x), P(Mode.Turbo, 0, NATIVE, x)]
        : [P(Mode.Performance, 40, up('Balanced', 0.72), o), P(Mode.Performance, 60, up('Quality', 0.92), x), P(Mode.Turbo, 60, up('Quality', 0.92), x)];
  }

  const name = handheld.name;
  let summary = chip.cls === 0
    ? `On the ${name} this game runs natively on Windows, no Proton needed. The ${chip.name} has about Steam Deck-class graphics, so the presets mirror DeckTune's Deck settings, adapted to the 1080p screen, VRR and Armoury Crate power modes.`
    : `On the ${name} this game runs natively on Windows, no Proton needed. Each preset takes DeckTune's Steam Deck settings a step up for the ${chip.name} and adds the 1080p screen, VRR and Armoury Crate power modes.`;
  if (verified === 1) {
    summary += " Valve lists it as unsupported on Steam Deck, often because of anti-cheat, which usually works on Windows handhelds; check the publisher's notes.";
  }

  // Issues about Proton, SteamOS or the Deck itself don't apply on Windows.
  const issues = (set.KnownIssues ?? []).filter((i) => !DECK_ONLY_ISSUE.test(i));
  // A conversion is never more certain than the Deck profile it came from, and never "high".
  const confidence = !set.Confidence || set.Confidence === 'high' ? 'medium' : set.Confidence;

  return {
    summary,
    knownIssues: issues,
    MaxBattery: toView(plans[0], 'MaxBattery', weight, chip, set),
    Optimal: toView(plans[1], 'Optimal', weight, chip, set),
    MaxPerformance: toView(plans[2], 'MaxPerformance', weight, chip, set),
    basis: 'converted',
    confidence,
    basisNote: `Converted from DeckTune's ${getHandheld(baseDevice).name} profile for the ${chip.name}'s power, not tested on this device yet. Check the frame rate in the game's busiest area on your first run, and drop one preset if it dips.`,
    sourceDevice: baseDevice,
    generated: deck.generated,
    sources: deck.sources,
  };
}

function toView(plan: Plan, kind: ProfileKind, weight: Weight, chip: AllyChip, set: DeckProfileSet): ProfileView {
  // A capped Deck preset only says what it was capped to, so the Deck's potential comes from its Max
  // Performance preset. Lighter settings buy a little more. Frame rate scales a little less than
  // linearly with pixel count, and however strong the GPU, the CPU stops it at about twice the Deck.
  let potential = midFps(set.MaxPerformance.ExpectedFps, set.MaxPerformance.FrameLimit);
  if (set.MaxPerformance.FrameLimit > 0 && potential >= set.MaxPerformance.FrameLimit * 0.95) potential *= 1.15;
  if (weight === 'Light') potential = Math.max(potential, 90);
  const lighter = plan.settings === set.MaxBattery ? 1.2 : plan.settings === set.Optimal ? 1.1 : 1.0;
  const deckMp = megapixels(set.MaxPerformance.Resolution);
  const estimateFor = (mode: Mode) => Math.min(potential * 2.2, weight === 'Light'
    ? potential * lighter * Math.max(1, chip.speed[mode])
    : potential * lighter * chip.speed[mode] * Math.pow(deckMp / plan.render.megapixels, 0.7));

  // The battery preset uses the lowest power mode that still holds its cap with some margin.
  if (kind === 'MaxBattery' && plan.cap > 0) {
    for (const mode of [Mode.Silent, Mode.Performance]) {
      if (mode < plan.mode && estimateFor(mode) >= plan.cap * 1.1) {
        plan = { ...plan, mode };
        break;
      }
    }
  }

  const estimate = estimateFor(plan.mode);

  // Never ask for a cap the estimate says the chip can't hold: step down to one it can.
  let cap = plan.cap;
  if (cap > 0) {
    for (const step of [60, 40, 30]) {
      if (step <= plan.cap && (estimate >= step * 0.95 || step === 30)) {
        cap = step;
        break;
      }
    }
  }

  const refresh = cap === 30 || (cap === 60 && kind === 'MaxBattery') ? '60 Hz' : '120 Hz · VRR on';
  // "Locked" only with a real margin; otherwise an honest range up to the cap. Both ends are rates
  // the 120 Hz screen paces evenly, never a measured-looking "34-40".
  const steps = fpsStepsFor('ally');
  const range = (lo: number | null, hi: number | null) =>
    lo === hi ? `${lo ?? 'Under 30'} fps` : lo == null ? `Up to ${hi} fps` : `${lo}–${hi} fps`;
  const fps = cap > 0
    ? estimate >= cap * 1.15 ? `${cap} fps locked` : range(nearestStep(Math.min(cap, estimate * 0.85), steps), cap)
    : range(nearestStep(Math.min(110, estimate * 0.85), steps), nearestStep(Math.min(120, estimate * 1.05), steps));

  // A capped game draws less than its mode allows; the screen and the rest always draw their share.
  const load = cap > 0 ? Math.min(1, Math.max(0.45, cap / estimate)) : 1;
  const draw = chip.watts[plan.mode] * (0.4 + 0.6 * load) + 5.5;

  const vram = weight === 'Heavy' || (kind === 'MaxPerformance' && weight === 'Medium') ? chip.vram : 'Auto';

  const system: SystemSetting[] = [
    { icon: 'gauge', label: 'Operating mode', value: modeLabel(chip, plan.mode) },
    { icon: 'timer', label: 'Frame cap', value: cap > 0 ? `${cap} fps` : 'Off (VRR)' },
    { icon: 'monitor', label: 'Refresh rate', value: refresh },
    { icon: 'scaling', label: 'Upscaling', value: plan.render.upscaler },
    { icon: 'memory-stick', label: 'GPU memory', value: vram },
    { icon: 'sparkles', label: 'AMD Fluid Motion Frames', value: 'Off' },
  ];

  // The Deck's own list, with its upscaler line set to what this preset uses.
  const settings = (plan.settings.InGameSettings ?? [])
    .filter((s) => s.Name.toLowerCase() !== 'resolution')
    .map((s) => UPSCALER_SETTING.test(s.Name)
      ? { ...s, Value: plan.render.upscaler.startsWith('In-game') ? plan.render.upscaler.slice('In-game '.length) : 'Off' }
      : s);

  return {
    notes: notesFor(plan, cap, kind, weight, refresh, chip),
    systemTitle: 'Armoury Crate SE',
    system,
    resolution: plan.render.label,
    inGameSettings: settings,
    launchOptions: windowsLaunchOptions(plan.settings.LaunchOptions),
    compatTitle: 'Runs on',
    compat: 'Windows 11, natively. No Proton or launch tweaks for Linux needed.',
    expectedFps: fps,
    drawWatts: draw,
    power: chip.showWatts ? `${MODE_NAMES[plan.mode]} · ${chip.watts[plan.mode]} W` : `${MODE_NAMES[plan.mode]} mode`,
  };
}

function notesFor(plan: Plan, cap: number, kind: ProfileKind, weight: Weight, refresh: string, chip: AllyChip): string {
  const pacing = cap === 30 ? '30 fps at 60 Hz paces evenly and stretches the battery furthest'
    : cap === 40 ? '40 fps divides evenly into 120 Hz, so it feels smoother than the number suggests'
      : cap === 60 ? (refresh.startsWith('60') ? '60 fps at 60 Hz saves the power 120 Hz would cost' : '60 fps on the 120 Hz screen, with VRR smoothing any dips')
        : 'uncapped with VRR, so every frame the chip makes reaches the screen without tearing';
  const mode = MODE_NAMES[plan.mode];
  const lead = kind === 'MaxBattery'
    ? weight === 'Light' ? `This game barely loads the ${chip.name}, so Silent mode is plenty` : `${mode} mode keeps the fan quiet and the draw low`
    : kind === 'Optimal' ? `${mode} mode, balancing looks against battery`
      : plan.mode === Mode.Turbo ? 'Turbo mode is the most the chip gives; plug in for its full power'
        : `${mode} mode with the best settings the chip holds smoothly`;
  return `${lead}: ${pacing}.`;
}

function weightOf(set: DeckProfileSet): Weight {
  const optimal = set.Optimal;
  const upscaled = /FSR/i.test(optimal.Resolution) || megapixels(optimal.Resolution) < 0.9;
  const maxFps = midFps(set.MaxPerformance.ExpectedFps, set.MaxPerformance.FrameLimit);
  if (upscaled || (optimal.FrameLimit > 0 && optimal.FrameLimit <= 35) || maxFps <= 40) return 'Heavy';
  return optimal.FrameLimit === 0 || optimal.FrameLimit >= 60 ? 'Light' : 'Medium';
}

// The game's own upscaler, when the Deck profile names one among its in-game options.
function upscalerIn(set: DeckProfileSet): string | null {
  const names = [...(set.Optimal.InGameSettings ?? []), ...(set.MaxPerformance.InGameSettings ?? [])].map((s) => `${s.Name} ${s.Value}`.toLowerCase());
  for (const candidate of ['FSR', 'XeSS']) {
    if (names.some((n) => n.includes(candidate.toLowerCase()))) return candidate;
  }
  return null;
}

// "40-45 fps" → 42.5; falls back to the cap, then to 30, when the text has no numbers.
export function midFps(text: string, cap: number): number {
  const numbers = (text ?? '').match(/\d+(?:\.\d+)?/g)?.map(Number).filter((n) => n >= 10 && n <= 240).slice(0, 2) ?? [];
  return numbers.length === 0 ? (cap > 0 ? cap : 30) : numbers.length === 1 ? numbers[0] : (numbers[0] + numbers[1]) / 2;
}

// "960x600 + FSR" → 0.576; the Deck's native 1280×800 when no resolution is named.
function megapixels(text: string): number {
  const r = (text ?? '').match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/);
  return r ? (parseInt(r[1], 10) * parseInt(r[2], 10)) / 1_000_000 : 1.024;
}

// Deck launch options are mostly Proton and Linux environment variables. On Windows only the
// game's own arguments (after %command%, or a bare "-dx11"-style string) still mean anything.
function windowsLaunchOptions(options: string): string {
  if (!options?.trim()) return '';
  const index = options.toLowerCase().indexOf('%command%');
  const args = index >= 0 ? options.slice(index + '%command%'.length) : options;
  const words = args.split(' ').filter(Boolean);
  const kept = words.filter((a) => (a.startsWith('-') || a.startsWith('+')) && !a.includes('='));
  return index < 0 && kept.length !== words.length ? '' : kept.join(' ');
}

const UPSCALER_SETTING = /FSR|XeSS|DLSS|upscal|super resolution/i;
const DECK_ONLY_ISSUE = /Proton|SteamOS|Linux|Steam Deck|\bDeck\b|Wine|DXVK|VKD3D|gamescope|Flatpak|Desktop Mode/i;
