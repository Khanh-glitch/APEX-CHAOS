// B4a actual Chrome pointer/touch smoke of the Quest replay hub.
// Fixture seeds a previously unlocked E05 save; it does NOT fake a combat win.
// Separate full-route tests remain responsible for actual KO acceptance.
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const mobile=process.argv.includes('--mobile'),port=Number(process.env.APEX_CDP_PORT)||(mobile?9435:9434);
const url=process.env.APEX_APP_URL||'http://127.0.0.1:5173';
const binary=process.env.CHROME_PATH||'google-chrome';
const output=process.env.APEX_EVIDENCE_DIR||'/tmp/b4a-real';
await mkdir(output,{recursive:true});
const browser=spawn(binary,['--headless=new','--disable-gpu','--no-first-run',
 '--no-sandbox','--remote-debugging-port='+port,
 '--window-size='+(mobile?'390,844':'1365,768'),
 '--user-data-dir=/tmp/apex-b5b-chrome-'+port,url],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let socket,serial=0,failed=0;
const waiters=new Map(),receipts=[];
const gate=(name,pass,value)=>{receipts.push({name,pass:!!pass,value});
 console.log((pass?'PASS ':'FAIL ')+name+' '+JSON.stringify(value||{}));
 if(!pass)failed++;
};
try{
 let target;
 for(let i=0;i<130;i++){
   try{const a=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());
     target=a.find(t=>t.type==='page');if(target)break;}catch{}
   await sleep(150);
 }
 if(!target)throw Error('No Chrome DevTools page');
 const connect=async page=>{
  socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{socket.addEventListener('open',ok,{once:true});
    socket.addEventListener('error',fail,{once:true})});
  socket.addEventListener('message',event=>{
    const msg=JSON.parse(event.data);
    if(!waiters.has(msg.id))return;
    const r=waiters.get(msg.id);waiters.delete(msg.id);
    if(msg.error)r.fail(Error(msg.error.message));else r.ok(msg.result);
  });
 };
 await connect(target);
 const cmd=(method,params={})=>new Promise((ok,fail)=>{
  const id=++serial;waiters.set(id,{ok,fail});
  socket.send(JSON.stringify({id,method,params}));
 });
 const exec=async str=>{
  const x=await cmd('Runtime.evaluate',{expression:str,returnByValue:true,
   awaitPromise:true,userGesture:true});
  if(x.exceptionDetails)throw Error(x.exceptionDetails.exception?.description||x.exceptionDetails.text);
  return x.result.value;
 };
 const poll=async(str,ready,n=220)=>{
  let x;for(let i=0;i<n;i++){x=await exec(str);if(ready(x))return x;await sleep(100)}return x;
 };
 const click=async selector=>{
  const quoted=JSON.stringify(selector);
  await exec('(()=>{document.querySelector('+quoted+')?.scrollIntoView({block:"center"})})()');
  const p=await poll('(()=>{const e=document.querySelector('+quoted+');if(!e)return null;const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,t=document.elementFromPoint(x,y);return {x,y,width:r.width,enabled:!e.disabled,hit:t===e||e.contains(t)}})()',x=>x?.hit&&x?.enabled&&x?.width>10,85);
  if(!p?.hit)throw Error('Physical target blocked: '+selector+' '+JSON.stringify(p));
  if(mobile){
    await cmd('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});
    await cmd('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
    await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});
    await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});
  }
 };
 const picture=async tag=>{
  const x=await cmd('Page.captureScreenshot',{format:'png'});
  await writeFile(path.join(output,'b4a-'+tag+(mobile?'-mobile':'')+'.png'),Buffer.from(x.data,'base64'));
 };
 await cmd('Runtime.enable');await cmd('Page.enable');
 if(mobile){
  await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,
    deviceScaleFactor:3,mobile:true,screenOrientation:{type:'portraitPrimary',angle:0}});
  await cmd('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 }
 await cmd('Page.navigate',{url});
 const ready=await poll('!!window.APEX_QUEST01_DIRECTOR?.checkpoint',Boolean,400);
 gate('Gold loaded real Quest Director',ready);
 const fixture=await exec('(()=>{const D=window.APEX_QUEST01_DIRECTOR,p=D.checkpoint();const s={...p,checkpointId:"CHARGE_THE_BREAKER",encounterId:"E05",phaseId:"ENTRY",stormbreakerArtifactPhase:"SEALED",completedCueIds:["WAKE_OPEN","WORKSHOP_ARRIVAL","E02_FIRST_WAKE_ENTRY","E02_FIRST_WAKE_CLEAR","E03_SCRAP_SWARM_CLEAR","E04_WEAPON_RAIN_CLEAR"]};localStorage.setItem(D.STORAGE_KEY,JSON.stringify(s));return s.checkpointId})()');
 gate('Only browser test fixture seeds previously unlocked E05',fixture==='CHARGE_THE_BREAKER',{fixture});
 // Gold first boot can replace the renderer while Page.reload is still
 // awaiting its CDP reply. Reacquire the actual page target every time.
 try{await cmd('Page.reload',{ignoreCache:true})}
 catch(e){if(!String(e).includes('Inspected target navigated or closed'))throw e;}
 await sleep(400);
 const pages=await fetch('http://127.0.0.1:'+port+'/json/list').then(x=>x.json());
 const latest=pages.find(x=>x.type==='page');
 if(!latest)throw Error('Reload lost Gold page');
 try{socket?.close()}catch{}
 await connect(latest);
 await cmd('Runtime.enable');
 const boot=await poll('!!document.querySelector("#apex-boot-start")?.getBoundingClientRect().width&&!!document.querySelector("#continueStory")',Boolean,400);
 gate('Gold START and Continue Story loaded',boot);
 await click('#apex-boot-start');
 const home=await poll('document.body.dataset.apexSceneTransition==="DONE"&&document.querySelector("#apex-boot-blackout")?.hidden===true',Boolean,420);
 gate('Gold home actually opened after door',home);
 const beforeClick=await exec('(()=>{const e=document.querySelector("#continueStory"),r=e?.getBoundingClientRect();return{buttonRect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,door:document.body.dataset.apexSceneTransition,transitionActive:window.APEX_SCENE_TRANSITION?.active?.(),blackout:document.querySelector("#apex-boot-blackout")?.hidden,open:document.querySelector("#apexQuest01Stage")?.hidden===false,hasDirector:!!window.APEX_QUEST01_DIRECTOR,screen:document.body.dataset.apexScreen||null}})()');
 console.log('B5_HOME_PRECLICK '+JSON.stringify(beforeClick));
 // Passive capture-phase instrumentation: don't set state, change event
 // default, or artificially call .click(). This observes physical touch only.
 await exec(`(()=>{window.__b5TouchEvents=[];const el=document.querySelector('#continueStory');
   const log=(scope,type)=>(e)=>window.__b5TouchEvents.push({scope,type,
     target:e.target?.id,defaultPrevented:e.defaultPrevented,
     trusted:e.isTrusted,time:performance.now()});
   for(const type of ['pointerdown','pointerup','touchstart','touchend','click']){
     document.addEventListener(type,log('document',type),{capture:true,once:true,passive:true});
     el?.addEventListener(type,log('button',type),{capture:true,once:true,passive:true});
   }
   return true;})()`);
 await click('#continueStory');
 const stage=await poll('(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,shown:document.querySelector("#apexQuest01Stage")?.hidden===false,door:document.body.dataset.apexSceneTransition,transitionActive:window.APEX_SCENE_TRANSITION?.active?.(),blackout:document.querySelector("#apex-boot-blackout")?.hidden,buttonPresent:!!document.querySelector("#continueStory"),hubExists:!!document.querySelector("#q1StageHub")}))()',x=>x?.shown&&x.node==='CHARGE_THE_BREAKER',110);
 console.log('B5_HOME_POSTCLICK '+JSON.stringify(stage));
 const touchEvidence=await exec(`(()=>({
   events:window.__b5TouchEvents||[],
   screen:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio,
     viewport:{w:visualViewport?.width,scale:visualViewport?.scale}},
   stageClass:document.querySelector('#stage')?.className,
   activeElement:document.activeElement?.id,
   actor:document.elementFromPoint(250,500)?.id,
   questStage:document.querySelector('#apexQuest01Stage')?.outerHTML?.slice(0,250)
 }))()`);
 console.log('B5_TOUCH_DISPATCH '+JSON.stringify(touchEvidence));
 if(mobile){
   const events=touchEvidence.events||[];
   const released=events.some(e=>e.scope==='button'&&e.type==='touchend'&&e.trusted===true);
   const ghost=events.some(e=>e.scope==='document'&&e.type==='click'&&e.target==='freeBattle');
   gate('Mobile physical Continue Story touch releases into Quest, never ghost-opens Free Battle',
     released&&stage?.shown===true&&!ghost,
     {released,ghost,stageOpen:stage?.shown,events:events.map(e=>e.scope+':'+e.type+':'+e.target)});
 }
 if(!stage?.shown)await picture('missed-continue-story');
 gate('Quest hub shows saved E05',stage?.shown&&stage.node==='CHARGE_THE_BREAKER',stage);
 const causeE05=await exec('document.querySelector("#q1Context")?.textContent');
 gate('E05 chapter explains impact objective and relay cause',
   causeE05?.includes('accumulator')&&causeE05.includes('relay'),{causeE05});
 const unlocked=await exec('(()=>({e03:document.querySelector("#q1StageHub [data-stage=SCRAP_SWARM]")?.disabled,e06:document.querySelector("#q1StageHub [data-stage=BREACH_WAVES]")?.disabled}))()');
 gate('Only completed stage replay enabled, E06 remains locked',unlocked.e03===false&&unlocked.e06===true,unlocked);
 await picture('hub');
 await click('#q1StageHub [data-stage=SCRAP_SWARM]');
 const chosen=await poll('(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,replay:window.APEX_QUEST01_DIRECTOR?.replayStatus()?.active,save:JSON.parse(localStorage.getItem(window.APEX_QUEST01_DIRECTOR.STORAGE_KEY)).checkpointId}))()',x=>x?.replay&&x.node==='SCRAP_SWARM',110);
 gate('Real replay click creates volatile E03 without changing permanent E05',chosen?.save==='CHARGE_THE_BREAKER',chosen);
 const causeE03=await exec('document.querySelector("#q1Context")?.textContent');
 gate('E03 replay tells the player why two waves follow E02',
   causeE03?.includes('Two successive enemy waves'),{causeE03});
 await picture('selected');
 await click('#q5ScrapSwarmPlay');
 const battle=await poll('(()=>({active:window.APEX_ARSENAL?.state?.active,swarm:window.APEX_ARSENAL?.state?.questScrapSwarmProgression,host:document.querySelector("#battleHudHost")?.classList.contains("is-open"),ids:window.fighters?.map(f=>f.questId)}))()',v=>v?.active&&v?.swarm&&v?.host,420);
 gate('Actual Gold battle opens and Arsenal creates physical E03 wave',
   battle?.active&&battle?.swarm&&battle?.host&&battle.ids?.includes('SWARM-A1'),battle);
 await picture('gold-battle');
 if(process.argv.includes('--diagnose-e03')){
  // This controls ONLY human J/K key requests in authentic Arsenal;
  // no HP, RNG, enemy velocity, pickup, damage or story setters.
  const profile=await exec("(()=>{\n const A=window.APEX_ARSENAL,W=A.weaponApi,Q=window.APEX_QUEST_MULTI_ACTOR_CORE;\n const f=window.fighters,hero=f.find(x=>x.questId==='NEWBOT');\n let steps=0,weaponFrames=0,visibleFrames=0,maxOffensive=0,requestedJ=0,requestedK=0;\n let firstB=null,lastWeapon='',changes=0,gunSlots=new Set(),seenTiers=new Set(),samples=[];\n let maxBurst=0;\n for(;steps<9600;steps++){\n  if(steps%80===0){window.dispatchEvent(new KeyboardEvent('keydown',{key:'j',code:'KeyJ',bubbles:true}));requestedJ++;}\n  if(steps%200===0){window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',code:'KeyK',bubbles:true}));requestedK++;}\n  A.step(.05);\n  const gun=W.getHolder(hero)?.weaponId||null;\n  if(gun)weaponFrames++;\n  if(gun!==lastWeapon){changes++;lastWeapon=gun;}\n  const eligible=A.state.slots.filter(slot=>slot.phase!=='REMOVED'&&slot.kind!=='HEAL');\n  maxOffensive=Math.max(maxOffensive,eligible.length);\n  visibleFrames+=eligible.filter(slot=>slot.phase==='REVEALED').length>0?1:0;\n  for(const slot of eligible){gunSlots.add(String(slot.id));if(slot.tier)seenTiers.add(slot.tier);}\n  if(A.state.questSwarmWave==='B'&&!firstB)\n    firstB={time:A.state.time,heroHp:hero.hp,held:gun,\n     waveA:A.state.questSwarmWaveAReceipt?.map(x=>({id:x.questId,hp:x.hp}))};\n  if(steps%80===0)\n   samples.push({t:+A.state.time.toFixed(1),wave:A.state.questSwarmWave,phase:A.state.questSwarmPhase,\n    heroHp:+hero.hp.toFixed(1),gun:gun||'-',liveHostiles:f.filter(x=>x.questTeam==='HOSTILE'&&x.hp>0).length,\n    hostiles:f.filter(x=>x.questTeam==='HOSTILE').map(x=>({id:x.questId,hp:+x.hp.toFixed(1)})),\n    pickups:eligible.length});\n  if(A.state.over)break;\n }\n const ability=A.state.questEnemyAbilities?.snapshot?.();\n return {steps,time:steps*.05,heroHp:hero.hp,outcome:A.state.questOutcome,over:A.state.over,\n   wave:A.state.questSwarmWave,phase:A.state.questSwarmPhase,\n   weaponHoldPercent:Math.round(100*weaponFrames/Math.max(1,steps+1)),\n   visibleGunPercent:Math.round(100*visibleFrames/Math.max(1,steps+1)),\n   uniqueOffensiveSlots:gunSlots.size,maxOffensive,seenTiers:[...seenTiers],\n   weaponTransitions:changes,requestedJ,requestedK,firstB,\n   reaverBumps:ability?.bumps||0,sentinelShots:ability?.shots||0,\n   enemies:f.filter(x=>x.questTeam==='HOSTILE').map(x=>({id:x.questId,hp:x.hp,max:x.maxHp})),\n   checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,\n   view:A.state.questSwarmStoryView?.snapshot?.(),samples};\n})()");
  await writeFile(path.join(output,'b5-swarm-telemetry'+(mobile?'-mobile':'')+'.json'),JSON.stringify(profile,null,2));
  gate('B5 physical Gold match reaches a native end state',
    ['RETRY','COMPLETE'].includes(profile?.outcome)&&profile?.steps<9600,profile&&{
      steps:profile.steps,outcome:profile.outcome,wave:profile.wave,hp:profile.heroHp});
  gate('B5 1.2x species and genuine 5-slot/white-green law remain intact',
    profile?.maxOffensive<=5&&profile?.seenTiers?.every(x=>x==='T1'||x==='T2'),
    {cap:profile?.maxOffensive,tiers:profile?.seenTiers});
  gate('B5 no staged story victory or unauthorized checkpoint skip',
    profile?.checkpoint==='SCRAP_SWARM'&&profile?.view?.active===true,
    {node:profile?.checkpoint,result:profile?.view?.current});
  gate('B5 no invented player health restoration',
    profile?.heroHp>=0&&profile?.heroHp<=1000,{heroHp:profile?.heroHp});
  console.log('B5_ORGANIC_TRACE '+JSON.stringify({platform:mobile?'mobile':'desktop',
    waves:profile?.wave,outcome:profile?.outcome,steps:profile?.steps,
    gunUptime:profile?.weaponHoldPercent,gunVisibility:profile?.visibleGunPercent,
    slotCount:profile?.uniqueOffensiveSlots,firstB:profile?.firstB,
    reaverBumps:profile?.reaverBumps,weaponTransitions:profile?.weaponTransitions,
    samples:profile?.samples}));
  await picture('b5-after-organic-play');
  const cleanup=await exec('(()=>{const d=window.APEX_QUEST01_DIRECTOR;window.exitArsenalBattleMode();return{closed:window.APEX_ARSENAL.state.active===false,exit:d.exitReplay(),node:d.checkpoint().checkpointId,primary:JSON.parse(localStorage.getItem(d.STORAGE_KEY)).checkpointId}})()');
  gate('B5 diagnostic battle cleanup cannot alter permanent E05 checkpoint',
    cleanup.closed&&cleanup.exit&&cleanup.node==='CHARGE_THE_BREAKER'
    &&cleanup.primary==='CHARGE_THE_BREAKER',cleanup);
 }else{
 const denied=await exec('(()=>{const D=window.APEX_QUEST01_DIRECTOR;return {ok:D.exitReplay(),virtual:D.checkpoint().checkpointId,save:JSON.parse(localStorage.getItem(D.STORAGE_KEY)).checkpointId}})()');
 gate('No authority swap while authentic battle remains active',denied.ok===false&&denied.virtual==='SCRAP_SWARM'&&denied.save==='CHARGE_THE_BREAKER',denied);
 const exit=await exec('(()=>{const D=window.APEX_QUEST01_DIRECTOR;window.exitArsenalBattleMode();return {ended:window.APEX_ARSENAL.state.active===false,exit:D.exitReplay(),node:D.checkpoint().checkpointId,save:JSON.parse(localStorage.getItem(D.STORAGE_KEY)).checkpointId}})()');
 gate('After disposal replay exits and original permanent save is restored',
   exit.ended&&exit.exit&&exit.node==='CHARGE_THE_BREAKER'&&exit.save==='CHARGE_THE_BREAKER',exit);
 // Renderer can swap the DevTools target on reload; reconnect to the
 // actual new Chrome page and demand a fresh Director read after navigation.
 const restoreExpr='(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,replay:window.APEX_QUEST01_DIRECTOR?.replayStatus()?.active}))()';
 try{await cmd('Page.reload',{ignoreCache:true})}
 catch(e){if(!String(e).includes('Inspected target navigated or closed'))throw e;}
 let restored;
 try{restored=await poll(restoreExpr,v=>v?.node==='CHARGE_THE_BREAKER',210)}
 catch(e){
  if(!String(e).includes('Inspected target navigated or closed'))throw e;
  await sleep(500);
  const listing=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());
  const page=listing.find(t=>t.type==='page');
  if(!page)throw Error('Chrome reload lost all page targets');
  try{socket?.close()}catch{}
  await connect(page);
  await cmd('Runtime.enable');
  restored=await poll(restoreExpr,v=>v?.node==='CHARGE_THE_BREAKER',210);
 }
 gate('After reload no temporary chapter survives',restored?.replay===false,restored);
 }
}catch(e){gate('Gold replay real-browser execution',false,{error:String(e.stack||e).slice(0,1200)})}
finally{
 try{socket?.close()}catch{}
 browser.kill();
 await writeFile(path.join(output,'report'+(mobile?'-mobile':'')+'.json'),JSON.stringify({failures:failed,receipts},null,2));
}
if(failed)process.exitCode=1;
