# Handoff: Spark Hub — live build → Claude Design

**Direction:** code → design. This describes what's built, so the next design round starts from what shipped rather than from the design file.

- **Built (test):** https://gosparkhub-git-test-eric-5958s-projects.vercel.app · **Live:** https://gosparkhub.vercel.app (also https://sparkhub.wereallneighbors.org)
- **Source:** github.com/esshaughn/sparkhub (`index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, `supabase/templates/`)
- **Baseline:** Claude Design's **round v8-13** (zip *Spark Hub v8-13*, 2026-10-06; v8-12 before it: `design/spark-hub/Spark Hub App Version 8.dc.html` and `design/spark-hub/HANDOFF-to-CODE.md`). It approved rows 96–105, §2 and §3 of *HANDOFF-to-DESIGN-7*, so those are cleared; rows 106–114 (v8-7) stay until Design has seen them.
- **Build version:** **v7** (owner, 2026-10-02): a lead is a choice. Since v8-8 an idea is led from the start (*Who leads it · Me*) or floated (*I'll decide*), and both use the new idea page.
- **As of:** 2026-10-06 (latest: no counts on the RSVP buttons, row 124. Before that: built round **v8-13**'s *New since v8-12* list, table below). Before that: v8-12, v8-11 (migration `20261110000000_plus_ones.sql`), v8-10, then the prototype audit and *Owner calls that stand* (below). Earlier 2026-10-06: built round **v8-8**'s *New since v8-7* list (items 1–9, table below; migration `20261109000000_led_ideas.sql`). The *Answered* and *Already decided* items in the same file are listed in §4 until they're built.

## Start here (2026-10-06)

Your last catch-up was *HANDOFF-to-DESIGN-7* (baseline v8-6). Everything below is new since then, all **live** at sparkhub.wereallneighbors.org as of 2026-10-06 (v=246):

1. **Rounds v8-7 → v8-13**, each as a short table (newest first): what was built as drawn, and every place the build differs. v8-12 and v8-13 are the event header (4a + 8a) and where the overview lives. v8-11 added plus-ones (a database change), the guest flows, the Share link pop-up and the event QR.
2. **The prototype audit** (2026-10-06): ~60 spots where the prototype had been redrawn without a *New since* item, now matching.
3. **Owner calls that stand**: 13 spots where the owner chose differently and the prototype still draws the old version. Please redraw these.
4. **§1–§3**: rows 106–123 and the behaviour notes you haven't acknowledged yet, plus the 2026-10-06 privacy page and link-preview changes (§3).
5. **§4** what's designed but not built (group invites, the led-idea tools lost in v8-8, per-day multi-day pushes…) and **§5** the open questions (Q1–Q39 still open, newest Q36–Q39).
6. **New questions from the v8-10 and v8-11 tables:** the gold sheet keeping *See N more*; a *Private* chip on the Groups tab's Next up card (not a photo card in the build); *+N* and the hosts' note in Who's coming (built from your "not yet in the prototype" line, please draw it).

Where this doc and the design files disagree, **this doc is correct**. One file per side: please keep sending `HANDOFF-to-CODE.md`; this file is the reply (call it *HANDOFF-to-DESIGN-8*).

---

## Round v8-13 in short

*Built from HANDOFF-to-CODE v8-13 (New since v8-12) on 2026-10-06. The prototype was diffed against v8-12's: nothing changed beyond items 1–4.*

| v8-13 item | Status |
|---|---|
| 1. Overview always under the title | Done on the event page; What to expect lists only the quick details, and the lead's dashed prompt shows when there are none (it reads *Add up to three quick notes.* once there's an overview). The idea page is unchanged: its overview still leads What to expect |
| 2. QUICK OVERVIEW on Edit event | Done as drawn on upcoming events (not ideas, not past events, as in the prototype's `ph0 === 'plan'`). Same `overview` field: Save writes it only if it changed. Admins who aren't hosts save it too |
| 3. ⋯ menu: Invite people | Done, with the person-plus icon; opens the Invite people sheet |
| 4. Post update pill | Done |

## Round v8-12 in short

*Built from HANDOFF-to-CODE v8-12 (New since v8-11) on 2026-10-06. The prototype was diffed against v8-11's: nothing changed beyond items 1–4.*

| v8-12 item | Status |
|---|---|
| 1. Event header (4a + 8a) | Done on the plan page. Chip row only for CANCELLED and/or PRIVATE (the old DEMO chip stays there for demo events; there are none now). Date tile at the photo's top right, 88px + the phone's safe area from the top, +5°; multi-day fanned pages move with it. **Leads:** one white ⋯ → *Edit event* · *Share* · *QR code* (200px menu, 48px rows, tap outside closes). *Share* opens Invite people as before; *QR code* opens the QR pop-up **on its own**, and closing it closes everything. *QR code* is for hosts (lead and co-hosts); an admin who can edit but doesn't host sees *Edit event* · *Share*. **Everyone else:** just Share. Not changed by this round: the idea page and the *It happened* page keep the pencil + Share; a cancelled plan shows just Share (no ⋯) |
| 2. Where the overview shows | Superseded by v8-13 item 1. Was done. Overview only: 18px/500 white under the title, and What to expect is hidden for members; leads still get the dashed prompt, which reads *Add up to three quick notes.* when the overview is already in the header (build wording). Overview + details: it leads the What to expect card. One field, so editing either updates both |
| 3. What to expect edit sheet | Done: no *Both parts are optional.*, no 1 / 2 circles, no *Cancel or delete event* on this sheet (the other edit sheets keep it) |
| 4. Sample data | Prototype only: the build has no sample events any more (demo events removed 2026-10-03) |
| 5. Not picked (Led by in the header) | Not built |

## Round v8-11 in short

*Built from HANDOFF-to-CODE v8-11 (New since v8-10) on 2026-10-06 (migration `20261110000000_plus_ones.sql`). The prototype was diffed against v8-10's: nothing changed beyond items 1–5.*

| v8-11 item | Status |
|---|---|
| 1. Gold bar on idea cards (1e) | Done on the Ideas board's cards (inside the card's 6px white frame). The board has no full-tile view in the build, so only the grid has it (your full tiles don't draw it either) |
| 2. Bringing others (6a) | Done: *You're going!* after Going on a plan (members), stepper 0–10, *Who's coming with you? (optional)* (80) once above 0, green Done (then the going banner, or *You're going, plus N. See you there!*), *Invite others* · *Change RSVP*, scrim = Done. Saved as `plus_count` / `plus_note` on the reply; **every Going count includes them** (the RSVP button, cards, *N going*, Who's coming's GOING · N, the lead's impact). Built from your "not yet in the prototype" line: **Who's coming shows *+2* in green after the name**, and the hosts also see the note (*+2 · my kids*). The note field is 16px (iPhone zoom). Change RSVP closes and scrolls to the RSVP buttons |
| 3. Guests | Done: the stepper on the guest sheet (quieter row, as drawn), YOUR NAME + stepper in *When will you attend?* (*Add your name* → *RSVP as a guest*, *Have an account? Sign in*), *You're on the list, {first name}!* with the summary chips, Done, *Get a reminder · Sign in* · *Change RSVP*. It shows **once the reply is saved**, after a guest's Going **or Maybe** (it replaces the build's old *You're on the list* / *Create an account* alert). *RSVP to view guest list* with the lock replaces the grey faces and See all for visitors who haven't replied |
| 4. Invite people | Done: 5 people, max 94%, round Share link · round QR (hosts: lead and co-hosts) · Send. The Share link pop-up as drawn; More without a share sheet copies the message (*Invite copied. Paste it anywhere.*). The preview's date line is the build's (*Thu, Oct 15 · 6:30pm · Hunters Park*). On an idea, the QR button and both pop-ups are gold (owner call, see *Owner calls that stand*) |
| 5. Event QR | Done as drawn with the build's own QR encoder (error correction M, no CDN). On a phone that can share files, *Download PNG* opens the share sheet (Save Image) instead of downloading, like the group poster. New error toasts: *That QR code couldn't be made.* / *That QR code couldn't be saved. Try again.* |

## Round v8-10 in short

*Built from HANDOFF-to-CODE v8-10 (New since v8-9) on 2026-10-06. The prototype was diffed against v8-9's: nothing changed beyond items 1 and 2.*

| v8-10 item | Status |
|---|---|
| 1. Invite people, condensed (1c) | Done, purple for events and gold for ideas (your gold recolour: `#f5b428` Send and ticks with `#2a1d00` ink, `#8f6405` *✓ Invited* and *See N more*, `#b07a0a` link icon). Two changes: the search field's text is **16px, not 15px**, because an iPhone zooms the whole page into any input under 16px; and the gold sheet keeps **See N more / Show fewer** after three people (the prototype's gold sheet lists everyone), since a group can have dozens of members. *Share link* copies the link (✓ Copied, *Link copied*) where the phone has no share sheet |
| 2. *Private* chip | Done on the Up next hero (My calendar and group pages) and on photo tiles everywhere. **All groups' tiles already have the group chip top left**, so *Private* sits right after it in the same row. The **Groups tab's Next up card isn't a photo card in the build** (a 64px thumbnail row, 8b), so it has no chip: please say if it should get one, and where |
| 3. Settings button | Already white with the grey gear since v8-9 (our row 4 above): no change |

## Round v8-9 in short

*Built from HANDOFF-to-CODE v8-9 (New since v8-8) on 2026-10-06. The prototype was diffed against v8-8's too: nothing changed beyond these four items.*

| v8-9 item | Status |
|---|---|
| 1. Discussion, empty state | Done: no *No comments yet.*, just the box with 8px more under it |
| 2. Send update (1d) | Done: the pale-pink *Send update* pill by the Discussion heading, for leads of a plan; it carries what's typed. The *or* divider and link are gone |
| 3. Today chip | Done: solid green with the white dot on My calendar's and a group page's Up next hero |
| 4. Me page | Done as drawn: bell (with badge) back in the header, the impact pill first in the grey, *Your impact* sheet with more sparkles, no YOUR STUFF, the 72px My tasks row, the rows card, My tasks as a slide-up (44px from the top, ⌄ closes, Search, bell; it reopens after visiting an event), and the white Settings button where the + was. Its Search and bell open their sheets over it. Note: the audit earlier today had taken the bell off Me, as the v8-8 prototype had it; v8-9 brings it back |

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

## Audit 2026-10-06: the prototype vs the build

The owner found two prototype changes that were never built (the sparkle *Find more events* pill, Up next's closed task strips). Neither was in a *New since* list, and the build only builds from those lists. So the build was checked screen by screen against the v8-8 prototype. **Built to match it (no rows needed, it's now as drawn):**
- **My calendar:** *Find more events* pill (opens All groups on Month, all groups; Back returns to My calendar); 10 / 14 / 8px spacing; list cards 10×12px with an inset role bar; Month grid letters.
- **All groups:** Ideas strip *N interested · Take a look* and *Idea · no date yet*; Past strip *N went*; Helping strip shows your job count; Month day cards without the date block, no Plans pill on Month; no heading over an empty list; absolute dates on tiles; Needs help sheet (26px title, one-line empty card); Search follows the current group and Plans · Ideas · Past.
- **Event page:** ✎ on one job opens *Edit job* with just that job; Help out hidden once cancelled; Help pick sits above the When/Where card on a plan; visitor Discussion card and faces as drawn; *Cancel or delete event* under Save on every Edit sheet, *Turn it back into an idea* under it; single Take part spots as grey rows; Help pick *Nobody has voted yet*; Ask someone copy; *Lead · {spot}* in Who's going; Led by → the Leads sheet; Want a reminder? inside the RSVP card; the full name on a cancelled card; *TBD* under a date with no time.
- **Groups, Friends, Me:** Post an idea / Float an idea open the Float sheet (group page, Me's Ideas list, My tasks); My tasks' Ideas in gold; Settings has ACCOUNT (Privacy, Sign out, Delete my account) and HELP & INFO is three rows (the bell came back to Me in v8-9); the 312px FRIENDS ARE GOING cards; the profile pop-up's *{NAME} IS GOING TO* list and *Invite to…*; Invite friends picks, then *Invite to {event}*; the gold new-ideas dot on the Ideas tab; Group ⋯ is Invite · Search · Alerts and Invite opens the *Invite people* sheet (link card, Show QR code → *Scan to join*); no + on Friends; Join a group and Leave group copy; Place dropped (Q28), About 140 with a counter; the Members search field; *Get a new invite link* under the code too.
- **Ideas and Plan an event:** grey board; Create a poll as a centred pop-up (*Start poll · N options*); 46px Make this a plan rows in the slide-up; Who can see it lets the first group go too; Vote on a date opens the *Dates* list; *People RSVP for* card; Review shows the overview first; a growing Overview field; the smaller How long is it? card; *N interested ›* tappable at 0.

**Kept from the build, beyond the prototype:**
- **Scan to join** keeps *Save as image* / *Print poster* at the bottom; the poster had no other way in.
- **Numbered circles** only on Create a poll's date rows, as drawn.
- A **plan's open location poll** shows a grey *Location TBD* in the When/Where card.

**Not built:** changing an existing date's time in *Edit dates* needs a database change (votes hang off the date). It's on the list.

## Owner calls that stand

Never cleared on a reset. These are places where the owner chose differently from the design, and the prototype still draws the design's version. **Please redraw these spots to match**, or raise them in §5:

| Spot | The build (owner's call) | The prototype still draws |
|---|---|---|
| My calendar Up next | No *This week* heading: the hero, then months (2026-10-06) | *This week* |
| Up next task strips | Always closed until tapped, even on the day (2026-10-06) | Open on the day |
| Lead's task rows | **Fill 2 spots:** {job} with an *Ask* pill (2026-10-03) | *{job}: 2 spots to fill · 1 asked*, plain Ask |
| Undated / no place | Amber *TBD ?*, *Location TBD*, amber *Date TBD* heading | Grey *TBD —*, *Location to be decided* |
| A lead's missing location | The dashed *No location yet* box, no gold *1 thing left to decide* row (2026-09-30) | The gold row |
| All friends | No *Get a new friend link* (2026-10-03) | The link |
| Not in a group yet | *Join one with a code or link…* + Start a group (SOON) | *…or start your own.*, one button |
| Profile pop-up | Keeps the *BOTH IN {groups}* card (2026-10-01) | No groups card |
| Join in chips | A *Thought partner* chip (Jeni Wade's feedback, 2026-10-05) | Bring · Set up · Help · Clean up · Coordinate · Other |
| Tall date poll | Create a poll's date list stays tall (2026-10-02) | Fits content |
| Text fields | **16px text in every input** (search, *Who's coming with you?*…), never smaller: an iPhone zooms the page into anything under 16px (owner, 2026-10-06) | 15px search (v8-10), 14.5px note (v8-11) |
| Ideas are gold all the way | **Everything an idea opens is gold**, not just the page: Invite people's ticks, Send and both footer icons (QR too), the Share link pop-up (icons, Copy link) and the QR pop-up (toggle, Download PNG, Copy); hover `#e8a71c` (owner, 2026-10-06) | The QR icon purple on the gold sheet; purple Share link and QR pop-ups |
| Share for guests | **A guest's Share icon opens the Share link pop-up directly**, no sheet with just one *Share link* button; the same for anyone who can't invite and isn't a host (owner, 2026-10-06) | *Share this event* sheet with one button |

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
| 121 | **Recurring event and Runs across days are *Coming soon*** in How long is it?: dimmed, the line reads *Coming soon*, a tap toasts (amber) *Recurring event is coming soon* / *Runs across days is coming soon*. An event that already is one still shows it picked and can switch to another | (Answered Oct 6, as specced) | Built as specced; listed so the older-event case is known |
| 122 | **Short links are built as specced**, with these details: codes are 8 lowercase letters and numbers (no 0, 1, l or o, so they read clearly); on live every link uses sparkhub.wereallneighbors.org, on the test site its own address; the shared message is *{title} · {day}* (an idea: just its title; a past event keeps *…: here’s how it went.*); an invite-only or cancelled event gets the plain Spark Hub preview; a wrong code says *This link isn’t working · Ask whoever sent it for a new one.* and an old link after 2027-04-06 *This link has expired*. gosparkhub.vercel.app itself doesn’t redirect (installed apps open it); only its /i/ links do | Short links spec | Readability; a whole-domain redirect would break the installed app |
| 123 | **The visitor view is built as specced** (five grey faces, *See all ›* → the amber *RSVP to see who’s going*, the lead's first name with no profile, no Visibility card or group name, Discussion's count card, guest sheet 1c). Details: the guest sheet's account card and buttons turn gold for Maybe; for Can't it's only the name, and the link reads *Send · Only the lead sees your name.* *Continue with Google* shows only where Google sign-in is set up | 1c | Maybe in gold, as the note says; Can't has nothing to remind about |
| 124 | **No counts on the RSVP buttons**: Going · Maybe · Can't are one line each (52px tall); how many are going still shows through the faces and *See all ›* under them | Each button had its count under the label | Owner, 2026-10-06 |

## 2. Things the build had to invent (please design these properly)

- **Pick pop-up messages:** *That date has passed. Pick another.*
- **Make it a plan from an idea:** *That idea isn't there any more* (deleted while Review was open), *Pick a date first* (back to page 1).

## 3. Behaviour added in the build (no visual change)

- **Migration `20261109000000_led_ideas.sql`:** `make_plan()` moves everyone interested to **Maybe** (was Going) and pushes them once (topic *updates*); no group push for any idea now (floating is quiet, *Me* too), only for plans; on an idea the lead and people interested write in Discussion (on a plan, Going or Maybe as before); guests without an account can't read or write comments, and `comment_count()` gives the count.
- **Short links** (`20261109020000_link_codes.sql`): `sparks.link_code` is made by the database on insert (clients can't set or change it); `open_event(code)` opens an event by its code like a shared link; old `/i/{id}` links redirect (301) to `/e/{code}` until 2027-04-06 and then stop working; the link preview reads the event only (`event_preview`).
- **Comment notifications** (`20261109010000_comment_pushes.sql`, decided Oct 5): the hosts get a push for each comment or reply someone else writes (*Dee: Can I bring my kid?*), grouped per event within an hour (*3 new comments*, one notification that replaces the last); whoever wrote a comment, or the lead's update, gets *Lena replied: …* when someone replies. Pushes only, no bell row; test events stay quiet.
- **Who leads it · Me** saves the idea with its starter as lead (`wants_host` off); `lead_rule` is no longer used (*Anyone* is gone; older *Anyone* ideas behave as *I'll decide*).
- **Link previews and the privacy page (2026-10-06 audit):** chat-app preview cards (the default card, group invites, site photos) now name sparkhub.wereallneighbors.org instead of gosparkhub.vercel.app. The privacy page (not in the design) dropped the event map (there isn't one) and *start a group*, says guests give a first name and a phone only to claim a spot (seen by the lead and co-hosts, no texts), and adds *Your friends* and Discussion comments.
- **Post it from an idea** updates the idea's row (title, overview, details, location, date, visibility, cover through `set_idea_cover`), adds new jobs, then makes it a plan; date and location options stay, with their votes.

## 4. Designed but not built or not working

- **Decided in HANDOFF-to-CODE v8-8 but not built yet** (next): group invites (Q22 + Q33); Invite link 1b (Q4); showing sparkhub.wereallneighbors.org (Q8); NO DATE YET (Q23 3a); dropping Place (Q28); retiring `#/own` (Q29); Morning · Afternoon · Evening start times (Q34, waits on the prototype).
- **Led ideas lost what the old page had:** the vibe board (mood photos; plans keep it), co-leads and *Step back* (the starter's *I'll decide* stands in), Cancel (Delete is the quiet link at the bottom, not in Edit's ⋯), and editing What to expect's quick details (Edit changes title and description only). Where should they go? Kept from the old page, in the build's own way: quick details show as gold-dot lines under the description; the soft hold line (*Holding until… · Keep holding*) sits in When?; a group admin gets *Edit* by the IDEA chip (the title pop-up) and the *Delete this idea* link.
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
38. **Prototype details that look unintended. Which is meant?** (a) Maybe picked on the RSVP card: white text on the pale gold stripes (the build uses dark #2a1d00 so it reads). (b) A member's own job card ring is teal #9fd8d3, and the build's is gold; neither is the v8-6 orange. (c) *You're helping* rows are gold in the prototype; the build uses orange per v8-6. (d) Plan an event's Next has 14px corners beside a pill-shaped Back. (e) *+ Suggest a date* on an idea opens the old *Got a date & time in mind?* free-text pop-up; the build uses a date + time chips. (f) Review has no *People going can invite friends* switch (the build keeps it under Post to). (g) Tile dates for Helping / Maybe are green on My calendar. (h) All groups labels undated plans *Ideas · no date yet*. (i) The quick-detail dots: green 7px in Plan an event, gold 8px in the older flow.
39. **Choose a lead:** the prototype's *Choose* makes someone lead at once; the build asks them (Q32). Once someone else leads, the starter no longer sees Make this a plan, so the Lead row's *Change* can't be reached. Should the starter keep a way to change the lead?

## 6. Design tokens

As listed in the v8-5 INSTRUCTIONS, with v8-6's orange: purple `#5b4ae8`, ink `#0d1117`, greys `#6b7280` `#454b55` `#e8eaee` `#f2f3f6`, green `#149a4b`, gold `#f5b428` / `#8f6405` (ideas), orange `#e8661c` / `#b8480c` / `#fff1e8` (Helping, since v8-6; it replaced teal), pink `#d6246e` (updates). Idea screens are all gold.
