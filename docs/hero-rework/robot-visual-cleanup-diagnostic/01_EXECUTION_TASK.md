# ROBOT VISUAL CLEANLINESS + SHARPNESS — EXECUTION TASK

## Start

Repository:
`Khanh-glitch/APEX-CHAOS`

Read-only authority branch for this task:
`director/robot-visual-cleanup-diagnostic-20260929`

Expected authority HEAD:
`17b59ab858711bdc9719f7429ba563cb7d94d2ad`

Visual checkpoint implementation base:
`b869d2b138fed5347043231a821d31daa7d3c4be`

Arena execution rule:
- remain on the fixed `arena/<session>` branch;
- fetch the authority branch;
- verify exact authority HEAD;
- hard-reset only the disposable Arena session branch to that exact HEAD;
- never write directly to the director branch;
- do not merge `main`;
- do not preserve unrelated session ancestry.

Before edits, read completely:

1. `docs/agent-authority/VIBECODE_SKILL.md`
2. `docs/hero-rework/robot-visual-cleanup-diagnostic/00_AUTHORITY_2026-09-29.md`
3. `docs/hero-rework/robot-visual-correction/00_OWNER_VISUAL_REJECTION_AND_CORRECTION_AUTHORITY_2026-09-29.md`
4. `docs/hero-rework/robot-visual-correction/01_EXECUTION_TASK.md`
5. `docs/hero-rework/robot-final/reference/ROBOT_VISUAL_AUTHORITY.html`
6. current `public/game/hero-rework/robotPresentationRuntime.js`

Verify golden HTML SHA-256:
`bd0cc64fbeea94969fbef0b4bc4de690a19e85fafe93cb4a12c9b3accf095f75`

## Non-negotiable scope

The owner has already accepted the direction of the corrected motion. This pass is NOT allowed to redesign or reopen:
- body orientation;
- A1 choreography;
- A2 choreography;
- weapon socket behavior except if a mask/sampling defect is proven;
- gameplay numbers;
- SFX mapping;
- other heroes.

This pass answers only:
- edge/noise/cutout cleanliness;
- production sharpness vs HTML.

## Phase A — diagnose before modifying production

Run the full diagnostic protocol from `00_AUTHORITY_2026-09-29.md`.

Do not edit production rendering until the diagnostic can name the cause.

Required comparisons:

### A1. Background matrix
Same Robot state on:
- near-black;
- neutral gray;
- near-white.

States:
- idle;
- A2 locked;
- immediate controlled projectile impact.

### A2. Edge crops
Produce labeled 4x inspection crops for:
- both outer calipers;
- cheek/chin boundary;
- both pivot boundaries;
- crest/core slot;
- eye/socket;
- impact-side edge.

### A3. Impact isolation
Same deterministic hit:
- normal production mechanical world effects;
- diagnostic-only hidden world particles while retaining Robot rig/local stress/flash.

Never commit a production “disable particles” shortcut.

### A4. Matched-size sharpness comparison
Launch both:
- approved HTML;
- production APEX.

Use the same Chromium version, viewport and DPR.

Match the Robot's physical on-screen size as closely as practical.

Capture at:
- DPR 1;
- DPR 2.

Record actual display size/backing pixels.

### A5. Production render candidates
Test without changing game scale:

A — current production.

B — Robot-only supersampled/offscreen render at 2x effective backing resolution.

C — adaptive DPR capped at 2 only if it adds useful evidence beyond B.

Do not alter the whole APEX canvas.

## Phase B — decision

Classify every artifact using the authority taxonomy.

Then decide independently:

### Edge/artifact
- If no reproducible mask/fringe/cut defect exists: do not modify production for it.
- If reproducible: fix the exact mask/compositing cause only.

### Sharpness
- If matched-size A/B shows no meaningful gain: keep current rendering.
- If the Robot-only supersampled path is materially cleaner at normal scale and stable in motion: implement it.
- Do not “fix” by filters, heavier outlines, contrast, nearest-neighbor, or arbitrary SR increase.

## Phase C — movement stability

If any production render change is applied, record real movement.

Reject your own change if it introduces:
- shimmer;
- crawling outlines;
- layer registration jitter;
- aliasing;
- material appearance drift from HTML;
- meaningful frame-time regression.

## Output package

Write only:

`docs/hero-rework/robot-visual-cleanup-diagnostic/`

with:
- README.md
- background-matrix/
- edge-crops/
- impact-isolation/
- sharpness-ab/
- sharpness-metrics.json
- movement-stability.webm only if production changed
- decision.json

Do not refresh unrelated evidence.

## Focused validation

After diagnosis and any justified fix:

1. production build PASS;
2. Robot R1–R9 PASS;
3. body remains fixed-world-facing;
4. A1 fresh-trail invariant remains;
5. real PISTOL socket remains attached;
6. A2 left/right source routing remains;
7. Robot blood remains suppressed and non-Robot blood preserved;
8. one AudioContext;
9. real-browser cleanup check has no runtime errors.

No repository-wide regression marathon.

## Completion / STOP

Push exactly one diagnostic checkpoint commit to the Arena session branch.

Report:
- session branch;
- starting authority SHA;
- final commit SHA;
- whether artifact defect was proven;
- whether sharpness defect was proven;
- whether production code changed;
- exact cause if changed;
- proof paths;
- focused gate results.

Then STOP.

Do not call Robot final.
Do not continue polishing.
Wait for owner review.
