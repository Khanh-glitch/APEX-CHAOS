# APEX CHAOS // ARSENAL QUEST — POST-C OWNER FEEDBACK REVISION CONTRACT

**Date:** 2026-09-24  
**Status:** IMPLEMENTATION AUTHORIZED  
**Branch:** `arena/01a0cf5e-apex-chaos`  
**Baseline at freeze:** `08c4744b10fc76bdd2127007976d4e0a17df8141`

This contract is a post-Checkpoint-C owner revision. It does **not** reopen or restart Checkpoint C. Preserve the completed C weapon art, final SFX lock, high-speed tracer/collision work, grenade continuity, Chamber 01 foundation, and all verified compatibility work unless a rule below explicitly supersedes it.

## 1. Hard owner changes

### 1.1 Runtime VFX must have clean transparency
Normal Arsenal gameplay must never show a rectangular black/white/matte background around smoke, spark, muzzle, impact, or explosion art.

- Audit every runtime VFX actually referenced by Arsenal.
- Fix offending runtime derivatives in the build/materialization pipeline; do not destructively edit source staging.
- Verify alpha in decoded pixels and in the real browser. A filename or image viewer appearance is not proof.
- Add a QA assertion that catches opaque background corners / full-frame matte regressions where applicable.

### 1.2 Spawn cadence = 3.0 seconds
Change `SPAWN_CADENCE_SECONDS` from 4.5 to **3.0 seconds**.

Update all tests/evidence gates that currently encode 4.5 seconds. Keep reveal/pickup timing laws otherwise intact unless a regression proves a specific adjustment is needed.

### 1.3 Every Senko v9 asset becomes a usable gun pickup
The source family contains **24 SVG assets**. All 24 must be represented as actual spawnable gun weapons in Arsenal, not merely stored as unused donors.

Preserve four compatibility IDs:
- `PISTOL` -> `colt.svg`
- `SMG` -> `MP5.svg`
- `SHOTGUN` -> `SPAS 12.svg`
- `SNIPER` -> `Snipex Alligator.svg`

Add distinct spawnable gun IDs for the remaining twenty assets:
- AK-47
- Beretta 93R
- MAC 10
- Mossberg 500
- Zbroyar Z-15
- Zbroyar Z-15 skin1
- Zbroyar Z-15 skin2
- Zbroyar Z-15 skin3
- desert deagle
- glock-17
- m16
- m249 saw
- magnum 500
- p90
- pancor jackhammer
- project MBR
- project MBR2
- sawed-off shotgun
- szecsei & fuchs
- tec 9

Variants may share a ballistic family implementation, but each listed asset must be separately spawnable and visually use its own v9 art. Do not create text/shape substitutes.

Use a data-driven gun registry rather than twenty copy-pasted one-off runtimes. Each entry must define its family/recipe, cadence/burst/magazine behavior, projectile profile, recoil/motion signature, muzzle/casing anchors, and SFX family.

Approved SFX baseline remains authoritative:
- pistol / handgun family may reuse the existing pistol baseline;
- automatic rifle / SMG family may reuse the existing automatic baseline;
- shotgun family may reuse the existing shotgun baseline;
- precision / heavy rifle family may reuse the existing sniper baseline.
Do not reopen random SFX sourcing for this revision.

The source page/provenance evidence for Senko v9 must remain recorded before public release.

### 1.4 Melee spawn weight is halved
The current reveal selector is uniform. Replace it with explicit weighted selection.

- each melee weapon raw weight = **0.5 × the baseline non-melee item weight**
- gun / grenade / defense raw baseline weight = 1.0 unless a later owner balance pass changes it
- do not implement this by deleting melee entries or by relying on gun-count dilution

The selection function must be deterministic-testable with injectable RNG or equivalent QA seam.

### 1.5 Melee changes: decide immediately on pickup
For `SABRE`, `BATTLE_AXE`, `DAGGER`, `SPEAR`, `SPIKED_CLUB`:

**At the pickup moment only:**
- if opponent is inside that weapon's melee trigger range, immediately commit its existing iconic melee attack;
- otherwise immediately throw the weapon straight toward the opponent's position/aim vector at release.

Do not hold a melee weapon waiting for the opponent to later enter range.

Thrown melee rules:
- no homing after release;
- use the actual weapon sprite in flight;
- swept/continuous collision against fighter and walls;
- on fighter hit, deal damage once and visually stick/pin into the opponent for approximately **1.0 second**, following the target during the pin, then make a physical exit/cleanup;
- on wall hit, ricochet with a deterministic per-weapon maximum bounce count from 1–4;
- physical-family mapping is fixed for this revision: Battle Axe = 1, Spiked Club = 1, Spear = 2, Sabre = 3, Dagger = 4;
- if bounce budget is exhausted without a fighter hit, exit physically; fade may only appear at the very end of cleanup.

All melee direct damage is **+50%** versus the current C values. Prefer one shared 1.5 multiplier or equivalent centralized authority so melee and thrown-melee cannot drift apart.

Weapon aim remains independent of fighter movement. A thrown melee weapon must not rewrite the fighter's movement vector.

### 1.6 P1 cooldown-only skills become J-triggered active skills
In Arsenal mode, for the human-controlled P1 only:

- a discrete skill whose old trigger is effectively `cooldown <= 0 -> auto-cast` must stop auto-casting;
- its cooldown still recovers normally;
- when ready, it waits for an edge-triggered **J** press;
- one J press is one activation pulse; the first eligible ready active skill that successfully consumes the pulse wins; other ready actions remain ready for a later press;
- do not consume J or start cooldown if activation has no valid target/state and therefore fails.

Do **not** convert reactive/passive identity mechanics merely because they contain timers. Collision, wall-bounce, on-damage, threshold, contact, resource, status, and other event-triggered mechanics remain event-triggered.

P2 keeps the existing automatic behavior. This is a P1 control change, not a global rewrite of fighter AI.

Implement an explicit Arsenal manual-skill gate/registry and audit every fighter shell against it. Do not scatter ad-hoc keyboard checks through unrelated fighter code.

### 1.7 Add NEWBIE
Add a new Arsenal-selectable hero named **NEWBIE**.

Identity:
- simple neutral beginner shell; no text/glyph inside the arena;
- one active skill, cooldown **10 seconds**;
- activation bends the current trajectory toward the nearest eligible **REVEALED** weapon pickup and performs a fast non-teleport dash toward it;
- if no eligible revealed pickup exists, activation fails and cooldown is not consumed;
- P1 uses J;
- P2 may use the same ability automatically on cooldown as a narrow hero-specific exception to the normal no-weapon-seeking-AI law.

Do not hard-freeze dash speed/duration before in-browser feel validation. Tune the smallest values that make the trajectory break obvious, fast, and controllable without teleporting.

Adding NEWBIE expands Arsenal compatibility/selection coverage from 32 to **33** shells. Update QA accordingly.

### 1.8 No text or glyphs inside the Arsenal battlefield
In Arsenal mode, render **zero text or typographic glyphs inside the arena canvas**.

This includes, at minimum:
- Chamber 01 title plate;
- Z-01 / Z-02 / Z-03 / Z-04 labels;
- the telegraph `?`;
- missing-weapon ID text fallback;
- floating combat words/numbers;
- fighter-drawn labels/counters/symbol-font glyphs inside the arena.

Keep useful information in external HUD/debug UI outside the battlefield. Do not remove F3/debug instrumentation merely to satisfy this visual rule.

Normal non-Arsenal modes must not be globally stripped of text.

## 2. V9 source staging authority

The game repo must be self-contained for implementation. The full 24-file Senko v9 source set is staged under:

`tools/arsenal-assets/source/guns/senko-v9/`

Source family:
`https://senko-otter.itch.io/weapon-2d-models`

Vault snapshot used to complete staging:
`Khanh-glitch/APEX-CHAOS-ASSET-VAULT @ d0809fdd0079bedc41dcb6ffb033a2574c3d5be1`

Vault provenance states that the source page previously allowed free use / no attribution and requires preserving source-page evidence before public ship. Do not substitute a different gun family.

## 3. Implementation architecture

Prefer:
- a data-driven gun registry feeding the existing Arsenal weapon runtime;
- shared firing-family executors for semi-auto, burst, full-auto, shotgun, heavy/precision, and special multi-barrel behavior;
- shared thrown-melee state machine;
- weighted spawn selector;
- mode-scoped P1 manual-skill gate;
- mode-scoped text suppression;
- source-to-runtime VFX alpha processing.

Preserve:
- continuous/swept projectile collision;
- high-speed tracer language;
- spent casing language where mechanically appropriate;
- C weapon motion quality;
- final SFX lock;
- grenade continuity;
- no fighter-movement rewrite from weapon aim;
- `main` untouched;
- `playtest/arsenal` frozen until review.

## 4. Verification / definition of done

Do not hand back a partial demo. The revision is owner-review-ready only when the complete set below passes from one exact SHA:

1. Spawn cadence is 3.0s and old 4.5s QA expectation is gone.
2. All 24 Senko v9 gun assets are present in source staging, materialized, registered, separately spawnable, and can fire/resolve without runtime errors.
3. Weighted RNG proves every melee item has 0.5 baseline raw weight.
4. Each melee proves both pickup branches: in-range immediate melee and out-of-range immediate throw.
5. Thrown melee proves swept hit, ~1s pin, per-weapon 1/1/2/3/4 bounce caps, no homing, and physical cleanup.
6. Melee damage authority proves exact 1.5 multiplier.
7. P1 cooldown-only skills do not auto-cast; J activation works; reactive/event skills still trigger naturally.
8. NEWBIE is selectable, has 10s cooldown, targets nearest revealed eligible pickup, and does not consume cooldown when none exists.
9. Arsenal battlefield screenshots contain no in-canvas text/glyphs.
10. Runtime VFX screenshots show no matte rectangles/backgrounds.
11. Existing grenade identity, projectile speed/collision, final SFX, weapon aim independence, and all prior C critical gates remain green.
12. Automated headless suite plus real-browser suite are refreshed from the exact final SHA.
13. Review actual normal-speed gameplay, not only frozen screenshots.

## 5. Git law

- Work only from the current remote tip of `arena/01a0cf5e-apex-chaos`; fetch before implementation.
- Do not modify `main`.
- Do not move `playtest/arsenal` during implementation.
- Preserve committed good C work; do not reset to an older kickoff SHA.
- After Agent completion, ChatGPT audits the exact pushed SHA and only then decides whether it is owner-playtest-ready.
