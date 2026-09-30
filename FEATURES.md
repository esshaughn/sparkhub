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
| 1 | Welcome: picnic photo with scrim at the top; logo just above "Plans with / your people." (42px); the 1-2-3 steps (Create an event · RSVP & pitch in · Make it happen, v6 Update 7); sign-in buttons anchored at the bottom; **no tab bar** on Welcome only | Test | Photo: `photos/welcome.jpg` |
| 2 | **Continue with Google** (opens sign-in straight into *Opening Google…*) and **Continue with email** (sign-in with the email field focused); "New here? Either one creates your account." | Test | |
| 3 | **Invite link** (/join/CODE, Invite flow handoff): signed out, the group's landing (photo, *You're invited to {group}*, Google or an email code in a *Check your email* pop-up) and the join runs by itself; signed in already, *Join {group}?* as this account or a different one; *Joining…* only if slow (with *Try again*); **Welcome to {group}** once per group (Plans · Ideas · Pitch in, Next up with RSVP) → its Plans tab; already a member → the group and *You're already in {group}*; a bad link → *This invite link isn't working*; inside Instagram/Facebook/TikTok etc. email first with **Copy link**. The code is never shown | Test | No database change; join_group's result is compared with your groups before it |
| 4 | (Removed) Group code card, Start a group, How this works link: now only after sign-in (How this works is in Profile) | Test | |

## Your tasks (Home, signed in) — v6

| # | Feature | Status | Notes |
|---|---|---|---|
| 5 | Header: **Your tasks** and the bell (red unread count → Notifications sheet); no photo button since v6 Update 3 (Profile is the last tab). At `#/tasks` | Test | The Calendar is the home screen (#90) |
| 6 | **Leading**: plans you lead (upcoming, or in the last 3 days) with something to do, as a swipeable row of 290px cards: photo banner, **Going · Maybe · Sign-ups · Reminder** strip, to-dos (Post an update, Send a reminder, *{name}'s spot idea · Review*, Location TBD, *N spots open · Share list*, Say thanks / Add photos); two, then **+N more** / **Show less** | Test | Invites aren't counted (share links), so Maybe replaces Invited |
| 7 | **Helping** (green): plans where you still have something to do — *Confirm RSVP* (no reply yet), *You said maybe · Update RSVP*, and each sign-up with its time; nothing else (owner, 2026-09-29). Your schedule's Helping strip opens to the same rows; most to-dos first. Empty: *Find something to help with* → Calendar | Test | |
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

## Groups

| # | Feature | Status | Notes |
|---|---|---|---|
| 11 | Group switcher menu (All ideas): your groups in Home's order, names only (no role chips), current one tinted, **+ Join a group** | Test | |
| 12 | **Join a group** pop-up (code, "didn't match" error) | Test | Needs sign-in |
| 13 | **Groups** tab (v6 Update 2): photo header (*YOUR PEOPLE* · **Groups** · *N groups*, the bell, a white **Join** pill → the code pop-up); pinned groups as big photo cards (role chip, gear for owners/admins → Edit group, pin, name with a dot when there's something new, members), every unpinned group as a square tile in two columns; dotted **+ Start a new group** at the bottom. The Groups tab is purple only on this list | Test | Header photo: the first of your groups with a photo; member counts via `my_group_sizes()` |
| 14 | Invite links `/join/CODE` (and `#/join/CODE`) open the invite flow (#3) | Test | Vercel rewrite in `vercel.json` |
| 15 | **Edit group** (owners and admins; Profile → Your groups or **Edit** on All ideas): cover with **Change cover** / **Add a cover**, group name (owners rename in place; admins see a lock), members card → Members sheet, invite code + link with **Copy**, **Delete group** (owners; type DELETE) | Test | Back returns where you came from |
| 15b | **Owners** (up to 5 per group; whoever starts a group). Members sheet (search, *(you)* first): each row has a chevron that opens a short profile (**Email**, *Joined {month year}*) and the actions the viewer may take: owners **Make admin**, **Make owner**, **Remove as admin**, **Remove as owner**, **Step down as owner**; admins and owners **Remove from group** (admins: members only; never yourself). A group always keeps an owner | Test | Owner chip purple, Admin gold |
| 16 | Group photo on Groups cards and tiles, All ideas header and behind ideas without a photo, framed with the **Photo positioner** (drag, zoom 1–2.5×, Choose a different photo) | Test | New groups fall back to gold |

## Group page (per group) — V5 update

| # | Feature | Status | Notes |
|---|---|---|---|
| 17 | Cover header (v6 Update 2, 190px): a white **Back to groups** circle, **Search this group** and the bell, *N MEMBERS* in violet, the group name with a quiet pencil for owners/admins (→ Edit group), a violet **+** (I have an idea) | Test | |
| 18 | The **world switcher**: *Ideas N · Plans N · Past N* on a gray track with a white sliding thumb (no icons); Plans first. **Swipe** the page left / right to move between them: the page follows your thumb from the first few pixels with the neighbouring tab beside it, and carries on past 40% of the width (or on a flick), otherwise springs back. Or tap the quiet edge arrows (they nudge now and then); the new tab slides in from that side | Test | v6 Update 2; swipe and arrows: owner, 2026-09-28; follow-the-thumb: owner, 2026-09-28 |
| 19 | **Plans**: Your schedule's **Up next** (default since v6 Update 9: the next plan as a 170px photo card with a *Today / Tomorrow / In N days* badge, your role strip and its to-dos listed open; the rest as list cards with photo thumbs under *This week / Next week / Later in {month} / Date TBD*), Tiles and **Month** (the Calendar's grid) views (List removed; a saved List opens Up next); Tiles cards and strips (not joined: *N spots left · N going · RSVP*); **Sort** · **Filter** (Leading, Helping, Going, Not joined yet, Needs helpers, This week) · view picker on the first heading, the view remembered on this device | Test | v6 Update 2 |
| 20 | **Ideas** board: graph-paper page, two columns of tilted cards (photo or the group's, title, ↑ interested count, the four checkpoints as green / amber icons with thin dividers; a quiet **Sort** row: Most interest · Newest · Almost there); **Past** scrapbook: dark *{GROUP} · SO FAR* recap (events · showed up · photos; an X hides it for that group on this device), a dark date sticker and dashed rule above each memory card (photo or a 4-photo mosaic, *🎉 N went!* in one of five gradients, add a photo to the album, **Made it happen** · lead with N helpers · 🙏 thanks, ❤️ 🙌 🎉 reactions, **Let's do it again!** with its count) | Test | v6 Update 2 and 4; reactions in `reactions` |
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
| 27 | **Basic details** (up to 3 lines of 40; older one-line notes split into a bullet per sentence) with lead/member empty states; the lead edits them in the Basic details pop-up | Test | v6 Update 6 rename |
| 28 | What the lead is picturing + **Say more about what you're picturing** | Test | |
| 29 | **Who's pitching in** (accepted offers; your own waiting ones) | Test | |
| 30 | **The vibe** mood board: up to 3 photos, lead adds/removes; tap one to see it full screen (arrows between, ✕ / Escape / tap to close) | Test | Members see it only with photos |
| 31 | Rotated tag after actions ("It's up", "You're interested", "Sent to the lead", "Location set"…) | Test | |
| 32 | Lead's **Who's interested** list with guests' phone numbers (tap the count) | Test | Not designed yet |
| 33 | "That idea isn't up anymore" card for a dead link | Test | |

## Plans (V5)

| # | Feature | Status | Notes |
|---|---|---|---|
| 61 | (Replaced by #34) The v6 Update 3 **Post an event** form and the *Not sure on the details?* idea steps | Removed | v6 Update 6 |
| 62 | Idea page boards: **Dates** and **Location** suggestions with votes; the lead taps one to use it; *Steps to a plan* banner; *Make it a plan*; *Offer to help organize* | Test | `date_options`, `spot_options`, votes, `organizers`, `make_plan()` |
| 63 | **Plan page** (v6 Update 5): 340px photo header (*HAPPENING*, the title, the date sticker beside it, a **share** button); **You're helping** sliver under the photo (your jobs with times; collapsed by default, remembered per event on this device); RSVP as three buttons **Going · Maybe · Can't** with counts (tap your pick again to clear it); a **date card** (Add to calendar); a **Where card** with Directions and a map; the host's guest list; Before the day; Updates; **Help out**; **Hosted by** (*Say hi*); Who's going; Inspo. Section titles sit above their cards | Test | `rsvps`; the map is a Geoapify static image; *Say hi* only says messages are coming |
| 64 | Host tools (v6 Update 6): a guest panel with no title (Going · Maybe · Can't, *Send everyone an update*, **Invite people**, **Share link** with Copy / Text / Email / WhatsApp / More), *N things left to decide* banner, *Who can see it* row. The remind-the-day-before switch, **Before the day** notes and *Clear the date* are gone | Test | `plan_updates`; invites stay share links |
| 65 | **Help out** (sign-ups): one card per job with its time, a spot counter (dashes + *N of M*) and a description (*More* / *Less* when long); **Sign up** / **✓ You're in** (tap to take yourself off) / **Full**; the host adds jobs (*Add a job or item*, with how many and a time), anyone adds *something else* they're bringing | Test | `signup_items`, `signup_claims` (full items refuse more) |
| 66 | **It happened** page: album (anyone can add), **Reactions** (❤️ 🙌 🎉, 🙏 a public thank-you to the lead, *Thanks from …*), *Do it again* (prefilled event form), Edit for the lead/admins | Test | `album_photos`, `reactions` |
| 67 | **Invite-only plans**: seen by the lead, admins, people who replied and link holders | Test | `can_see_spark()` |
| 68 | All ideas **Ideas / Plans / Happened** tabs with counts; cards show IDEA / PLAN / It happened | Test | |
| 69 | **Start a group** (Profile → Your groups) | Test | `create_group()` |
| 70 | Temporary **demo events** in the four demo groups (`scripts/demo/seed-events.py`, after `seed-demo.py`): the v5.2 events content handoff, with every signed-in tester leading, helping, going, maybe, can't and not yet answered, plus past events and ideas | Test | Re-run to rebuild; see the script to remove |
| 71 | **Tab bar** (v6): Your tasks (purple count) · Your schedule · **Calendar** (centre, in a ring) · Groups (purple only on the Groups list) · Profile (opens the sheet); purple when active. Your plans & ideas is off the bar (`#/own`) | Test | |
| 72 | (Replaced by #90) The v5 role-filtered Calendar with Week view and the ROUGH DRAFT stamp | Removed | v6 |
| 73 | **Hosting** (v6 Update 8, 77a): opened only from the **Your tasks ⌄ / Hosting ⌄ title switcher** (73a: scrim, two rows with subtitles, purple check on the current one, a count badge of everything you lead plus drafts, 9+ cap). Compact rows in white cards: **Drafts** (*N of 5 steps*, resumes the post flow), **Ideas** (top-voted date *Oct 23 leads* in amber, else *N interested*), **Planning** (soonest first, *Date to be decided* last), **Past** (all, muted thumbs). Search button, no bell; empty card *Nothing you’re hosting yet.* | Test | Replaced Your plans / Your ideas; `#/own` still opens it |
| 74 | **Notifications** (v6: a sheet from the bell; last 7 days, built from stored activity): gear on the title row, filter chips All / Invites / Updates / Hosting, sections **NEW · N** (with **Mark all read** at its right, both gone once everything is read) and Earlier this week; new plans with **I'm going** / **Maybe**, host updates with their text, day-before and day-of reminders; on your own plans: replies, sign-ups, interest, suggestions, offers to organize | Test | |
| 75 | **Mark all read** and per-item read (tapping one), kept in your account so they follow you between the app and the browser | Test | `notif_state` |
| 76 | **Notification settings**: **Phone notifications** on/off for this device, then four topics on/off (off hides them from the feed, the count and the phone) | Test | No email (owner's call, 2026-09-28) |
| 77 | **Sign-up times**: the host can give a sign-up a time, or a time range ("5:00 – 6:00pm"), shown on the plan and in Your plans | Test | `signup_items.time` / `end_time`, host only; the post form can't set end times yet |
| 78 | Torrez Fitness cover crop from the design (set once by the retired `seed-v5-update.py`; the demo events are now #70) | Test | |
| 79 | **Shared demo world**: demo groups (Hub on Hunters (Demo), Walnut Creek, Woodcliff) are joined by invite code; named testers get their owner/admin roles from a roster (roles only go up). Joining **Torrez Fitness** by its link also makes you a plain member of **Hub on Hunters (Demo)**, so your Calendar has events from the start | Test | `demo_roster`, trigger on sign-in; `join_also` + `join_group()`; `scripts/demo/demo-world.sql` |
| 80 | **Remove all demo content** (Profile, owner's account only): deletes every demo idea and plan, takes the demo people out of the groups, stops auto-joining | Test | `wipe_demo()`, `demo_admins` |
| 81 | **No empty flash on open**: a signed-in person goes straight to their app (not Welcome); screens show loading placeholders until data arrives, and after the first time the last-seen data shows at once while fresh data loads | Test | Cache in localStorage per database and account, without guests' phone numbers; cleared on sign-out |
| 82 | **Loading screen**: the gold bolt (64px, gently pulsing) over "Spark Hub" on white, shown from the first moment until the app renders | Test | In `index.html`, so it shows before any script loads |
| 83 | **Profile** (v6 Update 2: a compact sheet from the Profile tab or your photo on Your tasks): 56px photo, name, a gray pencil (**Edit profile**: photo, name, **Place**, **About you**, email), Close; the owner's **Feedback inbox** card, **Help & info** tiles (How this works, Give feedback), **Settings** (Notifications, Privacy), the owner's Demo content card, Sign out. Notification settings and Edit profile open above the sheet | Test | Place / bio / member since / stats aren't shown for yourself any more (kept for viewing others, not built yet) |
| 96 | **Shifts and descriptions** (v6 Update 5): a job can be split into shifts (*2 shifts · 6:00 – 8:00pm*); **Sign up** opens **Pick a shift** (tick one or more, an optional note, Done). Jobs can carry a description | Test | `signup_items.descr`, `shift_of`; only the host can add them, and there's no form for them yet (design still open), so the demo's *Street tree planting* shows them |
| 97 | **You're on it / You're off it** banners (v6 Update 5): after any new sign-up, a green *You're on it* · *{Host} is counting on you* with **Undo** (4s); after taking yourself off, *You're off it* with **Find a replacement** (a share sheet with a ready message; 7s). On your own event, a toast instead. Replaces the *Will you be there?* sheet (#93, removed) | Test | |
| 98 | **Host's Your tasks tab** (v6 Update 6): purple bar under the photo (*n tasks*), opening to Pick a date / the winning date, Pick a location / the winning spot, Add basic details, Fill open spots · N open, and the host's own jobs; each row opens its pop-up. Chip **YOU'RE LEADING**, **Change photo** on the header, a pencil on the title | Test | |
| 99 | **Edit pop-ups** (v6 Update 6): Title & photo · Date, time & location · Basic details · Edit what you need (jobs inline, shifts) · Who can see it (Public / Private, groups). A new date or place closes its poll. Since v6 Update 7 a new date, time or place always sends an update (*New date / New time … (was …) / New location*); a new title or Basic details only with **Tell everyone going** on (*Renamed: … → …*, *Details updated: …*); the sheet previews **WHAT THEY GET** and who it goes to, and the button reads **Save and send** | Test | `signup_items` update policy, `spark_groups` |
| 100 | **Undecided date and place**: plans can post without them; the date and location card shows amber *… to be decided*, or **VOTING ON A DATE / SPOT** with Vote / ✓ Voted (guests) and **Pick** (host) | Test | `sparks_plan_has_when` dropped |
| 101 | **Drafts** (v6 Update 6): the X asks *Save this as a draft?* (Save draft / Keep going / Discard); *Your drafts* on Your tasks (cover strip, DRAFT, saved time, 5-step bar, Up next, **Continue**, delete); posting removes it | Test | `event_drafts`, private to you |
| 102 | **Several groups per event**: members of any of them see it; its first group is home; cards and search show *{first group} +N*. Since v6 Update 7 the host can **Make home** another ticked group in Who can see it, then untick the old one | Test | `spark_groups`, `set_home_group()` |
| 103 | **Undecided date or place on cards** (Update 6 gaps; Update 7: list rows show an amber *TBD ?* date badge, the *Date TBD* heading is amber, and the month grid gets a *N events with no date yet ›* strip that opens List there): *Date / Location to be decided* in amber (`#8f6405` on white, `#ffd98a` on photos) or *Voting on N dates / spots*; the Calendar, Your schedule and group Plans list undated events last under *Date to be decided* (not in the month grid or Could use a hand); *Your drafts* also on Your schedule | Test | |
| 104 | **Notes when something is taken down** (v6 Update 7): deleting an event tells everyone going (*{event} is off. {host} took it down.*); removing a job (Help out ✕ or Edit what you need) tells the people signed up (*“{job}” is off the list for {event}.*). The confirms say how many get the note; notes show in Notifications under Updates. Also: tap *Thanks from …* on It happened for **Thanks for {host}**, the list of who thanked | Test | `notes`, `delete_event()`, `remove_signup()` |
| 105 | **Phone notifications (web push)**: a *Get these on your phone* card at the top of Notifications (**Turn on notifications**, or on iPhone Safari *Add Spark Hub to your Home Screen first*); pushes for new events in your groups, host updates and date/time/place changes, cancelled events and removed jobs, the day-before reminder (8am Austin time), and for hosts replies, sign-ups and suggestions. Tapping one opens that event. Signing out stops that phone's pushes. The **Home Screen icon badge** shows the bell's unread count (a push adds one while the app is closed; opening it resets to the real count) | Test | `sw.js`, `api/push.js`, `push_subscriptions`, `save_push()`, `private.push_send()`, pg_cron `push-daily` |
| 106 | **Give feedback** (v6 Update 9; Profile → Help & info tile, replacing Notification settings there): a bottom sheet with Eric's photo, four prompt questions, a box and **Send to Eric**, then *Thank you!* · Done; saved to a private `feedback` table only the owner can read, with a phone notification to the owner; 10 an hour per person; tests' `[E2E]` notes never notify. **Feedback inbox** (owner only): a card at the top of Profile (*N notes from testers*, red unread badge) opening a sheet of every note, newest first, *NEW* until closed on that device | Test | `feedback` table + triggers (`20261012000000_feedback.sql`), `scripts/read-feedback.sql` |
| 107 | **Group Plans tab** (v6 Update 9, 80a): empty state with a calendar fan, *No plans yet* · *Somebody should fix that.* · **Create an event**; with plans, a *What else could happen?* card at the bottom (Taco night? · Park hang · Board games start an event with that title, and Create an event) | Test | |
| 108 | **Your schedule empty state** (v6 Update 10): the same calendar fan and *No plans yet*, *RSVP to something in your groups, or post your own.*, then **Post an event** (purple) and **View calendar** (white, gray ring) | Test | Replaced the white *Nothing on the books yet.* card |
| 95 | **View as a tester** (demo admin only, Profile): *Pick one* lists the testers who share a demo group with you; tapping one redraws the app as them (their groups and roles, RSVPs, sign-ups, what they lead, what they'd see), with a dark *Viewing as {name} · Exit* pill above the tab bar. Look only: nothing is saved while it's on (the app refuses writes before they leave), and Exit reloads as you | Test | `demo_testers()`; invite-only plans they reached by a shared link don't show |
| 84 | **Event page controls** (idea, plan, happened): the photo runs to the top; a white **Back** circle and, for hosts, a white **Edit** pill; no group name or IDEA pill between them. **Back returns to the screen you came from** (Your tasks, Your schedule, Your plans or ideas, Calendar, Groups, the group page), scrolled to where you were; a link opened cold goes to the group's page | Test | `state.back`, recorded in `go()` |
| 85 | (Replaced by #13) The v5.2 Groups page title and pills | Removed | v6 Update 2 |
| 86 | **Freeze log** (temporary, owner's Profile only): notes when the app stops responding for over a second (screen, what ran last, image count), slow redraws (>150ms) and slow loads (>3s); kept on the device, last 40, Clear button | Test | Tracing the home-screen app freezes (2026-09-27); remove once found |
| 87 | **Pull to refresh**: at the top of any screen, drag down and let go to reload; the header stays put while the feed under it slides down, with a spinner in the gap (screens without a header slide whole) | Test | Touch only; the 30-second background refresh still runs |
| 88 | **Link previews**: shared idea links are `/i/<id>` and show the idea's title, when · where · group, and its photo (or the group's) in iMessage, WhatsApp and the like; invite links (`/join/CODE`) show *Join {group} on Spark Hub* with the group photo; everything else shows the Spark Hub card. Invite-only plans stay generic | Test | `api/preview.js` (Vercel function), `link_preview()` / `group_preview()`, `icons/share.jpg` (`scripts/make-share-image.js`) |

## Posting and editing

| # | Feature | Status | Notes |
|---|---|---|---|
| 34 | **Create event** (v6 Update 6): 5 steps under a photo panel (*CREATE EVENT*, the title, *n of 5* and a progress line): Event title + cover upload → Date & time (30-minute start list, optional end) → Location → Basic details → How people can help (starter chips, *Add a job* sheet with − n + and optional shifts). **Decide later** clears a step and moves on; **Poll the group** (2–5 dates or places). Review: four summary cards (amber *… to be decided*), **Post to** (several groups) and **Public / Private**, **Post it** / **Save as draft**. Every entry point (+, Start an event, Float an idea, Do it again) opens it | Test | Replaces the one-page Post an event form and the idea steps |
| 35 | Location suggestions from 2 characters (Geoapify, near Austin), up to 4 rows with a purple pin tile; address saved with the pick | Test | Kept by owner decision |
| 36 | **Put it up** needs sign-in ("Sign in to post"), then a name if missing | Test | |
| 37 | (Removed) The full-screen Edit idea page; each section now has its own edit pop-up (#99). **Delete this event / idea** is a red link at the bottom of the page (removes its photos) | Test | v6 Update 6 |

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
