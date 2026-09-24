# Spark Hub

One app, many groups (Torrez Fitness is one, code TORREZ). Static HTML/CSS/JS (no build step), Supabase for data, deployed by Vercel on every push to `main`. See README.md for structure.

**Rename in progress:** the project is becoming Spark Hub everywhere. The repo, Vercel project, live address, Supabase display names, backup folder/launchd label and this folder still say torrezhub / sparks-torrez; they switch at the redesign launch, together (the owner chose that timing on 2026-09-24). sparkhub.vercel.app is taken by someone else; the new address is still to be chosen.

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

1. `supabase migration new <short_name>` and write the SQL (keep RLS: guests' phone numbers in `guest_contacts` must stay readable only by that idea's lead and the guest).
2. Apply to **test**: `supabase db push --linked` → try it on the `test` branch preview.
3. Apply to **live**, only when the matching code is being merged to `main` and the user has agreed: `supabase link --project-ref xwrzfpgsazyrgieymtee && supabase db push --linked; supabase link --project-ref hroxgvxvafgikikviiud` (always relink to test afterwards).
4. Check with `supabase migration list --linked [--project-ref …]`.

Ad-hoc reads: `supabase db query --linked [--project-ref …] "select …"`.

**Never run `supabase config push` against live** without showing the user the diff first. It pushes `supabase/config.toml`'s settings (auth, storage…) over the dashboard's. `enable_anonymous_sign_ins` must stay `true` or the app breaks.

## Keep-alive and backups

- `.github/workflows/keep-supabase-awake.yml` pings both projects daily so the free plan doesn't pause them. It only runs from `main`, and GitHub disables it after 60 days without commits.
- `scripts/backup-live.sh` dumps every live table to `~/Backups/torrezhub/<date>/` as JSON (keeps 12). It runs weekly on the user's Mac via launchd (`scripts/install-backup.sh`; rerun the installer after editing the script). Backups contain names and phone numbers: **never commit or upload them.**
- The backup saves every public table that exists (it lists them first), so it keeps working as migrations add and drop tables.
- To restore: apply migrations to an empty project, recreate `auth.users` rows from `users.json`, then insert the table files in order: groups, memberships, profiles, sparks, offers, interests, guest_contacts, link_access. (Backups from before 2026-09-25 have date_options and rsvps instead of the group tables; those features no longer exist.)

## Working in a cloud session (e.g. started from the Claude mobile app)

- `git push` is all a deploy needs. Vercel builds from GitHub, so no Vercel CLI or token is required.
- Database changes need the Supabase CLI plus a `SUPABASE_ACCESS_TOKEN` in the cloud environment's settings. Use `npx -y supabase@latest …` with the commands above. If the token isn't set, write the migration file and tell the user it still needs applying rather than skipping it.
- Preview locally with `npx -y serve .` if you need to click through the app. Localhost uses the test database.

## Tests

- `tests/` holds Playwright end-to-end tests (smoke, posting, groups, collaboration, Google sign-in, database security). Run `cd tests && npx playwright test` before merging to `main`, and check the "End-to-end tests" workflow on GitHub is green.
- New features get a test in the same commit; removed features lose theirs. Security rules (RLS, grants, storage policies) get an assertion in `e2e/security.spec.js`.
- Tests create ideas titled `[E2E] …` and delete them in `finally`. Each simulated member is a new anonymous sign-in. Posting needs a signed-in lead in a group, so `newLead()` signs in as `e2e-lead-1@example.com` / `e2e-lead-2@example.com` (both Torrez Fitness members; group tests also create `[E2E] …` groups) (password accounts on the TEST project only; password in git-ignored `tests/.env` and the `E2E_LEAD_PASSWORD` repo secret). The real email-code flow can't be automated (no inbox), so check it by hand on the preview after changing sign-in code.
- The TEST project has a raised anonymous sign-in limit (1000/hour, pushed with a temp config; the repo's `config.toml` keeps live's 30/hour) and a nightly `e2e-cleanup` job (`supabase/test-only/nightly-cleanup.sql`) that removes old anonymous users and stray `[E2E]` ideas and groups. Never apply `test-only/` SQL to live. `test-only/pending-invites.sql` pre-assigns groups to a tester's email before they sign in (currently torrezfitness@gmail.com).

## Feature inventory

`FEATURES.md` numbers every feature with a status. When you add or remove a feature, update it in the same commit (add a row, or delete the row and renumber only if the user asks).

## Security rules the code relies on

- Clients can only UPDATE these `sparks` columns: text, hopes, spot, spot_open, day, day_date, day_time, spot_address, spot_lat, spot_lon, vision, mood (column grants, `20260925000000_spark_hub_groups.sql`). Anything else goes through a `security definer` function. A new editable column needs a new grant in a migration.
- Groups: members see their groups' ideas; `open_idea()` records an idea link in `link_access`, which lets that visitor see that one idea. `groups.code` isn't a readable column (only `group_code()` for admins). Memberships are created only by `create_group()` / `join_group()`, and members can update only their own `last_seen_at`. Joining, starting a group and posting require a signed-in (non-anonymous) account (`is_signed_in()`).
- Admins are per database: set with `update public.memberships set role = 'admin' where user_id = (select id from auth.users where email = '…') and group_id = (select id from public.groups where code = 'TORREZ')`. On test, esshaughn@gmail.com runs Torrez Fitness.
- Photo paths (idea photos, mood photos, avatars) must be `<uploader uid>/<uuid>.jpg`; the DB checks the shape and the insert policy checks the uid. `PHOTO_PATH` in sparks.js mirrors it. Don't build image URLs from unvalidated strings.
- `vercel.json` sets the Content-Security-Policy. Adding any new external script, style, font, image or API host means adding it there first, or production breaks silently (check the browser console for "Refused to…").
- `index.html` pins supabase-js with an `integrity` hash. When bumping the version, recompute: `curl -s <new url> | openssl dgst -sha384 -binary | openssl base64 -A`.
- All user text is rendered through `esc()`. Never concatenate raw strings into HTML or `style` attributes.

## Other notes

- People sign in with Google or a 6-digit email code (Supabase email OTP). New email: `updateUser({ email })` + `verifyOtp({ type: 'email_change' })` links it to the anonymous session (same user id). Existing email: `signInWithOtp` + `verifyOtp({ type: 'email' })`, then `complete_merge` moves the anonymous session's activity across. Guests (not signed in) can show interest and suggest, after leaving a name + phone (`guest_contacts`).
- "Continue with Google" (`googleSignIn` in `js/config.js`, per database): anonymous users `linkIdentity` (same user id); if that Google account already exists Supabase returns `identity_already_exists` and the app does `signInWithOAuth` + `complete_merge`. The page reloads on return, so the draft (photos as data URLs), merge token and name are parked in sessionStorage (`spark-hub-google-resume`), with where sign-in started (post / join / group / profile) so the app picks up there. The client uses `flowType: 'pkce'` so the return lands in `?code=` and not in our `#/` routes. Each Supabase project needs: the Google provider (client ID + secret), "Allow manual linking", and the site in Auth → URL Configuration. Names: the app's name is `user_metadata.display_name` (Google overwrites `name` with the full name on every sign-in).
- Email goes out through Resend as custom SMTP (sender `sparks@mail.ericscott-creative.com`, name Spark Hub; DNS for `mail.ericscott-creative.com` is at Hostinger). The two templates are in `supabase/templates/` and use `{{ .Token }}` (the confirm one branches on `{{ if .Email }}`: set for a Profile email change, empty for a first sign-in); they're pushed to TEST, and pasted into live by hand (Auth → Emails: "Magic Link" and "Change Email Address"). After changing a template, send yourself a code to check it: on 2026-09-24 a CLI `config push` updated the dashboard but kept sending the old email until the template was re-saved in the dashboard. Keep the root MX/SPF of ericscott-creative.com alone: it serves Google Workspace mail.
- Location suggestions use Geoapify's autocomplete from the browser (`findPlaces` in sparks.js; key and home area in `js/config.js`; `api.geoapify.com` in the CSP). The key is public by design and locked to our sites in the Geoapify dashboard (myprojects.geoapify.com → Spark Hub → API keys). Tests fake the responses (`mockPlaces` in helpers.js) so they never spend the daily 3,000 lookups. A pick saves `spot_address`, `spot_lat`, `spot_lon`; clients can't update those, and a trigger clears them when `spot` changes.
- Invite links are `/join/CODE` (a rewrite in `vercel.json`; asset paths in index.html are absolute so that path works). Tests use `#/join/CODE`.
- Photos live in the public `spark-photos` bucket under `<user id>/<uuid>.jpg`. Storage policies only let people write, list or delete inside their own folder.
- Bump the `?v=` query on script/style tags in `index.html` when their files change, so browsers don't serve stale copies.
- `.vercelignore` keeps docs, `supabase/`, `scripts/`, `tests/` and `.github/` off the public site. New non-site files belong there too.
