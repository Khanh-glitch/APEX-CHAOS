# APEX CHAOS — QUEST 01 // Q0 CANON & IMPLEMENTATION CONTRACT
## THE ONES THROWN AWAY — audited handoff v1 (2026-10-08)

**Status: Q0 DOCUMENTED / OWNER REVIEW OF CONFLICTS REQUIRED. NOT QUEST IMPLEMENTED.**
This document inventories **what is already approved**, **what was subsequently chosen**, **what is still a proposal** and **what the code can prove**. It is not an authorization to change previously locked dialogue or silently solve a conflict. Human-readable spec below; Q0 machine-readable roster in `Q0_QUEST01_ENCOUNTER_LEDGER.json` is an index, **not a replacement for this text or the V1 authority**.

## 0. Exact baseline, isolation and intended outcome

- Repo: `Khanh-glitch/APEX-CHAOS`.
- **Original playable Quest branch:** `quest/cp04-multi-actor-spike-r59`, pinned SHA `350b9e234a165d3626cd388be7e66ebbd8c1f91c`.
- **This Q0 documentation branch:** `quest/q0-canon-contract-from-cp04`, created from that SHA, **never rewrite the playable branch**.
- Independently moving production branch: `arena/r59-recovery-d032880`, observed SHA `9f46481e689e27fb837027b092aa923c1b45daa7` (R79). Branches diverged; recent R59 acceptance run 37783892635 failed gate `postc-robot-dash-to-revealed`. Do not infer every R79 change is bad; diagnose before taking any commit from R59.
- CP04 CI previously GREEN: https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37777031756 — 27 selector assertions, real Arsenal headless, build, desktop Chrome physical click, and emulated mobile tap for `Continue Story` entry/exit. **Owner confirmed the deployed 2v2 starts.** These facts prove a slice, NOT all future multi-actor scenarios or visual fidelity.
- **Q0 write scope:** only docs/contract/source inventory. No combat, UI, main branch, Cloudflare, save/profile, gameplay, or economy changes.

### 0.1 Source of truth order

1. **Later explicit OWNER decisions** (Oct 8 discussion) override a narrower old design decision only where the user actually decided that point. Mark conflicting implementation decisions explicitly. Owner idea containing “maybe” is not an exact numeric lock.
2. **QIA, approved Oct 3**: [Quest 01 Implementation Authority V1](https://github.com/Khanh-glitch/APEX-CHAOS/blob/94427ddad881c7d13c73e9e91ed53b970ebd8791/docs/story/APEX_CHAOS_QUEST_01_IMPLEMENTATION_AUTHORITY_V1_2026-10-03.md). Explicitly supersedes earlier Quest gameplay notes.
3. **OPENING** first-boot/returning/resume authority: [Opening Player Journey V1](https://github.com/Khanh-glitch/APEX-CHAOS/blob/94427ddad881c7d13c73e9e91ed53b970ebd8791/docs/story/APEX_CHAOS_OPENING_PLAYER_JOURNEY_AUTHORITY_V1_2026-10-03.md) and **WORLD** [Story Bible](https://github.com/Khanh-glitch/APEX-CHAOS/blob/94427ddad881c7d13c73e9e91ed53b970ebd8791/docs/story/APEX_CHAOS_WORLD_STORY_BIBLE_V0_1_2026-10-01.md); preserve WORLD statuses `OWNER CORE` vs `STRONG WORKING DIRECTION` vs `OPEN`.
4. Recovered Oct 8 **CP01** (reviewed narrative draft) and **CP02** (design-review proposal), plus **CP03** (source-read architecture audit): synthesis, NOT higher canon authority.
5. [Superseded Quest gameplay V1](https://github.com/Khanh-glitch/APEX-CHAOS/blob/94427ddad881c7d13c73e9e91ed53b970ebd8791/docs/story/APEX_CHAOS_QUEST_01_GAMEPLAY_V1_2026-10-03.md) is historical only. Older UI Gold HTML and sample scene mockups are not narrative authority.

**Immutable labels:** `L` = verbatim QIA line, `A` = approved QIA/explicit-owner rule, `O` = newer owner-specific decision, `H` = recovered old line NOT approved, `R` = required beat without recovered exact text, `P` = design proposal, `G` = technical verification required, `X` = explicit source conflict. A successful code test cannot promote P/H/R to A/L.

### 0.2 Recovered source files (outside repo, available as project working artifacts)

For reproducibility, exact files and SHA-256:
- `APEX_CHAOS_QUEST01_MASTER_NARRATIVE_CP01_2026-10-08.md` — `7f073f321cb64f442726934002bbcb8a9d3a2135fbf4463e9acf28a7d8cd2dfb`. 10 narrative groups / 11 labels / 13 locked lines; status REVIEW REQUIRED.
- `APEX_CHAOS_QUEST01_CP02_ENCOUNTER_MAP_DESIGN_2026-10-08.md` — `62eb4bd1a6e4cf6001c9568a09f23b9ffcef77a6bf922ddc5d3babc3573fd427`. 8 encounters; proposals and gaps annotated.
- `APEX_CHAOS_CP03_R59_RECOVERY_COMBAT_ARCH_AUDIT_20261008.md` — `ac06d25d3fb2f48706493b76384c6ff35be43f8a45d1335bcb6e1b67220c43d5`. Source audit before CP04 spike, not a test report.
- **Exact rejected-in-current-game Gold donor:** `APEX_CHAOS_QUEST1_DEEPER_WEAPON_GRIP_V12.html` — `3817ab8b0ab674af9573704f20173ff1edfae5e26598f843b1dd1ab422ff3685`, 208,884 bytes. Contains separate spring rig/parts, palettes and four enemy variants `SCRAP SCOUT`, `IRON BULWARK`, `CLAW REAVER`, `CORE SENTINEL` (plus white operator). **The actual HTML remains outside the GitHub repo.** Must stage *exact* bytes as a donor artifact with verification before visuals are called accepted. Do not ask a future agent to reconstruct from filenames or screenshot.
- CP01/CP02 documents are available, but not copied into this repository by Q0; do not falsely mark them repo artifacts.

## 1. Global Quest laws (A unless noted)

- Playable protagonist displays **NEWBOT**; internal `ROBOT` engine key may stay. T.O.T is first friend; RIVET is third workshop survivor.
- **Auto-battle:** engine controls movement, aim, shots and pickup. Human controls **only J/A1 and K/A2**, keyboard/touch equivalent. Do not introduce WASD, aiming, team movement orders, QTE, third ordinary skill button, or separate combat engine.
- Production Arsenal is the ONLY authority for physical Fighter, HP, weapon slots/ownership, projectile, accepted damage, heal, stun, crit, KO. Normal `MATCH_HP=1000`; Arsenal equipment damage ×7 as canonical; normal spawn 4.5s; **global offensive active cap = 5**, including Weapon Rain/Breach. Preserve both-unarmed emergency firearm and healer production law.
- ROBOT J = physical dash toward nearest eligible *revealed* floor weapon; contact/equip must really occur, not teleport. ROBOT K = canonical Virtual Armor (~3s, 55% damage reduction, cooldown 10s per latest user plan), **does not cancel stun**. Passive modifies cooldown from accepted real damage bursts; no story-side synthetic charge.
- Stormbreaker not in ordinary pool. It must be the authentic single weapon and lifecycle; no free duplicate, synthetic bolt/HP/impact.
- No confirmed aliens/virus/Crystala/full Botfall exposition in this Quest. Network ID: NEWBOT `NO VALID NETWORK ID`; T.O.T and RIVET `REGISTERED`.
- Quest 01 ending is **T.O.T voluntarily holding the gate and permanently shutting down**, NOT dying from combat damage at the 120HP boss threshold, exploding, disintegrating or secretly surviving in normal service. **RIVET survives damaged/corrupted unresolved.** No Shop/Lucky Draw/Upgrade/account/reward spam over the final stillness.
- [O] Owner later chose a combined existing Gold health-bar envelope for 2 or 3 story allies; **N color-coded contiguous segments with fixed per-HP scale**, never stretch survivors when a segment vanishes. This is a presentation choice, not shared team HP. No extra Gold layout panel. Enemy wave count/progress must not be represented as fake pooled HP.
- [O] Enemy/ally readability must meet game-quality visual identity; simplistic CSS ground rings and palette-only approximations are **not approved visual output**. Frame-fidelity comparison required.
- [O] In a *specific future 3-ally Breach encounter*, allowed retreat when near death instead of in-combat demise, with team defeat when all three have withdrawn. **100 HP is provisional ("maybe 100"), not locked.** Auto handoff of only J/K control priority **NEWBOT → T.O.T → RIVET** (skip withdrawn), no movement control, no cooldown reset; AI can cast only for non-player-owned skills. T.O.T/RIVET skill kits are **NOT authored**.

## 2. Canonical story sequence and gates

**Ten authored content groups**, **eleven visible labels** because WAKE and REFLEX are two labels belonging to one opening group:
`WAKE → REFLEX → WORKSHOP / THREE FAILURES → FIRST WAKE → SCRAP SWARM → WEAPON RAIN → CHARGE THE BREAKER → BREACH WAVES → RIVET OVERRIDDEN → T.O.T LAST CHOICE → OUTSIDE`.

**8 physical encounters:** E01 REFLEX, E02 FIRST WAKE, E03 SCRAP SWARM, E04 WEAPON RAIN, E05 CHARGE THE BREAKER, E06 BREACH WAVES, E07 RIVET OVERRIDDEN, E08 T.O.T LAST CHOICE. Target first-play **~32–42m**, pacing target not a forced battle timer.

### E01 REFLEX — REAL authored opening 1v1
- Both NEWBOT/T.O.T 1000HP; RIVET appears **only at ending rescue**, not earlier.
- Authored R1 PISTOL favors NEWBOT; **accepted hit on T.O.T** => short story hold; R2 PISTOL favors T.O.T; **accepted retaliatory hit on NEWBOT**. Opening weapon pool is deliberately restricted.
- J reveal after R2 hit; later K reveal after successful actual J cast/short intervening combat. [O] Player chose **mandatory successful J AND K** before tutorial clears; a raw keydown, animation or rejected cast never counts.
- End requires both `HP <= 500` **and** mandatory J/K accepted. Preserve canonical 250HP safety floor as telemetered last resort, not a loophole or automatic win. [G] Deadlock scenario: R1/R2 or both HP thresholds can occur before valid J/K opportunity; director must stage/retry actual pickup opportunities *without inventing successful casts*.
- RIVET fires controlled real Stormbreaker suppression after both thresholds and tutorial gates; safe settle, blackout → WORKSHOP; **not canonical game over**.

### WORKSHOP — THREE FAILURES (narrative)
- RIVET repairs/helps, salvaged Stormbreaker, rig/local registered latch constraint; all three rejected units. No new lore villain; missing workshop dialogue remains R, not invented L.
- Network identity seed; RIVET cannot leave rig/operate simultaneously at this point.

### E02 FIRST WAKE
- `NEWBOT 1000 + T.O.T 1000` vs `SCRAP-A 350 + SCRAP-B 350`. Canonical pickup/weapon/damage. No unauthorized enemy skills.
- T.O.T downed alone need not fail; NEWBOT KO => retry; both hostiles KO => complete.
- [G] CP04 *playable spike* is currently fixed four Fighters, not generic N-actor system. Exit and Gold presentation incomplete.

### E03 SCRAP SWARM
- **Exactly two waves**: A `3×280HP`, B `4×220HP`. No third wave. NEWBOT is the mandatory combatant; T.O.T communicates from workshop in current narrative plan. 4.5s/cap5; HP/cooldowns persist; enemies have **no invented hero A1/A2/passive**.
- Wave spawned/cleared from real NPC KO, not arbitrary timers. Exact map expansion [P], test mobile before choosing.

### E04 WEAPON RAIN
- `2×450HP` enemies; T.O.T can ally if genuine multi-actor mechanics allow (condition, not guaranteed). Drop cadence phases `3.0s → 1.6s → 3 telegraphed burst`, all cap5. Stop after hostile KO AND scripted observation phase reached. No generic Stormbreaker; heals unchanged.
- [G] 1.6s *requested* cadence can be rejected at cap; measure requested/accepted/visible drops. Do not make a sixth active offensive item to create fake spectacle.

### E05 CHARGE THE BREAKER
- Inert, non-attacking **IMPACT ACCUMULATOR** is target, not hostile Bot. Its charge advances on final **accepted real damage**, including legitimate crit; **6000 is first-pass tuning**, not immutable story value. No default enemy or fail state; no K-use demand when no incoming damage.
- Spawn follows progress: `3.0s (0–50%) → 2.2s (50–85%) → authored 3 telegraphs (85–100%)`; cap5. Charge milestones 25/50/75/90/100%; then one Stormbreaker infrastructure pulse, distant relay answer.
- [G] Arsenal must target a legitimate noncombatant world object; no fake timer-to-6000.

### E06 BREACH WAVES — **CONFLICT BLOCKER BEFORE IMPLEMENTATION**
- QIA old law: RIVET **operates the rig**, NEWBOT + T.O.T fight, no base HP. Waves A `3×300HP @4.5s`; B `4×260HP @3.5s` (2 left/2 right, stagger 1–1.5s); C `3×320HP @3.0s` and **one 2-weapon burst**, cap5 throughout; no more than 4 newly activated hostiles simultaneously in v1. HP/CD across waves; no free full heal.
- [O] **Later user requested a 3-person joint defense: NEWBOT + T.O.T + RIVET all fighting** the coordinated scrapyard robot waves. Later discussion fixed **retreat on danger, defeat only when all 3 withdrawn, automatic J/K handoff NEWBOT → T.O.T → RIVET**; no manual movement, no manual target, no cooldown reset.
- [X-01] This is **not consistent yet** with RIVET continuously operating a required Stormbreaker rig. Need author-accepted choreography/mechanical handoff for RIVET to enter combat without breaking E05’s rig, E06’s relay, or E07’s takeover cause. Do **not** silently use an unmanned/remote/autonomous rig to evade this.
- [X-02] Retreat numeric threshold remains **candidate ~100HP**, not final. Need first-hit-downcross semantics (e.g. 400→0 does not combat-kill and bypass exit). [G] Damage/collision canonical, atomic state ACTIVE→RETREATING→WITHDRAWN; cleanup and one-time J/K reassignment including same-frame multiple withdrawals.
- [X-03] T.O.T and RIVET A1/A2 not authored; never fabricate skills. [G] Existing Hero Rework AI `p2CastAI` is index-bound (idx=1). Generalize *ability scheduler ownership*, not movement AI.
- End QIA continues: command traffic not from workshop; scan RIVET/T.O.T registered vs NEWBOT unregistered. No confirmed alien/virus reveal.

### E07 RIVET OVERRIDDEN
- RIVET reconnects cable involuntarily, says exact [L] “Lùi lại.”; NEWBOT vs RIVET, T.O.T outside combat lane.
- Both start at 1000HP through a **visible repair**. 4.5s/cap5; no Stormbreaker boss, no hidden boss damage or resistance buffs.
- On **first HP downward crossings** `750`, `450` cue command progression; `180` stop/settle immediately. Never let a large hit skip cues or kill RIVET. NEWBOT KO => retry from E07 start. RIVET remains damaged/corrupted/unresolved.

### E08 T.O.T LAST CHOICE
- Last workshop repair visibly sets NEWBOT/T.O.T to 1000 HP. Friendship beat has [L] lines below. RIVET too damaged to fight.
- First phase T.O.T 1000→700 (ordinary 4.5s/cap5); at first downcross 700, **one** genuine Stormbreaker becomes eligible and is aimed/picked up by T.O.T legally; canonical release **446 hit damage, 2s stun, speed 1350, homing 2.6rad/s, miss by 2.2s, floor bolt 0 dmg +1s stun**. Same artifact returns to cradle only after its actual lifecycle resolves. Checkpoint **immediately before Stormbreaker phase**.
- Resume ordinary pool until first downcross **120HP**; intercept lethal overflow, halt combat safely. T.O.T lives through this boss hit, gets brief agency, **chooses** to stay as registered latch. Final Stormbreaker gate discharge and permanent shutdown are story consequences, not combat KO. No QTE; no sacrifice input. NEWBOT alone outside.

## 3. Locked dialogue: EXACT 13 entries; immutable punctuation and speakers

The following 13 lines are explicitly in QIA and were recovered in CP01. Keys are indexing metadata **only**; dialogue must display verbatim:

| Key | Beat | Speaker | Text |
|---|---|---|---|
| L-01 | E07 override | RIVET | “Lùi lại.” |
| L-02 | E08 friendship | NEWBOT | “Chúng ta là bạn à?” |
| L-03 | E08 friendship | T.O.T | “Tôi nghĩ vậy.” |
| L-04 | E08 phase3 | NEWBOT | “Tôi không đánh nữa!” |
| L-05 | E08 phase3 | T.O.T | “Cậu phải đánh.” |
| L-06 | E08 phase3 | T.O.T | “Nếu cậu dừng...” |
| L-07 | E08 phase3 | T.O.T | “...tôi sẽ không.” |
| L-08 | E08 gate | T.O.T | “Từ lúc tỉnh dậy đến giờ... tôi chưa từng chọn được mình có nhặt súng hay không.” |
| L-09 | E08 gate | T.O.T | “Nhưng tôi có thể chọn mình làm gì với nó.” |
| L-10 | E08 gate | T.O.T | “Đi.” |
| L-11 | E08 gate | T.O.T | “Cậu muốn biết mình là ai mà.” |
| L-12 | E08 final | T.O.T | “Lần này...” |
| L-13 | E08 final | T.O.T | “...tôi dừng được rồi.” |

**Unapproved old dialogue [H]:** do NOT silently ship lines including “Tôi không dừng được.”, “Nếu tôi quay sang cậu... đừng chờ.”, “Ba lần liên tiếp không còn là ngẫu nhiên nữa.” or any recovered OLD lines. They remain candidates for owner review.

**Unrecovered required dialogue [R]:** REFLEX apology and T.O.T reaction; workshop/three failures; RIVET technical explanation; FIRST WAKE/Swarm responses; BREACH relay analysis; nuanced boss interruptions; OUTSIDE may intentionally be silent. Stub cue IDs or silence — **never create fake "original" quotes**. Full story voice/subtitle sign-off remains pending.

**Story system text [S]:** `UNKNOWN ROUTINE — J`; `STORMBREAKER CHARGE 0% → 100%`; `ACQUIRE/RETURN/SECURE/IDENTIFY`; `REGISTERED/NO VALID NETWORK ID`; `ELIMINATE TARGET`. Not character speech.

## 4. Current implementation evidence versus missing system

| Component | Verified at CP04 playable SHA | Missing next |
|---|---|---|
| 4-body combat | `public/game/modes/arsenalBattleRuntime.js` builds fixed four Fighters for opt-in FIRST WAKE; real `Fighter.update` and weapon holder calls; 2v2 health/damage/pickup test | N-actor registry, per-encounter compositions, waves, multi-target exotic weapon cases, non-player skill AI and cleanup |
| Team and targeting | `questMultiActorCore.js` pure selectors, spawn/HR Quest branches, 27 unit assertions, real two-direction PISTOL tests | Production-wide team filtering for all damage/exotics, cap5 pressure, hit/KO attribution across >4 |
| Entry/exit | Continue Story in `public/gold/shell.html` directs to FIRST WAKE; Chrome desktop/mobile pass; ESC route pass | Actual WAKE/REFLEX/WORKSHOP story entry; Quest Director, checkpoint/save/resume, win/retry/next and completion |
| Visual | `questGoldEnemyVisuals.js` Canvas palette/silhouette adaptation drew in headless | **WRONG Gold donor fidelity**: exact V12 articulated draw rig, weapon grip/spring feedback. Donor is not in repo yet |
| HUD/VFX | Existing 1v1 Gold functional as shell | 2/3 ally combined single bar, active J/K owner, enemy wave summary, team identity, crit loss on actor 3/4, big damage clipping |
| Tests | CP04 green 381-gate state in run 37775341638; later Chrome/mobile green 37777031756 | Full all-encounter E01–E08, life-cycle, save/checkpoint, UX perceptual tests and final E2E |

### Existing two-side seams with special attention

- `arsenalBattleRuntime`: START and update/KO/exits hardcode two or FIRST WAKE fixed four.
- `heroReworkRuntime`: match has `p1/p2`; AI cast only `idx === 1`, unsafe to assume T.O.T (body id 3) can use hero skills.
- `goldProductBridge`: `sideOfBody` recognizes Fighter ids 1/2; actor 3/4 realized hit/crit/Heavy feedback may be suppressed. Crit/Heavy priority and number clipping require real screenshot/impact tests, never global `overflow:visible` to hide the issue.
- `arsenalSpawnRuntime`: Quest-only FOUR-body enumerate patch is not a generic N actor registry; extend queries via one shared actor source, not scattered `state.questFirstWake` toggles.
- `src/game/runtimeManifest.js`: classic script order and Gold bridge handoff are sensitive; Quest code added as extra globals only after dependency proof.
- Old `arsenalQuest` 20-stage ladder from previous game prototype is **NOT Quest 01 narrative campaign** and must not be accidentally activated as a shortcut.

## 5. Engineering architecture contract for Q1 onward

**Never ship a second damage/weapon engine.**
- `Quest01Director`: only story state, authored event priority, objectives, wave progression, checkpoint transitions and narrative cues. Owns no synthetic bullets/HP.
- `QuestCombatAdapter`: deterministic `actorId`, `questRole`, `teamId`, `lifeState` (ACTIVE/RETREATING/WITHDRAWN/KO), query targeting and physical spawn/despawn via canonical Fighters/Arsenal; stable IDs and immutable team relations.
- `QuestAbilityAuthority`: maps the HUMAN J/K owner to exactly one living skill-bearing ally per encounter; other skill-capable allies may run their *existing* AI `aiEvaluate` and canonical `tryCast`. NO cooldown reset, no implicit hero kit. Input ownership not tied to `fighters[0/1]` or mutation of array order.
- `QuestViewAdapter`: projects canonical actor HP into the one existing Gold healthbar envelope with 1,2,or3 contiguous color segments; clear eliminated/withdrawn states; no layout reflow or duplicated panels. Quest VFX uses actual hit event owner/target identities and measured safe bounds. Quest Gold art uses genuine donor rig draw only.
- `QuestProgress`: versioned structured save with `questId`, `contentRevision`, `checkpointId`, `encounterId`, `phaseId`, `completedCueIds`, `stormbreakerArtifactPhase`, `sessionId` and migration. **Do not persist raw Fighter objects or unvalidated live projectile arrays.** Retry restores one deterministic safe checkpoint, not arbitrary halfway contaminated combat state.
- `QuestPresentation`: exclusive UI scene owner for dialogue/hold/transition; enforce single musical playback owner and safe pause/cancel of dangerous outstanding transactions.

**Objective and trigger patterns**:
- One-shot cue identity, first downward HP threshold crossing with ordered multiple-cross handling and accepted hit authority;
- active wave completes only after spawned enemies reach canonical KO/withdrawn transition and pending scripted cues resolve;
- charge only on actual accepted damage to registered inert accumulator;
- story hold has explicit control of spawn, attack scheduling, already-in-flight shot disposal and animation ownership;
- transaction-aware exit, explicit reason (VICTORY/RETRY/WITHDRAWN/SCRIPTED_CLEAR), never temporary HP invulnerability mistaken for completion.

## 6. Build plan, sequencing and handoff criteria

| Stage | Scope | Exit evidence |
|---|---|---|
| **Q0 (this branch)** | Freeze baseline; source precedence; encounter and dialogue authority; issue ledger; stage Gold donor provenance; CI baseline classification | Document & ledger readable; conflicts exposed; **no runtime change** |
| **Q1** | Director + 10 story groups/11 labels, save/load, test-only route from WAKE to OUTSIDE (no pretend combat completion), Continue Story resume | Browser physically enters WAKE, saves/reloads, deterministic transitions/escape; Bot/Local unchanged |
| **Q2** | Generic N-actor adapter, real multi-actor targeting/weapon/skill/AI, all effect families, cleanup and 1v1 regressions | Real 1v2/2v2/3v4, cap5, crit identities, no double-damage, restart/mode switch |
| **Q3** | Visual CP04 closure: port exact Gold V12 rig, crit/Heavy numbers, 1/2/3-segment HP within *existing* Gold envelope, faction cues | Owner screenshot/feel acceptance on desktop, phone SE, tablet, landscape; production regressions |
| **Q4** | WAKE/REFLEX/WORKSHOP + E02 linked end-to-end; mandatory real J/K plus accepted damage authored cues | Real new-player playthrough opening to FIRST WAKE completion/retry |
| **Q5** | E03/E04/E05; wave phase/cap5 telemetry + accumulator | Canonical wave/damage gates, measure suppressed vs accepted Drops; no fake charge |
| **Q6** | E06 after X-01/02/03 resolved: trio, retreat and J/K handoff | Same-frame withdrawal, AI cast policy, rig/story continuity, success/failure |
| **Q7** | E07/E08 and ending | HP thresholds, real single Stormbreaker, checkpoint/retry, all locked lines, T.O.T final shutdown |
| **Q8** | Full presentation/audio/subtitles, save migrations, performance | One scene audio authority, no duplicates, device-specific visual evidence |
| **Q9** | Full 32–42m target playtest, combat balance, regression and deploy acceptance | Owner plays WAKE→OUTSIDE; CI + screenshots + real device validation; no unintended freeplay changes |

**Fast critical path:** Q0 documents → Q1 route/persistence → Q2 general actor adapter → Q4 real opening E01/E02 → Q5 E03–05 → Q6 E06 → Q7 E07/E08 → Q9. Q3 art/presentation donor inventory can progress in parallel with Q1, but game integration requires signed art and tested lane. No extra architecture sprint not tied to an encounter.

**Each checkpoint must have:** starting SHA lease, exact changed paths, one test that fails before fix, actual data/assertions, browser/device screenshot where visual, diff to previous green, independent Bot/Local regression, owner-accessible preview, explicit remaining debt. Never declare "Quest playable" from only stub scene transitions.

## 7. Open decision/verification ledger — DO NOT AUTO-FILL

| ID | State | Issue | When blocking |
|---|---|---|---|
| **X-01** | OWNER DESIGN CONFLICT | RIVET in E06 rig (QIA) vs 3-way allied frontline (later owner direction). Who safely operates/maintains rig while RIVET fights? | Before Q6/E06 scripting |
| **X-02** | VALUE PROVISIONAL | retreat HP threshold "maybe 100", crossing overshoot handling, whether emergency exit is instantaneous or observable; no death | Before Q6 |
| **X-03** | ABILITY KIT MISSING | T.O.T and RIVET A1/A2 authoring + AI decisions needed for handoff | Before Q6 |
| **X-04** | TUTORIAL LAW CHANGE | Later mandatory accepted J/K vs QIA exit at both HP≤500; must prove legal cast opportunities and no deadlock | Before Q4/E01 |
| **X-05** | DIALOGUE RECOVERY | Old [H], required [R] lack exact owner-approved script; do not fake canon | Before final Q8 voice/subtitle acceptance |
| **X-06** | GOLD SOURCE STAGING | Exact 208,884-byte V12 donor recovered outside repo; staging, license/provenance and rig extraction; no palette-only rewrite | Before Q3 owner visual acceptance |
| **X-07** | BASELINE CONFLICT | R59 R79 diverged; recent run 37783892635 fails `postc-robot-dash-to-revealed` (cause unproven); do not silently import R59 branch | Before integrating R59 new code/merging |
| **X-08** | PERF & SCALE | HP segmented readability at 3 allies, 3–4+ simultaneous bots, FX budget and camera for mobile | Before Q6 release |
| **X-09** | DIRECTOR-SAVE | First boot QIA/OPENING flow vs current Home Continue Story directly enters FIRST WAKE | Q1 |
| **X-10** | NUMERIC TUNING | accumulator 6000 is first-pass; arena size ratios and falling scrap hazard are proposals, not approved hard laws | Before relevant encounter balance |
| **X-11** | USER-VISUAL-READABILITY | Crit sometimes missing when target isn't body 1/2; heavy vs crit priority and clipped big numbers; test exact live events/viewport | Q3 |
| **X-12** | OLD QUEST LADDER | Legacy `arsenalQuestRuntime/ladder` is not the scripted Quest01; do not mistake stage map for campaign progress | Q1 |

**Q0 completion means the facts are recorded and traceable — not that every X has been resolved.** Do not block Q1 on RIVET ability authoring or exact Gold V12 rig fidelity.

## 8. Immediate Q1 execution target (single next slice, no drift)

1. Create `quest/q1-director-from-q0` from Q0 green SHA after document review.
2. Implement **only** director state/saved checkpoint schema and deterministic story-node routing. `Continue Story` starts WAKE for fresh play, resumes persisted checkpoint for returning user.
3. Build real browser routing/refresh/retry tests; add test-only scripted transitions for incomplete scenes, **clearly marked TEST ONLY** and inaccessible in user-facing shipped story.
4. Reuse Gold loading/transition; no duplicate menu, no invented narrative lines, no camera/HP/art rewrite. FIRST WAKE still uses proven CP04 physical engine in its real node.
5. Before Q2, verify no regressions to BOT/Local and that no default story entry jumps straight to E02 anymore.

---
Q0 owner handoff: review only **X-01/02/03 when E06 design starts** and [H]/[R] dialogue before final voice; all other parts can proceed through isolated Q1 and evidence gates. Do not merge without explicit owner authorization.
