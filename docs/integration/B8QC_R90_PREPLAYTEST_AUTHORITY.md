# B8qc pre-playtest authority — R90 / B0.5 / Quest

Last checked: 2026-10-10. This is a QA-only branch, not a production design branch.

## Source authority

1. **Current authored Gold after R90+B0.5 integration** is the visual/layout baseline. The current Quest HUD explicitly layers its Quest-only B3 profile *after R90*; Free Battle Gold must not be overwritten.
2. Later **owner-approved R70 decisions** supersede older R62 tablet dock (id/id/id + s1/wp/s2), R63 glow, and R65 animated/masked artwork treatment. The accepted skill art has no progress ring or sweep; runtime cooldown state and text remain authoritative.
3. The historical `docs/integration/R90_GOLD_GATE_DEBT.md` reports issues found against an earlier R89 snapshot. Read alongside the subsequent R70-modified `tools/testGoldBattleHudAdaptationGate.mjs`, not as an instruction to reinstate deleted design.
4. The real product `public/gold/battle-hud.html` and `public/gold/shell.html` are identical to B8qb on PR #21, not modified by B8qc. No Quest damage, art, dimensions, player HP, or combat runtime changed here.

## What CI proves and what it cannot

- Run `node tools/testR89GoldResolver.mjs`, `node tools/testGoldPickBandLawGate.mjs`, `node tools/testGoldBattleHudAdaptationGate.mjs` and `node tools/testB8CanonicalGoldParity.mjs` to preserve the integrated R90/R70 law.
- Product Chrome gate samples current Gold tablet BOT layout, actual hit targets, loaded skill images, cooldown states, and Door lifecycle, under its own physical pointer path. The gate labels are **R90-current-Gold**. They no longer claim to deliver the rejected R62 square dock.
- Quest independent CI must remain native + Chrome desktop + Chrome mobile **3/3 SUCCESS on the same SHA**, including native Stormbreaker and OUTSIDE. At `ae708f78` this was run 37981031440, 3/3 success.
- Full Arsenal Product Acceptance and six-hero cold-load remain independently required. A job running at the Core Six step is **not** a PASS; failures must retain evidence and not be whitelisted.
- Pixel aesthetics, skill readability under real sunlight, tablet ergonomics, SFX timing and perceived combat feel are **owner visual/playtest** acceptance, not proven by static or geometric gates.

## Merge boundary

Draft PR #21 targets the B8qb Quest acceptance branch and changes QA scripts and a Quest workflow only. Do not merge/deploy into `main` or overwrite current R90 from this branch. Obtain one complete green independent Quest run and Product Acceptance run at the latest commit. Keep source provenance and UI owner approval explicit.
