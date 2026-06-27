import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const endpoint = 'http://127.0.0.1:9231';
const appUrl = process.env.APEX_APP_URL || 'http://127.0.0.1:5173';
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.resolve('public/assets/fang_v1/review');
const profile = path.resolve('.fang-capture-profile');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

await rm(profile, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required',
  '--remote-debugging-port=9231',
  `--user-data-dir=${profile}`,
  appUrl
], { stdio: 'ignore', detached: false });

async function pageTarget() {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await fetch(`${endpoint}/json/list`).then(r => r.json());
      const target = list.find(x => x.type === 'page');
      if (target) return target;
    } catch {}
    await sleep(180);
  }
  throw new Error('Chrome CDP page did not become ready.');
}

const target = await pageTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let serial = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const p = pending.get(message.id);
  pending.delete(message.id);
  message.error ? p.reject(new Error(message.error.message)) : p.resolve(message.result);
});

function command(method, params = {}) {
  const id = ++serial;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function capture(name) {
  await evaluate('draw();');
  await sleep(160);
  const shot = await command('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const file = path.join(outDir, name);
  await writeFile(file, Buffer.from(shot.data, 'base64'));
  return file;
}

try {
  await command('Runtime.enable');
  await command('Page.enable');
  await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await command('Page.navigate', { url: appUrl });
  await sleep(1200);
  for (let i = 0; i < 120; i++) {
    if (await evaluate('Boolean(window.APEX_FANG&&window.apexFighterTypes&&window.startSpecificMatch)')) break;
    await sleep(120);
    if (i === 119) throw new Error('FANG runtime did not load.');
  }
  for (let i = 0; i < 240; i++) {
    const ready = await evaluate(`(() => {
      const canvas = document.querySelector('canvas');
      const loading = [...document.querySelectorAll('*')].some(el => el !== document.body && el !== document.documentElement && /(starting engine|synchronizing vfx|loading)/i.test(el.textContent || '') && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden');
      return Boolean(canvas && canvas.width && canvas.height && !loading);
    })()`);
    if (ready) break;
    await sleep(250);
  }
  await evaluate(`Promise.all([...Object.values(APEX_FANG.clips).flat(), ...Object.values(APEX_FANG.images)].map(img => img.decode ? img.decode().then(()=>true).catch(()=>false) : true))`);

  await evaluate(`(() => {
    const F = apexFighterTypes.find(x => x.name === 'FANG');
    const G = apexFighterTypes.find(x => x.name === 'GALAXY') || apexFighterTypes.find(x => x.name !== 'FANG');
    startSpecificMatch(F, G, { countdown:false, trial:true });
    cancelAnimationFrame(reqId); reqId = 0;
    const [f,e] = fighters, d = APEX_FANG.fangData(f);
    e.baseSpeed = 0; e.statuses.abilityDisabled = { timer:99 };
    f.x = 275; f.y = 540; e.x = 735; e.y = 475;
    f.setDir(1,-.12); d.visualDir = {x:.993, y:-.119};
    d.state='HUNT_LOOP'; d.clip='hunt'; d.frame=13; d.frameElapsed=0; d.huntActive=true; d.blood=true;
    d.trail = [];
    for(let i=0;i<70;i++){
      const t=i/69;
      d.trail.push({x:430 + t*360, y:555 - Math.sin(t*Math.PI)*120 - t*54, t:matchClock-t*.05});
    }
    draw();
    return true;
  })()`);
  const hunt = await capture('fang-hunt-zone-blood-ribbon.png');

  await evaluate(`(() => {
    const F = apexFighterTypes.find(x => x.name === 'FANG');
    const G = apexFighterTypes.find(x => x.name === 'GALAXY') || apexFighterTypes.find(x => x.name !== 'FANG');
    startSpecificMatch(F, G, { countdown:false, trial:true });
    cancelAnimationFrame(reqId); reqId = 0;
    const [f,e] = fighters, d = APEX_FANG.fangData(f);
    e.baseSpeed = 0; e.statuses.abilityDisabled = { timer:99 };
    f.x = 250; f.y = 360; e.x = 760; e.y = 520;
    f.setDir(1,0); d.visualDir={x:1,y:0}; d.huntActive=false; d.blood=true; d.state='BLOOD_CHASE_LOOP'; d.clip='hunt'; d.frame=13;
    d.trail=[]; const now=matchClock;
    for(let i=0;i<72;i++){const t=i/71;d.trail.push({x:405+t*390,y:540-Math.sin(t*Math.PI*1.35)*165,t:now-(1-t)*1.8});}
    draw(); return true;
  })()`);
  const trail = await capture('fang-opponent-trail-mist.png');

  await evaluate(`(() => {
    const F = apexFighterTypes.find(x => x.name === 'FANG');
    const S = apexFighterTypes.find(x => x.name === 'STRING') || apexFighterTypes.find(x => x.name !== 'FANG');
    startSpecificMatch(F, S, { countdown:false, trial:true });
    cancelAnimationFrame(reqId); reqId = 0;
    const [f,e] = fighters, d = APEX_FANG.fangData(f);
    e.baseSpeed = 0; e.statuses.abilityDisabled = { timer:99 };
    f.x = 230; f.y = 515; e.x = 665; e.y = 515;
    f.setDir(1,0); d.visualDir={x:1,y:0};
    d.state='HUNT_LOOP'; d.clip='hunt'; d.frame=17; d.frameElapsed=0; d.huntActive=true;
    APEX_FANG.beginPounce(f,e,'hunting',{x:1,y:0});
    for(let i=0;i<7;i++){ matchClock += 1/120; APEX_FANG.FangType.update(f,e,1/120); }
    draw();
    return {frame:d.frame, x:f.x, dir:d.visualDir};
  })()`);
  const pounce = await capture('fang-pounce-direction-scale.png');

  await evaluate(`(() => {
    const F = apexFighterTypes.find(x => x.name === 'FANG');
    const S = apexFighterTypes.find(x => x.name === 'STRING') || apexFighterTypes.find(x => x.name !== 'FANG');
    startSpecificMatch(F, S, { countdown:false, trial:true });
    cancelAnimationFrame(reqId); reqId = 0;
    const [f,e] = fighters, d = APEX_FANG.fangData(f);
    e.baseSpeed = 0; e.statuses.abilityDisabled = { timer:99 }; e.hp=520; e.maxHp=1000;
    f.x = 285; f.y = 515; e.x = 680; e.y = 515;
    f.setDir(1,0); d.visualDir={x:1,y:0};
    d.state='HOWL_48'; d.clip='howl'; d.frame=17; d.howlStopped=false;
    d.stacks=[{expires:999},{expires:999}]; d.stackVisualCount=2; d.silhouette=1; d.pendingHowl=true;
    d.clones=[{id:1,kind:'moon',side:-1,x:220,y:405,hp:200,life:10,reserved:false,dead:false,frame:17},{id:2,kind:'sun',side:1,x:220,y:625,hp:200,life:10,reserved:false,dead:false,frame:17}];
    APEX_FANG.FangType.update(f,e,1/120);
    draw();
    return true;
  })()`);
  const howl = await capture('fang-howl-clones-icons.png');

  console.log(JSON.stringify({ hunt, trail, pounce, howl }, null, 2));
} finally {
  try { socket.close(); } catch {}
  chrome.kill();
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 2500);
    chrome.once('exit', () => { clearTimeout(timer); resolve(); });
  });
  for (let i = 0; i < 8; i++) {
    try {
      await rm(profile, { recursive: true, force: true });
      break;
    } catch {
      await sleep(300);
    }
  }
}
