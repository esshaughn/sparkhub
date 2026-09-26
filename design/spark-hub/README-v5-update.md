# Handoff: Spark Hub v5 update — Your plans, Your events & ideas, all-groups Calendar, group page redesign

## Overview
Spark Hub is a mobile app where neighborhood/fitness groups float ideas and turn them into plans. This update reorganizes navigation around three questions — *what am I doing* (Your plans), *what am I running* (Your events & ideas), *what's happening* (Calendar) — and brings the group page into the same photo-forward visual system.

This bundle builds on the earlier `design_handoff_spark_hub_v5/`. Everything below is **new or changed** since that handoff.

## About the Design Files
Files here are **design references built in HTML** — a working prototype showing intended look and behavior, not production code. Recreate these designs in the target codebase's environment (React Native, SwiftUI, React, etc.) using its established patterns. If no environment exists yet, pick the most appropriate framework for a mobile app.

Open `prototype/Spark Hub App Version 5.dc.html` in a browser (keep `support.js` and `photos/` next to it). Everything is clickable.

## Fidelity
**High-fidelity.** Final colors, type, spacing, and interactions. Recreate pixel-accurately. Sample data is placeholder.

---

## Navigation (bottom tab bar) — CHANGED
5 equal tabs, 73px tall, `rgba(255,255,255,.94)` + 12px backdrop blur, 1px top border `#e8eaef`. Icons 23px, stroke 1.9.

| # | Tab | Icon | Screen |
|---|-----|------|--------|
| 1 | Your plans | ticket with check | Home / "Your plans" |
| 2 | Your events & ideas | flag | Workspace for things you lead |
| 3 | **Calendar** (center) | calendar | Everything in all your groups |
| 4 | Groups | two people | Group list → group page |
| 5 | Notifications | bell + red count badge | unchanged |

The old separate "You own" tab is gone (merged into tab 2).

---

## Screen 1 — Your plans (tab 1)
Screenshots: `01-your-plans-tiles.png`, `02-your-plans-list.png`, `03-your-plans-grid.png`, `10-leading-tile.png`

**Purpose:** Everything you're leading, going to, or helping with.

**Layout:** page bg `#e8eaee`. White header (logo, "All groups" filter, avatar). Below, 14px side padding:
- Title row: "Your plans" 28px/900, letter-spacing −0.8px, `#0d1117`. No count. Right: view switcher.
- Sections by month: label 12px/800, uppercase, letter-spacing 1.2px, `#6b7280`. Plans with no date go last ("No date yet").

**View switcher:** white pill, 3px padding, shadow `0 1px 3px rgba(15,18,25,.08)`. Segments 38×32, radius 999. Active: bg `#0d1117`, icon `#fff`. Inactive: icon `#6b7280`. **Order: Tiles, List, Grid. Default: Tiles.**

### Tiles view (default)
Cards stacked with 14px gap. Card: white, radius 20, same shadow, overflow hidden.
- **Photo** 160px tall, cover. Bottom gradient `linear-gradient(to top, rgba(13,17,23,.92) 0%, rgba(13,17,23,.4) 45%, transparent 75%)`.
  - Bottom-left, inset 14px: date line (10.5px/900, uppercase, letter-spacing .7px; `#cfc9ff` if leading, `#9eecbc` otherwise), e.g. "SAT, OCT 10 · 12PM". Title 20px/900, −0.4px, white. Place row 12.5px/700, `rgba(255,255,255,.88)` with 11px pin icon.
  - **Leading chip**, top-right 12px: solid `#5b4ae8`, white 11.5px/900, height 24, flag icon, shadow `0 1px 4px rgba(0,0,0,.3)`.
- **Body** (only if helping or leading), padding 12/14/14:
  - **Helping** — label "YOU’RE HELPING:" 10.5px/900, letter-spacing .9px, `#8f6405`. Rows 14px/700 `#3d2a00`, 6px gold dot `#e8a71c`. If the task has a time: right-aligned chip, bg `#fdf1d6`, `#8f6405` 12px/800, padding 2×8. **More than 2 tasks:** show 2, then "+N more ⌄" (13px/800 `#8f6405`); tap expands to "Show less ⌃". Doesn't open the event.
  - **Leading — organizer dashboard** (see `10-leading-tile.png`): row with 3 rings + an Actions tile.
    - Rings (3-col grid): 40px SVG ring, r=22 in 52 viewBox, stroke 5, track `#eceef2`, rounded cap. Color: full = `#149a4b`, partial = `#e8a71c`, empty = track only. 14px icon centered (`#3b4150`). Value 13px/900 `#0d1117`; label 10.5px/700 `#6b7280`.
      - **Invited** — `inv.sent`, ring full if > 0. Envelope icon.
      - **Going** — interested count; ring = going ÷ invited. People icon.
      - **Sign-ups** — filled ÷ needed slots ("3/5"), "—" if none. Checklist icon.
    - **Actions tile** 92px wide, radius 14, padding 10:
      - Has actions: bg `#eeebff`; lightning-bolt icon `#5b4ae8` + count badge (20px circle, `#5b4ae8`, white 11.5px/900); "Actions" 12.5px/900 `#2a1f8f`; "Review ›" 11px/800 `#5b4ae8`.
      - None: bg `#e7f6ec`; check `#0f7a3c`; "All set" 12.5px/900 `#0f7a3c`; "No actions" 11px/700 `#3f7a55`.
      - Action count = pending items for the lead (suggestions, unanswered invites, open sign-ups, etc.).
- Going-only plans: photo only, no body.

### List view
- Sections by month, then **one white bubble per day** (radius 18). Day label above each bubble on the gray bg: 13px/800 `#454b55`, e.g. "Sat, Nov 21". 14px gap between days; 6px between label and bubble.
- Row: padding 12×14, 1px `#f2f3f6` divider between same-day rows.
  - **Thumb 96×96**, radius 14, cover. Bottom gradient, then date (10.5px/900 uppercase white) and time below it (12.5px/800).
  - Text column: "Leading" pill if leading (bg `#eeebff`, `#4a3ad4`, 10.5px/800, h20, flag icon). Title 15.5px/800. Place 12.5px/600 `#6b7280`.
  - Helping block ("YOU’RE HELPING:", same as tiles, with +N more).
  - Leading: the same ring + Actions dashboard, full width under the row.

### Grid view
2 columns, 10px gap. Square photo cards (radius 18) with the same date/title/place overlay (title 15px/900, 2-line clamp). **No white footer.** Top-right chips (h22, 10.5px/800, radius 999):
- **Helping** — bg `rgba(13,17,23,.5)` + 6px backdrop blur, text `#ffd978`, hand icon.
- **Leading** (· N to do) — solid `#5b4ae8`, white, flag icon.

---

## Screen 2 — Your events & ideas (tab 2)
Screenshot: `04-your-events-and-ideas.png`

- Header: "Your events & ideas" 36px/900. Subline: "N events · N ideas · N need you". Buttons: "Post an event" (purple) + "Float an idea" (outline).
- Group filter chips.
- Sections in order: **Events you’re leading** (by date) → **Your ideas** → **Past events**. Past events show their date, not "Idea".
- Card: white, radius 18, padding 14. Meta line, title 17.5px/900, sub, 64px thumb. Action strip (bg `#f3f1fe`, `#4a3ad4`) with CTA, e.g. "4 haven’t replied · Nudge".
- **"ROUGH DRAFT" stamp (temporary):** absolute, top 150, right 22, rotate −8°. Bg `#f5b428`, 4px border `#3d2a00`, radius 12, padding 10×20, 22px/900 uppercase, letter-spacing 1.6px, shadow `0 4px 12px rgba(61,42,0,.3)`. `pointer-events:none`. Remove before launch.

## Screen 3 — Calendar (tab 3, center)
Screenshot: `05-calendar-all-groups.png`

- Now shows **every event in all your groups**, not just yours. Excludes drafts and past events you weren't part of.
- Role pills per row: Leading (`#f3f1fe`/`#4a3ad4`), Going (`#e7f6ec`/`#0f7a3c`), Maybe (`#fdf1d6`/`#8f6405`), **Open to join** (new; `#f2f3f6`/`#454b55`), Happened.
- The "Going" filter count only counts events you're actually in.
- Has the same ROUGH DRAFT stamp.

---

## Screen 4 — Group page (redesigned)
Screenshots: `06-group-page-tiles.png`, `07-group-page-list.png`, `08-group-page-grid.png`, `09-group-page-ideas.png`

**Header (210px, overflow hidden):**
- Cover photo with per-group focal point + zoom (`photoPos: {x, y, z}` → background-position + `transform: scale(z)`).
- Overlay: `linear-gradient(to bottom, rgba(13,17,23,.7) 0%, rgba(13,17,23,.4) 32%, rgba(13,17,23,.5) 55%, rgba(13,17,23,.95) 100%)`.
- Top-left: Spark Hub logo (white). Top-right (admins only): **Edit** pill, bg `rgba(255,255,255,.18)`, h40, pencil + "Edit" 13px/800.
- Bottom-left: member count "48 MEMBERS" (12px/800 uppercase, `rgba(255,255,255,.75)`) above the **group name** (30px/900, −0.8px, white, text-wrap balance).
- Bottom-right: "I have an idea" button, `#5b4ae8`, h44, radius 999, shadow `0 6px 18px rgba(91,74,232,.45)`.
- The old "Groups" pill and the repeated section title were removed.

**Tabs:** Ideas / Plans / Happened segmented pill (unchanged).

**Toolbar row:** left side is a count ("8 upcoming plans" / "N past events", 14px/700 `#6b7280`) on Plans and Happened, or the **sort dropdown only on Ideas**. Right side is the Tiles/List/Grid switcher (same as Your plans). Default Tiles.

**Content:** same three views and styling as Your plans, but photo-only (no helping/dashboard body):
- Grouped by month. Plans sorted soonest first; Happened newest first; Ideas follow the sort menu.
- Tiles photo 180px tall.
- Date line color by tab: Ideas `#f3c55a`, Plans `#9eecbc`, Happened `#cfc9ff`.
- **Role chip** top-right of the photo (only if you're involved): Leading `#5b4ae8`/white + flag; Helping `#f5b428`/`#3d2a00`; Going `#149a4b`/white; Maybe white/`#0d1117`. On the Happened tab, labels are past tense: Led / Helped / Went.
- Happened tab: photos at `saturate(.6)`.
- List view: day-label bubbles and a 96px thumb with date overlay; the role appears as a tinted pill above the title.

---

## State
- `homeView`: `'tiles' | 'list' | 'grid'` (default `'tiles'`)
- `gView` (group page view): same values, default `'tiles'`
- `taskOpen[eventId]`: boolean, expands the helping list
- `phaseTab`: `'idea' | 'plan' | 'done'`
- Group model gets `photo`, optional `photoPos {x,y,z}`, and `members`
- Signup row gets optional `time` (e.g. "8:30am")
- Event gets `pending[]` (suggestions), `inv {sent, maybe, no}`, `signup[] {item, need, time?, people[]}`

## Design tokens
- Ink `#0d1117` · body `#454b55` · muted `#6b7280` · faint `#9aa0ac` · divider `#f2f3f6` · page `#e8eaee`
- Purple (lead) `#5b4ae8` / `#4a3ad4` / tint `#eeebff` · Green (going/done) `#149a4b` / `#0f7a3c` / `#e7f6ec`
- Gold (helping) `#e8a71c` / `#f5b428` / `#8f6405` / `#3d2a00` / tint `#fdf1d6` · Red (alerts) `#e2556b`
- Radii: 12 / 14 / 18 / 20 / 999 · Card shadow `0 1px 3px rgba(15,18,25,.08)`
- Type: **Figtree** 500–900. Scale 10.5 / 11.5 / 12.5 / 13.5 / 15.5 / 20 / 28 / 30 / 36.

## Assets
`prototype/photos/`: user-supplied event and group photos. New this round: `activate.jpg`, `weekend-wake-up.jpg`, `mueller-walk.png`, `pickleball.png`, `pumpkin-nights.png`, `torrez-group.jpg` (Torrez Fitness cover), `walnut-creek-parade.jpg` (Walnut Creek cover). `get-togethers-2.jpg` is the Hub on Hunters cover. Icons are inline SVG line icons (2–2.6 stroke) — use your icon set's equivalents.

## Copy changes
- "Hub on Hunters Lane" → **"Hub on Hunters"** everywhere
- "Laser tag night" → **"Pickleball"** @ Austin Pickleball Park
- "Porch painting for Mrs. Ruiz" → **"Paint a Hub mural!!!"**
- New event: **Pumpkin Nights** @ Pioneer Farms (Torrez Fitness)
- Sample November events were added for demo purposes

## Files
- `prototype/Spark Hub App Version 5.dc.html` — full working prototype
- `exploration/Suggestions Options.dc.html` — Actions-tile explorations (1b was chosen)
- `screenshots/` — 10 reference captures listed above
