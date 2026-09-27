# Feature inventory

Every function and feature in the build, numbered so you can say "scrub 27, 29, 37". Status: **Live** (works, visible), **Test** (built, on the `test` branch, not live yet), **Placeholder** (works, copy is Latin).

As of 2026-09-25: the Spark Hub rebuild from "Spark Torrez - Full Site 3", updated for "Full Site 4" (spec in `design/spark-hub/`). This rebuild restarted the numbering; the list for the old single-group app is in git history (`FEATURES.md` before this date).

## Install

| # | Feature | Status | Notes |
|---|---|---|---|
| 0 | **Add to Home Screen**: web app manifest + iOS tags, so it opens full-screen with the Spark Hub icon (gold bolt on purple). On iPhone the page runs under the status bar (white time/battery): photos go to the top on Welcome, All ideas and idea pages; other screens stay white behind it (status text hard to see there, for now) | Test | Icons in `icons/`, redrawn by `scripts/make-icons.js`; no service worker yet |

## Welcome (signed out)

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Welcome: picnic photo with scrim at the top; logo just above "Turn your idea / into a plan." (42px); the 1-2-3 steps; sign-in buttons anchored at the bottom; **no tab bar** on Welcome only | Test | Photo: `photos/welcome.jpg` |
| 2 | **Continue with Google** (opens sign-in straight into *Opening Google…*) and **Continue with email** (sign-in with the email field focused); "New here? Either one creates your account." | Test | |
| 3 | An invite link (/join/CODE) adds "Sign in to join the group CODE"; after signing in, Join opens pre-filled | Test | |
| 4 | (Removed) Group code card, Start a group, How this works link: now only after sign-in (How Spark Hub works is in Profile) | Test | |

## Your schedule (Home, signed in) — v5.2

| # | Feature | Status | Notes |
|---|---|---|---|
| 5 | Header: logo, **All groups ▾** scope menu, your photo → Profile, then the title **Your schedule**. A **view picker** (the current view's icon + chevron → Tiles / List / Grid menu) sits at the right end of the first month heading; Tiles by default, remembered on this device | Test | The scope resets when the app reloads |
| 6 | Upcoming plans you lead, said Going / Maybe to, or signed up to help with, under 22px month headings. **List** view: one white bubble per event, same-day events stacked under one day label, titles wrapping beside the 96px thumbnail | Test | |
| 7 | **YOU'RE HELPING:** your sign-ups on each plan, with their time; two, then **+N more** / **Show less** | Test | Grid shows a *Helping* chip |
| 8 | Plans you lead: **Leading** chip and a dashboard — Going · Maybe · Sign-ups rings and an **Actions** tile (count of next steps) or **All set** | Test | Grid: *Leading · N to do* |
| 9 | Empty: *Nothing on the books yet.* + **Post an event** | Test | |
| 10 | Not in a group yet: **Join with a code** card | Test | Not designed |

## Groups

| # | Feature | Status | Notes |
|---|---|---|---|
| 11 | Group switcher menu (All ideas): your groups in Home's order, names only (no role chips), current one tinted, **+ Join a group** | Test | |
| 12 | **Join a group** pop-up (code, "didn't match" error) | Test | Needs sign-in |
| 13 | **Groups** tab: *Your groups* with **Join a group** / **Start a group** pills; pinned groups as big photo cards (role chip, gear for owners/admins → Edit group, pin, name with a dot when there's something new, members), every unpinned group as a square tile in two columns (all tiles when nothing is pinned) | Test | Member counts via `my_group_sizes()`; toast *Pinned* / *Unpinned* |
| 14 | Invite links `/join/CODE` (and `#/join/CODE`): code filled in; Join opens for someone signed in | Test | Vercel rewrite in `vercel.json` |
| 15 | **Edit group** (owners and admins; Profile → Your groups or **Edit** on All ideas): cover with **Change cover** / **Add a cover**, group name (owners rename in place; admins see a lock), members card → Members sheet, invite code + link with **Copy**, **Delete group** (owners; type DELETE) | Test | Back returns where you came from |
| 15b | **Owners** (up to 2 per group; whoever starts a group). Members sheet (search, *(you)* first): owners **Make admin**, **Make owner**, **Remove**, **Step down**; admins see it read-only. A group always keeps one owner | Test | Owner chip purple, Admin gold |
| 16 | Group photo on Groups cards and tiles, All ideas header and behind ideas without a photo, framed with the **Photo positioner** (drag, zoom 1–2.5×, Choose a different photo) | Test | New groups fall back to gold |

## Group page (per group) — V5 update

| # | Feature | Status | Notes |
|---|---|---|---|
| 17 | Cover header: a **Back to groups** circle (no logo), **Edit** pill (admins), *N members*, group name, **I have an idea** | Test | |
| 18 | Ideas / Plans / Happened tabs; the **view picker** (Tiles / List / Grid) on the first month heading, remembered on this device | Test | |
| 19 | **Sort** on Ideas only, on its own row: Most popular (default) · Happening soon · Newest · Oldest. Plans (soonest first) and Happened (newest first) have no count line or sort | Test | |
| 20 | Photo cards by month (List: by day) with date · time, title, place; your role as a chip — Leading / Helping / Going / Maybe (Led / Helped / Went on Happened, photos desaturated) | Test | Ideas with no date: "Idea · no date yet" |
| 21 | Loading placeholders, "Couldn't load ideas" banner with **Try now**, empty states per tab | Test | |

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

## Plans (V5)

| # | Feature | Status | Notes |
|---|---|---|---|
| 61 | **Post an event** form (the default when posting): what, post to, when + time, where, good to know, who can see it (everyone / invite only), photo; *Don't have it all figured out?* switches to the idea steps | Test | |
| 62 | Idea page boards: **Dates** and **Location** suggestions with votes; the lead taps one to use it; *Steps to a plan* banner; *Make it a plan*; *Offer to help organize* | Test | `date_options`, `spot_options`, votes, `organizers`, `make_plan()` |
| 63 | **Plan page**: countdown header, *Are you coming?* (Going / Maybe / Can't make it), who's going, add to calendar (.ics), directions, good to know, sign-ups, updates, Inspo | Test | `rsvps` |
| 64 | Host tools: guest list counts, **Invite people** (share link), **Send an update** (audience + templates), remind-the-day-before switch, private **Before the day** notes, *Clear the date* | Test | `plan_updates`, `plan_prep`, `clear_plan()`; delivery comes later |
| 65 | **Sign-ups**: the host adds items with an optional "how many"; anyone signs up or adds "something else" they're bringing | Test | `signup_items`, `signup_claims` (full items refuse more) |
| 66 | **It happened** page: album (anyone can add), *Do it again* (prefilled event form), Edit for the lead/admins | Test | `album_photos` |
| 67 | **Invite-only plans**: seen by the lead, admins, people who replied and link holders | Test | `can_see_spark()` |
| 68 | All ideas **Ideas / Plans / Happened** tabs with counts; cards show IDEA / PLAN / It happened | Test | |
| 69 | **Start a group** (Profile → Your groups) | Test | `create_group()` |
| 70 | Temporary **demo events** in the four demo groups (`scripts/demo/seed-events.py`, after `seed-demo.py`): the v5.2 events content handoff, with every signed-in tester leading, helping, going, maybe, can't and not yet answered, plus past events and ideas | Test | Re-run to rebuild; see the script to remove |
| 71 | **Tab bar** (v5.2): Your schedule · Your plans & ideas · Calendar · Notifications (red unread count) · Groups; five plain 23px icons, black when active, gray otherwise. Logo and your photo appear only on Your schedule; every other tab is a 36px title at 40px | Test | |
| 72 | **Calendar**: title-only header (CALENDAR eyebrow + *All groups ▾*), every event in all your groups, filters All · Leading · Going · Helping with counts, **List** (default) · Week · Month; rows show time · group, place, *Helping · …* and a pill (Leading, Going, Maybe, Open to join, Happened); floated idea dates; *Post an event* on empty days. *ROUGH DRAFT* stamp (design's, temporary) | Test | |
| 73 | **Your plans / Your ideas**: the title is the switch (active black, inactive light gray); a group dropdown pill and the create button for that tab (**Post an event** green, **Float an idea** yellow). Plans: photo tiles with the Going · Maybe · Sign-ups rings and the Actions box, then *Past events* with desaturated photos. Ideas: photo tiles (IDEA · GROUP) with the four **readiness steps** (Date, Location, People, Tasks: rings that fill, then go solid green) | Test | No draft stamp here |
| 74 | **Notifications** (a tab; last 7 days, built from stored activity): gear on the title row, filter chips All / Invites / Updates / Hosting, sections **NEW · N** (with **Mark all read** at its right, both gone once everything is read) and Earlier this week; new plans with **I'm going** / **Maybe**, host updates with their text, day-before and day-of reminders; on your own plans: replies, sign-ups, interest, suggestions, offers to organize | Test | |
| 75 | **Mark all read** and per-item read (tapping one), kept in your account so they follow you between the app and the browser | Test | `notif_state` |
| 76 | **Notification settings**: four topics on/off (hide them from the feed and the count). Notifications are **in-app only** for now | Test | No email (owner's call, 2026-09-28); push isn't possible yet (no service worker) |
| 77 | **Sign-up times**: the host can give a sign-up item a time ("Set up barriers · 8:30am"), shown on the plan and in Your plans | Test | `signup_items.time`, host only |
| 78 | Torrez Fitness cover crop from the design (set once by the retired `seed-v5-update.py`; the demo events are now #70) | Test | |
| 79 | **Shared demo world**: everyone who signs in joins Hub on Hunters, Walnut Creek, Woodcliff and Torrez Fitness as a member; named testers get their owner/admin roles from a roster (roles only go up) | Test | `demo_roster`, trigger on sign-in; `scripts/demo/demo-world.sql` |
| 80 | **Remove all demo content** (Profile, owner's account only): deletes every demo idea and plan, takes the demo people out of the groups, stops auto-joining | Test | `wipe_demo()`, `demo_admins` |
| 81 | **No empty flash on open**: a signed-in person goes straight to their app (not Welcome); screens show loading placeholders until data arrives, and after the first time the last-seen data shows at once while fresh data loads | Test | Cache in localStorage per database and account, without guests' phone numbers; cleared on sign-out |
| 82 | **Loading screen**: the gold bolt (64px, gently pulsing) over "Spark Hub" on white, shown from the first moment until the app renders | Test | In `index.html`, so it shows before any script loads |
| 83 | **Profile** (v5.2, from your photo on Your schedule): centred 96px photo with a camera badge, name, *{place} · Member since {year}*, a short bio, **Edit profile** (photo, name, **Place**, **About you**, email), a **Hosted / Went to / Groups** stats row; **Settings** (Notifications → the settings sheet; Privacy), **Help & info** (How Spark Hub works), the owner's Demo content card, Sign out. No Your ideas or Your groups lists | Test | `profiles.place` (≤40), `profiles.bio` (≤160) |
| 84 | **Event page controls** (idea, plan, happened): the photo runs to the top; a white **Back** circle and, for hosts, a white **Edit** pill; no group name or IDEA pill between them. **Back returns to the screen you came from** (Your schedule, Your plans or ideas, Calendar, Notifications, Groups, the group page), scrolled to where you were; a link opened cold goes to the group's page | Test | `state.back`, recorded in `go()` |
| 85 | **Groups page** (v5.2): title at 40px, 36px Join / Start pills; tiles honour each group's crop and zoom | Test | |

## Posting and editing

| # | Feature | Status | Notes |
|---|---|---|---|
| 34 | Post flow: event (40 characters max, *N left* from 10; **Post to** picker, names only) → location → date (iPhone-safe field, *mm/dd/yy*) + time (30-minute list, 6:00 pm default) → the basics → photos (up to 3, **Position the cover**) → **Look good?** → **Put it up** | Test | Grid titles clamp to 2 lines |
| 35 | Location suggestions from 2 characters (Geoapify, near Austin), up to 4 rows with a purple pin tile; address saved with the pick | Test | Kept by owner decision |
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
| 59 | Automated end-to-end tests (23 tests: smoke, posting, groups, collaboration, plans, Your plans, notifications, Google, database security) | Test | `tests/` |
| 60 | Nightly cleanup of test-database leftovers ([E2E] ideas and groups, old anonymous users) | Live | Test project only |

## Removed in this rebuild

- The old date voting (ranks, lock-in) and the RSVP pop-up (V5 brought back simpler date votes and RSVPs).
- The Walktober hero card, "What should we get up to?" Home, category filter, questions screen.
- Progress / "N of 3 in place", checkpoints, "Everything's in place" card.
- "I can help with something" and the offer chips at the bottom of the idea page.
- "Signed in with" row and the lead-only sign-in copy on Profile.
