# CP3.2 — Achievement Feasibility & Final Owner Playtest Design

**Status:** OWNER APPROVED 2026-10-21 — implementation in progress. Approved: the recommended balance package with ECOBOT still at 42/42; skill-assisted weapon damage; provisional live achievement feedback with permanent earn/entitlement only at a valid seal; Cloudflare Pages branch preview as the durable-preview route.
**Base:** `bc098061137f6707c2008bbba85ca4980f723c35` (CP3.1)
**Scope:** all 42 NEWBOT-applicable achievements that gate ECOBOT.
**Non-negotiables:** keep 42 achievements; ECOBOT still requires 42/42; no fake damage, fake casts, UI-only unlocks, Lab/Admin mastery, direct wallet injection as gameplay proof, or threshold reduction merely to make a test pass.

## 1. Source facts used for calibration

The recommendations below are derived from the shipped authorities, not from invented catalogue entries:

- Canonical display/threshold source: `result-gold/src/data/ownerDecisions.json`; runtime catalogue: `public/game/results/ownerAwards.generated.js`.
- Actual match telemetry: `public/game/results/matchResultAuthority.js` consumes realized HP-delta damage, shots, pickups, heals, casts, controls, blocked damage, final-round tags and hero bus events.
- Wallet/mastery authority: `public/game/arsenal/arsenalMetaRuntime.js`; ECOBOT is complete only when the lifetime earned union contains every applicable NEWBOT achievement.
- Match HP is 1000; conventional equipment damage scale is ×7.
- Offensive pickups spawn every 4.5s with at most 5 active; the first trigger after a ranged pickup is delayed 0.35s.
- Heals spawn every 9s, one active; weighted mean restore is 147.4 HP.
- NEWBOT active skills are Weapon Dash (10s, mobility toward a revealed eligible pickup) and Virtual Armor (10s cooldown, 3s at `incomingMult=0.45`). Rolling Burst is a cooldown-refund passive. None is an owned direct-damage skill.
- Virtual Armor has an authoritative `RobotA2Hit` event containing pre-mitigation `amount` and post-mitigation `reduced` values.
- Tower Shield GUARD uses `damageTakenMult=0.25` and is currently the only caller of ledger `onBlocked`.
- One-pickup non-crit family damage ceilings from the shipped weapon registry:
  - SEMI: 88.2–126
  - AUTO: 109.2–218.4
  - BURST: 75.6–88.2
  - PRECISION: 98–182 (one shot per pickup; SNIPER crit can reach 273)
  - SHOTGUN: 186.2–403.2; AUTOSHOT/JACKHAMMER: 273
  - MELEE: repeatable while held, approximately 94.5–273 per ordinary hit

Difficulty scale in this document:

- **A:** feasible in ordinary focused play.
- **B:** hard, deliberate mastery target.
- **C:** prestige/repeat-attempt target, but with a deterministic legal path.
- **D:** blocked or not realistically attainable as shipped.

## 2. Recommended owner decision package

| ID | Decision requiring approval | Recommended package |
|---|---|---|
| D1 | ECOBOT shape | Keep **42/42** and keep every achievement one-match unless a row below explicitly changes telemetry. Do not make ECOBOT optional-count. |
| D2 | Blocked skill achievements | Redefine `combo-artist` / `chaos-bringer` as **skill-assisted weapon damage** using real successful skill-cast events plus real weapon damage. Do not invent NEWBOT skill damage and do not change combat balance just to satisfy catalogue wording. |
| D3 | `fate-hand` | Change canonical delay from **0s to 2.0s**, measured from the actual pickup of the lethal weapon instance/ID to the actual lethal HP-delta event. |
| D4 | `no-escape` | Honour the displayed rule: a **500-damage chain whose consecutive realized-damage gaps are ≤1.2s**. Replace the shipped 500-in-rolling-1.2s metric; keep 500/1.2. |
| D5 | `iron-wall` | Count **actual prevented HP damage** from both Virtual Armor and Tower Shield GUARD through the one damage-mitigation path. Keep 250. |
| D6 | Weapon-family calibration | Keep one-match family feats, include AUTOSHOT in shotgun mastery, and calibrate to shipped ceilings: **SHOTGUN 250, AUTO 220, BURST 120, PRECISION 200, SEMI 160, MELEE 400**. |
| D7 | Duration/RNG tuning | `arsenal 10→7` damaging IDs; `legend-survivor 500→350`; `untouchable 60s/100→45s/150`; `scavenger 20→8`; `one-breath 8s→5s` with a survival latch; `skill-focus 30→12`. |
| D8 | Semantic alignment with no threshold change | Fix `weapon-swap`, `arsenal`, `kiter`, `pacifist`, `mastery-shotgun`, `thick-skin`; also fix the smaller verified telemetry edges in `glass-cannon`, `assassin`, `sure-shot`, `steady-hand`, and `one-breath`. |
| D9 | Live-before-seal law | Recommended option L1 below: live **provisional** feedback, permanent earn/entitlement only in the same valid sealed-match transaction as progression/AC. Existing earned CP3/CP3.1 progress is grandfathered. |
| D10 | Durable preview | Use a Cloudflare Pages branch preview whose `CP16_BUILD_RECEIPT.json` must equal the final CP3.2 SHA/revision; never use the production/main URL or a sandbox-local URL as acceptance evidence. This still requires the project’s branch deployment or `CLOUDFLARE_API_TOKEN` repository secret to be enabled by the owner. |

## 3. Full 42-achievement audit and proposal

| # | Achievement | Current displayed condition | Actual shipped telemetry | Now | Blocker / mismatch | Proposed CP3.2 condition and telemetry | Target |
|---:|---|---|---|---|---|---|---|
| 1 | `no-escape` | ≥500 realized damage in a chain; gap ≤1.2s | `maxBurst1`: maximum damage inside any rolling 1.2s window | C | Displayed chain can span many seconds; shipped metric requires all 500 inside 1.2s | Keep **500 / 1.2s**, implement a damage-event chain: add realized damage, reset only when the gap since the attacker’s previous realized damage is >1.2s | C |
| 2 | `first-blood` | First side to deal >0 actual damage | First positive `onDamage` latches `firstBlood` | A | None | Keep | A |
| 3 | `overkill` | One hit ≥250 | Maximum single realized HP-delta transaction | B | Shotgun pellets are separate transactions; legal paths are STORMBREAKER 446, axe 273, SNIPER crit 273 | Keep 250 and the one-transaction definition | B |
| 4 | `burst-king` | ≥350 in rolling 3s | `maxBurst3` from realized-damage timeline | B | None material | Keep | B |
| 5 | `executioner` | Finishing hit starts at target ≤20% HP | Reconstructs pre-hit HP from the accepted lethal HP delta; final-only | A | None | Keep | A |
| 6 | `glass-cannon` | Dealt/taken ratio ≥2 and dealt ≥450 | Final ratio uses `taken>0 ? dealt/taken : 0` | B | A flawless 1000/0 win paradoxically fails because zero denominator is encoded as ratio 0 | Keep thresholds; treat `taken=0 && dealt≥450` as satisfying the ratio through a finite internal sentinel | B |
| 7 | `sure-shot` | Accuracy ≥65% over ≥10 valid shots | All arsenal damage events increment hits; all `onShot` projectiles/specials increment shots; final-only | B | Melee/special multi-tick damage can distort a ranged-accuracy ratio | Keep 65/10; restrict numerator/denominator to crit/ranged projectile shots and their realized projectile hits | B |
| 8 | `assassin` | Crit rate ≥25% over ≥8 crit-eligible hits | Crit numerator only comes from guns, but denominator is every weapon-labelled hit | C | Melee/special hits dilute the denominator even though copy says crit-eligible | Keep 25/8; denominator = hits from weapons with `CRIT_CHANCE>0` only | C |
| 9 | `eagle-eye` | ≥250 damage from ≥500 units | Sums realized damage whose attacker-victim impact distance is ≥500 | B | None material | Keep | B |
| 10 | `steady-hand` | ≥6 consecutive ranged shots hit | Every weapon damage event increments streak; shipped `onMiss` has no production caller | B | Current streak is closer to cumulative weapon hits than consecutive shot outcomes | Keep 6; add per-projectile shot outcome tracking (hit consumes a pending ranged shot, expiry/wall/no-hit resolves a miss) and reset only on a resolved miss | B |
| 11 | `point-blank` | ≥300 damage within ≤240 units | Sums realized damage at impact distance ≤240 | A | None material | Keep | A |
| 12 | `final-round` | KO with a finite weapon’s final shot | Lethal damage must carry the runtime `final` result tag; final-only | B | Requires deliberate ammo/HP setup, but legal | Keep; add explicit last-shot and non-last-shot regression cases | B |
| 13 | `ricochet` | Thrown weapon hits after a wall bounce ≥1 | `onRicochetHit` from thrown-melee runtime | B | Skill/angle dependent, not blocked | Keep | B |
| 14 | `mastery-shotgun` | SHOTGUN/AUTOSHOT damage ≥400 in one match | Sums only family `SHOTGUN`; AUTOSHOT is excluded | C | Only a near-perfect SPAS pickup reaches 400 alone; JACKHAMMER does not count despite copy | Change to **250**, sum `SHOTGUN + AUTOSHOT` | B |
| 15 | `mastery-auto` | AUTO damage ≥400 | One-match AUTO family sum | C | Best ordinary one-pickup ceiling is 218.4; 400 normally needs multiple strong pickups | Change to **220** | B |
| 16 | `mastery-burst` | BURST damage ≥350 | One-match BURST sum | C | One pickup ceiling is only 75.6–88.2 | Change to **120** | B |
| 17 | `mastery-precision` | PRECISION damage ≥350 | One-match PRECISION sum; each pickup has one shot | C | Needs two ordinary hits plus a third/crit path at current value | Change to **200** (two ordinary precision hits or one SNIPER crit) | B |
| 18 | `mastery-semi` | SEMI damage ≥350 | One-match SEMI sum | C | One-pickup ceiling is 88.2–126 | Change to **160** | B |
| 19 | `mastery-melee` | Melee damage ≥400 | Genuine `MELEE_WEAPON_IDS` damage; STORMBREAKER is not counted as ordinary melee family | B | Repeatable held hits make the current target legal | Keep 400 | B |
| 20 | `weapon-swap` | Damage with a weapon ≤2s after picking it up, twice | Increments when successive pickups are ≤2s apart; damage is not required | A | Telemetry measures pickup-to-pickup, not pickup-to-damage | Keep **2s ×2**; each pickup can qualify once when its first realized damage with the same weapon ID occurs ≤2s after that pickup | A |
| 21 | `arsenal` | Damage with ≥10 different weapon IDs | Counts distinct picked-up IDs, whether or not they dealt damage | C | Copy/telemetry mismatch; 10 damaging IDs is spawn/duration extreme | Change to **7 distinct IDs that actually dealt realized damage** | C |
| 22 | `legend-survivor` | Heal ≥500 actual HP in one match | Sum of actual capped heal pickups | C | Mean heal is 147.4 and spawns are contested every 9s; 500 usually needs four good heals | Change to **350** | B |
| 23 | `iron-wall` | Prevent ≥250 damage by Fighter mitigation/absorption | Only Tower Shield GUARD calls `onBlocked`; Virtual Armor contributes 0 | C | NEWBOT’s own signature mitigation is excluded | Keep 250; count sequential actual prevented damage from Virtual Armor (`amount-reduced` on authoritative `RobotA2Hit`) and Tower Shield GUARD, with no alias/double count | B |
| 24 | `last-stand` | Win with ≤10% HP | Winner-gated final HP; final-only | B | None | Keep | B |
| 25 | `untouchable` | Win after ≥60s, taken ≤100 | Final elapsed + cumulative taken; implicit win by seal context | C | One 182-damage sniper hit alone busts the budget; 60s of near-perfect defence while dealing 1000 is extreme | Change to **≥45s and taken ≤150**, explicitly winner-gated | C |
| 26 | `scavenger` | Pick up ≥20 floor items | Counts successful equipment equips only; heals do not count | C | Shared 4.5s spawns plus already-armed rejection make 20 a stall/monopoly target | Change to **8 successful equipment pickups** and align copy from generic “items” to equipment | A |
| 27 | `second-wind` | After ≤25% HP, heal ≥140 | Actual heal is danger-qualified from reconstructed pre-heal HP | B | Usually needs one H3+ heal or carefully sequenced smaller heals | Keep | B |
| 28 | `thick-skin` | Take ≥600 and win | Predicate is only `taken≥600`; it is live-safe and can earn for a losing side before seal | B | Winner gate missing | Keep 600; make it **final-only and winner-gated** | B |
| 29 | `one-breath` | Survive ≥8s after HP reaches ≤10% | Requires current HP ≤10% at seal plus cumulative `secondsLow≥8`; healing above 10% before seal can erase a true survival feat | C | Current predicate is not a survival latch | Change to **5s survival latch**: once the fighter remains alive 5s after first crossing ≤10%, qualify permanently for that match even if healed or the match later ends above 10% | B |
| 30 | `comeback` | Win after trailing by ≥300 HP | Tracks max HP deficit and winner gate at seal | B | None | Keep | B |
| 31 | `pacifist` | No damage for ≥30s while travelling ≥500px in that window | `noDamageTime` only accumulates before the side’s first-ever damage; travel is whole-match distance | B | Later 30s no-damage windows do not count, while unrelated earlier travel does | Keep 30/500; track a rolling segment since the attacker’s last realized damage and distance travelled inside that same segment | B |
| 32 | `skill-focus` | Successfully cast skills ≥30 times | Counts successful active-skill cast callbacks | C | Two 10s skills need roughly 2.5 minutes of perfect cadence; Weapon Dash also needs an eligible pickup | Change to **12 successful A1/A2 casts** | B |
| 33 | `kiter` | Deal ≥250 while moving ≥150px/s at damage time | Uses total dealt plus whole-match average speed | B | Slow/standing damage counts if match-average speed is high | Keep 250/150; sum only damage events whose attacker’s instantaneous measured speed at impact is ≥150px/s | A |
| 34 | `trickster` | 3 follow-up damages within 2.5s after push/CC/disarm | `onControl` opens a per-victim 2.5s window; first realized follow-up consumes it | B | Legal natural path already observed | Keep | B |
| 35 | `combo-artist` | 3 chains where skill and weapon both deal damage within 2s | Generic ledger classifies non-`arsenal-` labels as skill damage, but NEWBOT has no normal owned skill-damage path | D | Blocked for NEWBOT as shipped | Redefine copy/metric to **skill-assisted combo**: 3 distinct successful active-skill casts each followed by realized weapon damage from the same fighter within 2s. A cast with no weapon damage never counts | B |
| 36 | `adrenaline` | Deal ≥250 while own HP ≤25% | Sums realized damage dealt while attacker HP fraction ≤25% | B | None | Keep | B |
| 37 | `clutch` | Deal ≥350 in final 30s | Seal-time sum of realized damage in last 30s; final-only | B | None | Keep | B |
| 38 | `never-surrender` | Deal ≥400 while behind on HP | Reconstructs pre-hit victim HP and sums damage dealt while attacker was behind | B | None | Keep | B |
| 39 | `speed-win` | Win in ≤45s | Winner-gated elapsed at seal | B | Demanding burst path, but legal with high-tier burst/melee/STORMBREAKER routes | Keep | B |
| 40 | `fate-hand` | KO with weapon picked up ≤0s earlier | KO timestamp minus last pickup timestamp for same weapon ID | D | 0s conflicts with 0.35s ranged-ready delay, melee windups and projectile travel | Change delay to **2.0s**; bind the timing to the lethal weapon’s pickup instance/ID and actual lethal HP-delta time | B |
| 41 | `chaos-bringer` | In 20s, damage from ≥3 weapon IDs and ≥1 skill | Requires a generic “skill” damage event in the rolling 20s event set | D | Same missing NEWBOT skill-damage source | Redefine to **multi-source skill-assisted chaos**: within one rolling 20s window, realized weapon damage from ≥3 IDs and at least one successful active-skill cast followed by weapon damage within 2s | C |
| 42 | `signature-newbot` | Rolling Burst refund in ≥3 distinct skill cycles | Counts distinct A1/A2 cooldown-cycle keys only when authoritative `RobotPassiveUpgrade.refund>0` actually reduces a live cooldown | B | First passive milestone refunds 0s; a qualifying cycle needs the 200-damage burst milestone while a skill is cooling down | Keep 3; clarify Vault copy/progress so players understand distinct refunded cycles | C |

## 4. Detailed solutions for the named problem groups

### 4.1 `fate-hand`

- Keep the fantasy: pickup → immediate lethal conversion.
- Canonical delay becomes **2.0s**, not zero. This accommodates the 0.35s ranged-ready delay, ordinary melee windups (0.10–0.42s), aim/fire and short projectile travel without becoming a generic “recently picked up” award.
- Telemetry must store pickup sequence/time and weapon ID. Only the lethal realized-damage event from that same weapon can qualify; a later pickup of another weapon invalidates the earlier pickup for this metric.
- Boundary tests: 1.99s passes, 2.01s fails, non-lethal damage fails, different weapon ID fails, Lab never folds.

### 4.2 `combo-artist` and `chaos-bringer`

Recommended solution is a **definition correction**, not a balance change:

- A “skill-assisted hit” is a realized weapon-damage event by the same fighter within 2.0s after a successful A1/A2 cast event from the existing ability controller.
- Failed cast attempts, passive refunds, VFX, HUD animation and the cast alone never count.
- `combo-artist`: three distinct casts each producing at least one skill-assisted weapon hit. One cast cannot create multiple chains.
- `chaos-bringer`: in one rolling 20s window, at least three weapon IDs deal realized damage and at least one of those hits is skill-assisted.
- The generic catalogue copy must stop saying NEWBOT’s skill itself dealt damage. Suggested English:
  - Combo Artist: “Land weapon damage within 2 seconds after a successful skill cast, using 3 distinct casts.”
  - Chaos Bringer: “Within 20 seconds, deal damage with at least 3 weapon IDs, including at least one skill-assisted weapon hit.”
- Alternative requiring separate owner approval: add real impact damage to Weapon Dash. This is not recommended in CP3.2 because it changes NEWBOT balance, collision outcomes and every hero-rework regression surface merely to preserve old wording.

### 4.3 `no-escape`

Implement an attacker chain state in the result ledger:

```text
on realized damage:
  if now - previousDamageAt > 1.2: currentChain = 0
  currentChain += actualHpDelta
  maxChain = max(maxChain, currentChain)
  previousDamageAt = now
```

Self-damage, zero/negative deltas, simulated damage and non-countable sides never enter the chain. `burst-king` remains the separate rolling-3s burst achievement, so the two awards no longer collapse into the same metric family.

### 4.4 `iron-wall`

- Tower Shield already reports `amount * (1 - 0.25)` when actual damage occurs.
- Virtual Armor reporting should consume only authoritative `RobotA2Hit`, never its alias, and add `amount - reduced` for the track matching `bodyId`.
- If both mitigations stack, they are sequential in the real pipeline: Tower Shield first in `aqDamage`, Virtual Armor inside the target damage transform. Summing each stage’s delta equals total prevented damage and does not double-count.
- Prevented damage should be capped to the damage that would otherwise have been realized in that transaction; no credit for a fully negated/no-HP-delta speculative packet should be invented beyond the existing pipeline’s actual transaction.

### 4.5 Weapon-family mastery

The proposed values are calibrated to roughly two useful pickups or one exceptional pickup, not to free completion:

| Family | Current | Proposed | Why this remains mastery |
|---|---:|---:|---|
| SHOTGUN + AUTOSHOT | 400, AUTOSHOT excluded | 250 | Requires a strong close-range SPAS/JACKHAMMER sequence or two shotgun pickups |
| AUTO | 400 | 220 | Above every ordinary one-pickup ceiling except a near-perfect M249; normally two pickups |
| BURST | 350 | 120 | Requires about 1.5–2 full BURST pickups with real hit conversion |
| PRECISION | 350 | 200 | Requires two ordinary precision hits or one SNIPER crit |
| SEMI | 350 | 160 | Requires about 1.5–2 full SEMI pickups |
| MELEE | 400 | 400 | Repeatable held weapon; roughly 2 axe hits, 3 spear/club hits or more dagger hits |

Family damage remains one-match and realized HP-delta only. SPECIAL weapons do not silently join a conventional family.

### 4.6 `scavenger` and `skill-focus`

- `scavenger`: 20 → **8 successful equipment pickups**. A successful pickup still requires the normal unarmed/revealed/physical equip transaction. Heals remain healing telemetry, not equipment pickups.
- `skill-focus`: 30 → **12 successful A1/A2 casts**. Two 10s skills reach 12 only after sustained deliberate use for roughly a minute; failed/no-target attempts do not count because the existing cast callback is success-based.

### 4.7 Other extreme one-match feats

- `arsenal`: 10 picked IDs → **7 damaging IDs**. Seven still requires rapid cycling and converting each weapon into real damage.
- `legend-survivor`: 500 → **350**, normally two high-value or three typical heals.
- `untouchable`: 60s/100 → **45s/150**, explicitly winner-gated.
- `one-breath`: 8s/current-HP predicate → **5s survival latch**.

## 5. Semantic alignment details

### `weapon-swap`
Replace `swapFast` pickup-to-pickup counting with a per-track pending pickup `{weaponId, at, sequence}`. The first realized damage from that ID within 2s consumes it and increments once. Changing weapons replaces the pending pickup.

### `arsenal`
Replace `weapons` pickup set for this predicate with a damaging-ID set populated only on positive realized weapon damage.

### `kiter`
Ledger tick already measures displacement. Store a short instantaneous speed sample per fighter (displacement/dt, clamped by the existing anti-teleport cap) and sum damage whose impact-time attacker speed is ≥150px/s. Do not use match-average speed.

### `pacifist`
Track `lastDealtDamageAt` and `distanceAtLastDealtDamage`. Qualify when `now-lastDealtDamageAt≥30` and `distance-distanceAtLastDealtDamage≥500`. Match start is the initial segment. Taking damage does not reset the segment; dealing any positive damage does.

### `mastery-shotgun`
Sum both `SHOTGUN` and `AUTOSHOT` family damage and rename the internal observed mapping accordingly.

### `thick-skin`
Add to final-only set and return no qualifying observation unless the track is the sealed winner. Existing CP3/CP3.1 earned records are not retroactively revoked without a separate migration decision.

### Smaller verified edges

- `glass-cannon`: zero taken must not encode ratio 0.
- `assassin`: denominator is crit-eligible firearm hits only.
- `sure-shot` / `steady-hand`: use ranged projectile shot outcomes rather than every damage tick.
- `one-breath`: latch survival rather than requiring low HP at seal.

## 6. Live-before-seal law options

### L1 — Recommended: provisional live, permanent at valid seal

1. `evaluateLive()` may emit a monotonic achievement once per track for immediate feedback, but the wallet stages it only in match memory as **provisional**.
2. Toast/copy must say it confirms at match result; it must not claim permanent unlock or skin entitlement yet.
3. Exit, reload, Lab/Admin/Quest, invalid mode or an unsealed match discards provisional events. No AC, progression, mastery best, weapon damage or skin changes.
4. At a valid BOT/LOCAL seal, one wallet save performs, in order:
   - reject if `resultGold.meta.id` is missing or already in `claimedMatchIds`;
   - append the claim ID;
   - apply match progression and existing AC law (+200/+25/+50);
   - union sealed awards by `(heroId, achievementId)` and preserve first earn timestamp;
   - fold bests and sealed weapon damage;
   - compute ECOBOT/VUA HỀ entitlement after the union;
   - persist once, then dispatch unlock/celebration events.
5. A duplicate callback or duplicate sealed result returns `duplicate-claim` and folds nothing. A duplicate achievement in a later match updates best only, never timestamp/recent/celebration.
6. BOT folds P1 only; LOCAL folds both device players. Lab/Admin/Quest create no permanent mastery.
7. Earn timestamp may preserve the provisional crossing wall-clock time, but entitlement becomes effective only at seal.

This is the strongest anti-farm law: quitting after an event cannot bank ECOBOT progress, while players still receive immediate feedback.

### L2 — Current CP3.1 law

Live-safe earns persist immediately and survive quit/reload; AC/match counts still wait for seal. This is more responsive, but a live-safe 42nd earn unlocks ECOBOT without completing that match.

### L3 — Hybrid

Live-safe earns persist immediately, but ECOBOT/VUA HỀ entitlement waits for the next valid seal. This preserves instant achievement satisfaction but can display 42/42 while the skin remains locked, so it needs explicit UI copy.

**Migration recommendation for any option:** grandfather all existing earned achievements, timestamps, bests, weapon damage and already-entitled skins in current saves. Do not silently revoke CP3/CP3.1 progress. The chosen law applies only to future earns unless the owner separately approves a migration.

## 7. ECOBOT balance after the recommended package

ECOBOT remains a prestige reward because the 42 feats still require mutually incompatible match plans across many matches:

- offensive chains/bursts and precision/close/long-range damage;
- six weapon-family routes and seven damaging weapon IDs;
- survival, comeback, low-HP and low-damage wins;
- pacifist movement, scavenging, skill cadence and control follow-ups;
- NEWBOT-specific Rolling Burst refund cycles;
- a fast pickup-to-KO conversion and multi-source skill-assisted chaos.

Proposed post-change distribution: **A 6 / B 30 / C 6 / D 0**. The C set is intentionally `no-escape`, `assassin`, `arsenal`, `untouchable`, `chaos-bringer`, and `signature-newbot`—prestige feats with repeatable legal strategies rather than impossible telemetry.

Acceptance calibration rule for implementation: every achievement must have both

1. a deterministic ledger test using legal event sequences just below, at, and above its boundary; and
2. at least one actual runtime/browser path demonstrating the source event can occur without direct wallet/catalogue injection.

A unit fixture that directly writes `earned` is migration/UI proof only; it is not gameplay-feasibility proof.

## 8. Implementation plan after approval

1. Edit the canonical owner catalogue (`ownerDecisions.json`) only for approved params/rules/metrics/notes.
2. Regenerate Result Gold data and `ownerAwards.generated.js` through a reproducible generator; do not hand-edit generated output as the source of truth.
3. Align bilingual display rules in the existing locale authority.
4. Implement telemetry changes only in `matchResultAuthority` and the existing damage/cast/pickup authorities; no second achievement engine.
5. Implement the chosen live law in the one wallet (`arsenalMetaRuntime`) and existing battle live evaluator; no second wallet or entitlement authority.
6. Add/extend CP3.2 mastery gates for every changed row, old-save migration, duplicate seal, BOT/LOCAL side scope, Lab/Admin exclusion, and ECOBOT 41/42→42/42.
7. Bump runtime revision and regenerate Gold/runtime locks through existing generators.
8. Run production build, node gates, Arsenal headless, full relevant browser suites, natural NEWBOT gameplay scenarios, exact-head CI, then produce final media from that exact build.

## 9. Durable preview and direct media plan

The final CP3.2 acceptance build must not use an Arena sandbox URL or `/home/user/...` paths as links.

Preferred route:

- Cloudflare Pages project `apex-chaos`, branch-preview deployment for the CP3.2 head.
- Verify the live `CP16_BUILD_RECEIPT.json` equals the final pushed SHA and CP3.2 runtime revision before calling the URL a preview of that commit.
- Run browser acceptance against the live preview URL itself, not only localhost.
- Deliver at least the CP3.1-equivalent media set—25 PNG + 2 MP4 or a better equivalent—as directly presented files and as a downloadable evidence artifact linked from the PR. The report must state the exact SHA embedded in the preview receipt.

Current infrastructure fact: the current branch alias has no Cloudflare deployment yet, and the legacy direct-deploy workflow failed because `CLOUDFLARE_API_TOKEN` is not configured. Therefore the owner must either enable Cloudflare branch deployments for this branch or add the repository secret; no credential should be pasted into chat. The production `apex-chaos.pages.dev` URL must not be used as a CP3.2 preview.

## 10. Owner decisions recorded

The owner approved the following on 2026-10-21:

- [x] **Catalogue shape:** keep all 42 and ECOBOT at 42/42.
- [x] **Skill definition:** skill-assisted weapon damage for `combo-artist` / `chaos-bringer`; no invented NEWBOT direct skill damage and no combat-damage redesign.
- [x] **Threshold package:** `fate-hand 2.0s`; families `250/220/120/200/160/400`; `arsenal 7`; `legend-survivor 350`; `untouchable 45/150`; `scavenger 8`; `one-breath 5s latch`; `skill-focus 12`.
- [x] **Semantics package:** `no-escape` chain-gap, Virtual Armor counts for `iron-wall`, and all telemetry alignments in §5.
- [x] **Live law:** L1 provisional-until-seal. Permanent achievements and skin entitlements commit only inside a valid sealed BOT/LOCAL wallet transaction.
- [x] **Migration:** grandfather existing CP3/CP3.1 earns, timestamps and entitlements.
- [x] **Durable preview route:** Cloudflare Pages branch preview, verified from the live build receipt. External deployment enablement must still be verified before any READY verdict; no credential is to be pasted into chat.

Implementation follows these decisions. CP3.2 must not be called READY until the production build, regression/real-gameplay evidence, exact-head checks, durable preview receipt and owner media package all pass.
