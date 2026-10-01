// ARSENAL CHAMBER-01 PALETTES + ADAPTIVE READABILITY (2026-09-29 §D).
// Presentation-only: floor repaint + neutral combat-layer readability gains.
// No geometry, spawn, collision, weapon-law or damage changes live here.
//
// Law summary:
//  - Curated palettes, persisted as `arenaPaletteId` inside the existing
//    arsenalMeta authority (`apexChaos.arsenalMeta.v1`) — no second storage.
//  - Chamber surface cache keyed (GAME_SIZE, paletteId); rebuilt exactly once
//    per key change; the frame path is a single cached drawImage.
//  - Readability profile is computed ONCE per palette at module init from the
//    palette's own color metadata (luminance/chroma math on the hex values —
//    never pixel sampling, never per-frame work).
//  - Adaptation is mild brightness/contrast/saturation baked into the cached
//    floor, plus a neutral drop-shadow OR emissive rim on the combat layer
//    (identity hues preserved). NO ctx.filter anywhere; VFX, damage numbers,
//    floor grid geometry and UI are untouched by wrappers.
(function apexArsenalChamberPaletteRuntime() {
  'use strict';
  if (window.apexArsenalChamberPaletteRuntime === 'ready') return;

  // ---- tiny color math (metadata level) ------------------------------------
  function rgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return { r: 128, g: 128, b: 128 };
    const v = parseInt(m[1], 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
  }
  function lum(hex) {
    const c = rgb(hex);
    return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  }
  function chroma(hex) {
    const c = rgb(hex);
    return (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)) / 255;
  }
  function shade(hex, dl, ds) {
    // mild HSL lift: dl adds lightness, ds multiplies saturation (both ~0).
    const c = rgb(hex);
    let r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    const L = Math.max(0, Math.min(1, l + dl));
    const S = Math.max(0, Math.min(1, s * ds));
    const q = L < 0.5 ? L * (1 + S) : L + S - L * S, p = 2 * L - q;
    const f = (t) => {
      t = ((t % 1) + 1) % 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const to = (x) => Math.round(f(x) * 255);
    return `rgb(${to(h + 1 / 3)},${to(h)},${to(h - 1 / 3)})`;
  }
  function rgba(hex, a, dl = 0, ds = 1) {
    const m = shade(hex, dl, ds).match(/\d+/g);
    return `rgba(${m[0]},${m[1]},${m[2]},${a})`;
  }

  // ---- curated palettes -----------------------------------------------------
  // floor: identity colors; profile fields derived once below.
  const PALETTES = [
    { id: 'graphite-mid', label: 'GRAPHITE · MID', floor: { base: '#626A74', inner: '#727B86', outer: '#4F5761', wall: '#3C434C', rail: '#2C3239' } },
    { id: 'graphite-dark', label: 'GRAPHITE · DARK', floor: { base: '#3B414A', inner: '#474E58', outer: '#2B3138', wall: '#22272E', rail: '#171B20' } },
    { id: 'navy-steel', label: 'NAVY · STEEL', floor: { base: '#33415C', inner: '#3F5070', outer: '#253149', wall: '#1C2537', rail: '#121A29' } },
    { id: 'teal-deep', label: 'DEEP TEAL', floor: { base: '#2E4B4A', inner: '#395C5A', outer: '#20393A', wall: '#172B2C', rail: '#0F2021' } },
    { id: 'oxide-warm', label: 'WARM OXIDE', floor: { base: '#5A4636', inner: '#6B5543', outer: '#453529', wall: '#31241B', rail: '#221912' } },
    { id: 'violet-slate', label: 'VIOLET · SLATE', floor: { base: '#46395B', inner: '#54466C', outer: '#342B45', wall: '#241D33', rail: '#181324' } },
    { id: 'bone-light', label: 'BONE · LIGHT', floor: { base: '#B7BCC4', inner: '#CBD0D7', outer: '#9FA5AE', wall: '#7B818B', rail: '#656B75' } },
  ];

  // Read-once readability profile per palette: luminance/chroma of the floor
  // identity decide (a) the mild baked floor correction and (b) the neutral
  // combat-layer adaptation. Nothing here runs per frame.
  for (const p of PALETTES) {
    const L = lum(p.floor.base), C = chroma(p.floor.base);
    const dark = L < 0.32, light = L > 0.62;
    p.profile = {
      luminance: +L.toFixed(3),
      chroma: +C.toFixed(3),
      // baked floor correction (mild, identity-preserving)
      floorLift: dark ? 0.02 : light ? -0.02 : 0,
      floorContrastSat: 1 + (C < 0.08 ? 0.06 : 0.02),
      // neutral combat-layer adaptation: dark floors get a soft emissive rim
      // (light neutral glow separates dark bodies), light floors get a neutral
      // drop shadow. Identity hues are never shifted.
      shadow: dark ? 'rgba(240,240,240,0.34)' : light ? 'rgba(10,10,10,0.42)' : 'rgba(8,8,8,0.35)',
      blur: dark ? 9 : light ? 10 : 8,
      offset: dark ? 0 : 3,
      keyline: dark ? 'rgba(6,8,12,0.5)' : 'rgba(240,244,250,0.35)',
      sil: dark ? '#e8ecf2' : '#101318',
    };
  }

  // ---- persistence via the existing arsenalMeta authority -------------------
  function meta() { return window.APEX_ARSENAL_META || null; }
  function currentId() {
    const m = meta();
    const id = m && m.palette ? m.palette() : null;
    return PALETTES.some((p) => p.id === id) ? id : 'graphite-mid';
  }
  function current() { return PALETTES.find((p) => p.id === currentId()) || PALETTES[0]; }
  function select(id) {
    const m = meta();
    if (!PALETTES.some((p) => p.id === id) || !m || !m.setPalette) return false;
    m.setPalette(id);
    refreshSelector();
    return true;
  }

  // ---- chamber surface cache keyed (size, palette) --------------------------
  const cache = new Map();
  const stats = { builds: 0, hits: 0, draws: 0, lastKey: null };
  function surface(S) {
    const key = S + '|' + currentId();
    const hit = cache.get(key);
    stats.draws += 1;
    if (hit) { stats.hits += 1; stats.lastKey = key; return { canvas: hit, rebuilt: false }; }
    let el;
    if (typeof OffscreenCanvas !== 'undefined') { try { el = new OffscreenCanvas(S, S); } catch (e) { el = null; } }
    if (!el) { el = document.createElement('canvas'); el.width = S; el.height = S; }
    paint(el.getContext('2d'), S, current());
    cache.set(key, el);
    while (cache.size > 4) cache.delete(cache.keys().next().value);
    stats.builds += 1; stats.lastKey = key;
    return { canvas: el, rebuilt: true };
  }
  function statsSnapshot() { return Object.assign({}, stats); }

  // ---- the Chamber-01 painter, parameterized by palette ---------------------
  function paint(c, S, pal) {
    const f = pal.floor, pr = pal.profile;
    c.save();
    c.fillStyle = shade(f.base, pr.floorLift, pr.floorContrastSat);
    c.fillRect(0, 0, S, S);
    const grad = c.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S * 0.72);
    grad.addColorStop(0, rgba(f.inner, 0.78, pr.floorLift, pr.floorContrastSat));
    grad.addColorStop(1, rgba(f.outer, 0.92, pr.floorLift, pr.floorContrastSat));
    c.fillStyle = grad;
    c.fillRect(0, 0, S, S);

    c.strokeStyle = 'rgba(12,14,18,0.22)';
    c.lineWidth = 1;
    for (let g = 125; g < S; g += 125) {
      c.beginPath(); c.moveTo(g, 40); c.lineTo(g, S - 40); c.stroke();
      c.beginPath(); c.moveTo(40, g); c.lineTo(S - 40, g); c.stroke();
    }
    c.strokeStyle = 'rgba(10,12,16,0.38)';
    c.lineWidth = 2;
    for (let g = 100; g < S; g += 100) {
      c.beginPath(); c.moveTo(g, 34); c.lineTo(g, 46); c.stroke();
      c.beginPath(); c.moveTo(g, S - 46); c.lineTo(g, S - 34); c.stroke();
      c.beginPath(); c.moveTo(34, g); c.lineTo(46, g); c.stroke();
      c.beginPath(); c.moveTo(S - 46, g); c.lineTo(S - 34, g); c.stroke();
    }
    c.strokeStyle = 'rgba(18,20,24,0.28)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(S / 2, S / 2, 62, 0, Math.PI * 2); c.stroke();
    c.beginPath();
    c.moveTo(S / 2 - 88, S / 2); c.lineTo(S / 2 - 40, S / 2);
    c.moveTo(S / 2 + 40, S / 2); c.lineTo(S / 2 + 88, S / 2);
    c.moveTo(S / 2, S / 2 - 88); c.lineTo(S / 2, S / 2 - 40);
    c.moveTo(S / 2, S / 2 + 40); c.lineTo(S / 2, S / 2 + 88);
    c.stroke();

    c.fillStyle = shade(f.wall, pr.floorLift, 1);
    c.fillRect(0, 0, S, 30); c.fillRect(0, S - 30, S, 30);
    c.fillRect(0, 0, 30, S); c.fillRect(S - 30, 0, 30, S);
    c.strokeStyle = 'rgba(0,0,0,0.4)';
    c.lineWidth = 2;
    for (let g = 0; g <= S; g += 125) {
      c.beginPath(); c.moveTo(g, 0); c.lineTo(g, 30); c.stroke();
      c.beginPath(); c.moveTo(g, S - 30); c.lineTo(g, S); c.stroke();
      c.beginPath(); c.moveTo(0, g); c.lineTo(30, g); c.stroke();
      c.beginPath(); c.moveTo(S - 30, g); c.lineTo(S, g); c.stroke();
    }
    c.strokeStyle = shade(f.rail, 0, 1);
    c.lineWidth = 6;
    c.strokeRect(30, 30, S - 60, S - 60);
    c.strokeStyle = 'rgba(255,255,255,0.05)';
    c.lineWidth = 2;
    c.strokeRect(36, 36, S - 72, S - 72);
    c.strokeStyle = 'rgba(255,255,255,0.045)';
    c.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      c.beginPath(); c.moveTo(52 + i * 10, 52); c.lineTo(52 + i * 10, 84); c.stroke();
      c.beginPath(); c.moveTo(S - 84 + i * 10, S - 84); c.lineTo(S - 84 + i * 10, S - 52); c.stroke();
    }
    c.restore();
  }

  // ---- stable combat readability wrappers (neutral, hue-preserving) --------
  // AUDIT-E: the actor source is rendered EXACTLY ONCE per frame into a small
  // stable offscreen; the same offscreen supplies (a) the neutral separation
  // shadows and (b) the normal appearance blit. Status rings, WEAK chevrons,
  // trap/front/fx layers and combat VFX are never rendered into the offscreen
  // (they draw straight to the main ctx, outside actorRender). Base fighters
  // get a zero-extra-render geometric separation instead.
  const SIL = 256;
  const sils = new WeakMap();
  const rstats = { actorRenders: 0, weaponRenders: 0, actorAllocs: 0, inActor: false };
  function isActive() {
    const AQ = window.APEX_ARSENAL;
    return !!(AQ && AQ.state && AQ.state.active);
  }
  function actorRender(c, key, wx, wy, renderFn, kind) {
    if (!isActive()) { renderFn(c); return; }
    const pr = current().profile;
    let pair = sils.get(key);
    if (!pair) {
      const source = document.createElement('canvas');
      const mask = document.createElement('canvas');
      source.width = source.height = SIL;
      mask.width = mask.height = SIL;
      pair = { source, mask };
      sils.set(key, pair);
      rstats.actorAllocs += 2;
    }

    // SOURCE: authoritative full-color actor/weapon pixels. Render expensive
    // presentation exactly once and never mutate these pixels afterwards.
    const sourceCtx = pair.source.getContext('2d');
    sourceCtx.setTransform(1, 0, 0, 1, 0, 0);
    sourceCtx.globalAlpha = 1;
    sourceCtx.globalCompositeOperation = 'source-over';
    sourceCtx.clearRect(0, 0, SIL, SIL);
    sourceCtx.setTransform(1, 0, 0, 1, SIL / 2 - wx, SIL / 2 - wy);
    rstats.inActor = true;
    if (kind === 'weapon') rstats.weaponRenders += 1; else rstats.actorRenders += 1;
    try { renderFn(sourceCtx); } finally { rstats.inActor = false; }
    sourceCtx.setTransform(1, 0, 0, 1, 0, 0);

    // MASK: cheap copy of SOURCE used only for neutral readability treatment.
    // The source-in tint is deliberately isolated here so palette changes can
    // never recolor the actual hero/weapon appearance.
    const maskCtx = pair.mask.getContext('2d');
    maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    maskCtx.globalAlpha = 1;
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.clearRect(0, 0, SIL, SIL);
    maskCtx.drawImage(pair.source, 0, 0);
    maskCtx.globalCompositeOperation = 'source-in';
    maskCtx.fillStyle = pr.sil;
    maskCtx.fillRect(0, 0, SIL, SIL);
    maskCtx.globalCompositeOperation = 'source-over';

    const dx = wx - SIL / 2, dy = wy - SIL / 2;
    c.save();
    c.shadowColor = pr.shadow; c.shadowBlur = pr.blur; c.shadowOffsetY = pr.offset;
    c.drawImage(pair.mask, dx, dy);
    c.shadowColor = pr.keyline; c.shadowBlur = 2; c.shadowOffsetY = 0;
    c.drawImage(pair.mask, dx, dy);
    c.restore();
    c.drawImage(pair.source, dx, dy); // preserve original full-color appearance
  }
  let wrapped = false;
  function installWrappers() {
    if (wrapped) return;
    const F = (window.fighters && window.fighters[0] && window.fighters[0].constructor)
      || window.Fighter
      || (typeof Fighter !== 'undefined' ? Fighter : null);
    if (!F || !F.prototype || !F.prototype.draw) return;
    wrapped = true;
    // OWNER REJECTION (Magnet V1 playtest): this wrapper used to add a
    // decorative fighter-underlay pair to every fighter whose heroId was not
    // HUNTER/ROBOT —
    //     c.ellipse(this.x, this.y + r*0.72, r*0.92, r*0.34, ...)  // grounding shadow
    //     c.arc(this.x, this.y, r*0.98, ...)                        // faint rim ring
    // Instrumenting Canvas arc/ellipse in the real preview proved these are
    // the circle/ring graphics the owner sees under Magnet and under the
    // other champion (reproduced on MAGNET + MIRROR; evidence:
    // docs/hero-rework/magnet-v1/evidence/ground-circle-provenance.json).
    //
    // They are purely decorative chamber-palette separation: not a projectile
    // ring, not an A1 object acknowledgement ring, not a Gold skill arc and
    // not a status visual. Removed. The chamber palette's actual recolour /
    // actorRender separation path below is untouched.
    F.prototype.__paletteGeoWrapped = true;
    const AV = window.APEX_ARSENAL_AV;
    if (AV && AV.drawEquippedWeapon && !AV.__paletteWrapped) {
      const bw = AV.drawEquippedWeapon.bind(AV);
      AV.drawEquippedWeapon = function (c, f, h) {
        if (!isActive()) return bw(c, f, h);
        // ONE weapon render dispatch per call; separation reuses its pixels.
        actorRender(c, f, f.x, f.y, (oc) => bw(oc, f, h), 'weapon');
        return undefined;
      };
      AV.__paletteWrapped = true;
    }
  }

  // ---- hub selector (pre-match; never a mid-fight modal) --------------------
  function refreshSelector() {
    const host = document.getElementById('aq-palette-row');
    if (!host) return;
    const cur = currentId();
    host.innerHTML = '';
    for (const p of PALETTES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'aq-palette-chip' + (p.id === cur ? ' is-active' : '');
      b.setAttribute('data-palette', p.id);
      b.setAttribute('aria-label', 'Chamber palette ' + p.label);
      b.style.setProperty('--sw', p.floor.base);
      b.style.setProperty('--sw2', p.floor.wall);
      b.innerHTML = '<i></i><span>' + p.label + '</span>';
      b.addEventListener('click', () => select(p.id));
      host.appendChild(b);
    }
  }

  window.APEX_CHAMBER_PALETTE = {
    list: () => PALETTES.map((p) => ({ id: p.id, label: p.label, profile: p.profile })),
    current: currentId,
    isKnown: (id) => PALETTES.some((p) => p.id === id),
    select,
    surface,
    stats: statsSnapshot,
    renderStats: () => Object.assign({}, rstats),
    inActor: () => rstats.inActor,
    isActive,
    actorRender,
    installWrappers,
    refreshSelector,
    paintForTests: paint,
  };
  window.apexArsenalChamberPaletteRuntime = 'ready';
})();
