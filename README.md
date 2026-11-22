# DeckTune

Steam Deck and ROG Ally settings for every Steam game, plus performance reports shared by players.
A static site on GitHub Pages: no server, no AI, no running costs.

## How it works

- `public/data/profiles/` holds the Max Battery / Optimal / Max Performance presets for each game.
  ROG Ally presets are converted from them in the browser (`src/lib/profiles.ts`).
- `public/data/catalog.json` is every released Steam game, and `facts.json` the ProtonDB tier and
  Steam Deck Verified rating. GitHub Actions refreshes both daily.
- Player reports are posted with DeckTune's own form (**Share your report** on a game page or the
  Community page). They go into a free Supabase database and show up instantly. Visitors can mark
  them helpful or flag them, and the browser that posted a report can edit or delete it (it keeps a
  private key; the database stores only the key's hash).
- Under each preset, "Did this preset work for you?" collects one-tap answers per game, handheld
  and preset.
- Battery times for presets are estimates from the preset's power draw and the handheld's battery
  (`src/lib/battery.ts`), adjusted for the visitor's model and battery health.
- Frame rates are always ones a handheld can lock to (30, 40, 45, 60, 90, 120): presets are shown
  that way (`src/lib/fps.ts`) and reports pick from that list.

## Moderating reports

In Supabase, **Table Editor → reports**:

- To hide a report, set `hidden` to true. To remove it for good, delete the row.
- A report flagged by 3 different visitors hides itself. Filter on `hidden` = true to review them;
  to put one back, set `hidden` to false and `flags` to 0.

**Table Editor → preset_scores** lists the presets players said didn't work, worst first, with a
link to each game's page.

## Setting up the report database (free)

1. Sign in at https://supabase.com (Continue with GitHub works) and create a project on the free plan.
2. In the project, open **SQL Editor**, paste all of `supabase/setup.sql` and press **Run**.
   Running it again is safe, and is how an existing project gets newer parts of the setup.
3. Open **Project Settings → API** (or **Data API**), copy the **Project URL** and the **anon / publishable**
   key into `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`, then commit and push.

Both values are public by design: the database only lets visitors read visible reports, post new
ones (3 per 10 minutes each), vote and flag once per report, answer the preset question, and edit
or delete a report only with the key its browser was given. The daily build reads it once so the free
project never pauses for inactivity.

## Running it locally

```bash
npm install
npm run dev
```
