# Robot — owner visual checkpoint

**Pending owner visual review. Not final acceptance.**

Production Chromium; ROBOT vs ICE; cast AI disabled. Controlled fixtures use the production simulation, pickup/equip, holder fire, projectile collision and damage paths. Screenshots pause simulation between labeled states; clips retain those inspection pauses. The opponent is held stationary; Robot is held stationary only for isolated A2 hits.

## Five proof groups

- [01-idle-move-fixed-orientation](01-idle-move-fixed-orientation/sequence.webm) — video with real battle-graph audio; labeled PNG frames in the same directory.
- [02-real-weapon-socket](02-real-weapon-socket/sequence.webm) — video with real battle-graph audio; labeled PNG frames in the same directory.
- [03-a1-sequence](03-a1-sequence/sequence.webm) — video with real battle-graph audio; labeled PNG frames in the same directory.
- [04-a2-sequence](04-a2-sequence/sequence.webm) — video with real battle-graph audio; labeled PNG frames in the same directory.
- [05-a2-controlled-gunfire](05-a2-controlled-gunfire/sequence.webm) — video with real battle-graph audio; labeled PNG frames in the same directory.

Group 03 includes a second cast on the same Robot to check fresh-trail ownership. Group 05 uses one controlled PISTOL impact from each side; its event payloads and head-local stress are retained in `focused-checks.json`.

## Real audio

The eight-file mapping is unchanged. `requested` is semantic dispatch, `decoded` means an actual AudioBuffer was loaded, and `sourceStarted` increments only after `AudioBufferSourceNode.start()` succeeds on the running engine context. These are not interchangeable counters.

| Event | Requested | Decoded | Source started | Approved runtime file |
|---|---:|:---:|---:|---|
| robot_a1_lock | 3 | yes | 3 | `robot_a1_lock.mp3` |
| robot_a1_no_weapon | 1 | yes | 1 | `robot_a1_no_weapon.mp3` |
| robot_a1_dash | 3 | yes | 3 | `robot_a1_dash.mp3` |
| robot_a2_activate | 2 | yes | 2 | `robot_a2_activate.mp3` |
| robot_a2_armor_hit | 2 | yes | 2 | `robot_a2_armor_hit.mp3` |
| robot_a2_end | 2 | yes | 2 | `robot_a2_end.mp3` |
| robot_passive_milestone | 1 | yes | 1 | `robot_passive_milestone.mp3` |
| robot_passive_upgrade | 1 | yes | 1 | `robot_passive_upgrade.mp3` |

Clip audio is captured from the existing battle master, not synthesized or substituted. All four action clips contain non-silent decoded audio (measured peaks −4.7 to −2.9 dB). [No-target / passive audio](sfx-no-target-passive.webm) records the remaining cues; passive thresholds are test-only. Full counters: [sfx-runtime.json](sfx-runtime.json). This verifies browser graph playback, not the owner's speaker volume or device routing.

## Focused safety

Production build **PASS**; Robot **R1–R9: 9/9**; real pickup/equip and real fire **PASS**; Robot blood suppressed while non-Robot blood remains **PASS**; **one AudioContext**; no browser page errors. No PAINTER changes, new Robot sounds, full regression marathon, or repository-wide evidence refresh.

Base: `2026fbbf70687d0ecb682774ef3bb03b96b8478d`. Golden-master HTML SHA-256 unchanged: `bd0cc64fbeea94969fbef0b4bc4de690a19e85fafe93cb4a12c9b3accf095f75`.

Capture: `node tools/captureRobotVisualCheckpoint.mjs` against production preview on port 4173 (requires `puppeteer-core` and `@sparticuz/chromium`). Safety gate output was directed outside the repository to avoid refreshing the existing evidence catalog.
