# SLIME Owner-Correction Pass — Final Engineering Report (2026-09-28)

**Branch:** `arena/01a0e749-apex-chaos`
**Authority:** docs/hero-rework/phase1/14_SLIME_OWNER_CORRECTION_PASS_2026-09-28.md
(`director/slime-owner-correction-20260928` @ `a7521108a2bf45d5124aeff3ced0ee492b95d8e6`)
**Scope:** SLIME owner-feedback repairs only. ROBOT mechanics untouched (owner-passed this cycle;
ROBOT motion/VFX deferred to a later visual pass). No other heroes, no BLACK_HOLE visuals, no
damage/HP rebalance, no frozen-number changes, no invented multipliers, no electrical immunity,
no test weakening. Blood/splatter intact.

## Pushed SHAs in order (this correction pass)

| # | Checkpoint | SHA | Contents |
|---|-----------|-----|----------|
| 0 | Safety snapshot | `safety/pre-slime-owner-correction-20260928` | pre-pass state (tagged by director) |
| — | Authority | `a7521108` | doc 14 (director) |
| C1 | Weapon rendering / body enumeration | `67d55896` | generic `HR.extraLivingBodies()` + `drawEquippedWeapons()` fix + gates G1–G2 |
| C2 | Storm floor targeting | `35a6862e` | `HR.environmentTargets()` + floor-contact fix + gate G3 |
| C3 | Local HP + child heading + corner diagnostic | `4a13807a` | body-local HP indicators, heading law, 35-scenario diagnostic, survivability audit + gates G4–G7 (reconcile merge `70521026`) |
| C4 | Full regression / build / this report | (this commit) | final verification + owner-playtest artifact |

## Root cause → fix for every owner report

**1. Held weapon invisible on extra split bodies (visible again only when thrown).**
Root cause (director's source audit, adopted): `drawEquippedWeapons()` in
`public/game/modes/arsenalQuestRuntime.js` enumerated ONLY global `fighters[]`. Rework SLIME keeps
extra Bodies outside `fighters[]` (doc 06 architecture), so their real holders were updated by
`updateHolder()` but never sent to `AV.drawEquippedWeapon` — the item existed but was never drawn.
Fix (C1, `67d55896` — generic, no SLIME-name conditional): new `HR.extraLivingBodies()`
enumeration (every living physical body not already represented in `fighters[]`; retired/dead/
invisible anchors excluded) and `drawEquippedWeapons()` now iterates `fighters[]` PLUS that
enumerator. Anchor renders exactly once (via `fighters[]`), each extra Body exactly once; no
duplicate draws for any hero. G1 (visible child weapon + use) and G2 (single draw per body) pass.
Architecture law A honored: extra bodies stay OUTSIDE `fighters[]`; visibility was fixed by
enumerating bodies, not by moving them.

**2. Stormbreaker floor lightning appeared to not affect extra SLIME bodies.**
Root cause: the floor-contact caller passed ONLY `fighters[]` to
`APEX_ARSENAL_STORM.floorContacts` — extra bodies were accidentally immune. Fix (C2, `35a6862e` —
generic `HR.environmentTargets()`, no SLIME-name conditional): the caller enumerates normal
fighters + every eligible living rework body (C1 enumerator; retired/dead/invisible anchors
excluded). Extra SLIME bodies are NOT electrically immune (no such frozen mechanic exists).
Frozen floor law preserved and gate-proven (G3): visible bolt geometry = contact authority
(testInjectFloorBolt polylines), floor damage = 0, stun = 1.0s (measured 0.987s post-tick), a
shorter stun never shortens a longer stun (asserted), per-body/per-pulse gating held, direct
thrown Stormbreaker collision remains body-aware (existing living-body TOI path untouched;
gate: thrown storm hits a child body). Husk/anchor exclusions asserted.

**3. Top Combatant HP bar insufficient to see individual split-body survivability.**
Fix (C3 R3): top HUD stays Combatant-total HP unchanged (gate-asserted `topHudTotal`); when SLIME
has >1 living body, small TEMPORARY body-local HP indicators are drawn per living Body in
`drawReworkWorld` (pool = `__hrRefHp || maxHp`), with a body count. Read-only model
`HR.bodyLocalHpIndicators` exposed. G4 asserts: none when single body, one indicator per living
body with its kind, total conserved across a kill, indicator disappears with its body, sums stay
sane. This is a temporary readability instrument, NOT a final visual redesign.

**4. A2/passive children moving into a corner / appearing to stop.**
Root cause: `SLIME_CHILD_TYPE`'s constructor fallback gave new children an unrelated default-left
(or random) heading — with no authored heading rule they walked unnatural paths into corners.
Fix (C3 R4 — heading law): where no authored heading rule exists (A1 keeps its authored ±25
divergence, untouched), a new child inherits the SPAWNING SOURCE BODY's current normalized
heading; final fallback (1,0). Never default-left, never random steering, no chase, no pickup
seek; normal Apex bounce owns movement afterward. G5 asserts exact inheritance (measured child
dirs equal source dir [0.6,0.8] for both A2 children and the emergency child).

**Owner law E (two A2 children from one large hit):** legal — Damage Shedding crosses multiple
100-damage thresholds in one realized hit. G5 proves the count arithmetic instead of forcing one
child (2 children from one hit, carry-over 40 exact).

## Corner / stuck: did a second bug reproduce?

**No second stationary bug reproduced after the heading fix — reported honestly.**
Instrumented real-body diagnostic (C3 G6, per-frame records committed in
`docs/hero-rework/evidence/slime-owner-fix-gates-report.json`): 35 runs across 5 deterministic
seeds (4311–4315) × scenarios {a2-double-spawn, passive-emergency, edge-start-left/right/top/
bottom, corner-drive}, recording per body: kind, x/y, dir, baseSpeed, effective speed state,
hard-CC/statuses, positionLocked, wall bounce/contact, local HP. Criterion: a living body with
positive speed, no hard CC, no positionLock must not remain stationary after wall resolution.
`anyViolation: false` — max stationary runs stayed at 1–3 frames everywhere (e.g. edge-start-bottom
run 1: 42 frames near the corner but maxStationaryRun 3, i.e. moving through, not stuck);
the corner-drive scenario drove bodies into the corner and back into the arena (2 corner frames →
204 in-arena frames post-bounce). Conclusion: the owner's "runs into corner then stops" is fully
explained by the pre-fix default-left heading (and possibly observation of the corner drive);
no second real bug was found in movement, bounce, speed state, or CC handling.

## Survivability measurements (real production damage path — no tuning applied)

Measured in G7 through the real `weaponApi.aqDamage` path (STORMBREAKER final-authority /
confirmed-hit weapons; shared roster tuning factor measured per run):

| Quantity | Measured |
|----------|----------|
| A1 local HP before split | 1000 (maxHp 1000) |
| A1 halves after split | 500 + 500 (maxHp 500 each, ref 500 each) |
| Combatant total before/after split | 1000 → 1000 (conserved) |
| Realized-damage probe scale (ICE→SLIME) | ×1.2084 (shared roster tuning, unchanged) |
| Representative firearm realized per 10 submitted (PISTOL) | 84.588 (arsenal ×7 scale × tuning) |
| Sniper/precision realized per 10 submitted | 84.588 |
| STORMBREAKER confirmed-hit 446 realized | 538.946 |
| Does a half die to one STORMBREAKER hit? | **Yes** — half local pool 500 < 538.946 realized |
| Why it dies | body-local HP law: each half IS half the pool; one confirmed-heavy hit can exceed it. The survivor half and the Combatant total follow their own laws (total final 501 measured) |

Interpretation for the owner: "a body disappears/dies quickly" is currently the body-local pool
law made visible (report 3's indicators), not a hidden damage bug. **No rebalance was applied** —
whether a 500-HP half should survive a 446 confirmed-hit is a design/balance question for the
owner (see unresolved items).

## C4 verification results (this run, workspace rebuilt and recovered to `af649ab6`)

Targeted SLIME + standing suites (all green):

| Suite | Result |
|-------|--------|
| SLIME physics gates (S1–S8) | 9/9 |
| SLIME kit gates (S9–S13) | 5/5 |
| SLIME owner-fix gates (G1–G7, C1–C3) | 7/7 |
| SLIME legacy separation (L1–L6) | 6/6 |
| ROBOT gates (R1–R9) | 9/9 |
| Hero Rework smoke | 17/17 |
| Hero Rework goldens | 11/11 |
| Arsenal headless | 334/334 |

Full suites + build:

- Real-browser suite vs dev server (vite 5173, Chromium 153): **217/217**.
- Production build: `materializeArsenalFinalSfx` + `generatePublicAssetManifest` (690 assets) +
  `vite build` clean → `dist/` (the owner-playtest artifact; served by `npx vite preview`).
- Real-browser suite vs THE PRODUCTION BUILD (`vite preview` 4173): run 1 = 216/217
  (flake: `owner-cp6-input-alive-during-warmup`), run 2 = **217/217**. Same warmup/input
  timing-flake family as the previously documented `both-unarmed` pair; it is not in the SLIME
  areas and did not reproduce on re-run. **The production build is playable and passes the full
  browser suite.**

## Browser-evidence limitation (honest)

Doc 14's PROOF section asked for real-browser screenshots of six specific moments (A1 split with
both local HP indicators; extra body visibly holding a weapon; same body after use/throw; floor
lightning stunning an extra body; A2 two-child spawn not default-left; child bouncing back from a
wall). The existing `__HR_CAPTURE` worker-driven screenshot path was attempted and **did not
complete**: capture runs advanced through match setup into the warm-up frame but the scenario
switch never landed within the evaluation window (last observed key = warm-up frame 35724),
producing only placeholder frames that were scratch artifacts and were not committed. Per owner
direction, capture infrastructure was **not** expanded further and no screenshot automation was
redesigned.

What stands as truthful proof instead:
1. **The playable production build** (above) — the owner can observe all six moments directly in
   real Chromium; this is the primary owner-playtest artifact.
2. **Mechanical gate evidence** (jsdom + real production paths): G1–G7 with per-frame diagnostic
   records in `docs/hero-rework/evidence/slime-owner-fix-gates-report.json` (weapon enumeration
   body ids, storm floor stuns per body, indicator lifecycles, exact inherited headings, 35-run
   corner instrument, survivability numbers).
3. **Rendered canvas goldens** committed from the suites, including
   `docs/hero-rework/evidence/golden-slime-bodies-sniper-targeting.png` (multi-body SLIME with
   per-body targeting) and the smoke `20s-robot-vs-sniper` frame.

Screenshots would have been additional evidence only. Screenshots ≠ owner acceptance, and this
report does not claim owner acceptance.

## Unresolved SLIME design / balance questions (owner authority)

1. **Half-pool survivability vs confirmed-heavy hits** — measured: one STORMBREAKER confirmed hit
   (538.946 realized) exceeds a 500-HP half's pool. This may be intended (split = shared fate) or
   may warrant an owner balance decision (larger half-pool, split on hit threshold, or none).
   **No tuning applied in this pass.**
2. **Body-local HP indicators** are temporary readability instrumentation. Whether/how they
   become a permanent HUD design is a visual-design question (explicitly out of this pass).
3. **A1 `divergenceTarget` "±25" semantic/unit** remains an explicit unresolved tuning slot
   (degrees/px/px-per-s not frozen); the provisional degree reading stays isolated behind cfg.
4. **ROBOT Passive milestone thresholds** (carried over from qualification; ROBOT mechanics are
   owner-passed this cycle and were not reopened).
5. **Warmup/input timing flakes** in the arsenal browser suite (`both-unarmed-*`,
   `owner-cp6-input-alive-during-warmup`) — outside SLIME scope; owning line may pin timing.

## Preservation checklist

canonical 12 roster ✓ · NEWBIE→ROBOT migration ✓ · Quest 20-stage identities ✓ (334/334) · T6
manipulation immunity ✓ · Stormbreaker frozen flight/stun laws ✓ (bolt=authority, 0 damage, 1.0s
stun, no-stun-shortening, per-body/per-pulse, body-aware thrown collision — G3) · SLIME children
outside `fighters[]` ✓ (enumeration, not relocation) · CP7 menu/audio/readiness ✓ (browser suite) ·
blood/splatter ✓ · weapon aim independent of movement ✓ · no raw gameplay `setTimeout` ✓ · original
APEX locomotion ✓ · A1/A2/passive frozen numbers unchanged ✓ · no damage/HP rebalance ✓ ·
unrelated heroes untouched ✓ · ROBOT mechanics untouched ✓.

## How to test this preview commit

```bash
npm install --no-package-lock
node tools/materializeArsenalFinalSfx.mjs
node tools/generatePublicAssetManifest.cjs && npx vite build   # the owner-playtest artifact
npx vite preview --port 4173                                    # play the production build
# targeted proofs
node tools/testHeroReworkSlimeOwnerFixGates.mjs   # 7/7 (C1-C3)
node tools/testHeroReworkSlimeGates.mjs           # 9/9
node tools/testHeroReworkSlimeKitGates.mjs        # 5/5
node tools/testHeroReworkSlimeLegacySeparation.mjs# 6/6
node tools/testHeroReworkRobotGates.mjs           # 9/9
node tools/smokeHeroReworkHeadless.mjs            # 17/17
node tools/testHeroReworkGoldens.mjs              # 11/11
node tools/testArsenalQuestHeadless.mjs           # 334/334
LD_LIBRARY_PATH=/tmp/al2023/lib CHROME_PATH=/tmp/chromium \
  APEX_APP_URL=http://127.0.0.1:4173 node tools/testArsenalQuestRuntime.mjs  # 217/217 vs prod build
```

SLIME OWNER-CORRECTION ENGINEERING CANDIDATE READY — NOT OWNER ACCEPTED