# Gold Mission / Account cutover — 2026-10-26

Base: `6f7003956702f5094497cfd0dd2b12118272cd38` (`arena/99851aa2-apex-chaos`).

Owner prototype: `apex-chaos-ui-prototype (7).zip`, treated as **visual reference only**.

## System contracts preserved

- `APEX_ARSENAL_META` is the **one wallet**. Never import prototype `store.ts`, seed 1,850 AC, simulate missions, or alter battle payouts.
- `APEX_PLAYER_ACCOUNT` remains the identity authority; local guest storage, cloud session projection and admin authorization remain distinct.
- Real mission catalog and one-time AC claims continue via `progressionCatalog` and `claimProgressReward`; progression counters derive from sealed results only.
- Mastery, entitlement and equip continue via `getMastery`, `heroMasteryProgress`, `skinProgress` and cosmeticAuthority. Nothing can unlock or pay AC merely by opening the UI.
- Product navigation still uses `APEX_ACCOUNT_CENTER` / `APEX_PROGRESSION_CENTER`; bottom-nav IDs and existing open events remain unchanged.
- Archive/launcher surfaces and fighting HUD are untouched. Guest-only release still hides Google/OTP functionality and preserves device-local save warnings.

## Art direction

- Gold's beveled hexagonal AC coin ported from `src/ui.tsx` in owner ZIP as `GoldCoin`, now shared between Account, Mission and current wallet.
- Gold's cinematic amber-on-ember palette, angular panels, oversized typography, hex objective nodes, glowing progress tracks, large pilot license and owned-hero portrait strip adapted to game.
- Portraits are resolved from **shipped game art** under `/gold/assets/placeholders/pick/cover/` for the existing playable roster, not from imaginary prototype fighters.
- Site background uses the already-shipped `/gold/assets/gold/home-world-background.png` instead of introducing another gameplay asset.
- All styles are scoped to `.agm-*` / specific parent panels; Combat HUD is not restyled.

## Known limitations / acceptance boundary

- No local repository checkout or project dependency install was available in this execution container (the live GitHub repository is accessed through the connector). Therefore **Vite build, real Chromium acceptance, and source QA tests have NOT been executed**. Do not label READY or merge until tested.
- This change is a substantive Gold presentation integration, but Mastery reuses much of its current layout with a Gold reskin instead of duplicating the standalone prototype's independent fake achievement schema. The full standalone prototype is not an alternative runtime in the game.
- Owner visual acceptance is still required at desktop 1440x900, tablet 1024x768, phone portrait 390x844 and landscape 844x390.
- Verify initial Account entry, back/Escape/focus, guest rename and persistence, real owned roster, zero/positive balance, one-time claim and claim-all, saved-progress reload, mastery progress, ECOBOT/VUA HỀ entitlement boundaries, touch targets and no clipping; test zero data and multiple claimed contracts.
- Verify staging artifact and existing issue105/progression browser gates before deployment.
