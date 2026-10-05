# SLICE D — evidence R52 (owner-playtest → product)

Revision `20261005-owner-playtest-r50k` (runtime `?v=`), owner-playtest data
revision `20261005-owner-playtest-r52`. Branch `arena/01a10c3e-apex-chaos`.

## What was fixed at the root in this slice

| # | Owner symptom | Root cause found | Fix (one authority) | Proof |
|---|---|---|---|---|
| P5 | “12.000 AC / full unlock” không còn đúng trên profile đã chơi | seed marker theo revision nhưng revision không đổi từ `…-r44` | `OWNER_PLAYTEST_REVISION='20261005-owner-playtest-r52'` sở hữu CẢ hai override (chọn Core Six + seed AC); gate đọc revision từ runtime, không hardcode | `test:owner-playtest-economy` PASS 27 (gồm profile r44 11.650 → 12.000 một lần, spin 350 → 11.650, refresh không refill) |
| P7 | runtime cũ (menu/pick/loading) còn sót | 6 write vào `#menu-screen`/`#select-screen` đã bị xoá khỏi DOM + cả cụm pick/preview chết + `menuMusicAllowed` không tồn tại (PAGEERROR) + `allowedByDom()` đọc id đã xoá | xoá hẳn: helper + 6 write + cụm `drawRosterPreview…selectFighter`, `goToSelect` → `APEX_GOLD_SHELL_NAVIGATE('fighter')`; music fallback đọc class `screen-*` của `#stage` (sống); App chỉ còn MỘT vòng đời nhạc | `test:legacy-surface-cutover` 22→29, `test:gold-battle-lifecycle` 49 (nhánh goldHosted teardown-only), `test:r50-pre-transition` 19/19 |
| B0 | Local 1v1 không vào được trận (READY) | một thẩm quyền selection/READY (đã sửa ở `74fe3da`) | — | browser (local dist :4173): CRYSTALA + HUNTER (**không sở hữu**) → `live:true`, HUD `is-open`, `battleMode LOCAL`, 0 page error |
| B5 | “đếm đạn x/y như Gold” | `weaponProjection` đọc `holder.def.shots`, nhưng `def` là **behaviour def** (`{id,category,spriteKey,onEquip,canActivate,activate,update}`) — không có `shots`; số nằm ở `APEX_ARSENAL_CONFIG.WEAPONS[id]` | projection lấy `shots/family/name` từ bảng config (một thẩm quyền số liệu) | browser: `window.fighters[0].data.arsenal.defKeys=['id','category','spriteKey','onEquip','canActivate','activate','update']` + `APEX_ARSENAL_CONFIG.WEAPONS.SMG.shots=8`; gate `test:battle-hud-live` thêm 2 luật (20 checks) |
| B1/B2/B6/B8 | avatar thật, 4 slot tên, tier glow, hai giao diện BOT/Local | — (đã có từ `74fe3da`) | — | browser: avatar `battle_avatar.webp` `naturalWidth=512` cả 2 side; 4 slot = CRYSTALA/HUNTER/CRYSTALA/HUNTER; `.wp-ico.has-tier` + `--tier:#63E28B` sau khi equip SMG; BOT `1p` + P2 `pointer-events:none` + key `CPU`, LOCAL `2p` + key `J/K` + `1/2` |
| route | 3 chặng phải doorless | — (đã có từ `74fe3da`) | — | browser: `pickToBattle: ["DONE"]`, `battleToPick: ["DONE"]`; Lucky vẫn qua Door (Escape đóng 151 ms sau khi mở) |

## Gate / build status at this slice

* `pnpm test:r50-pre-transition` — **19/19 exit 0** (Visibility 25, Lifecycle 49,
  Economy 27, LegacySurface 29, HudLive 20, FighterPick 14, HudAdaptation 19,
  TransitionRuntime 47, RoutePolicy 27, …).
* `pnpm build` — 324 assets / 31.223.567 B; prune 723 file / 196.278.112 B;
  `forbiddenRuntimeSurvivors: []`.
* Revision lock: 39 versioned runtime, `20261005-owner-playtest-r50k`.

## Still open (not claimed as done)

* **B5 re-probe**: the ammo counter must be read again in a browser after
  equipping a magazine weapon (`APEX_ARSENAL.weaponApi.equip(f,'SMG')`): expect
  `.wp-mag` bar + `x/8` and `.no-ammo` off. The probe that proved the root cause
  is flaky in its roster step (fix: wait for `.rosterCard[data-hero=…]` and fail
  loudly instead of continuing) — it is not evidence of a product defect.
* **C2/C3** phone press model (tap = cast + panel down, hold = keep + cast on
  release), overlapping/multi-touch acceptance.
* **D** size bands + the 6-aspect matrix with images.
* **F1** Lucky reel = black silhouette cut from the real stand-pick art.
* **F3** fewer forced steps (match end → straight back to pick, tap-outside exits
  free battle).
* **G** audio trace (background/foreground) with reasons on every begin/end.
* **I** the owner's Gold transition file → integrate, then bump the runtime
  revision and re-lock.
* **H-rest (CSS)**: ~405 dead `#select-screen`/`#menu-screen` rule blocks remain
  in `src/styles.css` (live-id references are gone; the CSS is the last
  deletion target).
