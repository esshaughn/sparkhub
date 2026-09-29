# Handoff: Spark Hub — live build → Claude Design

**Direction:** code → design. This describes what's built, so the next design round starts from what shipped rather than from the design file.

- **Built (test):** https://gosparkhub-git-test-eric-5958s-projects.vercel.app · **Live:** https://gosparkhub.vercel.app
- **Source:** github.com/esshaughn/sparkhub (`index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, `supabase/templates/`)
- **Baseline:** Claude Design's **Spark Hub v6** handoff plus **Update 2**, **Update 3**, **Update 4** and **Update 5** (Update 5: the event page's Plan phase rebuilt: You're helping sliver, three-button RSVP, date and map cards, Help out job cards with shifts and descriptions, Pick a shift, the You're on it / You're off it banners, no RSVP question after signing up; Update 4: Past scrapbook date stickers and a dismissable So far card, the Ideas board's sort row and plain step icons, the event page's Plan phase as option 39a; Update 3: no photo button on Your tasks, the new Post an event form; Update 2: Groups list and group pages redesigned: world switcher, Ideas board, Past scrapbook, group search; Sort · Filter on Your schedule and group Plans; Calendar search's Try chips and "Or something unexpected"; the compact Profile sheet). The READMEs are `design/spark-hub/README-v6.md` and `design/spark-hub/README-v6-update-2.md` `README-v6-update-3.md`, `README-v6-update-4.md` and `README-v6-update-5.md`; `design/spark-hub/Spark Hub App.dc.html` is the Update 5 prototype. Where the design conflicts with a decision the owner already made, §1 says what was built.
- **As of:** 2026-09-28, v6 Update 5 is built

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
| 6 | **Profile's Help & info has two tiles** (How Spark Hub works, Notification settings) and **Settings two rows** (Notifications, Privacy) | Help & info: + Ask a question, Send feedback; Settings: + Calendar sync, Email | Owner (2026-09-27): no calendar sync, email is in-app only, nothing receives feedback yet |
| 7 | **Calendar sort "Most lively"** = going ×2 + maybe + sign-ups taken + updates, plus a boost for plans posted in the last 2 / 5 days | Also votes, suggestions and readiness (ideas) | The Calendar lists plans only, so the idea parts don't apply |
| 8 | **Event types** are guessed from the title only (keywords as in the prototype, plus taco/pie → Food & drink, run/5k → Fitness, hootenanny → Arts & crafts) | Title + tags | There are no tags yet; nothing is written to the data |
| 9 | **The Calendar header** uses the Walnut Creek group photo (the same parade shot as `walnut-creek-parade.jpg`, already resized in `photos/`) | `walnut-creek-parade.jpg` | Same photo, no second copy |
| 10 | **"Feeling wild?" cards** show the first three events in the current results (A♠ K♥ Q♣) | poker-night / paintball / pumpkin-nights photos | Always real events |
| 11 | **Your tasks' "Find something to help with"** opens the Calendar | Groups | The Calendar is where "could use a hand" lives |
| 12 | **The Calendar is the home screen.** Signing in, the logo, back with no history, closing the post flow and deleting a group all land on the Calendar; the tab bar is still the v6 five | Your tasks is the home screen | Owner (2026-09-27) |
| 13 | **"How Spark Hub works"** (Profile → Help & info) has real copy: the three steps from Welcome (Post an idea · People pitch in · It happens) and three "Good to know" notes (groups are private, leads stay in charge, Your tasks keeps track) | Placeholder text in the prototype | It shipped with lorem ipsum |
| 14 | **Calendar with no groups** shows one card ("You're not in a group yet · Join with a code"); the header reads *Join a group to see its events* and the empty "Coming up" list is hidden | Not designed (first-run view is open) | Three empty states stacked |

| 15 | **Reactions are real** (saved per person): ❤️ 🙌 🎉, 🙏 thanks and "Let's do it again!" start at 0 and count people. Tapping one while signed out asks you to sign in | Counts derived from the event as placeholders | Update 2 says to use real data when available; it's now stored (`reactions`) |
| 16 | **The Groups header photo** is the first of your groups that has one (pinned first), framed as that group's cover | `torrez-group.jpg` | People in other groups shouldn't see Torrez Fitness's photo |
| 17 | **The Past "photos" number** counts each event's cover photos and album photos; *showed up* counts Going RSVPs | Not defined | |
| 18 | **The add-photo button on a memory card** adds to that event's album (same as *+ Add yours* on It happened) | Prototype toast "Opening your photos…" | |
| 19 | **Ideas board sort "Almost there"** counts the four checkpoints that are done (ties: most interested); **Newest** is by when it was posted | By number of steps done (the board has four) | |
| 20 | **Post an event keeps the 30-minute time list** (6:00 pm default) and the location suggestions under Where | A plain time input; a plain text input | Same choices as before; the suggestions save the address for directions |
| 21 | **Post an event's name placeholder** reads *Enter event title* | *What’s happening?* | Owner (2026-09-28) |
| 22 | **No new pickleball demo event** (`p3x`, Saturday pickleball round robin) | Add it to the demo data | Owner (2026-09-28): use the existing content |
| 23 | **Only one demo event shows shifts and descriptions** (*Street tree planting*, shared by every tester: a described *Set up the tool table* 8:30 – 9:00am and *Water the new trees* in two shifts); every other demo sign-up keeps its name, count and time | All 26 planned events get the prototype's sign-ups (times, descriptions, 9 two-shift jobs) | The prototype's sign-ups differ from the live content, which stays as it is (README: don't change content) |
| 24 | **Your guest list** keeps its three counts (Going · Maybe · Can't make it) | Four tiles | Invites are share links (§1 #1) |
| 25 | **The Where card's map** is a Geoapify static map (OpenStreetMap, attribution on the image) with the purple pin; tapping it opens directions. No map when the place has no coordinates (typed by hand, not picked); Directions then searches the address | A placeholder map | Same provider as the location suggestions |
| 26 | **RSVP counts** are real RSVPs (Going / Maybe / Can't), yours included | Going = interested count; Maybe / Can't from invite stats | Interest turns into Going when an idea becomes a plan; invites aren't counted |
| 27 | **Your tasks and Your schedule headers have Search** (a 44px `#f2f3f6` circle with the search icon, left of the bell), opening the Calendar's search sheet | Title and bell only | Owner (2026-09-28) |
| 28 | **The bell's red badge has no white ring** | 2px white border | Owner (2026-09-28) |
## 2. Things the build had to invent (please design these properly)

- **Empty states:** Could use a hand with nothing open: *Everything's covered for the next two weeks.* Calendar with no results: *No events match these filters.* / *Nothing coming up in your groups yet.* (under a "Coming up" heading). Month view, a day with nothing: *Nothing on this day.* View all, empty: *Nothing here right now.*
- **Search with only type chips on** (no text) lists matching events; "No events match" then names the chips.
- **Helping sign-ups with no time** show no time on Your schedule's expanded rows (Your tasks falls back to the event's time).
- **Nav badges show "9+"** past nine.
- **Help out, host tools:** the host (and whoever added a *something else*) gets a 28px gray **✕** on each job card, before the button, to remove it (*Remove "…"?* confirm). The open add card has a small ✕ to cancel; the host's version also has a *How many* box and, once something's typed, *Time (optional)* with the 30-minute list. A job with no *how many* shows *N in* instead of the dashes.
- **Pick a shift** rows (built from the screenshot): 22px circle (purple with a white check when picked), time 16px/800, *n of need* / *Full* on the right, a 4px segmented bar underneath; a picked row gets a lavender `#f7f6ff` fill and a 2px purple ring. Full rows are dimmed and can't be picked unless you're in them. Close ✕ top-right.
- **Find a replacement** opens the share sheet titled *Find a replacement*, quoting the message, with **Send the message** (the phone's share sheet, or copy).
- **Could use a hand** rows for a shift add its time: *6:00 – 7:00pm · 1 of 1 open*.

- **It happened page: a Reactions card** under the album (eyebrow *REACTIONS*; ❤️ 🙌 🎉 🙏 chips as on the memory cards, lavender `#f3f1fe` with a `#9d93f7` ring when yours). Below: *Thanks from Hal, Omar and 2 more.* or, before anyone thanks, *🙏 sends {lead} a public thank-you.* (not shown to the lead). This is where the 🙏 on a memory card leads.
- **Empty filters on Your schedule and group Plans:** the heading reads *Coming up* (Soonest) or the sort's name, then the design's *No events match these filters.* card.
- **Search "Or something unexpected" with nothing to pick** (e.g. no outdoor events): an error toast *Nothing like that yet* (Calendar) / *Nothing like that here yet* (group).
- **Swiping between Ideas · Plans · Past** (owner, 2026-09-28): the group page follows your thumb as soon as a sideways drag starts, with the neighbouring tab (its own background: graph paper for Ideas, `#e8eaee` otherwise) sliding in beside it. Let go past 40% of the width, or flick, and it carries on to that tab; otherwise it springs back (140–260ms, `cubic-bezier(.2,.8,.2,1)`). Past the first or last tab the page only gives 30% of the drag. The edge arrows fade out while dragging. Quiet edge arrows show where there's a neighbour tab: 26×44px half-pills against the screen edge, `rgba(255,255,255,.72)` with blur, a 16px `#454b55` chevron, 75% opacity, at 58% of the screen height; every 3.2s they nudge 5px toward the middle and back. Tapping one switches tabs. Please design these properly.

- **View as a tester** (owner, 2026-09-28; demo admin only): a Profile card *View as a tester* (*See the app the way a tester does when they sign in. Look only. Only you can see this.* · **Pick one** → rows of testers: face, name, email · N groups). While on: a dark `#1f2433` pill above the tab bar, *Viewing as {name}* + a gold `#ffd98a` **Exit**; Profile shows *Viewing as {name}* · *Look only. Nothing you tap changes anything.* · **Exit**; any change shows the toast *You're viewing as {first name}, so nothing changes. Exit to make changes.*

## 3. Behaviour added in the build (no visual change)

- **Remembered on this device:** the Past *So far* card's X (per group) and the event page's *You're helping* open / closed (per event; closed until you open it). The Ideas sort lasts for the visit.
- **Undo** on *You're on it* after adding *something else* removes the item you added (not just your name on it).

- **Deleting an idea** returns you to the screen you opened it from (the Calendar if none).
- **URLs:** the Calendar is `/` (and `#/calendar`), Your tasks `#/tasks`, Your schedule `#/schedule`; `#/me` and `#/notifications` open the Profile / Notifications sheets over the Calendar. Your plans & ideas is still at `#/own` (off the tab bar). Following a link or the back button closes any open sheet.
- **Calendar filters, search and "Feeling wild? / could use a hand" dismissals** last for the visit; the chosen view (List / Tiles / Month) is remembered per device.
- **Demo data:** `scripts/demo/seed-events.py` now also makes, dated from the day it runs, a plan today / tomorrow (reminder off) / two days ago and a Helpers-stage idea for each tester, plus two shared plans everyone helps on, so every v6 state shows.

- **Search Try chips** set a filter for the search only (This weekend = the coming Friday to Sunday; Needs helpers = open sign-ups) and are cleared when the sheet closes. Search matches upcoming plans only (the Calendar's scope); group search covers ideas, plans and past events.
- **Sort and Filter** on Your schedule and on group Plans last for the visit; the group Plans view (Tiles / List) is remembered per device, as before.
- **Reactions:** "Let's do it again!" counts once per person (tapping again does nothing); the others toggle.

## 4. Designed but not built or not working

- **"We'll let {Host} know"** (You're off it): nothing is sent yet. Notifications are built from what's stored, so the host just sees one fewer name on the job.
- **Adding descriptions, time ranges and shifts:** only the host can, and there's no form for it yet (still open in the design), so today they come from the demo data.
- **Say hi** on the Hosted by card: there's no messaging yet, so it shows a toast *Messages are coming soon. For now, say hi to {first name} at the event!*

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

12. **Your place, bio and "member since"** are no longer shown anywhere for yourself (Update 2 keeps them "for viewing other people", which isn't designed or built yet). Design a public profile view, or show them somewhere on your own sheet?
13. **Reactions on It happened:** is the build's Reactions card right, or should the page get its own design (and a list of who thanked)?

## 6. Design tokens

As listed in the v5.2 and v6 READMEs (v6 role colours: Leading `#5b4ae8` / `#f7f6ff` / `#4a3ad4`, Helping `#e8a71c` / `#fefaef` / `#8f6405`, Going `#149a4b` / `#f3fbf6` / `#0f7a3c`, not joined `#c3c7d0` / `#fafafb`) (ink `#0d1117`, inactive title `#c3c7d0`, inactive tab `#6b7280`, active tab `#5b4ae8`, page `#e8eaee`, purple `#5b4ae8` / `#4a3ad4` / `#eeebff`, green `#149a4b` / `#0f7a3c` / `#e7f6ec`, gold `#e8a71c` / `#f5b428` / `#8f6405` / `#fdf1d6`, red `#e2556b`; owner chip `#ece9fd` / `#4a3ad4`, admin chip `#fdf1d6` / `#8f6405`).
