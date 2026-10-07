// R59 E3b — Core Six cold-load browser profiler.
//
// Profiling law:
//   * one fresh Chrome user-data-dir per hero (no warm browser cache inheritance)
//   * real Home -> BOT -> Fighter -> P1 select -> LOCK -> BOT select -> LOCK flow
//   * real pointer events through CDP, never direct calls into selection/game state
//   * product/runtime telemetry is read-only; this script changes no gameplay
//   * each sample ends only after that hero publishes first-complete-frame
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const appUrl = process.env.APEX_APP_URL || 'http://127.0.0.1:5173';
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const evidenceDir = process.env.APEX_EVIDENCE_DIR || 'docs/acceptance/arsenal-product/browser';
const heroes = ['newbot','hunter','crystala','magnet','frost','mirror'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pageTarget(endpoint) {
  for (let i = 0; i < 150; i++) {
    try {
      const targets = await fetch(endpoint + '/json/list').then((r) => r.json());
      const page = targets.find((x) => x.type === 'page' && /^https?:/.test(x.url || ''))
        || targets.find((x) => x.type === 'page');
      if (page) return page;
    } catch {}
    await sleep(100);
  }
  throw new Error('CDP page target did not become ready');
}

async function connect(endpoint) {
  const target = await pageTarget(endpoint);
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let serial = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
  });
  const command = (method, params = {}) => {
    const id = ++serial;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  };
  const evaluate = async (expression) => {
    const r = await command('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true, userGesture: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result.value;
  };
  const hitProbe = (selector) => evaluate(`(() => {
    const el=document.querySelector(${JSON.stringify(selector)});
    if(!el)return {exists:false};
    const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
    const top=document.elementFromPoint(cx,cy),cs=getComputedStyle(el);
    return {exists:true,disabled:!!el.disabled,width:r.width,height:r.height,cx,cy,
      pointerEvents:cs.pointerEvents,display:cs.display,visibility:cs.visibility,
      hitWithin:!!top&&(top===el||el.contains(top)),topId:top?.id||'',topClass:String(top?.className||'')};
  })()`);
  const physicalClick = async (selector) => {
    let p = null;
    for (let i = 0; i < 120; i++) {
      p = await hitProbe(selector);
      if (p?.exists && !p.disabled && p.hitWithin && p.pointerEvents !== 'none' && p.width > 1 && p.height > 1) break;
      await sleep(80);
    }
    if (!p?.exists || p.disabled || !p.hitWithin || p.pointerEvents === 'none') {
      throw new Error('pointer target unavailable: ' + selector + ' :: ' + JSON.stringify(p));
    }
    await command('Input.dispatchMouseEvent', { type:'mouseMoved', x:p.cx, y:p.cy });
    await command('Input.dispatchMouseEvent', { type:'mousePressed', x:p.cx, y:p.cy, button:'left', clickCount:1 });
    await command('Input.dispatchMouseEvent', { type:'mouseReleased', x:p.cx, y:p.cy, button:'left', clickCount:1 });
    return p;
  };
  const poll = async (expression, predicate = Boolean, { attempts = 1800, interval = 80 } = {}) => {
    let value = null;
    for (let i = 0; i < attempts; i++) {
      value = await evaluate(expression);
      if (predicate(value)) return value;
      await sleep(interval);
    }
    throw new Error('poll timeout: ' + expression.slice(0, 180) + ' :: last=' + JSON.stringify(value));
  };
  return { socket, command, evaluate, physicalClick, poll };
}

function summarize(profile) {
  const p = profile || {};
  const phases = p.phases || {};
  const at = (name) => Number(phases[name]?.at) || 0;
  return {
    ...p,
    derived: {
      preprocessMs: at('preprocess-start') && at('preprocess-ready')
        ? at('preprocess-ready') - at('preprocess-start') : null,
      runtimeToFirstFrameMs: p.runtimeReadyAt && p.firstCompleteFrameAt
        ? p.firstCompleteFrameAt - p.runtimeReadyAt : null,
      preprocessToFirstFrameMs: p.preprocessReadyAt && p.firstCompleteFrameAt
        ? p.firstCompleteFrameAt - p.preprocessReadyAt : null,
    },
  };
}

async function runHero(hero, index) {
  const port = 9320 + index;
  const endpoint = 'http://127.0.0.1:' + port;
  const profileDir = path.join('/tmp', `apex-core-six-cold-${hero}-${process.pid}`);
  await rm(profileDir, { recursive:true, force:true });
  let chrome = null;
  let cdp = null;
  try {
    chrome = spawn(chromePath, [
      '--headless=new','--disable-gpu','--disable-dev-shm-usage','--no-sandbox',
      '--no-first-run','--no-default-browser-check','--autoplay-policy=no-user-gesture-required',
      '--remote-debugging-port=' + port,'--window-size=1600,900',
      '--user-data-dir=' + profileDir, appUrl,
    ], { stdio:'ignore', detached:false });

    cdp = await connect(endpoint);
    await cdp.command('Runtime.enable');
    await cdp.command('Page.enable');
    await cdp.command('Page.addScriptToEvaluateOnNewDocument', { source:`
      window.__APEX_COLD_ERRORS=[];
      addEventListener('error',e=>window.__APEX_COLD_ERRORS.push(String(e.message||e.error||'error')));
      addEventListener('unhandledrejection',e=>window.__APEX_COLD_ERRORS.push('rejection:'+String(e.reason||'')));
    `});
    await cdp.command('Page.navigate', { url:appUrl });

    await cdp.poll(`(() => ({
      engine:!!window.__apexEngineReady,
      stage:!!document.getElementById('stage'),
      state:document.body?.dataset?.apexSceneTransition||'',
      blackout:document.getElementById('apex-boot-blackout')?.hidden===true,
      telemetry:!!window.apexHeroLoadTelemetry
    }))()`, (v) => v?.engine && v.stage && v.state === 'DONE' && v.blackout && v.telemetry,
    { attempts:2400, interval:75 });

    await cdp.physicalClick('#freeBattle');
    await cdp.poll(`document.getElementById('stage')?.classList.contains('screen-mode')||false`,
      Boolean, { attempts:1200, interval:75 });

    await cdp.physicalClick('.modeCard[data-mode="bot"]');
    await cdp.poll(`(() => ({
      fighter:document.getElementById('stage')?.classList.contains('screen-fighter')||false,
      roster:document.querySelectorAll('#fighterRoster .rosterCard').length
    }))()`, (v) => v?.fighter && v.roster >= 6, { attempts:1600, interval:75 });

    await cdp.physicalClick(`.rosterCard[data-hero="${hero}"]`);
    await cdp.poll(`document.querySelector('.rosterCard[data-hero="${hero}"]')?.classList.contains('p1-selected')||false`,
      Boolean, { attempts:400, interval:50 });

    await cdp.physicalClick('#lockIn');
    await cdp.poll(`document.getElementById('stage')?.classList.contains('fighter-active-p2')||false`,
      Boolean, { attempts:400, interval:50 });

    await cdp.physicalClick('.rosterCard[data-hero="newbot"]');
    await cdp.poll(`document.querySelector('.rosterCard[data-hero="newbot"]')?.classList.contains('p2-selected')||false`,
      Boolean, { attempts:400, interval:50 });

    await cdp.physicalClick('#lockIn');
    const sample = await cdp.poll(`(() => {
      const p=window.apexHeroLoadTelemetry?.profile?.(${JSON.stringify(hero)})||null;
      return {
        live:!!window.APEX_ARSENAL?.state?.active,
        hud:!!window.APEX_GOLD_HUD,
        profile:p,
        errors:(window.__APEX_COLD_ERRORS||[]).slice()
      };
    })()`, (v) => v?.live && v?.hud && !!v.profile?.firstCompleteFrameAt,
    { attempts:3000, interval:80 });

    if (sample.errors.length) {
      throw new Error('window errors: ' + JSON.stringify(sample.errors));
    }
    return summarize(sample.profile);
  } finally {
    try { cdp?.socket?.close(); } catch {}
    if (chrome) {
      try { chrome.kill('SIGTERM'); } catch {}
      await sleep(250);
      if (chrome.exitCode == null) {
        try { chrome.kill('SIGKILL'); } catch {}
      }
    }
    await rm(profileDir, { recursive:true, force:true });
  }
}

const report = {
  checkpoint:'R59-E3b',
  sha:process.env.GITHUB_SHA || null,
  appUrl,
  definition:'fresh Chrome user-data-dir per hero; real BOT pick/lock flow; sample after first-complete-frame',
  heroes:{},
  failures:[],
};

await mkdir(evidenceDir, { recursive:true });
for (let i = 0; i < heroes.length; i++) {
  const hero = heroes[i];
  const started = Date.now();
  try {
    const profile = await runHero(hero, i);
    report.heroes[hero] = { ok:true, wallMs:Date.now()-started, profile };
    console.log('[CORE-SIX-COLD] PASS', hero, JSON.stringify(profile));
  } catch (error) {
    report.heroes[hero] = { ok:false, wallMs:Date.now()-started, error:String(error?.stack||error) };
    report.failures.push(hero);
    console.error('[CORE-SIX-COLD] FAIL', hero, error);
  }
}
report.finishedAt = new Date().toISOString();
const out = path.join(evidenceDir, 'core-six-cold-load-profile.json');
await writeFile(out, JSON.stringify(report, null, 2));
console.log('[CORE-SIX-COLD] report', out);
if (report.failures.length) process.exit(1);
