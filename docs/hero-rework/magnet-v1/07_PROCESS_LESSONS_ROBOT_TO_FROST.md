# PROCESS LESSONS — ROBOT -> HUNTER -> CRYSTALA -> FROST -> MAGNET

Purpose: preserve what actually worked and prevent the Arena Agent from repeating already-paid-for mistakes.

## 1. The original 12/12 owner-playtest failure
Automated suites were green while all 12 heroes failed owner expectations.
Root causes included unauthorized global locomotion/autopilot, incomplete mechanics and tests that pinned/disabled the exact behavior they claimed to protect.

Lesson:
**tests must prove the owner-facing law non-vacuously.**
Do not substitute "green" for semantic fidelity.

For Magnet:
- no generic movement controller;
- no pinned-body proof for external force/contact;
- directed tests must use real slots/projectiles/body motion.

## 2. Robot — successful engineering patterns
What worked:
- exact owner Gold stored in repo;
- checksum/source identity;
- clear Gold-vs-APEX authority split;
- semantic events from real gameplay;
- real equip/fire path used for presentation evidence;
- whole actor integration, not "just add VFX";
- bounded caches/pools and lifecycle teardown.

What failed before correction:
- production reinterpreted Gold orientation;
- mixed local/world coordinates detached effects/weapons;
- stale A1 trails accumulated;
- gameplay translation visually outran authored choreography;
- generic/global rendering contaminated identity;
- semantic SFX count was mistaken for audible playback proof.

Magnet countermeasure:
- explicit coordinate owner for every effect;
- real gameplay event drives Gold;
- one fresh bounded trajectory history per object/lifecycle;
- no whole-body/identity reinterpretation;
- evidence must prove real path, not invocation counters.

## 3. Hunter — exact latest Gold and conflict mapping
What worked:
- V10 canonical file bridged byte-for-byte into repo;
- SHA/path defined source identity even when internal labels still said V9;
- explicit mapping of demo coordinates/timing to production mechanics;
- real swept contact was success authority;
- Gold choreography preserved while production gameplay timing could legitimately supersede demo timing;
- immutable material derivation cached once and shared across multiple trap instances.

Lesson:
**identify exact source by path/hash, not labels; resolve every Gold-vs-gameplay conflict in writing before code.**

Magnet countermeasure:
- Gold numbers/demo physics are not silently promoted to gameplay;
- final owner Magnet brief wins mechanics;
- Reference-A/motion/VFX stay Gold-owned;
- pre-bake heavy immutable raster derivation once.

## 4. Crystala — gameplay truth first, Gold second
What worked:
- gameplay checkpoint before presentation checkpoint;
- Gold adapter rather than fake parallel visual objects;
- real geometry/projectile truth;
- focused performance profiling and visual parity;
- frequent WIP durability commits;
- protected-system policy and minimal shared hooks.

What to avoid:
- overengineering/perf work before semantic stability;
- broad shared edits because architecture seems imperfect;
- stopping after each checkpoint;
- assuming a generated visual replacement is equivalent to Gold.

Magnet countermeasure:
A gameplay slice must prove physical field law first.
Only then bridge exact Gold.
Then thin adapter and browser audit.

## 5. Frost — most important negative evidence
Rejected attempt lessons:
- head/asset extraction plus generic lines/rectangles is not Gold fidelity;
- RNG at wrong semantic time can make tests deterministic but gameplay wrong;
- fake grouping/IDs derived from clock are not real source semantics;
- contact latch that never clears breaks re-contact;
- wrong carrier/body assumption breaks multi-body systems;
- declared config without runtime behavior is not implementation;
- earlier PASS counts cannot be quoted after later edits.

Owner-playtest failure lessons:
- correct gameplay + green gates can still have severe presentation failure;
- wrong/obsolete Gold reference poisoned an entire bridge;
- render-state leakage can flicker the whole battle and resize unrelated fighters;
- arbitrary scale fixes are not acceptable;
- disconnected trail material can look wrong despite "more nodes";
- owner report may be incomplete: agent must audit beyond enumerated symptoms.

Final Frost fixes taught:
- fixed 1/120 presentation springs;
- raw hitch dt must not drive articulated spring energy;
- actual movement/history must be sampled at the correct post-movement phase;
- gameplay truth and presentation history must not be one integration frame stale;
- render pass must be isolated;
- source Gold must be verified exactly before coding.

Magnet countermeasure:
- fixed 1/120 Gold rig;
- velocity/position order explicitly defined;
- force-before-projectile-movement ordering;
- one world step per loose gun;
- canvas state isolation gates;
- no generic VFX substitute;
- owner browser remains final.

## 6. Git / Arena Agent behavior lessons
The Agent is useful but can behave badly in predictable ways:
- start from the wrong branch/ancestor and later "prove" fixes against the wrong baseline;
- keep large local work until workspace/token/auth loss;
- stop at a checkpoint as if it needs permission;
- keep coding after push/auth has failed;
- patch tests around its implementation;
- treat historical docs as current authority;
- hand-edit generated/pinned files instead of tracing the source;
- create temporary probes and forget to remove them;
- broaden a task into a refactor;
- interpret CI green as completion;
- keep polishing after a stable checkpoint and introduce regressions.

Countermeasures:
- exact baseline + immutable preload;
- preflight safe anchoring;
- auth heartbeat;
- 5 min / 150-250 LOC remote durability cadence;
- checkpoint means commit/push/continue, not ask owner;
- stop coding on remote-verification failure;
- explicit read order and authority precedence;
- final cleanup + exact final-SHA rerun;
- owner visual acceptance separated from automated evidence.

## 7. Magnet-specific highest-risk traps
1. Reusing old single-nearest A1.
2. Treating a pickup wrapper's transient `speed` as persistent velocity.
3. Integrating a floor gun once per Magnet instead of once per world tick.
4. Copying Gold `exp(-6dt)` drag and killing momentum.
5. Forgetting 480 px gate on A1 bullets because Gold demo does.
6. Letting Gold visual ramps delay force.
7. Blocking A2 until A1 visual recovery ends.
8. Importing Gold multipart hit circles into gameplay.
9. Delaying real firearm shot by Gold passive PREP.
10. Turning A2 into a yellow bubble.
11. Re-running 1254x1254 raster derivation during battle.
12. Changing Mirror while "integrating" shared hooks.

All twelve are release blockers if introduced.
