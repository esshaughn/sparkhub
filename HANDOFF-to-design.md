# Handoff: Spark Hub — live build → Claude Design

**Direction:** code → design. This describes what's built, so the next design round starts from what shipped rather than from the design file.

- **Built (test):** https://gosparkhub-git-test-eric-5958s-projects.vercel.app · **Live:** https://gosparkhub.vercel.app
- **Source:** github.com/esshaughn/sparkhub (`index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, `supabase/templates/`)
- **Baseline:** Claude Design's **Spark Hub v6** handoff (Your tasks, Your schedule, the community Calendar, Profile and Notifications as sheets, the RSVP ask). Its README is `design/spark-hub/README-v6.md` and `design/spark-hub/Spark Hub App.dc.html` is the v6 prototype; the v5, v5 update and v5.2 READMEs sit beside it. Where v6 conflicts with a decision the owner already made, §1 says what was built.
- **As of:** 2026-09-27, v6 is built on the test branch

Where this doc and the design files disagree, **this doc is correct**.

---

## 1. What changed since the design

| # | Change | Design said | Why |
|---|---|---|---|
| 1 | **Invites are a share link, so nothing counts invites.** The Leading stats strip reads **Going · Maybe · Sign-ups · Reminder** (Maybe, with a question-circle icon, in place of Invited); there's no "N haven't replied · Nudge" and no "No one invited yet · Invite" to-do | Invited · Going · Sign-ups · Reminder; Nudge / Invite to-dos | Owner kept share links (2026-09-29) |
| 2 | **No "Set head count" to-do** on ideas; the People checkpoint uses the idea's minimum when it has one (demo ideas do), otherwise interested ÷ 10, capped below done | "Set head count · Set" | There's still no input for minimum people (§5) |
| 3 | **Ideas' third to-do is "No roles yet · Add roles"** (it only decides whether an idea shows under Ideas; the card shows the four checkpoints) | "No tasks yet · Add tasks" | Matches the v6 Roles → Helpers checkpoint wording |
| 4 | **Idea pages have a Sign-ups card** (between Location and the organizer card), so "Add essential roles" / "Get helpers" land somewhere; empty, the lead reads *What roles does this need? Add them now and people can grab one before there's a date.* | Not drawn on the idea page | v6's Roles/Helpers checkpoint opens the idea's sign-ups |
| 5 | **Plans show "Waiting on you"** (the lead's pending suggestions, same card as ideas) so "Hana's spot idea · Review" has somewhere to go | Only on ideas | Your tasks now lists these for plans |
| 6 | **Profile's Settings list has two rows**, Notifications and Privacy; Help & info has one, How Spark Hub works | Notifications, Calendar sync, Email, Privacy; more help rows | Owner (2026-09-27): no calendar sync, email is in-app only, nothing receives feedback yet |
| 7 | **Calendar sort "Most lively"** = going ×2 + maybe + sign-ups taken + updates, plus a boost for plans posted in the last 2 / 5 days | Also votes, suggestions and readiness (ideas) | The Calendar lists plans only, so the idea parts don't apply |
| 8 | **Event types** are guessed from the title only (keywords as in the prototype, plus taco/pie → Food & drink, run/5k → Fitness, hootenanny → Arts & crafts) | Title + tags | There are no tags yet; nothing is written to the data |
| 9 | **The Calendar header** uses the Walnut Creek group photo (the same parade shot as `walnut-creek-parade.jpg`, already resized in `photos/`) | `walnut-creek-parade.jpg` | Same photo, no second copy |
| 10 | **"Feeling wild?" cards** show the first three events in the current results (A♠ K♥ Q♣) | poker-night / paintball / pumpkin-nights photos | Always real events |
| 11 | **Your tasks' "Find something to help with"** opens the Calendar | Groups | The Calendar is where "could use a hand" lives |

## 2. Things the build had to invent (please design these properly)

- **Empty states:** Could use a hand with nothing open: *Everything's covered for the next two weeks.* Calendar with no results: *No events match these filters.* / *Nothing coming up in your groups yet.* (under a "Coming up" heading). Month view, a day with nothing: *Nothing on this day.* View all, empty: *Nothing here right now.*
- **Search with only type chips on** (no text) lists matching events; "No events match" then names the chips.
- **Helping sign-ups with no time** show no time on Your schedule's expanded rows (Your tasks falls back to the event's time).
- **Nav badges show "9+"** past nine.

## 3. Behaviour added in the build (no visual change)

- **URLs:** Your tasks is `/`, Your schedule `#/schedule`, Calendar `#/calendar`; `#/me` and `#/notifications` open the Profile / Notifications sheets over Your tasks. Your plans & ideas is still at `#/own` (off the tab bar). Following a link or the back button closes any open sheet.
- **The RSVP ask** shows after signing up for an item, adding your own item, claiming a role, or offering to help organize a plan — when you're not the lead and haven't said Going or Can't go. It can't be dismissed.
- **Calendar filters, search and "Feeling wild? / could use a hand" dismissals** last for the visit; the chosen view (List / Tiles / Month) is remembered per device.
- **Demo data:** `scripts/demo/seed-events.py` now also makes, dated from the day it runs, a plan today / tomorrow (reminder off) / two days ago and a Helpers-stage idea for each tester, plus two shared plans everyone helps on, so every v6 state shows.

## 4. Designed but not built or not working

- **The CTA pills on to-do rows** don't do their action; as in the prototype, tapping the rows expands them (3+) or opens the event.
- **"Include ideas"** on the Calendar (in the prototype's code, not the README) isn't built; the Calendar lists plans.

## 5. Open questions for the next round

1. Everything in the README's **Open / not designed yet** list still stands (categories, first-run view for an empty group, removing members, leaving a group, Suggest vs Offer wording, first vs full names, Welcome wording).
2. **A real invite list** (pick neighbors or the whole group) would bring back Invited on the stats strip, "haven't replied · Nudge" and "invited you" notifications — design it next? (v6 draws Invited again; §1 #1.)
3. **Minimum people** on ideas ("How many do you need?") has no input yet, so the People checkpoint rarely completes (§1 #2).
10. **Event types:** the placeholder keyword guesses are shown to people as filters; host-chosen tags (v6 open item) would replace them.
11. **Event preview slide-up** (v6 options 13a/13b/13c) is still undecided.
4. **Invite link screens** (the current sign-in-to-join flow is a stopgap).
5. **Owner controls** in the Members sheet: pill + text button per row at 393px, or a per-row menu?
6. **Google's sign-in screen** says "continue to …supabase.co" until Spark Hub has its own sign-in domain.
7. **Video on the vibe board** is parked (needs a ~20 s / 25 MB cap).
8. **Spark Hub address:** gosparkhub.vercel.app for now; a custom domain may follow.
9. **Send feedback / Ask a question:** where should these go (email to the owner, a form)? Until there's an answer they stay out of Help & info.

## 6. Design tokens

As listed in the v5.2 and v6 READMEs (v6 role colours: Leading `#5b4ae8` / `#f7f6ff` / `#4a3ad4`, Helping `#e8a71c` / `#fefaef` / `#8f6405`, Going `#149a4b` / `#f3fbf6` / `#0f7a3c`, not joined `#c3c7d0` / `#fafafb`) (ink `#0d1117`, inactive title `#c3c7d0`, inactive tab `#6b7280`, active tab `#5b4ae8`, page `#e8eaee`, purple `#5b4ae8` / `#4a3ad4` / `#eeebff`, green `#149a4b` / `#0f7a3c` / `#e7f6ec`, gold `#e8a71c` / `#f5b428` / `#8f6405` / `#fdf1d6`, red `#e2556b`; owner chip `#ece9fd` / `#4a3ad4`, admin chip `#fdf1d6` / `#8f6405`).
