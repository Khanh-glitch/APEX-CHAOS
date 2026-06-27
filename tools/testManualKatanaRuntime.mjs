import { spawn } from 'node:child_process';

const endpoint = process.env.APEX_CDP_ENDPOINT || 'http://127.0.0.1:9230';
const appUrl = process.env.APEX_APP_URL || 'http://127.0.0.1:5173';
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let chrome = null;

if (!process.env.APEX_CDP_ENDPOINT) {
  chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=9230',
    '--user-data-dir=' + process.cwd() + '\\.manual-katana-chrome-profile', appUrl,
  ], { stdio:'ignore', detached:false });
}

async function pageTarget() {
  for (let i=0; i<100; i++) {
    try {
      const targets = await fetch(`${endpoint}/json/list`).then(r => r.json());
      const target = targets.find(x => x.type === 'page' && x.url.includes('127.0.0.1:5173'));
      if (target) return target;
    } catch {}
    await sleep(200);
  }
  throw new Error('MANUAL KATANA CDP page did not become ready.');
}

const target = await pageTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject) => {
  socket.addEventListener('open',resolve,{once:true});
  socket.addEventListener('error',reject,{once:true});
});
let serial=0;
const pending=new Map();
socket.addEventListener('message', event => {
  const message=JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const promise=pending.get(message.id);
  pending.delete(message.id);
  message.error ? promise.reject(new Error(message.error.message)) : promise.resolve(message.result);
});
function command(method,params={}) {
  const id=++serial;
  socket.send(JSON.stringify({id,method,params}));
  return new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));
}
async function evaluate(expression) {
  const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

try {
  await command('Runtime.enable');
  await command('Page.enable');
  await command('Page.navigate',{url:appUrl});
  for (let i=0;i<120;i++) {
    if (await evaluate('Boolean(window.APEX_MANUAL_LAB_READY && window.APEX_KATANA?.manualApi)')) break;
    if (i===119) throw new Error('MANUAL KATANA runtime was not exposed.');
    await sleep(200);
  }
  const report = await evaluate(`(()=> {
    const M=window.APEX_MANUAL_LAB, I=window.APEX_MANUAL_INPUT, K=window.APEX_KATANA, E=window.APEX_ENGINEER;
    const type=name=>window.apexFighterTypes.find(ft=>ft.name===name);
    const KATANA=type('KATANA'), ICE=type('ICE'), ENGINEER=type('ENGINEER');
    const stop=()=>{ cancelAnimationFrame(window.reqId); window.reqId=0; };
    const step=(count,dt=1/60)=>{ for(let i=0;i<count;i++) window.update(dt); };
    const start=(left=KATANA,right=ICE,manual=true)=>{ window.startSpecificMatch(left,right,{countdown:false,tournament:false,trial:true,manualLab:manual}); stop(); I.clear(); I.active=true; return window.fighters; };
    const freezeEnemy=()=>{ const e=window.fighters[1]; e.baseSpeed=0; e.statuses={abilityDisabled:{timer:999,max:999},stun:{timer:999,max:999}}; return e; };
    const arm=()=>{ const f=window.fighters[0], e=freezeEnemy(); f.statuses={}; f.hp=f.maxHp; e.hp=e.maxHp; return {f,e,d:f.data.katana}; };
    const press=a=>I.pressed.add(a);
    const hold=a=>I.held.add(a);
    const release=a=>I.held.delete(a);
    const aim=(x,y)=>{ I.pointerInside=true; I.aimPoint={x,y}; };
    const mature=clone=>{ clone.createdAt=-999; return clone; };
    const clone=(f,x,y)=>mature(K.manualApi.createCloneForTest(f,x,y,{x:1,y:0}));
    const hud=f=>K.manualApi.hudState(f);
    const out={};

    start(); let ctx=arm(), f=ctx.f, e=ctx.e;
    step(2);
    out.idle={frame:K.frameIndex(f),mode:hud(f)?.mode,manual:!!f.data.manualController,enemyManual:!!e.data.manualController};

    f.x=300; f.y=500; e.x=850; e.y=500; aim(900,500); press('PRIMARY');
    step(1);
    const firstFrame={frame:K.frameIndex(f),mode:hud(f)?.mode,waves:K.manualApi ? K.state?.waves?.length ?? 0 : 0};
    step(39);
    out.lmbWave={firstFrame,frame:K.frameIndex(f),mode:hud(f)?.mode,waves:K.state.waves.length,action:ctx.d.action?.type||null};

    start(); ctx=arm(); f=ctx.f; e=ctx.e; f.x=300; f.y=500; e.x=850; e.y=500; aim(900,500); press('PRIMARY');
    step(39); f.x=300; f.y=500; e.x=342; e.y=500; step(1);
    out.lmbOne={action:ctx.d.action?.type||null,clones:ctx.d.clones.length,waves:K.state.waves.length,mode:hud(f)?.mode};

    start(); ctx=arm(); f=ctx.f; e=ctx.e; f.x=220; f.y=500; e.x=850; e.y=500; const twinClone=clone(f,820,500); aim(900,500); press('PRIMARY');
    step(39); f.x=220; f.y=500; e.x=500; e.y=500; twinClone.x=820; twinClone.y=500; step(1);
    out.lmbTwin={action:ctx.d.action?.type||null,consumed:ctx.d.clones.filter(c=>c.consumed).length,waves:K.state.waves.length,mode:hud(f)?.mode};

    start(); ctx=arm(); f=ctx.f; e=ctx.e; f.x=300; f.y=500; e.x=850; e.y=500; aim(900,500); hold('SECONDARY');
    step(44);
    const prepared={mode:hud(f)?.mode,frame:K.frameIndex(f),clones:ctx.d.clones.length};
    release('SECONDARY'); step(1);
    out.rmbCancel={prepared,after:{mode:hud(f)?.mode,frame:K.frameIndex(f),clones:ctx.d.clones.length,action:ctx.d.action?.type||null}};

    start(); ctx=arm(); f=ctx.f; e=ctx.e; f.x=300; f.y=500; e.x=338; e.y=500; aim(900,500); hold('SECONDARY');
    step(44);
    step(1);
    out.rmbCollision={action:ctx.d.action?.type||null,clones:ctx.d.clones.length,mode:hud(f)?.mode};

    start(); ctx=arm(); f=ctx.f; e=ctx.e; f.x=300; f.y=500; e.x=900; e.y=500; aim(600,500); press('ABILITY_1');
    const hpBefore=e.hp; step(12);
    out.qDash={x:+f.x.toFixed(2),distance:+(f.x-300).toFixed(2),cooldown:+hud(f).qCooldown.toFixed(2),clones:ctx.d.clones.length,damage:+(hpBefore-e.hp).toFixed(6),immune:!!f.statuses?.immune};

    start(KATANA,ENGINEER,true); ctx=arm(); f=ctx.f; e=ctx.e; f.x=300; f.y=500; e.x=700; e.y=500;
    const ed=E.ownerData(e); ed.structures.push({id:9001,kind:'turret',owner:e,x:450,y:500,radius:40,blockRadius:48,hp:100,maxHp:100,state:'online',dead:false});
    aim(600,500); press('ABILITY_1'); step(12);
    out.qBlocker={x:+f.x.toFixed(2),blocked:f.x<410,structures:ed.structures.length};

    start(); ctx=arm(); f=ctx.f; e=ctx.e; f.x=220; f.y=500; e.x=850; e.y=500; const refreshClone=clone(f,820,500); aim(230,500); press('ABILITY_1'); step(8);
    aim(900,500); press('PRIMARY'); step(39); f.x=220; f.y=500; e.x=500; e.y=500; refreshClone.x=820; refreshClone.y=500; step(1);
    out.qRefresh={action:ctx.d.action?.type||null,qCooldown:+hud(f).qCooldown.toFixed(2),window:+hud(f).qWindow.toFixed(2)};

    start(); ctx=arm(); f=ctx.f; e=ctx.e; f.x=300; f.y=500; e.x=900; e.y=500;
    const evades=[clone(f,420,500),clone(f,520,500),clone(f,620,500),clone(f,720,500)];
    aim(evades[2].x,evades[2].y); press('ABILITY_2'); step(1);
    out.evade={x:+f.x.toFixed(2),y:+f.y.toFixed(2),consumed:evades[2].consumed,consumedCount:ctx.d.clones.filter(c=>c.consumed).length,frame:K.frameIndex(f),mode:hud(f)?.mode};

    start(); ctx=arm(); f=ctx.f; e=ctx.e; f.x=300; f.y=500; e.x=930; e.y=930;
    const r0=clone(f,420,500), r1=clone(f,620,420), r2=clone(f,620,580);
    K.manualApi.updateCentroid(f);
    const beforeIds=ctx.d.centroid.ids, beforeCount=ctx.d.clones.filter(c=>!c.consumed).length;
    aim(r0.x,r0.y); press('APEX'); step(1);
    const during={rewrite:+hud(f).rewriteRemaining.toFixed(2),rCooldown:+hud(f).rCooldown.toFixed(2),ids:ctx.d.centroid?.ids,count:ctx.d.clones.filter(c=>!c.consumed).length,source:{x:r0.x,y:r0.y}};
    step(36);
    const afterCentroid=K.manualApi.updateCentroid(f);
    out.rewrite={beforeIds,beforeCount,during,after:{rewrite:+hud(f).rewriteRemaining.toFixed(2),count:ctx.d.clones.filter(c=>!c.consumed).length,source:{x:+r0.x.toFixed(2),y:+r0.y.toFixed(2)},ids:afterCentroid?.ids,rCooldown:+hud(f).rCooldown.toFixed(2)}};

    start(KATANA,ICE,false); stop(); step(120);
    out.autobattleKatana={manual:!!window.fighters[0].data.manualController,manualState:!!window.fighters[0].data.katana?.manual,enemyManual:!!window.fighters[1].data.manualController};
    start(ICE,ENGINEER,true); stop(); step(5);
    out.unsupportedFallback={local:window.fighters[0].name,manual:!!window.fighters[0].data.manualController,hudHidden:document.getElementById('manual-lab-hud')?.classList.contains('hidden')===true};
    out.earlyErrors=(window.apexEarlyErrors||[]).slice();
    return out;
  })()`);

  const assertions = {
    idle:report.idle.manual && !report.idle.enemyManual && report.idle.frame===1 && report.idle.mode==='idle',
    lmbWave:report.lmbWave.firstFrame.frame===1 && report.lmbWave.waves===1 && report.lmbWave.action===null,
    lmbOne:report.lmbOne.action==='one' && report.lmbOne.clones===1 && report.lmbOne.waves===0,
    lmbTwin:report.lmbTwin.action==='twin' && report.lmbTwin.consumed===1,
    rmbCancel:report.rmbCancel.prepared.mode==='rmbHold' && report.rmbCancel.prepared.frame===16 && report.rmbCancel.after.mode==='idle' && report.rmbCancel.after.frame===1 && report.rmbCancel.after.clones===0,
    rmbCollision:report.rmbCollision.clones===1 && report.rmbCollision.mode==='recovery',
    qDash:Math.abs(report.qDash.distance-300)<1 && report.qDash.cooldown>4.7 && report.qDash.clones===0 && report.qDash.damage===0 && !report.qDash.immune,
    qBlocker:report.qBlocker.structures>=1 && report.qBlocker.blocked,
    qRefresh:report.qRefresh.action==='twin' && report.qRefresh.qCooldown===0,
    evade:report.evade.consumed && report.evade.consumedCount===1 && report.evade.frame===1 && report.evade.mode==='idle',
    rewrite:report.rewrite.beforeCount===3 && report.rewrite.during.count===3 && report.rewrite.during.rewrite>0.55 && report.rewrite.after.count===3 && report.rewrite.after.rewrite===0 && report.rewrite.after.source.x===300 && report.rewrite.after.source.y===500 && report.rewrite.after.ids===report.rewrite.beforeIds,
    autobattleKatana:!report.autobattleKatana.manual && !report.autobattleKatana.manualState && !report.autobattleKatana.enemyManual,
    unsupportedFallback:report.unsupportedFallback.local==='ICE' && !report.unsupportedFallback.manual && report.unsupportedFallback.hudHidden,
    noEarlyErrors:report.earlyErrors.length===0,
  };
  const output={report,assertions,ok:Object.values(assertions).every(Boolean)};
  console.log(JSON.stringify(output,null,2));
  if(!output.ok) process.exitCode=1;
} finally {
  try{socket.close();}catch{}
  if(chrome){chrome.kill();await sleep(250);}
}
