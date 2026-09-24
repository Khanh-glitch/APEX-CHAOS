# POST-C owner revision — implementation evidence

**Branch:** `arena/01a0cf5e-apex-chaos`  
**Authority:** `docs/arsenal-quest/POST_C_OWNER_FEEDBACK_REVISION_CONTRACT.md`  
**Headless:** `node tools/testArsenalQuestHeadless.mjs` → **111/111**

## Shipped together

1. **VFX transparency** — Kenney smoke/spark production derivatives under `public/assets/arsenal/av/vfx/c/` are black-matte keyed to alpha (`tools/buildArsenalCAssets.mjs` `keyMatteToAlpha`). Source staging untouched. Runtime draws `vfx/c/` only. Corner-band opaque pixels on `smoke_01` = 0%.
2. **Spawn cadence 3.0s** — `SPAWN_CADENCE_SECONDS: 3.0`; gates renamed `spawn-cadence-3.0s`.
3. **24 Senko v9 guns** — data-driven `GUN_REGISTRY` (24 ids). Compat: PISTOL/colt, SMG/MP5, SHOTGUN/SPAS 12, SNIPER/Snipex Alligator. Shared family executors SEMI/AUTO/BURST/SHOTGUN/AUTOSHOT/PRECISION. `Zbroyar Z-15 skin3.svg` is a 0-byte staging file; production raster falls back to Z-15 + graphite remap.
4. **Weighted melee 0.5** — `selectSpawnWeapon` + injectable RNG. Gate `postc-melee-weight-0.5`.
5. **Melee pickup decision** — in-range iconic strike; out-of-range thrown sprite, swept collision, ~1s pin, bounce caps axe/club 1, spear 2, sabre 3, dagger 4. Damage `CFG.meleeDamage` = C × 1.5. No `setDir` from throw.
6. **P1 J gate** — `arsenalManualSkillGate.js`. Cooldown-only skills listed in `GATED_SKILLS`; event skills untouched. P2 auto.
7. **NEWBIE** — 33rd Arsenal shell, 10s dash to nearest REVEALED pickup; fail does not consume CD.
8. **No arena glyphs** — Chamber title / Z-01..04 / `?` removed; canvas `fillText`/`strokeText` muted during battlefield `draw`. HUD/F3 kept.

## Commands

- `node tools/buildArsenalCAssets.mjs`
- `node tools/testArsenalQuestHeadless.mjs` → 111/111
- `npx vite build` → ok
