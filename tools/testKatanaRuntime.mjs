import { spawn } from 'node:child_process';

const endpoint = process.env.APEX_CDP_ENDPOINT || 'http://127.0.0.1:9224';
const appUrl = process.env.APEX_APP_URL || 'http://127.0.0.1:5173';
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let chrome = null;
if (!process.env.APEX_CDP_ENDPOINT) {
  chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    '--remote-debugging-port=9224',
    '--user-data-dir=' + process.cwd() + '\\.katana-chrome-profile',
    appUrl,
  ], { stdio:'ignore', detached:false });
}

async function pageTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const targets = await fetch(`${endpoint}/json/list`).then(response => response.json());
      const target = targets.find(item => item.type === 'page' && item.url.includes('127.0.0.1:5173'));
      if (target) return target;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome CDP page did not become ready.');
}

const target = await pageTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once:true });
  socket.addEventListener('error', reject, { once:true });
});

let serial = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function command(method, params = {}) {
  const id = ++serial;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {
    expression,
    returnByValue:true,
    awaitPromise:true,
    userGesture:true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

try {
  await command('Runtime.enable');
  await command('Page.enable');
  await command('Page.navigate', { url:appUrl });
  await sleep(1500);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate('Boolean(window.APEX_KATANA && window.apexFighterTypes)')) break;
    await sleep(250);
    if (attempt === 99) throw new Error('KATANA runtime was not exposed.');
  }
  await evaluate(`Promise.all([...window.APEX_KATANA.frameImages, ...Object.values(window.APEX_KATANA.images)].map(img => {
    if (img.complete && img.naturalWidth > 0) return true;
    if (img.decode) return img.decode().catch(() => false);
    return new Promise(resolve => {
      img.addEventListener('load', () => resolve(true), {once:true});
      img.addEventListener('error', () => resolve(false), {once:true});
    });
  }))`);

  const report = {};
  report.selfTest = await evaluate('window.APEX_KATANA.selfTest()');
  report.noSamurai = await evaluate(`(()=>{const stale='S'+'AMURAI';return !JSON.stringify({
    roster:window.apexFighterTypes.map(ft=>ft.name),
    body:document.body.innerText
  }).toUpperCase().includes(stale);})()`);
  report.roster = await evaluate(`(()=>{
    window.goToSelect();
    const card=document.querySelector('#roster-grid [data-fighter="KATANA"]');
    return {
      total:window.apexFighterTypes.filter(ft=>ft.name==='KATANA').length,
      card:!!card,
      bg:card ? getComputedStyle(card).backgroundImage : '',
      color:card ? getComputedStyle(card).color : ''
    };
  })()`);
  report.pickVfx = await evaluate(`(()=>{
    const card=document.querySelector('#roster-grid [data-fighter="KATANA"]');
    card?.click();
    const img=document.getElementById('p1-fighter-vfx');
    return {src:img?.src||'', has:img?.classList.contains('has-fighter'), slot:img?.closest('.picked-fighter-slot')?.dataset.fighter};
  })()`);
  report.modeRosters = await evaluate(`(()=>{
    window.goToSoloSelect();const solo=document.querySelectorAll('#solo-roster .solo-card[data-name="KATANA"]').length;
    window.goToTrialSelect();const trial=document.querySelectorAll('#trial-roster .solo-card[data-name="KATANA"]').length;
    window.startTamChienMode();const tam=document.querySelectorAll('#tam-chien-root [data-champion="KATANA"]').length;
    window.goToMenu();return {solo,trial,tam};
  })()`);
  report.assets = await evaluate(`(()=>({
    frames:window.APEX_KATANA.frameImages.length,
    loadedFrames:window.APEX_KATANA.frameImages.filter(img=>img.complete&&img.naturalWidth>0).length,
    images:Object.fromEntries(Object.entries(window.APEX_KATANA.images).map(([k,img])=>[k,{complete:img.complete,width:img.naturalWidth,height:img.naturalHeight,src:img.src}]))
  }))()`);
  report.audio = await evaluate(`Promise.all(Object.entries(window.APEX_KATANA.audioFiles).map(async([key,src])=>{
    const res=await fetch(src,{cache:'force-cache'});const buf=await res.arrayBuffer();return [key,{ok:res.ok,bytes:buf.byteLength,src}];
  })).then(Object.fromEntries)`);
  report.alpha = await evaluate(`(()=>{
    window.goToSelect();
    const sample=(img,x,y)=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d');g.drawImage(img,0,0);return [...g.getImageData(x,y,1,1).data];};
    const I=window.APEX_KATANA.images,F=window.APEX_KATANA.frameImages;
    return {
      frameCorner:sample(F[0],0,0),
      waveCorner:sample(I.bladeWave,0,0),
      pickedCorner:sample(I.picked,0,0),
      pickBg:I.pickButton?.src||''
    };
  })()`);

  report.visualAndMovementFixes = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    const blade=window.APEX_KATANA.images.bladeWave;
    window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});
    let [k,e]=window.fighters;
    e.statuses.abilityDisabled={timer:99,max:99,source:k};
    k.x=220;k.y=500;e.x=780;e.y=500;k.setDir(0,1);e.setDir(0,-1);
    window.update(1/60);
    const dirAfterFreeMove={x:k.dir.x,y:k.dir.y};
    window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});
    [k,e]=window.fighters;
    e.statuses.abilityDisabled={timer:99,max:99,source:k};
    k.x=500;k.y=500;e.x=500+k.radius+e.radius-4;e.y=500;k.setDir(1,0);e.setDir(-1,0);
    const before=e.hp;
    window.update(1/60);
    const actionAfterContact=k.data.katana.action?.type||null;
    k.data.katana.animTime=16/24-1/60;k.data.katana.lastFrame=16;
    window.update(1/60);
    const actionAtRelease=k.data.katana.action?.type||null;
    for(let i=0;i<35;i++) window.update(1/60);
    const damage=before-e.hp;
    const sticky=window.APEX_KATANA.state.vfx.filter(fx=>fx.sticky&&fx.targetId===e.id);
    const fx=sticky[0]||null;
    const offsetBefore=fx?{x:fx.x-e.x,y:fx.y-e.y}:null;
    if(fx){ e.x+=120; e.y+=45; window.update(1/60); }
    const offsetAfter=fx?{x:fx.x-e.x,y:fx.y-e.y}:null;
    const gameCtx=document.getElementById('game-canvas')?.getContext('2d');
    if(gameCtx && typeof window.__apexTopLayerDraw==='function') window.__apexTopLayerDraw(gameCtx);
    return {
      bodyScale:window.APEX_KATANA.constants.scale,
      effectScale:window.APEX_KATANA.constants.effectScale,
      bodyForwardOffset:window.APEX_KATANA.constants.bodyForwardOffset,
      waveLength:window.APEX_KATANA.constants.waveLength,
      waveSpeed:window.APEX_KATANA.constants.waveSpeed,
      dashDuration:window.APEX_KATANA.constants.dashDuration,
      bladeSize:{w:blade.naturalWidth,h:blade.naturalHeight},
      dirAfterFreeMove,
      actionAfterContact,
      actionAtRelease,
      damage,
      stickyCount:sticky.length,
      topLayerDrawCount:window.APEX_KATANA.state.topLayerDrawCount||0,
      offsetBefore,
      offsetAfter
    };
  })()`);

  report.normalWave = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});
    const [k,e]=window.fighters;
    e.statuses.abilityDisabled={timer:99,max:99,source:k};
    k.baseSpeed=0;e.baseSpeed=0;
    k.x=220;k.y=500;e.x=780;e.y=500;k.setDir(1,0);e.setDir(0,1);
    for(let i=0;i<39;i++)window.update(1/60);
    const before=window.APEX_KATANA.state.waves.length;
    window.update(1/60);
    const d=k.data.katana;
    const w=window.APEX_KATANA.state.waves[0];
    const img=window.APEX_KATANA.images.bladeWave;
    const drawW=w.length, drawH=drawW*(img.naturalHeight/img.naturalWidth), angle=Math.atan2(w.dir.y,w.dir.x)-Math.PI/2;
    const pt=(lx,ly)=>({x:w.x+lx*Math.cos(angle)-ly*Math.sin(angle),y:w.y+lx*Math.sin(angle)+ly*Math.cos(angle),radius:1});
    const visualCenter=window.APEX_KATANA._debugBladeWaveVisualHit(w,pt(0,0));
    const transparentInsideBounds=window.APEX_KATANA._debugBladeWaveVisualHit(w,pt(0,-drawH/2+8));
    return {before,after:window.APEX_KATANA.state.waves.length,frame:window.APEX_KATANA.frameIndex(k),halfWidth:w?.halfWidth,damage:w?.damage,speed:w?.speed,length:w?.length,visualCenter,transparentInsideBounds};
  })()`);

  report.oneSword = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});
    const [k,e]=window.fighters,d=k.data.katana;
    e.statuses.abilityDisabled={timer:99,max:99,source:k};
    k.x=460;k.y=500;e.x=535;e.y=500;k.setDir(1,0);e.setDir(-1,0);
    d.animTime=16/24-1/60;d.lastFrame=16;
    const before=e.hp;
    window.update(1/60);
    let stunnedEarly=!!e.statuses.stun;
    for(let i=0;i<10&&!stunnedEarly;i++){window.update(1/60);stunnedEarly=!!e.statuses.stun;}
    for(let i=0;i<35;i++)window.update(1/60);
    const afterimages=window.APEX_KATANA.state.vfx.filter(fx=>fx.type==='afterimage'&&fx.ownerId===k.id).length;
    return {clones:d.clones.length, consumed:d.clones.filter(c=>c.consumed).length, action:d.action?.type||null, damage:before-e.hp, passed:k.x>e.x, afterimages, stunnedEarly, noCollisionUntil:d.noCollisionUntil||0, now:window.matchClock, labels:k.damageLabels};
  })()`);

  report.oneSwordChain = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});
    const [k,e]=window.fighters,d=k.data.katana;
    e.maxHp=2000;e.hp=2000;e.statuses.abilityDisabled={timer:99,max:99,source:k};
    k.x=460;k.y=500;e.x=535;e.y=500;k.setDir(1,0);e.setDir(-1,0);
    d.animTime=16/24-1/60;d.lastFrame=16;
    const before=e.hp;
    window.update(1/60);
    for(let i=0;i<68;i++)window.update(1/60);
    k.x=460;k.y=500;e.x=535;e.y=500;k.setDir(1,0);e.setDir(-1,0);
    d.animTime=16/24-1/60;d.lastFrame=16;
    window.update(1/60);
    for(let i=0;i<12;i++)window.update(1/60);
    return {damage:before-e.hp, labels:k.damageLabels};
  })()`);

  report.twin = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});
    const [k,e]=window.fighters,d=k.data.katana;
    e.statuses.abilityDisabled={timer:99,max:99,source:k};
    k.x=220;k.y=500;e.x=500;e.y=500;k.setDir(1,0);e.setDir(0,1);
    d.clones=[{id:1,x:820,y:500,dir:{x:-1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false}];d.cloneSerial=1;
    d.animTime=16/24-1/60;d.lastFrame=16;
    const before=e.hp;
    window.update(1/60);
    const lockedAtStart=!!e.data.katanaTwinHeldBy && !!e.statuses.stun;
    const initialPhase=d.action?.phase||null;
    const initialTimeScale=window.timeScale;
    const initialHitStop=window.hitStop;
    const departurePetals=window.APEX_KATANA.state.vfx.filter(fx=>fx.type==='petal').length;
    const waveAtStart=window.APEX_KATANA.state.waves.find(w=>w.id===d.action?.waveId),waveStart=waveAtStart?{x:waveAtStart.x,y:waveAtStart.y}:null;
    window.update(1/120);
    const waveStep=waveAtStart&&waveStart?Math.hypot(waveAtStart.x-waveStart.x,waveAtStart.y-waveStart.y):0;
    for(let i=0;i<100;i++){
      window.update(1/60);
      if(!d.action && d.lastTwinFinishFrame===1) break;
    }
    return {consumed:d.clones[0].consumed, damage:before-e.hp, action:d.action?.type||null, phase:d.action?.phase||null, waves:window.APEX_KATANA.state.waves.length, lockedAtStart, initialPhase, initialTimeScale, initialHitStop, departurePetals, waveStep, waveSpeed:d.lastTwinWaveSpeed,waitDuration:d.lastTwinWaitDuration,travelDuration:d.lastTwinTravelDuration,pulses:d.lastTwinPulseCount||0, impactFrame:d.lastTwinImpactFrame||0, finishFrame:d.lastTwinFinishFrame||0, releasedTarget:!!d.lastTwinReleasedTarget, targetStunned:e.hasStatus('stun'), targetHeld:!!e.data.katanaTwinHeldBy, labels:k.damageLabels};
  })()`);

  report.twinLifesteal = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    const run=extra=>{window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});const [k,e]=window.fighters,d=k.data.katana;k.hp=800;e.maxHp=2000;e.hp=2000;e.baseSpeed=0;e.statuses.abilityDisabled={timer:99};k.x=220;k.y=500;e.x=500;e.y=500;k.setDir(1,0);d.clones=[{id:1,x:820,y:500,dir:{x:-1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false},...extra];d.cloneSerial=d.clones.length;d.animTime=16/24-1/60;d.lastFrame=16;window.update(1/60);for(let i=0;i<150&&d.action;i++)window.update(1/60);return {healed:k.hp-800,healingDone:k.healingDone,remaining:d.clones.filter(c=>!c.consumed).length,damage:k.damageLabels['katana-twin-dash']+(k.damageLabels['katana-twin-wave']||0)};};
    const extras=[{id:2,x:100,y:100,dir:{x:1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false},{id:3,x:100,y:900,dir:{x:1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false},{id:4,x:900,y:100,dir:{x:1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false}];
    return {moonFollow:run([]),centroid:run(extras)};
  })()`);

  report.twinRealtime = await evaluate(`(async()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true,statsRun:true});
    const [k,e]=window.fighters,d=k.data.katana;
    e.statuses.abilityDisabled={timer:99,max:99,source:k};
    k.x=220;k.y=500;e.x=500;e.y=500;k.setDir(1,0);e.setDir(0,1);
    d.clones=[{id:1,x:820,y:500,dir:{x:-1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false}];d.cloneSerial=1;
    d.animTime=16/24-1/60;d.lastFrame=16;
    window.update(1/60);
    const samples=[];
    for(let i=0;i<85;i++){
      const w=window.APEX_KATANA.state.waves.find(q=>q.id===d.action?.waveId);
      samples.push({t:i*20,phase:d.action?.phase||'done',x:k.x,waveX:w?.x??null,frame:window.APEX_KATANA.frameIndex(k),bright:!!w&&(!!w.brightHeld||(w.brightRealUntil||0)>performance.now()),timeScale:window.timeScale});
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    const phases=[...new Set(samples.map(s=>s.phase))];
    return {phases,pulses:d.lastTwinPulseCount||0,impactFrame:d.lastTwinImpactFrame||0,slowUntil:window.APEX_KATANA.state.slowUntil||0,samples};
  })()`);

  report.infinite = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});
    const [k,e]=window.fighters,d=k.data.katana;
    e.maxHp=5000;e.hp=5000;e.statuses.abilityDisabled={timer:99,max:99,source:k};
    k.x=160;k.y=500;k.hp=500;k.setDir(1,0);e.x=540;e.y=500;
    d.clones=[
      {id:1,x:440,y:430,dir:{x:1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false},
      {id:2,x:560,y:430,dir:{x:0,y:1},frame:1,createdAt:-2,consumed:false,reserved:false},
      {id:3,x:500,y:640,dir:{x:-1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false}
    ];d.cloneSerial=3;d.lastEnemy={x:460,y:500};
    const before=e.hp;
    window.update(1/60);
    const committed=d.action?.type;
    let maxLegBeyond=0,previousFinisherHits=0,firstHalfHeld=true,secondHalfMoved=false;
    const finisherAxes=[],finisherSides=[];
    for(let i=0;i<310;i++){
      window.update(1/60);
      const a=d.action;
      if(a?.type==='infinite'&&a.phase==='leg') {
        maxLegBeyond=Math.max(maxLegBeyond,Math.hypot(k.x-e.x,k.y-e.y));
        if(a.leg===0&&a.t<=a.duration*.5+.0001) firstHalfHeld=firstHalfHeld&&Math.hypot(k.x-a.sx,k.y-a.sy)<.01&&window.APEX_KATANA.frameIndex(k)===1;
        if(a.leg===0&&a.t>a.duration*.5) secondHalfMoved=secondHalfMoved||Math.hypot(k.x-a.sx,k.y-a.sy)>20;
      }
      if(a?.type==='infinite'&&a.phase==='finisher'&&a.finisherHits>previousFinisherHits){
        finisherAxes.push(a.lastFinisherAxis);
        finisherSides.push(a.lastFinisherSide);
        previousFinisherHits=a.finisherHits;
      }
    }
    const finisher=(k.damageLabels['katana-infinite-finisher']||0);
    return {committed, active:d.action?.type||null, consumed:d.clones.filter(c=>c.consumed).length, damage:before-e.hp, leg:k.damageLabels['katana-infinite-leg']||0, finisher, healed:k.healingDone, maxLegBeyond, configuredBeyond:window.APEX_KATANA.constants.infiniteBeyond, firstHalfHeld, secondHalfMoved, finisherAxes, finisherSides,legDuration:window.APEX_KATANA.constants.infiniteLegDuration,legEndFrames:d.lastInfiniteLegEndFrames||[],finisherFrames:d.lastInfiniteFinisherFrames||[],vfxCount:window.APEX_KATANA.state.vfx.length};
  })()`);

  report.frameFreeze = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE'), G=window.apexFighterTypes.find(ft=>ft.name==='GALAXY');
    window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});
    let [k,e]=window.fighters,d=k.data.katana;
    d.animTime=.31;k.applyStatus('stun',1,{source:e});const stunFrame=window.APEX_KATANA.frameIndex(k);
    for(let i=0;i<8;i++)window.update(1/60);
    const stunHeld=window.APEX_KATANA.frameIndex(k)===stunFrame;
    k.statuses.stun.timer=0;for(let i=0;i<4;i++)window.update(1/60);const stunReleased=window.APEX_KATANA.frameIndex(k)!==stunFrame;
    d.animTime=.52;window.__apexNinjaStopMotionUntil=performance.now()+1000;const ninjaFrame=window.APEX_KATANA.frameIndex(k);
    for(let i=0;i<8;i++)window.update(1/60);
    const ninjaHeld=window.APEX_KATANA.frameIndex(k)===ninjaFrame;
    window.__apexNinjaStopMotionUntil=0;for(let i=0;i<4;i++)window.update(1/60);const ninjaReleased=window.APEX_KATANA.frameIndex(k)!==ninjaFrame;
    window.startSpecificMatch(K,G,{countdown:false,tournament:false,trial:true});
    [k,e]=window.fighters;d=k.data.katana;d.animTime=.73;e.data.galaxyDivine={worldFreeze:1,timer:1,phase:'pre',punched:true};const galaxyFrame=window.APEX_KATANA.frameIndex(k);
    for(let i=0;i<8;i++)window.update(1/60);
    const galaxyHeld=window.APEX_KATANA.frameIndex(k)===galaxyFrame;
    e.data.galaxyDivine=null;for(let i=0;i<4;i++)window.update(1/60);const galaxyReleased=window.APEX_KATANA.frameIndex(k)!==galaxyFrame;
    return {stunHeld,stunReleased,ninjaHeld,ninjaReleased,galaxyHeld,galaxyReleased};
  })()`);

  report.universalPoseLock = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});
    const [k,e]=window.fighters,c=document.getElementById('game-canvas').getContext('2d');
    k.data.katana.animTime=.44;k.setDir(1,0);k.applyStatus('stun',1,{source:e});k.draw(c);
    const stunCached=!!k.data.apexPoseLock?.canvas,stunDir={...k.data.apexPoseLock.dir};
    k.setDir(0,1);k.draw(c);const stunDirectionHeld=Math.abs(k.data.apexPoseLock.dir.x-stunDir.x)<.001&&Math.abs(k.data.apexPoseLock.dir.y-stunDir.y)<.001;
    k.statuses.stun.timer=0;k.draw(c);const stunReleased=!k.data.apexPoseLock;
    window.__apexNinjaStopMotionUntil=performance.now()+1000;e.setDir(-1,0);e.draw(c);
    const stopCached=!!e.data.apexPoseLock?.canvas,stopDir={...e.data.apexPoseLock.dir};
    e.setDir(0,1);e.draw(c);const stopDirectionHeld=Math.abs(e.data.apexPoseLock.dir.x-stopDir.x)<.001&&Math.abs(e.data.apexPoseLock.dir.y-stopDir.y)<.001;
    window.__apexNinjaStopMotionUntil=0;e.draw(c);const stopReleased=!e.data.apexPoseLock;
    return {stunCached,stunDirectionHeld,stunReleased,stopCached,stopDirectionHeld,stopReleased};
  })()`);

  report.cloneMaturity = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    const run=createdAt=>{
      window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});
      const [k,e]=window.fighters,d=k.data.katana;e.statuses.abilityDisabled={timer:99};
      k.x=220;k.y=500;e.x=500;e.y=500;k.setDir(1,0);
      d.clones=[{id:1,x:820,y:500,dir:{x:-1,y:0},frame:1,createdAt,consumed:false,reserved:false}];d.cloneSerial=1;
      d.animTime=16/24-1/60;d.lastFrame=16;window.update(1/60);
      return {action:d.action?.type||null,consumed:d.clones[0].consumed,centroid:!!d.centroid};
    };
    return {fresh:run(0),mature:run(-2)};
  })()`);

  report.rangeActivation = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    const run=distance=>{window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});const [k,e]=window.fighters,d=k.data.katana;e.baseSpeed=0;e.statuses.abilityDisabled={timer:99};k.x=300;k.y=500;e.x=300+distance;e.y=500;k.setDir(1,0);d.animTime=16/24-1/60;d.lastFrame=16;window.update(1/60);return {action:d.action?.type||null,waves:window.APEX_KATANA.state.waves.length};};
    window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});let [k,e]=window.fighters;k.x=450;k.y=500;e.x=520;e.y=500;k.data.katana.animTime=.1;k.data.katana.lastFrame=3;window.update(1/60);const collisionAction=k.data.katana.action?.type||null;
    return {inside:run(399),outside:run(401),collisionAction};
  })()`);

  report.twinDistanceAndWavePath = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    const run=(cloneX,cloneY)=>{window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});const [k,e]=window.fighters,d=k.data.katana;e.baseSpeed=0;e.statuses.abilityDisabled={timer:99};k.x=40;k.y=500;e.x=500;e.y=500;k.setDir(1,0);d.clones=[{id:1,x:cloneX,y:cloneY,dir:{x:-1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false}];d.cloneSerial=1;d.animTime=16/24-1/60;d.lastFrame=16;const clock=window.matchClock;window.update(1/60);return {action:d.action?.type||null,phase:d.action?.phase||null,clockAdvanced:window.matchClock>clock,consumed:d.clones[0].consumed};};
    return {near:run(699,500),crossing:run(820,570),offWavePath:run(820,740),noPotential:run(100,800)};
  })()`);

  report.clonePetalsAndMoonGlide = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});const [k,e]=window.fighters,d=k.data.katana;k.baseSpeed=0;e.baseSpeed=0;e.statuses.abilityDisabled={timer:99};k.x=100;k.y=500;e.x=900;e.y=900;
    d.clones=[{id:1,x:300,y:300,dir:{x:1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false},{id:2,x:700,y:300,dir:{x:1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false},{id:3,x:500,y:700,dir:{x:1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false}];d.cloneSerial=3;d.action={type:'qa_hold'};
    const cx=500,cy=1300/3;window.update(1/60);const firstDist=Math.hypot(d.moon.x-cx,d.moon.y-cy);for(let i=0;i<100;i++)window.update(1/60);const finalDist=Math.hypot(d.moon.x-cx,d.moon.y-cy);
    const c=document.getElementById('game-canvas').getContext('2d'),native=c.drawImage.bind(c),sample=()=>{const points=[];c.drawImage=(img,...args)=>{if(img===window.APEX_KATANA.images.sakuraPetal){const m=c.getTransform();points.push({x:m.e,y:m.f});}return native(img,...args);};window.draw();c.drawImage=native;return points;};
    const petalsA=sample();window.matchClock+=.35;const petalsB=sample();const falling=petalsA.length===petalsB.length&&petalsA.some((p,i)=>Math.abs(petalsB[i].y-p.y)>8)&&new Set(petalsA.map(p=>Math.round(p.x/8))).size>6;
    return {petals:petalsA.length,falling,firstDist,finalDist,moonGliding:!!d.moon.gliding};
  })()`);

  report.ninjaShurikenTeleportCooldown = await evaluate(`(()=>{
    const N=window.apexFighterTypes.find(ft=>ft.name==='NINJA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');window.startSpecificMatch(N,I,{countdown:false,tournament:false,trial:true});const [n,e]=window.fighters;n.isRage=true;n.data.shurikenTeleportReadyAt=0;n.x=500;n.y=500;e.x=500;e.y=800;e.statuses.abilityDisabled={timer:99};
    const throwWall=()=>{projectiles.push({apexCustom:true,type:'ninja_shuriken',owner:n,targetId:e.id,x:995,y:100,vx:1000,vy:0,radius:12,dmg:1,customLife:1,maxCustomLife:1});window.updateProjectiles(.02);};
    throwWall();const first={teleports:n.data.teleports,readyAt:n.data.shurikenTeleportReadyAt,x:n.x};throwWall();const blocked={teleports:n.data.teleports,x:n.x};window.matchClock=n.data.shurikenTeleportReadyAt+.01;throwWall();return {first,blocked,after:{teleports:n.data.teleports,x:n.x},cooldown:first.readyAt};
  })()`);

  report.twinChainInfinite = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});const [k,e]=window.fighters,d=k.data.katana;e.maxHp=5000;e.hp=5000;e.baseSpeed=0;e.statuses.abilityDisabled={timer:99};
    for(let n=0;n<3;n++){
      k.x=220;k.y=500;e.x=500;e.y=500;k.setDir(1,0);d.clones.push({id:++d.cloneSerial,x:820,y:500,dir:{x:-1,y:0},frame:1,createdAt:window.matchClock-2,consumed:false,reserved:false});d.animTime=16/24-1/60;d.lastFrame=16;window.update(1/60);
      window.update(1/60);
      for(let i=0;i<80&&d.action?.type==='twin';i++)window.update(1/60);
    }
    const triggered=d.action?.type==='infinite'&&d.action?.finisherOnly===true,legAtTrigger=d.action?.leg,consumed=d.clones.filter(c=>c.consumed).length,before=e.hp;
    for(let i=0;i<160&&d.action;i++)window.update(1/60);
    return {triggered,legAtTrigger,consumed,damage:before-e.hp,legDamage:k.damageLabels['katana-infinite-leg']||0,finisherDamage:k.damageLabels['katana-infinite-finisher']||0,frames:d.lastInfiniteFinisherFrames||[],active:d.action?.type||null};
  })()`);

  report.warMachineLaser = await evaluate(`(()=>{
    const E=window.apexFighterTypes.find(ft=>ft.name==='ENGINEER'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');window.startSpecificMatch(E,I,{countdown:false,tournament:false,trial:true});const [eng,target]=window.fighters;eng.statuses.abilityDisabled={timer:99};target.statuses.abilityDisabled={timer:99};eng.baseSpeed=0;target.baseSpeed=0;eng.x=80;eng.y=500;target.x=250;target.y=500;
    const wm={id:8801,owner:eng,kind:'war_machine',state:'online',radius:88,x:80,y:500,aimAngle:-Math.PI/2,pilotedBy:null,hp:100,maxHp:100,dead:false};const fired=window.APEX_ENGINEER.fireWarMachineLaser(wm,target),laser=window.APEX_ENGINEER.lasers.at(-1),total=(laser?.tickDamage||0)*(laser?.totalTicks||10),positions=[{x:target.x,y:target.y}];
    for(let i=0;i<53;i++){window.update(.02);positions.push({x:target.x,y:target.y});}
    const steps=positions.slice(1).map((p,i)=>Math.hypot(p.x-positions[i].x,p.y-positions[i].y)).filter(v=>v>.01);const steady=steps.slice(0,-1),smooth=steady.length>20&&Math.max(...steady)-Math.min(...steady)<.2&&Math.max(...steady)<15;
    const atEdge=Math.abs(target.x-target.radius)<.01||Math.abs(target.x-(1000-target.radius))<.01||Math.abs(target.y-target.radius)<.01||Math.abs(target.y-(1000-target.radius))<.01;
    window.startSpecificMatch(E,I,{countdown:false,tournament:false,trial:true});const [eng2,target2]=window.fighters;eng2.statuses.abilityDisabled={timer:99};target2.statuses.abilityDisabled={timer:99};eng2.baseSpeed=0;target2.baseSpeed=0;eng2.x=80;eng2.y=500;target2.x=250;target2.y=500;const wm2={...wm,id:8802,owner:eng2};window.APEX_ENGINEER.fireWarMachineLaser(wm2,target2);window.update(.1);const initialAngle=wm2.aimAngle;target2.y+=100;window.update(.02);const tracked=Math.abs(wm2.aimAngle-initialAngle)>.05;
    return {fired,total,positions,steps,smooth,atEdge,tracked,ticks:laser?.ticksDone||0};
  })()`);

  report.waveBlocking = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), E=window.apexFighterTypes.find(ft=>ft.name==='ENGINEER'), G=window.apexFighterTypes.find(ft=>ft.name==='GALAXY'), S=window.apexFighterTypes.find(ft=>ft.name==='SOCCER'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    const prep=(enemyType)=>{
      window.startSpecificMatch(K,enemyType,{countdown:false,tournament:false,trial:true});
      const [k,e]=window.fighters,d=k.data.katana;e.statuses.abilityDisabled={timer:99};e.baseSpeed=0;k.x=120;k.y=500;e.x=900;e.y=500;k.setDir(1,0);d.animTime=16/24-1/60;d.lastFrame=16;return {k,e,d};
    };
    const advance=()=>{for(let i=0;i<55;i++)window.update(1/60);};
    let q=prep(E);q.e.data.engineer.structures=[{id:9901,owner:q.e,kind:'turret',state:'online',hp:100,maxHp:100,radius:48,blockRadius:28,x:500,y:500,dead:false,disabled:false}];window.update(1/60);advance();
    const construction=window.APEX_KATANA.state.lastWaveBlock?.kind==='construction'&&q.e.data.engineer.structures[0].hp<100&&window.APEX_KATANA.state.waves.length===0;
    q=prep(E);window.APEX_ENGINEER.shots.push({kind:'rocket',owner:q.e,x:500,y:500,vx:0,vy:0,radius:20,damage:5,life:3,maxLife:3,startX:500,startY:500});window.update(1/60);advance();
    const rocket=window.APEX_KATANA.state.lastWaveBlock?.kind==='rocket'&&window.APEX_KATANA.state.waves.length===0;
    q=prep(G);projectiles.push({type:'galaxy_planet',owner:q.e,x:500,y:500,vx:0,vy:0,radius:38,life:3,maxLife:3,exploded:false,hitIds:{}});window.update(1/60);advance();
    const planet=window.APEX_KATANA.state.lastWaveBlock?.kind==='planet'&&window.APEX_KATANA.state.waves.length===0;
    q=prep(G);q.e.x=541;q.e.data.galaxyPressureArmed=true;window.update(1/60);advance();
    const defendedGalaxy=window.APEX_KATANA.state.lastWaveDefenseSfx?.target==='GALAXY';
    q=prep(S);q.e.x=541;q.e.y=600;q.k.y=600;q.e.data.soccerPossessionActive=true;window.update(1/60);advance();
    const defendedSoccer=window.APEX_KATANA.state.lastWaveDefenseSfx?.target==='SOCCER';
    q=prep(I);q.e.x=541;projectiles.push({type:'ice_lane',owner:q.e,x1:0,y1:500,x2:1000,y2:500,halfWidth:205,life:5,maxLife:5,enemyInside:0,dmgTick:0});window.update(1/60);advance();
    const defendedIce=window.APEX_KATANA.state.lastWaveDefenseSfx?.target==='ICE';
    q=prep(E);q.e.x=541;q.e.data.engineerVirtualShield={amount:20,max:20,timer:5};window.update(1/60);advance();
    const defendedEngineer=window.APEX_KATANA.state.lastWaveDefenseSfx?.target==='ENGINEER';
    q=prep(G);window.update(1/60);const w=window.APEX_KATANA.state.waves[0];w.held=true;w.heldRealUntil=performance.now()-1;w.createdRealAt=performance.now()-(w.maxLife+1)*1000;window.update(1/60);
    const staleCleared=window.APEX_KATANA.state.waves.length===0;
    return {construction,rocket,planet,defendedGalaxy,defendedSoccer,defendedIce,defendedEngineer,staleCleared,lastBlock:window.APEX_KATANA.state.lastWaveBlock,lastDefense:window.APEX_KATANA.state.lastWaveDefenseSfx};
  })()`);

  report.postDashImmunity = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    const setup=()=>{window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});const [k,e]=window.fighters;e.statuses.abilityDisabled={timer:99};e.baseSpeed=0;return {k,e,d:k.data.katana};};
    let q=setup();q.k.x=460;q.k.y=500;q.e.x=535;q.e.y=500;q.k.setDir(1,0);q.d.animTime=16/24-1/60;q.d.lastFrame=16;window.update(1/60);for(let i=0;i<30&&q.d.action;i++)window.update(1/60);const one=q.k.statuses.immune?.timer||0;
    q=setup();q.k.x=220;q.k.y=500;q.e.x=500;q.e.y=500;q.k.setDir(1,0);q.d.clones=[{id:1,x:820,y:500,dir:{x:-1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false}];q.d.cloneSerial=1;q.d.animTime=16/24-1/60;q.d.lastFrame=16;window.update(1/60);for(let i=0;i<80&&q.d.action;i++)window.update(1/60);const twin=q.k.statuses.immune?.timer||0;
    q=setup();q.k.x=160;q.k.y=500;q.e.x=540;q.e.y=500;q.d.clones=[{id:1,x:440,y:430,dir:{x:1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false},{id:2,x:560,y:430,dir:{x:0,y:1},frame:1,createdAt:-2,consumed:false,reserved:false},{id:3,x:500,y:640,dir:{x:-1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false}];q.d.cloneSerial=3;q.d.lastEnemy={x:460,y:500};window.update(1/60);for(let i=0;i<400&&q.d.action;i++)window.update(1/60);const infinite=q.k.statuses.immune?.timer||0;
    q=setup();q.d.clones=[1,2,3,4].map((id,index)=>({id,x:index%2?850:200,y:index<2?200:850,dir:{x:1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false}));q.d.cloneSerial=4;q.k.takeDamage(31,q.e,'qa-bundle',false);const evade=q.k.statuses.immune?.timer||0;
    return {one,twin,infinite,evade,max:window.APEX_KATANA.constants.postDashImmunity};
  })()`);

  report.universalRosterPoseLock = await evaluate(`(()=>{
    const I=window.apexFighterTypes.find(ft=>ft.name==='ICE'),c=document.getElementById('game-canvas').getContext('2d'),failures=[];
    let tested=0;
    for(const ft of window.apexFighterTypes){
      try{
        window.startSpecificMatch(ft,I,{countdown:false,tournament:false,trial:true});const f=window.fighters[0];f.applyStatus('stun',1,{source:window.fighters[1]});f.draw(c);tested++;
        if(!f.data.apexPoseLock?.canvas)failures.push({name:ft.name,reason:'no-cache'});
        const before={...f.data.apexPoseLock.dir};f.setDir(-before.y,before.x);f.draw(c);
        if(Math.abs(f.data.apexPoseLock.dir.x-before.x)>.001||Math.abs(f.data.apexPoseLock.dir.y-before.y)>.001)failures.push({name:ft.name,reason:'rotated'});
      }catch(error){failures.push({name:ft.name,reason:String(error?.message||error)});}
    }
    return {tested,total:window.apexFighterTypes.length,failures};
  })()`);

  report.evade = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});
    const [k,e]=window.fighters,d=k.data.katana;
    d.clones=[
      {id:1,x:200,y:200,dir:{x:1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false},
      {id:2,x:850,y:200,dir:{x:-1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false},
      {id:3,x:200,y:850,dir:{x:1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false},
      {id:4,x:850,y:850,dir:{x:-1,y:0},frame:1,createdAt:-2,consumed:false,reserved:false}
    ];d.cloneSerial=4;k.x=500;k.y=500;e.x=510;e.y=500;
    const before=k.hp;k.takeDamage(31,e,'qa-bundle',false);
    return {lost:before-k.hp, consumed:d.clones.filter(c=>c.consumed).length, x:k.x, y:k.y, immune:k.hasStatus('immune')};
  })()`);

  report.rage = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});
    const [k,e]=window.fighters;k.hp=501;k.takeDamage(1,e,'qa-rage',false);k.heal(200,false);
    return {isRage:k.isRage,hp:k.hp};
  })()`);

  report.collisionOneSword = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    const run=rage=>{window.startSpecificMatch(K,I,{countdown:false,tournament:false,trial:true});const [k,e]=window.fighters,d=k.data.katana;k.isRage=rage;d.rage=rage;k.x=500;k.y=500;e.x=540;e.y=500;const startedAt=window.matchClock;window.handleCollisions(1/60);const first={action:d.action?.type||null,cooldown:d.collisionOneReadyAt-startedAt,immune:k.statuses.immune?.timer||0,clones:d.clones.length};d.action=null;d.noCollisionUntil=0;k.statuses={};e.statuses={};k.x=500;k.y=500;e.x=540;e.y=500;window.handleCollisions(1/60);const duringCooldown={action:d.action?.type||null,separated:Math.hypot(k.x-e.x,k.y-e.y)>40};window.matchClock=d.collisionOneReadyAt+.01;d.noCollisionUntil=0;k.x=500;k.y=500;e.x=540;e.y=500;window.handleCollisions(1/60);return {first,duringCooldown,afterCooldown:{action:d.action?.type||null,clones:d.clones.length}};};
    return {normal:run(false),rage:run(true),normalCd:window.APEX_KATANA.constants.normalCollisionCooldown,rageCd:window.APEX_KATANA.constants.rageCollisionCooldown,rageImmunity:window.APEX_KATANA.constants.ragePostDashImmunity};
  })()`);

  report.shotgunStartLatency = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA'), I=window.apexFighterTypes.find(ft=>ft.name==='ICE'), S=window.apexFighterTypes.find(ft=>ft.name==='SHOTGUN');
    const measure=(A,B)=>{
      const t0=performance.now();
      window.startSpecificMatch(A,B,{countdown:false,tournament:false});
      const elapsed=performance.now()-t0;
      const hud=Number(getComputedStyle(document.getElementById('hud')).opacity);
      const menuHidden=document.getElementById('menu-screen').classList.contains('hidden');
      return {elapsed,state:window.gameState,hud,menuHidden,matchClock:window.matchClock,names:window.fighters.map(f=>f.name)};
    };
    return {baseline:measure(K,I), shotgun:measure(K,S)};
  })()`);

  report.regressionMatches = await evaluate(`(()=>{
    const K=window.apexFighterTypes.find(ft=>ft.name==='KATANA');
    const names=['NINJA','ENGINEER','GALAXY','SHOTGUN'];
    return names.map(name=>{
      const E=window.apexFighterTypes.find(ft=>ft.name===name);
      window.startSpecificMatch(K,E,{countdown:false,tournament:false,trial:true});
      for(let i=0;i<360 && window.gameState==='PLAYING';i++) window.update(1/60);
      const [k,e]=window.fighters;
      return {name,state:window.gameState,katanaHp:k?.hp,enemyHp:e?.hp,waves:window.APEX_KATANA.state.waves.length,errors:(window.apexEarlyErrors||[]).length};
    });
  })()`);

  report.earlyErrors = await evaluate('window.apexEarlyErrors || []');
  report.assertions = {
    selfTest:report.selfTest.registered === 1 && report.selfTest.frames === 48 && report.selfTest.releaseFrame === 17,
    noSamurai:report.noSamurai === true,
    roster:report.roster.total === 1 && report.roster.card && report.roster.bg.includes('pickButton.webp'),
    pickVfx:report.pickVfx.has && report.pickVfx.slot === 'KATANA' && report.pickVfx.src.includes('/assets/katana_v1/picked.webp'),
    modeRosters:report.modeRosters.solo >= 1 && report.modeRosters.trial >= 1 && report.modeRosters.tam >= 1,
    assets:report.assets.frames === 48 && report.assets.loadedFrames === 48 && Object.values(report.assets.images).every(asset => asset.complete && asset.width > 0 && asset.height > 0),
    audio:Object.values(report.audio).every(asset => asset.ok && asset.bytes > 1000),
    alpha:report.alpha.frameCorner[3] === 0 && report.alpha.waveCorner[3] === 0 && report.alpha.pickedCorner[3] === 0 && report.alpha.pickBg.includes('pickButton.webp'),
    visualAndMovementFixes:Math.abs(report.visualAndMovementFixes.bodyScale - .312) < .001 && Math.abs(report.visualAndMovementFixes.effectScale - .8) < .001 && Math.abs(report.visualAndMovementFixes.bodyForwardOffset + Math.PI / 2) < .001 && report.visualAndMovementFixes.waveLength === 416 && report.visualAndMovementFixes.waveSpeed === 1080 && report.visualAndMovementFixes.dashDuration <= .11 && report.visualAndMovementFixes.bladeSize.w === 1535 && report.visualAndMovementFixes.bladeSize.h === 1024 && Math.abs(report.visualAndMovementFixes.dirAfterFreeMove.x) < .001 && report.visualAndMovementFixes.dirAfterFreeMove.y > .99 && report.visualAndMovementFixes.actionAfterContact === 'one' && report.visualAndMovementFixes.actionAtRelease === 'one' && Math.abs(report.visualAndMovementFixes.damage - 5) < .001 && report.visualAndMovementFixes.stickyCount > 0 && report.visualAndMovementFixes.topLayerDrawCount > 0 && Math.abs(report.visualAndMovementFixes.offsetBefore.x - report.visualAndMovementFixes.offsetAfter.x) < .001 && Math.abs(report.visualAndMovementFixes.offsetBefore.y - report.visualAndMovementFixes.offsetAfter.y) < .001,
    normalWave:report.normalWave.before === 0 && report.normalWave.after === 1 && report.normalWave.frame === 17 && report.normalWave.halfWidth === 100 && report.normalWave.damage === 5 && report.normalWave.speed === 1080 && report.normalWave.length === 416 && report.normalWave.visualCenter === true && report.normalWave.transparentInsideBounds === false,
    oneSword:report.oneSword.clones === 1 && Math.abs(report.oneSword.damage - 5) < .001 && report.oneSword.passed && report.oneSword.afterimages >= 8 && report.oneSword.stunnedEarly,
    oneSwordChain:Math.abs(report.oneSwordChain.damage - 10) < .001,
    twin:report.twin.consumed && Math.abs(report.twin.damage - 10) < .001 && report.twin.waves===0 && report.twin.lockedAtStart && ['wait','dash'].includes(report.twin.initialPhase) && report.twin.initialTimeScale === 1 && report.twin.initialHitStop === 0 && report.twin.departurePetals >= 26 && report.twin.waveSpeed===1080&&Math.abs(report.twin.waveStep-9)<.1&&report.twin.waitDuration>=0&&report.twin.travelDuration>0&&report.twin.pulses >= 2 && report.twin.impactFrame === 17 && report.twin.finishFrame === 1 && report.twin.releasedTarget && !report.twin.targetStunned && !report.twin.targetHeld && report.twin.action === null,
    twinLifesteal:Math.abs(report.twinLifesteal.moonFollow.healed-10)<.01&&Math.abs(report.twinLifesteal.moonFollow.healingDone-10)<.01&&report.twinLifesteal.moonFollow.remaining<3&&Math.abs(report.twinLifesteal.centroid.healed)<.01&&report.twinLifesteal.centroid.remaining>=3,
    twinRealtime:!report.twinRealtime.phases.includes('arrivalPause') && report.twinRealtime.phases.includes('dash') && !report.twinRealtime.phases.includes('midPause') && report.twinRealtime.pulses >= 2 && report.twinRealtime.impactFrame === 17 && report.twinRealtime.samples.some(s=>s.phase==='dash') && report.twinRealtime.samples.every(s=>s.timeScale===1),
    infinite:report.infinite.committed === 'infinite' && report.infinite.consumed === 3 && report.infinite.damage >= 45 && report.infinite.leg >= 34.9 && report.infinite.leg <= 35.1 && report.infinite.finisher >= 10 && report.infinite.healed === 0 && report.infinite.configuredBeyond === 300 && report.infinite.maxLegBeyond >= 270 && report.infinite.firstHalfHeld && report.infinite.secondHalfMoved && Math.abs(report.infinite.legDuration-.31)<.001 && report.infinite.legEndFrames.length===3 && report.infinite.legEndFrames.every(frame=>frame===23) && report.infinite.finisherFrames.length===10 && report.infinite.finisherFrames.every(frame=>frame===23) && report.infinite.vfxCount<180 && report.infinite.finisherAxes.length >= 8 && new Set(report.infinite.finisherAxes).size >= 4 && report.infinite.finisherAxes.every((axis,index)=>axis===Math.floor(index/2)) && report.infinite.finisherSides.every((side,index)=>side===(index%2===0?-1:1)),
    frameFreeze:Object.values(report.frameFreeze).every(Boolean),
    universalPoseLock:Object.values(report.universalPoseLock).every(Boolean),
    cloneMaturity:report.cloneMaturity.fresh.action!=='twin'&&!report.cloneMaturity.fresh.consumed&&report.cloneMaturity.mature.action==='twin'&&report.cloneMaturity.mature.consumed,
    rangeActivation:report.rangeActivation.collisionAction==='one'&&report.rangeActivation.inside.action==='one'&&report.rangeActivation.inside.waves===0&&report.rangeActivation.outside.action===null&&report.rangeActivation.outside.waves===1,
    twinDistanceAndWavePath:report.twinDistanceAndWavePath.near.action!=='twin'&&!report.twinDistanceAndWavePath.near.consumed&&report.twinDistanceAndWavePath.crossing.action==='twin'&&['wait','dash'].includes(report.twinDistanceAndWavePath.crossing.phase)&&report.twinDistanceAndWavePath.crossing.clockAdvanced&&report.twinDistanceAndWavePath.offWavePath.action!=='twin'&&!report.twinDistanceAndWavePath.offWavePath.consumed&&report.twinDistanceAndWavePath.noPotential.action!=='twin'&&!report.twinDistanceAndWavePath.noPotential.consumed,
    clonePetalsAndMoonGlide:report.clonePetalsAndMoonGlide.petals===9&&report.clonePetalsAndMoonGlide.falling&&report.clonePetalsAndMoonGlide.firstDist>20&&report.clonePetalsAndMoonGlide.finalDist<3,
    ninjaShurikenTeleportCooldown:report.ninjaShurikenTeleportCooldown.first.teleports===1&&report.ninjaShurikenTeleportCooldown.blocked.teleports===1&&report.ninjaShurikenTeleportCooldown.after.teleports===2&&Math.abs(report.ninjaShurikenTeleportCooldown.cooldown-1)<.001,
    twinChainInfinite:report.twinChainInfinite.triggered&&report.twinChainInfinite.legAtTrigger===3&&report.twinChainInfinite.consumed===3&&report.twinChainInfinite.damage>0&&report.twinChainInfinite.legDamage===0&&report.twinChainInfinite.finisherDamage>0&&report.twinChainInfinite.frames.length===10&&report.twinChainInfinite.frames.every(frame=>frame===23)&&report.twinChainInfinite.active===null,
    warMachineLaser:report.warMachineLaser.fired&&Math.abs(report.warMachineLaser.total-37.5)<.001&&report.warMachineLaser.ticks===10&&report.warMachineLaser.atEdge&&report.warMachineLaser.tracked&&report.warMachineLaser.smooth,
    waveBlocking:report.waveBlocking.construction&&report.waveBlocking.rocket&&report.waveBlocking.planet&&report.waveBlocking.defendedGalaxy&&report.waveBlocking.defendedSoccer&&report.waveBlocking.defendedIce&&report.waveBlocking.defendedEngineer&&report.waveBlocking.staleCleared,
    postDashImmunity:['one','twin','infinite','evade'].every(key=>report.postDashImmunity[key]>0&&report.postDashImmunity[key]<=report.postDashImmunity.max+.001),
    universalRosterPoseLock:report.universalRosterPoseLock.tested===report.universalRosterPoseLock.total&&report.universalRosterPoseLock.failures.length===0,
    evade:report.evade.lost === 0 && report.evade.consumed === 1 && report.evade.immune,
    rage:report.rage.isRage === true && report.rage.hp > 500,
    collisionOneSword:['normal','rage'].every(key=>report.collisionOneSword[key].first.action==='one'&&report.collisionOneSword[key].first.clones===1&&report.collisionOneSword[key].duringCooldown.action===null&&report.collisionOneSword[key].duringCooldown.separated&&report.collisionOneSword[key].afterCooldown.action==='one'&&report.collisionOneSword[key].afterCooldown.clones===2)&&report.collisionOneSword.normal.first.cooldown===5&&report.collisionOneSword.rage.first.cooldown===1&&report.collisionOneSword.normalCd===5&&report.collisionOneSword.rageCd===1&&report.collisionOneSword.rage.first.immune>=.6&&report.collisionOneSword.rageImmunity===.5,
    shotgunStartLatency:report.shotgunStartLatency.baseline.state === 'PLAYING' && report.shotgunStartLatency.baseline.menuHidden && report.shotgunStartLatency.shotgun.state === 'PLAYING' && report.shotgunStartLatency.shotgun.menuHidden && report.shotgunStartLatency.shotgun.hud === 1 && report.shotgunStartLatency.shotgun.elapsed < 500,
    regressionMatches:report.regressionMatches.every(m => Number.isFinite(m.katanaHp) && Number.isFinite(m.enemyHp) && m.errors === 0),
    noEarlyErrors:report.earlyErrors.length === 0,
  };
  report.ok = Object.values(report.assertions).every(Boolean);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
} finally {
  try { socket.close(); } catch {}
  if (chrome) chrome.kill();
}
