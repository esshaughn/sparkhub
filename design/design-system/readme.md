# Spark Hub design system (v8)

Spark Hub is a mobile app (393×852) for neighbourhood groups. People **float Ideas**, turn them into **Plans** (events), RSVP, **sign up** to bring or do things, and **lead** or **help out**. It's in beta, and its public address is `sparkhub.wereallneighbors.org`.

This system is taken from **Spark Hub v8 (round v8-17, Oct 9 2026)**. Nothing has been redesigned: every value is copied from the prototype.

## Sources
- Claude Design project "Spark Hub v8": `https://claude.ai/design/p/37c99f94-b4c7-4443-8ca6-ab3f08ac247d?file=Spark+Hub+App+Version+8.dc.html`
  - `Spark Hub App Version 8.dc.html` is the source of truth: one ~1.9 MB Design Component holding the whole clickable app.
  - `CLAUDE.md` holds the colour and wording rules. `HANDOFF-to-CODE.md` holds the round-by-round decisions.
- The upload `uploads/Spark Hub v8-17/` (the same round, with `options/` files and `photos/web/`).
- If the two ever disagree, the newest HANDOFF and the build's `HANDOFF-to-DESIGN-9` win.

## Index
- `styles.css`: the only file consumers need to link. It imports:
  - `tokens/colors.css`: base colours plus role and semantic aliases
  - `tokens/typography.css`: Figtree (Google Fonts) and the type scale
  - `tokens/spacing.css`: spacing, radii, elevation, scrims and sizes
  - `tokens/motion.css`: easing, durations and keyframes (`popIn`, `sheetUp`, `scrimIn`, `fadeUp`, `plusPop`, `swipeBounce`)
  - `tokens/textures.css`: gradients, graph paper, note paper, hatches and the torn edge, plus helper classes `.sh-graph-paper`, `.sh-graph-board`, `.sh-note-paper`, `.sh-torn`
  - `tokens/base.css`: resets, link colours and italic placeholders
- `components/`: React primitives (see below). `components/load.js` loads them in plain HTML when the compiled bundle isn't there.
- `guidelines/*.card.html`: foundation specimen cards (Colors, Type, Spacing, Brand).
- `assets/icons/*.svg`: 67 icons lifted from v8. `assets/brand/`: the spark bolt and the sparkle. `assets/photos/`: all 23 event photos plus `faces/` (5).
- `ui_kits/app/`: click-through recreation of Groups, Ideas plus the Idea slide-up, the event page, and Me with the Feedback sheet.
- `SKILL.md`: an Agent Skill wrapper.

### Components
| Group | Components |
|---|---|
| icons | `Icon` (+ `ICON_NAMES`) |
| brand | `Wordmark`, `Sparkles`, `Sparkle` |
| actions | `Button`, `IconButton`, `Fab`, `PlusMenuPill` |
| chips | `Chip`, `ChipRow`, `FilterPill`, `Tag` |
| cards | `Card`, `SectionLabel`, `ListRow`, `NextUpCard`, `EventCard`, `IdeaCard`, `GradientCard` |
| surfaces | `BottomSheet`, `Popup`, `Toast`, `Menu` |
| textures | `NotePaper`, `Snapshot`, `GraphPaper` |
| rsvp | `RsvpTiles`, `RsvpStatus` |
| navigation | `TabBar`, `ScreenHeader` |
| people | `Face`, `FaceStack` |
| forms | `Field`, `Toggle`, `Checkbox` |

**Intentional additions.** v8 is one inline-styled file and has no component library. The families above are the patterns that repeat in it, each lifted with its exact values. `Icon` wraps the inline SVGs. `Sparkles` puts the hand-placed sparkle sets into presets.

---

## CONTENT FUNDAMENTALS
- **Voice:** a friendly neighbour, plain and short. Use second person (*you*), and first person only in Eric's own feedback lines (*I usually reply the same day.*). Write in sentence case everywhere. Spark Hub uses no emoji in the UI. The only glyph is a ✦ in a few celebratory buttons (*Lock it in ✦*).
- **Capitalised nouns:** **Idea** and **Plan** are capitalised when they name the thing (*Float an Idea*, *Create a Plan*, *Make it a Plan*, *It's a Plan!*). Everywhere else they stay lower case (*Make it a plan* in the Welcome steps).
- **Required words:**
  - *lead*, not host. *people*, not neighbors. *event* is the umbrella word.
  - *location*, not spot. *Sign in*, never log in. *RSVP*. *Who's coming*.
  - *What to expect* for an event's details section, and *Details* everywhere else.
- **Suggest vs offer:** you *suggest* options (a date, a location). You *offer* yourself (to lead, to help).
- **Names:** first name plus last initial (*Hana M.*). The full name appears only on the profile pop-up.
- **Caps:** eyebrows and chips use caps: *NEXT UP · THU, OCT 15*, *NEEDS A LEAD*, *REQUEST*, *BETA*, *UPDATE*, *IT'S A PLAN*. *NEED* is used on purpose on Tasks.
- **Unbuilt features:** these wear a gold **REQUEST** chip and open a feature request. Never write "Coming soon" or SOON.
- **Undated items:** *Date TBD*, *Location TBD*, *Time TBD*.
- **Counts:** *N spots left* only appears when an event caps attendance. Jobs are never "spots". *3 ways to help ›*.
- **Toasts confirm in a few words:** *Offer sent to Hana*, *Posted to Torrez Fitness*, *Link copied*, *It's a plan! We told the 7 people interested.*
- **Empty states are short and give a next step:** *Nothing here yet* / *Three ways to get it going.* · *That's every idea for now.* · *Nothing on the list yet.*
- **Placeholders** are italic and conversational: *Throw out whatever comes to mind…*, *What's the plan?*, *Ask a question or say hi…*. Don't write "e.g." anywhere.

## VISUAL FOUNDATIONS
- **Colour by role.** Each relationship to an event has its own colour:
  - purple `#5b4ae8`: leading, and the app colour
  - green `#149a4b`: going, done, NEXT UP, Today
  - gold `#f5b428`: Ideas and Maybe. Text on gold is always dark `#2a1d00`.
  - orange `#e8661c`: helping. It replaced teal and sky.
  - pink `#d6246e`: updates and likes
  - blue `#1f5fa8`: links and info only. It is no longer the Idea colour.
  - Each role has a pale band plus a darker text colour (`--role-*`).
  - The page is grey `#e8eaee` and ink is `#0d1117`.
  - Everything that is purple on a plan turns **gold on an Idea** (Idea pages, the slide-up and pop-ups).
- **Type.** Figtree only.
  - Titles are 900 with tight negative tracking (−.3 to −1.4px). Labels and buttons are 800. Body is 500 at 15px/1.4. Meta is 600 at 13px.
  - Inputs are never below 16px.
  - Use `text-wrap: pretty` and `balance` on titles.
- **The Spark gradient.** It runs purple → pink → amber at 115°, always with a few small white or pale-gold ✦ sparkles and pinprick dots. Use it once per screen at most: the All groups card, the Your impact pill, *Make it a Plan!*, the create header without a photo, the Welcome steps. It never fills a page background.
- **Textures (Ideas only):**
  - **Note paper:** cream `#fffdf5`, with a rule every 22px. It's used for Idea cards and the tops of slide-ups. A slide-up top ends in an **organic torn edge** (a 40-point clip-path) with a 1px drop shadow.
  - **Graph paper:** `#f5f9fe` with an 18px `#dfeaf7` grid. It's used for planning sheets, tilted −1° with a soft shadow, and as the Ideas tab background (`#eceef2`/`#dde1e8`).
  - **Snapshot photos:** a 6px white border, tilted 1–3° (the angle comes from the idea id, so it stays stable).
  - **Hatches:** 45° stripes mark *Maybe*.
- **Imagery.** Real, candid daylight photos of neighbours at events: parks, courts, porches, parades. They're warm and unfiltered with no grain. Past events get desaturated (`saturate(.4)`).
  - On cards and headers, photos sit under a **dark bottom-up scrim**, and white text has a soft text shadow.
  - Dates on photos take the role tint (`#cfc9ff`, `#ffb98a`, `#ffd77a`, `#9eecbc`).
- **Cards.**
  - White, 18–22px radius, no border, whisper shadow `0 1px 3px rgba(15,18,25,.08)`.
  - Empty create sections sit on `#dfe2e7` and turn white when filled.
  - Emphasis comes from a 3px gold top inset (NEEDS A LEAD) or a 3–5px role bar. Never use a coloured left border on a rounded card as decoration: the 5px gold edge on Idea paper is the one exception.
- **Shape.** Everything tappable is a pill (999px): buttons, chips, icon buttons, the writing box.
  - Fields: 14px radius with a 1.5px `#dcdfe6` inset ring. Focus is a purple 2px ring plus a 4px purple halo.
  - Pop-ups: 24px. Sheets: 24px top corners.
- **Sizes.**
  - Buttons: 54 (primary), 48–50, 36. Icon buttons: 44 / 40.
  - Chips: 38 / 36 / 32. Rows: 48 / 52 / 64.
  - Tab bar: 84px. Screen gutter: 14–16px. Section gap: 18px.
- **Layering.**
  - **Slide-up sheets** stop 44–64px from the top, have a grab handle and a white header, and come up over a `rgba(13,17,23,.45)` scrim.
  - **Centred pop-ups** are at most 353px wide and fit their content up to 88% of the screen. Everything opened from an Idea is a centred pop-up.
  - **Menus** are 16px with a large soft shadow.
  - **Toasts** are ink, 14px radius, just above the tab bar.
- **Transparency and blur.** Used only for chips and buttons sitting on photos: dark `rgba(13,17,23,.4)` plus `blur(8px)`, or white `.94`. The tab bar is white at .96 with `blur(12px)`.
- **Motion.** Quick ease-out (`cubic-bezier(.2,.8,.2,1)`):
  - pop-ups fade and grow in 220ms; sheets slide up in 260ms; the scrim fades in 180–200ms
  - an Idea sheet expands over 420ms
  - only the + pills spring (`plusPop`), and the *Swipe up for more* chevron bounces
  - reduced motion is respected
- **Hover and press.**
  - Purple darkens to `#4a3ad4` and gold to `#e9a815`.
  - Grey buttons go from `#f2f3f6` to `#e8eaee`, and white goes to `#f2f3f6`.
  - Gradient cards brighten (`brightness(1.05)`).
  - A card's shadow deepens slightly on hover. Nothing shrinks on press.
- **Fixed elements:** the tab bar; the FAB at right 18 / bottom 100 (purple +, gold + on Ideas, white gear on Me); sticky × buttons on create headers.

## ICONOGRAPHY
- **The set.** v8 draws every icon as **inline SVG on a 24px grid**: round caps and joins, `currentColor`, no fill. Stroke weight varies by context: 1.9 for tab bar and bell, 2.2 by default, 2.6–2.8 for chevrons and ×, 3.2–4 for ticks inside small circles.
  - The style is close to Lucide, but the paths are Spark Hub's own. All 67 are copied into `assets/icons/` and wrapped in `Icon`.
- **Filled glyphs:** only the **spark bolt** (the brand mark, `#f3c55a`, and the lead/host icon), the **✦ sparkle**, and liked hearts (pink fill).
- **No icon font.** No emoji in the UI. The only Unicode glyphs are `›` in link labels (*See all ›*, *3 ways to help ›*), `✓` in held states (*✓ You're in*, *✓ Copied*), `✦` in a few celebratory labels, and `·` as the separator everywhere.
- **Icon tiles.** A 40px rounded tile (12px radius) in a role tint holds an icon in Me rows and empty states. The tilted 48px gold bulb tile heads the Ideas tab.
- **Logo.** The source has no separate logo file. The mark is the inline bolt plus "Spark Hub" set in Figtree 900, with a BETA chip; it's copied as `assets/brand/spark-mark.svg` and the `Wordmark` component.

## Caveats
- **Fonts:** Figtree loads from Google Fonts because the source project has no font files.
- The full app has 150+ screens. The UI kit covers the four core surfaces. Everything else (Plan an event, Float, My calendar, Friends, sign-in) is in the v8 file itself.
