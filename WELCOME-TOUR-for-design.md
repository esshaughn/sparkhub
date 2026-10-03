# The welcome tour: brief for Claude Design

For Claude Design, 2026-10-03. **Brainstorm, not built.** The owner wants a short welcome walkthrough that introduces him, the app's purpose and what he's asking of people. It replaces the idea of a feature-by-feature tutorial. The copy below is a first draft in his voice, to be shaped together. What's needed from Design: the look, the flow, and a call on the open questions in §6.

---

## 1. What it's for

People arrive from an invite link or the demo page knowing almost nothing. They don't know who made this, why, what stage it's at, or what's expected of them. The demo page (`spark-hub-demo`, *Prototype · Feedback wanted*) already does this well on a computer: three steps, an honest "it's a work in progress", and a clear ask for feedback. **The tour brings that into the app**, plus the thinking behind it (ideas become plans, and nobody should have to do it alone), then points people to the places they'll use.

The owner's words (2026-10-03): *very simple. Five slides would be great, eight is fine. Introduce me and what's going on, the purpose of the app, what I'm looking for (the disclaimers, like the demo page), a little of the philosophy, how to get started, point them around, ask for feedback, and say where to see it again.*

## 2. Principles

- **A person, not a product.** It opens with Eric, in first person ("I made this because…"). It's a note from a neighbour, not onboarding copy.
- **One idea per slide.** A big line, one or two short sentences, one picture. No paragraphs, no feature lists.
- **Honest about the stage.** It's a prototype; some things will break; that's why feedback matters.
- **Every slide skippable**, and the whole tour easy to find again (Profile → Help & info).
- **Points somewhere real.** The last slides name the actual tabs and buttons, so the first tap after the tour isn't a guess.

## 3. Draft slides (7, in the owner's voice)

Lines in quotes are draft copy; Design is free to cut harder.

1. **Hi, I'm Eric** (his photo)
   "Thanks for trying Spark Hub. I'm testing it with a few groups I'm part of, and you're one of the first people in."
   *The intro: who's behind this and that it's early.*

2. **Why I made this**
   "Most plans die in the group chat. Someone says *we should…*, everyone loves it, and then nobody knows who's doing what."
   "I wanted it to be easy for friends and neighbours to throw out ideas and build them together."
   *The philosophy. The research behind it (LEARNINGS.md): events happen when the work is shared, not when one person does it all.*

3. **Ideas become plans** (a gold idea card turning into a plan card)
   "Anyone can float an idea, even half-baked. People say they're in and vote on when and where. Once someone leads it and there's a date, it becomes a plan."
   *The core loop: idea, then interest, then a lead and a date, then a plan.*

4. **Nobody does it alone** (the Help out list with faces)
   "A lead keeps it moving, but everyone pitches in: bring something, take a job, co-lead. Ask someone by name; a personal ask beats a post to everyone."
   *Leads, jobs, asks. This is the "relational" heart of the app.*

5. **What you're looking at** (a small "Work in progress" sticker)
   "This is a prototype. You'll hit a few glitches and missing pieces. Sorry in advance!"
   "Your groups and plans are real. Events marked *Test event* are just people trying things out."
   *The disclaimers, like the demo page's P.S. Exact list to confirm with the owner (§6).*

6. **What I'm asking from you**
   "Use it for something real: RSVP to one thing, float one idea, or take one job. Then tell me honestly: would you use this, and what would make it better?"
   **Give feedback** button (opens the feedback sheet) and a quieter **Later**.
   *The ask. Feedback is the point of this stage.*

7. **Where things are** (the tab bar, each icon labelled)
   - **Your calendar** (centre): everything you're going to. The app opens here.
   - **Explore** (compass): everything happening in your groups.
   - **+**: start an event or float an idea.
   - **Your tasks**: what needs you.
   - **Profile** (gear): settings, Give feedback, and **this tour again** (Help & info).
   **Let's go** closes the tour on Your calendar.
   *Pointing them around. One idea: the real tab bar shows under a dark scrim with labels pointing at each icon, so it's the actual app, not a drawing.*

Optional eighth slide, or folded into 7: **Get the app on your phone** (Add to Home Screen, then turn on notifications). Today that's its own pop-up after sign-in; the tour could own it instead (§5).

## 4. How it looks and moves (the build's first thoughts; Design's call)

- **Full screen**, one slide at a time, swipe or **Next**; dots for progress; **Skip** top right on every slide but the last.
- Big friendly type (like Welcome's *Plans with your people.*), one illustration or real screenshot crop per slide, the app's purples and the idea gold.
- Slide 1 uses Eric's real photo. Slides 3–4 use real app pieces (an idea card, a Help out row), so people recognise them later.
- The last slide hands off into the real app rather than closing to nothing.

## 5. When it shows (the build's proposal)

- **Once per account**, the first time someone opens the app signed in (on any device; saved on the account, not the phone).
- **New members from an invite link:** after joining. The tour could absorb today's *Welcome to {group}* screen, or come right after it. Design's call.
- **Existing members:** once, the next time they open the app after it ships.
- It goes **before** the Add to Home Screen pop-up, and the 5-minute feedback ask waits until the tour is done (or skipped), so nothing stacks.
- **Again any time:** Profile → Help & info → **Welcome tour**. It could replace the placeholder *How this works* page, which the owner parked for a rewrite.

## 6. Open questions

1. **Seven slides, or fewer?** Candidates to merge: 3 + 4 (the loop and pitching in), 5 + 6 (the stage and the ask).
2. **Eric's photo and first person on slide 1:** yes? Any group-specific line (*You're here because you're in Torrez Fitness*)?
3. **The disclaimers on slide 5:** what exactly? For example: it's a prototype; glitches; Test events; no email (notifications only in the Home Screen app); data is real and private to your groups.
4. **Pointing around:** labels over the real tab bar, or a drawn map on the last slide? Or short coach marks on each tab's first visit after the tour?
5. **Does the tour replace *How this works*** (Profile → Help & info), or sit beside it?
6. **Does it absorb *Welcome to {group}*** and the Add to Home Screen pop-up, or stay separate?
7. **Feedback on slide 6:** open the feedback sheet right there, or point to Profile → Give feedback?
