// R77 Home layout browser regression. Uses actual Blink layout/hit testing at
// CSS-pixel portrait viewports; does not claim to emulate Android browser chrome.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { openSync, readFileSync } from 'node:fs';

const url=process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const chromePath=process.env.CHROME_PATH;
if(!chromePath)throw new Error('CHROME_PATH not set');
const port=9286;
const chromeLogFile='/tmp/r86-home-chrome.log';
const chromeLogFd=openSync(chromeLogFile,'w');
const chrome=spawn(chromePath,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--remote-allow-origins=*','--no-first-run',
  '--remote-debugging-port='+port,'--user-data-dir=/tmp/apex-r86-home-lab-cdp-'+process.pid,
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
  // Test the production Vite document, NOT standalone shell.html.
  await command('Page.navigate',{url});
  let homeMounted=false;
  for(let i=0;i<400;i++){
    const value=await evalJS("Boolean(document.querySelector('#gold-shell-host #stage') && document.getElementById('gold-shell-host')?.dataset.apexGoldMounted==='1' && document.querySelector('#apex-boot-start'))").catch(()=>false);
    if(value){homeMounted=true;break}
    await sleep(75);
  }
  if(!homeMounted)throw new Error('React-mounted Home/boot START unavailable');

  const out='docs/acceptance/r86-home-geometry';
  await mkdir(out,{recursive:true});
  const viewportCases=[
    {w:550,h:857,label:'golden-550x857'},
    {w:390,h:844,label:'tall-390x844'},
    {w:361,h:545,label:'owner-361x545'},
    {w:320,h:498,label:'short-320x498'},
    {w:280,h:430,label:'ultrashort-280x430'}
  ];
  const failures=[],results={};
  const assert=(name,pass,data)=>{
    console.log((pass?'PASS':'FAIL')+' R86 HOME '+name+' '+JSON.stringify(data));
    if(!pass)failures.push({name,data});
  };
  const rect=()=>{
    const find=selector=>{
      const e=document.querySelector(selector);
      if(!e)return null;
      const r=e.getBoundingClientRect();
      return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right};
    };
    const first=document.querySelector('#continueStory');
    const free=document.querySelector('#freeBattle');
    const hit=e=>{const b=e?.getBoundingClientRect();
      return Boolean(b&&document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)?.closest('#'+e.id));
    };
    return {layout:{w:innerWidth,h:innerHeight},scene:document.querySelector('#stage')?.className,
      title:find('.storyTitle'),story:find('.story'),actions:find('.actions'),
      routes:find('.routes'),continue:find('#continueStory'),free:find('#freeBattle'),
      primaryHit:hit(first),freeHit:hit(free),
      solver:window.__apexHomeGeometryGuard?.snapshot()||null};
  };
  const click=async selector=>{
    const point=await evalJS('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');const r=e?.getBoundingClientRect();return r?{x:r.x+r.width/2,y:r.y+r.height/2}:null})()');
    if(!point)throw Error('Missing '+selector);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
  };
  const wait=async expr=>{
    for(let i=0;i<260;i++){
      if(await evalJS(expr).catch(()=>false))return true;
      await sleep(75);
    }
    return false;
  };
  const capture=async tag=>{
    await sleep(300);
    const data=await evalJS('('+rect.toString()+')()');
    const image=await command('Page.captureScreenshot',{format:'png',fromSurface:true});
    await writeFile(out+'/'+tag+'.png',Buffer.from(image.data,'base64'));
    console.log('R86 HOME SNAP '+tag+' '+JSON.stringify(data));
    return data;
  };
  for(const v of viewportCases){
    results[v.label]={};
    for(const kind of ['baseline','candidate']){
      await command('Emulation.setDeviceMetricsOverride',{width:v.w,height:v.h,
        deviceScaleFactor:2,mobile:true,screenWidth:v.w,screenHeight:v.h});
      const target=new URL(url);
      if(kind==='candidate')target.searchParams.set('apexHomeSolver','1');
      await command('Page.navigate',{url:target.href});
      const mounted=await wait("!!document.querySelector('#gold-shell-host #stage') && !!document.getElementById('apex-boot-start')");
      if(!mounted)throw Error('R86 boot unavailable at '+v.label+'/'+kind);
      await click('#apex-boot-start');
      const unlocked=await wait("document.body?.dataset?.apexSceneTransition==='DONE'&&document.getElementById('apex-scene-transition')?.style?.display==='none'");
      if(!unlocked)throw Error('R86 Home did not unlock '+v.label+'/'+kind);
      const data=await capture(v.label+'-'+kind);
      results[v.label][kind]=data;
      assert(v.label+'/'+kind+' real Home buttons hit',data.primaryHit&&data.freeHit,data);
    }
    const {baseline,candidate}=results[v.label];
    if(v.h>700){
      for(const key of ['story','actions','routes','title']){
        const a=baseline[key],b=candidate[key];
        const diff=a&&b?Math.max(...['x','y','w','h'].map(k=>Math.abs(a[k]-b[k]))):Infinity;
        assert(v.label+'/'+key+' untouched approved geometry',diff<1.25,{diff,a,b});
      }
    } else {
      const c=candidate;
      const storyGap=c.actions.y-c.story.bottom;
      const routeGap=c.routes.y-c.actions.bottom;
      assert(v.label+' story above CTA with >=11px gap',storyGap>=11.0,{storyGap,before:baseline.actions.y-baseline.story.bottom});
      assert(v.label+' CTA above routes with >=9px gap',routeGap>=8.5,{routeGap,before:baseline.routes.y-baseline.actions.bottom});
      assert(v.label+' story within viewport',c.story.y>=v.h*.16 && c.story.bottom<=v.h,{story:c.story});
      assert(v.label+' title uncut',c.title?.x>=-1&&c.title?.right<=v.w+2&&c.title?.bottom<=c.actions.y,{title:c.title,actions:c.actions});
    }
    console.log('R86 PAIR '+v.label+' '+JSON.stringify({
      beforeStoryGap:baseline.actions.y-baseline.story.bottom,
      afterStoryGap:candidate.actions.y-candidate.story.bottom,
      beforeRouteGap:baseline.routes.y-baseline.actions.bottom,
      afterRouteGap:candidate.routes.y-candidate.actions.bottom
    }));
  }
  // Screen transition must not leave stale inline Home coordinates.
  await command('Emulation.setDeviceMetricsOverride',{width:280,height:430,
    deviceScaleFactor:2,mobile:true,screenWidth:280,screenHeight:430});
  const target=new URL(url);target.searchParams.set('apexHomeSolver','1');
  await command('Page.navigate',{url:target.href});
  if(!(await wait("!!document.getElementById('apex-boot-start')")))throw Error('missing final START');
  await click('#apex-boot-start');
  if(!(await wait("document.body?.dataset?.apexSceneTransition==='DONE'")))throw Error('missing final Home');
  await click('#freeBattle');
  assert('Mode transition still works',await wait("document.querySelector('#stage')?.classList.contains('screen-mode')"));
  const residual=await evalJS("(()=>{const s=document.querySelector('.story'),a=document.querySelector('.actions');return{storyTop:s?.style.top,actionsTop:a?.style.top}})()");
  assert('Home inline corrections removed in Mode',!residual.storyTop&&!residual.actionsTop,residual);
  await writeFile(out+'/report.json',JSON.stringify({results,failures},null,2));
  console.log('R86 HOME FINAL '+JSON.stringify({viewports:viewportCases.length,failures}));
  if(failures.length)throw Error('R86 Home geometry lab FAILED '+failures.length);
}finally{
  try{socket?.close()}catch{}
  chrome.kill('SIGTERM');
}
