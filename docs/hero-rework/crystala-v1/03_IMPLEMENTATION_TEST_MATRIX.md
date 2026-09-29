# CRYSTALA V1 — IMPLEMENTATION / EVIDENCE TEST MATRIX

Implement deterministic gates before broad owner evidence. Never weaken an existing gate to obtain green.

## 1. Mechanics gates
C01 dormant Crystal does not body-auto-reflect.
C02 K valid press starts 2.4s Awakening and 8s cooldown.
C03 K unavailable/cooldown press fails without duplicate cast.
C04 K expiry stops NEW assignments immediately.
C05 already RESERVED/OUTBOUND intercept completes after K expiry.
C06 exactly six immortal shard semantic records exist.
C07 only ORBIT shards count AVAILABLE.
C08 RESERVED shard is unavailable to J immediately.
C09 RETURN shard unavailable until exact dock frame.
C10 shard docking during active K can be selected again for a later threat.
C11 J outside K fails immediately and consumes no cooldown.
C12 failed J has no latent/input-buffer replay.
C13 J success consumes 1.5s cooldown.
C14 J snapshot with 6 ORBIT -> Prison.
C15 J snapshot with 2–5 -> Wall using exactly 2.
C16 J snapshot with 0–1 -> fail/no cooldown.
C17 same-frame J input snapshot resolves before new threat reservation.
C18 Wall real HP=120, width=220, solid lifetime=4 from material lock.
C19 Prison radius=135, six independent facet HP=75, solid lifetime=3 from closure.
C20 shards never lose HP/die/reconstruct.

## 2. Threat predictor gates
C21 projectile predicted miss -> no shard reserve.
C22 projectile would expire -> no reserve.
C23 projectile hits solid construct first -> no reserve.
C24 non-hostile projectile -> no reserve.
C25 already Crystal-reflected -> no reserve.
C26 T6/Stormbreaker -> no reserve.
C27 melee/contact/blast/beam/field/DoT -> no K reserve.
C28 scan may detect within 1000 but does not reserve early solely due distance.
C29 predicted intercept is near real 180px band.
C30 predictor accounts for Crystal current movement.
C31 simultaneous threats sorted TTI -> damage -> stable id.
C32 each projectile gets at most one shard.
C33 each shard handles at most one current assignment.
C34 Shotgun pellets are independent threats; only real-hit pellets reserve.
C35 disappearing/blocked outbound target causes curved abort return, no teleport.
C36 selected shard is physically reachable; no far-side teleport.

## 3. Reflection / projectile truth
C37 contact cancels Crystal incoming hit.
C38 reflected damage is current projectile damage * .50 exactly once at Lv1.
C39 no second Arsenal x7.
C40 no new firearm crit roll.
C41 valid crit/provenance survives.
C42 ownership/controller becomes Crystal.
C43 one projectile can Crystal-reflect at most once.
C44 reflected Crystal projectile does not hurt/re-reflect on own constructs.
C45 Robot A2 mitigation still applies to reflected projectile.
C46 K reflection has no fake homing correction.
C47 fixed Wall/facet reflection obeys surface geometry.
C48 final Wall/facet killing hit is blocked/reflected before structure removal.
C49 T6 keeps existing non-reflect/final-authority behavior.
C50 ordinary enemy projectiles can structurally damage real construct through one authoritative transaction.

## 4. Movement / geometry gates
G01 no invisible collision before visible grown/solid material.
G02 normal locomotion cannot cross solid Wall.
G03 normal locomotion cannot cross live Prison facet.
G04 destroyed Prison facet opens real movement gap.
G05 Robot A1 high-speed dash cannot tunnel through solid Crystal geometry.
G06 Hunter pounce/high-speed authored displacement cannot tunnel.
G07 anti-tunnelling uses minimal shared geometry authority, not direct Robot/Hunter behavior rewrites.
G08 cage no longer tracks target after NUCLEATE/material birth.

## 5. Gold visual gates
V01 Crystala body/crown/face/eye geometry visibly matches Gold.
V02 all 6 exact shard silhouettes/roles preserved.
V03 dormant shards dark; K awake makes them visibly luminous.
V04 orbit uses Gold inertial/spring elliptical motion, not rigid equidistant halo.
V05 redistribution with missing/busy shards remains organic.
V06 reservation has immediate visible anticipation.
V07 intercept uses Gold Hermite/facet orientation, not straight lerp teleport.
V08 internal-light path stays inside gem and retains Gold ~0.16 beat.
V09 recoil has visible physical consequence.
V10 return is curved/tangent-continuous and visible dock == availability.
V11 complete intercept->dock targets 1.20s.
V12 Wall has Gold dense 13-cell material; not thin beam.
V13 Wall two-front growth/seam lock preserved.
V14 damage cracks/chips/stress respond at actual real hit point.
V15 support-failure cascade is visual only; no phantom gameplay damage.
V16 Prison each side uses dense A1 material language.
V17 Prison burst/encircle/chain/last-gap/closure preserved.
V18 pre-solid Wall/Prison reaches material solidity about 0.75s without deleting phases.
V19 Ancient Dust stays restrained/bounded; no generic glitter.
V20 authored bloom only; dark face/silhouette stays crisp; no continuous neon ribbon.

## 6. Chamber/render integrity
R01 Crystal actor source renders once per Crystal frame under Chamber.
R02 Crystal uses Chamber API without editing Chamber runtime.
R03 world construct/trail/dust/status FX are outside actor silhouette capture.
R04 equipped weapon renders exactly once via Arsenal pass.
R05 no per-frame Canvas/DOM allocation growth.
R06 no global hue/filter rewrite of Gold art.
R07 runtime-revision/cache-bust gate green after new runtime wiring.

## 7. Required real-browser Crystal vs Robot evidence
1. Dormant + Robot firearm -> real hit, no auto-reflect.
2. K + SNIPER -> one clean Gold intercept/refraction/return.
3. K + P90/M249 -> sequential shard departures + overflow pressure.
4. K + SHOTGUN -> only individually real-hit pellets consume shards.
5. K + JACKHAMMER -> sustained/multi-pellet overwhelm case.
6. K then immediate J with 6 -> Prison.
7. K with one shard reserved/out then J -> Wall, not Prison.
8. Wall hit to break -> Gold crack/density/support cascade + real HP120.
9. Prison facet broken -> real visible/physical gap.
10. Robot A1 into Wall/Prison -> no tunnelling.
11. Robot A2 receives reflected projectile -> mitigation remains.
12. T6 interaction -> no illegal reflection.
13. K expires mid-outbound -> committed job finishes; no new job.
14. shard docks during K and later intercepts again.
15. Chamber palette spot check: graphite-mid, graphite-dark, teal-deep, oxide-warm while retaining Gold hue identity.

## 8. First-pass telemetry
Record, do not self-balance before correctness:
- K casts/match;
- J casts/K;
- Wall vs Prison casts;
- eligible threats seen;
- miss/blocked/expired threats ignored;
- successful intercepts;
- overflow hits while shards busy;
- repeat intercepts by same shard within one K;
- reflected damage;
- prevented incoming projectile damage;
- average shard busy time;
- construct HP damage/termination reason;
- Prison facet breaks;
- seeded Crystal-vs-Robot winner/match duration.

## 9. Regression floor
Before running the suite, verify `00d83e76d248c49ca65d8e546c67819d07a0d758` is an ancestor of implementation HEAD on `arena/01a0ead6-apex-chaos`. Record `20260930-hunter-ownerfix-r1` as the gameplay-baseline runtime revision and never substitute an older preload SHA.

Discover exact current scripts at fresh HEAD, then keep green:
- Arsenal headless;
- Arsenal browser/runtime;
- production build;
- current Robot gates;
- current Hunter gates;
- Chamber palette gates;
- runtime revision gate;
- no page/console errors in Crystal evidence.

## 10. Evidence/checkpoint order
1. deterministic mechanics gates;
2. Checkpoint A commit/push/remote verify;
3. Gold visual integration + focused browser parity;
4. Checkpoint B commit/push/remote verify;
5. matchup/evidence captures;
6. full regression/build/audit;
7. Checkpoint C commit/push/remote verify.

Do not burn time on a long reel before A/B are durable.
