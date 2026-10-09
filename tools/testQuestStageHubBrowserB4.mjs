// B4a actual Chrome pointer/touch smoke of the Quest replay hub.
// Fixture seeds a previously unlocked E05 save; it does NOT fake a combat win.
// Separate full-route tests remain responsible for actual KO acceptance.
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const mobile=process.argv.includes('--mobile'),port=mobile?9435:9434;
const url=process.env.APEX_APP_URL||'http://127.0.0.1:5173';
const binary=process.env.CHROME_PATH||'google-chrome';
const output=process.env.APEX_EVIDENCE_DIR||'/tmp/b4a-real';
await mkdir(output,{recursive:true});
const browser=spawn(binary,['--headless=new','--disable-gpu','--no-first-run',
 '--no-sandbox','--remote-debugging-port='+port,
 '--window-size='+(mobile?'390,844':'1365,768'),
 '--user-data-dir=/tmp/apex-b4a-chrome-'+(mobile?'mobile':'desktop'),url],{stdio:'ignore'});
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
 socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((ok,fail)=>{socket.addEventListener('open',ok,{once:true});
 socket.addEventListener('error',fail,{once:true})});
 socket.addEventListener('message',event=>{
  const msg=JSON.parse(event.data);
  if(!waiters.has(msg.id))return;
  const r=waiters.get(msg.id);waiters.delete(msg.id);
  if(msg.error)r.fail(Error(msg.error.message));else r.ok(msg.result);
 });
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
 await cmd('Page.reload',{ignoreCache:true});
 const boot=await poll('!!document.querySelector("#apex-boot-start")?.getBoundingClientRect().width&&!!document.querySelector("#continueStory")',Boolean,400);
 gate('Gold START and Continue Story loaded',boot);
 await click('#apex-boot-start');
 const home=await poll('document.body.dataset.apexSceneTransition==="DONE"&&document.querySelector("#apex-boot-blackout")?.hidden===true',Boolean,420);
 gate('Gold home actually opened after door',home);
 await click('#continueStory');
 const stage=await poll('(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,shown:document.querySelector("#apexQuest01Stage")?.hidden===false}))()',x=>x?.shown&&x.node==='CHARGE_THE_BREAKER',110);
 gate('Quest hub shows saved E05',stage?.shown&&stage.node==='CHARGE_THE_BREAKER',stage);
 const unlocked=await exec('(()=>({e03:document.querySelector("#q1StageHub [data-stage=SCRAP_SWARM]")?.disabled,e06:document.querySelector("#q1StageHub [data-stage=BREACH_WAVES]")?.disabled}))()');
 gate('Only completed stage replay enabled, E06 remains locked',unlocked.e03===false&&unlocked.e06===true,unlocked);
 await picture('hub');
 await click('#q1StageHub [data-stage=SCRAP_SWARM]');
 const chosen=await poll('(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,replay:window.APEX_QUEST01_DIRECTOR?.replayStatus()?.active,save:JSON.parse(localStorage.getItem(window.APEX_QUEST01_DIRECTOR.STORAGE_KEY)).checkpointId}))()',x=>x?.replay&&x.node==='SCRAP_SWARM',110);
 gate('Real replay click creates volatile E03 without changing permanent E05',chosen?.save==='CHARGE_THE_BREAKER',chosen);
 await picture('selected');
 await click('#q5ScrapSwarmPlay');
 const battle=await poll('(()=>({active:window.APEX_ARSENAL?.state?.active,swarm:window.APEX_ARSENAL?.state?.questScrapSwarmProgression,host:document.querySelector("#battleHudHost")?.classList.contains("is-open"),ids:window.fighters?.map(f=>f.questId)}))()',v=>v?.active&&v?.swarm&&v?.host,420);
 gate('Actual Gold battle opens and Arsenal creates physical E03 wave',
   battle?.active&&battle?.swarm&&battle?.host&&battle.ids?.includes('SWARM-A1'),battle);
 await picture('gold-battle');
 const denied=await exec('(()=>{const D=window.APEX_QUEST01_DIRECTOR;return {ok:D.exitReplay(),virtual:D.checkpoint().checkpointId,save:JSON.parse(localStorage.getItem(D.STORAGE_KEY)).checkpointId}})()');
 gate('No authority swap while authentic battle remains active',denied.ok===false&&denied.virtual==='SCRAP_SWARM'&&denied.save==='CHARGE_THE_BREAKER',denied);
 const exit=await exec('(()=>{const D=window.APEX_QUEST01_DIRECTOR;window.exitArsenalBattleMode();return {ended:window.APEX_ARSENAL.state.active===false,exit:D.exitReplay(),node:D.checkpoint().checkpointId,save:JSON.parse(localStorage.getItem(D.STORAGE_KEY)).checkpointId}})()');
 gate('After disposal replay exits and original permanent save is restored',
   exit.ended&&exit.exit&&exit.node==='CHARGE_THE_BREAKER'&&exit.save==='CHARGE_THE_BREAKER',exit);
 await cmd('Page.reload',{ignoreCache:true});
 const restored=await poll('(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,replay:window.APEX_QUEST01_DIRECTOR?.replayStatus()?.active}))()',v=>v?.node==='CHARGE_THE_BREAKER',210);
 gate('After reload no temporary chapter survives',restored?.replay===false,restored);
}catch(e){gate('Gold replay real-browser execution',false,{error:String(e.stack||e).slice(0,1200)})}
finally{
 try{socket?.close()}catch{}
 browser.kill();
 await writeFile(path.join(output,'report'+(mobile?'-mobile':'')+'.json'),JSON.stringify({failures:failed,receipts},null,2));
}
if(failed)process.exitCode=1;
