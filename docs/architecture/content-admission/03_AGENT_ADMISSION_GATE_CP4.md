# CP4 — Content Admission Gate / Agent delivery route

**Purpose:** let an AI unfamiliar with APEX CHAOS add content via known extension seams, and fail PRs that silently change old combat or introduce unsupported content. This is a CI **admission** gate, NOT another gameplay registry.

## What is live and what is a ledger?

1. Runtime truth still lives in `heroRegistry.js`, `heroMechanicsRuntime.js::EXECUTORS`, `arsenalConfig.js`, `arsenalWeaponRuntime.js`, `AIL.CapabilityAuthority` and `productSurface.js`.
2. `extensions.json` is a **review ledger for NEW IDs ONLY**. It is empty at the frozen 12-hero / 41-weapon baseline. NEVER duplicate accepted old weapon/hero definitions inside it.
3. `testContentAdmissionGate.mjs` compares **actual** IDs against the immutable original-ID subset in `tools/lib/contentBaseline.mjs`; extensions are permitted without weakening checks for original IDs. It also rejects new gun/V43 definitions that never enter the actual P0 spawn pool.
4. It checks actual executor registration, mandatory capability decisions, shipped assets, executable real-harness proof scripts (combat, interactions, teardown), **actual EN/VIE text in `src/game/localeCatalog.js`**, damage-authority declarations and real `BY_TIER` Quest membership. Declared scripts are executed. Their self-reported correctness cannot be universally established by CI without scenario-specific assertions.
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
  "tests": ["tools/testExampleNewGun.mjs"],
  "proofTests": {"combat": "tools/testExampleNewGun.mjs", "interactions": "tools/testExampleNewGun.mjs", "teardown": "tools/testExampleNewGun.mjs"},
  "localizedCopy": [{"en": "Example weapon", "vi": "Vũ khí ví dụ"}]
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
  "localizedCopy": [{"en": "Example hero ability", "vi": "Kỹ năng tướng ví dụ"}],
  "assets": ["public/assets/heroes/example/portrait.webp"],
  "tests": ["tools/testExampleNewHero.mjs"],
  "proofTests": {"combat": "tools/testExampleNewHero.mjs", "interactions": "tools/testExampleNewHero.mjs", "teardown": "tools/testExampleNewHero.mjs"}
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

- CP2 now protects the baseline **as a subset**, but production `heroRegistry.validateRegistry()` and existing smoke scripts still expect exactly 12/36. **A 13th hero is intentionally blocked pending the controlled CP5 runtime revision.** Do not suppress these production gates or loosen Core Six tests.
- No generic bespoke-weapon executor registration yet exists for arbitrary new special physics. A special needs a dedicated *approved* extension point, not another independent projectile loop.
- This is a gate, not a certificate of new combat behavior. Each new custom mechanic must include headless real-physics tests, per-hero/per-weapon interaction cases, ownership/damage receipt and teardown, plus device/browser presentation.
- CP3 is still SHADOW; don't reroute production combat or enable Mirror F2 V43 without separate evidence/approval.

## Acceptance limits and tested regression boundary (CP4 hardening)

- The 12 original heroes, 24 original gun IDs, eight V43 special IDs, and 41 original equipment IDs are frozen as **required subsets**. Extensions may grow totals; original definitions and existing game behavior remain protected by their dedicated regressions.
- For every new hero/weapon, `proofTests.combat`, `proofTests.interactions`, and `proofTests.teardown` must reference executable tests listed in `tests`; source must boot the actual Arsenal headless harness and the test runner executes each file. Tests must assert their own meaningful real outcomes, including damage receipts/ownership and lifecycle. CI cannot mathematically prove an arbitrary test is adequate just from a name.
- `localizedCopy: [{en,vi}]` must be actual source-copy entries present in `src/game/localeCatalog.js` and pass `translateCopy(en,'vie')`. Declaring arbitrary keys is insufficient. EN+VIE layout must still be checked in browser before release.
- New conventional and V43 special registrations absent from the actual `P0_WEAPON_IDS` pool fail. New T1/T2 weapons must also really appear in `BY_TIER`, as this already feeds Quest.
- Adding a new hero still requires CP5 to revise the locked production registry validation and runtime URL/checksum, as well as the extra product/presentation checks.

These safeguards help Agent integration but do **not** certify a new custom special executor, full collision ordering, or browser layout by themselves.
