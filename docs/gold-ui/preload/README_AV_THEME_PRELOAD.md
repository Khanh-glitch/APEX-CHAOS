# APEX CHAOS — Core Six AV + Theme Preload

This directory is the additive AV preload for the Gold product UI/UX/HUD cutover.

## Parent checkpoint
- Branch: `arena/01a1025a-apex-chaos`
- Parent HEAD: `b5defc0bc51e98d47dca4e4672fc82a75ef14673`
- Runtime underneath the Gold preload: `20261003-mirror-v1-r42`

## Archive
`APEX_CHAOS_CORE_SIX_AV_THEME_PRELOAD.zip`

SHA-256:
`49d8d5bf448bce7ca6475388cdf640c338bc00250fbcb577dbc7962fcfd0180f`

The archive contains six clearly separated hero packs:
- ROBOT — VFX authority pack; production Robot SFX already ships in repo.
- HUNTER — VFX authority pack; production Hunter SFX already ships in repo.
- CRYSTALA — VFX authority + curated, pre-cut SFX.
- MAGNET — VFX authority + curated, pre-cut SFX.
- FROST — VFX authority + curated, pre-cut SFX.
- MIRROR — VFX authority + curated, pre-cut SFX.

The archive also contains the owner-supplied product theme:
- owner source: `Forward Drive.mp3`
- owner-source SHA-256: `e3207b5744ad1657fd77d757bd732a71eda5a4c471e0abef7f68a121b32a2c9e`
- repository preload encode: `music/forward_drive_theme.ogg`
- encoded SHA-256: `15afd820d5ca061f374ea41ad425f795204cf2be0e1f03d641f9b1f85f6dfb9b`
- duration: ~158.06 s
- encoding: Ogg Opus, repository-efficient preload copy.

## VFX law
This archive does NOT fork the accepted VFX authority. VFX manifests point back to the accepted shipping Gold/presentation runtimes and assets on this branch. Materialize/reuse those authorities; do not make a second approximate renderer.

## SFX law
The four newer hero packs contain deliberately pre-cut runtime clips based on the owner's curated source sounds. Optional/low-accent cues remain optional. Do not wire every file merely because it exists. Use the semantic event/rate-limit instructions in each pack.

Robot and Hunter already have accepted production SFX under:
- `public/assets/hero-rework/robot-final/sfx/`
- `public/assets/hero-rework/hunter-v10/sfx/`

## Theme policy authority
The upcoming cutover must adapt the existing `src/App.jsx` menu-BGM seam; do not create a competing music engine.

Required behavior:
- Continue theme on Home/navigation and BOT/Local Fighter Pick.
- Pause with fade-out while entering Lucky Draw, Fighter Upgrade, Mission(s), or Fighter Shop.
- Preserve the playhead whenever music pauses for a surface. Returning to an allowed surface resumes from the same position with fade-in; ordinary navigation must NOT restart at 0.
- Keep theme alive through battle-entry presentation until the actual battle session starts; at actual match start, fade out then pause.
- On result/return to an allowed surface, resume the preserved playhead with fade-in.
- When `document.hidden` or the window loses focus/blur, music must become silent/pause; on visible/focus, resume only if the user has not muted it and the current surface allows music.
- `M` is the global MUSIC-only mute/unmute key. It must preserve playhead and must not mute battle SFX.
- The Gold Battle HUD donor's demo-only `M = toggle 1P/2P` binding must NOT survive production cutover. BOT/Local mode is product state, not a production hotkey.
- Keep menu/theme music outside the battle-audio graph. Do not create another AudioContext.

## Placeholder status
This AV preload does NOT magically fill the four Gold UI art categories:
1. Lucky Draw fighter visual art
2. Fighter Pick cover/card art
3. Fighter Pick pose/stage art
4. Battle avatar/portrait + passive/A1/A2 icons

Only mark one of those slots resolved when an actual asset of that exact category exists. The VFX/SFX packs are battle/presentation assets, not Pick/HUD slot art.
