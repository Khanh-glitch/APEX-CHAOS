# ARSENAL QUEST V2 — CHECKPOINT B REPORT

Status: IMPLEMENTED + VERIFIED — STOP for owner playtest.
Implementation branch: `arena/01a0cf5e-apex-chaos`.
Playtest branch `playtest/arsenal` untouched at `c83f419` (frozen Checkpoint A).
Authoritative spec: `V2_CHECKPOINT_B_HANDOFF.md`. Companion doc:
`V2_ROSTER_COMPATIBILITY_MATRIX.md`.

This pass combines the owner's Checkpoint A playtest corrections with
Checkpoint B weapon motion language, implemented in the handoff's internal
order (1 cadence → 2 reveal → 3 matrix → 4 roster impl → 5 pose architecture
→ 6 12 recipes → 7 QA/evidence → 8 report).

## 1 — A-CORR-1 spawn cadence 4.5s

- `arsenalQuestConfig.js`: `SPAWN_CADENCE_SECONDS: 4.5` (2/3 of the 3.0s A
  build); first-spawn delay unchanged (1.0s); multi-slot coexistence kept.
- Measured in Chrome (browser gate `spawn-cadence-4.5s`):
  `spawnTimes=[1,5.6,10.1,14.6,19.1] gaps=[4.6,4.5,4.5,4.5]` — spawn density
  is exactly 2/3 of Checkpoint A's 3.0s cadence, no slot flood (soft cap and
  `SPAWN_SUPPRESSED` logging unchanged).

## 2 — A-CORR-2 whole-circle reveal + failsafe

- Shared config value `REVEAL_CIRCLE_RADIUS: 42` (== `PICKUP_RADIUS`). The
  rendered telegraph circle now draws at exactly this radius (pulse moves
  alpha/line-weight only), and `predictContactETA()` performs a ray/circle
  intersection of the fighter's CURRENT straight movement segment against it:
  inside-circle → eta 0; entry within the fixed `REVEAL_LEAD_SECONDS: 2.0`
  lead → that entry eta; near miss outside the circle → stays hidden; wall
  bounce before entry → stays hidden (recomputed naturally after the bounce).
  The old centerline gate and the old broad multi-bounce predictor are gone.
- Failsafe: `FORCE_REVEAL_AGE_SECONDS: 3.0` — a slot hidden 3.0s
  force-reveals (`REVEAL ... force=true`, fighter=TIMEOUT), becomes a normal
  collectible, and weapon identity stays null until that moment.

Browser evidence (Chrome, `docs/arsenal-quest/browser-evidence/`):
| Gate | Result |
|---|---|
| `reveal-lead-fixed-2.0` | leads [2,2,2,2,2]; also fixed over the 5-min run (4.5k samples) |
| `edge-of-circle-approach-reveals` | 25px-off-center path (inside visible circle) reveals `eta=0.80 force=false` (`18-v2-edge-of-circle-reveal.png`) |
| `near-miss-outside-circle-stays-hidden` | 60px-off-center path (outside visible circle) stays TELEGRAPH through the whole pass (`19-v2-near-miss-stays-hidden.png`) |
| `no-reveal-before-bounce` | hidden at 0.03s pre-bounce; reveals only after the bounce on the new segment |
| `force-reveal-at-3.0-not-autopickup` | hidden+identity-null at age 2.9; force reveal at 3.0; then collected normally by HERO |
| `hidden-until-force-age-3.0` / `telegraph-no-identity` | no identity leak before reveal |

## 3 + 4 — 32-fighter roster compatibility (A-CORR-3)

- `V2_ROSTER_COMPATIBILITY_MATRIX.md` audits every canonical fighter
  individually against the engine code: **30 KEEP, 2 ADAPT, 0 whole-kit
  SUPPRESS**; rage variants remain suppressed roster-wide via `noRage`
  (single documented global rule — no blanket no-op `update` anywhere).
- Implementation is data-driven: `COMPAT_PROFILES` table in
  `arsenalShellSelectRuntime.js` + guarded delegation of
  `init/update/speedModifier/onWallBounce/onCollide/onTakeDamage/draw`, so a
  native fault can never corrupt Arsenal pickup/reveal/holder state.
- **Post-boot identity resolution** (the critical discovery of this pass):
  mainline boot patches re-key three canonical fighters — `NOVA→GALAXY`
  (`galaxyRuntime.js` GALAXY_REPLACES_NOVA_PATCH), `WIND→PUPPET` and
  `MONK→KUNGFU` (`apexCanonicalBalance.js`, kit rewrite in
  `apexPrecisionFixes.js`). Checkpoint A shells therefore rendered gray
  fallback blobs for these three. `IDENTITY_ALIASES` now resolves the shells
  to the CURRENT live identity while cards/engine hooks/QA keep canonical names.
- ADAPT hooks (`f.type.arsenalShell`-keyed, three sites because the kit is
  rewritten at boot): VAMPIRE latch 5.0s→2.5s (`apexEngine.js` +
  `apexCanonicalBalance.js` ×3 fang-bite variants); MONK/KUNGFU trauma
  rush/stun 5.0s/4.2s→2.5s (`apexEngine.js`, `apexPrecisionFixes.js`,
  `apexCanonicalBalance.js`).

Browser evidence: `roster-all-32-classified-keep-or-adapt`
(adapted=[VAMPIRE,MONK]), `roster-keep-native-skill-runs` (ICE shell casts
its frost lane in Arsenal), `roster-adapt-vampire-latch-2.5`
(`latchTimer=2.5`), `roster-adapt-monk-rush-2.5` (`rushTimer=2.5`),
`roster-native-skill-and-weapon-coexist` (WITCH rays + aq bullets present in
the same frames, holder intact), `shells-native-kits-active-in-arsenal`
(native projectiles > 0 while HP stays in (0,100]).

## 5 + 6 — weapon pose architecture + 12 motion recipes

- Isolated state `weaponPose = { recoil, rotKick, localX, localY, scaleX,
  scaleY, flourish, pulses, t }` on `holder.meta.pose`, integrated by
  per-weapon spring recipes (`POSE_RECIPES`); consume() snapshots a pose
  *ghost* so recoil settles / throws / thrust returns stay visible a beat
  after the weapon leaves the hand. Presentation consumes the pose in
  `drawWeaponWithPose()`; the fighter body is never touched
  (`motion-browser-body-untouched` true for all 12).
- Measured signatures in Chrome (motion gates + 12 screenshots
  `21-v2-motion-*.png`):

| Weapon | Spec | Measured |
|---|---|---|
| PISTOL | 3 pulses, 12–16px, fast spring | pulses=3, recoil 14, rotKick 0.10 |
| SHOTGUN | one heavy 24–32px, slow settle | ghost recoil 28, rotKick 0.24 |
| SMG | 8 micro pulses, alternating jitter | pulses=8, jitter ±0.06 |
| SNIPER | flourish spin in latter aim, snap on target, long recoil | flourish 8.99 rad mid-aim, snap to 0 at fire, recoil 34, chamber SFX cued |
| GRENADE | backward draw → forward throw | draw −18px seen, ghost throw +30px |
| SABRE | backswing → fast cut | windup −0.74 → strike +0.45 |
| BATTLE_AXE | raise/windup, heavy chop, slower recovery | windup −1.25 + lift −10.5, strike +0.75, returnTau 0.20 > sabre 0.10 |
| DAGGER | weapon-only 60–90px thrust | peak 78px, body dx=0 (`21-v2-motion-dagger.png` shows the stab landing −8.6 while the body sits still) |
| SPEAR | long narrow 90–120px thrust, controlled return | peak 108px |
| SPIKED_CLUB | backswing + blunt smash, heavier easing | windup −0.99 → strike +0.62, returnTau 0.17 > sabre |
| SWIRL_SHIELD | faces opponent, idle settle, reflect pop | 4 idle wobble sign flips; reflect pop recoil −16 |
| TOWER_SHIELD | forward guard pose, block pushback/tilt | guard offset +11.8px; block recoil 12 + rotKick 0.14 |

- `motion-12-distinct-recipes` verifies all 12 recipe objects are unique.
- Slash/swipe VFX remain disabled and the bomb explosion atlas remains
  (`no-slash-vfx-in-combat`, `bomb-explosion-vfx-remains` PASS).
- Aim law intact: `aim-never-steers-fighter`, `dagger-no-body-dash` PASS.

## 7 — QA summary

| Runner | Result |
|---|---|
| Headless (local, 12× stability loop) | 90/90 PASS, zero flakes after the slow-status flake fix |
| Headless (CI Chrome-adjacent, run 35973561501) | 90/90 PASS |
| Real Chrome browser (CI) | 69/69 PASS, 0 FAIL |
| 5-min mixed-fighter stress (Chrome) | no uncaught errors, earlyErrors=0 (native kits + weapons running together) |
| Asset/AV gates | 63/63 images, 21/21 audio, atlas floor+equipped sprites rendered |

CI: run `35973561501` — SUCCESS on `3ef1aea`; evidence refresh commit
`fddddf0` pushed by the workflow.

## 8 — Prohibitions honored

- Checkpoint C UI/UX overhaul NOT started.
- Deployment infrastructure untouched; no ZIP created.
- `playtest/arsenal` untouched at `c83f419` (verified via `git ls-remote`).
- Only `arena/01a0cf5e-apex-chaos` received commits.

## Stop

Reporting final Arena SHA and stopping for owner playtest. The lead/reviewer
may now move `playtest/arsenal` once for the single Cloudflare playtest build.
