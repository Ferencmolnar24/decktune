// Keeps public/data/catalog.json current: re-reads Steam's newest releases (store search, newest
// first) until a page brings nothing new, and merges them in. Runs daily in GitHub Actions.
//
// catalog.json: { updated, games: [[appId, name, yyyymmdd, reviews, positivePct, image?], ...] }
// image is the 40-hex asset hash of the capsule when Steam uses the standard name, else the path.
import { readFile, writeFile } from 'node:fs/promises';

const FILE = new URL('../public/data/catalog.json', import.meta.url);
const SEARCH = (start) =>
  `https://store.steampowered.com/search/results/?query&start=${start}&count=100&sort_by=Released_DESC&category1=998&infinite=1&cc=us&l=english`;
const MAX_PAGES = 40;
// Games nobody has reviewed are kept while they're new; after that they're mostly noise.
const KEEP_UNREVIEWED_DAYS = 60;

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

function decode(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

// "Oct 7, 2026", "7 Oct, 2026" or "Oct 2026" → 20261007; anything else (Coming soon, TBA) → null.
function parseDate(text) {
  const t = text.trim();
  let m = t.match(/^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/);
  if (m && MONTHS[m[1]]) return +m[3] * 10000 + MONTHS[m[1]] * 100 + +m[2];
  m = t.match(/^(\d{1,2}) ([A-Z][a-z]{2}), (\d{4})$/);
  if (m && MONTHS[m[2]]) return +m[3] * 10000 + MONTHS[m[2]] * 100 + +m[1];
  m = t.match(/^([A-Z][a-z]{2}) (\d{4})$/);
  if (m && MONTHS[m[1]]) return +m[2] * 10000 + MONTHS[m[1]] * 100 + 1;
  return null;
}

function imageKey(path) {
  if (!path) return null;
  const m = path.match(/^([0-9a-f]{40})\/capsule_231x87\.jpg$/);
  return m ? m[1] : path;
}

function parsePage(html) {
  const rows = [];
  for (const row of html.matchAll(/<a href="[^"]*"\s+data-ds-appid="(\d+)"(.*?)<\/a>/gs)) {
    const body = row[2];
    const released = body.match(/search_released[^>]*>\s*(.*?)\s*<\/div>/s);
    const date = released ? parseDate(decode(released[1])) : null;
    if (!date) continue;
    const title = body.match(/<span class="title">(.*?)<\/span>/s);
    const reviews = decode(body).match(/(\d+)% of the ([\d,]+) user reviews/);
    const image = body.match(/search_capsule"><img src="[^"]*\/steam\/apps\/\d+\/([^"?]+)/);
    const game = [
      +row[1],
      decode(title ? title[1] : '').trim(),
      date,
      reviews ? +reviews[2].replace(/,/g, '') : 0,
      reviews ? +reviews[1] : 0,
    ];
    const key = imageKey(image?.[1]);
    if (key) game.push(key);
    rows.push(game);
  }
  return rows;
}

function today() {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function daysAgo(days) {
  const d = new Date(Date.now() - days * 86400000);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

const current = JSON.parse(await readFile(FILE, 'utf8'));
const byId = new Map(current.games.map((g) => [g[0], g]));
let added = 0;

// Steam rate-limits bursts (429): wait and retry, and keep whatever was read if it never relents.
async function fetchPage(start) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(SEARCH(start), { headers: { 'User-Agent': 'DeckTune/2.0 (catalog refresh)' } });
    if (res.ok) return (await res.json()).results_html ?? '';
    if (res.status !== 429 && res.status < 500) throw new Error(`Steam search returned ${res.status}`);
    await new Promise((r) => setTimeout(r, 20000 * (attempt + 1)));
  }
  return null;
}

for (let page = 0; page < MAX_PAGES; page++) {
  const html = await fetchPage(page * 100);
  if (html === null) {
    console.log(`Steam kept rate-limiting at page ${page}; saving what was read`);
    break;
  }
  const rows = parsePage(html);
  if (rows.length === 0) break;

  let fresh = 0;
  for (const row of rows) {
    if (!byId.has(row[0])) fresh++;
    const old = byId.get(row[0]);
    if (old && row.length < 6 && old.length > 5) row.push(old[5]); // keep known art
    byId.set(row[0], row); // review counts move; the newest read wins
  }
  added += fresh;
  if (fresh === 0) break;
  await new Promise((r) => setTimeout(r, 1500));
}

const now = today();
const cutoff = daysAgo(KEEP_UNREVIEWED_DAYS);
const games = [...byId.values()]
  .filter((g) => g[2] <= now && (g[3] > 0 || g[2] >= cutoff))
  .sort((a, b) => b[2] - a[2] || b[3] - a[3]);

await writeFile(FILE, JSON.stringify({ updated: new Date().toISOString(), games }));
console.log(`Catalog: ${added} new, ${games.length} total`);
