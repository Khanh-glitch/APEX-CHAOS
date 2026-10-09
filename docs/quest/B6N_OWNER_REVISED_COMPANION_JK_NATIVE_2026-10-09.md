# Quest 01 · B6n — Owner-revised real J/K candidate for T.O.T and RIVET

Status: **PLAYABLE NATIVE EXPERIMENT — Owner balancing / motion acceptance still needed**.
Parent lineage: B8b → B6l (passive rig and causal E06 Story) → B6m (superseded kit) → B6n. Changes are isolated to E06 and the Gold skill adapter. **Do not merge to production or promote to canon without owner playtest.**

## Owner authoring takes precedence over B6m

T.O.T and NEWBOT originate within the same project. Their J/A1 must be the **same Weapon Dash**, rather than a wholly different magic skill. T.O.T K stores one ACTUAL gun picked up in a **2s post-cast pickup window**, removes it from the hand **before auto-fire**, holds that exact item indefinitely without K cooldown during storage, and permits a second K to draw that item for normal Arsenal use. The code never clones a gun or its ammo, does not summon it from an ID, and cannot draw while an ordinary weapon is occupying the hand.

RIVET is an engineer/researcher robot, not an offense-oriented hero. J is a **physical field interception**: plant at current body coordinate, wait for a real advancing hostile to ENTER proximity, clamp it on contact, then resume moving; if nobody enters it times out with no fabricated victim. RIVET K duplicates NEWBOT's Virtual Armor and its numbers **exactly**, without inventing an immunity.

| Hero | J | K |
|---|---|---|
| NEWBOT | Original Robot Weapon Dash, unchanged | Original Robot Virtual Armor, unchanged |
| T.O.T | Robot Weapon Dash **10s CD / 3400 speed / .55s dash / 11 turn rate / 34 arrival radius / .26s start**; native floor pickup still required | **2s pickup window**, single real ranged gun stored; second press redraws exact native holder; **no cooldown while stashed**. Provisional balance: 8s cooldown after drawing and 3s failed-capture retry |
| RIVET | **Research Intercept**: plant & wait 2.4s, catch first *newly entering* hostile inside radius 190 (outside 150px natural Fighter collision threshold), lock 1.15s, then release; 12s provisional cooldown | Robot Virtual Armor **10s cooldown / 3s duration / incoming damage ×0.45 / not CC immune** |

### T.O.T's tactical AI — no instant store/redraw loop

- Prime the **2s** storage window only when unarmed and a *genuine revealed* nearby weapon is available.
- The ordinary J dash may then accelerate pickup; it **never teleports/equips** the item.
- Save the exact native holder object, preserving ammo/phase/metadata and preventing an immediate shot. T.O.T can still pick up a different ordinary gun while one is stored.
- Keep the reserve across waves and calm periods, then draw only when genuinely **threatened** (armed enemy nearby), another ally is critically injured, T.O.T is wounded, or after an extended gun drought with hostiles within range. If a different gun occupies the hand, wait for the ordinary holder to finish; no overwrite/no duplication.
- After the last two allied withdrawals, T.O.T is not a playable caster anymore. Existing skills remain scoped to *E06 ALLY* only, never leak into E08 T.O.T HOSTILE. With NEWBOT active, companion AI can cast skills; once its J/K becomes player-controlled, its AI ceases autonomously casting.
- K after storage: **zero running cooldown** until the real redraw. The 8s *after*-redraw cooldown is a proposed balancing value, **not an owner-approved law**; it may need to become 0 if the owner's intention is no post-redraw penalty.

### RIVET field interception

RIVET pauses its **real Fighter body**, not a remote turret. Newly crossing hostile gets native `stun`; RIVET remains planted until the 1.15s clamp ends then resumes movement. If the enemy was already inside the radius when J was pressed, it needs to leave and re-enter; no unconditional proximity stun at button press. Timeout is harmless. RIVET can be damaged/withdrawn while waiting.

### Safety invariants

- No new weapon, floor slot, scripted damage, fake heal, ally teleport or checkpoint from these skills. Single native holder attached to one Fighter at a time.
- Retreated bodies cannot cast. RIVET K mitigates damage **inside** the canonical Fighter accepted-damage path through E06 retreat middleware. It never writes HP.
- No global change to Free Battle's Newbot J/K, BOT AI, Local 1v1, weapon registry or input mapping.
- Gold touch J/K and physical J/K route to the same active ally NEWBOT → T.O.T → RIVET.
- The visual system may accent the real action but never becomes hit authority; Gold V12 art identity is retained.
- STORY after E06 still gated by ten real wave KOs and full relay→scan→return→override ordering. E07/E08 fixture contracts not reclassified as playable.

## Gate classification

`tools/testQuestCompanionNativeB6n.mjs` exercises single-holder identity, no ammo dupe, valid floor pickup, cooldown modes, native body motion, AI delayed draw, physical enter/leave contact, exact Virtual Armor data, withdrawal control and cleanup.

`--quest-breach-native` verifies existing actual Fighter combat continues; Gold Chrome `--verify-breach-three-waves` validates the wider Quest entrance and story but is engine-instrumented and **does not prove natural AI balance or perceptual quality**.

No new canon speech; first owner gameplay feedback needed before Gold-visual/timing final lock.

## B6n collision correction (2026-10-09)

The original J catch radius 145 was unreachable with real 75+75 Fighter collider separation. A legal 190px catch radius allows the hostile to enter a 40px approach band without penetrating either body. Browser evidence then revealed the Quest N-body collision solver could still move a planted RIVET because it split all overlaps equally. The E06-only `questResearchAnchored` flag now preserves the chassis coordinate; the mobile actor receives the separation displacement, and the flag is cleared on clamp expiration, cast timeout, stun, withdrawal and match teardown. No Free Battle/global movement semantics were changed.
