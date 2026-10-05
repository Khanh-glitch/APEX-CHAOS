# R44 Owner Playtest — Slice A evidence (P0 playable build)

Revision: `20261005-owner-playtest-r44`
Base: `c856708f` (`assets(owner-playtest): preload Core Six UI art and selected UI SFX`), parent `016d314f` (r43 closure)

Scope of this slice: the P0 playable build — battle presentation visibility, Core Six
owner-playtest selection, the 12,000 AC seed, and the real Core Six art mapping.

---

## A1 — P0 black/invisible battle presentation (owner finding 5)

### Root cause (proven, not inferred)

`public/game/gold/goldProductBridge.js` hid the legacy battle UI with a **global**
`document.getElementById(id)` lookup that ran **after** the Gold donor mount:

1. `mountBattleHud()` parks colliding legacy ids (the legacy `#hud` loses its `id` and is
   marked `data-apex-parked-id="hud"`) so the donor's own `$('#hud')` resolves to the donor.
2. The donor battle HUD therefore **owns `#hud`** for the whole battle.
3. `onBattleLive()` → `hideLegacyBattleUi()` → `document.getElementById('hud')` resolved the
   **Gold donor HUD**, not the parked legacy HUD, and set `style.display = 'none'`.

Result: the battle ran with audio but the presentation was black/invisible — exactly the
owner-reported symptom. The engine had the same ambiguity
(`public/apexEngine.js` `hud.style.opacity = 0` at match end / menu returns) and
`public/game/modes/arsenalBattleRuntime.js` (`hud.style.opacity = 1`).

### Fix

* **Exact legacy references captured BEFORE the donor mount parks their ids**
  (`captureLegacyBattleUi()` runs before `parkCollidingIds()`); only those references are
  ever hidden/restored.
* **Protected set captured by exact reference at mount time** — the Gold host, every
  authored donor node, the authored arena slot, `#game-wrapper`, `#game-canvas`.
  Membership is deliberately *not* re-derived later: `relocateArena()` intentionally moves
  `#game-wrapper` (and the legacy overlays inside it) into the donor's arena slot, so a
  live containment test would misclassify those legacy overlays as donor nodes and let the
  legacy HUD survive beside Gold.
* `legacyUiElement(id)` resolves a legacy node without ever resolving the donor (parked-id
  marker first, then the element with that id **outside** `#battleHudHost`); published as
  `BRIDGE.legacyUiElement`.
* The engine's four legacy `#hud` lookups now route through the same helper, so a
  production write can never land on the donor.
* `setCritAccent()` targets `#battleHudHost #hud` explicitly instead of guessing by global id.

### Gate — `tools/testGoldBattleVisibilityGate.mjs` (`pnpm test:gold-battle-visibility`)

Executes the **shipping** bridge and the **shipping** engine helper against a deterministic
DOM shim (`tools/lib/goldDomShim.mjs`) and drives the real battle-live sequence.

```
RESULT: PASS (22 checks)
```

Highlights (verbatim from the run):

```
PASS legacy #hud id is parked while the donor owns #hud
PASS a global getElementById("hud") now resolves the DONOR (ambiguity proven)
PASS legacyUiElement resolves the LEGACY node, not the donor
PASS the real production match start was invoked exactly once
legacy nodes the hide touched: ["DIV#(parked:hud)=\"none\"","DIV#battle-controls=\"none\"",
  "DIV#countdown-overlay=\"none\"","DIV#end-screen=\"none\"","DIV#p1-name=\"none\"","DIV#combat-inspector=\"none\""]
PASS P0: the Gold donor battle HUD is NOT hidden after the legacy hide
PASS P0: the Gold host itself is not hidden
PASS legacy #hud IS hidden (must not survive beside Gold)
PASS legacy countdown/end-screen/battle-controls are hidden
PASS the live arena slot is not hidden
PASS #game-wrapper is not hidden
PASS #game-canvas is not hidden
PASS the donor root subtree is untouched
PASS unmount restores the legacy #hud id and visibility
PASS engine legacyUiElement never resolves the donor during a Gold battle
PASS no global getElementById("hud") remains in the engine production paths
```

**Honest limitation:** no browser is available in this environment (no Chrome, no
Playwright/Puppeteer, `node_modules` is empty), so real-match LIVE visibility is proven by
executing the shipping sources deterministically rather than observed in a browser. No
browser acceptance is claimed.

---

## A2 — Owner-playtest Core Six selection (owner finding 2)

One fenced switch in `public/game/arsenal/arsenalMetaRuntime.js`:

```js
const OWNER_PLAYTEST_CORE_SIX_UNLOCK = true;
const OWNER_PLAYTEST_CORE_SIX_UNLOCK_REVISION = '20261005-owner-playtest-r44';
function ownerPlaytestSelectionUnlocked(name) {
  if (!OWNER_PLAYTEST_CORE_SIX_UNLOCK) return false;
  return isProductPlayable(name);   // ONLY the current playable roster
}
```

It is applied in exactly one place — `canPublicSelect()` (the single production selection
authority used by the picker filter and `setLast`). The Gold bridge's `APEX_GOLD_LOCKED`
delegates to `meta.canPublicSelect()` instead of implementing a second bypass.

Selection-only guarantees (asserted by the gate):

* ownership (`owns()`), credits, the Shop and `poolLocked()` keep reading production truth;
* a future visible-but-locked fighter stays locked;
* Lucky Draw's unowned pool is **not** widened by test-selection availability.

### Gate — `tools/testOwnerPlaytestEconomyGate.mjs` (`pnpm test:owner-playtest-economy`)

```
RESULT: PASS (23 checks)
```

---

## A3 — Exactly 12,000 AC (owner finding 3)

Real production economy, no parallel currency:

```js
const OWNER_PLAYTEST_AC_SEED = 12000;
const OWNER_PLAYTEST_AC_SEED_REVISION = '20261005-owner-playtest-r44';
function applyOwnerPlaytestAcSeed(st) {
  const marker = st.ownerPlaytestAcSeed;
  if (marker && marker.revision === REV && marker.profile === KEY) return st; // never refill
  st.credits = OWNER_PLAYTEST_AC_SEED;
  st.ownerPlaytestAcSeed = { revision: REV, profile: KEY, at: Date.now() };
  return st;
}
```

Applied only in `load()`, through the real `save()` path, with a revision+profile-scoped
marker that survives `sanitize()`. `PRODUCT_ECONOMY.cleanStateCredits` is now `12000`.

A TDZ defect introduced by the first draft of this change (`save()` called from `load()`
before `let state = load()` initialised) was caught by the gate and fixed by hoisting the
state declaration — this would have broken first boot in production.

Verified behaviour:

| scenario | balance |
| --- | --- |
| first boot | 12,000 |
| legacy 425 profile, first r44 boot | 12,000 (upgraded once) |
| 12,000 → Lucky Draw (real 350 AC) | 11,650 |
| ordinary refresh after spending | 11,650 (no refill) |
| second ordinary refresh | 11,650 (no refill) |

---

## A4 — Real Core Six art mapping (owner finding 1)

### Root cause

`shell.html` resolved `const HEROES = (window.APEX_GOLD_ROSTER || <canonical fallback>)`.
`rosterFromProduction()` projected **only** identity/economy fields
(`name/color/accent/tag/productionId/playable/owned/locked`) and **dropped every art
field**, so with production present `HEROES[id].portrait` / `.art` were `undefined` — the
Fighter Pick rendered broken/placeholder art.

### Fix — merge, never replace

`public/game/gold/goldProductBridge.js` now carries the **immutable Git art authority**
whose every URL is a `gitPath` from
`docs/gold-ui/preload/OWNER_PLAYTEST_MEDIA_R44_MANIFEST.json` (nothing inferred), and the
state projection merges over it:

```js
heroes[key] = Object.assign({}, art, { name, color, accent, tag, productionId, playable, owned, locked, … });
```

Role → presentation slot mapping:

| manifest role | consumer |
| --- | --- |
| `PICK_ROSTER_COVER` | Fighter Pick roster card (`HEROES[id].portrait`) |
| `PICK_SELECTED_LARGE` | Fighter Pick selected hero (`HEROES[id].art`) |
| `BATTLE_HUD_AVATAR` | per-side battle HUD portrait (`heroPayload().portrait`) |
| `SKILL_PASSIVE/A1/A2` | `HEROES[id].skillIcons` authority |

Mirror deliberately has **no** `PICK_SELECTED_LARGE`; its `art` is left undefined and the
shell now skips instead of emitting a broken/placeholder `<img>`.

Shell wiring is done through **generator patches** (`SHL-S24/S25/S26` in
`tools/buildGoldCutover.mjs`) because `public/gold/` is generated output — never hand-edited.

### Gate — `tools/testCoreSixArtAuthorityGate.mjs` (`pnpm test:core-six-art`)

```
RESULT: PASS (99 checks)
```

Proves every applicable role survives the projection, no role falls back to a Gold
placeholder or an empty URL, the battle avatar is distinct from the compact roster cover,
and **all 35 role files match the R44 manifest `productionSha256` on disk**.

---

## Revision bump

`20261005-gold-cutover-r43` → `20261005-owner-playtest-r44` across
`src/game/runtimeManifest.js`, `tools/runtimeRevision.lock.json` (relocked, 38 versioned
runtimes), the gate expectation, and the generated Gold cache-bust URLs
(`src/game/goldAssetManifest.js`, the bridge `<script>` URL inside `public/gold/shell.html`,
`public/gold/manifest.json`). Browser caching is not disabled globally.

---

## Regression matrix vs the accepted pre-slice baseline

Baseline measured in a `git worktree` at `c856708f`; the same battery was then run on this
slice.

| | baseline | this slice |
| --- | --- | --- |
| runnable gates passing | 9 | 12 |
| runnable gates failing | 59 | 59 |
| **new failures introduced** | — | **0** |

The 3 additional passes are the new gates (`testGoldBattleVisibilityGate`,
`testOwnerPlaytestEconomyGate`, `testCoreSixArtAuthorityGate`).

The 59 pre-existing failures are environment-blocked or pre-existing drift, identical
before and after this slice:

* 37 × `Cannot find module 'jsdom'` (devDependency; `node_modules` is empty and `npm install`
  is not permitted in this workspace),
* 1 × `dist/ missing` (`testShippingDist` needs a build),
* browser/CDP gates with no Chrome available (`spawn … chrome.exe ENOENT`,
  `Chrome CDP page did not become ready`, `puppeteer-core` missing),
* `@napi-rs/canvas` missing,
* pre-existing assertion drift unrelated to this slice:
  `testArsenalProductGraph` → `semantic-graph-and-admin-boundary` (`3 !== 4` ACTIVE surfaces;
  `fighter-shop` is LOCKED — a product-availability decision outside this slice),
  `testHeroReworkHunterOwnerFixGates` → `runtime-cache-bust` (expects the stale
  `20261003-mirror-v1-r35` revision constant),
  `testHeroReworkSlimeGates` → missing `BOOT_GAME_RUNTIMES` export.

Gates directly affected by this slice and re-verified green:
`testRuntimeRevisionGate` (PASS `20261005-owner-playtest-r44`, 38 versioned runtimes),
`testProductionSourceHygiene` (exit 0), `tools/buildGoldCutover.mjs --check`
(CHECK OK — 70 generated files), `testArsenalLegacyMechanicIsolation` (PASS),
`testArsenalCurrentRenderHud` (PASS), `testArsenalProductGraph` economy/migration gates
(updated to the mandated 12,000 AC truth).

`tools/testGoldCrossLawHeadless.mjs` and `tools/testGoldBattlePathHeadless.mjs` cannot run
here (jsdom missing) — recorded honestly as unproven in this environment.
