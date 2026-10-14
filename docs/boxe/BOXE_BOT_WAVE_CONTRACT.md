# BOXE / BOT WAVE — Draft feature authority (not yet approved)

## Two incompatible combat policies, one presentation/FX source
1. **BOXE 1v1 / BOT Battle** uses existing 1000 HP, weapon pickup/fire authority, equipment ownership, enemy stun/disarm and current product state graph.
2. **BOT WAVE** is a separate arena mode (landscape optimized) with manually controlled BOXE, progressive waves, four-edge enemy spawns, XP, tiered skill unlocks and bosses. No automatic inheritance of 1v1 combat constraints.

## BOXE canonical fighter contract
- Product name `BOXE — The Fist of Dawn`; registry key proposed `BOXE`, pending current storage/roster gate inspection.
- Passive: shared progress from QUALIFIED real damage dealt + received; 300 reaches empowered state (3 sec), then progress reset AFTER empowerment ends. During empowerment both A1/A2 upgraded and cooldown timers drain at x2 real-time. No stacking or permanent boosts.
- A1: Fist Rocket (15s CD), right flying glove lasts five real seconds before returning, wall/fighter-like collision responses; opponent hit => 0.5s stun + disarm; may secure **one floor weapon** and transfer on completed catch. Equip must not interrupt active firing; queue and equip at valid fire-cycle boundary. One physical glove entity, one weapon payload.
- A1 empowered: on successful rocket opponent hit, detached gloves execute 2-second dual-fist flurry at contact area; 85ms attack spacing, 42.5ms stun on EACH successful valid hit, effect events anchored to actual impact; BOXE body remains where it is. Preserve 2s duration whether target moves (targeting policy undecided).
- A2: Block and Hit (20s CD); 1s counter window intercepts opponent-owned incoming HP damage, rejects damage once and triggers one charge to lunge to opponent, stun 2s + disarm. No free retaliation without a qualified attack.
- A2 empowered: after confirmed counter contact, append one Gold key-3 finisher dealing 10% of OPPONENT'S **remaining** HP (after preceding hit). Damage % must be one authoritative damage event; no silent rounding or recursion.
- Public conventional battle kit = passive, A1, A2 only; source keys 4–8, 0 NOT activated in normal modes.
- Render cloth physics disabled in derived hero, not source Gold; all other Gold FX families preserved with exact compatible timing.

## BOT WAVE contract
- Own `BOT_WAVE` route and match state, portrait device rotated/landscape treatment to decide, mobile controls must be reachable.
- Input: `J` basic punch; upgradable final basic combo hit #1 Gold key-1, then #2 Gold key-3. `K` defend/counter Gold key-9, `L` dash, `U` Gold key-5 upgrade #4, `I` Gold key-0. Existing skill #3 in upgrade ordering NOT assigned yet (user listed [1],[2],[3] next to Counter? Verify: [3] for K).
- Arena retains boxing-ring feel but changes palette and aspect, removes debug lines, replaces center mark with approved favicon, removes training dummies, keeps robot enemies.
- Wave Director separate from Lab, enemy archetypes and spawn curves registered through data, XP emitted from real kills, level offers tiered declarative upgrade choices with no duplicate/regrants or infinite scaling from bugs.
- Gamefeel source: original Gold material/fractures/rubble, fire, lightning, smoke, ghost fists, heat shimmer, hitstop, screenshake, camera compression and sound hooks.
- Exactly-once kill/XP and deterministic seeded QA; performance budget at high spawn counts, adaptive visual sampling only if Gold layering stays intact.

## Open owner contracts — BLOCKERS BEFORE BALANCE / PUBLIC ROUTE
1. BOXE A1/A2 base **damage amounts** (not specified in request). Do not copy Gold training damage without owner permission.
2. Whether BOXE wave mode is the sole playable fighter and whether it uses 1v1 1000 HP.
3. Upgrade offer cadence, tier rules and whether skills K/U/I are available at run start versus locked.
4. Mobile input scheme (landscape touch joystick + action buttons recommended; avoid pretending a mobile keyboard exists).
5. A1 5s fist: allowed repeated target contacts and projectile collision geometry; weapon pickup vs hit priority and multi-hit stun safety.
6. Avatar cloth question: remove only simulated ribbons (safe default) or also redraw apparel inside sprite (new art asset approval required).

All open decisions must be explicit; nothing is balance-authoritative until owner signs off.
