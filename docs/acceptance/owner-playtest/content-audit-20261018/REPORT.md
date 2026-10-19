# APEX CHAOS — Kiểm toán nội dung toàn game (tên gọi · văn bản · copy)

**Ngày:** 2026-10-18 · **Nhánh:** `arena/7db52093-apex-chaos` @ r13 (`85f6449`)
**Phạm vi:** mọi tên gọi và văn bản người chơi nhìn thấy — hero, skill, vũ khí, skin, mode,
Archive, HUD, Quest hub, Lucky Draw, BOT WAVE, Result, EN + VI.
**Phương pháp:** (1) kiểm kê tại nguồn chuẩn, (2) thu hoạch text live từ bản chạy thật
(boot → home → mode → pick đủ 8 hero → battle HUD → Archive → Quest → chuyển VI),
(3) đối chiếu chéo từng bề mặt. **Chưa sửa bất cứ thứ gì** — báo cáo này để owner quyết định.

Ảnh chứng cứ: `evidence/` (pick SHURI, HUD SHURI, Quest hub, Archive, VI…).

---

## 0. Kết luận điều hành

**Trực giác của owner đúng, và nguyên nhân không phải do người viết kém.** Nội dung *được viết tay*
của game rất mạnh: thoại mở đầu Scrap Basin, 50 huy hiệu VI ("Gậy Ông Đập Lưng Ông",
"Bách Phát Bách Trúng"…), tên chiêu BOT WAVE (THUNDER JAB FLURRY, GOLDEN COUNTER), 305 cặp
dịch VI tự nhiên. Cảm giác "placeholder" đến từ **các lớp tên bị suy ra tự động từ ID kỹ thuật**
(`mechanicId`) rò rỉ ra UI, và từ việc game hiện có **năm lớp đặt tên chồng nhau** cho cùng một skill.

- **1 lỗi SEV-1 thật (không phải gu):** SHURI — một trong hai hero mới nhất — hiển thị đúng nghĩa đen
  **"PASSIVE / A1 / A2"** ở màn hình chọn tướng và **"MACHINE"** trên HUD trận đấu, cả EN lẫn VI.
- **Hệ thống đặt tên skill có 5 lớp** (registry displayName · suy từ mechanicId · GOLD_SKILL_COPY ·
  bảng donor · HERO_META). Cùng một chiêu có tới **3 tên khác nhau** trên 3 màn hình
  (vd MAGNET A1: `MAGNETIC ATTRACTION` / `ACQUISITION` / `ATTRACTION`).
- **~15 rò rỉ ngôn ngữ meta/dev** chạm mặt người chơi: `PLAYTEST FIRST WAKE · CP04`,
  `LOCKED // PRE-PILOT`, `BATTLE HANDOFF READY`, `Owner Gold · native…`, `LIVE NATIVE REGISTRY`,
  `CANONICAL OWN SECONDS 0.93333`, `NO PAGE SCROLL / LIVE EQUIP AUTHORITY`, `PRODUCT MENU`…
- **Archive là nơi "rậm" nhất:** ~12 nhãn vi mô xếp chồng ở header + dòng thông số thô
  (`CAST COMMIT 0.25 · LENGTH 650 · WIDTH 310…`) và radar chỉ số được *suy diễn bằng khớp từ khóa*
  trên tên khóa cấu hình (BLACK HOLE — hero trọng lực — bị chấm CONTROL = 0).
- **Một tính năng, sáu cái tên:** `Dictionary` / `ARCHIVE` / `THE FIELD ARCHIVE` / `Cosmetic Locker` /
  `APPEARANCE` / `SKINS` cùng chỉ một màn hình Archive.

Mọi đề xuất đổi tên nằm ở §3/§4; menu quyết định ở §12. Không mục nào đụng vào Gold canonical
hay Battle HUD baseline ngoài thay *chữ* (tiểu tiết), chờ owner duyệt.

---

## 1. SEV-1 — SHURI hiển thị placeholder thật

`evidence/04-pick-shuri.png`, `evidence/18-shuri-hud.png`, `evidence/20-pick-shuri-vi.png`

| Bề mặt | Người chơi thấy | Đáng lẽ |
|---|---|---|
| Pick, chip passive | `PASSIVE · PASSIVE` | RECYCLE SNAP |
| Pick, chip A1 (phím J) | `A1 · A1` | SHOCK RECOIL |
| Pick, chip A2 (phím K) | `A2 · A2` | MECHANICAL GENESIS |
| Battle HUD, tile A2 | `MACHINE · 15.0S COOLDOWN` | MECHANICAL GENESIS |
| VI Pick | `NỘI TẠI · NỘI TẠI` / `A1` / `A2` | (chưa có bản dịch) |

**Cơ chế (đã truy tận gốc):** tên ở Pick/HUD đi qua `APEX_GOLD.skillDisplay` +
`heroSkillMeta` trong `goldProductBridge.js`, đọc bảng `GOLD_SKILL_COPY` — bảng này có 7 hero
nhưng **thiếu SHURI**, nên rơi về `['PASSIVE','A1','A2']` của donor; HUD thì suy từ đuôi
mechanicId (`shuri.machine` → `MACHINE`). Registry **đã có sẵn** tên đẹp cho SHURI
(Recycle Snap / Shock Recoil / Mechanical Genesis) nhưng đường HUD **không đọc `displayName`**.
BOXE thoát nạn chỉ vì có sẵn mục trong `GOLD_SKILL_COPY`. Đây là lỗ hổng dữ liệu, sửa rất nhỏ
(thêm 1 mục + vài cặp VI) — đề xuất xử lý ngay như bug-fix, không chờ gói lớn (§12-D1).

---

## 2. Bản đồ năm lớp đặt tên (nguyên nhân gốc)

| Lớp | Nguồn | Ai đọc | Trạng thái |
|---|---|---|---|
| 1 | Registry `displayName` | Archive (ưu tiên) | Chỉ BOXE/SHURI có đủ; 12 hero còn lại `null` |
| 2 | Suy từ `mechanicId` (`frost.breath`→`BREATH`) | Archive + HUD khi thiếu lớp 3 | Nguồn mọi tên "nghe như máy" |
| 3 | `GOLD_SKILL_COPY` (bridge) | Pick + HUD (A1/A2) | 7/8 hero — thiếu SHURI |
| 4 | Bảng `SKILLS` trong donor Gold | Pick (passive) | 6 hero gốc; chứa cả `'A1'/'A2'` dự phòng |
| 5 | `HERO_META` (FieldArchiveC03) | Archive: tên phụ + câu mô tả | 6 hero gốc; tên lệch cả lớp 2 lẫn 3 |

Hệ quả đo được — **cùng một chiêu, ba bề mặt, ba tên** (live):

| Skill | Pick / HUD | Archive INFO (tiêu đề) | Archive (câu mô tả thuộc về tên…) |
|---|---|---|---|
| MAGNET A1 | MAGNETIC ATTRACTION | **ACQUISITION** | ATTRACTION |
| MAGNET P (passive) | TRAJECTORY CONTROL | **ACCELERATION** | ACCELERATION |
| FROST A1 | FROST BREATH | **BREATH** | FROST BREATH |
| FROST A2 | FROST RUSH | **HUNT** | ICE RUSH |
| FROST P | FROZEN BULLET | **DEEP FROST** | FREEZE PRESSURE |
| MIRROR A1 | MIRROR ARSENAL | **ARSENAL** | MIRROR ARSENAL |
| MIRROR A2 | MIRROR EXCHANGE | **EXCHANGE** | ATOMIC EXCHANGE |
| MIRROR P | MIRROR SHARDS | **SHATTERED MIRRORS** | MIRROR SHARDS |
| HUNTER A1 | TRAP DEPLOY | **SNARE** | TRAP |
| HUNTER A2 | DASH / STRIKE | **POUNCE WEAK** | DASH / STRIKE |
| HUNTER P | PREDATORY | **WEAK LAW** | WEAK LAW |
| CRYSTAL P | CRYSTAL CORE | **REFRACTION** | REFRACTION |
| CRYSTAL A1 | CONTEXT CONSTRUCT | CONTEXT CONSTRUCT | WALL / HEXA |
| ROBOT P | ROLLING BURST | **DAMAGE MILESTONES** | ROLLING BURST |
| SHURI A2 | **MACHINE** (HUD) / **A2** (Pick) | Mechanical Genesis ✓ | — (thiếu mô tả) |

Tên suy từ lớp 2 yếu nhất: `BREATH`, `HUNT` (còn **đụng chủ đề HUNTER**), `POUNCE WEAK`,
`ARSENAL` (đụng tên hệ vũ khí), `EXCHANGE`, `DAMAGE MILESTONES`, `MACHINE`.
Họ tên `DAMAGE *` (`DAMAGE MILESTONES / DAMAGE SINGULARITY / DAMAGE EQUATION / DAMAGE SHEDDING`)
là "mùi placeholder" rõ nhất — đó là mô tả cơ chế nội bộ, không phải tên chiêu.

**Hướng sửa hệ thống (đề xuất):** biến registry `displayName` thành **nguồn chuẩn duy nhất**
cho cả 42 skill; `GOLD_SKILL_COPY` và Archive cùng đọc nó (hoặc sinh từ nó lúc build);
tên passive của donor được *nhập vào* registry. Xóa đường suy-từ-mechanicId khỏi mọi bề mặt
người chơi (chỉ giữ làm fallback dev). Hero cũng vậy: một nguồn `displayName + tag` duy nhất.

---

## 3. Đề xuất tên skill chuẩn (một chiêu một tên, mọi bề mặt)

Nguyên tắc chọn: ưu tiên tên đã có bản dịch VI (lớp Pick) để khỏi dịch lại 24 cặp;
chỉ đổi khi tên hiện tại sai cơ chế hoặc quá yếu. Cột "đề xuất" cần owner duyệt (§12-D2).

| Hero | Slot | Đề xuất canonical | Lý do ngắn |
|---|---|---|---|
| ROBOT | P / A1 / A2 | ROLLING BURST · WEAPON DASH · VIRTUAL ARMOR | Giữ nguyên (đã nhất quán + có VI) |
| HUNTER | P | **PREDATOR'S LAW** *(mới)* hoặc giữ WEAK LAW | PREDATORY là tính từ cụt; WEAK LAW đúng cơ chế nhưng khô |
| HUNTER | A1 | TRAP DEPLOY | Giữ (VI: ĐẶT BẪY) |
| HUNTER | A2 | DASH / STRIKE *(hoặc PREDATOR POUNCE)* | POUNCE WEAK loại bỏ |
| CRYSTALA | P | **REFRACTION** | Đúng cơ chế phản đạn; CRYSTAL CORE nghe như tài nguyên |
| CRYSTALA | A1 | **HEXA CONSTRUCT** *(hoặc CRYSTAL WALL)* | "CONTEXT" là từ kỹ thuật; chiêu dựng Wall/HEXA |
| CRYSTALA | A2 | AWAKENING | Giữ |
| MAGNET | P | **MAGNETIC ACCELERATION** | Cơ chế = tăng tốc đạn phe mình; TRAJECTORY CONTROL trùng vai A1 |
| MAGNET | A1 / A2 | MAGNETIC ATTRACTION · MAGNETIC REPEL | Giữ (VI sẵn) |
| FROST | P | **FREEZE PRESSURE** *(nếu cơ chế là làm mới giờ đóng băng)* | FROZEN BULLET chỉ đúng nếu đạn gây đóng băng — cần owner xác nhận cơ chế |
| FROST | A1 / A2 | FROST BREATH · FROST RUSH | Giữ |
| MIRROR | P / A1 | MIRROR SHARDS · MIRROR ARSENAL | Giữ |
| MIRROR | A2 | **ATOMIC EXCHANGE** | Tên cũ trong HERO_META hay nhất bộ; "atomic" khớp mô tả hoán vị không đổi HP/vận tốc (VI đề xuất: HOÁN ĐỔI NGUYÊN TỬ) |
| BOXE | P | (quyết định ngôn ngữ — §9) | Hiện: `Càng đánh càng hăng` ngay trong bản EN |
| BOXE | A1 / A2 | FIST ROCKET · BLOCK & HIT | Giữ; bổ sung cặp VI cho BLOCK & HIT (đề xuất: ĐỠ RỒI ĐÁNH) |
| SHURI | P / A1 / A2 | RECYCLE SNAP · SHOCK RECOIL · MECHANICAL GENESIS | Lấy từ registry (VI đề xuất: TÁI CHẾ TỨC THÌ · GIẬT LÙI ĐIỆN TỪ ✓có · KHỞI NGUYÊN CƠ KHÍ) |

**Sáu hero khóa** (chỉ xuất hiện trong Archive; chưa chơi được) — tên suy hiện tại:
`TRANSIT / DAMAGE SINGULARITY / EVENT HORIZON` (BLACK HOLE — EVENT HORIZON rất tốt),
`PARABOLA GRAPH / DAMAGE EQUATION / MULTIPLY DIVIDE` (MATH), `ELASTIC STATE / COMPRESSION / AFTERBOUNCE`
(RUBBER — AFTERBOUNCE vui, giữ được), `LOOP / REWIND / TIMELINE MARKERS` (TIME),
`MITOSIS / DAMAGE SHEDDING / EMERGENCY MITOSIS` (SLIME — trùng MITOSIS hai lần trong một kit),
`FARTHEST CORNER / NEST / DISTANCE CRIT` (SNIPER). Đề xuất: chấp bút `displayName` cho 18 chiêu này
khi duyệt §3 (rẻ, một lần), tối thiểu sửa các tên cụt (`LOOP`, `NEST`, `TRANSIT`, họ `DAMAGE *`).

---

## 4. Tên hero & tagline

1. **ROBOT vs NEWBOT (quyết định §12-D3).** NEWBOT xuất hiện ở: Story/Quest ("NEWBOT is awake…"),
   Archive (tiêu đề lớn), donor Gold, huy hiệu `signature-newbot`, skin ECOBOT detail.
   ROBOT chỉ ở: Pick + HUD (lớp `GOLD_HERO_COPY` của bridge ghi đè donor) và ID sản xuất.
   **Đề xuất: NEWBOT là tên hiển thị chuẩn khắp nơi** (ID nội bộ ROBOT giữ nguyên).
   Đổi ở Pick = sửa 1 dòng copy bridge. Ngay trong Archive hiện còn tự mâu thuẫn cùng màn hình:
   tiêu đề `NEWBOT` nhưng chân trang `FIELD RECORD / ROBOT` và chữ chìm khổng lồ `ROBOT`.
2. **FROST vs ICE:** hiển thị FROST nhất quán, trừ chân trang Archive `FIELD RECORD / ICE` + chữ chìm `ICE`.
   Đề xuất: dòng mã hồ sơ cũng dùng tên hiển thị.
3. **Thẻ hero khóa ở Pick in ID thô:** `BLACK_HOLE`, `MATH_V2` (gạch dưới + hậu tố phiên bản!)
   trong khi Archive in `BLACK HOLE`, `MATH V2` đàng hoàng. Gốc: `GOLD_HERO_COPY` thiếu 6 hero khóa
   → fallback về productionId. Đề xuất bổ sung đủ 6 mục (tên + tag, §5.2).
   `MATH_V2` còn là **số phiên bản phần mềm** trong tên nhân vật — cân nhắc tên hiển thị cuối cùng
   (MATH? CALCULUS? — owner quyết; hiện tối thiểu bỏ gạch dưới).
4. **Tagline có tới 3 bộ:** live (bridge): APEX COMBAT FRAME / ANCIENT CRYSTAL ENTITY / FIELD CONTROL
   UNIT / CRYO EDGE UNIT / ECHO DUPLICATE…; donor shell: COMBAT UNIT / ANCIENT KEEPER / FORCE
   CONTROLLER / FROZEN ARSENAL / DUAL IDENTITY; donor Lucky: INDUSTRIAL COMBAT UNIT.
   Chỉ bộ live hiện ra; hai bộ kia là nợ tiềm ẩn (lộ khi bridge lỗi). Bộ live tốt — giữ, đồng bộ fallback sau.
5. **Phía BOT ở Pick mất tagline:** hiện `CPU OPPONENT` thay cho tag của hero (cờ BOT đã nói rõ rồi).
   Đề xuất hiện tag của hero như phía P1 (HUD trận đấu vốn đã làm vậy).

---

## 5. Rò rỉ meta / ngôn ngữ dev (người chơi nhìn thấy)

| # | Chuỗi hiện tại | Ở đâu | Đề xuất |
|---|---|---|---|
| 1 | `PLAYTEST FIRST WAKE · CP04` | Nút Quest hub | Gỡ khỏi bản public, hoặc `FIRST WAKE · TRIAL` |
| 2 | `PLAYTEST REFLEX · Q4A` | Nút Quest hub | như trên |
| 3 | `LOCKED // PRE-PILOT` | Tag 6 hero khóa (bridge) | `SIGNAL UNVERIFIED` / `NOT YET AWAKENED` (trong thế giới) |
| 4 | `BATTLE HANDOFF READY` | Banner chuyển trận | `READY` (VI đã dịch đẹp: SẴN SÀNG VÀO TRẬN — EN nên theo) |
| 5 | `Owner Gold · forest-jade mechanical layers · native NEWBOT springs` | Mô tả skin ECOBOT | Viết vị: vd `Forest-jade plating over a spring-driven NEWBOT frame.` |
| 6 | `Owner Gold / native RPG-7 · V7 smoke and original complete face frame` | Mô tả skin VUA HỀ | Viết vị tương tự |
| 7 | `LIVE NATIVE REGISTRY` | Eyebrow Archive vũ khí | `ARSENAL RECORD` |
| 8 | `CANONICAL LV1 · ROLE PROFILE` | Archive INFO | `LV1 · ROLE PROFILE` |
| 9 | `NO PAGE SCROLL / LIVE EQUIP AUTHORITY` | Footer Archive SKINS | Bỏ, hoặc `EQUIP APPLIES INSTANTLY` |
| 10 | `APPEARANCES ONLY / COMBAT RULES PRESERVED` | Footer Archive | `APPEARANCE ONLY — NO COMBAT EFFECT` |
| 11 | `TACTICAL AFFINITY · NOT POWER / DPS` | Chú thích radar | Chỉ `TACTICAL AFFINITY` |
| 12 | `PRODUCT MENU` / `Back to Product Menu` | Result legacy + Lucky legacy | `HOME` |
| 13 | `LOCKED — EXTENSION POINT` | Tooltip thẻ hero khóa | `LOCKED` |
| 14 | `RIG LOCK · FRONTLINE HANDOFF` | Chuỗi trong catalog (wave/story) | Bỏ "HANDOFF" |
| 15 | Dòng metric khóa-cấu-hình (§6) | Archive INFO mọi skill | §12-D4 |

Không phải rò rỉ (đã kiểm chứng): các chuỗi `pre-pilot build`, `locked extension point`
trong `productSurface.js` **không được render** — nút dock bị khóa hiện *im lặng hoàn toàn*
(xem §10, đó lại là vấn đề khác: thiếu phản hồi).

Thuật ngữ kỹ thuật len vào câu mô tả Archive (HERO_META) nên viết lại khi duyệt §3:
*"preserve provenance"* (CRYSTAL passive — câu "kỹ sư" nhất game), *"fresh temporary instance"*,
*"can commit HEXA … when requirements are met"*, *"native +18% velocity bonus; T6 is immune"*,
*"Hunter-specific WEAK damage rules"*. Giọng chuẩn nên theo các câu intro (rất tốt):
*"A discarded machine that learned to fight again."*

---

## 6. "Rậm chữ" — Archive & HUD

**Archive INFO** (`evidence/06-archive-info.png`): trước khi tới nội dung, người chơi đi qua
~12 nhãn vi mô: `APEX CHAOS / RESTRICTED FIELD RECORD` · `FIGHTER REGISTRY` · `DOCUMENT / 01 — 14` ·
`RECORD NO. 001` · `REGISTER / FIGHTERS` · `14 FILES` · `FIGHTER / COMBAT PROFILE` · `CANONICAL LV1…`
· `FIELD RECORD / ICE` · `ORIGINAL / VISUAL PREVIEW` · chữ `FIGHTER` lặp dưới cả 14 dòng danh sách…
Chất hồ-sơ-mật là chủ ý thẩm mỹ (giữ được), nhưng mật độ này khiến thông tin thật (tên chiêu,
mô tả) bị chìm. Đề xuất tỉa ~một nửa (§12-D5), ưu tiên bỏ các nhãn trùng nghĩa nhau
(REGISTRY/RECORD/DOCUMENT/FILES đang nói cùng một ý 4 lần).

**Dòng metric là thủ phạm "rậm" nặng nhất** — nó in 5 khóa cấu hình số đầu tiên của chiêu,
titleize thô, không đơn vị, thứ tự tùy tác giả file:
`COPY LIFETIME 6 · TIME SCALE 1.6 · OWN U 0.58 · ACTION END U 0.92 · CANONICAL OWN SECONDS 0.93333` (MIRROR),
`GUN ACCELERATION MIN 1400 · GUN ACCELERATION MAX 2400 · GUN DISTANCE SPAN 700…` (MAGNET),
`CAST COMMIT 0.25 · LENGTH 650 · WIDTH 310 · FLOOR LIFETIME 4.5 · THAW SECONDS 0.3` (FROST).
Ba hướng (§12-D4): (a) biên tập tay 2–3 chỉ số "người" có đơn vị mỗi chiêu; (b) chỉ giữ COOLDOWN;
(c) giữ nguyên chất dữ liệu thô như một lựa chọn phong cách hồ sơ.

**Radar chỉ số là điểm cần owner biết rõ:** 5 trục (DAMAGE/CONTROL/MOBILITY/DEFENSE/**FIELD** —
trục "FIELD" đứng một mình gần như vô nghĩa) được chấm bằng *khớp từ khóa trên tên khóa cấu hình*
của chiêu. Hệ quả: BLACK HOLE CONTROL = 0; các con số trông như dữ liệu cân bằng chính thức
nhưng là heuristic trình bày (đội ngũ đã tự biết — nên mới có dòng disclaimer `NOT POWER / DPS`).
Đề xuất tối thiểu: đổi nhãn trục FIELD → `FIELD CONTROL` gộp nghĩa rõ ràng, và cân nhắc khai báo
tay chỉ số cho 8 hero chơi được thay vì heuristic.

**Battle HUD (trong giới hạn tiểu tiết — chỉ chữ):** mỗi tile đang mang 4 lớp chữ:
`ABILITY 1` + tên + `15.0S COOLDOWN` (mô tả sinh tự động) + `READY / COOLDOWN 3.9s` (trạng thái).
Dòng mô tả trùng thông tin với dòng trạng thái; định dạng lệch nhau ngay trên cùng một hero:
`10.0S COOLDOWN` vs `3.0S ACTIVE · 10.0S CD` (CD viết tắt), `S` hoa (desc) vs `s` thường (state).
Và từ vựng vai trò lệch giữa màn hình: Pick/Archive dùng `A1/A2`, HUD dùng `ABILITY 1/2`.
Đề xuất tiểu tiết văn bản: thống nhất `A1/A2` + một định dạng giây; việc bỏ dòng desc là quyết định
thiết kế HUD — chỉ nêu, không tự làm.

**Văn bản boilerplate lặp:** 6 hồ sơ khóa dùng chung câu
*"Read the registered combat kit and approved cosmetic appearances."* (nghe như hướng dẫn sử dụng);
41 vũ khí dùng chung *"Skin applies whenever this weapon type is obtained during a match."*.
Đề xuất: hồ sơ khóa — một câu vị theo từng hero (hoặc chỉ giữ `Fighter locked — dossier incomplete`,
câu này tốt); vũ khí — bỏ câu lặp, thay bằng dòng tier/kind đã có sẵn dữ liệu.

---

## 7. Một tính năng — nhiều tên (nhất quán bề mặt)

| Tính năng | Các tên đang dùng | Đề xuất |
|---|---|---|
| Archive/Locker | `Dictionary` (dock) · `ARCHIVE` (nút Home) · `THE FIELD ARCHIVE` (tiêu đề) · `Cosmetic Locker` (product graph) · `APPEARANCE` (nút trong Pick) · `SKINS`/`APPEARANCES / SELECT & EQUIP` (tab + header) | Hai tên tối đa: lối vào `ARCHIVE`, bên trong `THE FIELD ARCHIVE`; nút Pick đổi `SKINS` cho khớp tab; bỏ `Dictionary` (VI "Từ điển" càng lệch) |
| Đối thủ máy | `VS BOT` · `Bot Battle` · `BOT` · `CPU OPPONENT` · `CPU` · `P2 / BOT` | Một từ: **BOT** (§4.5 xử lý CPU OPPONENT) |
| BOT WAVE | `BOT WAVE` · `BOXE / ARSENAL SURVIVAL` (Home) · `THE LAST ROUND` (màn chờ) · `BOT WAVE · BOXE` (product) · `BOXE BOT WAVE` (tiêu đề frame) | Một subtitle duy nhất (đề xuất giữ `BOXE / ARSENAL SURVIVAL`) |
| Story taxonomy | `QUEST 01` · `CHAPTER 01 / 11` · `QUEST STAGES / REPLAY` · `E01…E08` · ghi chú lại gọi các màn là *"encounters"* | Quest → Chapter (WAKE…) → Encounter E01–E08; đổi header thành `ENCOUNTERS / REPLAY`; làm rõ 11 là số chapter |
| Tiền tệ | `AC` · `ARSENAL CREDITS` (chỉ ở Lucky) | Chấp nhận được; nên có một chỗ giải thích AC ngay Home (tooltip/dòng phụ) — mức nhẹ |
| Vai trò skill | `PASSIVE/NỘI TẠI` ✓ · `A1/A2` (Pick/Archive) · `ABILITY 1/2` (HUD) · phím J/K | Thống nhất A1/A2 (§6) |
| Từ "ARSENAL" | mode (Arsenal Battle) · hệ vũ khí · `ARSENAL RECORD` · `ARSENAL RESULT` (legacy) · `ARSENAL CREDITS` · `ARSENAL SURVIVAL` · chiêu MIRROR bị suy thành `ARSENAL` | Giữ làm thương hiệu vũ khí; bỏ các dùng-thừa (legacy result §10; tên chiêu §3) |

---

## 8. Vũ khí (41 hồ sơ)

Điểm tốt: 8 vũ khí SPECIAL được đặt tên đàng hoàng (Combat Boomerang, Tactical Crossbow,
Steel Ball Launcher…); HUD in tên nhất quán dạng HOA (MAGNUM 500, BERETTA 93R).

Cần owner quyết/để ý:
1. **Tên súng thật nguyên xi:** Glock-17, Beretta 93R, AK-47, Mossberg 500, Colt, MP5, SPAS-12,
   Snipex Alligator… — cân nhắc thương hiệu khi ra Public Playtest (nhiều game dùng tên "lai").
   Đây là quyết định sản phẩm/pháp lý nhẹ, không phải lỗi.
2. **`DESERT DEAGLE`** — "Deagle" là tiếng lóng cộng đồng cho Desert Eagle; ID lẫn art đều dùng.
   Muốn chỉn chu thì `DESERT EAGLE`.
3. **`ZBROYAR Z15 S1 / S2 / S3`** — ba "vũ khí" thực chất là biến thể skin (art ghi `skin1/2/3`),
   được đếm như ba hồ sơ riêng trong 41. Người chơi thấy `ZBROYAR Z15 S2` trong trận sẽ khó hiểu.
4. **`project MBR` / `project MBR2`** — tiền tố "project" mùi nội bộ; nếu là codename trong thế giới
   thì `MBR PROTOTYPE` rõ hơn.
5. **Tầng T1–T6 không có chú thích ở bất cứ đâu**, trong khi mô tả chiêu (MAGNET/MIRROR) viện dẫn
   "T6 immune / T6 excluded". Cần một dòng legend trong Archive vũ khí.
6. `HEAL_H1…H5` nằm trong bảng tier vũ khí — nếu xuất hiện trong Archive sẽ in thô `HEAL H1`.

---

## 9. Ngôn ngữ — EN là canonical, nhưng VI mới là bên chỉn chu hơn

- Catalog VI: **305 cặp**, phủ gần như toàn bộ UI tĩnh, dịch tự nhiên theo ngữ cảnh game
  (ROLLING BURST → BÙNG NỔ LIÊN HOÀN). VI thậm chí *sửa* được meta của EN (BATTLE HANDOFF READY →
  SẴN SÀNG VÀO TRẬN). Tên VI của skill nhiều chỗ hay hơn tên suy EN — vì người dịch dịch từ lớp tên đẹp.
- **Rò VI vào bản EN:** passive BOXE `Càng đánh càng hăng` hiện nguyên bản trong UI tiếng Anh;
  skin `VUA HỀ — THE LAST LAUGH`; toàn bộ 47 huy hiệu Result đặt tên VI; tiêu đề iframe Result VI.
  Đây là dấu ấn pipeline Gold viết VI trước. Cần một luật rõ (§12-D6): hoặc coi VI là "chữ ký"
  giữ nguyên mọi ngôn ngữ (như tên riêng), hoặc có bản EN tương ứng — hiện đang nửa vời tùy chỗ.
- **Lỗ hổng phía VI:** `SCRAP ENGINEER` (tag SHURI), `BLOCK & HIT`, mọi tên SHURI, `LOCKED // PRE-PILOT`
  chưa dịch; toàn bộ tên/metric *sinh tự động* của Archive (`BREATH`, `CAST COMMIT`…) không bao giờ
  khớp catalog nên VI cũng hiện EN thô; lockup `SPECIAL EVENT / BOT WAVE` giữ EN (coi như logo — chấp nhận được nếu là chủ ý).

---

## 10. Thiếu nội dung / khoảng trống

1. **BOXE & SHURI không có văn bản Archive** — hai hero mới nhất không có câu intro, không mô tả chiêu
   (HERO_META chỉ có 6 hero gốc); trang của họ chỉ có tên (đã suy) + metric thô. Sáu hero khóa cũng vậy.
2. **Huy hiệu "signature" chỉ có cho 6 hero gốc** (chưa BOXE/SHURI).
3. **Không tìm thấy màn hình Pause** trong Free Battle — ESC thoát thẳng về Pick; không có
   RESUME/SETTINGS trong trận. (Ghi nhận để owner xác nhận là chủ ý của auto-battler.)
4. **Nút dock bị khóa (Fighter Shop/Upgrade/Missions/Account) bấm vào… im lặng tuyệt đối** —
   không toast, không chữ. Cần một dòng phản hồi kiểu `LOCKED IN THIS BUILD` / `COMING SOON`
   (viết theo giọng game), nếu các nút này sẽ xuất hiện ở Public Playtest.
5. **Result Gold không được phục vụ trong môi trường dev này** (`public/result-gold/` vắng mặt;
   trận đấu thật kết thúc → +25 AC → quay về Pick mà không thấy màn hình kết quả).
   Cần xác nhận bản build production có đóng gói `result-gold` (việc đóng gói, không phải nội dung).
   Song song tồn tại thẻ kết quả legacy (`ARSENAL RESULT / REMATCH / PICK AGAIN / PRODUCT MENU`) —
   cần chắc chắn chỉ một đường kết quả tới được người chơi.
6. **Story đang vào được thật** (nút START QUEST 01 hoạt động) — đối chiếu kế hoạch
   "Public Playtest #1 khóa Story": cần quyết định khóa ở tầng nào trước khi phát hành,
   và khi khóa thì CTA chính `CONTINUE STORY` (to nhất Home) phải nói gì.
7. Tên profile mặc định `Player` — placeholder persona (nhẹ; cân nhắc callsign sửa được sau này).

---

## 11. Những gì đang tốt — giữ nguyên

- Copy mở đầu & Home: *THE ONES THROWN AWAY / "Discarded machines, forgotten by the world…"* — giọng rất riêng.
- Mode select: *"Choose how the next fight begins. Same arena. Different opponent."* + VS BOT / 1 VS 1 rõ ràng.
- Quest hub (trừ 2 nút playtest): WAKE, *"No valid network ID…"*, tên màn E01–E08
  (CHARGE THE BREAKER, RIVET OVERRIDDEN, T.O.T — LAST CHOICE).
- 47 huy hiệu Result (VI) + tên chiêu BOT WAVE trong Gold iframe (VOLCANO UPPERCUT, GOLDEN COUNTER…).
- Câu intro hero trong Archive; tagline live (THE FIST OF DAWN, SCRAP ENGINEER).
- Hệ dịch VI (runtime + catalog) — hạ tầng và chất lượng đều trên chuẩn dự án indie.

---

## 12. Menu quyết định cho owner

- **D1 (bug):** sửa ngay placeholder SHURI (Pick+HUD+VI) như một fix dữ liệu nhỏ, tách khỏi gói lớn?
- **D2:** duyệt bảng tên skill canonical §3 (kèm chấp bút 18 chiêu của 6 hero khóa)?
- **D3:** tên hero chuẩn — **NEWBOT** (đề xuất) hay ROBOT?
- **D4:** dòng metric Archive — biên tập tay / chỉ giữ cooldown / giữ nguyên thô?
- **D5:** mật độ nhãn header Archive — tỉa ~một nửa / giữ nguyên chất hồ sơ?
- **D6:** luật ngôn ngữ cho nội dung gốc VI (passive BOXE, huy hiệu, "VUA HỀ"):
  giữ VI như chữ ký mọi locale, hay có bản EN?
- **D7:** quét 15 mục meta §5 (toàn bộ / chọn lọc)?
- **D8:** thống nhất nhãn tính năng §7 (Archive family, BOT, BOT WAVE subtitle, Quest taxonomy)?
- **D9:** vũ khí — giữ tên súng thật? sửa DESERT DEAGLE? xử lý Z15 S1–S3? thêm legend T1–T6?
- **D10:** viết bổ sung văn bản Archive cho BOXE/SHURI (+câu intro 6 hero khóa) ngay đợt này?

Sau khi owner chốt, gói thực thi đề xuất (CP6) sẽ đi theo đúng kỷ luật cũ:
sửa tại nguồn chuẩn (registry/bridge/catalog) → build/lock → gates → bằng chứng live EN+VI —
không vá CSS, không đụng Gold library, không merge/deploy.

---

*Phụ lục dữ liệu thô của đợt thu hoạch (dump text từng màn hình EN/VI, bảng 305 cặp locale,
danh sách vũ khí/registry) được lưu trong workspace của phiên làm việc; các chuỗi trích dẫn
trong báo cáo này đều lấy nguyên văn từ bản chạy thật r13 hoặc từ nguồn chuẩn tương ứng.*
