# Spark Hub v6 — Update 5 (read after README.md and UPDATE_2–4.md)

The files here are HTML **design references**. Rebuild them in the app's own stack; don't ship the HTML. `Spark Hub App Version 6.dc.html` is updated. Mockups are in `Event Page Options.dc.html`, Rounds 40–51; the chosen options are listed below. Font: Figtree throughout. New screenshots: `28–34` (event page + sign-up flows).

This update is mostly the **event page (Plan phase)**. It **replaces UPDATE_4's "Event page, Plan phase" section** where the two conflict.

---

## 1. Data model changes

### Sign-ups (`signup[]` on each event)
Each row:
```
{ id, item, time?, desc?, need?, people: [{ who, note? }], shifts?: [{ id, time, need, people: [{ who, note? }] }] }
```
- `time`: free text, e.g. `"5:00 – 6:00pm"` or `"8:30am"`. Optional.
- `desc`: "what's involved". Optional, can be long.
- `shifts`: when present, the row has **no** top-level `need`/`people`. Totals are the sums across shifts. Row time shows as `"2 shifts · 6:00 – 8:00pm"` (first start → last end).
- Editing a sign-up list (adding an item, notes) must **not** merge shift rows back into one job.

### Event
- `helpLine`: a one-line help summary. Stored and seeded on every demo event, but **not currently shown** (see §4).
- `leadName`: used for "X is counting on you" and "We'll let X know".
- The **Chip in** feature is removed from the UI (`chipIn` can stay in data; nothing renders it).

### Demo data
All 26 planned events now have sign-ups in this shape (times, descriptions; 9 have a two-shift job). See the `DEMO` array and the planned sparks in the reference file. Paintball's "Collect chip-in at the gate" was renamed **"Check names at the gate"**.

---

## 2. Event page layout (Plan phase), top to bottom

Page body: padding `16px 14px 26px`, sections stacked with an **18px gap**. Section titles (where they exist) are sentence case, **on the gray page above a white card**, never inside the card (option 46e).

Cards: bg `#fff`, radius 18, shadow `0 1px 3px rgba(15,18,25,.08)`.

| # | Section | Title |
|---|---|---|
| 1 | Photo header (unchanged from UPDATE_4) + **share icon** | — |
| 2 | **You're helping** sliver | — |
| 3 | RSVP | none |
| 4 | Date & time card | none |
| 5 | Where card (map) | none |
| 6 | Guest list (lead only), Before the day, Updates | yes |
| 7 | **Help out** (sign-ups) | yes, 24px |
| 8 | Hosted by (unchanged) | — |
| 9 | Who's going | yes |
| 10 | Inspo | yes |

**Removed:** the About the event card, the Chip in card, "Reminder the day before", and the separate "You're helping with" card.

Screenshots: `28-event-top.png`, `30-event-rsvp-date-where.png`, `31-event-help-out.png`.

### Section title style
17px/900, letter-spacing -.3px, `#0d1117`, padding `0 4px`, 8px above its card. A right-side meta can sit on the same row (e.g. Who's going → "8 going", 13.5px/800 `#0f7a3c`). "Updates from X" is now just **"Updates"**.

---

## 3. Components

### 3.1 Share icon (photo header, top-right)
- Overlay header: 40×40 circle, bg `rgba(255,255,255,.94)`, shadow `0 2px 10px rgba(0,0,0,.25)`, 18px share glyph (arrow up out of a tray), stroke `#0d1117` 2.4.
- White-bar header: 38×38 circle, 1.5px `#dcdfe6` border, sits after Edit.
- Tap → opens the existing share/invite sheet on the **Share** channel.

### 3.2 You're helping sliver (only if the viewer is signed up for ≥1 sign-up)
Attached directly under the photo, full width, **rounded bottom corners 24px**, shadow `0 1px 3px rgba(15,18,25,.08)`. Same pattern as the Your Schedule tiles. **Collapsed by default.** Screenshots `28` (closed) and `29` (open).
- **Bar** (always shown, bottom of the sliver): min-height 48, padding `0 18px`, bg `#fefaef`, color `#8f6405`, 15.5px/800. Left: 18px clipboard-check icon + **"You're helping"**. Right: 14.5px/800 **"N task(s)"** + 14px chevron. When open, the count text disappears and the chevron rotates 180°.
- **Rows** (shown above the bar when open, one per task): white, min-height 52, padding `10px 18px`, 1px `#f2f3f6` rule between rows. 7px amber dot `#e8a71c`, task name 16px/700 `#2a2f38` (ellipsis), time on the right 14.5px/800 `#8f6405`. For shift jobs, the time shows the shift(s) you're in, comma-joined.
- Open state is per event (`jobsOpenMap[eventId]`).

### 3.3 RSVP (non-leads), option 45c + 48b
White card, padding 16. A 3-column grid, 8px gap. **No checkmarks.**
- Each button: min-height 60, radius 14, column layout: label 17px/800, count below 13px/700.
  - **Not picked:** bg `#fff`, inset 1.5px `#dcdfe6`, label `#0d1117`, count `#6b7280`.
  - **Picked:** solid fill, no outline, label `#fff`, count `rgba(255,255,255,.85)`. Going `#149a4b` · Maybe `#e8a71c` · Can't `#6b7280`.
- Labels: **Going / Maybe / Can't**. Counts: going = interested count (+ you), maybe = `inv.maybe` (+ you), can't = `inv.no` (+ you).
- Tapping the picked option again clears it. **No "Will you be there?" follow-up anywhere.** This replaces the old "Coming?" pills and the one-line "You're going · Change" bar.

### 3.4 Date & time card, option 47f
White card, padding `14px 16px`, flex row, gap 14.
- Line 1: full date, e.g. **"Thursday, Nov 12"** (weekday expanded), 21px/900, lh 1.2, ls -.4px, `#0d1117`.
- Line 2: time, e.g. **"6pm"**, same size, color `#0f7a3c`, 2px top margin.
- Right: 44×44 round button, bg `#f3f1fe`, **calendar-plus icon** (calendar outline with a "+" at the bottom-right), 20px, stroke `#5b4ae8`. Tap → add to calendar. aria-label "Add to calendar".
- No date → "Date TBD" / "TBD".

### 3.5 Where card, option 44c
White card, overflow hidden. Top row, padding `12px 16px`: place name 15.5px/800 plus address 13px/500 `#6b7280` (ellipsis). A **Directions** pill on the right (min-height 36, padding `0 14px`, bg `#0d1117`, white 13px/800) opens Google Maps directions. Below it, the map, full width, 150px tall.

### 3.6 Help out (sign-ups), options 41a + 51c + 50g→removed
Screenshot `31-event-help-out.png`.
- **Title:** "Help out", **24px/900**, lh 1.1, ls -.6px, `#0d1117`, padding `0 4px`, on the gray. (Anchor id `sec-tasks`.) No "N spots open" meta. No help-summary line.
- **Each job is its own white card** (8px gap between cards): padding `14px 16px`, radius 18, column, gap 8.
  - Top row: left column + button on the right (flex-start).
    - Name: 15.5px/800 `#0d1117`.
    - **Meta line** (5px below the name, wraps, gap `6px 10px`): clock icon + time (13px/700 `#454b55`), then the **spot counter**. The counter is one **14×5px** dash per spot, 3px gap, radius 999, filled `#149a4b` (or purple for shift rows), empty `#e3e5ea`, then "2 of 3" (13px/800; `#0f7a3c` if you're in, else `#6b7280`). No time → the counter sits alone on the meta line. Many spots → it wraps to the next line.
  - Description (`desc`): 14px/500 `#5c6270`. Long descriptions clamp to 2 lines with an inline **"More ⌄"** / "Less ⌃" (13px/800 `#5b4ae8`).
  - **Button** (min-height 36, padding `0 14px`, pill, 13.5px/800):
    - **Sign up**: transparent, inset 1.5px `#5b4ae8`, text `#5b4ae8`.
    - **✓ You're in**: bg `#fdf1d6`, text `#8f6405`, no outline. Tap → take yourself off.
    - **Full**: same shape as Sign up, inset 1.5px `#d5d8df`, text `#9aa0ac`, not tappable.
- **"+ Add something else"** card (non-leads; leads see **"Add a job or item"**): min-height 52, padding `0 16px`, radius 18, 1.5px **dashed `#e3c979`**, bg `#fef7dd`, 14px/800 `#8f6405`, 16px plus icon. Tap → it becomes a white card with an input + Add button (leads also get a "How many" box). After adding, it collapses back to the link.
- Empty state (no sign-ups): white card with the "Need people to bring things?…" copy.

### 3.7 Pick a shift sheet (jobs with `shifts`)
Screenshot `32-pick-a-shift.png`. Tapping Sign up on a shift job opens a bottom sheet. Kicker "PICK A SHIFT", job title, description, the day line, then one selectable row per shift: a checkbox circle, time, "n of need" / "Full", and a segmented bar. You can pick more than one. Below the rows: an **"Add a note, if you want"** input (saved on your entry in each shift you're in). Then **Done**.

### 3.8 "You're on it" banner (option 43c)
Screenshot `33-youre-on-it-banner.png`. Shown after **any new sign-up**: tapping Sign up on a job, adding something else (non-lead), claiming from "Could use a hand", or tapping Done in Pick a shift if you added shifts. **No confirmation step before signing up.**
- Position: absolute, left/right 14, bottom 85 (above the tab bar), z-index 40. Pop-in 260ms `cubic-bezier(.22,.9,.28,1)`.
- bg `#0f7a3c`, radius 18, padding 14, shadow `0 10px 28px rgba(15,122,60,.35)`. 44px white circle with a green `#149a4b` check. **"You're on it"** 17px/900 white. Below: an 18px host face + **"{Host} is counting on you"** 12.5px/800 (your own event: "Added to your jobs"). Right: **Undo** pill (min-height 36, bg `rgba(255,255,255,.18)`, white 13.5px/800).
- Auto-dismiss after **4s**. **Undo** immediately removes what you just claimed (for shifts, every shift you're in on that job) and toasts "Okay, you're off it". The banner replaces any open toast.

### 3.9 "You're off it" banner
Screenshot `34-youre-off-it-banner.png`. Shown when you take yourself off later (not via Undo): tapping "✓ You're in", or unticking a shift then Done. **Not shown on your own events** (small "Removed you from…" toast instead).
- Same position. bg `#fff6dc`, radius 18, padding 14, shadow `0 10px 28px rgba(15,18,25,.18)` + inset 1.5px `#f3d98b`.
- **"You're off it"** 17px/900 `#0d1117`. Body 14px/600 `#5c4a12`: *"We'll let {Host} know. A quick check-in with them helps too, or find someone to take your spot."* A 32px dismiss ✕ in the top-right.
- **Find a replacement**: full-width, min-height 44, bg `#0d1117`, white 14.5px/800. It opens the share sheet prefilled: *"Hey! I can't make it to {job} for {event} anymore. Any chance you could take my spot?"*
- Auto-dismiss after **7s**. (The host notification is copy only in the prototype; wire it to real messaging.)

---

## 4. Removed / changed behavior (summary)
- The sign-up **confirmation slide-up** was built, then removed. Signing up is one tap, followed by the §3.8 banner.
- The inline per-row "Add a note" field is removed (the note now lives only in Pick a shift).
- **"Will you be there?"** RSVP prompt after signing up: removed everywhere.
- The event's `helpLine` summary is not displayed.
- **About the event** is not displayed on Plan pages (idea pages still show bits).
- **Chip in** card is removed.

## 5. Tokens used in this update
- Purple `#5b4ae8` · lilac bg `#f3f1fe`
- Green `#149a4b` · dark green `#0f7a3c`
- Amber `#e8a71c` · amber ink `#8f6405` · cream `#fefaef` · light yellow `#fef7dd` / `#fdf1d6` / `#fff6dc` · gold border `#f3d98b` / `#e3c979`
- Ink `#0d1117` · body `#454b55` / `#5c6270` · muted `#6b7280` / `#9aa0ac` · lines `#dcdfe6` / `#e3e5ea` / `#f2f3f6` · page `#e8eaee`

## Still open
- Event preview slide-up (Round 13) is still undecided.
- Post form: fields for help summary, job descriptions, times, and shifts.
- "Making sign-up feel like a commitment" (Round 42: hold / slide / etc.) was explored but not adopted beyond the banner.
- Help out color: Round 49/50 explored bolder treatments; only the yellow "Add something else" and "You're in" were adopted.
- Other people's profile pages.
