# MIRROR — CHECKPOINT G SHIPPING CLOSURE

Status: **CLOSED by the R3 follow-up commit containing this document**

Runtime revision: **`20261002-mirror-v1-r28`** (one transition from accepted R2 `r27`)

Canonical Gold: `MIRROR_GOLD_FUSION_12.html`, SHA-256 `c11a8f0fba8e3c37f1180e7746a9169a443be1a1c51d95fbdc464c3c50ef5205` (**byte-identical**)

Generated Gold runtime: `public/game/hero-rework/mirrorGoldV1.js`, SHA-256 `875e712d5be2017a7cab23b05eef036f51e756eb111267a259db62ddafedb30e` (verified through `tools/bridgeMirrorGoldV1.mjs`)

## Shipping architecture

G1 provides one isolated generated Gold instance per real Mirror and one bounded `1/120` presentation clock fed after gameplay. Gold demo movement, collision, formation, and routing are unreachable in shipping.

G2 replaces only Mirror's actor body layer, uses cached real Arsenal art for A1, and consumes real A2 events. Arsenal remains authoritative for real held weapons. Finalized Core Six opponents use explicit body-only identity seams; no recursive `Fighter.draw()` is used.

### R3 — A2 receiver-only history continuity

A real `MirrorExchange` is accepted only when its cast ID belongs to a currently registered Mirror A2 caster, its two actor IDs match the current Mirror/opponent pair, and its PRE/POST points are finite. Invalid, stale, cancelled/no-snap, pre-snap death, and teardown paths cannot trigger receiver work.

The caster still queues its existing `applyExternalExchange()` path; Gold performs the authored snap once and restores the actual POST roots. A participating Mirror with `a2CastId !== event.castId` instead calls Gold's `rebaseExternalExchangeHistory()` synchronously from the event callback. The receiver call is history-only: no A2 begin, authored snap, residue, or adapter tick. `pendingExchange` is subsequently consumed by the normal adapter tick to sample/sync POST roots.

The real resolver commits simultaneous Mirror-vs-Mirror coordinates once before emitting two coalesced notices. Its shared PRE result is oriented to the first request, while each notice's POST roots are actor-oriented. For coalesced events, the presentation adapter reconstructs the unordered PRE pair from the opposite committed POST roots. This keeps both notices on the same physical PRE/POST key without changing gameplay. Gold—not the adapter—continues to own physical dedupe by unordered actor pair plus PRE/POST samples, independent of cast ID or perspective. Distinct physical PRE/POST exchanges still rebase.

Gold history law is preserved: `Float32Array`, `HN=64`, `HS=22`; every sample shifts local-root channels `[0,1]` by the actor's PRE-to-POST delta, opponent-root channels `[20,21]` by its inverse, and leaves every other channel unchanged. Rebase and authored apply do not advance `hHead`; only the normal Gold step does.

G3 maps real `ct.store['mirror.passive']` slots/nodes into fixed Gold SH/ND proxies and consumes real F2 escrow events. P17 derives Gold's canvas basis from `HR.mirrorNode`. Routes are keyed by exact projectile reference, support concurrent same-entry/same-destination ownership, and never activate Gold PJ gameplay.

World effects use `after-world-before-fighters`; actor/A2 identity stays in the actor seam. HUD, floating damage, gameplay projectiles, and collision remain host-owned.

## Acceptance and evidence

R3 receiver closure passes **12/12** real-gameplay gates; the hostile G4 audit passes **18/18**. The full focused Mirror/F1/F2/Core-Six regression set passed. Exact gate counts, the runtime revision transition, broad-red attribution, build result, and environment limitations are recorded in [`evidence/r3-checkpoint-g-closure.json`](evidence/r3-checkpoint-g-closure.json). The focused receiver proof and Gold hashes are in [`evidence/r3-a2-receiver-closure.json`](evidence/r3-a2-receiver-closure.json).

The accepted parent retains exactly **18 unrelated baseline reds**, with no new Mirror G failure:

| Suite | Final result | Inherited reds |
|---|---:|---:|
| Robot presentation | 18/28 | 10 |
| Hero Rework Goldens | 9/11 | 2 |
| Frost | 162/166 | 4 |
| Crystala gameplay | 72/73 | 1 |
| Hunter owner-fix | 10/11 | 1 |

The exact inherited gate names are preserved in the closure evidence and the accepted baseline documents. Crystala's runtime cache-bust gate was green after the r28 relock; its sole final failure is the recorded inherited G07. No failure is reclassified as inherited beyond the stated 18.

The canonical Gold browser harness, visual oracle, D1 raster, and D3 choreography could not launch because `puppeteer-core` is not installed in this sandbox. No dependencies were installed. This is **automated structural acceptance**, not visual parity or Checkpoint H owner acceptance.

The approved production build steps passed: 20 approved SFX files materialized, the asset manifest generated with 705 assets, and Vite 5.4.21 built 35 modules. The `pnpm` wrapper was unavailable, so the package build's three steps were run directly using the already-installed local tools.

F3-B remains deferred. **Checkpoint H is next and has not started.** No playtest tuning, R4/R5 work, or repository cleanup is included in this closure.
