# APEX CHAOS Gold UI — Anti-Drift Contract

This source pack is the visual/interaction authority for the current Gold surfaces. Implementation may adapt plumbing to production runtime, but may **not reinterpret** the Gold design.

## Preserve exactly in meaning and perceived behavior

- Composition, spacing hierarchy, silhouette, framing and z-order.
- Motion choreography, durations, easing relationships, recoil direction, overshoot, settle, shake and impact hierarchy.
- FX layering and trigger meaning: flash, fracture/crack, side recoil, KO emphasis, skill state, hit/crit/heal distinction, transition seals/rails/handoff.
- Responsive layout families and the reason each element moves/reflows.
- P1/P2 color ownership as a semantic system across rails, accents, glows, skill state and impact feedback. Side colors must be data-driven; never hard-code a design that only works for the demo fighters.
- Interaction affordance and attention order: what looks selectable, locked, ready, dangerous, damaged, victorious, or unavailable.
- Reduced-motion behavior where authored.

## The only replaceable art slots

1. Lucky Draw fighter visual art.
2. Fighter Pick cover/card art.
3. Fighter Pick pose/stage art (Mirror may remain runtime-derived from the opponent identity).
4. Battle fighter avatar/portrait and passive/A1/A2 skill icons.

Replacing art means replacing the **content of the slot only**. Do not alter its frame, crop/focus contract, mask, geometry, effect envelope, responsive behavior, state machine, or motion timing.

## Integration law

Production state truth comes from the game/runtime. Gold owns presentation. Never move combat calculations, cooldown rules, HP math, ownership, or hero mechanics into the Gold renderer.


## Prototype harness boundary

The Battle HUD donor is both a visual authority and a self-contained playtest harness. Those roles must be separated in production.

Keep the Gold presentation functions/phase relationships. Replace demo trigger sources with real production semantic sources.

Never ship donor simulator truth such as fake HP, fake cooldowns, fake weapon swapping, fake BOT logic, fake timer/round progression, or H/C/D/F effect-test keys.

Owner trigger corrections that intentionally supersede stale donor semantics:
- Heavy = more than 200 realized damage to the same victim inside a rolling 1.20s window, one Heavy response per qualifying burst.
- Confirmed Stormbreaker damaging hit = Heavy family + separate Thunder/Lightning family.
- Critical response color follows the **attacker/source identity accent** across number, mark, stamp, sweep, chroma/edge/rail response; the donor's fixed orange critical color is stale demo semantics.
- P1 controls: J=A1, K=A2.
- Local 2P P2 controls: 1=A1, 2=A2.
- BOT mode exposes only P1 controls; P2 is real CPU/threat readout.
- Mobile human skill cards are real touch targets routed through the same production input adapter as keyboard controls.

## Responsive production law

Gold responsiveness is re-composition, not uniform scale-down.

Preserve the three authored families:
- `desk`: P1 | square arena | P2 with top versus rail.
- `land`: mobile landscape re-composition; in 1P, P1 gets the usable thumb territory and P2 collapses toward threat/status readout.
- `port`: vertical P2 territory / match rail / square arena / P1 territory.

Local 2P portrait:
- rotate the P2 **control territory** 180 degrees toward the opposite player;
- do NOT rotate arena, timer, neutral match information, or global effects.

Shipping production must size against the real viewport and safe-area insets. The donor preview preset scaler is diagnostic tooling only.
Active touch targets must remain at least 44px where the Gold interaction is actionable.


## 2026-10-05 exact visible-parity / ownership relock

The implementation target is the canonical Gold's visible presentation at normal product scale.

Approved differences are limited to:
1. the four declared placeholder slot contents;
2. real production trigger/state plumbing replacing donor simulator truth;
3. owner-approved data-driven semantic color ownership;
4. necessary runtime/responsive plumbing that preserves the same authored visible result.

All other visible drift is a release failure.

Every Gold surface must have one visible presentation owner. Legacy Home/Pick/Battle/Result presentation may remain only as hidden/internal state plumbing where required; it must not remain visibly stacked above, below, behind or beside Gold.

Canonical parity must compare production directly against the canonical Gold source at matched viewport/state. A production module compared only against itself is not parity. A function call/counter/class name is not visual evidence.

See:
`docs/gold-ui/preload/PROCESS_GOLD_PARITY_RELOCK_2026-10-05.md`
for the Robot -> Mirror process lessons, real-path evidence law, event/listener lifecycle law, rejected-cutover negative evidence and acceptance ladder.
