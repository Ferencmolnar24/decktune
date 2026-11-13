import { useState } from 'react';
import { familyOf, formatHours, getHandheld, HANDHELDS, hours, MODELS, usableWh, type DeckModel } from '../lib/handhelds';
import { ALLY_BATTERY_COMMAND, BATTERY_COMMAND, methodSteps, rangeFor, settingsFor, symptomsFor, whereSteps } from '../lib/guide';
import { useBatteryHealth, useModel } from '../lib/library';
import { useDevice } from '../App';
import { BackLink, CopyButton, Icon, SectionHeader } from '../components/ui';

export function GuidePage() {
  const [device] = useDevice();
  const [model] = useModel(device);
  const ally = familyOf(model) === 'ally';

  return (
    <div className="flex flex-col gap-10 pt-2 pb-8 fade-in">
      <BackLink />
      <div className="flex flex-col gap-3 max-w-3xl">
        <h1 className="font-heading font-bold uppercase leading-[0.95] text-4xl sm:text-5xl">Tune it yourself</h1>
        <p className="text-lg text-muted-foreground">
          {ally
            ? "Everything DeckTune's presets set, you can set by hand. This is what each control in Armoury Crate SE does, what to watch in the overlay, and a method that works for any game."
            : "Everything DeckTune's presets set, you can set by hand. This is what each control in the Performance menu does, what to watch in the overlay, and a method that works for any game."}
        </p>
      </div>
      <YourHandheld model={model} />
      <Where model={model} />
      <SettingsReference model={model} />
      <Symptoms model={model} />
      <Method model={model} />
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl border border-brand/40 bg-gradient-to-br from-brand/15 to-transparent p-5 sm:p-6">
        <div className="w-12 h-12 rounded-2xl bg-brand/20 flex items-center justify-center shrink-0">
          <Icon name="users" className="w-6 h-6 text-brand-text" />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <p className="font-heading text-xl font-semibold">Found settings that work?</p>
          <p className="text-muted-foreground">Share them on the game's page, so the next player with a {getHandheld(device).name} starts where you finished. Other players' reports are there too.</p>
        </div>
        <a href="#/community" className="btn-primary">See player reports</a>
      </div>
    </div>
  );
}

function YourHandheld({ model }: { model: DeckModel }) {
  const [, setDevice] = useDevice();
  const [, setModelId] = useModel(model.generation);
  const [health, setHealth] = useBatteryHealth();
  const [calcWatts, setCalcWatts] = useState(12);
  const ally = familyOf(model) === 'ally';
  const usable = usableWh(model, health);
  const maxWatts = ally ? 45 : 30;
  const watts = Math.min(calcWatts, maxWatts);
  const command = ally ? ALLY_BATTERY_COMMAND : BATTERY_COMMAND;
  const refs: [string, number][] = ally
    ? [['Indie / 2D', 12], ['Silent mode', 16], ['Performance mode', 21], ['Turbo', 31]]
    : [['Indie / 2D', 7], ['Capped 30–40 fps', 11], ['Demanding 3D', 18], ['Flat out', 25]];

  return (
    <section className="flex flex-col gap-5 rounded-2xl bg-card border border-brand/40 p-5 sm:p-7 shadow-xl shadow-black/30">
      <SectionHeader icon="gamepad-2" title="Your handheld" subtitle="Pick your exact model. Battery estimates and presets across DeckTune use it." />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {HANDHELDS.map((h) => (
          <div key={h.id} className="flex flex-col gap-2">
            <p className="eyebrow text-muted-foreground">{h.name}</p>
            <div className="flex flex-wrap gap-2">
              {MODELS.filter((x) => x.generation === h.id).map((x) => (
                <button key={x.id} type="button" onClick={() => { setModelId(x.id); setDevice(x.generation); }}
                  className={`min-h-10 px-4 rounded-xl border text-sm font-medium cursor-pointer transition-colors duration-150 ${x.id === model.id ? 'bg-brand text-white border-brand' : 'bg-muted/40 border-border hover:border-brand'}`}>
                  {x.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <Spec icon="microchip" label="Chip" value={model.apu} />
        <Spec icon="cpu" label="CPU" value={model.cpu} />
        <Spec icon="gauge" label="GPU" value={model.gpu} />
        <Spec icon="memory-stick" label="Memory" value={model.memory} />
        <Spec icon="monitor" label="Screen" value={model.display} />
        <Spec icon="refresh-cw" label="Refresh rate" value={`${model.minRefreshHz}–${model.maxRefreshHz} Hz`} />
        <Spec icon="battery-full" label="Battery" value={`${model.batteryWh} Wh`} />
        <Spec icon="hard-drive" label="Storage" value={`${model.storage}. ${model.storageNote}`} />
        <Spec icon="sparkles" label="Glass" value={model.glass} />
      </div>

      <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-4">
        <Icon name="info" className="w-4 h-4 text-brand-text shrink-0 mt-0.5" />
        <p className="text-muted-foreground">
          {ally
            ? `DeckTune's presets for the ${getHandheld(model.generation).name} are converted from each game's Steam Deck preset for its chip, so pick the model with your chip. The Ally family runs Windows: games run natively, with no Proton. What separates two units of the same model is battery wear, so set your battery health below.`
            : `Every ${model.generation === 'lcd' ? 'LCD' : 'OLED'} model has the same chip, memory, screen and ${model.batteryWh} Wh battery, so DeckTune's presets are the same across them; the models differ only in storage and glass. What really separates two Decks is battery wear, so set your battery health below.`}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">Battery health</p>
            <p className="font-heading text-2xl font-bold tabular-nums text-brand-text">{health}%</p>
          </div>
          <Stepper value={health} min={50} max={100} step={1} label="battery health" onChange={(v) => setHealth(Math.round(v))} unit="%" />
          <p>{model.batteryWh} Wh new × {health}% = {Math.round(usable * 10) / 10} Wh you can actually use.</p>
          {model.batteryClaim && <p className="caption">{model.maker} rates the {model.name} at {model.batteryClaim} on a new battery.</p>}
          <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
            <p className="text-sm font-semibold">How to check it</p>
            <p className="caption">
              {ally
                ? 'In Windows, open Terminal and run the command below. Open the battery-report.html it saves, then divide “Full charge capacity” by “Design capacity” and multiply by 100.'
                : 'Hold the power button › Switch to Desktop. Open Konsole and run the command below. Divide “energy-full” by “energy-full-design” and multiply by 100.'}
            </p>
            <div className="flex items-center gap-2 min-w-0">
              <code className="font-mono text-xs break-all flex-1 min-w-0 rounded-md bg-background/60 px-2 py-1.5">{command}</code>
              <CopyButton text={command} label="Copy battery command" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">Battery calculator</p>
            <p className="font-heading text-2xl font-bold tabular-nums text-brand-text">{formatHours(hours(usable, watts))}</p>
          </div>
          <p className="caption">
            {ally
              ? 'Set the power draw the Real-time Monitor shows while you play. The result is a full charge on your Ally.'
              : 'Set the battery draw (BATT W) the performance overlay shows while you play. The result is a full charge on your Deck.'}
          </p>
          <Stepper value={watts} min={3} max={maxWatts} step={0.5} label="battery draw" onChange={setCalcWatts} unit=" W" />
          <p className="tabular-nums">{watts} W draw → {formatHours(hours(usable, watts))} on {Math.round(usable * 10) / 10} Wh</p>
          <div className="grid grid-cols-2 gap-2">
            {refs.map(([label, w]) => (
              <div key={label} className="rounded-lg bg-muted/40 px-3 py-2">
                <p className="caption">{label} · ~{w} W</p>
                <p className="text-sm font-semibold tabular-nums">{formatHours(hours(usable, w))}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stepper({ value, min, max, step, label, unit, onChange }: { value: number; min: number; max: number; step: number; label: string; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn-outline btn-icon" aria-label={`Lower ${label} by ${step}${unit}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
        <Icon name="minus" />
      </button>
      <input type="range" className="flex-1 mx-2" min={min} max={max} step={step} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
      <button type="button" className="btn-outline btn-icon" aria-label={`Raise ${label} by ${step}${unit}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
        <Icon name="plus" />
      </button>
    </div>
  );
}

function Spec({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-3 min-w-0">
      <div className="w-9 h-9 rounded-lg bg-background/60 flex items-center justify-center shrink-0">
        <Icon name={icon} className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="caption">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

function Where({ model }: { model: DeckModel }) {
  const ally = familyOf(model) === 'ally';
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader icon="map" title="Where the settings are" subtitle={ally ? 'Two buttons, in any game' : 'In any game, in four presses'} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {whereSteps(model).map((s, i) => (
          <div key={s.title} className="flex flex-col gap-2 card rounded-xl p-4">
            <div className="w-8 h-8 rounded-lg bg-brand/15 flex items-center justify-center font-heading font-bold text-brand-text">{i + 1}</div>
            <p className="font-semibold">{s.title}</p>
            <p className="caption">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SettingsReference({ model }: { model: DeckModel }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader icon="sliders-horizontal" title="Every setting, explained" subtitle={`Ranges shown for the ${model.name}`} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {settingsFor(model).map((s) => (
          <div key={s.name} className="flex flex-col gap-3 card p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                <Icon name={s.icon} className="w-4 h-4 text-brand-text" />
              </div>
              <div className="min-w-0">
                <p className="font-heading text-lg font-semibold">{s.name}</p>
                <p className="caption text-brand-text! tabular-nums">{rangeFor(s, model)}</p>
              </div>
            </div>
            <p className="text-muted-foreground">{s.what}</p>
            <Line icon="battery-medium" label="Battery" text={s.battery} tone="text-emerald-400" />
            <Line icon="lightbulb" label="Use it" text={s.useIt} tone="text-sky-400" />
            <Line icon="triangle-alert" label="Watch out" text={s.watchOut} tone="text-amber-300" />
          </div>
        ))}
      </div>
    </section>
  );
}

function Line({ icon, label, text, tone }: { icon: string; label: string; text: string; tone: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon name={icon} className={`w-4 h-4 shrink-0 mt-0.5 ${tone}`} />
      <p>{label}: {text}</p>
    </div>
  );
}

function Symptoms({ model }: { model: DeckModel }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader icon="scan-eye" title="What to look out for" subtitle="Read the overlay, then match what you see" />
      <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border bg-card">
        {symptomsFor(model).map((s) => (
          <div key={s.title} className="grid grid-cols-1 md:grid-cols-[12rem_1fr_1fr] gap-2 md:gap-5 p-4">
            <p className="font-heading font-semibold">{s.title}</p>
            <div className="flex flex-col gap-1"><p className="eyebrow text-muted-foreground">You see</p><p>{s.tell}</p></div>
            <div className="flex flex-col gap-1"><p className="eyebrow text-muted-foreground">Do this</p><p>{s.fix}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Method({ model }: { model: DeckModel }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader icon="list-checks" title="Build your own preset" subtitle="A method that works for any game" />
      <ol className="flex flex-col gap-2 card p-5">
        {methodSteps(model).map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-brand/15 flex items-center justify-center shrink-0 text-xs font-bold text-brand-text tabular-nums">{i + 1}</span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
