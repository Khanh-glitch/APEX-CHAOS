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
  const CRY = g.APEX_CRYSTAL;
  const HR = g.APEX_HERO_REWORK;

  if (CRY && typeof CRY.setPresentation === 'function') {
    CRY.setPresentation(true);
  }

  const states = new WeakMap();

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

    // Eye accent drawn to main context above silhouette
    GOLD.drawEyeAccent(ctx, hero, 1);

    // Generic engine status cues stay OUTSIDE Chamber's actor source, matching
    // the normal Fighter.draw contract without re-rendering the base fighter.
    drawGenericStatusVfx(ctx, f);
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
          if (drawBack) GOLD.drawWall(ctx, cons.geom, emissive);
        } else if (cons.kind === 'prison' && cons.prison) {
          if (front == null) {
            GOLD.drawPrison(ctx, cons.prison, emissive, false);
            GOLD.drawPrison(ctx, cons.prison, emissive, true);
          } else {
            GOLD.drawPrison(ctx, cons.prison, emissive, front);
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

  function runBloomPass(ctx) {
    const M = HR && HR.match;
    if (!M || !GOLD) return;
    const hasCrystal = M.combatants.some(ct => ct.heroId === 'CRYSTAL');
    if (!hasCrystal) return;

    const gameCanvas = ctx.canvas || (typeof document !== 'undefined' ? document.getElementById('game-canvas') : null);
    const cw = gameCanvas ? gameCanvas.width : (g.GAME_SIZE || 1000);
    const ch = gameCanvas ? gameCanvas.height : (g.GAME_SIZE || 1000);
    const bloom = getBloom(cw, ch);
    if (!bloom) return;
    // The main ctx is already under Apex's current camera transform here.
    // Feed that exact matrix into the half-res emissive buffer so shake/zoom
    // cannot detach bloom from the body, shards, or constructs.
    const worldTransform = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
    const gx = bloom.begin(worldTransform);
    if (!gx) return;

    for (const ct of M.combatants) {
      if (ct.heroId !== 'CRYSTAL') continue;
      const crySt = CRY ? CRY.stateOf(ct) : null;
      const rig = crySt ? crySt.rig : null;
      if (!rig) continue;

      for (const cons of rig.constructs) {
        if (cons.kind === 'wall' && cons.geom) {
          GOLD.drawWall(gx, cons.geom, true);
        } else if (cons.kind === 'prison' && cons.prison) {
          GOLD.drawPrison(gx, cons.prison, true, false);
          GOLD.drawPrison(gx, cons.prison, true, true);
        }
      }
      for (const s of rig.stones) {
        GOLD.drawStone(gx, s, 1, true);
      }
      GOLD.drawCrystala(gx, rig.hero, true, 1);
    }

    bloom.composite(ctx, cw, ch);
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
    renderStatusVfx: drawGenericStatusVfx,
    renderWorldConstructsAndFx,
    runBloomPass,
  };

  g.APEX_CRYSTALA_PRESENTATION = api;
  g.apexCrystalaPresentationRuntime = 'ready';
})(typeof window !== 'undefined' ? window : globalThis);
