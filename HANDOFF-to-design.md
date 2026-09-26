# Handoff: Spark Hub — live build → Claude Design

**Direction:** code → design. This describes what's built, so the next design round starts from what shipped rather than from the design file.

- **Built (test):** https://gosparkhub-git-test-eric-5958s-projects.vercel.app · **Live:** https://gosparkhub.vercel.app
- **Source:** github.com/esshaughn/sparkhub (`index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, `supabase/templates/`)
- **Baseline:** Claude Design's **Spark Hub Version 5** handoff (`Spark Hub App Version 5.dc.html` + README). It's being built in phases the owner chose: **1) Plans** (RSVPs, sign-ups, the event form), 2) the new Home, tab bar, Groups, You own and Calendar screens, 3) the Notifications feed, 4) email. Earlier Full Site 4 decisions the owner kept are in §1.
- **As of:** 2026-09-28, phases 1 (Plans), 2 (Home, tab bar, Groups, You own, Calendar) and 3 (Notifications) are built on the test branch

Where this doc and the design files disagree, **this doc is correct**.

---

## 1. What changed since the design

| # | Change | Design said | Why |
|---|---|---|---|
| 1 | **No tab bar on Welcome** (it shows everywhere else, signed in or not) | Tab bar on every screen | Owner's request |
| 2 | **Welcome is a full-screen column:** the photo and scrim stay where Full Site 4 put them (photo 500px at `top:-70px`, scrim over the top 430px, both shifted down by the status-bar inset in the installed app); the **logo moves down to sit just above the headline** (14px gap); a 32px gap after the steps; the sign-in buttons are anchored to the bottom of the screen (22px + the home-indicator inset below *New here?…*). On short screens the text rides higher over the photo | Logo top-left, fixed 580px photo block, buttons right after it | Owner, on an iPhone 15 |
| 3 | **Tab bar spacing:** 13px above the icons; below them the iPhone home-indicator inset less 8px (at least 14px), so the bar isn't bottom-heavy. 73px on desktop as before | 73px + the full inset | Owner, on iPhone |
| 4 | **Under the iPhone status bar** (installed app): the page runs behind the status bar with white time/battery. Welcome, All ideas and idea-page photos extend up behind it (their top controls move down by the inset); screens with a white top (Home, Profile, How this works, Edit group, post/edit flows) continue the white behind it, so the white time/battery are hard to see there (owner accepted this for now; a dark strip and a soft fade were tried) | Not specified | Owner: "photo all the way to the top, light status icons" |
| 5 | **Welcome stays as built** (Full Site 4 + the iPhone changes above), not V5's Welcome | V5 Welcome | Owner |
| 6 | **Date voting is back** on ideas: anyone suggests a date or a location, everyone votes (▲ count), and the lead taps a suggestion to use it. The picked date tile shows first, labelled PICKED | V5 has the lead set the date | Owner |
| 7 | **Start a group is back** (Profile → Your groups → Start a group: name it, then you're its owner) | V5 drops it | Owner |
| 8 | **The idea page's date/location card is replaced** by the V5 idea boards (Dates, Location, "Steps to a plan" banner, *Make it a plan* for the lead, *Offer to help organize* for others); "The vibe" is now **Inspo** | Full Site 4 card | V5 |
| 9 | **Guest list** shows Going / Maybe / Can't make it only, no "Invited" count; **Invite people** shares the plan's link (copy / share sheet) rather than picking people | Invited count + people picker | There's no invite list yet; the link is how people get in |
| 10 | **Plans are made two ways:** posting an event (date + time required, lands on Plans with "It's on the books") or the lead's *Make it a plan* on an idea once it has a date and time (everyone interested becomes Going). *Clear the date* turns it back into an idea (Going people become interested) | V5 | Built to V5 |
| 12 | **Plan tracker's first ring is Location** (pin; *Set* / *TBD*) instead of Invited | Invited (envelope, invites sent) | Invites are a share link, so there's no count of invites sent |
| 13 | **Plan tracker's Going ring** is solid green once anyone's going, gold-empty at 0 (no "needs you while someone hasn't replied") | Ring = going / invited | Same: no invite list to compare against |
| 14 | **Idea tracker's People ring**: with no minimum set, it's done once anyone is interested | Done only if `answers.people`; else 0 | There's no "minimum people" field yet (README open item), so it would never fill |
| 15 | **You own and View all add a "Just happened" section** (plans from the last 3 days) after the dated ones | This week / Later / No date | Leading includes them, so the lists need somewhere to put them |
| 16 | **Profile has "How Spark Hub works"** (the old How this works tab) | Not in V5 | The tab went away; the page stays reachable |
| 17 | **Home scope isn't remembered** across reloads; the Calendar's Post an event only shows on today or later | Not specified | Keeps it simple; you can't post an event in the past |
| 18 | **No "invited you" notifications**: new plans in your groups show as "{host} put an event on the books: {plan}" with I'm going / Maybe (the Invites filter shows these) | "Tasha invited you to …" | Invites are a share link, so there's no invite to notify about |
| 19 | **Notification settings have four topics** (new events, host updates, day-before reminders, things you're hosting) and one channel, **Email**, with the line "Email starts soon; push notifications come later." | Five topics incl. Invites; Push + Email | No invites (above); push needs a service worker the app doesn't have yet |
| 20 | **Host updates only reach people in the plan** (replied, or signed up for something); "haven't replied" updates reach everyone else in the group | Every update to everyone | Otherwise the feed fills with plans you never touched |

## 2. Things the build had to invent (please design these properly)

- **App icon** for "Add to Home Screen": the gold bolt with rays (`#f3c55a` / `#e8a71c`) centred on a full-bleed `#5b4ae8` square, bolt at ~66% of the square (50% in the Android "maskable" version). iOS rounds the corners itself. The home-screen name is **Spark Hub**. A designed icon (and a splash look) would replace it.

- **The lead's Set the date pop-up** and **Got a date & time in mind?** still use one native date-and-time field, so on iPhone the time is a minute-by-minute wheel. Part B's date + 30-minute list fix was specified for the post flow only; should the pop-ups get the same two fields?
- **Titles already over 40 characters** keep their full text; editing one trims it to 40 on the first keystroke.

- **All ideas tabs:** Ideas / Plans / Happened with counts (Plans selected by default, green; Ideas gold; Happened purple); the page title follows the tab. Empty states: *No ideas yet.* / *No plans yet. When a lead locks in a date and time, it shows up here.* / *Nothing's happened yet. Plans move here the day after their date.*
- **Album layout by count:** 1 photo fills the card (186px), 2 sit side by side, 3+ use the big-plus-two mosaic with "+N".
- **Edit on plan and "It happened" pages** for the lead and admins (white pill, top right), so past events can still be fixed or deleted.
- **The host's "Before the day"** questions (4 prompts, "N of 4 thought through") are the build's wording; tap a row to answer, Enter to save.

## 3. Behaviour added in the build (no visual change)

- **Installable (PWA):** a web app manifest (`display: standalone`, start `/`, white theme and background) and the iOS home-screen tags. Opened from the home screen, there's no browser bar. On iPhone the home-screen app keeps its own sign-in, separate from Safari, so people sign in once more there. No service worker (no offline mode or push notifications) yet.

- Location suggestions now start at 2 characters (was 3), still debounced and cached; that uses more of the free 3,000 lookups a day, so worth watching.

- **Plans:** an idea is a plan when `planned` is set (a date and a time are required); it shows as **It happened** from the day after its date. Invite-only plans are hidden from the group except the lead, admins, people who replied and anyone with the link.
- **Updates and the day-before reminder are stored, not sent yet:** updates show on the plan page; delivery (notifications, email) comes in phases 3–4. The reminder switch saves the host's choice.
- **Signing up for something** needs a name (guests leave a name + number once, like "I'm interested"); items with a "how many" stop taking sign-ups when full (enforced in the database).

- **The notification feed is built in the app** from what's already stored (last 7 days); only read state and settings are saved (`notif_state`), so they follow you between the installed app and the browser. A reminder appears at 8am the day before (and on the day).

## 4. Designed but not built or not working

- **V5 phase 4 isn't built yet:** email (invites, host updates, day-before reminders). Push notifications aren't planned until the app has a service worker.
- **Next-step buttons** on You own cards open the plan or idea (as in the prototype); they don't jump straight to the action.
- **Home's action strip, "Your Groups" row and "Float an idea" card** are off, as in the README toggles.
- **"How this works" body copy** is still placeholder Latin (as designed).

## 5. Open questions for the next round

1. Everything in the README's **Open / not designed yet** list still stands (categories, first-run view for an empty group, removing members, leaving a group, lead notifications, Suggest vs Offer wording, first vs full names, group creation in the app, Welcome wording, the parked Lead note).
2. **Invite link screens** (§2b is a stopgap).
3. **A second owner by hand:** Joseph (torrez.fitness@gmail.com) is already a co-owner of Torrez Fitness, so the two-owner states (Remove / Step down) are reachable on live.
4. **Owner controls** (§2a): is a pill + text button per row right at 393px, or should roles move into a per-row menu?
5. **Google's sign-in screen** says "continue to …supabase.co" until Spark Hub has its own sign-in domain.
6. **Video on the vibe board** (2 photos + 1 short clip) is parked: phone videos can't be shrunk in the browser, so it would need a ~20 s / 25 MB cap and watching the free plan's bandwidth.
7. **Spark Hub address:** gosparkhub.vercel.app for now; a custom domain may follow.

## 6. Design tokens

As listed in the Full Site 4 README, except the page background (§1 #4) and the purple owner chip (§2a: `#ece9fd` / `#4a3ad4`).
