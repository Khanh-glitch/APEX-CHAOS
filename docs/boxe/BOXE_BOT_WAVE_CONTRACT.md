# BOXE — The Fist of Dawn / BOT WAVE
## Owner Rules R2 · 2026-10-15 · BINDING

**Baseline:** latest C04 Field Archive commit `c00897862350cb2159b4c3e2a31afeb04bf71a63`. BOXE PR #88 is a child of C04. Gold source is immutable and must not be represented as uploaded until all 25,675,422 bytes and 10 PNG assets are committed and verified. Keep Draft/no production merge.

## 1. BOXE — NORMAL AUTO BATTLE (BOT Battle & Local 1v1)
- **BOXE's skills and unarmed attacks cause precisely ZERO direct HP damage.** Gold training damage values MUST NOT enter auto battle.
- **SOLE ABILITY-DAMAGE EXCEPTION:** when the **empowered A2** counter hits, its additional key-3 finisher applies exactly **10% of the opponent's HP remaining immediately before that finisher**. Do not convert to 10% max HP.
- Damage from **legitimate owned equipped guns** remains ordinary Arsenal damage, and contributes to Passive outgoing accumulation. Incoming real HP damage to BOXE also contributes. Rejected/countered damage and the zero-damage melee/skill hits do not accrue Passive.
- **Passive — Càng đánh càng hăng:** every total 300 HP of eligible dealt or received *realized* damage, enter enhanced state for 3.000s. Both skills use enhanced behavior and remaining cooldowns recover at twice normal rate for exactly that window. No accumulation inside that window; reset progress to 0 at its END, then resume. A large single event reaching threshold does not bank leftover for next activation.
- **A1 — Fist Rocket:** 15s cooldown, Gold key **2**. A single glove remains outbound and physically collidable for 5.000s, THEN initiates the Gold return/catch. No instant snap, no replacing catch impact spring recoil, squash, hitstop, material/fracture/fire/smoke/audio. Eligible *each distinct real collision event* with opponent **stuns for 0.500s AND disarms again**, without damage. Collision event dedupe prevents one overlap from being counted every physics frame; a later genuine hit is eligible again.
- A1 may collect **at most one** eligible ground gun. Weapon ownership/pickup must use Arsenal authority, not a fake visual. Gun is usable only after physical glove catch. If BOXE's currently equipped gun is still firing at catch time, queue the newly caught weapon and equip immediately after the firing cycle ends. Never force interrupt. Carrying another gun is forbidden.
- **A1 enhanced:** after actual fist impact, the other glove joins with Gold key **1** two-glove *stationary* flurry; BOXE body **does not dash**. Flurry lasts exactly 2.000s. Gold punches launch every 85ms; each distinct confirmed hit stuns for **42.5ms**, zero HP damage. This requires extension of the six-punch Gold scheduler, preserving per-hit VFX.
- **A2 — Block and Hit:** 20s cooldown, key **9** Gold VFX. 1.000s stance. The first eligible opponent-owned incoming damage in that window is completely negated before HP accounting. BOXE lunges, and on actual counter impact stuns opponent for **2.000s** and disarms, with ZERO base hit damage. No retaliation if nothing eligible hits during 1s, no automatic Gold expiry nova.
- **A2 enhanced:** same mechanics, then Gold key **3** cinematic finisher for 10% opponent *remaining* HP. One authoritative damage request, with normal damage caps/KO and no self-retrigger.
- Ordinary modes expose ONLY Passive/A1/A2. No source skills 4–8/0 in conventional game.

## 2. BOT WAVE — SEPARATE REAL-TIME COMBAT POLICY
- Starts with ONLY **J basic punch, K basic defense, L dash**. Neither U nor I is available by default. **I is Gold key 0/10 ultimate**; locked until its upgrade card is actually selected. Base K defense does NOT mean upgraded key-9 counter is unlocked.
- When leveling through REAL XP from REAL kills, pause for exactly **three random eligible upgrade cards**, selected from a seeded, tier-weighted, extensible catalog. Player picks ONE. No preassigned free upgrades or fixed level auto-unlocks.
- Gold source unlock sequence, CONDITIONAL on cards actually being drawn and chosen: **[1] key 1 = J flurry finisher**, **[2] key 3 = J uppercut finisher**, **[3] key 9 = K counter**, **[4] key 5 = U phantom skill**; ultimate **I = key 0/10** is a later distinct unlock card, NOT starting equipment. No auto-grant; generic stat cards remain choices even while unlocks are eligible. Rank is an ordering gate, NOT promise that an unlock appears on a specific level.
- Gold standard melee/ability DAMAGE is valid IN BOT WAVE, unlike the no-skill-damage auto-battle rule; damage belongs to the wave combat engine and real collision/kill authority.
- Fixed initial chapter **10 waves**, with boss engagements at 5 and 10; expandable optional Endless AFTER wave 10.
- Preserve training robots as a family, remove sandbags, spawn from all four arena edges, progressively introduce data-registered robot variants/bosses. Real waves/XP/loot track exactly-once kills.
- Horizontal arena for desktop/mobile. Mobile auto-targeting joystick + touch J/K/L/U/I (locked buttons hidden/disabled). Do not assume physical keyboard on phone. World camera/background and favicon center mark change; scrub training debug lines.
- Remove only runtime ribbon cloth physics (all five strips), retain source character sprite unchanged. Gold VFX/animation/audio/kinetic catches must otherwise remain full fidelity. Owner may separately authorize editing cloth drawn into sprites.

## 3. Data-driven acceptance
- One authoritative fighter/weapon registration, no N copies of BOXE across Home/Fighter Pick/Field Archive/shop/HUD.
- Gold source hash and all ten lossless PNG hashes verified BEFORE registering BOXE as public playable or BOT WAVE as ACTIVE.
- C04 combat profile must reflect zero skill damage (control/mobility > damage) without fake numeric DPS.
- New enemy, skill or upgrade added via declarative registry only, without per-ID UI edits.
- CI: pure semantic gates -> original Gold SHA gate -> VFX event bridge -> Chrome desktop/mobile landscape real active mode -> owner playtest.
