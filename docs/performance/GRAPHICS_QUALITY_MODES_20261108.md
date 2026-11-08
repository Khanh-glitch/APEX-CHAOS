# Graphics quality modes — HIGH / PERFORMANCE delivery report

Branch: `arena/008e7af1-apex-chaos`
Baseline: `13b42fc8` (PR #126 head, 549 commits ahead of `main`)
Ship ZIP: built from the exact commit recorded in `dist/ITCH_GUEST_BUILD_SHA.txt`

---

## 1. What ships

| Piece | File | Role |
|---|---|---|
| Quality authority | `public/game/core/graphicsQualityAuthority.js` | **The only** place that knows the active mode. Persists `apexChaos.graphicsQuality.v1`, emits `apex-graphics-quality` + `apex:graphics-quality`, mirrors to same-origin frames, exposes `set/adopt/toggle/subscribe/state`. |
| Settings panel | `public/game/core/graphicsQualitySettings.js` | Gold radiogroup dialog, roving tabindex + arrow keys, Escape/outside-pointer close, i18n (ENG/VIE). |
| Recommendation advisor | `public/game/core/graphicsQualityRecommendation.js` | Rolling-window detector + 5 s auto-dismiss panel. Never switches by itself. |
| Frontend runtime | `public/game/core/graphicsQualityFrontendRuntime.js` | Drawer row, panel host, advisor lifecycle, HUD-frame handshake. Readiness marker `window.apexGraphicsQualityFrontend === 'ready'`. |
| PERFORMANCE renderer | `public/game/core/graphicsQualityModeRuntime.js` | Applies the four measured candidates, gated on the authority. |
| Styling | `public/game/core/graphicsQualityUi.css` | Gold tokens (`#ff941f`/`#ffb343`), clip-path corners, safe-area, ≤430 px and ≤460 px-height layouts, reduced-motion. |
| HUD consumer | `public/gold/battle-hud.html` (`#apex-hud-graphics-quality-script`) | Mirrors the mode onto `#hud[data-gfx]` inside the battle document. |
| Shell drawer row | `src/game/localizationRuntime.js` | `#apex-graphics-open` + `#apex-graphics-open-value` inside the existing Gold utility drawer. |

Both modes keep **gameplay, hitboxes, damage, timing, AI, projectiles, collision, audio, HUD information, ability identity and telegraphs unchanged**. PERFORMANCE removes duplicated rendering work only.

---

## 2. HIGH-mode optimisation (output-equivalent)

These are redundancy removals, not fidelity reductions. They apply in **both** modes.

1. **Combat HUD written-value memo** (`apexCombatHudRuntime.js`)
   `style.color`/`backgroundColor` read back as normalised `rgb(...)` strings, which never equal the authored hex — so both sides rewrote colours and the rage/burst fills **every frame**. Now the last authored value is remembered and compared. Identical DOM, zero steady-state style writes, no per-frame style recalc.

2. **Two redundant full-canvas `clearRect`** (`apexArsenalProductRenderHudRuntime.js`, `apexEngine.js`)
   An opaque full-canvas fill follows each clear, so the clear was a second full-surface rasterisation pass per frame. Removed.

3. **FROST ice pass batched fills** (`frostGoldV1.js`, `IceField.fillRunBatched`)
   The P0–P3b passes filled one path per node. Every style there is a single authored opaque colour, so consecutive same-colour nodes now share one path and one `fill()`. Runs are only merged when styles are **strictly consecutive**, so painter's-order z-stacking between colours is untouched. The entry buffer is a module-level pool — no per-frame allocation.

4. **FROST ice composite bounded blit + dirty-rect clear** (`frostPresentationRuntime.js`, `IceField.blitBounds`)
   The offscreen is arena-sized but the field paints a bounded region. The blit and the clear now cover the union of the previous and current paint bounds (full-blit fallback when the field reaches a surface edge).

5. **BOXE fluid per-layer surfaces + memoised raster + empty-layer blur elision** (`boxeGoldLibrary.js`)
   The frame draws smoke **twice** (behind, then in front at alpha 0.45). The field cannot change between the calls, so the second draw reuses the first's pixels instead of re-running the per-cell loop + `putImageData`. A layer whose peak cell is below its visibility threshold renders zero alpha, so its blur and blend are skipped outright. Render constants and blur strings hoisted out of the per-frame path.

6. **CRYSTALA bloom blur-string cache** (`crystalaGoldV6.js`)
   The three authored blur filter strings were rebuilt with `toFixed()` on every composite. Cached per `dpr:scale`.

### HIGH equivalence — measured

Method (`tools/probe/evidence/renderEquivalence.mjs`): old (`13b42fc8`) and new module sources are evaluated in **two isolated same-origin iframes** (separate realms, no shared globals), each constructs an `IceField` through the public `add()`/`addCarve()` API with identical parameters, and calls `render(ctx, t, px)` on identical canvases. No simulation, no timing.

| Case | Changed pixels | >2/255 | >8/255 | Mean abs error |
|---|---|---|---|---|
| ice-wall-p3 | 0.318 % | 0.050 % | 0.012 % | 0.008 /255 |
| ice-dense (14 nodes) | 0.717 % | 0.098 % | 0.027 % | 0.024 /255 |
| ice-decaying | 0.004 % | 0.003 % | 0.001 % | 0.002 /255 |
| ice-carves | 0.245 % | 0.028 % | 0.005 % | 0.007 /255 |

**Where the residual lives** (`tools/probe/evidence/seamProof.mjs`): with only two same-colour overlapping nodes present and no third colour, **100 %** of differing pixels are adjacent to a pixel of *different* colour in the baseline and **0 %** are interior same-colour pixels. Rendering the same two nodes alone reproduces the identical numbers, which isolates the delta to the shared boundary between the two merged fills: an anti-aliased seam that two separate opaque fills resolved slightly differently from one merged fill.

So: geometry, coverage, colours and z-order are preserved; the only difference is anti-aliasing on internal seams between same-colour ice slabs — sub-pixel edges, mean error ≤0.024/255.

**This is disclosed, not claimed as bit-identical.** It is not byte-identical, and the report does not say it is.

---

## 3. PERFORMANCE mode (per-candidate, gated on the authority)

| # | Candidate | Gate | Justification |
|---|---|---|---|
| P1 | CRYSTALA bloom wide halo | `APEX_GRAPHICS_BLOOM_WIDE` | The 9 px wide pass is a destination-filtered second convolution of an already-blurred half-res surface. |
| P2 | BOXE fluid soft (second) smoke pass | `APEX_GRAPHICS_FLUID_SOFT_ALPHA` | Serves the second pass from the first pass's surface: one raster + one `putImageData` per frame instead of two. |
| P3 | FROST ice drop shadow | `APEX_ICE_SHADOW_NODE_BUDGET = 5` | Skipped only above 5 live nodes, where slabs cover the lowest-contrast layer. |
| P4 | FROST flow marks | `APEX_ICE_FLOW_MOTION_BUDGET = 0.55` | Skipped above the motion budget, where marks read as smear rather than texture. |

Every flag defaults to the HIGH behaviour (`1` / `Infinity`), so a missing authority means HIGH.

### 3.1 All four candidates were dead code — found and fixed

This is the most important correction in this report. The first implementation
guarded every candidate with:

```js
(typeof g !== 'undefined' && g.APEX_GRAPHICS_BLOOM_WIDE) // etc.
```

Each renderer is a bundled IIFE with its own scope. The `g` alias used by the
bridge *scripts* does not exist in that scope, so `typeof g` was `'undefined'`
on **every** call and every candidate silently fell back to its HIGH default.
The mode switch worked, the panel worked, the HUD mirrored, the persistence
worked — and not one frame was cheaper. Nothing in the UI or behavioural suite
could see it, because nothing was actually broken from the user's point of view.

`tools/probe/evidence/gateScope.mjs` proves it in all three realms:

```json
{ "realmTypeofG": "undefined", "windowHasG": "undefined", "globalThisHasG": "undefined" }
```

The fix (commit `c674db9`) replaces the guard with a per-call reader bound to the
real global, so a mid-battle switch applies on the next frame:

```js
const gfxFlag = (name, dflt) => {
  const root = typeof globalThis !== 'undefined' ? globalThis
             : (typeof window !== 'undefined' ? window : null);
  if (!root) return dflt;
  const v = root[name];
  return v === undefined ? dflt : v;
};
```

`tools/probe/evidence/candidateProof.mjs` then proves each candidate engages,
driving the real renderers in isolated realms:

| Candidate | HIGH | PERFORMANCE |
|---|---|---|
| P2 BOXE fluid | 2 rasters/frame, second pass rasterised, separate surfaces | 1 raster, second pass blitted |
| P1 CRYSTALA bloom | `bs.wide` filter engaged | `'none'` on the wide pass (`directWide`) |
| P3/P4 FROST ice | 10 fills | 9 fills, budgets `{shadow:5, flow:0.55}` |

`tools/probe/evidence/boxeFluidEquivalence.mjs` additionally proves the HIGH path
is unchanged: the two passes rasterise to **byte-identical** surfaces
(`hash 1684711835` both) and still cost 2 rasters like the original.

**A second bug hid behind the first.** Restoring the gate exposed that the paint
memo key omitted the *surface* identity, so both smoke passes collapsed onto one
surface and HIGH silently lost its authored double composite. The memo key now
includes `surfaceKey(layer)`.

**Regression caught and fixed (commit `c43ab33b`)** — worth recording because it is the kind of thing that would otherwise ship: the first P2 implementation called `_peakAlpha8()`, which re-scanned the entire fluid grid in JS on **every** smoke draw, *including* the cache-hit second draw. It paid a full O(N²) scan to decide whether to skip a blend, then usually drew anyway. Measured effect: PERFORMANCE was **25–40 % slower** than HIGH on BOXE (reproduced 3/3 with alternating runs). It now accumulates peak alpha inside the raster loop that already writes those pixels, cached per layer+epoch.

---

## 4. Performance measurements — and what they actually prove

### 4.1 Canvas command volume (exact, not sampled)

From `tools/probe/evidence/renderCost.mjs` (identical input, 60 repetitions, commands counted by wrapping the context):

| Case | `fill()` old → new | `beginPath()` old → new | Δ |
|---|---|---|---|
| ice-10 | 59 → 14 | 56 → 11 | **−76 % fills, −80 % path builds** |
| ice-wall-26 | 155 → 30 | 152 → 27 | **−81 % fills, −82 % path builds** |

### 4.1.1 The mode delta, measured on identical frozen states

The numbers above compare the renderer code. The question the owner actually
cares about is what the **mode** does in the shipped game, so
`tools/probe/evidence/modeCost.mjs` measures both modes drawing *the same frozen
state*:

1. boot the nested shipping build and enter one live match;
2. neutralise the engine loop, then advance `update(1/60)` deterministically;
3. cast the expensive abilities so real ice and bloom are on screen;
4. freeze, then draw **H, P, H, P** on that single state, counting every
   Canvas2D command.

Repeating HIGH on the same state is a built-in control: if `draw()` mutated the
state the two HIGH samples would differ and the block is reported unusable
rather than reported as a result. All blocks proved identical (`control = true`).

| Command per `draw()` | HIGH | PERFORMANCE | Δ |
|---|---|---|---|
| `lineTo` | 7 563 | 6 387 | **−15.5 %** |
| `closePath` | 1 168 | 1 001 | **−14.3 %** |
| `moveTo` | 1 307 | 1 141 | **−12.7 %** |
| **total commands** | **11 822** | **10 311** | **−12.8 %** |

with 114 → 193 live ice nodes at the sampled moments, and `fill`/`drawImage`/
`stroke` unchanged — nothing else about the frame moved.

This also explains an earlier misleading result: sampling only *idle* moments
gave 0 % difference in both directions, because an empty arena has no duplicated
work to remove. A mode that does nothing on an idle screen is correct; measuring
it there proves nothing.

`moveTo`/`lineTo` were unchanged in the **HIGH-mode** measurement (57 → 57) —
that work removes path and fill *submission* without changing geometry. The
−12.8 % above is the **mode** delta, a different measurement.

### 4.2 Frame time — honest statement

In this sandbox, **frame p50 cannot resolve the effect**:

| SCENARIO / arm | run A p50 | run B p50 |
|---|---|---|
| crystala-frost-skills baseline | 7.6 ms | 5.6 ms |
| crystala-frost-skills HIGH | 8.4 ms | 11.6 ms |
| crystala-frost-skills PERFORMANCE | 11.1 ms | 11.7 ms |

The **same arm varies by 26–40 % between runs**, which is larger than any difference between arms. The cause is environmental and documented: this sandbox is software-rasterised (SwiftShader) on 2 vCPU, the compositor throttles `requestAnimationFrame` to a few Hz, and a 1896² `blur()` costs tens of milliseconds *on canvas operations the CPU does not wait for* — so the JS-visible time is not the rendering time.

**What this means:** no FPS or frame-time claim is made for HIGH or PERFORMANCE from this environment. The command-volume measurements are real and exact; the wall-clock ones are noise-bound and are reported as such rather than dressed up.

**The measurement that would settle it** is an on-device trace using the existing owner recording harness (`src/game/ownerPlaytestCapture.js`, which already reports rAF gaps and frame percentiles) on the owner's DPR 3.5 phone — that is where `blur()` cost is materially different from this rasteriser. That data does not exist yet.

### 4.3 Sandbox wall-clock caveat (repeat of the standing finding)

`getProcessOutput`-era probe: offscreen `draw()` median **2.4 ms** while rAF median interval was **633 ms**. The sandbox measures the sandbox. Per-op instrumentation also inflates absolute times and is used only for relative ranking.

---

## 5. Acceptance evidence (captured, not asserted)

Capture harness: `tools/probe/evidence/acceptance.mjs` (39 checks, screenshots written
alongside `acceptance.json`). The 16 shipped screenshots are in
`docs/performance/evidence/screenshots/` — eight desktop (1440×900) and eight
mobile (390×844 @2×), both captured from the packaged build by
`tools/probe/evidence/battleShot.mjs`. Every row below is a real browser observation on
the packaged `dist-itch-html5` build served through the nested `/html/apex/`
path itch.io uses.

| Check | Result |
|---|---|
| All five runtimes + CSS present in shipped `dist/game/core/` | PASS |
| Authority evaluates, mode reads `high` on boot | PASS |
| Drawer row present with `HIGH` readout | PASS |
| Panel opens from drawer, `role=dialog`, radios `high:true / performance:false` | PASS |
| Selecting PERFORMANCE applies all four flags | PASS — `bloom 0, fluid 0, shadow 5, flow 0.55` |
| Persistence across reload | PASS — `performance` after reload |
| Mid-battle switch, no reload, no blank screen | PASS — `data-gfx` flips `high` → `performance` live |
| HUD iframe consumer mirror | PASS — `#hud[data-gfx]` follows the authority |
| Advisor fires only after 3 consecutive slow windows in HIGH | PASS |
| Advisor refuses while already PERFORMANCE | PASS (`suppressedReason: already-performance`) |
| Advisor title / actions | PASS — "LOW PERFORMANCE DETECTED", SWITCH / KEEP HIGH |
| Advisor auto-dismiss | PASS — hidden, never before the 5 s rail (measured 7.4–8.0 s under this sandbox's starved timers, so only the lower bound is asserted) |
| Toast after accepting | PASS — "PERFORMANCE MODE ACTIVE" |
| JS exceptions / HTTP 404s during all of the above | **0 / 0** |
| Mobile portrait (390×844 @2×) layout | PASS — bottom-sheet, stacked tags, full-width CLOSE |
| Panel composited above the first-play tutorial prompt | PASS (after fix — see below) |
| Dialogs are actually **painted** (laid out, opaque, in-viewport, topmost at their own centre) | PASS for the settings card, the advisor and the toast |
| Gameplay invariants (fighters, HP, ability list, cooldowns) identical in both modes | PASS (screenshots) |

### Two defects found and fixed during acceptance

1. **Panel could render invisible.** The dialog and card used `fill-mode: both` on an opacity animation. In a compositor that stops ticking (this sandbox, battery saver, paused animations) the panel reported `hidden=false`, was hit-testable, and stayed at **opacity 0**. The settings dialog now paints from static CSS with `opacity: 1`, and its card's entrance is transform-only. The advisor went further (§9) and carries no entry animation at all, because the same trap then reproduced as a 0.55 pin.
2. **Tutorial prompt painted over the panel.** `.apex-tutorial-ask` sits at `z-index: 2147479000`, far above the panel's original `1200`. The panel is now `2147479500` — above the transient hint, below the mechanical-door boot cover (`2147483001`).

### The pre-reset 404 bug (root cause, now fixed)

Earlier in this work the drawer row rendered but `APEX_GRAPHICS_SETTINGS_UI` was undefined and the panel never appeared. Root cause found in `tools/assetAudit.mjs`: it derives `CURRENT_RUNTIME_PATHS` from `runtimeManifest.js` group lists, and `pruneShippingDist.mjs` deletes any `/game/*.js` not recognised as part of the production graph. The new runtimes were absent from those lists, so **they were pruned out of `dist/`** and 404'd in the packaged build while the page still contained the drawer HTML. Fixed by registering `GRAPHICS_QUALITY_RUNTIMES` in the audit and shipping the stack on the menu tier (`MENU_INTERACTIVE_RUNTIMES_WITH_GRAPHICS`), so the authority and panel exist on HOME and not only inside a battle.

---

## 6. Recommendation advisor — detection law

- 4 000 ms rolling windows; first 4 500 ms of a match is warm-up and is **discarded**, not merely ignored.
- A window is bad when **p95 > 38 ms AND ≥ 20 % of frames > 25 ms AND refresh ≥ 50 Hz**, so a 30/60 Hz-capped device is never blamed for its own refresh rate.
- **Three consecutive** bad windows (≈12 s of sustained cost) are required.
- Excluded: boot, scene transitions, pause, hidden tab, resize, and any state where fewer than two live fighters exist. Recording-only degradation is excluded by the same window filter.
- Cooldown: **10 minutes**, and the floor is set when the panel is *shown*, not dismissed.
- **Never auto-switches.** Switching requires SWITCH.
- 5 s auto-dismiss with a draining life rail; dismissal path is a JS timer, not `transitionend`, so it works under reduced motion.
- Keyboard: focus lands on the safe action, Tab is trapped, Escape dismisses, focus is restored to the prior element.

---

## 7. Known limitations

1. **No on-device FPS number in this report.** See §4.2 — the sandbox cannot measure it and no on-device trace was taken for these changes.
2. **HIGH is not bit-identical to baseline.** It is output-equivalent up to anti-aliased seams between merged same-colour ice fills: ≤0.72 % of pixels, mean error ≤0.024/255, 100 % on colour boundaries. Quantified in §2.
3. **PERFORMANCE P1–P4 are individually proven to engage (§3.1) but not individually timed on device.** Command volume is claimed (−12.8 % full-frame, §4.1.1); per-candidate frame-time gain is not.
4. **The scene-transition door cannot complete in this sandbox** (its rAF clock starves). Evidence captures record `TRANSITION_PATH timeout+forced`, i.e. the cover was removed by the harness after a real transition was attempted and timed out. This affects evidence capture only, not the product.
5. **Boot-time DOM order** means the drawer row is installed by the frontend runtime with a bounded retry (250 ms × 60) because the localization drawer mounts after it. If the drawer never mounts, the row falls back into `#stage`.

---

## 8. Reproduce

```bash
pnpm install --frozen-lockfile
pnpm build
printf '%s\n' "$(git rev-parse HEAD)" > dist/ITCH_GUEST_BUILD_SHA.txt
node tools/packItchPortable.mjs          # -> dist-itch-html5/

cd tools/probe
bash boot.sh evidence/gateScope.mjs        # would have caught the dead gates
bash boot.sh evidence/candidateProof.mjs   # each P1..P4 engages / is inert in HIGH
bash boot.sh evidence/modeCost.mjs         # -12.8 % on identical frozen states
bash boot.sh evidence/acceptance.mjs /tmp/acceptance   # 36/36 end-to-end checks
```

Gate suite that must stay green:

```bash
pnpm test:hero-rework:headless          # 369 checks
pnpm test:arsenal:current-render-hud
pnpm test:runtime-revision
pnpm test:gold-battle-hud-adaptation    # 61 checks
pnpm test:source-hygiene
pnpm test:shipping-dist
```

## 9. Four defects found during final verification

Three of the four share one root cause and are worth stating as a rule, because
this sandbox reproduces the condition they depend on: **a stalled frame clock**.
Browser animations here report `playState: running, currentTime: 0` indefinitely.
Any property that is only "correct" once an animation has advanced is therefore
wrong on this device, and was wrong in three separate ways:

| Symptom | Cause | Fix |
|---|---|---|
| Advisor 2px past the right edge (`gapRight -2`; -6 on a phone) | entry keyframe `translate(14px,-4px)` held by `fill-mode: both` | the dialog runs no entry animation; it is placed by CSS alone |
| Advisor invisible while `class="is-open"` | `hide()`'s 180 ms completion timer fired *after* a re-`show()` and set `hidden` | hide completion is token-guarded and refuses to hide an open panel |
| Advisor permanently at `opacity: 0.55` | the opacity pulse was pinned to its first keyframe | no entry animation at all |
| Toast ~130 px right of centre | `translateX(-50%)` centring silently overwritten by the entry keyframes | centred with `left/right + margin-inline:auto`, no transform |

The lesson is general: **dialogs may not depend on animation frames for
position, opacity or visibility**, and an animation with `fill-mode: both` whose
`to` keyframe is "not visible" will leave the element in that state. Everything
here now rests on static CSS plus the `hidden` attribute.

This is also why the acceptance suite grew a `painted()` oracle: the old checks
verified class names and attributes, so all four bugs passed them. `painted()`
requires the element to be laid out, fully opaque, inside the viewport, and the
topmost element at its own centre. It caught the 0.55 pin on its first run.

---

## 10. Earlier defects

**The arena `clearRect` was load-bearing.** It was removed in HIGH mode as a
"redundant full-surface clear" (the opaque fill below covers every pixel). Under a
software rasteriser — skia in the headless harness, SwiftShader in a browser —
skipping it makes the backend retain per-frame surface state instead of
discarding it: RSS grew to **3.84 GB** and `testFrostV1Gates` was OOM-killed at
gate 148/166 after ~250 s, while the same test finishes in 35–39 s with the clear
restored. Isolated to that single line, then restored. The removal never produced
a resolvable timing gain; a clear is O(1) on a GPU backend and an OOM is not a
good trade on exactly the weak devices PERFORMANCE exists for.

**The shipping shell embedded a stale HUD payload.** `public/gold/*` is generated
by `tools/buildGoldCutover.mjs`, so hand-editing `public/gold/battle-hud.html`
was silently orphaned: the shell's `#battleHudPayload` still carried the old
bytes and the gate failed with `decoded=156959 hud=160233`. The HUD
graphics-quality consumer now lives in a source-owned adapter
(`tools/goldBattleHudGraphicsQuality.mjs`) that asserts its anchor exactly once
and refuses double application; `buildGoldCutover --check` is clean.
