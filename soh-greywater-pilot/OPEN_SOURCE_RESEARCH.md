# OPEN_SOURCE_RESEARCH — Soul of Hero · Map Lab Studio

> Khảo sát thực hiện bằng GitHub API (license, ngày push gần nhất, sao, archived) + đọc LICENSE gốc, ngày 01/11/2026.
> Quy ước: **ĐÃ TÍCH HỢP** = mã của dự án thực sự nằm trong bundle `SoulOfHero_MapLab.html` và được gọi bởi mã Map Lab. Danh sách link thuần không được tính là tái sử dụng.

## 1. Nguồn chân lý gameplay đã đọc

| Nguồn | Kết quả |
|---|---|
| `docs/survival/CURRENT_PRODUCT_CONTRACT.md` (nhánh `feature/survival-rpg-foundation-20261029`, bản "BẢN GỐC CÓ HIỆU LỰC · 01/11/2026", 229 KB) | Truy cập được (repo công khai). Đã đọc §0–§II (K1–K8, J01–J20), §V (hợp đồng Map Tower, MAP-SPAWN-04/HOME-03/POI-02/LOG-03/U1–U5/CAMERA, First-escrow §5.4), §11.5 (Map Lead interface), §11.6–11.7. |
| `docs/survival/research/SOH_SIX_ELDER_INFINITY_STONE_SOURCE_ALIGNMENT_20261101.md` | Đã đọc: sáu Elder = sáu Infinity Stone; chỉ dẫn "place-first" (vùng Elder là địa điểm đọc được, không ẩn dụ trừu tượng), không sáu vòng đối xứng. |
| Phiên bản Bible mới hơn? | Đã so sánh md5 file `CURRENT_PRODUCT_CONTRACT.md` trên `main`, `feature/surv-a1-world-050a`, `feature/surv-s6-poi-depth-001`, `integration/gameplay-gpb-a3-20261101`: các nhánh đó **cũ hơn** (≤ 16 KB hoặc bản 30/10); nhánh `feature/survival-rpg-foundation-20261029` là bản hợp nhất mới nhất. |
| "Hướng địa lý A" | **Không tìm thấy định nghĩa** trong docs công khai (chỉ có ghi chú "0..1000×0..700 paper units"). Map Lab áp dụng các bài học đã xác nhận được nêu trong brief (đảo chính + quần đảo vệ tinh có sinh kế, POI rải nội địa, thủy hệ là mạng giao thông, Elder không đối xứng) và ghi rõ đây là **đề xuất**, không tuyên bố đã khớp "hướng A". |
| Mã map hiện tại của repo | Không dùng làm luật hay mẫu hình học (đúng chỉ dẫn). |

## 2. Dự án đã khảo sát

| Dự án | License (đã xác minh) | Bảo trì (push gần nhất) | Đánh giá | Quyết định |
|---|---|---|---|---|
| **Azgaar's Fantasy Map Generator** | MIT (LICENSE đã đọc) · 6.1k★ | 2026-10-31, tích cực | Rất đầy đủ (heightmap, Voronoi, sông, tỉnh…) nhưng là ứng dụng monolithic phụ thuộc biến toàn cục/DOM; không có API module để nhúng một phần; dữ liệu sông sinh ngẫu nhiên, không có đồ thị gameplay. | **Không nhúng mã.** Dùng làm tham chiếu phương pháp (heightfield → hillshade, glyph địa hình kiểu atlas, sông theo độ cao). |
| **Mapgen4 / Mapgen2** (Red Blob Games) | Apache-2.0 | 2026-03 | TypeScript, đẹp, brush địa hình tương tác, nhưng gắn chặt pipeline WebGL + lưới Delaunay riêng, hình lục địa do thuật toán quyết định → khó giữ "bản đồ được thiết kế có chủ đích" và khó xuất dữ liệu cấu trúc. | **Không nhúng.** Tham chiếu ý tưởng brush độ cao/biome. |
| **Konva** | MIT (LICENSE đã đọc) · 14.9k★ | tích cực | Scene graph canvas tốt cho vật thể rời; không có raster địa hình, không có boolean polygon, hit-test/export raster-vector hỗn hợp phải tự viết; overhead cho hàng nghìn glyph. | **Từ chối** — renderer riêng (`render.ts`) vì cần nền raster 2× + lớp vector có thể chỉnh. |
| Fabric.js (MIT), Paper.js (MIT, LICENSE đã đọc) | MIT | tích cực | Paper.js có boolean/curve nhưng là kiến trúc toàn cục riêng, không TS; Fabric thiên về editor ảnh. | Không dùng; lấy `polygon-clipping` (nhỏ, chuyên dụng) thay cho boolean của Paper. |
| Leaflet-Geoman (MIT), OpenLayers (BSD-2), MapLibre (BSD-3) | OSS | tích cực | Chuẩn GIS lat/lon + tile; bản đồ giả tưởng phẳng không cần phép chiếu/tile; vertex-editing UX là nguồn cảm hứng. | Không dùng; UX sửa đỉnh (double-click thêm, Alt+click xóa) lấy cảm hứng. |
| Excalidraw (MIT), **tldraw** | MIT / **giấy phép tldraw riêng** (LICENSE.md đã đọc: dùng production cần license) | tích cực | Editor vector tổng quát, không có khái niệm địa hình/thủy văn. tldraw bị hạn chế bởi license. | Không dùng (license + sai bài toán). |
| Tiled | GPL/BSD hỗn hợp | tích cực | Chuyên tile-map, không phù hợp atlas. | Không dùng. |
| Turf.js (MIT), rbush (MIT), javascript-astar (MIT) | MIT | ổn | Turf mặc định trắc địa; quy mô dữ liệu nhỏ nên không cần rbush; A* cần đa chi phí + penalty nên viết heap A* riêng (≈60 dòng). | Không dùng. |
| mewo2/terrain | API trả `NOASSERTION`, push 2016 | cũ | License không xác minh được → **không sao chép mã**. | Chỉ tham khảo khái niệm xói mòn/flux. |

## 3. Thành phần ĐÃ TÍCH HỢP (có trong bundle, được gọi thật)

| Thư viện | License | Dùng để | Mã Map Lab thực sự gọi |
|---|---|---|---|
| **polygon-clipping** 0.15 (mfogel) | MIT · push 2024-04 (ổn định, ít cập nhật — rủi ro: bảo trì chậm) | Boolean union/difference polygon: brush thêm/xóa đất, tách đảo, tạo vịnh/lỗ biển; cắt vùng xây khỏi hồ | `src/maplab/geom.ts` (`clipUnion`, `clipDiff`) → `src/maplab/interact.ts` (`applyLandBrush`), `src/maplab/seed.ts` (`zone`) |
| **simplex-noise** 4 (jwagner) | MIT · push 2024-07 | Nhiễu fBm cho độ cao, biome, hạt đất, texture | `src/maplab/terrain.ts` (`noise2`, `fbm`) → `generateTerrain`, `regenRegion`; `render.ts` |
| **d3-contour** 4 | ISC · push 2024-11 | Marching squares: đường đồng mức atlas từ heightfield | `src/maplab/render.ts` (`renderBase`) |
| **polylabel** (Mapbox) | ISC (LICENSE đã đọc) | Điểm đặt nhãn trong polygon (pole of inaccessibility) | `src/maplab/render.ts` (nhãn Elder) |
| **graphology** + `graphology-shortest-path` + `graphology-components` | MIT · push 2026-09 | Đồ thị đường bộ/xe/thủy lộ, thành phần liên thông, truy vấn kề cho Dijkstra | `src/maplab/graph.ts` (`buildNets`, `distMap`, `components`) → `validate.ts`, `smart.ts` |
| **JSZip** | MIT *hoặc* GPLv3 (chọn MIT, LICENSE đã đọc) | Export for Map Tower (ZIP) | `src/maplab/exporter.ts` (`exportMapTowerZip`) |
| **React 19 / react-dom** | MIT | UI inspector/panel | `src/maplab/ui/*.tsx` |
| **esbuild** | MIT | Đóng gói một file HTML tự chứa chạy offline | `scripts/bundle.mjs` (công cụ build, không nằm trong bundle) |
| Next.js | MIT | Chạy cùng mã trong web host (`/`) | `src/app/*` |

Danh sách phụ thuộc bắc cầu + toàn văn LICENSE: `THIRD_PARTY_LICENSES.md` (sinh tự động từ `node_modules` khi đóng gói).

## 4. Nhờ tái sử dụng, những gì KHÔNG phải lập trình lại

Phép boolean polygon bền vững (sweep-line, robust predicates), nhiễu simplex, marching squares/contouring, pole-of-inaccessibility, cấu trúc đồ thị + thành phần liên thông, nén ZIP, reconciler React, bundler. **Những gì phải tự viết** vì không có thư viện phù hợp: renderer atlas (hillshade + glyph), địa hình theo "feature spec" + khoét thung lũng theo sông (đáy sông chỉ đi xuống), A* theo địa hình, trình chỉnh sửa canvas, mô hình dữ liệu, và toàn bộ **validation engine theo Bible**.

## 5. Phương pháp tham chiếu (không phải mã sao chép)

- Heightfield + hillshade + ký hiệu địa hình kiểu atlas (Azgaar FMG, Mapgen4).
- Sông là polyline spline có `mouth`/`source` tham chiếu tường minh; đáy sông = running-minimum của địa hình dọc dòng (monotone) → "độ cao giải thích dòng chảy"; thác/ghềnh đặt tại đoạn đáy dốc nhất.
- Distance transform chamfer, Catmull-Rom spline, RDP simplify, Chaikin smoothing — thuật toán kinh điển, cài đặt riêng ở `geom.ts`/`terrain.ts`.

## 6. Rủi ro kỹ thuật đã biết

- `polygon-clipping` ít cập nhật (2024) — đã khóa phiên bản; có thể thay bằng `martinez`/`clipper2` nếu phát sinh lỗi hình học hiếm.
- Brush đất chạy boolean trên toàn polygon đảo; đảo > vài nghìn đỉnh có thể chậm (đã giảm đỉnh bằng RDP sau mỗi nét).
- Nền địa hình 2× (4000×2800) tốn ~90 MB RAM canvas khi zoom sâu; dựng lười sau 450 ms nhàn rỗi.
- Giới hạn lưu `localStorage` (~5 MB): autosave + tối đa 8 snapshot; file `.sohmap.json` là bản lưu chính.
