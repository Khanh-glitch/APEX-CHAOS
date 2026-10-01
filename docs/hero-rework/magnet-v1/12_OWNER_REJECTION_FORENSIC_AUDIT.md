# MAGNET V1 — THIRD-INVESTIGATION FORENSIC AUDIT

Date: 2026-10-01  
Status: **Phase 1 forensic checkpoint; production remains at the rejected tip while this document is authored.**  
Rejected recovery point: `4aac3fbb831bfaf1ac4f19336607763f16234c12` = `FAILED_OWNER_PLAYTEST_GOLD_TRANSFER`  
Earlier rejected bridge: `4403c57c2620a6d32ce48442de0d92224f4f4594`  
Canonical donor: `gold/MAGNET_FINAL_DONOR_MAX.html`, SHA-256 `468f7b2aa34588c2c52bf23fb5202c507ff5d584d423ea9f1a9232d751247d8b`

This audit treats owner playtest as authoritative. Green tests at `4aac3fb...` are evidence about implementation consistency, not evidence of Gold fidelity or acceptable feel.

## 1. Sequence and failure classification

| Stage | Durable point | What it did | Why it failed |
|---|---|---|---|
| Canonical preload/Gold | donor SHA above | Standalone six-part body, force-object simulation, fixed-step motion, local scene lenses and a demo floor | It is the source to measure, not production code. Its demo gameplay cannot be imported. |
| Bridge attempt #1 | through `4403c57...` | Pre-baked the correct raster parts but split motion/effects between a reduced Gold module and a hand-authored adapter. It had an AQ-only presentation clock, generic impacts, duplicated pole geometry and approximate adapter VFX. | Scheduler starvation in real rAF plus partial/duplicated Gold behavior. The prior audit correctly found these faults, but did not compare output traces against the donor. |
| Bridge attempt #2 | `613ba0d...` | Rebuilt `magnetGoldV1.js`, moved aesthetics into it, added one shared clock, scale calibration and sockets. | It translated source code but validated the translation against itself. It continued to derive motion from Apex's abrupt resolved root samples, copied the donor's diagnostic line grid instead of deforming the real floor, omitted canonical bullet-history visibility for A2, and left A2 body motion after canonical collision. |
| A2 semantic correction | `4aac3fb...` | Correctly stopped stale/global objects from being visually claimed by a field. | The semantic correction is valid but orthogonal to the owner rejection. A semantically correct set can still feed an unfaithful or imperceptible presentation and a wrongly ordered physics integrator. |

The recovery points remain intact. No history is reset or discarded.

## 2. Why the green gates predicted the wrong outcome

### 2.1 Motion self-validation

`tools/testMagnetGoldMotionTrace.mjs` imports `APEX_MAGNET_GOLD`, calls that reconstructed module's `updateFrame()`, and never loads `MAGNET_FINAL_DONOR_MAX.html`. Its strongest general locomotion gate counts parts whose synthetic distance exceeds `0.02`; ordering gates compare the reconstructed engine against its own prior samples. It can prove that six arrays changed in the intended order while all production-visible displacement is much weaker than the donor.

Runnable proof:

```bash
node tools/auditMagnetOwnerRejection.mjs
```

At the rejected tip it records:

- `drivesProductionGold=true`;
- `loadsCanonicalHtml=false`;
- `canonicalComparison=false`.

### 2.2 Browser test covered A1, not A2 firing

`tools/testMagnetV1RealBrowser.mjs` proved exact-once rAF scheduling and a real A1 floor-gun direction. It did not equip a real opponent firearm, wait for `arsenalWeaponRuntime.fireBullet()`, then trace that same projectile through A2.

The new forensic probe uses the actual holder update and actual `fireBullet()` path. At the rejected tip, a real PISTOL round was emitted at 2600 px/s. The head-on shot received only eight authoritative A2 ticks before hitting Magnet:

- launch speed: `2600`;
- influenced ticks: `8`;
- speed delta before hit: about `-193 px/s`;
- direction delta: about `0.0337 rad` / `1.93°`;
- final projectile life: `0` after the normal body hit.

A laterally moved field produced about `-0.0632 rad` / `-3.62°` before the same normal hit. The locked force is executing, but the old browser gate could not distinguish “force function ran” from “owner can perceive a practical shot bend.” Common firearm speeds are 2100–5800 px/s, while the donor's test bullets are 640/900/1300 px/s. With radius 225 and quadratic falloff, practical production bullets spend only a few ticks in the field.

This does **not** authorize changing the locked 18000 acceleration, radius or falloff. It does require exact real-projectile evidence and restoration of the donor's true-history visual evidence so the actual trajectory is readable.

### 2.3 Collision order was not covered

Shipping order at `4aac3fb...` is:

1. both `Fighter.update()` calls;
2. canonical `handleCollisions()`;
3. projectile update;
4. pickup seam;
5. `HR.stepMagnetWorld()`;
6. `magnetGameplayRuntime.integrateBodies()` directly changes `body.x/y`;
7. `separateExtraBodies()` skips the anchor pair.

The directed probe first builds legitimate rightward A2 sidecar momentum, relocates the field to the other side, and places Magnet/Robot at exact canonical contact. The rejected code leaves a `2.8349 px` anchor penetration after every one of 60 observed frames. Canonical collision resolves on the next frame, and the post-collision sidecar recreates overlap. That is a mechanism for visible sticking/tangling even though a simple static A2-apart test passes.

### 2.4 Rendering tests blessed the wrong primitive

The presentation gate asserted that Gold owned `drawFloorDistortion()`, not that the real arena was distorted. The implementation could therefore pass by drawing any Gold-module-owned lines.

The donor contains both:

- a pre-baked floor with its own material/grid (`FLOOR`, lines around the donor's canvas/view section); and
- `dispDonor()` + `drawDynamicGrid()`, a diagnostic deformation field rendered as lines.

Bridge #2 copied the latter line primitive into production, where it is disconnected from Apex's actual arena surface. Owner playtest correctly identifies it as a random global magnetic grid. The transferable principle is the **local displacement field**, not the donor demo's replacement line substrate.

## 3. Canonical-Gold parity harness and rejected-tip result

`tools/testMagnetCanonicalGoldParity.mjs` now executes the canonical HTML in Chromium with deterministic fixed stepping. It records timestamped canonical and production transforms for all six parts (`x`, `y`, rotation, `sx`, `sy`) for:

- movement start and sustained travel;
- stop;
- hard reverse;
- wall contact;
- A1;
- A2;
- passive from actual emission time;
- idle.

Evidence: `evidence/canonical-gold-parity.json`.

Distance weights are world `x/y`, `rotation × 80`, and scale delta `× 80`. The initial rejected-tip comparison is:

| Scenario | Weighted RMSE | Important rejected-tip observation |
|---|---:|---|
| locomotion/start/stop | 2.3441 | spine peak ratio 0.08; poles about 0.31; lobes about 0.28–0.29; production peaks 0.10–1.18 s early |
| hard reverse | 2.9321 | spine ratio 0.11; poles 0.47/0.61; lobe timing and settle differ |
| wall | 3.1723 | far-pole/spine hierarchy and timing differ; current post-resolve wall sampling is not the donor contact stimulus |
| A1 | 1.4783 | strong pose exists and peak magnitudes are near donor; directional/phase trace still needs alignment tightening |
| A2 | 2.1158 | peak magnitudes are near donor, but random lead/phase alignment differs |
| passive, aligned to emission | 0.4903 | launch-time adaptation is close; the unavailable 55 ms pre-emission beat is explicitly excluded |
| idle | 0.6526 | present, but pole amplitude/phase differs because donor reset and production RNG scheduling are not yet aligned |

This is the evidence missing from the former “canonical Gold-owned engine” claim. The final gate must use fair lead/RNG alignment and source-derived tolerances; it must not relax tolerances around the current output.

## 4. Gold-to-production subsystem matrix

Verdicts compare the donor HTML itself to `4aac3fb...`, not to the rebuild report.

| Subsystem | Donor causal source | Rejected production state | Verdict |
|---|---|---|---|
| Six raster parts / masks | `PART_DEFS`, `buildAssets()` | 54 pre-baked layers derived from donor | **EXACT** |
| Pivots/origin | `O_SRC`, `PV` | `ORIGIN`, `META.*.pivot` | **EXACT** |
| Spring constants/damping | `RC`, `kick()`, `rigStep()` | Same coefficients in `fixedStep()` | **EXACT mechanically; TEST DID NOT PROVE end-to-end input parity** |
| Fixed 1/120 stepping | `DT`, six-step cap | Same | **ADAPTED CORRECTLY** |
| Locomotion kinematics feeding springs | donor accelerates toward 420 at 1450 and brakes at 1850 before filtering `hero.ax/ay` | production derives acceleration from Apex's already-resolved, normally instantaneous 450 px/s root delta | **WRONG input translation** |
| Acceleration ring history | `HAX/HAY`, 28/48/118/150 ms samples | same ring math, but fed a short impulse rather than donor acceleration history | **APPROXIMATED / starved** |
| Movement start | core → near pole → far pole → lobes | cue sequence translated | **EXACT in isolation; TEST DOES NOT PROVE shipping magnitude** |
| Sustained motion | velocity plus delayed acceleration targets | translated coefficients | **WRONG end-to-end because upstream kinematics differ** |
| Stop | braking phase then pole/lobe/spine settle | abrupt root stop then reconstructed cue | **WRONG timing/input** |
| Hard reverse | input intent triggers while donor velocity reverses through acceleration limit | detected from already-flipped root velocity | **WRONG causal trigger** |
| Wall | pre-resolution inward velocity, contact enter, structural transfer, recovery | inferred from post-resolution root; incoming velocity often truncated/absent | **WRONG seam** |
| Body/contact | donor has structural grammar for wall/projectile and A2-deep reactions, no general opponent-collision solver | production only routes realized damage; non-damaging anchor contact is silent | **MISSING adapted contact response** |
| Projectile hit response | swept donor bullet hit identifies part/side/speed and applies staged transfer | generic realized-damage direction/amount after hit | **APPROXIMATED** |
| A1 pose/target | continuous object target plus large pole/core/spine pose | live production object truth and donor pose | **ADAPTED CORRECTLY; positive control** |
| A1 gameplay immediacy | long-range gun/bullet attraction with strong moving-object feedback | authoritative production force and real slots | **ADAPTED CORRECTLY; positive control** |
| A2 pose | polarity jolt, 24-unit pole separation, lobe/spine response | close mechanical translation | **APPROXIMATED until parity lead is aligned** |
| A2 firearm bullet force | donor demo uses 18000 without radial falloff; visual test speeds 640–1300 | gameplay authority correctly uses locked quadratic falloff and production speeds 2100–5800 | **ADAPTED to gameplay authority; old test did not prove practical production behavior** |
| A2 projectile reaction/history | donor keeps and draws true bullet history, pressure ticks and lenses | semantics/lenses exist; histories are drawn only for A1 and common shots cross too fast for readable curvature | **MISSING/WRONG visibility** |
| A2 body integration | donor opponent velocity is integrated before its local wall solve and decays by `exp(-5dt)` | independent sidecar moves bodies after Apex collision and never decays outside force | **WRONG** |
| A2 floor guns | donor object sidecar before donor object collisions | production exact real slots, summed once, collision before pickup | **ADAPTED CORRECTLY** |
| Passive | 55 ms prep then launch/opposite/recovery | emission-time launch/opposite/recovery; no universal prep event | **ADAPTED CORRECTLY at emission; documented omission** |
| Idle micro-motion | random 4–7.2 s choreography and channel variants | same families, deterministic local RNG with different initial scheduling | **APPROXIMATED** |
| Shake/impulse transfer | `structural()`, `bulletHitResponse()`, `goldRecover()`, camera/shadow springs | body rig transfer exists; camera/shadow omitted; several real events never reach it | **PARTIAL / MISSING inputs** |
| Floor deformation | `dispDonor()` displaces donor demo substrate locally; `drawDynamicGrid()` visualizes it | copied regular lines across the Apex arena | **WRONG production substrate** |
| Object history | every donor gun/bullet stores bounded history | production stores semantics, but render selects A1 only | **PARTIAL** |
| Effect layering | donor floor → objects → echoes → body → fields/bullets/lenses | three isolated production phases | **ADAPTED CORRECTLY structurally** |
| Tests | standalone donor is directly observable via `MAGNET_DEBUG` | old trace drove only reconstructed module | **TEST DOES NOT PROVE** |

## 5. A1 positive-control analysis

A1 succeeds because its causal chain survives the bridge:

1. the cast requires a real eligible revealed firearm;
2. the real slot is accelerated immediately and for a long enough path to create large visible motion;
3. production continuously supplies live target direction;
4. the donor's large pole/core/spine A1 pose survives;
5. filaments, pressure fronts and real object history connect the body to the moving object;
6. the mechanic produces obvious gameplay consequences such as pickups/interception.

A2 and base locomotion lack at least one of those links. A2 bullets receive force but the practical exposure is short and their history is not rendered by the Gold bridge. Base locomotion feeds the right spring equation with the wrong kinematic waveform. Wall/contact inputs arrive late or not at all. A1 is therefore retained as a regression oracle: its force law, object truth, pose and current visual consumers must not be rewritten casually.

## 6. Corrected architecture selected from evidence

This is not another hand-authored `magnetGoldV1.js` rewrite.

### 6.1 Mechanical Gold translation

- Keep the donor-derived part assets, pivots, springs, target equations and skill poses.
- Add an explicit **presentation-only donor kinematic translator**. Apex supplies movement intent/resolved root; the translator approaches the donor's visual velocity target at the donor's 1450/1850 rates and filters acceleration at the donor's fixed 1/120 step. The body root remains the real Apex position.
- Trigger hard-turn choreography from intent opposing the translated velocity, as the donor does, not from a one-frame resolved velocity flip.
- Supply wall contact-enter with pre-resolution intended normal velocity. Gold owns the unchanged `structural()`/recovery response.
- Route real `BodyCollision` contact-enter into the existing structural grammar without changing collision mechanics.
- Tighten the parity harness with deterministic lead/RNG alignment, then use donor peak, timing and settle envelopes as acceptance tolerances.

### 6.2 Coherent body physics seam

- Split body force preparation from floor integration.
- Sum A2 body accelerations once before Fighter movement.
- Expose one narrow optional external-motion hook inside canonical `Fighter.update()` after locomotion displacement and before `resolveWalls()`; dormant heroes observe no change.
- Consume prepared external velocity there so canonical wall resolution and anchor `handleCollisions()` run in the same frame after all motion.
- Remove post-collision anchor position integration.
- Decay residual body velocity through the donor-compatible body momentum decay rather than a perpetual second integrator; clean it below epsilon.
- Child bodies use the equivalent pre-separation seam and retain existing child collision ownership.

This is an external-force integration seam, not a second post-hoc separator.

### 6.3 A2 projectile proof and visibility

- Keep radius 225, acceleration 18000, quadratic falloff, speed cap and semantic tags unchanged.
- Add actual-holder browser probes across PISTOL/SMG/precision speeds and moving-field crossing angles. Compare every tick to the independent authority equation.
- Preserve projectile object identity and all semantic metadata.
- Restore donor true-history rendering for currently influenced A2 bullets so their measured trajectory is visible; do not fake a different path.

### 6.4 Real arena deformation

- Delete the regular synthetic production grid.
- Keep `dispDonor()` as the canonical local displacement field.
- Sample the already-rendered Apex arena into a bounded local surface buffer and displace those real pixels with a clipped tile mesh around active fields/bumps.
- Do not redraw a replacement floor and do not cover the arena with line art.
- Browser evidence must show changed real floor pixels only inside the local displacement bounds and no regular global line lattice.

## 7. Required implementation gates derived from this audit

1. Canonical donor parity: per-part traces for all required scenarios, with peak ratio, peak time and settle error.
2. A1 positive control: current `4aac3fb...` real floor-object outcome and donor A1 trace do not regress.
3. Real A2 projectile: actual weapon holder/emission, identity continuity, equation-level velocity trace and visible bounded history.
4. Real locomotion/wall: real production movement, canonical relative-transform envelopes and structural wall transfer.
5. Magnet/Robot stress: repeated contacts plus A2, zero end-of-frame anchor penetration beyond numerical epsilon and no persistent contact lock.
6. Floor pixels: no synthetic line grid; only actual arena pixels are locally displaced.
7. Existing gameplay/protected suites, production build, clean Git and exact local/remote SHA equality.

No automated result in this document constitutes owner visual/feel acceptance.
