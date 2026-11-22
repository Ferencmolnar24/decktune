// Posting a report: the form's answers (a draft), what's still missing, and the two ways to post.
// With the report database set up (lib/reports.ts) visitors post right on DeckTune; until then the
// form opens a filled-in GitHub issue instead.
import { getHandheld, type DeviceId } from './handhelds';
import type { Rating, Report } from './data';
import { cleanSettings, hasSettings, settingsText, type ReportSettings } from './settings';
import type { NewReport } from './reports';

// Set by the GitHub Actions build (owner/repo).
export const REPO: string = import.meta.env.VITE_GITHUB_REPO ?? '';

export const OS_OPTIONS = ['SteamOS', 'Windows', 'Bazzite or another Linux'] as const;
export const PRESET_OPTIONS = ['Max Battery', 'Optimal', 'Max Performance', 'My own settings'] as const;
export const BATTERY_OPTIONS = ['1', '1.5', '2', '2.5', '3', '4', '5', '6+'] as const;
// Frame rates as the issue form lists them; "Under 30" is stored as 25.
export const FPS_OPTIONS = ['Under 30', '30', '40', '45', '60', '90', '120'] as const;

// The rating options exactly as the issue form words them (the build reads the first word).
const RATING_LINES: Record<Rating, string> = {
  great: 'Great - smooth, no real compromises',
  good: 'Good - smooth with a few tweaks',
  playable: 'Playable - noticeable compromises',
  rough: 'Rough - barely playable',
  unplayable: 'Unplayable',
};

export interface ReportDraft {
  appId: number;
  game: string;
  device: DeviceId;
  os: string;
  rating: Rating | '';
  fps: string;
  battery: string;
  preset: string;
  setup: ReportSettings;
  notes: string;
  name: string;
}

// What's still missing before a draft can be posted, in the order the form asks.
export function missing(d: ReportDraft): string[] {
  const out: string[] = [];
  if (!d.appId) out.push('the game');
  if (!d.rating) out.push('how it runs');
  if (!d.fps) out.push('the frame rate');
  if ((!d.preset || d.preset === 'My own settings') && !hasSettings(d.setup)) out.push('your settings');
  return out;
}

// User text can't start new "### " sections (which the build reads as fields) or @-mention people.
const clean = (s: string) => s.replace(/\r\n/g, '\n').replace(/^#{1,6}\s/gm, '').replace(/@(?=\w)/g, '@\u200b').trim();

export const reportTitle = (d: ReportDraft) => `[Report] ${d.game} on ${getHandheld(d.device).name}`;

// The issue body, in the same "### Label" layout GitHub's issue form produces. Handheld names are
// the form's own options.
export function reportBody(d: ReportDraft): string {
  const section = (label: string, value: string) => `### ${label}\n\n${value || '_No response_'}`;
  return [
    section('Game', clean(d.game)),
    section('Steam app ID', String(d.appId)),
    section('Handheld', getHandheld(d.device).name),
    section('Operating system', d.os),
    section('How well does it run?', d.rating ? RATING_LINES[d.rating] : ''),
    section('Frame rate', d.fps),
    section('Battery life (hours)', d.battery),
    section('DeckTune preset used', d.preset),
    section('Settings you used', clean(settingsText(cleanSettings(d.setup, d.device, d.os)))),
    section('Anything else?', clean(d.notes)),
  ].join('\n\n');
}

// A new GitHub issue with every field already filled in: the visitor signs in and presses Submit.
export function githubReportUrl(d: ReportDraft): string {
  const params = new URLSearchParams({ title: reportTitle(d), body: reportBody(d), labels: 'performance-report' });
  return `https://github.com/${REPO}/issues/new?${params}`;
}

// The draft as the report database stores it.
export function toNewReport(d: ReportDraft): NewReport {
  return {
    appId: d.appId, game: d.game.trim(), device: d.device, os: d.os, rating: d.rating as Rating,
    fps: d.fps === 'Under 30' ? 25 : Number(d.fps),
    battery: d.battery ? parseFloat(d.battery) : null,
    preset: d.preset, settings: cleanSettings(d.setup, d.device, d.os),
    notes: d.notes.trim().slice(0, 1500), name: d.name.trim().replace(/\s+/g, ' ').slice(0, 40),
  };
}

export const reportUrl = (id: number) => `https://github.com/${REPO}/issues/${id}`;
export const allReportsUrl = () => `https://github.com/${REPO}/issues?q=is%3Aissue+is%3Aopen+label%3Aperformance-report`;

export const RATINGS: { id: Rating; label: string; hint: string; tone: string; bar: string }[] = [
  { id: 'great', label: 'Great', hint: 'Smooth, no compromises', tone: 'text-emerald-300 border-emerald-400/40 bg-emerald-400/10', bar: 'bg-emerald-400' },
  { id: 'good', label: 'Good', hint: 'Smooth after a few tweaks', tone: 'text-sky-300 border-sky-400/40 bg-sky-400/10', bar: 'bg-sky-400' },
  { id: 'playable', label: 'Playable', hint: 'Works, with clear compromises', tone: 'text-amber-200 border-amber-400/40 bg-amber-400/10', bar: 'bg-amber-400' },
  { id: 'rough', label: 'Rough', hint: 'Barely playable', tone: 'text-orange-300 border-orange-400/40 bg-orange-400/10', bar: 'bg-orange-400' },
  { id: 'unplayable', label: 'Unplayable', hint: "Crashes or won't run", tone: 'text-rose-300 border-rose-500/40 bg-rose-500/10', bar: 'bg-rose-500' },
];

export const ratingInfo = (r: Rating) => RATINGS.find((x) => x.id === r) ?? RATINGS[2];

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// The middle report's own frame rate (the lower one of a tie), so "typical" is always a real step.
function lowerMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
}

export function summarize(reports: Report[]) {
  const counts = new Map<Rating, number>();
  for (const r of reports) counts.set(r.rating, (counts.get(r.rating) ?? 0) + 1);
  const score = reports.length === 0 ? null
    : reports.reduce((sum, r) => sum + (4 - RATINGS.findIndex((x) => x.id === r.rating)), 0) / reports.length;
  // The most common verdict, ties going to the better one.
  const verdict = RATINGS.reduce<Rating | null>((best, x) => ((counts.get(x.id) ?? 0) > (best ? counts.get(best) ?? 0 : 0) ? x.id : best), null);
  return {
    count: reports.length,
    counts,
    verdict,
    score,
    fps: lowerMedian(reports.map((r) => r.fps)),
    battery: median(reports.flatMap((r) => (r.battery == null ? [] : [r.battery]))),
  };
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
