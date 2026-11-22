// Everything the site reads: static JSON files built into the site (public/data), cached per page load.
import type { DeckVerified, GameProfiles } from './profiles';
import type { DeviceId } from './handhelds';

const BASE = `${import.meta.env.BASE_URL}data/`;
const cache = new Map<string, Promise<unknown>>();

function load<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(BASE + path).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json() as Promise<T>;
    });
    p.catch(() => cache.delete(path)); // a failed load can be retried
    cache.set(path, p);
  }
  return p;
}

// ───────────────────────── Games ─────────────────────────

// [appId, name, yyyymmdd, reviews, positivePct, image?]
export type CatalogRow = [number, string, number, number, number, string?];

export interface CatalogGame {
  appId: number;
  name: string;
  released: number; // yyyymmdd
  reviews: number;
  positivePct: number;
  image?: string;
}

export interface GameRef { appId: number; name: string; image?: string }

export async function loadCatalog(): Promise<{ updated: string; games: CatalogGame[] }> {
  const raw = await load<{ updated: string; games: CatalogRow[] }>('catalog.json');
  return {
    updated: raw.updated,
    games: raw.games.map(([appId, name, released, reviews, positivePct, image]) => ({ appId, name, released, reviews, positivePct, image })),
  };
}

let byIdCache: Promise<Map<number, CatalogGame>> | null = null;
export function catalogById(): Promise<Map<number, CatalogGame>> {
  byIdCache ??= loadCatalog().then((c) => new Map(c.games.map((g) => [g.appId, g])));
  byIdCache.catch(() => (byIdCache = null));
  return byIdCache;
}

// The positive share pulled toward 50% when there are few reviews (SteamDB's formula), so 100% of
// 50 reviews doesn't outrank 99% of 6,000.
export const ratingOf = (g: CatalogGame) => (g.reviews === 0 ? 0 : g.positivePct - (g.positivePct - 50) * Math.pow(2, -Math.log10(g.reviews + 1)));

// [appId, name, devices with stored profiles, Steam art key?]
export type IndexRow = [number, string, DeviceId[], string?];
export const loadProfileIndex = () => load<IndexRow[]>('profiles-index.json');
export const loadProfiles = (appId: number) => load<GameProfiles>(`profiles/${appId}.json`);

// ───────────────────────── Facts ─────────────────────────

export interface GameFacts { tier: string; reports: number; confidence: string; trending: string; deck: DeckVerified }

export async function loadFacts(): Promise<Map<number, GameFacts>> {
  const raw = await load<{ games: Record<string, [string, number, string, string, number]> }>('facts.json');
  return new Map(Object.entries(raw.games).map(([id, [tier, reports, confidence, trending, deck]]) =>
    [Number(id), { tier, reports, confidence, trending, deck: deck as DeckVerified }]));
}

// ───────────────────────── Community reports ─────────────────────────

export type Rating = 'great' | 'good' | 'playable' | 'rough' | 'unplayable';

export interface Report {
  id: number;
  appId: number;
  game: string;
  device: DeviceId;
  os: string;
  rating: Rating;
  fps: number;
  fpsText: string;
  battery: number | null;
  // The DeckTune preset the player used, when they used one.
  preset?: string;
  settings: string;
  notes: string;
  user: string;
  avatar: string;
  // Posted on DeckTune without a GitHub account; `user` is the name they gave.
  guest?: boolean;
  // Posted by this visitor and not yet in the published list.
  pending?: boolean;
  created: string;
  updated: string;
  helpful: number;
  comments: number;
}

export const loadReports = () => load<{ updated: string; reports: Report[] }>('reports.json');

// ───────────────────────── Steam art ─────────────────────────

const STEAM = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps';

// The best art first, then fallbacks: the 2x capsule, its 1x file, the plain header (right for
// older games). The tile shows the game's initials if none load.
export function artUrls(appId: number, image?: string): string[] {
  const urls: string[] = [];
  if (image) {
    const path = /^[0-9a-f]{40}$/.test(image) ? `${image}/capsule_231x87.jpg` : image;
    if (path.endsWith('.jpg')) urls.push(`${STEAM}/${appId}/${path.slice(0, -4)}_2x.jpg`);
    urls.push(`${STEAM}/${appId}/${path}`);
  }
  urls.push(`${STEAM}/${appId}/header.jpg`);
  return urls;
}

export const formatDate = (yyyymmdd: number) => {
  const d = new Date(Date.UTC(Math.floor(yyyymmdd / 10000), (Math.floor(yyyymmdd / 100) % 100) - 1, yyyymmdd % 100));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

export function compact(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (n >= 10_000) return `${Math.floor(n / 1000)}K`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}K`;
  return String(n);
}

// Well-known games with large ProtonDB report counts: a starting shelf before any search.
export const POPULAR: GameRef[] = [
  { appId: 1245620, name: 'ELDEN RING' },
  { appId: 1086940, name: "Baldur's Gate 3" },
  { appId: 1091500, name: 'Cyberpunk 2077' },
  { appId: 1145350, name: 'Hades II' },
  { appId: 413150, name: 'Stardew Valley' },
  { appId: 1174180, name: 'Red Dead Redemption 2' },
  { appId: 2379780, name: 'Balatro' },
  { appId: 367520, name: 'Hollow Knight' },
  { appId: 1593500, name: 'God of War' },
  { appId: 1794680, name: 'Vampire Survivors' },
  { appId: 2246340, name: 'Monster Hunter Wilds' },
  { appId: 1145360, name: 'Hades' },
];
