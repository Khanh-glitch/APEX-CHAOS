# APEX CHAOS // REVISION 2 — QUEST UX GAP AUDIT

**Date:** 2026-09-25  
**Audited implementation:** `99fe9d6fbbd113707c8848c1bb41b326a8d1e37b`  
**Evidence tip:** `c76fa65779cb5096975039dd0e314216e6238b51`  
**CI:** `36068919296` — 145/145 headless, 83/83 browser  
**Status:** CONTINUATION REQUIRED — Quest V1 UX contract is not complete.

All non-Quest Revision 2 work may remain unchanged unless a regression is found.

## 1. Stage selection bypasses P1 shell choice

Contract requires:

`click unlocked stage -> choose P1 shell -> start with fixed P2 stage opponent`

Current `arsenalQuestLadder.js::startStage(n, p1Name)` defaults to:

`p1Name || 'NEWBIE'`

and the stage-map click handler calls:

`startStage(stage, 'NEWBIE')`

Therefore Quest currently hard-selects NEWBIE instead of routing through the existing Arsenal shell-selection UI.

Required:
- stage click stores a pending quest stage/opponent;
- open/reuse the existing Arsenal P1 shell selector;
- once P1 is chosen, start the selected quest stage with that P1 and fixed P2;
- do not create a duplicate roster renderer;
- cancel/back returns safely to Quest Map.

## 2. Quest match-end actions are missing

Contract requires:

On win:
- NEXT
- REPLAY
- QUEST MAP

On loss:
- RETRY
- QUEST MAP

Current `arsenalQuestRuntime.js::syncDomHud()` still renders the generic:

`T — REMATCH      B — MENU`

for quest matches.

`onMatchOver()` records progress but does not provide Quest-specific match-end actions.

Required:
- when `state.questStage` exists, use Quest-specific result UI;
- win: record completion/unlock and offer NEXT (unless stage 20), REPLAY, QUEST MAP;
- loss: RETRY, QUEST MAP;
- actions must preserve selected P1 where appropriate for replay/next unless user chooses to reselect;
- free-play keeps its current rematch/menu behavior.

## 3. Quest map API is not exported

`showMap()` is defined in `arsenalQuestLadder.js`, but the exported `window.APEX_ARSENAL_QUEST` object currently omits it.

Therefore the completion report claim:

`APEX_ARSENAL_QUEST.showMap()`

does not match the audited export.

Required:
- export `showMap`;
- provide at least one normal UI entry path to open the map;
- browser-test the public API and the UI entry path.

## 4. Required correction tests

Headless/deterministic:
- stage-map selection creates pending quest stage but does not auto-start NEWBIE;
- chosen P1 is passed to `startStage`;
- stage P2 remains fixed by the stage table;
- win actions contain NEXT/REPLAY/QUEST MAP;
- loss actions contain RETRY/QUEST MAP;
- stage 20 omits/disables NEXT correctly;
- free-play still has its original result behavior;
- `APEX_ARSENAL_QUEST.showMap` exists.

Real browser:
- open Quest Map from the normal UI;
- click stage 1 -> existing P1 shell selector opens;
- choose a non-NEWBIE shell -> fight starts as that shell vs PAINTER;
- win stage 1 -> NEXT / REPLAY / QUEST MAP visible;
- NEXT launches stage 2 with correct fixed opponent;
- lose a stage -> RETRY / QUEST MAP visible;
- Quest Map returns and reflects completed/unlocked state;
- reload persistence still works.

Do not move `playtest/arsenal` until this audit closes.
