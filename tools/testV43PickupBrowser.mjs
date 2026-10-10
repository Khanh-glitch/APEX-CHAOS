// V43 owner reproduction gate: REAL floor slot pickup + real Chrome canvas + Fighter HP.
// We explicitly disallow direct weaponApi.equip() in this gate. The earlier
// headless PASS bypassed pickup, skipped browser rendering, and did not verify deployment.
import {spawn} from 'node:child_process';
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
      const f=fighters[0],t=fighters[1];f.x=320;f.y=500;t.x=700;t.y=500;
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
    check(id+'-floor-pickup-use',rec.picked&&rec.maxShots===1&&rec.fire===1&&rec.pickup>=1,rec);
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
  for(const id of ['FLARE_GUN','TACTICAL_CROSSBOW','RPG_7','PLASMA_SPLITTER']){
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
      a.x=320;a.y=500;b.x=700;b.y=500;
      a.setDir(1,0);b.setDir(-1,0);a.baseSpeed=0;b.baseSpeed=0;
      a.hp=1000;b.hp=1000;
      st.spawnTimer=1e6;st.spawnHeld=true;st.slots.length=0;
      st.unarmedFastConsumed=true;
      projectiles.length=0;window.APEX_ARSENAL.events.length=0;
      st.slots.push({id:st.nextSlotId++,x:320,y:500,phase:'REVEALED',
        weaponId:${JSON.stringify(id)},revealLeadSeconds:0,revealedFor:0,
        pickedBy:null,rejectedFor:{},spawnTime:st.time});
      const states=[],used=new Set();
      let earlyManualProbe=null;
      const originalTick=wa.updateArsenalProjectiles;
      let tickCalls=0;
      wa.updateArsenalProjectiles=function(dt){tickCalls++;return originalTick.call(wa,dt);};
      for(let i=0;i<300;i++){
        window.APEX_ARSENAL.step(1/60);
        if(i===35){
          const observed=projectiles.find(p=>p.aq&&p.weapon===${JSON.stringify(id)});
          if(observed){
            const was=observed.age;
            originalTick.call(wa,1/60);
            earlyManualProbe={before:was,after:observed.age,
              x:observed.x,type:observed.type,
              tickBody:originalTick.toString().slice(0,110)};
          }
        }
        if(i%2===0)draw();
        for(const x of projectiles)if(x.aq&&x.weapon===${JSON.stringify(id)})used.add(x.kind);
        if(i===18||i===35||i===80||i===160){
          const h=wa.getHolder(a);
          states.push({time:+(i/60).toFixed(2),phase:h?.phase||null,
            weapon:h?.weaponId||null,atk:a.hp,def:b.hp,
            projectileCount:projectiles.filter(p=>p.aq).length,
            projectile:projectiles.filter(p=>p.aq&&p.weapon===${JSON.stringify(id)})
              .map(p=>({type:p.type,aq:p.aq,kind:p.kind,x:+p.x.toFixed(2),y:+p.y.toFixed(2),
                vx:+p.vx.toFixed(2),vy:+p.vy.toFixed(2),angle:+p.angle.toFixed(3),
                life:+p.life.toFixed(2),age:p.age,hr:p.__hr||null,ownerId:p.owner?.id})),
            position:{x:a.x,y:a.y,tx:b.x,ty:b.y},
            state:{active:st.active,over:st.over,gameState,simTime:st.time,quest:st.questMultiActor},ids:{a:a.id,b:b.id},rework:window.APEX_HERO_REWORK?.resolveEnemyBody?.(a,b)?.id||null
            });
        }
      }
      const probe=projectiles.find(p=>p.aq&&p.weapon===${JSON.stringify(id)});
      const manualBefore=probe?.age??null;
      if(probe)originalTick.call(wa,1/60);
      const manualAfter=probe?.age??null;
      wa.updateArsenalProjectiles=originalTick;
      const events=window.APEX_ARSENAL.events;
      return {id:${JSON.stringify(id)},started,permitted,tickCalls,manualBefore,manualAfter,earlyManualProbe,
        p1:a.name,p2:b.name,damage:1000-b.hp,
        kinds:[...used],pickup:events.filter(e=>e.includes('PICKUP')
          &&e.includes('weapon='+${JSON.stringify(id)})).length,
        fire:events.filter(e=>e.includes(' USE ')
          &&e.includes('weapon='+${JSON.stringify(id)})).length,
        states};
    })()`);
    productCases.push(q);
    check('CORE-SIX-PUBLIC-'+id+'-pickup-shot-damage',
      q.started===true&&q.p1==='ROBOT'&&q.p2==='ROBOT'
      &&q.pickup===1&&q.fire===1&&q.kinds.length>0&&q.damage>0,q);
  }
  await writeFile(join(out,'v43-browser-real-pickup.json'),JSON.stringify({base,results,productCases},null,2));
  const capture=await cd('Page.captureScreenshot',{format:'png'});
  await writeFile(join(out,'v43-browser-last-weapon.png'),Buffer.from(capture.data,'base64'));
  console.log('PASS REAL-V43-CHROME EIGHT REAL FLOOR PICKUPS AND DRAWN PROJECTILES');
}catch(e){console.error('FAIL REAL-V43-CHROME',e.stack||e);process.exitCode=1;}
finally{try{ws?.close();}catch{}chrome.kill();}
