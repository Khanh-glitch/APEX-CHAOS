# ARSENAL QUEST C1 — STYLE PROOF PLAN

Status: PRODUCTION-INTENT VISUAL GATE  
Updated: 2026-09-24

This plan converts the audited sources into one owner-visible style proof.
It is **not** a moodboard and **not** a low-quality prototype.

The proof must look like a small slice of the intended final game.

## 1. Goal

Answer one question:

> Can the new Arsenal weapon, projectile, impact and arena language coexist as one recognizable Apex Chaos identity at real gameplay scale?

If the answer is not clearly yes, do not proceed to C2.

## 2. Proof board — exact contents

One 16:9 board with nine proof zones:

1. **SMG — Senko MP5**
2. **Shotgun — Senko SPAS 12**
3. **Sniper — Senko Snipex Alligator**
4. **Battle Axe — reprocessed two-handed axe**
5. **Canonical Grenade — bespoke/reprocessed**
6. **Tower Shield — bespoke tall industrial shield**
7. **Projectile grammar — tracer + tiny head option + spent casing**
8. **Impact grammar — muzzle + smoke + contact spark + explosion**
9. **Chamber 01 — arena composition**

The board should also contain one small **gameplay-scale strip** where the proof objects are shown at approximate equipped scale, not only enlarged beauty-view scale.

## 3. Master rendering language

All proof objects use the same rendering constitution.

### Shape
- strong silhouette first;
- slightly oversized functional/mechanical forms;
- no UI-icon treatment;
- no pixel art;
- no baked background.

### Material
- graphite / dark steel primary body;
- steel edge highlights;
- controlled local material contrast;
- hardware/joints/magazine/lever details remain visible;
- one shared light direction.

### Edge
- crisp edge separation;
- outline/edge weight normalized across families;
- no fuzzy antialiased glow as the main separator.

### Accent system
- guns: restrained warm/brass mechanical accents;
- explosive: olive/graphite + amber warning accent;
- defense: pale steel / restrained cool blue;
- blade/heavy edge: cool steel with warm impact response.

Accent does not recolor the entire asset.

## 4. Gun family proof

### SMG
Source:
`Senko v9 / MP5.svg`

Presentation requirements:
- compact;
- obvious magazine / grip / barrel structure;
- perceived volume;
- supports progressive muzzle climb and small recoil pulses.

### Shotgun
Source:
`Senko v9 / SPAS 12.svg`

Presentation requirements:
- heavier than SMG;
- pump/fore-end or other mechanical region must remain visually readable;
- strongest gun mass;
- suitable for a rack/pump beat after firing.

### Sniper
Source:
`Senko v9 / Snipex Alligator.svg`

Presentation requirements:
- longest gun proof;
- scope / long barrel separation;
- calm restrained preparation pose;
- capable of severe single-shot recoil and physical rotate/drop exit.

### Family acceptance
At gameplay scale:
- same visual family;
- not same silhouette;
- not same accent distribution;
- no weapon reads as a flat toolbar icon.

## 5. Battle Axe proof

Primary source:
`two-handed axe 512`

Reprocess:
- preserve broad heavy head;
- dark industrial shaft;
- reinforce mechanical fastening;
- steel cutting edge;
- remove fantasy/RPG decoration if it weakens family coherence.

Proof pose should imply:
`raised anticipation -> crushing downward commit`.

Do not judge from a neutral inventory pose only.

## 6. Canonical Grenade proof

Do not use Kay grenade unchanged.

Construct/reprocess one grenade that is visually compatible with the gun family.

Required features:
- compact asymmetrical mechanical detail;
- readable lever / safety element;
- graphite/olive body;
- amber warning/fuse accent;
- clear rotation silhouette.

Show the exact same grenade in three states:
1. floor pickup;
2. equipped / wind-up;
3. in-flight spin.

No shape swap is allowed.

## 7. Tower Shield proof

Create a dedicated tall silhouette.

Target:
- vertical mass;
- industrial reinforced panel;
- readable top/bottom distinction;
- defense accent only;
- planted front guard plane.

Show:
- neutral held pose;
- planted guard pose;
- block reaction tilt.

Do not derive by stretching a round shield.

## 8. Projectile / casing proof

### Pistol
- short fast tracer;
- visible punctuation;
- no floating bullet ball.

### SMG
- finer, shorter repeated tracer;
- can form a rhythmic burst without becoming a laser.

### Shotgun
- short pellet streak fan;
- near-instant lane read.

### Sniper
- strongest long tracer transient;
- distinct from persistent laser beam.

### Bullet head
Optional tiny head may be shown in A/B form:
- tracer only;
- tracer + tiny head.

Choose by readability, not by “realism”.

### Spent casing
Author one tiny brass spent-casing derivative:
- open-mouth silhouette;
- different from loaded bullet;
- suitable for short ejection arc + spin + fall.

## 9. Muzzle / smoke / impact proof

Use existing staged VFX sources, normalized to the art bible.

### Muzzle
Audition:
- m_1
- m_5
- m_9

Evaluate at actual muzzle size.

### Smoke
Use a restrained Kenney smoke candidate.
Do not obscure weapon silhouette.

### Impact
Use Kenney spark/contact shapes only as support.
Primary hit should remain directional and short.

### Explosion
Use one Sinestesia #2 sequence for grenade proof.

## 10. Chamber 01 arena proof

Canvas target:
16:9 reference composition.

Environment:
- dark graphite / charcoal;
- low-contrast panel material;
- restrained grid/range markings;
- sparse measurement ticks;
- visible wall boundary;
- subtle side machinery / vents outside main combat lane;
- neutral pickup projection area.

Readability priorities:
1. fighter;
2. equipped weapon;
3. pickup;
4. projectile/action lane;
5. impact;
6. background.

Do not put decorative bright lines behind common projectile lanes.

## 11. Motion stills required on the board

The board must communicate motion, not just inventory art.

Show at least:
- MP5 recoil/climb ghost or pose sequence;
- SPAS heavy recoil + rack direction;
- sniper preparation -> violent shot direction;
- axe anticipation -> impact line;
- grenade wind-up -> release;
- Tower Shield plant -> block reaction;
- casing ejection arc.

These are annotated motion stills only, not gameplay implementation.

## 12. Audio mapping shown on proof

Use text callouts only; do not integrate code yet.

Gun fire:
- Pistol: current cz baseline;
- SMG: current sks slices;
- Shotgun: current shotty baseline + approved rack mechanism later;
- Sniper: current mosin baseline + approved chamber/bolt mechanism later.

Other:
- owner-PASSed Sonniss melee/shield/grenade layers remain authoritative;
- remove sci-fi sniper charge from final C direction.

## 13. Board quality bar

Reject the board if any of these are true:
- one proof item looks like an icon while the others look like weapons;
- Tower Shield reads as a stretched round shield;
- grenade changes identity between states;
- projectile reads as a slow ball;
- gun classes collapse into the same silhouette;
- background competes with tracer/action lanes;
- placeholder art is used for a decision-critical element;
- the board is visually attractive only at beauty-view scale but fails at gameplay scale.

## 14. Deliverables

Required C1 owner gate:
- one production-intent 16:9 proof board;
- one gameplay-scale strip;
- exact source/candidate map;
- PASS / PASS WITH SMALL REPROCESS / REJECT notes per proof zone.

No full weapon integration.
No balance work.
No HUD/UI overhaul.

## 15. After owner PASS

Freeze:
- exact source asset;
- derivative filename;
- crop;
- pivot;
- orientation;
- equipped scale;
- pickup scale;
- palette;
- outline/edge rules;
- light direction;
- motion key timings;
- projectile dimensions/length;
- casing size/arc;
- SFX event mapping.

Then and only then create C2 implementation work for:
- all 12 weapon visuals;
- grenade continuity;
- motion V2 physical exits;
- SFX V2;
- high-speed tracers + swept collision;
- impact hierarchy;
- Arsenal-only Chamber 01 renderer.

## 16. Hard stop

Do not let a coding agent choose winners or improvise the visual identity.

The owner approves the proof first.
