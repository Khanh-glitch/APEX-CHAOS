# BOT WAVE lossless optimization — 2026-10-28

Baseline: cccc6acac918e9b5f05891641f9fed2fcc044175, the newest remote branch tip found across the repository at task start (2026-10-28 16:31:56 +07:00), on design/home-command-dock-gold-20261028.

This candidate preserves the baseline Gold core, all ten original PNGs, native Arsenal physics/audio, particle counts, fluid resolution, all 14 pressure iterations, camera, DPR, blur/bloom/refraction, and HUD cadence.

Changes:
- Fuse adjacent advection pairs while preserving double-precision arithmetic order, Float32 stores and the baseline velocity-source behavior.
- Reuse smoke raster bytes for the second smoke layer in the same render. Keep the second upload: removing it caused 37 differing Chrome channels and was rejected.
- Clear the Fury framebuffer without shading when intensity is exactly zero. Use a conservative scissor around provably nontransparent pixels when active; the complete fragment shader is unchanged.
- Build 13 deterministic original smoke textures and the original fire texture bank before exposing START, yielding between jobs. No replacement artwork or reduced detail.
- Replace nearest-target filter/sort with a linear scan retaining distance/ID ordering; size HUD canvases before marker DOM writes.
- Register the runtime, refresh both entry-path cache keys, update the signed graph to 71 runtimes and extend CI.

Final paired Chrome subsystem measurement (9 alternating-order rounds, same process; medians):

| Work | Baseline | Candidate | Reduction |
| --- | ---: | ---: | ---: |
| Full-grid fluid step | 9.243 ms | 8.733 ms | 5.5% |
| Two smoke layers + fire, including canvas flush | 8.205 ms | 7.535 ms | 8.2% |
| Fury shader fragments across the scripted suite | 5874336 | 356944 | 93.9% |

Earlier paired repetitions varied with host load (approximately 5–10% fluid-step and 8–18% raster reduction). These are component measurements, not FPS gains. A zero idle timer median means below timer resolution, not zero execution cost.

Verification:
- 1,800 bitwise field comparisons in Node; 192 field comparisons with the shipping WASM backend in Chrome.
- Existing exact WASM pressure parity: 120 repeated full/partial-grid cases.
- 36 fluid pixel cases across DPR 1/1.5/2 and three zooms: 0 differing channels.
- 36 Forge cases across fill, HP and DPR, plus original particle bytes: 0 differing channels.
- Baseline Gold core remains SHA-256 bf365b1b40261af35d607d9024922f705b99dce6363195fee87bbfd8e90f26f7. The old fidelity test still pinned the pre-WASM core; it now locks this exact baseline instead.
- Real Chrome: keyboard card locks, Sticky J, guard, all unlocks, positive U/I casts, Home entry/return, all 41 native weapon executors, native audio and arena/HUD bounds on desktop and landscape.
- Vite production compilation, asset audit/pruning, Gold exact-source checks, direct-port contracts, 481-asset shipping gate, runtime hygiene and 71-runtime build-receipt gate passed. Windows stages were invoked directly after pnpm symlink limitations; CI exercises the standard package build.

Performance acceptance remains open:
The full-HUD headless run still reported large frame gaps on this Windows/Intel Iris Xe host (desktop p95 1015.8 ms; landscape p95 507.9 ms). Its instrumentation gate passing only confirms live movement and valid samples. It does not establish smooth gameplay. Component wins and exact image parity are proven; no lag-free, 60 FPS, or whole-game speedup claim is made. Keep this PR draft pending complete-frame GPU/compositor investigation and paired gameplay on representative devices.

Evidence: [fluid](perf-20261028/fluid-comparison.json), [Forge](perf-20261028/forge-comparison.json), [full HUD](perf-20261028/live-profile.json).

Reproduce against a running built preview with CHROME_PATH and APEX_APP_URL:

```sh
node tools/testBotWaveLosslessFluid.mjs
node tools/testBotWaveLosslessFluidBrowser.mjs
node tools/testBotWaveForgeLosslessBrowser.mjs
node tools/testBotWaveBrowserInputLock.mjs
node tools/testBoxeModeEntryChrome.mjs
node tools/profileBotWaveLosslessBrowser.mjs
```
