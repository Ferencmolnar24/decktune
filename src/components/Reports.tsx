import { useMemo, useState } from 'react';
import type { Report } from '../lib/data';
import { getHandheld, HANDHELDS, type DeviceId } from '../lib/handhelds';
import { RATINGS, ratingInfo, summarize, timeAgo } from '../lib/community';
import { deleteSiteReport, flagReport, refreshReports, SITE_POSTING, useMyReports, voteHelpful } from '../lib/reports';
import { settingsChips } from '../lib/settings';
import { useStored } from '../lib/state';
import { ReportForm, type ReportGame } from './ReportForm';
import { Icon } from './ui';

const SMALL_BTN = 'inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer disabled:cursor-default disabled:opacity-60';

export function ReportCard({ report, showGame = false }: { report: Report; showGame?: boolean }) {
  const r = report;
  const rating = ratingInfo(r.rating);
  const [open, setOpen] = useState(false);
  const chips = settingsChips(r.setup);
  const other = r.setup.other ?? '';
  const long = other.length + r.notes.length > 360;

  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-card border border-border p-4 sm:p-5 min-w-0">
      <header className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-brand/15 text-brand-text font-semibold flex items-center justify-center shrink-0" aria-hidden="true">{(r.user.trim()[0] ?? 'G').toUpperCase()}</div>
        <div className="flex-1 min-w-0">
          {showGame && <a href={`#/game/${r.appId}`} className="font-semibold hover:text-brand-text block truncate">{r.game}</a>}
          <p className="text-sm"><span className="font-medium">{r.user}</span> <span className="text-muted-foreground">· {getHandheld(r.device).name}{r.os ? ` · ${r.os}` : ''}</span></p>
          <p className="caption">{timeAgo(r.created)}{r.edited && ' · edited'}</p>
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
            <Icon name="battery-full" className="w-4 h-4 text-emerald-400" /> {r.battery >= 6 ? '6+' : r.battery} h
          </span>
        )}
      </div>

      <div className={`flex flex-col gap-2 text-sm ${long && !open ? 'max-h-36 overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]' : ''}`}>
        {(chips.length > 0 || other) && (
          <div>
            <p className="eyebrow text-muted-foreground mb-1.5">Settings</p>
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => <span key={c} className="rounded-md border border-border px-2 py-0.5 text-xs font-medium tabular-nums">{c}</span>)}
              </div>
            )}
            {other && <p className="whitespace-pre-wrap break-words mt-1.5">{other}</p>}
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

      <CardActions report={r} />
    </article>
  );
}

// The row under a report: "Helpful", and either Edit / Delete (on the browser that posted it) or
// Flag (for everyone else). Delete and Flag ask once, in place, before they act.
function CardActions({ report }: { report: Report }) {
  const [mine, setMine] = useMyReports();
  const [flagged, setFlagged] = useStored<number[]>('flagged-reports', []);
  const [asking, setAsking] = useState<'' | 'delete' | 'flag'>('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const key = mine[report.id];
  const isFlagged = flagged.includes(report.id);

  async function act(kind: 'delete' | 'flag') {
    setBusy(true);
    setError('');
    try {
      if (kind === 'delete') {
        await deleteSiteReport(report.id, key);
        setMine((m) => Object.fromEntries(Object.entries(m).filter(([id]) => id !== String(report.id))));
        refreshReports();
      } else {
        const hidden = await flagReport(report.id);
        setFlagged((f) => [...f, report.id]);
        if (hidden) refreshReports();
      }
      setAsking('');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (asking) {
    const del = asking === 'delete';
    return (
      <footer className="flex flex-col gap-2.5 pt-3 border-t border-border/60 mt-auto fade-in" role="group" aria-label={del ? 'Delete your report' : 'Flag this report'}>
        <p className="text-sm">
          {del ? 'Delete your report? This can’t be undone.' : 'Flag this report as spam, abusive or clearly wrong? A report flagged by 3 people is hidden until it’s checked.'}
        </p>
        {error && <p className="text-xs text-rose-300">{error}</p>}
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => act(asking)}
            className={`${SMALL_BTN} ${del ? 'border-rose-500/50 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25' : 'border-amber-400/50 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20'}`}>
            <Icon name={busy ? 'loader-circle' : del ? 'trash-2' : 'flag'} className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            {del ? 'Delete report' : 'Flag it'}
          </button>
          <button type="button" className={`${SMALL_BTN} border-border text-muted-foreground hover:text-foreground`} onClick={() => { setAsking(''); setError(''); }}>
            {del ? 'Keep it' : 'Cancel'}
          </button>
        </div>
      </footer>
    );
  }

  return (
    <footer className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-3 border-t border-border/60 mt-auto">
      <HelpfulButton report={report} />
      {error && <span className="text-rose-300">{error}</span>}
      <span className="ml-auto flex gap-1.5">
        {key ? (
          <>
            <button type="button" className={`${SMALL_BTN} border-transparent hover:bg-muted hover:text-foreground`} onClick={() => setEditing(true)}>
              <Icon name="pencil" className="w-3.5 h-3.5" /> Edit
            </button>
            <button type="button" className={`${SMALL_BTN} border-transparent hover:bg-rose-500/10 hover:text-rose-200`} onClick={() => setAsking('delete')}>
              <Icon name="trash-2" className="w-3.5 h-3.5" /> Delete
            </button>
          </>
        ) : isFlagged ? (
          <span className="inline-flex items-center gap-1.5 min-h-9 px-2"><Icon name="flag" className="w-3.5 h-3.5 text-amber-300" /> Flagged, thanks</span>
        ) : (
          <button type="button" className={`${SMALL_BTN} border-transparent hover:bg-muted hover:text-foreground`} onClick={() => setAsking('flag')}>
            <Icon name="flag" className="w-3.5 h-3.5" /> Flag
          </button>
        )}
      </span>
      {editing && key && <ReportForm edit={{ report, key }} device={report.device} onClose={() => setEditing(false)} />}
    </footer>
  );
}

// "Helpful": one vote per visitor, counted by the database.
function HelpfulButton({ report }: { report: Report }) {
  const [voted, setVoted] = useStored<number[]>('helpful-votes', []);
  const [count, setCount] = useState(report.helpful);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const done = voted.includes(report.id);
  return (
    <>
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
        className={`${SMALL_BTN} tabular-nums disabled:opacity-100 ${done ? 'border-brand/40 bg-brand/10 text-brand-text' : 'border-border hover:border-brand hover:text-foreground'}`}
      >
        <Icon name={busy ? 'loader-circle' : 'thumbs-up'} className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
        {done ? 'Helpful' : 'Helpful?'} · {count}
      </button>
      {failed && <span className="text-rose-300">Couldn’t save your vote. Try again.</span>}
    </>
  );
}

export function ShareButton({ game, device, className = 'btn-primary', label = 'Share your report' }: { game?: ReportGame; device: DeviceId; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <Icon name="pen-line" /> {label}
      </button>
      {open && <ReportForm game={game} device={device} onClose={() => setOpen(false)} />}
    </>
  );
}

export function HowPostingWorks() {
  return (
    <p className="caption flex items-start gap-2">
      <Icon name="users" className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>
        {SITE_POSTING
          ? 'Post right here in about a minute, no account needed. Reports go live straight away, and you can edit or delete yours from this browser.'
          : 'Posting isn’t switched on for this copy of DeckTune.'}
      </span>
    </p>
  );
}

// A game's reports: the verdict at a glance, then the reports themselves, filterable by handheld.
// With no battery times reported yet, the battery tile shows the Optimal preset's estimate instead.
export function GameReports({ game, reports, device, batteryEstimate }: {
  game: ReportGame; reports: Report[]; device: DeviceId; batteryEstimate?: string;
}) {
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
  const battery = s.battery != null
    ? { value: `${Math.round(s.battery * 10) / 10} h` }
    : batteryEstimate ? { value: batteryEstimate.replace(/^About /, '≈ '), note: `Optimal preset estimate, ${getHandheld(device).shortName}` } : { value: '–' };

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
          {batteryEstimate && <p className="caption tabular-nums">Until then: the Optimal preset should last {batteryEstimate.toLowerCase()} on a {getHandheld(device).name} (an estimate).</p>}
          <HowPostingWorks />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
            <div className="grid grid-cols-3 gap-2">
              <SummaryTile label="Reports" value={String(s.count)} />
              <SummaryTile label="Typical fps" value={s.fps == null ? '–' : s.fps < 30 ? 'Under 30' : String(s.fps)} />
              <SummaryTile label="Battery" value={battery.value} note={battery.note} />
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
            {visible.map((r) => <ReportCard key={r.id} report={r} />)}
          </div>
          <HowPostingWorks />
        </>
      )}
    </section>
  );
}

function SummaryTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="card rounded-xl p-3 flex flex-col justify-center min-w-0">
      <p className="caption">{label}</p>
      <p className="font-heading text-2xl font-bold tabular-nums leading-tight">{value}</p>
      {note && <p className="text-[11px] leading-tight text-muted-foreground mt-0.5">{note}</p>}
    </div>
  );
}
