# After the event, joy first: brief for Claude Design

For Claude Design, 2026-10-16. **Not built yet.** The owner has set the principles and the order (§3). What's needed from Design is how it looks: the past event page, the debrief card, the notifications, the host's digest. A clickable mockup the build made while brainstorming with the owner is in `design/post-event/Joy First Debrief Mockup.html` (open it in a browser; sample event and people). It's a sketch of the flow, not a visual direction: redraw it in the design system.

---

## 1. Why it matters (the owner's words, condensed)

The debrief is how a community pays it forward, learns and grows. It honours and nourishes everyone who took part (the lead, the helpers, the people who came), and it gathers what the next lead needs, so things happen again, get easier, and reflect what the community cares about.

The one thing it must never become: a place where people dump everything that went wrong first and forget the good. **Celebration and appreciation come first, always.** Reflection comes second, framed as *what would give me more joy next time*, and starting with *what could I do differently*, not a list of demands for the organiser.

## 2. What's built today

- **A past event switches to a separate *It happened* page** (`viewDone` in `js/sparks.js`): a purple-fade hero with *It happened!*, the date and *N said yes* (or *N came* once the lead checks people in); the lead's private *Anything to change for next time?* card (v8-21 2a); the album (*+ Add yours*); reactions and *Thanks from …* for the lead; *Do it again?*; *Wrong date? / Delete*.
- **What's lost on that page:** the description, the time and place, the sign-ups (who did what), the list of who went, and Discussion. It stops feeling like the event it was.
- **Sharing works:** the ⋯ menu's Share link sends *{Title}: here's how it went.*
- **Notifications:** only the day-before and morning-of reminders and spot/job reminders. **Nothing during or after an event.**
- The **Past events** list (Explore → Past events, the group's Past scrapbook) is fine as it is.

## 3. The owner's decisions (2026-10-16)

| | Decision |
|---|---|
| The past event page | **Stays the event page**, in the same look as an upcoming one: description, time and place, sign-ups, who went, Discussion. What came at the end moves to the **top**: photos, appreciations, how it felt, the debrief. Opening it should give a full sense of what the event was and how it felt. |
| The list of past events | Unchanged. |
| During the event | A push to everyone going: **take a picture** for the album. |
| After the event | A push to everyone who went: **add your photos and share what you valued.** |
| Order | **Joy first.** What gave you joy and energy, what you valued, what went well, thank people. Only after that: what would give you more joy next time. |
| The gate | You can't reach the *next time* part without first sharing joy. Joy alone is a complete answer. |
| Framing of *next time* | Always positive: *If and when we do this again, what would give you more joy?* Lead with **what I could do differently**, before anything aimed at the organisers. |
| Friction | Low. Not many touchpoints. Both steps should be quick. |

## 4. The flow the build sketched with the owner (please challenge it)

**One card, two steps, one sitting.** The order is the gate, so there's no second visit.

1. **What gave you joy at {Event}?** Tap any that fit (*The people · Meeting someone new · Laughing · Moving my body · Being outside · Learning something · The food · Helping out*). **Thank someone**: faces of the lead, co-hosts, helpers (with what they did) and people who came; a tap thanks them, and they get a note. **A moment you loved** (optional line). The button stays *Tap what gave you joy* until one chip is picked, then *Share my joy*.
2. **If we do this again…** opens on the same card right after (*Thanks! Dee will see your thanks. One more, if you want.*):
   - **Next time, I could…** *Bring a friend · Help with a job · Come early to set up · Take photos · Lead part of it · Stay to clean up.*
   - **What would give you more joy?** *More time to talk · A different time · Something for kids · More people · Food after*, plus an optional line.
   - **Skip this part** is always there.
3. **The lead does the same card.** Step 1 thanks their helpers; step 2 is private and replaces today's *Anything to change for next time?* card, still feeding the *Last time* card when they plan the next one.

**Who sees what:**
- **Joy is public**, at the top of the event page in a *How it felt* section: the album, counts (*9 loved the people · 7 loved being outside*), a few quoted moments, and who was thanked.
- ***I could…* is public as a celebration**: *5 will bring a friend next time.*
- ***More joy next time* goes to the hosts only**, grouped and counted, never as a stream, and not before day 2. The host's digest opens with what people loved, then what they'll do next time, then their wishes.

**Discussion on a past event:** for the first two days its box asks *What gave you joy?*. A nudge, not a lock.

**Notifications (at most three per person who went):**

| When | Who | Copy (draft) | Opens |
|---|---|---|---|
| ~30–45 min after the start | Going | *📸 {Event} is happening · Snap a photo for the album.* | The event, photo picker ready |
| ~1 hour after the end (10am next day if it ends late) | Who went | *How was {Event}? · What gave you joy? Thank {Lead} and the helpers.* | The joy card |
| Same | The lead and co-hosts | *Thank your helpers, add photos, and share what gave you joy.* | The joy card |
| Day 2, only if they did nothing | Who went | *Still time to thank {Lead} · Add your photos from {Event}.* (joy only) | The joy card |
| Day 2, evening | Hosts | *What people loved at {Event} · 9 loved the people. 5 want to bring a friend next time.* | The digest |

Each goes once per event (once per day for an *Each day* event), skips cancelled, test and demo events, and gets its own switch in notification settings.

## 5. What we need from Design

1. **The past event page**: the full event page, reordered, with the after-the-event part on top. How does it say *this already happened* without becoming a different page?
2. **The debrief card**, both steps, for someone who went and for the lead, including the moment step 2 opens, *Skip this part*, and *done* on the page afterwards.
3. **How it felt**: counts, quotes and thanks on the page, so they read as a celebration and not a survey result.
4. **The host's digest** (day 2): celebration first, then *I could…*, then the wishes.
5. **The photo moment during the event**: what the push opens to.
6. **Thanking a helper by name**: what the thanked person receives (bell line, push, on their Me page?).

## 6. Still open (the owner hasn't decided)

- Are *more joy next time* wishes **hosts only** (the build's suggestion) or public after day 2?
- Do **guests without an account** get the card? They can fill it on the page, but a push needs a device.
- **The chip lists**: their wording is the tone of the whole thing. The owner will edit them.
- Does *Next time, I could… Help with a job* become **a real ask** when the next similar event is posted, or stay a count?
- Should the counts feed **event memory** (`event_summaries`), so the next lead of a similar event sees *Last time people loved the people and being outside*?

## 7. Joseph's input (a tester, voice notes 2026-10-16)

- People are always on to the next thing and rarely stop to say what went well. He wants **each person's** experience, since people get different things from the same night. After Stacy's sit-down dinner he sent her a recap **voice message**, and she valued it.
- It **can't feel like a task**: a short version for most people (*Would you do this again? What did you get out of it?*), **a couple of people sharing first to set the tone**, and asking whether they **want to be invited to the next one**.
- **The host should feel appreciated.** A small thank-you makes them likelier to host again and gives them confidence.
- **Habit comes from repetition**, so the prompt should look and arrive the same way every time.
- **What to capture:** the small things that made it work: the pace, room for silence and laughter, structure without too much structure.

What this suggests for the drawing (the owner hasn't decided yet): the joy push arrives **the morning after**; step 1 includes **I'd come again · invite me next time**; the card shows the first few people's joy to set the tone; *how it felt* chips such as *The pace · Room to just talk · Easy, not over-planned*; thanks for the host comes first. Voice notes are a later idea; leave room for one.
