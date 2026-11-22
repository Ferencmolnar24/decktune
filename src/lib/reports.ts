// Player reports, posted on DeckTune itself into a free Supabase database and live the moment
// they're posted. Also the small "did this preset work?" tallies, which live in the same database.
import { useSyncExternalStore } from 'react';
import type { Rating, Report } from './data';
import type { DeviceId } from './handhelds';
import type { ProfileKind } from './profiles';
import type { ReportSettings } from './settings';
import { useLoad, useStored } from './state';

// The project's address and its public ("anon" / publishable) key: safe in a web page, since the
// database itself only lets visitors do what supabase/setup.sql allows.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? '';
export const SITE_POSTING = !!(SUPABASE_URL && SUPABASE_KEY);

const BASE_COLUMNS = 'id,created_at,app_id,game,device,os,rating,fps,battery,preset,settings,notes,name,helpful';

interface Row {
  id: number; created_at: string; edited_at?: string | null; app_id: number; game: string; device: DeviceId; os: string;
  rating: Rating; fps: number; battery: number | null; preset: string | null; settings: ReportSettings; notes: string;
  name: string; helpful: number;
}

const fromRow = (r: Row): Report => ({
  id: r.id,
  appId: r.app_id,
  game: r.game,
  device: r.device,
  os: r.os,
  rating: r.rating,
  fps: r.fps,
  fpsText: r.fps === 25 ? 'Under 30' : String(r.fps),
  battery: r.battery,
  preset: r.preset ?? undefined,
  setup: r.settings ?? {},
  notes: r.notes,
  user: r.name,
  created: r.created_at,
  edited: r.edited_at ?? undefined,
  helpful: r.helpful,
});

const api = (path: string, init: RequestInit = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...init,
  headers: { apikey: SUPABASE_KEY, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers as Record<string, string>) },
});

async function loadSiteReports(): Promise<Report[]> {
  if (!SITE_POSTING) return [];
  const query = (cols: string) => api(`reports?select=${cols}&order=created_at.desc&limit=1000`);
  let res = await query(`${BASE_COLUMNS},edited_at`);
  // A database set up before edits existed has no edited_at yet.
  if (res.status === 400) res = await query(BASE_COLUMNS);
  if (!res.ok) throw new Error(`reports ${res.status}`);
  return ((await res.json()) as Row[]).map(fromRow);
}

let current: Promise<Report[]> | null = null;
// The last list that loaded: shown while a refresh is on its way, so nothing blinks out.
let latest: Report[] | undefined;
let version = 0;
const listeners = new Set<() => void>();

// Every report, newest first.
export function loadReports(): Promise<Report[]> {
  current ??= loadSiteReports().then((r) => (latest = r));
  current.catch(() => {
    current = null; // a retry fetches again
  });
  return current;
}

// Fetches the reports again, for every component showing them (after posting, for example).
export function refreshReports() {
  current = null;
  version++;
  listeners.forEach((l) => l());
}

export function useReports(): [Report[] | undefined, boolean, () => void] {
  const v = useSyncExternalStore((cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, () => version);
  const [value, failed, retry] = useLoad(loadReports, [v]);
  return [value ?? (failed ? undefined : latest), failed, retry];
}

// ───────────────────────── Posting, editing, deleting ─────────────────────────

export class PostError extends Error {}

export interface NewReport {
  appId: number; game: string; device: DeviceId; os: string; rating: Rating; fps: number; battery: number | null;
  preset: string; settings: ReportSettings; notes: string; name: string;
}

// The database's own sentences (rate limits, "only from the browser that posted it") are meant for
// people; constraint and type errors are not.
function friendly(message: unknown): string {
  const text = typeof message === 'string' ? message : '';
  if (!text || /violates|constraint|permission|syntax|column|relation|function|schema|invalid input/i.test(text)) {
    return "DeckTune couldn't save this. Check the answers and try again.";
  }
  return text;
}

async function call<T>(path: string, body: unknown, extra: Record<string, string> = {}): Promise<T> {
  let res: Response;
  try {
    res = await api(path, { method: 'POST', body: JSON.stringify(body), headers: extra });
  } catch {
    throw new PostError("Couldn't reach DeckTune's report database. Check your connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new PostError(friendly(data?.message));
  return data as T;
}

// Reports this browser posted, by id, with the key that lets it edit or delete them. Only the
// key's hash is stored in the database, so nobody else can change them.
export const useMyReports = () => useStored<Record<string, string>>('my-reports', {});

function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const columns = (r: NewReport) => ({
  device: r.device, os: r.os, rating: r.rating, fps: r.fps, battery: r.battery,
  preset: r.preset || null, settings: r.settings, notes: r.notes, name: r.name || 'Guest',
});

// Posts a report; returns its id and the key this browser keeps for it.
export async function postSiteReport(r: NewReport): Promise<{ id: number; key: string }> {
  const key = newKey();
  const row = { app_id: r.appId, game: r.game, ...columns(r) };
  const prefer = { Prefer: 'return=representation' };
  let data: { id: number }[];
  try {
    data = await call<{ id: number }[]>('reports?select=id', { ...row, edit_key_hash: await sha256(key) }, prefer);
  } catch (e) {
    // A database set up before edits existed doesn't take a key yet: post without one.
    if (!(e instanceof PostError) || !/couldn't save/i.test(e.message)) throw e;
    data = await call<{ id: number }[]>('reports?select=id', row, prefer);
    return { id: data[0]?.id ?? 0, key: '' };
  }
  return { id: data[0]?.id ?? 0, key };
}

export const editSiteReport = (id: number, key: string, r: NewReport) =>
  call<null>('rpc/edit_report', { report_id: id, edit_key: key, changes: columns(r) });

export const deleteSiteReport = (id: number, key: string) =>
  call<null>('rpc/delete_report', { report_id: id, edit_key: key });

// One "helpful" per visitor per report, counted by the database. Returns the new total.
export const voteHelpful = (id: number) => call<number>('rpc/vote_helpful', { report_id: id });

// A visitor's flag. Three from different visitors hide the report; returns whether it's hidden now.
export const flagReport = (id: number) => call<boolean>('rpc/flag_report', { report_id: id });

// ───────────────────────── Preset feedback ─────────────────────────

export interface PresetTally { up: number; down: number }
export type PresetFeedback = Map<string, PresetTally>;
export const tallyKey = (device: DeviceId, kind: ProfileKind) => `${device}:${kind}`;

interface TallyRow { device: DeviceId; preset: ProfileKind; up: number; down: number }
const toFeedback = (rows: TallyRow[]): PresetFeedback => new Map(rows.map((r) => [tallyKey(r.device, r.preset), { up: r.up, down: r.down }]));

export async function loadPresetFeedback(appId: number): Promise<PresetFeedback> {
  if (!SITE_POSTING) return new Map();
  return toFeedback(await call<TallyRow[]>('rpc/preset_feedback', { p_app_id: appId }));
}

// Records this visitor's answer (null takes it back) and returns the game's new tallies.
export async function votePreset(appId: number, device: DeviceId, kind: ProfileKind, worked: boolean | null): Promise<PresetFeedback> {
  return toFeedback(await call<TallyRow[]>('rpc/vote_preset', { p_app_id: appId, p_device: device, p_preset: kind, p_worked: worked }));
}
