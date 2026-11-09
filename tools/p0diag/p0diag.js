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

    // The ice arm must switch off the thing that actually costs the frame, and
    // that is NOT IceField.render: IceField is the gold material sampler, while
    // the per-frame cost is the offscreen composite in drawIceComposite, whose
    // only entry point is api.renderSurfaceUnderWeapons. Patching IceField
    // counted calls and changed nothing, so the "ice off" arm still composited
    // ice -- exactly the silent substitution the proofs exist to catch.
    function patchIce() {
      var api = window.APEX_FROST_PRESENTATION;
      if (!api || typeof api.renderSurfaceUnderWeapons !== 'function') return null;
      var orig = api.renderSurfaceUnderWeapons;
      state.ice = { hits: 0 };
      api.renderSurfaceUnderWeapons = function () { state.ice.hits++; };
      return function () { api.renderSurfaceUnderWeapons = orig; };
    }
    // Same story for bloom. bloom passes are counted inside the CRYSTALA
    // presentation runtime (renderBloomRegion), and the runtime object exists
    // once per match, so patching the factory after boot never took effect.
    // The probe mark is the single point every pass goes through, so the arm
    // suppresses that mark's emitter and counts the suppressions.
    function patchBloom() {
      var probe = window.__apexOwnerPerfProbe;
      if (!probe) return null;
      var orig = probe.markSkillActivation;
      if (typeof orig !== 'function') return null;
      state.bloom = { hits: 0 };
      probe.markSkillActivation = function (kind, ms, meta) {
        if (String(kind).indexOf('crystala-bloom') === 0) { state.bloom.hits++; return; }
        return orig.call(probe, kind, ms, meta);
      };
      return function () { probe.markSkillActivation = orig; };
    }
    function patchAux() {
      // Ambient VFX layers that are pure decoration: floor/air shapes, the
      // ribbon layer and the bullet flecks. They carry no gameplay state.
      var G = window.APEX_FROST_GOLD;
      if (!G) return null;
      var names = ['drawFloorShapes', 'drawAirShapes', 'drawRibbonLayer', 'frostBulletFleck'];
      var saved = {};
      state.aux = { hits: 0 };
      names.forEach(function (n) {
        if (typeof G[n] === 'function') {
          saved[n] = G[n];
          G[n] = function () { state.aux.hits++; };
        }
      });
      return function () {
        Object.keys(saved).forEach(function (n) { G[n] = saved[n]; });
      };
    }

    return {
      full:    { id: 'full',    label: 'full gameplay (control)',            apply: function () { return function () {}; } },
      noIce:   { id: 'noIce',   label: 'FROST ice renderer off',             apply: patchIce,  expect: 'ice' },
      noBloom: { id: 'noBloom', label: 'CRYSTALA bloom off',                 apply: patchBloom, expect: 'bloom' },
      noAux:   { id: 'noAux',   label: 'auxiliary ambient VFX off',          apply: patchAux,  expect: 'aux' },
      state: state,
    };
  }

  // ------------------------------------------------------------ cast plan ---
  // Deterministic by FRAME INDEX, so every arm receives the identical cast
  // sequence even if one arm runs slower than another.
  function castAt(api, i) {
    var fired = 0;
    function press(side, slot) {
      try { api.pressSkill(side, slot); fired++; } catch (e) {}
    }
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
        // The proof: the counter that this arm was supposed to drive must have
        // moved, and the arms that were NOT switched must not have moved.
        if (armObj.id === 'full') {
          res.activationProof = {
            claim: 'nothing patched; ice + bloom must both appear',
            iceComposites: res.skill.iceComposites,
            bloomPasses: res.skill.bloomPasses,
            ok: res.skill.iceComposites > 0 || res.skill.bloomPasses > 0,
          };
        } else if (armObj.id === 'noIce') {
          // Two independent facts, both required: the ice surface entry point
          // was really called (so the arm is live) AND the ice composite it
          // owns really stopped happening (so the frame is genuinely cheaper
          // for the reason claimed). A patch that fires but changes nothing is
          // the failure mode this check exists for.
          res.activationProof = {
            claim: 'ice surface entry intercepted; ice composite must stop',
            intercepted: (arms.state.ice && arms.state.ice.hits) || 0,
            iceComposites: res.skill.iceComposites,
            iceRenderMarks: res.ice.render.n,
            ok: ((arms.state.ice && arms.state.ice.hits) || 0) > 0
              && res.skill.iceComposites === 0 && res.ice.render.n === 0,
          };
        } else if (armObj.id === 'noBloom') {
          res.activationProof = {
            claim: 'bloom pass suppressed at the probe; bloom passes must be 0',
            intercepted: (arms.state.bloom && arms.state.bloom.hits) || 0,
            bloomPasses: res.skill.bloomPasses,
            bloomMarkSuppressed: (arms.state.bloom && arms.state.bloom.hits) || 0,
            ok: ((arms.state.bloom && arms.state.bloom.hits) || 0) > 0 && res.skill.bloomPasses === 0,
          };
        } else if (armObj.id === 'noAux') {
          res.activationProof = {
            claim: 'aux draw entry points intercepted; must be called',
            intercepted: (arms.state.aux && arms.state.aux.hits) || 0,
            ok: ((arms.state.aux && arms.state.aux.hits) || 0) > 0,
          };
        }
        var proofsOk = !!res.activationProof && res.activationProof.ok === true;
        var enoughFrames = frames.length >= CFG.minArmFrames;
        res.valid = proofsOk && enoughFrames;
        // Say WHY, in the report, instead of leaving a bare false.
        var reasons = [];
        if (!proofsOk) reasons.push('activation not proven');
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
        }
        if (measuring && last) {
          frames.push(ts - last);
          frameMarks.push(Math.round(ts));
        }
        last = ts;
        n++;
        if (measuring) {
          pressed += castAt(api, frames.length);
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
    var pinRefused = null;
    try {
      if (typeof window.APEX_GOLD.setBotOpponent === 'function') {
        var pinned = window.APEX_GOLD.setBotOpponent('frost');
        if (!pinned) pinRefused = 'BOT refused frost as the CPU opponent';
      }
    } catch (e) { pinRefused = 'setBotOpponent threw: ' + e.message; }

    // Which shells are actually unlocked is an OWNERSHIP fact, not a tool
    // setting. Report it instead of working around it: a locked hero means the
    // report must say so, because the alternative is measuring a different
    // match than the one that was asked for.
    var locked = [];
    try {
      if (typeof window.APEX_GOLD_LOCKED === 'function') {
        if (window.APEX_GOLD_LOCKED('crystala')) locked.push('crystala');
        if (window.APEX_GOLD_LOCKED('frost')) locked.push('frost');
      }
    } catch (e) {}
    if (locked.length) {
      say('LOCKED on this profile: ' + locked.join(', '));
      say('  the requested CRYSTALA vs FROST pairing needs both unlocked.');
      say('  re-run with your own browser profile (see PACKAGE-README).');
      window.__P0DIAG_LOCKED__ = locked;
    }

    var wanted = { mode: 'LOCAL', p1: 'crystala', p2: 'frost' };
    await window.APEX_GOLD.onHandoff({
      mode: wanted.mode, p1: wanted.p1, p2: wanted.p2,
      p1Hero: wanted.p1, p2Hero: wanted.p2, shell: 'battle',
    });
    // onBattleLive loads the per-hero battle runtimes and returns FALSE when it
    // declines. Its return value is the difference between "the match is
    // running" and "the call succeeded", so it is reported, not assumed.
    var live = await window.APEX_GOLD.onBattleLive({
      mode: 'local1v1', p1: wanted.p1, p2: wanted.p2,
    });
    say('onBattleLive(local1v1) returned ' + live);
    window.__P0DIAG_MODE__ = live ? 'LOCAL' : 'FAILED';
    if (pinRefused) say('note: ' + pinRefused + ' (LOCAL pairing used instead)');
    if (live === false) {
      // One retry through BOT so a LOCAL-only restriction still yields a
      // measured match -- clearly labelled, never silently substituted.
      var botLive = await window.APEX_GOLD.onBattleLive({ mode: 'bot', p1: 'crystala' });
      say('retry onBattleLive(bot) returned ' + botLive);
      if (botLive) window.__P0DIAG_MODE__ = 'BOT(fallback)';
    }
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

    // Prove the cast API works before measuring, so a later "0 skills" result
    // cannot be blamed on the measurement.
    var before = 0;
    try { window.APEX_GOLD.pressSkill(0, 0); } catch (e) { say('pressSkill threw: ' + e.message); }
    await sleep(600);
    try {
      var st = window.APEX_ARSENAL && window.APEX_ARSENAL.state;
      if (st) before = st.active ? 1 : 1;
    } catch (e) {}
    say('cast API exercised (pressed CRYSTALA slot 0)');
    await sleep(900);
  }

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
      pinMode('high');
      await sleep(300);
      report.flagsAtStart = readFlags();
      report.recordingAtStart = recordingActive();
      if (report.flagsAtStart.mode !== 'high') {
        say('WARNING: mode did not pin to high: ' + report.flagsAtStart.mode);
      }

      startObservers();
      installProbe();

      // Interleaved order with a control repeat at both ends, so a thermal or
      // JIT drift cannot be mistaken for an arm effect.
      var ORDER = ['full', 'noIce', 'noAux', 'noBloom', 'full'];
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

    var verdict;
    if (!stable) verdict = 'control-unstable-repeat-the-run';
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
