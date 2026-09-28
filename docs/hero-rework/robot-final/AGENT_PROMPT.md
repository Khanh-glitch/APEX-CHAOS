# TASK — FINAL ROBOT INTEGRATION INTO APEX CHAOS

You are doing one complete production implementation pass for ROBOT. Do not return a partial demo. Do not redesign the approved Robot. Do not touch unrelated heroes except narrow generic plumbing that is provably required and regression-safe.

## 0. Bootstrap and source truth

Repository: `Khanh-glitch/APEX-CHAOS`.

Before editing, fetch remote Git and verify your checkout. The integration authority was created from the newest playable Slime correction tree:

`arena/01a0e749-apex-chaos@84d386337d97ed4575a0cf476ecf05ec54321660`

Director branch:

`director/robot-final-integration-20260929`

Do NOT start from `main`. Do NOT treat `director/slime-crash-recovery-20260929@696170b...` as the gameplay baseline; that is a later authority-document branch, while the playable Slime engineering tree is the `84d386...` lineage above.

Read in full before coding:

- `docs/agent-authority/VIBECODE_SKILL.md`
- current Hero Rework authority/registry/mechanics/runtime docs and code
- `docs/hero-rework/phase1/15_SLIME_OWNER_CORRECTION_FINAL_REPORT_2026-09-28.md`
- the supplied `ROBOT_VISUAL_AUTHORITY.html`
- supplied `SHA256SUMS.txt`
- this task

First report the exact HEAD and verify the reference/SFX SHA-256 values. Then inspect current Robot mechanics, shell/render path, Arsenal weapon drawing, semantic AV/audio pipeline, hit/collision hooks, runtime manifest and existing Robot gates. After that, implement. This task is intended to finish in one run; do not stop after merely proposing architecture.

## 1. Authority resolution — non-negotiable

There are TWO authorities and they own different things:

### A. Owner-approved HTML owns ROBOT presentation

`ROBOT_VISUAL_AUTHORITY.html` is the visual/motion authority for the Robot itself. It owns:

- silhouette and proportions;
- layer segmentation and draw order;
- ivory ceramic / dark steel / brass / amber-optic material language;
- eye shape and restrained bloom;
- chassis, crest/datum, chin, cheek, calipers, pivots, seams;
- articulated pose relationships;
- analytic spring character;
- inertial body lag during movement;
- A1 recognize / commit / launch / contact / settle choreography;
- A2 index / structural lock / armored-hit force routing / release choreography;
- wall-response body motion;
- weapon-fire recoil response;
- passive index/upgrade response;
- Robot-local afterimages, trail, sparks/chips/dust and camera/trauma handshake.

Do not simplify it into a circle/blob, generic robot icon, old NEWBIE renderer, generic SVG, glow shell, or temporary hero effect. Do not recolor or restyle it to “fit Apex”. Fit is geometric/system integration, NOT an art-direction change.

### B. Current APEX owns gameplay/environment truth

The live baseline owns:

- fighter world position/heading and normal locomotion;
- collisions and wall bounce;
- match camera and viewport/DPR system;
- actual weapon pickup/contact/equip state;
- real weapon artwork, muzzle/casing/shot behavior and gun SFX;
- damage pipeline, hit point/direction when available, hit-stop rules and CC;
- Hero Rework skill cooldown/mechanics;
- T6/Stormbreaker immunity laws;
- HUD/product flow;
- existing WebAudio graph and mobile unlock lifecycle.

Do not copy the prototype's fake world, fake gun, fake bullet demonstrations, demo HUD, buttons, background or 4.35-second showcase timer into the game.

When the HTML's demo movement conflicts with gameplay, preserve the PERCEPTUAL Robot choreography while obeying gameplay. Example: the HTML uses a showcase Bezier dash, but production A1 already has physical steering and a hard 0.55 s window. Do not alter A1 physics to imitate the demo curve. Drive the Robot articulation/trail/turn compensation from the real APEX dash velocity/path so it LOOKS like the approved animation while gameplay remains identical.

## 2. Current Robot gameplay contract — freeze it

The baseline currently defines:

### A1 — Weapon Dash

- cooldown: 10 s;
- nearest eligible REVEALED pickup;
- excludes T6/Stormbreaker from auto-targeting;
- physical continuous dash, not teleport;
- `dashSpeed=3400`, `maxDashTime=0.55`, `turnRate=11`, `arriveRadius=34` on the current registry;
- the live slot is re-resolved during dash;
- real physical contact remains equip/pickup authority;
- no valid target => condition fail cue and NO cooldown consumption.

### A2 — Virtual Armor

- cooldown: 10 s;
- duration: exactly 3.0 s gameplay time;
- incoming damage multiplier: 0.45 = 55% DR;
- NO CC immunity;
- damage still resolves through the shared pipeline.

### Passive — Damage Milestones

- counts CREDITED REALIZED damage dealt only;
- refund ladder is authority: milestone 1 no refund; milestone 2 0.5 s; milestone 3 1.0 s; milestone 4 1.5 s; later milestones add 0.5 s each;
- currently production `milestoneThresholds` is null because the claimed cumulative threshold ladder could not be found in source;
- therefore production MUST NOT invent thresholds or silently activate refunds.

All existing Robot R1–R9 gates must remain green.

## 3. Implement Robot presentation as a first-class runtime, not a demo overlay

Use the smallest clean production architecture. A dedicated Robot presentation module is preferred if that avoids contaminating generic Hero Rework code. It must integrate with the existing runtime manifest/load order and existing canvas renderer; do not create a second game loop, second canvas game engine, second physics engine or second AudioContext.

The current `makeReworkShell()` intentionally has temporary neutral presentation. Replace that temporary state for ROBOT only with the approved presentation path. Other reworked heroes must not inherit Robot visuals.

Recommended division:

- gameplay/mechanics continue in `heroMechanicsRuntime.js` / `heroReworkRuntime.js`;
- Robot presentation state/rendering lives in a narrowly scoped module;
- mechanics emit semantic events; presentation consumes them;
- Arsenal AV runtime owns decoded audio playback through existing `audioCtx` + `battleAudioMaster`;
- Arsenal weapon renderer remains the source for the actual held weapon.

Do not put gameplay outcomes inside the renderer.

## 4. Reconstruct the approved Robot exactly enough to be recognizable frame-for-frame

Port the HTML's segmented source and masks, not a screenshot substitute.

Important head-space facts from the authority:

- Robot art is authored in 1280-unit head space;
- reference pivot points are around `(191,626)` and `(1089,626)`;
- jaw reference is around `(414,1094)` with mirrored counterpart;
- center latch around `(640,470)`;
- palette/gradients/masks/layer order in the HTML are authority;
- renderer hierarchy is effectively back/chassis -> struts/crest -> core/eyes -> chin -> cheeks -> calipers -> pivot discs, plus seams/lock glow/routing pulses/stress.

Preserve the exact visual relationships. Translate them into APEX world/body scale with one stable head-space-to-world transform. Do not independently eyeball each piece at production size.

The Robot may visually extend beyond its physics circle. Do not enlarge/changing collision radius just to match art bounds unless existing gameplay already requires it. Presentation follows gameplay, not vice versa.

### Springs/motion constitution

The HTML uses deterministic analytic damped springs with a fixed simulation step and different stiffness/damping families for calipers, crest, chin, cheek, lid, glow, seam, core/root, tilt/lag and weapon kick. Preserve that motion character. You may integrate with the game's dt rather than literally running another 240 Hz world simulation if the visible result is equivalent and deterministic.

Do NOT replace articulation with unrelated CSS-style tweens or generic ease-in-out animations.

## 5. Always-on Robot channels — not only skills

This is a whole-Robot update. Implement all of these:

### Idle / held weapon

- approved neutral pose;
- correct eye/optic treatment;
- when armed, use the approved held/caliper relationship;
- actual APEX weapon art is rendered through the shared weapon system, positioned using a Robot jaw/weapon socket;
- no prototype fake gun.

### Normal movement

Drive inertial lag and modest tilt from actual APEX velocity/acceleration. The HTML's body lag makes the Robot feel mechanical; preserve it without steering the fighter.

### Wall collision

Hook actual wall collision/bounce and apply the approved brief chassis/caliper recoil/dust response. Do NOT change wall physics, heading or bounce law.

### Normal hit

Preserve the HTML's loose unarmored mechanical recoil/stress response based on actual incoming hit direction/point. Do not add a new unapproved Robot-specific normal-hit SFX family.

### Weapon fire

On actual fire from a Robot holder, apply approved gunKick/root/core/crest/caliper counter-motion. Keep shared weapon projectile, muzzle, casing and weapon SFX unchanged. Recoil is Robot body response, not a replacement firearm animation.

## 6. A1 presentation + final SFX

Use real semantic moments, not timers detached from gameplay.

### Successful press / target acquisition

Immediately on a valid A1 cast:

- play `robot_a1_lock` ONCE;
- enter approved RECOGNIZE/FOCUS pose;
- show the approved measuring/bracket/optic focus language toward the actual target pickup;
- then approved COMMIT anticipation/structural pose;
- no extra clamp sound.

The lock file has a short useful transient inside a longer container. Preserve the owner's file. If latency is caused only by leading/trailing silence, a lossless/semantically identical delivery trim is allowed, but do not redesign or layer the sound. Document any trim and verify perceptual onset against the HTML/owner intent.

### No target

When the player deliberately presses A1 while there is no eligible revealed target:

- play `robot_a1_no_weapon` ONCE;
- use the approved no-solution visual response;
- cooldown remains untouched;
- P2's automatic retry loop must NOT spam audible fail cues. Existing AI retry behavior should remain quiet on repeated condition failures unless a deliberate player action occurred.

### Actual dash start

When the physical A1 dash actually launches:

- play `robot_a1_dash` ONCE;
- drive approved caliper/rotor/crest/tilt response and trailing/afterimage system from actual dash velocity/path;
- preserve current physical steering/max-time rules.

### Physical weapon contact

Only when APEX actually resolves the pickup/contact:

- execute the approved jaw-contact visual hit-stop/spark/lock flash/contact pose;
- transfer the visual weapon from floor to the Robot jaw socket using the real equip state;
- NO clamp SFX;
- do not grant/equip the weapon from the presentation layer.

After contact settle to the armed/held pose.

## 7. A2 presentation + FINAL CHANGED SOUND MAPPING

The owner deliberately changed the sound assignment. Use exactly this:

### A2 activate/open

`robot_a2_activate.wav` = source `mixkit-robot-step-1417.wav`.

At successful A2 cast:

- play once;
- perform INDEX -> STRUCTURAL LOCK choreography;
- seam/lock state and routing pulse become active;
- use the approved P_A2_INDEX / P_A2_LOCK relationships from the HTML;
- armor presentation remains active for EXACTLY the real 3.0 s mechanic window.

The previously considered `mixkit-shuffling-gear-mech-item-3152.wav` is rejected. Do not include or reference it in runtime.

### A2 armored hit

`robot_a2_armor_hit.wav` = source `mixkit-mechanical-crate-pick-up-3154.wav`.

For every actual incoming damage event while A2 is active:

- play this one file as the Robot armor impact identity;
- normal and heavy hits use the SAME Robot armor-hit file; there is no heavy Robot variant;
- preserve the attacking weapon's own shot/fire SFX;
- avoid stacking a generic body-impact layer that masks the Robot armor identity if current plumbing would double-fire it;
- use existing bounded voice/retrigger facilities so automatic weapons do not create audio soup; do not merge/mix a new sound asset to solve polyphony.

Visually, execute the HTML's hard-lock impact: hit-direction travel, short hit-stop/trauma, caliper/root/crest/chin response, symmetric sparks, and force-routing pulse from hit point -> nearest pivot/latch -> opposite pivot. Strong hits may use the HTML's stronger visual amplitude/chips if driven by real damage magnitude, but audio stays the SAME file.

### A2 end/close

`robot_a2_end.wav` = source `mixkit-robotic-engine-malfunction-3149.wav`.

At the exact gameplay expiry of the 3.0 s armor window:

- play once and only once;
- execute the approved release/retraction/soft-settle visual;
- routing should visually resolve/retract rather than abruptly disappear.

The prototype's own 4.35 s showcase release timing is NOT gameplay authority. Use 3.0 s.

Add a semantic armor-end presentation event if needed, but it must be observational and must not change the mechanic.

## 8. Passive presentation + unresolved threshold safety

Final files:

- `robot_passive_milestone.mp3`
- `robot_passive_upgrade.mp3`

When a REAL configured milestone threshold is crossed, emit/consume a semantic Robot milestone presentation event and play milestone once. Use the HTML's index tick/crest/optic response.

When the milestone produces the actual upgrade/refund tier/event, play upgrade once and use the stronger pulse/spin/snap response.

Production currently has no authoritative milestone thresholds. Therefore:

- do not invent 100/250/500/etc.;
- do not turn the passive on just to demonstrate the SFX;
- use TEST-ONLY injected thresholds to exercise presentation tests;
- leave production `milestoneThresholds` null until owner authority supplies the ladder.

The implementation should be READY: when thresholds are later supplied, no presentation rewrite is needed.

## 9. Final SFX inventory — exactly eight Robot files

Use these semantic names in runtime/materialization (extension may be converted according to existing delivery policy, but sound content must remain the owner-selected source):

1. `robot_a1_lock` <- `mixkit-sci-fi-positive-notification-266.wav`
2. `robot_a1_no_weapon` <- `universfield-error-notification-05-199276.mp3`
3. `robot_a1_dash` <- `mixkit-futuristic-robotic-fast-sweep-171.wav`
4. `robot_a2_activate` <- `mixkit-robot-step-1417.wav`
5. `robot_a2_armor_hit` <- `mixkit-mechanical-crate-pick-up-3154.wav`
6. `robot_a2_end` <- `mixkit-robotic-engine-malfunction-3149.wav`
7. `robot_passive_milestone` <- `daviddumaisaudio-steampunk-mechanical-gadget-188052.mp3`
8. `robot_passive_upgrade` <- `rescopicsound-sci-fi-weapon-recharge-reload-compact-01-233839.mp3`

Use `SHA256SUMS.txt` as the identity gate. Do not substitute a similar sound. Do not resurrect prototype synth audio. Do not add clamp or heavy-hit files.

Integrate through the existing Arsenal AV runtime on `audioCtx` / `battleAudioMaster`. Do not create another AudioContext. Preserve mobile unlock/session behavior. Follow the project's existing source-master/runtime-delivery/materialization policy rather than dumping an ad-hoc sound library into public assets.

## 10. Event plumbing requirements

Prefer narrow explicit semantic events instead of presentation polling internal stores. Add only what is necessary, for example:

- Robot A1 valid acquire/cast
- Robot A1 dash launch
- Robot A1 physical contact/equip presentation moment
- Robot A1 deliberate no-target fail
- Robot A2 armor start
- Robot A2 armored incoming impact with body/hit point/direction/damage magnitude if available
- Robot A2 armor end
- Robot passive milestone reached
- Robot passive refund/upgrade
- Robot weapon fired / wall impact can reuse existing canonical events if already available

Events are observational. They MUST NOT double-apply damage, pickup, cooldown, movement, armor or refund.

## 11. Performance and quality

The owner will reject a “performance fix” that degrades approved visual identity.

- no per-frame image decoding;
- no per-frame DOM creation;
- cache/pre-render static segmented sources/offscreen layers where useful;
- pool bounded transient VFX;
- cap DPR using existing game practice, not by making Robot blurry;
- preserve silhouette/material details;
- do not render the whole prototype stage into a giant offscreen screenshot each frame;
- no uncontrolled audio voices on automatic fire;
- teardown presentation state cleanly between matches.

## 12. What NOT to change

Do not regress or redesign:

- Slime C1–C3 corrections from the selected baseline;
- canonical-12 roster / NEWBIE->ROBOT migration;
- original APEX ordinary locomotion law;
- A1 physics/cooldown/T6 exclusion/contact law;
- A2 55% DR / 3.0 s / CC semantics;
- passive damage accounting/refund ladder/threshold unresolved state;
- weapon balance/art/muzzle/casing/fire SFX;
- Stormbreaker frozen laws;
- blood/splatter;
- HUD/responsive product layout;
- economy/spawn law;
- other hero mechanics or visuals.

If generic plumbing must change, prove why and gate regressions for all affected paths.

## 13. Required automated proof

Keep all existing green gates. At minimum run:

- `node tools/testHeroReworkRobotGates.mjs` -> existing 9/9 unchanged;
- Slime physics/kit/owner-fix/legacy-separation suites;
- Hero Rework smoke;
- Hero Rework goldens;
- Arsenal headless;
- production build;
- real-browser Arsenal suite against the built preview.

Add focused Robot PRESENTATION gates that prove:

1. visual renderer is ROBOT-specific and old neutral/Newbie look is not drawn for Robot;
2. A1 valid cast: lock cue exactly once, dash cue exactly once, no clamp cue;
3. A1 no-target deliberate P1 press: no-weapon cue once, cooldown unchanged; P2 retry does not spam sound;
4. A1 pickup still requires physical contact, and contact presentation never grants inventory itself;
5. A2 activation cue once, visual armor state lasts exactly real 3.0 s;
6. every armored hit uses the same `robot_a2_armor_hit` mapping; no heavy Robot SFX exists;
7. A2 end cue occurs exactly once on real expiry;
8. A2 still applies 0.45 incoming multiplier and never blocks CC;
9. production passive with null thresholds emits no fake milestone/refund; test-only thresholds prove milestone and upgrade presentation events/SFX independently;
10. real weapon art is still the held weapon, and Robot firing only adds chassis recoil;
11. ordinary movement heading/path is unchanged by presentation;
12. no second AudioContext and Robot files participate in the existing preload/readiness/session lifecycle;
13. teardown/new-match produces no stuck armor pose, stale trails or delayed SFX.

## 14. Required visual evidence

This task cannot be accepted from tests alone. Produce owner-playtest evidence from the REAL game, not an isolated mockup.

Capture at useful scale at least:

- idle Robot;
- moving Robot showing inertial articulation;
- Robot holding a real APEX firearm;
- real firearm recoil on Robot;
- A1 recognize/focus;
- A1 commit/dash;
- physical weapon contact + held settle;
- A1 no-target response;
- A2 index/start;
- A2 locked active pose;
- A2 hit from at least two incoming directions/intensities;
- A2 release/end;
- wall-bounce response;
- passive milestone + upgrade via test-only threshold harness, clearly marked test-only.

Also provide a short playable preview/build for owner feel-test. Screenshots are evidence, not owner acceptance.

Use the supplied HTML side-by-side as the visual authority. The Robot must retain the same identity, material split, silhouette, articulation grammar and skill choreography. Environment adaptation is allowed; aesthetic reinterpretation is not.

## 15. Completion report

Do not say “done” without concrete evidence. Report:

- start SHA and final SHA;
- branch;
- exact changed files;
- exact final 8 SFX paths + SHA verification;
- implementation architecture;
- confirmation that gameplay numbers/laws are unchanged;
- targeted gate results;
- full regression/build/browser results;
- links/paths to visual evidence;
- any remaining blocker honestly.

If a hard visual blocker makes exact reconstruction impossible, preserve the accepted design and report the blocker. Do NOT silently substitute a simpler generic Robot.

# FINAL CHECKSUM

- BASE: newest playable Slime tree `84d386337d97ed4575a0cf476ecf05ec54321660`.
- HTML = presentation authority.
- APEX = mechanics/environment authority.
- 8 final SFX only.
- NEW A2 open = robot-step.
- A2 hit = mechanical-crate-pick-up.
- A2 close = robotic-engine-malfunction.
- no clamp sound.
- no heavy A2-hit sound.
- no invented passive thresholds.
- no Robot redesign.
- no gameplay rebalance.
- no Slime regression.
- implement the whole Robot, not just VFX or SFX.