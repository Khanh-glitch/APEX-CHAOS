# Mobile surface review — 2026-10-22

## Short-landscape Fighter Select

- `fighter-landscape-before-after-844x390.png` pairs the same 844×390 CSS-pixel viewport; raw captures are also retained. `fighter-landscape-after-667x375.png` records the smaller short-landscape boundary.
- Both primary captures use the live React/Vite entry, BOT Fighter Select, roster page 2, NEWBOT selected, and the first-play coach dismissed.
- **Before** intercepts only `/gold/shell.html` and serves `HEAD:public/gold/shell.html` (commit `683fcef5`); the product runtime/assets and viewport are otherwise the same. **After** uses the current generated shell.
- After at 844×390: roster card row y=281.8–325.8; deck bottom y=335.5; Lock In y=338.5–372.5. NEWBOT was inside the roster viewport, passed center-point hit testing after paging, and accepted a real touch selection. No console/page errors.
- After at 667×375: all six page-2 cards are in the 44px roster row; deck bottom y=321.1; Lock In y=324.1–358.1; touch selection passed without page errors.
- The fitted compact sub-band is part of the R52 single deck/lock authority; it leaves the fighter arena, side colors, art, mode flow, and six-per-page roster behavior unchanged.

The paired capture is visual evidence; the measured rectangles and successful touch-selection checks are interaction evidence.

## Phone Battle HUD

- `battle-hud-before-after-390x844.png` pairs the same standalone production HUD, 390×844 CSS-pixel viewport, BOT/1P state, NEWBOT vs HUNTER, HP and skills. Before serves `HEAD:public/gold/battle-hud.html` (commit `683fcef5`); after uses the current generated artifact.
- Before, the compact P1 fighter name visually collided with the HP numbers in the top rail; the lower identity also showed the cramped `LOCAL · TAP` claim in BOT mode.
- After, the redundant P1 top-rail name is hidden while the full lower `NEWBOT` identity remains visible at 16px; `P1` and `875/1000` have separate non-overflowing boxes. The narrow P1 local-control label is absent, while both J/K ability keys, HP, weapon, skills, colors, and combat state remain. Chromium reported no page/console errors.


## Native entry and Vietnamese Field Archive

- `mobile-entry-vie-390x844.png` shows the native public mobile entry at 390×844 with Vietnamese selected, the localized first-play coach, and the product CTA. Runtime probe confirmed the entry stays on `/` (`lab: false`), `lang=vi`, and the Vietnamese font loaded; no browser errors.
- `field-archive-vie-390x844.png` shows the Field Archive opened from Home at the same viewport. Runtime title is `KHO HỒ SƠ`; the archive labels and field copy are localized while canonical fighter and cosmetic names remain unchanged. Vietnamese→English switching while open also passed; no browser errors.

## Follow-up regression closure

- Fighter Select browser matrix: **29 pass, 0 fail** across phone portrait, short landscape, tablet, desktop, BOT, Local, and battle return. Page offsets now use the actual CSS snapport inset; the QA flow explicitly dismisses the returning first-play coach and respects progression-locked roster entries.
- Battle HUD label-fit browser matrix: **154 pass, 0 fail** across 13 viewport/mode contexts and both languages. Small tracking/size adjustments preserve the deck while eliminating the last long-label overflows.
