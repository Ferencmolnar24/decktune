# DeckTune

Steam Deck and ROG Ally settings for every Steam game, plus performance reports shared by players.
A static site on GitHub Pages: no server, no AI, no running costs.

## How it works

- `public/data/profiles/` holds the Max Battery / Optimal / Max Performance presets for each game.
  ROG Ally presets are converted from them in the browser (`src/lib/profiles.ts`).
- `public/data/catalog.json` is every released Steam game, and `facts.json` the ProtonDB tier and
  Steam Deck Verified rating. GitHub Actions refreshes both daily.
- Player reports are posted with DeckTune's own form (**Share your report** on a game page or the
  Community page). They go into a free Supabase database and show up instantly; visitors can mark
  them helpful. Older reports filed as GitHub issues still show too (`scripts/build-reports.mjs`).
  Without the database configured, the form opens a filled-in GitHub issue instead.
- Frame rates are always ones a handheld can lock to (30, 40, 45, 60, 90, 120): presets are shown
  that way (`src/lib/fps.ts`) and reports pick from that list.

## Moderating reports

Reports posted on the site: in Supabase, **Table Editor → reports**, set `hidden` to true (or
delete the row). Reports filed on GitHub: close the issue or label it `hidden`.

## Setting up the report database (free)

1. Sign in at https://supabase.com (Continue with GitHub works) and create a project on the free plan.
2. In the project, open **SQL Editor**, paste all of `supabase/setup.sql` and press **Run**.
3. Open **Project Settings → API** (or **Data API**), copy the **Project URL** and the **anon / publishable**
   key into `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`, then commit and push.

Both values are public by design: the database only lets visitors read visible reports, post new
ones (3 per 10 minutes each) and vote once per report. The daily build reads it once so the free
project never pauses for inactivity.

## Running it locally

```bash
npm install
npm run dev
```
