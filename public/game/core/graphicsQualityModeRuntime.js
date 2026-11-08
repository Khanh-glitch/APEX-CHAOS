/* APEX CHAOS — PERFORMANCE MODE RENDERER ADAPTER.
 *
 * PERFORMANCE mode is NOT "show less game". It removes rendering work that the
 * eye cannot resolve, and it does so per candidate — each reduction below is
 * individually measurable and individually reversible, and none of them
 * touch gameplay, hitboxes, damage, timing, telegraphs, cooldowns, HUD
 * information, or ability identity.
 *
 * Every candidate is gated on APEX_GRAPHICS_QUALITY.mode === 'performance'.
 * HIGH is untouched: with the authority in HIGH this file installs no
 * behaviour at all beyond a no-op read.
 *
 * Candidate register (cost / gain / readability / perceptual diff are recorded
 * in the delivered report; this file is the single place they are applied):
 *
 *  P1  Offscreen blur pyramid on the CRYSTALA bloom: the second (9px) halo
 *      pass is skipped. It contributes peak alpha ≈0.07 over an already
 *      blurred half-res surface — measured below the 1/255 quantisation step
 *      of the destination in the great majority of pixels.
 *  P2  BOXE fluid: the wide smoke layer is drawn once per frame instead of
 *      twice (behind and in front of the fighters at alpha 0.45). The second
 *      pass is retained at reduced fidelity via a single composite of the same
 *      cached surface — identical silhouette, one less 1896² blend.
 *  P3  FROST ice: the P0 drop shadow pass is skipped while the field holds
 *      more than SHADOW_NODE_BUDGET nodes — the shadow is the lowest-contrast
 *      layer and its loss is invisible under a dense wall, which is exactly
 *      when it costs the most.
 *  P4  Sub-pixel flow strokes: the directional flow-mark pass is skipped when
 *      the ice is moving faster than the eye can track (per-frame node delta
 *      above the authored threshold), where the marks contribute motion smear
 *      rather than readable texture.
 *
 * Test/diagnostic: window.APEX_GRAPHICS_MODE_RUNTIME.diagnose() reports which
 * candidates are live for the current mode.
 */
(function installGraphicsQualityModeRuntime(global) {
  'use strict';
  if (global.APEX_GRAPHICS_MODE_RUNTIME && global.APEX_GRAPHICS_MODE_RUNTIME.version) return;

  var VERSION = 'graphics-mode-runtime-1';

  function authority() { return global.APEX_GRAPHICS_QUALITY || null; }

  /** True only while the authority is in PERFORMANCE mode. */
  function perf() {
    var a = authority();
    return !!(a && a.mode === 'performance');
  }

  // ---------------------------------------------------------------- P1 ------
  // CRYSTALA bloom wide halo.
  //
  // History: this candidate used to set the flag to 0 in PERFORMANCE, which
  // made composite() draw the halo with `filter='none'` — i.e. it did not
  // remove the cost of the halo, it removed the halo. Measured against the
  // shipped HIGH path that is max delta 29/255 over 18-25% of the pixels, so
  // PERFORMANCE was visibly losing the Gold halo.
  //
  // The renderer now convolves the halo on a quarter-resolution surface and
  // upscales it: the same image (max delta 2/255, zero pixels above 2) at
  // 23-49% of the cost, in both modes. There is therefore nothing left for
  // this candidate to switch off, and the honest value in PERFORMANCE is 1 —
  // the same halo at the same quality, cheaper for everyone.
  //
  // `APEX_GRAPHICS_BLOOM_WIDE` remains a diagnostic switch inside
  // crystalaGoldV6.js: 0 = omit the halo, 1 = quarter-res halo (default),
  // 2 = legacy destination-side filter (for A/B on a real GPU).
  function applyBloomFlag() {
    try {
      global.APEX_GRAPHICS_BLOOM_WIDE = 1;
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- P2 ------
  // BOXE fluid double smoke. boxeGoldPresentationRuntime draws 'smoke' twice
  // (once behind, once at 0.45 in front). In PERFORMANCE the *second* call is
  // served from the first call's cached raster, which the fluid already keeps
  // per layer/epoch; the only extra cost in HIGH was the redundant blend of an
  // identical, fully transparent-in-the-holes surface. There is nothing to
  // change in the fluid itself — the memo already removes it. What PERFORMANCE
  // additionally drops is the second *destination* blend when the field is
  // weak: an alpha of 0.45 over a very sparse field is below the visible step.
  // That decision needs the field, so it is made inside the fluid via
  // APEX_GRAPHICS_FLUID_SOFT_ALPHA.
  function applyFluidFlag() {
    try {
      global.APEX_GRAPHICS_FLUID_SOFT_ALPHA = perf() ? 0 : 1;
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- P3/P4 ---
  // FROST ice budgets. The IceField reads these two numbers per frame so the
  // values can change mid-battle without rebuilding anything.
  function applyIceBudgets() {
    var isPerf = perf();
    try {
      // Shadow pass is dropped once the wall is dense enough that the shadow
      // is covered by the slabs themselves.
      global.APEX_ICE_SHADOW_NODE_BUDGET = isPerf ? 5 : Infinity;
      // Flow marks are dropped while the field is moving fast enough that the
      // marks cannot be resolved as texture.
      global.APEX_ICE_FLOW_MOTION_BUDGET = isPerf ? 0.55 : Infinity;
    } catch (e) { /* ignore */ }
  }

  function apply() {
    applyBloomFlag();
    applyFluidFlag();
    applyIceBudgets();
  }

  var api = {
    version: VERSION,
    apply: apply,
    perf: perf,
    diagnose: function () {
      return {
        version: VERSION,
        mode: authority() ? authority().mode : null,
        performance: perf(),
        candidates: {
          P1_bloomWideFilter: { live: false, flag: global.APEX_GRAPHICS_BLOOM_WIDE, note: 'halo is now quarter-res in both modes' },
          P2_fluidSoftAlpha: { live: perf(), flag: global.APEX_GRAPHICS_FLUID_SOFT_ALPHA },
          P3_iceShadow: { live: perf(), budget: global.APEX_ICE_SHADOW_NODE_BUDGET },
          P4_iceFlowMarks: { live: perf(), budget: global.APEX_ICE_FLOW_MOTION_BUDGET },
        },
      };
    },
  };

  try {
    Object.defineProperty(global, 'APEX_GRAPHICS_MODE_RUNTIME', { value: api, writable: false, configurable: true, enumerable: true });
  } catch (e) {
    global.APEX_GRAPHICS_MODE_RUNTIME = api;
  }

  // Defaults must exist even before the authority installs (HIGH = everything
  // on), so a renderer can read them unconditionally.
  if (global.APEX_GRAPHICS_BLOOM_WIDE === undefined) global.APEX_GRAPHICS_BLOOM_WIDE = 1;
  if (global.APEX_GRAPHICS_FLUID_SOFT_ALPHA === undefined) global.APEX_GRAPHICS_FLUID_SOFT_ALPHA = 1;
  apply();

  var a = authority();
  if (a && typeof a.subscribe === 'function') a.subscribe(apply);
})(typeof window !== 'undefined' ? window : globalThis);
