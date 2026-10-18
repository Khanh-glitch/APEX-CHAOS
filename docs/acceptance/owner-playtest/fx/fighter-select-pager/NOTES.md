# Fighter Select — Roster Pager (r8) — Acceptance Notes

**Scope (owner order):** close Fighter Select on phone/tablet without a Gold redesign.
Phone shows six fighters per view (portrait 3×2) with explicit page buttons/indicators
and swipe; tablet must not cover LOCK or the hero preview; desktop keeps canonical Gold.

## What changed (single source: `tools/goldShellR52pickBand.mjs`, the sole pick-band writer)

- **Page law for phone bands only** (portrait + compact-landscape): the roster
  scrollport gains mandatory page snap (`scroll-snap-type:x mandatory`,
  snap-align on every 6th card) and `touch-action:pan-x`. Desktop CSS untouched.
- **Pager chrome, Gold-native:** 3 page dots in the selection header (left of the
  APPEARANCE entry) and prev/next chevrons (22×46) in the deck side margins.
  14 fighters = pages 6 / 6 / 2; the last page is **end-aligned** (final six on
  screen, fighters 13–14 at the right edge), matching where mandatory snap rests.
- **Authority split stays canonical:** the pager script
  (`window.APEX_ROSTER_PAGER`, injected by the same generator) only scrolls the
  port and mirrors state. It never calls `selectHero`/`lockCurrent` (gate-pinned).
  Arrow keys remain the shell's (hero move); pager buttons are native buttons
  (Tab + Enter/Space).
- **Selection/page consistency:** when the SELECTION identity changes (either
  side) across a page boundary — e.g. keyboard move — the pager aligns the port
  to the selected fighter's page. Free paging never snaps back. First sighting
  per side is a baseline (pick still opens on page 1 with the default fighter).
- **Honest chrome:** selection cursor track now scales to the live roster size
  (`--cursor-n` = 14, was hard-coded 6 segments → cursor left its track from
  fighter 7); header meta reads the true count ("14 FIGHTERS // ONE CONFLICT", was "6 FIGHTERS").

## Acceptance — `tools/testFighterSelectPagerBrowser.mjs` (real CDP touch, 29/29 PASS)

| Context | Result |
|---|---|
| A 390×844 BOT | page1 = first six 3×2; chevron→page2 settles exactly on page start (sl 335); tap SHURI (page-2 hero) for P1; LOCK→BOT phase; dot 3→end-aligned last page (13–14 reachable); swipe back settles on page start; keyboard walk: 6 moves within playable set, pager follows every page-crossing; tap ROBOT for BOT; LOCK→live battle (HUD 1p); ESC→back at Pick, pager still navigates |
| B 430×932 Local | P1 ROBOT from a later page; P2 SHURI on the same page; LOCK×2→live battle (HUD 2p) |
| C 932×430 landscape | six per view; chevron pages by six; deck never covers LOCK (overlap 0px); LOCK topmost at its center |
| D 768×1024 tablet | 3×2 paging; deck covers neither LOCK nor hero preview |
| E 1366×768 desktop | pager chrome hidden, canonical scrollport kept; meta honest; cursor on-track for fighter 14 |

Static law: `testGoldPickBandLawGate` PASS 79 (incl. 9 pager pins),
`testGoldFighterPickAdaptationGate` PASS 14, `testPickPresentationGate` PASS 15,
`buildGoldCutover --check` OK (71 files deterministic). Runtime revision
r7→r8, 66 versioned runtimes relocked.

## Screenshots (this folder)

- `A-390-page1.png` — phone page 1, dots + chevrons
- `A-390-page2-shuri.png` — SHURI selected from page 2
- `A-390-page3-swipeback.png` — after swipe-back, settled on page start
- `A-390-battle.png` — LOCK×2 → live battle
- `B-430-local-pick.png` — Local 2P pick (ROBOT vs SHURI)
- `C-932-land-page2.png` — phone landscape page 2
- `D-768-tablet.png` — tablet portrait
- `E-1366-desk.png` — desktop unchanged (canonical)

## Findings recorded during acceptance (not pager defects)

1. **Keyboard stalls at locked fighters (canonical, pre-existing):**
   `moveHero(±1)` steps one slot; `selectHero` rejects ownership-locked heroes,
   so arrow-walking stops at the first locked neighbour (e.g. SHURI →→ BLACK
   HOLE). Touch/dots reach every page regardless. Left as-is (shell logic is
   outside this change's boundary); flagged for owner awareness.
2. **Quest onboarding hijack:** after an early free battle, locking NEWBOT
   routes into the Quest 01 "REFLEX" interlude. Product behaviour by design;
   the gate isolates storage per context so pager acceptance stays independent.
3. **Dev-server desync:** long-running Vite can serve the SPA fallback for some
   `public/gold/*` assets after a cutover rebuild (shell mount then fails on
   image decode and the boot transition holds sealed). Restart Vite after every
   rebuild; the gate's boot retry documents the recovery.

R91 (r6/r7) is untouched by this change and still awaits owner Gold
visual-parity approval. No merge, no deploy.
