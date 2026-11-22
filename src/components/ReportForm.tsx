// DeckTune's own report form. Everything is a tap except the settings and notes, and it posts
// either straight from the site (no account, through the report service) or as a filled-in GitHub
// issue. A failed post keeps every answer, so trying again is one press.
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadCatalog, loadProfileIndex, ratingOf, type Report } from '../lib/data';
import { getHandheld, HANDHELDS, type DeviceId } from '../lib/handhelds';
import { fpsStepsFor } from '../lib/fps';
import {
  BATTERY_OPTIONS, githubReportUrl, missing, OS_OPTIONS, pendingReport, PostError, postReport, PRESET_OPTIONS, RATINGS,
  REPO, REPORT_API, TURNSTILE_SITEKEY, type ReportDraft,
} from '../lib/community';
import { useLoad, useStored } from '../lib/state';
import { GitHubMark, Icon } from './ui';

export interface ReportGame { appId: number; name: string; hasPresets?: boolean }

const defaultOs = (device: DeviceId) => (getHandheld(device).family === 'deck' ? 'SteamOS' : 'Windows');

export function ReportForm({ game, device, onClose }: { game?: ReportGame; device: DeviceId; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useStored('reporter-name', '');
  const [, setPending] = useStored<Report[]>('pending-reports', []);
  const [picked, setPicked] = useState<ReportGame | undefined>(game);
  const [draft, setDraft] = useState<ReportDraft>(() => ({
    appId: game?.appId ?? 0, game: game?.name ?? '', device, os: defaultOs(device), rating: '', fps: '', battery: '',
    preset: '', settings: '', notes: '', name,
  }));
  const [honeypot, setHoneypot] = useState('');
  const [state, setState] = useState<'editing' | 'posting' | 'posted' | 'github'>('editing');
  const [error, setError] = useState('');
  const [posted, setPosted] = useState<{ id: number; url: string } | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const turnstile = useTurnstile(!!REPORT_API && !!TURNSTILE_SITEKEY && state !== 'posted');

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    // The game search, when there is one; focus can only move once the dialog is open.
    d?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);

  const set = <K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const hasPresets = picked?.hasPresets ?? false;
  const fpsOptions = ['Under 30', ...fpsStepsFor(draft.device).map(String)];
  const needs = missing(draft);
  const needsCheck = !!REPORT_API && !!TURNSTILE_SITEKEY && !turnstile.token;
  const ownSettings = !hasPresets || draft.preset === 'My own settings' || !draft.preset;

  const chooseGame = (g: ReportGame) => {
    setPicked(g);
    setDraft((d) => ({ ...d, appId: g.appId, game: g.name, preset: g.hasPresets ? d.preset : '' }));
  };

  const chooseDevice = (d: DeviceId) => setDraft((old) => ({
    ...old,
    device: d,
    // Keep the OS unless it was the old handheld's default; drop a frame rate the new screen can't pace.
    os: old.os === defaultOs(old.device) ? defaultOs(d) : old.os,
    fps: old.fps && old.fps !== 'Under 30' && !fpsStepsFor(d).includes(Number(old.fps)) ? '' : old.fps,
  }));

  async function post() {
    if (needs.length || needsCheck) {
      setShowMissing(true);
      return;
    }
    setState('posting');
    setError('');
    try {
      const result = await postReport({ ...draft, name: draft.name.trim() }, turnstile.token, honeypot);
      setName(draft.name.trim());
      if (result.id) setPending((old) => [pendingReport(draft, result.id), ...old.filter((r) => r.id !== result.id)]);
      setPosted(result);
      setState('posted');
    } catch (e) {
      setError(e instanceof PostError ? e.message : "Couldn't post the report. Try again in a minute.");
      setState('editing');
      turnstile.reset();
    }
  }

  function openGitHub() {
    if (needs.length) {
      setShowMissing(true);
      return;
    }
    window.open(githubReportUrl(draft), '_blank', 'noopener');
    setState('github');
  }

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
            <h2 id="report-form-title" className="font-heading text-xl font-semibold leading-tight">Share how it runs</h2>
            <p className="caption truncate">{picked ? picked.name : 'Pick the game you played'}</p>
          </div>
          <button type="button" className="btn-ghost btn-icon -mr-2 -mt-1" aria-label="Close" onClick={() => dialog.current?.close()}>
            <Icon name="x" />
          </button>
        </header>

        {state === 'posted' ? (
          <Done
            icon="circle-check"
            title="Thanks! Your report is posted"
            body="You can see it on the game's page now, and everyone else will within a few minutes, once the site rebuilds."
          >
            <button type="button" className="btn-primary" onClick={() => dialog.current?.close()}>Done</button>
            {posted?.url && <a className="btn-ghost" href={posted.url} target="_blank" rel="noreferrer"><GitHubMark /> View it on GitHub</a>}
          </Done>
        ) : state === 'github' ? (
          <Done
            icon="external-link"
            title="Finish on GitHub"
            body="Your report opened in a new tab with every field filled in. Sign in there if GitHub asks, then press Create. It shows up here within a few minutes."
          >
            <button type="button" className="btn-primary" onClick={() => dialog.current?.close()}>Done</button>
            <button type="button" className="btn-ghost" onClick={() => setState('editing')}>Back to the form</button>
          </Done>
        ) : (
          <>
            <div className="flex flex-col gap-6 overflow-y-auto px-5 sm:px-6 py-5">
              {!game && <GamePicker picked={picked} onPick={chooseGame} />}

              <Field label="Your handheld">
                <div className="flex flex-col sm:flex-row gap-2">
                  <select className="field w-full sm:flex-1 sm:w-auto" aria-label="Handheld" value={draft.device} onChange={(e) => chooseDevice(e.target.value as DeviceId)}>
                    {HANDHELDS.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                  <Chips options={OS_OPTIONS.map((o) => [o, o === 'Bazzite or another Linux' ? 'Other Linux' : o])} value={draft.os} onChange={(v) => set('os', v)} label="Operating system" />
                </div>
              </Field>

              <Field label="How well does it run?" missing={showMissing && !draft.rating}>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" role="radiogroup" aria-label="How well does it run?">
                  {RATINGS.map((r) => {
                    const on = draft.rating === r.id;
                    return (
                      <button key={r.id} type="button" role="radio" aria-checked={on} onClick={() => set('rating', r.id)}
                        className={`h-11 rounded-xl border text-sm font-semibold cursor-pointer transition-all duration-150 active:scale-[0.97] ${on ? r.tone : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'}`}>
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Frame rate it holds" hint="The cap it holds in normal play. Dips in the busiest spots are fine: mention them in the notes." missing={showMissing && !draft.fps}>
                <Chips options={fpsOptions.map((f) => [f, f === 'Under 30' ? 'Under 30' : `${f} fps`])} value={draft.fps} onChange={(v) => set('fps', v)} label="Frame rate" />
              </Field>

              <Field label="Battery life" hint="Optional. Hours on a full charge at these settings.">
                <Chips options={[['', "Didn't check"], ...BATTERY_OPTIONS.map((b) => [b, `${b} h`] as [string, string])]} value={draft.battery} onChange={(v) => set('battery', v)} label="Battery life" />
              </Field>

              <Field label="Settings you used" missing={showMissing && !draft.preset && !draft.settings.trim()}>
                {hasPresets && (
                  <Chips options={PRESET_OPTIONS.map((p) => [p, p === 'My own settings' ? p : `DeckTune ${p}`])} value={draft.preset} onChange={(v) => set('preset', v)} label="DeckTune preset used" />
                )}
                <textarea
                  className="field h-auto min-h-24 py-2.5 resize-y"
                  aria-label="Settings you used"
                  maxLength={1500}
                  value={draft.settings}
                  onChange={(e) => set('settings', e.target.value)}
                  placeholder={ownSettings
                    ? 'Frame cap and refresh rate, TDP or operating mode, in-game preset, resolution and upscaling, Proton version'
                    : 'Optional: anything you changed from the preset'}
                />
              </Field>

              <Field label="Anything else?" hint="Optional. Stutter spots, crashes, controller quirks and how you fixed them.">
                <textarea className="field h-auto min-h-20 py-2.5 resize-y" aria-label="Anything else?" maxLength={1500} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
              </Field>

              {REPORT_API && (
                <Field label="Your name" hint="Optional. Shown on the report; leave it empty to post as Guest.">
                  <input className="field" maxLength={40} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Guest" autoComplete="nickname" />
                </Field>
              )}
              {/* Hidden from people; bots that fill every field give themselves away. */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] w-px h-px opacity-0"
                value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
              {turnstile.enabled && <div ref={turnstile.ref} className="min-h-[65px]" />}
            </div>

            <footer className="flex flex-col gap-3 px-5 sm:px-6 py-4 border-t border-border bg-background/40">
              {error && (
                <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
                  <Icon name="circle-alert" className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" /> <span>{error}</span>
                </div>
              )}
              {showMissing && (needs.length > 0 || needsCheck) && (
                <p className="text-sm text-amber-200">
                  Still needed: {[...needs, ...(needsCheck ? ['the quick check above'] : [])].join(', ')}.
                </p>
              )}
              <Actions state={state} onPost={post} onGitHub={openGitHub} />
            </footer>
          </>
        )}
      </div>
    </dialog>
  );
}

function Actions({ state, onPost, onGitHub }: { state: string; onPost: () => void; onGitHub: () => void }) {
  if (REPORT_API) {
    return (
      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2">
        {REPO && (
          <button type="button" className="btn-ghost sm:mr-auto" onClick={onGitHub} disabled={state === 'posting'}>
            <GitHubMark /> Post with GitHub instead
          </button>
        )}
        <button type="button" className="btn-primary sm:min-w-44" onClick={onPost} disabled={state === 'posting'}>
          {state === 'posting' ? <><Icon name="loader-circle" className="w-4 h-4 animate-spin" /> Posting…</> : <><Icon name="send" /> Post report</>}
        </button>
      </div>
    );
  }
  if (REPO) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="caption flex-1">Opens GitHub with your report filled in. A free GitHub account posts it.</p>
        <button type="button" className="btn-primary" onClick={onGitHub}>
          <GitHubMark /> Continue on GitHub
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <p className="caption flex-1">Posting turns on once the site is published from its GitHub repository.</p>
      <button type="button" className="btn-primary" disabled><Icon name="send" /> Post report</button>
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

function Field({ label, hint, missing, children }: { label: string; hint?: string; missing?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <p className={`text-sm font-semibold ${missing ? 'text-amber-200' : ''}`}>
          {label}{missing && <span className="font-normal"> · needed</span>}
        </p>
        {hint && <p className="caption">{hint}</p>}
      </div>
      {children}
    </div>
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
      <Field label="Game">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-2">
          <Icon name="gamepad-2" className="w-4 h-4 text-brand-text" />
          <span className="flex-1 font-medium truncate">{picked.name}</span>
          <button type="button" className="btn-ghost h-8 min-h-8" onClick={() => setEditing(true)}>Change</button>
        </div>
      </Field>
    );
  }
  return (
    <Field label="Game" missing={!picked}>
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
    </Field>
  );
}

// ───────────────────────── Turnstile ─────────────────────────

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

let turnstileScript: Promise<TurnstileApi> | null = null;
function loadTurnstile(): Promise<TurnstileApi> {
  turnstileScript ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')));
    s.onerror = () => {
      turnstileScript = null;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(s);
  });
  return turnstileScript;
}

// Cloudflare's free bot check, shown only when the report service asks for it.
function useTurnstile(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState('');
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadTurnstile().then((api) => {
      if (!live || !ref.current) return;
      widget.current = api.render(ref.current, {
        sitekey: TURNSTILE_SITEKEY,
        theme: 'dark',
        callback: (t: string) => setToken(t),
        'expired-callback': () => setToken(''),
        'error-callback': () => setToken(''),
      });
    }, () => undefined);
    return () => {
      live = false;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [enabled]);
  return {
    enabled,
    ref,
    token,
    reset: () => {
      setToken('');
      if (widget.current) window.turnstile?.reset(widget.current);
    },
  };
}
