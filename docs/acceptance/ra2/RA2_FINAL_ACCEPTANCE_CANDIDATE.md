# RA-2 Final Acceptance Candidate

**Date:** 2026-10-22
**PR:** [#101](https://github.com/Khanh-glitch/APEX-CHAOS/pull/101) — still **Draft / Open**
**Branch:** `arena/d7ff52e8-apex-chaos`
**Reviewed runtime source SHA:** `cfa70c1417dfa7c055c36980fbda7fbca3ac4fe5`
**Latest PR head at CI snapshot:** `6adc3b43ac023845c6d0f236a5ab93b814c530e6` (documentation/evidence-only follow-up; no runtime source change)
**Candidate state:** exact-SHA isolated preview and requested RA-2 browser suites passed. This is not an owner acceptance or final technical verdict.

## Exact-SHA isolated preview

- **Workflow:** [RA-2 Exact-SHA Isolated Preview #101, run 39779363007](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/39779363007) — **PASS**.
- **Direct deployment URL:** [https://b1278e89.apex-chaos.pages.dev](https://b1278e89.apex-chaos.pages.dev)
- **Stable per-commit branch URL:** [https://ra2-exact-cfa70c1417df.apex-chaos.pages.dev](https://ra2-exact-cfa70c1417df.apex-chaos.pages.dev)
- Cloudflare served the exact commit/revision receipt. The served Gold shell and selected UI-SFX runtime matched the local build bytes. The production receipt before and after the isolated deploy was unchanged.
- Remote Chromium acceptance passed for Field Archive, progressed Mastery, Lucky Draw, Result Gold, and tutorial lifecycle. The Cloudflare deployment was isolated; no production deploy or itch publication occurred.
- [Workflow artifact / remote evidence](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/39779363007) (`ra2-exact-preview-cfa70c1417dfa7c055c36980fbda7fbca3ac4fe5-evidence`).

## Local gates and acceptance evidence

- Gold revision integrity: **18/18**; transition coordinator: **65/65**; Gold shell loader: **9/9**.
- Production build and shipping audit: **480** shipping files, **0** non-shipping leaks, **0** forbidden manifest entries; CP16 receipt records this candidate SHA and 70 versioned runtimes.
- Localization contract: **522** curated phrases, 26 proper names, 13 dialogue lines; ENG/VIE text and accessible attributes restore.
- Lucky Draw disposable-profile state matrix: **24/24**; insufficient, pending, generic-error, successful ENG/VIE paths, exact debit/ownership, duplicate-input refusal, and reload persistence. No draw/economy authority change.
- Progressed Mastery: **16/16**; Field Archive dossier coverage: all **14 fighters** and **41 weapons**, zero curated dynamic-copy mismatches.
- Result Gold: ENG/VIE portrait and landscape; zero-damage/no-weapon fallback; archive/detail and locked Codex; art matrix **56/56**, four-viewport browser matrix with zero failures. No redesign or new art correction.
- Tutorial lifecycle: **19/19**; packaged nested `/html/apex/` host: **15/15**, including the real paused Skill 1 lesson, nested SKIP persistence, and pause release.

### Result Gold screenshots

| ENG — portrait | VIE — portrait |
|---|---|
| ![Result Gold ENG portrait](evidence/result/result-locale-eng-portrait.png) | ![Result Gold VIE portrait](evidence/result/result-locale-vie-portrait.png) |

| ENG — landscape | VIE — landscape |
|---|---|
| ![Result Gold ENG landscape](evidence/result/result-locale-eng-landscape.png) | ![Result Gold VIE landscape](evidence/result/result-locale-vie-landscape.png) |

| ENG — zero-data | VIE — zero-data |
|---|---|
| ![Result Gold ENG zero-data](evidence/result/result-zero-data-eng.png) | ![Result Gold VIE zero-data](evidence/result/result-zero-data-vie.png) |

### Additional ENG/VIE evidence

- Lucky Draw state screenshots: [insufficient ENG](evidence/lucky-draw/insufficient-eng.png), [insufficient VIE](evidence/lucky-draw/insufficient-vie.png), [success ENG](evidence/lucky-draw/success-eng.png), [success VIE](evidence/lucky-draw/success-vie.png), [error ENG](evidence/lucky-draw/error-eng.png), [error VIE](evidence/lucky-draw/error-vie.png).
- Field Archive localization: [desktop ENG](evidence/localization/desktop-archive-eng.png), [desktop VIE](evidence/localization/desktop-archive-vie.png), [mobile VIE](evidence/localization/mobile-portrait-archive-vie.png).
- Lucky Draw localization: [desktop ENG](evidence/localization/desktop-lucky-draw-eng.png), [desktop VIE](evidence/localization/desktop-lucky-draw-vie.png), [mobile VIE](evidence/localization/mobile-portrait-lucky-draw-vie.png).
- Nested tutorial pause lesson: [390×844 evidence](evidence/tutorial/nested/nested-tutorial-paused-390x844.png).

## Current PR checks

At the latest fully completed PR-check snapshot, head `6adc3b43ac023845c6d0f236a5ab93b814c530e6` (documentation/evidence-only above the runtime SHA), GitHub reports **23 pass, 1 fail, 0 pending**. The complete [Arsenal Product Acceptance run 39781358840](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/39781358840) passed, including R77 and Result Gold; the [A1 browser check](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/39781358836) passed. The isolated `build-deploy-verify` and Cloudflare Pages checks also pass.

The sole remaining failure is [`actual-preview-entrypoint`](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/39781358964): deployed Netlify START URL verification failed, while its local provider-injection regression passed. It is not waived. The isolated Cloudflare preview is independently verified and does not replace this Netlify check. No assertions were weakened; reproduce and measure before any fix, and do not redesign or expand scope.

## Unverified / limits

- No physical iPhone/Safari or Android device testing; browser evidence is Chromium emulation.
- The integrated compatibility matrix is local-source evidence; the exact-SHA workflow covers the requested RA-2 suites, not every compatibility profile.
- The independent Netlify START entrypoint and other PR check failures above remain unresolved.
- **RA-2 technical verdict: NOT ISSUED.** No `READY`, `CONDITIONAL`, or `OWNER ACCEPTED` status is claimed. PR #101 remains Draft/Open; no merge, production deployment, or itch publication occurred.
