// CRYSTALA production-browser performance profiler.
// QA-only: instruments live runtime functions in Chromium; never mutates source gameplay/VFX.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:4173';
const CHROME = process.env.CHROME_PATH;
if (!CHROME) throw new Error('CHROME_PATH is required');

const OUT = path.resolve('docs/hero-rework/crystala-v1/perf');
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--headless=new','--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--window-size=1440,1080'],
  headless: true,
  defaultViewport: { width: 1440, height: 1080 },
});

const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => {
  if (m.type() === 'error' && !m.text().includes('net::ERR_')) errors.push('[console] '+m.text());
});

await page.goto(APP, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => typeof window.__apexEnsureDeferredRuntimes === 'function', { timeout: 30000 });
await page.evaluate(async () => { await window.__apexEnsureDeferredRuntimes('arsenalQuest'); });

const result = await page.evaluate(async () => {
  const G = window;
  if (typeof reqId !== 'undefined' && reqId) { cancelAnimationFrame(reqId); reqId = 0; }

  const perf = {
    current: null,
    disableBloom: false,
    disableChamber: false,
    rows: [],
  };
  const add = (name, ms) => {
    if (!perf.current) return;
    perf.current[name] = (perf.current[name] || 0) + ms;
  };
  const timed = (name, fn, self, args) => {
    const t0 = performance.now();
    try { return fn.apply(self, args); }
    finally { add(name, performance.now() - t0); }
  };
  const wrap = (obj, key, nameFn) => {
    if (!obj || typeof obj[key] !== 'function') return null;
    const orig = obj[key];
    if (orig.__crystalaPerfWrapped) return orig.__crystalaPerfOriginal || orig;
    const w = function(...args) {
      const name = typeof nameFn === 'function' ? nameFn(args) : nameFn;
      return timed(name, orig, this, args);
    };
    w.__crystalaPerfWrapped = true;
    w.__crystalaPerfOriginal = orig;
    obj[key] = w;
    return orig;
  };

  const GOLD = G.APEX_CRYSTALA_GOLD;
  const CRY = G.APEX_CRYSTAL;
  const CH = G.APEX_CHAMBER_PALETTE;
  if (!GOLD || !CRY) throw new Error('CRYSTALA runtimes not ready');

  wrap(CRY, 'tick', 'crystal.tick');
  wrap(GOLD, 'drawCrystala', a => a[2] ? 'gold.body.emissive' : 'gold.body.normal');
  wrap(GOLD, 'drawStone', a => a[3] ? 'gold.stone.emissive' : 'gold.stone.normal');
  wrap(GOLD, 'drawTrail', 'gold.trail');
  wrap(GOLD, 'drawWall', a => a[2] ? 'gold.wall.emissive' : 'gold.wall.normal');
  wrap(GOLD, 'drawPrison', a => a[2] ? 'gold.prison.emissive' : 'gold.prison.normal');
  wrap(GOLD, 'drawDust', 'gold.dust.draw');
  wrap(GOLD, 'drawDebris', 'gold.debris.draw');

  // Instrument bloom at creation time. getBloom is lazy, so this catches the real cached production bloom.
  const origCreateBloom = GOLD.createBloomSystem;
  GOLD.createBloomSystem = function(...args) {
    const b = origCreateBloom.apply(this, args);
    const ob = b.begin.bind(b), oc = b.composite.bind(b);
    b.begin = function(...a) {
      if (perf.disableBloom) return null;
      return timed('bloom.begin', ob, b, a);
    };
    b.composite = function(...a) {
      if (perf.disableBloom) return;
      return timed('bloom.composite', oc, b, a);
    };
    return b;
  };

  if (CH && typeof CH.actorRender === 'function') wrap(CH, 'actorRender', a => a[5] === 'weapon' ? 'chamber.weaponActorRender' : 'chamber.actorRender');
  if (CH && typeof CH.isActive === 'function') {
    const oi = CH.isActive.bind(CH);
    CH.isActive = () => perf.disableChamber ? false : oi();
  }

  function stopRaf() {
    if (typeof reqId !== 'undefined' && reqId) { cancelAnimationFrame(reqId); reqId = 0; }
  }
  function newMatch(a='CRYSTAL', b='ROBOT') {
    if (G.APEX_ARSENAL?.state?.active) G.exitArsenalQuestMode();
    G.startArsenalQuestMode(a,b);
    stopRaf();
    if (G.APEX_ARSENAL?.state) G.APEX_ARSENAL.state.labMode = true;
    if (G.APEX_HERO_REWORK?.setAiEnabled) G.APEX_HERO_REWORK.setAiEnabled(false);
    const f0=G.fighters[0], f1=G.fighters[1];
    f0.baseSpeed=0; f1.baseSpeed=0;
    f0.x=180; f0.y=500; f0.setDir(1,0);
    f1.x=820; f1.y=500; f1.setDir(-1,0);
    for(let i=0;i<3;i++){ G.APEX_ARSENAL.step(1/60); G.draw(); }
    if (a === 'CRYSTAL') {
      const ct=G.APEX_HERO_REWORK.byCombatant(f0), st=G.APEX_CRYSTAL.stateOf(ct);
      if (st && st.rig && !st.rig.advance.__crystalaPerfWrapped) wrap(st.rig,'advance','gold.rig.advance');
    }
    return {f0,f1,ct:a==='CRYSTAL'?G.APEX_HERO_REWORK.byCombatant(f0):null};
  }
  function stats(values) {
    if (!values.length) return {n:0,p50:0,p95:0,p99:0,max:0,mean:0};
    const a=values.slice().sort((x,y)=>x-y), q=p=>a[Math.min(a.length-1,Math.floor((a.length-1)*p))];
    return {n:a.length,p50:q(.5),p95:q(.95),p99:q(.99),max:a[a.length-1],mean:a.reduce((s,x)=>s+x,0)/a.length};
  }
  function summarize(frames) {
    const keys=new Set(['step.total','draw.total','frame.total']);
    for(const f of frames) for(const k of Object.keys(f)) keys.add(k);
    const out={};
    for(const k of keys) out[k]=stats(frames.map(f=>f[k]||0));
    return out;
  }
  function runFrames(label, count=180, warm=30) {
    const rows=[];
    for(let i=0;i<warm+count;i++){
      const row={}; perf.current=row;
      const t0=performance.now();
      const s0=performance.now(); G.APEX_ARSENAL.step(1/60); row['step.total']=performance.now()-s0;
      const d0=performance.now(); G.draw(); row['draw.total']=performance.now()-d0;
      row['frame.total']=performance.now()-t0;
      perf.current=null;
      if(i>=warm) rows.push(row);
    }
    const summary=summarize(rows);
    perf.rows.push({label,summary});
    return summary;
  }

  function stepDraw(n=1) { for(let i=0;i<n;i++){ G.APEX_ARSENAL.step(1/60); G.draw(); } }
  function fireAtCrystal(mm, id='PISTOL') {
    const cfg=G.APEX_ARSENAL_CONFIG, spec=cfg.WEAPONS[id] || {};
    const speed=spec.bulletSpeed || ({PISTOL:2600,SMG:3100,SNIPER:5800}[id]||2600);
    const damage=spec.damagePerShot || spec.damage || spec.damagePerPellet || 4.5;
    G.APEX_ARSENAL.weaponApi.fireBullet({
      owner:mm.f1,x:mm.f1.x,y:mm.f1.y,angle:Math.atan2(mm.f0.y-mm.f1.y,mm.f0.x-mm.f1.x),
      speed,damage,radius:spec.bulletRadius||7,life:spec.bulletLife||1,weapon:id,color:'#fff'
    });
  }
  function buildRealWall(mm) {
    G.APEX_HERO_REWORK.pressAbility(mm.f0,'A2');
    mm.f1.x=430; mm.f1.y=500;
    fireAtCrystal(mm,'PISTOL');
    for(let i=0;i<12;i++){
      stepDraw(1);
      if ((G.APEX_CRYSTAL.inspect(mm.ct)?.available ?? 6) < 6) break;
    }
    const cast=G.APEX_HERO_REWORK.pressAbility(mm.f0,'A1');
    if(!cast.ok) throw new Error('performance wall setup failed');
    return cast;
  }

  // Real production profiles.
  perf.disableBloom=false; perf.disableChamber=false;
  newMatch('ROBOT','HUNTER');
  runFrames('baseline-robot-hunter',180,30);

  let m=newMatch('CRYSTAL','ROBOT');
  runFrames('crystal-dormant-full',180,30);

  m=newMatch('CRYSTAL','ROBOT');
  G.APEX_HERO_REWORK.pressAbility(m.f0,'A2');
  for(let i=0;i<10;i++){G.APEX_ARSENAL.step(1/60);G.draw();}
  runFrames('crystal-k-awake-full',110,10);

  m=newMatch('CRYSTAL','ROBOT');
  G.APEX_HERO_REWORK.pressAbility(m.f0,'A2');
  G.APEX_HERO_REWORK.pressAbility(m.f0,'A1');
  for(let i=0;i<55;i++){G.APEX_ARSENAL.step(1/60);G.draw();}
  runFrames('crystal-prison-full',120,5);

  m=newMatch('CRYSTAL','ROBOT');
  buildRealWall(m);
  stepDraw(50); // through the same Gold build/lock path
  runFrames('crystal-k-wall-full',120,5);

  m=newMatch('CRYSTAL','ROBOT');
  buildRealWall(m);
  // Let J recharge while K is still alive; the first intercepted shard docks
  // independently, then the current live law may permit a second Wall.
  stepDraw(92);
  const second=G.APEX_HERO_REWORK.pressAbility(m.f0,'A1');
  if(second.ok) stepDraw(50);
  runFrames(second.ok ? 'crystal-double-wall-full' : 'crystal-double-wall-unavailable',120,5);

  // Diagnostic A/B only: same production code, runtime layer bypasses; never committed to source behavior.
  perf.disableBloom=true; perf.disableChamber=false;
  m=newMatch('CRYSTAL','ROBOT');
  runFrames('crystal-dormant-bloom-off-diagnostic',180,30);

  perf.disableBloom=false; perf.disableChamber=true;
  m=newMatch('CRYSTAL','ROBOT');
  runFrames('crystal-dormant-chamber-off-diagnostic',180,30);

  perf.disableBloom=true; perf.disableChamber=false;
  m=newMatch('CRYSTAL','ROBOT');
  G.APEX_HERO_REWORK.pressAbility(m.f0,'A2');
  G.APEX_HERO_REWORK.pressAbility(m.f0,'A1');
  for(let i=0;i<55;i++){G.APEX_ARSENAL.step(1/60);G.draw();}
  runFrames('crystal-prison-bloom-off-diagnostic',120,5);

  perf.disableBloom=false; perf.disableChamber=false;

  // K reachability probe using the real Arsenal bullet object and real CRYSTALA predictor.
  const cfg=G.APEX_ARSENAL_CONFIG;
  async function probe(id, dist) {
    const mm=newMatch('CRYSTAL','ROBOT');
    mm.f0.x=150; mm.f0.y=500; mm.f1.x=150+dist; mm.f1.y=500;
    G.APEX_HERO_REWORK.pressAbility(mm.f0,'A2');
    for(let i=0;i<2;i++) G.APEX_ARSENAL.step(1/60);
    const ct=G.APEX_HERO_REWORK.byCombatant(mm.f0), st=G.APEX_CRYSTAL.stateOf(ct);
    const before={r:st.tele.reservations,i:st.tele.intercepts,u:st.tele.ignoredUnreachable,m:st.tele.ignoredMiss};
    const spec=cfg.WEAPONS[id] || {};
    const speed=spec.bulletSpeed || ({PISTOL:2600,SMG:3100,SNIPER:5800}[id]||2600);
    const life=spec.bulletLife || 1;
    const damage=spec.damagePerShot || spec.damage || spec.damagePerPellet || 4.5;
    G.APEX_ARSENAL.weaponApi.fireBullet({
      owner:mm.f1,x:mm.f1.x,y:mm.f1.y,angle:Math.PI,speed,damage,
      radius:spec.bulletRadius||7,life,weapon:id,color:'#fff'
    });
    for(let k=0;k<90;k++) G.APEX_ARSENAL.step(1/60);
    return {
      weapon:id,distance:dist,speed,life,
      reservations:st.tele.reservations-before.r,
      intercepts:st.tele.intercepts-before.i,
      unreachable:st.tele.ignoredUnreachable-before.u,
      miss:st.tele.ignoredMiss-before.m,
    };
  }
  const kProbe=[];
  for (const [id,d] of [['PISTOL',450],['PISTOL',750],['P90',500],['SNIPER',800],['SHOTGUN',430],['JACKHAMMER',420]]) {
    kProbe.push(await probe(id,d));
  }

  return {
    userAgent:navigator.userAgent,
    revision:(document.querySelector('script[src*="crystalaPresentationRuntime.js"]')?.src||''),
    profiles:perf.rows,
    kProbe,
  };
});

result.pageErrors = errors;
result.generatedAt = new Date().toISOString();
const outPath = path.join(OUT,'crystala-performance-profile.json');
fs.writeFileSync(outPath, JSON.stringify(result,null,2)+'\n');

console.log('=== CRYSTALA PERF PROFILE ===');
for (const p of result.profiles) {
  const f=p.summary['frame.total'], d=p.summary['draw.total'], s=p.summary['step.total'];
  const bloom=p.summary['bloom.composite']||{}, bloomBegin=p.summary['bloom.begin']||{};
  const rig=p.summary['gold.rig.advance']||{};
  const chamber=p.summary['chamber.actorRender']||{};
  const body=p.summary['gold.body.normal']||{}, stone=p.summary['gold.stone.normal']||{};
  const wall=p.summary['gold.wall.normal']||{}, wallE=p.summary['gold.wall.emissive']||{};
  const prison=p.summary['gold.prison.normal']||{}, prisonE=p.summary['gold.prison.emissive']||{};
  console.log(JSON.stringify({
    label:p.label,
    frame:{p50:f?.p50,p95:f?.p95,max:f?.max},
    draw:{p50:d?.p50,p95:d?.p95},
    step:{p50:s?.p50,p95:s?.p95},
    bloomBegin:{p50:bloomBegin.p50||0,p95:bloomBegin.p95||0},
    bloomComposite:{p50:bloom.p50||0,p95:bloom.p95||0},
    bodyNormal:{p50:body.p50||0,p95:body.p95||0},
    stoneNormal:{p50:stone.p50||0,p95:stone.p95||0},
    wallNormal:{p50:wall.p50||0,p95:wall.p95||0},
    wallEmissive:{p50:wallE.p50||0,p95:wallE.p95||0},
    prisonNormal:{p50:prison.p50||0,p95:prison.p95||0},
    prisonEmissive:{p50:prisonE.p50||0,p95:prisonE.p95||0},
    rigAdvance:{p50:rig.p50||0,p95:rig.p95||0},
    chamberActor:{p50:chamber.p50||0,p95:chamber.p95||0},
  }));
}
console.log('K_PROBE '+JSON.stringify(result.kProbe));
console.log('PAGE_ERRORS '+JSON.stringify(errors));

await browser.close();
if (errors.length) process.exitCode = 2;
