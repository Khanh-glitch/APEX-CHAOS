# CP5 — Final Cutover Review and Gold Reference Preflight (2026-10-13)

**Disposition: CANDIDATE TESTED; NOT AUTHORIZED FOR MAIN/PRODUCTION MERGE.**
This is a review/checkpoint document, not an assertion of owner Gold approval.

## Exact source chain and owner-validated baseline

- `main@2590beee79b9447fa3639870b6de6801428b7f42` was unchanged at this audit.
- Stacked draft PRs #50 → #51 → #52 → #53 → #54 → #55 → #56; top reviewed commit `8bb9a1cae2aa3e0011d8ca9e9a610da36c13834f`. This candidate is 106 commits ahead, zero behind original main.
- On PR #56, functional workflows succeed: [Content Interaction](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/38366886875), [D5 World Weapon desktop/mobile](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/38366886820), [D5 Crystala](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/38366886660), [D6 Native Stream](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/38366886768), [Arsenal Product Acceptance](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/38366886644) (47 successful steps).
- Owner direct earlier playtest of PR #50: 5/5 Magnet/Frost/Crystala/Robot interactions PASS, intermittent Frost A1 cyan-first-frame noted. The Gold-authored deferred-ice repair in PR #51 is deterministic-test PASS, not a guarantee that this sporadic browser symptom will never recur.
- The integrated CP5 candidate uses one authoritative Arsenal equipment registry with AIL permission queries for Magnet floor A1/A2, Magnet projectile, Frost equipment, V43 reflection kinds and original Mirror F2 projectile families. No V43 enablement of Mirror F2; battle physics/TOI remain native.
- Structural 13th-hero canary is *not* proof of a completely executable new Fighter. Real extensions still require executable skill/asset/language/interaction admission.

## Gold release blocker: separate, unwaived

[Strict V43 Gold Fidelity](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/38366886777) remains FAIL CLOSED: 7/7 original Canvas source traces, **0/40** matched full ready/attack/contact/afterglow/counter motion-phase proofs. This does *not* mean 40 gameplay bugs.

The **owner ORIGINAL** `APEX_CHAOS_ARSENAL_LAB_V4_3_NATURAL_FLIGHT_OFFLINE(1).html` is indexed in the user's APEX CHAOS Library at approximately 4,587,034 bytes, but at audit time Library raw-byte materialization was **not authorized**. Search/index text cannot authenticate SHA256 or drive a standalone Chromium comparison. Do not claim the reference has been byte-verified or uploaded to the repo.

Owner-provided HTML must be SHA256 `8db9ce58c0a61171ab76bcd5b18dea21564b45c76663d93fc28e61eaefdcd38d`. **Do not commit this personal original or substitute a rewritten Gold reference.**

## New non-certifying evidence preflight

`node tools/maintenance/v43-gold-reference-preflight.mjs --out /tmp/v43-gold-evidence-preflight.json`

Once independently provisioned with the exact original source bytes:

`node tools/maintenance/v43-gold-reference-preflight.mjs --reference /secure/original-v43-gold.html --out /tmp/v43-gold-evidence-preflight.json`

The preflight rejects drift between certification and backlog, missing or duplicate phase IDs, and wrong original SHA. It lists all 40 unverified phases and never calls any phase VERIFIED by itself. The Gold workflow retains this JSON report as a GitHub Actions artifact even if the separate strict certification step fails. This is to **make each missing proof actionable**, never to bypass the existing release gate.

To certify any phase after reference availability: capture the ORIGINAL and live candidate at matched geometry, event receipt and phase-relative times, confirm real holder/projectile/contact/HP and counter transaction, compare ordered image/Canvas geometry and time coherence, implement an independent repeatable proof executor for the specific `gold:` ID, and only then upgrade the strict certification phase contract. See `V43_GOLD_EVIDENCE_CLOSURE_PLAN_2026-10-10.md`.

## Cutover rules

- Preserve all draft branches as rollback/debug provenance; no history rewrite or branch deletion.
- Do not confuse no-conflict/green functional CI with Gold Fidelity approval.
- Confirm a preview **really runs the exact SHA**, not main/old Netlify/Cloudflare production. Cloudflare's earlier clone stall means a CI build PASS is not evidence of Cloudflare deployment.
- No automatic merge or production branch modification. Final owner-facing checks, original-Gold reference evidence and a documented release decision remain blocking.
