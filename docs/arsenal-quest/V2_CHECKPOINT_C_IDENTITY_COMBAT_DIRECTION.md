# ARSENAL QUEST V2 — CHECKPOINT C: IDENTITY & COMBAT FEEL DIRECTION

Status: AUTHORITATIVE DESIGN DIRECTION  
Implementation branch: `arena/01a0cf5e-apex-chaos`  
Owner playtest baseline: Checkpoint B @ `16b62f15b7c44f0005326f6a67d3f1a6ddefe0f2`  
Playtest deploy branch: `playtest/arsenal` — keep frozen until a reviewed C build is ready.

This document supersedes the old assumption that the next step is “UI polish”.
Checkpoint C is a **combat identity pass**. The owner’s Checkpoint B playtest shows
that the current prototype is mechanically functional but still reads as a collage
of unrelated assets and generic motion.

Checkpoint D will handle the full HUD / menu / UX overhaul after combat itself
looks, sounds, and feels coherent.

---

# 0. OWNER PLAYTEST FINDINGS — ROOT CAUSES

Observed:
1. visual asset library feels ugly / visually irritating;
2. melee SFX selection is weak;
3. weapon motions are technically present but not iconic or exciting;
4. post-use fade-out looks cheap;
5. grenade pickup sprite and thrown grenade do not match;
6. native fighter skills overshadow weapon fantasy through damage;
7. current battlefield is not designed for Arsenal;
8. bullets look strange, travel too slowly, and balance still feels loose.

These are NOT eight unrelated polish bugs.

They collapse into four root problems:

### Root A — no unified art language
Current runtime combines fighter art, weapon packs, CC0 VFX packs, generic audio,
and the base Apex arena. Individual assets may be valid, but they do not share
one silhouette, outline, palette, perspective, lighting, or material language.

### Root B — motion is functional, not iconic
Checkpoint B proved the pose architecture works, but much of the motion is small
translation / rotation / spring recovery. It communicates state to tests, not
personality to a viewer.

### Root C — fighter lethality competes with the mode fantasy
Restoring native kits made fighter identity meaningful, but their raw damage can
make the Arsenal pickup secondary. The mode must preserve fighter identity while
keeping weapons as the main source of lethal payoff.

### Root D — impact grammar is weak
Slow oval bullets, generic melee impacts, inconsistent grenade visuals, and the
base arena all weaken the same loop:

`pickup -> anticipation -> weapon action -> impact -> physical resolution`

---

# 1. PRODUCT NORTH STAR

## Core fantasy

**The fighter creates the opportunity. The weapon delivers the payoff.**

The 32 fighters remain recognizable and mechanically expressive, but Arsenal
weapons must own the strongest visual and lethal moments.

A viewer should understand this from a muted 3–5 second clip.

## Five-second readability test

With HUD hidden:
- identify who owns a weapon;
- identify the weapon family from silhouette/motion;
- understand when the action commits;
- read the impact;
- understand that the weapon is consumed / discarded;
- never confuse native fighter VFX with the Arsenal weapon payoff.

## Viewer-trigger principle

Every Arsenal weapon needs one **signature beat** that is readable at normal
speed and survives compression in short-form video.

Do not solve “more exciting” by filling the screen with particles.
Use silhouette change, anticipation, timing contrast, hit-stop, camera response,
sound transient, and a physical exit.

---

# 2. ART BIBLE — LOCK BEFORE ASSET REPLACEMENT

Current weapon atlas remains a temporary functional fallback. Do NOT acquire or
integrate more unrelated packs before this language is locked.

## 2.1 Overall look

Direction:
**industrial arcade weapons lab / tactical test chamber**

Not:
- neon cyberpunk soup;
- fantasy RPG inventory art;
- realistic military simulator;
- noisy particle spam.

Visual priorities:
1. fighter silhouette;
2. equipped Arsenal weapon;
3. revealed pickup;
4. projectile / attack lane;
5. impact;
6. background.

## 2.2 Weapon rendering language

All replacement weapon assets must share:
- consistent 3/4-ish side readability suitable for rotation toward the target;
- high-contrast silhouette at 90–190px on a 1000px arena;
- one consistent outline treatment;
- one consistent material rendering family;
- one consistent shadow / highlight direction;
- transparent background;
- no baked glow;
- no text labels on the weapon;
- no perspective that makes rotation look obviously wrong.

Recommended style:
- stylized hard-surface / arcade;
- dark body values;
- warm metal / ivory edge highlights;
- restrained per-family accent;
- slightly oversized functional shapes so weapon class reads immediately.

Family accent is allowed but must not recolor the whole weapon:
- gun: warm muzzle / brass accent;
- blade: cool steel edge;
- blunt: dark iron / heavy warm impact accent;
- defense: pale blue / steel guard accent;
- explosive: olive / amber warning accent.

## 2.3 Scale hierarchy

Weapon sprite scale must express mass:
- Dagger: smallest
- Pistol
- SMG / Sabre
- Shotgun / Club / Axe
- Spear / Sniper: longest
- Tower Shield: largest visual mass

No weapon should look like a floating UI icon attached to the fighter.

## 2.4 Pickup continuity

The same canonical weapon identity must be preserved through:
`hidden slot -> reveal -> floor pickup -> equipped -> action -> exit/projectile`

No stage may silently swap to a generic shape.

Critical grenade rule:
**GRENADE uses the same canonical grenade art for floor pickup, equipped/throw
pose, and in-flight projectile.**
In-flight grenade may rotate, scale slightly, blink, or receive a fuse accent,
but may not become the current generic green circle.

---

# 3. MOTION BIBLE V2 — NO MORE GENERIC FADE GHOSTS

Checkpoint B's `drawPoseGhost` fade is not the final behavior.

## 3.1 Universal action grammar

Every weapon action uses:
1. **anticipation**
2. **commit**
3. **impact**
4. **recovery / exit**

Timing contrast matters more than animation quantity.

Typical:
- anticipation: 80–350ms
- commit: 40–140ms
- impact hold / hit-stop: 20–80ms
- recovery/exit: 100–350ms

The exact values are weapon-specific.

## 3.2 Exit rule

Normal weapon consumption must NOT be represented primarily by alpha fading.

Allowed exits:
- eject;
- toss;
- ricochet away;
- snap-back then drop;
- spin-off;
- collapse / break;
- physically retract for shield.

Alpha may be used only in the final last ~10–15% of an already physical exit to
clean up the sprite, never as the main read.

## 3.3 Signature motion targets

### PISTOL — “triple punctuation”
Anticipation: tiny lock/snap to target.
Commit: 3 recoil kicks with visually distinct spacing.
Impact: crisp muzzle transient + short tracer.
Exit: slide/tilt, then quick lateral flick away.
Viewer cue: three clean beats, not one mushy recoil spring.

### SHOTGUN — “body punch”
Anticipation: short draw-in / brace.
Commit: single explosive backward kick, strongest gun recoil.
Impact: wide instantaneous pellet lane + heavy target reaction.
Exit: pump/rack beat, barrel drops, weapon thrown down/out.
Viewer cue: one enormous beat.

### SMG — “climb”
Anticipation: compact snap-on.
Commit: 8 fast pulses with progressive muzzle climb/jitter.
Impact: dense short tracer rhythm.
Exit: brief dry-click / settle, weapon flicks away.
Viewer cue: rising burst texture.

### SNIPER — “ceremony then violence”
Anticipation: long target lock with restrained line.
Preparation: chamber action / controlled flourish, not a comedy spin.
Commit: hard snap to exact target and near-instant shot.
Impact: strongest single tracer + strongest hit-stop among guns.
Exit: severe recoil, long rifle rotates away / drops.
Viewer cue: silence/tension -> one violent punctuation.

### GRENADE — “wind-up throw”
Anticipation: weapon pulls back behind holder.
Commit: forward throw arc; grenade leaves at a visible release moment.
In-flight: same canonical grenade sprite, spinning.
Impact: existing explosion can stay temporarily if readable.
Exit: not applicable after projectile release.
Viewer cue: readable object continuity from pickup to explosion.

### SABRE — “draw-cut”
Anticipation: blade retracts / cocks opposite target.
Commit: very fast single cut across a short arc using the weapon body.
Impact: tiny freeze + blade contact sound; no imported slash sheet.
Exit: overtravel then flick/drop.
Viewer cue: elegant and fast.

### BATTLE AXE — “hang then crush”
Anticipation: exaggerated raised head, longest melee wind-up.
Commit: accelerating chop.
Impact: strongest melee hit-stop + camera kick.
Exit: brief stuck/drag moment, then yank/free and tumble away.
Viewer cue: mass.

### DAGGER — “needle”
Anticipation: very short retract.
Commit: 60–90px linear stab, extremely fast.
Impact: tiny sharp freeze.
Exit: fast yank-back + small spin/flick.
Viewer cue: shortest, fastest melee beat.

### SPEAR — “line”
Anticipation: retract along own axis.
Commit: 100–140px straight extension.
Impact: narrow strong contact; target push emphasizes reach.
Exit: controlled pullback then spear spins outward.
Viewer cue: long horizontal line.

### SPIKED CLUB — “swing-through”
Anticipation: deep backswing.
Commit: heavy forward rotation.
Impact: blunt target compression / push, low-frequency transient.
Exit: bounce/rebound off impact and fall away.
Viewer cue: ugly weight, not blade elegance.

### SWIRL SHIELD — “catch and reject”
Idle: slight target-facing settle only.
Commit: on reflect, shield punches forward at contact.
Impact: projectile visibly reverses + metallic snap.
Exit: after successful use, spin/deflect outward, not fade.
Viewer cue: catch -> return.

### TOWER SHIELD — “plant”
Anticipation: shield moves forward and slightly enlarges silhouette.
Guard: visually planted between holder and enemy.
Impact: each block tilts/pushes shield back.
Exit: guard loses tension, shield falls/withdraws sideways.
Viewer cue: immovable mass.

---

# 4. SFX BIBLE — EVENT LAYERS, NOT GENERIC ONE-SHOTS

Current AV palette is useful as placeholder but not final. The current melee map
uses generic `knifeSlice/chop/impactGeneric/impactPunch`, which explains why
different melee weapons collapse into similar audio.

## 4.1 Sound event grammar

A weapon sound may contain up to three layers:
1. **motion** — whoosh, draw, mechanism
2. **transient** — shot / strike onset
3. **contact/body** — impact material / low-end weight

Do not play all three for every event. Layer only when it strengthens the read.

## 4.2 Melee separation

- Dagger: thin fast air + sharp contact; almost no low end.
- Sabre: clean metallic blade air + bright contact.
- Spear: directional thrust air + hard puncture/contact transient.
- Axe: slower heavy air + wood/metal chop + low body.
- Club: dull heavy whoosh + blunt thump; minimal metallic brightness.

The impact sound should trigger on actual contact, not merely on attack start.

## 4.3 Gun separation

- Pistol: short dry crack.
- SMG: compact repeated crack; low tail so 8 shots do not turn to mud.
- Shotgun: broad low transient + short mechanical rack after.
- Sniper: initial sharp crack + restrained low tail; chamber event is separate.

## 4.4 Audio acceptance

Muted visuals test:
- a listener should distinguish blade vs blunt;
- Pistol/SMG/Shotgun/Sniper should not sound like pitch/volume variants of one file;
- no attack should double-trigger native fighter “skill” audio and Arsenal audio
  in a way that makes the weapon source ambiguous.

Before acquiring new audio, inventory existing sources and flag:
`KEEP / REPROCESS / REPLACE`.
Do not download random files one-by-one.

---

# 5. PROJECTILE / HIT LANGUAGE

Current Arsenal bullets are drawn as outlined ellipses and travel at:
- Pistol 780 px/s
- Shotgun ~640 px/s
- SMG 820 px/s
- Sniper 1450 px/s

On a 1000px arena this visibly reads as slow floating objects.

## 5.1 Guns should read as shots, not moving balls

New target feel:
- Pistol: fast tracer event
- SMG: shorter/finer rapid tracer event
- Shotgun: near-instant short pellet lanes / streak fan
- Sniper: near-hitscan long tracer

Do not make bullet art a large glowing orb.

## 5.2 Initial speed targets

First tuning target:
- Pistol: ~2400–2800 px/s
- SMG: ~2800–3400 px/s
- Shotgun pellets: ~2200–2800 px/s with very short lifetime
- Sniper: ~5000–6500 px/s OR explicit hitscan/swept ray implementation

Exact balance may change after playtest.

Because these speeds can cross large distances per frame, update collision from
point-sample overlap to **swept segment / continuous hit testing** for Arsenal
gun projectiles. Do not “fix” tunneling by making bullets larger.

## 5.3 Tracer rendering

Render from previous projectile position to current position:
- thin core;
- short bright head;
- optional very short afterimage;
- no thick outline ellipse.

Tracer length should be capped so it reads like speed, not a laser beam, except
Sniper which may use a distinct long transient line.

## 5.4 Impact hierarchy

Pistol: tiny impact snap  
SMG: tiny repeated impacts, aggressively voice/particle limited  
Shotgun: broad clustered impact + body push  
Sniper: sharp focused impact + hit-stop  
Melee: weapon-specific contact  
Grenade: radial explosion

No generic square-particle burst should be the primary read for every weapon.

---

# 6. FIGHTER VS WEAPON POWER HIERARCHY

Checkpoint B restored compatible native kits but currently allows native damage
to compete too strongly with Arsenal weapons.

New rule:
**fighter identity is preserved; fighter lethality is normalized.**

## 6.1 Combat budget target

First balance target over representative 60–120s matches:
- Arsenal weapons: **70–80% of meaningful direct damage**
- native fighter kit: **20–30%**
- native kit's main value should often be setup, mobility, defense, control,
  sustain, or weapon opportunity creation.

This is a target distribution, not a hard per-hit clamp.

## 6.2 Preserve identity by converting role, not deleting it

Preferred:
- freeze / slow -> setup for weapon
- push / pull -> positioning around pickups / weapon ranges
- mobility -> contest or evade
- shield / sustain -> survive until weapon opportunity
- clone/summon -> pressure / distraction
- hazard -> space control

Direct native nukes should be scaled down in Arsenal-specific compatibility
profiles before removing them.

## 6.3 New compatibility matrix fields

Extend the roster matrix with:
- signature identity
- native direct-damage sources
- Arsenal damage multiplier / cap
- utility kept
- weapon synergy
- visual-conflict notes

Do not apply one global multiplier blindly if a kit depends on a specific hit
for its identity. Prefer per-mechanic adaptation where needed.

## 6.4 Acceptance

Across a representative automated matchup suite:
- weapons are the primary damage source in aggregate;
- no fighter regularly kills opponents mainly through native damage before
  weapons matter;
- all 32 still retain recognizable identity;
- native abilities do not steal or replace holder state;
- rage remains disabled for this checkpoint unless separately approved.

---

# 7. ARSENAL-SPECIFIC BATTLEFIELD

The base Apex battlefield is no longer sufficient.

Checkpoint C gets its own arena presentation layer.

## 7.1 Concept

Working name:
**ARSENAL FIELD TEST // CHAMBER 01**

It should feel like a purpose-built weapons evaluation room.

## 7.2 Arena visual structure

Background:
- dark graphite / charcoal;
- subtle material variation;
- low contrast.

Floor:
- very restrained range/grid markings;
- central alignment marks;
- sparse measurement ticks / zone numbers;
- no dense texture under fighters.

Walls:
- slightly brighter boundary read;
- industrial panel / guard-rail language;
- enough contrast to understand bounce geometry instantly.

Pickup areas:
- neutral floor projection;
- revealed pickup can own local contrast;
- no background motif should resemble a weapon telegraph.

Ambient:
- subtle machinery / side light / vents can exist outside primary fight space;
- animation must be slow and low-contrast.

## 7.3 Arena gameplay readability rules

- no decorative bright lines through common projectile lanes;
- no same-hue glow behind weapon sprites;
- no center object blocking movement;
- no fake pickups;
- no excessive screen-edge bloom;
- camera shake may move the combat layer, but HUD later remains stable.

## 7.4 Implementation rule

Do NOT redesign the entire global Apex background.
Create an Arsenal-only background/arena renderer that replaces or deliberately
overlays the base background only when `gameState === 'ARSENAL'`.

---

# 8. ASSET REPLACEMENT STRATEGY

Do not replace everything in one uncontrolled batch.

## Phase C1 — style proof
Produce a coherent mini-set first:
- Pistol
- Battle Axe
- Grenade
- Tower Shield
- one gun tracer
- one melee impact
- one arena concept/background

These four weapons deliberately cover gun / heavy melee / explosive / defense.

Owner must approve this style proof before generating/integrating the remaining
8 weapons.

## Phase C2 — complete weapon family
After style approval:
- replace all 12 canonical weapon visuals;
- ensure grenade continuity;
- replace / reprocess SFX;
- build tracer/impact language.

## Phase C3 — combat integration
Then:
- projectile speed/collision;
- damage hierarchy;
- arena implementation;
- motion V2 physical exits.

This avoids spending hours integrating a full asset family the owner dislikes.

---

# 9. WHAT NOT TO DO

- Do not start the full HUD/UI overhaul yet.
- Do not add progression, shop, rarity, inventory, quests, bosses.
- Do not add more random CC0 packs simply because they are free.
- Do not re-enable slash-sheet VFX.
- Do not solve impact by increasing particle count.
- Do not keep `drawPoseGhost` alpha fade as the normal consume behavior.
- Do not preserve current bullet speeds for visual continuity.
- Do not make native fighters inert again.
- Do not restore full native lethality unchanged.
- Do not modify `main`.
- Do not move `playtest/arsenal` until reviewer approval.

---

# 10. CHECKPOINT C EXECUTION PLAN

Checkpoint C must be split into owner-visible gates.

## C0 — Direction lock (this document)
No gameplay implementation.

## C1 — STYLE PROOF
Deliver only:
- audited asset disposition: KEEP / REPROCESS / REPLACE;
- Pistol/Axe/Grenade/Tower Shield coherent visual proof;
- projectile visual proof;
- melee impact/audio proof;
- Chamber 01 arena proof;
- no full integration yet.

STOP for owner visual approval.

## C2 — COMBAT FEEL IMPLEMENTATION
After C1 approval:
- 12 coherent weapon visuals;
- grenade identity continuity;
- motion V2 physical exits;
- SFX V2;
- projectile speed + swept collision;
- impact hierarchy;
- Arsenal-specific arena renderer.

STOP for owner playtest.

## C3 — POWER HIERARCHY / BALANCE
After C2 playtest:
- roster damage normalization;
- weapon damage/timing tuning;
- automated damage-share telemetry;
- representative matchup suite.

STOP for owner playtest.

Only after C3 is accepted should Checkpoint D begin:
**full Arsenal UI/UX overhaul.**

---

# 11. C1 REQUIRED AUDIT DELIVERABLES

Before editing gameplay code, produce:

`docs/arsenal-quest/C1_ASSET_AUDIT.md`
- every current weapon visual: KEEP / REPROCESS / REPLACE
- current projectile visuals
- current explosion
- muzzle flash
- current SFX events
- arena/background
- reason for each decision

`docs/arsenal-quest/C1_STYLE_PROOF_PLAN.md`
- exact visual spec for Pistol/Axe/Grenade/Tower Shield
- exact arena composition plan
- exact projectile/tracer prototype
- exact audio events to audition
- expected file formats/dimensions
- licensing/provenance requirement for any external asset

No coding agent should perform a large integration until the owner has approved
the C1 style proof visually.
