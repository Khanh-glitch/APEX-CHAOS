// Independent B8qd viewport/skill-family Chrome matrix against the actual
// generated Gold HUD. Full genuine Quest/Storm tests run separately.
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const base=(process.env.APEX_APP_URL||'http://127.0.0.1:5173').replace(/\/$/,'');
const chromePath=process.env.CHROME_PATH||'google-chrome';
const dir=process.env.APEX_EVIDENCE_DIR||'/tmp/b8qd-gold-hud';
const port=9394, sleep=ms=>new Promise(r=>setTimeout(r,ms));
const chrome=spawn(chromePath,['--headless=new','--disable-gpu','--no-sandbox',
  '--disable-dev-shm-usage','--remote-allow-origins=*',
  '--remote-debugging-port='+port,
  '--user-data-dir=/tmp/apex-b8qd-family-'+process.pid,
  'about:blank'],{stdio:'ignore'});
const pending=new Map();let serial=0,socket;
function cmd(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++serial,wait=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'))},22000);
    pending.set(id,{resolve:v=>{clearTimeout(wait);resolve(v)},reject:e=>{clearTimeout(wait);reject(e)}});
    try{socket.send(JSON.stringify({id,method,params}))}catch(e){clearTimeout(wait);pending.delete(id);reject(e)}
  });
}
async function evalJS(expression){
  const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result?.value;
}
const failures=[],samples=[];
function gate(label,ok,data){
  console.log((ok?'PASS':'FAIL')+' B8qd '+label+' '+JSON.stringify(data));
  if(!ok)failures.push({label,data});
}
function measure(){
  const hud=document.getElementById('hud');
  const box=el=>{if(!el)return null;const r=el.getBoundingClientRect();
    return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,cx:(r.left+r.right)/2}};
  const arena=box(document.querySelector('#arena')),stage=box(document.getElementById('stage'));
  const left=box(document.getElementById('p1Side')),right=box(document.getElementById('p2Side'));
  const names=[...document.querySelectorAll('#p1Side .skill')].map(tileEl=>{
    const tile=box(tileEl),icon=box(tileEl.querySelector('.sk-art'));
    const info=box(tileEl.querySelector('.sk-info'));
    const name=tileEl.querySelector('.sk-name'),meter=tileEl.querySelector('.sk-meter');
    const status=tileEl.querySelector('.sk-state');
    const nameRect=box(name),meterRect=box(meter),statusRect=box(status);
    const inTile=b=>!!b&&!!tile&&b.left>=tile.left-1.5&&b.right<=tile.right+1.5&&b.top>=tile.top-1.5&&b.bottom<=tile.bottom+1.5;
    const x=tile.cx,y=(tile.top+tile.bottom)/2,hit=document.elementFromPoint(x,y);
    return {title:name.textContent.trim(),phase:tileEl.dataset.state,
      status:status.textContent.trim(),tile,icon,info,nameRect,meterRect,statusRect,
      textFits:name.scrollWidth<=name.clientWidth+1.5&&status.scrollWidth<=status.clientWidth+1.5,
      allInside:inTile(icon)&&inTile(info)&&inTile(nameRect)&&inTile(meterRect)&&inTile(statusRect),
      physicallyHittable:hit===tileEl||tileEl.contains(hit)};
  });
  hud.dataset.quest='0';const native=box(document.querySelector('#arena'));
  hud.dataset.quest='1';
  const p1Title=document.querySelector('#p1Side .id-name');
  const p1TitleFits=!!p1Title&&p1Title.scrollWidth<=p1Title.clientWidth+1.5;
  return {mode:hud.dataset.mode,quest:hud.dataset.quest,layout:hud.dataset.layout,
    viewport:{width:innerWidth,height:innerHeight},stage,arena,native,left,right,names,p1TitleFits,
    centeringError:Math.abs(arena.cx-stage.cx),
    sideAsymmetry:Math.abs(left.width-right.width),
    goldParity:Math.abs(native.cx-arena.cx)+Math.abs(native.width-arena.width)};
}
try{
  await mkdir(dir,{recursive:true});
  let target;
  for(let i=0;i<180;i++){
    try{target=(await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())).find(x=>x.type==='page');if(target)break}catch{}
    await sleep(100);
  }
  if(!target)throw Error('Chrome CDP target unavailable');
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{socket.addEventListener('open',res,{once:true});socket.addEventListener('error',rej,{once:true})});
  socket.addEventListener('message',({data})=>{
    const m=JSON.parse(data),p=pending.get(m.id);if(!p)return;
    pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);
  });
  await cmd('Page.enable');await cmd('Runtime.enable');
  await cmd('Page.navigate',{url:base+'/gold/battle-hud.html'});
  let ready=false;
  for(let i=0;i<110;i++){
    ready=await evalJS("!!(window.APEX_GOLD_HUD?.applyState&&document.querySelector('#p1Side .skill'))").catch(()=>false);
    if(ready)break;await sleep(100);
  }
  if(!ready)throw Error('Generated Gold battle HUD failed to boot');
  await evalJS("APEX_GOLD_HUD.setMode('1p')");
  const cases=[
    {name:'desktop-owner-1560',w:1560,h:992,layout:'desk'},
    {name:'desktop-standard',w:1365,h:768,layout:'desk'},
    {name:'desktop-compact',w:1280,h:800,layout:'desk'},
    {name:'tablet-land-1024',w:1024,h:768,layout:'land'},
    {name:'phone-land-854',w:854,h:393,layout:'land'},
    {name:'phone-land-667',w:667,h:375,layout:'land'},
    {name:'tablet-port-768',w:768,h:1024,layout:'port'},
    {name:'phone-port-390',w:390,h:844,layout:'port'},
    {name:'phone-port-320',w:320,h:568,layout:'port'}
  ];
  for(const c of cases){
    await cmd('Emulation.setDeviceMetricsOverride',{width:c.w,height:c.h,
      deviceScaleFactor:1,mobile:c.layout!=='desk',
      screenOrientation:{type:c.layout==='port'?'portraitPrimary':'landscapePrimary',angle:c.layout==='port'?0:90}});
    await sleep(220);
    for(const phase of ['ready','cd','locked']){
      const skill=k=>({name:k===0?'WEAPON DASH':'VIRTUAL ARMOR',
        kind:k===0?'cooldown':'duration',duration:k===0?0:3,
        cd:10,max:1,charges:phase==='ready'?1:0,
        nextIn:phase==='cd'?10:0,locked:phase==='locked',truth:true});
      const st={timer:10,sides:[
        {identity:{id:'robot',name:'NEWBOT',tag:'ALLY'},hp:1951,maxHp:2000,
          keyLabels:['J','K'],skills:[skill(0),skill(1)]},
        {identity:{id:'scrap',name:'SCRAP',tag:'HOSTILE'},hp:578,maxHp:700}
      ],questTeams:[[{id:'NEWBOT',hp:1951,maxHp:2000}],[{id:'SCRAP',hp:578,maxHp:700}]]};
      await evalJS('APEX_GOLD_HUD.applyState('+JSON.stringify(st)+')');
      await sleep(120);
      const snap=await evalJS('('+measure.toString()+')()');
      const id=c.name+'/'+phase;
      samples.push({id,...snap});
      gate(id+' arena physically centered and within Gold stage',
        snap.quest==='1'&&snap.mode==='1p'&&snap.layout===c.layout&&snap.centeringError<=3.1,
        {layout:snap.layout,delta:snap.centeringError,arena:snap.arena,stage:snap.stage});
      if(c.layout!=='port')gate(id+' same/or larger Gold square with symmetric sides',
        snap.sideAsymmetry<=3.1&&(c.layout==='desk'?snap.goldParity<=3.1:snap.arena.width>=snap.native.width-2),
        {goldParity:snap.goldParity,sideAsymmetry:snap.sideAsymmetry,questWidth:snap.arena.width,donorWidth:snap.native.width});
      gate(id+' both J/K names, statuses, cards and physical hits fit',
        snap.names.length===2&&snap.names[0].title==='WEAPON DASH'
          &&snap.names[1].title==='VIRTUAL ARMOR'
          &&snap.names.every(n=>n.phase===phase&&n.textFits&&n.allInside&&n.physicallyHittable),
        snap.names);
      if(c.layout==='land')gate(id+' LAND visual density: full NEWBOT and normal-size skill artwork, no tall empty cards',
        snap.p1TitleFits&&snap.names.every(n=>n.tile.height<=155&&n.icon.height>=n.tile.height*.42),
        {p1TitleFits:snap.p1TitleFits,tiles:snap.names.map(n=>({h:n.tile.height,iconH:n.icon.height}))});
      if(phase==='ready'&&['desktop-owner-1560','tablet-land-1024','phone-port-390'].includes(c.name)){
        const img=await cmd('Page.captureScreenshot',{format:'png'});
        await writeFile(path.join(dir,'b8qd-'+c.name+'.png'),Buffer.from(img.data,'base64'));
      }
    }
  }
  await writeFile(path.join(dir,'b8qd-report.json'),JSON.stringify({samples,failures},null,2));
  console.log('B8qd SUMMARY '+JSON.stringify({samples:samples.length,failures:failures.length}));
  if(failures.length)process.exitCode=1;
}catch(e){console.error('B8qd FATAL',e);process.exitCode=1}
finally{try{socket?.close()}catch{}chrome.kill('SIGTERM')}
