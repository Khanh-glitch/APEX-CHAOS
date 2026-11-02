# Implementation evidence

**Bible access.** The raw Bible was fetched to `ref/bible.md` (829 lines) and read in bounded excerpts: §0.2 invariants, §0.3 BUILD-0 baseline and §5.4 first escrow. Bible statuses map to this build's labels as follows:
- `[CHỐT]` → `LOCKED_CANON`
- `[ĐỀ XUẤT]` → `PROPOSED_MECHANISM`
- Unspecified numbers → `TUNABLE_BALANCE` (see `balance.v1.json`)

**Evidence levels.**
- **T** = automated test in `tests/soh.test.ts`. `npm test` runs 13 tests, all passing.
- **B** = real Chromium input pass via `scripts/qa.mjs` and `scripts/qa2.mjs`. Screenshots are in `qa-shots/`. No page errors were recorded.
- **C** = code path exists and is reachable through player input, but has no dedicated automated check.

## Owners K1–K8
| Owner | What it covers | Code |
|---|---|---|
| K1 custody | One `custody` map holds every container: inventory, equipment, chests, stations (fuel/output), carts, drops, bags, loot, cash. Moves, splits, sorts and drops are all dispatcher intents. | `engine.ts` `addItem`, `removeItem`, `bagContainers`, `apply('move')` |
| K2 environment | Fixed geography. Terrain changes are stored per run (burnt ground, temporary ice, Elder pillars and cages). | `world.ts`, `engine.effTile`, `sim.ignite`, `commitCore('frost')` |
| K3 source stocks | Finite deltas on top of the base world. Plants regrow on a timer. A new view or a reload never refills a source. | `engine.sourceAt`, `engine.harvestHit` |
| K4 research and work | One run-local recipe list. Blueprints, random or directed Spares research, and specimen/Core study all feed it. Stations need fuel and time, and output lands in physical slots. | `engine.research`, `engine.stepStations` |
| K5 actors and AI | Creatures know only what they see or what footprints they find. Footprint tracking, A* pathing, smashing walls and doors, death bags. | `sim.tickCreatures`, `sim.steer`, `sim.bashAhead` |
| K6 structures and POIs | 23 structures, claim ownership, roof plus enclosure shelter, POI doors gated by keycard or power. | `engine.buildReason`, `apply('build' / 'door' / 'generator')` |
| K7 freight | Cart with its own cargo container. Weight and surface (road, off-road, rough) set speed. Carts cannot ford water. | `sim.tickPlayer` cart rope, `balance.cart` |
| K8 clock, run, profile | Real UTC run clock with 336 h maximum, Ragnarok in the last 72 h, Elders awaken on day 14. The fictional day/night clock is separate. Covers evacuation, abandon, expiry and the wipe. | `engine.phaseOf`, `engine.dayTime`, `engine.endRun` |

## Contracts C01–C24
| ID | Status | Evidence |
|---|---|---|
| C01 node depletion | PASS T,B | A rock yields exactly its 6 units once, then reports `empty`. The browser showed a "+1" pickup. |
| C02 roadside scrap | C | Scrap piles and wrecks are placed within 2 tiles of roads (finite stock, chance of Spares or fuel cans). They feed research and the scrap→ingot furnace recipe. |
| C03 Core charge | PASS T | Cancelling before release keeps 3 charges. Releasing spends exactly 1. A Core can be used without knowing any recipe. |
| C04 one recipe authority | PASS T | Specimen → blueprint in the output slot → learned once. A duplicate blueprint is refused and not consumed. |
| C05 shared hit rules | PASS T,B | A knife on stone gives `nopower`. The same knife swing through the input path damages a boar. Earth Core spikes harvest rock. Torches and fire ignite trees. |
| C06 jobs, fuel, interruption | PASS T | 20 s of fuel at 10 s per ingot produces exactly 2 ingots; the rest of the queue pauses. |
| C07 build, transfer, reclaim | PASS T | No debit on a missing-materials or unowned build. Exact debit on success. A repeated intent is ignored. Reclaiming a loaded chest bags the contents with no loss and no duplication. |
| C08 traces → tracking | PASS T | A creature with no trail never gains trace knowledge. A laid footprint trail is followed. |
| C09 offline causality | PASS T | Offline settlement runs chronologically in 60 s steps. A sheltered player sits at ≥1 HP from hunger. An unsheltered player dies and leaves one bag. Creatures do not act offline. |
| C10 death bag | PASS T | `killPlayer` twice produces one bag. The bag survives a JSON round-trip. Respawn stays in the same run. |
| C11 POI depth | C | Foundry vault behind a keycard door; the keycard is in the Pass Watchtower crate. Lighthouse needs a fuel can in its generator. You can leave and re-enter freely. |
| C12 no quest gates | PASS by construction | There is no quest system. Every system is available in any order. |
| C13 freight tradeoffs | C | Cart speed: road ×1.05, off-road ×0.55, rough ×0.32, plus a weight penalty. Carts cannot cross water unless it has been frozen into ice. |
| C14 weather → world | PASS T / C | Rain trace decay is tested. Seeded weather schedule. Rain puts out fires and waters gardens and barrels. Storm lightning ignites trees. |
| C15 final-72 finite cash | PASS T,B | Cash chests stay sealed before h264. At h265 the chest mints 36 cash once. 7 chests in total. |
| C16 zero-wallet first deposit | PASS T,B | Cash chest → vendor escrow purchase (30) → claim → place → deposit 6. No Elder is needed. The browser purchase was done with real clicks. |
| C17 atomic, repeatable deposit | PASS T | A replayed deposit intent is ignored. Depositing with no cash is rejected. A second real deposit works and the run continues. |
| C18 run-2 vendor | PASS T | Secured cash is debited exactly once and the item is run-local. Stock is finite. No partial debit when cash is short. |
| C19 six Elders | C,B | 6 distinct sprites and pattern sets with latent and awakened forms, unique stones, leash and retreat. Treant drains trees, Colossus overheats, pillars and root cages block movement. Magma and Frost were screenshotted. |
| C20 score receipts | C | 12 achievements, each awarded once per run. Profile keeps the first award. Score never mints cash. |
| C21 LOCAL/UNVERIFIED | PASS T | History records are tagged `LOCAL/UNVERIFIED` and flag QA runs. No global leaderboard exists. |
| C22 evacuation | PASS T | Happens at the beacon only. A second `endRun` is rejected. Unsecured cash is not auto-secured. |
| C23 total wipe | PASS T | Run 2 has no escrow, claim, recipe or cash from run 1. The profile keeps secured cash, achievements and history. |
| C24 island and starts | PASS T | 200×200 tiles. All 4 starts are mutually reachable on foot and each has wood, stone and food within 12 tiles. |

## Assumptions and proposals
These are all `PROPOSED_MECHANISM` choices:
- **Ownership:** a Claim Totem with radius 6, maximum 2 claims, at least 10 tiles from landmarks.
- **Shelter:** a roofed, enclosed tile, or the roofed interior of a POI.
- **Escrow:** costs 30 cash at Mirela's Crossroads Trading Post.
- **Weather:** a 1-slot forecast.
- **Landing:** choosing a landing region is an optional convenience; Random is the canon default.

## Known limitations
- Creatures outside the 30-tile active radius, or while the game is closed, are frozen. Nothing acts remotely, so there are no offline raids at all.
- Projectiles and hazards are transient and not saved mid-flight.
- Elder balance has not been playtested deeply.
- Only the Magma and Frost Elders were inspected in the browser.
- The `window.__soh` hook exists for QA automation only.
- There is no online leaderboard.
- Gold fidelity cannot be claimed.
