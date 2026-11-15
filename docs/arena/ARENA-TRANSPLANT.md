# APEX CHAOS — Original Total Evolution arenas transplanted

**Receiver**: `apex-chaos-game-overhaul-REPAIRED.zip` (Vite + React).

**Donor**: `apex-chaos-game-evolution-BOOT-FIX.zip` (Next.js + original classic JS arena modules).

This replacement uses the donor `apexEvolutionArenas.js`, `apexEvolutionVfxLibrary.js`, `apexEvolutionShaderCompositor.js`, `apexEvolutionAudio.js`, and `apexEvolutionArtAtlas.js` byte-for-byte. No BEYOND arena geometry, floor drawing, theme table, or event scheduler is retained. The receiver gameplay, heroes, weapon systems, menu and Story mode remain intact.

## Stages (all original)
1. `scrap_foundry` — Scrap Basin Foundry: forge vent, heat damage, bumper pylons, persistent scars.
2. `cryo_vault` — Cryo-Turbine Vault: shootable coolant cores, frost speed fields, rotating rotor gust.
3. `lorentz_railyard` — Lorentz Railyard: projectile velocity gates, rail overload and stun.
4. `prism_sanctum` — Obsidian Prism Sanctum: refraction monoliths, ley-line speed/sync surge.
5. `tournament_pro` — APEX Tournament Pro: no arena hazards, reactive telemetry stage.

## Integration
- Original arena modules load via `src/game/runtimeManifest.js`.
- `public/game/arsenal/apexBeyondArenaEngine.js` was REPLACED with a compatibility adapter; its 4 BEYOND arenas are not instantiated.
- Receiver's battle draw function uses donor `drawArenaFloor`, particle layers, and GPU compositing.
- Existing BEYOND combat retained **only** for unrelated mechanics (impulse/deflect, overdrive, bot AI, camera). Its four previous arena events are disabled and removed.
- Arena banner and five-stage selector connect to existing React HUD.
- Donor's speed boost is consumed in receiver's frame step; combat statistics and original arena callbacks are bridged.
- Temporary event state, decals and arena hazards reset on arena change or new match.

## Asset provenance
The BOOT-FIX ZIP does not contain the five listed material JPEGs (only their provenance notes); procedural replacement material textures are generated and bundled separately to prevent 404s. **These are newly generated substitutes, not the missing original licensed textures.** The original donor architecture, geometry and floor VFX are unchanged.

## Deploy
Extract this project and use `npm ci && npm run build` on a Vite-compatible host, or upload the ZIP to a source-project importer that accepts Vite. If deploying built `dist`, upload its extracted contents, not an archive named as a project. Change the target project name if Makers reports an existing name.
