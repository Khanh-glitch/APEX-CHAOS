// Arsenal feel layer: persistent victim-colored floor stain, pooled spray,
// bounded damage-number atlas, heal identity plumbing (values blocked if unknown).
(function apexArsenalFeelRuntime() {
  if (window.apexArsenalFeelRuntime === 'ready') return;
  const AQ = window.APEX_ARSENAL || (window.APEX_ARSENAL = {});
  const CFG = window.APEX_ARSENAL_CONFIG;

  const SPECK = '/assets/fang_v1/speckBlood.webp';
  const ATLAS_SRC = '/assets/arsenal/feel/damage/damage1.png';
  const HEAL_FILES = {
    HEAL_H1: '/assets/arsenal/feel/heals/runtime/heal_t1_field_dressing.png',
    HEAL_H2: '/assets/arsenal/feel/heals/runtime/heal_t2_medication.png',
    HEAL_H3: '/assets/arsenal/feel/heals/runtime/heal_t3_autoinjector.png',
    HEAL_H4: '/assets/arsenal/feel/heals/runtime/heal_t4_iv_pack.png',
    HEAL_H5: '/assets/arsenal/feel/heals/runtime/heal_t5_trauma_case.png',
  };
  const HEAL_MASTERS = {
    HEAL_H1: '/assets/arsenal/feel/heals/heal_t1_field_dressing.png',
    HEAL_H2: '/assets/arsenal/feel/heals/heal_t2_medication.png',
    HEAL_H3: '/assets/arsenal/feel/heals/heal_t3_autoinjector.png',
    HEAL_H4: '/assets/arsenal/feel/heals/heal_t4_iv_pack.png',
    HEAL_H5: '/assets/arsenal/feel/heals/heal_t5_trauma_case.png',
  };

  const stats = {
    splatters: 0,
    stamps: 0,
    stainDraws: 0,
    popups: 0,
    missPopups: 0,
    numericOnMiss: 0,
    sprayPeak: 0,
    sprayReuse: 0,
    popupReuse: 0,
    resets: 0,
    atlasReady: false,
    healRestoreBlocked: false,
    organicMaskStamps: 0,
    ellipseCore: 0,
    atlasVariant: {},
    // V1 blood port counters (docs/arsenal-quest/v1-blood-port/): the blood
    // system is only a visual consumer of combat state; these exist so the
    // acceptance suite can prove real metadata is consumed.
    v1Hits: 0,
    v1Cores: 0,
    v1Streaks: 0,
    v1Drops: 0,
    v1Micro: 0,
    v1Decals: 0,
    v1LandMarks: 0,
    v1FloorStamps: 0,
    v1DropsSkipped: 0,
    v1MicroSkipped: 0,
    lastV1: null,
  };
  const PALETTE = {
    dmg: { fill: '#F2382F', edge: '#5A0C09' },
    crit: { fill: '#FF8A24', edge: '#5A2700' },
    heal: { fill: '#37D96B', edge: '#063D1D' },
    miss: { fill: '#465361', edge: '#E8EEF4' },
  };
  const BLOOD = {
    spray: [0xD7, 0x2A, 0x32],
    main: [0x8E, 0x0E, 0x18],
    core: [0x3A, 0x05, 0x08],
    deep: [0x26, 0x04, 0x07],
  };
  // PASS B §12 — locally vendored Kanit Black Italic damage typography.
  // The rasterized PNG atlas (damage1.png) is superseded as the DRAW source;
  // it remains as the compatibility fallback if the font cannot load.
  // The six magnitude thresholds (SIZE_BANDS) are unchanged — only the
  // visible glyph heights move to the approved 34..60 px targets.
  const KANIT_SRC = '/assets/fonts/kanit/Kanit-BlackItalic.ttf';
  const KANIT_FAMILY = 'ApcKanit';
  const KANIT_TARGET_H = { XS: 34, S: 38, M: 43, L: 48, XL: 54, XXL: 60 };
  const KANIT_RASTER_H = 128; // constant raster height → per-band draw scale
  const kanit = {
    ready: false,
    fontLoaded: false,
    fontSource: 'pending',
    digits: {},  // kind -> [10 glyph sheets {canvas, adv, inkTop, inkBottom, w, h}]
    miss: null,  // 'MISS' string sheet
    refInk: {},  // kind -> {top, bottom, baseline} measured from digit '0'
    rasterizations: 0,
    draws: 0,
    glyphSig: null,
  };
  function fontSpec(px) { return `900 ${px}px "${KANIT_FAMILY}", "Arial Black", sans-serif`; }
  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') {
      try { const oc = new OffscreenCanvas(w, h); if (oc.getContext) return oc; } catch (e) { /* fall through */ }
    }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function glyphSignature(familySpec) {
    try {
      const cnv = makeCanvas(160, 160);
      const g = cnv.getContext('2d');
      g.font = `900 80px ${familySpec}`;
      g.textBaseline = 'alphabetic';
      g.fillText('4', 12, 104);
      const d = g.getImageData(0, 0, 160, 160).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
      return n;
    } catch (e) { return -1; }
  }
  function rasterGlyph(kind, text) {
    const pal = PALETTE[kind];
    const probe = makeCanvas(4, 4).getContext('2d');
    probe.font = fontSpec(KANIT_RASTER_H);
    let adv = 0;
    try { adv = Number(probe.measureText(text).width) || 0; } catch (e) { adv = 0; }
    if (!(adv > 0)) adv = KANIT_RASTER_H * 0.55 * text.length;
    const pad = 16;
    const w = Math.max(8, Math.ceil(adv) + pad * 2);
    const h = KANIT_RASTER_H + pad * 2 + 24;
    const baseline = pad + KANIT_RASTER_H * 0.95;
    const cnv = makeCanvas(w, h);
    const c = cnv.getContext('2d');
    c.font = fontSpec(KANIT_RASTER_H);
    c.textBaseline = 'alphabetic';
    c.lineJoin = 'round';
    if (kind === 'miss') { c.shadowColor = pal.edge; c.shadowBlur = KANIT_RASTER_H / 16; }
    c.strokeStyle = pal.edge;
    c.lineWidth = KANIT_RASTER_H / 22; // crisp dark edge, no fuzzy bloom
    c.strokeText(text, pad, baseline);
    c.shadowBlur = 0;
    c.fillStyle = pal.fill;
    c.fillText(text, pad, baseline);
    kanit.rasterizations += 1;
    let inkTop = -1, inkBottom = -1;
    try {
      const data = c.getImageData(0, 0, w, h).data;
      outer:
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 30) { inkTop = y; break outer; }
        }
      }
      for (let y = h - 1; y >= 0; y--) {
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 30) { inkBottom = y; break; }
        }
        if (inkBottom >= 0) break;
      }
    } catch (e) { /* opaque-only fallback below */ }
    if (inkTop < 0) { inkTop = baseline - KANIT_RASTER_H * 0.72; inkBottom = baseline; }
    return { canvas: cnv, w, h, adv, pad, baseline, inkTop, inkBottom };
  }
  function buildKanitSheets() {
    if (kanit.ready) return true;
    try {
      // Silent-fallback guard: the vendored family must actually rasterize
      // differently from a generic serif (headless canvas backends fall back
      // silently to their default font when a family is unknown).
      const sigKanit = glyphSignature(`"${KANIT_FAMILY}", "Arial Black", sans-serif`);
      const sigOther = glyphSignature('serif');
      if (sigKanit < 0 || (sigKanit === sigOther)) {
        if (kanit.fontSource !== 'legacy-atlas-fallback') kanit.fontSource = 'fallback-guard (signature match)';
        return false;
      }
      kanit.glyphSig = { kanit: sigKanit, other: sigOther };
      for (const kind of ['dmg', 'crit', 'heal', 'miss']) {
        const digits = [];
        for (let d = 0; d <= 9; d++) digits.push(rasterGlyph(kind, String(d)));
        kanit.digits[kind] = digits;
        kanit.refInk[kind] = {
          top: digits[0].inkTop,
          bottom: digits[0].inkBottom,
          baseline: digits[0].baseline,
        };
      }
      kanit.miss = rasterGlyph('miss', 'MISS');
      kanit.ready = true;
      stats.kanitReady = true;
      stats.kanitFont = KANIT_FAMILY;
      stats.kanitFontSrc = KANIT_SRC;
      stats.kanitRasterizations = kanit.rasterizations;
      stats.atlasReady = true;
      stats.sizeBands = SIZE_BANDS.map((b) => b.id);
      return true;
    } catch (e) {
      kanit.fontSource = 'build-failed: ' + String((e && e.message) || e);
      return false;
    }
  }
  function startKanitFont() {
    if (typeof document === 'undefined') return;
    if (typeof FontFace === 'function' && document.fonts && document.fonts.add) {
      kanit.fontSource = 'FontFace(local ' + KANIT_SRC + ')';
      const face = new FontFace(KANIT_FAMILY, `url(${KANIT_SRC})`);
      document.fonts.add(face);
      face.load().then(() => {
        kanit.fontLoaded = true;
        buildKanitSheets();
      }).catch(() => {
        kanit.fontSource = 'FontFace-failed → legacy atlas';
      });
      return;
    }
    // Headless canvas backends register the family out-of-band (harness);
    // build immediately if the probe accepts it, else retry on first draw.
    if (!buildKanitSheets()) {
      kanit.fontSource = 'probe-pending (retry on draw)';
    }
  }
  function bandForScale(scale) {
    for (const b of SIZE_BANDS) if (Math.abs(b.scale - (scale || 0)) < 1e-6) return b;
    return bandFor(0);
  }

  // V1 material identity (approved reference): dark crimson family, blood
  // absorbs light — no bright flat red, no additive glow, no orange crits.
  const V1_COLORS = {
    coreCenter: [92, 0, 0],
    coreMid: [74, 0, 0],
    coreEdge: [38, 0, 0],
    streakDark: [48, 0, 0],
    streakMid: [92, 0, 0],
    streakTip: [125, 3, 3],
    drop: [102, 0, 0],
    micro: [115, 2, 2],
    floorDotMin: 45,
    floorDotMax: 78,
  };
  // V1 §14 priority: recycle micro spray first, then medium drops. Caps sit far
  // above the approved per-hit workload (55 normal / 90 critical live objects),
  // so they only engage in pathological sustained bursts.
  const V1_LIVE_SOFT_CAP = { micro: 420, drop: 560 };
  const SIZE_BANDS = [
    { id: 'XS', min: 1, max: 34, scale: 1.35 },
    { id: 'S', min: 35, max: 69, scale: 1.60 },
    { id: 'M', min: 70, max: 139, scale: 1.90 },
    { id: 'L', min: 140, max: 239, scale: 2.20 },
    { id: 'XL', min: 240, max: 399, scale: 2.50 },
    { id: 'XXL', min: 400, max: 1e9, scale: 2.85 },
  ];
  function bandFor(amount) {
    const a = Math.abs(Number(amount) || 0);
    for (const b of SIZE_BANDS) {
      if (a >= b.min && a <= b.max) return b;
    }
    return SIZE_BANDS[SIZE_BANDS.length - 1];
  }
  const tintedAtlas = { dmg: null, crit: null, heal: null, miss: null };
  const bandCache = {};

  let stainCanvas = null;
  let stainCtx = null;
  let stainSize = 0;
  let speckImg = null;
  let atlasImg = null;
  const sprayPool = [];
  const sprayLive = [];
  const popupPool = [];
  const popupLive = [];
  const agg = new Map();
  const SHOTGUN_IDS = { SHOTGUN: 1, MOSSBERG_500: 1, SAWED_OFF: 1, JACKHAMMER: 1 };
  const AUTO_IDS = { SMG: 1, MAC_10: 1, P90: 1, TEC_9: 1, AK_47: 1, M249_SAW: 1, ZBROYAR_Z15_S2: 1 };

  function loadImg(src) {
    const im = new Image();
    im.src = src;
    return im;
  }
  speckImg = loadImg(SPECK);
  atlasImg = loadImg(ATLAS_SRC);
  function parseRgb(hex) {
    const s = String(hex).replace('#', '');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  function colorLayer(src, color) {
    const cnv = document.createElement('canvas');
    cnv.width = src.naturalWidth || src.width || 240;
    cnv.height = src.naturalHeight || src.height || 160;
    const c = cnv.getContext('2d');
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, cnv.width, cnv.height);
    return cnv;
  }
  function buildTintedAtlas() {
    if (!atlasImg || !atlasImg.complete || !(atlasImg.naturalWidth || atlasImg.width)) return;
    const w = atlasImg.naturalWidth || atlasImg.width;
    const h = atlasImg.naturalHeight || atlasImg.height;
    for (const kind of Object.keys(PALETTE)) {
      const pal = PALETTE[kind];
      const edgeLayer = colorLayer(atlasImg, pal.edge);
      const fillLayer = colorLayer(atlasImg, pal.fill);
      const cnv = document.createElement('canvas');
      cnv.width = w; cnv.height = h;
      const c = cnv.getContext('2d');
      c.save();
      if (kind === 'miss') {
        c.shadowColor = pal.edge;
        c.shadowBlur = 5;
        c.drawImage(fillLayer, 0, 0);
        c.shadowBlur = 0;
      }
      const spread = kind === 'miss' ? 1.6 : 1.2;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          c.drawImage(edgeLayer, dx * spread, dy * spread);
        }
      }
      c.restore();
      c.drawImage(fillLayer, 0, 0);
      tintedAtlas[kind] = cnv;
      stats.atlasVariant[kind] = { fill: pal.fill, edge: pal.edge };
      for (const b of SIZE_BANDS) {
        const key = kind + ':' + b.id;
        const bw = Math.max(1, Math.round(w * b.scale));
        const bh = Math.max(1, Math.round(h * b.scale));
        const bc = document.createElement('canvas');
        bc.width = bw; bc.height = bh;
        const bctx = bc.getContext('2d');
        bctx.imageSmoothingEnabled = false;
        bctx.drawImage(cnv, 0, 0, bw, bh);
        bandCache[key] = bc;
      }
    }
    stats.atlasReady = true;
    stats.sizeBands = SIZE_BANDS.map((b) => b.id);
  }
  function nearColor(px, rgb, tol) {
    return Math.abs(px[0] - rgb[0]) <= tol && Math.abs(px[1] - rgb[1]) <= tol && Math.abs(px[2] - rgb[2]) <= tol && px[3] > 40;
  }
  function sampleCanvasPixels(cnv, kind) {
    const c = cnv.getContext('2d');
    const img = c.getImageData(0, 0, cnv.width, cnv.height);
    const pal = PALETTE[kind];
    const fill = parseRgb(pal.fill);
    const edge = parseRgb(pal.edge);
    let fillHits = 0, edgeHits = 0, opaque = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      const px = [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
      if (px[3] < 20) continue;
      opaque += 1;
      if (nearColor(px, fill, 28)) fillHits += 1;
      else if (nearColor(px, edge, 36)) edgeHits += 1;
    }
    return { fillHits, edgeHits, opaque, fill: pal.fill, edge: pal.edge, w: cnv.width, h: cnv.height };
  }
  function sampleAtlasPixels(kind) {
    // PASS B: when the local Kanit sheets are live, the acceptance sampling
    // runs on the real draw source (cached glyph canvases), not the legacy
    // PNG atlas.
    if (kanit.ready) {
      const sheet = kind === 'miss' ? kanit.miss : (kanit.digits[kind] && kanit.digits[kind][4]);
      if (sheet && sheet.canvas) return sampleCanvasPixels(sheet.canvas, kind);
    }
    if (!stats.atlasReady) buildTintedAtlas();
    const cnv = tintedAtlas[kind];
    if (!cnv) return { fillHits: 0, edgeHits: 0 };
    return sampleCanvasPixels(cnv, kind);
  }
  atlasImg.onload = () => { buildTintedAtlas(); };
  if (atlasImg.complete) buildTintedAtlas();

  function ensureStain(size) {
    const S = size || (typeof GAME_SIZE !== 'undefined' ? GAME_SIZE : 1000);
    if (stainCanvas && stainSize === S) return stainCtx;
    if (typeof OffscreenCanvas !== 'undefined') {
      try { stainCanvas = new OffscreenCanvas(S, S); } catch (e) { stainCanvas = null; }
    }
    if (!stainCanvas) {
      stainCanvas = document.createElement('canvas');
      stainCanvas.width = S;
      stainCanvas.height = S;
    } else if (stainCanvas.width !== S) {
      stainCanvas.width = S;
      stainCanvas.height = S;
    }
    stainSize = S;
    stainCtx = stainCanvas.getContext('2d');
    stainCtx.clearRect(0, 0, S, S);
    return stainCtx;
  }

  function resetMatch() {
    ensureStain();
    if (stainCtx) stainCtx.clearRect(0, 0, stainSize, stainSize);
    sprayLive.length = 0;
    popupLive.length = 0;
    agg.clear();
    stats.resets += 1;
  }

  function parseHex(color) {
    const s = String(color || '#cc3344').replace('#', '');
    const n = s.length === 3
      ? [parseInt(s[0] + s[0], 16), parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16)]
      : [parseInt(s.slice(0, 2), 16) || 180, parseInt(s.slice(2, 4), 16) || 40, parseInt(s.slice(4, 6), 16) || 40];
    return n;
  }
  function darken(rgb, amt) {
    return [Math.max(0, rgb[0] * amt), Math.max(0, rgb[1] * amt), Math.max(0, rgb[2] * amt)];
  }
  function rgba(rgb, a) {
    return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`;
  }

  function weaponFromLabel(label) {
    const m = String(label || '').match(/^arsenal-(.+)$/i);
    if (!m) return null;
    return m[1].toUpperCase().replace(/-/g, '_');
  }

  function footprint(dealt, crit) {
    const scale = (CFG && CFG.ARSENAL_DAMAGE_SCALE) || 7;
    const visual = Math.max(0, dealt) / scale;
    const px = 16 + Math.sqrt(visual) * 8;
    return Math.min(72, px * (crit ? 1.2 : 1));
  }

  function allocSpray() {
    const p = sprayPool.pop() || { x: 0, y: 0, vx: 0, vy: 0, r: 2, life: 0, max: 0.2, rgb: [0, 0, 0] };
    if (p.max) stats.sprayReuse += 1;
    // Reset V1-only fields every alloc: recycled objects must never leak a
    // stale kind/drag/landing state into the legacy spray path (or back).
    p.kind = null;
    p.drag = 0;
    p.stretch = 0;
    p.rot = 0;
    p.size = 0;
    p.landChance = 0;
    p.landPower = 0;
    p.fresh = false;
    return p;
  }

  let tintScratch = null;
  const speckTintCache = new Map();
  function ensureSpeckFallback() {
    if (speckImg && speckImg.complete && speckImg.naturalWidth) return speckImg;
    if (ensureSpeckFallback._c) return ensureSpeckFallback._c;
    const cnv = document.createElement('canvas');
    cnv.width = 64; cnv.height = 64;
    const g = cnv.getContext('2d');
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = '#fff';
    for (let i = 0; i < 28; i++) {
      const x = 8 + Math.random() * 48;
      const y = 8 + Math.random() * 48;
      const rx = 2 + Math.random() * 9;
      const ry = 2 + Math.random() * 6;
      g.beginPath();
      g.ellipse(x, y, rx, ry, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    ensureSpeckFallback._c = cnv;
    return cnv;
  }
  function tintedSpeck(rgb, a) {
    const src = ensureSpeckFallback();
    if (!src) return null;
    const key = (rgb[0] | 0) + ',' + (rgb[1] | 0) + ',' + (rgb[2] | 0) + ':' + (a * 8 | 0);
    const hit = speckTintCache.get(key);
    if (hit) return hit;
    const sw = 96, sh = 96;
    const cnv = document.createElement('canvas');
    cnv.width = sw; cnv.height = sh;
    const tc = cnv.getContext('2d');
    tc.drawImage(src, 0, 0, sw, sh);
    tc.globalCompositeOperation = 'source-atop';
    tc.fillStyle = rgba(rgb, Math.min(1, 0.35 + (a * 8 | 0) / 8));
    tc.fillRect(0, 0, sw, sh);
    speckTintCache.set(key, cnv);
    if (speckTintCache.size > 48) {
      const first = speckTintCache.keys().next().value;
      speckTintCache.delete(first);
    }
    return cnv;
  }

  function stampOrganic(c, ox, oy, sx, sy, rot, rgb, alpha) {
    const src = tintedSpeck(rgb, alpha);
    if (!src) return false;
    c.save();
    c.translate(ox, oy);
    c.rotate(rot);
    c.drawImage(src, -sx / 2, -sy / 2, sx, sy);
    c.restore();
    stats.organicMaskStamps += 1;
    return true;
  }

  function drawWedge(c, len, half, rgb, a) {
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(len, -half);
    c.lineTo(len * 0.92, 0);
    c.lineTo(len, half);
    c.closePath();
    c.fillStyle = rgba(rgb, a);
    c.fill();
  }
  function stampStain(x, y, dealt, victimRgb, dirx, diry, family, crit) {
    const c = ensureStain();
    if (!c) return;
    const fp = footprint(dealt, crit);
    const main = BLOOD.main;
    const core = BLOOD.core;
    const wet = BLOOD.spray;
    const ang = Math.atan2(diry, dirx);
    const fan = family === 'SHOTGUN' || family === 'BLAST' ? 1.22
      : family === 'AUTO' ? 0.72
      : family === 'MELEE' ? 0.85
      : family === 'PRECISION' ? 0.28
      : 0.55;
    const nSlash = family === 'SHOTGUN' || family === 'BLAST' ? 5
      : family === 'AUTO' ? 2
      : family === 'PRECISION' ? 3
      : family === 'MELEE' ? 4
      : 3;
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.imageSmoothingEnabled = false;
    stampOrganic(c, fp * 0.08, 0, fp * 0.55, fp * 0.42, (Math.random() - 0.5) * 0.5, main, 0.9);
    stampOrganic(c, fp * 0.04, fp * 0.06, fp * 0.32, fp * 0.28, 0.8, core, 0.75);
    for (let i = 0; i < nSlash; i++) {
      const a = (Math.random() - 0.5) * fan;
      c.save();
      c.rotate(a);
      const len = fp * (family === 'PRECISION' ? 1.7 : family === 'MELEE' ? 1.35 : 1.05) * (0.7 + Math.random() * 0.45);
      const half = family === 'PRECISION' ? 1.6 + Math.random() : 2.2 + Math.random() * 2.4;
      drawWedge(c, len, half, i ? main : BLOOD.deep, 0.85);
      c.restore();
    }
    const nDrop = family === 'SHOTGUN' || family === 'BLAST' ? 9
      : family === 'AUTO' ? 5
      : family === 'PRECISION' ? 4
      : 6;
    for (let i = 0; i < nDrop; i++) {
      const a = (Math.random() - 0.5) * fan;
      const dist = fp * (0.35 + Math.random() * (family === 'SHOTGUN' ? 1.2 : 0.75));
      const sx = 3 + Math.random() * fp * 0.16;
      const sy = 2 + Math.random() * 3;
      stampOrganic(c, Math.cos(a) * dist, Math.sin(a) * dist * 0.45, sx, sy, a, i % 2 ? wet : main, 0.45 + Math.random() * 0.35);
    }
    c.restore();
    stats.stamps += 1;
  }

  function emitSpray(x, y, dealt, victimRgb, dirx, diry, crit) {
    const visual = Math.max(0, dealt) / ((CFG && CFG.ARSENAL_DAMAGE_SCALE) || 7);
    const nStreak = 3 + Math.min(4, Math.round(Math.sqrt(visual)));
    const nDrop = 6 + Math.min(12, Math.round(visual));
    const baseAng = Math.atan2(diry, dirx);
    const boost = crit ? 1.2 : 1;
    for (let i = 0; i < nStreak; i++) {
      const p = allocSpray();
      const spread = (Math.random() - 0.5) * (70 * Math.PI / 180);
      const sp = (140 + Math.random() * 180 + visual * 8) * boost;
      p.x = x; p.y = y;
      p.vx = Math.cos(baseAng + spread) * sp;
      p.vy = Math.sin(baseAng + spread) * sp;
      p.r = 1.2 + Math.random() * 1.6;
      p.len = 10 + Math.random() * 16 * boost;
      p.life = 0.12 + Math.random() * 0.1;
      p.max = p.life;
      p.rgb = BLOOD.spray;
      p.wedge = true;
      sprayLive.push(p);
    }
    for (let i = 0; i < nDrop; i++) {
      const p = allocSpray();
      const spread = (Math.random() - 0.5) * (70 * Math.PI / 180);
      const sp = (70 + Math.random() * 160) * boost;
      p.x = x; p.y = y;
      p.vx = Math.cos(baseAng + spread) * sp;
      p.vy = Math.sin(baseAng + spread) * sp;
      p.r = 1.2 + Math.random() * 2.4;
      p.len = 0;
      p.life = 0.12 + Math.random() * 0.1;
      p.max = p.life;
      p.rgb = i % 3 ? BLOOD.main : BLOOD.spray;
      p.wedge = false;
      sprayLive.push(p);
    }
    if (sprayLive.length > stats.sprayPeak) stats.sprayPeak = sprayLive.length;
  }

  // ---------------------------------------------------------------------------
  // V1 BLOOD PORT — owner-approved executable reference, ported verbatim.
  // Identity: projectile ---> victim X===========> blood — blood is violently
  // carried THROUGH the victim by projectile momentum. Never a radial burst,
  // never side cones, never a forward rebound, never orange.
  // Reference: docs/arsenal-quest/v1-blood-port/01_APPROVED_EXECUTABLE_REFERENCE_V1.html
  // ---------------------------------------------------------------------------
  function v1Rnd(a, b) { return a + Math.random() * (b - a); }

  function irregularBlob(g, x, y, r, alpha, rotation, stretch) {
    const points = 18;
    g.save();
    g.translate(x, y);
    g.rotate(rotation || 0);
    g.scale(stretch || 1, 1);
    g.beginPath();
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      const rr = r * v1Rnd(0.65, 1.28);
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    const grad = g.createRadialGradient(-r * 0.25, -r * 0.18, r * 0.05, 0, 0, r * 1.3);
    grad.addColorStop(0, `rgba(92,0,0,${alpha})`);
    grad.addColorStop(0.55, `rgba(74,0,0,${alpha * 0.96})`);
    grad.addColorStop(1, `rgba(38,0,0,${alpha * 0.85})`);
    g.fillStyle = grad;
    g.fill();
    g.restore();
  }

  // Persistent floor blood onto the shared cached/offscreen stain layer.
  // source-over compositing per the approved reference; darker/drier marks.
  function v1FloorSplat(x, y, dx, dy, power) {
    const c = ensureStain();
    if (!c) return;
    const a = Math.atan2(dy, dx);
    c.save();
    c.globalCompositeOperation = 'source-over';
    irregularBlob(c, x, y, 7 + power * 9, 0.88, a, 1 + v1Rnd(0.2, 0.8));
    const n = Math.round(6 + power * 8);
    for (let i = 0; i < n; i++) {
      const dist = v1Rnd(8, 26 + power * 42);
      const aa = a + v1Rnd(-0.55, 0.55);
      const px = x + Math.cos(aa) * dist;
      const py = y + Math.sin(aa) * dist;
      const rr = v1Rnd(1.4, 4.6 + power * 3.5);
      irregularBlob(c, px, py, rr, v1Rnd(0.5, 0.82), aa, v1Rnd(1, 2.4));
    }
    for (let i = 0; i < 18 + power * 28; i++) {
      const dist = v1Rnd(10, 38 + power * 70);
      const aa = a + v1Rnd(-0.75, 0.75);
      const px = x + Math.cos(aa) * dist;
      const py = y + Math.sin(aa) * dist;
      c.beginPath();
      c.arc(px, py, v1Rnd(0.45, 1.8 + power * 0.6), 0, Math.PI * 2);
      c.fillStyle = `rgba(${v1Rnd(V1_COLORS.floorDotMin, V1_COLORS.floorDotMax) | 0},0,0,${v1Rnd(0.35, 0.72)})`;
      c.fill();
    }
    c.restore();
    stats.v1FloorStamps += 1;
  }

  // Reference spawnBlood(): x/y = REAL collision point, bvx/bvy = REAL
  // projectile velocity, crit = REAL critical flag. Counts and constants are
  // the approved V1 numbers, not a reinterpretation.
  function emitV1Blood(x, y, bvx, bvy, crit) {
    let dx = bvx, dy = bvy;
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) { dx = 1; dy = 0; } else { dx /= L; dy /= L; }
    const baseAngle = Math.atan2(dy, dx);

    // A. impact core — irregular blot, asymmetric, stretched along travel.
    const core = allocSpray();
    core.kind = 'v1core';
    core.x = x; core.y = y;
    core.vx = dx * 15; core.vy = dy * 15;
    core.life = 0.12; core.max = 0.12;
    core.size = crit ? 18 : 13;
    core.rot = baseAngle;
    core.stretch = 1.5;
    core.rgb = V1_COLORS.coreCenter;
    core.fresh = true; // PASS A: full first-frame read — no pre-render aging
    sprayLive.push(core);
    stats.v1Cores += 1;

    // B. manga/liquid streaks — elongated tapered marks aligned to velocity.
    const nStreak = crit ? 7 : 4;
    for (let i = 0; i < nStreak; i++) {
      const p = allocSpray();
      const a = baseAngle + v1Rnd(-0.34, 0.34);
      const sp = v1Rnd(260, 470) * (crit ? 1.08 : 1);
      p.kind = 'v1streak';
      p.x = x + dx * v1Rnd(2, 10);
      p.y = y + dy * v1Rnd(2, 10);
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = v1Rnd(0.16, 0.28);
      p.max = 0; // reference alpha denominator: life / (max || 0.38)
      p.size = v1Rnd(2.2, 4.6);
      p.stretch = v1Rnd(5, 11);
      p.rot = a;
      p.drag = v1Rnd(0.88, 0.93);
      p.rgb = V1_COLORS.streakTip;
      p.fresh = true; // PASS A
      sprayLive.push(p);
    }
    stats.v1Streaks += nStreak;

    // C. medium droplets — ~55% leave a small landing mark at end-of-life.
    let nDrop = crit ? 18 : 12;
    if (sprayLive.length > V1_LIVE_SOFT_CAP.drop) { stats.v1DropsSkipped += nDrop; nDrop = 0; }
    for (let i = 0; i < nDrop; i++) {
      const p = allocSpray();
      const a = baseAngle + v1Rnd(-0.56, 0.56);
      const sp = v1Rnd(120, 300);
      p.kind = 'v1drop';
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = v1Rnd(0.32, 0.58);
      p.max = 0;
      p.size = v1Rnd(1.7, 4.6);
      p.drag = v1Rnd(0.94, 0.975);
      p.landChance = 0.55;
      p.landPower = 0.18;
      p.rgb = V1_COLORS.drop;
      p.fresh = true; // PASS A
      sprayLive.push(p);
    }
    stats.v1Drops += nDrop;

    // D. micro spray — texture, not the dominant silhouette; recycled first.
    let nMicro = crit ? 64 : 38;
    if (sprayLive.length > V1_LIVE_SOFT_CAP.micro) { stats.v1MicroSkipped += nMicro; nMicro = 0; }
    for (let i = 0; i < nMicro; i++) {
      const p = allocSpray();
      const a = baseAngle + v1Rnd(-0.72, 0.72);
      const sp = v1Rnd(70, 360) * (Math.random() < 0.15 ? 1.4 : 1);
      p.kind = 'v1micro';
      p.x = x + v1Rnd(-3, 3);
      p.y = y + v1Rnd(-3, 3);
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = v1Rnd(0.18, 0.45);
      p.max = 0;
      p.size = v1Rnd(0.55, 1.55);
      p.drag = v1Rnd(0.925, 0.97);
      p.landChance = 0.11;
      p.landPower = 0.06;
      p.rgb = V1_COLORS.micro;
      p.fresh = true; // PASS A
      sprayLive.push(p);
    }
    stats.v1Micro += nMicro;

    // Main decal: along the projectile direction, farther/stronger on crit.
    const decalDist = crit ? v1Rnd(24, 44) : v1Rnd(16, 32);
    v1FloorSplat(x + dx * decalDist, y + dy * decalDist, dx, dy, crit ? 1.3 : 0.82);

    stats.v1Decals += 1;
    stats.v1Hits += 1;
    stats.lastV1 = { x, y, angle: baseAngle, critical: !!crit };
    if (sprayLive.length > stats.sprayPeak) stats.sprayPeak = sprayLive.length;
  }

  function allocPopup() {
    const p = popupPool.pop() || { x: 0, y: 0, text: '', kind: 'dmg', life: 0, vy: 0, scale: 1, punch: 1, age: 0, band: 'S' };
    if (p.life || p.text) stats.popupReuse += 1;
    return p;
  }

  function pushPopup(x, y, text, kind, amount) {
    const p = allocPopup();
    const band = bandFor(amount || 0);
    p.x = Math.round(x); p.y = Math.round(y - 18);
    p.text = text;
    p.kind = kind;
    p.life = kind === 'crit' ? 0.9 : 0.7;
    p.vy = kind === 'crit' ? -62 : (kind === 'heal' ? -40 : -46);
    p.scale = band.scale;
    p.band = band.id;
    p.punch = kind === 'crit' ? 1.15 : 1;
    p.age = 0;
    popupLive.push(p);
    stats.popups += 1;
    if (kind === 'miss') stats.missPopups += 1;
  }

  // PASS A immediate-first aggregation: the first hit of an AUTO/SHOTGUN
  // sequence creates its popup immediately; later hits inside the window
  // update the already-live popup in place (or recreate it if its own life
  // expired during a long burst). Normal red and crit orange totals stay
  // semantically split. No 50/110 ms blank first-hit period; no number spam.
  function refreshAggPopups(a) {
    if (a.normal > 0) {
      const text = String(Math.round(a.normal));
      const band = bandFor(a.normal);
      let p = a.popNormal;
      if (!p || popupLive.indexOf(p) < 0) {
        pushPopup(a.x, a.y, text, 'dmg', a.normal);
        p = popupLive[popupLive.length - 1];
        a.popNormal = p;
      } else {
        p.text = text;
        p.scale = band.scale;
        p.band = band.id;
        p.x = Math.round(a.x);
        p.y = Math.round(a.y - 18);
        p.life = 0.7;
      }
    }
    if (a.crit > 0) {
      const text = String(Math.round(a.crit));
      const band = bandFor(a.crit);
      let p = a.popCrit;
      if (!p || popupLive.indexOf(p) < 0) {
        pushPopup(a.x + 18, a.y - 12, text, 'crit', a.crit);
        p = popupLive[popupLive.length - 1];
        a.popCrit = p;
      } else {
        p.text = text;
        p.scale = band.scale;
        p.band = band.id;
        p.x = Math.round(a.x + 18);
        p.y = Math.round(a.y - 30);
        p.life = 0.9;
      }
    }
  }
  function flushAgg(key) {
    const a = agg.get(key);
    if (!a) return;
    agg.delete(key); // popups already live; they finish their own lifetime
  }

  function noteDamage(opts) {
    const dealt = opts.dealt || 0;
    const miss = !!opts.miss;
    const victim = opts.victim;
    const source = opts.source;
    const label = opts.label || '';
    const statusDamage = !!opts.statusDamage;
    if (statusDamage) return;
    if (miss || !(dealt > 0)) {
      if (miss) {
        pushPopup((victim && victim.x) || 0, (victim && victim.y) || 0, 'MISS', 'miss', 1);
      }
      return;
    }
    const rgb = BLOOD.main;
    const crit = !!opts.critical;
    const wid = weaponFromLabel(label);
    const fam = (wid && SHOTGUN_IDS[wid]) ? 'SHOTGUN'
      : (wid && AUTO_IDS[wid]) ? 'AUTO'
      : /sniper|snipex|mbr/i.test(wid || label) ? 'PRECISION'
      : /melee|axe|sabre|dagger|spear|club/i.test(wid || label) ? 'MELEE'
      : /grenade|blast/i.test(wid || label) ? 'BLAST'
      : 'SEMI';
    // V1 blood port §6/§13: only firearm projectile hits carry real impact
    // metadata — they consume the actual collision point + actual projectile
    // velocity. Melee / grenade / native damage keeps the currently accepted
    // splatter behavior (no fabricated trajectory).
    const impact = opts.impact;
    const v1Firearm = !!(impact
      && Number.isFinite(impact.x) && Number.isFinite(impact.y)
      && Number.isFinite(impact.vx) && Number.isFinite(impact.vy));
    stats.splatters += 1;
    if (v1Firearm) {
      emitV1Blood(impact.x, impact.y, impact.vx, impact.vy, crit);
    } else {
      const dx = victim && source ? victim.x - source.x : 1;
      const dy = victim && source ? victim.y - source.y : 0;
      const len = Math.hypot(dx, dy) || 1;
      const dirx = dx / len;
      const diry = dy / len;
      stampStain(victim.x, victim.y, dealt, rgb, dirx, diry, fam, crit);
      emitSpray(victim.x, victim.y, dealt, rgb, dirx, diry, crit);
    }

    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const kind = crit ? 'crit' : 'dmg';
    if (fam === 'SHOTGUN' || fam === 'AUTO') {
      const key = (victim && victim.name) + '|' + (fam === 'SHOTGUN' ? 'SG' : 'AU');
      const windowMs = fam === 'AUTO' ? 110 : 50;
      const prev = agg.get(key);
      if (prev && now - prev.t < windowMs) {
        if (crit) prev.crit += dealt; else prev.normal += dealt;
        prev.x = victim.x; prev.y = victim.y; prev.t = now;
        refreshAggPopups(prev); // PASS A: update the already-live aggregate
      } else {
        if (prev) flushAgg(key);
        const entry = { normal: crit ? 0 : dealt, crit: crit ? dealt : 0, x: victim.x, y: victim.y, t: now, windowMs, popNormal: null, popCrit: null };
        agg.set(key, entry);
        refreshAggPopups(entry); // PASS A: first hit shows its number NOW
      }
    } else {
      pushPopup(victim.x, victim.y, String(Math.round(dealt)), kind, dealt);
    }
  }

  function noteHeal(victim, amount) {
    if (!(amount > 0) || !victim) return;
    pushPopup(victim.x, victim.y, '+' + Math.round(amount), 'heal', amount);
  }

  function tick(dt) {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    for (const [k, a] of agg) {
      if (now - a.t > (a.windowMs || 110)) flushAgg(k);
    }
    for (let i = sprayLive.length - 1; i >= 0; i--) {
      const p = sprayLive[i];
      if (p.fresh) {
        // PASS A hit-feedback law: the simulation tick that created this V1
        // particle must not age or move it before the first rendered frame.
        // The very next tick resumes the approved reference physics.
        p.fresh = false;
        continue;
      }
      p.life -= dt;
      if (p.kind === 'v1core') {
        // Reference: the impact blot fades in place — velocity is not applied.
      } else if (p.kind === 'v1streak' || p.kind === 'v1drop' || p.kind === 'v1micro') {
        // Reference physics: frame-equivalent drag only, no gravity.
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const drag = Math.pow(p.drag || 0.95, dt * 60);
        p.vx *= drag;
        p.vy *= drag;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 420 * dt;
      }
      if (p.life <= 0) {
        sprayLive.splice(i, 1);
        // V1 §9: dying drops/micro may leave a tiny LOCAL mark — never a new
        // explosion. Reference chances: drop ~55% / micro ~11%.
        if ((p.kind === 'v1drop' || p.kind === 'v1micro') && Math.random() < p.landChance) {
          v1FloorSplat(p.x, p.y, p.vx, p.vy, p.landPower);
          stats.v1LandMarks += 1;
        }
        sprayPool.push(p);
      }
    }
    for (let i = popupLive.length - 1; i >= 0; i--) {
      const p = popupLive[i];
      p.life -= dt;
      p.age = (p.age || 0) + dt;
      p.y += p.vy * dt;
      if (p.kind === 'crit' && p.age < 0.09) p.punch = 1.15 - (p.age / 0.09) * 0.15;
      else p.punch = 1;
      if (p.life <= 0) {
        popupLive.splice(i, 1);
        popupPool.push(p);
      }
    }
  }

  function drawStain(c) {
    if (!stainCanvas) return;
    c.drawImage(stainCanvas, 0, 0);
    stats.stainDraws += 1;
  }

  function drawV1Streak(g, p) {
    const alpha = Math.max(0, Math.min(1, p.life / (p.max || 0.38)));
    const ang = Math.atan2(p.vy, p.vx);
    const speed = Math.hypot(p.vx, p.vy);
    const length = Math.max(12, Math.min(55, speed * 0.035 * (p.stretch || 1)));
    g.globalAlpha = 1; // reference bakes alpha into the gradient, not globalAlpha
    g.save();
    g.translate(p.x, p.y);
    g.rotate(ang);
    const gr = g.createLinearGradient(-length, 0, 4, 0);
    gr.addColorStop(0, 'rgba(48,0,0,0)');
    gr.addColorStop(0.35, `rgba(92,0,0,${alpha * 0.55})`);
    gr.addColorStop(1, `rgba(125,3,3,${alpha * 0.96})`);
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(-length, 0);
    g.quadraticCurveTo(-length * 0.35, -p.size * 1.4, 2, -p.size * 0.55);
    g.quadraticCurveTo(8, 0, 2, p.size * 0.55);
    g.quadraticCurveTo(-length * 0.35, p.size * 1.4, -length, 0);
    g.fill();
    g.restore();
  }

  function drawSpray(c) {
    for (const p of sprayLive) {
      if (p.kind === 'v1core') {
        const alpha = Math.max(0, Math.min(1, p.life / (p.max || 0.38)));
        irregularBlob(c, p.x, p.y, p.size, alpha * 0.95, p.rot, p.stretch || 1.5);
      } else if (p.kind === 'v1streak') {
        drawV1Streak(c, p);
      } else if (p.kind === 'v1drop' || p.kind === 'v1micro') {
        const alpha = Math.max(0, Math.min(1, p.life / (p.max || 0.38)));
        const ang = Math.atan2(p.vy, p.vx);
        const speed = Math.hypot(p.vx, p.vy);
        const stretch = p.kind === 'v1drop'
          ? Math.max(1.2, Math.min(3.4, speed / 85))
          : Math.max(1, Math.min(2.3, speed / 120));
        c.globalAlpha = 1;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(ang);
        c.scale(stretch, 1);
        c.beginPath();
        c.arc(0, 0, p.size, 0, Math.PI * 2);
        c.fillStyle = p.kind === 'v1micro'
          ? `rgba(115,2,2,${alpha * 0.82})`
          : `rgba(102,0,0,${alpha * 0.92})`;
        c.fill();
        c.restore();
      } else {
        c.globalAlpha = Math.max(0, p.life / p.max);
        c.fillStyle = rgba(p.rgb, 0.95);
        if (p.wedge && p.len) {
          const ang = Math.atan2(p.vy, p.vx);
          c.save();
          c.translate(p.x, p.y);
          c.rotate(ang);
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(p.len, -p.r);
          c.lineTo(p.len * 0.9, 0);
          c.lineTo(p.len, p.r);
          c.closePath();
          c.fill();
          c.restore();
        } else {
          c.beginPath();
          c.moveTo(p.x + p.r * 1.6, p.y);
          c.lineTo(p.x, p.y - p.r);
          c.lineTo(p.x - p.r * 0.6, p.y);
          c.lineTo(p.x, p.y + p.r);
          c.closePath();
          c.fill();
        }
      }
    }
    c.globalAlpha = 1;
  }

  const ATLAS_COL = 24;
  const ATLAS_ROW = 32;
  function atlasRowFor(kind) {
    if (kind === 'heal') return 1;
    if (kind === 'miss') return 4;
    return 0;
  }
  function drawCritMark(c, x, y, s) {
    c.save();
    c.fillStyle = PALETTE.crit.fill;
    c.strokeStyle = PALETTE.crit.edge;
    c.lineWidth = 1.5;
    c.translate(x, y);
    c.beginPath();
    c.moveTo(0, -10 * s); c.lineTo(4 * s, 0); c.lineTo(0, 10 * s); c.lineTo(-4 * s, 0); c.closePath();
    c.fill(); c.stroke();
    c.beginPath();
    c.moveTo(-10 * s, 0); c.lineTo(0, 4 * s); c.lineTo(10 * s, 0); c.lineTo(0, -4 * s); c.closePath();
    c.fill();
    c.restore();
  }
  // PASS B §12.3: cached Kanit glyph draw. No per-frame font rasterization —
  // digits are pre-rasterized once per kind; drawing is drawImage of cached
  // canvases scaled to the band's target height.
  function drawKanitText(c, text, x, y, kind, scale) {
    const palKey = kind === 'heal' ? 'heal' : kind === 'crit' ? 'crit' : kind === 'miss' ? 'miss' : 'dmg';
    if (!kanit.ready || !kanit.digits[palKey]) return null;
    const band = bandForScale(scale);
    const targetH = KANIT_TARGET_H[band.id] || 38;
    const ref = kanit.refInk[palKey];
    const k = targetH / KANIT_RASTER_H;
    if (palKey === 'miss') {
      const g = kanit.miss;
      if (!g) return null;
      const baseScreen = y + (g.baseline - (g.inkTop + g.inkBottom) / 2) * k;
      c.drawImage(g.canvas, x - (g.w * k) / 2, baseScreen - g.baseline * k, g.w * k, g.h * k);
      stats.kanitDraws = (stats.kanitDraws || 0) + 1;
      return { halfW: (g.w * k) / 2, k, palKey, bandTarget: targetH };
    }
    const glyphs = String(text);
    let total = 0;
    let plusPrefix = false;
    for (let i = 0; i < glyphs.length; i++) {
      const ch = glyphs[i];
      if (ch === '+') { plusPrefix = true; total += targetH * 0.75; continue; }
      const d = ch.charCodeAt(0) - 48;
      if (d < 0 || d > 9) { total += KANIT_RASTER_H * 0.55 * k; continue; }
      total += kanit.digits[palKey][d].adv * k;
    }
    // Vertical centering: align the band's digit ink-center to y.
    const baselineScreen = y + (ref.baseline - (ref.top + ref.bottom) / 2) * k;
    let cx = x - total / 2;
    for (let i = 0; i < glyphs.length; i++) {
      const ch = glyphs[i];
      if (ch === '+') {
        const wPlus = targetH * 0.75;
        const barW = targetH * 0.34;
        const barH = Math.max(1.5, targetH * 0.16);
        const px = cx + wPlus / 2;
        const py = y + (ref.baseline - (ref.top + ref.bottom) / 2) * k - 0; // ink-center aligned
        c.save();
        c.fillStyle = PALETTE.heal.fill;
        c.strokeStyle = PALETTE.heal.edge;
        c.lineWidth = Math.max(1, barH * 0.55);
        c.beginPath();
        c.rect(px - barW / 2, py - barH / 2, barW, barH);
        c.rect(px - barH / 2, py - barW / 2, barH, barW);
        c.fill();
        c.stroke();
        c.restore();
        cx += wPlus;
        continue;
      }
      const d = ch.charCodeAt(0) - 48;
      if (d < 0 || d > 9) { cx += KANIT_RASTER_H * 0.55 * k; continue; }
      const g = kanit.digits[palKey][d];
      c.drawImage(g.canvas, cx, baselineScreen - g.baseline * k, g.w * k, g.h * k);
      cx += g.adv * k;
    }
    stats.kanitDraws = (stats.kanitDraws || 0) + 1;
    return { halfW: total / 2, k, palKey, bandTarget: targetH };
  }

  function drawAtlasText(c, text, x, y, kind, scale) {
    if (kanit.ready) {
      const res = drawKanitText(c, text, x, y, kind, scale);
      if (res) {
        stats.atlasDraws = (stats.atlasDraws || 0) + 1;
        const palKey = kind === 'heal' ? 'heal' : kind === 'crit' ? 'crit' : kind === 'miss' ? 'miss' : 'dmg';
        stats.lastPopupPalette = PALETTE[palKey].fill;
        return res;
      }
    }
    if (!stats.atlasReady) buildTintedAtlas();
    // Headless canvas backends may not have resolved the font yet — retry the
    // cache build lazily (still bounded: rasterization happens at most once).
    if (!kanit.ready && kanit.fontSource === 'probe-pending (retry on draw)') buildKanitSheets();
    const palKey = kind === 'heal' ? 'heal' : kind === 'crit' ? 'crit' : kind === 'miss' ? 'miss' : 'dmg';
    const sheet = tintedAtlas[palKey]
      || (atlasImg && atlasImg.complete ? atlasImg : null);
    if (!sheet || (sheet.naturalWidth != null && sheet.naturalWidth < 240 && !tintedAtlas.dmg)) {
      if (!(atlasImg && atlasImg.complete && atlasImg.naturalWidth >= 240)) return false;
    }
    const src = sheet && (sheet.width || sheet.naturalWidth) ? sheet : atlasImg;
    if (!src) return false;
    stats.atlasDraws = (stats.atlasDraws || 0) + 1;
    stats.lastPopupPalette = PALETTE[palKey].fill;
    const s = 1.55 * (scale || 1);
    if (kind === 'miss') {
      const w = ATLAS_COL * 4;
      const h = ATLAS_ROW;
      c.drawImage(src, 0, ATLAS_ROW * 4, w, h, x - (w * s) / 2, y - (h * s) / 2, w * s, h * s);
      return { halfW: (ATLAS_COL * 4 * s) / 2, k: 1, legacy: true };
    }
    const row = atlasRowFor(kind);
    const glyphs = String(text);
    const total = glyphs.length * ATLAS_COL * s;
    let cx = x - total / 2;
    for (let i = 0; i < glyphs.length; i++) {
      const ch = glyphs[i];
      if (ch === '+') {
        c.save();
        c.fillStyle = PALETTE.heal.fill;
        c.strokeStyle = PALETTE.heal.edge;
        c.lineWidth = 2;
        c.fillRect(cx + 6 * s, y - 2 * s, 10 * s, 4 * s);
        c.fillRect(cx + 9 * s, y - 7 * s, 4 * s, 14 * s);
        c.restore();
        cx += ATLAS_COL * s * 0.7;
        continue;
      }
      const d = ch.charCodeAt(0) - 48;
      if (d < 0 || d > 9) { cx += ATLAS_COL * s; continue; }
      c.drawImage(src, d * ATLAS_COL, row * ATLAS_ROW, ATLAS_COL, ATLAS_ROW,
        cx, y - (ATLAS_ROW * s) / 2, ATLAS_COL * s, ATLAS_ROW * s);
      cx += ATLAS_COL * s;
    }
    return { halfW: total / 2, k: 1, legacy: true };
  }
  function drawPopups(c) {
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    for (const p of popupLive) {
      if (p.kind === 'miss' && /\d/.test(p.text)) stats.numericOnMiss += 1;
      const a = Math.max(0, Math.min(1, p.life / 0.7));
      c.globalAlpha = a;
      const ok = drawAtlasText(c, p.text, p.x, p.y, p.kind, p.scale);
      if (p.kind === 'crit') drawCritMark(c, p.x + 36, p.y - 14, 1.15 * (p.punch || 1));
      if (ok) continue;
    }
    c.restore();
  }

  function drawForeground(c) {
    drawSpray(c);
    drawPopups(c);
  }

  const HEALS = [
    { id: 'HEAL_H1', identity: 'Field Dressing', file: HEAL_FILES.HEAL_H1, master: HEAL_MASTERS.HEAL_H1, restore: 70 },
    { id: 'HEAL_H2', identity: 'Medication', file: HEAL_FILES.HEAL_H2, master: HEAL_MASTERS.HEAL_H2, restore: 126 },
    { id: 'HEAL_H3', identity: 'Auto-injector', file: HEAL_FILES.HEAL_H3, master: HEAL_MASTERS.HEAL_H3, restore: 196 },
    { id: 'HEAL_H4', identity: 'IV / life-support pack', file: HEAL_FILES.HEAL_H4, master: HEAL_MASTERS.HEAL_H4, restore: 280 },
    { id: 'HEAL_H5', identity: 'Trauma hard case', file: HEAL_FILES.HEAL_H5, master: HEAL_MASTERS.HEAL_H5, restore: 385 },
  ];
  HEALS.forEach((h) => { h.img = loadImg(h.file); });

  AQ.feel = {
    resetMatch,
    noteDamage,
    noteHeal,
    tick,
    drawStain,
    drawForeground,
    ensureStain,
    stats,
    heals: HEALS,
    healGameplayEnabled: true,
    palettes: PALETTE,
    tintedAtlas,
    sampleAtlasPixels,
    forceAtlasImage(img) { atlasImg = img; buildTintedAtlas(); },
    stainSurface() { return stainCanvas; },
    livePopups() { return popupLive; },
    liveSpray() { return sprayLive; },
    bandFor,
    sizeBands: SIZE_BANDS,
    blood: BLOOD,
    bloodV1: V1_COLORS,
    v1LiveCap: V1_LIVE_SOFT_CAP,
    // PASS B §12: local Kanit Black Italic glyph cache state (for gates).
    kanitSheets: () => ({
      ready: kanit.ready,
      fontLoaded: kanit.fontLoaded,
      fontSource: kanit.fontSource,
      glyphSig: kanit.glyphSig,
      rasterizations: kanit.rasterizations,
      draws: stats.kanitDraws || 0,
      kinds: Object.keys(kanit.digits).sort().join(','),
      digitsPerKind: Object.keys(kanit.digits).sort().map((kk) => kk + ':' + (kanit.digits[kk] ? kanit.digits[kk].length : 0)).join(','),
      targetH: KANIT_TARGET_H,
    }),
    rebuildKanit: buildKanitSheets,
  };
  window.APEX_ARSENAL_FEEL = AQ.feel;
  window.apexArsenalFeelRuntime = 'ready';
  startKanitFont();
})();
