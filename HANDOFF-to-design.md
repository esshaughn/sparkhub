# Handoff: Sparks (Torrez Fitness) — live build → Claude Design

**Direction:** code → design. This describes what's **live now**, so the next design round starts from what shipped rather than from the design file.

- **Live:** https://torrezhub.vercel.app (open it on a phone)
- **Source:** github.com/esshaughn/torrezhub (`index.html`, `js/sparks.js`, `css/sparks.css`)
- **Baseline:** `design_handoff_sparks_walktober_v2/Walktober App v2.dc.html` + its README, from "Spark Torrez - Full Site 2.zip"
- **As of:** 2026-09-24 (reviewed after the audit and tests)

Everything in the v2 README is built as specified, except what's listed below. Where this doc and the v2 files disagree, **this doc is correct**.

---

## 1. What changed since the design

| # | Change | Design said | Why |
|---|---|---|---|
| — | *Nothing yet.* | | |

## 2. Things the build had to invent (please design these properly)

The v2 README says to keep the live placeholders for loading, error and empty states. These are the current placeholders, plus a few small states the design didn't cover.

### a. Loading
- The idea count reads **"Loading ideas…"** until data arrives. There's no spinner or skeleton.

### b. Couldn't load (offline, server down)
- Pink banner at the top of the page: *Couldn't load ideas. Check your connection, then refresh.* It clears on its own once the app reconnects (it retries every 30s).
- Styling: background `#fdeef0`, border `1.5px #f5c2cb`, text `#9b1c31` 14.5/700, radius 14.

### c. Couldn't save / small errors
- Dark pill above the tab bar for 3.5s. The copy is one of:
  - *That didn't go through. Try again in a moment.* (any failed save)
  - *That photo couldn't be read. Try a different one.* (a file the browser can't open, e.g. HEIC on some desktop browsers)
  - *Couldn't send a code to that number. Check it and try again.* / *That code didn't work. Check it, or text it again.* (text sign-in, see §4)
- Styling: background `#0d1117`, white 14.5/700, radius 14.

### d. Busy button labels
- "Put it up" reads **"Putting it up…"** while photos upload (a few seconds on a phone connection).
- The sign-in buttons read **"Sending…"** and **"Signing in…"**.

### e. Unknown idea link
- A link to a deleted or wrong idea shows Home. There's no message yet.

## 3. Behaviour added in the build (no visual change)

- **Shareable links:** `#/ideas` (browse), `#/how`, `#/me` (profile), `#/idea/<id>`. The phone's back button moves between screens. The post flow and edit screen don't change the URL. Opening a link while the app is already open goes straight there, even for an idea posted after the page loaded (it briefly shows Home while it fetches).
- **Photos** are shrunk to at most 1600px (JPEG) before upload, so a 5 MB phone photo becomes ~300 KB. They're stored in Supabase Storage and are public by link. Deleting an idea also deletes its photos if the lead deleting it is the one who posted them. A lead who took over someone else's idea can delete the idea, but the original poster's photo files stay in storage, unlinked.
- **"You" vs names:** posters always show by name, including to themselves. Lead-only copy ("You're out front…") still says "you".
- **Changing your name** updates it everywhere it's shown: your ideas, the ones you lead, and your offers. RSVPs keep the name typed into the RSVP.
- **Offer approval** applies to spots and days from anyone other than the lead. When the lead offers a spot or day, it applies straight away. "I can help with something" always posts straight away.
- **Removing a date** someone picked keeps them on the RSVP list, just without that date, and they still count toward "N in".
- **Everything is shared** through the database and refreshes every 30 seconds. If someone's anonymous identity stops working mid-visit, a new one starts quietly. Without text sign-in (§4), lead status doesn't carry over.

## 4. Designed but not built or not working

- **Text-code sign-in is built but switched off.** The Profile's "Keep your ideas" card and the name pop-up's "Been here before? Sign in" link are hidden until an SMS provider (e.g. Twilio) is connected to Supabase. That's an owner/billing decision, not a design one. Everything else on the Profile screen works.
- **"How this works" body copy** is still placeholder Latin (the heading is final).

### Design file housekeeping

The v2 `.dc.html` still contains screens that nothing in it can reach, and the build has now deleted them: the **"A few quick ones"** follow-up questions screen, the **category filter** menu, and the **"Holding an idea"** pop-up (its link left in v2). Worth removing from the design file too, so they don't come back by accident.

## 5. Open questions for the next round

1. **Telling the lead about new RSVPs and offers.** Nothing notifies them. They have to open the app. (Marked out of scope in v2.)
2. **Spam and moderation.** Anyone with the link can post. Is there a report or hide action, or an admin view for Torrez staff? (Marked out of scope in v2.)
3. **Adding date options once a day is set.** The design only offers "Add a date option" when no day is picked. So an idea posted with a date can't later put alternatives up for a vote unless the day is cleared, and nothing clears a day. Intended?
4. **After Walktober.** The date pickers (posting and "Add a date option") only allow October 2026, per v2. From November, nobody can pick a date. Is Sparks Walktober-only, or should it carry on? If so, what happens to the Walktober hero card and the gold "Walktober" styling?

## 6. Design tokens: unchanged

As listed in the v2 README.
