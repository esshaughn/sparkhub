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

## Your tasks (Home, signed in) — v6

| # | Feature | Status | Notes |
|---|---|---|---|
| 5 | Header: **Your tasks** and the bell (red unread count → Notifications sheet); no photo button since v6 Update 3 (Profile is the last tab). At `#/tasks` | Test | The Calendar is the home screen (#90) |
| 6 | **Leading**: plans you lead (upcoming, or in the last 3 days) with something to do, as a swipeable row of 290px cards: photo banner, **Going · Maybe · Sign-ups · Reminder** strip, to-dos (Post an update, Send a reminder, *{name}'s spot idea · Review*, Location TBD, *N spots open · Share list*, Say thanks / Add photos); two, then **+N more** / **Show less** | Test | Invites aren't counted (share links), so Maybe replaces Invited |
| 7 | **Helping** (green): plans you're going / maybe to or signed up for — Confirm RSVP, *You said maybe · Update RSVP*, each sign-up with its time, Location TBD, Today/Tomorrow · Directions, In N days · Details; most to-dos first. Empty: *Find something to help with* → Calendar | Test | |
| 8 | **Ideas** you lead: four checkpoints (Date · Location · Roles→Helpers · People), each opening the idea at that part | Test | Idea pages now have a Sign-ups card |
| 9 | **View all** sheet per section; leading nothing → *Start an event* card at the bottom; tab badge = events with to-dos | Test | |
| 10 | Not in a group yet: **Join with a code** card | Test | Not designed |

## Your schedule — v6

| # | Feature | Status | Notes |
|---|---|---|---|
| 89 | Upcoming plans you lead, are going / maybe to, or help with; **Tiles** (big photo, role strip: Leading / Helping / Going / Maybe with *N tasks ⌄* expanding in place, *All set*, *Change RSVP* / *Update RSVP*) or **List** (date block, role bar, same strip). On the first heading: **Sort** (Soonest by month · Most lively · Newest · Needs you, one section named after the sort), **Filter** (*Show only*: Leading, Helping, Going, Maybe, Needs helpers, This week, with counts, all must match; black *Filter · N* while on; *No events match these filters* + **Clear filters**) and the view picker | Test | v6 Update 2; Grid and the group picker are gone |

## Calendar (community) — v6

| # | Feature | Status | Notes |
|---|---|---|---|
| 90 | **The home screen** (the app opens here). Photo header (search, bell, **+** to post), every upcoming plan in your groups; **Groups** and **Type** checklists (types guessed from titles), **Clear filters**; **Sort** Soonest / Most lively / Newest / Needs you; **List** · **Tiles** · **Month**; not-joined cards say *N spots left · N going · RSVP* | Test | Types are placeholders until hosts tag events |
| 91 | **Feeling wild?** (a random event) and **N events could use a hand** (open sign-ups in the next two weeks, **Claim** in a sheet), each dismissible for the visit | Test | |
| 92 | **Search** sheet: before typing, **Try** chips (This weekend, Outdoors, Kid-friendly, Needs helpers, Food & drink) and **Or something unexpected** (Deal me a wildcard, Something new to me, Soonest surprise, Tag along, Small & cozy, Get outside); live results by name, place or group; gray Cancel | Test | v6 Update 2; no recent searches |
| 93 | **Will you be there?** after signing up, claiming or offering to organize without a Going / Can't go: I'm going · Maybe · Helping, not attending | Test | Can't be dismissed |

## Groups

| # | Feature | Status | Notes |
|---|---|---|---|
| 11 | Group switcher menu (All ideas): your groups in Home's order, names only (no role chips), current one tinted, **+ Join a group** | Test | |
| 12 | **Join a group** pop-up (code, "didn't match" error) | Test | Needs sign-in |
| 13 | **Groups** tab (v6 Update 2): photo header (*YOUR PEOPLE* · **Groups** · *N groups*, the bell, a white **Join** pill → the code pop-up); pinned groups as big photo cards (role chip, gear for owners/admins → Edit group, pin, name with a dot when there's something new, members), every unpinned group as a square tile in two columns; dotted **+ Start a new group** at the bottom. The Groups tab is purple only on this list | Test | Header photo: the first of your groups with a photo; member counts via `my_group_sizes()` |
| 14 | Invite links `/join/CODE` (and `#/join/CODE`): code filled in; Join opens for someone signed in | Test | Vercel rewrite in `vercel.json` |
| 15 | **Edit group** (owners and admins; Profile → Your groups or **Edit** on All ideas): cover with **Change cover** / **Add a cover**, group name (owners rename in place; admins see a lock), members card → Members sheet, invite code + link with **Copy**, **Delete group** (owners; type DELETE) | Test | Back returns where you came from |
| 15b | **Owners** (up to 2 per group; whoever starts a group). Members sheet (search, *(you)* first): owners **Make admin**, **Make owner**, **Remove**, **Step down**; admins see it read-only. A group always keeps one owner | Test | Owner chip purple, Admin gold |
| 16 | Group photo on Groups cards and tiles, All ideas header and behind ideas without a photo, framed with the **Photo positioner** (drag, zoom 1–2.5×, Choose a different photo) | Test | New groups fall back to gold |

## Group page (per group) — V5 update

| # | Feature | Status | Notes |
|---|---|---|---|
| 17 | Cover header (v6 Update 2, 190px): a white **Back to groups** circle, **Search this group** and the bell, *N MEMBERS* in violet, the group name with a quiet pencil for owners/admins (→ Edit group), a violet **+** (I have an idea) | Test | |
| 18 | The **world switcher**: *Ideas N · Plans N · Past N* on a gray track with a white sliding thumb (no icons); Plans first. **Swipe** the page left / right to move between them: the page follows your thumb from the first few pixels with the neighbouring tab beside it, and carries on past 40% of the width (or on a flick), otherwise springs back. Or tap the quiet edge arrows (they nudge now and then); the new tab slides in from that side | Test | v6 Update 2; swipe and arrows: owner, 2026-09-28; follow-the-thumb: owner, 2026-09-28 |
| 19 | **Plans**: Your schedule's Tiles / List cards and strips (not joined: *N spots left · N going · RSVP*); **Sort** · **Filter** (Leading, Helping, Going, Not joined yet, Needs helpers, This week) · view picker on the first heading, the view remembered on this device | Test | v6 Update 2 |
| 20 | **Ideas** board: graph-paper page, two columns of tilted cards (photo or the group's, title, ↑ interested count, the four checkpoints as green / amber tiles); **Past** scrapbook: dark *{GROUP} · SO FAR* recap (events · showed up · photos), memory cards (photo or a 4-photo mosaic, *🎉 N went!*, add a photo to the album, **Made it happen** · lead with N helpers · 🙏 thanks, ❤️ 🙌 🎉 reactions, **Let's do it again!** with its count) | Test | v6 Update 2; reactions in `reactions` |
| 21 | Loading placeholders, "Couldn't load ideas" banner with **Try now**, empty states per tab | Test | |
| 94 | **Group search** sheet (this group only): **Browse** chips (Plans, Ideas, Past events, Needs helpers) and **Or something unexpected** (Wildcard, Next up here, They need you, Hidden gem, Throwback, Fresh off the press); live results with *Idea / Past · date · place* | Test | v6 Update 2 |

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
| 66 | **It happened** page: album (anyone can add), **Reactions** (❤️ 🙌 🎉, 🙏 a public thank-you to the lead, *Thanks from …*), *Do it again* (prefilled event form), Edit for the lead/admins | Test | `album_photos`, `reactions` |
| 67 | **Invite-only plans**: seen by the lead, admins, people who replied and link holders | Test | `can_see_spark()` |
| 68 | All ideas **Ideas / Plans / Happened** tabs with counts; cards show IDEA / PLAN / It happened | Test | |
| 69 | **Start a group** (Profile → Your groups) | Test | `create_group()` |
| 70 | Temporary **demo events** in the four demo groups (`scripts/demo/seed-events.py`, after `seed-demo.py`): the v5.2 events content handoff, with every signed-in tester leading, helping, going, maybe, can't and not yet answered, plus past events and ideas | Test | Re-run to rebuild; see the script to remove |
| 71 | **Tab bar** (v6): Your tasks (purple count) · Your schedule · **Calendar** (centre, in a ring) · Groups (purple only on the Groups list) · Profile (opens the sheet); purple when active. Your plans & ideas is off the bar (`#/own`) | Test | |
| 72 | (Replaced by #90) The v5 role-filtered Calendar with Week view and the ROUGH DRAFT stamp | Removed | v6 |
| 73 | **Your plans / Your ideas**: the title is the switch (active black, inactive light gray); a group dropdown pill and the create button for that tab (**Post an event** green, **Float an idea** yellow). Plans: photo tiles with the Going · Maybe · Sign-ups rings and the Actions box, then *Past events* with desaturated photos. Ideas: photo tiles (IDEA · GROUP) with the four **readiness steps** (Date, Location, People, Tasks: rings that fill, then go solid green) | Test | No draft stamp here |
| 74 | **Notifications** (v6: a sheet from the bell; last 7 days, built from stored activity): gear on the title row, filter chips All / Invites / Updates / Hosting, sections **NEW · N** (with **Mark all read** at its right, both gone once everything is read) and Earlier this week; new plans with **I'm going** / **Maybe**, host updates with their text, day-before and day-of reminders; on your own plans: replies, sign-ups, interest, suggestions, offers to organize | Test | |
| 75 | **Mark all read** and per-item read (tapping one), kept in your account so they follow you between the app and the browser | Test | `notif_state` |
| 76 | **Notification settings**: four topics on/off (hide them from the feed and the count). Notifications are **in-app only** for now | Test | No email (owner's call, 2026-09-28); push isn't possible yet (no service worker) |
| 77 | **Sign-up times**: the host can give a sign-up item a time ("Set up barriers · 8:30am"), shown on the plan and in Your plans | Test | `signup_items.time`, host only |
| 78 | Torrez Fitness cover crop from the design (set once by the retired `seed-v5-update.py`; the demo events are now #70) | Test | |
| 79 | **Shared demo world**: everyone who signs in joins Hub on Hunters, Walnut Creek, Woodcliff and Torrez Fitness as a member; named testers get their owner/admin roles from a roster (roles only go up) | Test | `demo_roster`, trigger on sign-in; `scripts/demo/demo-world.sql` |
| 80 | **Remove all demo content** (Profile, owner's account only): deletes every demo idea and plan, takes the demo people out of the groups, stops auto-joining | Test | `wipe_demo()`, `demo_admins` |
| 81 | **No empty flash on open**: a signed-in person goes straight to their app (not Welcome); screens show loading placeholders until data arrives, and after the first time the last-seen data shows at once while fresh data loads | Test | Cache in localStorage per database and account, without guests' phone numbers; cleared on sign-out |
| 82 | **Loading screen**: the gold bolt (64px, gently pulsing) over "Spark Hub" on white, shown from the first moment until the app renders | Test | In `index.html`, so it shows before any script loads |
| 83 | **Profile** (v6 Update 2: a compact sheet from the Profile tab or your photo on Your tasks): 56px photo, name, a gray pencil (**Edit profile**: photo, name, **Place**, **About you**, email), Close; **Help & info** tiles (How Spark Hub works, Notification settings), **Settings** (Notifications, Privacy), the owner's Demo content card, Sign out. Notification settings and Edit profile open above the sheet | Test | Place / bio / member since / stats aren't shown for yourself any more (kept for viewing others, not built yet) |
| 84 | **Event page controls** (idea, plan, happened): the photo runs to the top; a white **Back** circle and, for hosts, a white **Edit** pill; no group name or IDEA pill between them. **Back returns to the screen you came from** (Your tasks, Your schedule, Your plans or ideas, Calendar, Groups, the group page), scrolled to where you were; a link opened cold goes to the group's page | Test | `state.back`, recorded in `go()` |
| 85 | (Replaced by #13) The v5.2 Groups page title and pills | Removed | v6 Update 2 |
| 86 | **Freeze log** (temporary, owner's Profile only): notes when the app stops responding for over a second (screen, what ran last, image count), slow redraws (>150ms) and slow loads (>3s); kept on the device, last 40, Clear button | Test | Tracing the home-screen app freezes (2026-09-27); remove once found |
| 87 | **Pull to refresh**: at the top of any screen, drag down and let go to reload; the header stays put while the feed under it slides down, with a spinner in the gap (screens without a header slide whole) | Test | Touch only; the 30-second background refresh still runs |
| 88 | **Link previews**: shared idea links are `/i/<id>` and show the idea's title, when · where · group, and its photo (or the group's) in iMessage, WhatsApp and the like; invite links (`/join/CODE`) show *Join {group} on Spark Hub* with the group photo; everything else shows the Spark Hub card. Invite-only plans stay generic | Test | `api/preview.js` (Vercel function), `link_preview()` / `group_preview()`, `icons/share.jpg` (`scripts/make-share-image.js`) |

## Posting and editing

| # | Feature | Status | Notes |
|---|---|---|---|
| 34 | **Post an event** (v6 Update 3): a 210px photo header (the cover, or a violet→gold gradient with sparkles; white **Close**, frosted **Add a photo**), *NEW EVENT* and the name typed on the photo (40 characters max, *N left* from 10); **The basics** (Group with **Change**, When + Time on a 30-minute list, Where with suggestions, Details), tiles turn green with a check once filled; **Invite only** switch; **Not sure on the details?** → the idea steps; a sticky **Post it! 🎉** (gray *Give it a name* / *Pick a date* until ready); a temporary **ROUGH DRAFT** stamp. The idea steps: event → location → date → the basics → photos → **Look good?** → **Put it up** | Test | Grid titles clamp to 2 lines |
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
| 52 | Photo bucket `spark-photos` (own-folder rules): idea photos, mood photos, avatars | Live | Uploads shrink to ≤1200px JPEG (avatars 400px) in the browser; `scripts/demo/shrink-photos.py` shrinks what's already stored, backing originals up to ~/Backups/sparkhub/photos-original |
| 53 | Live and test databases; migrations | Live | |

## Operations

| # | Feature | Status | Notes |
|---|---|---|---|
| 54 | Daily keep-alive ping (GitHub Action) | Live | |
| 55 | Weekly live backup on the Mac (launchd → ~/Backups/sparkhub) | Live | Saves every table that exists |
| 56 | Design handoff doc kept current by Claude Code | Live | |
| 57 | Vercel auto-deploy from `main`; previews from `test` | Live | |
| 58 | Security headers + CSP; pinned, integrity-checked Supabase script | Live | |
| 59 | Automated end-to-end tests (28 tests: smoke, posting, groups, collaboration, plans, Your schedule, v6 and Update 2, notifications, link previews, Google, database security) | Test | `tests/` |
| 60 | Nightly cleanup of test-database leftovers ([E2E] ideas and groups, old anonymous users) | Live | Test project only |

## Removed in this rebuild

- The old date voting (ranks, lock-in) and the RSVP pop-up (V5 brought back simpler date votes and RSVPs).
- The Walktober hero card, "What should we get up to?" Home, category filter, questions screen.
- Progress / "N of 3 in place", checkpoints, "Everything's in place" card.
- "I can help with something" and the offer chips at the bottom of the idea page.
- "Signed in with" row and the lead-only sign-in copy on Profile.
