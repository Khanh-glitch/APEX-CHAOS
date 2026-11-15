# APEX CHAOS Evolution — cleanroom source authority

This branch overlays the user-provided `apex-chaos-game-evolution (1).zip` source onto APEX `main` commit `9d06036dda72eff6afe7bb1e34bc72652ae9c248`. All APEX production art, rigs, Gold VFX, sound, sprites, and other binaries **remain in this branch** by inheritance from main.

## Active Evolution product

- Framework: **Next.js** (`package.json` with `next dev`, `next build`); do not boot the leftover Vite scaffold as the authoritative product.
- Entry: `src/app/page.tsx` → `src/components/ApexChaosBootstrap.tsx` → `ApexChaosClientRoot.tsx` → `src/ApexChaosHost.jsx`.
- Production runtime chain: `src/game/runtimeManifest.js` + `src/game/runtimeLoader.js`, `public/apexEngine.js`, `public/game/modes/arsenalBattleRuntime.js`, plus dynamic fighter Gold presentation runtimes.
- Evolution game extensions: `public/game/evolution/apexEvolution{CombatRuntime,Ultimates,Arenas,VfxLibrary,ShaderCompositor,Audio,HudAndDeck}.js`.
- Evolution visuals: the new procedural effects are **not** equivalent to complete authored production artwork. Audit real scene pixels before asserting improvement.

## Source custody

- `public/assets/**`, `public/gold/assets/**`, `public/game/hero-rework/**`, fonts, music and historical source artifacts inherited from main are donor dependencies unless proven otherwise. **Do not delete or replace them without evidence.**
- Files from main not imported in the latest ZIP can be legacy Vite or historical runtime. **Do not assume all are active.** Trace Next entry and loader.
- Five `/assets/evolution/materials/*.jpg` textures are referenced but absent from the user ZIP and base main. **Create proper new art assets or find licensed replacements; never misrepresent them as shipped.**
- `.playtest/` scratch scripts omitted from transfer; audit evidence remains in `docs/EVOLUTION_PRODUCTION_AUDIT.md`.
- This branch is a **source custody snapshot**, not certified functional: install dependencies, build, test BOT/LOCAL/BO3/Quest isolation, exercise all fighter abilities and compare desktop/mobile screenshots before calling it accepted.

## First run

Run `npm install` then `npm run dev` or `npm run build`. The environment must support the Next.js 16.4.2 toolchain; online database is optional for battle, but the War Room API requires proper database configuration or an explicit offline fallback.

## Audit / next-round brief

- `docs/EVOLUTION_PRODUCTION_AUDIT.md`
- `docs/EVOLUTION_AUDIT_MACHINE.json`
- `docs/EVOLUTION_NEXT_ROUND_PROMPT.md`
