# CP8 — Gold skin source/fidelity checkpoint (NOT integrated)
Base: PR #62 exact HEAD `b68a059ff2271ace6b27ddf070c23dd6ebb70d7e`
Owner files: `APEX_CHAOS_Rocket_Vua_He_GOLD_ExplosionCenter_AimRotate_Test.html` and `ECO_NEWBOT_RECYCLE_CORE_V17.html`.

## Audited facts
- Both HTML inline JavaScript sections pass `node --check`.
- Rocket final FACE mode calls V7 smoke + full-frame face; no sliced/masked partial facial asset is used in this final render path.
- Final Rocket set extracted byte-identically and locally SHA256 audited: launcher (1656x381), projectile (1039x186), 10 x 256x256 V7 textures, 10 x 256x256 V7 soft textures, full-face (440x440). 23 files, 2,723,303 source bytes; do not import the full ~16MB studio as runtime.
- Approved Gold values in source: 98px rocket reference, smokeLife .68s, blast .80s, V7 smoke window 1.38s, face opacity .42, size 0→.74, grow .16→.91s.
- ECO NEWBOT V17 contains stateful 240Hz spring rig, source segmentation, mechanical motion, and test-only A1/A2/hit/wall/fire simulation. It is NOT a drop-in frame-only render callback.
- Existing CP7 hook call sites: `cosmeticAuthority.js` supplies frozen poses and pre-decoded asset access; `arsenalPresentationRuntime.js` draws equipped skin; `arsenalWeaponRuntime.js` draws traveling projectile and `v43GoldImpact()`; `robotPresentationRuntime.js` dispatches actor cosmetics.

## Integration invariants (blocking)
1. Only weapon/fighter cosmetic render. Absolutely no additions or changes to damage, collision, weapon spawn/pickup, cooldown, A1/A2 activation, inventory, AI.
2. Preserve original 23 Rocket textures, all current V7 formulas and face keyframes. Actor state and projectile flight/impact coordinates must come from engine, not lab demos or independent simulation.
3. Adapt only global scale/coordinate-space transformation. No additional glow, overlays, recolor, smearing, modified gun pivot, displaced explosion center, duplicate beginning projectile or separate trajectory rotation.
4. ECO requires mapping battle-owned A1/A2/passive events, position/velocity, held gun and damage/wall reactions to V17 mechanical transitions; retain Gold mechanical rig/spring constants, draw stacking and timings; its dummy projectiles and lab-only gameplay must never run in production.
5. Preload/decode before battle READY; fail-closed to original; preserve per-side receipts and reflected rocket identity.
6. Browser evidence: desktop + mobile cold load, preview fidelity at A1/A2/idle/hit/hold/fire, P1/P2 mixed appearances, multi-Rocket transfer, no double blast, no gameplay number differences. Compare screenshot frames to Gold at matched timestamps and coordinate transforms.

## Status
**SOURCE AUDIT PASS (scoped); GAMEPLAY/CHROME VISUAL INTEGRATION UNVERIFIED.**
No approved skin pack was registered or shipped by this checkpoint. No merge into main. Do NOT claim CP8 complete until integration passes all required browser gates and owner visual review.