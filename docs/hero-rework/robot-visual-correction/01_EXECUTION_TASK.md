# ROBOT OWNER VISUAL CORRECTION — EXECUTION TASK

## Start

Repository: `Khanh-glitch/APEX-CHAOS`

Authorized branch:
`director/robot-owner-visual-correction-20260929`

This branch was created from technical base:
`4c4e369614fd92df6e172d4b6b449d0837393823`

Read in full before editing:
1. `docs/agent-authority/VIBECODE_SKILL.md`
2. `docs/hero-rework/robot-visual-correction/00_OWNER_VISUAL_REJECTION_AND_CORRECTION_AUTHORITY_2026-09-29.md`
3. `docs/hero-rework/robot-final/00_ROBOT_FINAL_INTEGRATION_LOCK_2026-09-29.md`
4. `docs/hero-rework/robot-final/reference/ROBOT_VISUAL_AUTHORITY.html`
5. current `public/game/hero-rework/robotPresentationRuntime.js`
6. current Robot mechanic/event implementation

Verify the complete HTML SHA-256 is:
`bd0cc64fbeea94969fbef0b4bc4de690a19e85fafe93cb4a12c9b3accf095f75`

## Goal

Make the real-game Robot perceptually match the approved HTML motion/presentation while remaining integrated with real APEX physics, collision, weapons and damage.

This is not a redesign.

## Required correction order

### 1 — Freeze the chassis orientation
Remove movement/aim heading from the whole-body transform.
The base Robot world orientation remains fixed.
Preserve only authority-derived internal tilt/articulation/inertia.

Verify movement in at least four directions before continuing.

### 2 — Repair the weapon socket
Make the real held weapon position derive from the fixed HTML jaw/grip frame.
Audit/remove double positional recoil if present.
Weapon aim may rotate around the correct socket, but the weapon cannot orbit away from the Robot.

Verify with a real PISTOL acquired through the actual A1/equip pipeline.

### 3 — Repair A1 lifecycle and choreography
- synchronize recognize → commit → launch;
- start a fresh trail on each launch;
- never retain an old trail;
- contact only from real equip truth;
- reproduce HTML settle;
- fade trail after contact and turn it off at authority-equivalent timing;
- keep real physical dash/contact gameplay.

No generic route visualizer, giant lane, tunnel, historical trajectory or debug path.

### 4 — Repair Robot hit coordinate ownership
Classify every flash/spark/chip/dust/stress/pulse as local or world.
Convert exactly once.
No detached fragments or effects drifting because of mixed coordinate spaces.

### 5 — Repair A2 impact direction and motion
Pass/use actual incoming source direction.
Prove left and right controlled firearm hits produce corresponding structural force routing.
Keep HTML index → lock → active → release choreography.

### 6 — Repair Robot victim material
Robot-as-victim must not generate organic blood/splatter.
Mechanical Robot effects replace only Robot victim material.
Other heroes' blood system remains unchanged.

### 7 — Audit real audible SFX
Approved mapping remains exactly eight files.
Instrument requested / decoded / source-started separately.
Do not count a semantic SFX call as audible success.
Verify in real Chromium after audio unlock.

If an owner-approved cue is requested but not actually audible, fix its loading/playback lifecycle.
Do not add replacement files.

## Isolation rule

Use `ROBOT vs ICE`, AI disabled, no unrelated active skills for all five checkpoint proofs.

Do not use PAINTER for checkpoint captures.
The RED/BLUE/GOLD lanes and GOLD card are PAINTER presentation and are outside Robot correction scope.

## Required owner checkpoint output

Use the production build in a real browser.

Produce exactly five proof groups:

### 01 — idle/move fixed orientation
Show Robot translating in multiple directions without whole-chassis rotation.
Internal spring/inertia motion must remain visible.

### 02 — real weapon socket
Show actual PISTOL acquisition and several frames while moving/aiming/firing.
The weapon must remain attached to the approved jaw/grip.

### 03 — A1 full sequence
Capture enough frames or a short sequence to judge:
recognize → commit → launch → one clean trail → physical contact → settle.

### 04 — A2 full sequence
Capture:
index → structural lock → active → release.

### 05 — A2 controlled gunfire
Controlled PISTOL hit from the left and from the right while A2 is active.
Show correct mechanical reaction, no organic Robot blood, and no detached/noisy artifacts.

Also write one small JSON/MD table:

`event | requested | decoded | sourceStarted | file`

for:
- A1 lock
- A1 dash
- A1 no-weapon
- A2 activate
- A2 armor hit
- A2 end
- passive milestone (test-only threshold allowed)
- passive upgrade (test-only threshold allowed)

## Focused safety checks only

Before pushing checkpoint:
- production build passes;
- Robot R1-R9 remains green;
- real pickup/equip still works;
- real weapon fire still works;
- non-Robot blood still works;
- no second AudioContext.

Do NOT run/refresh the entire evidence catalog.
Do NOT regenerate unrelated browser evidence.
Do NOT run a giant final acceptance loop.

## STOP CONDITION

Once the five owner checkpoint proof groups + SFX table exist and the focused safety checks pass:

1. push the checkpoint commit to this branch;
2. report exact SHA and proof paths;
3. STOP.

Do not continue polishing.
Do not run full final regression.
Do not declare Robot final.
Wait for owner visual approval.
