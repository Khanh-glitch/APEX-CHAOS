# Battle HUD — Gold/demo trigger inventory and production semantic mapping

Date: 2026-10-04
Authority: OWNER PATCH — Battle HUD Semantic Trigger Authority
Runtime implementation: `public/game/ui/apexCombatHudTriggerRuntime.js`
Proof: `tools/testCombatHudSemanticTriggers.mjs` (33 gates)

Production runtime truth is the only trigger authority. Gold demo buttons,
keyboard shortcuts, showcase timers, animation endpoints, test controls and
synthetic demo events are NOT production trigger authority.

## 1. Every trigger found in the Battle HUD donor

Source: `docs/gold-ui/current/donors/battle-hud/index.html`, `act(k)` at
line ~1320 and the `keydown` / `pointerdown` bindings at ~1337 and ~1341.

| Donor trigger | Donor behavior | Disposition | Production semantic source |
|---|---|---|---|
| `v` | cycle viewport preset + toast | **NON-PRODUCTION / REMOVE** | none — showcase control |
| `m` | `S.mode = 2p ? 1p : 2p` + toast | **NON-PRODUCTION / REMOVE** | none. **Collides with the M = music mute law. Must not survive production.** |
| `j` | `cast(0,0)` | **NON-PRODUCTION as a trigger** | real accepted cast → AIL bus `Cast` (emitted only after `exec.cast()` returned truthy) |
| `k` | `cast(0,1)` | **NON-PRODUCTION as a trigger** | same |
| `u` | `cast(1,0)` | **NON-PRODUCTION as a trigger** | same; P2 controls active only under real Local 2P product state |
| `i` | `cast(1,1)` | **NON-PRODUCTION as a trigger** | same |
| `h` | synthetic `applyDamage(...,'normal')` 18–28 | **NON-PRODUCTION / REMOVE** | real realized damage → `apexEngine.js` `takeDamage` → `APEX_COMBAT_HUD.onRealizedDamage` |
| `c` | synthetic `applyDamage(...,'crit')` 72–96 | **NON-PRODUCTION / REMOVE** | real firearm crit → same event with `critical === true` **and** Arsenal-confirmed gun origin |
| `d` | synthetic `applyDamage(...,'heavy')` 150–185 | **NON-PRODUCTION / REMOVE** | HEAVY is derived, never authored: >200 realized damage per victim in a rolling 1.20 s window |
| `w` / `e` | `swapWeapon(0/1)` | **NON-PRODUCTION as a trigger** | real Arsenal ownership/equip change |
| `r` | `resetDemo()` | **NON-PRODUCTION / REMOVE** | none — demo baseline |
| `t` | toggle diagnostics panel | **NON-PRODUCTION / REMOVE** | none |
| `p` | toggle sim pause | **NON-PRODUCTION / REMOVE** | none |
| `l` | toggle lab panel | **NON-PRODUCTION / REMOVE** | none |
| `Escape` | (donor shell) | **NON-PRODUCTION / REMOVE** | product navigation state |
| `pointerdown` on `.skill` | demo skill button | **NON-PRODUCTION as a trigger** | real accepted cast only |
| `pointerdown` on `.wp-swap` | demo weapon swap button | **NON-PRODUCTION as a trigger** | real ownership change only |
| `ko()` internal `setTimeout(1900)` round advance | synthetic timed KO / round reset | **NON-PRODUCTION / REMOVE** | real authoritative KO/death + real round/match state transition |
| damage-number DOM node appearance | (would be DOM-to-DOM inference) | **FORBIDDEN** | never a trigger source |

No demo-only effect trigger button is exposed or retained in production.
`tools/testCombatHudSemanticTriggers.mjs` asserts the production trigger
runtime contains no `addEventListener`, no `keydown`, no key literal, and none
of `resetDemo` / `applyViewport` / `runDiag` / `swapWeapon(` / `PRESETS`.

## 2. Trigger → production semantic source map (implemented)

| Presentation | Production source of truth | Guard that keeps it honest |
|---|---|---|
| **NORMAL HIT** | real realized non-critical damage transaction (`apexEngine.js` `takeDamage` → `APEX_COMBAT_HUD.onRealizedDamage`) | amount must be `> 0`; zero/blocked/miss presents nothing |
| **CRITICAL** | same event, `critical === true` **AND** firearm origin confirmed by `APEX_ARSENAL_CONFIG.isGun(weaponId)` | fails **closed**: no Arsenal identity ⇒ not Critical. Melee / grenade / shield / heal / native hero-skill / environmental / status damage are never Critical regardless of size |
| **HEAVY** | per-victim rolling 1.20 s window over realized damage, `total > 200` | triggers at the first qualifying moment, at most once per burst, latch resets when the window empties. Presentation-only: no damage math, no multiplier, not a balance mechanic, not equivalent to Critical |
| **THUNDER** | confirmed `STORMBREAKER` damage (Arsenal label `arsenal-stormbreaker`) | layers HEAVY + THUNDER; never reinterpreted as a crit; never replaces global firearm-crit semantics |
| **HEAL** | real heal transaction (`apexEngine.js` `heal()` → `APEX_COMBAT_HUD.onHeal`) | never inferred from green DOM text or animation state |
| **WEAPON CHANGE** | real Arsenal ownership/equip change | `from === to` presents nothing; never from weapon-art animation completion or placeholder swapping |
| **LOW HP** | authoritative production low-HP condition, supplied by production | the runtime owns **no** HP threshold of its own; fires on the crossing edge only |
| **SKILL CAST** | AIL bus `Cast` (emitted only after `exec.cast()` returned truthy) | `CastFailCue` / `reason` / `rejected` never present a successful cast |
| **SKILL READY** | real cooldown/charge transition back to usable (`usable === true`) | never from an authored cooldown animation finishing |
| **KO** | real authoritative KO/death result | no synthetic timed KO; requires a real victim/winner |
| **ROUND / MATCH STATE** | real production round/match/result state transition | same state is not a transition; presentation choreographs timing but never invents the transition |

Damage-number semantic family is preserved as data tokens, not hard-coded
colors: normal = `red`/`standard`, firearm critical = `orange`/`diamond`,
healing = `green`/`standard`. P1/P2 ownership color is a separate semantic
system resolved by the HUD renderer from product state.

## 3. Input / control law

- Input keys are NOT HUD trigger authority. The trigger runtime consumes
  semantic production state/events, so changing `J`/`K` or any future skill key
  requires **no** change to HUD/VFX trigger logic.
- `M` = global MUSIC-only mute/unmute. It preserves the playhead, does not mute
  battle SFX or master, and does not change BOT/Local/P1/P2 mode.
- The donor's demo `M = toggle 1P/2P` **does not survive production**. It is
  quarantined to `docs/gold-ui/current/donors/battle-hud/index.html`. No
  production file carries it and no file synthesizes keyboard events to change
  game mode (`tools/testGoldCutoverDomBoot.mjs` asserts both).
- BOT uses P1 control/button semantics. P2-specific controls are active only
  when real Local 2P product state is active.

## 4. Conflicts found with pre-existing implementation

| Conflict | Resolution |
|---|---|
| The Battle HUD donor binds `M` to 1P/2P mode | Removed from production; `M` is music-only. Donor copy left in docs as reference only |
| `apexPickRuntime.js` Pick-screen music button called `apexPlayMenuMusic(false)` / `apexStopMenuMusic(false)`, i.e. a second music toggle | Rerouted to `window.apexToggleThemeMusic()` so the button and `M` share ONE music-only mute state and cannot fight each other |
| `apexPickRuntime.js` start-button called `apexStopMenuMusic(true)` (reset playhead) | Replaced with `window.apexEnterBattleMatchTheme()` — the real match-start seam, which fades and preserves the playhead |
| `arsenalBattleRuntime.js` mode exit called `apexPlayMenuMusic(true)` (restart at 0) | Replaced with `window.apexSetThemeSurface('home')`; result/return resumes the same preserved playhead |
| `src/App.jsx` `runApex` called `stopMenuMusic(true)` / `playMenuMusic(true)` on handoffs | Reset semantics removed entirely; only the actual match-start seam stops the theme |
| No production low-HP state existed | Classifier takes the threshold/`low` flag from production rather than authoring its own |
| `RealizedDamageEvent` on the AIL bus carries no `critical` flag (crit rides `__aqHitCrit` through the engine seam) | Classifier reads `critical` + Arsenal weapon identity from the engine's single realized-damage choke point, and accepts an explicit `weaponId` for forward compatibility |
