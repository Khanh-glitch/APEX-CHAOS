import { spawn } from 'node:child_process';

const endpoint = process.env.APEX_CDP_ENDPOINT || 'http://127.0.0.1:9229';
const appUrl = process.env.APEX_APP_URL || 'http://127.0.0.1:5173';
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let chrome = null;

if (!process.env.APEX_CDP_ENDPOINT) {
  chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=9229',
    '--user-data-dir=' + process.cwd() + '\\.manual-lab-chrome-profile', appUrl,
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
  throw new Error('MANUAL LAB CDP page did not become ready.');
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
    if (await evaluate('Boolean(window.APEX_MANUAL_LAB_READY && window.APEX_ENGINEER?.manualApi)')) break;
    if (i===119) throw new Error('MANUAL LAB runtime was not exposed.');
    await sleep(200);
  }
  const report = await evaluate(`(()=>{
    const M=window.APEX_MANUAL_LAB, I=window.APEX_MANUAL_INPUT, E=window.APEX_ENGINEER, api=E.manualApi;
    const type=name=>window.apexFighterTypes.find(ft=>ft.name===name);
    const ENG=type('ENGINEER'), ICE=type('ICE'), KATANA=type('KATANA');
    const stop=()=>{ cancelAnimationFrame(window.reqId); window.reqId=0; };
    const step=(count,dt=1/60)=>{ for(let i=0;i<count;i++) window.update(dt); };
    const quietEnemy=()=>{ const e=window.fighters[1]; e.baseSpeed=0; e.statuses={abilityDisabled:{timer:999,max:999}}; return e; };
    const start=(left,right,manual=false)=>{ window.startSpecificMatch(left,right,{countdown:false,tournament:false,trial:true,manualLab:manual}); stop(); return window.fighters; };
    const out={};

    start(ENG,ICE,false); quietEnemy();
    const autoEngineer=window.fighters[0], autoData=E.ownerData(autoEngineer);
    step(140);
    out.autobattle={manualController:!!autoEngineer.data.manualController,structures:autoData.structures.length,openingPending:autoData.openingPending};

    start(ENG,ICE,true); quietEnemy();
    const f=window.fighters[0], d=E.ownerData(f);
    f.x=300; f.y=500; f.statuses={};
    step(140);
    out.manualIsolation={controller:!!f.data.manualController,opponentController:!!window.fighters[1].data.manualController,structures:d.structures.length,openingPending:d.openingPending};

    d.scrap=20; M.selectedBlueprint=1; I.pointerInside=true; I.aimPoint={x:f.x+80,y:f.y}; I.pressed.add('PRIMARY');
    step(1);
    const mine=d.structures[0];
    const atStart={kind:mine?.kind,state:mine?.state,buildTime:mine?.buildTime,progress:mine?.progress,scrap:d.scrap};
    step(60);
    const mid={state:mine?.state,progress:mine?.progress};
    step(100);
    out.buildLifecycle={atStart,mid,finished:{state:mine?.state,progress:mine?.progress}};

    const beforeRange={scrap:d.scrap,count:d.structures.length};
    I.aimPoint={x:f.x+100.01,y:f.y}; I.pressed.add('PRIMARY'); step(1);
    out.rangeGuard={before:beforeRange,after:{scrap:d.scrap,count:d.structures.length},status:api.placementStatus(f,'mine',f.x+100.01,f.y,100).reason};

    d.scrap=3; M.selectedBlueprint=3; I.aimPoint={x:f.x-80,y:f.y}; I.pressed.add('PRIMARY'); step(1);
    out.scrapGuard={scrap:d.scrap,count:d.structures.length,status:api.placementStatus(f,'factory',f.x-80,f.y,100).reason};

    const moveStart={x:f.x,y:f.y};
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD'}));
    step(30);
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyD'}));
    out.multiKeyMove={start:moveStart,end:{x:f.x,y:f.y},vector:{...I.moveVector}};

    E.scraps.push({x:f.x+40,y:f.y,vx:0,vy:0,amount:1,life:22,maxLife:22});
    I.held.add('SECONDARY'); step(1); const activePulse=d.salvagePulse;
    I.held.delete('SECONDARY'); step(1);
    out.magnet={activePulse,releasedPulse:d.salvagePulse,releasedLock:d.salvageLock};

    d.structures.length=0; d.mergeIds={}; d.scrap=30; f.x=500; f.y=500; f.statuses={};
    const turretPositions=[0,Math.PI*2/3,Math.PI*4/3].map(a=>({x:f.x+Math.cos(a)*96,y:f.y+Math.sin(a)*96}));
    for(const p of turretPositions){ const placed=api.commitBuildAt(f,'turret',p.x,p.y); if(!placed.committed) throw new Error('turret setup failed: '+placed.reason); step(260); }
    const candidate=api.mergeCandidateAt(f,turretPositions[0].x,turretPositions[0].y);
    const requested=api.requestMergeAt(f,turretPositions[0].x,turretPositions[0].y);
    const merging=d.structures.filter(s=>s.state==='merging').map(s=>s.id);
    step(550);
    out.merge3={candidateIds:candidate?.ingredients.map(s=>s.id)||[],requested,mergingIds:merging,heavy:d.structures.filter(s=>s.kind==='heavy_turret'&&s.state==='online').length};
    out.warMachineMissing=api.warMachineStatus(f);

    out.opponents=[];
    for(const opponent of window.apexFighterTypes.filter(ft=>ft.name!=='ENGINEER')){
      start(ENG,opponent,true); quietEnemy(); step(5);
      out.opponents.push({name:opponent.name,localManual:window.fighters[0].data.manualController?.mode==='MANUAL_LAB',enemyManual:!!window.fighters[1].data.manualController,state:window.gameState});
    }
    start(KATANA,ENG,true); step(10);
    out.katanaManual={local:window.fighters[0].name,enemy:window.fighters[1].name,localManual:window.fighters[0].data.manualController?.mode==='MANUAL_LAB',enemyManual:!!window.fighters[1].data.manualController,state:window.gameState,hudHidden:document.getElementById('manual-lab-hud')?.classList.contains('hidden')===true};
    start(ICE,ENG,true); step(10);
    out.aiFallback={local:window.fighters[0].name,enemy:window.fighters[1].name,localManual:!!window.fighters[0].data.manualController,enemyManual:!!window.fighters[1].data.manualController,state:window.gameState,hudHidden:document.getElementById('manual-lab-hud')?.classList.contains('hidden')===true};

    const nativeRandom=Math.random;
    const trace=seed=>{
      let value=seed>>>0;
      Math.random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
      start(ENG,KATANA,false); stop(); step(720);
      return window.fighters.map(q=>({name:q.name,hp:+q.hp.toFixed(6),x:+q.x.toFixed(6),y:+q.y.toFixed(6),damage:+q.damageDone.toFixed(6),structures:(q.data.engineer?.structures||[]).map(s=>({kind:s.kind,state:s.state,x:+s.x.toFixed(4),y:+s.y.toFixed(4),hp:+s.hp.toFixed(4)}))}));
    };
    const traceA=trace(0xA11CE), traceB=trace(0xA11CE); Math.random=nativeRandom;
    out.deterministic={equal:JSON.stringify(traceA)===JSON.stringify(traceB),traceA,traceB};
    out.earlyErrors=(window.apexEarlyErrors||[]).slice();
    return out;
  })()`);
  const windowCount = report.opponents.length;
  const assertions = {
    autobattleUntouched:!report.autobattle.manualController && report.autobattle.structures>0,
    manualIsolation:report.manualIsolation.controller && !report.manualIsolation.opponentController && report.manualIsolation.structures===0 && report.manualIsolation.openingPending===false,
    buildLifecycle:report.buildLifecycle.atStart.kind==='mine' && report.buildLifecycle.atStart.state==='building' && Math.abs(report.buildLifecycle.atStart.buildTime-2.4)<1e-9 && report.buildLifecycle.mid.state==='building' && report.buildLifecycle.finished.state==='online',
    rangeGuard:report.rangeGuard.before.scrap===report.rangeGuard.after.scrap && report.rangeGuard.before.count===report.rangeGuard.after.count && report.rangeGuard.status.startsWith('OUT OF RANGE'),
    scrapGuard:report.scrapGuard.scrap===3 && report.scrapGuard.status==='NEED 2 SCRAP',
    multiKeyMove:report.multiKeyMove.end.x>report.multiKeyMove.start.x && report.multiKeyMove.end.y<report.multiKeyMove.start.y && report.multiKeyMove.vector.x===0 && report.multiKeyMove.vector.y===0,
    magnetRelease:report.magnet.activePulse>0 && report.magnet.releasedPulse===0 && report.magnet.releasedLock===0,
    merge3:report.merge3.candidateIds.length===3 && report.merge3.requested && report.merge3.mergingIds.length===3 && report.merge3.heavy===1,
    opponents:windowCount>0 && report.opponents.every(x=>x.localManual&&!x.enemyManual&&x.state==='PLAYING'),
    katanaManual:report.katanaManual.local==='KATANA' && report.katanaManual.localManual && !report.katanaManual.enemyManual && report.katanaManual.state==='PLAYING' && !report.katanaManual.hudHidden,
    aiFallback:report.aiFallback.local==='ICE' && !report.aiFallback.localManual && !report.aiFallback.enemyManual && report.aiFallback.state==='PLAYING' && report.aiFallback.hudHidden,
    deterministic:report.deterministic.equal,
    noEarlyErrors:report.earlyErrors.length===0,
  };
  const output={report,assertions,ok:Object.values(assertions).every(Boolean)};
  console.log(JSON.stringify(output,null,2));
  if(!output.ok) process.exitCode=1;
} finally {
  try{socket.close();}catch{}
  if(chrome){chrome.kill();await sleep(250);}
}
