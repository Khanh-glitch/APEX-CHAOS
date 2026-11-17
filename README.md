# ⚡ APEX CHAOS

<p align="center">
  <strong>Fast-paced Top-Down HTML5 Arena Action • Distinct Fighters • Five Dynamic Battlefields</strong>
</p>

<p align="center">
  <a href="https://realbae.itch.io/apex-chaos"><img src="https://img.shields.io/badge/🎮_Play_Now-itch.io-fa5c5c?style=for-the-badge&logo=itchdotio&logoColor=white" alt="Play on itch.io" /></a>
  <img src="https://img.shields.io/badge/Platform-Desktop_%7C_Mobile_Web-blue?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/Engine-HTML5_Canvas_+_React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/Bundler-Vite_5-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Access-Guest--First_(No_Login)-2ea44f?style=for-the-badge" alt="Guest First" />
</p>

---

<p align="center">
  <img src="https://raw.githubusercontent.com/Khanh-glitch/APEX-CHAOS/aadb387fb47c829f7749f42375b5717818c0c4fa/docs/media/apex-chaos-home.png" alt="APEX CHAOS — actual in-game Home screen" width="900" style="border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);" />
</p>

<p align="center">
  👉 <strong><a href="https://realbae.itch.io/apex-chaos">▶ PLAY APEX CHAOS INSTANTLY IN YOUR BROWSER</a></strong> 👈
</p>

---

## 🕹️ Overview & Product Positioning

**APEX CHAOS** is a high-octane, guest-first top-down HTML5 arena brawler engineered for pure action and zero friction. Jump directly into battle with zero downloads, installs, or account setups required.

Featuring distinct fighters with proprietary skill sets, game-changing arsenal weapon pickups, and intense interactive battlefields, APEX CHAOS combines snappy retro arcade combat with modern fluid web execution across both desktop and mobile web browsers.

### 🌟 Core Highlights

- **⚡ Instant Guest-First Gameplay:** Zero barriers to entry—open link, pick your fighter, and clash.
- **🥊 Distinct Fighter Archetypes:** Unique kits, distinct passives, dynamic rage states, and signature combo flows.
- **🔫 Arsenal Weapon Pickups:** Dynamic battlefield drops that dramatically tilt tempo and positioning.
- **🏟️ 5 Total Evolution Arenas:**
  - ⚙️ **Scrap Basin Foundry**
  - ❄️ **Cryo-Turbine Vault**
  - 🚆 **Lorentz Railyard**
  - 🔮 **Obsidian Prism Sanctum**
  - 🏆 **APEX Tournament Pro**
- **🎮 Multiple Game Modes:**
  - **BOT Battle:** Hone skills against responsive AI with scalable difficulty.
  - **Local 1v1:** Pure couch-competitive versus on a shared display or inputs.
  - **BOT WAVE:** Relentless horde survival mode testing endurance and crowd control.

---

## 📸 Gameplay Preview

<p align="center">
  <img src="https://raw.githubusercontent.com/Khanh-glitch/APEX-CHAOS/aadb387fb47c829f7749f42375b5717818c0c4fa/docs/media/apex-chaos-battle.png" alt="APEX CHAOS — actual arena battle screenshot" width="900" style="border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);" />
</p>

---

## 📂 Architecture & Directory Layout

This shipping repository contains the core game runtime and minimum production build inputs.

| Path | Purpose & Lifecycle |
| :--- | :--- |
| `src/` | Active React application, UI shell, runtime loader, local profile & localization |
| `public/apexEngine.js`<br>`public/game/` | Canonical Canvas gameplay runtime, fighter logic, combat mathematics & arena controllers |
| `public/assets/`<br>`public/gold/`<br>`public/bot-wave/` | Production WebP art, synthesized/recorded SFX, Gold interface, and BOT WAVE modules |
| `public/portrait-studio.html` | High-fidelity character recording & owner portrait capture utility |
| `gold-mission-account/`<br>`result-gold/` | Isolated Gold UI suites integrated directly into the compiled experience |
| `tools/` | Automated asset manifest generation, packaging scripts & build pipelines |
| Root Configuration | `vite.config.js`, `package.json`, `pnpm-lock.yaml`, and build configurations |

> **Note on Assets & Licenses:** The `public/` directory preserves all legal font and asset license notices. Historical raw art donor packs, deprecated test fixtures, benchmark scripts, and inactive backend migrations are maintained on the [archive branch](https://github.com/Khanh-glitch/APEX-CHAOS/tree/archive/main-before-runtime-only-20261117).

---

## 🛠️ Development & Build Pipeline

### Prerequisites
- **Node.js**: `v22.x`
- **Package Manager**: `pnpm` (version `9.15.9`)

### 1. Local Development
```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```
> Open the local Vite URL output in your terminal (default: `http://127.0.0.1:5173/`).

### 2. Production Build
```bash
pnpm build
```
Compiles and bundles the optimized production web assets into the `dist/` directory. You can preview the build locally using:
```bash
pnpm preview
```

### 3. Packaging for itch.io HTML5
```bash
pnpm package:itch
```
- Builds the game and creates a nested-path-compatible `dist-itch-html5/` distribution along with a Git SHA verification receipt.
- **To upload to itch.io:** Zip the **contents** of `dist-itch-html5/` (ensuring `index.html` sits directly at the root of the ZIP file) and upload it to your [itch.io project dashboard](https://realbae.itch.io/apex-chaos).
- *Remember: Committing to GitHub does not automatically publish to itch.io.*

---

## 🏛️ Archived Development & Historical Recovery

For historical design cuts, raw experiments, and previous full-stack assets, reference the snapshot branch:

🔗 **[Full Snapshot Before Runtime-Only Cleanup](https://github.com/Khanh-glitch/APEX-CHAOS/tree/archive/main-before-runtime-only-20261117)**

The archive branch preserves canonical Gold design files, QA test suites, original audio/visual sources, and legacy cloud setups. Repository cleanup does not claim gameplay balance or rendering FPS shifts; prior balance QA metrics remain tracked in [Issue #131](https://github.com/Khanh-glitch/APEX-CHAOS/issues/131).

---

## ⚖️ Rights & Licensing

**APEX CHAOS** is an independent game project. Public source code visibility is provided for review and runtime distribution purposes, and does not grant rights to reuse or commercially redistribute the game, branding, original characters, or assets. Third-party packages, fonts, and dependencies remain subject to their respective open-source licenses.

---

<p align="center">
  Crafted with passion for fast-paced arcade brawling. Ready to enter the arena? <br>
  👉 <strong><a href="https://realbae.itch.io/apex-chaos">Play APEX CHAOS on itch.io</a></strong>
</p>
