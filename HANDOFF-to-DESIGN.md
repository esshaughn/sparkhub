# Handoff: Spark Hub — live build → Claude Design

**Direction:** code → design. This describes what's built, so the next design round starts from what shipped rather than from the design file.

- **Built (test):** https://gosparkhub-git-test-eric-5958s-projects.vercel.app · **Live:** https://gosparkhub.vercel.app (also https://sparkhub.wereallneighbors.org)
- **Source:** github.com/esshaughn/sparkhub (`index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, `supabase/templates/`)
- **Baseline:** Claude Design's **round v8-5** (zip *Spark Hub v8-5*, 2026-10-05: `design/spark-hub/Spark Hub App Version 8.dc.html` and `design/spark-hub/HANDOFF-to-CODE.md`). Its HANDOFF-to-CODE says it caught up with this doc as of Oct 5, late night (the copy Design has calls it *HANDOFF-to-DESIGN-5*, through row 77), so this doc was reset: everything below is where the build differs from v8-5, plus the three rows (78–80) that came after Design's copy.
- **Build version:** **v7** (owner, 2026-10-02): a lead is a choice. An idea is either led (*I'll lead it*) or floated (no lead yet), and a floated one can be handed to someone.
- **As of:** 2026-10-06: no *This week* on My calendar (row 96). 2026-10-05, night: built round **v8-5**, which also carried v8-3 and v8-4 (they never reached the build on their own): the five tabs with Ideas, Me's Settings slide-up, the Ideas board, the idea slide-up and idea page, the Float sheet, the + menu, idea drafts, the starter's page and times on calendar pages.

Where this doc and the design files disagree, **this doc is correct**. One file per side: please keep sending `HANDOFF-to-CODE.md`; this file is the reply (Design's instructions asked for a `HANDOFF-to-DESIGN-6.md`, and this is that file).

---

## Round v8-5 in short

*Caught up with HANDOFF-to-CODE v8-5 as of 2026-10-05.*

| v8-5 item | Status |
|---|---|
| 1. + menu (17d) | Done: Make a plan / Float an idea pills, dark ×; the Ideas tab keeps its gold + to Float. Two doors is gone |
| 2. Plan an event → Float the idea | Done: the Float sheet opens over Plan an event with the title, overview and photo; × goes back to it untouched |
| 3. Float sheet page 1 | Done, with the Set date / Create poll and Set location / Create poll pop-ups and the time chips |
| 4. Pick this up later? | Done: one idea draft per account on the device; *Picked up your draft* |
| 5. Posting opens the slide-up | Done |
| 6. Starter's idea page (18b + 19a + 20a) | Done for floated ideas, with changes (rows 81, 83–87) |
| 7. Member idea page all gold | Done for floated ideas (row 81) |
| 8. Times on calendar pages | Done |
| v8-4 1–8 and the v8-3 changes in the prototype | Done, except the group *Invite people* flow (§4) |

---

## 1. What changed since the design

(Numbers continue from before the reset.)

| # | Change | Design said | Why |
|---|---|---|---|
| 80 | **A Thought partner starter chip** on Plan an event's Join in, HELP, after Coordinate: *Thought partner*, gray filler *to brainstorm with…*; unlike the verb chips it can be saved as it is | v8: Bring · Set up · Help · Clean up · Coordinate · Other | Jeni Wade's demo, 2026-10-05: she read *Coordinate* as logistics and wanted someone to think it through with. (Rows 78–79, Plan an event's own float path, are gone: Float the idea now opens the Float sheet) |
| 81 | **Only floated ideas (no lead yet) get the new idea page** (slide-up and full page, member and starter), unless they have jobs or spots (a plan whose lead stepped back can). An idea with a lead keeps the plan-style idea page: Led by, Help out, Take part, What to expect, Discussion, ⋯ Edit / Cancel or delete. When a floated idea gets a lead, it moves to that page | v8-5: the new page for every idea except one you lead but didn't float | The new page has no Help out, Take part, Discussion, Edit or delete, which led ideas use today; the owner kept the plan-style page for them on 2026-10-05 (Q30). §5 Q31 |
| 82 | **Members can lead a floated idea** (the build's stand-in until the float brief is drawn): a fourth row in *Help make this a plan*, with the lightning bolt. *Who leads it: Anyone*, or once the starter asked you: **Lead it** (*Lead it · Hana asked you*), which takes the lead after the usual *Lead …?* confirm. *I decide*: **Offer to lead** → toast *You offered. Hana decides.*, then the row reads *You offered · Hana decides* (16px/700 `#454b55`, pale gold icon circle). Only for people in the idea's groups | No lead row (BRIEF-float-the-idea, parked) | Without it nobody but the starter could ever lead a floated idea |
| 83 | **Choose a lead** lists the people who offered (*Offered to lead*), each with a gold-outlined **Ask** (it sends the build's ask to lead; they say yes with *Lead it*), *Asked* once sent; toast *Asked Hana to lead. We let them know.* Under the list, **Ask someone else** (14.5px/800 `#8f6405`) opens the build's *Ask someone to lead* sheet (anyone in the idea's groups). The Choose lead row's sub line reads *Asked Otto* while an ask waits | *Pick* (they lead straight away) | Someone becomes the lead only once they agree |
| 84 | **Make this a plan acts on the real idea:** *Pick* on Date or Location uses the build's *Pick …?* confirm, which sets it and closes that poll; *Change* opens *Set date* / *Set location*; *Add* opens *Edit dates* / *Edit locations*. With no votes yet the sub line reads *No votes yet* (not *(0 of 0)*). *I'll lead it* makes the starter the lead, so the idea moves to the plan-style page, where *Make it a plan!* lives | Picks kept for the session; Make it a plan opens Plan an event | One idea, not a second event made from it |
| 85 | **Edit dates:** an existing date can be removed (its votes go with it) but not re-timed; the time chips are on the dates you add | Time chips on every row | Changing a date's time would wipe its votes |
| 86 | **Who can see it:** the group it was posted to can't be unticked (toast *It stays in Torrez Fitness, where it was posted*); the others tick on and off | Any group, at least one | Moving an idea's home group is its own action in the build |
| 87 | **Delete this idea** sits at the very bottom of the starter's page (14px/700 `#9b1c31`, centred), and asks first as usual | No way to delete | The new page has no ⋯ |
| 88 | **Me's gear sits right of the bell** (44px gray circle) | HANDOFF: far left | The prototype puts it on the right |
| 89 | **The floating + no longer tucks away** on scroll | v7 pick 1b | The v8-5 prototype dropped the tuck |
| 90 | **The time chips are on idea dates only** (the Float sheet, Suggest a date, Edit dates, Set date). Plan an event keeps the owner's tap grid for times | *Everywhere dates are entered* | An event's start time needs a clock time; the owner chose the grid (2026-10-03) |
| 91 | **From Plan an event, × on the Float sheet closes it without asking** about a draft | The prototype asks *Pick this up later?* | HANDOFF: × returns to Plan an event untouched (the typing is still there) |
| 92 | **When an idea was floated** reads the build's way: *Floated by Vic · 17m ago*, *Yesterday*, *3 days ago* | *2 hours ago* | One style across the app |
| 93 | **Invite a friend** on an idea opens the build's Invite people sheet (purple), where friends already interested show a gold **Interested** and can't be picked | The gold Invite people variant | The variant isn't built yet |
| 94 | **Suggest a date / Suggest a location on an idea** are centred gold pop-ups (*Everyone can vote on it.*; the date with the time chips). The location is plain text (no place search) | Not drawn for v8-4's page | All idea pop-ups are centred and gold |
| 95 | **Ask someone to take a job** shows who's been asked at the top in a gray box (*Asked · waiting*, *Said yes*, *Can't this time*, the note in italics) with **Withdraw** while they haven't answered; they drop out of the list below | As drawn (v8-3) | Built from the prototype; answers old §4 *Withdrawing an ask* |
| 96 | **My calendar's Up next has no *This week* heading**: after the big card, the list goes straight into months (*October*, *November*…, then *Date TBD*). Group pages keep *This week* | v8: This week, then each month | Owner, 2026-10-06 |

## 2. Things the build had to invent (please design these properly)

- **Contact {starter}'s note** (*Talk it through*): the starter's bell and phone get *Dee would like to talk through Kite day with you.*
- **Float sheet messages:** *Add at least two dates* / *Add at least two locations* (a poll's Done with fewer), *Pick a date*, *Add a location*, *Couldn't save the draft on this phone*, and the post button reads *Floating…* while it saves. Posting asks for your name first if your account has none (the usual *Your name* pop-up, over the sheet).
- **Suggesting on an idea:** toasts *Date added. Vic will see it.* / *Location added. Vic will see it.*; editing dates or locations, title or description: *Saved*.

## 3. Behaviour added in the build (no visual change)

- **Migration `20261107000000_float_sheet.sql`:** `sparks.talk` (Talk it through, default off) and `sparks.lead_rule` (`me` | `any`); the overview (SHORT DESCRIPTION) is up to 120 characters (was 80); `date_options.day_part` (`morning` | `afternoon` | `evening`, instead of a clock time); `talk_offers` and `offer_to_talk()` (Contact {starter}: kept so the button reads *✓ Vic will be in touch*; 10 an hour; you see your own, the starter sees all on their ideas).
- **A floated idea:** the starter is its lead in the database, with *looking for a lead* on (as before), so the starter can edit it, remove dates and locations, and delete it. *Talk it through* and *Who leads it* are saved on the idea; *Anyone* lets a member's *Lead it* take the lead straight away (the database doesn't check the rule yet). Floating sends no push and no bell row (owner, 2026-10-02).
- **Float sheet → the idea:** the date (or the poll's dates) and the location (or the poll's) become the idea's When? / Where? options, as the HANDOFF says; nothing is set on the idea itself until a lead picks.
- **The idea draft** is one per account, on the device (with its photo); opening the Float sheet again takes it back out.
- **Links:** `#/ideas` is the Ideas tab now (it used to open a group's Ideas · Plans · Past, which is `#/browse`). My tasks is still `#/tasks`; Back from an event opened on the Ideas tab says *Ideas*.
- **The slide-up:** swipe up, scroll, the chevron or *I'm interested* grows it; a swipe down at the top or × closes it. Taking the lead, or the idea becoming a plan, while it's open closes it.

## 4. Designed but not built or not working

- **The group Invite people flow** in the v8-5 prototype (Share your invite link, Show QR code, Add friends, *You've invited* with Take back, the invite card on My groups): it needs personal group invites, which the build doesn't have (a new table and rules; `GROUP-INVITES-for-design.md`). Held for its own round; the HANDOFF's *New since* lists didn't mention it, so §5 Q33 asks how it should work.
- **Short event links** (`sparkhub.wereallneighbors.org/e/…` in the prototype's share sheet): the build's links stay `/i/{id}`.
- **The gold Invite people sheet** for ideas (row 93).
- **The comment notification** (v8-1 *Still open*): nobody is told about a comment or a reply yet, not even the lead.
- **Guest text reminders** (*Take part*): not built, no SMS service yet (owner, 2026-10-05).
- **Leading filtered to a group** is built, but nothing opens it that way.
- **Maybe's pale-green tile chip** shows on the strip only (the build's tiles have no role chip on the photo).

## 5. Open questions for the next round

(Numbers kept from before the reset. 11 and 30, redrawing the idea page, are answered by v8-5's idea page, apart from Q31.)

1. Everything in the README's **Open / not designed yet** list still stands (categories, first-run view for an empty group, Suggest vs Offer wording, first vs full names).
4. **Invite link 1b** (*Ana Torrez invited you · 20 members*) needs a public read of the inviter and member count by code. Worth a migration for the pilot, or leave it at 1a?
6. **Google's sign-in screen** says "continue to …supabase.co" until Spark Hub has its own sign-in domain.
7. **Video on the vibe board** is parked (needs a ~20 s / 25 MB cap).
8. **Spark Hub address:** gosparkhub.vercel.app and sparkhub.wereallneighbors.org both serve the live app. Pick one to show people?
9. **Give feedback:** *Ask a question* as a separate thing, and whether feedback should also be reachable from Welcome or the invite landing.
10. **Your place, bio and "member since"** aren't shown anywhere for yourself. A public profile view, or somewhere on Me?
12. **How Spark Hub works** (Me, SOON): the copy still needs a home now that the screen is gone (Design's Q12).
15. **Consistency audit, held by the owner (2026-10-01):** one sort and filter control on every list, the same view names and order, one date style, one undated wording, one empty-state button label.
16. **Test events:** they share the seeded content's *DEMO* pill, and the host can't switch one to real after posting.
18. **Give feedback's green:** the app's Going green `#149a4b` or the owner's softer mock green?
19. **Pop-up heights:** one rule for pop-ups with drop-downs?
21. **Ideas that need a lead:** with the Ideas tab, where should members be reminded of them, and should the group hear once a floated idea gets a lead?
22. **Inviting to a group:** only owners and admins can read a group's link today. Should every member be able to share it? (Part of Q33.)
23. **Emily and Cynthia's demos:** **B**, keeping undated things out of date-ordered lists, is still open (A is parked by the owner).
24. **Joseph and Cynthia's feedback:** (e) *Start here* stays parked; (f) telling people an event link works without joining the group; (g) later: a per-event chat for on-the-day changes.
26. **A welcome tour** (parked by the owner): `WELCOME-TOUR-for-design.md`.
28. **Place on profiles:** v8's Edit profile has no Place. Drop it everywhere, or keep it?
29. **The Leading page** (`#/own`, with its title switch) has no way in since v8. Retire it?
31. **Ideas with a lead** (row 81): should they move to the new idea page? If so, where do Help out, Take part, What to expect, Discussion and the lead's Edit / Cancel or delete go on it, and where does *Make it a plan!* sit for the lead?
32. **Lead it / Offer to lead** for members (row 82) and the starter's *Pick* (row 83) are the build's stand-ins. Please draw them with BRIEF-float-the-idea, including what the person who offered sees while they wait.
33. **Group invites** (§4): who can invite, whether *Add friends* reaches people outside your friends, what the invited person sees and can do (Join / Not now), whether Take back tells anyone, and whether invites expire. The prototype draws the screens; the rules behind them aren't written in HANDOFF-to-CODE.
34. **The time chips in Plan an event** (row 90): should an event's start time also allow Morning / Afternoon / Evening?
35. **A mismatch in the zip:** `screens/02 Plus menu.png` shows the starter's slide-up, not the + menu; the prototype was followed.

## 6. Design tokens

As listed in the v8-5 INSTRUCTIONS: purple `#5b4ae8`, ink `#0d1117`, greys `#6b7280` `#454b55` `#e8eaee` `#f2f3f6`, green `#149a4b`, gold `#f5b428` / `#8f6405` (ideas), teal `#0e8a84` / `#e6f6f4` (Helping, now on the event page's *You're helping* band too), pink `#d6246e` (updates). Idea screens are all gold.
