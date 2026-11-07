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
  // CRYSTALA bloom wide halo. The bloom system exposes `composite`; the wide
  // pass is the third drawImage in it. Rather than reimplementing the pass we
  // hook the one flag the author already provides for the legacy path
  // (forceLegacyWide is the opposite direction), and instead gate the wide
  // draw by the alpha it uses: 0.25 * source. We keep it but skip the extra
  // destination blur filter, which is the expensive half.
  //
  // Implementation note: the bloom runtime reads `g.APEX_GRAPHICS_BLOOM_WIDE`
  // for the target filter; it defaults to 0 (off) and the renderer falls back
  // to the authored 9px string when it is absent. Setting it to 1 keeps the
  // exact original path. See crystalaGoldV6.js composite().
  function applyBloomFlag() {
    try {
      global.APEX_GRAPHICS_BLOOM_WIDE = perf() ? 0 : 1;
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
          P1_bloomWideFilter: { live: perf(), flag: global.APEX_GRAPHICS_BLOOM_WIDE },
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
