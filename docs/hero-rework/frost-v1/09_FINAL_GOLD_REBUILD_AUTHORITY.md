# FROST V1 — FINAL GOLD REBUILD AUTHORITY

Status: OWNER-LOCKED — FINAL ONE-SHOT REBUILD AFTER OWNER PLAYTEST
Date: 2026-10-01
Repository: Khanh-glitch/APEX-CHAOS
Implementation branch: arena/01a0f2eb-apex-chaos

## 0. Why this document exists

The first Frost implementation reached green deterministic gates but failed the owner's real battle playtest. The failure is presentation-level and severe enough that this is NOT a patch-the-symptoms pass.

The current implementation checkpoint remains valuable for gameplay truth and regression coverage, but its presentation bridge must be treated as suspect because it was derived from an obsolete Gold reference.

This document supersedes stale Gold-path/hash references elsewhere in the preload package once this file is present.

## 1. Canonical Gold — exact bytes

The ONLY presentation authority for this final rebuild is:

docs/hero-rework/frost-v1/gold/FROST_GOLD_APEX_PHYSICS_ACCURATE_V2_FIXED.html

Expected size: 981,597 bytes
Expected SHA-256:
940fc9a8a181cc40d965ebf2c4309d1b4816d3016fc191b0d3df8a1a65be2475

Title:
FROST — Gold Fusion · Mechanics + APEX Physics Accurate

This file has already been uploaded to the implementation branch and byte-verified against the owner's supplied Gold.

The previous canonical file:
docs/hero-rework/frost-v1/01_OWNER_APPROVED_GOLD_REFERENCE.html
with SHA-256 59201be3...
is OBSOLETE and must not be used as presentation authority.

Do not silently choose another Frost HTML, prototype, Signature file, screenshot, prior generated JS, or old extracted bridge.

## 2. Owner playtest blockers — release blockers

The owner has now directly playtested the current production implementation and observed:

### A. A2 is visually wrong

A2's ice trail is visibly broken into detached/disconnected ice chunks/masses instead of behaving like the continuous authored Gold trail.

It does NOT match the Gold's actual A2:
- connected material progression;
- segment spacing;
- continuity through movement;
- turn/carve treatment;
- density/detail hierarchy;
- lifecycle/decay;
- visual relationship between the moving Frost body and the trail.

Do not fix this by merely increasing node count or drawing extra connecting rectangles/lines. Re-derive A2 from the correct Gold's own trail/material/choreography and feed it the real production movement history.

### B. A1/A2 corrupt the whole battle render

When A1 or A2 is used, the entire arena can enter severe visual corruption:
- ice visuals flicker rapidly;
- authored ice details disappear/reappear;
- unrelated arena visual details can be affected;
- the opponent repeatedly scales large/small/flickers in size.

This is a CRITICAL RELEASE BLOCKER.

Treat it as a render-isolation/state-integrity failure until proven otherwise. Audit:
- canvas ctx save/restore balance;
- transform/scale/translate/rotate leakage;
- globalAlpha;
- globalCompositeOperation;
- filter/shadow state;
- clipping/path state;
- image smoothing;
- camera/render transforms;
- shared fighter draw state;
- any mutation of fighter visual scale/radius/size;
- any mutation of opponent state;
- any shared Gold singleton/engine state;
- multiple Frost engines drawing through one mutable Gold actor;
- draw order and double-render paths;
- legacy ICE renderer/audio overlap;
- cached canvas/image reuse;
- asynchronous asset-load callbacks changing live render state.

A Frost render pass MUST be observational with respect to unrelated fighters, arena, camera and HUD.

### C. Frost battle scale is wrong

The production Frost body/ice visual currently appears smaller than the other fighters.

Do not fix this with an arbitrary global scale multiplier.

Derive the production scale from the correct Gold's authored body reference and the real APEX fighter radius/battle scale. Verify it at the same camera/arena scale used by the other heroes.

The selected direct-frontal Frost identity must remain visually proportionate to the other fighters while preserving the exact Gold silhouette/detail hierarchy.

### D. There are additional visual defects

The owner explicitly reports that the listed issues are not exhaustive.

Therefore acceptance cannot be reduced to these three fixes. The agent must perform a full Gold-vs-production visual lifecycle audit and catch unlisted defects before declaring completion.

## 3. Architecture law

Use:

REAL APEX GAMEPLAY TRUTH
        ↓
THIN STATE/EVENT ADAPTER
        ↓
CORRECT GOLD-DERIVED PRESENTATION ENGINE
        ↓
ONE ISOLATED FROST DRAW PASS

Gameplay owns:
- position;
- velocity/direction;
- collision;
- A1/A2 timing;
- floor truth;
- pickup/freeze state;
- projectile truth;
- Freeze truth;
- exact holder transfer;
- cooldowns;
- lifecycle.

Gold owns:
- Frost actor visual;
- A1 breath/front/material choreography;
- A2 trail/material/carve choreography;
- Frozen Gun material treatment;
- Frozen Bullet visual;
- target shell/crack/thaw;
- steal transfer visual choreography;
- authored motion language.

The adapter translates real game state into Gold inputs. It must NOT redesign Gold choreography.

Never make production gameplay conform to the Gold demo's fake movement/AI/input/physics.

## 4. Presentation isolation law

The Frost presentation runtime must never:
- mutate fighter x/y/dir/radius/baseSpeed as a visual shortcut;
- mutate opponent scale/size/radius;
- mutate camera scale/zoom;
- leak canvas transform/composite/alpha/filter/clip state;
- alter shared renderer state after its draw pass;
- create a second global Gold actor that fights the first actor for the same fighter;
- draw the same Frost material twice through separate legacy/new paths;
- allow legacy ICE presentation to double-render Frost.

Every draw boundary must be state-safe. If the Gold engine expects a transform, wrap it locally and restore it unconditionally.

Test A1/A2 against:
- idle opponent;
- moving opponent;
- both fighters moving;
- wall bounces;
- body contacts;
- weapon pickup;
- Frozen Gun;
- Freeze shell;
- A1 + A2 overlap/queue;
- rematch/re-entry.

The rest of the arena must remain visually stable.

## 5. A2 continuity law

A2 is an actual-path Gold presentation.

The trail must be reconstructed from real Frost movement history, but its visual node/material behavior must come from the correct Gold.

No:
- disconnected visual islands caused by admission delay;
- duplicated trail sections;
- artificial straight-line trail;
- homing path;
- steering toward opponent;
- arbitrary timer-based turns;
- generic cyan rectangles/lines as substitutes.

If Gold serializes A1/A2 visually, production may queue/defer presentation, but it must preserve the gameplay event's historical origin and visual continuity.

## 6. Existing implementation salvage

KEEP unless proven incorrect:
- Frost gameplay laws and production truth already proven by the existing Frost gates;
- exact-holder A2 transfer law;
- semantic shot/blast grouping;
- Freeze RNG/hit semantics;
- Freeze refresh/post-thaw lock;
- Frozen Floor support/pickup laws;
- native APEX locomotion;
- protected Hero/Arsenal behavior;
- useful regression infrastructure.

REPLACE/REBUILD as necessary:
- the Gold extraction/bridge derived from the obsolete 975,616-byte Gold;
- presentation runtime assumptions tied to that old Gold;
- generated Frost Gold JS if its authored constants/rig/material/choreography came from the obsolete reference;
- any compensating adapter logic added only to make the old Gold fit production.

Do not preserve bad presentation code merely because its tests are green.

## 7. Mandatory verification

Before finalizing:

1. Verify correct Gold path, byte count and SHA.
2. Prove the old Gold is no longer referenced as authority.
3. Audit the Gold source itself before coding.
4. Compare current presentation against the correct Gold side-by-side.
5. Add regression gates for the owner's three critical failures and for unlisted visual corruption.
6. Run real browser evidence at real battle scale on the actual arena.
7. Capture A1, A2, Frozen Gun, Frozen Bullet, Freeze shell/refresh/thaw, A2 steal, rematch and simultaneous-fighter scenarios.
8. Run protected Hero/Arsenal regressions.
9. Run production build.
10. Run performance/steady-state allocation checks.
11. Run the full focused Frost suite on the exact final SHA.
12. Relock revision only after the implementation tree is final.
13. Push and verify local SHA == remote SHA.
14. Leave the tree clean.

Green headless gates alone are NOT completion.

## 8. Protected systems

Do not redesign:
- CRYSTALA V2;
- ROBOT;
- HUNTER;
- Chamber;
- Arsenal spawn/damage/crit/weapon semantics;
- blood/splatter;
- damage numbers;
- unrelated shared renderer behavior.

If a shared render hook is absolutely necessary, keep it Frost-specific and prove non-Frost equivalence.

## 9. Scope remains locked

No Frost-specific SFX.
No Lv2-Lv5 production progression.
No balance retuning.
No Gold redesign.
No generic visual replacement.
No new gameplay mechanic invented to compensate for a presentation problem.

The target is simple:

REAL GAMEPLAY + CORRECT GOLD VISUALS + ZERO CROSS-SCENE CORRUPTION + ZERO UNPROVEN SHORTCUTS.
