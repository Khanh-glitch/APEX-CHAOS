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
