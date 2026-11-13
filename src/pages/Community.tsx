import { useMemo, useState } from 'react';
import { loadReports, type Report } from '../lib/data';
import { HANDHELDS } from '../lib/handhelds';
import { allReportsUrl, RATINGS, REPO } from '../lib/community';
import { useLoad } from '../lib/state';
import { BackLink, EmptyState, ErrorRow, GitHubMark, Icon } from '../components/ui';
import { HowPostingWorks, ReportCard } from '../components/Reports';

const PAGE = 20;

// Every player report, newest first: the open place to see how games run on real handhelds.
export function CommunityPage() {
  const [data, failed, retry] = useLoad(loadReports, []);
  const [device, setDevice] = useState('all');
  const [rating, setRating] = useState('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const reports = data?.reports ?? [];

  const deviceCounts = useMemo(() => count(reports, (r) => r.device), [reports]);
  const ratingCounts = useMemo(() => count(reports, (r) => r.rating), [reports]);
  const term = search.trim().toLowerCase();
  const visible = reports
    .filter((r) => device === 'all' || r.device === device)
    .filter((r) => rating === 'all' || r.rating === rating)
    .filter((r) => !term || r.game.toLowerCase().includes(term))
    .sort((a, b) => b.created.localeCompare(a.created));
  const players = new Set(reports.map((r) => r.user)).size;
  const games = new Set(reports.map((r) => r.appId)).size;
  const filtered = device !== 'all' || rating !== 'all' || term.length > 0;

  return (
    <div className="flex flex-col gap-8 pt-2 fade-in">
      <BackLink />
      <div className="flex flex-col gap-3 max-w-3xl">
        <span className="self-start inline-flex items-center rounded-full border border-brand/50 bg-brand/10 px-3 py-1 eyebrow text-brand-text">Open to everyone</span>
        <h1 className="font-heading font-bold uppercase leading-[0.95] text-4xl sm:text-5xl">Player reports</h1>
        <p className="text-lg text-muted-foreground">
          How games really run on Steam Decks and ROG Allys, measured by the people playing them. Open any game to share your own frame rate, battery life and settings.
        </p>
        {data && reports.length > 0 && (
          <p className="text-sm text-muted-foreground tabular-nums">{reports.length} reports on {games} {games === 1 ? 'game' : 'games'} from {players} {players === 1 ? 'player' : 'players'}</p>
        )}
      </div>

      {failed ? <ErrorRow text="Couldn't load the reports." onRetry={retry} />
        : !data ? <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-56 rounded-2xl" />)}</div>
          : reports.length === 0 ? (
            <EmptyState icon="users" title="No reports yet" body="Be the first: open a game you've played, then press Share your report.">
              <a href="#/" className="btn-primary mt-2"><Icon name="search" /> Find a game</a>
              <div className="pt-2"><HowPostingWorks /></div>
            </EmptyState>
          ) : (
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <HowPostingWorks />
                {REPO && <a className="btn-ghost" href={allReportsUrl()} target="_blank" rel="noreferrer"><GitHubMark /> All reports on GitHub</a>}
              </div>
            </section>
          )}
    </div>
  );
}

function count<K>(reports: Report[], key: (r: Report) => K): Map<K, number> {
  const m = new Map<K, number>();
  for (const r of reports) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return m;
}

