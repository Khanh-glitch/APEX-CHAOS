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
const chromeLogFile='/tmp/r85-audit-chrome.log';
const chromeLogFd=openSync(chromeLogFile,'w');
const chrome=spawn(chromePath,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--remote-allow-origins=*','--no-first-run',
  '--remote-debugging-port='+port,'--user-data-dir=/tmp/apex-r85-root-cause-lab-cdp-'+process.pid,
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

  const out='docs/acceptance/r85-responsive-pick';
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
    console.log('R85 AUDIT '+name+' '+JSON.stringify(data));
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
    if(!ready)throw Error('R85 boot START missing at '+label);
    const start=await capture(label+'-start');
    if(start.bounds.start.bottom>h-2)report.issues.push(label+' START outside CSS viewport');
    if(!start.start.buttonHit)report.issues.push(label+' START center blocked');
    await click('#apex-boot-start');
    const home=await wait("document.body?.dataset?.apexSceneTransition==='DONE' && document.getElementById('apex-scene-transition')?.style?.display==='none'");
    if(!home)throw Error('R85 Home did not unlock after START at '+label);
    await sleep(400);
    const homeSnap=await capture(label+'-home');
    await click('#freeBattle');
    if(!(await wait("document.querySelector('#stage')?.classList.contains('screen-mode')")))throw Error('R85 Mode missing at '+label);
    const mode=await capture(label+'-mode');
    await click('.modeCard[data-mode="bot"]');
    if(!(await wait("document.querySelector('#stage')?.classList.contains('screen-fighter') && document.querySelectorAll('#fighterRoster .rosterCard').length>=6")))throw Error('R85 Pick missing at '+label);
    await sleep(450);
    const before=await capture(label+'-pick-before');
    if(!(await evalJS("Boolean(window.__apexR85Pick?.enable?.())")))throw Error('R85 runtime probe missing');
    await sleep(150);
    const after=await capture(label+'-pick-after');
    const cascade=await evalJS("(()=>{const st=document.querySelector('#stage'),d=document.querySelector('.selectionDeckV6'),h=document.querySelector('.worldHeroSlot.p1'),cs=e=>getComputedStyle(e),css=document.getElementById('r85-candidate-pick');return {appliedRules:css?.sheet?.cssRules?.[0]?.cssRules?.length,stageVars:{lock:cs(st).getPropertyValue('--r85LockReserve'),deck:cs(st).getPropertyValue('--r85DeckTop'),lockB:cs(st).getPropertyValue('--apexLockB'),lockH:cs(st).getPropertyValue('--apexLockH')},deck:{inline:d?.style.cssText,top:cs(d).top,bottom:cs(d).bottom},hero:{class:h?.className,attributes:[...h?.attributes||[]].map(a=>[a.name,a.value]).slice(0,12),inline:h?.style.cssText,width:cs(h).width,left:cs(h).left,bottom:cs(h).bottom},supports:CSS.supports('top','min(65vh,calc(100dvh - max(10vh,58px) - 128px))')}})()");
    console.log('R85 CASCADE '+label+' '+JSON.stringify(cascade));
    const p=after.bounds,b=before.bounds;
    const error=(name,actual,expected)=>report.issues.push(label+' '+name+': '+JSON.stringify({actual,expected}));
    const close=(a,b,t=.75)=>Boolean(a&&b&&['x','y','w','h'].every(k=>Math.abs(a[k]-b[k])<=t));
    if(h>700){
      for(const key of ['pickHeader','hero','heroAsset','fighterIdentity','deck','card','lock']){
        if(!close(p[key],b[key],key==='heroAsset'?3:.75))error(key+' GOLD geometry changed',p[key],b[key]);
      }
    }else{
      if(!(p.card?.h>=48))error('roster touch height <48px',p.card?.h,'>=48');
      if(!(p.card?.h >= b.card?.h + 8))error('roster height insufficient improvement',p.card?.h,b.card?.h);
      if(!(p.deck&&p.lock&&p.deck.bottom<=p.lock.y+2))error('deck and lock overlap',p.deck?.bottom,p.lock?.y);
      if(!(p.fighterIdentity&&p.deck&&p.fighterIdentity.bottom<p.deck.y-1))
        error('identity overlays roster',p.fighterIdentity?.bottom,p.deck?.y);
      if(!(p.pickHeader&&p.fighterIdentity&&p.fighterIdentity.y>p.pickHeader.bottom+10))
        error('identity overlays header',p.fighterIdentity?.y,p.pickHeader?.bottom);
      if(!(p.hero&&p.hero.w >= w*.88 && p.hero.x < w*.2 && p.hero.right > w*.8))
        error('hero art stage not centered',p.hero,w);
      if(!(p.hero&&p.fighterIdentity&&p.hero.bottom<=p.fighterIdentity.y+12))
        error('hero art overlaps info dock too far',p.hero?.bottom,p.fighterIdentity?.y);
      if(!(p.pickHeader&&p.pickHeader.right<=w+1&&p.pickHeader.x>=-1))
        error('header out of viewport',p.pickHeader,w);
      if(!(p.fighterName&&p.fighterName.w>=w*.5))error('name dock too narrow',p.fighterName,w);
    }
    if(h<=700){
      await click('#fighterRoster .rosterCard[data-hero="hunter"]');
      if(!(await wait("document.querySelector('#p1Name')?.textContent?.trim()==='HUNTER'")))
        error('Hunter selection did not update fighter name',null,'HUNTER');
      const hunter=await capture(label+'-hunter-selected');
      if(!(hunter.bounds.hero&&hunter.bounds.hero.w>=w*.88))
        error('hero switch reset proportional stage',hunter.bounds.hero,w);
      if(!(hunter.bounds.deck&&hunter.bounds.card&&hunter.bounds.card.h>=48))
        error('hero switch lost roster sizing',hunter.bounds.card?.h,'>=48');
      if(label==='owner-361x545'){
        await command('Emulation.setDeviceMetricsOverride',{width:550,height:857,
          deviceScaleFactor:2,mobile:true,screenWidth:550,screenHeight:857});
        await sleep(350);
        const tall=await capture('owner-live-resize-to-550x857');
        const pickState=await evalJS('window.__apexR85Pick?.snapshot()');
        const hero=tall.bounds.hero;
        const canonical=hero&&Math.abs(hero.w-277.75)<=2&&hero.x>-30&&hero.x<-20;
        if(!canonical || pickState?.active===true)
          error('live resize from short to Golden did not restore Gold hero geometry',hero,pickState);
        await command('Emulation.setDeviceMetricsOverride',{width:w,height:h,
          deviceScaleFactor:2,mobile:true,screenWidth:w,screenHeight:h});
        await sleep(350);
        const shortAgain=await capture('owner-live-resize-back-to-361x545');
        if(!(shortAgain.bounds.card?.h>=48&&shortAgain.bounds.hero?.w>=w*.88))
          error('responsive solver failed to re-enter compact mode after Golden',shortAgain.bounds.card,shortAgain.bounds.hero);
        await evalJS('window.__apexR85Pick.disable()');
        await sleep(250);
        const off=await capture('owner-pick-disabled-gold');
        if(!(off.bounds.card?.h<48&&Math.abs(off.bounds.hero?.w-182.296875)<3))
          error('disabling R85 did not restore untouched R83 layout',off.bounds.card,off.bounds.hero);
        await evalJS('window.__apexR85Pick.enable()');
        await sleep(250);
        const on=await capture('owner-pick-reenabled');
        if(!(on.bounds.card?.h>=48&&on.bounds.hero?.w>=w*.88))
          error('re-enabling R85 failed after disable',on.bounds.card,on.bounds.hero);
      }
    }
    report.viewports.push({viewport,start,home:homeSnap,mode,pickBefore:before,pickAfter:after});
    console.log('R85 CHECKPOINT '+label+' '+JSON.stringify({
      beforeCard:b.card?.h,afterCard:p.card?.h,
      beforeIdentityH:b.fighterIdentity?.h,afterIdentityH:p.fighterIdentity?.h,
      beforeHeroX:b.hero?.x,afterHeroX:p.hero?.x,
      candidateDeckTop:p.deck?.y,candidateHeaderH:p.pickHeader?.h,
      issueCount:report.issues.length}));
  }
  await writeFile(out+'/report.json',JSON.stringify(report,null,2));
  console.log('R85 CANDIDATE COMPLETE '+JSON.stringify({screens:report.viewports.length,issues:report.issues}));
  if(report.issues.length)throw Error('R85 geometry candidate rejected: '+report.issues.length+' issues');
}finally{
  try{socket?.close()}catch{}
  chrome.kill('SIGTERM');
}
