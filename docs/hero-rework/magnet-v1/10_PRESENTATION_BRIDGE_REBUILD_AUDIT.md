# MAGNET V1 — production presentation bridge rebuild audit

Status: engineering audit/evidence only. This file does not supersede `00`, `01`, the canonical Gold, or the owner recovery brief.

Audited recovery source: `4403c57c2620a6d32ce48442de0d92224f4f4594`.
Canonical Gold proof: 3,095,049 bytes / 1,242 lines / SHA-256 `468f7b2aa34588c2c52bf23fb5202c507ff5d584d423ea9f1a9232d751247d8b`.

## Bridge audit

| Gold subsystem | Canonical source | Current production equivalent at recovery SHA | Verdict | Rebuild owner |
|---|---|---|---|---|
| Reference-A assets | `buildAssets()`; `PART_DEFS`; native masks | Seeded one-shot prebake + 54 hashed layers | **Exact derivation; retain** | Gold engine asset cache |
| Six parts / hidden surfaces | `PART_DEFS`, exclusive ownership, inpaint | Six prebaked part families | **Exact derivation; retain** | Gold engine |
| Pivots / origin | `O_SRC`, `PV` | `ORIGIN`, `META.*.pivot` | **Exact** | Gold engine |
| Body scale | `S_W=170/1020`, standalone `HX=96`, `HY=80` | Imports `170/1020` directly | **Broken bridge calibration** | Gold engine: one documented body-art factor derived from live radius and Gold reference geometry |
| Fixed step | `DT=1/120`, max 6 substeps | Gold module accumulator | **Present, but production scheduler is broken** | Gold engine + shared `hrPostTick` frame seam |
| Root sampling | Gold owns `heroStep()` then `rigStep()` | `senseRoot()` runs only when adapter ticks | **Broken in rAF; undefined frame contract** | Thin adapter captures previous position before simulation and current position after movement; Gold consumes post-movement frame sample |
| Root sample across substeps | Gold integrates root each fixed step | One frame velocity/acceleration sample is reused implicitly | **Unspecified** | Gold engine intentionally zero-order-holds the measured post-movement kinematic sample across that frame's 1/120 substeps; draw root is always the current real position |
| Acceleration history | `HAX/HAY`, delayed `lag(ms)` | `hax/hay` | **Math present, starved in rAF** | Gold engine |
| Idle base choreography | `idleStart()`, irregular body targets | Reduced target choreography | **Partial** | Gold engine |
| Idle variation | delayed spine pulse, pole micro-lock, travelling current, eye focus/dip | spine pulse only | **Missing** | Gold engine |
| Movement start | core -> near pole -> far pole -> lobes | core -> near pole -> far pole | **Partial; lobes missing** | Gold engine, event from adapter |
| Sustained movement | velocity + delayed acceleration hierarchy | Mostly ported | **Adapted but not production-clock proven** | Gold engine |
| Stop / settle | poles -> lobes -> later spine deformation | poles only | **Partial** | Gold engine, event from adapter |
| Hard turn | core -> selected pole -> opposite pole -> spine -> lobes | core + poles only | **Partial** | Gold engine, event from adapter |
| Wall response | contact-enter, `wallImpact()`, `structural()` | generic `impact()` approximation; top/bottom passes unsupported side `2` | **Broken/partial** | Adapter supplies real contact normal/speed; Gold engine owns structural response |
| Impact grammar | approach -> contact -> compression -> transfer -> secondary -> settle | one generic kick sequence | **Partial** | Gold engine |
| Gold channels | `G`, `gTarget`, pulse/dip routing | channel envelopes and skill targets | **Substantially exact** | Gold engine |
| Recovery | `goldRecover()` staged core/spine/near/far | absent | **Missing** | Gold engine |
| A1 body pose | `rigStep()` A1 targets + `A1.tx/ty` directional term | generic A1 pose; target term omitted | **Broken** | Gold engine; adapter supplies live normalized target vector |
| A1 target selection | live eligible guns + hostile bullets | adapter can find both, but cast cues `{x:0,y:0}` and never update Gold | **Broken bridge** | Adapter selects 0–2 real targets; Gold engine presents them |
| A1 acknowledgement | `selectRing()` / reveal pulse | late rings in adapter | **Correct vocabulary, wrong owner** | Gold engine |
| Filaments / beads | `drawA1Flow()`, `drawA1Filaments()` | reimplemented in adapter; duplicated approximate pole socket | **Wrong boundary** | Gold engine |
| True-history trails | object `hist`; `drawTrail()` tapered ribbons | simplified line ribbons in adapter | **Adapted/drifted; wrong owner** | Gold engine fed real object histories |
| Pressure fronts | `drawA1PressureFronts()` | reimplemented in adapter | **Wrong boundary** | Gold engine |
| Floor distortion | `dispDonor()`, `drawDynamicGrid()` | simplified rings in adapter | **Adapted/drifted; wrong owner** | Gold engine |
| A2 hot bins | `heatAt()`, decayed 24-bin field | bins collected in adapter | **Correct concept, wrong owner** | Gold engine fed real affected objects |
| A2 sectors | `drawReactiveField()` | reimplemented in adapter | **Wrong boundary** | Gold engine |
| A2 object pressure | `drawObjectPressureArcs()`, local lenses | arcs reimplemented; lenses absent | **Partial; wrong owner** | Gold engine |
| Passive choreography | PREP -> real demo launch -> opposite response -> recovery corridor/echo | prep and launch reactions collapsed at emission | **Partial** | Gold engine. Production has no universal pre-emission hook, so real emission is launch time; preserve launch/opposite/recovery beats without delaying gameplay |
| Echoes / material reactions | `echoFX`, `bumpFX`, force arcs, particles | mostly absent | **Missing/partial** | Gold engine, only when driven by real contacts/events |
| Sockets | `partWorldPoint()` from active part matrix | adapter `poleTip()` hand approximation | **Broken duplicate transform** | Gold engine exports sockets from the same active part/body transform used to draw |
| Render isolation | nested `save/restore` | Gold and adapter both isolate their own passes | **Present; retain and strengthen** | Gold engine; adapter never draws Gold aesthetics |
| Lifecycle / teardown | standalone reset | adapter clears state on wrapped exit | **Partial; tied to rejected scheduler wrapper** | Adapter owns subscriptions/combatant mapping; Gold engine owns per-combatant visual state |
| Scheduler | standalone rAF calls fixed step | adapter wraps only `APEX_ARSENAL.step`; `hrPostTick()` ticks Hunter/Frost only | **Release-blocking broken** | `hrPostTick(dt)` is sole Magnet presentation frame owner for headless and real rAF |
| Scheduler tests | standalone/direct `GOLD.tick()` and `AQ.step()` | no real `global update()` proof | **Blind spot** | parity gate calls each production frame path without direct Gold ticking and asserts exact-once counters |

## Locked architecture decisions

1. `hrPostTick(dt)` is the only production frame seam that advances Magnet presentation. The adapter must not wrap `APEX_ARSENAL.step` or `global update` independently.
2. The thin adapter captures a pre-simulation root sample through a narrow `hrPreTick` hook and submits the resolved post-movement body position in `hrPostTick`; the engine derives frame velocity and filtered acceleration from those two real samples.
3. For multiple fixed substeps in one production frame, the measured frame velocity/filtered acceleration is intentionally held across substeps. The rendered root itself is never interpolated or simulated by presentation: it is the current authoritative body position that will be drawn that frame.
4. The Gold engine owns articulation, channels, sparse target selection presentation, histories, filaments, pressure, distortion, sectors, corridors, echoes, reactions, and transformed sockets. The adapter supplies only real semantic inputs/descriptors.
5. Body art uses one exposed production-only calibration based on Gold reference geometry (`HX=96`, `HY=80`) and live fighter radius. Gameplay radius, A1 480, A2 225, and all world-object coordinates remain 1:1 gameplay units.
6. The passive has no universal pre-emission semantic hook in current Arsenal families. Real emission remains time zero; the engine preserves launch, opposite-pole delay, corridor, and recovery. It does not invent a mechanical 55 ms delay.
7. Mirror registry/executors/portal behavior remain byte/semantic frozen. Presentation work requires no Mirror edit.
