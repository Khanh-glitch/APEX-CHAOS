# Quest 01 — Q4A native REFLEX full soak / owner acceptance
Date: 2026-10-09
Branch: `quest/q4a-reflex-native-receipts-from-q3v`
Verified runtime HEAD: `73d2460e803d774665ee08bc28da76be78d4b4b9`
CI: https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37871382100 — **SUCCESS**
Screen artifact on that run: `quest-q2-real-n-actors-and-browser` (Chrome desktop/mobile, 3v4 tablet).

## Truthful acceptance boundary
**This is an OWNER-PLAYTEST-READY REFLEX PILOT, NOT E01/Quest 01 completion.** No approved Story checkpoint advancement exists. Reaches `AWAIT_RIVET`, where the real RIVET Stormbreaker suppression, cinematic safe-settle/blackout and WORKSHOP narrative remain unimplemented. This is deliberate; no invented dialogue, imported art or fabricated successful Story mission.

## Proven
- The same live Gold-hosted Arsenal is entered through Home → Continue Story → `PLAYTEST REFLEX · Q4A`. Actual physical Chrome click and touch checks PASS, Gold renders true 1v1 NEWBOT vs T.O.T (1000 HP each) and uses exact HP projection. Exit clears the Quest receipt listeners and preserves persisted `WAKE`.
- **12/12 organic matches**: real spawned TELEGRAPH → REVEALED → physical PISTOL pickup (NEWBOT then T.O.T), actual Arsenal PISTOL damage receipts in opposite directions, no manual equips, scripted bullets or forged HP.
- **12/12 organic J and K casts**: actual HeroRework ability executor accepts J after R2 then K after successful J. The early J/K attempts are rejected with `quest-stage-locked` by the REAL executor, not by HUD only; no early cooldown loss. Gold native desktop/mobile skill tiles display `LOCKED` and disable interaction prior to skill unlock.
- **8/8 full organic simulations**: BOTH living real Fighter HP cross <=500 after accepted R1/R2/J/K, keep >=250 weapon damage floor, cap <=5, no early KO or Story completion, stop at `AWAIT_RIVET`. Post-J/K intervals: 70.30, 104.15, 114.15, 78.85, 89.40, 96.75, 110.35, 88.85 seconds. **No ordinary Stormbreaker appeared in any of these**, since REFLEX's reveal pool is deliberately restricted to PISTOL.
- The previous genuine soft-lock in R2 came from Arsenal's automatic shield counter converting T.O.T's authored PISTOL into SWIRL_SHIELD. Fixed only for Quest E01; BOT, Local and other Quest pickups still use original counter rules.
- The previous genuine soft-lock after J/K came from random general drops not arming the Fighter who needed to damage the remaining >500 HP opponent. Fixed only in E01: stage-relevant physically collectible PISTOL drops on the original 4.5s timer. No teleport/equip injection. A previous red run documented the 240s stall; regression keeps the same upper limit.
- Gold true HP DOM 0/1000 bug was reproduced with a RED Chrome gate, fixed in both standalone Gold and byte-synced embedded Shell; actual rendered digits and fill scale now checked against real HP in mounted Gold.
- Production regression and 3v4 Quest browser/mobile/headless acceptance on the final runtime SHA all PASS.

## Actual owner-visible limitations
1. **E01 is not complete**. RIVET must appear only at rescue and trigger ONE authentic Arsenal Stormbreaker suppression with safe settle; design of exact visual entrance + original RIVET art and remaining story text is not yet owner-authorized. Do not fake it by putting a weapon in NEWBOT's hand or creating synthetic bolt/damage.
2. Owner has assessed 3v4 TABLET Gold visual layout as broken/unattractive despite geometry gates. Latest screenshot still shows extreme panel imbalance/empty boxes, and V12 silhouette partly clipped against canvas boundaries. Another live branch owns global responsive layout: **DO NOT re-layout the Gold grid, panels, arena or breakpoints in this branch**. Quest-only card/readability changes were made without such a rewrite.
3. RIVET remains a brown silhouette placeholder. No invented T.O.T/RIVET abilities or artwork. Quest Gold 1v1 T.O.T currently uses approved white/gold operator placeholder.
4. J/K mobile visual is readable, but physical feel of unlocked controls and cinematic camera/motion has not been owner-approved; CLI Chrome geometry is not artistic certification.
5. Although the sample 8/8 passes, this is finite stochastic coverage, not mathematical proof against every random seed or every game session.
6. No public Quest completion, WAKE-to-REFLEX-to-WORKSHOP save flow, E02 integrated victory/retry, E03–E08, or production Cloudflare deployment. Never label these PASS.

## Precisely what the owner needs to do next
1. Playtest this **Quest branch** preview (not the production `apex-chaos.pages.dev` page); open Home → Continue Story → `PLAYTEST REFLEX · Q4A`. Judge J/K discoverability and unlock, R1/R2 pace, the 70–114s post-J/K progression, T.O.T art at arena perimeter and label/readability on tablet and compact phone. If no preview for this branch exists, a branch preview or local Vite session must first be launched; do not fabricate a URL.
2. Approve the **RIVET rescue beat** and provide or approve a RIVET visual identity reference/placeholder, because only the canonical Story authority may decide his visible entrance/rig, Stormbreaker staged suppression, safe blackout and exact WORKSHOP speech. This is the next real owner decision, not a new internal CI gate.

Handoff note: this file supersedes the earlier `Q4A_REFLEX_NATIVE_GOLD_OWNER_PLAYTEST_2026-10-09.md` as status; old evidence remains immutable. This document-only HEAD changes no runtime behavior. Production and layout branches were not merged/deployed.
