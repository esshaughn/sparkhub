# Backlog

Parked work. Newest first. When you pick something up, move it to a branch and delete it here once it ships.

## Joseph on a post-event debrief (voice notes, 2026-10-16)

Two voice notes from Joseph after Stacy's sit-down dinner, about what the app could do *after* an event. Notes only; nothing decided, and Joseph says he's still thinking on it ("I don't want to open too many new tabs").
- **The need, in his words:** we're always on to the next thing and rarely stop to say *that went well, and if not, what could change?* After a big event he never takes a second to appreciate it. Hearing **each person's experience** is the valuable part (people connect and get different things from the same night).
- **What he did:** he sent Stacy a recap voice message (he does this in the car after school drop-off). Stacy valued hearing what each person got out of it.
- **The hard part: it must not feel like a task.** Everyone cares and wants to add to the event, but a feedback form is a chore. Options he floated: a **simplified version** for most people (*Would you do this again? What did you get out of it?*); **a couple of people lead the pack** by sharing first (*I really enjoyed this because…*), which makes others likelier to share; asking whether they want to be **invited to the next one** and whether they're excited for another.
- **The second goal: the host feels appreciated.** Anyone who risks hosting wants to feel they did a good job. A small pat on the back (a thank-you, a voice note, a reply) makes the host likelier to do it again, and gives them confidence for the next (Thanksgiving, Christmas, New Year's). Joseph says it's partly selfish: it inspired him, and he hopes she does more.
- **Teaching it is about reps:** voice notes feel like a lot at first and get easier and more casual (his weekly online check-ins). He notes **not enough events are happening** for the habit to form yet.
- **Track what made it work:** the many small things (who sat where, the pace, room for silence and laughter, structure without too much structure), not only whether people liked it.
- **Already in the app that this touches:** thank-you reactions on a past event (heart, praise, party, thanks, *Let's do it again!*), the lead's post-event *next time* notes (picks and a short note, private to the lead), and the Wrapped and photo-nudge ideas filed on 10-09.
- **Questions for later:** is it a short prompt to everyone who came (*Would you do this again? One thing you loved*) the morning after, shown to the host only or to the group; a voice-note option; a *Say thanks to the host* nudge, separate from feedback; does *I'd come again* feed the *invite me to the next one* list; how does it relate to the lead's private *next time* note and to community memory (what to change next time)?

## Auburn on the direction: friends vs communities, and the nonprofit (2026-10-12)

Not feedback on the current app. It is Auburn's reaction to the direction being worked out: how to split **friends** from **communities**, and the nonprofit plan (We're All Neighbors; see the 2026-10-11 notes). Notes only; nothing decided.
- **Her gut reaction: it started to sound like Meetup.** She said Meetup isn't bad (she made friends through it when she moved to Austin), but the direction felt like it was *missing the point*, and she couldn't say why at first. Her shoulders dropped at the Meetup angle.
- **What she thinks the point is: hyper-local.** What she finds beautiful is that you're a community member of *Walnut Creek* and so you know what's happening *because you live there*, not because you share an interest. A pickleball group in North Austin can be found on Google anywhere; a place-based community feels more like a mission. She doesn't see it as interest-based (my board game group, my pickleball group); those exist already. She asked the owner directly whether that is the point: *we're all neighbors, and I know what's happening because this is where I live*.
- **Her example is the dance troupe:** its members aren't the most obvious group of friends and music brought them together, but *proximity* is what let them make deeper connections and develop more ideas, because they're literally neighbors.
- **Money, her aside (she says her knowledge is limited):** if it ever costs something, cover your bases with a classic *suggested donation*, or a way to apply for a *scholarship* (a lower cost), and different levels of what's free versus paid. She notes that adds administrative load, and that nonprofits can do for-profit things.
- **How it lines up with what's already decided:** the 2026-10-11 notes define a community as a physical place plus a common good, neighborhoods first, with friends using personal lists and private events rather than shared friend groups. Her point supports putting the place at the centre and keeping the friends side separate. It also sharpens two open questions there: whether an interest group with no place anchor (Torrez Fitness) counts as a community, and how much of the friends side the nonprofit should carry.
- **Questions for later:** if place is the point, where does a pickleball or board-game group fit (a list inside a neighbourhood, or outside the nonprofit)? Is a suggested-donation or scholarship model wanted when community tiers are decided?

## See everyone in a group and add them as friends (owner's idea, 2026-10-12)

Notes only, not decided or scheduled. Make it possible, or easier, for group members to see all the other members of their group and quickly add them as friends.
- **Where it stands:** members can already open a group's people list (`group_people()` gives any member the names, photos, roles and join dates, no emails), and a friend request can be sent to anyone you share a group with (`send_friend_request()`, 30 an hour; it makes you friends if they had already asked you). Today the *Add friend* button is on a member's profile (you open the person first, then add), so what's missing is a one-tap add from the list itself. I haven't checked how the list looks or how many taps it takes in the live app.
- **Ideas to explore:** an *Add friend* button on each row of the group's People list; *Add* on a person's profile card; a state per row (*Add* · *Requested* · *Friends*); a way to add several people at once (tick a few, or *Add everyone I know*); a suggestion line after an event (*You and Dee were both at Pickleball night. Add her?*).
- **Questions for later:** whether being added should need approval (today a request does, and a declined one can't be sent again); the 30-an-hour limit if people add many at once; privacy (should a member be able to hide from the list, or from friend requests); how it fits the nonprofit plan, where a version-one community has no shared friend groups and friends use personal lists; and the Block rules (a blocked pair shouldn't see Add).

## Timeline on a plan (owner's idea, 2026-10-10)

Notes only, not decided or scheduled. Needs a Design mockup first.
- **An *Add a timeline* option in Plan an event, under the event description.** Each entry has a **time**, a **title** and a small **description**. A first version could be **time and title only**, with the description optional or added later.
- **For Design to explore:** where it sits on the one-page create form and on the plan page (a collapsed *Add a timeline* row that opens entries), how entries are added and reordered, and how it reads to guests (a simple schedule list: *6:00 Doors · 6:30 Potluck · 7:30 Games*).
- **Questions for later:** whether it works with multi-day events (entries per day), whether a change to an entry notifies people going (the *Send an update* path exists), whether the lead's co-leads can edit it, and how it differs from sign-up jobs that have their own times (a job with a time vs a timeline entry).

## Stacy's two notes (2026-10-10)

Notes only, not decided or scheduled.
- **A private scratchpad before posting an idea.** Even a title feels intimidating: people will see it. She wants a journal-style place to collect your own ideas in the moment that stays completely private, and converts easily into an idea or a plan when you're ready (never before). Related: the build already has *Save draft* on the float sheet (needs a title), private ideas, and `event_drafts` (one JSON row per draft, 20 max, only its owner can read). Questions for later: where it lives (Me, or a first step on *+*), whether a note can be a single line with no title, how it syncs across devices, whether it reminds you, and whether *Share with one friend first* is wanted.
- **Photos: private to the group, with consent for reuse.** Encourage people to upload their photos for an event and maybe tag others, but it must feel private to the group. Add a consent choice: these can be used in the year-end Wrapped; these can be used to market other events (and the default means doing nothing). Notes: the photo reel in Wrapped and photo nudges are already filed (*Filed from chat 2026-10-09*). Questions for later: Wrapped as opt-out and marketing as opt-in per photo; a person's default in Me (*Photos I'm in*); a tagged person approves before a photo shows on their page or in Wrapped, and can untag; people in a photo who aren't the uploader also matter for marketing use; the privacy page and the store's content rules (reporting a photo, blocking) both apply.

## Community memory and playbooks (owner's notes, 2026-10-09)

Thinking only, not scheduled. The owner wants Spark Hub to get smarter as a community uses it, so each event is easier to set up than the last, quietly and optionally. Not AI: counting and recency.

**Decided (owner, 2026-10-09):** playbooks are **shared between groups** (a group can publish one, like *Torrez's Pickleball Night*, and another can borrow it); **no AI for now**; and a group with little history for an event type starts from **both its own history and a shared playbook, its own history first** (the shared playbook fills in what the group hasn't done).

- **Three layers of memory:** you (your habits), your group (how this community does things; the one to start with), everyone (anonymous patterns across groups, only when at least three groups show the same pattern; never names, guest phones or private events).
- **A ladder of cleverness:** copy last time (*Do it again* exists) → recall by event type (place, time, description, sign-ups) → patterns across several (the usual spot count, typical day, lead time) → outcomes (what filled, what sat empty, who came versus who said Going) → people (*Roxy brought candles twice; ask her?*, linked to the gifts card and resource library).
- **How it shows up, quietly:** chips and ghost text at the point of need (*Last time: bring extra paddles · set up the net*), never pop-ups; at most three, shown after a pattern appears twice; always dismissible (and a dismissal teaches); show where it came from (*from your last 3 pickleball nights*). A **Start from…** entry on the first create screen (*Pumpkin Night · Pickleball · Potluck*), the biggest win for first-time leads.
- **Learning without forms:** by-products of use, plus one optional post-event *Anything to change for next time?* (*more chairs · start earlier · fewer jobs*), and a group page of *our usual* that leads can star.
- **Cold start:** starter playbooks written from real events (potluck, walk, game night, chili cook-off, Halloween walk); the group's own history takes over once it has some. The *Walktober templates* idea in the market-review section, grown up.
- **Start recording now** (cheap now, impossible to rebuild later): when each sign-up was claimed (time-to-fill); who came and the final count (exists); a normalized event type per event; why an event was cancelled and what the lead changed after posting; the optional *next time* note.
- **Risks:** small groups have thin history; stale suggestions entrench habits (weight recent events, let people edit); too many suggestions feels like nagging; success is the **share of events started from memory** and less typing per post, not how clever it looks.

## Build-only fixes: no Design needed (filed 2026-10-09)

Pulled out of the Steven and Joseph section below so they can go straight to a build session. First check each on the live app (some may already be fixed).
1. **Add to calendar on Android** downloads an .ics file instead of opening the calendar. Ask whether it can go straight into Google Calendar. On Joseph's iPhone, Apple's own sheet confused him (the blue checkmark didn't add, *Add to Calendar* at the bottom did): check which kind of event file we send and whether we can make it open straight to the add screen.
2. **Discussion comments didn't show until the owner restarted the app** *Can't reproduce, 2026-10-10: the discussion and idea-collaboration specs pass on a local database (your own comment shows at once, others' show by themselves and after a refresh). Not tried on an installed iPhone, where the app has its own storage.*  (he couldn't see a comment he'd just made). Reproduce: post a comment, see if it appears without a restart; check the comments load and the cache.
3. **Picking a date on an idea didn't update the page** *Can't reproduce, 2026-10-10: with two people on one idea and no reloads, a suggested date and a lead's pick both updated the other person's open page ("Lena picked it"). Not tried on an installed iPhone.*  (the header still said *When · Suggest a date* until a refresh; Joseph's view didn't update either). Check the idea page refreshes after a pick, for the picker and for everyone else.

## Filed from chat 2026-10-09: sessions with Steven and Joseph, Auburn, Stacy, and the owner's own ideas

All notes, none decided or scheduled unless marked. Lessons are in LEARNINGS.md (*What the pilot says*). Check each against the current build before starting: several things shipped after these sessions (see the git log).

**Steven and Joseph's session (2026-10-06)**
- **RSVP buttons change your answer when you only wanted to see who's going.** Joseph, Steven and Stacy all did it. The owner's fix: take the counts off *Going* / *Maybe* and show who's going separately; after answering, collapse to *You're going · Change* (built 2026-10-06; check the counts are off the buttons).
- **Picking a date on an idea didn't update the page** *Can't reproduce, 2026-10-10: with two people on one idea and no reloads, a suggested date and a lead's pick both updated the other person's open page ("Lena picked it"). Not tried on an installed iPhone.*  (the header still said *When · Suggest a date* until a refresh; Joseph's view didn't update either). Check it's fixed.
- **Discussion comments didn't show for the owner until he restarted the app.** *Can't reproduce, 2026-10-10: the discussion and idea-collaboration specs pass on a local database (your own comment shows at once, others' show by themselves and after a refresh). Not tried on an installed iPhone, where the app has its own storage.*
- **Add to calendar:** Android downloads an .ics file (Steven suggested asking whether it can go straight into Google Calendar); on Joseph's iPhone Apple's sheet confused him (the blue checkmark didn't add, *Add to Calendar* at the bottom did): check what kind of event file the app sends.
- **Location search (Geoapify) was glitchy when typing** (moved to Google Places 2026-10-09).
- **"The swipe thing"** the owner said he must fix (not described in the recording; ask).
- **Text size:** date labels (*Friday 9*, *Tuesday*) and titles in empty boxes are too small; Steven's eye goes month → divider → title → date. Both like the big photo but want the date, what it is and *Going* without scrolling.
- **A summary at the top of the event page** (*4 discussions · 3 jobs need help · 1 vote*) so people find where to take part; Discussion sits at the bottom.
- **"Make a plan" doesn't feel real** (Joseph, Auburn, then Steven): idea → event → past; wording like *Create the event* or *Lock it in*. Three people said it.
- **Following an idea:** Joseph wasn't told when TJ became interested (only the lead hears). A toggle to follow ideas you're interested in; Steven's caution: with 50 people that's a lot of notifications.
- **Date narrowing** is in the Ideas audit section below.
- **An ideas quota and support others** (Steven): e.g. 3 ideas a week, or fewer after 3 successful events, with a nudge to support someone else's (*these 3 people have never posted an idea*). The owner's measure of success: more people leading things.
- **The moment to watch:** a week before, the lead thinks *I don't have my stuff together*. Remind both the lead and the co-lead a few days before and when nothing has moved; a short checklist three days out.
- **Money question:** a deck of cards ~ $20 a person; Steven suggested *How much would you chip in?* (a question, not payments; LEARNINGS says no payments).
- **Later:** a heat-map grid for dates, a private "my availability" calendar the app can check without showing others (Steven: misuse risk in big groups), and Steven's caution not to solve scheduling: find the minimum a lead needs.

**Auburn's session (2026-10-06)**
- **Group picker:** a group was pre-selected and she couldn't remove it (fixed: *Post to* picks none by default).
- **Date/time pop-ups glitchy and the page scroll jumped** on the one-page *Plan an event*; she'd type times (*7* → *7:00 am · 7:30 am · 7:00 pm*) (typed in place since 2026-10-07; check).
- **The invite pop-up appeared right after posting**: too aggressive.
- **Unclear on the float path:** *Who leads it?* (what it means for her); *Talk it through* feels like a big ask: try *Open to feedback* or *Open to ideas*, or comments on ideas so a thought partner rises from the discussion; she typed a task instead of the description.
- **Urgent vs nice-to-have tasks** (from her egg-hunt doc): only urgent ones nag the lead and show in the task list; the rest stay on the event, with a toggle.
- **Inviting people who aren't on the app:** *so I have to text everybody?* Today it's a link or QR code; she'd expect email (against the no-email rule).
- **Ask someone:** limited to two with an *I thought of you because…* line; Jeni felt a larger group is safer (see Jeni's section).

**Stacy's session (2026-10-06)**
- **When is an idea "happening"?** She asked: when does it hit critical mass, and how can I help it get there? Show progress toward happening plainly (the incubator) and make *share with a friend* a way to help.
- **Plan an event as one page**, like Partiful (built); the overview right under the title; drop *Quick details* for now (done: description 500).
- **Sign-up section naming:** *Claim a time / seat* confusing; *Join in* reads as intensity; she prefers *Participate* or *Contribute*; *Help out* is fine; she first thought she was signing up herself (frame as *What do you want guests to sign up for?*). (Now called *Sign up*; check the framing.)
- **Naming:** *Lists* didn't mean anything; she suggested *communities* with *groups* inside.
- **Moderation:** how does someone get into *Hub on Hunters*? Owners and admins control the invite link; the owner won't build group-wide messaging because he'd then moderate everyone's posts (Joseph pushes the other way).
- **Month view with a linked list:** the grid on top and a scrolling list of the whole month under it; scrolling the list moves the highlighted day, tapping a day jumps the list, scrolling past the month moves the grid to the next. (Stacy: she uses Google Calendar on monthly.) Open: skip empty days, shrink the grid to a week row while scrolling, pencilled-in idea dates in the list.
- **Creating events is "a laptop activity"** for her: supports the computer-as-web-page direction.
- **The owner's own notes:** Calendar and Ideas are definitely main tabs; Groups and Friends maybe not; Me as a command centre with a year in review; the sparkles where there's magic; a *resource library* (logged below).

**Owner's ideas and brainstorms from chat**
- **Idea decay, "fan the spark"** (owner, from the Claude audit's item 6: *floated ideas can die unseen*): ideas carry heat that fades; real steps add it back; the board sorts by heat and rests ideas that go cold, without deleting them.
  - **States:** New (first 7 days), Glowing, Cooling (~14 days without a real step, small ember), Embers (a countdown, last week), Resting (~30 days; off the board, kept on a *Resting ideas* shelf; anyone can rekindle).
  - **Big steps reset the clock** (a lead or co-lead, a window or date, a poll, a place, a job); small steps add a few days (a new interested person, a vote, someone else's comment). *Keep it going* (the starter, lead or co-lead) adds 14 days, once without other progress.
  - **Everyone shares responsibility:** each person sees one next step for them (starter: set a rough window; thought partner: the same; interested: vote or bring a friend; anyone: *Fan this spark*). A thought partner is prompted at the third interested person.
  - **Safety nets in widening rings:** starter and co-lead, then the interested, then a *Could use a spark* lane and opted-in champions, then one weekly group digest (never one per idea), then a kind note when it rests. At most one nudge per idea per person per week.
  - **Numbers to argue with:** 7 / 14 / 7 / 30 days; the audit suggested ~60 days to archive; an idea with a window rests the day after it closes.
  - **Builds on:** soft holds (7-day, *Keep holding*), the daily push job, one-nudge-then-replace notes. Fits LEARNINGS' *slow and digest-first* rule.
- **Photo nudges and a year-end Wrapped** (owner, with Joseph's idea):
  - **During the event:** one push to everyone Going partway through: *📸 Snap a photo of {event} and add it here* (opens the album, camera ready). Skip test events; for events without an end time, send an hour after the start.
  - **After:** next morning, only to people who came and haven't added a photo; a slightly different version for leads.
  - **Wrapped:** for a group (*{Group}'s 2026*: events, people who came, first-time leads, the most-loved event, the busiest month, a photo reel) and per person (attended, helped, led, your photos); shareable as a card.
  - **Open:** let people keep their photos out of Wrapped; a way to turn off photo nudges; December or each group's anniversary.
- **One-way announcements** (owner, from the chat discussion): the lead's *Send everyone an update* shown as an *Updates* strip on the event page, a composer with quick-start chips (*Running late · We're here: ___ · Moved to ___ · Cancelled*) and a *Going* / *Going and Maybe* choice; optional *👍 Got it*; test events don't push. Joseph says one-way blasts may not be worth it without replies: lean is this plus a chat link on the event (lead pastes a WhatsApp or group-text link, shown to people Going; no phone numbers). Full event chat is a later version (the rules and Supabase limits are in the chat notes in LEARNINGS.md's conflicts line).
- **Early access, then public** (owner, lower priority): keep an event private for a set time (3, 5 or 7 days) to a chosen list for first dibs, then it opens to the group automatically; people see a countdown. Pairs with limited spots. And **private friend lists** (*core friends*, *poker night*) for inviting or early access.
- **Basic vs organizer** (owner's idea): don't make people skip complicated steps: a quick path (what, when, where, group) with *Set up more ›*, and an organizer panel on the event after posting (jobs, sign-ups, chat, early access, polls). Related to the idea/plan choice already on the first screen.
- **Event cards:** *6 spots left* vs *RSVP* wording is filed below; **Post to** title *choose all* is filed below.
- **Tab bar and Me:** reorganization briefs (A: five questions; B: group first) were sent to Design; Joseph likes the Groups page (it feels like belonging) and dislikes Tasks; see the reorganization section further down. *Start here* stays parked.

## Resource library and asset-based community development (owner's notes, 2026-10-08)

Not decided, not scheduled. The owner wants asset-based community development (ABCD) infused more deeply, and has talked about a **resource library**: a shorthand list of what people can offer (*10 electric candles*, *a truck anyone can use*, a yard, a skill). Brainstorm in chat 2026-10-08; fuller ideas are in LEARNINGS.md's pilot section (Jeni's helper pool, skills to give and get, Roxy's curtains and candles, the lawnmower).

- **Shape (lean):** one short card per offer, structured, no open text feed: *what* · *how many* · *who* · *the group(s) it's shown to* · optional *when it's free*. A skill is the same card (*Teach knitting · Thursdays*).
- **Where it shows:** a group's *What we have* page; as **suggestions when a lead adds a sign-up** (*Roxy has electric candles. Ask?*); and as spaces in the location field (*Jeni's yard*).
- **Connected ideas:** a three-tap gifts card on Me (hands · head · heart, chips not text); *What do you already have for this?* when floating an idea; a language pass off deficit words (*Needs help* → *Ways to pitch in*); recognizing connectors (people who bring others in); *gifts given* in Wrapped.
- **Cautions:** keep offers inside a person's groups; no leaderboards or points; lending carries risk (the app only connects people); stay clear of LEARNINGS' *Don't build: neighbourhood feed* by keeping offers as cards tied to groups and events, without comments.
- **Open:** who can edit a group's list (anyone for their own items?), whether an item can be *reserved* for an event (and released after), and where it lives in the tab bar (a group page section first).

## Discussion: comment layout, emoji, likes (owner, 2026-10-08)

From a screenshot of a comment thread (Carmen's comment with Eric's reply under it):
- **Spacing:** the top-level comment sits too high; center it in the space between the top of the thread and the Reply / Hide replies / Delete row (more room above it, less crowding against its reply).
- **Emoji:** add a way to put emoji in a comment (an emoji button by the box, or the phone's emoji keyboard made easy to reach). Emoji already display fine in comments.
- **GIFs, eventually** (owner): not now. Notes for later: a GIF picker means a third-party service (Giphy or Tenor; check current terms and pricing, since Tenor's API has been winding down), a CSP change in `vercel.json` for its images, and a content-safety setting (G-rated only). A group-moderation question comes with it: leads can already delete a comment, so that covers removal.
- **A like button** on comments (a heart or thumbs-up with a small count, tap again to undo). Check the Kevin rule about minimizing free-text drama first; likes are a light reply that needs no words. Likes would be a new table with the same visibility rules as comments, and a quiet push or none at all (decide).

## Event cards: "6 spots left" reads like an RSVP cap (owner, 2026-10-08)

Woodcliff Halloween's card in the list reads *6 spots left · 1 going* · RSVP. The owner thinks *spots left* counts open sign-ups (jobs), but beside *going* and RSVP it reads as a limit on how many can come. Decide what's most useful on a card, or show one or the other by case: e.g. a capped event (Take part seats, a size limit) → *6 spots left*; open sign-ups → *Needs help · 6* or *6 ways to help*; neither → just *N going*. Same card also shows *Austin, TX 78…* (the address-shortening item in the Plan an event list below).

## Plan an event page: owner's polish list (2026-10-07)

**Location**
- Name and address reported glitchy or **swapped** (someone's report). Audit how the pick fills `spot` vs `spot_address`.
- **The suggestions drop-down isn't on the one-page form yet.** Geoapify is still on (key in `js/config.js`), but the owner isn't happy with its results.
- **No pop-up for location:** tap the field and type. Typing an address should find it (ideally filling the place name, e.g. *Activate*); the name is an optional extra (*Add a name for the place*). Research what Partiful / Luma / Apple Invites do first.
- **List view shows only the place name or street**, never city, state and ZIP. Standardize how an address is stored and shortened.
- The Add location pop-up's layout looks off (moot if the pop-up goes).

**Date and time**
- **Type it in place, no pop-up** (Auburn also expected to type: "7" → *7:00 am · 7:30 am · 7:00 pm*).

**Post to pop-up** (owner, 2026-10-08): the title should say you can pick several, e.g. *Post to · choose all that apply* (owner's words: "choose all"). Today it reads just *Post to* over round radio-style circles, which look single-choice.

**Copy and look**
- *Optional* tags: lighter gray.
- The description field under *What's the plan?* can be taller.
- The page is washed out (white and gray everywhere): hard to see what's what. Example filler text in empty fields (e.g. under *What you need*).
- Public / Private is fine; tidy it.

**Add a sign-up**
- The pop-up looks good. *Write your own* can go now that the chips cover it (owner to confirm).
- **Example filler on the empty sign-ups section** (owner): show what a sign-up looks like before any are added, e.g. *Bring a carton of eggs · Help set up the tent · 3 spots*, so people see how ways to help or take part work.
- Shorten or drop the helper lines (*Most per person*, *People can sign up for as many as they like*, *First in line gets the next open spot*, *People without an account with a name and phone*).

## Ideas section: owner's audit list for 2026-10-08

From the owner using the idea page (2026-10-07). Investigate first; some may be bugs, some design.

**Bugs to look into**
- **Keep holding does nothing.** The voting card reads *Holding until Wednesday, October 14 · Keep holding*; tapping it has no visible effect. Audit: does the renewal save, does the date move, does the UI refresh?
- **Can't set or edit a location.** *Where → Change* only lets you pick from suggested places; you can't add your own or edit a suggestion. (*When → Edit* does let you add a date.) Both should allow your own entry and editing a suggestion.
- **The idea's description is cut off** on the idea page, though the whole text was entered (and the limit felt short anyway). The edit box shows more than the page does; maybe smaller text on the page so the whole overview fits.
- **Date: start rough, narrow down** (owner, 2026-10-07; from Steven and Joseph's session 2026-10-06). Under Date in Plan an event (and the float sheet): **Set a date** plus **More options ›**, opening one sheet: pick a date · poll a few dates · start rough (a window like *by end of October*, then broad chips: weeknights / weekend days / weekend evenings, maybe AM/PM or days of the week). Brainstorm and lean in chat 2026-10-07.

**Design / clarity**
- **Date votes look like buttons that cast a vote,** same problem as the RSVP counts: people tap the count to see who can go. Move the *N can go* out of the buttons, keep a separate tap to see who (like See all on RSVPs). **See votes** exists but is easy to miss: make it louder, with faces.
- **Who leads it? *I'll decide* vs *me*** is confusing (lower priority).
- **Lead, step back and hand off are scattered.** *Leads* and the hand-off live in different places; *Post to {group}* is mixed in with them. Group the lead controls under *Who leads it* (or reorganize), and give *Post to* its own spot. Related: the owner's *You're leading · Change* sheet (hand off to co-lead / someone else / step back / quiet Cancel the event, one sheet whose content steps forward to the cancel confirm, no stacked pop-ups), spec'd in chat 2026-10-07; open: suggest a hand-off when the lead taps Can't, and whether hand-off/step back stay in the Leads sheet too.
- **"Make this a plan"** card: rename, e.g. *Turn this into a plan*, or frame it as what's left: *What we need* / *Remaining*.

## Link previews in iMessage (2026-10-06)

Steven shared Magic and Mocktails (`/e/yjhfy4jx`) in the Torrez group text.
- **What iMessage shows:** the photo, the title and the domain only. It drops `og:description`, which is where *{day} · {place}* lives. On unknown senders it shows *Click to Load Preview* until tapped (Apple privacy; nothing to fix).
- **Shipped (717b73a, live):** `/e/` previews put the date in the title (*🪄Magic and Mocktails – Thu, Oct 22*), as `/i/` links already did. `api/preview.js` → `details()`.
- **Open: different titles for ideas and plans** (owner asked; wording not chosen). Ideas can have a date while still being ideas (Magic and Mocktails shows IDEA but has Thu, Oct 22), so readers can't tell a settled plan from a proposed date. Options put to the owner:
  - Ideas: *Idea: {title} – {date}?* · *{title} – who's in?* · *💡 {title} · Idea for {date}*
  - Plans: keep *{title} – {date}* · add the time · *You're invited: {title} – {date}*
  - Build: `event_preview()` doesn't return `planned` yet. Add it in a migration (as `link_preview()` does), then branch the title in `details()`. iMessage caches a preview when the message is sent, so only new shares change.

## Owner's notes (2026-10-05)

- **Remove the Add to Home Screen pop-up on Welcome** (owner: nobody looks at it). Today it shows on Welcome once a visit, and leaving Welcome for a group page brings it up 1.2s later (`js/sparks.js` ~1175 and ~4690, `installPop`). The owner named the Welcome one; check with him whether the once-after-sign-in pop-up goes too. Keep the dismissible *Add Spark Hub to your home screen* alert (~7169) and the steps in Notification settings, since web push on iPhone needs the home-screen app.
- **Chip in to cover the platform** (idea, not decided). A plain, honest way for people who enjoy Spark Hub to help pay for it, like small-scale backers:
  - **A Chip in space on the Me page** (Profile today).
  - **An occasional pop-up** (*Enjoying Spark Hub? Chip in to cover the costs*), rare and easy to dismiss.
  - **A transparent costs page:** what it costs per month today, line by line (hosting, database, domain, notifications…), and what it would cost to grow (owner's rough range: about $125 a month now, up to about $500 a month as it grows). Real numbers to be filled in from the actual bills.
  - Open: payment provider (Stripe Payment Link, Buy Me a Coffee, Open Collective…), one-off vs monthly, whether chipping in shows anywhere (a thank-you, a badge) or stays private, and how often the pop-up may appear. Payments mean a provider account the owner sets up himself.

## Jeni Wade's demo (2026-10-05)

First demo of this version to someone new (owner's transcript). Lessons in LEARNINGS.md (*What the pilot says*). Not decided by the owner yet unless marked.

**Bigger, for Design or later:**
- **Float path asks differently from the lead path:** *Do you have a date in mind?* (yes / no) before the date picker; a heading like *Start the path* with *Pick a date · Poll the group · Decide later*; details as a free prompt (*throw out whatever comes to mind*, a few sentences) instead of three 60-character bits, which made her doubt herself (Joseph likes the limits: keep them on plans).
- **The floater stays the gatekeeper without being called lead:** others can *ask to lead* and she says yes or no (a different vision → "go start your own"). A thought partner is wanted by default. Being called *lead* makes her hold back.
- **"Incubator"** as the name/metaphor for the idea state (pieces in place → it hatches → *Make it a plan*). Also a third state: *I'll lead it if N people commit* (Joseph's poker night).
- **Ask more than two:** *Ask two people first* / two-at-a-time felt like pressure on individuals; a group ask feels safer (people see each other sign up and sort it out). Middle ground: *Ask a few* (up to ~5–8, each told it went to a handful); later an event **team thread**. Conflicts with the two-at-a-time design (Cynthia's demo).
- **Contact the lead:** a question before taking a task. Cheap version: the lead can add *Questions? Text {name}* (a contact line or text link) to the event.
- **Kid- and family-friendly** symbol and filter ("putting on hats", Stacy's phrase), including kid-friendly ways to help out.
- **Tasks: she likes it** (everything she signed up for, the timeline, her own reminders, *ping me 3 weeks before*). With Joseph's dislike: keep the task view, move it into **Me** as a command centre (drafts, ideas, tasks), and give the main tabs to the fun.
- **Later arm:** a general helper pool (*I'm your errand boy*: get asked for small tasks across events without RSVPing), skills to give and get (the hub's bulletin board; *teach me and Julian to knit*), projects and help-a-neighbour (meal trains, Buy Nothing). Owner: "a whole other arm that's very exciting to me."
- **Install friction:** after Add to Home Screen she had to sign in again (the home-screen app keeps its own sign-in on iPhone), then turn on notifications. Part of the Add to Home Screen usability pass.

## Joseph's feedback on the reorganization (2026-10-04 – 10-05)

From his reactions to today's screens and mockup C. Lessons are in LEARNINGS.md (*What the pilot says*). Not decided by the owner yet unless marked.

- **The Tasks tab isn't landing** (fourth time). The badge saying he has things to do stresses him out. What he likes is the drop-down on each event card (*Leading · 2 tasks ⌄*). **His ideal tabs: Calendar · Ideas · Groups (friends and what they're going to; maybe not its own tab) · Me.** Close to Structure C (Sparks and plans) with to-dos living on each event.
- **Urgency that builds for leads:** open tasks on the event, colour-coded and more urgent as the date gets close; a heads-up push when something still isn't covered near the day.
- **"No longer needed" on a job:** the lead can cross off a job nobody took ("I'll set up the chairs myself"), so it stops nagging. Today the only way is deleting the job.
- **Volunteers get a reminder as their job approaches,** and that's all. Hosts see the production; everyone else sees the fun.
- **Ideas page, checked daily:** "what did someone post today?", tap *I'm in* on *outdoor movie night on Fridays*, and that gives the poster the confidence to host. Wants it more up front. Fix first: **Have an idea** on Your tasks opens the full Start an event (he expected a light idea). Brief 1 (*Share an idea*, two doors) and the Mad Libs post cover this.
- **Messaging:** a full two-way chat is a later version; one-way blasts alone may not be worth it ("I'm here" with no "running late" back). Lean: a chat link on the event plus bringing back *Send everyone an update*.
- **Launch:** Torrez is forgiving; Woodcliff neighbours are hard to win, "semi one chance." Readiness before Woodcliff: one-word tab labels, the Have an idea fix, a group QR code (Brief 2), the Add to Home Screen usability pass, Woodcliff seeded with real events.
- **Magic & Mocktails** (TJ, 8 seats): a live test of handing a lead to a nervous first-timer (*Hand it to someone*) and of seats via a job until *Take part* exists. Worth watching how it goes.

## From the build (2026-10-03)

- **Ask someone to take a job, on jobs with shifts.** Built for single jobs only; a shift job's task row says Share and opens the share sheet instead. Needs a pick-a-shift step in the ask (or ask for the whole job, the person picks the shift on I'm in).
- **The TEST project's size.** It's a free nano instance (~400 MB) and swaps under busy test nights (2026-10-02: three restarts' worth). CI now runs 2 at a time and full runs once per batch. If that's not enough, moving the `sparkhub-test` organization to Pro ($25/month) gives it 1 GB.

## Welcome tour (parked 2026-10-03)

The owner's intro walkthrough: 5–8 simple slides in his voice (who he is and why he made it, ideas becoming plans, nobody doing it alone, the prototype disclaimers, what he's asking, where things are), replayable from Profile → Help & info. Brainstorm and draft copy in `WELCOME-TOUR-for-design.md` (HANDOFF §5 Q26). Tagged for later by the owner; not for Design or the build until he picks it up.

## Joseph and Cynthia's feedback (logged 2026-10-03)

From watching them use the live app. Order is the build's suggested priority (owner hasn't picked yet). Design questions are in HANDOFF §5 #24.

**Do first (they did the wrong thing):**
- **Invite: people didn't know it was sent** (Cynthia). After picking people in Invite, she thought she still had to send through one of the share buttons at the bottom (Messages, Email, WhatsApp, More) and tapped one. She didn't realise the app had already invited them. Needs a clear *Invited ✓* moment, with the share buttons labelled as extras (e.g. *Also share the link*).
- **Opening screens, decided by the owner 2026-10-03:** (1) the Calendar remembers the last group filter, and a new member starts on the group they joined; the header and chip name the group when it's one (today the chip says *1 group* while the header still says *All events from your 4 groups*); (2) **Start here** on the Calendar, Your schedule and any group page, saved to the account and counted so we learn which view people pick (needs Design, with a header that collapses on group pages); (3) **parked for later (owner, 2026-10-03), don't start it:** Your tasks becomes **one to-do feed** in due-date order, with ideas you lead in their own section and nothing undated in a date row (addendum A2 without the carousel, plus B1/B2). Your schedule stays the "what's coming up for me" view. Note: the addendum's §A wrongly says Your tasks is the opening screen; the Calendar is (#90).
- **New tab bar (owner, 2026-10-03): built and live 2026-10-03** (Design's Update 16, `10a4b2c`): Explore · Your tasks · Your calendar (the opening screen) · Groups · Profile, with a group pick per screen. *Start here* stays parked.
- **Calendar ignores "my group"** (Joseph). It opens on all 3 groups combined; he filters down to Torrez Fitness every time. Quick fix: remember the last filter, or open on the main group. Bigger idea: let people choose their own home screen (for now or for good) and watch which ones they pick, almost like A/B testing, to learn which view matters most.
- **Helper chips put the thought in the wrong field** (Cynthia). She liked the chips, but *Bring* fills the job title with "Bring " and her instinct was to finish it in the description, not the title. Rework the job pop-up (e.g. *Bring what?* with the field focused right after the verb, or the chip as a label and the field for the thing).
- **Skipping help should feel normal** (Joseph). Some events need no helpers; *Decide later* on How people can help reads like a tab left open. Make *No help needed* the obvious, equal answer, and rethink *Decide later* on that step.

**Do next:**
- **Add to Home Screen instructions**: usability pass on real phones; maybe a short video. Matters more than it looks: web push only works from the home-screen app.
- **Event links don't need the group** (Joseph didn't know). You can send one event's link to someone outside the group. Say so where you share (*Anyone with the link can see this event and reply*).

**Later:**
- **Group header takes too much room** (Joseph): smaller photo; maybe it collapses or drops down, or the group's menu moves to a sidebar.
- **Per-event chat for on-the-day changes** (Joseph): *We're meeting here*, *plans changed*. A lighter first step: the lead posts an update that pushes to everyone going.
- ~~Jobs still to fill as a lead's task~~ (Joseph): already built 2026-10-02 (HANDOFF row 15).

## Soft holds on the Calendar while a date poll is open (parked 2026-10-02)

Today the Calendar shows only locked-in plans, so the dates in an open poll are invisible: another lead can schedule on top of them and members don't know to keep them free. Polls also have no end date. Owner's calls (2026-10-02): **polls only** (no free-standing holds, no single "probably the 24th" hold), holds last **7 days**, and **every option shows** (not just the leading two).

- **A hold is a by-product of a date poll.** Each date option of an open poll shows on the Calendar (List, Tiles, Month) as a pencilled-in entry: dashed, labelled something like *Maybe · voting*; tapping it opens the idea's vote. Nobody creates or removes a hold by hand. Seen by whoever can see the idea.
- **It ends on its own.** When the lead picks, the winner becomes the plan and the other holds go. Otherwise the holds come off the Calendar 7 days after the poll opened; an option whose date has passed drops off sooner. The idea and its poll stay (*let it rest*, not deletion; see LEARNINGS.md on fading).
- **Keep holding**: the lead can renew for another 7 days.
- **Reminders go to the lead only**: one push once enough votes are in (*6 voted, Saturday leads. Lock it in?*) and one the day before the holds lapse. Both fit the daily `push-daily` job; skip test and demo events as usual.
- **Soft means it never blocks.** Creating an event on a held date shows a heads-up (*Book club is holding this evening, voting until Thursday*) and lets the host carry on.
- **No Add to calendar on a hold** (we can't take an entry back off someone's phone).
- **Decided 2026-10-02 (walk-through):** the lead's first nudge comes once one date has 3+ votes and more than any other; Month shows a dashed ring on each held day; holds show on the Calendar tab and the group's own page (not Your schedule); a hold you voted for shows a tick and *You voted*. Full brief for Design: `SOFT-HOLDS-for-design.md`.
- Build notes: needs a hold-until date on the poll (a migration, so a big change: full run), the Calendar's item list to include open polls' options, and a design for the pencilled-in entry (ask Design or add to HANDOFF §2). Waiting on Design for the look (the brief's §6).

## Market review: cheap changes not built yet (parked 2026-10-01)

From *Where Spark Hub Fits* (see LEARNINGS.md for the reasoning and what's already built):

- **Weekly digest** (*3 ideas need one more person · 2 plans need help*). The review suggests email; that's against the owner's no-email call, so first ask whether to do it as a one-tap *Copy this week's digest* for the group chat, a weekly web push, or email after all.
- **Share to the group chat** on every idea and plan, for every member, not only in the host's Invite sheet.
- **I'll come if it happens** as a firmer interest that counts toward People, next to a lighter *Curious*.
- **Ladder nudges**: after you came to one, *The next one needs a helper*; after two jobs, *Want to co-host?*; make *Ask someone by name* the main button.
- **Walktober templates** on Create event: *Morning loop around ___*, *Dog walk*, *Stroller walk*, *History walk*.

## Turning guests into members: decided against (owner, 2026-10-07)

Guests aren't pushed from an event into a group: no *Join {group} too?* when a guest signs up from an event, no *{Group} plans things like this… Join to see what else is coming up* line, and no sign-in nudge on ideas. Events stay private: an event link shows that one event only.
