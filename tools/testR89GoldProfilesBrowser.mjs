import {GOLD_PROFILES,chooseGoldProfile} from '../public/gold-fidelity-profiles.mjs';
// R77 Home layout browser regression. Uses actual Blink layout/hit testing at
// CSS-pixel portrait viewports; does not claim to emulate Android browser chrome.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { openSync, readFileSync } from 'node:fs';

const url=process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const chromePath=process.env.CHROME_PATH;
if(!chromePath)throw new Error('CHROME_PATH not set');
const port=9368;
const chromeLogFile='/tmp/r89-gold-chrome.log';
const chromeLogFd=openSync(chromeLogFile,'w');
const chrome=spawn(chromePath,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--remote-allow-origins=*','--no-first-run',
  '--remote-debugging-port='+port,'--user-data-dir=/tmp/apex-r89-profile-lab-cdp-'+process.pid,
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
  const dir='docs/acceptance/r89-gold-profiles';
  await mkdir(dir,{recursive:true});
  const failures=[],output=[];
  const check=(label,ok,details={})=>{
    console.log((ok?'PASS':'FAIL')+' R89 '+label+' '+JSON.stringify(details));
    if(!ok)failures.push({label,details});
  };
  const wait=async expr=>{
    for(let i=0;i<350;i++){if(await evalJS(expr).catch(()=>false))return true;await sleep(95)}
    return false;
  };
  const childReady="(()=>{const c=window.__apexGoldFidelity?.child()||window;return Boolean(c.document.querySelector('#stage')&&c.document.querySelector('#apex-boot-start'))})()";
  const homeDone="(()=>{const c=window.__apexGoldFidelity?.child()||window;return c.document.body?.dataset?.apexSceneTransition==='DONE'})()";
  const click=async selector=>{
    const point=await evalJS("(()=>{const f=window.__apexGoldFidelity?.child();const doc=f?.document||document;const el=doc.querySelector("+JSON.stringify(selector)+"),r=el?.getBoundingClientRect();if(!r)return null;if(!f)return{x:r.x+r.width/2,y:r.y+r.height/2};const b=document.querySelector('#gold-document').getBoundingClientRect(),s=b.width/f.innerWidth;return{x:b.x+(r.x+r.width/2)*s,y:b.y+(r.y+r.height/2)*s}})()");
    if(!point)throw Error('R89 missing '+selector);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
  };
  const measure=()=>{
    const lab=window.__apexGoldFidelity,win=lab?.child()||window,d=win.document;
    const box=sel=>{const n=d.querySelector(sel);if(!n)return null;const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
    const hud=d.querySelector('#battleHudHost #hud');
    return {profile:lab?.snapshot()?.profile??'direct',layout:lab?.snapshot()??null,
      child:{w:win.innerWidth,h:win.innerHeight,session:win.performance.timeOrigin},
      home:{title:box('.storyTitle'),story:box('.story'),actions:box('.actions'),routes:box('.routes'),free:box('#freeBattle')},
      pick:{card:box('#fighterRoster .rosterCard:not(.is-locked)'),hero:box('.worldHeroSlot.p1')},
      battle:{mode:hud?.dataset.mode,layout:hud?.dataset.layout,size:hud?.dataset.size,arena:box('#battleHudHost #arena')}
    };
  };
  const capture=async name=>{
    await sleep(420);
    const data=await evalJS('('+measure.toString()+')()');
    const image=await command('Page.captureScreenshot',{format:'png',fromSurface:true});
    await writeFile(dir+'/'+name+'.png',Buffer.from(image.data,'base64'));
    return data;
  };
  const resize=async(w,h)=>command('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:2,mobile:true,screenWidth:w,screenHeight:h});
  const boot=async()=>{
    if(!(await wait(childReady)))throw Error('R89 START unavailable');
    await click('#apex-boot-start');
    if(!(await wait(homeDone)))throw Error('R89 Home transition did not complete');
    await sleep(600);
  };
  const close=(a,b,t=1.5)=>Boolean(a&&b&&['x','y','w','h'].every(k=>Math.abs(a[k]-b[k])<=t));
  const layoutExpected={
    'portrait-tall':['port','compact'],'portrait-standard':['port','compact'],
    'portrait-tablet':['port','tablet'],'landscape-tablet':['land','tablet'],
    'landscape-phone':['land','compact'],'landscape-ultrawide':['land','compact'],
    'desktop':['desk','desktop'],'desktop-wide':['desk','wide']
  };
  for(const profile of GOLD_PROFILES){
    const full={w:profile.width,h:profile.height};
    const small={w:Math.round(full.w*.6),h:Math.round(full.h*.6)};
    check(profile.id+' same aspect chooses same profile',
      chooseGoldProfile(full.w,full.h,null,{deviceClass:profile.device})?.id===profile.id &&
      chooseGoldProfile(small.w,small.h,null,{deviceClass:profile.device})?.id===profile.id,{full,small});
    await resize(full.w,full.h);
    await command('Page.navigate',{url});
    await boot();
    const donor=await capture(profile.id+'-direct-authored-Gold');
    const samples=[];
    for(const v of [{name:'full',...full},{name:'small',...small}]){
      await resize(v.w,v.h);
      const link=new URL('/gold-fidelity-lab.html',url);
      link.searchParams.set('goldDevice',profile.device);
      await command('Page.navigate',{url:link.href});
      await boot();
      const home=await capture(profile.id+'-'+v.name+'-Home');
      const geometry=home.layout;
      check(profile.id+'/'+v.name+' correct authored Gold composition',
        home.profile===profile.id &&
        Math.abs(home.child.w-profile.width)<1.1&&Math.abs(home.child.h-profile.height)<1.1,{geometry,child:home.child});
      const s=Math.min(v.w/profile.width,v.h/profile.height);
      check(profile.id+'/'+v.name+' exact uniform fit',
        Math.abs(geometry?.scale-s)<.002&&geometry.scaledWidth<=v.w+.1&&geometry.scaledHeight<=v.h+.1,geometry);
      for(const k of ['title','story','actions','routes','free'])
        check(profile.id+'/'+v.name+' '+k+' unchanged design coordinates',
          close(home.home[k],donor.home[k]),{a:home.home[k],donor:donor.home[k]});
      await click('#freeBattle');
      if(!(await wait("(()=>{const c=window.__apexGoldFidelity?.child();return c?.document.querySelector('#stage')?.classList.contains('screen-mode')})()")))
        throw Error(profile.id+' Mode failed');
      await click('.modeCard[data-mode="local1v1"]');
      if(!(await wait("(()=>{const c=window.__apexGoldFidelity?.child();return c?.document.querySelector('#stage')?.classList.contains('screen-fighter')&&c.document.querySelectorAll('#fighterRoster .rosterCard').length>=6})()")))
        throw Error(profile.id+' Pick failed');
      const pick=await capture(profile.id+'-'+v.name+'-Pick');
      check(profile.id+'/'+v.name+' Gold Fighter card and hero present',pick.pick.card?.h>0&&pick.pick.hero?.w>0,pick.pick);
      await click('.rosterCard[data-hero="newbot"]');
      await sleep(230);
      await click('#lockIn');
      if(!(await wait("(()=>window.__apexGoldFidelity?.child()?.document.querySelector('#stage')?.classList.contains('fighter-active-p2'))()")))
        throw Error(profile.id+' P2 handoff failed');
      await click('.rosterCard[data-hero="newbot"]');
      await sleep(230);
      await click('#lockIn');
      if(!(await wait("(()=>{const d=window.__apexGoldFidelity?.child()?.document;return d?.body.classList.contains('battle-hud-open')&&d.querySelector('#battleHudHost #arena')?.getBoundingClientRect().width>0})()")))
        throw Error(profile.id+' real Battle failed');
      const battle=await capture(profile.id+'-'+v.name+'-Battle');
      const expected=layoutExpected[profile.id];
      check(profile.id+'/'+v.name+' native Battle Gold layout and size',
        battle.battle.layout===expected[0]&&battle.battle.size===expected[1]&&battle.battle.mode==='2p',battle.battle);
      samples.push({viewport:v,home,pick,battle});
      console.log('R89 PROFILE CASE '+profile.id+' '+v.name+' '+JSON.stringify({
        aspect:v.w/v.h,selected:home.profile,scale:geometry.scale,
        native:home.child,battle:{layout:battle.battle.layout,size:battle.battle.size},
        arena:battle.battle.arena?.w}));
    }
    output.push({id:profile.id,donor,samples});
  }

  // Intermediate viewport coverage: these ARE NOT authored anchor aspects.
  // Each case boots the real application, exercises Home -> Mode -> Pick ->
  // Local Battle and measures real (not screenshot-only) DOM/hit regions.
  const intermediate=[
    {name:'iphone-se',w:375,h:667,device:'phone',hud:'port',size:'compact'},
    {name:'iphone-portrait-tall',w:430,h:932,device:'phone',hud:'port',size:'compact'},
    {name:'phone-landscape-16-9',w:667,h:375,device:'phone',hud:'land',size:'compact'},
    {name:'phone-landscape-ultrawide',w:852,h:393,device:'phone',hud:'land',size:'compact'},
    {name:'tablet-landscape-4-3',w:1024,h:768,device:'tablet',hud:'land',size:'tablet'},
    {name:'desktop-mid-size',w:1280,h:800,device:'desktop',hud:'desk',size:'desktop'}
  ];
  const screenAudit=(selector)=>{
    const lab=window.__apexGoldFidelity,child=lab.child(),d=child.document;
    const n=d.querySelector(selector);
    if(!n)return {reason:'missing'};
    const style=child.getComputedStyle(n),rect=n.getBoundingClientRect();
    const frame=d.defaultView.frameElement.getBoundingClientRect();
    const scale=frame.width/child.innerWidth;
    const center={x:frame.left+(rect.left+rect.width/2)*scale,
                  y:frame.top+(rect.top+rect.height/2)*scale};
    const hit=d.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
    const view={w:window.innerWidth,h:window.innerHeight};
    return {rect:{x:rect.x,y:rect.y,w:rect.width,h:rect.height},
      center,view,hidden:style.display==='none'||style.visibility==='hidden'||Number(style.opacity)<.01,
      within:center.x>=0&&center.x<=view.w&&center.y>=0&&center.y<=view.h,
      hittable:Boolean(hit&&(hit===n||n.contains(hit)))};
  };
  for(const v of intermediate){
    await resize(v.w,v.h);
    const link=new URL(v.name==='iphone-se'?'/?goldViewport=1':'/gold-fidelity-lab.html',url);
    link.searchParams.set('goldDevice',v.device);
    await command('Page.navigate',{url:link.href});
    if(!(await wait(childReady)))throw Error('R89 intermediate START unavailable '+v.name);
    if(v.name==='iphone-se')check('R89 opt-in entry redirects exactly once',await evalJS("location.pathname==='/gold-fidelity-lab.html'&&window.__apexGoldFidelity.child().location.search.includes('goldViewport=native')"));
    const meta=await evalJS('window.__apexGoldFidelity?.snapshot()');
    check(v.name+' aspect-fit/zero-letterbox',
      meta?.deviceClass===v.device&&
      Math.abs(meta.design.width/meta.design.height-v.w/v.h)<.00001&&
      Math.abs(meta.letterboxX)<.1&&Math.abs(meta.letterboxY)<.1,meta);
    const start=await evalJS('('+screenAudit.toString()+')("#apex-boot-start")');
    check(v.name+' START center visible and hittable',start.within&&start.hittable&&!start.hidden,start);
    await click('#apex-boot-start');
    if(!(await wait(homeDone)))throw Error('R89 intermediate Home not ready '+v.name);
    const free=await evalJS('('+screenAudit.toString()+')("#freeBattle")');
    check(v.name+' Free Battle center visible/hittable',free.within&&free.hittable&&!free.hidden,free);
    await click('#freeBattle');
    if(!(await wait("(()=>{const c=window.__apexGoldFidelity?.child();return c?.document.querySelector('#stage')?.classList.contains('screen-mode')})()")))
      throw Error(v.name+' mode unavailable');
    const mode=await evalJS('('+screenAudit.toString()+')(".modeCard[data-mode=local1v1]")');
    check(v.name+' Local 1v1 center visible/hittable',mode.within&&mode.hittable&&!mode.hidden,mode);
    await click('.modeCard[data-mode="local1v1"]');
    if(!(await wait("(()=>{const c=window.__apexGoldFidelity?.child();return c?.document.querySelector('#stage')?.classList.contains('screen-fighter')&&c.document.querySelectorAll('#fighterRoster .rosterCard').length>=6})()")))
      throw Error(v.name+' pick unavailable');
    const fighter=await evalJS('('+screenAudit.toString()+')(".rosterCard[data-hero=newbot]")');
    const lock=await evalJS('('+screenAudit.toString()+')("#lockIn")');
    check(v.name+' Fighter roster and LOCK on screen',fighter.within&&lock.within&&!fighter.hidden&&!lock.hidden,{fighter,lock});
    await click('.rosterCard[data-hero="newbot"]');
    await sleep(230);await click('#lockIn');
    if(!(await wait("(()=>window.__apexGoldFidelity?.child()?.document.querySelector('#stage')?.classList.contains('fighter-active-p2'))()")))throw Error(v.name+' P2 handoff failed');
    await click('.rosterCard[data-hero="newbot"]');
    await sleep(230);await click('#lockIn');
    if(!(await wait("(()=>{const d=window.__apexGoldFidelity?.child()?.document;return d?.body.classList.contains('battle-hud-open')&&d.querySelector('#battleHudHost #arena')?.getBoundingClientRect().width>0})()")))throw Error(v.name+' Battle failed');
    const battle=await capture(v.name+'-intermediate-Battle');
    check(v.name+' native Battle Gold layout',
      battle.battle.layout===v.hud&&battle.battle.size===v.size&&battle.battle.mode==='2p',
      battle.battle);
    const arena=await evalJS('('+screenAudit.toString()+')("#battleHudHost #arena")');
    check(v.name+' arena center on screen',arena.within&&!arena.hidden,arena);
    if(v.name==='iphone-se'){
      // This checks CDP native touch routing through BOTH sides of the scaled
      // iframe, not synthetic Event dispatch inside the child document.
      await command('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
      const points=await evalJS("(()=>{const w=window.__apexGoldFidelity.child(),f=document.querySelector('#gold-document').getBoundingClientRect(),s=f.width/w.innerWidth;return ['#p1Side .skill','#p2Side .skill'].map(selector=>{const n=w.document.querySelector(selector);if(!n)return null;const r=n.getBoundingClientRect();return{x:f.x+(r.x+r.width/2)*s,y:f.y+(r.y+r.height/2)*s}})})()");
      const touchReady=await evalJS("(()=>{const w=window.__apexGoldFidelity.child();w.__r89Pointers=[];w.document.addEventListener('pointerdown',e=>w.__r89Pointers.push({id:e.pointerId,type:e.pointerType}),true);return true})()");
      if(points?.every(Boolean)&&touchReady){
        await command('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points.map((p,i)=>({...p,id:i+11}))});
        await sleep(150);
        await command('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        const actual=await evalJS("window.__apexGoldFidelity.child().__r89Pointers");
        check('iPhone SE two simultaneous native touch pointers',
          new Set(actual.filter(x=>x.type==='touch').map(x=>x.id)).size>=2,{actual,points});
      }else check('iPhone SE two simultaneous native touch pointers',false,{points});
    }
    output.push({id:v.name,intermediate:true,viewport:v,meta,battle,arena});
  }

  await writeFile(dir+'/report.json',JSON.stringify({output,failures},null,2));
  console.log('R89 FINAL '+JSON.stringify({profiles:GOLD_PROFILES.length,cases:GOLD_PROFILES.length*2+intermediate.length,failures:failures.length}));
  if(failures.length)throw Error('R89 native Gold profile invariance failed '+failures.length);
}finally{
  try{socket?.close()}catch{}
  chrome.kill('SIGTERM');
}
