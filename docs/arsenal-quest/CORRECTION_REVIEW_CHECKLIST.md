# Arsenal Quest — Correction Pass Review Checklist

## Branch / baseline
- [ ] Working from latest `prototype/arsenal-quest`
- [ ] Existing AV pass preserved unless explicitly corrected
- [ ] Weapon atlas exists under `public/assets/arsenal/weapons/`

## Real weapon art
- [ ] Pistol floor sprite
- [ ] Shotgun floor sprite
- [ ] SMG floor sprite
- [ ] Sniper floor sprite
- [ ] Grenade floor sprite
- [ ] Sabre floor sprite
- [ ] Battle Axe floor sprite
- [ ] Dagger floor sprite
- [ ] Spear floor sprite
- [ ] Spiked Club floor sprite
- [ ] Swirl Shield floor sprite
- [ ] Tower Shield floor sprite
- [ ] Equipped gun visible
- [ ] Equipped melee visible
- [ ] Equipped shield visible
- [ ] Placeholder 3-letter circles not used as normal revealed pickups

## Proximity reveal
- [ ] Spawn cadence still timer-driven and independent
- [ ] Slot may stay hidden >5s
- [ ] Reveal is not based on slot age
- [ ] Per-slot revealLeadSeconds is 1.2–1.8s
- [ ] Predictor uses current Apex movement trajectory
- [ ] Wall bounces are represented in prediction
- [ ] Armed/ineligible fighter does not trigger reveal
- [ ] Weapon identity remains null before reveal
- [ ] Slot is non-collectable before reveal
- [ ] Debug exposes predicted ETA
- [ ] REVEAL log includes eta + lead + predicted fighter

## VFX semantics
- [ ] No slash VFX on pickup telegraph
- [ ] No slash VFX on weapon reveal
- [ ] Sabre arc is attack-aligned and forward-offset
- [ ] Axe arc matches heavy chop geometry
- [ ] Dagger visual follows dash/stab
- [ ] Spear visual follows thrust axis
- [ ] Club reads as blunt impact
- [ ] Hit-only effect occurs only after confirmed contact
- [ ] Muzzle flash is at barrel/front, not fighter center
- [ ] Reflect VFX is at projectile contact and follows new direction
- [ ] Tower block VFX follows current impact side

## Regression
- [ ] Core 12 weapon behavior unchanged
- [ ] Build passes
- [ ] Headless suite passes
- [ ] Browser acceptance passes
- [ ] Five-minute sim has no uncaught errors
- [ ] Existing Apex modes still launch
- [ ] No weapon-seeking AI added
- [ ] No progression/meta/UI expansion added

## Evidence
- [ ] Hidden telegraph far from fighters
- [ ] Same slot reveals on predicted approach
- [ ] Real floor gun/melee/shield
- [ ] Real equipped gun/melee/shield
- [ ] Corrected melee effect set
- [ ] Muzzle position
- [ ] Shield reflect position
- [ ] Multiple simultaneous slots
