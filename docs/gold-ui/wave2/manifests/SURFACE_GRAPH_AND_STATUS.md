# APEX CHAOS — Target Surface Graph + Authority Status

Baseline reference: `63622a42...`.

## Target top-level product graph

HOME
- CONTINUE STORY — reserved / locked until story data exists.
- FREE BATTLE — active product entry; BOT / LOCAL are modes, not separate Home destinations.
- FIGHTER SHOP — future Wave 2 surface.
- LUCKY DRAW — Wave 1 Gold.
- UPGRADE — future Wave 2 surface.
- DICTIONARY — future Wave 2 surface.
- MISSIONS — future Wave 2 surface.
- PROFILE / ACCOUNT — future Wave 2 surface.
- SETTINGS — global gear overlay, not a route.

Achievements are nested under Profile -> Record.

## Free Battle graph

FREE BATTLE
-> mode resolution: BOT or LOCAL
-> GOLD PICK
-> GOLD BATTLE ENTRY
-> BATTLE
-> GOLD RESULT PHASE
   - REMATCH
   - CHANGE FIGHTERS
   - HOME

BOT/LOCAL selection presentation may be integrated into accepted Gold flow; this document does not authorize a new generic mode-select page.

## Status

| Surface | Product/UX Spec | Visual Gold | Public target |
|---|---|---|---|
| Home | Wave 1 | accepted current Gold | active |
| Pick | Wave 1 | accepted current Gold | active |
| Battle HUD | Wave 1 | accepted current Gold | active |
| Lucky Draw | Wave 1 | accepted current Gold | active |
| Result | extension locked here + Wave 1 visual | current Battle Gold owns visuals | active with Battle |
| Profile/Account | locked | pending | future |
| Fighter Shop | locked | pending | locked until visual + economy authority |
| Upgrade | philosophy locked | pending | locked |
| Missions | locked | pending | locked |
| Dictionary | locked | pending | candidate for early Wave 2 activation |
| Settings | locked | pending | future global overlay |
| Story/Quest | intentionally not designed | none | locked |

## Important migration note

The current `src/game/productSurface.js` graph is pre-pilot runtime truth, not the final target navigation information architecture.

Do not change it from this Wave 2 branch while Wave 1 implementation is active. A later integration change must deliberately reconcile the runtime graph with this accepted target.
