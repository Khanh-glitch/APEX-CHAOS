# MAGNET A2 — CONTINUOUS NONLINEAR RADIAL FIELD (H-PHYS2)

Status: **H-PHYS2 COMPLETE — W1-W7 wired and green.**

> **CORRECTION (owner-reported, binding).** An earlier revision of this document
> claimed Hunter at 2200 px/s "turns at ~124.6 px, safely outside body contact
> at 150 px". That is backwards: an inward object reaches d=150 BEFORE d=124.6,
> so the old K=29700 let Hunter make legal body contact before turning. The
> coupling is recalibrated below against **all** guaranteed contact envelopes,
> and Hunter — not the projectile — is the binding case.

---

## 1. Owner rating

```
A2_RADIAL_STOP_RATING = 3500 px/s   (INWARD RADIAL COMPONENT, not scalar speed)
```

Not a clamp, not a branch, not a speed limit, not an outward target. It is the
single calibration anchor from which the one coupling constant is derived.

---

## 2. §3 SOURCE AUDIT — **the brief's figures do not match current source**

The brief asked for verification before tuning and said to report any
difference rather than silently adjust. **There are differences.** Authority
file: `public/game/arsenal/arsenalIdentityRuntime.js` (the only file defining
`bulletSpeed` for live firearms; `arsenalCWeaponSet.generated.js` is an art
manifest and carries no speeds).

| | brief stated | **measured at `5c98e2d`** |
|---|---|---|
| firearm profiles | 24 | **20** |
| median | ~3050 | **2950** |
| mean | ~3233 | **3302.5** |
| max non-precision | 3500 | **3400 (M16)** |
| precision tier | MBR 5200 / MBR2 5400 / SNIPER 5800 | **MBR 5000 / MBR2 5200 / SZECSEI_FUCHS 5400 / SNIPER 5800** |
| `Z15` / `Z15_S3` @ 3400/3500 | listed | **do not exist** — `ZBROYAR_Z15` is an art asset only, no weapon profile, no speed |

Full measured distribution (all 20, px/s):

```
2100 SAWED_OFF      2400 MOSSBERG_500   2400 JACKHAMMER    2500 BERETTA_93R
2500 SHOTGUN        2550 GLOCK_17       2600 PISTOL        2800 TEC_9
2800 DESERT_DEAGLE  2900 MAC_10         3000 MAGNUM_500    3100 SMG
3100 M249_SAW       3200 P90            3300 AK_47         3400 M16
5000 MBR            5200 MBR2           5400 SZECSEI_FUCHS 5800 SNIPER
```

**The 3500 rating is kept unchanged**, and the audit actually strengthens it:
the real non-precision ceiling is **3400**, so 3500 covers all 16 standard
weapons with 100 px/s of headroom, and the gap to the precision tier is
**3400 → 5000**, cleaner than the brief assumed. No owner number was altered.

**Consequence for the guarantee.** Magnet passive is `PASSIVE_SPEED_MULT = 1.18`.
A boosted M16 is `3400 × 1.18 = 4012 px/s`, which is **outside** the guaranteed
tier despite being a "standard" weapon — consistent with §17 (classify by actual
inward radial velocity, never by weapon name).

---

## 3. Field law (§6)

```
S(d) = (R / max(d, dSafe))^2 - 1      for d <  R
S(d) = 0                              for d >= R

a(d) = K * S(d), directed radially OUTWARD from the live Magnet centre
```

`R = 225`, `dSafe = 24`, `S(dSafe) = 86.89` (finite). Verified:

* `S(R) = 0.000000` exactly; `S(R-1e-9) = 8.889e-12` → continuous at R, no
  boundary impulse;
* monotonically increasing as `d` falls, checked at every integer `d` in `[1,225]`;
* finite everywhere.

Inverse-square **inspired** gameplay field. Deliberately not documented as a
literal physical dipole.

---

## 4. Derived coupling (§7, §18) — one knob, bound by the WORST case

`tools/calibrateMagnetA2Field.mjs` derives the single coupling `K` from the one
rating by bisection **on the real discrete integrator** at every supported rate.

The coupling is **not** set by the projectile case. Each guaranteed interaction
has its own legal contact envelope, and an inward object reaches a **larger**
envelope **earlier**. Hunter's body-contact envelope (150 px) is nearly twice
the projectile's (84 px), so even at the lower 2200 px/s pounce speed it is by
far the more demanding constraint. `K` must be the **maximum** demanded across
every guaranteed case.

| case | v_radial | envelope | K_min (bisected) | closed form |
|---|---:|---:|---:|---:|
| projectile-3500 | 3500 | 84 | 25866.6 | 25879.0 |
| **hunter-pounce-2200 (BINDING)** | **2200** | **150** | **64081.2** | **64533.3** |

```
BINDING K_min = 64081.2   (hunter-pounce-2200)
modest margin x1.15
CHOSEN  A2_FIELD_COUPLING = 73700
```

Closed form: `W(d) = K * (R^2/d + d - 2R)`, turning point at `W = v0^2/2`. Its
independent agreement with the numeric bisection cross-validates that the
coupling is derived, not fitted.

`K` is deliberately **not** raised further: the goal is the smallest field that
honestly earns the 3500 rating, explicitly not maximum defence (§18).

## 5. Turning-radius table (required by §18)

Head-on, A2 active before entry, `K = 73700`.

| v0 | closed form | dt=1/30 | dt=1/60 | dt=1/120 | vs 84 (bullet) | vs 150 (body) |
|---:|---:|---:|---:|---:|---|---|
| **2200** | 153.9 | 154.2 | **154.1** | 154.4 | outside | **outside** |
| 2600 | 143.8 | 144.1 | 144.1 | 144.4 | outside | reaches |
| 3000 | 134.4 | 134.7 | 134.7 | 135.0 | outside | reaches |
| 3200 | 130.0 | 130.3 | 130.3 | 130.4 | outside | reaches |
| 3400 | 125.7 | 126.0 | 126.1 | 126.1 | outside | reaches |
| **3490** | 123.8 | 124.1 | **124.2** | 124.2 | outside | reaches |
| **3500** | 123.6 | 123.9 | **124.0** | 124.0 | outside | reaches |
| **3510** | 123.4 | 123.7 | **123.8** | 123.8 | outside | reaches |
| 5000 | 96.8 | 97.2 | 97.3 | 97.4 | outside | reaches |
| 5200 | 93.8 | 94.3 | 94.3 | 94.4 | outside | reaches |
| 5400 | 90.9 | 91.0 | 91.1 | 91.2 | outside | reaches |
| 5800 | 85.4 | 85.4 | 85.4 | 85.6 | outside | reaches |

* every `<= 3500` entry stays outside the 84 px damaging envelope;
* **Hunter 2200 turns at 154.1 px, outside the 150 px body-contact envelope** —
  the constraint the previous revision got wrong;
* **no discontinuity at the anchor**: 3490 -> 3510 differ by **0.40 px**;
* turning radius decreases **monotonically** with inbound radial speed;
* dt spread across 30/60/120 Hz `<= 0.5 px`.

### High speed is CONDITIONAL, never binary (§2, §5, §19, §20)

No weapon-ID branch and no speed threshold exists anywhere. The same law
produces all of these:

```
penetration  v=5400 engaged at d=110 -> minD 73.1  HITS
penetration  v=5800 engaged at d=150 -> minD 80.2  HITS
penetration  v=5800 engaged at d=110 -> minD 69.7  HITS
reversal     v=5400 engaged at d=150 -> minD 84.9  stopped
deflection   v=5800 at 70deg off-axis (inward radial 1984) -> minD 159.9  DEFLECTED
deflection   v=5800 at 75deg off-axis (inward radial 1501) -> minD 173.8  DEFLECTED
deflection   v=5400 at 72deg off-axis (inward radial 1669) -> minD 168.8  DEFLECTED
```

The same 5800 weapon penetrates or is deflected purely according to its **inward
radial component**, which is the point of §17.

## 6. Guaranteed vs non-guaranteed (§21)

**Guaranteed** — A2 active before entry; object crosses `R=225` normally from
outside; inward radial component at entry `<= 3500`; shipping-valid state;
supported dt; no unrelated reposition inside the field.

**Not guaranteed** — A2 activates when the object is already deep inside; object
materialises inside; actual inward radial `> 3500` (including a passive-boosted
standard weapon at 4012); T6 / manipulation-immune exclusions; uncalibrated
future content; external effects adding inward energy after entry.

The field still acts in every eligible non-guaranteed case; only the *guaranteed
outcome* changes.

Hunter pounce is `2200 px/s` inward, well under 3500, so with A2 active before
entry it falls in the guaranteed tier. At the final coupling it turns at
**~154 px**, outside the **150 px** body-contact envelope. (An earlier revision
of this file said `~124.6 px` and called that "outside" 150 — that was the
inverted-inequality error this document's header records; an inward object
reaches 150 *before* 124.6. The value is corrected here so the stale number is
not propagated.) That is **not** Hunter-specific protection; it is purely
`2200 < 3500` under the shared law, and the real-browser Hunter suite is the
behavioural authority.

---

## 7. W1 — projectile law wired (green)

`tools/testMagnetA2ContinuousField.mjs` — **17/17** against the REAL shipping
projectile pass. Evidence: `evidence/a2-continuous-field-w1.json`.

**The invisible wall is gone.** Removed from the projectile path:
`applyA2BulletRepulsion` (deleted), the `radialAfter: 0` snap at the R crossing,
the `A2_BULLET_ENTRY_RESTITUTION` response, and the 0.07 s capture envelope that
*set* radial velocity. `A2_BULLET_ENTRY_RESTITUTION` remains declared but is no
longer consulted; gate `A7` statically forbids the wall law returning.

`R=225` swept detection is retained, but now means only **"force integration
starts here"**, never "collision occurred here". Measured at entry:
speed `3000 -> 2998.1` px/s, i.e. **velocity is continuous across the boundary**
(gate `B5`).

Integration is semi-implicit Euler with bounded deterministic substeps
(`A2_FIELD_SUBSTEP_PX = 2.0`, max 64), inside the existing canonical pass — no
second integrator, no rendering clock, no raw timers.

**Ordered path truth (§12).** The frame's real curve is published as ordered
sub-segments (`pathPoly`, up to **25 segments/frame** observed) and
`HR.geom.pathSegments()` returns them verbatim, prefixed by the pre-field leg.
Crystal / Mirror / body contact therefore consume the actual curve, never a
frame-start -> frame-end chord. `clearPath()` clears the polyline too.

Two real defects were caught by the protected suites during W1 and fixed, not
suppressed:

1. **velocity blow-up** — `S(dSafe) ~ 86.9` gives `a ~ 6.4e6 px/s^2`, and the
   plan path had dropped the canonical projectile speed cap. The same
   `BULLET_SPEED_CAP_MULT` bound the pre-H-PHYS2 continued-force path used is
   now applied per substep. It bounds magnitude only and never direction, so it
   cannot reintroduce a radial SET.
2. **direct-caller regression** — routing everything through the plan meant
   unit callers of `stepProjectiles` saw no force at all. The integrated
   velocity is now also written there (position deliberately is not, since
   `reworkUpdateProjectiles` samples `px/py` after the call and owns the single
   position integration, assigning exactly these same `postV` values).

`M06.2` passes again **without weakening the test** — the real field genuinely
pushes the bullet outward, so the assertion holds on its own merits.

## 8. W2 — body + floor gun on the shared field (green)

Both now consume the **same** `S(d)` as the projectile law.

**Body.** The previous linear radial-SPEED target
(`fall = 1 - d/radius`, `A2_BODY_PUSH_SPEED`, `A2_BODY_PUSH_APPROACH`
controller) is replaced by true force integration `dv = a*dt` with
`a = K * S(d)`. The radial component is never SET and tangential motion is
never destroyed, so a body can slide/curve around Magnet. Overlapping hostile
fields **sum acceleration vectors** (§23), so iteration order cannot change the
outcome. The body is the binding calibration case, so it consumes `K = 73700`
directly with no extra per-object factor.

**Floor firearms.** The `u^2` curve is no longer an independent authority
(§16); they consume `K * S(d)` too. `gunSpeedCap` remains their
interaction-model bound, and wall / body / pickup authority is untouched.

**Bounded substeps.** Body force integrates at `A2_BODY_SUBSTEP_SECONDS =
1/480`, re-evaluating `S` at the body's advancing position. A single Euler step
over a large `dt` overshot badly (the first attempt produced a 3500 px/s launch
from one 0.1 s step) — exactly the explosive numerical launch §15 forbids.

### `bodyRadialSpeedCap: 650` is superseded, with proof

The legacy cap could add at most **650 px/s** outward against a **2200 px/s**
inbound pounce, leaving **1550 px/s** of net closing speed. It is therefore
*mathematically incapable* of satisfying §14 under any coupling. The A2 field
bound is now the single owner rating (3500). This is the one previously
protected number H-PHYS2 forces to change, and it is reported rather than
quietly adjusted.

### Hunter result — §14 satisfied, and it is not a special case

`tools/testHunterPouncePhysicalContactRealBrowser.mjs` — **14/14**.

| gate | result |
|---|---|
| H4a no field | Hunter external velocity **0.0**, catch lands (stun 0.878) |
| H4b field participates | external velocity **3500**, stun **0** |
| **H4c blocked per rating** | with field **stun 0**, without field **stun 0.878** |
| **H5 ejection, not suppression** | overlapping start 120 px → **425 px**, external 3500, no stun |
| **H5b not Hunter-specific** | a **Robot** body at the same 120 px → **425 px**, external 3500 |
| **H6a/H6b field expiry** | blocked while up; after expiry the same catch lands (stun 2.0, catch ×1) |

So the absence of a CC-immunity special case is shown four ways: `S30` static
(no branch in source), `H5` dynamic (Hunter is *physically ejected*, not denied),
`H5b` generic (identical law on a non-Hunter body), `H6b` recovery (the catch
works the instant the field ends).

### Owner-visible consequence to be aware of

At the 3500 rating the field is strong by necessity — it must turn a 2200 px/s
pounce within 75 px. Consequences:

* **While A2 is active, Hunter cannot land A2 on Magnet from any configuration
  tested**, including an overlapping start, because the 0.16 s prelaunch gives
  the field time to eject. This is emergent physics, not immunity, but it is
  effectively a hard counter and the owner should see it.
* Bodies and floor guns deep inside are expelled past `R` within ~0.1 s.

## 9. Honest measurement notes (audit requirements carried forward)

**Shipping dt convergence is NOT the calibration-model figure.** The analytic
model converges to `<= 0.5 px` across 30/60/120 Hz. The REAL shipping runtime
measures, for the 3000 px/s case, **139.8 / 139.0 / 134.8 px — a ~5 px spread**.
Gate `N1` asserts the real runtime tolerance (`< 16 px`), not the model figure.
The two must not be conflated.

**High-speed evidence is runtime consumption, not model minimum radius.** The
calibration model predicts a 5800 shot engaged at `d=110` reaches `minD 69.7`.
The shipping probe does **not** measure 69.7: it records the projectile being
**consumed inside the field** (`consumedInsideField: true`) from a pre-step
distance of **126.7 px**, which is the real evidence of a hit. Gate `C2` passes
on the measured consumption, not the modelled radius.

## 10. W3-W7 (complete)

### The 3500 rating is no longer reused as a velocity cap (W2 audit issue)

W2 capped field-driven body speed at `A2_RADIAL_STOP_RATING`, conflating a
field POWER anchor with a speed ceiling. Both uses are now separately named and
separately derived, and neither determines a physical outcome:

| constant | value | derivation |
|---|---:|---|
| `A2_RADIAL_STOP_RATING` | 3500 | owner-facing field power anchor. Calibration only. Never compared against a speed at runtime. |
| `A2_FIELD_MAX_WORK_SPEED` | 2351.1 | the most work the field can do on a **free** body: collision forbids d<150, so `sqrt(2K(R^2/150+150-2R))`. Bounds energy the field cannot physically supply. |
| `A2_EXPLICIT_MOVER_CEILING` | 18000 | pure anti-tunnelling for a body **propelling itself** into the field (the work bound does not apply — work keeps being done on it). `(75/2)px / (1/480)s`, ~7.7x above anything reachable. |

Removing the misnamed cap exposed a real defect the old velocity-TARGET law
could not have: a body held near the field edge accumulated speed without
bound, and `M06.4` caught the resulting 17.6 px collision penetration. The
work-speed bound fixes it physically rather than with a magic number, and keeps
per-frame displacement under the 150 px contact envelope at every supported
rate (19.6 px @1/120, 39 @1/60, 78 @1/30).

### W3 — ordered body path

`MAG.bodyFieldPath()` publishes the field's real sub-segments;
`HR.geom.bodyPathSegments()` assembles the frame path with distinct
`explicit` / `field` / `link` / `canonical` stages, always terminated by the
canonical post-movement endpoint. No second Fighter integrator, no chord.

### W4 — Hunter contact against the real curved path, and a §13 violation fixed

Contact is adjudicated by a piecewise relative sweep (`samplePath`,
16 samples) over **both** bodies' ordered paths, replacing the single
frame-start→frame-end chord.

More importantly, W2 was still doing exactly what §13 forbids: *Hunter moved
the full 2200 px/s kinematically, then Magnet added an unrelated after-the-fact
nudge.* With the honest 2351 work bound this was immediately visible — Hunter
was **no longer blocked** (stun 0.911 with the field up). Two fixes:

1. `moveHunterBody` now treats the caller's target as a **proposed velocity**
   and integrates hostile field acceleration substep-by-substep *during* the
   movement (`MAG.fieldAccelerationAt`), so the field participates in the
   movement outcome. Solid-world authority via `wallsBlockPoint` is unchanged.
2. Field-induced velocity **persists across frames** (`__hrFieldVel`). The
   mover re-proposes its authored pursuit velocity every frame, so a
   per-frame-only deceleration was being discarded and the field could never
   actually stop anything. Accumulation is what makes the energy calibration
   govern the real outcome over the whole 0.5 s window.

Double-application is prevented: a body that integrated the field explicitly
claims the frame (`__hrExplicitFieldFrame`) and `prepareBodies` skips it.

### W5 — matrix (26/26 in `testMagnetA2ContinuousField`)

| row | evidence |
|---|---|
| ordinary body, graduated resistance | edge push **24.2 px** vs deep push **265 px** |
| no teleport | max per-frame step **32.1 px** deep, **2.1 px** at the edge |
| no invisible wall | body crosses R freely, never parks on it |
| multi-Magnet §23 | two fields, order-independent to **1e-6** (581.42 == 581.42) |
| body dt convergence (shipping) | 393.3 / 391.9 / 388.5 → **4.9 px spread** |
| T6 object | never manipulated (`560,500` unmoved), not in floorFirearms |
| T6 holder body | still feels the field (228.4 → 425) |
| Slime | all bodies finite under the field |

### W6 — real-browser shipping evidence (Hunter 14/14)

| gate | measured |
|---|---|
| H4b field participates | external **1594.6 px/s**, stun **0** |
| H4c blocked per rating | with field **stun 0**, without **0.878** |
| H5 ejection not suppression | 120 px → 425 px, no stun |
| H5b not Hunter-specific | **Robot** body: identical 120 → 425 |
| H6a/H6b | blocked while up; catch lands the instant it expires |
| H7b | commit matches post-movement truth, bounded by one prey-frame |

### W7 — five hostile passes

All clean: 0 radial-velocity SET, 0 hard R clamp, 0 uses of 3500 as a runtime
branch, 0 reuse of 3500 as a speed cap, 0 CC-immunity branches, 0
Hunter-specific terms in the Magnet runtime (4 textual hits, all comments),
`applyA2BulletRepulsion` gone, linear body falloff gone, floor-gun `u^2` gone,
capture envelope gone, 0 duplicate Fighter integrators, 0 raw timers, T6
exclusion intact.

> Automated evidence is **not** owner visual acceptance.
