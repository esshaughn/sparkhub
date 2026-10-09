# Backlog

Parked work. Newest first. When you pick something up, move it to a branch and delete it here once it ships.

## Plan an event page: owner's polish list (2026-10-07)

**Location**
- Name and address reported glitchy or **swapped** (someone's report). Audit how the pick fills `spot` vs `spot_address`.
- **The suggestions drop-down isn't on the one-page form yet.** Location suggestions moved from Geoapify to Google Places (New) on 2026-10-09 (key in `js/config.js`) because the owner wasn't happy with Geoapify's results.
- **No pop-up for location:** tap the field and type. Typing an address should find it (ideally filling the place name, e.g. *Activate*); the name is an optional extra (*Add a name for the place*). Research what Partiful / Luma / Apple Invites do first.
- **List view shows only the place name or street**, never city, state and ZIP. Standardize how an address is stored and shortened.
- The Add location pop-up's layout looks off (moot if the pop-up goes).

**Date and time**
- **Type it in place, no pop-up** (Auburn also expected to type: "7" → *7:00 am · 7:30 am · 7:00 pm*).

**Copy and look**
- *Optional* tags: lighter gray.
- The description field under *What's the plan?* can be taller.
- The page is washed out (white and gray everywhere): hard to see what's what. Example filler text in empty fields (e.g. under *What you need*).
- Public / Private is fine; tidy it.

**Add a sign-up**
- The pop-up looks good. *Write your own* can go now that the chips cover it (owner to confirm).
- **Example filler on the empty sign-ups section** (owner): show what a sign-up looks like before any are added, e.g. *Bring a carton of eggs · Help set up the tent · 3 spots*, so people see how ways to help or take part work.
- Shorten or drop the helper lines (*Most per person*, *People can sign up for as many as they like*, *First in line gets the next open spot*, *People without an account with a name and phone*).

## Ideas section: owner's audit list for 2026-10-08

From the owner using the idea page (2026-10-07). Investigate first; some may be bugs, some design.

**Bugs to look into**
- **Keep holding does nothing.** The voting card reads *Holding until Wednesday, October 14 · Keep holding*; tapping it has no visible effect. Audit: does the renewal save, does the date move, does the UI refresh?
- **Can't set or edit a location.** *Where → Change* only lets you pick from suggested places; you can't add your own or edit a suggestion. (*When → Edit* does let you add a date.) Both should allow your own entry and editing a suggestion.
- **The idea's description is cut off** on the idea page, though the whole text was entered (and the limit felt short anyway). The edit box shows more than the page does; maybe smaller text on the page so the whole overview fits.
- **Date: start rough, narrow down** (owner, 2026-10-07; from Steven and Joseph's session 2026-10-06). Under Date in Plan an event (and the float sheet): **Set a date** plus **More options ›**, opening one sheet: pick a date · poll a few dates · start rough (a window like *by end of October*, then broad chips: weeknights / weekend days / weekend evenings, maybe AM/PM or days of the week). Brainstorm and lean in chat 2026-10-07.

**Design / clarity**
- **Date votes look like buttons that cast a vote,** same problem as the RSVP counts: people tap the count to see who can go. Move the *N can go* out of the buttons, keep a separate tap to see who (like See all on RSVPs). **See votes** exists but is easy to miss: make it louder, with faces.
- **Who leads it? *I'll decide* vs *me*** is confusing (lower priority).
- **Lead, step back and hand off are scattered.** *Leads* and the hand-off live in different places; *Post to {group}* is mixed in with them. Group the lead controls under *Who leads it* (or reorganize), and give *Post to* its own spot. Related: the owner's *You're leading · Change* sheet (hand off to co-lead / someone else / step back / quiet Cancel the event, one sheet whose content steps forward to the cancel confirm, no stacked pop-ups), spec'd in chat 2026-10-07; open: suggest a hand-off when the lead taps Can't, and whether hand-off/step back stay in the Leads sheet too.
- **"Make this a plan"** card: rename, e.g. *Turn this into a plan*, or frame it as what's left: *What we need* / *Remaining*.

## Link previews in iMessage (2026-10-06)

Steven shared Magic and Mocktails (`/e/yjhfy4jx`) in the Torrez group text.
- **What iMessage shows:** the photo, the title and the domain only. It drops `og:description`, which is where *{day} · {place}* lives. On unknown senders it shows *Click to Load Preview* until tapped (Apple privacy; nothing to fix).
- **Shipped (717b73a, live):** `/e/` previews put the date in the title (*🪄Magic and Mocktails – Thu, Oct 22*), as `/i/` links already did. `api/preview.js` → `details()`.
- **Open: different titles for ideas and plans** (owner asked; wording not chosen). Ideas can have a date while still being ideas (Magic and Mocktails shows IDEA but has Thu, Oct 22), so readers can't tell a settled plan from a proposed date. Options put to the owner:
  - Ideas: *Idea: {title} – {date}?* · *{title} – who's in?* · *💡 {title} · Idea for {date}*
  - Plans: keep *{title} – {date}* · add the time · *You're invited: {title} – {date}*
  - Build: `event_preview()` doesn't return `planned` yet. Add it in a migration (as `link_preview()` does), then branch the title in `details()`. iMessage caches a preview when the message is sent, so only new shares change.

## Owner's notes (2026-10-05)

- **Remove the Add to Home Screen pop-up on Welcome** (owner: nobody looks at it). Today it shows on Welcome once a visit, and leaving Welcome for a group page brings it up 1.2s later (`js/sparks.js` ~1175 and ~4690, `installPop`). The owner named the Welcome one; check with him whether the once-after-sign-in pop-up goes too. Keep the dismissible *Add Spark Hub to your home screen* alert (~7169) and the steps in Notification settings, since web push on iPhone needs the home-screen app.
- **Chip in to cover the platform** (idea, not decided). A plain, honest way for people who enjoy Spark Hub to help pay for it, like small-scale backers:
  - **A Chip in space on the Me page** (Profile today).
  - **An occasional pop-up** (*Enjoying Spark Hub? Chip in to cover the costs*), rare and easy to dismiss.
  - **A transparent costs page:** what it costs per month today, line by line (hosting, database, domain, notifications…), and what it would cost to grow (owner's rough range: about $125 a month now, up to about $500 a month as it grows). Real numbers to be filled in from the actual bills.
  - Open: payment provider (Stripe Payment Link, Buy Me a Coffee, Open Collective…), one-off vs monthly, whether chipping in shows anywhere (a thank-you, a badge) or stays private, and how often the pop-up may appear. Payments mean a provider account the owner sets up himself.

## Jeni Wade's demo (2026-10-05)

First demo of this version to someone new (owner's transcript). Lessons in LEARNINGS.md (*What the pilot says*). Not decided by the owner yet unless marked.

**Bigger, for Design or later:**
- **Float path asks differently from the lead path:** *Do you have a date in mind?* (yes / no) before the date picker; a heading like *Start the path* with *Pick a date · Poll the group · Decide later*; details as a free prompt (*throw out whatever comes to mind*, a few sentences) instead of three 60-character bits, which made her doubt herself (Joseph likes the limits: keep them on plans).
- **The floater stays the gatekeeper without being called lead:** others can *ask to lead* and she says yes or no (a different vision → "go start your own"). A thought partner is wanted by default. Being called *lead* makes her hold back.
- **"Incubator"** as the name/metaphor for the idea state (pieces in place → it hatches → *Make it a plan*). Also a third state: *I'll lead it if N people commit* (Joseph's poker night).
- **Ask more than two:** *Ask two people first* / two-at-a-time felt like pressure on individuals; a group ask feels safer (people see each other sign up and sort it out). Middle ground: *Ask a few* (up to ~5–8, each told it went to a handful); later an event **team thread**. Conflicts with the two-at-a-time design (Cynthia's demo).
- **Contact the lead:** a question before taking a task. Cheap version: the lead can add *Questions? Text {name}* (a contact line or text link) to the event.
- **Kid- and family-friendly** symbol and filter ("putting on hats", Stacy's phrase), including kid-friendly ways to help out.
- **Tasks: she likes it** (everything she signed up for, the timeline, her own reminders, *ping me 3 weeks before*). With Joseph's dislike: keep the task view, move it into **Me** as a command centre (drafts, ideas, tasks), and give the main tabs to the fun.
- **Later arm:** a general helper pool (*I'm your errand boy*: get asked for small tasks across events without RSVPing), skills to give and get (the hub's bulletin board; *teach me and Julian to knit*), projects and help-a-neighbour (meal trains, Buy Nothing). Owner: "a whole other arm that's very exciting to me."
- **Install friction:** after Add to Home Screen she had to sign in again (the home-screen app keeps its own sign-in on iPhone), then turn on notifications. Part of the Add to Home Screen usability pass.

## Joseph's feedback on the reorganization (2026-10-04 – 10-05)

From his reactions to today's screens and mockup C. Lessons are in LEARNINGS.md (*What the pilot says*). Not decided by the owner yet unless marked.

- **The Tasks tab isn't landing** (fourth time). The badge saying he has things to do stresses him out. What he likes is the drop-down on each event card (*Leading · 2 tasks ⌄*). **His ideal tabs: Calendar · Ideas · Groups (friends and what they're going to; maybe not its own tab) · Me.** Close to Structure C (Sparks and plans) with to-dos living on each event.
- **Urgency that builds for leads:** open tasks on the event, colour-coded and more urgent as the date gets close; a heads-up push when something still isn't covered near the day.
- **"No longer needed" on a job:** the lead can cross off a job nobody took ("I'll set up the chairs myself"), so it stops nagging. Today the only way is deleting the job.
- **Volunteers get a reminder as their job approaches,** and that's all. Hosts see the production; everyone else sees the fun.
- **Ideas page, checked daily:** "what did someone post today?", tap *I'm in* on *outdoor movie night on Fridays*, and that gives the poster the confidence to host. Wants it more up front. Fix first: **Have an idea** on Your tasks opens the full Start an event (he expected a light idea). Brief 1 (*Share an idea*, two doors) and the Mad Libs post cover this.
- **Messaging:** a full two-way chat is a later version; one-way blasts alone may not be worth it ("I'm here" with no "running late" back). Lean: a chat link on the event plus bringing back *Send everyone an update*.
- **Launch:** Torrez is forgiving; Woodcliff neighbours are hard to win, "semi one chance." Readiness before Woodcliff: one-word tab labels, the Have an idea fix, a group QR code (Brief 2), the Add to Home Screen usability pass, Woodcliff seeded with real events.
- **Magic & Mocktails** (TJ, 8 seats): a live test of handing a lead to a nervous first-timer (*Hand it to someone*) and of seats via a job until *Take part* exists. Worth watching how it goes.

## From the build (2026-10-03)

- **Ask someone to take a job, on jobs with shifts.** Built for single jobs only; a shift job's task row says Share and opens the share sheet instead. Needs a pick-a-shift step in the ask (or ask for the whole job, the person picks the shift on I'm in).
- **The TEST project's size.** It's a free nano instance (~400 MB) and swaps under busy test nights (2026-10-02: three restarts' worth). CI now runs 2 at a time and full runs once per batch. If that's not enough, moving the `sparkhub-test` organization to Pro ($25/month) gives it 1 GB.

## Welcome tour (parked 2026-10-03)

The owner's intro walkthrough: 5–8 simple slides in his voice (who he is and why he made it, ideas becoming plans, nobody doing it alone, the prototype disclaimers, what he's asking, where things are), replayable from Profile → Help & info. Brainstorm and draft copy in `WELCOME-TOUR-for-design.md` (HANDOFF §5 Q26). Tagged for later by the owner; not for Design or the build until he picks it up.

## Joseph and Cynthia's feedback (logged 2026-10-03)

From watching them use the live app. Order is the build's suggested priority (owner hasn't picked yet). Design questions are in HANDOFF §5 #24.

**Do first (they did the wrong thing):**
- **Invite: people didn't know it was sent** (Cynthia). After picking people in Invite, she thought she still had to send through one of the share buttons at the bottom (Messages, Email, WhatsApp, More) and tapped one. She didn't realise the app had already invited them. Needs a clear *Invited ✓* moment, with the share buttons labelled as extras (e.g. *Also share the link*).
- **Opening screens, decided by the owner 2026-10-03:** (1) the Calendar remembers the last group filter, and a new member starts on the group they joined; the header and chip name the group when it's one (today the chip says *1 group* while the header still says *All events from your 4 groups*); (2) **Start here** on the Calendar, Your schedule and any group page, saved to the account and counted so we learn which view people pick (needs Design, with a header that collapses on group pages); (3) **parked for later (owner, 2026-10-03), don't start it:** Your tasks becomes **one to-do feed** in due-date order, with ideas you lead in their own section and nothing undated in a date row (addendum A2 without the carousel, plus B1/B2). Your schedule stays the "what's coming up for me" view. Note: the addendum's §A wrongly says Your tasks is the opening screen; the Calendar is (#90).
- **New tab bar (owner, 2026-10-03): built and live 2026-10-03** (Design's Update 16, `10a4b2c`): Explore · Your tasks · Your calendar (the opening screen) · Groups · Profile, with a group pick per screen. *Start here* stays parked.
- **Calendar ignores "my group"** (Joseph). It opens on all 3 groups combined; he filters down to Torrez Fitness every time. Quick fix: remember the last filter, or open on the main group. Bigger idea: let people choose their own home screen (for now or for good) and watch which ones they pick, almost like A/B testing, to learn which view matters most.
- **Helper chips put the thought in the wrong field** (Cynthia). She liked the chips, but *Bring* fills the job title with "Bring " and her instinct was to finish it in the description, not the title. Rework the job pop-up (e.g. *Bring what?* with the field focused right after the verb, or the chip as a label and the field for the thing).
- **Skipping help should feel normal** (Joseph). Some events need no helpers; *Decide later* on How people can help reads like a tab left open. Make *No help needed* the obvious, equal answer, and rethink *Decide later* on that step.

**Do next:**
- **Add to Home Screen instructions**: usability pass on real phones; maybe a short video. Matters more than it looks: web push only works from the home-screen app.
- **Event links don't need the group** (Joseph didn't know). You can send one event's link to someone outside the group. Say so where you share (*Anyone with the link can see this event and reply*).

**Later:**
- **Group header takes too much room** (Joseph): smaller photo; maybe it collapses or drops down, or the group's menu moves to a sidebar.
- **Per-event chat for on-the-day changes** (Joseph): *We're meeting here*, *plans changed*. A lighter first step: the lead posts an update that pushes to everyone going.
- ~~Jobs still to fill as a lead's task~~ (Joseph): already built 2026-10-02 (HANDOFF row 15).

## Soft holds on the Calendar while a date poll is open (parked 2026-10-02)

Today the Calendar shows only locked-in plans, so the dates in an open poll are invisible: another lead can schedule on top of them and members don't know to keep them free. Polls also have no end date. Owner's calls (2026-10-02): **polls only** (no free-standing holds, no single "probably the 24th" hold), holds last **7 days**, and **every option shows** (not just the leading two).

- **A hold is a by-product of a date poll.** Each date option of an open poll shows on the Calendar (List, Tiles, Month) as a pencilled-in entry: dashed, labelled something like *Maybe · voting*; tapping it opens the idea's vote. Nobody creates or removes a hold by hand. Seen by whoever can see the idea.
- **It ends on its own.** When the lead picks, the winner becomes the plan and the other holds go. Otherwise the holds come off the Calendar 7 days after the poll opened; an option whose date has passed drops off sooner. The idea and its poll stay (*let it rest*, not deletion; see LEARNINGS.md on fading).
- **Keep holding**: the lead can renew for another 7 days.
- **Reminders go to the lead only**: one push once enough votes are in (*6 voted, Saturday leads. Lock it in?*) and one the day before the holds lapse. Both fit the daily `push-daily` job; skip test and demo events as usual.
- **Soft means it never blocks.** Creating an event on a held date shows a heads-up (*Book club is holding this evening, voting until Thursday*) and lets the host carry on.
- **No Add to calendar on a hold** (we can't take an entry back off someone's phone).
- **Decided 2026-10-02 (walk-through):** the lead's first nudge comes once one date has 3+ votes and more than any other; Month shows a dashed ring on each held day; holds show on the Calendar tab and the group's own page (not Your schedule); a hold you voted for shows a tick and *You voted*. Full brief for Design: `SOFT-HOLDS-for-design.md`.
- Build notes: needs a hold-until date on the poll (a migration, so a big change: full run), the Calendar's item list to include open polls' options, and a design for the pencilled-in entry (ask Design or add to HANDOFF §2). Waiting on Design for the look (the brief's §6).

## Market review: cheap changes not built yet (parked 2026-10-01)

From *Where Spark Hub Fits* (see LEARNINGS.md for the reasoning and what's already built):

- **Weekly digest** (*3 ideas need one more person · 2 plans need help*). The review suggests email; that's against the owner's no-email call, so first ask whether to do it as a one-tap *Copy this week's digest* for the group chat, a weekly web push, or email after all.
- **Share to the group chat** on every idea and plan, for every member, not only in the host's Invite sheet.
- **I'll come if it happens** as a firmer interest that counts toward People, next to a lighter *Curious*.
- **Ladder nudges**: after you came to one, *The next one needs a helper*; after two jobs, *Want to co-host?*; make *Ask someone by name* the main button.
- **Walktober templates** on Create event: *Morning loop around ___*, *Dog walk*, *Stroller walk*, *History walk*.

## Turning guests into members: decided against (owner, 2026-10-07)

Guests aren't pushed from an event into a group: no *Join {group} too?* when a guest signs up from an event, no *{Group} plans things like this… Join to see what else is coming up* line, and no sign-in nudge on ideas. Events stay private: an event link shows that one event only.
