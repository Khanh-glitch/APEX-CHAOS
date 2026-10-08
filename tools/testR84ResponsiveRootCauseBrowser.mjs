// R77 Home layout browser regression. Uses actual Blink layout/hit testing at
// CSS-pixel portrait viewports; does not claim to emulate Android browser chrome.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { openSync, readFileSync } from 'node:fs';

const url=process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const chromePath=process.env.CHROME_PATH;
if(!chromePath)throw new Error('CHROME_PATH not set');
const port=9264;
const chromeLogFile='/tmp/r84-audit-chrome.log';
const chromeLogFd=openSync(chromeLogFile,'w');
const chrome=spawn(chromePath,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--remote-allow-origins=*','--no-first-run',
  '--remote-debugging-port='+port,'--user-data-dir=/tmp/apex-r84-root-cause-lab-cdp-'+process.pid,
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

  const out='docs/acceptance/r84-responsive-root-cause';
  await mkdir(out,{recursive:true});
  const screens=[
    {w:550,h:857,label:'golden-550x857'},
    {w:390,h:844,label:'tall-390x844'},
    {w:361,h:545,label:'owner-361x545'},
    {w:320,h:498,label:'short-320x498'},
    {w:280,h:430,label:'ultrashort-280x430'}
  ];
  const report={source:'R83 real React-mounted production Vite + Chrome CDP; NOT Android browser chrome',
    viewports:[],issues:[]};
  const dom=()=>{
    const rect=selector=>{
      const e=document.querySelector(selector);if(!e)return null;
      const b=e.getBoundingClientRect(),s=getComputedStyle(e);
      return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom,
        display:s.display,visibility:s.visibility,opacity:s.opacity,
        font:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,
        scrollW:e.scrollWidth,clientW:e.clientWidth,text:(e.textContent||'').trim().slice(0,90)};
    };
    const selectors={
      start:'#apex-boot-start',startAsset:'#apex-boot-start .apex-boot-start-art',
      homeTitle:'#stage .storyTitle',homeActions:'#stage .actions',homeButton:'#freeBattle',
      homeRoutes:'#stage .routes',homeHero:'#stage .heroWrap',
      modeTitle:'#stage .modeTitle',modeBot:'#stage .modeCard[data-mode="bot"]',
      modeLocal:'#stage .modeCard[data-mode="local1v1"]',
      pickHeader:'#stage .fighterHeaderV6',
      pickStage:'#stage .fighterWorldStage',
      hero:'#stage .worldHeroSlot.p1',
      heroAsset:'#stage .worldHeroSlot.p1 .worldHeroAsset',
      fighterIdentity:'#stage .fighterIdentityZone.p1',
      fighterName:'#stage .fighterIdentityZone.p1 .fighterName',
      skillChips:'#stage .fighterIdentityZone.p1 .skillRows',
      deck:'#stage .selectionDeckV6',
      roster:'#fighterRoster',
      card:'#fighterRoster .rosterCard:not(.is-locked)',
      lock:'#stage .lockMechanismV6'
    };
    const bounds=Object.fromEntries(Object.entries(selectors).map(([key,sel])=>[key,rect(sel)]));
    const v=window.visualViewport;
    const asset=document.querySelector('#apex-boot-start .apex-boot-start-art');
    const button=document.querySelector('#apex-boot-start');
    const b=button?.getBoundingClientRect();
    const underStart=b?document.elementFromPoint(b.x+b.width/2,b.y+b.height/2):null;
    const fontTest=document.createElement('canvas').getContext('2d');
    const measure=family=>{
      fontTest.font='900 34px '+family;
      return fontTest.measureText('APEX CHAOS 1VS1 ROBOT').width;
    };
    return {layout:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio,
      visual:v?{w:v.width,h:v.height,offsetTop:v.offsetTop,scale:v.scale}:null,
      safe:getComputedStyle(document.querySelector('#stage')||document.documentElement).getPropertyValue('--safeB').trim()},
      stage:document.querySelector('#stage')?.className,
      bounds,fonts:{status:document.fonts.status,
        available:[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status})).slice(0,24),
        canvasWidth:{impact:measure('Impact'),arial:measure('Arial'),oswald:measure('Oswald'),sans:measure('sans-serif')}},
      start:{buttonHit:Boolean(underStart?.closest?.('#apex-boot-start')),imageNatural:{w:asset?.naturalWidth||0,h:asset?.naturalHeight||0}}};
  };
  const capture=async name=>{
    await sleep(450);
    const data=await evalJS('('+dom.toString()+')()');
    const frame=await command('Page.captureScreenshot',{format:'png',fromSurface:true});
    await writeFile(out+'/'+name+'.png',Buffer.from(frame.data,'base64'));
    console.log('R84 AUDIT '+name+' '+JSON.stringify(data));
    return data;
  };
  const wait=async expr=>{
    for(let i=0;i<360;i++){
      if(await evalJS(expr).catch(()=>false))return true;
      await sleep(95);
    }
    return false;
  };
  const click=async selector=>{
    const point=await evalJS('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
    if(!point)throw Error('Missing '+selector);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
  };
  for(const viewport of screens){
    const {w,h,label}=viewport;
    await command('Emulation.setDeviceMetricsOverride',{width:w,height:h,
      deviceScaleFactor:2,mobile:true,screenWidth:w,screenHeight:h});
    await command('Page.navigate',{url});
    const ready=await wait("!!document.querySelector('#gold-shell-host #stage') && !!document.getElementById('apex-boot-start')");
    if(!ready)throw Error('R84 boot START missing at '+label);
    const start=await capture(label+'-start');
    if(start.bounds.start.bottom>h-2)report.issues.push(label+' START outside CSS viewport');
    if(!start.start.buttonHit)report.issues.push(label+' START center blocked');
    await click('#apex-boot-start');
    const home=await wait("document.body?.dataset?.apexSceneTransition==='DONE' && document.getElementById('apex-scene-transition')?.style?.display==='none'");
    if(!home)throw Error('R84 Home did not unlock after START at '+label);
    await sleep(400);
    const homeSnap=await capture(label+'-home');
    await click('#freeBattle');
    if(!(await wait("document.querySelector('#stage')?.classList.contains('screen-mode')")))throw Error('R84 Mode missing at '+label);
    const mode=await capture(label+'-mode');
    await click('.modeCard[data-mode="bot"]');
    if(!(await wait("document.querySelector('#stage')?.classList.contains('screen-fighter') && document.querySelectorAll('#fighterRoster .rosterCard').length>=6")))throw Error('R84 Pick missing at '+label);
    await sleep(450);
    const pick=await capture(label+'-pick');
    const bb=pick.bounds;
    if(bb.card?.h<48)report.issues.push(label+' Pick roster card height <48px: '+bb.card.h.toFixed(2));
    if(bb.deck&&bb.lock&&bb.deck.bottom>bb.lock.y+2)report.issues.push(label+' Pick deck overlaps lock band');
    if(bb.hero&&bb.fighterIdentity&&bb.hero.bottom<bb.fighterIdentity.bottom)report.issues.push(label+' Pick identity may overlap hero');
    report.viewports.push({viewport,start,home:homeSnap,mode,pick});
    console.log('R84 CHECKPOINT '+label+' '+JSON.stringify({
      startY:start.bounds.start?.y,startBottom:start.bounds.start?.bottom,
      fontStack:homeSnap.bounds.homeTitle?.font,
      homeStoryY:homeSnap.bounds.homeTitle?.y,
      pickCardH:bb.card?.h,pickDeckH:bb.deck?.h,
      heroHeight:bb.hero?.h,identityY:bb.fighterIdentity?.y,
      issueCount:report.issues.length}));
  }
  await writeFile(out+'/report.json',JSON.stringify(report,null,2));
  console.log('R84 DIAGNOSTIC COMPLETE '+JSON.stringify({screens:report.viewports.length,issues:report.issues}));
}finally{
  try{socket?.close()}catch{}
  chrome.kill('SIGTERM');
}
