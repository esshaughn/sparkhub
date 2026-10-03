# Addendum for Claude Design: what Emily and Cynthia's demos say about the home screens

**From:** the build (Claude Code), for the owner, 2026-10-02. Read this alongside the Auburn/Joseph brief.
**Baseline:** Version 7 (`design/spark-hub/Spark Hub App.dc.html`) plus `HANDOFF-to-DESIGN.md` as of today.
**Source:** the v6 demo conversations with Emily and Cynthia (the owner's "Demo Convos" notes). Emily isn't one of the core-persona interviews, and part of her talk was about co-founding and funding, so treat her points as one strong voice, not a tally.

Three questions for this round. Each one gives what we heard, what the build does today, and the options. Where the build has a lean, it says so. These are the owner's calls, made with Design.

---

## A. One chronological "what's coming up for me" view, with commitments under it

**What we heard (Emily).** Three separately styled sections at the top (Leading · Helping · Going on Your tasks) made her rebuild "what's actually coming up for me" in her head. She asked for:
1. One date-ordered carousel at the very top (she named Partiful), with your role as a light marker on each card, not three sections.
2. Below it, a separate personal "what did I commit to" feed (bring the fruit tray, set up chairs…).

**What the build does today.**
- **Correction (2026-10-03):** the app opens on the **Calendar** (FEATURES #90), not Your tasks. **Owner, 2026-10-03: this whole section is parked; don't draw it this round.**
- **Your tasks** shows Leading, Helping and Ideas as three horizontal carousels, each with its own colour and count badge. Your role's to-dos are on the cards.
- **Your schedule's Up next** is already close to her first ask. It's one date-ordered list: the soonest event as a big tile with a countdown, then This week · Next week · Later in {month} · {Month}. Each card carries a coloured role strip (*Leading · 2 tasks ⌄*, *Helping*, *Going*). It has no ideas.
- The **Calendar** (List) is date-ordered with the same role strips, across all your groups. It includes events you haven't joined.

**Options to draw.**
- **A1. Lightest:** make **Your schedule** the default screen. Keep Your tasks as the second layer, the "what did I commit to" feed, reached from the title switcher (it already switches between Your tasks and Leading).
- **A2. Merge:** Your tasks opens with an **Up next carousel** (all your events in date order, role as a small chip). Under it, one **To-do feed** across every role: *Bring the fruit tray · Sat*, *Add a location · Porch jam*, *Confirm your shift · Fri*. The three role carousels go away.
- **A3. Keep the sections,** but make the first one *Up next* (every role, by date). Leading / Helping become collapsible lists below.

**The build's lean:** A2. It answers both halves of what she asked for on one screen. The to-dos already exist per card (`ownActs` / `helpActs`), so a single feed is mostly layout.

**To decide:** the default screen on launch (owner set Your tasks in v6), and whether ideas you lead appear anywhere on it (see B).

---

## B. Keep undated things out of date-ordered lists

**What we heard (Emily).** She hit an undated item mixed into date-ordered cards ("wait, this doesn't have a date") and lost the thread. Ideas need their own clearly separate space.

**What the build does today.**
- **Your schedule and the Calendar list plans only**, never ideas. But a plan can still have no date in two cases: the lead stepped back, or it was made before plans needed one. Those sit in a **Date TBD** section at the bottom (amber heading).
- **Your tasks' Leading carousel** mixes plans, **drafts** (DRAFT · SAVED… cards) and, through the lead's tasks, undated items. Ideas you lead have their own **Ideas** section below.
- **Group pages** keep ideas on their own tab (Ideas · Plans · Past), which seems to work.

**Options to draw.**
- **B1.** Nothing undated in any date-ordered row or carousel. *Date TBD* plans become a quiet line at the end ("2 plans still need a date ›"), opening a list.
- **B2.** Drafts leave the Leading carousel for a small "Drafts (2)" row or chip, since they aren't events yet.
- **B3.** On Your tasks (or its A2 version), ideas you lead get a visibly different card style (the gold idea card from Start an event) in their own section, never in the date-ordered row.

**The build's lean:** B1 + B2 together, and B3 if A2 is chosen.

---

## C. A completeness gate from idea to plan, made on purpose

**What we heard (Emily).** Something like a progress bar or required fields before an idea can become a plan: you can't schedule it until roles and logistics are thought through. The owner liked it in the moment.

**Why decide it deliberately.** This gates *promotion to a plan*, not posting an idea, so it doesn't collide with the locked principle that ideas are bare and ungated. But it's close enough in shape to the admin-gate argument in the Auburn/Joseph brief that it should be chosen, not drifted into.

**What the build does today.** An idea shows a gold strip of steps: **Lead · Location · Details · Date** (30px circles joined by bars). **Make it a plan!** appears once there's a **lead and a date** (the owner's rule, 2026-10-02; for a few hours that day it waited for all four, a misreading of the mock). Location and Details show progress but don't block. A purple *things to go* card lists what's missing. The *People* step (a minimum head count) was hidden by the owner today. **Jobs** (how people can help) aren't in the strip. Start an event now offers **No help needed →** when no job is added.

**Options to draw.**
- **C1. Soft (the build's lean):** a fifth step, **Jobs**, in the strip, done when the lead adds a job *or* taps *No help needed*. Like Location and Details, it shows progress but doesn't block Make it a plan!
- **C2. Hard:** Jobs (or No help needed) is required, alongside the lead and the date.
- **C3. Leave it:** a lead and a date; jobs stay outside the strip.

**To decide:** C1 vs C2. Whichever is chosen, the No help needed answer from Start an event should count, so a lead who already said "no help needed" isn't asked again.

---

## Not in this addendum (already handled or parked)

- **Specific asks carry a "why them" line**, and Ask two people first stops at two. Built today (HANDOFF §2).
- **Calendar holds and a clash heads-up:** decided, still waiting for a design. Brief in `SOFT-HOLDS-for-design.md`. Four conversations asked for it, so it's the next big build.
- **Cynthia's "sign-up didn't show in the group view"** couldn't be reproduced. A test now covers it.
- **Joseph's Calendar filter bugs** (could use a hand ignoring the group filter; the filter freezing) are fixed.
- **Add to Home Screen instructions** need a usability pass on real phones. That's a build task, not design.
