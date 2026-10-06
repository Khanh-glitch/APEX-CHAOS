# R52 — Kế hoạch hoàn tất cutover (owner-playtest → product)

Trạng thái: **checkpoint `c832a42`** — P5 (economy reseed) + P7 (xoá runtime cũ
menu/pick + một vòng đời nhạc) + H-rest (xoá 457 rule CSS chết, `src/styles.css`
217.238 → 135.740 B) + **F3** (một đường tap-outside duy nhất cho 3 màn, cân lại
chặng doorless: một chặng = một settle, và hàng đợi intent không bị nuốt khi Door
đang bận) đã landed. B0/B1/B2/B5/B6/B8 + luật route đã được chứng minh lại trên
browser (`SLICE_D_EVIDENCE_R52.md`). Kế hoạch gốc: checkpoint `bacffe2`
(nhánh `arena/01a10c3e-apex-chaos`).
Toàn bộ gate trong repo **XANH** (19/19 chuỗi `test:r50-pre-transition`, sweep
`test:*` 0 đỏ, `buildGoldCutover --check` 70/70, prune guard PASS, revision lock
khớp 39 runtime). Tài liệu này là **kế hoạch + ma trận nghiệm thu**: mỗi việc còn
lại đều có (a) anchor chính xác, (b) luật phải đạt, (c) cách chứng minh, (d) gate
giữ luật đó. Không có mục nào được coi là "xong" nếu thiếu bằng chứng.

Baseline: `f8be073654bdc7d3518274747dd280518cd764d5` (R50K).
Các commit mốc: `8dda0d6` (pipeline + real Battle HUD + Lucky Draw),
`0878539` (kế hoạch/ma trận), `74fe3da` (một thẩm quyền READY + selection),
`bacffe2` (một thẩm quyền side cho input + hàng đợi scene intent + gate art).

---

## 0. Đích (definition of done)

1. Boot → Home mở bằng Mechanical Door; Lucky Draw mở/đóng bằng Mechanical Door.
2. `Home → Free Battle → Fighter Pick → Battle` **không** dùng Door; mỗi chặng
   dùng hiệu ứng riêng của nó (shell screen commit + battle HUD reveal 430 ms).
3. Toàn bộ feedback owner-playtest (§6) đạt ở **mọi tỉ lệ màn hình phổ biến**,
   không bug mới, không vá tạm, không thêm thứ thừa.
4. Bề mặt duy nhất được kiểm định là **dist đã prune** (`pnpm build`); mọi gate
   đỏ phải được sửa đúng gốc hoặc **viết lại theo luật đang ship** — không được
   "pass bằng cách xoá assertion".
5. File transition Gold (owner cung cấp) được tích hợp **sau cùng** (Phase I),
   kèm scene state machine + phân bổ luồng load asset; trước đó không mở lại
   phần chuyển cảnh.

## 1. Bất biến (invariants — không vi phạm ở bất kỳ phase nào)

- **Một thẩm quyền cho mỗi việc**: selection/ownership, input side, avatar/art,
  mode, rarity, audio session, scene route, battle readiness. Mọi nơi khác chỉ
  *đọc*.
- **Một scene intent không bao giờ bị nuốt**: request đến giữa transaction được
  **xếp hàng** (latest wins), và transaction bị treo phải được **thả** (stall
  guard) để UI không bao giờ chết input.
- **Source → artifact một chiều**: `docs/gold-ui/current/**` +
  `tools/buildGoldCutover.mjs` sinh `public/gold/**`; `--check` phải PASS, không
  sửa tay file đã sinh (muốn đổi phải sửa nguồn + regenerate).
- **Gate kiểm artifact/hành vi**, không chỉ chuỗi trong source. Gate mới phải
  đọc bytes HTML đã ship hoặc chạy browser/headless thật.
- **Không `transform: scale()` / media query vá từng máy** để "vừa màn hình";
  phân bổ không gian bên trong layout (size band theo container, học Gold).
- **Không fake ownership**: Core Six *chọn được* nhờ override, nhưng `owns()`
  giữ nguyên để Lucky Draw còn pool.
- Sau mỗi lần sửa runtime có `?v=APEX_ARSENAL_RUNTIME_REVISION`:
  `UPDATE_LOCK=1 node tools/testRuntimeRevisionGate.mjs`.

## 2. Cách xác minh (harness dùng cho mọi phase)

1. `node tools/buildGoldCutover.mjs --check` (70 file phải khớp) — nếu sửa nguồn
   thì chạy `node tools/buildGoldCutover.mjs` rồi `--check`.
2. `pnpm build` = `materializeArsenalFinalSfx` → `assetAudit` → `vite build` →
   `generatePublicAssetManifest` → `pruneShippingDist` (guard fail-closed: mọi
   `src|href` nội bộ trong HTML của dist phải tồn tại; `forbiddenRuntimeSurvivors`
   phải rỗng).
3. `pnpm preview` (:4173, 0.0.0.0) + Chromium thật (`@sparticuz/chromium`,
   `LD_LIBRARY_PATH=/tmp/al2023/lib`). Probe tối thiểu:
   - boot: `body[data-apex-scene-transition]=DONE`,
     `#gold-shell-host[data-apex-gold-mounted=1]`, `apexUiSfx.keys().length===18`;
   - 3 chặng screen: mẫu `data-apex-scene-transition` chỉ được là `DONE`;
   - Lucky: `#luckyDonorHost.is-open`, donor `/gold/lucky-draw.html`, Escape đóng;
   - Battle: `#battleHudHost.is-open`, `#hud[data-mode]`, avatar thật
     (`naturalWidth>0`) ở **cả hai** side, 4 slot tên, `x/y` đạn khi có súng có
     băng, `#globalFx/#ruptureLayer` trên panel kỹ năng, 0 page error.
4. Gate: `pnpm test:r50-pre-transition` + sweep `test:*` (danh sách đỏ chỉ được
   giảm).
5. Bằng chứng (bảng trước/sau + ảnh khi là layout) ghi vào
   `docs/acceptance/owner-playtest/SLICE_*_EVIDENCE_*.md`.

## 3. Đã hoàn tất (verified)

### 3.1 Pipeline & bề mặt ship (commit `8dda0d6`)

- `tools/buildGoldCutover.mjs:1813` từng bị SyntaxError ⇒ không ai regenerate
  được `public/gold/**`; shell giữ payload battle HUD cũ 108.204 B trong khi
  `battle-hud.html` đã 114.328 B. Đã sửa; `--check` 70/70 PASS.
- Shell hiện embed **đúng bytes** `public/gold/battle-hud.html`
  (`decoded === hud`, 114.389 B) — kéo theo: `.apex-battle-avatar`,
  `#globalFx{z-index:35}` / `#ruptureLayer{z-index:36}` (trên chrome z=30),
  `.wp-ico.has-tier`, `--wpIW:clamp(108px,13cqh,148px)` / `clamp(124px,14cqh,160px)`,
  `.skill.is-held`, `wp-cur/wp-max`, `.df-value` lớn hơn.
- Prune guard fail-closed (`tools/pruneShippingDist.mjs`) + audit suy ra runtime
  do shell nạp (`shellRuntimeScriptPaths`, `UI_SFX_RUNTIMES`): prune xoá
  723 file / 196.278.112 B, giữ `/game/ui/uiSfxAuthority.js` + 18 ogg,
  `sfxKeys=18`, `forbiddenRuntimeSurvivors: []`.
- Lucky Draw hết ReferenceError: seam một cửa `window.apexShellSfx=uiSfx;`, block
  Lucky gọi qua seam (`window.apexShellSfx&&window.apexShellSfx('lucky.draw.enter_bay')`),
  `battle-hud.html` guard `if(window.APEX_GOLD_HUD)window.APEX_GOLD_HUD.setMode(...)`.

### 3.2 Luật route & battle (commits `74fe3da`, `bacffe2`)

| Việc | Luật đang ship | Bằng chứng |
|---|---|---|
| 3 chặng screen | `setScreen()` chỉ `await prepare(); commitScreen(next); focusScreen(next);` — không `tr.run` | Adapter `tools/goldShellR50k.mjs` (writer cuối) + browser: mẫu door chỉ `["DONE"]` cho cả 3 chặng |
| Door chỉ còn | boot + `home->lucky` / `lucky->home` | shell chỉ có 2 `name:'…'`; adapter có `forbidden` chặn `name:\`${screen}->${next}\`` |
| Battle reveal | mount ẩn (`is-preloading`) → preview handoff → **production READY + frame thật** → shutter 430 ms (`is-transitioning → is-reveal → is-open`) → `screen='battle'`; `battleEntryToken` chống continuation cũ | gate Lifecycle PASS 48; browser: BOT/`LOCAL` HUD `is-open`, 0 page error |
| Selection | `canPublicSelect` gọi MỘT thẩm quyền `APEX_ARSENAL_META.canPublicSelect(id)` (không tự kiểm `owns()`) | browser Local 1v1: `live=true`, p1=CRYSTAL, p2=HUNTER (không sở hữu) |
| Input side | `normalizeCastInput` lấy `ct.side` làm thẩm quyền (caller chỉ còn `declaredSide` telemetry); J/K/Digit1/Digit2 suy side từ slot `fighters` | gate side-aware PASS 23 (chạy thật helper trong vm) |
| Scene intent | coordinator **xếp hàng** intent (latest wins, cái bị thay thế resolve `superseded`) + **stall guard** (không tiến triển 6 s, hoặc quá 30 s ⇒ thả, xoá cover, trả input) | gate transition runtime PASS 47 (queue/supersede/stall chạy trên fake door) |
| Art authority | `HERO_PRESENTATION` + `applyHeroPresentation` là thẩm quyền duy nhất; `WORLD_ART = {}` (Mirror runtime-derived); world stage `sourceHero.art` | gate core-six-art **PASS 106** (trước là FAIL 4 ở cả baseline lẫn HEAD) |

### 3.3 Bằng chứng browser trên dist đã prune (`/tmp/browser/r51.out`)

| Bước | Kết quả đo |
|---|---|
| boot | `goldMounted=1`, `apexUiSfx.keys()=18`, door `CLOSING→…→DONE` |
| Home → Free Battle | door samples `["DONE"]`, screen `screen-mode` |
| Free Battle → Pick | door `["DONE"]`, `screen-fighter`, 12 roster card, 2 world slot |
| Pick → Battle | door `["DONE"]`, HUD `is-open`; `data-mode="2p"` (Local), key P1 `J/K`, key P2 `1/2`; avatar `battle_avatar.webp?…r50k` `naturalWidth=512` ở **cả hai** side; `#globalFx z=35`, `#ruptureLayer z=36`, side chrome `z=30`; rails `ROBOT/ROBOT`; `wp-cur=—` (kit tay không) |
| Lucky | bay mở (donor `/gold/lucky-draw.html`) door `CLOSING`; đóng bằng Escape thật **kể cả khi request đến giữa transaction** (luật hàng đợi) |
| Lỗi | 0 page error (chỉ 1 request fonts.googleapis bị chặn trong sandbox) |

## 4. Trạng thái gate hiện tại (đo tại `bacffe2`)

| Gate | Kết quả |
|---|---|
| `pnpm test:r50-pre-transition` (20 gate) | **exit 0** — ShellLoader 9, Visibility 25, Lifecycle 52, Economy 27, FighterPick 14, HudAdaptation 19, AssetIntent 23, SideAware 23, HudLive 20, PickPresentation 11, MultiPointer 17, **PickBandLaw 66**, AudioAuthority 17, BattleOutcomeSide 9, LuckyArt 18, RevisionIntegrity 16, LegacySurface 31, Coordinator 56, Runtime 47, RoutePolicy 27 |
| Sweep `test:*` (39 script) | **0 đỏ** (gồm `core-six-art` 106, `core-six-art-delivery` 110, `product-music` 29, `favicon` 8, `home-story` 17, `core-six-hero-av` 264/264, `shipping-dist`, `source-hygiene`, `product-graph`, `runtime-revision`) |
| `buildGoldCutover --check` | 70/70 khớp |
| `pnpm build` + prune | 723 file / 196.278.112 B xoá, guard PASS, 0 runtime cấm sống sót |

## 5. Việc còn lại — work packages (thứ tự thực thi)

| # | Phase | Nội dung | Trạng thái |
|---|---|---|---|
| P1 | B1/B2/B4/B5/B6/B7 | Battle HUD truth: avatar 6 hero, 4 slot tên theo hero thật, accent Heavy theo event, đạn `x/y` với súng có băng, tier glow theo súng thật, không gian block súng | ⏳ probe + sửa nếu lệch |
| P2 | C2/C3 | Phone press model (tap = cast + hạ panel; giữ = giữ panel, cast khi nhả) + chấp nhận input chồng lấp/multi-touch | ⏳ |
| P3 | D | Size band theo container + phân bổ lại diện tích cho 6 tỉ lệ, ảnh chứng minh từng band | ✅ luật band Pick (`goldShellR52pickBand.mjs`, gate 66) + 12 ảnh `matrix/`; phần HUD giữ nguyên (đã đạt `overflow=[]` mọi band) |
| P4 | F1 | Lucky art: reel = silhouette đen cắt từ stand-pick art, reveal = art thật; bỏ mọi placeholder | ⏳ |
| P5 | F2 | Seed lại 12.000 AC **một lần** theo revision mới (đang `…-r44`) | ⏳ |
| P6 | F3 | Flow: hết trận về Pick ngay (không kẹt màn unlock), Free Battle thoát nhanh bằng nhấp ra ngoài | ⏳ |
| P7 | H-rest | Xoá tham chiếu chết `menu-screen/select-screen` + `goToMenu()` khỏi đường Gold; nâng `testLegacySurfaceCutoverGate` từ "suppressed" lên "deleted" | ⏳ |
| P8 | G | Trace "mất toàn bộ âm thanh" bằng `apexAudioHealth` (background/foreground) + giữ luật reason ở mọi begin/end | ⏳ |
| P9 | I | File transition Gold của owner: audit → tích hợp → scene state machine + phân bổ load asset → revision bump cuối + matrix cuối | ⏳ chờ file |

### P1 — Battle HUD truth (B1/B2/B4/B5/B6/B7)

- **Luật**: mọi thứ HUD hiển thị phải lấy từ **một projection production**
  (`goldProductBridge` → seam `APEX_GOLD_HUD`), không có nhánh donor mặc định.
- **Việc cụ thể**
  1. *Đạn `x/y` (B5)*: đo với súng **có băng** — vào arena, `APEX_ARSENAL.weaponApi.equip(f, id)`
     hoặc nhặt súng; đọc `wp-cur/wp-max`. Nếu `—` vẫn xuất hiện cho súng có băng
     ⇒ sửa `goldProductBridge` weapon projection (`usesAmmo/mag/ammo` —
     anchor `WEAPON_PROJECTION`, `renderWeapon` trong `battle-hud.html:984-1006`).
  2. *Avatar (B1)*: quét đủ 6 hero + Mirror (ghost runtime) ở cả 2 side: `src`
     phải là `battle_avatar.webp` của đúng hero, `naturalWidth>0`, cập nhật lại
     sau remount (không phụ thuộc message một lần).
  3. *4 slot tên (B2)*: Local 2 hero khác nhau ⇒ `#p1Rail .vr-name`,
     `#p2Rail .vr-name`, `#p1Side .id-name`, `#p2Side .id-name` = tên canonical;
     đổi tướng giữa trận ⇒ 4 slot cập nhật.
  4. *Accent Heavy theo event (B4)*: nhánh Heavy phải mang `attackerAccent` của
     **event đó** (`onRealizedDamage` → `impactAccent`), không dùng biến CSS
     chung; hai Heavy đồng thời hai phía không tranh màu.
  5. *Tier glow (B6)*: `.wp-ico.has-tier` + `--tier` phải được set trong **live
     frame** từ súng thật (`tierOf` của Arsenal authority), không chỉ preview.
  6. *Không gian (B7)*: block súng + damage dùng hết chỗ theo size band (P3).
- **Gate**: mở rộng `testGoldBattleHudAdaptationGate` + `testBattleHudLiveTruthGate`
  bằng assertion đọc payload bytes + projection thật (đã có nền); thêm probe
  browser equip-súng vào harness.
- **Chứng minh**: bảng 6 hero × (avatar src/naturalWidth) + ảnh HUD có súng có
  băng (đạn `x/y`), ảnh Heavy hai phía đồng thời.


### P3 — Fighter-Pick bottom band law (D, R52)

- **Luật**: Pick có **hai band** — roster co theo `vh`, LOCK giữ **pixel** — nên
  LOCK luôn chồng lên hàng tên ở viewport thấp (13–16 px ở 1024–1366, 1,8 px ở
  932×430, đúng 1080 thì vừa khít). Luật band (`tools/goldShellR52pickBand.mjs`,
  LAST writer sau R50K) giữ **mép trên** deck (khe identity 7–11 px) và đặt
  `bottom = max(bottom tác giả, lockBottom + lockHeight + 0,2vh)`; mọi con số
  **derive từ rule canonical** (donor lệch ⇒ build đỏ).
- **Hai sàn ambient** phải ghim vì stylesheet menu React đã nghỉ còn sống cùng
  tên class: `button{min-height:44px}` (LOCK 30/42 px bị nâng lên 44) và
  `@media(max-width:680px) .roster{min-height:230px}` (roster content-sized
  trong `inset:0;height:auto` ⇒ 230 px trong band 147 px ở phone).
- **Chứng minh**: gate `test:pick-band-law` **66 checks** (có phản chứng:
  canonical *đã* xén ở 1366/1280/1024/932); browser 6 band `overflow=[]`,
  CLEAR ≥ 9 px; ảnh `matrix/pick-*.png`.

### P2 — Input phone & chồng lấp (C2/C3)

- **Luật**: tap ngắn = cast ngay + panel hạ; giữ = panel ở lại, cast khi nhả;
  nhiều pointer độc lập theo `(side, slot)`; không phụ thuộc thứ tự.
- **Anchor**: `battle-hud.html` pointer state (`activeSkillPointers`, `.is-held`,
  `finishSkillPointer`), bridge `pressSkill(pi, ai, sourceMeta)` (map `pi→side`),
  runtime `heroReworkRuntime` (đã có một thẩm quyền side từ `bacffe2`).
- **Việc**: hoàn thiện state machine theo pointer/side trong HUD; đảm bảo
  `pointercancel/lostpointercapture` không để panel kẹt; `data-mode="1p"` không
  nhận input P2.
- **Gate**: `testMultiPointerAbilityInputGate` (14) + `testSideAwareAbilityRoutingGate`
  (23) mở rộng theo luật press/hold; probe touch thật (multi-touch 2 ngón).

### P3 — Responsive (mọi tỉ lệ)

- **Luật**: bỏ band thô `desk/land/port` theo `H>W`; band theo **container**
  (`cqw/cqh` đã có), phân bổ lại identity → HP/rival → feedback → weapon thay vì
  thu nhỏ toàn bộ; không xén đáy; không để panel che nhân vật.
- **Matrix bắt buộc**: 1920×1080, 1366×768, 1024×768, 820×1180, 430×932, 932×430
  + ảnh từng band (đo `getBoundingClientRect` của weapon panel/skill panel để
  chứng minh không tràn/cắt).
- **Gate**: mở rộng `testGoldBattleHudAdaptationGate` (band thresholds) + probe
  matrix trong `tools/testGoldCutoverBrowser.mjs`.

### P4 — Lucky art (F1)

- **Luật**: reel = **silhouette đen** cắt từ stand-pick art (giữ nền sọc donor);
  khi trúng hiện **art thật**; không placeholder.
- **Anchor**: `docs/gold-ui/current/donors/lucky-draw/index.html`,
  `tools/buildGoldCutover.mjs` patch lucky art (`:901`, `:1294`, `:1926`),
  bridge `luckyRoster` (`:422-424`), `public/gold/assets/…` lucky reel assets.
- **Gate**: `testLuckyDrawProductionArtGate` (18) — mở rộng: mọi cell reel phải
  là silhouette được sinh từ art thật của hero trong pool; reveal phải trỏ art thật.
- **Chứng minh**: ảnh donor lúc quay + lúc reveal.

### P5 — Economy reseed (F2)

- **Luật**: `OWNER_PLAYTEST_AC_SEED = 12000` seed **đúng một lần cho mỗi
  profile/revision**; bump revision ⇒ mọi profile hiện có được refill một lần
  nữa rồi thôi (refresh thường không refill).
- **Việc**: đổi `OWNER_PLAYTEST_AC_SEED_REVISION` (và
  `OWNER_PLAYTEST_CORE_SIX_UNLOCK_REVISION`) sang revision runtime hiện hành;
  cập nhật literal tương ứng trong `tools/testOwnerPlaytestEconomyGate.mjs`
  (dòng ~74, ~141); giữ `owns()` nguyên vẹn.
- **Chứng minh**: probe browser với profile đã tiêu AC ⇒ credits = 12.000 sau
  boot, refresh lần 2 không đổi.

### P6 — Flow ít thao tác (F3)

- **Luật**: hết trận ⇒ về Pick ngay (không màn unlock/debrief trung gian);
  Free Battle đang mở ⇒ nhấp ra ngoài (hoặc Esc) thoát ngay.
- **Anchor**: `arsenalBattleRuntime` kết thúc trận + `goldHosted` exit seam
  (`window.postMessage({type:'APEX_CHAOS_BATTLE_EXIT'})`), shell `closeBattleHud()`,
  `#hud` overlay click-outside; `testBattleOutcomeSideGate` (9).
- **Chứng minh**: probe 3 lần liên tiếp Battle→Pick (không kẹt), và nhấp ra
  ngoài khi Free Battle ⇒ về Home/Pick ngay.

### P7 — Legacy removal (H-rest)

- **Luật**: bề mặt ship **không còn** route/DOM legacy; gate nâng từ "suppressed"
  lên "deleted".
- **Việc**: xoá `setProductScreenHidden('menu-screen'|'select-screen', …)` và
  `legacyUiElement('hud')`-only writes khỏi `public/apexEngine.js`
  (`:2414`, `:2415`, `:2569`, `:2570`, `:2685`, `:2686`) và
  `public/game/modes/arsenalBattleRuntime.js` (`:958`, `:1104`); `goToMenu()`
  chỉ còn cho nhánh legacy không-Gold (đường Gold dùng engine teardown +
  postMessage). Xoá hẳn runtime không còn consumer sau khi đối chiếu
  `assetAudit`/`runtimeManifest`.
- **Gate**: `testLegacySurfaceCutoverGate` (22) + `testProductionSourceHygiene`
  phải khẳng định **không còn tham chiếu** nào tới id legacy.

### P8 — Audio trace (G)

- **Luật**: mọi begin/end session có **reason**; `apexAudioHealth()` giải thích
  được trạng thái (contextState/masterGain/unlockArmed/activeMedia/productMusic).
- **Việc**: probe kịch bản background→foreground→battle→lucky, ghi
  `apexAudioHealth()` + `battleAudioLastTransition`; nếu có nhánh mất tiếng ⇒ sửa
  tại call site có reason (không retry/force-play để che lỗi).
- **Gate**: `testAudioAuthorityGate` (17) + `testProductMusicAuthorityGate` (29).

### P9 — File transition Gold (I) — sau cùng

- Audit file owner (bytes, export, timing), giữ làm donor authority.
- Scene state machine `UNLOADED → PRELOADING → READY → ACTIVE → SUSPENDED/DISPOSED`;
  scene cũ suspend rồi stop RAF/timer/listener sau khi scene mới visible.
- Phân bổ load: boot-critical = transition + music + loader tối thiểu; Home Core
  (Home+Mode+Pick) ngay; Lucky lazy lần đầu; Battle prewarm lúc vào Pick/Home idle.
- Revision bump cuối (`APEX_ARSENAL_RUNTIME_REVISION` + lock + mọi `?v=`),
  rebuild, prune guard, matrix cuối (BOT+Local, desktop/tablet/phone, portrait+
  landscape, same-hero Local, J/K+1/2 chồng lấp, multi-touch, audio bg/fg,
  3 lần Battle→Pick, Crit/Heavy hai phía).

## 6. Feedback → work package (cập nhật theo `bacffe2`)

| # | Feedback | Trạng thái | Bằng chứng / việc còn lại |
|---|---|---|---|
| 1 | Avatar dùng art thật của hero | ✅ | payload `.apex-battle-avatar` + `has-production-avatar`; browser: `battle_avatar.webp` `naturalWidth=512` cả 2 side; gate core-six-art 106 |
| 2 | Critical/Heavy phủ **toàn panel** | ✅ (artifact) | `#globalFx z=35` / `#ruptureLayer z=36` > chrome `z=30`, `pointer-events:none`; cần ảnh khi có đòn thật (P1.4) |
| 3 | Slash Crit/Heavy đổi màu theo hero | ✅ | `attackerAccent` cho Crit/Heavy/Storm (HUD payload `impactAccent`); probe cùng-hero LOCAL: mỗi phím **một** cast đúng side/slot |
| 4 | 4 vị trí tên 2 đối thủ | ✅ | browser Local: 4 slot = CRYSTALA/HUNTER/CRYSTALA/HUNTER; còn test remount (P1.3) |
| 5 | Đếm đạn `x/y` như Gold | ✅ | browser: equip SMG thật → `weapon` (bỏ `.no-ammo`), `SMG/AUTO/8 /8`, `magBar true`; projection đọc bảng config (`SMG.shots=8`) |
| 6 | Tận dụng không gian / không xén đáy / iPad không thu nhỏ | ✅ phần **xén đáy** | luật band Pick: deck không bao giờ chìm dưới band LOCK ở 14 viewport (gate `pick-band-law` 66, ảnh `matrix/pick-*.png`); HUD theo band `overflow=[]`; `--wpIW` 124–160px ở band rộng |
| 7 | J/K không được trigger cả 2 phía; Local 1/2 phải trigger | ✅ | `normalizeCastInput` + resolver theo slot; gate side-aware 23 (queue/stall không liên quan input) |
| 8 | Âm thanh đôi lúc mất hẳn | 🟡 | mọi begin/end có reason; `apexUiSfx.keys()=18`; trace bg/fg (P8) |
| 9 | Full tướng unlock + 12.000 AC | ✅ / 🟡 | selection mở (probe `canPublicSelect=true`, credits 12000, gate Economy 23); refill một lần nữa theo revision (P5) |
| 10 | Gold có 2 giao diện BOT/Local | ✅ | browser: BOT `data-mode="1p"` + P2 `pointer-events:none` + key `CPU`; Local `data-mode="2p"` + key `1/2` + `rotate:180deg` (portrait) |
| 11 | Frost pick ×1.3, chân chìm trước, 2 bên quay vào nhau | ✅ | `scale 1.53`, origin `50% 68%`, chân vượt đáy 72/73 px ở cả 2 side; gate FighterPick 14 |
| 12 | Rarity glow dưới cây súng | 🟡 | payload có `.wp-ico.has-tier` + `--tier`; cần chứng minh live frame với súng thật (P1.5) |
| 13 | Súng & damage to rõ hơn | 🟡 | `--wpIW` + `.df-value` đã tăng; ảnh theo band (P3) |
| 14 | Ít thao tác bắt buộc (hết trận về Pick, thoát Free Battle) | ⏳ | P6 |
| 15 | Phone: tap nhả chiêu ngay, giữ mới giữ panel | ✅ | phone 430×932: tap → 1 cast + pad về rest; giữ → `is-held` tới lúc nhả, 1 cast khi nhả; `.skill{touch-action:none}` chặn trình duyệt cướp cử chỉ; không kẹt panel khi `pointercancel` |
| 16 | Thao tác nhanh/chồng lấp, multi-touch | ✅ | hai ngón cùng slot → **1** cast; hai slot cùng phía → 2; hai phía → 2 (`p1`/`p2`); double-tap tuần tự → 2; gate `test:multi-pointer` 17 |
| 17 | Lucky: silhouette đen trên reel, art thật khi trúng | ⏳ | P4 |
| 18 | Xoá runtime cũ (loading/menu/pick) | ✅ | gate `test:legacy-surface-cutover` **31** (deleted): 0 id legacy trong `public/` + 0 rule legacy trong `src/styles.css`, asset chết đã xoá |
| 19 | Transition Gold mới | ⏳ | chờ file owner (P9) |
| 20 | Phân bổ luồng load asset | 🟡 | deferred runtimes + `prepareSurface` đã có; scene state machine ở P9 |
| 21 | CI/acceptance đỏ | ✅ | 19/19 gate + sweep 0 đỏ; `core-six-art` từ FAIL 4 → PASS 106 |

## 7. Commit protocol

- Mỗi work package = 1 commit (tools + artifacts cùng nhau) trên nhánh phiên
  `arena/01a10c3e-apex-chaos`; message `fix(<area>): <root cause> — <hiệu ứng
  người chơi thấy>` kèm bảng bằng chứng.
- Trước commit: `--check` PASS, `pnpm build` PASS (prune guard),
  `pnpm test:r50-pre-transition` PASS, sweep không tăng đỏ, probe browser của
  area đó PASS.
- Khi luật đổi: gate cũ phải được **viết lại theo luật mới** trong cùng commit —
  không để lại assertion mâu thuẫn, không xoá assertion.
- Sau mỗi lần sửa runtime versioned: `UPDATE_LOCK=1 node tools/testRuntimeRevisionGate.mjs`.
- Push ngay sau mỗi commit (checkpoint) để owner theo dõi được.

## 7b. N1..N4 — bốn bug owner báo 2026-10-06 (map 1-1)

| # | Owner báo | Trạng thái | Bằng chứng |
| --- | --- | --- | --- |
| N1 | Magnet không hiện gì trong battle; Frost load chậm hơn | **XONG** (`a0483dd`) | `SLICE_E_EVIDENCE_R52.md` §E1, gate `testHeroBattleRigDeliveryGate` 24 |
| N2 | BOT + Local: J/K tác động cả hai bên | **XONG** | §E2, +7 check robot ROBOT-vs-ROBOT, +10 check side-aware |
| N3 | Trả lại transition gốc của donor (`#battleTransition`) | **XONG** | §E3; gate viết lại thành 160 check; adapter là owner duy nhất của vùng entry |
| N4 | Một authority accent cho Crystal = violet | **XONG** | §E4; gate `testHeroAccentLanguageGate` 27; browser: 4/4 nơi = `#a066f0` |
| E5 | Critical/Heavy phải phủ **trọn** panel (2 ô skill bị loại) | **XONG** (`c33c96b`) | `SLICE_E_EVIDENCE_R52.md` §E5; gate `testGoldBattleHudAdaptationGate` 27; gốc là blend `screen` trên nền `#0d1013`, không phải z-index |
| R53 | Scene transition: Lucky Draw đóng băng + mode card không phản hồi | **XONG** (`7e1ccd2`) | §E6; gate mới `testSceneInputLockLawGate` 40; 6 luật gốc (L1..L6) trong `src/styles.css` + `src/game/sceneTransitionCoordinator.js` |

Luật khi làm N3: gate cũ mâu thuẫn với luật mới thì **viết lại trong cùng commit**, kèm
lý do + trạng thái trước/sau — không xoá assertion im lặng.

## 8. Thứ tự thực thi R52 (đang áp dụng)

1. `P5` (economy reseed) + `P7` (xoá tham chiếu chết) — rẻ, rủi ro thấp, gate rõ.
2. `P1` — probe 6 hero/avatar/tên/đạn/tier/accent; sửa đúng projection nếu lệch;
   mở rộng gate 2 chiều (bytes + browser).
3. `P2` — hoàn thiện press/hold + multi-pointer, probe touch thật.
4. `P3` — size band theo container + matrix 6 tỉ lệ + ảnh.
5. `P4` — Lucky reel art + gate ảnh.
6. `P6` — flow hết trận/vào Free Battle.
7. `P8` — audio trace bg/fg.
8. `P9` — tích hợp file transition owner → revision bump cuối → matrix cuối.

Mỗi bước giữ nguyên luật ở §1 và chỉ được "xong" khi có bằng chứng ở §2.
