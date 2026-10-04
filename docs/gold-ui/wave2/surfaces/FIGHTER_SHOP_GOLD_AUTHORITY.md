# APEX CHAOS — Fighter Shop Gold Product Authority

Status: PRODUCT/UX LOCKED — VISUAL GOLD PENDING — PUBLIC SURFACE REMAINS LOCKED UNTIL READY.

## Core product distinction

Fighter Shop = **certainty / deliberate acquisition**.
Lucky Draw = **chance / uncertainty**.

If the Shop looks or behaves like a second gacha, it fails.

## World/system identity

Player-facing Home label may remain **FIGHTER SHOP** for clarity.

Internal visual fantasy: **FIGHTER REGISTRY / acquisition terminal**.

Do not imply fighters are prisoners, merchandise bodies, or owned as lore objects. The system grants roster access; it does not define the story meaning of the characters.

## Primary responsibilities

Only:
1. show roster access state;
2. show which fighters are acquirable;
3. communicate a fighter's gameplay identity briefly;
4. perform a deliberate purchase safely;
5. reflect canonical ownership/economy after success.

## Layout hierarchy

A future accepted prototype should contain three semantic territories:
- Registry Rail / roster index.
- Selected Fighter Record / inspection projection.
- Acquisition Control.

Do not turn these into a generic store card grid.

## Fighter states

Required model:
- OWNED
- AVAILABLE
- REQUIREMENT_LOCKED
- CLASSIFIED
- DISABLED/temporarily unavailable where operationally necessary

Requirement Locked and Classified must look meaningfully different.

Avoid giant generic padlock icons as the primary identity.

## Fighter knowledge

Shop gives a compressed combat identity:
- one-line core identity;
- passive/A1/A2 icon access with short summaries if useful.

Full mechanic documentation belongs to Dictionary.

Do not duplicate the Fighter Pick or Dictionary information density.

## Transaction

Price is data-driven. Current 1000 AC is runtime/economy data, not a permanent visual constant.

Preferred deliberate confirmation:
- hold-to-authorize around 500–700 ms on pointer/touch, OR
- accessible two-step confirmation fallback.

Before commitment, show current/cost/remaining when useful.

On submit:
- disable duplicate submission;
- show AUTHORIZING;
- only run ownership-success choreography after canonical transaction success.

Server/public economy later requires idempotent purchase receipt/request semantics.

## Success choreography

Emotion: authorization / registration, not surprise.

Suggested semantic order:
1. transaction accepted;
2. registry marker changes AVAILABLE -> REGISTERED/OWNED;
3. selected record receives ownership mark;
4. balance reflects canonical state;
5. short fighter identity pulse;
6. CTA can become USE IN FREE BATTLE.

Do not use a 5-second gacha reveal or giant “UNLOCKED!” mobile-game splash.

## Insufficient AC

Show the state in acquisition control.

Do not funnel the player to Lucky Draw or a currency purchase screen.

No “best value,” “hot,” “popular,” “meta,” rarity merchandising.

## Roster scale

Dynamic roster; no 3x2 Core Six hard-lock.

## Mirror

Shop must not depend on Mirror's opponent-derived Pick large-pose treatment.
Use reusable avatar/cover/registry representation.

## Assets

Prefer reuse:
- cover art;
- avatar;
- passive/A1/A2 icons.

Do not create a mandatory new full Shop artwork pipeline per fighter.

## Audio

Home theme fades/suppresses while Shop is active, preserving playhead.

V1 may use industrial ambience/SFX rather than requiring a dedicated Shop music track.

## Data boundary

Reads:
- profile ownership;
- product availability;
- price/offer;
- wallet projection.

Purchase goes through EconomyAuthority/adaptor once cloud economy exists.

Visual source must never mutate localStorage or wallet directly.

## Prohibited drift

No:
- fighter cages as canonical lore;
- gacha-like mystery;
- generic storefront cards;
- invented rarity;
- stat pay-to-win display;
- currency upsell funnel;
- hardcoded 1000 in visual authority;
- full Dictionary text dump.
