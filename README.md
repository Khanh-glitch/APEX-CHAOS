# APEX CHAOS — R5 × Total Evolution

**Current source:** APEX CHAOS R5 + **five Total Evolution arenas**. This is the editable **Vite/React** project retaining Gold UI, BOT / LOCAL battles, fighter systems, native audio assets and owner F7/F8 recording. For itch.io, deploy a compiled HTML5 ZIP, **not the source archive**.

> **Release status:** owner-acceptance candidate. Source-level arena checks are available. Do not represent this revision as production-validated without a full packaged-browser QA.

## Five playable Free Battle arenas

| Arena | Gameplay |
| --- | --- |
| Scrap Basin Foundry (`scrap_foundry`) | Forge heat, vents, bumper pylons, persistent battle scars |
| Cryo-Turbine Vault (`cryo_vault`) | Breakable coolant cores, slowing fields, rotor gust |
| Lorentz Railyard (`lorentz_railyard`) | Projectile acceleration gates, rail overload |
| Obsidian Prism Sanctum (`prism_sanctum`) | Monolith refraction and ley-line boost |
| APEX Tournament Pro (`tournament_pro`) | Competitive, hazard-free stage |

The Total Evolution arena system **replaces the former BEYOND stage renderer**. The Free Battle layer adds kinetic impulse, perfect deflect, overdrive, BOT intelligence levels and optional effects. The visible wall collider uses a **76-unit inset for eligible Free Battle only**; unrelated modes keep their original collision boundaries. Existing Gold HOME, BOT/LOCAL play and F7/F8 functionality remain part of the underlying game.

## Development

Requirements: **Node.js 22**, **pnpm 9.15.9**.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:5173/. Do not double-click the Vite source `index.html`.

## Verification and production build

```bash
node scripts/check-arena-integration.mjs
node scripts/check-arena-boundaries.mjs
pnpm test:runtime-revision
pnpm build
pnpm test:shipping-dist
```

The built game is in `dist/`. Source, scripts and assets in this repository are editable and versioned. Existing production art/audio under `public/assets/` is preserved: the donor ZIP did **not** contain those resources. Arena material JPGs in `public/assets/evolution/materials/` are **documented substitutes**, not recovered originals; see the provenance file.

### itch.io HTML5

```bash
printf '%s\n' "$(git rev-parse HEAD)" > dist/ITCH_GUEST_BUILD_SHA.txt
node tools/packItchPortable.mjs
(cd dist-itch-html5 && zip -qr ../APEX-CHAOS-itch-html5.zip .)
```

Upload `APEX-CHAOS-itch-html5.zip` as an **HTML** game. Verify root `index.html`, Gold home, BOT/LOCAL, hero select, each arena, audio, results and F7 capture inside itch.io's embedded environment before publishing. The prior assembled `APEX-CHAOS-R5-5-ARENAS-ITCHIO.zip` is an owner-test build; a newly compiled build from this source is **not claimed byte-identical** until compared.

## Main source locations

- `src/App.jsx`, `src/styles.css` — R5 React/Gold shell.
- `src/ui/FreeBattleBeyondHud.jsx` — stage selector, tactical HUD and modifiers.
- `src/game/runtimeManifest.js` — versioned lazy runtime loading.
- `public/apexEngine.js` — authoritative common game engine and wall physics.
- `public/game/modes/arsenalBattleRuntime.js` — battle engine integration.
- `public/game/evolution/` — five-stage originals, shader, audio, VFX and art atlas.
- `public/game/arsenal/apexBeyond*Engine.js` — compatible Free Battle mechanics/bridges.
- `scripts/check-arena-*.mjs` — collision and arena integrity tests.
- `docs/arena/` — integration decisions and cleanup evidence.

## Provenance, recovery and limitations

The current source combines the pre-existing APEX CHAOS R5 product repository with the user-provided `APEX-CHAOS-5-ARENAS-EDGE-CLEANUP-FIX(1).zip`. The original verified R5 HTML5 baseline is available in [GitHub Releases](https://github.com/Khanh-glitch/APEX-CHAOS/releases/tag/owner-html5-f7-f8-20261101-r5). The previous main state is preserved at [`archive/main-pre-five-arenas-20261117`](https://github.com/Khanh-glitch/APEX-CHAOS/tree/archive/main-pre-five-arenas-20261117). Source availability does not imply every third-party asset is licensed for redistribution. Release, browser, audio, capture and hardware-performance acceptance must be assessed independently.
