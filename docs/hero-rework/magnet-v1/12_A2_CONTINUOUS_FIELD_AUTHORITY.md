# MAGNET A2 — CONTINUOUS NONLINEAR RADIAL FIELD (H-PHYS2)

Status: **calibration complete and committed; gameplay wiring NOT yet applied.**
See §7 for why this stops here rather than part-rewriting the integrator.

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

## 4. Derived coupling (§7, §18) — one knob, not many

`tools/calibrateMagnetA2Field.mjs` derives the single coupling `K` from the one
rating by bisection **on the real discrete integrator** at every supported rate,
not by guessing.

Damage envelope = fighter radius `75` + max bullet radius `9` = **84 px**.

```
minimum K satisfying the 3500 guarantee (bisected) = 25866.6
closed-form cross-check  K = v0^2 / 2 / (R^2/d + d - 2R) = 25879.0   (0.05% agreement)
modest margin                                      x1.15
CHOSEN  A2_FIELD_COUPLING = 29700
```

The closed form comes from the work integral
`W(d) = K * (R^2/d + d - 2R)`, turning point where `W = v0^2 / 2`. Its
independent agreement with the numeric bisection is the cross-validation that
the coupling is derived rather than fitted.

`K` is deliberately **not** raised further: the goal is the smallest field that
honestly earns the 3500 rating, explicitly not maximum defence (§18).

---

## 5. Turning-radius table (required by §18)

Head-on, A2 active before entry, `K = 29700`.

| v0 | closed form | dt=1/30 | dt=1/60 | dt=1/120 | outcome |
|---:|---:|---:|---:|---:|---|
| 2200 | 124.3 | 124.4 | 124.6 | 124.8 | stopped outside |
| 2600 | 112.1 | 112.1 | 112.4 | 112.9 | stopped outside |
| 3000 | 101.2 | 101.3 | 101.6 | 101.6 | stopped outside |
| 3200 | 96.2 | 96.3 | 96.7 | 96.7 | stopped outside |
| 3400 | 91.5 | 91.6 | 92.1 | 92.1 | stopped outside |
| **3490** | 89.5 | 89.6 | **90.0** | 90.1 | stopped outside |
| **3500** | 89.3 | 89.3 | **89.8** | 89.8 | stopped outside |
| **3510** | 89.1 | 89.1 | **89.5** | 89.6 | stopped outside |
| 5000 | 62.6 | 62.6 | 62.8 | 62.9 | **REACHES ENVELOPE** |
| 5200 | 59.9 | 59.9 | 60.1 | 60.1 | **REACHES ENVELOPE** |
| 5400 | 57.3 | 57.3 | 57.5 | 57.5 | **REACHES ENVELOPE** |
| 5800 | 52.5 | 52.6 | 52.9 | 52.8 | **REACHES ENVELOPE** |

Properties this table proves:

* **every** `<= 3500` entry stops outside the 84 px envelope (guarantee earned);
* the precision tier **can** penetrate — the field is a force field, not a shield (§5, §19);
* **no discontinuity at 3500**: 3490 → 3510 differ by **0.50 px**, a smooth
  continuation, so 3500 is an anchor and not a switch (§8). 3510 still happens
  to stop; it is simply outside the *guarantee*, which is the correct semantics;
* turning radius decreases **monotonically** with inbound radial speed across
  all 12 samples — a major proof the behaviour is integrated physics, not script;
* dt spread across 30/60/120 Hz is `<= 0.5 px`, i.e. the law converges and is
  not a frame-rate artefact (§22).

Favourable late-engagement penetration (field activates with the object already
deep), all **expected PASS**:

```
v=5000 engaged at d=200 -> minD 62.8 HITS    v=5800 d=200 -> 52.4 HITS
v=5000 engaged at d=150 -> minD 59.9 HITS    v=5800 d=150 -> 50.7 HITS
v=5000 engaged at d=120 -> minD 56.4 HITS    v=5800 d=120 -> 48.3 HITS
```

---

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
entry it falls in the guaranteed tier and turns at `~124.6 px` — comfortably
outside body contact at `150 px`. That is **not** Hunter-specific protection; it
is purely `2200 < 3500` under the shared law.

---

## 7. What is NOT done yet, and why

Calibration, the field function, the audit and the evidence table are committed
and green. The **gameplay wiring is deliberately not applied in this commit**:

* the current projectile law must have its wall-like behaviour removed
  (`A2_BULLET_ENTRY_RESTITUTION`, radial `SET` to 0 at the `R` crossing, the
  0.07 s capture envelope that *sets* radial velocity, and the flat 18000
  outward term) and be replaced by continuous `dv = a*dt` integration;
* body, floor-gun and Hunter paths must then consume the same `S(d)`;
* ordered path sub-segments (§12) and Hunter's sub-segmented body path (§13)
  must be produced so no false chord reaches Crystal / Mirror / contact;
* the full A–G matrix and five hostile passes must then run.

That is a single indivisible physics change: part-applying it would leave the
shipping projectile integrator in a half-rewritten state, which the durability
law forbids. The calibration committed here is the prerequisite the brief
demanded ("do not guess a force coefficient") and is independently verifiable.

`tools/calibrateMagnetA2Field.mjs` exports `strength()`, `workPerK()`,
`closedFormTurningRadius()`, `closedFormK()`, `simulateHeadOn()` and
`calibrate()` for the wiring work to consume directly, so the shipped runtime
will import the *same* function this table was produced from.

> Automated evidence is **not** owner visual acceptance.
