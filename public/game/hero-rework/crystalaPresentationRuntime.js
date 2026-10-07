/* =============================================================================
 * APEX CHAOS — CRYSTALA V1 presentation runtime adapter
 *
 * Implements faithful procedural presentation for CRYSTALA (hero id CRYSTAL)
 * driven by the real gameplay truth (crystalGameplayRuntime.js) and the
 * owner-approved executable Gold engine (crystalaGoldV6.js).
 *
 * Presentation laws:
 * - Authoritative actor source renders once through Chamber actorRender
 * - Shards, trails, constructs, dust, debris and bloom live in world context
 * - Arsenal remains the sole equipped-weapon renderer (no double draw)
 * - Presentation never invents or owns gameplay truth
 * - Cached half-resolution bloom buffers (no per-frame DOM/canvas allocation)
 * ========================================================================== */

(function (g) {
  'use strict';
  if (g.APEX_CRYSTALA_PRESENTATION) return;

  const GOLD = g.APEX_CRYSTALA_GOLD;
  const loadProbe = (phase, detail) => {
    try { return g.apexHeroLoadTelemetry?.mark?.('crystala', phase, detail); } catch (_) { return null; }
  };
  loadProbe('preprocess-start', { source: 'procedural-rig' });
  const CRY = g.APEX_CRYSTAL;
  const HR = g.APEX_HERO_REWORK;

  if (CRY && typeof CRY.setPresentation === 'function') {
    CRY.setPresentation(true);
  }

  const states = new WeakMap();
  let guardianSprites = null;

  // K is mechanically fast by design (0.12 s minimum anticipation), so the
  // production camera needs a crisp Gold-language readability layer rather
  // than a longer fake gameplay window. Every cue below is driven by the real
  // shard job/contact state; it never invents a block or changes collision.
  function drawGuardianReadability(ctx, crySt, rig) {
    if (!ctx || !crySt || !rig || !GOLD) return;
    const now = HR && HR.AIL && typeof HR.AIL.clock === 'function' ? HR.AIL.clock() : 0;
    if (!guardianSprites && typeof GOLD.getSprites === 'function') guardianSprites = GOLD.getSprites();
    const glow = guardianSprites && guardianSprites.glow;
    const S = CRY && CRY.STATE ? CRY.STATE : {};
    for (const job of crySt.jobs || []) {
      const stone = rig.stones && rig.stones[job.shard];
      if (!stone) continue;
      const preparing = job.phase === S.RESERVED || job.phase === S.OUTBOUND || job.phase === 'RESERVED' || job.phase === 'OUTBOUND';
      const contactAge = Number.isFinite(job.contactAt) ? now - job.contactAt : Infinity;
      const contactVisible = job.contact && contactAge >= 0 && contactAge < 0.34;
      if (!preparing && !contactVisible) continue;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (preparing) {
        const pulse = 0.72 + 0.28 * Math.sin((now - (job.reservedAt || now)) * Math.PI * 16);
        const r = Math.max(18, ((stone.gem && stone.gem.r) || 18) * 2.7);
        if (glow) {
          ctx.globalAlpha = 0.30 + pulse * 0.24;
          ctx.drawImage(glow, stone.x - r, stone.y - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 0.72 + pulse * 0.20;
        if (typeof GOLD.drawStar4 === 'function') {
          GOLD.drawStar4(ctx, stone.x, stone.y, Math.max(8, r * 0.34), now * 5.5 + job.shard * 0.7, '#fff7ff');
        }
        const dx = stone.x - (stone.px != null ? stone.px : stone.x);
        const dy = stone.y - (stone.py != null ? stone.py : stone.y);
        const dm = Math.hypot(dx, dy);
        if (dm > 0.25) {
          const ux = dx / dm, uy = dy / dm;
          ctx.beginPath(); ctx.moveTo(stone.x - ux * 50, stone.y - uy * 50); ctx.lineTo(stone.x, stone.y);
          ctx.strokeStyle = 'rgba(202,142,255,0.70)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(stone.x - ux * 34, stone.y - uy * 34); ctx.lineTo(stone.x, stone.y);
          ctx.strokeStyle = 'rgba(255,248,255,0.94)'; ctx.lineWidth = 2; ctx.stroke();
        }
      }

      if (contactVisible) {
        const u = Math.max(0, Math.min(1, contactAge / 0.34));
        const fade = 1 - u;
        const x = job.contact.x, y = job.contact.y;
        ctx.globalAlpha = 0.22 + fade * 0.78;
        if (glow) {
          const gr = 34 + u * 18;
          ctx.drawImage(glow, x - gr, y - gr, gr * 2, gr * 2);
        }
        ctx.beginPath(); ctx.arc(x, y, 10 + u * 30, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239,208,255,0.95)'; ctx.lineWidth = 1.2 + fade * 3.8; ctx.stroke();
        if (typeof GOLD.drawStar4 === 'function') {
          GOLD.drawStar4(ctx, x, y, 10 + fade * 16, -now * 8, '#ffffff');
        }
        if (job.exitV) {
          const em = Math.hypot(job.exitV.x, job.exitV.y) || 1;
          const ex = job.exitV.x / em, ey = job.exitV.y / em;
          const len = 34 + (1 - fade) * 42;
          ctx.globalAlpha = fade * 0.78;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ex * len, y + ey * len);
          ctx.strokeStyle = 'rgba(218,160,255,0.94)'; ctx.lineWidth = 4.2; ctx.lineCap = 'round'; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ex * len * 0.78, y + ey * len * 0.78);
          ctx.strokeStyle = 'rgba(255,255,255,0.96)'; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  function isCrystal(f) {
    if (!f) return false;
    if (f.heroId === 'CRYSTAL' || f.id === 'CRYSTAL') return true;
    const ct = HR && typeof HR.byCombatant === 'function' ? HR.byCombatant(f) : null;
    return !!(ct && ct.heroId === 'CRYSTAL');
  }

  function getPresentationState(f) {
    const ct = HR && typeof HR.byCombatant === 'function' ? HR.byCombatant(f) : null;
    const crySt = ct && CRY ? CRY.stateOf(ct) : null;
    let st = states.get(f);
    if (!st) {
      st = { fighter: f, combatant: ct, cryState: crySt, rig: crySt ? crySt.rig : null };
      states.set(f, st);
    } else {
      // There is exactly ONE six-shard rig: the gameplay-owned rig. Never
      // cache a presentation-only fallback if the first draw races match setup.
      st.combatant = ct;
      st.cryState = crySt;
      st.rig = crySt ? crySt.rig : null;
    }
    return st;
  }

  function body(ctx, f) {
    const st = getPresentationState(f);
    const rig = st.rig;
    if (!rig) return;
    const hero = rig.hero;

    // Synchronize rig hero position with real fighter position
    rig.setBody(f.x, f.y, f.vx || 0, f.vy || 0);

    // Back shards (depth < 0 and in orbit) drawn to world context BEFORE actorRender
    for (const s of rig.stones) {
      if (s.depth < 0 && s.state === 'orbit') {
        GOLD.drawTrail(ctx, s, 1);
        GOLD.drawStone(ctx, s, 1, false);
      }
    }

    // AUDIT-E: Authoritative actor source rendered once via Chamber actorRender
    const P = g.APEX_CHAMBER_PALETTE;
    const renderActor = (sourceCtx) => {
      sourceCtx.save();
      sourceCtx.globalAlpha = f.hasStatus && f.hasStatus('immune') ? 0.55 : 1;
      GOLD.drawCrystala(sourceCtx, hero, false, 1);
      sourceCtx.restore();
    };

    if (P && typeof P.actorRender === 'function' && typeof P.isActive === 'function' && P.isActive()) {
      P.actorRender(ctx, f, f.x, f.y, renderActor);
    } else {
      renderActor(ctx);
    }

    // Front shards & active outbound/return shards drawn to world context AFTER actorRender
    for (const s of rig.stones) {
      if (!(s.depth < 0 && s.state === 'orbit')) {
        GOLD.drawTrail(ctx, s, 1);
        GOLD.drawStone(ctx, s, 1, false);
      }
    }

    // The K guard cue is deliberately above the shard art so a successful
    // intercept reads at full battle zoom, while remaining tied to real truth.
    drawGuardianReadability(ctx, st.cryState, rig);

    // Eye accent drawn to main context above silhouette
    GOLD.drawEyeAccent(ctx, hero, 1);

    // Generic engine status cues stay OUTSIDE Chamber's actor source, matching
    // the normal Fighter.draw contract without re-rendering the base fighter.
    drawGenericStatusVfx(ctx, f);
    loadProbe('first-complete-frame', {
      frame: Number.isFinite(g.__apexRenderFrame) ? g.__apexRenderFrame : null,
    });
  }

  function poisonLevel(exposure = 0) {
    if (exposure >= 10) return 5;
    if (exposure >= 7.5) return 4;
    if (exposure >= 5) return 3;
    if (exposure >= 3) return 2;
    if (exposure >= 1.5) return 1;
    return 0;
  }

  function virusDamageOut(f) {
    let reduction = 0;
    for (const v of (f.virusParasites || [])) reduction += v.level === 1 ? 0.01 : 0.05;
    return Math.max(0.25, 1 - reduction);
  }

  function statusRing(ctx, r, color, label) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.font = "700 15px 'Segoe UI'";
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, -r - 8);
    ctx.restore();
  }

  function drawGenericStatusVfx(ctx, f) {
    if (!f || !f.statuses) return;
    const has = (name) => typeof f.hasStatus === 'function'
      ? f.hasStatus(name)
      : !!(f.statuses[name] && f.statuses[name].timer > 0);
    const r = f.radius || 75;
    const dir = f.dir || { x: 1, y: 0 };

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(Math.atan2(dir.y || 0, dir.x || 1));

    if (has('freeze')) statusRing(ctx, r + 18, '#a6f4ff', 'FREEZE');
    if (has('stun')) {
      if (typeof g.drawStunAsset === 'function') g.drawStunAsset(ctx, r);
      else statusRing(ctx, r + 22, '#4fe8ff', 'STUN');
    }
    if (has('poison')) {
      const lvl = poisonLevel(f.statuses.poison.exposure || 0);
      statusRing(ctx, r + 26, '#88ff00', 'POISON ' + lvl);
      if (lvl > 0) {
        ctx.save();
        ctx.rotate(-Math.atan2(dir.y || 0, dir.x || 1));
        ctx.fillStyle = '#b6ff4a';
        ctx.strokeStyle = '#0b1702';
        ctx.lineWidth = 6;
        ctx.font = "900 54px 'Segoe UI'";
        ctx.textAlign = 'center';
        ctx.strokeText(String(lvl), 0, -r - 50);
        ctx.fillText(String(lvl), 0, -r - 50);
        ctx.restore();
      }
    }
    if (has('disease')) {
      const mult = f.statuses.disease.mult ?? 1;
      statusRing(ctx, r + 30, '#b9ff55', 'VIRUS -' + Math.round((1 - mult) * 100) + '%');
    }
    if (has('weak') && !(f.statuses.weak && f.statuses.weak.source && f.statuses.weak.source.name === 'BLADE')) {
      statusRing(ctx, r + 34, '#ff3030', 'WEAK');
    }
    if (f.virusParasites && f.virusParasites.length) {
      const now = Date.now() / 600;
      const damageOut = virusDamageOut(f);
      ctx.save();
      ctx.rotate(-Math.atan2(dir.y || 0, dir.x || 1));
      ctx.fillStyle = '#b9ff55';
      ctx.strokeStyle = '#102006';
      ctx.lineWidth = 5;
      ctx.font = '900 20px monospace';
      ctx.textAlign = 'center';
      const label = 'VIRUS -' + Math.round((1 - damageOut) * 100) + '% DMG';
      ctx.strokeText(label, 0, -r - 82);
      ctx.fillText(label, 0, -r - 82);
      ctx.restore();
      f.virusParasites.slice(0, 18).forEach((v, i) => {
        const rr = r + 44 + (i % 3) * 10;
        const a = (v.angle || 0) + now * (0.35 + v.level * 0.08);
        ctx.fillStyle = v.level === 1 ? '#b8ff63' : v.level === 2 ? '#78cf3d' : '#ff7070';
        ctx.strokeStyle = '#102006';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, v.level === 1 ? 7 : v.level === 2 ? 10 : 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  let bloomSystem = null;
  function getBloom(w = 1000, h = 1000) {
    if (!bloomSystem && GOLD && typeof GOLD.createBloomSystem === 'function') {
      bloomSystem = GOLD.createBloomSystem({ width: w, height: h, scale: 0.5 });
    }
    return bloomSystem;
  }

  // Hexa/Wall used to pay seeded cell-mesh derivation on the cast frame.
  // Warm likely early construct seeds opportunistically while the browser is
  // idle; Gold keeps a template cache and clones fresh mutable state on cast.
  (function scheduleWallGeometryPrewarm(){
    if (!GOLD || typeof GOLD.prewarmWallGeometry !== 'function') return;
    let seed = 8;
    const one = () => {
      try { GOLD.prewarmWallGeometry(seed, 220); } catch (e) { return; }
      seed += 1;
      if (seed > 16) return;
      if (typeof g.requestIdleCallback === 'function') g.requestIdleCallback(one, { timeout: 700 });
      else if (typeof g.setTimeout === 'function') g.setTimeout(one, 32);
    };
    if (typeof g.requestIdleCallback === 'function') g.requestIdleCallback(one, { timeout: 700 });
    else if (typeof g.setTimeout === 'function') g.setTimeout(one, 0);
  })();

  // Stable construct raster cache. Gold remains the source renderer: a cache is
  // created only after all visible build/pulse/hit animation has settled, at 2x
  // supersampling. Any new lit/stress/crack/break/collapse state immediately
  // invalidates it and resumes procedural Gold rendering.
  const constructRasterCache = new WeakMap();
  const constructCacheStats = { builds:0, hits:0, invalidations:0 };
  const CACHE_SS = 2;

  function cacheCanvas(w, h) {
    let cv = null;
    if (typeof OffscreenCanvas !== 'undefined') {
      try { cv = new OffscreenCanvas(w, h); } catch (e) { cv = null; }
    }
    if (!cv && typeof document !== 'undefined' && document.createElement) {
      cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    }
    return cv;
  }

  function wallRasterStable(w) {
    if (!w || !w.solid || w.collapsed || w.collapsing || !Array.isArray(w.segs)) return false;
    if (w.seamT != null && w.seamT >= 0 && w.seamT < 0.62) return false;
    for (const sg of w.segs) {
      if (!sg || sg.dead || (sg.grow || 0) < 0.999) return false;
      if ((sg.lit || 0) > 0.012 || (sg.stress || 0) > 0.012) return false;
      if (sg.cracks && sg.cracks.some(cr => (cr.glow || 0) > 0.012)) return false;
    }
    return true;
  }

  function prisonRasterStable(p) {
    if (!p || !p.solid || p.collapsed || (p.pulse != null && p.pulse >= 0) || !Array.isArray(p.edges)) return false;
    for (const e of p.edges) {
      if (!e || e.dead || e.collapsing || !e.grown || (e.lit || 0) > 0.012 || !e.wallGeom) return false;
      for (const sg of (e.wallGeom.segs || [])) {
        if (!sg || sg.dead || (sg.lit || 0) > 0.012 || (sg.stress || 0) > 0.012) return false;
      }
    }
    return true;
  }

  function constructRasterStable(cons) {
    return cons && (cons.kind === 'wall' ? wallRasterStable(cons.geom)
      : cons.kind === 'prison' ? prisonRasterStable(cons.prison) : false);
  }

  function cachedConstructLayer(ctx, cons, front) {
    if (!constructRasterStable(cons)) {
      if (constructRasterCache.has(cons)) {
        constructRasterCache.delete(cons); constructCacheStats.invalidations += 1;
      }
      return false;
    }
    let entry = constructRasterCache.get(cons);
    if (!entry) {
      const b = constructBloomBounds(cons);
      if (!b) return false;
      const pad = 8;
      const minX=b.minX-pad, minY=b.minY-pad, maxX=b.maxX+pad, maxY=b.maxY+pad;
      const ww=maxX-minX, wh=maxY-minY;
      entry={ minX,minY,ww,wh,layers:{} };
      constructRasterCache.set(cons,entry);
    }
    const key = cons.kind === 'wall' ? 'wall' : (front ? 'front' : 'back');
    let cv = entry.layers[key];
    if (!cv) {
      cv = cacheCanvas(Math.max(1,Math.ceil(entry.ww*CACHE_SS)),Math.max(1,Math.ceil(entry.wh*CACHE_SS)));
      if (!cv) return false;
      const cc=cv.getContext('2d');
      cc.setTransform(CACHE_SS,0,0,CACHE_SS,-entry.minX*CACHE_SS,-entry.minY*CACHE_SS);
      cc.clearRect(entry.minX,entry.minY,entry.ww,entry.wh);
      if (cons.kind === 'wall') GOLD.drawWall(cc,cons.geom,false);
      else GOLD.drawPrison(cc,cons.prison,false,!!front);
      entry.layers[key]=cv; constructCacheStats.builds += 1;
    }
    ctx.drawImage(cv,entry.minX,entry.minY,entry.ww,entry.wh);
    constructCacheStats.hits += 1;
    return true;
  }

  function renderWorldConstructsAndFx(ctx, emissive = false, front = null) {
    const M = HR && HR.match;
    if (!M || !GOLD) return;
    const drawBack = front !== true;
    const drawFront = front !== false;
    for (const ct of M.combatants) {
      if (ct.heroId !== 'CRYSTAL') continue;
      const crySt = CRY ? CRY.stateOf(ct) : null;
      const rig = crySt ? crySt.rig : null;
      if (!rig) continue;
      for (const cons of rig.constructs) {
        // Gold draws Wall once behind the actor. Prison alone is split into
        // back/front edges. This prevents Wall/FX from being doubled by the
        // engine's pre-actor drawProjectiles pass plus post-actor front pass.
        if (cons.kind === 'wall' && cons.geom) {
          if (drawBack && (emissive || !cachedConstructLayer(ctx,cons,false))) GOLD.drawWall(ctx, cons.geom, emissive);
        } else if (cons.kind === 'prison' && cons.prison) {
          if (front == null) {
            if (emissive || !cachedConstructLayer(ctx,cons,false)) GOLD.drawPrison(ctx, cons.prison, emissive, false);
            if (emissive || !cachedConstructLayer(ctx,cons,true)) GOLD.drawPrison(ctx, cons.prison, emissive, true);
          } else {
            if (emissive || !cachedConstructLayer(ctx,cons,front)) GOLD.drawPrison(ctx, cons.prison, emissive, front);
          }
        }
      }
      // Gold reference draws debris/dust after the actor/shards: exactly once
      // in the front world-FX pass, never once per layer.
      if (!emissive && drawFront && rig.fx) {
        GOLD.drawDebris(ctx, rig.fx.debris, 1);
        GOLD.drawDust(ctx, rig.fx.dust, 1);
      }
    }
  }

  function transformedRegion(m, bounds, cw, ch, pad = 40) {
    if (!bounds) return null;
    const pts = [
      [bounds.minX, bounds.minY], [bounds.maxX, bounds.minY],
      [bounds.minX, bounds.maxY], [bounds.maxX, bounds.maxY],
    ].map(([x, y]) => m
      ? { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }
      : { x, y });
    let minX = Math.min(...pts.map(p => p.x)) - pad;
    let maxX = Math.max(...pts.map(p => p.x)) + pad;
    let minY = Math.min(...pts.map(p => p.y)) - pad;
    let maxY = Math.max(...pts.map(p => p.y)) + pad;
    minX = Math.max(0, Math.floor(minX)); minY = Math.max(0, Math.floor(minY));
    maxX = Math.min(cw, Math.ceil(maxX)); maxY = Math.min(ch, Math.ceil(maxY));
    if (maxX <= minX || maxY <= minY) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function bodyBloomBounds(rig) {
    const h = rig.hero;
    let minX = Math.min(h.x, h.px ?? h.x) - 145, maxX = Math.max(h.x, h.px ?? h.x) + 145;
    let minY = Math.min(h.y, h.py ?? h.y) - 165, maxY = Math.max(h.y, h.py ?? h.y) + 165;
    for (const s of rig.stones) {
      const r = Math.max(54, ((s.gem && s.gem.r) || 22) * 2.45);
      minX = Math.min(minX, s.x - r, (s.px ?? s.x) - r);
      maxX = Math.max(maxX, s.x + r, (s.px ?? s.x) + r);
      minY = Math.min(minY, s.y - r, (s.py ?? s.y) - r);
      maxY = Math.max(maxY, s.y + r, (s.py ?? s.y) + r);
    }
    return { minX, minY, maxX, maxY };
  }

  function constructBloomBounds(cons) {
    if (cons.kind === 'wall' && cons.geom && Array.isArray(cons.geom.segs) && cons.geom.segs.length) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const s of cons.geom.segs) {
        if (!s) continue;
        const x = s.x + (s.driftX || 0), y = s.y + (s.driftY || 0);
        minX = Math.min(minX, x - 54); maxX = Math.max(maxX, x + 54);
        minY = Math.min(minY, y - 54); maxY = Math.max(maxY, y + 54);
      }
      if (Number.isFinite(minX)) return { minX, minY, maxX, maxY };
    }
    if (cons.kind === 'prison' && cons.prison) {
      const p = cons.prison, r = (p.R || p.radius || 135) + 72;
      if (Number.isFinite(p.cx) && Number.isFinite(p.cy)) return { minX:p.cx-r, minY:p.cy-r, maxX:p.cx+r, maxY:p.cy+r };
    }
    return null;
  }

  function renderBloomRegion(ctx, bloom, worldTransform, cw, ch, bounds, draw) {
    const region = transformedRegion(worldTransform, bounds, cw, ch, 44);
    if (!region) return;
    const gx = bloom.begin(worldTransform, region);
    if (!gx) return;
    draw(gx);
    bloom.composite(ctx, cw, ch, region);
  }

  function runBloomPass(ctx) {
    const M = HR && HR.match;
    if (!M || !GOLD) return;
    const crystals = M.combatants.filter(ct => ct.heroId === 'CRYSTAL');
    if (!crystals.length) return;

    const gameCanvas = ctx.canvas || (typeof document !== 'undefined' ? document.getElementById('game-canvas') : null);
    const cw = gameCanvas ? gameCanvas.width : (g.GAME_SIZE || 1000);
    const ch = gameCanvas ? gameCanvas.height : (g.GAME_SIZE || 1000);
    const bloom = getBloom(cw, ch);
    if (!bloom) return;
    // Keep the exact production camera matrix. Only transparent acreage outside
    // each emitter group is cropped before the same two Gold blur passes.
    const worldTransform = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;

    for (const ct of crystals) {
      const crySt = CRY ? CRY.stateOf(ct) : null;
      const rig = crySt ? crySt.rig : null;
      if (!rig) continue;

      renderBloomRegion(ctx, bloom, worldTransform, cw, ch, bodyBloomBounds(rig), gx => {
        for (const s of rig.stones) GOLD.drawStone(gx, s, 1, true);
        GOLD.drawCrystala(gx, rig.hero, true, 1);
      });

      // Constructs can be far from Crystal. Blur them in their own tight region
      // instead of forcing the body-to-construct union to become arena-sized.
      for (const cons of rig.constructs) {
        const bounds = constructBloomBounds(cons);
        if (!bounds) continue;
        renderBloomRegion(ctx, bloom, worldTransform, cw, ch, bounds, gx => {
          if (cons.kind === 'wall' && cons.geom) GOLD.drawWall(gx, cons.geom, true);
          else if (cons.kind === 'prison' && cons.prison) {
            GOLD.drawPrison(gx, cons.prison, true, false);
            GOLD.drawPrison(gx, cons.prison, true, true);
          }
        });
      }
    }
  }

  const Fighter = g.Fighter;
  if (Fighter && Fighter.prototype && !Fighter.prototype.__crystalaPresentationWrapped) {
    const prevDraw = Fighter.prototype.draw;
    Fighter.prototype.__crystalaPresentationWrapped = true;
    Fighter.prototype.draw = function (ctx) {
      let bypassedPrevDraw = false;
      if (isCrystal(this)) {
        if (this.hp > 0) { body(ctx, this); bypassedPrevDraw = true; }
        else prevDraw.call(this, ctx);
      } else {
        prevDraw.call(this, ctx);
      }

      if (this === g.fighters?.[g.fighters.length - 1] || this === g.fighters?.[1]) {
        // Hunter's ROOT trap front blades/fx historically live in the previous
        // Fighter.draw wrapper. A living Crystal bypasses that wrapper for its
        // custom body, so explicitly run Hunter's shared post-world hook once.
        if (bypassedPrevDraw && g.APEX_HUNTER_PRESENTATION?.renderPostWorld) {
          g.APEX_HUNTER_PRESENTATION.renderPostWorld(ctx);
        }
        renderWorldConstructsAndFx(ctx, false, true);
        runBloomPass(ctx);
      }
    };
  }

  const prevDrawProjectiles = g.drawProjectiles;
  g.drawProjectiles = function (ctx) {
    renderWorldConstructsAndFx(ctx, false, false);
    if (typeof prevDrawProjectiles === 'function') {
      prevDrawProjectiles.call(this, ctx);
    }
  };

  const api = {
    ready: true,
    inspect(f) {
      const st = getPresentationState(f);
      return {
        awake: st.rig ? st.rig.hero.awake : 0,
        stones: st.rig ? st.rig.stones.map(s => ({ id: s.id, state: s.state, energy: s.energy })) : [],
        constructs: st.rig ? st.rig.constructs.length : 0,
      };
    },
    getBloom,
    renderBody: body,
    renderIdentityBody(ctx, f) {
      const st = getPresentationState(f);
      if (!st.rig) return false;
      st.rig.setBody(f.x, f.y, f.vx || 0, f.vy || 0);
      ctx.save();
      try {
        ctx.globalAlpha = f.hasStatus && f.hasStatus('immune') ? 0.55 : 1;
        GOLD.drawCrystala(ctx, st.rig.hero, false, 1);
      } finally { ctx.restore(); }
      return true;
    },
    renderStatusVfx: drawGenericStatusVfx,
    renderWorldConstructsAndFx,
    runBloomPass,
    constructCacheStats,
  };

  g.APEX_CRYSTALA_PRESENTATION = api;
  loadProbe('preprocess-ready', { source: 'procedural-rig', ready: true });
  loadProbe('runtime-ready', { runtime: 'crystalaPresentationRuntime' });
  g.apexCrystalaPresentationRuntime = 'ready';
})(typeof window !== 'undefined' ? window : globalThis);
