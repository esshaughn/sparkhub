# Handoff: Spark Hub v5.2: navigation, headers, views, event page

## Overview
Spark Hub is a mobile app where neighborhood and fitness groups float ideas and turn them into plans. This round settles the tab structure, gives every tab the same header, adds a single view picker, reworks "Your plans / Your ideas", and updates the event page's top controls.

It builds on `design_handoff_spark_hub_v5/` and `design_handoff_spark_hub_v5_update/`. Anything not mentioned here is unchanged from those.

## About the design files
The files in this bundle are **design references built in HTML**. They're a working prototype of the intended look and behavior, not production code. Recreate them in the target codebase (React Native, SwiftUI, etc.) using its own patterns and components. If there's no codebase yet, pick the framework that suits a mobile app.

Open `prototype/Spark Hub App Version 5.dc.html` in a browser, keeping `support.js` and `photos/` next to it. Everything is clickable. The design is 393×852 (iPhone 15).

## Fidelity
**High fidelity.** Colors, type, spacing and interactions are final. Sample data is placeholder.

---

## Global

### Bottom tab bar
Five equal tabs, 73px tall. Background `rgba(255,255,255,.94)` with 12px backdrop blur and a 1px top border `#e8eaef`. Icons are 23px line icons with 1.9 stroke. Inactive `#9aa0ac`, active `#0d1117`. **No special emphasis on any tab.**

| # | Tab | Icon | Screen |
|---|---|---|---|
| 1 | Your schedule | ticket with check | Home (default on launch) |
| 2 | Your plans & ideas | lightning spark (outline of the logo mark) | Workspace for things you lead |
| 3 | Calendar | calendar | Everything in all your groups |
| 4 | Notifications | bell + red count badge | |
| 5 | Groups | four rounded squares | Group list |

### Header pattern (all tabs)
- White header. Page title 36px/900, letter-spacing −1.2px, `#0d1117`.
- Top padding 40px, except "Your schedule", which also has the logo row.
- **Logo and profile photo appear only on "Your schedule"**: logo left, "All groups" filter and 40px avatar right, with the title below.
- Other tabs have no logo and no avatar. One contextual action can sit on the title row (e.g. the Notifications gear).
- Detail screens use a back button, never the logo.

### View picker (Your schedule + group pages)
- Replaces the old 3-segment pill.
- Trigger: the current view's 17px icon plus a 12px chevron, `#6b7280` (hover `#0d1117`), 40px tall, no background.
- Menu: white, radius 16, border `#eceef2`, shadow `0 18px 44px rgba(15,18,25,.2)`, min-width 160. Rows are 42px tall: icon, label, and a purple check `#5b4ae8` on the current view.
- Options: Tiles, List, Grid. Default: Tiles.
- **Placement:** right end of the **first month heading's** row.

### Month headings
22px/900, letter-spacing −.5px, `#0d1117`. Sentence case, e.g. "October". Sections: months in date order, then "Date TBD" / "No date yet" last.

---

## 1. Your schedule (tab 1)
Screenshots: `01-your-schedule-tiles`, `02-your-schedule-list`, `03-your-schedule-grid`

- Shows everything you're leading, going to, maybe-going to, or helping with.
- Gap under the header is 10px, then the month sections.
- **Tiles:** unchanged from the previous handoff: photo card, "YOU'RE HELPING:" list with time chips and "+N more", and for leads the rings plus an Actions box.
- **List:**
  - **Each event is its own white bubble** (radius 18, padding 12×14). Same-day events stack with 8px gaps under one day label, 13px/800 `#454b55`.
  - 96px square thumbnail with the date and time on it.
  - The text column uses `flex: 1 1 0; min-width: 0`, so long titles wrap next to the thumbnail instead of dropping below it.
  - "YOU'RE HELPING:" is 9.5px/900. Items are 12.5px/700 with a 5px gold dot. Time chips are 11px/800, `#fdf1d6` / `#8f6405`, right-aligned.
- **Grid:** unchanged.

## 2. Your plans / Your ideas (tab 2)
Screenshots: `04-your-plans`, `05-your-ideas`

- **The title is the switch.** "Your plans" and "Your ideas" sit side by side (30px/900, gap 16). The active one is `#0d1117`, the inactive one `#c3c7d0`; tap to switch.
- Row below the title: a group dropdown (white pill, 44px) on the left, and the contextual create button on the right.
  - Plans: **Post an event**, green `#149a4b`, white text.
  - Ideas: **Float an idea**, yellow `#f5b428`, text `#3d2a00`.
  - Both 44px tall, 15px/800.
- **Plans:** photo tiles as on Your schedule, without the "Leading" chip since everything here is yours. Below each photo: the Invited / Going / Sign-ups rings plus the Actions box. "Past events" follow, with desaturated photos.
- **Ideas:** photo tile, then the **four readiness steps** (Date, Location, People, Tasks). No Actions box.
  - Each step is a 36px ring (r=16, stroke 3, track `#eef0f3`) with a 16px icon.
  - The ring fills in yellow `#e8a71c` with progress. When complete, it becomes a solid green `#149a4b` circle with a white check, and the label turns `#0f7a3c`.
  - Progress rules:
    - **Date:** picked = 1, otherwise top date votes ÷ interested (capped at .9).
    - **Location:** set = 1, suggestions exist = .5.
    - **People:** interested ÷ minimum people.
    - **Tasks:** filled ÷ needed sign-up slots.
  - Steps are centered with 22px side padding.
- The temporary "Rough draft" stamp is removed from this page.

## 3. Calendar (tab 3)
Screenshot: `06-calendar`

- The logo/profile row is removed and the title sits at 40px top padding.
- The yellow **"ROUGH DRAFT"** stamp stays: temporary, pointer-events none, remove before launch.

## 4. Notifications (tab 4)
Screenshot: `07-notifications`

- No back button (it's a tab).
- Title row: "Notifications" plus a 40px round gear on the right (`#f2f3f6`) that opens settings.
- Filter chips on their own full-width row: All / Invites / Updates / Hosting.
- The first section header reads **"NEW · 6"**, with **Mark all read** (13.5px/800 `#5b4ae8`) at its right. Both go away once everything is read.
- Settings sheet: the channel row (Push/Email) is removed, leaving only the per-type toggles.

## 5. Groups (tab 5)
Screenshot: `08-groups`

- Title "Your groups" at 40px top padding.
- "Join a group" / "Start a group" pills are 36px tall, 13.5px/800, so this header matches the Notifications header height.
- Group tiles now respect each group's `photoPos` zoom (`z`), not just its focal point.

## 6. Group page
Screenshot: `09-group-page`

- Top-left **back** circle (replaces the logo). Top-right **Edit** pill for admins only.
- On Plans and Happened, the old count line ("8 upcoming plans") and sort row are gone. The view picker sits on the first month row.
- On Ideas, the sort dropdown keeps its own row.
- Month headings are 22px/900, as in Global above.

## 7. Event page (idea / plan / happened)
Screenshot: `10-event-page`

- The photo runs full-bleed to the top of the screen.
- **Back:** 40px white circle `rgba(255,255,255,.94)`, dark arrow `#0d1117` (2.6 stroke), shadow `0 2px 10px rgba(0,0,0,.25)`. No text label; its aria-label says where it goes.
- **Edit** (hosts): the same white pill treatment, with pencil + "Edit", 40px tall.
- The small group name that used to sit between them is removed.
- **Back returns to the screen you came from**: Your schedule, Your plans/ideas (same tab), Calendar, Notifications, Groups or the group page, including scroll position. If there's no history, it falls back to the group page.
  - Implementation: record `{screen, group, tab, scrollTop}` when entering the event page, and restore it on back. A native stack navigator gives you this for free.
- An alternate "white top bar" treatment exists as a prototype tweak (`detailBar: 'white' | 'overlay'`, default `overlay`). It's for reference only.

## 8. Profile
Screenshot: `11-profile`

- Reached from the avatar on Your schedule.
- Centered 96px avatar with a camera badge, name 28px/900, place line, short bio, "Edit profile" outline pill.
- A stats row (Hosted / Went to / Groups) sits under the header.
- Sections below: Settings (Notifications, Calendar sync, Email, Privacy), Help & info, Sign out, Privacy link.
- **Removed:** Your ideas, Your groups, and the "Into" interests.

---

## Design tokens
- **Ink:** `#0d1117` · body `#454b55` · muted `#6b7280` · faint `#9aa0ac` · inactive title `#c3c7d0` · divider `#f2f3f6` · page `#e8eaee`
- **Plans (green):** `#149a4b` / `#0f7a3c` / tint `#e7f6ec`
- **Ideas / helping (yellow):** `#f5b428` / `#e8a71c` / `#8f6405` / `#3d2a00` / tint `#fdf1d6`
- **Lead / Actions (purple):** `#5b4ae8` / `#4a3ad4` / tint `#eeebff`
- **Radii:** 10 / 14 / 16 / 18 / 20 / 999
- **Card shadow:** `0 1px 3px rgba(15,18,25,.08)`
- **Type:** Figtree 500–900

## State additions
- `homeView`, `gView`: `'tiles' | 'list' | 'grid'`, default `'tiles'`; `hvMenu` / `gvMenu` track whether each picker menu is open.
- `ownTab`: `'lead' | 'idea'` (Your plans / Your ideas), plus `ownGrp` and `ownDd` for the group dropdown.
- Back target: `{ screen, group, ptab, ownTab, scroll }`, captured when entering the event page.

## Assets
Everything is in `prototype/photos/`. New this round: `paintball.png` (Paintball event). The Torrez Fitness cover crop is `photoPos {x:50, y:72, z:1.35}`.

## Files
- `prototype/`: the full working prototype
- `screenshots/`: the 11 captures referenced above, 393px wide top-of-screen crops
