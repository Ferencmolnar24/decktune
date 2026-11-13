import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { getHandheld, isAlly } from '../lib/handhelds';
import { GUIDE_IDS, getGuide, sceneFor, type RepairGuide } from '../lib/repair';
import { useDevice } from '../App';
import { BackLink, Icon, SectionHeader } from '../components/ui';
import '../deck3d/deck-3d.css';

// three.js is heavy: it loads only when this page opens.
const DeckScene = lazy(() => import('../deck3d/deck-scene'));

// WebGL can be missing (old devices, blocked GPUs). Say so instead of leaving a blank box.
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (this.state.failed) {
      return <div className="deck3d-root deck3d-loading"><span>This browser can't show the 3D view. The written steps beside it cover everything.</span></div>;
    }
    return this.props.children;
  }
}

function Loading() {
  return (
    <div className="deck3d-root deck3d-loading">
      <div className="deck3d-spinner" />
      <span>Loading the 3D Deck…</span>
    </div>
  );
}

export default function RepairPage() {
  const [device, setDevice] = useDevice();
  const [guideId, setGuideId] = useState('ssd');
  const [index, setIndex] = useState(0);
  // The 3D guides come from Valve's CAD, so they cover the two Steam Decks.
  const generation = device === 'lcd' ? 'lcd' : 'oled';
  const guide = getGuide(guideId, generation);
  const i = Math.min(Math.max(index, 0), guide.steps.length - 1);
  const step = guide.steps[i];

  return (
    <div className="flex flex-col gap-8 pt-2 pb-8 fade-in">
      <BackLink />
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div className="flex flex-col gap-3 max-w-3xl">
          <span className="self-start inline-flex items-center rounded-full border border-brand/50 bg-brand/10 px-3 py-1 eyebrow text-brand-text">Interactive 3D</span>
          <h1 className="font-heading font-bold uppercase leading-[0.95] text-4xl sm:text-5xl">Repair & upgrade</h1>
          <p className="text-lg text-muted-foreground">Swap parts yourself, one step at a time. Each step animates on a 3D Steam Deck built from Valve's official CAD, and every procedure follows Valve's official iFixit guide for your model.</p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <p className="eyebrow text-muted-foreground">Your Deck</p>
          <div className="flex items-center gap-1 p-1 rounded-full bg-card border border-border self-start">
            {(['lcd', 'oled'] as const).map((g) => (
              <button key={g} type="button" onClick={() => { if (device !== g) { setDevice(g); setIndex(0); } }}
                className={`px-4 h-9 rounded-full text-sm font-medium cursor-pointer transition-colors duration-150 ${device === g ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                {getHandheld(g).name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isAlly(device) && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
          <Icon name="info" className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <p>These 3D guides are for the Steam Deck. ROG Ally repair guides aren't available yet, so don't follow these on your {getHandheld(device).name}: its screws, parts and layout differ. Pick a Steam Deck above to explore the guides.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {GUIDE_IDS.map((id) => {
          const option = getGuide(id, generation);
          const active = option.id === guide.id;
          return (
            <button key={id} type="button" onClick={() => { setGuideId(id); setIndex(0); }}
              className={`flex flex-col items-start gap-3 rounded-2xl border p-4 text-left cursor-pointer transition-all duration-150 active:scale-[0.98] ${active ? 'border-brand bg-brand/10 shadow-lg shadow-brand/10' : 'border-border bg-card hover:border-muted-foreground/40'}`}>
              <span className="flex items-center gap-3 w-full">
                <span className={`${active ? 'bg-brand text-white' : 'bg-brand/10 text-brand-text'} w-10 h-10 rounded-xl flex items-center justify-center shrink-0`}>
                  <Icon name={option.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-lg font-semibold leading-tight">{option.title}</span>
                  <span className="caption">{option.difficulty} · {option.time} · {option.steps.length} steps</span>
                </span>
              </span>
              <span className="caption">{option.summary}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] gap-4 items-start">
        <div className="relative rounded-2xl border border-border overflow-hidden h-[360px] sm:h-[480px] lg:h-[560px] shadow-2xl shadow-black/40">
          <SceneBoundary>
            <Suspense fallback={<Loading />}>
              <DeckScene key={generation} model={generation} scene={sceneFor(guide, i)} />
            </Suspense>
          </SceneBoundary>
        </div>
        <StepPanel guide={guide} index={i} onIndex={setIndex} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] gap-4 items-start">
        <section className="flex flex-col gap-3">
          <SectionHeader icon="list-checks" title="All steps" subtitle="Jump to any step" />
          <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
            {guide.steps.map((s, n) => {
              const state = n < i ? 'done' : n === i ? 'current' : 'todo';
              return (
                <button key={`${guide.id}-${n}`} type="button" onClick={() => setIndex(n)}
                  className={`flex items-center gap-3 w-full text-left px-4 py-3 cursor-pointer transition-colors ${state === 'current' ? 'bg-brand/10' : 'hover:bg-muted/40'}`}>
                  <span className={`${state === 'done' ? 'bg-emerald-500/15 text-emerald-400' : state === 'current' ? 'bg-brand text-white' : 'bg-muted text-muted-foreground'} w-7 h-7 rounded-full flex items-center justify-center shrink-0`}>
                    {state === 'done' ? <Icon name="check" /> : <span className="text-xs font-bold tabular-nums">{n + 1}</span>}
                  </span>
                  <span className={`text-sm flex-1 ${state === 'current' ? 'font-semibold' : state === 'done' ? 'text-muted-foreground' : ''}`}>{s.title}</span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="flex flex-col gap-3">
          <SectionHeader icon="package" title="Before you start" subtitle={`For the ${getHandheld(generation).name}`} />
          <div className="flex flex-col gap-4 card p-5">
            <div className="flex flex-col gap-1.5">
              <p className="eyebrow text-muted-foreground">Part</p>
              <p>{guide.buy}</p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="eyebrow text-muted-foreground">Tools</p>
              <div className="flex flex-wrap gap-1.5">{guide.tools.map((t) => <span key={t} className="rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium">{t}</span>)}</div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl bg-muted/40 p-3">
              <Icon name="shield-check" className="w-4 h-4 text-brand-text shrink-0 mt-0.5" />
              <p className="caption">Work on a clean, static-safe surface and touch something metal before handling boards. Opening your Deck is at your own risk; check your warranty first.</p>
            </div>
          </div>
        </section>
      </div>
      {/* keeps the current step's title in view on phones, where the panel sits below the 3D view */}
      <span className="sr-only" aria-live="polite">{`Step ${i + 1}: ${step.title}`}</span>
    </div>
  );
}

function StepPanel({ guide, index, onIndex }: { guide: RepairGuide; index: number; onIndex: (n: number) => void }) {
  const step = guide.steps[index];
  const count = guide.steps.length;
  return (
    <div className="flex flex-col gap-4 card p-5 sm:p-6 lg:sticky lg:top-4">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow text-brand-text tabular-nums">Step {index + 1} of {count}</p>
        <p className="caption">{guide.title}</p>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${((index + 1) * 100) / count}%` }} />
      </div>
      <div key={`${guide.id}-${index}`} className="flex flex-col gap-3 min-h-[11rem] fade-in">
        <h2 className="font-heading text-2xl font-semibold leading-tight">{step.title}</h2>
        <p className="text-muted-foreground">{step.body}</p>
        {step.tools.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {step.tools.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium">
                <Icon name="wrench" className="w-3.5 h-3.5 text-brand-text" /> {t}
              </span>
            ))}
          </div>
        )}
        {step.caution && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
            <Icon name="triangle-alert" className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <p>{step.caution}</p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button type="button" className="btn-outline flex-1" disabled={index === 0} onClick={() => onIndex(Math.max(0, index - 1))}>
          <Icon name="arrow-left" /> Back
        </button>
        {index < count - 1 ? (
          <button type="button" className="btn-primary flex-[2]" onClick={() => onIndex(index + 1)}>
            Next step <Icon name="arrow-right" />
          </button>
        ) : (
          <button type="button" className="btn-primary flex-[2]" onClick={() => onIndex(0)}>
            <Icon name="rotate-ccw" /> Start over
          </button>
        )}
      </div>
      <a className="btn-ghost self-start -ml-3 text-brand-text" href={guide.officialUrl} target="_blank" rel="noreferrer">
        <Icon name="external-link" /> Open the official iFixit guide
      </a>
    </div>
  );
}
