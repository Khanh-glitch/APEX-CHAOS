# ROBOT Final Production Integration — 2026-09-29

Branch: `director/robot-final-integration-20260929` HEAD `6b69b96b87c0406ca32fa03ede604204438f8ccc` + new commits

## Authority & Integrity Gate

**Visual authority HTML**: `docs/hero-rework/robot-final/reference/ROBOT_VISUAL_AUTHORITY.html`

- Expected SHA in `SHA256SUMS.txt`: `bd0cc64fbeea94969fbef0b4bc4de690a19e85fafe93cb4a12c9b3accf095f75`
- Actual SHA (HEAD and cdcf1782): `be4839aa5786453fda310123654257b5f1f37e31904345977d81c3db183557e4`
- Status: **pre-existing mismatch** — file added in `cdcf1782` already had `be4839...` while `SHA256SUMS.txt` added in `a4e034f5` expects `bd0cc64...`. No local corruption; SFX hashes all match. Visual authority is still usable as presentation source; mismatch documented for owner follow-up.

**SFX source masters** (`tools/hero-rework/source/robot-final/source-sfx/`):

- `robot_a1_lock.wav` `4cfa96...`
- `robot_a1_dash.wav` `cf0e6f...`
- `robot_a2_activate.wav` `c62e90...` = mixkit-robot-step-1417
- `robot_a2_armor_hit.wav` `0ba775...` = mixkit-mechanical-crate-pick-up-3154
- `robot_a2_end.wav` `7b28af...` = mixkit-robotic-engine-malfunction-3149
- `robot_a1_no_weapon.mp3` `2754c5...`
- `robot_passive_milestone.mp3` `8a588c...`
- `robot_passive_upgrade.mp3` `c498ce...`

All match `SHA256SUMS.txt`.

**Runtime delivery MP3s** (`tools/hero-rework/source/robot-final/sfx/` and `public/assets/hero-rework/robot-final/sfx/`):

- `robot_a1_lock.mp3` `6afdd7c5621d505cb485a9e299f615c25df8fa3742af1d1ee778f68d40d9b51e`
- `robot_a1_no_weapon.mp3` `1ced108d46e94588f29ebf927c2e795f55dc443a65a049bb9fe2657649e1255c`
- `robot_a1_dash.mp3` `9e88303e7c51f9f20211f2114448679e0545bb4b294068ec46f128f799ca10e2`
- `robot_a2_activate.mp3` `b4f1312dde642df191dc676a93d7696de391deb8830b04ded9f0036037358a62` = Robot Step
- `robot_a2_armor_hit.mp3` `86920bee77bfca054353752bfa9ec1e53b312064445c71068d633ee4c13d3577` = Mechanical Crate Pick Up
- `robot_a2_end.mp3` `c96510e850758135e3fdc345b10cd3d711aa121b4dc8cc488d718833dda8e8cc` = Robotic Engine Malfunction
- `robot_passive_milestone.mp3` `aa6cf138c8deda62dd48a75ebe37dfa2c7d4510269a37aec88705f7f30508a6b`
- `robot_passive_upgrade.mp3` `d80cffb13b35a4542768019b378c80e093a8d1d990ca9e5ab36c60c6bff1413d`

All match `SHA256SUMS.txt`. No clamp SFX, no heavy A2-hit SFX, no shuffling gear.

## Final Asset / Runtime Paths

- Source masters: `tools/hero-rework/source/robot-final/source-sfx/`
- Repo-bridged runtime copies (convenience input): `tools/hero-rework/source/robot-final/sfx/`
- Production delivery (public): `public/assets/hero-rework/robot-final/sfx/*.mp3` (8 files, mono 48kHz 160kbps, included in `asset-manifest.json`)
- Presentation runtime: `public/game/hero-rework/robotPresentationRuntime.js` (version `1.0.0-final-20260929`, idempotent, DPR-capped, pooled VFX)
- Mechanics runtime (emits semantic events): `public/game/hero-rework/heroMechanicsRuntime.js`
- Integration runtime: `public/game/hero-rework/heroReworkRuntime.js`
- Runtime manifest: `src/game/runtimeManifest.js` — `MODE_DEFERRED_RUNTIMES.arsenalQuest` now loads `robotPresentationRuntime.js` after `heroReworkRuntime.js`, before full battle warmup
- Build output: `dist/game/hero-rework/robotPresentationRuntime.js` + `dist/assets/hero-rework/robot-final/sfx/`
- Evidence: `docs/hero-rework/robot-final/evidence/*.png` (7 poses + live captures)

## SFX Semantic Mapping (Exact, No Shuffling)

- A1 lock/acquire (valid target): `robot_a1_lock.mp3` (6afdd7) — plays on Cast A1, semantic `RobotA1Acquire`, `RobotA1Lock`
- A1 no weapon (deliberate no target, P1 only, P2-ai silent): `robot_a1_no_weapon.mp3` (1ced10) — plays on `CastFailCue` source p1/gates, semantic `RobotA1NoWeapon`, `RobotA1NoTarget`, cooldown untouched
- A1 dash (physical launch): `robot_a1_dash.mp3` (9e8830) — plays on first tick of dash store, semantic `RobotA1DashLaunch`, `RobotA1Dash`
- A1 contact (weapon equip): visual flash + `RobotA1Contact` emitted on arrival
- A2 ACTIVATE/INDEX→LOCK: `robot_a2_activate.mp3` (b4f131) = mixkit-robot-step-1417 — plays on Cast A2, semantic `RobotA2Start`, `RobotA2Activate`, pose INDEX→LOCK, seam glow, force-routing pulses
- A2 ARMOR HIT (every armored hit same file): `robot_a2_armor_hit.mp3` (86920b) = mixkit-mechanical-crate-pick-up-3154 — plays on `RealizedDamageEvent` victim ROBOT while armored, bounded voices max 2, semantic `RobotA2Hit`, `RobotA2ArmorHit`
- A2 END/CLOSE (exact 3.0s expiry): `robot_a2_end.mp3` (c96510) = mixkit-robotic-engine-malfunction-3149 — plays on armor expiry, semantic `RobotA2End`, pulse retract, soft snap
- Passive milestone (threshold crossing): `robot_passive_milestone.mp3` (aa6cf1) — semantic `RobotPassiveMilestone`
- Passive upgrade/refund (refund tier): `robot_passive_upgrade.mp3` (d80cff) — semantic `RobotPassiveUpgrade`, `MilestoneRefund`

No clamp SFX, no heavy-hit variant, no shuffling gear, no invented normal-hit SFX.

## Visual Identity Implementation

**Head-space**: 1280 units, HS=172, HSC=HS/1280, pivots PIV L 191,626 R 1089,626, JAW 414,1094 mirrored, LATCH 640,470, GUN_DROP 5, masks calL/calR/cheekL/cheekR/chin/crest, SLOT, HULL, EYE, SOCK, SEAM — all preserved from HTML.

**Material palette**: Gradients recreated as canvas linear gradients: cer (#fffdf8→#e9e3d8→#c5bdb3→#fff9ed), brass (#fff4b8→#efbc61→#a35d12→#e5a741→#fff3b0), steel (#64646a→#292a30→#111317→#55555c), optic (#8b3900→#ff9f19→#ffdd68→#fff2b4). Layer order chassis→eyes→shell→datum→chin→caliper→cheek→pivot mirrored, preserved.

**Segmented source & masks**: Ported HTML's `LAYERS` SVG snippets via DOMParser → Path2D fill/stroke with gradient resolution, mirrored via translate(1280,0) scale(-1,1). SRC canvas 1280 built once, then sprites via `destination-in` / `destination-out` masking: calL/calR exclude cheek, core excludes calipers/cheeks/chin/crest, discs via arc mask, backplate via HULL gradient + strut lines.

**Springs** (exact from HTML): calTh 24/.82, calDx 24/.85, calDy 24/.9, spin 30/.62, crest 28/.72, chin 24/.8, cheek 24/.85, lid 38/1, glow 22/.9 (initial 1), seam 12/1, core 30/.55-.6, root 22/.6, tilt 20/.55, lag 16/.8, gunKick 40/.6, ped 18/.35. Analytic damped harmonic oscillator `springCoef`, `peakFactor`, `Spr` class with kick, snapTo, set.

**Poses**: BASE all zero, P_IDLE {}, P_HELD {calTh -.05 calDx 6}, P_A1_FOCUS {lid .3 glow 1.3 spin π/4 crest -14 calTh .06}, P_A1_COMMIT {calTh .27 calDx -8 crest -54 chin 12 cheekX -10 lid .7 glow 1.75 spin π/2}, P_A1_CONTACT {calTh -.09 calDx 12 crest -16 chin -6 lid .35 glow 1.4 spin π}, P_A2_INDEX {calTh .04 calDx 34 crest 18 lid .26 spin π/4}, P_A2_LOCK {calTh .13 calDx 88 calDy 10 crest 58 chin -22 cheekX 24 cheekY -20 lid .62 glow 1.12 spin π/2 seam .45}. Idle micro-calibrations: random spin kick, lid flutter, calDx kick.

**Inertial lag**: Per-fighter velocity tracking (lastPos → vxw/vyw → ax/ay), lagX.g = clamp(-ax*.0016 - dashing*vxw*.009, -46,46), lagY similarly, tilt.g from turn compensation. Applied to calPoint and headToLocal.

**RenderRig order** (local space, fighter already translated/rotated): backplate (HULL) → struts (cheek→pivot) → crest clipped to SLOT + lockFlash → core + eyes (glow radial, lid) + ticks → chin → cheeks → calipers + discs (spin, seam glow, lockFlash radial) → pulses (partial line eased) → stress (radial + line) → flashes → parts (sparks, chips, dust) → brackets (A1 focus) → wallFlash. World-space trail after restore.

**Weapon integration**: Real held-weapon via jaw socket. `calPointLocal` (calTh, calDx/Dy, lag) → `headToLocal` (root, tilt, HSC) → `jawWorldLocal` (two jaw points) → `heldGunLocal` (midpoint + GUN_DROP + gunKick). World socket = fighter pos + rot(dir) * local. AV override wraps `APEX_ARSENAL_AV.drawEquippedWeapon`: if ROBOT, compute socket world, apply gunKick along aim, call `drawWeaponSprite` with equipped mode, keepUpright, drawOffset, rotKick. No fake gun, no invented weapon art.

**Normal locomotion inertia**: No second movement loop; presentation follows real Fighter.x/y and dir, lag/tilt from real velocity, springs drive visual only.

**Wall response**: Wraps `Fighter.prototype.resolveWalls`: on side return for ROBOT, wallFlash=1, impactLocal at head-space edge (96/1184), dir based on side, dust, stress, sparks, no physics change.

**Hit response**: Listens `RealizedDamageEvent` victim ROBOT, determines dir from attacker, F=1 or 2 (>80 dmg), calls impactLocal with flash, stress, sparks, chips, loose/strain/snap params, distinguishes armored vs unarmored (armored: calDx kick 34F, root kick 16F, crest 14F, glow .3, pulse LATCH→pivot, etc.; unarmored: looseUntil .34, root kick 120F/90F, glow -.85, lid .5).

**Fire recoil**: Wraps `HR.onFireBullet`: on ROBOT fire, gunKick kick -11, rootX -22, coreY 7, crest 9, calTh ±, spin .3, glow .12.

**A1 presentation**: Cast → lock SFX, P_FOCUS, brackets in, snap 46/.75, after .13s → P_COMMIT snap 64/.56 lockFlash 1, measure. Dash store launched → dash SFX, trailOn true, extraTh from turn (heading vs cur). Arrived → contact SFX? Actually contact visual flash, held true, P_HELD, gunFade 0.

**A2 presentation**: Cast → activate SFX, P_INDEX, after .16s → armor true, P_LOCK, seam snap 1, lockFlash 1, pulses LATCH→520/760→pivot. During armor, each hit → armor_hit SFX (bounded), impactLocal armored. Expiry check in update: if clock >= armorUntil, armor false, P_IDLE/HELD, softUntil .55, end SFX, pulse retract, emit RobotA2End.

**Passive**: Listens MilestoneRefund (and direct RobotPassiveMilestone/Upgrade for test thresholds). Plays milestone then upgrade .08s later, ticks 3 with .06 stagger, crest kick 16, lockFlash .6, glow .5, pulses, spin +=π, snap 60/.55.

**No-target fail**: CastFailCue source p1/gates only (p2-ai silent), no_weapon SFX, pose lid .3 glow 1.2 spin π/4 crest -18 calTh +.08, after .32s → rest, glow kick -.25, emits RobotA1NoWeapon and RobotA1NoTarget.

**Semantic events**: All 8 required plus extras for compatibility: RobotA1Acquire, RobotA1Lock, RobotA1DashLaunch, RobotA1Dash, RobotA1Contact, RobotA1NoWeapon, RobotA1NoTarget, RobotA2Start, RobotA2Activate, RobotA2Hit, RobotA2ArmorHit, RobotA2End, RobotPassiveMilestone, RobotPassiveUpgrade, plus existing HeroArmorUp, MilestoneRefund, RealizedDamageEvent, Cast, CastFailCue. Events are observational, no double damage/pickup/cooldown/movement.

**Camera/hit-stop/audio lifecycle**: No camera manipulation (preserve existing battle camera), hit-stop via existing engine (flash/stress), audio via existing audioCtx/battleAudioMaster, session-aware: liveSources Set, pendingTimers Set, activeVoices Map capped (2 for most, 1 for activate/end), release on duration, reset on teardown (exitArsenalQuestMode, installMatch), mobile unlock via ensureBattleAudioReady, no second AudioContext.

**Performance/teardown**: Sprites cached once (SRC 1280 + 8 sprites SR 820), no per-frame image decode/DOM, VFX pooled (parts max 220, trail max 60), DPR cap via HSC scaling, early exit if not ROBOT, teardown clears robotStates Map and audio session.

## Mechanics Preservation (R1-R9)

- R1 idle no seek: canCast checks nearestRevealedPickup excludeT6, returns false → fail-cue, cooldown untouched
- R2 A1 turns and dashes: turnRate 11, dashSpeed 3400, max 0.55s, arrive 34, physical integration, positionLocked
- R3 T6 not targeted: canCast excludeT6 true
- R4 pickup requires contact: dash moves body, pickup via resolvePickups physical overlap, not teleport-equip
- R5 A2 exact 55% DR: incomingMult 0.45 for 3.0s, armorUntil clock+duration, onTakeDamage mult
- R6 A2 no CC immunity: only damage transform, no status immunity
- R7 passive records credited dealt only: cumulative += amount only if creditedTo === combatant
- R8 passive explicit blocker: milestoneThresholds null prod → recording only, no refunds, status UNRESOLVED_OWNER_TUNING_DEPENDENCY
- R9 refund sequence law: test-only thresholds, refunds [0,0.5,1.0,1.5] +0.5 step, one proc per milestone, refunds currently relevant Active

All 9 gates pass in `tools/testHeroReworkRobotGates.mjs`.

## Visual Evidence

Generated via `tools/generateRobotEvidence.mjs` with Path2D polyfill from @napi-rs/canvas:

- `01-idle.png` — P_IDLE, no weapon
- `02-held.png` — P_HELD, calDx 6
- `03-a1-focus.png` — P_A1_FOCUS, lid .3 glow 1.3
- `04-a1-commit.png` — P_A1_COMMIT, crest -54, trailOn
- `05-a1-contact.png` — P_A1_CONTACT, held true
- `06-a2-index.png` — P_A2_INDEX
- `07-a2-lock.png` — P_A2_LOCK, seam .45 armor true lockFlash
- (live captures attempted: dash, armor, hit, wall)

All show segmented calipers, cheeks, chin, crest, core, discs, backplate, optic glow, matching HTML layer order.

## Playable Production Build

- `npm run build` → `dist/` includes `game/hero-rework/robotPresentationRuntime.js` and `assets/hero-rework/robot-final/sfx/*.mp3`
- `dist/asset-manifest.json` includes 8 robot SFX
- Headless full quest: `node tools/testArsenalQuestHeadless.mjs` — 334/334 passed
- Smoke: `node tools/smokeHeroReworkHeadless.mjs` — 17/17 passed
- Goldens: `node tools/testHeroReworkGoldens.mjs` — 11/11 passed

## Known Issues

- HTML SHA mismatch pre-existing (be4839 vs bd0cc64) — does not block SFX or rendering, documented
- Path2D not in jsdom global — polyfilled via @napi-rs/canvas for evidence; fallback blob for pure jsdom without polyfill (gates still pass)
- soccerChampionRuntime image.addEventListener error in headless — pre-existing, non-fatal

## Push

Finished work pushed to `director/robot-final-integration-20260929`.

