# APEX CHAOS — ARSENAL V3 MAJOR UPDATE
## Gameplay + Combat + Visual Authority

**Date:** 2026-09-25  
**Repository:** `Khanh-glitch/APEX-CHAOS`  
**Authorized implementation branch:** `arena/01a0cf5e-apex-chaos`  
**Protected accepted baseline:** `75c8879d83f03a33854b34b4d55e775d8027cce9`  
**Main baseline:** `main == 75c8879d83f03a33854b34b4d55e775d8027cce9`

This is the controlling authority for the next major Arsenal update. It supersedes earlier Arsenal tuning only where this file explicitly changes behavior.

Do not reinterpret owner feedback into a different game. Preserve accepted weapon identities, rarity system, Chamber floor, heal art, audio source identities, casing semantics, Quest core progression, and accepted performance work unless explicitly changed here.

---

# 1. Combat scale

## 1.1 Match HP

Arsenal match HP becomes exactly:

`MATCH_HP = 1000`

All Arsenal HUD / selection / heal thresholds / tests must use 1000 as the authoritative max HP.

Do not change non-Arsenal game HP globally.

## 1.2 Arsenal damage scale

All damage originating from Arsenal equipment is multiplied by exactly:

`ARSENAL_DAMAGE_SCALE = 7`

This applies to:
- all 24 firearms;
- grenade;
- hand-held melee Arsenal weapons;
- thrown-melee Arsenal hits.

This is an output damage scale. Do NOT multiply by 7:
- bullet speed;
- projectile lifetime;
- range;
- spread;
- recoil;
- knockback;
- stun duration;
- hit-stop duration;
- fire interval;
- aim time;
- pickup timing;
- fighter movement.

Keep the current authored weapon numbers as canonical pre-scale tuning where practical and apply one explicit Arsenal damage authority rather than scattering hand-edited x7 values.

## 1.3 Fighter native skill damage stays unchanged

Native fighter abilities / fighter-kit damage in Arsenal must preserve the current accepted effective Arsenal damage behavior.

Do NOT apply `ARSENAL_DAMAGE_SCALE` to native fighter skills, contacts, status abilities, native projectiles, or native skill-generated attacks.

Existing `NATIVE_ARSENAL_MULT` behavior stays intact unless a regression is proven.

## 1.4 Heal scale

The already accepted H1-H5 heal values scale by exactly x7:

| Heal | Old | V3 restore |
|---|---:|---:|
| H1 | 10 | 70 |
| H2 | 18 | 126 |
| H3 | 28 | 196 |
| H4 | 40 | 280 |
| H5 | 55 | 385 |

Rules remain:
- no overheal;
- dead cannot collect;
- full HP cannot waste;
- popup shows actual restored amount;
- HUD updates immediately;
- `healingDone` records actual restore.

Heal eligibility threshold scales proportionally from 80/100 to:

`HEAL_ELIGIBLE_HP = 800`

Support spawn cooldown/lifetime remain 9s / 12s unless later owner feedback explicitly changes them.

---

# 2. Critical-hit system — firearms only

Critical hits are a NEW Arsenal firearm mechanic.

They apply only to the 24 gun identities. They do not apply to:
- grenade;
- melee;
- shields;
- heal;
- native fighter skills.

## 2.1 Universal critical multiplier

Every firearm uses the same exact multiplier:

`CRIT_DAMAGE_MULT = 1.50`

No gun-specific crit multiplier.

Critical chance differs by gun identity.

## 2.2 Exact crit chance table

| Gun | Tier | Crit chance |
|---|---|---:|
| PISTOL | T1 | 7% |
| GLOCK_17 | T1 | 6% |
| TEC_9 | T1 | 6% |
| MAC_10 | T1 | 5% |
| BERETTA_93R | T2 | 7% |
| SMG | T2 | 7% |
| P90 | T2 | 8% |
| ZBROYAR_Z15 | T2 | 9% |
| ZBROYAR_Z15_S1 | T2 | 9% |
| ZBROYAR_Z15_S2 | T2 | 8% |
| ZBROYAR_Z15_S3 | T2 | 10% |
| MOSSBERG_500 | T2 | 10% |
| DESERT_DEAGLE | T3 | 13% |
| AK_47 | T3 | 10% |
| M16 | T3 | 11% |
| MBR | T3 | 18% |
| SHOTGUN | T3 | 12% |
| SAWED_OFF | T3 | 11% |
| MAGNUM_500 | T4 | 18% |
| M249_SAW | T4 | 10% |
| MBR2 | T4 | 22% |
| SZECSEI_FUCHS | T4 | 24% |
| SNIPER | T5 | 32% |
| JACKHAMMER | T5 | 14% |

Design law:
- precision rifles are intentionally much more crit-prone;
- rarity generally trends upward but firearm identity can override a simple tier formula;
- high-volume automatic weapons stay lower;
- heavy precision / sniper weapons stay higher.

Do not replace this with one generic tier-only chance table.

## 2.3 Crit transaction semantics

Use the existing injectable Arsenal RNG path for deterministic tests.

For single-projectile firearm shots:
- roll crit for that projectile / resolved hit transaction.

For shotgun-style pellet fans:
- roll ONCE per blast/trigger;
- the entire pellet packet from that blast shares the crit state;
- do not roll independently per pellet.

For JACKHAMMER / multi-blast autoshot:
- each blast in the sequence gets one crit roll;
- its pellets share that blast's crit state.

For burst / automatic single-projectile sequences:
- each actual bullet may roll independently;
- visual aggregation must not lie about which damage was critical.

Damage order:
1. authored firearm damage;
2. Arsenal x7 damage scale;
3. x1.50 when crit;
4. existing defensive/shield mitigation;
5. realized HP transaction;
6. popup displays realized damage.

Crit cannot bypass shields, invulnerability, miss logic, or damage clamping.

Expose `critical: true/false` through the Arsenal damage/feel transaction so presentation does not infer crit from damage amount.

---

# 3. Damage numbers — three semantic colors only

The existing `damage1.png` remains the canonical digit asset.

Number semantics are now:

- NORMAL DAMAGE = red;
- CRITICAL DAMAGE = orange;
- HEAL = green.

Do not use yellow/heavy as a fourth damage semantic.

MISS is not a number and may remain neutral/slate.

## 3.1 Palette

Normal:
- fill approximately `#F2382F`
- hard dark-red edge approximately `#5A0C09`

Critical:
- fill approximately `#FF8A24`
- hard dark-orange/brown edge approximately `#5A2700`

Heal:
- fill approximately `#37D96B`
- hard dark-green edge approximately `#063D1D`

No soft white/black wash over the digit body.

## 3.2 Size bands

Digit size is NOT linear with value.

Use realized displayed absolute value and exactly these six bands:

| Realized value | Band | Base scale |
|---|---|---:|
| 1–34 | XS | 0.85 |
| 35–69 | S | 1.00 |
| 70–139 | M | 1.15 |
| 140–239 | L | 1.32 |
| 240–399 | XL | 1.50 |
| 400+ | XXL | 1.70 |

Heal uses the same value bands based on actual restored HP.

## 3.3 Crisp atlas rendering

The current dynamic fractional scaling is not accepted as the final solution because owner playtest reports blurred / hard-to-read digits.

Build/cache final tinted atlas or glyph surfaces for:
- each semantic color;
- each of the six size bands.

Render these cached band surfaces at or near 1:1 destination scale and pixel-stable/integer-aligned positioning.

Do not recolor or rescale the master atlas from scratch for every popup.

The final browser result must be visibly crisp on the real Chamber floor.

## 3.4 Critical presentation

Critical damage must visually read differently without introducing another color.

Required:
- orange number;
- small orange comic critical mark immediately beside the number;
- stronger initial punch/pop than normal damage;
- slightly stronger upward lift;
- longer readable hold, but still bounded.

The crit mark must be generated from existing runtime/vector primitives or already committed assets. Do not source a new external icon just for this.

The mark should read as a compact manga/comic burst/diamond, not generic text spam.

Normal red popup remains calmer.

---

# 4. Manga blood-splatter direction

The current organic-mask splatter is still not accepted visually.

The target is no longer generic liquid stain. It must read like a **manga impact blood spray**: sharp, directional, high-energy and graphic.

Use existing:
`public/assets/fang_v1/speckBlood.webp`

No new external blood asset is required for this pass.

## 4.1 Color

Supersede rainbow/victim-color stain identity.

Blood uses a coherent crimson/ink family:
- hot thin spray: approximately `#D72A32`;
- main blood: approximately `#8E0E18`;
- dense/ink core: approximately `#3A0508`.

Victim fighter color must not turn blood green/blue/purple.

## 4.2 Impact language

Each positive direct-damage event may build from:
- one irregular speckBlood core stamp;
- 3–7 long tapered manga streaks;
- 6–18 asymmetric satellite droplets;
- a fan or radial burst depending on weapon family;
- optional smaller secondary organic stamp.

Tapered streaks should use triangles / bezier wedges / pointed paths, not capsules or ellipses.

No obvious perfect ellipse may dominate the result.

The spray direction should primarily travel away from the incoming attack/source direction.

## 4.3 Family signatures

- pistol/semi: compact sharp fan, 3–4 tapered rays;
- auto/burst: smaller repeated slash-specks; nearby hits aggregate visually;
- shotgun/autoshot: broad cone of short and medium pointed spray;
- precision: long narrow high-energy manga streak with sparse satellites;
- melee: slash-like curved directional spray;
- grenade/blast: radial starburst with irregular splat fragments.

## 4.4 Crit interaction

Critical firearm impacts amplify the manga burst, not the persistent stain footprint without bound.

Crit may increase:
- transient ray length;
- transient droplet velocity/count moderately;
- one emphasized primary streak.

Keep persistent floor coverage bounded.

## 4.5 Architecture

Keep:
- offscreen persistent stain surface;
- one stain composite draw/frame;
- pooled transient spray;
- reset on new match;
- no MISS / zero / default DoT splatter.

The target is stylized manga blood, not realistic gore simulation.

---

# 5. Offensive spawn pacing

Owner feedback: weapons currently accumulate too quickly and reduce anticipation.

## 5.1 Normal cadence / cap

Change normal offensive cadence from 3.0s to exactly:

`SPAWN_CADENCE_SECONDS = 4.5`

Change offensive active-slot cap from 8 to exactly:

`MAX_ACTIVE_SLOTS = 5`

Heal support slots remain outside the offensive cap.

## 5.2 New emergency firearm law

Replace the old generic both-unarmed fast-path predicate.

Emergency supply condition is:

1. both living fighters currently hold **no firearm**; AND
2. there are **zero REVEALED offensive firearm pickups** on the arena floor.

Important:
- TELEGRAPH / question-mark slots do NOT count as revealed;
- a hidden question-mark may therefore coexist with a new emergency spawn;
- revealed melee does not count as a revealed firearm;
- shield/counter-reserved slots do not count as a firearm;
- holding melee/shield does not count as holding a firearm.

The emergency spawn itself must select a **firearm**, not melee/grenade/shield.

Do not let an emergency roll choose melee and immediately retrigger.

## 5.3 Edge/pending semantics

Emergency spawn is edge/state-driven, not per-frame spam.

When the predicate transitions false -> true:
- try exactly one immediate firearm slot spawn;
- on success reset normal spawn timer to a fresh 4.5s;
- mark that emergency episode consumed.

If cap is full:
- preserve a pending emergency state;
- do not reset timer;
- do not log/retry every frame.

When capacity opens while the emergency predicate is still true:
- spawn one firearm immediately;
- reset timer to 4.5s;
- consume episode.

Re-arm emergency eligibility naturally when:
- either fighter obtains a firearm; OR
- a firearm pickup becomes revealed on floor;
and later the predicate becomes true again.

Same-tick timer expiry + emergency trigger must produce one spawn, not two.

No post-KO emergency spawn.

---

# 6. Weapon visual scale normalization

Current generated world dimensions range far too widely (roughly tens of pixels to >400px long side), causing unstable perceived weapon scale.

Stop using raw generated `worldW/worldH` as the final visual size authority.

Preserve each source sprite aspect ratio.

Use normalized family targets.

## 6.1 Equipped target long-side ranges

| Weapon family | Target long side |
|---|---:|
| compact/light pistol | 116 px |
| heavy pistol/revolver | 132 px |
| SMG | 138 px |
| AR / burst rifle | 154 px |
| LMG | 164 px |
| shotgun / autoshot | 158 px |
| precision rifle | 178 px |

Hard clamp for firearms:
- minimum 108px;
- maximum 188px.

Specific precision exception:
- SNIPER may reach 188px, never the old >400px world scale.

Floor pickup uses the same identity scale family at approximately 0.92x equipped long side, clamped for readability.

## 6.2 Anchor continuity

Muzzle and casing anchors must use the SAME normalized transform as the rendered sprite.

Do not normalize the sprite while leaving muzzle/casing calculations on old raw `worldW/worldH`.

Melee/shields/grenade keep their separately accepted authored scaling unless visual audit finds a real outlier.

---

# 7. Fighter native visual parity

Owner reports that several fighters lose native visuals in Arsenal, including CARD, MATH, MATH_V2 and others.

Root cause audited on current baseline:
Arsenal wraps `baseDraw()` with a blanket replacement of `ctx.fillText/strokeText`, which suppresses native fighter/ability typography such as CARD hand/value rendering, MATH formulas, MATH_V2 graph/formula text, SNIPER aim text, HUNTER marks and other identity visuals.

## 7.1 New law

Do NOT blanket-mute canvas `fillText/strokeText` during Arsenal base rendering.

Native fighter identity rendering is allowed and required.

Still suppress:
- legacy generic FloatingText damage spam in Arsenal;
- generic weapon name labels on battlefield;
- debug text unless debug mode is explicitly enabled.

Do not suppress legitimate fighter-native visual identity merely because it contains text/glyphs.

## 7.2 Full roster audit

Audit all canonical 32 fighters plus NEWBIE.

For every fighter compare:
- body draw;
- active skill visual;
- native projectile visual;
- overlays/marks/formulas/cards/glyphs;
- special state visuals.

Arsenal should preserve native visuals unless the compatibility matrix explicitly suppresses a mechanic.

Do not fix CARD/MATH/MATH_V2 with isolated name-specific hacks if the root render path can be corrected generically.

Add explicit parity gates for at least:
- CARD hand + value;
- MATH formula projectile;
- MATH_V2 formula/graph;
- SNIPER aim indicator;
- HUNTER mark;
plus a roster-wide draw smoke test.

---

# 8. Regression locks

Preserve unless this authority explicitly changes it:

- current mid-tone graphite Chamber floor and cache;
- rarity tier identities / probabilities;
- existing approved weapon art;
- pickup-ready audio recuts;
- casing first-contact audio;
- no gun-body drop SFX;
- heal sprite identities;
- Quest 20-stage structure;
- counter-shield contextual law;
- weapon reveal/contact prediction;
- Newbie skill identity;
- existing performance caches/pools;
- mainline game modes outside Arsenal.

Do not promote `playtest/arsenal` during implementation.

Do not mutate `main` during implementation; main is the protected accepted baseline.

---

# 9. Required gameplay gates

At minimum prove:

## Scale
- Arsenal match starts at 1000/1000.
- same authored gun base transaction produces exactly x7 pre-crit output vs old authority.
- native fighter skill transaction is NOT x7.
- H1–H5 restore exactly 70/126/196/280/385 and clamp to 1000.
- heal eligibility threshold is 800.

## Crit
- deterministic RNG can force crit/non-crit for every gun.
- every listed gun exposes exact configured chance.
- crit multiplier is exactly 1.5 for every gun.
- shotgun pellets share one blast crit state.
- melee/grenade/native fighter skill never crit through this system.
- shields still mitigate crit.

## Spawn
- cadence is 4.5s.
- cap is 5.
- both fighters no firearm + no revealed firearm -> immediate gun slot.
- TELEGRAPH question mark does not block emergency.
- revealed firearm blocks emergency.
- one fighter holding a firearm blocks emergency.
- revealed melee does not block emergency.
- emergency result is always a gun.
- cap-pending does not spam.
- same-tick no double spawn.
- KO no emergency.

## Scale rendering
- all firearm floor/equipped long sides stay inside authority bounds.
- muzzle/casing anchors remain attached after normalization.

## Native visuals
- root blanket text suppression removed/replaced safely.
- required parity cases render in Arsenal.

This authority is not complete until browser evidence proves the visual changes at real play scale.
