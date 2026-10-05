# Take part: brief for Claude Design

For Claude Design, 2026-10-05. **Not built, on purpose:** the build is waiting for this design before it shows the PARTICIPATE chips (HANDOFF-to-DESIGN §4). This brief says what's needed. How it looks, what it's called and where it sits are Design's call.

---

## 1. What it is

Some events have limited spots for **taking part**, not for helping: a court time, a seat in a class, a place in a carpool, a 15-minute slot. That's different from **Help out**, where people take a job that helps the lead run the event (`HELP-OUT-for-design.md`). v8-1's Join in step already names the split, with HELP chips and PARTICIPATE chips (Claim time · Claim seat · Other), but nothing after that step is designed, so the build hides PARTICIPATE and shows only HELP.

## 2. What's needed

The whole path, from the lead setting it up to members claiming a spot:

1. **Setting it up (Plan an event → Join in).** What happens after the lead taps Claim time, Claim seat or Other: what they fill in (how many spots, times, a name for the spot), and how it looks next to the HELP jobs. Can one event have both?
2. **Review.** How take-part spots show on Review, separately from jobs or together.
3. **The event page.** Where members see the spots, how they claim one, and what they see once they have. This includes the main call to action: today it's RSVP, plus Help out lower down. What does a member tap first when an event has spots to claim?
4. **Full, waitlist, giving a spot up.** What a member sees when every spot is taken, and how they let one go.
5. **Asking someone.** Help out has *+ Ask someone* for open jobs. Is there an equivalent for open spots?
6. **Tasks and role strips.** My tasks and the tiles' role strips show *leading · helping · going*. Where does a claimed spot show, and with what word and colour? (The token list already pairs green with *going / take part*, but that's a starting point, not a decision.)
7. **The lead's view.** Who has which spot, and editing or removing spots after posting.
8. **Notifications.** Whether the lead hears when a spot is claimed or given up, and whether the member gets a reminder of their time.
9. **Editing an event** later: adding take-part spots to an event that was posted without them.

## 3. Things the build needs to know

- **Does claiming a spot count as going?** Taking a job already counts as going (it RSVPs you). The same rule for spots is the simplest, but it's Design's call.
- **One spot per person, or several?** Shifts allow one per person per job today.
- **Guests:** can someone who isn't signed in claim a spot (like taking part with a name and contact in the earlier design), or members only?
- **What "Other" means** under PARTICIPATE, and how it differs from HELP's Other.

## 4. What exists to build on

- Help out's jobs, seats and shifts (`signup_items`, `signup_claims`): a job with a head count, optional time and shifts, and claims. Take-part spots could reuse these with a flag, so a design that behaves like jobs-with-seats is cheap to build. Something very different (a real booking calendar, for example) is fine too; just say so.
- Design's earlier step options, `Sign-ups Step Options.dc.html` (18a–18d), and the Take part notes in v8-1's HANDOFF-to-CODE *Still open*.
