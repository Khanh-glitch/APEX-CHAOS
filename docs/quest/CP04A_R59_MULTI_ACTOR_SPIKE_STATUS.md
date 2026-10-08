# CP04a — Quest multi-actor selector spike (R59 Recovery)

Status: **PARTIAL / NOT A PLAYABLE 2v2**. This is a first isolated implementation checkpoint, not CP04 acceptance.

## Baseline and write-scope
- Origin: `arena/r59-recovery-d032880` at `53cb5b48b14d24d2bcc596a3ca5e4a54704a44dc` (R76).
- Feature branch: `quest/cp04-multi-actor-spike-r59`.
- No changes whatsoever to origin branch; no modification to the production runtime manifest.
- New files: `public/game/quest/questMultiActorCore.js`, `tools/testQuestMultiActorCore.mjs`, this report.

## Implemented as pure selectable policy (not a competing combat engine)
- Validate 2 allied + 2 enemy independent actor identities.
- Resolve hostile team relationships and nearest hostile target.
- Resolve earliest swept projectile-vs-circle collision among actual hostile actors, with deterministic tie breaks.
- Pick closest eligible physical body while delegating true pickup legality to Arsenal.
- Return FIRST WAKE result: NEWBOT KO -> retry; all hostile KO -> complete; T.O.T KO alone -> continue.
- No fake damage / HP healing; real Arsenal `aqDamage`, shot lifecycles, and equipment ownership are deliberately not replaced.

## What was checked
- JS execution of the committed selector source.
- Adversarial assertions in committed test script were executed as **27 PASS** with equivalent assertions in a V8 isolate.
- This run is *not* a full Node CLI test and is not a production browser/headless runtime test.
- To execute the committed test verbatim in repo working copy:
  `node tools/testQuestMultiActorCore.mjs`

## Specific source findings (R76, sha-anchored)
- `public/game/modes/arsenalBattleRuntime.js`: `resetState`, `stepSimulation`, `startArsenalBattleMode` hardwire two live fighters and 1v1 winner; body management needs a dedicated Quest runtime without mutating Bot/Local outcomes.
- `public/game/arsenal/arsenalSpawnRuntime.js`: pick ownership already iterates `pickupActors()`, but reveal/counter reservation scan `fighters[0/1]` only.
- `public/game/arsenal/arsenalWeaponRuntime.js`: direct `aq_bullet` and thrown-melee collision use first non-owner `fighters.find`, regardless of team; splash also needs team-awareness.
- `public/game/hero-rework/heroReworkRuntime.js`: existing `makeCombatant(0/1)`, `enemyOf`, `p2CastAI` are two-side semantics; multi-body hero support is not arbitrary team support.
- `public/apexEngine.js`: general `handleCollisions` and actor draw loop are two-slot.
- Gold UI and physical J/K input path are two-side projections. Quest UI must be separate; do not redefine accepted J/K skill laws.

## Do NOT declare done before next implementation gates
1. **Real FIRST WAKE frame step:** 4 independently updated Fighters, immutable team identities and targeting adapters.
2. **Real equipment:** 4 bodies acquiring slots through existing Arsenal slot phases; 5-slot production cap unchanged; exact ownership.
3. **Real ordnance:** bullet, thrown-melee, grenade, ricochet, shield, Stormbreaker exclusions; use real `aqDamage` exactly once, no friendly fire.
4. **KO/lifecycle:** correct NEWBOT retry, hostile completion and T.O.T disabled-but-not-fail, all cleanup on retry/exit.
5. **Game visual/input:** 4 real renderable actors and Quest HUD distinct from 1v1 Gold. No extra movement/QTE, J/K original functionality.
6. **Runtime proof:** headless integration + Playwright/browser interaction; BOT/LOCAL and Core Six Hero Rework baselines must remain green.

## Merge policy
Do not merge this partial selector spike into R59 production or present it as a playable Quest build. It is a safe committed basis for the next CP04 integration subcheckpoint.
