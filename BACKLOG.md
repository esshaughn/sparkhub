# Backlog

Parked work. Newest first. When you pick something up, move it to a branch and delete it here once it ships.

## Turning guests into members (parked 2026-10-01)

Guests who open a shared event link can RSVP with a name and phone, and since 2026-10-01 see "Want a reminder? Sign in" after they RSVP. Not built yet:

- Signing in from a group's event (posted to the group, not private) should offer "Join {group} too?" in the same step. Today a guest who signs up still isn't a member, so they don't see the group's other events or get new-event notifications.
- The reminder nudge only shows on plans; add it when a guest taps "I'm interested" on an idea.
- Maybe a line under the event for guests: "{Group} plans things like this on Spark Hub. Join to see what else is coming up."

## "Continue with Google" (parked 2026-09-24)

Email-code sign-in for leads shipped (see FEATURES.md #61). Optional one-tap alternative:

- Google: free OAuth credentials from Google Cloud, then `linkIdentity` for anonymous users. Apple sign-in needs the paid Apple developer account, so it's skipped.
- Owner task: create the Google OAuth credentials.
- Rejected: SMS (not free), recovery codes (too clunky for members).
