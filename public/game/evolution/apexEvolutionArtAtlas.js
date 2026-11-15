/* =============================================================================
 * APEX CHAOS: TOTAL EVOLUTION — Authored Art Texture Atlas
 *
 * Runtime facade over high-resolution, feathered-alpha, art-directed source
 * textures. All textures originate from the game's existing Gold Key Art and
 * Skill Art; no geometry-only placeholder is substituted for hero identity.
 * Nested itch.io URLs resolve through the single APEX_APP_URL authority.
 * ========================================================================== */
(function (g) {
  'use strict';
  if (g.APEX_EVOLUTION_ART) return;

  const ROOT = '/assets/evolution/fighters/';
  const SPECS = Object.freeze({
    'black-hole-reactor': ROOT + 'black-hole/reactor-art.png',
    'black-hole-wormhole': ROOT + 'black-hole/wormhole-art.png',
    'black-hole-singularity': ROOT + 'black-hole/singularity-art.png',
    'chrono-astrolabe': ROOT + 'chrono/astrolabe-art.png',
    'chrono-loop': ROOT + 'chrono/loop-art.png',
    'chrono-rewind': ROOT + 'chrono/rewind-art.png',
  });

  const cache = new Map();
  function urlFor(path) {
    try { return typeof g.APEX_APP_URL === 'function' ? g.APEX_APP_URL(path) : path; }
    catch (_) { return path; }
  }
  function request(id) {
    const path = SPECS[id];
    if (!path) return Promise.reject(new Error('Unknown Evolution art texture: ' + id));
    const old = cache.get(id);
    if (old?.promise) return old.promise;
    const entry = { id, path, state: 'LOADING', img: null, error: null, promise: null };
    entry.promise = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = async () => {
        try { await img.decode?.(); } catch (_) { /* onload remains valid */ }
        if (!img.naturalWidth) { entry.state = 'ERROR'; entry.error = 'empty texture'; resolve(false); return; }
        entry.img = img; entry.state = 'READY'; resolve(true);
      };
      img.onerror = () => { entry.state = 'ERROR'; entry.error = 'texture failed to load'; resolve(false); };
      img.src = urlFor(path);
      if (img.complete && img.naturalWidth) { entry.img = img; entry.state = 'READY'; resolve(true); }
    });
    cache.set(id, entry);
    return entry.promise;
  }
  async function prepare(heroIds = []) {
    const wanted = new Set((Array.isArray(heroIds) ? heroIds : [heroIds]).map(x => String(x || '').toLowerCase()));
    const ids = [];
    if (wanted.has('black_hole') || wanted.has('black-hole')) ids.push('black-hole-reactor', 'black-hole-wormhole', 'black-hole-singularity');
    if (wanted.has('time') || wanted.has('chrono')) ids.push('chrono-astrolabe', 'chrono-loop', 'chrono-rewind');
    const results = await Promise.all(ids.map(request));
    // A failed hero art load never strands match startup; the presentation
    // falls back to its art-directed layered rig while diagnostics preserve it.
    return { ready: true, loaded: results.filter(Boolean).length, failed: results.filter(x => !x).length };
  }
  function ready(id) { return cache.get(id)?.state === 'READY'; }
  function image(id) { return cache.get(id)?.img || null; }
  function draw(id, ctx, x, y, width, height, opts = {}) {
    const img = image(id);
    if (!img || !ctx) return false;
    const alpha = Math.max(0, Math.min(1, Number(opts.alpha ?? 1)));
    const blend = opts.blend || 'screen';
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.globalCompositeOperation = blend;
    ctx.translate(x, y);
    if (opts.rotation) ctx.rotate(opts.rotation);
    ctx.scale(opts.flipX ? -1 : 1, opts.flipY ? -1 : 1);
    const w = Math.abs(width), h = Math.abs(height);
    if (opts.clip === 'ellipse') {
      ctx.beginPath(); ctx.ellipse(0, 0, w * 0.5, h * 0.5, 0, 0, Math.PI * 2); ctx.clip();
    } else if (opts.clip === 'round') {
      const r = Math.min(w, h) * 0.12;
      ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, r); ctx.clip();
    }
    if (opts.filter && 'filter' in ctx) ctx.filter = opts.filter;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    return true;
  }
  function diagnostic() {
    return Object.fromEntries([...cache].map(([id, e]) => [id, { path: e.path, state: e.state, width: e.img?.naturalWidth || 0, height: e.img?.naturalHeight || 0, error: e.error }]));
  }

  const api = Object.freeze({ version: 'evo-art-atlas-v1', SPECS, request, prepare, ready, image, draw, diagnostic });
  g.APEX_EVOLUTION_ART = api;
  g.apexEvolutionArtAtlas = 'ready';
})(window);
