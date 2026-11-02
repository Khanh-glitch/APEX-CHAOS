# QA_REPORT — Soul of Hero · Map Lab Studio

Chạy lúc 2026-11-01T17:30:20.592Z bằng hai bộ kịch bản `qa/qa.mjs` + `qa/qa_extra.mjs` (Playwright + Chromium thật, headless) trên **file://SoulOfHero_MapLab.html** (bản offline), viewport 1280×720 và 1600×900.

**Kết quả: 64/64 kiểm thử đạt · lỗi JavaScript console/pageerror: 0.**

| # | Kiểm thử | Kết quả | Ghi chú đo được |
|---|---|---|---|
| 1 | App opens at 1280x720 without JS error | PASS |  |
| 2 | Whole page does not scroll (1280x720) | PASS |  |
| 3 | Seed map is loaded and editable data | PASS | {"land":8,"rivers":17,"roads":92,"pois":81,"zones":23,"elders":6,"res":280,"bridges":12,"docks":27} |
| 4 | All 22 tool buttons visible & not occluded (1280x720) | PASS |  |
| 5 | Canvas occupies most of the screen | PASS | 870x641 |
| 6 | 7 view modes render | PASS |  |
| 7 | Wheel zoom keeps point under cursor | PASS | 0.42→0.80 drift 0.5,0.6 |
| 8 | Space+drag pans | PASS | dx=-189 |
| 9 | Brush creates a new island in the sea | PASS | 8→9 |
| 10 | Subtract brush edits an existing island (bay / split) | PASS | 64→48 |
| 11 | Draw river creates a tributary | PASS |  |
| 12 | Tributary mouth auto-attached to parent river | PASS | {"kind":"river","ref":"rv_silver"} |
| 13 | Validation HYD-LINK: graph agrees with geometry | PASS | 18 dòng; mọi hợp lưu/hồ/cửa biển khớp trong dung sai 7u và cùng thành phần liên thông. |
| 14 | Drag POI moves it | PASS | Δ=(40,30) |
| 15 | Drag build-zone vertex reshapes zone | PASS | moved (-25,22) |
| 16 | Draw new build zone | PASS |  |
| 17 | Bridge tool places a bridge at a road/river crossing | PASS | 12→12 |
| 18 | Dock tool places a dock on a lake shore | PASS |  |
| 19 | Undo/redo multi-step | PASS | history=11; after undo {"land":9,"docks":27,"zones":23}; after redo {"land":9,"docks":28,"zones":24} |
| 20 | House test returns tradeoffs | PASS | 13 lines |
| 21 | Smart tool yields a PREVIEW proposal (no auto-edit) | PASS | proposals=1 |
| 22 | Dock suggestion proposals appear with explanation | PASS | 8 proposals |
| 23 | Validation engine reports PASS/WARNING/UNKNOWN/FAIL | PASS | {"PASS":30,"WARNING":3,"UNKNOWN":5,"FAIL":2} |
| 24 | Block test re-runs validation with blocked bridge | PASS |  |
| 25 | Save project downloads JSON | PASS | 326 KB |
| 26 | Autosave restores edited project after reload | PASS | [9,18,81,24,28,12] vs [9,18,81,24,28,12] |
| 27 | Open/import project restores identical structure | PASS | [9,18,81,24,28,12] vs [9,18,81,24,28,12] |
| 28 | Terrain rasters round-trip through JSON | PASS |  |
| 29 | Snapshot A/B compare detects the change | PASS | changed=1 |
| 30 | Export PNG (2×) works | PASS | 18274 KB |
| 31 | Export SVG works | PASS |  |
| 32 | Export for Map Tower ZIP contains maps, overlays, JSON, reports, brief | PASS | ---------                     -------  66611880                     23 files  |
| 33 | Re-import JSON from Map Tower ZIP loses nothing | PASS | [9,18,81,24,28,12] vs [9,18,81,24,28,12] |
| 34 | View-only mode hides editor panels | PASS |  |
| 35 | Command palette finds & selects an object | PASS |  |
| 36 | Context menu opens | PASS |  |
| 37 | App opens at 1600x900 without JS error | PASS |  |
| 38 | Whole page does not scroll (1600x900) | PASS |  |
| 39 | Elevation brush raises terrain | PASS | Σelev 865330→865567 |
| 40 | Undo reverts elevation painting exactly | PASS |  |
| 41 | Biome brush paints desert cells | PASS | 1308→1595 |
| 42 | Canal tool creates canal linked to lake/river | PASS | [{"kind":"lake","ref":"lk_grey"},{"kind":"river","ref":"rv_grey_low"}] |
| 43 | Moving a parent river vertex keeps tributary attached (graph still connected) | PASS | HYD-LINK=PASS; parent moved Δ=22u; tributary mouth=river |
| 44 | Deleting a river updates dependants (mouth reset, dead-end flagged) | PASS | mouth=none, HYD-DEAD=WARNING |
| 45 | Smooth proposal does not change map before approval | PASS |  |
| 46 | Approved smoothing changes coastline | PASS | 372:2049062.2 → 252:1371398.7 (đỉnh:chữ ký tọa độ) |
| 47 | Undo reverts automatic smoothing | PASS |  |
| 48 | Local regeneration changes only the selected region | PASS | inside=120 cells changed, outside=0 |
| 49 | POI placement suggestions come with explanations | PASS | #1 Xưởng cưa (4.0) :: Phù hợp «Xưởng cưa» · wood cách 0u · nước ngọt 11u · đường 0u · Rừng lá rộng · nội địa |
| 50 | Applying a suggestion adds exactly one POI | PASS |  |
| 51 | Quick-create archetype cluster adds a grouped set of POIs | PASS | +4 POI, group size 4 |
| 52 | Opportunity / POI-density / build-viability heatmaps render | PASS |  |
| 53 | Reachability overlay computed from selected POI | PASS | 3 overlay layers |
| 54 | Block-a-bridge test registers and re-validates | PASS |  |
| 55 | Group (Ctrl+G) links objects | PASS |  |
| 56 | Dragging one grouped object moves the whole group | PASS | [[1330,345],[1280,378]] |
| 57 | Ungroup (Ctrl+Shift+G) | PASS |  |
| 58 | Duplicate (Ctrl+D) | PASS |  |
| 59 | Delete removes duplicate | PASS |  |
| 60 | Locked object cannot be dragged | PASS |  |
| 61 | Hidden layer objects are not selectable | PASS |  |
| 62 | Elder tool adds a combat arena to Argus | PASS |  |
| 63 | Elder view + Ragnarok overlay renders | PASS |  |
| 64 | Validation still runs after all edits (no engine error) | PASS |  |

## Ảnh chụp thực (thư mục `screenshots/`)

Tất cả do trình duyệt thật chụp từ ứng dụng đang chạy (không phải mockup): `00_first_run_help`, `01_atlas_1280x720`, `view_1…7_*` (7 chế độ xem), `02_new_island`, `03_poi_moved`, `04_smart_panel`, `05_validation_open`, `06_snapshot_compare`, `07_view_only`, `08_palette`, `09_context_menu`, `10_atlas_1600x900`, `11_validation_1600x900`, `12_clean_viewonly_1600x900`. Bản đồ sạch xuất từ ZIP Map Tower: `samples/clean_map_export.png`.

## Trạng thái từng phần (trung thực)

| Phần | Trạng thái |
|---|---|
| Chỉnh sửa đảo (brush thêm/xóa, polygon), sông + nối phụ lưu, đường, cầu, bến, POI, vùng xây, Elder | **Hoạt động thật** (đã thao tác bằng chuột/phím trong QA ở trên) |
| Undo/redo, lưu/mở/autosave, snapshot A/B, export PNG/SVG/JSON/ZIP + nhập lại | **Hoạt động thật** |
| Validation (≈40 kiểm tra) | Hoạt động thật ở **tầng bản vẽ** — không thay thế nghiệm thu native/human (Bible §8) |
| Smart tools | Hoạt động thật, luôn qua xem trước. Chất lượng gợi ý POI/đường là heuristic, cần người thiết kế duyệt |
| Tái sinh cục bộ | Chỉ nhiễu độ cao + phân loại biome trong vùng chọn; không tạo lại sông/đường |

## Giới hạn còn lại (chưa làm hoặc chưa kiểm chứng)

1. **Chưa kiểm thử trên Windows/Edge thật** — chỉ Chromium headless trên Linux; file:// + localStorage dự kiến hoạt động trên Chrome/Edge.
2. Chưa có kiểm thử tải lớn (hàng nghìn đối tượng) và chưa kiểm thử màn hình HiDPI/4K thủ công.
3. Không có habitat quái, thời tiết, tốc độ thuyền/xe, giá Rương ký gửi, số tiền Ragnarok — validation báo **UNKNOWN**, không bịa số.
4. Ngưỡng độ dốc/khoảng cách/phân bố là **heuristic của Map Lab**, không phải luật Bible; có thể sửa trong `src/maplab/analysis.ts` (`RULES`).
5. Không có 'nhóm' đa cấp, căn chỉnh/phân phối đối tượng, xoay nhiều đối tượng cùng lúc; xoay/scale chỉ cho POI (Inspector).
6. Đồ thị cổng Atlas, tuyến Rương ký gửi seller, và 640×360 1× legibility **chưa chứng minh được** (cần bản dựng native).
7. Bản đồ khởi tạo là **đề xuất của agent**, chưa phải canon được người sáng tạo duyệt; "Hướng địa lý A" không có định nghĩa công khai để đối chiếu.
8. Nền địa hình raster có độ phân giải 8u/ô; thao tác sửa độ cao rất chi tiết (< 8u) không khả dụng.
