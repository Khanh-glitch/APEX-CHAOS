// R77 Home layout browser regression. Uses actual Blink layout/hit testing at
// CSS-pixel portrait viewports; does not claim to emulate Android browser chrome.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const url=process.env.APEX_APP_URL || 'http://127.0.0.1:5173/gold/shell.html';
const chromePath=process.env.CHROME_PATH;
if(!chromePath)throw new Error('CHROME_PATH not set');
const port=9235;
const chrome=spawn(chromePath,[
  '--headless=new','--no-sandbox','--disable-gpu','--no-first-run',
  '--remote-debugging-port='+port,'--user-data-dir=/tmp/apex-r77-cdp-'+process.pid,
  'about:blank',
],{stdio:'ignore'});
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
  if(!target)throw new Error('Chrome CDP page unavailable');
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
  const cases=[[480,0],[540,0],[568,0],[600,0],[640,0],[700,0],[844,0],[568,24],[640,24]];
  const failures=[];
  for(const [height,safeB] of cases){
    await command('Emulation.setDeviceMetricsOverride',{
      width:360,height,deviceScaleFactor:1,mobile:true,screenWidth:360,screenHeight:height,
    });
    await command('Page.navigate',{url});
    let loaded=false;
    for(let i=0;i<100;i++){
      const found=await evalJS("Boolean(document.querySelector('#stage .actions')&&document.querySelector('#stage .routes')&&document.querySelector('#freeBattle'))").catch(()=>false);
      if(found){loaded=true;break}
      await sleep(100);
    }
    if(!loaded)throw new Error('Gold Shell Home DOM missing at height '+height);
    await evalJS("document.documentElement.style.setProperty('--safeB',"+JSON.stringify(safeB+'px')+")");
    await sleep(250);
    const sample=await evalJS(`(() => {
      const actions=document.querySelector('#stage .actions');
      const routes=document.querySelector('#stage .routes');
      const battle=document.querySelector('#freeBattle');
      const a=actions.getBoundingClientRect(),r=routes.getBoundingClientRect(),b=battle.getBoundingClientRect();
      const hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
      return {width:innerWidth,height:innerHeight,gap:r.top-a.bottom,actionsTop:a.top,
        hit:!!hit?.closest?.('#freeBattle'),hitName:hit?.id||hit?.className||''};
    })()`);
    const unchanged=height<640||Math.abs(sample.actionsTop-(height<=700?.654:.671)*height)<3;
    const ok=sample.gap>=7&&sample.hit&&unchanged;
    console.log((ok?'PASS':'FAIL')+' R77 '+height+'px safe='+safeB+'px '+JSON.stringify(sample));
    if(!ok)failures.push({height,safeB,...sample,unchanged});
  }
  if(failures.length)throw new Error('R77 Chrome viewport regressions: '+JSON.stringify(failures));
  console.log('R77 Chrome portrait geometry and hit testing: PASS '+cases.length+'/9');
}finally{
  try{socket?.close()}catch{}
  chrome.kill('SIGTERM');
}
