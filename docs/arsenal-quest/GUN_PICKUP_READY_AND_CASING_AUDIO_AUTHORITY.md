# APEX CHAOS // GUN PICKUP READY SFX + CASING AUDIO AUTHORITY

**Date:** 2026-09-25
**Game branch:** `arena/01a0cf5e-apex-chaos`
**Asset source repo:** `Khanh-glitch/APEX-CHAOS-ASSET-VAULT`
**Asset source ref:** `main@c8e04857025507064aa02a6dbb2a76198cc0a21b`
**Status:** OWNER-FROZEN DIRECTION

This authority supersedes the gun-drop-SFX portion of `POST_PASS1_NEXT_EXECUTION_PLAN.md`.

## 0. Owner decision

Do **not** add gun-body floor/drop SFX for detached weapons in this pass.

Instead, make gun pickup feel tactile by replacing the current light generic pickup click with a weapon-family **ready/chamber/reload mechanical cue**.

These cues are presentation feedback only:
- they play once when a gun is actually collected;
- they do not delay attack/gameplay;
- they do not change weapon timing/balance;
- they do not play at TELEGRAPH/REVEAL;
- melee/grenade/shields retain their existing pickup language unless separately changed.

For gun pickups, avoid layering the old generic `metalLatch` pickup click on top of the new ready cue unless an audition proves a very low-volume layer helps. Default: new gun-ready cue replaces it.

---

# 1. Source assets now present in Asset Vault main

## Pistol pickup source

`sound-effect-recharge-gun.wav`

Audited format:
- PCM WAV
- 44.1 kHz
- 16-bit
- stereo
- 2.576 s source master

Use as the pistol-family source. Do not necessarily play the full 2.576 s file; derive a concise ready cue around the strongest clean mechanical action.

## SMG / rifle source master

`Rifle Reload Sound Effect.mp3`

Owner inspected the waveform and explicitly identifies the useful region as:

**from ~15.0 s onward**

From that point onward, each separated high-amplitude waveform cluster represents a different usable mechanical sound/take.

Required processing:
1. ignore the earlier section for pickup-ready derivation;
2. detect/isolate each distinct transient cluster from ~15 s onward;
3. create individually trimmed one-shot derivatives;
4. preserve short natural mechanical tails;
5. remove long surrounding silence / unrelated actions;
6. add only very short anti-click fades at boundaries;
7. do not aggressively denoise/EQ/compress into a synthetic sound;
8. loudness-match the derivatives conservatively.

Do not overwrite the source master.

## General casing source

`318964__gryffdavid__bouncing-shell-casings-various-sizes.wav`

Use as the source master for **all non-shotgun firearms**.

Derive short individual casing-land one-shots; never play the long source recording as one event.

## Shotgun shell source

`620929__metrolynn__empty-shotgun-shellscasings-hitting-ground-bouncing.wav`

Audited:
- PCM WAV
- 44.1 kHz
- 16-bit
- stereo
- 2.267 s source master

Use only for shotgun-family shell/hull floor contact.

---

# 2. Shotgun pickup ready cue — use the existing original SHOTGUN fighter audio

Do not import a new shotgun ready sound.

Original game SHOTGUN assets include:

`public/assets/shotgun_v1/audio/special_reloading_after_use_the_dash_skill.wav`

Audited:
- PCM WAV
- stereo
- 44.1 kHz
- 16-bit
- 2.430 s

The strongest mechanical activity is concentrated early in the source, with strong envelope windows around ~0.10–0.70 s.

This is preferred over:
- the 7-second full `reloading_batch_7s.wav`;
- newly sourced external shotgun audio.

Create a concise pickup-ready derivative from the first complete mechanical reload/chamber gesture of this original SHOTGUN sound.

Do not use the whole 2.43 s source if it contains multiple gestures or dead tail.

Applies to shotgun family:
- MOSSBERG_500
- SHOTGUN / SPAS12
- SAWED_OFF
- JACKHAMMER

The pickup cue is shared family language. Existing per-weapon firing/mechanism behavior remains unchanged.

---

# 3. Sniper pickup ready cue — move the existing Arsenal mechanical language to pickup

Current Arsenal already contains:

`public/assets/arsenal/av/sfx/c-final/SNIPER/sniper_chamber.wav`
- 48 kHz mono PCM
- 0.920 s

`public/assets/arsenal/av/sfx/c-final/SNIPER/sniper_bolt_lock.wav`
- 48 kHz mono PCM
- 0.600 s

Current code schedules:
- `sniper_chamber` at `sniper_aim`;
- `sniper_bolt_lock` later during the aim/flourish before the shot.

There is no literal post-shot mechanical cue in the audited code; the owner perceives this existing mechanical sequence as the sniper reload/readiness sound.

Required presentation change:
- relocate the sniper readiness/mechanical identity to the moment SNIPER is actually picked up;
- do not duplicate the same full mechanical sequence again during the shot cycle.

Preferred implementation:
- pickup: play `sniper_chamber` as the primary ready cue;
- optionally use the useful lock transient from `sniper_bolt_lock` as a short second beat if normal-speed audition is better;
- remove/suppress the corresponding duplicated pre-shot chamber/lock cue(s) so pickup owns the readiness read.

The firing shot itself remains unchanged.

Applies:
- SNIPER / Snipex Alligator

Do not reuse this bolt cue on ordinary rifles/SMGs.

---

# 4. Pistol family mapping

Use a concise derived cue from:

`sound-effect-recharge-gun.wav`

Applies:
- PISTOL / Colt
- GLOCK_17
- TEC_9
- BERETTA_93R
- DESERT_DEAGLE
- MAGNUM_500

The revolver may eventually deserve a dedicated cylinder/cock identity, but that is not required in this pass. Do not source another file now.

---

# 5. SMG / rifle slice assignment

The owner wants the multiple distinct transients after ~15 s in `Rifle Reload Sound Effect.mp3` to be actively used rather than reducing the source to one generic sound.

## Extraction stage

Create an ordered derived set:

`rifle_take_01`
`rifle_take_02`
`rifle_take_03`
...

for every clean isolated post-15s mechanical transient judged usable.

Record for every derivative:
- source start time;
- source end time;
- duration;
- peak/RMS or equivalent level metric;
- derived filename.

Do not invent exact cut points before inspecting the source in the implementation workspace.

## Assignment rules

### SMG
- MAC_10
- SMG / MP5
- P90

Prefer shorter/lighter/sharper derived takes.

Give these three weapon identities distinct takes when at least three clean slices exist.

### Standard rifle
- AK_47
- M16
- ZBROYAR_Z15
- ZBROYAR_Z15_S1
- ZBROYAR_Z15_S2
- ZBROYAR_Z15_S3

Prefer medium mechanical takes.

**Z15 skins must use the same ready cue as base Z15** because they are cosmetic-only variants.

AK and M16 should use different takes if the source provides enough clean slices.

### Heavy / precision rifle family
- MBR
- MBR2
- M249_SAW
- SZECSEI_FUCHS

Use the remaining fuller/heavier rifle-source takes where suitable.

Do not use the Snipex bolt cue here.

If there are fewer usable source transients than weapon identities:
- reuse a clean take within the same family;
- tiny bounded playback-rate variation is allowed;
- do not create fake uniqueness through extreme pitch shifting.

If there are more good takes than needed, preserve them as alternate variants for later randomized pickup seasoning.

---

# 6. Casing / shell landing mapping

This replaces the current generic impact-plate placeholder.

## Shotgun-only shell sound source

Use:
`620929__metrolynn__empty-shotgun-shellscasings-hitting-ground-bouncing.wav`

for casing/hull land events belonging to:
- MOSSBERG_500
- SHOTGUN / SPAS12
- SAWED_OFF
- JACKHAMMER

Derive one or more short shell-contact one-shots.

## Every other firearm

Use:
`318964__gryffdavid__bouncing-shell-casings-various-sizes.wav`

for all non-shotgun casing/hull land events.

Derive several short one-shots if the source contains clearly different casing sizes/contacts, then rotate within the general casing family with bounded polyphony.

## Semantic bug that must be fixed

Current presentation bank defines:
`casing_drop`

but floor-contact runtime calls:
`casing_land`

Therefore the existing actual landing sound path can be silent despite instrumentation.

Use canonical runtime semantics:
- `casing_land`
- `shotgun_shell_land` (or equivalent explicit shotgun family semantic)

No audio at casing creation.
First meaningful floor contact only.
At most once per casing/hull.

---

# 7. Runtime behavior

Gun pickup event:
1. actual pickup resolves;
2. existing weapon becomes equipped;
3. family-specific ready cue triggers once;
4. gameplay continues without waiting for audio.

Do not add artificial reload delays.

Recommended max useful pickup cue lengths:
- pistol: ~0.2–0.6 s
- SMG: ~0.15–0.45 s
- rifle: ~0.20–0.55 s
- shotgun: shortest complete original SHOTGUN mechanical gesture, target <~0.8 s
- sniper: chamber/lock identity may run longer, but should not mask the shot if attack begins quickly

If attack can occur before a pickup cue finishes:
- do not delay the attack;
- use voice mix/ducking or trim the pickup cue instead.

---

# 8. Validation

Automated/instrumented:
- one gun pickup => exactly one family-ready transaction;
- no gun-ready cue on TELEGRAPH or REVEAL;
- pistol source mapping correct;
- SMG/rifle derived-slice mapping correct;
- Z15 skins identical to Z15;
- shotgun pickup uses original SHOTGUN fighter source derivative;
- Snipex pickup uses existing sniper mechanical source;
- duplicated sniper pre-shot readiness cue is removed as intended;
- shotgun casing uses shotgun source only;
- all other firearm casing uses general casing source;
- casing creation plays no land sound;
- first floor contact plays one;
- later bounces do not replay it.

Real-browser normal-speed owner audition is mandatory.

Do not claim subjective sound quality from waveform/test instrumentation alone.

---

# 9. Non-scope

Do not add gun-body drop/floor SFX.
Do not source additional weapon-ready audio.
Do not rebalance weapons.
Do not change fire cadence or pickup-to-attack gameplay timing.
Do not move `playtest/arsenal`.
Do not modify game `main`.
