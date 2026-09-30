/* FROST V1 presentation bridge. The PNG layers are extracted from the
 * hash-locked Fusion Gold once at load; gameplay never parses the HTML. */
(function frostPresentation(globalScope) {
  'use strict';
  if (globalScope.APEX_FROST_PRESENTATION) return;
  const layers = {};
  const manifest = {
    base:'/assets/frost_v1/base.png', crest:'/assets/frost_v1/crest.png',
    browL:'/assets/frost_v1/browL.png', browR:'/assets/frost_v1/browR.png',
    jaw:'/assets/frost_v1/jaw.png', eyes:'/assets/frost_v1/eyes.png',
    crack:'/assets/frost_v1/crack.png', cavity:'/assets/frost_v1/cavity.png', sil:'/assets/frost_v1/sil.png',
  };
  let ready = 0;
  for (const [key, src] of Object.entries(manifest)) {
    const img = new Image(); layers[key] = img; img.onload = () => { ready++; };
    img.src = src;
  }
  function isFrost(f) { return !!(f && f.type && f.type.__hrHero === 'ICE'); }
  function draw(ctx, f) {
    if (!isFrost(f)) return false;
    const r = Math.max(1, f.radius || 42), scale = r / 76;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = f.hasStatus && f.hasStatus('freeze') ? .96 : 1;
    const img = layers.base;
    if (img && img.complete) ctx.drawImage(img, -311 * scale, -392 * scale, 622 * scale, 767 * scale);
    for (const key of ['cavity','sil','crest','browL','browR','jaw','eyes']) {
      const part = layers[key]; if (part && part.complete) ctx.drawImage(part, -311 * scale, -392 * scale, 622 * scale, 767 * scale);
    }
    if (f.hasStatus && f.hasStatus('freeze')) { const crack=layers.crack; if (crack && crack.complete) ctx.drawImage(crack, -311*scale,-392*scale,622*scale,767*scale); }
    ctx.restore();
    return true;
  }
  const original = globalScope.Fighter && globalScope.Fighter.prototype.draw;
  if (original && !original.__frostWrapped) {
    const wrapped = function frostDraw(ctx) {
      if (isFrost(this)) {
        ctx.save(); ctx.globalAlpha = this.hasStatus('immune') ? .55 : 1;
        ctx.translate(this.x, this.y); ctx.rotate(Math.atan2(this.dir.y, this.dir.x));
        draw(ctx, this); ctx.restore();
        return;
      }
      return original.call(this, ctx);
    };
    wrapped.__frostWrapped = true; globalScope.Fighter.prototype.draw = wrapped;
  }
  globalScope.APEX_FROST_PRESENTATION = { manifest, draw, isFrost, ready: () => ready === Object.keys(manifest).length };
  globalScope.apexFrostPresentationRuntime = 'ready';
})(typeof window !== 'undefined' ? window : globalThis);
