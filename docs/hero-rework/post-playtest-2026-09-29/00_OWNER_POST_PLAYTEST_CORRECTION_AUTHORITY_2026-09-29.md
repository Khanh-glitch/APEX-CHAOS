# APEX CHAOS — ROBOT + HUNTER POST-PLAYTEST CORRECTION AUTHORITY

**Date:** 2026-09-29  
**Authorized working branch:** `arena/01a0ead6-apex-chaos`  
**Recorded pre-pass remote HEAD:** `9d160d6d846c04cdf72e34db4fbc25b66f131181`  
**Status:** OWNER-SUPERSEDING AUTHORITY FOR THE NEXT ONE-SHOT IMPLEMENTATION PASS

This document is deliberately written as a supersession layer over the existing Robot/Hunter authorities. It does **not** erase the parts of the current implementation that already work. It changes only the owner-corrected gameplay, Hunter presentation defects found during playtest, Hunter SFX integration, and Arsenal Chamber palette/readability behavior listed below.

If an older authority conflicts with this document on one of these topics, **this document wins**. If it does not conflict, preserve the older accepted law.

---

## 0. What must remain protected

The current Hunter reconstruction is a valid production candidate and must be corrected, not rebuilt from scratch. Preserve unless explicitly superseded below:

- Hunter A1 three-charge sequential recharge architecture;
- max three independent traps;
- 6.0s trap lifetime;
- 1.25s ROOT on real trigger;
- real opponent-body trigger authority;
- bullets/pickups/VFX cannot trigger trap;
- V10 ROOT segmented lifecycle and independent per-trap mutable state;
- shared immutable Hunter V10 source/material cache;
- A2 12s cooldown, 0.16s prelaunch, ~2200 px/s chase, max 0.50s chase;
- A2 continuous live retarget and swept physical body collision;
- A2 zero direct skill damage;
- native APEX locomotion outside authored skill displacement;
- no fake demo prey/projectiles;
- no global camera takeover;
- Robot A1/A2 core mechanics and Robot approved visual cleanup;
- Slime owner-fix behavior;
- Arsenal weapon gameplay/economy/spawn laws;
- battle-audio session lifecycle and existing approved SFX identity;
- Chamber 01 geometry and one-paint cached architecture.

Do not use this pass as a reason for broad refactors.

---

# 1. ROBOT PASSIVE — OWNER CORRECTION

## 1.1 The old interpretation is superseded

The current production state tracks Robot milestone progress cumulatively across the whole match. That is no longer the intended mechanic.

The passive is a **rolling damage-burst window**, not a permanent match-wide progression system.

The existing universal combat side panel already has a rolling **1.2s** damage read. The gameplay passive intentionally uses the same *temporal idea*, but gameplay must **not** read DOM state, UI timers, or `setTimeout` as authority.

## 1.2 Gameplay-authoritative window

Robot owns a passive state such as:

- `burstDamage`
- `burstDeadline`
- `nextMilestoneIndex`
- any bookkeeping needed to guarantee one crossing per threshold

Rules:

1. Only **positive realized damage credited to Robot** contributes.
2. Whenever Robot deals positive realized damage, add that realized amount to the current burst total and set/reset the gameplay deadline to `now + 1.2s`.
3. If 1.2 seconds elapse with no additional positive realized Robot damage, reset the passive burst state completely:
   - `burstDamage = 0`
   - milestone index back to the first threshold
   - no old milestone progress survives.
4. Use the authoritative simulation/game clock or deterministic update state. Do **not** use DOM timeouts for mechanics.
5. Multi-hit damage inside the same rolling window accumulates normally.
6. A single large realized hit may cross multiple thresholds. Each crossed threshold is processed exactly once in ascending order.
7. Damage that is blocked, escrowed, missed, neutral, self-inflicted, or otherwise does not become positive realized HP loss credited to Robot must not count.
8. New match/rematch resets the whole state.

## 1.3 Milestone sequence

The damage thresholds inside each 1.2s burst are:

`150 -> 200 -> 250 -> 300 -> 350 -> 400 -> ...`

That means:

- first threshold = 150;
- every later threshold increases by 50;
- this replaces the old `150,300,450,600,...` cumulative spacing.

There is no permanent match-wide threshold ladder anymore.

## 1.4 Cooldown refund semantics

The owner correction is about **windowing and thresholds**, not a request to redesign the already approved refund ladder. Therefore preserve the current refund amount semantics unless a live source proves a narrower owner-approved value:

- milestone #1 registers but has no cooldown refund;
- milestone #2 = nominal -0.5s;
- milestone #3 = nominal -1.0s;
- milestone #4 = nominal -1.5s;
- later milestones continue +0.5s nominal refund per milestone.

The refund applies to the **currently running cooldown only**. It never changes the base cooldown value of the skill. Example: if a 10s skill has 8.0s remaining and a 0.5s refund triggers, remaining time becomes 7.5s; the next fresh cast still starts from its normal 10s cooldown.

Preserve existing targeting semantics unless current production differs:

- choose the eligible cooling active according to the existing Robot law (A1 priority, then A2);
- if both are READY, the milestone may register but there is no fake refund claim;
- clamp at zero and report only the **actual** seconds removed, never the nominal value if less time remained.

## 1.5 HUD behavior

The old persistent six-step Robot milestone rail represented the superseded cumulative interpretation. It must not remain as permanent match progression.

Integrate Robot passive feedback into the existing combat panel using the same 1.2s-burst grammar:

- show Robot's current burst damage and next threshold in a compact way;
- when a threshold crosses, use the existing panel heat/punch language;
- if a refund actually occurred, show target slot + actual seconds removed;
- reset the Robot passive milestone read after the same 1.2s gameplay silence window;
- do not create a new standalone Robot HUD.

UI follows gameplay state; UI is never gameplay authority.

---

# 2. HUNTER WEAK — NEW CORE PASSIVE LAW

## 2.1 Current defects that this pass must fix

Live audit at the recorded HEAD found both of these:

1. `StatusResolver` knows a WEAK incoming multiplier, but the real damage path does not consistently consume that law, so WEAK can exist without changing realized combat damage.
2. The canonical Hunter Gold contains a prey-bound WEAK presentation, but `tools/bridgeHunterGoldV10.mjs` currently strips `drawWeak`; `hunterGoldV10.js` therefore contains only an empty WEAK render section.

Both gameplay and presentation must become real.

## 2.2 Old Hunter passive is removed

The previous passive auto-dodge mechanic is superseded completely:

- remove 24% projectile auto-dodge;
- remove 95px passive sidestep;
- remove anti-chain dodge lockout;
- remove passive dodge presentation and passive dodge event ownership;
- remove dodge-specific T6 exception because the passive no longer manipulates projectiles.

Do not leave a hidden or dormant dodge path that can still proc.

The Hunter passive now owns **WEAK amplification/progression**.

## 2.3 Lv1 WEAK law

At current owner-approved Lv1:

- duration on each valid Hunter application: **1.0 second**;
- target receives **x1.25 damage from Hunter only**;
- target deals **x0.75 outgoing damage** while WEAK;
- reapplication refreshes the active WEAK window; it does not multiplicatively stack the 1.25 or 0.75 factors;
- WEAK is **authoritatively combatant-level**: store the debuff/timer on the opponent Combatant (or an equivalent single combatant-owned status record), not by one-time copying the status onto the currently living bodies. For Slime, bodies created after application must automatically inherit the remaining WEAK law because their Combatant is WEAK; body-local mirrors may exist only for presentation/query compatibility.

### Provenance rules

The +25% incoming vulnerability applies only when the damage source/controller is Hunter. It must **not** amplify:

- neutral/environmental damage;
- the target's own self-damage;
- unrelated third-party/controller damage;
- the same damage twice through multiple pipeline hooks.

The -25% outgoing modifier applies to positive damage dealt by the WEAK combatant while the debuff is active.

Implement these multipliers exactly once in the authoritative damage pipeline, before final realized HP loss is recorded. Preserve existing mitigation/crit/provenance architecture and document the chosen order if multiple modifiers already exist.

## 2.4 WEAK application sources

Every successful Hunter control hit applies/refreshed WEAK:

### A1

A real opponent stepping on and triggering a Hunter trap:

- starts the existing V10 SNAP/PIN sequence;
- applies ROOT for the existing 1.25s;
- applies/refreshed WEAK for 1.0s from the actual trigger moment.

Trap expiry without a real opponent trigger does not apply WEAK.

### A2

A real swept-body pounce contact:

- still deals **0 direct skill damage**;
- applies **STUN for 2.0s** to the real contacted body;
- applies/refreshed combatant-level WEAK for 1.0s;
- starts the Gold CATCH presentation.

A2 miss/timeout/controlled escape:

- no STUN;
- no WEAK;
- no fake CATCH.

## 2.5 Passive progression architecture

The owner direction is that upgrading Hunter's passive improves the **strength and duration of WEAK**.

Exact Lv2-Lv5 numeric values are **not approved in this pass**. Do not invent them.

Preserve the registry's one-knob structural rule by using one passive progression selector/profile key (for example a numeric `weakProfileTier`) whose resolved profile can eventually contain duration and potency together. Lv1 must resolve exactly to:

- duration = 1.0s;
- Hunter damage multiplier into target = 1.25;
- target outgoing multiplier = 0.75.

Above-Lv1 production resolution remains explicitly unresolved until owner balance is supplied.

---

# 3. HUNTER WEAK VISUAL — PORT THE GOLD, DO NOT SUBSTITUTE

The canonical authority remains:

`docs/hero-rework/hunter-v1.1/reference/HUNTER_GOLD_V10_EXACT_ROOT_TRAP.html`

Identity:

- SHA-256 `447cf549cceb955459eda4b74ef5a561c77fc2f574252783bc7921663578ae65`
- bytes `3,671,159`

The previous bridge deliberately removed `drawWeak`. That removal is superseded.

Recover the actual Gold WEAK visual from the canonical HTML and adapt it to real production prey coordinates/state. The intended Gold language is the prey-bound **three-point convergence / chevrons + radial stress glow**. Do not replace it with a generic ring, label, icon, or arbitrary particle cloud.

Presentation requirements:

- visible while real combatant-level WEAK is active;
- follows the real opponent position;
- works regardless of whether WEAK came from A1 or A2;
- cleans up immediately/cleanly on status expiry/reset;
- visual timer is a consumer of real status state, not a separate independently drifting timer;
- no fake WEAK visual on miss/expiry.

Modify the bridge/tooling so future deterministic regeneration does not strip this accepted Gold component again.

---

# 4. HUNTER A1 TRAP — SCALE, HIT AREA, CLEAN ASSETS

## 4.1 Visual scale

The current in-game trap is too large because the Gold presentation scale was carried into production too literally.

New visual target:

> The Hunter trap must render at **40% of its current in-game visual size**.

This is relative to the current accepted production candidate at recorded HEAD, not 40% of the original source PNG dimensions. The current generated ROOT renderer uses `rtScale(st) = .43`; if registration is preserved, **`.43 * .40 = .172` is the first calibration anchor**. The final accepted value is still the measured 40%-of-current world footprint, not blind scalar worship.

Do not shrink Hunter himself.

## 4.2 Gameplay trigger area must match the new visible footprint

The trap may not keep the old effective trigger area after being visually reduced.

Do not blindly keep `radius:46` or simply hard-code `46 * 0.4` without measuring the rendered footprint.

Required method:

1. render the corrected trap at the new 40% scale;
2. determine the truthful world-space footprint/silhouette relevant to stepping on it;
3. set/calibrate the gameplay trigger envelope to that visible footprint with only a small collision tolerance for body-radius contact;
4. prove in a deterministic/browser gate that a body clearly outside the visible trap does not trigger it, while a body stepping onto the visible trap does.

Visual size and effective trigger reach must read as the same physical object.

## 4.3 Dark-green/noisy edge contamination

Owner playtest found dark-green ragged patches/fringe around the trap after background extraction/segmentation.

Live audit confirms the segmented root-trap parts carry baked semi-transparent green halo/neighbor contamination and runtime also derives extra edge/glow/shadow material. At smaller scale this can become dirtier.

### Hard safety rules

- preserve the original source parts under `public/assets/hero-rework/hunter-v10/` untouched as rollback/source authority;
- no green chroma-key, because the trap itself is green;
- no aggressive crop that can cut blade/root geometry;
- keep original canvas bounds/registration unless a separately proven transform remap is supplied;
- do not erase high-alpha source pixels just because their hue resembles the fringe.

### Preferred cleanup strategy

Create **clean derivative assets** from the originals, build-time or deterministic preprocessing, using alpha/shape semantics rather than hue removal. A safe first strategy is:

- build a core mask from meaningful/high-alpha object pixels;
- preserve all core pixels;
- dilate that core only a few pixels;
- feather the mask narrowly so legitimate anti-aliasing survives;
- suppress low-alpha halo only when it lies outside the preserved/dilated object mask;
- optionally remove detached neighbor islands only when they are provably disconnected from the expected semantic part.

Then A/B in browser at both current scale and the new 40% scale. The cleaned asset must preserve blade tips, roots, bolts, and silhouette.

Runtime edge/glow derivatives must be re-audited after cleanup so they do not reintroduce the dirty halo.

## 4.4 Normal ARMED state vs triggered energy

Owner direction remains:

- normal ARMED trap = clean mechanical trap with **no periodic emissive sweep, no travelling energy, no persistent edge glow, and no pulsing slot/orb**;
- deploy/unfold may use only brief material highlights needed to read the mechanical opening, not a magical idle charge;
- on a real trigger, TENSION -> SNAP -> PIN is where energy visibly wakes and flows through the mechanism;
- do not make an untouched trap look permanently electrified.

This explicitly supersedes the current generated runtime's ARMED `edge=.08`, pulsing `slotTarget`, and periodic `sweepT` behavior.

---

# 5. HUNTER A1 POST-PLANT RECOIL — FIX RUNAWAY FEEDBACK

Owner playtest: current snap-back is too large and can throw Hunter almost to the arena edge.

Live audit found a deeper failure mode: the Gold rig and production position can feed displacement back into each other across frames. This must not be fixed by merely changing `55` to another magic number.

Use a **cast-local finite recoil trajectory**:

1. snapshot authoritative body position and pre-cast movement/facing axis at cast start;
2. the authored Gold animation defines a normalized recoil progress curve;
3. define one finite total retreat distance budget;
4. each tick applies only the delta between current normalized recoil progress and the previous frame's progress;
5. production/world collision remains authority for clipping against walls;
6. rendered Hunter and physical body stay aligned;
7. after recovery, native movement resumes with no stored displacement debt.

Feel target from owner:

> approximately one-third of the arena diagonal feels acceptable; current wall-to-wall launch does not.

Treat this as a browser feel target, not a license to hard-code `diagonal/3` without testing. Tune the finite distance so center-field casts read around that order of magnitude while edge casts clamp cleanly.

Required test directions:

- left;
- right;
- up;
- down;
- diagonal;
- near at least two arena boundaries.

No repeated per-frame feedback amplification.

---

# 6. HUNTER MOTION GHOSTS / ECHOES

Owner wants the extra blue delayed clone under Hunter removed.

Live Gold audit identifies two separate systems:

- `drawAura()` = persistent delayed luminous copy, even outside fast movement;
- `drawEchoes()` = actual motion-history/velocity echo system.

New law:

- remove/disable the persistent delayed aura copy entirely;
- keep motion echoes only for meaningful high-speed Hunter movement, especially A1 recoil and A2 pounce;
- make the trail slightly denser near the live body;
- reduce trail lifetime and/or spatial lag so old samples do not remain far behind as a second Hunter;
- no passive-dodge ghost because passive dodge no longer exists;
- idle/ordinary movement must not show a second delayed body underneath Hunter.

Do not use full-source clones so heavily that frame cost or readability regresses.

---

# 7. HUNTER SFX — OWNER-AUTHORITATIVE PACK

A game-ready archive is staged with this authority:

Git-staged exact archive:

`docs/hero-rework/post-playtest-2026-09-29/reference/APEX_HUNTER_SFX_GAME_READY.zip`

Materializer:

`node tools/materializeHunterSfxPrep.mjs`

The helper verifies the staged archive SHA-256, extracts the six MP3s into the production Hunter SFX folder, verifies every MP3 SHA-256, and leaves no temporary transport state. The ZIP is reference/source transport; runtime loads only the extracted production MP3s.

Expected archive SHA-256:

`e1aedcd48f5dc136fbf12aeb95145f87a9fc2ea2ff92ecb6bf21fe2146845014`

It contains exactly six MP3s. Mapping is semantic and owner-authoritative; do not remap by guessing from filenames:

1. `hunter_a1_charge_personal.mp3`
   - A1 charge/prep cue;
   - personal/local controller cue only.

2. `hunter_a1_deploy_mechanism.mp3`
   - physical placement/mechanical deployment beat.

3. `hunter_a1_unfold_blade.mp3`
   - blade/unfold/snap-open beat during deployment.

4. `hunter_a1_clamp.mp3`
   - real opponent trap-trigger clamp/catch event only.

5. `hunter_a2_pounce_sweep.mp3`
   - real A2 launch/travel sweep.

6. `hunter_a2_catch_flesh.mp3`
   - real swept-contact catch/hit event only.

The files preserve full source duration. Do not destructively trim/re-encode them to fit choreography. Use playback offsets/duration/attack/fade in the existing WebAudio/AV architecture where needed.

### SFX event authority

- accepted A1 cast -> charge/prep cue according to local-controller rule;
- Gold deployment phase -> deployment mechanism cue;
- physical unfold beat -> blade cue;
- **real trap trigger only** -> clamp cue;
- A1 expiry without trigger -> no fake clamp;
- real A2 launch -> sweep cue;
- **real swept catch only** -> flesh/catch cue;
- A2 miss/timeout -> no catch cue.

Use existing battle-audio session registration/scheduling semantics. No audio source may survive battle/session teardown. Avoid double dispatch between presentation and mechanics.

---

# 8. ARSENAL CHAMBER — MULTIPLE FLOOR COLORS + ADAPTIVE READABILITY

## 8.1 Scope

This pass changes **Arsenal Chamber 01 presentation only**. Do not alter arena geometry, spawn positions, collision, weapon balance, or global non-Arsenal backgrounds.

Current Chamber 01 is correctly cached: paint once, one cached draw per frame. Preserve that architecture.

## 8.2 Player-selectable palettes

Add a compact Arena Color/Palette selector in the Arsenal pre-match/hub flow. Do not interrupt the fight with a modal.

Provide a small curated set of materially coherent Chamber variants, not an unrestricted RGB picker. At minimum include:

- a darker graphite option approximately one visual step darker than current, suitable for Hunter;
- current/mid graphite as a stable reference;
- a cool navy/steel family;
- a deep teal family;
- a warm oxide/brown family;
- a violet/slate family.

Exact color values may be narrowly tuned through browser evidence. The geometry/grid/wall/material hierarchy must remain recognizably Chamber 01.

Persist the chosen palette locally and apply it on subsequent Arsenal matches. Prefer extending the existing Arsenal meta state/sanitize authority (`apexChaos.arsenalMeta.v1` in `arsenalMetaRuntime.js`) with a migrated `arenaPaletteId` rather than creating an unrelated second persistence island.

Cache key becomes effectively `(GAME_SIZE, paletteId)` (or equivalent). Selecting a new palette invalidates/rebuilds once; no per-frame gradient reconstruction.

## 8.3 Adaptive fighter/weapon readability

Goal: fighters and weapons must not disappear into, or become painfully bright against, different floor colors.

Do **not** dynamically recolor the whole scene and do not hue-rotate character identity.

Each palette owns a precomputed/read-once **readability profile**, derived from curated palette metadata (luminance/chroma), not per-frame pixel sampling.

The profile may adjust presentation-level values such as:

- mild brightness;
- mild contrast;
- mild saturation;
- neutral keyline/drop shadow strength;
- emissive/glow gain.

Hard rules:

- preserve character and weapon identity hues;
- no extreme filter that makes art look washed out/neon;
- VFX, damage numbers, and floor art are not blindly run through the actor filter;
- dark floor -> preserve core color while ensuring dark silhouettes have edge separation;
- bright floor -> reduce excessive emissive/brightness and add restrained dark separation where needed;
- Hunter on the darker graphite palette should read cleaner/less glaring than on current mid graphite;
- black/dark weapons must remain readable on the darker variants.

Apply profile through stable draw wrappers/helpers rather than scattering per-palette `if` statements across heroes/weapons.

## 8.4 Readability evidence matrix

Browser evidence must compare, at minimum:

- Hunter + a bright weapon on current graphite;
- Hunter + a bright weapon on darker graphite;
- Robot + a dark/black weapon on darker graphite;
- Hunter or Robot + weapon on at least two colored palettes;
- normal combat VFX on at least one dark and one lighter palette.

The result should prove palette choice changes the room, while actors remain legible without losing identity.

---

# 9. CURRENT LIVE ROOT-CAUSE NOTES — DO NOT REDISCOVER BADLY

At recorded pre-pass HEAD `9d160d6...`:

- `heroRegistry.js` still encodes Robot cumulative thresholds `[150,300,450,600,750,900]` — superseded here.
- Hunter registry still encodes A2 WEAK 3s and passive `killer_instinct` dodge — superseded here.
- `ailRuntime.js` still describes WEAK as generic x1.25 incoming for 3s — must become Hunter-provenance + outgoing-reduction law at Lv1.
- `heroReworkRuntime.js` still contains projectile `tryDodge()` for Hunter — remove Hunter passive ownership without regressing other projectile transforms.
- `hunterGoldV10.js` retains `drawAura()` and motion `drawEchoes()` separately — remove aura, tune echoes.
- Gold bridge remove-list contains `drawWeak` — must be changed.
- root-trap `rtScale(st)` currently returns `.43`; new visible result must be 40% of current production appearance.
- Chamber cache is currently keyed only by `GAME_SIZE`; palette support requires theme/palette identity in cache invalidation.
- universal combat HUD uses a 1200ms rolling burst read; Robot gameplay may mirror that temporal law but must not consume DOM timer state.

These are audit findings, not instructions to preserve the old behavior.

## 9.1 Known baseline / harness conditions

Previous evidence at the recorded starting SHA established Hunter focused gates 11/11, Robot 10/10, and Slime owner-fix 7/7. Launcher smoke was 16/17 because `smoke-robot-dash-moves-to-pickup` also reproduced on the clean checkpoint: that smoke observes about 0.20s while Robot A1 has about 0.26s windup. Some headless reports also contained `soccerChampionRuntime.js: image.addEventListener is not a function`, while the target real Hunter browser gate run had zero runtime errors.

If either condition appears in this pass, A/B against the exact prepared starting SHA before attribution. Do not mutate unrelated Robot/Soccer/launcher gameplay merely to force a historical harness artifact green.

---

# 10. CRASH/ROLLBACK-SAFE EXECUTION ORDER

This is one owner-requested pass, but use small pushed checkpoints so an Arena workspace reset cannot destroy good work.

Required order:

1. **Preflight checkpoint / no code edit yet**
   - fetch remote branch;
   - verify exact recorded base or report if remote has moved;
   - read this authority + VIBECODE skill + current Robot/Hunter authorities + canonical Gold;
   - run `node tools/materializeHunterSfxPrep.mjs`; verify the staged exact SFX archive and all six production MP3 hashes;
   - confirm clean worktree.

2. **Robot correction checkpoint**
   - implement rolling 1.2s passive and HUD adaptation;
   - focused Robot deterministic/browser proof;
   - commit + PUSH.

3. **Hunter mechanics checkpoint**
   - remove dodge passive;
   - implement new WEAK law, A1 application, A2 2s stun + WEAK;
   - central damage provenance modifiers;
   - focused deterministic gates;
   - commit + PUSH.

4. **Hunter presentation/audio checkpoint**
   - trap 40% visual + synchronized trigger footprint;
   - cleaned derivative trap assets;
   - finite A1 recoil;
   - Gold WEAK visual;
   - aura removal / tighter echoes;
   - integrate six Hunter SFX;
   - focused browser motion/audio evidence;
   - commit + PUSH.

5. **Arena palette/readability checkpoint**
   - palette selector + persistence;
   - palette-aware Chamber cache;
   - actor/weapon readability profile;
   - browser matrix;
   - commit + PUSH.

6. **Final evidence-only checkpoint**
   - build;
   - all focused Robot/Hunter gates;
   - Slime safety gates;
   - launcher/browser smoke;
   - runtime errors review;
   - normal-scale owner reel/screenshots;
   - evidence/docs only commit + PUSH.

Do not leave valuable work only in the disposable Arena filesystem.

---

# 11. REQUIRED ACCEPTANCE GATES

## Robot

- damage at t=0 crosses/approaches thresholds correctly;
- additional hit at t<1.2 continues same burst and resets deadline;
- silence >=1.2 resets to zero/first threshold;
- sequence 150 -> 200 -> 250 -> 300 -> ... is exact;
- large hit crossing multiple thresholds processes each once;
- cooldown refund mutates only remaining cooldown, never base cooldown;
- actual refund is clamped and truthfully reported;
- no permanent match-wide accumulation survives silence;
- reset/rematch clean.

## Hunter WEAK/mechanics

- A1 real trigger -> ROOT 1.25 + WEAK 1.0;
- A1 expiry -> neither fake WEAK nor clamp;
- A2 swept hit -> STUN 2.0 + WEAK 1.0 + 0 direct skill damage;
- A2 miss -> none of the above;
- Hunter damage vs WEAK target = x1.25 exactly once;
- non-Hunter damage vs same WEAK target is not amplified by the Hunter vulnerability;
- WEAK target outgoing damage = x0.75 exactly once;
- reapply refreshes, does not stack multipliers;
- multi-body combatant shares combatant-level WEAK;
- old Hunter passive projectile dodge cannot proc.

## Hunter visual/feel

- trap appears 40% of pre-pass in-game size;
- trigger area hugs new visible footprint;
- outside-silhouette no-trigger gate;
- no dirty dark-green fringe at 40% scale;
- no clipped blade/root detail;
- normal ARMED trap not permanently glowing;
- triggered TENSION/SNAP/PIN has intentional energy activation;
- A1 recoil finite in all cardinal/diagonal directions and near walls;
- no wall-to-wall feedback runaway;
- real body and Gold rig remain aligned;
- no persistent delayed aura clone;
- high-speed echoes denser/shorter/closer;
- Gold WEAK visual appears on actual target from either A1 or A2 and disappears with real status.

## Hunter audio

- each of six semantic cues fires from the correct real event;
- no clamp/catch sound on miss/expiry;
- no duplicate dispatch;
- session teardown kills delayed/live Hunter sources;
- normal-speed reel is audibly synchronized.

## Chamber/readability

- palette can be chosen pre-match and persists;
- Chamber cache rebuilds once on size/palette change, then is reused;
- no per-frame material rebuild;
- Hunter readable on darker graphite without excessive glare;
- dark weapon readable on darker palette;
- identity hue is preserved across palette changes;
- no arena geometry/gameplay changes.

---

# 12. FINAL STOP CONDITION

After the final pushed evidence checkpoint, report:

- branch;
- starting remote HEAD;
- each pushed checkpoint SHA;
- final remote HEAD;
- exact production files changed;
- exact new/derived assets;
- Robot proof;
- Hunter mechanics proof;
- Hunter visual/audio proof paths;
- palette/readability proof paths;
- all known failures/flakes, with A/B evidence if claiming pre-existing;
- any deliberate deviation from Gold and why it is required by owner gameplay law.

Then STOP for ChatGPT hostile audit + owner playtest.

Do not declare Robot, Hunter, or Hero Rework release-final on your own.
