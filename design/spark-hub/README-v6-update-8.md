# Spark Hub v6 — Update 8 (read after UPDATE_7.md)

Two changes are folded into `Spark Hub App Version 6.dc.html`. Both are about the host's view of their events. The source designs are in `Event Page Options.dc.html`: **77a** (Hosting list) and **73a** (title switcher, without its icons). Rounds 67–76 are there for context only; nothing else from them is new in this update.

Scope rules from README still apply: no content or data changes, UI and behavior only.

## 1. Title switcher (73a, no icons) · `46`, `48`
The H1 on **Your tasks** and on **Hosting** is now a button: title + 18px ⌄ chevron (stroke 3, rotates 180° while open, 150ms).
- Tap → a scrim `rgba(13,17,23,.35)` covers the screen, and a menu opens at `top:66px; left:12px`. The menu is 300px wide, white, radius 18, padding 6, gap 2, shadow `0 18px 44px rgba(15,18,25,.25), 0 0 0 1px #e6e7eb`.
- Two rows, each min 60px, padding 8px 12px, radius 12. **No leading icons.**
  - **Your tasks**: sub "What needs you, across everything"
  - **Hosting** + count badge: sub "Everything you’re leading — drafts and ideas too"
  - Title 16px/800 `#0d1117`, sub 13px/600 `#6b7280`.
  - Current view: bg `#f3f1fe`, with an 18px purple `#5b4ae8` check on the right.
- Badge: 19px pill, `#5b4ae8`, 11px/900 white. Count = everything you lead (upcoming, ideas, past in the last 3 days) + drafts. Caps at 9+. Hidden at 0.
- Picking the other row switches screens. Picking the current row, or tapping the scrim, just closes the menu.
- This is the **only entry point** to Hosting. Bottom nav is unchanged.

## 2. Hosting screen (77a) · `47`
Replaces the old "Your plans / Your ideas" screen (tabs, green/amber CTA and big photo cards are gone). New events still start from the + in the nav.

**Header:** white, padding 14px 16px. Left is "Hosting ⌄" (the switcher above). Right is the 44px round `#f2f3f6` search button, which opens the same Search sheet as Your tasks. There is no bell and no group dropdown.

**Body:** `#e8eaee`, padding 12px 14px 26px, gap 8px. The sections below appear in this order. A section with no items is hidden.

| Section | Contents | Sort | Line 2 |
|---|---|---|---|
| **Drafts · N** | saved post drafts | as saved | "{j} of 5 steps" |
| **Ideas · N** | ideas you lead | soonest | top date "Oct 23 leads" in amber `#8f6405` if dates have votes and none is picked; else "N interested" |
| **Planning · N** | upcoming plans you lead | soonest first; no date = last | "Sun, Oct 18" or "Date to be decided" |
| **Past · N** | **all** past events you led | most recent first | "Sep 24" |

- Section label: 12px/900, .9px tracking, uppercase, `#6b7280`, padding 6px 6px 0.
- Each section is one white card (radius 14, shadow `0 1px 2px rgba(15,18,25,.06)`). Its rows are separated by 1px `#f2f3f6` hairlines.
- Row: min 52px, padding 6px 14px 6px 10px, gap 10.
  - 32px thumb (radius 7, cover).
  - Title 15px/800 `#0d1117`, one line with ellipsis.
  - Line 2: 12.5px/600 `#6b7280`, one line.
  - 12px gray chevron `#b9bcc4`.
  - Hover bg `#fafbfc`.
- Thumbs:
  - Event photo as is.
  - **Past** thumbs are `saturate(.35)` at .85 opacity.
  - **Drafts** with a photo are shown the same muted way.
  - Drafts without a photo show `#f4f5f7` with a 16px gray image icon (`#9aa0ac`).
- Tapping a row opens the event or idea. Tapping a draft resumes the post flow at its saved step.
- Empty (nothing at all): one white card, "Nothing you’re hosting yet. Tap + to post an event or float an idea."
- When the screen is opened already filtered to a group (e.g. from a group's "View all"), a 13px/700 gray line with the group name sits above the list. Every section is filtered to that group.

## Not in the prototype yet
- Event preview slide-up (Round 13) — still undecided.
- A group filter on Hosting, if wanted, needs a new home. The title is now the view switcher.
