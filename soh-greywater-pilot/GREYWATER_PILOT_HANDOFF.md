# GREYWATER POI DETAIL LAYER — PILOT HANDOFF

**Scope:** Greywater only (`po_greywater`). No other POI was converted. No GOLD geography, A0/A3 gameplay authority, production branch or Map Tower work was touched.

| | |
|---|---|
| Implementation branch | `arena/30956463-apex-chaos` (repo `Khanh-glitch/APEX-CHAOS`) |
| Commit | `20a4f209547952e22546fee83c31d19fb761c725` (the code + evidence commit; the only later commit on this branch substitutes this line and rebuilds the ZIP) |
| Work tree | `soh-greywater-pilot/` (a full Map Studio v3 copy; the pilot is that tree + patch) |
| Input | Soul-of-Hero branch `input/greywater-poi-pilot-20261102`, commit `0602b59af626d96fc2f76351cdf95ad66863f66e` |
| Custody | outer archive SHA-256 `4fbf68d10d3627de15aada1bb324649a6232aea3eceb84cb1911728fbc606bb8`, inner `INPUT_SHA256.txt` verified (`01 fa955382…`, `02 887a389c…`, `03 9a98e6a7…`, seed `f39847a1…`) → **INPUT_CUSTODY_OK** |
| PILOT POI | `po_greywater` `at [812,592]`, `arche "village"`, `rot 0.35005`, foot **41.6 × 28.6 u** → site frame **41 × 28 tiles @ 16 px** |
| Generated layout | seed `20261102` → **hash `72e847f2`**: 15 buildings · 72 props · 236 trees · 8 fences · 3 gate connections · spawn `[20.6,24.8]` |
| Patch | `qa/greywater-poi-layer.patch` (13 files, 178 481 B) — applies clean to a pristine `extracted/ms/src` (`git apply --check` OK) |

The deliverable is **inside the real Map Studio**, not a separate demo: `MapLabApp` gains an `open-detail` entry per POI that opens the full-screen `DetailStudio` (edit ⇄ play), and `project.details[poiId]` is stored in the same `.sohmap.json` document.

---

## 1. What was added (POI Detail Layer)

Versioned, keyed by stable POI id, absent ⇒ old files unchanged:

```jsonc
project.details = {
  "po_greywater": {
    version: 1,
    seed: 20261102,           // deterministic generation seed
    generated: { … },          // derived layout (never edited by hand)
    overrides: { … },          // hand edits: moves, adds, deletes, fence/path tweaks
    edited: true,              // any override present
    locked: false,             // freeze layout against regeneration
    hash: "72e847f2",          // layout identity for reproducibility claims
    play: { water, supplies, reads, lamps, used, lampsOn, x, y, dir }  // pilot play state
  }
}
```

`resolveDetail()` = `generated` ⊕ `overrides`; `layoutHash()` hashes only the resolved layout, so the same seed yields the same hash in a fresh browser (re-checked: seed `12345` → `7ccf8148`).

### Files

| File | Lines | Role |
|---|---|---|
| `src/maplab/detail/types.ts` | 265 | `PoiDetail`, `GeneratedLayout`, `LayoutOverrides`, `applyOverrides`, `layoutHash`, label tables |
| `src/maplab/detail/frame.ts` | 192 | site frame from `foot` (+4 tile margin), local↔world axes, `sampleContext`, `gateForAngle`, `buildConnections` |
| `src/maplab/detail/generate.ts` | 462 | 15 fixed lots on a 41×28 grid, south-facing doors, BFS gate spurs, fences, ~72 props, wooded margin, spawn |
| `src/maplab/detail/grid.ts` | 178 | `SiteGrid` (walkable/solid/water/buildingId), dithered biome base, ragged `stampPath` |
| `src/maplab/detail/proto-art.ts` | 179 | **copied prototype primitives** (see §2) |
| `src/maplab/detail/sprites.ts` | 365 | village sprite atlas built with those primitives |
| `src/maplab/detail/render.ts` | 551 | ground cache, y-sorted facades (walls/roof/windows/door), roof fade, foliage, particles |
| `src/maplab/detail/play.ts` | 211 | deterministic session: tile collision (`RADIUS 0.3`), `SPEED 3.1`, proximity target, finite interactions, save |
| `src/maplab/ui/DetailStudio.tsx` | 765 | full-screen studio: edit/play tabs, undo/redo, lock, clear overrides, tools, zoom 1–4, seed + regen, PNG/JSON export, HUD/toast/notice |
| `src/maplab/types.ts`, `store.ts`, `ui/MapLabApp.tsx`, `ui/maplab.css` | — | additive: `Project.details?`, `UIState.detailOpen`, entry button, `/* POI DETAIL STUDIO */` styles |

Total new code: 2 403 lines (`detail/`) + 765 (`DetailStudio.tsx`) = **3 168 lines**.

### Geography honoured

`foot` is used only as the **site boundary** (plus 4-tile margin). Everything inside is generated against the real seed data:

* `rv_grey_up` (width 4) and `rv_grey_low` (width 7) → water tiles + banks inside the frame; `rv_silver` stays 48 u outside.
* Roads `rd_9`, `rd_b` start at `[812,592]` → 3 gate connections are BFS-routed from the nearest road stroke into the site, so the village opens onto the existing road network (not a closed island).
* Bridges `br_3 [855,576]`, `br_9 [778,457]`, docks `dk_grey_s/n`, `dk_confl`, spawn `sp_lake [790,622]` are untouched and remain outside/adjacent; the site never crosses them.
* Terrain inside the frame is sampled from the stock `terrain.ts` (`elevAt/biomeAt`) and only *coloured* per tile — no raster is rewritten.
* Site rotation is the POI's `rot 0.35005`, so the village orientation matches the seed footprint instead of being axis-aligned to the world.

---

## 2. Prototype code genuinely reused

Source: input archive `01_original_prototype.zip` (`sha256 fa955382…`) → `reference/prototype/src/game/{art,render,world}.ts`.

| Prototype code | Reused as | Adaptation |
|---|---|---|
| `mk()`, `outlineCanvas()`, `hex()`, `ell()`, `shade()`, `strs()`, `P()`, `R()` (art.ts / render.ts primitives) | verbatim in `detail/proto-art.ts` | none — same 1-px outline convention `#140c14` |
| `PAL`, `texel(kind,x,y)` (render.ts) | verbatim, reduced to the ground kinds a POI site needs | `// ADAPTED:` — no `RunState`, indexed by site tile |
| `buildHero()`, `drawHero()`, `drawHeroRoll()`, `drawHeroDead()` + hero palette | verbatim atlas builder | `// ADAPTED:` — frames keyed by `Dir` only |
| `shadowSprite()` / shadow mask builder | verbatim | `// ADAPTED:` sized to sprite w/h |
| `world.ts` tile semantics (16 px tile, walkable/solid/water, building-at-tile) | re-implemented in `grid.ts` against the site frame | new code, same semantics |
| Prototype HUD/notice interaction language (prompt key `E`, toast line) | `DetailStudio` HUD + `play.ts` prompt/toast | new code, prototype wording |
| Building/street art direction (2–3 storey timber, pitched roofs, plank doors, hanging signs) | `sprites.ts` atlas | **newly authored** sprites drawn with the reused primitives — no prototype village sprite was copied wholesale (the prototype draws buildings procedurally in `render.ts`) |

Not reused: prototype `world.ts` generator (deterministic island synthesis), the 640×360 canvas scaler, and the walk simulation constants — Map Studio owns geography; the pilot must not regenerate the island.

---

## 3. Evidence — screenshots (real Chromium, 1×)

All in `qa/shots/`, captured with `@sparticuz/chromium` + `puppeteer-core`, viewport 1600×1000, `deviceScaleFactor: 1`, app served at `localhost:3000` (dev) / `file://` (standalone).

| Shot | What it shows |
|---|---|
| `60_map_app_with_entry.png` | stock Map Studio with the new per-POI **Mở chi tiết** entry |
| `61_studio_edit_1x.png` | Detail Studio, edit tab, 1× |
| `62_village_1x.png` | Greywater at 1× — 15 buildings, streets, well, fences, 236 trees |
| `63_studio_selected_building.png` | inspector on `b_hall` (site boundary `foot` + bounds) |
| `64_studio_drag_override.png` | drag `x 26 → 27`, override recorded |
| `65_play_spawn.png` | play mode at spawn, HUD/prompt/toast/legend anchored |
| `66_play_inside_roof_fade.png` | inside the hall — roof alpha 0.12, room readable |
| `67_play_well_feedback.png` | `E Giếng làng Greywater` → toast `Múc nước sạch +1 · tổng 1` |
| `68_play_notice_modal.png` | notice board modal |
| `69_play_lantern_street.png` | lantern toggled on, street lit |
| `70–73_prototype_*` | original prototype at the same 1× discipline (canvas 640×360 upscaled) |
| `74_bridge_kit_1x.png`, `75_bridge_kit_greywater.png` | **rejected Bridge kit** on the same POI (30 % island / 200 % Greywater): trees, river, roads and a flat yellow marker — no buildings, entrances or playable geometry |

Explicit comparison, Greywater vs prototype:
* **In favour of the pilot:** buildings have façades, pitched roofs, windows, doors and interior floors at the prototype's 16 px scale; roofs fade when you walk in; every door faces south; the village is wired into the real road/river network.
* **In favour of the prototype:** it has walking NPCs, HUD resource bars, day/time/weather and a hotbar; its building footprints vary in size and rotation, while the pilot's 15 lots are rectangles sharing the site's single rotation (`0.35005`); the pilot's forest ring (236 trees) is denser than the prototype's village surroundings.
* Neither difference is a substitute for the owner's judgement — see gate 1.

---

## 4. Automated QA — 25 / 25 PASS, 0 JavaScript errors

`qa/pilot-test.mjs` (run in a real Chromium against the dev server), result snapshot `qa/qa_results.json`, timestamp `2026-11-02T12:09:30.789Z`, `errors []`:

`play mode starts a session` · `keyboard moves the hero — Δ=(0.00,-2.38)` · `walls block movement — y=8.86 wallTileY=7` · `door tile puts the hero inside (roof fades) — inside=b_hall` · `well increments water — "Múc nước sạch +1 · tổng 1"` · `crate usable exactly once` · `notice board opens a readable notice` · `lantern toggles — {lamps:1,on:[true]}` · `HUD mirrors counters` · `play state written to the detail record` · `drag moves a building and records an override — x 26→27` · `undo → 26` · `redo → 27` · `layout lock blocks dragging` · `add-building tool → 16 total` · `delete → 15 total` · `seed field accepts 12345` · `regen is deterministic — 72e847f2→7ccf8148` · `manual overrides survive regeneration` · `autosave stores the detail record` · `autosave keeps overrides and play counters` · `reload restores the same layout hash` · `reload restores overrides` · `reload restores play progress` · `export still carries 81 POIs + detail (249 378 B, 92 roads)`.

Independently: `node scripts` free `npx tsc --noEmit` is clean for `src/` (pre-existing errors live only in `reference/prototype/`, untouched), `npx next build` succeeds (`/`, `/_not-found`, `ƒ /api/health`) when `DATABASE_URL` is exported (stock `/api/health` requires it).

### Save / reload

* Autosave key `soh-maplab-autosave-v1`; the saved document keeps `project.details.po_greywater` — seed, overrides, hash, lock and play state all survive a page reload (asserted in QA 20–24, screenshot `50_after_reload.png`).
* `qa/samples/sohmap_with_greywater_detail.json` — canonical `serializeProject()` output of the seed + the detail layer (249 378 B, 81 POIs, 92 roads, 17 rivers).
* `qa/samples/greywater_poi_detail.json` — the standalone `details.po_greywater` blob (61 KB) for a Godot importer.
* Backward compatibility: a document **without** `project.details` loads and edits exactly as before; a document **with** it loads in the stock app (unknown keys are preserved verbatim, no migration needed).

### Geography / topology preservation — `GEOGRAPHY_PRESERVED`

`qa/tmp/geo-compare.ts` parses the archived seed (`reference/04_map_studio_default_seed.sohmap.json`) and the app's own saved document (`qa/samples/app_saved_with_detail.json`, captured by calling the stock `saveLocal()`), then compares canonically (key-order-insensitive). Result `qa/geo_preservation.json`:

| Collection | Count | Identical |
|---|---|---|
| land | 8 | ✅ |
| lakes | 5 | ✅ |
| rivers | 17 | ✅ |
| roads | 92 | ✅ |
| bridges | 12 | ✅ |
| docks | 27 | ✅ |
| zones | 23 | ✅ |
| resources | 280 | ✅ |
| spawns | 4 | ✅ |
| elders | 6 | ✅ |
| labels | 24 | ✅ |
| terrain `elev` + `biome` (base64, seed 2026, cell 8) | — | ✅ byte-identical |
| world | 2000 × 1400 | ✅ |
| POIs | 81 | ✅ identical **modulo null-valued keys** (see below) |
| Greywater `foot` | 4 pts | ✅ identical to 15 decimals |

Note on POIs: 63/81 records (plus `elder` on `po_tidecamp`) differ **only** in that the archived file contains `"deep": null` / `"elder": null` while the app rebuilds the seed through `src/maplab/seed.ts` (`deep: depth === "multi" ? … : undefined`), and `JSON.stringify` omits `undefined`. `seed.ts` is not touched by the patch (`grep -c seed.ts qa/greywater-poi-layer.patch` → `0`), so this delta is stock, layer-independent, and semantically empty (null vs absent).

---

## 5. Acceptance gates

| Gate | Verdict | Basis |
|---|---|---|
| **1. Visual quality** | **PENDING — OWNER JUDGES** (no agent self-acceptance) | Evidence only: `62_village_1x.png`, `65–69_play_*`, `70–73_prototype_*`, `75_bridge_kit_greywater.png`. Concrete risks: uniform site rotation, rectangle-only lots, no NPCs, forest ring denser than the prototype. |
| **2. Traversal & interaction** | **PASS** | QA 1–10 (movement, wall collision, door→interior, roof fade, well/crate/notice/lantern interactions, HUD), screenshots `65–69`. |
| **3. Editor operations** | **PASS** | QA 11–19 (drag override, undo, redo, lock, add, delete, seed, regen, overrides survive regen), screenshots `63–64`. |
| **4. Save / reload & reproducibility** | **PASS** | QA 20–25 + standalone `file://` reload keeping `hash 72e847f2`; `qa/samples/*`. |
| **5. Existing geography / topology preservation** | **PASS** | `qa/geo_preservation.json` → `GEOGRAPHY_PRESERVED` (table above). |
| **6. Godot integration** | **NOT TESTED** | The layer lives in `.sohmap.json` and in Map Studio only. `qa/samples/greywater_poi_detail.json` is the intended import payload, but no Godot loader was written or run in this pilot, and no Godot build was produced. |

---

## 6. Builds and downloads

| Artifact | Path | Notes |
|---|---|---|
| Offline single-file app | `public/downloads/SoulOfHero_MapLab.html` (762 416 B) | verified from `file://`: renders, opens the studio, play works, `saveLocal` + reload keeps `hash 72e847f2`, console `errs []` |
| Pilot ZIP | `public/downloads/SoulOfHero_MapLab_Greywater.zip` | HTML + guide + this handoff + QA/geo evidence + 39 screenshots + samples + patch + full `src/maplab` source |
| Patch | `qa/greywater-poi-layer.patch` | 13 files, applies clean to pristine `extracted/ms/src` |
| Samples | `qa/samples/sohmap_with_greywater_detail.json`, `greywater_poi_detail.json` | full project & POI payload |

Reproduce:

```bash
cd soh-greywater-pilot
npm install
DATABASE_URL="postgres://user:pass@localhost:5432/soh" npx next build     # production build
npx next dev -H 0.0.0.0 -p 3000                                          # dev server
node scripts/bundle.mjs src/maplab/standalone.tsx public/downloads/SoulOfHero_MapLab.html "Soul of Hero — Map Lab Studio"
node scripts/package-pilot.mjs                                            # rebuilds the ZIP
# QA (needs a real Chromium; see qa/README section of this doc)
node qa/pilot-test.mjs
```

---

## 7. Remaining defects / limits

1. **No Godot path.** `details` is JSON-only; a Godot importer for buildings/props/spawn/nav is unbuilt. Gate 6 stays NOT TESTED.
2. **No NPCs, no day/time/weather, no hotbar** in play mode — the prototype HUD is richer. Play mode is a *pilot sandbox* (tile collision + proximity interactions), not Godot gameplay: no inventory, no dialogue trees, no combat.
3. **Lot shapes are rectangles**; multi-room `deep` interiors are not modelled (roof fade is per building, and only `b_hall` was photographed).
4. **Single rotation per site** (`0.35005`). If the owner wants the mixed orientation of the prototype village, generation must jitter per-lot and re-run collision.
5. **Forest density** (236 trees, `hsh > 0.46`) may read as too enclosed versus the prototype; it is one constant in `generate.ts`.
6. **Performance** only sanity-checked (cached ground layer, no per-tile water sampling in the hot path); no stress test at high tree counts or 4× zoom on low-end hardware.
7. **Input is keyboard-only** (WASD/arrows + `E`); no touch/gamepad. Not tested on Windows/Edge.
8. **Undo history is in-memory** (not persisted); reload restores the layout, not the history.
9. Terrain raster is 8 u/cell; the site ground is authored per 16 px tile and blended by dithering, so a hard elevation change crossing the site can look slightly softer than elsewhere on the map.

## 8. Recommended next action

Owner review of `62_village_1x.png` + `65–69` against `70–73` and `75`, with a decision on three cheap knobs before any further work: **lot-shape variety (non-rectangular footprints)**, **per-lot rotation jitter**, **forest density**. If visual direction is accepted, the next round should be the **Godot importer** for `details.po_greywater` (buildings → tilemap + collision, doors → scene doors, props → interactables) so the layer can be judged in-engine — that is the only way gate 6 can move off NOT TESTED. No further POIs should be converted until Greywater is accepted in-engine.
