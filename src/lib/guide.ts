// "Tune it yourself": each performance control (Deck Quick Access or Ally Armoury Crate SE) explained
// for someone tuning by hand. range is for the first model of the family (Deck LCD, the Allys),
// rangeAlt for the second where it differs (Deck OLED, the Ally X models).
import { familyOf, type DeckModel } from './handhelds';

export interface SettingGuide {
  name: string;
  icon: string;
  what: string;
  range: string;
  rangeAlt: string;
  battery: string;
  useIt: string;
  watchOut: string;
  rangeXbox?: string;
}

export interface Symptom { title: string; tell: string; fix: string }

const g = (name: string, icon: string, what: string, range: string, rangeAlt: string, battery: string, useIt: string, watchOut: string, rangeXbox?: string): SettingGuide =>
  ({ name, icon, what, range, rangeAlt, battery, useIt, watchOut, rangeXbox });

export const DECK_SETTINGS: SettingGuide[] = [
  g('Performance overlay', 'activity',
    'Draws live stats over the game. Level 1 shows FPS only; levels 3–4 add the frametime graph, CPU and GPU load and clocks, temperatures and battery draw.',
    'Levels 0–4', 'Levels 0–4',
    'None worth worrying about.',
    'Turn it to level 3 or 4 while you tune, then back off. Everything below is judged by reading it.',
    "Judge at the game's heaviest moment (a busy town, a big fight), not in a quiet corridor."),
  g('Framerate limit', 'timer',
    'Caps how many frames the game renders per second. The options are fractions of the refresh rate, so the cap divides evenly into it.',
    'Fractions of the refresh rate, e.g. 15 / 30 / 60 at 60 Hz', 'Fractions of the refresh rate, e.g. 22 / 30 / 45 / 90 at 90 Hz',
    "Big. Every frame you don't render is power you don't spend.",
    'Set it a little below what the game holds at its worst moment, so it never has to dip.',
    "A cap the Deck can't reach gives you stutter instead of smoothness: if the counter keeps dropping below it, lower the cap."),
  g('Refresh rate', 'monitor',
    'How many times per second the screen updates. Pair it with the frame cap so frames land evenly.',
    '40–60 Hz', '45–90 Hz',
    'Small on its own; it matters because it decides which frame caps are on offer.',
    '40 fps at 40 Hz feels much smoother than 40 fps at 60 Hz. Use 40 Hz for 40 fps, 60 Hz for 30 or 60 fps, and on OLED 90 Hz for 45 or 90 fps.',
    'Changing it changes the frame-cap choices, so set the refresh rate first, then the cap.'),
  g('Allow tearing', 'split',
    "Shows each frame the moment it's ready instead of waiting for the screen.",
    'On / Off', 'On / Off',
    "None directly, but it's usually paired with an uncapped frame rate, which costs battery.",
    'Fast, twitchy games where input lag matters more than a clean image.',
    "You'll see horizontal tear lines when the camera moves. Leave it off for most games."),
  g('Half rate shading', 'grid-2x2',
    'Shades parts of each frame at lower detail (variable-rate shading) to take load off the GPU.',
    'On / Off', 'On / Off',
    'Saves some GPU power when the game is GPU-bound.',
    "A GPU-bound game that's just short of your target frame rate.",
    'The image gets softer, especially text and fine edges, and it does nothing in some games. Compare before and after.'),
  g('TDP limit', 'cpu',
    'Caps the power the whole chip (CPU and GPU together) may draw.',
    '3–15 W', '3–15 W',
    'The single biggest battery lever. Fewer watts means more hours.',
    'Once your frame cap holds, lower it 1 W at a time until the frame rate starts dipping, then give back 1–2 W of headroom.',
    'Too low and the CPU and GPU fight over the budget, so frame pacing gets uneven before the average FPS drops. Watch the frametime graph, not just the number.'),
  g('Manual GPU clock', 'microchip',
    'Locks the GPU to a fixed speed instead of letting the Deck pick.',
    '200–1600 MHz', '200–1600 MHz',
    'A low lock saves real power in light games.',
    'Light, 2D and older games: lock low (around 600–1000 MHz) and see if the frame rate holds. Leave it on automatic for most 3D games.',
    'A high lock under a low TDP limit starves the CPU, because the GPU keeps its share and the CPU gets the rest. That shows up as worse stutter, not better.'),
  g('Scaling filter', 'scaling',
    'How the image is stretched to the screen when the game renders below 1280×800.',
    'Linear, Nearest, FSR, NIS', 'Linear, Nearest, FSR, NIS',
    'Indirect: it makes a lower in-game resolution look acceptable, and lower resolution is a big saving.',
    'Drop the in-game resolution (for example to 960×600), then pick FSR with moderate sharpness. Use Nearest for pixel-art games.',
    'FSR and NIS only do anything when the game actually renders below native. Some games need fullscreen mode at the lower resolution for it to apply.'),
];

export const ALLY_SETTINGS: SettingGuide[] = [
  g('Operating mode', 'gauge',
    "Armoury Crate SE's power presets for the whole chip. Silent, Performance and Turbo set fixed power limits; Manual lets you pick your own.",
    'Silent 10 W · Performance 15 W · Turbo 25 W (30 W plugged in)', 'Silent 13 W · Performance 17 W · Turbo 25 W (30 W plugged in)',
    'The biggest battery lever. Each step up costs noticeably more battery than the frames it adds.',
    'Start in Performance. Drop to Silent for indie and older games; use Turbo for demanding games, ideally plugged in.',
    'Turbo can roughly halve battery life against Performance for perhaps a fifth more frames, and the fan gets loud.',
    "Silent · Performance · Turbo, plus Manual; Armoury Crate SE shows each mode's watts"),
  g('Manual power limit', 'cpu',
    "In Manual mode you set the chip's sustained power limit (SPL) yourself, plus optional short boost limits.",
    'About 7–30 W', 'About 7–30 W',
    'Fine-grained control over the same lever as Operating mode.',
    'Once your frame cap holds, lower it 1 W at a time until the frame rate starts dipping, then give back 1–2 W of headroom.',
    'Very low limits make frame pacing uneven before the average FPS drops. Watch frametimes, not just the number.'),
  g('Frame rate limiter', 'timer',
    "Caps how many frames the game renders. Armoury Crate SE's Command Center has one; AMD Software's Radeon Chill, RTSS and the game's own limiter work too.",
    'Even fractions of 120 Hz pace best: 30 · 40 · 60 · 120', 'Even fractions of 120 Hz pace best: 30 · 40 · 60 · 120',
    "Big. Every frame you don't render is power you don't spend.",
    "Cap a bit below the game's worst moment. 40 fps at 120 Hz is the Ally's sweet spot: it divides evenly into 120.",
    'Use one limiter, not two stacked: they fight each other and cause stutter.'),
  g('Refresh rate & VRR', 'monitor',
    "The screen runs at 60 or 120 Hz, and FreeSync (VRR) matches it to the game's frame rate so dips don't stutter or tear.",
    '60 / 120 Hz, VRR on 48 fps and up', '60 / 120 Hz, VRR on 48 fps and up',
    '120 Hz costs a little more than 60 Hz.',
    'Keep 120 Hz with VRR on for games around 48 fps and up, and for 40 fps caps. Switch to 60 Hz for a 30 fps cap.',
    'Below about 48 fps VRR stops helping, which is why a 40 fps cap needs 120 Hz to pace evenly.'),
  g('Resolution & upscaling', 'scaling',
    "The screen is 1920×1080, a lot of pixels for a handheld chip. Rendering lower and upscaling with the game's FSR or XeSS, or AMD's RSR, is the biggest single frame-rate gain.",
    '1280×720 to 1920×1080; in-game FSR / XeSS, or RSR', '1280×720 to 1920×1080; in-game FSR / XeSS, or RSR',
    'Indirect but large: fewer pixels let you use a lower power mode for the same frame rate.',
    "Prefer the game's own FSR or XeSS at Quality or Balanced with 1080p output. For games without one, set 720p or 900p and turn on RSR.",
    'RSR only applies in exclusive fullscreen at a below-native resolution.'),
  g('GPU memory', 'memory-stick',
    'How much of the shared RAM is reserved for graphics (the UMA frame buffer), set in Armoury Crate SE. It takes effect after a restart.',
    'Auto or a fixed amount, from 16 GB shared', 'Auto or a fixed amount, from 24 GB shared',
    'None directly.',
    'Auto is fine for most games. Some recent games check VRAM and lock high textures with too little: 4–6 GB on a 16 GB model and 8 GB on a 24 GB model are safe picks for demanding games.',
    'Every GB reserved is taken from Windows and the game, and on 16 GB models reserving too much causes stutter.'),
  g('AMD Fluid Motion Frames', 'sparkles',
    "AMD's driver-level frame generation: it adds a generated frame between real ones, so motion looks up to twice as smooth.",
    'On / Off in AMD Software or Command Center', 'On / Off in AMD Software or Command Center',
    'A small cost, but it can let you cap the real frame rate lower.',
    'Slower-paced games that already hold 50–60 fps and you want to look smoother.',
    "It adds input lag and visual artifacts, works badly under about 40 real fps, and doesn't make the game respond faster."),
  g('Performance overlay', 'activity',
    "Armoury Crate SE's Real-time Monitor shows FPS, CPU and GPU load, temperatures and power draw. RTSS or AMD's overlay add a frametime graph.",
    'Command Center › Real-time Monitor', 'Command Center › Real-time Monitor',
    'None worth worrying about.',
    'Turn it on while you tune. Everything here is judged by reading it.',
    "Judge at the game's heaviest moment (a busy town, a big fight), not in a quiet corridor."),
];

const ALLY_SYMPTOMS: Symptom[] = [
  { title: 'GPU-bound', tell: "GPU load sits near 100% at the GPU's top clock while the frame rate is below target.",
    fix: 'Lower the render resolution or use FSR/XeSS at Balanced, then lower graphics settings. A higher operating mode helps, but costs battery.' },
  { title: 'CPU-bound', tell: 'The frame rate is low but GPU load is well under 100%, and one or two CPU threads are pegged.',
    fix: 'Lower CPU-heavy settings: crowd density, view distance, physics. A lower frame cap keeps it steady. Close background apps; Windows itself costs CPU time.' },
  { title: 'Stutter', tell: 'Frametime spikes even though the average FPS looks fine.',
    fix: "First runs compile shaders, so let it settle. Check you haven't stacked two frame limiters, and try 4–6 GB of GPU memory in demanding games." },
  { title: 'Running hot', tell: 'Temperatures in the 90s °C with the fan at full speed.',
    fix: 'Drop an operating mode or the frame cap, keep the vents clear, and avoid Turbo on a soft surface.' },
  { title: 'Battery draining fast', tell: 'The power draw in the Real-time Monitor is high.',
    fix: 'That number is your battery life: use the calculator above. Use Silent or Performance, cap the frame rate, dim the screen and use 60 Hz for 30 fps games.' },
];

const DECK_SYMPTOMS: Symptom[] = [
  { title: 'GPU-bound', tell: 'GPU load sits near 100% and the GPU clock is at or near 1600 MHz while the frame rate is below target.',
    fix: "Lower graphics settings or render resolution and turn on FSR. Half rate shading can help. Raising the TDP only helps if it's below 15 W." },
  { title: 'CPU-bound', tell: 'The frame rate is low but GPU load is well under 100%, and one or two CPU threads are pegged.',
    fix: "Lower CPU-heavy settings: crowd density, view distance, physics, simulation speed. A lower frame cap keeps it steady. Locking the GPU clock lower won't hurt here and saves power." },
  { title: 'Stutter', tell: 'The frametime graph has spikes even though the average FPS looks fine.',
    fix: "On first runs this is often shaders compiling, which settles as you play. Otherwise lower the frame cap until the graph flattens; a flat line feels better than a higher, spiky number." },
  { title: 'Running hot', tell: 'Temperatures stay in the high 90s °C with the fan at full speed.',
    fix: 'The chip may be holding back to protect itself. Lower the TDP limit or the frame cap, and keep the vents clear.' },
  { title: 'Battery draining fast', tell: 'The battery draw (BATT W) in the overlay is high.',
    fix: 'That number is your battery life: use the calculator above. Cap the frame rate, lower the TDP, dim the screen and turn off Wi-Fi in offline games.' },
];

export const settingsFor = (model: DeckModel) => (familyOf(model) === 'ally' ? ALLY_SETTINGS : DECK_SETTINGS);
export const symptomsFor = (model: DeckModel) => (familyOf(model) === 'ally' ? ALLY_SYMPTOMS : DECK_SYMPTOMS);

export function rangeFor(s: SettingGuide, model: DeckModel): string {
  if ((model.generation === 'xally' || model.generation === 'xallyx') && s.rangeXbox) return s.rangeXbox;
  return model.generation === 'oled' || model.generation === 'allyx' || model.generation === 'xallyx' ? s.rangeAlt : s.range;
}

export const BATTERY_COMMAND = 'upower -i $(upower -e | grep BAT)';
export const ALLY_BATTERY_COMMAND = 'powercfg /batteryreport';

export function whereSteps(model: DeckModel): { title: string; body: string }[] {
  return familyOf(model) === 'ally'
    ? [
      { title: 'Open Command Center', body: 'Press the Command Center button on the left of the screen for quick toggles: operating mode, frame limiter, refresh rate, RSR and AFMF.' },
      { title: 'Open Armoury Crate SE', body: 'Press the Armoury Crate button on the right for the full settings.' },
      { title: 'Per-game profile', body: "In Armoury Crate SE's game library, set a profile on the game so your settings switch on with it." },
      { title: 'Manual mode', body: 'Set Operating Mode to Manual to reveal the wattage sliders.' },
    ]
    : [
      { title: 'Open Quick Access', body: 'Press the ••• button on the right of the Deck.' },
      { title: 'Go to Performance', body: 'Pick the battery icon in the menu.' },
      { title: 'Use per-game profile', body: 'Turn it on so your settings stick to this game only.' },
      { title: 'Advanced view', body: 'Turn it on to see TDP, GPU clock, shading and scaling.' },
    ];
}

export function methodSteps(model: DeckModel): string[] {
  if (familyOf(model) === 'ally') {
    return [
      'Set a per-game profile in Armoury Crate SE and turn on the Real-time Monitor.',
      'Start in Performance mode. Play the heaviest part of the game uncapped and note the lowest frame rate it holds.',
      'Pick a target a bit below that: 40 fps at 120 Hz is the sweet spot for battery, 60 fps if the game holds it easily, 30 fps at 60 Hz for the longest play.',
      'Set the frame limiter to your target, and only one limiter.',
      "Short of the target? For a GPU-bound game, use the game's FSR or XeSS at Balanced (or 720p plus RSR) before raising the operating mode.",
      'Holding it easily? Drop to Silent, or switch to Manual and lower the watts 1 W at a time until frametimes get spiky, then go back up 1–2 W.',
      'Demanding recent game? Try 4–6 GB of GPU memory (8 GB on a 24 GB model), then restart.',
      "Read the power draw and put it in the battery calculator to see what you've gained.",
    ];
  }
  const pairing = model.generation === 'oled'
    ? 'Set the refresh rate to a multiple of your target: 90 Hz for 45 or 90 fps, 80 Hz for 40 fps, 60 Hz for 30 or 60 fps.'
    : 'Set the refresh rate to a multiple of your target: 40 Hz for 40 fps, 60 Hz for 30 or 60 fps.';
  return [
    'Turn on the per-game profile and set the overlay to level 3 or 4.',
    'Play the heaviest part of the game uncapped and note the lowest frame rate it holds.',
    'Pick a target a bit below that low point: 30, 40 or 45 fps is the sweet spot for battery; 60 only if the game holds it easily.',
    pairing,
    'Set the framerate limit to your target.',
    'Lower the TDP limit 1 W at a time. When the frame rate starts dipping or the frametime graph gets spiky, go back up 1–2 W.',
    'Still short of the target? Find out why first (see What to look out for). For a GPU-bound game, drop the resolution and use FSR before raising the TDP.',
    'Light or 2D game? Try a manual GPU clock around 600–1000 MHz and check the frame rate holds.',
    "Read the BATT W figure and put it in the battery calculator to see what you've gained.",
  ];
}
