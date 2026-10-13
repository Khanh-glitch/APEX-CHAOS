# Cross-system interaction CI admission — checkpoint 2026-10-13

**Goal:** prevent a future Weapon/Hero or V4.3 update from passing Product Acceptance while silently skipping World Weapon, Frost/Magnet, Wall/Hexa or Native Stream specialist gates.

The source of truth is the **actual engine runtime**, not Gold VFX re-authoring. This checkpoint only expands specialist workflow path admission and adds one standard-library audit to Product Acceptance.

## Compatibility routes
- World Weapon owner suite rechecks when canonical equipment definitions, role/magnetic traits, floor spawn/pickup, Arsenal firing code, AIL projectile policy, Magnet/Frost or their own kinetic tests change.
- Crystala shared breaking-hit suite rechecks when canonical equipment/roles, Arsenal firing, AIL or Crystala actor law changes.
- Native Stream suite rechecks when weapon definitions/roles, pickup, firing carrier implementation, AIL or Crystala changes.
- Content Interaction retains broad `arsenal/**` and `hero-rework/**` coverage.
- Product Acceptance remains unfiltered for ALL pull requests and uses `tools/testCrossSystemWorkflowAdmission.mjs` to detect future workflow trigger drift.

**Explicit limits:** This proves CI admission, not visual perfection. Does not change `main`, combat values, recoil, V4.3 particles, Gold look or hero skills. An external fork can choose to skip CI; this guard pertains to repository GitHub Actions.

Do not equate V43 Gold Fidelity 0/40 *reference evidence* with 40 broken effects; owner-approved existing V4.3 visual behavior remains frozen pending specific visual reproduction and approval.

## Future maintenance
When adding a weapon/equipment ID or new cross-hero effect, review all three specialist workflows as part of the same PR, and expand this audit's `RULES` only when the risk map genuinely changes. A new visual-only weapon motion system, if eventually owner-approved, must reuse existing holder/pose clock rather than create another combat executor.
