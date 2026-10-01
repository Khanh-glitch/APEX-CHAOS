# ARENA AGENT — START HERE: STORMBREAKER RED TIER

Repository: `Khanh-glitch/APEX-CHAOS`
Prepared branch: `arena/stormbreaker-red-tier`
Prepared from production: `playtest/arsenal@430ac5269031d5b72938df16427d16bb55743155`

## Required reading order

1. `docs/agent-authority/VIBECODE_SKILL.md`
2. `docs/agent-authority/APEX_CHAOS_ZERO_CONTEXT_HANDOFF_2026-09-26.md`
3. `docs/stormbreaker/v1-port/07_OWNER_INTEGRATION_OVERRIDE_2026-09-26.md`
4. Extract `docs/stormbreaker/v1-port/APEX_STORMBREAKER_V1_PORT_PACKAGE.zip`
5. Read EVERY file in the extracted package completely, starting with `00_READ_FIRST.md`.
6. Treat `02_APPROVED_EXECUTABLE_REFERENCE_V9_NO_LONG_TAIL.html` as the executable visual authority.
7. Then follow `05_ARENA_AGENT_IMPLEMENT_PROMPT.md`, subject to the latest owner override above.

## Package integrity

Expected ZIP:
- bytes: 1533561
- SHA256: `919fe4181bce4eb65183b57694182a22222fbf5aef27e9db5c00c4ebead747f5`

Verify before implementation:
```bash
sha256sum docs/stormbreaker/v1-port/APEX_STORMBREAKER_V1_PORT_PACKAGE.zip
rm -rf /tmp/apex-stormbreaker-v1
mkdir -p /tmp/apex-stormbreaker-v1
unzip -o docs/stormbreaker/v1-port/APEX_STORMBREAKER_V1_PORT_PACKAGE.zip -d /tmp/apex-stormbreaker-v1
```

## Scope

Implement Stormbreaker into the REAL APEX CHAOS game as the first red-tier weapon.

Highest owner priority is exact effect fidelity:
- preserve or improve the approved V9 effects;
- do not simplify/reinterpret the no-long-tail throw;
- use the exact approved asset and executable reference.

Gameplay/balance values are NOT frozen by the demo. Audit the current game and choose production-fitting damage, spawn probability, stun/slow values, timing, cooldown/consumption, and related balance values.

Before editing, fetch remote, verify branch/HEAD, audit current production architecture, and do not trust stale Arena workspace state.

Do not modify `playtest/arsenal` directly. Work only on this prepared branch and stop for owner playtest before production promotion.
