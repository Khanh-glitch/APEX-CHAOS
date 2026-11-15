# APEX CHAOS — Đề Xuất Độc Lập Combat HUD ("Tactical Pulse HUD") & Tự Phản Biện Thẳng Thắn

- **Ngày thực hiện:** `2026-10-23`
- **Nhánh phiên làm việc:** `arena/99851aa2-apex-chaos` (PR `#101` giữ nguyên trạng thái **Draft**)
- **Baseline đối chiếu:** `c8f5ebeddbebb7e9781b171c019fe0ceb3a07842` (runtime gốc `18bc21b07d73b881dafbb732630ca6bcd1c21214`)
- **Trạng thái mã nguồn ứng dụng (`src/`, `public/`):** **0 dòng chỉnh sửa** — tuân thủ tuyệt đối cổng duyệt thị giác của Owner trước khi code.

---

## 1. Bối Cảnh & Chẩn Đoán Gốc Rễ Từ Gameplay Thật (Không Suy Đoán)

Đối chiếu trực tiếp mã nguồn runtime (`public/gold/battle-hud.html`, `public/game/gold/goldProductBridge.js`, `src/ui/FirstPlayGuide.jsx`, `public/game/arsenal/arsenalConfig.js`, `public/apexEngine.js`) và log/ảnh chụp thật cho thấy người chơi mới bị rối ở **3 đứt gãy nhận thức cốt lõi**:

1. **Mâu thuẫn quyền điều khiển (Agency Lie):**
   - Trong `public/apexEngine.js::startSpecificMatch`, cả 2 robot tự di chuyển, tự giữ khoảng cách, tự đánh và tự nhặt vũ khí khi chạm đất.
   - Tuy nhiên `FirstPlayGuide.jsx` (dòng 383–408) lại hiện hộp chữ vàng *"No weapon yet — run over a gun on the ground to pick it up."* khiến người chơi tưởng mình điều khiển di chuyển và tự hỏi *"Làm sao chạy lại nhặt súng?"*.
   - Đồng thời HUD lặp chữ vô nghĩa `APEX COMBAT FRAME` × 2 mỗi bên, lặp `UNARMED / UNARMED`, và giữ `aria-label` cứng của hero cũ (`SNARE LINE (J)`, `MANTIS RUSH (K)` tại `battle-hud.html` dòng 1246–1257).
2. **Đánh đồng `cooldown == 0` với `dùng được ngay` (`canCast` Blindness):**
   - `WEAPON DASH (J)` yêu cầu **có súng hợp lệ (không phải vật phẩm T6)** đang lộ diện dưới sàn (`isGun(slot.weaponId) && !isTier6`).
   - Đầu trận (`t = 00:00 → ~00:15`), chưa có súng dưới sàn nên `canCast('robot.weapon_dash') === false`, nhưng thẻ `J` vẫn sáng `READY` y hệt `K`, và Coach còn **đóng băng trận đấu** bắt người chơi *"Press J now"* trong vô vọng — đồng thời **khóa luôn phím `K`** dù `VIRTUAL ARMOR (K)` hoàn toàn dùng được ngay lúc đó!
3. **Thiếu liên kết chiến trường & phản hồi tác động sau khi bấm chiêu:**
   - Khi súng thật xuất hiện trên sàn (`SNIPER` tại `844×390`, `t = 00:16`), không có tín hiệu nối mắt từ vật thể dưới sàn tới nút `J`.
   - Khi `VIRTUAL ARMOR (K)` đang kích hoạt (`ACTIVE 0.1S`), thẻ `K` tối mù gần giống trạng thái chờ, không cho người chơi biết chiêu đang tạo lá chắn giảm `55%` sát thương trên nhân vật của mình.

---

## 2. Một Ý Tưởng Thiết Kế Độc Lập Duy Nhất: **"Tactical Pulse HUD"**

Nguyên tắc tối thượng: **Sân đấu là nhân vật chính (`100%` diện tích gốc: `828×828` trên `1440×900`, `338×338` trên `844×390`). Không thêm bất kỳ hộp giải thích cố định nào, không thêm rail chữ kỹ thuật, không dùng banner báo lỗi thường trực.** Mọi thông tin được truyền tải ngay trong slot sẵn có của Gold HUD kết hợp đúng **tín hiệu ngữ cảnh nhẹ trên sân đấu khi có sự kiện thật**:

### Hệ 4 Trạng Thái Kỹ Năng Tách Biệt Tức Thì (Không Lẫn Lộn)

| Trạng thái | Điều kiện Runtime Thật | Biểu đạt trên Thẻ Chiêu (`#p1Side`) | Tín hiệu trên Sân Đấu (`#arenaFx`) |
| :--- | :--- | :--- | :--- |
| **1. Chờ Mục Tiêu (`STANDBY`)** | `cd == 0 && !canCast` (VD: `J` đầu trận khi chưa rơi súng) | Ảnh chiêu dịu tối (`42%`), phím `[J]` viền rỗng xám, nhãn nhẹ `NO FLOOR GUN`, thanh 4 vạch tĩnh + `WAIT · GUN` (yên tĩnh, **không** báo lỗi đỏ/vàng, **không** giả `READY`) | Nhãn mảnh `NEXT GUN SPAWN` phía trên vòng tròn nét đứt báo hiệu chỗ rơi súng kế tiếp (không đè robot) |
| **2. Dùng Được Ngay (`CASTABLE`)** | `cd == 0 && canCast` (VD: `K` ở `00:04`; `J` ở `00:16` khi có `SNIPER`) | Ảnh chiêu sáng rực 100%, phím `[J]`/`[K]` nền xanh lime đặc `#B2FF3A`, viền phải phát sáng, thanh đầy + lời gọi hành động ngắn (`PRESS K` / `TAP · DASH`, `TARGET: SNIPER`) | Với chiêu định hướng mục tiêu (`J`): khung ngắm góc xanh `[J] SNIPER` ôm gọn khẩu súng thật trên sàn |
| **3. Đang Phát Huy Tác Dụng (`ACTIVE`)** | `activeRemainSec > 0` (VD: `K` sau khi bấm tạo khiên `3.0s`) | Tông xanh năng lượng `#56E0FF` tách biệt hoàn toàn với xanh lá `CASTABLE`, phím `[K]` xanh sáng, thanh thời lượng rút dần + `-55% DMG · 0.1S` | Vòng cung khiên năng lượng mảnh quanh `P1 NEWBOT` + nhãn gọn `ARMOR -55%` ngay phía trên đầu (không che robot) |
| **4. Đang Hồi Chiêu (`COOLDOWN`)** | `cooldownRemainSec > 0` (VD: `P2 WEAPON DASH` `7.4s`) | Ảnh tối nền lùi, số đếm ngược lớn (`7.4`) + thanh hồi xám `COOLDOWN 7.4S` | Không hiển thị nhiễu trên sân |

> **Phản hồi khi bấm nhầm lúc `STANDBY`:** Nếu người chơi vẫn bấm `J` khi chưa có súng, thẻ `J` chỉ nháy nhẹ viền hổ phách trong `0.9s` (`WAIT · NO GUN ON FLOOR`) rồi trở lại bình thường — không bao giờ dựng hộp thông báo cố định.

### Quy Tắc Coach Trận Đầu (Truth-Gated & Non-Blocking)
- **0% che sân đấu, 0ms đóng băng trận đấu:** Thanh Coach nằm gọn trong khoảng trống sẵn có của cột trái `#p1Side` (`290×52px` trên Desktop, `326×32px` trên Mobile, nút `SKIP` chuẩn cảm ứng `62×32px`).
- **Chỉ dạy hành động hợp lệ ngay tại khung hình đó (`canCast === true`):**
  - Ở `00:04` khi chưa có súng nhưng `P1` vừa trúng đòn (`916/1000`): Coach hướng dẫn ngay **`PRESS K — ARMOR SHIELD (-55%)`**, tuyệt đối không bắt chờ hay bấm `J` vô hiệu.
  - Ở `00:16` ngay khi súng `SNIPER` lộ diện dưới sàn: Coach tự chuyển sang **`GUN LIVE — TAP J TO DASH`** đồng bộ với khung ngắm `[J] SNIPER` dưới sàn, và tự tắt vĩnh viễn ngay sau khi người chơi bấm hoặc nhấn `SKIP`.

---

## 3. Bộ Bằng Chứng A/B Trên Ảnh Chụp Gameplay Thật

| File trong `evidence/combat-hud-takeover-20261023/ab/` | Độ phân giải | Nội dung |
| :--- | :---: | :--- |
| `desktop-A-current-1440x900.png` | `1440×900` | HUD `A` gốc (`00:04`, trận bị đóng băng vì đòi bấm `J` khi chưa có súng, che `P2`, khóa `K`) |
| `desktop-B-proposal-1440x900.png` | `1440×900` | Đề xuất `B` trên đúng trận `1440×900` ở `00:04`: trận chạy mượt, rõ quyền điều khiển, đối lập tức thì `J` (`WAIT · GUN`) vs `K` (`PRESS K`), đồng bộ cả bên `P2` |
| `desktop-AB-1440x900.png` | `1480×1950` | Bảng đối chiếu trực quan 1:1 `A` (trên) vs `B` (dưới) cho Desktop `1440×900` |
| `mobile-A-current-844x390.png` | `844×390` | HUD `A` gốc native mobile (`00:16`, banner sai *"run over a gun..."*, toast tiếng Việt đè cột phải `P2`, `J` rời rạc với khẩu `SNIPER` dưới sàn, `K ACTIVE 0.1S` mờ nhạt) |
| `mobile-B-proposal-844x390.png` | `844×390` | Đề xuất `B` trên đúng frame `844×390` ở `00:16`: khóa mục tiêu `[J] SNIPER` + `TAP · DASH`, phản hồi rõ khiên `K` (`-55% DMG · 0.1S` + vòng khiên `ARMOR -55%`), đối chiếu trực tiếp với hồi chiêu `7.4` bên `P2`, `0` chồng chữ |
| `mobile-AB-844x390.png` | `884×930` | Bảng đối chiếu trực quan 1:1 nguyên kích thước pixel `A` (trên) vs `B` (dưới) cho Mobile `844×390` |

Kết quả kiểm tra tọa độ tự động lưu tại [`layout-self-audit.json`](./layout-self-audit.json): **38 chuỗi chữ HUD + 6 tiêu đề bảng so sánh = `0` chồng lấn, `0` tràn khung, `0` che khuất nhân vật/HP/đồng hồ.**

---

## 4. Tự Đánh Giá Thẳng Thắn (Candid Self-Evaluation)

### Điểm đạt thực chất so với HUD `A` và các vòng bị bác trước
- Giải quyết triệt để **cả 3 câu hỏi nhận thức** của người chơi mới chỉ bằng thị giác phân cấp trong `< 2 giây`, không cần đọc đoạn giải thích nào.
- Khắc phục 100% các lỗi đã khiến các bản `B` trước bị bác: **không thu nhỏ sân đấu dù chỉ `1px`**, **không che chữ `NEWBOT` hay số máu trên `844×390`**, **không nhồi chữ nhỏ li ti vào thẻ mobile**, **không dựng hộp `CD READY / NO VALID TARGET` gây nhiễu cố định**, **không cắt dán giả mạo giữa các độ phân giải khác nhau**.

### Giới hạn trung thực chưa được xác minh runtime (Bắt buộc ghi rõ — Không khai khống)
1. **Bản `B` hiện là bản dựng thiết kế chính xác tỷ lệ 1:1 trên frame Chromium thật**, chưa phải ảnh chụp từ DOM đã sửa code (do tuân thủ nghiêm ngặt lệnh **không sửa code ứng dụng trước khi Owner duyệt hướng thị giác**). Sau khi Owner duyệt, bắt buộc chụp lại runtime thật trên Chromium cho cả `1440×900` và `844×390` và đối chiếu khớp từng vùng.
2. **Các khung hình tương thích khác (`P90` vuông `900×900`, mobile dọc `390×844`)** và **màn hình `Result` cuối trận**: **CHƯA ĐƯỢC XÁC MINH (`UNVERIFIED`)** trong vòng thiết kế này; cần kiểm tra thực tế bằng browser capture sau khi được duyệt triển khai để đảm bảo CSS responsive không làm tràn nhãn trên màn hẹp dọc.
3. **Chuyển động thời gian thực (motion timing):** Cảm nhận độ mượt khi khung ngắm `[J]` xuất hiện/biến mất lúc súng vừa rơi hoặc vừa bị đối thủ nhặt mất cần tinh chỉnh thực tế ở 60fps khi nối vào `robotPresentationRuntime.js`.
