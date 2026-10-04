# Handoff: Spark Hub — Claude Design → live build

**Direction:** design → code. Claude Design keeps this file current; it replaces the `SparkHub v7-N` zips. Ship it with `Spark Hub App Version 7.dc.html` (the prototype). Where this file disagrees with older READMEs or UPDATE files, **this file wins**.

- **Caught up with:** `HANDOFF-to-DESIGN.md` **as of 2026-10-04, morning** (items 25–28 built from *SparkHub v7-14*; its §1 rows 27–31). The build has items 1–28; only **29–31** are new this round.
- **The build's §1 rows 28–31 stand** (shorter tab bar with centred labels, only Up next opens on the day, the event page's tasks box remembers being folded, no *Get a new friend link*). The prototype hasn't been changed to match; the build is right. **§5 Q27 (Settings or Profile?)** is still open.
- **Baseline:** Update 16 (zip *SparkHub v7-5*). Everything below is new since then.
- **Options files (this round):** `Event Updates Options.dc.html` (picks: card **2e**, icon **3b**, lead's buttons **5d**; turn 1 for the composer, list, guard, test events, bell and Got it).
- **Last round's options files:** `Poll Button Options.dc.html` (1g), `Add Event Button Options.dc.html` (1b), `Tab Bar Options.dc.html` (2a; purpose line, first-run tour and empty states not picked yet).
- **Earlier options files:** `Round 17 Options.dc.html` (picks made: Q24 a 24a2, b 24b3, c 24c3c, d no change; Q23 C 23C1; event RSVP 25b + 25c. Still open: Q23 B). `Help Out Options.dc.html` (turns 11+; turns 1–10 moved to `Help Out Options Turns 1-10.dc.html`): **7g (Help out job cards, members), 12e (Help out, lead), 8a/10a (What to expect) and 13e (date tile) are picked and built**; the other turns are exploration. `Soft Holds Options.dc.html` has the soft-holds explorations.

---

## New since 2026-10-04, morning (the build's last round)

29. **Event updates, one way** (owner brief 2026-10-04; `Event Updates Options.dc.html`, card 2e + icon 3b). Answers §4 *Send everyone an update has no way in*.
30. **Edit event sheet: no *Tell everyone going*; *Cancel or delete event* at the bottom** (owner, 2026-10-04). The switch is gone (saving an edit never posts an update; leads use *Post an update*, item 29). Under **Save**: a centred red link, trash icon + **Cancel or delete event** (14.5px/800 `#c0364d`, 44px tall), lead only. It closes the sheet and opens the existing cancel-or-delete flow.
31. **Event header: date tile moves to the left, above the role chip** (owner, 2026-10-04; replaces 13e's top-right spot). In the header photo's bottom-left text block, the tile sits first, stacked above the chip row (*You're leading* / *Helping* / *Going* … and *PRIVATE*), then the title. 82px wide, 16px radius, white, shadow `0 8px 20px rgba(0,0,0,.3)`, **tilted −4°** (was +4°). Month band `#149a4b` 13px/900, date 38px/900, weekday 12.5px/800 `#6b7280`. 6px gap below it, then the chips. With no chip, it sits right above the title. **The pencil after the event title is removed** (and the title is no longer tappable); editing goes through the ✎ button at the top right.
32. **New attention colour: magenta, used sparingly** (option 6b, with the card's look from 6g, `Event Updates Options.dc.html` turn 6). Reserved for "the lead is telling you something": the Updates card, its day-of band, *Post an update* and the bell badge on update rows. Nothing else uses it. Tokens: strong `#d6246e`, ink `#a8164f`, line `#f5c4d7`, tint `#fdf0f5`.

Item 29's details are under *Details for 25–29* below (25–28 are built).

---

## Done in the build's last round (2026-10-03): items 1–24, already built

1. **§5 Q20 Soft holds: designed, Month view only for now** (owner, 2026-10-03). See *Soft holds* below.
2. **Voting card dates are full-width rows**, not three tiles.
3. **Explore: Plans · Ideas · Past pill** beside the sort pill.
4. **Your calendar ends with a Find more events slot.**
5. **Sort names:** By date · Popular · Newest · Needs help. *Needs help* replaces *Could use a hand* everywhere.
6. **Your calendar's Filter** lists only Leading · Helping · Going · Maybe.
7. **Idea page:** no locked *Make it a plan* button.
8. **Your tasks: Ideas empty state.**
9. **Aligned with the build's §1:** the group line only shows when you're in 2+ groups. Explore empty reads *Nothing coming up in your groups yet.* The Your tasks tab icon only shifts 3px when it has a badge.
10. **§5 Q24 (a) Invite: pick, then Send invites** (option 24a2). See *Invite people* below.
11. **§5 Q24 (b) Job pop-up after a starter chip** (option 24b3). See *Add a job* below.
12. **§5 Q24 (c) No help needed as an equal answer** (option 24c3c). See *Ask for help step* below.
13. **§5 Q23 C Jobs joins the idea's steps, softly** (option 23C1). See *Idea page* below.
14. **§5 Q24 (d) Smaller group header: no change.** The owner keeps the current 112px photo header (v7-3 6c). Nothing to build.
15. **Event page: See who's going under the RSVP boxes; Who's in → Visibility** (25b faces + 25c Send invites). See *Event page RSVP* below.
16. **Details → What to expect, with a one-line overview** (option 8a; create step and edit sheet split into two numbered optional parts, option 10a). See *What to expect* below.
17. **Help out job cards: seats, counts and More details** (option 7g). See *Help out jobs* below.
18. **Event header: date tile moves to the top right** (option 13e). See *Event header date tile* below.
19. **Help out, lead's view** (option 12e). See *Help out jobs* below.
20. **Groups tab: one page, smaller header.** See *Your people* below.
21. **Your calendar / Your tasks header: less white.** Padding 22/16/16 → **14/16/10**.
22. **Maybe events: pale green striped strip** (option 19l, in green). In Your calendar's Up next (list, tiles and the Month day list), an event you said **Maybe** to gets a strip with soft diagonal pale green stripes: `repeating-linear-gradient(-45deg, #f7fcf9 0 5px, #e9f6ee 5px 10px)`, text `#2f6e49` (*Maybe* · *Update RSVP ⌄*), thin date line `#a9d6ba`. Going keeps its solid `#f3fbf6` strip. Replaces the pale near-white maybe strip.
23. **Diagonal stripes mean Maybe, everywhere.** Wherever a Maybe has a coloured fill, that fill becomes 45° stripes (5px bands) in its own colour: pale green strips on event cards in Explore, Your calendar and group pages (`#f7fcf9` / `#e9f6ee`, text `#2f6e49`); pale gold Maybe pills and the picked Maybe RSVP button, the status pill, the calendar day list's Maybe pill and the helper RSVP sheet (`#fdf1d6` / `#f9e4b0`); solid gold Maybe on the RSVP segment and the event preview's Maybe (`#e8a71c` / `#f1bb45`). Borders and text colours are unchanged.
24. **Start an event, step 1: shorter header, groups and visibility up front** (options 21a + 22a + 23a in `Start Event Options.dc.html`). The photo header on step 1 drops from 270px to **150px** (hero title 24px on every step). The big upload box becomes a one-line dashed row: camera icon, **Add a cover photo**, *Optional* (56px, 2px dashed `#b9bcc4`, `#f4f5f7`). Under it: **Post to** (20px/900) · *Pick one or more groups.*, a white card with one row per group (36px photo, name 15px/800, 22px square tick; at least one stays picked), then the **Public** / **Private** tiles (Public now reads *Anyone in these groups*). **Review's *Who can see it* section is removed**; Edit event still has its own Visibility sheet.

---

## Details for 25–29 (new)

25. **Poll the group button (Date & time and Location steps) is a yellow tinted row** (pick 1g, `Poll Button Options.dc.html`): 58px tall, 18px radius, fill `#fdf6dc`, 1.5px inset `#e6d08c`, text `#5c4300` 16px/800, icon and chevron `#8a6510`, hover `#faefc8`. Same yellow as the held-date heads-up.
26. **Your calendar has a floating add event button** (pick 1b, `Add Event Button Options.dc.html`): 48px purple `#5b4ae8` circle with a white plus, 18px from the right, 16px above the tab bar (bottom 89px; **now 100px with item 28's taller bar**), shadow `0 8px 20px rgba(91,74,232,.38)`. Opens Start an event. Only on Your calendar; sits under sheets and pop-ups. **Tucks right after 0.75s with no scroll or touch** (slides 50px right, leaving a 16px sliver; 320ms ease). Any scroll or touch brings it back; tapping the sliver only brings it back, it doesn’t open Start an event.
27. **Your calendar's Up next card: tasks start collapsed** (Eric, 2026-10-04). The role strip (e.g. *Leading*) now reads *2 tasks ▾* on the right, like the cards below it; tap the strip to show the task rows (*Fill spot: …* + Ask), tap again to hide. Same for **Helping** cards (your job rows). **Exception: an event that's today opens with its tasks showing.** Open/closed is remembered per event for the session. **On the event page itself, the tasks box starts expanded** (lead's tasks and a helper's jobs alike; tap its header to collapse). **The header (*You're helping* / *Your tasks*) sits at the top of the box, right under the photo, and the rows open downward below it**; the box keeps its 24px rounded bottom corners. **Same order on every event card with a role strip** (Your calendar list / tiles, Explore, group pages): the strip (*Leading* / *Helping* + *2 tasks ▾*) sits directly under the event's title row or photo, and the task rows open below it. **Helping task rows get a paler yellow fill, `#fffefb`** (the strip stays `#fefaef`), on the event page and on every card. Leading task rows get the same treatment in pale purple, `#fdfcff` (strip stays `#f7f6ff` / `#f5f3fe`). No divider lines between the strip and the task rows, or between rows. No tasks: strip reads *All set* and tapping opens the event. Going: *Change RSVP* / *Update RSVP* as before.
28. **Tab bar: labels under every icon** (pick 2a, `Tab Bar Options.dc.html`, owner 2026-10-04). Left to right: **Discover** (compass) · **Tasks** (checklist + badge) · **Calendar** (centre ring, calendar icon, opens first) · **Groups** · **Settings** (gear, opens the profile & settings sheet). Labels always shown: 11.5px / 13px line, 800, no wrap, colour = tab colour (active `#5b4ae8`, inactive `#6b7280`). Icons 24px. Each tab is a column: 8px top padding, 4px gap, min 52px tall, full column width (≥75px at 375). Bar: 84px tall incl. 26px bottom safe padding, white 96% + blur, 1px `#e8eaef` top line. Centre ring: 44px, white fill, rises 20px above its column (`margin-top:-20px`) with a 3px white halo so it cuts the bar's top line; inset ring 2px `#5b4ae8` active / 1.9px `#c3c7d0` inactive; label sits on the same baseline as the others. Add event button moves up to bottom 100px (16px above the bar). The Explore screen is renamed **Discover** (hero title, back labels, empty-state button *Discover events*).
29. **Event updates, one way** (card 2e + bullhorn icon 3b, the rest from turn 1 in `Event Updates Options.dc.html`). The lead (and co-leads) broadcast to people coming; **no replies**. Replaces the hidden *Send everyone an update* button and the old Updates list lower on the page.
   - **Updates card** sits first on the event page, under the photo header and above the RSVP card. Visible to anyone who can see the event. Card uses the new **attention colour, magenta** (option 6g; owner, 2026-10-04): **white** card, 1.5px inset `#f5c4d7`, 18px radius. Head: a 40px **pale magenta strip** (`#fdf0f5`, 1px `#f5c4d7` line under it) with bullhorn 20px + **UPDATE** 13px/900, 1.2px tracking, `#a8164f`. Then, on white (14px/16px padding), the **newest update's text** 19px/800 `#0d1117`. Under it a byline: 20px face, **Name** (13px/800 `#5c6270`) · *45m ago* (13px/500 `#6b7280`). Below, a quiet row **N earlier updates ›** (44px, white, 13.5px/700 `#a8164f`, 1px `#f5c4d7` line above) opens the full list. With only one update there's no row. The lead also gets a ⋯ at the right of the card's byline (delete).
   - **Day of the event:** the head becomes a 36px `#d6246e` band, white bullhorn + **TODAY · UPDATE**; the card gets a 2px `#d6246e` edge and a soft magenta shadow.
   - **No updates:** nothing shows (members and lead alike).
   - **Where the lead posts** (option 5d, `Event Updates Options.dc.html`): in the RSVP card under the faces, two stacked full-width 48px pills, 8px apart: **Invite people** becomes **solid purple** (`#5b4ae8`, white text, person-plus icon; hover `#4a3ad4`), and **Post an update** under it is the **outlined** one in magenta (2px inset `#f5c4d7`, `#a8164f` text, bullhorn 18px; hover fill `#fdf0f5`). Lead and co-leads, plan phase, not cancelled. Opens the composer. There's no Post row in the Updates card and no separate empty-state row.
   - **Composer** (sheet, lead and co-leads only): **Post an update** · ×; quick-start chips *Running late · We're here: ___ · Moved to ___ · Bring ___ · Can someone ___ · Cancelled* (lavender `#f3f1fe`/`#4a3ad4`, picked one purple; a chip fills in the start of the text); one field, **200 characters**, counter bottom right; **WHO GETS IT**: two tiles *Going · N people* (default) / *Going and Maybe · N people*; quiet line *Everyone going gets a notification.* (or *…going or maybe…*); **Post update** (purple; gray until there's text).
   - **After posting:** toast *Sent to N people*; the update is at the top of the card at once.
   - **Gentle guard:** a **third update within 60 minutes** opens a confirm: **That's your third update this hour** · *Everyone going gets a notification each time. Post it anyway?* · **Post anyway** / *Edit first*. No hard limit.
   - **Test and demo events:** updates show on the page, nothing is pushed; quiet line *Test event: it shows on the page, but no one gets a notification.*; toast *Posted. It's a test event, so no notifications went out*.
   - **All updates sheet:** **Updates · N** (lead: **+ Post** pill), *From the event's leads. Newest first.*, each update with face, name, time, text. The lead has ⋯ on each → **Delete this update?** · *It comes off the event page. Notifications already sent can't be taken back.* · **Delete update** / *Keep it*.
   - **Notifications:** push to the chosen audience; title = event name, body = *Joseph: <update>*. Bell row as today's update row (*Joseph posted an update on Trail run*, text quoted under it); tapping opens the event at the card.
   - **Got it (optional, owner to decide; a Tweak in the prototype, on by default):** members get an outline **Got it** pill (thumbs-up) under the newest update; tapped, it turns green `#e7f6ec`/`#0f7a3c` with a check (tap again to undo). The lead sees a quiet **12 got it** count on each update instead. A count, not a list.
   - **Later:** if a chat is added, it goes directly under this card; nothing else moves.


## Your people (Groups tab)

- **Header** matches a group page's header: min 112px photo, same dark wash, padding 22/14/14. Kicker *GROUPS & FRIENDS* 12px/900, title **Your people** 34px/900 (-1.1px). No count line under it (the counts are on the Groups and Friends headings). Search and the bell sit **on the title row** at the right as 40px glass circles. **No add-person button in the header**: adding lives on the Groups and Friends heading rows. Replaces the 180px header with the buttons in the corners.
- **Groups heading row:** **Groups** (24px/900) + count (15px/800 `#9aa0ac`) on the left; on the right a small gray **+ Join or add** pill (option 14c: 34px, `#dfe2e7` fill, no outline, `#454b55` 13.5px/800, 12px +). It opens the add sheet titled **Add a group** with only *Join a group* and *Start a group* (no *Add a friend*). **Start a group is blocked for now:** its row has a gold **SOON** tag (`#fdf1d6` / `#8f6405`, 10.5px/900) and tapping it opens a pop-up: **Starting groups is coming soon** · *For now, ask us to set one up for your team, block or club. You can join any group with its code or link.* · one button **Got it**.
- **No Groups / Friends switcher.** One scrolling page: the groups (as now), then a **Friends** heading row (24px/900, count 15px/800 `#9aa0ac`) with the same small gray pill on the right, **+ Add**, which copies your friend link (same as *Add a friend* in the sheet), then friend requests, then a **summary card** (option 15e): up to 5 overlapping 44px faces (3px white ring, -12px overlap), *+N* (14px/800 `#6b7280`) if more, and a dark **See all ›** pill on the right (36px, `#0d1117`, white 13.5px/800); under it *Darnell, Marisol, Hana and 5 more* (14.5px/600 `#5c6270`). The whole card opens a slide-up **Friends · N** sheet. The sheet (option 16a, `#e8eaee` background):
  - a **Search friends** field (46px pill, white, 1.5px `#dcdfe6`) matching names or shared groups; *No friends match "…"* when empty
  - the line *Tap a name for their profile. Tick people to invite them together.* (13.5px/600 `#6b7280`)
  - one white card (radius 20) with a row per friend, 62px, hairline between: 40px face, name 16px/900, shared groups joined with · (13px/600 `#6b7280`, one line). Tapping the face/name opens their profile; a **26px tick circle** on the right picks them (`#c9ccd3` ring → `#5b4ae8` with a white check)
  - once anyone is ticked, the sticky purple **Invite N to an event…** bar (with the clear button) appears at the bottom, then the existing event picker
  - *Get a new friend link* at the bottom
  - closing the sheet clears the picks and the search
  - replaces the 4-wide face grid with ticks on the faces
- **Group tiles** (the two-column grid) are **4:3** (wider than tall), not square.
- **Pinned group cards** (the big ones on top) lose their white strip of chips (*6 events · 4 ideas*, *Leading 2 · Helping 3*, *N new*): just the photo, name and members.
- Search covers both: placeholder *Search groups and friends*.

## Event header date tile (option 13e)

The tilted date tile leaves the title row and moves to the photo's **top right, under the Edit and Share buttons**: `position:absolute; right:20px; top:72px`, still rotated 4°. A little bigger: **78px** wide (was 70), radius 15, month band 12.5px/900 with 4px padding, day number 36px/900, weekday 12px/800. The title now has the full width at the bottom of the photo. Same show rule as before (only when the event has a date).

## Help out jobs (option 7g)

Each job is one white card (radius 18, padding 14/16, 10px gap). Replaces the bar, the faces + names line and the *Details ›* link.

- **Top row:** title 18px/900. Under it, only when the job has a time: a 13px clock icon + the time (13.5px/600 `#6b7280`); a shift job reads *2 shifts*. **No empty line when there's no time:** the button sits in a wrapper with -6px top and bottom margin, so a 34px button doesn't push the seats down under a one-line title. Right side: **Sign up** (2px `#5b4ae8` outline), **✓ You're in** (`#fdf1d6` / `#8f6405`) or **Full** (`#eef0f3` / `#8a909b`); 34px tall, 14px/800. Shift jobs have no top button.
- **Seat row:** one 34px circle per spot: a face (2px white border) for each person, dashed `#c9ccd3` for open spots. If you can join, the first open spot is a purple **+** (dashed `#5b4ae8`, `#f3f1fe` fill) and tapping it signs you up. Jobs with no limit show the faces plus one **+**. Over 6 circles: the first 4, then a gray **+N** chip. After the seats, the count (13.5px/700 `#6b7280`): *1 open* (one spot), *3 of 6 open*, *n signed up* or *Nobody yet* (no limit). **Full jobs show no count.**
- **Shift jobs:** one `#f7f8fa` row per shift (radius 14): the time (14.5px/800), 26px seats + the count, and that shift's own Sign up / ✓ You're in / Full. Signing up for a shift moves you off any other shift of the same job (one shift per person per job).
- **More details:** if the lead wrote a note, the card ends in a full-width footer bar (thin `#f2f3f6` top line, 44px, 13.5px/800 `#6b7280`): **More details ⌄** / **Hide details ⌃**. The note (14.5px/500 `#454b55`) shows above the bar when open.
- **Jobs you're in:** the card gets a 2px `#f0d48a` outline. Your seat is your normal face, no ring.
- **Order (people who aren't the lead):** jobs you're in, then open jobs, then full ones. The lead sees their own order.
- **Lead's view (option 12e):** the lead signs up like anyone (Sign up / ✓ You're in / Full), with these differences:
  - Title **21px**/900 (-.4px), time **15.5px**/600 `#5c6270` with a 15px clock.
  - A small gray **✎** (32px tap area, 15px icon, `#9aa0ac`) at the end of the title row opens the jobs editor. **The section's own Edit link is removed.** The empty-state *Add ways people can help.* and **+ Add a job** stay.
  - The button moves to the **right end of the seat row**, after the count. Shift jobs keep a button per shift.
  - The lead's note **always shows** under the seats (no More details bar).
  - Open jobs (shift jobs too) end in a plain left-aligned purple **+ Ask someone** link (14.5px/800, no divider). Full jobs have none.
  - The roster with people's names and notes is gone, and the *Asked Hana · waiting · Withdraw* lines are hidden. Asking still works; the "two asked" limit message stays.
  - The lead sees jobs in their own order.

## What to expect (option 8a)

The event page's **Details** section is renamed **What to expect** and gets an optional one-line **overview** (new field `overview`, max 80 characters) above the same up-to-three bullets.

- **Event page card:** white, radius 18, padding 16/18, 6px gap. Overview first: 18px/500 `#0d1117`, wraps. Then the bullets: 7px `#149a4b` dot, 17px/500 `#0d1117`, 4px vertical padding each. **No dividers anywhere and nothing bold.** The section shows if there's an overview or any bullet. The lead's empty prompt reads *Add a one-line overview and up to three quick notes.*
- **Start an event, step 4 (What to expect), option 10a:** the title is **What to expect**, sub *Both parts are optional. Fill in either, both, or skip.* Two numbered parts, each with a label row (26px purple `#5b4ae8` circle with the number in white 13px/900, label 17px/900 `#0d1117`, then a gray **Optional** tag: `#eef0f3` pill, 11.5px/800 `#6b7280`): **1 One-line overview** over the overview input, and **2 Up to three details** over the three bullet inputs (10px extra space between the parts). An overview input (18px/500, counter *n/80* once typing, placeholder *e.g. An evening of backyard games and food with whoever shows up*) sits above the three bullet inputs. The bullet inputs drop from 800 to 500 weight, and their limit goes from 40 to **60 characters** (counter *n/60*) to match the edit sheet, which already allowed 60. The step counts as filled if the overview or any bullet has text. The step is saved in drafts and cleared by Skip like the bullets.
- **Edit sheet** (Edit on the section): titled **What to expect**, sub *Both parts are optional.*, same two numbered parts as the create step; saves `overview` with `bits`.
- The idea's steps strip still says **Details** for now (that strip is being reworked).

## Soft holds (answers §5 Q20)

Behaviour follows `SOFT-HOLDS-for-design.md`, with one change from the owner: **holds show only in Month view** (Explore's Month and a group page's Month). They don't appear in List, Tiles, Up next or Your calendar. The brief's question about folding several options in one week is moot for now.

- **Month grid:** a held day gets a **hollow dot**: 5px, a 1.3px `#e8a71c` ring (`#ecc56a` on the selected black day), after any plan dots in the same row. The day number is **not** bolded for a hold, only for a plan, so plans always outweigh holds. When the month has any holds, a one-line key goes under the grid: gray `#9aa0ac` dot *Plan* · hollow gray dot *Pencilled in* (12.5px/700 `#6b7280`).
- **Tapped day:** first the day's plans as usual, then once a gold label **PENCILLED IN** (12px/900, 1px tracking, `#8a6510`), then one row per hold:
  - the row: `rgba(255,255,255,.55)` fill, 1.5px dashed `#d9c58a`, radius 14
  - the title: 15px/800 `#454b55`; it wraps, never ellipsized
  - the line under it: *9:30am · 2 votes so far* (12.5px/600 `#8a909b`), plus **· ✓ You voted** in `#8a6510` when you voted
  - **Vote ›** on the right (13px/800 `#8a6510`)
  - no date block and no group name
  - tapping opens the **idea page** (never the event preview) scrolled to *Help pick when and where*
- **Start an event, Date & time step:** when the picked date is held by an idea the person can see, a pale gold box sits under the date/time fields:
  - the box: `#fdf6dc`, 1.5px `#e6d08c`, radius 14, pencil icon
  - one hold with a time: *Book club is holding 7pm · voting until Thu*
  - one hold with no time: *… is holding this date …*
  - two or more: *2 ideas are holding this date · voting until Thu*
  - information only: Next works as usual
- **Voting card (idea's VOTE ON A DATE box):** a line at the bottom of the box:
  - everyone: *Holding these dates on the Calendar until Thu, Oct 9*, in a white box with a 1.5px dashed `#e6d08c` border and a pencil
  - the lead: *Holding until Thu, Oct 9* plus a gold **Keep holding** pill (`#e8a71c` / `#3d2a00`, 34px). It adds 7 days from today, then toasts *Holding until …*.
  - lapsed: gray `#f4f5f7`, *These dates aren't held on the Calendar any more.* The lead gets an outlined **Hold them again**.
  - once the lead picks a date (DATE IS SET), the line goes
- **The lead's two reminders** (*6 voted, Saturday leads. Lock it in?* / *Your dates for Book club stop holding tomorrow. Keep holding?*) use the bell's Leading row style:
  - the face spot is a dashed gold pencil tile with the ★ badge
  - drawn in `Soft Holds Options.dc.html` (5a), not wired in the prototype
- **Prototype only:** the tweak *Soft holds* = lapsed shows the lapsed state; holds default to 5 days from today.

## Voting card dates

In *Help pick when and where*, VOTE ON A DATE shows the top 3 dates as **full-width rows, most votes first**, like the location rows below it.

- **Row:** white (`#ecc56a` once you've ticked it), radius 16, min 56px.
- **Tick:** the 26px tick on the left (members only).
- **Text:** *Tue, Oct 20* (16px/900) with a gold *NEW* when just added, and the time under it (13.5px/600 `#5c6270`).
- **Right side:** the votes. The lead gets a purple **Pick** pill there instead of a tick.
- View all and + Add date are unchanged.

## Explore: Plans · Ideas · Past

On Explore's first section heading row, after the **By date** sort pill, there's a second pill in the same ringed style: **Plans ⌄** (default), **Ideas** or **Past**.

- **Icon:** changes with the choice: a calendar with a check (Plans), the lightbulb (Ideas), a clock with a back arrow (Past).
- **Menu:** each row has the same icon, the label, and a count in light gray 600 (*Plans 12*, no dot). Counts follow the group filter.
- **Ideas:** lists the groups' ideas.
- **Past:** lists past events, newest first.
- **Discovery cards** (Needs help…) show only on Plans.

## End of Your calendar

Under the last event, in Up next and Tiles (not in Month or the empty state), there's a green dashed slot. The whole card opens Explore.

- **Card:** 2px dashed `#a9d6ba`, fill `#f3fbf6`, radius 18, 16px padding.
- **Icon:** a 44px green `#149a4b` + circle.
- **Text:** **Find more events** (16px/900 `#0d4a26`), then *See what else is happening in your groups* (13.5px/600 `#0f7a3c`).
- **Right side:** a green ›.

## Sort and filter words

- **Sort options everywhere:** **By date** (was Soonest), **Popular** (was Most lively), **Newest**, **Needs help**. Section headings under a sort use the same words.
- ***Needs help*** replaces *Could use a hand* everywhere: the sort, filter, Search chip, discovery card and its sheet. The line reads *3 events need help* / *1 event needs help*.
- **Your calendar's Filter:** only Leading · Helping · Going · Maybe (This week and Needs help removed).

## Idea page

- **§5 Q23 C (option 23C1):** the gold strip reads **Lead · Location · Details · Jobs · Date**. *Jobs* is done once the idea has a job **or** the lead picked *No help needed* in Start an event (saved on the event). Like Location and Details it shows progress but **doesn't block**: **Make it a plan!** still needs only a lead and a date. Your tasks' idea checkpoints follow the same five steps. **Still being reworked on Design's side** (Jobs may fold into Details), so keep this light in the build.
The purple *things to go* card no longer has the locked gray **Make it a plan** button or its *Unlocks when…* line. The green **Make it a plan!** appears in the gold strip once there's a lead and a date.

## Invite people (answers §5 Q24 a; option 24a2 in `Round 17 Options.dc.html`)

Cynthia tapped a share button thinking she still had to send the invite. Now picking and sending are two clear steps, and the link comes after.

- Each person row ends in a **26px round tick** (white with a 2px `#c9ccd3` ring; `#5b4ae8` with a white check when picked). Tapping ticks/unticks; nothing is sent yet. People already going show *Going* in green; people already invited show *✓ Invited* in purple and can't be picked.
- Under the list, a full-width **Send invites · N** button (52px, `#5b4ae8`; gray `#d5d8df` *Send invites* until someone is picked). Sending invites everyone ticked at once, closes the sheet and toasts *Invited Hana and Joseph* (3+: *Hana, Joseph and 2 more*).
- Then a centred divider **OR SEND DIRECT LINK** (12px/800, 1px tracking, `#9aa0ac`, hairlines either side), the link row with **Copy**, and Messages · Email · WhatsApp · More, unchanged.
- Ask two people first uses the same sheet.

## Add a job (answers §5 Q24 b; option 24b3 in `Round 17 Options.dc.html`)

Cynthia tapped *Bring* and typed "snacks" in the description, leaving the title as *Bring*. Now the title is the only place to type at first.

- After a starter chip, the title field holds plain text **Bring␣** (17px/800) with the cursor after it, and gray italic filler right after the text (*snacks, chairs, ice…*; for Set up *chairs, tables…*, Help with *check-in, the grill…*, Clean up *trash, tables…*, Coordinate *food, rides…*). It's ordinary text: backspacing deletes the verb for a different kind of job. The filler goes as soon as anything is typed after the verb.
- Under the field, lowercase suggestion chips that finish the title in one tap (Bring: *snacks · drinks · ice · chairs · plates & cups*; each verb has its own five). Shown only while the title is just the verb.
- The description is hidden behind a purple **+ Add details or a time** link (it shows by itself when editing a job or once it has text). No *type your own* or *something else* chip.

## Ask for help step (answers §5 Q24 c; option 24c3c in `Round 17 Options.dc.html`)

Joseph read *Decide later* as an open tab and *No help needed →* as a skip. The step now asks for a real answer, without making no help look like a win.

- Step 5's title is **Ask for help** (was *How people can help*). The 1-2-3 explainer and START WITH ONE chips are unchanged.
- Under the chips: an **OR** divider (as on the Date step), then a plain radio row **No help needed** (white, radius 16, min 56px, 1.5px `#dcdfe6`; picked: 2px `#5b4ae8` ring, filled purple dot). Under it, centred, light gray *Most events go better with a few helpers!* (12.5px/600 `#9aa0ac`). No green, no tick.
- **Decide later is gone from this step.** The main button is the usual purple **Next**: gray until a job is added or No help needed is picked, with *Add a job, or pick No help needed.* above it. Adding a job clears the No help needed pick.
- Review's row still reads *No help needed* when picked.

## Event page RSVP (options 25b + 25c in `Round 17 Options.dc.html`)

- Inside the RSVP card, under Going · Maybe · Can't, a centred row: the going faces (30px, overlapping, up to 4) and **See all ›** (14.5px/800 `#4a3ad4`). Tapping the row opens Who's coming (lead) / Who's going (members).
- **The lead** also gets an outlined **Invite people** button under it (46px, 2px `#c9c2fb`, `#4a3ad4` 15px/800, person-plus icon), opening Invite people.
- **The lead tools card is hidden for now** (owner, 2026-10-03): the purple *Invite people* button and *Send everyone an update* link under the RSVP card. Invite people lives in the RSVP card now; *Send everyone an update* has no entry point on the page for the moment (the lead's Your tasks rows and Edit event still send updates).
- The section below is renamed **Visibility** (was *Who's in*). Its faces row, *Just the leads so far · Send invites*, *N invited ›* and *N going ›* are gone; it keeps the posted-to group(s) and Public / Private with the lead's Edit.

## Your tasks: Ideas empty state

With no ideas you lead, the Ideas section still shows: a gold **0** badge and *Ideas*.

- **Card:** the same gray invite card as Leading and Helping.
- **Icon:** a white 40px circle with a gold bulb.
- **Text:** **Got a "we should…"?** · *Post an idea with only rough details and see who's in.* · ›
- **Tap:** opens Start an event.

---

## Coming next (options out for Eric's pick, in `Round 17 Options.dc.html`)

Not for building yet:

- **Q23 (B) Undated out of dated rows:** design's lean is 23B1, dated plans only in Leading, with quiet *Date TBD · N plans still need a date ›* and *DRAFTS · N not posted yet ›* rows under it.

## Not this round

- §5 Q23 A and *Start here* stay parked (owner).
- Other §5 questions (4, 6–12, 15, 16, 18, 19, 21, 22, 24 e–g) are still open on Design's side.
