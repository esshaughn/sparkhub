# Handoff: Spark Hub — live build → Claude Design

**Direction:** code → design. This describes what's built, so the next design round starts from what shipped rather than from the design file.

- **Built (test):** https://gosparkhub-git-test-eric-5958s-projects.vercel.app · **Live:** https://gosparkhub.vercel.app
- **Source:** github.com/esshaughn/sparkhub (`index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, `supabase/templates/`)
- **Baseline:** Claude Design's reply "Handoff: Spark Hub, design → live build (2026-09-25)" and its `Spark Hub App.dc.html`, which adopted everything in the previous version of this doc (§1–§3) and added Part B (no chips in group menus, quieter pin, 40-character titles, iPhone date fix, 30-minute time list, and the Coming up **Show** menu with its new rows). Full Site 4's spec is still in `design/spark-hub/` for reference.
- **As of:** 2026-09-25, all of that reply is built (test branch)

Everything in that reply is built as specified, except what's listed below. Where this doc and the design files disagree, **this doc is correct**.

---

## 1. What changed since the design

| # | Change | Design said | Why |
|---|---|---|---|
| 1 | **No tab bar on Welcome** (it shows everywhere else, signed in or not) | Tab bar on every screen | Owner's request |
| 2 | **Welcome is a full-screen column:** the photo and scrim stay where Full Site 4 put them (photo 500px at `top:-70px`, scrim over the top 430px, both shifted down by the status-bar inset in the installed app); the **logo moves down to sit just above the headline** (14px gap); a 32px gap after the steps; the sign-in buttons are anchored to the bottom of the screen (22px + the home-indicator inset below *New here?…*). On short screens the text rides higher over the photo | Logo top-left, fixed 580px photo block, buttons right after it | Owner, on an iPhone 15 |
| 3 | **Tab bar spacing:** 13px above the icons; below them the iPhone home-indicator inset less 8px (at least 14px), so the bar isn't bottom-heavy. 73px on desktop as before | 73px + the full inset | Owner, on iPhone |
| 4 | **Under the iPhone status bar** (installed app): the page runs behind the status bar with white time/battery. Welcome, All ideas and idea-page photos extend up behind it (their top controls move down by the inset); screens with a white top (Home, Profile, How this works, Edit group, post/edit flows) continue the white behind it, so the white time/battery are hard to see there (owner accepted this for now; a dark strip and a soft fade were tried) | Not specified | Owner: "photo all the way to the top, light status icons" |

## 2. Things the build had to invent (please design these properly)

- **App icon** for "Add to Home Screen": the gold bolt with rays (`#f3c55a` / `#e8a71c`) centred on a full-bleed `#5b4ae8` square, bolt at ~66% of the square (50% in the Android "maskable" version). iOS rounds the corners itself. The home-screen name is **Spark Hub**. A designed icon (and a splash look) would replace it.

- **The lead's Set the date pop-up** and **Got a date & time in mind?** still use one native date-and-time field, so on iPhone the time is a minute-by-minute wheel. Part B's date + 30-minute list fix was specified for the post flow only; should the pop-ups get the same two fields?
- **Titles already over 40 characters** keep their full text; editing one trims it to 40 on the first keystroke.

## 3. Behaviour added in the build (no visual change)

- **Installable (PWA):** a web app manifest (`display: standalone`, start `/`, white theme and background) and the iOS home-screen tags. Opened from the home screen, there's no browser bar. On iPhone the home-screen app keeps its own sign-in, separate from Safari, so people sign in once more there. No service worker (no offline mode or push notifications) yet.

- Location suggestions now start at 2 characters (was 3), still debounced and cached; that uses more of the free 3,000 lookups a day, so worth watching.

## 4. Designed but not built or not working

- **"How this works" body copy** is still placeholder Latin (as designed).

## 5. Open questions for the next round

0. **Idea → Plan lifecycle** (parked by Design, brainstorm only): an idea is *gathering steam* until the lead sets a date and time, then it's a **Plan**. Open: what triggers the flip and whether the lead confirms, whether "I'm interested" becomes "I'm going", what happens if the date is cleared or passes, and where the phase shows.

1. Everything in the README's **Open / not designed yet** list still stands (categories, first-run view for an empty group, removing members, leaving a group, lead notifications, Suggest vs Offer wording, first vs full names, group creation in the app, Welcome wording, the parked Lead note).
2. **Invite link screens** (§2b is a stopgap).
3. **A second owner by hand:** Joseph (torrez.fitness@gmail.com) is already a co-owner of Torrez Fitness, so the two-owner states (Remove / Step down) are reachable on live.
4. **Owner controls** (§2a): is a pill + text button per row right at 393px, or should roles move into a per-row menu?
5. **Google's sign-in screen** says "continue to …supabase.co" until Spark Hub has its own sign-in domain.
6. **Video on the vibe board** (2 photos + 1 short clip) is parked: phone videos can't be shrunk in the browser, so it would need a ~20 s / 25 MB cap and watching the free plan's bandwidth.
7. **Spark Hub address:** gosparkhub.vercel.app for now; a custom domain may follow.

## 6. Design tokens

As listed in the Full Site 4 README, except the page background (§1 #4) and the purple owner chip (§2a: `#ece9fd` / `#4a3ad4`).
