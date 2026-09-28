# CP-HR7 — Legacy runtime quarantine / load cleanup audit

Date: 2026-09-28 · Branch: `arena/01a0e086-apex-chaos` · Scope per
`05_IMPLEMENTATION_TASK_FINAL.md` §CP-HR7: *"Audit before removing anything
from Quest load groups. Goal: Quest should no longer load old Hero runtimes
merely for retired roster behavior. Measure before/after: menu
responsiveness, Quest readiness, long tasks, request/script evaluation work.
Do not reduce combat VFX quality."*

## 1. Inventory — what the Quest group loads today

`src/game/runtimeManifest.js` `MODE_DEFERRED_RUNTIMES.arsenalQuest`
(the group both the background warmup `WARMUP_GROUP_SEQUENCE` and every
match start ensure):

| Runtime(s) | Serves | Verdict |
| --- | --- | --- |
| `BATTLE_CORE_RUNTIMES` (incl. `ROSTER_RUNTIMES`: shotgun, engineer, soccer, ice-visual, string, galaxy, katana, fang + core guards/balance) | The **legacy encounter layer**: the 14 non-canonical Quest bosses (PAINTER, DRUM, CARD, MATH, BLADE, TOXIC, ORBIT, FLASH, ELECTRIC, VAMPIRE, SAW, WOLF, WITCH, MONK→KUNGFU) resolve through `typeFor → baseTypeFor → FighterTypes`, which these runtimes populate. The manifest comment marks the order **load-bearing** (chain-wrapped `populateRoster`/`syncSelectedFighterVfx`). Also carries `apexCanonicalBalance` — the per-hero numeric tuning the damage pipeline reads (e.g. CRYSTAL `taken ≈ 0.686`). | **KEEP** — encounter behavior, not retired-roster behavior |
| `arsenalCWeaponSet.generated`, `arsenalQuestConfig`, `arsenalIdentityRuntime`, `arsenalWeaponRuntime`, `arsenalSpawnRuntime`, `arsenalPresentationRuntime`, `arsenalFeelRuntime`, `arsenalStormbreakerVfxRuntime`, `arsenalManualSkillGate` | Arsenal combat/feel/presentation for every fighter, rework and legacy alike | **KEEP** |
| `hero-rework/ailRuntime`, `hero-rework/heroRegistry` | AIL + canonical-12 registry; loaded *before* shell select so the cutover is active wherever shells resolve; also in `ARSENAL_HUB_RUNTIMES` (hub critical path) | **KEEP** |
| `arsenalShellSelectRuntime` | Playable-12 pools + `typeFor` compat (KEEP/ADAPT) for the encounter roster + the retired NEWBIE legacy kit (`makeNewbieType`) | **KEEP** (see §2) |
| `arsenalQuestLadder`, `arsenalMetaRuntime`, `modes/arsenalQuestRuntime` | Quest map/save/mode | **KEEP** |
| `hero-rework/heroMechanicsRuntime`, `hero-rework/heroReworkRuntime` | Rework mechanics + integration; wrap the quest runtime's step/entry/exit hooks | **KEEP** |

## 2. Retired-roster-only code found

Exactly one candidate: **`makeNewbieType()`** (the legacy NEWBIE dash kit +
its `J` HUD branch) inside `arsenalShellSelectRuntime.js`.

- Post-cutover, `shellTypeFor('NEWBIE')` resolves NEWBIE → the ROBOT rework
  shell **before** the `name === 'NEWBIE'` legacy branch is reachable, so
  the legacy kit is dead code in production (reachable only if the registry
  is absent or `productCutover` is forced false — i.e. a pre-cutover
  fallback path).
- It lives in a file the Quest group must load anyway (shell select), so
  quarantining it saves **zero** requests/bytes/evaluation time.
- Decision: **quarantined in place** behind the cutover condition (its
  comment already documents the retirement). Removing it would only delete
  the pre-cutover fallback path and buy nothing on the wire.

## 3. Conclusion

**Nothing in the Quest load group loads merely for retired roster
behavior.** The legacy fighter runtimes are required by the Quest
*encounter layer* (original boss identities per doc-06), not by the retired
playable roster. Therefore no load-group change is made: before == after by
construction, and the CP6/CP7 loader architecture (menu-critical runtime
only → warmup `arsenalQuest` → `select`; hub critical path
`ARSENAL_HUB_RUNTIMES`; priority-preemptable sequential loading) is
preserved unchanged.

## 4. Measurements (unchanged load → recorded for the record)

Captured on the dev-server build with real Chromium (CDP), fresh profile:
`docs/hero-rework/evidence/cp-hr7-load-measure.json` — menu-interactive
timing, warmup long tasks (count/total), ARSENAL hub entry latency (the
production `ARSENAL QUEST` menu button → `aq-meta-root`), Quest map entry +
gameplay-ready barrier, and per-script request/evaluation work for the
Quest group. Run twice (A/B) on the same tree to show run-to-run noise; no
before/after delta exists because the audit concludes no change.

Combat VFX quality: untouched — no presentation/spawn/storm runtime was
modified or removed in this checkpoint.
