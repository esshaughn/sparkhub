# Handoff: Spark Hub — live build → Claude Design

**Direction:** code → design. This describes what's built, so the next design round starts from what shipped rather than from the design file.

- **Built (test):** https://gosparkhub-git-test-eric-5958s-projects.vercel.app · **Live:** https://gosparkhub.vercel.app
- **Source:** github.com/esshaughn/sparkhub (`index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, `supabase/templates/`)
- **Baseline:** Claude Design's reply "Handoff: Spark Hub, design → live build (2026-09-25)" and its `Spark Hub App.dc.html`, which adopted everything in the previous version of this doc (§1–§3) and added Part B (no chips in group menus, quieter pin, 40-character titles, iPhone date fix, 30-minute time list). Full Site 4's spec is still in `design/spark-hub/` for reference.
- **As of:** 2026-09-25, all of that reply is built (test branch)

Everything in that reply is built as specified, except what's listed below. Where this doc and the design files disagree, **this doc is correct**.

---

## 1. What changed since the design

Nothing yet.

## 2. Things the build had to invent (please design these properly)

- **The lead's Set the date pop-up** and **Got a date & time in mind?** still use one native date-and-time field, so on iPhone the time is a minute-by-minute wheel. Part B's date + 30-minute list fix was specified for the post flow only; should the pop-ups get the same two fields?
- **Titles already over 40 characters** keep their full text; editing one trims it to 40 on the first keystroke.

## 3. Behaviour added in the build (no visual change)

- Location suggestions now start at 2 characters (was 3), still debounced and cached; that uses more of the free 3,000 lookups a day, so worth watching.

## 4. Designed but not built or not working

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
