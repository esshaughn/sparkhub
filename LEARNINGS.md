# Platform design learnings

What outside research says Spark Hub should be, and what it should stay out of. Read this before proposing a new feature. Newest source first. Each source ends with where the app stands on its recommendations; when one ships, update its row here and add the feature to FEATURES.md.

## Sources

| Date | Source | From |
|---|---|---|
| 2026-10-01 | **The Groundskeeper**, a systems story: desire paths, ants, bees, slime mould, threshold cascades and a simulated neighbourhood (200 runs per scenario), ending in how an in-app nudging agent should behave · https://claude.ai/artifact/4X5hWUaH9vC2VTEag7qmgr. Its fuller evidence is in a companion report, *Desire Paths*, which we haven't seen | Kevin |
| 2026-10-01 | **Where Spark Hub Fits**, a market review of ~35 products (99 claims re-checked against primary sources) · https://claude.ai/artifact/37rDbtsbRJ7tU8wFRZS1h7 | Kevin |
| 2026-10-01 | **Why Some Events Happen**, the social-science review (first followers, hosting, showing up). Built as FEATURES.md #126–128 | Kevin |

## What Spark Hub is (and isn't)

- **The difference is the combination, not any one feature.** Members propose ideas, the work splits into jobs and shifts, it lives in a standing local group, and guests need no account. No product does all four; every piece exists somewhere (idea votes in Sha/Rally/Partiful, sign-ups in SignUpGenius/BAND, account-free RSVPs in Apple Invites/BAND/Heylo).
- **One line:** SignUpGenius plus a Partiful-quality guest flow plus an idea board, for a neighbourhood or club, built to spread the hosting.
- **It's an engagement ladder** (attend → help → co-host → lead), the organiser's idea applied to block parties and gym hangouts. The ladder needs deliberate nudges; it won't climb itself.
- **A workflow can be copied.** WhatsApp, BAND and Heylo can each add pieces. The defence is doing one community's whole loop better than anyone, in fewer steps, not owning a feature.
- **Closest competitors:** BAND (group, calendar, sign-up sheets, account-free RSVPs since 2026; no idea stage, not built for neighbourhoods) and Heylo (run clubs and churches; has payments and email, which Spark Hub lacks).
- **The real competitor is the group a neighbourhood already has** (Facebook group, WhatsApp chat). Live beside it, don't try to replace it.

## Don't build

| Don't | Because |
|---|---|
| One-off party invites | Partiful and Apple Invites are free, polished and everywhere. Let people paste a Partiful link |
| Event discovery among strangers | Eventbrite, Luma, Meetup and Timeleft own it, and its economics (ticketing, paid matching) are wrong for us |
| Group chat | Link into the chat. Geneva raised ~$36M on chat + events and was shut down |
| Payments and ticketing | Liability. Link to Venmo or PayPal at most (Open Collective Foundation's collapse left 600+ grassroots groups stranded) |
| A neighbourhood feed, safety talk or news | Nextdoor's moderation burden. Keep content to *proposals to do something together* |
| Feature parity with BAND or Heylo | Compete on how few steps it takes to go from idea to happening |
| Charging the organiser | Meetup's model puts the cost on the one person we want to help |

## Rules of thumb

- **Measure what happened, never sign-ups.** IRL claimed users that were ~95% fake. Count events that happened and people who came. *North star: events that happened per active group per month, led by someone other than the group's founder.*
- **Interest is not attendance.** Median no-show is ~28% for free events, ~32% at 10–49 people; 22% of free events lose more than half their expected turnout. If interest piles up and nobody comes, people stop trusting the board. Facebook's "Interested" is a famously empty signal; ours has to mean more.
- **An empty board looks dead.** Seed 5–10 ideas before inviting anyone. Grow one group at a time (Front Porch Forum took ~20 years town by town): find the smallest group that keeps itself going (15–30 members, three or more willing to propose) before adding groups.
- **Reach is the biggest weakness.** No email, and iPhone push needs Add to Home Screen, which Safari never prompts for. Every failed local app (Facebook Local, Neighborhoods, Buy Nothing's app, Geneva) died of distribution, not missing features.
- **Slow and digest-first beats real-time at neighbourhood scale** (Front Porch Forum: one issue a day, ~240,000 members in a state of ~270,000 households).
- **The guest flow has to feel as light as Partiful's**, and *Help out* as easy as SignUpGenius for a non-member: one link, pick a slot, done.
- **Every link must preview well in the chat**, and posting to the chat should be one tap.
- **Soft thresholds, not hard ones.** Hard "only if N commit" worked when commitment cost money (Tugg, Groupon). For free walks, a soft People checkpoint plus a firmer "I'll come if it happens".
- **The founder can't be the only organiser.** If every idea comes from the owner, it's a personal tool, which is the problem the pitch says Spark Hub solves.
- **Moderation risks once strangers share a space:** recruiting through events (politics, MLM, church), disputed or unsafe events, harassment through friend requests. Proposals-only content and invite codes help.

## Recommendations and where we stand

From the market review, 2026-10-01. ✓ built · ◐ partly · ○ not yet · ✕ conflicts with an owner decision.

| | Recommendation | Where it stands |
|---|---|---|
| ◐✕ | **Weekly digest**: *3 ideas need one more person · 2 plans need help*, by email or posted to the group chat. The review calls it probably the highest-leverage thing missing | No email is the owner's call (FEATURES #76). Options that keep that: a digest the owner copies into the group chat with one tap, or a weekly web push. Parked in BACKLOG.md |
| ✓ | Links that preview well in WhatsApp and iMessage | Built: `/i/<id>` and `/join/CODE` previews (#88) |
| ◐ | One-tap **Share to the group chat** on every idea and plan | Invite sheet has Copy / Text / Email / WhatsApp / More (#64), but it's a host tool, not a button on every idea for every member |
| ◐ | **Firmer interest**: *I'll come if it happens*, counted toward People, alongside a lighter *Curious* | *I'm interested* is one signal; *I could help make it happen* (#127) adds a helper tier. No commit-if-it-happens tier |
| ◐ | **Ladder nudges**: after you attend, *the next one needs a helper*; after two jobs, *want to co-host?*; **Ask someone by name** as the main button | *Ask two people first* after posting (#126) and *Looking for a host* / *I'll host it* (#127). No nudges after attending or helping |
| ○ | **Walktober templates**: *Morning loop around ___*, *Dog walk*, *Stroller walk*, *History walk*, so proposing takes one tap | Create event has job starter chips only. (The old Walktober hero card was removed in the rebuild) |
| ✓ | **Head count on It happened**: *How many came?*, host only | Built as *Who came?* per person (#128) |

## How groups come alive, and how the app should nudge

From *The Groundskeeper*. The simulations are toys: they show which way an effect goes, not how big it is, and the animal examples are analogies, not proof.

**One loop runs everything.** Shared projects *deposit*, people go where others already went (*reinforce*), interest *fades*, and past a *threshold* it's on. Ties between neighbours are what's left where projects outpace fading. An app can't make a tie; it can only change how easily projects form and who sees them.

- **Fading is a feature.** With no fading, a group gets stuck on its first habits (ants stay on the long bridge once committed). With too much, nothing holds. Interest should fade unless renewed, and an idea nobody picks up gets a gentle *let it rest*, not deletion.
- **Quorums let a group commit.** Bees move when 10–15 scouts are at one site, not when everyone agrees. More equal options slow the decision: a date poll with five options is slower than one with two.
- **Recruit a recruiter, then broadcast.** Everyone has a private threshold (how many must be in before they join). One gap at threshold 1–2 stalls the whole cascade. In the simulation, asking one friend before posting raised the chance an idea took off from ~30% to ~70%; more early boosts add little. This is the founding brief's *Spark → Find an Assist → Confirm details*.
- **Efficient groups route through one person**, and that person is the single point of failure (slime mould's one trunk). Co-leads keep spare routes.
- **A push fades; reshaping stays.** A five-week campaign lifted activity ~45% and was gone ~4 weeks later. Reshaping (recurring events, a co-lead for every lead, *I'm in if 5 are* pledges) roughly doubled activity, and much of it stayed even after the features were switched off. **For Walktober: the month is the push; what matters is what's still there on November 1.**
- **Strongest levers in the simulation:** pledges (*I'm in if N are*, ~39% more projects) and co-leads (nearly eliminated burnout).
- **Don't sort by "similar to you".** It split the simulated neighbourhood into pockets: ~10% less variety and ~23% fewer projects. Events everyone shares merge the pockets.
- **Ties take time:** ~40–60 hours together to become casual friends, 200+ for close ones. One walk is a small deposit; repetition is the point.

**The groundskeeper's five tools** (for any automatic nudging):

1. **Pave the proven path.** Lower friction where people already go: one-tap *Same time next week?*, suggest as co-host someone who keeps showing up, pre-fill the usual spot.
2. **A flower bed, not a fence.** Steer gently (suggest the other event, not the one that always overflows); never block.
3. **Let grass grow back.** Interest decays; unpicked ideas rest.
4. **Leave some meadow.** Newcomers and new kinds of project get varied suggestions, not the deepest rut.
5. **Pull out the wrong chain.** If people keep working around a nudge, it's wrong. Roll it back.

At the right moments: suggest the Assist when a Spark appears, show *two more and it's on* near a quorum, pair a first-time lead with someone who has led.

**The fence** (hard limits for any nudging agent): at most a few extra notifications a week per person; never keep asking the same reliable few; don't ask again soon after a no; fixed, reviewed messages only, never words the agent writes itself.

**Reward the right thing.** An agent rewarded for RSVPs raised events ~29% but roughly doubled burnout, wore people down with notifications and shrank ties across groups. The reward is the founding brief's line: *Success looks like the project got done and people feel closer, not how much time anyone spent inside the app.*

**Learning needs footprints.** From the outside, influence, similarity and a shared cause look identical. To learn what works, record what each person was shown, who came, and what the app itself did; vary one nudge on some ideas and not others; pool across groups. One group of 50 over a month only shows very large effects: telling a 30% yes-rate from 40% takes ~330 asks per option (~11 weeks in one group).

**The brief's tenets as engineering rules:** *Guide, not hero* → reward projects done and people closer. *Distribute the weight* → co-leads and pledges. *Clarity is kindness* → empty job slots and quorum counts tell the next person what to do. *Safe to hope* → *I'm in if N are*. *Energy is the compass* → decay, *let it rest*, a host check-in on how heavy it was. *Recompost failure* → keep the record of ideas that didn't happen.

From *The Groundskeeper*:

| | Recommendation | Where it stands |
|---|---|---|
| ○ | **I'm in if N are** pledges (the strongest single lever) | Same idea as the market review's *I'll come if it happens*. *How many do you need?* sets a People step (#8), but nobody can pledge against it |
| ✓ | **A co-lead for every lead** | Built: **Co-hosts** (#129), the lead adds people to host alongside them. Not yet nudged (*every* lead having one) |
| ○ | **Recurring events / Same time next week?** | Not built |
| ○ | **Interest fades; ideas rest** | Not built. Interest and ideas stay until removed |
| ◐ | **Find an Assist** when a Spark appears | *Ask two people first* after posting (#126), for events, not ideas |
| ○ | **Two more and it's on** near a quorum | Not built (needs pledges) |
| ○ | **Pair a first-time lead** with someone who has led | Not built |
| ✓ | Fewer date options decide faster | Date polls already cap at 2–5 options (#34). Could nudge toward 2–3 |
| ◐ | **Footprints**: record who came and what each person was shown | *Who came?* (#128) records attendance. Nothing records what the app showed or nudged |
| ✓ | No *similar to you* sort | None exists. Keep it that way |
| ○ | **Keep ideas that didn't happen** (recompost) | Not built: a cancelled or deleted idea is gone |

## The pilot (Walktober, October 2026)

The review's answer to *is it compelling enough to test now?*: yes, as a small pilot in one group, not a launch. Walktober fits because walks are small, free and repeatable, 31 days gives a deadline and a clean before/after, and there's no money, venue or tickets.

- Seed 5–10 walk ideas first. Arrange for the second walk to be led by someone other than the owner. The best result is a walk led by someone who had never hosted.
- After the pilot, stronger wedges: the gym (already meets weekly; Heylo competes) and recurring neighbourhood traditions with real jobs (block party, clean-up, holiday potluck, new-neighbour welcome), where shifts matter and SignUpGenius is what people use now.

Rough targets for one group of 30–60 members over 31 days (starting points to argue with):

| Stage | Measure | Target |
|---|---|---|
| Joining | Invited people who join | >50% |
| Proposing | Distinct members who float an idea | ≥5, ≥3 not the owner |
| Idea → plan | Ideas locked in within 14 days (and which checkpoint was missing for the ones that died) | 30–50% |
| Shared work | Events with a job claimed by a non-host; attendees who claimed a job | ≥50%; ≥20% |
| Ladder | First-time leads | ≥2 |
| Turnout | Came ÷ Going (from *Who came?*) | ≥60% |
| Reach | Members with push on; iPhone members on the Home Screen | if <40%, add email or a digest |
| Retention | Week-4 activity among week-1 members; a second event by the same host | ≥40% |

At this size interviews say more than numbers. Afterwards ask five hosts and five attendees: *Would this have happened without Spark Hub? What did you still do in the group chat? What almost stopped you from proposing something?*

## Business model (later)

Unresolved, and a later risk. What comparable products do: local ads (Front Porch Forum), organiser subscriptions (Meetup, Heylo), ticketing (Luma, Partiful), personal premium tiers (Partiful Plus). Best fit for the mission: **local sponsorships** and **paid access for city parks departments**, which often run Walktober.
