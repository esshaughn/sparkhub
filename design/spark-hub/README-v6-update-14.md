# Spark Hub v6 — Update 14 (read after UPDATE_13.md)

Brings `Spark Hub App Version 6.dc.html` in line with the build, per `HANDOFF-to-design.md` (as of 2026-10-02). The design file now matches these rows; where it still differs, the handoff doc wins.

## Event and idea pages
- **Help pick when and where** (row 116): one card on ideas and on plans with an open poll. Gold box, date tiles (top 3), location rows (top 2), tap to vote with an Undo toast, View all sheet, Add date / Add location sheet with *Add my vote to it too*. The lead sees Pick on each option (confirm: *Use this date / Use this location* · *Not yet*). Set items show as a green DATE IS SET / LOCATION IS SET box.
- **Gold strip** (107): Lead · Location · Details · Date, 30px circles, dark joining bars. **Make it a plan!** (green) shows in the strip once all four are done.
- **THIS COULD REALLY HAPPEN** purple card (104): one row per missing piece (I'll lead, location, details, date). Members see it while the idea needs a lead.
- **LED BY** card with co-leads (§2, 105) on ideas and plans; Leads sheet (Step back, Step down, Remove), Add a co-lead sheet. *Offer to help organize* is gone (35).
- **Who's in** (81): faces, *N going ›* (opens the list), the group(s) and Public / Private in one card. Separate Public/Private card gone. *Just you so far.* + **Send invites** for the lead.
- **The lead RSVPs** (96): same Going · Maybe · Can't buttons, Going by default. Count tiles gone; **Invite people** + *Send everyone an update*.
- **Date & place card** (95): radius 20, padding 18, TBD in gray 800.
- **Edit event** (99): round pencil on the photo header (44px white, like Share). Sheet: *Edit event* / *Edit idea*, title, PHOTO preview with Adjust · Replace · Remove (111) or Add a photo.
- **Cancel or delete** (36–37): pop-up with *Cancel it* (reason, *Cancel and tell N people*) and *Delete quietly*. Cancelled events: red CANCELLED chip, pink card, read-only (108).

## Start an event
- How people can help (117): new subtitle, lavender 3-step card, START WITH ONE / ADD ANOTHER chips. *For example* list gone (31).
- Decide later only on an empty step (11); greyed-out Next says why (109). Eyebrow START AN EVENT.
- Review footer not sticky; gold idea card; *It goes on the calendar as a plan.* (102).
- Our own date picker (103) in the Date & time step and the Add a date sheet.

## Wording and smaller things
- *Start an event*, *Details*, *Could use a hand*, *location*, *lead*, *people*, *said yes*, *Leading* (20–22, 56, 92, 109–110).
- No Calendar type filter; Try chips: This weekend · Could use a hand; discovery cards: Soonest surprise · Tag along · Could use a hand (46–47, 110). *Feeling wild?* gone (87).
- Ideas tab empty state (106); group empty tabs (49); not-in-a-group copy (108).
- Gear tab (89); Help & info tiles with colored top edge and solid icons (118).
- **Delete my account** under Sign out (111), with the only-owner block.

## Added in the second pass
- **Invite people** (98, 53): one sheet for the lead's Invite people and everyone's Share. Search, friends then group members with Invite → ✓ Invited / Going, *or share a link*, Copy, and labelled Messages · Email · WhatsApp · More. Others get *Share this event* with the link only.
- **Ask two people first** (92): posting opens the sheet with that title and line. Undated posts go up as ideas (18); no chip over the photo (96).
- **Anyone's profile** (§2): centred pop-up (face, name, place, bio, BOTH IN, Add friend / Requested / Friends since, Remove friend). Opens from the Led by card, Who's going rows and Members.
- **Time lists** (112–114): our own list for job times, shift start/end, poll times, the Date, time & location pop-up and Add a date; *No time* / *No end time* clears. **+ Add end time** link in the Date, time & location pop-up.
- **Drafts in Leading** (94): draft cards sit in the Leading row (92px cover or gradient, DRAFT · SAVED…, trash, step bar, Up next, lavender Continue). *Your drafts* section gone.
- **New accounts** (44): owner card under Feedback inbox and its sheet, with Remove account.
- **Members rows**: tap a row to open EMAIL, Joined, See profile, Make admin / owner, Remove as admin / owner, Step down as owner, Remove from group. Up to five owners.

## Added in the third pass
- **Real or test?** pop-up on step 1 of Start an event (105) and the striped **Test event** tab (90); test events skip Ask two people first.
- **Event link loading** skeleton (115) and the **dead link** card (17), via the Data state tweak (link / gone).
- **Friend link** pop-up (58) via the Open a friend link tweak; friend request in the bell (62).
- **Bell:** All · New · Updates · Leading (33), *Today · N unread* (85), new settings rows incl. Friends (34).
- **Event page:** You're going banner (§2), Can't while signed up (38), taking a job marks Going (26), I could help make it happen (§2), past events Wrong date? / Delete (97), updates by audience with Remove (39), update shortcuts (55), album Remove (40).
- **Guests:** RSVP only, sign-in titled Create a free account (91); name-only guest pop-up; Want a reminder? card (82); no tab bar on event pages (83).
- **Your tasks:** ideas show only the next step (28); real to-dos only for plans and past events (25).
- **Wording:** *Date TBD* for undated sections (9–10); *Not now* on role changes (73).
- **Consistency:** 40px gray sheet closes, 22px sheet titles (71); Groups · Friends switch 44px track, 14px/900 (76); gray Cancel in Your people search (77). Up next date line coloured by role (64).

## Added in the fourth pass
- **Leave a group** (CLAUDE.md, §3): quiet gray *Leave {group}* link at the foot of a group's **Plans** only (101). Centred pop-up: red-tint exit icon, *Leave {group}?* + the build's line, outlined red **Leave**, purple **Stay** (73). Leave → Groups page + *You left {group}*. Only owner gets the *Make someone else an owner first* toast instead.
- **Group edge arrows** (88): see-through light-yellow ‹ › (`rgba(253,241,214,.72)`, blur, gold ring, `#8f6405` chevron) on group pages; they hide once one is used.
- *What else could happen?* card under group Plans removed (30, 104).
- Group page Month view (57) was already in.

## Added in the fifth pass
- **Your schedule Month** (65): Filter button beside ‹ › and the view menu, same menu as Up next.
- **Buttons** (72): purple shadows removed from main buttons; disabled `#d5d8df`; Friends' *Invite* bar is a pill; Cancelled chip uses `#9b1c31`.
- **Faces** (74): new `ini()` gives two initials (full name via FRIENDS); every no-photo face uses `pastel(name)`, keyed by first name, so a person keeps one colour (header, profile, notes, inbox, lead, idea cards, going).
- **Headers** (75): Leading gets the bell beside search; event page Back is 44px solid white.

## Not in the design file yet
One list card / one small row everywhere (69–70); group header 210px and one photo-header wash (75).
