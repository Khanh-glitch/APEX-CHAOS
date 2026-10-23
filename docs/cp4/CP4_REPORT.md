# CP4 — Combat Intelligence · Premium HUD/UX · Product Polish

Status: **implemented for owner playtest review**. This is not an OWNER
ACCEPTED claim, not a merge, and not a production deploy.

Baseline: PR #101 head `15488b089ee729df89c0f98164f018998cc57374`.
Runtime revision: `20261021-cp4-r2` (70 versioned runtimes; r2 relocks the
Result canonical-portrait fix found by the Arsenal Product Acceptance
owner-candidate gate).

## What changed

1. **Wall-contact readability.** NEWBOT wall hits no longer spawn the radial
   filled flash/disc; wall dust renders as velocity scrape streaks. ECOBOT
   records the struck wall axis and renders wall-parallel scrapes/broken
   wisps instead of radial filled ellipses. Frost material feedback, springs,
   chips/shards, bounce and sound paths were retained. No physics, damage,
   hitbox, cooldown or silhouette change.
2. **Result portraits/weapons.** The sealed Result snapshot now records
   per-side hero skin IDs and registered per-side weapon skin previews.
   Result art resolves through the app entry-base authority and normalizes
   payload art against the parent of `result-gold/`, so root deploys and
   nested `/html/<id>/` hosting use first-party art instead of escaping to
   the origin root. Skin art falls back to base weapon art, then to an honest
   labelled placeholder only after an image error. The itch pack rewrites and
   canaries `result-gold/` URLs.
3. **Weapon display authority.** `arsenalConfig.js` now owns the frozen
   41-weapon `WEAPON_DISPLAY_NAMES` map plus `weaponDisplayName(id)`.
   Internal IDs, save keys and asset paths are unchanged. `SHOTGUN` displays
   as **SPAS-12**, `PISTOL` as **colt**, `SMG` as **MP5**, and
   `SNIPER` as **Snipex Alligator**. HUD, Gold bridge, Result seal,
   Cosmetic Locker, Field Archive and Mastery/Vault records consume the same
   authority.
4. **First-fight side introduction.** A one-time-per-mode role word is rendered
   inside the existing HUD identity rows: BOT uses YOU · PLAYER 1 versus
   BOT · PLAYER 2; LOCAL uses PLAYER 1 versus PLAYER 2. No arena ring, arrow,
   diamond, marker or new surface was added.
5. **Pausing skill tutorial.** In beginner BOT battles only, the coach waits
   for a real tactical opportunity from the shared hero-rework evaluator,
   publishes a heartbeat pause lease, and both simulation step wrappers stop
   before pre-tick/simulation while the lease is fresh. The shared ability
   executor returns `tutorial-paused` during the lease. The player's real J/K
   key or real P1 skill-card pointer hold/release releases the lease first and
   is forwarded exactly once. Cooldown-zero alone never opens a lesson; a
   forgotten lesson auto-resumes, and SKIP/replay/visibility/pagehide recovery
   paths release the lease.
6. **Smart achievement feedback.** Live mastery events now carry
   side/sideIndex/battleMode from the result authority. The battle runtime
   forwards both sides for presentation, while the meta runtime derives
   owner side/kind and wallet eligibility. BOT P2 feats are presentation-only
   and never fold into the player wallet; LOCAL P2 remains wallet-eligible.
   Provisional events remain `sealRequired: true`; `walletEligible` is the
   separate law for whether sealing may record them. Toasts are owner-side
   docked in HUD gutters (portrait: the band between arena and skill deck),
   queue/overflow aware, and distinguish provisional dashed framing from
   sealed solid framing.
7. **Premium rarity.** `masteryCatalog.js` exposes one rarity presentation
   authority: common = circle/1 pip, rare = octagon/2, epic = shield/3,
   legendary = starburst/4, each with a non-color pattern. Toast and Mastery
   Vault consume the same shapes/patterns/pips. Locked, in-progress and earned
   states remain distinguishable by frame/hatch/meter as well as text/ARIA.
8. **ENG/VIE.** New coach, side-intro, toast and result-facing copy ships as
   ENG/VIE pairs. Weapon display names are canonical proper names shared by
   both languages. Existing localization and skill-details parity gates pass.
9. **SFX/game feel.** No new audio files were added. `uiSfxAuthority` keeps
   the licensed 18-key bank and adds frozen semantic aliases with bounded
   gain/rate/throttle over the same cached elements for tutorial pause/resume,
   achievement states/rarities, mission claim, skin unlock/equip, Result
   win/loss and locked/error feedback. Mission claim, skin equip, skin unlock
   celebration and Gold Result call sites use those aliases.
10. **Hero-specific BOT AI (decision-only).** The scheduler now allows at most
    one successful AI cast per tick and shortens only excess MIRROR think
    delay; MIRROR canonical startup is untouched. MAGNET A2 requires
    observable denial geometry instead of pushing a needed floor weapon
    toward the rival. HUNTER values only revealed non-T6 pickups actually
    inside its intercept corridor. CRYSTALA wall casts require a hostile
    projectile to cross the actual planned wall segment after lock and before
    expiry/body hit. BOXE rocket requires a relative-motion intercept and its
    counter requires a real incoming projectile/closing threat in the guard
    window. SHURI predicts armed-bomb crossing/steal value and spends machine
    actions only for affordable setup or meaningful reserve-aware repair.
    No stats, cooldowns, damage, resources, collision, free weapons, invalid
    casts or unobservable information were introduced.

## Verification performed

Deterministic/local gates that passed after the final revision bump:

- `pnpm test:cp4-combat-intelligence` — CP4 weapon authority, wall streak
  contracts, nested Result seams, tutorial lease seams, SFX alias behavior,
  BOXE/SHURI/HUNTER/MAGNET decision fixtures, scheduler/Crystal/rarity and
  toast-placement contracts.
- `pnpm test:cp3-mastery` — provisional-until-seal law, side-owner
  presentation, BOT non-folding and LOCAL P2 sealed ownership.
- `pnpm test:result-gold`, Result Gold Chrome gate, and a local nested
  `/html/apex/` Result probe — hero and weapon images decode under the nested
  base with no placeholder tags and no HTTP failures.
- `tools/testUiSfxWiringGate.mjs` — 110/110 checks.
- `tools/testArsenalBattleHeadless.mjs` — 384/384.
- MAGNET world-role, SHURI native, BOXE native, localization, skill-details
  parity (93 checks), product graph, battle-outcome-side (10), owner economy
  (55), runtime revision, Gold revision integrity (18), Gold generator
  `--check`, source hygiene and production build.
- Natural production-build browser probe at 1440×900: fresh BOT match sealed;
  side intro labels appeared; J and K lessons both paused with zero fighter
  movement and zero arsenal-clock advance during 1.3 s freeze checks, then
  resumed from the real keys; BOT/human provisional toasts were side-owned;
  the sealed Result frame decoded both hero portraits and the weapon image.
- Touch probe at 390×844: the Skill 1 lesson paused with zero movement/clock
  advance and resumed from touchscreen hold/release on the real P1 skill card.
- Viewport probe at 1440×900, 360×560, 390×844 and 844×390: Home wallet,
  Mastery Vault (42 cards; all four rarity shapes present), SPAS-12 Result
  and BOT battle starts rendered without page errors or first-party 404s.

## Honest limits / owner-review items

- The durable Cloudflare branch preview was not re-proven in this CP4 turn;
  local production preview evidence must not be represented as a deployed
  owner preview. PR CI and any branch-preview URL still need exact-HEAD
  follow-through after push.
- Wall feedback has after-change browser screenshots and source-level
  no-filled-disc contracts. A true before/after video pair was not produced
  in this turn.
- BOT AI proof is decision-fixture, headless-regression and natural NEWBOT
  browser evidence. It is not a same-seed win-rate benchmark and must not be
  read as a balance claim.
- SFX proof is authority/wiring/throttle behavior. No separate recorded
  loudness audition was produced; owner listening on real speakers/headphones
  remains the acceptance step for balance.
- Natural Result evidence used default skins. The VUA HÈ registered preview
  (`/assets/skins/rocket-vua-he/launcher.png`) is carried by the sealed
  snapshot path and renderer fallback chain, but an entitled natural VUA HÈ
  spotlight match was not used as CP4 evidence.
- Headless-browser FPS samples are SwiftShader smoke numbers only, not a GPU
  performance comparison.

## Files of record

- Design/audit: `docs/cp4/CP4_PHASE_A_AUDIT.md`
- Focused gate: `tools/testCp4CombatIntelligenceGate.mjs`
- Focused CI: `.github/workflows/cp4-combat-intelligence-gates.yml`
- Package script: `pnpm test:cp4-combat-intelligence`
