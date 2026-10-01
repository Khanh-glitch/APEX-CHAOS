# MIRROR V1 — ONE-SHOT IMPLEMENTATION RUNBOOK

**This runbook is sealed until the preload commit is transplanted onto the owner's chosen final baseline.**

## Stage 0 — baseline activation gate

Before code edits:
1. read every preload file in README order;
2. verify canonical Gold hash/bytes;
3. record exact parent SHA/branch;
4. run/record baseline focused + broad tests so unrelated failures are known;
5. inspect the **effective shipping renderer and current Fighter.draw/presentation wrapper chain**; do not assume the preload snapshot's wrapper order still applies;
6. diff parent against preload-audit snapshot `df3f9fb...`; update only baseline-sensitive notes/tests, never Gold authority;
7. verify no parallel task is editing the implementation branch;
8. confirm working tree clean and remote parent exists.

## Stage 1 — canonical Gold harness first

Before production art code:
- create a harness that executes the exact canonical HTML directly;
- seed test randomness without editing the canonical file;
- capture direct Gold screenshots/state/transform/timing traces for V01–V16;
- derive tolerances from source output, not from production output.

This stage prevents the Magnet failure mode where a reconstructed engine was tested against itself.

Durable checkpoint + push + remote verify.

## Stage 2 — Gold engine port

Port Gold 12 as a coherent engine:
- exact part build/material hierarchy;
- HN64/HS22 history and channels;
- false-face roles/delays/wrong reflection;
- fixed 1/120 stepping / max12 substeps;
- A1/A2 authored phase state;
- passive shard/node visual state and canonical transform helpers;
- draw methods with strict canvas-state restoration.

Do not yet approximate signature effects to “get something visible”. Either the coherent Gold engine exists or this stage is incomplete.

Run direct canonical parity. Durable checkpoint.

## Stage 3 — gameplay truth adaptation

Implement `08_GOLD_FIRST_MECHANIC_LOCK.md`:
- A1 captured snapshot -> OWN-edge real equip -> 6s;
- A2 post-movement .25 exact live swap;
- shard formula/lifetime retained;
- Gold formation/radius/state/node lifecycle;
- per-owner networks;
- thin oriented surface + swept capture;
- real projectile escrow for bullet/grenade/thrown melee;
- neutral output/provenance/payload;
- .45 recapture lock.

Use real production entities. Do not create fake gameplay objects merely so Gold has something to animate.

Durable checkpoint.

## Stage 4 — thin presentation bridge

Map real truth into Gold:
- post-movement body/opponent samples;
- real hit/contact direction;
- actual weapon image for A1;
- actual opponent imagery for A2 local reflection states;
- real shard/node/projectile state;
- one Gold tick owner;
- one actor rendering owner;
- no generic MIRROR world double-draw.

If production input cadence differs from standalone Gold, translate the *input waveform/semantic event* while preserving Gold's authored engine; do not rewrite Gold output to compensate. This is the Magnet lesson.

Durable checkpoint.

## Stage 5 — parity and real-browser hardening

Run V/A/P/R/X/E suites.

Critical real-browser proof:
- real holder fire path, not synthetic projectile injection only;
- actual 2100–5800-class Arsenal projectile speeds where applicable;
- actual normal battle scale;
- P1 and P2;
- Mirror-vs-Mirror;
- visual layer provenance;
- rematch/teardown;
- no browser runtime errors.

A mechanic “ran” is not enough. The owner must be able to perceive the Gold behavior.

## Stage 6 — protected regressions

Run broad suites/build, compare failures to exact parent baseline, never edit unrelated production behavior to hide a baseline issue.

Relock runtime revision/hash only when implementation files are final.

## Stage 7 — final hostile audit

Repeat these questions:
- Does any production screenshot visibly depart from Gold for convenience?
- Is any Gold timing duplicated independently in gameplay and presentation?
- Is any test only proving the reconstruction against itself?
- Does a generic effect survive underneath/above Gold and alter identity?
- Does any real fast object skip the thin mirror surface?
- Does P1/P2 or Mirror-vs-Mirror change behavior/order?
- Does rematch leak history/nodes/escrow/jobs?
- Did any shared edit change a non-MIRROR match?

Only after these are clean may the implementation be called ready for owner playtest.
