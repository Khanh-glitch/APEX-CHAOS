# APEX CHAOS // ARSENAL QUEST — WEAPON IDENTITY, RARITY, EXIT MOTION & COUNTER-SHIELD AUTHORITY

**Date:** 2026-09-24  
**Status:** DESIGN AUTHORITY FROZEN FOR NEXT IMPLEMENTATION PASS  
**Branch authority at freeze:** `arena/01a0cf5e-apex-chaos @ 879b3137730b211a1f1b3b921049669131e19dc2`

This document extends and supersedes the generic POST-C gun-family treatment wherever it conflicts. It does not reopen Checkpoint C from scratch.

## 0. Product law

The player should be able to recognize a weapon by more than its PNG.

A weapon identity is the combination of:

`ART + FIRE GRAMMAR + DAMAGE/RANGE + RECOIL/MOTION + MUZZLE/SMOKE + SFX + CASING/MECHANISM + POST-USE EXIT`

Twenty new Senko guns must not feel like six family presets wearing different sprites.

Power tiers are game rarity tiers derived from expected combat payoff, reliability, range, commitment and control. They are not claims about real-world collector rarity.

## 1. Source-asset decomposition law

The Senko SVG source family contains substantial internal vector grouping on many assets. Examples audited from the current repository include AK-47, Snipex Alligator, Zbroyar Z-15, M249 SAW, Jackhammer and MBR/MBR2.

However, most SVG groups are not semantically named.

Therefore:

- DO inspect the rendered SVG and author a semantic part map such as `magazine`, `receiver`, `stock`, `barrel/front`, `optic`, `cylinder/cassette` only when the visual separation is trustworthy.
- DO generate aligned transparent runtime part sprites from the same source coordinate system when a clean part map exists.
- DO NOT animate raw `<g>` nodes merely because the SVG has many groups.
- DO NOT invent fake disassembly for low-separability assets.
- When part extraction is not trustworthy, use a weapon-specific whole-body physical exit.
- `Zbroyar Z-15 skin3.svg` is currently 0 bytes and remains an explicit source-integrity blocker; do not represent its current graphite fallback as an independent original source asset.

High-priority part-extraction candidates:
- AK-47
- Beretta 93R
- MAC-10
- Mossberg 500
- Snipex Alligator
- Zbroyar Z-15 base / skin1 / skin2
- Glock 17
- M249 SAW
- Pancor Jackhammer
- Project MBR
- Project MBR2
- Szecsei & Fuchs

Low-group-count sources such as MP5, M16, Colt, Magnum 500, P90, Sawed-off and TEC-9 must be visually inspected before any part split is attempted.

## 2. Rarity tiers

### 2.1 Tier colors

| Tier | Label | Pickup under-light |
|---|---|---|
| T1 | COMMON | silver `#C9D0D7` |
| T2 | UNCOMMON | green `#63E28B` |
| T3 | RARE | blue `#4F9DFF` |
| T4 | EPIC | violet `#B66CFF` |
| T5 | LEGENDARY | amber `#FFB33C` |

No rarity text is rendered inside the battlefield.

### 2.2 Floor presentation

For a REVEALED pickup only:

- keep the normal dark contact shadow;
- add a second blurred luminous ellipse beneath the hovering weapon using the tier color;
- higher tiers increase halo radius, luminance and slow pulse amplitude, not weapon sprite saturation;
- the weapon remains readable in its authored colors;
- Legendary may add a restrained warm radial shimmer, but no text, badge, star, number or glyph;
- hidden TELEGRAPH / unknown state remains neutral and reveals no rarity information.

### 2.3 Tier-roll target

Initial tuning target for offensive random reveals:

- T1 Common: 30%
- T2 Uncommon: 30%
- T3 Rare: 23%
- T4 Epic: 12%
- T5 Legendary: 5%

Selection is two-stage:
1. choose rarity tier;
2. choose an eligible offensive item inside that tier.

Within a tier:
- gun / grenade raw item weight = 1.0;
- melee raw item weight = 0.5;
- shields are absent from the random pool.

This preserves the owner's melee-halving rule while making rarity meaningful.

These percentages are an initial authored target. Browser simulation may adjust them slightly, but ordering must remain T1 > T2 > T3 > T4 > T5 and Legendary must remain clearly uncommon.

## 3. Power envelopes

Do not balance only by theoretical maximum damage.

Tier assignment is based on:
- expected landed damage at intended range;
- ease of connecting;
- range;
- control / knockback / stun;
- firing commitment and telegraph;
- sequence duration;
- reliability.

Initial full-connect damage envelopes:

- T1: about 13–16
- T2: about 17–20
- T3: about 21–25
- T4: about 27–31
- T5: about 35–40

A short-range shotgun may have a high ceiling but poor reliability outside its intended range. A precision weapon may have high payoff but a visible aim commitment.

Do not map real-world muzzle velocity 1:1 into game pixels. Preserve physically sensible relative ordering while keeping swept collision and readable tracer timing.

## 4. 24-gun identity matrix

| Weapon ID | Tier | Role / attack grammar | Target full-connect payoff | Signature motion / exit |
|---|---:|---|---:|---|
| PISTOL / Colt | T1 | 3 deliberate semi-auto shots | ~13.5 | crisp triple recoil; slide settles; magazine drops; pistol flips backward and falls |
| GLOCK_17 | T1 | 4 light, quick semi-auto shots | ~14 | small fast slide/recoil; magazine drops vertically; compact cartwheel exit |
| TEC_9 | T1 | 5 rapid trigger-like shots, not generic full-auto spray | ~15 | fast muzzle taps; long magazine kicks free; body tosses rearward |
| MAC_10 | T1 | 8 very fast close-range spray shots, highest T1 spread | ~16 | short violent climb; long magazine drops; compact body tumbles |
| BERETTA_93R | T2 | two controlled 3-round bursts | ~17–18 | visible 3+3 burst rhythm; stronger front climb; magazine release then side-spin exit |
| SMG / MP5 | T2 | controlled 7-shot SMG burst | ~18 | restrained progressive climb; curved magazine drop; receiver settles then falls |
| P90 | T2 | 10-shot high-rate PDW stream, low per-shot damage, good control | ~19 | flat high-rate micro recoil; top-magazine separation only if cleanly extractable; body rolls out |
| ZBROYAR_Z15 | T2 | 4 accurate semi-auto rifle shots | ~19 | clean AR-style recoil; magazine drop; receiver/stock part exit only if semantic extraction is clean |
| ZBROYAR_Z15_S1 | T2 | SAME ballistics and timing as Z15 base | ~19 | visual skin only; same combat identity |
| ZBROYAR_Z15_S2 | T2 | SAME ballistics and timing as Z15 base | ~19 | visual skin only; same combat identity |
| ZBROYAR_Z15_S3 | T2 | SAME ballistics and timing as Z15 base after genuine source is resolved | ~19 | no invented unique mechanics merely because it is a skin |
| MOSSBERG_500 | T2 | one strong pump-shotgun blast, controlled cone | ~19–20 | heavy recoil; visible pump recovery; hull ejects; whole shotgun is thrown/dropped |
| DESERT_DEAGLE | T3 | 2 heavy semi-auto handgun shots | ~21 | large slide kick, slower return, large flash; mag drop + heavy rearward spin |
| AK_47 | T3 | 6-shot heavier assault burst, more recoil/spread than 5.56 rifles | ~22–23 | strong climb and lateral kick; magazine drop; optional stock/receiver separation if source map is clean |
| M16 | T3 | two accurate 3-round bursts | ~21–22 | clear burst-pause-burst cadence; lower climb than AK; mag drop then long-body toss |
| MBR | T3 | 2 deliberate DMR shots with short aim beat | ~22 | optic-led aim settle; sharp recoil; magazine / optic secondary motion if source layers support it |
| SPAS_12 | T3 | 2 semi-auto combat-shotgun blasts, tighter than sawed-off | ~24 | two body-punch recoils; shell/hull ejection per blast; no fake pump-rack after every semi-auto shot |
| SAWED_OFF | T3 | both barrels fire in a very short double report, very wide close-range cone | ~24–25 | break-open style finish; two hulls pop backward/up; barrel/body drop as one or two authored parts if feasible |
| MAGNUM_500 | T4 | one enormous revolver shot | ~28 | extreme single recoil + rotation; NO per-shot flying brass; at consume the cylinder opens visually and spent cases spill, then revolver falls |
| M249_SAW | T4 | long 12-shot sustained LMG burst; high total payoff, noticeable spread | ~30 | heavy sustained climb; ammo box / belt detail drops if extractable; wide casing/link cloud sprays backward; gun slumps nose-heavy |
| MBR2 | T4 | two heavier precision/battle-rifle shots | ~28 | deeper recoil than MBR, stronger aim snap; magazine + optic/module part-exit if clean |
| SZECSEI_FUCHS | T4 | double-barrel heavy precision rifle: two deliberate powerful shots | ~30 | ceremonial two-shot cadence, two large casing events, long rifle settles then drops; DO NOT treat as handgun-like SEMI |
| SNIPER / Snipex Alligator | T5 | one anti-materiel shot after the longest visible aim ceremony | ~38 | massive recoil, shockwave/smoke, heavy casing event, magazine/part drop only if source permits, full rifle kicks backward physically |
| JACKHAMMER | T5 | 3 automatic shotgun pulses, close-range high payoff | ~36 | rhythmic 3-pulse body recoil; cassette/cylinder part spins free if cleanly extractable; body recoils and exits |

## 5. Grounding notes for identity

Research anchors used only to establish relative weapon identity:

- Beretta 93R: 9mm select-fire pistol with controlled three-round burst capability.
- FN P90: 5.7x28 PDW with very high cyclic rate and 50-round magazine; treat as high-rate, controllable stream rather than heavy rifle.
- M249 SAW: 5.56 belt-fed automatic weapon; identity is sustained automatic fire, not a scaled-up MAC-10.
- M16A4 family: 5.56 rifle with semi / three-round-burst identity.
- Zbroyar Z-15: AR-15/M16-derived 5.56 semi-auto rifle; the three skin assets are skins, not three unrelated firing mechanisms.
- SPAS-12: dual-mode combat shotgun; gameplay may use a semi-auto identity.
- Smith & Wesson Model 500: very large-caliber revolver; it must not use automatic-pistol casing behavior.
- Snipex Alligator: 14.5mm bolt-action anti-materiel rifle; it owns the strongest single precision-shot identity.
- Pancor Jackhammer: prototype automatic 12-gauge shotgun with revolving cassette; its high-tier identity is automatic shotgun pulses.
- Szecsei & Fuchs: double-barrel bolt-action rifle family; current handgun-like recipe is rejected.

Source URLs for design grounding:
- https://fnherstal.com/app/uploads/technical-data-fn-p90_0.pdf
- https://www.peosoldier.army.mil/Equipment/Equipment-Portfolio/Project-Manager-Soldier-Lethality-Portfolio/M16A4-Rifle/
- https://www.moore.army.mil/infantry/DoctrineSupplement/ATP3-21.8/PDFs/fm3_22x68.pdf
- https://odin.t2com.army.mil/WEG/Asset/Snipex_Alligator_Ukrainian_14.5mm_Sniper_Rifle
- https://us.glock.com/en/products/law-enforcement/pistols/g17
- https://magnumresearch.com/PDF/ST0313.pdf
- https://oag.ca.gov/firearms/certified-firearm/double-barrel-bolt-action-series

## 6. Gun VFX identity

All gun VFX continue to use sanitized existing runtime assets. Do not reopen random VFX sourcing.

The current one-size-per-family treatment must become archetype + per-weapon modifiers.

Minimum distinctions:

- light handgun: small crisp flash, almost no smoke;
- burst/machine pistol: small repeated flash with brief accumulated smoke;
- heavy handgun / revolver: larger flash, stronger shock impulse, short dense smoke;
- compact SMG / PDW: tight repeated flash, thin smoke accumulation;
- assault rifle: medium elongated flash, sharper tracer and stronger impulse;
- LMG: sustained muzzle pulse plus progressive smoke accumulation over the burst;
- pump / semi shotgun: broad flash + smoke bloom;
- sawed-off: shortest, widest flash and strongest close smoke burst;
- auto shotgun: repeated broad flashes with smoke persistence;
- DMR / heavy precision: narrow bright flash and visible aim-to-release snap;
- Snipex: largest focused muzzle event, shockwave and dust/smoke; never a generic SEMI flash.

Use the actual generated per-weapon muzzle anchor from the weapon-set metadata. The current approximate `gunMuzzleDistance()` family heuristic is insufficient when an explicit muzzle coordinate exists.

## 7. Gun SFX identity

Do not reopen random audio sourcing.

Reuse the owner-approved gunfire baselines and existing mechanism cues, but create per-weapon playback recipes from:
- source sample family;
- gain;
- small playback-rate/pitch window;
- low/high frequency emphasis;
- transient amount;
- optional existing mechanism layer.

The same source sample may support multiple weapons, but MAC-10 must not sound identical to M249, and Glock must not read identically to Magnum 500.

Examples:
- light pistol: pistol baseline, crisp / lighter;
- heavy handgun: pistol or precision baseline treatment with lower/heavier body;
- compact auto: automatic baseline, faster/thinner;
- LMG: automatic baseline, heavier/lower with sustained cadence;
- shotgun: shotgun baseline with weapon-specific tail and mechanism;
- precision: sniper baseline with per-weapon mechanism timing;
- Snipex: heaviest precision treatment;
- Jackhammer: shotgun baseline repeated in a distinct 3-pulse cadence.

Weapon SFX owns the firing read. Generic fighter skill sounds must not mask or replace the weapon identity.

## 8. Casing / shell ejection law

The old neat side-ejection pattern is rejected.

Spent cases / hulls should scatter physically **backward and sideways relative to the shot direction**, not draw a tidy repeated trail that reads like footprints.

Hard laws:
- use the generated per-weapon `casing` anchor where available;
- dominant initial velocity points into a broad rear-side cone relative to aim;
- add bounded random angular and speed variation per ejection;
- preserve gravity, spin and floor bounce;
- automatic fire produces a messy fan/cloud, not identical parallel stamps;
- ejection never changes fighter movement;
- revolvers do not eject one casing per shot;
- sawed-off hulls eject on the final break-open finish;
- M249 may add lightweight belt-link debris if the source/asset language supports it;
- casing VFX stays short-lived and subordinate to the weapon/tracer.

## 9. Post-use exit motion

Every gun must have a recognisable physical exit after its final commit.

Priority:
1. weapon-specific mechanism beat;
2. semantic part separation when the source genuinely supports it;
3. whole-body throw/drop/spin when it does not.

No weapon may simply vanish at sequence completion.

Alpha is permitted only at the final ~10–15% cleanup.

Part motion is visual/game animation, not an attempt to teach real firearm disassembly.

## 10. Melee throw speed update

All thrown-melee flight speeds increase slightly.

Tuning authority:
- acceptable window: +10% to +15% from current POST-C values;
- implementation seed: +12%;
- preserve per-weapon ordering and bounce budgets;
- browser feel decides whether the final value stays at 12% or moves within the approved window.

Seed values:
- SABRE: 900 -> ~1010
- BATTLE_AXE: 820 -> ~920
- DAGGER: 1080 -> ~1210
- SPEAR: 950 -> ~1065
- SPIKED_CLUB: 860 -> ~965

Do not compensate by making sprites smaller or collision radii larger.

## 11. Shield architecture — counter pickup, never random loot

`SWIRL_SHIELD` and `TOWER_SHIELD` are removed entirely from the random weapon/rarity pool.

A shield is a guaranteed contextual counter.

### 11.1 Activation conditions

A fighter may receive a shield only when BOTH are true:

1. the pickup slot is still in the hidden TELEGRAPH / unknown state;
2. the opponent currently holds an offensive Arsenal weapon instance.

If the fighter physically reaches that still-hidden slot while both are true:
- normal random reveal is skipped;
- shield probability = 100%;
- the shield type is chosen from the opponent's current threat properties;
- the shield binds to that specific opponent weapon instance / attack transaction.

### 11.2 Preserve the hidden counter opportunity

Current 2-second reveal prediction would normally reveal the slot before physical contact, making the rule impossible in most cases.

Therefore, when:
- an unarmed fighter is on a valid contact trajectory to a TELEGRAPH; and
- the opponent currently holds an offensive weapon;

the slot becomes a temporary `COUNTER_RESERVED` hidden opportunity for that fighter:
- it remains visually unknown;
- normal reveal and force-reveal are suspended while the reservation is valid;
- if the fighter reaches it, resolve the shield;
- if the opponent consumes/loses that weapon, the reserved fighter becomes armed, or the contact trajectory is no longer valid, clear the reservation and restore the normal reveal law.

No permanent reservation. No weapon-seeking AI is introduced.

### 11.3 Threat-to-shield mapping

Use threat properties, not a 50/50 roll.

**SWIRL_SHIELD**
- discrete ballistic / tracer families;
- pistol, SMG, burst, rifle, precision, LMG;
- counters the bound projectile attack transaction.

**TOWER_SHIELD**
- shotgun fan / pellet transaction;
- grenade / explosion;
- direct melee;
- thrown melee;
- other non-reflectable heavy impact.

### 11.4 Shield lifetime

Shield identity is **one counter transaction**, not a generic timed buff.

- On successful counter resolution, shield retracts/exits physically immediately after the transaction ends.
- Swirl may reflect the bullets belonging to the bound burst/volley until that weapon transaction is complete; it must not disappear after bullet 1 of an M249/P90 burst.
- Tower guards the bound shotgun/explosion/melee transaction, then exits.
- If the bound opponent weapon is consumed without producing a valid hit, the shield exits with it and does not carry forward to a later weapon.
- A short internal failsafe timer may exist only to prevent stale state; it is not the primary gameplay duration.

Shield activation remains visually quiet until the actual counter beat. Existing owner-approved block/reflect SFX stays tied to contact.

## 12. Non-negotiable verification for the next implementation

The next Agent pass must prove:

1. every one of the 24 guns is mapped to the matrix above;
2. Z15 base/S1/S2/S3 share one ballistic identity;
3. Szecsei & Fuchs is no longer treated like a handgun;
4. Magnum 500 no longer ejects semiauto casings per shot;
5. M249 has sustained-LMG motion/VFX/casing identity distinct from MAC-10;
6. sawed-off has no pump-rack identity;
7. per-weapon muzzle and casing anchors are actually consumed at runtime;
8. each gun has a physical post-use exit;
9. part-exit animation is used only where a semantic part map is visually verified;
10. rarity tier glow is visible in real browser without text;
11. hidden telegraph leaks no rarity information;
12. tier selection distribution and melee 0.5 intra-tier weight are deterministically tested;
13. both shields are absent from normal random selection;
14. hidden-slot + opponent-armed contact resolves a guaranteed shield;
15. threat mapping selects Swirl vs Tower correctly;
16. a burst shield counters one attack transaction rather than one pellet/bullet only;
17. shield never survives into a later unrelated opponent weapon;
18. melee throw speeds are +10–15% over the previous POST-C baseline;
19. casing scatter is rear-side, varied and physically bounded;
20. real-browser screenshots/video are inspected at normal speed, not only static assertions.

This document is design authority. Implementation may choose internal helper structure, but it may not reinterpret the observable weapon identities above.
