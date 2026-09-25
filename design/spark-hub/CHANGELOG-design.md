# Handoff: Sparks (Torrez Fitness) — v3 design → live build

**Direction:** design → code. Starts from what's live (`HANDOFF-to-design.md`, 2026-09-24) and designs the parts the build invented.

**Files**
- `Walktober App v3.dc.html`: the full prototype. Open it in a browser with `support.js` next to it.
- `Privacy.dc.html`: the designed `/privacy.html`.
- `Sign-in Email.dc.html`: both emails (sign-in code and confirm email), with inbox rows.
- `Open Questions v3.dc.html`: answers to §5. Q7 (Spark Hub groups) has three options: 7a, 7b and 7c.
- `photos/torrez-trail.png`: the home hero image.

**Tweaks in the prototype:** Sample ideas · Data state (live / loading / offline / gone = dead idea link) · Start signed in · Google sign-in outcome (success / cancel) · Simulate failed saves.
**Demo tricks:** the code `000000` fails. Tapping "Send it again" twice shows the one-code-a-minute limit. A `.heic` file shows the unreadable-photo toast.

Where this README and the HTML disagree, this README is correct. Fidelity is high: colours, type, spacing and copy are final.

---

## 1. Matched to what's live (§1 of the build handoff)
1. **Sort menu:** Newest · Oldest · Most popular. Most popular puts ideas with the most "I'm interested" first.
2. **Card interest pill** uses the person icon. The "I'm interested" button still uses the bolt (see Q2: I recommend switching it too).
3. **Every idea has a lead.** Removed: the "Needs a lead" card label and hero pill, "I'll take the lead on this", the "You're out front on this one" pop-up, "Step back from the lead" and its paragraph. Checkpoint notes no longer have a "nobody's out front" wording, and "Basics" is never locked.
4. **No head count:** removed the success line, "· N short of N" and the "Enough to go" badge.
5. **Leads sign in.** If you're signed out, "Put it up" opens **Sign in to post**, then the name pop-up if needed, then posts the same draft. The Profile card and the name pop-up's "Been here before? Sign in" open **Sign in**.
6. **Location suggestions**, plus the address and **Directions** on the idea page (§2 below).
7. **Continue with Google** at the top of the sign-in pop-up (§2 below).
- The Edit screen now matches the post flow: three dream-version lines of 30 characters each, and no vibe field.

## 2. Designs for what the build invented

### a. Loading
- The idea count reads **Loading ideas…** on Home (hero card) and Browse.
- Browse shows **3 skeleton cards** in the shape of a real card: a title bar, two icon + text rows and the footer row. Skeleton colours are `#eceef1` and `#f2f3f6`, and the card pulses from 1 to .45 opacity over 1.4s. No spinner.

### b. Couldn't load
- A banner at the top of Home and Browse, 14px in from the sides. It keeps the build's colours (`#fdeef0`, 1.5px `#f5c2cb`, radius 14, text `#9b1c31`) and adds:
  - a 30px white circle with a no-signal icon
  - title **Couldn't load ideas** (14.5/800)
  - body 13.5/600: *Check your connection. We'll keep trying, and this goes away once you're back.* **Copy change:** the old copy said "then refresh", but the banner clears itself.
  - an underlined **Try now** link (13.5/800) that retries immediately
- The ideas list and "No ideas yet" are hidden while offline, and the count reads "Couldn't load ideas".

### c. Toast (failed saves, small errors)
- Dark pill 12px above the tab bar: `#0d1117`, radius 14, padding 13/16, shadow `0 12px 30px rgba(15,18,25,.3)`. It has an 18px `#e2556b` "!" dot, then white 14.5/700 text. It pops in over 240ms and stays 3.5s. It sits above pop-ups (z 40), so sign-in errors show while the pop-up is open.
- Copy is unchanged from the build.

### d. Busy labels
- **Putting it up…** (the button drops to .72 opacity and shows a wait cursor), **Sending…**, **Signing in…**, **Opening Google…**
- While one sign-in method is busy, the other button is disabled (.5 opacity for Google).

### e. Unknown idea link
- Home shows a white card under the header: a 34px grey circle with a broken-link icon, **That idea isn't up anymore** (16/800), then *Its lead may have taken it down, or the link got cut short.* (14/500 `#5c6270`), then **See what's up now →** (purple). It has a ✕ to dismiss.

### Location suggestions
- The list opens after 3 letters, 4px under the field. Specs from the build: white, 2px `#e6e7eb`, radius 18. Rows are 12/16 with `#f2f3f6` hairlines, a pin icon `#9aa0ac`, the name 15.5/800 and the address 13.5/500 `#6b7280`, each on one line with ellipsis. Hover `#f7f7f9`. **Added:** a soft shadow `0 12px 28px rgba(15,18,25,.08)`.
- **New states:**
  - First lookup: one pulsing row, *Looking near Austin…* Later lookups keep the previous results until new ones arrive.
  - No match: *No places match. What you typed works fine too.* It tells people that free text is fine. If the service is down, show nothing, as now.
- Credit line: 11.5px `#9aa0ac`, 8/16 padding.
- After a pick, the list closes and a filled purple pin with the address (14/600 `#5c6270`) shows under the field. Editing the text clears the pick.
- The **Look good?** review screen now shows the address under Location (13.5 `#6b7280`).
- Idea page: *Location: X.*, then on the next line the address (13.5 `#6b7280`) · **Directions** (purple 800).
- The sample places in the prototype are for illustration only. The live list comes from Geoapify.

### Sign-in pop-up
- **Step 1**, top to bottom:
  - Heading: **Sign in to post** (from Put it up) or **Sign in** (Profile, name pop-up).
  - Body (14.5/500 `#5c6270`): *Whoever posts an idea leads it, so leads sign in. Use Google, or we'll email you a 6-digit code. No password.* The Profile version starts *Anything you lead follows your email to any phone.* instead.
  - If Google was cancelled: an inline alert card in the Couldn't-load colours with a "!" dot: *Google sign-in didn't finish. Try again, or use your email.* This is an inline card, not a toast, so it stays next to the buttons.
  - The Google button: build spec, 54px min height, hover border `#b9bcc4`.
  - "or" divider, the same as the post flow.
  - Email field (`type=email`, `autocomplete=email`).
  - **Email me a code**, grey until the email is valid.
  - Fine print: *Only used to sign you in. Nobody else sees it.* followed by a purple **Privacy** link.
- **Step 2:**
  - **Enter the code**
  - *Sent to* followed by the email in ink 700, then · **Change**
  - A 26px/800 code field with 10px tracking (`one-time-code`)
  - **Sign in**
  - *Not there? Check spam, or* **Send it again**, which then reads "Sent again". A second tap shows the one-code-a-minute toast.
- **Profile, signed out:**
  - eyebrow **Sign in**, title **Only leads need to sign in.**
  - body: *Whoever posts an idea leads it, and what you lead follows your email to any phone. Browsing, "I'm interested" and RSVPs never need it.*
  - **Copy change:** the button reads **Sign in**, not "Sign in with email", because the pop-up leads with Google.
- **Profile, signed in:** *Signed in as you@…*, *Anything you lead follows your email to any phone.*, and Sign out.

### Sign-in emails (`Sign-in Email.dc.html`)
- Both emails share one layout:
  - `#f1f2f5` background, a white card with radius 20 and padding 32/30
  - a gold bolt and a purple **SPARK HUB** eyebrow
  - a 28/900 heading, *Hi there,* and a reason line
  - the code at 36/900 with 8px tracking, on a `#f3f1fe` panel
  - a no-password note, then a hairline and the ignore-it line
  - a grey footer (12.5px) saying what Spark Hub is and that we only email when you ask, plus a Privacy link
- **Preheader text:** *Your code is 482 915. Enter it in the app to finish signing in.* The confirm email ends *…to confirm this email and finish posting.* Mail apps show this as the preview, and having real text there helps keep it out of spam.
- Build the templates with tables and inline CSS. Figtree falls back to system fonts in most mail apps.

### Privacy page (`Privacy.dc.html`)
- Fluid, max width 680, on `#f1f2f5`.
- White top bar with the Spark Hub wordmark (gold bolt, 18/900) and **Back to the app**.
- Header: eyebrow, **Privacy** 44/900, updated date.
- **The short version:** an ink card (`#0d1117`) with 19/700 white text, and three promise tiles: We don't sell it · No ads · No tracking cookies. The ticks are `#7fdca3` and the eyebrow is `#f3c55a`, both lighter tints so they read on ink.
- **What we collect, and why:** each item has a **who-sees-it chip**: Your group (purple tint) · Only you (green tint) · That idea's lead (gold tint) · Nobody (grey).
- **Who helps us run it:** rows with a 110px service-name column.
- **Deleting your information:** an outline button **Ask us to delete my account** (a mailto link with the subject filled in).
- **Questions**, then the page ends.
- Copy is the live copy, lightly split into lines. No legal changes.

## 3. Housekeeping: removed from the design file
- The "A few quick ones" questions screen and all its logic and data (prompts, answer flows).
- The category filter menu and its logic.
- The "Holding an idea" pop-up and its link logic.
- Also removed: the claim-lead pop-up, the step-back confirm, the head-count logic, the "Add a little to this" button (it only led to the questions screen), and the empty-state "Show everything" button (it only applied to the filter).

## 4. Open questions (§5): see `Open Questions v3.dc.html`
1. **Notify leads:** a once-a-day email to the lead, only on days with news, plus a dot on the Profile tab. No SMS.
2. **Button icon:** yes, match it. Use the person icon on "I'm interested" and keep the bolt for the brand.
3. **Dates after a day is set:** not intended. Add a lead-only **Put the day to a vote**, which makes the current day option 1.
4. **After Walktober:** Sparks carries on. Dates run from today to 6 months out. Walktober becomes the group's **Featured** slot. Gold stays as the spark colour.
5. **Lead's line:** add *You're out front. Pull one person in to think it through. Somebody who's already interested is the easiest ask.*
6. **"Somebody out front":** drop it and count to 3.
7. **Spark Hub groups:** **7a chosen.** A small group switcher sits top right of the header, with no outline: the name at 11.5/800 uppercase purple, and a chevron. The tap target is 44px tall, and there's no chevron if you're in one group. Tapping it opens a small "Your groups" dropdown under the switcher (216–220px wide, radius 16, the same look as the sort menu): each row has the group name at 15/800 and no idea totals. A group with ideas you haven't seen shows a purple count badge (20px min, `#5b4ae8`, white 11.5/800) after its name, which clears once you open that group. The current group is tinted `#f3f1fe` (no tick). The dropdown ends with a hairline and a purple **+ Join a group** row. It opens a **Join a group** pop-up:
  - *Got a code from an organiser? Enter it here.*
  - A 6-character code field: 24/800, 8px tracking, uppercase letters and digits.
  - **Join**, grey until 6 characters are entered.
  - If the code doesn't match: *That code didn't match a group. Check it with your organiser.* (14/700 `#9b1c31`). In the mock, `000000` shows this.
  - Fine print: organisers find the code in the group's settings and can share it as a link too.
  - Joining adds the group and switches to it. The hero becomes a per-group **Featured** slot. **7b** (a hub bar with the group name as the title) and **7c** (a groups home screen) are shown as alternatives. 7c is the path once people commonly belong to 3+ groups.
8. **"Know a location?"** Yes, use the same suggestions, so accepted spots carry an address and Directions.
9. **Directions:** pick by device (Apple Maps on iOS, Google Maps elsewhere), with no chooser.

## 6. Group switcher (7a, locked in)
It's built into the headers of **Home, Browse and How this works**, the three screens that show group-wide content, and replaces the "‹ Torrez Fitness" back eyebrow there. The tab bar already handles going back. It's not on screens tied to one idea (Idea, Edit idea, Post your idea), where switching groups would pull you out of what you're doing. Those keep a plain group-name eyebrow. It's not on Profile either, which spans all your groups.
- **Switcher:** top right of the header, no outline, 44px tap target. The group name is 11.5/800 uppercase `#5b4ae8`, followed by a 12px chevron.
- **Dropdown:** min width 220, radius 16, 1px `#eceef2`, shadow `0 18px 44px rgba(15,18,25,.2)`, the same as the sort menu.
  - A "Your groups" label, then rows (44px min) with the group name at 15/800.
  - Unseen ideas show as a purple count badge after the name. It clears when you open that group.
  - The current group is tinted `#f3f1fe`, with its name in purple and a tick.
  - A hairline, then a **+ Join a group** row.
- **Join a group pop-up:**
  - *Got a code from an organiser? Enter it here.*
  - A 6-character code field (24/800, 8px tracking, uppercase letters and digits).
  - **Join**, disabled until 6 characters are entered.
  - An inline error when the code doesn't match. In the prototype, `000000` fails.
  - Fine print: organisers can find the code in the group's settings or share it as a link.
- In the prototype, switching groups changes only the name. The live app would load that group's ideas and its Featured slot.
- **Next steps (not designed):** hide the chevron for members of one group, and an organiser screen that shows the group's code.

## 7. Round-2 owner decisions (these override everything above)
- **Q1, lead emails:** skipped for now.
- **Q2, interest icon:** the "I'm interested" button and the lead's "N interested" card now use the person icon, the same as the card pill.
- **Q3, date voting:** removed everywhere. That means the "Dates on the table" card, ranks and bars, "Most support"/"Tied", "Lock this one in", "Remove", "Add a date option", the "Pick a day" prompt, the "none of these dates work" list and the **RSVP pop-up** (it only asked which dates work). An idea has one day or shows "Date TBD".
  - The lead sets the day by tapping "Date & time", and it applies straight away. Anyone else uses "Offer a date & time", which goes to the lead's "Waiting on you" card. "Offer a date & time" now shows for everyone until a day is set.
  - Day step notes: *No day yet. Set one when you're ready.* (lead) / *No date & time yet. Anybody can float one.*
  - **Flag:** with RSVPs gone, nothing in the app collects phone numbers any more. The privacy page's RSVP line should go when the build drops RSVPs.
- **Q4, Walktober:** it's just a category. How categories work is still open, so the home card and the October-only dates are unchanged for now.
- **Q5, lead line:** added for the lead only, above the offer chips in "How close this is" (14/500 `#5c6270`): *You're out front. Pull one person in to think it through. Somebody who's already interested is the easiest ask.*
- **Q6, count to 3:** "Somebody out front" is removed. The checkpoints are A place · A day · Basics established, shown as 3 segments. Lines read "N of 3 in place" and "All three in place. This one's happening." Profile reads "N of 3 in place".
- **Q8, location suggestions:** removed for now, which **supersedes the Location suggestions part of §2**. Location is a plain text field again. Removed: the suggestion list and its states, the picked address, the review-screen address, and the address + Directions line on the idea page. The Geoapify row is also removed from the privacy page.
- **Q9, Directions:** no longer applies, since it went with Q8.

## 8. Groups: start, run, join (new)
- **Profile, layout A (chosen; see `Profile Options.dc.html`).** It's signed-in only and is made of grouped lists. Each section has a 12/800 uppercase grey eyebrow over a white radius-18 card, with 52–60px rows, hairline dividers and grey chevrons.
  - **Header (account option A1, chosen):**
    - A 64px avatar: a photo, or a gold circle with the initial. It carries a 26px white camera badge at the bottom right.
    - Name at 26/900 and email at 14/600 grey.
    - An outline **Edit** pill (40px, 1.5px `#dcdfe6`). The avatar and Edit both open **Edit profile**.
  - **Edit profile pop-up:**
    - A 64px avatar preview with **Add a photo** (or **Change photo**) and **Remove**
    - A **Name** field.
    - An **Email** field. For email sign-ins it's editable, with the hint *Change it and we'll send a code to the new address.* For Google sign-ins it's read-only in `#f7f7f9` with *From your Google account.*
    - The button reads **Save**, or **Save and send code** if the email changed. That opens **Confirm your new email**: a code field, **Confirm**, and *Until you confirm, you keep signing in with {old email}.*
    - After saving, a green toast: "Profile saved" or "Email updated".
  - **Your ideas:** title 15.5/800, then "Group · N of 3 in place". "Happening" is in green `#0f7a3c`.
  - **Your groups:** groups you run come first, with a gold **★ Admin** badge. Tapping one you run opens its group page; tapping one you're in switches to it. Then **Join with a code** (purple 15.5/800, 54px row) and, below it, **+ Start a group** as a quieter secondary row (grey `#5c6270` 14.5/700, grey plus icon, 48px row).
  - **Bottom of Profile:** a standalone white **Sign out** row (52px, `#9b1c31` 15.5/800). Under it, a small grey centred **Privacy** link (13.5/700 `#6b7280`). There is no Account heading and no "Signed in with" row. Name editing lives in Edit profile, and the Google-only email note shows there.
  - **Build:** store `avatar_url` on the profile (for example in Supabase storage) and show it wherever the initial circle appears. Changing the email goes through Supabase `updateUser({ email })` with a code check.
- **Group page (groups you run):** the header has a back button, a gold "You run it" eyebrow and the group name.
  - An **Invite people** card with the code at 30/900 on `#f3f1fe`, the link under it, **Share invite link** (primary) and **Copy code** (secondary).
  - Rows for Members (the count) and Go to this group.
  - The invite code no longer shows on Profile itself.
- **Start a group pop-up:**
  - Needs sign-in. Signed out, it opens **Sign in to start a group**, with the body *Whoever starts a group runs it, so we ask you to sign in.* followed by the usual Google/email line.
  - Step 1: *A place for your people to post ideas and turn them into plans. You'll run it, and get a code to invite others.*, a group name field (max 40), and **Create group** ("Creating…" while busy).
  - Step 2: a gold bolt, **{Name} is ready**, *Share the code or link so people can join. Find it any time under Profile → Your groups.*, the code at 30/900 with 6px tracking on a `#f3f1fe` panel with the link under it, **Copy invite link** (primary) and **Go to {Name}** (secondary, which switches to the group and goes Home).
- **Codes** are 6 characters from A–Z and 2–9, leaving out I, O, 0 and 1 because they're easy to confuse. The link format is `torrezhub.vercel.app/join/CODE` for now; the domain is still to be decided.
- **Confirmation toast:** the same dark pill as errors, with a green `#149a4b` tick dot instead of the "!". Copy: "Code copied" / "Invite link copied".
- **Free for now.** No gate. When paid groups arrive, the gate belongs on **Create group**.
- **Not designed yet:** group settings (rename, new code, remove members, add co-admins), leaving a group, and what a brand-new empty group's Home looks like.

## 9. Sign-in for everyone (supersedes the lead-only sign-in copy above)
- Everyone is encouraged to sign in. It's no longer framed as a lead thing. Browsing is open to everyone, and guests can take part with a name and contact (see below).
- **Profile tab while signed out** opens the sign-in pop-up straight away, with no Profile screen in between. After signing in, you land on Profile.
- **Profile is signed-in only.** Your name, the signed-in card, Your groups and Ideas you lead only exist once you're signed in. The old "Only leads need to sign in" card is removed. Signing out returns you to Home.
- **Pop-up copy:**
  - Title: **Sign in**, or **Sign in to post** from Put it up.
  - Body: *Your ideas, groups and name are saved to your account.* (or *Sign in to put your idea up.* from Put it up), followed by *Use Google, or we'll email you a 6-digit code. No password.*
  - The separate "Sign in to start a group" pop-up is gone, because Start a group only shows once you're signed in.
- Signed-in card sub-line: *Your ideas and groups are saved to your account.*
- The privacy page still says "Only people who post ideas need to sign in". That's still true in how the app works. Reword it if sign-in becomes required for more.

### Guests can take part, and sign-in is encouraged
**Supersedes the "nothing saves unless signed in" rule.** Guest input is saved to the idea for the lead, with the guest's name and a way to reach them. No account is needed.
- **Needs an account:** Put it up (the poster leads), Start a group, Join a group and Profile.
- **Guests can:** tap I'm interested, Offer a location, Offer a date & time, and I can help with something (the offer chips, plus the "A location" and "Date & time" steps).
- **The first time a guest does one of those, a "Who's it from?" pop-up** appears, then the action carries on. It's asked once per visit.
  - Title **Your info**. Body: *So {Lead} can reach you. Only they see it.*
  - **Name** field, with placeholder *Jane Smith*.
  - **Phone number** field (`type=tel`, `autocomplete=tel`). It's valid with at least 10 digits and accepts only digits, spaces and ( ) + . -
  - **Continue**, grey until both fields are valid.
  - A `#f3f1fe` panel: **Have an account?** *Sign in to skip this.*, and a purple **Sign in** pill. That opens the sign-in pop-up with the body *Your name fills in, and everything you add is saved to your account.*, then carries on with the action.
- **Signed-in people** skip this pop-up. They only see the name pop-up if their account has no name.
- **Data:** save guest interest and offers with `guest_name` and `guest_contact` (or keep the anonymous ID with those fields). The lead sees the contact on offers and in the interested list. If the guest signs in later, their earlier activity from this device moves into the account, as the build does today.
- The privacy page's "if you RSVP" line becomes: *Your name and phone number, if you take part without signing in. Only the lead of that idea can see them.*

### Admin badge
- **Look:** a pill in `#fdf1d6` with a gold `#e8a71c` 11px star and **ADMIN** in `#8f6405` at 11/900, with .6px tracking. Padding is 3/9/3/7, or 2/7/2/5 in the dropdown.
- **Where it shows:** after the group name in Profile → Your groups (admin groups are listed first) and, in the group switcher dropdown, as a text-only **ADMIN** chip (same colours, no star, padding 2/7) before any new-ideas count. The dropdown has no tick; the current group is marked only by its tint and purple name. On the group page, the eyebrow reads **You're an admin**.
- **Who gets it:** a group's creator is its admin. Co-admins can come later.
- **Demo data:** with Sample ideas on, Eric is the admin of Torrez Fitness (invite code TORREZ, 48 members).

### Rename: "Sparks" → "Spark Hub"
- The big title on Home and Browse (46/900) now reads **Spark Hub**, which matches the platform name on sign-in, the emails and the privacy page. The gold bolt stays next to it.
- Leftover "N sparks" counts now read "N ideas".

### All ideas (Browse): full-bleed photo banner (option 1 in `All Ideas Options.dc.html`)
- **Header:** 236px tall and edge to edge. The group's photo fills it (`object-position: 50% 40%`), with a solid `#e8a71c` fallback. A five-stop dark scrim, `rgba(13,17,23,…)` at .85 (0%), .56 (30%), .52 (45%), .72 (62%) and .96 (100%), keeps both the top row and the title readable.
- **Top row, on the photo:**
  - The Spark Hub logo turns white with a `#f3c55a` bolt.
  - The group switcher turns white. Both have a soft text shadow and sit at top 10.5px, 44px tall.
  - The dropdown menus are unchanged.
- **Title:** bottom left, 40px up from the photo's edge. The group name in `#f3c55a`, 12.5/800 uppercase, then **All ideas** in white at 40/900.
- **I have an idea:** a full-width pill (inset 16px, 54px tall, 16.5/800) that overlaps the photo's bottom edge by 26px, with shadow `0 12px 28px rgba(91,74,232,.4)`.
- The view, sort and count row starts 36px below the photo to clear the button.

### Idea cards (option 7 from `Card Image Options.dc.html`, locked)
- **Card:** white, radius 20, with the standard shadow.
- **Photo, 112px:** the idea's photo with no scrim. Ideas without one use the group photo, blurred 1.5px under a 30% dark overlay.
- **White sheet:** overlaps the photo by 22px, with radius 20 on the top corners and 16/16/14 padding.
  - The title in dark `#0d1117` at 21/900, -.5px tracking.
  - 6px below it, the date row: a 14px gold calendar icon, the day in 800 ink, then *· time*.
  - The place row: pin icon, then the place. Missing values read *Date TBD* / *Location TBD* in grey.
  - A hairline, then the footer: the lead's face (or initial) and *Led by* (500 `#6b7280`) **{name}** (700 `#454b55`) on the left, the interest pill (person icon + count) on the right. No posted-time.
- Grid and List views are unchanged.

### Cards / List toggle
- It replaces "N ideas so far" at the left of the sort row: a segmented control on a `#e6e7eb` track, 3px inset. The selected segment is white with a shadow. Each segment is 34px tall, 13.5/800, with an icon: **Cards** or **List**. Cards is the default.
- **List view:** one white radius-18 card holding compact rows (68px min, 10/14 padding, hairline dividers).
  - A 48px rounded-12 thumbnail: the photo, or the same dark gradient block.
  - The title at 16/800 on one line.
  - Meta at 13.5/600 grey: *Sat, Oct 12 · 7am · Mueller Lake Park*, with TBDs when missing.
  - The interest pill with the count only.
  - Rows follow the current sort.

### View menu (replaces "N ideas so far")
- A minimal dropdown on the left of the count row, matching the sort control: the current view's 15px icon, its name (14/700 `#6b7280`) and a 12px chevron, with a 40px tap height. The menu has the same look as the sort menu: a "View" label, then rows with an icon and name. The current view is tinted `#f3f1fe`, shown in purple and ticked.
- **Cards** (default): the option 6 card.
- **Grid:** two cards per row, gap 10px, radius 16.
  - A 112px top block (photo with a dark fade, or the dark gradient) with the title in white, 16/900, up to 3 lines.
  - Below it, date and place rows at 12.5px with 13px icons, both ellipsised.
  - A footer with a 22px lead avatar, the name, and a person icon with the count.
- **List:** every idea as a row inside one white card, with hairline dividers:
  - Rows are at least 68px tall, with a `#f7f7f9` hover.
  - A 48px thumbnail.
  - A one-line title, 16/800.
  - A grey line with date, time and place.
  - The interest count on the right.
- The choice lasts for the session. The build can store it in localStorage.

### Sort control
- The default is now **Most popular**. Menu order: Most popular, Newest, Oldest.
- The control is quieter: plain text (current sort at 14/700 `#6b7280`, plus a 12px grey chevron) with no outline or icon. It keeps a 44px tap height, right-aligned on the count row. The menu is unchanged.

### Demo profile photos
- With Sample ideas on, Eric, Darnell, Hana, Marisol and Dee use real demo photos from `photos/faces/`. Theo has no photo, to show the fallback initial. Eric's photo also fills the Profile header and Edit profile.
- When someone has a photo, it replaces the initial circle on idea cards and in Profile. People without one keep the coloured initial.

### Idea page (E1 with E2's title sheet; see `Idea Page Options.dc.html`)
- **Photo, 210px, full-bleed:** the idea's photo, or the blurred group photo when it has none. A soft dark scrim sits at the top and bottom.
  - Top row: a translucent round back button, the group name in white 11.5/800 uppercase in the middle, and a translucent **Edit** pill for the lead. The "It's up" style tag pops in at the bottom right.
- **White title sheet:** overlaps the photo by 28px, with radius 26 on the top corners.
  - Progress eyebrow in gold `#8f6405` ("1 of 3 in place" or "Happening").
  - The title at 30/900.
  - "Led by {name} · {when}" with a 26px face.
  - Then **I'm interested** (primary). To its right is a non-button count: an 18px two-person icon and the number at 19/900 ink, with a small *interested* (11.5/700 grey) under it. There's no pill background, so it doesn't read as tappable. or, for the lead, a lavender "N interested" strip.
- **Below, on `#f1f2f5`:**
  - The **Waiting on you** card for the lead.
  - A **date and place card:** two 60px rows, each with a 38px gold icon tile (grey when missing), the value at 15.5/800 and a note.
    - The note reads "Set by {lead}" or "You set this".
    - When a value is missing, the row reads "Date TBD" / "Location TBD" and the note becomes a purple action ("Offer a date & time" / "Offer a location", or "Set a date & time" / "Set a location" for the lead). Tapping it opens the offer flow for non-leads.
  - Hoping for, now as gold chips.
  - The dream version, How close this is (unchanged), and **Who's pitching in** (renamed from "Who's already in").
- The old purple hero, the "Idea" header bar and the separate facts list are removed.

### The basics (replaces "How close this is")
- **What it is:** up to **three very short lines** (30 characters each) from the lead about the core of the event. These are the lines people add when posting. The post flow and Edit now call the question **The basics**, with the hint *Up to three short lines about the core of it. Skip any you like.*
- **Card on the idea page:** it sits right after the date and location card.
  - A "The basics" eyebrow, with an **Edit** link for the lead once there are lines.
  - Each line has an 8px gold dot and 16.5/700 ink text.
  - **Lead with no lines:** *What's the core of it? Up to three short lines.*, then an outline **+ Add the basics** pill that opens Edit.
  - **Member with no lines:** *{Lead} hasn't added the basics yet.* in grey.
- **Removed:**
  - The "How close this is" card: segments, checkpoints, the lead nudge line and the "Basics established" tick.
  - The "Everything's in place" card.
  - The "Hoping for" section, now merged into The basics.
  - The "N of 3 in place" / "Happening" eyebrow on the idea page.
  - Profile's "N of 3 in place" status, which now shows the group and date.
- **Offer chips** (Offer a location / Offer a date & time / I can help with something) now sit on their own under The dream version, above Who's pitching in.

### Suggest actions on the date & location card
- Each row has a purple 13.5/800 action on its right edge. The action shows only while the value is missing: **Suggest** for non-leads (tapping the row opens the offer flow), **Set** for the lead. Once a date & time or location is set, its row shows just the value, with no action.
- **Date row:** the date is the main line (e.g. **Sun, Oct 20**, 15.5/800), with the time underneath (*9am*, 13/500 `#8a909b`).
- **Location row:** the location name is the main line, with the street address underneath in the same smaller, lighter style. Long addresses are ellipsised.
- The build should store the picked address with the location. The demo uses a small lookup of addresses.
- Missing values read *Date TBD* / *Location TBD*.
- All the offer chips at the bottom of the idea page are removed, including **I can help with something**. Suggestions now come only from the date & location rows.
- The offer pop-ups themselves still use "Offer a…" titles, and "offered a location" in activity lines. Rename those to "Suggest" too if you want them to match.

### The vibe (mood board)
- **Where:** a small gallery at the very bottom of the idea page, below Who's pitching in.
- **Layout:** a white card with a "The vibe" eyebrow and a 3-column grid of square tiles (radius 12, gap 8). **Max 3 photos.**
- **Lead only:**
  - Can add and remove. A dashed **+ Add photo** tile shows while there's room, and each photo gets a small dark ✕.
  - A "N / 3" counter sits by the eyebrow.
  - When empty, the lead sees *Add up to three photos that set the mood: the place, past years, the feel you're going for.*
- **Members:** see the card only when there are photos. It's view-only.
- HEIC files show the same "couldn't be read" toast.
- **Data:** `mood: string[]` on the idea, separate from the cover `photos`.
- **Demo:** every sample idea has 1 to 3 mood photos. Sunrise loop, which Eric leads, has 2, so you can try adding and removing.

### Interest on the idea page (I3 with faces; see `Interest Options.dc.html`)
- **Lead row:** the lead's face and **Led by {name}** on the left (ellipsised). On the right, **11** *interested* (14/600, number in 800 ink), followed by a stack of up to 3 interested faces (26px, 2px white ring, -9px overlap) and a grey **+N** bubble for the rest. The posted time is removed from this row.
- If you've tapped I'm interested, your own face leads the stack. People without a photo get a coloured initial. The stack is hidden when no one is interested yet.
- **I'm interested** is a full-width primary button under the lead row. The standalone count and the lead's lavender "N interested" strip are removed; the lead sees the same row.

### Home (H3 signed out, H1 signed in; see `Home Options.dc.html`)
**Signed out: Welcome (H3).** Dark `#0d1117` page.
- **Photo:** 430px, the group's photo, fading to solid ink at the bottom.
- **Top row:** the Spark Hub logo in white with a `#f3c55a` bolt, and a white **Sign in** link.
- **Headline:** **Small ideas. Done together.** (42/900), then *Post a rough idea to your group. Others add a date, a place or a hand, and it turns into a plan.*
- **White "Got a code from your group?" card:**
  - A 6-character code field and a **Join** button, grey until the code is complete. Join signs you in, then confirms in the Join pop-up.
  - An **OR** divider, then an outline **Start your own group**, which signs you in first.
- **Three steps:** translucent tiles with gold numbers: Post an idea · People pitch in · It happens.

**Signed in: Home (H1).** White header.
- **Top row:** the Spark Hub logo on the left (tapping it returns Home) and the group switcher on the right.
- **Headline:** **Got an idea? *Spark it.*** (40/900, second line in purple), then *A spark is a rough idea for something to do together. Post it, and your group helps turn it into a plan.*
- **Three coloured step tiles**, then a full-width **I have an idea**, which posts to the current group.
- **Your groups:** a **Join with a code** link sits beside the eyebrow.
  - The first tile is 108px, with photo and left-to-right scrim, the group name and idea count. It goes to groups you run first (with an ADMIN chip), otherwise the current group.
  - Other groups sit in a 2-column grid of 92px photo tiles, with new-idea badges.
  - Tapping a tile switches to that group and opens its All ideas.
- **Coming up:** up to 3 dated ideas in date order, each with a mini calendar tile, the title, and "Group · time". Tapping one opens the idea page.

Tapping a group row in Profile now also opens that group's All ideas instead of Home. The old Home screen (Walktober hero, "What should we get up to?", two-step list) is replaced. The How this works page still exists, but Home no longer links to it.

### Welcome, locked (supersedes the H3 Welcome above)
- Headline **Turn your idea / into a plan.**, the photo visible at the top, the 1-2-3 steps one per line, and **Continue with Google** / **Continue with email** at the bottom. No code card, no Start your own group. README §1 has the specs.

### Clean-up pass
- "Spot" wording is gone from the lead's flow: **Use this location**, the "Location set" tag, and **Offer this location** on the offer pop-up.
- The Lead note on the last post-flow screen is parked (copy kept in README → Open).
- Start a group is out of the build instructions.

## 5. Design tokens
Unchanged from v2. There are no new tokens. The new designs reuse existing values:
- **Banner and alert:** `#fdeef0`, `#f5c2cb` and `#9b1c31`, from the build's banner.
- **Toast dots:** `#e2556b` (error) and `#149a4b` (confirmation), both existing confetti colours.
- **Privacy page:** on the ink card only, `#7fdca3` and `#f3c55a` are lighter tints of success and spark gold so they have enough contrast.
