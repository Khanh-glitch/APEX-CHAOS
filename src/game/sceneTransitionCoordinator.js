import { GOLD_TRANSITION_URL } from './goldAssetManifest.js';

const GOLD_DOOR_RUNTIME_URL = GOLD_TRANSITION_URL;

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

async function decodeLoadedImages(root) {
  if (!root || !root.querySelectorAll) return;
  // Asset-intent law: this helper NEVER promotes data-apex-src. The surface
  // owner must hydrate its own deferred media during prepare(); the coordinator
  // only verifies media that the destination already chose to request.
  const images = [...root.querySelectorAll('img[src]')];
  await Promise.all(images.map(async (img) => {
    if (img.complete && img.naturalWidth > 0) {
      try { await img.decode?.(); } catch (_) {}
      return;
    }
    await new Promise((resolve, reject) => {
      const done = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error(`Scene asset failed: ${img.currentSrc || img.src || 'image'}`)); };
      const cleanup = () => {
        img.removeEventListener('load', done);
        img.removeEventListener('error', fail);
      };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', fail, { once: true });
    });
    try { await img.decode?.(); } catch (_) {}
  }));
}

export async function settleSceneElement(root) {
  await decodeLoadedImages(root);
  const doc = root?.ownerDocument || document;
  const view = doc?.defaultView || window;
  try { await doc?.fonts?.ready; } catch (_) {}
  // Commit style/layout, then verify one fully painted destination frame in
  // the destination document (important for same-origin Lucky Draw iframe).
  await new Promise((resolve) => (view.requestAnimationFrame || requestAnimationFrame)(resolve));
  await new Promise((resolve) => (view.requestAnimationFrame || requestAnimationFrame)(resolve));
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

let runtimePromise = null;
function loadGoldDoorRuntime() {
  if (window.__ApexDoorV4?.TransitionEngine && window.__ApexDoorV4?.loadAssets) {
    return Promise.resolve(window.__ApexDoorV4);
  }
  if (runtimePromise) return runtimePromise;
  runtimePromise = new Promise((resolve, reject) => {
    const existing = [...document.scripts].find((s) => {
      try { return new URL(s.src, document.baseURI).pathname === '/gold/transition/mechanical-door-v4.gold.js'; }
      catch (_) { return false; }
    });
    const script = existing || document.createElement('script');
    const ready = () => {
      if (!window.__ApexDoorV4?.TransitionEngine || !window.__ApexDoorV4?.loadAssets) {
        reject(new Error('Mechanical Door V4 runtime loaded without Gold export.'));
        return;
      }
      resolve(window.__ApexDoorV4);
    };
    if (existing && window.__ApexDoorV4) { ready(); return; }
    script.addEventListener('load', ready, { once: true });
    script.addEventListener('error', () => reject(new Error('Mechanical Door V4 runtime failed to load.')), { once: true });
    if (!existing) {
      script.src = GOLD_DOOR_RUNTIME_URL;
      script.async = false;
      script.dataset.apexSceneTransitionRuntime = 'true';
      document.head.appendChild(script);
    }
  }).catch((error) => {
    runtimePromise = null;
    throw error;
  });
  return runtimePromise;
}

function resolveNode(candidate, fallback = null) {
  try { return typeof candidate === 'function' ? (candidate() || fallback) : (candidate || fallback); }
  catch (_) { return fallback; }
}

/**
 * Production adapter around the owner-approved Mechanical Door V4.
 * Gold owns every structural/motion/timing decision. This layer owns only:
 *  - semantic scene readiness;
 *  - opaque-cover commit;
 *  - source/target DOM ownership;
 *  - boot black-screen handoff;
 *  - input serialization.
 */
export function installSceneTransitionCoordinator({ canvas, contentRoot, blackout } = {}) {
  if (window.APEX_SCENE_TRANSITION?.version === 'mechanical-door-v4-r50k') return window.APEX_SCENE_TRANSITION;
  if (!canvas) throw new Error('Scene transition canvas is required.');

  let engine = null;
  let active = null;
  let txId = 0;
  let bootStarted = false;
  let bootReadySignalled = false;
  const bootReady = deferred();

  const assetsPromise = loadGoldDoorRuntime().then((gold) => gold.loadAssets());
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.pointerEvents = 'none';

  const bodyState = (state) => { document.body.dataset.apexSceneTransition = state || 'IDLE'; };
  const defaultRoot = () => contentRoot || document.getElementById('gold-shell-host');

  const clearNodeMotion = (node) => {
    node?.classList.remove('apex-scene-collapse');
    if (node) {
      node.style.transform = '';
      node.style.transformOrigin = '';
    }
  };

  const sourceFor = (tx) => resolveNode(tx?.source, defaultRoot());
  const targetFor = (tx) => resolveNode(tx?.target, defaultRoot());

  const finish = (ok = true) => {
    const tx = active;
    if (!tx) return;
    clearNodeMotion(sourceFor(tx));
    clearNodeMotion(targetFor(tx));
    document.body.classList.remove('apex-scene-transition-active');
    active = null;
    bodyState('DONE');
    tx.done.resolve({ ok, error: tx.error || null, name: tx.name });
  };

  const commitWhenSafe = async () => {
    const tx = active;
    if (!tx || tx.committed || !tx.covered || !tx.prepared) return;
    tx.committed = true;
    let revealRoot = targetFor(tx);
    try {
      if (tx.failed) {
        tx.rollback?.(tx.error);
        revealRoot = sourceFor(tx);
      } else {
        // Commit is intentionally synchronous. Network/decode belongs in
        // prepare(); runtime activation that must finish before reveal belongs
        // in readyGate().
        const result = tx.commit?.();
        if (result && typeof result.then === 'function') {
          throw new Error(`Scene commit must be synchronous: ${tx.name}`);
        }
      }

      clearNodeMotion(sourceFor(tx));
      if (revealRoot) {
        revealRoot.style.transformOrigin = 'center';
        // Exact standalone Gold target staging.
        revealRoot.style.transform = 'scale(1.12)';
      }

      // Opening is forbidden until the actual destination has committed a
      // rendered frame and any semantic live gate has completed.
      await settleSceneElement(revealRoot);
      tx.settled = true;
      if (tx.readyGate && !tx.failed) await tx.readyGate();
      tx.gateReady = true;
    } catch (error) {
      console.warn(`[scene-transition] commit/ready failed for ${tx.name}.`, error);
      tx.failed = true;
      tx.error = error;
      try { tx.rollback?.(error); } catch (_) {}
      revealRoot = sourceFor(tx);
      clearNodeMotion(revealRoot);
      if (revealRoot) {
        revealRoot.style.transformOrigin = 'center';
        revealRoot.style.transform = 'scale(1.12)';
      }
      try { await settleSceneElement(revealRoot); } catch (_) {}
      tx.gateReady = true;
    }

    // This is the ONLY production READY→OPEN command. Gold may accelerate the
    // remaining close timeline, but cannot skip close/SEALED/open order.
    if (!tx.readySent && active === tx) {
      tx.readySent = true;
      engine?.ready();
    }
  };

  const ensureEngine = async () => {
    if (engine) return engine;
    const [gold, assets] = await Promise.all([loadGoldDoorRuntime(), assetsPromise]);
    engine = new gold.TransitionEngine(canvas, assets, {
      onState: (state) => {
        bodyState(state);
        if (active) active.state = state;
      },
      onCover: () => {
        if (!active) return;
        active.covered = true;
        void commitWhenSafe();
      },
      onReveal: (p) => {
        const tx = active;
        if (!tx || !tx.committed) return;
        const root = tx.failed ? sourceFor(tx) : targetFor(tx);
        if (root) root.style.transform = `scale(${(1.12 - 0.12 * p).toFixed(4)})`;
      },
      onDone: () => finish(!active?.failed),
    });
    return engine;
  };

  const run = async ({
    name = 'scene',
    prepare = null,
    commit = null,
    readyGate = null,
    rollback = null,
    source = null,
    target = null,
    boot = false,
  } = {}) => {
    await ensureEngine();
    if (active) return active.done.promise;

    const tx = {
      id: ++txId,
      name,
      prepare,
      commit,
      readyGate,
      rollback,
      source,
      target,
      boot,
      done: deferred(),
      state: 'IDLE',
      prepared: false,
      covered: false,
      committed: false,
      settled: false,
      gateReady: !readyGate,
      readySent: false,
      failed: false,
      error: null,
      startedAt: performance.now(),
    };
    active = tx;
    document.body.classList.add('apex-scene-transition-active');

    const sourceRoot = sourceFor(tx);
    if (!boot) sourceRoot?.classList.add('apex-scene-collapse');

    canvas.setAttribute('aria-hidden', 'false');
    bodyState('CLOSING');
    // Gold's demo source-image tile pass is intentionally omitted in product:
    // the REAL live source DOM collapses beneath the exact mechanical door.
    engine.open({ from: null, autoReadyAfter: null });

    Promise.resolve()
      .then(() => prepare?.())
      .then(async () => {
        if (active !== tx) return;
        tx.prepared = true;
        await commitWhenSafe();
      })
      .catch(async (error) => {
        if (active !== tx) return;
        tx.failed = true;
        tx.error = error;
        tx.prepared = true;
        console.warn(`[scene-transition] prepare failed for ${name}.`, error);
        await commitWhenSafe();
      });

    return tx.done.promise;
  };

  const signalBootReady = async () => {
    if (bootReadySignalled) return;
    bootReadySignalled = true;
    // Verify only assets Home has intentionally requested. Deferred Mode/Pick
    // media remains untouched until its own route intent.
    await settleSceneElement(defaultRoot());
    bootReady.resolve();
  };

  const beginBoot = async () => {
    if (bootStarted) return;
    bootStarted = true;
    await run({
      name: 'boot->home',
      boot: true,
      prepare: () => bootReady.promise,
      commit: () => { if (blackout) blackout.hidden = true; },
      source: () => blackout,
      target: defaultRoot,
    });
    window.dispatchEvent(new CustomEvent('apex:boot-transition-complete'));
  };

  const api = Object.freeze({
    version: 'mechanical-door-v4-r50k',
    run,
    beginBoot,
    signalBootReady,
    prepareElement: settleSceneElement,
    assetsReady: () => assetsPromise.then(() => true),
    active: () => Boolean(active),
    state: () => active ? {
      id: active.id,
      name: active.name,
      state: active.state,
      prepared: active.prepared,
      covered: active.covered,
      committed: active.committed,
      settled: active.settled,
      readySent: active.readySent,
      failed: active.failed,
      elapsedMs: performance.now() - active.startedAt,
      engine: engine?.getDebug?.() || null,
    } : { active: false, state: engine?.state || 'IDLE', engine: engine?.getDebug?.() || null },
  });

  window.APEX_SCENE_TRANSITION = api;

  // Boot law: black first; when the Gold transition payload itself is ready,
  // start closing immediately and hold SEALED for the real Home readiness.
  void ensureEngine().then(beginBoot).catch((error) => {
    console.warn('[scene-transition] Gold Mechanical Door V4 failed to initialize.', error);
    bodyState('ERROR');
    // Keep the black screen rather than exposing a half-mounted product.
    if (blackout) blackout.hidden = false;
  });

  return api;
}
