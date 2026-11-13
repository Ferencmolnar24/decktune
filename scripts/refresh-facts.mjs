// ProtonDB's community tier and Valve's Steam Deck Verified rating for every game that has DeckTune
// settings, community reports or a spot on the home page. Neither service lets a browser read it
// directly (no CORS), so GitHub Actions fetches it daily into public/data/facts.json:
// { updated, games: { appId: [tier, reports, confidence, trending, deckVerified 0-3] } }
import { readFile, writeFile } from 'node:fs/promises';

const DATA = new URL('../public/data/', import.meta.url);
const read = async (name, fallback) => {
  try {
    return JSON.parse(await readFile(new URL(name, DATA), 'utf8'));
  } catch {
    return fallback;
  }
};

const POPULAR = [1245620, 1086940, 1091500, 1145350, 413150, 1174180, 2379780, 367520, 1593500, 1794680, 2246340, 1145360];

const index = await read('profiles-index.json', []);
const reports = await read('reports.json', { reports: [] });
const previous = await read('facts.json', { games: {} });

const ids = [...new Set([...POPULAR, ...index.map((r) => r[0]), ...reports.reports.map((r) => r.appId)])];
const headers = { 'User-Agent': 'DeckTune/2.0 (facts refresh)' };

async function json(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.status === 404) return null;
      if (res.ok) return await res.json();
    } catch {
      // network hiccup: retry
    }
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }
  return undefined; // unknown: keep yesterday's value
}

const games = { ...previous.games };
let done = 0;

async function refresh(id) {
  const [proton, deck] = await Promise.all([
    json(`https://www.protondb.com/api/v1/reports/summaries/${id}.json`),
    json(`https://store.steampowered.com/saleaction/ajaxgetdeckappcompatibilityreport?nAppID=${id}&l=english`),
  ]);
  const old = games[id] ?? ['', 0, '', '', 0];
  const tier = proton === undefined ? old[0] : proton?.tier ?? '';
  const total = proton === undefined ? old[1] : proton?.total ?? 0;
  const confidence = proton === undefined ? old[2] : proton?.confidence ?? '';
  const trending = proton === undefined ? old[3] : proton?.trendingTier ?? '';
  const category = deck?.results?.resolved_category;
  const verified = deck === undefined ? old[4] : typeof category === 'number' ? Math.max(0, Math.min(3, category)) : 0;
  games[id] = [tier, total, confidence, trending, verified];
  done++;
}

// A few at a time, so neither service sees a burst.
const queue = [...ids];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    await refresh(queue.shift());
    await new Promise((r) => setTimeout(r, 250));
  }
}));

await writeFile(new URL('facts.json', DATA), JSON.stringify({ updated: new Date().toISOString(), games }));
console.log(`Facts: ${done} games refreshed`);
