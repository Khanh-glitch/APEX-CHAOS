# SUPERSEDED — HISTORICAL WORKING NOTES ONLY

> This file preserves the iterative design history of Quest 01. It is **not implementation authority**.
>
> Use `docs/story/APEX_CHAOS_QUEST_01_IMPLEMENTATION_AUTHORITY_V1_2026-10-03.md` for the current approved Quest 01 truth.

---

# APEX CHAOS — QUEST 01 GAMEPLAY v1
## THE ONES THROWN AWAY

**Status:** gameplay working authority aligned to WORLD & STORY BIBLE v0.1.  
**Core law:** Arsenal Battle remains the combat truth. Quest variety comes from encounter composition, spawn laws, story thresholds and scripted Stormbreaker states rather than a separate campaign combat engine.

---

# 1. PLAYER EXPERIENCE SUMMARY

Quest 01 should feel like the Scrap Basin is gradually waking up around NEWBOT, BOT and BOT2.

The escalation is:

1. **1v1 discovery** — NEWBOT vs BOT.
2. **small defense** — first dormant scrap Bots wake.
3. **1vMany Arsenal** — several weak Bots compete for weapons at once.
4. **Weapon Rain** — weapon spawning becomes abnormally dense and unstable.
5. **Stormbreaker Charge** — player attacks an inert kinetic/energy accumulator with enormous HP to charge the escape system.
6. **BOT2 corruption encounter** — evidence that the attacks are not random.
7. **BOT + Stormbreaker finale** — emotional final fight and sacrifice.

The mystery must be experienced before it is named.

---

# 2. ENCOUNTER 01 — REFLEX

**Format:** NEWBOT vs BOT.  
**Purpose:** tutorial + first relationship beat.

- First Drop is scripted toward NEWBOT.
- NEWBOT automatically acquires and fires.
- Second Drop is scripted toward BOT.
- BOT fires back.
- HP HUD fades in only after retaliation.
- A1 and A2 are revealed progressively.
- Normal Arsenal rules take over.
- Encounter ends before either character dies, using a story HP threshold.
- BOT2 interrupts with Stormbreaker discharge.

No Virus terminology appears.

---

# 3. HUB BEAT — THREE FAILURES

BOT2 brings both units to its scrap workshop.

Player learns only local facts:
- Scrap Basin belongs to abandoned Bot-era disposal infrastructure.
- all three are rejected machines;
- BOT2 has been awake longer;
- Stormbreaker fell into the basin and is being used as an electrical source;
- BOT2 can use its discharge to temporarily interrupt Bot combat routines.

BOT and NEWBOT begin forming a relationship.

---

# 4. ENCOUNTER 02 — FIRST WAKE

**Format:** NEWBOT + BOT defend against 2 weak Scrap Bots.  
**Purpose:** first evidence the basin is waking.

Special law:
- enemy Bots have reduced HP;
- they use normal Arsenal acquisition;
- their danger comes from numbers, not inflated stats.

Recommended starting tuning:
- 2 enemies;
- each around 35–45% of normal fighter HP;
- standard Arsenal damage;
- standard weapons;
- no special boss buffs.

NEWBOT and BOT share the field on the same side.

Important implementation principle:
the enemies may all contest the same weapon pool. The encounter should visually demonstrate several machines suddenly changing direction toward one Drop.

After the fight, BOT2 notes that those units had been inert for a long time.

Nobody says Virus.

---

# 5. ENCOUNTER 03 — SCRAP SWARM

**Format:** 1vMany / staged multi-Bot fight.  
**Playable:** NEWBOT.  
**BOT role:** present as ally/supporting fighter or story-side participant depending on stable implementation.

This is the main gameplay-diversity encounter.

## Enemy law

Use several weak Bots rather than one normal-health opponent.

Suggested shape:
- Wave 1: 3 Bots at ~25–30% normal HP.
- Wave 2: 4 Bots at ~20–25% normal HP.
- Optional final pressure: 2 additional Bots if the previous group dies too quickly.

Enemies:
- acquire weapons aggressively;
- can pick different Drops;
- die quickly;
- should create weapon competition and crossfire.

Do not multiply full-health 1000 HP fighters.

The intended feeling is:
> many dangerous hands, fragile bodies.

This allows Arsenal mechanics to produce emergent chaos without inventing a new combat system.

Afterward, NEWBOT/BOT/BOT2 begin questioning why multiple dormant Bots are waking in sequence.

---

# 6. ENCOUNTER 04 — WEAPON RAIN

**Format:** normal combat under abnormal spawn conditions.  
**Story function:** prove that the instability is not limited to dormant Bots.

A new group wakes or attacks while Weapon Drops begin occurring far faster than normal.

## Weapon law

For this encounter only:
- offensive active cap may be temporarily raised;
- spawn cadence is much shorter than normal;
- multiple telegraphs may overlap;
- weapons should appear in visibly abnormal bursts.

The goal is not to make the encounter harder only through damage.

The goal is:
> the battlefield no longer behaves like the Arsenal rules the player just learned.

The player should notice the difference immediately.

Possible pacing:
- first 8–10 sec: slightly faster than normal;
- next 10–15 sec: heavy Drop density;
- climax: short burst where several telegraphs are visible at once;
- then abrupt collapse back toward silence.

BOT2 should react to the **spawn system**, not simply enemy count.

Example story observation:
> “Không phải chỉ mấy con Bot. Cả bãi này đang phản ứng.”

Still no definitive Virus answer.

---

# 7. WHY STORMBREAKER MUST BE ACTIVATED

Repeated Bot awakenings and Weapon Rain convince BOT2 that remaining inside the basin is becoming unsafe.

The containment wall/gate is still physically functional but lacks enough stored energy to open.

Stormbreaker cannot simply be switched to full output safely.

BOT2 has built a crude **kinetic/impact accumulator** around it.

The machine converts repeated combat impact into stored activation energy.

This becomes the next playable encounter.

---

# 8. ENCOUNTER 05 — CHARGE THE BREAKER

**Format:** damage objective, not enemy battle.  
**Target:** inert accumulator / kinetic stone / impact core.

The target:
- has extremely high effective HP;
- does not attack;
- does not move;
- does not acquire weapons;
- cannot kill the player;
- exists only to absorb damage and convert it into charge.

This should still use canonical damage transactions.

Every point of legitimate Arsenal damage contributes to the charge total.

## Why this works

It preserves the player's normal actions:
- acquire guns;
- use melee;
- use grenade;
- use A1/A2;
- chase damage opportunities.

But the emotional meaning flips:

> for the first time, the player is not trying to defeat someone.

They are trying to **feed energy into a machine**.

## Presentation

The target begins visually inert.

As damage accumulates:
- cracks/light channels appear;
- Stormbreaker arcs become more frequent;
- nearby junk vibrates;
- wall systems flicker awake.

Recommended objective presentation:
**CHARGE: 0% → 100%**

Do not show a normal enemy HP bar if possible.

Internally it may be an HP-like damage reservoir, but player-facing UI should communicate stored energy.

## Spawn law

Weapons should spawn fast enough that the player is encouraged to cycle through Arsenal tools.

This doubles as a natural weapon showcase.

No need to make this mechanically difficult.

The satisfaction is in producing escalating destruction and charge.

---

# 9. CONSEQUENCE — THE BASIN ANSWERS

At 100% charge:

Stormbreaker releases a large pulse into the old wall infrastructure.

The gate begins to wake.

But more importantly, systems throughout the Scrap Basin respond.

Lights, old relays and Bot nodes come online.

This is not yet framed as:
> we connected to the Virus.

Instead:

> something answered.

The group detects external or unknown command traffic for the first time.

BOT2 cannot identify the sender.

---

# 10. ENCOUNTER 06 — BREACH WAVES

**Format:** defensive waves around the Stormbreaker rig.

Now the awakened Bots attack in more organized timing.

This is the moment the characters begin to reject the “random malfunction” explanation.

Suggested structure:
- Wave A: 3 weak Bots.
- brief pause/dialogue.
- Wave B: 4 weak Bots with faster acquisition.
- Wave C: mixed survivors + abnormal Weapon Drop burst.

NEWBOT and BOT fight together.

BOT2 remains at the machine trying to understand and stabilize the signal.

During the encounter, corrupted command fragments can appear in UI/audio for the first time, but they are incomplete:
- ACQUIRE
- RETURN
- SECURE
- TARGET

No alien explanation.

No full lore dump.

---

# 11. BOT2 CORRUPTION

BOT2 is the unit most tightly connected to the reactivated infrastructure.

The unknown command stream begins overriding it.

This happens gradually during/after Breach Waves:
- involuntary movement;
- repeated command text;
- BOT2 disconnects and reconnects cables against its own intent;
- its dialogue becomes interrupted.

NEWBOT is also pinged but fails identification because it lacks a valid registered network identity.

BOT receives valid traffic and begins showing early symptoms, but takeover is slower.

---

# 12. ENCOUNTER 07 — BOT2 OVERRIDDEN

**Format:** standard Arsenal boss fight.  
**Purpose:** first direct proof that an outside command system can seize a Bot.

BOT2 remains mechanically compatible with Arsenal Battle.

Do not give arbitrary superpowers.

Its special identity comes from:
- more aggressive acquisition;
- Stormbreaker-related electrical interruptions;
- story dialogue;
- deliberate boss pacing.

BOT2 is not killed.

At critical threshold, enough damage destabilizes the override and allows BOT2 to regain partial control.

This reveals:
- BOT2 has a valid network identity;
- NEWBOT does not;
- whatever is issuing commands can recognize BOT2 but not NEWBOT.

BOT begins worsening.

---

# 13. FINAL ESCAPE SETUP

The wall can now open, but the Stormbreaker rig cannot sustain the required output.

Stormbreaker must be removed from the machine and used directly.

BOT2 is too damaged and compromised.

BOT volunteers.

Its own infection is progressing.

NEWBOT refuses.

Their friendship beat occurs here.

Stormbreaker is released.

The moment it becomes an active weapon, BOT's acquisition routine and corrupted command layer both lock onto it.

---

# 14. ENCOUNTER 08 — BOT + STORMBREAKER

**Format:** final Arsenal fight.  
**Emotional boss:** BOT.  
**Final exceptional weapon:** Stormbreaker.

The fight begins with ordinary Arsenal rules while BOT still intermittently resists.

At a story threshold, Stormbreaker becomes available and BOT acquires it through a scripted but visually plausible pickup.

From that point:
- canonical Stormbreaker behavior is used;
- no separate fake story version;
- BOT alternates between corrupted aggression and short moments of agency.

NEWBOT must fight.

BOT explicitly tells NEWBOT not to stop because BOT cannot guarantee it can stop itself.

BOT is protected by a narrative HP floor so accidental burst damage cannot break canon.

---

# 15. BOT'S SACRIFICE

At the final threshold, BOT temporarily regains control.

It recognizes that Stormbreaker can discharge directly into the gate system.

The action will destroy it.

The thematic payoff remains:

At the beginning:
> “Tôi không dừng được.”

At the end:
> “Lần này... tôi dừng được rồi.”

BOT chooses to use Stormbreaker to open the escape path rather than obey the command to eliminate NEWBOT.

BOT shuts down permanently.

NEWBOT exits the Scrap Basin alone.

---

# 16. ACTUAL PLAYABLE QUEST ORDER

| # | Encounter | Player actually does |
|---|---|---|
| 1 | REFLEX | 1v1 BOT, learn Arsenal + J/K |
| 2 | FIRST WAKE | NEWBOT/BOT fight 2 weak awakened Bots |
| 3 | SCRAP SWARM | fight multiple low-HP weapon-grabbing Bots |
| 4 | WEAPON RAIN | fight while weapons spawn at abnormal frequency |
| 5 | CHARGE THE BREAKER | unload Arsenal damage into an inert high-capacity charge target |
| 6 | BREACH WAVES | defend Stormbreaker rig from coordinated Bot waves |
| 7 | BOT2 OVERRIDDEN | standard Arsenal boss against corrupted BOT2 |
| 8 | BOT + STORMBREAKER | final emotional boss + escape |

---

# 17. VARIETY WITHOUT BREAKING CORE GAMEPLAY

Quest 01 uses only four fundamental changes to Arsenal Battle:

1. **enemy count**
2. **enemy HP**
3. **weapon spawn law**
4. **objective target / story threshold**

It does not require:
- platforming;
- escort AI;
- puzzle gameplay;
- stealth;
- tower-defense mechanics;
- a second combat engine.

This keeps Quest gameplay recognizable as APEX CHAOS while still making the campaign feel authored.

---

# 18. IMPORTANT TUNING LAW

Exact HP, Bot counts, spawn cadence and Stormbreaker charge requirements are not canon.

They must be tuned in playtest.

However, the intended combat identities are fixed:

- **weak multi-Bots:** fragile but numerous;
- **Weapon Rain:** density/instability, not stat inflation;
- **Charge target:** huge damage reservoir, zero offensive capability;
- **BOT2:** mechanical boss;
- **BOT:** emotional final boss.

---



# 19. IMPLEMENTATION-READY PASS A — FIRST THREE ENCOUNTERS

This section locks the first-pass playable specification for REFLEX, FIRST WAKE and SCRAP SWARM against the current Arsenal baseline.

Current Arsenal baseline used by this pass:
- MATCH_HP = 1000;
- ARSENAL_DAMAGE_SCALE = 7;
- normal offensive spawn cadence = 4.5s;
- normal offensive active cap = 5;
- emergency-firearm behavior remains part of the core;
- firearm crit and canonical weapon behavior remain unchanged.

The values below are **playtest tuning authority v1**, not immutable lore canon.

---

## 19.1 ENCOUNTER 01 — REFLEX

### Purpose

The player must finish REFLEX understanding:
- Drops are contested;
- NEWBOT's body already understands acquisition/combat;
- BOT is not an evil tutorial enemy;
- J and K are NEWBOT's direct intervention tools;
- normal Arsenal combat can continue without further hand-holding.

### Participants

- Player: NEWBOT — 1000 HP.
- Opponent: BOT — 1000 HP.
- No third combatant.
- No Virus state.

### Opening spawn script

Normal offensive cadence is held until the two authored opening Drops are complete.

#### DROP R1
- weapon: PISTOL;
- authored position favors NEWBOT strongly enough that NEWBOT reaches it first;
- NEWBOT acquisition is automatic;
- the first valid attack discharge is allowed;
- after the first confirmed hit on BOT, the battle enters a short story hold.

During the hold:
- damage simulation pauses;
- projectiles are resolved/cleared safely;
- NEWBOT looks at BOT;
- apology dialogue occurs;
- no result state is created.

#### DROP R2
- weapon: PISTOL;
- authored position is immediately favorable to BOT;
- BOT acquires it;
- BOT's first confirmed hit on NEWBOT ends the story hold and starts the real combat tutorial.

After R2:
- normal 4.5s offensive cadence resumes;
- active offensive cap returns/remains 5;
- emergency-firearm behavior resumes.

### Introductory weapon pool

REFLEX should use a deliberately readable subset rather than expose the entire Arsenal at once:

- PISTOL
- GLOCK_17
- SMG
- SHOTGUN
- DAGGER
- SABRE

Excluded for this encounter:
- Stormbreaker;
- grenade;
- shields;
- precision rifles;
- high-volume/advanced firearms;
- heals.

This restriction belongs only to REFLEX and exists to prevent the first battle from becoming a weapon encyclopedia.

### Skill reveal

#### A1 / J
Reveal only after:
- BOT has retaliated;
- NEWBOT has taken at least one confirmed damage transaction;
- at least one normal combat beat has occurred.

Player-facing cue:
**UNKNOWN ROUTINE — J**

After the first successful use, replace UNKNOWN ROUTINE with the canonical A1 name/skill UI.

#### A2 / K
Reveal only after:
- A1 has been activated once;
- combat has continued for a short additional beat.

After first use, reveal the canonical A2 identity.

No further tutorial prompts are allowed.

### HP / ending law

The authored ending target remains:
> both NEWBOT and BOT below 500 HP.

Safety:
- neither character may canonically die in REFLEX;
- use a hidden story floor sufficiently below the 500 trigger so ordinary damage still reads honestly;
- recommended first-pass floor: 250 HP;
- if an extreme burst would cross the floor, clamp the story actor instead of entering KO;
- as soon as both fighters are <=500 HP, stop scheduling new attacks and fire BOT2's Stormbreaker interruption.

If one fighter reaches the story floor while the other has not yet reached 500, continue only long enough to obtain the second threshold; this condition must be telemetry-visible because repeated occurrence means the tuning is bad and should be fixed rather than relying on the clamp.

### Failure / retry

REFLEX has no canonical loss.

The player can fail input timing, miss skill opportunities or take heavy damage, but the story proceeds to BOT2 interruption.

### Target duration

Approximately 2.5–4 minutes including authored pauses.

---

## 19.2 ENCOUNTER 02 — FIRST WAKE

### Story setup

After the workshop sequence, two nearby discarded Bots activate unexpectedly.

This is the first evidence that NEWBOT/BOT waking was not an isolated event.

The three protagonists do not know why.

BOT2 remains near the workshop/Stormbreaker system rather than becoming a normal combatant.

### Format

**NEWBOT + BOT vs 2 SCRAP BOTS**

This is the player's first allied Arsenal encounter.

### Player side

- NEWBOT: 1000 HP.
- BOT: 1000 HP after BOT2's immediate repairs.

BOT is AI-controlled but uses the same legal acquisition/weapon system.

BOT must never receive hidden damage bonuses merely because it is an ally.

### Enemy side

Two lightweight Scrap Bots:

- SCRAP-A: 350 HP.
- SCRAP-B: 350 HP.
- normal incoming Arsenal damage;
- normal weapon damage when attacking;
- no bespoke skills;
- no shields at spawn;
- no stat inflation.

Design identity:
> fragile opponents with full-danger weapons.

Their low HP, not weak guns, makes the fight readable.

### Spawn law

Keep core identity:
- cadence: 4.5s;
- offensive cap: 5.

At battle start only:
- author two separated question-mark telegraphs, one on each side of the central fight space;
- after those initial opportunities, immediately return to normal spawn director behavior.

This creates the first visual of four machines redirecting around shared Drops without turning the encounter into Weapon Rain.

### Weapon pool

Open the pool wider than REFLEX but still exclude exceptional/red-tier equipment.

Allowed:
- all ordinary firearms;
- grenade;
- standard held/thrown melee;
- shields.

Excluded:
- Stormbreaker.

Heal support:
- enabled under the normal <=800 HP rule;
- no special free heal;
- no enemy-specific heal prohibition.

### Multi-combat pickup law

All four living combatants are valid pickup actors.

A pickup is still taken by the first eligible living unarmed actor that reaches it.

No item duplication per team.

No reserved “player weapon” unless the existing counter-shield law creates a legitimate reservation.

### Targeting law

Each actor belongs to a side.

- NEWBOT/BOT target living hostile Scrap Bots.
- Scrap Bots target living NEWBOT/BOT.
- Target selection may prefer the closest/current threat but cannot create friendly fire intent.
- Arsenal projectile/area effects may still create normal emergent battlefield interactions if already canonical.

### Emergency firearm extension

Do not change the global Free Battle law.

For this Story encounter, the Story Director asks the existing spawn API for one immediate firearm when:
- at least one living actor exists on each side;
- no living combatant holds a firearm;
- no revealed firearm pickup exists;
- offensive cap has room.

The request must obey cap and must not per-frame spam.

This is the multi-combat generalization of the current two-fighter emergency intent, not a new weapon economy.

### Win condition

Both Scrap Bots reach KO.

NEWBOT and BOT may not both be KO.

If NEWBOT KOs, retry from encounter checkpoint.

If BOT KOs first while NEWBOT survives:
- do not instant-fail;
- NEWBOT may finish the fight;
- story afterward treats BOT as badly damaged and BOT2 repairs it.

This keeps ally behavior from creating unfair retries.

### Story beats during combat

Only 2–3 lines.

Suggested sequence:
1. BOT2: surprise that those units were inert.
2. BOT notices they are heading for Drops, not simply charging NEWBOT.
3. After victory, BOT2 states that two spontaneous reactivations at once are unusual.

No one uses the word **Virus**.

### Target duration

Approximately 1.5–3 minutes.

---

## 19.3 ENCOUNTER 03 — SCRAP SWARM

### Story setup

Shortly after FIRST WAKE, sensors/noise from deeper in the basin show additional movement.

BOT is temporarily kept at the workshop:
- repair/calibration;
- or monitoring another approach.

This creates a natural reason for NEWBOT to face the next event alone.

BOT and BOT2 remain available through dialogue.

### Core identity

**NEWBOT vs many low-HP Scrap Bots.**

The challenge is not one strong opponent.

It is:
> many independent actors able to steal different weapon opportunities.

Do not increase weapon spawn speed here.

Weapon Rain needs to remain a distinct later encounter.

### Wave structure

#### WAVE 1
- 3 Scrap Bots.
- 280 HP each.
- Spawn from three separated inactive scrap positions.
- They activate within a tight stagger rather than on the same exact frame.

#### Inter-wave beat
- maximum ~4–6 seconds;
- clear dead actors/projectile leftovers correctly;
- do not reset NEWBOT HP;
- do not reset NEWBOT skill cooldowns;
- Arsenal floor pickups remain unless unsafe for transition.

#### WAVE 2
- 4 Scrap Bots.
- 220 HP each.
- Enter from four separated positions.
- Two may wake first, followed by two more roughly 1–2 seconds later to avoid unreadable instant clutter.

No Wave 3 in v1.

If playtest shows the encounter is too short, adjust HP/count only after telemetry review rather than automatically adding endless waves.

### NEWBOT state

- starts at 1000 HP;
- persistent HP between Wave 1 and Wave 2;
- normal J/K;
- normal passive;
- no story invulnerability.

Normal KO = retry SCRAP SWARM.

### Enemy behavior

Every Scrap Bot:
- can move/acquire normally;
- can pick one normal Arsenal item while eligible;
- can attack NEWBOT with canonical equipment behavior;
- has no hero A1/A2;
- has no passive;
- uses no hidden damage reduction.

Acquisition emphasis:
- path/decision weight toward revealed offensive pickups should be high;
- aggression toward NEWBOT must not completely override pickup behavior.

Desired visual:
> a Drop appears and several weak Bots instantly redirect toward it.

### Spawn law

- offensive cadence: **4.5s unchanged**;
- offensive active cap: **5 unchanged**;
- ordinary spawn selection;
- Stormbreaker excluded.

At the start of each wave:
- one authored telegraph may already be pending to prevent a dead opening;
- after that, normal cadence only.

### Heal law

Normal heal support remains enabled for NEWBOT.

Scrap Bots may interact with heal pickups only if the shared pickup system supports it cleanly and predictably.

If multi-actor heal ownership creates implementation instability, the v1 fallback is:
- only NEWBOT is heal-eligible in SCRAP SWARM;
- document this explicitly as a Story encounter constraint;
- do not alter Free Battle heal rules.

### Win condition

All Wave 2 hostile actors are KO.

### Dialogue law

Dialogue must never compete with combat readability.

Maximum 4 short exchanges for the full encounter.

Suggested emotional purpose:
- BOT initially jokes from the workshop.
- Tone shifts after Wave 2 begins because too many units are waking.
- BOT2 stops treating the event as coincidence.

Final line direction:
> “Ba lần liên tiếp không còn là ngẫu nhiên nữa.”

Do not identify the cause yet.

### Target duration

Approximately 2.5–4 minutes.

---

## 19.4 FIRST-THREE-ENCOUNTER PACING CHECK

Expected first-session playable rhythm:

1. **REFLEX** — confused, intimate, 1v1.
2. **FIRST WAKE** — relief of fighting beside BOT; first external threat.
3. **SCRAP SWARM** — NEWBOT alone under numerical pressure; mystery escalates.

The player should reach the end of SCRAP SWARM with three beliefs:
- NEWBOT and BOT are becoming allies;
- the Scrap Basin is waking up around them;
- the Arsenal rules are still stable **for now**.

That last point is important because the following encounter, WEAPON RAIN, only works if the player has already learned what “normal” spawning feels like.

---



# 20. IMPLEMENTATION-READY PASS B — MID-QUEST ESCALATION

This section locks WEAPON RAIN, CHARGE THE BREAKER and BREACH WAVES.

The design goal is to create a clear escalation in **what is becoming abnormal**:

1. SCRAP SWARM proves more Bots are waking.
2. WEAPON RAIN proves Arsenal spawning itself is becoming unstable.
3. CHARGE THE BREAKER lets the player deliberately feed that instability into Stormbreaker.
4. BREACH WAVES proves the awakening is no longer random: hostile units arrive in organized pressure.

All three encounters continue to use canonical Arsenal damage and equipment behavior.

---

## 20.1 ENCOUNTER 04 — WEAPON RAIN

### Purpose

This encounter must feel immediately different from SCRAP SWARM without changing the core combat model.

SCRAP SWARM identity:
> too many hands for normal weapon supply.

WEAPON RAIN identity:
> too many weapons for a normal battlefield.

### Participants

Recommended first-pass:
- NEWBOT: 1000 HP.
- BOT: 1000 HP, AI ally.
- 2 hostile Scrap Bots: 450 HP each.

Do not increase enemy count beyond 2 in v1.

The visual overload comes from Drops, not bodies.

### Combat law

Damage:
- canonical.

Skills:
- NEWBOT canonical;
- BOT no extra bespoke skill logic unless its canonical story shell later receives one;
- Scrap Bots have no hero skills.

### Spawn progression

The encounter has three authored spawn phases.

#### PHASE A — SOMETHING IS OFF
Duration target: ~8 seconds.

- cadence: 3.0s;
- offensive cap: 5;
- normal weapon selection;
- no Stormbreaker.

This should feel faster, but still plausible.

#### PHASE B — WEAPON RAIN
Duration target: ~12–15 seconds.

- cadence: 1.6s;
- offensive cap: 8;
- normal spawn-position safety rules remain;
- allow overlapping question-mark telegraphs;
- do not bypass pickup/reveal legality.

The cap increase is local to this encounter.

#### PHASE C — BURST
Duration target: ~6–8 seconds.

Instead of lowering cadence further, issue an authored burst:
- 3 offensive telegraphs scheduled within roughly 1 second;
- then one more normal 1.6s cycle;
- then stop new spawns.

This creates a memorable climax without creating an unbounded spawn loop.

### Weapon pool

Allowed:
- all ordinary firearms;
- grenade;
- melee;
- shields.

Excluded:
- Stormbreaker.

Precision weapons remain allowed here because the purpose is to show Arsenal instability, not onboarding simplicity.

### Heal law

Keep heal support at normal <=800 HP eligibility.

Do **not** accelerate heal cadence with offensive Weapon Rain.

Support spawning remains independent and normal.

This prevents the encounter from accidentally becoming easier because the screen is also raining heals.

### Enemy behavior

The two Scrap Bots should remain strongly pickup-oriented.

BOT should also compete legitimately for weapons.

The desired visual is not:
> player has infinite guns.

It is:
> everyone is constantly being forced to reconsider the next weapon opportunity.

### Story beats

At entry:
BOT can joke that the basin seems generous.

Once Phase B begins:
tone changes.

BOT2 should explicitly notice the spawn frequency, not just enemy behavior.

Suggested direction:
> “Khoan. Drop không chạy như vậy.”

Near Burst:
> “Đừng nhặt hết. Tôi cần nhìn pattern.”

NEWBOT/BOT may ignore that naturally through acquisition behavior.

After Burst abruptly stops:
silence.

BOT2:
> “Không phải mấy con Bot.”
> “Cả hệ thống ở đây vừa phản ứng.”

No Virus naming yet.

### End condition

Preferred v1:
- both hostile Scrap Bots KO;
- AND scripted Weapon Rain sequence has reached Phase C completion.

If enemies die too early:
- keep the final Rain burst as a short non-hostile observation beat;
- do not spawn replacement enemies merely to fill time.

If Rain sequence ends while enemies remain:
- spawn law returns to normal 4.5s / cap 5;
- combat continues until enemies KO.

### Failure

NEWBOT KO = retry WEAPON RAIN.

BOT KO does not force retry.

### Target duration

Approximately 2–3.5 minutes.

---

## 20.2 INTERLUDE — BOT2'S HYPOTHESIS

After WEAPON RAIN, BOT2 compares three observations:

1. NEWBOT/BOT woke.
2. multiple scrap units woke afterward.
3. Drop cadence became abnormal in the same area.

BOT2 does **not** conclude Virus.

Its working hypothesis:
> old Scrap Basin infrastructure is being re-energized by activity around the awakened units and Stormbreaker.

BOT2 identifies the wall gate as the only plausible exit, but its power system is dead.

Stormbreaker contains enough energy to wake it, but BOT2 cannot safely dump full output directly into the old grid.

Its workaround is a crude impact accumulator.

---

# 20.3 ENCOUNTER 05 — CHARGE THE BREAKER

### Purpose

Give the player a non-combat use for the exact same Arsenal actions.

The player should feel:
> I am using combat as a tool.

Not:
> I am playing a different minigame.

### Target object

Working gameplay name:
**IMPACT ACCUMULATOR**

Story object:
a dense Crystala-era / industrial kinetic storage mass scavenged and wired by BOT2 into the Stormbreaker rig.

Exact lore material remains open.

### Core behavior

The accumulator:
- is stationary;
- cannot attack;
- cannot move;
- cannot acquire;
- cannot die in the normal character sense;
- accepts canonical damage transactions;
- converts accepted damage into CHARGE.

Player-facing UI:
**STORMBREAKER CHARGE: 0%**

Do not present a normal red enemy HP bar.

### Damage reservoir

Recommended first-pass charge reservoir:
**6000 effective damage**

Reason:
- current Arsenal damage is already scaled ×7;
- 6000 gives enough time for multiple weapon cycles without becoming a sponge marathon;
- this number is explicitly tuning-only and must be playtested.

Conversion:
- 1 point of final accepted damage = 1 charge unit.

No crit suppression.
No damage normalization.
A crit should charge more because the player genuinely dealt more damage.

### Player state

NEWBOT:
- 1000 HP;
- cannot be damaged by the accumulator;
- J/K active;
- passive active.

No hostile Bots in the first half of the encounter.

This creates a deliberate pacing release.

### Spawn law

Phase A — 0% to 50%:
- cadence: 3.0s;
- cap: 6;
- broad ordinary Arsenal pool;
- no Stormbreaker.

Phase B — 50% to 85%:
- cadence: 2.2s;
- cap: 7;
- preserve normal reveal/pickup rules.

Phase C — 85% to 100%:
- authored 3-weapon burst;
- then hold new spawns until charge completes.

This is not framed as random system instability.
BOT2 is intentionally overdriving local Drop attractors / scavenged spawning infrastructure if the final lore permits, or simply timing stored floor equipment if not.

Implementation should keep this distinction from WEAPON RAIN:
- WEAPON RAIN = uncontrolled abnormality;
- CHARGE = controlled exploitation.

### Weapon showcase law

The Story Director may bias selection to avoid immediate repetition.

Suggested family rotation:
- firearm;
- melee;
- firearm;
- grenade;
- firearm;
- shield only if useful;
- then ordinary weighted pool.

Do not guarantee every weapon.

Do not include Stormbreaker itself.

### Visual progression

At:
- 25%: first visible internal glow.
- 50%: cracks/channels illuminate.
- 75%: Stormbreaker arcs begin striking the accumulator rig.
- 90%: surrounding scrap vibrates / wall lamps flicker.
- 100%: accumulator locks and releases stored energy into Stormbreaker.

### BOT/BOT2 presence

BOT is physically present but not a competing fighter in v1.

BOT can react from outside the combat circle.

Reason:
the player should own this satisfying damage sequence.

BOT2 operates the rig.

### Optional micro-threat after 50%

Do **not** add enemies by default.

If playtest shows the sequence is too passive, the allowed fallback is:
- one single 200–250 HP Scrap Bot wakes after 60%;
- never more than one;
- its purpose is interruption, not a second combat encounter.

Default v1 remains target-only.

### Completion

At 100%:
- stop accepting further charge;
- stop new offensive spawns;
- safely resolve active projectiles;
- trigger Stormbreaker activation cinematic in-engine.

The accumulator is not “killed”.
It is **fully charged**.

### Failure

No normal failure condition.

This encounter should be cathartic.

If NEWBOT somehow receives environmental/story damage later, that is outside v1.

### Target duration

Approximately 1.5–2.5 minutes.

---

# 20.4 STORMBREAKER ACTIVATION CONSEQUENCE

100% charge causes a large Stormbreaker pulse.

Effects are primarily story/presentation:
- old wall power buses wake;
- dead Scrap Basin lights sequence on;
- dormant relay nodes reboot;
- gate mechanisms respond;
- distant Bot shells twitch or wake;
- unknown traffic begins appearing on dead systems.

Important:
this is not yet a clean external network reconnection reveal.

The characters only know:
> their activation reached farther into the basin than expected.

BOT2 detects that some systems are responding from sectors it did not power directly.

This is the first strong sign of an external or distributed influence.

---

# 20.5 ENCOUNTER 06 — BREACH WAVES

### Purpose

Change the player's interpretation from:
> random things are waking.

to:
> these things are arriving with structure.

This is the first **defense encounter**, but it remains Arsenal combat.

### Arena

Use the Stormbreaker/workshop/gate area.

The player should recognize:
- the rig;
- accumulator;
- partial gate machinery.

Do not create a tower-defense UI.

### Participants

Player side:
- NEWBOT: 1000 HP.
- BOT: 1000 HP, AI ally.

BOT2:
- non-combat story actor operating the rig.

### Wave structure

#### WAVE A
3 Scrap Bots:
- 300 HP each.
- enter from one broad sector but separated enough to avoid stacking.

Spawn law:
- normal 4.5s cadence;
- cap 5.

Purpose:
still plausible as another spontaneous wake.

#### SHORT STORY BEAT
BOT2 notes:
> they came from the same access route.

Pause new enemy activation for ~3–4 seconds.
Do not pause the whole game if floor pickups remain.

#### WAVE B
4 Scrap Bots:
- 260 HP each.
- 2 from left access;
- 2 from right access;
- activation stagger ~1–1.5s.

Spawn law:
- cadence 3.5s;
- cap 6.

This is the first subtle sign the pressure is increasing again.

#### WAVE C
3 Scrap Bots:
- 320 HP each.
- enter in a tighter coordinated stagger.

Plus:
- one authored two-weapon Drop burst shortly after they enter.

Spawn law afterward:
- cadence 3.0s;
- cap 6.

The purpose is not raw difficulty.
The purpose is to make enemy arrival and Arsenal behavior feel synchronized.

### Why no giant wave

Do not exceed 4 simultaneously newly activated hostiles in v1.

The engine and visual language were built around small numbers.

Readability is more important than spectacle.

### Team / targeting

Same laws as FIRST WAKE:
- NEWBOT/BOT one side;
- Scrap Bots hostile;
- all can compete for floor equipment;
- no duplicate team pickups;
- no friendly target intent.

### Ally failure law

BOT KO:
- does not instantly fail;
- NEWBOT may finish the current wave;
- afterward BOT2 pulls BOT back toward the rig and repairs/stabilizes it for story continuity.

NEWBOT KO:
- retry BREACH WAVES from Wave A.

### Persistence

Between waves:
- NEWBOT HP persists;
- BOT HP persists unless a story stabilization beat explicitly restores a small, authored amount;
- cooldowns persist;
- existing floor equipment persists unless it blocks safe wave setup.

Default: no free full heal between waves.

### Dialogue / mystery progression

Wave A:
BOT still treats it as more scrap waking.

Between A/B:
BOT2 notices shared directionality.

Wave B:
first incomplete command fragments may appear as corrupted telemetry:
- ACQUIRE
- RETURN
- SECURE

Do not present them as a villain voice.

They should look like machine command residue.

Wave C:
BOT2:
> “Chúng không tỉnh ngẫu nhiên nữa.”

After final hostile KO:
one distant relay answers the Stormbreaker rig.

BOT2 realizes the commands are not originating from its workshop.

This is the handoff into the later BOT2 corruption sequence.

### Win condition

All Wave C hostiles KO.

No separate “protect the machine HP bar” in v1.

The rig cannot be destroyed by enemies because that would turn the encounter into escort/tower-defense gameplay.

Enemies are narratively converging on the active Arsenal/Stormbreaker zone; their normal combat target remains NEWBOT/BOT.

### Failure

NEWBOT KO = retry from Wave A.

No rig-health fail state.

### Target duration

Approximately 3–5 minutes.

---

# 20.6 MID-QUEST PACING CHECK

The player should experience these three encounters as:

### WEAPON RAIN
**The rules are behaving strangely.**

### CHARGE THE BREAKER
**We can use this strange energy to escape.**

### BREACH WAVES
**Something noticed us using it.**

That causal sequence is required.

Do not present Stormbreaker as the confirmed cause of the Virus.

The stronger interpretation for Quest 01 is:
> Stormbreaker and the awakened group make the sealed basin increasingly visible/reachable to systems that were already corrupted outside.

The exact network mechanism remains intentionally unresolved for later story work.

---



# 21. IMPLEMENTATION-READY PASS C — FINAL ACT

This section locks the final-act gameplay from the end of BREACH WAVES through BOT's sacrifice.

Final-act hierarchy:
- BOT2 = mechanical proof / first corrupted boss.
- BOT = emotional final boss.
- Stormbreaker = final exceptional weapon and escape-energy bridge.

Stormbreaker must use the existing production combat authority:
- confirmed hit damage: 446;
- confirmed hit stun: 2.0s;
- throw speed: 1350;
- bounded homing turn rate: 2.6 rad/s;
- missed-flight lifetime: 2.2s;
- visible floor-bolt contact: 1.0s stun, zero damage;
- no invented Story-only damage multiplier.

---

## 21.1 POST-BREACH REVEAL — SOMETHING ANSWERS

After Wave C ends:
- no victory/result screen;
- ordinary enemy pressure stops;
- one distant relay answers the active Stormbreaker/gate system;
- BOT2 detects machine-command traffic that is not originating from its own rig.

The group still does not know the true source.

The first readable fragments may include:
- ACQUIRE
- RETURN
- SECURE
- IDENTIFY

NEWBOT, BOT and BOT2 are all scanned.

BOT2 and BOT receive valid-device responses.

NEWBOT returns:
**NO VALID NETWORK ID**

This is not yet a lore lecture.
The characters only know that the unknown system recognizes two of them and fails to recognize NEWBOT.

---

# 21.2 BOT2 OVERRIDE BUILDUP

BOT2 is physically closest to and most tightly linked with the reactivated infrastructure.

Corruption progresses visibly over a short in-engine sequence:

1. BOT2 stops responding for a beat.
2. one arm reconnects a cable BOT2 had just removed;
3. BOT2 consciously pulls it back out;
4. system command repeats;
5. BOT2 involuntarily reconnects it again;
6. acquisition/combat posture activates.

BOT2 understands first that this is not ordinary hardware failure.

BOT2:
> “Lùi lại.”

No boss title yet.

BOT2 tries to shut itself down and fails.

Then combat state takes over.

---

# 21.3 ENCOUNTER 07 — BOT2 OVERRIDDEN

### Format

NEWBOT vs BOT2.

BOT remains outside the direct combat lane and attempts to help BOT2 verbally / through the workshop system.

Do not make BOT a second simultaneous allied fighter here.

Reason:
- keeps the boss readable;
- makes NEWBOT personally confront the phenomenon;
- preserves BOT for the emotional finale.

### Starting state

Before BOT2 fully loses control, the workshop performs one visible emergency repair cycle on NEWBOT and BOT.

For gameplay:
- NEWBOT starts BOT2 OVERRIDDEN at 1000 HP.
- BOT2 starts at 1000 HP.

This is an authored repair scene, not a hidden HP reset.

### BOT2 combat identity

BOT2 uses Arsenal Battle rules.

It receives:
- no damage multiplier;
- no damage resistance;
- no bonus max HP;
- no invented hero skill.

Its boss identity comes from decision pressure and story state.

BOT2 should strongly prioritize:
1. revealed offensive weapon acquisition;
2. maintaining attack pressure after pickup;
3. reacquiring after weapon loss.

Do not make BOT2 faster than canonical fighter speed unless a later owner-approved Bot archetype requires it.

### Spawn law

- cadence: 4.5s;
- cap: 5;
- emergency firearm: canonical;
- ordinary Arsenal pool;
- Stormbreaker excluded.

Heal support remains canonical.

If BOT2 heals, one-shot story threshold flags must not replay when its HP rises.

### Corruption thresholds

These thresholds change presentation/decision intent, not damage numbers.

#### 1000 → 750 HP
BOT2 still speaks in full sentences.

Commands occasionally interrupt.

#### 750 → 450 HP
BOT2 speech fragments become shorter.

Machine-command text becomes more frequent.

Acquisition priority increases, but movement and equipment remain legal Arsenal behavior.

#### 450 → 180 HP
BOT2 rarely gains control long enough to speak.

At 180 HP:
- story floor activates;
- no further lethal damage is accepted;
- new attack scheduling stops;
- active projectiles resolve safely;
- encounter transitions to story.

### Story floor

BOT2 floor: **180 HP** for v1.

This value is tuning-only.

Do not show an artificial shield or heal.

### Failure

NEWBOT KO = retry BOT2 OVERRIDDEN from its start.

### Target duration

Approximately 2–4 minutes.

---

# 21.4 BOT2 REGAINS PARTIAL CONTROL

At the floor, BOT2 collapses but does not die.

The override becomes unstable enough for BOT2 to speak.

BOT2 compares network responses:

- BOT2: registered.
- BOT: registered.
- NEWBOT: unregistered.

BOT2's conclusion is local and mechanical:

> whatever is issuing the commands cannot address NEWBOT through the normal Bot-network identity path.

Do not explain the alien origin.

Do not state that NEWBOT is universally immune to every possible future control method.

Quest 01 only establishes:
> this Bot-network corruption cannot take NEWBOT in the same way.

BOT begins showing stronger command interference during this conversation.

---

# 21.5 BOT'S INFECTION — QUIET DESCENT

Do not transform BOT immediately.

The player must watch its control degrade.

A short quiet sequence follows.

Symptoms:
- hand twitch toward a floor weapon and then stop;
- head orientation snaps toward the same relay that affected BOT2;
- command text appears and is suppressed;
- BOT loses a word mid-sentence;
- acquisition stance starts, then BOT consciously relaxes it.

BOT knows what is coming because it just watched BOT2.

NEWBOT tries to find another solution.

BOT2, damaged but conscious, identifies the final escape problem:

- the gate has partially awakened;
- Stormbreaker has enough energy to open it;
- the old gate relay will not latch;
- the final discharge must be conducted from inside the Scrap Basin while the escapee crosses.

This creates a real cost:
> someone must remain on the inside of the gate circuit.

BOT2 cannot do it reliably because its body/control system is too damaged.

BOT is still physically capable but increasingly corrupted.

NEWBOT is the only one who can plausibly function outside without immediate network takeover.

No character calls this destiny.
It is a bad engineering situation with one survivable choice.

---

# 21.6 LAST REPAIR / LAST QUIET BEAT

Before attempting the gate:

BOT2 uses the last stable workshop repair cycle on NEWBOT and BOT.

This serves two purposes:
- story: BOT2 prepares them for the escape attempt;
- gameplay: final boss begins from a fair, deterministic state.

Final-boss starting state:
- NEWBOT = 1000 HP.
- BOT = 1000 HP.

BOT2 remains damaged at its story-floor condition and cannot join combat.

This quiet beat contains the friendship acknowledgement.

Direction:
NEWBOT refuses to leave BOT.
BOT warns that staying will eventually make NEWBOT fight it anyway.

The line:
> “Chúng ta là bạn à?”
> “Tôi nghĩ vậy.”

belongs here or immediately before the final takeover.

---

# 21.7 FINAL TAKEOVER

Stormbreaker containment begins opening for the escape attempt.

The exceptional weapon becomes visible.

BOT's acquisition system reacts immediately.

The unknown command stream also intensifies.

BOT tells NEWBOT to move away.

BOT:
> “Nếu tôi quay sang cậu... đừng chờ.”

NEWBOT refuses.

BOT loses control.

Final encounter starts.

---

# 21.8 ENCOUNTER 08 — BOT: LAST CHOICE

### Format

NEWBOT vs BOT.

This is the hardest encounter in Quest 01.

It must remain understandable as Arsenal Battle.

No new tutorial mechanic appears.

### Starting state

- NEWBOT: 1000 HP.
- BOT: 1000 HP.
- ordinary weapon spawn director active.
- Stormbreaker still contained.

### PHASE 1 — FIGHT THE FRIEND, NOT THE WEAPON

BOT HP:
1000 → 700.

Spawn law:
- cadence: 4.5s;
- cap: 5;
- ordinary Arsenal pool;
- Stormbreaker excluded.

Heal support:
canonical <=800 HP law.

BOT behavior:
- normal legal equipment use;
- higher acquisition commitment than ordinary Scrap Bots;
- no hidden damage/defense buff.

Dialogue:
BOT intermittently regains enough control to warn NEWBOT.

The emotional rule:
BOT never taunts NEWBOT while corrupted.
Machine commands are cold; BOT's own voice is scared, frustrated or protective.

### Transition at 700 HP

At the first downward crossing of 700 HP:

1. hold new ordinary offensive spawns;
2. safely resolve immediate attack transactions;
3. unlock Stormbreaker containment;
4. create one authored Stormbreaker floor spawn.

Stormbreaker position must heavily favor BOT without teleporting it into BOT's hand.

Story reservation:
- BOT is the intended holder;
- NEWBOT cannot steal this specific authored Stormbreaker;
- presentation must make this obvious through placement/timing rather than an invisible arbitrary rejection where possible.

Existing Stormbreaker floor lightning remains authoritative:
- visible floor-bolt contact may stun either fighter for 1.0s;
- floor bolt does zero damage.

### Fairness repair condition

Because the coming Stormbreaker confirmed hit deals 446 damage:

If NEWBOT is below 650 HP when the Stormbreaker transition begins, authorize one visible emergency repair opportunity using an existing high-tier heal item near NEWBOT.

Recommended v1:
- HEAL_H5 = 385.

This is a Story Director fairness injection, not a hidden HP grant.

It can trigger only once.

If NEWBOT is already >=650 HP, do not spawn the extra heal.

### PHASE 2 — STORMBREAKER TEST

BOT acquires Stormbreaker.

Use the production weapon exactly:
- 0.28s windup;
- 0.45s ready delay;
- 1350 throw speed;
- bounded homing;
- 446 confirmed damage;
- 2.0s confirmed-hit stun;
- miss exits through canonical max-flight behavior.

The player must survive one real canonical Stormbreaker release.

No fake cinematic dodge.

Possible outcomes:
- player evades;
- player is hit and survives;
- player is hit and KOs.

NEWBOT KO = retry from a checkpoint immediately before the Stormbreaker transition, not from the entire BOT fight.

The phase checkpoint restores the deterministic transition state:
- BOT at 700 HP;
- NEWBOT at the HP value after any authored fairness repair;
- no stale projectiles/pickups;
- Stormbreaker contained and ready to release again.

### Single-artifact continuity

Quest 01 treats this as one Stormbreaker artifact.

After the canonical Stormbreaker release resolves through hit or miss:
- combat does not spawn another Stormbreaker;
- Story Director returns the single artifact to the nearby gate containment cradle only after its combat release lifecycle has completed;
- this return is story/presentation continuity, not a second attack or duplicate pickup.

The normal production attack itself remains unchanged.

### PHASE 3 — LAST ORDINARY FIGHT

After Stormbreaker has completed its one canonical combat release:

- ordinary Arsenal spawning resumes at 4.5s / cap 5;
- Stormbreaker remains excluded;
- BOT continues using ordinary equipment.

BOT HP:
700 → 120.

NEWBOT must finish the combat pressure normally.

BOT increasingly fails to speak.

Command text increasingly dominates.

Suggested late exchange:

NEWBOT:
> “Tôi không đánh nữa!”

BOT:
> “Cậu phải đánh.”

Later:
> “Nếu cậu dừng...”
> “...tôi sẽ không.”

### Final story floor

BOT floor: **120 HP** for v1.

At first downward crossing:
- clamp lethal overflow;
- stop new offensive spawns;
- resolve/despawn dangerous active transactions safely;
- lock NEWBOT skill input after combat has cleanly ended;
- transition directly to the final choice.

BOT is not shown as KO/dead yet.

---

# 21.9 BOT'S LAST CHOICE

With the combat override destabilized by damage, BOT regains a short window of agency.

The gate cradle now holds Stormbreaker again.

BOT understands the final engineering problem:
- Stormbreaker can supply the gate;
- the inside conductor must remain connected through the opening cycle;
- the conductor will take the destructive electrical load;
- an infected BOT that exits would also immediately expose itself to the wider corrupted network.

NEWBOT offers to stay instead.

BOT refuses.

This choice must not be framed as:
> BOT is worth less because it is infected.

It is:
- BOT can no longer trust its future actions;
- NEWBOT can survive outside;
- BOT consciously chooses what its remaining control will accomplish.

BOT:
> “Từ lúc tỉnh dậy đến giờ... tôi chưa từng chọn được mình có nhặt súng hay không.”

Stormbreaker/gate system activates.

> “Nhưng tôi có thể chọn mình làm gì với nó.”

BOT connects itself as the final conductor.

No QTE.

The player does not press a sacrifice button.

---

# 21.10 FINAL CALLBACK

The unknown command system makes one last attempt to redirect BOT toward NEWBOT.

Command:
**ELIMINATE TARGET**

BOT's body visibly tries to obey.

BOT holds the conductor instead.

NEWBOT hesitates at the gate.

BOT:
> “Đi.”

NEWBOT still does not move.

BOT:
> “Cậu muốn biết mình là ai mà.”

Then the final callback:

> “Lần này...”
> “...tôi dừng được rồi.”

Stormbreaker discharge peaks.

Gate opens enough for NEWBOT.

BOT shuts down permanently.

Do not explode BOT.

Do not disintegrate it.

The emotional image is stillness.

---

# 21.11 BOT2 END STATE

BOT2 remains inside the Scrap Basin.

Its exact fate is intentionally unresolved.

At the ending:
- BOT is clearly dead/shut down permanently;
- BOT2 is damaged/corrupted and cannot follow;
- do not show BOT2 dying;
- do not show BOT2 fully recovering.

Future story may return to BOT2.

---

# 21.12 OUTSIDE TRANSITION

NEWBOT crosses the wall.

The gate loses power after BOT shuts down.

For the first time the camera reveals wider EAX-1.

Required contrast:
- Scrap Basin behind = enclosed, dead, industrial.
- outside = larger, active, inhabited or visibly connected to civilization.

The world must not read as a completely empty apocalypse.

A distant Bot receives a command / turns toward a Drop.

NEWBOT recognizes the behavior.

No exposition explains the entire Botfall.

Quest completion follows.

---

# 21.13 FINAL-ACT RETRY LAW

BOT2 OVERRIDDEN:
- retry from BOT2 boss start.

BOT LAST CHOICE Phase 1:
- retry from final boss start.

Stormbreaker Phase:
- if NEWBOT is KO by/after the authored Stormbreaker release, retry from the Stormbreaker transition checkpoint.

After BOT reaches 120 HP:
- no gameplay failure;
- story ending is deterministic.

All retries must clear:
- projectiles;
- floor pickups not part of checkpoint state;
- dialogue queue;
- command overlays;
- story reservations;
- Stormbreaker VFX ownership/state;
- stale stun/status state.

---

# 21.14 FINAL-ACT SUCCESS CONDITION

The final act succeeds only if the player understands three things without a lore dump:

1. BOT2 and BOT can be addressed by the corrupted Bot network.
2. NEWBOT cannot be addressed through the same registered identity path.
3. BOT's sacrifice is a conscious act that directly contradicts the command controlling it.

The emotional structure is:

Beginning:
> BOT cannot stop.

Middle:
> BOT learns that something else can stop it.

Ending:
> BOT stops itself.

That is the final meaning of Quest 01.

---

**END — QUEST 01 GAMEPLAY v1**
