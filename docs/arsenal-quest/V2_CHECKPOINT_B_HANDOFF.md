# ARSENAL QUEST V2 — CHECKPOINT B + OWNER PLAYTEST CORRECTIONS

Status: AUTHORITATIVE FOR NEXT IMPLEMENTATION PASS
Implementation branch: `arena/01a0cf5e-apex-chaos`
Playtest branch: `playtest/arsenal` (DO NOT move until this pass is verified)

This pass combines:
1. owner playtest corrections to Checkpoint A; and
2. Checkpoint B weapon motion language.

Checkpoint C (full UI/UX overhaul) is NOT part of this pass.

---

# PART 1 — OWNER PLAYTEST CORRECTIONS TO CHECKPOINT A

These rules supersede conflicting A rules in `V2_MAJOR_PASS_HANDOFF.md`.

## A-CORR-1 — Slower spawn cadence

Current cadence: 3.0 seconds.

Owner intent: spawn rate should be 2/3 of current.

Therefore:
- new cadence = **4.5 seconds**
- first spawn delay may remain as-is unless a test proves it feels inconsistent
- multiple slots may still coexist
- do not reintroduce one-at-a-time spawning

Acceptance:
- long-run measured spawn frequency is ~2/3 of the current A build
- no slot flood in ordinary 1v1 play

## A-CORR-2 — Reveal uses the entire visible pickup/telegraph circle, not centerline

Checkpoint A's 16px center corridor was too strict.

New reveal geometry:
- hidden slot is represented by the visible question-mark / pickup availability circle
- reveal trigger uses the **whole circular region**, not the center point
- use the current fighter movement ray/segment and perform a **ray-circle / swept-line intersection** against the visible pickup/telegraph circle
- do NOT require the fighter path to pass through the item center
- do NOT use the old broad multi-bounce future predictor

Initial reveal radius should match the visible question-mark pickup circle. Prefer one shared config value so rendering and logic cannot drift.

### Lead time
- movement-triggered reveal lead = **2.0 seconds**
- if current straight segment will enter/intersect the visible pickup circle within <= 2.0s, reveal
- if a wall bounce occurs before circle entry, do not reveal before the bounce; recompute naturally after bounce

### Failsafe reveal
- if a slot has existed hidden for **3.0 seconds** and has not movement-triggered yet, force reveal
- this means FORCE REVEAL, not auto-pickup
- once revealed, it behaves like any normal collectible weapon
- weapon identity remains null until actual reveal

Acceptance:
1. trajectory through any part of the visible question-mark circle can reveal
2. center crossing is not required
3. near miss outside the visible circle stays hidden
4. reveal lead is 2.0s
5. no pre-bounce reveal
6. hidden slot force-reveals at age 3.0s even if nobody is approaching
7. no identity leak before reveal

## A-CORR-3 — 32 fighter roster keeps compatible identity

Checkpoint A disabled all native kits. That was too aggressive.

New product rule:
**Arsenal uses the 32 fighters as real characters with compatible signature identity, not inert skins.**

However, do NOT blindly restore every native mechanic unchanged.

Before implementation, create:
`docs/arsenal-quest/V2_ROSTER_COMPATIBILITY_MATRIX.md`

For each canonical 32 fighter, classify native mechanics individually:

- **KEEP** — compatible with Arsenal as-is
- **ADAPT** — signature mechanic should remain but needs a narrow Arsenal-specific compatibility change
- **SUPPRESS** — only when the mechanic fundamentally breaks the Arsenal core loop or presentation

Decision rules:
- weapon system must never mutate fighter movement merely to aim
- native fighter skills MAY intentionally alter fighter movement if that is part of the fighter's real identity
- native skills may damage, defend, apply status, summon, reposition, or create hazards if they remain understandable alongside Arsenal weapons
- native mechanics must not reveal/pick/equip Arsenal weapons automatically unless explicitly designed later
- native mechanics must not overwrite or hide the equipped Arsenal weapon sprite
- native mechanics must not replace the Arsenal weapon holder state
- native projectiles and Arsenal projectiles must coexist safely
- if a native skill visually impersonates an Arsenal weapon, adapt the presentation rather than deleting the fighter identity by default
- keep Arsenal match HP/base test tuning unless a specific mechanic depends on another value; document exceptions
- avoid one blanket no-op `update` policy

Implementation must be data-driven where practical via a fighter compatibility profile/adapter, not 32 scattered mode checks.

Acceptance:
- all 32 remain selectable
- every fighter has at least one documented identity decision
- compatible native skills visibly function
- suppressed mechanics have a concrete documented reason
- no native mechanic corrupts weapon pickup/reveal/holder state
- weapon aim/motion remains independent of fighter movement
- 5-minute mixed-fighter stress run has no runtime errors

---

# PART 2 — CHECKPOINT B: WEAPON MOTION LANGUAGE

Core law:
**motion comes from the equipped weapon sprite/pose, not from rewriting fighter movement.**

Introduce/extend an isolated weapon pose state, e.g.:
`weaponPose = { aimAngle, rotationOffset, localX, localY, scaleX, scaleY, recoil, phase }`

The logical aim remains opponent-facing.

## B1 Pistol
- 3 visually countable recoil pulses
- ~12–16 px weapon-only kickback per shot
- small rotation kick
- fast return spring

## B2 Shotgun
- one heavy ~24–32 px recoil
- larger rotational kick
- slower settle
- optional rack/pump beat if supported by existing audio

## B3 SMG
- 8 distinct micro-recoil pulses synchronized with actual fire interval
- ~8–12 px weapon-only kickback
- subtle alternating rotational jitter
- no fighter-body recoil

## B4 Sniper
- continuously tracks opponent during charge
- distinctive pre-fire preparation
- preferred: brief stylized weapon flourish/spin during latter part of aim
- chamber/reload audio if suitable existing SFX exists
- snap exactly back onto target before fire
- strong long recoil

## B5 Grenade
- short backward draw
- forward throw motion
- grenade leaves from weapon/hand pose
- keep explosion atlas

## B6 Sabre
- weapon-body backswing then fast cut/snap
- no imported slash VFX

## B7 Battle Axe
- pronounced raise/windup
- heavy forward/down chop
- slower recovery

## B8 Dagger
- weapon-only straight thrust toward opponent
- ~60–90 px extension
- quick retract
- fighter body movement remains whatever fighter movement/native skill currently dictates

## B9 Spear
- long narrow thrust
- ~90–120 px weapon-only extension
- controlled return

## B10 Spiked Club
- backswing + blunt forward smash
- heavier easing than blades

## B11 Swirl Shield
- faces opponent
- subtle idle settle
- successful reflect gives brief forward pop/tilt

## B12 Tower Shield
- faces opponent
- visible forward guard pose
- block gives short shield-only pushback/tilt

## B acceptance
- no recoil/windup changes fighter position
- no weapon animation rewrites `fighter.dir`
- motion synchronized with actual gameplay events
- each of 12 weapons has a visibly distinct motion signature
- motion remains readable with slash/swipe VFX disabled
- bomb explosion remains
- owner can identify major weapon classes by motion alone in a muted-VFX test

---

# IMPLEMENTATION ORDER

One agent run may implement this combined pass, but in this internal order:
1. A-CORR-1 spawn cadence
2. A-CORR-2 reveal geometry + timeout
3. roster compatibility matrix
4. roster compatibility implementation
5. weapon pose architecture
6. 12 weapon motion recipes
7. focused QA + browser evidence
8. report
9. STOP for owner playtest

Do NOT start Checkpoint C UI/UX overhaul.

Do NOT touch deployment infrastructure.
Do NOT move `playtest/arsenal` during implementation.
Do NOT create a new ZIP.

After implementation is verified, report the final Arena SHA. The lead/reviewer will then move `playtest/arsenal` once so Cloudflare deploys exactly one owner-playtest build.

# Required evidence

At minimum:
- spawn density comparison / cadence assertion
- reveal on edge-of-circle approach (not center)
- near miss outside circle stays hidden
- force reveal at 3.0s
- no pre-bounce reveal
- at least several representative fighters showing KEEP/ADAPT behavior
- evidence that native fighter skill and equipped weapon can coexist
- one motion proof per weapon, or a compact evidence sequence covering all 12
- no slash VFX
- bomb explosion retained
- build/headless/browser pass

Write final report:
`docs/arsenal-quest/V2_CHECKPOINT_B_REPORT.md`
