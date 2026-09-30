# Spark Hub v6 — Update 9 (read after UPDATE_8.md)

These changes are folded into `Spark Hub App Version 6.dc.html`. The source designs are in `Event Page Options.dc.html`: **80a** (from Rounds 79–80). Round 78 (Friends) is exploration only and is not in the app.

Scope rules from README still apply: no content or data changes, UI and behavior only.

## 1. Group page · Plans tab — empty state + bottom CTA (80a)
Applies only to the **Plans** tab. Ideas board and Past keep their existing empty messages.

**Empty** (no plans in this group):
- Centered column, min-height 420px, gap 26px, padding 0 12px.
- **Calendar fan** at the top (decorative, `aria-hidden`), in a 200×150 box. It has three tear-off pages. Each page is white, radius 14, shadow `0 8px 22px rgba(15,18,25,.14)`:
  - Red header band `#e2556b` reading "SAT" in white, 900 weight, 1.5px tracking.
  - Body is a big "?" in `#0d1117`, 900 weight.
  - Back pages are 96px wide, rotated −12° (left) and +9° (right). The front page is 118px wide, rotated −2°.
  - Page proportions: header = 26% of width, body = 74% of width. Font sizes: "SAT" = 12% of width, "?" = 50% of width.
- "No plans yet": 22px/900, −.5px tracking.
- "Somebody should fix that.": 15px/500 `#5c6270`.
- **Create an event**: full-width, 52px, radius 999, `#5b4ae8`, white 16px/800, + icon, shadow `0 6px 16px rgba(91,74,232,.3)`. Hover `#4a3ad4`. Opens the post flow.

**With plans** — always the last item in the list, below every section:
- White card, radius 20, padding 16, gap 12, standard shadow.
- "What else could happen?" 16px/900.
- Chips: **Taco night?**, **Park hang**, **Board games**. Each chip is 36px tall, padding 0 14px, radius 999, bg `#f2f3f6` (hover `#e8eaee`), 14px/800.
  - Tapping a chip opens the post flow with the title prefilled, without the "?" (e.g. "Taco night").
- The same **Create an event** button as the empty state.

## 2. Give feedback (Profile → Help & info) · `49`, `50`
The **Notification settings** tile in Help & info is replaced by **Give feedback**:
- Glyph ✎
- Sub "Tell Eric what you think"

Notification settings is still reachable from the Settings list and the Notifications sheet gear.

**Sheet** (same bottom-sheet style as Send an update: white, radius 24 top, grab handle, `sheetUp` 320ms, scrim `rgba(15,18,25,.45)`, z above Profile sheet):
- Header row:
  - Eric's photo, 48px circle (`photos/faces/eric.png`).
  - Title "Tell Eric what you think about the app so far": 22px/900, `text-wrap: balance`.
  - Gray **Cancel** link.
- Bulleted questions (plain text, not tappable): 15.5px/600 `#2a2f38`, line-height 1.4, gap 6.
  - What's your overall sense of it?
  - How useful does it feel?
  - What would make you excited to use it?
  - Any issues I should be considering?
- Textarea:
  - Min-height 140px, 2px `#dcdfe6` border, radius 16, 16px/500.
  - Placeholder "Write as much or as little as you like."
- **Send to Eric**: full-width 52px pill.
  - Disabled (`#dcdfe6` / `#8a909b`) until text is entered.
  - Active `#5b4ae8` / white.

**Sent state:**
- Eric's photo, 64px, with a 26px green `#149a4b` check badge bottom-right (3px white ring).
- "Thank you!" 22px/900.
- "Got it. This really helps me figure out what to build next." 15px/500 `#5c6270`.
- Black **Done** button closes the sheet.

No "what kind" picker and no follow-up opt-in.

## 3. Feedback inbox (super admin only) · `49`, `51` (after one note sent), `52`
Visible only when signed in as **eric@ericscott-creative.com** (the super admin).

**Profile sheet:** a card sits at the top of the body, above Help & info.
- 42px amber tile `#fdf1d6` with a chat-bubble icon `#8f6405`.
- "Feedback inbox" 15.5px/900.
- Sub "N notes from testers" (or "Notes from testers land here" when empty).
- Red unread badge `#e2556b` (22px, caps at 9+).
- Chevron.

**Inbox sheet:**
- Full-height slide-up from `top:64px`.
- White header with an amber "SUPER ADMIN" eyebrow (11px/900, 1px tracking) and "Feedback" (24px/900), plus a Close X.
- Body `#e8eaee` holds one white card per note, newest first. Each card has:
  - 36px face (initial on purple if no photo).
  - Sender name 15px/800.
  - Relative time 12.5px/600 gray.
  - A purple **NEW** pill if unread.
  - Message 15px/500 with `white-space: pre-wrap`.
- Closing the sheet marks all notes as read.
- Empty: "No feedback yet."

**Data:** each submission stores
- `from` (sender's profile name)
- `photo`
- `at` (timestamp)
- `text`

Every submitted note goes to the super admin's inbox. Unread = not yet seen by the super admin.

**Prototype notes:**
- The demo sign-in email is now `eric@ericscott-creative.com` (was `eric@example.com`), so the demo shows the inbox.
- Demo mode seeds two sample notes (Dee, Hana). Don't carry these into the live app.

## 4. Small changes
- Help & info tile **How Spark Hub works** → **How this works** (sub unchanged).
- **Your schedule** view menu: **List** removed. Options are now Up next · Tiles · Month. A saved `list` choice falls back to Up next.

## Not in the prototype yet
- Real delivery/storage of feedback (the prototype keeps notes in local state only).
- Friends section on Groups (Round 78) — exploration only.
- Event preview slide-up (Round 13) — still undecided.
