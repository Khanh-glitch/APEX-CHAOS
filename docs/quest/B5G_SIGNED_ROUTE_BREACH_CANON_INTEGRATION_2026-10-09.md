# B5g owner-canon integration checkpoint (2026-10-09)

This is a **two-parent integration commit** on the actual B5f real-Gold victory lineage:
- first parent `c47b7c38a532fb1c6f8b4f8d32d1c53027ad82b9`: E01–E05 true physical Desktop+Mobile SUCCESS in GitHub Actions run 37928398741. Current *experimental* E03 A=3×120HP; B=4×90HP and E04 LV1 180HP/LV2 160HP (both preserve owner-locked speeds, collide/reflect, 50 contact, tier whitelist, physical gun-cap).
- second parent `62f5dc2eb65c323697bf5ccc4a172e711c060477`: tested E06 *pure* owner-canon data / retreat law only, NOT any playable E06. Its 3-wave concept is documented; **not** a signed runtime path.

The E06 code and its tests are transplanted verbatim from the B6c parent. This commit does **not** merge its experimental E01/E03 changes over the winning B5f source; no battle code changes outside B5f. A valid two-parent merge graph is used rather than hiding provenance through a cherry-pick.

Gold layout, responsive R90, Owner's Gold V12 assets, and main remain untouched.

## CI gates
- Pure native E06 law (3 allies, 3 waves, signed retreat math, no synthetic damage / HP restore)
- Existing owner species and Gold story contracts E03/E04, source regeneration, production build
- Full physically signed Desktop and Mobile Gold E01–E05 including wave-A and B real KO, E04 3 real spawn attempts, true 6000 damage E05, HUD close, reload after save
- Do not claim E06 playable unless the Gold + Arsenal + Director start path, withdrawal before KO, preserved guns and cooldown, owner motion, and save/retry/reload actually pass
- One Chrome victory per platform is proof of reachability **not** playability rate; collect repeated data later.

Pending: E03/E04 difficulty owner playtest, E06 authored rig-to-combat transition (avoid autonomous rig invented canon), T.O.T/RIVET J/K authority, and responsive quality screenshot acceptance.
