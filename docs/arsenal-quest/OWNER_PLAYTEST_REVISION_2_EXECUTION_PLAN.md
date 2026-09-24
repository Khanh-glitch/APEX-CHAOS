# Revision 2 execution plan (working memory)

**Branch:** `arena/01a0cf5e-apex-chaos`  
**Remote tip at kickoff:** `578afca` (contract `3be3dd9` + evidence)  
**Playtest/main:** not touched

## Milestone status

| MS | Scope | Status |
|----|--------|--------|
| A | Senko scale, detached exits, rarity under-light, gunshot fade-tail, casing land | complete (headless 145) |
| B | cooldown HUD, Newbie J no-op, melee, shotgun TTL | complete |
| C | Quest V1 20 stages + persistence | complete |
| D | full headless + browser + Vite | in CI |

## Decisions

- `SENKO_WORLD_SCALE` is the only Senko visual size knob; persist SVG intrinsic `sourceW/sourceH` in generated C-set.
- Floor / equipped / detached guns consume `worldW/worldH = source * SENKO_WORLD_SCALE`.
- Guns detach into `AQ.state.detachedWeapons` (world x/y/vx/vy). Grenade/shield keep pose ghosts.
- Revealed tiered pickups: one rarity ellipse, no extra black oval. Telegraph stays neutral.
- Gunshot: gain attack 3ms + body + fadeTail; `src.start` duration includes tail; stop after gain ~0.
- Casing SFX on first floor contact (`casing_land`), not spawn.
- Melee ricochet: bounce only while `ricochetsLeft > 0`; next wall after 0 exits.
- Shotgun `bulletLife = (arenaDiagonal + 80) / bulletSpeed`.
- Quest key `apexChaos.arsenalQuest.v1`. Stage 20 MONK → live KUNGFU.

## Validation

- `node tools/testArsenalQuestHeadless.mjs`
- `node tools/testArsenalQuestRuntime.mjs` (CI Chrome)
- Vite production build in CI
