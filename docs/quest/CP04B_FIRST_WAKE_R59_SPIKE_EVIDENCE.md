# CP04 — FIRST WAKE 2v2 (R59 Recovery isolated implementation)

**Status: HEADLESS + BUILD GREEN. NOT YET OWNER VISUAL/GAMEPLAY ACCEPTED.**

## Provenance
- Origin: `arena/r59-recovery-d032880` at R76 `53cb5b48b14d24d2bcc596a3ca5e4a54704a44dc`.
- Implementation: `quest/cp04-multi-actor-spike-r59` only. No commits on R59 Recovery.
- Runtime retains the original Arsenal / Hero Rework engine. No duplicated combat engine and no Quest-only damage scale.

## Implemented
1. A **dev-opt-in FIRST WAKE** mode builds four real `Fighter` instances: NEWBOT 1000HP, T.O.T 1000HP, SCRAP-A 350HP, SCRAP-B 350HP, with immutable Quest identities/teams. NEWBOT retains ROBOT's real active/passive implementation.
2. All four advance through canonical `Fighter.update`, `weaponApi.updateHolder`, floor pickup transactions, real `aqDamage`, and headless/rAF Arsenal stepping.
3. Quest targeting is team-aware in projectile earliest-TOI, thrown homing, grenade splash, gun holder aim, slot reveal/counter reservation and pickup. Both directions of friendly-fire filtering are covered by an adversarial real-projectile headless test.
4. FIRST WAKE end state is Quest-specific: NEWBOT KO -> RETRY, all hostiles KO -> COMPLETE, T.O.T KO alone -> continue. No fake 1v1 economy win.
5. Draws four actual Fighter bodies and real HP readouts. **Scout and Bulwark currently use a lightweight Gold-V12-inspired Canvas adapter**, taking palette and character geometry from `APEX_CHAOS_QUEST1_DEEPER_WEAPON_GRIP_V12.html`. It is **NOT** the complete V12 layered prerender/spring rig and is **NOT** visual-fidelity accepted. Reaver/Sentinel palettes are staged but not spawned in FIRST WAKE.
6. Gold 1v1 result timer/HUD never steals Quest's own outcome. Normal BOT/LOCAL behavior is behind the non-Quest path.

## Execution and evidence
- GitHub Actions run: https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37775341638
- `node tools/testQuestMultiActorCore.mjs`: **27 assertions PASS**.
- `node tools/testArsenalBattleHeadless.mjs --product-authentic --quest-first-wake`: **381 / 381 PASS**, zero failures, including seven new Quest-specific gates.
- Real PISTOL NEWBOT -> Scrap A: Scrap A 350 -> 280, ally T.O.T untouched. Reverse fire Scrap B -> T.O.T: Scrap A untouched.
- T.O.T collects real `REVEALED` PISTOL slot via production `SPAWN.resolvePickups`.
- Both Gold-derived models rendered on the actual shared world canvas (two confirmed calls).
- `pnpm build` PASS (GitHub runner; build ~5.88s).
- Headless evidence archived as `quest-cp04-real-engine-headless` in that run.

## Developer preview entry
On the **Quest branch**, load a normal Arsenal battle so the shared combat group exists, then execute in browser console:

```js
window.__APEX_QUEST_DEV = true;
window.__apexQuestFirstWakeStart();
```

This is a developer-only opt-in. It is NOT a public Quest entry, and the normal Home/Gold route remains unchanged. The standalone Gold V12 HTML should be used as a separate visual reference, not as a second combat authority.

## Unclosed gates before production integration
- Real browser and mobile visual/playability review. No claim of owner-accepted art.
- Full V12 articulated Gold spring rig transplant vs lightweight geometry adaptation.
- Multi-actor stress: 3–4 waves, melee/shield exotic cases, Counter Shield reservation, cap-5 full-load, 1v1 -> Quest -> 1v1 teardown, nonstandard bullet routing.
- Gameplay map/camera expansion and Quest-local HUD polish.
- REFLEX mandatory tutorial J/K and full scripted Quest Director/11 checkpoints are future checkpoints, NOT present here.
- Reconcile the latest moving R59 branch by diff before ANY proposal to merge. Never force-update or silently overwrite it.

**Merge status: NOT AUTHORIZED.** Stay on the Quest branch until owner playtest and explicit merge approval.
