# APEX CHAOS — ARSENAL MAJOR UPDATE V3 COMBAT + VISUAL AUTHORITY

**Date:** 2026-09-25
**Repository:** `Khanh-glitch/APEX-CHAOS`
**Implementation branch:** `arena/01a0cf5e-apex-chaos`
**Protected accepted runtime baseline:** `75c8879d83f03a33854b34b4d55e775d8027cce9`
**Status:** SINGLE CONTROLLING V3 COMBAT / VISUAL AUTHORITY

This is the only controlling V3 gameplay/combat/visual authority.
It supersedes older Arsenal tuning where explicitly changed here.

Do not reinterpret owner feedback into a different game.
Do not rebuild accepted systems from scratch.

---

# 0. OWNER FEEDBACK THIS UPDATE MUST SOLVE

1. Splatter must read like sharp manga blood spurts, not soft procedural stains.
2. Damage numbers must be crisp and semantically simple:
   - normal damage red;
   - critical damage orange;
   - heal green.
3. Add critical chance to every firearm with one comparable multiplier; sniper/precision guns receive higher chance.
4. Arsenal match HP 100 -> 1000.
5. Arsenal weapon / grenade / melee damage x7.
6. Heal restore x7.
7. Native fighter skill damage stays at its currently accepted Arsenal behavior.
8. Reduce weapon oversupply and restore anticipation.
9. Emergency gun supply only when both living fighters have no FIREARM and no already-REVEALED firearm exists; hidden question marks do not block it.
10. Normalize gun render size.
11. Restore original fighter visuals in Arsenal, especially CARD, MATH, MATH_V2 and other text/glyph-driven identities.
12. Preserve accepted floor, audio, casing, rarity, Quest and performance work unless explicitly superseded here.

---

# 1. COMBAT SCALE LAW

## 1.1 Match HP

`MATCH_HP = 1000`

This is real runtime HP, not cosmetic HUD text.

Do not change non-Arsenal game HP globally.

## 1.2 Arsenal equipment damage

Define one central authority:

`ARSENAL_DAMAGE_SCALE = 7`

Apply x7 to damage originating from Arsenal equipment:
- all 24 firearms;
- grenade;
- held melee;
- thrown melee.

Apply to DAMAGE VALUES only.

Do NOT x7:
- bullet speed;
- projectile life;
- range;
- spread;
- recoil;
- knockback;
- stun;
- hit-stop;
- interval;
- aim time;
- fighter movement;
- pickup timing.

Keep authored weapon tuning as pre-scale values and apply one explicit scaling layer.

## 1.3 Native fighter damage

Native fighter-kit damage keeps the current accepted Arsenal effective behavior.

Do NOT apply `ARSENAL_DAMAGE_SCALE` to:
- native skill projectiles;
- native contact/melee;
- native status;
- native beam/blast;
- other fighter-kit damage.

Existing `NATIVE_ARSENAL_MULT` behavior stays intact unless a regression is proven.

## 1.4 Heal scale

Exact V3 restores:

| Heal | Restore |
|---|---:|
| H1 | 70 |
| H2 | 126 |
| H3 | 196 |
| H4 | 280 |
| H5 | 385 |

`HEAL_ELIGIBLE_HP = 800`

Keep:
- no overheal;
- dead cannot collect;
- full HP cannot waste;
- popup = actual restored amount;
- immediate HUD update;
- `healingDone` = actual restore;
- max one active support heal;
- 9s cooldown;
- 12s life;
- heal does not consume offensive cap;
- H1:H2:H3:H4:H5 weights 7:5:3:2:1.

---

# 2. FIREARM CRITICAL-HIT SYSTEM

Critical hits apply ONLY to the 24 firearms.

No crit for:
- grenade;
- melee;
- shields;
- heals;
- native fighter skills.

## 2.1 Universal multiplier

Every firearm uses exactly:

`CRIT_DAMAGE_MULTIPLIER = 1.50`

No per-gun crit multiplier.

Gun identity is expressed through crit CHANCE.

## 2.2 Exact crit chance table

| Gun | Tier | Crit |
|---|---|---:|
| PISTOL | T1 | 7% |
| GLOCK_17 | T1 | 6% |
| TEC_9 | T1 | 6% |
| MAC_10 | T1 | 5% |
| BERETTA_93R | T2 | 7% |
| SMG / MP5 | T2 | 7% |
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
| SHOTGUN / SPAS 12 | T3 | 12% |
| SAWED_OFF | T3 | 11% |
| MAGNUM_500 | T4 | 18% |
| M249_SAW | T4 | 10% |
| MBR2 | T4 | 22% |
| SZECSEI_FUCHS | T4 | 24% |
| SNIPER / Snipex | T5 | 32% |
| JACKHAMMER | T5 | 14% |

Design law:
- rarity trends upward but does not override weapon identity;
- high-volume automatics stay lower;
- accurate/heavy semis sit higher;
- precision/sniper guns are substantially more crit-prone.

## 2.3 Crit roll granularity

Use a dedicated injectable COMBAT RNG stream.
Crit rolls must NOT consume or perturb spawn/rarity RNG.

Single-projectile SEMI/AUTO/BURST:
- roll once per actual fired bullet.

SHOTGUN blast:
- roll once per blast;
- all pellets from that blast share crit state.

JACKHAMMER / AUTOSHOT:
- roll once per individual blast;
- pellets within that blast share crit state.

PRECISION:
- roll once per fired precision projectile.

Do not roll independently per pellet.

## 2.4 Damage order

1. authored firearm damage;
2. Arsenal x7;
3. x1.50 if crit;
4. existing shield/defense mitigation;
5. realized HP transaction;
6. popup displays realized post-mitigation amount.

Crit does not bypass shield/invulnerability/miss/clamp.

Pass explicit `critical: true/false` through damage -> feel/presentation.
Do not infer crit from amount.

## 2.5 AUTO/BURST aggregation truth

If one visual aggregation window contains both normal and critical bullets:
- aggregate normal realized damage separately;
- aggregate critical realized damage separately;
- show at most one RED normal popup and one ORANGE crit popup for that aggregation window;
- offset them slightly so they do not fully overlap.

Never color the entire mixed aggregate orange merely because one bullet crit.

SHOTGUN blast remains one semantic result because the blast shares one crit state.

---

# 3. DAMAGE NUMBER VISUAL LANGUAGE

Canonical source:
`public/assets/arsenal/feel/damage/damage1.png`

Only three semantic NUMBER colors:

Normal damage:
- fill **#F2382F**
- hard edge **#5A0C09**

Critical damage:
- fill **#FF8A24**
- hard edge **#5A2700**

Heal:
- fill **#37D96B**
- hard edge **#063D1D**

MISS is not a number and may remain neutral/slate.

No white damage.
No rarity-colored damage.
No yellow heavy fourth category.
“Heavy” amount changes SIZE, not semantic color.

## 3.1 Non-linear size bands

Use realized displayed absolute amount:

| Amount | Band | Scale |
|---:|---|---:|
| 1–34 | XS | 0.85 |
| 35–69 | S | 1.00 |
| 70–139 | M | 1.15 |
| 140–239 | L | 1.32 |
| 240–399 | XL | 1.50 |
| 400+ | XXL | 1.70 |

Heal uses same amount bands based on actual restored HP.

No continuous linear size formula.

## 3.2 Crisp cached rendering

Prebuild/cache glyph/atlas variants by:
- semantic kind: normal / crit / heal / miss;
- size band.

Requirements:
- final normal gameplay draws cached variants;
- destination dimensions/positions integer-aligned where practical;
- no repeated fractional master-atlas rescale every popup;
- no soft shadowBlur over glyph body;
- hard readable edge;
- no generic Impact-font fallback when atlas is loaded.

## 3.3 Crit mark / motion

Crit popup:
- orange number;
- compact ORANGE four-point manga burst/diamond beside it;
- use canvas/vector geometry, not Unicode star;
- initial punch ~1.15x;
- settle to 1.0 in ~90ms;
- stronger rise than normal;
- readable life about 0.9s;
- optional tiny local burst ticks;
- no giant full-screen flash.

Normal red popup remains calmer.
Heal green popup remains clear and stable.

---

# 4. MANGA BLOOD SPLATTER

Target:
**sharp directional manga blood spurt / slash-splatter**.

Not:
- soft puddle;
- airbrush;
- ellipse blob;
- generic particle spray.

Use existing:
`public/assets/fang_v1/speckBlood.webp`
as one organic ingredient only.

No external blood asset required.

## 4.1 Palette

- thin/wet spray: **#D72A32**
- main blood: **#8E0E18**
- dense core: **#3A0508**
- deepest overlap may approach **#260407**

Blood is blood-colored in V3.
Do not tint persistent blood green/blue/purple from fighter color.

## 4.2 Transient “toẹt” moment

Positive direct hit:
- 3–7 tapered pointed streaks;
- 6–18 asymmetric droplets;
- direction primarily AWAY from incoming source;
- focused fan typically within ±35°;
- pointed triangle/bezier wedge/teardrop forms;
- hard edges;
- minimal/no blur;
- ~120–220ms.

Normalize visual magnitude against combat scale:

`visualDamage ~= realizedDamage / ARSENAL_DAMAGE_SCALE`

Crit may amplify transient ray length/density about 1.15–1.25x.
Do not use the full 1.50 crit multiplier for persistent stain size.

## 4.3 Persistent stain

Keep offscreen stain canvas + one historical composite draw/frame.

Each stamp:
- irregular speckBlood core;
- 2–5 pointed slash/spear streaks;
- 3–9 hard satellite droplets;
- asymmetric direction;
- no perfect ellipse primary core.

Family grammar:
- SEMI: compact hard fan;
- AUTO/BURST: smaller repeated slash-specks;
- SHOTGUN/AUTOSHOT: broad cone of pointed spray;
- PRECISION: long narrow high-energy streak + sparse satellites;
- MELEE: curved slash spray;
- GRENADE/BLAST: radial manga starburst.

Preserve:
- pooled transient spray;
- reset on new match;
- no MISS/zero/default DoT splatter;
- bounded stain coverage.

---

# 5. OFFENSIVE SPAWN PACING V3

## 5.1 Normal cadence/cap

`SPAWN_CADENCE_SECONDS = 4.5`

`MAX_ACTIVE_SLOTS = 5`

Heal support remains outside offensive cap.

Normal cadence may still roll the existing offensive pool according to accepted rarity/weight law.

## 5.2 Emergency GUN predicate

Owner wording is firearm-specific.

Define:

`bothNoGun = both living fighters currently hold no FIREARM`

`revealedGunCount = active floor slots where phase === REVEALED AND weaponId is a firearm`

`emergencyGunNeeded = bothNoGun AND revealedGunCount === 0`

Important:
- TELEGRAPH / question-mark does NOT count;
- HEAL does not count;
- shield/counter-reserved does not count;
- revealed melee/grenade does NOT count as a gun;
- holding melee/shield/grenade does NOT count as holding a firearm.

## 5.3 Emergency result

Emergency spawn must create/select a FIREARM slot.

Do not let emergency selection roll melee/grenade/shield.

This avoids:
“both still have no gun -> emergency spawned melee -> predicate immediately remains true -> repeated emergency.”

Normal 4.5s cadence still uses accepted general offensive pool.

## 5.4 Edge/pending semantics

When `emergencyGunNeeded` transitions false -> true:
- attempt exactly one immediate firearm slot;
- success resets normal timer to fresh 4.5s;
- same-tick normal expiry must not double-spawn;
- obey cap.

If cap full:
- pending=true;
- no timer reset;
- no per-frame retry/log spam.

When capacity opens and predicate remains true:
- execute exactly one pending emergency firearm spawn;
- reset timer 4.5;
- consume episode.

Re-arm when predicate becomes false, e.g.:
- a fighter obtains a firearm; or
- a firearm becomes REVEALED.

If last revealed gun is picked/expired while both still have no firearm:
- predicate becomes true;
- immediate emergency gun is eligible.

No post-KO emergency.

---

# 6. FIREARM DISPLAY SCALE NORMALIZATION

Root cause:
raw generated `worldW/worldH` values currently create an excessive size range.

Do not use raw world dimensions as final display size.

Preserve aspect ratio.

Canonical EQUIPPED long-side px:

| Gun | Long side |
|---|---:|
| PISTOL | 126 |
| GLOCK_17 | 124 |
| TEC_9 | 132 |
| BERETTA_93R | 130 |
| DESERT_DEAGLE | 138 |
| MAGNUM_500 | 142 |
| MAC_10 | 136 |
| SMG / MP5 | 142 |
| P90 | 140 |
| AK_47 | 154 |
| M16 | 154 |
| ZBROYAR_Z15 | 152 |
| ZBROYAR_Z15_S1 | 152 |
| ZBROYAR_Z15_S2 | 152 |
| ZBROYAR_Z15_S3 | 152 |
| M249_SAW | 170 |
| MBR | 174 |
| MBR2 | 176 |
| SZECSEI_FUCHS | 176 |
| SNIPER / Snipex | 188 |
| MOSSBERG_500 | 158 |
| SHOTGUN / SPAS 12 | 160 |
| SAWED_OFF | 132 |
| JACKHAMMER | 156 |

Mode multipliers:
- equipped 1.00;
- revealed floor pickup 0.92;
- detached/exit 0.96.

Hard firearm display envelope remains approximately 108–188px long side.

Muzzle/casing anchors must use the SAME normalized transform as sprite draw.
Do not leave anchors on old raw world scale.

Melee/shield/grenade keep accepted separate sizing unless a real outlier is proven.

---

# 7. FIGHTER NATIVE VISUAL PARITY

Root cause already audited:
Arsenal currently replaces `ctx.fillText/strokeText` with no-op during all `baseDraw()`.

That suppresses legitimate native identity visuals including CARD/MATH/MATH_V2 and other fighters.

## 7.1 New render law

REMOVE blanket canvas text suppression around `baseDraw()`.

Allow native fighter/ability typography and glyphs.

Continue suppressing clutter at its actual source:
- keep Arsenal legacy `floatingTexts` sink;
- no generic weapon-name battlefield labels;
- no generic damage FloatingText;
- debug text only in debug mode.

Do not globally mute canvas text.

## 7.2 Full roster audit

Audit canonical 32 + NEWBIE:
- body draw;
- active skill visual;
- native projectile visual;
- overlays/marks/formulas/cards/glyphs;
- special states.

Required focused evidence:
- CARD hand/value;
- MATH formula projectile;
- MATH_V2 formula/graph;
- SNIPER aim indicator;
- HUNTER mark;
- SUPERSTAR or PAINTER;
- >=3 geometry-only fighters;
- NEWBIE.

Do not patch only CARD/MATH by name if generic render correction fixes the class.

---

# 8. PRESERVE ACCEPTED SYSTEMS

Unless explicitly changed above:
- graphite Chamber + cache;
- rarity identities/probabilities;
- approved weapon art;
- pickup-ready audio recuts;
- casing first-contact audio;
- no gun-body drop SFX;
- heal sprite identities/lifecycle;
- Quest 20-stage core;
- counter-shield law;
- reveal/contact prediction;
- NEWBIE skill identity;
- accepted caches/pools/rAF telemetry;
- non-Arsenal modes.

Do not modify `main` during V3 implementation.
Do not move `playtest/arsenal`.

---

# 9. REQUIRED GATES

## Scale
- 1000/1000 start;
- firearm/grenade/melee x7;
- native fighter damage unchanged;
- heals 70/126/196/280/385;
- threshold 800.

## Crit
- all 24 exact chances;
- multiplier 1.50;
- dedicated deterministic combat RNG;
- spawn RNG unchanged by crit activity;
- single bullets roll individually;
- shotgun one roll/blast;
- Jackhammer one roll/blast;
- no per-pellet crit;
- no melee/grenade/native crit;
- shield mitigates crit;
- mixed AUTO/BURST aggregation remains semantically truthful.

## Numbers
- red normal;
- orange crit + geometric mark;
- green heal;
- six bands;
- cached crisp variants;
- no white damage in atlas-ready path.

## Spawn
- normal 4.5s;
- cap 5;
- both no gun + no revealed gun -> immediate firearm;
- hidden ? does not block;
- revealed firearm blocks;
- revealed melee does not block;
- holding melee does not block;
- emergency result always firearm;
- cap pending no spam;
- same-tick no double;
- KO no emergency.

## Scale rendering
- all 24 guns exact canonical size;
- floor/equipped/detached multipliers;
- anchors aligned.

## Visual parity
- blanket text mute removed;
- FloatingText remains suppressed;
- required parity cases render.

## Manga splatter
- hard directional spurt;
- blood palette;
- no ellipse-primary stain;
- browser evidence by family + crit.

---

# 10. IMPLEMENTATION CHECKPOINTS

1. **V3 COMBAT CORE COMPLETE**
2. **V3 VISUAL PARITY COMPLETE**
3. **V3 META UI COMPLETE**
4. **V3 SMOOTHNESS + EVIDENCE COMPLETE**

The meta/UI checkpoint follows:
`docs/arsenal-quest/ARSENAL_V3_META_UI_UX_RUNBOOK.md`

Repo hygiene follows:
`docs/arsenal-quest/BRANCH_PRUNE_SAFETY_RUNBOOK.md`

Green tests do not replace browser owner-visible acceptance.
