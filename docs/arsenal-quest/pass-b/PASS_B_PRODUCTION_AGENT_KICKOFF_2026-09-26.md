# APEX CHAOS — PASS B PRODUCTION AGENT KICKOFF
## Universal Combat HUD / Live Burst / Real Loadout / Energy B1 / Damage Typography
**Date:** 2026-09-26
**Status:** READY AFTER PASS A GREEN

This is a zero-context Arena production task.

Do not rely on previous Arena local state.

---

# 0. REPOSITORY

Repository:

`Khanh-glitch/APEX-CHAOS`

PASS B design authority branch:

`prototype/combat-hud-pass-b`

Production authority file:

`docs/arsenal-quest/pass-b/PASS_B_PRODUCTION_COMBAT_HUD_AUTHORITY_2026-09-26.md`

Frozen authority commit:

`993c16637b26f0281915e66783c447e6550f70df`

PASS A source branch:

`arena/01a0d8f4-apex-chaos`

PASS A authority baseline:

`b3edda0aacb74abbe2509e84572f70c14a0505de`

---

# 1. FIRST ACTION — DEPENDENCY GATE

Before editing anything:

1. fetch all live refs;
2. print:
   - current/pinned branch;
   - HEAD;
   - origin/`arena/01a0d8f4-apex-chaos` SHA;
   - origin/`prototype/combat-hud-pass-b` SHA;
3. inspect recent commits on `arena/01a0d8f4-apex-chaos`;
4. locate the PASS A implementation commit;
5. verify it is a descendant of `b3edda0...`;
6. verify a GitHub Actions run exists whose exact head SHA is that PASS A implementation SHA and whose conclusion is SUCCESS.

**If PASS A has not been pushed and proven green, STOP.**

Report:

`PASS B BLOCKED: PASS A GREEN SOURCE SHA NOT YET AVAILABLE`

Do not implement from `b3edda0`.

Do not reset or reconstruct PASS A.

Do not work around this dependency.

---

# 2. WORK BRANCH LAW

Once PASS A is green:

- the newest compatible PASS A descendant is the production source;
- your Arena chat may be pinned to a different `arena/*` branch;
- if so, fast-forward your pinned branch from the verified PASS A source;
- never implement on `main`;
- never implement on `playtest/arsenal`;
- never modify `prototype/aftermath-32`;
- do not implement on `prototype/combat-hud-pass-b` — that branch is design authority only.

Do not create arbitrary extra branches.

Work only on the Arena session branch authorized by the current Arena chat.

---

# 3. AUTHORITY ORDER

After dependency gate passes, read these in full:

1. owner's latest explicit instruction in the task;
2. `prototype/combat-hud-pass-b:docs/arsenal-quest/pass-b/PASS_B_PRODUCTION_COMBAT_HUD_AUTHORITY_2026-09-26.md`;
3. latest PASS A authority and implementation;
4. current V1 blood authority;
5. current V3 handoff / combat / Meta UI authorities;
6. standing VIBECODE / project SKILL authority.

Copy the exact PASS B production authority file from the design branch into the working Arena branch so future zero-context sessions retain it.

Do not revive retired V3 authority.

---

# 4. REPORT BEFORE IMPLEMENTATION

Before editing source, report:

1. fetched PASS A source SHA;
2. exact PASS A CI run and conclusion;
3. pinned Arena branch;
4. authority order;
5. current runtime surfaces you audited;
6. exact files you intend to change/create;
7. how you will preserve current engine IDs/hooks and PASS A changes;
8. how you will use real canonical APEX weapon assets;
9. how realized damage will feed burst + ENERGY without duplicating damage math.

Then proceed immediately unless a real blocker exists.

---

# 5. PRODUCT — DO NOT REDESIGN

The product direction is already approved.

Desktop:

```
P1 SIDE PANEL  |  SQUARE ARENA  |  P2 SIDE PANEL
```

Per side:

1. fighter identity + HP;
2. live burst / pressure;
3. CURRENT LOADOUT;
4. ENERGY;
5. minimal truthful mode-specific state.

Do not add:

- speedometer;
- fuse;
- waveform;
- history feed;
- momentum meter;
- extra combo gauge;
- fake ammo;
- new inventory system.

The standalone prototype was a structural proof only.

**Production fidelity must exceed the prototype.**

Do not pixel-copy its crude CSS or placeholder weapon shapes.

---

# 6. FINAL QUALITY SWEEP TO APPLY

No new feature invention.

Apply these execution improvements:

## Panel material

Use APEX internal pick UI material language plus restrained tactical layering:

```
matte graphite
→ dark separator
→ thin steel rim
→ subtle bevel
→ subtle gloss/highlight
→ restrained semantic/team accent
```

Use chamfer/cut geometry where it helps.

Do not turn the HUD into cyan neon/cyberpunk glass.

## Loadout hierarchy

Real weapon art is the hero.

Weapon name/type/rarity are support.

Use negative space rather than filling the block with text.

## Motion

Only meaningful state changes animate:

- damage burst punch per hit;
- short loadout change snap/crossfade;
- subtle READY energy state.

No idle floating/spinning.

---

# 7. REAL LOADOUT ASSET — NON-NEGOTIABLE

Arsenal must display the actual current weapon asset already used by gameplay.

Existing authored images:

`public/assets/arsenal/weapons/c/*.png`

Examples:

- `AK_47.png`
- `MOSSBERG_500.png`
- `SNIPER.png`

Existing canonical runtime image source:

`public/game/arsenal/arsenalPresentationRuntime.js`

Prefer:

`window.APEX_ARSENAL_AV.weaponImage(weaponId)`

This already uses the accepted image cache and canonical weapon metadata.

Do NOT draw a fake silhouette.

Do NOT create a duplicate manual image path table unless the existing canonical API is genuinely insufficient and you document why.

P1 art reads toward arena.

P2 art reads toward arena, mirroring presentation if needed.

Preserve aspect ratio.

Fit long weapons gracefully.

If UNARMED, show truthful UNARMED + existing fighter identity/icon fallback.

For non-Arsenal modes without a truthful weapon state, do not fake a loadout.

---

# 8. LIVE BURST — EXACT LAW

Use **positive realized damage after mitigation**.

For each side:

- first positive hit starts burst;
- new positive hit adds immediately;
- hit count increments;
- crit count increments only on explicit real `critical=true`;
- each positive hit restarts one 1.20s silence timeout;
- no continuous decay;
- no countdown subtraction from the displayed total;
- sustained rapid fire may accumulate indefinitely while gaps remain <1.20s;
- only >1.20s with no new positive realized damage resets the burst.

Do not extend burst on:

- MISS;
- zero damage;
- fully blocked damage;
- heal.

Use event-driven timers, not a per-frame polling loop.

---

# 9. COMMENTARY

Normalize against target max HP.

Priority:

`DEVASTATING > CRITICAL RUSH > MOMENTUM SWING > OVERDRIVE > RAMPAGE > PRESSURE > CONTACT`

Thresholds:

- CONTACT: any positive burst;
- PRESSURE: >= 4.5% max HP;
- RAMPAGE: >= 9% OR >= 4 hits;
- OVERDRIVE: >= 15%;
- CRITICAL RUSH: >= 10% AND >= 2 crits;
- MOMENTUM SWING: attacker meaningfully behind + >= about 12.5%, only when no higher priority state;
- DEVASTATING: single realized hit >= 18% OR burst >= 23.5%.

Colors:

- CONTACT = side accent;
- PRESSURE = `#F2CF55`;
- RAMPAGE = `#FF9E35`;
- OVERDRIVE = `#FF6A2A`;
- CRITICAL RUSH = `#FF4931`;
- DEVASTATING = `#FF2727`.

Do not generate runtime AI commentary.

---

# 10. BURST HIT PUNCH

Owner explicitly wants the accumulated number to hit upward in perceptual beats.

Every positive hit:

1. total changes immediately;
2. value punches;
3. settles quickly.

Target:

- scale about 1.08–1.12;
- total attack/settle about 140–180 ms.

No smooth number counting from old → new.

No long bounce.

No spring wobble.

No animation that delays truthful new value.

---

# 11. ENERGY B1

Implement real match state:

`0..100`

Positive realized damage dealt:

`+100 * realizedDamage / targetMaxHp`

Positive realized damage taken:

`+60 * realizedDamage / selfMaxHp`

Rules:

- clamp 100;
- reset match start;
- no passive gain;
- no decay;
- no heal gain;
- no zero/blocked gain;
- READY at 100.

**Do not alter any current skill cost/cooldown/activation because of ENERGY.**

PASS B is telemetry only.

Skill spending is future B2 work.

---

# 12. DAMAGE TYPOGRAPHY

Primary production font:

**Kanit Black Italic**

Use official licensed source.

Vendor locally into the repo and include SIL OFL license.

Production must not depend on remote Google Fonts.

Do not silently fall back.

Semantic colors:

- normal `#F2382F`;
- crit `#FF8A24`;
- heal `#37D96B`;
- MISS neutral.

Keep geometric crit mark.

Target perceived glyph-height bands on 1000×1000 arena:

`34 / 38 / 43 / 48 / 54 / 60 px`

Preserve current six magnitude thresholds unless the authority explicitly changes only visible height.

Crit max ~8–10% bigger than equivalent normal.

Use Canvas/OffscreenCanvas numeric caching inspired by BitmapText.

Do not add PixiJS.

Do not rasterize the font every frame per popup.

Keep crisp dark edges.

Do not change V1 blood color or counts.

---

# 13. UNIVERSAL ARCHITECTURE

Preferred boundary:

```
real engine/mode state
→ small APEX_COMBAT_HUD adapter/state
→ DOM shell + cached art renderer
```

Do not make the DOM renderer recalculate gameplay.

Do not poll dozens of globals every frame.

Integrate burst/energy from the central realized-damage transaction.

Use actual:

- attacker;
- victim;
- realized amount;
- critical metadata;
- source info.

Do not create a second damage engine.

Preserve existing DOM IDs/hooks when practical:

- P1/P2 name;
- HP;
- HP loss trail;
- game canvas;
- existing skill/mode outputs.

Audit current post-PASS-A source before moving anything.

---

# 14. MODE COMPATIBILITY

This is a global combat HUD shell.

Arsenal:
- real current weapon;
- truthful rarity if available;
- existing skill cooldown truth.

Other modes:
- use only data actually exposed;
- if no loadout, use fighter identity/emblem or truthful mode-specific state;
- do not fake weapon/ammo;
- Manual-mode skill mapping must survive.

Do not regress current fighter-native visuals.

---

# 15. PERFORMANCE

Use:

- cached DOM refs;
- last-value comparisons;
- state-change writes only;
- one burst timeout per side;
- loadout redraw only on holder/weapon change;
- cached image objects;
- cached glyph render assets;
- minimal per-frame allocation.

Do not reduce:

- V1 blood;
- VFX density;
- VFX lifetime;
- SFX;
- audio quality;
- weapon art quality;
- arena resolution.

Keep/extend real-rAF telemetry.

---

# 16. EXPECTED FILE SURFACES — AUDIT, DO NOT BLINDLY ASSUME

Likely relevant:

- `src/App.jsx`
- `src/styles.css`
- central realized damage path in `public/apexEngine.js` or its current post-PASS-A equivalent
- new lightweight UI/runtime module if appropriate, e.g. `public/game/ui/apexCombatHudRuntime.js`
- runtime manifest if a module is added
- `public/game/arsenal/arsenalPresentationRuntime.js`
- `public/game/modes/arsenalQuestRuntime.js`
- `public/game/arsenal/arsenalFeelRuntime.js` for damage typography/cache
- local Kanit font asset + OFL license
- headless/browser test harnesses.

Do not edit a file merely because it is on this list.

Audit first.

PASS A may have already modified overlapping files.

Merge rather than overwrite.

---

# 17. REQUIRED TESTS

Add deterministic gates for all authority behavior, including:

- burst start;
- burst accumulation;
- sustained >1.2s absolute duration with sub-1.2s hit gaps;
- reset only after silence >1.2s;
- MISS no extend;
- block/zero no extend;
- heal no extend;
- hit count;
- crit count;
- commentary threshold/priority;
- threshold normalization under at least two max-HP values;
- ENERGY dealt gain;
- ENERGY taken gain;
- cap 100;
- reset;
- no passive gain;
- no skill behavior change;
- real holder → canonical weapon asset;
- UNARMED fallback;
- no fake ammo;
- local Kanit loaded;
- numeric cache reuse;
- responsive layout/no overflow.

Do not remove or weaken PASS A / V1 / V3 gates.

---

# 18. REQUIRED REAL-BROWSER EVIDENCE

Capture and inspect:

- wide three-column battle;
- 1440×900;
- 1366×768;
- narrow/portrait transform;
- real AK/rifle loadout;
- real shotgun;
- real long sniper;
- melee;
- UNARMED;
- CONTACT;
- PRESSURE;
- RAMPAGE;
- OVERDRIVE;
- CRITICAL RUSH;
- DEVASTATING;
- sustained AUTO/BURST >1.2s with no reset while hits continue;
- reset only after silence;
- normal red damage;
- crit orange + mark;
- heal green;
- 11 / 17 / 77 / 111 / 196 / 266 / 385 number readability;
- ENERGY 0 / ~50 / 100 READY;
- one non-Arsenal mode;
- Manual/skill HUD compatibility.

Inspect screenshots yourself before reporting success.

Also run actual normal-speed browser play — not screenshots only.

---

# 19. VALIDATION CHAIN

Before commit:

- syntax/static;
- full headless;
- Vite production build;
- launcher smoke;
- full real-browser;
- real-rAF full-workload metrics.

Then:

1. commit implementation as normal NON-`[skip ci]` commit;
2. push only the pinned Arena work branch;
3. wait for GitHub Actions;
4. exact implementation SHA must conclude SUCCESS;
5. optional evidence child may be `[skip ci]`.

Do not call an evidence child SHA the CI implementation proof.

---

# 20. DO NOT PROMOTE

Do not move:

- `main`;
- `playtest/arsenal`;
- `prototype/aftermath-32`.

Do not merge production automatically.

End at:

**OWNER PLAYTEST / VISUAL ACCEPTANCE**

---

# 21. FINAL CHECKSUM

Do not invent more.

Implement exactly:

- universal side panels;
- arena remains hero;
- identity/HP;
- cumulative live burst;
- aggressive deterministic commentary;
- real authored current weapon art;
- ENERGY B1;
- Kanit damage numbers;
- restrained premium material polish.

Protect:

- PASS A;
- V1 blood;
- V3 gameplay;
- audio;
- spawn;
- crit;
- heals;
- fighter visuals;
- meta economy;
- navigation.

Production must look better than the prototype.

Real asset art is mandatory.

Green tests are necessary but owner visual approval is final.
