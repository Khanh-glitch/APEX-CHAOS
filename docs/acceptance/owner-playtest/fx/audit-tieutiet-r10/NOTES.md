# r10 — Tiểu tiết audit: decision-free fixes (2026-10-18)

Revision: `20261017-shuri-rework-r10` (lock 66). Branch `arena/7db52093-apex-chaos`.
No merge/deploy. R91 r7 held untouched. No U03 (FieldArchive) files touched.

## Fixed

### 1. Battle HUD clock frozen at 02:47 (audit extra finding)
- Root cause: the cutover-injected `seam.applyState` copied the projected
  `st.timer` into donor `S.timer` every frame but never called `renderTimer()`
  on the 1v1 path, so the donor seed `timer:167` ("02:47") painted once and
  never changed. The bridge already projected real elapsed time.
- Fix (`tools/buildGoldCutover.mjs`, applyState): when the displayed second
  (`Math.ceil(S.timer)`, same rounding as the renderer) changes, call
  `renderTimer()`. Second-change gating only; no layout/visual change.
- Browser proof: `.mc-time` sampled `00:02` → `00:13` in a live BOT battle
  (was: `02:47` at every sample). Shot: `C-timer-after.png`.

### 2. Home toolbar hover whiteout (audit #8)
- Root cause: legacy global rule in `src/styles.css:667`
  `button:hover { background:#f3efe3; color:#000; box-shadow:0 0 35px rgba(255,255,255,.35); transform:scale(1.05) }`
  out-specifies the toolbar `.route` background, while `.route:hover`'s light
  text colour still wins → near-white text on a near-white cell (unreadable).
- Fix (cutover patches `SHL-S20b`/`SHL-S20c`): the canonical
  `.route:hover,:focus-visible` rule re-asserts the route's OWN resting
  background and removes the legacy glow — `transparent` in the base layout,
  the canonical gradient inside the portrait block. Gold pixels otherwise
  unchanged; legacy rule left intact for legacy screens.
- Browser proof (hovered, computed): desktop `background rgba(0,0,0,0)`,
  `box-shadow none`; portrait 390 keeps
  `linear-gradient(rgba(26,27,31,.8), rgba(12,13,15,.9))`.
  Shots: `A-hover-before.png`, `B-hover-after-1366.png`.

## Retracted from the audit report
- "12.000 AC" (VI dot thousands) was a small-glyph misread. DOM text is
  `12,000 AC`; the shell uses `toLocaleString('en-US')`. No defect.

## Reclassified — needs owner confirmation, not auto-fixed
- **Spawn "blobs"** (audit #9): NOT the debug missing-weapon placeholder
  (that is a magenta square behind `debugOverlay`). The pentagon shapes are
  most likely intended spawn-in shells (gold scrap / purple crystal) that
  break open. Judge in motion on a real device before calling it a defect.
- **CTA hover inversion**: the same legacy `button:hover` also fully inverts
  the Home CTAs (`#freeBattle` computes bg `#f3efe3`, black text). Readable,
  but it replaces the Gold CTA surface on hover and adds `scale(1.05)`. In
  the donor, CTA hover is lift-only. Restoring donor behaviour changes the
  visible hover feel → owner micro-decision. Recommendation: neutralize the
  legacy rule inside the Gold shell scope (one decision covers all Gold
  buttons), or scope the legacy rule to its legacy screens.

## Investigated, deliberately NOT fixed here
- **BOT WAVE card overlapping FREE BATTLE (390/768)** (audit #1/#2): the
  portrait band docks at `bottom: calc(var(--safeB) + 130px)` — roughly the
  toolbar height — landing across the CTA stack, which has no free slot.
  Any non-overlapping dock (shrink to a chip, move above CTAs, overlay the
  hero) is a Home composition decision, and R8 law forbids moving Gold's six
  Home buttons. Owner decision.
- **Dictionary/FieldArchive items** (audit #3–#7: nav reset on page-2 pick,
  thumbnail overflow, clipped carousel arrows, `mechanic-field-v1` meta leak,
  hardcoded VI radar labels, truncated skill line): all decision-free, but
  every file is in the U03 SHURI/APPEARANCE zone owned by the other AI.
  Untouched pending owner go-ahead.
- All visual-composition items (portrait hero, BOT WAVE art, Dictionary IA +
  6 missing hero records, standing-frame standard, battle-wait VS
  presentation, flat arena, spawn-weapon asymmetry, EQUIPPED slab): owner
  decisions, untouched.

## Gates (this checkpoint)
- buildGoldCutover --check: OK (71 files byte-stable)
- testGoldPickBandLawGate: PASS 79
- testGoldBattleHudAdaptationGate: PASS 57
- testGoldRevisionIntegrityGate: PASS 18
- testBattleHudLiveTruthGate: PASS 20
- testRuntimeRevisionGate: PASS (r10, 66)
- testFighterSelectPagerBrowser: PASS 29/29
- testSkillHudTruthBrowser: PASS 13/13 (first run flaked on P2-phase
  timeout outside the changed surface; reproduced PASS)
- testQuestBattleHudFamilyBrowser (B8qd): PASS, 27 samples, 0 failures
