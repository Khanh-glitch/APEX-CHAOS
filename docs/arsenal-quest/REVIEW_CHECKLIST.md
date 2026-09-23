# Arsenal Quest — Review Checklist

Use this after the coding agent reports completion.

## Architecture
- [ ] No standalone/recreated canvas engine was added.
- [ ] Existing Apex Fighter movement/bounce/collision is demonstrably reused.
- [ ] Gameplay logic is outside React.
- [ ] New mode is isolated under Arsenal/mode runtime files.
- [ ] Existing modes remain reachable.
- [ ] No multiplayer/network work was added.

## Spawn law
- [ ] Cadence is independent from collection state.
- [ ] Three or more slots/pickups can coexist.
- [ ] Reveal delay is 1.2–1.8s.
- [ ] Telegraph contains no weapon information.
- [ ] Telegraph is non-interactable.
- [ ] Old pickups do not prevent future spawn ticks.

## Combat
- [ ] Both fighters start 100 HP and unarmed.
- [ ] No intrinsic attack/skill leaks from a roster FighterType.
- [ ] Both sides can pick up.
- [ ] Already-armed fighter does not vacuum up every future pickup.
- [ ] Melee waits for valid range.
- [ ] Ranged sequence ends and consumes.
- [ ] Grenade resolves after being thrown.
- [ ] Reflect ownership is correct.
- [ ] Tower Shield actually alters incoming damage.
- [ ] Holders return to unarmed after consume.

## P0 weapons
- [ ] Pistol
- [ ] Shotgun
- [ ] SMG
- [ ] Sniper
- [ ] Grenade
- [ ] Sabre
- [ ] Battle Axe
- [ ] Dagger
- [ ] Spear
- [ ] Spiked Club
- [ ] Swirl Shield
- [ ] Tower Shield

## QA evidence
- [ ] `pnpm build` pass.
- [ ] Arsenal runtime test pass.
- [ ] Five-minute simulation with no uncaught errors.
- [ ] F3 overlay screenshot.
- [ ] Hidden telegraph screenshot.
- [ ] Multiple simultaneous pickups screenshot.
- [ ] HERO and RIVAL pickup evidence.
- [ ] Ranged/melee/shield evidence.
- [ ] Final SHA supplied.
- [ ] Known defects stated plainly.

## Product review
Ignore polish first. Ask:
1. Do unrevealed spawn points create anticipation?
2. Does multiple simultaneous loot make the arena more interesting?
3. Do pickups create visible reversals / near misses?
4. Does watching remain fun with zero progression?
5. Do you want to immediately rematch?

If the answer is no, do not rescue the prototype by adding meta systems.
