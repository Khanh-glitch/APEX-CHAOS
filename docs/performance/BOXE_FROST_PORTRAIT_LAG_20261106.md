# BOXE vs FROST — portrait recording frame-time investigation (06 Nov 2026)

**Scope:** real packaged HTML5 Gold BOT Battle on the RC2 audio-only baseline (ancestor `cf978c02d7f24942d8a835b4286c97eb33c6c67f`). Production game/hero shaders/VFX/recording code untouched by this diagnostics branch. FROST is runtime ID `ICE`; NEWBOT is `ROBOT`. Test runner: `tools/profileBoxeFrostPortrait.mjs`.

**Evidence:** [GitHub Actions passing test 42227145040](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/42227145040), source SHA `02238ac67d221dc13b3c70883b9aeeed5f91fe6d`. Each phase ~3.5 sec, one natural running match per matchup; no artificial skills or simulation state changes. Frame intervals come from requestAnimationFrame in the *real game iframe*.

| Matchup | Phase | RAF gap median | RAF gap p95 | Browser long tasks |
|:--|:--|--:|--:|--:|
| BOXE vs FROST (ICE) | No recording | 50.0 ms | 66.7 ms | 49 |
| BOXE vs FROST (ICE) | MediaRecorder active | 83.3 ms | 100.1 ms | 44 |
| BOXE vs FROST (ICE) | Recording stopped | 50.0 ms | 66.7 ms | 32 |
| BOXE vs NEWBOT (ROBOT) | No recording | 16.7 ms | 50.0 ms | 0 |
| BOXE vs NEWBOT (ROBOT) | MediaRecorder active | 33.3 ms | 66.6 ms | 0 |
| BOXE vs NEWBOT (ROBOT) | Recording stopped | 16.7 ms | 33.4 ms | 0 |

## What these measurements support

1. BOXE vs FROST is substantially heavier than BOXE vs NEWBOT *even without recording* in this one CI run.
2. Starting the 1080x1920 MediaRecorder+crop correlates with worse frame intervals in both cases. Ending recording is followed by recovery; this is evidence of recording overhead under these conditions, not a deterministic causal or real-device proof.
3. BOXE has multiple high-fidelity fluid/smoke/fire/lightning composites; FROST has a separate layered ice renderer and frozen-floor sprites. Both remain intact. The specific expensive function has **not** been identified yet; don't lower VFX quality or turn off any subsystem based on this table.
4. The original r5 recording pipeline was retained byte-for-byte by RC2. RC1's failed frame scheduling experiment is **not** included.

## Critical limitations

- CI uses **headless Chrome and a software-GPU execution context**, not the owner's actual laptop GPU.
- For recording the test passes a **synthetic tab-shaped MediaStream** whose source draws *real battle-canvas pixels*. It exercises MediaRecorder's output scaling/encoding, but **does not reproduce Chrome's real display-capture/compositor path**.
- Each phase covers a different live battle interval with different effect timings; outcomes may reflect skill/VFX variance. This is a directional diagnostic, not an ABBA replicated benchmark or proof of an exact causal FPS change.
- There is no recording of the owner's original problematic clip. Real 1080x1920 output does not imply source pixels reach that resolution.
- No physical device acceptance or video/audio artifact submitted by owner. The reported severe stutter remains **OPEN**.

## Next falsifiable checks

- Measure a GPU-backed on-device A/B for **BOXE P1 vs FROST P2**, with and without recording, preferably three runs each and fixed initial hero orientation/viewport.
- Record Chrome Performance profiles around an A1/A2 cast and identify main-thread hotspots: Frost renderer/ice canvas, BOXE fluid compositor, engine AI or MediaRecorder.
- Fix only a proven redundant allocation/draw or expensive computation. Preserve all visual output and combat effects; add pixel/asset parity and actual frame-time evidence.
- Confirm the owner finds the captured video watchable in the same matchup before replacing any r5/RC2 release.

**Decision:** game remains unchanged; neither r5 nor RC2 should be declared lag-free. This is a confirmed reproduction under CI, not a performance fix.
