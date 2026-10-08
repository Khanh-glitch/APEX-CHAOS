# Q3 — Gold V12 exact source provenance

Canonical donor from the Quest owner upload (2026-10-08):

- Name: `APEX_CHAOS_QUEST1_DEEPER_WEAPON_GRIP_V12.html`
- Exact source bytes: **208884**
- SHA-256: `3817ab8b0ab674af9573704f20173ff1edfae5e26598f843b1dd1ab422ff3685`
- Git blob SHA-1: `4af4d668a1ff17f94c4dcbff32a35415b8a9cf03`
- Embedded modules: `/spring`, `/constants`, `/mat`, `/layouts`, `/presentation`, `/vfx`, `/art/robots`, `/art/artkit`, `/art/weaponArt`, and donor-only combat/AI/renderer/lab modules.
- Physical baseline: original standalone Gold, not the CP04 palette-inspired approximation.

**Scope:** This source is committed verbatim as an **inert provenance artifact** under `docs/quest/donors/`. It does not run in the shipped battle and is not proof that the V12 spring rig has already been integrated.

**Integration authority:** Retain Arsenal for physical fighters, real HP, damage, weapon ownership, target selection and match outcome. Reuse only presentation assets/springs/pose/weapon-grip to render Quest hostiles. Do not import the donor's isolated encounter combat, AI, cooldown-zero lab, or standalone UI.

**Q3 acceptance:** for Scrap Scout, Iron Bulwark, Claw Reaver and Core Sentinel, inspect idle, motion, actual pickup/held weapon, recoil, hit, heavy, A2 lock and KO on desktop and mobile. Check multiple same-type instances do not share animation state. Preserve separate in-arena damage popups and allow compact aggregate side panels. Record the actual display outcome before claiming parity.
