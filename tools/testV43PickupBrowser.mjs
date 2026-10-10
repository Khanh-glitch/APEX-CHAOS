// V43 owner reproduction gate: REAL floor slot pickup + real Chrome canvas + Fighter HP.
// We explicitly disallow direct weaponApi.equip() in this gate. The earlier
// headless PASS bypassed pickup, skipped browser rendering, and did not verify deployment.
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const base=(process.env.APEX_APP_URL||'http://127.0.0.1:5173').replace(/\/$/,'');
const bin=process.env.CHROME_PATH||'google-chrome';
const out=process.env.APEX_EVIDENCE_DIR||'/tmp/apex-v43-chrome';
const port=9427,serial=()=>++counter;let counter=0,ws;
const chrome=spawn(bin,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--remote-allow-origins=*','--remote-debugging-port='+port,
  '--user-data-dir=/tmp/apex-v43-owner-'+process.pid,'about:blank'],{stdio:'ignore'});
const pending=new Map(),results=[];
function cd(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=serial(),tid=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},25000);
    pending.set(id,{resolve:r=>{clearTimeout(tid);resolve(r)},reject:e=>{clearTimeout(tid);reject(e)}});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function ev(expression){
  const r=await cd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result.value;
}
function check(label,ok,details){
  console.log((ok?'PASS':'FAIL')+' REAL-V43-CHROME '+label+' '+JSON.stringify(details).slice(0,1400));
  if(!ok)throw Error('REAL-V43-CHROME '+label+' '+JSON.stringify(details).slice(0,1700));
}
try{
  await mkdir(out,{recursive:true});
  let target;
  for(let i=0;i<100;i++){
    try{target=(await (await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.type==='page');if(target)break;}catch{}
    await sleep(120);
  }
  if(!target)throw Error('Chrome CDP unavailable');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
  ws.addEventListener('message',m=>{const x=JSON.parse(m.data);if(!x.id||!pending.has(x.id))return;
    const p=pending.get(x.id);pending.delete(x.id);x.error?p.reject(Error(x.error.message)):p.resolve(x.result);
  });
  await cd('Runtime.enable');await cd('Page.enable');
  await cd('Page.navigate',{url:base+'/?v43OwnerChromeAudit=1'});
  for(let i=0;i<180;i++){
    if(await ev('Boolean(window.__apexEngineReady)').catch(()=>false))break;
    if(i===179)throw Error('Production Apex engine failed to load in Chrome');
    await sleep(120);
  }
  // Real Home smoke, BEFORE eager loading the full battle product.
  // Gold boot must already have brought up Arsenal Hub/config and META so
  // Ctrl+Shift+F8 actually works at Home, not just inside a synthetic VM.
  let homeLoaded=false;
  for(let i=0;i<100;i++){
    homeLoaded=await ev('Boolean(window.APEX_ARSENAL_OWNER_TEST && window.APEX_ARSENAL_META?.openBotPick)').catch(()=>false);
    if(homeLoaded)break;
    await sleep(100);
  }
  check('owner-hidden-keyboard-loaded-at-real-Gold-Home',homeLoaded,{homeLoaded});
  const homeChord=await ev(`(()=>{
    const owner=window.APEX_ARSENAL_OWNER_TEST;
    const before={active:owner.active,mode:window.__apexArsenalSelectionMode||null};
    window.dispatchEvent(new KeyboardEvent('keydown',{
      key:'F8',code:'F8',ctrlKey:true,shiftKey:true,bubbles:true}));
    const opened={active:owner.active,mode:window.__apexArsenalSelectionMode||null,
      pending:window.__apexArsenalSelectPending===true};
    window.dispatchEvent(new KeyboardEvent('keydown',{
      key:'F8',code:'F8',ctrlKey:true,shiftKey:true,bubbles:true}));
    return {before,opened,off:!owner.active,selected:owner.selectedWeaponId};
  })()`);
  check('owner-keyboard-opens-real-Gold-BOT-pick-before-battle',
    homeChord.before.active===false&&homeChord.opened.active===true
      &&homeChord.opened.mode==='bot'&&homeChord.opened.pending===true
      &&homeChord.off===true&&homeChord.selected===null,homeChord);
  const ready=await ev(`(async()=>{
    await window.__apexEnsureDeferredRuntimes('arsenalProduct');
    // Arsenal product manifest already includes battle mode; the generic
    // deferred loader has no standalone 'battle' group on this surface.
    return {product:window.apexArsenalBattleRuntime,
      start:typeof window.startArsenalBattleMode,asset:!!window.APEX_ARSENAL_AV,
      atlas:typeof window.APEX_ARSENAL?.weaponApi?.drawArsenalProjectiles};
  })()`);
  check('actual-browser-runtimes-ready',ready?.product==='ready'&&ready.start==='function'&&ready.atlas==='function',ready);
  const paths=['FLARE_GUN','TACTICAL_CROSSBOW','STEEL_BALL_LAUNCHER',
    'COMBAT_BOOMERANG','RPG_7','FLAMETHROWER','PLASMA_SPLITTER',
    'SHRAPNEL_MINE_LAUNCHER','BOLT','STEEL_BALL','RPG_ROCKET','SHRAPNEL_MINE'];
  const images=await ev(`(async()=>await Promise.all(${JSON.stringify(paths)}.map(async id=>{
    const img=new Image(),src='/assets/arsenal/v43/'+id+'.webp';
    img.src=src;try{await img.decode();return{id,ok:img.naturalWidth>0,width:img.naturalWidth};}
    catch{return{id,ok:false,width:0};}
  })))()`);
  check('all-twelve-real-v43-art-files-decode',images.every(x=>x.ok),images);
  for(const id of ['FLARE_GUN','TACTICAL_CROSSBOW','STEEL_BALL_LAUNCHER',
    'COMBAT_BOOMERANG','RPG_7','FLAMETHROWER','PLASMA_SPLITTER','SHRAPNEL_MINE_LAUNCHER']){
    const rec=await ev(`(()=>{
      // The production fixture is deliberately gated by localhost + this flag.
      // Without it the product rightly refuses HERO/RIVAL and state remains null.
      window.__APEX_TEST_MODE=true;
      window.__apexArsenalBattleProfile='LOCAL';
      window.__apexArsenalBotBattle=false;
      window.__apexArsenalFreeBattle=false;
      const launched=window.startArsenalBattleMode('HERO','RIVAL',{testFixture:true});
      if(launched!==true)throw Error('Local HERO/RIVAL start refused: '+launched);
      if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0;}
      const S=window.APEX_ARSENAL.state,W=window.APEX_ARSENAL.weaponApi;
      S.spawnTimer=1e6;S.slots.length=0;S.spawnHeld=true;S.unarmedFastConsumed=true;
      const f=fighters[0],t=fighters[1];f.x=320;f.y=500;t.x=(${JSON.stringify(id)}==='FLAMETHROWER'?555:700);t.y=500;
      f.setDir(1,0);t.setDir(-1,0);f.baseSpeed=0;t.baseSpeed=0;f.hp=1000;t.hp=1000;
      projectiles.length=0;window.APEX_ARSENAL.events.length=0;
      const slot={id:S.nextSlotId++,x:f.x,y:f.y,phase:'REVEALED',weaponId:${JSON.stringify(id)},
        revealLeadSeconds:0,revealedFor:0,pickedBy:null,rejectedFor:{},spawnTime:S.time,
        predictedHeroETA:null,predictedRivalETA:null,earliestETA:null,predictedFighter:null};
      S.slots.push(slot);
      const canvas=document.getElementById('game-canvas'),c=canvas.getContext('2d');
      const old=c.drawImage,vis=[];
      c.drawImage=function(img,...args){
        const url=String(img?.src||'');
        if(url.includes('/assets/arsenal/v43/')&&vis.length<100)
          vis.push(url.split('/').pop());
        return old.call(this,img,...args);
      };
      const states=[],seen=new Set();let picked=false,maxShots=0,aliveAtShot=0;
      try{
        for(let i=0;i<450;i++){
          window.APEX_ARSENAL.step(1/60);
          if(i<115 || i%9===0)draw();
          const h=W.getHolder(f);
          if(h?.weaponId===${JSON.stringify(id)}){picked=true;maxShots=Math.max(maxShots,h.shotsFired||0);}
          for(const p of projectiles)if(p.aq&&p.weapon===${JSON.stringify(id)}&&p.life>0)
            seen.add(p.kind+':'+p.phase);
          if(i===24||i===62)states.push({i,weapon:h?.weaponId,phase:h?.phase,
            hp:t.hp,projectiles:projectiles.filter(p=>p.aq).length});
          if(!aliveAtShot&&maxShots)aliveAtShot=i/60;
        }
      }finally{c.drawImage=old;}
      const ev=window.APEX_ARSENAL.events;
      return {weapon:${JSON.stringify(id)},picked,maxShots,seen:[...seen],visible:vis,
        aliveAtShot,damage:1000-t.hp,
        pickup:ev.filter(x=>x.includes('PICKUP')&&x.includes('weapon='+${JSON.stringify(id)})).length,
        fire:ev.filter(x=>x.includes(' USE ')&&x.includes('weapon='+${JSON.stringify(id)})).length,
        sample:states,
        errors:window.apexEarlyErrors?.slice(-3)||[]};
    })()`);
    results.push(rec);
    // Boomerang physically LEAVES the holder on release: shotsFired on a
    // vanished held slot cannot be the firing witness. The native USE event
    // and an airborne Boomerang are the authoritative facts, and catches
    // can legitimately lead to a second USE without another floor pickup.
    const boomerang=id==='COMBAT_BOOMERANG';
    check(id+'-floor-pickup-use',rec.picked&&rec.pickup>=1
      &&(boomerang?(rec.fire>=1&&rec.seen.some(k=>k==='boomerang:out'))
        :(rec.maxShots===1&&rec.fire===1)),rec);
    check(id+'-real-projectile-reached-browser',rec.seen.length>0,rec);
    check(id+'-canvas-drew-weapon-art',rec.visible.includes(id+'.webp'),rec);
    if(['TACTICAL_CROSSBOW','STEEL_BALL_LAUNCHER','RPG_7','SHRAPNEL_MINE_LAUNCHER'].includes(id))
      check(id+'-canvas-drew-real-projectile-asset',rec.visible.some(x=>x!==(id+'.webp')),rec);
    if(id!=='COMBAT_BOOMERANG')check(id+'-native-HP-damage',rec.damage>0,rec);
  }
  // ADVERSE REAL PRODUCT CASE: Core Six hero actor + public roster path.
  // The earlier passing blank HERO/RIVAL fixture was NOT the battle played
  // by the owner. Check the public shell authorization and real actor damage.
  const productCases=[];
  for(const id of ['FLARE_GUN','TACTICAL_CROSSBOW','STEEL_BALL_LAUNCHER','COMBAT_BOOMERANG','RPG_7','FLAMETHROWER','PLASMA_SPLITTER','SHRAPNEL_MINE_LAUNCHER']){
    const q=await ev(`(()=>{
      window.exitArsenalBattleMode?.();
      window.__APEX_TEST_MODE=false;
      window.__apexArsenalBattleProfile='LOCAL';
      window.__apexArsenalBotBattle=false;
      window.__apexArsenalFreeBattle=true;
      const permitted=window.APEX_ARSENAL_SHELLS?.isPlayable?.('ROBOT');
      const started=window.startArsenalBattleMode('ROBOT','ROBOT',{});
      if(!started)return {id:${JSON.stringify(id)},started,permitted,
        reason:'public ROBOT shell not playable or not selectable',
        shell:window.APEX_ARSENAL_SHELLS?.describe?.()};
      if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0;}
      const st=window.APEX_ARSENAL.state,wa=window.APEX_ARSENAL.weaponApi;
      const a=fighters[0],b=fighters[1];
      a.x=320;a.y=500;b.x=${JSON.stringify(id==='PLASMA_SPLITTER'?800:570)};b.y=500;
      a.setDir(1,0);b.setDir(-1,0);a.baseSpeed=0;b.baseSpeed=0;
      a.hp=1000;b.hp=1000;
      st.spawnTimer=1e6;st.spawnHeld=true;st.slots.length=0;
      st.unarmedFastConsumed=true;
      projectiles.length=0;window.APEX_ARSENAL.events.length=0;
      st.slots.push({id:st.nextSlotId++,x:320,y:500,phase:'REVEALED',
        weaponId:${JSON.stringify(id)},revealLeadSeconds:0,revealedFor:0,
        pickedBy:null,rejectedFor:{},spawnTime:st.time});
      const states=[],used=new Set(),phaseFrames=[];
      const captureAt=${JSON.stringify(id)}==='COMBAT_BOOMERANG'
        ?[20,42,75,110,180,260]:[20,42,65,95,130,170];
      const snapAt=${JSON.stringify(id)}==='COMBAT_BOOMERANG'?75:
        ${JSON.stringify(id)}==='PLASMA_SPLITTER'?61:
        ${JSON.stringify(id)}==='SHRAPNEL_MINE_LAUNCHER'?70:38;
      let renderedFrame=null;
      const originalTick=wa.updateArsenalProjectiles;
      let tickCalls=0;
      wa.updateArsenalProjectiles=function(dt){tickCalls++;return originalTick.call(wa,dt);};
      for(let i=0;i<(${JSON.stringify(id)}==='COMBAT_BOOMERANG'?420:300);i++){
        window.APEX_ARSENAL.step(1/60);
        if(i%2===0)draw();
        if(i===snapAt){
          draw();renderedFrame=document.getElementById('game-canvas').toDataURL('image/png');
        }
        if(captureAt.includes(i)){
          draw();phaseFrames.push({step:i,png:document.getElementById('game-canvas').toDataURL('image/png')});
        }
        for(const x of projectiles)if(x.aq&&x.weapon===${JSON.stringify(id)})used.add(x.kind);
        if(i===18||i===35||i===80||i===160){
          const h=wa.getHolder(a);
          states.push({time:+(i/60).toFixed(2),phase:h?.phase||null,
            weapon:h?.weaponId||null,atk:a.hp,def:b.hp,
            projectileCount:projectiles.filter(p=>p.aq).length,
            projectile:projectiles.filter(p=>p.aq&&p.weapon===${JSON.stringify(id)})
              .map(p=>({type:p.type,aq:p.aq,kind:p.kind,x:+p.x.toFixed(2),y:+p.y.toFixed(2),
                vx:Number.isFinite(p.vx)?+p.vx.toFixed(2):null,vy:Number.isFinite(p.vy)?+p.vy.toFixed(2):null,angle:Number.isFinite(p.angle)?+p.angle.toFixed(3):null,
                life:+p.life.toFixed(2),age:p.age,hr:p.__hr||null,ownerId:p.owner?.id})),
            position:{x:a.x,y:a.y,tx:b.x,ty:b.y},
            state:{active:st.active,over:st.over,gameState,simTime:st.time,quest:st.questMultiActor},ids:{a:a.id,b:b.id},rework:window.APEX_HERO_REWORK?.resolveEnemyBody?.(a,b)?.id||null
            });
        }
      }
      wa.updateArsenalProjectiles=originalTick;
      const events=window.APEX_ARSENAL.events;
      return {id:${JSON.stringify(id)},started,permitted,tickCalls,
        p1:a.name,p2:b.name,damage:1000-b.hp,
        kinds:[...used],pickup:events.filter(e=>e.includes('PICKUP')
          &&e.includes('weapon='+${JSON.stringify(id)})).length,
        fire:events.filter(e=>e.includes(' USE ')
          &&e.includes('weapon='+${JSON.stringify(id)})).length,
        states,renderedFrame,phaseFrames};
    })()`);
    if(q.renderedFrame?.startsWith('data:image/png;base64,')){
      await writeFile(join(out,'core-six-'+id+'.png'),
        Buffer.from(q.renderedFrame.slice('data:image/png;base64,'.length),'base64'));
      delete q.renderedFrame;
    }
    const phaseHashes=[];
    for(const frame of q.phaseFrames||[]){
      const raw=Buffer.from((frame.png||'').split(',')[1]||'','base64');
      phaseHashes.push(createHash('sha256').update(raw).digest('hex'));
      await writeFile(join(out,'r3-motion-'+id+'-step'+frame.step+'.png'),raw);
    }
    q.phaseHashes=phaseHashes;q.phaseSteps=(q.phaseFrames||[]).map(f=>f.step);
    delete q.phaseFrames;
    check('R3-'+id+'-six-real-motion-frames',phaseHashes.length===6
      &&new Set(phaseHashes).size>=2,{steps:q.phaseSteps,unique:new Set(phaseHashes).size});
    productCases.push(q);
    check('CORE-SIX-PUBLIC-'+id+'-pickup-shot-damage',
      q.started===true&&q.p1==='ROBOT'&&q.p2==='ROBOT'
      &&q.pickup===1&&q.kinds.length>0
      &&(id==='COMBAT_BOOMERANG'
        ?(q.fire>=1&&q.kinds.includes('boomerang')
           &&q.states.some(s=>s.projectile.some(p=>p.kind==='boomerang'))
           &&q.states.some(s=>s.weapon===null))
        :(q.fire===1&&q.damage>0)),q);
  }
  // Owner R3 visual regression: full source->safe-core transformation at the
  // most hostile screen corner, captured at three Gold charge phases.
  // The real Chrome canvas must contain a brighter complete charged core,
  // not only a JS function name. This uses direct equip ONLY as a visual
  // probe; above eight gameplay cases still use real floor pickup.
  const plasmaVisual=await ev(`(()=>{
    window.exitArsenalBattleMode?.();window.__APEX_TEST_MODE=false;
    window.__apexArsenalBattleProfile='LOCAL';window.__apexArsenalFreeBattle=true;
    if(!window.startArsenalBattleMode('ROBOT','ROBOT',{}))throw Error('Plasma visual battle failed');
    if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0;}
    const a=fighters[0],b=fighters[1],wa=window.APEX_ARSENAL.weaponApi;
    a.x=943;a.y=58;b.x=200;b.y=490;a.baseSpeed=0;b.baseSpeed=0;
    if(typeof cameraZoom!=='undefined')cameraZoom=1;
    wa.equip(a,'PLASMA_SPLITTER');
    const h=wa.getHolder(a);if(!h)throw Error('Visual probe failed to equip');
    h.meta.aimAngle=0;h.phase='READY';
    const canvas=document.getElementById('game-canvas'),ctx=canvas.getContext('2d');
    const point=window.APEX_ARSENAL_AV.weaponMuzzleWorld(a,h,0);
    const pixel=()=>{const d=ctx.getImageData(Math.round(point.x),Math.round(point.y),1,1).data;
      return d[0]+d[1]+d[2];};
    draw();const baseline=pixel(),frames=[];
    for(const time of [.10,.32,.48]){
      h.phase='WINDUP';h.meta.v43Wait=.5;h.meta.v43Time=time;
      draw();frames.push({time,brightness:pixel(),png:canvas.toDataURL('image/png')});
    }
    return {point,baseline,frames,width:canvas.width,height:canvas.height};
  })()`);
  for(const f of plasmaVisual.frames){
    if(f.png?.startsWith('data:image/png;base64,')){
      const raw=Buffer.from(f.png.split(',')[1],'base64');
      f.hash=createHash('sha256').update(raw).digest('hex');
      await writeFile(join(out,'v43-plasma-edge-charge-'+String(f.time).replace('.','_')+'.png'),raw);
      delete f.png;
    }
  }
  const margin=104,pos=plasmaVisual.point;
  check('R3-PLASMA-CHARGE-EDGE-INSET',pos.x>=margin&&pos.y>=margin
    &&pos.x<=1000-margin&&pos.y<=1000-margin
    &&Math.hypot(pos.x-pos.sourceX,pos.y-pos.sourceY)>5,
    {point:pos,width:plasmaVisual.width,height:plasmaVisual.height});
  check('R3-PLASMA-CORE-BRIGHTENS-THROUGH-CHARGE',
    plasmaVisual.frames.every(f=>f.brightness>plasmaVisual.baseline+35),
    {baseline:plasmaVisual.baseline,frames:plasmaVisual.frames});
  check('R3-PLASMA-RING-COMPRESSION-CHANGES-REAL-CHROME-PIXELS',
    new Set(plasmaVisual.frames.map(f=>f.hash)).size===3,
    plasmaVisual.frames.map(f=>({time:f.time,hash:f.hash?.slice(0,12)})));

  // R3 Crystal K integration smoke: REAL Core Six Crystal vs real ROBOT,
  // three distinct special physics families (linear, split energy, return).
  // Standalone direct equip is used only for countermechanic verification;
  // the eight public-floor-pickup checks above remain unchanged.
  const crystalResults=[];
  for(const id of ['TACTICAL_CROSSBOW','PLASMA_SPLITTER','COMBAT_BOOMERANG']){
    const rec=await ev((()=>{return `(()=>{
      window.exitArsenalBattleMode?.();
      window.__APEX_TEST_MODE=false;
      window.__apexArsenalBattleProfile='LOCAL';window.__apexArsenalFreeBattle=true;
      const started=window.startArsenalBattleMode('ROBOT','CRYSTAL',{});
      if(!started)return {id:__V43_ID__,started:false};
      if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0;}
      const A=window.APEX_ARSENAL,wa=A.weaponApi,HR=window.APEX_HERO_REWORK,CR=window.APEX_CRYSTAL;
      const a=fighters[0],b=fighters[1];a.x=270;a.y=500;b.x=730;b.y=500;
      a.setDir(1,0);b.setDir(-1,0);a.baseSpeed=0;b.baseSpeed=0;
      if(a.data)a.data.__hrHoldBody=true;if(b.data)b.data.__hrHoldBody=true;
      a.hp=1000;b.hp=1000;A.state.spawnTimer=1e6;A.state.spawnHeld=true;
      A.state.slots.length=0;A.state.unarmedFastConsumed=true;projectiles.length=0;
      const ct=HR.byCombatant(b),k=ct&&CR.castAwakening({combatant:ct,cfg:ct.skills.A2.cfg});
      wa.equip(a,__V43_ID__);
      let seen=false,seenReflected=false,maxObjects=0;
      for(let i=0;i<255;i++){
        A.step(1/60);
        if(i%8===0)draw();
        for(const p of projectiles)if(p.type==='aq_v43'&&p.weapon===__V43_ID__){
          seen=true;
          if(p.__hr?.crystalReflected||p.aqReflected)seenReflected=true;
        }
        maxObjects=Math.max(maxObjects,projectiles.filter(p=>p.aq).length);
      }
      const inspected=ct?CR.inspect(ct):null;
      return {id:__V43_ID__,started,cast:!!k,kindCount:maxObjects,seen,
        seenReflected,hpA:a.hp,hpB:b.hp,
        kActive:inspected?.k?.active,shards:inspected?.available,
        intercepts:inspected?.telemetry?.intercepts||0,
        reflectedDamage:inspected?.telemetry?.reflectedDamage||0,
        errors:window.apexEarlyErrors?.slice(-2)||[]};
    })()`})().replaceAll('__V43_ID__',JSON.stringify(id)));
    crystalResults.push(rec);
    const plausible={TACTICAL_CROSSBOW:112,PLASMA_SPLITTER:201,COMBAT_BOOMERANG:126}[id];
    check('R3-CRYSTAL-K-'+id+'-REAL-CORE-SIX-BOUNDED-CONTACT',
      rec.started===true&&rec.cast===true&&rec.seen
      &&Number.isFinite(rec.hpA)&&Number.isFinite(rec.hpB)
      &&rec.hpA>=0&&rec.hpB>=0&&rec.hpB>=1000-plausible-1,
      rec);
  }
  await writeFile(join(out,'r3-crystal-three-family-integration.json'),
    JSON.stringify(crystalResults,null,2));

  await writeFile(join(out,'v43-browser-real-pickup.json'),JSON.stringify({base,results,productCases},null,2));
  const capture=await cd('Page.captureScreenshot',{format:'png'});
  await writeFile(join(out,'v43-browser-last-weapon.png'),Buffer.from(capture.data,'base64'));
  console.log('PASS REAL-V43-CHROME EIGHT REAL FLOOR PICKUPS AND DRAWN PROJECTILES');
}catch(e){console.error('FAIL REAL-V43-CHROME',e.stack||e);process.exitCode=1;}
finally{try{ws?.close();}catch{}chrome.kill();}
