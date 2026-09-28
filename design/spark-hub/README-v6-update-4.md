# Spark Hub v6 — Update 4 (read after README.md, UPDATE_2.md, UPDATE_3.md)

Same rule: **do not change existing content**, except the demo data addition noted below. The files in this folder are HTML **design references**. Rebuild them in the app's own stack; don't ship the HTML. The reference file `Spark Hub App Version 6.dc.html` is refreshed. Mockups for the event page are in `Event Page Options.dc.html` (option 39a is the chosen one). Font: Figtree throughout. New screenshots: `24` Past scrapbook, `25` Ideas board with sort, `26–27` event page (top / lower).

## Demo data
- New past Torrez event `p3x` "Saturday pickleball round robin" · lead Darnell · Mueller Lake Park · Sat, Aug 29 · 8am · 18 interested · photos `pickleball.png` + mood `torrez-crew.png`, `torrez-group.jpg`, `mueller-walk.png` (4 pics → mosaic).

## Groups → Past scrapbook
- **Date sticker before each memory** (replaces the date that sat on the photo):
  - Row above each card: sticker + dashed rule (`flex:1; border-top:2.5px dashed #b9bdc6`), 10px gap. Card sits 10px below; 10px extra top margin per memory.
  - Sticker: 30px tall, padding 0 12px, radius 8, bg **`#1f2433`** (same ink as the "So far" card), white 13px/900, letter-spacing 1px, shadow `0 2px 6px rgba(13,17,23,.2)`. **Not rotated.** Text = `MMM D` uppercase (e.g. `AUG 29`).
- Card radius 16 (was 14). The photo overlay now shows only the title.
- **"N went!" badge** is still rotated 4°, but its gradient cycles by card index (`i % 5`):
  1. `135deg #ffb347 → #ff6f91`
  2. `135deg #7b6ef0 → #e05fc4`
  3. `135deg #1fb86a → #1f9ec8`
  4. `135deg #ff8a3d → #e2336b`
  5. `135deg #3d8bff → #8a5cf0`
- **Reaction chips** (❤️ 🙌 🎉) are no longer rotated.
- **"{GROUP} · SO FAR" stats card can be dismissed:** a quiet X in the top-right (36×36 tap target, 12px white icon, opacity .45, no background). Dismissal is per group (store the group id in `pastStatsHidden`). It's session-only in the prototype; persisting it per user is fine.

## Groups → Ideas board
- Step icons (date · where · tasks · roles · people) **no longer have tinted tiles**. Icon stroke is green `#149a4b` when done and amber `#b07a0a` when not. The icons are spread evenly (`flex:1` each, 22px tall), with a **1px `#dcdfe4` vertical divider** between neighbors.
- **Quiet sort row** above the grid, shown only when there are ideas: "Sort" (13px/600, `#8a909b`) followed by three text buttons: **Most interest** (default, by interested count, descending) · **Newest** (by post age, ascending) · **Almost there** (by number of steps done, descending). Inactive: 13px/600 `#8a909b`. Active: 800 `#0d1117`, underlined 2px with a 4px offset. 32px min height.

## Event page, Plan phase (option 39a)
Order of sections, top to bottom:
1. **Photo header** 340px (was 430px). Top-left: back button. Top-right: Edit (for those who can edit). The **date sticker moved out of the top-right corner**: it now sits bottom-right beside the title (70px wide, radius 14, green `#149a4b` month bar, 32px/900 day, weekday, rotated 4°). Chip text is now **"HAPPENING"** (was "✓ IT'S A PLAN · IN N DAYS"). The "time · spot · hosted by X" subline under the title is **removed**.
2. **RSVP, compact** (non-leads):
   - Answered → one-line bar (white, radius 14, padding 10px 12px 10px 14px): a 22px status dot (going `#149a4b` / maybe `#e8a71c` / no `#6b7280`) with a white check, the label "You're going" / "You're a maybe" / "You can't make it", and "Change ›" on the right. Tapping it reopens the choices.
   - Unanswered or changing → a compact card with "Coming?" plus three 40px pills (I'm going / Maybe / Can't make it), and "Bring a neighbor — share it" below.
3. Leads still see **Your guest list** here (unchanged).
4. **When & where** card (unchanged).
5. **You're helping with** (only when the user is signed up for at least one sign-up): bg `#fff6dc`, inset 1.5px `#f3d98b` border, radius 18. Header "YOU'RE HELPING WITH" (12px/800, `#8f6405`), and on the right "N jobs" with a chevron that collapses/expands the list. **Open by default**, and the collapsed state is saved per event. Each row is one line: an 8px amber dot `#e8a71c`, the job name (15.5px/800, ellipsis), and the time on the right if the sign-up has one (13px/700, `#8f6405`). Rows are divided by 1px `#f3e2ad`. **Dots, not checkboxes.** Sign-ups don't carry a `time` field yet, so add one.
6. Before the day, then Updates (unchanged).
7. **About the event** (replaces "Good to know"): white card, heading "ABOUT THE EVENT". The event's bits are a clean bulleted list: 6px black dot and 15.5px/600 text on each row, 10px vertical padding, 1px `#f0f1f4` rule under each row.
8. **Sign-ups** (unchanged design).
9. **Hosted by** card (hidden when you're the host): gradient `135deg #f1edff → #e0d8ff`, radius 18, padding 14px 16px, with small ✦ sparkles. 56px host face (3px white border and a 2.5px `#7b6ef0` ring) with sparkles around it. "HOSTED BY" (11px/900, `#6b5ce7`) above the name (20px/900, `#2a1f8f`). White "Say hi" pill (40px, `#4a3ad4`) that opens a message to the host.
10. **Who's going** (moved to the bottom), then Chip in and Inspo (unchanged).

## Still open
- Event preview slide-up (Round 13) is undecided.
- Post an event → "Make it happen" section.
- Other people's profile pages.
