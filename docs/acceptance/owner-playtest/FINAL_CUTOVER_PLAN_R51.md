# R51 — Final Cutover Plan (owner-playtest → product)

Status: **PHASE A DONE & VERIFIED** (2026-10-05). Phases B–H are the ordered work
packages that take the build from "R50K slice" to the owner's final contract.

Baseline: `arena/01a10c3e-apex-chaos` @ `f8be073654bdc7d3518274747dd280518cd764d5`
(R50K, "test(R50K): lock TAU collision regression").
This document is the plan **and** the acceptance matrix. It deliberately ignores
commit ids / branch names from earlier plans: only what has to change, and how it
is proven, matters here.

---

## 0. Đích (definition of done)

1. Boot → Home mở bằng Mechanical Door; Lucky Draw mở/đóng bằng Mechanical Door.
2. `Home → Free Battle → Fighter Pick → Battle` **không** dùng Mechanical Door;
   mỗi chặng dùng hiệu ứng riêng của nó (shell screen transition / battle HUD
   reveal).
3. Toàn bộ feedback owner-playtest (mục 6) đạt, ở **mọi tỉ lệ màn hình phổ
   biến**, không bug mới, không vá tạm.
4. Bản `pnpm build` (audit → vite build → manifest → prune) là bề mặt duy nhất
   được kiểm định; mọi gate đỏ còn lại phải được xử lý hoặc thay bằng gate đúng
   luật mới (không được "pass bằng cách xoá assertion").

## 1. Nguyên tắc bất biến (invariants — không được vi phạm ở bất kỳ phase nào)

- **Một thẩm quyền cho mỗi việc.** Selection / ownership / input side / avatar /
  audio session / mode / rarity: mỗi thứ có đúng MỘT nguồn sự thật; mọi nơi khác
  chỉ *đọc*.
- **Source → artifact là một chiều và tái lập được.** `docs/gold-ui/current/**`
  + `tools/buildGoldCutover.mjs` sinh ra `public/gold/**`; `node
  tools/buildGoldCutover.mjs --check` phải PASS. Không sửa tay file đã sinh.
- **Prune không bao giờ được xoá thứ bề mặt ship đang tham chiếu.** HTML tham
  chiếu + runtime manifest là hợp đồng; audit chỉ là suy diễn.
- **Gate phải kiểm artifact/hành vi, không chỉ chuỗi trong source.** Gate kiểu
  "source có chứa đoạn text X" là gate yếu; mọi gate mới phải đọc artifact
  (bytes/HTML đã sinh) hoặc chạy browser/headless thật.
- **Không thêm `transform: scale()` hay media query vá từng máy.** Phân bổ không
  gian bên trong layout (size band theo container), học theo Gold reference.
- **Không fake ownership** để mở Core Six: selection override vẫn là override;
  `owns()` giữ nguyên để Lucky Draw còn pool.

## 2. Cách xác minh (verification harness — dùng cho mọi phase)

1. `pnpm build` (= `materializeArsenalFinalSfx` → `assetAudit` → `vite build` →
   `generatePublicAssetManifest` → `pruneShippingDist`). Prune phải PASS guard
   mới (mục 3.3).
2. `pnpm preview` (port 4173) + Chromium thật (puppeteer), probe khai báo trong
   `tools/test*Browser.mjs` hoặc script tạm, kiểm:
   - boot: `body[data-apex-scene-transition]=DONE`, `#gold-shell-host[data-apex-gold-mounted=1]`,
     `window.apexUiSfx.keys().length===18`;
   - route policy: trong 3 chặng screen không có mẫu `CLOSING/SEALED/OPENING`;
   - Lucky Draw: `#luckyDonorHost.is-open` + door chạy + Escape đóng về Home;
   - Battle: HUD `is-open`, avatar thật (`naturalWidth>0`), 4 slot tên, `x/y` đạn,
     FX Crit/Heavy phủ panel, không `PAGEERROR`.
3. Gate suite: `pnpm test:r50-pre-transition` (đã thêm `test:scene-route-policy`).
4. Mọi kết luận phải kèm bằng chứng dạng bảng (trước/sau) trong PR/commit message
   hoặc file evidence mới trong `docs/acceptance/owner-playtest/`.

## 3. PHASE A — đã xong trong phiên này (root fixes, verified)

### 3.1 Pipeline generator đã "chết" từ slice R50K — đã hồi sinh

- `tools/buildGoldCutover.mjs:1813` (patch `SHL-S27`) chứa code bị escape sai
  (`replace: (matched) => (\n        \`${matched}\\n\` + ...`) ⇒ **SyntaxError**,
  file không parse được ⇒ không ai regenerate được `public/gold/**`.
  Hệ quả: `public/gold/shell.html` giữ **payload battle HUD cũ** (108.204 B) trong
  khi `public/gold/battle-hud.html` đã là bản mới (114.328 B).
- Đã sửa syntax; `tools/goldShellR50k.mjs` bổ sung invariant cho luật route mới;
  `node tools/buildGoldCutover.mjs --check` **PASS** (70 file khớp `public/gold`).

### 3.2 Shell giờ embed đúng battle HUD hiện hành (một lần regenerate sửa nhiều feedback)

Payload mới mang theo: `.apex-battle-avatar` (avatar production theo hero),
`#globalFx{z-index:35}` / `#ruptureLayer{z-index:36}` (FX Crit/Heavy nằm TRÊN
skill panel z=30), `.wp-ico.has-tier` (glow độ hiếm dưới ảnh súng), `--wpIW`
tăng (108–148px), `.skill.is-held` (trạng thái giữ nút), `.df-value` lớn hơn.
Gate `testGoldBattleHudAdaptationGate` trước đây FAIL ở
`shipping shell embeds the exact shipping Battle HUD bytes :: decoded=108204
hud=114328`; sau regenerate, assertion đó **hết đỏ**.

### 3.3 Không còn prune nhầm file đang được ship tham chiếu

- `tools/assetAudit.mjs`: thêm `UI_SFX_RUNTIMES` (khai báo ở
  `src/game/runtimeManifest.js:53`) **và** suy ra mọi runtime `/game/**.js` do
  shell HTML nạp (`docs/gold-ui/current/**` + `public/gold/*.html`) ⇒
  `shellRuntimeScriptPaths` vào `CURRENT_RUNTIME_PATHS`.
  Kết quả: `/game/ui/uiSfxAuthority.js` + 18 file `assets/audio/ui-sfx/**/*.ogg`
  từ `LEGACY_NON_SHIPPING` → `SHIPPING_LAZY` (audit: 718 legacy, 315 lazy).
- `tools/pruneShippingDist.mjs`: guard fail-closed — mọi `src=`/`href=` nội bộ
  trong HTML của `dist` (đã bỏ phần `<script>`/`<style>` inline) phải tồn tại
  sau prune; nếu không ⇒ **throw**.
- Bằng chứng build sạch: prune xoá 723 file / 196.278.112 B, guard PASS,
  `dist/game/ui/uiSfxAuthority.js` PRESENT, 18 ogg PRESENT, `sfxKeys = 18`.

### 3.4 Luật route mới (owner yêu cầu)

- `Home → Mode`, `Mode → Fighter Pick`, `Fighter Pick → Battle` **không** dùng
  door. `setScreen()` trong `tools/goldShellR50k.mjs` giờ `await prepare();
  commitScreen(next); focusScreen(next);` — vẫn settle fonts/ảnh/decode trước khi
  commit (không pop), nhưng không `tr.run()`.
- Door chỉ còn: boot (`signalBootReady`) và Lucky Draw (`home->lucky`,
  `lucky->home`).
- Battle giữ nguyên authority riêng (`is-preloading → is-transitioning →
  is-reveal`, 430 ms) + `freezeParentRuntime()`.
- Gate mới `tools/testSceneRoutePolicyGate.mjs` (`pnpm test:scene-route-policy`)
  khoá: router doorless, door chỉ 2 route Lucky, seam SFX một cửa, guard
  `APEX_GOLD_HUD`, và 2 guard shipping ở mục 3.3. `testGoldTransitionCoordinatorGate`
  + `testUiSfxWiringGate` được cập nhật sang luật mới (không xoá assertion).

### 3.5 Lucky Draw hết "đơ" — root cause là scope, không phải art

- `public/gold/shell.html` gồm nhiều `<script>` classic, **không chia sẻ lexical
  scope**. `uiSfx` chỉ tồn tại trong block 3; block Lucky Draw gọi bare
  `uiSfx('lucky.draw.enter_bay')` ⇒ `ReferenceError` ném trong `commit` ⇒
  SceneTransition rollback ⇒ bay không mở.
- Đã sửa ở generator: `window.apexShellSfx=uiSfx;` (một seam) và Lucky Draw gọi
  `window.apexShellSfx&&window.apexShellSfx('lucky.draw.enter_bay')`.
- Guard thêm: `battle-hud.html` handoff `setMode` bọc `if(window.APEX_GOLD_HUD)`
  (bridge `delete` seam khi unmount ⇒ message muộn không còn ném uncaught).
- Probe trên dist ship: Lucky mở (`is-open=true`, donor `/gold/lucky-draw.html`),
  door chạy, `Escape` đóng về Home (`closed=true`, door `CLOSING`), 0 page error.

### 3.6 Kết quả probe dist (bảng)

| Bước | Door states quan sát | Kết quả |
|---|---|---|
| boot | `CLOSING…DONE` | `goldMounted=1`, `sfxKeys=18` |
| Home → Free Battle | `[]` (đứng DONE) | screen-mode OK |
| Free Battle → Fighter Pick | `[]` | screen-fighter OK |
| Fighter Pick → Battle | `[]` | HUD `is-open`, avatar 512px `complete`, 4 tên = ROBOT |
| Home → Lucky | `CLOSING…` | bay mở, donor đúng |
| Lucky → Home (Escape) | `CLOSING` | bay đóng, về Home |

## 4. Baseline gate (HEAD `f8be073` vs hiện tại)

| Gate | HEAD | Hiện tại | Ghi chú |
|---|---|---|---|
| testGoldTransitionCoordinatorGate | PASS | PASS | cập nhật sang luật doorless |
| testUiSfxWiringGate | FAIL (1) | **PASS 98/98** | regex cũ + seam mới |
| testSceneRoutePolicyGate | (chưa có) | **PASS 19** | gate mới |
| testGoldBattleHudAdaptationGate | FAIL (4) | FAIL (3) | payload-bytes đã xanh; còn unarmed-mag, FX compositing, Frost |
| testGoldFighterPickAdaptationGate | FAIL | FAIL | Frost orientation/scale |
| testGoldBattleVisibilityGate | FAIL | FAIL | bridge error trong battle-live (xem B0) |
| testGoldBattleLifecycleGate | FAIL (4) | FAIL (4) | legacy suppress/READY/music surface |
| testAudioAuthorityGate | FAIL (2) | FAIL (2) | begin/end reason |
| testBattleTransitionAuthorityGate | FAIL (25) | FAIL (25) | **gate lỗi thời**: đòi `#battleTransition` đã bị R50K xoá |

## 5. Work packages (thứ tự thực thi)

### PHASE B — Battle authority & HUD truth

- **B0 (blocking, root) — selection authority split.** `public/game/arsenal/arsenalShellSelectRuntime.js:93-98`
  `canPublicSelect()` chỉ cho `meta.owns()`; trong khi UI khoá tướng + luật owner
  playtest dùng `APEX_ARSENAL_META.canPublicSelect()` (`arsenalMetaRuntime.js:187-191`,
  override r44). Hệ quả: CRYSTAL/HUNTER/MAGNET/ICE/MIRROR hiện "không khoá",
  chọn được, nhưng `window.startMatch()` (`:109`, gate `:123`) trả `false` ⇒
  `Battle runtime did not report READY` ⇒ Local 1v1 và mọi hero không sở hữu
  không thể vào trận (đây cũng là lý do "BOT và Local trông giống nhau": Local
  không chạy tới HUD). Fix: `canPublicSelect` gọi thẳng MỘT thẩm quyền
  `meta.canPublicSelect(id)`; xoá nhánh tự kiểm `owns()`.
- **B1 avatar battle:** payload mới đã có `.apex-battle-avatar`; cần (a) verify
  đủ 6 hero + Mirror (runtime ghost) ở cả 2 bên; (b) live projection
  idempotent — nếu handoff tới muộn/remount, avatar vẫn phải tự sửa (không phụ
  thuộc duy nhất vào message một lần).
- **B2 4 slot tên:** đã có `#p1Rail/#p2Rail .vr-name` + `#p1Side/#p2Side .id-name`;
  verify 2 hero khác nhau ở Local, tên canonical (không phải id), cập nhật lại khi
  đổi tướng giữa trận (remount).
- **B3 Crit/Heavy toàn panel:** HUD mới đã đặt `#globalFx z=35`, `#ruptureLayer
  z=36` trên panel kỹ năng (z=30) và `pointer-events:none` phải giữ; cần browser
  proof full-panel (kể cả vùng skill), cập nhật gate "critical/heavy FX are
  explicitly composited arena < FX < HUD chrome".
- **B4 màu slash theo hero:** accent phải mang theo **từng event** (`attackerAccent`),
  không dùng biến global — nếu P1/P2 heavy cùng lúc, hai vệt không được tranh
  nhau. Ghi nhận: Critical/Storm đã set accent, nhánh Heavy thường chưa.
- **B5 đạn `x/y`:** live probe cho `—` (đang coi như unarmed). Phải có một
  weapon projection duy nhất: `current/capacity/usesAmmo/tier/asset/name`; súng
  dùng đạn luôn hiện `x/y`; `—` chỉ dành cho vũ khí thật sự không có băng đạn
  (gate "unarmed HUD truth is not a fake one-round magazine").
- **B6 độ hiếm súng:** project `tierOf(weaponId)` từ Arsenal authority vào
  `--tier`/`.has-tier` dưới ảnh súng thật.
- **B7 tận dụng không gian:** mở lớn block súng + damage dealt/received (đã tăng
  `--wpIW`); verify ở mọi size band (xem PHASE D).
- **B8 hai family BOT/Local:** donor có family `data-mode="1p"` (CPU threat) và
  `"2p"` (rail/touch riêng). Cần: mode authority chảy xuyên Pick → Battle →
  responsive; test Local 2P thật (sau B0).

### PHASE C — Input authority (side-aware, multi-touch, phone)

- **C1 router side-aware (root).** `public/game/hero-rework/heroReworkRuntime.js:3509`
  và `:3524` hardcode `{side:'p1'}` cho `KeyJ`/`KeyK`; `:3546` mới đúng cho
  `Digit1/Digit2`. Phải: handler nhận `{side, slot, source, pointerId|key}`,
  HUD không bao giờ suy side từ tên hero; hai phía độc lập hoàn toàn.
- **C2 phone press model:** tap ngắn = cast rồi panel hạ ngay; giữ = giữ panel,
  cast khi nhả (`activeSkillPointers` + `.is-held` đã có sẵn trong HUD mới, cần
  hoàn thiện state machine theo pointer/side, tránh "pop lên rồi đứng đó").
- **C3 chấp nhận thao tác nhanh/chồng lấp:** J/K + 1/2 + multi-touch cùng lúc,
  không nuốt input; không phụ thuộc thứ tự.
- Acceptance: gate `test:side-aware-input`, `test:multi-pointer-input` +
  browser matrix ở PHASE H.

### PHASE D — Responsive (mọi tỉ lệ, không hack thiết bị)

- Thay `port/land/desk` thô (`H>W`, ngưỡng cứng) bằng **size band theo container**
  (`cqw/cqh` đã có): wide desktop, compact landscape, tablet portrait, compact
  phone portrait — phân bổ lại diện tích (identity → HP/rival → combat feedback →
  weapon) thay vì thu nhỏ toàn bộ.
- 4 ảnh lỗi của owner: (1) thiếu tận dụng không gian, (2) xén đáy, (3) iPad thu
  nhỏ mọi thứ, (4) phone che/pop panel. Mỗi band phải có ảnh chứng minh.
- Acceptance: browser matrix 1920×1080, 1366×768, 1024×768, 820×1180, 430×932,
  932×430 + ảnh chụp theo band.

### PHASE E — Fighter Pick & mode family

- **E1 Frost pick:** scale hiện ~`1.18`; đích ≈ `1.53` (×1.3), **anchor đáy**
  (chân chìm trước, đầu không bị cắt), **hai bên quay vào giữa** (bỏ `face:-1`
  cố định theo hero; facing theo side), settle về đúng 1 body (không clone/ghost).
  Gate `testGoldFighterPickAdaptationGate` phải được cập nhật sang luật mới này.
- **E2 mode family:** Pick phải phản ánh BOT vs LOCAL đúng như Gold; Mirror dùng
  identity đặc biệt (không tạo static large trái luật).

### PHASE F — Lucky Draw & economy

- **F1 art:** giữ nền sọc donor; mỗi ô reel = **silhouette đen** cắt từ stand-pick
  art; asset lộ ra khi trúng = stand-pick art thật (không đen). Xoá mọi
  placeholder/`luckyPlaceholderArt` còn sót; verify bằng ảnh.
- **F2 economy final revision:** seed lại **một lần** 12.000 AC theo revision mới
  (`OWNER_PLAYTEST_AC_SEED_REVISION` đang là r44; đổi sang revision final) —
  refresh sau đó không refill. Core Six **selectable nhưng không fake ownership**.
- **F3 flow:** hết trận quay về Pick ngay (không kẹt màn unlock); Free Battle
  thoát nhanh bằng nhấp ra ngoài.

### PHASE G — Audio session authority

- Dùng `window.apexAudioHealth` (đã có: contextState/masterGain/unlockArmed/
  activeMedia/productMusic) để **trace** nguyên nhân "mất toàn bộ âm thanh":
  ghi lại begin/end + lý do + visibility; gate `testAudioAuthorityGate` đang đỏ ở
  "battle begin/end carries reason" nên sửa đúng chỗ đó trước.
- Không thêm retry/force-play để che lỗi.

### PHASE H — Legacy removal & final acceptance

- Chỉ xoá legacy sau khi scene coordinator + Gold transition thay thế xong:
  dependency graph → tách hàm engine còn dùng khỏi presentation cũ → xoá hẳn
  loading/menu/picker DOM + runtime + route ownership. Gate
  `testLegacySurfaceCutoverGate` phải nâng từ "suppressed" lên "deleted".
- Gate lỗi thời cần thay luật: `testBattleTransitionAuthorityGate` (đòi
  `#battleTransition` của thiết kế cũ) → viết lại để khẳng định authority mới
  (HUD reveal 430 ms + không door cho battle).
- Browser matrix cuối: BOT + Local, desktop/tablet/phone (portrait+landscape),
  same-hero Local, J+K+1+2 chồng lấp, multi-touch, background/foreground audio,
  3 lần Battle→Pick liên tiếp, Crit/Heavy hai phía đồng thời, load 100ms/1s/long.

### PHASE I — Gold transition file (owner cung cấp)

- Audit file trước khi dùng; giữ nó làm donor authority; boot-critical chỉ gồm
  transition + music + loader tối thiểu; Home Core (Home + Mode + Pick) tải ngay;
  Lucky lazy lần đầu; Battle prewarm lúc vào Pick hoặc Home idle.
- Scene có state `UNLOADED → PRELOADING → READY → ACTIVE → SUSPENDED/DISPOSED`;
  transition có minimum cinematic beat + authored hold khi load lâu; scene cũ
  suspend rồi stop RAF/timer/listener sau khi scene mới visible.

## 6. Feedback → work package (audit matrix, cập nhật 2026-10-05)

| # | Feedback | Trạng thái | Nơi xử lý |
|---|---|---|---|
| 1 | Avatar nhân vật trong battle | **code đã ship (payload mới)**; cần verify 6 hero + live repair | B1 |
| 2 | Crit/Heavy phủ toàn panel (kể cả chỗ skill) | **z-order đã đúng trong HUD mới**; cần browser proof + gate | B3 |
| 3 | Slash Crit/Heavy đổi màu theo hero | một phần (Critical/Storm có accent, Heavy thường chưa) | B4 |
| 4 | Sửa tên 2 đối thủ (4 vị trí) | probe: 4 slot đã bind; cần Local 2 hero khác nhau | B2 |
| 5 | Đếm đạn `x/y` như Gold | **chưa**: probe hiện `—` | B5 |
| 6 | Tận dụng không gian / xén đáy / iPad thu nhỏ | **chưa**: layout band thô | D (+B7) |
| 7 | J/K trigger cả 2 phía; Local không trigger bằng 1/2 | **root đã xác định**: hardcode `side:'p1'` | C1 |
| 8 | Âm thanh đôi lúc mất hẳn | chưa trace xong | G |
| 9 | Full tướng unlock + 12.000 AC | **chưa**: revision còn r44; unlock mới là selection override | F2 (+B0) |
| 10 | Gold có 2 giao diện BOT/Local khác nhau | donor có 2 family; Local chưa chạy tới HUD | B8 (+B0) |
| 11 | Frost pick to ×1.3, chân chìm trước, 2 bên quay vào nhau | **chưa** (đang `face:-1` cố định, scale 1.18) | E1 |
| 12 | Rarity glow dưới cây súng | code HUD mới có `.wp-ico.has-tier`; cần bridge project tier | B6 |
| 13 | Súng & damage to rõ hơn | một phần (`--wpIW` đã tăng); cần verify mọi band | B7 |
| 14 | Hạn chế thao tác bắt buộc (hết trận về Pick, thoát free battle) | chưa | F3 |
| 15 | Phone: tap nhả chiêu ngay, giữ mới giữ panel | HUD có `.is-held`; cần state machine | C2 |
| 16 | Thao tác nhanh/chồng lấp, multi-touch, 2 người | cần router side-aware trước | C3 (+C1) |
| 17 | Lucky Draw: silhouette đen trên reel, art thật khi trúng | đã có hướng trong donor/patch; cần hoàn thiện + ảnh | F1 |
| 18 | Xoá runtime cũ (loading, pick cũ, menu cũ) | mới ở mức hide/suppress | H |
| 19 | Transition Gold mới | chờ file owner | I |
| 20 | Phân bổ luồng load asset | một phần (deferred runtimes + prepareSurface); hoàn thiện ở I | I |
| 21 | CI/acceptance đỏ | baseline: 6 gate đỏ ở HEAD (xem §4); Phase A đưa 2 gate về xanh | §4, H |

## 7. Commit protocol

- Mỗi work package = 1 commit (hoặc 2: tools + artifacts) trên nhánh phiên
  `arena/01a10c3e-apex-chaos`, message theo mẫu
  `fix(<area>): <root cause> — <owner-visible effect>`, kèm bảng bằng chứng.
- Trước mỗi commit: `node tools/buildGoldCutover.mjs --check` PASS,
  `pnpm build` PASS (guard prune), `pnpm test:r50-pre-transition` PASS (hoặc danh
  sách đỏ giảm, không tăng), probe browser của area đó PASS.
- Khi luật đổi (ví dụ door route), gate cũ phải được **viết lại theo luật mới**
  trong cùng commit đó — không để lại assertion mâu thuẫn.
