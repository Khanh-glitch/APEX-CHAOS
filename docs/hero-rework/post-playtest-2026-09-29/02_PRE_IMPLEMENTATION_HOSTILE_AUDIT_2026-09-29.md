# APEX CHAOS — POST-PLAYTEST PRE-IMPLEMENTATION HOSTILE AUDIT

**Date:** 2026-09-29  
**Branch audited:** `arena/01a0ead6-apex-chaos`  
**Remote HEAD audited:** `9d160d6d846c04cdf72e34db4fbc25b66f131181`  
**Purpose:** Freeze verified root causes before the next Arena one-shot task. This is an audit, not a competing design authority. The owner correction authority wins on desired behavior.

## 1. Remote / recovery safety

The live remote branch was re-read before this prep pass and still pointed to `9d160d6...`. The Hunter recovery lesson remains binding: Arena local workspaces can be reprovisioned. Every production checkpoint in the next task must be committed, pushed, and remote-verified before moving to the next checkpoint or evidence generation.

This prep commit must contain only authorities/reference payload/tooling. It must not change production gameplay while owner playtest is in progress.

## 2. Robot passive — verified root cause

`public/game/hero-rework/heroRegistry.js` currently freezes Robot thresholds as `[150,300,450,600,750,900]` and refunds `[0,.5,1,1.5]` plus `.5` thereafter.

`public/game/hero-rework/heroMechanicsRuntime.js` currently increments `st.cumulative` for every positive realized damage event credited to Robot and keeps `st.reached` for the match. `refundCooldown()` reduces only the currently remaining cooldown; it does not alter the base 10s cooldown.

Therefore the snowball defect is not a permanent rewrite of base cooldown. It is match-wide cumulative progress + ever-larger milestone refunds. Correct layer: replace match cumulative state with deterministic 1.2s rolling burst state fed by realized-damage events. Do not read the DOM combat panel as mechanic authority.

`src/App.jsx` still contains a Robot-specific six-step section labelled cumulative milestones, while the universal burst panel already uses `ROLLING 1.2S`. The correction should reuse that presentation grammar and remove stale cumulative semantics rather than add another HUD.

## 3. Hunter WEAK — verified gameplay defect

`ailRuntime.js` defines WEAK `incomingMult:1.25` and exposes `StatusResolver.incomingMult(holder)`.

`heroReworkRuntime.js` wraps `Fighter.takeDamage`, runs victim `onTakeDamage` hooks, then calls the base takeDamage and emits realized damage. The live adapter never consumes `StatusResolver.incomingMult()`. A WEAK status can therefore exist without increasing damage.

Current `applyWeakTo(ct,duration)` loops over bodies alive at application time. That is not sufficient for the new owner law of combatant-level WEAK: a Slime body spawned later could otherwise escape the remaining debuff window. The new authority must be stored once at Combatant scope (or equivalent single owner record); body mirrors are compatibility/presentation only.

The new vulnerability is provenance-scoped: x1.25 applies only to damage controlled/credited by Hunter. The outgoing x0.75 applies once to positive damage produced by the WEAK combatant. Avoid double application between packet transforms and realized-damage bookkeeping.

## 4. Hunter A1/A2/passive — live state

A1 currently spawns a snare with `radius:46`; trigger condition is `dist <= snare.radius + body.radius*.4`. It applies ROOT and emits `SnareTriggered`, but not WEAK.

A2 currently preserves the correct physical shape of the mechanic: 0.16s windup, live retarget, 2200 px/s, max .50s, swept body TOI, zero direct skill damage, can miss. On hit it only applies the old 3s WEAK. It does not apply the new 2s stun.

The current passive executor is still `hunter.killer_instinct`, and the projectile pass still calls `tryDodge()` before Crystal/Rubber interactions. Removing Hunter dodge must be surgical: remove Hunter-owned evasion/config/presentation without disturbing Crystal reflection, Rubber capture, ordinary projectile TOI, or Stormbreaker law.

## 5. Hunter recoil — verified feedback bug

`hunterPresentationRuntime.advanceA1()` calls `sync(s)` every frame, which resets Gold rig position from the already-moved production body. It then advances Gold A1 and returns the rig delta. `heroMechanicsRuntime` adds that delta again to the current production position. The next frame repeats from the new body position.

This allows desired Gold recoil displacement to feed back into production displacement repeatedly. Correct solution: cast-local origin/axis + finite normalized recoil progress + apply only `currentProgress - previousProgress` world delta. Wall clipping stays in production movement authority. A magic-number-only `55 -> smaller` edit does not fix the feedback topology.

## 6. Hunter trap visual scale and ARMED state

Generated `hunterGoldV10.js` currently has `rtScale(st){return .43;}`. The owner requests 40% of the current in-game visual size. If registration stays identical, `.43*.40=.172` is the first calibration anchor; final acceptance is measured visible world footprint.

The live logical trigger still uses old radius 46, so visual-only scaling would create invisible range. Trigger footprint must be recalibrated with the final visible trap.

Current ROOT renderer ARMED state still sets a nonzero edge, pulsing slot target, and periodically restarts a sweep. This conflicts with the latest owner visual law. ARMED must be energy-silent: mechanical form/shadow only. Emissive travel/bolt/edge/tension wakes only from a real trigger lifecycle (TENSION/SNAP/PIN).

## 7. Hunter trap alpha/fringe

Source segmented ROOT PNGs are preserved under `public/assets/hero-rework/hunter-v10/part-10..16.png`. Runtime derives edge/glow/shadow from their alpha/luma. The observed dark-green ragged halo can be amplified by these derivative passes.

Do not chroma-key green: green is legitimate trap material. Do not hard-crop blade/root silhouettes. Keep original source files immutable and create clean derived assets/masks with alpha/connected-shape-aware cleanup, then A/B at 100% and final 40% scale. Audit derivative edge/glow generation so it does not recreate removed fringe.

## 8. Gold WEAK visual — verified port omission

Canonical Gold reference blob is the hash-verified `HUNTER_GOLD_V10_EXACT_ROOT_TRAP.html` (3,671,159 bytes; SHA-256 authority already frozen in the owner document).

The canonical `Stage.drawWeak(ctx)` is real: three prey-bound inward chevrons/convergence marks plus a local radial material-stress glow. `tools/bridgeHunterGoldV10.mjs` explicitly lists `drawWeak` in its removal set; generated production `hunterGoldV10.js` consequently contains only an empty WEAK section.

Correct action: adapt the actual Gold geometry/behavior to production combatant coordinates and the live 1.0s Weak window, and update the bridge so regeneration does not strip it again. Do not draw a generic ring/icon substitute.

## 9. Hunter duplicate image / motion trail

Gold has two distinct systems:

- `drawAura()` = persistent delayed luminous copy; this is the unwanted blue/green clone.
- `drawEchoes()` = real transform-history motion trail + directional smear.

Correct action: remove/disable persistent aura copy, preserve echoes, make high-speed A1/A2 echoes slightly denser but shorter-lived/closer so they read as motion rather than another Hunter left behind. Old passive-dodge ghost has no owner after passive replacement.

## 10. Chamber palette/readability architecture

`arsenalQuestRuntime.js` paints Chamber 01 once and caches by `GAME_SIZE` only. Current palette is `#626A74` base with center ~`114/123/134` and edge ~`79/87/97`.

Correct extension: palette definitions are curated data; cache key includes size + palette identity; selecting a palette rebuilds once, then one `drawImage` per frame continues.

`arsenalMetaRuntime.js` already owns Arsenal persisted meta state at `apexChaos.arsenalMeta.v1` with `load/sanitize/save`. Prefer migrating an `arenaPaletteId` into that existing authority rather than adding an unrelated storage key.

Adaptive readability must be scoped around actor/weapon drawing with save/restore. Do not apply a global canvas filter that also alters the floor, VFX, damage numbers, or UI. Preserve hue identity; use mild luminance/contrast/keyline/shadow/emissive profile changes.

## 11. Hunter SFX architecture and semantics

Use the prepared staged payload and `tools/materializeHunterSfxPrep.mjs` to create exact hash-verified production MP3s. Do not download replacements.

Reuse the existing battle audio session/master/cache/bounded-voice lifecycle; no second AudioContext and no per-cast decode.

Event edges, not guessed timers, own playback. A1 private charge is local/controller-only. Deploy/unfold/clamp are trap-position world cues. A2 sweep begins on actual locomotion after prelaunch. Catch fires only on real swept contact. Trap expiry and A2 miss must remain silent for their respective impact cues.

## 12. Known baseline/harness conditions

Previous evidence at `9d160d6...` recorded Hunter 11/11, Robot 10/10, Slime 7/7. Launcher smoke was 16/17 because `smoke-robot-dash-moves-to-pickup` could fail on the clean checkpoint: smoke observes about .20s while Robot dash has about .26s windup. A/B before attribution.

Some headless reports also included `soccerChampionRuntime.js: image.addEventListener is not a function`; the target real Hunter browser gate run had zero runtime errors. Treat this as a harness warning unless reproduced in the real browser product.

## 13. Final hostile-preflight verdict

The requested pass is coherent and should be done as one Arena task with remote-safe checkpoints. The task must not begin from memory: fetch remote, verify branch, read owner authority + this audit + standing VIBECODE authority, run prepared SFX materializer/hash checks, reproduce the root-cause invariants above, then implement in four pushed production checkpoints followed by evidence.
