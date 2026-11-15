# CP4 FINAL ACCEPTANCE REPORT

**Exact candidate:** `6d95af806330f17ff6b23c6d60e40d373c72d9fa` (runtime revision `20261021-cp4-r2`, Gold shell SHA-256 `f8a08647…d2c011`, 70 versioned runtimes)
**Baseline:** CP3.2 `15488b089ee729df89c0f98164f018998cc57374`
**Status of this round:** acceptance completion only — no new features. **Not merged. Production not deployed. No public itch release. Not OWNER ACCEPTED.**

## 1. Isolated Cloudflare preview — TECHNICAL PASS

- Owner preview (exact candidate): **https://cp4-acceptance-6d95af8.apex-chaos.pages.dev**
- Live receipt re-verified during this pass: `gitCommit 6d95af806330…`, `revision 20261021-cp4-r2`, branch `arena/d7ff52e8-apex-chaos`, shell `f8a08647…`, 70 runtimes (`01-preview/CP16_BUILD_RECEIPT.json`).
- Deployed by acceptance-only workflow `.github/workflows/cp4-cloudflare-acceptance-preview.yml`, successful run: https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/39576144857 — it checks out the pinned candidate, runs the candidate gates, builds that detached tree, deploys **only** the `cp4-acceptance-6d95af8` Pages branch, verifies the live Gold shell bytes + receipt, and asserts production is unchanged.
- Production `https://apex-chaos.pages.dev` still serves A1 `c7a04f0…/20261020-a1-r20`. The plain branch alias still serves stale CP3.2 and is **not** CP4 evidence.
- Root cause of the earlier missing preview, proven from GitHub data: the Cloudflare Git integration created a successful check-run/build only for CP3.2 `15488b0`; no Cloudflare check-run exists for any CP4 or orchestration commit, so those pushes never produced a Git-integration build at all (not a CP4 build failure — the exact tree builds cleanly locally and in the acceptance workflow). The dashboard-side trigger state is not observable from the sandbox; the isolated wrangler preview above is the verified route.

## 2. Wall-contact A/B videos (NEWBOT + ECOBOT) — TECHNICAL PASS, feel = owner

Real-Chromium recordings from receipt-verified builds of both commits; identical isolated scenario; physics untouched. Baseline's expanding concentric wake circles are gone in CP4; tangential scrape streaks/wisps (≤4 live segments/fighter) keep the contact readable. Evidence: `02-wall-ab/` (2 side-by-side + 4 full clips, contact/travel/zoom stills, per-clip position samples). Remaining judgement: streak look at full combat density on real displays.

## 3. BOT AI baseline vs CP4 — TECHNICAL PASS on decision legality; strength mixed (honest)

80 deterministic seeded matches (same seeds/conditions/opponent), repeatability exact. CP4: **0 cast failures in 40 matches** (baseline BOXE alone had 27 wasted A2 attempts → 0), FROST/CRYSTALA conversion up, MAGNET safer with gate-proven deny-geometry, MIRROR first cast 5.65 s → 4.54 s without touching its canonical cast delay. HUNTER got busier (more pickups, less damage taken/min) but timed out all five ROBOT matches; SHURI conversion looks weaker on a damage proxy. No hidden info, no stat/cooldown changes, one successful cast per AI tick. Full tables, limits and raw data: `03-ai-benchmark/`. Whether BOT *feels* smarter/fair remains an owner playtest call — the data supports "cleaner Decisions", not "strictly stronger".

## 4. Visual / audio / skin completion

- **ENG/VIE visual audit — PASS for CP4 scope, CONDITIONAL overall.** VIE renders with correct diacritics and no layout breakage on Home/Pick/Locker/Battle/Result; zero battle-HUD overflow. Residual English chrome labels in the pre-CP4 Field Archive surface are listed verbatim in `04-visual-audit/VISUAL-AUDIT.md` (not a CP4 regression; do not claim "complete VIE" until a future localization pass closes them).
- **Audio — technical PASS.** 18/18 canonical SFX + 2 music tracks decode-verified; all 15 CP4 aliases resolve inside the one licensed bank with bounded gain/rate/throttle; audition reel with exact runtime treatment + cue sheet in `05-audio/` for owner listening on real speakers/headphones (perceived quality cannot be PASSed by tooling).
- **Result with skin genuinely equipped — PASS.** ECOBOT (+VUA HỀ) equipped through the real entitlement gate (QA-seeded completed-mastery save — disclosed, not earned in-session), rendered in battle, sealed by a genuine KO, paid exactly +200 AC once; ENG/VIE Result captured (`06-result-skin/`). Note: the Result medallion intentionally uses the canonical NEWBOT portrait per the CP4 portrait law while the sealed data records `skinId: ecobot`; showing ECOBOT art there would need a portrait-grade asset + owner decision.

## Classification

**Technical PASS (proven in this package):** exact-SHA isolated preview + production isolation · wall circular geometry removed for NEWBOT/ECOBOT with physics intact · BOT AI decision legality (0 invalid casts, deterministic A/B, gate fixtures) · SFX wiring/integrity/one-authority · skin equip→battle→sealed Result→single claim · ENG/VIE rendering integrity for CP4-scope copy.

**Still requires owner judgement on real devices:** wall-scrape feel in full combat · BOT smartness/fairness feel (esp. HUNTER long matches, SHURI conversion) · SFX taste/balance on speakers/headphones · VIE typography details (e.g. faint dot-below in "BỊ") · touch/portrait layouts and real-device performance · whether Result should ever show skin art in the medallion.

**Known non-CP4 residual:** English labels in Field Archive chrome under VIE (itemized) — future localization pass.

## Verdict

**FINAL OWNER ACCEPTANCE CANDIDATE — conditional on the owner real-device judgements above.** Every in-scope CP4 technical acceptance item is now either proven by evidence in this package or explicitly classified as an owner-judgement/residual item. No merge, production deploy, public release, or OWNER ACCEPTED claim has been made or is implied.
