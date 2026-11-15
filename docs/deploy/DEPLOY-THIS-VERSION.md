# APEX CHAOS — TOTAL EVOLUTION Arena Transplant (Makers / Vite)

## What this is
This is **the full Vite/React application source of the user's APEX-CHAOS REPAIRED package** with the **entire 5-stage Total Evolution arena runtime** from the BOOT-FIX donor connected to its Free Battle engine. The original 4-stage BEYOND arena renderer and its four-event schedule do not run. Unrelated existing game/combat content is retained.

## To deploy on Makers
1. Create a **new project** named e.g. `apex-chaos-total-evolution-arenas-v1` or use a platform update flow for an existing project. The name from earlier projects might be taken.
2. Upload **this ZIP itself** if Makers imports Vite source projects. Do not nest it in another ZIP. The archive root contains `index.html`, `vite.config.ts` and `package.json`.
3. Framework: Vite. Install command: `npm ci`. Build command: `npm run build`. Output directory: `dist`. Node.js >=20.
4. If Makers only accepts already-built static content, build locally (`npm ci && npm run build`) and upload the **contents of dist** instead. Source ZIP itself is not a prebuilt static site.
5. Clear website/service-worker caches after deployment before testing.

## Testing
The 5 original arenas were exercised in Chromium browser: all stage IDs initialized, their render passes produced nonblank pixels, and no browser JS exceptions were observed. Hazards were checked independently (Foundry vent, Cryo core break, Lorentz projectile acceleration, Prism projectile refraction, Tournament Pro zero hazard). Entire Vite build could not run offline because npm packages were not retrievable in the current environment; production deployment is not verified.

## Important visual asset limitation
The BOOT-FIX donor lacked five material texture JPEGs. This package includes five specifically generated substitutes with those exact paths, so the donor arena renderer does not issue missing-JPEG requests. These are *not* the missing original licensed photos.
The REPAIRED receiver also lacked some source-dependent original production art. `RUN-APEX.py` is preserved from the receiver for restoration from the pinned source repository when a Git/network-enabled machine is available. That separate limitation is not eliminated by the arena transplant.

## Code boundaries
Original donor files in `public/game/evolution/` are byte-identical to BOOT-FIX for the Arena, VFX Library, Shader Compositor, Audio, and Art Atlas. The receiver uses a new compatibility adapter in `public/game/arsenal/apexBeyondArenaEngine.js`, with the existing React arena selector and match simulation consuming those original modules.
