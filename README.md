# Sparks — Torrez Fitness

A mobile-first web app where Torrez Fitness members post rough ideas ("laser tag night") and everyone else fills in the details until the idea becomes a plan. It was rebuilt from the Claude Design handoff `Walktober App.dc.html`.

## Stack

- Static HTML, CSS and JS. There's no build step or framework.
- Hosted on Vercel.
- Data lives in Supabase. Setup is in [`supabase/schema.sql`](supabase/schema.sql).

## Structure

```
index.html          app shell
css/sparks.css      frame, pseudo-states (most styling is inline, ported 1:1 from the design)
js/sparks.js        state, views, and a small DOM morph renderer
photos/             images
supabase/schema.sql tables, row-level security, and RPC functions
```

## Run locally

Any static file server works:

```bash
npx serve .
```

## Deploy

Pushes to `main` deploy automatically through Vercel's GitHub integration.
