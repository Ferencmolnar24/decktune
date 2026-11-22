// DeckTune's report form: six short questions, every answer a tap or a small box, posted right on
// DeckTune. The same form edits a report this browser posted. A failed post keeps every answer, so
// trying again is one press.
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadCatalog, loadProfileIndex, loadProfiles, ratingOf, type Report } from '../lib/data';
import { getHandheld, HANDHELDS, type DeviceId } from '../lib/handhelds';
import { fpsStepsFor } from '../lib/fps';
import { viewForDevice, type ProfileKind } from '../lib/profiles';
import { fieldsFor, settingsFromPreset, type ReportSettings, type SettingField } from '../lib/settings';
import { BATTERY_OPTIONS, draftFromReport, missing, OS_OPTIONS, PRESET_OPTIONS, RATINGS, toNewReport, type ReportDraft } from '../lib/community';
import { editSiteReport, PostError, postSiteReport, refreshReports, SITE_POSTING, useMyReports } from '../lib/reports';
import { useLoad, useStored } from '../lib/state';
import { Icon } from './ui';

export interface ReportGame { appId: number; name: string; hasPresets?: boolean }

const defaultOs = (device: DeviceId) => (getHandheld(device).family === 'deck' ? 'SteamOS' : 'Windows');
const PRESET_KIND: Record<string, ProfileKind> = { 'Max Battery': 'MaxBattery', Optimal: 'Optimal', 'Max Performance': 'MaxPerformance' };

export function ReportForm({ game, device, onClose, edit }: {
  game?: ReportGame; device: DeviceId; onClose: () => void;
  // A report this browser posted, with its key: the form then saves changes to it.
  edit?: { report: Report; key: string };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [savedName, setSavedName] = useStored('reporter-name', '');
  const [, setMine] = useMyReports();
  const [picked, setPicked] = useState<ReportGame | undefined>(edit ? { appId: edit.report.appId, name: edit.report.game } : game);
  const [draft, setDraft] = useState<ReportDraft>(() => edit ? draftFromReport(edit.report) : {
    appId: game?.appId ?? 0, game: game?.name ?? '', device, os: defaultOs(device), rating: '', fps: '', battery: '',
    preset: '', setup: {}, notes: '', name: savedName,
  });
  const [honeypot, setHoneypot] = useState('');
  const [state, setState] = useState<'editing' | 'posting' | 'posted'>('editing');
  const [error, setError] = useState('');
  const [showMissing, setShowMissing] = useState(false);
  // Presets prefill the settings boxes. When it isn't known whether the game has any (editing),
  // a game without them simply finds none.
  const [profiles] = useLoad(() => (picked && picked.hasPresets !== false ? loadProfiles(picked.appId).catch(() => null) : Promise.resolve(null)), [picked?.appId]);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    // The game search, when there is one; focus can only move once the dialog is open.
    d?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);

  const set = <K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setSetting = (key: keyof ReportSettings, value: string) => setDraft((d) => ({ ...d, setup: { ...d.setup, [key]: value } }));
  const needs = missing(draft);
  const fields = fieldsFor(draft.device, draft.os);
  const fpsOptions = ['Under 30', ...fpsStepsFor(draft.device).map(String)];

  // Presets this game has for the chosen handheld (an Ally's are converted from the Deck's).
  const presetView = useMemo(() => (profiles ? viewForDevice(profiles, draft.device, 0) : null), [profiles, draft.device]);

  const choosePreset = (preset: string) => setDraft((d) => {
    const kind = PRESET_KIND[preset];
    // Picking a preset fills the boxes with its settings; the player changes only what differed.
    const setup = kind && presetView ? { ...settingsFromPreset(presetView[kind], d.device), other: d.setup.other } : d.setup;
    return { ...d, preset, setup };
  });

  const chooseGame = (g: ReportGame) => {
    setPicked(g);
    setDraft((d) => ({ ...d, appId: g.appId, game: g.name, preset: '', setup: {} }));
  };

  const chooseDevice = (dev: DeviceId) => setDraft((old) => ({
    ...old,
    device: dev,
    // Keep the OS unless it was the old handheld's default; drop a frame rate the new screen can't pace.
    os: old.os === defaultOs(old.device) ? defaultOs(dev) : old.os,
    fps: old.fps && old.fps !== 'Under 30' && !fpsStepsFor(dev).includes(Number(old.fps)) ? '' : old.fps,
    // Settings from one handheld's preset don't carry over to another.
    preset: getHandheld(dev).family === getHandheld(old.device).family ? old.preset : '',
    setup: getHandheld(dev).family === getHandheld(old.device).family ? old.setup : { other: old.setup.other },
  }));

  async function post() {
    if (needs.length) {
      setShowMissing(true);
      return;
    }
    setState('posting');
    setError('');
    try {
      if (edit) {
        await editSiteReport(edit.report.id, edit.key, toNewReport(draft));
      } else if (!honeypot) {
        // (A filled hidden field is a bot: it's told it worked and nothing is saved.)
        const { id, key } = await postSiteReport(toNewReport(draft));
        if (id && key) setMine((m) => ({ ...m, [id]: key }));
      }
      setSavedName(draft.name.trim());
      refreshReports();
      setState('posted');
    } catch (e) {
      setError(e instanceof PostError ? e.message : "Couldn't post the report. Try again in a minute.");
      setState('editing');
    }
  }

  let n = 0;
  const step = () => ++n;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}
      aria-labelledby="report-form-title"
      className="m-auto w-[calc(100%-1.5rem)] max-w-2xl max-h-[92dvh] rounded-2xl border border-border bg-card text-foreground p-0 shadow-2xl shadow-black/60 backdrop:bg-black/70 backdrop:backdrop-blur-xs"
    >
      <div className="flex flex-col max-h-[92dvh]">
        <header className="flex items-start gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
            <Icon name="pen-line" className="w-5 h-5 text-brand-text" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="report-form-title" className="font-heading text-xl font-semibold leading-tight">{edit ? 'Edit your report' : 'Share how it runs'}</h2>
            <p className="caption truncate">{picked ? `${picked.name} · about a minute` : 'Pick the game you played'}</p>
          </div>
          <button type="button" className="btn-ghost btn-icon -mr-2 -mt-1" aria-label="Close" onClick={() => dialog.current?.close()}>
            <Icon name="x" />
          </button>
        </header>

        {state === 'posted' ? (
          <Done icon="circle-check" title={edit ? 'Saved' : 'Thanks! Your report is live'}
            body={edit ? 'Your report is updated on the game’s page.' : 'It’s on the game’s page now for everyone to see. You can edit or delete it from this browser.'}>
            <button type="button" className="btn-primary" onClick={() => dialog.current?.close()}>Done</button>
          </Done>
        ) : (
          <>
            <div className="flex flex-col gap-7 overflow-y-auto px-5 sm:px-6 py-5">
              {!game && !edit && <GamePicker picked={picked} onPick={chooseGame} />}

              <Question n={step()} label="Which handheld and system?">
                <div className="flex flex-col sm:flex-row gap-2">
                  <select className="field w-full sm:flex-1 sm:w-auto" aria-label="Handheld" value={draft.device} onChange={(e) => chooseDevice(e.target.value as DeviceId)}>
                    {HANDHELDS.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                  <Chips options={OS_OPTIONS.map((o) => [o, o === 'Bazzite or another Linux' ? 'Other Linux' : o])} value={draft.os} onChange={(v) => set('os', v)} label="Operating system" />
                </div>
              </Question>

              <Question n={step()} label="How well did it run?" missing={showMissing && !draft.rating}>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" role="radiogroup" aria-label="How well did it run?">
                  {RATINGS.map((r) => {
                    const on = draft.rating === r.id;
                    return (
                      <button key={r.id} type="button" role="radio" aria-checked={on} onClick={() => set('rating', r.id)}
                        className={`flex flex-col items-center justify-center gap-0.5 min-h-14 px-2 py-2 rounded-xl border text-center cursor-pointer transition-all duration-150 active:scale-[0.97] ${on ? r.tone : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'}`}>
                        <span className="text-sm font-semibold">{r.label}</span>
                        <span className={`text-[11px] leading-tight ${on ? 'opacity-90' : 'text-muted-foreground'}`}>{r.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </Question>

              <Question n={step()} label="What frame rate does it hold?" hint="The rate it stays at in normal play. Dips in the busiest spots are fine: mention them at the end." missing={showMissing && !draft.fps}>
                <Chips options={fpsOptions.map((f) => [f, f === 'Under 30' ? 'Under 30' : `${f} fps`])} value={draft.fps} onChange={(v) => set('fps', v)} label="Frame rate" />
              </Question>

              <Question n={step()} label="How long does a full charge last?" hint="With these settings. Skip it if you didn't check.">
                <Chips options={[['', 'Skip'], ...BATTERY_OPTIONS.map((b) => [b, `${b} h`] as [string, string])]} value={draft.battery} onChange={(v) => set('battery', v)} label="Battery life" />
              </Question>

              <Question
                n={step()}
                label="What settings did you use?"
                hint={presetView
                  ? 'Used a DeckTune preset? Pick it and the boxes fill in; change only what you did differently. Leave a box empty if you didn’t touch it.'
                  : 'Fill in what you changed; leave a box empty if you didn’t touch it.'}
                missing={showMissing && needs.includes('your settings')}
              >
                {presetView && (
                  <Chips options={PRESET_OPTIONS.map((p) => [p, p === 'My own settings' ? 'My own' : p])} value={draft.preset} onChange={choosePreset} label="DeckTune preset used" />
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {fields.map((f) => <SettingBox key={f.key} field={f} value={draft.setup[f.key] ?? ''} onChange={(v) => setSetting(f.key, v)} />)}
                </div>
              </Question>

              <Question n={step()} label="Anything else worth knowing?" hint="Optional.">
                <textarea className="field h-auto min-h-20 py-2.5 resize-y" aria-label="Anything else worth knowing?" maxLength={1500} value={draft.notes}
                  onChange={(e) => set('notes', e.target.value)} placeholder="Stutter spots, crashes, controller quirks, and how you fixed them" />
              </Question>

              {SITE_POSTING && (
                <Question n={step()} label="Your name" hint="Optional. Shown on the report; leave it empty to post as Guest.">
                  <input className="field" maxLength={40} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Guest" autoComplete="nickname" />
                </Question>
              )}
              {/* Hidden from people; bots that fill every field give themselves away. */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="sr-only"
                value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            </div>

            <footer className="flex flex-col gap-3 px-5 sm:px-6 py-4 border-t border-border bg-background/40">
              {error && (
                <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
                  <Icon name="circle-alert" className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" /> <span>{error}</span>
                </div>
              )}
              {showMissing && needs.length > 0 && <p className="text-sm text-amber-200">Still needed: {needs.join(', ')}.</p>}
              <Actions state={state} editing={!!edit} onPost={post} />
            </footer>
          </>
        )}
      </div>
    </dialog>
  );
}

function Actions({ state, editing, onPost }: { state: string; editing: boolean; onPost: () => void }) {
  if (!SITE_POSTING) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="caption flex-1">Posting isn’t switched on for this copy of DeckTune.</p>
        <button type="button" className="btn-primary" disabled><Icon name="send" /> Post report</button>
      </div>
    );
  }
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <p className="caption flex-1">{editing ? 'Changes show up right away.' : 'No account needed. Your report goes live right away.'}</p>
      <button type="button" className="btn-primary sm:min-w-44" onClick={onPost} disabled={state === 'posting'}>
        {state === 'posting'
          ? <><Icon name="loader-circle" className="w-4 h-4 animate-spin" /> {editing ? 'Saving…' : 'Posting…'}</>
          : editing ? <><Icon name="check" /> Save changes</> : <><Icon name="send" /> Post report</>}
      </button>
    </div>
  );
}

function Done({ icon, title, body, children }: { icon: string; title: string; body: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center px-6 py-10 fade-in">
      <div className="w-14 h-14 rounded-2xl bg-emerald-400/10 flex items-center justify-center">
        <Icon name={icon} className="w-7 h-7 text-emerald-400" />
      </div>
      <h3 className="font-heading text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground max-w-md">{body}</p>
      <div className="flex flex-wrap justify-center gap-2 pt-2">{children}</div>
    </div>
  );
}

function Question({ n, label, hint, missing, children }: { n: number; label: string; hint?: string; missing?: boolean; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-start gap-2.5">
        <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-px tabular-nums ${missing ? 'bg-amber-400/20 text-amber-200' : 'bg-brand/15 text-brand-text'}`}>{n > 0 ? n : <Icon name="gamepad-2" className="w-3.5 h-3.5" />}</span>
        <div className="flex flex-col gap-0.5">
          <h3 className={`text-sm font-semibold leading-6 ${missing ? 'text-amber-200' : ''}`}>
            {label}{missing && <span className="font-normal"> · needed</span>}
          </h3>
          {hint && <p className="caption">{hint}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-2.5 sm:pl-8.5">{children}</div>
    </section>
  );
}

// One setting as a labelled box, e.g. [TDP | 10 | W].
function SettingBox({ field: f, value, onChange }: { field: SettingField; value: string; onChange: (v: string) => void }) {
  const id = `setting-${f.key}`;
  const control = f.kind === 'select' ? (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
      className={`flex-1 min-w-0 h-full bg-transparent outline-none text-sm cursor-pointer ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
      <option value="">–</option>
      {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  ) : (
    <>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder}
        inputMode={f.kind === 'number' ? 'numeric' : undefined} maxLength={f.key === 'other' ? 200 : f.kind === 'number' ? 4 : 40}
        list={f.options ? `${id}-list` : undefined} autoComplete="off"
        className="flex-1 min-w-0 h-full bg-transparent outline-none text-sm placeholder:text-muted-foreground/60" />
      {f.options && <datalist id={`${id}-list`}>{f.options.map((o) => <option key={o} value={o} />)}</datalist>}
    </>
  );
  return (
    <label htmlFor={id} className={`flex items-center gap-2 h-10 rounded-xl border bg-background/40 pl-3 pr-2.5 transition-colors focus-within:border-brand ${value ? 'border-brand/40' : 'border-border'} ${f.wide ? 'col-span-2 sm:col-span-3' : ''}`}>
      <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{f.label}</span>
      {control}
      {f.unit && <span className="text-xs text-muted-foreground">{f.unit}</span>}
    </label>
  );
}

function Chips({ options, value, onChange, label }: { options: [string, string][]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => {
        const on = value === v;
        return (
          <button key={v || 'none'} type="button" role="radio" aria-checked={on} onClick={() => onChange(v)}
            className={`h-10 px-3.5 rounded-xl border text-sm font-medium tabular-nums cursor-pointer transition-all duration-150 active:scale-[0.97] ${on ? 'border-brand bg-brand/15 text-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'}`}>
            {text}
          </button>
        );
      })}
    </div>
  );
}

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');

// Search the Steam catalog for the game (only on pages with no game of their own, like Community).
function GamePicker({ picked, onPick }: { picked?: ReportGame; onPick: (g: ReportGame) => void }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(!picked);
  const [catalog, failed, retry] = useLoad(loadCatalog, []);
  const [index] = useLoad(loadProfileIndex, []);
  const term = fold(useDeferredValue(query).trim());
  const presets = useMemo(() => new Set((index ?? []).map((r) => r[0])), [index]);
  const results = useMemo(() => {
    if (!catalog || term.length < 2) return [];
    return catalog.games
      .filter((g) => fold(g.name).includes(term))
      .sort((a, b) => (fold(a.name).startsWith(term) ? 0 : 1) - (fold(b.name).startsWith(term) ? 0 : 1) || ratingOf(b) * Math.log10(b.reviews + 1) - ratingOf(a) * Math.log10(a.reviews + 1))
      .slice(0, 6);
  }, [catalog, term]);

  if (picked && !editing) {
    return (
      <Question n={0} label="Game">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-2">
          <Icon name="gamepad-2" className="w-4 h-4 text-brand-text" />
          <span className="flex-1 font-medium truncate">{picked.name}</span>
          <button type="button" className="btn-ghost h-8 min-h-8" onClick={() => setEditing(true)}>Change</button>
        </div>
      </Question>
    );
  }
  return (
    <Question n={0} label="Which game?" missing={!picked}>
      <input className="field" data-autofocus placeholder="Search Steam games" aria-label="Search for the game" value={query} onChange={(e) => setQuery(e.target.value)} />
      {failed ? (
        <button type="button" className="btn-ghost self-start" onClick={retry}><Icon name="refresh-cw" /> Couldn't load the game list. Try again</button>
      ) : !catalog && term.length >= 2 ? (
        <p className="caption flex items-center gap-2"><Icon name="loader-circle" className="w-3.5 h-3.5 animate-spin" /> Loading the game list…</p>
      ) : term.length >= 2 && results.length === 0 ? (
        <p className="caption">No Steam game matches "{query.trim()}".</p>
      ) : results.length > 0 && (
        <div className="flex flex-col rounded-xl border border-border overflow-hidden divide-y divide-border">
          {results.map((g) => (
            <button key={g.appId} type="button" className="flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 cursor-pointer"
              onClick={() => { onPick({ appId: g.appId, name: g.name, hasPresets: presets.has(g.appId) }); setEditing(false); setQuery(''); }}>
              <span className="flex-1 truncate">{g.name}</span>
              {presets.has(g.appId) && <span className="caption">Has presets</span>}
            </button>
          ))}
        </div>
      )}
    </Question>
  );
}
