/* =============================================================================
 * APEX CHAOS: TOTAL EVOLUTION — Living Arenas (2.5D authored environments)
 *
 * Layering per frame:  material base (licensed photo, tinted/multiplied) →
 * baked architecture (plates, pipes, grates, conduits, corner gussets) →
 * live sub-floor machinery → persistent scars → interactive hazards with
 * telegraph/active/aftermath states → fighter contact shadows → ambient motes.
 * ========================================================================== */
(function (g) {
  'use strict';
  if (g.APEX_EVOLUTION_ARENAS) return;

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const VFX = () => g.APEX_EVOLUTION_VFX;
  const SH = () => g.APEX_EVOLUTION_SHADER;
  const CB = () => g.APEX_EVOLUTION_COMBAT;
  const HUD = () => g.APEX_EVOLUTION_HUD;
  const AU = () => g.APEX_EVOLUTION_AUDIO;

  const MAT = '/assets/evolution/materials/';
  const ARENA_CATALOG = [
    { id: 'scrap_foundry', name: 'SCRAP BASIN FOUNDRY', shortName: 'FOUNDRY', accent: '#ff941f', secondary: '#ff4d29', bgBase: '#171b21', material: 'rust_steel.jpg', tint: '#3a2a20', desc: 'Molten slag trenches, a central Solar Forge vent (+25% burn to passing shots) and twin electromagnetic bumper pylons.', events: 'FORGE VENT · SLAG TIDE' },
    { id: 'cryo_vault', name: 'CRYO-TURBINE VAULT', shortName: 'CRYO VAULT', accent: '#5ce1ff', secondary: '#90f1ff', bgBase: '#111a26', material: 'ice_surface.jpg', tint: '#1a3a52', desc: 'A live cryo rotor beneath frosted glass. Shatter Coolant Cores to open Glacial Drift zones; the rotor vents a freezing gust on a cycle.', events: 'COOLANT CORES · ROTOR GUST' },
    { id: 'lorentz_railyard', name: 'LORENTZ RAILYARD', shortName: 'RAILYARD', accent: '#ffd166', secondary: '#4cc9f0', bgBase: '#15181f', material: 'copper_circuit.jpg', tint: '#2a2416', desc: 'Twin Lorentz Accelerator Gates (+38% velocity, chain arcs). Induction rails periodically overload with a sweeping arc.', events: 'ACCELERATOR GATES · RAIL OVERLOAD' },
    { id: 'prism_sanctum', name: 'OBSIDIAN PRISM SANCTUM', shortName: 'SANCTUM', accent: '#c77dff', secondary: '#ff9ebb', bgBase: '#1b1728', material: 'hex_basalt.jpg', tint: '#4a3566', desc: 'Rotating Refraction Monoliths split and redirect gunfire; ley-lines pulse and briefly accelerate anyone standing on them.', events: 'MONOLITHS · LEY SURGE' },
    { id: 'tournament_pro', name: 'APEX TOURNAMENT PRO', shortName: 'PRO STAGE', accent: '#e2e8f0', secondary: '#ff941f', bgBase: '#20252e', material: 'dark_weave.jpg', tint: '#3a414c', desc: 'Championship carbon-titanium stage. Zero hazards. Reactive LED wall telemetry and crowd flash on big hits.', events: 'NO HAZARDS · LED TELEMETRY' },
  ];

  let selectedArenaId = 'scrap_foundry';
  try { const s = localStorage.getItem('apexEvolution.arenaId'); if (s && (s === 'random' || ARENA_CATALOG.some(a => a.id === s))) selectedArenaId = s; } catch (_) {}

  let activeArena = ARENA_CATALOG[0];
  let deckCanvas = null, deckKey = '';
  let scarCanvas = null, scarCtx = null, scarSize = 0;
  const matImgs = {};
  function material(name) {
    if (matImgs[name]) return matImgs[name];
    const im = new Image(); im.decoding = 'async'; im.src = MAT + name; im.onload = () => { deckKey = ''; };
    matImgs[name] = im; return im;
  }
  for (const a of ARENA_CATALOG) material(a.material);

  let R = null; // runtime state
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function ensureScar(S) { if (!scarCanvas || scarSize !== S) { scarCanvas = mk(S, S); scarCtx = scarCanvas.getContext('2d'); scarSize = S; } }
  function clearScars() { if (scarCtx) scarCtx.clearRect(0, 0, scarSize, scarSize); }
  function resolveArena(id) { return id === 'random' ? ARENA_CATALOG[Math.floor(Math.random() * ARENA_CATALOG.length)] : (ARENA_CATALOG.find(a => a.id === id) || ARENA_CATALOG[0]); }

  // ── baked architecture ────────────────────────────────────────────────────
  function pipe(c, x0, y0, x1, y1, w, col) {
    c.save(); c.lineCap = 'round';
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = w + 6; c.beginPath(); c.moveTo(x0, y0 + 4); c.lineTo(x1, y1 + 4); c.stroke();
    const ang = Math.atan2(y1 - y0, x1 - x0); const nx = -Math.sin(ang), ny = Math.cos(ang);
    const gr = c.createLinearGradient(x0 - nx * w / 2, y0 - ny * w / 2, x0 + nx * w / 2, y0 + ny * w / 2);
    gr.addColorStop(0, '#0d1016'); gr.addColorStop(0.35, col); gr.addColorStop(0.5, '#ffffff22'); gr.addColorStop(0.7, col); gr.addColorStop(1, '#0d1016');
    c.strokeStyle = gr; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let d = 40; d < len; d += 110) { const px = x0 + Math.cos(ang) * d, py = y0 + Math.sin(ang) * d; c.fillStyle = '#20252f'; c.strokeStyle = '#05070a'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(px - 6, py - w / 2 - 3, 12, w + 6, 2); c.fill(); c.stroke(); }
    c.restore();
  }
  function grate(c, x, y, w, h, glow) {
    c.save(); c.fillStyle = '#07090d'; c.fillRect(x, y, w, h);
    if (glow) { const gg = c.createLinearGradient(x, 0, x + w, 0); gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(0.5, glow); gg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gg; c.fillRect(x, y, w, h); }
    c.strokeStyle = '#1c2129'; c.lineWidth = 5; const vertical = h > w;
    if (vertical) for (let yy = y + 10; yy < y + h; yy += 18) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); }
    else for (let xx = x + 10; xx < x + w; xx += 18) { c.beginPath(); c.moveTo(xx, y); c.lineTo(xx, y + h); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 2; c.strokeRect(x, y, w, h); c.restore();
  }
  function plateBevels(c, S, tile, alpha) {
    for (let x = 0; x < S; x += tile) for (let y = 0; y < S; y += tile) {
      c.strokeStyle = `rgba(5,7,10,${alpha})`; c.lineWidth = 2.5; c.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
      c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 3, y + tile - 3); c.lineTo(x + 3, y + 3); c.lineTo(x + tile - 3, y + 3); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.07)'; for (const [rx, ry] of [[x + 9, y + 9], [x + tile - 9, y + 9], [x + 9, y + tile - 9], [x + tile - 9, y + tile - 9]]) { c.beginPath(); c.arc(rx, ry, 2, 0, TAU); c.fill(); }
    }
  }
  function hexField(c, S, hexR, col) {
    const dx = hexR * 1.5, dy = hexR * Math.sqrt(3);
    c.lineWidth = 1.4; c.strokeStyle = col;
    for (let gx = 40; gx < S; gx += dx) { const ci = Math.round((gx - 40) / dx); for (let gy = 40; gy < S + dy; gy += dy) { const cy = gy + (ci % 2 ? dy / 2 : 0); c.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; const px = gx + Math.cos(a) * (hexR - 2), py = cy + Math.sin(a) * (hexR - 2); if (k === 0) c.moveTo(px, py); else c.lineTo(px, py); } c.closePath(); c.stroke(); } }
  }

  function buildDeck(S, arena) {
    const cv = mk(S, S), c = cv.getContext('2d');
    c.fillStyle = arena.bgBase; c.fillRect(0, 0, S, S);
    // material base
    const im = matImgs[arena.material];
    if (im && im.complete && im.naturalWidth > 0) {
      c.save(); c.globalAlpha = arena.id === 'tournament_pro' ? 0.5 : arena.id === 'prism_sanctum' ? 0.62 : 0.55; c.drawImage(im, 0, 0, S, S); c.restore();
      c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = arena.tint; c.globalAlpha = 0.85; c.fillRect(0, 0, S, S); c.restore();
    }
    const rad = c.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.75);
    rad.addColorStop(0, 'rgba(255,255,255,0.09)'); rad.addColorStop(0.6, 'rgba(0,0,0,0)'); rad.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = rad; c.fillRect(0, 0, S, S);

    if (arena.id === 'prism_sanctum') {
      hexField(c, S, 64, 'rgba(199,125,255,0.14)');
      // ley lines
      c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(199,125,255,0.22)'; c.lineWidth = 6; c.lineCap = 'round';
      for (const [x0, y0, x1, y1] of [[S * 0.5, 60, S * 0.5, S - 60], [60, S * 0.5, S - 60, S * 0.5], [120, 120, S - 120, S - 120], [S - 120, 120, 120, S - 120]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
      c.restore();
      // central crystal mosaic
      c.save(); c.translate(S / 2, S / 2);
      for (let r = 0; r < 3; r++) { c.strokeStyle = `rgba(224,170,255,${0.35 - r * 0.08})`; c.lineWidth = 2; c.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + r * 0.3; const rr = 70 + r * 45; if (k === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.stroke(); }
      c.restore();
    } else {
      plateBevels(c, S, 125, arena.id === 'tournament_pro' ? 0.32 : 0.55);
    }

    if (arena.id === 'scrap_foundry') {
      for (const tx of [S * 0.24, S * 0.76]) grate(c, tx - 26, 90, 52, S - 180, 'rgba(255,120,30,0.35)');
      pipe(c, 60, 70, S - 60, 70, 18, '#3b3028'); pipe(c, 60, S - 70, S - 60, S - 70, 18, '#3b3028');
      pipe(c, 70, 90, 70, S - 90, 14, '#34302c'); pipe(c, S - 70, 90, S - 70, S - 90, 14, '#34302c');
      // forge hatch
      c.save(); c.translate(S / 2, S / 2);
      c.fillStyle = '#0c0f14'; c.beginPath(); c.arc(0, 0, 100, 0, TAU); c.fill();
      c.strokeStyle = '#ff941f'; c.lineWidth = 4; c.setLineDash([22, 14]); c.beginPath(); c.arc(0, 0, 96, 0, TAU); c.stroke(); c.setLineDash([]);
      for (let k = 0; k < 8; k++) { c.save(); c.rotate((k / 8) * TAU); c.fillStyle = '#23282f'; c.fillRect(30, -10, 60, 20); c.strokeStyle = '#0a0c10'; c.strokeRect(30, -10, 60, 20); c.restore(); }
      c.restore();
    } else if (arena.id === 'cryo_vault') {
      pipe(c, 60, 80, S - 60, 80, 20, '#1e3a52'); pipe(c, 60, S - 80, S - 60, S - 80, 20, '#1e3a52');
      // frosted glass rotor window
      c.save(); c.translate(S / 2, S / 2);
      const gl = c.createRadialGradient(0, 0, 40, 0, 0, 330); gl.addColorStop(0, 'rgba(140,220,255,0.18)'); gl.addColorStop(1, 'rgba(60,120,180,0.03)');
      c.fillStyle = gl; c.beginPath(); c.arc(0, 0, 330, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(190,240,255,0.35)'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 330, 0, TAU); c.stroke();
      for (let k = 0; k < 12; k++) { c.save(); c.rotate((k / 12) * TAU); c.fillStyle = '#1a2a3a'; c.fillRect(318, -8, 20, 16); c.restore(); }
      c.restore();
      hexField(c, S, 44, 'rgba(140,220,255,0.06)');
    } else if (arena.id === 'lorentz_railyard') {
      for (const ty of [S * 0.32, S * 0.68]) { pipe(c, 75, ty, S - 75, ty, 14, '#6b4a1e'); c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(76,201,240,0.35)'; c.lineWidth = 2; c.setLineDash([14, 10]); c.beginPath(); c.moveTo(75, ty); c.lineTo(S - 75, ty); c.stroke(); c.restore(); }
      for (let x = 140; x < S - 100; x += 180) for (const ty of [S * 0.32, S * 0.68]) { c.fillStyle = '#20242c'; c.strokeStyle = '#ffd166'; c.lineWidth = 2; c.beginPath(); c.arc(x, ty, 14, 0, TAU); c.fill(); c.stroke(); }
      // chevrons
      c.save(); c.strokeStyle = 'rgba(255,209,102,0.25)'; c.lineWidth = 6; for (let y = 120; y < S - 100; y += 60) { c.beginPath(); c.moveTo(60, y); c.lineTo(80, y + 20); c.lineTo(60, y + 40); c.stroke(); c.beginPath(); c.moveTo(S - 60, y); c.lineTo(S - 80, y + 20); c.lineTo(S - 60, y + 40); c.stroke(); } c.restore();
    } else if (arena.id === 'tournament_pro') {
      c.save(); c.translate(S / 2, S / 2);
      for (const [r, w, col] of [[300, 10, 'rgba(255,255,255,0.1)'], [240, 3, 'rgba(255,148,31,0.5)'], [150, 2, 'rgba(255,255,255,0.18)']]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); }
      c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-300, 0); c.lineTo(300, 0); c.moveTo(0, -300); c.lineTo(0, 300); c.stroke();
      c.fillStyle = 'rgba(255,148,31,0.16)'; c.beginPath(); c.moveTo(0, -60); c.lineTo(52, 30); c.lineTo(-52, 30); c.closePath(); c.fill();
      c.restore();
    }

    // perimeter bulkhead + gussets
    const wallW = 34;
    c.fillStyle = '#0b0e13'; c.fillRect(0, 0, S, wallW); c.fillRect(0, S - wallW, S, wallW); c.fillRect(0, 0, wallW, S); c.fillRect(S - wallW, 0, wallW, S);
    const wg = c.createLinearGradient(0, 0, 0, wallW); wg.addColorStop(0, 'rgba(255,255,255,0.08)'); wg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = wg; c.fillRect(0, 0, S, wallW);
    c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 2; c.strokeRect(wallW, wallW, S - wallW * 2, S - wallW * 2);
    c.strokeStyle = arena.accent + '66'; c.lineWidth = 1.2; c.strokeRect(wallW + 4, wallW + 4, S - (wallW + 4) * 2, S - (wallW + 4) * 2);
    c.strokeStyle = arena.accent; c.lineWidth = 3.5;
    for (const [cx, cy, sx, sy] of [[wallW, wallW, 1, 1], [S - wallW, wallW, -1, 1], [wallW, S - wallW, 1, -1], [S - wallW, S - wallW, -1, -1]]) { c.beginPath(); c.moveTo(cx, cy + sy * 78); c.lineTo(cx, cy); c.lineTo(cx + sx * 78, cy); c.stroke(); }
    // inner drop shadow from walls
    const sh = c.createLinearGradient(wallW, 0, wallW + 40, 0); sh.addColorStop(0, 'rgba(0,0,0,0.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sh; c.fillRect(wallW, wallW, 40, S - wallW * 2);
    const sh2 = c.createLinearGradient(0, wallW, 0, wallW + 40); sh2.addColorStop(0, 'rgba(0,0,0,0.5)'); sh2.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sh2; c.fillRect(wallW, wallW, S - wallW * 2, 40);
    return cv;
  }

  // ── match init ────────────────────────────────────────────────────────────
  function initMatchArena(S) {
    activeArena = resolveArena(selectedArenaId);
    clearScars();
    R = { t: 0, wallPulses: [], pylons: [], gates: [], vents: [], cores: [], motes: [], slagTide: { cycle: 0, active: false, warn: false }, railOverload: { cycle: 5, active: false, warn: false, y: 0 }, leySurge: { cycle: 4, active: false, warn: false }, gust: { cycle: 6, active: false, warn: false, ang: 0 }, ledHits: [] };
    for (let i = 0; i < 30; i++) R.motes.push({ x: rnd(60, S - 60), y: rnd(60, S - 60), vx: rnd(-14, 14), vy: rnd(-34, -10), sz: rnd(1.2, 3.2), a: rnd(0.2, 0.7) });
    if (activeArena.id === 'scrap_foundry') { R.pylons = [{ x: S * 0.29, y: S * 0.29, r: 34, pulse: 0, kind: 'magnetic' }, { x: S * 0.71, y: S * 0.71, r: 34, pulse: 0, kind: 'magnetic' }]; R.vents = [{ x: S * 0.5, y: S * 0.5, r: 96, cycle: 2, active: false, warn: false }]; }
    else if (activeArena.id === 'cryo_vault') R.cores = [{ x: S * 0.3, y: S * 0.7, r: 36, intact: true, driftLeft: 0, respawn: 0 }, { x: S * 0.7, y: S * 0.3, r: 36, intact: true, driftLeft: 0, respawn: 0 }];
    else if (activeArena.id === 'lorentz_railyard') R.gates = [{ x: S * 0.34, y: S * 0.5, halfH: 92, pulse: 0 }, { x: S * 0.66, y: S * 0.5, halfH: 92, pulse: 0 }];
    else if (activeArena.id === 'prism_sanctum') R.pylons = [{ x: S * 0.32, y: S * 0.5, r: 36, pulse: 0, kind: 'prism', rot: 0 }, { x: S * 0.68, y: S * 0.5, r: 36, pulse: 0, kind: 'prism', rot: Math.PI / 4 }];
    HUD()?.arenaBanner?.({ title: activeArena.name, sub: activeArena.events, color: activeArena.accent, seconds: 2.6, kind: 'intro' });
  }

  function addScar(kind, x, y, radius = 28, angle = 0, color = null) {
    if (!scarCtx) return;
    scarCtx.save(); scarCtx.translate(x, y); scarCtx.rotate(angle);
    if (kind === 'scorch') { const gr = scarCtx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius); gr.addColorStop(0, 'rgba(4,5,8,0.7)'); gr.addColorStop(0.5, 'rgba(26,20,16,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); scarCtx.fillStyle = gr; scarCtx.beginPath(); scarCtx.arc(0, 0, radius, 0, TAU); scarCtx.fill(); scarCtx.strokeStyle = 'rgba(255,140,40,0.18)'; scarCtx.lineWidth = 1.5; for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU + hash(k); scarCtx.beginPath(); scarCtx.moveTo(Math.cos(a) * radius * 0.3, Math.sin(a) * radius * 0.3); scarCtx.lineTo(Math.cos(a + 0.2) * radius * 0.95, Math.sin(a + 0.2) * radius * 0.95); scarCtx.stroke(); } }
    else if (kind === 'slash') { scarCtx.strokeStyle = color || 'rgba(255,220,160,0.26)'; scarCtx.lineWidth = 2.6; scarCtx.beginPath(); scarCtx.moveTo(-radius, 0); scarCtx.lineTo(radius, 0); scarCtx.stroke(); scarCtx.strokeStyle = 'rgba(0,0,0,0.35)'; scarCtx.lineWidth = 1; scarCtx.beginPath(); scarCtx.moveTo(-radius, 2); scarCtx.lineTo(radius, 2); scarCtx.stroke(); }
    else if (kind === 'frost') { const gr = scarCtx.createRadialGradient(0, 0, 2, 0, 0, radius); gr.addColorStop(0, 'rgba(170,240,255,0.3)'); gr.addColorStop(1, 'rgba(90,200,255,0)'); scarCtx.fillStyle = gr; scarCtx.beginPath(); scarCtx.arc(0, 0, radius, 0, TAU); scarCtx.fill(); const V = VFX(); if (V) { scarCtx.globalAlpha = 0.5; for (let k = 0; k < 6; k++) { scarCtx.save(); scarCtx.rotate((k / 6) * TAU); V.drawDendrite(scarCtx, 0, 0, radius * 0.85, 0, 2, 'rgba(210,248,255,0.7)', 2); scarCtx.restore(); } } }
    scarCtx.restore();
  }
  function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

  // Hazard avoidance field for Tactical AI (unit vector away from danger)
  function hazardVector(f) {
    if (!R) return null; let x = 0, y = 0;
    for (const v of R.vents) if (v.active || v.warn) { const d = Math.hypot(f.x - v.x, f.y - v.y); if (d < v.r + 120) { x += (f.x - v.x) / (d || 1); y += (f.y - v.y) / (d || 1); } }
    if (R.railOverload.warn || R.railOverload.active) { const dy = f.y - R.railOverload.y; if (Math.abs(dy) < 110) y += dy > 0 ? 1 : -1; }
    const m = Math.hypot(x, y); return m > 0.01 ? { x: x / m, y: y / m } : null;
  }

  // ── simulation ─────────────────────────────────────────────────────────────
  function stepArenaMechanics(dt) {
    if (!R) return;
    const S = g.GAME_SIZE || 1000; R.t += dt;
    for (const m of R.motes) { m.x += m.vx * dt; m.y += m.vy * dt; if (m.y < 45) { m.y = S - 50; m.x = rnd(60, S - 60); } if (m.x < 45) m.x = S - 50; if (m.x > S - 45) m.x = 50; }
    for (let i = R.wallPulses.length - 1; i >= 0; i--) { R.wallPulses[i].life -= dt; if (R.wallPulses[i].life <= 0) R.wallPulses.splice(i, 1); }
    for (let i = R.ledHits.length - 1; i >= 0; i--) { R.ledHits[i].life -= dt; if (R.ledHits[i].life <= 0) R.ledHits.splice(i, 1); }
    const fighters = g.fighters || [], projs = g.projectiles || [], wm = 46;

    for (let idx = 0; idx < fighters.length; idx++) {
      const f = fighters[idx]; if (!f || f.hp <= 0) continue;
      const Rr = f.radius || 75, col = idx === 0 ? '#ff941f' : '#4cc9f0';
      const hit = (side, pos, nx, ny) => { R.wallPulses.push({ side, pos, col, life: 0.45 }); CB()?.onWallBounce?.(f, idx, nx, ny); };
      if (f.x - Rr <= wm && (f.__wcL || 0) <= 0) { f.__wcL = 0.25; hit('L', f.y, 1, 0); } else if (f.x + Rr >= S - wm && (f.__wcR || 0) <= 0) { f.__wcR = 0.25; hit('R', f.y, -1, 0); }
      if (f.y - Rr <= wm && (f.__wcT || 0) <= 0) { f.__wcT = 0.25; hit('T', f.x, 0, 1); } else if (f.y + Rr >= S - wm && (f.__wcB || 0) <= 0) { f.__wcB = 0.25; hit('B', f.x, 0, -1); }
      f.__wcL = Math.max(0, (f.__wcL || 0) - dt); f.__wcR = Math.max(0, (f.__wcR || 0) - dt); f.__wcT = Math.max(0, (f.__wcT || 0) - dt); f.__wcB = Math.max(0, (f.__wcB || 0) - dt);
    }

    // Pylons / monoliths
    for (const py of R.pylons) {
      py.pulse = Math.max(0, py.pulse - dt * 2.5); if (py.kind === 'prism') py.rot = (py.rot || 0) + dt * 0.65;
      for (const f of fighters) {
        if (!f || f.hp <= 0) continue;
        const dx = f.x - py.x, dy = f.y - py.y, d = Math.hypot(dx, dy), minD = (f.radius || 75) + py.r;
        if (d > 0.001 && d < minD) {
          const nx = dx / d, ny = dy / d; f.x = py.x + nx * (minD + 2); f.y = py.y + ny * (minD + 2);
          if (f.dir) { const dot = f.dir.x * nx + f.dir.y * ny; if (dot < 0) { f.dir.x -= 2 * dot * nx; f.dir.y -= 2 * dot * ny; } }
          f.__evoSpeedBoost = Math.max(f.__evoSpeedBoost || 0, 0.55); py.pulse = 1;
          SH()?.spawnShockwave?.(py.x, py.y, 0.28, 190, 620, 0.85); AU()?.playRicochetBoost?.();
          VFX()?.recipes.impactSparks(py.x + nx * py.r, py.y + ny * py.r, 10, py.kind === 'prism' ? '#e0aaff' : '#ffb347', py.y + py.r);
          CB()?.onArenaEvent?.('pylon', py.x, py.y);
        }
      }
      if (py.kind === 'prism') for (const p of projs) {
        if (!p || p.__prismSplit || typeof p.x !== 'number') continue;
        if (Math.hypot(p.x - py.x, p.y - py.y) < py.r + (p.radius || 8)) {
          p.__prismSplit = true; const ang = Math.atan2(p.vy || 0, p.vx || 1) + 0.34, spd = Math.hypot(p.vx || 0, p.vy || 0) * 1.12;
          if (spd > 40) { p.vx = Math.cos(ang) * spd; p.vy = Math.sin(ang) * spd; } p.color = '#e0aaff'; py.pulse = 1; py.beam = { a: ang, t: 0.25 };
          VFX()?.recipes.crystalShatter(p.x, p.y, 4, 'violet'); SH()?.pushLight?.(py.x, py.y, 0.88, 0.52, 1, 180, 0.9);
        }
      }
      if (py.beam) { py.beam.t -= dt; if (py.beam.t <= 0) py.beam = null; }
    }

    // FOUNDRY: solar vent + slag tide
    for (const v of R.vents) {
      v.cycle = (v.cycle + dt) % 11;
      const wasActive = v.active, wasWarn = v.warn;
      v.warn = v.cycle >= 3.5 && v.cycle < 5.5; v.active = v.cycle >= 5.5 && v.cycle < 9.5;
      if (v.warn && !wasWarn) HUD()?.arenaBanner?.({ title: 'FORGE VENT CHARGING', sub: 'CENTER HATCH · 2.0S', color: '#ff941f', seconds: 2.0, kind: 'warn' });
      if (v.active && !wasActive) { HUD()?.arenaBanner?.({ title: 'SOLAR FORGE ERUPTION', sub: 'SHOTS THROUGH THE VENT BURN +25%', color: '#ff4d29', seconds: 4.0, kind: 'active' }); VFX()?.recipes.explosion(v.x, v.y, 40, v.y + 40); SH()?.spawnShockwave?.(v.x, v.y, 0.4, 320, 700, 1); AU()?.playArenaEvent?.('forge'); CB()?.onArenaEvent?.('vent', v.x, v.y); }
      if (v.active) {
        SH()?.pushLight?.(v.x, v.y, 1, 0.45, 0.1, v.r * 2.2, 0.8);
        if (Math.random() < 0.9) { const a = Math.random() * TAU, rr = Math.random() * v.r * 0.8; VFX()?.emit({ tex: 'fire', x: v.x + Math.cos(a) * rr, y: v.y + Math.sin(a) * rr, vx: rnd(-20, 20), vy: rnd(-160, -60), life: rnd(0.4, 0.8), s0: rnd(26, 46), s1: 6, tint: '#ffb347', layer: 'over' }); }
        for (const p of projs) { if (!p || p.__solarIgnited || typeof p.x !== 'number') continue; if (Math.hypot(p.x - v.x, p.y - v.y) <= v.r) { p.__solarIgnited = true; if (typeof p.damage === 'number') p.damage *= 1.25; if (typeof p.dmg === 'number') p.dmg *= 1.25; p.color = '#ff9f1c'; } }
        for (const f of fighters) if (f && f.hp > 0 && Math.hypot(f.x - v.x, f.y - v.y) < v.r * 0.8) f.takeDamage?.(14 * dt, null, 'Forge Heat', true);
      }
    }

    // CRYO: cores + rotor gust
    for (const cc of R.cores) {
      if (cc.intact) { for (const p of projs) { if (!p || typeof p.x !== 'number') continue; if (Math.hypot(p.x - cc.x, p.y - cc.y) < cc.r + 10) { cc.intact = false; cc.driftLeft = 6; cc.respawn = 12; addScar('frost', cc.x, cc.y, 125); VFX()?.recipes.frostBloom(cc.x, cc.y, 90); SH()?.spawnShockwave?.(cc.x, cc.y, 0.45, 280, 640, 0.95); AU()?.playArenaEvent?.('cryo'); HUD()?.arenaBanner?.({ title: 'COOLANT CORE SHATTERED', sub: 'GLACIAL DRIFT ZONE · +SPEED 6S', color: '#5ce1ff', seconds: 2.4, kind: 'active' }); CB()?.onArenaEvent?.('core', cc.x, cc.y); g.cameraShake = Math.max(g.cameraShake || 0, 7); break; } } }
      else { if (cc.driftLeft > 0) { cc.driftLeft -= dt; SH()?.pushLight?.(cc.x, cc.y, 0.3, 0.88, 1, 175, 0.45); if (Math.random() < 0.3) VFX()?.emit({ tex: 'smoke', blend: 'source-over', x: cc.x + rnd(-90, 90), y: cc.y + rnd(-90, 90), vx: 0, vy: -20, life: 1.2, s0: 30, s1: 70, a0: 0.25, tint: '#9fe8ff', layer: 'under' }); for (const f of fighters) if (f && f.hp > 0 && Math.hypot(f.x - cc.x, f.y - cc.y) < 125) f.__evoSpeedBoost = Math.max(f.__evoSpeedBoost || 0, 0.25); } cc.respawn -= dt; if (cc.respawn <= 0) { cc.intact = true; VFX()?.recipes.frostBloom(cc.x, cc.y, 40); } }
    }
    if (activeArena.id === 'cryo_vault') {
      const gu = R.gust; gu.cycle = (gu.cycle + dt) % 14; const wasW = gu.warn, wasA = gu.active;
      gu.warn = gu.cycle >= 8 && gu.cycle < 9.6; gu.active = gu.cycle >= 9.6 && gu.cycle < 12;
      if (gu.warn && !wasW) { gu.ang = Math.random() * TAU; HUD()?.arenaBanner?.({ title: 'ROTOR GUST BUILDING', sub: 'BRACE · 1.6S', color: '#90f1ff', seconds: 1.6, kind: 'warn' }); }
      if (gu.active && !wasA) { HUD()?.arenaBanner?.({ title: 'CRYO GUST', sub: 'PUSHES EVERYTHING · SLOWS', color: '#5ce1ff', seconds: 2.4, kind: 'active' }); AU()?.playArenaEvent?.('cryo'); CB()?.onArenaEvent?.('gust', S / 2, S / 2); }
      if (gu.active) { for (const f of fighters) if (f && f.hp > 0) { f.x = clamp(f.x + Math.cos(gu.ang) * 150 * dt, 110, S - 110); f.y = clamp(f.y + Math.sin(gu.ang) * 150 * dt, 110, S - 110); } for (const p of projs) if (p && typeof p.vx === 'number') { p.vx += Math.cos(gu.ang) * 900 * dt; p.vy += Math.sin(gu.ang) * 900 * dt; } if (Math.random() < 0.95) VFX()?.emit({ tex: 'frost', x: rnd(80, S - 80), y: rnd(80, S - 80), vx: Math.cos(gu.ang) * 420, vy: Math.sin(gu.ang) * 420, life: 0.6, s0: 20, s1: 10, a0: 0.5, tint: '#bff5ff', spin: 3, layer: 'over' }); }
    }

    // RAILYARD: gates + rail overload sweep
    for (const gt of R.gates) {
      gt.pulse = Math.max(0, gt.pulse - dt * 2.8); SH()?.pushLight?.(gt.x, gt.y, 0.35, 0.85, 1, 145, 0.32 + gt.pulse * 0.5);
      for (const f of fighters) { if (!f || f.hp <= 0) continue; if (Math.abs(f.x - gt.x) < 28 && Math.abs(f.y - gt.y) < gt.halfH && (f.__gateCd || 0) <= 0) { f.__gateCd = 1.1; f.__evoSpeedBoost = Math.max(f.__evoSpeedBoost || 0, 0.85); gt.pulse = 1; gt.arcT = 0.2; AU()?.playArenaEvent?.('lorentz'); VFX()?.recipes.plasmaBurst(f.x, f.y, 90, '#72efdd'); CB()?.callout?.(f.x, f.y - 100, 'ACCELERATED', '#72efdd', 0.9); CB()?.onArenaEvent?.('gate', gt.x, gt.y); } f.__gateCd = Math.max(0, (f.__gateCd || 0) - dt); }
      for (const p of projs) { if (!p || p.__lorentzBoosted || typeof p.x !== 'number') continue; if (Math.abs(p.x - gt.x) < 26 && Math.abs(p.y - gt.y) < gt.halfH) { p.__lorentzBoosted = true; if (typeof p.vx === 'number') p.vx *= 1.38; if (typeof p.vy === 'number') p.vy *= 1.38; if (typeof p.speed === 'number') p.speed *= 1.38; p.color = '#72efdd'; gt.pulse = 1; gt.arcT = 0.15; } }
      if (gt.arcT) { gt.arcT -= dt; if (gt.arcT <= 0) gt.arcT = 0; }
    }
    if (activeArena.id === 'lorentz_railyard') {
      const ro = R.railOverload; ro.cycle = (ro.cycle + dt) % 13; const wasW = ro.warn, wasA = ro.active;
      ro.warn = ro.cycle >= 7 && ro.cycle < 8.6; ro.active = ro.cycle >= 8.6 && ro.cycle < 10.2;
      if (ro.warn && !wasW) { ro.y = Math.random() < 0.5 ? S * 0.32 : S * 0.68; HUD()?.arenaBanner?.({ title: 'RAIL OVERLOAD', sub: (ro.y < S / 2 ? 'UPPER' : 'LOWER') + ' INDUCTION RAIL · CLEAR IT', color: '#ffd166', seconds: 1.6, kind: 'warn' }); }
      if (ro.active && !wasA) { HUD()?.arenaBanner?.({ title: 'DISCHARGE', sub: 'RAIL ARC LIVE', color: '#4cc9f0', seconds: 1.6, kind: 'active' }); AU()?.playArenaEvent?.('lorentz'); CB()?.onArenaEvent?.('overload', S / 2, ro.y); }
      if (ro.active) { for (const f of fighters) if (f && f.hp > 0 && Math.abs(f.y - ro.y) < 70 && (f.__railZap || 0) <= 0) { f.__railZap = 0.5; f.takeDamage?.(38, null, 'Rail Overload'); f.applyStatus?.('stun', 0.3); VFX()?.recipes.plasmaBurst(f.x, f.y, 80, '#72efdd'); } for (const f of fighters) if (f) f.__railZap = Math.max(0, (f.__railZap || 0) - dt); }
    }

    // SANCTUM: ley surge
    if (activeArena.id === 'prism_sanctum') {
      const ls = R.leySurge; ls.cycle = (ls.cycle + dt) % 12; const wasW = ls.warn, wasA = ls.active;
      ls.warn = ls.cycle >= 6 && ls.cycle < 7.4; ls.active = ls.cycle >= 7.4 && ls.cycle < 10;
      if (ls.warn && !wasW) HUD()?.arenaBanner?.({ title: 'LEY-LINES CHARGING', sub: 'STAND ON A LINE FOR SURGE', color: '#c77dff', seconds: 1.4, kind: 'warn' });
      if (ls.active && !wasA) { HUD()?.arenaBanner?.({ title: 'LEY SURGE', sub: 'ON-LINE: +SPEED · +SYNC', color: '#e0aaff', seconds: 2.6, kind: 'active' }); CB()?.onArenaEvent?.('ley', S / 2, S / 2); }
      if (ls.active) for (let i = 0; i < fighters.length; i++) { const f = fighters[i]; if (!f || f.hp <= 0) continue; const onLine = Math.abs(f.x - S / 2) < 40 || Math.abs(f.y - S / 2) < 40 || Math.abs((f.x - f.y)) < 56 || Math.abs((f.x + f.y) - S) < 56; if (onLine) { f.__evoSpeedBoost = Math.max(f.__evoSpeedBoost || 0, 0.3); CB()?.addStyleAndSync?.(i, 0, 6 * dt); if (Math.random() < 0.4) VFX()?.emit({ tex: 'glow', x: f.x + rnd(-40, 40), y: f.y + rnd(-40, 40), vx: 0, vy: -60, life: 0.5, s0: 12, s1: 2, tint: '#e0aaff' }); } }
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  function drawArenaFloor(c, S) {
    const key = `${S}:${activeArena.id}:${matImgs[activeArena.material]?.complete ? 1 : 0}`;
    if (!deckCanvas || deckKey !== key) { deckCanvas = buildDeck(S, activeArena); deckKey = key; }
    ensureScar(S);
    const t = R ? R.t : 0;
    c.save();
    c.drawImage(deckCanvas, 0, 0);

    // live sub-floor machinery
    if (activeArena.id === 'cryo_vault') { c.save(); c.translate(S / 2, S / 2); c.rotate(t * (R?.gust?.active ? 1.6 : 0.35)); c.strokeStyle = 'rgba(92,225,255,0.1)'; c.lineWidth = 16; c.lineCap = 'round'; for (let b = 0; b < 6; b++) { const a = (b / 6) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 45, Math.sin(a) * 45); c.quadraticCurveTo(Math.cos(a + 0.5) * 180, Math.sin(a + 0.5) * 180, Math.cos(a + 0.3) * 310, Math.sin(a + 0.3) * 310); c.stroke(); } c.restore(); }
    if (activeArena.id === 'scrap_foundry') { for (const tx of [S * 0.24, S * 0.76]) { c.save(); c.globalCompositeOperation = 'lighter'; const a = 0.18 + 0.1 * Math.sin(t * 2 + tx); const gg = c.createLinearGradient(tx - 26, 0, tx + 26, 0); gg.addColorStop(0, 'rgba(255,100,20,0)'); gg.addColorStop(0.5, `rgba(255,140,30,${a})`); gg.addColorStop(1, 'rgba(255,100,20,0)'); c.fillStyle = gg; c.fillRect(tx - 26, 90, 52, S - 180); c.restore(); if (Math.random() < 0.15) VFX()?.emit({ tex: 'glow', x: tx + rnd(-16, 16), y: rnd(100, S - 100), vx: 0, vy: -50, life: 0.8, s0: 6, s1: 2, tint: '#ffb347', layer: 'under' }); } }
    if (activeArena.id === 'lorentz_railyard' && R) { const ro = R.railOverload; if (ro.warn || ro.active) { c.save(); c.globalCompositeOperation = 'lighter'; const a = ro.active ? 0.5 + 0.3 * Math.sin(t * 40) : 0.2 + 0.15 * Math.sin(t * 12); const lg = c.createLinearGradient(0, ro.y - 70, 0, ro.y + 70); lg.addColorStop(0, 'rgba(114,239,221,0)'); lg.addColorStop(0.5, `rgba(114,239,255,${a})`); lg.addColorStop(1, 'rgba(114,239,221,0)'); c.fillStyle = lg; c.fillRect(75, ro.y - 70, S - 150, 140); if (ro.active) VFX()?.drawLightning(c, 80, ro.y + rnd(-20, 20), S - 80, ro.y + rnd(-20, 20), 6, 'rgba(160,245,255,0.95)', 3, 0.12, 3); c.restore(); } }
    if (activeArena.id === 'prism_sanctum' && R?.leySurge?.active) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(224,170,255,${0.35 + 0.25 * Math.sin(t * 10)})`; c.lineWidth = 14; c.lineCap = 'round'; for (const [x0, y0, x1, y1] of [[S / 2, 60, S / 2, S - 60], [60, S / 2, S - 60, S / 2], [120, 120, S - 120, S - 120], [S - 120, 120, 120, S - 120]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); } c.restore(); }

    if (scarCanvas) c.drawImage(scarCanvas, 0, 0);
    if (!R) { c.restore(); return; }

    // vents
    for (const v of R.vents) {
      c.save(); c.translate(v.x, v.y);
      if (v.active || v.warn) { const alpha = v.active ? 0.5 + 0.2 * Math.sin(t * 14) : 0.18 + 0.12 * Math.sin(t * 9); const vg = c.createRadialGradient(0, 0, 10, 0, 0, v.r); vg.addColorStop(0, `rgba(255,220,120,${alpha})`); vg.addColorStop(0.6, `rgba(255,90,24,${alpha * 0.75})`); vg.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = vg; c.beginPath(); c.arc(0, 0, v.r, 0, TAU); c.fill(); }
      if (v.warn) { const u = (v.cycle - 3.5) / 2; c.strokeStyle = '#ffae34'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, v.r + 8, -Math.PI / 2, -Math.PI / 2 + u * TAU); c.stroke(); }
      c.strokeStyle = v.active ? '#ffae34' : v.warn ? 'rgba(255,160,48,0.65)' : 'rgba(255,255,255,0.12)'; c.lineWidth = v.active ? 3 : 1.8; c.setLineDash([10, 8]); c.beginPath(); c.arc(0, 0, v.r, t * 0.6, t * 0.6 + TAU); c.stroke(); c.setLineDash([]);
      c.restore();
    }
    // cores
    for (const cc of R.cores) {
      c.save(); c.translate(cc.x, cc.y);
      if (!cc.intact && cc.driftLeft > 0) { const dg = c.createRadialGradient(0, 0, 12, 0, 0, 125); dg.addColorStop(0, 'rgba(114,239,255,0.3)'); dg.addColorStop(0.7, 'rgba(56,182,255,0.14)'); dg.addColorStop(1, 'rgba(56,182,255,0)'); c.fillStyle = dg; c.beginPath(); c.arc(0, 0, 125, 0, TAU); c.fill(); }
      if (cc.intact) { c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.ellipse(0, 10, cc.r * 1.05, cc.r * 0.7, 0, 0, TAU); c.fill(); c.fillStyle = '#1a2a3a'; c.strokeStyle = '#8fe9ff'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, cc.r + 8, 0, TAU); c.fill(); c.stroke(); c.save(); c.rotate(t * 0.5); VFX()?.drawShard(c, cc.r * 1.1, cc.r * 0.55, 195, 1); c.restore(); c.save(); c.rotate(t * 0.5 + Math.PI / 2); VFX()?.drawShard(c, cc.r * 0.85, cc.r * 0.42, 195, 0.9); c.restore(); }
      else if (cc.respawn < 3) { c.globalAlpha = 1 - cc.respawn / 3; c.strokeStyle = '#8fe9ff'; c.lineWidth = 2; c.setLineDash([4, 6]); c.beginPath(); c.arc(0, 0, cc.r + 8, 0, TAU); c.stroke(); }
      c.restore();
    }
    // gates
    for (const gt of R.gates) {
      c.save(); c.translate(gt.x, gt.y);
      const beam = 0.26 + gt.pulse * 0.58 + 0.08 * Math.sin(t * 16);
      const lg = c.createLinearGradient(-18, 0, 18, 0); lg.addColorStop(0, 'rgba(76,201,240,0)'); lg.addColorStop(0.5, `rgba(114,245,255,${beam})`); lg.addColorStop(1, 'rgba(76,201,240,0)');
      c.fillStyle = lg; c.fillRect(-18, -gt.halfH, 36, gt.halfH * 2);
      for (const sy of [-gt.halfH, gt.halfH]) { c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(0, sy + 6, 20, 9, 0, 0, TAU); c.fill(); c.fillStyle = '#232936'; c.strokeStyle = '#ffd166'; c.lineWidth = 2.4; c.beginPath(); c.arc(0, sy, 14, 0, TAU); c.fill(); c.stroke(); for (let k = 0; k < 3; k++) { c.strokeStyle = 'rgba(234,168,72,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, sy, 5 + k * 3, 0, TAU); c.stroke(); } }
      if (gt.arcT > 0 || Math.random() < 0.08) VFX()?.drawLightning(c, 0, -gt.halfH, 0, gt.halfH, 5, 'rgba(160,245,255,0.9)', 2, 0.2, 1);
      c.restore();
    }
    // pylons / monoliths
    for (const py of R.pylons) {
      c.save(); c.translate(py.x, py.y);
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.ellipse(0, 10, py.r * 1.1, py.r * 0.8, 0, 0, TAU); c.fill();
      if (py.kind === 'prism') {
        if (py.beam) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = py.beam.t * 4; c.rotate(py.beam.a); const bg = c.createLinearGradient(0, 0, 260, 0); bg.addColorStop(0, 'rgba(255,255,255,0.9)'); bg.addColorStop(0.3, 'rgba(224,170,255,0.6)'); bg.addColorStop(0.6, 'rgba(255,158,187,0.4)'); bg.addColorStop(1, 'rgba(199,125,255,0)'); c.strokeStyle = bg; c.lineWidth = 8; c.beginPath(); c.moveTo(py.r, 0); c.lineTo(260, 0); c.stroke(); c.restore(); }
        c.save(); c.rotate(py.rot || 0); VFX()?.drawShard(c, py.r * 1.3, py.r * 0.6, 275, 1); c.restore();
        c.save(); c.rotate((py.rot || 0) + Math.PI / 2); VFX()?.drawShard(c, py.r * 1.0, py.r * 0.45, 285, 0.9); c.restore();
      } else {
        c.fillStyle = '#1b212c'; c.strokeStyle = py.pulse > 0.1 ? '#ffd166' : '#ff941f'; c.lineWidth = 3 + py.pulse * 3; c.beginPath(); c.arc(0, 0, py.r, 0, TAU); c.fill(); c.stroke();
        for (let k = 0; k < 6; k++) { c.save(); c.rotate((k / 6) * TAU + t * 0.4); c.fillStyle = '#2b3240'; c.fillRect(py.r * 0.45, -5, py.r * 0.5, 10); c.restore(); }
        c.fillStyle = '#ff941f'; c.beginPath(); c.arc(0, 0, py.r * (0.32 + py.pulse * 0.2), 0, TAU); c.fill();
      }
      c.restore();
    }
    // wall pulses + pro LED telemetry
    const wallW = 34;
    for (const wp of R.wallPulses) { const a = clamp(wp.life / 0.45, 0, 1); c.save(); c.globalAlpha = a * 0.9; c.strokeStyle = wp.col; c.lineWidth = 5; c.beginPath(); if (wp.side === 'L') { c.moveTo(wallW + 2, wp.pos - 75 * a); c.lineTo(wallW + 2, wp.pos + 75 * a); } else if (wp.side === 'R') { c.moveTo(S - wallW - 2, wp.pos - 75 * a); c.lineTo(S - wallW - 2, wp.pos + 75 * a); } else if (wp.side === 'T') { c.moveTo(wp.pos - 75 * a, wallW + 2); c.lineTo(wp.pos + 75 * a, wallW + 2); } else { c.moveTo(wp.pos - 75 * a, S - wallW - 2); c.lineTo(wp.pos + 75 * a, S - wallW - 2); } c.stroke(); c.restore(); }
    if (activeArena.id === 'tournament_pro') { const st = CB()?.getState?.(); const r0 = st ? Math.max(st.sides[0].styleScore, st.sides[1].styleScore) / 155 : 0; c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,148,31,${0.2 + r0 * 0.6})`; c.lineWidth = 3; c.strokeRect(wallW + 8, wallW + 8, S - (wallW + 8) * 2, S - (wallW + 8) * 2); c.restore(); }

    // contact shadows
    for (const f of g.fighters || []) { if (!f || f.hp <= 0) continue; const Rr = f.radius || 75; const lift = f.__evoAirborne ? 0.5 : 1; const sg = c.createRadialGradient(f.x, f.y + Rr * 0.22, Rr * 0.12, f.x, f.y + Rr * 0.22, Rr * 1.15); sg.addColorStop(0, `rgba(0,0,0,${0.56 * lift})`); sg.addColorStop(0.65, `rgba(0,0,0,${0.22 * lift})`); sg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.beginPath(); c.ellipse(f.x, f.y + Rr * 0.22, Rr * 1.05 * lift, Rr * 0.72 * lift, 0, 0, TAU); c.fill(); }
    // motes
    const mc = activeArena.id === 'cryo_vault' ? '140,238,255' : activeArena.id === 'prism_sanctum' ? '205,148,255' : activeArena.id === 'lorentz_railyard' ? '114,239,255' : activeArena.id === 'tournament_pro' ? '255,255,255' : '255,158,64';
    for (const m of R.motes) { c.fillStyle = `rgba(${mc},${m.a * 0.42})`; c.beginPath(); c.arc(m.x, m.y, m.sz, 0, TAU); c.fill(); }
    c.restore();
  }

  g.APEX_EVOLUTION_ARENAS = {
    catalog: () => ARENA_CATALOG.slice(),
    getSelectedId: () => selectedArenaId,
    setSelectedId(id) { if (id !== 'random' && !ARENA_CATALOG.some(a => a.id === id)) return selectedArenaId; selectedArenaId = id; try { localStorage.setItem('apexEvolution.arenaId', id); } catch (_) {} if (id !== 'random') activeArena = resolveArena(id); return selectedArenaId; },
    getActiveArena: () => activeArena,
    initMatchArena, stepArenaMechanics, drawArenaFloor, addScar, clearScars, hazardVector,
    runtime: () => R,
  };
  g.apexEvolutionArenas = 'ready';
})(window);
