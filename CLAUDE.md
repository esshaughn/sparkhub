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

## Two databases: live and test

| | Supabase project | Ref | Used by |
|---|---|---|---|
| **live** | torrezhub | `xwrzfpgsazyrgieymtee` | https://torrezhub.vercel.app only |
| **test** | torrezhub-test | `hroxgvxvafgikikviiud` | Vercel previews, localhost, everything else |

`js/config.js` picks the database by hostname (`LIVE_HOSTS`). **Add any new production domain there**, or it'll silently use the test database.

This folder is linked to **test** (`supabase link`), so `--linked` commands hit test unless you pass `--project-ref xwrzfpgsazyrgieymtee`. Keep it that way.

## Database changes (migrations)

The schema is the files in `supabase/migrations/`, applied in order. Never edit an applied migration. Add a new one.

1. `supabase migration new <short_name>` and write the SQL (keep RLS: RSVP names and phones must stay readable only by the spark's lead).
2. Apply to **test**: `supabase db push --linked` → try it on the `test` branch preview.
3. Apply to **live**, only when the matching code is being merged to `main` and the user has agreed: `supabase link --project-ref xwrzfpgsazyrgieymtee && supabase db push --linked; supabase link --project-ref hroxgvxvafgikikviiud` (always relink to test afterwards).
4. Check with `supabase migration list --linked [--project-ref …]`.

Ad-hoc reads: `supabase db query --linked [--project-ref …] "select …"`.

**Never run `supabase config push` against live** without showing the user the diff first. It pushes `supabase/config.toml`'s settings (auth, storage…) over the dashboard's. `enable_anonymous_sign_ins` must stay `true` or the app breaks.

## Keep-alive and backups

- `.github/workflows/keep-supabase-awake.yml` pings both projects daily so the free plan doesn't pause them. It only runs from `main`, and GitHub disables it after 60 days without commits.
- `scripts/backup-live.sh` dumps every live table to `~/Backups/torrezhub/<date>/` as JSON (keeps 12). It runs weekly on the user's Mac via launchd (`scripts/install-backup.sh`; rerun the installer after editing the script). Backups contain names and phone numbers: **never commit or upload them.**
- To restore: apply migrations to an empty project, recreate `auth.users` rows from `users.json`, then insert the table files in order: sparks (without `locked_date_id`), date_options, then set `locked_date_id`, offers, rsvps.

## Working in a cloud session (e.g. started from the Claude mobile app)

- `git push` is all a deploy needs. Vercel builds from GitHub, so no Vercel CLI or token is required.
- Database changes need the Supabase CLI plus a `SUPABASE_ACCESS_TOKEN` in the cloud environment's settings. Use `npx -y supabase@latest …` with the commands above. If the token isn't set, write the migration file and tell the user it still needs applying rather than skipping it.
- Preview locally with `npx -y serve .` if you need to click through the app. Localhost uses the test database.

## Other notes

- Bump the `?v=` query on script/style tags in `index.html` when their files change, so browsers don't serve stale copies.
- `.vercelignore` keeps docs, `supabase/`, `scripts/` and `.github/` off the public site. New non-site files belong there too.
