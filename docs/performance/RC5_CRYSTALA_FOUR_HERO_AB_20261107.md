# APEX CHAOS — four-hero RC5 baseline versus Crystala bloom-surface candidate

Date: 2026-11-07. Source: GitHub Actions
- Browser A/B: https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/42365461290 (PASS)
- Shipping/build/battle/recorder: https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/42365461209 (PASS)
- RC5 unchanged baseline Git SHA: `9a7fd071083104ac11d0fe5ad73f075d017eae34`
- Candidate branch: `perf/full-battle-four-heroes-recording-20261107`
- Full review PR: https://github.com/Khanh-glitch/APEX-CHAOS/pull/126

## What changed

On top of RC5 (no rollback), each live CRYSTALA rig and wall/prison construct has its own Gold bloom compositor, keyed by WeakMap. The former shared Gold compositor resized three GPU-backed canvas surfaces whenever the render switched emitter bounds, including during wall/prison abilities. The compositor itself still uses the same authored Gold draw, cropping, blur radii, masks, alpha, and blend weights. No particles, effects, assets, ability timings, audio, target recording resolution or bitrate were removed.

## Matched real Chromium browser frame timings

The browser script invokes production `APEX_ARSENAL.step(1/60)` and `draw()` for fixed scenes. It does NOT measure actual wall-clock FPS, Chrome compositor/GPU hardware, or encoded-video frame delivery. Both versions ran on the same GitHub runner and Chrome. Each four-hero matchup was tested in both orders (RC5 → candidate, then candidate → RC5), and the values below are the mean of two p95 values. Due to CI noise, do not infer owner hardware FPS improvement from these numbers alone.

| Real matchup (P1 vs P2) | RC5 p95 mean | Candidate p95 mean | Change |
|---|---:|---:|---:|
| BOXE vs FROST/ICE | 1.70 ms | 1.95 ms | +14.7% |
| SHURI vs FROST/ICE | 4.95 ms | 4.30 ms | -13.1% |
| CRYSTALA vs BOXE | 11.40 ms | 12.00 ms | +5.3% |
| FROST/ICE vs CRYSTALA | 13.25 ms | 12.05 ms | -9.1% |

No scenario crossed the predefined **+20%** p95 severe-regression threshold. Absolute times under 5 ms are especially sensitive to timing variability and GPU/CPU scheduling.

CRYSTALA's dedicated spell-path profile (separate single same-runner comparison):
| Spell scene | RC5 p95 | Candidate p95 | Change |
|---|---:|---:|---:|
| Crystal prison / HEXA full | 30.3 ms | 17.4 ms | -42.6% |
| Crystal K wall full | 25.5 ms | 14.4 ms | -43.5% |

Candidate bloom compositor observed `systems:18`, `passes:2422`, `regionSizeChanges:335` in the diagnostic profile. The shared-system RC5 had no equivalent instrumentation.

The existing Gold direct-wide-versus-legacy bloom parity probe gave the same results in both builds (premultiplied mean difference 0.131), but **this is NOT a pixel-by-pixel RC5-vs-candidate screenshot parity proof**. Authored Gold draw code was unchanged.

## Gates

- Four-hero semantic tests, Gold integration and BOXE particle-state parity: PASSED, except **explicitly inherited** CRYSTALA G07/R07 ancestry failures and FROST F00.1 ancestry failure. These exceptions are documented; do not report the entire repository as green.
- Actual itch portable ZIP booted inside nested /html/apex/, both desktop and phone Gold HUD/BOT Battle reached, 0 JS errors and 0 HTTP missing assets: PASSED.
- Browser `MediaRecorder` manual-frame 1080×1920 output decodes: PASSED; Chrome CI chose VP9, not owner hardware H.264.
- Physical GPU recording-ON versus recording-OFF gain for the owner laptop and every skill's pixel/audio parity: **NOT VERIFIED**.
- Public itch deployment: **UNCHANGED**; PR remains Draft.

## Decision

Retain this optimization in the single consolidated Draft PR because the expensive CRYSTALA spell-specific path improved substantially in the controlled browser A/B, and the paired whole-match test found no >20% p95 regression. Do not describe it as a proven whole-game FPS fix, do not replace the public itch build, and do not ask the owner to test each micro-iteration. The remaining real-world acceptance is one single hardware recording-ON/OFF session with full gameplay + captured-video/audio review.
