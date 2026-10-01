# Audio Latency & Delivery Tiering Report

Checkpoint 2B · commit `perf(audio): predecode latency-sensitive battle sfx`
Measured by `tools/testArsenalQuestRuntime.mjs` audio gates + `tools/assetAudit.mjs`
audio delivery policy (`tools/audioDeliveryPolicy.mjs`).

## Problem

Battle SFX were played through per-trigger `fetch()` → `decodeAudioData()` on
`HTMLAudioElement`-style one-shot paths: every gunshot/melee hit paid a network
round-trip plus an MP3 decode (tens to hundreds of ms, worse on cold cache)
between the gameplay event and audible feedback. The same MP3s were re-fetched
and re-decoded on every repeat trigger.

## Delivery tiers (code-driven, `tools/audioDeliveryPolicy.mjs`)

| Class | Files | Bytes | Delivery |
|---|---|---|---|
| HOT_LATENCY_SFX (arsenal AV cue bank) | 50 | 1.02 MB | fetched + `decodeAudioData` at AV warmup; triggered via `AudioBufferSourceNode` only |
| WARM_GAMEPLAY_SFX (fighter/modes/arsenal) | 80 | 5.41 MB | muted `Audio` element prefetch by tiered loader (`src/game/runtimeLoader.js`) |
| LONG_STREAM_AUDIO | 2 | 3.41 MB | `menu_bgm.mp3`, `possession-ambience.mp3` — streamed, never predecoded |
| COLD_RARE_SFX | 0 | — | reserved class; none currently shipped |
| SOURCE_MASTER (WAV masters in public/) | 24 → **0** | 9.63 MB → **0** | removed from delivery (see "WAV resurrection" below) |
| Retained runtime WAVs | 0 | — | policy list empty (protects future WAV needs explicitly) |

## HOT bank — predecode at warmup

`public/game/arsenal/arsenalPresentationRuntime.js`:

- `loadAudio` now caches a single in-flight promise per relative URL (a `Map`),
  counts `decodeCalls`, and wraps `decodeAudioData` in a dual promise/callback
  form (the headless jsdom harness stubs promise-style; some browsers return
  promises only).
- `warmAudio()` preloads all 50 cue MP3s and resolves when every buffer is
  decoded or failed; `audioStatus()` exposes `{bankSize, decoded, failed,
  pending, decodeCalls, played, notReadyThrottles, pcmBytes, warmMs, lastVoice}`.
- `stats.lastVoice` records `{rel, vol, offset, dur, viaBufferSource}` for each
  played cue (after the stat-silent early return, so headless stat-silent mode
  records nothing).

Measured (browser gates, 2 runs + fresh re-run):

- Bank: **50/50 predecoded, 0 failed, 0 pending** — PCM footprint
  **18.04 MB** (18,042,584 bytes) resident at warmup.
- Warm decode window: **726–734 ms** warm cache, **2015 ms** cold cache — paid
  once, behind the AV preload gate (`APEX_ARSENAL_AV.preload()` from the tiered
  loader on `arsenalQuest`/`battle` group readiness), before gameplay begins.
- Trigger window (gate clears `performance.clearResourceTimings()` first, then
  fires 5 cues: fire/PISTOL, melee_hit/BATTLE_AXE, pickup/AK_47,
  storm_impact + storm_windup/STORMBREAKER):
  **0 network fetches, 0 additional decodeAudioData calls, 7 plays**, last voice
  `sfx/scifi/forceField_001.ogg` vol 0.3 **viaBufferSource: true**.
- Master gain path verified end-to-end (`masterGainPath: true`).

## WARM bank — tiered loader prefetch

- `tools/generateAudioWarmBanks.mjs` derives group → audio URL lists from the
  audit's shipping refs × deferred runtime groups (AV HOT bank URLs excluded —
  they are predecoded, not element-prefetched), emitting
  `src/game/audioWarmBanks.generated.js` (7 groups, 539 URLs).
- `src/game/runtimeLoader.js` `warmGroupAudio(group)` fires
  `APEX_ARSENAL_AV.preload()` (arsenalQuest/battle) then
  `window.apexWarmAudioUrls(bank)` — muted `preload='auto'` `Audio` elements
  with a dedupe `Set`, refs held, no playback.
- Measured: **74 URLs prefetched** on Arsenal Quest entry (union of the
  group bank after dedupe), `apexWarmAudioStatus().prefetched >= 60` gated.

## Gates (both suites green: headless 306/306, browser 186/186)

1. `audio-hot-bank-fully-predecoded` — decoded === bankSize, 0 failed, 0 pending.
2. `audio-hot-trigger-zero-fetch-zero-decode` — resource timings cleared, 5
   cues fired, `resAfter === 0`, `decodeCalls` unchanged, `playedDelta >= 5`,
   `lastVoice.viaBufferSource && vol > 0`.
3. `audio-warm-bank-prefetched-by-loader` — `prefetched >= 60`.

Report field: `report.audioLatency` (browser evidence
`docs/arsenal-quest/evidence/test-report.json`).

## WAV resurrection — root cause and fix

Checkpoint 2 moved all 24 public/ WAV masters to `masters/audio/` (public/
keeps only MP3 delivery), but the WAVs reappeared: `package.json` chains
`pnpm arsenal:sfx:materialize` (`tools/materializeArsenalFinalSfx.mjs`) before
`dev`, `build`, and both test suites, and that tool re-inflated the 20
owner-approved final-lock WAVs from
`tools/arsenal-assets/source/sfx/final-lock/APEX_C1_SFX_FINAL_LOCK.zip` into
`public/assets/arsenal/av/sfx/c-final/` on **every** chained run — silently
undoing the master move and doubling the AV delivery weight (9.63 MB of PCM
masters inside `dist/`).

Fix (this checkpoint):

- `materializeArsenalFinalSfx.mjs` now materializes the WAV masters into
  `masters/audio/assets/arsenal/av/sfx/c-final/` (outside `public/`), writes the
  integrity inventory `MANIFEST.csv` there, and keeps `c-final` rows **out** of
  the public `public/assets/arsenal/av/MANIFEST.csv`. Provenance text updated:
  public ships MP3 conversions; WAV masters are never served.
- The 3 unreferenced `sfx/source/` raw recordings + 1 spare
  `sfx/feel/rifle_take_06.wav` moved to `masters/audio/...` likewise (verified:
  zero references in `src/` + `public/game/`; runtime references are MP3-only —
  21 c-final refs, all `.mp3`).

Post-fix verification: full `pnpm build` + headless + browser suites leave
**0 WAV files in `public/` and 0 in `dist/`**; audio policy summary shows
`SOURCE_MASTER` absent from public entirely.

## Outcome

- Trigger-to-sound for battle SFX is now memory-resident buffer playback: no
  fetch, no decode, no per-trigger allocation beyond the source node.
- One-time warmup cost (≤ ~2 s cold) is paid behind the existing preload gates,
  before the player can enter combat.
- Shipping audio: 132 files, ~9.85 MB (HOT 1.02 + WARM 5.41 + streams 3.41),
  zero WAV masters in the delivery tree.
