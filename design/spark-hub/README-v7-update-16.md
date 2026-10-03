# Spark Hub v7 — Update 16 (read after UPDATE_15.md)

Brings `Spark Hub App Version 7.dc.html` in line with HANDOFF-to-design.md as reset to the v7 baseline (2026-10-03: §1 rows 1–17, §2). Soft holds (`SOFT-HOLDS-for-design.md`) and Emily/Cynthia's A/B/C (`FEEDBACK-ADDENDUM-for-design.md`) are not in this update; they're next, as options.

## Start an event
- **Who's leading it?** is the last step (6 of 6), after How people can help. No *Decide later*; its button reads **Review**. **No help needed →** now goes to it.
- How people can help: the subtitle is gone; a **Coordinate** starter chip after Clean up.
- No *How many do you need?* anywhere (Details pop-up), and no People step.

## Review
- Every part (Date & time, Location, Details, How people can help) says **Edit** and opens a bottom sheet over Review with that step's fields: gray `#e8eaee` body, 22px title, white close circle, purple **Done**. Fields change the event as you type; Done and close both go back. Date & time and Location open tall (up to 640px). The title's pencil opens *Event title* (title + cover); Done waits for a title (*Add a title first*).
- New first two cards: **Real or test** (always looks temporary: `#fffaea`, 2px dashed `#d9a83a`, 9px hazard stripe `#f5b729`/`#3d2a00` along the top; Edit reopens the pop-up with a **Done** button) and **Lead** (*You're leading it* · *You pick the date and place and keep it moving.* / *Just floating it* · *It goes up as an idea that needs a lead.*; Edit opens the two lead cards in a sheet, and picking one closes it).
- Floating: Real event reads *It shows on the Ideas board.*; the gold card is **This goes up as an idea that needs a lead** (+ *Your date stays on it.* with a date; private version for Private); the gold button reads **Float the idea** even with a date.
- Empty parts read **Details TBD**, **Help TBD**, **Location TBD**. Several groups: *Torrez Fitness & 1 other* / *& 2 others*.

## Idea page
- No *I could help make it happen* checkbox.
- **Make it a plan!** needs only a lead and a date. The purple card lists only those (*Unlocks when that's done* / *when both are done*); the strip still shows all four steps.
- **+ Ask someone to lead** (white, gold +) under *Someone to lead* for the floater and group admins. The row's line reads *Asked Otto* / *Asked 3 people*; the person asked sees *Theo asked you*.
- Floating an idea opens **Ask someone to lead** by itself (instead of *Ask two people first*).

## Ask sheets (one bottom sheet, three uses)
- **Ask someone to take "{job}"**: *A personal ask lands better than a post to everyone…*, required **I THOUGHT OF YOU BECAUSE…** box (placeholder *you were great on barricades last year*), *0 of 2 asked* (amber *That's two waiting…* at two), then people with a purple **Ask** pill (gray until the line is written) → green **✓ Asked**.
- **Ask someone to lead**: no line; search when there are more than 7 people; *Can help* (green) and *Interested* (gray) sorted first; quiet *Or share the idea*.
- **Hand it to someone**: optional note; one ask at a time.

## Jobs
- Lead's Help out cards (jobs without shifts): *Asked Lin · waiting* rows (22px face, red **Withdraw**), *Lin can't this time*, purple **+ Ask someone**, or gray *Two asked. Wait for an answer, or withdraw one.*
- Lead's tasks (Your tasks Leading cards and the event page's Your tasks): one row per job with spots left, *Barricades: 2 spots to fill* (*· 1 asked*), **Ask** (shift jobs: **Share**). Replaces *N spots open · Share list* / *Fill open spots*. The event page's *Add details* task is gone.
- **Someone asked you**: a cream card above Help out (`#fffaf0`, 2px `#efc95a` ring): face, *Hana asked if you'd take Barricades*, the line in italic quotes, purple **I'm in** (signs you up and marks Going) and outlined **Can't this time**.

## Leads sheet
- Lead only: purple **→ Hand it to someone**, or *Asked Otto to take over · waiting* + **Withdraw**. The person asked gets the same cream card: *… asked if you'd take over leading* · **I'll take it** / **Not this time** (yes: they lead, the old lead becomes a co-lead).

## Bell
- *{Name} asked if you'd take {job} for {event}* (✋ on gold, the line in the gray quote box), *{Name} asked if you'd lead {idea}* and *… asked if you'd take over leading {event}* (★ on `#7b6ef0`). All under **New**.

## Who's in
- When only the leads are going, **N invited ›** (14.5px/800 `#4a3ad4`, gray chevron) sits right of *Send invites* and opens Who's coming.

## Group page
- **Invite** in the header and **Invite · Copy link** in the ⋯ menu are for owners and admins only. Members get **Search** (purple) · **Alerts**.
- Invite opens the phone's share sheet (*You're invited to {group}. Make plans with your people and show up together.* + link), or copies the link on a computer.
- **Invite link & code** (Admins only) opens Edit group.
- A group always opens on its **Plans** tab.

## Give feedback
- Under the box: **Add a screenshot** *(optional)* (48px dashed row with a camera) → gray row with a 44×64 thumbnail, *Screenshot added*, ✕. Then a quiet line: *Sent with: iPhone · iOS 26 · Safari · Home Screen app · {screen}. Your last few taps and any errors come along too…*
- Owner's inbox: the screenshot (84×120, tap to enlarge), and a gray box per note: device line, *On {screen} · "{event}" · {group} · v7 · N min in the app · from the 10-minute card*, red *N recent errors*, **Last taps and errors** (expands the list).

## New tab bar and opening screen (owner, 2026-10-03)
- **Tabs, left to right:** **Explore** (compass, 23px 1.9 outline; the old Calendar) · **Your tasks** · **Your calendar** (centre ring, calendar icon; was *Your schedule* with the ticket) · **Groups** · **Profile** (gear).
- **The app opens on Your calendar** (Up next), after sign-in too; Back with no history goes there.
- **Explore header:** eyebrow *ALL EVENTS*, title **Explore**, line *Everything happening in your N groups* (N = your group count). Same List · Tiles · Month, filters and + as the Calendar.
- **Group filter on each screen, remembered separately on the device** (Explore, Your tasks, Your calendar). Pick **one or more** groups (checklist with *All groups* at the top and a black **Done**).
- **Your tasks and Your calendar (option 1b, `Calendar Header Options.dc.html`):** a group line directly under the 30px title (1px gap): people icon, *All groups ⌄* in gray `#6b7280` 14.5px/800; once narrowed it turns purple `#4a3ad4` and reads the group name (*Torrez Fitness ⌄*) or *2 groups ⌄*, with an ellipsis on long names. Tapping it opens the checklist under it. No extra row in the header. Header padding is 22px top, 16px bottom.
- **Explore** keeps its multi-group pill in the filter row and adds a lavender *Showing: Torrez Fitness ✕* (or *Showing: 2 of 3 groups ✕*) chip when narrowed.
- **Search** on Your tasks and Your calendar opens the search sheet over that screen (it no longer jumps to Explore).
- **Your tasks badge:** the tab's icon sits 3px left so the icon + count badge reads centred.
- **Role filter** on Your calendar stays in its Filter menu (Leading · Helping · Going · Maybe).
- **Maybe is lighter than Going:** strip `#fbfcfb`, text `#3c7a55`, dot `#a9d6ba`; the tile chip is pale green `#a9d6ba` with dark `#0f3d22` text (Going stays solid `#149a4b`).
- **Empty Your calendar:** *Nothing on your calendar yet* · *Anything you say yes or maybe to lands here. See what's happening in your groups and pick something.* · purple **Explore events** (compass) and outlined **Start an event**.
- Ideas stay on Your tasks only. *Start here* (choose your opening screen) is parked.

## Already matched (no change)
- Who's coming colours (MAYBE `#b07a0a`, CAN'T `#6b7280`), event preview 13a, swipe chevrons, Up next section names, feedback ask 1c.
