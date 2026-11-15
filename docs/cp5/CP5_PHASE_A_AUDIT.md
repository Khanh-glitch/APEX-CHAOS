# CP5 — Phase A Audit, Ref Usage Matrix, Proposals & Implementation Plan

Scope authority: `CP5_reference_scope_and_prompt.md` (owner). Group A (UX uplift): battle
tutorial/coach, achievement toast, Missions/Mastery Vault mobile. Group B (asset fix only,
**no redesign**): Fighter Select, Match Result. This audit is grounded in source truth at
`66e69e7` and fresh real-browser captures of the production build (root hosting). The five
owner concept images are **AI-generated direction drafts, not source screenshots**; every
place they disagree with canonical source (hero set, counts, chapters, art) the source wins.

---

## 1. Ref usage matrix

| Ref | Used for (only) | Lands in | Explicitly NOT taken |
|---|---|---|---|
| A1 Pokémon UNITE (mobile tutorial behavior) | Guidance bound to the real on-screen control; act-don't-read steps | Tutorial: coach bubble anchored to the taught skill card; tap-target emphasis; one action per step | MOBA round/bubble HUD language, layouts, icons |
| A2 Diablo Immortal (tutorial behavior) | Prompt attached to the current action; gameplay stays the visual center | Tutorial: arena scrim is light (dim, not cover); pause pill, not a modal sheet | Fantasy materials/iconography |
| B1 Overwatch 2 combat-feed behavior | Edge placement, own-vs-opponent emphasis levels, scan-fast density | Toast: P2/BOT becomes a compact edge chip; size hierarchy by value; shorter copy | Kill-feed layout/icons; achievements ≠ kill log |
| C1 Brawl Stars Records | Information architecture: total progress → groups → next goal; "where am I" at a glance | Mastery: overview → chapter rows (collapsed) → details; next-objective strip | Supercell colors/panels/icon shapes/Record Points economy |
| C2 Brawl Stars Prestige | Long-horizon milestone destination feel (skin as the visible summit) | Mastery: destination goal card (ECOBOT / VUA HỀ) visible from overview, not buried at scroll end | Prestige road clone; trophy resets; new currencies |

Canonical content never changes: 6 mastery chapters (OFFENSE 6, PRECISION 7, WEAPONS 8,
SURVIVAL 7, SPECIALIST 7, DOMINANCE 7 = 42), 8 playable heroes in mastery, Starter
Contracts, ECOBOT 42/42 gate, VUA HỀ >1000 RPG-7 gate, rarity shape/pip system, CP4 copy.

---

## 2. Battle tutorial / coach (`src/ui/FirstPlayGuide.jsx`, `firstPlayGuide.css`)

### Current truth (before: `tutorial-mobile-before.png`, `tutorial-desktop-before.png`)
CP4 already ships the hard parts: 6-step coach, BOT-only tactical pause lease for steps 3/4
triggered by *real mechanic opportunity* (never cooldown-zero), J/K + touch variants, skip,
30 s forgotten-lesson recovery, freeze proven 0 px/0 s. Weaknesses are presentation-only:

1. **Copy is a paragraph, not an action.** "SKILL 1 READY / Tap the highlighted Skill 1
   card. / MATCH PAUSED — TAKE YOUR TIME" — three lines to say one verb.
2. **Target emphasis is weak.** The corner-bracket beacon is subtle; on mobile the taught
   card and the other card look almost identical; nothing dims.
3. **No watch/do distinction.** Navigation steps (0–2, 5) and action steps (3–4) share one
   card treatment.
4. **Coach card overlaps arena bottom** on portrait phones.

### Proposal (after = owner concept 03, corrected to APEX truth)
Presentation-only changes inside the existing component; pause lease, opportunity logic,
step machine and persistence are untouched.

- **Action-first copy (A1):** battle steps become `CHẠM ĐỂ DÙNG · CHIÊU 1` / `TAP TO CAST ·
  SKILL 1` (keyboard: `NHẤN J · CHIÊU 1` / `PRESS J · SKILL 1`) with one short sub-line
  naming the actual skill (e.g. WEAPON DASH). Skill names come from the live HUD identity,
  never hardcoded per hero in the coach.
- **Spotlight (A1/A2):** while paused, a light scrim dims the arena (not the HUD), the
  taught card keeps full saturation + existing beacon brackets + a restrained pulse on its
  key/tap badge; the *other* skill card desaturates/dims. No rings/arrows/floating hands
  (standing owner ban) — the concept's hand cursor is not adopted.
- **Pause pill (A2):** `⏸ TRẬN ĐẤU TẠM DỪNG` / `MATCH PAUSED` as a small pill at the arena
  top edge instead of a sentence inside the card; coach bubble docks directly above the
  taught card with the existing corner-cut APEX panel.
- **Watch vs Do:** navigation steps keep the `LEARN BY PLAYING · n/6` kicker; action steps
  use `LÀM THỬ · n/6` / `YOUR MOVE · n/6` so the mode reads instantly.
- Portrait + landscape both covered by anchoring to the real card rect (existing logic);
  clamp bubble so it never covers the taught card or HP rail.

Risk: low (CSS + copy + small render branches). Gates: existing coach/tutorial tests must
stay green; freeze invariant re-proven by screenshot + position sampling.

---

## 3. Achievement toast (`src/ui/AchievementToast.jsx`, `achievementToast.css`)

### Current truth (before: `toast-mobile-before.png`, CP4 landscape evidence)
One toast at a time (bounded priority queue of 3), side-docked, rarity shape/pips, BOT
feats desaturated + shorter (2.2 s), bilingual, SFX by rarity/owner. Weaknesses:

1. **Portrait P2/BOT toast is a near-full-width band** under the arena — same weight as the
   player's own unlock, and it collides visually with the P1 identity row (capture shows
   overlap).
2. **Flat hierarchy:** common provisional, sealed epic and BOT feat all render the same box;
   only color/motion differ.
3. **Redundant copy:** kicker `BOT · BOT FEAT · RARE` + line `BOT FEAT — NOT ADDED TO
   YOUR MASTERY` repeats the same fact twice at phone size.
4. No progress context on provisional toasts (concept shows `60/100` + bar on the P2 card).

### Proposal (after = owner concepts 02 + 04, corrected)
- **Owner-kind variants (B1):**
  - *Player sealed/provisional:* current card, side gutter (landscape/desktop) / sub-arena
    bar (portrait) — kept, copy shortened: kicker `P1 · BẠN` (`P1 · YOU`), name, one status
    line (`CHỜ KẾT THÚC TRẬN` / `SEALED · NEWBOT 24/42`).
  - *BOT/P2:* **compact edge chip** — portrait: top-right under the P2 HP segment;
    landscape: right gutter mini-card. Glyph medal (small), side chip `P2 · BOT`, name,
    no body paragraph. "Not added to your mastery" survives as an 8 px microcopy line on
    the landscape mini-card only where room exists; the legal meaning is also carried by
    desaturation + `BOT` chip (and remains explicit in the Vault/Result).
- **Value hierarchy (B1):** sealed epic/legendary get the larger medal + existing pulse;
  common/provisional stay compact; BOT smallest. Display times: BOT 1.8 s, common 2.4 s,
  epic 2.8 s, legendary 3.4 s (was flat 2.8 s for most).
- **Progress line — phase 2, optional:** showing `x/y` requires live best values in the
  provisional event payload. The ledger already tracks bests; plumbing them into the toast
  is a data change, proposed only if owner wants the concept's progress bar. Not required
  for the hierarchy fix; default plan excludes it.
- Queue, ownership authority, SFX keys, provisional-vs-sealed law unchanged.

Risk: low–medium (CSS variants + copy; one new compact render branch). Existing CP4 toast
CSS gate assertions (side docking, portrait band) need deliberate updates with the change —
never loosened silently.

---

## 4. Mastery Vault mobile (`src/ui/ProgressionCenter.jsx`, `progressionCenter.css`)

### Current truth (before: `mastery-mobile.png`, `mastery-desktop.png`)
Measured: mobile panel scroll height **7,839 px ≈ 9.3 phone viewports**, all 7 sections and
all 42 medal cards expanded at once. Hero rail is text-only buttons (no portraits). Recent
unlocks render as small glyph chips. The ECOBOT destination sits *after* all 42 medals;
VUA HỀ after that. Data layer is complete (progress, bests, recents, gates) — this is
purely an information-architecture problem, exactly C1's territory.

### Proposal (after = owner concepts 01 + 05, corrected to canonical content)
- **Overview first (C1):** balance + tabs (unchanged) → selected-hero header using the
  canonical Pick portrait (existing `portrait` art authority): portrait thumb, hero name,
  tier, `earned/total`, percent ring (existing ring component).
- **Hero rail with art (C1):** horizontal portrait cards (cover art + name + `x/42`),
  selected state in Gold; locked heroes keep lock treatment. Replaces text buttons; same
  selection state/behavior.
- **Recent unlocks as medal cards (C1):** shaped medal disc (existing rarity shapes), name,
  hero, date; horizontal scroll row; `VIEW ALL` jumps to the relevant chapter expanded.
- **Destination strip (C2):** directly under the hero header, a compact goal card:
  NEWBOT → ECOBOT progress (`24/42`, bar, LOCKED/EQUIP state from the same skinProgress
  authority; other heroes show their tier/next-tier instead — no invented rewards).
  Full terminal section (conditions, remaining list, equip) remains available in place.
- **Chapter accordion (C1):** six chapter rows (number, name, `x/y`, progress bar, top
  two medal glyphs earned/next), collapsed by default; tap expands that chapter's existing
  MedalCards. First incomplete chapter auto-expands on open. This is the single biggest
  mobile win: initial scroll drops from ~9 viewports to ~2.
- **Next objective:** one line under the header: nearest in-progress achievement(s) by
  `primaryProgress` percent (`BEST x/y`) — data already exists; presentation only.
- **Desktop ≥1024 px (concept 05):** same component becomes two-pane: left overview +
  heroes + recents, right chapter list with selected chapter's medals. No second
  implementation — CSS grid areas + the accordion state.
- Weapon mastery (VUA HỀ + top records) unchanged in content; becomes the final chapter-
  style section so the page rhythm is consistent.

Risk: medium (one component restructure + CSS; no data/authority changes). All claims,
equip flows, focus/Escape/invoker behavior and bilingual copy are preserved; new strings
(next objective, view-all) ship ENG+VIE together.

---

## 5. Fighter Select — asset audit (fix only)

Fresh browser audit (all-owned profile, desktop): 14 roster entries render; **0 failed
requests, 0 broken images** across every hero's roster cover, selected art, battle avatar
and skill icons on root hosting. Three distinct findings:

### F1 — MIRROR selected preview is an empty stage in BOT mode (root cause proven)
Selecting MIRROR shows text only; the world-hero slot is empty (`pick-mirror.png`).
Cause: the Gold shell renders MIRROR by mirroring the *opponent's* art
(`mirrorOpponentHero()`), which **returns null whenever `battleMode==='bot'`** (and
whenever the opponent hasn't picked / is also MIRROR). `createWorldHeroBody()` then
returns null. This was a recorded owner decision ("no static selected pose; never a
placeholder"), but in the primary BOT flow it reads exactly like the reported
missing-preview bug.
**Fix spec (needs owner approval because it amends that decision):** when no opponent
source exists, render MIRROR's own canonical roster cover (`pick_roster_cover.webp` — the
same art Result and Lucky Draw already use for MIRROR) in the same slot with the existing
mirror dim treatment; swap to the opponent-derived asset as soon as one exists. Exact
change point: generator `tools/buildGoldCutover.mjs` R49 `renderWorldHero` (fallback
`sourceHero`), then regenerate Gold shell + revision relock. No layout/typography change.

### F2 — Locked-but-playable roster cards are dimmed to near-invisibility
Unowned heroes render art at `opacity:.22` + grayscale under a 0.76-dark lock overlay;
future extension fighters without portraits show the striped `rosterLockedVisual`
placeholder. Both are *by design* (locked honesty), but at phone brightness the unowned
art is effectively invisible and matches "mất hình tướng" reports.
**Classification:** design decision, not a missing-file bug. Optional owner-approved
tweak (CSS opacity only) — not changed unilaterally.

### F3 — Verified healthy
BOXE/SHURI dictionary art, Core Six gold-ui set (incl. MIRROR cover/battle avatar),
skill icons, Lucky Draw art: all files exist and decode. Under itch nested packaging the
path rewriter (`tools/packItchPortable.mjs`) already relativizes `/assets/…` literals;
`heroUiAsset()` still emits origin-absolute URLs in the root build, which is correct for
root deploys — flagged only as a watch item if a future host serves the *root* build
under a subpath without the itch packager.

## 6. Match Result — asset audit (fix only)

Verified end-to-end in the same sessions: sealed BOT match → Result renders **both hero
portraits** (canonical selected-large; MIRROR cover by the Result law) and **real weapon
art** (`data-art-state="image"`, e.g. SNIPER `c/SNIPER.png`) on desktop + mobile
(`result-mobile-before.png`). Static audit: all 34 C-set weapon files + 8/8 V43 declared
arts exist; V43 seal art currently *guesses* `v43/{id}.webp` instead of reading the spec's
declared `art` field — correct today for all 8 ids, but brittle.
**Fix spec (small, safe):** seal reads `cfg.V43_WEAPONS[id].art` first, falls back to the
atlas file, never a guessed filename. One function in `matchResultAuthority.js` + revision
relock; zero layout change. No missing-art case reproduced on root hosting; if the owner
saw blanks on a specific hero/weapon/host, that repro detail would sharpen this further.

---

## 7. Implementation plan (on owner approval of direction)

Order is risk-ascending; each step is independently reviewable and gated.

1. **Toast variants + copy** — `AchievementToast.jsx` (BOT compact branch), `achievementToast.css`
   (edge chip, size hierarchy, timings in component). Update CP4 gate docking assertions
   deliberately. Evidence: portrait+landscape captures (P1 sealed, P1 provisional, BOT).
2. **Tutorial presentation** — `FirstPlayGuide.jsx` copy tables (ENG+VIE) + paused-state
   render (scrim, pause pill, other-card dim class), `firstPlayGuide.css`. Pause lease &
   opportunity engine untouched. Evidence: desktop J / mobile tap pause captures + freeze
   sample (0 px/0 s) re-proven.
3. **Mastery Vault IA** — `ProgressionCenter.jsx` (portrait hero rail, goal strip, chapter
   accordion, next-objective, desktop two-pane via CSS), `progressionCenter.css`. No
   authority/data changes. Evidence: mobile/desktop captures, scroll-height metric before/after.
4. **Group B fixes** — F1 MIRROR fallback (generator + Gold regen + relock) *only if owner
   approves amending the no-static-pose decision*; Result V43 declared-art read (small).
   F2 opacity only if owner asks.
5. **Closure** — build + receipt, targeted gates (tutorial, toast/CP4 gate, progression,
   gold pick adaptation, result-gold, runtime revision), wider regression, isolated
   preview of the exact new candidate, before/after pack. No merge/production/itch
   without owner acceptance. R91 untouched; balance/progression content untouched.

Out of scope per brief: Fighter Select & Result layout/typography/flow, hero art, balance,
progression content, new systems.
