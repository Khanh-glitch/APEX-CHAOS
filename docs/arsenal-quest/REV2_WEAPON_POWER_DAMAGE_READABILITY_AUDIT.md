# APEX CHAOS // REVISION 2 WEAPON POWER & DAMAGE READABILITY AUDIT

**Date:** 2026-09-25  
**Gameplay baseline:** Revision 2 accepted implementation `20685328a215257de2e12317c85f895ef11c6ce0` / evidence `2113e92c42739eeb568794117a19526aa4a4725d`  
**Status:** BALANCE OBSERVATION ONLY — DO NOT REBALANCE YET

All values below are read from the live Revision 2 identity/config after overrides.

## Tier probabilities

- T1 Common: 30%
- T2 Uncommon: 30%
- T3 Rare: 23%
- T4 Epic: 12%
- T5 Legendary: 5%

Within a rolled tier:
- gun / grenade raw weight = 1.0
- melee raw weight = 0.5

Match HP = 100, so 20 full-connect damage equals 20% of a fresh fighter's HP.

## Current offensive power table

| Tier | Weapon | Pattern | Per-hit / pellet | Count | Full-connect max |
|---|---|---|---:|---:|---:|
| T1 | PISTOL / Colt | semi | 4.5 | 3 | 13.5 |
| T1 | GLOCK_17 | semi | 3.5 | 4 | 14.0 |
| T1 | TEC_9 | fast semi | 3.0 | 5 | 15.0 |
| T1 | MAC_10 | auto | 2.0 | 8 | 16.0 |
| T1 | DAGGER | melee | 13.5 | 1 | 13.5 |
| T2 | BERETTA_93R | 3 + pause + 3 | 3.0 | 6 | 18.0 |
| T2 | SMG / MP5 | auto | 2.25 | 8 | 18.0 |
| T2 | P90 | auto | 1.9 | 10 | 19.0 |
| T2 | ZBROYAR_Z15 | semi | 4.75 | 4 | 19.0 |
| T2 | ZBROYAR_Z15_S1 | same Z15 ballistics | 4.75 | 4 | 19.0 |
| T2 | ZBROYAR_Z15_S2 | same Z15 ballistics | 4.75 | 4 | 19.0 |
| T2 | ZBROYAR_Z15_S3 | same Z15 ballistics | 4.75 | 4 | 19.0 |
| T2 | MOSSBERG_500 | shotgun | 2.8 | 7 pellets | 19.6 |
| T2 | SABRE | melee | 18.0 | 1 | 18.0 |
| T3 | DESERT_DEAGLE | heavy semi | 10.5 | 2 | 21.0 |
| T3 | AK_47 | auto | 3.8 | 6 | 22.8 |
| T3 | M16 | 3 + pause + 3 | 3.6 | 6 | 21.6 |
| T3 | MBR | precision | 11.0 | 2 | 22.0 |
| T3 | SHOTGUN / SPAS12 | 2 shotgun pulses | 2.0 | 12 pellets total | 24.0 |
| T3 | SAWED_OFF | shotgun | 2.45 | 10 pellets | 24.5 |
| T3 | SPEAR | melee | 22.5 | 1 | 22.5 |
| T3 | GRENADE | explosion | max 20.0 | 1 | 20.0 max center |
| T4 | MAGNUM_500 | revolver | 28.0 | 1 | 28.0 |
| T4 | M249_SAW | sustained auto | 2.5 | 12 | 30.0 |
| T4 | MBR2 | precision | 14.0 | 2 | 28.0 |
| T4 | SZECSEI_FUCHS | heavy precision | 15.0 | 2 | 30.0 |
| T4 | SPIKED_CLUB | melee | 27.0 | 1 | 27.0 |
| T5 | SNIPER / Snipex | precision | 38.0 | 1 | 38.0 |
| T5 | JACKHAMMER | 3 auto-shot pulses | 2.4 | 15 pellets total | 36.0 |
| T5 | BATTLE_AXE | melee | 39.0 | 1 | 39.0 |

## Why the arsenal currently feels compressed

The full-connect bands are intentionally narrow:

- T1: 13.5–16
- T2: 18–19.6
- T3: 20–24.5
- T4: 27–30
- T5: 36–39

Within a tier, raw damage is therefore not intended to be the primary identity. Identity currently comes from:
- delivery speed;
- spread / hit reliability;
- range;
- knockback / stun;
- aim commitment;
- projectile count;
- melee all-or-nothing risk;
- grenade area damage;
- post-use presentation.

Without visible damage feedback, many of these weapons can feel more similar than the underlying numbers are.

## Important interpretation

The table is **theoretical full-connect damage**, not expected realized damage.

Examples:
- shotgun full-connect totals require all pellets to hit;
- automatic weapons lose realized damage through spread/movement;
- grenade reaches 20 only near the center of the blast;
- melee is all-or-nothing and depends on range/throw collision;
- precision weapons have aim/second-shot commitment.

Therefore do not rebalance purely from the totals.

## Recommended next balance measurement

Before changing damage:
1. implement efficient damage-number readability;
2. add per-pickup realized damage telemetry:
   - weapon id;
   - tier;
   - shots/pellets fired;
   - hits;
   - realized damage before consume;
   - time from pickup to consume;
3. collect owner-playtest samples;
4. compare realized median/percentile damage by tier and weapon.

Only then decide whether the tier envelopes need wider separation.

## Damage-number presentation direction

Owner feedback now explicitly authorizes numeric damage readability inside the battlefield.

This should be treated as a narrow exception to the previous zero-battlefield-typography law:
- numeric damage glyphs are allowed;
- no weapon names, rarity words, explanatory labels, or prose inside the battlefield.

The implementation should NOT revive the legacy `FloatingText` renderer.

Use a separate bounded/poolable damage-popup layer, preferably atlas-based.

High-rate attacks should aggregate to avoid visual/performance spam:
- shotgun: one transaction total or compact total + xN;
- automatic burst: merge hits to the same target inside a short ~80–140 ms window;
- single heavy shots / melee / grenade: one immediate popup.

Candidate asset research:
- Template Foundry Combat Feedback Pack – composable 0–9 glyphs, symbols, PNG sheets, SVG, animation strips, web notes:
  https://mtw1man2.itch.io/combat-feedback-pack-damage-numbers-crit-popups-status-icons
- Template Foundry Hit Impact Feedback Pack – hit sparks/rings/overlays/SVG/PNG/WAV:
  https://mtw1man2.itch.io/hit-impact-feedback-pack-sparks-slash-fx-combat-polish
- Non-AI pixel alternative: Gilligan89 Combat HUD & Damage Numbers:
  https://gilligan89.itch.io/combat-hud-damage-numbers

Current recommendation for APEX CHAOS: use the first pack's clean composable glyph atlas as the primary number language. Evaluate its impact-strip assets selectively; do not stack a second full VFX language on top of the existing curated Arsenal impact VFX.
