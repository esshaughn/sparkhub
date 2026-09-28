# Spark Hub v6 — Update 3 (read after README.md and UPDATE_2.md)

Same rule: **do not change any content or demo data.** Only add the layout/behavior below. Reference file refreshed. New screenshots `22–23`.

## Your tasks (22)
- Remove the profile avatar button from the top-left of the Your tasks header. Profile is reached only via the bottom-nav Profile tab.

## Post an event (23) — replaces the old WHAT/WHEN/TIME card form (step `event`)
- **No white header** on this step. Instead a 210px **photo header**:
  - Background = chosen cover photo; if none, gradient `135deg #5b4ae8 → #8a6ff0 55% → #e8a71c` with 3 small sparkles (✦ ✧). Dark bottom fade.
  - Top-left: 40px solid white **close** button (X). Top-right: frosted pill "Add a photo"/"Photo added" (violet icon + text) = file input for the cover.
  - Bottom-left: "NEW EVENT" (12px/900, #cfc9ff) and the **event name input typed directly on the photo** (30px/900 white, placeholder "What’s happening?").
- **The basics** card (white, radius 18): heading 18px/900, then rows (min-height 58px, divider `#f2f3f6`), each with a 36px radius-11 icon tile + small uppercase label + input:
  1. **Group** — group photo tile, group name, violet "Change" → dropdown of the user’s groups.
  2. **When / Time** — calendar tile; date + time inputs side by side.
  3. **Where** — pin tile; text input "Add a spot".
  4. **Details** — lines tile; 2-row textarea "What to bring, parking, the vibe…".
  - Tile is violet (`#f3f1fe`/`#5b4ae8`) when empty, green (`#e7f6ec`/`#149a4b`) when filled, with a 20px green check at the row end.
- **Invite only** row: gray lock tile, title + current note, 44×26 switch (violet when on).
- **“Not sure on the details?”** dashed row with amber sprout tile → switches to the idea flow (existing `startTogether`).
- **Sticky bottom CTA**: 56px full-width pill. Disabled = `#c9ccd3`, label "Give it a name"/"Pick a date". Ready = green `#149a4b` with confetti dots inside + shadow, label **“Post it! 🎉”**. Sub-line: "Your neighbors in {Group} will see it" (or "Only a name and date are required, the rest can come later").
- **ROUGH DRAFT stamp (temporary, keep for now):** tilted −14°, red `rgba(226,85,107,.85)` 4px border + text, 34px/900, centered ~430px from top of the page so it crosses The basics card; `pointer-events:none`.
- Helper roles / head count ("Make it happen") are **not** in scope yet.
