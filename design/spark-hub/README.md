# Handoff: Spark Hub V5 — Home command center, groups, hosting tools

## Overview
Spark Hub is a mobile app for neighborhood / club groups to turn ideas into real get-togethers. V5 does two big things:

1. **Replaces the separate invite app** — RSVPs, guest lists, mass invites, update blasts, day-before reminders, and open-field sign-ups all live on the event (“plan”) page.
2. **Rebuilds Home as a personal command center** across all your groups: what you're **Leading**, **Going** to, and **Helping** with — each event card acting as a tiny status dashboard.

It also adds a **Groups** tab (pinned + grid layout), a **Calendar** tab, a **Notifications** tab, and a **“You own”** page.

## About the design files
Everything in `prototype/` is a **design reference built in HTML** — a working prototype that shows intended look, copy and behavior. It is **not production code**. Recreate these screens in the target codebase's environment (React Native, SwiftUI, React, etc.) using its own components and patterns. If there's no codebase yet, pick the framework that fits a mobile-first app (React Native / Expo is a reasonable default).

To run the prototype: open `prototype/Spark Hub App Version 5.dc.html` in a browser (keep `support.js` and `photos/` beside it). Its **Tweaks** (props) include `demoData` (loads sample content — also via `#demo` in the URL) and `startSignedIn`. Set both to `true` to see everything below.

`exploration/Home Dashboard Wireframes.dc.html` holds every layout option explored (Turns 1–12, newest at top) with notes on why each was chosen or rejected. Its images point at `photos/`; copy `prototype/photos` next to it to view it standalone.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii and copy are final. Recreate pixel-accurately with the codebase's libraries. Frame: **393 × 852** (iPhone 15/16).

---

## Global shell

**App frame:** 393 × 852, content scrolls under a fixed bottom toolbar.

**Bottom toolbar** (73px tall, `rgba(255,255,255,.94)` + 12px backdrop blur, 1px top border `#e8eaef`), 5 equal icon-only slots, 23px line icons (stroke 1.9). Active = `#5b4ae8`, inactive = `#5c6270`:
1. Home (house)
2. Calendar
3. You own (flag) — `aria-label="You own"`
4. Groups (two people)
5. Notifications (bell) with unread badge: 18px red pill `#e2556b`, 2px white border, 10.5px/900 white count, offset top −6 / right −9.

No center “+” create button (removed). Toolbar is **hidden on the signed-out Welcome screen**.

**Standard page header** (Home, Calendar, Groups, You own): white band, logo left, profile avatar right.
- Logo: bolt 24px (fill/stroke `#e8a71c`) + “Spark Hub” 18px/900, letter-spacing −.5px, `#0d1117`. Tapping goes Home.
- Avatar: 40px circle, user photo cover; fallback `#e8a71c` with white initial 16px/900. Taps to Profile. Ring `0 0 0 2px #fff, 0 0 0 4px #5b4ae8` when on Profile.

**Visual style (“gray + bubbles”)** — used everywhere: page background `#e8eaee`, white header band, content in **white rounded cards with a soft shadow** `0 1px 3px rgba(15,18,25,.08)` and **no outline borders**. Radii 16–22px.

---

## Screens

### 1. Welcome (signed out)
Screenshot: none (see prototype with `startSignedIn=false`).
- Background `#0d1117`, full 852px, flex column, no toolbar.
- Photo block 610px tall: `photos/welcome-picnic.png` at top −30px, height 540px, cover, position 40% 50%. Gradient overlay height 520px: `linear-gradient(to bottom, rgba(13,17,23,.4) 0%, rgba(13,17,23,.18) 25%, rgba(13,17,23,.62) 48%, rgba(13,17,23,.92) 70%, #0d1117 100%)` (must fully cover the photo — no hard edge).
- Bottom-left of photo block (left/right 20px, bottom 6px): logo (bolt `#f3c55a`, white wordmark) with 16px margin below, then H1 “Turn your idea / **into a plan.**” 42px/900, line-height .98, letter-spacing −1.4px, white; second line `#9d93f7`. Then three steps (18px top margin, 12px gap): 28px numbered circles `#e8a71c` / `#5b4ae8` / `#0f7a3c` + 16.5px/800 white “Post an idea”, “People pitch in”, “It happens”.
- Auth block pinned to bottom (`margin-top:auto`, padding 24 16 34): “Continue with Google” (white pill 54px, Google G), “Continue with email” (transparent, 1.5px `rgba(255,255,255,.3)` border), caption “New here? Either one creates your account.” 13.5px/600 `#8a909b`.

### 2. Home — `screenshots/home.png`, `home-scrolled-bottom.png`
Background `#e8eaee`. Header: white band, padding 14 18 14, logo left; right side = **“All groups ▾”** scope dropdown (14px/800 `#454b55`) + avatar.
- Scope dropdown: 230px white popover, radius 16, shadow `0 12px 32px rgba(15,18,25,.18), 0 0 0 1px #e6e7eb`, options “All groups” + each group (42px rows; selected = 900 weight `#5b4ae8`). Selecting a group filters **every Home row** to that group.

Body: padding 20 0 24, sections stacked with 24px gap. Each section = heading row + content, 7px apart.

**Section heading row** (padding 0 18px, `align-items: baseline`, gap 8): title **28px/900, line-height 1.05, letter-spacing −.8px, `#0d1117`**; count 15px/700 `#9aa0ac` (baseline-aligned with the title — don't vertically center it); “View all” pushed right, 13.5px/800 `#5b4ae8`.

Section order and titles (exact copy): **Leading**, **Going**, **Helping**. (“Your Groups” row and “Float an idea” card exist but are **hidden for now** — see Toggles.)

Horizontal rows: `overflow-x:auto`, padding 0 18px 4px, gap 10, scroll-snap x mandatory, snap-align start, scrollbar hidden. Items bleed off the right edge.

#### 2a. Leading row (events + ideas you lead)
Card: 284px wide, radius 20, white, soft shadow, `overflow:hidden`, flex column.
- **Photo area 132px**, event photo cover (fallback: group photo, then `photos/torrez-trail.png`). Gradient `linear-gradient(to top, rgba(13,17,23,.9) 0%, rgba(13,17,23,.3) 55%, rgba(13,17,23,.1) 100%)`.
  - Top-left, **plan**: date badge 44px wide, radius 10, white, shadow `0 4px 12px rgba(0,0,0,.25)`; month bar `#149a4b` 9px/900 white letter-spacing .8px; day 17px/900.
  - Top-left, **idea**: pill “IDEA” `#f3c55a` bg, `#0d1117`, 10.5px/900, letter-spacing .7px.
  - Top-right, **plans only** (no chip on ideas): countdown pill 11.5px/900, padding 4 10. Copy: “Today · 6pm”, “Tomorrow”, “in N days”, “Yesterday”, “N days ago”. Style: white bg + dark text when Today/Tomorrow; otherwise `rgba(13,17,23,.55)` + white.
  - Bottom (left/right 14, bottom 11): group name 10px/900 uppercase letter-spacing .9px `#cfc9ff`; title 18px/900 white, single line ellipsis.
- **Tracker row** (padding 12 14): 4 steps, `justify-content: space-between`, no connecting line. **Ideas and plans use identical geometry** so icons line up card-to-card:
  - Step column 52px wide, gap 5, centered.
  - 36×36 ring: SVG circle r=16, stroke 3, track `#eef0f3`, progress arc (round caps, starts at 12 o'clock). When a step is complete, use a solid green disc filling the full 36px (`#149a4b`) — no ring gap / sliver.
  - Inner 28px circle holds a 16px icon (stroke 2.1): incomplete = transparent bg + `#454b55` icon, arc `#e8a71c` at partial fill; complete = full green disc with white icon (plan) or white check (idea).
  - Label under ring: 11.5px/800. Complete `#0f7a3c`, incomplete `#454b55`, not applicable `#9aa0ac`.
  - **Idea steps** (labels shown): Date (calendar), Location (pin), People (two-person), Tasks (checklist). Progress:
    - Date: done if `day` or `lockedDateId`; else `min(.9, topDateVotes / interestedCount)`.
    - Location: done if `spot`; .5 if any spot suggested (`ideaLocs` or pending spot suggestion); else 0.
    - People: `interested / minPeople` if a minimum is set; done if `answers.people` exists; else 0. *(No UI to set minimum yet — see Open items.)*
    - Tasks: filled / needed across sign-up rows; done if rows exist with no counts; else 0.
  - **Plan steps** (values shown instead of labels): Invited (envelope), Going (people), Sign-ups (checklist), Reminder (bell). Values + state:
    - Invited: `inv.sent`; ok if > 0 else needs-you.
    - Going: RSVP-going count; ring = going / invited; needs-you while anyone hasn't replied.
    - Sign-ups: “filled/needed” e.g. `6/8`; ok when full; “—” gray (not applicable) if no sign-up list.
    - Reminder: day-before date (“Oct 30”) when auto-reminder on (default on, `autoRemind !== false`); “Off” = needs-you; “Sent” on/after the day.
  - Tracker shows on ideas, upcoming plans, and past plans you hosted.
- **Action strip** — *currently hidden* (`leadActionBar=false`). When on: purple `#f3f1fe` strip, action text 13.5px/800 `#4a3ad4`, CTA pill `#5b4ae8` white 12.5px/900 min-height 30, “+N” 12px/800 `#6b5fe0`; or green `#e7f6ec` “All set” with check when nothing's needed. Priority rules (first match shown, rest counted in +N):
  - Idea: someone suggested a spot/date → Review; date votes, none picked → “Oct 4 has 4 votes” · Pick date; no date → Add date; no location → Add spot; no minimum → “How many do you need?” · Set; no tasks → Add tasks; all set → Make it a plan.
  - Plan: today → “Today · post an update” · Post; tomorrow + auto-reminder off → Send; no invites → Invite; no location → “Location TBD” · Add it; no-replies & ≥2 days out → “N haven't replied” · Nudge; open sign-up spots → Share list.
  - Done (≤3 days ago): “Say thanks · add photos” · Thank.
- **Sort order of the Leading row**: Today → Tomorrow → plans with an action → ideas → just happened (≤3 days) → all set; ties by date.
- Row ends with a **“New event”** card: 140px, min-height 120, dashed 1.5px `#b9bdc6`, radius 20, `rgba(255,255,255,.5)` fill, “+” icon + 14px/800 `#454b55`. Opens the event form.
- “View all” → **You own** page.

#### 2b. Going row (events you RSVP'd Going or Maybe, not hosting)
Tile: 268 × 88px, radius 20, white, soft shadow, flex row, overflow hidden.
- Left photo 84px wide, full height, cover.
- Text (padding 0 14, gap 3, vertically centered): group 9.5px/900 uppercase letter-spacing .7px `#5b4ae8`; title **17.5px/800** `#0d1117` single-line ellipsis; date line 12.5px/600 `#6b7280` “Sat, Oct 3 · 8am”, plus “ · **Maybe**” in `#8f6405`/800 if Maybe.
- Empty state (no RSVPs): “Nothing yet. RSVP to an event in one of your groups and it shows up here.” 14.5px/600 `#6b7280`.
- “View all” → View all sheet, Going tab.

#### 2c. Helping list (sign-up items you've claimed on upcoming events)
Vertical list in one white card (margin 0 14px, radius 20, soft shadow). Rows: flex, gap 12, padding 10 14, 1px `#f2f3f6` divider between rows.
- Date badge 46px: radius 12, white, inset border `1.5px #e6e7eb`; month bar `#e8a71c` 10px/900 white; day 19px/900.
- Task 15px/800 `#0d1117` (e.g. “Bring waffle cones”); meta 12.5px/600 `#6b7280` “Walk and ice cream in Mueller · Sat 6pm”.
- Right chevron 16px `#9aa0ac`. Row tap opens the event.
- Section hidden entirely when you have no tasks. “View all” → View all sheet, Helping tab.

### 3. View all sheet — `screenshots/view-all-sheet.png`
Bottom sheet, 88% height, radius 24 top, slides up (`280ms cubic-bezier(.2,.8,.2,1)`), scrim `rgba(15,18,25,.45)`; tap scrim to close.
- Grabber 40×5 `#dcdfe6`.
- Segmented tabs (pill container `#f2f3f6`, 4px pad): **Going · N**, **You own · N**, **Helping · N**. Active = `#0d1117` bg, white text; 14px/800, 38px tall.
- Group chips row (scrolls): “All” + one per group that has items, “Torrez Fitness · 3”. Active chip = `#0d1117`/white; others white with inset 1.5px `#e6e7eb`. 36px, 13.5px/800. Opening from a Home scoped to a group preselects that group.
- List sections: “This week” (within 7 days), “Later in {Month}”, “No date yet” (last). Section label 14px/800 `#6b7280`.
- Rows: 44px photo thumb radius 10, title 15px/800, sub 12.5px/600 “Sat, Oct 3 · 8am · Torrez Fitness” (+ “Maybe”); Helping tab title = task, sub = event · date. Chevron. Tap closes sheet and opens event.
- Empty: “Nothing here for this group.”

### 4. You own page — `screenshots/you-own.png`
Toolbar tab 3. Gray page, white header with logo + avatar, H1 “You own” 36px/900, sub line e.g. “1 event · 1 idea · 1 need you”, buttons “Post an event” (purple `#5b4ae8`) + “Float an idea” (white outlined), 48px.
- Group chips (same as sheet).
- Sections: “This week”, “Later in {Month}”, “Ideas · no date yet”. White cards (radius 18) with date/idea line + group, title 17.5px/900, sub (going/interested), 64px photo thumb right, purple next-step strip (same rules as Leading).

### 5. Groups page — `screenshots/groups.png`
Header (white): logo + avatar row, H1 “Your groups” 36px/900 letter-spacing −1.2px, then two small pills (10px top margin, 6px gap), 30px tall, padding 0 10, 12.5px/800, 11px icon:
- **Join a group** — emphasized: `#ece9fd` bg, `#4a3ad4` text/icon.
- **Start a group** — quiet: `#f2f3f6` bg, `#454b55`.

Body (padding 16 14 26, gap 12):
- **Pinned groups**: each a large card (radius 22, white, soft shadow). Photo 170px with dark gradient; top-left OWNER (`#ece9fd`/`#4a3ad4`) or ADMIN (`#fdf1d6`/`#8f6405`) chip 10.5px/900; top-right: settings gear (36px, `rgba(255,255,255,.22)`, owners/admins only) + **pin button** (36px white circle, shadow, purple pin — filled when pinned). Name 26px/900 white, “48 members” 13px/700 `#dfe2e8`. Below photo, chips row (padding 12 16): “N new” (`#ece9fd`/`#4a3ad4`), counts “4 events · 1 idea” and your role “Leading 1 · Helping 2” (`#f2f3f6`/`#454b55`), 12px/800.
- Multiple groups can be pinned; pinned cards stack in pin order. If none pinned, the first group shows as the large card.
- **All other groups**: 2-column grid (gap 10) of **square** photo tiles (radius 20, soft shadow), gradient, role chip top-left, pin button top-right (32px). **Unpinned pin button**: `rgba(13,17,23,.35)` with inset 1.5px `rgba(255,255,255,.55)` ring, white outline pin, 85% opacity. Pinned: white circle + filled purple pin. Name bottom-left 16px/900 white with an optional 9px `#9d93f7` “new” dot before it.
- Tapping a card/tile opens that group's Browse page. Pin toggles with a toast (“Pinned” / “Unpinned”). Gear opens group settings.

### 6. Calendar — `screenshots/calendar.png`
Header with Month/List segmented toggle + avatar. Month grid across all groups; dots: green = on the books, amber ring = floated idea date, gray = happened. Selected day black tile. Below: day's events or “Nothing on this day.” + “Post an event” (prefills the date). List view groups upcoming by month.

### 7. Notifications — `screenshots/notifications.png`
Toolbar tab 5. Back button + settings (sliders) icon, H1 “Notifications”, “Mark all read”, filter chips All / Invites / Updates / Hosting. Sections NEW / EARLIER THIS WEEK. Rows: avatar with type badge, rich text, quoted update bubble, meta “12m ago · Group”, unread purple dot, inline RSVP buttons (“I'm going” green / “Maybe”) on invites. Settings sheet: topics + **push and email** channels only (no text/SMS).

### 8. Event (plan) page, idea page, compose — unchanged from earlier V5 (see prototype)
- **Plan page** (hosts): RSVP Going / Maybe / Can't make it; guest list card (invited · going · maybe · no reply); Invite sheet (Email, Link tabs — pick neighbors or whole group, paste emails, edit message); “Send an update” blast sheet (audience, templates, send now / day before / morning of); “Remind everyone the day before” toggle (default on); open-field **sign-ups** (free-text item + optional count, progress, notes, “something else”); Lead-only “Before the day” checklist.
- **Idea page**: date/location suggestions + votes, interest, “make it a plan”.
- **Compose**: default = plain event form (what, date, time, where, details, who can see it: group / invite only, photo). “Don't have it all figured out?” → collaborative idea flow (“Float an idea”).
- Guests RSVP from a shared link without an account.

---

## Interactions & behavior (new in this round)
- Home scope dropdown filters Leading / Going / Helping to one group; resets to “All groups”.
- “View all” on Leading → You own page (keeps scope as chip); on Going/Helping → sheet on that tab.
- All Home cards/rows open the event page.
- Leading countdown recalculates from today (midnight-based day diff).
- Groups pin state persists in app state (`pins: number[]`, order = pin order).
- Sheet open/close: 280ms slide-up, 240ms scrim fade. Popovers: 160ms pop-in (translateY 10px + scale .96 → 1).
- Toasts confirm pin/unpin and similar actions.

## State (prototype names)
- `screen`: 'home' | 'calendar' | 'own' | 'groups' | 'notifs' | 'profile' | 'browse' | 'detail' | 'compose' | …
- `homeGroup`: null | groupIndex (Home scope); `menu`: open popover id.
- `allTab`: null | 'going' | 'own' | 'help'; `allGrp`: null | groupIndex.
- `ownGrp`: null | groupIndex (You own page chip).
- `pins`: groupIndex[].
- Event (“spark”) record fields used: `id, text, day ("Sat, Oct 3 · 8am"), year, planned, leadName ('You' = you host), meIn, myRsvp ('going'|'maybe'), interested, inv {sent, maybe, no}, signup [{id,item,need,people:[{who,note}]}], autoRemind, spot, ideaDates [{md,votes}], ideaLocs, pending [{who,kind:'spot'|'day'}], minPeople, answers.people, photos, groups [groupId]`.
- Phase: idea (not planned) → plan (planned, date ≥ today) → done (date < today).
- Derived lists: Going = plans not hosted by you with RSVP going/maybe; Leading = your ideas + upcoming plans + your plans ≤3 days past; Helping = sign-up rows on upcoming plans where `people` includes you.

## Toggles currently OFF (kept in code, easy to restore)
- `homeGroups` — “Your Groups” photo-tile row on Home (tiles 200×104, name 16.5px, role chip, gear).
- `homeFloat` — “Float an idea” purple card at bottom of Home.
- `leadActionBar` — purple next-step strip on Leading cards.
- `sectionTitles: 'icon'` — optional 32px colored icon tile before each Home heading (purple flag / green check / gold list / gray people).

## Design tokens
**Colors**
- Ink `#0d1117`; body gray `#454b55`; secondary `#5c6270`; muted `#6b7280`; faint `#9aa0ac`; disabled `#b9bcc4`
- Page `#e8eaee`; surface `#fff`; subtle fill `#f2f3f6`; track `#eef0f3`; dividers `#f2f3f6`, `#e6e7eb`, `#dcdfe6`
- Purple (brand/action) `#5b4ae8`, hover `#4a3ad4`, tint `#f3f1fe` / `#ece9fd`, on-dark `#9d93f7`, eyebrow-on-photo `#cfc9ff`
- Green (going / on the books / done) `#149a4b`, dark `#0f7a3c`, tint `#e7f6ec`
- Gold (idea / helping / needs-you) `#e8a71c`, dark `#8f6405`, light `#f3c55a`, tint `#fdf1d6`
- Red (badge) `#e2556b`
**Type** — Figtree (400–900). Scale used: 42 / 36 / 28 / 26 / 22 / 19 / 18 / 17.5 / 16.5 / 15.5 / 15 / 14.5 / 13.5 / 13 / 12.5 / 11.5 / 10.5 / 10 / 9.5 / 9. Headings 900 with negative tracking (−.5 to −1.4px); eyebrows uppercase 900 with +.7 to +1.2px tracking.
**Radii** — pills 999; cards 18–22; tiles 16–20; badges 9–12.
**Shadows** — card `0 1px 3px rgba(15,18,25,.08)`; badge on photo `0 4px 12px rgba(0,0,0,.25)`; popover `0 12px 32px rgba(15,18,25,.18)`; primary button glow `0 10px 24px rgba(91,74,232,.28)`.
**Spacing** — page gutter 18px (rows) / 14px (cards); section gap 24; heading→content 7; card padding 12–16.

## Assets
`prototype/photos/`: group & event photography supplied by the client (`torrez-trail.png`, `torrez-crew.png`, `welcome-picnic.png`, `get-togethers.jpg`, `get-togethers-2.jpg`, `trail-cleanup.png`, `projects.jpg`, `mutual-aid.jpg`) and `faces/` avatars. Icons are simple inline line SVGs (24 viewBox, round caps) — swap for the codebase's icon set (Lucide equivalents: home, calendar, flag, users, bell, mail, list-checks, map-pin, pin, settings, check, chevron-right).

## Known issues / open items
- **People step** on idea tracker has no input yet — add “Minimum people” to the idea form.
- Action-strip CTAs (Nudge, Pick date, Send…) currently just open the event page; wire each to its sheet/action.
- “This week” in the View all sheet uses `< today + 7 days at midnight`, so an event exactly 7 days out at 8am lands in “Later” — use end-of-day.
- “N new” on group cards uses a per-group `fresh` counter; needs a real last-seen timestamp.
- No live calendar sync, payments, admin-delete wording, or “I want to host” quick-post yet.

## Screenshots (`screenshots/`)
`home.png`, `home-scrolled-bottom.png`, `view-all-sheet.png`, `you-own.png`, `groups.png`, `calendar.png`, `notifications.png` — captured from the prototype with demo data, 2× (393-wide frame).

## Files
- `prototype/Spark Hub App Version 5.dc.html` — the full working prototype (template + logic class). Home: `homeVals()`; Groups: `groupsVals()`; Calendar: `calVals()`; event page: `v5Vals()`; sample data: `DEMO` array.
- `prototype/support.js` — runtime for the prototype file format (not needed in production).
- `exploration/Home Dashboard Wireframes.dc.html` — all explored options, Turns 1–12.
