# DeckTune

Steam Deck and ROG Ally settings for every Steam game, plus performance reports shared by players.
A static site on GitHub Pages: no server, no AI, no running costs.

## How it works

- `public/data/profiles/` holds the Max Battery / Optimal / Max Performance presets for each game.
  ROG Ally presets are converted from them in the browser (`src/lib/profiles.ts`).
- `public/data/catalog.json` is every released Steam game, and `facts.json` the ProtonDB tier and
  Steam Deck Verified rating. GitHub Actions refreshes both daily.
- Player reports are GitHub issues. Visitors fill in DeckTune's own form (a game page's or the
  Community page's **Share your report**), then either post straight from the site with no account,
  through the report service in `worker/`, or open a filled-in GitHub issue with their own account.
  Every new, edited or closed issue rebuilds the site, so a report shows up a few minutes later.
- Frame rates are always ones a handheld can lock to (30, 40, 45, 60, 90, 120): presets are shown
  that way (`src/lib/fps.ts`) and reports pick from that list.

## Moderating reports

Close an issue, or add the label `hidden` (or `spam`), and the next build drops it from the site.
Lock an issue or block a user from GitHub as usual. Reports posted without an account carry the
label `guest` and show the name the poster typed.

## Posting without a GitHub account (optional, free)

The report service is a Cloudflare Worker on the free plan. It holds a GitHub token the site never
sees, and files each report as an issue. Without it the site still works: posting goes through GitHub.

1. Create a fine-grained GitHub token (GitHub → Settings → Developer settings → Fine-grained tokens):
   repository access **only this repository**, permission **Issues: Read and write**.
2. Deploy the worker (a free Cloudflare account; `wrangler login` opens a browser to sign in):
   ```bash
   cd worker
   npx wrangler login
   npx wrangler deploy
   npx wrangler secret put GITHUB_TOKEN
   ```
   `deploy` prints the service's address, like `https://decktune-reports.<you>.workers.dev`.
3. In this repository, **Settings → Secrets and variables → Actions → Variables**, add
   `REPORT_API` with that address, then run the **Build and deploy** workflow.

Optional bot check: create a Turnstile widget in the Cloudflare dashboard for
`ferencmolnar24.github.io`, run `npx wrangler secret put TURNSTILE_SECRET` with its secret key,
and add its site key as the Actions variable `TURNSTILE_SITEKEY`.

## Running it locally

```bash
npm install
npm run dev
```
