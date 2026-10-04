# APEX CHAOS — Wave 2 Anti-Drift Contract

Status: authoritative for Wave 2 design/prototype work.

## 1. No implementation by imagination

The Markdown authority defines UX/product law, not exact final pixels.

Until a surface has an owner-accepted visual prototype:
- do not implement a production approximation;
- do not make a generic React/card UI and call it Gold;
- do not infer missing visual details from common game UI patterns;
- do not reuse the current legacy/meta UI merely because it is functional.

## 2. Same world, different machine

All surfaces inherit APEX CHAOS material and motion language, but each must preserve its own functional identity.

Forbidden convergence:
- every surface becomes a card dashboard;
- every surface gets a giant hero stage;
- every surface uses the Lucky Draw reveal language;
- every surface gets full-screen elemental VFX;
- every surface becomes a cinematic destination.

Intensity must follow task importance and reading needs.

## 3. Gold source precedence

When a future visual prototype is accepted:
1. accepted source owns visible composition and choreography;
2. production owns runtime/data truth;
3. bridge code is thin and idempotent;
4. implementation must preserve source rather than redraw it manually.

This is the same canonical-preserving principle used by Wave 1.

## 4. No mechanic invention

UI may explain or project gameplay but may not author:
- damage;
- cooldown;
- HP;
- movement modifiers;
- crit;
- freeze;
- disarm;
- weapon rules;
- winner;
- reward;
- fighter ownership;
- draw result.

Mechanical facts must be derived from canonical game/runtime authority where possible.

## 5. No economy invention

No surface may invent:
- prices;
- rewards;
- currencies;
- paid tiers;
- rarity;
- “best value” / “popular” / “recommended” merchandising.

UI binds product/economy authority.

## 6. No lore invention

Do not invent a commander, faction, employer, prison, laboratory ownership story, “pilot” role, or world terminology merely to justify a screen.

Diegetic presentation can imply industrial systems without asserting lore that Story has not locked.

## 7. Responsive is composition, not uniform scaling

Every accepted visual source needs intentional:
- desktop;
- mobile landscape;
- mobile portrait

behavior.

Minimum actionable touch targets: 44 px.

Safe-area insets must be respected.

Do not solve mobile by shrinking a desktop stage.

## 8. Motion law

Motion must communicate state or material behavior.

Prefer:
- rail travel;
- latch/plate motion;
- controlled aperture/reveal;
- scan/registration response;
- short physical settle.

Avoid generic:
- fade-only;
- random shake;
- endless glow pulses;
- hover float on every card;
- particle noise with no semantic role.

Reduced Motion must preserve meaning while reducing travel, parallax, overshoot, shake and nonessential continuous animation.

## 9. Performance law

Gold quality may not rely on expensive late mounting.

Prefer:
- persistent expensive layers;
- preloaded assets;
- transform/opacity;
- stable layout;
- change-only data writes.

Avoid:
- image decode at transaction/result impact;
- rebuilding large DOM at KO;
- whole-screen animated blur;
- remounting game canvas for overlays;
- effect settings that restart simulation.

## 10. Data boundary law

Presentation reads projections/controllers. It does not talk directly to:
- localStorage;
- auth provider SDK;
- database SDK;
- economy database;
- raw hero mechanic internals.

Required conceptual boundaries:
- PlayerProfileAuthority;
- UserSettingsAuthority;
- MusicController;
- EconomyAuthority/adapter when cloud economy exists;
- runtime projections for battle and hero knowledge.

## 11. Current Gold cannot be collateral damage

Wave 2 prototype work must not alter Wave 1 canonical Gold source just to make future surfaces convenient.

Cross-surface continuity must be designed around Wave 1, not by simplifying Wave 1.

## 12. Explicit non-authority

Prototype demo values are never production truth:
- names;
- balances;
- reward numbers;
- account emails;
- mission progress;
- mastery level;
- fighter unlock state.

Every prototype must label demo state clearly in source comments or manifest.
