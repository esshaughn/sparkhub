# Handoff: Sparks (Torrez Fitness) — live build → Claude Design

**Direction:** code → design. This describes what's **live now**, so the next design round starts from what shipped rather than from the design file.

- **Live:** https://torrezhub.vercel.app (open it on a phone)
- **Source:** github.com/esshaughn/torrezhub (`index.html`, `js/sparks.js`, `css/sparks.css`)
- **Baseline:** `design_handoff_sparks_walktober_v2/Walktober App v2.dc.html` + its README, from "Spark Torrez - Full Site 2.zip"
- **As of:** 2026-09-24 (feature scrub, email sign-in for leads, location suggestions)

Everything in the v2 README is built as specified, except what's listed below. Where this doc and the v2 files disagree, **this doc is correct**.

---

## 1. What changed since the design

| # | Change | Design said | Why |
|---|---|---|---|
| 1 | **Sort menu is Newest · Oldest · Most popular.** Most popular = most "I'm interested" first | Newest · Oldest · Needs a lead · Almost there | Owner decision |
| 2 | **Card interest pill uses a person icon** instead of the bolt. The idea page's "I'm interested" button still uses the bolt | Bolt icon | Owner decision. Should the button match? |
| 3 | **Every idea has a lead, always.** Posting makes you the lead, and there's no way to leave an idea leaderless. Gone: the "Needs a lead" card label and hero pill, "I'll take the lead on this", the "You're out front on this one" pop-up, "Step back from the lead", and the lead's paragraph about stepping back | Ideas could be leaderless; leads could step back and others take over | Owner decision; may return later |
| 4 | **No minimum head count anywhere.** Gone: "Success is N or more, counting the lead", "· N short of N" on date rows, the "Enough to go" badge | Shown when a head count was set | Owner decision; will return later |
| 5 | **Leads sign in with email; everyone else doesn't.** Browsing, "I'm interested", offering and RSVPing still need nothing but a name (and a phone number to RSVP). Tapping **Put it up** when not signed in opens a **"Sign in to post"** pop-up (email → 6-digit code), then posts the same draft. Profile shows **"Sign in with email"** or **"Signed in as you@…"** + Sign out. The name pop-up's "Been here before? Sign in" link is back | Text-code (phone) sign-in, optional, on the Profile | Owner decision; SMS costs money, and it keeps ideas tied to a real person |
| 6 | **Location step suggests places as you type** (after 3 letters): up to 5 places, businesses or addresses near Austin, each with a pin, the name in bold and the address in grey, plus a tiny "Powered by Geoapify · © OpenStreetMap contributors" line (required credit). Picking one fills the name and shows its address under the field; typing anything else still works. The idea page shows that address under "The spot" with a **Directions** link | Plain text field | Owner request |
| 7 | **"Continue with Google"** sits at the top of the sign-in pop-up (white pill, 2px #dcdfe6 border, Google "G" logo, 16px/800 text; "Opening Google…" while busy), then an "or" divider, then the email option. Intro copy becomes *Use Google, or we'll email you a 6-digit code. No password.* Tapping it leaves for Google's page and comes back; a half-finished idea is kept and posts on return. If they cancel at Google: back where they were with *Google sign-in didn't finish. Try again, or use your email.* Google's screen names the Supabase address (…supabase.co) until Spark Hub has its own sign-in domain | Email or phone only | Owner request |

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
  - *Couldn't send a code to that email. Check it and try again.* / *One code a minute. Wait a moment, then try again.* / *That code didn't work. Check it, or send it again.* (email sign-in)
- Styling: background `#0d1117`, white 14.5/700, radius 14.

### d. Busy button labels
- "Put it up" reads **"Putting it up…"** while photos upload (a few seconds on a phone connection).
- The sign-in buttons read **"Sending…"** and **"Signing in…"**.

### e. Unknown idea link
- A link to a deleted or wrong idea shows Home. There's no message yet.

### Location suggestions (invented)
- Suggestion list sits directly under the Location field: white, 2px #e6e7eb border, 18px radius, rows 12px/16px padding with hairline dividers. Pin icon (#9aa0ac), name 15.5px/800, address 13.5px/500 #6b7280. Credit line 11.5px #9aa0ac.
- After a pick: purple pin + address (14px/600 #5c6270) under the field.
- Idea page: address 13.5px #6b7280 under "The spot: …", then " · **Directions**" in purple 800.

### Sign-in pop-up and email (invented; the design had a phone version)
- **Step 1:** heading **"Sign in to post"** (from Put it up) or **"Sign in"** (Profile, name pop-up). Body: *Whoever posts an idea leads it, so leads sign in. We'll email you a 6-digit code. No password.* (or *…Anything you lead follows your email to any phone.*). Email field (placeholder `you@example.com`), **Email me a code** (purple pill, grey until the email looks valid), fine print *Only used to sign you in. Nobody else sees it.*
- **Step 2:** **"Enter the code"**, *Sent to you@… · Change*, a big centred code field (26px, 800, letter-spaced), **Sign in**, *Not there? Check spam, or* **Send it again** (→ "Sent again").
- **The email itself** (sender "Spark Hub", sparks@mail.ericscott-creative.com for now; subjects "Your Spark Hub sign-in code" / "Confirm your email for Spark Hub"): white card on light grey, purple "SPARK HUB" eyebrow, heading "Your sign-in code" / "Confirm your email", a short "Hi there" explanation of why it was sent, the code at 36px, a no-password note, an "ignore this if it wasn't you" line, and a small grey footer saying what Spark Hub is and that we only email when you ask for a code. The extra plain text is there to keep it out of spam folders. Source: `supabase/templates/`.
- Platform-level copy says **Spark Hub**, not Torrez Fitness: one account will work across groups.

## 3. Behaviour added in the build (no visual change)

- **Shareable links:** `#/ideas` (browse), `#/how`, `#/me` (profile), `#/idea/<id>`. The phone's back button moves between screens. The post flow and edit screen don't change the URL. Opening a link while the app is already open goes straight there, even for an idea posted after the page loaded (it briefly shows Home while it fetches).
- **Photos** are shrunk to at most 1600px (JPEG) before upload, so a 5 MB phone photo becomes ~300 KB. They're stored in Supabase Storage and are public by link. Deleting an idea also deletes its photos.
- **"You" vs names:** posters always show by name, including to themselves. Lead-only copy ("You're out front, with a day, a place…" on a happening idea) still says "you".
- **Changing your name** updates it everywhere it's shown: your ideas, the ones you lead, and your offers. RSVPs keep the name typed into the RSVP.
- **Offer approval** applies to spots and days from anyone other than the lead. When the lead offers a spot or day, it applies straight away. "I can help with something" always posts straight away.
- **Removing a date** someone picked keeps them on the RSVP list, just without that date, and they still count toward "N in".
- **Everything is shared** through the database and refreshes every 30 seconds. If someone's anonymous identity stops working mid-visit, a new one starts quietly. Leads are signed in, so their ideas follow their email to any phone. Signing in on a new phone also moves that phone's anonymous activity (interest, offers, RSVPs) into the account.

## 4. Designed but not built or not working

- **"How this works" body copy** is still placeholder Latin (the heading is final).

### Design file housekeeping

The v2 `.dc.html` still contains screens that nothing in it can reach, and the build has now deleted them: the **"A few quick ones"** follow-up questions screen, the **category filter** menu, and the **"Holding an idea"** pop-up (its link left in v2). Worth removing from the design file too, so they don't come back by accident.

## 5. Open questions for the next round

1. **Telling the lead about new RSVPs and offers.** Nothing notifies them. They have to open the app. (Marked out of scope in v2.)
2. **Spam and moderation.** Anyone who signs in with an email can post. Is there a report or hide action, or an admin view for Torrez staff? (Marked out of scope in v2.) Bot protection (Cloudflare Turnstile) is planned and invisible.
3. **Adding date options once a day is set.** The design only offers "Add a date option" when no day is picked. So an idea posted with a date can't later put alternatives up for a vote unless the day is cleared, and nothing clears a day. Intended?
4. **After Walktober.** The date pickers (posting and "Add a date option") only allow October 2026, per v2. From November, nobody can pick a date. Is Sparks Walktober-only, or should it carry on? If so, what happens to the Walktober hero card and the gold "Walktober" styling?
5. **The lead's card now ends at the offer chips.** Removing the step-back paragraph left the lead with no line of their own in "How close this is". Does it want a short lead-facing note, or is it fine as is?
6. **"Somebody out front" is always ticked** now that every idea has a lead, so every idea starts at "1 of 4 in place". Keep it as a reassurance, or drop it and count to 3?

7. **Spark Hub, many groups.** The owner plans for this to become **Spark Hub**: one app with many groups (Torrez Fitness, neighbourhoods, PTAs, friend groups), one account across all of them. Sign-in and emails already say Spark Hub; the header eyebrow still says Torrez Fitness. How should the group name, group switching and the Spark Hub brand sit together? And should the Walktober hero become a per-group slot?
8. **"Know a spot?" pop-up** still takes free text. Should it get the same place suggestions as the Location step?
9. **Directions link** opens Google Maps for everyone (it works on iPhone too). Fine, or offer Apple Maps on iPhones?

## 6. Design tokens: unchanged

As listed in the v2 README.

