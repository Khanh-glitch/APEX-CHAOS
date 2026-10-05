# SLICE D — evidence R52 (owner-playtest → product)

Revision `20261005-owner-playtest-r50k` (runtime `?v=`), owner-playtest data
revision `20261005-owner-playtest-r52`. Branch `arena/01a10c3e-apex-chaos`.

## What was fixed at the root in this slice

| # | Owner symptom | Root cause found | Fix (one authority) | Proof |
|---|---|---|---|---|
| P5 | “12.000 AC / full unlock” không còn đúng trên profile đã chơi | seed marker theo revision nhưng revision không đổi từ `…-r44` | `OWNER_PLAYTEST_REVISION='20261005-owner-playtest-r52'` sở hữu CẢ hai override (chọn Core Six + seed AC); gate đọc revision từ runtime, không hardcode | `test:owner-playtest-economy` PASS 27 (gồm profile r44 11.650 → 12.000 một lần, spin 350 → 11.650, refresh không refill) |
| P7 | runtime cũ (menu/pick/loading) còn sót | 6 write vào `#menu-screen`/`#select-screen` đã bị xoá khỏi DOM + cả cụm pick/preview chết + `menuMusicAllowed` không tồn tại (PAGEERROR) + `allowedByDom()` đọc id đã xoá | xoá hẳn: helper + 6 write + cụm `drawRosterPreview…selectFighter`, `goToSelect` → `APEX_GOLD_SHELL_NAVIGATE('fighter')`; music fallback đọc class `screen-*` của `#stage` (sống); App chỉ còn MỘT vòng đời nhạc | `test:legacy-surface-cutover` 22→29, `test:gold-battle-lifecycle` 49 (nhánh goldHosted teardown-only), `test:r50-pre-transition` 19/19 |
| B0 | Local 1v1 không vào được trận (READY) | một thẩm quyền selection/READY (đã sửa ở `74fe3da`) | — | browser (local dist :4173): CRYSTALA + HUNTER (**không sở hữu**) → `live:true`, HUD `is-open`, `battleMode LOCAL`, 0 page error |
| B5 ✅ | “đếm đạn x/y như Gold” | `weaponProjection` đọc `holder.def.shots`, nhưng `def` là **behaviour def** (`{id,category,spriteKey,onEquip,canActivate,activate,update}`) — không có `shots`; số nằm ở `APEX_ARSENAL_CONFIG.WEAPONS[id]` | projection lấy `shots/family/name` từ bảng config (một thẩm quyền số liệu) | browser: `window.fighters[0].data.arsenal.defKeys=['id','category','spriteKey','onEquip','canActivate','activate','update']` + `APEX_ARSENAL_CONFIG.WEAPONS.SMG.shots=8`; gate `test:battle-hud-live` thêm 2 luật (20 checks) |
| B1/B2/B6/B8 | avatar thật, 4 slot tên, tier glow, hai giao diện BOT/Local | — (đã có từ `74fe3da`) | — | browser: avatar `battle_avatar.webp` `naturalWidth=512` cả 2 side; 4 slot = CRYSTALA/HUNTER/CRYSTALA/HUNTER; `.wp-ico.has-tier` + `--tier:#63E28B` sau khi equip SMG; BOT `1p` + P2 `pointer-events:none` + key `CPU`, LOCAL `2p` + key `J/K` + `1/2` |
| route | 3 chặng phải doorless | — (đã có từ `74fe3da`) | — | browser: `pickToBattle: ["DONE"]`, `battleToPick: ["DONE"]`; Lucky vẫn qua Door (Escape đóng 151 ms sau khi mở) |

| F3a | “quá nhiều bước, không huỷ được bằng cách bấm ra ngoài nền tối” | shell **không có** đường tap nào (chỉ Escape/Enter); `#fighterSelectScreen` phủ kín viewport nên “vùng trống” = nền panel, không phải ngoài panel | luật một-đường-ra trong `goldShellR50k.mjs`: cặp pointerdown/up, tap ngắn & đứng yên (≤420 ms theo **`e.timeStamp`** của chính sự kiện, ≤12 px), bỏ qua khi Door `active()`, khi `flow-transition`, khi Lucky đang mở, và khi điểm chạm nằm trong điều khiển (`button,a,input,select,textarea,label,[role=button],[data-arsenal-act],.cta,.modeCard,.rosterCard,.lockIn,.skill,.weapon,.wp-swap,.wp-ico`); `screen==='mode'|'fighter'` → `back()`; `screen==='battle'` + cờ `body.battle-result` → `closeBattleHud()` | browser (dist prune :4173): mode nền → home **79–127 ms**, fighter vùng trống → mode **115 ms**, home tap **inert**, double-tap = **đúng 1 bước**, tap thẻ đấu sĩ **không** rời màn, kéo 6 bước **không** rời, giữ 700 ms **không** rời, battle giữa trận **không** thoát, cờ kết quả bật → HUD đóng **0 ms** và về fighter, 0 page error |
| F3b | chặng doorless vẫn “nặng” (2–10 s/chặng trong sandbox) | `setScreen` chờ `prepareElement(stage)` với `verifyImages:true` → **decode lại toàn bộ ảnh world-stage ở full raster** mỗi chặng (ảnh đã hiển thị vẫn phải decode lại; 4.7–10 s trong software raster) | luật cân-chặng: `prepareElement(surfaceRoot)` cho media của **đúng panel đích** (do `APEX_GOLD.prepareSurface` sở hữu) rồi `prepareElement(stage,{verifyImages:false})` (fonts + 2 frame đã vẽ) — cùng hợp đồng `verifyImages:false` mà chính coordinator dùng cho boot | browser (rAF shim 16 ms để loại chi phí renderer software): home→mode **102 ms**, mode→fighter **824 ms** (gồm timer 360 ms của `chooseMode`), fighter→mode **115 ms**, mode→home **79–88 ms** |
| F3c | “bấm mà không thấy gì xảy ra” (route bị nuốt) | `setScreen` **return false** khi Door đang `active()` và `navigateGoldShell` cũng return false theo trạng thái Door → intent mất hẳn, không hàng đợi, không thử lại | luật không-nuốt-bước: intent doorless được **xếp hàng** (`queuedScreen`, latest wins) và `drainQueuedScreen()` thử lại mỗi 120 ms cho tới khi Door nhả; guard route chỉ còn `transition`/`battle` | browser: mode→fighter đạt **824 ms** ổn định sau nhiều lần lặp; gate lifecycle thêm luật (52 checks) |

| C2 ✅ | phone: “tap nhả chiêu ngay, giữ mới giữ panel” | chưa đo được trên máy thật; pad là `button`/`.skill` nên trình duyệt có thể “cướp” cử chỉ (scroll) giữa lúc giữ ⇒ `pointercancel` ⇒ mất cú cast khi nhả | luật sở hữu cử chỉ: `#hud .skill,#hud .wp-swap{touch-action:none;user-select:none;tap-highlight:transparent}`; state machine giữ nguyên một đường cast khi nhả (tap = cast + pad về rest ngay; giữ = pad ở `is-held` tới lúc nhả) | browser phone 430×932 (`port/compact/2p`), CDP touch thật: `getComputedStyle('.skill').touchAction === 'none'`; tap P1-A1 → **1** cast (`p1`/`A1`); giữ 450 ms → `is-held` **trong lúc giữ**, **1** cast khi nhả, sau đó `is-held` sạch; kéo khỏi pad rồi nhả → **1** cast, không kẹt panel; 0 page error |
| C3 ✅ | “một pad, hai ngón ⇒ hero bị đánh 2 lần” (video owner) | `activeSkillPointers` chỉ khoá theo `pointerId`; ngón thứ hai là pointerId mới ⇒ cast lần nữa cho **cùng** `(side, slot)` | luật slot là một mục tiêu: `activeSkillSlots` giữ `(side,slot)` đang được một pointer còn sống nắm; pointer thứ hai vào cùng slot bị bỏ qua, các slot khác vẫn độc lập | browser phone: hai ngón cùng pad P1-A1 → **1** cast (trước sửa: 2); hai ngón hai slot cùng phía (P1-A1 + P1-A2) → **2** cast đúng slot; hai ngón hai phía (P1-A1 + P2-A1) → **2** cast `p1`/`p2`; double-tap tuần tự cùng pad → **2** cast (spam hợp lệ vẫn chạy); gate `test:multi-pointer` **17 checks** |
| #3 ✅ | “J/K: cùng hero bị đánh 2 lần / cả hai chiêu cùng kích” (video owner) | không còn ở HEAD: `sideOfFighter()` lấy side theo **slot trong `fighters[]`**, `normalizeCastInput` lấy `ct.side` (không cho caller đổi chủ), `BRIDGE.pressSkill` ép `meta.side = pi===1?'p2':'p1'` | (không cần sửa — kiểm chứng lại bằng probe cùng-hero) | browser LOCAL **CRYSTAL vs CRYSTAL** (đúng ca trong video), bấm từng phím: `KeyJ` → **1** `pressAbility` (`idx 0 / A1 / side p1`); `KeyK` → **1** (`idx 0 / A2 / p1`); `Digit1` → **1** (`idx 1 / A1 / p2`); `Digit2` → **1** (`idx 1 / A2 / p2`); 0 page error |

| D1 ✅ | “không xén đáy, tận dụng không gian ở **mọi** tỉ lệ” (band matrix) | Pick là **hai band độc lập**: roster theo `vh` (co giãn) còn LOCK là band **pixel cố định** (`bottom` vh + `height` px). Chỉ roster co ⇒ chân LOCK (bottom+height) lớn dần so với band roster khi viewport thấp: 1366×768 **13,5 px**, 1280×720 **15,8 px**, 1024×768 **13,5 px**, 932×430 **1,8 px** chồng lên hàng tên; 1920×1080 mới vừa khít (1,3 px) — đúng chỗ artist canh số | luật band: `tools/goldShellR52pickBand.mjs` (LAST writer của band, chạy sau R50K) — deck giữ **mép trên** tác giả (khoảng hở identity), `bottom = max(bottom tác giả, lockBottom + lockHeight + gap)`, thay vì kéo deck lên; số của luật **derive từ chính rule canonical** (`resolvePickBandLaw`) nên lệch donor là build đỏ | gate `test:pick-band-law` **66 checks** (gồm chứng minh canonical *đã* xén ở 1366/1280/1024/932 và luật đưa overlap về **0** ở 14 viewport 360×640→2560×1440); browser 6 band `overflow=[]`, CLEAR ≥ **9 px** |
| D2 ✅ | phone portrait: LOCK cắt ngang **hàng 2** của roster (ảnh matrix 430×932) | hai “sàn” từ stylesheet menu React đã nghỉ vẫn sống cùng tên class: (a) `button{min-height:44px}` nâng LOCK compact 30 px / portrait 42 px lên **44 px**, (b) `@media(max-width:680px) .roster{min-height:230px;max-height:52dvh}` — `.roster` trong `inset:0;height:auto` là box **content-sized** nên cao **230 px** trong band 147 px (roster 692..922 vs band 692..839) và `repeat(2,1fr)` vẫn nở theo content ⇒ LOCK (3,2vh + 42 px) nằm giữa hàng 2 | luật band ghim luôn hai sàn: `#stage .lockMechanismV6{min-height:var(--apexLockH)!important}` và (portrait) `#stage .selectionDeckV6 .roster{height:100%!important;min-height:0!important;max-height:none!important;grid-template-rows:repeat(2,minmax(0,1fr))!important;grid-auto-rows:0!important;overflow:hidden!important}` | browser portrait: roster **692..839 = đúng band**, card thật h62 (430×932) / h55 (390×844), name 9 px **không bị cắt**, CLEAR **34 px** / **28 px**; ảnh `matrix/pick-430x932-port-phone.png`, `pick-820x1180-port-tablet.png` |
| D3 ✅ | báo cáo cũ “1920×1080 bị đẩy 18 px sang phải / `#lockIn` bottom 1085 > 1080” | **báo động giả của phép đo**: `.flowScreen` vào màn bằng `translate3d(18px,0,0)` và `flowUp/flowIn` giữ `fill:both`; reconciler của bundler **chưa bao giờ commit** animation vào `document.timeline` trong headless shell (mọi `getAnimations()` trả `currentTime:0` dù đứng yên 4 s), tức lớp phủ đầu animation đứng nguyên **vô hạn** ở mọi band — không phải lỗi hình học của 1920 | đo lại ở trạng thái đã settle (`finish()`/chờ chữ ký rect ổn định) trong `matrix`/`picklaw`: 1920×1080 `deck 821..1017`, `lock 1019..1069` (đáy **1069 < 1080**), `#fighterSelectScreen right = 1920`; luật band cũng giữ đúng pixel cũ ở band này (chênh 1 px so với canonical) | `matrix/pick-1920x1080-desk-wide.png`; ghi chú: **mọi** số đo cũ lấy trong lúc animation treo đều phải bỏ |

## Gate / build status at this slice

* `pnpm test:r50-pre-transition` — **20/20 exit 0** (thêm `test:pick-band-law`
  **66**; Lifecycle **52**, LegacySurface **31**, TransitionCoordinator **56**,
  ProductAssetIntent **23**, MultiPointer **17**, Visibility 25, Economy 27,
  HudLive 20, FighterPick 14, HudAdaptation 19, TransitionRuntime 47,
  RoutePolicy 27, …).
* `pnpm build` — 324 assets / 31.223.567 B; prune 723 file / 196.278.112 B;
  `forbiddenRuntimeSurvivors: []`.
* Revision lock: 39 versioned runtime, `20261005-owner-playtest-r50k`.

## Still open (not claimed as done)

* **B5 verified in the browser after the fix** (`/tmp/browser/r54.out`): with
  Local 1v1 (CRYSTALA + HUNTER, both unowned) live, equipping through
  `APEX_ARSENAL.weaponApi.equip(fighter0,'SMG')` makes the p1 weapon read
  `root:"weapon"` (`.no-ammo` GONE), `name:"SMG"`, `type:"AUTO"` (config table),
  `cur:"8"`, `max:"/8"`, `.wp-ico.has-tier` with `--tier:#63E28B`; the same run
  re-proves B0 (`live:true`), 4 name slots, avatar `battle_avatar.webp`
  `naturalWidth:512`, both hops `["DONE"]` and 0 page errors.
* **C2/C3** phone press model (tap = cast + panel down, hold = keep + cast on
  release), overlapping/multi-touch acceptance.
* **D** size bands + the 6-aspect matrix with images — ĐÃ ĐÓNG phần Pick
  (`matrix/pick-*.png` 6 band sau luật band, `overflow=[]`, CLEAR ≥ 9 px;
  gate `test:pick-band-law` 66). Phần **Battle HUD** của band matrix đã đo ở
  cùng lượt: `--wpIW/--amF` 14cqh/28px → 13cqh/26px → 82px/22px → 68px/21px →
  48px/17px → 56px/18px, `overflow=[]` mọi band (ảnh `matrix/battle-*.png`).
* **F1** Lucky reel = black silhouette cut from the real stand-pick art.
* **F3** fewer forced steps — ĐÃ ĐÓNG phần tap-outside + chặng doorless + hàng
  đợi intent (xem F3a/F3b/F3c ở trên). Phần còn lại của “fewer forced steps”:
  **kết thúc trận → về Pick** đã là tự động (`RESULT_HOLD_MS = 2600`), và **chạm
  vùng trống trong battle để thoát ngay** cần kiểm tra vùng nhận chạm của HUD
  iframe (nếu iframe iframe phủ kín sân thì cú chạm không tới được shell — sẽ xử
  lý ở tầng HUD, vẫn dùng đúng MỘT đường `APEX_CHAOS_BATTLE_EXIT`).
* **G** audio trace (background/foreground) with reasons on every begin/end.
* **I** the owner's Gold transition file → integrate, then bump the runtime
  revision and re-lock.
* **H-rest (CSS)** — ĐÃ XONG ở `ae16d59`: `src/styles.css` 217.238 → **135.740 B**
  (xoá 457 rule chết, kể cả biến thể trong `@media`), 0 tham chiếu id đã nghỉ
  trong `src/` + `public/`; gate `test:legacy-surface-cutover` **31 checks**.
