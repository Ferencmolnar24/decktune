// ProtonDB's community tier and Valve's Steam Deck Verified rating for every game that has DeckTune
// settings, player reports (read from the report database named in .env) or a spot on the home page. Neither service lets a browser read it
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
const previous = await read('facts.json', { games: {} });

// The games players have reported on. Skipped (not fatal) when the database can't be reached.
async function reportedGames() {
  try {
    const env = Object.fromEntries((await readFile(new URL('../.env', import.meta.url), 'utf8'))
      .split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]));
    const url = (process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
    const key = process.env.VITE_SUPABASE_KEY ?? env.VITE_SUPABASE_KEY ?? '';
    if (!url || !key) return [];
    const res = await fetch(`${url}/rest/v1/reports?select=app_id&limit=5000`, { headers: { apikey: key } });
    return res.ok ? (await res.json()).map((r) => r.app_id) : [];
  } catch {
    return [];
  }
}

const ids = [...new Set([...POPULAR, ...index.map((r) => r[0]), ...(await reportedGames())])];
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
