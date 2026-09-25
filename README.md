# Spark Hub

A mobile-first web app where a group (a gym, a neighbourhood, a PTA…) posts rough ideas ("laser tag night") and everyone else fills in the details until the idea becomes a plan. One account works across groups; Torrez Fitness is one group. Built from the Claude Design handoff "Spark Torrez - Full Site 3" (`Spark Hub App.dc.html`).

## Stack

- Static HTML, CSS and JS. There's no build step or framework.
- Hosted on Vercel.
- Data lives in Supabase: a **live** project for the real site and a **test** project for previews and local work. The schema is in [`supabase/migrations/`](supabase/migrations/).

## Structure

```
index.html          app shell
css/sparks.css      frame, pseudo-states (most styling is inline, ported 1:1 from the design)
js/sparks.js        state, views, and a small DOM morph renderer
privacy.html        the privacy page
photos/             images
js/config.js        picks the live or test database by hostname
supabase/           migrations (tables, row-level security, RPC functions), sign-in email templates, CLI config
scripts/            weekly backup of the live database (runs on the owner's Mac)
.github/workflows/  daily ping that keeps the free Supabase projects from pausing
```

## Run locally

Any static file server works. Locally the app uses the **test** database:

```bash
npx serve .
```

## Tests

End-to-end tests in `tests/` drive a real browser through the app against the **test** database (localhost always uses test, never live). GitHub runs them on every push to `test` and `main`; a red ✗ on the commit means don't merge.

Run them locally:

```bash
cd tests && npm install && npx playwright install chromium && npx playwright test
```

`npx playwright test --headed` shows the browser; `npx playwright show-report` opens the last results.

## Deploy

Live at **https://gosparkhub.vercel.app**. Pushes to `main` deploy automatically through Vercel's GitHub integration.

Both Supabase projects need anonymous sign-ins turned on (`supabase/config.toml`). Database changes, backups and the live/test split are described in [CLAUDE.md](CLAUDE.md).
