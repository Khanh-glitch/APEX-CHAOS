# CP4 — Content Admission Gate / Agent delivery route

**Purpose:** let an AI unfamiliar with APEX CHAOS add content via known extension seams, and fail PRs that silently change old combat or introduce unsupported content. This is a CI **admission** gate, NOT another gameplay registry.

## What is live and what is a ledger?

1. Runtime truth still lives in `heroRegistry.js`, `heroMechanicsRuntime.js::EXECUTORS`, `arsenalConfig.js`, `arsenalWeaponRuntime.js`, `AIL.CapabilityAuthority` and `productSurface.js`.
2. `extensions.json` is a **review ledger for NEW IDs ONLY**. It is empty at the frozen 12-hero / 41-weapon baseline. NEVER duplicate accepted old weapon/hero definitions inside it.
3. `testContentAdmissionGate.mjs` compares the **actual** IDs from runtime to the baseline set; a new ID without a matching ledger entry fails. Removing an old ID also fails.
4. It checks actual executor registration (skills and gun families), mandatory capability decisions, shipped art file paths, runnable test files, damage authority and tier-dependent Quest exposure. It EXECUTES newly declared tests, not just checks their filenames.
5. Unknown interactions must be `requires-review` in the ledger until owner-approved. A changed rule in existing Crystal/Magnet/Frost/Mirror still needs explicit parity and collision tests; this validator alone does not certify a new mechanic.

## Admission object schemas

The starter ledger lives at `docs/architecture/content-admission/extensions.json`.

For a new **conventional gun** record:

`{
  "id": "EXAMPLE_NEW_GUN",
  "releaseStage": "development",
  "executorType": "gun-family",
  "damageAuthority": "aqDamage",
  "questExposure": "inherited-auto",
  "interactions": {
    "reflect": "allowed", "magnet": "allowed", "mirror": "allowed",
    "freeze": "allowed", "capture": "requires-review", "T6": "not-applicable"
  },
  "assets": ["public/assets/arsenal/new/example.webp"],
  "tests": ["tools/testExampleNewGun.mjs"]
}`

`questExposure` must be `inherited-auto` for a T1/T2 item under the current pool policy. Higher tiers require `not-auto`. A new special weapon must use `executorType: "v43-special"`, declare both `reflectableKinds` and `magnetizableKinds` (including empty arrays) **inside canonical Arsenal config**, then prove true gameplay via its test. An existing V43 kind tag alone does not prove a new ballistic/weapon executor exists.

For a new **hero** record:

`{
  "id": "EXAMPLE_NEW_HERO",
  "releaseStage": "development",
  "projectileFamilies": ["aq_bullet"],
  "interactions": {
    "reflect": "denied", "magnet": "requires-review", "mirror": "requires-review",
    "freeze": "not-applicable", "capture": "not-applicable", "T6": "denied"
  },
  "localizationKeys": ["hero.example.description"],
  "assets": ["public/assets/heroes/example/portrait.webp"],
  "tests": ["tools/testExampleNewHero.mjs"]
}`

Hero ID must really exist in `heroRegistry` with PASSIVE/A1/A2 `mechanicId` entries that resolve to actual `EXECUTORS`. New heroes must remain non-playable in `productSurface` until explicitly approved; `releaseStage: "approved"` requires an owner review document in `docs/`.

## Automatic adversarial tests

The CP4 gate includes synthetic corrupted registries proving that it *rejects*:
- undeclared NEW_GUN or NEW_HERO,
- a weapon with a noncanonical damage route,
- a T2 weapon falsely declared outside automatic Quest exposure,
- a content extension without an executable test.

These synthetic registries exist only inside the Node gate. They NEVER mutate production configs.

## Out of scope / remaining blockers

- The current `heroRegistry.validateRegistry()` expects EXACTLY 12/36 and its smoke scripts share that freeze. **A 13th hero cannot be admitted today.** Before adding one, migrate assertions to “baseline subset stays identical + extension validation”, without weakening the Core Six tests.
- No generic bespoke-weapon executor registration yet exists for arbitrary new special physics. A special needs a dedicated *approved* extension point, not another independent projectile loop.
- This is a gate, not a certificate of new combat behavior. Each new custom mechanic must include headless real-physics tests, per-hero/per-weapon interaction cases, ownership/damage receipt and teardown, plus device/browser presentation.
- CP3 is still SHADOW; don't reroute production combat or enable Mirror F2 V43 without separate evidence/approval.
