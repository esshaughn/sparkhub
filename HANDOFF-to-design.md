# Handoff: Spark Hub — live build → Claude Design

**Direction:** code → design. This describes what's built, so the next design round starts from what shipped rather than from the design file.

- **Built (test):** https://gosparkhub-git-test-eric-5958s-projects.vercel.app · **Live:** https://gosparkhub.vercel.app
- **Source:** github.com/esshaughn/sparkhub (`index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, `supabase/templates/`)
- **Baseline:** Claude Design's **Spark Hub v5.2** handoff (navigation, headers, views, event page, Profile), which builds on the v5 and v5 update handoffs. All three READMEs and the current prototype are in `design/spark-hub/` (`README-v5-2.md` is the newest). Decisions the owner made along the way that the design doesn't reflect are in §1.
- **As of:** 2026-09-27, v5.2 is built on the test branch; everything before it is live (the email phase is on hold)

Where this doc and the design files disagree, **this doc is correct**.

---

## 1. What changed since the design

| # | Change | Design said | Why |
|---|---|---|---|
| 1 | **Welcome stays as built before V5:** full-screen column, photo and scrim where Full Site 4 put them (photo 500px at `top:-70px`, scrim over the top 430px, shifted down by the status-bar inset in the installed app), logo just above the headline (14px gap), 32px after the steps, sign-in buttons anchored to the bottom (22px + the home-indicator inset below *New here?…*) | V5 Welcome | Owner, on an iPhone 15 |
| 2 | **Tab bar spacing:** 13px above the icons; below them the iPhone home-indicator inset less 8px (at least 14px). 73px on desktop | 73px + the full inset | Owner, on iPhone |
| 3 | **Under the iPhone status bar** (installed app): the page runs behind the status bar with white time/battery. Welcome, group pages and idea/plan photos extend up behind it; screens with a white top (Your schedule, Your plans & ideas, Calendar, Notifications, Groups, Profile, How this works, Edit group, post/edit flows) continue the white behind it, so the time/battery are hard to see there (owner accepted this for now) | Not specified | Owner: "photo all the way to the top, light status icons" |
| 4 | **Invites are a share link, so nothing counts invites.** The lead's dashboard on Your schedule and Your plans shows **Going · Maybe · Sign-ups** (Maybe in place of Invited, which v5.2 still draws); Going's ring is going ÷ (going + maybe), Maybe's is maybe ÷ (going + maybe) in gold. There's no "N haven't replied · Nudge", no "No one invited yet · Invite", no Invited count on the guest list, and **Invite people** shares the plan's link rather than picking people | Invited ring, "haven't replied · Nudge", invite sheet | Owner kept share links (2026-09-29) |
| 5 | **Actions count** = the lead's next steps: suggestions to review, "Location TBD", open sign-up spots, "Today · post an update", reminder off | Also unanswered invites | Same as #4 |
| 6 | **No "invited you" notifications**: new plans in your groups show as "{host} put an event on the books: {plan}" with I'm going / Maybe (the Invites filter shows these) | "Tasha invited you to …" | Same as #4 |
| 7 | **Date voting on ideas:** anyone suggests a date or a location, everyone votes (▲ count), the lead taps one to use it; the picked tile shows first, labelled PICKED | The lead sets the date | Owner |
| 8 | **Profile's Settings list has two rows**, Notifications and Privacy; **Help & info has one**, How Spark Hub works | Settings: Notifications, Calendar sync, Email, Privacy; Help & info: How it works, Send feedback, Ask a question, Notification settings | Owner (2026-09-27): notifications are in-app only, so no Email row; there's no calendar sync to open; feedback and questions have no inbox behind them yet |
| 9 | **Covers:** Torrez Fitness uses the design's photo and crop (`{x:50, y:72, z:1.35}`); Walnut Creek keeps the owner's parade photo; Hub on Hunters keeps its Mini Gras photo | Hub on Hunters = `get-togethers-2.jpg` | Owner chose these covers earlier |
| 10 | **Notification settings have four topics** (new events, host updates, day-before reminders, things you're hosting); the sheet ends "Notifications show here in the app." | Five topics incl. Invites | No invites (#5) |
| 11 | **Host updates only reach people in the plan** (replied, or signed up for something); "haven't replied" updates reach everyone else in the group | Every update to everyone | Otherwise the feed fills with plans you never touched |
| 12 | **The "All groups" scope on Your schedule isn't remembered** across reloads (Tiles/List/Grid choices are, per device) | Not specified | Keeps it simple |
| 13 | **The People readiness step** is done once anyone is interested, since there's no minimum-people field to divide by | interested ÷ minimum people | Minimum people isn't designed yet (§5) |
| 14 | **Profile has no "Your groups" section** (as v5.2 says), so Start a group, Join a group and the admin gear live on the Groups tab and Edit on each group's page only | v5.2 | Owner confirmed the removal (2026-09-27) |
| 15 | **NEW · N** on Notifications counts unread items and, with Mark all read, sits on the first section whichever it is (sections stay New today / Earlier this week by date); both go once everything is read | "NEW · 6" | Same look; the count is unread, not today's |
| 16 | **Groups tab: pinned cards are photo only**: the white strip under a pinned group's card (*N new*, events · ideas, Leading · Helping chips) is removed; a new-ideas dot sits before the name instead. With nothing pinned, every group is a square tile (the first group no longer gets a big card) | v5.2 big card with a chip row; first group featured when none pinned | Owner: remove the bottom bar for now; unpinned groups showing the pinned layout looked like a glitch (2026-09-27) |

## 2. Things the build had to invent (please design these properly)

- **App icon** for "Add to Home Screen": the gold bolt with rays (`#f3c55a` / `#e8a71c`) centred on a full-bleed `#5b4ae8` square, bolt at ~66% (50% in the Android "maskable" version). Home-screen name **Spark Hub**.
- **Setting a sign-up's time:** under the host's add row, once they type an item, a small "Time (optional)" select (38px, 1.5px `#dcdfe6` border, radius 12) with "No time" and the 30-minute list. On the plan page the time shows after the item as a chip (`#fdf1d6` / `#8f6405`, 12px/800, padding 1×8).
- **The Suggest a date / Add a date pop-up** on ideas still uses one native date-and-time field (a minute-by-minute wheel on iPhone). The event form has date + 30-minute list; should the pop-up match?
- **Titles already over 40 characters** keep their full text; editing trims to 40.
- **Album layout by count:** 1 photo fills the card (186px), 2 side by side, 3+ the big-plus-two mosaic with "+N".
- **Edit on plan and "It happened" pages** for the lead and admins (white pill, top right).
- **The host's "Before the day"** questions (4 prompts, "N of 4 thought through"); tap to answer, Enter to save.
- **Notification kinds the prototype didn't have**, each a 44px face with a 20px type badge: **is interested in** your idea (`#5b4ae8`, ♥), **suggested** a date or place (`#e8a71c`, ▲), **offered to help organize** (`#7b6ef0`, ★), and "**Tomorrow:** {plan} at 8am · {place}" / "**Today:** …" (`#e2556b`, ⏰). Replies: "{name} is going to / might come to / can't make it to {plan}"; sign-ups: "{name} signed up to bring {item} on {plan}". Empty feed: *You're all caught up. New plans, updates and replies from the last week show up here.*; filtered: *Nothing here this week.*
- **Your schedule / group page when you're in no group:** the *Join with a code* card.
- **Edit profile's new fields:** "Place" (40 characters, placeholder *e.g. East Austin*) and "About you" (160 characters, three lines, placeholder *A line or two: what you're up for, what you bring*). The place line reads *{place} · Member since {year}* (the year the account was made); with no place it's just *Member since …*, and the bio is omitted until there is one.
- **Empty states on Your plans / Your ideas:** *Nothing on the books yet. Post an event and it lives here.* / *No ideas yet. Float one and see who's in before you pick a date.*
- **Profile → Settings → Privacy** opens the privacy page (sub-line *How your info is used*); Notifications' sub-line is *What shows up in the app*.
- **Loading screen:** while the app itself loads (a blank page before), a white screen with the gold bolt (64px, `#e8a71c`, soft glow, pulsing to 86% scale and 60% opacity every 1.2s; still with reduced motion) and "Spark Hub" 24px/900 under it. A designed splash would replace it.
- **Loading placeholders:** until the first data arrives, Your schedule, Your plans & ideas, Calendar, Groups and Notifications show pulsing white rounded blocks (the page's card shape, `skPulse` 1.4s) instead of their empty states. After the first visit, the app opens on the last data seen while it refreshes.
- **Demo content card** (Profile, only on the owner's account, only while demo content exists): white card, "Demo content" 15.5px/800, "N ideas and plans in your groups are demo content. Only you can see this." 13.5px/500 `#6b7280`, and an outlined red button **Remove all demo content** (1.5px `#f5c2cb` border, `#9b1c31` text). It confirms with "Remove all demo content?" / "Remove it" / "Keep it".
- **Freeze log** (temporary debugging card, owner's Profile only, above Sign out): "Freeze log" 15.5px/800, sub-line *Temporary, only you see this. Times the app stopped responding on this device.*, then rows like **stall 4.2s** · screen · time with a note line, and a **Clear** pill; empty: *Nothing logged yet.* Not for design; it goes away once the freezes are fixed.
- **Pull to refresh:** at the top of a screen, dragging down keeps the white header still and slides the feed under it down (half the finger's distance). The gap shows a 36px white circle (shadow `0 2px 8px rgba(15,18,25,.14)`) with a refresh arrow that turns as you pull, gray `#b9bcc4` until far enough (64px), then purple `#5b4ae8`. Let go past that and it spins while the data reloads (at least 0.6s), then the feed slides back. Screens without a header (idea/plan pages) slide as a whole. If it fails: toast *Couldn't refresh. Check your connection.*

## 3. Behaviour added in the build (no visual change)

- **Installable (PWA):** manifest + iOS home-screen tags; the home-screen app keeps its own sign-in, separate from Safari. No service worker yet.
- Location suggestions start at 2 characters, debounced and cached.
- **Plans:** an idea is a plan when `planned` is set (date and time required); it shows as **It happened** from the day after its date. Invite-only plans are hidden from the group except the lead, admins, people who replied and link holders.
- **Updates and the day-before reminder reach people in the Notifications feed** (in the app only). The host's reminder switch decides whether the reminder shows. The feed is built from what's stored (last 7 days); read state and settings follow you between devices.
- **Sign-ups:** a name is needed (guests leave name + number once); items with a "how many" stop taking sign-ups when full; only the host sets "how many" or a time (enforced in the database).
- **Shared demo world:** anyone who signs in joins the four demo groups as a member (named testers get owner/admin roles from a roster). The demo content isn't marked as demo anywhere in the app.
- **Calendar** lists every idea and plan you can see in your groups (invite-only ones only if you're in them), past events only if you were part of them.
- **Back from an event page** restores the screen it was opened from with its scroll position (tab, group and Your plans/ideas choice included); opened from a shared link, with no history, it goes to the group's page. The idea page header now holds only Back and Edit, as in the v5.2 prototype.

## 4. Designed but not built or not working

- **Email and push notifications:** the owner wants everything in-app for now; push also needs a service worker.
- **Actions → Review** opens the plan or idea; it doesn't jump straight to the action (as in the prototype).
- **Help & info's Send feedback and Ask a question** aren't built (nothing receives them yet); **Calendar sync** and **Email** rows are left out on purpose (§1 #10).
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
9. **Send feedback / Ask a question:** where should these go (email to the owner, a form)? Until there's an answer they stay out of Help & info.

## 6. Design tokens

As listed in the v5.2 README (ink `#0d1117`, inactive title `#c3c7d0`, inactive tab `#9aa0ac`, page `#e8eaee`, purple `#5b4ae8` / `#4a3ad4` / `#eeebff`, green `#149a4b` / `#0f7a3c` / `#e7f6ec`, gold `#e8a71c` / `#f5b428` / `#8f6405` / `#fdf1d6`, red `#e2556b`; owner chip `#ece9fd` / `#4a3ad4`, admin chip `#fdf1d6` / `#8f6405`).
