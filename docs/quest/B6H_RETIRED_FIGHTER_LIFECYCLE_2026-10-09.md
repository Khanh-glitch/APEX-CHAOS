# B6h — Withdrawn Fighter lifecycle protection

B6g's physical projectile fix excludes withdrawn allies at the shot/hit
authority. B6h closes the opposite edge: a withdrawn but 100-HP ally must
NOT continue ticking its weapon holder, firing, reloading, consuming ammo or
receiving Stormbreaker floor-hazard stun in the background.

This is a Quest-only branch guard in the existing Arsenal scheduler, not a
new Fighter type. Preserve same object, HP, original weapon and cooldown
through the wave interlude. Free Battle holder scheduling remains unchanged.

E06 is still a localhost fixture; Gold start, story acknowledgment, signed
checkpoint, rig handoff and approved T.O.T/RIVET kits are not claimed done.
