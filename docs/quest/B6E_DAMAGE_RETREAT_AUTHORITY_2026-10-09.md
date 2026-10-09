# B6e physical Quest ally retreat — design and safety scope

Three approved E06 allies are real Fighter instances. When HP is threatened at <=100, E06's native damage adapter computes accepted damage at the physical **Fighter.takeDamage** boundary and invokes the existing engine method with that permitted amount. It never awards HP, sets HP upward, manufactures a KO, or changes damage in Free Battle. The host actor then withdraws once after actually reaching the threshold; other damage cannot silently kill it later.

The instance adapter retains all original methods and restores them on close. Its receipt carries the real source, amount not applied beyond the voluntary withdrawal point, HP and position for future draw choreography; it DOES NOT force an instant teleport, delete enemies or mark Quest complete.

This commit supplies **only** the isolated, tested damage adapter. E06 Gold battle integration must additionally:
- use team selectors that exclude `withdrawn` allies from hostile targeting and pickups
- suspend retired Fighters from movement/skills while a visible rig/frontline retreat choreo plays
- preserve live ally gun/cooldown and physical wave receipts
- switch approved J/K authority NEWBOT -> T.O.T -> RIVET
- refuse E06 signed checkpoint without three true wave clears and a result-panel acknowledgment

No autoplay, invented ally abilities or E07/E08 ending introduced by B6e.

## B6f native correction — accepted damage, not raw input
The full Arsenal test caught a critical engine mitigation ordering error: a 2,000 raw hit was reduced by Fighter to 585 HP loss, so the previous outer-method wrapper never reached 100 HP. That previous B6e model was **not valid** for production. This branch replaces it with two optional callbacks at the native **accepted damage** transaction: `__apexQuestBeforeAcceptedDamage` and `__apexQuestAfterAcceptedDamage`, installed only on E06 allies. Existing mitigation/immune status executes first; the final accepted damage is capped at the allowed threshold, and withdrawal is signed only AFTER physical HP actually falls to 100. No direct HP writes or state-only KO. CI must prove this on real Arsenal, not just a simplified mock.
