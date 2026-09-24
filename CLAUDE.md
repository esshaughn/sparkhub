# Sparks — Torrez Fitness

Static HTML/CSS/JS app (no build step), Supabase for data, deployed by Vercel on every push to `main`. See README.md for structure.

## Keep HANDOFF-to-design.md current

`HANDOFF-to-design.md` tells Claude Design how the live app differs from the last design file. Update it **in the same commit** as any change a user could see or do differently: layout, copy, screens, flows, states (empty/loading/error), what data is shown and to whom.

- New visible change → add a row to **§1 What changed** (change · what the design said · why).
- New UI the design never specified → add it to **§2 Things the build had to invent**, with the exact copy and key colors/sizes.
- Behaviour with no visual change (routing, permissions, sync) → **§3**.
- Something designed that's missing or broken → **§4**. A decision only Design can make → **§5 Open questions**.
- If a change undoes or supersedes an existing entry, edit or remove that entry. Don't stack contradictions.
- Bump the **As of** date.
- Skip it for pure refactors, performance, dependency bumps or infra changes with no user-facing effect.

When the user says a design round has absorbed the doc ("design synced", a new .dc.html handoff arrives, etc.), reset it: make the new design file the **Baseline**, clear §1–§4, and keep only the §5 questions that are still open.

## Branches and deploys

- `main` is live at https://torrezhub.vercel.app; every push to it publishes.
- `test` is the working branch. Commit day-to-day changes there, push, and share the Vercel preview link (`gh api repos/esshaughn/torrezhub/deployments` or `vercel ls`). Merge into `main` only when the user asks.

## Working in a cloud session (e.g. started from the Claude mobile app)

- `git push` is all a deploy needs. Vercel builds from GitHub, so no Vercel CLI or token is required.
- Database changes need the Supabase CLI plus a `SUPABASE_ACCESS_TOKEN` in the cloud environment's settings. Run it as `npx -y supabase@latest db query --linked --project-ref xwrzfpgsazyrgieymtee -f <file>`. If the token isn't set, write the SQL into `supabase/` and tell the user it still needs applying rather than skipping it.
- Preview locally with `npx -y serve .` if you need to click through the app.

## Working notes

- Supabase project ref `xwrzfpgsazyrgieymtee`. Schema lives in `supabase/schema.sql`. Apply database changes with `supabase db query --linked --project-ref xwrzfpgsazyrgieymtee -f <file>` and keep `schema.sql` in sync.
- RSVP names/phones must stay readable only by the spark's lead. Check row-level security before changing anything that touches `rsvps`.
- Bump the `?v=` query on script/style tags in `index.html` when their files change, so browsers don't serve stale copies.
- `.vercelignore` keeps docs and `supabase/` off the public site. New non-site files belong there too.
