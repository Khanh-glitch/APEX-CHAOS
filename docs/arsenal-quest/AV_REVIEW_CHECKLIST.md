# Arsenal Quest — VFX/SFX Integration Review Checklist

## Asset integrity
- [ ] Curated AV runtime assets exist under `public/assets/arsenal/av/`.
- [ ] `MANIFEST.csv` integrity/provenance is present and valid.
- [ ] P0 weapon atlas exists under `public/assets/arsenal/weapons/`.
- [ ] Duplicate original archives were not committed.
- [ ] Transparent muzzle flash is used for runtime rendering.
- [ ] Asset provenance / licenses remain documented.

## Architecture
- [ ] No engine fork.
- [ ] No second standalone canvas app.
- [ ] No broad UI redesign bundled into this task.
- [ ] Presentation code is isolated from core weapon logic.
- [ ] Images/audio preload once rather than per frame / per shot.
- [ ] Audio concurrency is bounded.
- [ ] VFX instances expire and clean up.

## Shared lifecycle
- [ ] Telegraph audio works.
- [ ] Telegraph does not reveal weapon identity.
- [ ] Telegraph/reveal do not use slash-family attack art.
- [ ] Reveal uses proximity prediction, not slot age.
- [ ] Reveal has distinct audio/visual cue.
- [ ] Pickup has distinct audio/visual cue.
- [ ] Multiple simultaneous pickups do not create unbearable audio spam.

## Guns
- [ ] Pistol feels light/quick.
- [ ] Shotgun feels heavier than Pistol.
- [ ] SMG burst is readable and audio-safe.
- [ ] Sniper charge/shot is distinct.
- [ ] Muzzle flash is positioned at the equipped weapon/barrel front, not fighter center.

## Grenade
- [ ] Grenade throw/fuse still works.
- [ ] Real explosion atlas animates correctly.
- [ ] Explosion SFX is synchronized with damage/explosion frame.
- [ ] No giant atlas/frame mis-slicing.

## Melee
- [ ] Sabre uses fast slash presentation.
- [ ] Axe uses slower/heavier presentation.
- [ ] Dagger uses compact/fast presentation.
- [ ] Spear uses thrust-like presentation.
- [ ] Club reads as blunt impact, not just another sword.
- [ ] Melee VFX matches actual attack origin/path/orientation and hit-only effects occur only on confirmed contact.

## Defense
- [ ] Swirl Shield activation reads clearly.
- [ ] Reflect event is unmistakable.
- [ ] Reflected projectile ownership remains correct.
- [ ] Tower Shield activation reads clearly.
- [ ] Tower Shield blocks have appropriate impact audio.

## Regression / QA
- [ ] `pnpm build` passes.
- [ ] `pnpm test:arsenal:headless` passes.
- [ ] Browser Arsenal acceptance passes.
- [ ] Five-minute simulation has no uncaught errors.
- [ ] Existing Apex modes still open.
- [ ] No runaway audio overlap.
- [ ] No obvious VFX leak.
- [ ] No gameplay expansion was smuggled into the pass.

## Evidence
- [ ] Telegraph
- [ ] Reveal
- [ ] Pistol
- [ ] Shotgun
- [ ] SMG
- [ ] Sniper
- [ ] Grenade
- [ ] Sabre
- [ ] Axe
- [ ] Dagger
- [ ] Spear
- [ ] Club
- [ ] Swirl Shield reflect
- [ ] Tower Shield block
- [ ] Multiple simultaneous pickups
- [ ] AV integration report with exact asset bindings
