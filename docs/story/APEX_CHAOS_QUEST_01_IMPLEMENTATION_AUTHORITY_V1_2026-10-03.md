# APEX CHAOS — QUEST 01 IMPLEMENTATION AUTHORITY v1
## THE ONES THROWN AWAY

**Status:** current approved implementation authority.  
**Supersedes:** all earlier Quest 01 gameplay working notes.  
**Story authority:** `APEX_CHAOS_WORLD_STORY_BIBLE_V0_1_2026-10-01.md`

---

# 0. NON-NEGOTIABLE LAWS

- Player-facing protagonist name: **NEWBOT**.
- Internal code/storage may retain `ROBOT` where migration risk makes renaming unsafe.
- NEWBOT's first friend: **T.O.T**.
- Third rejected Bot / workshop survivor: **RIVET**.
- Arsenal Battle remains combat truth.
- MATCH_HP = 1000.
- ARSENAL_DAMAGE_SCALE = 7 for Arsenal equipment according to current production authority.
- Normal offensive spawn cadence = 4.5s.
- Offensive active cap = **5 in every Quest 01 encounter**.
- Emergency-firearm law remains canonical unless an authored opening temporarily holds normal spawn.
- Stormbreaker uses its production weapon behavior; no fake Story-only combat version.
- Do not reveal alien truth, Crystala, or full Botfall history in Quest 01.
- Do not call the corruption a confirmed virus until characters have enough evidence; command/override language is preferred in Quest 01.
- T.O.T dies permanently.
- RIVET survives Quest 01 in an unresolved damaged/corrupted state.
- No Shop/Lucky Draw/Upgrade/economy interruption after T.O.T's death.

---

# 1. QUEST STRUCTURE

1. WAKE / REFLEX
2. WORKSHOP — THREE FAILURES
3. FIRST WAKE
4. SCRAP SWARM
5. WEAPON RAIN
6. CHARGE THE BREAKER
7. BREACH WAVES
8. RIVET OVERRIDDEN
9. T.O.T — LAST CHOICE
10. OUTSIDE

Target first-play duration: roughly 32–42 minutes.

---

# 2. ENCOUNTER 01 — REFLEX

## Story purpose
NEWBOT and T.O.T discover that their bodies understand weapon acquisition and combat before their conscious minds do.

## Participants
- NEWBOT: 1000 HP.
- T.O.T: 1000 HP.

## Opening
Normal offensive cadence is held.

### Authored Drop R1
- PISTOL.
- strongly favors NEWBOT.
- NEWBOT acquires and fires.
- first confirmed hit on T.O.T enters a short in-engine story hold.
- NEWBOT reacts with guilt and attempts communication.

### Authored Drop R2
- PISTOL.
- strongly favors T.O.T.
- T.O.T acquires and returns fire.
- first confirmed hit on NEWBOT ends the hold.

Normal Arsenal then resumes:
- cadence 4.5s;
- cap 5;
- emergency firearm enabled.

## Intro weapon pool
Readable subset only:
- PISTOL
- GLOCK_17
- SMG
- SHOTGUN
- DAGGER
- SABRE

Excluded:
- Stormbreaker
- grenade
- shields
- precision / high-volume advanced guns
- heals

## Skill reveal
A1/J appears only after T.O.T has retaliated and NEWBOT has taken confirmed damage.

Player-facing first cue:
**UNKNOWN ROUTINE — J**

After first use, reveal canonical A1 name.

A2/K appears only after A1 has been used and combat has continued briefly.

No more tutorial prompts after first A2 use.

## End condition
Story trigger:
- NEWBOT <= 500 HP
- AND T.O.T <= 500 HP

Hidden safety floor for first-pass tuning:
- 250 HP.

The floor is only to prevent accidental canon break. Repeated floor hits are a tuning failure and must be visible in telemetry.

When both thresholds are reached:
- stop new attack scheduling;
- resolve dangerous active transactions;
- RIVET fires Stormbreaker suppression;
- blackout.

No canonical loss in REFLEX.

---

# 3. WORKSHOP — THREE FAILURES

NEWBOT wakes in RIVET's workshop.

Required local reveals:
- Scrap Basin is old THE BOT Project disposal infrastructure.
- NEWBOT, T.O.T and RIVET are rejected units.
- RIVET has been awake longer.
- RIVET salvaged Stormbreaker.
- controlled Stormbreaker discharge can interrupt Bot acquisition/combat routines.
- NEWBOT lacks a valid registered Bot-network identity.
- T.O.T and RIVET are registered.

Do not explain why this matters fully yet.

RIVET has not escaped because:
- Stormbreaker containment requires an operator;
- opening the wall requires substantial external impact/energy input;
- RIVET could not safely run the rig and generate that input alone.

NEWBOT and T.O.T waking makes a real escape attempt possible for the first time.

---

# 4. ENCOUNTER 02 — FIRST WAKE

## Intended fantasy
NEWBOT and T.O.T fight beside each other for the first time against two newly awakened Scrap Bots.

## Technical gate
The shipping engine must pass a multi-actor spike before this exact 2v2 form is implemented.

Do not rewrite Hero Rework combat authority merely to force 2v2.

If true team-vs-team cannot be added without invasive core changes, preserve the story fantasy through the safest compatible composition approved after the spike.

## First-pass target composition
- NEWBOT: 1000 HP.
- T.O.T: 1000 HP.
- SCRAP-A: 350 HP.
- SCRAP-B: 350 HP.

Scrap Bots:
- normal Arsenal outgoing damage;
- reduced HP only;
- no hero skills;
- no hidden resistance.

Spawn:
- cadence 4.5s;
- cap 5.
- two authored opening telegraphs may be placed separately.
- then return to normal director.

Pool:
- ordinary firearms;
- grenade;
- melee;
- shields;
- no Stormbreaker.

Heals:
- canonical <=800 HP support.

If T.O.T is downed first, NEWBOT may finish.
NEWBOT KO = retry.

Story result:
RIVET notes those units had been inert.
No corruption conclusion yet.

---

# 5. ENCOUNTER 03 — SCRAP SWARM

## Identity
Many dangerous hands, fragile bodies.

The gameplay challenge is weapon contention, not bullet-sponge health.

## Technical preference
Prefer representing the hostile swarm through compatible extra-body / multi-body plumbing rather than inventing several independent global logical combatants if the engine spike proves that safer.

## Wave 1
- 3 Scrap Bots.
- 280 HP each.

## Wave 2
- 4 Scrap Bots.
- 220 HP each.
- two may wake first, then two more ~1–2s later.

No Wave 3 in v1.

NEWBOT:
- starts 1000 HP;
- HP persists between waves;
- cooldowns persist.

Spawn:
- 4.5s unchanged;
- cap 5 unchanged;
- one pending authored telegraph allowed at each wave start;
- no Stormbreaker.

Enemy identity:
- high pickup/acquisition commitment;
- ordinary Arsenal damage;
- no A1/A2/passive;
- no hidden damage reduction.

NEWBOT KO = retry.

Story:
T.O.T can joke briefly over comms early.
By Wave 2, tone shifts.
RIVET concludes repeated awakening is no longer easy to dismiss as coincidence.

---

# 6. ENCOUNTER 04 — WEAPON RAIN

## Identity
SCRAP SWARM = too many hands for normal supply.  
WEAPON RAIN = too many weapon opportunities for normal battlefield behavior.

## Suggested composition
- NEWBOT: 1000 HP.
- T.O.T: ally if technical spike permits.
- 2 hostile Scrap Bots at 450 HP each.

## Spawn progression
**Cap stays 5 throughout.**

Phase A:
- cadence 3.0s;
- cap 5;
- ~8s.

Phase B:
- cadence 1.6s;
- cap 5;
- ~12–15s.

Phase C:
- authored 3-telegraph burst scheduled tightly;
- all spawns still obey cap 5;
- rapid replenishment occurs as slots are removed;
- then new spawns stop.

Weapon pool:
- ordinary firearms;
- grenade;
- melee;
- shields;
- no Stormbreaker.

Heal system remains on its normal independent law. Weapon Rain does not accelerate heals.

End:
- hostile Bots KO;
- scripted Rain sequence reaches its observation climax.

If enemies die early, complete the final Rain observation without spawning filler enemies.

Story conclusion:
RIVET notices the Drop system itself behaved abnormally.

Still no confirmed cause.

---

# 7. INTERLUDE — RIVET'S ESCAPE PLAN

RIVET now has enough evidence to conclude staying inside the basin is becoming unsafe.

The wall gate is physically recoverable but dead.

RIVET reveals:
- Stormbreaker can provide enough power;
- its full output cannot be dumped safely into the gate directly;
- RIVET built an impact accumulator;
- the accumulator requires external damage/impact while RIVET keeps Stormbreaker stable.

Foreshadow the gate law here:

**REGISTERED OPERATOR REQUIRED FOR LOCAL LATCH**

At this point the intended operator is RIVET, so the line does not read as a death flag.

---

# 8. ENCOUNTER 05 — CHARGE THE BREAKER

## Target
**IMPACT ACCUMULATOR**

It:
- does not move;
- does not attack;
- cannot acquire;
- cannot kill NEWBOT;
- accepts canonical damage;
- converts final accepted damage into charge.

Player-facing UI:
**STORMBREAKER CHARGE 0% → 100%**

Do not show an enemy HP bar.

## First-pass reservoir
6000 final accepted damage.

This is tuning-only.

Crits and real Arsenal damage count naturally.

## Spawn
Cap remains 5.

0–50%:
- cadence 3.0s;
- cap 5.

50–85%:
- cadence 2.2s;
- cap 5.

85–100%:
- authored 3-telegraph burst;
- obey cap 5;
- then hold new spawns.

No Stormbreaker in pool.

No enemy by default.

If playtest proves the sequence too passive, at most one low-HP interruption Bot may be tested later; not part of v1 authority.

Visual milestones:
- 25% internal glow;
- 50% channels/cracks illuminate;
- 75% Stormbreaker arcs to rig;
- 90% surrounding scrap/wall flicker;
- 100% stored energy releases into Stormbreaker.

No failure state.

---

# 9. STORMBREAKER PULSE

At 100%:
- Stormbreaker sends power into old infrastructure.
- wall buses wake;
- relays reboot;
- gate responds;
- distant systems answer even where RIVET did not directly supply power.

This does **not** yet prove corruption.

It proves the basin is no longer isolated in the way RIVET expected.

---

# 10. ENCOUNTER 06 — BREACH WAVES

## Identity
The player shifts from:
“things are waking”
to:
“things are arriving with structure.”

No tower-defense base HP.

RIVET operates the rig.
NEWBOT/T.O.T fight.

## Wave A
- 3 Scrap Bots.
- 300 HP each.
- normal 4.5s cadence.
- cap 5.

## Wave B
- 4 Scrap Bots.
- 260 HP each.
- 2 left / 2 right.
- stagger 1–1.5s.
- cadence 3.5s.
- cap 5.

## Wave C
- 3 Scrap Bots.
- 320 HP each.
- tighter arrival timing.
- one authored two-weapon burst after entry.
- cadence 3.0s.
- cap 5.

Do not exceed 4 newly activated hostiles simultaneously in v1.

Between waves:
- player HP persists;
- cooldowns persist;
- no free full heal;
- floor items persist unless unsafe for transition.

Command residue may first appear during late waves:
- ACQUIRE
- RETURN
- SECURE
- IDENTIFY

Do not render it as a villain voice.

End:
- final hostiles KO;
- a distant relay answers;
- RIVET confirms the command traffic is not originating from its workshop.

---

# 11. NETWORK IDENTIFICATION

No result screen.

NEWBOT, T.O.T and RIVET are scanned.

RIVET:
- REGISTERED.

T.O.T:
- REGISTERED.

NEWBOT:
- **NO VALID NETWORK ID**.

The characters do not know the true origin of the system.

---

# 12. RIVET OVERRIDE BUILDUP

RIVET is the unit most tightly connected to the reactivated infrastructure.

Progression:
1. RIVET pauses.
2. an arm reconnects a cable RIVET removed.
3. RIVET tears it back out.
4. command repeats.
5. body reconnects it involuntarily.
6. acquisition/combat posture activates.

RIVET:
> “Lùi lại.”

RIVET attempts shutdown and fails.

---

# 13. ENCOUNTER 07 — RIVET OVERRIDDEN

NEWBOT vs RIVET.

T.O.T is outside the direct combat lane.

Start:
- NEWBOT 1000 HP.
- RIVET 1000 HP.
- visible repair before fight; no hidden reset.

Spawn:
- 4.5s;
- cap 5;
- ordinary pool;
- no Stormbreaker;
- canonical heals.

RIVET:
- no bonus max HP;
- no damage multiplier;
- no damage resistance;
- no fake boss skill.

Boss identity comes from stronger acquisition/pressure behavior and corruption presentation.

Thresholds:
- 1000→750: RIVET can still speak clearly.
- 750→450: command interruptions increase.
- 450→180: little voluntary speech.
- 180: immediate story transition floor.

At crossing 180:
- intercept lethal overflow;
- stop new attacks;
- resolve active hazards;
- transition immediately.

Do not leave RIVET sitting invulnerable at 180.

NEWBOT KO = retry from boss start.

After fight, RIVET establishes only:
the unknown system can address registered Bots and cannot address NEWBOT through the same normal identity path.

Do not declare universal immunity.

---

# 14. T.O.T'S QUIET DESCENT

T.O.T begins showing the same symptoms:
- hand twitch to floor weapon;
- head snap toward relay;
- command fragment appears;
- speech breaks;
- combat stance begins and is consciously suppressed.

NEWBOT wants another solution.

RIVET checks the gate.

The previously foreshadowed authorization rule becomes critical:

- Stormbreaker can power the gate.
- A registered Bot must hold the local latch from inside during the opening cycle.
- NEWBOT is unregistered, so the gate will not accept it as operator.
- RIVET is registered but too damaged/unstable after the override.
- T.O.T is registered and still physically capable.

This is not framed as destiny.
It is a bad engineering reality.

---

# 15. LAST REPAIR / FRIENDSHIP BEAT

RIVET performs the last stable workshop repair cycle.

Final-fight start:
- NEWBOT 1000 HP.
- T.O.T 1000 HP.

RIVET remains damaged and cannot join.

Friendship acknowledgement occurs here or immediately before takeover:

NEWBOT:
> “Chúng ta là bạn à?”

T.O.T:
> “Tôi nghĩ vậy.”

---

# 16. ENCOUNTER 08 — T.O.T: LAST CHOICE

## Phase 1
NEWBOT vs T.O.T.

T.O.T HP 1000→700.

Spawn:
- 4.5s;
- cap 5;
- ordinary pool;
- no Stormbreaker.

No hidden damage/defense buff.

T.O.T's own voice is never taunting.
Corruption text is cold; T.O.T is frightened, frustrated or protective.

## Stormbreaker transition
At first downward crossing of 700:
- hold new normal offensive spawns;
- resolve active transactions;
- unlock the single Stormbreaker artifact;
- author its floor position to strongly favor T.O.T.

NEWBOT should not be able to steal this authored story artifact before T.O.T without a clear presentation reason.

No conditional rescue H5.
No hidden fairness heal.

The checkpoint is the fairness mechanism.

## Stormbreaker phase
Use current production authority:
- confirmed hit damage 446;
- confirmed hit stun 2.0s;
- throw speed 1350;
- bounded homing 2.6 rad/s;
- miss lifecycle max 2.2s;
- floor bolt contact stun 1.0s, zero damage.

The player must survive one real Stormbreaker release.

If NEWBOT KOs:
retry from immediately before the Stormbreaker transition.

After hit or miss resolves:
- do not spawn a duplicate Stormbreaker;
- the same artifact returns to the gate cradle through story/presentation continuity only after canonical combat lifecycle has completed.

## Phase 3
Ordinary Arsenal resumes:
- 4.5s;
- cap 5;
- Stormbreaker excluded.

T.O.T HP 700→120.

Late exchange direction:

NEWBOT:
> “Tôi không đánh nữa!”

T.O.T:
> “Cậu phải đánh.”

Later:

> “Nếu cậu dừng...”
> “...tôi sẽ không.”

At first crossing of 120:
- intercept overflow;
- stop new spawns;
- clean dangerous active transactions;
- transition immediately to final choice.

---

# 17. T.O.T'S SACRIFICE

Combat damage destabilizes the override enough for a short window of agency.

Stormbreaker is in the gate cradle.

The gate requires:
- Stormbreaker energy;
- a registered Bot holding the local latch from inside.

NEWBOT cannot hold the latch because it is unregistered.

RIVET cannot hold it reliably because its body/control system is too damaged.

T.O.T can.

NEWBOT offers to remain.

T.O.T refuses.

The choice must not imply T.O.T is disposable because it is infected.

The meaning is:
- T.O.T cannot trust what it will do next;
- NEWBOT can survive outside;
- T.O.T chooses how to spend its remaining agency.

T.O.T:
> “Từ lúc tỉnh dậy đến giờ... tôi chưa từng chọn được mình có nhặt súng hay không.”

T.O.T takes the latch.

> “Nhưng tôi có thể chọn mình làm gì với nó.”

Unknown command:
**ELIMINATE TARGET**

T.O.T's body tries to obey.

T.O.T holds the gate.

NEWBOT hesitates.

T.O.T:
> “Đi.”

NEWBOT still hesitates.

T.O.T:
> “Cậu muốn biết mình là ai mà.”

Final callback:

> “Lần này...”
> “...tôi dừng được rồi.”

Stormbreaker peaks.

Gate opens.

T.O.T shuts down permanently.

No explosion.
No disintegration.
Stillness.

---

# 18. RIVET END STATE

RIVET remains inside the Scrap Basin.

Status:
**UNKNOWN / DAMAGED / CORRUPTED**

Do not show death.
Do not show full recovery.

Future return remains open.

---

# 19. OUTSIDE

NEWBOT crosses the wall alone.

Immediate outside is a quiet, broader region.

Do not introduce a human settlement or exposition NPC immediately.

Civilization is visible only at distance:
- lights;
- structures;
- transport;
- industrial silhouettes;
- other evidence that EAX-1 is inhabited.

A distant Bot may visibly react to a Drop/command so NEWBOT recognizes the danger extends beyond the basin.

Quest end:

**QUEST 01 COMPLETE**  
**THE ONES THROWN AWAY**

No reward spam.
No Shop/Draw popup.
No account prompt over the death beat.

Primary next action:
**CONTINUE STORY**

---

# 20. RETRY / CHECKPOINT AUTHORITY

Autosave/checkpoints:
1. before REFLEX combat opens;
2. after REFLEX / workshop arrival;
3. before FIRST WAKE;
4. before SCRAP SWARM;
5. before WEAPON RAIN;
6. before CHARGE THE BREAKER;
7. before BREACH WAVES;
8. before RIVET boss;
9. before T.O.T final boss;
10. immediately before Stormbreaker transition inside final boss;
11. Quest complete.

Retry must clear:
- projectiles;
- stale pickups not checkpoint-authored;
- dialogue queue;
- story reservations;
- command overlays;
- stun/status residue;
- Stormbreaker presentation/combat ownership state.

---

# 21. TECHNICAL GATES BEFORE FULL IMPLEMENTATION

## Gate A — Multi-actor spike
Prove:
- 1vMany hostile bodies;
- shared pickup competition;
- correct target ownership;
- damage attribution;
- KO;
- projectile targeting;
- melee/grenade/shield behavior;
- emergency firearm;
- Hero Rework compatibility.

Then test true 2v2.

Do not rewrite the reworked combat core to satisfy Quest composition.

## Gate B — Quest Director vertical slice
Implement only:
WAKE → REFLEX → RIVET suppression → workshop checkpoint.

Do not build all eight encounters until this bridge is stable.

## Gate C — Save/profile authority
Quest checkpoints must write through the unified player profile layer, not create another isolated localStorage island.

---

# 22. SUCCESS CONDITION

By the end of Quest 01, the player should understand:
- how core Arsenal combat works;
- that NEWBOT and T.O.T did not initially choose to fight;
- the Scrap Basin is waking abnormally;
- the anomaly escalates into structured command/override behavior;
- registered Bots can be addressed by that system;
- NEWBOT cannot be addressed through the same identity path;
- T.O.T chose to disobey the final command and die to let NEWBOT leave.

The player should **not** yet know:
- Crystala;
- the alien purpose of Drops;
- the true architect of Botfall;
- the full reason NEWBOT was rejected;
- why Stormbreaker fell into the basin;
- why Day Zero happened now.

