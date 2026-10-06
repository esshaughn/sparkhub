# Spark Hub v8 · HANDOFF-to-CODE (round v8-13)

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
