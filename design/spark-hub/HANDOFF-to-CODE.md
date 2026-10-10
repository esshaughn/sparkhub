# Spark Hub v8 · HANDOFF-to-CODE (round v8-18)

**Caught up with the build's `HANDOFF-to-DESIGN-14.md` (v8-17 live, main `09658ae`, v=389) as of Oct 10, 2026.** This round draws rows 220–227 and §2 into the prototype (so it matches the build), answers the two questions at the end of *Round v8-17 in short*, and answers `HANDOFF-to-DESIGN-15` §2 (Member view is now *View as someone going*, 12d). It also carries a polish pass on Plan an event, the Idea page and the sign-up pop-up (items 1b–1q). Options file: `Handoff 14 Options.dc.html`. Prototype: `Spark Hub App Version 8.dc.html`.

## New since v8-17 (Oct 10)

### Answers and changes to build
1. **Plan an event photos (1a + 5b).** Adding lives inside the description card: a footer row (1px #f2f3f6 line above, 10px 12px padding) with a grey chip (#f2f3f6 / #454b55, hover #e8eaee, 34px, photo icon) **Add photos** and grey *Up to 3* (13/600 #9aa0ac). After one photo the chip reads **Add another** and the grey text *2 more*; at 3 the row hides. Photos show right under the card as a 3-column grid of square tiles (16px corners, about 106px on a 393 screen, 8px gaps), each with a 26px dark × top right; tapping a tile opens the full-screen viewer. No PHOTOS label or empty box, so it never reads as the cover slot. Max **3** (matches the database). The cover photo stays in the header.
1b. **Description formatting.** A slim toolbar at the top of the description card (6px 8px, 1px #f2f3f6 line under): **Bold · Italic | Bulleted list · Numbered list**, 36×34 icon buttons, #454b55, active = #5b4ae8 on #f1effd. The field is rich text (WYSIWYG, no visible markup). Store it as sanitised HTML (allow only b/strong, i/em, ul, ol, li, br, div/p) or Markdown, plus a plain-text copy for previews, link previews and the 500-character count (counter turns pink past 500). The event page shows the formatting under What to expect; cards and link previews use plain text. Same toolbar in Edit event's description. This is the common set for event apps; links are auto-detected rather than added from the toolbar.
1c. **Section labels** in Plan an event (WHEN & WHERE, EVENT DESCRIPTION, TYPE, SIGN UP, VISIBILITY) lose their 24px coloured icon tiles (overrides 4a, Oct 9): text label + light *Optional* only.
1d. **Add a sign-up pop-up order.** The name field comes first and is always shown (52px, 16px corners, placeholder *What you need*). The starter chips (Bring ___ · Help with ___ · Set up ___ · Clean up ___ · Coordinate ___) sit **under** the field: tapping one puts its word in front of the text in purple (tap again to clear). No *Write your own* chip; typing in the field is writing your own. Then one row: purple **+ Add details** on the left (opens the full sign-up editor in one tap, with the details box, times/shifts and every option already showing, carrying over the name and count), the count stepper (36px outlined round − / +) on the right, no "How many people?" label. Full-width Save, grey until there's text.
1e. **Sign up empty state.** Drop the line *Need guests to bring or do things?*. The dashed box starts with the examples, labelled **EXAMPLES:** (was LIKE THIS), then the **+ Add a sign up** button under them (was + Ask guests for something).
1f. **Sign-up editor title.** The full editor (opened from + Add details or Edit) is titled **Add a sign up** / **Edit sign up** (was Add a job / Edit job), with no *How people can join* eyebrow above it.
1g. **Post to row (6b-3).** One settings-style row like the toggles under it: **Post to** (14.5/800 ink) on the left; on the right, a 30px tile, the choice and a chevron, all together. Nothing picked: dashed pale-purple tile (#b3aaf2 on #f7f6ff) with a purple group icon, *Pick a group* in purple 800 (was red #c0263d). Picked: the group photo, the name in #454b55 700 (two or more: *Torrez Fitness & 1 more*, *… & 2 more*; truncates with … if long). With two or more groups the single photo becomes a small fan of the first 2–3 group photos (28px cards, white 2px edge, soft shadow, tilted about −10° / 0° / +10°, overlapping by ~11px, last on top), grey chevron. Tapping Post with no group still toasts *Pick at least one group*. Same in Edit event.
1h. **Member's Idea notepad (9b + 10a, 9a icons).** On an Idea someone else floated, the graph-paper note gets the same gold header band (gradient + sparkles) as the starter's *What's left*. Header: **To dos** (all three set: **Ready to be a Plan**, Plan capitalised), ⓘ (What's a Plan?), then a thin bar (#2a1d00 on white 55%) with **N of 3**. Rows, missing ones first, 56px, each led by a 30px circle: open = white with a 1.5px dashed #d9a83a ring; done = solid gold #f5b428 with a dark tick. Open rows: **Pick a date** · *3 dates suggested · vote for yours* (or *Sat Oct 24 suggested · vote or suggest another*, *No dates yet*) · gold **Vote**/**Suggest**; **Pick a location** (same pattern); **Find someone to lead** · *No one yet · you could* · gold **Offer** (after offering: *You offered · waiting on Hana*, no button). Done rows: **Date** / **Location** / **Lead** with the value under it in grey. A piece is done once the starter has picked it (a single suggestion is not done). Invite a friend and Talk it through leave the note (they have their own cards below). Taps: date opens the date votes, location scrolls to Where?, lead opens Offer to lead.
1i. **Discussion on every Idea.** Ideas (floated or led) get the same Discussion section as Plans, at the bottom of the Idea page and the expanded Idea slide-up: writing pill, lead updates panel, comments, replies, likes, Show more, sign-in lock for visitors. The Idea's lead (or, with no lead yet, the starter) gets the *Send update* pill and the LEAD tag. Comment pushes follow the event rules (lead/starter per comment, grouped per hour; author on replies). It carries over when the Idea becomes a Plan.
1j. **"Open to ideas" → "People can reach out".** The starter's toggle under HOW PEOPLE CAN HELP (Float page 2 and the starter's Idea page) reads **People can reach out** · *Let people contact you to talk it through*. Off hides the *Talk it through with {name}* card for members, as before.
1k. **Idea page order + Who leads it.** On the starter's Idea page, Discussion sits above WHERE IT GOES / HOW PEOPLE CAN HELP, which stay last. *Who leads it* reads **I'll lead it · Find a lead** (I'll lead it first) on Float page 2, the starter's Idea page and the *Who leads it?* explainer. **I'll lead it is now the default** (15b in `v8-18 Review Options.dc.html`, overrides Clarity pass 3d). Invite a friend and Talk it through stay off the To dos notepad (16a).
1l. **Member view → "View as someone going" (12d, HANDOFF-15 §2).** Menu row **View as someone going** (eye icon), pill **Viewing as someone going** · gold **Exit**, look-only toast *You're seeing it as someone going. Exit to make changes.* It shows you as a person who's going (your own RSVP stays). The ⋯ menu (Share link · QR code · View as someone going) now also replaces Share on Ideas (for the starter, lead, co-leads and group admins) and sits beside Edit on past events. Everyone else keeps the plain Share button. Not on cancelled events.
1m. **Plan an event cards start grey.** Every section card (When & where, Event description, Type, Post to, Public/Private, People can invite friends, Limit RSVPs) starts grey #dfe2e7 with no shadow, and turns white (#fff, 0 1px 3px shadow, 0.2s) once you tap into it or it holds something (When & where: once a date or a time is picked, or an address is chosen from the suggestions; tapping or typing alone doesn't; Event description: once there's text or a photo, tapping alone doesn't; others: text or photos, a tag, a group, the cap switched on). It stays white after that, even if emptied. Picking a group in Post to turns the whole VISIBILITY section white at once (Public/Private, People can invite friends, Limit RSVPs). The title header and the dashed Sign up box are unchanged. Same rule the description card already used.
1n. **Date picker is a centred pop-up.** Tapping the date field (Plan an event and Edit event) opens the month calendar as a centred pop-up over a dark scrim (rgba(13,17,23,.5)), 340px max, 22px corners, 18px padding, month title 20px/900 on one line with the prev/next 36px rounds right after it (left-aligned group), a 32px round grey × top right, Today (purple) bottom right, no Clear. Tapping × or outside closes it. Was a dropdown under the field.
1o. **Add a sign up button (13d).** In the empty Sign up box, under the examples: a centred white chip (44px, 6px left / 18px right padding, shadow 0 2px 6px rgba(15,18,25,.14)) with a 32px #e8eaee circle holding a grey + (#454b55), then **Add a sign up** (15/800 ink). Hover deepens the shadow. Was white with purple text.
1p. **When & where tidy-up.** No divider line between the date/time block and the address (a 10px gap instead). The address placeholder reads *Address (optional)*.
1q. **Description placeholder and time fields match the other fields.** *What's the plan?* uses the same look as *Address (optional)*: 16px/500 italic #9aa0ac; typed description text is 16px/500 (was 17px, placeholder 600). Time fields (start, end, each day) use the date field's type: 16px, placeholder #b9bcc4 500 not italic, a picked time 800 ink (was 14px).
1r. **Float page 1 is two fields again** (overrides Clarity pass 4a's one open box). **YOUR IDEA**: one line, 54px, 18px/800, placeholder *Porch concert on Elm St*, counter 0/60 inside on the right. **QUICK DESCRIPTION** *(optional)*: 3 lines, 16px/600, placeholder *Bring a chair, we'll bring the music. Thinking a Sunday evening in late October.*, counter 0/120 bottom right. Both get the gold 2px ring once filled. Labels match ADD A PHOTO (13/900 caps, grey *(optional)*). The *The first line becomes the title* hint is gone. Above Next, the dashed *Optional · + Date · + Location* chips go back to one dark grey text link, **Add more details ›** (15/800 #454b55), which opens DATE and LOCATION in place (the sheet grows) and then reads *Fewer details ⌃*.
1s. **Store safety (owner brief, Oct 10; drawn in `Store Safety Options.dc.html`, built into the prototype).** Report: ⋯ on others' comments (Report comment · Block {name}), ⋯ replaces the member's Share button on events and ideas (Share link · Report this event/idea), *Report* pill in the full-screen photo viewer, *Report · Block* under the profile pop-up. Sheet *What's wrong?* (Spam · Harassment · Inappropriate · Unsafe · Something else, optional note, Send report) → *Thanks for telling us* (lead looks, we review within 48 hours). Reported comments collapse for the reporter to *You reported this · Undo*. Block: confirm sheet (red Block); blocked people's comments collapse to *Comment from someone you blocked · Show*; Settings → Blocked people with Unblock. Reports inbox: Group ⋯ → Reports (leads/admins/owners) and Settings → All reports (app owner; overdue = open 3+ days, and reports about a lead go straight here); actions Dismiss · Remove content · Remove member · Block. Delete account: Settings → Delete my account → what happens → hand off each sole-owned group (or delete it too) → Pass on / Cancel per event you lead → 6-digit emailed code → done; web version `Delete Account Web.dc.html` (sparkhub.wereallneighbors.org/delete). Guests: *Remove my sign-ups* on the guest confirmation. Terms: line under the Welcome buttons (*By continuing you agree… 13 or older*), no first-post reminder (owner, Oct 10), Community rules screen (5 rules) in Settings. Not in the prototype: reported photos/events/profiles hiding for the reporter (spec: blurred photo, one grey line in place of the card), the 3-day escalation itself.
2. **Where the cap is set (2b).** In VISIBILITY, under *People can invite friends*, a white card with a switch: **Limit RSVPs**, led by an 18px grey ticket icon (7a in `Handoff 14 Options.dc.html`; outlined ticket with notched sides and a dashed tear line). On, a stepper appears in place (40px round − / +, *20 people*, 1s up to 20 then 5s, 2–500) with *Once it's full, people can join a waitlist.* (12.5/600 #6b7280). Saves to `sparks.cap`. Same row in Edit event.
3. **At the cap (3a).** The cap counts Going only (Maybe doesn't count; plus-ones do). When Going reaches the cap, people who aren't going see a grey chip **Full · 20 of 20** and *N waiting* above the RSVP tiles, and the Going tile becomes a dark (#0d1117) **Join waitlist** with *You'd be 3rd* under it. Joining: toast *You're on the waitlist. We'll tell you if a spot opens.*; the folded RSVP line reads **Waitlist · 3rd in line** (grey, clock icon) with Change. When someone going drops to Maybe or Can't, the first person waiting moves to Going automatically and gets a push (same as the sign-up waitlists). Hosts aren't capped. Cards keep *N spots left* / *Full*.
4. **Offer to lead with a note (4b).** **Offer to lead** opens a centred pop-up: *Offer to lead* (22/900), *Tell {Starter} why, or how you'd run it. Optional.*, a 3-line box (placeholder *I ran one of these last spring…*, 120 characters, counter), gold **Send offer**. The note shows in italics on the starter's Pick line (as drawn in v8-17 item 11) and in the push to the starter. No note → the line shows the name only.

### Drawn to match the build (no change needed)
5. Rows 220 (Add to calendar sheet, Google first), 223 (YouTube picture in comments), 224 (guest Sign up with phone or email + *Keep track of this in one place*), 225 (*Take yourself off …?*), 226 (pinned Month + COMING UP list on My calendar and All groups), 227 (chosen photos open full screen), and §2 Member view (⋯ menu, *Viewing as a member* pill) are now in the prototype as built.

---

# Earlier rounds

**v8-17 caught up with the build's `HANDOFF-to-DESIGN-9.md` (build v=374, main `6a822b9`) as of Oct 9, 2026.** That round answered every remaining §5 open question and the §2 asks. Options files (in `options/`): `Open Questions 9 Options`, `Open Questions 10 Options`, `Open Questions 11 Options`, `Categories Options`.

## New since v8-16 (Oct 9, open questions)

### Built in the prototype
1. **How Spark Hub works (Q12 → 1a).** Me → Help &amp; info row loses its REQUEST chip and opens the What's Spark Hub? sheet straight at panel 2 (HOW IT WORKS); signed in, the button is **Got it**.
2. **Offer to lead (Q32 → 2b).** On a member's Idea where the starter chose *Find a lead* and nobody leads yet: a white card with a 3px gold top, **NEEDS A LEAD** (13/900 #8f6405), *{Starter} floated this and is looking for someone to run it.* (20/900), *You'd pick the date and make it happen. {Starter} chooses from the people who offer.* (15/500 #454b55), full-width gold **Offer to lead** (#f5b428 / #2a1d00). After offering: a #fdf6e3 card, **You offered to lead**, *We'll tell you when {Starter} picks.*, *Take back my offer* (#8f6405). Toasts: *Offer sent to {Starter}* / *Offer taken back*. The starter is pushed per offer. Signed out → guest sign-in first.
3. **Your profile (Q10 → 6b).** Me header: under your name, your *About you* (14/500 #454b55, 2 lines max, only if set), then *Member since {Mon YYYY}* (12.5/700 #6b7280), then Edit profile.
4. **Feedback & questions (Q9).** One row on Me → Help &amp; info, **Feedback & questions** (replaces *Send feedback to Eric*). Its sheet: eyebrow FEEDBACK &amp; QUESTIONS, three chips (38px pills, picked = ink #0d1117 / white): *Ask a question* (default; *What can I help with?* · *I usually reply the same day.*), *Something’s broken* (*What went wrong?* · screenshot encouraged), *Share an idea* (*What do you think so far?*). The chip is sent with the message so Eric can sort. Screenshot, device line and Send to Eric unchanged. Not on Welcome.
5. **Q24f → 5b.** The pink *Shared with you* card's line becomes: *Shared with you on **Spark Hub**, where people turn ideas into plans. You can RSVP and sign up without joining anything.*
6. **Q24g → 6b.** Under the Discussion heading, a white 52px row: chat icon, **Event group chat**, gold REQUEST chip, ›. Tapping opens the usual feature-request pop-up. No chat yet.
7. **Empty group (→ 7a).** A group with no plans or ideas shows *Nothing here yet* (22/900) and *Three ways to get it going.*, then one white card of 64px rows: **Invite people** (*Share a link or pick friends*) · **Float an Idea** (*Ask what people want to do*) · **Create a Plan** (*Already know the date?*). Replaces *No plans yet* there.
8. **Suggest vs Offer (→ 8a).** Rule: you *suggest* options (dates, locations); you *offer* yourself (to lead, to help). Location: *Suggest this location*, *suggested a location*.
9. **Names (→ 9b).** First name + last initial wherever a person is named (*Hana M.*, *Darnell P.*); full name only on the profile pop-up. Now drawn in the prototype (bylines, Led by, Discussion, lead offers).
10. **Row 114 (drawn):** a member on an Idea with nothing to sign up for sees a white card, *Nothing on the list yet.* (15/600 #6b7280).
11. **The starter picks a lead (Q32 → 1a, `Open Questions 11 Options.dc.html`).** No new screen: offers appear inside the starter's **What's left** note, under the lead row. Lead row sub-line: *N people offered · pick below*. Each offer is a 46px line on the paper (dashed #d3e2f3 rule, indented to the text column): 28px face, name (15/800), their note (13.5/500 italic #454b55, one line), gold text **Pick** (15/900 #8f6405). Pick asks once: *Make {name} the lead?* · *{others} will hear you went another way. {name} picks the date and makes it happen.* · **Make {name} the lead** / *Not yet*. Then the row reads *{name} is leading it*, the offers fold away, the picked person gets a push, the others get a quiet one. *Choose* stays on the row (lead it yourself, or pick from a list).
12. **Q16 → no test events.** Remove everything about test and demo across the app: the Real or test choice, the Test event badge and its quiet-update copy, the *DEMO* pill on seeded content, and any "test" flag on events. We're past that phase. (Existing test events: please make them real or delete them, your call.)

### Decided, spec only (build when ready)
13. **Recurring RSVP (Q36 → 3b).** When recurring is built: answer date by date (Going / Maybe per date, same pop-up as *Each day*), every date you're going shows on Up next and My calendar, and jobs can be tied to a date. Stays REQUEST for now.
14. **Drag to close (→ 5b).** Past the close point the sheet scales to ~92% width and drops to ~85% opacity, the scrim lightens, and the handle turns purple #5b4ae8. No words. Springs back if released early.
15. **Q19 → 4a** (owner will revisit): pop-ups fit their content up to 88% of the screen; a drop-down opens inside the pop-up and pushes it taller (animated); past 88% the pop-up scrolls.
16. **Q15 (one sort/filter control):** keep as is for now.

### Not now
17. **Resource library (Q41):** not now; later, but soon.
18. **Welcome tour (Q26 → 2c, needs work):** direction is a *Get started* checklist (e.g. Join a group · RSVP to something · Float your first idea) in place of *Start here!*. Design to follow; don't build yet.
19. **Categories (→ 10b) — ON HOLD: hide everywhere for now; don't build.** One optional tag per Plan or Idea, chosen when posting; filter chips appear on lists only when a group has 2+ tags in use. **Picked 1a + 2c** (`Categories Options.dc.html`). Tags: *Outdoors · Food · Sports · Kids & family · Music & arts · Learning · Helping out · Hangout*. Posting: an optional TYPE row of chips (tap again to clear) in Plan an event and Float page 2. Lists (Ideas, My calendar, All groups, a group's page): one row of chips, *All* first then only tags in use, in a single line that runs off the right edge and scrolls sideways (no wrap, no scrollbar). Cards don't show the tag; the event page shows it under the title (frosted chip on the photo). Now drawn: TYPE row with a blue #1f5fa8 tag tile in Plan an event (above Sign up) and *TYPE · OPTIONAL* on Float page 2; chips read *All* then *Outdoors · 3* etc.; a filter is remembered per list.

### Tweaks
- New `categories` (default **off**): shows the category UI (item 19) for review. The *Sample ideas* (`demoData`) Tweak is gone; sample content is always on.

---


## New since v8-15 (Oct 9, clarity pass; `Clarity Pass Options.dc.html`)
All built into `Spark Hub App Version 8.dc.html`. **Screenshots** in `screenshots/` (01–13): cards 01–02, event page 03–06, ideas 07–08, Float 09–11, Plan an event 12, Discussion 13. The "N ways to help" count is jobs with open spots (not the sum of spots), on cards and the event page alike. Sample caps for the prototype: Free youth soccer (cap 24).
1. **Event cards (1c + 1d).** No going count in the strip. *N spots left* only when the event caps attendance (new `cap` field; jobs are never "spots"); at the cap, *Full*. Once you're going and haven't signed up, the strip turns orange (`#fff6f0` / `#b8480c`) and reads *N ways to help ›*. Signed up: the Helping strip as today. Addresses on cards are the street or place name only, never city / state / ZIP.
2. **Date votes (2b).** Each date is a row: a 30px gold square checkbox (your vote; filled `#f5b428` with a dark tick), the date (16/900) with *No votes yet* / *3 can go* / *You + 6 · most votes* under it (13/700 gold `#8f6405`), and a faces pill › on the right (`#fdf6e3`) that opens who voted. Tapping the faces never votes. Replaces the sideways calendar pages on When?.
3. **Lead controls (3a).** The lead's RSVP bar reads **You're leading** (co-leads **You're co-leading**) with **Change** (replaces *You're hosting*, row 199). Change opens **Your role**: *Hand it to {co-lead}* (one tap, only with a co-lead) · *Hand it to someone else* (the leads picker) · *Step back* (a co-lead takes over, or it looks for a lead) · YOUR RSVP segmented Going / Maybe / Can't · quiet red *Cancel the event*. Cancel steps forward in the same sheet: ‹ Back, *Cancel {title}?*, *Everyone going gets a notification.*, optional reason, red **Cancel event**, *Keep it*.
4. **Who leads it (3d).** The two choices read **Find a lead** (floated default: *You floated it. Someone interested can offer to lead, and you pick who.*) and **I'll lead it** (*You pick the date and make it happen.*).
5. **What's left (3f).** The *Make this a plan* card is titled **What's left**; the button is **Lock it in** (was *Make it a plan!*).
6. **Float an Idea (4a + 4b).** Page 1 heading **What's your idea?**; one open box (*Throw out whatever comes to mind…*, 132px, 17px text); the first line becomes the title, the rest the description (*The first line becomes the title.* under it). Date and Location are dashed *+ Date* / *+ Location* chips beside a grey *Optional*. *Talk it through* is now **Open to ideas** · *People can share thoughts with you*. After posting: the toast and the Idea's slide-up only, no pop-up.
7. **Event page take-part line (5a).** Under the RSVP card, one quiet purple line: *3 ways to help · 2 posts ›*; each part scrolls to its section (Sign up, Discussion). Hidden when there's nothing. No date-vote link.
8. **Plan an event Sign up (6b).** The empty dashed box leads with **Need guests to bring or do things?**, then the LIKE THIS examples, and the button reads **+ Add a sign up**.
9. **Discussion (7a).** 14px above and below each post; replies stay threaded under the parent's line; a dashed 26px square after the emoji button holds the place for GIFs later (not a feature yet).

---

# Round v8-15


**Caught up with the build's `HANDOFF-to-DESIGN-9.md` (build v=374, main `6a822b9`) as of Oct 9, 2026.** This round is mostly an answer: no new features to build. The prototype was brought up to date with what you shipped. New options file: `Handoff 9 Options.dc.html` (Q42, Q44, Q45, Q46, Q47 + Q37 + Q39, Q48). Nothing is picked yet; the owner chooses next round.

## New since v8-14 (Oct 9)

### 1. Acknowledged
- **Rows 106–211: all approved**, including every *Owner call that stands*. From now on, where HANDOFF-to-DESIGN-9 and older design files disagree, the build wins.
- **§2 inventions: approved** (visitor line, What's Spark Hub? sheet, Pick messages, drag to close). Drag to close needs no stronger cue at the threshold; the buzz is enough.
- **§3 behaviour: approved.**
- **Q40 (spots when posting): superseded** by rows 188 and 195. One *Add a sign-up* pop-up with times and options inside the item sheet is right; there are no separate spot chips.

### 2. Prototype brought up to date (nothing to build; these match the build now)
- **Event header (row 143):** a lead sees a round pencil (Edit event) and a Share icon whose menu is *Share link · QR code*. The ⋯ is gone.
- **RSVP (rows 136, 146, 184, 189, 199):** *You're hosting* bar for the lead (no Change). Can't go is an outlined sad face. Guest sheet titled *RSVP: Going / Maybe / Can't go*, with name, stepper, a solid answer button, then **Sign in · Create account**. *Keep this event* card (bookmark, ×) under the RSVP, 18px apart.
- **Ideas tab and a group's Ideas (rows 141, 152, 171, 190, 206):** Tiles first, a 5px gold edge down the left in Tiles (top in Grid), sort *Newest · Popular · Almost a Plan*, person icon + count, Private chip above the title. A group's Ideas use the same board. Gold empty state.
- **Idea page (rows 203, 204):** *Hold 7 more days* only in the hold's last 2 days. Pick ends with *Another date* / *Somewhere else*.
- **Plan an event (rows 196–198, 207, 209):** WHEN & WHERE filled in place (*One day ⌄* / *Create a poll*, date + time fields, then Address with suggestions, then *Location name (optional)*). SIGN UP is the dashed box. Description is 500 characters. POST TO starts as red *Pick a group*.
- **Add a sign-up (row 195):** starters as sentences with a blank, a dashed *Write your own*, the name field, *+ Add details, times or options*, count, Save.
- **Not yet redrawn in the prototype** (the build is right, no action): Welcome / What's Spark Hub?, sign-in + six-box code, the Sign up section on the event page and *You're signed up!*, Settings / Me REQUEST chips, *Start here!*, multi-day list rows, description as a paragraph on the event page.

### 3. Owner picks (Oct 9, `Handoff 9 Options.dc.html`)
- **Q38:** (a) **7a** dark `#2a1d00` text on Maybe gold. (b) **8b + 16c** your own item card gets an orange ring (`#f5b48a`) on `#fff6f0`, and the held **✓ You're in** button is **solid green** `#149a4b` with white text (it was the orange pill). (c) **9a** orange Helping rows. (d) **10a** both pills. (e) **11a** date + time chips. (f) **12a** keep *People can invite friends* under Post to. (g) **13a** tile dates take the role colour (gold Maybe, orange Helping). (h) **14a** *Date TBD*. (i) **15c** no dots; descriptions as a paragraph (old events keep theirs until edited, row 149).
- **Q42 → 1a:** emoji button at the left of the writing pill; an outlined heart first in each post's Reply row, pink `#d6246e` with a count once liked, tap again to undo. No push for likes, no sorting by likes.
- **Q44 → 2a:** Post to uses rounded checkbox squares, the line *Choose all that apply*, and **Done · N groups**. Public / Private stay radios.
- **Q45 → no start-rough. A Plan needs a date, full stop.** Plan an event and Edit event drop every poll: no *Create a poll* for the date or the location, and a date poll no longer counts as a date (Post it stays grey until there's a real date). Polls stay on Ideas only (When? / Where? votes). Existing plans with an open poll: please say how many there are; we'd turn them back into Ideas.
- **Prototype:** all of the above is now drawn in `Spark Hub App Version 8.dc.html` (Discussion heart + emoji, Post to squares, Plan an event label icons + LIKE THIS examples, the Leading this Idea sheet from the lead row's Change, green You're in, role-coloured tile dates, Date TBD, description paragraphs, no polls in Plan an event).
- **Q46 → 4a:** a small coloured icon tile on each section label (Description purple, Sign up orange, and so on), lighter *Optional*, a 132px description, and the empty Sign up box shows two greyed examples (*LIKE THIS*: Bring a carton of eggs · 10 spots, Help set up the tent · 3 spots) above **+ Add a sign-up**.
- **Q47 + Q37 → 5a:** on an Idea, a *You're leading · with Sam · Change* card opens **Leading this Idea**: Co-leads, Hand it to someone, Step back (*It goes back to {starter}. You stay interested.*), and a quiet red *Cancel this Idea* that swaps the sheet to its confirm. The vibe board and quick details go back on the Idea page under What to expect.
- **Q39:** covered by 5a; the starter keeps *Change* on the lead (it opens the hand-off step).
- **Q48 → 6b:** an Idea's link preview title is **Help plan: {title}**, with *Maybe {date} · On Spark Hub* on the line under it. Plans are unchanged.
- **Q41, Q43:** not taken up this round.
- **Q41 (resource library), Q43 (card wording):** not taken up this round.

---

# Round v8-14

**Caught up with the build's `HANDOFF-to-DESIGN-8.md` (baseline v8-12) as of Oct 6, 2026** (read, not yet answered; it's next). Build *New since v8-13* (top), then earlier rounds below if not done yet. New options files: `options/Create In Place Options.dc.html` + `options/Create In Place 1a.dc.html` (1a picked), `options/Create Page Tidy Options.dc.html`, `options/Inspo Photos Options.dc.html`, `options/Participate Options.dc.html`, `options/RSVP Button Options.dc.html` (1a before + 1d after).

## New since v8-13 (Oct 6, evening)
**Screenshots** in `screenshots/` (01–06 Plan an event, 07–10 RSVP card).

1. **Plan an event is one page ("fill in place", 1a).** Replaces the 4-step flow from v8-6 (Title+date+location · What to expect · Join in · Review) for new events. It looks like the finished event page, top to bottom:
   - **Header, 360px:** the purple→pink→amber sparkle gradient, or the cover photo with a dark bottom-up tint. Frosted round × top-right (sticky). A frosted **Add photo** / **Change photo** pill. **Event title** typed straight into the header (40px/900 white, placeholder "Event title", 40 chars, grows to more lines). Under it **"Add a quick overview"** (same `overview` field, 80 chars).
   - **Calendar tile:** once there's a date, the event page's tile (green month band, big day, weekday) sits top-right of the header at `top: 74px; right: 20px`, +5°. Tapping it opens the date picker.
   - **WHEN & WHERE:** one card, two rows. "Add date & time" (required) and "Add location (optional)", each opening the existing date / location pop-ups. Filled rows show the date (+ time line) and the location name (+ address line). Polls read "Voting on N dates / locations".
   - **EVENT DESCRIPTION (optional):** one text box (placeholder "What’s the plan?", 16px, 200 chars, "N/200" bottom-right). It starts at 72px and grows as you type. Inspo photos stay at the bottom of the same card: up to 6 thumbs (52px, 12px radius, × to remove) + a camera button; empty, it shows two dashed slots and "Add inspo photos". Saved as the event's details text + `mood` photos. The 1–3 numbered quick-detail lines are gone from this page.
   - **HOW TO PARTICIPATE (optional):** "Take part" and "Help out" are one section. Empty: "Need people to bring things or help out?" / "Add jobs and people going can sign up.", which goes away once a job is added. Added jobs list as rows (name, meta, description, Edit, ×). **+ Add a job** (white pill, purple text) opens a centred pop-up: "Pick a kind, then name it.", chips **Bring · Set up · Help · Clean up · Coordinate** (each opens the add-a-job sheet with the name started, e.g. "Bring ", "Help with ") and **Write your own** (blank sheet).
   - **VISIBILITY:** **POST TO** row (group photo + picked names) opens a **centred "Post to" pop-up** (checkbox rows) instead of a dropdown, so nothing below moves. Then **Public / Private** tiles side by side ("Anyone in this group / these groups" · "Only people you invite"). Then a matching card with a toggle: **People can invite friends** (on by default for Public, off for Private; sub-line "They can share it with people outside the group" / "Only you can invite people").
   - **Cards:** empty sections sit on grey `#dfe2e7` cards; they turn white once filled.
   - **Footer:** purple **Post it** (grey until there's a title and a date). Tapping it early toasts "Add a title first" / "Add a date first"; no groups ticked toasts "Pick at least one group" and opens Post to. Under it, a quiet grey **Save draft** link (saves and exits). × with content still asks to save a draft.
   - Editing a posted event and **Make it a plan!** (prefilled Review, v8-8 item 3) keep their current screens for now.
2. **RSVP card (1a + 1d in `RSVP Button Options`).**
   - **Before you RSVP:** the three tiles **Going · Maybe · Can’t**, 54px tall, **no numbers in the buttons**.
   - **After you pick:** the tiles fold into one 54px line in that answer's colours: round 28px icon + **"You’re going"** (green `#149a4b` on `#e7f6ec`), **"You’re a maybe"** (gold `#f5b428` on `#fdf1d6`, text `#8f6405`) or **"You can’t make it"** (grey `#454b55` on `#f2f3f6`), with a purple **Change** at the right. Change brings the tiles back; picking one folds it again.
   - **Counts move to the faces row:** faces, then **"17 going · 3 maybe"** (maybe left off when 0), then "See all ›" on the right. Going still includes plus-ones.
   - Multi-day "Each day" Going still opens the "When will you attend?" pop-up; the "You’re going!" pop-up (6a) still opens on Going.

---

# Round v8-13

**Caught up with the build's `HANDOFF-to-DESIGN-8.md` (baseline v8-12) as of Oct 6, 2026** (read; its rows, owner calls and questions get answered in a later round). Build *New since v8-12* (top), then earlier rounds below if not done yet.

## New since v8-12 (Oct 6, afternoon)
1. **Overview always under the title.** Supersedes v8-12 item 2: whenever an event has an overview, it shows in the header under the title (18px/500 white), whether or not there are quick details. **What to expect lists only the quick details** (the overview no longer leads that card). The lead's dashed prompt shows when there are no quick details.
2. **Edit event sheet (title + photo), events only:** a **QUICK OVERVIEW** field under EVENT TITLE (label + grey "Optional", 52px field, 16px text, placeholder as on the What to expect sheet, "N/80" counter). It's the same `overview` field as the What to expect sheet: Save writes it, and either sheet shows the current value. Ideas don't get it.
3. **Lead ⋯ menu:** the middle row reads **Invite people** (person-plus icon), not Share. Still opens the Invite people sheet. Everyone else keeps the plain Share button.
4. **Discussion pill:** the leads' pale-pink pill reads **Post update** (was "Send update"). Same pill, same sheet.

---

# Round v8-12

**Caught up with the build's `HANDOFF-to-DESIGN-7.md` (baseline v8-6) as of Oct 6, 2026.** Build *New since v8-11* (top), then earlier rounds below if not done yet. New options files: `options/Event Overview Options.dc.html` (4a picked, from 1b → 2d), `options/Event Header Options.dc.html` (8a picked, from 5d → 7a).

## New since v8-11 (Oct 6, afternoon)
1. **Event header (4a + 8a):**
   - **Status chip removed** (HAPPENING / YOU’RE LEADING). The chip row only shows for **CANCELLED** and/or **PRIVATE**.
   - **Calendar tile** moves out of the title block to the **top-right of the photo**: `top: 88px; right: 20px` (below the top buttons), tilted **+5°** (was −4°). Multi-day fanned pages move with it.
   - **Overview under the title** (18px/500 white, `text-wrap: pretty`), **only when the event has no quick details**. See item 2.
   - **Top-right buttons:**
     - **Leads:** one white 44px **⋯** button. Opens a 200px white menu (16px radius, 48px rows, hairlines): **Edit event** · **Share** · **QR code** (the existing lead QR pop-up). Tap outside closes.
     - **Everyone else** (members, guests, visitors): just the white **Share** button, no ⋯.
2. **Where the overview shows:**
   - **Overview only** (no quick details): in the header under the title. "What to expect" isn’t shown for members; leads still see the dashed "Add…" prompt.
   - **Overview + quick details:** header shows just the title; the overview leads the **What to expect** card (18px ink) above the details.
   - It’s one field (`overview`), so editing it in the What to expect sheet updates wherever it shows.
3. **What to expect edit sheet:** removed "Both parts are optional." and the purple **1 / 2** number circles (labels and Optional tags stay). **No "Cancel or delete event"** link on this sheet (it stays on the other edit sheets).
4. **Sample data:** quick overviews added to Pickleball, Driveway Dance, Turkey Trot 5K, Hunters Hang, Paint a Hub mural, Neighborhood Bonfire, Creekside Meditation, Poker night.
5. **Not picked, for reference only:** "Led by {name}" on the header (5a–7e). Owner went with no Led by in the header (8a).

---

# Round v8-11

**Caught up with the build's `HANDOFF-to-DESIGN-7.md` (baseline v8-6) as of Oct 6, 2026.** Build *New since v8-10* (top), then earlier rounds below if not done yet. New options files: `options/Idea Card Top Options.dc.html` (1e), `options/RSVP Plus Options.dc.html` (6a), `options/Guest Day Pick Options.dc.html` (1d + 2b), `options/Event QR Options.dc.html`.

## New since v8-10 (Oct 6, late morning)
1. **Ideas board cards (1e):** a **3px gold `#f5b428` bar** across the top edge of every idea card (grid and full tiles), above the photo.
2. **Bringing others on RSVP (6a), events only, never ideas.**
   - Tapping **Going** opens a centred **"You’re going!"** pop-up (green check). One row: **"Bringing anyone?"** + compact stepper (32px round − / + buttons, count `0`–`10` between). Once the count is above 0, an optional text field "Who’s coming with you? (optional)" (80 chars).
   - Green **Done** (closes, then the usual going banner / toast). Under it on one line: **Invite others** (link blue `#1f5fa8`, person+ icon, opens Invite people) · **Change RSVP** (grey, closes so they can re-pick). Scrim tap = Done.
   - Store `plus_count` (+ `plus_note`) on the RSVP. **Going counts include plus-ones.** (Not yet in the prototype: "+2" next to the name in Who’s coming; the lead's headcount should include them.)
   - The old inline "Bringing anyone?" row is gone.
3. **Guests (signed out).**
   - Guest RSVP sheet ("Almost there"): the same stepper under "Your name".
   - **Multi-day "When will you attend?" (1d):** signed out, after the day rows: **YOUR NAME** field and the **Bringing anyone?** stepper. Button reads "Add your name" until there's a name, then **"RSVP as a guest"**. Under it: "Have an account? **Sign in**".
   - **Confirmation (2b):** after a guest RSVPs, the pop-up reads **"You’re on the list, {first name}!"**, a grey summary (event title + chips: "Going · {date}" per day in green, "Maybe · {date}" in gold, "You + N"), green **Done**, then one line: **Get a reminder · Sign in** (purple, bell; opens sign-in) · **Change RSVP** (grey). No Invite others for guests.
   - **Who’s coming, signed out and not RSVP’d:** the grey faces and "See all ›" become a quiet grey line with a lock: **"RSVP to view guest list"** (not tappable).
4. **Invite people sheet:**
   - Shows **5 people** before "See N more" (was 3). Sheet height fits its content (max 94%); no gap between the list and the footer.
   - Footer: **round 54px link icon** (Share link) · **round 54px QR icon** (leads only) · **Send · N** filling the rest.
   - **Share link** opens a centred pop-up: "Share link", a link preview card (event photo 120px, title, "{date} · {location}", short URL), a row of four circles **Messages · WhatsApp · Email · More** (More = native share sheet), and a purple **Copy link** (→ "✓ Copied"). Any choice closes the pop-up and the sheet.
5. **Event QR code (leads only).** From the QR icon in the Invite people footer. Centred pop-up "QR code":
   - Preview of a **real QR** of the event's `/e/{code}` link (error correction M, black `#0d1117` modules, 2-module quiet zone).
   - **White / Transparent** segmented switch (text only). Transparent previews on a checkerboard; the pop-up keeps the same size.
   - **"Show title and date"** toggle, **off by default**. On: caption under the code, title (900) + "{date} · Scan to RSVP".
   - **Download PNG** (only button): 1200px square (+230px when the caption is on), white or transparent background, filename `{event-slug}-qr.png` / `-qr-transparent.png`. Toast "QR code downloaded".
   - Under it: the short link in grey + a quiet purple **Copy**.
   - Prototype uses `qrcode-generator` from a CDN; use any QR lib in the build.

---

# Round v8-10

**Caught up with the build's `HANDOFF-to-DESIGN-7.md` (baseline v8-6) as of Oct 6, 2026.** Build *New since v8-9* (top), then v8-9, v8-8 and v8-7 below if not done yet. New options file: `options/Event Invite Options.dc.html` (1c picked).

## New since v8-9 (Oct 6, mid-morning)
1. **Invite people sheet, condensed (1c in `Event Invite Options`).** Same sheet for events (purple) and ideas (gold).
   - **Search:** 44px pill, 16px icon, placeholder just **"Search"** (15px).
   - **People rows:** 52px, no dividers, 36px faces. One line: name (16px/800) then the group name in light grey (13px/600, `#9aa0aa`) inline. **"Friend" is dropped** (blank for friends). Tick / Going / ✓ Invited on the right as before.
   - **See N more / Show fewer:** plain purple text link, left-aligned (no grey pill).
   - **Footer:** a hairline, then one row: grey **Share link** pill (link icon, 54px) on the left, **Send · N** filling the rest (purple when someone's ticked, grey `#d5d8df` otherwise; was "Send invites · N").
   - **Removed:** the "OR SEND DIRECT LINK" divider, the URL field with Copy, and the four circles (Messages · Email · WhatsApp · More).
   - **Share link** opens the phone's share sheet (`navigator.share`, message "{title} · {day} {link}"); with no share sheet it copies the link, reads "✓ Copied" and toasts "Link copied".
   - When you can't invite people (past event, no invite rights), the sheet is just a full-width **Share link** button.
2. **"Private" chip on event photo cards.** Private events (`priv: true`) show a frosted chip top-left of the photo: lock icon + **"Private"** (24px tall, `rgba(13,17,23,.4)` + 8px blur, white 11.5px/800), the same style as the countdown chip top-right. On the Groups "Next up" card and the Up next / tile cards on group pages and All groups. Public events show nothing.
3. **Me, Settings button:** the floating button on Me is **white** with a grey `#454b55` gear and a soft shadow (hover `#f2f3f6`), replacing the purple one in v8-9 item 4.

---

# Round v8-9

**Caught up with the build's `HANDOFF-to-DESIGN-7.md` (baseline v8-6) as of Oct 6, 2026.** Build *New since v8-8* (top), then v8-8 and v8-7 below if not done yet. Options: `options/Send Update Options.dc.html`, `options/Your Stuff Options.dc.html`, `options/Impact Card Options.dc.html`.

## New since v8-8 (Oct 6, morning)
1. **Discussion, empty state:** drop "No comments yet." With no posts, the card is just the writing box (8px extra bottom padding).
2. **Send update (1d in `Send Update Options`):** the "or" divider and the centred "Send an update" link are gone. Leads see a pale-pink pill at the right of the Discussion heading: megaphone + **"Send update"** (36px tall, `#fdf0f5` bg, `#d6246e` text, hover `#fbe1ec`). Opens Post an update, carrying over any typed text. Members don't see it.
3. **"Today" chip on the Next up card** (Groups and Calendar "Up next"): when the event is today, the top-right chip turns solid green `#149a4b`, 30px tall, 13.5px/900 white, soft green glow, with a small white dot before "Today". Tomorrow / In N days keep the quiet dark frosted chip.
4. **Me page:**
   - **Header:** photo, name, Edit profile, Search and the **notifications bell** (with its badge) top right. The settings gear moves to the floating button (below).
   - **Your impact (1b in `Impact Card Options`):** out of the header, now the first thing in the grey: a slim gradient pill, 52px, "**4** led · **6** helped · **2** attended" (numbers 20px/900, words 14px/700), round frosted chevron right, four small white/gold ✦ sparkles. Tap opens the impact sheet as before.
   - **Impact sheet:** title reads **"Your impact"** (was "Your Spark Hub"); a few more sparkles on its gradient header.
   - **No "YOUR STUFF" heading.** My tasks card is 72px tall (40px icon).
   - **Drafts · Ideas · Leading · Past (1d in `Your Stuff Options`):** one white card of 48px rows instead of the 2×2 grid: 3px role bar (Drafts `#c9ccd3`, Ideas gold `#f5b428`, Leading purple, Past `#6b7280`), title 16px/800, quiet grey count right after the title, chevron far right. No detail lines.
   - **My tasks opens as a slide-up** from the bottom, 44px from the top, rounded 24px top, grab handle, sticky white header ("My tasks", down-chevron closes, Search, bell). Tapping the scrim closes it. Content is the full My tasks screen (chips, Timeline / Condensed). Opening an event from it and coming back to Me reopens the sheet.
   - **Floating button on Me = Settings:** white 48px circle, grey `#454b55` gear, soft shadow (hover `#f2f3f6`). Opens the Settings slide-up. Hidden while Settings or the My tasks sheet is open. The + menu isn't on Me.

---

# Round v8-8

**Caught up with the build's `HANDOFF-to-DESIGN-7.md` (baseline v8-6) as of Oct 6, 2026.** The build hasn't picked up v8-7 yet: please build *New since v8-7* (top), then *New since v8-6* below.

## New since v8-7 (Oct 6, later). Build these first
1. **Led ideas (Q31: 1a + 1b + 1e in `options/Led Idea Options.dc.html`).** The lead keeps the starter's slide-up (note-paper top, Edit). Under the description, the grey "Floated by…" line becomes **"Led by you"** / **"Led by {first}"** once there's a lead. Members see the same line. Help out and Take part work **before** it's a plan.
2. **"Make it a plan!" button:** purple→pink gradient (`linear-gradient(120deg,#5b4ae8,#7a4fe0 45%,#b04fc4 80%,#d6246e)`), white text, six small white ✦ sparkles (aria-hidden), 54px tall. Replaces the gold button on the idea page and the slide-up.
3. **Make it a plan → Review, prefilled.** Tapping it opens Plan an event straight on **Review** with the title, the description (as the What to expect overview, which counts toward "N of 4 added"), the cover photo, the picked date (+ time if the option had one) and the picked location. A picked date in the past rolls to next year. If the date can't be read, it opens on page 1. **Post it** turns the idea into that event (same record, not a copy) and toasts "It's a plan! We told the N people interested." Still to build: interested people → Maybe + push (1e).
4. **Pick / Add pop-up in "Make this a plan".** Date and Location rows open a centred pop-up: "Pick a date" / "Pick a location", the options people suggested as radio rows (vote count, time), top one pre-selected, gold **Confirm**. No options: just a date field / "Enter a location" text field, Confirm grey until filled. Change opens the same pop-up. Toasts "Date set" / "Location set".
5. **One option isn't a poll.** A single date or location shows as "Suggested" (no votes, no ticks, no "Choose all dates you could attend.", no "When would you attend?" pop-up). A second option makes it a poll. The Pick pop-up reads "Confirm the suggested date / location"; the checklist row reads "Suggested: {x}".
6. **Who leads it:** the toggle on the Float sheet and the starter's idea page reads **I'll decide · Me** (I'll decide is the default). **Anyone is gone.** Me = you're the lead from the start (`leadName: 'You'`). I'll decide = people can offer, you pick. The ⓘ explainer matches.
7. **Review page (Plan an event):** no yellow "REVIEW" eyebrow (EDITING still shows when editing a posted event); with a photo the header uses the same purple-pink tint as the other steps; the checklist card title reads **"Review"** (was "Ready to post").
8. **Location fields (Plan an event, page 1):** one grouped white field, two lines: **Location name** (17px bold, e.g. a park or "Hana's porch") over **Address** (16px, `autocomplete="street-address"`), split by a hairline. The address is stored as `spotAddr` and shows under the name on Review and the event page; if it's blank, fall back to the known-places lookup. Both optional except as the step already requires.
9. **Visitors: Discussion stays behind sign-in**, even for guests who RSVP'd without an account (see the short-links spec below).

## New since HANDOFF-to-DESIGN-7
**Approved:** rows 96–105, §2 inventions and §3 behaviour, all as built.

**Already decided Oct 5. These were in CLAUDE.md but never written here, so here they are:**
- **Q4 Invite link 1b:** yes, do the public-read migration (inviter name + member count by code).
- **Q8 Address:** show **sparkhub.wereallneighbors.org** to people.
- **Q18 Feedback green:** `#149a4b`.
- **Q23 B:** **3a**. Date-ordered lists end with a "NO DATE YET · N" heading (thin rule) and one white card of small rows (role bar, name, role · status). Undated **plans only**; ideas are never listed there.
- **Q28 Place:** drop it everywhere (Edit profile and the profile pop-up).
- **Q29 `#/own`:** retire it.
- **Q22 + Q33 Group invites:** only **owners and admins** invite, from Group ⋯ → Invite people and a profile's "Invite to a group". Add friends reaches friends **and** people from your other groups, several at once. Non-users get a named link (1b). Invitees get a push, a bell row and the invite card on Groups (Join / Not now). **Not now hides it for good, silently.** The inviter sees invited · joined and can **Take back** (no one is told). **No expiry**, no invite-only groups. Members don't get the group link.
- **Groups stay private (Q24f).** Anything seen outside the app shows the event only: no group name, members, other events or Join link. **Links need random codes:** `/i/{id}` exposes the id, so please move to `sparkhub.wereallneighbors.org/e/{random code}`, or at least a random code on `/i/`. Still to check for visitors: the guest RSVP and claim sheets, Who's coming (count only until you RSVP), Discussion, link-preview tags, the .ics file, and guest emails or pushes.
- **Comment notifications:** the lead gets a push per comment (grouped per hour); a post's author gets a push on replies.
- **Q35:** our mistake, `screens/02 Plus menu.png` will be retaken. Follow the prototype.

**Answered Oct 6:**
- **Recurring event and Runs across days are "Coming soon"** in "How long is it?": dimmed cards, the line reads "Coming soon", and tapping them shows the amber "… is coming soon" toast. Only One day and Separate days can be picked. Ignore v8-7 items 1's Recurring / Runs across days details for now.
- **Short links: must move this round.** Spec:
  - **Link:** `https://sparkhub.wereallneighbors.org/e/{code}`. The code is 6+ random lowercase letters and numbers, made when the event is posted and stored on it (`sparks.link_code`, unique). Never derived from the id. Every share (Share sheet, Copy link, Invite people, texts, emails, .ics) uses it.
  - **Old links:** `/i/{id}` and `gosparkhub.vercel.app/...` redirect to the `/e/{code}` link for 6 months, then go to the "This link has expired" screen.
  - **Shared message:** "{Event title} · {day} {link}". No group name.
  - **Link preview tags** (og:title, og:description, og:image): event title, "{day} · {location}", event photo (or the purple sparkle card). No group name, no "on Spark Hub · {group}".
  - **What a signed-out visitor sees at `/e/{code}`:** title, photo, date, location, What to expect, RSVP as a guest / sign in, Help out and Take part with counts. **Hidden:** group name, Visibility card, member lists, other events, Join group.
  - **Who's coming:** a count only ("12 going") until you RSVP; names after.
  - **Discussion:** **hidden behind sign-in** (owner, Oct 6). Signed out, including guests who RSVP'd without an account, it's a count card ("N posts · Sign in to read and join in") that opens sign-in.
  - **Built in the prototype (Oct 6):** signed out on an event page, the RSVP faces are grey circles, See all toasts "RSVP to see who’s going", Led by can't be tapped, and Discussion is a count card ("N posts · Sign in to read and join in", tap opens sign-in). Names open once they RSVP as a guest; Discussion only after sign-in. Guest sheet "Almost there" as 1c.
  - **Guest RSVP sheet (1c in `Visitor View Options.dc.html`):** name, then a purple "Get updates and a reminder" card pushing a free account (Continue with Google / Use my email). Below it, quiet "RSVP without an account" ("No updates or reminders. Only the lead sees your name."). **No guest emails or texts** (owner, Oct 6).
  - **Led by:** first name and photo only, no profile tap.
  - **The .ics file, guest emails and pushes:** event title, time, location and the `/e/` link. No group name.
  - **Wrong or deleted code:** the existing "This link isn't working" screen; never say whether the event or group exists.
- **Q21:** no extra reminders; the Ideas tab is enough. **The group isn't told** when a floated idea gets a lead.
- **Q31 (`options/Led Idea Options.dc.html`, 1a + 1b + 1e):** ideas with a lead move to the new idea page. **Members (1a):** 8b plus a "Led by {name} · Picking a date / Picking a location" card under the title; **Help out and Take part work before it's a plan**; Discussion at the bottom as on events. **Lead (1b):** the starter's slide-up as built (note-paper top, Edit), with a quiet grey **"Led by {name}"** line under the description in place of "Floated by" ("Led by you" for the lead; the same line for members once there's a lead), the "Make this a plan" checklist (Date · Location · Lead with an Add button on each row); the button is grey ("Add a date first") until all are ticked, then **purple gradient with sparkles, "Make it a plan!"**, with "We'll tell the N people interested." Cancel / Delete are in Edit's ⋯. **After (1e):** the page turns purple in place, polls close (votes still readable in Edit), everyone interested moves to **Maybe** and gets a push ("{title} is on: {date}"), jobs and spots carry over, toast "It's a plan! We told the N people interested."
- **Q34:** yes, an event's start time can also be **Morning · Afternoon · Evening** (same chips as the Float sheet, saved as `day_part`). Design will add them to the prototype's Plan an event.

**Still open:** Q32 (Lead it / Offer to lead, waits on the float brief), and Q1, 6, 7, 9, 10, 12, 15, 16, 19, 24, 26.

---

# Round v8-7

**Caught up with the build's `HANDOFF-to-DESIGN-5.md` as of Oct 6, 2026 (~1am).** v8-6 is below and still stands unless changed here. Screenshots: `screens/` (see the table at the end of this section). Options: `options/Multi-day Options.dc.html` (22–27), `options/Review Page Options.dc.html`.

## New since v8-6
1. **Event length (23c-2).** Page 1 label reads **Date & time · {type} ⌄** (quiet grey). Tapping opens a centred **"How long is it?"** pop-up, radio cards with icons: **One day** "Starts and ends same day." · **Recurring event** "Repeats on a schedule." · **Runs across days** "Starts one day, ends another." · **Separate days** "Each day has its own times." Done. Default One day. *screens 01–02*
   - **One day:** Date + Time; quiet grey "+ Add end time" on the left appears once a start time is set.
   - **Recurring:** REPEATS Weekly · Every 2 weeks · Monthly, UNTIL (optional) date, green line "Every Thursday until Dec 3". Saved as `repeat: { f, until }`. *03*
   - **Runs across days:** STARTS / ENDS rows (date + time each), green "3 days · Fri to Sun". Saved as `span: { from, ft, to, tt }`. *04*
   - **Separate days (22c):** DAY 1, DAY 2 rows, each one line: date · start · end. Starts with two days. Day 2 has no ×; Day 3+ have ×. "+ Add another day" under the last day. Days must be in date order (each picker starts after the previous day); gaps allowed; no practical max (30). Below: **People RSVP for** The whole thing / Each day. Saved as `days: [{ d, t, e }]`, `daysEach`. *05*
2. **Date & time pickers.** Every date field uses the app's white month card (purple selected circle, purple ring on today, past days grey, Today link). Every time field is **typeable**: "10am", "4:30pm", "16:00", "1030"; bare hour guesses am/pm (≤6 → pm); Enter or blur saves; unreadable → toast "Try a time like 10am or 4:30pm"; chevron opens the 30-min list (6am–11:30pm). Time lists elsewhere (Take part slots, job times) get a "Type a time, like 4:30pm" box + Set at the top. "Set time" chips (Float, polls, Quick add) are a small text field.
3. **Review / labels for multi-day:** Date & time row reads "Sat–Sun, Oct 10–11 · 2 days", "Thu, Oct 8 · 6:30pm · Weekly", etc. *06*
4. **Event page, multi-day:**
   - **Header (27a):** two fanned calendar pages: front = current/next day (−6°), back = the following day (+8°). Moves on once a day has passed. *07*
   - **Date card (26c):** timeline: purple dot per day joined by a thin grey line; "Saturday, Oct 10" bold, times under. Below it, pale green **"You're going Sat · maybe Sun · Change"** once you've picked. *09*
   - **Add to calendar:** one entry per day you're going ("Added Sat & Sun to your calendar (2 entries)"); every day for "whole thing" events.
5. **"Each day" RSVP (24c):** tapping **Going** opens centred **"When will you attend?"**: one card per day with **Going** (green) / **Maybe** (gold) chips, all unpicked to start. Button sums it up: "I'm going both days", "Going Sat · Maybe Sun", "Maybe Sun"; grey "Pick at least one day" when empty. Reopening via Change and clearing everything turns it into dark **"I can't make it"** (sets Can't). Saved as `myDays`, `myMaybeDays`. Only Going opens it; Maybe/Can't buttons still apply to the whole event. "The whole thing" skips the pop-up. *08*
6. **Who's coming:** one list; each person gets a small green day tag ("Both days", "Sat", "Sat · Maybe Sun"). Non-you tags in the prototype are sample data. *10*
7. **Jobs tied to a day:** add-a-job sheet on a Separate days event has **WHICH DAY** (Any day · each day). Job rows show "Sat · 9:00 – 10:00am". **Holding a job on a day auto-adds that day** to your Going days (and drops it from Maybe).
8. **My calendar:** multi-day events show on every day ("Day 1 of 2 · 10am–4pm"); once you've picked days on an Each-day event, only your Going/Maybe days show. Next up / tiles use the next upcoming day. *11*
9. **Help out:** "✓ You're in" is helping orange (#fff1e8 / #b8480c); top-right job button is vertically centred against title + time. Non-leads no longer see "Add something else".
10. **Invite pop-up:** title "Invite people"; line "Events with a friend or two in are more likely to happen."; shows 3 friends + "See N more" pill (search shows all).
11. **Plan an event leave prompt** is a centred pop-up: "Pick this up later?" / "Only you can see drafts." · Save draft (purple) · Keep going · Discard.
12. **Event preview pop-up** is off everywhere (Tweak default false); tapping an event always opens its page.
13. **Demo event** `md2` "Walnut Creek garage & craft sale" (Marisol, Sat Oct 10 10–4 / Sun Oct 11 12–5, Each day, a Sat job and a Sun job).

## Decided, not built in the prototype
- Reminders: one before **each** day you're going.
- Lead moves or cancels a day after posting → push to **people going that day only**; they must re-pick days.
- Lead headcount stays one total (Going · Maybe · Can't).
- Guests and shared-link visitors get the same "When will you attend?" pop-up.
- Tasks should also filter to your days (only My calendar does now).
- Taking a job on a day you hadn't picked should probably say so ("Added Sunday to your RSVP").

## Screens (`screens/`, top of each screen)
| File | Check |
|---|---|
| 01-one-day | "Date & time · One day ⌄" label |
| 02-how-long-popup | Four radio cards, centred |
| 03-recurring | REPEATS segment, UNTIL, green line |
| 04-runs-across-days | STARTS / ENDS rows, "N days" line |
| 05-separate-days | DAY 1 / DAY 2 one-line rows |
| 06-review-multiday | Ready to post checklist with range |
| 07-event-page-fanned-pages | Two fanned calendar pages |
| 08-when-will-you-attend | Going / Maybe chips per day |
| 09-event-timeline-your-days | Timeline + "You're going…" line (scroll down in the prototype if cropped) |
| 10-whos-coming-jobs | Day tags, "Sat · time" on jobs (scroll down if cropped) |
| 11-my-calendar | Multi-day entries |

Screens 09–10 may show the top of the event page only; open `md2` in the prototype: `__sh.go('detail',{subjectId:'md2',tag:null,group:__sh.groupIdxOf(__sh.state.sparks.find(x=>x.id==='md2'))})`.

---

# Spark Hub v8 · HANDOFF-to-CODE (round v8-6)

**Caught up with the build's `HANDOFF-to-DESIGN-5.md` as of Oct 6, 2026 (early morning).** v8-5 is below and still stands unless changed here.

## New since v8-5
1. **Plan an event is 4 steps** (dots read N/4): **1 · Title, date & location** · **2 · What to expect** · **3 · Join in** · **4 · Review**. The person creating it is always the lead (no lead card anywhere; switching lead later isn't designed yet).
   - **Page 1:** cover-photo box (optional), Event title (N/60), **Date & time** (Pick a date + Time, "Create a poll"), Location (optional, "Create a poll"). **Date is required**: Next stays grey until there's a title *and* a date or a date poll; tapping it toasts "Add a title first" / "Pick a date first". Time and location stay optional.
   - **Pages 2–4:** frosted **Add photo** pill (reads "Change" once set) at the bottom right of the header, on the title row. Page 1 has no pill.
   - **What to expect (7b):** "Overview (optional)", then a dashed **+ Add quick details · Up to 3** row that reveals three fields ("Quick details (optional)"); shown straight away if any are filled. Skip link reads **Add later ›**.
   - **Skip links** (Add later / Decide later / None needed) are purple #5b4ae8, 800 weight.
   - **Join in and Review** use page 1's sizing: 22px titles, 46px fields, 1.5px #dcdfe6 borders, 14px corners, section labels #454b55.
   - Input placeholders are **italic** everywhere.
   - The sheet opens over the screen you tapped + from (dimmed), and closing returns there.
2. **Review (20c + 21b in `options/Review Page Options.dc.html`):**
   - One white card: **"Ready to post"** (20px) with **"N of 4 added"** right and a thin green progress bar (25% per item). Rows: **Date & time** (always done), **Location**, **What to expect**, **Join in**. Done rows: green ✓, small grey label, value (first detail + "+ N more"; up to two jobs + "+ N more"), **Edit**. Empty rows: dashed circle, grey label, italic "· optional", **Add**. Edit/Add are #454b55, 800.
   - **Add / Edit open that step as a centred pop-up** (24px corners, fits content up to 88%, scrolls inside, no grab bar, quick fade-and-grow). Done returns to Review.
   - **Post to** card: group picker row, then two radio rows **Public · Anyone in this group** (people icon) / **Private · Only people you invite** (lock). Purple radio when picked. Replaces the old Public/Private tiles; the "Visibility" heading is gone.
   - **Post it** is purple #5b4ae8 with six small white/gold four-point sparkles (no confetti). "It goes on the calendar as a plan." removed. "Post as an idea" (only if somehow no date) is gold #f5b428 with dark text.
   - Header: no "Add photo" duplicate; REVIEW eyebrow + title with pencil stays.
3. **Helping colour is orange (14a):** #e8661c bars/dots/icons, #b8480c text, #fff1e8 bands. Replaces teal/sky everywhere.
4. **Friends:** no floating + on the Friends tab.
5. **Fixes:** "Find more events" opens All groups in month view with all groups (it reset the filter and crashed). Create a poll pop-up: empty date fields no longer show the browser's "mm/dd/yyyy"; fields are 46px; the "+ Add time" chevron only shows once a time is set.

## Still open
- Switching the lead after posting (event page).
- Everything under v8-5 "Still open".

---

# Spark Hub v8 · HANDOFF-to-CODE (round v8-5)

**Caught up with the build's `HANDOFF-to-DESIGN-5.md` as of Oct 5, 2026 (late night).** v8-4 is below and still stands unless changed here.

## New since v8-4
1. **+ menu (17d).** On every tab except Ideas, the purple + turns into a dark × and two pills pop up: **Make a plan** (purple, calendar icon, left of the +) → Plan an event; **Float an idea** (gold, bulb, above the +) → Float sheet. Scrim/×/navigation closes it. The Ideas tab keeps its gold + straight to Float. The old Two doors sheet and the `ideaDoor` Tweak are **deleted**.
2. **Plan an event → Float the idea** no longer switches tabs: the Float sheet slides up over Plan an event with title, overview and photo carried over. × returns to Plan an event untouched; posting clears it.
3. **Float sheet, page 1:** YOUR IDEA is a single line (54px, N/60 inside); SHORT DESCRIPTION placeholder "Casual games for all levels. Bring a paddle if you have one."; field labels #454b55; header line "**Sketch out what you know so far.**" (bold) / "You can change it all later."; **Add more details** (with light "(optional)", no chevron) disappears once tapped and the sheet grows only to fit.
   - **DATE (optional):** two buttons **Set date** (calendar) · **Create poll** (bars). Set date → centred "Set date · You can change this later." pop-up: date + time chips. Create poll → centred "Create poll · Which dates could work?": 2–6 dates, each with time chips, Done needs 2.
   - **LOCATION (optional):** **Set location** · **Create poll**, same pattern ("Set location · You can change this later."; poll 2–6 locations).
   - Once set, the two buttons are replaced by a summary row ("Sat, Oct 4 · Evening", "3 dates · …") with ✎ Edit and × (clears).
   - **Time chips** (everywhere dates are entered): row 1 **Any time · Set time** (+ time picker), row 2 **Morning · Afternoon · Evening**.
   - **Next**: pale gold (#f6d985) until a title, then solid gold with soft shadow.
   - Spacing: 16px sides, 18px between fields, 8px label→field, 52px fields, 14px radius (both pages).
4. **Leaving the Float sheet** with anything entered opens a centred **"Pick this up later?" · "Only you can see drafts."** with Save draft (gold) / Keep going / Discard. One idea draft is kept; opening Float again restores it ("Picked up your draft"). Not listed in Me → Drafts yet.
5. **Posting an idea** opens it in the Ideas tab slide-up (your view, §6 below).
6. **Starter's idea page (18b + 19a + 20a)** — what the person who floated it sees, in the same note-paper slide-up as members (tap your own card on Ideas):
   - Note top: snapshot photo, IDEA chip with **✎ Edit** (edits title ≤60 and description ≤120 in place; fields auto-grow; Save/Cancel), "You floated this · {when}".
   - **Top card:** faces + "N interested ›" (who's interested) and a full-width **Share** (white, 2px gold outline, #8f6405 text).
   - **Make this a plan**: graph paper with a **light gold header band** (gradient #fde39a→#f8c94f, small sparkles, 26px title). Rows: **Date** (leading date + Pick / Add), **Location** (leading + Pick / Add), **Choose lead** (spark icon) → centred "Choose a lead": gold **I'll lead it** + "Or choose someone who offered". Done rows show a gold ✓ and a quiet grey **Change**. **Make it a plan** (gold) appears only when a date is picked and you lead → opens Plan an event at When with everything carried over. If someone else leads: "{name} will make it a plan."
   - **When? / Where?** (26px titles): ✎ **Edit** → centred "Edit dates/locations" (remove options showing votes; add dates with time chips or locations; Save). "+ Add a date / Suggest a location" links hidden for starters. **See votes ›** centred below each poll → "Date/Location votes · N votes so far", per option: count, bar, voter chips.
   - **Bottom:** WHERE IT GOES (Post to → "Who can see it" group picker, ≥1 group; shows "First group & N more") and HOW PEOPLE CAN HELP (Talk it through toggle → hides the members' Talk card; **Who leads it** ⓘ I decide / Anyone, saved as `leadRule`). Lead icons are a lightning bolt (Float) / spark (starter).
7. **Member idea page** is fully gold now (no purple), wherever it's reached. Section titles on idea pages are 26px (When?, Where?, Help make this a plan, Make this a plan, Talk it through with X).
8. **Calendar pages** show a time (small gold) under the date when one is set.

## Still open
- Offers to lead and voter names are placeholders; date/location/lead picks on the starter page are session-only in the prototype.
- Idea drafts aren't in Me → Drafts. Photo isn't editable from the starter page.
- Event page section titles (Discussion 24px, What to expect 18px) don't match the 26px idea titles yet.

---

# Spark Hub v8 · HANDOFF-to-CODE (round v8-4)

**Caught up with the build's `HANDOFF-to-DESIGN-5.md` as of Oct 5, 2026 (night).** Round v8-3 is in `SparkHub v8-3/`; everything there still stands unless changed below.

`Spark Hub App Version 8.dc.html` is a clickable HTML reference (393×852) with inline styles and sample data. Rebuild it in the real stack. Keep `support.js` and `photos/` next to it. Where this doc and the prototype disagree, **this doc wins**. Option files are in `options/` (mostly `Ideas Board Options.dc.html`; round numbers below refer to it).

## New since v8-3 (Oct 5, night)
1. **Bottom bar is now Groups · Friends · Calendar · Ideas · Me.** Tasks moved under Me. §1
2. **Me header** gets a settings icon on the far left that opens Settings as a slide-up. §1
3. **Ideas tab** (all groups' ideas on one board). §2
4. **Idea slide-up**: tapping an idea card opens the idea page as a sheet over the board, then expands in place. §3
5. **Idea page changes**: date poll as calendar pages, location poll rows, empty When/Where cards, Contact {name}, gold pop-ups. §4
6. **Float an idea is a two-page sheet** (15f + 15f-2), and it's now the only float flow. §5
7. **Fixes**: closing Plan an event returns to where you started it; your own floated idea opens the lead/starter page. §6
8. **Removed**: How this works (screen and Me row), Real or test?, the old Float sheet fields. §6

---

## 1. Navigation

- **Tabs:** Groups · Friends · Calendar · **Ideas** · Me. Same flat icons, active tab purple. Ideas uses a bulb icon.
- **Tasks** lives under Me (YOUR STUFF). Its screen is unchanged.
- **Me header:** settings gear at the far left, then photo/name; tapping it opens the Settings list as a bottom sheet (max 88%).
- **Floating +:** purple on every tab, straight to Plan an event. **On Ideas only** it is a **gold #f5b428 round +** (dark #2a1d00 glyph) that opens the Float an idea sheet.

## 2. Ideas tab (Rounds 1–4, 6–8)

- **Page:** graph-paper background (`#f5f9fe`, 18px `#dfeaf7` grid). White header with a tilted gold bulb tile, "Ideas" (30px/900) and small gold/pink/purple sparkles.
- **Under the header:** a group picker pill (All groups ⌄, multi-select) on the left and a quiet sort on the right (**Popular** · Newest · **Closest**). The sort is text + ⌄, no pill.
- **View switch:** grid ⇄ full tiles.
  - **Grid:** two staggered columns of cards, each slightly rotated (±1–2°). Cards are cream lined paper (`#fffdf5`, faint `#f2eee1` rules every 22px). With a photo, it sits at the top and fades out top-to-bottom (strong top-right, lighter bottom-left so the title reads). Title 16px/900, no description. Bottom row: "by {first name}" left (12px grey), gold "↑ N" right.
  - **Full tiles:** one per row, photo on the left 36% (if any), title, description, bottom row "by X" left and "N interested" right. Height hugs content (min 96px with a photo).
- **End of board:** a small gold bulb with a sparkle, "That's every idea for now." and a gold-outlined "+ Float an idea" (opens the Float sheet).
- **Card tap** opens the idea slide-up (§3).

## 3. Idea slide-up (9d + 10c-5)

- **Closed state:** bottom sheet (`#e8eaee`, 24px top corners) over a dark scrim; the board stays behind.
  - **Note paper top:** cream lined paper, grab handle (`#d8d2bd`), white round × top right. The photo sits on the paper as a snapshot (6px white border, shadow) tilted 1–3° either way; the angle comes from the idea id so it's stable.
  - Gold IDEA chip (bulb), title 34px/900, description 23px/500, "Floated by {first} · {when}" (when in regular weight).
  - The paper ends in an **organic torn edge** (irregular clip-path).
  - On the grey: a white card (soft shadow) with full-width gold **I'm interested** and centred faces + "N people so far ›" (opens who's interested).
  - Single gold chevron bouncing gently, "Swipe up for more" (14.5px/800, `#8f6405`).
- **Expanding:** swipe up, scroll, tap the chevron, or tap I'm interested → the same sheet animates its height (≈420ms) to **54px from the top** (never full screen) and the rest of the idea page fades up below: Help make this a plan, Invite a friend, When?, Where?, Talk it through. It then scrolls inside. Swipe down at the top, ×, or tap the strip of board to close.
- **On the slide-up, everything that was purple is gold** (icons `#b07a0a`, buttons `#f5b428` with `#2a1d00` text, soft fills `#fdf1d6`).
- **All pop-ups opened from an idea are centred cards** (max 353px wide, 24px radius, z above the sheet): dates, suggest a location, invite people, talk it through, What's a plan, who's interested, Who leads it.

## 4. Idea page details (slide-up and full page)

- **When? (13c-3):** subline "Choose all dates you could attend." Each date is a small calendar page: header strip with the weekday (pale gold; solid gold when picked), the date large ("Oct 4"), "N can go". Picked: gold ring + small ✓ in the header. Tap to vote.
  - More than two dates: the pages slide off the card's right edge (snap scroll) and "View all N ›" (quiet grey) appears; it opens a centred pop-up with all pages in two columns and a gold Done.
  - Under the pages, one row: "+ Suggest a date" (or Add a date for leads).
- **"When would you attend?" pop-up:** after tapping I'm interested on an idea that has dates, a centred pop-up shows the same calendar pages; Done toasts "Thanks! {first} will see your dates."; Not sure yet closes.
- **Where?:** rows like the date rows but without faces: name, "N votes" / "Be the first", round toggle right; picked = pale gold fill, gold ring, filled ✓. "+ Suggest a location" under it.
- **Empty When? / Where? (12a):** the whole card is one button: dashed gold edge, icon in a pale gold circle, "When?" + "Suggest a date ›" / "Where?" + "Suggest a location ›". Both empty: the two cards stack full width.
- **Talk it through:** the button reads **Contact {first}** (solid); after: "✓ {first} will be in touch", toast "We've notified {first}!". The card and its Help-make-this-a-plan row are hidden when the starter said no to Talk it through.
- **Invite people from an idea:** friends who are already interested show a gold **Interested** (not Going).

## 5. Float an idea (15f + 15f-2) — the only float flow

Opens from the Ideas tab's gold + and "+ Float an idea", and from Plan an event's **Float the idea** card (which closes Plan an event, goes to Ideas and opens this sheet with the title, overview and photo carried over).

**Page 1**
- Note paper top with torn edge: IDEA chip, "Sketch out what you know so far. / You can change it all later." (17px).
- On grey: **YOUR IDEA** (60 chars, gold ring once typed), **SHORT DESCRIPTION (optional)** (120), **ADD A PHOTO (optional)** (dashed tile → device photo; then thumbnail + Remove).
- **Add more details ›** grows the sheet to ~58px from the top and fades in **A DATE TO VOTE ON** (date picker) and **A LOCATION TO VOTE ON** (text). Becomes "Fewer details ⌃".
- **Next** (gold; grey until there's a title, which toasts "Add a title first").

**Page 2**
- Note top shows the photo as a tilted snapshot, the IDEA chip, the title (26px) and the description.
- **WHERE IT GOES:** Post to → groups (opens inline, multi-select, gold ticks, at least one stays picked).
- **HOW PEOPLE CAN HELP:** **Talk it through with someone?** toggle ("People can offer to brainstorm", default off), then **Who leads it** with ⓘ and **I decide** (default) / **Anyone**. ⓘ opens: *I decide* — people can offer to lead it; you pick who, or keep it for yourself later. *Anyone* — the first person to step up becomes the lead and can turn it into a plan; you get a heads-up.
- Bottom row: white **‹ Back** and gold **Float the idea** (bulb).

**On post:** saves title, description, photo, the date (first option in When?), the location (first option in Where?), `talk`, `leadRule` ('me'|'any'), groups; toasts "Posted to …" and **opens your new idea page** (no invite sheet). No "lead" wording anywhere on this path; the old When-ish chips and Just float it / I'll lead it toggle are gone.

## 6. Fixes and removals

- **Plan an event ×** and **Save draft** from the leave prompt return to the screen you started from (Groups, Friends, Calendar, Ideas, a group page, or Me); from an event page, to My calendar. Closing an event opened from Me reopens Me (and the list you were in).
- **Your own floated idea** opens the lead/starter idea page (not the member page with I'm interested / Contact yourself).
- **Removed:** How this works screen and its Me row (copy still needs a home, Q12); Real or test?; the old Float sheet fields; the "Who can go when" results pop-up.

## Not built / open
- **Starter view in the new idea style.** Starters still get the older idea page.
- **Who leads it isn't acted on yet.** `leadRule` is saved; Offer to lead / Lead it waits for `BRIEF-float-the-idea (later).md`.
- **Voter faces and names are placeholders** in the prototype; use real votes.
- Plan an event's first-screen Make it a plan / Float the idea redesign (float brief) is still for later.
