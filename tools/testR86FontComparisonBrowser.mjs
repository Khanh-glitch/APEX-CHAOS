// R77 Home layout browser regression. Uses actual Blink layout/hit testing at
// CSS-pixel portrait viewports; does not claim to emulate Android browser chrome.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { openSync, readFileSync } from 'node:fs';

const url=process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const chromePath=process.env.CHROME_PATH;
if(!chromePath)throw new Error('CHROME_PATH not set');
const port=9292;
const chromeLogFile='/tmp/r86-type-chrome.log';
const chromeLogFd=openSync(chromeLogFile,'w');
const chrome=spawn(chromePath,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--remote-allow-origins=*','--no-first-run',
  '--remote-debugging-port='+port,'--user-data-dir=/tmp/apex-r86-typography-lab-cdp-'+process.pid,
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

  const out='docs/acceptance/r86-font-comparison';
  await mkdir(out,{recursive:true});
  const viewports=[
    {w:550,h:857,label:'golden-550x857'},
    {w:390,h:844,label:'tall-390x844'},
    {w:361,h:545,label:'owner-361x545'}
  ];
  const results=[];
  const wait=async exp=>{
    for(let i=0;i<350;i++){
      if(await evalJS(exp).catch(()=>false))return true;
      await sleep(90);
    }
    return false;
  };
  const click=async selector=>{
    const p=await evalJS('(()=>{const e=document.querySelector('+JSON.stringify(selector)+'),r=e?.getBoundingClientRect();return r?{x:r.x+r.width/2,y:r.y+r.height/2}:null})()');
    if(!p)throw Error('R86 font lab cannot find '+selector);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});
  };
  const metric=()=>{
    const find=sel=>{
      const e=document.querySelector(sel);
      if(!e)return null;
      const r=e.getBoundingClientRect(),c=getComputedStyle(e);
      return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,
        scrollW:e.scrollWidth,clientW:e.clientWidth,
        font:c.fontFamily,fontSize:c.fontSize,weight:c.fontWeight,
        text:e.textContent?.trim().slice(0,100)};
    };
    return {w:innerWidth,h:innerHeight,stage:document.querySelector('#stage')?.className,
      display:find('.storyTitle'),cta:find('#continueStory .label'),
      free:find('#freeBattle .label'),mode:find('.modeHeader'),
      fighter:find('.fighterHeaderV6 h2'),fighterName:find('.fighterName'),
      fonts:{ready:document.fonts.status,oswald700:document.fonts.check('700 36px Oswald')}};
  };
  const capture=async name=>{
    await sleep(320);
    const d=await evalJS('('+metric.toString()+')()');
    const shot=await command('Page.captureScreenshot',{format:'png',fromSurface:true});
    await writeFile(out+'/'+name+'.png',Buffer.from(shot.data,'base64'));
    console.log('R86 FONT '+name+' '+JSON.stringify(d));
    return d;
  };
  const styleId='r86-font-proof';
  const install=async()=>{
    const r=await evalJS("(()=>new Promise((resolve,reject)=>{let link=document.getElementById('r86-font-files');if(link){resolve(true);return;}link=document.createElement('link');link.id='r86-font-files';link.rel='stylesheet';link.href='/gold/fonts.css';link.onload=()=>resolve(true);link.onerror=()=>reject(new Error('Cannot load locally bundled Gold Oswald'));document.head.appendChild(link)}))()");
    if(!r)throw Error('Gold Oswald local stylesheet unavailable');
    await evalJS("document.fonts.load('700 36px Oswald').then(()=>document.fonts.ready.then(()=>true))");
    await evalJS("(()=>{let s=document.getElementById('r86-font-proof');if(!s){s=document.createElement('style');s.id='r86-font-proof';s.textContent='#gold-shell-host #stage {--fDisplay:Oswald,sans-serif!important;--fAction:Oswald,sans-serif!important}';document.head.appendChild(s)}else{s.disabled=false;}return true})()");
  };
  const remove=async()=>{await evalJS("(()=>{const s=document.getElementById('r86-font-proof');if(s)s.disabled=true;return true})()");};
  for(const v of viewports){
    await command('Emulation.setDeviceMetricsOverride',{width:v.w,height:v.h,
      deviceScaleFactor:2,mobile:true,screenWidth:v.w,screenHeight:v.h});
    const targetUrl=new URL(url);targetUrl.searchParams.set('apexHomeSolver','1');
    await command('Page.navigate',{url:targetUrl.href});
    if(!(await wait("!!document.querySelector('#gold-shell-host #stage')&&!!document.getElementById('apex-boot-start')")))throw Error('no START '+v.label);
    await click('#apex-boot-start');
    if(!(await wait("document.body?.dataset?.apexSceneTransition==='DONE'&&document.getElementById('apex-scene-transition')?.style?.display==='none'")))throw Error('no Home '+v.label);
    const beforeHome=await capture(v.label+'-home-gold');
    await install();
    const fontHome=await capture(v.label+'-home-oswald');
    if(!fontHome.fonts.oswald700)throw Error('Oswald not loaded from repo at '+v.label);
    await click('#freeBattle');
    if(!(await wait("document.querySelector('#stage')?.classList.contains('screen-mode')")))throw Error('mode not reached '+v.label);
    await click('.modeCard[data-mode="bot"]');
    if(!(await wait("document.querySelector('#stage')?.classList.contains('screen-fighter')")))throw Error('pick not reached '+v.label);
    await remove();
    const beforePick=await capture(v.label+'-pick-gold');
    await install();
    const fontPick=await capture(v.label+'-pick-oswald');
    results.push({viewport:v,home:{gold:beforeHome,oswald:fontHome},pick:{gold:beforePick,oswald:fontPick}});
    console.log('R86 FONT COMPARE '+v.label+' '+JSON.stringify({
      titleHeightOriginal:beforeHome.display?.h,titleHeightOswald:fontHome.display?.h,
      ctaWidthOriginal:beforeHome.cta?.w,ctaWidthOswald:fontHome.cta?.w,
      fighterNameOriginal:beforePick.fighterName?.w,fighterNameOswald:fontPick.fighterName?.w
    }));
  }
  await writeFile(out+'/font-comparison.json',JSON.stringify(results,null,2));
  console.log('R86 FONT LAB COMPLETE '+JSON.stringify({views:results.length,source:'bundled Oswald 700',note:'review candidate visually before changing Gold default'}));
}finally{
  try{socket?.close()}catch{}
  chrome.kill('SIGTERM');
}
