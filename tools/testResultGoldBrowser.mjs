// Result Gold authentic Chrome gate: immutable owner design, native match data.
// NO modification of Gold JSX/CSS or artificial result state inside React.
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const base=(process.env.APEX_APP_URL||'http://127.0.0.1:5173').replace(/\/$/,'');
const chrome=process.env.CHROME_PATH||'google-chrome';
const dir=process.env.APEX_EVIDENCE_DIR||'/tmp/result-gold-browser';
const port=9497,delay=n=>new Promise(r=>setTimeout(r,n));
const proc=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu',
 '--disable-dev-shm-usage','--remote-allow-origins=*','--remote-debugging-port='+port,
 '--user-data-dir=/tmp/apex-result-gold-'+process.pid,'about:blank'],{stdio:'ignore'});
let ws,id=0;const requests=new Map(),failures=[],views=[];
function cd(method,params={}){
 return new Promise((resolve,reject)=>{
  const n=++id,alarm=setTimeout(()=>{requests.delete(n);reject(Error(method+' timed out'))},20000);
  requests.set(n,{resolve:r=>{clearTimeout(alarm);resolve(r)},reject:e=>{clearTimeout(alarm);reject(e)}});
  ws.send(JSON.stringify({id:n,method,params}));
 });
}
async function ev(expression){
 const x=await cd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(x.exceptionDetails)throw Error(x.exceptionDetails.exception?.description||x.exceptionDetails.text);
 return x.result?.value;
}
async function poll(expression,ok,n=100){
 for(let i=0;i<n;i++){const x=await ev(expression).catch(()=>null);if(ok(x))return x;await delay(100)}
 return null;
}
function check(label,ok,details){
 console.log((ok?'PASS':'FAIL')+' RESULT GOLD '+label+' '+JSON.stringify(details).slice(0,1600));
 if(!ok)failures.push({label,details});
}
async function click(selector){
 const q=await ev('(function(){const e=document.querySelector('+JSON.stringify(selector)+');if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
 if(!q)throw Error('Gold control missing '+selector);
 await cd('Input.dispatchMouseEvent',{type:'mouseMoved',x:q.x,y:q.y});
 await cd('Input.dispatchMouseEvent',{type:'mousePressed',x:q.x,y:q.y,button:'left',clickCount:1});
 await cd('Input.dispatchMouseEvent',{type:'mouseReleased',x:q.x,y:q.y,button:'left',clickCount:1});
}
async function makeNativeResult(){
 const scripts=['/game/arsenal/arsenalCWeaponSet.generated.js',
  '/game/results/ownerAwards.generated.js','/game/results/matchResultAuthority.js'];
 for(const src of scripts)await new Promise((resolve,reject)=>{
  const el=document.createElement('script');el.src=src;el.onload=resolve;
  el.onerror=()=>reject(Error('missing native authority: '+src));document.head.appendChild(el);
 });
 const actors=[{id:1,name:'ROBOT',x:180,y:450,hp:1000,maxHp:1000},
  {id:2,name:'HUNTER',x:820,y:450,hp:1000,maxHp:1000}];
 const cfg={WEAPONS:{PISTOL:{family:'SEMI'}},tierOf:()=> 'T1'};
 const ledger=window.APEX_MATCH_RESULT_AUTHORITY.create({actors,mode:'BOT',startedAt:1720000000000,weaponConfig:cfg});
 ledger.onPickup(actors[0],'PISTOL');ledger.onPickup(actors[1],'PISTOL');
 ledger.onShot(actors[0],'PISTOL');actors[1].hp=400;
 ledger.onDamage(actors[1],actors[0],'arsenal-pistol',600);
 ledger.tick(1.2);ledger.onShot(actors[1],'PISTOL');actors[0].hp=880;
 ledger.onDamage(actors[0],actors[1],'arsenal-pistol',120);
 ledger.tick(.4);ledger.onShot(actors[0],'PISTOL');actors[1].hp=0;
 ledger.onDamage(actors[1],actors[0],'arsenal-pistol',400);
 const match=ledger.seal('P1');window.__goldProof=match;
 window.__goldContinue=[];
 window.addEventListener('message',e=>{
  if(e.data?.type==='APEX_RESULT_GOLD_CONTINUE')
   window.__goldContinue.push({origin:e.origin,matchId:e.data.matchId});
 });
 window.postMessage({type:'APEX_RESULT_GOLD_PAYLOAD',match},location.origin);
 return {id:match.meta.id,damage:match.weaponOfTheBattle.damage,
  winner:match.players[0].outcome,loser:match.players[1].outcome,
  ownerTitles:window.APEX_RESULT_OWNER_CATALOG.length,
  portraits:match.players.map(p=>p.character.portraitSrc),
  gun:match.weapons.find(w=>w.id==='PISTOL')?.artSrc};
}
function inspect(){
 const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();
  return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
 const stage=document.querySelector('.ac-stage'),button=document.querySelector('.dock .btn--primary');
 const images=[...document.querySelectorAll('.hero__img')].map(e=>({src:e.getAttribute('src'),ok:e.complete&&e.naturalWidth>0}));
 const gun=document.querySelector('.weapon__dais img');
 const pos=rect(button),center=pos?document.elementFromPoint(pos.x+pos.w/2,pos.y+pos.h/2):null;
 return {viewport:{w:innerWidth,h:innerHeight},stage:rect(stage),button:pos,done:!!document.querySelector('.ac-run.is-done'),
  enabled:!!button&&!button.disabled,hittable:!!button&&(center===button||button.contains(center)),
  heroes:document.querySelectorAll('.hero').length,images,
  gun:gun?{src:gun.getAttribute('src'),ok:gun.complete&&gun.naturalWidth>0}:null,
  placeholders:[...document.querySelectorAll('.art-tag')].map(e=>e.textContent.trim()),
  text:stage?.innerText.slice(0,350),scrollW:document.documentElement.scrollWidth};
}
try{
 await mkdir(dir,{recursive:true});
 let target=null;
 for(let i=0;i<170;i++){
  try{target=(await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())).find(x=>x.type==='page');if(target)break}catch{}
  await delay(100);
 }
 if(!target)throw Error('Chrome CDP target absent');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true})});
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=requests.get(m.id);if(!p)return;requests.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)});
 await cd('Page.enable');await cd('Runtime.enable');
 await cd('Page.navigate',{url:base+'/result-gold/index.html'});
 if(!await poll("!!document.querySelector('.ac-root')",Boolean,140))throw Error('Result Gold React not ready');
 await delay(150);
 const receipt=await ev('('+makeNativeResult.toString()+')()');
 check('native Fighter result + 47 titles and true art IDs',receipt?.damage===1120
  &&receipt?.winner==='victory'&&receipt?.loser==='defeat'&&receipt?.ownerTitles===47
  &&receipt.portraits.every(x=>x.includes('pick_selected_large'))
  &&receipt.gun?.includes('/weapons/c/PISTOL.png'),receipt);
 if(!await poll("document.querySelectorAll('.hero').length===2",Boolean,90))
  throw Error('Result Gold did not receive native ledger payload');
 await cd('Page.bringToFront');
 await click('.skip'); // actual authored Skip control, unchanged six-phase choreography
 if(!await poll("!!document.querySelector('.ac-run.is-done')",Boolean,90))
  throw Error('Gold physical Skip failed');
 const layouts=[{name:'desktop-1560',w:1560,h:992},{name:'tablet-land-1024',w:1024,h:768},
  {name:'phone-port-390',w:390,h:844},{name:'compact-port-320',w:320,h:568}];
 for(const v of layouts){
  await cd('Emulation.setDeviceMetricsOverride',{width:v.w,height:v.h,deviceScaleFactor:1,
   mobile:v.w<500,screenOrientation:{type:v.w<v.h?'portraitPrimary':'landscapePrimary',angle:v.w<v.h?0:90}});
  await delay(350);
  let snap=await poll('('+inspect.toString()+')()',x=>x?.images?.length===2
   &&x.images.every(i=>i.ok)&&x.gun?.ok,80);
  snap=snap||await ev('('+inspect.toString()+')()');
  views.push({name:v.name,...snap});
  check(v.name+' actual Pick hero art, PISTOL art, zero placeholders',
   snap.images.length===2&&snap.images.every(i=>i.ok&&i.src.includes('pick_selected_large'))
    &&snap.gun?.ok&&snap.gun.src.includes('PISTOL.png')&&snap.placeholders.length===0,
   {images:snap.images,gun:snap.gun,placeholders:snap.placeholders});
  const st=snap.stage;
  check(v.name+' stage viewport bounds and physical Continue',
   snap.heroes===2&&snap.done&&snap.enabled&&snap.hittable
    &&st&&st.x>=-3&&st.y>=-3&&st.right<=v.w+3&&st.bottom<=v.h+3,
   {stage:st,button:snap.button,done:snap.done,enabled:snap.enabled,hittable:snap.hittable});
  const img=await cd('Page.captureScreenshot',{format:'png'});
  await writeFile(path.join(dir,'result-gold-'+v.name+'.png'),Buffer.from(img.data,'base64'));
 }
 await cd('Emulation.setDeviceMetricsOverride',{width:1560,height:992,deviceScaleFactor:1,mobile:false});
 await delay(160);await click('.dock .btn--primary');
 const cont=await poll('window.__goldContinue',x=>Array.isArray(x)&&x.length>0,50);
 check('physical Continue carries exact native match ID and origin',
  cont?.length===1&&cont[0].matchId===receipt.id
   &&cont[0].origin===new URL(base).origin,cont);
 await writeFile(path.join(dir,'result-gold-report.json'),JSON.stringify({receipt,views,continue:cont,failures},null,2));
 console.log('RESULT GOLD CHROME SUMMARY '+JSON.stringify({viewports:views.length,failures:failures.length}));
 if(failures.length)process.exitCode=1;
}catch(e){console.error('RESULT GOLD CHROME FATAL',e);process.exitCode=1}
finally{try{ws?.close()}catch{}proc.kill('SIGTERM')}
