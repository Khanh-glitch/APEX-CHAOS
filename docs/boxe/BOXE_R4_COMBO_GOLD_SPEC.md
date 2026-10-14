# BOXE BOT WAVE R4 — Source-derived combo choreography

**Gold authority:** `THE_HAND_GOLD_ROCKET_CATCH_IMPACT_V2_POSE_UPDATED(1).html` SHA-256 `ccb889bb08cb2e741c4f7f5e0b33d08047c08fb28bfc1c31ae9401604444e2b2`.

## Key design rule

Never emulate Gold punches/VFX in a new simplified renderer. Gold `basicAttack`, `skillJab`, `skillUppercut`, `skillRocket` and their FX modules remain the **render/event authority**. The wave adapter may sequence them but cannot drop the Gold fire, electricity, smoke, afterimages, springs, debris, recoil, waves, impact sound or punch catcher.

## Base 3 punches (on hold J)

1. J1 LEFT, normal punch: 260ms recovery, impact at +90ms.
2. J2 RIGHT, normal punch: 260ms recovery, impact at +90ms from second punch.
3. J3 LEFT HEAVY: 420ms recovery, impact at +130ms from third punch.
4. Native combo window resets after 900ms of inactivity.

If Gold key **1** unlock card was SELECTED, the wave controller pauses basic punches after J3 recovery and schedules the **six** native Gold key-1 jab launches at +420, +505, +590, +675, +760, +845ms relative to J3 start. Each impact is +50ms from its launch. When Jab remains on Gold cooldown or is not card-unlocked, return to J1; DO NOT launch Gold 3 without Gold 1.

If Gold key **3** unlock was also SELECTED, and the Gold cooldown permits it, Gold 3 begins at +980ms relative to J3 start (at least 85ms after Gold 1's final impact). Gold 3 impacts 170ms after launch; ordinary J loop resumes 300ms after Gold 3 begins. If Gold 3 is on cooldown, the chain finishes after Gold 1; don't silently skip to future stages.

## New Rocket proc card (not default)

Independent **RARE** `unlock-rocket-proc`, drawing in the same tier-weighted 3-card random picker. When equipped, each CONFIRMED hit from a basic J punch or Gold-1 jab beat rolls a distinct **7.5%** chance. Missing strikes never trigger rocket. The Gold key-2 cooldown still applies; at most ONE right glove may be detached. A successful roll fires Gold key 2; preserve launch, hit, 5s flight with arena wall reflections and Gold return/catch recoil. During six-beat jab, a rolled rocket is deferred until the six-beat animation ends so it can't corrupt independent fists.

`7.5%` is explicit provisional balance, not an implicit property of the original Gold. Tune this through declarative config after playtest, never by distributing magic numbers across render paths.

## Determinism, cancel and acceptance

- Hold J cannot overlap a Gold finishing chain or restart basic punches prematurely.
- Skill cooldowns remain authoritative. Input and death/level-up state cannot apply a stale completion timer to a new combo.
- Damage in BOT WAVE uses real Gold combat rules. **Auto Battle BOXE skills still deal zero damage**, except empowered A2's 10% remaining HP finisher; do not cross these mode rules.
- Both desktop and mobile automatically aim toward nearest currently alive robot; identical ordered tie-break by enemy ID.
- Real Chromium receipts required for unlock gating; Gold keys 1→3 order; forced test-roll proc returning the glove after ≥5000ms; lost-target behavior; wave reset; mobile landscape and no JS errors.
