// R77 Home layout browser regression. Uses actual Blink layout/hit testing at
// CSS-pixel portrait viewports; does not claim to emulate Android browser chrome.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { openSync, readFileSync } from 'node:fs';

const url=process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const chromePath=process.env.CHROME_PATH;
if(!chromePath)throw new Error('CHROME_PATH not set');
const port=9252;
const chromeLogFile='/tmp/r83-chrome.log';
const chromeLogFd=openSync(chromeLogFile,'w');
const chrome=spawn(chromePath,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--remote-allow-origins=*','--no-first-run',
  '--remote-debugging-port='+port,'--user-data-dir=/tmp/apex-r83-local-lab-cdp-'+process.pid,
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
  // R83 renders the production-bridged Gold battle HUD, not the demo donor.
  const reportDir='docs/acceptance/r83-local-portrait';
  await mkdir(reportDir,{recursive:true});
  const hudUrl=new URL('/gold/battle-hud.html',url).href;
  await command('Emulation.setDeviceMetricsOverride',{width:550,height:857,
    deviceScaleFactor:2,mobile:true,screenWidth:550,screenHeight:857});
  await command('Page.navigate',{url:hudUrl});
  for(let i=0;i<200;i++){
    const ok=await evalJS("!!window.APEX_GOLD_HUD?.setMode && !!document.querySelector('#hud') && document.querySelector('#arenaCanvas')?.width > 0").catch(()=>false);
    if(ok)break;
    await sleep(75);
  }
  await evalJS("window.APEX_GOLD_HUD.setMode('2p')");
  const evalGeometry=()=>{
    const selectors={
      hud:'#hud',arena:'#arena',canvas:'#arenaCanvas',
      p1:'#p1Side',p2:'#p2Side',rail:'#versusRail',
      p1id:'#p1Side .ident',p2id:'#p2Side .ident',
      p1skills:'#p1Side .skills',p2skills:'#p2Side .skills',
      p1s1:'#p1Side .skill',p2s1:'#p2Side .skill',
      p1s2:'#p1Side .skill:nth-child(2)',p2s2:'#p2Side .skill:nth-child(2)',
      p1hp:'#p1Rail',p2hp:'#p2Rail',
      p1gun:'#p1Side .weapon',p2gun:'#p2Side .weapon',
      timer:'#matchCenter'
    };
    const rect=(sel)=>{
      const el=document.querySelector(sel);if(!el)return null;
      const b=el.getBoundingClientRect();const c=getComputedStyle(el);
      return {x:b.x,y:b.y,w:b.width,h:b.height,bottom:b.bottom,right:b.right,display:c.display};
    };
    const elems=Object.fromEntries(Object.entries(selectors).map(([name,sel])=>[name,rect(sel)]));
    const centerTarget=(sel)=>{
      const el=document.querySelector(sel),b=el?.getBoundingClientRect();
      if(!b)return false;
      return !!document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest(sel);
    };
    return {w:innerWidth,h:innerHeight,mode:document.querySelector('#hud')?.dataset.mode,
      layout:document.querySelector('#hud')?.dataset.layout,
      size:document.querySelector('#hud')?.dataset.size,
      arenaVar:getComputedStyle(document.querySelector('#hud')).getPropertyValue('--zoneMin').trim(),
      rotatedP2:getComputedStyle(document.querySelector('#p2Side')).rotate,
      els:elems,
      hitSkill1:centerTarget('#p1Side .skill'),
      hitSkill2:centerTarget('#p2Side .skill')};
  };
  const capture=async (label,w,h,mode='2p')=>{
    await command('Emulation.setDeviceMetricsOverride',{width:w,height:h,
      deviceScaleFactor:2,mobile:true,screenWidth:w,screenHeight:h});
    await evalJS('window.APEX_GOLD_HUD.setMode('+JSON.stringify(mode)+')');
    await sleep(480);
    const data=await evalJS('('+evalGeometry.toString()+')()');
    const shot=await command('Page.captureScreenshot',{format:'png',fromSurface:true});
    await writeFile(reportDir+'/'+label+'.png',Buffer.from(shot.data,'base64'));
    console.log('R83 GEOMETRY '+label+' '+JSON.stringify(data));
    return data;
  };
  const cases=[
    ['golden-local-550x857',550,857,'2p'],
    ['user-local-361x545',361,545,'2p'],
    ['compact-local-360x560',360,560,'2p'],
    ['small-local-320x498',320,498,'2p'],
    ['tall-local-390x844',390,844,'2p'],
    ['bot-361x545',361,545,'1p']
  ];
  const results={},failures=[];
  const check=(name,ok,detail=null)=>{console.log((ok?'PASS':'FAIL')+' R83 '+name+(detail?' '+JSON.stringify(detail):''));if(!ok)failures.push({name,detail});};
  const inside=(inner,outer,tolerance=2)=>Boolean(inner&&outer&&inner.x>=outer.x-tolerance&&inner.y>=outer.y-tolerance&&inner.right<=outer.right+tolerance&&inner.bottom<=outer.bottom+tolerance);
  for(const [label,w,h,mode] of cases){
    const z=results[label]=await capture(label,w,h,mode),e=z.els;
    check(label+' correct mode/layout',z.mode===mode&&z.layout==='port');
    check(label+' canvas matches arena',Math.abs(e.canvas.w-e.arena.w)<1&&Math.abs(e.canvas.h-e.arena.h)<1);
    check(label+' arena fully onscreen',inside(e.arena,{x:0,y:0,right:w,bottom:h}));
    check(label+' arena square',Math.abs(e.arena.w-e.arena.h)<1.5);
    check(label+' side order',e.p2.bottom<=e.arena.y+2&&e.p1.y>=e.arena.bottom-2);
    check(label+' skills target visible',z.hitSkill1&&(mode==='1p'||z.hitSkill2));
    for(const pi of ['p1','p2']){
      check(label+'/'+pi+' skills in player zone',inside(e[pi+'skills'],e[pi]));
      check(label+'/'+pi+' weapon in player zone',inside(e[pi+'gun'],e[pi]));
      check(label+'/'+pi+' identity in player zone',inside(e[pi+'id'],e[pi]));
    }
  }
  check('Golden arena >=520px',results['golden-local-550x857'].els.arena.w>=520);
  check('User 361x545 arena >=300px',results['user-local-361x545'].els.arena.w>=300);
  check('Small 320x498 arena >=270px',results['small-local-320x498'].els.arena.w>=270);
  check('P2 portrait rotated 180deg',results['user-local-361x545'].rotatedP2==='180deg');
  check('BOT independently owns arena',results['bot-361x545'].els.arena.w>0);
  await writeFile(reportDir+'/geometry.json',JSON.stringify({results,failures},null,2));
  console.log('R83 RESULTS '+JSON.stringify({passes:'See per-case logs',failures:failures.length}));
  if(failures.length)throw Error('R83 failed '+failures.length+' real Chrome geometry/interaction checks');
}finally{
  try{socket?.close()}catch{}
  chrome.kill('SIGTERM');
}
