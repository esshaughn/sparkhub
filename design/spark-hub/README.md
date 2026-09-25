# Handoff: Spark Hub, a multi-group app (Torrez Fitness is one group)

## Overview
Spark Hub is a mobile-first web app where a **group** (e.g. Torrez Fitness) posts rough ideas for things to do together (**sparks**) and turns them into plans. One account can belong to many groups. Whoever posts an idea **leads** it. Everyone else can show interest and suggest a date & time or a location. Guests can take part with a name and phone number. Signing in is encouraged, but it's only required to post, join or start a group, and use Profile.

The live build is `esshaughn/torrezhub` (vanilla `index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, Supabase backend, Vercel hosting, Resend email). This brief describes the **target state** of the app. It supersedes `HANDOFF-to-design.md` wherever they differ. `CHANGELOG-design.md` has the full history of how each decision was reached.

## About the design files
The `.dc.html` files are **design references built in HTML**. They're prototypes showing the intended look, copy and behaviour, not production code to paste in. Recreate them in the existing codebase using its patterns (vanilla JS + CSS today). If you move to a framework, pick what fits the repo. Open a file directly in a browser, with `support.js` beside it.

`Spark Hub App.dc.html` is the full clickable prototype. Its **Tweaks** panel has:
- **Sample ideas** (demo data, where "you" are Eric, admin of Torrez Fitness)
- **Data state:** live / loading / offline / gone (dead idea link)
- **Start signed in**
- **Google outcome:** success / cancel
- **Eric's role in Torrez Fitness:** owner / admin (shows the rename lock)
- **Simulate failed saves**

Demo tricks: the codes `000000` fail (sign-in and join). Tapping "Send it again" twice shows the rate-limit toast. A `.heic` photo shows the unreadable-photo toast.

## Fidelity
**High fidelity.** Colours, type, spacing, radii, shadows and copy are final. Match them.

---

## Global
- **Font:** Figtree (Google Fonts) at 400–900, falling back to `system-ui`. Numbers below are written size/weight, e.g. 15.5/800. The frame is 393×852 (iPhone); the layout is fluid.
- **Page background** `#f1f2f5`. Cards are white, radius 18–20, with shadow `0 1px 3px rgba(15,18,25,.08)`.
- **Eyebrows:** 12/800, 1.2px tracking, uppercase, `#6b7280`.
- **Primary button:** `#5b4ae8` (hover `#4a3ad4`), white 16.5/800, pill, min height 52–54, shadow `0 10px 24px rgba(91,74,232,.32)`. Disabled is `#b9bcc4`.
- **Secondary button:** white, 1.5px `#dcdfe6`, ink 800, pill. On hover the border and text turn `#5b4ae8`.
- **Menus** (sort, view, groups): white, 1px `#eceef2`, radius 16, padding 6, shadow `0 18px 44px rgba(15,18,25,.2)`.
  - A grey 11.5/800 uppercase label, then 44px rows.
  - The selected row has a `#f3f1fe` background and a purple 800 label.
  - Pop in over 280ms with `cubic-bezier(.22,.9,.28,1)`, from translateY(10) at scale .96. Tapping outside closes them.
- **Pop-ups (modals):**
  - A `rgba(15,18,25,.45)` scrim behind a white card, max width 340, radius 22, padding 22/20, shadow `0 24px 60px rgba(15,18,25,.3)`.
  - A 32px grey ✕ at the top right.
  - Title 22/900 with -.5 tracking. Body 14.5/500 `#5c6270`.
- **Inputs:** 2px `#e6e7eb`, radius 14, padding 13/16, 16/600. Focus border `#5b4ae8`.
- **Toast:**
  - A dark `#0d1117` pill 12px above the tab bar, radius 14, padding 13/16, white 14.5/700. It sits above pop-ups and stays 3.5s.
  - Errors lead with an 18px `#e2556b` "!" dot. Confirmations lead with a `#149a4b` ✓ dot.
- **Tab bar:**
  - 73px tall, `rgba(255,255,255,.94)` with blur, a 5-column grid.
  - Tabs: **Home**, **How this works**, a 44px purple round **+** (post an idea), **All ideas**, **Profile**.
  - Active tab `#5b4ae8`, inactive grey.
- **Logo:** a gold bolt (`#e8a71c`, or `#f3c55a` on dark) with "Spark Hub" at 18/900, -.5 tracking. It sits top left of every group-level screen, and tapping it goes Home.
- **Group switcher:** top right on group screens (All ideas, How this works), not on Home. 44px tap target. The group name is 11.5/800, 1px tracking, uppercase, purple (white on photos), followed by a 12px chevron. It opens the groups menu (see Groups).

---

## Screens

### 1. Welcome (Home, signed out)
- **Page:** dark `#0d1117`.
- **Photo block:** 580px, overflow hidden. The photo `photos/welcome-picnic.png` (the neighbourhood picnic) is 500px tall at `top:-70px`, and the scrim covers the top 430px, so the photo ends in solid ink and the text sits lower, over the dark area.
  - Lighter scrim so the photo shows: `linear-gradient(to bottom, rgba(13,17,23,.4) 0%, .18 at 25%, .62 at 48%, .92 at 70%, #0d1117)`.
- **Top row:** the Spark Hub logo in white (`#f3c55a` bolt), on its own.
- **Text block:** bottom of the photo, 16px up, with a soft text shadow `0 1px 12px rgba(13,17,23,.5)`.
  - **Turn your idea / into a plan.** (42/900, -1.4 tracking, line-height .98; line 2 in `#9d93f7`).
  - **Steps, one per line** (margin-top 18, gap 12): a 28px numbered circle (1 `#e8a71c`, 2 `#5b4ae8`, 3 `#0f7a3c`; white 13/900) with the label in white 16.5/800: Post an idea · People pitch in · It happens. Home keeps the compact one-row version.
- **Sign-in buttons:** stacked with gap 10, each 54px, pill, 16/800.
  - **Continue with Google:** white fill, ink text, 20px Google "G" (hover `#f2f3f6`). It opens the sign-in pop-up straight into *Opening Google…*.
  - **Continue with email:** transparent, 1.5px `rgba(255,255,255,.3)` border (white on hover), white text, envelope icon. It opens the sign-in pop-up with the email field focused.
  - Under them: *New here? Either one creates your account.* (13.5/600 `#8a909b`, centred).
- **No code entry here.** Codes are entered after sign-in (group switcher → + Join a group, or Profile → Join with a code). An invite link `/join/CODE` opens sign-in, then joins that group. The screens for that link aren't designed yet (see Open).

### 2. Home (signed in)
- **White header:** the logo on the left. **No group switcher on Home**: Home spans all your groups, so switching happens through the Your groups tiles and **View all**.
- **Headline:** **Turn your idea / into a plan.** (40/900, -1.3 tracking; line 2 in `#5b4ae8`). No subhead.
- **Steps row:** one row, left-aligned with gap 8, no background, padding 4/0, 12.5/800 ink, no wrapping. Each step has an 18px numbered dot (1 `#e8a71c`, 2 `#5b4ae8`, 3 `#0f7a3c`), with 11px `#6b7280` chevrons (stroke 3.4) between: Post an idea › People pitch in › It happens.
- **I have an idea:** a full-width primary button that posts to the current group.
- **Your groups:** the eyebrow, with a purple **View all** link to its right, which opens the **Your groups sheet** (below).
  - ⚠ **New layout, replaces the live build's group tiles.** A single row of **square** photo tiles, 150×150, radius 18, gap 10, that runs off the right edge and swipes sideways (scroll-snap to each tile's start, 14px side padding, no scrollbar). Every tile is the same square, including the first. Don't keep the live build's layout here.
  - Each tile: the group photo with a bottom-up dark scrim, the name bottom left (white 15.5/900), an ADMIN chip top left on groups you run, and a **pin** button top right. No idea count.
  - **Order:** pinned groups first, then everything else by most recently visited (opening a group from a tile, the sheet or the switcher moves it to the front). Store `pinned` and `last_visited_at` per membership.
  - **Pin button:** a 30px circle in a 40px tap area. Unpinned: `rgba(13,17,23,.45)` with a white outline pin. Pinned: white with a filled purple pin. Tapping it doesn't open the group; it toggles the pin with a toast ("Pinned to the front" / "Unpinned"). Any number of groups can be pinned.
  - Tapping a tile switches the group and opens **All ideas**.
- **Coming up:** up to 3 dated ideas in date order, in one white card with hairline rows (66px).
  - Each row has a 46px mini calendar (gold `#e8a71c` month strip at 10/900, day at 18/900), the title at 15.5/800, "Group · time" at 13/600 grey, and a chevron.
  - Tapping a row opens the idea page. Hide the section when there's nothing dated.

- **Your groups sheet:** a bottom sheet over the `rgba(15,18,25,.45)` scrim, white, radius 24 on the top corners, max height 78%, with a grab handle, **Your groups** (22/900) and a ✕. Tapping the scrim closes it. It slides up from the bottom (translateY 100% → 0, 380ms, `cubic-bezier(.32,.72,0,1)`) while the scrim fades in over 240ms. No scale.
  - Rows (64px, hover `#f7f7f9`): a 48px radius-12 group photo, the name at 16/800 with an ADMIN chip on groups you run, then a grey 13/600 *Pinned* line on pinned groups only (no idea count), and a chevron. Same order as the tiles.
  - Tapping a row switches to that group and opens its All ideas.
  - A hairline, then **Join a group** (purple tile with +), which opens the Join pop-up.

### 3. All ideas (per group)
- **Header:** 236px, full-bleed group photo (`object-position: 50% 40%`, fallback `#e8a71c`).
  - Scrim: `linear-gradient(to bottom, rgba(13,17,23,.85) 0%, .56 30%, .52 45%, .72 62%, .96 100%)`.
  - The logo (white, `#f3c55a` bolt) sits top left and the switcher (white) top right, at top 10.5px with a soft text shadow.
  - **Title:** bottom left, 40px up from the edge. The group name at 12.5/800 uppercase `#f3c55a`, then **All ideas** at 40/900 white.
  - **Edit** (admins and owners of this group only): a quiet text link on the right of the title block, level with **All ideas**: no fill or border, a 12px pencil + **Edit** at 13/700 in `rgba(255,255,255,.72)` (white on hover), in a 44px tap area. It opens that group's **Group page** (§8); back returns to All ideas.
  - **I have an idea:** a full-width primary button, inset 16px, 54px tall, overlapping the photo's bottom edge by 26px, with shadow `0 12px 28px rgba(91,74,232,.4)`.
- **Controls row:** 36px below the photo, 40px tall. Both controls are plain grey text (14/700 `#6b7280`) with a 12px chevron: no outline, no count.
  - **View** on the right, with the current view's 15px icon. Choices: Cards (default), Grid, List. Remember the choice in localStorage.
  - **Sort** on the left. Choices: **Most popular** (default; most "I'm interested" first), Newest, Oldest.
- **List:** a column with gap 14, padding 4/14/22.
- **Card (Cards view):**
  - White, radius 20.
  - **Photo:** 112px, the idea's photo with no scrim. With no photo, the group photo, sharp (never blurred), under `rgba(13,17,23,.3)`.
  - **White sheet:** overlaps the photo by 22px, radius 20 on the top corners, padding 16/16/14, gap 8.
    - Title 21/900 ink, -.5 tracking.
    - Date row, 6px under the title: a 14px gold `#8f6405` calendar icon, the day in 800 ink, then "· time".
    - Location row: pin icon, then the name. Missing values read *Date TBD* / *Location TBD*, with grey icon and text (`#b3b8c2` / `#9aa0ac`).
    - A hairline, then the footer: the lead's 26px face (or a coloured initial), *Led by* (500 `#6b7280`) and **name** (700 `#454b55`), with the interest pill (person icon + count, `#f2f3f6`, 13/800 `#5c6270`) on the right.
- **Grid view:** 2 columns, gap 10, radius 16.
  - A 112px top block (the photo with a dark fade, or the group-photo fallback) with the white title at 16/900, up to 3 lines.
  - Date and location rows at 12.5px with 13px icons.
  - A footer with a 22px face, the name and the count.
- **List view:** one white card with hairline rows (min 68px, padding 10/14, hover `#f7f7f9`).
  - A 48px radius-12 thumbnail.
  - The title at 16/800, ellipsised.
  - Meta: "Sat, Oct 12 · 7am · Mueller Lake Park".
  - The count on the right.
- **Empty:** a white card, **No ideas yet.** / *Be the first to put one up — rough is fine.*

### 4. Idea page
- **Photo:** 210px, full-bleed, with a scrim `rgba(13,17,23,.68 / .18 at 40% / .18 at 70% / .45)`.
  - Top row: a 40px round translucent (`rgba(255,255,255,.2)`) back button, the group name centred (white 11.5/800 uppercase), and an **Edit** pill for the lead.
  - A rotated white tag pops in at the bottom right after actions ("It's up", "You're interested").
- **White title sheet:** overlaps the photo by 28px, radius 26 on the top corners, padding 22/20/20.
  - Title 30/900.
  - **Lead row:** a 26px face and "Led by {name}" (ellipsised) on the left. On the right, **11** *interested* (14/600, number in 800 ink), followed by a stack of up to 3 interested faces (26px, 2px white ring, -9px overlap) and a grey **+N** bubble for the rest. Your own face leads the stack once you're interested. The stack is hidden at 0.
  - **I'm interested:** a full-width primary button with a person icon. It toggles to **You're interested**. The lead doesn't get the button.
- **Below, on `#f1f2f5`, padding 12/14, gap 12:**
  1. **Waiting on you** (lead only, when suggestions are pending): a gold 2px ring card with *Nothing changes until you say so.* Each suggestion shows who, what and "Replaces X", with **Use this location** / **Use this day** (primary) and **Not this time** (secondary). Accepting pops a "Location set" / "Day set" tag on the photo.
  2. **Date & location card:** two 60px rows, each with a 38px tile (`#fdf1d6` with a gold icon when set, `#f2f3f6` with a grey icon when missing).
     - **Date row:** the date (**Sun, Oct 20**, 15.5/800), with the time under it (13/500 `#8a909b`).
     - **Location row:** the location name, with the street address under it in the same style, ellipsised.
     - A missing value reads *Date TBD* / *Location TBD*, with a right-aligned purple 13.5/800 **Suggest** (non-leads; the row opens the suggest flow) or **Set** (lead). Once set, the row shows only the value.
  3. **The basics:** the eyebrow, plus **Edit** (lead). Up to 3 lines, each with an 8px gold dot and 16.5/700 ink.
     - Lead with none: *What's the core of it? Up to three short lines.* and a secondary **+ Add the basics**.
     - Member with none: *{Lead} hasn't added the basics yet.* in grey.
  4. **The dream version** (vision text), if present.
  5. **Who's pitching in:** offers as "**Dee** offered a location: …".
  6. **The vibe** (mood board), a white card:
     - A 3-column grid of square radius-12 tiles, **max 3**.
     - The lead gets a dashed **+ Add photo** tile, a ✕ on each photo, and a "N / 3" counter. Empty, the lead sees *Add up to three photos that set the mood: the place, past years, the feel you're going for.*
     - Members see the card only if there are photos.
- **Not on this page any more:** progress / "N of 3 in place", checkpoints, "How close this is", offer chips at the bottom, date voting and RSVPs.

### 5. Post an idea (the + tab / I have an idea)
A multi-step flow: activity → location (plain text; "Location TBD" allowed) → date & time → review (**Look good?**).
- **Post to** (on the *What's the event?* step, under the text field): a "Post to" eyebrow over a 54px white field (2px `#e6e7eb`, radius 14) showing the group name at 16/800 and a chevron. It opens a menu in the standard menu style listing your groups (ADMIN chip on ones you run; the selected one tinted `#f3f1fe`, name in purple). **Default:** the group last picked in the top-right switcher. Picking a group here also updates the header eyebrow, and the idea posts there.
- Up to 3 cover photos, but cards show the first one only.
- **The basics** step: *Up to three short lines about the core of it. Skip any you like.*, with 3 × 30-character inputs.
- **Look good?** ends with **Put it up**, with nothing between the review and the button.
- **Put it up** requires sign-in. It opens **Sign in to post**, then the name pop-up if the account has no name, then posts. It shows *Putting it up…* while busy.

### 6. Edit idea (lead)
- Title, The basics (3 × 30), and the other fields matching the post flow.
- Footer copy: *The location, date and offers stay as they are.*

### 7. Profile (signed in only)
Tapping the Profile tab while signed out opens sign-in directly, then lands on Profile.
- **Header:**
  - A 64px avatar (photo, or a gold circle with the initial) with a 26px white camera badge.
  - Name at 26/900 and email at 14/600 grey.
  - A secondary **Edit** pill. The avatar and Edit both open **Edit profile**.
- **Edit profile pop-up:**
  - Photo: Add a photo / Change photo / Remove.
  - Name.
  - Email: editable for email sign-ins (*Change it and we'll send a code to the new address.*), read-only for Google (*From your Google account.*).
  - **Save**, or **Save and send code**, which leads to *Confirm your new email* with a code field and *Until you confirm, you keep signing in with {old}.*
  - Toasts: "Profile saved" / "Email updated".
- **Sections:** grouped white lists, each with an eyebrow.
  - **Your ideas:** title at 15.5/800, then "Group · date".
  - **Your groups:** groups you run first, with a **★ ADMIN** chip. Tapping one you run opens its Group page; tapping one you're in opens its All ideas. Then **Join with a code** (purple 15.5/800).
  - **Sign out:** a standalone white row with `#9b1c31` 15.5/800 text. It returns you to the Welcome screen.
  - **Privacy:** a small centred grey link.

### 8. Edit group (owners and admins; 1c + 2a/2b in `Group Settings Options.dc.html`)
Reached from Profile → Your groups, or the **Edit** link on All ideas. A standard edit screen with labelled fields; every change saves on its own (no page-level Save).
- **Top bar:** white, hairline below. **‹ Back** (purple 16/600, returns to wherever you came from), **Edit group** centred (17/800).
- **Cover:** 196px full-bleed group photo (Photo positioner rule). A white **Change cover** button bottom right (radius 10, 36px, camera icon, 14/800, soft shadow), or **Add a cover** with no photo. Both open the Photo positioner.
- **Content** (padding 20, gap 20). Field labels are 14/700 `#2b303a`; read-only "wells" are `#f7f7f9`, radius 12, 50px.
  1. **Group name (2a row + 2b inline edit):** a well with the name at 16/700.
     - **Owner:** a grey chevron on the right; the whole row is tappable (2a look). Tapping turns the well into a field in place (2px `#5b4ae8` border) with **Cancel** (grey) and a small purple **Save** (grey until changed; Enter saves, Esc cancels). Toast "Group renamed". Note under it: *Everyone in the group sees it.*
     - **Admin:** a lock icon instead of Edit, and *Only the group's owner can change the name.*
  2. **Members (prominent):** a `#f3f1fe` radius-16 card: a stack of 4 faces (34px, 2px ring, -10px overlap) and a purple **+N** bubble, **48 members** (17/900) over *You're the owner* / *You're an admin* (13/600 `#5c6270`), and **See all** (purple 15/800). The whole card opens the **Members sheet**.
  3. **Invite code:** a well with the code (18/900, 4px tracking) and a **Copy** outline button (1.5px `#dcdfe6`, radius 12). Toast "Code copied".
  4. **Invite link:** a well with the link (14.5/600 `#5c6270`, ellipsised) and a **Copy** outline button. Toast "Invite link copied".
  5. **Delete group** (owner only), after a hairline: a full-width outline pill (1.5px `#f5c2cb`, `#9b1c31` 15.5/800, trash icon, hover `#fdeef0`), with *Only the owner can delete the group.* under it.
- **Delete {Name}?** pop-up: *This removes the group and every idea in it, for all 48 members. It can't be undone.*, *Type* **DELETE** *to confirm* and a field (uppercased, focus border `#9b1c31`). **Delete group** (`#9b1c31`) stays grey until the field reads exactly DELETE; **Keep it** cancels. On delete: drop the group, go Home, toast "{Name} was deleted". Cascades its ideas and memberships (owner-only in RLS). You can't delete your last group.
- **Members sheet:** the same bottom sheet as Your groups (slide up, scrim fade, grab handle, ✕), 84% tall. **Members** (22/900) with the count in grey, a 44px search field (`#f2f3f6`, radius 12; empty: *No one by that name.*), then rows (58px, hairlines): a 40px face or coloured initial, the name at 16/700, *(you)* in grey, and an **OWNER** / **ADMIN** chip. You're listed first.
  - **Setting admins:** owners and admins see an outline **Make admin** pill (34px, 1.5px `#dcdfe6`, 13.5/800, hover purple) on every plain member's row. Tapping it makes them an admin straight away (ADMIN chip appears), toast "{First name} is now an admin".
  - **Removing admins:** owner only. Admin rows (not the owner's, not yours) get a grey **Remove** text button next to the chip; toast "{First name} is no longer an admin".
  - The owner's row never has actions.

### Photo positioner (group headers and idea covers)
One shared full-screen editor so what you set is exactly what shows.
- **Opens from:** Group page → Header photo (owners and admins); the idea page's **Photo** / **Add a photo** pill at the bottom left of the photo (lead only); and the post flow's **Position the cover** row on the photo step (a 84×50 thumbnail, *The first photo tops the idea page.*). Picking a new file goes straight into the positioner.
- **Screen:** `#0d1117`. Top bar: **Cancel** (`#dfe2e8` 15/700), the title (**Header photo** / **Cover photo**, white 16/800) and a purple **Save** pill.
- **Preview at true size:** full width, 236px (group) or 210px (idea), with only the real scrim on top (no logo, text or buttons), so the photo itself is what you're framing.
- **Drag** the photo to reposition (pointer events, touch-action none). Rule-of-thirds lines show while dragging. Under it: *Drag the photo. This is exactly how it'll show.*, a **zoom** slider (1×–2.5×), and an outline **Choose a different photo**.
- **Save** stores the photo and a focal point; toast "Photo saved". HEIC gets the usual unreadable-photo toast.
- **Rendering rule (use everywhere the photo appears):** `object-fit: cover; object-position: X% Y%; transform: scale(Z); transform-origin: X% Y%`. (or the equivalent `background-size: cover; background-position: X% Y%` plus the same transform, as the prototype does). That's identical to the positioner's framing at the same aspect ratio. Cards, tiles and thumbnails at other shapes use the same X/Y as `background-position` / `object-position` (zoom optional).
- **Defaults:** group photos 50% / 40% / 1; idea photos 50% / 50% / 1.

### 9. How this works
Unchanged content page, reachable from the tab bar. White header with the Spark Hub logo top left (ink, gold bolt; taps to Home) and the group switcher top right.

### 10. Privacy page (`Privacy.dc.html`) and sign-in emails (`Sign-in Email.dc.html`)
Build these as shown.
- **Emails:** use tables and inline CSS. The preheader reads *Your code is 482 915…*.
- **Privacy copy to update:**
  - Remove the Geoapify row.
  - Replace the RSVP line with *Your name and phone number, if you take part without signing in. Only the lead of that idea can see them.*

---

## Groups
- **Switcher menu:** a "Your groups" label, then one row per group.
  - Each row has the name at 15/800. A text **ADMIN** chip (`#fdf1d6` / `#8f6405`, 11/900) shows on groups you run. No new-ideas badges for now.
  - The current group has a `#f3f1fe` tint, with no tick.
  - A hairline, then **+ Join a group**.
- **Join a group pop-up** (needs sign-in):
  - *Got a code from an organiser? Enter it here.*
  - A 6-character code (24/800, 8px tracking, A–Z and 0–9).
  - **Join**, grey until 6 characters.
  - Error: *That code didn't match a group. Check it with your organiser.* (14/700 `#9b1c31`).
  - Joining adds the group and switches to it.
- **Codes:** 6 characters from A–Z and 2–9, excluding I, O, 0 and 1. Links look like `/join/CODE`.
- **Roles:** **owner** (the creator; one per group), **admin** and **member**. Owners and admins get the ADMIN chip, the Edit link and Edit group, and can make other members admins. Only the owner can rename or delete the group, or remove an admin.
- **Creating groups:** not in the app for now. Groups are set up by us (in Supabase) and shared by code.
- **Group photo:** each group has one, used on Home tiles, All ideas and as the fallback for ideas without a photo. It's a new field; the prototype hard-codes these.

## Sign-in and guests
- **Sign-in pop-up, step 1:**
  - Title: **Sign in**, or **Sign in to post** from Put it up.
  - Body:
    - Default: *Your ideas, groups and name are saved to your account.*
    - From Put it up: *Sign in to put your idea up.*
    - From Join: *Sign in to join a group.*
    - Always followed by *Use Google, or we'll email you a 6-digit code. No password.*
  - **Continue with Google** (54px, 2px `#dcdfe6`, hover `#b9bcc4`), an "or" divider, an email field, and **Email me a code** (grey until valid).
  - Fine print: *Only used to sign you in. Nobody else sees it.* and a **Privacy** link.
  - If Google is cancelled, an inline alert: *Google sign-in didn't finish. Try again, or use your email.*
- **Step 2:**
  - **Enter the code** / *Sent to {email} · Change*.
  - A 26/800 code field with 10px tracking (`one-time-code`), then **Sign in**.
  - *Not there? Check spam, or* **Send it again**, which then reads "Sent again". A second tap shows the one-a-minute toast.
- **Busy labels:** Sending… / Signing in… / Opening Google… / Putting it up… While one is busy, the other method is disabled.
- **Guests:** I'm interested and Suggest work without an account.
  - The first time a guest does one per visit, a **Your info** pop-up appears.
    - *So {Lead} can reach you. Only they see it.*
    - A name field (placeholder *Jane Smith*).
    - A **Phone number** field (`type=tel`, at least 10 digits; only digits, spaces and `()+.-` allowed).
    - **Continue**.
    - A `#f3f1fe` panel: **Have an account?** *Sign in to skip this.* with a **Sign in** pill.
  - Store `guest_name` and `guest_phone` with the interest or offer, visible to the lead only. Move them into the account if the guest signs in later.

## States
- **Loading:** "Loading ideas…" plus 3 pulsing skeleton cards (`#eceef1` / `#f2f3f6`, opacity 1 → .45 over 1.4s).
- **Offline:** a banner (`#fdeef0`, 1.5px `#f5c2cb`, radius 14, text `#9b1c31`).
  - **Couldn't load ideas** / *Check your connection. We'll keep trying, and this goes away once you're back.*
  - A **Try now** link that retries immediately.
- **Dead idea link:** a white card, **That idea isn't up anymore** / *Its lead may have taken it down, or the link got cut short.* / **See what's up now →**, with a ✕ to dismiss.
- **Failed save:** the error toast *That didn't go through. Try again in a moment.*
- **HEIC photo:** the error toast *That photo couldn't be read. Try a different one.*

## Data model (additions to what's live)
- `groups`: id, name, code, photo_url, photo_pos ({x, y, zoom}), created_by. `memberships`: user_id, group_id, role (`owner` | `admin` | `member`), pinned (bool), last_visited_at (orders Home → Your groups).
- `ideas` gain group_id, cover_pos ({x, y, zoom} for the first photo), spot_address, basics (text[] ≤ 3), and mood (photo urls ≤ 3). There's no date voting and no RSVPs. The date is a single value or null.
- `profiles` gain avatar_url.
- Interest and offers accept either a user_id, or a guest_name + guest_phone.

## Removed (don't build)
- New-ideas / "N new" badges everywhere (Home tiles, the Your groups sheet, the switcher menu). Parked for now.
- Start a group: the Welcome button, the Profile row and the pop-up. Groups are created behind the scenes for now.
- Date voting, the RSVP pop-up and "Pick a day".
- The progress bar, checkpoints, "How close this is", the "Everything's in place" card, and "N of 3 in place" everywhere.
- The category filter.
- The questions screen and the "Holding an idea" pop-up.
- The claim-lead and step-back flows, and head counts.
- Location suggestions (Geoapify), the address picker and the Directions link. The address is stored as plain text for now.
- The offer chips at the bottom of the idea page, including "I can help with something".
- The old Home hero (Walktober card, "What should we get up to?").
- The "Signed in with" row and the lead-only sign-in copy.

## Open / not designed yet
- How categories work. Walktober is meant to become a category.
- Group settings: rename, regenerate the code, remove members, co-admins, leave a group.
- An empty new group's first-run view.
- Remaining member actions: removing someone from the group, and transferring ownership.
- Lead notifications (skipped for now).
- Whether the offer pop-up buttons (**Offer this location** / **Offer this day**) and the "offered a location" / "floated a day" activity lines should say "Suggest", to match the rows.
- Whether names display as first names or full names.
- **Invite link flow:** what someone sees when they open `/join/CODE` (signed out and signed in), before and after joining.
- **Group creation in the app.** For now groups are created by us in Supabase.
- **Welcome wording:** *New here? Either one creates your account.* is a placeholder line under the sign-in buttons.
- **Parked: the Lead note.** Removed from the last post-flow screen for now. Bring back later, above **Put it up**, with a shield icon and the first sentence bold: **You'll be the Lead of this event.** You've got final say, the dates, the details, but that doesn't mean doing it alone. Leading well means bringing other people in and deciding together.

## Design tokens
**Ink and greys:** `#0d1117` · `#2b303a` · `#454b55` · `#5c6270` · `#6b7280` · `#8a909b` · `#9aa0ac` · `#b3b8c2`

**Lines and fills:** `#dcdfe6` · `#dfe2e8` · `#e4e7ec` · `#e6e7eb` · `#eceef2` · `#f2f3f6` · `#f7f7f9` · page `#f1f2f5`

**Purple (primary):** `#5b4ae8` · hover `#4a3ad4` · tint `#f3f1fe` · on dark `#9d93f7`

**Gold (spark):** `#e8a71c` · deep `#8f6405` · tint `#fdf1d6` · on dark `#f3c55a` · ring `#f1d58f`

**Green:** `#0f7a3c` · tint `#e8f6ee` · toast `#149a4b`

**Red:** `#9b1c31` · bg `#fdeef0` · border `#f5c2cb` · toast `#e2556b`

**Scrims:** `rgba(13,17,23,α)`. Brown fallback behind photos while they load: `#2b2413`. **No photo is ever blurred.**

**Radii:** 11–12 (tiles) · 14 (inputs, small cards) · 16 (menus, grid cards) · 18–20 (cards) · 22 (modals) · 26 (idea sheet) · 999 (pills)

**Shadows:** card `0 1px 3px rgba(15,18,25,.08)` · menu `0 18px 44px rgba(15,18,25,.2)` · modal `0 24px 60px rgba(15,18,25,.3)` · primary `0 10px 24px rgba(91,74,232,.32)`

**Type scale:** 42 / 40 / 30 / 22 / 21 / 20 / 18 / 16.5 / 16 / 15.5 / 15 / 14.5 / 14 / 13.5 / 13 / 12 / 11.5 / 10.5, at weights 500 / 600 / 700 / 800 / 900.

## Assets
- `photos/`: demo photos. `torrez-trail.png` is the Torrez group photo. `trail-cleanup.png`, `torrez-crew.png` and `get-togethers*.jpg` are idea photos. `projects.jpg` and `mutual-aid.jpg` are mood and other groups' photos.
- `photos/faces/`: demo profile photos.
- All replaceable. Icons are inline SVG (stroke 2–2.4, round caps).

## Screenshots
`screenshots/` holds 2× captures (786px wide) of the prototype with sample data, signed in as Eric (owner of Torrez Fitness) unless noted. Scrolling screens are captured full length.
- 01 Welcome (signed out) · 02 Home (signed in: square group tiles, pins, View all) · 03 All ideas, Cards · 04 Grid · 05 List
- 06 Idea page (member) · 07 Idea page (lead: Waiting on you, Set, Photo button)
- 08 Profile · 09 Edit group (owner) · 20 How this works
- 10 Sign in · 11 Sign-in code · 12 Guest "Your info" (signed out)
- 13 Group switcher menu · 14 Join a group · 15 Post an idea, step 1 with the Post to menu open
- 16 Your groups sheet · 17 Members sheet (Make admin / Remove) · 18 Delete group confirm · 19 Photo positioner

The prototype is the source of truth where a screenshot differs.

## Files
- `Spark Hub App.dc.html`: the full prototype, and the source of truth for layout and behaviour.
- `Privacy.dc.html`, `Sign-in Email.dc.html`: the static pages.
- `explorations/`: the options that led to each decision (Home, All ideas, card images, idea page, interest, basics, profile, group settings, open questions). For reference only; the chosen option is noted in each.
- `CHANGELOG-design.md`: the full decision history.
- `support.js`: the runtime needed to open `.dc.html` files.
