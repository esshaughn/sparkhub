# Spark Hub v6 — Update 6 (read after README.md and UPDATE_2–5.md)

The files here are HTML **design references**. Rebuild them in the app's own stack; don't ship the HTML. Treat them as **hi-fi**: colors, type, spacing and copy are final. `Spark Hub App Version 6.dc.html` is updated. Mockups and explorations are in `Event Page Options.dc.html`, Rounds 52–63 (the newest round is at the top). Font: Figtree throughout. New screenshots: `35–45`.

This update covers three areas:
1. **Posting an event.** A new 5-step flow with "Decide later", polls, drafts and a Review screen. It **replaces** the one-page "Post an event" form from earlier updates.
2. **The event page for the host.** Section-level edit pop-ups, a "Your tasks" tab, the guest-list panel and Share link.
3. **Cleanup.** Retired screens and renamed labels.

Where this conflicts with UPDATE_5, this file wins.

---

## 1. Data model changes

### Event
```
{
  text,                      // title
  photos: [url],             // [0] is the cover
  day: "Sat, Oct 24 · 10am" | "Sat, Oct 24 · 10am – 12pm" | null,   // null = to be decided
  year,
  spot: string | null,       // null = to be decided
  spotAddr,
  bits: [string],            // "Basic details", up to 3 short lines
  signup: [...],             // unchanged shape from UPDATE_5
  groups: [groupId, ...],    // an event can now post to SEVERAL groups
  priv: boolean,             // Private (true) / Public (false)
  datePoll: [{ id, label, votes: [who] }] | null,   // only when day is null
  spotPoll: [{ id, label, votes: [who] }] | null,   // only when spot is null
  planned: true              // everything posted from the new flow is a plan
}
```
- **Undecided parts are allowed.** A posted event may have no date, no place, no basic details and no sign-ups. Only the title is required.
- **Legacy `bits`.** Older demo events sometimes store several sentences in one `bits` entry. When displaying or editing, split on sentence ends (`/(?<=[.!?])\s+/`) so each sentence gets its own bullet.

### Drafts (per user, not on the event list)
```
{ id, activity, evDate, evTime, evEnd, evPlace, evBits[3], evNeeds[], evPhoto,
  evDatePoll, evSpotPoll, evLater{}, evStep, evPriv, group, evGroups, saved }
```
`evStep` is the step to resume on.

---

## 2. Posting an event (new flow)

Screenshots `35–42`. Entry points: the calendar "+" button, "Start an event", "Float an idea", "Do it again". **All of them open this flow.** The old "Float an idea" idea-posting flow is **removed**.

### Shell (every step)
- **Top photo panel.** Full width, 270px tall on step 1 and 200px on later steps (animate height 240ms). It shows the cover photo, or `linear-gradient(135deg,#5b4ae8,#8a6ff0 55%,#e8a71c)` when there is none. Overlay: `linear-gradient(to top, rgba(13,17,23,.88), rgba(13,17,23,.12) 55%, rgba(13,17,23,.4))`.
  - **Top bar, over the photo.** Left: a 40px round **X** button, bg `rgba(255,255,255,.18)`, with a white icon. Center: the step count "2 of 5", 14.5px, weight 800, white. There is no right-hand button.
  - **Progress line.** 4px tall, track `rgba(255,255,255,.22)`, white fill at the step's percentage.
  - **Title block.** Bottom-left, 30px from the bottom. Label "CREATE EVENT": 11.5px, weight 900, letter-spacing 1.2, color `#ffe7b3`. Below it the typed title: 30px on step 1, 24px on later steps, weight 900, white. Before a title is typed, show "Your event" at 55% white.
- **Sheet.** Starts `-16px` over the photo, bg `#e8eaee`, top radius 20.
  - **Question.** Heading 24px, weight 900, padding `26px 18px 0`. An optional description sits below: 14.5px, `#5c6270`.
  - **Fields.** Padding `12px 16px 0`.
- **Bottom row.** Contains:
  - **"Decide later ›"** (steps 2–5 only): centered, quiet gray `#6b7280`, 14.5px, weight 700.
  - **Back** (steps 2–5 only): outlined button, 54px tall, 2px `#c9ccd3` border.
  - **Next**, filling the remaining width: 54px tall, bg `#5b4ae8`, or `#d5d8df` when the step is empty. On step 5 its label is "Review".
- **X behavior.**
  - If there's a title, the X opens the "Save this as a draft?" sheet: **Save draft** (primary) / **Keep going** (outlined) / **Discard** (text, `#9b1c31`).
  - With no title, the X just closes.

### Inputs (the "big" field style used throughout)
- **Size.** Height 58px, 2px border `#dcdfe6`, radius 16, padding `0 16px`, 17px, weight 800. Focus border `#5b4ae8`.
- **Date and time fields.** Turn off native appearance. When empty, overlay an italic gray hint (`#b9bcc4`, 16.5px, weight 400), such as "Pick a date", and hide the native `mm/dd/yyyy`.

### Steps
1. **Event title.** Title field (placeholder "e.g. Fall yard cleanup"). Under it, a dashed **upload drop zone**: 118px tall, `2px dashed #b9bcc4`, bg `#f4f5f7`, radius 16. It holds a cloud-upload icon (purple), "Upload a cover photo" and "JPG or PNG · Optional". Once a photo is chosen, show a row instead: thumbnail, "Cover photo added", Change. Next is enabled only when there's a title.
2. **Date & time.**
   - **Date field.**
   - **Start time.** A dropdown field: "Add a start time (optional)" with a clock icon. It opens a list **below the field** (not a sheet) with times every 30 min, 6:00am–11:30pm. The list scrolls to the current value and marks it with a check.
   - **+ Add end time.** Appears once a start time is set. The end field lists only times after the start. Changing the start to a time at or after the end clears the end.
   - An **OR** divider, then a **"Poll the group"** row (bar-chart icon).
3. **Location.** Place field, an OR divider, then "Poll the group".
4. **Basic details.** "Up to three quick notes on what to expect or the vibe." Three bullet fields, max 40 characters each, with a green dot once filled. Placeholders: "e.g. Let's all catch up!", "e.g. Coffee and donuts at 9:30", "e.g. Kids and dogs welcome".
5. **How people can help.** Description "Jobs to do or things to bring."
   - **Starter chips.** `+ Bring`, `+ Set up`, `+ Help with`, `+ Clean up`. Each opens **Add a job** with those words typed in and the cursor at the end. A dashed `+ Something else` chip opens a blank Add a job.
   - **Example box.** Until the first job is added, show a "FOR EXAMPLE" box with italic gray bullets: Bring a folding table / Set up the grill / Help with parking / Clean up the yard.
   - **Added jobs.** Compact white cards with Edit and a trash button.

### Decide later
Tapping it **clears that step's fields** (including any poll), marks the step as "later", and goes straight to the next step.

### Poll the group (sheet)
- **Header.** Small label "DATE & TIME" or "LOCATION" above a large "Create a poll", with the line "Add a few options. Everyone votes, and you pick the winner."
- **Options.** 2–5 option rows: date + time, or place, each with a remove button. Then "+ Add another option" and a **Save** button.
- **Rules.** Needs 2 or more valid options. Saving **does not** advance the step. The step then shows a poll summary card ("POLL · 2 OPTIONS", the options, Edit / Remove).

### Add a job (sheet)
- **Header.** Label "How people can help", title "Add a job" (or "Edit job").
- **Fields.**
  - Job name (autofocus).
  - "Details (optional)".
  - A time field with a − n + stepper for how many people.
- **Shifts.** Below, a quiet gray **"Add a shift"** link. Shifts are rare, so there's no One time / Shifts toggle. When shifts are on, the link reads "Use one time instead".

### Review
- **Header.** Screenshot `42`. Photo header with a back button, an "Add a cover photo" / "Change photo" pill (top right), the label "LOOKS GOOD", and the title with a pencil (tapping it goes to step 1).
- **Summary cards.** Four separate white cards, each with an icon, a small uppercase label and **one Edit** link (or "Add" when empty):
  - **Date & time:** date and time.
  - **Location:** place, with the address under it.
  - **Basic details:** one bullet per line, with green dots and thin dividers.
  - **How people can help:** one job per line, with "3 people" / "2 shifts" on the right.

  Undecided parts show in amber `#8f6405` as "Date to be decided", "Location to be decided", "Basic details to be decided" and "Help to be decided".
- **Who can see it.**
  - **Post to.** A group row with Choose, opening a **multi-select checklist**. At least one group stays selected, and the current group is the default.
  - **Visibility.** Two tiles: **Public** (people icon, "Everyone in your groups") and **Private** (lock icon, "Only people you invite"). The selected tile has bg `#f3f1fe`, a 2px `#5b4ae8` ring and purple text.
- **Buttons.** **Post it** (green `#149a4b`, 56px) and an outlined **Save as draft**. No subtitle line.

### Drafts
- **Where they show.** Home gets a "Your drafts" section.
- **Draft card.**
  - Left: a 76px cover strip.
  - A "DRAFT" tag and "Saved 5 min ago".
  - The title, plus a 5-segment progress bar.
  - "Up next: Location", with a **Continue** button.
  - A trash button.
- **Behavior.** Posting removes the draft.

---

## 3. Event page — host view (Plan phase)

Screenshots `43–45`.

- **Photo header.**
  - The status chip reads **"YOU'RE LEADING"** with bg `#5b4ae8` for the host. Everyone else still sees green "HAPPENING".
  - Top-right: a **"Change photo"** pill (file picker). Picking an image updates the cover immediately.
  - The title has a pencil and opens the Title & photo pop-up.
  - The old top-level Edit button is **gone**.
- **"Your tasks" tab (host).** Sits under the photo, like the helper's "You're helping" tab but in purple: bar bg `#f5f3fe`, text `#4a3ad4`, dots `#7b6ef0`. Collapsed, it shows "4 tasks". Expanded, every row is tappable:
  - "Pick a date" (or "Pick the winning date" when there's a poll) → the Date, time & location pop-up.
  - "Pick a location" (or "Pick the winning spot") → the same pop-up.
  - "Add basic details" → the Basic details pop-up.
  - "Fill open spots · N open" → scrolls to Help out.
  - "Invite people" (only if nobody has been invited yet) → the Invite sheet.
  - Any jobs the host signed up for, with their times.

  The host does not see "You're helping".
- **Guest-list panel.** Top of the page, with **no title**. Three stat tiles: Invited, Going, Maybe. There's **no "No reply"** tile and no day-before reminder switch. Below the tiles:
  - The nudge link.
  - **Invite people** (primary).
  - **Share link** (outlined), which opens the Share link sheet: the link with a **Copy** button (changes to "✓ Copied"), then four round icon-only buttons for Text / Email / WhatsApp / More. "More" uses the native share sheet. The note reads "Anyone with the link can see the event and RSVP."
- **Things left to decide.** A yellow banner, "1 thing left to decide…", that opens the Date, time & location pop-up.
- **Date + location card.** Shows "Date to be decided" or "Location to be decided" in amber with an Add link.
  - **Polls.** Each option is listed with a vote count. Guests get **Vote** / **✓ Voted**. The host gets **Pick**, which sets the date or place and clears the poll.
  - **Edit link.** One quiet gray "✎ Edit" covers both date and location. It opens the pop-up.
- **Basic details section.** Title "Basic details" with a quiet "✎ Edit". A white card lists one bullet per detail. If there are none, the host sees a dashed "Add up to three quick notes on what to expect."
- **Help out.** Its Edit opens the **"Edit what you need"** sheet, where jobs are edited inline and nothing opens on top of it.
- **Who can see it row.** Below Help out: "Public" or "Private", the group names, and Edit.

### Edit pop-ups (the full-screen editor is retired)
Every edit opens its **own small bottom sheet** with directly editable fields and a Save button. Closing works with the X or a tap on the scrim. The sheet shows the note "Everyone going gets an update when you save."
- **Title & photo:** title field, plus a cover photo row with Add or Change.
- **Date, time & location:** date and time side by side, plus the place field. Saving a date or place clears that part's poll.
- **Basic details:** three bullet fields.
- **Edit what you need:** jobs, inline.
- **Who can see it:** Public / Private tiles and a group checklist.

Don't nest sheets. Nothing here opens a sheet on top of a sheet.

---

## 4. Renames and removals

- **"Invite only" → "Private"** everywhere, including the photo chip "PRIVATE". The opposite is "Public".
- **"Details" / "The basics" → "Basic details"** everywhere (posting, Review, event page, idea page, progress tracker, host tasks).
- **Removed:**
  - The one-page Post an event form.
  - The old "Float an idea" multi-step flow.
  - The old "Edit idea" page.
  - The full-screen edit mode.
  - The "Add missing detail" sheet.
  - "Before the day".
  - "Remind everyone the day before".
  - The "No reply" stat.
  - "Your guest list" / "You're hosting" labels.
  - "Save & exit" (the X covers it).

---

## 5. Known gaps (not designed yet)

- Home, Calendar and group cards still say "Date TBD" / "Location TBD". They should adopt the amber "to be decided" treatment and show "Voting on N dates" for polls.
- Events with no date don't appear on the Calendar.
- Multi-group events show only the first group's name on cards.
- Drafts appear only on Home.
- Text / Email / WhatsApp in Share link are stubs; wire them to the platform's share intents.
- The event preview slide-up (Task Card Options, Round 13) is still undecided.

---

## 6. Tokens used in this update
- **Purple:** `#5b4ae8` primary, `#4a3ad4` ink, `#f3f1fe` / `#f5f3fe` tint, `#7b6ef0` dot.
- **Green:** `#149a4b` Post it and filled buttons, `#0f7a3c` icons and text, `#e7f5ec` tint.
- **Amber "later":** `#8f6405` text, `#fef7dd` bg, `#e3c979` border.
- **Neutrals:** page `#e8eaee`, borders `#dcdfe6`, muted text `#6b7280`, hint `#b9bcc4`, ink `#0d1117`.
- **Radii:** cards 18, fields 16, sheets 22 (top), pills 999.
- **Card shadow:** `0 1px 3px rgba(15,18,25,.08)`.
