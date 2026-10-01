# APEX CHAOS — SLIME OWNER CORRECTION PASS
Date: 2026-09-28

## Status entering this pass

ROBOT is owner-accepted mechanically for this qualification cycle. Its skill motion/VFX presentation is still weak and will be handled in a later presentation pass. **Do not reopen ROBOT mechanics here.**

SLIME is **not owner-accepted**.

Current durable qualification state:
- session branch: `arena/01a0e749-apex-chaos`
- final engineering qualification merge: `0436aab446b259ad34ed5fbd02fd2bcf5ea1a407`
- current remote tip: `2a5c666dc14bfb708b89d83657993679eaa6be33`
- the only commit from `0436aab` to `2a5c666` is generated evidence/manifest refresh; no gameplay/runtime source changed.
- safety snapshot for this owner-correction pass: `safety/pre-slime-owner-correction-20260928`

Read the existing Hero Rework authorities and qualification docs before changing production behavior, especially:
- `02_LEVEL1_CANONICAL_BASELINE_V1_2.md`
- `03_HERO_DEFINITION_CONTRACT_V1_FINAL.md`
- `06_POSTFREEZE_ROSTER_CORRECTION.md` if present in the session authority history
- `10_ROBOT_SLIME_MODEL_QUALIFICATION_TASK_2026-09-28.md`
- `12_LEGACY_SLIME_DOUBLE_EXECUTION_AUDIT_2026-09-28.md`
- `13_ROBOT_SLIME_QUALIFICATION_REPORT_2026-09-28.md`
- this document

This pass is a **narrow owner-feedback correction**, not a redesign.

---

## Owner-observed failures

The owner replayed ROBOT and SLIME after the qualification pass.

ROBOT:
- mechanical behavior now passes owner expectation for this cycle;
- ability motion/VFX are still too weak to read clearly;
- defer ROBOT presentation work. Do not mix it into this correction.

SLIME:
1. During A1, one split body can physically pick up/use a weapon, but the equipped weapon is invisible on that body. The weapon becomes visible again once thrown/detached.
2. Stormbreaker floor lightning appears not to affect some SLIME bodies.
3. The single top HUD bar makes split-body survivability difficult to read; one body appears to die/disappear very quickly and the owner cannot tell whether that is a bug or the intended local HP pool.
4. In one reproduction, two SLIME bodies spawned from the main body and moved straight into a corner / appeared to stop moving.

Do not dismiss any of these because the prior test suites were green.

---

# Confirmed production root causes

These are source-audited before this task was written.

## C1 — equipped weapon rendering ignores non-`fighters[]` SLIME Bodies

`public/game/modes/arsenalQuestRuntime.js`:

`drawEquippedWeapons()` iterates only the global `fighters[]` array.

Rework SLIME deliberately keeps extra Bodies outside `fighters[]`.

Meanwhile the Hero Rework pre-tick correctly runs `weaponApi.updateHolder(body, dt)` for living extra bodies.

Therefore an extra SLIME body can:
- own a real holder,
- physically collect a real weapon,
- update/fire/use it,

while its equipped weapon is never sent to `AV.drawEquippedWeapon()`.

When the weapon becomes a projectile/detached object, a different renderer owns it, so it visually reappears. This exactly matches the owner report.

This is a rendering/enumeration bug, not an equipment ownership bug.

## C2 — Stormbreaker floor-lightning hazard still enumerates only `fighters[]`

`public/game/modes/arsenalQuestRuntime.js` calls:

`APEX_ARSENAL_STORM.floorContacts(fighters)`

Rework SLIME extra Bodies are not in `fighters[]`.

The direct thrown Stormbreaker collision path in the Hero Rework projectile pass is already body-aware via the rework living-body TOI path. The floor-lightning hazard is not.

Result: extra SLIME Bodies can be accidentally immune to the floor stun.

This is an architecture bug.

**Do not turn the bug into a feature.** The owner noted that a non-conductive Slime fantasy could be interesting, but no such mechanic is frozen. In this pass all living SLIME Bodies must obey the same floor-lightning eligibility law as normal valid fighter bodies.

Preserve the frozen Stormbreaker floor law:
- no damage,
- 1.0s stun,
- a shorter floor stun never shortens a longer existing stun,
- visible bolt geometry remains the contact authority.

## C3 — no body-local survivability presentation

The top HUD correctly reads Combatant-level total living HP through `HR.bodyHudHp()`.

That must remain.

However no local HP indicator exists for each living SLIME Body. Since body-local HP is the actual physical damage/death authority, the owner cannot tell:
- which Body was hit,
- which Body is near death,
- whether a disappearing Body died or merged/expired,
- whether an A1 half was simply low HP.

This is functional combat readability, not final-art polish.

## C4 — A2/passive children inherit the constructor's default leftward heading

`spawnSlimeChild()` creates `new Fighter(childId, ..., SLIME_CHILD_TYPE)`.

The base Fighter constructor derives initial direction from `type.startDx` and flips X for every id other than fighter id 1.

`SLIME_CHILD_TYPE.startDx = 1`.

A2 Damage Shedding and Passive Emergency Mitosis currently do not supply `dirX/dirY`, so spawned children fall through to that constructor direction and begin with an unrelated leftward heading.

This is not authored SLIME behavior.

A1 later explicitly sets both half headings, so its divergence path is separate.

For A2/passive, where no distinct heading rule is frozen, use the conservative physical law:
- a newly separated child inherits the **source Body's current normalized heading**;
- spawn position may still use seeded separation geometry;
- do not introduce target-seeking, pickup-seeking, corner-seeking, or random steering.

This is a bug correction, not a new mechanic.

---

# Important distinction: two A2 children may be legitimate

Do not “fix” the count merely because the owner saw two children appear from the main body.

Damage Shedding intentionally converts each 100 realized damage of accumulated progress into a child, up to the frozen cap. One sufficiently large hit may therefore spawn more than one child.

The bug to correct is the movement/readability/interaction behavior, not the existence of two children when the arithmetic legitimately crosses multiple thresholds.

Add proof that the number of spawned A2 children exactly matches the frozen threshold/carry-over/cap law.

---

# SCOPE

Repair only the following:

1. equipped weapon presentation for every living rework SLIME Body;
2. Stormbreaker floor-lightning body enumeration;
3. temporary functional per-body SLIME HP readability while multiple bodies exist;
4. A2/passive child initial movement inheritance;
5. reproduce/audit the reported “corner then not moving” case and fix it **only if a real movement bug exists**.

Do not change:
- A1 cooldown/duration;
- A1 HP split law;
- A1 area conservation;
- A1 unresolved divergence semantic;
- A2 cooldown/duration;
- A2 100-damage threshold/carry-over/max 3;
- A2 140 HP transfer;
- A2 child radius 45 / 90% speed / lifetime;
- Passive 80% trigger / 100 minimum shares;
- Stormbreaker damage/flight/homing/stun values;
- blood/splatter;
- other Heroes;
- ROBOT mechanics;
- BLACK_HOLE visuals;
- final Hero art direction.

**No balance changes in this pass.**

Do not invent an incoming SLIME damage multiplier. Measure actual realized damage through the current production path if survivability is investigated.

---

# Required implementation laws

## R1 — body-aware equipped weapon rendering

When Hero Rework is active, the foreground weapon renderer must be able to enumerate all living physical bodies that can legally hold a weapon, including extra SLIME Bodies.

Requirements:
- anchor weapon renders exactly once;
- extra SLIME body weapon renders exactly once;
- no duplicate draws for non-SLIME Heroes;
- holder/pose state remains body-local;
- pose ghost behavior remains valid;
- a child with a real holder is visually armed before firing/throwing;
- weapon render disappears only when normal weapon lifecycle says so.

Prefer a narrow body-enumeration API from the Hero Rework runtime over teaching Arsenal Quest about SLIME-specific internals.

## R2 — body-aware Storm floor contact

The floor-lightning contact sampler must receive all eligible living bodies in a rework match.

Requirements:
- normal fighters still work;
- extra SLIME bodies are eligible;
- retired/dead/invisible anchors are not eligible;
- same visible-bolt geometry remains authoritative;
- no damage is added;
- stun remains 1s;
- longer stun is never shortened;
- per-pulse/per-body gating remains correct;
- direct thrown Stormbreaker body-aware collision must not regress.

Prefer a generic environment-target query rather than a SLIME-name conditional.

## R3 — body-local HP readability

Keep the existing top HUD as **Combatant total HP**.

When a SLIME Combatant has more than one living Body:
- draw a small temporary HP bar/ring for **each living Body**, including anchor and children;
- local fill is based on that Body's current local HP versus its own local max/reference pool;
- it follows that physical body;
- it disappears when the Body dies/merges/expires;
- it must not become a giant text overlay or final-art redesign;
- when only one SLIME Body remains, the local indicators may disappear to avoid duplicate UI.

This temporary presentation exists solely so owner playtesting can distinguish “body died” from “Combatant lost HP.”

Do not replace the top HUD with per-body bars.

## R4 — child direction fallback

For A2 Damage Shedding and Passive Emergency Mitosis:
- child initial direction inherits the spawning source Body's current normalized direction;
- do not use the `SLIME_CHILD_TYPE` constructor fallback as gameplay truth;
- no `Math.random()` steering;
- no target/pickup steering;
- normal base movement and wall bounce take over immediately after spawn.

A1 retains its existing explicit/provisional split-heading path and its unresolved `+/-25` semantic remains unresolved.

## R5 — corner/stuck audit

Do not assume the default-left heading explains the entire owner report.

Build a deterministic diagnostic that records, per spawned SLIME Body:
- kind (`mitosis`, `shed`, `emergency`);
- position;
- direction;
- baseSpeed;
- effective speed multiplier if accessible;
- hard-CC/status state;
- `positionLocked`;
- wall contact / bounce;
- alive/local HP.

Exercise at minimum:
- A2 spawning 2 children from one large realized hit;
- Passive emergency split;
- children starting near each arena edge;
- a child trajectory into a corner;
- multiple seeded runs.

A living, non-hard-CC, non-position-locked child with positive speed must not remain stationary after wall resolution.

If the real production path reproduces a second freeze/stuck bug, fix its root cause and add a gate.

If it does not reproduce, report that honestly; do not invent a speculative fix.

---

# Required behavioral gates

Use real production paths, not toy stand-ins.

## G1 — visible child weapon

Real rework SLIME split:
1. extra Body physically collects a real weapon;
2. holder exists on that exact Body;
3. real foreground render path calls equipped-weapon drawing for that Body;
4. weapon remains visible while held;
5. real use/throw lifecycle still works.

A renderer-call spy may supplement a real Chromium screenshot, but do not rely only on a synthetic object test.

## G2 — no duplicate anchor render

In a normal rework match:
- single-body Hero equipped weapon draw count remains one per frame;
- split SLIME anchor equipped weapon draw count remains one;
- child equipped weapon draw count remains one.

## G3 — Storm floor lightning hits child Bodies

Controlled visible floor bolt contact:
- anchor contact -> standard 1s stun;
- extra SLIME Body contact -> standard 1s stun;
- no HP damage from floor bolt;
- an existing longer stun is not shortened;
- dead/retired bodies excluded.

Also retain/prove direct thrown Stormbreaker can collide with a living extra SLIME Body through the body-aware TOI path.

## G4 — per-body HP readability

Real Chromium:
- A1 creates two living Bodies;
- top HUD still reports Combatant total;
- both living Bodies show local health indicators;
- damage only one Body and prove only that local indicator changes;
- kill/merge/remove one Body and prove its indicator disappears without corrupting the total HUD.

Capture at least one owner-readable screenshot.

## G5 — A2/passive direction inheritance

Use a source Body with a nontrivial heading, e.g. normalized diagonal, not (-1,0).

A2:
- large hit legitimately creates 2 children;
- both begin from legal non-overlapping positions;
- both inherit the source heading at creation;
- normal wall bounce may subsequently alter direction;
- neither is forced to the global-left constructor default.

Passive:
- emergency child inherits the triggering source Body heading;
- same normal bounce law.

## G6 — no stationary corner child

Deterministically drive a child into:
- horizontal wall,
- vertical wall,
- a corner.

After collision resolution:
- reflected direction is valid;
- the child moves back into legal arena space on following frames;
- no hidden `positionLocked` remains;
- no unexplained hard CC remains.

Run enough seeded A2/passive scenarios to make the diagnostic meaningful and report what was observed. Do not invent a performance/pass threshold.

## G7 — survivability audit without rebalance

Measure and report, through the real damage path:
- local HP immediately before/after A1;
- exact realized damage of representative normal gun, sniper/precision hit, and Stormbreaker against an A1 half;
- whether/why the half dies;
- total Combatant HP before/after.

This is diagnostic only.

**Do not tune damage or HP in this pass.**

---

# Browser owner-proof

Produce a small real-browser evidence set focused on owner feedback, not a giant generic screenshot refresh:

1. A1 split with both local HP indicators visible.
2. Extra split Body visibly holding a weapon.
3. Same extra Body after using/throwing the weapon.
4. Floor lightning visibly contacting/stunning an extra SLIME Body.
5. A2 two-child spawn with trajectories that are not default-left.
6. Child entering a wall/corner and returning through normal bounce.

Screenshots are evidence, not owner acceptance.

---

# Regression

After targeted gates:
- existing SLIME physics gates;
- existing SLIME kit gates;
- ROBOT gates (must remain unchanged);
- Hero Rework smoke;
- Hero Rework goldens;
- Arsenal headless suite;
- real-browser suite;
- production build.

Do not weaken existing assertions to make the correction pass green.

---

# Durable checkpoint law

Remote Git is durable; Arena workspace is not.

Push at least:
- C1: weapon rendering + body enumeration proof
- C2: Storm floor target enumeration + proof
- C3: local HP readability + direction inheritance + corner diagnostic
- C4: regression/build + owner-correction report

After every coherent producer fix:
targeted proof -> commit -> fetch/reconcile -> push.

Do not hold several solved owner bugs only in local workspace.

---

# Final report

Provide:
- session branch;
- pushed SHAs in order;
- files changed;
- root cause and fix for each owner report;
- whether the “corner stuck” second bug reproduced;
- survivability measurements with no tuning;
- targeted test results;
- full regression/build results;
- exact preview/testable commit;
- remaining unresolved SLIME design/balance questions.

End exactly:

`SLIME OWNER-CORRECTION ENGINEERING CANDIDATE READY — NOT OWNER ACCEPTED`
