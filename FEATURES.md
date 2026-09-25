# Feature inventory

Every function and feature in the build, numbered so you can say "scrub 27, 29, 37". Status: **Live** (works, visible), **Test** (built, on the `test` branch, not live yet), **Placeholder** (works, copy is Latin).

As of 2026-09-25: the Spark Hub rebuild from the design handoff "Spark Torrez - Full Site 3". This rebuild restarted the numbering; the list for the old single-group app is in git history (`FEATURES.md` before this date).

## Welcome (signed out)

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Photo header (picnic photo), logo, "Turn your idea / into a plan.", the 1-2-3 steps as a list | Test | Photo: `photos/welcome.jpg` |
| 2 | **Continue with Google** (straight to Google) and **Continue with email** (the email-code pop-up, no second Google button); "New here? Either one creates your account." | Test | |
| 3 | An invite link (/join/CODE) adds "Sign in to join the group CODE"; after signing in, Join opens pre-filled | Test | |
| 4 | (Removed) Group code card, Start a group, How this works link: now only after sign-in / in the tab bar | Test | |

## Home (signed in)

| # | Feature | Status | Notes |
|---|---|---|---|
| 5 | Logo (goes Home) + group switcher | Test | |
| 6 | "Turn your idea / into a plan." hero, one-pill 1-2-3 steps, **I have an idea** | Live | Posts to the current group |
| 7 | **Your groups**: first tile (the group you run, else current) with ADMIN chip and "N ideas" / "N new", other groups in a 2-column grid with new-idea badges | Test | Tapping switches group and opens All ideas |
| 8 | **Join with a code** link | Test | |
| 9 | **Coming up**: next 3 dated ideas across your groups, mini calendar | Test | Hidden when nothing is dated |
| 10 | Not in a group yet: **Join with a code** / **Start a group** card | Test | Not designed; built to match |

## Groups

| # | Feature | Status | Notes |
|---|---|---|---|
| 11 | Group switcher menu: your groups, ADMIN chip, new-ideas badge, current one tinted, **+ Join a group** | Test | Badges clear when you open that group |
| 12 | **Join a group** pop-up (code, "didn't match" error) | Test | Needs sign-in |
| 13 | **Start a group** pop-up → "{Name} is ready" with code, link, **Copy invite link**, **Go to {Name}** | Test | Name saved in Title Case |
| 14 | Invite links `/join/CODE` (and `#/join/CODE`): code filled in; Join opens for someone signed in | Test | Vercel rewrite in `vercel.json` |
| 15 | **Group page** (admins): code, link, **Share invite link**, **Copy code**, Members count, Go to this group | Test | |
| 15b | **Owners** (up to 2 per group; whoever starts a group): everything admins can do, plus **Members and roles** on the Group page to make anyone Owner / Admin / Member. Admins see the member list read-only. A group always keeps one owner | Test | Owner badge is purple, Admin gold |
| 16 | Group photo on Home tiles, All ideas header and as the fallback behind ideas without a photo; admins replace it on the Group page (**Replace photo**) | Test | New groups fall back to gold until an admin sets one |

## All ideas (per group)

| # | Feature | Status | Notes |
|---|---|---|---|
| 17 | Photo header with group name, **All ideas**, overlapping **I have an idea** | Test | |
| 18 | **View**: Cards · Grid · List, remembered on this device | Test | |
| 19 | **Sort**: Most popular (default) · Happening soon · Newest · Oldest | Test | Happening soon: upcoming dates (soonest first), then no date yet (newest first), then past dates |
| 20 | Card: photo (or the group photo), title, date · time, location, lead's face + "Led by", interest count | Test | "Date TBD" / "Location TBD" in grey |
| 21 | Loading skeletons, "Couldn't load ideas" banner with **Try now**, "No ideas yet." | Test | |

## Idea page

| # | Feature | Status | Notes |
|---|---|---|---|
| 22 | Photo header (or the group photo), back, group name, **Edit** (lead, or an admin of the group: edit the idea and basics, delete it) | Test | |
| 23 | Title sheet: lead's face, "Led by", **N interested** + face stack (+N) | Test | |
| 24 | **I'm interested** / **You're interested** (not for the lead) | Test | Guests give name + phone first |
| 25 | **Waiting on you** (lead): suggested locations/dates with **Use this location / Use this date** and **Not this time** | Test | |
| 26 | Date & location card: date + time, location + address + **Directions**; **Suggest** (others) or **Set** (lead) while missing | Test | The lead's Set applies at once |
| 27 | **The basics** (up to 3 lines) with lead/member empty states | Test | |
| 28 | What the lead is picturing + **Say more about what you're picturing** | Test | |
| 29 | **Who's pitching in** (accepted offers; your own waiting ones) | Test | |
| 30 | **The vibe** mood board: up to 3 photos, lead adds/removes; tap one to see it full screen (arrows between, ✕ / Escape / tap to close) | Test | Members see it only with photos |
| 31 | Rotated tag after actions ("It's up", "You're interested", "Sent to the lead", "Location set"…) | Test | |
| 32 | Lead's **Who's interested** list with guests' phone numbers (tap the count) | Test | Not designed yet |
| 33 | "That idea isn't up anymore" card for a dead link | Test | |

## Posting and editing

| # | Feature | Status | Notes |
|---|---|---|---|
| 34 | Post flow: event → location → date (+ time) → the basics → photos (up to 3) → **Look good?** | Test | Into the current group |
| 35 | Location suggestions while typing (Geoapify, near Austin), address saved with the pick | Test | Kept by owner decision; the design had removed them |
| 36 | **Put it up** needs sign-in ("Sign in to post"), then a name if missing | Test | |
| 37 | Edit idea: title + the basics; **Delete this idea** (removes its photos) | Test | |

## Sign-in, guests, profile

| # | Feature | Status | Notes |
|---|---|---|---|
| 38 | Sign-in pop-up: **Continue with Google**, email → 6-digit code, **Send it again** (one a minute), per-entry copy (post / join / guest) | Test | |
| 39 | Google cancelled: inline "didn't finish" alert; a half-finished idea survives the trip | Test | |
| 40 | Guests: **Your info** pop-up (name + phone, once per visit) before interest or suggesting | Test | Phone visible to that idea's lead only |
| 41 | Name pop-up (first time a signed-in person needs a name) | Test | |
| 42 | Signing in on a new phone moves that phone's anonymous activity into the account | Test | |
| 43 | Profile: photo, name, email, **Edit**; Your ideas; Your groups (ADMIN first); Join with a code; Start a group; **Sign out**; Privacy | Test | Signed-in only |
| 44 | **Edit profile**: photo add/change/remove, name, email change with a code (email sign-ins) | Test | Google email is read-only |

## Pages and emails

| # | Feature | Status | Notes |
|---|---|---|---|
| 45 | How this works | Placeholder | Latin body, as designed |
| 46 | Privacy page (`/privacy.html`), redesigned with who-sees-it chips | Test | |
| 47 | Sign-in emails: code, and confirm email (first sign-in or email change) | Test | `supabase/templates/`, sender Spark Hub via Resend |
| 48 | Toasts (errors red "!", confirmations green ✓) | Test | |

## Data and security

| # | Feature | Status | Notes |
|---|---|---|---|
| 49 | Tables: groups, memberships, sparks, offers, interests, profiles, guest_contacts, link_access, merge_tokens | Test | Migration `20260925000000_spark_hub_groups.sql` |
| 50 | Members see their groups' ideas; an idea's link opens just that idea for anyone | Test | `open_idea()` |
| 51 | Functions: create_group, join_group, group_code, member_count, add_offer, resolve_offer, rename_me, open_idea, prepare/complete_merge | Test | |
| 52 | Photo bucket `spark-photos` (own-folder rules): idea photos, mood photos, avatars | Live | |
| 53 | Live and test databases; migrations | Live | |

## Operations

| # | Feature | Status | Notes |
|---|---|---|---|
| 54 | Daily keep-alive ping (GitHub Action) | Live | |
| 55 | Weekly live backup on the Mac (launchd → ~/Backups/sparkhub) | Live | Saves every table that exists |
| 56 | Design handoff doc kept current by Claude Code | Live | |
| 57 | Vercel auto-deploy from `main`; previews from `test` | Live | |
| 58 | Security headers + CSP; pinned, integrity-checked Supabase script | Live | |
| 59 | Automated end-to-end tests (15: smoke, posting, groups, collaboration, Google, database security) | Test | `tests/` |
| 60 | Nightly cleanup of test-database leftovers ([E2E] ideas and groups, old anonymous users) | Live | Test project only |

## Removed in this rebuild

- Date voting (date options, ranks, lock-in) and the RSVP pop-up.
- The Walktober hero card, "What should we get up to?" Home, category filter, questions screen.
- Progress / "N of 3 in place", checkpoints, "Everything's in place" card.
- "I can help with something" and the offer chips at the bottom of the idea page.
- "Signed in with" row and the lead-only sign-in copy on Profile.
