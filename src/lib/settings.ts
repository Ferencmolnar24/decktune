// The "settings you used" part of a report: short labelled boxes instead of a paragraph, so every
// report reads the same way ("10 W TDP · 40 fps cap · 40 Hz · 960×600 · Medium graphics").
import { getHandheld, type DeviceId } from './handhelds';
import { fpsStepsFor } from './fps';
import type { ProfileView } from './profiles';

export interface ReportSettings {
  mode?: string;
  tdp?: string;
  cap?: string;
  refresh?: string;
  gpu?: string;
  resolution?: string;
  upscaling?: string;
  graphics?: string;
  proton?: string;
  other?: string;
}
export type SettingKey = keyof ReportSettings;

export interface SettingField {
  key: SettingKey;
  label: string;
  unit?: string;
  kind: 'select' | 'number' | 'text';
  options?: string[];
  placeholder?: string;
  wide?: boolean;
}

const DECK_RESOLUTIONS = ['1280×800', '1152×720', '1024×640', '960×600', '800×500', '640×400'];
const ALLY_RESOLUTIONS = ['1920×1080', '1600×900', '1280×720'];
export const GRAPHICS = ['Low', 'Medium', 'High', 'Ultra', 'Custom'];

// The boxes for a handheld and system, in the order people set them.
export function fieldsFor(device: DeviceId, os: string): SettingField[] {
  const deck = getHandheld(device).family === 'deck';
  const windows = os === 'Windows';
  const fields: SettingField[] = [];
  if (!deck && windows) fields.push({ key: 'mode', label: 'Mode', kind: 'select', options: ['Silent', 'Performance', 'Turbo', 'Manual'] });
  fields.push(
    { key: 'tdp', label: 'TDP', unit: 'W', kind: 'number', placeholder: deck ? '10' : '15' },
    { key: 'cap', label: 'FPS cap', kind: 'select', options: ['Off', ...fpsStepsFor(device).map((f) => `${f}`)], unit: 'fps' },
    { key: 'refresh', label: 'Refresh', unit: 'Hz', kind: 'number', placeholder: device === 'lcd' ? '60' : device === 'oled' ? '90' : '120' },
  );
  if (!windows) fields.push({ key: 'gpu', label: 'GPU clock', unit: 'MHz', kind: 'number', placeholder: 'Auto' });
  fields.push(
    { key: 'resolution', label: 'Resolution', kind: 'text', options: deck ? DECK_RESOLUTIONS : ALLY_RESOLUTIONS, placeholder: deck ? '1280×800' : '1920×1080' },
    { key: 'upscaling', label: 'Upscaling', kind: 'select', options: windows ? ['Off', 'Game FSR', 'Game XeSS', 'RSR', 'Other'] : ['Off', 'Game FSR', 'Game XeSS', 'Steam FSR', 'Other'] },
    { key: 'graphics', label: 'Graphics', kind: 'select', options: GRAPHICS },
  );
  if (!windows) fields.push({ key: 'proton', label: 'Proton', kind: 'text', options: ['Default', 'Proton Experimental', 'GE-Proton'], placeholder: 'Default' });
  fields.push({ key: 'other', label: 'Other', kind: 'text', placeholder: 'e.g. shadows Low, motion blur off', wide: true });
  return fields;
}

// Keeps only the boxes this handheld shows, trimmed to sane sizes; empty boxes drop out.
export function cleanSettings(s: ReportSettings, device: DeviceId, os: string): ReportSettings {
  const out: ReportSettings = {};
  for (const f of fieldsFor(device, os)) {
    let v = (s[f.key] ?? '').trim();
    if (f.kind === 'number') v = v.replace(/[^\d]/g, '').slice(0, 4);
    else v = v.replace(/\s+/g, ' ').slice(0, f.key === 'other' ? 200 : 40);
    if (v) out[f.key] = v;
  }
  return out;
}

export const hasSettings = (s: ReportSettings | undefined) => !!s && Object.values(s).some((v) => v && v.trim());

// Short chips for a report card, in reading order. "Other" is shown as its own line.
export function settingsChips(s: ReportSettings): string[] {
  const chips: string[] = [];
  if (s.mode) chips.push(`${s.mode} mode`);
  if (s.tdp) chips.push(`${s.tdp} W TDP`);
  if (s.cap) chips.push(s.cap === 'Off' ? 'No FPS cap' : `${s.cap} fps cap`);
  if (s.refresh) chips.push(`${s.refresh} Hz`);
  if (s.gpu) chips.push(`${s.gpu} MHz GPU`);
  if (s.resolution) chips.push(s.resolution);
  if (s.upscaling) chips.push(s.upscaling === 'Off' ? 'No upscaling' : s.upscaling);
  if (s.graphics) chips.push(`${s.graphics} graphics`);
  if (s.proton) chips.push(/proton/i.test(s.proton) ? s.proton : `Proton ${s.proton}`);
  return chips;
}

export const settingsText = (s: ReportSettings) => [settingsChips(s).join(' · '), s.other ?? ''].filter(Boolean).join('\n');

const num = (text: string | undefined) => text?.match(/\d+/)?.[0] ?? '';

// A DeckTune preset as filled-in boxes, so a player who used it only changes what they did differently.
export function settingsFromPreset(view: ProfileView, device: DeviceId): ReportSettings {
  const deck = getHandheld(device).family === 'deck';
  const sys = new Map(view.system.map((s) => [s.label, s.value]));
  const s: ReportSettings = {};
  const cap = sys.get('Frame limit') ?? sys.get('Frame cap');
  if (cap) s.cap = num(cap) || 'Off';
  s.refresh = num(sys.get('Refresh rate'));
  if (deck) {
    s.tdp = num(sys.get('TDP limit'));
    s.gpu = num(sys.get('GPU clock'));
    s.upscaling = /fsr/i.test(sys.get('Scaling filter') ?? '') ? 'Steam FSR' : 'Off';
    s.proton = view.compat?.split('(')[0].trim().slice(0, 40) ?? '';
  } else {
    const mode = sys.get('Operating mode') ?? '';
    s.mode = ['Silent', 'Performance', 'Turbo'].find((m) => mode.startsWith(m)) ?? '';
    s.tdp = mode.match(/(\d+)\s*W/)?.[1] ?? '';
    const up = sys.get('Upscaling') ?? '';
    s.upscaling = /fsr/i.test(up) ? 'Game FSR' : /xess/i.test(up) ? 'Game XeSS' : /rsr/i.test(up) ? 'RSR' : 'Off';
  }
  const res = view.resolution.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/);
  if (res) s.resolution = `${res[1]}×${res[2]}`;
  const graphics = view.inGameSettings.find((g) => /preset|quality|graphics/i.test(g.Name) && GRAPHICS.some((x) => new RegExp(`^${x}`, 'i').test(g.Value.trim())));
  if (graphics) s.graphics = GRAPHICS.find((x) => new RegExp(`^${x}`, 'i').test(graphics.Value.trim()));
  return Object.fromEntries(Object.entries(s).filter(([, v]) => v)) as ReportSettings;
}
