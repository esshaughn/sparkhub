# Handoff: Sparks (Torrez Fitness) — live build → Claude Design

**Direction:** code → design. This describes what's **live now**, so the next design round starts from what shipped rather than from the original design file.

- **Live:** https://torrezhub.vercel.app (open it on a phone; the database starts empty, so post a test idea to see the full detail screen)
- **Source:** github.com/esshaughn/torrezhub (`index.html`, `js/sparks.js`, `css/sparks.css`)
- **Baseline:** `design_handoff_sparks_app/Walktober App.dc.html` from "Spark Torrez - Full Site.zip"
- **As of:** 2026-09-24

Where this doc and the `.dc.html` disagree, **this doc is correct**.

---

## 1. What changed since the design

| # | Change | Design file said | Why |
|---|---|---|---|
| 1 | **The "Does it hinge on something you'd have to round up?" question is gone** | The only follow-up question for Walktober ideas | Owner request |
| 2 | **The Questions screen ("A few quick ones") never appears for Walktober ideas.** "Put it up" goes straight to the idea's page with the "It's up" tag | Posting always led to the questions | Side effect of #1: no questions were left |
| 3 | **"Add a little to this" is hidden** on idea pages when a category has no questions (all Walktober ideas today) | Always shown | It would have opened an empty screen |
| 4 | **The "needs something" / "nothing special" chips and the matching fact lines are gone** | Shown on cards and in the facts list | Owner request |
| 5 | **The browse card's lead line is gone** ("Rosa M. is out front", "happening — X out front") | Shown next to the progress pips | Owner request. "needs a lead" still shows when nobody leads |
| 6 | **Sample ideas removed.** The real app starts empty | 8 seeded Walktober ideas | They used made-up people and phone numbers |
| 7 | **The "More on finding somebody to share it with →" link is gone** from the "You're out front on this one" pop-up | Link to `#` | It had no destination. Needs one before it comes back |

## 2. Things the build had to invent (please design these properly)

The design didn't cover these, so code filled the gaps using existing card and pop-up styles. All are live and all are placeholders.

### a. "What should we call you?" pop-up

The design never asks posters for a name, but other people need one to see on cards and offers. So this appears **the first time** someone posts, takes the lead, or makes an offer. It's asked once and remembered on that device.

- Title: **What should we call you?**
- Hint: *First name is fine. It shows next to what you post and offer.*
- One text field (placeholder "Your name") and a **Continue** button, dimmed until something is typed
- Same pop-up style as "Know a spot?"

> **Design question:** is a pop-up right, or should the name be a field in the post flow (e.g. on "A couple more specifics")?

RSVPs already ask for a name. If someone RSVPs before ever posting, that name is reused.

### b. Empty browse list

- A white card: **No ideas yet.** / *Be the first to put one up — rough is fine.*
- The hero card and browse count read **"0 ideas so far"**

### c. Loading

- The idea count reads **"Loading ideas…"** for the second or so before data arrives. There's no spinner or skeleton.

### d. Couldn't load (offline, server down)

- Pink banner at the top of the page: *Couldn't load ideas. Check your connection, then refresh.*
- It disappears on its own once the app reconnects (it retries every 30 seconds), so people don't have to refresh.
- Styling: background `#fdeef0`, border `1.5px #f5c2cb`, text `#9b1c31` 14.5/700, radius 14

### e. Couldn't save

- Dark pill above the tab bar for 3.5s: *That didn't go through. Try again in a moment.*
- Styling: background `#0d1117`, white 14.5/700, radius 14

### f. Unknown idea link

- A link to a deleted or wrong idea shows Home. There's no message yet.

## 3. Behaviour added in the build (no visual change)

- **Shareable links:** each screen has its own URL: `#/ideas` (browse), `#/how`, and `#/idea/<id>` (a specific idea). The phone's back button moves between screens. Posting and the questions screen don't change the URL.
- **Everything is shared:** ideas, leads, offers, date options and RSVPs are saved to a shared database. The app refreshes every 30 seconds and when you return to the tab.
- **Privacy (as designed, now enforced):** RSVP names and phone numbers are visible **only to that idea's lead**. Everyone else sees counts ("2 in · 1 can't make these").
- **Who you are:** there's no sign-up. Each browser gets an invisible identity, and "You" means "this browser". **Clearing the browser or switching phones loses your lead status.** See the open question in section 5.
- **Lost sign-in recovers quietly:** if that invisible identity stops working mid-visit (site data cleared, or removed in Supabase), the app starts a new one in the background and keeps going. There's no message. Like switching phones, the new identity doesn't keep the old one's lead status.
- **Frame:** full-bleed on phones. On desktop it's a centered 430px column with a 30px radius and a 24px margin. The tab bar respects the iPhone home-indicator area.
- **Times** are real ("3 minutes ago", "yesterday") instead of the design's fixed labels.
- **Accessibility:** keyboard focus rings, Escape closes pop-ups, and screen-reader labels on the icon-only buttons.

## 4. Designed but not built or not working

- **Profile tab** (5th icon): does nothing.
- **"How this works"** (the home section and its own tab) is still **placeholder Latin**. It needs real copy.
- **"Step back and hand it down"**: the lead's card says *"If it stops being yours to carry, step back and hand it down"*, but there's no button to do it.
- **The category filter** from the older build isn't in this design. Everything is Walktober, and only the sort menu shows.

## 5. Open questions for the next round

1. **Getting back your ideas on a new phone.** Should there be a real login (email link, text code), or is losing lead status acceptable?
2. **Editing or deleting your own idea.** It isn't designed and isn't possible today.
3. **Handing down or stepping back from the lead.** The copy promises it (see section 4).
4. **Offers overwrite instantly.** "Offer a spot" or "Offer a day" from anyone replaces the idea's spot or day immediately, with no lead approval. That matches the design file. Intended?
5. **Date options can't be removed** once the lead adds them (max 3).
6. **Sort menu.** "Most filled in", "Needs a crowd" and "Still just an idea" sort by the follow-up answers. New ideas don't get answers anymore (see #1–2), so these three now sort the same as "Newest". Keep, rethink, or remove?
7. **Telling the lead about new RSVPs.** Nothing notifies them. They have to open the app.
8. **Spam and moderation.** Anyone with the link can post. Is there a report or hide action, or an admin view for Torrez staff?

## 6. Design tokens: unchanged

Figtree; ink `#0d1117`; primary `#5b4ae8` (hover `#4a3ad4`); spark gold `#e8a71c`; gold eyebrow `#8f6405`; success `#0f7a3c`; app background `#f1f2f5`; page `#e9eaee`; card radius 18–20; pill radius 999. All screens, copy and spacing not listed above match the `.dc.html` exactly.
