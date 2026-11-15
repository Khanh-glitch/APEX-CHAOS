# Evolution Cleanroom — remote import verification

- Repository: https://github.com/Khanh-glitch/APEX-CHAOS
- Branch: `evolution/2026-11-15-cleanroom`
- Base main commit: `9d06036dda72eff6afe7bb1e34bc72652ae9c248`
- Initial verified Evolution import commit: `8e09746c692b6bd0384bcc718a3871065ddd5efb`
- Source: user-supplied `apex-chaos-game-evolution (1).zip`, curated excluding four `.playtest` scripts.
- Verification: 219 of 219 selected source files (from original ZIP) exactly match their Git blob SHA after import.
- Included files: all 7 new Evolution runtime components; Next.js entrypoint/host; Gold/Arsenal hooks and fighter extensions; audit and next-round prompt.
- Inherited APEX binaries: existing main branch assets remain at original paths in this branch; e.g. `public/assets/boxe-gold/bot.png`, body/glove/fire/fracture images, other hero-rework rigs, Arsenal SFX/VFX, Gold art.
- Asset reference reconciliation: 310 literal source references missing from ZIP; 296 now available on branch from inherited main assets; 12 missing BLACK_HOLE/TIME UI illustrations (avatar/cover/skill images); 2 documentary ellipsis strings not real URLs. Five new arena material images referenced under `/assets/evolution/materials/*.jpg` also remain absent.
- Art authority: missing materials and portraits must be created or replaced with legally usable, high-fidelity artwork; do not substitute crude placeholders while claiming visual acceptance.
- Status: GitHub **source custody verified**. **Production / browser / gameplay / visual acceptance NOT yet demonstrated**. Remaining known blockers in `docs/EVOLUTION_PRODUCTION_AUDIT.md` must be fixed.
- Correct app start: Next.js (`npm install`, `npm run dev`). The retained Vite scaffold is historical; its presence must not be mistaken for an alternate production entry.
