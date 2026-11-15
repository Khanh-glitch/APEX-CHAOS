# CP5 — Implementation Report

Scope: `docs/cp5/CP5_PHASE_A_AUDIT.md` as approved by the owner, with two amendments from
the owner review: **no new hero portrait art in Mastery** (text hero rail kept), and
**MIRROR copies the other side once it has picked — empty until then** (no cover fill).
Locked roster-card dimming kept unchanged by owner decision.

Runtime revision: `20261021-cp5-r1` (relocked: runtimeManifest, Gold asset manifest,
provenance manifest, runtime revision lock, revision gate expectation).

## Group A — UX uplift

### 1. Achievement toast (`src/ui/AchievementToast.jsx`, `achievementToast.css`)
- BOT feats render as a compact edge chip (`is-compact`): portrait docks top-right under
  the P2 HP segment (233×54 px measured on a 390 px phone) instead of the near-full-width
  sub-arena band; landscape/desktop keep the side gutter at reduced size. Kicker shortened
  to `P2 · BOT · {rarity}`; the "BOT FEAT — NOT ADDED TO YOUR MASTERY" law survives as
  microcopy (also still asserted by the CP4 gate).
- Display-time hierarchy: BOT 1.8 s < provisional 2.4 s < sealed common/rare 2.6 s <
  epic 3.0 s < legendary 3.4 s (previously flat 2.2/2.8 s).
- Queue, side ownership, rarity shapes/pips, SFX keys, provisional-vs-sealed law unchanged.

### 2. Battle tutorial (`src/ui/FirstPlayGuide.jsx`, `firstPlayGuide.css`)
Presentation only — pause lease, tactical-opportunity logic, J/K + pointer contract,
skip/recovery untouched (freeze re-proven in capture: fighter positions/HP identical
across the paused window).
- Action-first copy ENG+VIE: `CAST SKILL 1 / Press J now. / Tap Skill 1 now.` ·
  `TUNG CHIÊU 1 / Nhấn J ngay. / Chạm thẻ Kỹ năng 1 ngay.` (Skill 2 analogous).
- Watch vs do: paused action steps use the `YOUR MOVE` / `LƯỢT CỦA BẠN` kicker;
  navigation steps keep `LEARN BY PLAYING` / `HỌC BẰNG CÁCH CHƠI`.
- Spotlight while paused: arena canvas and the un-taught skill card dim
  (`brightness .52 / saturate .68`); taught card stays full next to the existing
  corner-bracket beacon. No rings/arrows/hands added.
- Paused note restyled as a pill inside the coach chip (same canonical strings).

### 3. Mastery Vault IA (`src/ui/ProgressionCenter.jsx`, `progressionCenter.css`)
- Chapter accordion: one chapter open at a time (first incomplete by default, per-hero
  toggle memory), header shows number/name/x-y/progress/chevron. Mobile panel scroll:
  **7,839 px → 2,455 px** all-collapsed (3,093 px with one chapter open) vs before.
- NEWBOT destination strip under the hero summary: ECOBOT label + x/42 + meter + state
  from the same `skinProgress` authority (full terminal card with equip remains in place).
- Next objective: up to two nearest in-progress achievements (`BEST x/y`) from existing
  bests via `primaryProgress` — presentation only.
- Desktop ≥1024 px: two-pane grid areas (overview left, chapters right, weapon full-width)
  on the same component/state.
- No portrait art added (owner amendment). Claims, equip, focus/Escape, bilingual copy
  unchanged; no data or authority changes.

## Group B — Asset fixes (no redesign)

### 4. Fighter Select — MIRROR preview in BOT mode
Root cause: `mirrorOpponentHero()` in the Gold shell returned null for every BOT-mode
render, so MIRROR's stage was always empty. Fix (one line in
`tools/buildGoldCutover.mjs`, regenerated `public/gold/shell.html` diff = exactly that
line): mirror the other side once it has picked, in BOT mode too; empty until then —
the owner's rule. Verified in browser: P1 MIRROR `mirror:empty` before the BOT pick,
`mirror:magnet` with the opponent-derived asset + mirror treatment immediately after.

### 5. Match Result — weapon art authority
Seal now reads the V43 spec's declared `art` path (`cfg.V43_WEAPONS[id].art`, validated)
instead of guessing `v43/{id}.webp`; atlas fallback unchanged. Verified: sealed result
renders both hero portraits and real weapon art (`data-art-state="image"`).

## Verification
- Gates: runtime-revision, gold-revision-integrity (18), gold-fighter-pick-adaptation
  (15), gold-shell-loader (9), gold-favicon (9), CP4 combat-intelligence, CP3.2 mastery,
  Result Gold native contract — all PASS. Gold generator `--check`: 73 files match.
- Build + CP16 receipt at revision `20261021-cp5-r1`, 70 versioned runtimes.
- Real-browser before/after evidence (desktop + mobile portrait): tutorial spotlight +
  freeze sample, BOT toast chip geometry, Mastery accordion/two-pane + scroll metrics,
  MIRROR both pick phases, sealed Result art states.

Out of scope kept intact: Fighter Select/Result layout & typography, hero art, balance,
progression content, locked-card treatment, R91. Not merged; no production deploy; no
OWNER ACCEPTED claim.

## CP5.1 addendum — deepening pass (owner judged CP5 r1 too superficial)

Presentation only; still revision `20261021-cp5-r1` (no runtime files changed).

### Toast shows the achieved metric
- The provisional/sealed payload already carried the primary metric that crossed
  the threshold (`unlock.value`); the toast now renders it as an
  achieved-vs-target meter (`current / target + unit`) via the catalog
  authority (`primaryProgress` + `formatMasteryValue`). Event-type achievements
  (e.g. first blood) correctly show no meter. Gold left fin on player toasts,
  blue-grey on BOT chips; sealed medal enlarged.

### Tutorial names the real action
- Paused lessons append the actual skill being taught, read live from the HUD
  projection/DOM (`Tap Skill 1 now. · WEAPON DASH`) — no per-hero coach table.
- The paused pill moved out of the chip to the arena's top edge (measured from
  the live canvas each render), with CSS pause bars (no font glyph risk).
- Step ticks (gold up to current step) + speech-bubble nub toward the taught
  card. Pause lease/opportunity/input unchanged; freeze re-proven.

### Mastery is scannable without opening anything
- Chapter rows: `NEXT: <nearest unearned>` (or PATH COMPLETE) + up to six
  shaped mini medal peeks (earned = gold) next to the count.
- Hero summary: percent in the headline + next-tier destination
  (`N MORE → EPIC` / `CÒN N → SỬ THI`) from the same tier bands.
- Next objective: top-1 now renders as a full medal card; hero rail buttons
  carry mini progress meters; recent unlocks use shaped rarity discs with a
  `VIEW ALL` expand (8 → 24); ECOBOT goal strip gets the hex recycle mark.

### Verification (CP5.1)
- CP3 mastery gate, CP4 combat-intelligence gate, Gold generator `--check`
  (73 files) — PASS. Production build PASS at revision `20261021-cp5-r1`.
- Real-browser recapture: tutorial paused state (arena pill + ticks + live
  skill name + freeze), Mastery chapters with NEXT + peeks at 390px and
  1440px, BOT toast chip (event-type, meter correctly absent), Result art
  still sealed-image states. Numeric-toast meter is proven by the same
  payload path + render code; a numeric provisional toast was not isolated in
  this capture session (BOT earned first blood first in every run).

## CP5.2 addendum — owner playtest fixes (identity, highlight, single-axis Missions)

Owner playtest reported: (1) the player does not know which robot colour is
theirs, (2) the tutorial does not make the gun/skills stand out and the chip
invades the arena, (3) Missions scrolls both sideways and vertically on a
phone. Presentation only; revision stays `20261021-cp5-r1`.

### Fixes
- **Side identity taught explicitly:** pick-step copy now says "You are P1 —
  the robot with the blue edge" (VIE identical), and every battle lesson chip
  carries a blue-swatch identity line `YOU · P1 · BLUE EDGE`. No in-arena
  markers added (standing law).
- **Gun + skills highlighted:** chips show "No weapon yet — run over a gun on
  the ground to pick it up" while the coached player is unarmed (read from the
  live battle projection). The taught skill card now lifts/brightens and its
  beacon thickens while paused.
- **Chip no longer invades the arena:** battle-lesson chips dock under the
  arena canvas bottom edge (measured live), growing over the HUD strip
  instead of the fight.
- **Missions is vertical-only:** the chapter path was still a horizontal
  scroll-snap carousel — now a single vertical column; hero rail is a
  wrapping grid; recents wrap; panel clips x-overflow. Measured with a real
  browser probe (390×844 portrait + 844×390 landscape, both tabs):
  `scrollWidth == clientWidth`, no horizontal overflow anywhere.

### Verification (CP5.2)
- CP3 mastery gate, CP4 combat-intelligence gate, Gold generator `--check` —
  PASS. Production build PASS at `20261021-cp5-r1`.
- Recapture: tutorial paused chip below the arena with identity line, weapon
  hint and the ground gun visible; **numeric toast meter now screenshot-proven**
  ("Bậc Thầy Mưu Mẹo" — 3 / 3 lần, BOT chip); Mastery chapters stacked.

## CP5.3 addendum — CORRECTION of the CP5.2 side-identity record

Owner playtest of CP5.2 caught a factual error in the section above: **the
player is not the blue edge.** Engine source (`APEX_SIDE_EDGE` in
`public/apexEngine.js`): `fighters[0]` (P1, the human in BOT mode) is painted
with the **orange** silhouette edge `#FF941F`; blue `#3AA7FF` belongs to P2.
CP5.2 therefore taught the player to identify with the opponent's colour —
the exact confusion the feature exists to prevent. CP5.2's "blue edge" claims
above are superseded by this addendum. The owner also directed that the
identity teaching belongs **at the start of the match**, not in the pick
lobby. Commits `ca0165c`, `c350f0e`, `5282d80`; revision unchanged
`20261021-cp5-r1`.

### Fixes
- **Identity now taught at battle start**, via the existing CP4 first-fight
  side introduction inside the HUD identity rows (no new surface, no arena
  marker). Labels name the true edge colours and each chip is painted in
  that side's exact engine colour: BOT mode `YOU · ORANGE EDGE` /
  `BOT · BLUE EDGE` (VIE `BẠN · VIỀN CAM` / `BOT · VIỀN XANH`); LOCAL
  `P1 · ORANGE EDGE` / `P2 · BLUE EDGE` (VIE identical P1/P2 forms). Labels
  stay short because each row already carries its P1/P2 tag and the P2 text
  column is 82px wide at 390px (measured; the chip also wins paint order
  over the decorative weapon-slot sliver it grazes).
- **Pick-lobby teaching removed:** coach step 2 reverts to the plain
  "Pick your fighter, then LOCK IN." instruction (ENG+VIE). The
  `fighter-active-p2` hide from CP5.2 stays.
- **Coach battle-lesson identity line corrected** to
  `YOU · P1 · ORANGE EDGE` / `BẠN · P1 · VIỀN CAM` with the swatch at exact
  engine `#FF941F`.
- **Re-teach migration:** intro storage bumped `apex.alpha.sideIntro.v1` →
  `.v2` (v1 never named colours), so every existing player sees the colour
  version once per mode; while the coach journey is unfinished the intro
  repeats at every battle opening, then the one-time flag governs. Display
  4.5s → 6s.
- **Gate honesty:** `tools/testCp4CombatIntelligenceGate.mjs` pinned-string
  assertions (storage key + ENG/VIE `sideYou`) deliberately moved with the
  migrated behaviour and disclosed in the commit messages; they still pin
  the exact shipped strings.

### Verification (CP5.3)
- CP3 mastery gate, CP4 combat-intelligence gate, Gold generator `--check`,
  production build — PASS at `20261021-cp5-r1` (candidate `5282d80`).
- Real-browser capture (fresh profile, VIE, 390×844, mirror NEWBOT vs
  NEWBOT so only the edge differs): at 00:02 the orange chip
  `BẠN · VIỀN CAM` sits in the P1 row and the blue chip `BOT · VIỀN XANH`
  in the P2 row, computed colours measured `rgb(255,148,31)` /
  `rgb(58,167,255)` — exactly the engine's `#FF941F` / `#3AA7FF` — while
  the arena shows the player's robot with the orange edge and the BOT
  with the blue edge. Coach paused-lesson chip re-captured with the
  corrected orange identity line + swatch.
- Known residual (pre-existing, protected Gold battle HUD, not touched):
  on 390px phones the top-bar fighter name and HP number visually collide
  ("NEWBOT1000"); flagged for a future owner-approved HUD pass.
