# ARSENAL QUEST V2 — CHECKPOINT A REPORT

Issue: #5 — Arsenal V2 Checkpoint A (movement, aim, 32 shells, centerline reveal)
Authoritative spec: `docs/arsenal-quest/V2_MAJOR_PASS_HANDOFF.md` (Checkpoint A only)
Session branch: `arena/01a0cf5e-apex-chaos` (layered on `prototype/arsenal-v2-motion-ui` @ `bea67bc`)
Report-finalize commit: the commit containing this sentence
(`git log -1 -- docs/arsenal-quest/V2_CHECKPOINT_A_REPORT.md`).

Checkpoint B (weapon motion) and Checkpoint C (UI) were NOT started. Owner
playtest of A is the gate before B.

## What changed (A1–A5)

### A1 — Weapons never steer fighters
- `public/game/arsenal/arsenalWeaponRuntime.js`: `aimAtHolder()` no longer calls
  `fighter.setDir`. It now only reports the independent aim angle.
- New `holder.meta.aimAngle`, maintained per-frame in `updateHolder()`
  (logical `atan2` to opponent, ~60 ms damped interpolation for jitter only).
- Melee `strikeCone()` and swing anchors follow `aimAngle`, not `fighter.dir`.
- DAGGER: body dash removed (`f.x += dir*dashSpeed` deleted). The attack is a
  weapon-only thrust: a hit probe swept along the aim angle up to
  `dashSpeed*dashTime` (~221 px) via point-to-segment distance; the fighter body
  keeps its exact Apex trajectory. A procedural thrust visual (no imported art)
  communicates the lunge.

### A2 — Independent weapon aim presentation
- `public/game/arsenal/arsenalPresentationRuntime.js`: `drawEquippedWeapon()`
  orients every category (guns, melee, shields) from `holder.meta.aimAngle`;
  shields now rotate to face the opponent.

### A3 — 32 canonical shells, P1/P2 independent
- `public/game/core/apexRosterExtensions.js`: the five bodies trimmed from the
  normal roster (MAGNET, MATH_V2, HUNTER, PAINTER, WITCH) are stashed at boot
  into `window.__APEX_REMOVED_FIGHTER_TYPES` (normal play unchanged).
- New `public/game/arsenal/arsenalShellSelectRuntime.js`: canonical 32 list in
  handoff order; shell types reuse each fighter's real `draw`/`init` (body art)
  with `update` no-op (no native abilities/rage/passives/attacks in Arsenal),
  `noRage`, Arsenal speed (`CFG.FIGHTER_SPEED`) and match HP.
- Selection reuses the existing pick UI
  (`public/game/ui/apexPickRuntime.js`): pending Arsenal select swaps the
  carousel roster to the 32 and resolves fighter types through the shells;
  START routes into `startArsenalQuestMode(p1, p2)`. Menu entry
  (`src/App.jsx`) now opens selection instead of launching directly.
- `public/game/modes/arsenalQuestRuntime.js`: mode entry accepts shell names,
  remembers last shells for rematch, HUD/debug show real shell names.

### A4 — Slash/swipe VFX removed; bomb explosion kept
- `arsenalPresentationRuntime.js`: `melee_swing`, `reflect`, `tower_block`
  cues no longer push the orange/blue imported slash sequences (SFX retained).
  Muzzle flash and the grenade explosion atlas remain; `stats.seqAnimsPushed`
  and `stats.atlasCued` make the law assertable.

### A5 — Strict fixed 1.0 s centerline reveal
- `public/game/arsenal/arsenalSpawnRuntime.js`: broad future-contact simulator
  replaced with the handoff geometry:
  `forward = dot(r,v) > 0`, `|cross(r,v)| <= CENTERLINE_TOLERANCE_PX (16)`,
  `ETA = forward/speed <= REVEAL_LEAD_SECONDS (1.0)`, and `ETA <= time-to-wall`
  on the current straight segment (no pre-bounce reveal; post-bounce segments
  re-evaluate naturally).
- `arsenalQuestConfig.js`: `REVEAL_LEAD_SECONDS: 1.0`,
  `CENTERLINE_TOLERANCE_PX: 16`; per-slot lead is fixed (no 1.2–1.8 spread).
  `REVEAL` log format unchanged (`eta=… lead=1.00 fighter=…`).

## Verification

- Headless (`node tools/testArsenalQuestHeadless.mjs`): **71/71 PASS**, including
  new gates `centerline-lead-fixed-1.0`, `centerline-reveal-on-aligned-approach`,
  `centerline-graze-stays-hidden`, `centerline-no-reveal-before-bounce`,
  `aim-never-steers-fighter`, `dagger-no-body-dash`,
  `dagger-weapon-only-thrust-hits`, `shells-32-canonical`,
  `shells-p1-p2-independent`, `shells-native-kits-disabled`,
  `no-slash-vfx-in-combat`, `bomb-explosion-vfx-remains`,
  `centerline-lead-fixed-over-5min`, plus all pre-existing weapon/spawn/shield
  gates and the 5-minute no-error simulation.
- CI run **35964303964 — SUCCESS** on this branch: headless suite PASS and
  real-browser suite **59/59 PASS** in Chrome, with the same V2 gates green
  (`shell-select-32-cards {count:32}`, `shell-select-p1-p2-locks SNIPER/WITCH`,
  `shell-select-enters-arsenal`, centerline positives/negatives,
  `aim-never-steers-fighter`, `dagger-no-body-dash`, `no-slash-vfx-in-combat`,
  `bomb-explosion-vfx-remains`).
- Browser evidence committed in-repo under `docs/arsenal-quest/browser-evidence/`:
  `16-v2-shell-select-locked` (pick UI, P1 SNIPER / P2 WITCH locked, START
  visible), `16b-v2-shells-in-arena`, `17-v2-aim-independent-of-movement`
  (body travels its own line while the sniper tracks the opponent),
  `18-v2-centerline-reveal`, `19-v2-graze-stays-hidden`,
  `20-v2-dagger-thrust-no-body-dash`, plus the full pre-existing set
  (melee evidence renamed `06-melee-axe-swing` / `av-08-sabre-swing` since no
  slash art renders anymore). Headless evidence mirrors these under
  `docs/arsenal-quest/evidence/`.

## Known first-pass limitations (honest)

- Shell cards/panels in the pick UI show name + accent; shells without curated
  standing/card art render the fallback frame (body art in-arena is the real
  fighter draw identity). Full portrait art is a Checkpoint C concern.
- Movement/aim decoupling verified deterministically (dir + trajectory deltas)
  and visually; feel tuning (damped aim constant, thrust distance) is first-pass
  and awaits owner playtest.
- No Windows double-click involved; unchanged from the packaging phase.

## STOP

Checkpoint A delivered. Awaiting owner playtest before Checkpoint B.
