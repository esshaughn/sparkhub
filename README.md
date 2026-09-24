# Sparks — Torrez Fitness

A mobile-first web app where Torrez Fitness members post rough ideas ("laser tag night") and everyone else fills in the details until the idea becomes a plan. It was rebuilt from the Claude Design handoff `Walktober App.dc.html`.

## Stack

- Static HTML, CSS and JS. There's no build step or framework.
- Hosted on Vercel.
- Data lives in Supabase: a **live** project for the real site and a **test** project for previews and local work. The schema is in [`supabase/migrations/`](supabase/migrations/).

## Structure

```
index.html          app shell
css/sparks.css      frame, pseudo-states (most styling is inline, ported 1:1 from the design)
js/sparks.js        state, views, and a small DOM morph renderer
photos/             images
js/config.js        picks the live or test database by hostname
supabase/           migrations (tables, row-level security, RPC functions) + CLI config
scripts/            weekly backup of the live database (runs on the owner's Mac)
.github/workflows/  daily ping that keeps the free Supabase projects from pausing
```

## Run locally

Any static file server works. Locally the app uses the **test** database:

```bash
npx serve .
```

## Deploy

Live at **https://torrezhub.vercel.app**. Pushes to `main` deploy automatically through Vercel's GitHub integration.

Both Supabase projects need anonymous sign-ins turned on (`supabase/config.toml`). Database changes, backups and the live/test split are described in [CLAUDE.md](CLAUDE.md).
