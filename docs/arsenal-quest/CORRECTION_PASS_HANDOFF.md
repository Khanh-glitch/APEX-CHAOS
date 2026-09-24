# ARSENAL QUEST — PRESENTATION / REVEAL CORRECTION PASS

Status: **AUTHORITATIVE OVERRIDE** for the items in this document.  
Target branch: `prototype/arsenal-quest`

This document supersedes any older wording that says a pickup reveals a fixed 1.2–1.8 seconds **after spawn**.

The owner has identified three blocking defects in the current build:

1. Revealed / equipped weapons still render as text + generic shapes instead of the committed weapon art.
2. Slash-family VFX are appearing at incorrect positions / incorrect moments.
3. Weapon reveal semantics are wrong: a slot must NOT reveal merely because an age timer elapsed. It should remain identity-hidden until a fighter is predicted to reach it roughly 1–2 seconds later.

Do not add new systems while fixing these.

---

## 1. Weapon art is already committed and is mandatory

Runtime weapon atlas:

`public/assets/arsenal/weapons/arsenal_p0_weapon_atlas.png`

Atlas metadata:

`public/assets/arsenal/weapons/arsenal_p0_weapon_atlas.json`

Provenance:

`public/assets/arsenal/weapons/PROVENANCE.md`

The atlas contains all 12 P0 weapons:

- PISTOL
- SHOTGUN
- SMG
- SNIPER
- GRENADE
- SABRE
- BATTLE_AXE
- DAGGER
- SPEAR
- SPIKED_CLUB
- SWIRL_SHIELD
- TOWER_SHIELD

### Hard rendering rule

In normal non-debug gameplay, the following placeholder presentation is no longer acceptable:

- colored circles carrying three-letter tags
- weapon name text standing in for the weapon
- generic colored geometric shape standing in for the weapon

The real atlas art MUST be used for:

1. revealed floor pickup
2. equipped / carried weapon on HERO
3. equipped / carried weapon on RIVAL
4. shield carried / active presentation

Text labels may remain in:
- F3 debug overlay
- concise HUD state if desired

but may not be the primary world-space weapon representation.

### Atlas rendering

Load the atlas once and use the JSON source rectangles.

Use transparent drawing.

Preserve aspect ratio and use `contentBox` to visually size narrow weapons (Spear, Dagger, Sabre, etc.) without making their 256×256 cell box look enormous.

Floor pickup:
- sprite visibly larger than a debug icon
- centered at pickup point
- subtle neutral shadow / glow permitted
- no text necessary

Equipped:
- rotate with fighter facing direction
- offset from body so the weapon is readable rather than hidden by the fighter
- guns should visually point toward firing direction
- melee should sit along/near attack direction
- shields should sit between holder and facing direction / incoming threat as appropriate

Do not bake atlas-specific constants into the core engine. Keep art mapping in Arsenal presentation/runtime data.

---

## 2. Correct reveal rule: proximity-predicted reveal

### Core rule

Spawn positions continue to appear on the existing fixed cadence.

However, the **weapon identity remains hidden until one living, currently eligible fighter is predicted to touch that slot in approximately 1–2 seconds**.

A slot may therefore remain as a TELEGRAPH for much longer than 1–2 seconds.

This is intentional.

### The old rule is wrong

Wrong:

```
slot spawns
wait 1.2–1.8 seconds
reveal no matter where fighters are
```

Correct:

```
slot spawns as neutral hidden telegraph
spawn cadence continues independently

each update:
  estimate future time-to-contact for eligible fighters

if earliest predicted contact <= slot.revealLeadSeconds:
  reveal weapon
else:
  stay hidden
```

### First-pass tuning

For each slot, choose once:

`revealLeadSeconds = random(1.2, 1.8)`

This number is a **prediction look-ahead threshold**, NOT an age timer.

### Eligibility for prediction

For P0, evaluate a fighter only when:

- fighter exists and HP > 0
- fighter is able to collect a pickup under current P0 rules
- normally this means fighter is UNARMED

If both fighters are currently armed, the slot may remain hidden.

### Prediction method

Do not implement deliberate pickup-seeking AI.

This is only a reveal predictor.

Preferred implementation:

- simulate the fighter's current Apex movement trajectory forward for up to 2.0 seconds
- use small deterministic steps (for example 1/30s)
- include arena wall bounces
- use current fighter direction / speed
- no need to create a second gameplay entity
- fighter-fighter collision may be ignored in the predictor if necessary, but document this approximation

At each predicted step, test whether fighter body + pickup touch radius would overlap the slot.

Return the earliest predicted contact time.

Alternative math is acceptable only if it produces equivalent reliable behavior.

### Once revealed

Once a slot reveals:

- roll/select weapon identity at reveal time
- show real weapon atlas sprite
- make it collectible immediately
- do NOT hide it again if prediction later changes
- normal revealed pickup lifetime rules may apply

### Required behavior examples

**Example A — nobody approaching**

A slot exists for 8 seconds while both fighters move elsewhere.

Expected:
- telegraph remains visible
- identity remains hidden
- no weapon sprite
- cannot collect

**Example B — fighter approaching**

HERO trajectory predicts contact in ~1.5s.

Expected:
- slot reveals now
- weapon becomes visible
- HERO reaches it roughly 1–2s later if trajectory remains valid

**Example C — multiple slots**

New telegraphs continue spawning every cadence tick even while older slots remain hidden.

This may produce several hidden telegraphs plus revealed weapons simultaneously.

That is desired.

---

## 3. Telegraph / reveal visuals must NOT use slash art

The current AV pass used slash-family art as generic telegraph / reveal decoration.

Stop doing this.

The slash families have semantic meaning and should not appear as ambient pickup effects.

### Telegraph

Allowed:
- neutral ring
- neutral pulse
- question mark
- soft glow / beacon
- force-field hum

Not allowed:
- sword slash swipe
- attack trail
- weapon-specific color or silhouette

### Reveal

Allowed:
- short neutral flash
- scale pop of the actual weapon sprite
- soft shockwave / spark
- reveal click

Not allowed:
- melee slash animation unrelated to an attack

---

## 4. Slash VFX must be bound to attack geometry

A melee VFX cannot be emitted merely because a generic `melee_swing` event exists at fighter center.

The VFX must reflect the actual attack being performed.

### Common rules

- spawn only when the attack enters its real strike / dash / thrust moment
- use current attack direction
- position VFX at attack origin / path, not arbitrary fighter center
- `melee_hit` impact effect occurs only at confirmed contact coordinates
- a whiff may show the swing/trail, but must not show a target impact
- do not show a slash before the weapon actually attacks
- do not leave slash effects floating after the attack is over

### Sabre

- fast arc
- arc center offset forward from fighter
- rotate with strike direction
- one coherent short sequence

### Battle Axe

- heavier / wider arc
- starts near holder and travels through the actual chop side
- slower than Sabre
- hit accent at target only if landed

### Dagger

Do NOT use a large crescent centered on the fighter.

Use:
- compact streak / dash trail
- orientation along dash direction
- contact spark only when stab actually connects

### Spear

Do NOT use a broad slash crescent.

Use:
- narrow thrust / streak
- starts near weapon/holder front
- extends along thrust axis
- contact accent at spear impact point

### Spiked Club

Do not make it read like a sword.

Prefer:
- restrained swing trail if needed
- blunt impact burst at actual hit point
- stun cue at target

---

## 5. Gun / shield anchoring

### Muzzle flash

Muzzle flash must be at the weapon barrel/front, not at fighter center.

Approximate from:
- fighter position
- current attack direction
- fighter radius
- equipped weapon display length

Pistol / SMG / Shotgun / Sniper should use different practical offsets/scales.

### Swirl Shield

Activation presentation should make the equipped shield readable.

Reflect VFX:
- spawn at projectile-shield contact point
- align / streak with reflected projectile's new direction
- do not spawn an unrelated slash elsewhere

### Tower Shield

World-space shield sprite should remain visibly carried while guard is active.

Block impact:
- at incoming hit/contact side
- not at a stale activation coordinate

---

## 6. Required code cleanup

Current known placeholder path:

`public/game/arsenal/arsenalSpawnRuntime.js`

contains `PLACEHOLDER_ART` and draws circles + 3-letter tags for revealed pickups.

For normal gameplay:
- remove or bypass that renderer
- debug-only fallback may remain behind an explicit debug flag
- use atlas sprite renderer

Current holder presentation in:

`public/game/modes/arsenalQuestRuntime.js`

uses text holder tags.

Keep text only as optional HUD/debug support; add real equipped sprites in world space.

Current AV presentation must stop emitting slash families for generic telegraph/reveal.

---

## 7. New acceptance gates

All previous gameplay/build/stability gates still apply.

Additionally:

### Weapon art

1. Every one of 12 P0 weapons renders from the committed atlas when revealed.
2. Every one of 12 P0 weapons renders visually on its holder while equipped.
3. No revealed pickup uses a colored circle + three-letter tag as primary representation.
4. No equipped weapon relies on world-space name text as primary representation.

### Reveal semantics

5. A slot can remain hidden for >5 seconds if no eligible fighter is predicted to reach it.
6. Reveal is NOT triggered by slot age.
7. In a deterministic approach scenario, reveal occurs when predicted contact time enters the configured 1.2–1.8s look-ahead threshold.
8. Telegraph remains non-collectable before reveal.
9. Spawn cadence remains independent; 3+ hidden/revealed slots may coexist.
10. Weapon identity is selected/revealed only at reveal time.

### VFX correctness

11. Telegraph contains no slash-family attack art.
12. Reveal contains no slash-family attack art.
13. Sabre slash is forward/attack-aligned.
14. Axe effect is correctly placed/aligned with chop.
15. Dagger uses dash/stab-like effect rather than broad centered slash.
16. Spear uses thrust-like effect rather than broad centered slash.
17. Club hit feedback is blunt/contact-based.
18. Melee hit accents appear only on actual hits.
19. Muzzle flashes originate at the weapon front / barrel region.
20. Reflect effect occurs at the actual projectile/shield contact and follows reversed direction.
21. Tower block effect occurs at current contact side, not stale activation point.

### QA evidence

Provide real-browser evidence showing:

- long-lived hidden telegraph while fighters are far
- same slot revealing only when predicted approach enters threshold
- real floor sprites for at least gun, melee, shield
- real equipped gun, melee, shield
- corrected Sabre / Axe / Dagger / Spear / Club effects
- muzzle positioning
- reflect contact positioning
- multiple simultaneous hidden/revealed slots

Do not use a staged screenshot that freezes timers at absurd values as the only evidence for reveal logic. Include runtime logs with predicted ETA / revealLead for the demonstrated slot.

---

## 8. Debug observability

For each TELEGRAPH slot, F3/debug state should expose:

- slot id
- age
- revealLeadSeconds
- predictedHeroETA or null
- predictedRivalETA or null
- earliestETA
- phase

On reveal log:

`[AQ] REVEAL id=7 weapon=SHOTGUN eta=1.46 lead=1.52 fighter=HERO`

This makes the rule auditable.

---

## 9. Scope

Do NOT add:

- quest campaign
- hero progression
- boss content
- more weapons
- economy
- inventory
- weapon-seeking AI
- broad UI redesign

This is a correction pass for **readability, timing semantics, and asset integration**.

The next product decision should happen only after the owner can actually feel the real weapon contest visually.
