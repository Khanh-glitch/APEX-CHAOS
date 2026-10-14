# THE HAND Gold V2 — SHA-anchored ingestion audit

- Source file: `THE_HAND_GOLD_ROCKET_CATCH_IMPACT_V2_POSE_UPDATED(1).html`
- Byte length: **25,675,422**
- SHA-256: `ccb889bb08cb2e741c4f7f5e0b33d08047c08fb28bfc1c31ae9401604444e2b2`
- Contains a standalone HTML with **10 embedded PNG assets** and bundled source: `skills.ts`, `sprites.ts`, `engine.ts`, `fx/textures.ts`, `fx/fluid.ts`, `fx/fire.ts`, `fx/lightning.ts`, `vfx.ts`, `post.ts`, `materialFx.ts`.
- **WARNING:** Binary GOLD source/assets have NOT yet been committed. The ChatGPT GitHub connector writes UTF-8 strings or explicit blobs, but has no local sandbox file-byte transfer seam. This manifest alone is NOT Gold ingestion. Use prepared local import bundle with a Git client, then verify SHA and runtime.

## Exact skill mapping (keyboard row in Gold, NOT ability order in game)

| Source key | Source ID | Adaptation |
|---|---|---|
| 1 | `jab` | BOXE empowered A1 2s stationary two-glove flurry; BOT WAVE J combo finisher unlock #1 |
| 2 | `rocket` | BOXE A1 detached fist; 5s flight and impacts, then original return/catch |
| 3 | `uppercut` | BOXE empowered A2 finisher; BOT WAVE J combo finisher unlock #2 |
| 5 | `phantom` | BOT WAVE U unlock #4 |
| 9 | `counter` | BOXE A2 and BOT WAVE K |
| 0 | `ult` | BOT WAVE I |
| other | 4/6/7/8 | Source retained, not public BOXE skills |

## Inspected source facts
- Source `skillJab()` emits **six punches**, each scheduled `i*0.085` seconds apart; collision/hit scheduled `0.05` seconds after initiation. Therefore owner-mandated half-window stun is **0.0425 seconds** per successful enhanced A1 hit. Two-second expansion needs a timeline extension, not mere replay of six frames.
- Source `skillRocket()`: R glove detached; starts with 1250 u/s, outward phase originally switches to return after **880 u**, not 5 seconds. Original return pursues the visible idle glove slot, speed 1450 u/s, and calls real `startRocketCatch` when reunited. Integration changes the *phase timing* but preserves launch, travel, impact, return and catch VFX.
- Catch response: `rocketCatch.life=0.49`, initial compression **55 ms**; physical impulse `min(speed*0.21,315)`, `hitstop(0.055)`, `shake(10)`, `kickZoom(0.34)`; body squash/lean and opposite glove counterbalance.
- Gold `skillCounter()`: guard **1.6 s**, retaliates after intercepted **bot projectile**, otherwise issues an expiry nova. Owner BOXE spec replaces this with **1s reactive intercept of opponent-owned incoming DAMAGE**; should NOT retain expiry nova automatically.
- Gold `skillUppercut()` uses impact, material eruption/fracture/rubble, columns of fire, knock-up, hitstop and camera shake. BOXE amplified finisher must preserve these visual passes while replacing damage with 10% remaining target HP.
- Gold passive is **8 s** at 100 fury with +25% damage. Owner BOXE passive overrides with **3 s** at 300 qualified damage taken/dealt and 2x cooldown recovery.
- Gold has five physics ribbon/cloth strips driven by `initRibbons`, `updateRibbons`, `drawRibbons`; user wants cloth removed from derived gameplay without mutating frozen Gold.
- BOT WAVE base has training BOT AI with strafing and ranged orbs, dummies/tank/boss placeholders, circular arena and central drawn lightning emblem. Production needs new wave scheduler, XP/progression, enemy archetype registry, spawn boundaries and authentic APEX favicon.

## Preservation / acceptance
- Freeze original input by SHA. Extract binary assets losslessly; verify per-asset SHA.
- Reuse the exact Gold VFX modules and event sequencing; **never** simulate preservation by approximating glow/trails.
- Gameplay damage, stun, disarm, pickup and ownership must come from arena-authoritative engine hooks, not standalone training lab.
- Include regression for SOURCE → asset extraction → VFX events → gameplay authority → mobile landscape → real browser screenshots.
