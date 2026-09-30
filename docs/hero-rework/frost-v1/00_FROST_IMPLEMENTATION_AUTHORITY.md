# FROST V1 — IMPLEMENTATION AUTHORITY

Status: OWNER-LOCKED FOR LEVEL-1 IMPLEMENTATION / PLAYTEST V0
Date: 2026-09-30
Baseline truth: 6b83fc6502eb8e23e4bd122074fc7fdfb47441ae

## 0. Purpose

FROST replaces the obsolete Hero Rework ICE mechanic while preserving backward-compatible identity storage.

FROST is not a generic slow/freeze caster.
Its core loop is:

Create ice -> control movement -> acquire a firearm -> turn it into a Frozen Gun -> use Frozen Bullets to create Freeze pressure.

Functional split:
- A1 acquires a firearm from the battlefield.
- A2 acquires a firearm from the opponent.
- Passive converts a Frozen Gun into Freeze pressure.

Do not reintroduce the old ice.bullets / ice.lane / continuous-chill-threshold design.

## 1. Identity and migration law

Stable storage/canonical roster key remains ICE for compatibility.
Product/display identity is FROST.

Required semantic identity:
- canonical registry/storage/save key remains ICE;
- product/display identity is FROST;
- external lookup may accept ICE and FROST as aliases to that same definition;
- class/mechanic identity is rework.frost / frost.*;
- there must be only one playable hero definition, never a duplicate ICE + FROST roster entry.

These are semantic requirements, not permission to invent unnecessary schema fields. Preserve the live registry key/id and rework shell identity `ICE` where the engine contract expects them; add only the smallest tested display/alias layer required for FROST.

Both ICE and FROST external lookups must resolve to the same FROST product hero where alias resolution is appropriate.
UI/shop/pick/HUD/product copy must display FROST.
Existing saves that store ICE must continue to load.
Do not migrate transient match state by display name.

No new FROST mechanic may use the old ice.* namespace.

Legacy ICE presentation/audio must not double-render or double-play for FROST merely because the physical fighter/storage identity is still ICE.

## 2. Level/progression law

FROST V1 production gameplay is Level 1 only.

Hero/skill Lv2-Lv5 design is intentionally DEFERRED until the product-level purpose of Hero/Quest progression is designed.

Do not:
- reduce cooldowns by level;
- increase Freeze chance by level;
- increase duration/size/speed by level;
- copy TEST_ONLY fixture curves into production;
- invent a progression philosophy for this task.

The current registry structurally expects one knobPath and maxLevel 5. If a compatibility field is required to satisfy that old schema, use a gameplay-dead progressionAnchor (or an equally inert local compatibility mechanism) whose value is never read by a mechanic, AI, UI, telemetry value calculation, or balance logic. curveStatus stays UNRESOLVED. This is schema compatibility only, not design authority.

Production resolution above Lv1 must continue to refuse unresolved balance.

## 3. Shared Frozen Floor law

A1 and A2 create the same semantic Frozen Floor material.

Playtest V0:
- Frost on Frozen Floor: speed multiplier x2.35.
- Opponent on Frozen Floor: speed multiplier x0.60.
- A1 opponent chill linger after leaving floor: 0.35s where applicable.
- Overlapping Frozen Floor does not multiply effects.
- If multiple Frost-specific movement modifiers apply, resolve the strongest applicable Frost effect, not a product of them.
- Cold Shock x0.50 therefore beats floor x0.60; never x0.30.

Do not change unrelated global status-composition semantics merely to implement this.
Use the narrowest Frost-specific resolver/hook that preserves existing non-Frost behavior.

Frozen Floor must be real world geometry/state with bounded lifecycle and cleanup. Presentation does not own collision or speed truth.

## 4. A1 — FROST BREATH

### 4.1 Cast and direction

Playtest V0:
- cooldown: 10.5s
- cast commitment: approximately 0.25s
- direct damage: 0

At accepted cast, snapshot Frost's current meaningful locomotion/orientation direction.
A1 does NOT aim at the opponent and does NOT retarget toward weapon aim.

A1 itself MUST NOT stop, brake, zero, steer, or `positionLocked` Frost. The ~0.25s cast commitment is ability/presentation timing only. Frost continues normal APEX locomotion and normal wall/body bounce throughout it unless an unrelated authoritative external CC/status already locks movement.

At the ~0.25s release/floor-build moment, use Frost's authoritative production world position at that moment as the lane origin, while keeping the direction snapshotted at cast acceptance. Renderer lag/offset is never gameplay position authority.

### 4.2 Floor formation

A1 freezes the floor near -> far.
Playtest V0:
- total length: 650px
- width: 160px
- stable floor lifetime: 4.5s after the near->far crystallization front completes.

The authoritative active floor grows with the crystallization progression; do not activate an invisible full 650px rectangle before the front reaches it. The A1 cast shares one lane expiry after front completion; do not make the near end disappear early merely because it materialized first.

Gold owns the visible breath/front/material formation.
Gameplay owns exact world support and timers.

### 4.3 Battlefield firearm freezing

Only A1 battlefield Frozen Floor can convert revealed floor firearms into Frozen Firearms.

Eligible object:
- a REVEALED firearm pickup;
- not melee;
- not grenade;
- not shield;
- not T6 / Stormbreaker.

When an eligible revealed firearm lies on active A1 floor:
- it remains the same pickup slot/object and remains phase REVEALED;
- it continues to count exactly as the same revealed firearm for Arsenal active-cap/emergency-spawn truth;
- mark that exact slot as Frozen;
- opponent cannot collect it;
- Frost can collect it only through ordinary physical pickup contact and ordinary one-holder eligibility;
- do not teleport it to Frost;
- do not create a duplicate weapon;
- keep weapon ID/tier/identity.

A firearm that REVEALS while already inside active A1 floor must freeze when it becomes revealed.

If multiple A1 floor regions support one firearm:
- Frozen state is not stacked;
- thaw starts only after the last active A1 support disappears.

Playtest V0 thaw:
- about 0.30s.
- if A1 support returns during thaw, cancel thaw and keep Frozen.

If the Frozen firearm remains on the floor until thaw completes, it returns to normal pickup law immediately. Frozen denial must be dynamic state, not a permanent rejected/blacklisted pickup condition.

If Frost physically picks it up before thaw completes:
- create/equip the normal real holder exactly once through the existing pickup path;
- carry Frozen state onto that holder;
- Frozen state then persists independent of floor lifetime until that holder is consumed.

A2 trail never freezes battlefield pickups.

## 5. Frozen Gun

Frozen Gun is not a generic ice weapon.

It is the original real firearm plus a Frozen state tag.

Preserve:
- weaponId
- definition/family
- authored damage
- x7 Arsenal damage law
- firearm crit law
- cadence
- shots/ammo/use law
- normal independent weapon aim
- normal consume behavior
- normal pose/recoil/fire SFX already in the game.

Do not recolor/replace it so aggressively that firearm identity becomes unreadable.

A Frozen Gun emits Frozen Bullets.

## 6. Passive — DEEP FROST / FROZEN BULLET

### 6.1 Level-1 probability

- innate/base Frozen Bullet proc chance: 4%
- Deep Frost Lv1 bonus: +4 percentage points
- total Level-1 proc chance: 8%

Use deterministic Hero/AIL seeded RNG. Never use raw Math.random for the Freeze proc.

No Frozen Bullet = no Freeze roll.

### 6.2 Roll semantics

Eligible hit rolls:
- SEMI: one roll per projectile hit.
- AUTO: one roll per projectile hit.
- BURST: one roll per projectile hit.
- PRECISION: one roll per projectile hit.
- SHOTGUN: one roll for the entire blast, shared by all pellets.
- AUTOSHOT/JACKHAMMER: one roll per blast, shared by pellets of that blast.

Do not approximate blast grouping by a time window.
Attach a stable semantic shot/blast group ID at the REAL weapon firing source and propagate that exact group ID to every pellet/projectile produced by that semantic shot/blast.

Creating/firing a Frozen Bullet may tag provenance/group identity, but MUST NOT consume the 8% RNG roll. The deterministic RNG draw happens only after a real eligible body hit has been confirmed and all no-roll gates (including post-thaw lock) have passed.

For a blast, the first eligible body hit consumes the blast's single Freeze roll opportunity; later pellets from the same blast cannot roll again. A completely missed blast consumes no Freeze RNG roll.

### 6.3 Freeze

Successful proc:
- direct Freeze damage: 0
- Freeze duration: 0.90s
- movement/action are locked through the existing authoritative hard-CC/status path.

Newest owner law:
- if target is not Frozen, successful proc starts 0.90s Freeze.
- if target is already Frozen, successful proc RESETS remaining Freeze to 0.90s.
- it never adds time on top: remaining 0.60 + new 0.90 is still 0.90, not 1.50.
- a failed roll while Frozen does nothing.

After actual thaw:
- post-thaw re-proc lock: 0.50s.
- the 0.50s lock begins only when target truly thaws.
- there is no post-thaw lock while target is still continuously Frozen/refreshed.

For multi-body opponents such as SLIME, Freeze is body-local to the body actually hit unless a newer explicit authority says otherwise.

Frozen Bullet state is emitted from the actual Frozen Gun fire event and follows that real projectile through existing legal transforms/provenance handling. Do not clone extra projectiles or create duplicate roll opportunities.

## 7. A2 — FROST HUNT

### 7.1 Active window

Playtest V0:
- cooldown: 12.5s
- active window: 3.0s
- trail width: 120px
- each trail segment lifetime: 3.5s
- direct skill damage: 0

A2 is a Hunt window, not a new homing locomotion controller.

### 7.2 Native APEX locomotion is mandatory

During A2, Frost retains the original APEX locomotion law:
- persistent heading/inertia;
- engine movement integration;
- normal wall bounce/reflect;
- normal body collision separation/bounce;
- no generic chase steering;
- no auto-turn toward opponent;
- no pickup seek;
- no teleport/dash invented for A2.

A2 freezes the ACTUAL path Frost physically traverses.
Trail must follow turns and wall/body bounces because it is derived from real movement history.

This owner correction supersedes any prototype/demo path that steers toward the opponent.

### 7.3 Real body contact

Anchor-body collision is owned by existing APEX physics:
- separate overlap physically;
- reflect/bounce headings according to the existing engine;
- do not attach/stick bodies together.

A2 contact mechanic is a callback from real contact, never a replacement for physical collision.

New-contact law:
- first contact after separation may proc;
- continuous overlap must not repeatedly proc every frame;
- bodies must separate before another contact can proc;
- the contact gate must be cleared by the real separation/contact authority. Do not keep a permanent per-cast pair latch that prevents a later genuine re-contact during the same A2 window.

### 7.4 Cold Shock

Every valid new enemy body contact during active A2 applies:
- direct damage: 0
- movement multiplier: x0.50
- duration: 1.0s

If target is also on Frozen Floor x0.60, x0.50 wins; they do not multiply.

### 7.5 Exact firearm steal

On a valid new body contact during A2:
IF:
- Frost is unarmed;
- the contacted opponent currently owns an eligible ranged firearm according to the live APEX one-holder / BodyProfile equipment-carrier authority;
THEN:
- transfer that exact existing holder object/state from the opponent's authoritative current equipment carrier to Frost;

Do not assume a multi-body opponent's colliding Body is automatically the equipment carrier. Do not invent a second holder or a new multi-body equipment rule for Frost.
- enemy immediately stops owning it;
- do not call the normal fresh equip() constructor;
- do not call consume() as part of transfer;
- do not spawn a floor copy;
- do not create a pose-ghost that implies destruction;
- do not create a second holder.

Preserve live holder state, including at minimum:
- weaponId / def
- phase
- elapsed
- shotsFired
- meta.nextShot
- aim/timing state
- reload/sequence state where present
- crit/fire-family behavior
- all relevant metadata not explicitly invalidated by ownership.

Example acceptance law:
M249 has 12-shot sequence. Enemy has already fired 5. Frost steals it and receives the same holder with 7 sequence shots remaining, not a fresh 12-shot holder.

After transfer:
- mark that holder Frozen immediately;
- presentation may visibly transfer/dock the same gun;
- real ownership truth changes exactly once;
- after the Gold transfer/dock eligibility point, Frost can continue the remaining weapon sequence, including while the A2 active window is still alive.

If Frost is already armed:
- do not steal;
- do not swap;
- do not create storage/second slot;
- enemy keeps weapon;
- Cold Shock still applies.

A2 does not steal melee, grenade, shields, or T6/Stormbreaker.

## 8. Identity / legacy ICE quarantine

The baseline still contains old ICE gameplay and iceVisualRuntime behavior.

FROST implementation must intentionally supersede old ICE rework mechanics:
- remove/replace live ice.bullets / ice.lane / ice.deep_freeze selection for the canonical ICE storage hero;
- use frost.* mechanics only;
- do not double-run old and new mechanics.

Legacy ICE presentation code currently keys some effects/audio off source.name == ICE.
Because FROST may retain physical/storage name ICE, add a narrow semantic distinction so legacy ICE renderer/audio ignores FROST rework status/events.
The suppression predicate must identify the semantic SOURCE/event as FROST rework. Do not infer suppression from the TARGET body's hero/type, and do not introduce undefined-scope owner/source variables.
Do not globally delete old ICE support if it is still needed outside the product rework path.

FROST Gold presentation is the only FROST-specific freeze-shell authority in the reworked product path.

## 9. Presentation authority

Canonical Gold:
01_OWNER_APPROVED_GOLD_REFERENCE.html
SHA-256:
59201be3d33bdfbeb8459656d3ef37caf922382a06852bd7a609472fdce2da43

Preserve:
- Frost source-art segmentation / anti-fringe rig.
- compact direct-frontal ice head/core identity.
- A1 breath and macro crystallization front.
- stable lane material structure.
- A2 actual-path trail and large turn-carve/gouge language.
- Frozen firearm material overlay while preserving gun identity.
- Frozen Bullet visual language.
- physical target freeze shell / crack / thaw lifecycle.
- authored material hierarchy and battle-scale readability.

Visual hierarchy:
MACRO SHAPE -> MATERIAL STRUCTURE -> SUPPORT SHAPES -> SMALL ACCENTS.

Do not replace Gold with generic particles/shapes.
A head-layer extraction plus generic cyan fillRect/strokeRect/line rendering for A1/A2/Frozen Gun/Frozen Bullet/Freeze shell is NOT a Gold port and must fail acceptance.
The approved Frost battle identity is compact/direct-frontal: do not rotate the entire head/core asset to fighter movement direction merely because locomotion heading changes. Any directional skill choreography must be expressed by the skill effect/pose logic while preserving the selected frontal identity.
The production presentation bridge must actually consume real Frost gameplay events/state for A1 breath/front, A2 trail/turn-carves, Frozen Gun, Frozen Bullet, steal transfer, Freeze shell/refresh, crack and thaw.
Do not let presentation offsets modify gameplay locomotion or collision.
Do not derive gameplay footprint from sprite dimensions.
Do not execute/parse the full standalone HTML every production frame; bridge/extract/cache the authored algorithms/assets like Hunter/Crystala.

## 10. Explicit non-authority from Gold/demo

Do NOT port:
- Arrow-key movement.
- mouse aim.
- fake opponent AI.
- fake floor gun lifecycle.
- demo auto showcase.
- demo base speeds.
- manual L/F/U staging.
- demo collision radii.
- forced/passive proc staging.
- any demo A2 homing/steering.
- standalone balance numbers that conflict with this authority.

## 11. SFX

FROST-specific SFX are intentionally OUT OF SCOPE.

Do not:
- browse for sounds;
- add placeholder ice sounds;
- reuse old ICE-specific audio as new Frost authority;
- create a new AudioContext.

Existing normal Arsenal weapon/equip/fire audio remains unchanged.

## 12. Playtest V0 balance lock

Implement exactly for first owner playtest:
- A1: CD 10.5, cast ~0.25, length 650, width 160, floor 4.5, Frost x2.35, enemy x0.60, chill linger 0.35, thaw ~0.30, zero direct damage.
- A2: CD 12.5, active 3.0, trail width 120, segment life 3.5, Frost x2.35 on ice, enemy x0.60, Cold Shock x0.50 for 1.0, zero direct damage.
- Passive: 8% total Lv1, Freeze 0.90, refresh-to-0.90 on successful reproc while Frozen, post-thaw lock 0.50.

These are owner-approved implementation/playtest values, not permission for the agent to retune.

## 13. Protected-state law

Start from 6b83fc6502eb8e23e4bd122074fc7fdfb47441ae.

Do not regress or redesign:
- CRYSTALA V2.
- ROBOT.
- HUNTER.
- Chamber.
- Arsenal spawn/damage/crit/weapon semantics.
- existing Gold/presentation systems.
- blood/splatter/damage-number laws.

Shared changes are allowed only where Frost truly requires a narrow capability that does not exist, such as:
- exact holder transfer;
- Frozen pickup eligibility metadata/hook;
- semantic shot/blast grouping;
- Frost-specific floor speed resolution;
- legacy ICE presentation suppression for Frost identity.

Every shared change needs a focused Frost gate and an unrelated-regression gate.

## 14. Completion standard

Green tests alone are not acceptance.

Before completion:
1. sentence-level authority audit;
2. real-game deterministic behavior tests;
3. real-browser battle-scale proof;
4. Gold parity inspection;
5. broad regressions;
6. owner gameplay playtest readiness.

Never declare FROST complete solely because headless/CI is green.
