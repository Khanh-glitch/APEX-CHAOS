# ROBOT FINAL INTEGRATION LOCK — 2026-09-29

## Baseline

- Repository: `Khanh-glitch/APEX-CHAOS`
- Source/playable Slime baseline: `arena/01a0e749-apex-chaos@84d386337d97ed4575a0cf476ecf05ec54321660`
- This director branch was created from that exact SHA: `director/robot-final-integration-20260929`
- Do **not** start Robot final integration from `main`.
- `director/slime-crash-recovery-20260929@696170b...` is a later closeout/authority-doc lineage, not the newest playable Slime tree.

## Authority split

1. Owner-supplied `ROBOT_VISUAL_AUTHORITY.html` owns ROBOT appearance, material language, segmentation, articulated motion, A1/A2 choreography, movement inertia, hit/wall/fire responses and passive presentation.
2. Current APEX code on the baseline owns gameplay, physics, collision, camera, weapon inventory/rendering, projectiles, damage/CC, Hero Rework cooldowns, audio engine and product/runtime lifecycle.
3. The prototype background, controls, fake gun, demo projectiles and synthesized WebAudio sounds are **not** production authority.
4. Adaptation to APEX may change coordinate transforms, world scale, timing synchronization to real game events, real weapon socketing, camera/DPR plumbing, pooling/caching and audio routing. It must not redesign the Robot's visible identity.

## Frozen gameplay laws

- A1 cooldown 10 s.
- A1 seeks nearest eligible REVEALED pickup; T6/Stormbreaker is excluded.
- A1 is a physical continuous dash, no teleport pickup, max dash window 0.55 s; physical contact remains equip authority.
- A1 with no eligible target: fail cue, cooldown not consumed.
- A2 cooldown 10 s; exact duration 3.0 s; incoming multiplier 0.45 (55% damage reduction); no CC immunity.
- Passive counts credited realized damage only.
- Passive refund ladder: milestone 1 = 0, #2 = 0.5 s, #3 = 1.0 s, #4 = 1.5 s, later +0.5 s each.
- Production milestone thresholds remain unresolved/null. Never invent thresholds. Test-only thresholds may be injected to verify presentation only.

## Final Robot SFX authority

Exactly eight Robot-specific production cues:

| Cue | Owner-selected source |
|---|---|
| `robot_a1_lock` | `mixkit-sci-fi-positive-notification-266.wav` |
| `robot_a1_no_weapon` | `universfield-error-notification-05-199276.mp3` |
| `robot_a1_dash` | `mixkit-futuristic-robotic-fast-sweep-171.wav` |
| `robot_a2_activate` | `mixkit-robot-step-1417.wav` |
| `robot_a2_armor_hit` | `mixkit-mechanical-crate-pick-up-3154.wav` |
| `robot_a2_end` | `mixkit-robotic-engine-malfunction-3149.wav` |
| `robot_passive_milestone` | `daviddumaisaudio-steampunk-mechanical-gadget-188052.mp3` |
| `robot_passive_upgrade` | `rescopicsound-sci-fi-weapon-recharge-reload-compact-01-233839.mp3` |

Owner corrections are final:
- A2 open is now `mixkit-robot-step-1417.wav`.
- A2 armor hit is `mixkit-mechanical-crate-pick-up-3154.wav`.
- A2 end/close is `mixkit-robotic-engine-malfunction-3149.wav`.
- same A2 armor-hit file for all hit strengths.
- no clamp SFX.
- no separate heavy A2-hit SFX.
- rejected `mixkit-shuffling-gear-mech-item-3152.wav` must not ship.

## Integrity

Expected SHA-256:

```text
bd0cc64fbeea94969fbef0b4bc4de690a19e85fafe93cb4a12c9b3accf095f75  ROBOT_VISUAL_AUTHORITY.html
4cfa96268f56cb9be09406750d45fa3e8b2336319e469f8f66af1cbf55989561  mixkit-sci-fi-positive-notification-266.wav
2754c5b2353b20d5573c17b2e5511fbbcf5dad4b61ba6c60caf6038c0612742e  universfield-error-notification-05-199276.mp3
cf0e6f0aa39b4d9cf217c67c722070880be0bf6faf8eca19b3d38155a2bc444b  mixkit-futuristic-robotic-fast-sweep-171.wav
c62e90c96d6f12822b077871d1961a54db06fba67cafafe18260f50d36c93cb0  mixkit-robot-step-1417.wav
0ba775924355676895fe591a0704a1b609f9cfaab0f9a7866135dd553bd28ee8  mixkit-mechanical-crate-pick-up-3154.wav
7b28af8c95e33c7097445ab040a43b04325f64ce989f992ca4ec5fb3ef2b4dd1  mixkit-robotic-engine-malfunction-3149.wav
8a588c7dbdf1a2cc44860c07da045453cac306425afdaf2ba54cf91c3fe30ca1  daviddumaisaudio-steampunk-mechanical-gadget-188052.mp3
c498ced028f40998fd55fe17f5bdd51b2cf4d91a805a5091840b905e01e06a13  rescopicsound-sci-fi-weapon-recharge-reload-compact-01-233839.mp3
```

## Implementation boundary

ROBOT must be updated as a whole presentation actor: body renderer, idle/held pose, ordinary-motion inertia, wall response, unarmored hit response, real-weapon socket/hold, fire recoil, A1 states/VFX, A2 states/VFX, passive presentation, camera/hit-stop handshake, semantic events, final SFX, loading/teardown/performance and tests.

Do not implement only “VFX” or only “SFX”.

Keep existing Robot R1–R9 mechanics gates green and rerun all Slime correction suites plus Hero Rework/Arsenal regression. Visual owner playtest remains required before promotion.
