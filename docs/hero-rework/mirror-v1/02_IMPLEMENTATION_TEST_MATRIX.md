# MIRROR V1 — IMPLEMENTATION TEST MATRIX

Automated tests are necessary but **never owner visual acceptance**. Every test that claims Gold fidelity must compare against the canonical HTML or a trace/image directly extracted from it. Testing a reconstructed `mirrorGoldV1.js` against itself is forbidden.

## G0 — source and branch identity

- **G00** canonical Gold path exists.
- **G01** Gold SHA-256 exactly `c11a8f0fba8e3c37f1180e7746a9169a443be1a1c51d95fbdc464c3c50ef5205`.
- **G02** Gold byte count 107480 and no external runtime dependency.
- **G03** implementation started from the post-current-implementation baseline selected during transplant, not this preload snapshot.
- **G04** preload package was brought forward as one portable commit and no historical Mirror candidate was added as competing authority.
- **G05** runtime revision/lock changed only after final implementation tree is stable.

## V — canonical Gold parity

Canonical harness executes `gold/MIRROR_GOLD_FUSION_12.html` directly with deterministic test RNG/input. Production trace is compared to that source, not to a copied model.

Required scenarios:
- **V01** neutral actor geometry/material screenshot crop at battle scale.
- **V02** neutral close crop.
- **V03** idle false-face role/timing trace: UL/UR/LL/LR delays and stale/wrong behavior.
- **V04** movement start.
- **V05** sustained movement.
- **V06** hard turn/reverse.
- **V07** sudden stop.
- **V08** wall/contact structural response where real APEX supplies the event.
- **V09** realized hit response and shard-detach origin.
- **V10** A1 full frame sequence including flat reflection, six-slice peel, reform and OWN edge.
- **V11** A1 whiff.
- **V12** A2 mark/split/invert/snap/post-residue; snap frame exactly Gold-aligned.
- **V13** five-shard assembly trace through ACTIVE.
- **V14** node surface/face/sweep/age/fold trace.
- **V15** projectile entry image -> destination image -> real emergence.
- **V16** Mirror-vs-Mirror dual presentation has independent histories and stable render order.
- **V17** zero double-draw of generic circles/default MIRROR body.

Parity tolerances must be derived from canonical output variance/scale. Never widen them merely until current production passes.

## A1 — gameplay + Gold causality

- **A101** valid cast snapshots exact opponent weapon at cast.
- **A102** opponent keeps original through entire sequence.
- **A103** no Mirror holder copy exists before Gold OWN edge.
- **A104** copy materializes on first canonical Gold fixed-step crossing of `u=.58`.
- **A105** opponent drops/swaps/dies after valid snapshot -> captured copy still completes if MIRROR lives.
- **A106** MIRROR death before OWN -> no copy.
- **A107** 6s copy timer starts at OWN, not cast.
- **A108** copy uses fresh real ammo/use state and native damage/projectile behavior.
- **A109** manual later equip replaces copy; old expiry cannot consume replacement.
- **A110** unarmed target whiff consumes 15s cooldown.
- **A111** shield target whiff consumes cooldown.
- **A112** T6 target whiff consumes cooldown and never emits MirrorCopy.
- **A113** MIRROR can move during A1.
- **A114** A2 cannot overlap A1 action window, without rooting movement.
- **A115** real captured weapon identity is visible in REFLECT/PEEL; no generic substitute.
- **A116** Gold A1 ~2.2s presentation-busy recovery suppresses unrelated idle beats without rooting movement or extending the A1/A2 gameplay overlap lock.

## A2 — gameplay + Gold causality

- **A201** cooldown 12s.
- **A202** telegraph exactly 0.25s canonical Gold timeline.
- **A203** fighters move normally during telegraph.
- **A204** snap uses live post-movement positions at the snap frame.
- **A205** exact positions exchange with no invented safe offset/path.
- **A206** own velocities unchanged.
- **A207** own HP/weapon/status unchanged.
- **A208** swap outcome independent of P1/P2 ordering, and a synchronous relocation/snap listener never observes a half-swapped state; both coordinates are final before the first swap event is visible.
- **A209** arrival overlap resolves through normal subsequent APEX physics.
- **A210** history rebase prevents global teleport streak and preserves local stale/wrong residue.
- **A211** A1 cannot overlap A2 action window.
- **A212** Gold A2 ~1.8s presentation-busy recovery is visual/idle recovery only, not a movement root or extended skill lock.
- **A213** if match/KO invalidates either participant before the snap edge, no dead-body relocation occurs; cooldown remains consumed from the accepted cast and teardown leaves no delayed swap callback.

## P — shard/node lifecycle

- **P01** exact current balance count: `<20 ->0`; otherwise `clamp(round(dmg/35),1,5)`.
- **P02** only realized damage suffered by MIRROR bodies creates shards.
- **P03** T6 object remains unmanipulated by copy/routing, while realized damage caused by a T6 hit still generates shards according to the normal damage formula.
- **P04** free shard expires at 6s if not reserved.
- **P05** age <=.7 cannot form.
- **P06** formation scans on Gold-equivalent .3s cadence.
- **P07** same-owner-only candidate set; Mirror-vs-Mirror shards never cross-form.
- **P08** topology is seed + 4 nearest and checks fourth-nearest `<170`, not all-pairs 170.
- **P09** reservation prevents double claim.
- **P10** reserved shards do not expire mid-assembly.
- **P11** deterministic seeded orientation in Gold range [-.35,.35].
- **P12** stagger `.18+i*.06`, travel `.4`, fill/lock timing and ~1.20s activation match Gold trace.
- **P13** no projectile routing before ACTIVE.
- **P14** active lifetime 10s starts at ACTIVE.
- **P15** ~~per-owner network cap 3; new formation folds oldest Gold-equivalent node rather than silently failing.~~ **SUPERSEDED (pre-F1 authority hygiene).** The "form a fourth and fold/retire the oldest" reading is not executable Gold law. Binding law per MIRROR owner: shard slots = **16**, shards per node = **5**, held for the node's whole life including fold-out. Three concurrent nodes own 15 of 16 shards, leaving exactly **1 free shard**, while `tryForm` requires 5 — so a fourth concurrent node is **UNPRODUCIBLE** through the shard economy and formation blocks naturally. P15 therefore tests: three concurrent node ownership consumes 15/16 slots and a fourth formation is blocked naturally by shard shortage (no retirement mechanic, no silent-failure fallback, no live fourth node).
- **P16** fold completes ~.55s.
- **P17** presentation and collision use identical node surface transform.
- **P18** ~~per-owner node lifecycle slots never exceed 4; active routing nodes never exceed 3; concurrent pre-active assemblies/folds match canonical Gold slot behavior.~~ **SUPERSEDED (pre-F1 authority hygiene).** Gold's 4-entry `ND` array is internal **storage headroom, not gameplay capacity**; treating it as a fourth gameplay slot is the trap that produced the superseded retirement prose. Binding law: P18 tests that **no hidden live fourth-node / oldest-ACTIVE retirement path is reachable** and that assembly/fold ownership never violates the **16/5 shard economy** (reserved shards leave FREE immediately, stay owned through fold-out, and concurrent node ownership can never require more than the 16 per-owner slots).

## R — projectile routing

Run every routed family through the **real production emission path**.

- **R01** firearm bullet.
- **R02** shotgun pellet entity.
- **R03** grenade.
- **R04** normal thrown melee.
- **R05** TIME replay bullet/grenade/thrown lineage.
- **R06** transformed projectile carrying CHILL/FROST/etc payload.
- **R07** T6/Stormbreaker never captured/routed.
- **R08** direct melee/shield/persistent Hero field not routed.
- **R09** preview starts at Gold surface threshold and does not remove projectile.
- **R10** high-speed swept capture cannot tunnel through thin node.
- **R11** one valid active node -> no escrow/route; local node response occurs and projectile gets Gold-equivalent ~0.40s capture-attempt cooldown while continuing in WORLD.
- **R12** destination is nearest other ACTIVE node in same owner's network.
- **R13** capture removes object from normal world collision/forces.
- **R14** destination image visible before emergence (~.20s).
- **R15** emergence ~.56s at Gold-equivalent `node center + incomingDir * 20` offset (through shared node world scale), not a generic portal-radius offset.
- **R16** direction/speed/payload/critical/provenance preserved.
- **R17** remaining bullet life / grenade fuse / thrown timers pause during escrow and resume after release.
- **R18** previous-position reset at emergence prevents phantom teleport-gap hit.
- **R19** output controller NEUTRAL; damage unchanged; may hit either side; no Hero credit.
- **R20** post-exit recapture lock ~.45s then later valid routing is allowed.
- **R21** no global `lastPortalId` permanent suppression.
- **R22** destination is fixed at capture; if destination folds/despawns before emergence, release falls back to captured entry node/entry transform exactly once with no deletion/retarget.
- **R23** entry/destination node lifecycle changes during escrow never duplicate or lose the projectile.

## X — cross-Hero interoperability

- **X01 Magnet x Mirror:** neutral routed bullet may be physically influenced when eligible; neutral/provenance metadata survives.
- **X02 Magnet x A2:** Magnet active field follows Magnet's real post-swap position on later ticks.
- **X03 Mirror A1 copying Magnet firearm:** no Magnet passive inherited from weapon identity.
- **X04 Time x Mirror:** replay can route and becomes neutral; route does not create recursive Time recording.
- **X05 Crystal x Mirror:** reflected projectile semantic payload survives Mirror route; final controller obeys Mirror neutral output.
- **X06 Frost x Mirror:** chill/frost payload survives route.
- **X07 Rubber x Mirror:** eligible neutral routed projectile interacts through normal Rubber capability rules without ownership corruption/debt duplication.
- **X08 Black Hole x Mirror:** eligible routed neutral projectile can later store/release while neutral/provenance persists.
- **X09 Math x Mirror:** neutral damage adds to neither Math nor opponent credited counter.
- **X10 Slime x Mirror:** neutral route may hit any legal enemy/friendly Body under neutral hit policy; Combatant bookkeeping remains valid.
- **X11 Mirror x Mirror:** separate shard/node networks; independent state; no cross-form/cross-route; max3 per owner.
- **X12 T6 x Mirror:** no copy and no routing manipulation.

## E — render/engine integrity

- **E01** no shared canvas-state leak after MIRROR draw.
- **E02** unrelated fighter sizes/transforms unchanged.
- **E03** Arsenal remains sole real held-weapon renderer after A1 OWN.
- **E04** no generic MIRROR circle nodes/shards double-drawn underneath Gold.
- **E05** actor draw order stable for P1/P2/Mirror-vs-Mirror.
- **E06** post-world effects do not cover unrelated top-layer UI/damage numbers.
- **E07** no per-frame canvas/DOM/image allocation storm.
- **E08** bounded temporal/effect pools and clean teardown/rematch.
- **E09** one fixed-step Gold clock owner in headless and rAF.
- **E10** no raw hitch dt enters Gold springs/history.

## B — broad regressions/build

At minimum, run all existing suites relevant to:
- Robot;
- Hunter;
- Crystala;
- Frost;
- Magnet;
- Slime;
- Hero Rework locomotion/goldens/fuzz;
- Arsenal Quest headless/browser;
- runtime revision lock;
- production build.

Record pre-existing baseline failures **from the final transplant parent SHA** before attributing them to MIRROR. Never weaken a protected test merely to obtain green.

## Owner evidence package

Capture at actual normal gameplay scale:
1. idle/movement start/turn/stop;
2. A1 valid from real held weapon, full peel and real equip;
3. A1 whiff;
4. A2 while both fighters are moving;
5. passive real-damage shard creation -> five-shard assembly -> node active;
6. actual fast firearm routing;
7. grenade and normal thrown-melee routing;
8. Mirror-vs-Mirror;
9. Magnet-vs-Mirror;
10. rematch/re-entry.

Do not claim final visual fidelity from test counts alone.
