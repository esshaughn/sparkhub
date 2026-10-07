# Backlog

Parked work. Newest first. When you pick something up, move it to a branch and delete it here once it ships.

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
