# ARSENAL QUEST — VFX / SFX INTEGRATION REPORT

Status: COMPLETE (presentation pass only — no gameplay changes)
Issue: #2 — Integrate curated VFX/SFX pack into Arsenal Quest
Spec: `docs/arsenal-quest/AV_INTEGRATION_HANDOFF.md` (updated rev `1df3996`), `AV_ASSET_MAP.csv`, `AV_REVIEW_CHECKLIST.md`

## Branch + SHA

- Session branch: `arena/01a0cf5e-apex-chaos` (this Arena session is pinned to it; it
  fast-forwards `prototype/arsenal-quest` at `1df3996` — the branch the issue names —
  so all spec docs + committed AV assets are included verbatim).
- AV pass commit: `351db5b662536421839d4f50210958863190d75a`; report finalized in the
  following doc commit (final SHA = `git log -1` on the branch; pushed to
  `arena/01a0cf5e-apex-chaos` only).

## Asset installation

- Curated runtime assets are committed in Git under `public/assets/arsenal/av/`
  (bootstrap commit `8074026`, per updated handoff §1 — no ZIP was requested or used).
- `MANIFEST.csv` verification (SHA-256 + size per file): **95/95 files, 0 problems**
  (checked this pass from the repo root).
- `PROVENANCE.md` present: all sources CC0 (OpenGameArt: Cethiel slash, Sinestesia
  explosions, leftshoe18 muzzle sheet, Tabasco gunshots; Kenney impact/RPG/sci-fi).
- No duplicate source archives committed.

## Exact files added

- `public/game/arsenal/arsenalPresentationRuntime.js` — isolated presentation layer.

## Exact runtime files changed

- `public/game/arsenal/arsenalQuestConfig.js` — added no-op-safe `window.avCue(name, opts)` hook.
- `public/game/arsenal/arsenalSpawnRuntime.js` — `telegraph` cue on `SPAWN_SLOT`.
- `public/game/arsenal/arsenalWeaponRuntime.js` — cues at equip (`pickup`), gun fire loop
  (`fire`), shotgun blast, sniper aim/shot, grenade throw, explosion, melee strike/hit
  per weapon, swirl activate/reflect, tower activate; removed the legacy placeholder
  slash arc from `strikeCone` (replaced by curated slash VFX); `aqDamage` tower-guard
  branch emits `tower_block`.
- `public/game/modes/arsenalQuestRuntime.js` — `AV.preload()+clear()` on enter,
  `AV.clear()` on exit, `AV.tick(dt)` in the shared sim step, `AV.draw(ctx)` in the
  world-space foreground pass (after projectiles/visuals, before holder tags/HUD).
- `src/game/runtimeManifest.js` — registered
  `/game/arsenal/arsenalPresentationRuntime.js` in the `arsenalQuest` group
  (after spawn, before mode).
- `tools/testArsenalQuestHeadless.mjs` — real-asset harness support (Image backed by
  @napi-rs decode of `public/`, AV fetch + decodeAudioData stub, 14 AV gates, 17 AV
  evidence frames).
- `.github/workflows/arsenal-stabilize.yml` — also triggers on `arena/**`, checks out
  the triggering ref, and the bot dep-commit pushes to its own triggering branch
  (never to another branch).

Gameplay values: **unchanged** (no CONFIG edits; verified by the 44 legacy gates).

## Asset-to-event mapping actually used

| Event | Visual | Audio |
|---|---|---|
| telegraph | neutral blue faint streak orbit (`slash_blue_shield` 13-18, alpha .3) | `scifi/forceField_001.ogg` v.30 cap2 |
| reveal | blue crescent pop (3-5) | `rpg/metalClick.ogg` v.55 + `impact/impactGeneric_light_002.ogg` v.18 |
| pickup | white star flash (muzzle frame 3) | `rpg/metalLatch.ogg` v.7 + light impact v.2; dagger adds `rpg/drawKnife1.ogg` |
| pistol | muzzle sheet scale .85 | `guns/cz.wav` [0.10,+0.85] v.75 cap4 |
| shotgun | muzzle scale 1.6 | `guns/shotty.wav` [0,+0.7] v.95 + `impact/impactPunch_heavy_001.ogg` v.25 |
| smg | muzzle scale .6 pulsing | `guns/sks.wav` 0.24s slices from 8 measured onsets, v.5 cap3 |
| sniper | charge streak (blue 19-21) / shot muzzle scale 2.0 | `scifi/laserLarge_003.ogg` v.28 / `guns/mosin.wav` [0.40,+1.7] v.95 |
| grenade explosion | `explosion_pack_2/half/1.png` atlas 64f @34fps, 400→480px | `scifi/explosionCrunch_002.ogg` v.9 + `scifi/lowFrequency_explosion_001.ogg` v.32 |
| sabre | orange 2-6, scale 1.25, .18s | `rpg/knifeSlice.ogg` |
| battle axe | orange 5-1, scale 1.85, .42s | `rpg/chop.ogg` + hit `impact/impactPunch_heavy_001.ogg` |
| dagger | orange 20-22, scale .85, .14s | `rpg/knifeSlice2.ogg` (+drawKnife1 on equip) |
| spear | orange 19-23 thrust streaks, .22s | `rpg/knifeSlice.ogg` + hit `impact/impactPunch_medium_001.ogg` |
| spiked club | orange 14-18 blunt trail, .3s | `rpg/chop.ogg` v.5 + hit `impact/impactPunch_heavy_001.ogg` |
| swirl activate | blue ring 1-8 rotating | `scifi/forceField_003.ogg` v.5 |
| swirl reflect | blue burst 20-23 + reversed star | `scifi/impactMetal_002.ogg` v.85 + `impact/impactPlate_light_001.ogg` v.3 |
| tower activate | blue ring (restrained) | `scifi/forceField_003.ogg` v.28 |
| tower block | blue parry crescent 8-10 | heavy `impact/impactPlate_heavy_001.ogg` / light `impact/impactPlate_light_001.ogg` |
| melee hits | — | blade `impactGeneric_light_002`, thrust `impactPunch_medium_001`, heavy `impactPunch_heavy_001` |

Muzzle sheet used at runtime: `vfx/muzzle_flash/muzzleFlash0_transparent.png`
(transparent, verified per-frame alpha); the black-background reference is never drawn.

## Curated files intentionally unused

- `vfx/muzzle_flash/muzzleFlash0_original_black.png` (reference only, per handoff).
- `vfx/explosion_pack_2/half/2.png|3.png|4.png` (one coherent animation chosen, per handoff).
- `sfx/guns`: none unused. `sfx/impact`: `impactMetal_heavy_002`, `impactMetal_light_002`,
  `impactMetal_medium_002`, `impactSoft_medium_001`. `sfx/rpg`: `drawKnife2`, `drawKnife3`.
  `sfx/scifi`: `laserSmall_002` (listed as optional later-variant only).

## Audio concurrency design

Single WebAudio graph = existing Apex `audioCtx` + `battleAudioMaster` (no second engine).
Buffers fetched + `decodeAudioData` once per file at mode entry (21 mapped files).
Per-clip `maxVoices` caps (guns 2-4, impacts 4-5, scifi 1-3); over-cap plays are counted in
`stats.throttled` and skipped. WAV trims measured from envelope onsets: cz 6.84s→0.85s,
mosin 14.71s→1.7s, sks 15.52s→0.24s slices. Voices auto-release at clip end. No `Audio()`
element spam; `__apexStatsSilent` (harness) records intent without sound; autoplay resume
reuses `ensureBattleAudioReady()`.

## VFX animation design

Images preloaded once (62 mapped), cached; instances are pure value snapshots (no fighter
refs), expire by lifetime, capped at 240 live instances with drop-counter; additive
`lighter` compositing; drawn in the mode's world transform after projectiles and before
HUD. Melee recipes were chosen by inspecting the 30-frame families (crescents 1-12, trails
13-18, thrusts 19-24, blades 25-30) so the five melee weapons do not share timing/scale.

## Results

- `pnpm build`: **passes** (vite 5.4.21).
- Headless acceptance: **58/58 gates PASS** (`node tools/testArsenalQuestHeadless.mjs`),
  = 44 legacy gameplay gates + 14 AV gates. AV preloads 62/62 images + 21/21 audio,
  0 load failures; all 12 weapons + lifecycle cues verified against the audio map;
  SMG slices 0.24s bounded with cap throttling observed
  (`throttled: sks=3, forceField_001=1, impactGeneric_light=2`); VFX pool empties after
  quiet (`active=0`, peak=3 in the measured window).
- Five-minute simulation (300s @30Hz, 9000 steps, presentation active): **no uncaught
  errors**, 3 KOs with restarts, 101 cumulative spawns, 4352 reveal-delay samples all in
  [1.2,1.8].
- Real-browser acceptance: `.github/workflows/arsenal-stabilize.yml` now runs the repo's
  CDP suite (`pnpm test:arsenal`, Chrome on the GitHub runner) for this branch too.
  Run **35947883081** on `351db5b`: job `stabilize` **success, 17/17 steps** including
  `Run headless acceptance suite`, `Build production bundle`,
  `Run real-browser Arsenal acceptance suite` and `Upload browser evidence`
  (https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/35947883081).
  Artifacts on that run: `arsenal-quest-browser-evidence` (3,157,403 B — CDP-suite PNG
  evidence + vite log) and `arsenal-quest-production-build`. (This sandbox has no browser
  binary and artifact blob storage is unreachable from here, so browser evidence lives in
  the CI artifacts rather than in-repo.)
- Normal non-Arsenal modes: still launch and return to menu (legacy gate re-verified).

## Evidence paths

`docs/arsenal-quest/evidence/` (regenerated with curated VFX):
lifecycle: `01-hidden-telegraph` … `08-f3-debug-overlay` (legacy set, now with AV art),
AV set: `av-01-pickup-telegraph`, `av-02-weapon-reveal`, `av-03-pistol-firing`,
`av-04-shotgun-firing`, `av-05-smg-burst`, `av-06-sniper-aim`, `av-06b-sniper-shot`,
`av-07-grenade-explosion`, `av-08-sabre-slash`, `av-09-battle-axe-hit`,
`av-10-dagger-attack`, `av-11-spear-thrust`, `av-12-spiked-club-hit`,
`av-13-swirl-reflect`, `av-14-tower-shield-block`, `av-15-multi-pickup-stable`
+ `headless-test-report.json`.

## Known visual/audio defects

- Headless evidence frames are canvas renders (real assets, jsdom harness), not full
  browser-page screenshots; browser visuals come from CI artifacts.
- Shield activation ring is anchored at the activation point for its 0.6s life
  (fighters move on), by design to avoid retained fighter references.
- Explosion atlas variant 1 chosen; variants 2-4 remain curated-but-unused.
- `stats.throttled.notReady` counts cues fired before async decode finished at mode
  entry (harness timing); in-browser the preload completes during the entry beat and
  residual not-ready skips are limited to the first instant.

## Gameplay changes

None. All 44 legacy acceptance gates pass unchanged; CONFIG numbers untouched.
