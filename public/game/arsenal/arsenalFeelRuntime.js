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
  const SIZE_BANDS = [
    { id: 'XS', min: 1, max: 34, scale: 0.85 },
    { id: 'S', min: 35, max: 69, scale: 1.00 },
    { id: 'M', min: 70, max: 139, scale: 1.15 },
    { id: 'L', min: 140, max: 239, scale: 1.32 },
    { id: 'XL', min: 240, max: 399, scale: 1.50 },
    { id: 'XXL', min: 400, max: 1e9, scale: 1.70 },
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
  function sampleAtlasPixels(kind) {
    if (!stats.atlasReady) buildTintedAtlas();
    const cnv = tintedAtlas[kind];
    if (!cnv) return { fillHits: 0, edgeHits: 0 };
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

  function flushAgg(key) {
    const a = agg.get(key);
    if (!a) return;
    if (a.normal > 0) pushPopup(a.x, a.y, String(Math.round(a.normal)), 'dmg', a.normal);
    if (a.crit > 0) pushPopup(a.x + 18, a.y - 12, String(Math.round(a.crit)), 'crit', a.crit);
    agg.delete(key);
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
    const dx = victim && source ? victim.x - source.x : 1;
    const dy = victim && source ? victim.y - source.y : 0;
    const len = Math.hypot(dx, dy) || 1;
    const dirx = dx / len;
    const diry = dy / len;
    const wid = weaponFromLabel(label);
    const fam = (wid && SHOTGUN_IDS[wid]) ? 'SHOTGUN'
      : (wid && AUTO_IDS[wid]) ? 'AUTO'
      : /sniper|snipex|mbr/i.test(wid || label) ? 'PRECISION'
      : /melee|axe|sabre|dagger|spear|club/i.test(wid || label) ? 'MELEE'
      : /grenade|blast/i.test(wid || label) ? 'BLAST'
      : 'SEMI';
    const crit = !!opts.critical;
    stats.splatters += 1;
    stampStain(victim.x, victim.y, dealt, rgb, dirx, diry, fam, crit);
    emitSpray(victim.x, victim.y, dealt, rgb, dirx, diry, crit);

    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const kind = crit ? 'crit' : 'dmg';
    if (fam === 'SHOTGUN' || fam === 'AUTO') {
      const key = (victim && victim.name) + '|' + (fam === 'SHOTGUN' ? 'SG' : 'AU');
      const windowMs = fam === 'AUTO' ? 110 : 50;
      const prev = agg.get(key);
      if (prev && now - prev.t < windowMs) {
        if (crit) prev.crit += dealt; else prev.normal += dealt;
        prev.x = victim.x; prev.y = victim.y; prev.t = now;
      } else {
        if (prev) flushAgg(key);
        agg.set(key, { normal: crit ? 0 : dealt, crit: crit ? dealt : 0, x: victim.x, y: victim.y, t: now, windowMs });
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
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      if (p.life <= 0) {
        sprayLive.splice(i, 1);
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

  function drawSpray(c) {
    for (const p of sprayLive) {
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
  function drawAtlasText(c, text, x, y, kind, scale) {
    if (!stats.atlasReady) buildTintedAtlas();
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
    const s = 0.9 * (scale || 1);
    if (kind === 'miss') {
      const w = ATLAS_COL * 4;
      const h = ATLAS_ROW;
      c.drawImage(src, 0, ATLAS_ROW * 4, w, h, x - (w * s) / 2, y - (h * s) / 2, w * s, h * s);
      return true;
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
    return true;
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
      if (p.kind === 'crit') drawCritMark(c, p.x + 22, p.y - 8, 0.7 * (p.punch || 1));
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
    bandFor,
    sizeBands: SIZE_BANDS,
    blood: BLOOD,
  };
  window.APEX_ARSENAL_FEEL = AQ.feel;
  window.apexArsenalFeelRuntime = 'ready';
})();
