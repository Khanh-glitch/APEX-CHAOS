# APEX CHAOS — Five Arena Evolution (Independent Branch)

Standalone **Vite + React source tree** reconstructed from `APEX-CHAOS-5-ARENAS-EDGE-CLEANUP-FIX.zip` (2026-11-16). This branch deliberately contains only the extracted project—not the parent APEX CHAOS monorepo, archived ZIPs, or unrelated branches.

## Run

Requirements: Node.js 20+.

```bash
npm ci
npm run verify:arena
npm run dev
```

## Build & deploy

```bash
npm run build
```

Publish the `dist/` directory. The source root is already the app root (`index.html`, `package.json`, `vite.config.ts`); no nested `APEX-CHAOS/` folder. Framework preset: **Vite**, build command `npm run build`, output directory `dist`.

## Source layout

- `src/` — React entry, shell, HUD and game integration code.
- `public/apexEngine.js` — classic core game runtime.
- `public/game/evolution/` — all five transplanted arena systems (arena rules, VFX, shader compositor, sound and materials).
- `public/game/arsenal/` — adaptation to original Free Battle, combat systems.
- `public/game/hero-rework/`, `public/game/quest/`, `public/gold/` — existing character, Quest and Gold UI runtime.
- `public/assets/evolution/` — supplied arena textures and provenance.
- `scripts/` — arena integration and wall/corner regression checks.
- `docs/arena/` — architecture and history of arena integration fixes.
- `docs/deploy/` — Makers/Vite instructions, recovery notes.

## Arena modes

Scrap Foundry, Cryo Vault, Lorentz Railyard, Prism Sanctum and Tournament Pro are provided by the original evolution arena runtime. This snapshot preserves collision/edge and stray-line cleanup from the supplied ZIP.

## Known asset caveat

The supplied ZIP lacked some original production assets from the broader APEX CHAOS repository. The existing recovery launcher (`RUN-APEX.py`) and optional service worker may fetch those externally for previews; **this source snapshot is separate from other branches but not guaranteed asset-complete offline**. The five arena material JPGs are supplied substitutes rather than recovered originals.

## Integrity / testing

`npm run verify:arena` runs both structural integration and edge collision regressions. See `docs/arena/ARENA-EDGE-CLEANUP.md` for scope and known limits. A full production build still requires resolving npm dependencies in an internet-enabled environment.

The provenance note `docs/SOURCE-PROVENANCE.md` records the source ZIP SHA-256.
