# BOXE R5.1 — owner Gold import, in-game playtest and evidence

## Exact checkpoint
- PR #88: `feature/boxe-bot-wave-gold-intake-20261014` → Dictionary C04. **Draft**, production `main` untouched.
- SHA-locked original Gold: `ccb889bb08cb2e741c4f7f5e0b33d08047c08fb28bfc1c31ae9401604444e2b2`.
- BOXE native-integrated Gold derivative (R5 game.html): **25,720,219 bytes**, SHA-256 `e766b7cdd0b57e87187992ba464d8bddae2c2ee0fac3996e46ab9b048f2d0256`.
- **Current importer ZIP:** `APEX_CHAOS_BOXE_BOT_WAVE_R5_GAME_INTEGRATION.zip`, size **58,551,747 bytes**, SHA-256 `c3b4670d6aea389dfff8200591743d7edb851dd5eedc87a1b8e8af341409fc87`. Earlier R5 ZIP hashes are superseded; the actual Gold game.html content has **not** changed.
- Original owner Gold and ten PNG assets are source masters under `masters/boxe-gold/` (nonshipping), with only the derived playable HTML under `public/bot-wave/game.html`. **These 13 bytes-backed files are still not on the GitHub branch** until the owner imports and pushes this package.

## What has already landed in GitHub
1. `src/game/productSurface.js` owns the labelled BOT WAVE PREVIEW route; `src/App.jsx` mounts a mode button AFTER the canonical Gold shell has loaded and opens full-screen `/bot-wave/index.html`. Phone fidelity iframe exits to top-level route.
2. Canonical `public/gold/shell.html` was restored **bit-for-bit** to CP16 manifest. Do not modify shell directly.
3. Wave registry, core BOXE R2/R3/R4 mechanics, Gold J source timings, randomized Rocket proc, near-target J short L dash planner, full wave-gun loadouts and chapter director are committed.
4. A new build dependency scanner finds native R5 Arsenal gun sprites from the registered weapon IDs plus the real audio refs from imported Gold without repeatedly scanning the whole 25MB embedded-base64 HTML. On import, `assetAudit` requires all referenced assets; `pruneShippingDist` cannot silently remove them.
5. Real desktop + landscape Chrome mode entry is tested. **After import** the browser gate additionally requires a live Gold game engine with BOXE/enemies and verifies actual HTTP/MIME delivery of weapon PNG and weapon SFX. Until import it reports **STAGED** without claiming playable integration.
6. Conventional BOXE owner law remains skill-damage ZERO in Auto Battle (sole exception empowered A2 finisher = 10% current HP). Gold damaging skill attacks exist only in BOT WAVE.

## One-pass owner import (local git is required)
1. Download the R5.1 ZIP from the ChatGPT delivery, extract it OUTSIDE the repo.
2. In your clean clone:
   `git checkout feature/boxe-bot-wave-gold-intake-20261014`
   `git pull --ff-only`
   `git status --short` should be blank.
3. Run from extracted directory:
   `python install_boxe_r5.py "C:\\path\\to\\APEX-CHAOS" --push`
4. The script checks **all 13 SHA-256 hashes before writing**, imports to 12 master targets plus 1 derived runtime, runs the existing Node Gold parity gate, validates exact bytes again and commits. Failed hash or Node gate cleans uncommitted outputs (rollback), leaving the git tree unchanged.
5. Wait for GitHub CI of the **new pushed SHA**. The R5 `BOXE R2 Staged Contracts` run must PASS: includes semantic R2–R5, production build/CP16/asset audit, C04 Chrome 5 viewport + Quick Equip, desktop/mobile BOT WAVE navigation **and live gameplay + 15 native assets**.
6. Open the branch-specific preview origin; choose **FREE BATTLE → BOT WAVE — BOXE PREVIEW**, press J near a robot (short Gold L auto-close), use K/L, get XP and choose upgrade cards. Do **not** assume `main` or production is updated.

## Strict remaining owner acceptance
- Real 10-wave human survivability and sound/impact feel, not just forced-KO QA.
- Original material/fracture/smoke/electric/contact and recoil fidelity to owner Gold; no re-created approximations.
- Native gun damage/cadence/reload fixed across waves, composition/spawn angles/number/HP may scale.
- Mobile landscape performance and SFX after a true player gesture.
- BOXE registered as public normal 1v1/BOT fighter is a **separate** promotion gate. The current integrated in-game preview is the BOT WAVE mode, not conventional BOXE fighter launch.
- Do not merge PR #88 or claim production playability before receipt.
