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

## Trạng thái chain tại checkpoint này

```
pnpm test:r50-pre-transition → SUITE=0, 21 gate RESULT: PASS
pnpm build → 324 assets, prune 663 file / 194.157.235 B, forbiddenRuntimeSurvivors: []
UPDATE_LOCK=1 node tools/testRuntimeRevisionGate.mjs → lock 20261005-owner-playtest-r50k (39 runtimes)
```
