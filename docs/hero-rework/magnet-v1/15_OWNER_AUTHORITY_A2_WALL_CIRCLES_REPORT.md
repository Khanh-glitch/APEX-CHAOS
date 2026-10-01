# MAGNET V1 — Owner authority correction: A2 repulsion, wall presentation root, fighter-underlay circles

Start SHA: `df3f9fbaaadef80c5c276c47dd96fc8d55857173` (verified equal to remote
`arena/01a0f736-apex-chaos` HEAD before any modification).

Scope was deliberately narrow. A1, ordinary multipart locomotion, Magnet assets
and six-part Gold construction, canonical gameplay ownership / projectile
identity / damage / crit / lifetime, the Magnet–Robot overlap collision fix and
the floor-deformation architecture are all unchanged. The Gold bridge was not
rewritten.

---

## 1. A2 BULLETS — root cause and new physical law

### 1.1 Canonical donor law (audited first)

`docs/hero-rework/magnet-v1/gold/MAGNET_FINAL_DONOR_MAX.html`, `world()`,
hostile-bullet block:

```js
if (f2 > 0) {
  const dx = b.x - hero.x, dy = b.y - hero.y, d = Math.hypot(dx, dy) || 1;
  if (d < 225) {
    const ddv = 18000 * f2 * dt;
    b.vx += dx / d * ddv;
    b.vy += dy / d * ddv;
    capV(b, b.launch * 1.1);
  }
}
```

The donor applies a **flat 18000 outward acceleration gated only by `d < 225`**.
There is **no `u^2` radial falloff anywhere in the donor projectile law**.
Donor hostile bullets are `[640, 900, 1300]` px/s (`spawnHostile`).

### 1.2 Rejected production law

`public/game/hero-rework/magnetGameplayRuntime.js`, `stepProjectiles()`:

```js
const u = clamp(1 - d / radius, 0, 1);
const accel = maxAccel * u * u;      // radius = 225, maxAccel = 18000
```

### 1.3 Exact root cause

Two compounding faults, not one:

1. **The `u^2` falloff is not canonical.** It is a production invention. Over
   the only part of the field a bullet actually traverses it is tiny: a bullet
   that reaches Magnet stops at the damaging envelope
   `radius * BULLET_HIT_RADIUS_SCALE + bulletRadius` = `75 * 0.78 + r` ≈ 63–67 px,
   so `u` never exceeds ≈ 0.70 and `u^2` never exceeds ≈ 0.49 — and it is ~0 at
   the boundary where the bullet spends most of its time.
2. **Residency time is far too short for *any* pure-acceleration law.** Donor
   bullets (640–1300 px/s) spend 0.12–0.5 s inside the field and are fully
   reversed by 18000. Production firearm bullets run 2600–6356 px/s measured at
   emission, so the 225 → ~65 px approach is covered in **1.6 (SNIPER) to 3.6
   (PISTOL) authoritative ticks**. Even the exact donor flat law cannot reverse
   5800 px/s in two ticks.

That is precisely the owner-observed behaviour: the bullet bends a few degrees
and continues through Magnet. The previously recorded PISTOL proof
(`angleDelta ≈ 0.17 rad` at ~2600 px/s) is the arithmetic consequence of (1)+(2),
not a measurement error.

### 1.4 New production law

A2 **firearm bullets only**. A1, the A2 body law and the A2 floor-firearm law
are untouched.

1. **Swept field entry.** Before canonical integration, the bullet's movement
   segment `P0 → P0 + v·dt` is intersected with the live A2 radius
   (`sweptEntry()`). This is required — see §1.6.
2. **Entry response, once per entry episode.** At the real crossing point the
   inward radial component is neutralized and converted outward:
   `vr = v·n` (negative inbound) → `v' = v_tangential + n · (−vr · e)`, `e = 1.0`.
   **Tangential velocity is preserved**, so the result is a physical repulsion,
   not a scripted reflected ray.
3. **Continued donor force.** While inside the field the bullet receives the
   canonical **flat 18000** outward acceleration (donor-consistent, `u^2`
   removed).
4. **No per-frame snap exploit.** The entry response is latched per
   (projectile, field episode) and only re-arms after the bullet genuinely
   leaves the field (`d > radius * 1.12` hysteresis). Everything else is
   continuous force.
5. **Speed cap unchanged** (`launchSpeed * 1.10`).
6. **Same projectile.** No delete, absorb, teleport, replace or ownership
   rewrite. The bullet is never moved by this pass; canonical integration still
   owns position.

### 1.5 Bullet evidence (real Arsenal emission, real Chromium)

`tools/probeMagnetA2ArsenalBullets.mjs` →
`docs/hero-rework/magnet-v1/evidence/a2-arsenal-bullet-repel.json`.
Instruments the authoritative seam (`MAG.stepProjectiles`) rather than rAF, so
no fast bullet is aliased. Damaging envelope and real damage are both checked.

| case | launch px/s | entry point | radial before → after | tangential kept | min swept dist / envelope | penetrated | damaged | entry responses | identity |
|---|---|---|---|---|---|---|---|---|---|
| PISTOL head-on | 2600 | (280.4, 548.8) | −2526 → +2526 | 615.9 | 238.9 / 65.5 | no | no | 1 | stable |
| PISTOL off-axis | 2600 | (283.0, 550.7) | −2532.4 → +2532.4 | 589.2 | 241.4 / 65.5 | no | no | 1 | stable |
| SMG head-on | 3410 | (280.3, 548.5) | −3058.7 → +3058.7 | 504.3 | 315.0 / 64.5 | no | no | 1 | stable |
| SMG off-axis | 3410 | (282.6, 558.1) | −2950 → +2950 | 952.6 | 315.5 / 64.5 | no | no | 1 | stable |
| SNIPER head-on | 6355.7 | (285.4, 567.6) | −5532.2 → +5532.2 | 1742 | 294.8 / 66.5 | no | no | 1 | stable |
| SNIPER off-axis | 6355.7 | (285.4, 567.6) | −5532.2 → +5532.2 | 1742 | 290.0 / 66.5 | no | no | 1 | stable |

Negative controls (identical shot, **A2 inactive**):
`PISTOL` min swept 85.8 px and **Magnet actually took damage**;
`SNIPER` min swept 67.6 px against a 66.5 px envelope (reaches the surface).
With A2 active the same shots stay 238–315 px away. The field is doing the work,
not the test setup.

Headless analytic probe `tools/probeMagnetA2BulletRepel.mjs`
(`a2-bullet-repel-probe.json`) additionally covers 30 Hz and 60 Hz tick rates,
the already-inside-at-cast case (1 entry response, bullet pushed back outside
225, no repeated snap) and confirms the speed cap and identity invariants.

### 1.6 Was swept boundary entry required?

**Yes.** At 60 Hz a SNIPER bullet advances ~97 px per tick (and more under
frame-time spikes), while the boundary-to-envelope gap is only ~158 px. Position
sampling alone (`distance(currentBulletPosition, Magnet) < 225`) yields at most
one interior sample, taken deep inside the field, and under larger `dt` can be
skipped entirely. The measured `influencedTicks` for SNIPER is **2**, with the
entry response landing at the real crossing. Without the swept test the response
would fire late and off the true contact normal. The bullet is never teleported;
only its velocity changes.

---

## 2. WALL RESPONSE — root cause and screen-space correction

### 2.1 Exact mismatch root cause

The pre-existing parity harness compares the six **local** rig transforms, which
are expressed in the rig's own frame and are therefore blind to the root those
transforms are attached to. Measured here: local six-part RMSE around impact is
**2.27–3.50 px** — i.e. "near zero" — while the rendered Magnet still leaves the
wall on the wrong curve.

The actual divergence is in the root:

* **Donor** (`heroStep`): clamps the hero to the wall, then **reflects the normal
  velocity** — `hero.vn = n · ap · e`, `e = 0.4` above 140 u/s else `0.05`,
  tangent preserved — and brakes the rebound at the no-input locomotion rate
  1850 u/s². The donor root leaves the wall with an **impulse spike**.
* **Apex production**: clamps the gameplay body and re-drives it from locomotion
  / heading reversal. There is no rebound impulse.
* Production rendered the Gold rig **directly on the authoritative Apex root**,
  so the whole rendered Magnet inherited the Apex curve.

Measured in screen space (`wall-screen-space-parity.json`, 420 u/s impact):
donor root travels **+3.39 → +3.50 px** off the wall over the first 0.05–0.45 s;
the production gameplay root travels **0 px** (pinned). That constant −3.5 px
error is the missing donor rebound.

### 2.2 Correction

Presentation-only, in `magnetGoldV1.js`:

* `startVisualWallRebound()` fires from the **true collision** — the frame the
  authoritative root first reaches the wall threshold — and uses the **actual
  pre-resolution contact velocity** supplied by the production adapter
  (`motion.contactVx/contactVy` = locomotion + engine force + external velocity),
  not the Gold locomotion proxy. Gate is donor's own `inward > 25`.
* The donor rebound is integrated (`v0 = inward · e`, braked at 1850) and the
  render offset target is
  `clamp(donorNormalTravel − authoritativeNormalTravel, ±28 px)` —
  i.e. exactly the minimum translation needed to put the rendered root back on
  the donor curve, and nothing more.
* Hard bounds: **28 px** maximum offset, **0.45 s** maximum episode, convergence
  back to the authoritative root at 40 s⁻¹, offset snapped to exactly 0 on exit.
* Applied **only** to `drawPart` (the actor), `transformPoint` (sockets, so
  filaments stay attached) and structural `addEcho` ghosts. The A2 reactive
  field and object-pressure arcs still draw on the gameplay root, because those
  represent real gameplay radii.

Gameplay root, hitbox, collision and wall authority are untouched; spring
constants were not changed.

### 2.3 Measured result

| metric | value |
|---|---|
| local six-part RMSE around impact (old harness view) | 2.268 px |
| donor rebound (screen space) | 3.50 px |
| production visual rebound (peak offset) | **6.93 px** |
| reproduces donor rebound | yes |
| residual offset after episode | **0.000 px** |
| bounded (≤ 28 px) | yes |
| hitbox ever diverges from gameplay root | **no** (every sample) |
| episode length | hard-capped at 0.45 sim s |

The donor figure of 3.50 px is itself under-sampled (the donor sim runs at
1/120 while the capture runs at rAF); the analytic donor peak for a 420 u/s
impact is `(420·0.4)² / (2·1850) = 7.6 px`, which the measured 6.93 px matches
closely.

Note: wall-clock settle time reported by the probe is not meaningful — headless
rAF is heavily throttled. The episode is bounded in **sim** time by
`WALL_VISUAL_MAX_AGE = 0.45 s`.

---

## 3. UNWANTED CIRCLES UNDER FIGHTERS

### 3.1 Reproduction and provenance

`tools/probeMagnetGroundCircles.mjs` instruments
`CanvasRenderingContext2D.arc` / `ellipse` in the real production preview and
captures the caller stack. Reproduced on **MAGNET + MIRROR**, matching the owner's
"Magnet and at least one other champion":

```
[12x] arc      on=[MAGNET,MIRROR]  r=73.5   stroke=rgba(240,244,250,0.35) lw=2
[12x] ellipse  on=[MAGNET,MIRROR]  69x25.5  fill=rgba(8,8,8,0.35)
   at F.draw (/game/arsenal/arsenalChamberPaletteRuntime.js:293:15)
   at F.draw (/game/arsenal/arsenalChamberPaletteRuntime.js:288:15)
```

### 3.2 Exact source removed

**`public/game/arsenal/arsenalChamberPaletteRuntime.js`**, the
`F.prototype.draw` wrapper installed by `installWrappers()` (lines 272–299 at
the start SHA). It added, for every fighter whose `heroId` was not `HUNTER` or
`ROBOT`:

```js
c.ellipse(this.x, this.y + r * 0.72, r * 0.92, r * 0.34, 0, 0, Math.PI * 2); // grounding shadow
c.arc(this.x, this.y, r * 0.98, 0, Math.PI * 2);                              // faint rim ring
```

Both are purely decorative chamber-palette "geometric separation" graphics. They
are **not** projectile rings, **not** A1 object acknowledgement rings, **not**
Gold skill arcs and **not** status visuals. Only this block was removed; the
chamber palette's real recolour / `actorRender` separation path (which still
uses `profile.keyline`) is untouched, and no `arc()` was deleted anywhere else.

### 3.3 Verification

Re-running the same probe after the fix: fighter-centred arc/ellipse calls
**12 → 0**, `unwantedUnderlayGroups: 0`, probe PASS.

---

## 4. A1 REGRESSION ORACLE

A1 was treated as a positive control and not modified. Its law in
`stepProjectiles` is byte-for-byte the original `u^2` attract law (radius 480,
accel 14000).

* Analytic oracle (`a2-bullet-repel-probe.json → a1Oracle`): an off-axis PISTOL
  bullet is pulled **toward** Magnet — distance 494 → 251.2 px, total inward
  ΔV **+495.5** — PASS.
* `testMagnetGoldMotionTrace` — PASS, including
  `a1-left-right-directional-body-lead` and `a1-zero-object-neutral-finite`.
* `testMagnetV1GameplayGates` 27/27 and `testMagnetV1PresentationGates` 13/13
  include the A1 acquisition, late-reveal and acknowledgement-ring gates.

---

## 5. Files changed

| file | change |
|---|---|
| `public/game/hero-rework/magnetGameplayRuntime.js` | A2 firearm-bullet swept entry + repel law; A1/body/floor laws untouched |
| `public/game/hero-rework/magnetGoldV1.js` | bounded presentation-only visual wall rebound root |
| `public/game/arsenal/arsenalChamberPaletteRuntime.js` | removed the decorative fighter-underlay ellipse + rim ring |
| `src/game/runtimeManifest.js`, `tools/runtimeRevision.lock.json` | revision `20261001-magnet-v1-r5` → `r6`, re-locked (38 runtimes) |
| `tools/testMagnetV1RealBrowser.mjs`, `tools/testMagnetCanonicalGoldParity.mjs`, `tools/testChamberPaletteGates.mjs` | environment compatibility only: `@sparticuz/chromium` ≥ 121 no longer exports `inflate()` |
| `tools/probeMagnet*.mjs` (4 new) | targeted diagnostics |

---

## 6. Regression results

### 6.1 Magnet suites — all green

| suite | result |
|---|---|
| `testMagnetV1RealBrowser` (real Chromium, 21 gates) | **PASS** |
| `testMagnetCanonicalGoldParity` (donor vs production, real browser) | **PASS** |
| `testMagnetV1GameplayGates` | **PASS** 27/27 |
| `testMagnetV1PresentationGates` | **PASS** 13/13 |
| `testMagnetV1PresentationSemantics` | **PASS** |
| `testMagnetMotionAuthorityGates` | **PASS** |
| `testMagnetV1SchedulerParity` | **PASS** |
| `testMagnetGoldMotionTrace` | **PASS** |
| `testChamberPaletteGates` | **PASS** 15/15 |
| `testRuntimeRevisionGate` | **PASS** (38 runtimes, r6) |

Canonical Gold parity is worth calling out: the wall change did **not** cost
local six-part fidelity — `polR` RMSE 0.119 / max 0.576, `lobeL` RMSE 0.020,
`lobeR` RMSE 0.026, peak ratios 0.915–0.931, peak time delta 0.067 s.

### 6.2 A1 positive-control oracle (in-browser)

`a1-positive-control-real-object` **PASS** — A1 acquires exactly **one** real
object, drives `a1Target.x` to **−0.986** and `desiredA1Target.x` to **−1.0**,
and renders **1** acknowledgement ring. `a1-field-render-frame-budget-measured`
**PASS** — A1's marginal render cost is **28.5 ms** over the same scene idling.

### 6.3 A2 repulsion in the shipping suite

`actual-firearm-a2-projectile-repulsion` **PASS**:
radial velocity **−2484.5 → +2484.5** at the true crossing (286.4, 549.4),
tangential 766.4 preserved, **1** entry response, closest approach **264.4 px**
against a **65.5 px** damaging envelope, `penetrated=false`, `damaged=false`,
identity stable, life decreasing normally.

### 6.4 Protected (non-Magnet) regressions

| suite | result |
|---|---|
| `testHeroReworkLocomotionGates` | PASS 4/4 |
| `testHeroReworkRobotGates` | PASS 11/11 |
| `testHeroReworkSlimeGates` | PASS 9/9 |
| `testHeroReworkGoldens` | fail — **pre-existing** |
| `testHeroReworkRobotPresentationGates` | fail — **pre-existing** |
| `testFrostV1Gates` | fail — **pre-existing** |
| `testCrystalaGameplayGates` | fail — **pre-existing** |
| `testHeroReworkHunterOwnerFixGates` | fail — **pre-existing** |

The five failures were verified against a clean checkout of the start SHA
`df3f9fba` (changes stashed, suites re-run, changes restored) and reproduce
there with **identical failure sets**. They are not caused by this work. For
the record they are:
`golden-crystal-reflect-ice-payload`, `golden-rubber-stores-reflected`;
`P-A1-lock-dash-single-dispatch-bus`, `P-A1-dash-1-sfx`, `P-A2-auto-hits-per-hit`,
`P-passive-*`; `F00.4-revision-lineage`, `F12.22-frost-battle-scale`,
`F12.26-full-lifecycle-Gold-parity`; Crystala gameplay; `runtime-cache-bust`.

### 6.5 Test-harness changes (no product semantics)

Three browser harnesses needed environment repair before they could run at all:

* `@sparticuz/chromium` ≥ 121 no longer exports `inflate()`; all three call
  sites now tolerate both APIs.
* Headless swiftshader rasterises this 1280×1100 canvas at **1255 ms/frame**
  versus **176 ms/frame** on the plain software path, which blew the CDP
  protocol budget. `--disable-gpu` plus rAF anti-throttling flags fixed it.

Two gate definitions were corrected, both because they asserted the host rather
than the product:

* `a1-positive-control-real-object` read A1 state after a fixed 24 frames. A1
  lasts 1.0 s of sim time, so on a slow host the ability expired inside a
  single frame and the acquired object was gone before it was read. It now
  polls every frame and keeps the peak observation — same assertion, no
  wall-clock race. **A1 itself was not modified.**
* `a1-field-render-frame-budget-measured` asserted absolute frame time < 40 ms,
  which measures the machine. It now asserts A1's *marginal* cost over the same
  scene idling.

And one gate was superseded by owner authority:

* `actual-firearm-a2-projectile-curves` required `|angleDelta| > .002` and
  `influencedTicks >= 2` — criteria that the **rejected** "bend slightly and
  penetrate" behaviour satisfies, and which correct repulsion can fail (a
  properly repelled bullet is ejected so hard it leaves the field in one tick).
  Replaced by `actual-firearm-a2-projectile-repulsion`, which asserts the
  owner's actual criterion: inward radial velocity converted outward exactly
  once at the true crossing, and the bullet never reaching the damaging
  envelope or dealing damage.

---

## 7. Not claimed

Owner visual acceptance is **not** claimed. Every result above is instrumented
measurement — authoritative projectile ticks, screen-space root positions and
Canvas call provenance. Whether the wall reaction and the de-cluttered fighters
now *look* right to the owner can only be settled by an owner playtest.
