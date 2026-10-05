# Mechanical Door V4 — Gold Transition Authority

Status: **owner-approved production donor**  
Cutover revision: `20261005-owner-playtest-r50k`

## Supplied donor fingerprints

- ZIP SHA-256: `f9f820886687aa70fdd0ac688df24f1da1513b5bcc0e74eecede8530fe2be1dd`
- Standalone HTML SHA-256: `fca1cd900e6d8976b8a541839447e2338f553b4931a4e24563964752b96dd7bd`
- Production runtime SHA-256: `6d338906e477c13fa42cd6727be7c41bdd0c5b66e12fc140e3836c7858ce0dd2`
- Gold `engine.ts` SHA-256: `6478353caf5cf5d12ce1fed1be5f6d247a9879f6820d0e74877e0c0a5420360c`

Structural asset hashes captured during donor audit:

- `core.jpg` — `5c445477aedafa2d17290c46217abd35cd64f7e2b1589f2220778f4625d2ee3c`
- `logo.png` — `a3ef0a82f5fe7675d865b07736572ad249e92331ffacd4ecd92e9c19d224eb94`
- `plate.jpg` — `d5a097b6c8eba37c571db6ee3fab64297747d24dc6619d1cc0f85d72670e5d1f`
- `rail.jpg` — `4920bc25fec3addb391c638336631b85a723dc1ca65ab5df02bbae6e3cfb914d`
- `ring-a.jpg` — `f57af6d3ed9b069007a0547703774af72c181cd02694a52f26695d4c76b2d93a`
- `ring-b.jpg` — `e96bbd72c5e5c41fd4fae9e32aa9f0c74e8e239e8344177257301fb5dddb50dc`
- `smoke.jpg` — `2c5591559d4a6225f00daebb1e5f2aff793e3121aa823eac0cc6a77ce807bb74`

## Motion/timing law

Production keeps the donor state machine and ordered choreography:

`IDLE → CLOSING → SEALED → OPENING → DONE`

Authoritative timing values:

- close end: `1.68`
- minimum sealed beat: `0.075`
- opening end: `1.68`
- cover/scene-swap callback: closing virtual time `0.66`

READY is monotonic. It may accelerate the remaining close/open timeline, but it must never skip structural phases or reorder cues.

Adaptive opening speeds remain donor-authored:

- ≤ 150 ms → `1.85×`
- ≤ 350 ms → `1.62×`
- ≤ 750 ms → `1.42×`
- ≤ 1.5 s → `1.24×`
- ≤ 4 s → `1.08×`
- long load → `1.00×` with sealed hold

## Allowed production adaptation

Only the following integration changes are authorized:

1. Remove the standalone demo control panel, CLOSE/READY/RESET buttons, keyboard demo triggers and simulated load selector.
2. Remove demo Menu/Arena background images from the transition asset contract.
3. Render the **real live source and destination HUD/scene DOM** behind the transition canvas. The destination is committed only under opaque cover.
4. READY is driven by real destination readiness: required fetch/decode/runtime activation/semantic live gates.
5. Cold boot begins on a plain dark screen; Mechanical Door appears as soon as its own structural payload is ready and holds until Home Core is READY.
6. Keep donor responsive geometry/DPR/FX-quality behavior unchanged.
7. The exact donor source-collapse and target-reveal transforms are retained.
8. Once close starts, public navigation cannot cancel, reset, skip or force-open the transition.

Everything else in motion, structural art, event order and responsive behavior is Gold authority.
