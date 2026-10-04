APEX CHAOS — GOLD PRODUCT UI/UX/HUD CUTOVER
DIRECT REPOSITORY IMPLEMENTATION — NO VISUAL DRIFT

You are implementing the owner-approved Gold product surfaces into the REAL APEX CHAOS repository.

Repository: Khanh-glitch/APEX-CHAOS
Branch: arena/01a1025a-apex-chaos
Required starting checkpoint: 5dc8c8c80f3804a5c363e4af0ab34c726e86e73b
Runtime at that checkpoint: 20261003-mirror-v1-r42

THIS IS NOT A REDESIGN TASK.
THIS IS NOT A “RECREATE THE LOOK” TASK.
THIS IS A PRODUCTION CUTOVER FROM GOLD PRESENTATION AUTHORITY TO EXISTING GAME STATE AUTHORITY.

Before editing anything:
1. Verify exact branch and HEAD. If HEAD advanced, audit the delta and preserve all newer accepted work; do not blindly reset.
2. Read the Gold source-pack authority in full, especially:
   - README_GOLD_AUTHORITY.md
   - manifests/ANTI_DRIFT_CONTRACT.md
   - manifests/IMPLEMENTATION_PRELOAD.md
   - manifests/placeholder-contract.json
   - manifests/asset-manifest.json
   - manifests/dependency-audit.json
   - index.html
   - donors/lucky-draw/index.html
   - donors/battle-hud/index.html
3. Audit current production authority before changing it:
   - src/App.jsx
   - src/styles.css
   - src/game/runtimeManifest.js
   - src/game/productSurface.js
   - public/game/ui/apexPickRuntime.js
   - public/game/ui/apexCombatHudRuntime.js
   - public/game/modes/arsenalBattleRuntime.js
   - public/game/core/apexArsenalProductRenderHudRuntime.js
   - public/game/hero-rework/heroReworkRuntime.js
   - source/runtime/shipping/browser/headless gates.

======================================================================
A. ABSOLUTE GOLD AUTHORITY LAW
======================================================================

The Gold source is authoritative for presentation meaning and perceived behavior.
Do not approximate, simplify, restyle, normalize, “clean up,” or reinterpret it.

Preserve:
- composition,
- spacing hierarchy,
- silhouette,
- framing,
- z-order,
- responsive layout families,
- state emphasis,
- interaction affordances,
- P1/P2 semantic color ownership,
- all motion choreography,
- exact phase relationships,
- easing relationships,
- recoil direction,
- overshoot,
- settle,
- shake hierarchy,
- flash hierarchy,
- fracture/crack behavior,
- thunder/impact/KO emphasis,
- hit vs crit vs heal visual distinction,
- fighter-lock behavior,
- Lucky Draw motion/FX sequence,
- battle-entry transition behavior,
- reduced-motion behavior where authored,
- all UI/UX “implications”: what appears selectable, locked, ready, dangerous, damaged, victorious, unavailable, owned by P1, or owned by P2.

Do not translate those implications into generic UI patterns.
Port the authored system.

======================================================================
B. ONLY FOUR PLACEHOLDER CATEGORIES MAY CHANGE
======================================================================

Only these ART CONTENT slots are temporary:
1. Lucky Draw fighter visual art.
2. Fighter Pick cover/card art.
3. Fighter Pick large pose/stage art.
4. Battle fighter avatar/portrait and passive/A1/A2 skill icons.

Everything around those slots is Gold authority.

When replacing a placeholder, preserve the slot’s:
- geometry,
- aspect ratio,
- crop/focus rule,
- scale behavior,
- mask,
- frame,
- chamfer,
- glow,
- color propagation,
- hover/press/lock/cast/cooldown motion,
- responsive behavior,
- transition timing,
- state hierarchy.

Mirror special law:
If production retains Mirror’s large Pick presentation as an opponent-derived transparent identity, do not invent a mandatory fixed large pose asset for Mirror.

Do not hard-lock architecture to the current six heroes. The current first-six scope is content scope, not roster architecture.

======================================================================
C. PRODUCT SURFACES FOR THIS CUTOVER
======================================================================

Implement/open now:
- current Gold Home/navigation shell represented by the source,
- Lucky Draw / Gacha,
- fighter selection for local/BOT battle,
- Battle HUD,
- battle-entry transition,
- current result/return flow represented by Gold/runtime.

Temporarily unavailable:
- Quest,
- Shop.

Quest and Shop must remain LIGHTLY LOCKED extension points:
- visible/dimmed enough to communicate future availability,
- clear lock state,
- no dead navigation ambiguity,
- no implementation pretending a final Quest/Shop UI exists,
- no deletion of future routes/state concepts,
- no architecture that makes later unlock difficult.

======================================================================
D. PRODUCTION STATE AUTHORITY — DO NOT MOVE GAMEPLAY INTO UI
======================================================================

r42 deliberately consolidated HUD state authority before this cutover.
Use it.

Current seams include:
- APEX_COMBAT_HUD.projection()
- APEX_COMBAT_HUD.syncVitals()
- APEX_ARSENAL.hudProjectionFor()
- APEX_ARSENAL.resultProjection()
- existing hero-rework/runtime truth

Gold is the renderer/presentation authority.
Production is the state/mechanic authority.

Never calculate or redefine in Gold renderer:
- damage,
- crit,
- healing rules,
- HP truth,
- cooldown truth,
- weapon ownership,
- hero mechanics,
- match winner,
- Arsenal combat constants,
- P1/P2/BOT gameplay behavior.

Do not resurrect retired DOM-to-DOM seams such as aq-skill-hud or direct HP writers outside the current HUD authority.

======================================================================
E. SIDE COLOR IS SEMANTIC, NOT DECORATION
======================================================================

P1/P2 colors must be data-driven tokens propagated through Gold where authored:
- HP rails,
- side frames,
- accents,
- glows,
- skill state,
- transition rails/plates,
- impact feedback,
- KO/winner emphasis.

Preserve the Gold relationship between neutral system colors and side-ownership colors.
Do not hard-code a palette that only fits the demo hero pair.

======================================================================
F. MOTION / EFFECT PORT RULE
======================================================================

For every authored effect, establish a trigger map before changing code:
TRIGGER → STATE SOURCE → TARGET LAYER → SIDE → PHASE ORDER → DURATION → EASING → INTENSITY → SETTLE → RESPONSIVE VARIANT → UX MEANING.

This is mandatory for at least:
- Home interaction motion,
- Lucky Draw open/idle/spin/result,
- Fighter Pick enter/select/lock/BOT target/sparks,
- battle-entry seal/rails/handoff,
- skill ready/press/cast/cooldown,
- normal hit,
- critical hit,
- heal,
- HP loss trail,
- side recoil,
- screen flash,
- screen fracture/crack/shatter,
- kill/KO,
- result emphasis.

Do not replace these with a generic animation library preset.

======================================================================
G. PERFORMANCE — PRESERVE FEEL, REMOVE INTEGRATION HITCH
======================================================================

Known owner observation: standalone Battle HUD is smooth; integrated kill/screen-crack previously showed hitch/jitter.

Therefore:
- arena canvas geometry must not be reflowed by side-HUD impact effects,
- prefer transform/opacity/clip-path for presentation motion,
- preload Gold assets before authored reveal,
- keep persistent expensive FX layers where useful and toggle state rather than recreate them per hit,
- do not synchronously decode large images on kill,
- do not rebuild large DOM trees on hit/crit/KO,
- profile/observe kill + crack specifically,
- preserve authored impact strength while removing implementation hitch.

Optimization is allowed only if perceived Gold behavior does not drift.

======================================================================
H. EXTERNAL DEPENDENCY CLOSURE
======================================================================

The Lucky Draw donor source currently references:
- Tailwind browser CDN,
- Google Fonts (Oswald, Teko, JetBrains Mono).

Production Windows/offline shipping may not depend on live network.
Materialize/compile equivalent local dependencies.
Compare typography metrics, computed layout and visual behavior against Gold before removing CDN usage.
Do not silently substitute fonts/styles and call it equivalent.

======================================================================
I. ASSET POLICY
======================================================================

Gold assets marked retained are authoritative. Do not replace them with pre-existing repo art merely because it is “close.”

Placeholder art may stay lightweight until owner supplies final assets. Design the production asset contract so later replacement is path/data-only, not a UI rewrite.

Recommended stable slots per hero:
- luckyDrawVisual
- pickCover
- pickPose
- battleAvatar
- passiveIcon
- a1Icon
- a2Icon

Keep Mirror’s special Pick pose behavior extensible.

======================================================================
J. IMPLEMENTATION METHOD
======================================================================

Do not return a plan and stop.
Audit, implement, test, and commit in controlled slices.

Suggested cutover order:
1. Gold source/preload + asset contract wiring.
2. Product-shell navigation and lightly locked Quest/Shop.
3. Lucky Draw Gold renderer wired to real roster/ownership/draw state.
4. Fighter Pick Gold renderer wired to current pick authority; do not restore the retired generic picker.
5. Battle HUD Gold renderer wired to r42 projections.
6. Battle-entry transition wired presentation-only.
7. Result/return flow.
8. Responsive + reduced-motion closure.
9. Performance closure for kill/crack.
10. Production/shipping/browser acceptance.

Prefer renderer swaps/adapters over mechanic edits.
Keep commits reviewable and record exact SHA after each accepted slice.

======================================================================
K. REQUIRED GATES / PROOF
======================================================================

Before final handoff, prove:
- source hygiene,
- runtime revision gate,
- production product graph,
- current renderer/HUD contract,
- hero rework smoke/regression gates,
- Arsenal headless acceptance,
- real browser acceptance,
- production build,
- pruned shipping bundle,
- Windows/offline launcher/build gates where present.

Visual/browser proof must include:
- Home desktop + responsive,
- Lucky Draw idle/spin/result,
- Fighter Pick P1/P2/BOT + locked state + responsive,
- Battle desktop + mobile layout families,
- P1 and P2 dynamic color ownership,
- A1/A2 ready/cooldown/cast,
- normal damage,
- critical damage,
- heal,
- kill/KO,
- screen crack/fracture,
- battle-entry transition,
- Result,
- Quest/Shop lightly locked.

Do not claim browser PASS without browser evidence.
Do not claim zero regression without the relevant gates.

======================================================================
L. REVISION / COMMIT LAW
======================================================================

Any production runtime/source change covered by runtime revision authority must bump/relock the revision honestly.
Do not edit under r42 while leaving stale cache identity.

At completion report:
- starting HEAD,
- ending HEAD,
- runtime revision,
- changed files,
- Gold source/pack SHA references,
- tests with exact PASS/FAIL counts,
- browser evidence paths,
- shipping delta,
- any remaining placeholder asset slots,
- any consciously deferred issue.

DO NOT MODIFY HERO BALANCE OR MECHANICS FOR THIS UI CUTOVER.
DO NOT DELETE QUEST/SHOP; LOCK THEM LIGHTLY.
DO NOT HARD-LOCK THE ROSTER TO SIX HEROES.
DO NOT DRIFT GOLD MOTION, EFFECTS, VISUAL HIERARCHY, RESPONSIVE BEHAVIOR, OR UX MEANING.
