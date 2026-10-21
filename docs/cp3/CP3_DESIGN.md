# CP3 — Combat Identity · Achievement Mastery · Premium HUD/UX
Design & benchmark record (Step 1 deliverable). Branch `arena/d7ff52e8-apex-chaos`, PR #101 lineage. No merge/deploy without owner approval.

## 1. Benchmark evidence (fetched 2026-10-21)

| Source | What was studied | Principle extracted | Applied where |
|---|---|---|---|
| Supercell — Brawl Stars **Mastery** (#MysteryAtTheHub notes, 2023) | Per-Brawler mastery track; points from real wins, multiplied by rank/MVP; **progress never decreases, never resets**; each level = one-time reward, escalating currency → **exclusive cosmetics (pins, profile art, titles)**; mastery icon shown on battle card + profile | Mastery is per-hero, permanent, and climaxes in cosmetics — visible at the moment of play, not buried in a menu | Task 2/3: per-hero mastery = lifetime union of that hero's combat achievements; ECOBOT is the ROBOT track climax |
| Supercell Support — **Prestige** (2026) | Tiered path Bronze/Silver/Gold/Prestige at 250/500/750/1000; **skin at Gold tier**; emblem visibly upgrades; Total Prestige = sum across Brawlers, shown on battle card | A *path with named tiers and a visible skin node*, plus one total-mastery number; rewards already owned are marked claimed, never duplicated | Task 2.4: mastery path UI with tier bands + skin node; total mastery counter |
| Riot Support — **Wild Rift Welcome!** event | New-player missions unlock in order, **one active objective at a time**; objectives teach real mechanics (deal damage, cast ultimate) with OR-fallbacks; milestone reward track claimed in an Event Center | Onboarding = a short *guided action chain*, not reading; exactly one highlighted next step; rewards claimed in one place | Task 4: contextual coach advancing on real actions; Task 2: "current objective" starter track |
| Blizzard — **Overwatch Oct 9 2018** patch | Team colors unified across **nameplates, HUD, health bars and hero outlines** as ONE color language; shields/barriers readability pass | Side identity lives *on the silhouette* and in the same color words everywhere (select chip = HP bar = edge light) | Task 1: silhouette edge lighting in canonical `--p1/--p2`, same colors as HP bars and select chips |
| Overwatch outline research (forums/Reddit/accessibility guides) | Thin model-hugging outline, adjustable strength; dim red fails on dark maps → players pick high-luminance colors (yellow/cyan); CVD modes retint outlines+UI together; ally outlines appear when occluded (adaptive) | Edge must carry **luminance contrast, not hue alone**; strength should rise when readability is hardest; orange↔blue is the CVD-safest pair | Task 1: colored edge + dark keyline (luminance step on any background); overlap boost; P2 gets a fine double-hairline pattern so the cue is never color-only |
| Medium — Character Readability in TF2/Overwatch | Instant recognition from silhouette shape language even when partially obscured; figure/ground contrast always maintained | Identity must survive partial occlusion → the outline must trace the *actual sprite alpha*, not a proxy shape | Task 1: silhouette derived from the real per-frame fighter render |

No copyrighted art, icons or layouts are copied; only interaction principles.

## 2. Current-system audit (source-verified)

- **Award catalog:** owner-approved `result-gold/src/data/ownerDecisions.json` — 50 slots = **47 keep + 3 drop** (`relentless`, `bullet-storm`, `cooldown-king` may never be awarded). 41 universal + 6 signatures (NEWBOT/HUNTER/CRYSTALA/MAGNET/FROST/MIRROR). Categories: offense 6, precision 7, weapon 8, survival 8, tactics 6, chaos 6, signature 6. Conditions are real-match telemetry predicates evaluated by `matchResultAuthority.observed()` at seal. **ROBOT-applicable set = 41 universal + `signature-newbot` ("Cỗ Máy Không Ngủ", refund cycles ≥ 3) = 42 achievements.** Every universal is mechanically earnable by ROBOT (weapons are shared pickups; blocked/healing/casts all exist in ROBOT matches — verified in live result data).
- **Damage authority:** the same ledger records *actual* per-weapon damage per fighter (`sourceMap` `W:RPG_7`, HP-delta based, no speculation). Sealed result exposes `players[].damage.sources[]` and `players[].awards[]` with `character.heroId`. RPG-7: T3 rocket, peak ≈161/hit.
- **Seam:** at KO, `arsenalBattleRuntime` seals (`state.resultGold`) then calls `APEX_ARSENAL_META.awardBattleResult(winnerSide, state)` — the wallet already receives the frozen sealed result, idempotent via `resultGold.meta.id` ∈ `claimedMatchIds`. Lifetime folding needs **no engine change**.
- **Cosmetic authority:** `src/game/cosmetics/cosmeticAuthority.js` — `equip()` has an explicit "unlock economy can be wired later" seam; `selected()` resolves persisted loadout (`apexChaos.cosmeticLoadout.v1`, per side). Skins: `hero:ROBOT:ecobot`, `weapon:RPG_7:vua-he` (owner-gold fidelity, registered in `approvedGoldSkins.js`).
- **Fighter rendering:** canvas 2D; `fighters[i].draw(ctx)` is a pure draw (save/translate/rotate/type.draw/status). Old markers = `drawSideGroundRings` + `drawSideHeadTags` in `public/apexEngine.js`, gated to BOT/LOCAL duels.
- **Existing progression:** 5 starter contracts in `arsenalMetaRuntime.PROGRESSION_CATALOG` (real AC, claim-once) shown by `src/ui/ProgressionCenter.jsx`. Match honors never pay AC (standing product law).
- **Revision lock:** `matchResultAuthority.js`, `arsenalMetaRuntime.js`, `arsenalBattleRuntime.js` are pinned in `tools/runtimeRevision.lock.json` — edits go through the existing lock update + gate tests.

## 3. Task 1 — Side-Aware Silhouette Edge Lighting

**Remove:** `drawSideGroundRings`, `drawSideHeadTags`, chevron/diamond glyphs everywhere (including the select-chip `::before` glyphs in `sideIdentity.css` → replaced by a slim side-color edge bar on the nameplate).

**Technique (canvas 2D, one extra composite per fighter, duel modes only):** render the fighter once into a pooled offscreen canvas (bounds ≈ 2.9×radius, world units, same transform), radially mask to the body core (excludes status text/rings), tint alpha to a solid silhouette, build the edge by offset-blitting the silhouette (8 directions): first a 1.5px near-black keyline (luminance step), then the side color at ~2.5px, then the fighter itself on top. Draw order per fighter: edge → fighter, in existing slot order, at the exact current marker site. No physics/hitbox/AI/animation values touched; non-duel modes keep the direct draw path byte-identical.

**Language:** P1 edge `#FF941F`, P2 edge `#3AA7FF` — Gold's canonical `--p1/--p2`, identical to HP bars and select chips (Overwatch one-language rule). **Not color-only:** (a) luminance differs (orange ≈ 0.62 vs blue ≈ 0.42 relative luminance over a black keyline), (b) P2 edge is a *fine double hairline* (second 1px line at 45% alpha, 2px gap) vs P1's single solid edge — a pattern difference visible in grayscale, (c) corner HUD keeps P1/P2 text plates. **Adaptive strength:** when the two fighters overlap (center distance < 2.1×radius) edge alpha/width step up ~40% — identity is strongest exactly when reading is hardest (OW occlusion principle). Dead fighters: no edge. Perf guard: silhouette canvases pooled, half-resolution (outline needs no full res); frame-time measured in acceptance.

## 4. Task 2 — One connected mastery system

**Data (single authority = the wallet, `arsenalMetaRuntime` state, backward-compatible):**
```
mastery: {
  earned:  { NEWBOT: { "<awardId>": <firstEarnedAt> }, ... },   // lifetime union, per hero played
  best:    { NEWBOT: { "<awardId>": <best primary value> } },   // from sealed observed() values
  weaponDamage: { RPG_7: <lifetime actual damage> },           // folded from sealed sources only
  recent:  [ { awardId, heroId, at } ]                          // last unlocks for the featured row
}
```
Sanitize drops unknown award ids (validated against `APEX_RESULT_OWNER_CATALOG`); every fold rides the existing sealed-match idempotency (`claimedMatchIds`). Sides that count: BOT → P1 only (P2 is AI); LOCAL → both (both are this device's players, matching the LOCAL +50 law). Lab/Admin/Quest never seal → never fold (existing law).

**Live unlock feedback (2.3):** achievements split by seal-time semantics:
- **Monotonic (~37)** — once true, always true within the match (damage windows via latched maxima, streaks, pickups, casts, family damage, first-blood, signatures…). Evaluated live inside the ledger's existing `tick()` via a new `evaluateLive()` that reuses the *same* `observed()` predicates; first crossing → wallet records immediately (single `recordMasteryUnlocks` writer) + toast.
- **Final-only (~10)** — ratios/windows that can still break (`glass-cannon`, `sure-shot`, `assassin`, `untouchable`, `one-breath`, `kiter`, `clutch`) and winner-gated (`last-stand`, `comeback`, `speed-win`). Recorded at seal; celebrated on the result screen + NEW badge in the mastery UI. Never toasted mid-match (would risk false announcements).
Toasts: queued (max 3 queued, ~2.6s each, rarity-prioritized), anchored top-center below the match clock (never over fighters/skill cards), `pointer-events:none`, Gold medal-chip language, icon + name + condition met + hero progress `n/42`, soft chime through the battle audio session, reduced-motion variant, ENG/VIE (names are canonical VI titles as on the result screen today; rules from `localeAwardRules.js`). Dedup: an award already in `mastery.earned[hero]` never re-toasts on later matches unless it's the player's *first time ever* (toast = first lifetime earn only).

**Progression UI (2.4) — "MASTERY VAULT" replacing the flat list:**
1. **Starter Contracts** strip (the existing 5 real-AC contracts, Wild-Rift style: current objective highlighted, claim in place).
2. **Hero Mastery path**: hero selector rail (owned/playable heroes); a horizontal tiered path — 6 category chapters as medal clusters with per-chapter counts, tier bands (Bronze→Legendary by completion share), terminating in the **skin node** (ECOBOT for ROBOT: preview, `X/42`, EQUIP when entitled or the exact remaining list when locked). Each medal: icon (lucide, as catalogued), rarity frame, state (earned date / best-so-far vs threshold / locked condition text from the canonical rules).
3. **Weapon Mastery**: RPG-7 featured track — actual lifetime damage vs the owner-confirmed threshold, VUA HỀ node with preview + states. (Other weapons honestly marked as future tracks only if data exists — weapon damage for all weapons is folded, display top weapons as records, no fake rewards.)
4. **Recent unlocks** row + **Total Mastery** counter (Prestige pattern).
Desktop: path scrolls horizontally with chapter anchors; mobile portrait: vertical path. All states explicit: LOCKED / IN PROGRESS (best value) / UNLOCKED / EQUIPPED. No AC faucet changes: combat achievements grant mastery + skins, contracts keep paying the existing AC (stated in UI, as today).

## 5. Task 3 — Achievement-gated skins

- **ECOBOT (`hero:ROBOT:ecobot`)**: entitled ⇔ `earned.NEWBOT` ⊇ the 42 ROBOT-applicable ids. Progress `X/42` everywhere shown.
- **VUA HỀ (`weapon:RPG_7:vua-he`)**: entitled ⇔ lifetime `weaponDamage.RPG_7 > 1000` from sealed sources (actual HP-delta damage, correct owner per ledger attribution; Lab/Admin/Quest never seal).
- **Enforcement at the cosmetic authority**: entitlement provider read at call time from the wallet; `equip()` refuses locked skins (`SKIN_LOCKED`); `selected()` falls back to ORIGINAL if a persisted loadout names an unentitled skin (render-safe, no crash, loadout data itself preserved). Default skins always entitled. Locker/Archive UI shows lock state, condition and progress; preview still viewable.
- **Unlock moment**: when a seal-fold crosses an entitlement, a post-match celebration (result-screen-adjacent Gold banner: skin name, artwork, EQUIP NOW → real `equip()` call) + a persistent "new skin" badge until first equipped/viewed.
- **Migration question (owner decision):** saves that equipped these skins during the free era — options in §7.

## 6. Task 4 — Learn by Playing (contextual coach)

Replace the 3-step text carousel with an **action-driven coach** (Wild Rift Welcome pattern): a persisted step machine; each step shows ONE small anchored chip next to the real control, with a soft beacon outline on that control; the step completes only when the player performs the real action.
1. Home → beacon on FREE BATTLE: "Your first fight starts here."
2. Mode select → chip at VS BOT: "Beat the BOT: +200 AC."
3. Fighter select → chip: "NEWBOT is yours. LOCK IN when ready." (completes on lock-in)
4. First BOT battle → when Skill 1 first reads ready on the real HUD: chip at the skill card, device-correct ("Press J" / "Tap the skill card"); completes on actual cast; then Skill 2 once. Auto-expires if the match ends first (no stuck state).
5. After first sealed match → chip at MISSIONS: "You earned AC — claim mission rewards here." Opening the Mastery Vault completes the coach.
Rules: never blocks input (chips are pointer-transparent except SKIP), SKIP always visible, Replay via the existing "?" control (resets the machine), shows once per profile (persisted step; a refresh resumes at the current step, never restarts), scene-aware via the same `MutationObserver` seam the current guide uses, ENG/VIE, reduced-motion safe. Source-verified controls only (J/K, Numpad 1/2 for LOCAL P2, touch skill cards) — copy carried over from the verified guide. BOT WAVE keeps its own runtime guidance (out of scope, as before).

## 7. Owner decisions — RESOLVED 2026-10-21

1. **RPG threshold scope → LIFETIME CUMULATIVE >1000** (owner-selected). VUA HỀ unlocks when sealed-match RPG_7 damage summed over the profile's lifetime exceeds 1000.
2. **Free-era save migration → RE-LOCK WITH PRESERVATION** (owner-selected). Existing loadouts are never deleted; an unentitled skin renders ORIGINAL until truly earned, then works again automatically.
3. **RPG threshold scope (analysis record)** — `>1000` in *one match* vs *lifetime cumulative*. Analysis: RPG-7 peak ≈161/rocket; a strong full match totals ~1,500–2,000 damage across *all* sources, and the RPG is a single picked-up T3 weapon — >1000 from it alone in one match means 7+ near-peak rocket hits and most of the match dedicated to one pickup: an elite, near-unattainable feat → the skin would be practically dead content. Cumulative >1000 ≈ 7 solid rocket hits across a few matches: a real but reachable mastery goal with a meaningful progress bar (Brawl Stars rule: mastery never resets). **Recommendation: lifetime cumulative.** (If single-match prestige is desired later, it can become a separate harder variant.)
2. **Free-era save migration** — (a) *Grandfather*: a loadout that already equips ECOBOT/VUA HỀ at first CP3 boot grants that entitlement once; (b) *Re-lock with preservation*: loadout kept but inert (renders ORIGINAL) until truly earned — no data loss, skin returns automatically on earn; (c) *Re-lock + one-time notice* in the Archive. **Recommendation: (b)** — the Alpha is not publicly released, the owner law is "earned through real gameplay", and nothing is deleted.
3. *(Advisory, no decision needed unless owner disagrees)* LOCAL duels count both sides' feats toward this device profile (consistent with LOCAL AC law); BOT counts P1 only.

## 8. Acceptance plan (Step 3–5)

- Unit/contract gates: fold idempotency, no Lab/Admin entitlement, locked-equip refusal, reload persistence, ROBOT 42/42 → ECOBOT equip OK, RPG 1000 (not entitled) vs 1001 (entitled), AC economy untouched (350 start, +200/+25/+50, draw 350).
- Real-browser: mirror NEWBOT duel screenshots before/after (old rings vs edge light, incl. overlap + heavy VFX + grayscale check), live unlock toast mid-combat, Mastery Vault desktop+portrait, locked skin node with X/42, unlock celebration, both skins equipped in live combat, coach steps 1–5 desktop+mobile.
- Full CI on the new HEAD, honest classification; verdict READY / CONDITIONAL / NOT READY.
