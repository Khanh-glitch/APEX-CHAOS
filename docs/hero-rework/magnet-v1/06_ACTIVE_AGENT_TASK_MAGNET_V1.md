# ACTIVE AGENT TASK — MAGNET V1

Implement MAGNET V1 end-to-end from the prepared preload. Do not redesign MIRROR; it must ship in the same integration batch with its existing gameplay unchanged.

## Start
You are on an Arena-assigned `arena/*` branch.

1. Fetch `magnet-v1-preload-20261001` and `main`.
2. Run:
   `node tools/preflightMagnetOneShot.mjs`
3. If preflight proves anchoring safe:
   `node tools/preflightMagnetOneShot.mjs --anchor --push-anchor`
4. Verify your Arena remote branch SHA equals local HEAD.
5. Read every file in `docs/hero-rework/magnet-v1/` in README order, canonical Gold included.
6. Re-audit the relevant live runtime before editing.

Do NOT push implementation to the preload branch.

## Hard authority
Baseline:
`5411906a741f87d637ee20535c82e96b866d4ab2`

Canonical Gold:
`docs/hero-rework/magnet-v1/gold/MAGNET_FINAL_DONOR_MAX.html`
SHA-256:
`468f7b2aa34588c2c52bf23fb5202c507ff5d584d423ea9f1a9232d751247d8b`

Gameplay:
`00_MAGNET_IMPLEMENTATION_AUTHORITY.md`

Gold adaptation:
`01_GOLD_TO_GAME_ADAPTATION_MAP.md`

Tests:
`02_IMPLEMENTATION_TEST_MATRIX.md`

Process lessons and negative evidence:
`07_PROCESS_LESSONS_ROBOT_TO_FROST.md`
`08_PRELOAD_HOSTILE_AUDIT.md`

Mirror freeze:
`09_MIRROR_COLOAD_LOCK.md`

## Architecture target
Prefer:
- `magnetGameplayRuntime.js` — gameplay truth / one-world-step field composition;
- `magnetGoldV1.js` — Gold-derived presentation engine;
- `magnetPresentationRuntime.js` — thin real-game -> Gold adapter;
- thin Magnet executors in `heroMechanicsRuntime.js`;
- the narrowest global projectile/world hook in `heroReworkRuntime.js`;
- pre-baked assets under `public/assets/hero-rework/magnet-v1/`.

Do not force this exact filename split if live source proves a smaller equivalent is safer, but preserve the authority boundaries.

## Execution behavior
Gameplay first, then Gold, then adapter, then integration/evidence.
After each small coherent slice:
diff -> smallest relevant test -> commit -> push -> verify remote SHA -> continue.

Do not ask the owner to approve ordinary engineering checkpoints.
Do not stop simply because a task UI asks "successful?" if independent work remains.
If auth/push verification fails, STOP coding until durability is restored.

## Non-negotiable
- all floor guns A1, not nearest-one;
- A1 cast works with zero current gun;
- late reveal joins active field;
- real persistent velocity/momentum;
- A1 bullet radius 480;
- A2 radius 225;
- final force numbers/falloffs exactly from authority;
- passive firearm bullet x1.18 once;
- T6 immunity;
- no held-gun disarm by A2;
- one floor-gun integration per world step even with two Magnets;
- gameplay force immediate, visual ramp only presentation;
- Gold passive prep must not delay real shot;
- real APEX hitbox, not Gold demo multipart circles;
- exact Reference-A identity;
- sparse Gold A2, no generic bubble;
- fixed 1/120 presentation springs/history;
- isolated render state;
- MIRROR mechanics unchanged.

## Finish
Run focused + protected + broad regression, real browser evidence, build, cleanup, relock final runtime revision, push and remote-verify exact final SHA.
Return one final report. Do not claim owner visual acceptance before the owner plays the build.
