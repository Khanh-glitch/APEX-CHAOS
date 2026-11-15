# APEX CHAOS — Evolution (1) | Source-based production acceptance

**Observed input:** `apex-chaos-game-evolution (1).zip`, 15 Nov 2026. **Verdict: HOLD — not production-ready.**

## Evidence and confidence

- Extracted **223 files**, total **13,220,093 bytes** of unpacked file content; `public/assets/` contains **4 files**, none of which is a battle texture/audio asset. The ZIP contains no `node_modules`, `.next` build or game recording.
- `node --check` passed for every `.js` file (**0 parser errors**). This is syntax-only, not execution or correctness acceptance.
- Offline scanner found **310 literal absolute `/assets/...` references whose files are absent from this ZIP**. This count is a conservative source-only approximation; dynamic asset references are not counted, and some absent references may be supplied by the real APEX repository. It does not mean all 310 are required at launch.
- The five newly advertised arena material photos (`rust_steel.jpg`, `ice_surface.jpg`, `copper_circuit.jpg`, `hex_basalt.jpg`, `dark_weave.jpg`) are **not present**; only `public/assets/evolution/materials/PROVENANCE.md` is bundled. `public/game/evolution/apexEvolutionArenas.js:22-43,87-90` describes a texture-led art direction, but textures cannot load from this snapshot.
- The environment has Chromium and Node, but cannot access npm/GitHub over DNS and does not have installed Node dependencies for this project. **No end-to-end browser gameplay PASS is claimed.**

## Major findings

### P0 — Incomplete shipping payload / startup / assets

**Files:** `public/assets`, `src/game/goldAssetManifest.js`, `src/game/runtimeManifest.js`, `src/components/ApexChaosClientRoot.tsx`.

The archive is a Next.js source snapshot, not a deployable bundle; it includes almost none of the original APEX production rig, sprite, audio, font and Gold assets. Empty or invisible fighters, missing VFX, 404 errors and missing visuals are likely if deployed alone. The existing `main` must be used as an asset donor; verify all runtime dependencies and their exact URLs. Do not fabricate missing images or replace production art with generated geometric placeholders.

### P0 — Championship BO3 looks implemented but is not wired to the result lifecycle

**File:** `public/game/evolution/apexEvolutionCombatRuntime.js`.

The function `interceptRoundEnd(state)` (around line 435) increments the BO3 series and requests next round, but static callsite search over this **entire ZIP** finds **no invocation**. The engine wrapper observes `state.over` then sends a normal completed-match report (around line 633), regardless of interim series state. Thus BO3 logic is **not proven to run** and likely misreports per-round outcomes. The previous report calling BO3 unfinished remains valid for this new ZIP, now with stronger evidence. Fix at authoritative match-finalization boundary and test both 2-0/2-1 sequences, KO, escape, rematch, double finishing and persistence.

### P0 — Evolution reaches Quest-like states unintentionally

**File:** `public/game/evolution/apexEvolutionCombatRuntime.js:65-70`.

`evoActive()` excludes `labMode`, `questMultiActor`, `questStage`, `questReflex`, `questFirstWake`, and `questBreachEncounter`, but `arsenalBattleRuntime.js` also has `questScrapSwarmProgression`, `questWeaponRainProgression`, `questBreakerChargeProgression`, `questRivetTest`, `questTotProgression`, `questBreachProgression` and others. Without a single authoritative Free Battle routing policy, special modes risk receiving Evolution combat, screen effects or drop logic. Validate each real public route and admin mode.

### P1 — Mythic spawn bypasses authoritative Arsenal lifecycle

**File:** `public/game/evolution/apexEvolutionCombatRuntime.js:362-399`.

Despite claiming “canonical Arsenal slot lifecycle”, `spawnFloorWeaponDirect` **constructs a custom slot object and pushes it directly to `state.slots`**, updates `spawnedTotal`, and omits the normal spawn service transaction. Verify ID, pickup eligibility, ownership, spawner accounting, item tiers, A3 economy, cleanup and replay. Request a native spawn API rather than inventing slot structure.

### P1 — War Room telemetry contains fictional seeded matches and fragile DB dependency

**Files:** `src/app/api/evolution/overview/route.ts`, `src/db/index.ts`, `public/game/evolution/apexEvolutionHudAndDeck.js`.

The API seeds **10 fighters' arbitrary statistics and four hard-coded matches** into a database, which may be displayed like real competitive history. That is inappropriate for factual personal stats; demo fixtures must be conspicuously labeled and separated from genuine persisted receipts. `src/db/index.ts` throws at module import when `DATABASE_URL` is absent. UI has a local-history fallback but cannot guarantee accuracy, deduplication or survival across profile/reload; never silently treat demo/guest/backend-failure data as authoritative.

### P1 — Overlays and HUD compete with Gold product surfaces

**Files:** `apexEvolutionHudAndDeck.js`, `src/ApexChaosHost.jsx`, `public/gold/...`.

Evolution injects another fixed screen-level `#apex-evo-command-deck`, `#apex-evo-battle-overlay`, dock, mobile touch pad, cinematic KO, and war-room modal directly under `document.body`. The active product already owns Gold panels, HUD, navigation and result views. Desktop/mobile collision, z-index, focus, safe-area, typography hierarchy, touch blocking, readability under skill spam, KO duplications and screen-reader access need visual acceptance. Presence of CSS keyframes isn't proof of polished UX.

### P1 — Visual replacement does not reach production-art quality

**Files:** `apexEvolutionUltimates.js`, `apexEvolutionArenas.js`, `apexEvolutionVfxLibrary.js`, `apexEvolutionShaderCompositor.js`.

All ten Ultimate kits have phased gameplay choreography (a real design win), but their authored drawing code continues to use Canvas lines/arcs/gradients, with only **one `drawImage` call** in the Ultimates module and no dedicated shipped character/ultimate textures in this ZIP. Arena module has 46 `beginPath` and 20 `arc` callsites and references five missing photograph textures. Procedural VFX baking and WebGL2 post-process are genuine technical components, yet lighting, bloom and chromatic effects cannot substitute for strong source artwork, animation timing, layered scene art or material definition.

This is **not a blanket condemnation of Canvas, SVG, or procedural rendering**. The weakness is the actual assets and compositing pipeline shipped in the archive, not the choice of API alone. Do not label this “AAA” or “studio-grade” without side-by-side visual evidence.

### P2 — State coherence and timers

`setTimeout` callbacks inside Mythic Drop and BO3 can outlive a match or arena switch unless cancellation/epoch checks are added. The match update wraps a cinematic time dilation around a real engine update; verify damage, hitstop, absolute timers, UI time, audio, achievements and AI obey one coherent clock. Ensure draw-only passes do not mutate VFX simulation or resource state.

## Strengths to retain and extend

- Hero-specific Ultimate design (Robot/Hunter/Crystal/Magnet/Ice/Mirror/Boxe/Shuri/Black Hole/Time); move/attack/counterplay structures exist.
- Predictive BOT AI with four named policies, risk/reward of Aegis, manual steering plus wall ricochet, Sync and Style systems.
- Distinct interactable arena concepts with opportunities for stronger design and presentation.
- Structured VFX recipes, shader fallback, responsive combat HUD concepts and off-line history intent.

## Acceptance gates for next agent

1. **Source custody:** prove full running file graph, asset residency and correct Free Battle route; don't clone into an unused folder.
2. **Gameplay truth:** BO3 2-0/2-1, Mythic pickup, mode isolation, Ultimate counterplay and KO tested at real runtime.
3. **Art direction:** compare actual current best Gold frame/skill/arena versus new at matching scale; each new Ultimate, stage, ability, movement state has authored high-quality render/animation and real audio evidence.
4. **UX:** screen capture home→select→match→KO→rematch and mobile; test overlap/readability/safe area, text hierarchy, contextual onboarding, accessibility and latency.
5. **Performance/fallback:** WebGL2 on/off, 30/60 FPS devices, slow boot, missing asset handling, no black screens.
6. **Evidence:** real playable preview plus screenshots/video/timecodes, errors and known limitations; no synthetic screenshots or placeholder video acceptance.

**Git state:** `evolution/2026-11-15-cleanroom` was created from `main` commit `9d06036dda72eff6afe7bb1e34bc72652ae9c248`. Due this tool session's remote-write/large-file transfer limits and lack of direct git network access, the ZIP snapshot was **not pushed**. This report and local snapshot are a handoff, not evidence that GitHub branch contains Evolution.
