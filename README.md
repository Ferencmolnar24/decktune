# DeckTune

Steam Deck and ROG Ally settings for every Steam game, plus performance reports shared by players.
A static site on GitHub Pages: no server, no AI, no running costs.

## How it works

- `public/data/profiles/` holds the Max Battery / Optimal / Max Performance presets for each game.
  ROG Ally presets are converted from them in the browser (`src/lib/profiles.ts`).
- `public/data/catalog.json` is every released Steam game, and `facts.json` the ProtonDB tier and
  Steam Deck Verified rating. GitHub Actions refreshes both daily.
- Player reports are GitHub issues filed through the "Performance report" form. Every new, edited or
  closed issue rebuilds the site, so a report shows up a few minutes after it's posted.

## Moderating reports

Close an issue, or add the label `hidden`, and the next build drops it from the site. Lock an issue
or block a user from GitHub as usual.

## Running it locally

```bash
npm install
npm run dev
```
