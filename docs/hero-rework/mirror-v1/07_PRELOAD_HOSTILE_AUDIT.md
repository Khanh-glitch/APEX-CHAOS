# MIRROR V1 — PRELOAD HOSTILE AUDIT

Status: **FINAL — 5 REQUIRED AUDIT PASSES COMPLETE + FINAL PACKAGE INTEGRITY PASS PENDING REMOTE COMMIT VERIFICATION**

Audit target: the complete preload package plus canonical Gold 12. The goal was not to make prose look consistent; each pass deliberately searched for failure modes already seen from Robot through Magnet.

## Pass 1 — canonical source identity / authority contamination

### Checks
- exact Gold SHA/bytes/lines;
- no external HTTP/src/href/fetch dependency;
- every required preload doc present;
- Gold 12 stated as absolute visual/feel authority;
- old Visual 3/4/5/9/10, VFX6, 13/14/fresh-shell candidates not promoted back to authority;
- old `130px` radius appears only in explicitly historical/current-baseline descriptions, never as target law.

### Result
**PASS.** No correction required.

Canonical identity confirmed:
- SHA-256 `c11a8f0fba8e3c37f1180e7746a9169a443be1a1c51d95fbdc464c3c50ef5205`;
- 107480 bytes;
- 1403 lines;
- self-contained.

## Pass 2 — Gold mechanic trace vs written lock

### Checks
Compared the written contract back to executable Gold for:
- `A1TS=1.6`, OWN `.58`, end `.92`;
- `A2TS=1.0`, snap `.25`, end `.64`;
- free-shard age `.7`, scan `.3`, seed radius 170;
- node surface NV[0]→NV[3];
- preview 34 / capture 17;
- destination image / emergence timing;
- recapture cooldowns.

### Findings + corrections

> **SUPERSEDED BY C-R EXECUTABLE MEASUREMENT (binding).** The statements in this
> section about **4 node lifecycle slots**, an **oldest-ACTIVE retirement**
> mechanic, and **not importing the 16-shard pool** are contradicted by direct
> measurement of the canonical executable. Gold's `ND` array has 4 storage
> entries, but the `SH` pool is 16, a node owns 5 shards for its whole life
> *including fold-out*, and `tryForm()` needs 5 free shards. So 1 node leaves 11
> free, 2 leave 6, 3 leave 1 — `formNode()` is never reached with `live >= 3`
> and the retirement branch is unreachable dead headroom. Production MUST make
> a fourth concurrent node **unproducible** via the per-owner 16/5 shard economy
> and MUST NOT implement a live "form a fourth and retire the oldest" mechanic.
> Spare capacity in an internal array is not a gameplay slot.
> See `10_ACTIVE_BASELINE_ADDENDUM.md` (C-R section) for the instrumented trace.
> This historical text is retained deliberately; it is not the current law.


1. Draft omitted Gold's longer **presentation busy recovery envelopes**: A1 ~2.2s and A2 ~1.8s. These affect idle choreography but must not become movement roots or extended gameplay action locks. Added to mechanic lock + tests.
2. Draft simplified the one-node case to “no routing”. Gold actually gives the touched node a local response and sets projectile capture-attempt cooldown ~0.40s even when no destination exists. Added exact behavior + test.

### Result
**PASS after correction.**

## Pass 3 — bridge architecture / renderer ownership / self-validation risk

### Checks
- canonical HTML must execute directly in parity harness;
- no reconstruction-vs-itself evidence;
- fixed 1/120, max12 substeps, one clock owner;
- post-movement root/history seam;
- no second movement/physics integrator;
- canvas state isolation;
- no generic circle/portal substitute;
- active prompt intentionally absent.

### Finding + correction
The first draft prescribed a preferred module split but did not explicitly forbid blindly adding another `Fighter.prototype.draw` wrapper. This is unsafe on the current layered Robot/Hunter/Crystala/Frost/Magnet renderer chain and repeats the Frost/Magnet failure mode where the nominal renderer was not the effective shipping seam.

Added a mandatory **effective shipping renderer / wrapper-chain gate**: audit actual final-baseline draw chain first; prove P1, P2 and Mirror-vs-Mirror exactly-once rendering; preserve existing post-world interop.

### Result
**PASS after correction.**

## Pass 4 — edge cases / cross-Hero semantics / lifecycle loss

### Checks
- bullet, shotgun pellet, grenade, normal thrown melee routing;
- Time replay and transformed payloads;
- T6;
- Magnet/Time/Crystal/Frost/Rubber/Black Hole/Math/Slime/Mirror interop;
- grenade/thrown lifecycle pause in escrow;
- destination/node lifecycle during transit.

### Findings + corrections
1. T6 wording was ambiguous. **T6 damage may still generate MIRROR shards** because the passive reacts to MIRROR realized HP loss; only the T6 object itself is immune to copy/routing manipulation. Clarified and gated.
2. Destination fallback paragraph was accidentally absent while a later sentence referenced “fallback above”. Hostile check caught the dangling authority. Added the actual Gold behavior: destination is fixed at capture; no retarget; if destination is no longer on at emergence, release falls back to the captured entry node/transform; never delete/duplicate projectile.
3. Added explicit KO/match lifecycle gate: no delayed dead-body A2 swap survives teardown.

### Result
**PASS after correction.**

## Pass 5 — hostile Agent interpretation / atomicity / concurrency / portability

### Checks
- look for places an Agent could technically satisfy wording while drifting from Gold;
- verify portable-preload-only status;
- verify no active prompt;
- verify transplant flow;
- inspect current AIL transaction semantics and Gold node concurrency.

### Findings + corrections
1. Current `RelocationTransaction.commit()` writes a move and emits `Relocated` before writing the next move. Final coordinates are correct, but a synchronous listener can observe a **half-swapped state**. Gold A2 has no observable intermediate state. Contract now requires both final coordinates written before the first swap/relocation event is observable; use a Mirror-local atomic batch or safely correct shared AIL with regressions.
2. Draft incorrectly summarized Gold as max three active/assembling nodes. Gold actually has **4 node lifecycle slots** while route-active cap is 3; the fourth slot permits assembly/fold overlap. Contract now retains 4 lifecycle slots per owner and 3 ACTIVE routing nodes.
3. Emergence offset was too abstract (“Gold-equivalent”). Gold uses `node center + incomingDir * 20`. Contract now states exact 20 Gold-world-px rule, transformed only by the same node world scale.
4. Reconfirmed 16 free-shard pool is **not** imported because owner explicitly retained APEX 6s shard lifetime balance law; node slot bound is retained because it directly defines Gold lifecycle concurrency.

### Result
**PASS after correction.**

# Final hostile conclusions

The preload now has no known unresolved authority contradiction.

Locked highest-risk rules:
- Gold 12 absolute visual/feel authority;
- direct canonical HTML parity, never reconstruction self-validation;
- A1 real equip on Gold OWN edge, not cast;
- A2 post-movement true atomic snap with no observable half-state;
- same-owner shard formation/network;
- exact Gold seed-radius formation and assembly timing;
- 4 node lifecycle slots / 3 active routing nodes per owner;
- actual oriented node surface shared by gameplay + presentation;
- real detached projectile-family coverage incl. grenade/thrown melee;
- 0.56s escrow with paused world lifecycle, fixed destination and defined fallback;
- no generic portal/circle visual fallback;
- no active prompt until transplant onto the then-current final implementation SHA.

## Remaining future work that is intentionally NOT a preload defect

The final implementation parent is not known yet because another implementation is still running. Therefore exact future:
- baseline SHA;
- runtime revision;
- protected hashes;
- test counts;
- effective renderer chain;
- changed shared seams
must be re-audited during transplant. This is explicitly required by `09_TRANSPLANT_AND_ACTIVATION_CHECKLIST.md` and is not guessed here.

No implementation is authorized by this document alone.
