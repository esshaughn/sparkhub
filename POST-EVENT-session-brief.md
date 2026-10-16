# Session brief: after the event, joy first

For a new Claude Code session on the owner's computer, 2026-10-16. Written at the end of a cloud session (https://claude.ai/code/session_0187RqKpAtBW7fDziPWM8MCU) that brainstormed this with the owner, then folded in Joseph's voice notes from the same day. **Nothing is built yet.** Read this whole file, then the files in *Read first*, before proposing anything.

---

## 0. Where things are

- **Branch:** `test` (pull first: `git pull origin test`). The cloud session pushed two commits: `6e1238b` (the Design brief) and the one that adds this file.
- **Already on `test`:**
  - `POST-EVENT-for-design.md`: the brief to Claude Design (owner's decisions, the sketched flow, the screens to draw, open questions). Linked from `HANDOFF-to-DESIGN.md` → *Start here* and **Q57**.
  - `design/post-event/Joy First Debrief Mockup.html`: a clickable sketch (open in a browser). Sample event and people. A sketch of the flow, not a visual direction.
- **Only on the owner's computer (not committed):** Joseph's notes at the top of `BACKLOG.md`, *"Joseph on a post-event debrief (voice notes, 2026-10-16)"*, and the *Wrapped* and *photo-nudge* ideas filed 2026-10-09. Read them in the local `BACKLOG.md`; commit them with the first commit of this work if the owner agrees.

## 1. Read first

1. This file.
2. `POST-EVENT-for-design.md` (the owner's decisions in its §3).
3. The local `BACKLOG.md` top section (Joseph) and the 10-09 Wrapped / photo-nudge entries.
4. In `js/sparks.js`:
   - `phaseOf` (~line 2126): an event is `done` only when `dayDate < todayISO()`, so **it stays a plan for the rest of its own day**. Anything "after the event" on the same evening lands on the plan page, not the past page. This matters for the after-event prompt (§5).
   - `viewDone` (~line 8889): today's separate *It happened* page. `viewPlan` (~line 8617) is the normal event page it should reuse.
   - `reactionsCard` (~line 6077), `pastCard6` (the Past scrapbook card), `nextTimeCard` (~8843), `doneFixCard` (~8812), `addAlbumPhoto` (~2495), `loadComments` (~8425), `cameCount` / `checkedIn` (~2147).
5. Migrations to model on: `20261004000000_reactions.sql` (reactions, incl. `thanks` and `again`), `20261125000000_next_time_notes.sql` (the lead's private note), `20261105000000_event_comments.sql` (Discussion and `can_comment()`), `20261119000000_one_kind_of_signup.sql` / `20261115000000_multi_day_fixes.sql` (the latest `private.push_parts()` and `private.push_daily()`, the cron-driven pushes to copy), `20261121030000_event_memory.sql` (`event_summaries`, close-out at 08:30 UTC).
6. `CLAUDE.md` → Tests, Database changes, Keep HANDOFF-to-DESIGN.md current, and the security rules for each table above.

## 2. What the owner wants (2026-10-16, in their words, condensed)

- **The past event page should still feel like the event page.** Description, sign-ups, who came, all of it, in the same look. Move the things that came at the end (photos, appreciations, comments, the debrief) **to the top**, so opening it gives a full sense of what the event was *and* how it felt. The **list** of past events stays as it is.
- **Confirm a past event can still be shared** and that the people who RSVP'd still show. (Checked: Share link works, *{Title}: here's how it went.*; who went shows only as a count in the header. No list, no description, no sign-ups, no Discussion on `viewDone`.)
- **Notifications:** everyone who RSVP'd gets one **during** the event (take a picture) and one **at the end** (upload pictures, share what they valued). They're not built: the only scheduled pushes are the day-before/morning-of reminders and spot/job reminders.
- **Why it matters:** the debrief is how a community pays it forward, learns and grows. It nourishes everyone who took part (lead, helpers, co-hosts, attendees) and gathers what makes the next one likelier, easier, and closer to what the community cares about.
- **Joy first, always.** Start with what gave people joy and energy, what they valued, what went well; celebrate with photos and appreciations. Only after that: *if and when we do this again, what would give you more joy?* The owner does **not** want a space where people dump everything to fix first and forget the positives.
- **A gate.** Either a time gate (only joy for the first day or two) or a personal one (once you've shared joy, you can share what you'd change). Either way, **joy first**.
- **"What could I do differently?"** before anything aimed at the organisers. Reflection, not homework and demands for the lead.
- **Low friction.** Not many touchpoints; neither step should feel like work.

## 3. Joseph's input (voice notes, 2026-10-16)

- **The need:** people are always on to the next thing and rarely stop to say what went well or what to change. He wants **each person's** experience: people get different things from the same night.
- **What he did:** sent Stacy a recap **voice message** after her sit-down dinner. She valued it.
- **The hard part:** it can't feel like a task. His ideas:
  - a **short version for most people**: *Would you do this again? What did you get out of it?*
  - **a couple of people share first to set the tone**;
  - ask whether they **want to be invited to the next one**.
- **A second goal:** the **host should feel appreciated**. A small thank-you makes them likelier to host again and gives them confidence. (Partly selfish, he says: the dinner inspired him.)
- **Habit comes from repetition**, and there aren't enough events yet for it to form.
- **What to track:** the small things that made it work: **the pace, room for silence and laughter, structure without too much structure.**
- He's still thinking on it.

**How Joseph fits the owner's plan:**

| Joseph | Owner / the sketch | Reconciled |
|---|---|---|
| *What did you get out of it?* | *What gave you joy?* | Same question. Joseph's wording is warmer for a dinner; the owner picks the copy. |
| *Would you do this again?* | *Do it again* (exists as a reaction), *I could…* | One tap, **I'd come again**, that also says *invite me to the next one* (below). |
| Invite me to the next one | — | New: a per-person flag that the next lead sees as a list when they plan a similar event (via *Do it again* or the *Last time* card). |
| Host feels appreciated | Thank someone | Thanks for the host is the first face, pre-picked? (ask). A host gets one gathered *Here's what people said* moment, not a trickle. |
| A couple share first | Joy is public | **Seed it:** the hosts' and first two people's joy shows to everyone else when they open the card (*Dee and Sam loved the people*). Social proof sets the tone, joy first. |
| Track pace, silence, laughter, structure | Joy chips | Add *how it felt* chips: *The pace · Room to just talk · Laughing · Easy, not over-planned · The quiet moments*. These are what the next lead most needs. |
| Voice note to the host | — | Later, not v1: needs a private audio bucket, size caps, moderation (Report), and transcripts for search. File as an open question. |
| Short version for most | Two steps | Step 1 is the short version (two taps). Step 2 is optional and only after step 1. |
| Habit from repetition | — | Same prompt shape every time, same timing, so it becomes a ritual. Don't vary it per event type yet. |

## 4. Proposed design (from the cloud session; challenge it)

**The past event page = `viewPlan` reordered, not a separate page.** Top: a slim *It happened* header (date, *N came*), the album (*+ Add yours*), **How it felt** (joy counts, a few quoted moments, who was thanked), thanks/reactions, Discussion. Then the normal event page, read-only where it makes sense: description, time and place, sign-ups (who did what), who came. Bottom: *Do it again*, host tools (*Wrong date?*, Delete). Keep the lead's private next-time card for hosts.

**The debrief card: one sitting, two steps, the order is the gate.**
1. **Step 1, joy (the short version).** *What gave you joy at {Event}?* chips; **Thank someone** (faces: lead, co-hosts, helpers with what they did, people who came; a tap thanks them, they get a note); *A moment you loved* (optional line); **I'd come again · invite me next time** (one toggle). The button reads *Tap what gave you joy* until one chip is picked.
2. **Step 2, next time (optional, opens right after step 1).** *If we do this again…* → **Next time, I could…** (*Bring a friend · Help with a job · Come early to set up · Take photos · Lead part of it · Stay to clean up*) → **What would give you more joy?** (*More time to talk · A different time · Something for kids · More people · Food after*) + optional line. **Skip this part** always visible.
3. **Hosts do the same card.** Their step 2 is private and replaces / feeds `next_time_notes`.

**Who sees what (suggested):** joy, quotes, thanks and *I could…* counts are public on the page. *More joy next time* wishes go to hosts only, grouped and counted, not before day 2. The host's digest opens with what people loved.

**Discussion on a past event:** for the first 48 hours its box's placeholder is *What gave you joy?* (a nudge, not a lock).

**Notifications (at most three per person who went):**

| When | Who | Draft copy | Opens |
|---|---|---|---|
| ~30–45 min after the start | Going | *📸 {Event} is happening · Snap a photo for the album.* | The event, photo picker ready |
| After it ends: **the morning after (Joseph)**, ~9–10am Central, or ~1h after the end if the owner prefers | Who went | *How was {Event}? · What did you get out of it? Thank {Lead}.* | The debrief card |
| Same | Hosts | *Thank your helpers, add photos, share what gave you joy.* | The debrief card |
| Day 2, only if they did nothing | Who went | *Still time to thank {Lead}.* (joy only) | The debrief card |
| Day 2 evening | Hosts | *What people loved at {Event} · 9 loved the people. 5 want to come again.* | The digest |

The morning after also fits the code: the event has turned `done` by then (`phaseOf`), so the card lands on the past page. A same-evening push would open the plan page.

## 5. Decisions to get from the owner before building

**Answered 2026-10-16 (owner, on their computer):** 1 **wait for Design** (build nothing until Q57 comes back); 2 order only; 3 the morning after; 4 **wishes public from day 2** (not hosts only), joy public; 5 the lead's face pre-picked; 6 a list for the next lead; 7 guests can fill it on the page; 9 voice notes later. Still open: 8 (chip wording) and 10 (event memory). All recorded in `POST-EVENT-for-design.md` §3. When Design's round arrives, start at §6 Phase 1.


Ask these together (AskUserQuestion), recommendation first:

1. **Build now as owner calls, or wait for Design's round?** (`POST-EVENT-for-design.md` / Q57 is with Design.) If building now, record each in `HANDOFF-to-DESIGN.md` → *Owner calls that stand* and §2.
2. **The gate:** personal order only (recommended: one sitting, step 2 after step 1), or also a time gate (step 2 opens on day 2 with its own push)?
3. **After-event push timing:** the morning after (Joseph; recommended) or ~1h after the end?
4. **Wishes:** hosts only (recommended) or public after day 2? And Joseph's question: does the **group** see the joy, or only the host?
5. **Thanks for the host:** pre-select the lead's face in step 1, a separate *Say thanks to {Lead}* nudge, or neither?
6. **I'd come again → invite me next time:** build the list now (shown to whoever plans the next similar event), or just a count?
7. **Guests without an account:** can they fill the card on the page (they can't get the push)?
8. **Chip wording** (both lists, plus Joseph's *how it felt* chips). The owner edits these.
9. **Voice notes:** later (recommended) or v1?
10. **Event memory:** should the counts go into `event_summaries` so the next lead sees *Last time people loved the pace and the people*? (Event memory is database-only and not on `main` until the Woodcliff launch batch is stable.)

## 6. Build plan (suggested phases; each its own batch)

**Phase 1: the page (small/medium; no migration).**
- Replace `viewDone` with `viewPlan` in a past mode (or a shared renderer): after-the-event block on top, the normal sections below, read-only sign-ups (no Sign up / Give up on a past event), who came as names (`cameCount` rules: attended if checked in, else Going).
- Keep: next-time card for hosts, *Do it again*, *Wrong date?*, delete, Share (*here's how it went*).
- Discussion on past events: `can_comment()` already allows Going/Maybe, so it should just work. Check `loadComments` isn't gated to `plan`.
- Tests: update the past-event assertions in `v6.spec.js` / `v8-21.spec.js` (grep `It happened`, `data-screen-label="It happened"`); add one for the new order.
- Docs: `FEATURES.md` row 66 (It happened page), `HANDOFF-to-DESIGN.md` §1 row (or *Owner calls that stand*), bump `?v=`.

**Phase 2: the debrief (big: migration, RLS).**
- New migration, e.g. `supabase/migrations/2026120206xxxx_debrief.sql`. A table such as `debriefs` (spark_id, user_id, joy text[] ≤ 8, moment ≤ 140, again bool, could text[] ≤ 6, more text[] ≤ 6, wish ≤ 140, step2_skipped, created_at; one row per person per event). Rules to decide: who can write (anyone Going/attended, and hosts: reuse `can_comment()`-style), who reads which columns (public: joy, moment, again, could; hosts only: more, wish). Column-level privacy means **two tables or a definer read function**, since RLS is row-level: e.g. `debriefs` (public parts) + `debrief_wishes` (hosts and the writer only). Revoke all, then grant exactly; Supabase gives `authenticated` every column on new tables by default (see *Hosts and who came* in CLAUDE.md).
- Thanks to a specific person: extend `reactions` (a `to_user` column, kind `thanks`) or a new `thanks` table; the thanked person gets a quiet note + one push (write the note `quiet` when the function also pushes, per *Take part* in CLAUDE.md).
- Hosts' private step 2 → `next_time_notes` (reuse, don't duplicate).
- Load: per event when the page opens (like `loadComments` / `ntNotes()`), **not** in `load_all()`, so the app's single load stays light. Tolerant of a database without the table.
- `tests/db/checks.sql`: who can write, who reads wishes, a guest can't. `e2e/security.spec.js`: an assertion for the new rules.
- Run `tests/db/run.sh`, then `scripts/db-push-test.sh`; a **full run on CI's throwaway Supabase** before `main` (big change).

**Phase 3: the pushes (medium/big: cron + migration).**
- A function like `private.push_after()` on a 15-minute cron (copy `push_parts`'s shape): finds events whose start + 30–45 min or end (or next morning) has passed, sends once, and marks it (a per-event, per-day sent marker, e.g. `sparks.after_pushed jsonb` with no client grant, or a small `private.after_pushes` table). Use `private.event_days()` for multi-day events.
- Skip cancelled, `test`, `demo` and `[E2E]` events (`push_send` already skips test links). Respect `notif_state.topics`: add a topic (e.g. `after`) and its switch in notification settings.
- Recipients: Going (and attended), plus hosts via `private.host_ids()`; the day-2 nudge only to those with no debrief row; the hosts' digest only if anyone answered.
- Deep links: the push URL opens the event with a query/hash flag that opens the card (or the photo picker for the during push).
- `notifications.spec.js` for the new topic; a db check for the selection (who gets which push), like `e2e_update_recipients()`.

**Phase 4 (later):** voice notes; *invite me next time* surfacing in Plan an event; event-memory aggregates; Wrapped (10-09 backlog).

## 7. House rules that apply (from CLAUDE.md)

- Work on `test`; merge to `main` only when the owner asks. Commit locally, push and test in batches about 30 minutes after the first unpushed change (or when the owner says "push to test").
- Every visible change updates `HANDOFF-to-DESIGN.md` in the same commit; every feature updates `FEATURES.md`; new features get a test, security rules an assertion.
- Migrations: never edit an applied one; `tests/db/run.sh` before `db-push-test.sh`; `cat supabase/.temp/project-ref` before any `--linked` command; live only with the owner's OK at merge time.
- All user text through `esc()`; new photo paths follow the photo path rule.
- Don't run the full suite against TEST to gate a merge; CI's throwaway Supabase is the gate.

## 8. First message to send in the new session

> Read `POST-EVENT-session-brief.md` on `test` (pull first), then `POST-EVENT-for-design.md` and the Joseph section at the top of my local `BACKLOG.md`. Ask me the decisions in §5, then start Phase 1.
