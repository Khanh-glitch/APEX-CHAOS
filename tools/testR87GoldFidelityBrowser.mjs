// R77 Home layout browser regression. Uses actual Blink layout/hit testing at
// CSS-pixel portrait viewports; does not claim to emulate Android browser chrome.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { openSync, readFileSync } from 'node:fs';

const url=process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const chromePath=process.env.CHROME_PATH;
if(!chromePath)throw new Error('CHROME_PATH not set');
const port=9317;
const chromeLogFile='/tmp/r87-gold-chrome.log';
const chromeLogFd=openSync(chromeLogFile,'w');
const chrome=spawn(chromePath,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--remote-allow-origins=*','--no-first-run',
  '--remote-debugging-port='+port,'--user-data-dir=/tmp/apex-r87-gold-lab-cdp-'+process.pid,
  'about:blank',
],{stdio:['ignore',chromeLogFd,chromeLogFd]});
let socket;
const pending=new Map();
let serial=0;
const command=(method,params={})=>{
  const id=++serial;
  socket.send(JSON.stringify({id,method,params}));
  return new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));
};
const evalJS=async expression=>{
  const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw new Error(r.exceptionDetails.text||'Browser evaluation failed');
  return r.result?.value;
};
try{
  let target;
  for(let i=0;i<450;i++){
    try{
      const pages=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());
      target=pages.find(x=>x.type==='page');
      if(target)break;
    }catch{}
    await sleep(100);
  }
  if(!target)throw new Error('Chrome CDP page unavailable; exit='+chrome.exitCode+'; chrome log:\n'+readFileSync(chromeLogFile,'utf8').slice(-4000));
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    socket.addEventListener('open',resolve,{once:true});
    socket.addEventListener('error',reject,{once:true});
  });
  socket.addEventListener('message',e=>{
    const data=JSON.parse(e.data);if(!pending.has(data.id))return;
    const p=pending.get(data.id);pending.delete(data.id);
    data.error?p.reject(new Error(data.error.message)):p.resolve(data.result);
  });
  await command('Page.enable');
  await command('Runtime.enable');
  const dir='docs/acceptance/r87-gold-fidelity';
  await mkdir(dir,{recursive:true});
  const states={},failures=[];
  const test=(name,ok,details={})=>{
    console.log((ok?'PASS':'FAIL')+' R87 '+name+' '+JSON.stringify(details));
    if(!ok)failures.push({name,details});
  };
  const wait=async expr=>{
    for(let i=0;i<450;i++){
      if(await evalJS(expr).catch(()=>false))return true;
      await sleep(100);
    }
    return false;
  };
  const sizes=[
    {w:550,h:857,label:'design-550x857'},
    {w:330,h:514,label:'same-aspect-330x514'},
    {w:361,h:545,label:'owner-361x545'},
    {w:280,h:430,label:'ultra-small-280x430'}
  ];
  const rects=(doc)=>{
    const rect=sel=>{
      const el=doc.querySelector(sel);if(!el)return null;
      const b=el.getBoundingClientRect();
      return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom};
    };
    return {story:rect('#stage .story'),title:rect('#stage .storyTitle'),
      actions:rect('#stage .actions'),free:rect('#freeBattle'),
      routes:rect('#stage .routes'),
      modeBot:rect('.modeCard[data-mode="bot"]'),
      modeLocal:rect('.modeCard[data-mode="local1v1"]'),
      pickDeck:rect('.selectionDeckV6'),
      fighter:rect('.worldHeroSlot.p1'),
      card:rect('#fighterRoster .rosterCard:not(.is-locked)'),
      lock:rect('#lockIn'),
      arena:rect('#battleHudHost #arena'),
      p1:rect('#battleHudHost #p1Side'),
      p2:rect('#battleHudHost #p2Side')};
  };
  const capture=async label=>{
    await sleep(420);
    const d=await evalJS("("+rects.toString()+")(window.__apexGoldFidelity?window.__apexGoldFidelity.child().document:document)");
    const screenshot=await command('Page.captureScreenshot',{format:'png',fromSurface:true});
    await writeFile(dir+'/'+label+'.png',Buffer.from(screenshot.data,'base64'));
    console.log('R87 SNAP '+label+' '+JSON.stringify(d));
    return d;
  };
  const commandClick=async selector=>{
    const point=await evalJS("(()=>{const isLab=!!window.__apexGoldFidelity;const d=isLab?window.__apexGoldFidelity.child().document:document;const el=d.querySelector("+JSON.stringify(selector)+");const b=el?.getBoundingClientRect();if(!b)return null;if(!isLab)return{x:b.x+b.width/2,y:b.y+b.height/2};const f=document.getElementById('gold-document').getBoundingClientRect();const scale=f.width/550;return{x:f.x+(b.x+b.width/2)*scale,y:f.y+(b.y+b.height/2)*scale}})()");
    if(!point)throw Error('R87 missing interactive '+selector);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:point.x,y:point.y});
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:point.x,y:point.y});
  };
  const ready=(expr)=>"(()=>{const c=window.__apexGoldFidelity?.child()||window;try{return Boolean("+expr+")}catch{return false}})()";
  // Ground the baseline in a normal, non-iframe Gold document at its design
  // size before comparing the same DOM inside the virtual viewport.
  await command('Emulation.setDeviceMetricsOverride',{width:550,height:857,
    deviceScaleFactor:2,mobile:true,screenWidth:550,screenHeight:857});
  await command('Page.navigate',{url});
  if(!(await wait("!!document.querySelector('#gold-shell-host #stage')&&!!document.getElementById('apex-boot-start')")))throw Error('gold baseline failed to mount');
  await commandClick('#apex-boot-start');
  if(!(await wait("document.body?.dataset?.apexSceneTransition==='DONE'")))throw Error('baseline did not unlock Home');
  const baseline=await capture('direct-Gold-550x857-Home');
  test('baseline must have complete Gold geometry',Boolean(baseline.story&&baseline.actions&&baseline.routes));
  const near=(a,b,t=.8)=>Boolean(a&&b&&['x','y','w','h'].every(k=>Math.abs(a[k]-b[k])<=t));
  for(const v of sizes){
    await command('Emulation.setDeviceMetricsOverride',{width:v.w,height:v.h,
      deviceScaleFactor:2,mobile:true,screenWidth:v.w,screenHeight:v.h});
    const u=new URL('/gold-fidelity-lab.html',url);
    await command('Page.navigate',{url:u.href});
    if(!(await wait("Boolean(window.__apexGoldFidelity?.child()?.document.querySelector('#stage')&&window.__apexGoldFidelity.child().document.querySelector('#apex-boot-start'))")))throw Error('R87 nested Gold boot failed at '+v.label);
    const meta=await evalJS('window.__apexGoldFidelity.snapshot()');
    test(v.label+' child layout viewport is exactly 550x857',
      meta.child.width===550&&meta.child.height===857,meta);
    const predicted=Math.min(v.w/550,v.h/857);
    test(v.label+' composite scale preserves aspect',
      Math.abs(meta.scale-predicted)<.00001&&
      Math.abs(meta.scaledWidth/meta.scaledHeight-550/857)<.00001,meta);
    await commandClick('#apex-boot-start');
    if(!(await wait(ready("c.document.body?.dataset?.apexSceneTransition==='DONE'"))))throw Error('virtual Home did not open '+v.label);
    const home=await capture(v.label+'-home');
    for(const key of ['story','title','actions','free','routes']){
      test(v.label+' home '+key+' is DESIGN-COORDINATE IDENTICAL',
        near(baseline[key],home[key]),{baseline:baseline[key],actual:home[key]});
    }
    await commandClick('#freeBattle');
    if(!(await wait(ready("c.document.querySelector('#stage')?.classList.contains('screen-mode')"))))throw Error('virtual Mode unavailable '+v.label);
    const mode=await capture(v.label+'-mode');
    test(v.label+' Mode keeps 550px design-space cards',
      mode.modeLocal?.w>400&&mode.modeBot?.w>400,{mode});
    await commandClick('.modeCard[data-mode="local1v1"]');
    if(!(await wait(ready("c.document.querySelector('#stage')?.classList.contains('screen-fighter')&&c.document.querySelectorAll('#fighterRoster .rosterCard').length>=6"))))throw Error('virtual Fighter Pick unavailable '+v.label);
    const pick=await capture(v.label+'-pick');
    test(v.label+' six Fighter cards retain ORIGINAL Gold size',
      pick.card?.h>=55&&pick.card?.h<=58&&pick.fighter?.w>275,
      {card:pick.card,fighter:pick.fighter});
    await commandClick('.rosterCard[data-hero="newbot"]');
    await sleep(250);
    await commandClick('#lockIn');
    if(!(await wait(ready("c.document.querySelector('#stage')?.classList.contains('fighter-active-p2')"))))throw Error('virtual P2 handoff failed '+v.label);
    await commandClick('.rosterCard[data-hero="newbot"]');
    await sleep(250);
    await commandClick('#lockIn');
    if(!(await wait(ready("c.document.body.classList.contains('battle-hud-open')&&c.document.querySelector('#battleHudHost #arena')?.getBoundingClientRect().width>0"))))throw Error('virtual live battle failed '+v.label);
    const battle=await capture(v.label+'-battle');
    test(v.label+' live arena uses DESIGN coordinate system',
      battle.arena?.w>=520&&battle.arena?.w<545,{arena:battle.arena});
    await evalJS("(()=>{const c=window.__apexGoldFidelity.child();c.document.addEventListener('pointerdown',e=>c.__r87LastPointer={x:e.clientX,y:e.clientY,target:e.target.id},{capture:true,once:true})})()");
    await commandClick('#battleHudHost #arena');
    const evt=await evalJS("window.__apexGoldFidelity.child().__r87LastPointer");
    test(v.label+' real pointer transformed into DESIGN coordinates',
      Boolean(evt&&evt.x>=0&&evt.x<=550&&evt.y>=0&&evt.y<=857),
      {event:evt,battleArena:battle.arena});
    states[v.label]={viewport:v,meta,home,mode,pick,battle,pointer:evt};
    console.log('R87 CASE '+v.label+' '+JSON.stringify({
      scale:meta.scale,child:meta.child,
      GoldStoryTop:home.story?.y,GoldCTA:home.actions?.y,
      GoldenCardHeight:pick.card?.h,
      GoldenArenaWidth:battle.arena?.w,pointer:evt}));
  }
  await writeFile(dir+'/report.json',JSON.stringify({design:{width:550,height:857},baseline,states,failures},null,2));
  console.log('R87 FINAL '+JSON.stringify({cases:sizes.length,failures:failures.length}));
  if(failures.length)throw Error('R87 virtual Gold fidelity failed '+failures.length+' checks');
}finally{
  try{socket?.close()}catch{}
  chrome.kill('SIGTERM');
}
