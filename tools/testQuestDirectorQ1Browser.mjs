// Q1 — physically navigate Home → WAKE director → explicit CP04 preview → Home.
// Exercise desktop click and mobile touch, storage, reload and isolated combat.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const isMobile=process.argv.includes('--mobile');
const appUrl=process.env.APEX_APP_URL||'http://127.0.0.1:5173';
const endpoint=process.env.APEX_CDP_ENDPOINT||'http://127.0.0.1:9231';
const chromePath=process.env.CHROME_PATH||'google-chrome';
const evidenceDir=process.env.APEX_EVIDENCE_DIR||'/tmp/quest-q1-browser';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const chrome=process.env.APEX_CDP_ENDPOINT?null:spawn(chromePath,[
  '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
  '--no-sandbox','--remote-debugging-port=9231',isMobile?'--window-size=390,844':'--window-size=1365,768',
  '--user-data-dir='+path.join('/tmp',isMobile?'apex-quest-q1-mobile':'apex-quest-q1-cdp'),
  appUrl],{stdio:'ignore'});
let socket;
let serial=0;const pending=new Map();const gates=[], failures=[];
const gate=(label,pass,data)=>{
  gates.push({label,pass:!!pass,data});
  if(!pass)failures.push(label);
  console.log((pass?'PASS':'FAIL')+' '+label+' '+JSON.stringify(data));
};
async function connect(){
  let target;
  for(let i=0;i<120;i++){
    try{const arr=await fetch(endpoint+'/json/list').then(r=>r.json());
      target=arr.find(t=>t.type==='page');
      if(target)break;
    }catch(_){}
    await sleep(250);
  }
  if(!target)throw new Error('Chrome page endpoint unavailable');
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    socket.addEventListener('open',resolve,{once:true});
    socket.addEventListener('error',reject,{once:true});
  });
  socket.addEventListener('message',({data})=>{
    const msg=JSON.parse(data);
    if(!msg.id||!pending.has(msg.id))return;
    const p=pending.get(msg.id);pending.delete(msg.id);
    if(msg.error)p.reject(new Error(msg.error.message));
    else p.resolve(msg.result);
  });
}
function cmd(method,params={}){
  const id=++serial;
  socket.send(JSON.stringify({id,method,params}));
  return new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));
}
async function evalPage(expression){
  const v=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
  if(v.exceptionDetails)throw new Error(v.exceptionDetails.exception?.description||v.exceptionDetails.text);
  return v.result.value;
}
async function poll(expression,predicate,attempts=240){
  let last;
  for(let i=0;i<attempts;i++){
    last=await evalPage(expression);
    if(predicate(last))return last;
    await sleep(125);
  }
  return last;
}
async function click(selector){
  const probe=JSON.stringify(selector);
  let p=await poll(`(()=>{
    const e=document.querySelector(${probe});
    if(!e)return {exists:false};
    const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
    const top=document.elementFromPoint(x,y);
    return {exists:true,x,y,w:r.width,h:r.height,enabled:!e.disabled,
      hit:top===e||e.contains(top),vis:getComputedStyle(e).visibility};
  })()`,v=>v?.exists&&v.hit&&v.enabled&&v.w>10&&v.h>10,90);
  if(!p?.hit||!p.enabled||p.w<10)throw new Error('Click target not physically hittable: '+selector+' '+JSON.stringify(p));
  if(isMobile){
    await cmd('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});
    await cmd('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
    await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});
    await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});
    await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});
  }
  return p;
}
async function image(name){
  const r=await cmd('Page.captureScreenshot',{format:'png'});
  await writeFile(path.join(evidenceDir,name+(isMobile?'-mobile':'')+'.png'),Buffer.from(r.data,'base64'));
}
async function pressEscape(){
  await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
}
try{
  await mkdir(evidenceDir,{recursive:true});
  await connect();
  await cmd('Runtime.enable');await cmd('Page.enable');
  if(isMobile){
    await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true,
      screenOrientation:{type:'portraitPrimary',angle:0}});
    await cmd('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  }
  await cmd('Page.navigate',{url:appUrl});
  const boot=await poll(`(()=>({
    start:!!document.getElementById('apex-boot-start'),
    mounted:document.getElementById('gold-shell-host')?.dataset?.apexGoldMounted==='1',
    story:!!document.getElementById('continueStory')
  }))()`,v=>v?.start&&v.mounted&&v.story,320);
  gate('Home and START load',!!boot?.start&&boot.mounted&&boot.story,boot);
  if(!boot?.start)throw new Error('Boot START never ready');
  const pressed=await click('#apex-boot-start');
  gate('Physical START click',pressed.hit,pressed);
  const home=await poll(`(()=>({
    done:document.body.dataset.apexSceneTransition==='DONE',
    blackout:document.getElementById('apex-boot-blackout')?.hidden===true,
    story:!!document.getElementById('continueStory')
  }))()`,v=>v?.done&&v.blackout&&v.story,320);
  gate('Home visible after door',home?.done&&home?.blackout,home);
  await image('01-home-continue-story');
  const storyClick=await click('#continueStory');
  gate('Physical Continue Story click',storyClick.hit,storyClick);
  const wake=await poll(`(()=>({
    visible:document.getElementById('apexQuest01Stage')?.hidden===false,
    node:document.getElementById('apexQuest01Stage')?.dataset?.node,
    persisted:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,
    live:window.APEX_ARSENAL?.state?.questFirstWake===true,
    preview:!!document.getElementById('q1Preview'),
    noPublicAdvance:!window.APEX_QUEST01_DIRECTOR?.advance&&!window.APEX_QUEST01_DIRECTOR?.setCheckpoint
  }))()`,v=>v?.visible&&v?.node==='WAKE',100);
  gate('Continue Story opens actual WAKE checkpoint instead of E02',wake?.visible&&wake?.node==='WAKE'&&wake?.persisted==='WAKE'&&!wake?.live,wake);
  gate('Unfinished scenes cannot be marked complete from public API',wake?.noPublicAdvance===true&&wake?.preview===true,wake);
  await image('02-waKe-checkpoint');
  await pressEscape();
  const escaped=await poll(`(()=>({
    hidden:document.getElementById('apexQuest01Stage')?.hidden===true,
    checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId
  }))()`,v=>v?.hidden,80);
  gate('ESC closes Quest scene without changing checkpoint',escaped?.hidden&&escaped?.checkpoint==='WAKE',escaped);
  await click('#continueStory');
  const reopened=await poll(`(()=>({
    visible:document.getElementById('apexQuest01Stage')?.hidden===false,
    checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId
  }))()`,v=>v?.visible,80);
  gate('Continue Story resumes the same checkpoint',reopened?.visible&&reopened?.checkpoint==='WAKE',reopened);
  const previewClick=await click('#q1Preview');
  gate('Explicit CP04 preview is physically clickable',previewClick.hit,previewClick);
  const result=await poll(`(()=>({
    live:window.APEX_ARSENAL?.state?.questFirstWake===true,
    actors:(window.fighters||[]).map(f=>({id:f.questId,team:f.questTeam,hp:f.maxHp})),
    open:document.getElementById('battleHudHost')?.classList.contains('is-open')===true,
    canvas:document.getElementById('game-canvas')?.isConnected===true,
    devFlag:window.__APEX_QUEST_DEV===true
  }))()`,v=>v?.live&&v?.open&&v.actors?.length===4,420);
  gate('Preview still launches four REAL Quest Fighters',result?.live&&result?.actors?.length===4&&result?.open,result);
  gate('FIRST WAKE real team composition intact',JSON.stringify(result?.actors)===JSON.stringify([
    {id:'NEWBOT',team:'ALLY',hp:1000},
    {id:'SCRAP-A',team:'HOSTILE',hp:350},
    {id:'T.O.T',team:'ALLY',hp:1000},
    {id:'SCRAP-B',team:'HOSTILE',hp:350}]),result?.actors);
  gate('Dev override does not remain enabled',result?.devFlag===false,{devFlag:result?.devFlag});
  await image('03-cp04-preview-four-fighters');
  await pressEscape();
  const after=await poll(`(()=>({
    battleOpen:document.getElementById('battleHudHost')?.classList.contains('is-open')===true,
    checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,
    state:window.gameState
  }))()`,v=>!v?.battleOpen&&v?.state!=='ARSENAL',150);
  gate('Exiting CP04 preview does NOT advance story checkpoint',!after?.battleOpen&&after?.checkpoint==='WAKE',after);
  await image('04-return-home');
  await cmd('Page.navigate',{url:appUrl});
  const bootAgain=await poll(`(()=>({
    start:!!document.getElementById('apex-boot-start'),
    mounted:document.getElementById('gold-shell-host')?.dataset?.apexGoldMounted==='1'
  }))()`,v=>v?.start&&v?.mounted,320);
  gate('Page reload restores START / Home',!!bootAgain?.start&&bootAgain?.mounted,bootAgain);
  await click('#apex-boot-start');
  await poll(`(()=>({done:document.body.dataset.apexSceneTransition==='DONE',blackout:document.getElementById('apex-boot-blackout')?.hidden===true}))()`,v=>v?.done&&v?.blackout,320);
  await click('#continueStory');
  const restored=await poll(`(()=>({
    visible:document.getElementById('apexQuest01Stage')?.hidden===false,
    node:document.getElementById('apexQuest01Stage')?.dataset?.node,
    checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId
  }))()`,v=>v?.visible,100);
  gate('Reloaded Continue Story resumes actual WAKE, not completed preview',restored?.node==='WAKE'&&restored?.checkpoint==='WAKE',restored);
  await image('05-reload-resumes-WAKE');
}catch(err){
  gate('Browser route execution',false,{error:String(err.stack||err)});
}finally{
  await writeFile(path.join(evidenceDir,'quest-q1-director-browser-report'+(isMobile?'-mobile':'')+'.json'),JSON.stringify({gates,failures},null,2));
  try{socket?.close();}catch(_){}
  chrome?.kill();
}
if(failures.length)process.exitCode=1;
