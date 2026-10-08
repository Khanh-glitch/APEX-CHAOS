// CP04 — real Chrome entry contract. The player must be able to open the
// actual FIRST WAKE 2v2 by tapping Home > CONTINUE STORY; no DevTools required.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const isMobile=process.argv.includes('--mobile');
const appUrl=process.env.APEX_APP_URL||'http://127.0.0.1:5173';
const endpoint=process.env.APEX_CDP_ENDPOINT||'http://127.0.0.1:9231';
const chromePath=process.env.CHROME_PATH||'google-chrome';
const evidenceDir=process.env.APEX_EVIDENCE_DIR||'/tmp/quest-cp04-browser';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const chrome=process.env.APEX_CDP_ENDPOINT?null:spawn(chromePath,[
  '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
  '--no-sandbox','--remote-debugging-port=9231',isMobile?'--window-size=390,844':'--window-size=1365,768',
  '--user-data-dir='+path.join('/tmp',isMobile?'apex-quest-cp04-mobile':'apex-quest-cp04-cdp'),
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
  const result=await poll(`(()=>({
    live:window.APEX_ARSENAL?.state?.questFirstWake===true,
    actors:(window.fighters||[]).map(f=>({id:f.questId,team:f.questTeam,hp:f.maxHp})),
    open:document.getElementById('battleHudHost')?.classList.contains('is-open')===true,
    canvas:document.getElementById('game-canvas')?.isConnected===true,
    devFlag:window.__APEX_QUEST_DEV===true
  }))()`,v=>v?.live&&v?.open&&v.actors?.length===4,420);
  gate('Continue Story launches four actual Quest Fighters',
    result?.live&&result?.actors?.length===4&&result?.open,result);
  gate('Expected FIRST WAKE teams and HP',JSON.stringify(result?.actors)===JSON.stringify([
    {id:'NEWBOT',team:'ALLY',hp:1000},
    {id:'SCRAP-A',team:'HOSTILE',hp:350},
    {id:'T.O.T',team:'ALLY',hp:1000},
    {id:'SCRAP-B',team:'HOSTILE',hp:350}]),result?.actors);
  gate('Dev override is not left open',result?.devFlag===false,{devFlag:result?.devFlag});
  await image('02-first-wake-four-fighters');
  await pressEscape();
  const homeAfter=await poll(`(()=>({
    stage:document.getElementById('stage')?.classList.contains('screen-mode')===false
      && document.getElementById('stage')?.classList.contains('screen-fighter')===false,
    battleOpen:document.getElementById('battleHudHost')?.classList.contains('is-open')===true,
    mounted:!!document.getElementById('continueStory'),
    state:window.gameState
  }))()`,v=>v?.stage&&!v.battleOpen&&v.mounted&&v.state!=='ARSENAL',150);
  gate('ESC exits Quest back to Home without residual battle',!!homeAfter?.stage&&!homeAfter?.battleOpen&&homeAfter?.state!=='ARSENAL',homeAfter);
  await image('03-return-home');
}catch(err){
  gate('Browser route execution',false,{error:String(err.stack||err)});
}finally{
  await writeFile(path.join(evidenceDir,'quest-continue-story-browser-report'+(isMobile?'-mobile':'')+'.json'),JSON.stringify({gates,failures},null,2));
  try{socket?.close();}catch(_){}
  chrome?.kill();
}
if(failures.length)process.exitCode=1;
