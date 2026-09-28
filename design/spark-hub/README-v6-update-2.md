# Spark Hub v6 — Update 2 (read after README.md)

Same rules as README: **do not change any content or demo data.** Add only the layouts/behaviors below. Reference file `Spark Hub App Version 6.dc.html` (updated). New screenshots `15–21`.

## Nav & sheets
- Bottom nav: **Your tasks · Your schedule · Calendar (center) · Groups · Profile**. Groups tab highlights only on the Groups list (not inside a group).
- Calendar tab: 48px outline circle; idle ring `1.9px #c3c7d0`, icon `#6b7280`; active ring `2px #5b4ae8`, icon violet.
- Sheet z-order: Notification settings and Edit profile open **above** the Profile sheet (z≥45).

## Your schedule & group pages — shared controls (first month heading row)
- Right side: **Sort** pill · **Filter** pill · view dropdown (Tiles/List). Sort/Filter pills: transparent bg, `inset 0 0 0 1.5px #c3c7d0`, 13px/800 `#454b55`, 14px icon; Filter active = black pill "Filter · N".
- Sort: Soonest (month sections) / Most lively / Newest / Needs you (single section named after sort).
- Filter checklist "SHOW ONLY" with counts, Clear, "Show N events". Schedule: Leading, Helping, Going, Maybe, Needs helpers, This week. Group: Leading, Helping, Going, Not joined yet, Needs helpers, This week. AND logic. Empty → card "No events match these filters." + Clear filters.
- Group Tiles/List cards use the exact Your schedule card formats (see README); strips expand in place for Leading/Helping (shared `schedOpen` state).

## Calendar (15)
- 180px photo header: "COMMUNITY" · "Calendar" 40px · "All events from your N groups"; top-right frosted search + bell; **52px violet + FAB inside photo bottom-right** → Post an event.
- Filter row: Groups (people icon; "All groups"/"1 group"/"N groups"), Type (tag icon), "Clear filters" at right when active.
- "Feeling wild?" (fanned A♠ K♥ Q♣ event cards) and "N events could use a hand" line — both dismissible (X), shown even with filters.
- Search = slide-up sheet: field + gray Cancel; before typing: **Try** chips (This weekend, Outdoors, Kid-friendly, Needs helpers, Food & drink) and **"Or something unexpected"** 2-col cards (Deal me a wildcard, Something new to me, Soonest surprise, Tag along, Small & cozy, Get outside). No recent searches.
- Strips: not-joined → **"5 spots left"** (800) + " · 6 going" (600 gray) · "RSVP" black text; Helping → count only "1 ⌄"; Maybe → "Update RSVP". Sub-line = time · condensed street address.
- Month view added to view dropdown (dots per day, selected day list).

## Groups list (16)
- Calendar-style 180px photo header: "YOUR PEOPLE" · "Groups" 40px · "N groups"; frosted bell; white **"Join"** pill (person-plus icon) bottom-right of photo.
- **"+ Start a new group"** at the bottom of the list: 52px dotted `1.5px #9aa0aa` box, gray text.

## Group page (17–20)
- Header: 190px photo, solid **white back button** top-left, frosted search (this group only) + bell top-right, member count (violet caps) + group name 34px; quiet pencil after the name for admins/owners; 52px violet **+ icon** bottom-right → "I have an idea".
- **World switcher** under header: gray pill track, white sliding thumb, grid `1fr 1.4fr 1fr`: **Ideas N · Plans N · Past N** — no icons, no color (active `#0d1117`, count `#6b7280`; inactive `#6b7280`/`#9aa0aa`).
- **Ideas (18):** whole page background = graph paper (`#fbfaf6`, 18px `#eeeae0` grid). Two-column masonry of tilted white cards (second column offset 22px). Card: 112px single photo (idea photo → group photo), bottom-only fade, white title 14.5px/900 balanced, white upvote chip top-right (↑ N, amber ink), white › right-center; below: 4 tinted 28px tiles — Date · Location · Helpers/Roles · People (green `#e7f6ec`/`#149a4b` done, amber `#fdf1d6`/`#b07a0a` needed). No sort/filter/view on this tab.
- **Past (19):** gray page. Top dark recap tile with confetti: "{GROUP} · SO FAR" + 3 big numbers (40px): events · showed up · photos. Memory cards:
  - Photo 190px: single photo, or **mosaic** (1 tall + wide + 2 small, 3px gaps) when the event has ≥4 photos. Bottom fade, date + 24px title; sunset gradient chip "🎉 N went!" top-right (rotated 4°); **add-photo button** bottom-right: 34px circle `rgba(255,255,255,.8)` + blur, 22px violet photo icon with violet "+" badge.
  - **Made it happen** bar (violet gradient `#f1edff→#e0d8ff`, sparkles ✦✧): lead photo in violet ring with sparkles, "MADE IT HAPPEN" + "Name, with N helpers", "🙏 N ›" (opens event to see/send thank-yous; thank-yous are public).
  - Row: reaction chips ❤️ 🙌 🎉 (tap to add/remove yours; yours = lavender) · green **"Let's do it again!"** button with count badge (adds your vote once; toast).
  - Placeholder counts (reactions/thanks/again) are derived — replace with real data when available.
- **Group search (20):** slide-up sheet scoped to the group: Browse chips (Plans, Ideas, Past events, Needs helpers) + "Or something unexpected" (Wildcard, Next up here, They need you, Hidden gem, Throwback, Fresh off the press).

## Profile sheet (21)
- Compact header: 56px photo, name 20px, quiet gray pencil after the name (Edit profile), Close X aligned to photo center. No location/member-since/blurb/stats (keep those for viewing *other* people).
- **Help & info** first (22px heading, 2-col tiles; Notification settings is top-right tile), then Settings list, Sign out, Privacy.

## Misc
- Ideas checkpoints (Your tasks): third ring staged — no roles → "Roles"/"Add essential roles"; roles exist → "Helpers"/"Get helpers"/"Helpers on board".
- Anywhere Maybe → CTA "Update RSVP".
