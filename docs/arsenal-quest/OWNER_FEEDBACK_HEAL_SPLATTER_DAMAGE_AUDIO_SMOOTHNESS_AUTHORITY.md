# APEX CHAOS — OWNER FEEDBACK PASS: HEALS + SPLATTER + DAMAGE READABILITY + PICKUP AUDIO + SMOOTHNESS

**Date:** 2026-09-25
**Game repo:** `Khanh-glitch/APEX-CHAOS`
**Authorized branch:** `arena/01a0cf5e-apex-chaos`
**Prepared from audited live tip:** `db422853e7a399d7114abe04439af171408cacfa`
**Status:** OWNER-FEEDBACK AUTHORITY — supersedes earlier unresolved heal-value blocker for this branch.

This is a focused quality pass. Preserve all accepted Revision 2 / Quest / asset-closure work unless explicitly superseded here.

## 0. Owner feedback being solved

The owner reports five real playtest problems:

1. Heal pickups never appear in actual gameplay.
2. Current persistent damage stains look bad / artificial.
3. Damage numbers are effectively white/black and disappear against the light Chamber floor.
4. Several pickup-ready/reload cues are badly trimmed: some have audible trigger delay, some end too early.
5. The game still does not feel smooth despite prior cache/pooling work.

Green tests from previous runs do not override these owner-visible failures.

---

# 1. HEAL GAMEPLAY — NOW AUTHORIZED

Previous authorities intentionally kept heal gameplay disabled because no exact restore table existed.
The owner has now explicitly asked to finish the heal system. This file defines the new restore authority.

## 1.1 Exact restore values

Match HP remains 100.

Use exactly:

| ID | Identity | Restore |
|---|---|---:|
| H1 | Field Dressing | 10 HP |
| H2 | Medication | 18 HP |
| H3 | Auto-injector | 28 HP |
| H4 | IV / life-support pack | 40 HP |
| H5 | Trauma hard case | 55 HP |

Rules:
- no overheal from pickups;
- actual heal = `min(restore, maxHp - hp)`;
- dead fighters cannot collect;
- full-health fighters cannot consume/waste a heal;
- popup shows the **actual** restored amount, not the nominal tier amount;
- health transaction must update HUD immediately.

This supersedes `restore:null` / `healGameplayEnabled=false` for pickup gameplay.

## 1.2 Heal spawn must be separate from offensive spawn law

Do **not** put heals into the both-unarmed fast-path.
That fast-path must remain an offensive pickup guarantee.

Do **not** reduce or dilute the existing normal offensive 3.0s cadence.

Implement an independent support-heal lifecycle:

- maximum active heal pickups: **1**;
- a heal becomes eligible when at least one living fighter is at or below **80 HP**;
- if eligible, no heal is active, and heal cooldown is ready, spawn one heal support pickup;
- first eligible spawn may happen immediately once the threshold is crossed;
- after a heal support pickup spawns, start a **9.0s** heal-spawn cooldown;
- support pickup lifetime: **12s**;
- cooldown may continue while a heal is active, but never allow >1 active heal;
- heal slots do not consume `MAX_ACTIVE_SLOTS` for offensive pickups;
- use the existing safe arena placement grammar / spacing logic rather than inventing a second coordinate system.

Tier selection weights:

`H1:H2:H3:H4:H5 = 7:5:3:2:1`

Use the existing injected RNG/testability conventions.

## 1.3 Heal pickup presentation

Heal pickups are support items, not hidden weapons.

- spawn **visibly revealed** using the five real runtime sprites;
- no question-mark/weapon hidden identity phase;
- no battlefield text label;
- use a restrained medical/support pulse/under-light so the pickup is noticeable on the light floor;
- preserve the actual H1–H5 silhouette as the primary identity;
- armed fighters may collect heals;
- collection is proximity/collision based;
- if both fighters overlap, only an injured eligible fighter may consume it.

On pickup:
- remove the heal slot exactly once;
- perform the real heal transaction;
- emit one green `+N` atlas popup using actual restored HP;
- small support pickup cue/VFX may be reused from existing game assets; do not source new audio unless required.

---

# 2. DAMAGE SPLATTER — REPLACE THE GEOMETRIC BLOB LOOK

Current implementation is functionally correct but visually wrong: its ellipse core + ellipse streak dominate the organic source and read as code-drawn decals.

Keep:
- victim-color identity;
- persistent offscreen stain surface;
- one historical composite draw per frame;
- short pooled spray;
- reset-on-new-match;
- no splatter on MISS/zero/DoT spam.

Change the visual construction.

## 2.1 Organic mask must be the dominant shape

Use `public/assets/fang_v1/speckBlood.webp` as the dominant irregular alpha language.

Each persistent impact should be built primarily from:
- one main irregular speck/mask stamp;
- optionally one smaller overlapping irregular stamp with independent rotation/anisotropic scale;
- victim-color-derived dark liquid tint;
- asymmetric satellite droplets;
- a directional smear/streak only when impact direction warrants it.

The old obvious central ellipse must not be the visible primary stain.
Do not create a recognizable oval/capsule blob.

If a dense core is needed, derive it from a second organic mask or an irregular path, not a perfect ellipse.

## 2.2 Liquid depth

For victim RGB:
- main body: hue-preserving darkened color;
- dense areas: darker;
- wet/thin edge and small droplets: closer to original fighter hue;
- vary alpha and size;
- avoid flat neon stickers.

## 2.3 Family-specific silhouette

Preserve a coherent family language while varying footprint:

- pistol/semi: compact asymmetric impact with a short directional fan;
- auto/burst: smaller layered specks; aggregate close hits;
- shotgun/autoshot: wider fan/scatter, not one giant disk;
- precision/heavy: longer directional tear/streak with a stronger irregular core;
- melee: short directional smear/arc with droplets;
- blast/grenade: more radial organic distribution.

Stain scale remains bounded and sub-linear with realized damage.

## 2.4 Owner-visible evidence

Static existence is not enough.
Browser evidence must include normal-scale frames for:
- pistol/semi;
- auto;
- shotgun;
- precision/heavy;
- melee;
- at least two differently colored victims;
- accumulated floor history.

The effect must be judged as a composition on the actual Chamber floor, not as an isolated debug canvas.

---

# 3. DAMAGE NUMBER READABILITY — NEW PALETTE

The owner rejects the current white/black damage look on the light-gray floor.

Keep the canonical `damage1.png` glyph shapes, aggregation rules, MISS-only law and bounded/poolable atlas architecture.

## 3.1 Palette

Use cached tinted glyph variants so tinting is not rebuilt per popup.

Normal damage:
- primary: **#FF5A36** (warm vermilion)
- dark edge/shadow: approximately **#4A1710**

Heavy / major:
- primary: **#FFC247**
- dark edge/shadow: approximately **#5A3A00**

Heal:
- primary: **#38E07A**
- dark edge/shadow: approximately **#0B4C2A**

MISS:
- primary: **#465361**
- use a subtle light edge/halo so it remains legible on both center lift and darker edge floor.

These colors are presentation authority for this Chamber palette.

## 3.2 Rendering

- preserve atlas glyph silhouette;
- create tinted/cached atlas rows or glyph surfaces at preload/build time;
- do not run expensive per-frame source-in recoloring for every popup;
- use a compact edge/shadow/halo sufficient for contrast;
- do not fall back to generic Impact text when the atlas is loaded;
- normal damage must no longer read as white/black.

Existing aggregation remains:
- semi/sniper/melee/grenade: resolved transaction popup;
- auto/burst: short aggregation;
- shotgun/autoshot: attack-total popup;
- MISS = `MISS` only, no number.

---

# 4. PICKUP-READY AUDIO — RECUT FOR TRIGGER FEEL

The previous pass proved source correctness but the owner reports poor edit feel.
Source correctness is not acceptance.

Re-audition **every pickup-ready cue at gameplay trigger time**, including:
- pistol family;
- all newly derived SMG/rifle cues;
- shotgun family;
- sniper readiness/chamber sequence.

Do not alter gunshot/fire audio.

## 4.1 Trim law

For every cue:
- remove perceptible pre-silence / dead air before the first meaningful mechanical transient;
- leave only a tiny safety pre-roll if needed to avoid clipping the attack;
- the first meaningful transient should feel immediate when pickup occurs;
- do not cut before the complete intended mechanical gesture finishes;
- preserve the audible tail/decay until it feels naturally complete;
- use a very short edge fade only when needed to prevent clicks;
- do not hide bad trims with delayed playback or lower volume.

Do not use one fixed duration for all cues.
Each derivative is cut around its own transient structure.

## 4.2 Verification and cut map

Waveform inspection alone is insufficient.
For each final derivative:
1. inspect the waveform/onset;
2. listen to the isolated derivative;
3. listen to it fired from the actual pickup event in browser;
4. check perceived latency and tail completion.

Update `docs/arsenal-quest/GUN_PICKUP_AUDIO_CUT_MAP.csv` with final exact timestamps and durations.

Final report must call out any cue whose timestamp changed.

---

# 5. SMOOTHNESS PASS — DIAGNOSE FRAME PACING, DO NOT REDUCE QUALITY

The owner still perceives the game as not smooth after prior caching/pooling.

The engine currently runs:
`requestAnimationFrame -> update(variable dt capped at 33ms) -> draw`

Existing deterministic 30Hz simulation tests do not prove owner-visible rAF smoothness.

## 5.1 Add real frame-pacing telemetry

Measure actual rAF intervals in a bounded rolling sample during real browser play.

Report:
- average frame interval;
- median;
- p95;
- p99;
- max;
- counts/percentages for:
  - <=16.7ms
  - >16.7–20ms
  - >20–25ms
  - >25–33ms
  - >33–50ms
  - >50ms
- long tasks when observable;
- existing section timings:
  - simulation
  - chamber
  - pickupDraw
  - foreground
  - arsenalVfxDraw
  - HUD/DOM where available
- peak particles/shockwaves/projectiles/detached weapons/Arsenal VFX.

Use a real-browser stress scenario with normal animation/rAF, not only a manually stepped 30Hz harness.

## 5.2 Quality law

Do not improve numbers by:
- reducing particle counts/lifetimes;
- weakening blood/splatter density;
- lowering animation FPS;
- lowering render resolution/DPR;
- disabling glow/smoke/muzzle/impact/rarity;
- shortening valid audio tails merely for performance;
- reducing audio quality/voices below accepted behavior;
- changing offensive/heal cadence;
- adding a 30 FPS cap or intentional frame skipping.

## 5.3 Decision tree

First fix measurable hot-path cost if frame pacing is unhealthy:
- avoid repeated large-image scaling;
- eliminate redundant canvas state churn;
- pool/reuse allocations;
- cache derived/tinted visuals;
- avoid repeated array churn where safe;
- preserve Chamber/rarity caches;
- keep historical stain as one composite surface;
- keep all visible/audible output perceptually equivalent or better.

If browser evidence shows healthy render cost / low spike rate but motion still visibly steps, the Agent is authorized to implement an **Arsenal-only render-smoothing/interpolation layer**.

Render smoothing must:
- be visual-only;
- never feed interpolated coordinates back into physics, collision, pickup logic, aim, damage or network/gameplay state;
- cover the visually dominant moving actors first: fighter centers + attached weapon pose; extend to fast projectiles/detached weapons only if required by evidence;
- preserve immediate gameplay responsiveness and avoid obvious trailing/lag;
- be easy to disable for A/B verification;
- include automated proof that authoritative simulation positions and collision results are unchanged.

Do not rewrite the global engine simulation architecture or convert the entire game to fixed timestep in this pass.

## 5.4 Evidence

Capture before/after frame-pacing report from the same browser stress scenario.

If the Agent cannot reproduce owner-device pacing, report that honestly. CI/browser metrics are evidence, not owner-device proof.

---

# 6. Regression protection

Preserve:
- both-unarmed immediate offensive spawn and cap-pending correction;
- offensive 3.0s cadence;
- 30 offensive item roster;
- melee weighting and +50% law;
- shield contextual-only law;
- Quest progression/UI;
- weapon balance/damage;
- Chamber light-floor cache;
- rarity cache;
- damage aggregation and MISS-only law;
- casing first-contact semantics;
- all accepted pickup-ready source identities;
- no gun-body drop SFX;
- no legacy Arsenal FloatingText revival.

Do not modify `main`.
Do not move `playtest/arsenal`.

---

# 7. Required automated/runtime gates

Add real gates, not config-only assertions.

## Heal
- threshold does not spawn at 100/100;
- injured <=80 triggers one support heal when cooldown ready;
- max one active heal;
- heal does not consume offensive slot cap;
- armed injured fighter can collect;
- full-health fighter cannot consume;
- actual HP increase equals clamped tier value;
- no overheal;
- green `+actual` atlas popup occurs;
- support cooldown prevents immediate respawn;
- all five identities can be forced deterministically through injected RNG.

## Splatter
- positive realized direct damage -> one logical splatter transaction;
- MISS/zero/DoT default -> none;
- organic mask path used;
- persistent surface resets correctly;
- aggregation remains bounded.

## Damage numbers
- normal atlas popup resolves to vermilion cached variant;
- heavy to amber cached variant;
- heal to green cached variant;
- MISS to slate variant and contains no numeric transaction;
- no generic white normal popup in the atlas-ready path.

## Audio
- every pickup family resolves to a real final derivative;
- final derivatives exist in manifest;
- browser pickup event schedules the expected buffer;
- no stale blocked/fallback cue for pistol/rifle families.

## Smoothness
- rolling rAF frame report works in browser;
- before/after report captured;
- if render smoothing is enabled, simulation/collision state is unchanged under deterministic comparison.

---

# 8. Execution lifecycle

Before editing:
1. fetch live Arena branch;
2. verify this authority is the current tip or compatible descendant;
3. run fresh baseline headless + build + browser;
4. capture PRE-PASS browser frame-pacing report and representative screenshots/audio behavior.

Implementation checkpoints:
1. **OWNER FEEDBACK FEATURE COMPLETE** — heal + splatter + damage palette + audio recut.
2. **SMOOTHNESS COMPLETE** — performance/frame-pacing fixes after full feature workload.
3. evidence refresh.

Do not mix feature and smoothness changes into one opaque commit.

---

# 9. Final report

Return:
- fetched starting SHA;
- feature SHA;
- smoothness SHA;
- evidence SHA;
- CI run id/status;
- headless/browser pass counts;
- Vite status;
- exact heal values + spawn behavior + observed pickup proof;
- splatter architecture changes + browser evidence;
- damage palette and atlas-cache proof;
- every final pickup-ready cut timestamp/duration and changed cuts;
- pre/post real-browser frame-pacing table;
- whether render interpolation/smoothing was needed and exactly what is visual-only;
- proof no VFX/SFX quality was intentionally reduced;
- genuine blockers only.

Do not promote playtest.
Do not touch main.
