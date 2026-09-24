# Arsenal Quest — Current Prototype Direction

**Authoritative handoff:** `docs/arsenal-quest/AGENT_HANDOFF.md`  
**Current correction override:** `docs/arsenal-quest/CORRECTION_PASS_HANDOFF.md`

This root note intentionally stays short. The previous standalone proof-of-concept is not the implementation target.

## Current core law

- Built **inside existing Apex Chaos**, not as a recreated engine.
- HERO vs RIVAL, both 100 HP, unarmed, no native skills.
- Both reuse Apex auto movement / bounce / collision.
- Spawn slots appear on a fixed cadence even if previous pickups remain.
- Slot location is visible first, but weapon identity is hidden.
- Each slot stays identity-hidden until an eligible fighter is predicted to touch it roughly 1.2–1.8s later; this is a proximity look-ahead rule, not a timer from spawn.
- Multiple pickups may coexist.
- First fighter to touch a revealed pickup equips it.
- Weapon is temporary/consumable; fighter returns to unarmed after use.
- P0 = 12 weapons only.
- No quests/progression/bosses/leveling yet.
- Real P0 weapon atlas and curated VFX/SFX assets are already committed under `public/assets/arsenal/`; placeholders are no longer acceptable as primary normal-gameplay weapon art.

Read these before implementation:
1. `docs/arsenal-quest/CORRECTION_PASS_HANDOFF.md`
2. `docs/arsenal-quest/CORRECTION_REVIEW_CHECKLIST.md`
3. `docs/arsenal-quest/AGENT_HANDOFF.md`
4. `docs/arsenal-quest/AV_INTEGRATION_HANDOFF.md`
5. `docs/arsenal-quest/P0_ASSET_MANIFEST.csv`
