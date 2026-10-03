# MIRROR — CHECKPOINT G SHIPPING CLOSURE

Status: **CLOSED by the commit containing this document**  
Runtime revision: **`20261002-mirror-v1-r27`**  
Canonical Gold: `MIRROR_GOLD_FUSION_12.html`, SHA-256 `c11a8f0fba8e3c37f1180e7746a9169a443be1a1c51d95fbdc464c3c50ef5205` (unchanged)

## Shipping architecture

G1 provides one isolated generated Gold instance per real Mirror and one bounded `1/120` presentation clock fed after gameplay. Gold demo movement, collision, formation, and routing are unreachable in shipping.

G2 replaces only Mirror's actor body layer, uses cached real Arsenal art for A1, and consumes real A2 events for one snap/history rebase. Arsenal remains authoritative for real held weapons. Finalized Core Six opponents use explicit body-only identity seams; no recursive `Fighter.draw()` is used.

G3 maps real `ct.store['mirror.passive']` slots/nodes into fixed Gold SH/ND proxies and consumes real F2 escrow events. P17 derives Gold's canvas basis from `HR.mirrorNode`. Routes are keyed by exact projectile reference, support concurrent same-entry/same-destination ownership, and never activate Gold PJ gameplay.

World effects use `after-world-before-fighters`; actor/A2 identity stays in the actor seam. HUD, floating damage, gameplay projectiles, and collision remain host-owned.

## Acceptance

Automated Mirror G gates and closed gameplay/Core-Six suites pass. The accepted broad parent retains 18 unrelated failures: Robot presentation 10, Hero Rework Goldens 2, Frost 4, Crystala 1, Hunter owner-fix 1. G4 introduced no additional known failure. Browser Gold raster/visual gates were environment-blocked by missing Chromium `libnspr4.so`; canonical source hash and deterministic generated module hash remain recorded in G4 evidence.

This is **automated structural acceptance**, not Checkpoint H owner visual acceptance.

F3-B remains deferred. **H is next and has not started.** Historical `M.world.shards` / `M.world.mirrors` and other compatibility/test seams are not current Mirror shipping authority. Wider legacy documentation, unfinished Heroes, compatibility cleanup, and repository hygiene are explicitly deferred to a separate post-Mirror campaign.
