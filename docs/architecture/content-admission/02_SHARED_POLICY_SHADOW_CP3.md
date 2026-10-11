# CP3 — Shadow-only interaction policy; production revision lock preserved

**Depends on:** CP2 PR #31. **Scope:** candidate with real-gameplay parity verification; NOT a deployed combat policy.

## Important safety correction

The project locks the contents of `public/game/hero-rework/ailRuntime.js` with a SHA-256 runtime revision gate under `20261010-v43-post-update-02`. Changing it without a revision cutover fails product CI and risks browser cache skew. The final CP3 restores that production file **byte-for-byte to CP2**. It does NOT disable, override or update the runtime lock.

## What is implemented

- `tools/lib/interactionPolicyCandidate.mjs` contains a **test-only** candidate. It is not referenced in `runtimeManifest.js` or any production import.
- `tools/testInteractionPolicyShadow.mjs` boots the REAL shipped runtime, then installs the candidate query method only onto the headless test's existing `AIL.CapabilityAuthority` object.
- Queries distinguish Magnet projectile vs floor gun, Frost freezable ranged holder, Mirror F2 existing projectile families, V43 reflection TAG (not collision permission) and AIL T6. All return immutable allowed/denied/unresolved results.
- Unknown/new content is unresolved, not implicitly enabled.
- Real Magnet/Frost predicates are shadow-compared over 41 existing equipment IDs, 8 V43 specials, hold/life/phase permutations; Mirror F2 and T6 boundaries are also checked. The original candidate passed **1,066/1,066** scenarios. The moved test-only candidate must pass the same suite again before this branch can be promoted.

## What is NOT implemented

No production hero or weapon consumer reads this candidate. No existing projectile loop, TOI, damage, ownership, Quest release pool or Core Six availability has changed. This is a readiness proof, not a release-ready unified resolver.

## Prerequisites for a production cutover

1. Approved new runtime revision: change `APEX_ARSENAL_RUNTIME_REVISION` and its authorized expected value, and generate a new `runtimeRevision.lock.json` after tests are final. **Never silently relock changed scripts under the old URL revision.**
2. Migrate exactly one consumer per checkpoint, running real collision/TOI/ownership/damage/rematch/browser gates against the old implementation.
3. Obtain decisions for Mirror F2 interactions with V43; Magnet BOT response to V43; Magnet floor treatment of specials; and any altered contact priority.

**This branch deliberately does not touch the locked runtime revision or main.**
