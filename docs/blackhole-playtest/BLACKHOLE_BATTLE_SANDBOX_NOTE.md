# BLACK_HOLE Battle Sandbox — Deliverable Note

**Question answered:** *what does the golden BLACK_HOLE feel like inside APEX CHAOS gameplay?*

**Artifact:** `public/playtest/blackhole-battle-sandbox.html`
(one standalone HTML file, zero dependencies, no network, no iframes, no production code touched)

**Status: RUNTIME-VERIFIED.** Loaded in real headless Chromium (WebGL2 + SwiftShader, `EXT_color_buffer_float`), all **37/37 acceptance gates passed**, genuine canvas screenshots captured to `docs/blackhole-playtest/evidence/` (see `report.json` for the full gate log).

---

## 1. Reused directly (verbatim) from the golden prototype

The build (`tools/blackholeSandbox/build.mjs`) **extracts GLSL from the golden baseline at build time** — the shaders below are the approved source, byte-for-byte, not re-typed:

| Golden system | Reused how |
|---|---|
| `COMMON` GLSL library (hash/noise/fbm, `L()` sRGB→linear, `rot()`, ACES) | verbatim, shared by every pass |
| Head identity shader `FS_SCENE_HEAD` (cosmos + 4 star layers + 2 galaxies + forehead vortex, rupture eyes with SDF/plasma/voronoi/bezier streams, 3 band sheets, stress halo, 16 vesica shards, horizon/accretion/photon-ring math) | verbatim core + documented patches (§2) |
| Post chain: `FS_DOWN` (4-mip bloom, knee 0.55), `FS_BLUR` (separable), `FS_FINAL` (radial CA, bloom stack .55/.6/.7/.8, exposure, ACES, vignette, dither) | verbatim |
| Particle pass `VS_PART`/`FS_PART` (additive soft points, tidal stretch) | verbatim |
| Spring bank + motion law (w,z; `PH.*` phase clocks, blink machine, tension/K/rs/suck/stress/band/swirl/twist/eye/squint/spin/fall) | verbatim engine, driven by composer presets |
| **Skill Composer Lab presets** (`A1_CAPTURE/A1_RELEASE/A1_FULL/A2_ABSORB/A2_RETURN/A2_FULL/PASSIVE_50/PASSIVE_100` target dicts from `04_SKILL_COMPOSER_LAB.html`) | applied verbatim via `setTargets` — A1/A2/passive ARE the lab presets, driven by battle state |
| Lens math (rsrc = √(r²+K²), frame dragging, shock refraction, log-polar accretion, photon ring, infall streaks) | ported 1:1 from `FS_LENS` into a multi-slot variant (§2) |
| Adaptive quality (0.5–1 res scale on 15–27 ms frame budget), DPR≤2, RGBA16F with RGBA8 fallback | verbatim strategy |

**Same-technology rule:** the face, A1 entry/exit wounds, A2 absorb/return crush and the passive growth aura are all rendered by the *same* horizon/accretion/photon-ring/stress-light material — one `WSing` class packs every world singularity into the same lens slots the head uses. No forehead copy-paste: each ability recomposes the shared bank via its own preset, so function reads differ (transit = long spin + matter curl; return = compression + recoil; vulnerability = thinner surface + dimmer eyes + dispersed band).

## 2. Adapted for battle scale (documented patches, loud-fail guarded)

1. **Seat uniform** — golden head is screen-fixed; sandbox moves it: `const SC` → uniform `uSeat`, packed each frame from the fighter's world position (breath/sway/lean preserved).
2. **Battle-state uniforms on the head shader** — `uGrowth` (wider orbit + more depth, nebula/star/eye intensity modulation), `uVuln` (surface thins, eyes dim, matter band disperses), `uEscrow` (compression pressure while absorbing), `uHitFlash`, `uKo`.
3. **Premultiplied compositing `overC()`** — the golden head assumed it owned the frame; in battle it must composite over the arena (scissored draw, ONE/ONE_MINUS_SRC_ALPHA).
4. **Coverage-aware shards** — band sheets/shards get soft outer coverage so torn edges read correctly over a bright arena floor instead of the dark void.
5. **Multi-slot lens `FS_LENS`** — the golden lensed one singularity; battle lenses up to 5 simultaneously (head seat + entry + exit + A2 field + crush) with the same warp/streak/horizon/accretion math per slot. The golden single-slot source remains the reference (`FS_LENS_GOLDEN` extracted and checked at build).
6. **World-space VFX** — golden particles live in head space; battle adds post-lens world particles (capture folds, release bursts, crush recoil, rings, floating combat text) using the golden particle shader language.

## 3. APEX production systems reused (from `playtest/arsenal` source, not READMEs)

- **Arena**: Chamber01 painter ported from `apexRenderPrimitives.js` (`drawSketchBlob`, radial floor shading, wall ring) — the BLACK_HOLE fights on the real arena.
- **Movement/collision law** (`arsenalQuestRuntime`/apexEngine): constant speed 520, wall bounce, fighter-vs-fighter 50/50 split + reflect, hitStop-style time dip on big events, slow-mo 0.25×.
- **Projectile law**: swept segment-vs-circle hit test, `hitR = target.radius·0.78 + bullet.radius`, production tracer language (thin core line + bright head dot, `lighter` blend).
- **HUD behavior**: hp bars with loss-trail lag, skill chips with cooldown fill, meters — ported DOM/CSS/JS patterns from `apexCombatHudRuntime` + playtest styles.
- **Constants**: MATCH_HP 1000, fighter radius 75, T-tier damage model. The sandbox ships its own **T6 Stormbreaker round** because the production registry stops at T5 — used to prove the exclusion law.
- **Bot**: APEX-style opponent (strafe bands, 3-shot pistol bursts with movement lead, heavy shots every 6–7.5 s).

## 4. Battle rules implemented (all runtime-verified)

| Rule | Value | Gate result |
|---|---|---|
| A1 cooldown / duration / capacity / transit delay | 14 s / 2.7 s / 8 objects / 0.35 s | ✅ cast, self-terminates, store ≤ 8 |
| A1 exit margin | ≥ 120 px + fighter radius from both fighters | ✅ 385 px observed |
| A1 release | preserves velocity, ownership, damage, tier | ✅ released round: owner=RIVAL, speed 3324 = fired 3324 |
| A2 cooldown / absorb / max escrow / return | 18 s / 1.0 s / 300 / 65 % as ONE event | ✅ escrow 90 → returned 58.5, bot lost 58.5 in one hit |
| A2 vulnerability | 3.0 s at ×2 incoming | ✅ 30 dmg → 60 while exposed, expires |
| T6 exclusion | never captured, never escrowed | ✅ full 220 through an open singularity, store 0 |
| Passive growth | +1 r per 10 realized HP, max +100 | ✅ 90 dmg → +9 r; heal-safe; forced 0/50/100 % |
| Escrowed-but-never-landed damage | does not count as growth | ✅ realized ≠ escrow verified |

**A1 entry sequence** (per spec): pre-tension → compression → light bending → horizon birth → curling matter → suction; exit: spatial wound → expand → release impulse → recoil → collapse. **A2** reads as compression/lensing (no shield bubble), return is one concentrated crush event with recoil, vulnerability is carried by the character (dispersed matter band, thinner surface, dimmer eyes) — no red icons.

## 5. Prototype-only (do NOT treat as production design)

- The whole sandbox file itself — production integration would go through the real Arsenal runtime, HUD, and skill-gate systems.
- Bot AI (strafe/burst heuristics), pickups (+40 heal, respawn), debug-only guns (ALLY stream, T6 round, burst-damage injector).
- A1 exit placement heuristic, A2 crush targeting, KO/auto-reset flow, follow-cam, debug panel — all sandbox harness, not game design.
- Balance numbers beyond the spec'd ones (chip damage, body contact, gun stats) are placeholders to make the fight legible.
- Multi-slot lens is a port, not the golden file itself; golden remains the visual authority for any production work.

## 6. How to run / build / verify

```bash
# play: open public/playtest/blackhole-battle-sandbox.html in any WebGL2 browser
# controls: WASD/arrows move · L or SPACE fire · J = A1 · K = A2 · R reset · P pause
#           S slow-mo (1/0.5/0.25) · B blink · H hide UI · D hitboxes · C camera · O auto-move
node tools/blackholeSandbox/build.mjs        # rebuild from golden sources (loud-fail on drift)
node tools/testBlackholeSandbox.mjs          # 37-gate headless acceptance run (needs /tmp/sc puppeteer)
```

Source layers: `tools/blackholeSandbox/t1_head.html` (DOM/CSS) · `t2_engine.js` (GL pipeline) · `t3_battle.js` (game layer) · `t4_shell.js` (shell/IO) · `build.mjs` (assembler).

**Evidence:** `docs/blackhole-playtest/evidence/` — 14 state screenshots (intro, idle, A1 born/capture/release, T6, A2 absorb/return, growth 50 %/100 %, vulnerable, KO, reset, follow-cam) + `report.json`. Supplementary 1280×800 captures: `hi*.png`.
