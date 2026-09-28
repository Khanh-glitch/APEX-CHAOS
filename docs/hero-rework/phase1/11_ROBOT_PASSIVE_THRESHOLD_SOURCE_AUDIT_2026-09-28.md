# ROBOT PASSIVE — DAMAGE-MILESTONE THRESHOLD SOURCE AUDIT
Date: 2026-09-28
Scope: `robot.damage_milestones` — “use the existing visible cumulative
damage-dealt milestone ladder already present in game” (doc 02) /
“Exhaustively find the actual visible ladder source. If no authoritative
thresholds exist, report the blocker honestly and do not call the Passive
complete” (doc 10).

## Result — BLOCKER (thresholds unresolved)

**No authoritative “cumulative damage-dealt milestone ladder” with gameplay
milestone thresholds exists anywhere in the production code, UI, or design
docs.** The Passive stays RECORDING-ONLY (`milestoneThresholds: null`,
`milestoneThresholdsStatus: 'UNRESOLVED_OWNER_TUNING_DEPENDENCY'`): it
listens to credited realized damage dealt and records cumulative progress,
but it must not fire cooldown refunds on invented numbers. The Passive is
NOT complete and is NOT claimed complete. The refund SEQUENCE side is
frozen authority and is implemented exactly (milestone #1 = no refund,
#2 = 0.5s, #3 = 1.0s, #4 = 1.5s, subsequent +0.5s each, one proc per
milestone, credited realized damage dealt only).

## Search performed (exhaustive)

Whole-repo searches (public/, src/, tools/, server/, docs/, index.html,
src/App.jsx, all extensions):

- `milestone` — only the rework’s own robot.damage_milestones code and
  unrelated project-management wording (docs “milestones”).
- `ladder` — Arsenal Quest 20-stage ladder (stage identities), firearm
  “class ladder” (weapon tier baseline), Quest map copy. None is
  damage-dealt-based and none has refund semantics.
- `damageDealt` / `damage-dealt` / `damage dealt` — classic end-screen
  stats bars, TIME mark mechanic (legacy), tamChien telemetry. No ladder.
- `refund` — TIME legacy rewind 50% heal refund, ENGINEER scrap refund.
  Neither is a damage-dealt ladder for ROBOT.
- `streak` / `combo` / `rank` / `overdrive` / `RAMPAGE` in the engine —
  SUPERSTAR mediaStreak (attack chance), RUBBER superHits counter. No.
- legacy NEWBIE kit (`makeNewbieType`) — Weapon Dash only, no passive.
- `arsenalManualSkillGate.js` — cooldown gating only, no resource ladder.
- `shouldTriggerRage` — HP-ratio trigger (below 50%), not damage-dealt.
- `docs/owner-locks/` (arsenal-lab-v1, stormbreaker-v1) — no ladder.
- `docs/hero-rework/phase1/08` (Phase-1 handoff) explicitly lists
  “ROBOT milestone thresholds” under “Phase 1 is NOT owner-accepted for” —
  i.e. the design campaign itself never resolved them.

## Visible damage-dealt HUD systems found (near-candidates, NOT authority)

1. **Burst commentary tier ladder** —
   `docs/arsenal-quest/pass-b/PASS_B_PRODUCTION_COMBAT_HUD_AUTHORITY_2026-09-26.md`
   §9 + `public/game/ui/apexCombatHudRuntime.js` (`commentaryFor`).
   Visible rungs at 4.5% / 9% / 15% / 23.5% of target max HP (plus
   conditional CRITICAL RUSH / MOMENTUM SWING / big-hit DEVASTATING).
   Verdict: this is **presentation commentary** on a burst window that
   resets after 1.2 s silence. It is not cumulative match-wide, has no
   milestone indices, and nothing in its authority ties its rungs to
   cooldown refunds. Mapping rungs → milestone #1-#4 would INVENT the
   contract (“DO NOT invent ROBOT milestone thresholds”).
2. **ENERGY meter** — same doc §11 (`dealGain = 100 * realizedDamage /
   targetMaxHp`, 0..100, “READY” at 100). Visible and cumulative, but a
   single continuous resource meter, explicitly “TELEMETRY ONLY … Do NOT
   make current skills consume ENERGY in PASS B … Energy spending is a
   separate B2 gameplay-design task requiring owner playtest”. It defines
   no milestone rungs and no refunds.

Neither source is a milestone-refund ladder; neither authority authorizes
the mapping. Choosing one silently would repeat the exact failure mode this
qualification task forbids (“do not approximate ambiguous authority
silently”).

## Owner decision needed (exact blocker)

Supply the authoritative threshold ladder (cumulative credited realized
damage values at which milestones #1..#N fire). The implementation is
wire-ready: set `milestoneThresholds` (array of cumulative damage values)
in `robot.damage_milestones` baseConfig and the executor immediately
enforces the frozen refund law. If the owner intends the burst-tier
percentages (4.5/9/15/23.5 of target max HP) or ENERGY events as the
ladder, that mapping must be stated explicitly — it cannot be derived.

## Proof gates (see tools/testHeroReworkRobotGates.mjs)

- production config keeps `milestoneThresholds: null` + UNRESOLVED status;
- passive records credited realized damage dealt only;
- no MilestoneRefund ever fires without owner-resolved thresholds;
- the frozen refund SEQUENCE ([0, 0.5, 1.0, 1.5] then +0.5/step, one proc
  per milestone, refunding the currently relevant Active) is proven with a
  clearly labeled TEST-ONLY threshold fixture — the day the owner supplies
  real thresholds, the same path enforces them.
