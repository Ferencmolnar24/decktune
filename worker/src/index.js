// DeckTune's report service: lets visitors post a performance report from the site without a
// GitHub account. It checks the report, then files it as an issue in the site's repository with a
// token that only this service holds, labelled "guest" so the site shows the poster's chosen name.
//
// Spam guards: a per-visitor rate limit, a hidden field bots fill in, an optional Cloudflare
// Turnstile check, strict field validation, and GitHub's own moderation (close or label "hidden").

const DEVICES = [
  'Steam Deck LCD', 'Steam Deck OLED', 'ROG Ally (Z1 Extreme)', 'ROG Ally (Z1)', 'ROG Ally X',
  'ROG Xbox Ally (Z2 A)', 'ROG Xbox Ally X (Z2 Extreme)',
];
const DEVICE_IDS = { lcd: 0, oled: 1, ally: 2, allyz1: 3, allyx: 4, xally: 5, xallyx: 6 };
const OS = ['SteamOS', 'Windows', 'Bazzite or another Linux'];
const RATINGS = {
  great: 'Great - smooth, no real compromises',
  good: 'Good - smooth with a few tweaks',
  playable: 'Playable - noticeable compromises',
  rough: 'Rough - barely playable',
  unplayable: 'Unplayable',
};
const FPS = ['Under 30', '30', '40', '45', '60', '90', '120'];
const BATTERY = ['', '1', '1.5', '2', '2.5', '3', '4', '5', '6+'];
const PRESETS = ['', 'Max Battery', 'Optimal', 'Max Performance', 'My own settings'];

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin') ?? '';
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] ?? '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply({ error: 'Reports are posted from DeckTune.' }, 405);
    if (allowed.length && !allowed.includes(origin)) return reply({ error: 'Reports can only be posted from DeckTune.' }, 403);
    if (!env.GITHUB_TOKEN || !env.REPO) return reply({ error: "DeckTune's report service isn't set up yet. Post with GitHub instead." }, 503);

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (env.LIMITER) {
      const { success } = await env.LIMITER.limit({ key: ip });
      if (!success) return reply({ error: "You've posted several reports in a row. Wait a minute, then try again." }, 429);
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return reply({ error: "That report didn't arrive complete. Try again." }, 400);
    }
    // A filled hidden field means a bot: say yes and file nothing.
    if (input.website) return reply({ ok: true, id: 0, url: '' }, 201);

    if (env.TURNSTILE_SECRET) {
      const form = new FormData();
      form.append('secret', env.TURNSTILE_SECRET);
      form.append('response', String(input.turnstile ?? ''));
      form.append('remoteip', ip);
      const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
        .then((r) => r.json()).catch(() => ({ success: false }));
      if (!check.success) return reply({ error: 'The quick check expired. Tick it again, then post.' }, 400);
    }

    const report = validate(input);
    if (typeof report === 'string') return reply({ error: report }, 400);

    const res = await fetch(`https://api.github.com/repos/${env.REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'DeckTune-report-service',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title: `[Report] ${report.game} on ${report.device}`,
        body: body(report),
        labels: ['performance-report', 'guest'],
      }),
    });
    if (!res.ok) {
      console.log('GitHub refused the issue', res.status, await res.text());
      return reply({ error: "DeckTune couldn't save the report just now. Try again in a minute, or post with GitHub." }, 502);
    }
    const issue = await res.json();
    return reply({ ok: true, id: issue.number, url: issue.html_url }, 201);
  },
};

// User text can't open new "### " fields (the site reads those) or @-mention GitHub users.
const clean = (s, max) => String(s ?? '')
  .replace(/\r\n/g, '\n')
  .replace(/^#{1,6}\s/gm, '')
  .replace(/@(?=\w)/g, '@​')
  .trim()
  .slice(0, max);

export function validate(input) {
  const appId = Number(input.appId);
  if (!Number.isInteger(appId) || appId <= 0 || appId > 99_999_999) return 'Pick the game you played.';
  const game = clean(input.game, 120).replace(/\n/g, ' ');
  if (!game) return 'Pick the game you played.';
  if (!(input.device in DEVICE_IDS)) return 'Pick your handheld.';
  if (!OS.includes(input.os)) return 'Pick your operating system.';
  if (!(input.rating in RATINGS)) return 'Say how well it runs.';
  if (!FPS.includes(String(input.fps))) return 'Pick the frame rate it holds.';
  const battery = String(input.battery ?? '');
  if (!BATTERY.includes(battery)) return 'Pick a battery life from the list.';
  const preset = String(input.preset ?? '');
  if (!PRESETS.includes(preset)) return 'Pick a preset from the list.';
  const settings = clean(input.settings, 1500);
  if (!settings && (!preset || preset === 'My own settings')) return 'Add the settings you used.';
  const notes = clean(input.notes, 1500);
  const name = clean(input.name, 40).replace(/\s+/g, ' ').replace(/[<>[\]()`*_~|]/g, '');
  return {
    appId, game, device: DEVICES[DEVICE_IDS[input.device]], os: input.os, rating: RATINGS[input.rating],
    fps: String(input.fps), battery, preset, settings, notes, name: name || 'Guest',
  };
}

// The same "### Label" layout GitHub's issue form writes, so the site reads both alike.
function body(r) {
  const section = (label, value) => `### ${label}\n\n${value || '_No response_'}`;
  return [
    // Before the first field, so the site doesn't read it as part of one.
    '_Posted from DeckTune without a GitHub account._',
    section('Game', r.game),
    section('Steam app ID', String(r.appId)),
    section('Handheld', r.device),
    section('Operating system', r.os),
    section('How well does it run?', r.rating),
    section('Frame rate', r.fps),
    section('Battery life (hours)', r.battery),
    section('DeckTune preset used', r.preset),
    section('Settings you used', r.settings),
    section('Anything else?', r.notes),
    section('Posted by', r.name),
  ].join('\n\n');
}
