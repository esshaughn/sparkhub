# Spark Hub v6 — Update 11 (read after UPDATE_10.md)

These changes are folded into `Spark Hub App Version 6.dc.html`. Scope rules from README still apply: no content or data changes, UI and behavior only.

## 1. Add to Home Screen popup (Round 41d)
Replaces the current "Strongly recommended / Put Spark Hub on your Home Screen" popup.

- Card: white, radius 28, padding 26/22/18, gap 14, shadow `0 20px 50px rgba(0,0,0,.35)`. Sits 16px from the sides and 24px from the bottom over a `rgba(13,17,23,.55)` scrim. Tapping the scrim = Maybe later.
- Eyebrow: **RECOMMENDED**. 12px/900, letter-spacing 2px, `#5b4ae8`.
- Title: **Make this an app (kinda)**. 28px/900, line-height 1.05, letter-spacing -.8px, `#0d1117`.
- Description: "Add a shortcut icon on your home screen, no App Store needed." 19px/500, line-height 1.35, `#5c6270`.
- Steps: no grey box. Two 130px columns, centered text, with a 30×14 grey arrow (`#b9bcc4`) between them.
  - Each has a 64px circle, `#eceef1` bg, with a 28px dark (`#0d1117`) stroke icon. Label is 14px/500 with the key words bold (900).
  - 1: iOS Share icon (square with up arrow). "Tap **Share** in your browser"
  - 2: Plus-in-rounded-square icon. "Choose **Add to Home Screen**"
- **Got it**: 54px, radius 999, `#5b4ae8`, white 17px/900. Hover `#4a3ad4`. Never shows again (localStorage `sparkhub-a2hs`).
- **Maybe later**: 44px tap target, 15px/800, `#6b7280`. Hides for this session only (sessionStorage).
- It isn't shown when the app is already running from the home screen (`display-mode: standalone` or `navigator.standalone`).

Screenshot: `screenshots/53-add-to-home-screen.png`. It shows the top of the popup; open the reference file on a phone-height window to see the whole card.

## Not in the prototype yet
- Real delivery/storage of feedback (carried over).
- Event preview slide-up (Round 13). Still undecided.
