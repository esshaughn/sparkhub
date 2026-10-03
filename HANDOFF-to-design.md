# Handoff: Spark Hub — live build → Claude Design

**Direction:** code → design. This describes what's built, so the next design round starts from what shipped rather than from the design file.

- **Built (test):** https://gosparkhub-git-test-eric-5958s-projects.vercel.app · **Live:** https://gosparkhub.vercel.app (also https://sparkhub.wereallneighbors.org)
- **Source:** github.com/esshaughn/sparkhub (`index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, `supabase/templates/`)
- **Baseline:** Claude Design's **Spark Hub v7, Update 16** (`design/spark-hub/Spark Hub App Version 7.dc.html`; `README.md`, `README-v6-update-2.md` … `-14.md`, `README-v7-update-15.md` and `README-v7-update-16.md`). Update 16 (zip *Spark Hub v7-5*, 2026-10-03) brought the design file in line with this doc's rows 1–17 and §2 and added the new tab bar and opening screen (Explore · Your tasks · Your calendar · Groups · Profile; the app opens on Your calendar; a group pick per screen). It's built, so this doc was reset: everything below is where the build differs from Update 16.
- **Build version:** **v7** (owner, 2026-10-02): a lead is now a choice. An idea is either led (*I'll lead it*) or floated (*Just float the idea*, looking for a lead), and a floated one can be handed to someone by asking them. Design's Version 7 file predates this; it's in §2 and §3 below.
- **As of:** 2026-10-03 (reset to Update 16; its tab bar, opening screen and group lines built the same day).

Where this doc and the design files disagree, **this doc is correct**.

---

## 1. What changed since the design

| # | Change | Design said | Why |
|---|---|---|---|
| 1 | **The group line only shows when you're in two or more groups** (Your tasks and Your calendar): with one group there's nothing to pick, so the header is just the title | Always shown | Build's call |
| 2 | **Your tasks' drafts aren't narrowed by its group line**: a draft has no group until it's posted, so drafts always show in Leading | — | Build's call |
| 3 | **Explore with nothing coming up** reads *Nothing coming up in your groups yet.* (it said *Nothing on the calendar yet.*, which now reads like Your calendar) | Not in Update 16 | Build's call |
| 4 | **The Your tasks tab icon moves 3px left only while it has a count badge**, so the bare icon stays centred | Always 3px left | Build's call |

## 2. Things the build had to invent (please design these properly)

(Nothing since Update 16.)

## 3. Behaviour added in the build (no visual change)

- **Links:** Explore is `#/explore` (`#/calendar` still opens it); Your calendar is the bare address, so a reload, Back with no history, signing out and the old fallbacks (an event that's gone, a group you deleted) land there. *See what's up now →* on the gone card goes to Explore.
- **A new member's Explore starts on the group they joined** (joining Torrez Fitness also adds Hub on Hunters); Your calendar and Your tasks start on all groups. Each screen's pick is saved on the device, and a group you've left drops out of it.

## 4. Designed but not built or not working

- **Leading filtered to a group** (the gray group line above the list) is built, but nothing opens it that way: the build's group pages have no *View all* into Leading.
- **"Include ideas"** on Explore (in the prototype's code, not the README) isn't built; Explore lists plans.
- **Maybe's pale-green tile chip** (`#a9d6ba` on `#0f3d22`): the build's tiles have no role chip on the photo, only the strip under it, so Maybe's lighter colours show on the strip, the list cards' bar and the date line.

## 5. Open questions for the next round

(Numbers kept from before the reset; 2, 3, 5, 14 and 17 were answered by Updates 14–15, and 25 (the tab bar and opening screen) by Update 16.)

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
20. **Soft holds on the Calendar** (decided by the owner 2026-10-02, not built): every date in an open date poll pencils itself in on the Calendar and the group's page for 7 days. Behaviour is settled; the look isn't. See `SOFT-HOLDS-for-design.md` §6 for what to draw: the held entry in List, Tiles and Month (dashed ring), the heads-up in Create event, and the hold's states on the voting card.
23. **Emily and Cynthia's demos (2026-10-02):** one date-ordered view with commitments under it, keeping undated things out of date-ordered lists, and whether jobs join the idea→plan gate. See `FEEDBACK-ADDENDUM-for-design.md`.
24. **Joseph and Cynthia's feedback (2026-10-03)**, full list in `BACKLOG.md`. For Design: (a) Invite's finish: show that the app already invited the people picked, so the share buttons (Messages, Email, WhatsApp, More) read as optional extras, not the next step (Cynthia tapped one); (b) the job pop-up after a starter chip: Cynthia finished *Bring* in the description, not the title; (c) How people can help: *No help needed* as a normal, equal answer, and whether *Decide later* stays on that step (Joseph: it feels like an open tab); (d) a smaller group header (smaller photo, collapsing or drop-down, or a sidebar menu); (e) choosing your own opening screen (*Start here*) is **parked** (owner, Update 16); the app opens on Your calendar for everyone; (f) telling people an event link works without joining the group; (g) later: a per-event chat or lead updates for on-the-day changes.
22. **Inviting to a group:** only owners and admins can read a group's link, so plain members don't get Invite or Copy link in the ⋯ menu (row 5). Should every member be able to share the group's link?
21. **Ideas that need a lead** (owner, 2026-10-02: *less important than ideas with leads*, and no notification): where should members be reminded of them? Today only the *NEEDS A LEAD* chip on the Ideas board says so. Options to draw: a quiet *N ideas need a lead* row at the top of the Ideas board, floated ideas sorted after led ones, a line in a weekly digest. Also: should *Just float the idea* stay behind Review's Lead card, and should the group hear once a floated idea gets a lead (nobody was told when it was posted)?

## 6. Design tokens

As listed in the v5.2 and v6 READMEs (v6 role colours: Leading `#5b4ae8` / `#f7f6ff` / `#4a3ad4`, Helping `#e8a71c` / `#fefaef` / `#8f6405`, Going `#149a4b` / `#f3fbf6` / `#0f7a3c`, not joined `#c3c7d0` / `#fafafb`) (ink `#0d1117`, inactive title `#c3c7d0`, inactive tab `#6b7280`, active tab `#5b4ae8`, page `#e8eaee`, purple `#5b4ae8` / `#4a3ad4` / `#eeebff`, green `#149a4b` / `#0f7a3c` / `#e7f6ec`, gold `#e8a71c` / `#f5b428` / `#8f6405` / `#fdf1d6`, red `#e2556b`; owner chip `#ece9fd` / `#4a3ad4`, admin chip `#fdf1d6` / `#8f6405`).
