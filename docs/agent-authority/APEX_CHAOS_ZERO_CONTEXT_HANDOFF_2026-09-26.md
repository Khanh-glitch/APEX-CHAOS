# APEX CHAOS — ZERO-CONTEXT PROJECT HANDOFF
## Production-complete state + first task: mobile battle SFX investigation

**Date:** 2026-09-26  
**Repository:** `Khanh-glitch/APEX-CHAOS`  
**Current production branch:** `playtest/arsenal`  
**Current production SHA:** `5a9a4a1e8a5bc0b28077e9e6c8d7de42ac981009`  
**Commit message:** `deploy: publish responsive Arsenal UI and real controls`

---

# 0. READ THIS FIRST — OPERATING POSTURE FOR A NEW CHAT

This file is intended to let a completely new ChatGPT/Arena conversation continue the project without relying on conversational memory.

The game is now **relatively mature and substantially complete**. The default posture is no longer “redesign / rebuild / major update”. It is:

> **protect accepted production behavior, diagnose narrowly, change only what the owner explicitly asks to change.**

Before doing anything substantial:

1. Read this file completely.
2. Fetch live Git refs from `Khanh-glitch/APEX-CHAOS`.
3. Verify that `playtest/arsenal` is still the production branch and note its exact live SHA.
4. Compare the live SHA against the production SHA recorded above.
5. If production moved, audit what changed before acting.
6. Do **not** revive old plans, old branches, or old authority files blindly if they conflict with current production.
7. Treat current production behavior as the primary truth unless the owner explicitly asks to alter it.

Every new Arena chat may run a different model and may have different local state. Never rely on stale local refs or previous sandbox state. Fetch first.

---

# 1. CURRENT VERIFIED PRODUCTION STATE

A fresh GitHub audit at handoff creation verified:

## Production branch

`playtest/arsenal`

## Production commit

`5a9a4a1e8a5bc0b28077e9e6c8d7de42ac981009`

Message:

`deploy: publish responsive Arsenal UI and real controls`

Parents:

- `e004033436884ee293689d1d5c6f1ec170c1ec4a`
- `09dfe03655948a203356a60c576388394d521119`

Production tree:

`b0e42de773a504e4097c09ecc315518c8d8e7db9`

The implementation parent `e004033...` has the **same exact tree**:

`b0e42de773a504e4097c09ecc315518c8d8e7db9`

Therefore the production deploy commit is a merge/deploy marker around the exact implementation tree.

## Important: Git `main` is NOT current production

At handoff creation, Git branch `main` is still:

`116d5be2e3993f21407b1f30c27e0623c7e91992`

This is historical relative to the current live Arsenal production.

Do not assume `main` is the Cloudflare source.

## Current important branches seen remotely

- `playtest/arsenal` — production / Cloudflare source
- `arena/arsenal-uiux-overhaul` — recent implementation/evidence lineage
- `main` — older baseline, not current production
- `prototype/aftermath-32` — unrelated unique work; preserve
- several older `arena/...`, `chatgpt/...`, and `prototype/combat-hud-pass-b` branches — historical; do not merge blindly

## Cloudflare law

The owner wants the **existing primary Cloudflare link preserved**.

The current deployment source is `playtest/arsenal`.

When a future fix is accepted:

- keep the same production branch;
- do not create a new public link just for convenience;
- update/promote into `playtest/arsenal` only after verification and owner acceptance.

---

# 2. CURRENT CI / TEST TRUTH

Do not interpret workflow “failure” naively.

For implementation parent:

`e004033436884ee293689d1d5c6f1ec170c1ec4a`

GitHub Actions run:

`36210212383` — `Arsenal Quest Stabilization`

The overall workflow conclusion is `failure`, but the audited logs show:

- headless acceptance suite: **passed, no failed gates**
- production build: **passed**
- launcher smoke: **passed**
- real-browser Arsenal suite: **passed, no failed gates**
- AV asset preload checks: **passed**
- five-minute stability: **passed**

The workflow failed at the final Git evidence push because the remote branch had moved and Git rejected a non-fast-forward push.

In other words:

> **product/runtime tests were green; final evidence-push plumbing caused the red workflow badge.**

Do not “fix gameplay” because of that red badge.

A known fully successful earlier UI/UX ancestor is:

`b72f4191373b948d84bea3bdbf3c03b725963f37`

Run:

`36209971235` — success.

The commits after it are focused responsive/UI refinements leading to `e004033...`.

---

# 3. RECENT RESPONSIVE / REAL-CONTROL LINEAGE

Production includes this late UI/mobile refinement chain:

- `0069253c...` — make battle shell truly viewport-responsive
- `4f82b4ce...` — restore real pointer interaction for battle actions
- `6300bdd0...` — Hub / Shop / Draw viewport + touch responsiveness
- `b112ab9a...` — Quest Map viewport + touch responsiveness
- `dd0445d3...` — semantic result action buttons
- `50c7f41a...` — remove viewport gutters in active battle
- `dfeb8dc1...` — real pointer + viewport QA helpers
- `e578c05e...` — physical pointer-click navigation gates
- `3d70d3b6...` — fullscreen desktop + phone responsiveness gates
- `357bc242...` — reflow panels before desktop arena becomes cramped
- `3154b9ae...` — real phone touch interaction test
- `b72f4191...` — phone probe kept in CDP page context; successful CI ancestor
- `819c66ce...` — keep loadout labels readable on normal desktop
- `e0040334...` — anchor battle hint inside arena
- `5a9a4a1e...` — production deploy marker

These changes are already production behavior.

Do not casually undo or re-architect them when debugging mobile SFX.

---

# 4. OWNER WORKING PREFERENCE — IMPORTANT

The owner strongly dislikes:

- endless “recovery” loops;
- repeated branch archaeology when the target SHA is already known;
- agents spending 10–30 minutes philosophizing over a tiny fix;
- huge prompts when a micro-prompt is enough;
- fake “done” claims based only on prose;
- redesigning accepted parts while fixing an unrelated bug;
- demos that are worse than the approved visual reference;
- performance fixes that reduce accepted art/VFX/SFX quality.

Preferred rhythm:

> audit once → isolate real cause → make smallest credible fix → focused proof → owner tests → only then full final validation/promotion

For game-feel or UI visual issues, owner playtest remains the final taste gate.

---

# 5. ONE-REPOSITORY ARENA RULE

Arena Agent can effectively work in only one repository at a time.

If a future task needs anything from:

`Khanh-glitch/APEX-CHAOS-ASSET-VAULT`

bridge/copy the exact approved asset(s) into the authorized game repo branch first, then implement in `Khanh-glitch/APEX-CHAOS`.

Do not leave the Agent depending on two repos simultaneously.

---

# 6. COMPLETED / PROTECTED PRODUCT AREAS

The following are considered substantially complete and should be treated as **protected** unless the owner explicitly asks to change them.

A bug fix in one area must not become a broad redesign of these systems.

---

## 6.1 Arsenal product flow

Current intended flow:

`MAIN MENU → ARSENAL HUB`

Hub:

- FREE BATTLE
- QUEST MAP
- FIGHTER SHOP
- LUCKY DRAW

Back/navigation behavior was explicitly worked on and should remain predictable.

---

## 6.2 Meta save / currency

Canonical save:

`apexChaos.arsenalMeta.v1`

Default intent:

- 350 AC
- NEWBIE owned
- NEWBIE default P1
- NEWBIE default P2

Currency:

**ARSENAL CREDITS / AC**

---

## 6.3 Fighter Shop

All non-Newbie fighters:

**1000 AC**

Rules:

- direct purchase;
- no duplicate purchase;
- ownership persists;
- do not invent rarity-based prices.

---

## 6.4 Lucky Draw

Cost:

**350 AC**

Pool:

**unowned fighters only**

Rules:

- no duplicates;
- no shards;
- no pity;
- no premium currency;
- no daily-login mechanics;
- when empty: `ROSTER COMPLETE`.

---

## 6.5 Rewards

Frozen reward law:

- Quest first clear: +150 AC
- Quest replay win: +40 AC
- Free Battle completed: +25 AC
- Free Battle winner bonus: +25 AC
- aborted match: 0

---

## 6.6 Fighter Pick

Reuse current picker architecture.

Rules:

- normal Arsenal player picks only from owned fighters;
- NEWBIE always exists as fallback;
- Quest: P1 selected, P2 fixed by stage and may be unowned;
- Free Battle: both P1 and P2 from owned roster;
- preserve valid saved selections;
- invalid saved selection falls back to NEWBIE.

Do not redesign the picker from scratch unless explicitly requested.

---

# 7. FROZEN COMBAT LAWS

These are established product laws. Do not casually rebalance them while fixing platform/audio/UI bugs.

## Match HP

**1000 HP**

## Arsenal equipment damage scale

`ARSENAL_DAMAGE_SCALE = 7`

Applies to Arsenal equipment damage:

- 24 firearms
- grenade
- held melee
- thrown melee

Do NOT multiply:

- fighter-native skill damage
- movement
- timing
- projectile speed
- range
- knockback
- physics

## Heal values

- 70
- 126
- 196
- 280
- 385

Heal eligible at / below:

**800 HP**

## Crit

Firearms only.

Universal crit damage multiplier:

**1.50×**

Crit metadata is explicit; do not infer crit from high damage.

Shotgun/autoshot crit is one roll per blast, not one per pellet.

Normal damage number = red.  
Critical damage number = orange.  
Healing = green.

---

# 8. SPAWN LAW

Normal offensive spawn cadence:

**4.5 seconds**

Offensive active cap:

**5**

Emergency firearm predicate:

- both living fighters currently have no firearm;
- AND no `REVEALED` firearm floor pickup exists.

A firearm still in TELEGRAPH does not block emergency.

Heal/melee/shield/grenade do not count as “fighter has firearm”.

Emergency result must be a firearm.

Preserve edge-trigger / pending semantics and cap safety.

---

# 9. WEAPON / ART / PRESENTATION LAW

Production has real weapon art and the C weapon set.

Do not replace approved weapon art with generic text, rectangles, silhouettes, or temporary shapes.

Firearm visible normalization exists and muzzle/casing anchors must remain consistent with normalized transforms.

Do not degrade accepted art resolution for performance.

Do not reintroduce random slash VFX that fire at the wrong place/time.

---

# 10. V1 BLOOD / SPLATTER — CURRENT PROTECTED BEHAVIOR

The V1 blood direction is accepted visually.

Core identity:

- manga-like directional blood impact;
- dense irregular core;
- tapered streaks;
- medium/micro spray;
- persistent dark floor blood;
- no glow;
- no radial fireworks;
- normal semantic red / crit orange rules remain separate from blood itself.

Important current correction is present in production:

On the fresh collision tick:

- `v1streak`, `v1drop`, `v1micro` receive their first position integration + reference drag immediately;
- life is **not aged** on the first frame, preserving full first-frame strength;
- `v1core` stays at the impact point;
- subsequent ticks follow normal reference physics.

This was done specifically to remove the impression that blood waits one frame and then begins spraying from a stale impact point.

The current production implementation comment explicitly calls this:

**PASS B splatter correction (V1 only)**

Do not remove this while working on mobile SFX.

Blood should be considered frozen unless the owner opens a separate blood task.

---

# 11. COMBAT HUD / UI — CURRENT PROTECTED STATE

The approved combat HUD direction came from the owner-approved V6 prototype and was ported into runtime, then followed by a responsive/mobile pass.

Desktop intent:

`P1 PANEL | SQUARE ARENA | P2 PANEL`

Hierarchy per side:

1. fighter identity + HP
2. RECENT PRESSURE / live burst
3. CURRENT LOADOUT with real weapon art
4. ENERGY
5. quiet truthful mode/footer information

Visual principles:

- matte graphite / dark panels;
- P1 cool cyan family;
- P2 warm orange/red family;
- clear typography hierarchy;
- actual weapon art;
- restrained effects;
- no fake ammo;
- no unnecessary debug-dashboard clutter.

Responsive/mobile work is already in production.

Do not “fix mobile SFX” by touching HUD layout, scale, typography, or battle-shell responsive breakpoints unless a causal dependency is proven.

---

# 12. PERFORMANCE / QUALITY BOUNDARY

Do not solve performance by reducing accepted product quality.

Do not casually reduce:

- V1 blood density/identity;
- weapon art quality;
- accepted VFX;
- SFX identity;
- arena resolution;
- combat HUD readability.

Optimize lifecycle/caching/allocation first.

Known existing optimization concepts include:

- chamber background caching;
- DOM HUD cached refs / bounded writes;
- pooled blood/popups;
- no per-frame image decode/creation;
- no per-frame full DOM rebuild.

---

# 13. SFX / AV SYSTEM — CURRENT ARCHITECTURE

This section matters for the first task.

Relevant production files:

- `public/game/core/apexBattleAudioRuntime.js`
- `public/game/core/apexBattleSfxRuntime.js`
- `public/game/arsenal/arsenalPresentationRuntime.js`
- `public/game/arsenal/arsenalWeaponRuntime.js`
- `public/game/modes/arsenalQuestRuntime.js`
- `src/App.jsx`
- `src/game/runtimeManifest.js`

Relevant assets:

- `public/assets/arsenal/av/sfx/...`
- gun fire baseline:
  - `sfx/guns/cz.wav`
  - `sfx/guns/sks.wav`
  - `sfx/guns/shotty.wav`
  - `sfx/guns/mosin.wav`
- C1 final melee / mechanism SFX under:
  - `public/assets/arsenal/av/sfx/c-final/...`
- pickup/casing/shell audio under:
  - `public/assets/arsenal/av/sfx/feel/...`

The desktop/browser test suite has verified:

- audio assets exist and preload;
- AV map completeness;
- image/audio asset failures are not present in ordinary browser CI;
- intended SFX cues are scheduled.

The currently reported bug is specifically:

> **on mobile platform, battle SFX are not audible during the match.**

Do not assume missing files because desktop/CI AV asset preload is already green.

---

# 14. FIRST TASK FOR THE NEW CHAT — MOBILE BATTLE SFX

This is the first task. Do this before proposing other work.

## Owner report

**Mobile platform has no SFX during battle.**

The rest of the game is relatively complete, so investigate narrowly and preserve current production.

## Required first action

Audit exact production:

`playtest/arsenal@5a9a4a1e8a5bc0b28077e9e6c8d7de42ac981009`

Do not begin from `main`.

Do not use an old Arena local checkout without fetching.

Prefer creating a dedicated work branch from exact production, for example:

`arena/mobile-sfx-fix`

Do not mutate `playtest/arsenal` directly until the fix is verified.

---

# 15. HIGH-PROBABILITY MOBILE SFX HYPOTHESES — NOT YET A VERDICT

These are evidence-based investigation leads from the current production code. They are **not** a confirmed root cause yet.

## Hypothesis A — WebAudio autoplay / user-gesture unlock

Current production creates the global WebAudio context at runtime load:

```js
var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
```

`ensureBattleAudioReady()` does:

```js
if (audioCtx.state === 'running') return;
audioCtx.resume()
```

However, it is normally called when an SFX is about to play.

On iOS Safari and some mobile browser conditions, `AudioContext.resume()` may need to occur **inside a direct user activation gesture**.

Many Arsenal sounds are triggered automatically after battle starts, not directly inside the original tap event.

This makes audio-context unlock the leading suspect.

## Hypothesis B — the UI action path deliberately delays execution

`src/App.jsx` menu handling currently applies a short timeout before `runApex(...)`:

```js
window.setTimeout(() => {
  runApex(...)
}, 105)
```

If mobile audio unlock depends on that later call, it is no longer synchronous with the original touch/click gesture.

This is a strong clue to audit.

## Hypothesis C — menu audio success does not prove Arsenal WebAudio is unlocked

The battle audio runtime patches `HTMLMediaElement.play()`, but Arsenal weapon SFX in `arsenalPresentationRuntime.js` use decoded WebAudio buffers and `AudioBufferSourceNode`.

Therefore:

- menu music may work;
- HTML `<audio>` may work;
- yet Arsenal WebAudio buffer SFX may remain silent if the context is suspended.

Do not conclude “audio is generally fine” just because menu music works.

## Hypothesis D — master gain lifecycle

`apexStopBattleAudio()` sets the battle master very low and later schedules restore.

Arsenal mode entry also calls:

`window.apexStopBattleAudio?.()`

before AV clear/preload and entering the battle.

The current runtime normally restores the master after ~80 ms, but the mobile investigation should verify:

- `battleAudioMaster.gain.value`
- whether restore actually occurs
- whether context is suspended at the time restore occurs

Do not rewrite this logic unless it is proven causal.

## Hypothesis E — buffer preload can succeed while playback is still blocked

`arsenalPresentationRuntime.js` preloads audio via:

- `fetch()`
- `decodeAudioData()`
- cached `AudioBuffer`s

This can succeed even if actual playback remains blocked/suspended.

So `audioLoaded` / `audioFailed=0` is useful but not enough.

---

# 16. MOBILE SFX DIAGNOSTIC CHECKLIST

Before changing production behavior, capture these states on the affected mobile browser/device.

## Audio context state

Log / inspect:

- `audioCtx.state` immediately after page load
- `audioCtx.state` inside the first real touch/pointer event
- state after entering Arsenal Hub
- state after fighter selection
- state when battle starts
- state immediately before first expected SFX
- state after `audioCtx.resume()` resolves/rejects

Expected healthy state during battle:

`running`

## Master bus

Inspect:

- `battleAudioMaster.gain.value`
- whether scheduled/cancelled gain automation leaves it near `.001`
- whether `restoreBattleAudio()` runs after the battle-start stop call

## Arsenal AV runtime stats

Inspect if available:

`window.APEX_ARSENAL_AV.stats`

Useful fields include:

- `audioLoaded`
- `audioFailed`
- `played`
- `scheduled`
- `throttled.notReady`
- per-cue scheduling / active voice counts

Questions:

- are cues being emitted?
- are clips loaded?
- is `played` incrementing?
- are they being skipped as notReady?
- is the context suspended despite `played` intent?

## Network / decode

On real mobile/devtools if possible:

- verify SFX requests return 200;
- verify MIME/byte ranges are sane;
- verify no CORS/content-type decoding failure;
- verify `.wav` and `.ogg` behavior on the affected browser.

## Platform split

Determine whether the problem is:

- iOS Safari only;
- iOS all browsers (WebKit policy);
- Android Chrome;
- all mobile browsers.

Do not claim a universal mobile root cause from desktop responsive emulation.

---

# 17. LIKELY MINIMAL FIX IF GESTURE UNLOCK IS CONFIRMED

Only do this after diagnosis confirms the context stays suspended because no valid user-gesture unlock exists.

Preferred direction:

- add one small, centralized audio-unlock mechanism;
- listen to a trusted first user gesture such as `pointerdown`, `touchend`, and/or keyboard activation;
- inside that event, call `audioCtx.resume()` synchronously;
- optionally perform the smallest silent WebAudio warm-up required by iOS/WebKit if testing proves it necessary;
- remove/unregister one-shot listeners after the context is running;
- keep the existing battle master / preload / AV cue architecture.

Do NOT:

- convert every SFX to separate HTML `<audio>` objects;
- duplicate the audio engine;
- change SFX files, cue mapping, volumes, or timing just to work around unlock;
- add audible “unlock sounds”;
- change gameplay;
- change HUD or responsive layout;
- change blood.

The target is platform compatibility, not a new audio design.

---

# 18. MOBILE SFX ACCEPTANCE CRITERIA

A mobile SFX fix is not accepted merely because desktop CI is green.

Minimum acceptance:

1. Desktop remains unchanged.
2. Existing headless/browser product gates still pass.
3. On the affected real mobile platform:
   - first meaningful battle sound is audible after user activation;
   - gun fire SFX audible;
   - pickup/equip SFX audible;
   - melee/explosion where applicable audible;
   - repeated shots continue, not only first sound;
   - returning to menu and starting another match still works;
   - tab/background/foreground does not permanently mute battle audio.
4. No double playback.
5. No audible unlock pop/click.
6. No degradation of existing menu music lifecycle.
7. No new console unhandled rejection from `AudioContext.resume()` or playback.

If possible test at least:

- real iPhone/iOS Safari or the owner’s affected iOS device;
- real Android Chrome if the bug is claimed to be cross-mobile.

Responsive desktop browser emulation is **not sufficient** to validate mobile autoplay policy.

---

# 19. SFX IDENTITY IS ALREADY APPROVED — PROTECT IT

The Arsenal presentation layer has curated cue mappings for:

- telegraph
- reveal
- pickup
- pistol / SMG / shotgun / sniper gunfire
- pistol mechanism
- shotgun rack
- sniper chamber / bolt
- battle axe
- spiked club
- dagger
- sabre
- spear
- shields
- grenade explosion
- casing/shell lands
- ricochet
- NEWBIE dash/fail

Do not swap these out as part of a platform-unlock bug.

This is a transport/playback-lifecycle task first, not an SFX sourcing task.

---

# 20. IMPORTANT SOURCE FILES FOR FIRST TASK

Start here:

## `public/game/core/apexBattleAudioRuntime.js`

Contains:

- global `audioCtx`
- `battleAudioMaster`
- HTMLMediaElement registration/patch
- `restoreBattleAudio()`
- `fadeBattleAudio()`
- `stopBattleAudio()`

## `public/game/core/apexBattleSfxRuntime.js`

Contains:

- `ensureBattleAudioReady()`
- synthesized fighter SFX
- WebAudio noise/tone helpers

## `public/game/arsenal/arsenalPresentationRuntime.js`

Contains:

- curated Arsenal SFX mapping
- `loadAudio()` via fetch/decodeAudioData
- `playEntry()` via `AudioBufferSourceNode`
- `playAll()` / delayed cues
- semantic `avCue()` dispatch
- AV runtime stats

## `public/game/modes/arsenalQuestRuntime.js`

Mode start currently includes:

- `window.apexStopBattleAudio?.()`
- Arsenal AV clear/preload
- game state transition to `ARSENAL`

Audit audio lifecycle around this transition.

## `src/App.jsx`

Important for:

- menu music lifecycle
- `runApex(...)`
- deferred runtime loading
- `apexStopBattleAudio()` calls
- the ~105 ms delayed menu button action path
- touch/pointer activation context

## `src/game/runtimeManifest.js`

Confirms battle audio/SFX runtimes load at boot before Arsenal deferred runtimes.

---

# 21. DO NOT REGRESS THESE WHILE FIXING MOBILE SFX

Explicit freeze list:

- production responsive battle shell
- real pointer/touch controls
- Arsenal Hub / Shop / Draw / Quest Map responsiveness
- V6-derived battle HUD hierarchy
- actual weapon art
- HP=1000
- x7 Arsenal equipment damage
- firearm crit behavior
- 4.5s spawn law
- offensive cap=5
- heal values / 800 HP eligibility
- AC economy / rewards
- current picker law
- V1 blood visual identity
- V1 fresh-tick splatter correction
- damage number semantics
- weapon sizing / muzzle/casing anchor math
- C1 SFX cue mapping / volume identity
- Cloudflare production branch/link

If a fix proposal touches any of these, explain why it is causally necessary before editing.

---

# 22. DEVELOPMENT / PROMOTION WORKFLOW FROM HERE

For a focused bug like mobile SFX:

1. Fetch production exact SHA.
2. Create a narrow work branch from production.
3. Reproduce / instrument.
4. Establish root cause.
5. Make minimum change.
6. Run focused tests first.
7. Owner checks affected mobile device.
8. Run final full Arsenal tests/build/browser smoke.
9. Only then merge/promote exact accepted tree into `playtest/arsenal`.
10. Keep the same Cloudflare production link.

Do not promote an untested experiment directly.

---

# 23. ABOUT ARENA AGENT PROMPTS

If using an already-active Arena session:

- use a small micro-prompt;
- do not resend this entire handoff repeatedly;
- do not ask it to re-audit the whole project after each tiny correction;
- pin exact branch/SHA and task scope;
- stop it from broad refactors.

For a genuinely new Arena chat, give it this handoff or the essential zero-context bootstrap once.

Important recurring problem:

Arena local refs/workspaces may be stale, reset, or partially re-synced.

Therefore:

> remote Git exact SHA is source of truth, not previous local workspace memory.

---

# 24. EVIDENCE / ACCEPTANCE PHILOSOPHY

Do not accept “done” from Agent prose alone.

For meaningful changes verify:

- exact SHA
- lineage
- changed files
- build
- headless gates
- real-browser gates when applicable
- evidence relevant to the actual bug
- owner playtest for visual/game-feel/device-specific issues

But also do not waste time on full CI before proving a tiny fix actually solves the owner’s problem.

Use:

> focused proof first → owner/device confirmation → full final validation

---

# 25. CURRENT KNOWN OPEN ITEMS

## Open now

**Mobile battle SFX missing / silent.**

This is the immediate first task.

## Deferred / only revisit if owner asks

- further blood-feel analysis or tuning;
- any new combat HUD redesign;
- broad UI re-art-direction;
- new content/features/balance changes.

The current game is considered relatively complete.

---

# 26. RECOMMENDED FIRST MESSAGE / ACTION IN THE NEW CHAT

The new chat should not ask the owner to repeat the project history.

After reading this file, it should do something equivalent to:

> I’ve read the handoff. I’ll treat `playtest/arsenal@5a9a4a1e8a5bc0b28077e9e6c8d7de42ac981009` as the recorded production baseline, fetch live Git to confirm it, and keep completed gameplay/UI/blood/SFX identity frozen. The first task is only to diagnose why battle SFX are silent on mobile, starting with the WebAudio unlock/context/master-gain lifecycle on the production code before changing anything.

Then actually fetch/audit Git and proceed.

---

# 27. QUICK CHECKSUM

## Production

`playtest/arsenal@5a9a4a1e8a5bc0b28077e9e6c8d7de42ac981009`

## Implementation tree

`b0e42de773a504e4097c09ecc315518c8d8e7db9`

## Implementation parent with same tree

`e004033436884ee293689d1d5c6f1ec170c1ec4a`

## Git `main`

Historical / not production at handoff creation:

`116d5be2e3993f21407b1f30c27e0623c7e91992`

## First task

**Why mobile battle platform has no SFX.**

## Leading suspicion

**WebAudio context is created before user gesture and is only resumed later when a sound tries to play; on mobile this may occur outside the trusted activation window.**

Also audit:

- battle master gain lifecycle;
- duplicate `apexStopBattleAudio()` calls;
- preload/decode state;
- actual mobile browser policy;
- `runApex` 105 ms delayed action path.

## Do not touch unless explicitly requested

Gameplay balance, V1 blood, HUD art direction, responsive layout, weapon art, meta economy, spawn law, Cloudflare link.

---

# END OF HANDOFF