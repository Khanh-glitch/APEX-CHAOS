# PASS B — ARENA AGENT KICKOFF
## Standalone Universal Combat HUD / Typography Prototype

New task. Treat this as a zero-context Arena session.

Do NOT rely on another Arena chat's local state.

Repository:
Khanh-glitch/APEX-CHAOS

Dedicated PASS B branch:
prototype/combat-hud-pass-b

Expected authority tip:
95655cc5cf5a897ecd945cd37227c86ba1fe5e90

PASS A is being implemented separately and has NOT been pushed yet.
Do not touch its working branch and do not attempt to merge PASS A.

First:
1. fetch live Git;
2. verify `prototype/combat-hud-pass-b` exists at the expected SHA or a newer compatible descendant;
3. work ONLY on this branch for this task;
4. read in full:
   `docs/arsenal-quest/pass-b/PASS_B_VISUAL_SYSTEM_PROTOTYPE_AUTHORITY_2026-09-25.md`
5. study the exact reference repositories/files named in that authority before coding;
6. report the fetched SHA, authority order, and exact files you intend to CREATE.

This is a STANDALONE PROTOTYPE pass.

You are explicitly forbidden from editing production files.

Allowed new files only:
- `public/prototypes/combat-hud-pass-b/**`
- `docs/arsenal-quest/pass-b/**`

Do NOT edit:
- `src/App.jsx`
- `src/styles.css`
- `public/apexEngine.js`
- `public/game/**`
- existing production assets
- current Arsenal test harnesses

Build a polished interactive prototype for:

A. UNIVERSAL COMBAT HUD
- desktop composition:
  P1 SIDE PANEL | SQUARE ARENA | P2 SIDE PANEL
- arena remains visually dominant;
- fighter name + HP;
- damage commentary;
- ENERGY telemetry;
- one mode-specific placeholder slot;
- responsive narrow state.

B. DAMAGE COMMENTARY
- deterministic combat-event buffer;
- 1.20 s rolling merge window;
- max 1 active + 2 fading lines;
- classifications and priority exactly as frozen in the authority;
- no generative-AI commentary;
- no bullet-by-bullet spam.

C. ENERGY B1 TELEMETRY
- 0–100;
- damage dealt: +1 energy per 1% max HP;
- damage taken: +0.60 energy per 1% max HP;
- no passive gain;
- no decay;
- no skill spending;
- subtle READY state at 100.

D. DAMAGE TYPOGRAPHY
- compare:
  current atlas
  Kanit Black Italic
  Barlow Condensed Black Italic
  Roboto Condensed Bold Italic control
- verify the requested webfonts ACTUALLY load with `document.fonts.check()`;
- do not silently judge a fallback font;
- required numeral matrix:
  1, 7, 11, 17, 31, 77, 98, 111, 196, 266, 385, 999;
- normal red and crit orange;
- test Compact / Balanced / Impact scale presets exactly as frozen;
- prototype a Canvas/OffscreenCanvas cached glyph/text approach inspired by PixiJS BitmapText architecture;
- do NOT add PixiJS itself.

Reference learning:
- IKEMEN GO -> LifeBar/PowerBar/combo/action-message subsystem separation;
- FightersParadise -> MatchHudState -> renderer boundary;
- Parrot2 -> combat-event merge/throttle/priority;
- PixiJS -> bitmap text / numeric cache architecture;
- PunchOut browser reference -> resource meter tied to actions/events.

Do NOT clone their visual style.

Visual language:
- APEX graphite / industrial;
- P1 cyan;
- P2 orange/red;
- arena first;
- no glassmorphism dashboard;
- no neon cyberpunk bloom;
- no MMORPG hotbar density.

Required prototype:
`public/prototypes/combat-hud-pass-b/index.html`

with supporting:
`prototype.css`
`prototype.js`

and:
`docs/arsenal-quest/pass-b/PASS_B_REFERENCE_AND_DECISION_LOG.md`

Required interactive controls:
- font selector;
- scale preset selector;
- normal hit;
- crit hit;
- rapid-fire burst;
- heavy hit;
- momentum swing;
- reset commentary;
- reset energy;
- damage ghost toggle;
- desktop 1920×1080 feel;
- 1366×768 feel;
- narrow responsive feel.

Required visual evidence is listed in §12 of the authority.
Capture and inspect every required state.

Critical:
This task ends at OWNER VISUAL REVIEW.

Do NOT:
- port the prototype into production;
- change current skill gameplay;
- merge to main;
- merge to playtest/arsenal;
- choose the final font for the owner.

After implementation:
1. verify only allowed new files differ;
2. run the prototype in a real browser;
3. verify fonts actually loaded;
4. inspect all required screenshots;
5. commit and push only `prototype/combat-hud-pass-b`;
6. report the implementation SHA and evidence.

Begin now.
