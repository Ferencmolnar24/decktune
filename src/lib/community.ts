// Community reports live as GitHub issues in this site's repository (filed through the
// "Performance report" issue form), so posting needs only a free GitHub account and costs nothing.
import { getHandheld, type DeviceId } from './handhelds';
import type { Rating, Report } from './data';

// Set by the GitHub Actions build (owner/repo); a local build without it shows the posting button
// disabled with the reason.
export const REPO: string = import.meta.env.VITE_GITHUB_REPO ?? '';

// Opens GitHub's report form with the game filled in. GitHub asks the visitor to sign in first.
export function newReportUrl(game: { appId: number; name: string }, device: DeviceId): string {
  const params = new URLSearchParams({
    template: 'performance-report.yml',
    title: `[Report] ${game.name} on ${getHandheld(device).name}`,
    game: game.name,
    appid: String(game.appId),
  });
  return `https://github.com/${REPO}/issues/new?${params}`;
}

export const reportUrl = (id: number) => `https://github.com/${REPO}/issues/${id}`;
export const allReportsUrl = () => `https://github.com/${REPO}/issues?q=is%3Aissue+is%3Aopen+label%3Aperformance-report`;

export const RATINGS: { id: Rating; label: string; tone: string; bar: string }[] = [
  { id: 'great', label: 'Great', tone: 'text-emerald-300 border-emerald-400/40 bg-emerald-400/10', bar: 'bg-emerald-400' },
  { id: 'good', label: 'Good', tone: 'text-sky-300 border-sky-400/40 bg-sky-400/10', bar: 'bg-sky-400' },
  { id: 'playable', label: 'Playable', tone: 'text-amber-200 border-amber-400/40 bg-amber-400/10', bar: 'bg-amber-400' },
  { id: 'rough', label: 'Rough', tone: 'text-orange-300 border-orange-400/40 bg-orange-400/10', bar: 'bg-orange-400' },
  { id: 'unplayable', label: 'Unplayable', tone: 'text-rose-300 border-rose-500/40 bg-rose-500/10', bar: 'bg-rose-500' },
];

export const ratingInfo = (r: Rating) => RATINGS.find((x) => x.id === r) ?? RATINGS[2];

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
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
    fps: median(reports.map((r) => r.fps)),
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
