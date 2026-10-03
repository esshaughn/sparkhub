# Help out (sign-ups): how it works and why

For Claude Design. This describes the sign-up feature as it's built in Spark Hub (2026-10-01; §5.1 updated 2026-10-03): every screen and state, the rules behind them, and the reasoning. Current colors and sizes are included so you can see what exists, but they aren't locked. Redesign freely, as long as the behavior and the reasons still hold.

---

## 1. What it is, in one paragraph

Any event can have a list of **jobs**: things to do or things to bring ("Set up chairs", "Bring a dozen filled eggs", "Clean up"). The lead lists the jobs. A job can say how many people it needs, a time, and a short description, and it can be split into **shifts** ("6:00 – 7:00pm", "7:00 – 8:00pm"), each with its own head count. Members take a job with one tap. The lead always sees what's covered and what's still open. In the product it's called **Help out** on the event page, **How people can help** in Create event, and **sign-ups** in counts and notifications.

## 2. Why it exists

- **The goal is to spread the work of hosting.** Spark Hub's north star is *events that happened, led by someone other than the group's founder*. Most events never happen because one person ends up doing everything. Jobs turn "help me host" into small, specific asks that a stranger can say yes to.
- **"Clarity is kindness."** An empty slot that says *2 still needed* tells the next person exactly what to do. A vague "anyone want to help?" in a group chat doesn't.
- **It has to be as easy as SignUpGenius:** one link, pick a slot, done. That's the bar, because SignUpGenius is what neighbourhood groups use now. Spark Hub's edge is that the sign-up sheet lives inside the group, next to the RSVP and the idea that started the event.
- **What counts as success** is an event where someone other than the lead took a job (target: at least half of events), and attendees who took a job (target: at least 20%). Sign-up totals on their own don't count. What matters is that the event happened and people came.

## 3. The words we use

| Term | Meaning |
|---|---|
| **Job** | One thing on the list. A task ("Set up") or an item ("Bring ice"). Max 60 characters. |
| **How many** / **need** | Optional head count (1–999). With no number, the job is open to any number of people. |
| **Time** | Optional start time, or a range (*5:00 – 6:00pm*). |
| **Description** / **Details** | Optional "what's involved", up to 400 characters. |
| **Shift** | One time slot of a job. A job with shifts reads *2 shifts · 6:00 – 8:00pm*. People sign up for shifts, never for the parent job itself. |
| **Claim** / **sign-up** | One person on one job or shift, with an optional note of up to 60 characters ("I'll bring the big cooler"). |
| **Something else** | A job a non-lead adds for what *they're* bringing. Always a plain item: no count, time, description or shifts. |
| **Lead** / **co-lead** | The person running the event and up to 5 co-leads. Co-leads can do everything the lead does with jobs. |

---

## 4. Who can do what

| Action | Lead / co-leads | Member who can see the event | Guest (no account) |
|---|---|---|---|
| See the jobs and who's on them | ✓ full list: names, shifts, notes | ✓ faces + first names (screen-reader list) | Sees the event; tapping anything except RSVP asks them to make an account |
| Add a job with count, time, description, shifts | ✓ | ✗ | ✗ |
| Add *something else* (a plain item) | n/a (the lead uses the full form) | ✓, and they're **automatically signed up for it** | ✗ |
| Sign up / take yourself off | ✓ (can sign up for their own jobs) | ✓ | ✗ → *Create a free account* |
| Remove a job | ✓ any job | Only a *something else* they added | ✗ |
| Edit jobs (Edit what you need) | ✓ | ✗ | ✗ |

**Why guests can't sign up:** a sign-up is a promise, and the lead needs to be able to reach the person and remind them. So guests can RSVP with just a first name, but jobs need an account. The sign-in sheet says so: *"Guests can RSVP. To suggest, vote, sign up to help and get reminders, make a free account."* Sign-in is a 6-digit email code or Google, with no password, so the step stays light.

**Why only the lead sets counts, times and shifts:** the lead owns the plan. If anyone could add *"Bring drinks · need 10"*, the list would stop reflecting what the event actually needs. Other people can still offer what they're bringing.

---

## 5. Every place it shows up

### 5.1 Create event: step 5 of 6, "Ask for help"
(Updated 2026-10-03 for Design's 24b3 and 24c3c; it was *How people can help*, with *Decide later*.) No subtitle.

- **How it works, while the list is empty:** a lavender card with three steps, each a purple numbered circle: **You list what's needed** · *Like “Bring snacks” or “Set up chairs.”*; **People sign up** · *They tap a job on the event page.*; **You see who's on it** · *No group texts to sort it out.* It goes once a job is added; the jobs then come first and the chips' label changes from *START WITH ONE* to *ADD ANOTHER*.
- **Starter chips** (46px white pills with a purple +): `+ Bring` · `+ Set up` · `+ Help with` · `+ Clean up` · `+ Coordinate` · `+ Something else` (dashed). A chip opens the **Add a job** sheet with its verb in the title ("Bring ") and the cursor after it.
  - *Why:* a blank field stalls people. A verb gets them halfway there.
  - **After the verb, gray italic filler** (*snacks, chairs, ice…*) and **five chips that finish the title** (Bring: *snacks · drinks · ice · chairs · plates & cups*; each verb has its own). They go as soon as anything is typed after the verb. *Why:* Cynthia tapped *Bring* and typed "snacks" in the description, leaving the title as "Bring".
  - **Save stays disabled while the title holds only the bare verb.**
- **Add a job sheet:** the title, then **+ Add details or a time** (the description, time and shifts open behind it; they show by themselves when editing a job or once filled) with the **People needed** stepper (− n +, default 1) beside it. Times pick from the app's own list (not the browser's menu).
- Each added job becomes a row card: name, a meta line (*3 people · 6:00pm*, *Anyone*, or *2 shifts*), the first line of its description, **Edit**, and a red trash icon.
- **No Decide later on this step.** Under the chips, an **OR** divider and a plain radio row **No help needed**, with *Most events go better with a few helpers!* under it. **Next** stays gray until a job is added or No help needed is picked (*Add a job, or pick No help needed.*). Adding a job clears the pick. *Why:* Joseph read Decide later as a tab left open.
- No help needed is saved on the event and counts as the idea's **Jobs** step (Lead · Location · Details · Jobs · Date; progress only).
- On **Review**, the *Ask for help* card lists the jobs (or reads *No help needed*) and has **Edit**.

### 5.2 Event page: the **Help out** section
A section title, *Help out*, with a gray pencil **Edit** for the lead. Below it, **one white card per job** (radius 20, padding 18):

```
┌─────────────────────────────────────────────┐
│ Set up tables                           (✕) │  ← 18px/900. The ✕ shows for the lead, or for whoever added a "something else"
│ 8:30 – 9:00am · 2 still needed              │  ← gray 14.5/700: time · "You added this" · count
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░   1/3       │  ← only when there's a count
│ (lead only) 🙂 Maria · 8:30 – 9:00am         │
│             "I'll bring the folding ones"    │
│ 🙂🙂🙂   Details ›              [ Sign up ] │
└─────────────────────────────────────────────┘
```

**The subline** joins what applies with " · ":
- the time: *5:00pm*, *5:00 – 6:00pm*, or for shift jobs *2 shifts · 6:00 – 8:00pm*
- *You added this* (on your own *something else*)
- the count: *N still needed*, or *All covered* when full, or *N in* when there's no limit

**The progress bar** (only when there's a count) uses three color states:
- **Lavender** (`#5b4ae8` on `#ebe8fd`): nobody yet
- **Green** (`#4f9e6b` on `#dff0e4`): others have signed up
- **Gold** (`#e8b84a` on `#fcf0d8`): **you're** on it

*Why:* you can tell at a glance whether a job needs you, has momentum, or is already yours. Next to the bar sits **n/need** in 15px/900.

**The button** (right-aligned pill, 42px tall) has three states:
- **Sign up**: outlined purple. One tap and you're on it. On a shift job it opens **Pick a shift** instead.
- **✓ You're in**: gold fill, brown text. Tapping it takes you off.
- **Full**: gray outline, disabled. Shown when every spot is taken and none is yours.
- No button at all on a cancelled event.

**Faces:** up to 4 overlapping 32px avatars of the people signed up, which everyone can see. *Why:* seeing that real neighbours already said yes is the strongest nudge to join (social proof / "threshold" effect, from the project's research notes).

**Lead-only list:** under the bar, the lead sees one row per sign-up: a 26px face, the full name, the shift time for shift jobs, and the person's note in quotes. A guest shows under the name they left. *Why:* the lead needs to know who is bringing what and when. Members only need to know that people are in.

**Details ›**: a purple link that expands the description in place (the chevron rotates). It only appears if the job has a description.

**Below the cards:**
- For **members**: a dashed gold box, **+ Add something else**, which expands to a field (*Bringing something else?*) and an **Add** button. Adding signs you up for it right away.
- For the **lead**: no adder here. They use **Edit**.
- **Empty states:** the lead sees a dashed gray box, *Add ways people can help.*, which opens Edit what you need. Members see *Nothing on the list yet. Bringing something? Add it below.*

### 5.3 Pick a shift (bottom sheet)
Opens from **Sign up** on a job that has shifts.
- The job name and its description, then one row per shift: the time range and the spots (*2 of 3*). Each row is a checkbox. **You can tick more than one.**
- Full shifts can't be ticked unless they're already yours.
- One optional note field, *Add a note, if you want* (60 characters), saved on your entry in each shift you picked.
- **Done** (purple, full width). It saves only what changed: new shifts are added, unticked ones removed, the note updated.

### 5.4 Confirmation banners (bottom of the screen, above the tab bar)
These replaced an older *"Will you be there?"* sheet, so signing up is now a single tap.

- **You're on it** (green `#0f7a3c`, 4 seconds): a big white check, *You're on it*, the lead's face and *{Lead} is counting on you*, and **Undo**.
  - *Why "counting on you":* it makes the commitment personal (a person is relying on you, not an app), which makes people more likely to show up. **Undo** makes the single tap safe.
  - On your own event it says *Added to your jobs* instead.
- **You're off it** (cream `#fff6dc`, 7 seconds): *We'll let {Lead} know. A quick check-in with them helps too, or find someone to take your spot.*, with **Undo**, ✕, and a black **Find a replacement** button.
  - *Find a replacement* opens the share sheet with a ready message: *"Hey! I can't make it to {job} for {event} anymore. Any chance you could take my spot?"* + link.
  - *Why:* dropping out shouldn't leave the lead with a silent hole. This gently asks you to hand it on.
  - On your own event, a simple toast instead: *Removed you from {job}*.

### 5.5 "You're helping" sliver (event page, under the photo)
For a member with jobs on this event: a gold bar (`#fefaef` / `#8f6405`), clipboard icon, **You're helping · N tasks ⌄**. It expands to rows of *job — time* (or *Any time*). It's collapsed by default, and the open/closed state is remembered per event on that device.

The lead's version is the purple **Your tasks** bar. It includes *Pick a date*, *Pick a location*, **Fill open spots · N open** (opens the share sheet with a message naming the open jobs: *"{event} · {date} still needs: Ice (2), Chairs. Can you grab one?"*), plus any jobs the lead took.

### 5.6 Edit what you need (lead's full-height sheet)
Opens from the pencil on Help out, the empty dashed box, or the Edit event menu.
- One gray card per job: **JOB 1** (· SHIFTS), *N signed up* in green, and a trash button.
- Fields: name · Details · either **Time + People needed stepper**, or a list of **shift rows** (start – end, People needed stepper, ✕), with **+ Add a shift** and *Use one time instead* / *Split into shifts*.
- **+ Add a job or item** (dashed).
- **Cancel** / **Save changes**.
- **Guard rails:**
  - **A job with sign-ups can't switch between one time and shifts.** In place of the switch link there's a gray line: *People are signed up, so it can't be split into shifts.* / *People are signed up for these shifts, so they stay as shifts.* *Why:* sign-ups attach to the job or to a specific shift, so switching would silently drop people.
  - A shift with people on it shows *N people are on this shift. Removing it lets them know.*
  - If someone signs up while the sheet is open and the lead tries that switch anyway, Save stops: *Someone just signed up for "{job}", so it can't switch… Close and open it again.*
  - Save only removes jobs that were on screen when the sheet opened, so a job added meanwhile survives.

### 5.7 Removing a job
Removing a job by ✕ on the card, or in Edit what you need, first asks: *Remove "{job}"?* · *The N people signed up get a note that it's off the list.* · **Remove** / **Keep it**.
Everyone signed up (including shift sign-ups) gets a note: *"{job}" is off the list for {event}.* It appears in Notifications under Updates and goes out as a phone push.

### 5.8 RSVP ↔ sign-up rules
- **Taking a job marks you Going** on a planned event, whatever you'd answered before (no answer, Maybe, or Can't). *Why (owner's call, 2026-09-30):* if you're bringing the ice, you're coming. Asking you to RSVP separately would be a pointless extra step, and a "Maybe" with a job makes the lead's numbers wrong. **Undo** on the banner puts your old answer back.
- The lead isn't notified twice: the sign-up notification covers the automatic Going.
- **Tapping Can't while you hold a job** asks: *Take you off "{job}" too?* (or *your N jobs*) · *{Lead} is counting on you for {jobs}. If you can't make it, free the spot so someone else can grab it.* · **Take me off** / **Keep my spot**. *Why:* a silent no-show on a job is worse than an empty slot, because nobody knows it needs filling.
- **On ideas** (no date yet), signing up doesn't change any RSVP, since there's nothing to RSVP to yet. Ideas have their own Sign-ups card.

### 5.9 Finding things to help with (discovery)
- **"N events could use a hand"**: a gold-accented row on the Calendar that you can dismiss for the visit. It opens the **Could use a hand** sheet: upcoming events in the next 2 weeks (excluding ones you lead) with open counted spots. Each event card shows a date block, a gold rule, title, time · place, and then one row per open job or shift: a gold ring, the job name, *12:00 – 1:30pm · 2 of 3 open* (shift times in amber 800), and a black **Claim** pill, or a gold **✓ Yours** if you already took it. Claiming works exactly like Sign up (Going + the *You're on it* banner).
  - Empty: *Everything's covered for the next two weeks. New asks show up here.*
- **Filters / sorts:** *Needs helpers* in Filter, Search's **Try** chips and group Browse chips; the **Needs you** sort splits the list into *Could use a hand* / *All covered*. Wildcard cards include **Lend a hand** (*The soonest event still looking for helpers*) and **They need you** (*Most open helper spots*).
- **Your tasks → Helping** (green): each event where you're helping, with your jobs and their times. The empty state, *Find something to help with* (*Leads in your groups need a hand. Sign up to bring something or pitch in.*), opens Could use a hand.

### 5.10 The lead's dashboard
- **Leading** cards have a stats strip, **Going · Maybe · Sign-ups**, with sign-ups shown as *filled/needed* (amber while spots are open, gray "—" when nothing is counted).
- To-do row: *N spots open · Share list* → the share sheet with the open jobs named.
- **After the event:** *Thank {name}* / *Thank your N helpers* opens a message to everyone: *"Thank you {names} for helping make {event} happen!"* *Why:* recognising helpers is what makes them help again, and it's the first step toward co-leading.

### 5.11 Notifications
- **The lead and co-leads** get *"{Name} signed up for "{job}" at {event}"* in the app and as a phone push (setting: *Things you're leading*).
- **Helpers** get the day-before and morning-of reminders (8am) for anything they're **going to or helping with**, plus host updates and date/time/place changes. *Why:* reminders are the main reason we need an account to sign up.
- **Helpers** also get a note when their job is removed or the event is cancelled or taken down.

---

## 6. Rules the database enforces

These aren't just UI rules; the server enforces them, so the design never has to account for them being broken:
- A job or shift **can't be over-claimed**: once it hits its count, more sign-ups are refused (*that one's covered*). If two people tap the last spot at once, one gets an error toast.
- A job that has shifts can't be claimed directly; only its shifts can.
- One sign-up per person per job/shift.
- Only the lead (or co-leads) can add a job with a count, time, description or shifts. Anyone who can see the event can add a plain item.
- A cancelled event takes no new sign-ups.

## 7. Known gaps / open design questions
- **The Create event job form can't set end times yet** (only the start time); Edit what you need can.
- **Descriptions and shifts have only a basic form.** The full design is still open, and the demo's *Street tree planting* shows them off.
- **No "ladder" nudges yet:** e.g. *after two jobs, want to co-lead?*, or *the next one needs a helper* after you attend. These are on the research wish list.
- **No ask-by-name for a job:** Fill open spots only shares a general message.
- **No reminder or "still coming?" check aimed at helpers specifically** (they get the normal event reminders).

## 8. Tone notes for copy
Warm, short and human, with the lead named wherever possible (*{Lead} is counting on you*, *We'll let {Lead} know*). Use plain verbs: **Sign up**, **Claim**, **You're in**, **You're on it / You're off it**, **Find a replacement**, **Take me off / Keep my spot**. Never guilt-trip; always give a graceful way out, and a way to hand the job on.
