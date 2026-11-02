# Soul of Hero (browser edition)

An offline, single-player, top-down pixel-art survival action RPG. You play a male or female Adventurer on one fixed island for a run of up to 336 real hours. The last 72 hours are Ragnarok. Built with TypeScript, Vite, React (UI) and Canvas 2D (world). The 640×360 world is scaled up by whole numbers so pixels stay crisp.

This is a standalone browser build that follows the Soul of Hero Gameplay Bible (`CURRENT_PRODUCT_CONTRACT.md`, branch `arena/103e4440-soul-of-hero`). A local reference copy was downloaded to `ref/bible.md` and read in bounded excerpts. It is not the Godot production game. The original Gold art was not available (`GOLD_SOURCE_NOT_AVAILABLE`). Every sprite here is original pixel art painted in code (`src/game/art.ts`).

## Commands
```
npm install
npm run dev        # dev server
npm run build      # single-file production build → dist/index.html
npm test           # vitest: engine/simulation contract tests (13)
node scripts/qa.mjs    # real-browser QA (Playwright Chromium) → qa-shots/
node scripts/qa2.mjs   # combat / Elder / Ragnarok cash / vendor browser pass
```

## Controls
| Action | Input |
|---|---|
| Move | WASD or arrow keys |
| Aim | Mouse (free 360°) |
| Attack / use the held item | Left mouse button |
| Dodge-roll (has invulnerability frames) | Space |
| Interact | E |
| Pull or release a cart | F |
| Quickbar | 1–8 or mouse wheel |
| Inventory | I |
| Craft | C |
| Build (X toggles reclaim mode) | B |
| Research (at a table) | R |
| Map | M |
| Skills, knowledge and Elder stones | Tab |
| Save, menu, settings, QA tools | Esc |
| Cancel a Core cast or build placement | Right mouse button |

## Layout
| Path | Contents |
|---|---|
| `src/game/core.ts` | Types for `GameState` (profile / run / custody / …), seeded RNG, constants |
| `src/game/world.ts` | The fixed island (200×200 tiles): coast, inlets, isthmus, ridge and pass, volcano, fen, lake, rivers that reach the sea, roads laid by A*, POI buildings, 4 starts, 6 Elder sites |
| `src/game/engine.ts` | The single authority. `dispatch(intent, state, now)` checks everything first, then commits and writes a receipt, or rejects. It also covers custody, structures, research, Ragnarok cash, escrow, vendor, death, run end and wipe |
| `src/game/sim.ts` | Real-time simulation: movement, combat timing (windup → contact → recovery), creature behaviour styles, footprint tracking AI, Elder attack patterns, Cores, fire spread, survival, weather, and offline `settle()` |
| `src/game/render.ts` | Cached terrain chunks with blended transitions, animated shorelines and lava, footprints, depth-sorted world, roofs, attack telegraphs, pixel VFX, weather, banded lighting |
| `src/game/art.ts` | Original pixel sprites with automatic outlines: hero animation frames, 6 creatures, 6 Elders (latent and awakened forms), trees and other sources, structures, about 70 item icons |
| `src/game/audio.ts` | Procedural WebAudio sound effects and ambience, with volume and mute |
| `src/game/persist.ts` | Versioned IndexedDB save written as one atomic record, plus localStorage fallback, migration and corruption quarantine |
| `src/game/balance.v1.json` | Editable numbers, each marked `LOCKED_CANON`, `TUNABLE_BALANCE` or `PROPOSED_MECHANISM` |
| `src/game/catalog.ts` | 68 item types, 18 source types, 33 recipes, 23 structures, 6 creatures, 6 Elders, vendor stock, achievements |
| `src/ui/*` | Title, character select, history, HUD, panels |

See `IMPLEMENTATION_EVIDENCE.md` for how each contract (K1–K8, C01–C24) maps to code and tests, and `THIRD_PARTY.md` for provenance.
