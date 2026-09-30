# Spark Hub v6 — Update 12 (read after UPDATE_11.md)

These changes are folded into `Spark Hub App Version 6.dc.html`. Scope rules from README still apply: no content or data changes, UI and behavior only.

## 1. Add to Home Screen popup: separate steps for Safari (Round 42b)
The popup from UPDATE_11 now has **two versions of the steps**, chosen by browser. Everything else (card, RECOMMENDED eyebrow, "Make this an app (kinda)", description, Got it / Maybe later, when it shows) is unchanged from UPDATE_11.

| Browser | Steps shown | Layout |
|---|---|---|
| **Safari** (iOS / macOS) | **42b**: 3 steps | Stacked rows |
| **Chrome and everything else** | **41d**: 2 steps (UPDATE_11) | Two circles in a row with an arrow |

Why: in Safari, Share is behind the **•••** button next to the address bar, so Safari needs an extra step first. In Chrome, Share is right in the address bar.

### Safari steps (42b)
Stacked column, 6px gap. Each row: 50px circle, `#eceef1` bg, dark `#0d1117` icon (22–24px), 14px gap, label 16px/500 `#0d1117` with the key word(s) bold (900). Between rows is a 2×10px connector line, `#dcdfe6`, aligned to the circle center (24px from the left).
1. Three-dots icon (•••). "Tap **•••** in your browser"
2. iOS Share icon (square with up arrow). "Choose **Share**"
3. Plus-in-rounded-square icon. "Choose **Add to Home Screen**"

### Detecting the browser
- **Safari** = user agent contains `Safari` and none of `Chrome`, `CriOS`, `FxiOS`, `EdgiOS`, `Android`. (Chrome, Firefox and Edge on iPhone all include "Safari" in their UA, so the exclusions matter.)
- Anything else gets the Chrome steps.
- In the prototype, add `#safari` or `#chrome` to the URL to force either version.

## Not in the prototype yet
- Real delivery/storage of feedback (carried over).
- Event preview slide-up (Round 13). Still undecided.
