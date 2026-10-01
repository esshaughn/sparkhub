# Spark Hub v6 — Update 13 (read after UPDATE_12.md)

These changes are folded into `Spark Hub App Version 6.dc.html`. Scope rules from README still apply: UI and behavior only. Friend data is demo data (`FRIENDS` const), so real friend storage is a backend task.

## 1. Groups tab becomes "Your people" (Rounds 43b + 44b)
Screenshots 54–59.

### Header (matches Calendar)
- 180px photo header, same gradient as Calendar.
- Eyebrow **GROUPS & FRIENDS** (13px/900, 1px tracking, `#cfc9ff`). Title **Your people** (40px/900, −1.4px). Sub: "4 groups · 10 friends".
- Top-right: **Search** + bell (44px frosted circles, same as Calendar).
- Bottom-right: 52px round **Add** button. It's **white** with a dark person+ icon, so it's visibly different from Calendar's purple "Post an event" +.
- Join is **no longer** in the header.
- Bottom-nav icon changed from a grid to a two-people icon.

### Search
- The header search opens a pill field above the switch (48px, white, inset 1.5px `#dcdfe6`, Cancel in purple).
- It filters whichever tab is showing: group names, or friend names. Shows "No groups/friends match '…'" when there are no matches.

### Add people sheet (from the round button)
Standard bottom sheet (24px top radius, 36px close). Three rows, each with a 44px gray icon circle, title 16px/900, and subtitle:
1. **Add a friend** · copies your friend link and shows a toast.
2. **Join a group** · opens the existing Join sheet.
3. **Start a group** · opens the existing Create flow.
These replace the old "Join with a code" / "Start a new group" buttons and the "Add a friend" tile at the bottom of each list.

### Groups / Friends switch
Segmented pill under the header (`#dfe2e7` track, white selected thumb, 38px). Labels carry counts: "Groups · 4", "Friends · 10".

### Groups side
- The same group cards as before (pinned large cards + 2-up tiles).
- Small tiles now show **member count** under the name ("48 members"). Large cards already did.
- Friend avatars and friend counts are **not** shown on group cards (tried, removed by design).

### Friends side
- **Friend requests** on top: initials avatar, name, "Wants to be friends · {group}", ✕ decline, purple **Accept**. Accepting adds them to the grid and shows the toast "You and Rosa are friends".
- **Friend grid**: 4 columns, 58px photos (or initials on a tint), first name, first shared group (+N if more). Hint: "Tap friends to invite them together."
- Tapping toggles selection: 2.5px purple ring + check badge.
- With 1+ selected, a **sticky invite bar** pins above the bottom nav: "Invite Darnell & Marisol to…" (3+ shows "A, B + N"), plus a white ✕ to clear the selection.
- The invite bar opens the **Invite sheet**: your upcoming events (hosting or going). Picking one shows the toast "Invited … to {event}" and clears the selection.

### Friend model
Mutual: both people have to say yes (request → accept). There's **no** "friends see your plans" setting; that was removed.

## Not in the prototype yet
- Real friend requests, friend links, and invite delivery.
- Event preview slide-up (Round 13). Still undecided.
- Real delivery/storage of feedback (carried over).
