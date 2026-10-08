# Quest 01 — Q3 presentation staged evidence (2026-10-08)

## Immutable tested checkpoint

- Branch: `quest/q3-gold-v12-presentation-from-q2`
- Last **code** SHA: `190a8baf6b4b993d585cef06070b7116311089e3`
- Exact-SHA CI run: https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37802965605 — **SUCCESS** (Q1 Director, CP04, Q2 N-actor, full Arsenal regressions, build, real Chrome desktop/mobile click/touch).
- Q2 parent baseline: `7b2c64ff54717e7b12ab6afe540713f56cfd2871`. Quest-only branch. No merge to R59 or main and no live deployment.
- Gold owner V12 source: `docs/quest/donors/APEX_CHAOS_QUEST1_DEEPER_WEAPON_GRIP_V12.html`, 208884 bytes, SHA256 `3817ab8b0ab674af9573704f20173ff1edfae5e26598f843b1dd1ab422ff3685`. Recorded also in `Q3_GOLD_V12_EXACT_SOURCE_PROVENANCE_2026-10-08.md`.

## Implemented and verified — NOT full visual acceptance

1. `public/game/quest/questGoldV12Rig.js` transports the owner's layered /spring, /layouts, /vfx, /art and /presentation modules for **Quest hostiles only**. Per physical Fighter, a dedicated presentation instance is created. Real HP and real weapon fire pulses drive hit/recoil; Arsenal remains authoritative for movement, damage, collision, gun and winner. CP04 silhouette remains an observable fallback, not counted as V12 success.
2. Real Chrome acceptance, **two different hostiles** in FIRST WAKE: V12 renderer registered, `instances=2`, `draws>=10`, `failed=0` on both desktop and 390×844 mobile. Do not generalize this visual proof to four simultaneous enemy variants.
3. Gold physical surface is the *embedded base64* Battle HUD in `public/gold/shell.html`, not only `public/gold/battle-hud.html`. Both files are always updated together; byte-level source/payload equality was explicitly checked before each commit.
4. The two original Gold rails summarize the sum of each side's **independent** Fighter HP and max HP. Inside the same rail footprint, each actor has one fixed-width segment. In a real PISTOL hit test, SCRAP-A drops 350→280 while SCRAP-B remains 350; Gold reads 630/700 with per-actor ratios .8 and 1. Mobile narrow rail captions are suppressed Quest-only when they collide with aggregate four-digit HP numbers.
5. Real Gold HUD receives damage from Fighter id>2. Scrap-B physically shoots T.O.T: one 105-damage critical, three 70-damage normals, **exactly one Heavy** in the same real-victim rolling burst; 315 HP accepted in total. Heavy bookkeeping is per physical `questId`, not aggregated incorrectly across enemy victims.
6. Two enemy name labels may repeat. On-field AUTO/SHOTGUN popup identity remains per real Quest target; the two side panels are **allowed to aggregate** by faction per owner correction. Never mistake compact side aggregation for shared physical HP.
7. Quest NPC side no longer claims fabricated A1/A2 READY, player-two hero portrait, controls or misleading first-hostile equipment as team-level truth. Player NEWBOT J/K cards are retained. This is a **temporary truthful sparse state**, not final signed-off NPC-side composition.
8. No Quest story progression is fabricated by the FIRST WAKE developer preview; Q1 WAKE checkpoint and return/reload contract remain intact.

## Exact CI acceptance pointers

- Q3 source path: `.github/workflows/quest-q3-presentation.yml`.
- Browser acceptance: `tools/testQuestDirectorQ1Browser.mjs`: desktop and 390×844 mobile Chrome real physical input; two Gold V12 instances; aggregate and fixed segments; real PISTOL hit; off-primary CRIT and Heavy; NPC control truth; EXIT and checkpoint persistence.
- Arsenal headless: `tools/testArsenalBattleHeadless.mjs --product-authentic --quest-n-actors` and `--quest-first-wake`; Q1 Director and roster checks; production build.
- CI artifact `quest-q2-real-n-actors-and-browser` for run 37802965605 contains `quest-q2-browser/03-cp04-preview-four-fighters[-mobile].png` and `03b-cp04-after-real-hit[-mobile].png`.

## OPEN (explicitly NOT accepted/finished)

- O-01: Screen-space design review: desktop right faction panel is sparse; visually meaningful but truthful opponent panel needs owner acceptance.
- O-02: Original CP04 T.O.T presentation remains a simple placeholder on-field; original owner's Gold V12 donor is for four Scrap enemy models, not a complete T.O.T/RIVET ally presentation.
- O-03: Edge and hitbox-to-sprite scaling: Iron Bulwark can clip visually at arena boundary when its sprite is wider than its actual Arsenal radius; do not change physical collision to conceal this.
- O-04: Reaver and Sentinel use compiled Gold V12 modules but are NOT yet Chrome-screenshot accepted in real 3v4; exercise both plus duplicated same-species independent spring instances.
- O-05: Need actual held-gun grip, pickup, recoil, hit, A2 lock, KO visual choreography and performance evidence beyond the renderer-init check.
- O-06: 320×568 iPhone SE, 360×560, tablet landscape and 3v4 heavy-load sizing/clip acceptance still required. Chrome mobile emulation is not a physical-device playtest.
- O-07: Quest waves, spawn director, T.O.T/RIVET skills, AI schedule and RIVET rig/faction storyline disagreements belong to later Q4–Q7, **not a reason to fork this Q3 task**.
- O-08: No deployment to the production Cloudflare Pages URL; current work is branch-only.

## Resumption law

Verify Q3 branch HEAD and **green code parent** before writing. Continue from this document and `Q0_QUEST01_CANON_IMPLEMENTATION_CONTRACT_2026-10-08.md`; do not recreate Q3a–q, weaken gates, overwrite Gold originals, change Arsenal damage or merge into R59. For any code work: SHA-anchored diff, exact-source payload sync, headless + Chrome before CLAIMING PASS.
