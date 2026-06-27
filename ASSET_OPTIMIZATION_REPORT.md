# APEX CHAOS - Final Cleanup Summary

Date: 2026-06-27

## Final state

- Active project footprint excluding `.git` and `node_modules`: 218.14 MB.
- Public runtime payload: 217.75 MB.
- Asset manifest: 568 entries, zero missing paths.
- No runtime image or audio was recompressed, resized, or quality-reduced.
- No gameplay logic was changed by the asset cleanup.

## Permanently removed by user request

- `_archive_unused/`
- `_QUARANTINE_UNUSED_2026-06-25/`
- Generated `dist/` builds; `pnpm build` recreates them.
- Old control-map and control-mode authoring source packs.
- Generated browser test profiles, previews, editor exports, review assets,
  byte-identical unused aliases, temporary files, and Vite logs.
- Empty temporary directory.

Total disk space reclaimed from archive and quarantine data was approximately
4.53 GB. The project root now contains no known archive, quarantine, generated
browser profile, Vite log, or stale `dist/` directory.

## Retained intentionally

- `.git/`: repository history, not runtime trash.
- `node_modules/`: installed development dependencies.
- `public/`, `src/`, `tools/`, and `server/`: active project files.
- Ten technical control-map PNG files: retained to preserve exact alpha and
  pixel-mask behavior.

The production build passed before its generated `dist/` output was removed.
Main, picker, auto battle, and APEX CONTROL were smoke-tested without browser
warnings or missing assets.
