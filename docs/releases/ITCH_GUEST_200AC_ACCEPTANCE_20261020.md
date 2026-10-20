# APEX CHAOS — itch.io Guest-first / 200 AC owner acceptance
**Candidate date:** 2026-10-20
**Preview:** https://itch-guest-200ac-rc-20261020.apex-chaos.pages.dev/
**Branch:** `release/itch-guest-200ac-20261020` — based exclusively on reviewed `main` `c7a04f0b57f08093a783fa6080b536b9754c83a8`.
**DO NOT MERGE OR PUBLISH until owner approves.** PR #98 (Cloud Auth staging) remains a separate draft.

## Intended public rules

- No account requirement: always start in **Guest**. Account Center shows local identity, owned roster, display name and on-device save warning. No Google, OTP, password, Supabase login, registration or deletion entrypoints.
- New browser/profile: 350 AC + NEWBOT only. Existing on-device save (including previously spent AC / previously unlocked heroes) must never be reset or refilled.
- **Free Battle BOT: P1 win +200 AC**, loss +25 AC. **LOCAL completed match +50 AC**, regardless of which player wins. Lab/Admin Test/Quest/incomplete/invalid = **0 AC**.
- Sealed match ID + in-memory match completion make all real battle rewards idempotent, including reload/retry. No cloud-authoritative wallet, no server reward calls.
- Fighter Shop: 1000 AC; Lucky Draw: 350 AC. The draw pool and fighter entitlement checks remain untouched. AC and ownership share the original `apexChaos.arsenalMeta.v1` storage key.
- UI assets, skill icons, hero art and battle effects are otherwise unchanged from the pinned main candidate.

## Independent automated checkpoint

- `tools/testItchGuestReleaseGate.mjs`: release flag, no Cloud Auth startup, no accidental Supabase env override, Guest UI, local save law, 200 BOT win / 25 loss / 50 LOCAL and retained economics.
- `tools/testOwnerPlaytestEconomyGate.mjs`: executes **real** wallet runtime against storage shim; checks fresh 350, existing AC saved, actual 200 win, +25 loss/+50 LOCAL, no Lab/Admin rewards, duplicate sealed result blocked after reload.
- `tools/testArsenalProductGraph.mjs`: one wallet, Shop, Draw, real winnerSide/mode, no locked hero fabrication.
- Battle outcome, runtime checksum revision lock, Cloud/Admin fail-closed contracts, shipping-dist audit, production Vite build.
- GitHub CI packages a ZIP with index at ZIP root, plus a separate resource-path translation for itch's nested `/html/<id>/` host path. Cloudflare preview dist is unchanged. Verify the ZIP inside itch.io's actual HTML5 iframe after owner acceptance, because Cloudflare and itch are different hosts.
- Isolated Pages branch: `itch-guest-200ac-rc-20261020` only. Check immutable `ITCH_GUEST_BUILD_SHA.txt`; the production alias `apex-chaos.pages.dev` must not change.

## Owner manual acceptance — perform with a fresh Guest save or a nonessential browser profile

- [ ] **HOME:** Starts with no sign-in, no broken Google/Email entrypoints, navigation visible, assets/audio intact.
- [ ] **Guest Account Center:** 350 AC + NEWBOT only on fresh profile; can change display name; shows *on this device* storage warning. No button or URL to sign in.
- [ ] **BOT win:** Play through a genuine Free Battle BOT match (do not fake a win). Win displays +200 AC and adds exactly 200 to Account Center balance.
- [ ] **BOT loss:** +25 AC (provisional). Re-opening or revisiting the result does not grant more.
- [ ] **LOCAL:** An actually completed 1v1 gives +50 total to the local profile, even if P2 wins.
- [ ] **Shop:** 1000 AC required. A purchased fighter stays owned and selectable after reload.
- [ ] **Lucky Draw:** Costs 350 AC once; no duplicate costs; only canonical unowned fighters.
- [ ] **Refresh / re-enter:** Previous balance, fighters, selected hero and match claim history remain.
- [ ] **No accidental bypass:** Lab/Admin/invalid/abandoned game never pays AC.
- [ ] **Gameplay:** Fighter select, BOT movement/combat, skill HUD responsiveness, victory result and back-to-home work on desktop and phone dimensions.
- [ ] **itch.io HTML5 package:** On the actual itch HTML5 draft page, embed loads CSS/images/audio/scripts under itch nested path with **no missing asset**; Home→Battle→Result→Home and local persistence survive refresh. Test keyboard + touch. Do NOT make page public before this step.

## Current scope limitations / nonblockers for Guest-only RC

- Cloud accounts, cross-device sync, Google OAuth, email provider, verified rewards and server-side account deletion **deferred**. No production Auth user or Supabase staging data was changed by this branch.
- Browser localStorage can be lost if the player clears site data or changes devices/browsers. Guest progress is not recoverable on another device.
- Online PvP, cloud-backed economy and story mode are **not promised** by this itch Guest-first preview. This candidate provides existing Free Battle and product meta surfaces only.
- Preview's automated browser award exercise invokes the real runtime with a synthetic sealed BOT win and verifies exactly +200 + one-time claim + reload persistence. That is a deterministic smoke test, **not** a claim that a human has completed a real battle.
- Prior A1 account testing on PR #98 stays in Draft, not silently merged. It does not prevent shipping the separately audited guest-only candidate.

## Release decision

**READY FOR OWNER VISUAL/GAMEPLAY ACCEPTANCE** only after isolated CI + immutable live preview. **NOT READY FOR PUBLIC ITCH PUBLISH** until the owner also accepts a real BOT match and a real itch HTML5 iframe load with no missing assets. No merges, no production deployments, and no publishing are performed by this workflow.
