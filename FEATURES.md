# Feature inventory

Every function and feature in the build, numbered so you can say "scrub 27, 29, 37". Status: **Live** (works, visible), **Dormant** (code exists but can't be reached or is switched off), **Placeholder** (works, copy is Latin).

As of 2026-09-24. Update this when features are added or removed.

## Home

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Header: "Torrez Fitness" eyebrow, bolt + **Sparks**, "What should we get up to?", 2-step list | Live | |
| 2 | **I have an idea** button (header, and again at the bottom of the How card) | Live | |
| 3 | "More about how this works ↓" scroll link | Live | |
| 4 | **Walktober 2026** hero photo card with "N ideas so far" → opens the list | Live | Hardcoded title and photo |
| 5 | "How this works" card on Home | Placeholder | Heading is final, body is Latin |

## Ideas list (Browse)

| # | Feature | Status | Notes |
|---|---|---|---|
| 6 | Header repeats the Home block, with a back arrow | Live | |
| 7 | "N ideas so far" / "Loading ideas…" count | Live | |
| 8 | Sort menu: Newest · Oldest · Needs a lead · Almost there | Live | "Almost there" depends on #40 |
| 9 | Card cover photo + photo-count pill | Live | |
| 10 | Card title | Live | |
| 11 | Card location row (gold when set, grey "Location TBD") | Live | |
| 12 | Card date row (gold when set, "Date TBD" or "Date TBD · N options") | Live | |
| 13 | Card footer: poster initial + name · relative time | Live | |
| 14 | Card interest pill (bolt + count, gold when you're interested) | Live | Depends on #22 |
| 15 | "Needs a lead" label under the footer | Live | |
| 16 | Gold bar down the card's left edge | Live | Colour comes from the idea's category (always Walktober) |
| 17 | Empty state "No ideas yet." | Live | |

## Idea page

| # | Feature | Status | Notes |
|---|---|---|---|
| 18 | Header with back arrow and **Edit** (lead only) | Live | Edit → #55–56 |
| 19 | Gold hero: SPARK eyebrow, title, poster · time, "It's up" tag | Live | |
| 20 | Hero pills: "Needs a lead" / "Deciding & executing" | Live | The second appears when all 4 checkpoints are met |
| 21 | Photo grid | Live | |
| 22 | **I'm interested** toggle + "N interested" (non-leads); count card for the lead | Live | |
| 23 | **Waiting on you** card: "Use this spot/day" · "Not this time" · "Replaces …" | Live | Lead approval of #43 offers |
| 24 | Facts card: "The spot: …", "The day: …", "Location: we'll decide together." | Live | |
| 25 | "Just the idea so far" card when there are no facts | Live | |
| 26 | **Hoping for** list (dream-version lines) | Live | |
| 27 | "The vibe" line | Dormant | Vibe was removed from posting; only old data could show it |
| 28 | **Dates on the table**: ranked date options, RSVP bars, badges (Most support / Tied / Locked in) | Live | |
| 29 | "Success is N or more, counting the lead", "· N short of N", "Enough to go" badge | Dormant | Head count was removed from posting; `min_people` is never set now |
| 30 | Lead on each date: names who picked it, **Lock this one in**, **Remove** (confirms if anyone picked it) | Live | |
| 31 | "N interested, but none of these work" — lead sees names + tap-to-call numbers | Live | |
| 32 | **RSVP** / **Change my RSVP** button (non-leads) | Live | No way to withdraw an RSVP |
| 33 | RSVP sheet: pick dates, "none of these dates work", name + phone, privacy note | Live | Phone visible to the lead only |
| 34 | Lead: **Add a date option (N of 3)** with a date-time picker | Live | Picker limited to Oct 2026 |
| 35 | Lead: "Pick a day" prompt card when there's no day and no options yet | Live | |
| 36 | "What you're picturing" card + **Say more about what you're picturing** (lead) | Live | Free-text "vision" |
| 37 | **Add a little to this** → follow-up questions | Dormant | Only for non-Walktober categories, which can't be created |
| 38 | **Everything's in place** card (all 4 checkpoints met) | Live | |
| 39 | **How close this is** card: 4-segment bar + status line | Live | Depends on #40 |
| 40 | Checkpoints: Somebody out front · A place for it · A day it happens · Basics established (tap to act; lead marks Basics) | Live | Feeds #8, #20, #38, #39, #60 |
| 41 | **I'll take the lead on this** + "You're out front on this one" pop-up | Live | |
| 42 | Lead copy + **Step back from the lead** (confirms) | Live | |
| 43 | Offer chips: **Offer a spot** · **Offer a day** · **I can help with something** | Live | Spot/day from non-leads go to #23; help posts immediately |
| 44 | **Who's already in** list, including your own pending offers "· waiting on X" | Live | |

## Posting an idea

| # | Feature | Status | Notes |
|---|---|---|---|
| 45 | Step 1: **What's the event?** (80 chars) | Live | |
| 46 | Step 2: **Location** + "Decide location later" | Live | |
| 47 | Step 3: **Date** (Oct 1–31 2026) + "Add time" (30-min steps) + "Decide date later" | Live | Date range hardcoded |
| 48 | Step 4: **Paint the picture** (3 dream lines, 30 chars each) | Live | |
| 49 | Step 5: **Add a photo** (up to 3, shrunk in the browser) + "Skip photos" | Live | |
| 50 | Step 6: **Look good?** review with Edit links + "You'll be the Lead" note | Live | |
| 51 | "Putting it up…" busy label | Live | |
| 52 | **Your name** pop-up (first time you post, lead or offer) with the gold initial | Live | |
| 53 | "Been here before? Sign in" link in that pop-up | Dormant | Hidden while sign-in is off (#61) |

## Editing

| # | Feature | Status | Notes |
|---|---|---|---|
| 54 | Edit screen: title + 3 dream lines, **Save changes** | Live | |
| 55 | **Delete this idea** (confirms; removes photos you uploaded) | Live | |

## Profile

| # | Feature | Status | Notes |
|---|---|---|---|
| 56 | Avatar + name, **Change name** / **Add your name** (renames you everywhere) | Live | |
| 57 | **Ideas you lead** list with "N of 4 in place" / "Happening" | Live | Depends on #40 |
| 58 | "Keep your ideas" card + **Sign in with your number** | Dormant | Hidden while sign-in is off |
| 59 | "Signed in as (555)…" card + **Sign out** | Dormant | |

## How this works

| # | Feature | Status | Notes |
|---|---|---|---|
| 60 | Own screen (tab 2) with the same content as #5 | Placeholder | |

## Sign-in (built, switched off)

| # | Feature | Status | Notes |
|---|---|---|---|
| 61 | Text-code sign-in: phone → 6-digit code → "Text it again" / "Change" | Dormant | Needs an SMS provider; see BACKLOG.md for the email plan |
| 62 | Account merge: this phone's ideas move into the signed-in account | Dormant | |

## Follow-up questions (legacy)

| # | Feature | Status | Notes |
|---|---|---|---|
| 63 | "A few quick ones" screen: spot / day / people / resource questions, progress dots, Skip, "That's enough for now" | Dormant | No reachable category has questions. ~170 lines of code + data |

## Behaviour and plumbing

| # | Feature | Status | Notes |
|---|---|---|---|
| 64 | Invisible identity per browser; quiet recovery if it breaks | Live | |
| 65 | Shareable links (#/ideas, #/how, #/me, #/idea/…) and phone back button | Live | Links opened while the app is already open are followed, and fetch an idea posted since the page loaded |
| 66 | Auto-refresh every 30 s and when you return to the tab | Live | |
| 67 | "Couldn't load ideas" banner, "Loading ideas…", error toasts | Live | |
| 68 | Your name, RSVP name and phone remembered on this device | Live | |
| 69 | Live vs test database chosen by web address | Live | |
| 70 | Relative times ("3 minutes ago") | Live | |
| 71 | Tab bar: Home · How · **+** · All ideas · Profile | Live | |
| 72 | Desktop frame: centred 430 px card | Live | |
| 73 | Keyboard and screen-reader support (focus rings, Escape closes pop-ups, roles/labels) | Live | |

## Database

| # | Feature | Status | Notes |
|---|---|---|---|
| 74 | Tables: sparks, date_options, rsvps, offers, interests, merge_tokens | Live | |
| 75 | Functions: claim_lead, add_offer, resolve_offer, remove_date_option, step_back, rename_me, rsvp_counts, prepare_merge, complete_merge | Live | |
| 76 | Legacy columns still stored: vibe, min_people, cat, answers | Dormant | Nothing writes them any more |
| 77 | Photo bucket `spark-photos` (public URLs, 5 MB, JPEG/PNG/WebP, own-folder rules) | Live | |
| 78 | Migrations folder; separate live and test projects | Live | |

## Operations

| # | Feature | Status | Notes |
|---|---|---|---|
| 79 | Daily keep-alive ping (GitHub Action) | Live | |
| 80 | Weekly live backup on the Mac (launchd → ~/Backups/torrezhub) | Live | |
| 81 | Design handoff doc kept current by Claude Code (CLAUDE.md rule) | Live | |
| 82 | Vercel auto-deploy from `main`; preview links from `test` | Live | |
| 83 | Security headers + CSP (vercel.json); pinned, integrity-checked Supabase script | Live | Added in the 2026-09-24 audit |
| 84 | Automated end-to-end tests (8 tests: smoke, posting, two-member collaboration, database security) on every push | Live | `tests/`; GitHub "End-to-end tests" workflow |
| 85 | Nightly cleanup of test-database leftovers | Live | Test project only |
