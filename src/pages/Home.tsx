import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  compact, formatDate, loadCatalog, loadFacts, loadProfileIndex, POPULAR, ratingOf,
  type CatalogGame, type GameRef,
} from '../lib/data';
import { getHandheld, type DeviceId } from '../lib/handhelds';
import { hasSettingsFor } from '../lib/profiles';
import { useLoad, useStored } from '../lib/state';
import { useReports } from '../lib/reports';
import { useLibrary } from '../lib/library';
import { useDevice } from '../App';
import { EmptyState, ErrorRow, GameArt, Icon, SectionHeader, TierBadge, capitalize, normalizeTier } from '../components/ui';
import { ReportCard } from '../components/Reports';

const PAGE = 24;
const TIER_ORDER = ['platinum', 'gold', 'silver', 'bronze', 'borked', 'pending', 'unrated'];

// Case, spaces and punctuation don't matter: "baldurs gate" finds "Baldur's Gate 3".
const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');

export function Home() {
  const [device] = useDevice();
  const [index] = useLoad(loadProfileIndex, []);
  const [reports] = useReports();
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;

  const settings = useMemo(() => new Map((index ?? []).map((r) => [r[0], r[2]])), [index]);
  const images = useMemo(() => new Map((index ?? []).map((r) => [r[0], r[3]])), [index]);
  const reportCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of reports ?? []) m.set(r.appId, (m.get(r.appId) ?? 0) + 1);
    return m;
  }, [reports]);
  const ready = useCallback((appId: number) => hasSettingsFor(settings.get(appId) ?? [], device), [settings, device]);

  return (
    <>
      <section className="flex flex-col gap-5 pt-6 sm:pt-10 fade-in">
        <h1 className="font-heading font-bold uppercase leading-[0.95] text-4xl sm:text-6xl max-w-3xl">Every Steam game, tuned for your handheld.</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Max Battery, Optimal and Max Performance presets for the Steam Deck and every ROG Ally, and an open place where players share how games really run on theirs. Free, no account needed to read.
        </p>
        <div className="flex flex-wrap gap-2">
          {index && (
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-sm font-medium text-emerald-200 tabular-nums">
              <Icon name="circle-check" className="w-4 h-4 text-emerald-300" />
              Presets for {index.length.toLocaleString('en-US')} games
            </span>
          )}
          {reports && (
            <a href="#/community" className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-1.5 text-sm font-medium text-brand-text tabular-nums hover:bg-brand/15">
              <Icon name="users" className="w-4 h-4" />
              {reports.length === 0 ? 'Share the first player report' : `${reports.length.toLocaleString('en-US')} player ${reports.length === 1 ? 'report' : 'reports'}`}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-card border border-border p-2 pl-4 shadow-lg shadow-black/30 focus-within:border-brand transition-colors">
          <Icon name="search" className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            className="flex-1 min-w-0 bg-transparent border-0 text-base h-11 outline-none placeholder:text-muted-foreground"
            placeholder="Search Steam games, e.g. Elden Ring, Hades, Balatro"
            aria-label="Search Steam games"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {searching && (
            <button type="button" className="btn-ghost btn-icon" aria-label="Clear search" onClick={() => setQuery('')}>
              <Icon name="circle-x" />
            </button>
          )}
        </div>
      </section>

      {searching ? (
        <Browse query={query} ready={ready} settings={settings} reportCounts={reportCounts} device={device} />
      ) : (
        <>
          <Library ready={ready} />
          <section className="flex flex-col gap-4">
            <SectionHeader icon="flame" title="Popular on handhelds" subtitle="Heavily reported on ProtonDB" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {POPULAR.map((g) => <GameTile key={g.appId} game={{ ...g, image: images.get(g.appId) }} ready={ready(g.appId)} reports={reportCounts.get(g.appId)} />)}
            </div>
          </section>
          {reports && reports.length > 0 && (
            <section className="flex flex-col gap-4">
              <SectionHeader icon="message-square-text" title="Latest player reports" subtitle="How games run on real handhelds"
                action={<a href="#/community" className="btn-ghost">See all</a>} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {reports.slice(0, 4).map((r) => <ReportCard key={r.id} report={r} showGame />)}
              </div>
            </section>
          )}
          <Browse query="" ready={ready} settings={settings} reportCounts={reportCounts} device={device} />
        </>
      )}
    </>
  );
}

export function GameTile({ game, meta, ready, reports }: { game: GameRef; meta?: CatalogGame; ready?: boolean; reports?: number }) {
  const { has } = useLibrary();
  return (
    <a
      href={`#/game/${game.appId}`}
      className="group flex flex-col rounded-xl overflow-hidden bg-card border border-border hover:border-brand hover:-translate-y-0.5 transition-all duration-150 active:scale-[0.98]"
    >
      <div className="relative">
        <GameArt appId={game.appId} name={game.name} image={game.image ?? meta?.image} className="w-full aspect-[460/215]" />
        <div className="absolute top-2 right-2 flex gap-1.5">
          {has(game.appId) && (
            <span className="w-7 h-7 rounded-full bg-black/70 flex items-center justify-center" title="In your library">
              <Icon name="bookmark-check" className="w-4 h-4 text-brand-text" />
            </span>
          )}
        </div>
        <div className="absolute bottom-2 left-2 flex gap-1.5">
          {ready && <span className="rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Presets</span>}
          {!!reports && <span className="rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-text tabular-nums">{reports} {reports === 1 ? 'report' : 'reports'}</span>}
        </div>
      </div>
      <div className="px-3 py-2.5 flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium truncate">{game.name}</span>
        {meta && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <span className="tabular-nums shrink-0">{formatDate(meta.released)}</span>
            <span>·</span>
            <span className={`truncate ${meta.reviews === 0 ? '' : meta.positivePct >= 80 ? 'text-sky-300' : meta.positivePct >= 50 ? 'text-amber-300' : 'text-rose-300'}`}>
              {meta.reviews === 0 ? 'No reviews yet' : `${meta.positivePct}% of ${compact(meta.reviews)}`}
            </span>
          </span>
        )}
      </div>
    </a>
  );
}

// ───────────────────────── Library ─────────────────────────

function Library({ ready }: { ready: (appId: number) => boolean }) {
  const { library, remove, undo, lastRemoved } = useLibrary();
  const [facts] = useLoad(loadFacts, []);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useStored('library-sort', 'recent');
  const [tier, setTier] = useState('all');
  const tierOf = (appId: number) => normalizeTier(facts?.get(appId)?.tier);

  const counts = new Map<string, number>();
  for (const e of library) counts.set(tierOf(e.appId), (counts.get(tierOf(e.appId)) ?? 0) + 1);
  const tierChoice = tier !== 'all' && !counts.has(tier) ? 'all' : tier;

  const visible = library
    .filter((e) => !search.trim() || fold(e.name).includes(fold(search)))
    .filter((e) => tierChoice === 'all' || tierOf(e.appId) === tierChoice)
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name)
      : sort === 'tier' ? TIER_ORDER.indexOf(tierOf(a.appId)) - TIER_ORDER.indexOf(tierOf(b.appId)) || a.name.localeCompare(b.name)
        : b.added.localeCompare(a.added));

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader icon="library" title="Your library" subtitle={`${library.length} ${library.length === 1 ? 'game' : 'games'} · saved in this browser`} />
      {lastRemoved && (
        <div className="flex items-center gap-3 rounded-xl bg-muted px-4 py-2.5 fade-in">
          <p className="flex-1 text-sm">Removed {lastRemoved.name} from your library.</p>
          <button type="button" className="btn-ghost text-brand-text" onClick={undo}>Undo</button>
        </div>
      )}
      {library.length === 0 ? (
        <EmptyState icon="bookmark-plus" title="Your library is empty" body="Open any game and press Add to library to keep its settings one tap away." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input className="field w-full sm:w-60" placeholder="Search your library" aria-label="Search your library" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="field w-40" aria-label="Sort library" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recent">Recently added</option>
              <option value="name">Name</option>
              <option value="tier">ProtonDB tier</option>
            </select>
            <select className="field w-44" aria-label="Filter by ProtonDB tier" value={tierChoice} onChange={(e) => setTier(e.target.value)}>
              <option value="all">All tiers ({library.length})</option>
              {TIER_ORDER.filter((t) => counts.has(t)).map((t) => <option key={t} value={t}>{capitalize(t)} ({counts.get(t)})</option>)}
            </select>
            {(search || tierChoice !== 'all') && <button type="button" className="btn-ghost" onClick={() => { setSearch(''); setTier('all'); }}>Clear</button>}
          </div>
          {visible.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center">No library games match these filters.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {visible.map((e) => (
                <div key={e.appId} className="flex items-center gap-3 rounded-xl bg-card border border-border p-2 pr-3 hover:border-brand transition-colors">
                  <a href={`#/game/${e.appId}`} className="flex flex-1 min-w-0 items-center gap-3">
                    <GameArt appId={e.appId} name={e.name} image={e.image} className="w-24 sm:w-32 aspect-[460/215] rounded-lg shrink-0" />
                    <div className="min-w-0 flex flex-col gap-1">
                      <span className="font-medium truncate">{e.name}</span>
                      <span className="flex items-center gap-2 flex-wrap">
                        <TierBadge tier={facts?.get(e.appId)?.tier} />
                        <span className={`caption ${ready(e.appId) ? 'text-brand-text!' : ''}`}>{ready(e.appId) ? 'Presets ready' : 'No presets yet'}</span>
                      </span>
                    </div>
                  </a>
                  <button type="button" className="btn-ghost btn-icon" aria-label={`Remove ${e.name}`} onClick={() => remove(e.appId)}>
                    <Icon name="trash-2" className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ───────────────────────── Every Steam game ─────────────────────────

function Browse({ query, ready, settings, reportCounts, device }: {
  query: string;
  ready: (appId: number) => boolean;
  settings: Map<number, DeviceId[]>;
  reportCounts: Map<number, number>;
  device: DeviceId;
}) {
  const [catalog, failed, retry] = useLoad(loadCatalog, []);
  const [year, setYear] = useState('all');
  const [sort, setSort] = useState('popular');
  const [show, setShow] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const term = fold(useDeferredValue(query).trim());
  const games = catalog?.games ?? [];

  const years = useMemo(() => {
    const m = new Map<number, number>();
    for (const g of games) m.set(Math.floor(g.released / 10000), (m.get(Math.floor(g.released / 10000)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [games]);

  const showCounts = useMemo(() => ({
    presets: games.filter((g) => ready(g.appId)).length,
    reports: games.filter((g) => reportCounts.has(g.appId)).length,
  }), [games, ready, reportCounts]);

  const visible = useMemo(() => {
    let rows = games;
    if (term) rows = rows.filter((g) => fold(g.name).includes(term));
    if (year !== 'all') rows = rows.filter((g) => Math.floor(g.released / 10000) === Number(year));
    if (show === 'presets') rows = rows.filter((g) => ready(g.appId));
    if (show === 'reports') rows = rows.filter((g) => reportCounts.has(g.appId));
    const sorted = [...rows];
    // A search puts the closest name match first, then the usual order.
    const closeness = (g: CatalogGame) => (!term ? 0 : fold(g.name) === term ? 0 : fold(g.name).startsWith(term) ? 1 : 2);
    sorted.sort((a, b) => closeness(a) - closeness(b) || (
      sort === 'newest' ? b.released - a.released || b.reviews - a.reviews
        : sort === 'oldest' ? a.released - b.released || b.reviews - a.reviews
          : sort === 'rated' ? ratingOf(b) - ratingOf(a) || b.reviews - a.reviews
            : sort === 'name' ? a.name.localeCompare(b.name)
              : b.reviews - a.reviews || b.released - a.released));
    return sorted;
  }, [games, term, year, sort, show, ready, reportCounts]);

  const filtered = year !== 'all' || sort !== 'popular' || show !== 'all';
  const shown = Math.min(limit, visible.length);
  const first = games.length ? Math.floor(games[games.length - 1].released / 10000) : 0;
  const reset = () => setLimit(PAGE);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader icon={term ? 'search' : 'calendar-range'} title={term ? 'Search results' : 'Every Steam game'}
        subtitle={term ? `For "${query.trim()}"` : games.length ? `${games.length.toLocaleString('en-US')} games released on Steam, ${first} to today` : 'Every game released on Steam'} />

      {failed ? (
        <ErrorRow text="Couldn't load the game list." onRetry={retry} />
      ) : !catalog ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-44 rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select className="field w-44" aria-label="Release year" value={year} onChange={(e) => { setYear(e.target.value); reset(); }}>
              <option value="all">All years ({games.length.toLocaleString('en-US')})</option>
              {years.map(([y, n]) => <option key={y} value={y}>{y} ({n.toLocaleString('en-US')})</option>)}
            </select>
            <select className="field w-44" aria-label="Sort games" value={sort} onChange={(e) => { setSort(e.target.value); reset(); }}>
              <option value="popular">Most reviewed</option>
              <option value="rated">Highest rated</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
            </select>
            <select className="field w-60" aria-label="Show games" value={show} onChange={(e) => { setShow(e.target.value); reset(); }}>
              <option value="all">All games</option>
              <option value="presets">With {getHandheld(device).shortName} presets ({showCounts.presets.toLocaleString('en-US')})</option>
              <option value="reports">With player reports ({showCounts.reports.toLocaleString('en-US')})</option>
            </select>
            {filtered && <button type="button" className="btn-ghost" onClick={() => { setYear('all'); setSort('popular'); setShow('all'); reset(); }}>Clear</button>}
          </div>

          {visible.length === 0 ? (
            <EmptyState icon="search-x" title="No games match" body={term ? 'Check the spelling or try a shorter part of the title.' : 'Try another year or clear the filters.'} />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {visible.slice(0, shown).map((g) => (
                  <GameTile key={g.appId} game={{ appId: g.appId, name: g.name, image: g.image }} meta={g}
                    ready={settings.has(g.appId) && ready(g.appId)} reports={reportCounts.get(g.appId)} />
                ))}
              </div>
              <div className="flex flex-col items-center gap-3 pt-2">
                <p className="caption tabular-nums">Showing {shown.toLocaleString('en-US')} of {visible.length.toLocaleString('en-US')} games</p>
                {shown < visible.length && <button type="button" className="btn-outline" onClick={() => setLimit(shown + PAGE * 2)}>Show more</button>}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

