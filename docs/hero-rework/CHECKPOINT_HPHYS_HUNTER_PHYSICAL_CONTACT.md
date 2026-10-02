# CHECKPOINT H-PHYS — Hunter pounce requires resolved physical contact

**Law implemented**

```
REAL RESOLVED PHYSICAL CONTACT  ->  control effects
NOT
TARGET INTENT / TRACKING        ->  control effects
```

Hunter A2 still chases and pounces toward the live prey, and tracking still
determines the pursuit direction. What changed is that Hunter may no longer
*certify its own hit*.

---

## 1. Root cause, reproduced before any patch (H-PHYS.1)

`hrPreTick` ran in this order:

| order | step |
|---|---|
| 1 | executor `onTick` — Hunter A2 called `moveHunterBody`, swept contact, and **committed STUN/WEAK/disarm/PounceWeak/CATCH inline** |
| 2 | `magnet.prepareBodyForces(dt, …)` |
| 3 | `Fighter.update()` — canonical movement, walls, and the external-motion seam |

So the entire success bundle was committed at step 1: before Magnet's A2 body
force existed, and before either body had performed its canonical movement for
the frame. Three structural defects followed, all confirmed in source **and**
live:

1. **Magnet A2 never participated** in the pounce step.
2. **The prey was a static pre-movement sample** (`b.x, b.y`), not its real path.
3. **The consequence bundle was committed inline**, not from one proven contact.

**Live reproduction (real browser, before the fix).** Hunter pounced across an
active Magnet A2 field from 330 px. Magnet was stunned (`stun.timer 1.967`) and
Hunter's measured external velocity from the field was **0 for the entire
pounce** — the field was inert with respect to the mechanic.

---

## 2. The fix (H-PHYS.3 / .4 / .5 / .6)

A single narrow **explicit-body-motion contact seam**. No second integrator, no
hero-specific force equation copied anywhere, no new `Fighter.draw` wrapper.

* `heroReworkRuntime`
  * frame-start positions `__hrFrameStart` are recorded for every body at the
    top of `hrPreTick`, before any executor moves anything;
  * `api.deferBodyContact(req)` queues a contact request;
  * `resolvePendingBodyContacts()` runs **first in `hrPostTick`**, i.e. after
    `Fighter.update`, so the mover's position already includes Magnet A2 body
    force and canonical walls, and the target's position is this frame's real
    one. Contact is a **moving-circle vs moving-circle** test: with both paths
    linear over the frame the separation vector is itself linear, so the
    earliest contact is the TOI of the **relative** path against the origin at
    the summed radius.
* `heroMechanicsRuntime`
  * Hunter A2 keeps windup, live retarget, pursuit speed, chase window and Gold
    motion state, and still moves through `moveHunterBody` (**unchanged**, still
    the solid-world / Crystala capsule authority). It now **defers** adjudication.
  * `commitHunterPounceCatch(...)` is the **single atomic success transaction**:
    STUN, combatant WEAK, firearm disarm, `HunterA2Disarm`, `PounceWeak` and the
    Gold CATCH presentation/SFX. Structural gate S21 proves each consequence has
    exactly **one** emission site in the file.

**Magnet is a physical event, not immunity.** There is no
`if (magnetA2Active) ignore stun` anywhere — gate S30 forbids it statically.
Magnet's protected numbers are untouched (gate S31): radius 225,
`bodyAcceleration` 2200, `bodyRadialSpeedCap` 650, linear radial target/falloff.
Hunter's protected numbers are untouched (gate S32): 12 s cd, 0.16 s windup,
2200 px/s, 0.50 s chase, 0 direct damage, STUN 2.0, WEAK 1.0.

---

## 3. Evidence

`tools/testHunterPouncePhysicalContactRealBrowser.mjs` — **10/10**, real shipping
loop in a real browser. `docs/hero-rework/evidence/hunter-pounce-physical-contact.json`.

| gate | result |
|---|---|
| H1 positive control | stun 2.0, catch ×1, PounceWeak ×1, contact distance **150 = exactly the summed radii** |
| H2a solid construct between bodies | real Crystala capsule at x≈332 spanning y 390–610 |
| H2b **Hexa block** | Hunter stopped at x **237.4**, prey at 500, distance **262.6 > 150** → **no** stun, **no** catch, **no** PounceWeak, **no** catch SFX |
| H4a no field | Hunter external velocity **0.0** |
| H4b **field participates** | Hunter external velocity **194.8 px/s** outward; Hunter visibly driven back 354.2 → 322.1 |
| H5 **no fake immunity** | field active **and** real contact → stun 2.0, catch ×1 |
| H7a moving prey really moved | 286.2 px of canonical engine locomotion |
| H7b **commit matches post-movement truth** | committed at real distance **150.00**, while the stale pre-movement sample said **114.56** |

H7b is the direct discriminator: the old code would have committed on the
`114.56` stale geometry; the fixed code commits only at the true `150.00`
adjacency.

`tools/testHunterPouncePhysicalContact.mjs` — **17/17** structural gates locking
the seam, the single commit site, the absence of inline adjudication, the
absence of any Magnet immunity special-case, and the protected constants.

---

## 4. Honest finding the owner should see

**At the protected authored values the Magnet A2 field deflects a pounce but
does not stop one.** Measured: the field pushes Hunter outward at up to
**194.8 px/s** while the pounce drives inward at **2200 px/s**, inside a 1000 px
arena with a 0.5 s chase window. The field therefore changes Hunter's path and
contact point, but Hunter still reaches Magnet from ordinary ranges.

That outcome is *correct under the law as stated* — H-PHYS.5 requires that a
fully resolved path which still reaches the body succeeds, and explicitly
forbids manufacturing immunity. The architectural defect (field not
participating at all, contact committed before physics) is fixed and proven.

If the owner's intent is that an active Magnet A2 should *reliably* prevent a
bite, that is a **balance** decision on the protected Magnet values (push speed
vs. 2200 px/s pounce), not a physics-ordering one, and it needs owner authority
before any number is touched. **Flagged, not silently "fixed".**

Also note `HPHYS-H7`'s original "prey escapes" formulation is not constructible:
at 2200 px/s inside a 1000 px arena Hunter legitimately runs down any prey, so a
miss would prove nothing. The gate instead proves the mechanism directly.

---

## 5. Structural audit of other explicit body movers (H-PHYS.8)

The defect is specifically *"an explicit mover commits a contact outcome from
its own pre-physics motion"*. A mover that only moves is unaffected, because its
position still passes through Magnet body force and canonical walls before
anything resolves against it.

| mover | classification |
|---|---|
| `hunter.pounce_weak` | **FIXED** — proposes movement, defers contact |
| `hunter.snare` (A1 recoil) | **SAFE** — moves via `moveHunterBody`, adjudicates no contact. A1 untouched. |
| `robot.weapon_dash` | **SAFE** — is an explicit mover (`a.x += …`), but its contact authority is already the **real equip resolution** (`onEquipOffensive`), which runs on the post-movement position. The dash never emits `RobotA1Contact` itself; the source even states this. No Robot change made, no Robot timing/feel touched. |
| Sniper A2 position lock | **NOT CONTACT-SENSITIVE** — lock only |
| Frost movement lock | **NOT CONTACT-SENSITIVE** — lock only |
| Slime promoted / child bodies | **SAFE** — driven through the full canonical engine pipeline (`child.update`) |

Gate S41 bounds the number of direct position-mutation sites so a new
self-certifying mover cannot appear unnoticed.

**Crystala was audited, not rewritten (H-PHYS.2).** `moveHunterBody` already
routed through `wallsBlockPoint`, which already consumed `CRY.capsules()`, so
Hexa blocking was already correct. H2 is therefore a **regression test only** —
zero Crystala gameplay change.

---

## 6. Regression state

Green: Hunter physical contact 10/10 + 17/17, Magnet gameplay 27/27, Magnet
presentation 13/13, Magnet semantics / motion authority / scheduler parity PASS,
locomotion 4/4, Robot gameplay 11/11, Slime 9/9, chamber palette 15/15, ordered
supersession 12/12, ordered path 15/15, Mirror Gold harness 24/24, Mirror visual
oracle 14/14, Mirror D1 raster 13/13, revision gate PASS (r13, 38 runtimes),
build clean.

Pre-existing failures, each verified against the exact `f92f2b3` baseline by
stashing and re-running — **not** assumed:

* `testHeroReworkRobotPresentationGates` — **10** failures at baseline and 10
  now, byte-identical list. (An earlier note claiming "4" was stale; corrected
  by measurement.)
* `testHeroReworkGoldens` — 2, unchanged.
* `testHeroReworkHunterOwnerFixGates` — `runtime-cache-bust` only (revision
  lineage gate; reacts to any revision bump).
* `testCrystalaGameplayGates` — `G07` only, as at baseline.

**One disclosure on `G07`.** It was already red at baseline (on
`changedProtectedFiles`). It now additionally reports
`hunterBlockIdentical: false`, because this owner-directed change legitimately
edits the Hunter mechanic block. The gate's intent — "anti-tunnelling must be
shared geometry, not Robot/Hunter rewrites" — is still satisfied
(`sharedGeom: true`, `robotBlockIdentical: true`, and no tunnelling geometry was
added to Hunter). The gate was **not weakened**; its Hunter byte-identity proxy
needs authority re-baselining.

Runtime revision `20261002-mirror-v1-r12` → **`20261002-mirror-v1-r13`**,
relocked, gate PASS before push.

> Automated evidence is **not** owner visual acceptance.
