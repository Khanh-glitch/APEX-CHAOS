# APEX CHAOS — ARSENAL V3 META UI / UX RUNBOOK

**Date:** 2026-09-25
**Repository:** `Khanh-glitch/APEX-CHAOS`
**Branch:** `arena/01a0cf5e-apex-chaos`
**Status:** OWNER-FROZEN PRODUCT / UI AUTHORITY

The implementation Agent must not invent the Arsenal frontend from a blank page.

Reuse:
- `public/assets/pick_ui_final/pick-layout-card-system-v1.json`
- `public/assets/pick_ui_final/pick-layout-final-v1.json`
- `public/assets/pick_ui_final/assets/`
- `public/assets/ui_2026/`
- `public/game/ui/apexPickRuntime.js`

No external asset download is required for V3 unless a specific blocker is proven.

---

# 1. PRODUCT FLOW

Main Menu -> **ARSENAL QUEST** -> **ARSENAL HUB**

Hub destinations:
1. FREE BATTLE
2. QUEST MAP
3. FIGHTER SHOP
4. LUCKY DRAW

Free Battle:
Hub -> Fighter Pick -> Battle -> Result -> Rematch / Pick Again / Hub

Quest:
Hub -> Quest Map -> stage -> P1 Fighter Pick with fixed opponent -> Battle -> Result -> Next / Retry / Quest Map / Hub

Shop:
Hub -> Fighter Shop -> Buy/inspect -> Hub

Lucky Draw:
Hub -> Lucky Draw -> Spin -> Unlock -> Spin again / Use now / Hub

---

# 2. META SAVE / ECONOMY

Storage:
`apexChaos.arsenalMeta.v1`

Minimum schema:

```js
{
  version: 1,
  credits: 350,
  ownedFighters: ['NEWBIE'],
  lastSelectedP1: 'NEWBIE',
  lastSelectedP2: 'NEWBIE',
  totalSpins: 0,
  unlockedAt: { NEWBIE: 0 }
}
```

Always ensure NEWBIE is owned.
Do not overwrite `apexChaos.arsenalQuest.v1`.

Currency:
**ARSENAL CREDITS (AC)**

Starting balance:
**350 AC**

One currency only.
No premium currency.
No daily login.
No duplicate shards.
No pity system.

---

# 3. EARNING CREDITS

Quest first clear:
**150 AC**

Quest replay win:
**40 AC**

Free Battle completed:
**25 AC**

Free Battle winner bonus:
**+25 AC**

No reward for aborted/reloaded match.

Result panel must show:
- reward reason(s);
- total earned;
- updated balance.

---

# 4. UNLOCK RULES

NEWBIE:
- always owned;
- default;
- cannot be locked/sold.

All other fighters:
- locked by default;
- unlock via Shop or Lucky Draw;
- ownership applies to Free Battle and Quest P1.

Quest opponents may use locked fighters as stage content.

---

# 5. FIGHTER SHOP

Direct unlock:
**1000 AC** for every non-Newbie fighter.

Do not invent fighter-economic rarity.

Design canvas:
1672 x 941.

Top:
- Back button left;
- `FIGHTER SHOP`;
- AC balance right.

Body:
- card grid x roughly 80–1180;
- detail panel x roughly 1200–1590;
- 4 desktop columns;
- portrait card grammar from existing HeroCard system;
- owned = `OWNED`;
- Newbie = `DEFAULT / OWNED`;
- locked = visible but dim/desaturated + `1000 AC`.

Detail panel:
- name;
- accent;
- description;
- speed/identity summary;
- owned state;
- buy button.

Purchase:
1. BUY;
2. compact confirmation;
3. debit 1000 once;
4. add ownership once;
5. save;
6. ~450ms unlock glow.

Insufficient:
`NEED N AC`

Keyboard:
arrows, Enter, Escape.

---

# 6. LUCKY DRAW

Cost:
**350 AC**

Pool:
ONLY unowned fighters.

Thus:
- no duplicates;
- no shards;
- no pity;
- all owned -> `ROSTER COMPLETE`.

Canvas:
1672 x 941.

Wheel:
- center around x 620 y 490;
- diameter ~610;
- fixed top pointer;
- procedural canvas/SVG/CSS allowed;
- segments represent current locked pool.

Right:
- preview card;
- cost;
- SPIN;
- locked count;
- `No duplicates`.

Animation:
- ~4.2s;
- quick acceleration, strong ease-out;
- >=4 rotations;
- selected target chosen BEFORE animation;
- visual wheel lands on chosen target.

Transaction:
1. reject if spinning;
2. reject if credits <350;
3. reject if pool empty;
4. choose via injectable RNG;
5. debit once;
6. save debit;
7. animate;
8. grant fighter;
9. save ownership;
10. unlock reveal.

Result:
- existing hero card/frame;
- fighter name;
- `UNLOCKED`;
- buttons `USE NOW`, `SPIN AGAIN`, `BACK TO HUB`.

---

# 7. ARSENAL HUB

Canvas:
1672 x 941.

Reuse accepted pick/background/frame family.

Header:
- `ARSENAL QUEST` left;
- AC balance right;
- `FIGHTERS X / 33`.

Left identity panel:
x ~75 y ~145 w ~500 h ~690.
Shows:
- last-selected fighter;
- standing/card;
- name;
- `SELECTED`;
- one-line identity;
- `CHANGE FIGHTER`.
Default NEWBIE.

Main action grid:
x ~625–1590 y ~160–800.
2x2 tiles:

FREE BATTLE
`Local 1v1 — choose both fighters`

QUEST MAP
`20-stage Arsenal ladder`
show `N / 20 CLEARED`

FIGHTER SHOP
`Direct unlock — 1000 AC`

LUCKY DRAW
`Random new fighter — 350 AC — no duplicates`

Tile interaction:
- hover lift ~6px;
- accent rim;
- press 0.98;
- 120–180ms transitions.

---

# 8. FIGHTER PICK

Existing pick layout is authority.
Do not redesign its coordinates.

When Arsenal pick active:
- roster = OWNED fighters only;
- NEWBIE always present;
- shell type remains canonical Arsenal shell.

Current Arsenal roster emits blank art fields.
V3 must prevent empty cards.

Fallback order:
1. matching committed standing/card/icon;
2. existing generated card/icon asset;
3. runtime procedural HeroCard identity fallback;
4. never empty transparent card.

No arbitrary external portraits.

Free Battle defaults:
- P1 lastSelectedP1 else NEWBIE;
- P2 lastSelectedP2 else NEWBIE;
- defaults are confirmed selections.

Quest:
- P1 lastSelectedP1 else NEWBIE;
- P2 panel = fixed stage opponent;
- opponent may be locked;
- player does not select P2;
- Start enabled when P1 valid.

Invalid saved selection -> NEWBIE.

Locked fighters are not playable carousel entries.

---

# 9. BATTLE HUD

Build final DOM HUD; do not use debug-panel styling.

Top-left P1:
- fighter name/icon/accent;
- HP bar;
- `current / 1000`;
- weapon chip:
  - real sprite;
  - name;
  - rarity rim;
- skill cooldown chip.

Top-right mirrors P2.

Top-center:
Free:
`ARSENAL — FREE BATTLE`

Quest:
`STAGE XX / 20`
opponent below.

HP:
- max 1000;
- immediate updates;
- small damage chip;
- green heal sweep;
- restrained low-HP pulse <25%.

Weapon chip:
- empty = `UNARMED`;
- armed = real weapon sprite/name/rarity;
- do not invent ammo if runtime does not expose truthful remaining uses.

Skill:
- truthful native cooldown;
- NEWBIE: `J — DASH TO PICKUP`.

Result:
Free:
`REMATCH`, `PICK AGAIN`, `HUB`

Quest win:
`NEXT STAGE`, `REPLAY`, `QUEST MAP`, `HUB`

Quest loss:
`RETRY`, `QUEST MAP`, `HUB`

Show AC reward transaction.

---

# 10. RESPONSIVE

Primary canvas 1672x941.

Narrow:
- action grid 2->1 columns;
- shop 4->3->2;
- HUD may hide weapon NAME before hiding HP/sprite.

Minimum touch target ~44 CSS px.

Never hide:
- HP;
- fighter identity;
- result actions;
- AC balance on meta screens.

---

# 11. STYLE LAW

Use existing APEX:
- gunmetal/dark panel;
- warm ivory/metal;
- fighter accent glow;
- existing frames/buttons/background.

Do not introduce:
- generic dashboard;
- broad glassmorphism;
- unrelated neon cyberpunk;
- emoji buttons.

---

# 12. TEST CONTRACT

Expose meta API:
- getState();
- credits();
- owns(name);
- buy(name);
- spin(rng);
- award(reason, amount).

Save:
- clean ->350 + NEWBIE;
- corrupt recovers;
- persistence works;
- Quest save untouched.

Shop:
- no Newbie purchase;
- no double-buy;
- exact debit;
- insufficient rejects.

Wheel:
- exact 350 debit;
- no duplicate;
- excludes owned;
- forced RNG deterministic;
- all-owned disables.

Rewards:
- Quest first clear 150 once;
- replay 40;
- Free complete 25 + winner 25;
- abort 0.

Pick:
- owned only;
- NEWBIE default;
- Quest fixed opponent can be locked;
- saved defaults restore.

HUD:
- 1000 max;
- immediate HP;
- weapon identity truthful;
- unarmed truthful;
- skill cooldown truthful.

---

# 13. REQUIRED EVIDENCE

Normal-scale screenshots:
1. Hub;
2. Shop locked+owned;
3. purchase state;
4. Lucky Draw idle;
5. wheel mid-spin;
6. unlock result;
7. Free Pick with NEWBIE default;
8. Quest Pick fixed opponent;
9. HUD unarmed;
10. HUD armed;
11. result/reward panel.

Checkpoint:
**V3 META UI COMPLETE**
