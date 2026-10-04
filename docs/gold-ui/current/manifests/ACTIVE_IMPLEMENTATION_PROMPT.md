APEX CHAOS — ACTIVATE GOLD PRODUCT CUTOVER

Repository: Khanh-glitch/APEX-CHAOS
Authority branch: arena/01a1025a-apex-chaos

Start from the CURRENT tip of the authority branch.

The accepted clean ancestry MUST include:
- 14cc89e44ee78832c11749b3729d002b68d88551
- AV preload checkpoint 50b185c184955d279de93874823859ccabb498c6

DO NOT use, merge, cherry-pick, or copy the rejected implementation:
a1427dcd19a2f9428b61bace57adab8b89eb56ac

Before production edits, read the Gold/preload authority completely, including:

1. docs/gold-ui/current/README_GOLD_AUTHORITY.md
2. docs/gold-ui/current/manifests/ANTI_DRIFT_CONTRACT.md
3. docs/gold-ui/current/manifests/IMPLEMENTATION_PRELOAD.md
4. docs/gold-ui/preload/PROCESS_GOLD_PARITY_RELOCK_2026-10-05.md
5. docs/gold-ui/preload/CANONICAL_CUTOVER_STRATEGY_RELOCK_2026-10-05.md
6. docs/gold-ui/preload/BATTLE_TRIGGER_RESPONSIVE_RELOCK_2026-10-04.md
7. docs/gold-ui/preload/README_AV_THEME_PRELOAD.md
8. docs/gold-ui/preload/AV_THEME_PRELOAD_MANIFEST.json
9. docs/gold-ui/current/index.html
10. docs/gold-ui/current/donors/lucky-draw/index.html
11. docs/gold-ui/current/donors/battle-hud/index.html
12. the Robot -> Mirror failure-prevention documents referenced by IMPLEMENTATION_PRELOAD / PROCESS_GOLD_PARITY_RELOCK

Then hostile-audit the LIVE production source and execute the real cutover one-shot.

Do not redesign.
Do not return a plan and stop.
Do not stop at a checkpoint.
Checkpoint means commit/push/remote-verify and continue.
Do not substitute generic UI/VFX for Gold.
Do not hand-reauthor Gold into a new React/component clone.
Prefer canonical-preserving mechanical extraction/mounting with direct parity proof.
Do not preserve legacy visible UI underneath/above/beside Gold.
Gold visual drift outside the explicitly authorized adaptation categories is a release failure.

Use production truth underneath the Gold presentation.
Preserve existing Local/BOT architecture; close only genuinely missing narrow seams.
Prove event provenance before wiring SFX/VFX/HUD triggers.
Keep listeners/sessions/rematch/re-entry idempotent.

Finish with exact final-SHA:
- canonical Gold parity evidence,
- real-browser visual proof at normal scale,
- functional/trigger proof through real paths,
- responsive proof,
- performance proof,
- protected regression gates,
- source/runtime/shipping/build gates,
- explicit remaining deviations if any.

Do not claim owner visual acceptance unless the owner has actually accepted it.

EXECUTE.
