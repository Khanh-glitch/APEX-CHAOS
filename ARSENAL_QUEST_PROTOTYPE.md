# Arsenal Quest — Current Prototype Direction

**Authoritative handoff:** `docs/arsenal-quest/AGENT_HANDOFF.md`

This root note intentionally stays short. The previous standalone proof-of-concept is not the implementation target.

## Current core law

- Built **inside existing Apex Chaos**, not as a recreated engine.
- HERO vs RIVAL, both 100 HP, unarmed, no native skills.
- Both reuse Apex auto movement / bounce / collision.
- Spawn slots appear on a fixed cadence even if previous pickups remain.
- Slot location is visible first, but weapon identity is hidden.
- Weapon reveals after a random 1.2–1.8s and only then becomes collectible.
- Multiple pickups may coexist.
- First fighter to touch a revealed pickup equips it.
- Weapon is temporary/consumable; fighter returns to unarmed after use.
- P0 = 12 weapons only.
- No quests/progression/bosses/leveling yet.
- Additional bullet/VFX/SFX assets are deferred; reuse existing Apex presentation during coding.

Read these before implementation:
1. `docs/arsenal-quest/AGENT_HANDOFF.md`
2. `docs/arsenal-quest/P0_ASSET_MANIFEST.csv`
3. `docs/arsenal-quest/ASSET_AND_LICENSE_NOTES.md`
4. `docs/arsenal-quest/REVIEW_CHECKLIST.md`
