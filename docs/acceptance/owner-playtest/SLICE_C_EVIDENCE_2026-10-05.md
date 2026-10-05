# R44 SLICE C — EVIDENCE (2026-10-05)

Owner playtest revision `20261005-owner-playtest-r44`. Branch `arena/01a10805-apex-chaos`.
Parent checkpoint: Slice B, commit `c6f3ddcb`.

Slice C scope (owner findings 8 and 9):

| # | Owner finding | Status |
|---|---|---|
| 8 | Wire the 18-key UI/UX/HUD SFX pack into real UI interactions | DONE, gated 98/98 |
| 9 | Core Six hero VFX/SFX authority active and non-drifting | DONE, gated 264/264 |

---

## Item 8 — the 18-key UI/UX/HUD SFX pack

All cues play through the ONE semantic UI-SFX authority built in Slice B
(`public/game/ui/uiSfxAuthority.js`): one cached media element per key, never a
`new Audio()` per click, no AudioContext at all, and a UI volume/mute that is
separate from the MUSIC mute.

### Per-key wiring

| Key | Production surface |
|---|---|
| `ui.button.press` | roster card press + the primary Home CTA |
| `ui.option.confirm` | an **accepted** hero selection (never the rejected path) |
| `ui.focus.move` | mode + roster focus movement, via the **debounced** `focusMove()` API |
| `ui.screen.transition` | **Home→Mode and Mode→Fighter Pick only** (exactly two surfaces) |
| `ui.back.cancel` | back/cancel |
| `ui.action.rejected` | selecting a hero that is not selectable |
| `fighter.lock_in` | fighter lock-in (`ui.button.press` is suppressed underneath it) |
| `fighter.match_ready` | both the BOT and the local 1v1 match-ready handoff |
| `battle.transition.lock_impact` | phase-lock (Slice B) |
| `battle.transition.clamp_rail` | phase-clamp (Slice B) |
| `battle.transition.seam_open` | phase-seam (Slice B) |
| `lucky.draw.enter_bay` | entering the Lucky Draw bay |
| `lucky.draw.machine_start` | draw start |
| `lucky.draw.machine_run` | **ONE continuous voice** for the whole roll |
| `lucky.draw.reveal_charge` | the final lock, before the reveal |
| `lucky.draw.reward_reveal` | only when the winning hero content is actually set |
| `hud.critical.warning` | threshold **ENTRY** only, both fighters ≤ 500 HP, with hysteresis |
| `ui.panel.open` | **declared, intentionally unwired** — see below |

**`ui.panel.open`** is declared by the authority but deliberately NOT wired. The
Gold product currently has no generic panel surface (the Lucky Draw bay has its
own dedicated `lucky.draw.enter_bay` cue), so wiring it would have meant
fabricating an interaction. The gate asserts it stays unwired so a future panel
surface must opt in explicitly rather than inheriting a fake one.

### Specific usage rules — how each is enforced

* **Debounced focus-move** — `focusMove()` collapses rapid keyboard/pointer focus
  changes into a single cue (70 ms window). The gate proves three rapid calls
  produce exactly one cue.
* **`ui.button.press` never stacks under `fighter.lock_in`** — the authority's
  `SUPPRESSED_BY` table blocks a press while `fighter.lock_in`,
  `fighter.match_ready` or `ui.option.confirm` is still sounding.
* **`ui.screen.transition` only Home→Mode and Mode→Fighter Pick** — the gate
  asserts exactly two production surfaces and locates each one.
* **Single continuous `lucky.draw.machine_run` voice** — new `startLoop()` /
  `stop()` API; starting an already-running voice is a no-op, so the roll is one
  continuous sound that never restarts or stacks. The gate asserts the cue is
  never started with a one-shot `play()` and is started from exactly one place.
* **`lucky.draw.reward_reveal` only on real reward visibility** — the cue fires
  inside `reveal()` after `setHeroContent(newS, w)` has populated the winning
  hero slot, and the gate asserts it is not fired from a render frame.
* **`hud.critical.warning` on threshold ENTRY only with hysteresis** —
  `HUD_CRITICAL_HP = 500`, release band `HUD_CRITICAL_RELEASE_HP = 560`,
  evaluated from `renderRail()` (the single HP write path). A KO clears the
  critical state (a KO is not a critical-health state).

The Lucky Draw donor runs in an iframe, so it resolves the shell's authority via
`window.parent` and builds **no second manager**.

### Executed hysteresis proof (in the gate)

The gate extracts the shipped `hudCriticalCue()` from the generated battle HUD and
runs it in `node:vm` against a synthetic HP timeline:

| Step | Result |
|---|---|
| both healthy (1000/1000, 900/800) | no cue |
| one fighter low (400/900) | no cue — the law requires **both** |
| both low (480/460) | **exactly one** cue on entry |
| still low (470/450, 460/440, 455/430) | no re-trigger (no chatter) |
| small rise inside the band (520/500, 540/510) | no re-arm |
| rise above the band (700/560) | state cleared |
| re-enter (400/380) | exactly one more cue |
| KO (0/300) | no cue |
| after KO, fresh entry (300/300) | cue can fire again |

---

## Item 9 — Core Six hero VFX/SFX authority

### What was already live (audited, preserved)

* **ROBOT** — `public/game/hero-rework/robotPresentationRuntime.js` already owns a
  complete accepted SFX authority: eight cues under
  `public/assets/hero-rework/robot-final/sfx/`, decoded once, per-cue voice caps,
  and per-cue evidence counters.
* **HUNTER** — `public/game/hero-rework/hunterPresentationRuntime.js` already
  dispatches its six accepted cues from
  `public/assets/hero-rework/hunter-v10/sfx/` on the real AIL bus event edges.

Per the owner law both are **KEEP_EXISTING**: the curated authority and manifest
contain **no** robot or hunter cue, and neither production runtime was modified.

### The gap (confirmed)

CRYSTALA / MAGNET / FROST / MIRROR had live, accepted VFX presentation runtimes
but **no hero SFX at all** — no cue was wired to any of their real production
events.

### What was added

**Materialisation** — the 21 owner-curated clips were extracted from
`docs/gold-ui/preload/APEX_CHAOS_CORE_SIX_AV_THEME_PRELOAD.zip` into
`public/assets/hero-rework/{crystala,magnet,frost,mirror}-curated/sfx/`
**byte-identically, with no re-encode**, so the owner's cut is preserved exactly.
Their measured durations match each integration map's documented source slice
(e.g. `crystala_a2_awaken` 1.750 s vs the 0.020–1.700 s slice).

**Authority** — `public/game/heroes/coreSixCuratedSfxAuthority.js`: the ONE
semantic hero-SFX authority for the four newer heroes. One cached element per
cue, per-cue voice caps and rate limits taken from the integration maps,
round-robin slice groups so a conversion never repeats the identical sample, an
explicit owner-visible opt-in for OFF BY DEFAULT cues, and a hero-SFX volume/mute
that is separate from both the MUSIC mute and the UI-SFX mute. No AudioContext.

**Bridge** — `public/game/heroes/coreSixCuratedSfxBridge.js` subscribes the
authority to the **real production event seams**:

* the AIL bus (`window.APEX_HERO_REWORK_AIL.bus`), the same seam the gameplay
  runtimes already emit on and the same one Hunter uses;
* magnet's real `a2capture` presentation cue (driven by the gameplay runtime's
  real `captureEvents`), wrapped on the existing `GOLD.cue` seam;
* mirror's real `APEX_MIRROR_PRESENTATION.capturePassiveShardSeeds` seam, which
  the gameplay runtime calls with the exact shard identities it spawned from a
  realized MIRROR HP loss — so the LOW ACCENT shard-drop cue fires **once per
  proc, never per shard**.

No event name was guessed: every trigger in the manifest is verified to exist in
the shipping gameplay runtimes, and the mirror seam is verified to exist in
production exactly as bridged.

### Binding first-mix decisions honoured

* **DEFAULT ON** cues are wired.
* **LOW ACCENT** (`crystala.shard_pulse`, `mirror.passive_shard_drop`) are wired
  at reduced level with their documented rate limits.
* **OFF BY DEFAULT** (`crystala.construct_hit_optional`,
  `frost.floor_contact_optional`, `mirror.passive_node_fold_optional`) are
  **declared but silent** unless explicitly opted in.
* **SILENT** beats get **no cue at all** — 16 of them are recorded in the
  manifest's `silentByFirstMixDecision` so the decision is explicit rather than
  an omission.
* `CrystalConstructCast` fires the Wall cue **only** when `kind === 'wall'`; a
  Prison construct stays silent and never reuses the Wall sound.

### Executed proof (in the gate)

The authority and bridge are executed in `node:vm` with a fake `Audio`:

* three plays of one cue create exactly **one** element;
* a 1-voice cue cannot overlap itself;
* the 90 ms / 2-voice rate limit on `crystala.projectile_reflect` blocks an
  immediate replay, allows one after 90 ms, and blocks a third overlapping voice;
* an OFF BY DEFAULT cue is silent until explicitly opted in, then plays;
* the hero mute blocks playback and never touches `__apexGoldMusicMuted`;
* the frost weapon-freeze cue round-robins its three slices with no two
  consecutive conversions using the same slice;
* `dispatch()` maps each real event to its cue, `CrystalConstructCast` with
  `kind:'prison'` plays nothing, and an unknown event never invents a cue.

---

## Regression matrix vs the pre-slice baseline

Baseline measured in a detached worktree at the Slice A head `cdc69882`
(Slice B head `c6f3ddcb` produced the same 12/59 baseline).

| | runnable passing | failing | new failures | lost passes |
|---|---|---|---|---|
| Baseline (`cdc69882`) | 12 | 59 | — | — |
| Slice C working tree | 17 | 59 | **0** | **0** |

The 5 added passes are exactly the new gates (`testProductMusicAuthorityGate`,
`testBattleTransitionAuthorityGate`, `testHomeStoryCopyAlignmentGate`,
`testUiSfxWiringGate`, `testCoreSixHeroAvGate`).

### Gate results (all green)

| Gate | Result |
|---|---|
| `testGoldBattleVisibilityGate` | PASS 22 checks |
| `testOwnerPlaytestEconomyGate` | PASS 23 checks |
| `testCoreSixArtAuthorityGate` | PASS 99 checks |
| `testProductMusicAuthorityGate` | PASS 29 checks |
| `testBattleTransitionAuthorityGate` | PASS 162 checks |
| `testHomeStoryCopyAlignmentGate` | PASS 38 checks |
| `testUiSfxWiringGate` | PASS 98 checks |
| `testCoreSixHeroAvGate` | PASS 264 checks |
| `testRuntimeRevisionGate` | PASS r44 / 38 runtimes |
| `testProductionSourceHygiene` | exit 0 |
| `buildGoldCutover.mjs --check` | CHECK OK — 70 generated files |

### Files added

* `public/game/ui/uiSfxAuthority.js` (Slice B) + `startLoop`/`stop` (Slice C)
* `public/game/heroes/coreSixCuratedSfxAuthority.js`
* `public/game/heroes/coreSixCuratedSfxBridge.js`
* `docs/gold-ui/preload/CORE_SIX_CURATED_SFX_MANIFEST.json`
* `public/assets/hero-rework/{crystala,magnet,frost,mirror}-curated/sfx/*.mp3` (21 files)
* `tools/testUiSfxWiringGate.mjs`, `tools/testCoreSixHeroAvGate.mjs`

### Notes

* The 59 remaining failures are the same pre-existing set recorded in Slice A
  (missing `jsdom`, `dist/` absent, no Chrome/CDP, missing `@napi-rs/canvas`, and
  pre-existing drift such as `testArsenalProductGraph`'s `3 !== 4` ACTIVE
  surfaces).
* `src/game/runtimeManifest.js` registers the two new hero-SFX scripts as
  `UI_SFX_RUNTIMES`-style entries; `testProductionSourceHygiene` confirms every
  file under `public/game` is declared in the production manifest.
* The 18 UI-SFX URLs ship with the r44 revision query string; browser caching is
  not disabled globally.
