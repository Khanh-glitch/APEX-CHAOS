# FROST V1 — PRELOAD HOSTILE AUDIT

Date: 2026-09-30
Status: PRELOAD READY / NO PRODUCTION IMPLEMENTATION YET

## Reference truth

Reference branch:
`arena/01a0f1e7-apex-chaos`

Exact post-CRYSTALA-V2 baseline:
`6b83fc6502eb8e23e4bd122074fc7fdfb47441ae`

Preload branch:
`director/frost-v1-preload-20260930`

The preload branch was created directly from that baseline.

## Authorities/process reread before preparation

The prep pass explicitly reread and used:
- Phase-1 READ_FIRST and Hero Definition Contract;
- 2026-09-28 12/12 owner-playtest failure audit;
- 2026-09-29 hostile pre-implementation audit;
- Robot final integration lock;
- Hunter final Gold integration authority;
- Crystala Gold-to-game adaptation map;
- Crystala one-shot runbook;
- Crystala V2 active minimal-delta task;
- current Crystala V2 implementation report;
- current live Frost-relevant registry/mechanics/rework/Arsenal/spawn/legacy-ICE source at the exact baseline.

Historical docs are treated as lessons/negative authority where superseded; current owner Frost law wins.

## Old failures converted into Frost gates

1. Global movement autopilot failure -> F02/F09 require real native inertia and forbid chase/pickup steering.
2. Tests hiding movement via pinned bodies -> runbook forbids hold/zero-speed evidence for locomotion claims.
3. Gold/demo becoming gameplay truth -> adaptation map explicitly separates Gold presentation from APEX physics/inventory/status truth.
4. Real-contact mechanics faked by authored endpoints -> F10/F11 require real body collision/new-contact.
5. Fresh equip destroying state -> F11 requires exact holder-object transfer and M249 5-fired/7-remaining proof.
6. Pellet semantics mistaken for projectile semantics -> F07 requires explicit shotgun/autoshot blast-group IDs.
7. Old ICE double-run/double-render -> F01/F08 and authority §8 require frost.* cutover plus legacy ICE presentation suppression.
8. CI green mistaken for owner acceptance -> F14/F15 separate deterministic/browser/owner-playtest evidence.
9. Arena local state loss -> runbook requires short commit/push/remote-verify cadence.
10. Protected-Hero regressions during shared edits -> narrow-hook rule + current Robot/Hunter/Crystala regression suites.

## Live-code findings frozen into the package

At baseline:
- registry still selects old `ice.bullets / ice.lane / ice.deep_freeze`;
- corrected `HR.shellUpdate` already preserves native APEX heading/inertia and must not regress;
- base anchor collision separates overlap and reflects directions;
- Arsenal `equip()` creates a fresh READY holder with `shotsFired=0`;
- Arsenal `consume()` destroys holder ownership and creates exit presentation, so neither is a steal primitive;
- holder truth lives at `fighter.data.arsenal`;
- shotgun/autoshot emit multiple pellets without a stable shared Freeze-roll group;
- floor pickup resolver lacks a Frozen-slot eligibility hook;
- weapon aim is independent from fighter movement direction;
- generic slow statuses multiply, so Frost floor + Cold Shock require a Frost-specific strongest-effect resolution instead of naïve status multiplication;
- legacy `iceVisualRuntime` keys old freeze visual/audio off ICE source identity and can double-render Frost unless semantically suppressed.

## Gold selection audit

Selected authority:
`FROST_GOLD_FUSION_FINAL.html`

Repo path:
`docs/hero-rework/frost-v1/01_OWNER_APPROVED_GOLD_REFERENCE.html`

Owner-source:
- bytes: 975,616
- logical lines: 2,969
- SHA-256: `59201be3d33bdfbeb8459656d3ef37caf922382a06852bd7a609472fdce2da43`

The later Signature prototype is NOT selected for this implementation.

During preload construction an initial text-chunk assembly produced a two-byte-short Git blob. The prep audit rejected it. The replacement was reconstructed with the exact missing line boundaries. Cross-check against the raw owner file:
- lines 1–1000: exact chars/checksum/boundaries;
- lines 1001–2000: exact chars/checksum/boundaries;
- lines 2001–2969: exact chars/checksum/boundaries;
- final Git file byte count: 975,616.

The preflight script independently hashes the fetched Git Gold before anchoring and fails if it does not equal the owner SHA above.

## Deliberate omissions

The standalone physics/mechanics demonstrator is not included as a second authority. Its corrected lessons (native inertia, real collision bounce, Freeze refresh) are expressed directly in gameplay authority and gates.

Frost-specific SFX are deferred.
Lv2–Lv5 progression design is deferred.
Final post-playtest balance is deferred.

## Preload scope

Only:
- `docs/hero-rework/frost-v1/**`
- `tools/preflightFrostOneShot.mjs`

No production runtime/gameplay file is changed by the preload.

## Go state

The package is sufficient for a new zero-context Arena agent to:
1. recover/anchor safely from the exact post-Crystala baseline;
2. distinguish gameplay truth from selected Gold;
3. implement Level-1 Frost without inventing progression or SFX;
4. use minimal shared hooks only where audited capabilities are absent;
5. prove Frost behavior without masking locomotion/collision;
6. preserve current CRYSTALA/ROBOT/HUNTER/Arsenal behavior.

Implementation remains subject to owner playtest after automated/browser evidence.
