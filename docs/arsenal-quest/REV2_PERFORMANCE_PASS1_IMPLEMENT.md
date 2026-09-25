# APEX CHAOS // REVISION 2 PERFORMANCE PASS 1 IMPLEMENTATION AUTHORITY

**Date:** 2026-09-25  
**Work branch:** `arena/01a0cf5e-apex-chaos`  
**Accepted playtest baseline:** `2113e92c42739eeb568794117a19526aa4a4725d`  
**Performance research authority:** `docs/arsenal-quest/REV2_PERFORMANCE_LAG_AUDIT.md`

This pass is deliberately limited to low-risk runtime waste removal. It must preserve current gameplay, visual identity, spawn law, weapon behavior, rarity semantics, audio, melee, shotgun travel, Quest V1, and all accepted Revision 2 tests.

## Scope

Implement only these four items:

### P1. Cache the static Chamber 01 background

Current `drawChamber01()` rebuilds the full static arena every frame.

Required:
- render the static chamber once into an `OffscreenCanvas` when supported;
- use an ordinary in-memory `<canvas>` fallback otherwise;
- cache key must include arena size;
- invalidate/rebuild only when the arena size changes or cache is explicitly reset;
- runtime frame path draws the cached surface with one `drawImage()`;
- pickup slots remain dynamic and must continue drawing after the chamber surface;
- no visual simplification.

### P2. Remove invisible Arsenal floating-text lifecycle cost

Battlefield typography is forbidden in Arsenal and the canvas glyph methods are muted during base draw, yet native kits still populate `floatingTexts`.

Required for Arsenal only:
- do not update/draw legacy battlefield FloatingText instances that cannot be seen;
- clear/sink legacy floatingTexts each Arsenal tick before presentation;
- do not affect DOM HUD, Quest Map, result actions, cooldown HUD, debug DOM, or any other mode;
- do not change damage/gameplay because of this suppression;
- do not build the upcoming damage-number feature on this legacy text path. Future damage numbers must use a separate bounded/poolable presentation layer.

If preventing allocation entirely would require invasive fighter rewrites, do NOT widen this pass. Removing the invisible lifecycle/render cost is sufficient for Pass 1.

### P3. Diff + throttle Arsenal DOM HUD

Current `syncDomHud()` performs DOM lookups and writes every rendered frame.

Required:
- cache relevant DOM references when created;
- cache last rendered strings/state;
- write `textContent`, `innerHTML`, style, and visibility only when changed;
- cooldown HUD refresh target: 10 Hz maximum while a match is running;
- F3/debug DOM refresh target: 5–10 Hz;
- winner/result UI updates on state transition, not every frame;
- HP bars continue through the existing engine HUD path;
- gameplay timing remains frame-rate independent and must never depend on HUD refresh cadence.

### P4. Add Arsenal performance breakdown instrumentation

Extend diagnostics without making production frames materially heavier.

Expose a stable debug API such as:
`window.apexArsenalPerfSummary()`

Minimum rolling sections:
- total Arsenal frame/update sample;
- simulation;
- chamber draw;
- pickup draw;
- foreground / equipped + detached weapon presentation;
- Arsenal VFX draw;
- DOM HUD sync.

Live/peak counts:
- active slots;
- AQ projectiles;
- total projectiles;
- particles;
- floatingTexts;
- shockwaves;
- Arsenal VFX;
- detached weapons.

Also surface the existing global:
`window.apexPerfSummary()`

Do not use console logging every frame.

## Required benchmark scenarios

Run the same browser environment before/after where possible:

1. **Idle:** 30 s Arsenal match.
2. **Pickup pressure:** 8 revealed pickups including a T5.
3. **Automatic stress:** M249 or P90 transaction with casing/VFX.
4. **Control stage:** Quest opponent BLACK_HOLE, TIME, or KUNGFU.

Record:
- global frame avg/p95/max/slowFrames;
- longTasks count;
- Arsenal section timings/count peaks.

CI/browser noise means a single FPS number is not proof. Look for repeated reduction in the targeted section costs and no regression in frame p95.

## Acceptance

- chamber cache is actually reused on successive frames;
- no static chamber gradients/grid paths are recreated every frame;
- floatingTexts remain effectively zero during Arsenal visual lifecycle;
- no other mode loses its floating text;
- cooldown HUD still visibly updates at 0.1 s granularity;
- Quest result buttons still react immediately;
- F3 still works;
- all existing headless/browser gates remain green;
- Vite build green;
- no gameplay constants changed.

## Explicit non-scope

Do NOT:
- cap FPS;
- lower particle counts yet;
- pool particles yet;
- remove VFX;
- alter rarity glow yet;
- change weapon balance;
- change damage;
- add damage numbers in this pass;
- touch `playtest/arsenal`;
- touch `main`.

Damage-number readability is being researched separately and will use a dedicated efficient renderer after the visual asset choice is frozen.
