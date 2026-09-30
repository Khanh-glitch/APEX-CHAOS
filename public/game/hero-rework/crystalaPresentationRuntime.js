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
    let st = states.get(f);
    if (st) return st;
    const ct = HR && typeof HR.byCombatant === 'function' ? HR.byCombatant(f) : null;
    const crySt = ct && CRY ? CRY.stateOf(ct) : null;
    const rig = (crySt && crySt.rig) || (GOLD ? GOLD.createRig({ seed: 20260930, visual: true }) : null);
    st = {
      fighter: f,
      combatant: ct,
      cryState: crySt,
      rig,
    };
    states.set(f, st);
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
    for (const ct of M.combatants) {
      if (ct.heroId !== 'CRYSTAL') continue;
      const crySt = CRY ? CRY.stateOf(ct) : null;
      const rig = crySt ? crySt.rig : null;
      if (!rig) continue;
      for (const cons of rig.constructs) {
        if (cons.kind === 'wall' && cons.geom) {
          GOLD.drawWall(ctx, cons.geom, emissive);
        } else if (cons.kind === 'prison' && cons.prison) {
          GOLD.drawPrison(ctx, cons.prison, emissive, front);
        }
      }
      if (!emissive) {
        if (rig.fx) {
          GOLD.drawDebris(ctx, rig.fx.debris, 1);
          GOLD.drawDust(ctx, rig.fx.dust, 1);
        }
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
    const gx = bloom.begin();
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
      if (isCrystal(this)) {
        if (this.hp > 0) body(ctx, this);
        else prevDraw.call(this, ctx);
      } else {
        prevDraw.call(this, ctx);
      }

      if (this === g.fighters?.[g.fighters.length - 1] || this === g.fighters?.[1]) {
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
    renderWorldConstructsAndFx,
    runBloomPass,
  };

  g.APEX_CRYSTALA_PRESENTATION = api;
  g.apexCrystalaPresentationRuntime = 'ready';
})(typeof window !== 'undefined' ? window : globalThis);
