# Handoff: Spark Hub — live build → Claude Design

**Direction:** code → design. This describes what's built, so the next design round starts from what shipped rather than from the design file.

- **Built (test):** https://gosparkhub-git-test-eric-5958s-projects.vercel.app · **Live:** https://gosparkhub.vercel.app (also https://sparkhub.wereallneighbors.org)
- **Source:** github.com/esshaughn/sparkhub (`index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, `supabase/templates/`)
- **Baseline:** Claude Design's **round v8-6** (zip *Spark Hub v8-6*, 2026-10-06: `design/spark-hub/Spark Hub App Version 8.dc.html` and `design/spark-hub/HANDOFF-to-CODE.md`). Its HANDOFF-to-CODE says it caught up with this doc as of Oct 6, early morning (*HANDOFF-to-DESIGN-5*), so this doc was reset: rows 80–95 are gone from §1. Rows 96–97 landed around the time Design read it, so they stay.
- **Build version:** **v7** (owner, 2026-10-02): a lead is a choice. An idea is either led (*I'll lead it*) or floated (no lead yet), and a floated one can be handed to someone. Since v8-6, Plan an event is always led by whoever makes it; floating is the + menu's *Float an idea*.
- **As of:** 2026-10-06: built round **v8-6**: Plan an event in 4 steps (page 1 with the cover box, title, date & time and location; What to expect with quick details folded; Join in; Review's *Ready to post*), centred edit pop-ups, Post to with Public / Private rows, the sparkle *Post it*, the sheet over the screen you came from, Helping in orange, 46px fields in Create a poll. Earlier the same day: no *This week* on My calendar (row 96); no automatic Add to Home Screen pop-up (row 97).

Where this doc and the design files disagree, **this doc is correct**. One file per side: please keep sending `HANDOFF-to-CODE.md`; this file is the reply (call it *HANDOFF-to-DESIGN-6*).

---

## Round v8-6 in short

*Caught up with HANDOFF-to-CODE v8-6 as of 2026-10-06.*

| v8-6 item | Status |
|---|---|
| 1. Plan an event in 4 steps | Done: page 1 (cover box, Event title, Date & time with Create a poll, Location (optional) with Create a poll), Add photo pill on pages 2–4, *Pick a date first* / *Add a title first*, 7b's Overview + *Add quick details · Up to 3*, *Add later*, purple skip links, 22px headings and 46px fields, italic placeholders, the sheet over the screen you tapped + on. No lead card anywhere. Event titles are 60 characters, as drawn. Changes: rows 99–102 |
| 2. Review (20c + 21b) | Done: *Ready to post* with *N of 4 added* and the green bar, Edit / Add rows opening centred pop-ups, Post to with the Public / Private radio rows, purple *Post it* with six sparkles, gold *Post as an idea*. Changes: rows 100–102 |
| 3. Helping is orange (14a) | Done everywhere the build shows Helping (row 103) |
| 4. No floating + on Friends | Already true in the build |
| 5. Fixes | Create a poll: the build's own date picker (no *mm/dd/yyyy*), 46px fields, *+ Add time* with the chevron only once a time is set. *Find more events* doesn't exist in the build (it became the *Start an event* slot in 2026-10-03), so there was nothing to fix |
| Still open: switching the lead after posting | Not built (nothing designed yet) |

---

## 1. What changed since the design

(Numbers continue from before the reset.)

| # | Change | Design said | Why |
|---|---|---|---|
| 96 | **My calendar's Up next has no *This week* heading**: after the big card, the list goes straight into months (*October*, *November*…, then *Date TBD*). Group pages keep *This week* | v8: This week, then each month | Owner, 2026-10-06 |
| 97 | **The Add to Home Screen pop-up (*Make this an app (kinda)*) never opens on its own**: not on Welcome, not after signing in. Tapping Me → Settings → Add to Home Screen still opens it (iPhone steps) or Chrome's dialog (Android) | Once a visit on Welcome and after signing in | Owner, 2026-10-06 |
| 99 | **Page 1's cover photo** has *Change* and a trash button; there's no *Adjust* (move up / down) on page 1 | Change, remove and adjust | The cover can still be positioned from the event page after posting |
| 100 | **Review's *What to expect* row counts the overview too**: with no quick details it shows the overview line | Done only with a quick detail | Someone who only wrote an overview has filled in that step |
| 101 | **Review's *Join in* row** stays *Add · optional* after *None needed* | (Not drawn) | Nothing was added, so it isn't counted in *N of 4* |
| 102 | **Review keeps *People going can invite friends*** (the switch) under the Post to card | Not on v8-6's Review | It sets who can invite people; nothing else in the flow does |
| 103 | **Helping is orange (`#e8661c` / `#b8480c` / `#fff1e8`) everywhere the build used gold or teal for it**: My tasks' Helping chip and dots, the Helping strip and its task rows, the event page's *You're helping* band | 14a: replaces teal / sky | The build had kept Helping gold (shared with ideas) in most places; ideas stay gold |
| 104 | **Plan an event covers the tab bar** (the sheet runs to the bottom), so a tab can't be tapped mid-flow; × still asks *Save this as a draft?* | As drawn | Before v8-6 a tab tap asked about a draft; now × is the only way out |
| 105 | **An older draft saved on the old Date & time or Location step opens on page 1** | — | Those steps are part of page 1 now |

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
- **The gold Invite people sheet** for ideas (was row 93).
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
31. **Ideas with a lead** (was row 81): should they move to the new idea page? If so, where do Help out, Take part, What to expect, Discussion and the lead's Edit / Cancel or delete go on it, and where does *Make it a plan!* sit for the lead?
32. **Lead it / Offer to lead** for members (was row 82) and the starter's *Pick* (was row 83) are the build's stand-ins. Please draw them with BRIEF-float-the-idea, including what the person who offered sees while they wait.
33. **Group invites** (§4): who can invite, whether *Add friends* reaches people outside your friends, what the invited person sees and can do (Join / Not now), whether Take back tells anyone, and whether invites expire. The prototype draws the screens; the rules behind them aren't written in HANDOFF-to-CODE.
34. **The time chips in Plan an event** (was row 90): should an event's start time also allow Morning / Afternoon / Evening?
35. **A mismatch in the zip:** `screens/02 Plus menu.png` shows the starter's slide-up, not the + menu; the prototype was followed.

## 6. Design tokens

As listed in the v8-5 INSTRUCTIONS, with v8-6's orange: purple `#5b4ae8`, ink `#0d1117`, greys `#6b7280` `#454b55` `#e8eaee` `#f2f3f6`, green `#149a4b`, gold `#f5b428` / `#8f6405` (ideas), orange `#e8661c` / `#b8480c` / `#fff1e8` (Helping, since v8-6; it replaced teal), pink `#d6246e` (updates). Idea screens are all gold.
