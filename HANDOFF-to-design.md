# Handoff: Spark Hub — live build → Claude Design

**Direction:** code → design. This describes what's built, so the next design round starts from what shipped rather than from the design file.

- **Built (test):** https://gosparkhub-git-test-eric-5958s-projects.vercel.app · **Live:** https://gosparkhub.vercel.app
- **Source:** github.com/esshaughn/sparkhub (`index.html`, `js/sparks.js`, `css/sparks.css`, `privacy.html`, `supabase/templates/`)
- **Baseline:** `design/spark-hub/README.md` + `Spark Hub App.dc.html`, from "Spark Torrez - Full Site 4" (the spec and prototype are in the repo; photos, screenshots and explorations stayed in the zip)
- **As of:** 2026-09-25 (Full Site 4 build, on the test branch)

Everything in the Full Site 4 README is built as specified, except what's listed below. Where this doc and the design files disagree, **this doc is correct**.

---

## 1. What changed since the design

These are the owner's decisions, made after the design round started (it was drawn from an older copy of this doc).

| # | Change | Design said | Why |
|---|---|---|---|
| 1 | **Location suggestions stay.** The post flow's Location step and the lead's **Set** suggest places near Austin as you type (Geoapify). A pick saves the street address, shown under the location on the idea page with a purple **Directions** link. The privacy page keeps its Geoapify row | Removed: plain text, no address picker, no Directions, no Geoapify row | Owner decision (kept twice) |
| 2 | **Up to two owners.** Whoever starts a group is its owner; an owner can make one more owner. **Only owners** make or remove admins and owners; admins see the member list without actions | One owner per group; admins can also Make admin; only the owner removes admins | Owner's feature request |
| 3 | **Admins edit and delete any idea in their group** (the idea and its basics; the lead stays the lead). The Edit pill shows for the lead and for the group's admins/owners | Edit pill for the lead only | Owner's request |
| 4 | **Page background `#e8eaee`** (a step darker than `#f1f2f5`) behind lists, cards and overlay screens; `#dcdfe4` outside the app frame on desktop | `#f1f2f5` | Owner: "slightly darker gray" so white cards stand out |
| 5 | **Sort** has **Happening soon** second: upcoming dates first (soonest on top), then no date yet (newest first), then past dates | Most popular · Newest · Oldest | Owner's request |
| 6 | **Tapping a vibe photo opens it full screen** (see §2c) | Not specified | Owner's request |

## 2. Things the build had to invent (please design these properly)

### a. Owner controls in the Members sheet
Rows keep the design's layout (40px face, name, *(you)*, chip). For **owners** only, the right side shows:
- plain member → outline **Make admin** pill (as designed)
- admin → outline **Make owner** pill (only while there's one owner) and grey **Remove** (back to member)
- the other owner → grey **Remove** (back to admin); your own row, if there are two owners → grey **Step down**
- The **OWNER** chip is purple (`#ece9fd` / `#4a3ad4`); **ADMIN** stays gold. Owner chips also show on Home tiles, the Your groups sheet, the switcher menu, Post to and Profile (`★ Owner`).
- Confirmations (standard pop-up): **Make {first} an owner?** / *Owners can do everything admins can, and choose who the admins and owners are. They could also take the owner role away from you. A group can have two owners.* / **Make them an owner** · **Remove {first} as owner?** / *{first} will be an admin.* / red **Remove as owner** · **Step down as owner?** / *You'll be an admin and can't change roles any more.* / red **Step down**.
- Toasts: *{first} is now an admin* · *{first} is now an owner* · *{first} is no longer an admin* · *{first} is no longer an owner* · *You're an admin now*.
- Edit group's members card reads *You're the owner* for either owner.

### b. Invite link, signed out (README → Open)
- Welcome adds one centred line above the buttons: *Sign in to join the group* **CODE** (14.5/700 `#dfe2e8`, code white 900, 1px tracking). Signing in either way then opens the Join pop-up with the code filled in.

### c. Full-screen vibe photos
- Tapping a vibe photo opens it over `rgba(0,0,0,.94)`, fitted; a 40px round ✕ top right (`rgba(255,255,255,.16)`); with 2–3 photos, 44px round ‹ › arrows and *2 / 3* at the bottom (13/700, 75% white). Tap outside, ✕ or Escape closes; arrow keys move between photos.

### d. Small states
- Not in a group yet (Home and All ideas): **You're not in a group yet.** / *Join one with a code from its organiser.* / **Join with a code** (no Start a group).
- Members sheet while loading: *Loading…*. Positioner Save while saving: **Saving…**. Delete group while deleting: **Deleting…**.
- Deleting your only group: toast *You need to be in at least one group.*
- Sort and View menus keep a purple ✓ on the selected row (the groups menus don't).

## 3. Behaviour added in the build (no visual change)

- **Photo framing** is stored as `{x, y, zoom}` (x/y 0–100 %, zoom 1–2.5) on `groups.photo_pos` and `sparks.cover_pos`, and rendered with the README's rule everywhere (full layer with zoom on headers and the positioner; the same focal point on tiles, cards and thumbnails). Choosing a different photo in the positioner uploads it on Save; the old file is deleted if you uploaded it.
- **Pins and order:** `memberships.pinned`; "most recently visited" is `memberships.last_seen_at`, set whenever you open a group (tile, sheet, switcher, Post to doesn't count).
- **Owners rename** (2–40 characters) **and delete** groups through database functions; deleting cascades its ideas and memberships (their photos stay in storage). Roles change only through `set_member_role` (max two owners, never zero).
- **Admins' powers:** replace the group photo, edit (title, basics) or delete any idea in the group. They can't set a lead's date/location, answer their offers or change their vibe photos or cover.
- **Who sees what:** members see their groups' ideas; an idea's link lets a visitor see just that idea. Join codes are visible only to admins and owners.
- **Guests** give name + phone once per visit; only that idea's lead sees them. Signing in later moves a phone's anonymous activity into the account.
- **Groups today (live):** Torrez Fitness, Hub on Hunters, Woodcliff Neighborhood, Walnut Creek Neighborhood, each with example ideas.

## 4. Designed but not built or not working

- **"How this works" body copy** is still placeholder Latin (as designed).
- The prototype's **Rename group pop-up** isn't used; the inline rename (2a/2b) is what's built, as the README specifies.

## 5. Open questions for the next round

1. Everything in the README's **Open / not designed yet** list still stands (categories, first-run view for an empty group, removing members, leaving a group, lead notifications, Suggest vs Offer wording, first vs full names, group creation in the app, Welcome wording, the parked Lead note).
2. **Invite link screens** (§2b is a stopgap).
3. **Owner controls** (§2a): is a pill + text button per row right at 393px, or should roles move into a per-row menu?
4. **Google's sign-in screen** says "continue to …supabase.co" until Spark Hub has its own sign-in domain.
5. **Video on the vibe board** (2 photos + 1 short clip) is parked: phone videos can't be shrunk in the browser, so it would need a ~20 s / 25 MB cap and watching the free plan's bandwidth.
6. **Spark Hub address:** gosparkhub.vercel.app for now; a custom domain may follow.

## 6. Design tokens

As listed in the Full Site 4 README, except the page background (§1 #4) and the purple owner chip (§2a: `#ece9fd` / `#4a3ad4`).
