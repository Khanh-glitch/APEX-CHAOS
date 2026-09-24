# ARSENAL V2 — 32-FIGHTER ROSTER COMPATIBILITY MATRIX (Checkpoint B, A-CORR-3)

Authoritative rule set: `V2_CHECKPOINT_B_HANDOFF.md` PART 1 / A-CORR-3.
Supersedes Checkpoint A's blanket "native kit disabled" shell policy.

## Global Arsenal rules applied to every shell (documented adaptations)

| Rule | Implementation | Reason |
|---|---|---|
| Rage variants suppressed on all shells | shell types keep `noRage: true` | Rage versions (BLACK_HOLE projectile absorption/reflect, SNIPER corner-nest teleport, WITCH double curse, WIND rage orbit growth, TOXIC spit, SLIME 3-way split…) push beyond the narrow identity window and were explicitly disabled in Checkpoint A; base kits are what this pass restores. Documented as a roster-wide ADAPT. |
| Fighter movement law stays Arsenal-normalized base speed | shell `speed: CFG.FIGHTER_SPEED`, native `speedModifier` delegated | Weapon aim never steers the body; native skills MAY still change speed as identity (SAW spin, HUNTER hunt, WOLF scent, MONK rush, RUBBER kinetic). |
| All native hooks guarded | every delegated `init/update/draw/onWallBounce/onCollide/onTakeDamage` runs inside try/catch | A native-kit fault can never corrupt Arsenal weapon pickup/reveal/holder state. |
| No native mechanic touches Arsenal weapon state | verified by audit below + QA gate `native-kit-does-not-touch-weapon-state` | A-CORR-3 decision rules: no auto reveal/pick/equip, no sprite overwrite, no holder replacement. |
| Match HP / base tuning unchanged | `MATCH_HP = 100` kept; only two narrow per-fighter exceptions (VAMPIRE latch, MONK trauma rush) | A-CORR-3: keep Arsenal match HP/base tuning unless a specific mechanic depends on another value. |

Rage-only mechanics are listed as **KEEP (base)** with the rage branch noted as suppressed-by-global-rule; they are not re-listed as SUPPRESS rows because the same row's base kit is kept.

## Per-fighter decisions

| # | Fighter | Native mechanics (engine evidence) | Decision | Arsenal behavior / rationale |
|---|---|---|---|---|
| 1 | RUBBER | Kinetic bounce speed/size growth, wall-bounce kinetic stacks, collision damage+push; after tier-4 learns a random sub-skill (`castRubberSubSkill`) | **KEEP** | Movement/speed identity is allowed. Sub-skill casts other fighters' kits via name-keyed global spawners — coexists with Arsenal weapons (spawns projectiles only, never touches weapon holder/reveal). Rage radius growth inert (noRage). |
| 2 | ICE | Frost `ice_lane` projectile on cooldown; rage 3-touch frost execution | **KEEP (base)** | Lane is a telegraphed hazard projectile; coexists with `aq_*` projectiles. Rage frost touches suppressed by global rule. |
| 3 | VAMPIRE | Contact latch: locks self onto enemy (`positionLocked`), 1.5 dmg / 0.5 s drain + heal; rage blood link | **ADAPT** | Latch duration 5.0 s → **2.5 s** in Arsenal (`f.type.arsenalShell` hook in engine): a 5 s mutual position lock stalls the 4.5 s spawn/reveal loop. Drain/heal kept (heal already clamps to maxHp 100). Rage blood link suppressed by global rule. |
| 4 | STRING | Web-kit injected by `public/game/fighters/stringRuntime.js` + `stringHardeningRuntime.js`, which patch the live `FighterTypes` STRING entry (`FighterTypes.find(t => t.name === 'STRING')`) | **KEEP** | Shell base type IS the patched live entry, so delegating `base.update/draw` restores the full web kit with zero extra code. Name-keyed engine hooks keep working because shells keep `name`. |
| 5 | VOLCANO | 9-meteor predicted strike volley | **KEEP** | Hazards allowed; meteor type already excluded from well/magnet interactions (engine line ~1573). |
| 6 | MAGNET | Two-pole `magnet_field` slam; owner clamped inside field shell | **KEEP** | Field self-clamps owner position as identity movement; excludes lane/wall types by engine list. Understandable next to weapons. |
| 7 | FLASH | Dash + immune window; rage zigzag multi-hit | **KEEP (base)** | Dash sets dir toward enemy as identity movement (native skill, not weapon aim). Rage zigzag suppressed by global rule. |
| 8 | ELECTRIC | Wall-hit charge nodes + contact lightning discharge (`noRage` native) | **KEEP** | Charge/discharge is pure contact identity; nodes are `visualOnly` projectiles. |
| 9 | ORBIT | Elemental satellite ring, satellite contact effects, rage ring-2 spawn | **KEEP (base)** | Satellites orbit the body; contact statuses coexist with weapon damage. Rage extra satellites suppressed. |
| 10 | TOXIC | Poison trail droplets, collision puddle burst, self-poison; rage spit | **KEEP (base)** | Trail/puddle hazards allowed. Rage spit suppressed. |
| 11 | MIRROR | Mirror gate spawn; stolen-skill collide (`mirrorStolenCollide` copies enemy `type.*`) | **KEEP** | In Arsenal the stolen type is the enemy's shell type → its guarded wrappers run, so a stolen kit can never crash or touch weapon state. Gate swap reposition is identity. |
| 12 | BLACK_HOLE | `gravity_well` on cooldown (pulls only fighters); rage-only projectile absorption + double reflect (engine ~line 1766: absorption is inside `if (owner && owner.isRage)`) | **KEEP (base)** | Base well never absorbs `aq_*` projectiles because absorption requires rage, which shells disable — Arsenal projectiles coexist safely with no extra patch. Rage absorb/reflect suppressed by global rule. |
| 13 | SAW | Spin mode speed 1.55× + blood-rip ticks + bleed; rage saw-wall arena | **KEEP (base)** | Spin speed is identity movement. Rage wall arena suppressed. |
| 14 | BLADE | Wall-bounce crescent `blade_wave` projectiles; rage triple bounce | **KEEP (base)** | Bounce-triggered waves fit Arsenal's bounce movement law. Rage spread suppressed. |
| 15 | NOVA | Live identity is **GALAXY** — `galaxyRuntime.js` (`GALAXY_REPLACES_NOVA_PATCH`) removed NOVA from the roster and evolved its fate-core kit into the GALAXY system. Shell `NOVA` resolves through `IDENTITY_ALIASES.NOVA = 'GALAXY'` | **KEEP** | Charge/auto-detonation successor identity runs as-is via the alias; shell keeps the canonical NOVA name for cards/engine hooks. Readable timing identity, self-contained damage. |
| 16 | HUNTER | Hunt mode: alpha 0.14 body, 1.65× steer-toward-enemy, homing weak strike; knife crits on weak | **KEEP (base)** | Steering is identity movement (allowed); invisibility is draw-only and still shows hunt ring + label. Rage crit bonus suppressed. |
| 17 | CRYSTAL | `crystal_wall` between fighters + diamond-prison execution check | **KEEP** | Walls are telegraphed static hazards; execution is contact-based like other kits. Rage permanent walls suppressed. |
| 18 | VIRUS | Parasite child swarm spawns + merge (`spawnVirusChildren`, name-keyed globals) | **KEEP** | Summons allowed by A-CORR-3; engine hooks are name-keyed so shells work unchanged. |
| 19 | DRUM | Wall-beat shockwave drums; rage solo (0.3× speed, damage halved-back) | **KEEP (base)** | Wall beats read naturally with bounce movement. Rage solo suppressed. |
| 20 | CARD | Draw-3 / show / guaranteed `card_throw` cycle | **KEEP** | Self-contained projectile cycle; `unblockable` flag only affects native block logic. |
| 21 | MATH | Formula projectile with positional damage value | **KEEP** | Pure projectile identity. Rage formula variants suppressed. |
| 22 | MATH_V2 | Oxy graph wall caster (`math_v2_grid` + graph) | **KEEP** | Static graph hazards; understandable next to weapons. Rage fast-cast suppressed. |
| 23 | SNIPER | LOCK ON aim (positionLocked + setDir at enemy) → distance-scaled laser shot; rage corner-nest relocate | **KEEP (base)** | Native fighter aiming at the enemy is identity movement — the Arsenal *weapon* aim stays fully decoupled (`aimAngle` damping unchanged). Rage nest teleport suppressed by global rule. |
| 24 | SLIME | Split-guard children on burst damage + gel armor damage buffer | **KEEP (base)** | Summons + damage buffer allowed. Rage 3-way split suppressed (2-way kept). |
| 25 | TIME | Clock-hand tick damage; time mark → rewind (position/HP restore), rage death-rewind + rift | **KEEP (base)** | Rewind reposition is identity. Rage death-rewind/rift suppressed. |
| 26 | WOLF | Blood-scent tracking steer + bite; speedModifier 1.75× near scented low-HP enemy | **KEEP (base)** | Scent steering/speed is identity movement. Rage weak-bite chance suppressed. |
| 27 | WIND | Live identity is **PUPPET** — `apexCanonicalBalance.js` renames WIND → PUPPET at boot (cyclone orbit replaces straight movement via `positionLocked`, cyclone hold locks enemy 1 s + DoT, gale lane; puppet visual runtime skins it). Shell `WIND` resolves through `IDENTITY_ALIASES.WIND = 'PUPPET'` | **KEEP** | Orbit movement IS Wind/Puppet's real identity (A-CORR-3 explicitly allows native movement skills); enemy hold is a short, telegraphed reposition. Rage orbit growth suppressed. |
| 28 | WITCH | Magic ray + curse rolls | **KEEP (base)** | Ray/curse coexist with weapons. Rage double curse suppressed. |
| 29 | PIRATE | Loot combo spawns + anchor rope trigger | **KEEP** | Loot/anchor are its own pickups/hooks — they never reveal, pick or equip Arsenal weapons (audit: `addPirateLoot`/`triggerPirateAnchor` touch no Arsenal API). |
| 30 | PAINTER | Wall-bounce paint strokes, ink terrain drops, paint blobs | **KEEP** | Terrain paint is presentation + minor hazard; no weapon-state interaction. |
| 31 | MONK | Live identity is **KUNGFU** — `apexCanonicalBalance.js` renames MONK → KUNGFU and `apexPrecisionFixes.js` rewrites the kit (qi strikes, 5-step combo, giant palm, TRAUMA RUSH pin at 10× speed). Shell `MONK` resolves through `IDENTITY_ALIASES.MONK = 'KUNGFU'` | **ADAPT** | Rush/stun durations 5 s → **2.5 s** in Arsenal (`f.type.arsenalShell` hook, applied in BOTH the engine MONK definition and the post-boot KUNGFU rewrite): a 5 s full pin removes both players from the spawn/reveal/weapon loop for longer than an entire weapon rotation. Combo steps, punch/palm identity kept. Rage dim-mak heal suppressed. |
| 32 | SUPERSTAR | Media event cycle (spotlight/fan swarm summons, invincibility windows) | **KEEP (base)** | Summons + temporary invincibility windows are understandable event identity. Rage fan-accelerated events suppressed. |

## Summary

- **KEEP: 30** (21 pure KEEP, 9 KEEP-base with rage branch suppressed by the global rule — ICE, FLASH, ORBIT, TOXIC, BLACK_HOLE, SAW, BLADE, DRUM, HUNTER, SNIPER, SLIME, TIME, WOLF, WITCH, SUPERSTAR count as KEEP-base rows above)
- **ADAPT: 2** — VAMPIRE (latch 5.0 s → 2.5 s), MONK (trauma rush/stun 5 s → 2.5 s). Both are single-line `arsenalShell`-keyed engine hooks, not scattered mode checks.
- **SUPPRESS: 0 whole kits.** The only suppressed mechanics are the rage variants of the KEEP-base rows, via the single documented roster-wide rule (`noRage` on shells) — no per-fighter blanket no-op `update` anywhere.

Every fighter has at least one documented identity decision (this table), all 32 remain selectable (shell roster unchanged), and no listed mechanic reveals/picks/equips Arsenal weapons, overwrites weapon sprites, or replaces holder state — enforced by the guarded delegation layer and the roster QA gates.

## Post-boot identity resolution (implementation note)

Three canonical names are re-keyed by mainline boot patches before any Arsenal code runs:

| Canonical shell name | Live type at runtime | Patch |
|---|---|---|
| NOVA | GALAXY | `public/game/fighters/galaxyRuntime.js` — `GALAXY_REPLACES_NOVA_PATCH` |
| WIND | PUPPET | `public/game/core/apexCanonicalBalance.js` |
| MONK | KUNGFU | `public/game/core/apexCanonicalBalance.js` + kit rewrite in `public/game/core/apexPrecisionFixes.js` |

`arsenalShellSelectRuntime.js` maps these via `IDENTITY_ALIASES` so the shells run the CURRENT live identity while cards, engine name-keyed hooks and QA keep the canonical 32 names. Without this mapping the three shells previously fell back to blank gray blobs (Checkpoint A behavior).
