# APEX CHAOS — PROCESS + GOLD PARITY RELOCK — 2026-10-05

Status: PRE-IMPLEMENTATION FAILURE-PREVENTION AUTHORITY
Branch: `arena/01a1025a-apex-chaos`
Accepted clean parent before this relock: `14cc89e44ee78832c11749b3729d002b68d88551`
Runtime underneath this documentation relock remains: `20261003-mirror-v1-r42`

This document exists because APEX CHAOS has repeatedly shown the same dangerous pattern:
mechanics/tests can be green while the owner-visible product is wrong.

It distills the paid-for lessons from Robot -> Hunter -> Crystala -> Magnet -> Frost -> Mirror
and applies them to the Gold product UI/UX/HUD cutover.

A rejected Gold-cutover attempt exists at:
`a1427dcd19a2f9428b61bace57adab8b89eb56ac`

That commit is NEGATIVE EVIDENCE ONLY.
Do not merge it, cherry-pick it, copy its UI architecture, or treat its commit message as proof.

## 1. The recurring failure pattern

Robot taught:
- exact source identity and coordinate ownership matter;
- a hero/product must be integrated as the complete visible actor/surface, not "old thing + some VFX";
- real gameplay equip/fire/contact events must drive presentation;
- generic/global rendering layers contaminate identity;
- invocation counters are not audible/visible proof;
- caches/pools/listeners need bounded lifecycle and teardown.

Hunter taught:
- canonical path + SHA beats stale names/comments;
- Gold is the owner-visible master;
- Gold-vs-production conflicts must be resolved explicitly, not silently;
- real swept contact is success truth;
- immutable derived art can be shared, mutable lifecycle cannot;
- optimization is valid only if normal-scale Gold appearance survives.

Crystala taught:
- protect accepted upstream systems;
- use real geometry/projectile truth;
- do not add duplicate input seams;
- do not create invisible gameplay state that contradicts the visible Gold;
- when Gold is correct, integration changes must not rewrite it;
- checkpoint/push/remote-verify durable work instead of keeping a huge local-only delta.

Magnet taught:
- reconstructed Gold MUST NOT be validated against itself;
- canonical source execution/parity is required;
- "function ran" is not proof the owner can perceive the intended result;
- real fast production objects must be tested, not only donor-speed/synthetic fixtures;
- donor diagnostic substrates are not production art;
- a second/post-collision physics integrator can create sticking despite green static tests;
- visual tests must inspect the actual visible primitive/frame, not merely ownership of a draw function.

Frost taught:
- obsolete/wrong Gold poisons the entire bridge;
- generic geometry/particles are not a Gold substitute;
- green deterministic gates do not imply presentation acceptance;
- render-state/scale leakage can corrupt unrelated fighters/the whole scene;
- semantic timing matters (RNG, grouping, re-contact, carrier identity);
- declared config without real runtime behavior is fake completeness;
- stale PASS counts after edits are invalid;
- browser/owner visual proof cannot be replaced by headless claims;
- owner-reported defects may be incomplete: perform hostile visual audit beyond the enumerated symptoms.

Mirror taught:
- use bounded/fixed presentation state where accepted;
- do not add a second movement/physics authority;
- real swept production paths matter at high speed;
- actual pixels/frames at normal battle scale are evidence;
- keep automated correctness, canonical parity, browser proof, performance proof, and owner acceptance as separate gates;
- "all tests green" is never equivalent to "Gold matched."

## 2. Exact Gold visible-parity law

Gold is not a style guide.
Gold is the visible presentation authority.

For Gold-owned surfaces, the target is the SAME perceived product as the canonical Gold,
not "similar", "inspired", "focused", "simplified", "productionized-looking", or "close enough".

Allowed visible deviations are ONLY:

1. the four explicitly replaceable UI-art placeholder contents;
2. owner-approved semantic ownership/color adaptation (for example data-driven P1/P2/source identity accents);
3. donor demo trigger sources replaced by real production triggers/state;
4. responsive/runtime plumbing required to make the SAME authored Gold composition/choreography work on the real viewport/product.

Everything else belongs UNDER the presentation:
state sources, adapters, event wiring, caching, performance plumbing, production controls, lifecycle.

If a production adaptation changes visible:
- composition;
- silhouette;
- spacing hierarchy;
- frame geometry;
- z-order;
- typography metrics;
- masks/crops;
- rails;
- motion path;
- duration/easing relationship;
- overshoot/settle;
- recoil direction;
- shake/flash hierarchy;
- crack/fracture language;
- Lucky Draw choreography;
- Pick choreography;
- Battle HUD choreography;
then it is a Gold drift unless explicitly authorized.

Gold drift is a RELEASE BLOCKER.

## 3. Visible ownership cutover — never layer Gold under legacy UI

Each user-facing surface gets ONE visible presentation owner:

- Home
- Lucky Draw
- BOT Pick
- Local Pick
- Battle Entry
- Battle HUD
- Result / Return

The old production UI may remain only as hidden/internal truth infrastructure where needed.

Forbidden result:

OLD UI visible
+ Gold background
+ Gold CSS accents
+ generic new effects

Forbidden Battle result:

legacy combat panels/HUD visible
+ Gold shell underneath/behind/alongside them.

The real arena/canvas must be embedded in the Gold battle composition at the correct layer.
Old visible presentation for that surface must be removed/replaced/hidden intentionally.

Before declaring a surface cut over, inspect the real DOM/computed styles and prove:
- presentation root;
- visible old roots absent;
- z-order;
- pointer ownership;
- state owner;
- Gold layer owner.

## 4. Canonical parity — do not validate a reconstruction against itself

For every Gold surface/choreography:

1. verify exact canonical source path/hash;
2. run/inspect the canonical donor/reference directly;
3. run production at the SAME viewport/state;
4. compare the actual visible output.

Static proof:
- screenshots at matched viewport/state;
- compare composition, geometry, typography, masks, layer visibility and color relationships;
- placeholder regions may be masked from image comparison rather than loosening the whole screen.

Motion proof:
- capture authored phase checkpoints/frames for key interactions;
- compare phase order, timing, direction, overshoot and settle;
- Battle hit/Critical/Heavy/Thunder/Heal/KO/crack and Lucky Draw/Pick transitions require dynamic proof, not one idle screenshot.

Normal-scale proof is mandatory.
A giant isolated debug view is not sufficient.

Never write a test that imports only the reconstructed production module and calls that "Gold parity."

## 5. Non-vacuous real-path proof

A trigger test must use the real production transaction that the player uses whenever practical.

Examples:
- real firearm critical path;
- real Stormbreaker damaging impact;
- real Fighter.heal delta;
- real canonical skill controller acceptance/rejection;
- real weapon holder/loadout change;
- real BOT/LOCAL product handoff;
- real high-speed projectile/body path.

Do not prove a feature by:
- directly calling the presentation function;
- directly dispatching the event under test;
- pinning/disabling the behavior the test claims to verify;
- reading a counter without checking visible output.

Synthetic directed fixtures may isolate boundary conditions,
but at least one real-path proof must exist for every player-facing semantic.

## 6. Event provenance and lifecycle

Do not guess semantic event names from a cue filename or preload description.

For every new SFX/VFX/HUD trigger, first prove:

REAL SOURCE FUNCTION
-> REAL EVENT/STATE EDGE
-> PAYLOAD
-> PRESENTATION CONSUMER

If no event exists, add the narrowest observer at the authoritative transition.

Never create a fake parallel truth just to make presentation convenient.

Every listener/wrapper/session hook must be idempotent:
- bind once, or keep an unsubscribe;
- rematch must not double listeners/sounds/FX;
- teardown must not leave stale timers/sources/state;
- repeated route entry must not stack wrappers.

Exactly one authoritative battle-audio-session begin must occur per real match.
UI navigation may fade theme, but must not duplicate the gameplay-owned session boundary.

## 7. Local/BOT protection

LOCAL 2P already exists as a production product/battle mode.

Do NOT reconstruct Local mode, Local Fighter Pick, movement, result/economy, or general battle architecture.

Audit only the narrow rework-hero P2 active-skill seam if it is genuinely missing:
- P2 Digit1 -> A1
- P2 Digit2 -> A2
- Local P2 cast AI disabled
- same canonical ability controller.

BOT keeps real CPU P2.

## 8. Gold donor harness boundary

The Battle donor's fake HP/cooldowns/weapons/BOT/timer/rounds/LAB/effect keys are exercise harness only.

Transfer:
- Gold presentation;
- choreography;
- responsive composition;
- interaction/readout language.

Replace only trigger/state plumbing.

Do not recreate donor simulator mechanics in production.

Likewise, do not replace donor presentation with generic production effects.

## 9. Render/performance isolation

Never weaken Gold first to fix performance.

First eliminate:
- duplicate old+Gold rendering;
- repeated DOM construction;
- synchronous asset decode on event;
- repeated image/material derivation;
- canvas state leakage;
- stale transforms;
- arena reflow;
- unbounded particles/listeners/timers.

Canvas/renderer adapters must fully save/restore relevant state.
No scale/filter/composite leak into arena/opponent.

Kill/crack and dense transitions require frame/performance inspection in the integrated product.

## 10. Source/package/runtime discipline

Use the repository-declared package manager and lock authority.
Current repository declares pnpm.
Do not generate/commit npm `package-lock.json`.

Do not hand-edit generated/pinned outputs when a source generator owns them.

Any runtime source change under cache/revision authority requires an honest revision bump/relock.

PASS counts and evidence must be rerun on the EXACT final SHA after the last code edit.

## 11. One-shot execution discipline

Arena Agent may use a temporary session branch, but must begin from the accepted authority ancestry.

Do not reset backwards to a preload SHA if current accepted HEAD is newer.

Use durable implementation slices:
- audit;
- implement a real final-architecture slice;
- focused tests;
- diff review;
- commit/push;
- remote verify;
- continue.

A checkpoint means durability, not "stop and ask permission."

Do not keep polishing after a stable slice without rerunning the affected evidence.

If push/remote verification fails, do not continue building a huge unverifiable local delta.

## 12. Acceptance ladder — none may substitute for another

A quality implementation must pass ALL applicable layers:

A. Source integrity
- exact Gold path/hash;
- exact preload hashes;
- correct baseline ancestry.

B. Structural cutover
- Gold is the visible owner;
- no old+Gold double UI;
- correct layer/pointer ownership.

C. Semantic/runtime correctness
- real gameplay truth;
- no mechanic drift;
- correct trigger/input/audio lifecycle;
- rematch/re-entry idempotency.

D. Canonical visual parity
- matched screenshots/frames against canonical Gold;
- normal scale;
- authored motion relationships intact.

E. Real-browser product proof
- complete real journeys, desktop/mobile;
- actual gameplay triggers;
- no console/runtime/render leakage.

F. Performance
- kill/crack/transitions and dense AV remain smooth enough without visual downgrade.

G. Final-SHA regression/shipping
- focused + protected regressions;
- source/runtime/shipping/build gates;
- rerun after final code edit.

H. Owner acceptance
- automated/browser evidence may establish readiness for owner playtest;
- never label owner visual acceptance as passed unless the owner actually accepts it.

## 13. Required real product journeys before closure

At minimum prove in real browser:

Home -> BOT Pick -> Battle -> Result -> Return
Home -> Local Pick -> Battle
Home -> Lucky Draw -> Draw result -> Return

At relevant reference viewports:
- 1366x768
- 1920x1080
- 844x390
- 390x844

The evidence must make it visually obvious that the visible surface is the Gold surface,
not legacy UI with Gold underneath.

## 14. Rejected 2026-10-05 attempt — concrete traps now forbidden

The rejected `a1427d...` attempt demonstrated why these checks are mandatory:
- it appended generic `.gold-*` CSS around the old production UI instead of performing the visible cutover;
- it claimed Battle Gold without replacing the visible battle presentation;
- it implemented a fixed-bucket Heavy accumulator instead of a true rolling 1.20s window;
- it waited for a Stormbreaker event field not emitted by the real damage transaction;
- it guessed hero SFX events that did not exist in production;
- it risked listener duplication across battle sessions;
- it duplicated the battle-audio session begin path;
- it rotated an entire P2 panel instead of only the authored Local portrait control territory;
- it generated an npm package lock in a pnpm repository;
- it treated a Vite build as if it were meaningful Gold completion evidence.

Do not salvage or imitate that architecture.
Re-derive cleanly from accepted preload + current production truth.

## 15. Final quality law

If Gold visibly differs outside the explicitly authorized adaptation categories:
FAIL the slice and correct it before closure.

If tests are green but canonical/browser output is wrong:
the implementation is wrong.

If browser output looks right but real triggers/state are fake:
the implementation is wrong.

If both are correct but rematch/re-entry leaks listeners/state:
the implementation is wrong.

The target is:
EXACT GOLD PRESENTATION
on top of
REAL CURRENT APEX CHAOS TRUTH
with
ZERO SILENT DRIFT.


## 16. Canonical-preserving implementation strategy

The presentation-preserving execution strategy is additionally locked by:

`docs/gold-ui/preload/CANONICAL_CUTOVER_STRATEGY_RELOCK_2026-10-05.md`

This explicitly rejects hand-reauthoring Gold into new React clones and rejects keeping legacy visible combat/menu/pick presentation alongside Gold. Framework/module extraction is allowed only as a mechanical/minimal source-preserving transformation with direct canonical parity proof.
