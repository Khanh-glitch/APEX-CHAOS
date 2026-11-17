<div align="center">

# APEX CHAOS

**Five arenas. Distinct fighters. No two battles play the same.**

A browser-based, top-down action arena game featuring character abilities, weapon pickups, reactive battlefields, and fast head-to-head combat.

![APEX CHAOS — real in-game BOT Battle, Scrap Basin Foundry](docs/media/apex-chaos-battle.png)

**BOT Battle** · **Local 1v1** · **BOT WAVE** · **Five Total Evolution Arenas**

</div>

## The game

In **APEX CHAOS**, two fighters enter a compact arena and compete using their own skills, tactical movement, and weapons collected during the match. The battlefield itself can change the fight: vents ignite, cryogenic machinery disrupts movement, and energy structures alter projectile behavior.

The **R5 × Total Evolution** update brings five distinct arenas to the existing APEX CHAOS combat system while retaining the Gold interface, original fighter identities, music, and sound design.

### What sets it apart

- **Character-led combat** — unique playable fighters and ability kits, including Newbot, Hunter, BOXE, Shuri, Crystala, Frost, and other members of the APEX CHAOS roster.
- **Five interactive battlefields** — each stage introduces its own architecture, hazards, environmental responses, and visual atmosphere.
- **Tactical mechanics** — impulse movement, timed deflects, overdrive, and weapon pickups create high-impact reversals.
- **Multiple ways to play** — fight a BOT, play a local head-to-head match, or enter the separate BOT WAVE experience.
- **Presentation built for action** — arena-focused camera, Gold battle HUD, fighter-specific visuals and audio, and an owner-only portrait recording workflow.

## The arenas

| Arena | Battle identity |
| --- | --- |
| **Scrap Basin Foundry** | Furnace vents, molten-slag pressure, and electromagnetic bumpers. |
| **Cryo-Turbine Vault** | Breakable coolant cores, slowing frost fields, and rotating machinery. |
| **Lorentz Railyard** | Projectile-acceleration gates and periodically overloaded rails. |
| **Obsidian Prism Sanctum** | Refraction monoliths and energy lines that influence combat. |
| **APEX Tournament Pro** | A hazard-free competitive arena focused on direct fighter matchups. |

<div align="center">

<img src="docs/media/apex-chaos-home.png" alt="APEX CHAOS — Gold Home interface" width="78%" />

<sub>Gold Home — captured from the compiled game in Chromium.</sub>

</div>

## Get started

**Requirements:** Node.js 22 and pnpm 9.15.9. The editable project uses React 18, Vite 5, and JavaScript. Run it through a local development server, not by opening the source `index.html` directly.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://localhost:5173/** in your browser.

### Build for production

```bash
pnpm build
pnpm test:shipping-dist
```

The optimized browser build is created in `dist/`.

### Package for itch.io

The packaging step adjusts first-party resource paths so the HTML5 game works when itch.io hosts it inside a nested directory.

```bash
pnpm build
printf '%s\n' "$(git rev-parse HEAD)" > dist/ITCH_GUEST_BUILD_SHA.txt
node tools/packItchPortable.mjs
(cd dist-itch-html5 && zip -qr ../APEX-CHAOS-itch-html5.zip .)
```

Upload `APEX-CHAOS-itch-html5.zip` as an **HTML** project on itch.io. It contains a root-level `index.html` and the local assets required by the compiled game. Test the exact uploaded package before making it public.

## Development & architecture

| Directory | Purpose |
| --- | --- |
| `src/` | React application, Gold shell integration, UI, runtime loading and recording. |
| `public/apexEngine.js` | Core arena combat engine. |
| `public/game/evolution/` | Total Evolution arena simulation, shaders, VFX, audio and stage catalogue. |
| `public/game/arsenal/` | Combat mechanics, weapon handling, and Free Battle adapters. |
| `public/assets/` | Shipped visual and audio resources. |
| `gold-mission-account/` | Source for the integrated Gold account and missions UI. |
| `docs/gold-ui/current/` | Canonical Gold UI source required by the generation pipeline. |
| `tools/`, `scripts/` | Build tooling, integrity checks, regression tests, and packaging. |

Validate the arena integration before shipping:

```bash
node scripts/check-arena-integration.mjs
node scripts/check-arena-boundaries.mjs
pnpm test:runtime-revision
```

**Release verification:** The R5 × Total Evolution source was built and exercised in desktop and mobile Chromium, including the path from Start → Gold Home → fighter selection → live BOT Battle. The [browser acceptance run](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/44002221550) records these checks. This is **not** a blanket performance certification or a substitute for testing every stage and mode on your target hardware.

For source history, integration details and maintenance decisions, see [Arena integration notes](docs/arena/ARENA-TRANSPLANT.md) and [Repository maintenance](docs/maintenance/REPOSITORY_HYGIENE.md). Historical experimental files are preserved in the [source-history archive](https://github.com/Khanh-glitch/APEX-CHAOS/tree/archive/main-pre-source-hygiene-r2-20261117), not carried into the primary shipping tree.

## Project status & rights

**Current branch:** `main` — **APEX CHAOS R5 × Total Evolution**.

APEX CHAOS is an independently developed project. No open-source license is provided by this repository; viewing the code does not grant permission to redistribute the game or its assets. Third-party asset provenance is documented separately where available.

---
<div align="center"><sub>APEX CHAOS · Built for the arena.</sub></div>
