// Turns the repository's open "Performance report" issues into public/data/reports.json, which the
// site shows on each game's page. Runs in GitHub Actions on every issue change, so a new report is
// live a few minutes after it's filed.
//
// Moderation is GitHub's own: close an issue (or label it "hidden") and the next build drops it;
// lock or block a user from the issue itself.
import { writeFile } from 'node:fs/promises';

const OUT = new URL('../public/data/reports.json', import.meta.url);
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;

const DEVICES = {
  'Steam Deck LCD': 'lcd',
  'Steam Deck OLED': 'oled',
  'ROG Ally (Z1 Extreme)': 'ally',
  'ROG Ally (Z1)': 'allyz1',
  'ROG Ally X': 'allyx',
  'ROG Xbox Ally (Z2 A)': 'xally',
  'ROG Xbox Ally X (Z2 Extreme)': 'xallyx',
};
const RATINGS = ['great', 'good', 'playable', 'rough', 'unplayable'];
const HIDDEN = new Set(['hidden', 'spam', 'invalid']);

if (!repo) {
  // Local builds have no repository to read; keep the site working with no reports.
  await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), reports: [] }));
  console.log('Reports: GITHUB_REPOSITORY not set, wrote an empty list');
  process.exit(0);
}

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'DeckTune-reports', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

// "### Label\n\nvalue" sections, as GitHub renders an issue form.
function sections(body) {
  const out = {};
  const parts = (body ?? '').replace(/\r\n/g, '\n').split(/^### /m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    const label = (nl < 0 ? part : part.slice(0, nl)).trim().toLowerCase();
    const value = nl < 0 ? '' : part.slice(nl + 1).trim();
    out[label] = value === '_No response_' ? '' : value;
  }
  return out;
}

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const number = (s) => {
  const m = (s ?? '').match(/\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : null;
};

function parse(issue) {
  const f = sections(issue.body);
  const appId = parseInt((f['steam app id'] ?? '').replace(/\D/g, ''), 10);
  const device = DEVICES[(f['handheld'] ?? '').trim()];
  const rating = (f['how well does it run?'] ?? '').trim().split(/[\s-]/)[0].toLowerCase();
  // "38-40" counts as 39, so a range neither flatters nor undersells.
  const range = (f['average frame rate (fps)'] ?? '').match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/);
  const fps = range
    ? (parseFloat(range[1].replace(',', '.')) + parseFloat(range[2].replace(',', '.'))) / 2
    : number(f['average frame rate (fps)']);
  if (!appId || !device || !RATINGS.includes(rating) || fps == null || fps <= 0 || fps > 500) return null;

  const fpsText = (f['average frame rate (fps)'] ?? '').match(/\d+(?:\s*[-–]\s*\d+)?/)?.[0].replace(/\s/g, '') ?? String(fps);
  const battery = number(f['battery life (hours)']);
  return {
    id: issue.number,
    appId,
    game: clip((f['game'] ?? '').trim(), 120),
    device,
    os: clip((f['operating system'] ?? '').trim(), 40),
    rating,
    fps,
    fpsText: clip(fpsText, 12),
    battery: battery != null && battery > 0 && battery < 30 ? battery : null,
    settings: clip(f['settings you used'] ?? '', 1500),
    notes: clip(f['anything else?'] ?? '', 1500),
    user: issue.user?.login ?? 'ghost',
    avatar: issue.user?.avatar_url ?? '',
    created: issue.created_at,
    updated: issue.updated_at,
    helpful: issue.reactions?.['+1'] ?? 0,
    comments: issue.comments ?? 0,
  };
}

const reports = [];
for (let page = 1; page <= 50; page++) {
  const res = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&per_page=100&page=${page}&sort=created&direction=desc`, { headers });
  if (!res.ok) throw new Error(`GitHub issues API returned ${res.status}: ${await res.text()}`);
  const issues = await res.json();
  for (const issue of issues) {
    if (issue.pull_request) continue;
    if (issue.labels?.some((l) => HIDDEN.has((typeof l === 'string' ? l : l.name).toLowerCase()))) continue;
    const report = parse(issue);
    if (report) reports.push(report);
  }
  if (issues.length < 100) break;
}

await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), reports }));
console.log(`Reports: ${reports.length} published`);
