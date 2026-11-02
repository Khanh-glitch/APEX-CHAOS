# QA_REPORT — GREYWATER POI DETAIL PILOT

Chạy lúc 2026-11-02T12:09:30.789Z · harness: puppeteer-core + @sparticuz/chromium (headless Chromium), 1680x1050, deviceScaleFactor 1 · app: http://localhost:3000/ (Next dev build of soh-greywater-pilot).

**Kết quả: 25/25 PASS · lỗi JavaScript console/pageerror: 0.**

| # | Kiểm thử | Kết quả | Ghi chú đo được |
|---|---|---|---|
| 1 | play mode starts a session | PASS |  |
| 2 | keyboard moves the hero — Δ=(0.00,-2.38) | PASS |  |
| 3 | walls block movement — y=8.86 wallTileY=7 | PASS |  |
| 4 | door tile puts the hero inside (roof fades) — inside=b_hall | PASS |  |
| 5 | well interaction increments water — water=1 msg="Múc nước sạch +1 · tổng 1" | PASS |  |
| 6 | crate is usable exactly once — first="Nhặt vật tư +1 · tổng 1 (muối, dây, đinh)" second="Thùng này đã lấy hết." | PASS |  |
| 7 | notice board opens a readable notice | PASS |  |
| 8 | lantern toggles — {"lamps":1,"on":[true]} | PASS |  |
| 9 | HUD mirrors the session counters — {"water":"1","supplies":"1","lamps":"1"} | PASS |  |
| 10 | play state is written to the detail record — {"water":1,"supplies":1,"reads":1,"lamps":1,"used":{"crate_market":true},"lampsOn":{"lamp_plaza":true}} | PASS |  |
| 11 | drag moves a building and records an override — x 26→27 ov={"x":27,"y":2,"door":{"x":32,"y":8,"side":"s"}} | PASS |  |
| 12 | undo restores the building — x=26 | PASS |  |
| 13 | redo re-applies the move — x=27 | PASS |  |
| 14 | layout lock blocks dragging — {"locked":true,"x":27} | PASS |  |
| 15 | add-building tool creates a new building — {"n":1,"total":16} | PASS |  |
| 16 | delete removes the added building — {"n":0,"total":15} | PASS |  |
| 17 | seed field accepts a new seed — 12345 | PASS |  |
| 18 | regenerate with a new seed is deterministic output — 72e847f2→7ccf8148 | PASS |  |
| 19 | manual overrides survive regeneration — {"x":27,"y":2,"door":{"x":32,"y":8,"side":"s"}} | PASS |  |
| 20 | autosave stores the POI detail record — {"hash":"7ccf8148","seed":12345} | PASS |  |
| 21 | autosave keeps overrides and play counters — {"x":27,"y":2,"door":{"x":32,"y":8,"side":"s"}} | PASS |  |
| 22 | reload restores the same layout hash — 7ccf8148 vs 7ccf8148 | PASS |  |
| 23 | reload restores overrides — {"x":27,"y":2,"door":{"x":32,"y":8,"side":"s"}} | PASS |  |
| 24 | reload restores play progress — {"water":1,"supplies":1,"reads":1,"lamps":1,"used":{"crate_market":true},"lampsOn":{"lamp_plaza":true}} | PASS |  |
| 25 | project export still carries all 81 POIs and the detail layer — {"hasDetails":true,"bytes":249378,"pois":81,"roads":92} | PASS |  |

## Bảo toàn địa lý — GEOGRAPHY_PRESERVED

| Tập | Seed | App | Giống |
|---|---|---|---|
| land | 8 | 8 | ✅ |
| lakes | 5 | 5 | ✅ |
| rivers | 17 | 17 | ✅ |
| roads | 92 | 92 | ✅ |
| bridges | 12 | 12 | ✅ |
| docks | 27 | 27 | ✅ |
| zones | 23 | 23 | ✅ |
| resources | 280 | 280 | ✅ |
| spawns | 4 | 4 | ✅ |
| elders | 6 | 6 | ✅ |
| labels | 24 | 24 | ✅ |
| pois | 81 | 81 | — |

Terrain: seed 2026, cell 8, elev giống, biome giống. World 2000×1400. POI null-key note: 63/81 POIs + po_tidecamp(elder) differ only by archived null-valued keys (deep, elder); seed.ts (untouched by the patch) builds them as undefined so JSON.stringify omits them. Stock, layer-independent.

## Ảnh (thư mục `screenshots/`)

Chụp bằng Chromium thật ở 1× từ ứng dụng đang chạy: 60–69 (Map Studio + Detail Studio + play), 70–73 (prototype gốc để so sánh), 74–75 (Bridge kit bị loại), 80–82 (bản offline file://).

## Giới hạn

Godot integration NOT TESTED; play mode là sandbox pilot; không có NPC/thời tiết; chi tiết trong `GREYWATER_PILOT_HANDOFF.md` §7.
