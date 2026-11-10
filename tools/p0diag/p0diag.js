/* =============================================================================
 * APEX CHAOS — P0 root-cause diagnosis (runs inside the real product page)
 *
 * WHAT THIS IS
 *   A self-contained instrument that a non-developer can start with one
 *   double-click on Windows. It boots the real game, plays the SAME
 *   CRYSTALA vs FROST match with the SAME cast sequence, and measures frame
 *   pacing while switching exactly one rendering subsystem off per arm.
 *
 *   It never edits the game. It is injected by the local server as one extra
 *   <script> tag and only uses APIs the product already exposes:
 *     window.APEX_GOLD                      — battle handoff + pressSkill
 *     window.APEX_GRAPHICS_QUALITY          — the quality authority
 *     window.__apexOwnerPerfProbe           — the product's own perf marks
 *     window.APEX_FROST_GOLD.IceField       — to switch the ice renderer off
 *     window.APEX_CRYSTALA_GOLD             — to switch the bloom off
 *
 * WHAT IT MEASURES (and what it refuses to claim)
 *   * rAF interval per frame — the real display pacing the owner sees.
 *   * update()+draw() per frame, from the engine's own mark.
 *   * Long tasks and Long Animation Frames (Chrome 123+) with attribution,
 *     which separate "main thread blocked" from "compositor late".
 *   * Per-skill VFX cost, split by family (FROST ice vs CRYSTALA bloom).
 *   * An ACTIVATION PROOF for every arm: counters that must move by the
 *     expected amount. An arm whose proof fails is reported invalid instead
 *     of being quietly included in the averages.
 *
 *   It does NOT report FPS and does not claim any optimisation worked. Its
 *   only output is evidence: which subsystem's cost tracks the stutter.
 * ========================================================================== */
(function () {
  'use strict';
  if (window.__P0DIAG__) return;

  var VERSION = 'p0diag-1';
  var CFG = {
    warmupFrames: 24,        // discarded: first frames pay JIT + first paint
    warmupMs: 4000,          // ... but warmup may not eat the whole arm
    armFrames: 220,          // measured frames per arm, upper bound
    // A shorter sample is not a sample. The self-test may lower this (via
    // ?p0minframes=) purely to exercise the proof/verdict path on a machine
    // that is far too slow to produce 24 frames per arm; a real run never
    // passes the parameter, and the value used is written into the report.
    minArmFrames: 24,
    armMs: 16000,            // ... and the arm ends here even if frames are slow
    armTailFrames: 2,        // settle after switching arms
    castEvery: 14,           // fixed cast cadence, in frames
    burstEvery: 56,          // simultaneous casts from both heroes
    armTimeoutMs: 120000,    // safety net only; the arm should end on armMs
    boot: {
      startBtn: '#apex-boot-start',
      battleBtn: '#freeBattle',
    },
  };

  // Self-test affordance only: lowering the frame floor must be explicit and
  // is recorded, so a report can never quietly claim a thicker sample than it
  // actually had.
  try {
    var qMin = new URLSearchParams(location.search).get('p0minframes');
    if (qMin && isFinite(Number(qMin))) {
      CFG.minArmFrames = Math.max(3, Math.min(240, Number(qMin)));
      CFG.minArmFramesOverridden = true;
    }
  } catch (e) {}

  var log = [];
  function say(msg) {
    log.push({ t: Math.round(performance.now()), msg: String(msg) });
    try { console.log('[p0diag] ' + msg); } catch (e) {}
  }

  // ---------------------------------------------------------------- helpers --
  function median(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; });
    return s[Math.floor(s.length / 2)];
  }
  function pct(a, p) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; });
    return s[Math.min(s.length - 1, Math.floor(p * s.length))];
  }
  function r2(v) { return (v == null || !isFinite(v)) ? null : Math.round(v * 100) / 100; }
  function stats(a) {
    if (!a || !a.length) return { n: 0 };
    var s = a.slice().sort(function (x, y) { return x - y; });
    var sum = 0; for (var i = 0; i < s.length; i++) sum += s[i];
    return {
      n: s.length,
      p50: r2(pct(s, 0.5)), p95: r2(pct(s, 0.95)), p99: r2(pct(s, 0.99)),
      max: r2(s[s.length - 1]), min: r2(s[0]), mean: r2(sum / s.length),
      total: r2(sum),
    };
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function waitFor(pred, timeoutMs, label) {
    var t0 = performance.now();
    return new Promise(function (resolve, reject) {
      (function poll() {
        var v = null;
        try { v = pred(); } catch (e) { v = null; }
        if (v) return resolve(v);
        if (performance.now() - t0 > timeoutMs) return reject(new Error('timeout waiting for ' + label));
        setTimeout(poll, 50);
      })();
    });
  }
  function nextFrame() {
    return new Promise(function (r) { requestAnimationFrame(function () { r(performance.now()); }); });
  }

  // ------------------------------------------------------------ environment --
  function deviceInfo() {
    var info = {
      userAgent: navigator.userAgent,
      platform: navigator.platform || null,
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      deviceMemoryGB: navigator.deviceMemory || null,
      devicePixelRatio: window.devicePixelRatio || 1,
      viewportCss: [window.innerWidth, window.innerHeight],
      screenCss: [screen.width, screen.height],
      reducedMotion: !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches),
      // The single most important fact for interpreting the numbers: is there
      // a real GPU, or is this a software rasteriser?
      webgl: null,
      webgpu: null,
      canvasRect: null,
    };
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl');
      if (gl) {
        var dbg = gl.getExtension('WEBGL_debug_renderer_info');
        info.webgl = {
          vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
          renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
          maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
          version: gl.getParameter(gl.VERSION),
        };
      }
    } catch (e) { info.webgl = { error: String(e && e.message) }; }
    try {
      var gcv = document.getElementById('game-canvas');
      if (gcv) {
        var rc = gcv.getBoundingClientRect();
        info.canvasRect = {
          css: [Math.round(rc.width), Math.round(rc.height)],
          backing: [gcv.width, gcv.height],
          devicePx: [Math.round(rc.width * info.devicePixelRatio), Math.round(rc.height * info.devicePixelRatio)],
        };
      }
    } catch (e) {}
    return info;
  }

  // Does this browser emit Long Animation Frames? It is the only API that
  // separates "our JS blocked the frame" from "the compositor was late".
  function loafSupport() {
    try {
      if (typeof PerformanceObserver !== 'function') return false;
      var types = PerformanceObserver.supportedEntryTypes || [];
      return types.indexOf('long-animation-frame') !== -1;
    } catch (e) { return false; }
  }

  // --------------------------------------------------------- recorders ------
  // Long tasks and LoAF are global (they follow the whole page), so they are
  // collected continuously and attributed to the arm that was active when the
  // entry's startTime fell.
  var longTasks = [];          // {start, dur}
  var loafEntries = [];        // {start, dur, renderStart, renderDur, styleLayout, blocking, scripts}
  var observers = [];
  function startObservers() {
    try {
      var o1 = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (e) { longTasks.push({ start: e.startTime, dur: e.duration }); });
      });
      o1.observe({ entryTypes: ['longtask'] });
      observers.push(o1);
    } catch (e) { say('longtask observer unavailable: ' + e.message); }
    if (loafSupport()) {
      try {
        var o2 = new PerformanceObserver(function (list) {
          list.getEntries().forEach(function (e) {
            var scripts = (e.scripts || []).map(function (s) {
              return {
                name: s.name || null, dur: r2(s.duration),
                inv: r2(s.invoker), type: s.invokerType || null, fn: s.sourceFunctionName || null,
                before: r2(s.forcedStyleAndLayoutDuration),
              };
            });
            loafEntries.push({
              start: r2(e.startTime), dur: r2(e.duration),
              renderStart: r2(e.renderStart), styleLayoutStart: r2(e.styleAndLayoutStart),
              blocking: r2(e.blockingDuration),
              styleLayoutDur: (e.renderStart > 0) ? r2(e.startTime + e.duration - e.renderStart) : null,
              scripts: scripts.slice(0, 6),
            });
          });
        });
        o2.observe({ type: 'long-animation-frame', buffered: true });
        observers.push(o2);
      } catch (e) { say('LoAF observer failed: ' + e.message); }
    }
  }
  function stopObservers() {
    observers.forEach(function (o) { try { o.disconnect(); } catch (e) {} });
    observers = [];
  }

  // The product's own perf marks. Installing this shim is how the engine and
  // the two presentation runtimes start timing themselves — no source edit and
  // no behaviour change (every call site is already guarded by `?.active`).
  var marks = null;
  function resetMarks() {
    marks = {
      frameTotal: [], skill: [], iceClear: [], iceRender: [], iceBlit: [],
      frostTick: [], hero: {}, counts: { skill: 0, bloom: 0, ice: 0 },
    };
  }
  function installProbe() {
    resetMarks();
    window.__apexOwnerPerfProbe = {
      active: true,
      markIceClear: function (ms) { marks.iceClear.push(ms); },
      markIceRender: function (ms) { marks.iceRender.push(ms); },
      markIceBlit: function (ms) { marks.iceBlit.push(ms); },
      markFrostTick: function (ms) { marks.frostTick.push(ms); },
      markHeroRender: function (id, ms) {
        (marks.hero[id] || (marks.hero[id] = [])).push(ms);
      },
      markFrameTotal: function (ms) { marks.frameTotal.push(ms); },
      markSkillActivation: function (kind, ms, detail) {
        marks.counts.skill++;
        if (kind === 'crystala-bloom') marks.counts.bloom++;
        if (kind && kind.indexOf('frost-ice') === 0) marks.counts.ice++;
        marks.skill.push({ kind: kind, ms: r2(ms), detail: detail || null });
      },
    };
  }
  function uninstallProbe() { try { delete window.__apexOwnerPerfProbe; } catch (e) { window.__apexOwnerPerfProbe = undefined; } }

  // ------------------------------------------------------------- arms -------
  // Each arm patches exactly one subsystem and reports a count of how many
  // times the patch was actually hit. `expect` documents what the counter
  // proves: an arm with 0 hits is not evidence of anything.
  function makeArms() {
    var state = {};

    // ── ICE ──────────────────────────────────────────────────────────────
    // Reading drawIceComposite (frostPresentationRuntime ~1781) shows what the
    // per-frame work actually is:
    //     clearRect(dirty-rect) -> ice.render(offscreen) -> blit -> mark
    // The first attempt switched off renderSurfaceUnderWeapons whole, which
    // ALSO removed the frosted-wet pass, the A1 macro front and the ambient
    // floor shapes -- that is "FROST VFX off", not "ice off".
    //
    // The ice-specific part is `IceField.prototype.render` painting field
    // geometry onto the offscreen surface. Overriding just that call keeps the
    // dirty-rect clear (so the surface is genuinely emptied rather than frozen
    // with stale paint), keeps drawWet and drawA1MacroFront, and keeps every
    // other renderer in that pass. Because render() returns false, the
    // product's own `if (painted)` guard skips the blit.
    // Hero runtimes are loaded on demand: on the BOT path the frost module can
    // still be loading when an arm starts, so a patch attempted once at arm
    // entry finds nothing and the arm proves nothing. The waiters below retry
    // until the API appears (or the arm ends), and each arm reports whether its
    // seam was ever installed instead of silently measuring an unpatched build.
    function waitForApi(pick, cb) {
      var stop = false;
      (function attempt(n) {
        if (stop) return;
        var api = null;
        try { api = pick(); } catch (e) { api = null; }
        if (api) { cb(api); return; }
        if (n >= 600) return;                  // ~60 s at 100 ms; arm ends first
        setTimeout(function () { attempt(n + 1); }, 100);
      })(0);
      return function () { stop = true; };
    }

    function patchIce() {
      var G = window.APEX_FROST_GOLD;
      if (!G || !G.IceField || !G.IceField.prototype) return null;
      var proto = G.IceField.prototype;
      var orig = proto.render;
      state.ice = { hits: 0, inkSamples: [], paintedFalse: 0 };
      proto.render = function (ic) {
        state.ice.hits++;
        // Sample the offscreen surface right here: the product calls render()
        // immediately after clearing it, so this reads what the blit WOULD
        // have sent to the arena.
        // Pixel readback is a GPU synchronization point on Windows/ANGLE.
        // Sampling on EVERY frame substantially inflates the noIce JS work
        // and contaminates the A/B p95. Keep a small spread-out proof sample
        // without doing a GPU readback on the other ~98% of measured frames.
        // The no-blit proof remains independently checked via product marks.
        if (state.ice.hits === 1 || state.ice.hits % 64 === 0) {
          try {
            var inkPx = iceInkOfCtx(ic);
            if (inkPx != null) state.ice.inkSamples.push(inkPx);
          } catch (e) {}
        }
        state.ice.paintedFalse++;
        return false;
      };
      return function () { proto.render = orig; };
    }

    // ── BLOOM ────────────────────────────────────────────────────────────
    // The old arm suppressed markSkillActivation('crystala-bloom'): a
    // measurement callback. The renderer kept compositing. Now the arm blocks
    // bloom.begin(), which is exactly the call renderBloomRegion() guards on
    // (`const gx = bloom.begin(...); if (!gx) return null;`), so the emissive
    // source is never painted and no composite is attempted.
    function patchBloom() {
      state.bloom = { pixelDelta: null };
      // Pixel proof that the blocked path is the one that paints: the same
      // source rendered through the real path and the blocked path.
      try {
        var G = window.APEX_CRYSTALA_GOLD;
        var probe = G.createBloomSystem({ width: 120, height: 120, scale: 0.5 });
        if (probe) {
          state.bloom.probe = probe;
          var mk = function () {
            var c = document.createElement('canvas');
            c.width = 120; c.height = 120;
            var x = c.getContext('2d', { willReadFrequently: true });
            x.fillStyle = '#0e141b'; x.fillRect(0, 0, 120, 120);
            return x;
          };
          var A = mk(), B = mk();
          var region = { x: 30, y: 30, w: 60, h: 60 };

          bloomSeam.off = false;                       // real path, one call
          var gxA = probe.begin(null, region);
          if (gxA) {
            gxA.fillStyle = 'rgba(255,214,120,0.95)';
            gxA.beginPath(); gxA.arc(60, 60, 22, 0, Math.PI * 2); gxA.fill();
          }
          probe.composite(A, 120, 120, region);

          bloomSeam.off = true;                        // suppressed path
          var gxB = probe.begin(null, region);
          if (gxB) {
            gxB.fillStyle = 'rgba(255,214,120,0.95)';
            gxB.beginPath(); gxB.arc(60, 60, 22, 0, Math.PI * 2); gxB.fill();
          }
          probe.composite(B, 120, 120, region);

          try {
            var da = A.getImageData(0, 0, 120, 120).data;
            var db = B.getImageData(0, 0, 120, 120).data;
            var diff = 0;
            for (var i = 0; i < da.length; i += 4) {
              if (Math.abs(da[i] - db[i]) > 3 || Math.abs(da[i + 1] - db[i + 1]) > 3
                || Math.abs(da[i + 2] - db[i + 2]) > 3 || Math.abs(da[i + 3] - db[i + 3]) > 3) diff++;
            }
            state.bloom.pixelDelta = { changedPx: diff, totalPx: 120 * 120 };
          } catch (e) { say('bloom pixel A/B failed: ' + (e && e.message)); }
        }
      } catch (e) { say('bloom probe failed: ' + (e && e.message)); }
      return function () { bloomSeam.off = false; state.bloom.probe = null; };
    }

    // ── AUX ──────────────────────────────────────────────────────────────
    // Ambient decoration only: these carry no gameplay state.
    function patchAux() {
      var G = window.APEX_FROST_GOLD;
      if (!G) return null;
      var names = ['drawFloorShapes', 'drawAirShapes', 'drawRibbonLayer', 'frostBulletFleck'];
      var saved = {};
      state.aux = { hits: 0, patched: [] };
      names.forEach(function (n) {
        if (typeof G[n] === 'function') {
          saved[n] = G[n];
          state.aux.patched.push(n);
          G[n] = function () { state.aux.hits++; };
        }
      });
      return function () { Object.keys(saved).forEach(function (n) { G[n] = saved[n]; }); };
    }

    return {
      full:    { id: 'full',    label: 'full gameplay (control)',      apply: function () { return function () {}; } },
      noIce:   { id: 'noIce',   label: 'FROST ice field paint off',    apply: patchIce,  expect: 'ice' },
      noBloom: { id: 'noBloom', label: 'CRYSTALA bloom render off',    apply: patchBloom, expect: 'bloom' },
      noAux:   { id: 'noAux',   label: 'auxiliary ambient VFX off',    apply: patchAux,  expect: 'aux' },
      state: state,
    };
  }

  // ------------------------------------------------------------ cast plan ---
  // Deterministic by FRAME INDEX, so every arm receives the identical cast
  // sequence even if one arm runs slower than another.
  var castStats = null;
  function freshCastStats() {
    return { presses: 0, confirmed: 0, refused: 0, byReason: {}, bySlot: {} };
  }

  // The cast authority (APEX_HERO_REWORK.pressAbility -> tryCast) returns
  // { ok, reason }. That verdict is the product's own statement that the
  // ability fired, so it is the activation proof -- call counts are not.
  // Cooldown refusals are EXPECTED at this cadence and are reported separately
  // instead of being read as success.
  function pressAndRecord(api, side, slot, stats) {
    var res = null, err = null;
    try {
      var f = (window.fighters || [])[side];
      var HR = window.APEX_HERO_REWORK;
      if (HR && typeof HR.pressAbility === 'function' && f) {
        res = HR.pressAbility(f, slot === 1 ? 'A2' : 'A1',
          { side: side === 1 ? 'p2' : 'p1', source: 'pointer' });
      } else {
        api.pressSkill(side, slot);
        res = { ok: null, reason: 'no-authority' };
      }
    } catch (e) { err = String(e && e.message); }

    stats.presses++;
    var ok = !!(res && res.ok === true);
    var reason = (res && res.reason) || (err ? 'threw:' + err : 'unknown');
    if (ok) stats.confirmed++;
    else { stats.refused++; stats.byReason[reason] = (stats.byReason[reason] || 0) + 1; }
    var key = 'side' + side + '.slot' + slot;
    var b = stats.bySlot[key] || (stats.bySlot[key] = { ok: 0, refused: 0 });
    if (ok) b.ok++; else b.refused++;
    return ok;
  }

  // Which (side, slot) pairs the game says are castable right now, straight
  // from its own debug state -- no guessing about cooldowns.
  function readyCasts() {
    var out = [];
    try {
      var HR = window.APEX_HERO_REWORK;
      var dbg = HR && typeof HR.debugState === 'function' ? HR.debugState() : null;
      var cts = (dbg && dbg.combatants) || [];
      cts.forEach(function (c, idx) {
        var side = c.side === 'p1' ? 0 : (c.side === 'p2' ? 1 : idx);
        ['A1', 'A2'].forEach(function (k, si) {
          var sk = (c.skills || {})[k];
          if (sk && (sk.cd === 0 || sk.cd == null)) out.push({ side: side, slot: si });
        });
      });
    } catch (e) {}
    return out;
  }

  // Deterministic by FRAME INDEX, so every arm receives the identical cast
  // sequence even if one arm runs slower than another.
  function castAt(api, i, stats) {
    var fired = 0;
    function press(side, slot) { pressAndRecord(api, side, slot, stats); fired++; }
    if (i > 0 && i % CFG.burstEvery === 0) {
      press(0, 0); press(0, 1); press(1, 0); press(1, 1);
      return fired;
    }
    if (i % CFG.castEvery === 0) press(0, 0);                    // CRYSTALA A1
    if (i % CFG.castEvery === 5) press(1, 0);                    // FROST  A1
    if (i % CFG.castEvery === 9) press(0, 1);                    // CRYSTALA A2
    if (i % CFG.castEvery === 11) press(1, 1);                   // FROST  A2
    return fired;
  }

  // --------------------------------------------------------------- one arm --
  function runArm(arm, index, total) {
    return new Promise(function (resolve) {
      var arms = makeArms();
      var api = window.APEX_GOLD;
      var armObj = arms[arm];
      var restore = null;
      var err = null;
      try { restore = armObj.apply(); } catch (e) { err = String(e && e.message); }

      // Reset per-arm collectors. Marks are reset AFTER the patch is applied so
      // the arm's counters describe only this arm.
      resetMarks();
      castStats = freshCastStats();
      // castStats is per-arm; runState.* are the independent cumulative counters
      // and are accumulated at the end of the arm -- never reset here, so a
      // late cast-free arm cannot wipe casts confirmed in earlier arms.
      bloomSeam.beginBlocked = 0;
      bloomSeam.compositeCalls = 0;
      if (arm === 'noBloom') bloomSeam.off = true;
      // Accumulate at run level: whether the GAME cast anything is a property
      // of the session, not of one 16-second window.
      var armStart = performance.now();

      var frames = [];          // rAF intervals
      var frameMarks = [];      // rAF timestamps for alignment
      var pressed = 0;
      var last = 0;
      var n = 0;
      var warm = CFG.warmupFrames;
      var measured = CFG.armFrames;
      var done = false;
      // Frame-COUNTED arms are a trap when the machine is slow: on a software
      // rasteriser one frame can take 1.3 s, so 96 frames outlives the timeout
      // and every arm reports "timeout" although the match ran fine. The arm
      // therefore ends on TIME, and the frame count is whatever fits -- with a
      // floor so an obviously-thin sample is rejected instead of averaged.
      var armDeadlineMs = CFG.armMs;
      // An arm must end even when requestAnimationFrame stops calling back
      // entirely (throttled tab, lost context, a wedged renderer). Without this
      // the promise never settles and the tool looks hung.
      var deadline = setTimeout(function () {
        if (!done) { done = true; resolve(finish('deadline')); }
      }, Math.max(CFG.armMs + 4000, CFG.minArmFrames * 50));
      var hardStop = setTimeout(function () {
        if (!done) { done = true; resolve(finish('timeout')); }
      }, CFG.armTimeoutMs);

      function finish(reason) {
        clearTimeout(hardStop);
        clearTimeout(deadline);
        if (restore) { try { restore(); } catch (e) {} }
        // Collect the marks BEFORE uninstalling so nothing is lost.
        var res = {
          id: armObj.id,
          label: armObj.label,
          index: index,
          order: index + 1 + '/' + total,
          reason: reason,
          error: err,
          durationMs: r2(performance.now() - armStart),
          framesMeasured: frames.length,
          pressesIssued: pressed,
          cast: {
            presses: castStats.presses,
            confirmed: castStats.confirmed,
            refused: castStats.refused,
            byReason: castStats.byReason,
            bySlot: castStats.bySlot,
          },
          raf: stats(frames),
          // The discriminator. If JS work is a small fraction of the frame
          // interval, the frame is late for compositor/GPU reasons, not
          // because our code is slow.
          jsWork: stats(marks.frameTotal),
          jsShareOfFramePct: (frames.length && marks.frameTotal.length)
            ? r2((median(marks.frameTotal) / median(frames)) * 100) : null,
          ice: {
            clear: stats(marks.iceClear), render: stats(marks.iceRender), blit: stats(marks.iceBlit),
          },
          frostTick: stats(marks.frostTick),
          heroRender: Object.keys(marks.hero).reduce(function (acc, k) { acc[k] = stats(marks.hero[k]); return acc; }, {}),
          skill: {
            count: marks.counts.skill,
            bloomPasses: marks.counts.bloom,
            iceComposites: marks.counts.ice,
            vfxMs: stats(marks.skill.map(function (s) { return s.ms; })),
            kinds: marks.skill.reduce(function (acc, s) {
              acc[s.kind] = (acc[s.kind] || 0) + 1; return acc;
            }, {}),
          },
          // Long tasks / LoAF that STARTED inside this arm's window.
          longTasks: summarizeWindow(longTasks, armStart, performance.now()),
          loaf: summarizeLoaf(armStart, performance.now()),
          activationProof: null,
          valid: false,
        };
        // ── PROOFS ───────────────────────────────────────────────────────
        // Two facts per arm: the entry point was live, and the render target it
        // claims to remove really stopped. A counter on a measurement callback
        // is not evidence; a pixel measurement and a real composite count are.
        var ctlPeak = runState.controlIceInk || 0;

        if (armObj.id === 'full') {
          var fullInk = 0;
          try {
            var engFull = findFrostEngine();
            fullInk = engFull ? iceInkOfCtx(engFull.iceCanvas) : 0;
          } catch (e) {}
          res.activationProof = {
            claim: 'nothing patched: ice paints and bloom composites',
            iceInkAtEnd: fullInk,
            controlIceInk: ctlPeak || null,
            iceComposites: res.skill.iceComposites,
            bloomPasses: res.skill.bloomPasses,
            ok: res.skill.bloomPasses > 0 || res.skill.iceComposites > 0,
          };
        } else if (armObj.id === 'noIce') {
          var st = arms.state.ice || {};
          var series = st.inkSamples || [];
          var inkMax = series.length ? Math.max.apply(null, series) : null;
          // A FROST-side arm is only meaningful when FROST is actually in the
          // match. The production BOT path pairs the player against its own CPU
          // pick (HUNTER on this build) and refuses a FROST opponent by design,
          // so the frost renderer is never created and there is nothing to
          // switch off. That is an INAPPLICABLE arm, not a failed one, and the
          // difference matters: reporting it as invalid would suggest the patch
          // broke, while reporting it as valid would fabricate evidence.
          // Decided from whether the seam was EVER installed during this arm,
          // not from whether the module happens to exist at report time: a late
          // load would otherwise rewrite the meaning of an arm after the fact.
          var frostPresent = !!(window.APEX_FROST_GOLD && window.APEX_FROST_GOLD.IceField);
          res.applicable = frostPresent || !!(st && st.hits);
          res.inapplicableReason = res.applicable ? null
            : 'FROST is not in this match, so there is no ice renderer to isolate';
          res.activationProof = {
            claim: 'only IceField.render is off: the ice surface must stay empty',
            renderIntercepted: st.hits || 0,
            paintedFalse: st.paintedFalse || 0,
            castsConfirmedDuringArm: castStats.confirmed,
            castsConfirmedInRun: runState.castsConfirmed,
            iceSurfaceInkMaxPx: inkMax,
            iceSurfaceInkSamples: series.length,
            controlIceInk: ctlPeak || null,
            // The product's own mark, quoted for the record. markIceRender fires
            // right after render() whether or not it painted, so that count
            // proves the call happened, NOT that pixels were drawn.
            // markIceBlit is inside the `if (painted)` branch, so 0 blits IS
            // evidence.
            iceRenderMarks: res.ice.render.n,
            iceBlitMarks: res.ice.blit.n,
            frostTickRan: res.frostTick.n > 0,
            // Whether the SESSION cast anything is a run-level fact, and it is
            // checked there (see the summary). Requiring a cast inside this
            // particular window was wrong: ice keeps being drawn for as long as
            // field nodes exist, so an arm can legitimately be full of ice work
            // with no fresh cast. What this arm must prove is that the surface
            // was empty while the field was live, and that the control proves
            // the same surface paints when unpatched.
            // Whether the SESSION managed to land a cast is recorded, and the
            // summary refuses to conclude without one. It is NOT folded into
            // this arm's verdict, because ice keeps being drawn for as long as
            // field nodes exist: the arm can be full of ice work with no fresh
            // cast, and the pixel evidence below is what actually proves the
            // patch worked.
            ok: res.applicable && (st.hits || 0) > 0
              && res.ice.blit.n === 0
              && ctlPeak > 0
              && inkMax != null && inkMax <= Math.max(2, ctlPeak * 0.02)
              && res.frostTick.n > 0,
          };
        } else if (armObj.id === 'noBloom') {
          var bs = arms.state.bloom || {};
          res.activationProof = {
            claim: 'bloom.begin blocked: the emissive pass is never drawn',
            systemsBuilt: bloomSeam.systems,
            beginCallsBlocked: bloomSeam.beginBlocked,
            compositeCallsSuppressed: bloomSeam.compositeCalls,
            bloomPixelChangedPx: (bs.pixelDelta && bs.pixelDelta.changedPx) || 0,
            bloomPixelTotal: (bs.pixelDelta && bs.pixelDelta.totalPx) || null,
            // The product's pass marks keep running (it still walks emitters);
            // that is expected and is NOT the render.
            productPassMarks: res.skill.bloomPasses,
            ok: bloomSeam.systems > 0
              // begin() was reached by the product's own render path and
              // refused, so no emissive source was painted...
              && bloomSeam.beginBlocked > 0
              // ...and nothing was blitted (begin()==null short-circuits).
              && bloomSeam.compositeCalls === 0
              // The blocked path is visibly different from the real one.
              && (bs.pixelDelta && bs.pixelDelta.changedPx > 0),
          };
        } else if (armObj.id === 'noAux') {
          var as = arms.state.aux || {};
          // Same rule as noIce: these entry points belong to the FROST
          // presentation layer, which does not exist when FROST is not in the
          // match (the BOT path never pairs a FROST CPU on this build).
          var aspectPatched = as.patched || as.patchedEntryPoints || [];
          var auxPresent = !!(aspectPatched.length || as.hits);
          res.applicable = auxPresent;
          res.inapplicableReason = auxPresent ? null
            : 'FROST is not in this match, so its ambient draw entry points do not exist';
          res.activationProof = {
            claim: 'ambient draw entry points intercepted; must be called',
            intercepted: as.hits || 0,
            patchedEntryPoints: aspectPatched,
            ok: auxPresent && (as.hits || 0) > 0 && aspectPatched.length > 0,
          };
        }
        runState.castsConfirmed += castStats.confirmed;
        runState.castsPressed += castStats.presses;
        // An arm that could not apply is neither valid nor invalid: it simply
        // has no evidence to give. Keeping it out of the valid count is what
        // stops an empty match from looking like a successful isolation.
        var inapplicable = res.applicable === false;
        var proofsOk = !!res.activationProof && res.activationProof.ok === true;
        var enoughFrames = frames.length >= CFG.minArmFrames;
        res.valid = !inapplicable && proofsOk && enoughFrames;
        // Say WHY, in the report, instead of leaving a bare false.
        var reasons = [];
        if (inapplicable) reasons.push('inapplicable: ' + (res.inapplicableReason || 'subsystem absent'));
        if (!inapplicable && !proofsOk) reasons.push('activation not proven');
        if (!enoughFrames) reasons.push('only ' + frames.length + ' frames (need ' + CFG.minArmFrames + ')');
        if (reasons.length) res.invalidBecause = reasons.join('; ');
        say('arm ' + res.id + ' done: ' + reason + ' frames=' + frames.length + ' valid=' + res.valid
          + (res.invalidBecause ? ' (' + res.invalidBecause + ')' : ''));
        return res;
      }

      var measuring = false;
      function tick(ts) {
        if (done) return;
        // Warmup ends on frames OR on time, whichever comes first. On a slow
        // rasteriser 24 frames can take longer than the whole arm, which would
        // leave zero measured frames and make a real run look like a failure.
        if (!measuring && (n >= warm || (performance.now() - armStart) >= CFG.warmupMs)) {
          measuring = true;
          say('  measuring from frame ' + n + ' (' + Math.round(performance.now() - armStart) + ' ms in)');
          // Every arm gets the same priming burst, so no arm depends on the
          // frame cadence happening to land on an off-cooldown cast. Without it
          // a slow machine can finish an arm with zero confirmed casts purely
          // because cooldowns had not expired, and the proof would be
          // uninterpretable through no fault of the subsystem under test.
          (function prime(attempt) {
            if (done || castStats.confirmed > 0) return;
            // Ask the game who can actually cast before pressing. On a slow
            // machine FROST's A1 holds a long cooldown while CRYSTALA's is
            // free, and blindly pressing the busy side burns the whole arm.
            var ready = readyCasts();
            ready.forEach(function (r) { pressAndRecord(api, r.side, r.slot, castStats); });
            if (!ready.length) {
              try { pressAndRecord(api, 1, 0, castStats); } catch (e) {}
              try { pressAndRecord(api, 0, 0, castStats); } catch (e) {}
            }
            var left = CFG.armMs - (performance.now() - armStart);
            if (left > 3000) setTimeout(function () { prime(attempt + 1); }, 400);
          })(0);
        }
        if (measuring && last) {
          frames.push(ts - last);
          frameMarks.push(Math.round(ts));
        }
        last = ts;
        n++;
        if (measuring) {
          pressed += castAt(api, frames.length, castStats);
          var elapsed = performance.now() - armStart;
          if (frames.length >= measured) { done = true; return resolve(finish('frame-budget')); }
          // Time always ends the arm, even when too few frames arrived: a thin
          // sample must be REPORTED as invalid, never turn into a hang and
          // never be silently averaged.
          if (elapsed >= armDeadlineMs) { done = true; return resolve(finish('time-budget')); }
        } else if ((performance.now() - armStart) >= CFG.warmupMs) {
          // Warmup expired with almost no frames and none of them are measured
          // yet: end the arm honestly instead of spinning here forever.
          if (frames.length === 0 && (performance.now() - armStart) >= CFG.armMs) {
            done = true; return resolve(finish('no-frames'));
          }
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  function summarizeWindow(list, t0, t1) {
    var inWindow = list.filter(function (e) { return e.start >= t0 && e.start <= t1; });
    var durs = inWindow.map(function (e) { return e.dur; });
    return {
      count: inWindow.length,
      durations: stats(durs),
      over50: durs.filter(function (d) { return d > 50; }).length,
      over100: durs.filter(function (d) { return d > 100; }).length,
    };
  }
  function summarizeLoaf(t0, t1) {
    var inWindow = loafEntries.filter(function (e) { return e.start >= t0 && e.start <= t1; });
    var byType = {};
    var scriptTotal = 0;
    inWindow.forEach(function (e) {
      (e.scripts || []).forEach(function (s) {
        var key = s.type || 'unknown';
        byType[key] = r2((byType[key] || 0) + (s.dur || 0));
        scriptTotal += (s.dur || 0);
      });
    });
    return {
      count: inWindow.length,
      duration: stats(inWindow.map(function (e) { return e.dur; })),
      blocking: stats(inWindow.map(function (e) { return e.blocking; })),
      // Time between the frame starting and rendering starting: this is the
      // main-thread cost. Everything after it is presentation.
      preRender: stats(inWindow.map(function (e) {
        return (e.renderStart > 0) ? (e.renderStart - e.start) : null;
      }).filter(function (v) { return v != null; })),
      scriptByInvokerType: byType,
      scriptTotalMs: r2(scriptTotal),
      worst: inWindow.slice().sort(function (a, b) { return b.dur - a.dur; }).slice(0, 3),
    };
  }

  // ----------------------------------------------------------------- boot ---
  // The first-run guide can put a modal question in front of everything. It is
  // part of the product, so the tool answers it through the same custom event
  // the buttons dispatch instead of hiding it or editing storage.
  async function clearTutorialAsk() {
    var ask = document.querySelector('.apex-tutorial-ask');
    if (!ask) return false;
    var btn = ask.querySelector('.apex-tutorial-ask-no') || ask.querySelector('.apex-tutorial-ask-yes');
    if (btn) { btn.click(); } else {
      try { window.dispatchEvent(new CustomEvent('apex:tutorial-answer', { detail: { enable: false } })); } catch (e) {}
    }
    say('answered the tutorial prompt (no)');
    await sleep(250);
    return true;
  }

  // ── unlock without reading the owner's data ───────────────────────────
  // A fresh profile owns only ROBOT/HUNTER, so the product's own gate
  // (APEX_GOLD_LOCKED -> meta.canPublicSelect) refuses CRYSTALA vs FROST and
  // no match can start. Seeding ownership would change the save being
  // measured; copying the owner's browser profile is not acceptable either.
  //
  // The product already has a supported answer: the owner-playtest session.
  // meta.adminTestSelectionUnlocked() opens the CURRENT production playable
  // roster while that session is active and expires with it. It grants no
  // ownership and writes nothing. The session is opened through the owner's own
  // UI (Ctrl+Shift+F8 and the product's passcode), not by poking internals.
  function unlockPlaytestRoster(p1, p2) {
    var out = { active: false, via: null, locked: [], steps: [] };
    function lockState() {
      var l = [];
      try {
        if (typeof window.APEX_GOLD_LOCKED === 'function') {
          if (window.APEX_GOLD_LOCKED(p1)) l.push(p1);
          if (p2 !== p1 && window.APEX_GOLD_LOCKED(p2)) l.push(p2);
        }
      } catch (e) { out.error = String(e && e.message); }
      return l;
    }
    out.locked = lockState();

    if (!out.locked.length) { out.active = true; out.via = 'already unlocked'; return out; }

    try {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        code: 'F8', key: 'F8', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
      }));
      out.steps.push('Ctrl+Shift+F8');
    } catch (e) { out.steps.push('keystroke failed: ' + e.message); }

    var form = document.querySelector('#apex-owner-password-panel form')
      || document.querySelector('form[aria-label="Owner playtest password"]');
    var field = form && form.querySelector('input');
    if (field) {
      field.value = '500509';
      var submit = form.querySelector('button[type="submit"]') || form.querySelector('button');
      if (submit) submit.click(); else if (form.requestSubmit) form.requestSubmit();
      out.steps.push('entered the product passcode through its own panel');
    } else {
      out.steps.push('password panel not found');
    }
    out.via = 'owner-playtest session';
    return out;
  }

  // ── which scenario is this? ───────────────────────────────────────────
  // The two entry modes are NOT the same workload, so they are separate runs
  // and are never averaged together:
  //   ?p0scenario=bot         production BOT path (product picks the opponent)
  //   ?p0scenario=local-perf  LOCAL 1v1 held at PERFORMANCE quality
  //   ?p0scenario=local-high  LOCAL 1v1 held at HIGH quality  <- control
  function readScenario() {
    var q = '';
    try { q = new URLSearchParams(location.search).get('p0scenario') || ''; } catch (e) {}
    if (q === 'bot') return { id: 'bot', label: 'BOT match (production path)', mode: 'bot', quality: null };
    if (q === 'local-perf') return { id: 'local-perf', label: 'LOCAL 1v1, PERFORMANCE quality', mode: 'local', quality: 'performance' };
    if (q === 'boxe-frost-perf') return { id: 'boxe-frost-perf', label: 'BOXE vs FROST, PERFORMANCE', mode: 'local', quality: 'performance', p1: 'boxe', p2: 'frost' };
    if (q === 'boxe-frost-high') return { id: 'boxe-frost-high', label: 'BOXE vs FROST, HIGH', mode: 'local', quality: 'high', p1: 'boxe', p2: 'frost' };
    return { id: 'local-high', label: 'LOCAL 1v1, HIGH quality (control)', mode: 'local', quality: 'high' };
  }

  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return false;
    var st = window.getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) > 0.01;
  }

  async function bootGame() {
    // The shell differs by viewport and by first-run state: sometimes there is
    // a boot plate to click, sometimes the stage is already interactive, and
    // sometimes the guide asks a question first. Wait for "the stage works"
    // rather than for one specific button, and click whatever is in the way.
    say('waiting for an interactive stage');
    var t0 = performance.now();
    var clickedBoot = false;
    while (performance.now() - t0 < 180000) {
      await clearTutorialAsk();
      if (!clickedBoot) {
        var boot = document.querySelector(CFG.boot.startBtn);
        if (boot && visible(boot)) {
          say('clicking the boot plate');
          boot.click();
          clickedBoot = true;
          await sleep(1200);
          continue;
        }
      }
      var entry = document.querySelector(CFG.boot.battleBtn);
      if (entry && visible(entry)) { say('stage is interactive'); break; }
      await sleep(400);
    }
    if (!(document.querySelector(CFG.boot.battleBtn) && visible(document.querySelector(CFG.boot.battleBtn)))) {
      throw new Error('the battle entry never became visible');
    }

    await waitFor(function () { return !!window.APEX_GOLD; }, 120000, 'APEX_GOLD');
    await sleep(1200);

    // Mount the battle HUD the way the product does, then hand the match to
    // Gold. This is the same sequence the shipped battle shell performs.
    var host = document.getElementById('battleHudHost');
    if (host) { host.classList.add('is-open'); document.body.classList.add('battle-hud-open'); }
    var url = new URL('battle-hud.html', document.baseURI).href;
    var html = await (await fetch(url, { cache: 'no-cache' })).text();
    await new Promise(function (res) { window.APEX_GOLD.mountBattleHud(html, res); });

    // ── pair the match ───────────────────────────────────────────────────
    // BOT mode does NOT honour cfg.p2: the product picks the CPU opponent
    // through botOpponentFor(), and on this build that accepts ROBOT/HUNTER
    // while refusing ICE. So a BOT match can never be CRYSTALA vs FROST, no
    // matter what is asked for. LOCAL does pair the two shells that are named,
    // and its frame cost is the same shape the recording measures, so the
    // required pairing goes through LOCAL and the refusal is reported.
    // Unlock through the product's own session, then re-read the gate after a
    // settle delay (the flag propagates through an event, not synchronously).
    var sc = CFG.scenario;
    var desiredP1 = sc.p1 || 'crystala', desiredP2 = sc.p2 || 'frost';
    var unlock = unlockPlaytestRoster(desiredP1, desiredP2);
    await sleep(700);
    unlock.locked = [];
    try {
      if (typeof window.APEX_GOLD_LOCKED === 'function') {
        if (window.APEX_GOLD_LOCKED(desiredP1)) unlock.locked.push(desiredP1);
        if (desiredP2 !== desiredP1 && window.APEX_GOLD_LOCKED(desiredP2)) unlock.locked.push(desiredP2);
      }
    } catch (e) {}
    unlock.active = unlock.locked.length === 0;
    say('unlock: ' + JSON.stringify(unlock));
    window.__P0DIAG_UNLOCK__ = unlock;
    if (!unlock.active) {
      throw new Error(desiredP1 + '/' + desiredP2 + ' still locked (' + (unlock.locked.join(',') || 'unknown')
        + '); refusing to measure a different match. Steps: ' + (unlock.steps || []).join(' -> '));
    }

    var pairing = null;
    if (sc.mode === 'bot') {
      // Production path. BOT picks its own CPU opponent through
      // botOpponentFor(), which on this build refuses ICE -- so a FROST CPU is
      // impossible by product design here. The resulting pairing is recorded
      // rather than assumed.
      pairing = { requested: 'crystala vs frost', mode: 'BOT' };
      await window.APEX_GOLD.onHandoff({ mode: 'BOT', p1: 'crystala', p2: 'frost', shell: 'battle' });
      var liveBot = await window.APEX_GOLD.onBattleLive({ mode: 'bot', p1: 'crystala' });
      say('onBattleLive(BOT) returned ' + liveBot);
      window.__P0DIAG_MODE__ = liveBot ? 'BOT' : 'FAILED';
      if (liveBot === false) throw new Error('BOT match refused');
    } else {
      pairing = { requested: desiredP1 + ' vs ' + desiredP2, mode: 'LOCAL', quality: sc.quality };
      await window.APEX_GOLD.onHandoff({
        mode: 'LOCAL', p1: desiredP1, p2: desiredP2,
        p1Hero: desiredP1, p2Hero: desiredP2, shell: 'battle',
      });
      var liveLocal = await window.APEX_GOLD.onBattleLive({ mode: 'local1v1', p1: desiredP1, p2: desiredP2 });
      say('onBattleLive(LOCAL) returned ' + liveLocal);
      window.__P0DIAG_MODE__ = liveLocal ? 'LOCAL' : 'FAILED';
      if (liveLocal === false) throw new Error('LOCAL match refused');
    }
    window.__P0DIAG_PAIRING__ = pairing;
    say('battle live');

    // Do not measure a match that is not actually running: if no fighter
    // exists, every arm would report an empty frame and look identical.
    await waitFor(function () {
      return Array.isArray(window.fighters) && window.fighters.length >= 2;
    }, 60000, 'two live fighters');
    var heroes = (window.APEX_HERO_REWORK && window.APEX_HERO_REWORK.match)
      ? window.APEX_HERO_REWORK.match.combatants.map(function (c) { return c.heroId; })
      : null;
    say('fighters up: ' + JSON.stringify(heroes || window.fighters.map(function (f) { return f.name; })));

    // A press is not proof. Ask the cast authority directly and report its
    // verdict, so a run where every cast is silently refused cannot look like
    // a successful experiment.
    var pre = freshCastStats();
    pressAndRecord(window.APEX_GOLD, 0, 0, pre);
    pressAndRecord(window.APEX_GOLD, 1, 0, pre);
    say('pre-flight cast: ' + pre.confirmed + '/' + pre.presses + ' accepted'
      + ' reasons=' + JSON.stringify(pre.byReason));
    window.__P0DIAG_CAST_PREFLIGHT__ = pre;
    await sleep(500);
  }

  // ── permanent bloom seam ──────────────────────────────────────────────
  // bloomForEmitter() caches one bloom system per emitter, forever. A factory
  // patch installed when the noBloom arm starts therefore misses every emitter
  // that already bloomed -- which on a live match is all of them, so the old
  // version "suppressed" one probe system while the product composited 14
  // times for real. The wrapper is installed ONCE, before any system exists,
  // and each arm flips a flag.
  var bloomSeam = { installed: false, off: false, systems: 0, beginBlocked: 0, compositeCalls: 0 };
  function installBloomSeam() {
    var G = window.APEX_CRYSTALA_GOLD;
    if (!G || typeof G.createBloomSystem !== 'function' || bloomSeam.installed) return false;
    var orig = G.createBloomSystem;
    G.createBloomSystem = function (o) {
      var b = orig.call(G, o);
      bloomSeam.systems++;
      if (b && typeof b.begin === 'function' && !b.__p0seam) {
        var realBegin = b.begin;
        var realComposite = b.composite;
        b.begin = function () {
          if (bloomSeam.off) { bloomSeam.beginBlocked++; return null; }
          return realBegin.apply(b, arguments);
        };
        if (typeof realComposite === 'function') {
          b.composite = function () {
            if (bloomSeam.off) { bloomSeam.compositeCalls++; return undefined; }
            return realComposite.apply(b, arguments);
          };
        }
        b.__p0seam = true;
        b.__p0realBegin = realBegin;
        b.__p0realComposite = realComposite;
      }
      return b;
    };
    bloomSeam.installed = true;
    say('bloom seam installed before the first system exists');
    return true;
  }

  // ── ice pixel probe ───────────────────────────────────────────────────
  // The ice surface is an offscreen canvas. "Did the arm remove the ice" is a
  // question about PIXELS, so it is answered by reading them, not by counting
  // calls. `iceInkOfCtx` samples an arbitrary 2d context on a 64x64 grid and
  // counts pixels with meaningful alpha.
  function iceInkOfCtx(ctx2d) {
    try {
      var cv = ctx2d && (ctx2d.canvas || ctx2d);
      if (!cv || !cv.width || !cv.height) return null;
      if (!iceInkOfCtx._probe) {
        var c = document.createElement('canvas');
        c.width = 64; c.height = 64;
        iceInkOfCtx._probe = c.getContext('2d', { willReadFrequently: true });
      }
      var p = iceInkOfCtx._probe;
      p.clearRect(0, 0, 64, 64);
      p.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, 64, 64);
      var d = p.getImageData(0, 0, 64, 64).data;
      var ink = 0;
      for (var i = 3; i < d.length; i += 4) if (d[i] > 8) ink++;
      return ink;
    } catch (e) { return null; }
  }

  function findFrostEngine() {
    try {
      var api = window.APEX_FROST_PRESENTATION;
      if (!api || !api.ready) return null;
      var cts = (window.APEX_HERO_REWORK && window.APEX_HERO_REWORK.match
        && window.APEX_HERO_REWORK.match.combatants) || [];
      for (var i = 0; i < cts.length; i++) {
        var eng = api.engineFor(cts[i].body);
        if (eng && eng.iceCanvas) return eng;
      }
    } catch (e) {}
    return null;
  }

  // The ice surface only holds paint between render() and the blit: the product
  // clears it at the top of each frame and throws it away at the bottom. So the
  // CONTROL reference is taken where the paint really exists -- by watching the
  // arena's drawImage and measuring the source surface at that moment.
  var runState = { controlIceInk: null, castsConfirmed: 0, castsPressed: 0 };

  // Pin the quality mode for every arm so the arms differ in ONE thing only.
  function pinMode(mode) {
    try {
      if (window.APEX_GRAPHICS_QUALITY && typeof window.APEX_GRAPHICS_QUALITY.set === 'function') {
        window.APEX_GRAPHICS_QUALITY.set(mode, 'p0diag');
      }
      if (window.APEX_GRAPHICS_MODE_RUNTIME && window.APEX_GRAPHICS_MODE_RUNTIME.apply) {
        window.APEX_GRAPHICS_MODE_RUNTIME.apply();
      }
    } catch (e) { say('mode pin failed: ' + e.message); }
  }
  function readFlags() {
    var g = window;
    return {
      mode: (g.APEX_GRAPHICS_QUALITY && g.APEX_GRAPHICS_QUALITY.mode) || null,
      bloom: g.APEX_GRAPHICS_BLOOM_WIDE,
      fluid: g.APEX_GRAPHICS_FLUID_SOFT_ALPHA,
      iceShadow: g.APEX_ICE_SHADOW_NODE_BUDGET === Infinity ? 'Infinity' : g.APEX_ICE_SHADOW_NODE_BUDGET,
      iceFlow: g.APEX_ICE_FLOW_MOTION_BUDGET === Infinity ? 'Infinity' : g.APEX_ICE_FLOW_MOTION_BUDGET,
    };
  }
  function recordingActive() {
    try {
      if (window.__apexOwnerRecorder) return true;
      if (window.APEX_OWNER_CAPTURE && window.APEX_OWNER_CAPTURE.isRecording) return true;
      // The product exposes the recording state through its owner capture api.
      var cap = window.APEX_OWNER_PLAYTEST || window.__apexOwnerCapture;
      if (cap && cap.state && cap.state.recording) return true;
      return false;
    } catch (e) { return null; }
  }

  // ------------------------------------------------------------------- run ---
  async function run() {
    var t0 = performance.now();
    var report = {
      schema: 'APEX-CHAOS-p0-diagnosis-v1',
      tool: VERSION,
      startedAtWall: new Date().toISOString(),
      config: CFG,
      environment: null,
      capabilities: null,
      flagsAtStart: null,
      recordingAtStart: null,
      arms: [],
      error: null,
      completed: false,
    };
    CFG.scenario = readScenario();
    report.scenario = CFG.scenario;
    try {
      report.environment = deviceInfo();
      report.capabilities = {
        longAnimationFrame: loafSupport(),
        longtask: (function () {
          try { return (PerformanceObserver.supportedEntryTypes || []).indexOf('longtask') !== -1; } catch (e) { return false; }
        })(),
        performanceMemory: !!(performance && performance.memory),
        // Honest statement of what this tool cannot do by itself.
        gpuTrace: 'not collected in-page; see run.ps1 --trace for the optional CDP path',
      };
      say('env: ' + JSON.stringify(report.environment.webgl));

      await bootGame();
      // Quality is pinned by the SCENARIO, not silently: the BOT run keeps the
      // production experience, the LOCAL control states its tier explicitly.
      pinMode(CFG.scenario.quality || 'high');
      await sleep(300);
      report.flagsAtStart = readFlags();
      report.recordingAtStart = recordingActive();
      var wantMode = CFG.scenario.quality || 'high';
      if (report.flagsAtStart.mode !== wantMode) {
        say('WARNING: quality is ' + report.flagsAtStart.mode + ', scenario asked for ' + wantMode);
      }
      report.pairing = window.__P0DIAG_PAIRING__ || null;
      report.unlock = window.__P0DIAG_UNLOCK__ || null;
      report.fighters = (window.APEX_HERO_REWORK && window.APEX_HERO_REWORK.match)
        ? window.APEX_HERO_REWORK.match.combatants.map(function (c) { return c.heroId; }) : null;
      say('scenario ' + CFG.scenario.id + ' | fighters ' + JSON.stringify(report.fighters));

      installBloomSeam();
      startObservers();
      installProbe();

      // The ice surface only holds paint between render() and the blit, so the
      // CONTROL reference is measured where that paint exists: by watching the
      // arena's drawImage on a clean frame. Reading it from a timer sees an
      // emptied surface and reports 0, which would make the ice arm
      // uninterpretable (nothing to remove).
      var refPeak = 0;
      var arenaCtx = null;
      try {
        var cvEl = document.getElementById('game-canvas');
        arenaCtx = cvEl ? cvEl.getContext('2d') : null;
      } catch (e) {}
      var origDrawImage = arenaCtx && arenaCtx.drawImage;
      if (arenaCtx && typeof origDrawImage === 'function') {
        arenaCtx.drawImage = function (src) {
          try {
            if (src && src.width > 200 && src.height > 200) {
              var inkNow = iceInkOfCtx(src);
              if (inkNow != null && inkNow > refPeak) refPeak = inkNow;
            }
          } catch (e) {}
          return origDrawImage.apply(arenaCtx, arguments);
        };
      }
      for (var rw = 0; rw < 12 && refPeak === 0; rw++) {
        try { pressAndRecord(window.APEX_GOLD, 1, 0, freshCastStats()); } catch (e) {}
        await sleep(400);
      }
      if (arenaCtx) arenaCtx.drawImage = origDrawImage;
      runState.controlIceInk = refPeak > 0 ? refPeak : null;
      report.controlIceInk = runState.controlIceInk;
      say('control ice ink reference: ' + runState.controlIceInk + ' (measured at the blit)');

      // Interleaved order with a control repeat at both ends, so a thermal or
      // JIT drift cannot be mistaken for an arm effect.
      var ORDER = CFG.scenario.p1 === 'boxe'
        ? ['full', 'noIce', 'noAux', 'full']
        : ['full', 'noIce', 'noAux', 'noBloom', 'full'];
      for (var i = 0; i < ORDER.length; i++) {
        say('arm ' + (i + 1) + '/' + ORDER.length + ' -> ' + ORDER[i]);
        var res = await runArm(ORDER[i], i, ORDER.length);
        if (i === 1) res.flagsDuringArm = readFlags();
        report.arms.push(res);
        await sleep(120);   // let the page settle between arms
      }

      uninstallProbe();
      stopObservers();
      report.flagsAtEnd = readFlags();
      report.completed = true;
    } catch (e) {
      report.error = String((e && e.message) || e);
      say('FATAL ' + report.error);
      try { uninstallProbe(); stopObservers(); } catch (e2) {}
    }
    report.log = log.slice(-200);
    report.elapsedMs = r2(performance.now() - t0);
    report.summary = summarizeArms(report);
    return report;
  }

  // --------------------------------------------------------------- summary --
  // Compares each arm against the control's p95. Deliberately conservative:
  // a difference under 10% is reported as "no signal" rather than as a win.
  function summarizeArms(report) {
    var controls = report.arms.filter(function (a) { return a.id === 'full' && a.valid; });
    if (!controls.length) return { verdict: 'no-valid-control', arms: [] };
    var base = controls[0].raf;
    var rows = report.arms.map(function (a) {
      var dP95 = (a.valid && a.raf.p95 != null && base.p95 != null)
        ? r2((a.raf.p95 - base.p95) / base.p95 * 100) : null;
      return {
        id: a.id, valid: a.valid, frames: a.framesMeasured,
        p50: a.raf.p50, p95: a.raf.p95, p99: a.raf.p99, max: a.raf.max,
        jsP95: a.jsWork.p95,
        jsSharePct: a.jsShareOfFramePct,
        longTasks: a.longTasks.count, loaf: a.loaf.count,
        deltaP95Pct: dP95,
      };
    });
    // Control stability: if the two control runs disagree by more than 20%,
    // nothing else in the run can be trusted.
    var stable = controls.length > 1
      ? Math.abs((controls[1].raf.p95 - controls[0].raf.p95) / controls[0].raf.p95) <= 0.20
      : null;
    var biggest = rows.filter(function (r) { return r.id !== 'full' && r.valid && r.deltaP95Pct != null; })
      .sort(function (a, b) { return a.deltaP95Pct - b.deltaP95Pct; })[0] || null;

    // The control spread is the NOISE FLOOR of this machine, measured on the
    // very same match. A subsystem only explains the stutter if switching it
    // off moves p95 by clearly more than the run-to-run wobble of doing
    // nothing at all -- otherwise the "win" is the noise, and reporting it
    // would be exactly the unverified claim this phase forbids.
    var controlSpreadPct = (controls.length > 1 && controls[0].raf.p95)
      ? Math.abs((controls[1].raf.p95 - controls[0].raf.p95) / controls[0].raf.p95) * 100
      : null;
    var noiseFloorPct = controlSpreadPct == null ? null : r2(controlSpreadPct);
    var significant = null;
    if (biggest && biggest.deltaP95Pct != null && noiseFloorPct != null) {
      significant = Math.abs(biggest.deltaP95Pct) > Math.max(noiseFloorPct * 2, 10);
    }
    var thinSample = rows.some(function (r) { return r.frames != null && r.frames < 20; });

    // A run in which the game never accepted a cast cannot answer whether the
    // CAST costs the frame. Saying so is the whole point of this tool.
    var castEvidence = {
      pressed: runState.castsPressed,
      confirmed: runState.castsConfirmed,
      note: runState.castsConfirmed === 0
        ? 'no cast was accepted during this run; cooldowns are measured in game '
          + 'seconds, so on a machine far slower than real time an arm can end '
          + 'before any cooldown expires. The arm proofs below still show the '
          + 'renderers were switched off, but the cast-cost question is unanswered.'
        : null,
    };
    report.castEvidence = castEvidence;

    var verdict;
    if (!stable) verdict = 'control-unstable-repeat-the-run';
    else if (runState.castsConfirmed === 0) verdict = 'no-cast-accepted-cannot-judge';
    else if (thinSample) verdict = 'sample-too-thin-to-conclude';
    else if (biggest && biggest.deltaP95Pct <= -10 && significant) verdict = 'subsystem-identified';
    else verdict = 'no-subsystem-explains-the-stutter';

    return {
      controlP95: base.p95,
      controlStable: stable,
      controlSpreadPct: noiseFloorPct,
      rows: rows,
      // The ranking is the deliverable; the interpretation is the human's.
      biggestReducer: biggest ? { id: biggest.id, deltaP95Pct: biggest.deltaP95Pct } : null,
      // Honest bookkeeping: say WHY a candidate was not accepted.
      belowNoiseFloor: biggest && biggest.deltaP95Pct != null && significant === false,
      thinSample: thinSample,
      verdict: verdict,
    };
  }

  // ---------------------------------------------------------------- output --
  function download(obj) {
    try {
      var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'p0-diagnosis-' + Date.now() + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      return true;
    } catch (e) { return false; }
  }

  async function main() {
    var report = await run();
    // Three delivery paths, in order of preference: the local server (writes
    // the file next to the tool), a download, then the console.
    var posted = false;
    try {
      var res = await fetch('/__p0result', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      posted = res.ok;
    } catch (e) { say('POST failed: ' + e.message); }
    var downloaded = posted ? false : download(report);
    try {
      window.__P0DIAG_RESULT__ = report;
      localStorage.setItem('apex.p0diag.last', JSON.stringify(report));
    } catch (e) {}
    say('done: posted=' + posted + ' downloaded=' + downloaded + ' verdict=' +
      (report.summary && report.summary.verdict));
    // A visible end state so the owner knows the run finished and can close it.
    try {
      var d = document.createElement('div');
      d.setAttribute('data-p0diag-done', '1');
      d.style.cssText = 'position:fixed;z-index:2147483647;inset:auto 16px 16px 16px;padding:14px 18px;border-radius:10px;'
        + 'background:#0b1019f5;border:1px solid #e9b35b;color:#ffe8c0;font:600 14px/1.5 system-ui;text-align:center';
      d.textContent = posted ? 'P0 diagnosis finished — results saved next to the tool. You can close the browser.'
        : 'P0 diagnosis finished — a JSON file was downloaded. You can close the browser.';
      document.body.appendChild(d);
    } catch (e) {}
  }

  window.__P0DIAG__ = { version: VERSION, run: run, report: null };
  // Auto-start: the launcher appends ?p0diag=1 so a normal visitor never
  // triggers this.
  if (/[?&]p0diag=1/.test(location.search)) {
    say('auto-start from query string');
    main();
  }
})();
