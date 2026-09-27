# Handoff: Spark Hub — live build → Claude Design

**Direction:** code → design. This describes what's built, so the next design round starts from what shipped rather than from the design file.

- **Built (test):** https://gosparkhub-git-test-eric-5958s-projects.vercel.app · **Live:** https://gosparkhub.vercel.app
- **Source:** github.com/esshaughn/sparkhub (`index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, `supabase/templates/`)
- **Baseline:** Claude Design's **Spark Hub v5 update** handoff (Your plans, Your events & ideas, all-groups Calendar, group page redesign), which builds on the **Spark Hub Version 5** handoff. Both READMEs and the updated prototype are in `design/spark-hub/`. Some decisions the owner made while V5 was being built aren't in that update; they're in §1.
- **As of:** 2026-09-30, the v5 update and the shared demo world are live; the start-up fix is on the test branch (the email phase is on hold)

Where this doc and the design files disagree, **this doc is correct**.

---

## 1. What changed since the design

| # | Change | Design said | Why |
|---|---|---|---|
| 1 | **Welcome stays as built before V5:** full-screen column, photo and scrim where Full Site 4 put them (photo 500px at `top:-70px`, scrim over the top 430px, shifted down by the status-bar inset in the installed app), logo just above the headline (14px gap), 32px after the steps, sign-in buttons anchored to the bottom (22px + the home-indicator inset below *New here?…*) | V5 Welcome | Owner, on an iPhone 15 |
| 2 | **Tab bar spacing:** 13px above the icons; below them the iPhone home-indicator inset less 8px (at least 14px). 73px on desktop | 73px + the full inset | Owner, on iPhone |
| 3 | **The center Calendar tab is a big purple circle:** 54px `#5b4ae8` (active `#4a3ad4` with a white-then-purple ring), white 25px calendar icon, raised 10px, shadow `0 6px 16px rgba(91,74,232,.38)` | A plain 23px icon like the others | Owner's request |
| 4 | **Under the iPhone status bar** (installed app): the page runs behind the status bar with white time/battery. Welcome, group pages and idea/plan photos extend up behind it; screens with a white top (Your plans, Your events & ideas, Calendar, Groups, Notifications, Profile, How this works, Edit group, post/edit flows) continue the white behind it, so the time/battery are hard to see there (owner accepted this for now) | Not specified | Owner: "photo all the way to the top, light status icons" |
| 5 | **Invites are a share link, so nothing counts invites.** The lead's dashboard on Your plans shows **Going · Maybe · Sign-ups** (Maybe in place of Invited); Going's ring is going ÷ (going + maybe), Maybe's is maybe ÷ (going + maybe) in gold. There's no "N haven't replied · Nudge", no "No one invited yet · Invite", no Invited count on the guest list, and **Invite people** shares the plan's link rather than picking people | Invited ring, "haven't replied · Nudge", invite sheet | Owner kept share links (2026-09-29) |
| 6 | **Actions count** = the lead's next steps: suggestions to review, "Location TBD", open sign-up spots, "Today · post an update", reminder off | Also unanswered invites | Same as #5 |
| 7 | **No "invited you" notifications**: new plans in your groups show as "{host} put an event on the books: {plan}" with I'm going / Maybe (the Invites filter shows these) | "Tasha invited you to …" | Same as #5 |
| 8 | **Date voting on ideas:** anyone suggests a date or a location, everyone votes (▲ count), the lead taps one to use it; the picked tile shows first, labelled PICKED | The lead sets the date | Owner |
| 9 | **Start a group** is on the Groups page **and** in Profile → Your groups | Groups page only | Owner |
| 10 | **Profile has "How Spark Hub works"** (the old How this works tab) | Not in V5 | The tab went away; the page stays reachable |
| 11 | **Covers:** Torrez Fitness uses the design's `torrez-group.jpg`; Walnut Creek keeps the owner's parade photo (the design's is the same shot, framed differently); Hub on Hunters keeps its Mini Gras photo | Hub on Hunters = `get-togethers-2.jpg` | Owner chose these covers earlier |
| 12 | **Notification settings have four topics** (new events, host updates, day-before reminders, things you're hosting) and no channels; the sheet ends "Notifications show here in the app." | Five topics incl. Invites; Push + Email | No invites (#5); the owner wants in-app only for now, and push needs a service worker |
| 13 | **Host updates only reach people in the plan** (replied, or signed up for something); "haven't replied" updates reach everyone else in the group | Every update to everyone | Otherwise the feed fills with plans you never touched |
| 14 | **The "All groups" scope on Your plans isn't remembered** across reloads (Tiles/List/Grid choices are, per device) | Not specified | Keeps it simple |
| 15 | **The ROUGH DRAFT stamps are live** on Your events & ideas and Calendar | "Remove before launch" | Owner asked to show them |

## 2. Things the build had to invent (please design these properly)

- **App icon** for "Add to Home Screen": the gold bolt with rays (`#f3c55a` / `#e8a71c`) centred on a full-bleed `#5b4ae8` square, bolt at ~66% (50% in the Android "maskable" version). Home-screen name **Spark Hub**.
- **Setting a sign-up's time:** under the host's add row, once they type an item, a small "Time (optional)" select (38px, 1.5px `#dcdfe6` border, radius 12) with "No time" and the 30-minute list. On the plan page the time shows after the item as a chip (`#fdf1d6` / `#8f6405`, 12px/800, padding 1×8).
- **The Suggest a date / Add a date pop-up** on ideas still uses one native date-and-time field (a minute-by-minute wheel on iPhone). The event form has date + 30-minute list; should the pop-up match?
- **Titles already over 40 characters** keep their full text; editing trims to 40.
- **Album layout by count:** 1 photo fills the card (186px), 2 side by side, 3+ the big-plus-two mosaic with "+N".
- **Edit on plan and "It happened" pages** for the lead and admins (white pill, top right).
- **The host's "Before the day"** questions (4 prompts, "N of 4 thought through"); tap to answer, Enter to save.
- **Notification kinds the prototype didn't have**, each a 44px face with a 20px type badge: **is interested in** your idea (`#5b4ae8`, ♥), **suggested** a date or place (`#e8a71c`, ▲), **offered to help organize** (`#7b6ef0`, ★), and "**Tomorrow:** {plan} at 8am · {place}" / "**Today:** …" (`#e2556b`, ⏰). Replies: "{name} is going to / might come to / can't make it to {plan}"; sign-ups: "{name} signed up to bring {item} on {plan}". Empty feed: *You're all caught up. New plans, updates and replies from the last week show up here.*; filtered: *Nothing here this week.*
- **Your plans / group page when you're in no group:** the *Join with a code* card.
- **Loading screen:** while the app itself loads (a blank page before), a white screen with the gold bolt (64px, `#e8a71c`, soft glow, pulsing to 86% scale and 60% opacity every 1.2s; still with reduced motion) and "Spark Hub" 24px/900 under it. A designed splash would replace it.
- **Loading placeholders:** until the first data arrives, Your plans, Your events & ideas, Calendar, Groups and Notifications show pulsing white rounded blocks (the page's card shape, `skPulse` 1.4s) instead of their empty states. After the first visit, the app opens on the last data seen while it refreshes.
- **Demo content card** (Profile, only on the owner's account, only while demo content exists): white card, "Demo content" 15.5px/800, "N ideas and plans in your groups are demo content. Only you can see this." 13.5px/500 `#6b7280`, and an outlined red button **Remove all demo content** (1.5px `#f5c2cb` border, `#9b1c31` text). It confirms with "Remove all demo content?" / "Remove it" / "Keep it".

## 3. Behaviour added in the build (no visual change)

- **Installable (PWA):** manifest + iOS home-screen tags; the home-screen app keeps its own sign-in, separate from Safari. No service worker yet.
- Location suggestions start at 2 characters, debounced and cached.
- **Plans:** an idea is a plan when `planned` is set (date and time required); it shows as **It happened** from the day after its date. Invite-only plans are hidden from the group except the lead, admins, people who replied and link holders.
- **Updates and the day-before reminder reach people in the Notifications feed** (in the app only). The host's reminder switch decides whether the reminder shows. The feed is built from what's stored (last 7 days); read state and settings follow you between devices.
- **Sign-ups:** a name is needed (guests leave name + number once); items with a "how many" stop taking sign-ups when full; only the host sets "how many" or a time (enforced in the database).
- **Shared demo world:** anyone who signs in joins the four demo groups as a member (named testers get owner/admin roles from a roster). The demo content isn't marked as demo anywhere in the app.
- **Calendar** lists every idea and plan you can see in your groups (invite-only ones only if you're in them), past events only if you were part of them.

## 4. Designed but not built or not working

- **Email and push notifications:** the owner wants everything in-app for now; push also needs a service worker.
- **Actions → Review** and the next-step buttons open the plan or idea; they don't jump straight to the action (as in the prototype).
- **"How this works" body copy** is still placeholder Latin (as designed).

## 5. Open questions for the next round

1. Everything in the README's **Open / not designed yet** list still stands (categories, first-run view for an empty group, removing members, leaving a group, Suggest vs Offer wording, first vs full names, Welcome wording).
2. **A real invite list** (pick neighbors or the whole group) would bring back Invited, "haven't replied · Nudge" and "invited you" notifications — design it next?
3. **Minimum people** on ideas ("How many do you need?") has no input yet.
4. **Invite link screens** (the current sign-in-to-join flow is a stopgap).
5. **Owner controls** in the Members sheet: pill + text button per row at 393px, or a per-row menu?
6. **Google's sign-in screen** says "continue to …supabase.co" until Spark Hub has its own sign-in domain.
7. **Video on the vibe board** is parked (needs a ~20 s / 25 MB cap).
8. **Spark Hub address:** gosparkhub.vercel.app for now; a custom domain may follow.

## 6. Design tokens

As listed in the v5 update README (ink `#0d1117`, page `#e8eaee`, purple `#5b4ae8` / `#4a3ad4` / `#eeebff`, green `#149a4b` / `#0f7a3c` / `#e7f6ec`, gold `#e8a71c` / `#f5b428` / `#8f6405` / `#fdf1d6`, red `#e2556b`; owner chip `#ece9fd` / `#4a3ad4`, admin chip `#fdf1d6` / `#8f6405`).
