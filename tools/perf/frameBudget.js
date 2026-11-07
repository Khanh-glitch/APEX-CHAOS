// Deterministic synchronous frame-budget benchmark.
// The sandbox compositor throttles rAF to ~2 Hz (software rasterisation), so
// displayed FPS cannot be measured here. Instead the product update()/draw()
// pair is driven for N frames at a fixed dt while every per-frame JS and
// Canvas2D command is counted. That measures the cost the game itself owns:
// CPU work per frame plus the GPU command volume it submits.
(() => {
  if (window.__APEX_FRAME_BUDGET) return;
  const now = () => performance.now();
  function summarize(values) {
    if (!values.length) return { n: 0 };
    const s = values.slice().sort((a, b) => a - b);
    const q = (p) => +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(3);
    let sum = 0; for (const v of s) sum += v;
    return { n: s.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: +s[s.length - 1].toFixed(3), avg: +(sum / s.length).toFixed(3), total: +sum.toFixed(1) };
  }
  window.__APEX_FRAME_BUDGET = async function run(opts = {}) {
    const frames = Math.max(1, opts.frames || 120);
    const dt = opts.dt || (1 / 60);
    const scenario = opts.scenario || null;
    const inst = window.__APEX_INSTR;
    if (!inst) throw new Error('instrumentation not installed');
    const updateMs = [], drawMs = [];
    inst.install();
    inst.active = true; inst.ops.clear(); inst.heroDraw = {};
    for (let i = 0; i < frames; i += 1) {
      if (scenario) scenario(i, frames);
      const t0 = now(); window.update(dt);
      const t1 = now(); window.draw();
      const t2 = now();
      updateMs.push(t1 - t0); drawMs.push(t2 - t1);
      if (i % 20 === 19) await new Promise((r) => setTimeout(r, 0));
    }
    inst.active = false;
    const ops = {}; for (const [k, v] of inst.ops) ops[k] = v;
    const jsMs = updateMs.reduce((a, b) => a + b, 0) + drawMs.reduce((a, b) => a + b, 0);
    const heroDraw = {};
    for (const [k, v] of Object.entries(inst.heroDraw)) heroDraw[k] = { n: v.n, avg: +(v.total / v.n).toFixed(2), max: +v.max.toFixed(1) };
    return {
      label: opts.label || 'frame-budget', frames,
      update: summarize(updateMs), draw: summarize(drawMs),
      frame: summarize(updateMs.map((u, i) => u + drawMs[i])),
      jsFpsEquivalent: +(frames / (jsMs / 1000)).toFixed(1),
      perFrameOps: Object.fromEntries(Object.entries(ops).map(([k, v]) => [k, +(v / frames).toFixed(2)])),
      heroDrawPerFrame: heroDraw,
      state: {
        fighters: (window.fighters || []).map((f) => f.name),
        particles: (window.particles || []).length, projectiles: (window.projectiles || []).length,
        canvas: window.canvas ? { w: window.canvas.width, h: window.canvas.height, cw: window.canvas.clientWidth } : null,
      },
    };
  };
})();
