# Soul of Hero · Map Lab Studio — Hướng dẫn sử dụng (PC)

## Mở ứng dụng (Windows, không cài đặt, offline)
1. Giải nén `SoulOfHero_MapLab_Studio.zip`.
2. Bấm đúp **`Open_MapLab.bat`** (hoặc mở thẳng `SoulOfHero_MapLab.html` bằng Chrome/Edge). Không cần Python, npm hay mạng.
3. Lần đầu mở sẽ thấy bản đồ Soul of Hero đã thiết kế sẵn (**ĐỀ XUẤT của agent, chưa phải canon**). Mọi thứ đều chỉnh sửa được.

> Bản web cùng mã nguồn chạy tại `/` khi chạy `npm run build && npm start` (chỉ dành cho dev).

## Bố cục màn hình
Thanh trên: Dự án / Xuất / Undo-Redo / Chế độ xem (1–7) / Zoom / Snap / Lưới / **Tìm–lệnh (Ctrl+K)** / Ragnarok / **Chỉ xem (Tab)**.
Trái: 22 công cụ (phím tắt ghi ở góc nút; rê chuột để xem tooltip). Giữa: canvas (+ minimap thu gọn được). Phải: **Inspector** (đổi theo đối tượng), **Layers** (bật/tắt/khóa, danh sách đối tượng), **Smart** (heatmap, đề xuất có xem trước), **Snapshots** (so sánh A/B). Dưới: thanh kiểm tra Bible (thu gọn/mở rộng, bấm thẻ để nhảy tới đối tượng lỗi).

## Điều hướng
Lăn chuột = zoom theo vị trí con trỏ · **Space + kéo** (hoặc H) = pan · **F** zoom vừa · click minimap để nhảy · Tab = chế độ chỉ xem (ẩn mọi panel).

## Thao tác chỉnh sửa chính
| Việc | Cách làm |
|---|---|
| Chọn / đa chọn / chọn khung | **V**; click, Shift+click, kéo vùng trống. Ctrl+A chọn tất cả. |
| Di chuyển | Kéo đối tượng (tự kéo cả nhóm). Snap lưới/bắt điểm bật-tắt bằng nút **Snap**. |
| Sửa hình dạng | Chọn 1 đối tượng → kéo chấm trắng; **double-click cạnh** = thêm đỉnh; **Alt+click đỉnh** hoặc Delete (khi đã chọn đỉnh) = xóa đỉnh. |
| Tạo đảo / vịnh / lỗ biển | **B** (brush thêm đất, kéo ngoài biển = đảo mới) · **N** (brush xóa: vịnh, eo biển, lỗ biển, tách đảo) · **P** vẽ polygon đất. `[` `]` đổi cỡ brush. |
| Độ cao / biome | **E** (nâng/hạ/làm mượt/san phẳng, Shift = ngược) · **G** (chọn biome rồi sơn). |
| Sông / kênh / hồ | **R** vẽ sông theo chiều chảy (đầu cuối tự nối vào hồ/sông/biển — Inspector hiện cửa/nguồn) · **C** kênh (cần lý do) · **L** hồ. Inspector: đoạn đi thuyền, thác/ghềnh/đập/âu, đảo hướng chảy. |
| Đường | **D**, chọn loại (xe hàng / người đi / đường rừng / ven sông / phà). Đầu cuối bắt vào POI, bến, đường khác. Inspector: «Đặt cầu tự động». |
| Cầu / bến | **J** (cầu tại giao cắt đường–sông) · **K** (bến, click sát bờ — tự gắn vào hồ/sông/biển). Inspector: «Thử chặn» để mô phỏng mất cầu/bến. |
| POI | **O**: chọn archetype trong thư viện (click hoặc **kéo-thả vào bản đồ**). Inspector: đổi tên, xoay/scale, footprint (kéo ô vuông), khu sâu, lối rút, tài nguyên, điều kiện, quan hệ POI, độ chắc chắn. |
| Vùng xây nhà | **Z** vẽ vùng; Inspector: đất/nước/độ dốc/tag. **Y** = *Thử nhà* tại điểm bất kỳ → lợi thế/bất lợi (nước, gỗ/đá, đường, bến, địa thế, UNKNOWN habitat). |
| Sáu Elder | **T**: chọn Elder + phần (ngoại vi / lõi / khu chiến đấu / điểm tiếp cận); gắn POI ở Inspector; nút **Ragnarok** bật overlay 72h. |
| Nhóm / khóa / ẩn | Ctrl+G / Ctrl+Shift+G; Inspector hoặc chuột phải: Khóa, Ẩn. Layers: khóa cả nhóm đối tượng. |
| Undo / redo | Ctrl+Z / Ctrl+Y (80 bước, gồm cả brush và hành động Smart). |

## Smart tools (luôn là *đề xuất có xem trước*, bạn bấm Áp dụng mới đổi)
Làm mượt bờ/sông/đường · đường nội bộ giữa các POI đã chọn (A* theo địa hình) · gợi ý bến nối sông/hồ · gợi ý vị trí POI **có giải thích** · tạo cụm archetype · tái sinh chi tiết địa hình **chỉ trong vùng chọn (Q)** · heatmap Opportunity / mật độ POI / Build viability · reachability (bộ / xe / thủy) · thử chặn cầu-bến.

## Lưu, mở, gửi Map Tower
- **Tự lưu** vào trình duyệt sau mỗi thay đổi. **Dự án ▸ Lưu** (Ctrl+S) tải file `.sohmap.json`; **Mở / nhập** để tiếp tục (không mất thành phần nào, kể cả raster độ cao/biome).
- **Snapshot**: lưu biến thể, rồi «So sánh với hiện tại» (vòng xanh = thêm, cam = đổi).
- **Xuất ▸** PNG 2×/3×, SVG, JSON, Brief Markdown, báo cáo validation, và **Export for Map Tower (ZIP)**: bản đồ sạch, atlas, overlay (thủy lưu, giao thông, POI, Elder/Ragnarok, opportunity), JSON nguồn, danh sách POI/route/region, validation report, notes, gameplay brief, câu hỏi chưa chốt.

## Đọc kết quả kiểm tra
PASS = dữ liệu thiết kế chứng minh được · WARNING = cần xem · UNKNOWN = Bible chưa chốt/thiếu dữ liệu · FAIL = mâu thuẫn hình học hoặc luật đã chốt. Ngưỡng số trong báo cáo là **heuristic Map Lab**, không phải Bible. Loại thuyền, giá/stock Rương ký gửi, habitat quái… **không được gán số**.

## Phím tắt nhanh
V chọn · H pan · B/N đất · P polygon · E độ cao · G biome · R sông · C kênh · L hồ · D đường · J cầu · K bến · O POI · Z vùng xây · T Elder · S nguồn · W spawn · Y thử nhà · X nhãn · M đo · Q chọn vùng · 1–7 chế độ xem · F zoom vừa · Tab chỉ xem · Ctrl+K lệnh · Ctrl+Z/Y · Ctrl+D nhân bản · Ctrl+C/V · Delete xóa · Esc hủy · Enter/double-click kết thúc nét vẽ · chuột phải = menu.
