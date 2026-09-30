# FROST V1 — IMPLEMENTATION TEST MATRIX

Every gate must exercise real production constructs unless explicitly labeled structural.
Do not pin movement/zero speed in tests that claim to prove APEX locomotion.

## F00 — Baseline / scope

F00.1 exact implementation ancestry contains 6b83fc6502eb8e23e4bd122074fc7fdfb47441ae.
F00.2 preload-only commit changes no production runtime vs baseline.
F00.3 final implementation diff is audited for unrelated CRYSTALA/ROBOT/HUNTER/Chamber regressions.
F00.4 runtime revision/hash lock is intentionally updated only after implementation.
F00.5 preflight/anchoring refuses destructive reset when the Arena session HEAD contains unique committed history not already represented by the preload or a clean disposable mainline ancestor.
F00.6 remote Git authentication is successfully probed before implementation begins.
F00.7 each durability checkpoint proves remote session-branch SHA == local HEAD before substantive work continues.
F00.8 remote-auth/push/verification failure never continues silently; if local commits exist beyond the last verified remote SHA, local recovery artifacts are emitted and implementation stops.
F00.9 preload preflight accepts every declared support tool in this package, including frostGitDurabilityCheckpoint.mjs, while still rejecting production/unexpected preload files.

## F01 — Identity / migration

F01.1 canonical roster still contains one storage hero for ICE/FROST, not duplicate entries.
F01.2 product display name is FROST.
F01.3 lookup/alias ICE resolves Frost product definition.
F01.4 lookup/alias FROST resolves same definition.
F01.5 legacy save with heroId ICE loads and is selectable as FROST.
F01.6 save/select/reload round-trip does not lose ownership/progression data.
F01.7 active mechanic IDs are frost.*; old ice.bullets, ice.lane, ice.deep_freeze do not execute.
F01.8 old iceVisualRuntime freeze overlay/audio does not trigger for Frost rework Freeze.
F01.9 legacy ICE path outside rework is not globally destroyed if still used.
F01.10 legacy ICE suppression keys off the semantic Frost REWORK source/event, not the target hero identity; Frost freezing Hunter/Robot/etc. cannot trigger old ICE overlay/audio.
F01.11 the Frost suppression patch introduces no undefined-scope owner/source predicate into legacy ICE runtime.

## F02 — Base locomotion

F02.1 with no active skill and no status, Frost preserves native heading/inertia exactly like baseline rework body.
F02.2 wall impact uses existing APEX reflect/bounce.
F02.3 anchor body collision separates and reflects; bodies do not stick.
F02.4 no Frost code performs generic pickup seek/chase/kite steering.
F02.5 independent weapon aim does not rewrite fighter dir.

## F03 — A1 cast / direction

F03.1 valid cast consumes cooldown exactly once.
F03.2 direction snapshots current meaningful locomotion/orientation, not enemy bearing and not weapon aimAngle.
F03.3 opposite movement directions produce opposite world lanes.
F03.4 A1 never sets positionLocked, zeroes speed, brakes, or steers Frost; native movement/bounce continues throughout the ~0.25s cast unless an unrelated external CC is authoritative.
F03.5 if Frost moves during the cast, release/build origin follows Frost's real position at release while lane direction remains the direction snapshotted at cast acceptance.
F03.6 direct skill damage remains 0.
F03.7 cooldown is 10.5s.

## F04 — A1 Frozen Floor

F04.1 final world footprint is 650x160.
F04.2 gameplay floor materializes near -> far; far edge is not active before front reaches it.
F04.3 A1 lane support expires 4.5s after the crystallization front completes; the near end does not decay early solely because it was born first.
F04.4 Frost on floor receives x2.35.
F04.5 enemy on floor receives x0.60.
F04.6 leaving A1 floor applies only approved ~0.35s linger where applicable.
F04.7 overlapping floor does not multiply x2.35 or x0.60.
F04.8 repeated casts cleanly expire; no unbounded segment/node leak.

## F05 — A1 firearm freezing / pickup

F05.1 an already-REVEALED eligible firearm whose slot center becomes supported by A1 floor becomes Frozen without changing slot id/weapon id.
F05.2 a firearm that REVEALS while already inside active A1 support becomes Frozen on reveal.
F05.3 opponent physical overlap cannot collect Frozen floor firearm.
F05.4 Frost physical overlap can collect it if Frost is unarmed.
F05.5 Frost armed cannot collect a second holder.
F05.6 no teleport/no duplicate pickup/no copied weapon.
F05.7 melee/grenade/shield/T6 remain unaffected.
F05.8 A2 trail alone never freezes floor firearm.
F05.9 one floor support expiring does not thaw a slot still supported by another active A1 floor.
F05.10 thaw begins only after final support ends; completes ~0.30s later.
F05.11 renewed support during thaw cancels thaw.
F05.12 when thaw completes on floor, opponent normal pickup becomes legal.
F05.13 if Frost picks up before thaw, resulting holder remains Frozen after floor expires.
F05.14 Frozen floor firearm stays the SAME REVEALED slot and continues to count once for offensive active-cap and both-unarmed emergency-spawn truth.
F05.15 opponent denial while Frozen does not create a permanent pickup rejection; after thaw the same opponent is immediately eligible under ordinary pickup law.

## F06 — Frozen Gun

F06.1 Frozen holder preserves real weapon ID/definition/family.
F06.2 damage and crit chain are unchanged.
F06.3 normal independent weapon aim remains unchanged.
F06.4 cadence/shot count/consume law remain unchanged.
F06.5 Frozen state survives until holder consumes; it does not disappear when Frost leaves floor.
F06.6 ordinary non-Frozen gun emits no Frozen Bullet tag.

## F07 — Frozen Bullet grouping

F07.1 SEMI hit = one roll.
F07.2 AUTO each projectile hit = one roll each.
F07.3 BURST each projectile hit = one roll each.
F07.4 PRECISION projectile hit = one roll.
F07.5 SHOTGUN entire pellet fan shares exactly one stable group and permits exactly one roll total if any pellet hits.
F07.6 JACKHAMMER/AUTOSHOT: each blast gets one group; all pellets in that blast share it; next blast gets a new group.
F07.7 no time-window inference is used for grouping.
F07.8 no roll occurs on miss/no body hit.
F07.9 multi-body target cannot create multiple rolls from different pellets of one shotgun blast.
F07.10 deterministic seeded run reproduces the same roll sequence.
F07.11 firing or completely missing an eligible Frozen projectile/blast does not advance the Freeze RNG sequence.
F07.12 semantic shot/blast group ID is created at the real weapon firing source and propagated unchanged to every pellet/projectile of that blast; Frost does not reconstruct grouping from clock/time.

## F08 — Freeze / refresh

F08.1 Lv1 total chance is 8%.
F08.2 successful proc on unfrozen body starts exactly 0.90s hard Freeze, zero direct Freeze damage.
F08.3 successful proc while remaining Freeze >0 resets remaining to 0.90s, never adds.
F08.4 failed proc while Frozen leaves remaining timer unchanged except natural time passage.
F08.5 no post-thaw lock is active while target is still Frozen.
F08.6 actual thaw starts 0.50s reproc lock.
F08.7 hit during post-thaw lock does not roll.
F08.8 after lock expires rolls resume.
F08.9 SLIME/body collections: body hit is body Frozen; no accidental combatant-wide freeze.
F08.10 Gold shell refresh reinforces existing shell; no duplicate stacked shell objects.
F08.11 old ICE FROZEN text/block/audio remains absent for Frost rework.

## F09 — A2 active movement / trail

F09.1 cooldown 12.5s.
F09.2 active window exactly 3.0s.
F09.3 A2 does not set dir toward opponent every frame and does not call a generic homing/chase controller.
F09.4 body moves through native APEX integration and wall bounce.
F09.5 trail samples actual movement path.
F09.6 wall bounce creates corresponding change in real trail direction.
F09.7 width 120.
F09.8 each segment lifetime 3.5s from segment creation.
F09.9 Frost on own A2 trail gets x2.35 by the shared floor system.
F09.10 no hidden full-lane/fixed straight path is substituted.

## F10 — A2 contact / Cold Shock

F10.1 anchor physical collision uses existing separation + reflect before/with mechanic callback; no sticky overlap.
F10.2 first new contact during A2 applies Cold Shock x0.50 for 1.0s and zero damage.
F10.3 continuous overlap does not re-proc every frame.
F10.4 separation clears contact gate; later genuine contact may re-proc.
F10.5 floor x0.60 + Cold Shock x0.50 resolves to x0.50, never x0.30.
F10.6 unrelated non-Frost slow/speed semantics are unchanged.
F10.7 within one A2 cast: contact -> separation -> genuine re-contact produces a second valid Cold Shock opportunity; no executor-local permanent pair latch may suppress it.

## F11 — A2 exact-holder steal

F11.1 Frost unarmed + active A2 + real contact + opponent owns an eligible ranged firearm under live APEX one-holder/BodyProfile law => exact holder object transfers from the authoritative equipment carrier.
F11.2 enemy holder becomes null; Frost holder is the exact pre-contact object reference.
F11.3 transfer does not call fresh equip(), consume(), cleanup(), or create a destruction pose ghost.
F11.4 no floor slot/duplicate holder is created.
F11.5 weaponId/def/phase/elapsed/shotsFired/meta.nextShot/aim/timing metadata are preserved.
F11.6 M249 fixture: 12 total, 5 fired before contact -> after transfer shotsFired remains 5 / 7 sequence shots remain.
F11.7 transferred holder is immediately marked Frozen.
F11.8 after allowed dock/transfer beat, remaining sequence can continue while A2 is still active.
F11.9 Frost already armed -> no transfer/swap/storage; enemy keeps firearm; Cold Shock still occurs.
F11.10 melee/grenade/shield/T6 never transfer.
F11.11 repeated same overlap cannot steal/proc again without separation.
F11.12 owner/provenance/damage/crit law after transfer uses Frost as real holder/owner for subsequent shots through normal weapon runtime.
F11.13 multi-body opponent handling follows the existing equipment-carrier authority; Frost does not assume every colliding Body owns a holder and does not create any new second-slot rule.
F11.14 explicit carrier fixture: Frost collides with a non-carrier child while the opponent's authoritative carrier holds an eligible firearm; transfer queries the real carrier and succeeds exactly once without treating the colliding child as the holder.

## F12 — Gold parity / event truth

F12.1 canonical Gold SHA-256 matches manifest.
F12.2 idle Frost silhouette matches selected Fusion at battle scale.
F12.3 A1 breath/front/material order matches Gold while using real cast/axis.
F12.4 A1 world footprint visual and gameplay support are visibly aligned.
F12.5 A2 trail follows real production path, including bounce/turn.
F12.6 turn carve appears only on meaningful real heading change, not arbitrary timer spam.
F12.7 frozen floor gun remains visually identifiable as its real gun.
F12.8 A2 steal presentation follows one real ownership transfer; no duplicate gun.
F12.9 Frozen Bullet visuals do not replace normal weapon identity or damage logic.
F12.10 target shell starts only on successful real proc.
F12.11 refresh uses same shell lifecycle, not stacked cages.
F12.12 thaw is physical crack/release, not simple alpha fade.
F12.13 light-gray battle floor proof remains readable with bloom not acting as a crutch.
F12.14 no renderer offset feeds back into fighter physics.
F12.15 the production Frost presentation bridge consumes real Frost gameplay state/events for A1, A2, Frozen Gun, Frozen Bullet, steal transfer and Freeze lifecycle; emitting events without a consumer does not pass.
F12.16 generic rectangles/lines/flat cyan substitutes do not count as accepted Frost skill presentation where Gold-derived presentation is required.
F12.17 Frost's approved direct-frontal head/core identity remains frontal across locomotion heading changes; the entire identity asset is not rotated to movement direction.

## F13 — Lifecycle / performance

F13.1 repeated A1/A2 cycles leave no stale floor segments, contact keys, slot tags, freeze timers or transfer state.
F13.2 rematch/reset tears down Frost presentation/state cleanly.
F13.3 no per-frame source image decode or canvas creation in steady state.
F13.4 immutable Gold-derived materials/assets are cached.
F13.5 floor/trail object count is bounded by active lifetime/rate.
F13.6 performance profile is run in real browser under representative Arsenal workload before completion; quality is not cut blindly.

## F14 — Regression / product evidence

At final Frost tip run at minimum:
- focused Frost deterministic gates;
- runtime revision/hash gate;
- production build;
- Hero Rework locomotion suite;
- Robot final gates;
- Hunter owner-fix/Gold gates;
- Crystala V2 73-gate suite or its current descendant;
- relevant Arsenal headless/runtime suite;
- Frost real-browser behavior capture;
- Frost Gold parity/readability check;
- performance profile.

Known post-CRYSTALA baseline evidence from V2 report:
- Crystala focused: 73/73 PASS.
- runtime revision/hash: PASS at 20260930-crystala-v2-r11.
- production build: PASS.
- Crystala Gold parity: 25/25 PASS.
- HeroRework locomotion / Robot / HunterOwnerFix: 4/4, 11/11, 11/11 PASS.
- Arsenal headless had pre-existing av-assets-preloaded jsdom image failure.
- some browser tools may require an installed Chrome binary.

A/B any broad failure against clean baseline before attributing it to Frost.

## F15 — Owner readiness

Final report must distinguish:
- proven by deterministic gates;
- proven in real browser;
- blocked by environment;
- known pre-existing failure;
- still requires owner feel/balance playtest.

Never convert CI green into an owner-acceptance claim.
All final PASS counts must come from the exact reported final implementation SHA. Results from an earlier commit cannot be carried forward after later runtime/shared edits.
If required real-browser/Gold-parity evidence is environment-blocked, report the result as mechanically prepared but visually UNACCEPTED/blocked; do not call FROST complete.


## F12.18–F12.26 — FINAL OWNER PLAYTEST PRESENTATION INTEGRITY

F12.18 correct-Gold-identity: final production bridge hashes/derives from the exact canonical 981,597-byte Gold above; obsolete 975,616-byte Gold is absent from authority references.
F12.19 A2-continuity: A2 production trail remains visually connected and follows the Gold's authored segment/material language through straight movement, turns and wall/body bounces; no detached island chunks caused by adapter admission.
F12.20 A1/A2-scene-isolation: activating either ability leaves unrelated arena, floor, HUD and other fighter rendering unchanged except for the intended Frost effects.
F12.21 opponent-scale-stability: during A1/A2 the opponent's rendered scale/radius/size remains stable and identical to the same fighter's non-Frost baseline; no repeated large/small flicker.
F12.22 Frost-battle-scale: Frost's production body/core/shell is proportionate to peer fighters at the same real arena/camera scale and follows the correct Gold-authored reference dimensions; no arbitrary compensating scale multiplier.
F12.23 canvas-state-integrity: after every Frost draw pass, canvas transform, alpha, composite, filter, shadow, clipping/path and smoothing state are identical to the pre-pass state unless the host renderer explicitly owns that state.
F12.24 no-render-double-path: Frost is not simultaneously rendered by new Frost Gold presentation plus legacy ICE presentation or two Gold engine instances; no duplicate shell/trail/body material appears.
F12.25 no-frame-flicker: repeated A1/A2 frames at stable input do not alternately lose/recreate authored ice details, actor layers or scene transforms; intended animation changes remain the only pixel changes outside moving gameplay.
F12.26 full-lifecycle-Gold-parity: idle, A1, A2, Frozen Gun, Frozen Bullet, Freeze shell/refresh/thaw, steal transfer, rematch and concurrent A1/A2 presentation are all inspected against the exact Gold at battle scale.

These are release gates, not optional visual polish. A failure in F12.19–F12.26 blocks owner-playtest readiness even if all gameplay gates are green.
