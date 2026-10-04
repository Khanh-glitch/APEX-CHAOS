APEX CHAOS — GOLD PRODUCT UI/UX/HUD CUTOVER + CORE SIX AV + CONTINUOUS THEME
DIRECT REPOSITORY IMPLEMENTATION — EXECUTE, DO NOT REDESIGN

Repository:
Khanh-glitch/APEX-CHAOS

Branch:
arena/01a1025a-apex-chaos

MINIMUM ACCEPTED AV ASSET CHECKPOINT:
50b185c184955d279de93874823859ccabb498c6

STARTING HEAD LAW:
Start from the CURRENT tip of arena/01a1025a-apex-chaos.
That tip must contain/descend from the minimum AV checkpoint above.
Do NOT reset the branch back to 50b185c184955d279de93874823859ccabb498c6 merely because it is the asset checkpoint.
Audit and preserve every newer accepted commit, including the prompt/audit relock commits.

Gold-preload parent:
b5defc0bc51e98d47dca4e4672fc82a75ef14673

Production runtime baseline underneath the additive AV preload:
20261003-mirror-v1-r42

The minimum AV checkpoint above is an ADDITIVE ASSET/DOCUMENT preload.
It does not by itself change runtime mechanics, balance, or r42 gameplay truth.
Newer prompt/audit relock commits may sit on top without changing that runtime baseline.

This is the REAL Gold product cutover.
Do not return a plan and stop.
Do not redesign.
Do not reset to an older SHA.
If HEAD has advanced beyond the required checkpoint, audit the delta and preserve all newer accepted work.

======================================================================
0. MANDATORY READING — BEFORE PRODUCTION EDITS
======================================================================

Read completely, in this order:

1. docs/gold-ui/current/README_GOLD_AUTHORITY.md
2. docs/gold-ui/current/manifests/ANTI_DRIFT_CONTRACT.md
3. docs/gold-ui/current/manifests/IMPLEMENTATION_PRELOAD.md
4. docs/gold-ui/current/manifests/placeholder-contract.json
5. docs/gold-ui/current/manifests/asset-manifest.json
6. docs/gold-ui/current/manifests/dependency-audit.json
7. docs/gold-ui/preload/README_AV_THEME_PRELOAD.md
8. docs/gold-ui/preload/AV_THEME_PRELOAD_MANIFEST.json
9. docs/gold-ui/current/manifests/ACTIVE_IMPLEMENTATION_PROMPT.md
10. docs/gold-ui/current/index.html
11. docs/gold-ui/current/donors/lucky-draw/index.html
12. docs/gold-ui/current/donors/battle-hud/index.html

Then audit current production authority:

- src/App.jsx
- src/styles.css
- src/game/runtimeManifest.js
- src/game/productSurface.js
- public/game/ui/apexPickRuntime.js
- public/game/ui/apexCombatHudRuntime.js
- public/game/modes/arsenalBattleRuntime.js
- public/game/core/apexArsenalProductRenderHudRuntime.js
- public/game/core/apexBattleAudioRuntime.js
- public/game/core/apexBattleSfxRuntime.js
- public/game/hero-rework/heroReworkRuntime.js
- public/game/hero-rework/heroMechanicsRuntime.js
- all six current hero presentation/Gold runtimes
- source/runtime/shipping/headless/browser gates

Also read the failure-prevention history before touching Core Six AV seams:

- docs/hero-rework/robot-final/00_ROBOT_FINAL_INTEGRATION_LOCK_2026-09-29.md
- docs/hero-rework/hunter-v1.1/01_FINAL_GOLD_INTEGRATION_AUTHORITY_2026-09-29.md
- docs/hero-rework/crystala-v1/00_CRYSTALA_IMPLEMENTATION_AUTHORITY.md
- docs/hero-rework/magnet-v1/07_PROCESS_LESSONS_ROBOT_TO_FROST.md
- docs/hero-rework/magnet-v1/12_OWNER_REJECTION_FORENSIC_AUDIT.md
- docs/hero-rework/frost-v1/08_PRELOAD_HOSTILE_AUDIT.md
- docs/hero-rework/mirror-v1/06_PROCESS_LESSONS_ROBOT_TO_MAGNET.md
- docs/hero-rework/mirror-v1/15_CHECKPOINT_G_CLOSURE.md

Do not use historical mechanics where later live code supersedes them.
These documents are required mainly for integration lessons, failure modes, Gold identity, and regression boundaries.

======================================================================
1. ABSOLUTE PRESENTATION AUTHORITY
======================================================================

The Gold source is not inspiration.
It is presentation authority.

Do not:
- approximate it;
- simplify it;
- normalize it into generic UI;
- redraw it for implementation convenience;
- replace authored motion with generic fades/slides;
- weaken effects merely to improve performance.

Preserve in perceived behavior:

- composition
- geometry
- spacing hierarchy
- z-order
- responsive layout families
- interaction affordances
- state emphasis
- P1/P2 semantic ownership colors
- motion choreography
- phase relationships
- durations
- easing relationships
- overshoot
- settle
- recoil direction
- shake hierarchy
- flash hierarchy
- fracture/crack/shatter behavior
- normal-hit / critical / heal distinction
- KO/result emphasis
- Lucky Draw choreography
- Fighter Pick lock behavior
- battle-entry transition
- reduced-motion behavior
- every authored UX implication

For every important response derive:

TRIGGER
→ STATE SOURCE
→ TARGET LAYER
→ SIDE
→ PHASE ORDER
→ DURATION
→ EASING
→ INTENSITY
→ SETTLE
→ RESPONSIVE VARIANT
→ UX MEANING

Production owns gameplay truth.
Gold owns presentation.

======================================================================
2. PLACEHOLDER LAW — DO NOT CONFUSE UI ART WITH HERO AV
======================================================================

Only FOUR Gold UI ART categories are replaceable placeholders:

1. Lucky Draw fighter visual art
2. Fighter Pick cover/card art
3. Fighter Pick pose/stage art
4. Battle avatar/portrait + passive/A1/A2 skill icons

Only replace CONTENT inside those slots.
Do not change geometry, crop, mask, focus, frame, glow, state behavior,
responsive behavior, or motion envelope.

Mirror large Pick pose may remain runtime opponent-derived/transparent identity.

IMPORTANT AFTER THE AV PRELOAD:

The Core Six gameplay VFX/SFX are NOT generic placeholders and are NOT “TBD”.

- ROBOT VFX authority already ships in production.
- HUNTER VFX authority already ships in production.
- ROBOT accepted SFX already ships under public/assets/hero-rework/robot-final/sfx/.
- HUNTER accepted SFX already ships under public/assets/hero-rework/hunter-v10/sfx/.
- CRYSTALA/MAGNET/FROST/MIRROR now have curated VFX/SFX preload authority in:
  docs/gold-ui/preload/APEX_CHAOS_CORE_SIX_AV_THEME_PRELOAD.zip

That AV preload does NOT fill the four UI-art placeholder categories above.
Do not falsely mark Pick/HUD art slots complete merely because hero VFX/SFX exists.

======================================================================
3. CORE SIX AV PRELOAD — MATERIALIZE, DO NOT FORK
======================================================================

Archive:
docs/gold-ui/preload/APEX_CHAOS_CORE_SIX_AV_THEME_PRELOAD.zip

Archive SHA-256:
49d8d5bf448bce7ca6475388cdf640c338bc00250fbcb577dbc7962fcfd0180f

Before use:
- verify the archive hash;
- read its README/MANIFEST;
- extract/materialize required runtime assets to stable production paths;
- do NOT make production load ZIP contents dynamically;
- do NOT ship source-only/reference WAV material if a pre-cut runtime clip exists;
- do NOT create a second copy of Gold VFX engines.

VFX law:
REAL GAMEPLAY TRUTH
→ THIN SEMANTIC ADAPTER
→ ACCEPTED GOLD/PRESENTATION ENGINE
→ ISOLATED DRAW

Never:
REAL GAMEPLAY
→ APPROXIMATE EFFECT A
+ PARTIAL GOLD B
+ GENERIC FALLBACK C

For Robot/Hunter, use the existing production VFX authority referenced by their manifests.
For Crystala/Magnet/Frost/Mirror, their VFX manifests point to the existing accepted shipping Gold/presentation runtimes. Reuse those authorities; do not fork them out of Git simply because the preload calls them packs.

SFX law:
- wire semantic gameplay events, not visual guesses;
- DEFAULT ON cues may be integrated first;
- LOW ACCENT must remain restrained;
- OFF BY DEFAULT / OPTIONAL remains off unless owner playtest asks for it;
- rate-limit bursty reflection/deflection/shard/freeze cues exactly as the pack directs;
- do not play one sound per pellet/tick/shard where the authority says one semantic event;
- keep ordinary firearm/equip/body-hit audio in the shared/global layer;
- do not create a new AudioContext for hero SFX.

Specific anti-noise examples that must survive integration:
- Magnet A2 bullet deflect uses the pre-cut whizz/redirection portion only; no wall-impact transient and no per-tick sound.
- Frost FreezeRefresh must NOT replay the full enemy-freeze cue.
- Mirror one realized passive damage event produces at most one shard-drop accent even if it creates multiple shards.
- Crystala one interception produces one audible reflect cue, not duplicate Intercept + Reflect audio.
- Optional construct/floor/fold accents stay OFF BY DEFAULT.

======================================================================
4. THEME MUSIC — FORWARD DRIVE IS NOW PRODUCT AUTHORITY
======================================================================

Owner source:
Forward Drive.mp3
Owner-source SHA-256:
e3207b5744ad1657fd77d757bd732a71eda5a4c471e0abef7f68a121b32a2c9e

Repository-efficient preload copy inside the archive:
music/forward_drive_theme.ogg
SHA-256:
15afd820d5ca061f374ea41ad425f795204cf2be0e1f03d641f9b1f85f6dfb9b
Duration:
~158.06 seconds

MATERIALIZE the theme to a stable public runtime path.

Do NOT build a second music manager.
Audit and ADAPT the existing menu-BGM seam in src/App.jsx.

The existing implementation is useful because it already:
- owns one HTMLMediaElement;
- keeps menu music outside the battle-audio graph;
- observes visibilitychange / blur / focus;
- respects browser autoplay recovery.

But current behavior is NOT the new authority because it:
- only allows menu/select;
- can reset currentTime to 0 on battle/menu handoffs;
- has no authored fade;
- has no production M music toggle.

Replace the behavior, not the architecture.

-------------------------
4.1 PLAYHEAD CONTINUITY
-------------------------

Normal surface transitions MUST NOT restart the track.

When music becomes disallowed:
- fade out;
- pause after fade;
- PRESERVE currentTime.

When music becomes allowed again:
- resume from the preserved currentTime;
- fade in;
- never restart at 0 merely because the user navigated away and back.

Track loop after reaching its natural end is allowed.
A loop boundary is not a surface-transition restart.

A true application reload/new session may begin from the beginning unless a pre-existing product setting says otherwise.

-------------------------
4.2 SURFACE POLICY
-------------------------

Music must be OFF/PAUSED on:

- Lucky Draw / Gacha
- Fighter Upgrade
- Mission / Missions
- Fighter Shop

Those are explicit owner exceptions.

For the remaining normal product surfaces, keep the theme running continuously until the ACTUAL BATTLE MATCH begins.

In particular:
- Home/navigation: ON
- BOT Fighter Pick: ON
- Local Fighter Pick: ON
- battle-entry transition / handoff before real match start: ON
- result/return flow: resume same preserved playhead if surface policy allows

Do not stop theme merely because a battle was selected.
Stop only at the real match-start seam.

Quest/Shop product availability is a separate product-law issue.
Even if a future locked/preview surface is not launchable, keep the music-policy architecture data-driven so unlocking later does not require rewriting the audio manager.

-------------------------
4.3 FADE LAW
-------------------------

Every policy-driven audible start/stop must fade.

Use one production-owned fade duration constant or small pair of constants.
A short fade in the rough 300–450 ms range is acceptable unless real playtest shows a better value.

Requirements:
- no hard cut on ordinary surface transition;
- no overlapping duplicate theme elements;
- cancelling/reversing a fade mid-transition must remain stable;
- repeated navigation must not accumulate timers or stale promises;
- battle start cannot leave a late theme resume racing the battle session.

-------------------------
4.4 TAB / WINDOW LAW
-------------------------

When:
- document.hidden becomes true, OR
- the browser window loses focus / blur,

theme audio must become silent/pause.
Do not allow music to continue audibly in another tab/window.

When visible/focused again:
resume from the SAME playhead only if:
- user music mute is OFF;
- current surface policy allows theme;
- the page has an allowed autoplay/gesture state.

Do not reset currentTime on blur/visibility pause.

-------------------------
4.5 M KEY LAW
-------------------------

M is the global MUSIC-only mute/unmute key.

M must:
- mute/fade/pause theme while preserving playhead;
- unmute/resume same playhead if current surface policy allows;
- do nothing to battle SFX/master;
- not change BOT/Local mode;
- not create a new UI mechanic unless Gold already has a suitable non-drifting indicator.

CRITICAL COLLISION:
The standalone Battle HUD donor currently uses demo-only:
M = toggle 1P/2P mode.

That binding MUST NOT survive production.

Production BOT/Local/P1/P2 mode comes from real product state.
Remove/quarantine the donor demo M semantic when porting.
Do not synthesize keyboard events to change game mode.

-------------------------
4.6 AUDIO GRAPH LAW
-------------------------

Theme remains outside public/game/core/apexBattleAudioRuntime.js master graph.
Battle SFX remain battle-session-owned.
Do not route theme into battleAudioMaster.
Do not let M mute battle SFX.
Do not create another AudioContext.
Do not clear decoded battle SFX merely because theme pauses.

======================================================================
5. PRODUCT SURFACES — CURRENT CONFLICT MUST BE RESOLVED
======================================================================

Gold cutover scope:

OPEN NOW:
- Gold Home/navigation
- Lucky Draw / Gacha
- Local/BOT Fighter Pick
- Battle HUD
- battle-entry transition
- current result/return flow

NOT READY:
- Quest
- Shop

Quest and Shop remain LIGHTLY LOCKED future extension points.

Current src/game/productSurface.js at the preload parent still marks Fighter Shop ACTIVE.
That is stale relative to this Gold cutover authority.

Resolve it deliberately:
- Fighter Shop must become LIGHTLY LOCKED for this cutover;
- preserve its route/product role for future unlock;
- do not delete architecture;
- do not invent final Shop UI;
- do not leave an ACTIVE stale Shop merely because older production code says so.

Do not hard-code the app to six heroes.
Current Core Six is content scope, not architectural roster limit.

======================================================================
6. PRODUCTION STATE AUTHORITY — R42
======================================================================

Use existing production truth:

- APEX_COMBAT_HUD.projection()
- APEX_COMBAT_HUD.syncVitals()
- APEX_ARSENAL.hudProjectionFor()
- APEX_ARSENAL.resultProjection()
- hero-rework/runtime mechanic authority

Never move into Gold/UI:
- damage math
- crit math
- heal math
- HP truth
- cooldown truth
- weapon ownership
- hero mechanics
- match winner
- Arsenal combat constants
- P1/P2/BOT behavior

Do not resurrect aq-skill-hud or old duplicate/direct HUD writers removed before r42.

Any production runtime/source edit covered by revision authority must bump/relock the runtime revision honestly.
Do not change runtime bytes under stale r42 cache identity.

======================================================================
7. CORE SIX PROCESS LESSONS — FORBIDDEN REGRESSIONS
======================================================================

These are hard lessons from Robot → Hunter → Crystala → Magnet → Frost → Mirror.

ROBOT:
- coordinate ownership must be explicit;
- body must express hero fantasy, not generic surrounding FX;
- real equip/fire/contact events own transaction truth;
- do not let gameplay outrun visible choreography;
- do not allow generic layers to contaminate hero identity.

HUNTER:
- latest canonical donor path + hash beats stale labels;
- immutable derived art/material caches are shared, mutable lifecycle is per instance;
- real swept contact is the only successful-catch truth;
- rendered trap footprint and gameplay trigger footprint must agree;
- do not double-render actor/world/status layers.

CRYSTALA:
- consume real geometry/projectile truth;
- protect shared systems with unrelated regressions;
- when Gold is already correct, mechanic/integration deltas must not rewrite it;
- durable remote checkpoints matter.

MAGNET:
- NEVER validate a reconstructed Gold engine only against itself;
- canonical parity must compare against canonical source behavior;
- a force function running is not proof that fast real projectiles visibly read;
- do not copy donor diagnostic substrate/grid into the production arena;
- do not integrate body force after canonical collision and recreate penetration/sticking;
- validate the actual primitive/player-visible result, not merely “Gold function was called.”

FROST:
- wrong/obsolete Gold invalidates the whole bridge;
- no generic cyan lines/rectangles as a Gold substitute;
- semantic RNG timing matters;
- no permanent contact latch where separation/re-contact is legal;
- config declarations without runtime behavior are fake completeness;
- full canvas save/restore is mandatory around hero rendering;
- prevent render-state/scale leakage into opponent/arena;
- raw hitch dt/stale motion history can destroy authored motion;
- stale PASS counts after later edits are invalid.

MIRROR:
- use fixed/bounded Gold presentation state where accepted;
- do not add a second movement/physics integrator;
- high-speed routing/capture requires swept real paths;
- real pixels/frames at normal battle scale matter;
- separate automated correctness, canonical parity, browser evidence, and owner acceptance.

GLOBAL:
Tests may not pin/disable the very behavior they claim to prove.
Green tests are not owner visual acceptance.
Every PASS count must be from the exact final SHA being reported.

======================================================================
8. P1/P2 OWNERSHIP COLOR
======================================================================

P1/P2 color is semantic ownership, not decoration.

Implement as data-driven tokens and propagate where Gold authored:
- HP rails
- side frames
- glows
- accents
- skill state
- transition rails
- impact response
- KO/winner emphasis

Do not hard-code a single demo fighter pair.

======================================================================
9. PERFORMANCE
======================================================================

The standalone Battle HUD is known to be smooth.
Integrated kill/screen-crack must not reintroduce hitch.

Do not weaken Gold effects to fix performance.

Instead:
- avoid arena reflow;
- prefer transform/opacity/clip-path;
- preload retained Gold assets;
- keep expensive layers persistent when appropriate;
- avoid synchronous image decode at hit/kill;
- avoid rebuilding large DOM on hit/crit/KO;
- isolate canvas save/restore;
- profile kill + crack + transition specifically;
- ensure new audio preloading/cutting does not decode large source files on first combat event.

Hero source/reference archives are not runtime hot assets.
Use the compact materialized clips/assets.

======================================================================
10. OFFLINE SHIPPING
======================================================================

Lucky Draw donor still has live Tailwind/Google Fonts dependencies.
Production shipping must work offline.

Materialize/compile equivalent local dependencies while proving:
- font metrics do not drift;
- layout does not drift;
- perceived Gold motion/behavior does not drift.

Forward Drive and all runtime SFX must also ship locally.
No runtime network dependency for audio.

Do not ship the AV preload ZIP as a runtime dependency.
It may remain in repository docs/reference, but shipping runtime loads normal stable asset paths.

======================================================================
11. IMPLEMENTATION ORDER
======================================================================

Do not stop after audit.
Do not stop after a static shell.

Execute in controlled, reviewable slices:

1. hostile pre-audit of current HEAD vs this authority
2. verify AV preload archive/hash and materialize compact runtime assets
3. wire Crystala/Magnet/Frost/Mirror curated SFX to real semantic events with anti-noise rules
4. validate Robot/Hunter existing AV authority without forking it
5. replace/adapt current menu BGM seam to Forward Drive continuity/fade/surface-policy/M-key authority
6. map Gold surfaces to existing production state owners
7. establish/retain true UI-art placeholder slots only
8. integrate retained Gold assets exactly
9. port Home
10. port Lucky Draw
11. port Fighter Pick
12. port Battle HUD against r42/current projection authority
13. port battle-entry + result presentation
14. lightly lock Quest/Shop, including stale ACTIVE Shop correction
15. responsive closure
16. motion/effect parity proof
17. AV behavior proof
18. kill/crack performance proof
19. source/runtime/shipping gates
20. headless acceptance
21. real browser acceptance
22. production build
23. runtime revision bump/relock where required
24. commit and report exact SHA

Prefer renderer/adapters and narrow seams over mechanic edits.
DO NOT retune hero balance/mechanics.

======================================================================
12. REQUIRED AV PROOF
======================================================================

Theme proof must include:

A. Home → BOT Pick:
- music continues without restart;
- currentTime monotonic except natural loop.

B. Home → Local Pick:
- same.

C. Home/allowed → Lucky Draw:
- fades out and pauses;
- currentTime preserved.

D. Lucky Draw → allowed surface:
- resumes same playhead with fade-in.

E. Fighter Shop policy:
- if reachable by an authorized test seam, music is paused;
- production public state remains lightly locked.

F. Fighter Upgrade / Missions policy:
- policy table marks them music-off even while currently locked;
- future unlock does not require audio-manager rewrite.

G. Pick → battle-entry:
- music continues through entry presentation.

H. actual match start:
- theme fades out/pauses exactly once;
- battle SFX session begins cleanly;
- no overlap race.

I. result/return:
- theme resumes same preserved playhead if policy allows.

J. blur/hidden:
- audible theme stops;
- focus/visible resumes same playhead only when allowed.

K. M:
- mute preserves playhead;
- unmute resumes same playhead when allowed;
- battle SFX unaffected;
- M does not toggle 1P/2P.

Hero SFX proof must include:
- semantic trigger correctness;
- no duplicate alias-event playback;
- rate/voice limits under burst stress;
- optional cues remain off;
- no first-use decode hitch in live combat;
- teardown/rematch does not leak stale voices/timers.

======================================================================
13. REQUIRED GOLD/UI PROOF
======================================================================

Real-browser evidence must include:

- Home desktop + responsive/mobile
- Lucky Draw idle/spin/result
- Fighter Pick P1/P2/BOT + lock behavior + responsive
- Battle desktop + mobile layout families
- P1/P2 data-driven ownership colors
- A1/A2 ready/cast/cooldown
- normal damage
- critical damage
- heal
- HP trail
- kill/KO
- crack/fracture/shatter
- battle-entry transition
- Result/return
- Quest/Shop lightly locked
- no arena/opponent scale leakage
- no Gold motion/effect simplification

Do not claim browser PASS without browser evidence.

======================================================================
14. COMPLETION REPORT
======================================================================

At completion report:

- starting HEAD
- ending HEAD
- runtime revision
- changed production files
- Gold files/assets consumed
- AV preload files materialized
- Core Six SFX/VFX integration status by hero
- theme runtime path
- theme continuity/fade/M/tab-window evidence
- remaining true UI-art placeholder slots
- Quest/Shop lock behavior
- motion/effect parity evidence
- desktop/mobile responsive evidence
- kill/crack performance evidence
- exact tests/gates and PASS/FAIL counts from the FINAL SHA
- production/shipping result
- any remaining deviation from Gold or AV authority

Any remaining deviation must be explicit.
Zero silent drift.

DO NOT MODIFY HERO BALANCE OR MECHANICS FOR THIS CUTOVER.
DO NOT FORK ACCEPTED HERO VFX.
DO NOT WIRE EVERY SFX JUST BECAUSE A FILE EXISTS.
DO NOT RESET THEME PLAYHEAD ON ORDINARY NAVIGATION.
DO NOT LET M TOGGLE GAME MODE.
DO NOT DELETE QUEST/SHOP.
DO NOT HARD-LOCK THE ROSTER TO SIX HEROES.
DO NOT DRIFT GOLD PRESENTATION.
