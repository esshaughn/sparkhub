# Spark Hub app: UI kit

This is a click-through recreation of four core v8 surfaces, built from the design system's components. All copy and values come from `Spark Hub App Version 8.dc.html` (round v8-17).

- `GroupsScreen.jsx`: My groups. It has an invite card (Join / Not now), the Next up card, 2×2 group tiles and the All groups gradient card. Tap Next up to open the event.
- `IdeasScreen.jsx`: the Ideas board on graph paper, with the group picker, the quiet sort menu and the Tiles ⇄ Grid switch. `IdeaSheet` is the note-paper slide-up with the torn edge, *I'm interested*, *Swipe up for more*, NEEDS A LEAD → *Offer to lead* → *You offered to lead*, and the graph-paper *Help make this a plan*.
- `EventScreen.jsx`: the event page. It has the photo header with a tilted calendar tile, the when/where card, the RSVP tiles that fold into a status line, the *You're going!* pop-up, the take-part line and Discussion (with an Event group chat REQUEST row).
- `MeScreen.jsx`: Me. It has the header with About you and Member since, the Your impact pill, My tasks, the Drafts · Ideas · Leading · Past rows and Help & info. *Feedback & questions* opens the bottom sheet with its three chips.

The + FAB opens the Create a Plan / Float an Idea pills. Friends and Calendar are not part of this kit.
