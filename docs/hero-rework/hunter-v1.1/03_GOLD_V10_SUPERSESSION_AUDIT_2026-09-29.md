# HUNTER GOLD V10 SUPERSESSION AUDIT — 2026-09-29

Status: OWNER-SUPPLIED GOLD UPDATE. This document supersedes the V9 source identity wherever they conflict.

## Exact source identity

New owner Gold attachment:

`HUNTER_ALT_FINAL_V10_EXACT_ROOT_TRAP(1).html`

Verified properties:
- SHA-256: `447cf549cceb955459eda4b74ef5a561c77fc2f574252783bc7921663578ae65`
- bytes: 3,671,159
- logical lines: 3,209

Previous V9 source (SUPERSEDED):
- `HUNTER_ALT_FINAL_V9_ROOT_TRAP_SAFE_P(1).html`
- SHA-256: `c8cde28f346bbbd99de0c448ccfb396eae210e4928436850ef82b488d765fc88`

The new file still contains stale embedded labels such as `HUNTER FINAL V9 ROOT TRAP`, `FINAL V9`, and a patch comment named `FINAL V7 PATCH`. Those embedded labels are historical text inside the prototype. They DO NOT downgrade or invalidate the V10 attachment. The exact filename + SHA-256 above is the authority identity.

## Byte-level semantic audit against V9

The following owner-visible motion/gameplay-demo functions are byte-identical between V9 and V10:

- `startA1()`
- `updA1(dt)`
- `plantTrap()`
- `updateTrap(dt)`
- `startA2()`
- `updA2(dt)`
- `startDodge()`
- `updDodge(dt)`
- SAFE PASSIVE projectile start/update overrides

Therefore the prior production mapping decisions remain valid:
- A1 body deploy/plant/recover timing stays Gold-owned;
- fixed demo world-left recoil still maps to opposite pre-cast locomotion direction in APEX;
- A2 Gold choreography remains compressed into the owner-approved 0.16s production prelaunch envelope;
- A2 production still uses continuous live-target chase and real swept contact;
- Killer Instinct gameplay still resolves eligibility/RNG/lockout/T6 before visible dodge.

Do NOT reinterpret V10 as a gameplay rebalance.

## What actually changed in V10

V10 materially replaces the ROOT trap PRESENTATION renderer/state layer.

The embedded `ROOT_TRAP_ART` source-art payload itself is byte-identical to V9. The visual change comes from how that same segmented art is transformed, layered, lit and animated — not from a new trap image set.

### 1. Late additive trap material pass

The stage now draws a dedicated trap `fx` pass after the normal additive particle pass and before local distortion/bloom/grade.

Production layering must preserve the same perceptual hierarchy:
- trap base/core behind prey;
- trap blades/front geometry in front where they visually pin;
- trap emissive/material effects in a late additive pass;
- then the existing APEX-compatible distortion/bloom/camera pipeline.

Do not flatten the trap into one draw layer if that destroys the pin/depth read.

### 2. Exact segmented ROOT material layers

V10 keeps the segmented ROOT source art but now derives per-part:
- color
- edge
- glow
- shadow
- sweep scratch

from the source alpha/material data.

The edge/glow/shadow behavior is part of the V10 Gold appearance. Do not fall back to generic circles/orbs/outlines.

### 3. Second-order articulated trap dynamics

V10 replaces the older simple trap springs with a dedicated second-order `RT_SO` system and phase-specific frequency/damping/response tuning.

The trap must no longer be approximated as one globally scaling object.

V10 Gold uses:
- independent root joint motion;
- independent blade joint motion;
- independent root scale motion;
- core scale / vertical kick response;
- phase-specific spring tuning.

### 4. V10 trap phase presentation law

Preserve the V10 state language:

UNFOLD
- compact start;
- physical core kick;
- three arms unfold with staggered offsets;
- blade/root locks arrive progressively.

ARMED
- clean open pose;
- restrained core-slot life;
- intermittent travelling material sweep;
- no permanent generic glowing orb.

TENSION
- structure loads/tightens before closure.

SNAP
- short tense hold then hard transition toward closed geometry.

PIN
- closed prey-pinning structure;
- periodic small mechanical pulls/jitter;
- intermittent tension sweeps;
- joint/slot light responds to clamp tension rather than staying constantly overbright.

RELEASE
- brief closed hold;
- mechanical burst-open phase;
- compact retract;
- controlled fade/cleanup.

### 5. V10 exact-root scale behavior

The V10 renderer no longer uses the old V9 whole-trap `T.scale.x` multiplier for its final material geometry. The ROOT visual scale is structurally stable while internal core/joint springs supply the motion.

Do NOT reintroduce the V9 global squash/grow behavior merely because old trap state still exposes `scale` fields.

Production may map the Gold's overall local size into APEX world scale once, but must preserve V10's internal relative geometry and avoid an extra global animated scale that changes the silhouette.

## Multiple-trap production performance law

V10's `rtDeriveLayers()` performs nontrivial image-data work (alpha scan, edge-distance passes, dilation, generated edge/glow/shadow canvases).

With Hunter A1 now supporting three simultaneous traps:

- source images must decode once;
- derived color/edge/glow/shadow material layers must be generated/cached once per immutable source part;
- three trap instances MUST NOT each rerun `getImageData` / dilation / material derivation;
- trap instances own only their independent mutable animation/state;
- shared mutable scratch used for travelling sweeps is allowed only if rendering is strictly serial and cannot leak one trap's state into another; otherwise use bounded lightweight per-instance scratch;
- visual RNG used for pin jitter/pull is presentation-only and must never feed gameplay truth.

## V10-specific proof requirement

In addition to the existing Hunter proof package, owner review must clearly show at normal game scale:

1. one trap full lifecycle: unfold -> armed -> tension -> snap -> pin -> release;
2. clean ARMED trap with no permanent generic orb;
3. real opponent trigger driving the V10 snap/pin;
4. PIN mechanical pull/tension life without excessive visual noise;
5. RELEASE retract/fade;
6. three simultaneous traps remaining visually independent while sharing immutable source caches;
7. no repeated material derivation/decode when additional traps are cast.

V10 is now the only Hunter Gold source authority.
