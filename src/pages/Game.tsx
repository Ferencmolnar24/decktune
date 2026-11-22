import { useEffect, useState } from 'react';
import { catalogById, loadFacts, loadProfileIndex, loadProfiles, type GameFacts } from '../lib/data';
import { loadPresetFeedback, tallyKey, votePreset, useReports, type PresetFeedback } from '../lib/reports';
import { getHandheld, isAlly, type DeckModel, type DeviceId } from '../lib/handhelds';
import { PROFILE_KINDS, viewForDevice, type GameProfiles, type ProfileKind, type ProfileView, type ProfileViewSet } from '../lib/profiles';
import { batteryFor, batteryRange } from '../lib/battery';
import { useLoad, useStored } from '../lib/state';
import { useBatteryHealth, useLibrary, useModel } from '../lib/library';
import { useDevice } from '../App';
import { BackLink, CopyButton, DeckVerifiedLine, EmptyState, ErrorRow, GameArt, Icon, Stat, TierBadge } from '../components/ui';
import { GameReports, HowPostingWorks, ShareButton } from '../components/Reports';
import { CompareHandhelds } from '../components/Compare';

// The visitor's handheld, model and battery health: what every battery estimate is worked out for.
type Own = { device: DeviceId; model: DeckModel; health: number };

interface GameInfo { appId: number; name: string; image?: string; hasProfiles: boolean }

async function loadGame(appId: number): Promise<GameInfo | null> {
  const index = await loadProfileIndex();
  const row = index.find((r) => r[0] === appId);
  // Games with presets carry their name and art in the small index; only others need the catalog.
  if (row) return { appId, name: row[1], image: row[3], hasProfiles: true };
  const catalog = await catalogById().catch(() => null);
  const meta = catalog?.get(appId);
  const name = meta?.name ?? row?.[1];
  return name ? { appId, name, image: meta?.image, hasProfiles: !!row } : null;
}

export function GamePage({ appId }: { appId: number }) {
  const [device, setDevice] = useDevice();
  const [game, failed, retry] = useLoad(() => loadGame(appId), [appId]);
  const [facts] = useLoad(loadFacts, []);
  const [reports] = useReports();
  const [profiles, profilesFailed, retryProfiles] = useLoad(
    () => (game?.hasProfiles ? loadProfiles(appId) : Promise.resolve(null)), [appId, game?.hasProfiles]);
  const [health] = useBatteryHealth();
  const [model] = useModel(device);
  const { has, toggle } = useLibrary();

  useEffect(() => {
    if (game) document.title = `${game.name} · DeckTune`;
    return () => {
      document.title = 'DeckTune: Steam Deck & ROG Ally settings for every game';
    };
  }, [game]);

  if (failed) return <div className="pt-6 flex flex-col gap-4"><BackLink /><ErrorRow text="Couldn't load this game." onRetry={retry} /></div>;
  if (game === undefined) {
    return (
      <div className="pt-2 flex flex-col gap-6">
        <BackLink />
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    );
  }
  if (game === null) {
    return (
      <div className="pt-2 flex flex-col gap-6">
        <BackLink />
        <EmptyState icon="search-x" title="DeckTune doesn't know this game" body="It may be a DLC, a soundtrack or not released yet. Search for the game from the home page." />
      </div>
    );
  }

  const f = facts?.get(appId);
  const saved = has(appId);
  const gameReports = (reports ?? []).filter((r) => r.appId === appId);
  const own: Own = { device, model, health };
  const ownSet = profiles ? viewForDevice(profiles, device, f?.deck ?? 0) : null;
  const batteryEstimate = ownSet ? batteryRange(batteryFor(device, own).wh, ownSet.Optimal.drawWatts) : undefined;
  const reportGame = { appId: game.appId, name: game.name, hasPresets: game.hasProfiles };

  return (
    <div className="flex flex-col gap-8 pt-2 fade-in">
      <BackLink />

      <div className="relative rounded-2xl overflow-hidden border border-border">
        <div className="absolute inset-0 opacity-30 blur-sm scale-110">
          <GameArt appId={appId} name={game.name} image={game.image} className="w-full h-full" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/30" />
        <div className="relative flex flex-col md:flex-row gap-6 p-5 sm:p-8 items-start md:items-center">
          <GameArt appId={appId} name={game.name} image={game.image} className="w-full md:w-80 aspect-[460/215] rounded-xl shadow-2xl shadow-black/50 shrink-0" />
          <div className="flex flex-col gap-4 min-w-0 flex-1">
            <h1 className="font-heading text-3xl sm:text-4xl font-bold leading-tight">{game.name}</h1>
            <Facts facts={f} loaded={!!facts} />
            <div className="flex gap-2 flex-wrap">
              <button type="button" className={saved ? 'btn-outline' : 'btn-primary'} onClick={() => toggle(game)}>
                <Icon name={saved ? 'bookmark-check' : 'bookmark-plus'} />
                {saved ? 'In your library' : 'Add to library'}
              </button>
              <a className="btn-ghost" href="#reports" onClick={(e) => { e.preventDefault(); document.getElementById('reports')?.scrollIntoView({ behavior: 'smooth' }); }}>
                <Icon name="users" /> Player reports ({gameReports.length})
              </a>
              <a className="btn-ghost" href={`https://www.protondb.com/app/${appId}`} target="_blank" rel="noreferrer">ProtonDB</a>
              <a className="btn-ghost" href={`https://store.steampowered.com/app/${appId}`} target="_blank" rel="noreferrer">Steam</a>
            </div>
          </div>
        </div>
      </div>

      {!game.hasProfiles ? <NoPresets game={game} device={device} />
        : profilesFailed ? <ErrorRow text="Couldn't load this game's presets." onRetry={retryProfiles} />
          : !profiles ? <div className="skeleton h-72 rounded-2xl" />
            : <Presets profiles={profiles} game={reportGame} device={device} facts={f} own={own} onSwitch={setDevice} />}

      {(profiles || gameReports.length > 0) && (
        <CompareHandhelds key={device} profiles={profiles ?? null} verified={f?.deck ?? 0} reports={gameReports} device={device} own={own} />
      )}

      <GameReports game={reportGame} reports={gameReports} device={device} batteryEstimate={batteryEstimate} />
    </div>
  );
}

function Facts({ facts, loaded }: { facts?: GameFacts; loaded: boolean }) {
  if (!loaded) return <div className="flex gap-2"><div className="skeleton h-7 w-28 rounded-full" /><div className="skeleton h-7 w-36 rounded-full" /></div>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap items-center">
        <TierBadge tier={facts?.tier || 'unrated'} large />
        <span className="caption">
          {facts?.tier ? `${facts.reports.toLocaleString('en-US')} ProtonDB reports · ${facts.confidence} confidence · trending ${facts.trending}` : facts ? 'No ProtonDB reports yet' : 'ProtonDB rating not tracked for this game yet'}
        </span>
      </div>
      <DeckVerifiedLine facts={facts} />
    </div>
  );
}

function NoPresets({ game, device }: { game: GameInfo; device: DeviceId }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-card border border-border p-8 sm:p-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center">
        <Icon name="sliders-horizontal" className="w-7 h-7 text-brand-text" />
      </div>
      <h2 className="font-heading text-xl font-semibold">No DeckTune presets for this game yet</h2>
      <p className="text-muted-foreground max-w-lg">
        Player reports below are the best guide for now. If you've played it, share the settings that worked on your {getHandheld(device).name}, and see <a className="text-brand-text hover:underline" href="#/guide">Tune it yourself</a> for a method that works for any game.
      </p>
      <ShareButton game={{ appId: game.appId, name: game.name, hasPresets: game.hasProfiles }} device={device} />
      <HowPostingWorks />
    </div>
  );
}

const LOOK: Record<ProfileKind, { icon: string; title: string; tone: string; ring: string }> = {
  MaxBattery: { icon: 'battery-full', title: 'Max Battery', tone: 'text-emerald-400', ring: 'border-emerald-400 bg-emerald-400/10' },
  Optimal: { icon: 'gauge', title: 'Optimal', tone: 'text-sky-400', ring: 'border-sky-400 bg-sky-400/10' },
  MaxPerformance: { icon: 'zap', title: 'Max Performance', tone: 'text-orange-400', ring: 'border-orange-400 bg-orange-400/10' },
};

function Presets({ profiles, game, device, facts, own, onSwitch }: {
  profiles: GameProfiles; game: { appId: number; name: string; hasPresets: boolean }; device: DeviceId; facts?: GameFacts; own: Own;
  onSwitch: (d: DeviceId) => void;
}) {
  const [tab, setTab] = useState<ProfileKind>('Optimal');
  const [feedback, setFeedback] = useState<PresetFeedback | null>(null);
  const [loadedFeedback] = useLoad(() => loadPresetFeedback(game.appId).catch(() => null), [game.appId]);
  const tallies = feedback ?? loadedFeedback ?? null;
  const name = getHandheld(device).name;
  const { model, wh, health } = batteryFor(device, own);

  const set = viewForDevice(profiles, device, facts?.deck ?? 0);
  if (!set) {
    // A Deck model without its own profile: offer the one that exists.
    const other = (['oled', 'lcd'] as DeviceId[]).find((d) => profiles.devices[d]);
    return (
      <EmptyState icon="sliders-horizontal" title={`No ${name} presets for this game`} body="Presets were built for the other Steam Deck model.">
        {other && <button type="button" className="btn-outline mt-2" onClick={() => onSwitch(other)}>See {getHandheld(other).name} presets</button>}
      </EmptyState>
    );
  }

  const ally = isAlly(device);
  const profile = set[tab];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1 max-w-3xl">
          <h2 className="font-heading text-2xl font-semibold">{name} presets</h2>
          <p className="text-muted-foreground">{set.summary}</p>
          <Basis set={set} />
        </div>
        {ally && <button type="button" className="btn-ghost" onClick={() => onSwitch(set.sourceDevice)}>See {getHandheld(set.sourceDevice).name} presets</button>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="tablist" aria-label="Preset">
        {PROFILE_KINDS.map((kind) => {
          const look = LOOK[kind];
          const active = tab === kind;
          const t = tallies?.get(tallyKey(device, kind));
          const votes = t ? t.up + t.down : 0;
          return (
            <button key={kind} type="button" role="tab" aria-selected={active} onClick={() => setTab(kind)}
              className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left cursor-pointer transition-all duration-150 active:scale-[0.98] ${active ? look.ring : 'border-border bg-card hover:border-muted-foreground/40'}`}>
              <span className="flex items-center gap-2">
                <Icon name={look.icon} className={`w-4 h-4 ${look.tone}`} />
                <span className="font-heading font-semibold">{look.title}</span>
              </span>
              <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span className="font-medium tabular-nums">{set[kind].expectedFps}</span>
                <span className="text-muted-foreground tabular-nums inline-flex items-center gap-1">
                  <Icon name="battery-full" className="w-3.5 h-3.5" /> {batteryRange(wh, set[kind].drawWatts)}
                </span>
              </span>
              {votes >= 3 && (
                <span className={`text-xs tabular-nums ${t!.up / votes >= 0.7 ? 'text-emerald-300' : t!.up / votes >= 0.4 ? 'text-amber-200' : 'text-rose-300'}`}>
                  {Math.round((t!.up / votes) * 100)}% of {votes} players say it works
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Detail kind={tab} p={profile} />

      <PresetVote appId={game.appId} device={device} kind={tab} game={game} tallies={tallies} onTallies={setFeedback} />

      {set.knownIssues.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-amber-400/5 border border-amber-400/20 p-5">
          <p className="flex items-center gap-2 font-semibold"><Icon name="triangle-alert" className="w-4 h-4 text-amber-300" /> Known issues</p>
          {set.knownIssues.map((i) => <p key={i} className="text-muted-foreground">• {i}</p>)}
        </div>
      )}

      <p className="caption">
        Battery times are estimates from each preset's power draw and your {model.name}'s {model.batteryWh} Wh battery{health < 100 ? ` at ${health}% health` : ''}.{' '}
        {ally
          ? `Converted from the ${getHandheld(set.sourceDevice).name} preset built ${set.generated}. Ally numbers are estimates: check them in-game, and see the player reports below for what people actually measured.`
          : `Built ${set.generated} from the Steam store listing, ProtonDB and Steam Deck Verified data${set.sources ? ` and ${set.sources} web guides` : ''}. Check them in-game; results can change with game updates, and the player reports below show what really works.`}
      </p>
    </section>
  );
}

// "Did this preset work for you?": one tap, changeable, and tapping your answer again takes it back.
// A "no" points to the report form, so the next player learns what to change.
function PresetVote({ appId, device, kind, game, tallies, onTallies }: {
  appId: number; device: DeviceId; kind: ProfileKind; game: { appId: number; name: string; hasPresets: boolean };
  tallies: PresetFeedback | null; onTallies: (t: PresetFeedback) => void;
}) {
  const [mine, setMine] = useStored<Record<string, 'up' | 'down'>>('preset-votes', {});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = `${appId}:${device}:${kind}`;
  const vote = mine[id];
  const t = tallies?.get(tallyKey(device, kind)) ?? { up: 0, down: 0 };

  async function cast(answer: 'up' | 'down') {
    const next = vote === answer ? null : answer;
    setBusy(true);
    setFailed(false);
    try {
      onTallies(await votePreset(appId, device, kind, next === null ? null : next === 'up'));
      setMine((m) => {
        const copy = { ...m };
        if (next) copy[id] = next;
        else delete copy[id];
        return copy;
      });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const btn = (answer: 'up' | 'down') => {
    const on = vote === answer;
    const up = answer === 'up';
    return (
      <button type="button" disabled={busy} aria-pressed={on} onClick={() => cast(answer)}
        className={`inline-flex items-center gap-2 min-h-10 px-3.5 rounded-xl border text-sm font-medium tabular-nums cursor-pointer transition-all duration-150 active:scale-[0.97] disabled:opacity-60 ${
          on ? (up ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-200' : 'border-rose-400/60 bg-rose-500/15 text-rose-200') : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'}`}>
        <Icon name={up ? 'thumbs-up' : 'thumbs-down'} className="w-4 h-4" />
        {up ? 'Worked' : 'Didn’t'} · {up ? t.up : t.down}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/25 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 min-w-[14rem] text-sm font-medium">Did the {LOOK[kind].title} preset work on your {getHandheld(device).shortName}?</p>
        <div className="flex gap-2">{btn('up')}{btn('down')}</div>
      </div>
      {failed && <p className="text-xs text-rose-300">Couldn\u’t save your answer. Try again.</p>}
      {vote === 'down' && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-3 fade-in">
          <p className="flex-1 min-w-[14rem] caption">Thanks. What was off? A short report with what you changed helps the next player, and shows DeckTune what to fix.</p>
          <ShareButton game={game} device={device} className="btn-outline" label="Share what worked" />
        </div>
      )}
      {vote === 'up' && <p className="caption fade-in">Thanks! Tap it again to take your answer back.</p>}
    </div>
  );
}

function Basis({ set }: { set: ProfileViewSet }) {
  const look = {
    converted: ['arrow-right-left', 'Converted from Steam Deck settings', 'border-violet-400/40 bg-violet-400/10 text-violet-300'],
    reports: ['users', 'From Deck player reports', 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'],
    guides: ['book-open', 'From PC guides and benchmarks', 'border-sky-400/40 bg-sky-400/10 text-sky-300'],
    estimate: ['calculator', "Estimated from the game's requirements", 'border-amber-400/40 bg-amber-400/10 text-amber-200'],
  }[set.basis];
  if (!look) return null;
  const [icon, label, tone] = look;
  return (
    <div className="flex items-start gap-2 flex-wrap pt-1">
      <span className={`inline-flex items-center gap-1.5 rounded-xl sm:rounded-full border px-2.5 py-1 max-w-full text-xs font-semibold ${tone}`}>
        <Icon name={icon} className="w-3.5 h-3.5" />
        {set.confidence ? `${label} · ${set.confidence} confidence` : label}
      </span>
      {set.basisNote && <span className="caption flex-1 min-w-[12rem] pt-1">{set.basisNote}</span>}
    </div>
  );
}

function Detail({ kind, p }: { kind: ProfileKind; p: ProfileView }) {
  const look = LOOK[kind];
  const settings = p.inGameSettings.filter((s, i, all) => s.Name.toLowerCase() !== 'resolution' && all.findIndex((x) => x.Name === s.Name) === i);
  return (
    <div key={kind} className="flex flex-col gap-5 rounded-2xl bg-card border border-border p-5 sm:p-6 shadow-xl shadow-black/20 fade-in">
      <p className="text-muted-foreground">{p.notes}</p>

      <div className="flex flex-col gap-3">
        <p className={`eyebrow ${look.tone}`}>{look.title} · {p.systemTitle}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {p.system.map((s) => <Stat key={s.label} icon={s.icon} label={s.label} value={s.value} />)}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="eyebrow text-muted-foreground">In-game graphics</p>
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          <div className="flex justify-between gap-4 px-4 py-2.5 bg-muted/40 text-sm">
            <span className="text-muted-foreground">Resolution</span>
            <span className="font-medium text-right">{p.resolution}</span>
          </div>
          {settings.map((s) => (
            <div key={s.Name} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">{s.Name}</span>
              <span className="font-medium text-right">{s.Value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-4 min-w-0">
          <p className="eyebrow text-muted-foreground">Launch options</p>
          {p.launchOptions.trim() ? (
            <div className="flex items-center gap-2 min-w-0">
              <code className="font-mono text-sm break-all flex-1 min-w-0">{p.launchOptions}</code>
              <CopyButton text={p.launchOptions} label="Copy launch options" />
            </div>
          ) : <p>None needed</p>}
        </div>
        <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-4">
          <p className="eyebrow text-muted-foreground">{p.compatTitle}</p>
          <p>{p.compat}</p>
        </div>
      </div>
    </div>
  );
}
