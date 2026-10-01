# Magnet V1 — Corrected Gold→Game Bridge Implementation Report

**Date:** 2026-10-01  
**Branch:** `arena/01a0f736-apex-chaos`  
**Rejected recovery point preserved:** `4aac3fbb831bfaf1ac4f19336607763f16234c12` (`FAILED_OWNER_PLAYTEST_GOLD_TRANSFER`)  
**Canonical donor:** `gold/MAGNET_FINAL_DONOR_MAX.html`  
**Canonical SHA-256:** `468f7b2aa34588c2c52bf23fb5202c507ff5d584d423ea9f1a9232d751247d8b`

> This report records implementation and automated evidence. It does **not** claim owner visual acceptance.

## 1. Result

The rejected bridge was corrected at its two failed seams rather than patched symptom by symptom:

1. Magnet presentation now receives normalized production movement intent and runs a mechanical translation of the donor's own 420 px/s, 1450/1850 px/s² kinematic block before feeding the unchanged fixed-step Gold histories, lag buffers, cues, targets, and springs.
2. A2 body force is prepared before `Fighter.update()`, consumed after canonical locomotion, and therefore reaches canonical wall resolution and fighter collision in the same frame. The rejected post-collision position sidecar is no longer used in production.

The remaining owner-visible failures were corrected at their source:

- A2 histories render for actually influenced A2 bullets, not only A1-selected histories.
- Arena reaction samples and deforms already-rendered canvas pixels in local patches. The synthetic full-arena line grid was removed.
- Real `BodyCollision` events drive Magnet's structural contact response.
- A1 keeps its locked gameplay law and positive-control behavior; presentation target phase, cast-side selection, and near-firearm response now follow the donor path.

## 2. Root-cause corrections

### 2.1 Rigid multipart locomotion

The rejected bridge differentiated consecutive resolved roots and fed the resulting instantaneous Apex velocity directly into a donor rig authored around acceleration-limited motion. That bypassed the donor acceleration envelope and collapsed secondary-part motion.

The corrected adapter captures input intent before movement and resolved root after movement. Gold keeps the resolved root only as the rendered anchor while a presentation-only donor kinematic proxy computes velocity, acceleration, movement-start, stop, hard-turn, lead-side, lag-buffer, and wall response. Gameplay position remains entirely authoritative in Apex.

### 2.2 Wall behavior

Wall contact is detected from the real post-movement root and pre-resolution intent. The presentation proxy then executes the donor's reflection and re-contact sequence at Gold's art bounds. This preserves canonical wall choreography without moving the gameplay body.

### 2.3 Magnet/Robot overlap

A2 now has an explicit force-preparation/consumption seam:

- `magnetGameplayRuntime.prepareBodyForces()` accumulates velocity before fighter updates.
- `Fighter.update()` calls the optional hero-rework external-motion seam after locomotion and before `resolveWalls()`.
- Canonical anchor collision runs after both motions.
- The later pickup seam updates floor firearms only and cannot translate fighter anchors after collision.

The old direct/unit `stepWorld()` path remains compatible for isolated law tests, but shipping runtime passes `skipBodyForces: true` at the pickup seam.

### 2.4 A2 bullet readability

The semantic adapter already identified real influenced A2 projectiles, but the renderer selected histories only from the A1 set. `drawHistories()` now selects A1 objects plus A2 objects whose real kind is `bullet`. It does not synthesize projectiles or mutate projectile identity, ownership, damage, or lifecycle.

### 2.5 Arena floor

The rejected `drawDynamicGrid()` approximation was removed. `drawFloorDistortion()` now evaluates the donor displacement field at bounded local sites and uses clipped self-canvas sampling to deform pixels the arena already rendered. Real-browser telemetry recorded 60 local copies with a maximum 92×92 px patch on a 1000×1000 canvas; no global floor replacement was drawn.

## 3. Canonical parity

`tools/testMagnetCanonicalGoldParity.mjs` executes the exact hash-locked donor in Chromium and the shipping Gold module with matched deterministic stimuli. The final alignment did not relax tolerances. It removed test contamination from donor state that `reset()` does not clear, matched A2 cast-side RNG explicitly, supplied real nearest-object truth to A1, and aligned real-wall contact timestamps before comparison.

| Scenario | Weighted six-part RMSE | Result |
|---|---:|---:|
| Locomotion | `0` | PASS |
| Hard reverse | `0` | PASS |
| Wall | `0` | PASS |
| A1 | `0.5033036335377085` | PASS |
| A2 | `0.17632314763635518` | PASS |
| Passive from real emission phase | `0.49032012957155047` | PASS |
| Idle | `0.05685198902533325` | PASS |

The complete timestamped x/y/rotation/scale traces for all six parts are in `evidence/canonical-gold-parity.json`.

## 4. Real-browser production evidence

`tools/testMagnetV1RealBrowser.mjs` runs the shipping page in Chromium under real `requestAnimationFrame`, wraps the actual canvas, and uses production Fighter, holder, projectile, collision, and draw loops.

### Actual PISTOL → A2 projectile

- Type: `aq_bullet`
- Weapon: `PISTOL`
- Launch speed: approximately `2600 px/s`
- Stable owner/type/weapon identity: PASS
- Influenced authoritative frames: `6`
- Direction change: about `-0.16824132117446752 rad`
- Projectile life continued to decrease: PASS
- Real A2 projectile histories observed: `2`

### Production locomotion

Every one of the six parts exceeded the real-browser articulation threshold for sustained travel and hard reverse. Example sustained maxima were core `2.39`, spine `3.80`, poles `5.57/3.95`, and lobes `3.62/3.65`. Stop displacement of the gameplay root was `0`, while the six-part stop choreography continued.

### Actual wall

- Minimum gameplay x: `75`, equal to the canonical Fighter radius boundary.
- Wall echoes: `1`
- Wall displacement bumps: `1`
- All six parts showed structural motion; maxima ranged from about `4.36` to `7.16` weighted units.

### Magnet vs Robot contact

After legitimate A2 momentum preparation and directed exact contact:

- BodyCollision events for Magnet: `1`
- Structural contact bumps: `1`
- Maximum penetration: `0 px`
- Penetrating frames: `0/24`

### Real arena localization

- Local rendered-canvas copies: `60`
- Largest destination patch: `92×92 px`
- Canvas: `1000×1000 px`
- Synthetic grid strokes in `drawFloorDistortion()`: none

Full telemetry is in `evidence/corrected-real-browser.json`.

## 5. A1 positive control and protected systems

A1 gameplay constants and force laws were not changed. The gameplay suite still proves immediate cast/window behavior, floor-firearm attraction, late reveal, bullet radius/force/cap, T6 immunity, Mirror isolation, and pickup priority. The real-browser A1 positive control accepted the cast, consumed one real floor firearm, tracked leftward (`desired.x = -1`), and stayed within the measured frame budget (`18.8125 ms` mean in the recorded run).

Protected suites remained green:

| Suite | Result |
|---|---:|
| Magnet gameplay | 27/27 PASS |
| Magnet presentation | 13/13 PASS |
| Magnet motion trace | PASS |
| Magnet semantic/scale/socket | PASS |
| Magnet scheduler parity | PASS |
| Canonical donor parity | PASS |
| Real Chromium production gate | PASS |
| Robot gameplay | 11/11 PASS |
| Robot recoil | 6/6 PASS |
| Crystala Gold parity | 25/25 PASS |
| Slime core | 9/9 PASS |
| Slime kit | 5/5 PASS |
| Slime legacy separation | 6/6 PASS |
| Slime owner-fix | 7/7 PASS |
| Hero locomotion | 4/4 PASS |
| Runtime revision/hash lock | PASS (`20261001-magnet-v1-r4`, 38 runtimes) |
| Production Vite build | PASS |

Mirror gameplay hash protection and Magnet's Mirror copy/swap gates remain green. No locked Magnet balance value, semantic tag, transaction rule, or protected Mirror mechanic was changed to clear presentation residuals.

## 6. Durable checkpoints

1. `4aac3fbb831bfaf1ac4f19336607763f16234c12` — preserved rejected recovery point.
2. `e42fb25c437dc51f34ee6ad0d9697a6e4fe670d7` — third forensic audit and rejected-tip canonical traces.
3. `e73b588fee28f285e51bf4dfff2d8ed2a9e85787` — pre-collision A2 body-force integration.
4. `42e00d8d2ab23ed9e811ad7865089d98b0c718f0` — donor kinematic translation, histories, contact response, and local arena deformation.
5. `6f22c77192208df7280b1565e03d66813f0fe500` — real-browser production gate and corrected telemetry.

Each checkpoint was pushed to `arena/01a0f736-apex-chaos` and its remote SHA was verified before work continued.

## 7. Acceptance boundary

Automated gates now support the corrected architecture and falsify the four defects observed at the rejected tip. They do not constitute subjective owner approval. Owner playtest remains the authority for visual acceptance.
