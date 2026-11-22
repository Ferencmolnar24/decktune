// Player reports from both places they live: posted on DeckTune itself (a free Supabase database,
// live the moment they're posted) and older ones filed as GitHub issues (built into reports.json).
import { useSyncExternalStore } from 'react';
import { loadGithubReports, type Rating, type Report } from './data';
import type { DeviceId } from './handhelds';
import type { ReportSettings } from './settings';
import { useLoad } from './state';

// The project's address and its public ("anon" / publishable) key: safe in a web page, since the
// database itself only lets visitors read, post and vote (see supabase/setup.sql).
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? '';
export const SITE_POSTING = !!(SUPABASE_URL && SUPABASE_KEY);

const COLUMNS = 'id,created_at,app_id,game,device,os,rating,fps,battery,preset,settings,notes,name,helpful';

interface Row {
  id: number; created_at: string; app_id: number; game: string; device: DeviceId; os: string; rating: Rating;
  fps: number; battery: number | null; preset: string | null; settings: ReportSettings; notes: string; name: string; helpful: number;
}

const fromRow = (r: Row): Report => ({
  key: `s${r.id}`,
  id: r.id,
  source: 'site',
  appId: r.app_id,
  game: r.game,
  device: r.device,
  os: r.os,
  rating: r.rating,
  fps: r.fps,
  fpsText: r.fps === 25 ? 'Under 30' : String(r.fps),
  battery: r.battery,
  preset: r.preset ?? undefined,
  settings: '',
  setup: r.settings ?? {},
  notes: r.notes,
  user: r.name,
  avatar: '',
  guest: true,
  created: r.created_at,
  helpful: r.helpful,
});

const headers = (extra: Record<string, string> = {}) => ({ apikey: SUPABASE_KEY, ...extra });

async function loadSiteReports(): Promise<Report[]> {
  if (!SITE_POSTING) return [];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/reports?select=${COLUMNS}&order=created_at.desc&limit=1000`, { headers: headers() });
  if (!res.ok) throw new Error(`reports ${res.status}`);
  return ((await res.json()) as Row[]).map(fromRow);
}

let current: Promise<Report[]> | null = null;
let version = 0;
const listeners = new Set<() => void>();

// Every report, newest first. Either source failing still shows the other; both failing is an error.
export function loadReports(): Promise<Report[]> {
  current ??= Promise.allSettled([loadSiteReports(), loadGithubReports()]).then(([site, github]) => {
    if (site.status === 'rejected' && github.status === 'rejected') throw site.reason;
    const all = [...(site.status === 'fulfilled' ? site.value : []), ...(github.status === 'fulfilled' ? github.value : [])];
    return all.sort((a, b) => b.created.localeCompare(a.created));
  });
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
  return useLoad(loadReports, [v]);
}

export class PostError extends Error {}

export interface NewReport {
  appId: number; game: string; device: DeviceId; os: string; rating: Rating; fps: number; battery: number | null;
  preset: string; settings: ReportSettings; notes: string; name: string;
}

// The database's own sentences (rate limits) are meant for people; constraint errors are not.
function friendly(message: unknown): string {
  const text = typeof message === 'string' ? message : '';
  if (!text || /violates|constraint|permission|syntax|column|relation/i.test(text)) return "DeckTune couldn't save this report. Check the answers and try again.";
  return text;
}

export async function postSiteReport(r: NewReport): Promise<number> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/reports?select=id`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify({
        app_id: r.appId, game: r.game, device: r.device, os: r.os, rating: r.rating, fps: r.fps, battery: r.battery,
        preset: r.preset || null, settings: r.settings, notes: r.notes, name: r.name || 'Guest',
      }),
    });
  } catch {
    throw new PostError("Couldn't reach DeckTune's report database. Check your connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new PostError(friendly(data?.message));
  return Array.isArray(data) ? data[0]?.id ?? 0 : 0;
}

// One "helpful" per visitor per report, counted by the database. Returns the new total.
export async function voteHelpful(id: number): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/vote_helpful`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ report_id: id }),
  });
  if (!res.ok) throw new PostError(friendly((await res.json().catch(() => null))?.message));
  return (await res.json()) as number;
}
