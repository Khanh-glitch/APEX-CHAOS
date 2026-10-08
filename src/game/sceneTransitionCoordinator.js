import { GOLD_TRANSITION_URL } from './goldAssetManifest.js';

const GOLD_DOOR_RUNTIME_URL = GOLD_TRANSITION_URL;

async function decodeLoadedImages(root) {
  if (!root || !root.querySelectorAll) return;
  // Asset-intent law: this helper NEVER promotes data-apex-src. The surface
  // owner must hydrate its own deferred media during prepare(); the coordinator
  // only verifies media that the destination already chose to request.
  //
  // IMPORTANT: HTMLImageElement.complete is also true after a failed request.
  // If that failure happened before we attach an error listener, waiting for a
  // second error event deadlocks the whole scene transaction at SEALED forever.
  // Treat complete+zero-naturalWidth as a terminal failure and re-check the
  // state immediately after listeners are attached to close the event/state
  // race in both directions.
  const images = [...root.querySelectorAll('img[src]')];
  await Promise.all(images.map(async (img) => {
    const assetError = () => new Error(`Scene asset failed: ${img.currentSrc || img.src || 'image'}`);

    if (img.complete) {
      if (!(img.naturalWidth > 0)) throw assetError();
      try { await img.decode?.(); } catch (_) {}
      return;
    }

    await new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        img.removeEventListener('load', done);
        img.removeEventListener('error', fail);
      };
      const finish = (error = null) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve();
      };
      const done = () => finish();
      const fail = () => finish(assetError());
      const settleFromCurrentState = () => {
        if (!img.complete) return false;
        if (img.naturalWidth > 0) finish();
        else finish(assetError());
        return true;
      };

      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', fail, { once: true });

      // The request can settle between the pre-listener complete check above
      // and addEventListener(). Never depend on a past event being re-fired.
      settleFromCurrentState();
    });

    try { await img.decode?.(); } catch (_) {}
  }));
}

// A destination document only services frames and font faces once it is
// actually rendered. The Lucky Draw donor is same-origin but lives in a
// `display:none` host until its OWN commit, so between those two facts it never
// settles: measured live, its requestAnimationFrame callbacks arrived ~1.8s
// late and its frames can stall completely. Waiting on that parked the door in
// CLOSING with the bay unable to open (the frozen Lucky Draw report).
const documentIsRendered = (doc) => {
  try {
    if (!doc || !doc.defaultView) return false;
    if (doc.visibilityState === 'hidden') return false;
    const frame = doc.defaultView.frameElement;
    if (!frame) return true;
    if (!frame.getClientRects || frame.getClientRects().length === 0) return false;
    const hostView = frame.ownerDocument?.defaultView;
    if (!hostView?.getComputedStyle) return true;
    const style = hostView.getComputedStyle(frame);
    return style.display !== 'none' && style.visibility !== 'hidden';
  } catch (_) { return true; }
};

export async function settleSceneElement(root, { verifyImages = true } = {}) {
  // Media the destination already chose to request is always verified: that is
  // what "the destination is ready" means. Only the PAINT verification moves,
  // because a document that cannot render yet cannot be asked for a frame.
  if (verifyImages) await decodeLoadedImages(root);
  const doc = root?.ownerDocument || document;
  const view = doc?.defaultView || window;
  const rendered = documentIsRendered(doc);
  if (rendered) {
    try { await doc?.fonts?.ready; } catch (_) {}
  }
  // The door covers the LIVE parent surface, so that is the surface whose
  // painted frame must exist before READY. The hidden destination keeps its own
  // settle once it is committed and visible.
  const paintView = rendered ? view : (view.frameElement?.ownerDocument?.defaultView || window);
  await new Promise((resolve) => (paintView.requestAnimationFrame || requestAnimationFrame)(resolve));
  await new Promise((resolve) => (paintView.requestAnimationFrame || requestAnimationFrame)(resolve));
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((r, j) => { resolve = r; reject = j; });
  return { promise, resolve, reject };
}

let runtimePromise = null;
function loadGoldDoorRuntime() {
  if (window.__ApexDoorV4?.TransitionEngine && window.__ApexDoorV4?.loadAssets) {
    return Promise.resolve(window.__ApexDoorV4);
  }
  if (runtimePromise) return runtimePromise;
  runtimePromise = new Promise((resolve, reject) => {
    const existing = [...document.scripts].find((s) => {
      try {
        return s.type === 'module'
          && new URL(s.src, document.baseURI).pathname === '/gold/transition/mechanical-door-v4.gold.js';
      } catch (_) { return false; }
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
      // The Gold runtime is authored as one self-contained classic-style file
      // with top-level helpers such as const TAU. Load it as an ES module so
      // those lexical names stay private to the transition runtime and cannot
      // collide with apexEngine.js/global product runtimes. Its explicit
      // window.__ApexDoorV4 export remains the public seam; runtime bytes and
      // motion/state-machine authority are otherwise untouched.
      script.type = 'module';
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
export function installSceneTransitionCoordinator({ canvas, contentRoot, blackout, stallGuardMs = 6000, hardCapMs = 30000, revealGraceMs = 4000 } = {}) {
  if (window.APEX_SCENE_TRANSITION?.version === 'mechanical-door-v4-r50k') return window.APEX_SCENE_TRANSITION;
  if (!canvas) throw new Error('Scene transition canvas is required.');

  let engine = null;
  let active = null;
  let txId = 0;
  let bootStarted = false;
  let bootReadySignalled = false;
  const bootReady = deferred();

  // ── Input serialization (owner law: a scene intent is NEVER swallowed) ────
  // A request that arrives while another transaction is running becomes the
  // PENDING request and runs the moment the current one finishes. Latest
  // intent wins, which is exactly what "press BACK while the door is still
  // moving" has to mean. Dropping the request instead left the player looking
  // at a bay they could not dismiss (the frozen Lucky Draw report).
  let pendingRequest = null;

  // ── Stall guard (owner law: the product may never become input-dead) ─────
  // The door runtime is a requestAnimationFrame machine. If its clock stops
  // (occluded tab, GPU reset, a dropped frame budget) an unfinished
  // transaction would hold `active` forever and every scene input would be
  // swallowed with no recovery. Only a transaction whose engine made NO phase
  // progress for STALL_MS, or that outlives HARD_CAP_MS, is force-finished:
  // the destination stays committed, the cover is removed and input returns.
  const STALL_MS = Math.max(50, Number(stallGuardMs) || 6000);
  const HARD_CAP_MS = Math.max(STALL_MS, Number(hardCapMs) || 30000);
  // ── Reveal budget (owner law: the door is a flourish, not the scene) ──────
  // Once the committed destination has been handed to the door (READY) the door
  // owns only its authored opening: the real engine's openingEnd is 1.68s of
  // phase time, which on a starved renderer (the engine clamps frame dt) can
  // stretch into tens of seconds. Past this wall-clock budget the transaction
  // fail-opens: the cover is released so the destination - already settled and
  // painted - is what the player keeps. Without this bound a slow frame budget
  // left the whole shell parked behind a door that was still "opening", which
  // is the frozen Lucky Draw / unresponsive Mode report.
  const REVEAL_GRACE_MS = Math.max(50, Number(revealGraceMs) || 4000);
  // Sample often enough that a policy-tight guard is still detected promptly,
  // while the production values keep the check cheap.
  const WATCHDOG_INTERVAL_MS = Math.max(25, Math.min(400, Math.round(STALL_MS / 2)));
  let watchdogTimer = 0;
  let watchdogSignature = '';
  let watchdogSignatureAt = 0;

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

  // Gold donor READY has two effects at once: it accelerates the remaining
  // CLOSE and authorizes OPEN once SEALED. Production must keep the first
  // benefit without ever allowing the second before the real destination is
  // ready. We therefore prime the donor's own adaptive close curve as soon as
  // prepare() is complete, then disarm OPEN permission at SEALED until the
  // covered commit + paint + semantic readyGate have all completed.
  const primeAdaptiveClose = (tx) => {
    if (!tx || active !== tx || tx.failed || tx.closePrimed || tx.readySent) return;
    if (!engine || engine.state !== 'CLOSING' || typeof engine.ready !== 'function') return;
    tx.closePrimed = true;
    tx.closePrimedAt = performance.now();
    engine.ready();
  };

  const releaseCover = () => {
    // Fail-open presentation: stop the stuck door and take its canvas out of
    // the composition instead of leaving a frozen mechanical door on screen.
    try { engine?.destroy?.(); } catch (_) {}
    engine = null;
    try {
      if (canvas) {
        canvas.style.display = 'none';
        canvas.setAttribute('aria-hidden', 'true');
      }
    } catch (_) {}
  };

  const startWatchdog = (tx) => {
    stopWatchdog();
    watchdogSignature = '';
    watchdogSignatureAt = performance.now();
    watchdogTimer = setInterval(() => {
      if (active !== tx) { stopWatchdog(); return; }
      const debug = engine?.getDebug?.() || null;
      // Liveness, not numeric wiggle: the door's OWN clock has to move. The
      // phase clock may legitimately stand still (a SEALED hold is the door
      // doing its job) and holdTime/sitting numbers grow while it renders
      // nothing, so those must never read as progress - a dead render loop used
      // to reset the stall timer once per sample and defeat the whole guard.
      const signature = debug
        ? `${debug.state}|${Math.round((debug.wallTime ?? debug.stateTime ?? 0) / 50)}`
        : '';
      const now = performance.now();
      if (signature !== watchdogSignature) {
        watchdogSignature = signature;
        watchdogSignatureAt = now;
      }
      if (debug && debug.state === 'OPENING' && !tx.openingAt) tx.openingAt = now;
      // Explicit boot START is an intentional user-paced sealed hold, not a
      // stalled scene. Never consume the 30s watchdog budget while waiting.
      if (tx.boot && !bootReadySignalled) return;
      const stalledFor = now - watchdogSignatureAt;
      const age = now - tx.startedAt;
      const revealOverdue = Boolean(tx.openingAt) && now - tx.openingAt >= REVEAL_GRACE_MS;
      // A dead door is only recoverable once the destination could survive
      // without its cover. Releasing while prepare() is still in flight swaps
      // the player onto an unprepared surface AND loses the intent - measured
      // live: the Lucky Draw bay needs ~7s of font/decode settle, the starving
      // door stopped drawing after 1.5s, and the old guard cut the scene at 6s,
      // so the bay never opened. Wait for the destination; the hard cap still
      // bounds the whole transaction.
      const doorDead = stalledFor >= STALL_MS && (tx.prepared || age >= HARD_CAP_MS);
      if (doorDead || age >= HARD_CAP_MS || revealOverdue) {
        const reason = revealOverdue
          ? `scene transaction ${tx.name} left the destination behind a still-opening door for ${Math.round(now - tx.openingAt)}ms`
          : doorDead
          ? `scene transaction ${tx.name} made no progress for ${Math.round(stalledFor)}ms`
          : `scene transaction ${tx.name} exceeded ${Math.round(age)}ms`;
        console.warn(`[scene-transition] ${reason}; releasing the scene surface.`);
        tx.failed = true;
        tx.error = tx.error || new Error(reason);
        // The destination is ready: hand it to the player before the door goes.
        forceCommit();
        releaseCover();
        finish(false);
      }
    }, WATCHDOG_INTERVAL_MS);
  };

  const stopWatchdog = () => {
    if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = 0; }
    watchdogSignature = '';
  };

  const finish = (ok = true) => {
    const tx = active;
    if (!tx) return;
    stopWatchdog();
    clearNodeMotion(sourceFor(tx));
    clearNodeMotion(targetFor(tx));
    document.body.classList.remove('apex-scene-transition-active');
    active = null;
    bodyState('DONE');
    tx.done.resolve({ ok, error: tx.error || null, name: tx.name });
    drainPending();
  };

  // The queued intent owns the next transaction. Every caller still receives
  // the result of ITS OWN request, so a queued BACK never resolves the open.
  const drainPending = () => {
    const next = pendingRequest;
    if (!next) return;
    pendingRequest = null;
    startTransaction(next.options)
      .then(next.done.resolve, next.done.reject)
      .catch(() => {});
  };

  // Owner law: a scene intent is never swallowed - and that includes the case
  // where the DOOR is what broke. A destination that finished preparing must
  // still appear even if the engine never delivered its opaque cover, so a
  // forced recovery marks the cover as failed and lets the same commit path run.
  const forceCommit = () => {
    const tx = active;
    if (!tx || tx.committed || !tx.prepared) return false;
    tx.coverFailed = true;
    // A forced recovery is presentation-only: the caller still learns the door
    // failed, but the scene must NOT roll back - the destination is what the
    // player asked for and what prepare() already made ready.
    tx.forced = true;
    void commitWhenSafe();
    return true;
  };

  const commitWhenSafe = async () => {
    const tx = active;
    if (!tx || tx.committed || (!tx.covered && !tx.coverFailed) || !tx.prepared) return;
    tx.committed = true;
    let revealRoot = targetFor(tx);
    try {
      if (tx.failed && !tx.forced) {
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
      // A prepare-time prime is only a close-speed hint. Re-arm READY now so
      // Gold re-samples the REAL final latency for its opening profile.
      if (tx.closePrimed && engine?.readyRequested) engine.readyRequested = false;
      tx.readySent = true;
      tx.readySentAt = performance.now();
      engine?.ready();
    }
  };

  const ensureEngine = async () => {
    if (engine) return engine;
    const [gold, assets] = await Promise.all([loadGoldDoorRuntime(), assetsPromise]);
    engine = new gold.TransitionEngine(canvas, assets, {
      onState: (state) => {
        bodyState(state);
        if (active) {
          active.state = state;
          // If adaptive close reached SEALED before the destination's final
          // semantic gate, revoke the prime's release bit. The Gold door stays
          // fully sealed and keeps its authored hold until final READY.
          if (state === 'SEALED' && active.closePrimed && !active.gateReady && engine?.readyRequested) {
            engine.readyRequested = false;
          }
        }
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

  // Latest intent wins: a superseded request resolves as `superseded` so its
  // caller (e.g. a queued open that a later BACK replaced) is never left
  // hanging, and the survivor runs immediately after the active transaction.
  const queueRequest = (options) => {
    if (pendingRequest) {
      pendingRequest.done.resolve({ ok: false, error: new Error('superseded'), name: pendingRequest.options?.name || 'scene' });
    }
    const queued = deferred();
    pendingRequest = { options, done: queued };
    return queued.promise;
  };

  const startTransaction = async ({
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
    if (active) return queueRequest({ name, prepare, commit, readyGate, rollback, source, target, boot });

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
      gateReady: false,
      readySent: false,
      readySentAt: 0,
      openingAt: 0,
      closePrimed: false,
      coverFailed: false,
      closePrimedAt: 0,
      failed: false,
      error: null,
      startedAt: performance.now(),
    };
    active = tx;
    document.body.classList.add('apex-scene-transition-active');
    startWatchdog(tx);

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
        primeAdaptiveClose(tx);
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

  // Public entry point = the queue-aware transaction starter. One transaction
  // at a time, but an intent that arrives mid-transaction is QUEUED (latest
  // wins) instead of dropped; finish() drains the queue.
  const run = (options = {}) => startTransaction(options);

  const signalBootReady = async () => {
    if (bootReadySignalled) return bootReady.promise;
    try {
      // Home's explicit asset authority has already fetched+decoded every
      // required Home Core dependency before this signal is called. Do NOT scan
      // the whole Gold shell here: Mode/Fighter/Lucky/Battle DOM intentionally
      // coexists in the host and must stay lazy until its own route intent.
      // Boot only needs fonts + two painted frames after the Home DOM is mounted.
      await settleSceneElement(defaultRoot(), { verifyImages: false });
      bootReadySignalled = true;
      // Restore a full liveness budget after the user has explicitly started;
      // otherwise an idle START screen would instantly trip the age hard cap.
      if (active?.boot) {
        active.startedAt = performance.now();
        watchdogSignatureAt = active.startedAt;
      }
      bootReady.resolve(true);
      return true;
    } catch (error) {
      // Never leave beginBoot() waiting on an orphaned promise. A real boot
      // settle failure propagates into the coordinator's normal failure path.
      bootReadySignalled = true;
      bootReady.reject(error);
      throw error;
    }
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
    pending: () => (pendingRequest ? { name: pendingRequest.options?.name || 'scene' } : null),
    guard: () => ({ stallMs: STALL_MS, hardCapMs: HARD_CAP_MS, intervalMs: WATCHDOG_INTERVAL_MS, revealGraceMs: REVEAL_GRACE_MS }),
    dispose: () => {
      stopWatchdog();
      if (pendingRequest) {
        pendingRequest.done.resolve({ ok: false, error: new Error('disposed'), name: pendingRequest.options?.name || 'scene' });
        pendingRequest = null;
      }
      try { engine?.destroy?.(); } catch (_) {}
      engine = null;
      active = null;
      clearNodeMotion(defaultRoot());
      document.body.classList.remove('apex-scene-transition-active');
      canvas.setAttribute('aria-hidden', 'true');
      bodyState('IDLE');
    },
    state: () => active ? {
      id: active.id,
      name: active.name,
      state: active.state,
      prepared: active.prepared,
      covered: active.covered,
      committed: active.committed,
      settled: active.settled,
      readySent: active.readySent,
      closePrimed: active.closePrimed,
      closePrimedMs: active.closePrimedAt ? active.closePrimedAt - active.startedAt : null,
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
