# APEX CHAOS — Upgrade Gold Product Authority

Status: PHILOSOPHY/UX LOCKED — VISUAL GOLD PENDING — PUBLIC SURFACE REMAINS LOCKED.

## First principle

APEX CHAOS Upgrade must **not** create permanent raw-power advantage in Free Battle.

A Mastery 20 fighter and Mastery 1 fighter use the same base Free Battle combat specification.

Do not modify through account progression:
- HP;
- damage;
- base movement;
- crit;
- authored freeze chance;
- core geometry;
- authored force windows;
- cooldowns

unless a future game-design authority explicitly changes this law.

## Why the surface exists

Upgrade answers:
**How much experience/progression do I have with a fighter, and what non-Free-Battle adaptations have I earned?**

It does not answer:
- who do I own? -> Shop/Profile;
- how does the base skill work? -> Dictionary;
- who do I pick now? -> Pick.

## Surface identity

Home label: **UPGRADE**.

Internal visual identity: **FIGHTER CALIBRATION**.

Fantasy: precision/analysis/tuning of a combat profile, without claiming every living fighter is physically repaired on a machine.

## V1: Mastery

Mastery grows through real fighter usage/progression rules.

Mastery itself does not change Free Battle stats.

Do not sell Mastery level for AC.

Do not invent a new shard/core/dust currency merely to make the screen look like an RPG.

## Mastery rewards

Allowed families when content exists:
- fighter record/lore fragments grounded in accepted story;
- profile cosmetic identity;
- non-power cosmetic accent;
- eligibility for future Story adaptation;
- advanced training/knowledge.

Not every level needs a reward.

Avoid claim chores for every level.

Meaningful milestones may require a short CALIBRATE/ACTIVATE interaction.

## Story Augments

Concept is reserved but **must not be authored before Story encounter/enemy needs exist**.

If/when created:
- Story-only;
- small loadout, initially one slot;
- authored tactical alternatives, not a giant tree;
- preserve fighter core identity;
- prefer situational option/tradeoff to linear +20% efficiency.

No current UI should fabricate augment names/effects.

## Free Battle isolation

Required invariant:
`baseHeroSpec` only.

Mastery/Story adaptation must not leak into Free Battle.

This deserves an automated regression gate when the system exists.

## Fighter list

Only owned fighters appear in Upgrade.

Do not show locked fighter rows as cross-sell.

## Visual hierarchy

Future prototype:
- owned fighter rail;
- central calibration field;
- mastery spine / progression instrument;
- contextual Passive/A1/A2 projection only when relevant to progression;
- Story adaptation area hidden/locked only if real future data warrants it.

Avoid a giant RPG skill tree.

## Audio

Theme suppressed while Upgrade is active, preserving playhead.

V1 can use restrained diagnostic/mechanical ambience/SFX.

## Data boundary

Mastery is a distinct progression domain, not an extension of `ownedFighters[]`.

Conceptual future model:
- fighterId;
- masteryXp;
- masteryLevel;
- activated milestones;
- story augment loadout when real.

## Prohibited drift

No:
- +HP/+DMG/-cooldown ladders in Free Battle;
- 50-node skill tree;
- new upgrade currency without game-design need;
- locked-fighter sales funnel;
- invented Story augments before Story problems exist;
- calibration visuals that rewrite hero mechanics.
