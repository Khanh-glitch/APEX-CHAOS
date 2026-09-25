# APEX CHAOS — OWNER-APPROVED V1 BLOOD PORT AUTHORITY
Date: 2026-09-25

## 0. Why this file exists

The previous Arena Agent session completed V3 work and then crashed. A new Arena session is pinned to a new Arena branch and cannot receive the ChatGPT attachment package reliably.

Therefore the approved V1 blood-port reference is now stored directly in Git.

This task is a **production integration of the owner-approved V1 blood hit effect**. It is NOT a request to redesign blood.

## 1. Live checkpoint / branch continuity

Repository:
`Khanh-glitch/APEX-CHAOS`

Previous Arena branch / audited source branch:
`arena/01a0cf5e-apex-chaos`

Audited source checkpoint before this authority commit:
`da19f62a1ee35b2f97eae1f611f7b3d5bc120b2c`

Its green implementation parent:
`a438b513ab1474797e5c71ad2994741cebd39ff3`

Green GitHub Actions run:
`36141954741`

Known green baseline:
- headless: 219 / 219
- real browser: 124 / 124
- production build: PASS
- launcher smoke: PASS

Protected refs at the audit point:
- `main` = `75c8879d83f03a33854b34b4d55e775d8027cce9`
- `playtest/arsenal` = `2113e92c42739eeb568794117a19526aa4a4725d`
- `prototype/aftermath-32` = `40359f693f8a0d98dc091c408d058ae89f24bbda`

A new Arena session may be pinned to another branch such as:
`arena/01a0d8f4-apex-chaos`

That is expected. Do NOT fight the session pin.

Correct continuation:
1. fetch the previous Arena source branch read-only;
2. inspect its latest tip;
3. fast-forward the current session branch from the old checkpoint to the new authority tip if ancestry is clean;
4. continue implementation ONLY on the current session-pinned Arena branch;
5. push only that current session branch.

Never modify main, playtest/arsenal, prototype/aftermath-32, or asset-vault.

## 2. Authority order for the blood task

If anything conflicts:

1. owner's latest explicit instruction;
2. `01_APPROVED_EXECUTABLE_REFERENCE_V1.html` in this same directory;
3. this file;
4. current V3 handoff/runtime authorities for all NON-blood systems;
5. older V3 blood/splatter wording.

The owner directly tested V1, V2 and V3 and selected V1.

V2 and V3 blood experiments are rejected as visual directions.

Do not "improve", reinterpret, or replace V1.

## 3. Narrow override only

This authority supersedes older blood/splatter art direction only.

It does NOT reopen or change:
- HP = 1000;
- Arsenal equipment damage ×7;
- firearm critical chance table;
- critical multiplier = 1.50;
- dedicated combat RNG;
- shotgun one crit roll per blast;
- 4.5 s normal spawn cadence;
- offensive cap 5;
- emergency firearm spawn law;
- heal values 70 / 126 / 196 / 280 / 385;
- heal eligibility at 800 HP;
- firearm display normalization;
- current damage popup scaling;
- normal damage number red;
- critical damage number orange;
- heal number green;
- Hub / Shop / Lucky Draw / Quest Map;
- owned-only Free Battle roster;
- NEWBIE fallback;
- Quest owned P1 + fixed stage P2 which may be unowned;
- current audio, casing, projectile, skills and fighter visual parity;
- current Chamber visual state;
- removal of the extra top-corner HP bars.

Do not refactor unrelated systems.

## 4. Executable golden reference

Run/read:

`docs/arsenal-quest/v1-blood-port/01_APPROVED_EXECUTABLE_REFERENCE_V1.html`

This is the exact standalone V1 the owner approved.

Only the BLOOD behavior is authoritative from that demo.

DO NOT port demo-only systems:
- fake shooter/enemy;
- demo arena/grid/HUD/crosshair/buttons;
- fake bullet gameplay;
- random demo damage values;
- demo camera implementation;
- critical toggle;
- Burst Test / Clear Blood controls.

The HTML uses random damage numbers only to visualize normal vs critical. APEX must use real combat damage.

## 5. V1 visual identity

Strongest read:

`projectile ---> victim X===========> blood`

Blood is violently carried THROUGH the victim by projectile momentum.

Must NOT read as:
- fireworks;
- radial explosion;
- symmetric burst;
- separate left/right spray cones;
- forward rebound cone;
- confetti;
- sparks recolored red;
- circular red emitter.

No V2 75/15/10 split.
No V3 85–90/5–8/2–5 rewrite.
No radial burst.
No multi-cone emitter.

## 6. Exact firearm impact metadata is mandatory

At the audited V3 checkpoint, the current blood hook in:

`public/game/arsenal/arsenalFeelRuntime.js`

derives direction approximately from:

`victim position - source position`

and stamps approximately at:

`victim.x / victim.y`.

That is not sufficient for faithful V1 firearm behavior.

The real firearm collision loop in:

`public/game/arsenal/arsenalWeaponRuntime.js`

already has, at impact:
- `p.x`, `p.y`;
- `p.vx`, `p.vy`;
- `p.weapon`;
- `p.critical`;
- owner;
- victim.

Thread actual firearm collision metadata through the existing damage/feel pipeline.

For firearm projectile hits the VFX must consume:
- resolved real `dealt` amount;
- actual collision/hit position;
- actual projectile velocity/trajectory;
- real critical flag;
- weapon/victim metadata if useful.

Do NOT change damage calculation.
Do NOT create fake damage.
Do NOT duplicate gameplay truth.

The blood system is only a visual consumer of combat state.

## 7. Preserve current popup system

Keep current accepted APEX damage popup behavior.

At the audited checkpoint:
- normal damage = red `#F2382F`;
- critical damage = orange `#FF8A24`;
- heal = green;
- MISS remains neutral;
- current large nonlinear size bands remain;
- cached crisp atlas remains;
- AUTO/BURST/SHOTGUN aggregation remains;
- damage numbers render above blood.

Blood remains crimson for both normal and critical.

Critical blood must NEVER become orange.

## 8. V1 emission behavior

### A. Impact core

Normal:
- visual size about 13 reference units;
- life about 0.12 s.

Critical:
- visual size about 18;
- life about 0.12 s.

Shape:
- irregular procedural blot;
- ~18 perimeter points;
- radius jitter about 0.65–1.28;
- dark crimson radial gradient;
- asymmetric;
- stretched ~1.5 along projectile direction.

No clean-circle principal core.

### B. Manga/liquid streaks

Normal:
- ~4 strong streaks.

Critical:
- ~7 strong streaks;
- V1 critical streak speed includes ×1.08.

Reference:
- baseAngle = atan2(projectile velocity);
- spread ±0.34 rad;
- speed 260–470 before critical ×1.08;
- life 0.16–0.28 s;
- width 2.2–4.6;
- stretch 5–11;
- frame-equivalent drag 0.88–0.93.

Streaks are elongated tapered liquid/manga marks aligned to velocity.
Do not make them circular particles.

### C. Medium droplets

Normal ~12.
Critical ~18.

Reference:
- spread ±0.56 rad;
- speed 120–300;
- life 0.32–0.58 s;
- size 1.7–4.6;
- drag 0.94–0.975;
- ~55% can leave a small persistent landing mark at end-of-life.

### D. Micro spray

Normal ~38.
Critical ~64.

Reference:
- spread ±0.72 rad;
- speed 70–360;
- ~15% receive ×1.4 speed boost;
- life 0.18–0.45 s;
- size 0.55–1.55;
- drag 0.925–0.97;
- ~11% can leave a tiny persistent mark.

Micro spray is texture, not the dominant silhouette.

## 9. Persistent floor blood

Required.

Reuse the existing APEX cached/offscreen stain layer architecture where compatible.

Do NOT keep historical floor blood alive as simulated particles.

Main decal:
- normal distance ~16–32 along projectile direction;
- critical distance ~24–44;
- normal power ~0.82;
- critical power ~1.30.

Floor mark grammar:
- irregular central blot;
- directional secondary marks;
- directional micro marks;
- varied silhouettes;
- darker/drier than airborne blood;
- under fighters.

The executable reference uses `source-over` for persistent blood compositing.

When selected airborne particles die:
- medium drop landing chance ~55%, tiny power ~0.18;
- micro landing chance ~11%, tiny power ~0.06.

Landing creates a tiny local mark, NOT another explosion.

## 10. Blood material

Avoid bright flat RGB red and additive glow.

Reference impression:
- core center around rgb(92,0,0);
- middle around rgb(74,0,0);
- deep edge around rgb(38,0,0);
- active drops roughly rgb(98–125,0–3,0–3);
- persistent floor blood darker.

No orange critical blood.
No neon glow.
Blood should absorb light, not emit it.

## 11. Layering

Verify:

arena floor
→ persistent blood
→ fighters / pickups / environment
→ active airborne blood
→ damage numbers
→ HUD

Persistent blood must not float above fighters or UI.

## 12. Critical hit difference

Same blood language, stronger response.

Reference:
- core 13 → 18;
- streaks 4 → 7;
- medium 12 → 18;
- micro 38 → 64;
- critical streak speed ×1.08;
- larger/farther floor decal;
- stronger existing hit feedback where appropriate.

Do not create a separate orange or radial critical blood system.

## 13. Non-projectile damage

The executable V1 is specifically a projectile-impact authority.

For firearm projectile hits:
- actual hit point + actual projectile direction are mandatory.

For melee, grenade/blast and native skills:
- do not fabricate projectile velocity;
- preserve currently accepted behavior unless the live mechanic exposes a genuine trajectory/contact vector that maps naturally;
- do not turn this into a melee/grenade/native VFX redesign.

## 14. Performance law

The owner has already said the game feels smooth.

Do not start a broad performance rewrite.

Preserve V1 workload first.

Good architecture already available in APEX:
- cached/offscreen persistent stain canvas;
- pooled transient objects;
- bounded active work;
- no historical floor blood simulation.

If capacity protection is needed, preserve priority:
1. critical core/streak;
2. normal core/streak;
3. medium drops;
4. recycle micro spray first.

Measure real browser/requestAnimationFrame behavior under actual blood workload.
Do not reduce VFX quality because synthetic CI pacing differs from the owner's device.

## 15. Visual acceptance

Fresh real-game evidence is mandatory.

At minimum:
1. left → right firearm hit: blood continues right;
2. right → left firearm hit: mirrors left;
3. diagonal firearm hit: major effect rotates with trajectory;
4. repeated normal hits: organic persistent accumulation, no fireworks;
5. critical firearm hit: same blood language, stronger; blood crimson, number orange;
6. normal firearm hit: blood crimson, number red;
7. sustained/high-rate combat: stable bounded workload;
8. layering: floor stain under fighters; airborne blood may cross fighter; number on top.

Failure if visible:
- radial/360 burst;
- symmetric spray;
- obvious separate side cones;
- forward rebound emitter;
- perfect-circle primary identity;
- spark-like blood;
- neon/glowing blood;
- orange critical blood;
- firearm blood starts from fighter center when true hit point exists;
- blood ignores projectile velocity;
- identical stamped floor decals;
- numbers become unreadable;
- floor blood above fighters;
- unbounded simulation;
- gameplay balance changes;
- Quest/UI/weapon/spawn/crit/heal regress.

## 16. Regression floor

Do not weaken existing tests to obtain green CI.

Keep meaningful V3 gates green, including:
- full 24-firearm ×7 identity audit;
- grenade/melee ×7 with no crit;
- native damage not ×7;
- crit RNG isolation;
- 4.5 s / cap 5 / emergency firearm logic;
- heal behavior;
- normal red / crit orange / heal green;
- Free Battle owned-only;
- invalid save → NEWBIE;
- independent P1/P2 Free Battle;
- Quest stage → P1 picker;
- Quest P1 owned-only;
- Quest P2 fixed, can be unowned;
- Quest win / NEXT / loss / persistence;
- no broken picker cards;
- production build / launcher smoke.

The pre-blood authority baseline was:
- headless 219 / 219;
- browser 124 / 124;
- production build PASS;
- launcher smoke PASS.

## 17. Delivery law

Before claiming completion:

1. fetch/starting SHA reported;
2. intended diff only;
3. full headless passes;
4. production build passes;
5. launcher smoke passes;
6. full real-browser suite passes;
7. fresh V1 real-game visual evidence captured;
8. browser console checked;
9. sustained blood workload checked;
10. final implementation commit pushed ONLY to the current session-pinned Arena branch;
11. GitHub Actions run head SHA must equal final non-skip-CI implementation SHA and conclusion must be SUCCESS.

A later `[skip ci]` evidence-only child is acceptable only after the implementation SHA is green.

Do not promote playtest or main automatically.

## 18. Final report

Report:
- fetched source SHA;
- current session branch;
- implementation SHA;
- evidence SHA if separate;
- Actions run ID / head SHA / conclusion;
- headless count;
- browser count;
- build + launcher result;
- files changed;
- exact firearm collision event used;
- exact hit-position source;
- exact projectile-direction source;
- V1 core/streak/drop/micro implementation;
- persistent stain architecture;
- non-projectile behavior;
- color confirmation;
- 24-firearm ×7 audit;
- Quest/Free Battle regression results;
- fresh V1 evidence filenames;
- any genuine remaining issue.

Stop at owner playtest.

Do not propose V2/V3 or another blood redesign.
