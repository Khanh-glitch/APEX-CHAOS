// R77 Home layout browser regression. Uses actual Blink layout/hit testing at
// CSS-pixel portrait viewports; does not claim to emulate Android browser chrome.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { openSync, readFileSync } from 'node:fs';

const url=process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const chromePath=process.env.CHROME_PATH;
if(!chromePath)throw new Error('CHROME_PATH not set');
const port=9246;
const chromeLogFile='/tmp/r82-chrome.log';
const chromeLogFd=openSync(chromeLogFile,'w');
const chrome=spawn(chromePath,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--remote-allow-origins=*','--no-first-run',
  '--remote-debugging-port='+port,'--user-data-dir=/tmp/apex-r82-layout-lab-cdp-'+process.pid,
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
  for(let i=0;i<120;i++){
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
  // Test the production Vite document, NOT standalone shell.html.
  await command('Page.navigate',{url});
  let homeMounted=false;
  for(let i=0;i<400;i++){
    const value=await evalJS("Boolean(document.querySelector('#gold-shell-host #stage') && document.getElementById('gold-shell-host')?.dataset.apexGoldMounted==='1' && document.querySelector('#apex-boot-start'))").catch(()=>false);
    if(value){homeMounted=true;break}
    await sleep(75);
  }
  if(!homeMounted)throw new Error('React-mounted Home/boot START unavailable');
  const startRect=await evalJS(`(() => {const r=document.querySelector('#apex-boot-start').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mousePressed',x:startRect.x,y:startRect.y,button:'left',clickCount:1});
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:startRect.x,y:startRect.y,button:'left',clickCount:1});
  let bootDone=false;
  for(let i=0;i<300;i++){
    bootDone=await evalJS("document.body?.dataset?.apexSceneTransition==='DONE'&&document.getElementById('apex-scene-transition')?.style?.display==='none'").catch(()=>false);
    if(bootDone)break;
    await sleep(75);
  }
  if(!bootDone)throw new Error('Real boot transition did not complete');

  // R82 LAB: measured in the real Vite+React mounted game, not donor shell.html.
  const { resolve } = await import('node:path');
  const outputDir='docs/acceptance/arsenal-product/browser/r82-layout-lab';
  await mkdir(outputDir,{recursive:true});
  const snap = () => {
    const rect=(sel)=>{
      const el=document.querySelector(sel);
      if(!el)return null;
      const r=el.getBoundingClientRect(),css=getComputedStyle(el);
      return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,font:css.fontSize,scale:css.scale};
    };
    const c=document.querySelector('#freeBattle');
    const b=c?.getBoundingClientRect();
    const hit=b?document.elementFromPoint(b.left+b.width/2,b.top+b.height/2):null;
    const sels={
      story:'.story',title:'.storyTitle',actions:'.actions',primary:'#freeBattle',
      secondary:'.actions .secondary',routes:'.routes',brand:'.brand',
      profile:'.profile',hero:'.heroWrap',
    };
    const rects=Object.fromEntries(Object.entries(sels).map(([name,sel])=>[name,rect(sel)]));
    return {w:innerWidth,h:innerHeight,lab:window.__apexHomeLayoutLab?.snapshot()??null,
      stageClass:document.querySelector('#stage')?.className,rects,
      hitBattle:Boolean(hit?.closest?.('#freeBattle')),
      hitStack:b?document.elementsFromPoint(b.left+b.width/2,b.top+b.height/2).slice(0,5).map(e=>e.id||e.className?.toString().slice(0,60)||e.tagName):[]};
  };
  const capture = async (label,w,h) => {
    await command('Emulation.setDeviceMetricsOverride',{width:w,height:h,
      deviceScaleFactor:2,mobile:true,screenWidth:w,screenHeight:h});
    await sleep(750);
    await evalJS('document.fonts.ready.then(()=>true)').catch(()=>false);
    const data=await evalJS('('+snap.toString()+')()');
    const screenshot=await command('Page.captureScreenshot',{format:'png',fromSurface:true});
    await writeFile(outputDir+'/'+label+'.png',Buffer.from(screenshot.data,'base64'));
    console.log('R82 GEOMETRY '+label+' '+JSON.stringify(data));
    if(!data.rects.story||!data.rects.primary||!data.rects.routes)throw Error(label+' missing DOM');
    if(!data.hitBattle)throw Error(label+' Free Battle visual center is not hittable: '+JSON.stringify(data.hitStack));
    return data;
  };
  const native={};
  native.ref=await capture('native-550x857',550,857);
  native.small=await capture('native-360x560',360,560);
  native.outband=await capture('native-390x844',390,844);
  const labUrl=new URL(url);labUrl.searchParams.set('apexLayoutLab','home');
  await command('Emulation.setDeviceMetricsOverride',{width:550,height:857,
    deviceScaleFactor:2,mobile:true,screenWidth:550,screenHeight:857});
  await command('Page.navigate',{url:labUrl.toString()});
  let labMounted=false;
  for(let i=0;i<400;i++){
    labMounted=await evalJS("location.search.includes('apexLayoutLab=home') && Boolean(document.querySelector('#gold-shell-host #stage') && document.getElementById('apex-boot-start'))").catch(()=>false);
    if(labMounted)break;
    await sleep(75);
  }
  if(!labMounted)throw Error('R82 lab production mount unavailable');
  const startLab=await evalJS("(()=>{const r=document.querySelector('#apex-boot-start').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
  await command('Input.dispatchMouseEvent',{type:'mousePressed',x:startLab.x,y:startLab.y,button:'left',clickCount:1});
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:startLab.x,y:startLab.y,button:'left',clickCount:1});
  let labBoot=false;
  for(let i=0;i<300;i++){
    labBoot=await evalJS("document.body?.dataset?.apexSceneTransition==='DONE' && document.getElementById('apex-scene-transition')?.style?.display==='none'").catch(()=>false);
    if(labBoot)break;
    await sleep(75);
  }
  if(!labBoot)throw Error('R82 lab boot transition did not complete');
  const trial={};
  trial.ref=await capture('lab-550x857',550,857);
  trial.small=await capture('lab-360x560',360,560);
  trial.smaller=await capture('lab-320x498',320,498);
  trial.outband=await capture('lab-390x844',390,844);

  const failures=[];
  const accept=(name,ok,detail)=>{console.log((ok?'PASS':'FAIL')+' R82 '+name+(detail?' '+JSON.stringify(detail):''));if(!ok)failures.push({name,detail});};
  // No change permitted at the golden viewport or unrelated ratios.
  for(const key of ['ref','outband']){
    const before=native[key],after=trial[key];
    accept(key+' opt-in inactive',after.lab?.active===false,{lab:after.lab});
    for(const k of ['story','title','actions','primary','secondary','routes','brand','profile']){
      const a=before.rects[k],b=after.rects[k];
      if(!a||!b){accept(key+'/'+k+' exists',false);continue;}
      const maxDiff=Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs(a.w-b.w),Math.abs(a.h-b.h));
      accept(key+'/'+k+' unmodified',maxDiff<=1.5,{maxDiff,a,b});
    }
  }
  // Same-aspect small viewports must retain the Golden reference geometry,
  // normalized back into the reference design coordinate system.
  for(const [name,small] of [['360x560',trial.small],['320x498',trial.smaller]]){
    const active=small.lab?.active===true;
    accept(name+' lab enabled',active,{lab:small.lab});
    if(!active)continue;
    const s=small.lab.scale,ox=small.lab.offsetX,oy=small.lab.offsetY;
    for(const k of ['story','title','actions','primary','secondary','routes','brand','profile']){
      const a=native.ref.rects[k],b=small.rects[k];
      if(!a||!b){accept(name+'/'+k+' exists',false);continue;}
      const current={x:(b.x-ox)/s,y:(b.y-oy)/s,w:b.w/s,h:b.h/s};
      const err=Math.max(...['x','y','w','h'].map(v=>Math.abs(current[v]-a[v])));
      accept(name+'/'+k+' design-space invariant',err<=3.0,{err,current,golden:a});
    }
    const r=small.rects;
    const gapA=r.actions.y-(r.story.y+r.story.h);
    const gapB=r.routes.y-(r.actions.y+r.actions.h);
    accept(name+' no vertical overlap',gapA>=0&&gapB>=0,{storyToActions:gapA,actionsToRoutes:gapB});
  }
  // Real UI routing must keep the actual click action after Home scaling.
  await command('Emulation.setDeviceMetricsOverride',{width:360,height:560,
    deviceScaleFactor:2,mobile:true,screenWidth:360,screenHeight:560});
  await sleep(450);
  const clickCenter=await evalJS("(()=>{const r=document.querySelector('#freeBattle').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
  await command('Input.dispatchMouseEvent',{type:'mousePressed',x:clickCenter.x,y:clickCenter.y,button:'left',clickCount:1});
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:clickCenter.x,y:clickCenter.y,button:'left',clickCount:1});
  let routed=false;
  for(let i=0;i<100;i++){
    routed=await evalJS("document.querySelector('#stage')?.classList.contains('screen-mode')").catch(()=>false);
    if(routed)break;
    await sleep(100);
  }
  accept('real scaled Free Battle button opens Mode Select',routed);
  await writeFile(outputDir+'/comparison.json',JSON.stringify({native,trial,failures},null,2));
  if(failures.length)throw Error('R82 design-space experiment failed '+failures.length+' geometry/interaction checks. See comparison.json');
  console.log('PASS R82 actual Chrome Home equivalence/interaction');
}finally{
  try{socket?.close()}catch{}
  chrome.kill('SIGTERM');
}
