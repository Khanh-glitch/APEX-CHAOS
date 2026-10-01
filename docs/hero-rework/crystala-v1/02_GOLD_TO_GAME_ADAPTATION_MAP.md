# CRYSTALA V1 — GOLD TO REAL GAME ADAPTATION MAP

Purpose: preserve the exact approved Gold appearance/choreography while mapping its old standalone demo semantics onto the new production mechanic.

## A. Gold is copied, not imitated
The executable reference contains the authored source itself. Port/reuse its algorithms and procedural art faithfully. Do not screenshot it, trace it into a simpler sprite, or replace it with “similar” particles.

Gold systems to preserve:
- body/face/crown procedural art;
- six individual Stone shapes/roles;
- spring-damper orbit + inertial lag;
- elliptical slots and dynamic redistribution;
- Hermite travel/return preserving endpoint tangents;
- pooled Ancient Dust;
- bounded debris;
- authored emissive half-resolution bloom;
- crystal facet shading;
- internal-light refract path clipped inside gem;
- Wall 13-cell dense material, growth fronts, seam lock, stress/cracks/support failure;
- Prison six sides reusing the same dense material language;
- back/front depth layering.

## B. Demo semantics that must NOT cross into production
Reject these Gold-only gameplay facts:
- J means Wall;
- K means Prison;
- P means passive intercept;
- singleton passive intercept controller;
- fake foe/projectile/damage/arena;
- Gold demo Wall per-cell HP / life;
- Gold demo Prison life/radius/root/foe.locked;
- Gold target correction/homing of reflected ray;
- manual click/arrow movement/camera controls;
- demo collision radii.

Production 00 authority owns those.

## C. Shards
Gold `Stone` object is the visual engine. Production adapter supplies semantic state:
- ORBIT -> Gold spring follower;
- RESERVED/PREPARE -> immediate visible facet/energy anticipation while still near slot;
- OUTBOUND -> Gold Hermite launch to predicted 180px intercept point;
- REFRACT -> Gold facet indexing + clipped internal-light path;
- RECOIL/RETURN -> Gold momentum kick + Hermite/banking rejoin;
- CONSTRUCT_TRAVEL/ANCHORED -> Gold wall/prison authored choreography.

Do not create a parallel fake set of six presentation stones disconnected from gameplay availability. There is one semantic six-shard set whose positions/visual states are presentation-driven.

## D. K smart guardian fit
Gold old `tryPassive/passiveStep` is useful as choreography/reference, not targeting truth.

KEEP:
- best reachable stone concept;
- real facet indexing;
- travel-cost/orientation scoring concepts;
- real stone-projectile contact;
- internal light dwell;
- geometric outgoing reflection;
- recoil/return motion.

REPLACE:
- Gold's broad future-time scan -> 00 smart real-hit predictor;
- singleton PASS.active -> multi-shard independent assignments;
- Gold 205-ish demo target radius -> 180px production intercept band;
- Gold fake foe correction on outgoing ray -> pure game-authoritative geometry;
- Gold fake kind/frozen/life state -> real APEX projectile state/provenance.

## E. Wall fit
Gold Wall visual uses BLADE pair. Production J must be able to select any 2 AVAILABLE shards.

Keep the wall endpoint choreography and assign the two selected real shard visuals to those endpoints by minimum total travel. Their silhouette identities remain unchanged.

Gold cell HP/stress is presentation-only:
- real Wall owns HP120;
- each real hit sends contact point, damage and HP fraction to presentation;
- presentation chooses nearby cell(s), cracks/chips/stress and support cascade;
- visual support cascade never subtracts additional real HP.

Raw Gold build phases are compressed proportionally to ~0.75s to solid. Do not remove phases.

Final hit order: reflect/block projectile -> apply structural damage -> if HP<=0 trigger Gold break -> shards return.

## F. Prison fit
All 6 real AVAILABLE shards use Gold angular/min-travel vertex assignment.

Keep Gold burst/encircle/index/nucleate/chain-grow/last-gap/closure grammar.

Production target motion:
- early encircle may translate cage center with target to avoid obvious stale telegraph;
- at NUCLEATE/material birth freeze center;
- after freeze, target movement interacts with real forming walls; cage never chases.

Each facet has one real HP75 pool while retaining its multi-cell visual material. Breaking a facet disables its physical edge and triggers that side's Gold break grammar. No invisible closure across a missing side.

## G. Reflection visual vs damage truth
Presentation consumes real contact and velocity:
- incoming p position/velocity;
- selected shard/facet;
- real outgoing reflected velocity;
- real critical/provenance;
- real structure hit state.

Gold owns the visible internal refraction path and recoil. Gameplay runtime owns damage multiplier, ownership, collision, mitigation and one-reflection law.

## H. Timing mapping
Frozen gameplay:
- K 8.0 / 2.4;
- J 1.5;
- contact band 180;
- scan 1000;
- contact->dock 1.20 target.

Gold motion is retimed only where needed to fit those windows:
- guardian reservation begins just-in-time from reachability, not 1000px;
- construct pre-solid phases compressed to ~0.75s;
- curves/path geometry preserved;
- return path adjusted in speed/phase duration to land visibly at the gameplay availability frame.

## I. Chamber / render mapping
Follow Hunter's proven split:
- body source alone enters Chamber `actorRender` once;
- orbiting shards that define the hero silhouette may be included with the actor source only if doing so still preserves one source render and does not pull world FX/status into it;
- construct world layers, dust, trails, refract FX remain direct world FX;
- do not modify Chamber runtime;
- do not draw equipped weapon from Crystala body;
- no per-frame canvas creation.

## J. Required parity observations
Before claiming Gold parity, compare production against the standalone reference for:
1. dormant body + six shard silhouette;
2. awake light-state transition;
3. one intercept outbound/facet/refraction/recoil/return;
4. Wall peel/sweep/anchor/growth/zip-lock;
5. Wall damage/crack/support failure;
6. Prison burst/encircle/chain growth/last gap/closure;
7. construct break/return;
8. dust restraint/bloom/dark-face readability;
9. battle-size—not only close-up—readability.

A mechanically correct but visibly simplified result is a failed port.
