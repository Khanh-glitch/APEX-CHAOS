# APEX CHAOS // POST-PASS-1 NEXT EXECUTION PLAN

**Date:** 2026-09-25
**Game branch:** `arena/01a0cf5e-apex-chaos`
**Current game tip:** `3c20fa3814e0d5889f2714d1dec6969752c20396`
**Performance Pass 1 implementation:** `4c9b2326ee7ac3e9e04579601a0ad09342eefc21`
**Performance Pass 1 evidence:** `3c20fa3814e0d5889f2714d1dec6969752c20396`
**Pass 1 CI:** `36085716873` — 158/158 headless, 95/95 browser
**Playtest remains:** `2113e92c42739eeb568794117a19526aa4a4725d`
**Main remains:** `ee4420f27882bc0ea15a844a0fc915d1af43c426`

## Owner observation after Pass 1

The obvious hitching/judder is materially improved, but motion still does not feel fully smooth.

Treat this as:
- Pass 1 successfully removed known waste;
- smoothness work is NOT complete;
- do not claim an FPS win without owner-device frame data.

Do not cap FPS or reduce gameplay/VFX as a shortcut.

---

# Phase A — close missing physical audio feedback first

This is a small, high-confidence correction and should land before adding new visual systems.

## A1. Casing/hull landing sound is currently broken by a semantic key mismatch

Current audio bank contains:

`casing_drop -> sfx/impact/impactPlate_light_001.ogg`

But runtime landing cue executes:

`playAll('casing_land', { vol: o.vol })`

There is no `AUDIO.casing_land` entry.

Result:
- landing instrumentation can increment;
- no audible sample is scheduled/played.

### Required fix

Use one canonical semantic name. Prefer:

`casing_land`

and map it to:
`sfx/impact/impactPlate_light_001.ogg`

Do not play it at casing spawn.

Play once on the first meaningful floor contact.

Hull landing may use the same baseline initially with a slightly heavier volume/rate treatment, or a suitable existing light/soft impact if browser audition proves better.

## A2. Detached gun floor contact currently has no SFX cue

`tickDetachedWeapons()` detects the first floor bounce but only changes velocity.

Add a single `weapon_land` cue on the first floor contact.

Use existing approved impact assets first; no new download is required until owner audition says the current library is inadequate.

Suggested mass mapping:

- LIGHT: pistols / compact SMGs
  - `impactMetal_light_002.ogg`
- MEDIUM: rifles / ordinary shotguns / DMRs
  - `impactMetal_medium_002.ogg`
- HEAVY: M249 / Snipex / Jackhammer / very heavy long guns
  - `impactMetal_heavy_002.ogg`

Optional low-volume body layer for heavy weapons only:
- `impactPunch_medium_001.ogg`

Rules:
- one landing sound per detached gun;
- velocity-sensitive volume within a narrow range;
- capped polyphony;
- no sound merely because the exit animation starts;
- no repeated sound on every bounce.

### Required proof

Browser/instrumented:
- casing spawn => zero landing plays;
- casing first floor contact => exactly one play;
- hull first floor contact => exactly one play;
- pistol detached first floor contact => exactly one LIGHT play;
- AK/SPAS detached first floor contact => exactly one MEDIUM play;
- M249/Snipex detached first floor contact => exactly one HEAVY play;
- subsequent bounce => no second gun-land play.

Owner speaker audition remains required for final volume/timbre approval.

---

# Phase B — Smoothness Pass 2A: remove render cost without reducing visible content

Do this BEFORE damage numbers/heal popups so new UI does not hide the performance baseline.

## B1. Cache rarity under-light

Current revealed pickups rebuild radial gradients / blur-style lighting every frame.

Required:
- pre-render T1–T5 under-light sprites;
- use a small quantized pulse set if pulse animation must remain;
- preserve the current single-under-light visual law;
- no runtime `shadowBlur` in the normal pickup hot path;
- no loss of tier color/readability.

## B2. Optimize particle lifecycle/draw path without reducing particle count yet

Pass 1 browser sample reached ~190 particles.

First optimize implementation cost, not visual density.

Required:
- add/reuse bounded Particle object pooling where safe;
- replace avoidable allocation churn in hot emission paths;
- reduce redundant per-particle canvas state save/restore when visually equivalent;
- batch simple same-style particles only where output is materially identical.

Do NOT lower effect counts in Pass 2A.

If owner-device performance remains poor after this, a later priority budget can be considered with explicit owner review.

## B3. Frame-pacing diagnosis

The engine loop is variable-dt rAF with a 33ms dt clamp.

Do not change simulation timing yet.

Extend the performance report with frame-interval buckets sufficient to distinguish:
- stable ~16.7ms presentation;
- recurring 20–33ms frames;
- occasional >50ms spikes.

If owner-device p95 becomes good but motion still feels visually stepped, THEN audit movement/render interpolation separately.

Do not introduce a fixed 30 FPS cap.

## B4. Owner-device acceptance

After Pass 2A owner playtest, collect:
- `apexPerfSummary()`
- `apexArsenalPerfSummary()`

Compare:
- avg;
- p95;
- max;
- slowFrames;
- longTasks;
- pickupDraw;
- arsenalVfxDraw;
- total Arsenal frame section.

---

# Phase C — damage-number readability

Implement only after Smoothness Pass 2A is measured.

## Canonical approved sheet

Owner approved the second uploaded sheet:
`damage1.png`

Source dimensions:
- 240×160 RGBA

SHA-256:
`1bf34f7b97c8385dcfb2bdc6be576212898b937f243addf031992b2aa1832149`

Use the sharp/clean glyph row family from this sheet.

Do not use legacy `FloatingText`.

Create a separate bounded/poolable glyph-atlas renderer.

## Rules

- normal damage: white;
- heavy/major hit: gold/yellow;
- healing number: green;
- **MISS: show only `MISS`; never show 0, -0, MISS 0, or any numeric companion.**

Aggregation:
- semi / sniper / melee / grenade: one popup per resolved hit;
- automatic fire: merge same-target hits in a short ~80–140ms window;
- shotgun/autoshot: one total per attack transaction, never one popup per pellet.

Damage numbers are a narrow exception to the no-battlefield-typography rule.

No weapon names, labels or prose inside the arena.

---

# Phase D — five heal pickup visuals

The owner-approved visual family is frozen in the asset vault manifest:

Repository:
`Khanh-glitch/APEX-CHAOS-ASSET-VAULT`

Asset branch:
`arena/01a0cf5e-apex-chaos-assets`

Manifest:
`docs/HEAL_PICKUPS_V1_MANIFEST.md`

Manifest commit:
`474983d74f6f0a149a0b0a0f12dfd2775661755e`

Approved identities:
1. H1 — field dressing / gauze
2. H2 — medication bottle + blister
3. H3 — auto-injector / med stim
4. H4 — IV / life-support fluid pack
5. H5 — advanced trauma hard case

The source masters are 1254×1254 RGBA.

Binary Git transfer of these generated files is currently pending a normal filesystem/Git path. The manifest freezes exact filenames and SHA-256 hashes.

## Important code finding

The current Arsenal runtime inspected at the Pass 1 tip does NOT expose a five-entry health-pickup table or five explicit restore amounts.

Therefore:
- do not invent heal amounts;
- locate the owner's existing five restore values if they live in a newer/unmerged source;
- if no such implementation exists, stop and ask for/freeze the H1–H5 heal values before gameplay implementation.

Visual mapping can proceed independently.

## Runtime asset prep

When binaries enter the repo:
- crop transparent padding;
- preserve alpha;
- derive runtime-sized PNG/WebP variants based on actual floor size;
- keep source masters in the asset vault;
- do not draw 1254px masters directly every frame if a smaller derived asset is sufficient.

---

# Recommended execution order

1. **A — physical audio patch**
2. **B — Smoothness Pass 2A**
3. owner-device performance check
4. **C — damage-number renderer**
5. **D — heal pickup visuals + health-restore integration once exact H1–H5 values are verified**

Reason:
- audio correction is tiny and currently objectively broken;
- performance should be stabilized before adding popup rendering;
- damage feedback should be visible before any weapon rebalance;
- heal visuals are frozen, but heal gameplay values must not be invented.

---

# Weapon balance rule

Do NOT rebalance the arsenal in these phases.

First add damage readability and realized-damage telemetry.

Then compare realized damage per pickup/transaction by weapon and tier before widening/narrowing power bands.

---

# Git law

Work only on:
`arena/01a0cf5e-apex-chaos`

Do not move:
`playtest/arsenal`

Do not modify:
`main`

Asset masters belong in the Asset Vault; game repo receives curated runtime derivatives only.
