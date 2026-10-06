# Handoff: Spark Hub — live build → Claude Design

**Direction:** code → design. This describes what's built, so the next design round starts from what shipped rather than from the design file.

- **Built (test):** https://gosparkhub-git-test-eric-5958s-projects.vercel.app · **Live:** https://gosparkhub.vercel.app (also https://sparkhub.wereallneighbors.org)
- **Source:** github.com/esshaughn/sparkhub (`index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, `supabase/templates/`)
- **Baseline:** Claude Design's **round v8-8** (zip *Spark Hub v8-8*, 2026-10-06: `design/spark-hub/Spark Hub App Version 8.dc.html` and `design/spark-hub/HANDOFF-to-CODE.md`). It approved rows 96–105, §2 and §3 of *HANDOFF-to-DESIGN-7*, so those are cleared; rows 106–114 (v8-7) stay until Design has seen them.
- **Build version:** **v7** (owner, 2026-10-02): a lead is a choice. Since v8-8 an idea is led from the start (*Who leads it · Me*) or floated (*I'll decide*), and both use the new idea page.
- **As of:** 2026-10-06: built round **v8-8**'s *New since v8-7* list (items 1–9, table below; migration `20261109000000_led_ideas.sql`). The *Answered* and *Already decided* items in the same file are listed in §4 until they're built.

Where this doc and the design files disagree, **this doc is correct**. One file per side: please keep sending `HANDOFF-to-CODE.md`; this file is the reply (call it *HANDOFF-to-DESIGN-8*).

---

## Round v8-8 in short

*Built from HANDOFF-to-CODE v8-8 (New since v8-7) on 2026-10-06.*

| v8-8 item | Status |
|---|---|
| 1. Led ideas (Q31 1a + 1b + 1e) | Done: every idea uses the new page. The lead gets the starter's slide-up and page (✎ Edit, N interested + Share, Make this a plan, then When? / Where?, Help out, Take part, Discussion, WHERE IT GOES); members get 8b with the *LED BY · Picking a date / Picking a location* card under the description, and Help out, Take part and Discussion. *Led by you* / *Led by {first}* replaces *Floated by*. Changes: rows 115–118 |
| 2. *Make it a plan!* button | Done as drawn (gradient, six sparkles, 54px) |
| 3. Make it a plan → Review, prefilled | Done: title, description as the overview, cover, picked date and time, picked location and its address; a past date rolls to next year; no readable date opens page 1. Post it turns the idea into that event (same record) and toasts *It's a plan! We told the N people interested.* Everyone interested moves to **Maybe** and gets one push, *{title} is on: {date}* (built, 1e). Row 119 |
| 4. Pick / Add pop-ups | Done: *Pick a date* / *Pick a location*, radio rows with votes and time, top one picked, gold Confirm (grey until something's picked or typed), *Date set* / *Location set*. Row 115 |
| 5. One option isn't a poll | Done: *Suggested* page or row, no ticks or votes, no *Choose all dates…*, no *When would you attend?*; Make this a plan reads *Suggested: {x}*; the pop-up *Confirm the suggested date / location.* |
| 6. Who leads it: I'll decide · Me | Done on the Float sheet and the starter's page, ⓘ copy as drawn. *Me* = the starter leads now; switching back to *I'll decide* looks for a lead again. Row 117 |
| 7. Review page | Done: no REVIEW eyebrow, the card is titled *Review*, a photo header gets the purple-pink tint (on every step, as the prototype has it) |
| 8. Location name + Address | Done; the address shows under the name on Review and the event page. Row 120 |
| 9. Discussion behind sign-in | Done: signed out, guests who RSVP'd too, a count card *N posts · Sign in to read and join in* that opens sign-in. The database hides comments from guests as well |

---

## Round v8-7 in short

*Built from HANDOFF-to-CODE v8-7 on 2026-10-06 (migration `20261108000000_multi_day.sql`).*

| v8-7 item | Status |
|---|---|
| 1. Event length (23c-2) | Done: *Date & time · {type} ⌄*, the How long is it? pop-up with its four radio cards and Done, One day (quiet grey *+ Add end time*), Recurring (REPEATS, UNTIL (optional), green line), Runs across days (STARTS / ENDS, *3 days · Fri to Sun*), Separate days (one line a day, Day 2 has no ×, *+ Add another day*, 30 at most, each date picker starts after the day before, People RSVP for). The same fields and pop-up are in the event page's Edit (rows 106–107) |
| 2. Date & time pickers | Done: every time field is typeable with *Try a time like 10am or 4:30pm*, and its chevron opens the 30-minute list (6am–11:30pm); the white month card everywhere. Change: no *Type a time* box inside the list (row 108) |
| 3. Review / labels | Done: *Sat–Sun, Oct 10–11 · 2 days*, *Thu, Oct 8 · 6:30pm · Weekly* |
| 4. Event page, multi-day | Done: two fanned pages (−6° / +8°), the timeline and *You're going Sat · maybe Sun · Change*. Add to calendar: one entry per day for separate days; a span and a repeat are one entry each (row 109) |
| 5. Each day RSVP (24c) | Done as drawn: When will you attend?, the summing button, *Pick at least one day*, *I can't make it* after clearing. Guests get it too |
| 6. Who's coming | Day tags done; the build keeps its Going / Maybe / Can't sections (row 110) |
| 7. Jobs tied to a day | Done: WHICH DAY in Add a job and Edit what you need, *Sat · 9:00 – 10:00am*, holding a job adds that day; *Added Sunday to your RSVP* (from *Decided*) shows when you'd already picked days |
| 8. My calendar | Done: the hero's *SAT, OCT 10 · 2 DAYS*, *Day 1 of 2 · 10am–4pm* on cards, Month view on every day (only your days once you've picked). Up next and Tiles list an event once, on its next day (row 111) |
| 9. Help out | Done: orange *✓ You're in*, the member's button centred, no *Add something else* for members |
| 10. Invite pop-up | Done: *Invite people* after posting too, the new line, 3 people + *See N more* / *Show fewer* |
| 11. Leave prompt | Done: centred *Pick this up later?* |
| 12. Event preview | Removed everywhere: tapping an event opens its page |
| 13. Demo event `md2` | Not added: there's no demo content since 2026-10-03 (owner) |
| *Decided, not built* | Built: a reminder before each day you're going (for a repeat, before each date; a span, before its first day) and guests' pop-up. Not built yet: telling only that day's people when a day moves or is cancelled, and Tasks filtered to your days (§4) |

---

## 1. What changed since the design

(Numbers continue from before the reset.)

| # | Change | Design said | Why |
|---|---|---|---|
| 106 | **The event page's Edit (Date, time & location) has the same Date & time fields** as Plan an event, with *· {type} ⌄* beside DATE & TIME and the How long is it? pop-up | v8-7 drew them in Plan an event only | A posted event can change length too |
| 107 | **Day rows use compact fields**: dates read *Oct 10* (no weekday) inside DAY 1 / DAY 2 rows; a × on Day 3 onwards sits at the right of its DAY N label | One-line rows | Three fields fit a phone row |
| 108 | **Every time picker is the field itself plus a scrolling 30-minute list** (6am–11:30pm; an end time lists only later times; it opens on the picked time, or 9am). The Set time chips (Float an idea, date polls, suggesting a date) use the same field instead of the phone's own picker. There's no *Type a time* box inside the list: you type in the field. Typed times show with minutes (*10:00am*) | A *Type a time* box + Set at the top of each list | Owner, 2026-10-06: back to the list (the am/pm · hour · minute grid from 2026-10-03 is gone); one place to type is enough |
| 109 | **Add to calendar for a span or a repeat makes one entry**: a span runs from its first day to its last; a repeat is one entry that repeats (Weekly / Every 2 weeks / Monthly, until its end date). Separate days get one per day you're going, with the toast *Added Sat & Sun to your calendar (2 entries)* | One entry per day | Calendars handle spans and repeats themselves |
| 110 | **Who's coming keeps its GOING / MAYBE / CAN'T sections**; the green day tag sits on the right of each name | One list | The sections were already there; the tag says the rest |
| 111 | **Up next and Tiles list a multi-day event once**, on its current or next day (*Day 2 of 2 · 12pm–5pm* once Day 1 has passed); Month view puts it on each day, and a repeat on each of its dates in that month | Every day | A weekend event twice in one list looked like two events |
| 112 | **A recurring event's date card** has a green line under the time: *Every Thursday until Dec 3* | (Not drawn on the event page) | Says how it repeats |
| 113 | **A repeat keeps going**: it counts as upcoming on its next date, until its end date | — | It would otherwise drop into Past after the first date |
| 114 | **Members can't add their own jobs on ideas either**: an idea with nothing on Help out reads *Nothing on the list yet.* | — | Item 9 took *Add something else* away |
| 115 | **Pick writes the date or location onto the idea straight away** (Make this a plan ticks), and the poll stays open with its votes until Make it a plan; Change reopens the pop-up on the current pick | Picked in the checklist until the plan is made | Members see what's been picked, and leaving halfway loses nothing |
| 116 | **Make it a plan! needs a date, a location and a lead**; the grey button names the first missing one: *Add a date first*, *Add a location first*, *Choose a lead first* | *Add a date first* | As the HANDOFF says (all rows ticked) |
| 117 | **Only the starter sees Who leads it.** Someone who took the lead later gets the lead's view without the switch | (Not drawn) | The switch is the starter's choice |
| 118 | **A led idea's Help make this a plan** keeps Invite a friend, Vote on a date (*Suggest a date* while there's one or none), Suggest a location; no Lead it / Offer to lead or Talk it through rows | 1a drops Talk it through | It already has a lead |
| 119 | **× on Plan an event opened from Make it a plan! just closes** (no *Pick this up later?*) | (Not drawn) | The idea is still there; a draft would make a second event |
| 120 | **Picking a suggested place fills Location name and Address**; renaming keeps the address. A typed address is saved as typed (no map pin) | Two plain fields | The place search was already on that field |

## 2. Things the build had to invent (please design these properly)

- **Discussion count card** (signed out): a white 20px-radius card, lavender bubble icon, *N posts* (16px 900) over *Sign in to read and join in* (13.5px, grey), chevron; sign-in opens with *Sign in to read the discussion and join in.*
- **Pick pop-up messages:** *That date has passed. Pick another.*
- **Make it a plan from an idea:** *That idea isn't there any more* (deleted while Review was open), *Pick a date first* (back to page 1).

## 3. Behaviour added in the build (no visual change)

- **Migration `20261109000000_led_ideas.sql`:** `make_plan()` moves everyone interested to **Maybe** (was Going) and pushes them once (topic *updates*); no group push for any idea now (floating is quiet, *Me* too), only for plans; on an idea the lead and people interested write in Discussion (on a plan, Going or Maybe as before); guests without an account can't read or write comments, and `comment_count()` gives the count.
- **Who leads it · Me** saves the idea with its starter as lead (`wants_host` off); `lead_rule` is no longer used (*Anyone* is gone; older *Anyone* ideas behave as *I'll decide*).
- **Post it from an idea** updates the idea's row (title, overview, details, location, date, visibility, cover through `set_idea_cover`), adds new jobs, then makes it a plan; date and location options stay, with their votes.

## 4. Designed but not built or not working

- **Decided in HANDOFF-to-CODE v8-8 but not built yet** (next): short links `/e/{code}` and the visitor view (count-only Who's coming, grey faces, Led by not tappable, guest sheet 1c, link preview tags, .ics); *Coming soon* on Recurring / Runs across days; group invites (Q22 + Q33); comment notifications; Invite link 1b (Q4); showing sparkhub.wereallneighbors.org (Q8); NO DATE YET (Q23 3a); dropping Place (Q28); retiring `#/own` (Q29); Morning · Afternoon · Evening start times (Q34, waits on the prototype).
- **Led ideas lost what the old page had:** the vibe board (mood photos; plans keep it), co-leads and *Step back* (the starter's *I'll decide* stands in), Cancel (Delete is the quiet link at the bottom, not in Edit's ⋯), and editing What to expect's quick details (Edit changes title and description only). Where should they go? Kept from the old page, in the build's own way: quick details show as gold-dot lines under the description; the soft hold line (*Holding until… · Keep holding*) sits in When?; a group admin gets *Edit* by the IDEA chip (the title pop-up) and the *Delete this idea* link.
- **The gold Invite people sheet** for ideas.
- **Guest text reminders** (*Take part*): not built, no SMS service yet (owner, 2026-10-05).
- **Leading filtered to a group** is built, but nothing opens it that way.
- **Maybe's pale-green tile chip** shows on the strip only.
- **v8-7 *Decided*, not built yet:** a lead moving or cancelling one day (push only to that day's people, who re-pick); Tasks filtered to your days.

## 5. Open questions for the next round

(Numbers kept from before the reset; v8-8 answered 4, 8, 18, 21, 22, 23, 28, 29, 31, 33, 34 and 35.)

1. Everything in the README's **Open / not designed yet** list still stands (categories, first-run view for an empty group, Suggest vs Offer wording, first vs full names).
6. **Google's sign-in screen** says "continue to …supabase.co" until Spark Hub has its own sign-in domain.
7. **Video on the vibe board** is parked (needs a ~20 s / 25 MB cap).
9. **Give feedback:** *Ask a question* as a separate thing, and whether feedback should also be reachable from Welcome or the invite landing.
10. **Your place, bio and "member since"** aren't shown anywhere for yourself. A public profile view, or somewhere on Me?
12. **How Spark Hub works** (Me, SOON): the copy still needs a home now that the screen is gone (Design's Q12).
15. **Consistency audit, held by the owner (2026-10-01):** one sort and filter control on every list, the same view names and order, one date style, one undated wording, one empty-state button label.
16. **Test events:** they share the seeded content's *DEMO* pill, and the host can't switch one to real after posting.
19. **Pop-up heights:** one rule for pop-ups with drop-downs?
24. **Joseph and Cynthia's feedback:** (e) *Start here* stays parked; (f) telling people an event link works without joining the group; (g) later: a per-event chat for on-the-day changes.
26. **A welcome tour** (parked by the owner): `WELCOME-TOUR-for-design.md`.
32. **Lead it / Offer to lead** for members (was row 82) and the starter's *Pick* (was row 83) are the build's stand-ins. Please draw them with BRIEF-float-the-idea, including what the person who offered sees while they wait.
36. **Recurring events (v8-7):** one RSVP covers every date and jobs aren't per date. Should people answer date by date (like Each day), and should a weekly event show on My calendar's Up next more than once?
37. **Led ideas (§4):** where do the vibe board, co-leads / Step back, Cancel and editing quick details go on the new idea page?

## 6. Design tokens

As listed in the v8-5 INSTRUCTIONS, with v8-6's orange: purple `#5b4ae8`, ink `#0d1117`, greys `#6b7280` `#454b55` `#e8eaee` `#f2f3f6`, green `#149a4b`, gold `#f5b428` / `#8f6405` (ideas), orange `#e8661c` / `#b8480c` / `#fff1e8` (Helping, since v8-6; it replaced teal), pink `#d6246e` (updates). Idea screens are all gold.
