# RETIRED — B6m candidate (never integrated)

**SUPERSEDED BY THE OWNER'S B6n DESIGN:** See [B6N_OWNER_REVISED_COMPANION_JK_NATIVE_2026-10-09.md](B6N_OWNER_REVISED_COMPANION_JK_NATIVE_2026-10-09.md). All four B6m abilities below were rejected or revised by the owner. This document is historical design provenance ONLY. The unused implementation and preflight were removed from the active B6n tree; B6n uses native E06 capabilities.

---

# Quest 01 · B6m — Candidate J/K for T.O.T and RIVET (NOT CANON, NOT LIVE)

**Parent:** B6l HEAD `063f92e07d95a973809ba9b4d8375bc13cab4a29`.
**State:** owner authorized AI to invent and propose kits; **owner has not approved these four particular moves**. This is a separate prototype branch with a pure selectable contract. It is deliberately NOT registered in runtimeManifest, does not intercept global J/K, does not alter Gold, does not change enemy damage, and does not grant checkpoints.

## Design thesis

Three playable phases of E06 are emotionally/gameplay distinct:
- **NEWBOT:** existing offensive Robot gameplay, untouched.
- **T.O.T:** *create one safe second / put myself in danger for my friend*, foreshadows a voluntary choice without spoiling E08. Pearl-white Gold Operator, small gesture/dual warm-lit optics.
- **RIVET:** *I am the heavy machinery; if I hold something, it holds me too*. Iron Bulwark chassis, moving joints/plates, graphite-gold brake flash, **not** a duplicate Stormbreaker or remotely operated rig.

No new gun tier, no teleport, no scripted HP, no map-cover clutter, no extra button. Natural AI casts from allied companions while NEWBOT is active must use exactly the same native executor and cooldowns as manual J/K after withdrawal; input authority follows NEWBOT → T.O.T → RIVET.

## Skill kit, provisional numeric tuning

| Actor | Input | Name / distinctive beat | Candidate contract |
|---|---|---|---|
| T.O.T | J | **LỆCH NHỊP / OFF-BEAT** — two tiny asynchronous white concentric half-rings interrupt weapon reflex | 0.28s tell; **up to 2 enemies** within 240; 0.70s `stun` after visible physical pulse; 0 damage; cooldown 11s |
| T.O.T | K | **CỨ ĐỂ TỚ / I WILL COVER** — folds shoulders, moves *in world* toward a threatened ally, steps between them and incoming shots | Select most injured living teammate within 380; travel at most 190 over 0.42s (collision/wall-resolved); brace 1.2s with only 25% self damage mitigation; **T.O.T owns its genuine HP loss and may withdraw**; cooldown 16s; if solo, brace self but no invented ally |
| RIVET | J | **CHỐT NEO / DEADLOCK** — claw clamps hostile; Rivet's feet gouge the floor while both struggle | One enemy within 240; **both RIVET and target** move at 0 velocity for 1.15s via existing `slow` status; both continue to shoot, no damage, no teleport; cooldown 10s |
| RIVET | K | **XẢ KHỚP / RELEASE THE JOINT** — armored joint compresses then violently releases a visible frontal sweep | 0.45s tell; 120° frontal cone / radius 185; max 3 enemies **rechecked at physical impact time**; 45 native Fighter damage each; 0.38s `push` strength 600, **only on accepted impact**; cooldown 15s |

The proposed values are *playtest candidates*, not owner-signed canon. Do not use generic centered glowing AOE rings. J/K choreography must be readable while preserving the 1:1 Gold arena, hero silhouette and the three allies' team HP. The source Gold V12 rig remains the actual owner asset authority. Cap offensive firearm slots at 5.

## Why these do not copy existing Core Six heroes

T.O.T's support casts are **proactive safe-time and genuine interposition** rather than Frost ice, Hunter traps, Magnet gun force or Robot dash. RIVET's shared-root creates a **risk** the player feels: enemies may still shoot during the hold; the K release is committed *forward only*, unlike an unconditional full-circle pulse. None duplicates Mirror, Stormbreaker, T6 weapons, or any autonomous rig behavior.

## Native implementation conditions — MUST pass before shipping

- For T.O.T J: render/measure actual pulse crossing before `applyStatus('stun', .7)` and preserve hostile AI/health validity. No status from overlay alone.
- For T.O.T K: do not teleport, modify partner HP, silently absorb bullets, or create artificial shield invulnerability. Interposition is physical and may **fail**; damage reduction applies to *T.O.T only* inside the existing accepted-damage transaction. Audit collision and wall interactions across mobile frames.
- For RIVET J: existing Fighter has **no built-in 'root' status**; use `slow` with multiplier 0 on BOTH actors and preserve their independent shooting. Clamp ends on withdrawal/KO, caster stun/disable or timeout. Rooted does not mean invulnerable.
- For RIVET K: use real engine contacts and real `takeDamage`, reject phantom victims, don't write HP directly. Push applies only after accepted hit and must not add a fake shot.
- If NEWBOT withdraws, J/K priority becomes T.O.T, then RIVET; if a body withdraws during its own windup or before impact, cancel effects and do not reset cooldowns or override Bot/Local keys. Both keyboard and Gold touch skill UI must route identically. Prove fast simultaneous withdrawals.
- Never present these provisional names as canon dialogue or change locked E07/E08 text. Disallow these skills outside E06, including RIVET HOSTILE E07 and T.O.T HOSTILE E08.

## Adversarial prototype preflight

`node tools/testQuestCompanionKitCandidateB6m.mjs` tests identity, withdrawal, owner acceptance, E06-only scope, targeting distance/cone, solo fallback, cooldown metadata, no pure module mutation and native hit-recheck requirement.

**IMPORTANT:** these preflight tests validate candidate *plans*, NOT cast execution, active damage/status or visual polish. Owner concept approval is required before wiring actual in-game J/K handlers or AI and producing a playable Gold acceptance run.
