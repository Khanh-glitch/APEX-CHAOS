# APEX CHAOS — OWNER PLAYTEST PASS A
## Immediate Hit Feedback + Arsenal Navigation Authority
**Date:** 2026-09-25
**Owner status:** production playtest feedback
**Scope:** implementation-ready corrective pass only

---

# 0. LIVE BASELINE

Repository:
`Khanh-glitch/APEX-CHAOS`

Use live Git first.

At authority creation, accepted/deployed content lineage is:

- accepted V1 evidence/source tree: `116d5be2e3993f21407b1f30c27e0623c7e91992`
- Cloudflare production deploy marker: `28da200082af8270d4482120a3f7b29189777d0b`
- current Arena source branch is fast-forwarded to the same deploy marker so future promotion remains linear.

The deploy marker changes no source tree relative to `116d5be...`.

Do NOT implement on `main` or `playtest/arsenal`.
Work only on the current Arena session branch.

Protected unrelated branch:
`prototype/aftermath-32`

---

# 1. OWNER FEEDBACK — AUTHORITATIVE

The owner likes the newly deployed V1 blood direction, but found four new areas:

1. Blood splatter and damage numbers can feel delayed after projectile impact. Blood is the most noticeable. The owner wants hit feedback to read as immediate: projectile reaches the target -> blood and number are already there.
2. Damage numbers are currently too large and several digits are hard to read. A clearer font-based solution may replace the image atlas later.
3. The owner wants a future all-modes combat HUD redesign with the square arena as the dominant center, side HUD information, rolling damage commentary, and an energy meter charged by dealing/taking damage for skills.
4. Arsenal currently appears to enter Quest directly; Shop/Lucky Draw/other Hub destinations are not discoverable and there is no sufficiently visible exit/navigation path. Space usage is also not yet optimal.

This Pass A implements ONLY items 1 and the navigation/accessibility portion of item 4.

Items 2 and 3 are explicitly NOT authorized for implementation yet. They need a separate visual/system authority first.

---

# 2. WHY PASS A IS READY TO IMPLEMENT

Live code audit found two concrete latency/navigation causes.

## 2.1 Damage-number latency is real

In:
`public/game/arsenal/arsenalFeelRuntime.js`

`noteDamage()` currently delays first popup creation for aggregated families:

- AUTO: `windowMs = 110`
- SHOTGUN: `windowMs = 50`

The first hit is stored in `agg`; the popup appears only after the aggregation window expires or a later event flushes it.

That violates the owner's desired hit feel.

## 2.2 V1 blood can be aged before its first rendered frame

Current Arsenal simulation order is effectively:

- projectile update / collision
- V1 emit at real collision
- later in the SAME simulation step: `AQ.feel.tick(dt)`
- draw

So newly-created V1 transient particles can lose life / move before they are ever rendered once.

The owner wants:
**collision frame -> unmistakable full initial blood response**, not a response whose strongest visible read develops later from landing marks.

## 2.3 Arsenal menu bypasses its own Hub

In:
`src/App.jsx`

the main menu Arsenal button currently uses:

`action: 'beginArsenalQuestMap'`

But the meta runtime already exposes:

`window.beginArsenalQuestSelection = function () { openHub(); }`

and Hub already contains:

- FREE BATTLE
- QUEST MAP
- FIGHTER SHOP
- LUCKY DRAW

Therefore the main menu currently bypasses the intended Arsenal Hub.

---

# 3. PASS A — HIT FEEDBACK LAW

## 3.1 Blood must be perceptually immediate

For a firearm projectile collision, the FIRST rendered frame after the collision event must already show:

- the V1 core at the exact real collision point;
- visible V1 directional streak language following the real projectile vector;
- full/fresh initial opacity appropriate to the approved V1 reference;
- the persistent main V1 floor decal already stamped;
- no waiting for medium/micro landing marks to make the hit readable.

Landing marks may continue to appear later exactly as V1 specifies, but they are secondary accumulation. They must never be the first moment when the hit becomes visually obvious.

### Implementation freedom

The Agent may choose the smallest robust mechanism after inspecting the frame pipeline, for example a “born this simulation tick / first-frame protected” transient state, but the behavioral law above is the authority.

Do NOT:
- increase blood brightness into neon;
- turn blood orange on crit;
- add radial burst;
- add new cones;
- change V1 counts/physics just to fake immediacy;
- recalculate gameplay damage;
- add an artificial pre-impact effect.

Keep the approved V1 identity.

## 3.2 Damage numbers must appear immediately

The first positive damage event in an AUTO or SHOTGUN aggregation sequence must create visible feedback immediately, no intentional 50/110 ms blank period.

Preserve aggregation semantics, but change the presentation model to **immediate-first aggregation**:

- first normal hit -> create red popup immediately;
- first crit hit -> create orange popup immediately;
- subsequent hits inside the existing aggregation window update/accumulate the already-live popup rather than waiting to create the first one;
- mixed normal + crit remains semantically split into normal red total and crit orange total;
- shotgun blast semantics remain truthful;
- AUTO/BURST aggregation still prevents unreadable number spam.

The owner is asking to remove perceived latency, NOT to remove aggregation.

## 3.3 Frame-level acceptance

Real-browser evidence must prove:

- projectile collision occurs;
- blood core/streak is visible on the immediately following rendered frame;
- damage popup is visible on the immediately following rendered frame for SEMI;
- AUTO and SHOTGUN have an immediate first popup while later hits update the aggregate;
- no delayed “nothing -> blood appears later” behavior.

Do not validate this only with final screenshots. Use frame-stepped/browser instrumentation or a short sequence proving event-to-first-render timing.

---

# 4. PASS A — ARSENAL NAVIGATION LAW

## 4.1 Main-menu entry

Clicking the main-menu Arsenal button must enter:

**ARSENAL HUB**

not Quest Map directly.

Use the existing Hub/meta system; do not build a parallel menu.

Expected top-level Arsenal flow:

MAIN MENU
-> ARSENAL HUB
-> FREE BATTLE
-> QUEST MAP
-> FIGHTER SHOP
-> LUCKY DRAW

## 4.2 Visible exit/back navigation

Keyboard Escape is not sufficient.

There must be clear visible navigation:

- Arsenal Hub: visible **EXIT / MAIN MENU** action.
- Fighter Shop: BACK -> Hub (existing behavior may be reused).
- Lucky Draw: BACK -> Hub (existing behavior may be reused).
- Quest Map: visible BACK -> Hub.
- Free Battle fighter pick: visible BACK/EXIT -> Hub rather than trapping the player.
- During an active Arsenal battle: preserve current battle behavior, but provide a discoverable way out; do not rely solely on hidden keyboard knowledge.
- Quest post-match actions continue to support Quest Map / retry/next as currently accepted.

Do NOT route every BACK directly to global Main Menu. Within Arsenal, Hub is the navigation root. Only the Hub's EXIT action returns to the global Main Menu.

## 4.3 No economy/gameplay redesign

Do not alter:
- AC costs;
- owned roster rules;
- Shop pricing;
- Lucky Draw pool/no-duplicates;
- Quest rewards;
- Quest stage rules;
- Free Battle selection rules;
- NEWBIE fallback;
- V1 combat;
- x7 damage;
- crit;
- spawns/heals.

This is routing/accessibility only.

---

# 5. EXPLICITLY DEFERRED — DO NOT IMPLEMENT IN PASS A

## 5.1 Damage-number typography redesign

Owner feedback:
- current scale is too large;
- several atlas digits are unclear;
- likely direction is a downloaded/runtime font with a similar manga/combat personality but clearer numerals.

Do NOT let the coding Agent choose a random font.
Do NOT remove the current atlas yet.

A separate typography authority will compare/approve a font and new scale first.

## 5.2 Global combat HUD redesign

Future scope applies to ALL battle modes, not Arsenal only.

Owner concept to develop separately:
- square arena remains dominant;
- unused side space becomes purposeful combat HUD;
- existing fighter name + HP are reorganized;
- rolling per-side damage accumulation over a short time window can generate concise commentary-style lines;
- future energy meter charges from dealing and/or taking damage;
- energy becomes a resource for skill use.

This changes combat information architecture and potentially skill economy.
It requires design/system proof before implementation.

Agent must NOT invent this system in Pass A.

---

# 6. REGRESSION FLOOR

Keep green:
- approved V1 real collision metadata;
- all 8 V1 blood gates;
- 24-firearm x7 identity audit;
- normal red / crit orange / heal green semantics;
- grenade/melee/native laws;
- crit RNG isolation;
- spawn cadence/cap/emergency rules;
- heal rules;
- Free Battle owned-only;
- Quest selection/stage rules;
- Shop/Lucky Draw economy and persistence;
- build;
- launcher smoke;
- full browser suite.

Do not weaken tests.

---

# 7. REQUIRED NEW TEST/EVIDENCE

Add meaningful gates for:

1. Arsenal main-menu action resolves to Hub, not Quest Map.
2. Hub exposes Free Battle / Quest / Shop / Lucky Draw.
3. Hub visible EXIT returns global Main Menu.
4. Shop BACK -> Hub.
5. Lucky Draw BACK -> Hub.
6. Quest Map BACK -> Hub.
7. Free Battle picker can visibly return to Hub.
8. firearm V1 first-visible-frame immediacy.
9. AUTO first popup immediate + later aggregate update.
10. SHOTGUN first popup immediate + aggregate remains truthful.

Fresh real-browser evidence:
- global menu -> Arsenal Hub;
- Hub -> Shop -> Back;
- Hub -> Lucky Draw -> Back;
- Hub -> Quest Map -> Back;
- Hub -> Free Battle -> Back;
- Hub -> Main Menu exit;
- frame-sequence evidence for normal hit;
- frame-sequence evidence for AUTO or rapid fire;
- frame-sequence evidence for shotgun.

---

# 8. DELIVERY

Agent must:
1. fetch live Git first;
2. report source SHA and current session-pinned branch;
3. read this file + current V1/V3 authorities;
4. implement only Pass A;
5. show intended diff;
6. run full headless/build/launcher/browser validation;
7. capture fresh evidence;
8. push only current Arena session branch;
9. require green CI on final non-skip-CI implementation SHA;
10. stop for owner playtest.

Do not promote main/playtest automatically.
Do not begin typography/HUD/energy implementation.
