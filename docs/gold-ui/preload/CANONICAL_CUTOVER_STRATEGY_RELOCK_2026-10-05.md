# APEX CHAOS — CANONICAL-PRESERVING CUTOVER STRATEGY RELOCK — 2026-10-05

Status: PRE-IMPLEMENTATION ARCHITECTURE AUTHORITY
Branch: `arena/01a1025a-apex-chaos`
Accepted parent: `c36bf811b3b177cdbb4e2205fc2566a6517f5f91`
Runtime remains `20261003-mirror-v1-r42` because this relock is documentation-only.

This relock exists after a second failed Arena trajectory began to repeat the same class of mistake:
the agent correctly identified Gold as authority, then chose to hand-reauthor Gold into new React code
and planned to keep the old battle shell/combat panels while placing the Gold Battle HUD around/inside them.

That execution strategy is rejected.

## 1. Canonical-preserving strategy

The implementation objective is NOT:

canonical Gold
-> AI interpretation
-> hand-authored React clone
-> visual approximation.

The implementation objective is:

canonical Gold presentation
-> minimal/mechanical production packaging
-> real production state/trigger bridge underneath
-> same visible Gold.

The canonical HTML/CSS/JS choreography is the starting presentation implementation,
not merely a design specification to redraw.

## 2. Do not hand-rewrite Gold into a new UI clone

Do NOT create hand-authored replacements such as:
- `GoldHome.jsx`;
- `gold-home.js`;
- `GoldBattleHud.jsx`;
- a new React component tree recreated from visual inspection;
- manually translated CSS that only resembles Gold;
- a reduced "production-friendly" version of the donor.

A framework/module extraction is allowed ONLY when it is a mechanical/minimal transformation
whose purpose is packaging, mounting, runtime bridging, dependency closure or lifecycle integration.

When transforming canonical presentation source:
- preserve the authored DOM/layer hierarchy where it carries visual/interaction meaning;
- preserve CSS values, selectors/variables and animation/keyframe behavior unless a real runtime adaptation requires an exact equivalent;
- preserve class/id/layer semantics where practical so parity can be traced;
- preserve authored JS choreography/state transitions while replacing only fake/demo truth sources;
- document every intentional visible delta;
- compare the transformed output directly against canonical Gold before continuing.

If a transformation requires rewriting large portions by hand,
treat that as a high-risk parity operation and prove it incrementally against canonical Gold,
not after the whole app has been reconstructed.

## 3. Source extraction is not redesign

It is acceptable to:
- split canonical CSS into local production stylesheets;
- split canonical JS choreography into local modules;
- move retained Gold assets to stable public paths;
- turn canonical HTML fragments into templates/components;
- localize fonts/dependencies;
- mount donor surfaces through the same structural boundary the Gold actually uses;
- replace donor simulator callbacks with production bridge callbacks.

But those operations must be source-preserving transformations.

The burden of proof is:
CANONICAL INPUT
-> TRANSFORM
-> SAME VISIBLE OUTPUT.

Not:
"the new component looks close enough."

## 4. React is host/plumbing, not new art authority

The production React app may own:
- lifecycle;
- routing;
- surface mounting;
- state bridge;
- product navigation;
- accessibility/focus plumbing;
- cleanup.

React does NOT gain authority to reinterpret Gold.

Prefer mounting/extracting the canonical Gold presentation into React
over manually reconstructing the Gold from screenshots/descriptions.

A React wrapper around canonical-preserved presentation is acceptable.
A React rewrite of the presentation is not automatically acceptable.

## 5. Surface replacement law

For each Gold surface:

1. identify the current legacy visible root;
2. identify the canonical Gold root/layers;
3. mount/port the canonical-preserved Gold root;
4. bridge real production state underneath;
5. remove/hide the obsolete legacy visible root;
6. inspect DOM/computed styles;
7. compare against canonical Gold;
8. only then call the surface cut over.

Do not keep legacy presentation because it is convenient state infrastructure.
Separate state authority from visible DOM.

## 6. Battle-specific ownership law

The LIVE arena/game canvas survives.

The LEGACY visible combat HUD/panels do not survive as a second presentation layer.

Target:

GOLD BATTLE COMPOSITION
  -> LIVE arena/canvas in the authored arena slot
  -> Gold P1/P2 HUD territories
  -> Gold rails/skills/loadout/effects
  -> real production state underneath.

Forbidden:

legacy `CombatPanelSide`
+ legacy battle HUD
+ Gold donor iframe/background/overlay.

Do not "integrate existing combat panels into the Gold battle composition."
Their DATA may survive through production projections.
Their obsolete visible presentation must not.

## 7. Canonical iframe boundary nuance

The canonical Gold source itself may use iframe/host boundaries for donors.

Therefore iframe is NOT banned categorically.

It is allowed only when:
- it preserves a canonical structural boundary;
- it uses local/offline production assets;
- fake donor simulator state is removed/quarantined;
- real production state/trigger bridge is explicit;
- pointer/focus/resize lifecycle is correct;
- there is no legacy visible HUD above/below/beside it;
- browser parity proves the result.

An iframe used merely as a Gold wallpaper under the old product is forbidden.

## 8. Home / Pick law

Do not manually redraw Home or Fighter Pick from visual description.

Use the canonical Gold main shell/source as the presentation basis.

Production adaptations are allowed for:
- real roster data;
- real BOT/Local state;
- placeholder art content;
- semantic side colors;
- locked product states;
- routing/lifecycle.

Do not change the canonical visible composition/choreography to fit the old menu/select DOM.
Replace the old visible menu/select presentation instead.

## 9. Choreography ownership law

Do not replace donor animations with generic:
- fade;
- slide;
- shake;
- glow;
- scale;
- CSS utility classes.

Transfer the authored choreography itself.

Production semantic events select/drive Gold phases.
They do not authorize redesigning those phases.

## 10. Incremental parity gate

Do not wait until the entire cutover is finished to discover visual drift.

After EACH major surface slice:
- run canonical surface;
- run production surface;
- same viewport;
- same representative state;
- capture screenshot;
- inspect obvious DOM/layer ownership;
- compare motion checkpoint(s);
- correct drift before starting the next surface.

Suggested durability sequence:
1. Home cutover + parity
2. Mode/Pick cutover + parity
3. Lucky Draw cutover + parity
4. Battle shell/arena ownership + idle parity
5. Battle real-state binding + interaction parity
6. Battle impact/KO/crack parity
7. responsive families
8. result/return
9. full journeys/regressions/shipping.

A checkpoint is commit/push/remote verify and CONTINUE, not stop.

## 11. Mechanical provenance

For any substantial extracted presentation module, preserve provenance:
- canonical source path;
- canonical source hash;
- extraction/generation script or documented source range where practical;
- generated/runtime output path.

If code can be generated mechanically from canonical source, prefer a repeatable generator over opaque hand transcription.

Do not hand-edit generated output without updating the generator/source-of-truth path.

## 12. Visual quality release law

The implementation is not ready because:
- React renders;
- CSS loads;
- build passes;
- event bridge works;
- Gold classes exist;
- Gold iframe exists.

It is ready for owner playtest only when:
- visible ownership is truly cut over;
- direct canonical comparison is convincing at normal scale;
- dynamic choreography matches;
- real production triggers drive it;
- responsive compositions match;
- no legacy double-render is visible;
- no runtime/render leakage exists;
- performance does not require Gold simplification.

Gold mismatch outside approved adaptation categories = FAIL.

## 13. Second rejected trajectory — negative evidence

A later abandoned Arena session began the following rejected strategy:
- "replace/augment" current React UI with Gold;
- "extract the Gold CSS and integrate it into the existing React app";
- keep the existing battle shell;
- integrate existing combat panels into the Gold battle composition;
- load Gold Battle HUD while retaining legacy battle presentation;
- hand-create a new `src/gold/gold-home.js` of hundreds of lines.

That session was stopped before acceptance and is NOT authority.

Do not repeat that strategy.

The lesson is not "React is forbidden."
The lesson is:

DO NOT REAUTHOR THE GOLD BY HAND
AND
DO NOT PRESERVE THE LEGACY VISIBLE PRESENTATION BESIDE IT.

## 14. Final architecture invariant

Presentation:

CANONICAL-PRESERVED GOLD

Truth:

CURRENT PRODUCTION APEX CHAOS

Bridge:

THIN / VERIFIED / IDEMPOTENT

Allowed visible adaptation:

PLACEHOLDER CONTENT
+ OWNER SEMANTIC COLOR
+ REAL TRIGGER/STATE
+ NECESSARY RESPONSIVE/RUNTIME PLUMBING

Everything else visible must remain Gold.
