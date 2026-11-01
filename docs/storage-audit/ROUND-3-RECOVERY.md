# APEX storage R3 — high-impact recovery design

**Status: design only; stop for owner decisions.** No artifacts were deleted, migrated, downloaded in full, or changed. No workflows or settings were changed. R1 and R2 remain intact. All numbers below use R2's complete inventory, observed 2026-11-01 05:11:21–05:11:47 UTC; no full inventory was repeated in R3. Live drift is possible. R3 rechecked artifact 10789831037: it remained unexpired, with expiry 2026-12-23T04:01:24Z. The repository HEAD was not modified.

## Decision first

**Highest-impact safe next action:** obtain Control Tower's approval for a named durable archive, its cost/capacity and an archive-verification pilot on **artifact 12513060678** (260,292,216 reported bytes, run 39973763390, SHA `eaefdce0800e0bca78064f1de4478e2150a43232`). This is not approval to delete. Preserve its entire ZIP and provenance, independently verify and restore it, then review whether GitHub copy removal is acceptable. The design can then scale to the four families, but no individual artifact is approved by this report.

The four families total **2,787 artifacts / 191,246,360,229 bytes**. The included offline dry run defines a review scope of **2,785 artifacts / 190,883,762,498 bytes**, excluding two documented traceability examples from the scope. This is a theoretical upper bound, **not safe or authorized reclaimable bytes**: more artifacts may need to remain on GitHub, and every selection needs review and verified preservation. Exact scope is in `dry-run-scope.csv`; original R2 classifications are preserved. The two explicit holds are 11673294462 (V43 candidate evidence cited by the backlog, not certification) and 10789831037 (documented successful production build). This is not a complete list of required holds. R2 also holds browser evidence 10789008837, outside these four families.

## Four dominant families: what is established

| Family | Count | Bytes | Largest individual IDs (bytes) | Producing workflow and trigger | Contents and current evidence |
|---|---:|---:|---|---|---|
| `arsenal-product-acceptance` | 1,877 | 105,959,432,755 | 12513060678 (260,292,216); 12520768343 (260,217,854); 12509186377 (259,926,389) | Arsenal Product Acceptance, `.github/workflows/arsenal-product-acceptance.yml`; current checkout: push on main, development/v43, arena/** and a named integration branch, all PRs, manual dispatch. | Current `if: always()` upload includes `dist/`, `release/arsenal-product-windows/`, browser evidence and logs. Workflow copies `dist/.` into the Windows app before upload; this establishes duplicated source paths at copy time, not the compressed bytes or exact contents of every historical ZIP. 383 success, 764 failure, 730 cancelled. The current workflow was active and had runs 2026-11-01; the latest retained artifact in the R2 snapshot was created 2026-10-29 00:44:56Z. Runs prove continuing execution, **not** that a later upload succeeded or was billed. |
| `arsenal-quest-production-build` | 206 | 47,565,587,624 | 10921161605 (246,560,268); 10910114712 (246,559,330); 10911260919 (246,559,330) | Arsenal Quest Stabilization, `.github/workflows/arsenal-stabilize.yml`. Historical workflow at SHA `912835bc1aec2b8a7ef1ad711917c4bd0e3376f5` used push for `prototype/arsenal-quest` and `arena/**`. | Historical step uploaded `dist/` after build, before browser acceptance. A later failed run may still contain a successful build. 116 success / 90 failure. Project `docs/arsenal-quest/CORRECTION_PASS_REPORT.md` cites ID 10789831037 as a successful production build; preserve its SHA and original. Latest observed artifact 2026-10-03 17:06:09Z; latest historical workflow run 2026-10-03 19:22:07Z. File absent from current default-branch checkout and current workflow listing, so no present accumulation established; another branch could differ. |
| `localization-chrome-visual-evidence` | 426 | 25,504,844,860 | 12034511082 (64,708,929); 12322979045 (64,673,718); 12202995841 (64,567,718) | VIE ENG Localization Gates, `.github/workflows/localization-gates.yml`; path-filtered PR and manual dispatch. | `if: always()` uploads `docs/acceptance/localization`; `tools/testLocalizationChrome.mjs` writes PNG screenshots there. Actual ZIP contents, including possible preexisting/generated extras, remain unverified. 411 success / 15 failure. Workflow active and runs observed 2026-11-01; latest retained artifact in R2 2026-10-28 09:34:49Z. New successful uploads after snapshot are unverified. |
| `arsenal-quest-qa-evidence` | 278 | 12,216,494,990 | 11279595861 (60,510,437); 11279448752 (60,161,939); 11277651091 (45,586,653) | Arsenal Quest Stabilization, same historical push triggers. Historical file at SHA `5813b4cf00cc59d39ab95535329efe67f4ffa1e2` is included in this package. | Historical `if: always()` upload names browser evidence directory, headless JSON report, `/tmp/headless.log` and `/tmp/browser.log`. 276 failed / 2 successful runs. Failure is not proof of redundancy or supersession. Latest observed artifact 2026-10-03 19:23:07Z; no present upload established from the absent workflow. |

**Content access constraint:** on 2026-11-01 the archive download API for 12513060678 returned HTTP 302 to `productionresultssa0.blob.core.windows.net`. A range-only request to that blob failed with `URLError` in this network; no artifact data was downloaded. Artifact-internal file listings, video presence, byte-level duplication, screenshots or external copies are therefore **not verified**. The workflow path lists describe expected uploads, not necessarily the actual historical ZIP contents. Rebuilding from SHA and locked dependencies may reproduce a build, but exact original screenshots, timing, failure states, toolchain, acceptance, run association and generated bytes cannot be assumed reproducible. Same-name and failed-run groupings are not deletion evidence. There is no verified family-wide supersession or owner acceptance registry.

## Proposed preservation and recovery method

1. **Owner decision and selection.** Choose a destination, encryption/access policy, retention duration, responsible custodian, cost ceiling, and whether accepted evidence must remain on GitHub. Review the exact IDs in `dry-run-scope.csv`; filter out holds and any other required artifacts. Re-fetch each selected artifact's metadata and run, check unexpired status, size, digest and SHA against the selection; stop on mismatches. Also verify the original run and link have not disappeared. Update selection and projected totals for current reality.
2. **Capacity.** The maximum R2 review scope represents 190,883,762,498 API-reported bytes (177.774 GiB). ZIP transfer sizes and destination overhead can differ. Plan capacity for two independently stored copies plus staging, index and headroom; a planning floor of **at least 450 GB usable** for two full copies is a provisional estimate, not a measured requirement. If moving fewer artifacts, calculate from those exact live sizes. Estimate transfer/egress, object requests, encryption/key management, replicas and restore costs before approval.
3. **Copy originals, not just regenerated outputs.** On an authorized host with access to GitHub's redirected blob domain, read each original ZIP using Actions read permissions, without displaying signed URLs or credentials. Compute local SHA-256 of the full ZIP; compare with the GitHub `sha256:` artifact digest. Stop on absent or mismatching digest. An artifact API `size_in_bytes` is stored-size metadata; do not reject an archive solely because ZIP download length differs without resolving the accounting difference. Never extract untrusted ZIP paths without traversal/symlink safeguards.
4. **Durable independent preservation.** Write the original ZIP into the owner-approved destination, encrypted and access-controlled; preserve an immutable or versioned second copy in a separate failure domain. Re-read each destination copy independently, calculate its SHA-256, and compare to both the local archive and original GitHub digest. Store immutable per-copy receipt, destination object/version, checksum, byte length, verification timestamp and operator. Do not count an upload acknowledgement alone as verification.
5. **Permanent provenance index.** For every artifact record repository, artifact ID/name, original API URL, run ID/URL, run attempt/conclusion, workflow path, commit SHA, branch, original created/expiry times, original API digest and stored size, actual ZIP size/hash, both destination locations and object version IDs, owner approval, preservation policy, and independent checksum and restore results. Protect the index against tampering and back it up with the archive. Avoid storing signed URLs, secrets or tokens.
6. **Verified restore.** Read the archived ZIP using a separate read identity, recompute checksum, securely extract to an isolated clean directory, inspect file count and contents, and verify usable build/evidence with owner-defined acceptance checks. Record date, tester, procedure, file checks and outcome per artifact; failures block that artifact. Restore the original ZIP and index, not GitHub's old artifact ID: a re-upload would create a new ID/run association and may not be equivalent. Acceptance must explicitly address that loss of native GitHub linkage.
7. **Only after approval and proof:** obtain a separate explicit ID-level deletion authorization. Another agent can then revalidate originals and copies, delete only approved IDs, confirm GitHub deletion and surviving archive readability, and measure refreshed totals. Stop on any failed check. This audit performs none of these actions.

### Destination choices — none provisioned or assumed available

- **Owner-controlled object storage in two independent failure domains:** practical for hundreds of GB and immutable versions, with IAM, encryption, logs and object checksums. Requires account ownership, storage quota, write/read permissions and explicit cost approval; storage, operations, retrieval and egress may be billed. Validate actual provider pricing and geographic/legal requirements before use.
- **Owner-managed encrypted NAS or offline disks plus a second geographically separate copy:** possible with enough verified usable capacity, backups, restore testing and custody controls. Hardware, operations, offsite access and recovery time are real costs; no such capacity has been verified.
- **GitHub Releases in this or another repository:** may be useful as an additional accessible copy if policy, asset limits and permissions permit, but is not an independently verified external failure domain and still depends on GitHub/account access. Multiple assets/releases and source/run indexing would be required. Do not assume it is free, durable enough, private enough, or byte-equivalent. GitHub Packages shares the artifact storage allowance and is not a demonstrated billing escape.

## Prevention patch plan — do not apply yet

Keep all existing functional, native/runtime, visual and acceptance test steps and triggers. Validate required checks and downstream artifact consumers before changing names or layouts. Durable accepted evidence must be explicitly selected and preserved via the separately approved archive; setting a shorter Actions retention period alone is not preservation.

**Current Arsenal upload (simplified):** one `if: always()` artifact includes `dist/`, `release/arsenal-product-windows/`, browser screenshots and logs, with no `retention-days`. The package construction runs `cp -R dist/. release/arsenal-product-windows/app/`.

**Proposed exact upload-only plan**, conditional on consumer migration and a verified reconstruction test:

```yaml
      - name: Upload temporary build and launcher shell
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: arsenal-ci-build
          path: |
            dist/
            release/arsenal-product-windows/
            !release/arsenal-product-windows/app/**
          retention-days: 7
          if-no-files-found: warn
      - name: Upload integration browser evidence
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: arsenal-browser-evidence
          path: docs/acceptance/arsenal-product/browser/
          retention-days: 14
          if-no-files-found: warn
      - name: Upload temporary diagnostics
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: arsenal-ci-diagnostics
          path: |
            /tmp/apex-v43-branch-dryrun.json.log
            /tmp/arsenal-vite.log
            /tmp/arsenal-launcher-1.log
            /tmp/arsenal-launcher-2.log
          retention-days: 7
          if-no-files-found: warn
```

Before adopting this change, prove the `app/` copy contains only the same dist files plus separately preserved SHA marker or other required launcher metadata. The workflow writes `ARSENAL_BUILD_SHA.txt` inside `app/` **after** the copy, so the proposed exclusion would omit it unless it is added separately (e.g. a separate upload path outside the excluded subtree or generated metadata file). Provide a tested reconstruction procedure: extract launcher shell and dist, copy dist into `app/`, restore the SHA marker, and verify smoke-test behavior and bytes against the original. Until this and all consumers are verified, do not apply the exclusion or rename artifacts. The example is a plan requiring that correction, not a ready-to-apply patch. Ensure accepted exact-SHA evidence is exported to the approved durable archive before 14-day expiry; if export fails, alert/block according to owner policy rather than pretending the copy exists.

**Localization:** keep the same test and upload; add `retention-days: 14` to its existing evidence upload after setting accepted-evidence preservation. For historical Arsenal Stabilization, no current default-branch workflow exists: do not recreate it merely for storage. If reintroduced on any active branch, make its build artifact 7 days and integration QA/browser evidence 14 days, preserve final accepted evidence externally, and review consumers.

**Triggers:** push/PR overlap is possible for Arsenal, but does not prove duplicate captures or equivalent checks. Do not disable either test gate. Only consolidate uploads for the same verified commit, output and required-check semantics after a measured comparison. No duplicate screenshot removal is currently proven.

### Illustrative future storage estimates, not promised savings

R2 snapshot uploads created 2026-10-22 00:00Z through before 2026-10-29 00:00Z: Arsenal product 263 artifacts / 24,976,610,987 bytes; localization 135 / 8,572,490,314 bytes. The historical Quest families had zero uploads in that specific seven-day window. Assuming indefinitely constant byte throughput, instant expiration, identical future artifacts, and all bytes assigned one retention class:

| Family | At 30 days steady state | At 14 days | At 7 days |
|---|---:|---:|---:|
| Arsenal product | 107,042,618,516 B | 49,953,221,974 B | 24,976,610,987 B |
| Localization | 36,739,244,203 B | 17,144,980,628 B | 8,572,490,314 B |

These are retention-math scenarios, **not forecasts**: the proposed product split mixes 7- and 14-day data, and its per-component sizes are unknown. No historical ZIP inspection or assumed deduplication savings are included. Workload, sizes, triggers, archive exports and billing rates can change; existing expiration dates are unaffected. The already user-reported 30-day repository setting remains the default unless separately justified; its API remains inaccessible.

## Billing discrepancy and conditional exposure

The November billing value **369.06 GB-hours** was supplied without an observation timestamp or detailed SKU data. The last full artifact observation was **2026-11-01 05:11:47 UTC**, with 215.752350 GiB in reported artifact sizes; all those artifacts had creation dates before November 1 UTC. GitHub's documentation defines a billing GB as 2^30 bytes, says storage accrues hourly and can update within 6–12 hours ([1](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). Its billing report documentation says usage is logged in UTC ([2](https://docs.github.com/en/billing/reference/billing-reports)).

If the API bytes were continuously billable at that exact size from 00:00 UTC and the billing number represented the same account, SKU and fully updated period through 05:11:47, the illustrative total would be **about 1,121.13 GB-hours**; 369.06 corresponds to about **1.71 hours** at constant 215.752350 GiB. These assumptions are unverified. Lag or an earlier dashboard snapshot could explain the discrepancy, but cannot be established without a timestamped report and accounting-scope comparison. An attempt at the user billing API at 05:27:59 UTC returned **403 Resource not accessible by integration**. Request the owner’s timestamped detailed usage report with SKU/repository, gross/discount/net, time window and snapshot as-of time; do not request credentials.

Conditional exposure only: if all 215.752350 GiB remained continuously billable for 30 days, it would contribute approximately **5,178.06 GB-hours/day** or **155,341.69 GB-hours/720-hour month** before changes. At GitHub's currently documented $0.25 per GB-month for shared artifact/Packages storage, this is approximately **$53.94 gross for a full constant month**, before the included allowance, discounts, billing caps, other products and accounting differences. This is not the present bill, a forecast, or proof that the reported $0 is wrong; observed expirations and new uploads invalidate constant-size assumptions. Historical accrued GB-hours are not reversed by deletion. Packages storage was not measured; caches are separate and not included here.

## Prioritized Control Tower decision table

| Action | Exact scope | Potential reported bytes | Preservation / technical and financial risk | Approval and execution / verification |
|---|---|---:|---|---|
| 1. Archive pilot | 12513060678; run 39973763390; SHA above | 260,292,216 | Entire ZIP plus provenance; unknown cloud cost, blocked blob access here, native link loss if later deleted | Owner chooses destination, capacity, access, budget and authorizes download/copy. Verify API digest, both destination checksums and isolated restore; no deletion without separate approval. |
| 2. Scale archive | 2,785 review-only IDs in `dry-run-scope.csv`; documented hold IDs excluded | Up to 190,883,762,498 | Theoretical ceiling only. Every item needs owner selection, complete verified independent copies and restore; acceptance may require keeping further IDs on GitHub. Cost, migration time and loss of native IDs are material. | Approve exact selection and resources; execute per-item verification and signed index; authorize any deletion separately; re-inventory and measure after each approved batch. |
| 3. Preserve documented evidence | 11673294462 and 10789831037; plus browser evidence 10789008837 outside scope | Not treated as reclaimable | Exact-SHA traceability; the first is candidate evidence, not certified GOLD. | Retain GitHub originals pending explicit owner decision. Archive and verify before any change. |
| 4. Future upload policy | Current Arsenal and localization workflow files; historical stabilization only if reintroduced | Unknown; retention examples above are conditional | Changed artifact layouts can break consumers; shortened retention can lose accepted proof. | Owner approves corrected patch and durable-evidence policy; test reconstruction and consumer compatibility, preserve all gates and review resulting storage. No patch applied. |
| 5. Billing access | User-owned billing report for November | Unknown | No reliable current bill or savings without time-aligned report; do not expose credentials. | Owner supplies export/as-of time and SKU/repository breakdown or resolves permissions. Compare reported quantity and net cost with UTC timeline. |

## Executable offline dry run

From this folder run:

```sh
python3 dry-run.py > /tmp/apex-r3-review-scope.csv
```

The script checks the R2 snapshot count, unique IDs and byte sum; outputs exact IDs, run, SHA, digest, dates, classification and prerequisites; prints totals to stderr. It performs no API calls, downloads, migrations or deletion. It is deliberately an **offline review list**, not authorization and not a live validation. Revalidate selected records before any future action. To preserve even local scratch files, redirect to an owner-chosen output path instead of overwriting an existing file.

**STOP:** Control Tower must specify destination, access/custodian, cost ceiling, selection and whether loss of GitHub-native artifact linkage is acceptable. No evidence of an existing verified archive or authority to migrate/delete has been supplied.
