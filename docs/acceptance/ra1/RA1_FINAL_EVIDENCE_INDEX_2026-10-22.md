# RA-1 Final Evidence Index — 2026-10-22

## Verdict

**CONDITIONAL — exact-SHA external evidence is closed; awaiting owner acceptance.** Runtime candidate: `856cdf48247aa752b377eb2ddb6071426cf6e494`, revision `20261021-cp5-r1`. PR #101 remains Draft/Open. This does **not** mark OWNER ACCEPTED.

- [Open the external isolated Cloudflare preview](https://ra1-exact-856cdf4.apex-chaos.pages.dev)
- [Exact-SHA deploy + external browser workflow run #39735511402](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/39735511402)
- [Download the browser evidence artifact](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/39735511402#artifacts) — `ra1-exact-856cdf4-final-evidence`, 43.3 MB, 30-day retention
- [PR #101 final evidence comment](https://github.com/Khanh-glitch/APEX-CHAOS/pull/101#issuecomment-6334800151)
- Machine-readable summary: [`RA1_EXACT_HEAD_EVIDENCE_856cdf4.json`](RA1_EXACT_HEAD_EVIDENCE_856cdf4.json)
- Full hardening report: [`RA1_RELEASE_HARDENING_2026-10-22.md`](RA1_RELEASE_HARDENING_2026-10-22.md)

## Exact-SHA provenance and isolation

Cloudflare Pages branch `ra1-exact-856cdf4` serves the pinned runtime SHA above. Workflow run #39735511402 passed all of these checks:

1. Live `/` returned HTTP 200.
2. Live `CP16_BUILD_RECEIPT.json` matched the exact SHA and revision; receipt reported 70 versioned runtimes.
3. Gold shell and selected runtime JavaScript byte digests matched the exact locally built candidate.
4. Production receipt before and after was unchanged. No production deployment was attempted.
5. External real-browser acceptance opened the public URL and exercised the requested screens and package path.

This URL is the Cloudflare isolated preview, not the Arena sandbox preview on port 4173 and not the stale pre-existing Pages branch URL.

## External browser evidence

All following test steps passed in run #39735511402 against the exact-SHA public preview:

| Surface | Result |
|---|---:|
| Tutorial touch, pause/resume, keyboard and recovery | 16/16 |
| Result art delivery | 56/56 |
| Fighter Select art, selection and roster rules | 136/136 |
| Compatibility matrix | 145/145 |
| Live Battle HUD identity/HP — HUNTER, NEWBOT, CRYSTALA | 9/9; 390×844, 844×390 and 320×568; 0 console errors, 0 network failures |
| Nested itch-style portable package | 13/13 |
| BOT duration on the exact external preview | 9/9 naturally KO-resolved |

The artifact contains screenshots and JSON/diagnostics for the browser runs. The HUD identity check selected opponents through the production BOT authority, verified identity text and HP layout, and saved one screenshot per viewport/opponent case.

## BOT duration — separate sample sets

All durations are simulated game seconds from the real production runtime. The three datasets are reported independently and are **not pooled**:

| Sample | Matches | Median | p90 | Max | Unresolved |
|---|---:|---:|---:|---:|---:|
| Production build, primary production sample (`bot-duration-production.json`) | 9/9 | **57.1 s** | 90.8 s | 90.8 s | 0 at 180/300 s |
| Independent dev-server replication (`bot-duration.json`) | 9/9 | **84.7 s** | 124.6 s | 124.6 s | 0 at 180/300 s |
| New exact-SHA Cloudflare preview sample (run #39735511402 artifact) | 9/9 | **48.9 s** | 143 s | 143 s | 0 |

No timeout/draw/sudden-death rule was added. Arsenal remains KO-only; the data does not prove every possible matchup terminates quickly. The owner decision remains open.

## Legacy `actual-preview-entrypoint` CI failure — classified, not waived

The separate older CI check remains **red**: [run #39737455095, job 119686419578](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/39737455095/job/119686419578). Its local production Chrome/Netlify-like provider test passed; the next step, “Verify main-facing PR's deployed Netlify START entrypoints,” failed. The check is still enabled and its assertions were not weakened, skipped, or removed.

A read-only probe from the successful Cloudflare runner tested the configured legacy origin:

```text
https://deploy-preview-101--apexchaos.netlify.app/
HTTP 404
curl exit 0
```

The legacy browser script asserts a successful navigation response before checking START presence/geometry/hit testing/art decode/click-through. Thus the direct probe classifies the current failure as a missing/404 Netlify preview entrypoint. It does not imply a defect in the separately deployed Cloudflare exact-SHA preview. The old Netlify run's browser-specific telemetry was not accessible; the 404 is current direct availability evidence, not a fabricated reproduction of its internal exception.

## Deferred issue and scope boundary

- Tutorial gun-pick reminder appearing while paused: record for **RA-2** only. No tutorial redesign or change was made in RA-1.
- No gameplay/balance/reward changes; KO-only law, Fighter Select and Result layout remain untouched.
- No production deployment, merge, itch publish, or OWNER ACCEPTED decision.
- Physical iOS Safari, Samsung Internet and low-end Android testing remain unverified.
- Browser screenshots were captured; no video was recorded.
