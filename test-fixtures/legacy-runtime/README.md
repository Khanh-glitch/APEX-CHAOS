# TEST-ONLY LEGACY RUNTIME FIXTURES

This directory is **not product authority** and is **never shipped or loaded by the production runtime loader**.

It preserves historical classic-script runtimes only so regression harnesses can reproduce the old shared-roster environment while current APEX CHAOS remains limited to the production graph in `src/game/runtimeManifest.js`.

Rules:

- Do not import or copy these runtimes into `src/` or `public/game/`.
- Do not use these files as design/mechanics authority for current heroes.
- Do not add these paths to the production runtime manifest, loader, product surface, or Vite shipping bundle.
- Historical logical `/game/...` names are retained only inside `tools/legacyRuntimeManifest.mjs` so old regression ordering remains stable.
- Current product behavior must be implemented in the Core Six/current Arsenal runtime graph, not here.

If a regression fixture is no longer required by a test, prefer deleting it rather than returning it to production source paths.
