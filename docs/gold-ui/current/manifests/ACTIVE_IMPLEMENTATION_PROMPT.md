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
6A. BATTLE HUD DONOR — CHOREOGRAPHY AUTHORITY, NOT SIMULATOR AUTHORITY
======================================================================

The decoded donor:
docs/gold-ui/current/donors/battle-hud/index.html

contains TWO different things:

A. Gold presentation authority
B. a self-contained LAB/playtest combat simulator used to exercise A

Do not confuse them.

PRESERVE A:
- HUD geometry;
- rail/body/skill/loadout composition;
- responsive desk/land/port families;
- Normal/Critical/Heavy/Thunder/Heal visual choreography;
- ready/cast/cooldown response;
- weapon-change/reload response;
- low-HP/tension response;
- KO/fracture/shatter/recovery;
- phase order, timing, easing, recoil, overshoot, settle;
- reduced-motion behavior.

DO NOT PORT B AS PRODUCTION TRUTH:
- donor state S / G;
- fake fighters, bullets, cover, walls;
- applyDamage();
- heal();
- cast();
- skillEffect();
- swapWeapon();
- fake reload lifecycle;
- fake best-of-three wins/round reset;
- fake 180s timer;
- fake low-HP regen;
- fake BOT auto-cast;
- resetDemo();
- preview viewport preset controls;
- LAB / diagnostics;
- H/C/D/F/W/E/R/T/P/L/V test keys;
- donor M=1P/2P;
- donor P2 U/I bindings;
- timer tap opening LAB;
- synthetic thunder audio generator as a replacement for the production audio graph.

The production architecture is:

REAL GAMEPLAY / PRODUCT TRUTH
→ THIN SEMANTIC EVENT / INPUT ADAPTER
→ GOLD PRESENTATION STATE
→ GOLD CHOREOGRAPHY

Never:

KEY/BUTTON
→ DIRECT FX

and never:

DOM TEXT / ANIMATION END
→ INFERRED GAMEPLAY EVENT

The donor effect-test buttons must disappear from the public build.
Their corresponding Gold effects survive, driven by the real triggers below.

======================================================================
6B. OWNER-LOCKED BATTLE SEMANTIC TRIGGER TABLE
======================================================================

Use the current production event/state authority.
Add only narrow observation seams when production lacks a readable semantic edge.
Never add a second combat engine.

-------------------------
NORMAL HIT
-------------------------

Trigger:
a positive REALIZED damage transaction reaches a victim after all existing
mitigation/defense and actual HP loss, with no real firearm-critical flag.

Current canonical seam already exists:
Fighter.takeDamage()
→ APEX_COMBAT_HUD.onRealizedDamage(...)

The normal hit response may occur per real hit, with Gold's existing
anti-spam/coalescing behavior.

Do not trigger from:
- damage-number DOM;
- projectile visual contact alone;
- key H;
- donor applyDamage().

-------------------------
CRITICAL
-------------------------

Trigger:
a positive realized damage transaction with the authoritative firearm
critical flag.

Critical remains FIREARM-CRITICAL semantics.
Do not label melee, grenade, shield, native hero damage, heal, floor hazard,
or merely-large damage as Critical unless the combat runtime itself marks
that transaction as a firearm critical.

OWNER COLOR CORRECTION:

The donor's fixed orange critical color is stale demo semantics.

Production Critical uses a data-driven:
critAccent(attacker/source)

and that source identity accent drives the complete authored Critical family:
- damage number;
- diamond/geometric mark;
- Critical stamp;
- sweep;
- chroma;
- edge response;
- rail response;
- linked Critical accents.

Preserve the Gold hierarchy/brightness/contrast so Critical is still clearly
different from Normal; only the semantic accent source changes.

Thunder does not replace this identity rule.

-------------------------
HEAVY
-------------------------

OWNER-LOCKED definition:

ONE victim receives MORE THAN 200 total REALIZED damage inside a rolling
1.20 second window
→ HEAVY presentation response.

Implement Heavy per victim from realized-damage events.

Rules:
- rolling 1.20s window;
- actual post-mitigation HP loss only;
- zero/blocked damage does not count;
- healing does not count;
- independent accumulator per victim;
- the threshold is >200, not >=200;
- this is NOT "one hit >200";
- this does not modify damage;
- this does not change balance;
- this does not manufacture a combat status.

A qualifying burst produces at most ONE Heavy response.
Continued hits belonging to the same already-qualified burst must not spam
Heavy repeatedly.

Heavy classification is presentation state.
Do not corrupt the existing PASS-B burst/pressure read-model to obtain it.
The two systems may consume the same realized-damage stream but keep their
authored semantics separate.

-------------------------
STORMBREAKER / THUNDER
-------------------------

Trigger:
a CONFIRMED damaging Stormbreaker hit from canonical Arsenal projectile /
weapon resolution.

Response:
HEAVY presentation family
+
separate THUNDER / LIGHTNING presentation family.

Do not:
- reinterpret Stormbreaker as a Critical;
- use the donor F key;
- trigger Thunder from the zero-damage floor lightning/stun hazard;
- infer it from a lightning visual;
- change Stormbreaker damage/balance in this UI task.

Thunder is an overlay/family with its own authored lightning choreography.
Critical source-identity color law remains intact.

-------------------------
HEAL
-------------------------

Trigger:
a real heal transaction with positive realized healing:
afterHp - beforeHp > 0.

Current Fighter.heal owns heal math.
If no semantic observer exists, add a THIN post-heal notification seam only
after the real HP delta is known.

Do not:
- change heal math;
- use requested heal amount when cap/overheal makes realized healing smaller;
- trigger from green text;
- use donor fake regen/heal timer.

-------------------------
WEAPON ACQUIRED / CHANGED / RELOAD
-------------------------

Trigger weapon-change presentation only when canonical Arsenal holder /
weapon identity actually changes.

Use:
- weaponApi holder truth;
- accepted Arsenal AV/cache authority;
- or a change-only diff of the canonical loadout projection if that is the
  narrowest existing seam.

Do not use donor W/E swap keys.

If production has no legal manual weapon-swap action, do NOT invent one just
to satisfy the donor's .wp-swap control.
The Gold slot may remain a state/readout surface, but must not advertise a
fake W/E action.

Reload start / reload finish presentation must follow real firearm lifecycle
only. Never use the donor's hard-coded 1400ms simulator as gameplay truth.

-------------------------
LOW-HP / LATE-FIGHT TENSION
-------------------------

The owner-approved late-fight trigger is based on REAL HP:

BOTH active combatants at <= 500 HP
with MATCH_HP = 1000
→ low-HP / tension phase response.

Use real reconciled body/combatant HP.

Do not silently reuse the donor simulator's individual <25% threshold as
the authority for this global phase.

If a separate per-side low-health readability treatment is preserved, it
must still read real HP and must not redefine the owner global tension
trigger above.

Healing may legitimately move the match out of the condition; handle the
state transition cleanly without replay spam.

-------------------------
SKILL CAST
-------------------------

Input attempt is NOT a successful cast.

Trigger Gold CAST response only after the canonical ability/controller path
accepts and commits the cast.

Rejected / blocked / cooldown / CC / unmet-condition attempts:
- may receive the Gold rejected-input feedback if authored;
- must NOT play successful CAST choreography.

Never drive cast visuals directly from J/K/1/2/touch before runtime acceptance.

-------------------------
SKILL READY
-------------------------

Trigger READY only on a real edge:
NOT USABLE
→ USABLE

using canonical cooldown / charge / hero-rework skill truth.

Do not:
- replay READY every reconciliation tick;
- trigger because a CSS mask reached zero;
- use donor timers.

-------------------------
KO / RESULT
-------------------------

Trigger KO from authoritative combatant KO / Arsenal result truth.

Use existing hero-rework body/combatant authority and:
APEX_ARSENAL.resultProjection()

Do not:
- use donor p.hp<=0 simulator state;
- run donor timed round reset after KO;
- synthesize a winner in presentation.

-------------------------
ROUND / TIMER / PIPS
-------------------------

Only bind round/timer/win-pip visuals if current production has real
authoritative state for them.

The donor's:
- R2 seed;
- 167/180 second timer;
- best-of-three / first-to-two simulation;
- post-KO reset

are NOT permission to create new match rules.

If the current product remains single-match with no real round system:
- do not invent rounds;
- adapt/hide/neutralize only the stateful content while preserving the Gold
  frame/composition;
- report the deviation explicitly.

======================================================================
6C. PRODUCTION INPUT AUTHORITY — KEYBOARD + TOUCH
======================================================================

Owner-locked controls:

P1:
- J = A1
- K = A2

P2 in REAL LOCAL 2P only:
- Digit1 = A1
- Digit2 = A2

BOT:
- only P1 J/K are human ability controls;
- P2 remains the real CPU;
- P2 skill cards are threat/readout surfaces, not player buttons.

LOCAL 2P:
- P2 cast AI MUST be disabled;
- Digit1/Digit2 route into the SAME canonical ability controller used by
  production hero mechanics;
- do not duplicate hero skill logic;
- do not add a second cooldown implementation.

Current audit shows:
- heroReworkRuntime currently implements P1 J/K and P2 cast AI;
- production currently lacks the owner-approved Local-2P Digit1/Digit2 path;
- this task must close that gap as a minimal input adapter, not a mechanic redesign.

Product mode truth must come from the actual BOT/LOCAL selection.
Prove the picker/start-match path sets the battle profile correctly.
Do not let the runtime silently default to LOCAL or leave P2 AI active in
Local 2P.

MOBILE / TOUCH:

Gold skill cards for a HUMAN side are real touch targets.

Pointer/touch action:
→ production input adapter
→ canonical ability acceptance
→ semantic cast event/state
→ Gold response

Never:
touch tile
→ direct cast FX.

In Local 2P portrait, both players' skill cards remain independently usable
from their physical side of the shared device.

Do not retain public:
- U/I;
- W/E fake weapon swap;
- H/C/D/F effect triggers;
- R reset;
- T diagnostics;
- P donor pause;
- L LAB;
- V viewport preview.

M remains MUSIC mute/unmute only.
Escape may remain the real production back/exit action where product flow
permits it.

Developer diagnostics may exist only behind explicit test/dev authority and
must not be visible or reachable in the normal public product journey.

======================================================================
6D. RESPONSIVE BATTLE AUTHORITY — RE-COMPOSE, DO NOT SCALE DOWN
======================================================================

The Gold donor has three real layout families:

1. desk
2. land
3. port

Production must derive the family from the REAL viewport and re-compose the
HUD accordingly.

The donor PRESETS and:
stage.style.transform = translate(...) scale(...)

are preview tooling only.

DO NOT ship a fixed virtual canvas/HUD that is uniformly scaled to fit.

-------------------------
DESK
-------------------------

Preserve:
P1 SIDE | SQUARE ARENA | P2 SIDE
with the authored top versus rail / match center.

Arena remains square and central.
Side territory absorbs remaining width.

-------------------------
LAND
-------------------------

Preserve mobile-landscape re-composition.

In BOT / 1P:
- P1 receives the larger useful human/thumb territory;
- P2 collapses to the authored compact CPU threat/status treatment;
- P2 controls are not exposed.

In Local 2P:
- both human territories remain actionable;
- touch targets remain usable;
- arena remains the priority square.

-------------------------
PORT
-------------------------

Preserve the authored vertical family:
P2 territory
→ match rail
→ square arena
→ P1 territory.

LOCAL 2P PORTRAIT:
- rotate ONLY the P2 control territory 180 degrees toward the opposite edge;
- keep P2 controls readable to Player 2;
- do NOT rotate the arena;
- do NOT rotate timer/match center;
- do NOT rotate neutral/global information;
- global hit/crack/thunder effects must still resolve against real side geometry.

BOT / 1P PORTRAIT:
- P2 becomes the compact enemy/threat strip;
- P1 receives the large thumb/skill zone;
- do not waste half the phone on non-interactive CPU controls.

-------------------------
SAFE AREA / TOUCH / ORIENTATION
-------------------------

Use real:
env(safe-area-inset-*)

where relevant.

No required active touch target may fall below 44px.

No page-level scroll should be required to play the battle.
Do not solve a narrow phone by stacking a long scrolling legacy HUD.

On resize/orientation change:
- recompute layout family and canvas backing dimensions;
- preserve live gameplay state;
- preserve HP/cooldown/weapon/skill state;
- preserve music/battle-audio state;
- do not remount the whole battle;
- do not duplicate event listeners;
- do not restart the match.

Crack/rupture/sweep/side-anchor math must use current real post-layout
geometry, not stale desktop coordinates.

-------------------------
MANDATORY RESPONSIVE PROOF VIEWPORTS
-------------------------

At minimum prove the donor's authored reference families:

- 1366 x 768 — desktop
- 1920 x 1080 — desktop
- 844 x 390 — mobile landscape
  reference safe inset: top 0 / right 44 / bottom 16 / left 44
- 390 x 844 — mobile portrait
  reference safe inset: top 47 / right 0 / bottom 34 / left 0

For every relevant viewport prove:
- no unintended overflow;
- arena square;
- arena not crushed by HUD;
- timer/match center aligned;
- no side-panel spill;
- actionable touch targets >=44px;
- P1/P2/BOT semantic orientation correct;
- hit/crit/heavy/thunder/heal/KO effects remain correctly anchored;
- local portrait P2 control territory alone is rotated;
- no global uniform scale-down masquerading as responsiveness.


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
12. build the thin Battle semantic-trigger + BOT/Local input adapters; remove donor LAB/simulator authority
13. port Battle HUD against r42/current projection authority using real triggers
14. port battle-entry + result presentation
15. lightly lock Quest/Shop, including stale ACTIVE Shop correction
16. responsive closure across desk/land/port + BOT/Local + orientation changes
17. trigger/control proof including P1 J/K, Local P2 1/2 and touch skill cards
18. motion/effect parity proof
19. AV behavior proof
20. kill/crack performance proof
21. source/runtime/shipping gates
22. headless acceptance
23. real browser acceptance
24. production build
25. runtime revision bump/relock where required
26. commit and report exact SHA

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
- Battle desk/land/port layout families at 1366x768, 1920x1080, 844x390, 390x844
- Local 2P portrait P2-control-only 180° orientation proof
- live resize/orientation-change proof without battle reset
- P1/P2 data-driven ownership colors
- A1/A2 ready/cast/cooldown from real runtime acceptance/state
- P1 J/K production controls
- Local 2P P2 Digit1/Digit2 production controls with P2 AI disabled
- mobile/touch human skill-card controls
- BOT P2 threat/readout with no human P2 controls
- normal realized damage
- source-identity-colored firearm Critical
- Heavy (>200 realized damage / same victim / rolling 1.20s, once per qualifying burst)
- confirmed Stormbreaker Heavy + Thunder/Lightning
- real realized heal
- real weapon acquired/change + reload lifecycle
- owner low-HP/tension phase when both combatants are <=500 HP
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
DO NOT SHIP THE DONOR LAB OR FAKE COMBAT SIMULATOR.
DO NOT SHIP U/I AS P2 SKILL KEYS; LOCAL P2 IS DIGIT1/DIGIT2.
DO NOT USE FIXED ORANGE FOR PRODUCTION CRITICAL; USE ATTACKER/SOURCE IDENTITY ACCENT.
DO NOT USE DONOR H/C/D/F BUTTONS AS PRODUCTION EFFECT TRIGGERS.
DO NOT USE WHOLE-STAGE SCALE-DOWN AS SHIPPING RESPONSIVE BEHAVIOR.
DO NOT DELETE QUEST/SHOP.
DO NOT HARD-LOCK THE ROSTER TO SIX HEROES.
DO NOT DRIFT GOLD PRESENTATION.
