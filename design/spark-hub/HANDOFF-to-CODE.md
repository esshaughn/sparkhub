# Spark Hub v8 · HANDOFF-to-CODE (round v8-2)

**Caught up with the design project, and with the build's `HANDOFF-to-DESIGN.md` (as of 2026-10-05, later), as of Oct 5, 2026.**

Same setup as v8-1: `Spark Hub App Version 8.dc.html` is a clickable HTML reference (393×852) with inline styles and sample data. Rebuild it in the real stack, lifting colours, sizes, copy and behaviour from it. Keep `support.js` and `photos/` next to it to open it. Where this doc and the prototype disagree, **this doc wins**.

## New since v8-1 (Oct 5)
1. **⚠ Give feedback slide-up: please re-check against the build.** It looks like the last update missed it. Full spec in §1.
2. **Take part (PARTICIPATE) is designed.** Show the chips and build the whole path: §2. Picks are **1b** (setup) and **1c** (event page) in `options/Take Part Options.dc.html`.
3. **Help out: "Add something else"** (the member's add-a-thing row on the event page) is now quiet grey. Same shape and dashed outline, 1.5px dashed `#d5d8df`, no fill, text `#6b7280` 14px/800 (was gold `#fef7dd` / `#e3c979` / `#8f6405`).

---

## 1. Give feedback slide-up ⚠

There are two slide-ups. Check both against the build; the first is the one most likely out of date.

### 1a. Give feedback (Me → Help & info → Give feedback, and the Me "feedback" alert)
- **Sheet:** white, 24px top corners, grabber 40×5 `#dcdfe6`, padding 10/16/22, 16px gaps, max height 90%, slides up over a 45% ink scrim. Tapping the scrim closes it.
- **Header row:** Eric's photo (48px round, `faces/eric.jpg`); eyebrow **FEEDBACK WANTED** 11.5px/900, letter-spacing 1px, amber `#8f6405`; title **What do you think of the app so far?** 22px/900, -0.5px; a grey **Cancel** text button (15px/800 `#6b7280`) top-right. No ✕.
- **Line:** *Tell me honestly: what’s working and what would make it better?* 15.5px/600 `#2a2f38`.
- **Text box:** 6 rows, min height 140px, 2px `#dcdfe6` border, radius 16. Placeholder *Write as much or as little as you like.*
- **No prompt rows.** The old tap-to-insert prompts (*Does it make sense? · Is it interesting? · Would you actually use it? · Biggest risks or issues you see?*) are **gone** in v8. If the build still shows them, remove them.
- **Add a screenshot (optional):** a 48px row with a 1.5px dashed `#c9ccd3` border, radius 14, camera icon, **Add a screenshot** (15px/800) and *(optional)* in grey. Once picked, it becomes a grey `#f4f5f7` row with a 44×64 thumbnail, *Screenshot added* and a round ✕ to remove it.
- **Sent-with line:** 12.5px/600 `#8a909b`: *Sent with: {device · OS · browser · Home Screen app · screen}. Your last few taps and any errors come along too, to help track down glitches.*
- **Button:** full-width **Send to Eric**, 52px, purple `#5b4ae8`. It's grey `#dcdfe6` with `#8a909b` text until something is typed.
- **Sent state:** in the same sheet, centred: Eric's photo (64px) with a green `#149a4b` check badge, **Thank you!** (22px/900), *Got it. This really helps me figure out what to build next.*, and a black **Done** button (52px, `#0d1117`).

### 1b. Feedback ask (the timed one; build row 5: about 5 minutes in, once per account per device)
- **Sheet:** sits **above the tab bar** (bottom 73px) with a 40% scrim over the content only, so the tab bar stays visible. 24px top corners, shadow `0 -12px 36px rgba(13,17,23,.25)`.
- **Header:** Eric's photo (36px), eyebrow **FEEDBACK NEEDED** 12px/900 purple `#5b4ae8`, title **Help Eric improve the app** 19px/900.
- **Text box:** 3 rows, min height 96px, placeholder *What’s something we should fix or add? Any feedback helps, even “the calendar is confusing.”*, max 1000 characters, with a purple ring when focused.
- **Buttons, one row:** **Send to Eric** (flex, 50px, purple; grey `#d5d8df` until typed), then a grey text **Not now**.
- **After either button:** a dark tooltip pops up above the Me tab for 5s. It reads **Thanks, Eric got it.** (sent) or **No problem.** (not now), with *Add more anytime in your profile.* under it.

---

## 2. Take part

Options file: `options/Take Part Options.dc.html` (1b + 1c picked; the bottom row covers Review, guest claim, the lead's view, Tasks + tile, and notifications).

### Rules
- **Claiming a spot RSVPs you Going.** The toast is *8:30pm court time is yours. You’re going.*, with Undo.
- **Several spots per person.** The lead can set **Most per person** (Any, or 1–20). Past the cap, the toast reads *Up to N per person for court time*.
- **Guests can claim** with a name and a **required phone**. They get a text reminder, **so this needs SMS on the back end**.
- One event can have **both** spots and help jobs. Spots are stored apart from jobs (prototype: `s.parts`), so Helping counts and the Needs help counts stay jobs-only. Reusing `signup_items` with a `kind = 'part'` flag is fine.
- **Waitlist** is per time/kind, **on by default**. When a spot opens, the first in line moves up automatically and gets a push.
- **Giving up is allowed anytime**, with no cutoff.
- Switching RSVP to **Can’t or Maybe** while holding spots asks: **Give up your spot?** / **Give up your N spots?** · *You have {8:30pm court time, Beginner clinic}. Spots are for people going, so it/they will go to the next person on the waitlist.* · **Give it up** / **Never mind**.

### Setup (Plan an event → Join in), 1b
- PARTICIPATE chips (Claim time · Claim seat · Other, green +) now show, both before and after something's added. The "ADD ANOTHER" heading is now **HELP**, with PARTICIPATE under it.
- Each chip opens the existing job sheet in **take-part mode**:
  - **Eyebrow:** green `#149a4b`, **TAKE PART · CLAIM TIME** / **· CLAIM SEAT** / **· OTHER**.
  - **Title:** *Add time slots* / *Add seats* / *Add spots* (*Edit …* when editing).
  - **Name placeholder:** *Name the time slots* / *Name the seats* / *Name the spots*.
- **Claim time** uses the shift rows (start–end + count each). The add link reads **Add a time**. It starts with two 30-minute rows of 4.
- **Claim seat / Other:** name, details (optional), time (optional), count. The seat default is 8, Other is 6.
- **Under a divider (take part only):**
  - **Waitlist when full**: a green switch, on, with *First in line gets the next open spot*.
  - **Most per person**: − Any/N +, with *People can claim as many as they like* / *Each person can claim up to N*.
- **The Join in list row** reads *Take part · 4 times · 16 spots* or *Take part · 8 seats · 7:30pm*.
- **"Other" under PARTICIPATE** means any fixed-count spot that isn't a time or a seat: a carpool place, a table at a sale, a team. HELP's Other is still a job that helps the lead.

### Review
- Join in shows **PARTICIPATE** (green counts) above **HELP** when both exist. With one kind only, there's no sub-label.

### Event page, 1c
- A **Take part** section (24px/900 heading) sits **above Help out**, on plans only and not on cancelled events. RSVP stays the main button.
- **Each kind is a white card** (18px radius): the name 18px/900, a grey sub (*4 times · 4 each*, *7:30pm · 8 seats*, *· up to 2 per person*), then details if any.
- **Each time is a grey `#f7f8fa` row** (14px radius): the time (14.5px/800), 28px seat circles (faces, then plain grey dashed open seats; tapping the first open seat claims it), *N open*, and a pill at the right:
  - **Open:** green **Claim** pill (`#149a4b`, white).
  - **Yours:** the row turns `#f3fbf6` with a `#b9e3c8` ring; the time reads *8:30pm · You’re in* in `#0f7a3c`; your face gets a green ring; the button is grey text **Give up**.
  - **Full:** *Full · N waiting*, with a white ringed **Waitlist** pill.
  - **On the waitlist:** *You’re 2nd in line* and grey text **Leave**. The waitlist is **grey, not amber**.
- **Show more:** past 3 times, *N more times ⌄* / *Show less ⌃*.
- **Lead's view:**
  - There's no Claim pill.
  - Names show under each row (*Dee, Theo · Waiting: Luis*).
  - **+ Ask someone** shows while any spot is open. It opens the same ask sheet as jobs, with up to two asks waiting.
  - Tapping a row opens the roster sheet: *12 of 16 claimed*, a **Remove** per person, *GUEST* tags, and the waitlist order.
- **Removing someone, and editing:**
  - Removing someone **notifies them**.
  - Leads add spots after posting through Edit event → Join in.
  - Removing a time someone holds asks first, then notifies them (*10:30am court time was removed*).
- **Guest claim sheet:** green eyebrow with the slot (*COURT TIME · 10:00AM*), **Claim this spot**, *Your name*, *Phone number*, *Only the lead sees this. We’ll text a reminder before your time.*, a green **Claim 10:00am** button, and *Have an account? Sign in*.

### Tasks, tiles, Who's coming
- **My tasks:** green rows (dot and role bar `#149a4b`), the kind as the title and the time under it.
  - A waitlist row reads **Waitlist for 8:00pm** · *2nd in line*.
  - A **Taking part** chip (`#e7f6ec` / `#0f7a3c`) sits between Helping and Ideas, shown only once you hold a spot.
- **Tile and card strips:** still **Going** (green), with your spot: *Going · 10:00am court*, plus *+N more* if you hold several.
- **Who's coming:** your spot sits after the name, e.g. *Lead · Court time 8:30pm* or *Beginner clinic*.

### Notifications (push + bell)
- **To the lead:**
  - *Dee claimed 9:00am court time*.
  - *Hana gave up 9:30am. Luis moved up.*
  - *Beginner clinic is full (8 of 8)*.
  - Several claims within an hour group into *3 people claimed court times*.
- **To the member:**
  - *You’re in: 9:30am court opened up* (moved off the waitlist).
  - A reminder before their time (*Your court time is at 10:00am today*): 2 hours before, or the evening before for morning times.
  - Guests get these reminders as texts.

### Sample data
- **Darnell’s Pickleball** (Fri, Nov 6) has **Court time**: 7:30 (2 of 4), 8:00 (full, Luis waiting), 8:30 (empty), 9:00 (1).
- It also has **Beginner clinic**: 8 seats, 3 taken.

---

## Still open (unchanged)
- The comment notification to leads.
- Group invites: the brief is answered next round.
- Where Withdraw lives for job asks.

## Files
- `Spark Hub App Version 8.dc.html`: the prototype (main file).
- `options/Take Part Options.dc.html`: this round's Take part options.
- `support.js`, `photos/web/…`.
