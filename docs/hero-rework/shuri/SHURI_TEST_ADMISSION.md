# SHURI — Native QA Admission (Preview Only)

Owner requested SHURI integration, full visual roles, and readiness for an independent deploy/playtest on 2026-10-17.

The CP4 admission schema uses `releaseStage: approved` for any fighter visible in the playable roster. For SHURI this denotes **technical admission to the draft feature-branch QA roster**, not approval of the Gold look, sound mix, balance, rights, or production publication.

Source: PR #89 based on BOXE PR #88, with canonical Arsenal gameplay, owner Gold V8 engine and six user-supplied V5 raster role assets. Keep all source Gold sprites byte-for-byte unchanged.

Required before merging into `main`: 1v1 real Chrome P1/P2 and rematch, SHURI Gold/VFX and skill role frames, 41 weapons and machine gun rack contacts, BOXE audio audition, explicit owner acceptance, legal SFX provenance, and green GitHub CI. Do not deploy to production from this acceptance document.

Proof test: `tools/testShuriNativeArsenal.mjs` boots the real Arsenal match, casts a native A1 and tears down the session for P1, P2 and SHURI mirror match.
