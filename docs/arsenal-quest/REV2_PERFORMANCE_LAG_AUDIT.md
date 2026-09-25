# APEX CHAOS // REVISION 2 PERFORMANCE & LAG AUDIT

**Date:** 2026-09-25  
**Audited playtest/evidence tip:** `2113e92c42739eeb568794117a19526aa4a4725d`  
**Scope:** Arsenal Quest / Revision 2 runtime performance only  
**Status:** RESEARCH / DIAGNOSIS — DO NOT APPLY BLIND OPTIMIZATIONS YET

The objective is to remove frame jank while preserving current gameplay, scale, VFX language, audio identity, spawn cadence, weapon travel, melee behavior and Quest UX.

## 1. Existing performance instrumentation already available

The application already loads `src/game/performanceMetrics.js` and exposes:

- `window.apexPerfReport()`
- `window.apexPerfSummary()`

It records:
- rolling frame durations;
- average/p95/max frame time;
- estimated FPS;
- frames above 20 ms;
- Long Tasks via `PerformanceObserver`.

This should be used before and after every optimization pass.

## 2. Highest-confidence hotspots found in the audited code

### P0-A — Arsenal chamber background is rebuilt every frame

`public/game/modes/arsenalQuestRuntime.js::drawChamber01()`

Every frame it currently:
- creates a radial gradient;
- fills the entire arena;
- redraws static grid lines;
- redraws wall ticks;
- redraws center marks;
- redraws industrial wall panels;
- redraws corner vent slats.

The chamber is visually static.

**Recommended fix:** render Chamber 01 once into an OffscreenCanvas / cached canvas surface and use a single `drawImage()` per frame.

This should not alter appearance.

### P0-B — rarity under-light recreates blur + radial gradients per pickup per frame

`public/game/arsenal/arsenalSpawnRuntime.js`

Every visible rarity pickup can call:
- `createRadialGradient()`;
- multiple color stops;
- `shadowBlur`;
- ellipse fill;
- an extra gradient for Legendary shimmer.

With up to several active revealed pickups this compounds every frame.

**Recommended fix:** pre-render/cache rarity under-light sprites.

Suggested cache:
- T1–T5;
- 6–8 quantized pulse frames per tier;
- optional Legendary shimmer layer.

At runtime:
- choose nearest pulse frame;
- one `drawImage()`;
- retain the same visible size, color and pulse.

Do not remove rarity glow.

### P0-C — battlefield floating text is visually forbidden but still costs CPU/render work

Revision authority mutes typography inside the Arsenal battlefield by replacing canvas `fillText/strokeText` with no-op functions while `baseDraw()` runs.

However:
- native fighter logic still creates `FloatingText` objects;
- those objects still update every frame;
- `baseDraw()` still loops them;
- every `FloatingText.draw()` still performs `save()`, style assignments and `restore()`, even though the actual text calls are muted.

Thus Arsenal pays for visual objects that are intentionally invisible.

**Recommended fix:** Arsenal mode should immediately discard/suppress battlefield `FloatingText` objects, while DOM HUD/Quest text remains unaffected.

This is a particularly safe optimization because the authoritative Arsenal presentation explicitly forbids battlefield typography.

### P1-A — Arsenal DOM HUD is synchronized every render frame

`public/game/modes/arsenalQuestRuntime.js::syncDomHud()`

Current render flow performs repeated:
- `document.getElementById()`;
- slot `.filter()`;
- text generation;
- `textContent` assignment;
- result/debug checks;

on every rendered frame.

**Recommended fix:**
- cache DOM references once;
- keep last rendered strings/state;
- only write DOM when the value changes;
- cooldown display may update at 10 Hz (0.1 s precision) instead of 60+ Hz;
- result UI updates only on state transitions;
- debug overlay may retain a lower refresh rate (e.g. 5–10 Hz).

Gameplay timing must continue to use live state, never HUD cadence.

### P1-B — particle creation has no Arsenal-specific budget and allocates many objects

`emitParticles()` creates a new `Particle` object for every particle.

Several events can emit tens of particles at once:
- explosion/grenade;
- melee contact;
- native roster abilities;
- reflections;
- wall impacts.

`Particle.draw()` also performs one `save()/restore()`, path build, fill and stroke per particle.

This can create both:
- paint cost;
- garbage-collection spikes.

**Recommended fix sequence:**

1. instrument particle peak/count before changing behavior;
2. add an Arsenal visual budget with priority rather than blindly reducing every effect;
3. high-value event particles survive; oldest/tiny low-priority particles are culled first;
4. if GC is measurable, add Particle object pooling;
5. consider batching simple square particles by style when visually equivalent.

Do not simply halve all particle counts.

### P1-C — Arsenal-specific arrays use frequent object removal/allocation patterns

Examples:
- VFX array up to 240;
- casing VFX;
- detached weapon objects;
- projectiles;
- particles;
- visuals.

Current backward `splice()` is acceptable at small counts, but if traces show GC or array churn it should be converted to stable write-index compaction/pools for hot collections.

Do this only after measurement.

## 3. Medium-priority findings

### Senko gun image scaling

Revision 2 already improved this substantially:
- one world scale;
- raster assets generated at 2× world scale.

This is reasonable quality/performance behavior.

Do NOT make gun assets tiny or return to normalized sizes as a “performance fix.”

If profiling later shows image scaling is significant, cache fixed-size ImageBitmap/offscreen representations. This is not the first optimization target.

### VFX presentation

Muzzle/smoke/contact/explosion drawing contains many `save/restore` and additive composite operations.

These should be optimized only after chamber/glow/hidden-text/HUD work, because they carry important game feel.

Potential later optimizations:
- group consecutive additive VFX draws;
- reduce redundant canvas state changes;
- cache frequently scaled visual sprites.

Do not remove muzzle/smoke identity.

## 4. Instrumentation needed before code optimization

Extend the existing performance report specifically for Arsenal.

Record rolling timings for:
- total frame;
- simulation;
- base draw;
- chamber background;
- pickup draw;
- Arsenal projectile draw;
- equipped/detached weapon draw;
- Arsenal VFX draw;
- DOM HUD sync.

Record live/peak counts:
- projectiles;
- AQ projectiles;
- particles;
- floatingTexts;
- shockwaves;
- Arsenal VFX;
- casing VFX;
- detached weapons;
- active pickup slots;
- active WebAudio voices.

Where supported, additionally observe `long-animation-frame`; keep current `longtask` fallback.

## 5. Benchmark scenarios

Use deterministic or reproducible scenarios and compare before/after.

### B0 — idle baseline
30 s Arsenal chamber, two fighters, no spawned weapon effects.

Purpose:
measure pure arena/render overhead.

### B1 — pickup pressure
8 active/revealed pickups including T5.

Purpose:
isolate rarity glow + floor sprite cost.

### B2 — automatic-fire stress
M249 / P90 sustained transactions + casing cloud.

Purpose:
projectiles + VFX + audio voices + casings.

### B3 — shotgun stress
Jackhammer / SPAS pellets across the arena.

Purpose:
many simultaneous tracers/projectiles.

### B4 — melee stress
Dagger/Sabre ricochets and pin/exit.

Purpose:
thrown sprites + contact VFX.

### B5 — roster heavy-control stage
Quest stages with BLACK_HOLE / TIME / KUNGFU.

Purpose:
native kit + Arsenal systems running simultaneously.

## 6. Performance acceptance targets

Do not optimize against average FPS only.

For a normal visible desktop Chrome session:
- target p95 frame interval near or below ~20 ms;
- no recurring >50 ms animation frames during ordinary combat;
- eliminate periodic GC-style spikes where possible;
- preserve 60 Hz-class presentation where the display/browser can sustain it.

Record before/after on the same machine and scenario.

Do not claim a performance win from CI wall-clock time.

## 7. Recommended implementation order

### Pass 1 — zero/near-zero visual risk
1. cached static Chamber 01;
2. suppress invisible Arsenal floating text;
3. DOM HUD diffing/throttling;
4. add detailed Arsenal performance counters/timers.

Re-profile.

### Pass 2 — high-value render optimization
5. cached rarity under-light sprites, no runtime `shadowBlur`;
6. cache any repeated static/path-heavy pickup decorations if trace still shows paint cost.

Re-profile.

### Pass 3 — load-dependent systems
7. particle priority budget;
8. particle/object pooling if GC spikes are proven;
9. hot-array compaction;
10. VFX state batching.

Re-profile after each item.

### Pass 4 — architectural escalation only if still needed
11. investigate layered canvases;
12. investigate OffscreenCanvas/worker rendering.

Do NOT jump to workers first. The current obvious same-thread waste should be removed before accepting the complexity of cross-thread state synchronization.

## 8. Things explicitly NOT to do as lag fixes

Do not:
- cap the game to 30 FPS;
- reduce spawn cadence;
- shorten shotgun travel;
- shrink Senko guns;
- remove rarity hierarchy;
- remove casing physics/audio;
- delete weapon exit motion;
- globally disable VFX;
- change gameplay simulation speed;
- reduce roster mechanics;
- move gameplay physics to a worker before profiling proves the need.

Performance work must preserve owner-visible identity.

## 9. Owner-device data collection

During real playtest, after a laggy combat segment, open DevTools Console and run:

`apexPerfSummary()`

Capture at least:
- `frames.avgMs`
- `frames.p95Ms`
- `frames.maxMs`
- `frames.slowFrames`
- `longTasks.count`
- `longTasks.slowest`

This real-device sample is more valuable than guessing from CI screenshots.
