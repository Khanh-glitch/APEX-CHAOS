# ARSENAL QUEST C1 — ASSET AUDIT

Status: C1 creative / asset / audio lock  
Updated: 2026-09-24  
Authority: `V2_CHECKPOINT_C_IDENTITY_COMBAT_DIRECTION.md`

This audit is a disposition pass only. It does **not** authorize gameplay integration.

## Decision legend

- **KEEP** — acceptable source/runtime element for C1 direction.
- **REPROCESS** — useful source, but must be normalized to the C1 art bible before approval.
- **REPLACE** — current runtime/source cannot represent the desired identity.
- **DONOR** — may contribute shape/detail/material reference, but must not ship unchanged as canonical final art.
- **BACKUP** — retained only as contingency/reference.

## 1. Gun family

### Current runtime atlas
Disposition: **REPLACE**

Reason:
- current prototype reads as a collage rather than one weapon family;
- existing weapon presentation does not satisfy the new high-contrast hard-surface language;
- current family is not the owner-approved visual authority.

### Senko v9
Source: private asset vault  
Disposition: **REPROCESS — PRIMARY C1 GUN SOURCE**

C1 exact proof candidates:
- compact/automatic: `MP5.svg`
- shotgun/heavy: `SPAS 12.svg`
- long/sniper: `Snipex Alligator.svg`

Fallback audition only if one of the above fails:
- `MAC 10.svg`
- `Mossberg 500.svg`
- `P90.svg`

Required reprocess:
- graphite / dark-steel body values;
- one consistent edge/outline treatment;
- shared highlight direction;
- controlled warm/brass mechanical accents;
- preserve mechanical parts that can visibly recoil, pump, tilt or flick;
- no baked glow;
- no whole-weapon recolor by class.

Acceptance:
- all three read as related at 90–190 px gameplay scale;
- silhouettes remain distinct;
- rotation toward target does not expose obviously wrong perspective;
- mechanical subparts remain legible enough to support motion.

## 2. Battle Axe

Current staged source:
- 512 px one-handed axe
- 512 px two-handed axe

Disposition: **REPROCESS**

Reason:
- strong readable head mass and adequate source resolution;
- current medieval wood/metal material language is incompatible with Chamber 01.

Primary C1 candidate:
- two-handed axe source.

Required reprocess:
- retain heavy head proportions;
- graphite/dark handle treatment;
- industrial fastening/hardware emphasis;
- brighter steel cutting edge;
- remove decorative fantasy cues that compete with industrial arcade language.

Motion compatibility requirement:
must support `hang -> crush -> impact hold -> stuck/yank -> tumble exit`.

## 3. Grenade

Current prototype generic thrown circle:
Disposition: **REPLACE**

Kay Lousberg grenade donor:
Disposition: **DONOR / REJECT AS UNCHANGED FINAL**

Reason:
- clean but icon-like;
- insufficient mechanical detail beside Senko gun family.

C1 requirement:
author/reprocess one bespoke canonical grenade with:
- compact mechanical silhouette;
- graphite/olive body;
- amber warning/fuse accent;
- visible pin/lever or equivalent mechanical detail;
- readability during rotation.

Continuity law:
**the exact same canonical identity must appear as floor pickup, equipped object and in-flight grenade.**

## 4. Defense

### Current round shield sources
Disposition:
- SWIRL SHIELD: **REPROCESS CANDIDATE**
- TOWER SHIELD: **REPLACE**

Reason:
round RPG shields do not communicate the planted vertical mass required for Tower Shield.

C1 Tower Shield requirement:
author/reprocess a dedicated tall shield:
- largest defense silhouette;
- industrial panel / reinforced edge construction;
- pale steel / restrained blue-steel accent;
- clear front-facing guard plane;
- suitable for plant, block recoil and physical fall/withdraw exit.

Do not stretch a round shield.

## 5. Projectile visuals

Current outlined oval bullets:
Disposition: **REPLACE**

Target:
- Pistol: fast short tracer;
- SMG: finer short rapid tracers;
- Shotgun: near-instant pellet streak fan;
- Sniper: long near-hitscan transient.

Primary read:
- thin core;
- bright head;
- very short afterimage;
- no thick outlined moving ball.

Kay bullet assets:
Disposition: **DONOR**

Use:
- optional tiny bullet-head reference;
- ammo/casing shape reference.

Do not use a large cartridge sprite as the primary projectile read.

### Spent casing
Current source status: no convincing dedicated spent casing.
Disposition: **AUTHOR DERIVATIVE**

Requirement:
small brass casing silhouette with open-mouth read, used only for weapon ejection motion.

## 6. Muzzle / smoke / impact

### 16 Toon Muzzle Flash
Disposition: **KEEP FOR C1 AUDITION**

C1 staged samples:
- `m_1.png`
- `m_5.png`
- `m_9.png`

Must be judged at actual muzzle scale, not source-preview scale.

### Kenney Particle Pack smoke
Disposition: **KEEP / REPROCESS AS NEEDED**

Use restrained smoke only:
- stronger on Shotgun / Sniper;
- lighter on Pistol / SMG;
- no persistent fog that obscures combat.

### Kenney sparks / contact particles
Disposition: **KEEP FOR IMPACT SUPPORT**

They are secondary support, not the whole hit language.

Gun/melee impact must combine:
- short contact transient;
- weapon-specific direction/shape;
- target reaction / hit-stop where appropriate.

### Generic square-particle burst
Disposition: **REPLACE AS PRIMARY HIT READ**

## 7. Explosion

Sinestesia Explosion Animations #2:
Disposition: **KEEP FOR C1 PROOF**

Use:
- grenade explosion proof;
- preserve readability and radial blast hierarchy.

Do not use the explosion to hide a weak grenade throw or discontinuous projectile identity.

## 8. Melee slash sheets

Current orange/blue imported slash sequences:
Disposition: **REPLACE AS PRIMARY MELEE LANGUAGE**

Reason:
authoritative C direction explicitly rejects generic slash-sheet VFX as the main read.

Melee action must be carried by:
- weapon body;
- anticipation/commit;
- directional contact;
- physical exit.

Small support trails are allowed only if subordinate.

## 9. Audio

### Gun fire baseline
Current:
- Pistol: `cz.wav`
- SMG: `sks.wav` sliced
- Shotgun: `shotty.wav`
- Sniper: `mosin.wav`

Disposition: **KEEP**

Reason:
owner preferred the existing demo over the later Free Firearms audition set.

### Snake archives
Disposition: **BACKUP**

Do not replace a liked baseline simply because another free pack exists.

### Sniper sci-fi charge
Current: `laserLarge_003.ogg`
Disposition: **REPLACE**

Reason:
does not match the intended `ceremony -> violence` mechanical firearm identity.

### Melee / shield / grenade / gun mechanism final lock
Disposition: **KEEP — OWNER PASS**

Repository note:
the owner-PASSed Sonniss final-lock bundle is not currently present in the private vault. This is a repository restoration gap, not a sourcing gap.

Required before final runtime integration:
- restore the approved final-lock bundle;
- do not re-audition randomly unless the owner rejects a specific sound in context.

## 10. Arena/background

Current base Apex battlefield:
Disposition: **REPLACE FOR ARSENAL MODE ONLY**

C1 target:
**ARSENAL FIELD TEST // CHAMBER 01**

Required language:
- dark graphite / charcoal field;
- restrained range/grid markings;
- visible industrial boundary/walls;
- neutral pickup floor zones;
- sparse measurement ticks;
- low-contrast background;
- no bright decorative projectile-like lines;
- no central obstruction.

Do not redesign the global Apex background.

## 11. C1 audit conclusion

Acquisition is sufficient for the style proof.

Do not continue random pack hunting.

The only unsolved visual pieces should now be authored/reprocessed deliberately:
1. canonical grenade;
2. dedicated tall Tower Shield;
3. spent casing derivative;
4. coherent normalization of the approved gun/axe family;
5. Chamber 01 composition.

No gameplay integration is authorized until the owner approves the C1 style proof.
