# Spark Hub v6 — Update 10 (read after UPDATE_9.md)

These changes are folded into `Spark Hub App Version 6.dc.html`. Scope rules from README still apply: no content or data changes, UI and behavior only.

## 1. Your schedule — empty state
When you have nothing on your schedule, Your schedule now uses the same format as the group Plans empty state (UPDATE_9 §1). It replaces the old white "Nothing on the books yet." card.

- The layout, the calendar fan with three "SAT / ?" pages, and the "No plans yet" title match UPDATE_9 §1 exactly.
- Sub: "RSVP to something in your groups, or post your own." 15px/500 `#5c6270`, `text-wrap: pretty`.
- Two full-width buttons, stacked with a 10px gap:
  - **Post an event** (primary): 52px, radius 999, `#5b4ae8`, white 16px/800, + icon, shadow `0 6px 16px rgba(91,74,232,.3)`. Hover `#4a3ad4`. Opens the post flow.
  - **View calendar** (secondary): 52px, radius 999, white bg, 1.5px inset border `#dcdfe6`, `#0d1117` 16px/800, calendar icon. Hover `#f4f5f7`. Opens the Calendar tab.

## Not in the prototype yet
- Real delivery/storage of feedback (carried over from Update 9).
- Friends section on Groups (Round 78). This was exploration only.
- Event preview slide-up (Round 13). Still undecided.
