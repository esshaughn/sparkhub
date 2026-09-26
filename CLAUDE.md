# Spark Hub

One app, many groups (Torrez Fitness is one, code TORREZ). Static HTML/CSS/JS (no build step), Supabase for data, deployed by Vercel on every push to `main`. See README.md for structure.

**Renamed 2026-09-25:** live address https://gosparkhub.vercel.app (the Vercel project is `gosparkhub`; the old torrezhub.vercel.app redirects), GitHub repo `esshaughn/sparkhub`, Supabase projects `sparkhub` / `sparkhub-test`, backups in `~/Backups/sparkhub` (launchd `com.sparkhub.backup`). Only this local folder is still called `sparks-torrez`.

## Design files

`design/spark-hub/` holds the current design spec (`README.md`, the decision log, and the clickable `Spark Hub App.dc.html` prototype; open it with `support.js` beside it). Photos, screenshots and explorations stay in the design zip. Where the README and `HANDOFF-to-design.md` disagree, the handoff records the owner's later decisions.

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

- `main` is live at https://gosparkhub.vercel.app; every push to it publishes.
- `test` is the working branch. Commit day-to-day changes there, push, and share the Vercel preview link (`gh api repos/esshaughn/sparkhub/deployments` or `vercel ls`). Merge into `main` only when the user asks.

## Two databases: live and test

| | Supabase project | Ref | Used by |
|---|---|---|---|
| **live** | sparkhub | `xwrzfpgsazyrgieymtee` | https://gosparkhub.vercel.app (and the old torrezhub.vercel.app) |
| **test** | sparkhub-test | `hroxgvxvafgikikviiud` | Vercel previews, localhost, everything else |

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
- `scripts/backup-live.sh` dumps every live table to `~/Backups/sparkhub/<date>/` as JSON (keeps 12). It runs weekly on the user's Mac via launchd (`scripts/install-backup.sh`; rerun the installer after editing the script). Backups contain names and phone numbers: **never commit or upload them.**
- The backup saves every public table that exists (it lists them first), so it keeps working as migrations add and drop tables.
- To restore: apply migrations to an empty project, recreate `auth.users` rows from `users.json`, then insert the table files in order: groups, memberships, profiles, sparks, offers, interests, guest_contacts, link_access, then the plan tables (rsvps, date_options, date_votes, spot_options, spot_votes, signup_items, signup_claims, plan_updates, organizers, plan_prep, album_photos). (Backups from before 2026-09-25 have an older date_options/rsvps shape from the first build; don't restore those into the new tables.)

## Working in a cloud session (e.g. started from the Claude mobile app)

- `git push` is all a deploy needs. Vercel builds from GitHub, so no Vercel CLI or token is required.
- Database changes need the Supabase CLI plus a `SUPABASE_ACCESS_TOKEN` in the cloud environment's settings. Use `npx -y supabase@latest …` with the commands above. If the token isn't set, write the migration file and tell the user it still needs applying rather than skipping it.
- Preview locally with `npx -y serve .` if you need to click through the app. Localhost uses the test database.

## Tests

- `tests/` holds Playwright end-to-end tests (smoke, posting, groups, collaboration, Google sign-in, database security). Run `cd tests && npx playwright test` before merging to `main`, and check the "End-to-end tests" workflow on GitHub is green.
- New features get a test in the same commit; removed features lose theirs. Security rules (RLS, grants, storage policies) get an assertion in `e2e/security.spec.js`.
- Tests create ideas titled `[E2E] …` and delete them in `finally`. Each simulated member is a new anonymous sign-in. Posting needs a signed-in lead in a group, so `newLead()` signs in as `e2e-lead-1@example.com` / `e2e-lead-2@example.com` (both Torrez Fitness members; group tests also create `[E2E] …` groups) (password accounts on the TEST project only; password in git-ignored `tests/.env` and the `E2E_LEAD_PASSWORD` repo secret). The real email-code flow can't be automated (no inbox), so check it by hand on the preview after changing sign-in code.
- The TEST project has a raised anonymous sign-in limit (1000/hour, pushed with a temp config; the repo's `config.toml` keeps live's 30/hour) and a nightly `e2e-cleanup` job (`supabase/test-only/nightly-cleanup.sql`) that removes old anonymous users and stray `[E2E]` ideas and groups; the same file adds `e2e_delete_group()` so tests delete the `[E2E]` groups they start (starting groups is limited to 10 per account per hour). Never apply `test-only/` SQL to live. `test-only/pending-invites.sql` pre-assigns groups to a tester's email before they sign in (currently torrezfitness@gmail.com and torrez.fitness@gmail.com).

## Feature inventory

`FEATURES.md` numbers every feature with a status. When you add or remove a feature, update it in the same commit (add a row, or delete the row and renumber only if the user asks).

## Security rules the code relies on

- Clients can only UPDATE these `sparks` columns: text, hopes, spot, spot_open, day, day_date, day_time, spot_address, spot_lat, spot_lon, vision, mood, cover_pos (column grants, `20260925000000_spark_hub_groups.sql`), plus planned, visibility, auto_remind, min_people (`20260926000000_plans.sql`). Anything else goes through a `security definer` function. A new editable column needs a new grant in a migration.
- Groups: members see their groups' ideas; `open_idea()` records an idea link in `link_access`, which lets that visitor see that one idea. `groups.code` isn't a readable column (only `group_code()` for admins). Admins of a group can delete any of its ideas (policy) and edit their text/basics only through `admin_edit_spark()`. Group photos and their framing change only through `set_group_photo()` (admins, and only to a photo in their own storage folder); idea covers through `set_idea_cover()` (lead) or the lead's `cover_pos` update. Owners rename/delete groups with `rename_group()` / `delete_group()`. Members may update only their own `last_seen_at` and `pinned`. Memberships are created only by `create_group()` / `join_group()`. Joining, starting a group and posting require a signed-in (non-anonymous) account (`is_signed_in()`).
- Plans (V5, `20260926000000_plans.sql`): a spark with `planned = true` must have `day_date` and `day_time` (constraint). Who sees a spark is `can_see_spark_row()` (the sparks policy, which checks the row's own columns so an insert can return its row) / `can_see_spark(id)` (every child table): link holders, or members when it's `visibility = 'group'`, they lead it, run the group, or have replied. RSVPs only on planned sparks, only for yourself. Only the lead sets a sign-up's `need`, posts `plan_updates` and reads/writes `plan_prep`; a trigger refuses claims past `need`. `make_plan()` / `clear_plan()` are lead-only (interest ↔ Going). Album photo paths follow the photo path rule. Temporary demo plans come from `scripts/demo/seed-v5.py` (after `seed-demo.py`). `my_group_sizes()` returns member counts only for the caller's own groups (Groups page).
- Roles are owner / admin / member (owners count as admins everywhere via `is_admin()`). In the app, owners change roles with `set_member_role()` (max two owners, never zero, enforced by a trigger and the function). By hand, admins are per database: set with `update public.memberships set role = 'admin' where user_id = (select id from auth.users where email = '…') and group_id = (select id from public.groups where code = 'TORREZ')`. On test, esshaughn@gmail.com runs Torrez Fitness.
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
- Installable as a home-screen app: `manifest.json` + the iOS tags in `index.html`; icons in `icons/` are rendered by `node scripts/make-icons.js` (uses the tests' Playwright). No service worker yet, so there's nothing to cache-bust there. On iPhone the installed app has its own storage, separate from Safari (a fresh sign-in).
- Installed iPhone app quirks (iOS 26, `black-translucent` status bar): 100%/100dvh/innerHeight come out short by the status bar on first launch, leaving a band under the tab bar. Fixed (confirmed on the owner's iPhone 15, 2026-09-25) by `height: 100lvh` for `html, body, .app` under `@media (display-mode: standalone)` plus a one-pixel scroll nudge after load (`nudgeLayout` in sparks.js). Don't switch these back to 100dvh or size the app from `screen.height` in JS (iOS clips the drawn area).
- Bump the `?v=` query on script/style tags in `index.html` when their files change, so browsers don't serve stale copies.
- `.vercelignore` keeps docs, `supabase/`, `scripts/`, `tests/` and `.github/` off the public site. New non-site files belong there too.
