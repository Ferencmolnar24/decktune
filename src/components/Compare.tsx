// "Which handheld should I play this on?": two handhelds side by side for one game, from DeckTune's
// presets (frame rate, battery estimate, settings) and from what players reported on each.
import { useState, type ReactNode } from 'react';
import type { Report } from '../lib/data';
import { getHandheld, HANDHELDS, type DeckModel, type DeviceId } from '../lib/handhelds';
import { midFps, PROFILE_KINDS, viewForDevice, type DeckVerified, type GameProfiles, type ProfileKind, type ProfileView } from '../lib/profiles';
import { batteryFor, batteryMid, batteryRange } from '../lib/battery';
import { ratingInfo, summarize } from '../lib/community';
import { Icon } from './ui';

const KIND_LABEL: Record<ProfileKind, string> = { MaxBattery: 'Max Battery', Optimal: 'Optimal', MaxPerformance: 'Max Performance' };

const otherFamily = (d: DeviceId): DeviceId => (getHandheld(d).family === 'deck' ? 'ally' : 'oled');

interface Side {
  device: DeviceId;
  view: ProfileView | null;
  battery: string | null;
  batteryHours: number | null;
  players: ReturnType<typeof summarize>;
}

const sys = (v: ProfileView | null, ...labels: string[]) => v?.system.find((s) => labels.includes(s.label))?.value ?? null;

export function CompareHandhelds({ profiles, verified, reports, device, own }: {
  profiles: GameProfiles | null;
  verified: DeckVerified;
  reports: Report[];
  device: DeviceId;
  own: { device: DeviceId; model: DeckModel; health: number };
}) {
  const [a, setA] = useState<DeviceId>(device);
  const [b, setB] = useState<DeviceId>(otherFamily(device));
  const [kind, setKind] = useState<ProfileKind>('Optimal');

  const side = (d: DeviceId): Side => {
    const set = profiles ? viewForDevice(profiles, d, verified) : null;
    const view = set ? set[kind] : null;
    const { wh } = batteryFor(d, own);
    return {
      device: d,
      view,
      battery: view ? batteryRange(wh, view.drawWatts) : null,
      batteryHours: view ? batteryMid(wh, view.drawWatts) : null,
      players: summarize(reports.filter((r) => r.device === d)),
    };
  };
  const L = side(a);
  const R = side(b);

  // Players' numbers win over estimates when both handhelds have them.
  const fpsOf = (s: Side) => (L.players.fps != null && R.players.fps != null ? s.players.fps : s.view ? midFps(s.view.expectedFps, 0) : null);
  const batOf = (s: Side) => (L.players.battery != null && R.players.battery != null ? s.players.battery : s.batteryHours);
  const better = (x: number | null, y: number | null) => (x == null || y == null || Math.abs(x - y) < Math.max(x, y) * 0.1 ? 0 : x > y ? -1 : 1);
  const fpsWin = better(fpsOf(L), fpsOf(R));
  const batWin = better(batOf(L), batOf(R));

  const name = (s: Side) => getHandheld(s.device).shortName;
  const verdict = (() => {
    if (a === b) return 'Pick two different handhelds to compare.';
    if (!L.view && !R.view && !L.players.count && !R.players.count) return 'Neither handheld has presets or player reports for this game yet.';
    const fast = fpsWin === 0 ? null : fpsWin < 0 ? L : R;
    const long = batWin === 0 ? null : batWin < 0 ? L : R;
    const fps = (s: Side) => Math.round(fpsOf(s) ?? 0);
    const hrs = (s: Side) => `${Math.round((batOf(s) ?? 0) * 2) / 2} h`;
    const slow = fast === L ? R : L;
    const short = long === L ? R : L;
    if (fast && long && fast === long) return `The ${name(fast)} should run faster (about ${fps(fast)} vs ${fps(slow)} fps) and last longer (about ${hrs(fast)} vs ${hrs(slow)}).`;
    const parts: string[] = [];
    if (fast) parts.push(`the ${name(fast)} should run faster (about ${fps(fast)} vs ${fps(slow)} fps)`);
    if (long) parts.push(`the ${name(long)} should last longer (about ${hrs(long)} vs ${hrs(short)})`);
    if (parts.length === 0) return 'They should play about the same: pick the one you prefer holding.';
    const sentence = parts.join(', while ');
    return sentence[0].toUpperCase() + sentence.slice(1) + '.';
  })();

  const deckOrAlly = (s: Side) => (getHandheld(s.device).family === 'deck' ? s.view?.compat ? `SteamOS · ${s.view.compat}` : 'SteamOS' : 'Windows 11, natively');
  const rows: { label: string; icon: string; cell: (s: Side) => ReactNode; win?: number }[] = [
    {
      label: 'Frame rate', icon: 'gauge', win: fpsWin,
      cell: (s) => <Value main={s.view?.expectedFps} sub={s.players.fps != null ? `Players: ${s.players.fps < 30 ? 'under 30' : s.players.fps} fps` : undefined} />,
    },
    {
      label: 'Battery', icon: 'battery-full', win: batWin,
      cell: (s) => <Value main={s.battery ? `${s.battery} (est.)` : undefined} sub={s.players.battery != null ? `Players: ${Math.round(s.players.battery * 10) / 10} h` : undefined} />,
    },
    {
      label: 'Player verdict', icon: 'users',
      cell: (s) => s.players.verdict
        ? <span className="flex flex-wrap items-center gap-1.5"><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${ratingInfo(s.players.verdict).tone}`}>{ratingInfo(s.players.verdict).label}</span><span className="caption tabular-nums">{s.players.count} {s.players.count === 1 ? 'report' : 'reports'}</span></span>
        : <span className="text-muted-foreground">No reports yet</span>,
    },
    { label: 'Power', icon: 'cpu', cell: (s) => <Value main={s.view?.power} /> },
    { label: 'Frame cap', icon: 'timer', cell: (s) => <Value main={sys(s.view, 'Frame limit', 'Frame cap')} /> },
    { label: 'Resolution', icon: 'monitor', cell: (s) => <Value main={s.view?.resolution} /> },
    { label: 'Upscaling', icon: 'scaling', cell: (s) => <Value main={sys(s.view, 'Scaling filter', 'Upscaling')} /> },
    { label: 'Runs on', icon: 'package', cell: (s) => <Value main={deckOrAlly(s)} /> },
  ];

  return (
    <section className="flex flex-col gap-4" aria-labelledby="compare-title">
      <div className="flex flex-col gap-1">
        <h2 id="compare-title" className="font-heading text-2xl font-semibold">Deck or Ally?</h2>
        <p className="text-muted-foreground">Two handhelds side by side for this game: DeckTune's preset, its battery estimate and what players measured.</p>
      </div>

      <div className="card p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <select className="field flex-1 min-w-40" aria-label="First handheld" value={a} onChange={(e) => setA(e.target.value as DeviceId)}>
            {HANDHELDS.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <button type="button" className="btn-ghost btn-icon" aria-label="Swap handhelds" onClick={() => { setA(b); setB(a); }}>
            <Icon name="arrow-right-left" />
          </button>
          <select className="field flex-1 min-w-40" aria-label="Second handheld" value={b} onChange={(e) => setB(e.target.value as DeviceId)}>
            {HANDHELDS.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        {profiles && (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Preset to compare">
            {PROFILE_KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                className={`h-9 px-3 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${kind === k ? 'border-brand bg-brand/15 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        )}

        <p className="flex items-start gap-2 rounded-xl bg-brand/10 border border-brand/30 px-3.5 py-2.5 text-sm">
          <Icon name="trophy" className="w-4 h-4 text-brand-text shrink-0 mt-0.5" />
          <span>{verdict}</span>
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-[minmax(7rem,auto)_minmax(0,1fr)_minmax(0,1fr)] text-sm rounded-xl border border-border overflow-hidden">
          <div className="bg-muted/40 px-3 py-2.5 hidden sm:block" />
          {[L, R].map((s, i) => (
            <div key={i} className={`bg-muted/40 px-3 py-2.5 font-heading font-semibold border-border min-w-0 ${i === 0 ? 'sm:border-l' : 'border-l'}`}>{getHandheld(s.device).name}</div>
          ))}
          {rows.map((row) => (
            <Row key={row.label} label={row.label} icon={row.icon}>
              {[L, R].map((s, i) => {
                const won = row.win != null && row.win === (i === 0 ? -1 : 1);
                return (
                  <div key={i} className={`px-3 py-2.5 border-border min-w-0 break-words sm:border-t ${i === 0 ? 'sm:border-l' : 'border-l'} ${won ? 'bg-emerald-400/5' : ''}`}>
                    <div className="flex items-start gap-1.5">
                      <div className="flex-1 min-w-0">{row.cell(s)}</div>
                      {won && <Icon name="circle-check" className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                    </div>
                  </div>
                );
              })}
            </Row>
          ))}
        </div>
        <p className="caption">Battery figures are estimates from each preset's power draw and the handheld's battery ({own.model.name} for yours, a stock model for the other). Ally presets are converted from the Deck's; player reports show what really happened.</p>
      </div>
    </section>
  );
}

function Row({ label, icon, children }: { label: string; icon: string; children: ReactNode }) {
  return (
    <>
      <div className="col-span-2 sm:col-span-1 px-3 pt-2.5 pb-0 sm:pb-2.5 border-t border-border text-muted-foreground text-xs sm:text-sm flex items-start gap-1.5">
        <Icon name={icon} className="w-3.5 h-3.5 shrink-0 mt-0.5 hidden sm:block" />
        <span>{label}</span>
      </div>
      {children}
    </>
  );
}

function Value({ main, sub }: { main?: string | null; sub?: string }) {
  return (
    <>
      <p className={main ? 'font-medium tabular-nums' : 'text-muted-foreground'}>{main ?? 'No preset'}</p>
      {sub && <p className="caption tabular-nums">{sub}</p>}
    </>
  );
}
