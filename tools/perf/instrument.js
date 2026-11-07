// In-page instrumentation installed AFTER the product engine exists.
// Opt-in: without start() the only cost is one boolean test per hook.
(() => {
  if (window.__APEX_INSTR) return;
  const now = () => performance.now();
  const S = { active: false, frames: [], update: [], draw: [], heroDraw: {}, ops: new Map(), installed: false, saved: {} };
  function wrapCtx2D(Ctx2D) {
    if (!Ctx2D || Ctx2D.prototype.__apexWrapped) return;
    const P = Ctx2D.prototype;
    const wraps = ['fillRect','strokeRect','clearRect','fill','stroke','drawImage','fillText','save','restore','beginPath','arc','rect','clip','putImageData','getImageData','translate','rotate','scale','setLineDash','createRadialGradient','createLinearGradient'];
    for (const name of wraps) {
      const orig = P[name];
      if (typeof orig !== 'function') continue;
      P[name] = function (...a) {
        if (!S.active) return orig.apply(this, a);
        const k = name; S.ops.set(k, (S.ops.get(k) || 0) + 1);
        if (name === 'drawImage' && a.length >= 9) {
          const sw = a[3], sh = a[4], dw = a[6], dh = a[7];
          const px = Math.abs(sw * sh), dx = Math.abs(dw * dh);
          S.ops.set('drawImagePixels', (S.ops.get('drawImagePixels') || 0) + dx);
          if (px && dx > px * 1.05) S.ops.set('drawImageUpscale', (S.ops.get('drawImageUpscale') || 0) + 1);
        }
        return orig.apply(this, a);
      };
    }
    for (const prop of ['shadowBlur','globalAlpha','filter','globalCompositeOperation','fillStyle','strokeStyle','font','lineWidth']) {
      const d = Object.getOwnPropertyDescriptor(P, prop);
      if (!d || !d.set) continue;
      Object.defineProperty(P, prop, {
        configurable: true, enumerable: d.enumerable, get: d.get,
        set(v) { if (S.active) S.ops.set('set:' + prop, (S.ops.get('set:' + prop) || 0) + 1); return d.set.call(this, v); },
      });
    }
    P.__apexWrapped = true;
  }
  S.install = function install() {
    if (S.installed) return true;
    try { wrapCtx2D(window.CanvasRenderingContext2D); } catch (_) {}
    try { if (window.OffscreenCanvasRenderingContext2D) wrapCtx2D(window.OffscreenCanvasRenderingContext2D); } catch (_) {}
    const F = window.Fighter;
    if (F && F.prototype && !F.prototype.__apexDrawWrapped) {
      const origDraw = F.prototype.draw;
      F.prototype.draw = function (...a) {
        if (!S.active) return origDraw.apply(this, a);
        const t = now();
        try { return origDraw.apply(this, a); }
        finally {
          const dt = now() - t;
          const rec = S.heroDraw[String(this.name || '?')] || (S.heroDraw[String(this.name || '?')] = { n: 0, total: 0, max: 0 });
          rec.n += 1; rec.total += dt; if (dt > rec.max) rec.max = dt;
        }
      };
      F.prototype.__apexDrawWrapped = true;
    }
    S.installed = true; return true;
  };
  const push = (arr, v, cap = 6000) => { if (arr.length < cap) arr.push(v); };
  S.start = function start() {
    S.install();
    S.frames.length = 0; S.update.length = 0; S.draw.length = 0; S.heroDraw = {}; S.ops.clear();
    if (!S.saved.update && typeof window.update === 'function') {
      const ou = window.update, od = window.draw;
      S.saved.update = ou; S.saved.draw = od;
      window.update = function (...a) { const t = now(); const r = ou.apply(this, a); push(S.update, now() - t); return r; };
      window.draw = function (...a) { const t = now(); const r = od.apply(this, a); push(S.draw, now() - t); return r; };
    }
    S.active = true; S.t0 = now();
    let last = now();
    const tick = (t) => { if (!S.active) return; S.frames.push(t - last); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    return true;
  };
  const stat = (arr) => {
    if (!arr.length) return { n: 0 };
    const s = arr.slice().sort((a, b) => a - b);
    const q = (p) => +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2);
    let sum = 0; for (const v of s) sum += v;
    return { n: s.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: +s[s.length - 1].toFixed(2), avg: +(sum / s.length).toFixed(2), sum: +sum.toFixed(1) };
  };
  S.stop = function stop(label) {
    S.active = false;
    const ops = {}; for (const [k, v] of S.ops) ops[k] = v;
    const heroDraw = {};
    for (const [k, v] of Object.entries(S.heroDraw)) heroDraw[k] = { n: v.n, avg: +(v.total / v.n).toFixed(2), max: +v.max.toFixed(1), total: +v.total.toFixed(1) };
    return {
      label, seconds: +((now() - S.t0) / 1000).toFixed(2),
      frame: stat(S.frames.slice(1)), update: stat(S.update), draw: stat(S.draw), heroDraw, ops,
      state: {
        fighters: (window.fighters || []).map((f) => f.name), gameState: window.gameState,
        particles: (window.particles || []).length, projectiles: (window.projectiles || []).length,
        matchClock: +(window.matchClock || 0).toFixed(2),
        canvas: window.canvas ? { w: window.canvas.width, h: window.canvas.height, cw: window.canvas.clientWidth, ch: window.canvas.clientHeight } : null,
        dpr: window.devicePixelRatio,
      },
    };
  };
  window.__APEX_INSTR = S;
})();
