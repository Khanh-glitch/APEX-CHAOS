// Per-operation Canvas2D timing watch (exact but heavy; opt-in only).
(() => {
  if (window.__APEX_OPWATCH) return;
  const W = { on: false, acc: new Map(), calls: new Map(), max: new Map() };
  const proto = CanvasRenderingContext2D.prototype;
  const names = ['fill','stroke','fillRect','strokeRect','clearRect','drawImage','fillText','strokeText','save','restore','beginPath','arc','rect','clip','setLineDash','translate','rotate','scale','createRadialGradient','createLinearGradient','putImageData','getImageData','measureText'];
  for (const n of names) {
    const orig = proto[n];
    if (typeof orig !== 'function') continue;
    proto[n] = function (...a) {
      if (!W.on) return orig.apply(this, a);
      const t = performance.now(); const r = orig.apply(this, a); const dt = performance.now() - t;
      W.acc.set(n, (W.acc.get(n) || 0) + dt); W.calls.set(n, (W.calls.get(n) || 0) + 1);
      if (dt > (W.max.get(n) || 0)) W.max.set(n, dt);
      return r;
    };
  }
  for (const p of ['shadowBlur','filter','globalCompositeOperation','globalAlpha']) {
    const d = Object.getOwnPropertyDescriptor(proto, p);
    if (!d || !d.set) continue;
    Object.defineProperty(proto, p, {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set(v) { if (!W.on) return d.set.call(this, v); const t = performance.now(); d.set.call(this, v); const dt = performance.now() - t; const k = 'set:' + p; W.acc.set(k, (W.acc.get(k) || 0) + dt); W.calls.set(k, (W.calls.get(k) || 0) + 1); if (dt > (W.max.get(k) || 0)) W.max.set(k, dt); },
    });
  }
  W.reset = () => { W.acc.clear(); W.calls.clear(); W.max.clear(); };
  W.report = () => [...W.acc.entries()].map(([k, v]) => ({ op: k, totalMs: +v.toFixed(2), calls: W.calls.get(k), avgMs: +(v / W.calls.get(k)).toFixed(3), maxMs: +(W.max.get(k) || 0).toFixed(2) })).sort((a, b) => b.totalMs - a.totalMs);
  window.__APEX_OPWATCH = W;
})();
