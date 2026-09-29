# Handoff: Spark Hub — live build → Claude Design

**Direction:** code → design. This describes what's built, so the next design round starts from what shipped rather than from the design file.

- **Built (test):** https://gosparkhub-git-test-eric-5958s-projects.vercel.app · **Live:** https://gosparkhub.vercel.app
- **Source:** github.com/esshaughn/sparkhub (`index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, `supabase/templates/`)
- **Baseline:** Claude Design's **Spark Hub v6** handoff plus **Update 2** to **Update 7**. Update 7 (`design/spark-hub/README-v6-update-7.md`) absorbed the previous version of this doc: `design/spark-hub/Spark Hub App.dc.html` matches the build as of Update 6, and the Event Page Options file's Rounds 64–66 (kept in the design zip) are now built: 64a empty states, 64b Help out host tools, 64c Pick a shift / Find a replacement, 64d who thanked, 64f Edit what you need rows, 64g View as a tester, 65a edits that tell people, 65b delete note, 65c Make home, 65d the TBD badge and month strip, 66e Welcome copy. The earlier READMEs (`README-v6.md`, `README-v6-update-2.md` … `-6.md`) still describe everything else.
- **As of:** 2026-09-29, v6 Update 7 is built

Where this doc and the design files disagree, **this doc is correct**.

---

## 1. What changed since the design

| # | Change | Design said | Why |
|---|---|---|---|
| 1 | **Find a replacement** has no *You stay signed up until someone takes it.* line, and quotes the build's message (*Hey! I can't make it to {job} for {event} anymore. Any chance you could take my spot?* + link) | That line, and *Can anyone take my spot …?* | It only opens from *You're off it*, after you've already taken yourself off |
| 2 | **Updates from edits go to everyone who replied or signed up** (the *Everyone* audience); the preview line reads *Goes to the N people going and the M maybes.* when that's everyone, otherwise *Goes to the N people who replied or signed up.* | Going and maybes | Uses the existing update audiences (someone who said Can't may want to know about a new date) |
| 3 | **Search with a Try chip and no text**: *No events match {chip}.* · *Try taking it off.* | *… Kid-friendly + Needs helpers.* · *Try taking one off.* | Search takes one Try chip at a time |
| 4 | **Help out job cards** keep the job's time in the gray line (*8:30am · 3 of 6 · 3 still needed*) and the description under the bar | No time on the card | Times matter for jobs; descriptions came with Update 5 |
| 5 | **Could use a hand** keeps its per-event cards with **Claim**; a shift's row reads *12:00 – 1:30pm · 2 of 2 open* in amber 800 | A single-job card with *Sign up* | Small change to the existing sheet |
| 6 | **Update notifications** read *{event} · {update}* with *From {host} · 5m ago · {group}* for every host update, including ones sent with *Send everyone an update* | Shown for an edit's update | One format for all updates |
| 7 | **Pick a shift** keeps the job's description under the date line | Not shown | Update 5 descriptions |

## 2. Things the build had to invent (please design these properly)

- **Tell everyone going, on:** the switch's second line reads *On: they get an update when you save* (off: *Off: it saves quietly*). The switch only shows when someone has replied or signed up.
- **Notes when something comes down** (Notifications → Updates, red **!** badge, the host's face): *{event} is off. {host} took it down.* and *“{job}” is off the list for {event}.* Tapping one only marks it read (there's nothing to open).
- **Make home, after the move:** tapping the new home's row says *{group} is its home now*. Below the list, *The home group's admins can edit or delete it.* shows whenever more than one group is ticked.
- **Who thanked** is a pop-up (the build's modal style, not a slide-up sheet), titled *Thanks for {host first name}*; your own row reads *You*.
- **Phone notifications (web push, owner 2026-09-29):** a card at the top of the Notifications sheet (white card, 36px lavender `#f3f1fe` circle with a purple bell): *Get these on your phone* · *We'll buzz you when a plan changes, something new goes up, or the day before you're going.* · purple **Turn on notifications** pill, and a gray ✕ (*Not now*, remembered on the device). In iPhone Safari (not installed) it reads *Get these on your iPhone* · *Add Spark Hub to your Home Screen first: tap Share, then Add to Home Screen. Open it from there and turn them on.* with no button. Notification settings gets a gray `#f4f5f7` row first: **Phone notifications** with a switch (*On / Off for this phone*), or *Blocked. Allow them for Spark Hub in your phone's Settings.* The push itself: title = the event (or *New in {group}: {event}*, *Tomorrow: {event}*), body = the same line as the in-app feed. Please design the card, the settings row and when to ask.
- **Add to Home Screen (owner 2026-09-29):** a card last in the Calendar's discovery stack, shown only when the app isn't installed (white card, the 40px app icon, gray ✕ *Not now* remembered on the device): *Put Spark Hub on your Home Screen*. On Android Chrome the line reads *It opens full screen, like any app, and can buzz you when plans change.* with a purple **Install app** pill that opens Chrome's own install dialog (Chrome only offers it to the site itself, once per visit). In iPhone Safari or Chrome (no install prompt exists) it reads *{Safari|Chrome} adds it in a few taps. Then it opens full screen, like any app.* with **Show me how**, which opens a floating white guide above the tab bar with a caret pointing down at Safari's bar: *Add Spark Hub to your Home Screen* · ① *Tap Share [blue share icon] in Safari's bar below. No Share? Tap ··· first.* (in Chrome: *in Chrome's address bar*, no caret) ② *Tap Add to Home Screen, then Add.* ③ *Open Spark Hub from your Home Screen.* Profile → Settings gets an **Add to Home Screen** row (*Install Spark Hub on this phone* / *A few taps in {Safari|Chrome}'s Share menu*) that does the same, even after the card is put away. Nothing shows in other browsers or the installed app. Please design the card, the guide and when to show them.
- **Delete / remove confirms with one person:** *The 1 person going gets a note that it's off.* / *The 1 person signed up gets a note that it's off the list.* With nobody else, the note line is left out.

## 3. Behaviour added in the build (no visual change)

- **Month view, empty day:** *Start an event on {date}* opens Create event with that date filled in; it's hidden on past days.
- **The TBD strip** switches the Calendar to List (remembered, as picking List would be) and scrolls to *Date to be decided*.
- **Make home** happens on Save: new groups are added first, then the home moves (`set_home_group()`), then unticked groups come off.
- **Removing a job** in Edit what you need also sends the note to the people signed up, not just the Help out ✕.
- **Push** follows the in-app feed's rules and each person's topics; a topic that's off is off on the phone too. Demo seeding never pushes, and reminders skip demo events. Signing out removes that phone's push.
- **Home Screen badge** (installed app, notifications allowed): the icon's red number is the bell's unread count; each push adds one while the app is closed, and opening the app sets it back to the real count (cleared at zero).
- **Second address:** https://sparkhub.wereallneighbors.org serves the live app alongside gosparkhub.vercel.app.
- **Admins** who edit a title or Basic details don't get the switch (only the host posts updates).

## 4. Designed but not built or not working

- **"We'll let {Host} know"** (You're off it): nothing is sent yet. Notifications are built from what's stored, so the host just sees one fewer name on the job.
- **The event preview slide-up** (Task Card Options, Round 13) is still undecided, so it isn't built.
- **Say hi** on the Hosted by card: there's no messaging yet, so it shows a toast *Messages are coming soon. For now, say hi to {first name} at the event!*
- **The CTA pills on to-do rows** don't do their action; as in the prototype, tapping the rows expands them (3+) or opens the event.
- **"Include ideas"** on the Calendar (in the prototype's code, not the README) isn't built; the Calendar lists plans.

## 5. Open questions for the next round

1. Everything in the README's **Open / not designed yet** list still stands (categories, first-run view for an empty group, removing members, leaving a group, Suggest vs Offer wording, first vs full names).
2. **A real invite list** (pick neighbors or the whole group) would bring back Invited on the stats strip, "haven't replied · Nudge" and "invited you" notifications — design it next? (Invites are share links today, so nothing counts them.)
3. **Minimum people** on ideas ("How many do you need?") has no input yet, so the People checkpoint rarely completes.
10. **Event types:** the placeholder keyword guesses are shown to people as filters; host-chosen tags (v6 open item) would replace them.
11. **Event preview slide-up** (v6 options 13a/13b/13c) is still undecided.
4. **Invite link screens** (the current sign-in-to-join flow is a stopgap).
5. **Owner controls** in the Members sheet: pill + text button per row at 393px, or a per-row menu?
6. **Google's sign-in screen** says "continue to …supabase.co" until Spark Hub has its own sign-in domain.
7. **Video on the vibe board** is parked (needs a ~20 s / 25 MB cap).
8. **Spark Hub address:** gosparkhub.vercel.app for now; a custom domain may follow.
9. **Send feedback / Ask a question:** where should these go (email to the owner, a form)? Until there's an answer they stay out of Help & info.

12. **Your place, bio and "member since"** are no longer shown anywhere for yourself (Update 2 keeps them "for viewing other people", which isn't designed or built yet). Design a public profile view, or show them somewhere on your own sheet?

## 6. Design tokens

As listed in the v5.2 and v6 READMEs (v6 role colours: Leading `#5b4ae8` / `#f7f6ff` / `#4a3ad4`, Helping `#e8a71c` / `#fefaef` / `#8f6405`, Going `#149a4b` / `#f3fbf6` / `#0f7a3c`, not joined `#c3c7d0` / `#fafafb`) (ink `#0d1117`, inactive title `#c3c7d0`, inactive tab `#6b7280`, active tab `#5b4ae8`, page `#e8eaee`, purple `#5b4ae8` / `#4a3ad4` / `#eeebff`, green `#149a4b` / `#0f7a3c` / `#e7f6ec`, gold `#e8a71c` / `#f5b428` / `#8f6405` / `#fdf1d6`, red `#e2556b`; owner chip `#ece9fd` / `#4a3ad4`, admin chip `#fdf1d6` / `#8f6405`).
