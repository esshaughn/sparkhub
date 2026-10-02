# Soft holds on the Calendar: brief for Claude Design

For Claude Design, 2026-10-02. **Not built yet.** The owner has decided how it behaves (below); what's needed from Design is how it looks: the pencilled-in entry in each Calendar view, the heads-up in Create event, and the hold's state on the idea's voting card. Sizes and colours mentioned here are only pointers to what exists today. Design them properly.

---

## 1. The problem

The Calendar shows only plans: events with a locked-in date. While an idea's date poll is open, its dates are invisible, so:

- another lead can schedule on top of them without knowing, and
- members don't know to keep those evenings free, so the date that wins often finds half the group already busy.

Polls also have no end. An idea can sit with an open poll for weeks.

## 2. The idea in one paragraph

Every date option in an open date poll **pencils itself in** on the Calendar, for everyone who can see the idea. It's a soft hold: it never blocks anyone, it ends on its own after 7 days, and it turns into the real plan when the lead picks a date. Nobody creates or removes a hold by hand. It's a by-product of running a date poll.

## 3. The owner's decisions (2026-10-02)

| | Decision |
|---|---|
| What makes a hold | **Only a date poll.** No free-standing holds, no single "probably the 24th" hold. |
| Which dates show | **Every option** in the poll, not just the leading ones. |
| How long | **7 days** from when the poll opened. An option whose date has passed drops off sooner. |
| Renewing | The lead can **Keep holding** for another 7 days. |
| How it ends | The lead picks a date: that option becomes the plan (a normal Calendar entry) and the other holds disappear. Or the 7 days run out: the holds come off the Calendar, and the idea and its votes stay as they are (*let it rest*, not deletion). |
| Blocking | **Never.** Picking a held date in Create event shows a heads-up and lets the person carry on. |
| Who sees a hold | Whoever can see the idea. |
| Where | The **Calendar tab** (List, Tiles, Month) and **the group's own page** (its Tiles, List, Month). Not Your schedule. |
| Month view | A **dashed ring** around each held day (plans keep their solid dot). Tapping the day lists its holds under the grid, as it does for plans. |
| Your votes | A hold you voted for shows **a small tick and *You voted***. |
| Add to calendar | **Not offered on a hold** (we can't take an entry back off someone's phone once the hold lapses). |
| Reminders | **Only to the lead**, both under *Things you're leading*: (1) once one date has **at least 3 votes and more than any other**: *6 voted, Saturday leads. Lock it in?*; (2) the day before the holds lapse: *Your dates for Book club stop holding tomorrow. Keep holding?* Both open the idea's voting card. |

## 4. Every place it shows up

### 4.1 Calendar tab and a group's page: List and Tiles
One entry per held date, among the plans in date order. It needs to read as **pencilled in**, clearly weaker than a plan at a glance. The build's first thought: a dashed outline instead of the white card's shadow, the idea's gold rather than a role colour, and a small chip such as *Maybe · voting*. Content:

- the idea's title and the date (and time, if the option has one)
- that it's one of several: e.g. *1 of 4 dates* or *4 dates in the running*
- its votes: *3 votes*, and *You voted* with a tick if you did
- the group name, as on plan entries

Tapping it opens the idea page, scrolled to its *Help pick when and where* card (row 116 in HANDOFF-to-design.md). No RSVP buttons and no Add to calendar on a hold.

**Question for Design:** a 4-option poll puts four entries on the List, possibly in the same week. Is that fine, or should options in the same week fold into one entry (*Book club · Tue, Thu or Sat*)? The owner asked for every option to show; folding would still show every date.

### 4.2 Month view
- A held day gets a **dashed ring**; a day with a plan keeps its **solid dot**; a day with both shows both.
- Tapping the day lists that day's plans, then its holds (as in 4.1), under the grid.
- Your schedule's Month doesn't show holds.

### 4.3 Create event: picking a held date
When the date picked on step 2 is held by a poll the person can see, a heads-up appears under the date field. It's information, not a warning; nothing needs tapping, and Next works as usual.

- *Book club is holding this evening · voting until Thu*
- with a time: *Book club is holding 6:00pm · voting until Thu*
- two or more: *2 ideas are holding this date · voting until Thu* (the earliest end)

Tapping the line could open the idea in a new layer. Design's call whether that's worth it.

### 4.4 The idea's voting card (*Help pick when and where*)
The hold needs a visible state on the card everyone already uses to vote:

- **Holding:** *Holding these dates on the Calendar until Thu, Oct 9* (everyone sees this line).
- **The lead also sees Keep holding** (adds 7 days from today). Design's call: a link on that line, or a button.
- **Lapsed:** *These dates aren't held on the Calendar any more.* The lead sees **Hold them again** (another 7 days from today).
- **After the lead picks:** the card's existing green *DATE IS SET* box. No hold line.

### 4.5 The lead's notifications
Two pushes, also in the bell under *Leading*, using the same row style as today:

1. *6 voted, Saturday leads. Lock it in?*: sent once per poll, when one date has 3+ votes and more than any other. (Sent at most once a day, in the morning job.)
2. *Your dates for Book club stop holding tomorrow. Keep holding?*

Both open the voting card. Nothing goes to members about holds.

## 5. Edge cases (the build's proposal; push back if any look wrong)

- **An idea looking for a lead** (no lead): its holds still show; no reminders go out (nobody to send them to); whoever takes the lead can Keep holding.
- **A cancelled idea:** its holds disappear at once.
- **A date someone adds to the poll later** shares the poll's end date; it doesn't restart the 7 days.
- **The lead removes the poll** (back to a single date or *Decide later*): its holds disappear.
- **Test events** behave like real ones for whoever can see them, and never push (as today).
- **An option with no time** shows just the date (*Sat, Oct 11*).

## 6. What Design needs to draw

1. The **held entry** in List and in Tiles, beside a plan entry, including *You voted*.
2. **Month**: the dashed ring next to the solid dot, and a day that has both.
3. The **Create event heads-up** under the date field (one hold, several holds).
4. The **voting card's hold line** in its three states (holding, holding as the lead with Keep holding, lapsed with Hold them again).
5. Answer **4.1's question** about several options in one week.

## 7. Build notes (for the build, not Design)

- Database: a "hold until" date on each idea with a poll (a migration, so it needs a full test run and has to be applied to live). Set on the poll's first option; *Keep holding* moves it.
- `load_all()` and the Calendar's item list grow to include open polls' options; the group page's views use the same list.
- The two reminders join the daily `push-daily` job, topic `hosting`.
- Costs nothing new to load: the date options are already loaded for the voting card.
