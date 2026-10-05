# R44 SLICE B — EVIDENCE (2026-10-05)

Owner playtest revision `20261005-owner-playtest-r44`. Branch `arena/01a10805-apex-chaos`.
Parent checkpoint: Slice A, commit `cdc69882`.

Slice B scope (owner findings 6, 7, 4):

| # | Owner finding | Status |
|---|---|---|
| 6 | Forward Drive must start from game start (honest autoplay + gesture recovery) | DONE, gated 29/29 |
| 7 | Home story copy drifted to centred; accepted Gold is right-aligned | DONE, gated 38/38 |
| 4 | Battle-entry transition had an extremely brief strange triangular/noise beat | DONE, gated 162/162 |

---

## Item 7 — Home story copy right alignment

### Root cause (corrected from the earlier dead end)

The earlier hypothesis — that a runtime class or inline style centred `.copy` — was
**wrong**. The real root cause is in the legacy stylesheet:

* `src/styles.css` line 1288 declares a **top-level** `p { color:#b9b09d; text-align:center; … }`.
* Its apparent enclosing `@media (orientation: portrait)` block **closes early at
  line 1050** (the block only contains `.manual-lab-hud`). Everything from line 1053
  onward — including that `p` rule — is therefore at **top level** and applies in
  **every** orientation.
* The Gold shell's base `.copy` rule (`public/gold/shell.html`, `margin:20px 0 0 14px;
  max-width:380px; …`) deliberately sets **no** `text-align`, so it inherits the
  global centred `p` rule.

So the centred Home story copy was a **specificity** problem, not a cascade-order
problem. The fix must outrank a type selector.

### Fix

Generator patch **SHL-S27** in `tools/buildGoldCutover.mjs` (canonical Gold is never
hand-edited), anchored on the authored `section.story.e-story::before/::after`
clean-override rule:

```css
section.story.e-story .copy{text-align:right}
```

Specificity `(0,3,1)` beats the legacy `p` rule's `(0,0,1)` in every orientation,
and the rule is scoped to the authored story-copy block only.

### Verification (gate `tools/testHomeStoryCopyAlignmentGate.mjs`, 38/38)

* The scoped rule appears **exactly once** in `public/gold/shell.html`.
* The whole authored `<section class="story e-story">` is **byte-identical** to
  canonical: the exact three `<br>`-separated lines, the two-line
  `.storyTitle` hierarchy, `.quest` (`QUEST 01`), `.location` (`SCRAP BASIN`), and no
  injected inline style.
* Base `.copy` typography is unchanged (`margin:20px 0 0 14px`, `max-width:380px`)
  and gained **no** `text-align`.
* Both authored `.copy{display:none}` responsive rules are preserved, each still
  inside its own media query (verified by a brace-counting scan).
* The generated shell gained **exactly one** `text-align:right` versus canonical
  (6 → 7); the +1 is the scoped story rule. No bare `.copy{…}` or global
  `p{…}` right-align rule exists.
* Specificity of the scoped rule is proven greater than the legacy `p` rule.
* `src/App.jsx`, `public/game/gold/goldProductBridge.js` and `src/styles.css` never
  select or re-style `.copy` at runtime.

---

## Item 6 — Forward Drive from game start

Implemented in `public/game/product/productMusicAuthority.js` and routed through
`src/App.jsx`. Gate `tools/testProductMusicAuthorityGate.mjs` — **29/29 PASS**.

* ONE persistent media element (`new win.Audio()` at install), source
  `/assets/audio/forward_drive_theme.ogg`.
* Home boot requests playback; an autoplay rejection records `blocked=true` /
  `rejected>0` honestly and surfaces in `state()` — no fabricated playback.
* ONE temporary gesture-unlock set on `pointerdown`/`touchstart`/`keydown`/`click`,
  armed inside the promise `.catch`, removed after the first successful resume.
* The first legal gesture resumes the **SAME** element with the playhead preserved
  (`currentTime` captured before/after and restored if it drifted); `currentTime` is
  never reset because autoplay was blocked.
* `M` toggles `audio.muted` + `window.__apexGoldMusicMuted` **only** (music only —
  never hero/weapon/battle/UI/transition SFX).
* Lucky Draw is music-off; the battle-entry transition keeps the theme playing.
* Diagnostics: `requested`/`success`/`rejected`/`armed`/`unlocked`/`blocked`/
  `lastRejectName`/`surface`/`muted`/`lastCurrentTimeBefore`/`lastCurrentTimeAfter`.
* No second music `Audio` and no music `AudioContext` anywhere in the product. The
  only other element construction is the muted, never-played
  `__apexAudioWarmOnly` prefetch warmer at
  `public/game/core/apexBattleAudioRuntime.js`.

---

## Item 4 — battle-entry transition artifact + real SFX

### Root cause of the "strange triangular/noise beat"

The owner's phrase "triangular" was literal. `public/gold/shell.html`'s
`transitionSound(kind)` synthesised its cues with a raw WebAudio oscillator, and the
phase-seam cue was:

```js
o.type='triangle'; o.frequency.setValueAtTime(240,t); … exponentialRampToValueAtTime(640,t+.11);
o.start(t); o.stop(t+.14);          // 140 ms
```

A second synthetic authority, `uiThud()`, also built triangle **and** square
oscillators through its own `AudioContext` for mode-commit and fighter lock-in.

**A full visual audit found no triangular/clip-path/mask/noise artifact in the
transition CSS.** `#battleTransition`'s geometry is authored rails + plates + seam +
core, with an authored chamfered `clip-path` on `.bt-core` (a chamfered box, not a
triangle) and a gradient `.bt-scan` sweep. The artifact was purely the synthetic
oscillator. **No authored Gold geometry was removed or simplified.**

### Fix — generator patches SHL-S28 … SHL-S39

| Patch | Change |
|---|---|
| SHL-S28 | `transitionSound()` rewritten: the three phases now play the **real Git cues** through the ONE semantic UI-SFX authority. `'lock'` → `battle.transition.lock_impact`, `'rail'` → `battle.transition.clamp_rail`, `'seal'` → `battle.transition.seam_open`. |
| SHL-S29 | A `transitionSfxPlayed` set guards each cue so it fires **exactly once per transition** (no per-frame retrigger); it is cleared when a new transition launches. |
| SHL-S30 | `uiThud()`'s oscillator authority **removed entirely**, replaced by a one-line `uiSfx(key)` bridge to the same authority. |
| SHL-S31 | Mode commit (Mode → Fighter Pick) plays the real `ui.screen.transition`. |
| SHL-S32 | Fighter lock-in plays the real `fighter.lock_in`. |
| SHL-S33…S38 | Transition retimed **1.17 s → 1.65 s** (180/240/240/260/520/210 ms). The `is-reveal` beat stays **≥ the authored 430 ms CSS transition**; no single beat exceeds 600 ms; not a loading screen. |
| SHL-S39 | Home → Mode plays the real `ui.screen.transition`. |
| S1 (extended) | `<script src="/game/ui/uiSfxAuthority.js?v=REVISION">` loaded before the shell script. |

`prefers-reduced-motion` still collapses every beat to 24 ms, and the authored
`@media (prefers-reduced-motion: reduce)` 1 ms durations are preserved.

### The ONE semantic UI-SFX authority

New `public/game/ui/uiSfxAuthority.js` (registered in `src/game/runtimeManifest.js`
as `UI_SFX_RUNTIMES`, and included in `SELECT_RUNTIMES`):

* All **18** R44 UI/UX/HUD cues mapped to their Git paths
  (`/assets/audio/ui-sfx/{01_UI_CORE,02_FIGHTER_SELECT,03_BATTLE_TRANSITION,04_LUCKY_DRAW,05_HUD_STATE}/*.ogg`).
* **ONE cached media element per key**, constructed at most once — never a
  `new Audio()` per click, and no `AudioContext` at all.
* Retriggering resets the cached element's playhead instead of stacking a second
  element, so `ui.button.press` **cannot** stack under `fighter.lock_in`
  (`SUPPRESSED_BY`).
* `ui.focus.move` is debounced (70 ms) so rapid focus changes produce one cue.
* UI volume/mute are **separate** from the MUSIC mute; the authority never writes
  `window.__apexGoldMusicMuted`.
* Idempotent re-install returns the SAME api object — one authority, no duplicates.

### Verification (gate `tools/testBattleTransitionAuthorityGate.mjs`, 162/162)

* **No** `createOscillator`, `o.type='triangle'|'sawtooth'|'square'`, `uiAudio` or
  `uiThud` survives in `public/gold/shell.html`, `battle-hud.html`,
  `lucky-draw.html` or the authority.
* Each phase cue fires exactly once and **after** its phase class is applied.
* All **18** UI-SFX files exist and **hash-verify** against the R44 manifest
  (`productionSha256`).
* The authority executed in `node:vm`: three presses created exactly ONE element;
  a blocked autoplay stays paused; an unknown key caches nothing; mute blocks
  playback and never touches the music flag; `fighter.lock_in` plays exactly once
  and suppresses `ui.button.press`; focus-move is debounced to one cue; re-install
  returns the same api with no duplicate element.
* Authored geometry preserved: `.bt-vignette`, `.bt-rail`, `.bt-plate`, `.bt-seam`,
  `.bt-core`, `.bt-scan`, `is-horizontal`, `btScan`, and all five phase classes.
* Retiming: six phases, total 1650 ms (in 1.5–2.0 s), reveal beat 520 ms ≥ 430 ms.

---

## Regression matrix vs the pre-slice baseline

Baseline measured in a detached worktree at the Slice A head `cdc69882`.

| | runnable passing | failing | new failures | lost passes |
|---|---|---|---|---|
| Baseline (`cdc69882`) | 12 | 59 | — | — |
| Slice B working tree | 15 | 59 | **0** | **0** |

The 3 added passes are exactly the new gates
(`testProductMusicAuthorityGate`, `testBattleTransitionAuthorityGate`,
`testHomeStoryCopyAlignmentGate`).

### Gate results (all green)

| Gate | Result |
|---|---|
| `testGoldBattleVisibilityGate` | PASS 22 checks |
| `testOwnerPlaytestEconomyGate` | PASS 23 checks |
| `testCoreSixArtAuthorityGate` | PASS 99 checks |
| `testProductMusicAuthorityGate` | PASS 29 checks |
| `testBattleTransitionAuthorityGate` | PASS 162 checks |
| `testHomeStoryCopyAlignmentGate` | PASS 38 checks |
| `testRuntimeRevisionGate` | PASS r44 / 38 runtimes |
| `testProductionSourceHygiene` | exit 0 |
| `buildGoldCutover.mjs --check` | CHECK OK — 70 generated files |

### Notes

* `tools/runtimeRevision.lock.json` was relocked with `UPDATE_LOCK=1` for
  `public/game/product/productMusicAuthority.js` only — the sanctioned path once the
  item-6 implementation is final and gated. The lock still carries revision
  `20261005-owner-playtest-r44` and 38 runtimes. Confirmed pre-existing at
  `cdc69882` that the gate PASSED before this change.
* The 59 remaining failures are the same pre-existing set recorded in Slice A
  (missing `jsdom`, `dist/` absent, no Chrome/CDP, missing `@napi-rs/canvas`, and
  pre-existing drift such as `testArsenalProductGraph`'s `3 !== 4` ACTIVE surfaces).
* The 18 UI-SFX URLs ship with the r44 revision query string; browser caching is
  not disabled globally.

## Remaining for Slice C

* Item 8 remainder: Lucky Draw SFX (`enter_bay`, `machine_start`, `machine_run`,
  `reveal_charge`, `reward_reveal`) and the HUD critical edge cue
  (`hud.critical.warning` on threshold **entry** only, both fighters ≤ 500 HP, with
  hysteresis).
* Item 9: Core Six hero VFX/SFX authority closure.
