# Quest 01 — Q2 N-Actor Arsenal Adapter Evidence (2026-10-08)

**Status: Q2 REAL MULTI-ACTOR FOUNDATION — ACCEPTANCE GREEN. NOT FULL QUEST / NOT ART ACCEPTED.**

## 1. Provenance and isolation

- Branch: `quest/q2-generic-actors-from-q1`.
- Starting green Q1 SHA: `68165f24871cc78cadf65b30efa6064e088cedea`.
- Most recent verified Q2 runtime/test SHA before this evidence-only document: `c2cd99447a083c2fdf029fc99b27800334708685`.
- **Green GitHub Actions run**: https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37791388131
- Never merged into `arena/r59-recovery-d032880`, `quest/cp04-multi-actor-spike-r59`, or `quest/q1-director-from-q0`.
- User-facing Continue Story stays at the Q1 WAKE checkpoint with explicitly marked CP04 FIRST WAKE preview. Q2 test compositions are inaccessible via production UI.

## 2. Code executed; where and why

- `public/game/quest/questMultiActorCore.js`: independent N-actor selection and bounds/identity validation. Up to **12 actual Fighters** in this bounded policy; rejects repeated physical IDs/Quest IDs, invalid team, invalid HP, absence of NEWBOT; offers real team-aware opponent selection, earliest swept enemy hit and pickup selection. Contains test-only frozen **1v2,2v2,3v4 roster recipes**. This is not a new combat engine.
- `public/game/modes/arsenalBattleRuntime.js`: real `Fighter` instances assembled from specifications (same Fighter.update, Arsenal slot, weapon, damage, physics and world drawing). `state.questMultiActor` distinguishes team-aware Arsenal from normal 1v1. FIRST WAKE still uses the exact 2v2 identities and HPs 1000/350/1000/350. General roster fixture start requires **local loopback + `__APEX_TEST_MODE===true`**, does not advance Quest save. Test fixture clear and retry are separate from authored encounter end conditions. Mode teardown now synchronously sets `gameState='MENU'` in the non-Gold path, matching Gold-hosted behavior.
- `public/game/arsenal/arsenalSpawnRuntime.js`: predicts reveals, counter-reservations and real pickup from all N quest Fighters rather than four hardcoded slots. Existing normal pickup/body-aware logic for BOT/LOCAL retained.
- `public/game/hero-rework/heroReworkRuntime.js`: quest team-aware projectile/splash/thrown targeting active for `questMultiActor`, while 1v1 rework model and P2 AI laws remain untouched.
- `tools/testQuestGenericRosterQ2.mjs`: 28 pure assertions on real identity/team policy, no false damage.
- `tools/testArsenalBattleHeadless.mjs` Q2 addon: real Arsenal live 1v2/2v2/3v4 (not array-count-only), two-way swept PISTOL adjudication, physical equipment pickup, cap-five, KO/RETRY, teardown then non-Quest 1v1. Additional **live grenade + thrown DAGGER** in 3v4 assert allies are untouched. Uses canonical hit-stop settling between these independent cases; no damage mocking, threshold loosening or bypass.
- `.github/workflows/quest-q2-generic-actors.yml`: isolated Q1, Q2, CP04 and real Chrome/browser regressions.

## 3. Evidence (run 37791388131)

| Test | Result |
|---|---|
| Q1 director progress/schema/corrupt save | PASS 16/16 |
| Q2 generic roster policy | PASS 28/28 |
| CP04 multi-actor pure selectors | PASS |
| **Real Arsenal 1v2/2v2/3v4 + added Q2 checks** | **PASS 401/401** |
| **Real CP04 FIRST WAKE and previous product gates** | **PASS 381/381** |
| Quest 3v4 real GRENADE splash: 2 foes damaged, allies untouched | PASS |
| Quest 3v4 real DAGGER thrown through ally into foe | PASS |
| Normal 1v1 after exiting N-actor fixture | PASS |
| `pnpm build` | PASS |
| Desktop Chrome physical START→WAKE→CP04 preview→ESC→reload | PASS |
| Mobile Chrome emulated touch 390×844 for same flow | PASS |

**Why intermediate CI failed, and what was done:**
- First CI run 37789798926 failed old `force-reveal-at-3.0-not-autopickup` with a randomly revealed STORMBREAKER (floor hazard affected the 1.5s pickup walk). No legacy threshold or gate was edited; the subsequent complete run 37790507088 passed without changing that test.
- A new Q2 gate found non-Gold exit still observable as `ARSENAL` after slot teardown; runtime mode is now synchronously set to `MENU`, and the same gate passed in the next run.
- New exotic test originally called DAGGER immediately after a grenade; canonical grenade hit-stop slowed the very next frame, leaving thrown DAGGER inside its original 0.35s grace. A normal engine `step(.2)` now lets hit-stop elapse BEFORE the independent throw test. Final real hit is still required and passed.

## 4. What Q2 **does not** claim

1. **No completed wave orchestration.** This foundation can hold 7 canonical Fighters; E03/E06's sequential wave spawner, reinforcement cadence, arrival/drop staging and old-wave cleanup belong to Q5/Q6, controlled by the Quest Director. No story progression is granted for generic fixtures.
2. **No approved T.O.T/RIVET abilities or AI skill scheduler.** Existing NPCs are deliberately blank: they auto-battle using Arsenal guns, without fictional A1/A2. Q6 requires owner-defined kits and honest ownership handoff. `p2CastAI` is still a legacy 1v1 function.
3. **No Boss E07/E08 threshold logic, Stormbreaker single artifact progression, or accumulator objective**; director encounters are still ahead.
4. **No completed Quest PvE HUD.** Gold remains a two-side presentation; other actors still do not have fully mapped crit/Heavy feedback. Q3 must handle 1/2/3 color-segment single HP bar and safe-bound damage numbers, not inflate old 1v1 layouts.
5. **No Gold V12 art approval**; CP04 adapter is still a palette/shape approximation. Q3 must use the exact recovered donor.
6. **No physical device test or multi-minute 3v4 soak/performance benchmark**; Chrome mobile is emulated. That test is required before releasing high-density waves.

## 5. Next Q3: only presentation/identity adapter

- Branch from this green Q2 documented head, not moving R59.
- Preserve existing Gold geometry and production 1v1. Quest presentation must derive actor identity from stable `questId`, `questTeam` and accepted damage event.
- Prove on-screen ALL actor crit/Heavy feedback with safe character bounds (desktop, SE portrait, landscape, tablet).
- Port actual donor visuals under explicit checksum, compare frame-by-frame; never claim palette-only renderer is a V12 rig port.
- Implement the owner-approved single shared HP frame with 2 or 3 non-stretching contiguous colored segments, and explain KO/withdraw states without adding extra permanent bars.
- Keep client-facing Quest locked/unreleased outside isolated branch. Owner playtest required.

Q2 is a verified **engine infrastructure slice**; it is not a promise that the complete 32–42 minute story campaign can be played yet.
