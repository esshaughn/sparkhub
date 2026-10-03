# Spark Hub on a computer: a plain web page (brief for Claude Design)

For Claude Design, 2026-10-02. **Not built yet.** The owner has set the direction (§3); the scope under it is the build's proposal, marked as such, so push back on any of it. What's needed from Design is how the page looks and reads at computer widths. Sizes and colours mentioned here are only pointers to what exists today. Design them properly.

---

## 1. The problem

Open Spark Hub on a computer today and you get the phone app in a 430px rounded card floating in the middle of a grey screen. It works, but it reads as "an app you haven't installed yet", with a tab bar, bottom sheets and swipes that a mouse can't do.

That's the wrong first impression for the people we most want next: neighbours who hear about a group through the neighbourhood email, a Facebook post or a flyer, click the link at their computer, and haven't decided anything yet. People resist installing an app for something unproven. They don't resist a web page.

## 2. The idea in one paragraph

On a computer, Spark Hub is **a web page, not an app**: the group's notice board. A neighbour can do three things there: **see what's coming up, say they're coming, and take it to their phone**. Everything else (hosting, ideas, voting, sign-ups, friends, settings) stays in Spark Hub on the phone. The page is the front door; the phone is where Spark Hub goes with you once you've come to something.

## 3. What's decided, and what's proposed

**The owner's direction (2026-10-02):**

| | |
|---|---|
| What it is | **A web page version, not an app.** |
| How much | **The absolute lightest version, with the simplest functionality.** |
| What it's for | Getting neighbours started on a computer, then moving them to the phone once they've bought in. |
| The full app | **Keep a link through to it** on the page, for people who already use Spark Hub (§7). |
| Job sign-ups | **Later.** The first version shows jobs read only (§5.3). |

**The build's proposal (everything below this line in the brief):**

| | Proposal |
|---|---|
| What the page does | Three things only: see what's on, RSVP, take it to your phone. |
| When to ask for the phone | After they've done something (an RSVP), never on arrival. |
| What it's called | Just **Spark Hub**, and **Spark Hub on your phone**. Never "the desktop version" or "the web version": it's one place, one account. |
| Staying on a computer | Fine. Nobody is pushed off the page or nagged. |
| The rest of the app | Not on the page, apart from the owner's link through to it (§7). |

## 4. Who it's for, and how they arrive

The page is for someone at a computer who is new or nearly new. They arrive one of four ways:

| They open | Signed in? | They should land on |
|---|---|---|
| A group's invite link (`/join/CODE`) | No | The invitation (§5.1), then the notice board |
| An event link (`/i/…`) | No | That event (§5.3), as a guest |
| Either link, or the plain address | Yes | The event, or the notice board (§5.2) |
| The plain address | No | The welcome (§5.1) |

## 5. The pages

### 5.1 Arriving: the invitation and the welcome
What exists today on the phone, to be laid out as a web page:

- **Invite link:** the group's photo, *You're invited to {group}*, then **Continue with Google** or **Continue with email** (a 6-digit code, *Check your email*). Joining happens by itself after sign-in.
- **Plain address, signed out:** the welcome: the picnic photo, *Plans with your people.*, the 1-2-3 steps (*Create an event · RSVP & pitch in · Make it happen*), the same two sign-in buttons, *New here? Either one creates your account.*
- **Signed in but in no group:** today a card offers **Join with a code** and **Start a group**. Proposal for the page: only **Join with a code** (a code or a pasted invite link). Starting a group is hosting, so it stays on the phone.

A link preview in an email or chat already shows *Join {group} on Spark Hub* with the group's photo. The page they land on should look like the same thing they just clicked.

### 5.2 The notice board (the page's home)
Every upcoming event in the person's groups, soonest first. Per event: its photo, title, day and time, place, the group's name (when they're in more than one), how many are going, and their own answer if they've given one (*You're going*).

Proposal: **one view and no controls.** The phone's Calendar has List, Tiles and Month, plus Sort, Filter, Type and Search. The page has none of them. Design's call which single view it is; a computer has the width for a month beside a list if that reads better than a list alone.

Only events with a date show here (as on the phone's Calendar). Ideas, date polls and past events are not on the page.

### 5.3 The event
One event, as a page you read top to bottom:

- the photo, the title, the day and time (**Add to calendar**), the place (**Directions**)
- who's leading it (the lead and co-leads), the host's description, and any updates from the host
- who's going: faces and first names
- **Going · Maybe · Can't**, with counts (tapping your pick again clears it, as on the phone)
- the jobs under *Help out*, **read only**: each job, its time and *N still needed*. No **Sign up** on the page yet (the owner: later). Leave room for it: it's the next thing to be added

After **Going**, the phone shows *You're going. See you there!* with **Add to calendar**. The page should do the same, and this is also the moment for §5.4.

**Guests (no account)** behave as they do today: on the event they were sent, RSVP asks for a first name once (**RSVP as a guest** · *Your name goes on the guest list, so {lead} knows who's coming.*), then *You're on the list* offers **Create an account** / **Not now**. A guest sees only that one event, so there's no notice board for them until they have an account.

### 5.4 Take it with you
The one new thing on the page. It's how a neighbour moves to the phone, offered **after they've RSVP'd** and available quietly on the event page from then on.

- A **QR code** that opens this same event on their phone. (New: Spark Hub has no QR code anywhere today.)
- The pitch is what they now need, never "get the app". Starting points for the words:
  - after Going: *Want a nudge the morning of? Open this on your phone.*
  - on a job list: *Want to help out? Sign up from your phone.*
- One line that removes the worry about starting over: *Sign in the same way on your phone. Your RSVP will be there.*
- **Add to calendar** sits beside it. Spark Hub sends no email (the owner's rule), so for someone who stays on a computer, their own calendar is the only reminder they'll get. It deserves real weight here, not a small link.
- **A guest** has no account for their RSVP to follow, so their version asks them to **Create an account** first (the existing *You're on the list* step), then offers the phone.

Once on the phone, the existing flow takes over: sign in, then the *Add to Home Screen* pop-up and *Turn on notifications*. Nothing new to design there.

### 5.5 The top of the page
A plain page header, not the app's photo header or tab bar: the Spark Hub mark, the person's name with **Sign out**, and the way through to the rest of the app (§7). No bell, no search, no **+**.

## 6. A web page, not an app: what that means

This is the heart of the brief. The page should feel like something you read in a browser:

- **The whole page scrolls**, like any web page. No fixed frame, no rounded phone card, no tab bar pinned to the bottom.
- **Pop-ups appear in the middle of the page**, or the content simply sits in the page. No sheets sliding up from the bottom.
- **No gestures.** Nothing depends on swiping or pulling down. Everything is a visible button or link.
- **Links look and act like links:** hover states, a visible focus ring for keyboard users (today's is a 2px violet outline), Enter to confirm, Esc to close a pop-up. The browser's Back button goes back.
- **Each event has its own address**, so it can be bookmarked or pasted into an email. (It already does: `/i/…`.)
- **It uses the width sensibly:** a readable column or two, not the phone layout stretched, and not text running the full width of a wide screen.
- **No "install" talk.** No splash screen, no *Add to Home Screen* prompt, no *Get these on your phone* card. The only mention of the phone is §5.4.
- **Still Spark Hub at a glance:** same typeface (Figtree), same violet, same photos-first feel, so the phone app is recognisably the same place when they get there.

## 7. What's left out, and where it goes

Not on the page: posting an event or an idea, the Ideas board, voting on dates and places, signing up for jobs, host tools, Your people and friends, notifications, search, past events and photo albums, profile and group settings.

Two things follow, and both need Design's eye:

1. **Mentions of what's missing should be rare and kind.** Where the page shows something it can't act on (a job list, a date still being voted on), one short line points to the phone (§5.4). No greyed-out buttons, no "not available on desktop".
2. **People who already use Spark Hub** (hosts above all) can do everything on a computer today, in the phone-shaped card, and they keep that (the owner, 2026-10-02): one quiet link in the page's header, something like *Open the full app*, shows today's phone-width view. It should be easy to find for a host and easy to ignore for a newcomer. Design's call on the wording, where it sits, and how someone gets back to the page from the full app.

## 8. States to cover

- Signed out: the welcome, an invitation, an event as a guest
- Signed in, no group yet
- The notice board: loading (placeholders, never the empty message), with events, and empty (*Nothing planned yet* plus what to do next, which is probably the phone)
- An event: not answered, Going, Maybe, Can't; a guest before and after giving a name; **full** (*N spots left* runs out); **cancelled** (shown as cancelled, no RSVP); time or place still to be decided (shown as *to be decided*, read only); an invite-only event opened by someone who can't see it
- Take it with you: for an account, and for a guest
- Something went wrong / no connection

## 9. Questions for Design

1. **One view for the notice board:** a list, or a month with a list beside it?
2. **Where "take it with you" lives** on the event page once the RSVP moment has passed: a side column, a strip at the bottom, something else?
3. **The width at which the page takes over.** Today the phone card shows from 520px wide. Is there one page layout that works from there up, or does a narrow browser window keep the phone layout?
4. **The full app link** (§7): its words, its place in the header, and the way back to the page.

## 10. What Design needs to draw

1. **The notice board** at computer width, with events, loading and empty.
2. **The event page**, in its RSVP states, with the read-only job list.
3. **Arriving:** the invitation, the welcome, signing in (Google, the email code), and *Join with a code*.
4. **RSVP as a guest** and *You're on the list* as centred pop-ups.
5. **Take it with you:** the QR code, its words, Add to calendar beside it; the account and guest versions.
6. **The page header**, with the link through to the full app, and the way back from it.
7. Answers to §9's questions.

## 11. Build notes (for the build, not Design)

- Same address, same account, same database: the page is a second layout of the same site, chosen by screen width. No migration.
- The app's styling lives inside `js/sparks.js` (the stylesheet is 234 lines), so the page means new render functions for three screens, not a stylesheet. Keeping it to three screens is what keeps this small.
- The QR code is new. Draw it in the browser from our own code: the Content-Security-Policy in `vercel.json` blocks outside services, and an event's address shouldn't be sent to one anyway.
- Sign-in is per device, so the phone asks again: one tap with Google, a fresh code by email. A guest's RSVP is kept on the device it was made on and won't follow them, hence §5.4's guest version.
- Check what **Add to calendar** and **Directions** do in computer browsers before relying on them.
- Tests: one small computer-width smoke test (the notice board loads, RSVP works). Not a second copy of the suite: the test database can't take it.
- When built: rows in `HANDOFF-to-design.md` and `FEATURES.md`, and `manifest.json`'s portrait lock needs a look.
