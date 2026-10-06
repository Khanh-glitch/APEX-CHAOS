# SLICE E — Evidence R52 (checkpoint A `a0483dd` / B `bd667a1` / C `0a5ad73` / D `#a066f0`)

Ngày: 2026-10-06. Baseline đo: `68fde28`. Mỗi checkpoint = 1 commit + 1 push (luật §7).

Bốn yêu cầu mới N1..N4 map 1-1 với bốn bug owner vừa báo. Tài liệu này là bằng chứng
của **N1 (rig hero) và N2 (caster identity)**; N3/N4 ở slice kế tiếp.

---

## E1 — N1: "Magnet không hiện gì trong battle / Frost load chậm hơn"

### Nguyên nhân gốc (đã xác minh bằng đọc source + build thật)

1. Runtime của Magnet **ghép URL lúc vẽ**:
   `/assets/magnet_v1/gold/${id}-${tag}-base.png` (`magnetGoldV1.js:58–77`). Bộ quét
   `tools/assetAudit.mjs` chỉ thấy chuỗi literal, nên cả **55 file** rig bị xếp
   `LEGACY_NON_SHIPPING` và `pruneShippingDist.mjs` **xoá sạch khỏi dist**. Vào battle,
   `loadAssets()` reject → `ready=false` → không vẽ fighter, không vẽ skill.
   Bộ `clean/` của Hunter mất 7 file cùng cơ chế (dist 18/25).
2. Frost hiện được, nhưng rig của nó (9 PNG / ~644 KB) **chỉ bắt đầu tải ở frame đầu
   của trận** (`frostGoldV1.js:1236`, `:2586`), nên đội hình hiện sau các hero khác.

### Cách sửa (từ gốc — một nguồn sự thật, không vá)

- `tools/buildGoldCutover.mjs`: thêm `HERO_BATTLE_RIG_DIRS` (newbot → `/assets/hero-rework/robot-final`,
  crystala → `crystala-curated`, frost → `frost-v1`, hunter → `hunter-v10`,
  magnet → `/assets/magnet_v1/gold`, mirror → `mirror-curated`) + `walkFiles()`, sinh ra
  trong authority `src/game/goldAssetManifest.js`:
  - `HERO_BATTLE_RIGS` (mảng URL đóng băng theo hero, đã sort),
  - `HERO_BATTLE_RIG_ASSETS` (bản dẹt),
  - và **mọi URL rig được ghi vào `GOLD_SHIPPING_ASSETS`** ⇒ audit xếp SHIPPING ⇒ prune
    không thể xoá file mà runtime shipping sẽ tải.
- `src/App.jsx`: publish 1 lần `window.APEX_HERO_RIGS` / `window.APEX_HERO_RIG_ASSETS`
  (effect riêng, có cleanup) — runtime cổ điển đọc được mà không copy danh sách.
- `public/game/product/productAssetRuntime.js`: thêm role `rig` (`rigUrls()`), và:
  - surface `fighter` → rig của hero đang focus,
  - surface `battle` / `transition` → rig của các combatant đã chọn,
  - **không bao giờ** quét toàn bộ 6 hero (giữ luật selected-only).

### Kiểm chứng

| Hạng mục | Trước | Sau |
| --- | --- | --- |
| `magnet_v1/gold/*.png` trong `dist` | 0/54 | **54/54** |
| `hero-rework/hunter-v10/**` trong `dist` | 18/25 | **25/25** |
| `hero-rework/frost-v1/*.png` trong `dist` | 9/9 | 9/9 (không đổi, nay được preload) |
| tổng file rig trong bảng preload | — | **82** |

File rig duy nhất không nằm trong dist là `public/assets/magnet_v1/gold/manifest.json` —
file JSON dữ liệu build, **không runtime browser nào đọc** (runtime chỉ đọc `${id}-${tag}-*.png`);
giữ ngoài dist là chủ ý, không phải thiếu sót.

- Gate mới `tools/testHeroBattleRigDeliveryGate.mjs` (**24 check**, đã vào chain
  `test:r50-pre-transition`): tự tính lại đúng tập file mà từng runtime sẽ yêu cầu (từ
  IDS/channels/layers của chính runtime đó), rồi chứng minh từng file: có trên đĩa → được
  khai báo shipping → có trong bảng preload → **sống sót trong `dist` đã prune**; cộng thêm
  luật "bảng == ý định thư mục" (không lệch, không entry chết) và "rig luôn selected-only".
- `tools/testProductAssetIntentGate.mjs` + `tools/testGoldTransitionCoordinatorGate.mjs`:
  cập nhật 2 assertion cũ (battle asset = `battleAvatar` + `skillIcons`) để luật mới là
  *art + rig của đúng combatant*, kèm assertion `rigUrls(null)` không tồn tại.

---

## E2 — N2: "Ở BOT + Local, J/K tác động cả hai bên"

Bug có hai nửa; nửa input đã xử lý ở slice trước (`normalizeCastInput`, side-aware
routing), nửa còn lại — **cùng hình dạng** — nằm ở tầng presentation và đã được sửa ở đây:

### Nguyên nhân gốc

- `heroMechanicsRuntime.js:84/:100/:127/:141` phát `RobotA1*` chỉ với `{ hero:'ROBOT', … }`
  — **không có danh tính body**.
- `robotPresentationRuntime.js` kiểm tra danh tính ở dạng *tuỳ chọn*:
  `if (payload.fighterId && f.id !== payload.fighterId) continue;` (8 chỗ) + 2 vòng lặp
  không guard (`:1149`, `:1164`). Trong trận **ROBOT vs ROBOT**, sự kiện không có
  `fighterId` ⇒ điều kiện sai ⇒ **cả hai robot cùng chạy motion** dù chỉ một bên cast.

### Cách sửa

- `heroReworkRuntime.js`: thêm **một** resolver body (`bodyOfCombatant(ct)` — luật doc-06:
  `fighters[ct.idx]`) và `castBoundApi(ct)`: cùng một api executor, nhưng mọi event nó phát
  ra được **đóng dấu** `fighterId/combatantId/side/heroId`. `mechCtx()` giờ truyền
  `api: castBoundApi(ct)` — không còn nơi nào đưa api dùng chung cho mechanic.
  `Cast` + 2 nhánh `CastFailCue` cũng mang `fighterId` của người cast.
- `robotPresentationRuntime.js`: thêm `eventBody(payload)` (ưu tiên `fighterId`, rồi
  `side`/`combatantId`) và **mọi** nhánh body-scoped đổi thành
  `if (f !== eventBody(payload)) continue;`. **Sự kiện không nêu danh tính bị bỏ** —
  thiếu danh tính không bao giờ có nghĩa "chạy cho mọi body cùng hero" nữa.
  Nhánh `CastFailCue` bỏ fallback "mọi robot" (chính là lỗi 2 bên).

### Kiểm chứng (chạy thật, `tools/testHeroReworkRobotPresentationGates.mjs`, trận ROBOT vs ROBOT)

```
PASS P-BOTH-match-is-robot-vs-robot            — {"heroes":["ROBOT","ROBOT"]}
PASS P-BOTH-identity-less-cue-touches-neither-body — {"before":{"a":0.1,"b":-9},"after":{"a":0.1,"b":-9}}
PASS P-BOTH-explicit-fighterId-hits-only-that-body — {"afterId":{"a":0.1,"b":0.45}}
PASS P-BOTH-side-identity-hits-only-that-body      — {"afterSide":{"a":4.5,"b":0.45}}
PASS P-BOTH-real-cast-fires-on-the-caster-body     — {"castRes":{"ok":true},"lockA":4.5}
PASS P-BOTH-real-cast-leaves-the-rival-body-untouched — {"rival":{"lastLockAt":0.45,"brackets":true,...}}
```

Baseline của chính gate này tại `68fde28`: **18/28 pass**. Sau thay đổi: **25/35 pass**,
**đúng cùng 10 failure cũ** (bus/SFX của fixture `robot_a1_dash`, passive milestone) —
tức thay đổi này không tạo failure mới; 10 failure kia là drift fixture↔product có từ
trước, gate không nằm trong chain (ghi lại để không quy sai về sau).

- `tools/testSideAwareAbilityRoutingGate.mjs` (đang trong chain) được mở rộng +10 check
  (tổng **33**): caster-bound api, `Cast`/`CastFailCue` mang `fighterId`, presentation
  resolve đúng một body, không còn guard tuỳ chọn, ≥8 nhánh body-scoped fail-closed.

---

---

## E3 — N3: trả lại transition gốc của donor (`#battleTransition`) cho cửa vào battle

### Luật cũ vs luật mới (đổi luật có ý thức, không revert ngầm)

- Luật R51: "`#battleTransition` phải BIẾN MẤT" — đúng khi Mechanical Door V4 sở hữu mọi
  chuyển cảnh. Nhưng khi đó cửa vào battle chỉ còn **shutter clip-path trần**: nhịp đã
  được owner thiết kế (2 rail + seam + core + câu chữ BOT/DUEL) không còn trong sản phẩm.
- Luật R52 (N3): `#battleTransition` **LÀ** transition cửa vào battle. Door vẫn là authority
  duy nhất cho **scene** (boot + 2 nhịp Lucky Draw) và **không** route battle.

### Cách sửa (từ gốc — generator sở hữu, không sửa tay output)

- `tools/goldShellR50k.mjs`: bỏ 3 bước xoá donor (CSS `#battleTransition`, DOM, node const);
  thêm vùng `BATTLE_ENTRY_REGION` là **một** scheduler sở hữu vòng đời vào battle:
  `setTransitionIdentity()` (accent/name/kicker/state, BOT `TARGET ACQUIRED` / `CPU // TARGET`
  / `SOLO COMBAT CHANNEL`, LOCAL `P2 // FIGHTER` / `DUEL COMBAT CHANNEL`, `is-bot` +
  `is-horizontal` theo tỉ lệ màn hình thật) → `phase-lock` → `phase-clamp` → mount → freeze →
  **production READY** → `phase-seam` → `phase-open` + `is-reveal` (430 ms) → `battle-hud-open`
  → `phase-handoff` → reset. Nhịp reduced-motion giữ đúng sàn 24 ms như donor.
- `tools/buildGoldCutover.mjs`: xoá 6 patch retiming SHL-S33..S38 của scheduler donor đã bị
  chính adapter thay thế (chúng không thể chạm tới shell ship ra — chỉ ghi lại một nhịp không
  còn tồn tại).
- Gate cũ mâu thuẫn được **viết lại trong cùng commit** (không xoá assertion):
  `testBattleTransitionAuthorityGate` 160 check (yêu cầu DOM + CSS + phase order + copy +
  reduced-motion + READY trước reveal), `testGoldTransitionCoordinatorGate`,
  `testLegacySurfaceCutoverGate` (Door vẫn độc quyền route scene).

### Kiểm chứng

- `node tools/buildGoldCutover.mjs --check` → `CHECK OK — 70 generated files match`.
- Bằng chứng browser (dist đã prune, :4173, probe `/tmp/browser/n3.mjs`): ngay sau LOCK IN,
  `#battleTransition` mang `is-bot is-active phase-lock` và innerText đúng identity:
  `P1 // FIGHTER ROBOT COMBAT LOCK / CPU // TARGET ROBOT TARGET ACQUIRED / ARENA // EAX-01
  SOLO COMBAT CHANNEL`.
- `pnpm test:r50-pre-transition` → SUITE=0, **21 gate** PASS; battle-transition gate **160/160**;
  `pnpm build` → 663 file / 194.157.235 B pruned, `forbiddenRuntimeSurvivors: []`.

### Ghi chú probe (không phải bug sản phẩm)

Trong sandbox, `fonts.googleapis.com` không tới được → `document.fonts.ready` treo → bước
"settle" của shell (có `await fonts.ready`) không commit, nên nếu probe click *trước khi nhịp
trước đó commit* thì màn hình đứng ở bước cũ. Đã kiểm chứng bằng A/B (build N3 vs build trước
N3: hành vi giống hệt nhau) và bằng cách đợi `#stage.screen-mode` rồi mới click: luồng đi tới
Fighter Pick 12 card trong ~2 s. Đây là **giới hạn môi trường probe**, không phải regression của
N3. Việc bọc `fonts.ready` bằng một trần thời gian (để mạng chậm không bao giờ làm đứng scene)
là một hạng mục riêng, sẽ làm ở nhánh "frozen" nếu cần.

---

## E4 — N4: "Crystal đang bị sai ngôn ngữ màu"

### Nguyên nhân gốc — ba lời khai, không lời nào là của Crystal

| Nơi khai | Giá trị cũ | Vai trò |
| --- | --- | --- |
| `public/apexEngine.js` (`FighterTypes` CRYSTAL) | `#6ed3d8` (teal) | màu thân thể trong arena → `accentOf(body)` → **màu slash Critical/Heavy** |
| `public/game/gold/goldProductBridge.js` `FALLBACK_ACCENTS.crystala` | `#55bfff` (sky) | accent bridge khi shell registry chưa load |
| `tools/buildGoldCutover.mjs` `GOLD_HERO_ACCENTS.CRYSTAL` | `#55bfff` | accent của roster fallback sinh ra trong shell + Lucky roster |

Cả ba đều **không nằm trong palette của Crystal**. Palette tự tác giả của cô
(`crystalaGoldV6.js`) là AMETHYST: `#7a3fc6`, `#a86ee6`, `#d3aef7` và bảng tên
`vio:'#a066f0'`, `hot:'#ff7ae8'`. Vì `accentOf(body) = body.color`, màu sai chảy thẳng vào
slash crit/heavy, thẻ pick, accent HUD và 2 tấm rail của transition.

### Cách sửa (một ngôn ngữ màu cho mỗi hero)

- `apexEngine.js`: CRYSTAL `#6ed3d8` → **`#a066f0`** (đúng `C.vio` trong palette của cô).
- `goldProductBridge.js` fallback `.crystala` → `#a066f0` (kèm comment nêu rõ nguồn).
- `buildGoldCutover.mjs` `GOLD_HERO_ACCENTS.CRYSTAL` → `#a066f0`.
- **SHL-S2b** (patch mới của generator): roster fallback **trong shell** (JSON của donor) được
  sinh lại accent từ `GOLD_HERO_ACCENTS` ⇒ shell không còn giữ giá trị cũ trong frame đầu tiên.
  Portrait/art vẫn lấy từ donor, không sửa gì khác.

### Kiểm chứng

- Gate mới `tools/testHeroAccentLanguageGate.mjs` (**27 check**, đã vào chain
  `test:r50-pre-transition`): mỗi hero **một** accent trên cả 4 nơi khai; không hai hero trùng
  accent; accent phải nằm trong **palette tự tác giả** của chính hero đó (≤40° hue — Crystal
  `#a066f0` hue 265°, cách palette 0°; Hunter 80°, cách 1°); Crystal phải là violet của cô;
  không còn `#6ed3d8`/`#55bfff` sống trong bất kỳ authority nào; và **slash crit/heavy dùng
  `impactAccent` của chính cú đánh** (`accentOf(ev.attacker)`, sweep `crit`/`heavy`).
- Bằng chứng browser trên dist đã prune (:4173, probe `/tmp/browser/accent.mjs`), 0 page error:

```
APEX_ARSENAL_SHELLS.typeFor('CRYSTAL').color   = #a066f0
FighterTypes CRYSTAL color                     = #a066f0
APEX_GOLD.luckyRoster().crystala.accent        = #a066f0
shell HEROES fallback crystala.accent          = #a066f0
```

---

## E5 — Critical/Heavy phải tác động CẢ panel (2 slot skill không được loại trừ)

### Nguyên nhân gốc (đo được, không phải suy đoán)

Panel nạn nhân bị "vỡ" bằng cách clone TOÀN BỘ `.side` rồi phủ lên chính nó
(`panelRupture` → `.rupture-whole` + 10 mảnh `.rupture-piece`). Nhưng lớp phủ đó được
blend bằng `mix-blend-mode:screen` — mà **2 slot skill là khối duy nhất tự vẽ nền gần-đen
(`#0d1013`)**, nên screen gần như vô hình ở đó: ident/weapon tối nên thấy rõ, 2 slot skill
"không ăn" cú đánh. Số đo độ sáng trung bình (trước → trong cú Heavy, probe `/tmp/browser/lum.mjs`):

| Layout | ident | skill A | skill B | weapon |
| --- | --- | --- | --- | --- |
| desk | 28.7 → 45.2 | 38.8 → **38.0** | 42.3 → **42.2** | 25.6 → 33.0 |
| port | 52.6 → 70.8 | 42.4 → **37.3** | 48.2 → 48.8 | 39.7 → 51.6 |
| land | 35.3 → 61.9 | 37.4 → 39.6 | 41.4 → 40.4 | 26.9 → 39.3 |

### Cách sửa

R50C adapter (`tools/goldBattleHudR50c.mjs`) — nơi sở hữu vùng FX này — thêm **một** luật:
cú đánh stamp màu accent của chính giao dịch lên panel nạn nhân trong đúng cửa sổ burst:

```css
#hud .side.is-panel-hit .skill{background:linear-gradient(90deg,color-mix(in srgb,var(--hitAcc,#ff8a1e) 20%,#161b20),#0d1013)}
#hud .side.is-panel-hit .skill::after{border-color:color-mix(in srgb,var(--hitAcc,#ff8a1e) 72%,transparent)}
#hud .side.is-panel-hit .sk-art{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--hitAcc,#ff8a1e) 46%,transparent)}
```
- `panelHitWindow(v,accent)` bật class + `--hitAcc`, tự tắt sau 1120 ms (reduced-motion 120 ms)
  và `disposeRupture` dọn sạch → không bao giờ kẹt accent trên tile.
- Rule viết kèm `#hud` (id) để **thắng mọi section layout** (`#hud[data-layout="port"] .skill`...)
  — đây chính là lý do bản đầu chỉ đúng ở desk/land mà không đúng ở portrait (đã đo, đã sửa).
- `fxHeavy` truyền `eventAccent` của chính cú đánh vào `panelRupture(v,token,impactAccent)`.

### Kiểm chứng (sau khi sửa, cùng probe)

| Layout | ident | skill A | skill B | weapon |
| --- | --- | --- | --- | --- |
| desk | 28.7 → 47.3 | 38.8 → **53.3** | 42.3 → **57.8** | 25.6 → 35.3 |
| port | 52.6 → 55.6 | 42.4 → **46.8** | 48.2 → **55.2** | 39.7 → 41.8 |
| land | 35.3 → 63.5 | 37.4 → **49.0** | 41.4 → **51.0** | 26.9 → 41.5 |

Cả 4 khối của panel (ident · 2 skill · weapon) đều nhận cú đánh ở cả 3 layout. Hit-test DOM
cũng xác nhận lớp mảnh vỡ phủ trọn rect của panel (`.rupture-piece` = 299×646 px so với panel
300×648 px ở 1280×720). Gate `testGoldBattleHudAdaptationGate` nay có thêm 8 check cho luật này
(tổng **27**).

## Trạng thái chain tại checkpoint này

```
pnpm test:r50-pre-transition → SUITE=0, 21 gate RESULT: PASS
pnpm build → 324 assets, prune 663 file / 194.157.235 B, forbiddenRuntimeSurvivors: []
UPDATE_LOCK=1 node tools/testRuntimeRevisionGate.mjs → lock 20261005-owner-playtest-r50k (39 runtimes)
```

---

## §E6 — R53: sửa GỐC vấn đề scene-transition (Lucky Draw hết đóng băng)

Báo cáo: *"Lucky Draw vẫn đóng băng"*, *"mode card không phản hồi"*. Đo trên bản shipping
(pruned `dist` + `vite preview` :4173, 1280×720, fonts intercept để loại yếu tố sandbox):

### Nguyên nhân gốc đã đo được (trước khi sửa)

1. **Input bị khoá suốt transaction, không phải suốt lúc cửa che.**
   `body.apex-scene-transition-active` bật `pointer-events:none` cho `#gold-shell-host` và
   `#battle-shell` từ lúc mở transaction tới lúc DONE. Chuỗi hit-test của `.modeCard`:
   `.modeCard → .modeChoices → #modeSelectScreen → #stage → #gold-shell-host` đều `pe=none`;
   `elementFromPoint` trả về `#root`. Vì vậy mode card / Fighter Pick / **iframe Lucky Draw**
   không nhận được click thật (click lập trình vẫn chạy ⇒ không phải handler chết).
2. **Watchdog bị "số nho" lừa.** Chữ ký tiến trình cũ là `state|stateTime|holdTime`; `holdTime`
   cứ tăng khi cửa SEALED mà **không vẽ gì**, nên guard tưởng cửa còn sống và chỉ còn trần cứng 30 s.
3. **Đo được cửa ngừng vẽ**: boot `boot->home` đứng ở `OPENING` sau **17.6 s** (`wallTime` đứng ở
   18.24 trong hơn 6 s) khi donor Lucky Draw load trên main thread ⇒ `onCover` không bao giờ tới ⇒
   destination không bao giờ commit.
4. **Contract READY chờ một document không thể render.** `settleSceneElement` await `fonts.ready`
   + 2 rAF của **document đích**; `#luckyDonorHost` là `display:none` tới lúc commit, nên donor
   (cùng origin) không bao giờ settle: rAF trong iframe ẩn trễ ~1.8 s/lần và prepare của
   `home->lucky` **chưa từng hoàn tất** (`prepared:false` ở mọi mẫu) ⇒ bay không mở.
5. **Scene intent bị nuốt khi cửa hỏng**: destination đã prepare xong nhưng chưa có `onCover`
   thì guard cũ `releaseCover()` rồi `finish(false)` — không commit ⇒ người chơi được trả về
   màn cũ, ý định scene mất.

### Luật mới (đi từ gốc, không vá)

| Luật | Nơi cài | Ý nghĩa |
| --- | --- | --- |
| L1 input thuộc về **lớp che**, không thuộc transaction | `src/styles.css` | khoá chỉ khi `data-apex-scene-transition="CLOSING"/"SEALED"`; `OPENING` là người chơi đã sở hữu scene |
| L2 cửa chỉ sở hữu **một cửa sổ reveal hữu hạn** | `sceneTransitionCoordinator.js` (`revealGraceMs`, mặc định 4000 ms, đo từ chính state `OPENING`) | trần 30 s không còn là cơ chế phục hồi đầu tiên |
| L3 guard đo **độ sống** của cửa (`debug.wallTime`), không đo số nho | cùng file | cửa chết bị phát hiện kể cả khi đang SEALED |
| L4 **không cắt** destination đang prepare | cùng file (`doorDead = stalledFor >= STALL_MS && (tx.prepared || age >= HARD_CAP_MS)`) | cửa chết + prepare đang chạy ⇒ chờ; trần cứng vẫn giữ |
| L5 destination đã prepare **không bị mất** khi cửa hỏng | cùng file (`forceCommit()`, `tx.coverFailed`, `tx.forced`) | `releaseCover()` bây giờ đi kèm commit thật, không rollback |
| L6 READY **không phụ thuộc frame của document chưa render** | cùng file (`documentIsRendered`, `paintView`) | media đã request vẫn verify; paint-verify chuyển sang **document cha đang sống**; không await fonts của document ẩn |

### Kiểm chứng (sau khi sửa)

Gate mới `tools/testSceneInputLockLawGate.mjs` **40 checks PASS** (gồm 3 test hành vi: cửa sống-nhưng-chậm
phải fail-open; cửa chết không được cắt destination đang prepare; document ẩn không được chặn READY).
`test:r50-pre-transition` → **SUITE=0**, **23** `RESULT: PASS`; `pnpm build` BUILD=0; `--check` OK 70 files.

| Kịch bản (dist thật, 1280×720) | Trước | Sau |
| --- | --- | --- |
| Boot: input trả lại | `pe:none` suốt transaction, vẫn `OPENING` sau 17.6 s | **2.02 s**, lúc phase `OPENING` (`active:true`) |
| Boot: transaction kết thúc | chỉ nhờ trần cứng 30 s | **4.72 s** (`phase DONE`) |
| Lucky Draw mở (`#luckyDonorHost.is-open`) | **không bao giờ mở** (prepare treo, guard cắt ở 6–10 s) | **7.67 s**, `display:block`, `pointer-events:auto` |
| Click thật trong iframe Lucky Draw (`#backBtn`) | không thể (iframe bị khoá input) | **đóng ở 12.11 s** — click trong bay có tác dụng |
| home → free battle | không phản hồi trong 45 s | **3.27 s**, `active:false` (không Door, đúng luật R51) |
| free battle → Fighter Pick (LOCAL) | không phản hồi | **9.54 s**, `active:false` (không Door) |

### §E6b — Bàn phím LOCAL (đo trước, để không sửa nhầm chỗ)

Báo cáo "J/K kích cả hai bên" và "Local 1/2 không kích". Đo trên AIL bus (harness jsdom, gate
`testHeroReworkRobotPresentationGates.mjs` mục `L-*`, 11 checks PASS):

- LOCAL: `KeyJ` → **chỉ p1** (`AbilityPress/p1/A1`, `P1Press`, `source:'keyboard'`); `KeyK` → **chỉ p1** (`A2`, cast ok).
- LOCAL: `Digit1` → **chỉ p2** (`AbilityPress/p2/A1`, `P2Press`, `input.key:'Digit1'`); `Digit2` → **chỉ p2** (`A2`).
- **Một lần bấm không bao giờ fan ra hai bên** (đo: `[p1,p1,p2,p2]`).
- BOT: `Digit1`/`Digit2` **không phát event nào** (CPU giữ P2) — đúng thiết kế.
- Nút thắt còn lại của "1/2 không kích" nằm ở **điều kiện kit của body P2** (`canCast` trả `reason:'condition'`,
  ví dụ HUNTER chưa có vũ khí/đạn), không nằm ở routing bàn phím — đây là việc của mục kế tiếp.

---

## §E7 — R54: đo trực tiếp các báo cáo mới (đang làm)

### Đã sửa & đo được: asset load tuần tự là gốc của "Magnet/Frost load chậm"

`public/game/product/productAssetRuntime.js` nạp từng asset **một** (`for (const url of urls) await …`).
Một rig Magnet = **54 file** ⇒ 54 vòng round-trip nối tiếp. Đo trên dist thật (BOT, 1280×720,
cùng cache, cùng máy):

| Trận | Trước | Sau (pool 8) |
| --- | --- | --- |
| MAGNET vs ROBOT vào trận | **68.0 s** | **31.8 s** |
| ROBOT vs ROBOT vào trận | 31.4 s | 28.4 s |

Sửa: một pool có trần (`PREPARE_CONCURRENCY = 8`), giữ nguyên contract abort/in-flight dedupe/
thứ tự kết quả. Đo tiếp: `step.mjs` cho thấy **toàn bộ** 25.4 s của `prepareSurface('battle')`
nằm trong `assets.prepare`; decode p50 ≈ 3.1 s trong sandbox 1 vCPU này.

### Bằng chứng ảnh: body MAGNET có vẽ, nhưng nhỏ bất thường

`docs/acceptance/owner-playtest/fx/…` (probe screenshot): MAGNET vs ROBOT — ROBOT hiện đúng
frame 96 px, MAGNET chỉ còn **một crest ~34 px** giữa đấu trường (không phải "mất hoàn toàn").
Đo được: `bodyScale = 0.130 = SOURCE_SCALE(0.1667) × bodyK(0.781)`; donor Gold
(`docs/hero-rework/magnet-v1/gold/MAGNET_FINAL_DONOR_MAX.html`) vẽ body bằng **chỉ `S_W`**
(`const S_W=170/1020; // hero ≈170u tall`). Việc nhân thêm `bodyK` là chủ ý của production
(HX=96 là nửa-extent trong world units) nhưng làm hero nhỏ hơn donor ~22% — cần đối chiếu
trực tiếp với bản Gold trước khi đổi, vì `testMagnetV1PresentationSemantics.mjs` đang mã hoá
đúng công thức này (đổi là phải sửa gate trong cùng commit).

### Bàn phím K/J cả hai bên: KHÔNG tái hiện được ở BOT

Đo BOT ROBOT vs ROBOT (pose `armor`, `lockFlash` của cả hai body, mỗi 120 ms):
`KeyJ` → chỉ P1 đổi trạng thái; P2 giữ `armor:false` suốt; `KeyK` không kích hoạt A2 cho bên nào
(điều kiện/cooldown). Bản LOCAL (harness jsdom, `L-*`) cũng cho một lần bấm = một bên.
⇒ Cần tái hiện đúng ngữ cảnh owner (LOCAL + cooldown của riêng P2) trước khi sửa, tránh sửa mù.

### Chưa bắt đầu (đã ghi nhận, theo thứ tự sẽ làm)

nút skill P2 cho LOCAL; khoảng trống panel trên điện thoại; nhạc nền load cùng transition;
transition 2 màn hình khép màu riêng từng bên (nếu không tìm được thì dùng transition chung);
Frost ở pick (mirror ngang + tụt xuống + 1.5×); độ mượt crit/heavy; giảm thao tác sau trận;
visual nút Lucky Draw (sáng nhẹ, giữ chữ); timing sfx trong trận; phạm vi rung/flash toàn màn hình.

## §E8 — R56: cửa đóng trước, luồng sau trận gọn, SFX không trễ, đo hiệu năng

### 1. pick→battle: cửa ĐÓNG trước, tài nguyên tải NẤP SAU mí cửa (mục 3)
Trước đây `launchBattleHud` chạy `phase-lock` → `prepareSurface` (tải 25–38 s) → mới clamp/seam:
ray cửa đứng yên ở pose `lock` suốt thời gian tải — đúng cảm giác "màn pick đứng im, không có gì xảy ra".
R56 đảo lại (`tools/goldShellR50k.mjs`): `lock` → 180 ms → `clamp` → 240 ms → **`seam`** → tải/mount/config/settle
→ live → `open` → 430 ms → `handoff`. Đo bằng `tools/probe/entrySeq.mjs magnet`:
`[[60,phase-lock],[252,phase-clamp],[488,phase-seam],[38846,phase-open],[39299,phase-handoff],[39299,HUD-OPEN]]`
⇒ cửa khép trong 0.49 s, mí cửa giữ trong lúc tài nguyên tải (không còn pose tĩnh).

### 2. Luồng sau trận: thoát/vào lại chỉ còn MỘT thao tác (mục 7)
Đo `tools/probe/flow.mjs magnet`:
- Esc giữa trận → về pick: **92 ms** (HUD là mount cùng-document trong `#battleHudHost`, không phải iframe).
- Màn pick trở về ở trạng thái READY: cờ `match-ready` đã xoá, nút `LOCK IN›` bật
  (trước: phải BACK → chọn lại → LOCK IN mới vào lại được).
- Vào lại trận đúng **1 cú bấm**: 3.6 s khi dist ấm (lượt đầu nguội 36.5 s).
- K.O. thật: bridge tự đưa về pick sau **3.9 s**, không cần chạm (RESULT_HOLD_MS 2600 + teardown).

### 3. SFX hero hết trễ ở lần kích hoạt đầu tiên (mục 10)
Gốc: `elementFor()` tạo `new Audio(url)` ngay lúc phát ⇒ cue nào phát trước thì tự trả giá tải + decode giữa trận.
Sửa: `apexHeroSfx.warm([...])` (dùng lại đúng cache/element, KHÔNG phát gì) + bridge gọi
`warmMatchHeroAudio(p1,p2)` ngay khi trận live, trước input đầu tiên; nhánh ROBOT dùng `loadRobotAudio()`.
Đo: `apexHeroSfx.state().cached` sau khi vào trận = **3/3 cue của magnet** (trước khi sửa: **0**).

### 4. Crit/heavy: nút cổ chai KHÔNG phải JS của game (mục 4)
- `tools/probe/perf.mjs` (burst `APEX_GOLD_HUD.hit/hitStorm` mỗi 260 ms): IDLE p50 450 ms vs FX p50 564 ms;
  heavy 14 / crit 7, không lỗi.
- `tools/probe/profile.mjs` (bọc `window.update`, `window.draw`, `Fighter.draw`): 2.5 s tích luỹ
  `{update: 3 ms, heroDraw:ROBOT: 6 ms, draw: 9 ms}` trong khi trang chỉ vẽ ~5 frame/1.5 s.
- ⇒ Trong sandbox này giới hạn là compositor/raster (swiftshader), không phải JS vẽ game. Không sửa code vẽ
  dựa trên số này và **không giảm chất lượng visual**.

### 5. Trả luôn nợ gate: runtime revision lock
`test:runtime-revision` đã đỏ sẵn ở tip trước (3 runtime đổi mà chưa relock: `productAssetRuntime`,
`arsenalMetaRuntime`, `heroReworkRuntime`). Đã relock (`UPDATE_LOCK=1`, 39 runtime) và commit lock trong checkpoint này.

### Còn lại của đợt này
Xác nhận bằng mắt mục 1 (plate súng điện thoại), 2 (bỏ lớp nền đen), 6 (bỏ chấm vàng), 8 (panel BOT = LOCAL),
9 (trạng thái icon skill); đo lại hiệu năng trên máy thật; nhạc nền preload cùng transition; Frost ở pick;
tỉ lệ Magnet; audit toàn game (mục 12) + tối ưu khu A1/A2/PASSIVE ở pick.

## §E9 — R56 tiếp: luật bàn phím P2 (numpad) + BOT cho người chơi pick

### 1. LOCAL 1v1: phím 1/2 của P2 = CỤM NUMPAD BÊN PHẢI (sửa đúng chiều owner báo)
Gốc: handler LOCAL P2 map `{Digit1,Digit2,Numpad1,Numpad2}` — vì `e.key` của cả hai cụm đều là '1'/'2'
nên **hàng số trên** cũng kích P2, còn cụm bên phải thì owner tưởng là không chạy. Sửa tại MỘT chỗ
(`public/game/hero-rework/heroReworkRuntime.js`, `LOCAL_P2_ABILITY_KEYS`): chỉ còn `{Numpad1:'A1',Numpad2:'A2'}`.
Map theo `e.code` (vị trí vật lý) nên vẫn hoạt động khi tắt NumLock.
- Gate mới: "L-top-row Digit1/Digit2 never casts", "L-numpad keys cast while the same characters on the top row do not"
  (tools/testHeroReworkRobotPresentationGates.mjs); cross-law cập nhật tương ứng.
- Đo sống (`tools/probe/botpick.mjs`): `LOCAL_KEYS {"topRow":[],"numpad":[A1 key=Numpad1, A2 key=Numpad2]}`.
- HUD: nhãn desk đổi thành `LOCAL · NUM 1 2` (không còn nói "1 2" chung chung).

### 2. BOT: người chơi được PICK bên BOT (thay vì auto ROBOT)
Từ gốc: CPU opponent là một giá trị production (`arsenalShellSelectRuntime`). Nó trở thành
**giá trị chọn được, có kiểm duyệt** (`setBotOpponentId`, mặc định vẫn `ROBOT`), bridge mở đường ghi
(`APEX_GOLD.setBotOpponent(shellKey)`), và shell BOT thành **pick 2 slot như Local**:
P1 → LOCK IN → chọn fighter cho BOT (`LOCK BOT`) → vào trận.
- Panel BOT render đúng hero đã chọn (art, tên, PASSIVE/A1/A2) — bỏ placeholder "OPPONENT AUTO-ASSIGNED";
  danh tính CPU giữ bằng flag BOT + viền cam + reticle + sweeper (bỏ làm mờ/ẩn hàng skill).
- Đo sống (`tools/probe/botpick.mjs`): mặc định `ROBOT` → sau khi chọn crystala cho BOT:
  fighters = `["MAGNET","CRYSTAL"]`, HUD P2 = `CRYSTALA`, card `.p2-selected = crystala`.
- Không hồi quy (`tools/probe/botdefault.mjs`): không chọn gì → `["HUNTER","ROBOT"]`;
  sau trận về pick ở trạng thái READY, CPU giữ nguyên, vào lại **1 cú bấm** = 3.07 s.
- Nút BACK/ESC ở màn ready của BOT mở khoá cả hai slot (huỷ lock rõ ràng); nút LOCK IN sau trận vẫn vào ngay.

### 3. Chain gate xanh sau thay đổi
`pnpm build` BUILD=0; `test:r50-pre-transition` SUITE=0 / 23 PASS; cutover `--check` 70 files OK;
lifecycle 52 PASS; pick-presentation 11 PASS; pick-band 66 PASS; side-aware 33 PASS;
hero-rework gates 40/50 (10 gate `P-*` đỏ **có sẵn từ trước**, xác nhận bằng cách stash thay đổi rồi chạy lại:
danh sách lỗi y hệt); `test:hero-rework:headless` 2 golden đỏ **có sẵn** (crystal-reflect-ice-payload,
rubber-stores-reflected) — không liên quan thay đổi này.
`tools/testGoldCrossLawHeadless.mjs` timeout ở màn mode: **có sẵn**, không nằm trong chain pnpm.

### §E9.4 — Robot: hết "bỏ sót vô lý" khi trúng liên tiếp + gate sức mạnh hero về xanh 50/50
- **Lỗi thật (đã sửa ở runtime):** `robotPresentationRuntime` chặn tiếng "armor hit" theo cửa sổ 0.05 s.
  Bước thời gian 0.05 s rơi vào 0.0499999 nên **hit thứ 3 bị nuốt** (đo: 3 hit tự động → 2 tiếng).
  Cửa sổ đó giờ chỉ chặn **trùng cùng một thời điểm** (<1 ms) — đúng luật owner "không bỏ sót vô lý",
  không súng nào bắn 2 phát trong 1 ms nên không có tiếng thừa.
- Gate `P-A1-lock-dash-single-dispatch-bus` / `P-A1-dash-1-sfx` trước đây chỉ step 0.1 s trong khi nhịp
  authored của A1 là 0.26 s (recognize .13 → commit .13 → dash) ⇒ gate đo sai nhịp, không phải sản phẩm sai.
- Gate passive cũ bơm `milestoneThresholds` (khoá đã bị luật mới 2026-09-29 bỏ) ⇒ nay bơm đúng
  `firstThreshold/thresholdStep`; ca "null" diễn đạt bằng ngưỡng không thể chạm (`Infinity`).
- Kết quả: `[ROBOT PRESENTATION GATES] 50/50` (trước 40/50) và **đã được thêm vào chain chính**
  `test:r50-pre-transition` (`pnpm test:hero-rework:robot-gates`) để không mục lại âm thầm.
- Chain xanh sau tất cả: `pnpm build` BUILD=0, `test:r50-pre-transition` SUITE=0 / 23 PASS + 50/50 robot gates.

## §E9 — R57 (2026-10-07): hai yêu cầu mới của owner + hiển thị A1/A2/PASSIVE ở pick

### 1. LOCAL 1v1: nút P2 là CẶP NUMPAD BÊN PHẢI (đo trực tiếp)
Luật engine đã đúng (`heroReworkRuntime`: map theo `e.code` = `{Numpad1:'A1',Numpad2:'A2'}`, hàng số trên KHÔNG map).
Bằng chứng sống tại HEAD (`tools/probe/keys.mjs`, phím bấm CDP thật, đọc telemetry của chính combatant):
```
Digit1  dCasts=0 dFails=0   (hàng trên: trơ)
Digit2  dCasts=0 dFails=0   (hàng trên: trơ)
Numpad1 dCasts=1            -> P2 A1
Numpad2 dCasts=1            -> P2 A2
```
⇒ `topRowInert=true`, `numpadRouted=true`, `__localP2KeysInstalled=true`, mode=LOCAL.

### 2. BOT: người chơi chọn fighter cho CPU (đo trực tiếp)
`tools/probe/botpick.mjs hunter`: chọn P1 = ROBOT → LOCK IN chuyển slot sang BOT → bấm HUNTER → vào trận:
`IN_BATTLE {p1:"ROBOT", p2:"HUNTER", p2NameShown:"HUNTER", p2Portrait:battle_avatar.webp, mode:"BOT", botId:"HUNTER"}`
⇒ đối thủ spawn ĐÚNG fighter người chơi chọn (một authority sản xuất, không bản sao).
Âm tính: `BOT_KEY_CALLS []` — trong BOT, phím người không bao giờ cast P2 (CPU thật).

### 3. Sửa GỐC nhãn phím: badge giờ GỌI TÊN đúng cặp khoá
Trước: badge ghi `1` / `2` (đọc như hàng số) và bị cắt thành `UM 2` ở ô P2 (margin của `direction:rtl`
hẹp hơn chính chữ; `letter-spacing` kế thừa làm chữ rộng ra, `clip-path` của keycap cắt mất glyph đầu).
Sửa: `keyLabelsForSide` trả `NUM1`/`NUM2` cho LOCAL P2 (khớp dòng điều khiển `LOCAL · NUM 1 2`),
và patch `HUD-H28b`: `.sk-key` là KEY CAP — `letter-spacing:.02em;white-space:nowrap;width:max-content`,
không bao giờ để box hẹp hơn chữ của nó. Đo lại (`keys.mjs`):
```
desk  p2 [NUM1 w=49 need=49, NUM2 w=47 need=47]  BADGE_CLIPPED []
port  p2 [NUM1 w=44 need=44, NUM2 w=44 need=44]  BADGE_CLIPPED []
land  p2 [NUM1 w=44 need=44, NUM2 w=46 need=44]  BADGE_CLIPPED []
```
Gate mới: `test:gold-battle-hud-adaptation` (29) + `test:side-aware-input` (35) khoá cả hai luật.

### 4. A1/A2/PASSIVE ở pick — một ngôn ngữ cho MỌI bên (chủ động, mục 12)
Trước: chip hiển thị 5–8px (đo 7.9px @1280, 6px @390) và LỆCH NHAU: P1 hiện `J`+tên kỹ năng (mất nhãn A1/A2),
P2 hiện `A1`/`A2` không có phím (dù P2 là người chơi trong Local), badge PASSIVE là label inline 8px bị ép dòng.
Sau (luật R57, ghim trong `test:pick-presentation` 15 check):
- Mọi chip = **VAI TRÒ (PASSIVE / A1 / A2) + TÊN kỹ năng**, kèm **keycap chỉ khi bên đó do người chơi điều khiển**:
  P1 `J/K`, Local P2 `NUM1/NUM2`, bên CPU không quảng cáo phím nào.
  VD desk: `[J][A1] MAGNETIC ATTRACTION`, `[K][A2] MAGNETIC REPEL`, `[PASSIVE] TRAJECTORY CONTROL`.
- Typography một luật: `clamp(10px,.78vw,12.5px)` desk, portrait `clamp(9.5px,2.6vw,11.5px)`, land `9.5px`;
  role mark viền màu accent như HUD trận; PASSIVE dùng màu orange của shell.
- Đo lại 4 tỉ lệ: 1280×720 10px, 390×844 10.14px, 844×390 9.5px, 360×780 9.5px — **không overflow**, không cắt chữ.
- Ảnh: `fx/r57-pick-chips-desk.png`, `fx/r57-pick-chips-port.png`.

### Kiểm chứng sau cùng (checkpoint này)
`pnpm test:r50-pre-transition` SUITE=0 / 23 suite PASS; `pnpm build` BUILD=0; cutover `--check` 70 file OK;
`test:runtime-revision` đã relock (39 runtime); `test:pick-presentation` 15, `test:gold-battle-hud-adaptation` 29,
`test:side-aware-input` 35, `test:gold-fighter-pick-adaptation` 14, `test:pick-band-law` 66, `test:gold-revision-integrity` 16.

## §E10 — R57 (2026-10-07): audit phần còn lại, đo bằng số

### 1. Cụm "súng / máu / dmg" trên điện thoại (mục 1) — sau khi badge phím rộng ra
Đo lại bằng `tools/probe/cells.mjs` (tìm ô trống lớn nhất theo DIỆN TÍCH NỘI DUNG, không phải theo cảm giác):
```
390×844 BOT   p1 3% (96×36)   p2 3% (180×9)
390×844 LOCAL p1 1%            p2 1%
```
⇒ không còn "ô trống lớn": vùng trống nhất chỉ còn 1–3% của panel và đều là khe giữa hai dòng.
Badge `NUM1/NUM2` rộng hơn badge cũ nhưng KHÔNG làm tràn ô ở cả 4 tỉ lệ (xem §E9.3: `BADGE_CLIPPED []`).

### 2. BOT có dùng skill không (mục còn tồn) — CÓ
`BOT` P1=ROBOT (người) vs P2=HUNTER (CPU), đọc telemetry của chính combatant CPU:
```
T+10s casts=1 by={A2:1}
T+20s casts=2 by={A2:1,A1:1}
T+30s casts=4 by={A2:1,A1:3}   fails=3 (điều kiện/cc hợp lệ)
```
⇒ CPU dùng CẢ A1 và A2 liên tục; `aiEnabled=true`. Không còn "BOT không dùng skill".

### 3. Tỉ lệ thân MAGNET trong trận (mục còn tồn) — ĐO ĐƯỢC, KHÔNG SỬA MÙ
Đo trong không gian thế giới (cùng đơn vị với hit-circle):
- Hit-circle thật: `radius=75` cho CẢ ROBOT và MAGNET ⇒ đường kính 150.
- Thân vẽ ra: `META` core 786×1125 canvas px × `SOURCE_SCALE(170/1020=0.1667)` × `bodyK(75/96=0.781)`
  ⇒ **≈102 × 146 world px**, tức chiều cao ≈ **97%** đường kính hit-circle (102/150 = 68% chiều ngang, đúng dáng người cao hơn rộng).
⇒ Kết luận: thân MAGNET đang khớp hit-circle trong sai số hợp lý; KHÔNG hạ/nâng scale mù (luật: không giảm chất lượng visual).
Nếu owner vẫn thấy nhỏ trên máy thật, cần ảnh chụp có vật mốc (ROBOT cùng khung) để so trực tiếp.

### 4. Trạng thái 12 yêu cầu
| # | Yêu cầu | Trạng thái |
|---|---|---|
| 1 | Cụm súng/máu/dmg điện thoại hết ô trống, súng to | Đạt — đo 1–3% (§E10.1), bệ súng 207×53 + đạn lớn (R55) |
| 2 | Bỏ lớp nền đen centre-out | Đạt — `d8e256a`, full-bleed compositor |
| 3 | Trả lại transition 2 vệt cho pick→battle | Đạt — `fdc0b89`/`37b3703`, cửa ĐÓNG trước khi tải |
| 4 | Audit hiệu năng, không giảm visual | Đo: FX không phải nút cổ chai (JS 3–9 ms/2.5 s); sandbox raster-bound; cần so trên máy thật |
| 5 | Home hiện AC thật | Đạt — `data-apex-ac` đọc trực tiếp từ economy authority |
| 6 | Bỏ chấm vàng nút dưới | Đạt — SHL-S19a/b |
| 7 | Giảm thao tác tuần tự | Đạt — Esc 92 ms, về pick READY, rematch 1 cú bấm, K.O. tự về 3.9 s |
| 8 | Panel BOT = panel Local | Đạt — một luật panel (`0108796` + `dd125ad`) |
| 9 | Hiệu ứng trạng thái skill | Đạt — tối khi hồi, sáng khi active (đã đo filter) |
| 10 | SFX không trễ | Đạt — warm trước cue đầu (cached 3/3), hấp thụ liên tiếp vẫn kêu |
| 11 | LOCAL nhận Num1/Num2 | Đạt — đo trực tiếp `Numpad1/2 → dCasts=1`, hàng trên trơ (§E9.1) + badge nói đúng cặp khoá |
| 12 | Audit toàn game + chủ động | Đang làm — pick A1/A2/PASSIVE đã sửa (§E9.4); BOT dùng skill xác nhận (§E10.2) |
