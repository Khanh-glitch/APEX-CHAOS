# APEX CHAOS — Gold Cutover Correction Slice (r43) — Evidence Record

Date: 2026-10-05
Branch: `arena/01a10805-apex-chaos`
Slice start (closure SHA): `72a15d20b04658f2c2a2539ae7e20296a9aaad5a`
New runtime/product revision: `20261005-gold-cutover-r43` (replaces `20261003-mirror-v1-r42`)

Scope: focused pre-playtest correction slice only. No Gold redesign, no canonical
Gold re-authoring, no branch reset, no broad architecture audit re-run.

---

## 1. Corrections implemented

### P0-A — ONE product music authority (Forward Drive)
- New plain runtime `public/game/product/productMusicAuthority.js` owns the ONE
  persistent `HTMLMediaElement` for `/assets/audio/forward_drive_theme.ogg`, the
  surface policy, the 380 ms fades (owner band 300–450 ms), the `M` music-only
  mute and the hidden/blur + visible/focus resume. It is versioned in
  `src/game/runtimeManifest.js` (Tier 1, cache-busted by the revision).
- `src/App.jsx` no longer creates its own music element: it installs the
  authority and consumes the SAME element (`music.audio`). The App's legacy
  `apexStopMenuMusic` / `apexPlayMenuMusic` / `__apexMenuBgmState` probes read
  that one element; `stopMenuMusic` fades through the authority.
- `public/game/gold/goldProductBridge.js` no longer creates a second `Audio`
  theme object and no longer owns an `M` handler: it only tells the authority
  which product surface is showing (`BRIDGE.onSurface`) and fades the theme out
  for a real match start (playhead preserved, never reset).
- Surface policy: allowed `{home, mode, fighter, transition}`; disallowed for
  Lucky Draw / Upgrade / Missions / Shop / live battle.

### P0-B — BOT opponent identity is ONE truth
- `public/game/arsenal/arsenalShellSelectRuntime.js` publishes the production
  CPU identity: `BOT_OPPONENT_ID = 'ROBOT'` → `APEX_ARSENAL_SHELLS.botOpponentId()`.
- The bridge publishes `APEX_GOLD.botOpponentProductionId()` /
  `.botOpponentShellKey()` (derived from production, `'ROBOT'` fallback) and the
  live handoff derives P2 from it instead of a hardcoded presentation identity.
- Generator patch `SHL-S22`: the shell's `makeBattleConfig` and
  `setTransitionIdentity` derive the presented BOT from `botHeroId()` (production
  authority). The previous hardcoded `heroPayload('frost','newbot')` presentation
  is gone.

### P0-C — production key law + the narrow Local P2 seam
- `public/game/hero-rework/heroReworkRuntime.js`: Local P2 `Digit1`/`Digit2`
  route through the canonical `HR.pressAbility(f, slot)` path (guarded by
  `gameState === 'ARSENAL'`, rework fighter and `battleMode === 'LOCAL'`, with an
  `e.repeat` guard). `p2CastAI` returns early for a Local player-controlled P2
  only; BOT P2 stays CPU and P1 `J`/`K` are untouched.
- Generator patch `HUD-H28` + the bridge `keyLabels`: the HUD shows P1 `J`/`K`,
  Local P2 `1`/`2`, BOT P2 `CPU`. The donor's misleading `LOCAL · U I E` copy and
  the manual W/E swap claims are removed.

### P0-D — real skill state projection
- The bridge projects REAL production truth per frame
  (`ct.skills[slot].{charges, rechargeLeft, cdLeft}` + `cooldownLeft(slot)`),
  including authored `maxCharges`/`cooldown`. A Cast event is a visual cue only
  (`HUD-H29a`) and can never become cooldown authority; the donor no longer
  invents its own charge/readiness transitions (`HUD-H29b/c`).
- Multi-charge proof hero: HUNTER A1 `hunter.snare` (`maxCharges: 3`, cd 6.5).

### P0-E — elapsed-time truth, no fabricated state
- The projection reports `timeSemantics: 'elapsed'` and `roundAuthority: false`.
- Generator `HUD-H27a/c`: `renderTimer` never marks countdown-urgent and
  suppresses the round number and best-of-three win pips when production owns no
  round authority (the strip is hidden, composition preserved). The donor's own
  countdown decrement/TIME-KO was already removed by `HUD-H8`.

### P1-F — Fighter Shop is a locked extension point
- `src/game/productSurface.js`: `fighter-shop` `ACTIVE → LOCKED` (the `shop`
  route is kept as the declared extension point). Non-ACTIVE surfaces already
  open the `product-lock-dialog`, so the route is genuinely non-launchable
  (`canLaunch('fighter-shop') === false`), not merely visually disabled.

### P1-G — production-visible roster, no hard cap
- The bridge publishes `APEX_GOLD.roster()` / `.rosterOrder()` / `.isPlayable()`
  covering EVERY production-visible fighter (12: Core Six playable + 6 locked
  future fighters), with `APEX_GOLD_LOCKED` also gating `playable === false`.
- Generator `SHL-S23`: roster order derives from that authority and locked future
  fighters render as disabled locked cards (`.rosterLock`), never fake mechanics
  and never silently omitted.

### P1-H — revision + cache hygiene
- `APEX_ARSENAL_RUNTIME_REVISION = '20261005-gold-cutover-r43'`; the generator
  versioned the Gold shell / Lucky Draw / battle-hud URLs with `?v=${REVISION}`
  from a single deterministic read (no random timestamps).
- `tools/runtimeRevision.lock.json` regenerated: 38 versioned runtimes.
- `tools/testRuntimeRevisionGate.mjs` expects the new revision and requires the
  new music runtime to stay versioned.

---

## 2. Cross-law diagnosis (the slice's final open item)

`law2-production-ready-edge-projects-ready-once` failed with production
`cooldownLeft: 0, charges: 1` against a projection of `charges: 0, nextIn: 1.369`.

Diagnosis: **harness sampling bug (case B), not a bridge defect.** Several
independent rAF consumers share the frame queue, so a fixed `stepFrame()` count
does not prove the Gold bridge pump emitted a projection after the production
change. The harness now carries a monotonic projection sequence and drains until
`projectionSequence > sequenceBeforeReady`, then asserts the FIRST fresh
post-edge projection. That first fresh projection already reports production
truth (`charges: 1, nextIn: 0, max: 3, truth: true`), so the bridge projection
is correct and no production/bridge behaviour was altered to satisfy the test.

A real defect WAS found and fixed while making the App consume the authority:
`installProductMusicAuthority()` returned the API object instead of a stable
handle on the idempotent re-install path, which would have left the App without
its element reference. It now returns `{ api, audio, dispose }` in both paths,
and a new cross-law gate proves a re-install creates no second element.

---

## 3. Verification results (this workspace)

| # | Gate | Result |
|---|------|--------|
| 1 | `node tools/buildGoldCutover.mjs` | WROTE 70 files |
| 2 | `node tools/buildGoldCutover.mjs --check` | CHECK OK — 70 generated files match `public/gold` (idempotent) |
| 3 | NEW `tools/testGoldCrossLawHeadless.mjs` | **27/27 PASS** |
| 4 | `tools/testGoldBattlePathHeadless.mjs` | **21/21 PASS** |
| 5 | `tools/testShellHudHandoffProtocolHeadless.mjs` | **16/16 PASS** |
| 6 | `tools/testLuckyDrawProductionTruthHeadless.mjs` | **14/14 PASS** |
| 7 | `tools/testProductionSourceHygiene.mjs` | 42 production / 34 quarantined / 5 retired orphans / 0 stale pointers / 0 leaks |
| 8 | `tools/testRuntimeRevisionGate.mjs` | PASS `20261005-gold-cutover-r43`, 38 versioned runtimes |
| 9 | `tools/assetAudit.mjs` | 970 files, 0 missing, 0 errored |
| 10 | `pnpm build` | built in ~1.6 s; 261 assets; 32,303,748 bytes; 0 forbidden runtime survivors |
| 11 | `tools/pruneShippingDist.mjs` + `tools/testShippingDist.mjs` | 261/261 shipping files; 0 non-shipping leaks; 0 forbidden manifest entries |
| 12 | Touched production regressions | `testArsenalBattleHeadless` **340/340**; `smokeHeroReworkHeadless` **18/18**; `testArsenalProductGraph` PASS; `testArsenalLegacyMechanicIsolation` PASS; `testHeroReworkGoldens` **9/11** |

### Cross-law suite coverage (27 gates, all six laws)
1. BOT presented === handoff === really spawned identity (3 gates + shell derivation).
2. Cast event === real production cooldown === next-frame HUD cooldown (7 gates,
   HUNTER A1 multi-charge: real charge consumption, usable-while-charges-remain,
   depletion → cooling, midpoint cooling, exact production-ready edge on the
   first fresh projection, multi-charge preserved, Cast cannot become authority).
3. HUD control label === accepted production key (5 gates: P1 J/K, BOT P2 no
   human path, labels J/K + CPU, Local P2 1/2 reaches production, Local labels
   1/2, no donor U I E copy, P2 AI master untouched).
4. Theme displayed policy === media-element playback policy (8 gates: one
   element, Forward Drive source, re-install creates no second element, allowed
   surfaces really play, disallowed surfaces really stop, playhead preserved,
   M mutes music only, blur/focus policy).
5. Visible roster === production-visible authority (2 gates: 12 visible === 12
   production-visible, every entry covered, Core Six playable, 6 locked).
6. Timer/round/wins shown === real production authority (3 gates: elapsed
   semantics, no fake round/win state, opening time not countdown-urgent).

### Protected-failure comparison vs the accepted baseline
- Baseline `72a15d20` `testHeroReworkGoldens`: 9/11 with
  `golden-crystal-reflect-ice-payload`, `golden-rubber-stores-reflected` failing.
  This slice: the same 9/11 with the same two failures (verified by running the
  baseline in a clean `git worktree`). No new protected regressions.
- Baseline `testArsenalBattleHeadless`: 337/338 (`multi-slot-coexist`, flaky).
  This slice: 340/340 after the four gates that encoded the pre-correction
  product state were updated to the corrected law (Fighter Shop LOCKED, Local P2
  player-controlled) — see below.
- `tools/testShellHudHandoffProtocolHeadless.mjs` asserted the handoff P2
  productionId was the hardcoded `ICE` presentation; it now asserts the single
  production BOT truth (`ROBOT`) that presentation, handoff and the spawned
  fighter all share.

Gates updated because this slice intentionally changed the law (not weakened):
- `rev2-product-four-active-surfaces` → active surfaces are the battle entries +
  draw (3), shop locked and genuinely non-launchable.
- `rev2-product-six-public-future-surfaces-locked` → locked public surfaces = 7.
- `rev2-bot-local-are-the-active-battle-entries` → bot/local launchable, locked
  shop not launchable.
- `postc-p2-still-auto` → split into `postc-p2-local-is-player-controlled-not-auto`
  (Local P2 has no cast AI) and `postc-p2-bot-still-auto` (BOT P2 still auto-casts,
  proven in a real BOT-profile match) — strictly stronger than the old gate.
- `handoff-message-carries-production-truth` → single BOT production truth.

---

## 4. Remaining owner / browser-only verification items

Not provable in this sandbox (no real browser executable; no GPU; no touch
measurement):
- Real-browser visual acceptance of the Gold surfaces (Home, Mode, Fighter pick
  with locked future-fighter cards, transition, battle HUD, Lucky Draw).
- Forward Drive audible continuity/fade behaviour and playhead preservation in a
  real media element, including autoplay-policy behaviour before the first
  gesture.
- `M` mute interaction with real battle SFX (music-only) in a live match.
- HUD readability/contrast and touch-target geometry on real devices.
- Owner playtest of the Local P2 `1`/`2` control feel and the elapsed-time HUD.
- Cross-device confirmation that the revisioned Gold URLs are served fresh
  (no stale prior cutover artifact) during owner verification.

No claim of browser visual acceptance, GPU parity, measured touch geometry or
owner acceptance is made by this record.
