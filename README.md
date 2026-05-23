# Apex Chaos

Vanilla JS / Canvas rebuild of the original single-file Apex Chaos prototype.
The game keeps the original square 1000x1000 arena, removes WIND, and ships a
32-fighter roster with deterministic replay seeds and a headless balance suite.

## Run

```bash
npm install
npm run dev
```

`npm run dev` starts `tools/devServer.js`, a lightweight Vite-compatible ESM
static server for low-spec machines. The app runs at:

```text
http://127.0.0.1:5173/
```

If Vite is installed and you want the Vite CLI instead:

```bash
npm run dev:vite
```

## Scripts

```bash
npm run smoke
npm run balance
```

- `npm run smoke` runs the required smoke matchups:
  FLASH vs TOXIC, VAMPIRE vs BLADE, SLIME vs SNIPER, PUPPET vs ELECTRIC,
  MIRROR vs BLACK_HOLE, KUNGFU vs PIRATE.
- `npm run balance` runs all 496 non-mirror matchups with both side orders and
  20 seeds per orientation, for 19,840 simulated matches.

Reports are written to:

```text
reports/latest.json
reports/latest.md
reports/latest.html
```

Timestamped copies are also kept in `reports/`.

## Latest Full Balance Pass

Report seed: `phase1-final3`

- Matches: 19,840
- Unique pairs: 496
- Mirror side test: yes, both A-left/B-right and B-left/A-right
- Roster drift: pass, 32 fighters, no WIND
- Winrate floor/ceiling: pass
- Strongest/weakest spread: pass
- Runtime bug scan: pass, 0 suspected bugs
- Average duration: 81.24s
- Median duration: 66.25s
- p10 / p90 duration: 41.61s / 148.28s
- Duration bands: 7,904 under 60s, 10,657 in 60-180s, 1,279 over 180s
- Top winrates: TOXIC 56.49%, KUNGFU 56.09%, PAINTER 55.65%,
  BLACK_HOLE 55.08%, NOVA 53.79%
- Bottom winrates: HUNTER 47.06%, BLADE 45.81%, CRYSTAL 45.16%,
  TIME 44.07%, MIRROR 41.98%

Over-180s matches are flagged for review only. They are not forced losses and
the game still ends naturally by fighter death unless the simulator reaches its
240s analysis ceiling.

## Project Map

```text
index.html
src/core/gameLoop.js
src/core/fighter.js
src/core/damage.js
src/core/status.js
src/core/projectile.js
src/core/collision.js
src/core/rng.js
src/data/fighterTypes.js
src/data/balanceConfig.js
src/data/audioManifest.js
src/data/visualManifest.js
src/systems/simulator.js
src/systems/analytics.js
src/systems/tournament.js
src/systems/renderer.js
src/systems/vfx.js
src/systems/audio.js
src/systems/replay.js
src/ui/menu.js
src/ui/select.js
src/ui/hud.js
src/ui/postMatch.js
tools/runBalanceSuite.js
tools/devServer.js
reports/
original/apex_chaos_32_runtime_stability_hotfix2.html
```

## Roster

RUBBER, ICE, VAMPIRE, SPIDER, VOLCANO, MAGNET, FLASH, ELECTRIC, ORBIT, TOXIC,
MIRROR, BLACK_HOLE, SAW, BLADE, NOVA, HUNTER, CRYSTAL, VIRUS, DRUM, CARD,
MATH, MATH_V2, SNIPER, SLIME, TIME, WOLF, PUPPET, WITCH, PIRATE, PAINTER,
KUNGFU, SUPERSTAR.

## Balance And Mechanics Changes

- Removed WIND from gameplay roster and UI text.
- Kept rage trigger at HP <= 50.
- Kept collision damage opt-in: only fighters/skills with contact handlers deal
  collision damage.
- Added deterministic seed RNG for match setup, initial movement, simulator, and
  replay metadata.
- Added seeded wall-bounce jitter to avoid dead geometric no-contact loops.
- Fixed projectile cleanup so expired special projectiles with negative lifetime
  are removed after their final effect. This fixed stale gravity wells causing
  no-damage loops.
- PUPPET effigy now absorbs only its remaining HP. Overflow damage reaches
  PUPPET in the same hit and the effigy is destroyed.
- PUPPET summons have finite lifetime and owned summon limits.
- SLIME children absorb finite HP only. If no valid child/layer exists, damage
  reaches SLIME. Slime children and mucus have caps and lifetimes.
- KUNGFU has readable combo beats, inner trauma, rush, and giant palm visuals.
- PIRATE has anchor hook, cannonball, broadside/boat movement, and treasure loot
  identity.
- BLACK_HOLE tuning was adjusted after stale gravity well cleanup revealed its
  real output.
- Final tuning stays in `src/data/balanceConfig.js` so balance changes are
  visible and easy to audit.

## Visuals

Visuals are manifest driven in `src/data/visualManifest.js`.

Each fighter has:

- color identity
- silhouette/glyph fallback
- optional asset path under `/assets/images/fighters/`
- effect tags used by renderer/VFX

No GIF/video/base64 payloads are embedded in source. If production assets are
added later, use PNG/WebP sprites or short WebM loops under `public/assets/` and
keep procedural Canvas fallbacks available.

## Audio

Audio is manifest driven in `src/data/audioManifest.js` and implemented in
`src/systems/audio.js`.

The audio manager has:

- master/music/sfx/ui bus volumes
- priority-aware SFX
- cooldown anti-spam
- procedural fallback sounds per fighter/action
- hooks for future legal asset files

Each fighter maps core actions such as wall hit, skill cast, skill hit, rage
trigger, and death/finisher through the manifest.

## Content Tools

Implemented content-facing systems:

- random match
- full tournament
- browser smoke/balance trigger
- replay seed storage
- highlight detection for rage comeback, big hit, clutch final card, 1HP survival
- cinematic camera toggle
- match summary export data
- tier list in balance reports
- random challenge mode

Boss mode and 3v3 draft/gauntlet are left as future content modes because they
would need separate balance gates to avoid damaging the 1v1 core.

## Known Risks

- The graphics currently use procedural silhouettes and VFX fallbacks. Real PNG
  or WebP fighter art can be added through the manifests without changing core
  logic.
- The simulator is deterministic for a seed, but low sample counts are noisy.
  Use the full 19,840-match report for balance claims.
- Some over-180s matches are expected for PAINTER, PUPPET, SLIME, VAMPIRE, and
  other defensive/status identities. They are review flags, not forced losses.
- This workspace did not have `npm` on PATH during verification, so commands
  were executed with the bundled Node runtime directly. The dev server endpoint
  was verified with HTTP 200 at `/src/main.js`.
