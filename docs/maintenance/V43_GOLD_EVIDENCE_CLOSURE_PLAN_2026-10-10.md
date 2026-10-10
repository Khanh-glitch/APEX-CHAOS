# V4.3 GOLD — 40-phase evidence closure plan (2026-10-10)

**This is an audit and capture plan, not an award of GOLD certification.**
Canonical developer base `development/v43`: `05b491de4c30e2239ea27a2b98e6c2d9db3aee04`.
Passing gameplay-fix commit: `ce137b19be2fe516003e3b6dcab8613db91a7e19` on Draft PR #26.

## Provenance and present verdict

- The unmodified fail-closed certification contract is `tools/testOwnerV43GoldCertification.mjs`. It pins owner-reference Gold HTML SHA256 `8db9ce58c0a61171ab76bcd5b18dea21564b45c76663d93fc28e61eaefdcd38d`.
- Strict run [38062924750](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/38062924750): 7/7 executable source-trace tests passed; 0/40 full motion/visual phases certified. **Status: BLOCKED.**
- Gameplay run [38062924615](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/38062924615): 44/44 steps successful, including real Chrome floor pickup, native HP, Gold Result browser, actual physical pointer and cold-load profiling.
- Artifact ID `11673294462`, archive digest `sha256:c237d758477d98cc2b9f2f99cb7ed42aac9193aecb31a0a3d81e56ef7d6bf5a3` contains candidate acceptance evidence. **An acceptance artifact is not a Gold phase proof.** Its content is not treated as a vetted Gold-reference comparison.
- The 40 individual blockers and required `gold:` evidence IDs are in `V43_GOLD_40_PHASE_EVIDENCE_BACKLOG_2026-10-10.json`. Every row remains `UNVERIFIED`.

## Current candidate screenshots are insufficient

`tools/testV43PickupBrowser.mjs` captures six native Chrome frames for each V4.3 weapon, in addition to real pickup/fire/damage telemetry:

| Weapon | Candidate simulation frames @ 60 fps |
|---|---|
| FLARE_GUN | 20, 42, 65, 95, 130, 170 |
| TACTICAL_CROSSBOW | 20, 42, 65, 95, 130, 170 |
| STEEL_BALL_LAUNCHER | 20, 42, 65, 95, 130, 170 |
| COMBAT_BOOMERANG | 20, 42, 75, 110, 180, 260 |
| RPG_7 | 20, 42, 65, 95, 130, 170 |
| FLAMETHROWER | 20, 42, 65, 95, 130, 170 |
| PLASMA_SPLITTER | 20, 42, 65, 95, 130, 170 |
| SHRAPNEL_MINE_LAUNCHER | 20, 42, 65, 95, 130, 170 |

These are fixed simulation-clock snapshots. They do **not** prove which screenshot coincides with READY / ATTACK / CONTACT / AFTERGLOW / COUNTER, nor that a reference Gold frame was captured at the same moment. The browser assertion of six unique/nontrivial frames checks temporal activity, not the full fidelity of the original design.

## Required completion method for every phase

1. **Reference:** Identify the unmodified owner Gold source/file (verify its SHA256 against the pinned baseline). Record its frame capture and rendering environment. Never substitute a new artist approximation for the owner's original.
2. **Native authority:** Execute real pickup or held pose, real weapon USE, real projectile collision/HP, finite afterglow, and actual Crystal/Magnet counter interaction. Capture chronological event receipts, motion frames and deterministic world geometry.
3. **Matched sequences:** Render both Gold reference and V4.3 candidate at identical viewport, camera, fighter coordinates, target coordinates, orientation and event-relative times. Record original/reference and candidate PNG SHA256, all timestamps and alignment.
4. **Objective tests:** Compare ordered motion trajectories, spatial origin (sprite/muzzle/world), lifetime, stage duration, velocities and the source-authorized layer count, plus image-frame geometry/pixel boundaries with explicit tolerances. Inspect temporal coherence; no single-frame badge.
5. **Fail closed:** Implement a per-phase executable `gold:` proof in the GOLD certification script only once supported by reviewed reference evidence. Mere file presence, screenshot names, a passing source test or a candidate screenshot hash is **not sufficient**.

### Highest-priority evidence to capture next

- **FLAMETHROWER:** original Lab-only fire/smoke/tongues; correct calibrated Gold muzzle; half-angle `0.18 rad`, damage reach `325px`, duration `0.325s`; five real damage ticks and once-only burn. Do not restore the extra VFX or the former `650px` arc to make a screenshot match. The user's halving request is authoritative and must be recorded as an intentional design delta in the reference comparison.
- **COMBAT_BOOMERANG:** whole out/return/catch sequence, real empty hand between throw and catch, two-leg hit, weapon return pose, Crystal/Magnet redirected flight. Validate chronological phases, not just isolated curved paths.
- **RPG_7 / FLARE_GUN / PLASMA_SPLITTER:** compare smoke/impact/burn/core split motion across multiple frames, including their counter phase and native resulting HP.
- **TACTICAL_CROSSBOW / STEEL_BALL_LAUNCHER / SHRAPNEL_MINE_LAUNCHER:** capture original held recoil, projectile paths, real physical contact, decay/shrapnel and counter responses.

## Release rule

No modified Gold-certification implementation has been applied in this cleanup. The recorded state stays **7/7 source proofs, 0/40 certified Gold phases** until evidence-producing tests are independently implemented and pass.

Do not overwrite the `gold:` keys with always-true values, disable strict mode, count plain existence of a screenshot, or merge the V4.3 release on the basis of Gameplay CI alone.
