# APEX CHAOS Gold UI Authority

Current decomposed Gold source authority lives in `docs/gold-ui/current/`.

Read in this order:
1. `current/README_GOLD_AUTHORITY.md`
2. `current/manifests/ANTI_DRIFT_CONTRACT.md`
3. `current/manifests/IMPLEMENTATION_PRELOAD.md`
4. `current/manifests/ACTIVE_IMPLEMENTATION_PROMPT.md`
5. `current/index.html`
6. donor HTML under `current/donors/`

Owner source standalone SHA-256:
`4ffdfcdd64cb908b39d55a1eb210d340b27a111e6bf328774b36e4a1d96a57cd`

Stable Gold payload-tree SHA-256:
`e182924831879bbe041c3505161a43a7861e5586575a3f4bb966512d6392fb31`

The final downloadable ZIP is verified by the external sidecar
`APEX_CHAOS_GOLD_SOURCE_PACK.zip.sha256`. The ZIP itself is intentionally not duplicated into Git because the fully decomposed bytes already live in this tree and duplicating the archive would add redundant repository weight.

Additive AV/theme preload checkpoint: `50b185c184955d279de93874823859ccabb498c6`.
Read `preload/README_AV_THEME_PRELOAD.md` and the current ACTIVE prompt before production implementation.

This directory is reference/preload authority, not production runtime code.
