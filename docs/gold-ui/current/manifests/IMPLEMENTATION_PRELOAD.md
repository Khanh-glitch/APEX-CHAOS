# APEX CHAOS — GOLD UI LARGE IMPLEMENTATION PRELOAD

## Baseline
- Repository: `Khanh-glitch/APEX-CHAOS`
- Branch: `arena/01a1025a-apex-chaos`
- Baseline HEAD before Gold integration: `5dc8c8c80f3804a5c363e4af0ab34c726e86e73b`
- Runtime revision: `20261003-mirror-v1-r42`
- r42 already consolidates current combat HUD state/projection authority. Do not move gameplay truth back into presentation DOM.

## Gold source authority
The owner-provided source was `APEX_CHAOS_FULL_LUCKY_DRAW_RESTORED(1).html`.
Original SHA-256: `4ffdfcdd64cb908b39d55a1eb210d340b27a111e6bf328774b36e4a1d96a57cd`.

Gold payload tree SHA-256: `e182924831879bbe041c3505161a43a7861e5586575a3f4bb966512d6392fb31`.
The ZIP file hash is intentionally kept in an external `.zip.sha256` sidecar to avoid self-reference. The pack is a storage/readability transformation, not a redesign authority.

Read first:
1. `README_GOLD_AUTHORITY.md`
2. `manifests/ANTI_DRIFT_CONTRACT.md`
3. `manifests/placeholder-contract.json`
4. `manifests/asset-manifest.json`
5. `manifests/dependency-audit.json`
6. `docs/gold-ui/preload/PROCESS_GOLD_PARITY_RELOCK_2026-10-05.md`
7. `index.html`
8. `donors/lucky-draw/index.html`
9. `donors/battle-hud/index.html`

## Owner law: only these art slots are replaceable
1. Lucky Draw fighter visual art.
2. Fighter Pick cover/card art.
3. Fighter Pick pose/stage art. Mirror may keep runtime opponent-derived transparent identity instead of a fixed large pose.
4. Battle fighter avatar/portrait and passive/A1/A2 skill icons.

Everything else in Gold is retained authority unless proven dead/duplicate implementation data:
- Home shell and world art.
- Lucky Draw machine/shell/LED/rail/console/drawer/effects/motion.
- Fighter Pick composition, frames, sparks, lock behavior, P1/P2 state language, responsive behavior.
- Battle HUD body, rails, frame geometry, HP language, side-color ownership, hit/crit/heal visual language, fracture/crack, screen response, recoil, flash, thunder, KO/result/transition behavior.
- All authored timing/easing/overshoot/settle relationships.
- All authored responsive layout families and reduced-motion handling.

Replacing a placeholder means replacing only content inside the slot. Never change slot geometry, crop/focus rule, mask, frame, z-order, responsive behavior, motion envelope, timing or state meaning.

## Product surface scope for this implementation
OPEN / implement now:
- Home/navigation Gold shell where represented in the source.
- Lucky Draw / Gacha.
- Local/BOT fighter selection.
- Battle HUD and battle-entry transition.

TEMPORARILY LOCKED / extension point only:
- Quest.
- Shop.

Quest and Shop must remain visible enough to communicate future product scope, but disabled/dimmed/locked lightly. Do not delete routes, hard-code the app to only currently open surfaces, or create architecture that makes later unlock difficult.

## Runtime integration law
Gold owns presentation. Production owns truth.

Use r42 projection/state authority instead of duplicating mechanics:
- `APEX_COMBAT_HUD.projection()` for identity/vitals/energy/burst/loadout/mode/robot passive.
- `APEX_COMBAT_HUD.syncVitals()` as current vitals reconciliation seam.
- `APEX_ARSENAL.hudProjectionFor()` for mode and A1/A2 state text/data.
- `APEX_ARSENAL.resultProjection()` for result truth.
- Existing hero rework/runtime remains mechanic authority.

Do not calculate damage, crit, cooldown, ownership, HP, hero mechanics, weapon rules or match result inside Gold renderer.

## P1/P2 side-color authority
The Gold uses side color as semantic ownership, not decoration. Preserve the behavior across:
- HP/vitals rails.
- Side frames and accents.
- Skill readiness/cast/cooldown emphasis.
- Glows and impact response.
- Transition rails and lock plates.
- KO/winner emphasis where authored.

Implement side colors as data-driven tokens/variables. Do not hard-code a one-demo-fighter palette that cannot survive future roster expansion.

## Motion/effect anti-drift
Do not replace authored motion with generic fades/slides.
For every interaction, preserve:
- trigger,
- affected side(s),
- direction,
- phase order,
- duration,
- easing relation,
- overshoot/settle,
- z-order,
- intensity hierarchy,
- responsive variant,
- UX meaning.

Kill/KO, crack/fracture, hit, crit, heal, skill press/cast/cooldown, fighter lock, Lucky Draw sequence and battle-entry transition must be ported as choreography, not recreated approximately.

## Performance law
The owner previously observed that standalone Battle HUD was smooth while integrated kill/screen-crack interactions could hitch. During integration:
- never force arena canvas re-layout for side-HUD animation,
- prefer transform/opacity/clip-path and compositor-friendly layers,
- avoid recreating large DOM or decoding large images on every hit/kill,
- preload Gold assets before their authored transition needs them,
- keep expensive crack/KO layers persistent and toggle state rather than rebuild when possible,
- prove smoothness at kill + screen crack, not just idle.

## External dependency closure
`donors/lucky-draw/index.html` currently references Tailwind browser CDN and Google Fonts. This is source/reference behavior only. Production shipping must not require network access.
Materialize/compile equivalent styles/fonts locally, then compare computed/visual output against Gold before removing external dependencies. Do not change visual metrics while localizing them.

## Source-pack audit checkpoint
- Original standalone: 27,394,347 bytes.
- Source pack unzipped: 8,914,833 bytes.
- ZIP: 8,326,885 bytes.
- 58 files.
- Gold binary bytes retained byte-for-byte: 8,168,248.
- Main `index.html` contains 0 direct `data:image` payloads.
- 14 Fighter Pick placeholder outer assets stripped.
- 3 Lucky Draw fighter-art payloads stripped.
- Battle HUD decoded donor SHA-256 retained exact: `96766265665403fd00591eaaacfc97b7289e959cb47606b2df1dfc49b5bfc61d`.
- Static dependency audit: no missing local refs.
- Inline JS syntax audit: PASS.
- ZIP round-trip required authority files: PASS.
- Chromium smoke proof in this environment: NOT CLAIMED; local headless Chromium timed out before DOM dump, so real browser acceptance remains mandatory during repository implementation.

## Required implementation evidence
Before declaring complete:
1. Baseline branch/SHA recorded.
2. Gold source SHA and pack SHA recorded.
3. No gameplay mechanic drift.
4. Desktop + mobile responsive screenshots for Home/Pick/Battle/Lucky Draw.
5. P1/P2/BOT state proof.
6. Hit, crit, heal visual proof.
7. Skill A1/A2 ready/cooldown/cast proof.
8. Kill/KO + screen crack proof with frame/performance observation.
9. Battle-entry transition proof.
10. Lucky Draw idle/spin/result proof.
11. Quest/Shop locked-but-extensible proof.
12. Production build + shipping-dist gate.
13. Browser/headless acceptance.
14. Runtime revision bump/relock if production runtime sources change.

## Forbidden shortcuts
- Do not redraw/reinterpret Gold because implementation is easier.
- Do not replace Gold assets with existing repo assets merely because names look similar.
- Do not preserve temporary fighter art outside the four allowed placeholder categories.
- Do not flatten motion into one generic transition utility.
- Do not hard-lock roster architecture to six heroes.
- Do not revive legacy picker/HUD DOM seams removed by r41/r42.
- Do not remove Quest/Shop product slots; lock them lightly.
- Do not edit hero mechanics/balance while porting UI.


## 2026-10-04 — Core Six AV + Forward Drive additive preload

The Gold source-pack commit was followed by an additive AV/theme preload.

Required implementation starting checkpoint:
`50b185c184955d279de93874823859ccabb498c6`

Parent Gold-preload commit:
`b5defc0bc51e98d47dca4e4672fc82a75ef14673`

Runtime revision remains `20261003-mirror-v1-r42` at this additive checkpoint because the preload commit changes reference/assets/docs only, not runtime source.

Read additionally before implementation:
- `docs/gold-ui/preload/README_AV_THEME_PRELOAD.md`
- `docs/gold-ui/preload/AV_THEME_PRELOAD_MANIFEST.json`
- `docs/gold-ui/preload/APEX_CHAOS_CORE_SIX_AV_THEME_PRELOAD.zip`

Archive SHA-256:
`49d8d5bf448bce7ca6475388cdf640c338bc00250fbcb577dbc7962fcfd0180f`

Important scope correction:
- Core Six gameplay AV is now sourced/identified and must not be treated as generic TBD.
- This does NOT resolve the four Gold UI-art placeholder categories.
- Forward Drive supersedes the current menu-BGM behavior for product-theme policy. Reuse/adapt the existing `src/App.jsx` single-media-element seam rather than creating a second music engine.
- Current `src/game/productSurface.js` still exposes Fighter Shop as ACTIVE; this conflicts with the Gold cutover authority and must be corrected to a lightly locked extension point during implementation.
- Gold Battle HUD donor's demo `M = 1P/2P` hotkey conflicts with the new owner `M = music mute/unmute` law and must not survive production cutover.


## 2026-10-04 — Battle trigger + responsive relock

A second hostile audit of `donors/battle-hud/index.html` found a critical authority boundary:

The donor contains a complete fake combat simulator used only to exercise the HUD:
- fake state `S` / `G`;
- fake `applyDamage`, `heal`, `cast`, `swapWeapon`;
- synthetic reload, round/timer, KO reset, BOT casting and weapon cycling;
- LAB / diagnostics / preset-view controls;
- H/C/D/F/W/E/R/T/P/L/V and donor M mode hotkeys;
- donor P2 U/I keys.

Do not port those semantics into production.

Keep the authored visual responses and bind them to current production truth.

Owner-locked corrections after the donor was authored:
- Heavy: same victim receives >200 realized damage inside rolling 1.20s; one Heavy response per qualifying burst.
- Stormbreaker confirmed damaging hit: Heavy + separate Thunder/Lightning.
- Critical visual family: attacker/source identity accent, not fixed orange.
- P1: J=A1, K=A2.
- Local 2P P2: Digit1=A1, Digit2=A2.
- BOT: only P1 human controls; P2 remains real CPU.
- Mobile skill cards: real touch controls for human sides.
- M: music mute/unmute only.

Current production audit findings that the implementation must resolve:
- `public/game/hero-rework/heroReworkRuntime.js` currently implements P1 J/K and P2 cast AI, but no owner-approved Local 2P Digit1/Digit2 path.
- `public/game/modes/arsenalBattleRuntime.js` has a BOT/LOCAL profile read-model, but the current product path must be proven to set it from the real picker and to disable P2 AI in Local 2P.
- `Fighter.takeDamage` already exposes a post-mitigation realized-damage seam via `APEX_COMBAT_HUD.onRealizedDamage`.
- `Fighter.heal` currently has no equivalent semantic HUD observer; add only a thin post-heal observation seam if required, without changing heal math.
- weapon/skill/KO/result presentation must observe canonical ownership/controller/result state instead of donor simulation.

Responsive audit:
- donor families are `desk`, `land`, `port`;
- donor proof presets: 1366×768, 1920×1080, 844×390 with safe inset [0,44,16,44], and 390×844 with safe inset [47,0,34,0];
- donor fixed-size preview scaling is not a production responsive strategy;
- local portrait 2P rotates only P2 control territory 180°;
- 1P portrait keeps P2 as a compact threat strip and gives P1 the large touch zone.


## 2026-10-05 — Process / canonical Gold parity relock

The Robot -> Mirror history and the rejected `a1427d...` Gold attempt showed that the previous preload still allowed an agent to understand the written rules while implementing the wrong visible architecture.

The authoritative failure-prevention extension is:

`docs/gold-ui/preload/PROCESS_GOLD_PARITY_RELOCK_2026-10-05.md`

It adds hard requirements for:
- visible presentation ownership cutover (never legacy UI + Gold underlay);
- direct canonical Gold vs production parity at matched state/viewport;
- normal-scale screenshot/frame evidence for static + dynamic choreography;
- real-path/non-vacuous trigger proof;
- verified event provenance before SFX/VFX/HUD binding;
- idempotent listener/session/rematch lifecycle;
- Local/BOT protection;
- render-state/performance isolation;
- pnpm/package-lock discipline;
- exact-final-SHA acceptance ladder;
- explicit separation of automated, canonical, browser, performance and owner-acceptance gates.

`manifests/ACTIVE_IMPLEMENTATION_PROMPT.md` is intentionally only an activation/handoff prompt. The implementation law belongs in this preload, the anti-drift contract, the relock documents and canonical Gold sources.
