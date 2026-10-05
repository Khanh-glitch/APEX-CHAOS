// R50K current-product physical browser acceptance.
// Gold shell + Mechanical Door V4 are now the public route authority. This
// intentionally replaces the retired menu/select browser oracle while keeping
// real CDP pointer input and screenshot evidence.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const endpoint = process.env.APEX_CDP_ENDPOINT || 'http://127.0.0.1:9224';
const appUrl = process.env.APEX_APP_URL || 'http://127.0.0.1:5173';
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const evidenceDir = process.env.APEX_EVIDENCE_DIR || 'docs/acceptance/arsenal-product/browser';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let chrome = null;

if (!process.env.APEX_CDP_ENDPOINT) {
  chrome = spawn(chromePath, [
    '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9224',
    '--window-size=1600,900','--user-data-dir=' + path.join(process.cwd(), '.arsenal-chrome-profile'),
    appUrl,
  ], { stdio:'ignore', detached:false });
}

async function pageTarget() {
  for (let i=0;i<100;i++) {
    try {
      const targets = await fetch(endpoint + '/json/list').then(r=>r.json());
      const page = targets.find(x=>x.type==='page');
      if (page) return page;
    } catch {}
    await sleep(200);
  }
  throw new Error('Gold product CDP page did not become ready.');
}

const target = await pageTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{
  socket.addEventListener('open',resolve,{once:true});
  socket.addEventListener('error',reject,{once:true});
});
let serial=0;
const pending=new Map();
socket.addEventListener('message',event=>{
  const msg=JSON.parse(event.data);
  if(!msg.id||!pending.has(msg.id))return;
  const p=pending.get(msg.id); pending.delete(msg.id);
  msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result);
});
function command(method,params={}) {
  const id=++serial;
  socket.send(JSON.stringify({id,method,params}));
  return new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));
}
async function evaluate(expression) {
  const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
  if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result.value;
}
async function screenshot(name) {
  const shot=await command('Page.captureScreenshot',{format:'png'});
  const file=path.join(evidenceDir,name+'.png');
  await writeFile(file,Buffer.from(shot.data,'base64'));
  return file;
}
async function hitProbe(selector) {
  return evaluate(`(() => {
    const el=document.querySelector(${JSON.stringify(selector)});
    if(!el)return {exists:false};
    const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
    const top=document.elementFromPoint(cx,cy),cs=getComputedStyle(el);
    return {exists:true,disabled:!!el.disabled,width:r.width,height:r.height,cx,cy,
      pointerEvents:cs.pointerEvents,display:cs.display,visibility:cs.visibility,
      hitWithin:!!top&&(top===el||el.contains(top)),topId:top?.id||'',topClass:String(top?.className||'')};
  })()`);
}
async function physicalClick(selector) {
  let p=null;
  for(let i=0;i<80;i++){
    p=await hitProbe(selector);
    if(p?.exists&&!p.disabled&&p.hitWithin&&p.pointerEvents!=='none'&&p.width>1&&p.height>1)break;
    await sleep(80);
  }
  if(!p?.exists||p.disabled||!p.hitWithin||p.pointerEvents==='none')return p||{exists:false};
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.cx,y:p.cy});
  await command('Input.dispatchMouseEvent',{type:'mousePressed',x:p.cx,y:p.cy,button:'left',clickCount:1});
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.cx,y:p.cy,button:'left',clickCount:1});
  return p;
}
async function poll(expression,predicate=Boolean,{attempts=250,interval=80}={}) {
  let value=null;
  for(let i=0;i<attempts;i++){
    value=await evaluate(expression);
    if(predicate(value))return value;
    await sleep(interval);
  }
  return value;
}
function ordered(states) {
  const law=['CLOSING','SEALED','OPENING','DONE'];
  let cursor=-1;
  return law.every(x=>{const i=states.indexOf(x,cursor+1);if(i<0)return false;cursor=i;return true;});
}
const report={gates:{},failures:[],evidence:[]};
function gate(name,ok,detail){
  report.gates[name]={pass:!!ok,detail};
  if(!ok)report.failures.push(name);
  console.log((ok?'PASS':'FAIL')+'  '+name+(detail?' — '+JSON.stringify(detail):''));
}
async function transitionSlice(mark) {
  const states=await evaluate(`window.__APEX_R50K_STATES.slice(${mark})`);
  return [...new Set(states.filter(Boolean))];
}

try {
  await mkdir(evidenceDir,{recursive:true});
  await command('Runtime.enable');
  await command('Page.enable');
  await command('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__APEX_R50K_STATES=[];
    window.__APEX_R50K_ERRORS=[];
    window.addEventListener('error',e=>window.__APEX_R50K_ERRORS.push(String(e.message||e.error||'error')));
    const sample=()=>{
      const s=document.body?.dataset?.apexSceneTransition;
      const a=window.__APEX_R50K_STATES;
      if(s&&a[a.length-1]!==s)a.push(s);
    };
    const start=()=>{
      if(!document.documentElement){setTimeout(start,4);return;}
      new MutationObserver(sample).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-apex-scene-transition','class','hidden']});
      const tick=()=>{sample();setTimeout(tick,32)}; tick();
    };
    start();
  `});
  await command('Page.navigate',{url:appUrl});

  const boot=await poll(`(() => ({
    engine:!!window.__apexEngineReady,
    coordinator:window.APEX_SCENE_TRANSITION?.version||'',
    stage:!!document.getElementById('stage'),
    state:document.body?.dataset?.apexSceneTransition||'',
    blackout:document.getElementById('apex-boot-blackout')?.hidden===true,
    loading:!!document.getElementById('loading-screen'),
    oldMenu:!!document.getElementById('menu-screen'),
    oldPicker:!!document.getElementById('select-screen')
  }))()`,v=>v?.engine&&v.coordinator==='mechanical-door-v4-r50k'&&v.stage&&v.state==='DONE'&&v.blackout,
  {attempts:400,interval:75});
  const bootStates=[...new Set(await evaluate('window.__APEX_R50K_STATES.slice()'))];
  gate('boot-dark-to-gold-door-to-home',!!boot?.engine&&boot.coordinator==='mechanical-door-v4-r50k'&&boot.blackout&&ordered(bootStates),{boot,states:bootStates});
  gate('legacy-loader-menu-picker-not-mounted',boot?.loading===false&&boot?.oldMenu===false&&boot?.oldPicker===false,boot);
  gate('boot-has-no-window-errors',(await evaluate('window.__APEX_R50K_ERRORS.slice()')).length===0,await evaluate('window.__APEX_R50K_ERRORS.slice()'));
  report.evidence.push(await screenshot('r50k-boot-home'));

  // HOME -> MODE by the actual Gold CTA.
  let mark=(await evaluate('window.__APEX_R50K_STATES.length'));
  const homeClick=await physicalClick('#freeBattle');
  const mode=await poll(`(() => ({
    mode:document.getElementById('stage')?.classList.contains('screen-mode')||false,
    state:document.body?.dataset?.apexSceneTransition||'',
    active:window.APEX_SCENE_TRANSITION?.active?.()||false
  }))()`,v=>v?.mode&&v.state==='DONE'&&!v.active);
  const homeModeStates=await transitionSlice(mark);
  gate('home-to-mode-physical-pointer-uses-full-door-law',homeClick?.hitWithin===true&&mode?.mode&&ordered(homeModeStates),{pointer:homeClick,states:homeModeStates});
  report.evidence.push(await screenshot('r50k-mode'));

  // MODE -> FIGHTER through the actual card.
  mark=await evaluate('window.__APEX_R50K_STATES.length');
  const modeClick=await physicalClick('.modeCard[data-mode="bot"]');
  const fighter=await poll(`(() => ({
    fighter:document.getElementById('stage')?.classList.contains('screen-fighter')||false,
    roster:document.querySelectorAll('#fighterRoster .rosterCard').length,
    state:document.body?.dataset?.apexSceneTransition||'',
    active:window.APEX_SCENE_TRANSITION?.active?.()||false
  }))()`,v=>v?.fighter&&v.roster>=6&&v.state==='DONE'&&!v.active);
  const modeFighterStates=await transitionSlice(mark);
  gate('mode-to-fighter-physical-pointer-uses-full-door-law',modeClick?.hitWithin===true&&fighter?.fighter&&fighter.roster>=6&&ordered(modeFighterStates),{pointer:modeClick,states:modeFighterStates,fighter});
  report.evidence.push(await screenshot('r50k-fighter'));

  // FIGHTER -> BATTLE. The target iframe/runtime must be READY before OPEN
  // completes; the public door owns the whole handoff.
  mark=await evaluate('window.__APEX_R50K_STATES.length');
  const lockClick=await physicalClick('#lockIn');
  const battle=await poll(`(() => ({
    open:document.body.classList.contains('battle-hud-open'),
    host:document.getElementById('battleHudHost')?.classList.contains('is-open')||false,
    hud:!!window.APEX_GOLD_HUD,
    live:!!window.APEX_ARSENAL?.state?.active,
    state:document.body?.dataset?.apexSceneTransition||'',
    active:window.APEX_SCENE_TRANSITION?.active?.()||false
  }))()`,v=>v?.open&&v.host&&v.hud&&v.live&&v.state==='DONE'&&!v.active,{attempts:500,interval:80});
  const fighterBattleStates=await transitionSlice(mark);
  gate('fighter-to-battle-reveals-only-after-live-ready',lockClick?.hitWithin===true&&battle?.open&&battle?.host&&battle?.hud&&battle?.live&&ordered(fighterBattleStates),{pointer:lockClick,states:fighterBattleStates,battle});
  report.evidence.push(await screenshot('r50k-battle'));

  // Responsive contract: Gold transition canvas tracks the real viewport after
  // a portrait resize; donor DPR/geometry logic remains runtime authority.
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true,screenWidth:390,screenHeight:844});
  await sleep(260);
  const responsive=await evaluate(`(() => {
    const c=document.getElementById('apex-scene-transition'),r=c?.getBoundingClientRect();
    return {w:r?.width||0,h:r?.height||0,backingW:c?.width||0,backingH:c?.height||0,dpr:devicePixelRatio||1};
  })()`);
  gate('gold-transition-responsive-canvas-follows-portrait-viewport',
    Math.abs(responsive.w-390)<2&&Math.abs(responsive.h-844)<2&&responsive.backingW>=390&&responsive.backingH>=844,responsive);

  const errors=await evaluate('window.__APEX_R50K_ERRORS.slice()');
  gate('transition-flow-no-window-errors',errors.length===0,errors);

  await writeFile(path.join(evidenceDir,'r50k-gold-product-report.json'),JSON.stringify(report,null,2));
} catch(error) {
  report.failures.push('browser-runner-exception');
  report.exception=String(error?.stack||error);
  console.error(report.exception);
  try {
    await mkdir(evidenceDir,{recursive:true});
    report.evidence.push(await screenshot('r50k-browser-exception'));
    await writeFile(path.join(evidenceDir,'r50k-gold-product-report.json'),JSON.stringify(report,null,2));
  } catch {}
} finally {
  try{socket.close()}catch{}
  if(chrome)try{chrome.kill('SIGTERM')}catch{}
}

if(report.failures.length){
  console.error('R50K GOLD PRODUCT BROWSER ACCEPTANCE FAIL:',report.failures.join(', '));
  process.exit(1);
}
console.log('R50K GOLD PRODUCT BROWSER ACCEPTANCE PASS');
