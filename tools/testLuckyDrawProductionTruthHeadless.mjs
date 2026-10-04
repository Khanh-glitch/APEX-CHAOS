// LUCKY DRAW — production-truth proof through the real production economy.
//
// The canonical Lucky Draw donor ships inside a same-origin iframe (the
// iframe boundary is canonical for the draw). The donor reads
// window.APEX_ARSENAL_META — which lives in the PARENT document. This harness
// mounts the generated public/gold/lucky-draw.html into a real iframe inside a
// jsdom window that runs the real engine + Arsenal runtimes, applies the
// shell's production hand-off (SHL-S21) exactly as production does, and drives
// the REAL draw control through the REAL production meta authority.
//
// No donor economy is invented: every credit, pool and ownership assertion is
// read from / written through window.APEX_ARSENAL_META.
//
// Usage: node tools/testLuckyDrawProductionTruthHeadless.mjs
// Env:   APEX_TOOLING_DIR (default node_modules)
//        APEX_EVIDENCE_DIR (default docs/acceptance/gold-cutover/headless)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { MENU_INTERACTIVE_RUNTIMES, ARSENAL_HUB_RUNTIMES, ARSENAL_PRODUCT_RUNTIMES, SELECT_RUNTIMES } from '../src/game/runtimeManifest.js';
import { resolveLegacyRuntimeFile } from './legacyRuntimeManifest.mjs';
import { installProductSurfaceAuthority } from '../src/game/productSurface.js';

const REPO = process.cwd();
const TOOLING_DIR = process.env.APEX_TOOLING_DIR || path.join(REPO, 'node_modules');
const evidenceDir = process.env.APEX_EVIDENCE_DIR || 'docs/acceptance/gold-cutover/headless';
const requireTool = createRequire(path.join(TOOLING_DIR, 'noop.js'));
const { JSDOM, VirtualConsole } = requireTool('jsdom');
const { createCanvas } = requireTool('@napi-rs/canvas');

const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) => {
  console.log('[page-error]', String((error && error.message) || error).slice(0, 200));
});

const dom = new JSDOM(`<!doctype html><html><body>
  <div id="battle-shell">
    <div id="game-wrapper"><canvas id="game-canvas" width="1000" height="1000"></canvas></div>
    <div class="ui-layer" id="hud"></div>
    <div id="menu-screen" class="screen"></div>
    <div id="select-screen" class="screen hidden"></div>
  </div>
  <div id="luckyDonorHost" aria-hidden="true"><iframe id="luckyDonorFrame" title="APEX CHAOS Lucky Draw"></iframe></div>
</body></html>`, { pretendToBeVisual: true, runScripts: 'dangerously', url: 'http://localhost/', virtualConsole });

const win = dom.window;
installProductSurfaceAuthority(win);
win.__APEX_TEST_MODE = true;
win.__apexStatsSilent = true;

const realCanvases = new WeakMap();
function realCanvasFor(el) {
  let rc = realCanvases.get(el);
  const w = el.width || 300;
  const h = el.height || 150;
  if (!rc || rc.width !== w || rc.height !== h) {
    rc = createCanvas(w, h);
    realCanvases.set(el, rc);
  }
  return rc;
}
win.HTMLCanvasElement.prototype.getContext = function (type) {
  if (type && type !== '2d') return null;
  const realCtx = realCanvasFor(this).getContext('2d');
  return new Proxy(realCtx, {
    get(t, p) { const v = Reflect.get(t, p, t); if (typeof v === 'function') return v.bind(t); return v; },
    set(t, p, v) { return Reflect.set(t, p, v, t); },
  });
};
win.CanvasRenderingContext2D = realCanvasFor(win.document.getElementById('game-canvas')).getContext('2d').constructor;

class ParamStub {
  constructor() { this.value = 0; }
  setValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
  setTargetAtTime() { return this; }
  cancelScheduledValues() { return this; }
}
class AudioNodeStub {
  constructor() {
    this.gain = new ParamStub(); this.frequency = new ParamStub();
    this.Q = new ParamStub(); this.detune = new ParamStub(); this.pan = new ParamStub();
    this.buffer = null; this.loop = false; this.type = 'sine';
  }
  connect() { return this; }
  disconnect() {}
  start() {}
  stop() {}
}
class AudioContextStub {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 48000; this.destination = new AudioNodeStub(); }
  decodeAudioData(buf) {
    const seconds = Math.max(0.05, (buf && buf.byteLength ? buf.byteLength / 2 / 48000 : 0.5));
    return Promise.resolve({ duration: seconds, sampleRate: 48000, length: Math.floor(seconds * 48000) });
  }
  createGain() { return new AudioNodeStub(); }
  createOscillator() { return new AudioNodeStub(); }
  createBufferSource() { return new AudioNodeStub(); }
  createBiquadFilter() { return new AudioNodeStub(); }
  createStereoPanner() { return new AudioNodeStub(); }
  createDynamicsCompressor() { return new AudioNodeStub(); }
  createMediaElementSource() { return new AudioNodeStub(); }
  createBuffer(ch, len, rate) { return { length: len, sampleRate: rate, getChannelData: () => new Float32Array(len) }; }
  resume() { return Promise.resolve(); }
}
function installWindowStubs(target) {
  target.AudioContext = AudioContextStub;
  target.webkitAudioContext = AudioContextStub;
  if (!target.matchMedia) {
    target.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  }
  if (!target.ResizeObserver) {
    target.ResizeObserver = class { constructor(cb) { this.cb = cb; } observe() {} unobserve() {} disconnect() {} };
  }
  if (!target.devicePixelRatio) target.devicePixelRatio = 1;
}
installWindowStubs(win);
win.fetch = () => new Promise(() => {});
class HarnessImage {
  constructor() {
    this.complete = false; this.width = 0; this.height = 0; this.__realImage = null;
    this.onload = null; this.onerror = null;
  }
  set src(v) { this._src = v; this.dispatch('load'); }
  get src() { return this._src; }
  addEventListener() {}
  removeEventListener() {}
  dispatch(type) {
    const h = this[`on${type}`];
    if (typeof h === 'function') h.call(this, { type, target: this });
  }
}
win.Image = HarnessImage;

// ------------------------------------------------------------ script loading
const loadErrors = [];
function loadScript(relPath, required) {
  const fileRelPath = String(relPath).split(/[?#]/, 1)[0];
  const file = resolveLegacyRuntimeFile(REPO, fileRelPath);
  try {
    win.eval(fs.readFileSync(file, 'utf8'));
    return true;
  } catch (error) {
    loadErrors.push({ file: relPath, error: String(error && error.message || error) });
    if (required) throw new Error(`Required runtime failed to load: ${relPath}: ${error}`);
    return false;
  }
}

loadScript('/apexEngine.js', true);
for (const group of [MENU_INTERACTIVE_RUNTIMES, ARSENAL_HUB_RUNTIMES, ARSENAL_PRODUCT_RUNTIMES, SELECT_RUNTIMES]) {
  for (const [src] of group) {
    loadScript(src, true);
  }
}

// ------------------------------------------------------------ test plumbing
const report = { gates: {}, failures: [], loadErrors, evidence: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

// ------------------------------------------------- mount the real iframe donor
// The production shell loads /gold/lucky-draw.html as the iframe src. jsdom
// cannot fetch, so the generated shipping file is written into the iframe
// document byte-for-byte (same document the browser would build).
const luckyHtml = fs.readFileSync(path.join(REPO, 'public/gold/lucky-draw.html'), 'utf8');
const frame = win.document.getElementById('luckyDonorFrame');
installWindowStubs(frame.contentWindow);
// jsdom lacks the Web Animations API (Element.getAnimations) the donor uses to
// cancel tag/reveal animations. Browsers ship it; stub it so the donor's own
// flow runs unmodified.
// An iframe owns its own DOM prototypes, so the PARENT canvas stub does not
// reach the donor: without this the donor's 2D context is null and its reel
// loop dies. Browsers ship canvas 2D here; stub it identically for the donor.
const iframeCanvases = new WeakMap();
frame.contentWindow.HTMLCanvasElement.prototype.getContext = function (type) {
  if (type && type !== '2d') return null;
  const el = this;
  let rc = iframeCanvases.get(el);
  const w = el.width || 300;
  const h = el.height || 150;
  if (!rc || rc.width !== w || rc.height !== h) {
    rc = createCanvas(w, h);
    iframeCanvases.set(el, rc);
  }
  const realCtx = rc.getContext('2d');
  return new Proxy(realCtx, {
    get(t, p) { const v = Reflect.get(t, p, t); if (typeof v === 'function') return v.bind(t); return v; },
    set(t, p, v) { return Reflect.set(t, p, v, t); },
  });
};
frame.contentWindow.CanvasRenderingContext2D = createCanvas(1, 1).getContext('2d').constructor;
frame.contentWindow.Element.prototype.getAnimations = function () { return []; };
// Web Animations: jsdom lacks Element.animate; browsers ship it. Fire onfinish
// on a short clamped delay so the donor's own reel/reveal sequencing runs.
// Web Animations: jsdom lacks Element.animate; browsers ship it. Emulate the
// parts the donor actually uses (finished promise + onfinish) on a short
// clamped delay so the donor's own reel/reveal sequencing runs unmodified.
frame.contentWindow.Element.prototype.animate = function (keyframes, options) {
  const duration = Math.min(Number((options && options.duration) || 0), 30);
  let resolveFinished;
  const finished = new Promise((resolve) => { resolveFinished = resolve; });
  const animation = {
    id: 'stub-anim', currentTime: 0, startTime: 0, playbackRate: 1,
    playState: 'running', replaceState: 'active', onfinish: null, oncancel: null,
    cancel() { if (animation.oncancel) animation.oncancel(); },
    finish() {}, play() {}, pause() {}, reverse() {},
    commitStyles() {}, persist() {},
    addEventListener() {}, removeEventListener() {},
    finished,
  };
  const settle = () => {
    animation.playState = 'finished';
    if (typeof animation.onfinish === 'function') animation.onfinish();
    resolveFinished();
  };
  setTimeout(settle, Math.max(0, duration));
  return animation;
};
frame.contentDocument.open();
frame.contentDocument.write(luckyHtml);
frame.contentDocument.close();
const frameWin = frame.contentWindow;
const frameDoc = frame.contentDocument;

// The shell's production hand-off (generator patch SHL-S21): same-origin
// object hand-off of the REAL parent economy API + donor re-sync.
function handLuckyProductionApi() {
  try {
    const w = frame.contentWindow;
    if (!w) return;
    if (!w.APEX_ARSENAL_META && win.APEX_ARSENAL_META) w.APEX_ARSENAL_META = win.APEX_ARSENAL_META;
    if (typeof w.APEX_LUCKY_SYNC === 'function') w.APEX_LUCKY_SYNC();
  } catch (error) {
    console.warn('[lucky-bridge] hand-off failed', error);
  }
}

async function main() {
  const meta = win.APEX_ARSENAL_META;
  gate('production-meta-authority-present', !!meta
    && typeof meta.spin === 'function'
    && typeof meta.credits === 'function'
    && typeof meta.poolLocked === 'function'
    && typeof meta.save === 'function'
    && typeof meta.getState === 'function', { loadErrors: loadErrors.map((e) => e.file) });

  // 1) generated Lucky Draw boots inside the iframe
  const boot = frameDoc.getElementById('btn1') && frameDoc.getElementById('scrap');
  gate('generated-lucky-draw-boots-in-iframe', !!boot
    && !!frameDoc.getElementById('drawerList')
    && typeof frameWin.APEX_LUCKY_SYNC === 'function', {
    drawControl: !!frameDoc.getElementById('btn1'),
    scrapReadout: !!frameDoc.getElementById('scrap'),
  });

  // 2) APEX_LUCKY_SYNC registered in the DONOR window (not the parent)
  gate('lucky-sync-registers-in-donor-window', frameWin.APEX_LUCKY_SYNC !== win.APEX_LUCKY_SYNC
    && typeof frameWin.APEX_LUCKY_SYNC === 'function'
    && win.APEX_LUCKY_SYNC === undefined, { donorOwn: true });

  // 3) the iframe receives the REAL parent production meta (same object)
  handLuckyProductionApi();
  gate('iframe-receives-real-parent-production-meta', frameWin.APEX_ARSENAL_META === meta, {
    sameObject: frameWin.APEX_ARSENAL_META === meta,
    sameOrigin: frameWin.location.origin === win.location.origin,
  });

  // 4) displayed credits synchronize from real production credits
  const creditsBefore = meta.credits();
  const shownBefore = frameDoc.getElementById('scrap').textContent;
  gate('displayed-credits-sync-from-production', shownBefore === Number(creditsBefore).toLocaleString('en-US'), {
    production: creditsBefore, shown: shownBefore,
  });

  // 5+6+7+8) clicking the real Draw control calls REAL meta.spin() exactly
  // once, costs exactly 350 AC through production truth, decreases the real
  // production balance, and the result maps to a real production fighter.
  const ownedBefore = meta.getState().ownedFighters.slice();
  let spinCalls = 0;
  let lastSpinArg = null;
  const realSpin = meta.spin;
  meta.spin = function spySpin(...args) {
    spinCalls += 1;
    lastSpinArg = args[0];
    return realSpin.apply(this, args);
  };
  frameDoc.getElementById('btn1').dispatchEvent(new frameWin.MouseEvent('click', { bubbles: true, cancelable: true }));
  meta.spin = realSpin;

  const creditsAfterDraw = meta.credits();
  const ownedAfter = meta.getState().ownedFighters.slice();
  const poolTag = frameDoc.getElementById('poolTag');
  gate('real-draw-control-calls-production-spin-once', spinCalls === 1, { spinCalls, rngArg: typeof lastSpinArg });
  gate('successful-draw-costs-exactly-350-ac', creditsAfterDraw === creditsBefore - 350, {
    before: creditsBefore, after: creditsAfterDraw, delta: creditsBefore - creditsAfterDraw,
  });
  gate('credits-decrease-through-real-production-economy', creditsAfterDraw === meta.getState().credits, {
    apiCredits: creditsAfterDraw, savedCredits: meta.getState().credits,
  });
  const drawn = ownedAfter.filter((n) => !ownedBefore.includes(n));
  gate('draw-result-maps-to-real-production-fighter', drawn.length === 1
    && meta.owns(drawn[0]) === true
    && meta.poolLocked().includes(drawn[0]) === false, { drawn });

  // 9) the pool is real/unowned-only and no duplicate ownership is invented
  const duplicates = ownedAfter.filter((n, i) => ownedAfter.indexOf(n) !== i);
  const poolAllUnowned = meta.poolLocked().every((n) => !meta.owns(n));
  gate('pool-is-real-unowned-only-no-duplicates', duplicates.length === 0 && poolAllUnowned === true, {
    duplicates, poolSize: meta.poolLocked().length, poolAllUnowned,
  });

  // The donor's reel is a real animation: let it finish before the next draw
  // (stage.dataset.busy is the donor's own guard, cleared by its own loop).
  async function waitDonorIdle(timeoutMs = 8000) {
    const started = Date.now();
    for (;;) {
      const stage = frameDoc.getElementById('stage');
      if (stage && stage.dataset.busy === '0') return true;
      if (Date.now() - started > timeoutMs) return false;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  await waitDonorIdle();

  // 10) insufficient funds comes from production meta truth
  const brokeState = meta.getState();
  brokeState.credits = 100;
  meta.save(brokeState);
  handLuckyProductionApi(); // reopen re-sync
  const shownBroke = frameDoc.getElementById('scrap').textContent;
  let spinCallsBroke = 0;
  const realSpin2 = meta.spin;
  meta.spin = function spySpin2(...args) { spinCallsBroke += 1; return realSpin2.apply(this, args); };
  frameDoc.getElementById('btn1').dispatchEvent(new frameWin.MouseEvent('click', { bubbles: true, cancelable: true }));
  meta.spin = realSpin2;
  const needTag = poolTag ? poolTag.textContent : '';
  const creditsAfterBroke = meta.credits();
  gate('insufficient-funds-comes-from-production-meta', spinCallsBroke === 1
    && creditsAfterBroke === 100 && /NEED 250 AC/.test(needTag), {
    spinCalls: spinCallsBroke, credits: creditsAfterBroke, tag: needTag, shownBroke,
  });

  // 10b) ROSTER COMPLETE comes from production meta truth (whole playable
  // pool owned through the production save, not a donor flag).
  const completeState = meta.getState();
  completeState.credits = 5000;
  completeState.ownedFighters = meta.playableRoster().map((n) => String(n).toUpperCase());
  meta.save(completeState);
  handLuckyProductionApi();
  let spinCallsComplete = 0;
  const realSpin3 = meta.spin;
  meta.spin = function spySpin3(...args) { spinCallsComplete += 1; return realSpin3.apply(this, args); };
  frameDoc.getElementById('btn1').dispatchEvent(new frameWin.MouseEvent('click', { bubbles: true, cancelable: true }));
  meta.spin = realSpin3;
  const completeTag = poolTag ? poolTag.textContent : '';
  gate('roster-complete-comes-from-production-meta', spinCallsComplete === 1
    && meta.poolLocked().length === 0 && /ROSTER COMPLETE/.test(completeTag), {
    spinCalls: spinCallsComplete, pool: meta.poolLocked().length, tag: completeTag,
  });

  // 11) reopening re-syncs changed parent credits/pool (production award).
  const reopenState = meta.getState();
  reopenState.credits = 0;
  reopenState.ownedFighters = ['ROBOT'];
  meta.save(reopenState);
  meta.award('test-reopen', 425); // real production reward path
  handLuckyProductionApi(); // second open -> re-sync
  const shownReopened = frameDoc.getElementById('scrap').textContent;
  const drawerRows = frameDoc.getElementById('drawerList').children.length;
  gate('reopen-resyncs-changed-production-credits-and-pool', shownReopened === Number(meta.credits()).toLocaleString('en-US')
    && drawerRows === meta.poolLocked().length, {
    production: meta.credits(), shown: shownReopened, drawerRows, productionPool: meta.poolLocked().length,
  });

  // 12) the bridge stays same-origin and idempotent across reopen.
  const beforeSecondHandOff = meta.credits();
  handLuckyProductionApi();
  handLuckyProductionApi();
  // jsdom cannot give a document.write'd iframe a location.origin (about:blank),
  // so the same-origin property is proven from the SHIPPING shell: the iframe
  // src is a same-origin relative path, and the cross-window hand-off worked.
  const shellSrc = fs.readFileSync(path.join(REPO, 'public/gold/shell.html'), 'utf8');
  const iframeSrcSameOrigin = /frame\.src=buildLuckyDonorURL\(\);/.test(shellSrc)
    && /return '\/gold\/lucky-draw\.html';/.test(shellSrc);
  gate('iframe-bridge-same-origin-and-idempotent', frameWin.APEX_ARSENAL_META === meta
    && meta.credits() === beforeSecondHandOff
    && iframeSrcSameOrigin === true, {
    sameObject: frameWin.APEX_ARSENAL_META === meta,
    creditsStable: meta.credits() === beforeSecondHandOff,
    sameOriginRelativeSrc: iframeSrcSameOrigin,
    note: 'jsdom iframe origin is about:blank; same-origin proven from the shipping shell src',
  });

  report.summary = {
    total: Object.keys(report.gates).length,
    passed: Object.values(report.gates).filter((g) => g.pass).length,
    failed: report.failures,
  };
  console.log('\n==== LUCKY DRAW PRODUCTION TRUTH SUMMARY ====');
  console.log(JSON.stringify(report.summary, null, 2));
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'lucky-draw-production-truth-report.json'), JSON.stringify(report, null, 2));
  console.log(`report written under ${evidenceDir}/`);
  if (report.failures.length) process.exitCode = 1;
  try { win.close(); } catch (error) { /* teardown only */ }
}

main().catch((error) => {
  console.error('LUCKY DRAW HARNESS ERROR', error && error.stack ? error.stack : error);
  process.exitCode = 1;
  try { win.close(); } catch (e) { /* teardown only */ }
});
