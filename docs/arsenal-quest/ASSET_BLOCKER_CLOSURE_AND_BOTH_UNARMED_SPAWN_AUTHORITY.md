# APEX CHAOS — ASSET BLOCKER CLOSURE + BOTH-UNARMED IMMEDIATE SPAWN AUTHORITY

**Date:** 2026-09-25
**Game repo:** `Khanh-glitch/APEX-CHAOS`
**Authorized branch:** `arena/01a0cf5e-apex-chaos`
**Asset-ready baseline:** `c87ecf9a8e877321f8af48b6a25c112b719f18bd`

This authority is a focused continuation of the existing Full Feel + Smoothness run.
It does **not** authorize a redesign or rebuild of accepted Arsenal / Revision 2 systems.

## 0. Single-repo law

The Arena Agent works only in the game repo.

The previously blocked Asset Vault binaries have already been bridged into this branch.
Do **not** clone, inspect, or modify `APEX-CHAOS-ASSET-VAULT` during implementation.
Do not substitute new assets for the bridged approved sources.

Exact bridged game-repo files:

- `public/assets/arsenal/feel/damage/damage1.png`
- `public/assets/arsenal/feel/heals/heal_t1_field_dressing.png`
- `public/assets/arsenal/feel/heals/heal_t2_medication.png`
- `public/assets/arsenal/feel/heals/heal_t3_autoinjector.png`
- `public/assets/arsenal/feel/heals/heal_t4_iv_pack.png`
- `public/assets/arsenal/feel/heals/heal_t5_trauma_case.png`
- `public/assets/arsenal/av/sfx/source/sound-effect-recharge-gun.wav`
- `public/assets/arsenal/av/sfx/source/Rifle Reload Sound Effect.mp3`
- `public/assets/arsenal/av/sfx/source/318964__gryffdavid__bouncing-shell-casings-various-sizes.wav`
- `public/assets/arsenal/av/sfx/source/620929__metrolynn__empty-shotgun-shellscasings-hitting-ground-bouncing.wav`

These exact Git blob identities were already verified during bridge:
- damage atlas: `1a68a295b13a02d53b37ccf499df76a6d1f8f777`
- H1: `61caf3a67180f509aeec5c373524ad831efeec05`
- H2: `189c6efcfdce760a1d08ee196d65cc417b689382`
- H3: `d2261aaa79218694ed994589ec4acd7859ba347e`
- H4: `b36529387c7bb16593daf5ed27eb1412b33a9899`
- H5: `5467212915df33bd0ec10d3e8ef7a42f758940bb`
- pistol ready master: `51aa3a8a5932f25addde137721c1ac5f66014f2a`
- rifle/SMG master: `7c910d0f574d8c60ea75b5cfc172910d0af0e266`
- general casing master: `8a897b84936bcba3c372832954f195a19acfe922`
- shotgun shell master: `1d9a54dc15c7eee11c892c1d68b766eee612fe52`

## 1. Read before editing

Read in full:
- `docs/arsenal-quest/FULL_FEEL_AND_SMOOTHNESS_IMPLEMENT.md`
- `docs/arsenal-quest/GUN_PICKUP_READY_AND_CASING_AUDIO_AUTHORITY.md`
- `docs/arsenal-quest/LIGHT_FLOOR_DAMAGE_SPLATTER_AUTHORITY.md`
- this file

Then audit the current runtime. Preserve already-correct accepted work. Do not duplicate or rebuild a feature merely because the original runbook describes it.

## 2. Task A — close only the asset-dependent blockers

The Full Feel implementation already landed before these masters became locally available.
Now complete or verify the portions that were previously blocked/fallback-backed.

### 2.1 Damage atlas
- Use the bridged canonical `damage1.png`.
- Verify the real runtime renderer resolves it, not a placeholder or missing-file path.
- Preserve the current bounded/poolable damage-number architecture and MISS = text-only law.
- Do not revive legacy Arsenal FloatingText.

### 2.2 Heal visuals
- Preserve exact H1–H5 identities and silhouettes.
- Produce/use appropriately sized runtime derivatives if needed rather than expensive repeated master scaling.
- Verify the five identities are actually resolvable/renderable in runtime plumbing.
- **Keep `healGameplayEnabled=false` unless an authoritative exact five-value restore table is found.**
- Current source/history/docs/issue #8 have not established such a table. Do not invent values.
- Missing heal values must not block unrelated completion.

### 2.3 Pistol pickup-ready cue
- Inspect the real bridged `sound-effect-recharge-gun.wav`.
- Derive a concise, clean mechanical pickup-ready one-shot.
- Use it for the pistol family defined by the existing audio authority.
- Replace prior fallback behavior where applicable.
- Cue fires once on actual pickup, never reveal/telegraph, and does not delay gameplay.

### 2.4 SMG / rifle pickup-ready cues
- Inspect the real bridged `Rifle Reload Sound Effect.mp3` waveform/audio.
- Owner observation: useful separated high-amplitude mechanical clusters begin approximately after 15 seconds.
- Derive actual clean one-shot transients from the real source; **do not invent timestamps**.
- Maintain `docs/arsenal-quest/GUN_PICKUP_AUDIO_CUT_MAP.csv` with exact measured cuts.
- Preserve family assignment law:
  - MAC_10 / MP5 / P90: lighter/shorter/sharper
  - AK_47 / M16 / Z15 family: medium rifle
  - MBR / MBR2 / M249 / SZECSEI_FUCHS: fuller/heavier
  - Z15 cosmetics share base Z15 cue
- Do not use Snipex bolt identity for ordinary rifles.

### 2.5 Casing / shotgun-shell contacts
- Inspect the two real bridged casing masters.
- Derive short contact one-shots; do not play long masters directly.
- Shotgun family uses shotgun-shell source.
- All other firearms use general casing source.
- First meaningful floor contact only.
- At most once per casing/hull.
- No landing sound at creation.
- Later bounce does not replay.
- Preserve bounded polyphony.
- Remove any remaining semantic/fallback false-positive where runtime claims a casing event but resolves only to the old generic plate fallback.

### 2.6 No gun-body drop SFX
Do not add one. Owner explicitly abandoned it.

### 2.7 Asset bookkeeping
Update runtime manifests/provenance/cut-map entries required by the existing repository architecture.
Do not modify Asset Vault.

## 3. Task B — new owner gameplay law: both-unarmed immediate spawn

Baseline normal offensive pickup cadence remains exactly `3.0s`.

Add one fast-path rule:

> When both living fighters enter a state where neither is holding a weapon/offensive pickup, trigger one immediate normal pickup spawn, then restart the normal spawn timer from a fresh 3.0-second period.

### Required semantics

1. **Match start counts.**
   If both fighters start unarmed, the first normal pickup should spawn immediately rather than waiting for the old first-delay/cadence timer.

2. **State-transition fast path.**
   If at least one fighter was armed and later both living fighters become unarmed, spawn one pickup immediately, even if the normal timer still had time remaining.

3. **Reset timer after successful fast-path spawn.**
   After that immediate spawn succeeds:
   `spawnTimer = SPAWN_CADENCE_SECONDS`
   so the next timer-driven spawn is a fresh ~3.0s later.

4. **Do not spam every frame.**
   Continuous both-unarmed state is not a new trigger every tick.
   The fast path is edge/state-transition driven.
   After the immediate spawn, normal 3.0s cadence continues even if both fighters remain unarmed.

5. **Re-arm correctly.**
   Once either fighter becomes armed, the both-unarmed fast path may trigger again the next time both become unarmed.

6. **Exactly one spawn for a same-tick transition.**
   If the normal timer also reaches zero on the same tick as a both-unarmed fast-path event, do not produce two pickups. The fast-path spawn/reset wins for that transition.

7. **Preserve existing spawn system.**
   Use the existing normal offensive pool, rarity probabilities, melee weighting, reveal logic, spatial placement, slot cap/safety rules, and telemetry. Do not create a second spawn implementation.

8. **Slot-cap safety remains authoritative.**
   Do not bypass `MAX_ACTIVE_SLOTS` merely to satisfy the fast path. If the existing spawn API suppresses due to cap, do not create an illegal extra slot. Handle the pending condition without per-frame spawn/log spam and without fabricating a successful reset.

9. **No behavior after match over / dead-pair edge cases.**
   Apply the rule to the two living active fighters while the match is live. Do not create post-KO pickups.

## 4. Verification gates for Task B

Add real automated coverage in both headless and browser/runtime suites where appropriate.

At minimum prove:

- fresh match: both unarmed -> exactly one immediate spawn;
- immediate spawn occurs before the former first-delay would expire;
- timer resets to exactly the normal 3.0s cadence after successful fast spawn;
- remaining both-unarmed for <3.0s does not cause repeated immediate spawns;
- normal cadence still produces the next timer spawn around 3.0s later;
- arm one fighter, then return to both-unarmed before timer expiry -> exactly one new immediate spawn + timer reset;
- same-tick timer-expiry + both-unarmed transition -> one spawn, not two;
- one fighter armed -> no fast-path spawn;
- existing spawn cap is not violated;
- Quest and free-play share the correct behavior through the existing Arsenal runtime.

Tests must prove runtime behavior, not only inspect a config flag.

## 5. Non-negotiable regression protection

Do not change:
- weapon balance/damage;
- tier probabilities;
- 30-offensive-item roster;
- melee weights or +50% law;
- shield contextual-only law;
- Quest progression;
- skill gating;
- accepted Chamber/light-floor work;
- damage splatter behavior;
- damage popup aggregation/MISS law;
- rarity visuals;
- performance quality law;
- VFX/SFX perceptual quality;
- `main`;
- `playtest/arsenal`.

Do not lower effect counts, resolution, audio quality, animation FPS, or gameplay cadence for performance.

## 6. Execution discipline

Before editing:
1. fetch remote;
2. verify current Arena tip is this authority commit or a compatible descendant;
3. inspect the diff from asset-ready baseline `c87ecf9a8e877321f8af48b6a25c112b719f18bd`;
4. read authorities in full;
5. audit existing implementation and modify only what is actually missing/wrong.

Then:
- implement Task A + Task B;
- run headless;
- run Vite build;
- run full real-browser suite;
- add anti-false-positive runtime evidence for the new asset paths/audio and spawn law;
- push clean implementation/evidence commits to the Arena branch.

Do not stop for another planning cycle unless a genuine blocker exists.

## 7. Final report

Return:
- fetched starting SHA;
- implementation SHA(s);
- evidence SHA if separate;
- CI run id/status;
- headless pass count;
- browser pass count;
- Vite build status;
- exact derived audio files;
- exact rifle cut timestamps and assignments;
- casing derivative/source mapping;
- confirmation the 5 heal assets resolve correctly;
- heal gameplay status and whether exact restore values were found;
- exact both-unarmed spawn behavior and tests;
- genuine blockers only.

Do not promote `playtest/arsenal`.
Do not modify `main`.
