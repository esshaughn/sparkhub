# Spark Hub v8 · HANDOFF-to-CODE (round v8-1)

**Caught up with the design project as of Oct 5, 2026.**

## About these files
Everything here is a **design reference built in HTML**, not production code. `Spark Hub App Version 8.dc.html` is a single clickable prototype (393×852 phone) with inline styles and fake sample data. Rebuild it in the real app's stack and patterns; lift exact colours, sizes, copy and behaviour from it. Fidelity: **high** (final colours, type, spacing and copy).

Open the HTML in a browser (keep `support.js` and `photos/` next to it). The `*Options.dc.html` files are side-by-side explorations; the picked option is noted below by its id.

## New since v7 (this round)
- **Bottom bar:** five flat tabs Groups · Friends · Calendar · Tasks · Me, labels 11.5px weight 600, active purple. Floating + (straight to Plan an event) on every tab including Me; it sits behind every slide-up.
- **Groups:** invite card (8c) and a "Next up" card (8b) above the grid; "All groups" card on the sparkle gradient (9b) with round photos and a solid white "+N".
- **Friends:** "Your lists" swipe cards (4a) with a list sheet and list editor; lists persist in the browser.
- **Tasks:** grouped by event (6h/6k) with role dots, Timeline / Condensed icon switch (7a, condensed = 6j); empty states per tab as tappable grey cards.
- **Me (11a):** header with search + bell, gradient "Your impact" card that opens a full sheet, YOUR STUFF 2×2 (Drafts · Ideas · Leading · Past, each opens a slide-up with its own empty state), SOON chips, Privacy row, dismissible "home screen" + "feedback" alerts (feedback returns every 4 visits), About you on Edit profile and on your own profile view.
- **Plan an event, rebuilt:** shared sparkle header with step dots on every step, title-first screen with lead cards at the bottom, Join in step with HELP + PARTICIPATE chips, Review rebuilt as 19f with inline title editing and a twirl-down group picker. "Real or test" removed everywhere; separate Lead step removed.
- **Copy:** no "e.g." in any placeholder; "Float the idea"; "Create event"; "Join in" / "How people can join".

## Design tokens
- Font: Figtree (400–900).
- Purple #5b4ae8 (hover #4a3ad4), lavender #f3f1fe / ring #d9d3fb. Ink #0d1117. Greys #6b7280 · #454b55 · #8a909b · #9aa0ac · #c3c7d0 · #dcdfe6 · #e8eaee (page) · #f2f3f6.
- Green (going / take part) #149a4b · #0f7a3c · #f3fbf6. Amber (helping) #f5b428 / #e8a71c · #8f6405 · #fdf6e3. Update pink #d6246e / #fdf0f5. Idea blue #1f5fa8 / #eaf3fc.
- Sparkle gradient: linear-gradient(115deg, #5b4ae8 0%, #a03bc8 45%, #d6246e 75%, #f5b428 120%) with small 4-point white / #ffe7a6 / #ffd0e4 sparkles kept off text.
- Radii: cards 18–20px, sheets 24px top, pills 999px. Card shadow 0 1px 3px rgba(15,18,25,.08). Toasts for short feedback ("Add a title first", "Choose an option", "Pick at least one group").

## Screens and behaviour (full spec)
## App structure (v8)
Bottom bar, five tabs, all flat icons with the same weight; the active tab is purple and no tab rises above the bar:
**Groups · Friends · Calendar · Tasks · Me**

- **Groups**: above the grid, an invite card when someone has invited you ("Hana invited you to Mueller Pickleball", Join / Not now; 8c in `Groups Top Options.dc.html`), then a "Next up" card for your soonest event (photo, green "NEXT UP · date · time", name, "Group · you're leading/helping/going"; 8b). Then a 2×2 grid of photo tiles for your groups, plus an "All groups" card on a purple→pink→amber gradient with small white sparkles (9b in `Groups Top Options.dc.html`; round group photos with a "+N" circle past three, "All events, plans & ideas", arrow). Group pages use a 112px photo header.
- **All groups** (screen `calendar`, label "Explore"): a 136px photo header with a back button, search and bell at the top. The title "All groups" sits bottom-left. A frosted group switcher pill sits bottom-right, centred on the title; it reads "All", or "N groups" when narrowed. The floating + button is the same one as on the other tabs.
- **Friends**: friend rows show the next event they're going to as "{event title} · {date}", with no "Going to" prefix.
- **Friends · Your lists** (4a in `Friend Lists Options.dc.html`): above "Your friends", swipeable cards for private friend lists (face stack, name, count) with "+ New list". Tapping a card opens a sheet with the people, Edit, Add people and "Invite all N to an event…". "+ New list", Edit and Add people open a list editor sheet (LIST NAME, PEOPLE checkboxes, Cancel / Make list or Save list; editing also has "Delete this list" with a confirm). Hidden while searching. The friends list shows 5, then "See all N ›".
- **Calendar** ("My calendar"): month/list views with a group filter line.
- **Tasks** ("My tasks"):
  - Chips: All · Leading · Helping · Ideas. No "Tasks" heading; an icon-only Timeline / Condensed switch (7a in `Task List Options.dc.html`: grey pill, stacked-cards icon / four-lines icon). In Timeline it sits at the right end of the first date line, replacing that line's rule; in Condensed it sits right-aligned above the card.
  - **Condensed** (6j in `Task List Options.dc.html`): one white card, each event a small sub-header (name, date), 30px rows with role dots, times inline; Ask / See list are plain purple text.
  - **Tasks list** (6h in `Task List Options.dc.html`): grouped by event, soonest first. Each group has a grey date line ("THU, OCT 15 · In 11 days") with a thin rule running right, then the event name with a 3px vertical role bar on its left (purple = leading, amber = helping, blue = idea), then a white card of task rows, each led by a small dot in the role colour (6k; no checkboxes). No LEADING/HELPING tags.
    - Lead job rows read a small grey caps **NEED**, then the job in bold, with open spots in light grey, e.g. "NEED  Bring a main dish (2)".
    - Lead rows have a plain purple-text **Ask** button that opens the "Ask someone to take…" sheet for that job, right on the Tasks screen.
    - "Check who's coming" rows have a **See list** button instead.
    - Helping rows show the job time under it, if there is one.
- **Me** (11a in `Me Page Options.dc.html`): header with photo, name, "Edit profile" link, search and bell; a gradient "Your impact" card (you’ve led / you’ve helped / you’ve attended) that opens a full sheet with Led / Helped / Attended tabs and a "N people came" total; then YOUR STUFF as a 2×2 grid (Drafts · Ideas · Leading · Past); then Settings, Help & info. "Coming soon" items show a toast with an **amber warning triangle**, not the green check.

## Event page
- **Help out**:
  - Jobs show seat circles at 28px. Filled seats show faces; open seats are plain grey dashed circles, with no purple dashed "+".
  - The first open seat is still tappable to sign up.
  - Leads see "+ Ask someone".
- **"Ask someone to take" sheet** (job asks):
  - Title: "Ask someone to take" in regular weight, then the job name in quotes in bold.
  - Each person row has an **Ask** button. Tapping it opens, inside that row, an **"I THOUGHT OF YOU BECAUSE… (optional)"** box with **Cancel** and **Send ask**.
  - The note is optional, and it shows in italics under that person once they've been asked.
  - At most 2 can be waiting at once ("0 of 2 asked").
- **New-updates banner**:
  - Instead of the big Update card, people going see a pink banner, "**X new update(s) · View ↓**", near the top.
  - Tapping it marks the updates seen and smoothly scrolls to Discussion.
  - Leads never see it.
- **Discussion** (near the bottom, above "Led by"): the full comment section.
  - **Writing box:** a single grey pill ("Ask a question or say hi…" with a round arrow send button inside it, same as reply), placed at the top of Discussion, above the lead-updates panel. People going see "Ask a question or say hi…". Leads also see a short-lined grey "or" divider under the box, then a centred pink megaphone "**Send an update**" text button (3f in `Discussion Options.dc.html`), which opens the Post an update sheet (carrying over any typed text).
  - **Flat feed (1b in `Discussion Options.dc.html`):** no cards or dividers between posts. **Lead updates** sit together first in one light-grey panel (#f2f3f6, thin #dcdfe6 lines between them; 2b in `Discussion Options.dc.html`), each with a solid pink "UPDATE" chip on the same row as "Name · time"; body text matches comments (15px, 500, #2a2f38). Replies have no grey bubble. A thin grey thread line runs down from the avatar when a post has replies, and "View N replies" shows a small stack of the repliers' faces. Regular comments follow, newest first, with a purple LEAD tag on leads' comments.
  - **Show more:** past 3 top-level posts (updates + comments), Discussion shows the first 3 and a grey "Show N more ⌄" pill at the bottom; open, it reads "Show less ⌃". Replies don't count toward the 3.
  - **Replies** are indented and **collapsed by default**. Collapsed posts show "—— View N replies · Reply"; open threads show "Reply · Hide replies". Posting a reply keeps that thread open.
  - **Sample data:** on Activate (Thu Oct 15), Dee asks about parking under Joseph's update and Joseph answers. Marisol asks about bringing her 12-year-old and the lead replies. Luis is running late.

## Creating
- **Plan an event** (6 steps: Title · When · Where · Details · Join in · Review):
  - **Header (every step):** 180px, purple→pink→amber sparkle gradient (or the cover photo with a dark tint), × close (back arrow on Review), centred step dots with a small "N/6" above, heading ("Create event" on step 1, then the typed title), frosted "Add photo" pill on the title row. Content sits on a grey sheet with 20px rounded top corners overlapping the header.
  - **Title step:** "Event title" (28px), field auto-focused with purple glow, placeholder "Fall cleanup day", "N/40" counter. The I'll lead it / Float the idea cards sit at the bottom above Next, no heading, with a quiet "What's the difference?" link that opens a "Lead it or float it?" explainer. Next always reads "Next"; tapping it with no title toasts "Add a title first". The separate Lead step and "Real or test" were removed.
  - **When:** date picker closes on any outside tap (sheet or header). "Decide later" is 16px.
  - **Details ("What to expect"):** "Give people the basic idea and the vibe." Numbered 1 One-line overview (0/80) and 2 Up to three details (0/60 each), "Optional" as light grey text; counters always visible. No "e.g." anywhere in placeholders.
  - **Join in:** "Ask for help or list specific ways to participate." HELP chips (Bring · Set up · Help · Clean up · Coordinate · Other) then PARTICIPATE chips (Claim time · Claim seat · Other, green +); each section fits two rows. No 1-2-3 explainer, no "No help needed" row: a "None needed ›" text button (like Decide later) skips; tapping grey Next toasts "Choose an option". The add-a-job sheet has no suggestion chips.
  - **Review (19f in `Review Options.dc.html`):** REVIEW eyebrow + title with an inline pencil; tapping edits the title in place in the header (Enter/blur saves). Lead card ("You're leading it", Change), then "Details" (date/time + location rows), "What to expect", "Join in" headings with Edit links; blanks read grey "Nothing added." / "No date yet" / "No location yet". Visibility: a collapsed "POST TO" group picker (twirl-down, closes on outside tap; all groups can be unticked but Post then toasts "Pick at least one group"), then Public ("Anyone in this group" / "…these groups") / Private tiles. Post button has quiet confetti, no bulb.
  - **Save draft** link removed from the footer (drafts still save from the leave prompt).
- The + button (and the floating + button on every tab) goes **straight to Plan an event**. The two-door "What do you have?" sheet is hidden behind a Tweak.
- **Float an idea** (the quick idea sheet, formerly "Share an idea"):
  - **Fields:** YOUR IDEA, WHY OR WHAT (optional), WHEN-ISH chips, GROUPS, and WHO LEADS IT (Just float it / I'll lead it).
  - **GROUPS** is multi-select. Its list **opens upward** from the field, with checkboxes and Done, and at least one group always stays picked. The field shows the picked names, with a purple count when more than one is picked.
  - **Posting:** "Post idea" posts to every picked group. The toast reads "Posted to A and B", or "Posted to N groups" for three or more.
  - **"Add more details ›"** (above Post idea) opens the full Plan an event flow. It carries over the title, why/what, groups and lead choice, and starts at the date step.

## Tweaks (root props)
- `discussion` (default **on**): the Discussion section and new-updates banner. Off brings back the old Update card with inline comments under each update.
- `ideaDoor` (default **off**): + asks "Plan an event or Float an idea".
- Older ones carried from v7: feedbackAsk, eventPreview, pushMode, demoData, dataState, friendLinkKind, friendLink, startSignedIn, googleOutcome, ericRole, inviteLink, noGroups, failSaves, leadActionBar, sectionTitles and others.

## Wording to follow
- "lead", not "host"; "people", not "neighbors"; "event" as the umbrella word.
- "What to expect" for the event page's details section; "Details" elsewhere.
- "location", not "spot".
- "Start an event", "Needs help", "Who's coming", "People going can invite friends", "RSVP".
- Exception: "NEED" is used on purpose for open job spots on Tasks.
- Public address: sparkhub.wereallneighbors.org.


## Still open / next rounds
- The notification a lead gets when someone comments isn't designed yet.
- Plan an event steps are now Title (with the lead picker) · When · Where · Details · Jobs · Review (with Post to); the separate Lead step was removed. See `Event Creation Steps.dc.html`.
- Handoff round 1 shipped as `SparkHub v8-1` (Oct 5, 2026). For later rounds, write `HANDOFF-to-CODE.md` here with a *New since {date}* list at the top, details below, and a *Caught up with … as of {date}* line, and ship each round as one zip folder: `SparkHub v8-1`, `v8-2`, …

- **Take part vs Help out** (brief in this round's chat): only the PARTICIPATE chips are built. Event page CTA, green Take part section, Review split, Tasks/role strips and Ask for take-part spots are not built yet. Step options: `Sign-ups Step Options.dc.html` (18a–18d).

## Files in this folder
- `Spark Hub App Version 8.dc.html` · the prototype (main reference)
- `support.js` · runtime the HTML needs to open; not part of the app
- `photos/web/…` · every image the prototype loads (event photos, `faces/`)
- `design-notes.md` · the design project's running notes (copy of its CLAUDE.md)
- `options/` · exploration canvases: Task List, Groups Top, Me Page, Friend Lists, Review, Event Title, Sign-ups Step, Discussion, Event Creation Steps
