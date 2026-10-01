# Hunter V1.1 + Gold V10 — Evidence (reconstructed candidate)

Reconstruction on top of Robot checkpoint `43fd4fcfd2e838b13b0218b4c0b33c660fd98369`,
from the recorded lost-candidate state of the previous workspace (that commit,
`e86d660…`, was lost in a workspace re-provision before it could be pushed; this
candidate intentionally has a NEW SHA and reproduces the recorded implementation,
diff structure, values, and validation outcomes).

Not a release-final declaration. Stop for hostile audit and owner review.

## Files

- `hunter-gates.json` — focused Hunter browser gates, 11/11 PASS, errors 0.
- `hunter-v10-owner-reel.webm` — 75.0 s, 30 fps, 1440×1000, VP9, silent owner reel.
- `reel-telemetry.json` — per-30-frame fixture telemetry + event log for the reel.
- `armed.png` — clean ARMED trap with Hunter body at rest (no squash, no orb).
- `robot-gates-report.json` — Robot safety re-run, 10/10.
- `slime-owner-fix-gates-report.json` — Slime owner-fix re-run, 7/7.
- `launcher-smoke-report.json` — launcher smoke 16/17 (see known flake note).

## Methodology

- Deterministic capture: two real `APEX_ARSENAL.step(1/60)` per output frame; no
  interpolation, no speed-up, no demo actor, no fake prey, no standalone Gold
  `Stage.step`/render loop. Captions and scene arrangements are fixture
  annotations over the real production game; the on-screen HUD is production DOM.
- `#menu-screen` is hidden at fixture level only (real play enters via the UI).
- All trap triggers, roots, expiries, pounces, weak procs and dodges run through
  real gameplay code paths; presentation never decides success.

## Focused gates (11/11, errors 0)

1. A1 three charges / no extra lock — failed second cast consumed nothing, recharge unchanged.
2. Opposite physical recoil — rightward and leftward pre-cast movement produced opposite measured retreats; body and Gold rig aligned.
3. Three independent traps, shared materials — per-trap `_rt` instances distinct; cache stats rootLoads 1 / bodyLoads 1 / derivations 7.
4. Sequential recharge + cleanup — 0→1→2→3 charges while a trap expired; no stale traps.
5. Real trigger lifecycle — armed,tension,snap,pin,release; consumed by real ICE body; expiry never captures.
6. A2 prelaunch/chase/swept/zero-damage — frozen during 0.16 s, then live direction-change chase; swept contact; no HP change; PounceWeak swept:true.
7. WEAK law — 3.0 s duration, incoming ×1.25.
8. Passive proc/lockout/T6 — seeded 24% dodge once, then 0.45 s lockout 0, T6 0, rejected 0.
9. Passive requires prey — untransformed ICE never enables a proc.
10. Exceptional escape — controlled teleport escape: no WEAK, no CATCH pose.
11. Match reset — 3/3 charges, zero stale traps.

## Owner reel coverage (75 s)

Native locomotion · three A1 casts in opposite travel directions (physical retreat) ·
three independent ROOT traps armed simultaneously · real opponent walks into a trap →
SNAP/PIN/root · release with no capture · sequential recharge with no 11s-style lock ·
two real Pounce→WEAK sweeps with live direction change · Killer Instinct dodge on a
seeded eligible real PISTOL projectile · real PISTOL fire at untransformed Hunter (no
proc) · T6 exclusion against a real production STORMBREAKER thrown weapon · Arsenal
weapon interaction during WEAK · repeated casts and independent cleanup · controlled
exceptional escape with no fake CATCH/WEAK · rematch reset. Final independent
cache check: three simultaneous traps, `derivations 7`.

## Known pre-existing flake (NOT a Hunter regression)

`smoke-robot-dash-moves-to-pickup` fails on clean `43fd4fc` as well: its 0.2 s step
budget is below the Robot's 0.26 s windup, so it passes only when the pushed pickup
happens to be consumed early. Verified in the previous session by stash-running the
clean checkpoint.

## Reconstructed differences vs the lost recorded candidate

- NEW SHA (expected; lost SHA intentionally not reproduced).
- Evidence frames hide `#menu-screen` at fixture level (previous armed.png was not
  re-verified before loss; reel captions/annotations unchanged in spirit).
- `tools/recordHunterV10Reel.mjs` differs cosmetically (2 line wraps); identical behavior.
- Reel telemetry/README wording reconstructed; methodology and coverage identical.
- Everything else — production files, hunk structure (13/13 on heroReworkRuntime),
  registry values, manifest entries, HUD integration, generated Gold runtime (exact
  2064-line stat), asset part set (12 PNGs), gate names/outcomes, cache stats —
  matches the recorded lost-candidate state.
