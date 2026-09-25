# Handoff: Spark Hub — live build → Claude Design

**Direction:** code → design. This describes what's built, so the next design round starts from what shipped rather than from the design file.

- **Built (test):** https://gosparkhub-git-test-eric-5958s-projects.vercel.app · **Live:** https://gosparkhub.vercel.app
- **Source:** github.com/esshaughn/sparkhub (`index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, `supabase/templates/`)
- **Baseline:** `design_handoff_spark_hub/Spark Hub App.dc.html` + its README, from "Spark Torrez - Full Site 3"
- **As of:** 2026-09-25 (the Spark Hub rebuild, on the test branch)

Everything in the Full Site 3 README is built as specified, except what's listed below. Where this doc and the design files disagree, **this doc is correct**.

---

## 1. What changed since the design

| # | Change | Design said | Why |
|---|---|---|---|
| 1 | **Location suggestions stay.** The post flow's Location step suggests places near Austin as you type (Geoapify), and a pick saves the street address. The idea page shows that address under the location, followed by a purple **Directions** link (Google Maps). The lead's **Set** for a location uses the same suggestions. Suggestions to the lead ("Know a location?") stay plain text. The privacy page keeps its Geoapify row | Remove suggestions, the picked address and Directions; plain text | Owner decision |
| 2 | **Welcome (signed out) rebuilt to the owner's mockup:** the picnic photo (`photos/welcome.jpg`) fills the top under a darker scrim; logo only (no Sign in top right); *Turn your idea / into a plan.* (line 2 `#a99cff`); the same line as Home; the 1-2-3 steps as one translucent pill (`rgba(255,255,255,.1)`, white labels); the card reads **Enter a group code** and its second button is **Start a group** (tint `#f3f1fe`, purple text, no border); below: a book icon + **How this works** link, then *Already have an account?* **Sign in** (white 800) | Photo, "Small ideas. / Done together.", Sign in top right, **Start your own group** outline button, three step tiles | Owner's mockup |
| 4 | Date pickers (posting, "Got a date & time in mind?", the lead's Set) allow **any date from today on** | October 2026 only | Many groups now, not just Walktober |
| 6 | **Home (signed in) header:** *Turn your idea / into a plan.* (line 2 purple), then *Post an idea. Your group helps pick the day, find the place and make it happen.* The three steps are one grey `#f2f3f6` pill: 22px coloured number dots (gold `#e8a71c`, purple `#5b4ae8`, green `#0f7a3c`, white 12/900 numbers), labels 13.5/800 ink, grey chevrons between | *Got an idea? / Spark it.*, a longer line, three separate tinted tiles | Owner's mockup |
| 5 | Wording: suggestion pop-ups say **Offer this location** / **Offer this date**; activity lines say "offered a location:" / "suggested a date:"; the lead's buttons say **Use this location** / **Use this date** | "Offer this spot", "floated a day", "Use this spot" | Matches the rows' "Location" and the README's leftover note |

## 2. Things the build had to invent (please design these properly)

### a. Not in a group yet
- Home (signed in, no groups) and All ideas show a white card: **You're not in a group yet.** / *Join one with a code from its organiser, or start your own.* with **Join with a code** (primary) and **Start a group** (secondary). The switcher reads **Your groups**.
- "I have an idea" / the + tab with no group opens **Join a group**.

### b. The lead's "Set" pop-ups
- Date: **Set the date & time** / *It shows on the idea straight away.* / a date-and-time field / **Set it**.
- Location: **Set the location** / same line / a location field with suggestions / **Set it**.
- Tags after: "Date set", "Location set".

### c. Suggesting a date (non-lead)
- **Got a date & time in mind?** / *Pick the day and time you're thinking of. The lead takes it from there.* / date-and-time field / **Offer this date**. (The design's hint was about rough dates, but the field is a picker.)

### d. Who's interested (lead only)
- Tapping "**N** interested" on your own idea opens **Who's interested** / *Only you see phone numbers. They're from people who took part without an account.* Rows: face, name, and for guests their phone as a purple tap-to-call link.
- Without this, the lead had no way to see the numbers guests leave.

### e. Group photos
- New groups have no photo yet, so their tiles and All ideas header fall back to gold `#e8a71c`, and their ideas without a photo fall back to brown `#2b2413`. There's no way to set a group photo yet (see §4).

### f. Small states
- Busy labels added: **Joining…**, **Creating…**, **Saving…**, **Confirming…**.
- Profile with no name reads **No name yet**.
- All ideas shows *Loading ideas…* above the skeletons.

## 3. Behaviour added in the build (no visual change)

- **Who sees what:** members see their groups' ideas. Opening an idea's link gives that visitor access to just that idea (and its group's name and photo), so guests can take part from a shared link. Join codes are visible only to admins (Group page).
- **Guests** give name + phone once per visit (remembered on the device as a convenience). The number is saved per idea and only that idea's lead can see it. Taking interest back never asks.
- **New-idea badges** count ideas posted by others since you last opened that group; opening it clears them.
- **Invite links** are `/join/CODE`. Signed out: Welcome with the code filled in. Signed in: the Join pop-up opens pre-filled.
- **Names** come from the profile; renaming updates every idea and offer you're named on.
- **Signing in on a new phone** moves that phone's anonymous activity (interest, suggestions, guest info, opened links) into the account.
- The confirm-email template serves both a first sign-in and a Profile email change, with different wording for each.

## 4. Designed but not built or not working

- **"How this works" body copy** is still placeholder Latin (as designed).

## 5. Open questions for the next round

1. **Group settings** (from the design's open list): rename, regenerate the code, set the **group photo**, remove members, co-admins, leave a group.
2. **Categories:** how they work; Walktober is meant to become one.
3. **An empty new group's first-run view** (today: "No ideas yet." under a gold header).
4. **Names:** first names or full names? (Google sign-ins show the first name.)
5. **Suggest vs Offer** wording in pop-up titles and activity lines (§1 #5 is the build's interim choice).
6. **Lead notifications:** still skipped.
7. **Google's sign-in screen** says "continue to …supabase.co" until Spark Hub has its own sign-in domain.
8. **Spark Hub address:** live at gosparkhub.vercel.app for now; a custom domain (e.g. sparkhub.group) may follow.

## 6. Design tokens: unchanged

As listed in the Full Site 3 README.
