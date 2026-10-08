// R77 Home layout browser regression. Uses actual Blink layout/hit testing at
// CSS-pixel portrait viewports; does not claim to emulate Android browser chrome.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { openSync, readFileSync } from 'node:fs';

const url=process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const chromePath=process.env.CHROME_PATH;
if(!chromePath)throw new Error('CHROME_PATH not set');
const port=9255;
const chromeLogFile='/tmp/r83-prod-chrome.log';
const chromeLogFd=openSync(chromeLogFile,'w');
const chrome=spawn(chromePath,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--remote-allow-origins=*','--no-first-run',
  '--remote-debugging-port='+port,'--user-data-dir=/tmp/apex-r83-production-lab-cdp-'+process.pid,
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

  // R83 production flow: Gold Home -> Mode -> Local Pick -> live Battle.
  const dir='docs/acceptance/r83-production-portrait';
  await mkdir(dir,{recursive:true});
  const failures=[];
  const check=(name,ok,detail)=>{console.log((ok?'PASS':'FAIL')+' R83 PROD '+name+' '+JSON.stringify(detail));if(!ok)failures.push(name);};
  const center=sel=>'(()=>{const el=document.querySelector('+JSON.stringify(sel)+');const r=el?.getBoundingClientRect();return r?{x:r.x+r.width/2,y:r.y+r.height/2}:null})()';
  const click=async sel=>{
    const c=await evalJS(center(sel));if(!c)throw Error('Missing interactive '+sel);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',x:c.x,y:c.y,button:'left',clickCount:1});
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:c.x,y:c.y,button:'left',clickCount:1});
  };
  const wait=async exp=>{
    for(let i=0;i<450;i++){
      if(await evalJS(exp).catch(()=>false))return true;
      await sleep(100);
    }
    return false;
  };
  const geometry=()=>{
    const rect=sel=>{const e=document.querySelector(sel);if(!e)return null;const r=e.getBoundingClientRect();const c=getComputedStyle(e);return{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right,opacity:c.opacity,visibility:c.visibility};};
    const content=sel=>{const e=document.querySelector(sel);if(!e)return null;return{
      text:(e.textContent||'').trim(),width:e.clientWidth,scrollWidth:e.scrollWidth,
      clipped:e.scrollWidth>e.clientWidth+1,rect:rect(sel)};
    };
    return {
      viewport:{w:innerWidth,h:innerHeight},screen:document.querySelector('#stage')?.className,
      mode:{title:rect('.modeTitle'),bot:rect('.modeCard[data-mode="bot"]'),
        local:rect('.modeCard[data-mode="local1v1"]'),routes:rect('.routes')},
      battle:{arena:rect('#battleHudHost #arena'),p1:rect('#battleHudHost #p1Side'),
        p2:rect('#battleHudHost #p2Side'),weapon:rect('#battleHudHost #p1Side .weapon'),
        weaponName:rect('#battleHudHost #p1Side .wp-name'),
        skill:rect('#battleHudHost #p1Side .skill'),
        skillKey:rect('#battleHudHost #p1Side .sk-key'),
        p1Name:content('#battleHudHost #p1Side .id-name'),
        p1Hp:rect('#battleHudHost #p1Rail .vr-hp'),
        p1WeaponName:content('#battleHudHost #p1Side .wp-name'),
        p2Name:content('#battleHudHost #p2Side .id-name'),
        p2Hp:rect('#battleHudHost #p2Rail .vr-hp'),
        p2WeaponName:content('#battleHudHost #p2Side .wp-name'),
        p1Skills:rect('#battleHudHost #p1Side .skills'),
        p2Skills:rect('#battleHudHost #p2Side .skills')}
    };
  };
  const shot=async label=>{
    await sleep(900);
    const data=await evalJS('('+geometry.toString()+')()');
    const screenshot=await command('Page.captureScreenshot',{format:'png',fromSurface:true});
    await writeFile(dir+'/'+label+'.png',Buffer.from(screenshot.data,'base64'));
    console.log('R83 PROD SNAP '+label+' '+JSON.stringify(data));
    return data;
  };
  await command('Emulation.setDeviceMetricsOverride',{width:361,height:545,deviceScaleFactor:2,mobile:true,screenWidth:361,screenHeight:545});
  await sleep(550);
  await click('#freeBattle');
  const modeReady=await wait("document.querySelector('#stage')?.classList.contains('screen-mode')");
  check('Home to Mode',modeReady);
  if(!modeReady)throw Error('Mode not reached');
  const mode=await shot('production-mode-361x545');
  check('Mode cards fully inside viewport',mode.mode.bot&&mode.mode.local&&mode.mode.local.bottom<=542&&mode.mode.bot.y>=0,mode.mode);
  check('Home route does not bleed under Mode',mode.mode.routes?.opacity==='0'&&mode.mode.routes?.visibility==='hidden',mode.mode.routes);
  await click('.modeCard[data-mode="local1v1"]');
  const fighterReady=await wait("document.querySelector('#stage')?.classList.contains('screen-fighter') && document.querySelectorAll('#fighterRoster .rosterCard').length>=6");
  check('Mode to Local Fighter Pick',fighterReady);
  if(!fighterReady)throw Error('Fighter Pick not reached');
  await shot('production-pick-361x545');
  await click('.rosterCard[data-hero="newbot"]');await sleep(350);
  await click('#lockIn');
  const p2Ready=await wait("document.querySelector('#stage')?.classList.contains('fighter-active-p2')");
  check('P1 locked, P2 active',p2Ready);
  if(!p2Ready)throw Error('P2 handoff missing');
  await click('.rosterCard[data-hero="newbot"]');await sleep(350);
  await click('#lockIn');
  const battleReady=await wait("document.body.classList.contains('battle-hud-open') && document.querySelector('#battleHudHost #arena')?.getBoundingClientRect().width>0");
  check('Real Local Battle started',battleReady);
  if(!battleReady)throw Error('Local Battle not started');
  const small=await shot('production-battle-361x545');
  const b=small.battle;
  check('361x545 live arena >=300px',b.arena?.w>=300,b.arena);
  check('361x545 gun visible inside P1',b.weapon&&b.p1&&b.weapon.y>=b.p1.y-2&&b.weapon.bottom<=b.p1.bottom+2&&b.weapon.w>=105&&b.weapon.h>=28,{weapon:b.weapon,p1:b.p1});
  check('361x545 gun NAME inside P1',b.weaponName&&b.p1&&b.weaponName.w>=60&&b.weaponName.y>=b.p1.y-2&&b.weaponName.bottom<=b.p1.bottom+2,{name:b.weaponName,p1:b.p1});
  check('361x545 skill KEY inside P1',b.skillKey&&b.p1&&b.skillKey.y>=b.p1.y-2&&b.skillKey.bottom<=b.p1.bottom+2,{key:b.skillKey,p1:b.p1});
  for(const player of ['p1','p2']){
    const side=b[player],name=b[player+'Name'],hp=b[player+'Hp'],gun=b[player+'WeaponName'],skills=b[player+'Skills'];
    check('361x545 '+player+' fighter name not clipped',name&&name.width>=55&&!name.clipped&&name.rect.x>=side.x-2&&name.rect.right<=side.right+2,{name,side});
    check('361x545 '+player+' health bar visible',hp&&hp.w>=50&&hp.h>=12,{hp,side});
    check('361x545 '+player+' gun text not clipped',gun&&gun.width>=55&&!gun.clipped,{gun,side});
    check('361x545 '+player+' skills not covering whole panel',skills&&skills.w<side.w*.55,{skills,side});
  }

  await command('Emulation.setDeviceMetricsOverride',{width:550,height:857,deviceScaleFactor:2,mobile:true,screenWidth:550,screenHeight:857});
  const golden=await shot('production-battle-550x857');
  check('550x857 retains full Golden arena',golden.battle.arena?.w>=520,golden.battle.arena);
  check('550x857 real weapon footer restored and bounded',golden.battle.weapon&&golden.battle.weapon.h>=28&&golden.battle.weapon.w>=160&&golden.battle.weaponName&&golden.battle.weaponName.w>=70&&golden.battle.weaponName.bottom<=golden.battle.p1.bottom+2,{weapon:golden.battle.weapon,name:golden.battle.weaponName,panel:golden.battle.p1});
  for(const player of ['p1','p2']){
    const name=golden.battle[player+'Name'],gun=golden.battle[player+'WeaponName'];
    check('550x857 '+player+' title and weapon not clipped',name&&!name.clipped&&gun&&!gun.clipped,{name,gun});
  }
  await command('Emulation.setDeviceMetricsOverride',{width:320,height:498,deviceScaleFactor:2,mobile:true,screenWidth:320,screenHeight:498});
  const ultraSmall=await shot('production-battle-320x498');
  check('320x498 mobile arena preserved',ultraSmall.battle.arena?.w>=270,ultraSmall.battle.arena);
  for(const player of ['p1','p2']){
    const gun=ultraSmall.battle[player+'WeaponName'],name=ultraSmall.battle[player+'Name'];
    check('320x498 '+player+' real labels have space',name&&name.width>=40&&!name.clipped&&gun&&gun.width>=35&&!gun.clipped,{name,gun});
  }

  await writeFile(dir+'/production-report.json',JSON.stringify({mode,small,golden,ultraSmall,failures},null,2));
  if(failures.length)throw Error('R83 production flow fails '+failures.length+' checks');
  console.log('PASS R83 production Local battle screenshots + geometry at 361x545 and 550x857');
}finally{
  try{socket?.close()}catch{}
  chrome.kill('SIGTERM');
}
