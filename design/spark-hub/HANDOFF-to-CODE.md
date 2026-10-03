# Handoff: Spark Hub — Claude Design → live build

**Direction:** design → code. Claude Design keeps this file current; it replaces the `SparkHub v7-N` zips. Ship it with `Spark Hub App Version 7.dc.html` (the prototype). Where this file disagrees with older READMEs or UPDATE files, **this file wins**.

- **Caught up with:** `HANDOFF-to-DESIGN.md` **as of 2026-10-03** (the reset to Update 16). Its §1 rows 1–4 are now in the prototype too, so the build can drop them.
- **Baseline:** Update 16 (zip *SparkHub v7-5*). Everything below is new since then.
- **Options files:** `Round 17 Options.dc.html` (picks made: Q24 a 24a2, b 24b3, c 24c3c, d no change; Q23 C 23C1; event RSVP 25b + 25c. Still open: Q23 B). `Help Out Options.dc.html` is a new exploration of the Help out section; **nothing to build from it yet**. `Soft Holds Options.dc.html` has the soft-holds explorations.

---

## New since 2026-10-03 (Update 16)

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

---

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
