# CP4 Phase A/B — Audit & Design (baseline 15488b0)

Status: implementation design record. No merge, deploy, or OWNER ACCEPTED claim.

## 1. Wall-contact circles (Task 1)
Proven sources:
- Generic arena-wall resolution spawns no shockwave. Product shockwaves are weapon/spawn events only.
- NEWBOT default: `robotPresentationRuntime` wall path spawns a radial filled flash and four expanding grey dust circles. Dust particles exist only for wall contact.
- ECOBOT: `ecoNewbotV17WorldGold.wallImpact` spawns 16 radial-gradient ellipses plus a vertical radial scuff ellipse regardless of wall orientation.
- Frost wall output is springs/chips/shards (material feedback) and is retained.

Design: wall feedback becomes material streaks/sparks/chips aligned to motion/wall; remove only filled radial flash + expanding dust discs (NEWBOT) and radial puff/scuff ellipses (ECOBOT). Physics, bounce, sound, springs, silhouette unchanged.

## 2. Result art (Task 2)
Proven defects:
- `goldProductBridge` loads Result from origin-root `/result-gold/index.html`; the itch packer never rewrites `result-gold/`, so nested hosting 404s and the bridge returns Home after 9s.
- Result `<img>` elements have no error fallback; a broken URL renders an empty stage.
- Snapshot carries no skin identity, so ECOBOT / VUA HE cannot be shown accurately.

Design: resolve Result through the existing app-root authority (entry-base global), add `result-gold/` to the itch rewrite set, give Result art an honest on-error placeholder state, and seal side skin IDs + registered skin previews into the snapshot. All 41 weapons already have art files; the seal now also uses the display-name authority.

## 3. Weapon names (Task 3)
`arsenalConfig` becomes the one display-name authority (`WEAPON_DISPLAY_NAMES` + `weaponDisplayName`). IDs/save keys/assets unchanged. HUD, Gold bridge projection, Result seal, Locker, Field Archive and Mastery records consume it. SHOTGUN displays “SPAS-12”; PISTOL “colt”; SMG “MP5”; SNIPER “Snipex Alligator”.

## 4/5. Side intro + pausing tutorial (Tasks 4–5)
- Side intro: brief role ribbon inside the existing P1/P2 HUD identity rows (“YOU · PLAYER 1” vs “BOT · PLAYER 2”, or PLAYER 1/PLAYER 2 in LOCAL), one-time per mode, reset by coach replay. No arena markers.
- Pause: coach publishes a heartbeat pause lease; hero-rework step wrappers (both rAF `update` and headless `AQ.step`) return before pre-tick/simulation/post-tick while the lease is fresh, BOT-only. Correct J/K/touch is captured, releases the lease first, then calls the canonical pressAbility/pressSkill executor once. Opportunity predicates are per hero/skill from observable positions, velocities, projectiles, pickups, held weapons and HP — never cooldown-zero alone. SKIP, stale-lease auto-resume, battle-end and replay paths prevent softlocks.

## 6/7. Achievements + rarity (Tasks 6–7)
Presentation-only owner fields (`ownerSide`, `ownerKind`, `walletEligible`) are added by the meta runtime; wallet law untouched. Side-aware dedupe/queue priority (human before BOT feedback), side-shifted placement, BOT “not recorded” copy, rarity-shaped medals (circle/octagon/shield/starburst + 1–4 pips) shared by toast and Mastery Vault. Locked = hatch, progress = dashed frame + meter, earned = solid frame; grayscale-readable.

## 8. Localization (Task 8)
Weapon display names are canonical proper names in both languages. New coach/toast copy ships ENG/VIE pairs in-component (existing pattern); classic/HUD strings go through the locale catalog. CP4 gate checks proper-name coverage and ENG/VIE pair parity for new copy.

## 9. SFX (Task 9)
No new audio. `uiSfxAuthority` gains semantic aliases over the licensed 18-key bank with per-alias gain/rate/throttle (tutorial pause/resume, achievement rarities, BOT feedback, result win/loss, locked/error). One cached element per canonical file remains the law.

## 10. BOT AI (Task 10, decision-only)
- Scheduler: one successful cast per tick + short re-plan delay for the other slot; MIRROR gets a shorter scheduler delay (canonical cast startup untouched).
- MAGNET A2: floor-weapon repel only for observable denial geometry (weapon pushed away from the rival / contested race), never pushing a needed weapon toward the rival.
- CRYSTALA Wall: cast only when a hostile projectile will cross the actual wall segment after material grows and before it expires. Existing headless fixture placed the projectile already behind the wall line; fixture corrected to a blockable threat and a past-the-wall negative is covered by the CP4 gate.
- HUNTER A2: intercept value includes a revealed pickup lying on the dash intercept corridor while unarmed (legitimate dash→pickup→burst setup; no free weapon).
- FROST: sequencing comes from the one-cast-per-tick scheduler guard.
- BOXE A1: predicted rocket intercept (relative-motion solve) instead of distance-only. A2: incoming-projectile/closing threat instead of distance-only.
- SHURI A1: enemy must be predicted to cross the armed bomb radius. A2 repair: only for meaningful missing structure HP.
- NEWBOT: unchanged baseline (already threat/pickup-driven); regression only.

All predicates read observable state only (positions, measured velocities, live projectiles, revealed slots, held weapons, HP). No stat, cooldown, damage, resource, or collision changes.
