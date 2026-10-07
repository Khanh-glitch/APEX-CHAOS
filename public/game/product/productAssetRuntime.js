(() => {
  'use strict';

  // Product asset intent authority.
  // Fetch/decode readiness is intentionally separate from scene activation:
  // presentation/transition code asks for a surface; this runtime owns bytes.
  const records = new Map();
  const inFlight = new Map();
  const scopeControllers = new Map();
  // E3 profiling-only telemetry. Presentation runtimes publish milestones here;
  // no timing value feeds readiness, scheduling, render, or gameplay.
  const heroLoadPhases = new Map();
  const CORE_SIX = Object.freeze(['newbot','hunter','crystala','magnet','frost','mirror']);
  const now = () => performance.now();
  function heroKey(input) {
    const raw = String(input || '').toLowerCase();
    if (raw === 'robot') return 'newbot';
    if (raw === 'crystal') return 'crystala';
    if (raw === 'ice') return 'frost';
    return raw;
  }
  function markHeroLoad(hero, phase, detail) {
    const key = heroKey(hero);
    if (!key || !phase) return null;
    let rec = heroLoadPhases.get(key);
    if (!rec) { rec = { hero:key, phases:Object.create(null), events:[] }; heroLoadPhases.set(key, rec); }
    const at = now();
    const evt = { phase:String(phase), at, detail: detail && typeof detail === 'object' ? { ...detail } : detail || null };
    rec.events.push(evt);
    // First observation owns the canonical phase timestamp; repeats stay in
    // events for debugging but never rewrite cold-load truth.
    if (!rec.phases[evt.phase]) rec.phases[evt.phase] = evt;
    return evt;
  }

  const STATIC = Object.freeze({
    // Home Core is the ONLY scene required by cold boot. Keep this list small
    // and explicit: it includes CSS-layer art that DOM <img> settling cannot
    // discover by itself.
    home: Object.freeze([
      '/gold/assets/gold/home-world-background.png',
      '/gold/assets/gold/home-foreground.png',
      '/gold/assets/gold/home-robot-body.png',
      '/gold/assets/gold/home-robot-core.png',
      '/gold/assets/gold/home-robot-eye.png',
      '/gold/assets/gold/apex-chaos-wordmark.png',
      '/gold/assets/gold/favicon-apex-chaos.png',
    ]),
    mode: Object.freeze([
      '/gold/assets/gold/mode-solo.webp',
      '/gold/assets/gold/mode-local.webp',
    ]),
    lucky: Object.freeze([
      '/gold/lucky-draw.html',
    ]),
  });

  function cleanUrl(input) {
    if (!input) return '';
    try { return new URL(String(input), window.location.href).href; }
    catch (_) { return String(input); }
  }

  function pathOnly(input) {
    const url = cleanUrl(input);
    try {
      const u = new URL(url);
      return u.pathname + u.search;
    } catch (_) { return String(input || ''); }
  }

  function kindOf(input) {
    const clean = pathOnly(input).split('?')[0].toLowerCase();
    if (/\.(png|jpe?g|webp|gif|avif|svg)$/.test(clean)) return 'image';
    if (/\.(html?)$/.test(clean)) return 'document';
    if (/\.(json)$/.test(clean)) return 'data';
    if (/\.(ogg|mp3|wav|m4a|aac)$/.test(clean)) return 'audio';
    return 'fetch';
  }

  function recordFor(input) {
    const url = cleanUrl(input);
    if (!records.has(url)) {
      records.set(url, {
        url,
        path: pathOnly(url),
        kind: kindOf(url),
        state: 'UNLOADED',
        requestedAt: 0,
        fetchStartedAt: 0,
        fetchedAt: 0,
        bytes: 0,
        decodeStartedAt: 0,
        readyAt: 0,
        error: '',
        lastIntent: '',
      });
    }
    return records.get(url);
  }

  function controllerFor(scope) {
    const key = String(scope || 'global');
    const prev = scopeControllers.get(key);
    if (prev) prev.abort();
    const next = new AbortController();
    scopeControllers.set(key, next);
    return next;
  }

  async function fetchBytes(input, { signal, intent = 'required' } = {}) {
    const rec = recordFor(input);
    rec.lastIntent = intent;
    if (!rec.requestedAt) rec.requestedAt = now();
    if (rec.state === 'READY' || rec.state === 'FETCHED') return rec;
    const key = rec.url + '|fetch';
    if (inFlight.has(key)) return inFlight.get(key);
    const task = (async () => {
      rec.state = 'FETCHING';
      rec.error = '';
      if (!rec.fetchStartedAt) rec.fetchStartedAt = now();
      try {
        const response = await fetch(rec.url, { cache: 'force-cache', signal });
        if (!response.ok) throw new Error(String(response.status) + ' ' + response.statusText);
        const bytes = await response.arrayBuffer();
        rec.bytes = bytes.byteLength || 0;
        rec.state = 'FETCHED';
        rec.fetchedAt = now();
        return rec;
      } catch (error) {
        if (error && error.name === 'AbortError') {
          rec.state = 'UNLOADED';
          throw error;
        }
        rec.state = 'ERROR';
        rec.error = String(error && error.message || error);
        throw error;
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, task);
    return task;
  }

  async function decodeImage(input, { signal, intent = 'required' } = {}) {
    const rec = recordFor(input);
    rec.lastIntent = intent;
    if (rec.state === 'READY') return rec;
    const key = rec.url + '|decode';
    if (inFlight.has(key)) return inFlight.get(key);
    const task = (async () => {
      await fetchBytes(rec.url, { signal, intent });
      if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
      rec.state = 'DECODING';
      if (!rec.decodeStartedAt) rec.decodeStartedAt = now();
      try {
        await new Promise((resolve, reject) => {
          const img = new Image();
          let done = false;
          const finish = (err) => {
            if (done) return;
            done = true;
            img.onload = null;
            img.onerror = null;
            if (signal) signal.removeEventListener('abort', onAbort);
            if (err) reject(err); else resolve();
          };
          const onAbort = () => {
            try { img.src = ''; } catch (_) {}
            finish(new DOMException('Aborted', 'AbortError'));
          };
          if (signal) signal.addEventListener('abort', onAbort, { once: true });
          img.decoding = 'async';
          img.onload = async () => {
            try { if (img.decode) await img.decode(); } catch (_) {}
            finish();
          };
          img.onerror = () => finish(new Error('image decode failed: ' + rec.path));
          img.src = rec.url;
          if (img.complete && img.naturalWidth > 0) {
            Promise.resolve(img.decode ? img.decode().catch(() => {}) : null).then(() => finish());
          }
        });
        rec.state = 'READY';
        rec.readyAt = now();
        return rec;
      } catch (error) {
        if (error && error.name === 'AbortError') {
          rec.state = rec.fetchedAt ? 'FETCHED' : 'UNLOADED';
          throw error;
        }
        rec.state = 'ERROR';
        rec.error = String(error && error.message || error);
        throw error;
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, task);
    return task;
  }

  function roster() {
    try {
      const value = window.APEX_GOLD_ROSTER;
      return value && typeof value === 'object' ? value : {};
    } catch (_) { return {}; }
  }

  // In-battle hero rigs (arena body parts). The hero runtimes compose these
  // URLs at draw time, so they are NOT visible to asset scanners; the generated
  // ONE authority (window.APEX_HERO_RIGS, published by the app from
  // src/game/goldAssetManifest.js) both keeps them in the shipping dist and
  // lets this runtime preload them with the match instead of the first frame.
  function rigUrls(heroIds, roles) {
    if (!roles || !roles.has('rig')) return [];
    const table = window.APEX_HERO_RIGS;
    if (!table || typeof table !== 'object') return [];
    const ids = heroIds === null
      ? Object.keys(table)
      : (Array.isArray(heroIds) ? heroIds.filter(Boolean) : []);
    const out = [];
    for (const id of ids) {
      const urls = table[String(id || '').toLowerCase()] || table[id];
      if (Array.isArray(urls)) out.push(...urls.filter(Boolean));
    }
    return out;
  }

  function heroUrls(heroIds, roles) {
    const table = roster();
    // Explicit contract: null means "all visible roster"; an omitted/empty
    // selection means NONE. This prevents Battle/Fighter focused art from
    // silently expanding into an all-heroes preload.
    const ids = heroIds === null
      ? Object.keys(table)
      : (Array.isArray(heroIds) ? heroIds.filter(Boolean) : []);
    const out = [];
    const wanted = new Set(roles || []);
    for (const id of ids) {
      const hero = table[String(id || '').toLowerCase()] || table[id];
      if (!hero) continue;
      if (wanted.has('portrait') && hero.portrait) out.push(hero.portrait);
      if (wanted.has('art') && hero.art) out.push(hero.art);
      if (wanted.has('battleAvatar') && hero.battleAvatar) out.push(hero.battleAvatar);
      if (wanted.has('skillIcons') && Array.isArray(hero.skillIcons)) out.push(...hero.skillIcons.filter(Boolean));
    }
    return out;
  }

  function urlsFor(surface, context = {}) {
    const id = String(surface || '').toLowerCase();
    if (id === 'home') return STATIC.home.slice();
    if (id === 'mode') return STATIC.mode.slice();
    if (id === 'fighter') {
      // Roster covers are intentionally all-visible; the large hero art and the
      // in-battle rig are only the currently relevant side(s) — the pick screen
      // is where the match rig gets its head start.
      const covers = heroUrls(null, ['portrait']);
      const focused = heroUrls(context.heroIds, ['art']);
      return [...covers, ...focused, ...rigUrls(context.heroIds, new Set(['rig']))];
    }
    if (id === 'fighter-hero') return heroUrls(context.heroIds, ['portrait', 'art']);
    if (id === 'battle' || id === 'transition') {
      // Match assets are strictly selected-combatant scoped, and they include
      // the arena body rig: a fighter whose rig is not ready must never paint a
      // partial body (owner report: MAGNET / FROST).
      return [...heroUrls(context.heroIds, ['battleAvatar', 'skillIcons']), ...rigUrls(context.heroIds, new Set(['rig']))];
    }
    if (id === 'lucky') return STATIC.lucky.slice();
    return [];
  }

  // Bounded fetch/decode pool width. 8 keeps the browser's connection pool and
  // the decoder busy without starving the live render loop that the battle
  // entry is compositing over.
  const PREPARE_CONCURRENCY = 8;

  async function prepare(surface, context = {}) {
    const scope = context.scope || ('surface:' + String(surface || 'unknown'));
    const controller = controllerFor(scope);
    const signal = context.signal || controller.signal;
    const urls = [...new Set(urlsFor(surface, context).filter(Boolean))];
    const decode = context.decode !== false;
    const intent = context.intent || 'required';
    // ONE bounded pool, not a serial walk. A serial await per URL made a single
    // hero rig cost 54 round trips: measured cold, a MAGNET battle took 68s to
    // enter against ROBOT's 31s on the same cache, and the FIFO record log
    // showed exactly one in-flight asset at every sample. Concurrency changes
    // SCHEDULING only - the per-URL records, the in-flight dedupe, the abort
    // contract (checked before each start) and the result order are identical.
    const results = new Array(urls.length);
    let cursor = 0;
    const worker = async () => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        if (index >= urls.length) return;
        if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const url = urls[index];
        const kind = kindOf(url);
        results[index] = kind === 'image' && decode
          ? await decodeImage(url, { signal, intent })
          : await fetchBytes(url, { signal, intent });
      }
    };
    await Promise.all(
      Array.from({ length: Math.max(1, Math.min(PREPARE_CONCURRENCY, urls.length)) }, worker),
    );
    return { surface, urls, ready: results.every((r) => r && (r.state === 'READY' || r.state === 'FETCHED')) };
  }

  function warm(surface, context = {}) {
    const opts = Object.assign({}, context, { decode: false, intent: 'warm' });
    return prepare(surface, opts).catch((error) => {
      if (!error || error.name !== 'AbortError') {
        console.warn('[product-assets] warm failed', surface, error);
      }
      return { surface, urls: [], ready: false };
    });
  }

  function cancel(scope) {
    const key = String(scope || 'global');
    const controller = scopeControllers.get(key);
    if (controller) controller.abort();
    scopeControllers.delete(key);
  }

  function heroAssetUrls(hero) {
    const key = heroKey(hero);
    return [...new Set([
      ...heroUrls([key], ['battleAvatar', 'skillIcons']),
      ...rigUrls([key], new Set(['rig'])),
    ].filter(Boolean))];
  }

  function heroProfile(hero) {
    const key = heroKey(hero);
    const urls = heroAssetUrls(key);
    const recs = urls.map((url) => records.get(cleanUrl(url))).filter(Boolean);
    const times = (name) => recs.map((r) => Number(r[name]) || 0).filter((v) => v > 0);
    const first = (name) => { const a = times(name); return a.length ? Math.min(...a) : 0; };
    const last = (name) => { const a = times(name); return a.length ? Math.max(...a) : 0; };
    const phases = heroLoadPhases.get(key)?.phases || {};
    const requestStartAt = first('requestedAt');
    const fetchDoneAt = last('fetchedAt');
    const decodeDoneAt = last('readyAt');
    const runtimeReadyAt = phases['runtime-ready']?.at || 0;
    const preprocessReadyAt = phases['preprocess-ready']?.at || 0;
    const firstCompleteFrameAt = phases['first-complete-frame']?.at || 0;
    return {
      hero:key,
      assets:{
        count:urls.length,
        observed:recs.length,
        ready:recs.filter((r)=>r.state==='READY'||r.state==='FETCHED').length,
        bytes:recs.reduce((n,r)=>n+(Number(r.bytes)||0),0),
        requestStartAt, fetchDoneAt, decodeDoneAt,
        requestToFetchMs:requestStartAt&&fetchDoneAt?fetchDoneAt-requestStartAt:null,
        requestToDecodeMs:requestStartAt&&decodeDoneAt?decodeDoneAt-requestStartAt:null,
        decodeSpanMs:(first('decodeStartedAt')&&decodeDoneAt)?decodeDoneAt-first('decodeStartedAt'):null,
      },
      runtimeReadyAt:runtimeReadyAt||null,
      preprocessReadyAt:preprocessReadyAt||null,
      firstCompleteFrameAt:firstCompleteFrameAt||null,
      requestToRuntimeMs:requestStartAt&&runtimeReadyAt?runtimeReadyAt-requestStartAt:null,
      requestToPreprocessMs:requestStartAt&&preprocessReadyAt?preprocessReadyAt-requestStartAt:null,
      requestToFirstFrameMs:requestStartAt&&firstCompleteFrameAt?firstCompleteFrameAt-requestStartAt:null,
      phases:Object.fromEntries(Object.entries(phases).map(([name,evt])=>[name,{...evt}])),
    };
  }

  function heroProfiles() {
    return Object.fromEntries(CORE_SIX.map((hero)=>[hero,heroProfile(hero)]));
  }

  function snapshot() {
    return {
      records: Array.from(records.values()).map((r) => Object.assign({}, r)),
      scopes: Array.from(scopeControllers.keys()),
      inflight: Array.from(inFlight.keys()),
      heroes: heroProfiles(),
    };
  }

  window.apexProductAssets = Object.freeze({
    version: '1.0.0',
    urlsFor,
    prepare,
    warm,
    cancel,
    state: snapshot,
    profileHero: heroProfile,
    profileHeroes: heroProfiles,
  });
  window.apexHeroLoadTelemetry = Object.freeze({
    mark: markHeroLoad,
    profile: heroProfile,
    snapshot: heroProfiles,
  });
  window.apexProductAssetRuntime = 'ready';
})();