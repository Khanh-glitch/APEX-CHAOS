# BOT WAVE · BOXE Gold R4 Playtest Receipt

- Source PR: #88 (Draft), based on latest Field Archive Dictionary C04, not legacy C03 / main.
- **Standalone Gold derivative** shared in owner ChatGPT conversation: `BOXE_BOT_WAVE_GOLD_PLAYTEST.html` (**25,715,502 bytes**, SHA-256 `fede8a043e1259cdc087411a9034ddee2806fe3f10672f10e34d02e0fdaee5ab`).
- Bundled playtest archive: `BOXE_BOT_WAVE_GOLD_R4_PLAYTEST_PACKAGE.zip` SHA-256 `0759070cd1557614afc0beb6b5b4740d92b90de02e41799639375e849baae1c3`. This is a conversation artifact, **NOT a source Git blob**.
- Original owner Gold SHA-256 `ccb889bb08cb2e741c4f7f5e0b33d08047c08fb28bfc1c31ae9401604444e2b2`; original 25,675,422 bytes, unmodified.

## Owner R4 requirements and implementation
- **Rocket Fist** is a separately drawn Rare card. On each **confirmed** Gold basic or Gold key-1 jab hit, 7.5% seeded probability roll; at most one detached right glove; original key-2 launch, full Gold smoke/fire/electric/impact, five seconds of bounces, same Gold return/catch.
- Desktop **and** mobile auto-target closest living robot; resolved in native Gold aim assignment BEFORE queued basic hit angle, not merely visual mouse pointer position.
- Wave progression uses **original gun stats** (Pistol 3, SMG 8, Shotgun one 8-pellet volley, Sniper one, Grenade one). Gun damage/velocity/cadence/reload are unchanged by wave number and boss status. Wave/boss HP, combined gun loadouts, spawn sides, tactical lanes and enemy count change. BOXE wave-only HP trial 3200.
- J Gold combo explicitly gated: three native basic attacks (L/R/heavy L) → six native Gold-1 jab punches every 85 ms with 50 ms impact delay → Gold-3 uppercut at heavy-start +980ms with +170ms hit delay. Real Gold skill cooldowns are respected; unavailable phases are not skipped. U/I still gated by cards.
- No modification to conventional BOXE zero-skill-damage owner law: only BOT WAVE Gold mode deals skill damage.

## QA evidence
1. Chromium desktop/mobile landscape boots, controls J/K/L, three random cards, locked U/I, XP: **PASS**. Mobile viewport 844×390 has no horizontal overflow.
2. Forced-probability *test hook only* with real confirmed hit: Gold rocket launched, remained OUTBOUND past the old 880-unit cap, switched return after 5000ms, then was physically caught and right glove restored: **PASS**.
3. Actual Gold combo execution trace: basic J1/J2/J3 → Gold1 → Gold3 in correct order, no JS errors: **PASS**.
4. All ten waves/boss rosters/chapter-clear traversed via expedited QA KOs: **PASS for state machine, NOT real survival balance**.
5. Separate moving/J-attack controller naturally defeated six wave-1 bots using real damage (no forced KO), earned XP, selected one of three cards and cleared wave 1 in ~13 simulated seconds: **PASS for mechanical playability**, NOT human playtest or all-wave balance proof.
6. Full GitHub product Chrome suite on PR branch is tracked independently. Do not equate this with the standalone game's native engine/VFX parity.

## Pending
- Original Gold HTML + ten PNGs not yet imported into Git's `masters/boxe-gold/`. Safe V2 import archive exists as separate artifact; Git connector cannot transfer binary from local sandbox as source.
- Real Arsenal gun sprites still use temporary graphical silhouettes in standalone; production sprite/ownership combat authority, Fighter Pick, Dictionary and public BOT WAVE route not yet wired. Never describe these as complete.
- Quantitative player survival, VFX parity across all skills, mobile frame budget and weapon-balance owner approval remain open.

**Do not merge to main.**
