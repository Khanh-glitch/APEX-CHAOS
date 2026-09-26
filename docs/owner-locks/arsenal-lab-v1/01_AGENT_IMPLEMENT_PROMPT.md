# AGENT START HERE — ARSENAL LAB V1

Repository: `Khanh-glitch/APEX-CHAOS`

## Required baseline

Fetch live Git first.

Prepared branch:
`arena/arsenal-lab-splatter-control`

Required base SHA:
`47578e9cf28bfd5abb329c86f2dcab99f8d5037b`

Read in full before touching code:
1. `docs/agent-authority/APEX_CHAOS_ZERO_CONTEXT_HANDOFF_2026-09-26.md`
2. `docs/agent-authority/VIBECODE_SKILL.md`
3. `docs/owner-locks/arsenal-lab-v1/00_READ_FIRST.md`

The owner-playtested branch `arena/01a0dc5e-apex-chaos@47578e9...` is FROZEN for comparison. Do not move or write to it.

If Arena pins this session to another session branch, that working branch must be a descendant of the prepared branch above. Do not mutate `playtest/arsenal`, and do not use `main`.

## Implement exactly this pass

### A. ARSENAL LAB
Add a fifth Arsenal Hub tile: `ARSENAL LAB`.

Entering Lab:
- directly starts real NEWBIE vs NEWBIE;
- both have infinite health without bypassing the real damage/VFX/status path;
- no KO/result/reward/progression;
- NO automatic weapon spawn;
- NO emergency firearm spawn;
- NO heal spawn;
- no click means zero pickups forever.

Add a responsive in-battle equipment panel sourced from the real `CFG.P0_WEAPON_IDS`.

Tap/click one equipment:
- spawn exactly one pickup of that exact ID;
- use a valid existing spawn point;
- spawn directly REVEALED;
- bypass rarity/random choice and telegraph wait;
- after that, use the real pickup/equip/fire/throw/hit/consume pipeline.

This must make STORMBREAKER repeatably testable on demand.

### B. SPLATTER MODE
Add persistent two-state Arsenal setting:
- BLOOD = current exact crimson look;
- FIGHTER COLOR = splatter hue derives from the VICTIM fighter's color.

Apply to both:
- V1 firearm blood;
- legacy/non-firearm splatter.

Do not alter blood geometry, counts, physics, lifetimes, stains, performance caps, or damage popup semantics.

Expose the toggle from Arsenal Hub.

### C. STORMBREAKER FLOOR POSE
Only while unclaimed/revealed on floor:
- STORMBREAKER lies horizontally.
- do not rotate held/windup/flight/impact poses.
- keep floor-local VFX anchor origins synchronized to the same floor rotation.

### D. DO NOT FIX STORMBREAKER VFX YET
Owner feedback about missing weapon-body lightning and prototype mismatch is deliberately deferred.

Do not change:
- lightning density;
- circle/aura;
- active-link design;
- flight ghosts;
- impact;
- spawn pulse cadence;
- VFX pools/caps;
- rarity;
- slow;
- damage;
- stun;
- SFX.

The owner authority records a likely `rec.activeLinks` draw-path issue for the NEXT pass. Leave it alone now.

## Verification

Add focused headless + real-browser gates for:
- Lab entry and 2x NEWBIE;
- 30s no-input => zero spawns;
- exact manual firearm spawn;
- exact manual STORMBREAKER spawn;
- real pickup/attack/hit path in Lab;
- infinite HP with real feedback and no KO/rewards;
- BLOOD/FIGHTER COLOR persistence and victim-color correctness;
- horizontal floor Stormbreaker + unchanged held/flight orientation;
- all existing suites still green.

Run the full existing headless suite, browser suite and production build.

Do not claim success from prose. Report:
- starting branch/SHA;
- final branch/SHA;
- exact files changed;
- new gates;
- full regression counts;
- screenshots/evidence for Lab desktop/mobile, splatter both modes, and horizontal Stormbreaker floor pose;
- any remaining issue.

Do not promote production. Stop for owner playtest.
