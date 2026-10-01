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
| 6 | **Leading**: plans you lead (upcoming, or in the last 3 days) with something to do, as a swipeable row of 290px cards: photo banner, **Going · Maybe · Sign-ups** strip, real to-dos only (Location TBD, *{name} suggested a spot · Review*, *N spots open · Share list*; after: *Add photos*, *Thank helpers*), each button doing its job (task audit, 2026-09-30); two, then **+N more** / **Show less** | Test | Invites aren't counted (share links), so Maybe replaces Invited |
| 7 | **Helping** (green): plans where you still have something to do — *You said Maybe · Update RSVP* (last 3 days only), an amber row for 3 days after a date/time/place change, and each sign-up with its time (taking a job marks you Going, so no *Confirm RSVP*; task audit 2026-09-30). Your schedule's Helping strip opens to the same rows; most to-dos first. Empty: *Find something to help with* → Could use a hand | Test | |
| 8 | **Ideas** you lead: the same steps as the idea page (Date · Location · Details, plus People when *How many do you need?* is set), each opening the idea at that part; the to-do is only the next step | Test | Idea pages now have a Sign-ups card |
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
| 13 | **Your people** tab (v6 Update 13, was Groups): photo header (*GROUPS & FRIENDS* · **Your people** · *N groups · N friends*), **Search** (a pill field filtering the side that's showing; *No groups/friends match …*) and the bell; a white round **Add** (person+) opening **Add people** (Add a friend · Join a group · Start a group, and a quiet *Get a new friend link*); a **Groups · N / Friends · N** switch. Groups side: pinned groups as big photo cards (role chip, gear for owners/admins → Edit group, pin, name with a dot when there's something new, members), the rest as square tiles with their member count. The tab is purple only on this list | Test | Header photo: the first of your groups with a photo; member counts via `my_group_sizes()` |
| 14 | Invite links `/join/CODE` (and `#/join/CODE`) open the invite flow (#3) | Test | Vercel rewrite in `vercel.json` |
| 15 | **Edit group** (owners and admins; Profile → Your groups or **Edit** on All ideas): cover with **Change cover** / **Add a cover**, group name (owners rename in place; admins see a lock), members card → Members sheet, invite code + link with **Copy**, **Delete group** (owners; type DELETE) | Test | Back returns where you came from |
| 15b | **Owners** (up to 5 per group; whoever starts a group). Members sheet (search, *(you)* first): each row has a chevron that opens a short profile (**Email**, *Joined {month year}*) and the actions the viewer may take: owners **Make admin**, **Make owner**, **Remove as admin**, **Remove as owner**, **Step down as owner**; admins and owners **Remove from group** (admins: members only; never yourself). A group always keeps an owner | Test | Owner chip purple, Admin gold |
| 15c | **Leave a group**: a quiet gray *Leave {group}* link at the bottom of the group page (everyone in it); a confirm (*Your events and replies stay. You can rejoin with the group's link.*), then the Groups page and *You left {group}*. The last owner is told to make someone else an owner first, or delete the group | Test | `leave_group()` |
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
| 22 | Photo header like the plan page's (audit, 2026-10-01): 300px photo with the title on it (36px, pencil for the lead or an admin), chips (*IDEA* gold, *YOU'RE LEADING*, *DEMO*, *PRIVATE*, *CANCELLED*), a gold date sticker once it has a date, back, **Share**, the lead's **Change photo / Add a photo** (→ Photo positioner, on plans too); the gold *Steps to a plan* strip sits under the photo | Test | |
| 23 | **Who's interested** section (faces, *N interested*; the lead taps it for the list) and the **LED BY** card with *Say hi* (not for the lead), as on plans | Test | Audit 2026-10-01 |
| 24 | **I'm interested** / **You're interested** in its own card where a plan has RSVP (not for the lead; not on a cancelled idea) | Test | Guests give name + phone first |
| 25 | **Waiting on you** (lead): suggested locations/dates with **Use this location / Use this date** and **Not this time** | Test | |
| 26 | The plan's **date & place card** (audit, 2026-10-01): a set date/place, or *Voting on a date / spot* with each option's *Suggested by …*, votes and **Vote** / **✓ Voted** (the lead: **Pick**, which closes the poll); other suggestions stay under a set date/place; members get **+ Suggest a date / location**; *Date TBD* / *Location TBD* with the lead's **Add**; Add to calendar and Directions | Test | Replaced the Dates tiles and Location list |
| 27 | **Details** as on plans (heading on the page, green dots, the gray pencil Edit, dashed empty box for the lead or an admin); hidden for members when empty. **Help out** as on plans: one card per job (#65) | Test | Replaced the one-card Sign-ups list (audit) |
| 28 | (Removed 2026-09-30) What the lead is picturing + **Say more about what you're picturing**; Basic details (#27) is the one place for notes | Removed | Old demo text in `vision` shows as Basic details bullets |
| 29 | **Who's pitching in** (accepted offers; your own waiting ones) | Test | |
| 30 | **Inspo**: up to 3 photos with *n / 3*; the lead adds/removes them on ideas **and plans** (plans were view-only); tap one to see it full screen | Test | Members see it only with photos |
| 31 | Rotated tag after actions ("It's up", "You're interested", "Sent to the lead", "Location set"…) | Test | |
| 32 | Lead's **Who's interested** list with guests' phone numbers (tap the Who's interested row) | Test | Not designed yet |
| 33 | "That event isn't up anymore" card for a dead link, or an event taken down while you're on it | Test | |

## Plans (V5)

| # | Feature | Status | Notes |
|---|---|---|---|
| 61 | (Replaced by #34) The v6 Update 3 **Post an event** form and the *Not sure on the details?* idea steps | Removed | v6 Update 6 |
| 62 | Idea page boards: **Dates** and **Location** suggestions with votes; the lead taps one to use it; *Steps to a plan* banner; *Make it a plan* (needs only a date; puts it on the Calendar); the host can **Turn it back into an idea** from a plan's Date, time & location pop-up (everyone going gets a note); *Offer to help organize* (removed 2026-09-30) | Test | `date_options`, `spot_options`, votes, `organizers`, `make_plan()` |
| 63 | **Plan page** (v6 Update 5): 340px photo header (*HAPPENING*, the title, the date sticker beside it, a **share** button); **You're helping** sliver under the photo (your jobs with times; collapsed by default, remembered per event on this device); RSVP as three buttons **Going · Maybe · Can't** with counts (tap your pick again to clear it); a **date card** (Add to calendar); a **Where card** with Directions and a map; the host's guest list; Before the day; Updates; **Help out**; **Hosted by** (*Say hi*); Who's going; Inspo. Section titles sit above their cards | Test | `rsvps`; the map is a Geoapify static image; *Say hi* only says messages are coming |
| 64 | Host tools (v6 Update 6): a guest panel with no title (Going · Maybe · Can't, tapping one opens the **Guest list** with guests' phone numbers, *Send everyone an update*, **Invite people** (one sheet: the ready message, Copy / Text / Email / WhatsApp / More)), *N things left to decide* banner, *Who can see it* row. The remind-the-day-before switch, **Before the day** notes and *Clear the date* are gone | Test | `plan_updates`; invites stay share links |
| 65 | **Help out** (sign-ups): one card per job with its time, a spot counter (dashes + *N of M*) and a description (*More* / *Less* when long); **Sign up** / **✓ You're in** (tap to take yourself off) / **Full**; the host adds jobs (*Add a job or item*, with how many and a time), anyone adds *something else* they're bringing; under each job the host sees who's on it (shift and note), everyone else faces and first names | Test | `signup_items`, `signup_claims` (full items refuse more) |
| 66 | **It happened** page: album (anyone can add), the host's *Wrong date? Change it* and *Delete this event*, **Reactions** (❤️ 🙌 🎉, 🙏 a public thank-you to the lead, *Thanks from …*), *Do it again* (prefilled event form), Edit for the lead/admins | Test | `album_photos`, `reactions` |
| 67 | **Invite-only plans**: seen by the lead, admins, people who replied and link holders | Test | `can_see_spark()` |
| 68 | All ideas **Ideas / Plans / Happened** tabs with counts; cards show IDEA / PLAN / It happened | Test | |
| 69 | **Start a group** (Profile → Your groups) | Test | `create_group()` |
| 70 | Temporary **demo events** in the four demo groups (`scripts/demo/seed-events.py`, after `seed-demo.py`): the v5.2 events content handoff, with every signed-in tester leading, helping, going, maybe, can't and not yet answered, plus past events and ideas | Test | Re-run to rebuild; see the script to remove |
| 71 | **Tab bar** (v6): Your tasks (purple count) · Your schedule · **Calendar** (centre, in a ring) · Groups (two-people icon since Update 13; purple only on the Your people list) · Profile (opens the sheet); purple when active. Your plans & ideas is off the bar (`#/own`) | Test | |
| 72 | (Replaced by #90) The v5 role-filtered Calendar with Week view and the ROUGH DRAFT stamp | Removed | v6 |
| 73 | **Hosting** (v6 Update 8, 77a): opened only from the **Your tasks ⌄ / Hosting ⌄ title switcher** (73a: scrim, two rows with subtitles, purple check on the current one, a count badge of everything you lead plus drafts, 9+ cap). Compact rows in white cards: **Drafts** (*N of 5 steps*, resumes the post flow), **Ideas** (top-voted date *Oct 23 leads* in amber, else *N interested*), **Planning** (soonest first, *Date to be decided* last), **Past** (all, muted thumbs). Search button, no bell; empty card *Nothing you’re hosting yet.* | Test | Replaced Your plans / Your ideas; `#/own` still opens it |
| 74 | **Notifications** (v6: a sheet from the bell; last 7 days, built from stored activity): gear on the title row, filter chips All / New / Updates / Hosting, sections **NEW · N** (with **Mark all read** at its right, both gone once everything is read) and Earlier this week; new plans (*New: {event}*, with **I'm going** / **Maybe**) and new ideas (*New idea: …*), host updates with their text, day-before and day-of reminders; on your own plans: replies, sign-ups, interest, suggestions, offers to organize | Test | |
| 75 | **Mark all read** and per-item read (tapping one), kept in your account so they follow you between the app and the browser | Test | `notif_state` |
| 76 | **Notification settings**: **Phone notifications** on/off for this device, then four topics on/off (off hides them from the feed, the count and the phone) | Test | No email (owner's call, 2026-09-28) |
| 77 | **Sign-up times**: the host can give a sign-up a time, or a time range ("5:00 – 6:00pm"), shown on the plan and in Your plans | Test | `signup_items.time` / `end_time`, host only; the post form can't set end times yet |
| 78 | Torrez Fitness cover crop from the design (set once by the retired `seed-v5-update.py`; the demo events are now #70) | Test | |
| 79 | **Shared demo world**: demo groups (Hub on Hunters (Demo), Walnut Creek, Woodcliff) are joined by invite code; named testers get their owner/admin roles from a roster (roles only go up). Joining **Torrez Fitness** by its link also makes you a plain member of **Hub on Hunters** (not the other demo groups), so your Calendar has events from the start; demo groups show a *DEMO* chip after their name (Groups cards and tiles, the group page, the Calendar's Groups filter, group pickers) | Test | `demo_roster`, trigger on sign-in; `join_also` + `join_group()`; `scripts/demo/demo-world.sql` |
| 79b | **DEMO pill**: seeded demo events (`sparks.demo`) show *DEMO* at the end of their title on every card, in search, Hosting and on the event page | Test | Real events in a demo group get no pill |
| 80 | **Remove all demo content** (Profile, owner's account only): deletes every demo idea and plan, takes the demo people out of the groups, stops auto-joining | Test | `wipe_demo()`, `demo_admins` |
| 81 | **No empty flash on open**: a signed-in person goes straight to their app (not Welcome); screens show loading placeholders until data arrives, and after the first time the last-seen data shows at once while fresh data loads | Test | Cache in localStorage per database and account, without guests' phone numbers; cleared on sign-out |
| 82 | **Loading screen**: the gold bolt (64px, gently pulsing) over "Spark Hub" on white, shown from the first moment until the app renders | Test | In `index.html`, so it shows before any script loads |
| 83 | **Profile** (v6 Update 2: a compact sheet from the Profile tab or your photo on Your tasks): 56px photo, name, a gray pencil (**Edit profile**: photo, name, **Place**, **About you**, email), Close; the owner's **Feedback inbox** and **New accounts** cards, **Help & info** tiles (How this works, Give feedback), **Settings** (Notifications, Privacy), the owner's Demo content card, Sign out. Notification settings and Edit profile open above the sheet | Test | Place / bio / member since / stats aren't shown for yourself any more (kept for viewing others, not built yet) |
| 96 | **Shifts and descriptions** (v6 Update 5): a job can be split into shifts (*2 shifts · 6:00 – 8:00pm*); **Sign up** opens **Pick a shift** (tick one or more, an optional note, Done). Jobs can carry a description | Test | `signup_items.descr`, `shift_of`; only the host can add them, and there's no form for them yet (design still open), so the demo's *Street tree planting* shows them |
| 97 | **You're on it / You're off it** banners (v6 Update 5): after any new sign-up, a green *You're on it* · *{Host} is counting on you* with **Undo** (4s); after taking yourself off, *You're off it* with **Find a replacement** (a share sheet with a ready message; 7s). On your own event, a toast instead. Replaces the *Will you be there?* sheet (#93, removed) | Test | |
| 98 | **Host's Your tasks tab** (v6 Update 6): purple bar under the photo (*n tasks*), opening to Pick a date / the winning date, Pick a location / the winning spot, Fill open spots · N open (opens the share sheet), and the host's own jobs (no Add basic details; the *N things left to decide* banner is gone); each row opens its pop-up. Chip **YOU'RE LEADING**, **Change photo** on the header, a pencil on the title | Test | |
| 99 | **Edit pop-ups** (v6 Update 6): Title & photo · Date, time & location · Basic details · Edit what you need (jobs inline, shifts) · Who can see it (Public / Private, groups). A new date or place closes its poll. Since v6 Update 7 a new date, time or place always sends an update (*New date / New time … (was …) / New location*); a new title or Basic details only with **Tell everyone going** on (*Renamed: … → …*, *Details updated: …*); the sheet previews **WHAT THEY GET** and who it goes to, and the button reads **Save and send** | Test | `signup_items` update policy, `spark_groups` |
| 100 | **Undecided date and place**: plans can post without them; the date and location card shows amber *… to be decided*, or **VOTING ON A DATE / SPOT** with Vote / ✓ Voted (guests) and **Pick** (host; asks first, then sends *New date / New location*) | Test | `sparks_plan_has_when` dropped |
| 101 | **Drafts** (v6 Update 6): the X asks *Save this as a draft?* (Save draft / Keep going / Discard); *Your drafts* on Your tasks (cover strip, DRAFT, saved time, 5-step bar, Up next, **Continue**, delete); posting removes it | Test | `event_drafts`, private to you |
| 102 | **Several groups per event**: members of any of them see it; its first group is home; cards and search show *{first group} +N*. Since v6 Update 7 the host can **Make home** another ticked group in Who can see it, then untick the old one | Test | `spark_groups`, `set_home_group()` |
| 103 | **Undecided date or place on cards** (Update 6 gaps; Update 7: list rows show an amber *TBD ?* date badge, the *Date TBD* heading is amber, and the month grid gets a *N events with no date yet ›* strip that opens List there): *Date / Location to be decided* in amber (`#8f6405` on white, `#ffd98a` on photos) or *Voting on N dates / spots*; the Calendar, Your schedule and group Plans list undated events last under *Date to be decided* (not in the month grid or Could use a hand); *Your drafts* also on Your schedule | Test | |
| 104 | **Notes when something is taken down** (v6 Update 7): deleting an event tells everyone going (*{event} is off. {host} took it down.*); removing a job (Help out ✕ or Edit what you need) tells the people signed up (*“{job}” is off the list for {event}.*). The confirms say how many get the note; notes show in Notifications under Updates. Also: tap *Thanks from …* on It happened for **Thanks for {host}**, the list of who thanked | Test | `notes`, `delete_event()`, `remove_signup()` |
| 105 | **Phone notifications (web push)**: a *Get these on your phone* card at the top of Notifications (**Turn on notifications**, or on iPhone Safari *Add Spark Hub to your Home Screen first*); pushes for new events in your groups, host updates and date/time/place changes, cancelled events and removed jobs, the day-before and morning-of reminders (8am Austin time, for going, maybe and helping), and for hosts replies, interest, sign-ups (one notification, not a second for the automatic Going) and suggestions; new ideas too. Tapping one opens that event. Signing out stops that phone's pushes. The **Home Screen icon badge** shows the bell's unread count (a push adds one while the app is closed; opening it resets to the real count) | Test | `sw.js`, `api/push.js`, `push_subscriptions`, `save_push()`, `private.push_send()`, pg_cron `push-daily` |
| 106 | **Give feedback** (v6 Update 9; Profile → Help & info tile, replacing Notification settings there): a bottom sheet with Eric's photo, four prompt questions, a box and **Send to Eric**, then *Thank you!* · Done; saved to a private `feedback` table only the owner can read, with a phone notification to the owner; 10 an hour per person; tests' `[E2E]` notes never notify. **Feedback inbox** (owner only): a card at the top of Profile (*N notes from testers*, red unread badge) opening a sheet of every note, newest first, *NEW* until closed on that device | Test | `feedback` table + triggers (`20261012000000_feedback.sql`), `scripts/read-feedback.sql` |
| 110 | **New-account alert** (owner, 2026-09-30): a phone notification to the owner whenever someone creates an account (confirmed email, not anonymous: email code, Google, or a guest signing up): *New account: {name}* · *{email} · N accounts now*. Test and demo people (@example.com) never notify | Test | `20261020000000_new_account_push.sql`, trigger `notify_new_account` on `auth.users`, topic `accounts` |
| 111 | **New accounts** (owner only, 2026-09-30): a card under the Feedback inbox on Profile (*N accounts so far*, red badge for accounts not seen yet on this device) opening a sheet of everyone who has an account, newest first: face or initial, name, email, *Joined {5m ago / yesterday / 3 days ago} · Google / Email*, their groups (demo groups counted, *· N demo groups*), *NEW* until the sheet is closed on that device. Same definition as the new-account alert; @example.com left out. Hidden if the database has no `new_accounts()` | Test | `new_accounts()` (`20261022000000_accounts_list.sql`), `spark-hub-accounts-seen` in localStorage |
| 107 | **Group Plans tab** (v6 Update 9, 80a): empty state with a calendar fan, *No plans yet* · *Start one, or turn an idea into a plan.* · **Create an event**; with plans, a card at the bottom: *Do it again?* with the group's own past events (up to 3), and Create an event | Test | |
| 108 | **Your schedule empty state** (v6 Update 10): the same calendar fan and *No plans yet*, *RSVP to something in your groups, or post your own.*, then **Post an event** (purple) and **View calendar** (white, gray ring) | Test | Replaced the white *Nothing on the books yet.* card |
| 109 | **Add to Home Screen pop-up** (v6 Update 11, Round 41d): *RECOMMENDED* · **Make this an app (kinda)** · *Add a shortcut icon on your home screen, no App Store needed.* · the steps: Safari (Update 12, 42b) three stacked rows (••• → Share → Add to Home Screen); Chrome, Firefox, Edge on iPhone two icons in a row (41d); none on Android, where the button opens Chrome's dialog · **Got it** (back in 48 hours) · **Maybe later** / **✕** / scrim / Escape (back in 24 hours). At most once a visit, on Welcome or after signing in, until it's installed; never in the installed app | Test | `sparkhub-a2hs` in localStorage / sessionStorage |
| 95 | **View as a user** (demo admin only, Profile; was *View as a tester*): *Pick one* lists everyone with a real account (Google or email code; not the @example.com demo/test people); tapping one redraws the app as them (their groups and roles, RSVPs, sign-ups, what they lead, what they'd see), with a dark *Viewing as {name} · Exit* pill above the tab bar. Look only: nothing is saved while it's on (the app refuses writes before they leave), and Exit reloads as you | Test | `demo_testers()`; invite-only plans they reached by a shared link don't show |
| 84 | **Event page controls** (idea, plan, happened): the photo runs to the top; a white **Back** circle and, for hosts, a white **Edit** pill; no group name or IDEA pill between them. **Back returns to the screen you came from** (Your tasks, Your schedule, Your plans or ideas, Calendar, Groups, the group page), scrolled to where you were; a link opened cold goes to the group's page | Test | `state.back`, recorded in `go()` |
| 85 | (Replaced by #13) The v5.2 Groups page title and pills | Removed | v6 Update 2 |
| 86 | **Freeze log** (temporary, owner's Profile only): notes when the app stops responding for over a second (screen, what ran last, image count), slow redraws (>150ms) and slow loads (>3s); kept on the device, last 40, Clear button | Test | Tracing the home-screen app freezes (2026-09-27); remove once found |
| 87 | **Pull to refresh**: at the top of any screen, drag down and let go to reload; the header stays put while the feed under it slides down, with a spinner in the gap (screens without a header slide whole) | Test | Touch only; the 30-second background refresh still runs |
| 88 | **Link previews**: shared idea links are `/i/<id>` and show the idea's title, when · where · group, and its photo (or the group's) in iMessage, WhatsApp and the like; invite links (`/join/CODE`) show *Join {group} on Spark Hub* with the group photo; everything else shows the Spark Hub card. Invite-only plans stay generic | Test | `api/preview.js` (Vercel function), `link_preview()` / `group_preview()`, `icons/share.jpg` (`scripts/make-share-image.js`) |
| 112 | **Cancel or delete** (owner, 2026-09-30): Cancel marks it CANCELLED (stays up, closed to replies and sign-ups, no reminders) and notes everyone in it with an optional reason; Delete takes it down quietly | Test | `cancel_event()`, `delete_event(p_quiet)`, `sparks.cancelled_at` / `cancel_reason` |
| 113 | **Remove account** (owner only, New accounts list): deletes an account and everything tied to it, its events quietly; refuses admins; you take over as owner of any group they were the only owner of | Test | `remove_account()` |
| 114 | Audit leftovers (2026-09-30): Can't asks to free your job spots; updates show only to their audience (host can remove); album photos can be removed (adder or host); *You're off it* has Undo; Add to calendar uses the end time / all-day | Test | `20261024000000_leftovers.sql` |
| 115 | **Event types** (owner, 2026-09-30): the host picks up to 2 of Active · Outdoors · Food · Family · Social (Create event's Details step, the Details pop-up); the Calendar's type filter and Search use them; existing events got a one-time guess | Test | `sparks.tags` (`20261027000000_event_tags.sql`) |
| 116 | **Group page Month view** (owner, 2026-09-30): Tiles · List · Month on a group's Plans tab | Test | |
| 117 | **Friends** (v6 Update 13, Your people → Friends): friend requests on top (initials or photo, *Wants to be friends · {shared group}*, ✕ declines quietly, **Accept** → *You and {name} are friends*); a 4-column grid (58px faces, first name, first shared group +N), *Tap friends to invite them together*: tapping selects (purple ring + check), and a sticky **Invite {A & B / A, B + N} to…** bar (✕ clears) opens **Invite {names}**: your upcoming plans you lead or are going to (where the lead allows guest invites). Picking one invites them (*Invited … to {event}.*, skipping anyone already going or invited and saying so). Empty: *No friends here yet* + **Add a friend** | Test | `friend_state()`, `invite_friends()` (`20261030000000_friends.sql`) |
| 118 | **Friend requests from Members:** every member can open a group's Members sheet (the *N MEMBERS ›* line on the group page header); a member's row opens with **Add friend** (→ *Friend request sent to {name}*), then *Requested*, *Friends ✓* or *Accept friend request*. Admins still see emails and role actions there | Test | `send_friend_request()` (needs a shared group), `group_people()` |
| 119 | **Friend profile** (long-press, or right-click, a friend): name, *Friends since {month year}*, *BOTH IN* the groups you share, red **Remove friend** (confirm; they aren't told) | Test | `remove_friend()` |
| 120 | **Friend link** `/add/CODE`: **Add a friend** opens the phone's share sheet (computers copy it: *Friend link copied…*); opening a link asks *Add {name} as a friend?* · **Add friend** (friends straight away, then the Friends tab), signed out *{name} wants to be friends on Spark Hub* · **Sign in to add {first}**; your own: *That's your link*; a dead one: *That friend link doesn't work anymore*. Previews *Be friends with {first} on Spark Hub*. **Get a new friend link** turns the old one off | Test | `my_friend_code()`, `friend_link_preview()`, `add_friend_by_code()`; Vercel rewrite `/add/:code` |
| 121 | **Friend notifications:** the bell shows *{name} wants to be friends* (opens Friends; no phone push) and *{name} invited you to {event}* with the date and I'm going / Maybe (bell and phone push, *{first} invited you to {event}*); a **Friends** topic in Notification settings turns both off. An event you're invited to counts as yours (Calendar, Your schedule, Your tasks) even outside your groups | Test | push topic `friends` |
| 122 | **Guests can invite friends** (lead): a switch under Public / Private in Create event's review and the Who can see it pop-up; on by default. Off: only the lead and the group's admins can invite friends | Test | `sparks.guest_invites` |
| 123 | **Real or test?** (owner, 2026-10-01): Create event's Review has a required choice above **Post it**, *Real event* or *Just testing*. A test event shows the same *DEMO* pill as the seeded demo content, sends no new-event, *It's a plan* or reminder notifications, and is never removed by **Remove all demo content** or a re-seed | Test | `sparks.test` (`20261031000000_test_events.sql`); set only when posting |
| 124 | **Named join links** (owner, 2026-10-01): `/torrez` joins Torrez Fitness (and Hub on Hunters, #79); `/hubonhunters` joins only Hub on Hunters (code `HUNTER`) | Test | `GROUP_LINKS` in sparks.js, rewrites in `vercel.json`, `20261031010000_hub_join_link.sql` |

## Posting and editing

| # | Feature | Status | Notes |
|---|---|---|---|
| 34 | **Create event** (v6 Update 6): 5 steps under a photo panel (*CREATE EVENT*, the title, *n of 5* and a progress line): Event title + cover upload → Date & time (30-minute start list, optional end) → Location → Basic details → How people can help (starter chips, *Add a job* sheet with − n + and optional shifts). **Decide later** (only on an empty step) moves on; **Poll the group** (2–5 different dates or places). Add / Edit on Review comes back to Review; the phone's Back goes back a step, then asks to save a draft. Review: four summary cards (amber *… to be decided*), **Post to** (several groups) and **Public / Private**, **Post it** / **Save as draft**. With a date it posts as a plan; without one (*Decide later* or a poll) as an **idea** (Review says which). Every entry point (+, Start an event, Float an idea, Do it again) opens it | Test | Replaces the one-page Post an event form and the idea steps |
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
