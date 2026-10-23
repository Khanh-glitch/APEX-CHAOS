# APEX CHAOS — itch.io Alpha storefront draft (NOT PUBLISHED)

**Artifact source:** `63cc83544f8ec92e2437e9944f41f14a4561a88b`  
**Release branch (packaging workflow only):** `release/itch-alpha-package-qa-20261024`  
**Status:** Draft copy only. Do not make page public without owner authorization.

## Suggested itch.io project fields

- **Title:** APEX CHAOS — Alpha
- **Short tagline:** Tactical arena battles. Reactive skills. Wild weapon pickups.
- **Project type:** HTML Game (playable in browser)
- **Genre:** Action
- **Suggested tags:** Arena, Action, Fighting, Singleplayer, Local Multiplayer, Browser
- **Pricing:** Free / optional donations (owner decision)
- **Visibility:** Draft / restricted until owner confirms itch-hosted ZIP QA
- **Embed:** Click to launch in fullscreen; enable Mobile Friendly and Click to Play; let viewport resize dynamically. itch.io mobile launches HTML games fullscreen.
- **Do not enable external account or online-multiplayer claims:** This Alpha is Guest-first, BOT plus same-device LOCAL combat, with no cloud sync.

## Main description (English)

### Enter the chaos.

**APEX CHAOS** is a fast, top-down arena action game built around unpredictable weapon pickups, distinct fighter abilities, and compact, tactical duels.

Jump straight into **Free Battle**, challenge a BOT, or face another player in **LOCAL** mode on the same device. Time your abilities, adapt to the weapons that drop in the arena, and make every match count.

**What is in this Alpha**
- Instant play as a Guest — no sign-in required.
- Free Battle versus BOT and same-device LOCAL matches.
- Fighter selection, distinctive skill artwork, cooldown and targeting feedback.
- Pick up arena weapons and react to changing match conditions.
- Earn **200 AC** for a valid BOT win and explore the game's local progression.

**Controls**
- On desktop, use the in-game instructions; the primary ability hotkeys shown in battle are **J / K**.
- On touch devices, tap the skill cards; the interface adapts to portrait and landscape screens.
- Watch the brief Tactical Pulse hints on the first match.

**Important Alpha notes**
- Guest progress and AC are stored **in this browser, on this device**. Clearing website data or using another device can remove or reset your progress. There is **no account sync** in this build.
- This is an early Alpha; gameplay balance, polish, progression, and content may change.
- Desktop or landscape phone mode offers the most spacious HUD; portrait phones are supported but compact.

**Feedback welcome:** Tell us your device, browser, match mode and what happened when you found a bug.

## Mô tả ngắn bằng tiếng Việt

**APEX CHAOS — Alpha** là game hành động đấu trường góc nhìn từ trên xuống, tập trung vào những pha giao tranh nhanh, kỹ năng khác biệt và nhặt vũ khí ngay trong trận.

Vào chơi **không cần đăng nhập**, đấu với BOT hoặc chơi LOCAL trên cùng thiết bị. Thắng BOT hợp lệ nhận **200 AC**. Tiến trình Guest lưu trong trình duyệt hiện tại; xóa dữ liệu trình duyệt có thể mất tiến trình. Đây là bản Alpha thử nghiệm nên nội dung còn có thể thay đổi.

## Suggested screenshot order (actual Chromium; no concepts)

1. 844×390 landscape actual battle: `evidence/issue-103-final-alpha-gate-20261023/after/after-844x390-eng-coach-toast.png`
2. 390×844 actual touch battle: `evidence/issue-103-final-alpha-gate-20261023/after/390x844-port-06-match-j-castable-with-target.png`
3. 1440×900 game result or match: `evidence/issue-102-runtime-qa-20261023/1440x900-desk-06-match-j-castable-with-target.png`
4. 844×390 live Result Gold: `evidence/issue-103-final-alpha-gate-20261023/itch-nested/nested-844x390-phone-touch-05-result-gold.png`

## Submission gate

1. Owner-review artifact ZIP passed independent entrypoint, file-count, path-length, decompressed-size and CRC checks.
2. Exact **extracted ZIP bytes** passed Chromium nested-path /html/apex/ E2E, including touch + desktop BOT win, **350 → 550 AC**, receipt persistence and zero blocking HTTP/console errors.
3. Upload the verified ZIP as **HTML Game** with **index.html at the ZIP root**. Preview **on itch.io itself** in restricted/draft mode before publishing, because production itch CDN behavior is a distinct final gate.
4. Only the owner authorizes changing visibility to Public. Do not use `itch-guest-200ac-release-candidate.yml` as an upload-only mechanism; it also runs Cloudflare deploy actions.

Official HTML5 guide: https://itch.io/docs/creators/html5
