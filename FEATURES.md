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

## Home (signed in) — V5

| # | Feature | Status | Notes |
|---|---|---|---|
| 5 | Header: logo (goes Home), **All groups ▾** scope menu (narrows every row to one group), your photo → Profile | Test | The scope resets when the app reloads |
| 6 | **Leading**: swipeable 284px cards for ideas you lead, your upcoming plans and ones from the last 3 days (today, tomorrow, plans that need something, ideas, just happened, all set); date badge or IDEA pill, countdown, group, title; a 4-ring tracker (ideas: Date, Location, People, Tasks; plans: Location, Going, Sign-ups, Reminder); ends with a **New event** card | Test | View all → You own |
| 7 | **Going**: plans you replied Going or Maybe to (not hosting), photo tiles with date and *Maybe*; empty-state line | Test | View all → sheet |
| 8 | **Helping**: sign-up items you took on upcoming plans (date badge, item, plan · day time); hidden when there are none | Test | View all → sheet |
| 9 | **View all** sheet: Going · You own · Helping tabs with counts, group chips, This week / Later in {Month} / Just happened / No date yet | Test | |
| 10 | Not in a group yet: **Join with a code** card | Test | Not designed |

## Groups

| # | Feature | Status | Notes |
|---|---|---|---|
| 11 | Group switcher menu (All ideas): your groups in Home's order, names only (no role chips), current one tinted, **+ Join a group** | Test | |
| 12 | **Join a group** pop-up (code, "didn't match" error) | Test | Needs sign-in |
| 13 | **Groups** tab: *Your groups* with **Join a group** / **Start a group** pills; pinned groups as big cards (role chip, gear for owners/admins → Edit group, pin, members, *N new*, events · ideas, Leading · Helping), the rest as square tiles in two columns | Test | Member counts via `my_group_sizes()`; toast *Pinned* / *Unpinned* |
| 14 | Invite links `/join/CODE` (and `#/join/CODE`): code filled in; Join opens for someone signed in | Test | Vercel rewrite in `vercel.json` |
| 15 | **Edit group** (owners and admins; Profile → Your groups or **Edit** on All ideas): cover with **Change cover** / **Add a cover**, group name (owners rename in place; admins see a lock), members card → Members sheet, invite code + link with **Copy**, **Delete group** (owners; type DELETE) | Test | Back returns where you came from |
| 15b | **Owners** (up to 2 per group; whoever starts a group). Members sheet (search, *(you)* first): owners **Make admin**, **Make owner**, **Remove**, **Step down**; admins see it read-only. A group always keeps one owner | Test | Owner chip purple, Admin gold |
| 16 | Group photo on Groups cards and tiles, All ideas header and behind ideas without a photo, framed with the **Photo positioner** (drag, zoom 1–2.5×, Choose a different photo) | Test | New groups fall back to gold |

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
| 70 | Temporary **demo plans** in every group the owner is in (`scripts/demo/seed-v5.py`) | Test | Re-run to refresh dates; see the script to remove |
| 71 | **Tab bar** (V5): Home · Calendar · You own · Groups · Notifications (bell with a red unread count); no + button (post from *New event*, You own, Calendar or All ideas); Profile is your photo in the page header; *How Spark Hub works* moved to Profile | Test | |
| 72 | **Calendar**: Month grid across your groups (green = on the books, gold ring = floated idea date, gray = happened), day list or *Nothing on this day* + **Post an event** (date filled in); **List** view by month with Hosting / Going / Maybe / RSVP / votes pills | Test | |
| 73 | **You own**: counts (events · ideas · need you), **Post an event** / **Float an idea**, group chips, cards with the next step strip (e.g. *Oct 4 has 4 votes · Pick date*, *Location TBD · Add it*, *All set*) | Test | Next-step buttons open the plan |
| 74 | **Notifications** (last 7 days, built from stored activity): new plans in your groups (with **I'm going** / **Maybe**), host updates with their text (to the audience the host picked), day-before and day-of reminders; for your own plans and ideas: replies, sign-ups, interest, date/location suggestions, offers to help organize. Filters All / Invites / Updates / Hosting; New / Earlier this week; unread dots | Test | |
| 75 | **Mark all read** and per-item read (tapping one), kept in your account so they follow you between the app and the browser | Test | `notif_state` |
| 76 | **Notification settings**: four topics on/off (hide them from the feed and the count). Notifications are **in-app only** for now | Test | No email (owner's call, 2026-09-28); push isn't possible yet (no service worker) |

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
| 59 | Automated end-to-end tests (20 tests: smoke, posting, groups, collaboration, plans, notifications, Google, database security) | Test | `tests/` |
| 60 | Nightly cleanup of test-database leftovers ([E2E] ideas and groups, old anonymous users) | Live | Test project only |

## Removed in this rebuild

- The old date voting (ranks, lock-in) and the RSVP pop-up (V5 brought back simpler date votes and RSVPs).
- The Walktober hero card, "What should we get up to?" Home, category filter, questions screen.
- Progress / "N of 3 in place", checkpoints, "Everything's in place" card.
- "I can help with something" and the offer chips at the bottom of the idea page.
- "Signed in with" row and the lead-only sign-in copy on Profile.
