# Legacy SLIME Double-Execution Audit — 2026-09-28

**Task:** docs/hero-rework/phase1/10_ROBOT_SLIME_MODEL_QUALIFICATION_TASK_2026-09-28.md (Q3a:
legacy/rework SLIME separation).

**Law being enforced:** a canonical playable **REWORK** SLIME (the `makeReworkShell`
type from `public/game/arsenal/arsenalShellSelectRuntime.js` — `arsenalShell: true`,
`__hrHero: 'SLIME'`, `compatKit: 'REWORK'`, documented "runs NO legacy kit
(no-double-execution law, docs/hero-rework/phase1/04)") must execute **only** the
frozen Rework SLIME mechanics (A1 Mitosis / A2 Damage Shedding / Passive Emergency
Mitosis, hero-rework layer). Legacy/boss SLIME (legacy `FT('SLIME')` type, used by
Quest/boss encounters and non-roster modes) keeps its legacy mechanics. **No double
execution.**

## Method

Whole-production-tree search (`public/`, excluding `public/game/hero-rework/` which
IS the rework layer) for:

- `name === 'SLIME'` / `FT('SLIME')` / `'SLIME'` list membership
- legacy entity keys: `slime_child`, `slime_mucus`, `slimeDmgWindow`,
  `shockDmgWindow`, `childCounter`, `shockCounter`, `gelArmor`, `delayedGel`
- legacy spawn helpers: `addSlimeChild`, `addStableSlimeChild`,
  `addPrecisionSlimeChild`, `splitSlimeClone`, `splitStableSlime`,
  `splitPrecisionSlime`, `createSlimeMucus`, `resolveSlimeChild`
- `fighters.push` (clone insertion)

**Pre-fix live proof (headless real-runtime probe):** a `makeReworkShell` SLIME
(`type.arsenalShell === true`) taking one 60-damage weapon hit spawned
`projectiles: ["slime_child","slime_mucus"]` within the hit window, and subsequent
hits on the same body realized damage drifting between ×0.66 and ×1.87 of the
submitted amount — legacy `slime_child` guard projectiles absorbing up to 45% of
incoming damage (`apexEngine.js` takeDamage guard block) plus legacy gel-buffer DOT
ticks polluting measurement. This is the double-execution bug.

## Classification of every production path

### A. NAME-KEYED — EXECUTED ON REWORK-SHELL SLIME (the double-execution bug)

| # | Site | Behavior | Class |
|---|------|----------|-------|
| A1 | `public/game/core/apexPrecisionFixes.js` (~L72–89, takeDamage wrapper, `this.name === 'SLIME'`) | `childCounter`/`shockCounter` bookkeeping; spawns legacy `slime_child` guard projectiles (`addPrecisionSlimeChild`) on ≥4 damage/5s; **legacy emergency split `splitPrecisionSlime` pushes CLONE FIGHTERS into global `fighters[]`** (with HP duplication) on ≥max(8, 30% hp)/1s | **LEGACY ONLY — MUST NOT RUN ON REWORK SLIME** |
| A2 | `public/game/guards/apexFreezeDisappearHotfix.js` (~L199–205, takeDamage wrapper, `this.name === 'SLIME'`) | pushes `slimeDmgWindow`/`shockDmgWindow` entries consumed by the legacy type-update kit (spawn children, clone split) | **LEGACY ONLY — MUST NOT RUN ON REWORK SLIME** |
| A3 | `public/apexEngine.js` takeDamage ~L513–514 (gel armor, `this.name === 'SLIME'`) | damage REDUCTION ×(1−gelArmorReduction) when legacy `gelArmorTimer` set by legacy child resolution | **LEGACY ONLY — MUST NOT RUN ON REWORK SLIME** (inert-by-construction without legacy children, but it is a name-keyed damage modifier) |
| A4 | `public/apexEngine.js` takeDamage ~L522–543 (slime_child guard, `this.name === 'SLIME'`) | legacy `slime_child` projectiles owned by the victim **absorb up to 45% of incoming damage** (guard budget) — the observed damage drift | **LEGACY ONLY — MUST NOT RUN ON REWORK SLIME** |
| A5 | `public/apexEngine.js` takeDamage ~L564–568 (`slimeDmgWindow`/`shockDmgWindow` push, `this.name === 'SLIME'`) | damage bookkeeping feeding the legacy spawn/clone consumers; unpruned on shells | **LEGACY ONLY — MUST NOT RUN ON REWORK SLIME** |

### B. TYPE-SCOPED — legacy kit methods on the legacy `FT('SLIME')` type object

These rewrite `slime.init/update/draw` (or read it) on the **legacy** type. Rework
fighters use the shell type object (different object, `update` = `HR.shellUpdate`
only), so these **never execute** for rework shells — already separated by the type
object. They remain load-bearing for legacy Quest/boss SLIME.

| # | Site | Behavior | Class |
|---|------|----------|-------|
| B1 | `public/apexEngine.js` ~L1244–1287 (legacy `SLIME` type init/update/draw) | legacy Split Guard (`addSlimeChild` on ≥8 dmg/2s), gel armor decay, delayed gel DOT | **LEGACY ONLY — MUST NOT RUN ON REWORK** (already type-separated; proven by gate) |
| B2 | `public/game/core/apexCanonicalBalance.js` ~L396–406 (`mechSlime.update`) | legacy `slime_child` spawn from `slimeDmgWindow` (≥4 dmg, up to 8 children) | **LEGACY ONLY** (type-scoped) |
| B3 | `public/game/core/apexMajorMechanicVisuals.js` ~L190–205 (`slime.init/update`, `splitSlimeClone`) | legacy child spawn (`childCounter`), **clone split pushing 2 fighters into `fighters[]`** ("MITOSIS!") on shock >20% hp | **LEGACY ONLY** (type-scoped) |
| B4 | `public/game/guards/apexFreezeDisappearHotfix.js` ~L156–196 (`slime.init/update/draw`, `addStableSlimeChild`, `splitStableSlime`) | LAST-WRITER legacy kit: stable child spawn + **clone split into `fighters[]`** (≤4 bodies) | **LEGACY ONLY** (type-scoped) |

### C. COMPANION / SHARED — inert or generic for rework shells

| # | Site | Behavior | Class |
|---|------|----------|-------|
| C1 | `public/game/guards/apexSlimeBodyCap.js` | caps legacy clone teams at 4 live `fighters[]` bodies, prunes dead extras | **SHARED GENERIC (legacy companion)** — inert for rework (no clones exist); kept for legacy |
| C2 | `public/game/guards/apexRuntimeStability.js` ~L16–27 | same body cap inside the stability wrap + `fighters[]` pruning of dead extras | **SHARED GENERIC (legacy companion)** — kept |
| C3 | `public/game/core/apexPrecisionFixes.js` `updateProjectiles` (~L224) | `slime_child` death → `slime_mucus` | **SHARED GENERIC** (projectile lifecycle; only runs when legacy children exist) |
| C4 | `public/game/core/apexMajorMechanicVisuals.js` ~L262 | same mucus-on-child-death lifecycle | **SHARED GENERIC** |
| C5 | `public/apexEngine.js` `createSlimeMucus` (~L2938) + mucus entity | legacy hazard puddle entity | **SHARED GENERIC** (entity system) |
| C6 | `public/game/fighters/shotgunRuntime.js` (~L290) | `slime_child` listed as a targetable projectile type | **SHARED GENERIC** (weapon targeting) |
| C7 | `public/game/core/apexCanonicalBalance.js` ~L115–118 | HUD lines `BODY n CHILD k` (display) | **SHARED GENERIC (display)** |
| C8 | `public/game/core/apexCanonicalBalance.js` ~L510 (`standardBypassHint`) | standard-AI bypass hint when the SLIME owns live `slime_child`s | **SHARED GENERIC (AI hint)** — inert for rework (no children after A1 quarantine) |
| C9 | `public/game/core/apexCanonicalBalance.js` ~L243/247 | bot flavor preference lists | **SHARED GENERIC (AI flavor)** |
| C10 | `public/game/core/apexFightTelemetry.js` ~L230–232 | telemetry display of legacy child counts | **SHARED GENERIC (telemetry)** |
| C11 | `public/game/modes/soloRuntime.js` ~L102 | SOLO-mode start buff (+14 hp, 3.2s shield) for names `['VAMPIRE','SLIME','SUPERSTAR']` | **MODE-SCOPED** — runs only inside solo mode, not Arsenal Quest; out of qualification scope; left as-is |
| C12 | `public/game/arsenal/arsenalShellSelectRuntime.js` L15/28 | roster/alias lists containing `'SLIME'` | **REQUIRED FOR REWORK** (roster identity) |
| C13 | `public/manualLab.js` ~L1851 (`fighters.push`) | lab/test fighter spawning | **SHARED GENERIC (test surface)** |
| C14 | `public/game/core/apexCanonicalBalance.js` ~L41–93 (`CANONICAL_NUMERIC_TUNING` takeDamage wrapper, exported as `window.APEX_VISIBLE_BALANCE_TUNING`) | roster-wide numeric tuning: `tuned *= source.out * target.taken` on EVERY roster hit (SLIME `taken: 1.14`, ICE `out: 1.06`, …) plus `speed`/`cd` tunes | **SHARED GENERIC (roster-wide balance)** — applies uniformly to all 12+ names, not SLIME kit; stays. Gate L2 asserts its exact constant ratio and the ABSENCE of any SLIME-specific drift on top |

### Answers to the required proof questions (pre-fix state)

| Question | Proven answer |
|----------|---------------|
| modifies SLIME incoming/outgoing damage? | **YES** — A4 guard absorbs up to 45% of incoming damage when legacy children exist (observed ×0.66–×1.87 drift); A3 gel armor reduces damage when legacy gel state set; incoming bookkeeping A2/A5 feeds the legacy spawn loop |
| spawns legacy slime_child projectiles/entities? | **YES** — A1 (`addPrecisionSlimeChild`, observed live on a shell fighter), plus B1–B4 type-scoped spawners for legacy SLIME |
| performs legacy emergency splitting? | **YES** — A1 `splitPrecisionSlime` (name-keyed, ran on shells) and B3/B4 type-scoped `splitSlimeClone`/`splitStableSlime` |
| changes speed/radius/state? | legacy clones carry legacy type speeds; gel armor sets `data.gelArmorTimer/Reduction` (A3/B*); no rework-body speed/radius mutation found outside hero-rework |
| adds clones to global fighters[]? | **YES** — A1 `splitPrecisionSlime`, B3 `splitSlimeClone`, B4 `splitStableSlime` (all `fighters.push(c)` with HP copied from source = duplication) |
| heals/returns HP? | legacy `resolveSlimeChild` heals owner 50% of child damage (engine, only when legacy children resolve); solo mode C11 heals +14 (mode-scoped). No other name-keyed heal found |
| adds guard/mucus mechanics? | **YES** — A4 guard absorb; C3/C4/C5 mucus on child death |
| does synchronous heavy work on a large hit? | A1 runs inside the `takeDamage` call chain (counter prune + spawn + `fighters.push` clones + child copies) — the pre-stop probe measured this cost for the hitch diagnostic (Q4) |

## Quarantine decision (architecture fix, not symptom patching)

**Narrowest available discriminator already in the tree:**
`f.type && f.type.arsenalShell === true` — the rework shell contract
(`makeReworkShell`, docs/hero-rework/phase1/04 "runs NO legacy kit
(no-double-execution law)"). Legacy Quest/boss SLIME uses `FT('SLIME')` (no
`arsenalShell` flag) and keeps every legacy behavior.

Applied to the three name-keyed producers (A1, A2, A3, A4, A5):

1. `apexPrecisionFixes.js` — SLIME counter/split block skipped for shell bodies.
2. `apexFreezeDisappearHotfix.js` — SLIME damage-window push skipped for shell bodies.
3. `apexEngine.js` takeDamage — gel armor, slime_child guard, and damage-window push
   skipped for shell bodies.

Type-scoped legacy kits (B1–B4) are untouched (they never run for shells; load-bearing
for legacy encounters). Companion/shared paths (C*) untouched. Nothing renamed;
nothing deleted.

**Proof:** `tools/testHeroReworkSlimeLegacySeparation.mjs` (gates L1–L6) — rework
shell SLIME under the exact pre-fix trigger load spawns zero legacy entities, never
grows `fighters[]`, keeps zero legacy bookkeeping, and realizes the SHARED GENERIC
tuning ratio exactly (1.2084 per hit = `ICE.out 1.06 × SLIME.taken 1.14` read live
from `APEX_VISIBLE_BALANCE_TUNING`) with no per-hit drift and no legacy
`-slime-guard-leak`/`-gel-armor` labels; a legacy-type SLIME in a legacy match still
spawns its legacy children AND still clones into `fighters[]` (B-kits preserved);
the rework combatant stays live. Suite result at checkpoint: 6/6.
