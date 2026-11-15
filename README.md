# APEX CHAOS — Evolution V2 experimental source

This branch is a clean working baseline for **APEX CHAOS Evolution V2** imported from `apex-chaos-game-evolution (1).zip` on 2026-11-15. It is intentionally isolated from `main`; do not merge without real runtime and visual acceptance.

## What is present

- `src/`: exact Evolution V2 Next.js/React application source, database API and UI.
- `public/game/evolution/`: 7 new Evolution combat, arena, VFX, Ultimates, HUD, audio and post-processing modules.
- `public/`: Evolution-updated classic engine/bridges plus production game runtime and original source artwork preserved from `main` (to prevent missing-asset regressions).
- Root: Next.js project configuration only; no historical acceptance docs, stale Vite entry, PR evidence, test rigs or prebuilt output.

## Critical audit limitations

- No verified live-browser production playthrough/build yet: ZIP lacked lockfile, binary material textures, and packaged production assets.
- Five references in `public/game/evolution/apexEvolutionArenas.js` to `/assets/evolution/materials/*.jpg` have provenance notes but the actual images are absent.
- Source still contains old procedural Canvas visual production, multiple integration risks, and demo-seeded statistics; do **not** treat this branch as visually accepted or ready to ship.
- User's next task is a genuinely higher-quality UI/UX, artwork/VFX and gameplay bug-fix pass **on this branch**, not a fresh remake. Preserve gameplay progress and the original production asset graph while evolving the result.

## Running

Run `npm install`, `npm run dev` and visit localhost; provide a PostgreSQL URL only if the data APIs require it. The user-facing game must work without a mandatory external database. Production proof requires browser gameplay plus actual asset/network checks, not syntax pass alone.
