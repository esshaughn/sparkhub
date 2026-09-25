# Feature inventory

Every function and feature in the build, numbered so you can say "scrub 27, 29, 37". Status: **Live** (works, visible), **Test** (built, on the `test` branch, not live yet), **Placeholder** (works, copy is Latin).

As of 2026-09-25: the Spark Hub rebuild from "Spark Torrez - Full Site 3", updated for "Full Site 4" (spec in `design/spark-hub/`). This rebuild restarted the numbering; the list for the old single-group app is in git history (`FEATURES.md` before this date).

## Welcome (signed out)

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Photo block (picnic photo, raised 70px, lighter scrim), logo, "Turn your idea / into a plan." (42px), the 1-2-3 steps as a list | Test | Photo: `photos/welcome.jpg` |
| 2 | **Continue with Google** (opens sign-in straight into *Opening Google…*) and **Continue with email** (sign-in with the email field focused); "New here? Either one creates your account." | Test | |
| 3 | An invite link (/join/CODE) adds "Sign in to join the group CODE"; after signing in, Join opens pre-filled | Test | |
| 4 | (Removed) Group code card, Start a group, How this works link: now only after sign-in / in the tab bar | Test | |

## Home (signed in)

| # | Feature | Status | Notes |
|---|---|---|---|
| 5 | Logo (goes Home); no group switcher on Home | Test | Home spans all your groups |
| 6 | "Turn your idea / into a plan.", the 1-2-3 steps as one plain row, **I have an idea** | Test | Posts to the current group |
| 7 | **Your groups**: one swipeable row of 150×150 photo tiles (pinned first, then most recently opened), ADMIN/OWNER chip, **pin** button (toast "Pinned to the front" / "Unpinned") | Test | Tapping switches group and opens All ideas |
| 8 | **View all** → the **Your groups** bottom sheet (photo, name, chip, *Pinned*; **Join a group**) | Test | |
| 9 | **Coming up**: next 3 dated ideas across your groups, mini calendar | Test | Hidden when nothing is dated |
| 10 | Not in a group yet: **Join with a code** card | Test | Not designed |

## Groups

| # | Feature | Status | Notes |
|---|---|---|---|
| 11 | Group switcher menu (All ideas, How this works): your groups in Home's order, ADMIN/OWNER chip, current one tinted, **+ Join a group** | Test | No new-idea badges any more |
| 12 | **Join a group** pop-up (code, "didn't match" error) | Test | Needs sign-in |
| 13 | (Removed) Start a group: groups are created behind the scenes (Supabase) | Test | `create_group()` still exists for tests and by hand |
| 14 | Invite links `/join/CODE` (and `#/join/CODE`): code filled in; Join opens for someone signed in | Test | Vercel rewrite in `vercel.json` |
| 15 | **Edit group** (owners and admins; Profile → Your groups or **Edit** on All ideas): cover with **Change cover** / **Add a cover**, group name (owners rename in place; admins see a lock), members card → Members sheet, invite code + link with **Copy**, **Delete group** (owners; type DELETE) | Test | Back returns where you came from |
| 15b | **Owners** (up to 2 per group; whoever starts a group). Members sheet (search, *(you)* first): owners **Make admin**, **Make owner**, **Remove**, **Step down**; admins see it read-only. A group always keeps one owner | Test | Owner chip purple, Admin gold |
| 16 | Group photo on Home tiles, the sheet, All ideas header and behind ideas without a photo, framed with the **Photo positioner** (drag, zoom 1–2.5×, Choose a different photo) | Test | New groups fall back to gold |

## All ideas (per group)

| # | Feature | Status | Notes |
|---|---|---|---|
| 17 | Photo header with group name, **All ideas**, **Edit** link (admins), overlapping **I have an idea**; Sort on the left, View on the right | Test | |
| 18 | **View**: Cards · Grid · List, remembered on this device | Test | |
| 19 | **Sort**: Most popular (default) · Happening soon · Newest · Oldest | Test | Happening soon: upcoming dates (soonest first), then no date yet (newest first), then past dates |
| 20 | Card: photo (or the group photo), title, date · time, location, lead's face + "Led by", interest count | Test | "Date TBD" / "Location TBD" in grey |
| 21 | Loading skeletons, "Couldn't load ideas" banner with **Try now**, "No ideas yet." | Test | |

## Idea page

| # | Feature | Status | Notes |
|---|---|---|---|
| 22 | Photo header (framed cover, or the group photo), back, group name, **Edit** (lead, or an admin of the group), **Photo** / **Add a photo** (lead → Photo positioner) | Test | |
| 23 | Title sheet: lead's face, "Led by", **N interested** + face stack (+N) | Test | |
| 24 | **I'm interested** / **You're interested** (not for the lead) | Test | Guests give name + phone first |
| 25 | **Waiting on you** (lead): suggested locations/dates with **Use this location / Use this date** and **Not this time** | Test | |
| 26 | Date & location card: date + time, location + address + **Directions**; **Suggest** (others) or **Set** (lead) while missing | Test | The lead's Set applies at once |
| 27 | **The basics** (up to 3 lines) with lead/member empty states | Test | |
| 28 | What the lead is picturing + **Say more about what you're picturing** | Test | |
| 29 | **Who's pitching in** (accepted offers; your own waiting ones) | Test | |
| 30 | **The vibe** mood board: up to 3 photos, lead adds/removes; tap one to see it full screen (arrows between, ✕ / Escape / tap to close) | Test | Members see it only with photos |
| 31 | Rotated tag after actions ("It's up", "You're interested", "Sent to the lead", "Location set"…) | Test | |
| 32 | Lead's **Who's interested** list with guests' phone numbers (tap the count) | Test | Not designed yet |
| 33 | "That idea isn't up anymore" card for a dead link | Test | |

## Posting and editing

| # | Feature | Status | Notes |
|---|---|---|---|
| 34 | Post flow: event (+ **Post to** your group picker) → location → date (+ time) → the basics → photos (up to 3, **Position the cover**) → **Look good?** → **Put it up** | Test | Post to defaults to the switcher's group; the Lead note is parked |
| 35 | Location suggestions while typing (Geoapify, near Austin), address saved with the pick | Test | Kept by owner decision; the design had removed them |
| 36 | **Put it up** needs sign-in ("Sign in to post"), then a name if missing | Test | |
| 37 | Edit idea: title + the basics; **Delete this idea** (removes its photos) | Test | |

## Sign-in, guests, profile

| # | Feature | Status | Notes |
|---|---|---|---|
| 38 | Sign-in pop-up: **Continue with Google**, email → 6-digit code, **Send it again** (one a minute), per-entry copy (post / join / guest) | Test | |
| 39 | Google cancelled: inline "didn't finish" alert; a half-finished idea survives the trip | Test | |
| 40 | Guests: **Your info** pop-up (name + phone, once per visit) before interest or suggesting | Test | Phone visible to that idea's lead only |
| 41 | Name pop-up (first time a signed-in person needs a name) | Test | |
| 42 | Signing in on a new phone moves that phone's anonymous activity into the account | Test | |
| 43 | Profile: photo, name, email, **Edit**; Your ideas; Your groups (ADMIN first); Join with a code; Start a group; **Sign out**; Privacy | Test | Signed-in only |
| 44 | **Edit profile**: photo add/change/remove, name, email change with a code (email sign-ins) | Test | Google email is read-only |

## Pages and emails

| # | Feature | Status | Notes |
|---|---|---|---|
| 45 | How this works | Placeholder | Latin body, as designed |
| 46 | Privacy page (`/privacy.html`), redesigned with who-sees-it chips | Test | |
| 47 | Sign-in emails: code, and confirm email (first sign-in or email change) | Test | `supabase/templates/`, sender Spark Hub via Resend |
| 48 | Toasts (errors red "!", confirmations green ✓) | Test | |

## Data and security

| # | Feature | Status | Notes |
|---|---|---|---|
| 49 | Tables: groups, memberships, sparks, offers, interests, profiles, guest_contacts, link_access, merge_tokens | Test | Migration `20260925000000_spark_hub_groups.sql` |
| 50 | Members see their groups' ideas; an idea's link opens just that idea for anyone | Test | `open_idea()` |
| 51 | Functions: create_group, join_group, group_code, member_count, add_offer, resolve_offer, rename_me, open_idea, prepare/complete_merge | Test | |
| 52 | Photo bucket `spark-photos` (own-folder rules): idea photos, mood photos, avatars | Live | |
| 53 | Live and test databases; migrations | Live | |

## Operations

| # | Feature | Status | Notes |
|---|---|---|---|
| 54 | Daily keep-alive ping (GitHub Action) | Live | |
| 55 | Weekly live backup on the Mac (launchd → ~/Backups/sparkhub) | Live | Saves every table that exists |
| 56 | Design handoff doc kept current by Claude Code | Live | |
| 57 | Vercel auto-deploy from `main`; previews from `test` | Live | |
| 58 | Security headers + CSP; pinned, integrity-checked Supabase script | Live | |
| 59 | Automated end-to-end tests (15: smoke, posting, groups, collaboration, Google, database security) | Test | `tests/` |
| 60 | Nightly cleanup of test-database leftovers ([E2E] ideas and groups, old anonymous users) | Live | Test project only |

## Removed in this rebuild

- Date voting (date options, ranks, lock-in) and the RSVP pop-up.
- The Walktober hero card, "What should we get up to?" Home, category filter, questions screen.
- Progress / "N of 3 in place", checkpoints, "Everything's in place" card.
- "I can help with something" and the offer chips at the bottom of the idea page.
- "Signed in with" row and the lead-only sign-in copy on Profile.
