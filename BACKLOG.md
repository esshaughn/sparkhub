# Backlog

Parked work. Newest first. When you pick something up, move it to a branch and delete it here once it ships.

## From the build (2026-10-03)

- **Ask someone to take a job, on jobs with shifts.** Built for single jobs only; a shift job's task row says Share and opens the share sheet instead. Needs a pick-a-shift step in the ask (or ask for the whole job, the person picks the shift on I'm in).
- **The TEST project's size.** It's a free nano instance (~400 MB) and swaps under busy test nights (2026-10-02: three restarts' worth). CI now runs 2 at a time and full runs once per batch. If that's not enough, moving the `sparkhub-test` organization to Pro ($25/month) gives it 1 GB.
- **"Help to be decided" on Create event's Review** next to the new *Details TBD*: asked the owner whether it should read *Help TBD* too (2026-10-03).

## Turning guests into members (parked 2026-10-01)

Guests who open a shared event link can RSVP with a name (no phone number since 2026-10-01), and see "Want a reminder? Sign in" after they RSVP. Not built yet:

- Signing in from a group's event (posted to the group, not private) should offer "Join {group} too?" in the same step. Today a guest who signs up still isn't a member, so they don't see the group's other events or get new-event notifications.
- The reminder nudge only shows on plans; add it when a guest taps "I'm interested" on an idea.
- Maybe a line under the event for guests: "{Group} plans things like this on Spark Hub. Join to see what else is coming up."
