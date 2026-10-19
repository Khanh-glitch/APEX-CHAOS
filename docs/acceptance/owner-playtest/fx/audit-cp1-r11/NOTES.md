# CP1 (r11) — Home chrome leaks + legacy hover invasion (2026-10-18)

Revision: `20261017-shuri-rework-r11` (lock 66). Branch `arena/7db52093-apex-chaos`.
No merge/deploy. R91 r7 held untouched. Owner decisions applied: CTA hover =
restore Gold; Dictionary zone opened by owner (go_all) — CP1 only touches the
one Field Archive gate function that owned this leak.

## Fixed

### 1. ARCHIVE button leaked over the battle-entry door (audit #9 family)
- Recorder (120 ms samples from final lockIn): `#stage` is stripped of all
  classes at preload; `FieldArchiveC03.isHome()` inferred "home" by negation
  and `gameState` only flips to `ARSENAL` later, so `.apex-skin-entry`
  rendered VIS over the sealed door for ~900 ms (t≈1921–2801).
- Fix (`FieldArchiveC03.jsx::isHome`): positive requirements — stage must
  carry `ready`, no scene transition may be active, and `#battleHudHost`
  must not be engaged (`is-preloading/is-transitioning/is-open`).
- Fix (`cosmeticLocker.css`): instant CSS backstop with the same three
  signals, so the button disappears the frame the stage is stripped instead
  of waiting for the 400 ms React poll.
- After: identical recorder shows `skinVisCount: 0` (absent in every sample);
  BOT WAVE entry correctly `hid` (it was already hidden by
  `#stage:not(.ready)` + `screen-fighter` rules — earlier "visible" readings
  only measured `display`, corrected with opacity/visibility/rect here).
  Shot: `D-battle-no-leak.png`.

### 2. Legacy global `button:hover` inversion removed from the Gold shell (owner: restore Gold)
- `src/styles.css:667` painted every hovered button `#f3efe3` + black text +
  white glow + `scale(1.05)`. Inside the shell this destroyed the Gold CTA
  surfaces on hover (their art lives on child frames; the donor hover is
  lift-only). The rule (and its `button:disabled` / `button:disabled:hover`
  siblings, which double-dimmed locked routes with `opacity:.48` and a dark
  hover block) is now scoped with `:not(:where([id="gold-shell-host"] *))` —
  identical matching, historical specificity, legacy screens untouched.
- The ARCHIVE entry lives OUTSIDE the shell host, so its own `:hover` now
  re-asserts its authored gradient/text/shadow (`cosmeticLocker.css`), the
  same pattern as the r10 `.route` fix. Cascade note: the first scoping
  attempt (`:not([id=...] *)`) raised the legacy rule to (0,2,1) and still
  beat the entry's (0,2,0) hover; `:where()` restored (0,1,1). Measured
  after: gradient + `rgb(247,233,199)` retained. Shot: `A-skin-hover-after.png`.
- CTA measured after: bg `rgba(0,0,0,0)`, text `rgb(238,231,221)`, no glow,
  lift-only transform — donor behavior.

### 3. Locked routes brightened/lifted on hover (discovered during CP1)
- After the legacy disabled rules were scoped out, `.route:hover` (0,2,0,
  later in source) still overrode `.route.is-locked` (0,2,0): a locked,
  disabled route brightened to ~0.965 alpha and lifted −1px on hover
  (`B-locked-hover-before-s20.png`).
- Fix at the authored source (`SHL-S20` in `tools/buildGoldCutover.mjs`):
  `.route.is-locked:hover/:focus-visible` keep the locked color and
  `transform:none`; the svg keeps `color:inherit; transform:none` instead of
  turning orange. Measured after: color `rgba(235,228,218,0.34)`,
  transform none, svg same. Shot: `C-home-final-locked-hover.png`.

## Investigated — no defect, no change
- **Mode-card `<img>` without src (audit minor):** deferred by design.
  `data-apex-src` art hydrates in `setScreen('mode')` prepare; after commit
  both images load (`mode-solo.webp` 295×175, `mode-local.webp` 315×150,
  base `/gold/`). The audit probe sampled the pre-hydration state.
- **Spawn-weapon asymmetry (audit minor):** recorder sampled both fighters
  `none` at every early frame — both spawn unarmed; MAGNET's P90 in the
  audit was a fast post-spawn pickup, not a spawn loadout difference.
- **Spawn "blob" shells (audit #9):** still not attributed to a painter in
  this checkpoint; not the debug placeholder (magenta, `debugOverlay`-gated).
  Carried to CP5 (battle-wait presentation) for in-motion judgement.

## Gate flake analysis (transparent)
Browser gates around the pick LOCK press are racy in headless: `lockCurrent()`
ignores presses until `setScreen('fighter')` commits after `prepareSurface`
decode, while DOM clicks (unlike real taps on the hidden button) can land in
that window and be swallowed forever. Evidence: pager scenario B failed twice
at r11, passed at r10 baseline while a different lock item (C hit-target)
failed there instead, then **passed 29/29 at r11 unmodified**. Skill-truth
failed `P2 phase` 3/4 runs the same way; its `toBattle` now presses LOCK
against the phase readout (the pattern its own `pickVerified` already used,
assertions unchanged) and passes 13/13. No product behavior changed for this.

## Gates (CP1)
- buildGoldCutover --check: OK (71 files byte-stable)
- testGoldPickBandLawGate: PASS 79
- testGoldBattleHudAdaptationGate: PASS 57
- testGoldRevisionIntegrityGate: PASS 18
- testBattleHudLiveTruthGate: PASS 20
- testRuntimeRevisionGate: PASS (r11, 66)
- testDictionaryRuntimeParity: PASS
- testFighterSelectPagerBrowser: PASS 29/29 (flake history above)
- testSkillHudTruthBrowser: PASS 13/13 (lock-press hardening above)
- testFieldArchivePickQuickChrome: PASS desktop + mobile
  (needs `puppeteer-core` + app on :4173; both provided ad hoc, nothing saved)
