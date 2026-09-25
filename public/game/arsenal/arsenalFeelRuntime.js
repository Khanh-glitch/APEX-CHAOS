// Arsenal feel layer: persistent victim-colored floor stain, pooled spray,
// bounded damage-number atlas, heal identity plumbing (values blocked if unknown).
(function apexArsenalFeelRuntime() {
  if (window.apexArsenalFeelRuntime === 'ready') return;
  const AQ = window.APEX_ARSENAL || (window.APEX_ARSENAL = {});
  const CFG = window.APEX_ARSENAL_CONFIG;

  const SPECK = '/assets/fang_v1/speckBlood.webp';
  const ATLAS_SRC = '/assets/arsenal/feel/damage/damage1.png';
  const HEAL_FILES = {
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
    healRestoreBlocked: true,
  };

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
  atlasImg.onload = () => { stats.atlasReady = true; };

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

  function footprint(dealt) {
    const d = Math.max(0, dealt);
    const px = 18 + Math.sqrt(d) * 9;
    return Math.min(80, px);
  }

  function allocSpray() {
    const p = sprayPool.pop() || { x: 0, y: 0, vx: 0, vy: 0, r: 2, life: 0, max: 0.2, rgb: [0, 0, 0] };
    if (p.max) stats.sprayReuse += 1;
    return p;
  }

  function stampStain(x, y, dealt, victimRgb, dirx, diry, family) {
    const c = ensureStain();
    if (!c) return;
    const fp = footprint(dealt);
    const main = darken(victimRgb, 0.68);
    const core = darken(victimRgb, 0.48);
    const edge = victimRgb;
    const drops = family === 'SHOTGUN' ? 14 : family === 'PRECISION' ? 10 : family === 'AUTO' ? 8 : 7;
    c.save();
    c.translate(x, y);
    const ang = Math.atan2(diry, dirx);
    c.rotate(ang);
    c.globalCompositeOperation = 'source-over';
    if (speckImg && speckImg.complete && speckImg.naturalWidth) {
      c.save();
      c.globalAlpha = 0.85;
      c.drawImage(speckImg, -fp * 0.55, -fp * 0.45, fp * 1.1, fp * 0.9);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = rgba(main, 0.9);
      c.fillRect(-fp * 0.55, -fp * 0.45, fp * 1.1, fp * 0.9);
      c.restore();
    }
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = rgba(core, 0.72);
    c.beginPath();
    c.ellipse(0, 0, fp * 0.38, fp * 0.22, 0, 0, Math.PI * 2);
    c.fill();
    const streak = family === 'PRECISION' ? fp * 1.15 : family === 'MELEE' ? fp * 0.7 : fp * 0.55;
    c.fillStyle = rgba(main, 0.45);
    c.beginPath();
    c.ellipse(streak * 0.35, 0, streak * 0.55, fp * 0.08, 0, 0, Math.PI * 2);
    c.fill();
    for (let i = 0; i < drops; i++) {
      const a = (Math.random() - 0.5) * (family === 'SHOTGUN' ? 1.6 : 0.9);
      const dist = fp * (0.25 + Math.random() * 0.85);
      const rr = 1.2 + Math.random() * (fp * 0.08);
      c.fillStyle = rgba(i % 3 === 0 ? edge : main, 0.25 + Math.random() * 0.45);
      c.beginPath();
      c.arc(Math.cos(a) * dist, Math.sin(a) * dist * 0.55, rr, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    stats.stamps += 1;
  }

  function emitSpray(x, y, dealt, victimRgb, dirx, diry) {
    const n = Math.min(18, 4 + Math.round(Math.sqrt(dealt) * 2));
    for (let i = 0; i < n; i++) {
      const p = allocSpray();
      const spread = (Math.random() - 0.5) * 0.9;
      const sp = 90 + Math.random() * 220 + dealt * 4;
      p.x = x; p.y = y;
      p.vx = dirx * sp + Math.cos(spread) * 40;
      p.vy = diry * sp + Math.sin(spread) * 40;
      p.r = 1.5 + Math.random() * 3.5;
      p.life = 0.12 + Math.random() * 0.18;
      p.max = p.life;
      p.rgb = victimRgb;
      sprayLive.push(p);
    }
    if (sprayLive.length > stats.sprayPeak) stats.sprayPeak = sprayLive.length;
  }

  function allocPopup() {
    const p = popupPool.pop() || { x: 0, y: 0, text: '', kind: 'dmg', life: 0, vy: 0, scale: 1 };
    if (p.life || p.text) stats.popupReuse += 1;
    return p;
  }

  function pushPopup(x, y, text, kind, scale) {
    const p = allocPopup();
    p.x = x; p.y = y - 18;
    p.text = text;
    p.kind = kind;
    p.life = 0.7;
    p.vy = -46;
    p.scale = scale || 1;
    popupLive.push(p);
    stats.popups += 1;
    if (kind === 'miss') stats.missPopups += 1;
  }

  function flushAgg(key, now) {
    const a = agg.get(key);
    if (!a) return;
    if (a.amount > 0) {
      const heavy = a.amount >= 18;
      pushPopup(a.x, a.y, String(Math.round(a.amount)), heavy ? 'heavy' : 'dmg', heavy ? 1.35 : 1);
    }
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
    const rgb = parseHex(victim && (victim.color || (victim.type && victim.type.color)));
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
      : 'SEMI';
    stats.splatters += 1;
    stampStain(victim.x, victim.y, dealt, rgb, dirx, diry, fam);
    emitSpray(victim.x, victim.y, dealt, rgb, dirx, diry);

    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (fam === 'SHOTGUN' || fam === 'AUTO') {
      const key = (victim && victim.name) + '|' + (fam === 'SHOTGUN' ? 'SG' : 'AU');
      const windowMs = fam === 'AUTO' ? 110 : 50;
      const prev = agg.get(key);
      if (prev && now - prev.t < windowMs) {
        prev.amount += dealt;
        prev.x = victim.x; prev.y = victim.y; prev.t = now;
      } else {
        if (prev) flushAgg(key, now);
        agg.set(key, { amount: dealt, x: victim.x, y: victim.y, t: now, windowMs });
      }
    } else {
      const heavy = dealt >= 18;
      pushPopup(victim.x, victim.y, String(Math.round(dealt)), heavy ? 'heavy' : 'dmg', heavy ? 1.35 : 1);
    }
  }

  function noteHeal(victim, amount) {
    if (!(amount > 0) || !victim) return;
    pushPopup(victim.x, victim.y, '+' + Math.round(amount), 'heal', 1.1);
  }

  function tick(dt) {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    for (const [k, a] of agg) {
      if (now - a.t > (a.windowMs || 110)) flushAgg(k, now);
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
      p.y += p.vy * dt;
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
      c.fillStyle = rgba(p.rgb, 0.9);
      c.beginPath();
      c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
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
      const fs = 22 * p.scale;
      c.font = '900 ' + fs + 'px Impact, Arial Black, sans-serif';
      if (p.kind === 'heal') c.fillStyle = '#5dff7a';
      else if (p.kind === 'heavy') c.fillStyle = '#ffd24a';
      else if (p.kind === 'miss') c.fillStyle = '#d8d2c4';
      else c.fillStyle = '#f4f4f4';
      c.strokeStyle = 'rgba(20,16,12,0.7)';
      c.lineWidth = 4;
      c.strokeText(p.text, p.x, p.y);
      c.fillText(p.text, p.x, p.y);
    }
    c.restore();
  }

  function drawForeground(c) {
    drawSpray(c);
    drawPopups(c);
  }

  const HEALS = [
    { id: 'HEAL_H1', identity: 'Field Dressing', file: HEAL_FILES.HEAL_H1, restore: null },
    { id: 'HEAL_H2', identity: 'Medication', file: HEAL_FILES.HEAL_H2, restore: null },
    { id: 'HEAL_H3', identity: 'Auto-injector', file: HEAL_FILES.HEAL_H3, restore: null },
    { id: 'HEAL_H4', identity: 'IV / life-support pack', file: HEAL_FILES.HEAL_H4, restore: null },
    { id: 'HEAL_H5', identity: 'Trauma hard case', file: HEAL_FILES.HEAL_H5, restore: null },
  ];

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
    healGameplayEnabled: false,
    stainSurface() { return stainCanvas; },
    livePopups() { return popupLive; },
  };
  window.APEX_ARSENAL_FEEL = AQ.feel;
  window.apexArsenalFeelRuntime = 'ready';
})();
