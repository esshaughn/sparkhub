# Handoff: Spark Hub — live build → Claude Design

**Direction:** code → design. This describes what's built, so the next design round starts from what shipped rather than from the design file.

- **Built (test):** https://gosparkhub-git-test-eric-5958s-projects.vercel.app · **Live:** https://gosparkhub.vercel.app
- **Source:** github.com/esshaughn/sparkhub (`index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, `supabase/templates/`)
- **Baseline:** Claude Design's **Spark Hub Version 5** handoff (`Spark Hub App Version 5.dc.html` + README), built in phases the owner chose: 1) Plans (RSVPs, sign-ups, the event form), 2) the new Home, tab bar, Groups, You own and Calendar, 3) the Notifications feed. A 4th phase (email) is **on hold**: the owner wants notifications in the app only for now. Earlier Full Site 4 decisions the owner kept are in §1.
- **As of:** 2026-09-28, phases 1–3 are **live** (and on test)

Where this doc and the design files disagree, **this doc is correct**.

---

## 1. What changed since the design

| # | Change | Design said | Why |
|---|---|---|---|
| 1 | **No tab bar on Welcome** (it shows everywhere else, signed in or not) | Tab bar on every screen | Owner's request |
| 2 | **Welcome is a full-screen column:** the photo and scrim stay where Full Site 4 put them (photo 500px at `top:-70px`, scrim over the top 430px, both shifted down by the status-bar inset in the installed app); the **logo moves down to sit just above the headline** (14px gap); a 32px gap after the steps; the sign-in buttons are anchored to the bottom of the screen (22px + the home-indicator inset below *New here?…*). On short screens the text rides higher over the photo | Logo top-left, fixed 580px photo block, buttons right after it | Owner, on an iPhone 15 |
| 3 | **Tab bar spacing:** 13px above the icons; below them the iPhone home-indicator inset less 8px (at least 14px), so the bar isn't bottom-heavy. 73px on desktop as before | 73px + the full inset | Owner, on iPhone |
| 4 | **Under the iPhone status bar** (installed app): the page runs behind the status bar with white time/battery. Welcome, All ideas and idea-page photos extend up behind it (their top controls move down by the inset); screens with a white top (Home, Calendar, You own, Groups, Notifications, Profile, How this works, Edit group, post/edit flows) continue the white behind it, so the white time/battery are hard to see there (owner accepted this for now; a dark strip and a soft fade were tried) | Not specified | Owner: "photo all the way to the top, light status icons" |
| 5 | **Welcome stays as built** (Full Site 4 + the iPhone changes above), not V5's Welcome | V5 Welcome | Owner |
| 6 | **Date voting is back** on ideas: anyone suggests a date or a location, everyone votes (▲ count), and the lead taps a suggestion to use it. The picked date tile shows first, labelled PICKED | V5 has the lead set the date | Owner |
| 7 | **Start a group** is on the Groups page (as in V5) **and** in Profile → Your groups; name it, then you're its owner | Groups page only | Owner wanted it back where it used to be too |
| 8 | **The idea page's date/location card is replaced** by the V5 idea boards (Dates, Location, "Steps to a plan" banner, *Make it a plan* for the lead, *Offer to help organize* for others); "The vibe" is now **Inspo** | Full Site 4 card | V5 |
| 9 | **Guest list** shows Going / Maybe / Can't make it only, no "Invited" count; **Invite people** shares the plan's link (copy / share sheet) rather than picking people | Invited count + people picker | There's no invite list yet; the link is how people get in |
| 10 | **Plans are made two ways:** posting an event (date + time required, lands on Plans with "It's on the books") or the lead's *Make it a plan* on an idea once it has a date and time (everyone interested becomes Going). *Clear the date* turns it back into an idea (Going people become interested) | V5 | Built to V5 |
| 11 | **Plan tracker's first ring is Location** (pin; *Set* / *TBD*) instead of Invited | Invited (envelope, invites sent) | Invites are a share link, so there's no count of invites sent |
| 12 | **Plan tracker's Going ring** is solid green once anyone's going, gold-empty at 0 (no "needs you while someone hasn't replied") | Ring = going / invited | Same: no invite list to compare against |
| 13 | **Idea tracker's People ring**: with no minimum set, it's done once anyone is interested | Done only if `answers.people`; else 0 | There's no "minimum people" field yet (README open item), so it would never fill |
| 14 | **You own and View all add a "Just happened" section** (plans from the last 3 days) after the dated ones | This week / Later / No date | Leading includes them, so the lists need somewhere to put them |
| 15 | **Profile has "How Spark Hub works"** (the old How this works tab) | Not in V5 | The tab went away; the page stays reachable |
| 16 | **Home scope isn't remembered** across reloads; the Calendar's Post an event only shows on today or later | Not specified | Keeps it simple; you can't post an event in the past |
| 17 | **No "invited you" notifications**: new plans in your groups show as "{host} put an event on the books: {plan}" with I'm going / Maybe (the Invites filter shows these) | "Tasha invited you to …" | Invites are a share link, so there's no invite to notify about |
| 18 | **Notification settings have four topics** (new events, host updates, day-before reminders, things you're hosting) and no channels; the sheet ends "Notifications show here in the app." | Five topics incl. Invites; Push + Email | No invites (above); the owner wants in-app only for now (no email), and push needs a service worker |
| 19 | **Host updates only reach people in the plan** (replied, or signed up for something); "haven't replied" updates reach everyone else in the group | Every update to everyone | Otherwise the feed fills with plans you never touched |

## 2. Things the build had to invent (please design these properly)

- **App icon** for "Add to Home Screen": the gold bolt with rays (`#f3c55a` / `#e8a71c`) centred on a full-bleed `#5b4ae8` square, bolt at ~66% of the square (50% in the Android "maskable" version). iOS rounds the corners itself. The home-screen name is **Spark Hub**. A designed icon (and a splash look) would replace it.

- **The Suggest a date / Add a date pop-up** on ideas still uses one native date-and-time field, so on iPhone the time is a minute-by-minute wheel. The event form has the date + 30-minute list; should the pop-up get the same two fields?
- **Titles already over 40 characters** keep their full text; editing one trims it to 40 on the first keystroke.

- **All ideas tabs:** Ideas / Plans / Happened with counts (Plans selected by default, green; Ideas gold; Happened purple); the page title follows the tab. Empty states: *No ideas yet.* / *No plans yet. When a lead locks in a date and time, it shows up here.* / *Nothing's happened yet. Plans move here the day after their date.*
- **Album layout by count:** 1 photo fills the card (186px), 2 sit side by side, 3+ use the big-plus-two mosaic with "+N".
- **Edit on plan and "It happened" pages** for the lead and admins (white pill, top right), so past events can still be fixed or deleted.
- **The host's "Before the day"** questions (4 prompts, "N of 4 thought through") are the build's wording; tap a row to answer, Enter to save.
- **Notification kinds the prototype didn't have**, each a 44px face with a 20px type badge: someone **is interested in** your idea (purple `#5b4ae8`, ♥), **suggested** a date or place for it (gold `#e8a71c`, ▲), **offered to help organize** it (`#7b6ef0`, ★), and the reminder row "**Tomorrow:** {plan} at 8am · {place}" / "**Today:** …" (red `#e2556b`, ⏰). Replies read "{name} is going to / might come to / can't make it to {plan}"; sign-ups "{name} signed up to bring {item} on {plan}". Empty feed: *You're all caught up. New plans, updates and replies from the last week show up here.*; filtered: *Nothing here this week.*
- **Empty states on the new screens:** You own — *Nothing yet. Events you post and ideas you float show up here.*; Calendar list — *Nothing coming up yet.*; Home, when you're in no group — the *Join with a code* card under the header.

## 3. Behaviour added in the build (no visual change)

- **Installable (PWA):** a web app manifest (`display: standalone`, start `/`, white theme and background) and the iOS home-screen tags. Opened from the home screen, there's no browser bar. On iPhone the home-screen app keeps its own sign-in, separate from Safari, so people sign in once more there. No service worker (no offline mode or push notifications) yet.

- Location suggestions now start at 2 characters (was 3), still debounced and cached; that uses more of the free 3,000 lookups a day, so worth watching.

- **Plans:** an idea is a plan when `planned` is set (a date and a time are required); it shows as **It happened** from the day after its date. Invite-only plans are hidden from the group except the lead, admins, people who replied and anyone with the link.
- **Updates and the day-before reminder reach people in the Notifications feed** (in the app only; no email or push). The host's reminder switch decides whether the reminder shows.
- **Signing up for something** needs a name (guests leave a name + number once, like "I'm interested"); items with a "how many" stop taking sign-ups when full (enforced in the database).

- **The notification feed is built in the app** from what's already stored (last 7 days); only read state and settings are saved (`notif_state`), so they follow you between the installed app and the browser. A reminder appears at 8am the day before (and on the day).

## 4. Designed but not built or not working

- **Email and push notifications aren't built:** the owner wants everything in-app for now (phase 4, email, is on hold). Push would also need a service worker.
- **Next-step buttons** on You own cards open the plan or idea (as in the prototype); they don't jump straight to the action.
- **Home's action strip, "Your Groups" row and "Float an idea" card** are off, as in the README toggles.
- **"How this works" body copy** is still placeholder Latin (as designed).

## 5. Open questions for the next round

1. Everything in the README's **Open / not designed yet** list still stands (categories, first-run view for an empty group, removing members, leaving a group, lead notifications, Suggest vs Offer wording, first vs full names, group creation in the app, Welcome wording, the parked Lead note).
2. **Invite link screens** (the current sign-in-to-join flow is a stopgap).
3. **A second owner by hand:** Joseph (torrez.fitness@gmail.com) is already a co-owner of Torrez Fitness, so the two-owner states (Remove / Step down) are reachable on live.
4. **Owner controls** in the Members sheet: is a pill + text button per row right at 393px, or should roles move into a per-row menu?
5. **Google's sign-in screen** says "continue to …supabase.co" until Spark Hub has its own sign-in domain.
6. **Video on the vibe board** (2 photos + 1 short clip) is parked: phone videos can't be shrunk in the browser, so it would need a ~20 s / 25 MB cap and watching the free plan's bandwidth.
7. **Spark Hub address:** gosparkhub.vercel.app for now; a custom domain may follow.
8. **Minimum people** on ideas (the People ring, §1) and a real **invite list** (so the Invited ring, "N haven't replied" and "invited you" notifications can come back) — want these designed next?

## 6. Design tokens

As listed in the V5 README (page `#e8eaee`, purple `#5b4ae8`, green `#149a4b`, gold `#e8a71c`, badge red `#e2556b`; owner chip `#ece9fd` / `#4a3ad4`, admin chip `#fdf1d6` / `#8f6405`).
