# APEX CHAOS — Dictionary / Combat Archive Gold Product Authority

Status: PRODUCT/UX LOCKED — VISUAL GOLD PENDING.

## Purpose

Dictionary is the canonical player-facing place to understand how current gameplay works.

It is not:
- a collection book;
- a lore encyclopedia;
- a Store;
- a mastery screen;
- a second Fighter Pick.

## Surface identity

Home label may remain **DICTIONARY** for clarity.

Internal visual identity: **COMBAT ARCHIVE**.

A quiet technical archive terminal in the APEX CHAOS material language.

## V1 sections

Exactly:
- FIGHTERS
- ARSENAL
- COMBAT

Do not add World/Lore, Locations, Enemies or collectible completion categories until real production content exists.

## Fighter knowledge

All released/production fighter mechanics should be readable regardless of ownership.

Knowledge is not an economic entitlement.

Initial focus: the production Core Six.

Entry hierarchy:
1. identity / short role description if grounded;
2. Core Loop;
3. Passive / A1 / A2;
4. short Tactical Note.

Do not invent subjective stat pentagons/classes/rarity merely for visual richness.

## Mechanical fact law

Archive mechanical facts must derive from canonical runtime/config/registry authority where possible.

Editorial explanatory copy is separate from numeric/mechanical truth.

Do not duplicate values into prose when they can drift.

Examples of facts requiring careful canonical projection:
- Magnet A1 exact force-window semantics;
- Frost movement modifiers and Frozen Gun rules;
- Hunter trap/disarm;
- Robot rolling-burst current-cooldown behavior;
- Mirror player-facing projectile/reflection semantics.

Do not expose implementation algorithms that do not help player decisions.

## Arsenal

Use real production weapon entries only.

Explain:
- behavioral identity;
- firing/use pattern;
- special property;
- relevant interactions.

Do not expose raw internal tuning multipliers when they are not meaningful player-facing values.

Do not invent Epic/Legendary/Mythic labels.

## Combat Systems

Only real concepts worth learning, for example when canonical:
- Critical;
- Heal;
- Freeze/Frozen;
- Disarm;
- Ice Terrain;
- Heavy response semantics;
- Stormbreaker-specific interaction where appropriate.

Do not mislabel presentation-only Heavy/Thunder as status effects if they are not gameplay statuses.

## Discovery / locks

Do not lock basic combat rules behind fighter ownership.

No Archive completion percentage in V1.

No unread-entry notification debt.

## Cross-surface links

Pick and Shop may deep-link to a relevant Archive entry.

Back must return to the prior state without resetting selection.

Do not open Archive during active Battle.

## Assets

Reuse:
- fighter avatar/cover;
- skill icons;
- actual weapon art/icon;
- simple procedural diagrams.

Do not create a mandatory illustration pipeline unique to Dictionary.

## Motion

Reading-first:
- short scan/crossfade/settle;
- no giant hero entrance;
- no full-screen elemental VFX.

## Audio

Theme continues from Home with the same playhead.

Small terminal interaction SFX only.

## Data boundary

Conceptual projection:
`CombatArchive <- HeroRegistry + ArsenalRegistry + CombatDefinitions + editorial copy`.

Archive is a consumer of mechanic authority, never a second mechanic database.

## Prohibited drift

No lore filling.
No collection gamification.
No AC reward for reading.
No search bar until content scale justifies it.
No manually copied stale mechanic numbers.
