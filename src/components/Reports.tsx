import { useMemo, useState } from 'react';
import type { Report } from '../lib/data';
import { getHandheld, HANDHELDS, type DeviceId } from '../lib/handhelds';
import { RATINGS, ratingInfo, reportUrl, summarize, timeAgo } from '../lib/community';
import { SITE_POSTING, voteHelpful } from '../lib/reports';
import { settingsChips } from '../lib/settings';
import { useStored } from '../lib/state';
import { ReportForm, type ReportGame } from './ReportForm';
import { Icon } from './ui';

export function ReportCard({ report, showGame = false }: { report: Report; showGame?: boolean }) {
  const r = report;
  const rating = ratingInfo(r.rating);
  const [open, setOpen] = useState(false);
  const chips = r.setup ? settingsChips(r.setup) : [];
  const other = r.setup?.other ?? '';
  const long = r.settings.length + other.length + r.notes.length > 360;

  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-card border border-border p-4 sm:p-5 min-w-0">
      <header className="flex items-start gap-3">
        {r.avatar
          ? <img src={`${r.avatar}${r.avatar.includes('?') ? '&' : '?'}s=64`} alt="" className="w-9 h-9 rounded-full bg-muted shrink-0" loading="lazy" />
          : <div className="w-9 h-9 rounded-full bg-brand/15 text-brand-text font-semibold flex items-center justify-center shrink-0" aria-hidden="true">{(r.user.trim()[0] ?? 'G').toUpperCase()}</div>}
        <div className="flex-1 min-w-0">
          {showGame && <a href={`#/game/${r.appId}`} className="font-semibold hover:text-brand-text block truncate">{r.game}</a>}
          <p className="text-sm"><span className="font-medium">{r.user}</span>{r.guest && <span className="caption"> (guest)</span>} <span className="text-muted-foreground">· {getHandheld(r.device).name}{r.os ? ` · ${r.os}` : ''}</span></p>
          <p className="caption">{timeAgo(r.created)}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${rating.tone}`}>{rating.label}</span>
      </header>

      <div className="flex gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 text-sm font-semibold tabular-nums">
          <Icon name="gauge" className="w-4 h-4 text-sky-400" /> {r.fpsText} fps
        </span>
        {r.preset && r.preset !== 'My own settings' && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand/10 px-2.5 py-1 text-sm font-medium text-brand-text">
            <Icon name="sliders-horizontal" className="w-4 h-4" /> DeckTune {r.preset} preset
          </span>
        )}
        {r.battery != null && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 text-sm font-semibold tabular-nums">
            <Icon name="battery-full" className="w-4 h-4 text-emerald-400" /> {r.battery} h
          </span>
        )}
      </div>

      <div className={`flex flex-col gap-2 text-sm ${long && !open ? 'max-h-36 overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]' : ''}`}>
        {(chips.length > 0 || other || r.settings) && (
          <div>
            <p className="eyebrow text-muted-foreground mb-1.5">Settings</p>
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => <span key={c} className="rounded-md border border-border px-2 py-0.5 text-xs font-medium tabular-nums">{c}</span>)}
              </div>
            )}
            {other && <p className="whitespace-pre-wrap break-words mt-1.5">{other}</p>}
            {r.settings && <p className="whitespace-pre-wrap break-words">{r.settings}</p>}
          </div>
        )}
        {r.notes && (
          <div>
            <p className="eyebrow text-muted-foreground mb-1">Notes</p>
            <p className="whitespace-pre-wrap break-words text-muted-foreground">{r.notes}</p>
          </div>
        )}
      </div>
      {long && <button type="button" className="btn-ghost self-start -ml-3 text-brand-text" onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Read all'}</button>}

      {r.source === 'site' ? <HelpfulRow report={r} /> : (
        <footer className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/60 mt-auto">
          <span className="inline-flex items-center gap-1.5 pt-3 tabular-nums" title="People who found this helpful (thumbs up on GitHub)">
            <Icon name="thumbs-up" className="w-3.5 h-3.5" /> {r.helpful}
          </span>
          <span className="inline-flex items-center gap-1.5 pt-3 tabular-nums">
            <Icon name="message-circle" className="w-3.5 h-3.5" /> {r.comments ?? 0}
          </span>
          <a href={reportUrl(r.id)} target="_blank" rel="noreferrer" className="ml-auto pt-3 inline-flex items-center gap-1.5 hover:text-foreground">
            Reply or vote on GitHub <Icon name="external-link" className="w-3.5 h-3.5" />
          </a>
        </footer>
      )}
    </article>
  );
}

export function ShareButton({ game, device, className = 'btn-primary' }: { game?: ReportGame; device: DeviceId; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <Icon name="pen-line" /> Share your report
      </button>
      {open && <ReportForm game={game} device={device} onClose={() => setOpen(false)} />}
    </>
  );
}

// "Helpful" on a report posted on DeckTune: one vote per visitor, counted by the database.
function HelpfulRow({ report }: { report: Report }) {
  const [voted, setVoted] = useStored<number[]>('helpful-votes', []);
  const [count, setCount] = useState(report.helpful);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const done = voted.includes(report.id);
  return (
    <footer className="flex items-center gap-3 text-xs text-muted-foreground pt-3 border-t border-border/60 mt-auto">
      <button
        type="button"
        disabled={done || busy}
        aria-pressed={done}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          try {
            setCount(await voteHelpful(report.id));
            setVoted((v) => [...v, report.id]);
          } catch {
            setFailed(true);
          } finally {
            setBusy(false);
          }
        }}
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border transition-colors tabular-nums ${done ? 'border-brand/40 bg-brand/10 text-brand-text' : 'border-border hover:border-brand hover:text-foreground cursor-pointer'}`}
      >
        <Icon name={busy ? 'loader-circle' : 'thumbs-up'} className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
        {done ? 'Helpful' : 'Helpful?'} · {count}
      </button>
      {failed && <span className="text-rose-300">Couldn't save your vote. Try again.</span>}
    </footer>
  );
}

export function HowPostingWorks() {
  return (
    <p className="caption flex items-start gap-2">
      <Icon name="users" className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>
        {SITE_POSTING
          ? 'Post right here in about a minute, no account needed. Reports go live straight away; mark the ones that helped you.'
          : 'Reports are posted with a free GitHub account and show up here a few minutes later. Anyone can read them; reply or give a thumbs up on GitHub.'}
      </span>
    </p>
  );
}

// A game's reports: the verdict at a glance, then the reports themselves, filterable by handheld.
export function GameReports({ game, reports, device }: { game: ReportGame; reports: Report[]; device: DeviceId }) {
  const present = useMemo(() => {
    const m = new Map<DeviceId, number>();
    for (const r of reports) m.set(r.device, (m.get(r.device) ?? 0) + 1);
    return m;
  }, [reports]);
  // Start on the visitor's handheld when there are reports for it.
  const [filter, setFilter] = useState<string>(present.has(device) ? device : 'all');
  const [sort, setSort] = useState('newest');
  const choice = filter !== 'all' && !present.has(filter as DeviceId) ? 'all' : filter;

  const visible = reports
    .filter((r) => choice === 'all' || r.device === choice)
    .sort((a, b) => sort === 'helpful' ? b.helpful - a.helpful || b.created.localeCompare(a.created)
      : sort === 'fps' ? b.fps - a.fps
        : b.created.localeCompare(a.created));
  const s = summarize(visible);

  return (
    <section className="flex flex-col gap-4" id="reports">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-2xl font-semibold">Player reports</h2>
          <p className="text-muted-foreground">What players measured on their own handhelds.</p>
        </div>
        <ShareButton game={game} device={device} />
      </div>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 sm:p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center">
            <Icon name="users" className="w-6 h-6 text-brand-text" />
          </div>
          <p className="font-heading text-lg font-semibold">No reports for this game yet</p>
          <p className="text-muted-foreground max-w-md">Played it on a Steam Deck or ROG Ally? Share your frame rate, battery life and the settings you used, so the next player doesn't have to guess.</p>
          <HowPostingWorks />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
            <div className="grid grid-cols-3 gap-2">
              <SummaryTile label="Reports" value={String(s.count)} />
              <SummaryTile label="Typical fps" value={s.fps == null ? '–' : s.fps < 30 ? 'Under 30' : String(s.fps)} />
              <SummaryTile label="Battery" value={s.battery == null ? '–' : `${Math.round(s.battery * 10) / 10} h`} />
            </div>
            <div className="card rounded-xl p-3 flex flex-col gap-1.5">
              {RATINGS.map((x) => {
                const n = s.counts.get(x.id) ?? 0;
                return (
                  <div key={x.id} className="flex items-center gap-2 text-xs">
                    <span className="w-20 text-muted-foreground">{x.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${x.bar}`} style={{ width: s.count ? `${(n / s.count) * 100}%` : '0%' }} />
                    </div>
                    <span className="w-6 text-right tabular-nums">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select className="field w-64" aria-label="Filter reports by handheld" value={choice} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All handhelds ({reports.length})</option>
              {HANDHELDS.map((h) => <option key={h.id} value={h.id} disabled={!present.has(h.id)}>{h.name} ({present.get(h.id) ?? 0})</option>)}
            </select>
            <select className="field w-44" aria-label="Sort reports" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="helpful">Most helpful</option>
              <option value="fps">Highest fps</option>
            </select>
            {choice !== 'all' && <button type="button" className="btn-ghost" onClick={() => setFilter('all')}>Show all handhelds</button>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visible.map((r) => <ReportCard key={r.key} report={r} />)}
          </div>
          <HowPostingWorks />
        </>
      )}
    </section>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card rounded-xl p-3 flex flex-col justify-center">
      <p className="caption">{label}</p>
      <p className="font-heading text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
