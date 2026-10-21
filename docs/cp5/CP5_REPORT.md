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
