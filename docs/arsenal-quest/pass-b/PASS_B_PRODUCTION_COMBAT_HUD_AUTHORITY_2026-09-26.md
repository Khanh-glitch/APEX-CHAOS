# APEX CHAOS — PASS B PRODUCTION COMBAT HUD AUTHORITY
## Universal Side HUD + Live Burst + Real Loadout Art + Energy B1 + Damage Typography
**Date:** 2026-09-26
**Status:** FROZEN FOR PRODUCTION IMPLEMENTATION AFTER PASS A GREEN
**Owner:** APEX CHAOS
**Design branch:** `prototype/combat-hud-pass-b`

---

# 0. STATUS / DEPENDENCY GATE

This document supersedes the earlier PASS B standalone-prototype authority for production integration.

PASS B is now design-approved enough to leave the prototype loop.

However, PASS A is still an active dependency.

At the time this authority was frozen, the remote PASS A source branch was still:

`arena/01a0d8f4-apex-chaos`
at
`b3edda0aacb74abbe2509e84572f70c14a0505de`

with the implementation still unpushed from the Agent workspace.

Therefore:

**DO NOT start PASS B production implementation from `b3edda0`.**

The production Agent must first fetch live Git and verify that the PASS A branch has moved to a newer implementation descendant containing PASS A and that the exact implementation SHA has a successful non-skip CI run.

If that is not true, STOP and report the dependency instead of implementing PASS B.

Do not reset or overwrite PASS A work.

---

# 1. WHAT THE OWNER APPROVED

The owner approved the current PASS B information architecture and interaction direction after multiple direct-review prototypes.

The approved direction is:

```
P1 SIDE PANEL  |  SQUARE ARENA  |  P2 SIDE PANEL
```

Per side:

1. fighter identity + HP;
2. current live burst / pressure;
3. CURRENT LOADOUT showcase;
4. ENERGY;
5. only minimal truthful mode-specific information where needed.

The owner explicitly does NOT want another dashboard/gauge/fuse/history-list subsystem.

The production version must be visually better than the prototype.

The prototype is a **structural taste proof**, not a pixel-perfect target.

Do not reproduce the prototype's crude placeholder weapon silhouette.

---

# 2. FINAL REFERENCE SWEEP — QUALITY DONORS ONLY

No new product subsystem is introduced by this sweep.

The following references only improve execution quality.

## 2.1 APEX internal UI assets — PRIMARY visual donor

Existing APEX assets under:

`public/assets/pick_ui_final/`

already contain layered:

- frame base;
- color mask;
- inner backdrop;
- bevel highlight;
- rim highlight;
- soft gloss;
- selected glow.

Production PASS B should learn the material relationship:

```
matte graphite body
→ dark separator
→ thin steel rim
→ restrained bevel
→ restrained gloss/highlight
→ small semantic/team accent
```

Do not literally stretch a portrait card frame around the battle panel if its geometry looks distorted.

Use the relationship, or reuse a layer only when its geometry genuinely fits.

## 2.2 CoherentLabs/Gameface-UI — weapon hierarchy donor

Repository:
`CoherentLabs/Gameface-UI`

Relevant:
`src/custom-components/Hud/Weapons/Weapons.tsx`

Learn only:

- weapon visual is large and dominant;
- weapon data is supporting text;
- loadout should read instantly as a visual object, not a text table.

Do not copy its placeholder weapon icon, layout, framework, ammo semantics, or styling.

## 2.3 threejsassets/game-hud — panel-material donor

Repository:
`threejsassets/game-hud`

Relevant:
`dist/skins/modern.css`

Learn:

- tactical matte plates;
- outer rim → dark outline → inner fill;
- chamfered corners;
- subtle top/material highlight;
- restrained accent.

Reject most of the `futuristic.css` glow language.

APEX must NOT become generic cyan-neon cyberpunk.

## 2.4 FightersParadise — architecture donor

Keep the previously researched principle:

```
combat/runtime truth
→ small universal HUD state
→ renderer
```

The HUD must not own duplicate gameplay rules.

## 2.5 PixiJS BitmapText — numeric rendering donor

Learn:

- rasterize/cache numeric glyphs once;
- reuse them cheaply;
- HiDPI-aware numeric texture/cache;
- do not rebuild text every frame.

Do NOT add PixiJS.

## 2.6 Game-feel number punch donor

Use the proven low-cost pattern:

```
new hit
→ immediate value update
→ short scale punch
→ settle
```

No springy wobble, long bounce, or continuous ticker animation.

---

# 3. DOMINANT VISUAL HIERARCHY

The square battle arena remains the visual hero.

Side panels must frame the battle, not compete with it.

Desktop composition:

```
┌──────────────┬──────────────────────────────┬──────────────┐
│   P1 HUD     │                              │    P2 HUD    │
│              │         SQUARE ARENA         │              │
│              │                              │              │
└──────────────┴──────────────────────────────┴──────────────┘
```

For wide desktop:

- arena size is derived primarily from available viewport height;
- arena stays exactly square;
- use the horizontal space that is currently wasted;
- side panels occupy the remaining width;
- preserve breathing room between panel and arena;
- arena must not shrink merely to make panels luxurious.

Do not convert this into a giant fullscreen dashboard.

---

# 4. RESPONSIVE LAW

Desktop/wide:
- three-column side-panel layout.

Near-square / narrow / portrait:
- panels must collapse/compact rather than squeeze into unreadable narrow columns;
- preserve arena priority;
- preserve identity, HP, burst, loadout, energy;
- secondary mode metadata may compact first.

Do not simply scale desktop HUD down uniformly.

Do not hide critical HP or burst state.

---

# 5. PANEL MATERIAL / ART DIRECTION

Production fidelity must exceed the standalone prototype.

Positive replacement:

- matte graphite base;
- narrow steel rim;
- darker inner separator;
- small chamfer/cut corners;
- restrained bevel and top highlight;
- limited P1/P2 accent;
- deliberate negative space;
- crisp typography.

Avoid:

- glassmorphism;
- large blur panels;
- giant neon bloom;
- cyan hologram noise;
- generic sci-fi dashboard clutter;
- pill-heavy mobile-app UI;
- rounded cards everywhere;
- fake gauges;
- decorative data that has no gameplay truth.

Do not add a new visual module merely to fill empty space.

---

# 6. SIDE PANEL INFORMATION ARCHITECTURE

Per side, top to bottom:

## 6.1 Identity + HP

Show:

- fighter identity;
- HP;
- authoritative HP fill;
- optional accepted damage-loss trail/ghost.

HP is instantly readable.

The real HP fill changes immediately.

Any loss trail is presentation only.

## 6.2 LIVE BURST / PRESSURE

This is the central combat-moment read.

Show:

- accumulated realized damage;
- short current commentary label;
- small hit count;
- small crit count.

Do NOT show a history list.

Do NOT add a speedometer, fuse, momentum gauge, waveform, or second pressure bar.

## 6.3 CURRENT LOADOUT

Use real asset imagery.

See §8.

## 6.4 ENERGY

Show B1 telemetry meter.

See §10.

## 6.5 Mode-specific truthful slot

Only if necessary.

Examples:

- truthful current skill cooldown;
- stage/mode state;
- Arsenal rarity.

Do not invent ammo.

Do not create a second inventory system.

---

# 7. LIVE BURST BEHAVIOR — HARD LAW

This behavior was explicitly shaped by owner feedback.

Per attacking side maintain one active burst.

## 7.1 Start

The first **positive realized damage transaction** starts the burst.

Use damage that actually reached the target after existing mitigation/defense.

Do not use authored/base damage if realized damage differs.

## 7.2 Continue

Every new positive realized damage transaction that arrives before the current burst expires:

- immediately adds its realized damage to the total;
- increments hit count;
- increments crit count only when the real damage event has explicit `critical=true`;
- updates commentary and color synchronously;
- visually punches the displayed total immediately.

## 7.3 Expiration

The burst does NOT continuously decay.

The total does NOT fade downward while hits continue.

Each positive realized damage event restarts the silence timer.

Only after:

**1.20 seconds with NO new positive realized damage**

does the burst:

- disappear/reset;
- total → 0;
- hits → 0;
- crits → 0;
- commentary returns idle.

Therefore continuous rapid fire may keep accumulating for longer than 1.2 seconds if every new hit arrives within 1.2 seconds of the previous positive hit.

## 7.4 Events that do NOT extend the burst

Do not extend/restart on:

- MISS;
- zero realized damage;
- fully blocked damage;
- healing;
- unrelated UI events.

## 7.5 Implementation preference

Use event-driven state + one reset timeout per side.

On each valid hit:

- clear previous timeout;
- update burst;
- create new 1.20s expiry timeout.

Do not run an unnecessary per-frame polling loop just to expire the burst.

---

# 8. CURRENT LOADOUT — REAL ASSET LAW

This is a major owner requirement.

The loadout showcase MUST use the actual authored weapon art already in the APEX repo.

Existing canonical weapon images live under:

`public/assets/arsenal/weapons/c/`

including examples:

- `AK_47.png`
- `MOSSBERG_500.png`
- `SNIPER.png`
- the rest of the current firearm/melee/shield/grenade set.

Do not draw a replacement silhouette.

Do not use a generic weapon icon where an authored weapon asset exists.

Do not regenerate the weapon.

## 8.1 Canonical runtime integration

The accepted Arsenal presentation runtime already owns weapon image caching.

Relevant runtime:

`public/game/arsenal/arsenalPresentationRuntime.js`

Existing API:

`APEX_ARSENAL_AV.weaponImage(weaponId)`

returns the cached canonical image and intrinsic dimensions when ready.

Prefer this canonical source for Arsenal HUD rendering rather than creating a second independent weapon-art map.

The HUD may render the cached image into a small high-DPI HUD canvas or an equivalent efficient surface.

## 8.2 Visual hierarchy

Weapon art is the dominant object in the loadout area.

Supporting text:

- display name;
- class/family;
- truthful rarity/state if available.

Do not make the supporting text louder than the weapon art.

## 8.3 Orientation

For visual composition:

- P1 weapon should read inward toward the arena;
- P2 should mirror/read inward toward the arena when necessary.

Preserve aspect ratio.

Use HUD fit/crop logic, not world-equipped display size.

Long rifles/snipers must fit gracefully without becoming microscopic.

## 8.4 State change motion

When the actual held weapon changes:

- short snap/crossfade/translate;
- target duration roughly 120–180 ms;
- no constant floating/spinning;
- no motion when the held weapon is unchanged.

Redraw/rebind weapon art only when the holder/weapon/rarity state changes.

## 8.5 UNARMED / non-Arsenal fallback

Never fake a weapon.

If UNARMED:

- show UNARMED;
- use existing fighter emblem/icon/standing fallback when appropriate.

For non-Arsenal modes without a truthful weapon state:

- use fighter identity/emblem or truthful mode state;
- do not invent a loadout.

---

# 9. BURST COMMENTARY + COLOR

Commentary is deterministic, not generative AI text.

Thresholds must be normalized to the target's current authoritative max HP so the universal HUD can work outside 1000-HP Arsenal.

Prototype-approved 1000-HP relationships convert to:

## CONTACT
Any positive burst damage.

Color:
side accent.

## PRESSURE
Burst >= **4.5%** of target max HP.

Color:
`#F2CF55`

## RAMPAGE
Burst >= **9%** of target max HP
OR hit count >= 4.

Color:
`#FF9E35`

## OVERDRIVE
Burst >= **15%** of target max HP.

Color:
`#FF6A2A`

## CRITICAL RUSH
Burst >= **10%** of target max HP
AND crit count >= 2.

Color:
`#FF4931`

## MOMENTUM SWING
Special state:
- attacking side is meaningfully behind in HP;
- burst >= about **12.5%** of target max HP;
- use only when no higher-priority CRITICAL RUSH / DEVASTATING state applies.

Use OVERDRIVE / orange-red family.

## DEVASTATING
Either:
- one realized hit >= **18%** of target max HP;
OR
- current burst >= **23.5%** of target max HP.

Color:
`#FF2727`

Priority:

`DEVASTATING > CRITICAL RUSH > MOMENTUM SWING > OVERDRIVE > RAMPAGE > PRESSURE > CONTACT`

No filler commentary when idle.

---

# 10. BURST MOTION

Owner explicitly wants the number to **jump/punch on each increase**.

Each valid new hit:

```
value updates immediately
→ fast scale/position attack
→ short settle
```

Target perceptual range:

- scale punch roughly 1.08–1.12;
- total attack + settle roughly 140–180 ms.

This is an approved feel range, not permission for a long spring.

At higher tiers, a tiny panel impact translation is allowed if it remains subtle and does not shake the arena.

Do not animate the total from old number to new number digit-by-digit.

The new total must be visible immediately.

---

# 11. ENERGY B1 — TELEMETRY ONLY

PASS B introduces real ENERGY state but does NOT rebalance skills yet.

Range:

`0–100`

Gain is normalized to the fighter's actual max HP.

## Damage dealt

For each 1% max HP of positive realized damage dealt:

`+1.00 ENERGY`

## Damage taken

For each 1% max HP of positive realized damage taken:

`+0.60 ENERGY`

Equivalent:

```
dealGain = 100 * realizedDamage / targetMaxHp
takeGain = 60  * realizedDamage / selfMaxHp
```

Clamp at 100.

Rules:

- reset on match start;
- no passive gain;
- no decay;
- no gain from heal;
- no gain from zero/blocked damage;
- READY state at 100;
- READY treatment is restrained;
- no gameplay action fires automatically.

**Do NOT make current skills consume ENERGY in PASS B.**

Energy spending / skill rebalance is a separate B2 gameplay-design task requiring owner playtest.

---

# 12. DAMAGE NUMBER TYPOGRAPHY

The current atlas effective output is too large and some digits are difficult to read.

Production primary font:

**Kanit Black Italic**

Use the official upstream / Google Fonts licensed source and include the SIL OFL license in the repo.

Do not depend on Google Fonts network loading in production.

Do not silently use a fallback font and call it Kanit.

## 12.1 Semantic colors

Normal damage:
`#F2382F`

Critical damage:
`#FF8A24`

Healing:
`#37D96B`

MISS:
neutral.

Blood stays crimson; crit does not recolor blood.

Preserve the geometric crit mark.

## 12.2 Target size bands

For the 1000×1000 arena reference scale, target perceived glyph heights:

- XS: ~34 px
- S: ~38 px
- M: ~43 px
- L: ~48 px
- XL: ~54 px
- XXL: ~60 px

These are perceived visual targets.

The implementer may calibrate raster font size/padding so the final visible glyphs match them.

Magnitude band thresholds remain the currently accepted six discrete bands unless this authority explicitly supersedes only the visible height.

Crit may be at most ~8–10% larger than same-band normal.

Do not return to giant crit text.

## 12.3 Numeric cache

Use the BitmapText-style architecture already researched:

```
local licensed font
→ load once
→ pre-rasterize/cache needed numeric glyphs/variants
→ draw cached numbers
```

Canvas / OffscreenCanvas is preferred where compatible.

Do not add PixiJS.

Do not call expensive font rasterization every frame for every popup.

Keep crisp dark outline/edge.

Avoid fractional repeated scaling that softens glyphs.

---

# 13. UNIVERSAL HUD STATE BOUNDARY

Do not let the new DOM renderer query many unrelated runtime globals on every frame.

Preferred shape:

```
engine / mode truth
        ↓
APEX_COMBAT_HUD state adapter
        ↓
DOM + cached weapon-art renderer
```

Per side the adapter should expose only the UI truth needed, for example:

- fighter id/name;
- hp;
- maxHp;
- energy;
- burst state;
- loadout state;
- skill cooldown / mode slot when truthful.

The renderer must not duplicate damage, crit, weapon, or cooldown calculations.

---

# 14. DAMAGE EVENT INTEGRATION

Integrate from the central realized damage transaction.

The HUD must receive the damage result only after the existing game has resolved mitigation/defense and actual HP loss.

Do not poll `damageDone` and diff it every frame if a direct event exists.

Do not implement a second damage engine.

Pass explicit metadata where already available:

- attacker;
- victim;
- realized amount;
- critical;
- source label/type.

The HUD burst and ENERGY consume this event.

This must not change the damage result.

---

# 15. EXISTING DOM / ENGINE COMPATIBILITY

Current `src/App.jsx` already contains:

- `#game-wrapper`;
- `#game-canvas`;
- `#hud`;
- existing P1/P2 name and HP DOM ids.

Preserve existing engine update hooks where practical.

Do not casually rename/remove IDs that the engine already updates.

The production refactor should move/recompose the shell without breaking old engine writers.

Current Arsenal runtime already has cached DOM write patterns in `syncDomHud`.

Learn from that pattern:

- cache refs;
- compare last rendered values;
- write only when state changes.

Do not rebuild the full side panel DOM every frame.

---

# 16. MODE COMPATIBILITY

The side-panel shell is intended as the global combat HUD, not Arsenal-only decoration.

However:

- Arsenal loadout uses actual Arsenal weapon holder/art;
- other modes only show data they truthfully expose;
- existing Manual-mode skill mapping must not disappear;
- native fighter visuals must not regress;
- current game controls must remain usable.

Do not force Arsenal-specific rarity/weapon logic into unrelated modes.

Use mode adapters.

---

# 17. PERFORMANCE

Do not trade V1 blood/VFX/audio quality for HUD performance.

Requirements:

- no per-frame font rasterization;
- no per-frame image creation/decode;
- no unnecessary DOM subtree rebuild;
- burst expiry via timeout/event, not continuous polling;
- loadout redraw only on meaningful state change;
- cached refs and last-value comparisons;
- preserve existing real-rAF instrumentation;
- run full workload performance proof.

Do not reduce blood particles, weapon art, VFX, audio quality, or arena resolution to make the HUD pass.

---

# 18. HARD / SOFT CONSTRAINTS

## HARD

- three-column wide desktop shell;
- square arena stays dominant;
- no dashboard feature pile;
- live burst rule exactly as §7;
- no continuous burst decay;
- reset only after 1.20s silence;
- per-hit value punch;
- deterministic commentary hierarchy;
- real weapon asset in Arsenal loadout;
- no fake silhouette when real asset exists;
- actual weapon name/type/rarity only when truthful;
- no fake ammo;
- ENERGY B1 gain law;
- ENERGY does not spend skills yet;
- Kanit Black Italic production damage typography;
- normal red / crit orange / heal green;
- V1 blood identity untouched;
- production visual fidelity must exceed the prototype;
- no main/playtest auto-promotion.

## SOFT

- helper/module names;
- exact CSS implementation;
- DOM vs small HUD canvas for weapon art;
- exact chamfer geometry;
- exact internal cache structure;
- exact 120–180ms loadout transition value within the accepted feel range.

---

# 19. NON-GOALS

Do NOT add:

- a burst history feed;
- speedometer;
- fuse;
- hit waveform;
- momentum meter;
- combo gauge;
- ammo system;
- passive energy generation;
- energy decay;
- energy skill cost;
- new rarity economy;
- new gameplay balance;
- new weapon art;
- new rendering framework;
- new particle engine.

Do not redesign Shop / Draw / Hub in this pass beyond necessary HUD integration.

PASS A navigation remains authoritative.

---

# 20. REQUIRED PRODUCTION EVIDENCE

Capture and inspect real-browser evidence at minimum:

1. wide desktop battle with P1/arena/P2 composition;
2. 1440×900;
3. 1366×768;
4. narrow/portrait transformed HUD;
5. P1 real AK/rifle asset in loadout;
6. real shotgun asset;
7. long sniper asset fitting correctly;
8. melee asset;
9. UNARMED truthful fallback;
10. normal damage number strings including 11 / 17 / 77 / 111 / 196 / 266 / 385;
11. crit orange + crit mark;
12. heal green;
13. CONTACT;
14. PRESSURE;
15. RAMPAGE;
16. OVERDRIVE;
17. CRITICAL RUSH;
18. DEVASTATING;
19. continuous AUTO/BURST lasting >1.2s without resetting because hits continue;
20. burst still visible immediately after each hit and total punches upward;
21. burst resets only after >1.2s silence;
22. ENERGY near 0;
23. ENERGY around 50;
24. ENERGY at 100 READY;
25. at least one non-Arsenal combat mode using the global shell without fake loadout data;
26. native Manual/skill HUD compatibility.

Visual evidence is required in addition to tests.

---

# 21. REQUIRED AUTOMATED GATES

Add deterministic gates for:

- realized-damage burst amount;
- first hit starts burst;
- second hit within 1.2s adds;
- repeated hits can sustain burst beyond absolute 1.2s;
- no reset while gaps remain <1.2s;
- reset after >1.2s silence;
- MISS does not extend;
- blocked zero-realized damage does not extend;
- heal does not extend;
- hit count;
- crit count;
- commentary priority;
- normalized thresholds at at least two max-HP values;
- dealt ENERGY gain;
- taken ENERGY gain;
- cap 100;
- no passive energy;
- reset energy on new match;
- no skill behavior change due to ENERGY;
- real Arsenal holder id → correct canonical loadout asset;
- UNARMED fallback;
- no fake ammo;
- Kanit font loaded locally in browser;
- damage cache reuse;
- responsive shell / no overflow at required browser viewports.

Do not weaken existing PASS A, V1, or V3 gates.

---

# 22. VALIDATION CHAIN

On final implementation SHA run:

- syntax/static checks;
- full headless suite;
- Vite production build;
- launcher smoke;
- full real-browser suite;
- real-rAF performance telemetry on full workload;
- screenshot/evidence capture.

The non-skip implementation commit must have a GitHub Actions run with:

- exact head SHA;
- conclusion SUCCESS.

Do not rely on an evidence child commit as CI proof.

---

# 23. OWNER VISUAL GATE

Green tests do not equal acceptance.

After Agent completion:

1. ChatGPT audits Git/code/tests/evidence;
2. owner playtests the build;
3. owner judges:
   - side-panel visual hierarchy;
   - real weapon showcase;
   - burst feel;
   - number readability;
   - energy density;
   - overall polish.

Only then may promotion be considered.

Do not automatically move `main` or `playtest/arsenal`.

---

# 24. FINAL CHECKSUM

## KEEP

- P1 panel | square arena | P2 panel
- identity + HP
- live burst
- real current loadout art
- ENERGY B1
- small truthful mode slot
- V1 blood
- current gameplay/balance
- PASS A navigation fixes

## BURST

- positive realized damage only
- cumulative
- hit punch each increase
- restart 1.20s silence timer on each positive hit
- never decay continuously
- reset only after 1.20s silence
- deterministic commentary/colors

## LOADOUT

- real authored APEX weapon asset
- canonical existing image cache
- weapon visual dominant
- name/type/rarity supporting
- no silhouette replacement
- no fake ammo
- UNARMED truthful fallback

## DAMAGE TYPE

- Kanit Black Italic local/OFL
- red normal
- orange crit
- green heal
- ~34–60 px target perceived bands
- cache numeric rendering
- crit only modestly larger

## ENERGY

- 0–100
- +1.00 per 1% max HP dealt
- +0.60 per 1% max HP taken
- no passive gain
- no decay
- no spend in PASS B
- READY at 100

## VISUAL

- production > prototype fidelity
- matte graphite
- steel rim
- dark separator
- restrained bevel/gloss
- minimal team accent
- no neon dashboard clutter

## SAFETY

- start only after PASS A green descendant exists
- do not reset PASS A
- do not reduce VFX/SFX quality
- do not auto-promote main/playtest
- owner taste gate remains final
