# Handoff: Spark Hub v6 — new screens, layouts & behaviors

> **Latest: read `UPDATE_15.md`** (Version 7: the screens the build invented, designed properly — event preview slide-up 13a, guest list, came-down notes, phone notifications card, Remove and block, friend link pop-ups, and more). Read it after this README and UPDATE_2–14. Where they conflict, the newest update wins.

## ⚠️ Read first — scope rules
- **Do NOT change any content.** Keep every existing event, idea, group, person, date, time, address, photo, RSVP, sign-up, notification and demo/seed record exactly as it is in the live app today (it was set from `EVENTS_CONTENT_HANDOFF.md` in the v5 handoff). Nothing in this brief replaces data.
- **Only add/replace UI, layout and behavior** described below. Wherever this brief shows sample numbers/names, they are illustrations — always compute from the app's real data.
- Where v6 introduces *new* fields (e.g. event "types"), derive them as described; don't edit event records to add them.

## About the design files
`Spark Hub App Version 7.dc.html` is an **HTML design reference / prototype** (single-file, inline-styled, class-based logic), not production code. Recreate the look and behavior in the live app's existing stack and component patterns. Open the file in a browser (keep `support.js` and `photos/` beside it) to click through every state. `screenshots/` shows the key states at 393×852.

## Fidelity
**High-fidelity.** Colors, type sizes, spacing, radii and copy below are final. Match them.

---

## Global

### Frame & type
- Mobile, 393×852 design frame. Font: **Figtree** (400–900). Page background `#e8eaee`; cards white.
- Cards: radius 16–20px, shadow `0 1px 3px rgba(15,18,25,.08)`.
- Slide-up sheets (used everywhere in v6): scrim `rgba(13,17,23,.45)` fade 180ms; sheet from `top:64px` (Profile/Notifications `top:48px`) to bottom, radius `24px 24px 0 0`, bg `#e8eaee`, white header block with 40×5 grab handle `#dcdfe6`, enter `translateY(100%)→0` 260ms `cubic-bezier(.2,.8,.2,1)`. Tap scrim or Close (40px round `#f2f3f6`, X) to dismiss.

### Role color system (used on all cards/strips)
| Role | Dot/bar | Strip bg | Ink |
|---|---|---|---|
| Leading | `#5b4ae8` | `#f7f6ff` (pill `#f3f1fe`) | `#4a3ad4` |
| Helping | `#e8a71c` | `#fefaef` (pill `#fdf1d6`) | `#8f6405` |
| Going / Maybe | `#149a4b` | `#f3fbf6` (pill `#e7f6ec`) | `#0f7a3c` |
| Idea (you lead) | `#e8a71c` | `#fefaef` | `#8f6405` |
| Not joined (Calendar) | `#c3c7d0` | `#fafafb` | `#454b55` |
Other: dark ink `#0d1117`, body `#2a2f38`, muted `#6b7280`, faint `#8a909b`, hairline `#f2f3f6`, border `#dcdfe6`, alert red `#e2556b`.

### Bottom nav (5 tabs, equal grid)
`Your tasks` · `Your schedule` · **`Calendar` (center)** · `Groups` · `Profile`.
- Removed from nav vs v5: Notifications bell tab, "Your plans / ideas" (lightning) tab. (The Your plans screen still exists but is not linked from nav.)
- Calendar tab: 48px circle **outline** around the calendar icon — idle `inset 0 0 0 1.9px #c3c7d0`, icon `#6b7280`; active `inset 0 0 0 2px #5b4ae8`, icon `#5b4ae8`.
- Profile tab: person icon; opens the **Profile sheet** (not a page); highlighted while the sheet is open.
- Default screen on launch = **Your tasks**.

### Header pattern (Your tasks, Your schedule)
Single row, 14px/16px padding, white: [profile photo — Your tasks only] · H1 30px/900/-1px · [bell].
- **Profile photo** (Your tasks only): 40px avatar inside 2px padding + `0 0 0 1px #e6e7eb` ring, plus an 18px white ⌄ badge bottom-right (`0 0 0 1.5px #dcdfe6`). Tap → Profile sheet.
- **Bell**: 44px round `#f2f3f6`, 21px bell; red unread badge (18px, `#e2556b`, 2px white border). Tap → **Notifications sheet**.

### Profile & Notifications = slide-up sheets
Both are the full v5 screens moved into sheets (content unchanged). Profile has a Close X top-right; Notifications has its settings gear + Close X beside the title. Navigating anywhere from inside closes the sheet.

---

## Screen 1 — Your tasks (new default home) · `01`, `02`
Purpose: everything that needs your action, grouped by role.

Sections, top→bottom, 16px gap: **Leading**, **Helping**, and **Ideas** (only if you lead ideas with open items). If you lead no upcoming plans, Leading moves to the **bottom** as an invitation card (see below).

**Section header row:** count badge on the left (19px pill, 11px/900 white; Leading `#5b4ae8`, Helping `#149a4b`, Ideas `#e8a71c`; Leading shows 0 when empty) · title 22px/900 `#0d1117` · right "View all ›" 14px/800 `#6b7280` (hidden when the section is empty).
Note: on **Your tasks** the Helping section is **green**; on Your schedule / Calendar, Helping is **yellow**. Keep both as specified.

**Horizontal carousel** (scroll-snap, 290px cards, 10px gap, bleeds to screen edge with 14px scroll-padding). Card:
- **Photo banner** 92px, event photo, gradient `to top rgba(13,17,23,.94)→.55 (60%)→.3`. Title 18px/900 white, `text-wrap: balance`, max 2 lines (grows upward). Date line 11px/900 uppercase, tinted (Leading `#cfc9ff`, Helping `#9eecbc`, Ideas `#ffd98a`). White chevron › 22px @ .85 opacity, right-center; title stops 40px from right.
- **Leading plan cards only — stats strip** (40px, bg `#fafafb`, padding 0 30px, space-between): 4 icon+value items 13px/800: ✉ Invited `inv.sent` · 👥 Going (count) · 📋 Sign-ups `filled/needed` (clipboard-check icon) · 🔔 Reminder (day-before date / "Sent" / "Off"). Color: covered = `#454b55`, needs attention = `#b07a0a`, n/a = `#9aa0ac`. Going is always `#454b55`.
- **To-do rows** (min 46px, padding 9px 12px, 1px top hairline): 7px role dot · text 14.5px/700 one line with ellipsis · right pill CTA (28px, 11px pad, role pill bg/ink, 13px/800). Helping sign-up rows show the **time** as plain ink text instead of a pill.
- Show max **2** rows. If >2, a **"+N more ⌄" sliver**: 26px tall, pale role tint (`#f9f8ff` / `#f4fbf6` / `#fefaef`), 12px/800 role ink, centered. Tapping **anywhere in the to-do area** expands all rows in place → "Show less ⌃"; tapping when ≤2 rows opens the event.
- Tap photo/banner → open event.

**Ideas cards** (you lead an idea): same banner; instead of to-dos, **4 checkpoint rings** in a row (40px ring, gray track `#eef0f3`, amber progress arc `#e8a71c`, icon inside; done = solid green `#149a4b` circle w/ white check) with 11.5px/800 labels (green when done): **Date · Location · Roles/Helpers · People**.
- Progress: Date = top date votes ÷ interested (done when a date is set); Location = 0 / .5 if suggestions exist / done when spot set; People = interested ÷ min people (or ÷10); Third ring is **staged**: if the idea has **no roles/sign-ups defined** → icon "list+plus", label **Roles**, action "Add essential roles"; once roles exist → clipboard-check icon, label **Helpers**, progress = filled ÷ total slots (starts ~25%), action "Get helpers"; done = "Helpers on board".
- Each checkpoint is tappable → opens the idea scrolled to that section (Dates / Location / Sign-ups / interested faces).

**Helping card to-dos** (generated per event you're going to/maybe/signed up for, not leading): "Confirm RSVP" (+RSVP) if no reply; **"You said maybe" + "Update RSVP"** if maybe; each of your sign-ups (item text + time); "Location TBD · Check"; "Today/Tomorrow · 7pm · Directions" if ≤1 day; "In N days · Details" if ≤7 days. Sorted by **most to-dos first**, then soonest.

**Leading to-dos** (existing v5 `ownActs` logic, plus): pending suggestion → "Dee’s time idea / Hana’s spot idea · Review"; past events → two items "Say thanks · Thank" and "Add photos · Add". All labels kept short enough for one line.

**Empty / invitation states:**
- Leading with nothing to do but you lead plans → "Nothing needs you on the events you lead."
- You lead **no** upcoming plans → Leading renders at the **bottom** as a light gray invite card (`#f4f5f7`, inset border `#dcdfe6`, radius 18): + circle · "Start an event" / "You’re not leading anything yet. Got an idea for your group?" · › → Post an event. Badge shows purple 0.
- Not going/helping anything → Helping shows "Find something to help with" invite card (heart icon) → Groups.

**"View all" sheet** (`02`): per section. Title = section name, Close X. Each event = own white card (radius 16): 40px thumb · title 15px/800 balanced · date 12.5px/700 role ink · gray ›. Leading plans also show the stats strip. To-dos listed below (all of them, one line each). Ideas show the 4 checkpoints as **stacked rows** (30px ring, action text: "Pick a date" / "Pick a location" / "Add essential roles"→"Get helpers" / "Get more people interested"; done text gray: "Date set", "Location set", "Helpers on board", "Enough people in"), each row tappable → idea section. Tapping an event closes the sheet and opens it.

---

## Screen 2 — Your schedule · `03`, `04`, `05`
Purpose: every upcoming plan you're involved in (lead, going/maybe, helping). **No** All/Leading/Going toggle, no logo, no profile photo, no group picker. Header = "Your schedule" + bell.
Month section headings (22px/900). First heading holds the **view dropdown** (gray icon + ⌄, menu with Tiles / List, purple check). Grid view removed.

**Tiles** (`03`): 20px-radius card.
- Photo 180px-ish (existing), darker gradient `to top rgba(13,17,23,.95)→.65 (45%)→.3`. Date 13px/900 uppercase tinted; title **25px**/900 `text-wrap:balance`; place 14.5px/700 with pin. **No role chips on the photo.**
- **Bottom strip** (40px, role tint, 13.5px/800 role ink, space-between): left = icon + role word — Leading: Spark bolt icon; Helping: clipboard-check; Going: ✓ ("Going" or "Maybe"). Right = Leading/Helping "N tasks ⌄" (or "All set"), Going "Change RSVP ⌄" / Maybe "Update RSVP ⌄". Tapping the strip on Leading/Helping expands your to-dos in place (same rows as Your tasks; strip right becomes just ⌃); Going opens the event.

**List** (`05`): one white card per event (radius 16): 40px date block (DOW 10.5px/900 `#6b7280`, day 20px/900) · 3px role-color bar · title 15px/800 one line · "time · place" 12.5px/600 · gray ›. Below: 28px strip (12px/800) — role left, "N tasks ⌄" / "Change RSVP ⌄" / "Update RSVP ⌄" right; expands in place like tiles. Colors: Leading purple, **Helping yellow**, Going/Maybe green.

---

## Screen 3 — Calendar (community calendar) · `06`–`12`
Purpose: browse **all** upcoming events across all your groups; discover things to join or help with.

**Header** (180px photo, `photos/walnut-creek-parade.jpg`, gradient as tiles):
- Top-right: frosted **search** button (44px, `rgba(255,255,255,.18)` + blur 8px, white icon) and frosted bell (white icon, red badge).
- Bottom-left: "COMMUNITY" 13px/900 1px-tracked `#cfc9ff` · "Calendar" 34px/900 white · "All events from your N groups" 14px/700 white .88 (N = your group count).
- **FAB** inside the photo bottom-right: 52px purple `#5b4ae8` circle, white +, shadow `0 6px 16px rgba(13,17,23,.35)` → Post an event.

**Filter row** (below photo, 8px gap): 
- **Groups** pill (36px, white, inset border, 13.5px/800, people icon) → dropdown checklist (`07`): header "GROUPS" + **Select all** (purple) / **Clear** links; one row per group with 20px checkbox (on = purple + white check) and event count; all start checked; toggling one never clears others; footer black button "Show N events" closes. Label: "All groups" / "1 group" / "N groups" / "No groups".
- **Type** pill (tag icon) → same checklist UI (`08`), header "TYPE OF EVENT" + Clear: **Outdoors, Food & drink, Fitness, Kids & family, Arts & crafts, Games, Volunteering, Social** with counts. Label "All types" / type name / "N types". *Types are placeholder/derived*: match keywords in title+description (e.g. potluck→Food & drink, trail→Outdoors, poker→Games, cleanup→Volunteering); events matching nothing = Social. Do not write types into event data; this will be replaced by host-chosen tags later.
- **Clear filters** (purple text, right end) only when a filter/search is active.

**Discovery (always shown, each dismissible with an X for the session):**
- **"Feeling wild?"** card: fan of 3 mini playing cards (34×46, white, rank+suit corner A♠ K♥(red) Q♣, event photo face, rotated -14/0/14°) · "Feeling wild?" 15px/800 · "We’ll deal you a random event" · › · X. Tap → open a random event from the current results.
- **"N events could use a hand"** line: 3 overlapping 26px event photos · "**N events**" (amber) "could use a hand" · › · X. Tap → **Could use a hand sheet** (`10`): events you don't lead within a 2-week window (starting at the first upcoming such event) with open sign-up slots. Card = List-view header (date block, **yellow** bar, title, "time · place", ›) + one row per open role: hollow 10px amber ring dot · role · "N of M open" · black **Claim** pill → adds you to that sign-up, toast "You claimed …", then RSVP prompt (below); becomes "✓ Yours". Line count equals sheet count; hidden when 0.

**Section heading row**: month label (Today / This week / Month) · right: **Sort** (gray text+icon, no border): Soonest / Most lively / Newest / **Needs you** (most open slots first; headings "Could use a hand" / "All covered") · **View** dropdown: Tiles / List / **Month**.

**List cards** (`06`): same as Your schedule list card + 44px photo thumb on right; sub-line = "time · condensed street address" (text before first comma). Strip:
- Yours → role colors as above; Helping right side shows just the count "1 ⌄"; Maybe → "Update RSVP".
- **Not joined** → gray strip `#fafafb`: left "**5 spots left**" (bold) + " · 6 going" (600, `#8a909b`) — or just "6 going" if no open slots; right "**RSVP**" plain black text → opens the event.

**Tiles**: 170px photo card (group name frosted tag top-left), same strip.

**Month view** (`09`): header "October 2026" + ‹ › (36px outlined circles) + view dropdown (no sort). 7-col grid: S M T W T F S; day cells 46px; days with events bold with up to 3 dots (5px: Leading purple, Helping amber, Going green, others gray); today number purple; selected day = black rounded cell, white text/dots. Below: "Thursday, October 15" + that day's event cards (List style). Opens on the month of the first upcoming event. Filters apply.

**Search** = slide-up sheet (`11`, `12`): tapping the header search icon opens it. Field (white card, autofocus, clear ×) + purple **Cancel**; row of **type chips** (toggle, black when on); hint "Search by event name, place, or group."; live results as you type (40px thumb · title · "date · group" · ›), "No events match “…”" when empty. Tap result → close + open event. Cancel/scrim → close and clear query.

---

## Cross-cutting behaviors
- **RSVP required when helping:** whenever a non-lead signs up for a task, claims a role, or taps "I’ll help organize", if they aren't already Going/Can't-go, a non-dismissable sheet asks "Will you be there?" (or "Confirm your RSVP" if Maybe) with body "Thanks for pitching in! You can help even if you can’t attend. Just let {lead} know." and three full-width buttons: **I’m going** (green) / **Maybe** (amber tint) / **Helping, not attending** (gray). Choosing sets the RSVP and toasts.
- **Maybe everywhere →** CTA reads **"Update RSVP"**.
- Toasts reuse the v5 toast.

## State (new)
`screen` default `'home'` (Your tasks); `sched` = Your schedule. Sheets: `profSheet`, `notifSheet`, `dashAll` ('Lead'|'Going'|'Idea'), `rsvpAsk` (event id), `cHandSheet`, `cSearch`. Expansions: `dashOpen{id}`, `schedOpen{id}`. Calendar: `cq`, `cGrps` (array of group idx; default all), `cTypes` (array), `cSort` ('soon'|'lively'|'new'|'help'), `cView` ('list'|'tiles'|'month'), `cMonOff`, `cDay`, `cWildHidden`, `cNeedsHidden`. Your schedule: `homeView` ('tiles'|'list').

## Assets
All photos are the existing app photos (`photos/`, `photos/faces/`). Calendar header uses `walnut-creek-parade.jpg`; "Feeling wild?" cards use `poker-night.jpg`, `paintball.png`, `pumpkin-nights.png`. Icons are simple 24-grid stroke icons (inline SVG in the reference) — use the app's icon set equivalents: list-check, ticket-check, calendar, grid, person, bell, search, plus, tag, people, clipboard-check, spark/bolt (brand), dice not used.

## Files
- `Spark Hub App Version 7.dc.html` — full interactive reference (open in browser).
- `support.js` — runtime for the reference file.
- `photos/` — images referenced by the reference file.
- `screenshots/01…14` — key states:
  01 Your tasks · 02 Your tasks View all · 03 Your schedule Tiles · 04 view menu · 05 Your schedule List · 06 Calendar List · 07 Groups filter · 08 Type filter · 09 Month view · 10 Could use a hand sheet · 11 Search sheet · 12 Search results · 13 Notifications sheet · 14 Profile sheet.

## Open items (not in v6 yet)
- Event preview slide-up (explored as options 13a/13b/13c) — undecided.
- Real event type tagging by hosts (replace keyword-derived types).
