# APEX CHAOS — Wave 2 Gold Authority

Status: **PRODUCT/UX AUTHORITY LOCKED — VISUAL GOLD SOURCE PENDING**
Created from baseline: `arena/01a1025a-apex-chaos @ 63622a42fa235fe2cc60b9f2d14d63fcf65a658a`
Purpose: define the remaining product surfaces before Wave 2 implementation without disturbing the active Wave 1 Gold cutover.

## 0. Hard boundary with Wave 1

This directory is deliberately separate from `docs/gold-ui/current/`.

Wave 1 remains authoritative for:
- Home / navigation Gold shell;
- Free Battle fighter selection represented by the current Gold;
- Lucky Draw;
- Battle HUD, battle-entry transition, KO/fracture/result choreography.

Do not edit, reinterpret, replace, or relabel `docs/gold-ui/current/` from this Wave 2 authority lane.

This Wave 2 lane exists so future surfaces can be designed and accepted while the current implementation is still in progress.

## 1. Two-tier meaning of Gold

A surface is not considered fully Gold merely because a Markdown document exists.

### Tier A — Gold Product/UX Authority
This repository lane locks:
- product purpose;
- information hierarchy;
- state meanings;
- interaction law;
- data ownership;
- audio behavior;
- responsive behavior;
- motion intent;
- accessibility behavior;
- prohibited drift;
- integration boundaries.

These rules are authoritative for future prototype work.

### Tier B — Gold Visual Source
A surface becomes implementation-ready only after an owner-accepted canonical visual source exists, normally a standalone/local HTML/CSS/JS prototype or an equivalent source-preserving artifact.

The visual source must then be:
- stored in this Wave 2 lane;
- hashed/pinned;
- accompanied by an asset/placeholder contract;
- directly reviewable at desktop and mobile reference viewports.

**No agent may invent the final visible UI from these Markdown files alone.**

## 2. Wave 2 surface set

The current authority set covers:
- Profile / Account — player record + save security.
- Fighter Shop — deterministic roster acquisition; internal fantasy: Fighter Registry.
- Upgrade — mastery + Story-only adaptation philosophy; internal fantasy: Fighter Calibration.
- Missions — finite combat objectives; internal fantasy: Operations Console.
- Dictionary — canonical gameplay knowledge; internal fantasy: Combat Archive.
- Settings — lightweight global service overlay.
- Result / Post-match — semantic extension to the existing Gold Battle result choreography, not a separate route.
- Story / Quest — placeholder authority only; intentionally undesigned until real quest/story data exists.

Achievements are **not** a separate Home destination in the target information architecture. They belong under Profile -> Record.

## 3. Product identity law

Every major surface must feel like it belongs to the same APEX CHAOS world while remaining functionally distinct.

Reuse the established Gold language:
- industrial/salvage materials;
- mechanical relief and depth;
- rails, plates, apertures, embedded displays;
- deliberate asymmetry;
- strong typography hierarchy;
- restrained data accents;
- authored physical motion rather than generic web transitions.

Do not force every surface into the same room, same card grid, or same choreography.

The emotional roles are different:
- Battle: highest intensity.
- Lucky Draw: high uncertainty / spectacle.
- Story: future, high cinematic potential.
- Pick: high identity / anticipation.
- Home: ambient world hub.
- Shop: deliberate acquisition / control.
- Upgrade: precision / calibration.
- Missions: readable operations / objectives.
- Dictionary: quiet technical knowledge.
- Profile: quiet personal record.
- Settings: service utility only.

## 4. Scope law

Do not invent systems just to fill UI.

Wave 2 currently does **not** authorize:
- battle pass;
- login streak;
- Daily/Weekly live-service cadence;
- clan/guild/social graph;
- ranked ladder;
- stamina/energy economy;
- premium currency;
- fighter rarity taxonomy;
- generic stat-upgrade trees;
- a new mission currency;
- a new upgrade currency;
- replay/history infrastructure;
- lore/world archive content not supported by production story data;
- account-provider-specific SDK coupling.

## 5. Current game anchors

Future surfaces must remain compatible with the game that exists:
- Core Six initial playable focus: ROBOT/NEWBOT, HUNTER, CRYSTAL/CRYSTALA, MAGNET, ICE/FROST, MIRROR.
- Arsenal floor-firearm loop.
- BOT Battle and Local 1v1 product modes.
- Current AC economy.
- Current no-duplicate Lucky Draw semantics.
- Current local persistent state in `apexChaos.arsenalMeta.v1`.
- Existing Gold Home/Pick/Battle/Lucky Draw authority.
- Existing hero mechanic authority; UI never redefines mechanics.

## 6. Promotion rule

A future surface progresses:

`SPEC LOCKED`
-> `VISUAL PROTOTYPE`
-> owner review
-> `GOLD VISUAL ACCEPTED`
-> source/hash/asset contract
-> implementation prompt
-> production parity proof
-> release.

Do not skip directly from concept text to production code.

See:
- `manifests/WAVE2_ANTI_DRIFT_CONTRACT.md`
- `manifests/VISUAL_PROMOTION_GATE.md`
- `manifests/SURFACE_GRAPH_AND_STATUS.md`
- individual surface authorities under `surfaces/`.
