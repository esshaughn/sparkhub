# Spark Hub v7 — Update 15 (read after UPDATE_14.md)

New design file: `Spark Hub App Version 7.dc.html` (Version 6 + everything below). Covers the HANDOFF-to-design.md §2 “Things the build had to invent” that weren't designed yet, plus the 13a decision.

## Event and idea pages
- **Event preview slide-up (13a):** tapping an event on the Calendar opens a sheet: 190px photo peek, group, title, *Led by*, date · time and location box, faces + *N going*, Going · Maybe · Can't (lead sees *You're leading this.*), **See the full event ›**. Tweak: *Calendar opens the event preview*.
- **Can help** chip (`#f3f1fe`, purple 12px/800) after a name in Who's interested on ideas.
- **Tell everyone going** switch (`#f4f5f7` row) in the lead's Edit pop-ups when someone has replied: *On: they get an update when you save* / *Off: it saves quietly*.
- **Turn it back into an idea** (red link under Save in a plan's Date, time & location). Clearing the date greys Save with the amber *A plan needs a date…* line. Confirm: *Turn it back into an idea?* · **Back to an idea** / *Keep the plan*.
- **Make it a plan** copy: *It has a date. Make it a plan, and …*; the confirm adds *It goes on the calendar.*
- **How many do you need?** row with − n + stepper in the idea's Details pop-up (lead): *Optional* / *It's a go once N people are in.* + **No minimum**.
- **People going can invite friends** switch in Who can see it (row 109 wording): *On: they can pick friends and group members to invite* / *Off: only leads and admins pick who to invite. Anyone can still share the link.*
- **Who's on each job:** the lead sees one row per sign-up (26px face, name, shift time, note in quotes); everyone else sees up to four faces and *Ana, Ben and 2 more*.
- **RSVP as a guest** replaces *Your info*.

## Bell
- **Phone notifications card** at the top: *Get these on your phone* + **Turn on notifications**, ✕ = Not now. iPhone Safari version has the Home Screen steps and no button. Tweak: *Phone notifications card* (ask / iphone / on).
- **Came-down notes** (Updates, red **!** badge, lead's face): *{event} is off. {lead} took it down.* / *“{job}” is off the list for {event}.* Tapping only marks read.

## People and groups
- **Members:** **Remove and block** red pill beside Remove from group, with its confirm; **BLOCKED** list with **Unblock** for admins.
- **Edit group:** owners get **Get a new invite link** under Copy.
- **Add people:** *Start a group* subtitle *For a team, a block, a crew*; quiet **Get a new friend link** at the bottom.
- **Friends empty state:** *No friends here yet* card + **Add a friend** (sample data off).
- Friends tiles now use the person's pastel (74).
- **Couldn't load your groups and events** card (Data state = offline) now also on Your tasks and Your schedule.

## Fixed
- A typo from Update 14's face pass broke the Who's going sheet (`Stringthis.ini`). Fixed in Version 6, the v6-14 copy and Version 7.

## Added in the second pass
- **Who's coming** (lead, row 109 title): *N going ›* opens *Who's coming* with GOING / MAYBE / CAN'T sections (green / amber / gray), 32px faces, gray **Guest** chip; nobody yet: *Nobody has replied yet. Share the link to get the word out.*
- **Help out, no jobs, lead** (80): dashed box *Add ways people can help.* → Edit what you need.
- **Edit what you need** with sign-ups: Add a shift / Use one time instead give way to *People are signed up, so it can't be split into shifts.* (or *…go back to one time.*).
- **Pick** on a past poll date: toast *That date has passed. Pick another, or set a new date.*
- **Who can see it:** tapping the home row toasts *{group} is its home now*; with 2+ groups ticked, *The home group's admins can edit or delete it.*
- **Bell new posts** (32): *New: {event}* / *New idea: {idea}* with *{Lead} is leading · date* / *{Lead} is floating it* under it.
- **Invite friends toast** (61): *Invited Marisol to {event}. Darnell's already going.* / *… was already invited.*
- **Calendar empty** (48): *Nothing on the calendar yet.* + **Start an event** + **See N ideas**. Filtered-empty keeps *Nothing matches that.*
- **Search, Try chip only** (3): *No events match {chip}.* · *Try taking it off.*
- **Details placeholder** (31): *e.g. Meet by the front desk*.
- **Friend link pop-ups:** new tweak *Friend link pop-up* (add / bad / own / signedout) with the build's copy.
- **Members row panel:** **Add friend** → *Requested*, **Accept friend request**, or **✓ Friends** (60).
- Group header was already 210px (75).

## Added in the third pass
- **One small event row** (70): Leading list, Invite friends event list now 40px photo (radius 10), title 15px/800 on one line, 12.5px/600 gray line, 14px `#b9bcc4` chevron.

- **One list card** (69): group List swaps its chevron for the 44px photo; the Calendar List strip now opens the lead's tasks / your jobs in place (*Leading · N tasks ⌄*) like Your schedule, instead of opening the event.

## Added in the fourth pass
- **One dark wash** on photo headers (75, owner 2026-10-02): the plan header's green wash is gone; plan, idea and group headers all use `linear-gradient(to top, rgba(13,17,23,.9), rgba(13,17,23,.45) 55%, rgba(13,17,23,.3))`.

## Added in the fifth pass (rows 109–111)
- **Friends tiles:** tap a friend opens their profile; a 30px round tick at the face's lower right (white, gray ring; purple + white check when on) picks them. Hint: *Tap a friend to see their profile. Tick the circle to invite people together.*
- **Default photo:** no event or group photo → gold gradient `#c98f16 → #e8a71c → #f3c55a` (the trail photo is no longer a default).
- **Past events:** Share opens *Share this event* (link only) with the message *{title}: here's how it went.*
- **Removing a job with sign-ups** asks *Remove "{job}"?* · *The N people signed up get a note that it's off the list.* · **Remove and save** / *Go back*.
- *Needs you* sort → *Could use a hand*; *VOTING ON A SPOT* → *VOTING ON A LOCATION*.
- No *I'm going / Maybe* on invite notifications for cancelled or past events.

## Added in the sixth pass (owner's calls, 2026-10-02)
- **Invited tile** on Your tasks' Leading card strip: Going · Maybe · Sign-ups · **Invited** (envelope icon). Replaces the old Reminder tile (row 25).
- **Who's coming** (lead): new **HAVEN'T REPLIED · N** section (purple label) with a **Nudge** pill per person (white, `#c9c2fb` ring, `#4a3ad4` 13.5px/800). Nudge sends the fixed note *{Lead} is hoping you can make {event}. Going, Maybe or Can't?* · once a day per person: then a gray **Nudged** pill, and a tap toasts *You nudged {name} today. Try again tomorrow.*
- **This invite link isn't working** full screen: *It may be old, or the group got a new link. Ask the person who sent it for a fresh one.* · **Go to my calendar** (signed out: **Go to Spark Hub**) · outlined **I have a new link or code** (opens Join a group). Tweak: Data state = badinvite.
- **This page isn't here** (404) full screen: *The address might be mistyped, or the page moved.* · **Go to Spark Hub**. Tweak: Data state = notfound.

## Messages only (no screen; build as the usual red toast)
- Two identical poll options: *Two options are the same date and time. Change or remove one.* (places: *…the same place…*)
- A taken group name: *That name is taken. Try another.*
- Hourly limit: *You're going a bit fast. Try again in a little while.*
- An event that can't be opened: *Couldn't open that event. Check your connection and try again.*

## Not designed yet
- One dark wash on photo headers (75): the plan header's green wash vs the group's dark one — which wins?

## Swipe hint: faint chevrons (2026-10-02; options in `Swipe Button Options.dc.html`, picked 1d)
- The floating light-purple edge tabs are gone. Group pages show a small gray ‹ › (18px, `#6b7280`, 55% opacity, no shape or color behind it) in the 14px side margins, 28×60 tap area. ‹ shows when there's a tab to the left, › when there's one to the right. They hide once one is used (row 88). Swiping still works.
- **Tab picker chevrons:** the Ideas · Plans · Past bar also has a 16px gray ‹ at its left end and › at its right end (28×44 tap area each, inside the gray pill). They switch tabs one step; at the first/last tab that side fades to 30% and does nothing. Always shown.
- **Nudge animation:** each chevron slides 4px outward and brightens to 90%, then settles back (2.6s loop, motion in the first ~0.8s, then rest; starts after 1s). Off when the phone's Reduce Motion is on.

## Group header 6c + menu 3b (2026-10-02; options in `Group Header Options.dc.html`)
- **Header:** 112px photo (was 210px) with the standard dark wash. One row at the bottom: quiet ‹ **Back** (plain white chevron, no circle, 85% opacity, 28×44 tap area) · purple **YOUR GROUP** eyebrow (12px/900, 1.2px tracking, `#cfc9ff`) above **{group}** (28px/900, wraps to 2 lines then clips; the header grows past 112px when it wraps) over *48 members* (13px/700, white at 78%) · see-through **Invite** icon · see-through **⋯**. Invite and ⋯ are 40px, `rgba(255,255,255,.2)` + blur. No bell here (it stays in Your tasks and Leading).
- **+** moves next to the Ideas · Plans · Past tabs (44px purple) for everyone; the admin Search button there is gone (Search is in the menu).
- **⋯ menu** (sheet from the bottom): 44px photo + name + ✕; four round actions **Invite** (purple) · **Copy link** · **Search** · **Alerts**; **Members** row with faces + *See all N*; **ADMINS ONLY** (owners/admins): Edit group · Invite link & code · Blocked N (when any); red **Leave group** at the bottom (replaces the Leave link under Plans).

## Group page: Up next view (2026-10-02)
- The group's view menu is now **Up next · Tiles · Month** (List is gone); Up next is first and the default. Old List picks map to Up next, Grid to Tiles.
- **Up next** (on Plans, sorted Soonest): the soonest upcoming event as one big photo tile with a countdown chip (*Today / Tomorrow / In N days*, top right, dark glass), then the rest as List rows under *This week · Next week · Later in {this month} · {Month} · Date TBD* (a later month is just its name, e.g. *November*; also on Your schedule) — same as Your schedule's Up next. With another sort picked, sections keep the sort's grouping and show as tiles.
- The view button shows the Up next icon (tall card over two lines).

## Feedback ask (2026-10-02; options in `Feedback Prompt Options.dc.html`, picked 1c)
- Replaces the build's *PSST… GOT A MINUTE?* card. A sheet slides up above the tab bar (scrim over the page, not the tab bar): Eric's 36px face · purple **FEEDBACK NEEDED** eyebrow (12px/900) · **Help Eric improve the app** (19px/900) · a text box with the hint *What's something we should fix or add? Any feedback helps, even "the calendar is confusing."* · **Send to Eric** (grey until there's text) and a quiet **Not now**. No chips, no paragraph.
- Send adds the note to the Feedback inbox like the Profile sheet does.
- After **Send** or **Not now** (or tapping the scrim) the sheet closes and one dark tip points at the profile tab: *Thanks, Eric got it.* / *No problem.* + *Add more anytime in your profile.* It goes after 5s or a tap. The ask shows once per device.
- Prototype: shows 8s after landing on the Calendar. Tweak *Feedback ask* = now shows it at once; off hides it.

## Start an event: "No help needed" (2026-10-02; options in `Helpers Step Options.dc.html`, picked 1b)
- The *How people can help* step stays as it is (title, *Optional, but it takes the load off you.*, the 1-2-3 explainer, START WITH ONE chips, *Decide later ›*, Back).
- While no job is added, the grey **Next/Review** button becomes an outlined **No help needed →** (white, 2px `#c9ccd3` ring, ink text, right arrow). It goes straight to Review. Add a job and it's the purple **Review** again.
- Review's *How people can help* row then reads **No help needed** (answered, *Edit*), not *Help to be decided*. *Decide later* still gives *Help to be decided*.
