# Handoff: Spark Hub — live build → Claude Design

**Direction:** code → design. This describes what's built, so the next design round starts from what shipped rather than from the design file.

- **Built (test):** https://gosparkhub-git-test-eric-5958s-projects.vercel.app · **Live:** https://gosparkhub.vercel.app (also https://sparkhub.wereallneighbors.org)
- **Source:** github.com/esshaughn/sparkhub (`index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, `supabase/templates/`)
- **Baseline:** Claude Design's **Spark Hub v7, Update 16** (`design/spark-hub/Spark Hub App Version 7.dc.html`; `README.md`, `README-v6-update-2.md` … `-14.md`, `README-v7-update-15.md` and `README-v7-update-16.md`). Update 16 (zip *Spark Hub v7-5*, 2026-10-03) brought the design file in line with this doc's rows 1–17 and §2 and added the new tab bar and opening screen (Explore · Your tasks · Your calendar · Groups · Profile; the app opens on Your calendar; a group pick per screen). It's built, so this doc was reset: everything below is where the build differs from Update 16.
- **Build version:** **v7** (owner, 2026-10-02): a lead is now a choice. An idea is either led (*I'll lead it*) or floated (*Just float the idea*, looking for a lead), and a floated one can be handed to someone by asking them. Design's Version 7 file predates this; it's in §2 and §3 below.
- **As of:** 2026-10-03, afternoon (later: §1 rows 5–6, §5 Q26): built everything in `design/spark-hub/HANDOFF-to-CODE.md`'s *New since 2026-10-03* list (items 1–13 and 15; 14 needs nothing). Design took in this doc's earlier §1 rows 1–4, so they're gone. Below is only where the build differs or had to fill a gap.

Where this doc and the design files disagree, **this doc is correct**.

---

## 1. What changed since the design

| # | Change | Design said | Why |
|---|---|---|---|
| 1 | **Ask for help** also names Review's card (*Edit ask for help*), its Edit pop-up and the Add a job sheet's eyebrow, not only step 5's title | Step 5's title | One name for the step everywhere |
| 2 | **Invite people:** a person already invited reads *✓ Invited* as purple text (no pill). After Send invites the toast is *Invited Hana and Joseph* for one or two, *Invited Hana, Joseph and 2 more* for three or more | — | Build's reading of *Invite people* |
| 3 | **Explore's *Needs help* card** reads *3 events need help* / *1 event needs help*; its sheet is titled *Needs help* | — | *Sort and filter words* |
| 4 | **The voting card's hold line wraps** to two lines on a phone when the lead's *Keep holding* pill sits beside it (*Holding until Sat, Oct / 10*) | One line | Width; worth a look |
| 5 | **The feedback ask comes after about 5 minutes in the app** (owner, 2026-10-03), still counted only while it's on screen, across visits, once per account on a device; the owner's inbox now says *from the feedback card* | About 10 minutes | Owner |
| 6 | **Ask someone to take a job: tick, a note each, then Send asks** (owner, 2026-10-03). The intro is one line, *Ask up to 2 people. Add a note if you like.* (no *0 of 2 asked*). Each person has a 26px round tick, as in Invite people; past two (or one, when an ask is already waiting) the rest grey out. Ticking someone opens a two-line note box under their row, *I thought of you because…* as its placeholder, optional and theirs alone. A full-width **Send asks · N** (gray *Send asks* until someone's ticked) sends them together, closes the pop-up and toasts *Asked Hana and Lin*. The note is optional on the server too (`20261103020000_job_ask_note_optional.sql`); with none, the push is just the event | One required *I THOUGHT OF YOU BECAUSE…* line shared by everyone, and an **Ask** pill per person that sent at once | Owner: one note for both people isn't personal; picking then sending is clearer |
| 7 | **A job to fill reads *Fill spot:* / *Fill 2 spots:*** in bold, then the job in regular weight (*· 1 asked* after it while asks wait), with the **Ask** (or **Share**) pill at the right, on Your tasks' Leading cards and on the event page's Your tasks rows alike (owner, 2026-10-03) | *Barricades: 2 spots to fill* in one weight; on the event page, the count at the right and no pill | Owner: the action first, shorter |

## 2. Things the build had to invent (please design these properly)

- **Add a job, the other four verbs' chips** (*Add a job* gives Bring's only). Set up: *chairs · tables · the canopy · signs · music*. Help with: *check-in · the grill · parking · kids' games · photos*. Clean up: *trash · tables · chairs · dishes · recycling*. Coordinate: *food · rides · the schedule · supplies · helpers*. Same lavender `#f3f1fe` / `#4a3ad4` 34px chips as Bring. With the details hidden, the head count (− 1 +) sits on the right of the *+ Add details or a time* row.
- **Explore's Ideas and Past cards** (*Explore: Plans · Ideas · Past* says what's listed, not how a card reads). Ideas: the usual list card with the gold bar and a strip reading **Idea** · *See*, under one heading *Ideas*. Past: a gray strip reading **You went** (you went or led it) or **Happened** · *See*, grouped by month, newest first. The menu's icons are the build's (a calendar with a check, the bulb, a clock with a back arrow). Empty: *No ideas in your groups yet.* / *Nothing has happened in your groups yet.* The pill sits in Month's header too.
- **The lead's two hold reminders in the bell** (*Soft holds*, drawn as 5a but not wired): the row is the idea's title, a dot, then *6 voted, Saturday leads. Lock it in?* or *Your dates for Book club stop holding tomorrow. Keep holding?*, under *Things you're leading*. The face is a 44px dashed `#d9c58a` circle on `#fdf6dc` with the gold pencil and the ★ badge. Tapping opens the idea at its voting card.

## 3. Behaviour added in the build (no visual change)

- **Links:** Explore is `#/explore` (`#/calendar` still opens it); Your calendar is the bare address, so a reload, Back with no history, signing out and the old fallbacks (an event that's gone, a group you deleted) land there. *See what's up now →* on the gone card goes to Explore.
- **Torrez Fitness's invite link joins Torrez Fitness only** (owner, 2026-10-03; it used to add Hub on Hunters too). **A new member's Explore starts on the group they joined**; Your calendar and Your tasks start on all groups. Each screen's pick is saved on the device, and a group you've left drops out of it.
- **Soft holds** (`20261103000000_soft_holds.sql`), built as specced in *Soft holds*, with these rules: the poll's first date sets the hold to 7 days on (later dates share it); *Keep holding* and *Hold them again* are the same action, 7 days from today, for the lead and co-leads; a date that has passed drops off; a set date or a cancelled idea ends the holds at once. Polls already running got 7 days from their first date, so most show as lapsed until the lead holds them again. The two reminders go out in the 8am job, never for test or demo events or an idea that's looking for a lead; *Lock it in?* goes once per hold (Keep holding lets it go again), counts the people who voted on any date, and shows in the bell only after the push went.
- **No help needed is saved on the event** (Jobs in the idea's steps): picking it in Start an event marks the idea's *Jobs* step done, like a job would. Adding a job in the flow clears the pick.
- **Your calendar's Filter** dropped *Needs help* and *This week*; a group page's Filter still has them.

## 4. Designed but not built or not working

- **Send everyone an update has no way in** (*Event page RSVP*). Your file says the lead's Your tasks rows and Edit event still send updates, but the build's Edit event never had it, and the only task row that sends one is *Thank your helpers* after the event. The owner said hide it anyway for now (2026-10-03), so leads can't post an update to an upcoming event until it has a place. Please give it one.
- **Leading filtered to a group** (the gray group line above the list) is built, but nothing opens it that way: the build's group pages have no *View all* into Leading.
- **Maybe's pale-green tile chip** (`#a9d6ba` on `#0f3d22`): the build's tiles have no role chip on the photo, only the strip under it, so Maybe's lighter colours show on the strip, the list cards' bar and the date line.

## 5. Open questions for the next round

(Numbers kept from before the reset; 2, 3, 5, 14 and 17 were answered by Updates 14–15, 25 (the tab bar and opening screen) by Update 16, and 20 (soft holds) by Design's HANDOFF-to-CODE.)

1. Everything in the README's **Open / not designed yet** list still stands (categories, first-run view for an empty group, Suggest vs Offer wording, first vs full names).
4. **Invite link 1b** (*Ana Torrez invited you · 20 members*) needs a public read of the inviter and member count by code. Worth a migration for the pilot, or leave it at 1a?
6. **Google's sign-in screen** says "continue to …supabase.co" until Spark Hub has its own sign-in domain.
7. **Video on the vibe board** is parked (needs a ~20 s / 25 MB cap).
8. **Spark Hub address:** gosparkhub.vercel.app and sparkhub.wereallneighbors.org both serve the live app. Pick one to show people (links, emails, the home-screen app)?
9. **Give feedback** is built as designed in Update 9 (Help & info tile, sheet, Thank you, the owner's inbox). Still open: *Ask a question* as a separate thing, and whether feedback should also be reachable from Welcome or the invite landing.
10. **Your place, bio and "member since"** are no longer shown anywhere for yourself (Update 2 keeps them "for viewing other people", which isn't designed or built yet). Design a public profile view, or show them somewhere on your own sheet?
11. **The idea page** now borrows the plan page's design (old row 66). Worth a proper design pass: the gold IDEA chip and sticker, where *I'm interested* sits, and whether the steps strip should look more like the plan's tasks bar.
12. **How this works** (Profile → Help & info) still has the original placeholder copy; the owner parked a rewrite for later (2026-09-30). It should explain ideas vs plans, that taking a job counts as going, and both reminders.
15. **Consistency audit, held by the owner (2026-10-01):** one sort and filter control on every list (a ringed pill, gray text and an underlined row today), the same view names and order (*Up next* vs *List*; Tiles/List/Month in three orders), the same section headings under Soonest, one date style (relative vs *Sat, Oct 10*), one undated wording (*Date TBD* / *Date to be decided* / *No date yet*), one empty-state button label (*Create* / *Post* / *Start an event*), and whether the short white sheets should get the tall sheets' gray body.
16. **Test events:** they share the seeded content's *DEMO* pill, and the host can't switch one to real after posting (they delete and post again). Should tests get their own look (*TEST*), and should the host be able to make a test real?
18. **Give feedback's green** (old row 118): the build uses the app's Going green `#149a4b`; the owner's mock was a softer green. Pick one for the tile and its top edge.
19. **Pop-up heights:** Create a poll (dates) and Add a job now open tall (up to 700 / 580px) so a list or calendar fits; everything else still fits its content and scrolls. One rule for pop-ups with drop-downs?
23. **Emily and Cynthia's demos (2026-10-02),** in `FEEDBACK-ADDENDUM-for-design.md`: **A** (one date-ordered view with your commitments under it; Your tasks as one to-do feed) is **parked by the owner (2026-10-03), don't draw it**. **C** (Jobs in the idea's steps) is built from Design's file. Still open: **B**, keeping undated things out of date-ordered lists.
24. **Joseph and Cynthia's feedback (2026-10-03)**, full list in `BACKLOG.md`. (a)–(d) are answered in Design's file and built (§1–§3 above; (d) was no change). Still open: (e) choosing your own opening screen (*Start here*) stays **parked** (owner); (f) telling people an event link works without joining the group; (g) later: a per-event chat or lead updates for on-the-day changes.
26. **A welcome tour** (owner, 2026-10-03; **parked for later, not for this round**; brainstorm, nothing built). Five to eight simple full-screen slides in the owner's voice: who he is and why he made Spark Hub, ideas becoming plans, nobody doing it alone, what stage it's at (the demo page's disclaimers), what he's asking (use it, give feedback), and where things are, ending on the real tab bar. It plays once per account, and again from Profile → Help & info. Brief with draft copy and seven open questions: `WELCOME-TOUR-for-design.md`.
22. **Inviting to a group:** only owners and admins can read a group's link, so plain members don't get Invite or Copy link in the ⋯ menu (row 5). Should every member be able to share the group's link?
21. **Ideas that need a lead** (owner, 2026-10-02: *less important than ideas with leads*, and no notification): where should members be reminded of them? Today only the *NEEDS A LEAD* chip on the Ideas board says so. Options to draw: a quiet *N ideas need a lead* row at the top of the Ideas board, floated ideas sorted after led ones, a line in a weekly digest. Also: should *Just float the idea* stay behind Review's Lead card, and should the group hear once a floated idea gets a lead (nobody was told when it was posted)?

## 6. Design tokens

As listed in the v5.2 and v6 READMEs (v6 role colours: Leading `#5b4ae8` / `#f7f6ff` / `#4a3ad4`, Helping `#e8a71c` / `#fefaef` / `#8f6405`, Going `#149a4b` / `#f3fbf6` / `#0f7a3c`, not joined `#c3c7d0` / `#fafafb`) (ink `#0d1117`, inactive title `#c3c7d0`, inactive tab `#6b7280`, active tab `#5b4ae8`, page `#e8eaee`, purple `#5b4ae8` / `#4a3ad4` / `#eeebff`, green `#149a4b` / `#0f7a3c` / `#e7f6ec`, gold `#e8a71c` / `#f5b428` / `#8f6405` / `#fdf1d6`, red `#e2556b`; owner chip `#ece9fd` / `#4a3ad4`, admin chip `#fdf1d6` / `#8f6405`).
