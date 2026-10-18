# Skill HUD Truth — READY vs Cooldown (r9) — Checkpoint Notes

**Owner checkpoint (separate from Fighter Select):** the Battle HUD could show
READY while gameplay rejected the cast on cooldown. Reproduce, root-cause
across skill authority / projection / renderer, check charge skills and the
active window, fix minimally.

## Reproduction (live, before fix)

ROBOT A2 *VIRTUAL ARMOR* (cooldown 10s, duration 3s), real KeyK cast in the
hosted Gold battle:

- during the window: tile `ACTIVE 1.7s`, authority `cooldownLeft = 9.64` ✓
- **after the window: tile `ready` / "READY" while `cooldownLeft = 9.37`** ✗
- recast in that state: rejected.

## Root cause — one fabricated field in the projection

Three layers, three different answers to "is it castable?":

1. **Authority** (`heroReworkRuntime.abilityController.tryCast`) gates plain
   skills on `cdLeft > 0`, charge skills on `charges <= 0`. Correct, and
   `cooldownLeft()` reports the same truth.
2. **Projection** (`goldProductBridge.skillTruthFor`) computed `nextIn`
   correctly from `cooldownLeft()`, but derived `charges` as
   `finite(s.charges) ? s.charges : maxCharges`. Plain cooldown skills own
   **no charge pool** — the runtime leaves `s.charges` undefined — so the
   projection reported a **permanent fabricated charge (1)**. The Quest
   companion projection hardcoded the same lie (`charges: 1`).
3. **Renderer** (Gold battle HUD) state law is
   `locked → cast → active → charges>0 ? 'ready' : 'cd'`. With charges pinned
   at 1, every plain-cooldown skill (all but HUNTER A1) rendered READY for
   its entire cooldown; `nextIn` only moved the meter.

So the bug was never the renderer or the authority — the projection broke
its own contract ("the Gold cards project THAT truth") for exactly one
field, in both projections feeding these tiles.

## Fix (minimal, at the projection layer — no renderer/Gold change)

- `goldProductBridge.skillTruthFor`: for single-charge skills
  (`maxCharges <= 1`), `charges = nextIn > 0 ? 0 : 1` — the truthful charge
  count for a cdLeft skill *is* castability, the same value the authority
  gates on. BOXE A1's recall design (`cdLeft = 0` after cast) still reads
  READY, correctly: the recast is available.
- `questCompanionNativeRuntime.skillProjection`: `charges: s.cd > 0 ? 0 : 1`
  (phase labels unchanged; CAPTURE/STORED run at `cd = 0` and stay READY).

Charge skills keep their real pool count; duration skills keep the ACTIVE
window (renderer-side from Cast + authored duration) and now fall into
COOLDOWN after it instead of READY.

Out of scope by design: mechanic `canCast` *condition* rejects (e.g. ROBOT
A1 needs a weapon, HUNTER snares cannot stack, BOXE rocket already
returning) can still occur at tile-READY — those are prerequisites, not
cooldown, and already emit `CastFailCue` feedback. The HUD now never lies
about the cooldown itself.

## Acceptance — `tools/testSkillHudTruthBrowser.mjs` (13/13 PASS, hosted)

- A · ROBOT A2 (duration): real KeyK cast → ACTIVE → **COOLDOWN 9.4s**
  post-window; `tryCast` rejects `cooldown`; READY returns exactly at
  expiry; recast succeeds.
- B · ROBOT A1 (plain CD, authority-armed via its own `setCooldown`):
  COOLDOWN at 5.9s ↔ READY at 0.
- C · HUNTER A1 (3 charges): `READY · 3/3` → cast → `READY · 2/3 · 6.3s`
  (charge in hand stays READY) → 0 charges → `COOLDOWN`, reject
  `cooldown` → recharge → `READY · 1/3`.

Screenshots: `A-robot-A2-cooldown.png`, `C-hunter-charges-2of3.png`.

Battery: cutover `--check` OK (71 files), revision integrity PASS 18,
Battle HUD adaptation PASS 57, LiveTruth PASS 20, Quest HUD family browser
PASS (27 samples), hero-rework smoke 18/18, Fighter Select pager gate
re-run PASS 29/29. Runtime revision r8→r9, 66 versioned runtimes relocked.
R91 and the Gold donor renderer are untouched. No merge, no deploy.
