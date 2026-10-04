# APEX CHAOS — Gold Source Pack

This ZIP is the decomposed form of `APEX_CHAOS_FULL_LUCKY_DRAW_RESTORED(1).html`. It is intentionally structured for both human and AI implementation review without forcing the reader to inspect ~27 MB of embedded base64.

## Entry

Open `index.html`. The DOM/CSS/JS ordering from the Gold standalone is preserved. Runtime behavior is not re-authored.

## Structure

- `index.html` — Gold shell; same ordering/behavior, large binary URLs replaced with local files.
- `assets/gold/` — non-placeholder Gold binaries extracted byte-for-byte. Keep them.
- `assets/placeholders/` — lightweight replacement slots only for art the owner explicitly said is temporary.
- `donors/lucky-draw/index.html` — Lucky Draw donor with only fighter visual art replaced by tiny placeholders; motion/FX/layout code preserved.
- `donors/battle-hud/index.html` — exact decoded Battle HUD donor for readable audit. `index.html` intentionally keeps its embedded payload too so loading/transition timing does not drift.
- `manifests/` — SHA provenance, placeholder law and anti-drift contract.

## Important

Do **not** treat this pack as permission to redesign or simplify the Gold. The decomposed format changes storage, not authority.

Quest and Shop are not Gold-ready surfaces in this pack. In production they should remain lightly locked/disabled extension points rather than being deleted or hard-coded away.


## Integrity verification

- Gold payload tree SHA-256: `e182924831879bbe041c3505161a43a7861e5586575a3f4bb966512d6392fb31`.
- The final ZIP SHA-256 is stored outside the archive in `APEX_CHAOS_GOLD_SOURCE_PACK.zip.sha256`; it is intentionally not embedded in the ZIP because that would create a self-referential hash.
- `manifests/package-files.json` lists SHA-256 for every package file except itself.
- `manifests/original-source.sha256` anchors the owner-provided standalone and decoded donor sources.

## 2026-10-04 production-trigger / responsive authority correction

The decoded Battle HUD donor contains an embedded **LAB / demo combat simulator** so the Gold choreography can be exercised in isolation. That simulator is reference harness only.

Gold remains authoritative for:
- composition and responsive layout families;
- visual hierarchy;
- Normal / Critical / Heavy / Thunder / Heal choreography;
- skill ready/cast/cooldown choreography;
- weapon/loadout response;
- low-HP/tension response;
- KO/result/fracture motion;
- timing/easing/overshoot/settle and reduced-motion behavior.

The following donor mechanics are **NOT** production authority and must not ship as gameplay truth:
- the donor `S` / `G` fake match state;
- `applyDamage()`, `heal()`, `cast()`, `swapWeapon()`, fake reload/timer/round/BOT simulation;
- LAB/diagnostic/preview controls;
- demo H/C/D/F/W/E/R/T/P/L/V bindings;
- donor M=1P/2P;
- donor P2 U/I skill keys;
- fake best-of-three / reset choreography when production has no corresponding match authority.

Production must preserve the Gold response while sourcing its trigger from real runtime state/events. The current owner semantic corrections live in the preload/relock authority, especially `docs/gold-ui/preload/BATTLE_TRIGGER_RESPONSIVE_RELOCK_2026-10-04.md` and `docs/gold-ui/preload/PROCESS_GOLD_PARITY_RELOCK_2026-10-05.md`. `manifests/ACTIVE_IMPLEMENTATION_PROMPT.md` is an execution trigger, not the primary instruction store.

Responsive is also behavioral authority: production must re-compose into the Gold `desk`, `land`, and `port` families from the real viewport. The donor's fixed-size preset + whole-stage scale transform is preview tooling only and must not become the shipping responsive strategy.


## 2026-10-05 process / Gold-parity relock

Before implementation, read:
`docs/gold-ui/preload/PROCESS_GOLD_PARITY_RELOCK_2026-10-05.md`.

This relock incorporates Robot -> Mirror failure lessons and the rejected `a1427d...` cutover as negative evidence.

Key release law:
- Gold must become the visible presentation owner, not an underlay/decoration around legacy UI;
- canonical Gold must be compared directly against production at matched real viewports/states;
- only approved trigger plumbing, placeholder contents, semantic color adaptation and necessary runtime/responsive plumbing may differ;
- green tests/builds cannot substitute for canonical visual parity, real-browser proof or owner acceptance.
