import { useMemo, useState } from 'react';
import { loadCatalog, loadProfileIndex, type Rating, type Report } from '../lib/data';
import { useReports } from '../lib/reports';
import { getHandheld, HANDHELDS, type DeviceId } from '../lib/handhelds';
import { RATINGS, ratingInfo, summarize } from '../lib/community';
import { useLoad, useStored } from '../lib/state';
import { BackLink, EmptyState, ErrorRow, GameArt, Icon } from '../components/ui';
import { HowPostingWorks, ReportCard, ShareButton } from '../components/Reports';
import { useDevice } from '../App';

const PAGE = 20;
type Tab = 'reports' | 'find' | 'needs';

// Every player report, newest first; games found by what players measured; and the popular games
// still waiting for their first report.
export function CommunityPage() {
  const [data, failed, retry] = useReports();
  const [tab, setTab] = useStored<Tab>('community-tab', 'reports');
  const [myDevice] = useDevice();
  const reports = useMemo(() => data ?? [], [data]);
  const players = new Set(reports.map((r) => r.user)).size;
  const games = new Set(reports.map((r) => r.appId)).size;

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'reports', label: 'Latest reports', icon: 'message-square-text' },
    { id: 'find', label: 'Find games', icon: 'filter' },
    { id: 'needs', label: 'Needs reports', icon: 'megaphone' },
  ];

  return (
    <div className="flex flex-col gap-8 pt-2 fade-in">
      <BackLink />
      <div className="flex flex-col gap-3 max-w-3xl">
        <span className="self-start inline-flex items-center rounded-full border border-brand/50 bg-brand/10 px-3 py-1 eyebrow text-brand-text">Open to everyone</span>
        <h1 className="font-heading font-bold uppercase leading-[0.95] text-4xl sm:text-5xl">Player reports</h1>
        <p className="text-lg text-muted-foreground">
          How games really run on Steam Decks and ROG Allys, measured by the people playing them. Share your own frame rate, battery life and settings in under a minute.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <ShareButton device={myDevice} />
        </div>
        {data && reports.length > 0 && (
          <p className="text-sm text-muted-foreground tabular-nums">{reports.length} {reports.length === 1 ? 'report' : 'reports'} on {games} {games === 1 ? 'game' : 'games'} from {players} {players === 1 ? 'player' : 'players'}</p>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 border-b border-border" role="tablist" aria-label="Community">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 min-h-11 px-2.5 sm:px-3.5 -mb-px border-b-2 text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${tab === t.id ? 'border-brand text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Icon name={t.icon} className="w-4 h-4 hidden sm:block" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'needs' ? <NeedsReports reports={data} device={myDevice} />
        : failed ? <ErrorRow text="Couldn't load the reports." onRetry={retry} />
          : !data ? <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-56 rounded-2xl" />)}</div>
            : tab === 'find' ? <GameFinder reports={reports} onNeeds={() => setTab('needs')} />
              : <LatestReports reports={reports} onNeeds={() => setTab('needs')} />}
    </div>
  );
}

function LatestReports({ reports, onNeeds }: { reports: Report[]; onNeeds: () => void }) {
  const [device, setDevice] = useState('all');
  const [rating, setRating] = useState('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const deviceCounts = useMemo(() => count(reports, (r) => r.device), [reports]);
  const ratingCounts = useMemo(() => count(reports, (r) => r.rating), [reports]);
  const term = search.trim().toLowerCase();
  const visible = reports
    .filter((r) => device === 'all' || r.device === device)
    .filter((r) => rating === 'all' || r.rating === rating)
    .filter((r) => !term || r.game.toLowerCase().includes(term))
    .sort((a, b) => b.created.localeCompare(a.created));
  const filtered = device !== 'all' || rating !== 'all' || term.length > 0;

  if (reports.length === 0) {
    return (
      <EmptyState icon="users" title="No reports yet" body="Be the first: share how a game you've played runs on your handheld.">
        <button type="button" className="btn-outline mt-2" onClick={onNeeds}><Icon name="megaphone" /> See games that need reports</button>
        <div className="pt-2"><HowPostingWorks /></div>
      </EmptyState>
    );
  }
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="field w-full sm:w-60" placeholder="Filter by game" aria-label="Filter reports by game" value={search} onChange={(e) => { setSearch(e.target.value); setLimit(PAGE); }} />
        <select className="field w-64" aria-label="Filter by handheld" value={device} onChange={(e) => { setDevice(e.target.value); setLimit(PAGE); }}>
          <option value="all">All handhelds ({reports.length})</option>
          {HANDHELDS.map((h) => <option key={h.id} value={h.id}>{h.name} ({deviceCounts.get(h.id) ?? 0})</option>)}
        </select>
        <select className="field w-44" aria-label="Filter by verdict" value={rating} onChange={(e) => { setRating(e.target.value); setLimit(PAGE); }}>
          <option value="all">Any verdict</option>
          {RATINGS.map((x) => <option key={x.id} value={x.id}>{x.label} ({ratingCounts.get(x.id) ?? 0})</option>)}
        </select>
        {filtered && <button type="button" className="btn-ghost" onClick={() => { setDevice('all'); setRating('all'); setSearch(''); }}>Clear</button>}
      </div>
      {visible.length === 0 ? (
        <EmptyState icon="search-x" title="No reports match these filters" />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visible.slice(0, limit).map((r) => <ReportCard key={r.id} report={r} showGame />)}
          </div>
          <div className="flex flex-col items-center gap-3">
            <p className="caption tabular-nums">Showing {Math.min(limit, visible.length)} of {visible.length}</p>
            {limit < visible.length && <button type="button" className="btn-outline" onClick={() => setLimit(limit + PAGE)}>Show more</button>}
          </div>
        </>
      )}
      <HowPostingWorks />
    </section>
  );
}

// ───────────────────────── Find games by what players measured ─────────────────────────

interface Filters { device: string; fps: number; battery: number; verdict: Rating | 'any' }
const NO_FILTERS: Filters = { device: 'all', fps: 0, battery: 0, verdict: 'any' };
const QUICK: { label: string; f: Partial<Filters> }[] = [
  { label: '40+ fps on Deck OLED', f: { device: 'oled', fps: 40 } },
  { label: '60 fps on Deck OLED', f: { device: 'oled', fps: 60 } },
  { label: '4+ h battery', f: { battery: 4 } },
  { label: 'Great on Deck LCD', f: { device: 'lcd', verdict: 'great' } },
  { label: 'Great on Ally X', f: { device: 'allyx', verdict: 'great' } },
  { label: '60 fps on ROG Ally', f: { device: 'ally', fps: 60 } },
];
const VERDICTS: { id: Filters['verdict']; label: string }[] = [
  { id: 'any', label: 'Any verdict' }, { id: 'playable', label: 'Playable or better' }, { id: 'good', label: 'Good or better' }, { id: 'great', label: 'Great' },
];
const rank = (r: Rating) => RATINGS.findIndex((x) => x.id === r);

interface GameRow { appId: number; game: string; s: ReturnType<typeof summarize> }

// Each game's reports on the chosen handheld (or all of them), summarised.
function gameRows(reports: Report[], device: string): GameRow[] {
  const by = new Map<number, Report[]>();
  for (const r of reports) {
    if (device !== 'all' && r.device !== device) continue;
    by.set(r.appId, [...(by.get(r.appId) ?? []), r]);
  }
  return [...by.values()].map((rs) => ({ appId: rs[0].appId, game: rs[0].game, s: summarize(rs) }));
}

const matches = (g: GameRow, f: Filters) =>
  (f.fps === 0 || (g.s.fps ?? 0) >= f.fps)
  && (f.battery === 0 || (g.s.battery ?? 0) >= f.battery)
  && (f.verdict === 'any' || (g.s.verdict != null && rank(g.s.verdict) <= rank(f.verdict)));

function GameFinder({ reports, onNeeds }: { reports: Report[]; onNeeds: () => void }) {
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState('reports');
  const rows = useMemo(() => gameRows(reports, f.device), [reports, f.device]);
  const deviceGames = useMemo(() => new Map(HANDHELDS.map((h) => [h.id, gameRows(reports, h.id).length])), [reports]);
  const quickCounts = useMemo(() => QUICK.map((q) => {
    const all = { ...NO_FILTERS, ...q.f };
    return gameRows(reports, all.device).filter((g) => matches(g, all)).length;
  }), [reports]);
  const results = rows.filter((g) => matches(g, f)).sort((a, b) =>
    sort === 'fps' ? (b.s.fps ?? 0) - (a.s.fps ?? 0)
      : sort === 'battery' ? (b.s.battery ?? 0) - (a.s.battery ?? 0)
        : sort === 'verdict' ? (b.s.score ?? 0) - (a.s.score ?? 0)
          : b.s.count - a.s.count || a.game.localeCompare(b.game));
  const filtered = JSON.stringify(f) !== JSON.stringify(NO_FILTERS);
  const onDevice = f.device === 'all' ? 'any handheld' : getHandheld(f.device).name;
  const quickOn = (q: Partial<Filters>) => JSON.stringify({ ...NO_FILTERS, ...q }) === JSON.stringify(f);

  return (
    <section className="flex flex-col gap-4">
      <p className="text-muted-foreground max-w-3xl">Games found by what players reported: the typical frame rate, how long the battery lasted and the most common verdict.</p>

      <div className="flex flex-wrap gap-1.5" aria-label="Quick picks">
        {QUICK.map((q, i) => (
          <button key={q.label} type="button" aria-pressed={quickOn(q.f)} onClick={() => setF(quickOn(q.f) ? NO_FILTERS : { ...NO_FILTERS, ...q.f })}
            className={`inline-flex items-center gap-1.5 min-h-9 px-3 rounded-full border text-sm cursor-pointer transition-colors tabular-nums ${quickOn(q.f) ? 'border-brand bg-brand/15 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {q.label} <span className="text-xs opacity-70">{quickCounts[i]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className="field w-64" aria-label="Handheld" value={f.device} onChange={(e) => setF({ ...f, device: e.target.value })}>
          <option value="all">Any handheld ({gameRows(reports, 'all').length} games)</option>
          {HANDHELDS.map((h) => <option key={h.id} value={h.id}>{h.name} ({deviceGames.get(h.id) ?? 0})</option>)}
        </select>
        <select className="field w-40" aria-label="Frame rate" value={f.fps} onChange={(e) => setF({ ...f, fps: Number(e.target.value) })}>
          <option value={0}>Any frame rate</option>
          {[30, 40, 60].map((n) => <option key={n} value={n}>{n}+ fps</option>)}
        </select>
        <select className="field w-40" aria-label="Battery life" value={f.battery} onChange={(e) => setF({ ...f, battery: Number(e.target.value) })}>
          <option value={0}>Any battery</option>
          {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+ h battery</option>)}
        </select>
        <select className="field w-48" aria-label="Verdict" value={f.verdict} onChange={(e) => setF({ ...f, verdict: e.target.value as Filters['verdict'] })}>
          {VERDICTS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
        <select className="field w-44" aria-label="Sort games" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="reports">Most reports</option>
          <option value="fps">Highest fps</option>
          <option value="battery">Longest battery</option>
          <option value="verdict">Best verdict</option>
        </select>
        {filtered && <button type="button" className="btn-ghost" onClick={() => setF(NO_FILTERS)}>Clear</button>}
      </div>

      {results.length === 0 ? (
        <EmptyState icon="search-x" title={rows.length === 0 ? `No reports on ${onDevice} yet` : 'No games match these filters'}
          body={rows.length === 0 ? 'As players post reports, games show up here.' : `${rows.length} ${rows.length === 1 ? 'game has' : 'games have'} reports on ${onDevice}, but none meet every filter. Loosen one, or clear them.`}>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {filtered && <button type="button" className="btn-outline" onClick={() => setF(NO_FILTERS)}>Clear filters</button>}
            <button type="button" className="btn-ghost" onClick={onNeeds}><Icon name="megaphone" /> Games that need reports</button>
          </div>
        </EmptyState>
      ) : (
        <>
          <p className="caption tabular-nums">{results.length} {results.length === 1 ? 'game' : 'games'} on {onDevice}</p>
          <div className="flex flex-col rounded-2xl border border-border divide-y divide-border overflow-hidden bg-card">
            {results.map((g) => <FinderRow key={g.appId} g={g} />)}
          </div>
        </>
      )}
    </section>
  );
}

function FinderRow({ g }: { g: GameRow }) {
  const v = g.s.verdict ? ratingInfo(g.s.verdict) : null;
  return (
    <a href={`#/game/${g.appId}`} className="flex items-center gap-3 sm:gap-4 p-3 hover:bg-muted/40 transition-colors">
      <GameArt appId={g.appId} name={g.game} className="w-24 sm:w-32 aspect-[460/215] rounded-lg shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <span className="font-medium truncate">{g.game}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums">
          {v && <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${v.tone}`}>{v.label}</span>}
          <span className="inline-flex items-center gap-1"><Icon name="gauge" className="w-3.5 h-3.5 text-sky-400" /> {g.s.fps == null ? '–' : g.s.fps < 30 ? 'Under 30' : `${g.s.fps} fps`}</span>
          <span className="inline-flex items-center gap-1"><Icon name="battery-full" className="w-3.5 h-3.5 text-emerald-400" /> {g.s.battery == null ? 'No battery times' : `${Math.round(g.s.battery * 10) / 10} h`}</span>
          <span className="caption">{g.s.count} {g.s.count === 1 ? 'report' : 'reports'}</span>
        </span>
      </div>
      <Icon name="arrow-right" className="w-4 h-4 text-muted-foreground shrink-0 hidden sm:block" />
    </a>
  );
}

// ───────────────────────── Needs reports ─────────────────────────

// The most-reviewed Steam games that have DeckTune presets but no player report yet: the reports
// that would help the most people.
function NeedsReports({ reports, device }: { reports?: Report[]; device: DeviceId }) {
  const [catalog, failed, retry] = useLoad(loadCatalog, []);
  const [index] = useLoad(loadProfileIndex, []);
  const [limit, setLimit] = useState(12);
  const reported = useMemo(() => new Set((reports ?? []).map((r) => r.appId)), [reports]);
  const presets = useMemo(() => new Map((index ?? []).map((r) => [r[0], r[3]])), [index]);
  const popular = useMemo(() => (catalog?.games ?? [])
    .filter((g) => presets.has(g.appId))
    .sort((a, b) => b.reviews - a.reviews), [catalog, presets]);
  const waiting = popular.filter((g) => !reported.has(g.appId));

  if (failed) return <ErrorRow text="Couldn't load the game list." onRetry={retry} />;
  if (!catalog || !index || !reports) {
    return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-44 rounded-xl" />)}</div>;
  }
  return (
    <section className="flex flex-col gap-4">
      <p className="text-muted-foreground max-w-3xl">
        Popular games with DeckTune presets and no player report yet. Played one on your {getHandheld(device).name}? One report tells everyone whether the preset holds up.
      </p>
      {waiting.length === 0 ? (
        <EmptyState icon="circle-check" title="Every popular game has a report" body="Thanks to everyone who shared. Any game's page still takes more." />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {waiting.slice(0, limit).map((g) => (
              <div key={g.appId} className="flex flex-col rounded-xl overflow-hidden bg-card border border-border">
                <a href={`#/game/${g.appId}`} className="group block">
                  <GameArt appId={g.appId} name={g.name} image={presets.get(g.appId) ?? g.image} className="w-full aspect-[460/215] group-hover:opacity-90 transition-opacity" />
                  <span className="block px-3 pt-2.5 text-sm font-medium truncate group-hover:text-brand-text">{g.name}</span>
                </a>
                <div className="px-3 pb-3 pt-1.5 flex flex-col gap-2">
                  <span className="caption tabular-nums">{g.reviews.toLocaleString('en-US')} Steam reviews</span>
                  <ShareButton game={{ appId: g.appId, name: g.name, hasPresets: true }} device={device} className="btn-outline min-h-9 text-xs px-3" label="Be the first" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-3">
            <p className="caption tabular-nums">Showing {Math.min(limit, waiting.length)} of {waiting.length.toLocaleString('en-US')} games with presets and no reports</p>
            {limit < waiting.length && <button type="button" className="btn-outline" onClick={() => setLimit(limit + 12)}>Show more</button>}
          </div>
        </>
      )}
    </section>
  );
}

function count<K>(reports: Report[], key: (r: Report) => K): Map<K, number> {
  const m = new Map<K, number>();
  for (const r of reports) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return m;
}
