# APEX CHAOS — PASS B VISUAL / SYSTEM PROTOTYPE AUTHORITY
## Universal Combat HUD + Damage Commentary + Energy Telemetry + Damage Typography
**Date:** 2026-09-25
**Status:** standalone prototype authority — NOT production integration
**Owner:** APEX CHAOS

---

# 0. PURPOSE

Build a high-fidelity standalone interactive prototype that proves the next APEX combat information architecture before any production integration.

This branch exists so PASS B can run in parallel with PASS A without merge conflicts.

PASS B MUST NOT edit current production gameplay/runtime/UI files.

The prototype must let the owner FEEL and compare:
1. the new universal battle HUD layout;
2. damage commentary behavior;
3. energy telemetry behavior;
4. clearer damage-number typography and scale.

The prototype is a design/system proof, not a generic mockup.

---

# 1. BRANCH / SCOPE LAW

Repository:
`Khanh-glitch/APEX-CHAOS`

Dedicated prototype branch:
`prototype/combat-hud-pass-b`

Starting authority SHA:
`b3edda0aacb74abbe2509e84572f70c14a0505de`

PASS A is simultaneously being implemented elsewhere.

Therefore PASS B MUST NOT modify:
- `src/App.jsx`
- `src/styles.css`
- `public/apexEngine.js`
- `public/game/**`
- `tools/testArsenalQuestHeadless.mjs`
- `tools/testArsenalQuestRuntime.mjs`
- any current production asset/runtime file.

Allowed new files only:
- `public/prototypes/combat-hud-pass-b/**`
- `docs/arsenal-quest/pass-b/**`

Do not merge or promote this branch automatically.

---

# 2. OWNER INTENT

The owner wants the combat screen for ALL modes, not only Arsenal, to use desktop space much better.

Current problems:
- square arena is the main content but current HUD sits above it and side space is underused;
- current damage numbers are too large and some digits are hard to read;
- the owner wants short commentary-style lines based on each fighter's recent damage output;
- the owner wants a future energy resource that builds through combat and can later power skills;
- the owner does NOT want a dense dashboard that distracts from the fight.

PASS B must prove these ideas visually and behaviorally before they touch gameplay.

---

# 3. REFERENCE STACK — LEARN SPECIFIC THINGS ONLY

## 3.1 IKEMEN GO
Repository:
`ikemen-engine/Ikemen-GO`

Study:
- `src/fightscreen.go`
- `data/functions.zss`
- `data/action.zss`

Learn:
- LifeBar / PowerBar / combo / action-message as separate HUD subsystems.
- deterministic combat-state detection feeding short HUD actions.
- mirrored P1/P2 semantics.

Do NOT copy:
- MUGEN visual styling;
- top-of-screen layout;
- spritepack format;
- code.

## 3.2 FightersParadise
Repository:
`fakoli/FightersParadise`

Study:
- `crates/fp-ui/src/renderer.rs`
- `MatchHudState`
- `ScreenpackHud`
- `combo_text`
- power / power_max integration

Learn:
- clean `combat state -> small HUD state -> renderer` boundary;
- HUD renderer should not own gameplay rules;
- life/power/name/combo are renderer inputs;
- pure/testable presentation helpers.

Core APEX design law to learn:

```
combat engine
     ↓
UniversalCombatHudState
     ↓
Universal HUD renderer
```

Do NOT copy Rust implementation or MUGEN layouts.

## 3.3 Parrot2
Repository:
`nebularg/Parrot2`

Study:
- `Code/CombatEvents.lua`
- `Data/TriggerConditions.lua`
- throttle / merge behavior

Learn:
- combat-event registry;
- condition-driven classification;
- merge window;
- suppression / anti-spam;
- event priority.

Use architecture only. Do not copy LGPL source.

## 3.4 PixiJS
Repository:
`pixijs/pixijs`

Study:
- BitmapText docs
- BitmapFontManager
- `BitmapFontManager.NUMERIC`
- resolution / padding / dynamicFill patterns

Learn:
- pre-render glyphs once;
- update dynamic numeric text cheaply;
- numeric-only atlas;
- HiDPI-aware rasterization;
- tint semantic variants without rebuilding every string.

Do NOT add PixiJS to APEX.
The production direction remains Canvas/OffscreenCanvas using the same architectural idea.

## 3.5 PunchOut browser reference
Repository:
`justin-austria/PunchOut`

Study:
- energy meter state
- action consumes resource
- successful defensive action restores resource

Learn only:
- meter must represent real combat events/actions, not decorative timer fill.

Do not copy UI or DOM implementation.

---

# 4. PROTOTYPE DELIVERABLE

Create:

`public/prototypes/combat-hud-pass-b/index.html`

The file should be directly runnable through the existing dev server.

It must be a polished interactive prototype, not wireframe boxes.

Also create:

`public/prototypes/combat-hud-pass-b/prototype.js`
`public/prototypes/combat-hud-pass-b/prototype.css`
`docs/arsenal-quest/pass-b/PASS_B_REFERENCE_AND_DECISION_LOG.md`

Do not edit existing production files.

---

# 5. LAYOUT AUTHORITY

## 5.1 Desktop battle shell

Primary desktop composition:

```
┌───────────────┬────────────────────────────┬───────────────┐
│   P1 PANEL    │                            │   P2 PANEL    │
│               │       SQUARE ARENA         │               │
│               │                            │               │
│               │                            │               │
└───────────────┴────────────────────────────┴───────────────┘
```

The arena remains the visual hero.

Side panels are supporting information surfaces, never giant opaque dashboards.

For common 16:9 desktop viewports:
- arena should use nearly all available viewport height;
- arena remains exactly square;
- side panels consume the remaining horizontal space;
- preserve breathing room around arena edges;
- center arena spatially.

Use CSS Grid.

Suggested geometry for prototype, not production law:
- outer padding: 16–24 px;
- side gap to arena: 14–20 px;
- side panel width should naturally resolve from remaining width;
- minimum useful side width: ~220 px;
- preferred desktop side width: ~260–360 px;
- arena size derived primarily from viewport height.

At narrower widths where side panels become unreadable, demonstrate ONE responsive collapse state below the arena rather than squeezing everything.

## 5.2 Side-panel hierarchy

Each side panel mirrors the other.

Order:

1. Fighter identity
   - fighter name
   - optional mode/status eyebrow
2. HP
   - large, instantly readable bar
   - numeric HP secondary, not dominant
3. Commentary / recent pressure
4. Energy meter
5. Mode-specific slot
   - prototype placeholder only
   - examples: weapon/rarity, skill cooldown, etc.

Do not add a dozen stats.

## 5.3 HP treatment

Prototype:
- P1 reads left-to-right toward the arena.
- P2 mirrors toward the arena.
- HP bar should visually point toward the arena/fighter.
- use delayed damage-ghost treatment as an OPTIONAL toggle for evaluation;
- ghost must be subtle and may not delay the authoritative real HP fill.

---

# 6. DAMAGE COMMENTARY AUTHORITY

This is NOT generative AI commentary.

It is deterministic classification from recent real combat events.

Prototype event shape:

```
{
  side,
  amount,
  critical,
  timestamp,
  sourceType
}
```

Per fighter keep a rolling recent-damage buffer.

Prototype default merge window:
**1.20 seconds**

Only show:
- 1 active commentary line;
- max 2 older fading lines.

No scrolling combat log.

## 6.1 Prototype classifications

Use percent of max HP so the logic is portable.

For prototype max HP = 1000.

Candidate rules:

- single hit >= 18% max HP:
  `DEVASTATING HIT`
- recent window damage >= 14% max HP:
  `HEAVY BURST`
- recent window damage >= 8% max HP OR >= 4 hits:
  `PRESSURE`
- >= 2 critical hits in one recent window:
  `CRITICAL RUN`
- if the previously losing side produces >= 12% max HP within the window after taking sustained pressure:
  `MOMENTUM SWING`

Priority:
DEVASTATING HIT
> CRITICAL RUN
> MOMENTUM SWING
> HEAVY BURST
> PRESSURE

If no threshold is met, do not generate filler commentary.

Display example:

`191 DMG · HEAVY BURST`

or

`266 · DEVASTATING HIT`

The commentary should feel like a fight broadcast accent, not a paragraph.

## 6.2 Anti-spam

Learn the concept from Parrot2:
- events within the merge window are accumulated;
- a higher-priority classification may replace/update the current line;
- do not emit one line per bullet;
- new lines should have a minimum visible dwell around 0.6–0.8 s.

Prototype should include controls to simulate:
- light pressure;
- rapid-fire pressure;
- critical chain;
- heavy single hit;
- momentum swing.

---

# 7. ENERGY TELEMETRY AUTHORITY — B1 ONLY

This prototype DOES NOT alter skill costs or current production skill behavior.

Energy is observational/telemetry in PASS B.

Range:
0–100.

Prototype gain:
- damage DEALT: `1 energy per 1% max HP dealt`
- damage TAKEN: `0.60 energy per 1% max HP taken`

With max HP 1000:
- deal 10 damage = +1 energy;
- take 10 damage = +0.6 energy.

Clamp to 100.

No passive gain.
No decay in this prototype.
No spend in B1.

Reason:
- offensive success remains primary;
- taking damage creates comeback resource;
- losing fighter gains less than the aggressor, avoiding a completely symmetric reward.

The UI must clearly differentiate:
- filling;
- full / READY state.

Use label:
**ENERGY**

Do not rename to CHAOS yet; owner may decide after seeing the prototype.

When energy reaches 100:
- bar gains a controlled READY state;
- no giant glow;
- no gameplay action is triggered.

Prototype controls must allow resetting energy.

---

# 8. DAMAGE NUMBER TYPOGRAPHY — PRIMARY TASK

The current bitmap atlas:
`public/assets/arsenal/feel/damage/damage1.png`

is the visual reference to improve, not blindly preserve.

Observed current identity:
- condensed / italic;
- heavy arcade/combat silhouette;
- strong outline;
- red normal / orange critical / green heal;
- but some numerals merge or become unclear when enlarged.

## 8.1 Font candidates

Primary:
**Kanit Black Italic (900 italic)**

Why:
- strong geometric/capsulated body;
- flat terminals;
- aggressive but readable;
- much clearer numerals than the current atlas;
- visually closer to the current combat identity than generic UI sans.

Secondary:
**Barlow Condensed Black Italic (900 italic)**

Why:
- clearer/cleaner numerals;
- condensed and italic;
- useful comparison if Kanit feels too wide or too soft.

Control:
**Roboto Condensed Bold Italic**

Only as legibility baseline.
Do not choose it as final merely because it is safe.

For prototype only, remote Google Fonts loading is acceptable.
Do not vendor font binaries in this prototype pass.

Verify with `document.fonts.check()`.
Evidence must state whether the intended font actually loaded.
If network font loading is unavailable, report the blocker; do not silently judge fallback Arial as Kanit.

## 8.2 Required comparison matrix

Show current atlas versus:
- Kanit Black Italic;
- Barlow Condensed Black Italic;
- optional Roboto Condensed control.

Test strings:
`1`
`7`
`11`
`17`
`31`
`77`
`98`
`111`
`196`
`266`
`385`
`999`

Show normal red and critical orange variants.

The comparison must make it easy to inspect:
- 1 vs 7 separation;
- 7 vs 9;
- 11 readability;
- 77 readability;
- three-digit spacing;
- outline thickness;
- italic slant;
- whether the digits remain readable over fighter/blood visuals.

## 8.3 Scale presets

Current production numbers are oversized.
Prototype THREE presets:

### COMPACT
XS 30
S 34
M 38
L 43
XL 48
XXL 54

### BALANCED — default candidate
XS 34
S 38
M 43
L 48
XL 54
XXL 60

### IMPACT
XS 36
S 41
M 46
L 52
XL 58
XXL 64

All values are pixel-size targets in the prototype arena reference scale.

Magnitude bands remain non-linear.

Crit:
- color remains orange;
- preserve a small geometric crit mark;
- crit text scale may be at most ~8–10% larger than same-band normal;
- do NOT return to giant crit numbers.

## 8.4 Typography rendering prototype

Demonstrate the production-intended architecture in miniature:

- load webfont once;
- rasterize numeric glyph/text variants into OffscreenCanvas or hidden canvas cache;
- cache semantic variants:
  - normal red;
  - crit orange;
  - heal green;
  - neutral MISS;
- draw cached result into the arena simulation.

Do not merely use live DOM text over the arena and call the engineering question solved.

The prototype may use Canvas 2D.

---

# 9. PROTOTYPE INTERACTIONS

Provide a small developer/control drawer that can be collapsed.

Controls:
- font: Current Atlas / Kanit / Barlow / Roboto control;
- scale: Compact / Balanced / Impact;
- spawn sample normal hit;
- spawn sample critical hit;
- rapid-fire burst;
- heavy single hit;
- momentum swing;
- reset commentary;
- reset energy;
- toggle HP damage ghost;
- viewport preset buttons: 1920×1080 feel, 1366×768 feel, narrow responsive feel.

Controls are not part of the intended final HUD.
They exist only for owner evaluation.

---

# 10. VISUAL LANGUAGE

APEX, not generic SaaS.

Use:
- black / graphite shell;
- restrained steel/industrial borders;
- P1 cyan accent;
- P2 orange/red accent;
- off-white text;
- controlled diagonal cuts / technical marks where helpful;
- high contrast.

Avoid:
- glassmorphism cards everywhere;
- neon cyberpunk bloom;
- rounded-pill dashboard style;
- sci-fi blue hologram spam;
- MMORPG hotbar density;
- generic Bootstrap panels.

Side panels should visually frame the arena rather than compete with it.

---

# 11. MOTION

Subtle only.

HP:
- real fill updates immediately;
- optional ghost trails behind 180–280 ms.

Commentary:
- 80–120 ms snap/slide in;
- 0.6–0.8 s minimum dwell;
- controlled fade/slide out.

Energy:
- immediate logical gain;
- fill lerp <= 120 ms for readability;
- READY state may pulse very subtly.

Damage number:
- spawn immediately;
- brief 90–130 ms punch scale;
- then upward drift/fade;
- clarity before spectacle.

No large spring/bounce UI.

---

# 12. REQUIRED OWNER EVIDENCE

Capture at minimum:

1. full 1920×1080-style HUD composition;
2. 1366×768 composition;
3. narrow responsive state;
4. P1 light pressure commentary;
5. P2 heavy burst commentary;
6. critical-run commentary;
7. energy around 0 / 50 / 100 READY;
8. Kanit comparison matrix;
9. Barlow comparison matrix;
10. current atlas vs Kanit over actual arena/fighter visual;
11. normal red Kanit damage number in battle;
12. orange crit Kanit damage number in battle;
13. all three scale presets side-by-side.

Inspect every screenshot before reporting completion.

---

# 13. ACCEPTANCE / NON-ACCEPTANCE

PASS if:
- arena remains visually dominant;
- side panels are useful but not dashboards;
- HP is readable instantly;
- commentary summarizes rather than spams;
- energy visibly reflects combat events;
- Kanit/Barlow comparison is real and fonts confirmed loaded;
- damage digits 11/17/77/111/196/266 remain clearly distinct;
- damage text is substantially smaller than current production while preserving impact;
- prototype works interactively;
- no existing production file changed.

FAIL if:
- looks like generic admin dashboard;
- side panels overpower arena;
- commentary becomes a chat log;
- energy auto-fills from time;
- prototype secretly changes skill gameplay;
- font silently falls back;
- giant damage numbers remain;
- production files are edited;
- Agent claims final font choice without owner visual approval.

---

# 14. DELIVERY

Agent must report:
- fetched SHA;
- branch;
- exact new files;
- source references studied and what was learned from each;
- font load verification;
- screenshots/evidence filenames;
- prototype URL/path;
- any blocker;
- confirmation that production files have zero diff.

This pass ends at OWNER VISUAL REVIEW.

Do not port PASS B into production.
Do not merge to main/playtest.
Do not choose the final font on the owner's behalf.
