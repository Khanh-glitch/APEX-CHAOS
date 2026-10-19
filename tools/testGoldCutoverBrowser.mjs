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
    // Real gesture autoplay policy: do not bypass Chrome's media restrictions.
    '--remote-debugging-port=9224',
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
// A target inside a horizontal scrollport (the 14-fighter roster scrolls
// inside its authored six-across deck band) may sit outside the port when
// the screen opens — Fighter Select canonically opens on page 1 with the
// default fighter already selected, wherever that card lives. A real user
// wheels the port until the card is reachable, then clicks; do exactly
// that with physical wheel input instead of assuming the card starts
// in-port. The click gates still require a true centre hit afterwards.
async function wheelIntoView(selector) {
  const info=await evaluate(`(() => {
    const el=document.querySelector(${JSON.stringify(selector)});
    if(!el)return null;
    let p=el.parentElement;
    while(p&&p!==document.body){
      const s=getComputedStyle(p);
      if((s.overflowX==='auto'||s.overflowX==='scroll')&&p.scrollWidth>p.clientWidth+4)break;
      p=p.parentElement;
    }
    if(!p||p===document.body)return null;
    const er=el.getBoundingClientRect(),pr=p.getBoundingClientRect();
    const dir=er.left<pr.left?-1:(er.right>pr.right?1:0);
    return dir?{x:pr.left+pr.width/2,y:pr.top+pr.height/2,dir}:null;
  })()`);
  if(!info)return false;
  await command('Input.dispatchMouseEvent',{type:'mouseWheel',x:info.x,y:info.y,deltaX:info.dir*260,deltaY:0});
  return true;
}
async function physicalClick(selector) {
  let p=null;
  for(let attempt=0;attempt<3;attempt++){
    let prev=null;
    p=null;
    for(let i=0;i<80;i++){
      p=await hitProbe(selector);
      const valid=p?.exists&&!p.disabled&&p.hitWithin&&p.pointerEvents!=='none'&&p.width>1&&p.height>1;
      if(!valid){prev=null;if(p?.exists)await wheelIntoView(selector);await sleep(80);continue;}
      // The Gold stage re-scales in steps for over a second after the R77
      // device-metrics overrides are cleared (measured centre drift
      // 491 -> 465 -> 677 -> 691 on #freeBattle). Firing at the first hittable
      // frame can strike a layout that has already moved on, so require the
      // centre to hold still across two probes first — a settled target is
      // what a real pointer gets. Every downstream gate is unchanged.
      if(prev&&Math.abs(p.cx-prev.cx)<=1&&Math.abs(p.cy-prev.cy)<=1)break;
      prev=p;
      await sleep(80);
    }
    if(!p?.exists||p.disabled||!p.hitWithin||p.pointerEvents==='none')return p||{exists:false};
    await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.cx,y:p.cy});
    // Verify at fire time: wheel momentum (after wheelIntoView) and rescale
    // steps can still carry the target between the stability probes and the
    // press, which used to land the click on a neighbouring roster card.
    // Re-probe once and only press if the centre is still the measured,
    // hittable point; otherwise re-aim without having fired.
    const verify=await hitProbe(selector);
    // Tolerance scales with the target: hover transforms shift large
    // cards' centres by a few px on mouseMoved (still a safely centred
    // hit); wheel-momentum / rescale drift is far larger.
    const tol=Math.max(2,Math.min(p.width,p.height)*0.1);
    if(!verify?.hitWithin||Math.abs(verify.cx-p.cx)>tol||Math.abs(verify.cy-p.cy)>tol)continue;
    await command('Input.dispatchMouseEvent',{type:'mousePressed',x:p.cx,y:p.cy,button:'left',clickCount:1});
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.cx,y:p.cy,button:'left',clickCount:1});
    return p;
  }
  return p||{exists:false};
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
    window.__APEX_R69_OPEN_BACKING=[];
    window.__APEX_R50K_ERRORS=[];
    window.addEventListener('error',e=>window.__APEX_R50K_ERRORS.push(String(e.message||e.error||'error')));
    const sample=()=>{
      const s=document.body?.dataset?.apexSceneTransition;
      const a=window.__APEX_R50K_STATES;
      if(s&&a[a.length-1]!==s)a.push(s);
      const tx=window.APEX_SCENE_TRANSITION?.state?.();
      if(s==='OPENING'&&tx?.openingBacking)
        window.__APEX_R69_OPEN_BACKING.push({...tx.openingBacking});

    };
    const start=()=>{
      if(!document.documentElement){setTimeout(start,4);return;}
      new MutationObserver(sample).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-apex-scene-transition','class','hidden']});
      const tick=()=>{sample();setTimeout(tick,32)}; tick();
    };
    start();
  `});
  await command('Page.navigate',{url:appUrl});

  // R61: START is the user's real gesture after Home assets and music authority
  // have loaded. Do not bypass the browser autoplay policy in this test.
  const startReady=await poll(`(() => ({
    button:!!document.getElementById('apex-boot-start'),
    shell:document.getElementById('gold-shell-host')?.dataset?.apexGoldMounted==='1',
    music:typeof window.apexProductMusic?.request==='function',
    black:document.getElementById('apex-boot-blackout')?.hidden===true
  }))()`,v=>v?.button&&v.shell&&v.music,{attempts:400,interval:75});
  gate('boot-START-appears-after-Home-and-music-authority',
    !!startReady?.button&&!!startReady?.shell&&!!startReady?.music&&!startReady?.black,startReady);
  report.evidence.push(await screenshot('r61-boot-start'));
  const startClick=await physicalClick('#apex-boot-start');
  gate('boot-START-is-physically-clickable',startClick?.hitWithin===true,startClick);
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
  const openingFrames=await evaluate('window.__APEX_R69_OPEN_BACKING.slice()');
  gate('R69 actual OPENING pose never paints opaque black iris',
    openingFrames.length>0&&openingFrames.every(f=>
      f.cover===0&&f.revealR===0&&f.vignette===0),
    {frames:openingFrames.length,first:openingFrames[0],last:openingFrames.at(-1)});
  gate('boot-dark-to-gold-door-to-home',!!boot?.engine&&boot.coordinator==='mechanical-door-v4-r50k'&&boot.blackout&&ordered(bootStates),{boot,states:bootStates});
  gate('legacy-loader-menu-picker-not-mounted',boot?.loading===false&&boot?.oldMenu===false&&boot?.oldPicker===false,boot);
  gate('boot-has-no-window-errors',(await evaluate('window.__APEX_R50K_ERRORS.slice()')).length===0,await evaluate('window.__APEX_R50K_ERRORS.slice()'));
  // R63 verifies the actual rendered destination, not just the Door state.
  // A successful Door can otherwise expose a hidden/zoomed/black secondary layer.
  const bootReveal=await evaluate(`(() => {
    const host=document.getElementById('gold-shell-host');
    const stage=document.getElementById('stage');
    const door=document.getElementById('apex-scene-transition');
    const start=document.getElementById('apex-boot-start');
    const h=host&&getComputedStyle(host);
    const r=stage?.getBoundingClientRect();
    const music=window.__apexMenuBgmState?.()||null;
    return {
      hostVisible:!!h&&h.display!=='none'&&h.visibility!=='hidden'&&Number(h.opacity)>0.95,
      transform:h?.transform||'', stageWidth:r?.width||0,stageHeight:r?.height||0,
      startGone:!start, doorVisible:door?.style.display!=='none',
      musicPaused:music?.paused??null, musicBlocked:music?.blocked??null
    };
  })()`);
  gate('R63-door-reveals-full-size-real-Home-without-second-iris',
    bootReveal.hostVisible&&bootReveal.startGone&&!bootReveal.doorVisible&&
    (bootReveal.transform==='none'||bootReveal.transform==='matrix(1, 0, 0, 1, 0, 0)')&&
    bootReveal.stageWidth>=.9*1600&&bootReveal.stageHeight>=.9*900,
    bootReveal);
  report.evidence.push(await screenshot('r50k-boot-home'));

  // R77: measure actual Home hit rectangles in the browser, not only CSS
  // source or guessed device ratios. Revert all overrides before normal play.
  const homePortraitProbes = [];
  const portraitCases = [
    [480,0],[540,0],[568,0],[600,0],[640,0],[700,0],[844,0],
    [568,24],[640,24],
  ];
  try {
    for (const [height,safeB] of portraitCases) {
      await command('Emulation.setDeviceMetricsOverride',{
        width:360,height,deviceScaleFactor:1,mobile:true,
        screenWidth:360,screenHeight:height,
      });
      await evaluate(`document.documentElement.style.setProperty('--safeB',${JSON.stringify(String(safeB)+'px')})`);
      await sleep(120);
      const sample=await evaluate(`(() => {
        const actions=document.querySelector('#stage .actions');
        const routes=document.querySelector('#stage .routes');
        const battle=document.querySelector('#freeBattle');
        const a=actions?.getBoundingClientRect(), r=routes?.getBoundingClientRect(), b=battle?.getBoundingClientRect();
        if(!a||!r||!b)return {valid:false};
        const centerX=b.left+b.width/2,centerY=b.top+b.height/2;
        const hit=document.elementFromPoint(centerX,centerY);
        return {valid:true,viewport:{width:innerWidth,height:innerHeight},
          actionsTop:a.top,actionsBottom:a.bottom,routesTop:r.top,
          gap:r.top-a.bottom,battleHit:!!hit?.closest?.('#freeBattle')};
      })()`);
      homePortraitProbes.push({height,safeB,...sample});
    }
  } finally {
    await evaluate("document.documentElement.style.removeProperty('--safeB')");
    await command('Emulation.clearDeviceMetricsOverride');
    // The fidelity stage re-scales in steps for over a second after the
    // metrics overrides clear (measured #freeBattle centre drift
    // 491 -> 465 -> 677 -> 691 across ~1.7s, with plateaus between steps).
    // A flat 180ms wait resumes physical pointer work mid-rescale and the
    // click lands wherever the layout used to be. Wait until the stage
    // rect has been unchanged for a full 900ms window instead.
    let lastRect='',stableSince=Date.now();
    for(let i=0;i<120;i++){
      const rect=await evaluate(`(()=>{const r=document.getElementById('stage')?.getBoundingClientRect();return r?[r.width,r.height,r.left,r.top].join(','):''})()`);
      if(rect&&rect===lastRect&&Date.now()-stableSince>=900)break;
      if(rect!==lastRect){lastRect=rect;stableSince=Date.now();}
      await sleep(80);
    }
    await sleep(180);
  }
  gate('R77-Android-short-portrait-primary-buttons-never-intersect-route-band',
    homePortraitProbes.every(p=>p.valid&&p.gap>=7&&p.battleHit),
    homePortraitProbes);
  gate('R77-healthy-portrait-height-preserves-authored-primary-position',
    homePortraitProbes.filter(p=>p.safeB===0&&p.height>=640)
      .every(p=>Math.abs(p.actionsTop-(p.height<=700?.654:.671)*p.height)<3),
    homePortraitProbes.filter(p=>p.safeB===0&&p.height>=640));

  // HOME -> MODE by the actual Gold CTA.
  let mark=(await evaluate('window.__APEX_R50K_STATES.length'));
  const homeClick=await physicalClick('#freeBattle');
  const mode=await poll(`(() => ({
    mode:document.getElementById('stage')?.classList.contains('screen-mode')||false,
    state:document.body?.dataset?.apexSceneTransition||'',
    active:window.APEX_SCENE_TRANSITION?.active?.()||false
  }))()`,v=>v?.mode&&v.state==='DONE'&&!v.active);
  const homeModeStates=await transitionSlice(mark);
  const homeModeDoorStates=homeModeStates.filter(s=>['CLOSING','SEALED','OPENING'].includes(s));
  gate('home-to-mode-physical-pointer-is-doorless-gold-shell-step',
    homeClick?.hitWithin===true&&mode?.mode&&homeModeDoorStates.length===0,
    {pointer:homeClick,states:homeModeStates});
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
  const modeFighterDoorStates=modeFighterStates.filter(s=>['CLOSING','SEALED','OPENING'].includes(s));
  gate('mode-to-fighter-physical-pointer-is-doorless-gold-shell-step',
    modeClick?.hitWithin===true&&fighter?.fighter&&fighter.roster>=6&&modeFighterDoorStates.length===0,
    {pointer:modeClick,states:modeFighterStates,fighter});
  report.evidence.push(await screenshot('r50k-fighter'));

  // FIGHTER -> BATTLE is deliberately NOT a Mechanical Door route. BOT pick
  // is a real two-slot flow: lock P1, confirm the CPU/P2 fighter, then lock P2.
  // Only the second lock may launch combat, and the scene-transition stream
  // must remain untouched throughout the battle lifecycle.
  mark=await evaluate('window.__APEX_R50K_STATES.length');
  const p1Pick=await physicalClick('.rosterCard[data-hero="newbot"]');
  const p1Selected=await poll(`document.querySelector('.rosterCard[data-hero="newbot"]')?.classList.contains('p1-selected')||false`);
  const p1Lock=await physicalClick('#lockIn');
  const p2Turn=await poll(`document.getElementById('stage')?.classList.contains('fighter-active-p2')||false`);
  const p2Pick=await physicalClick('.rosterCard[data-hero="newbot"]');
  const p2Selected=await poll(`document.querySelector('.rosterCard[data-hero="newbot"]')?.classList.contains('p2-selected')||false`);
  const lockClick=await physicalClick('#lockIn');
  const battle=await poll(`(() => ({
    open:document.body.classList.contains('battle-hud-open'),
    host:document.getElementById('battleHudHost')?.classList.contains('is-open')||false,
    hud:!!window.APEX_GOLD_HUD,
    live:!!window.APEX_ARSENAL?.state?.active,
    state:document.body?.dataset?.apexSceneTransition||'',
    active:window.APEX_SCENE_TRANSITION?.active?.()||false
  }))()`,v=>v?.open&&v.host&&v.hud&&v.live&&!v.active,{attempts:500,interval:80});
  const fighterBattleStates=await transitionSlice(mark);
  const battleDoorStates=fighterBattleStates.filter(s=>['CLOSING','SEALED','OPENING'].includes(s));
  gate('fighter-to-battle-uses-combat-lifecycle-not-mechanical-door',
    p1Pick?.hitWithin===true&&p1Selected===true&&p1Lock?.hitWithin===true&&p2Turn===true
    &&p2Pick?.hitWithin===true&&p2Selected===true&&lockClick?.hitWithin===true
    &&battle?.open&&battle?.host&&battle?.hud&&battle?.live&&battleDoorStates.length===0,
    {p1Pick,p1Selected,p1Lock,p2Turn,p2Pick,p2Selected,lock:lockClick,states:fighterBattleStates,battle});
  report.evidence.push(await screenshot('r50k-battle'));

  // R90 current owner-Gold tablet (supersedes the abandoned R62 dock): test the physical DOM and hit targets
  // AGAINST the actual authored two-row identity/weapon + two-skill layout.
  // The superseded square-buttons/center-weapon expectation conflicts with
  // the owner's archived Gold donor (verified independently by B8 parity).
  // This is functional acceptance; owner visual judgement remains separate.
  await command('Emulation.setDeviceMetricsOverride',{
    width:1032,height:1376,deviceScaleFactor:1,mobile:true,
    screenWidth:1032,screenHeight:1376
  });
  await sleep(500);
  const portraitTablet=await evaluate(`(() => {
    const hud=document.querySelector('#battleHudHost #hud');
    const p1=hud?.querySelector('#p1Side');
    const a=hud?.querySelector('#arena');
    const weapon=p1?.querySelector('.weapon');
    const skills=[...(p1?.querySelectorAll('.skill')||[])];
    const rect=node=>{const r=node?.getBoundingClientRect();return r?
      {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}:null};
    const hit=node=>{
      const r=node?.getBoundingClientRect();if(!r)return false;
      const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      return !!top&&(top===node||node.contains(top));
    };
    const stage=rect(document.getElementById('battleHudHost'));
    return {layout:hud?.dataset.layout,size:hud?.dataset.size,
      mode:hud?.dataset.mode,areas:p1?getComputedStyle(p1).gridTemplateAreas:'',
      arena:rect(a),weapon:rect(weapon),skills:skills.map(rect),
      skillHits:skills.map(hit),weaponHit:hit(weapon),panel:rect(p1),stage};
  })()`);
  const shapes=portraitTablet?.skills||[];
  const dock=portraitTablet?.panel;
  const weapon=portraitTablet?.weapon;
  const inPanel=r=>!!(r&&dock&&r.x>=dock.x-2&&r.right<=dock.right+2&&
    r.y>=dock.y-2&&r.bottom<=dock.bottom+2);
  gate('R90-current-Gold-iPad-BOT-dock-geometry',
    portraitTablet?.layout==='port'&&portraitTablet?.size==='tablet'&&
    portraitTablet?.mode==='1p'&&
    portraitTablet?.areas?.replace(/\s+/g,' ')==='"id wp" "sk sk"'&&
    shapes.length===2&&shapes.every(inPanel)&&inPanel(weapon)&&
    shapes[0].y>=weapon.bottom+2&&
    Math.abs(shapes[0].y-shapes[1].y)<2&&
    Math.abs(shapes[0].h-shapes[1].h)<2&&
    Math.abs(shapes[0].w-shapes[1].w)<3&&
    weapon.x>=shapes[0].x+shapes[0].w-3&&
    portraitTablet?.arena?.w>=.65*1032&&
    Math.abs(portraitTablet.arena.w-portraitTablet.arena.h)<3,
    portraitTablet);
  gate('R90-current-Gold-iPad-BOT-real-skill-hit-targets',
    shapes.length===2&&
    shapes.every(r=>r&&r.w>=115&&r.h>=115)&&
    portraitTablet?.skillHits?.every(Boolean)===true&&
    portraitTablet?.weaponHit===true,portraitTablet);
  report.evidence.push(await screenshot('r62-ipad-portrait-bot'));

  // R90 current Gold / approved R70 production visual proof: images and cooldown state must really
  // render, never depend on the retired conic ring / shade DOM or overlays.
  // Exercise ONLY the visual dataset state, restoring live authority.
  const skillArtProbe=await evaluate(`(async () => {
    const node=document.querySelector('#battleHudHost #p1Side .skill');
    const art=node?.querySelector('.sk-art');
    const icon=art?.querySelector('img.apex-skill-icon');
    const state=node?.querySelector('.sk-state');
    const cdn=art?.querySelector('.sk-cdn');
    if(!node||!art||!icon||!state||!cdn)return {found:false};
    // Snapshot Gold's authored CSS in one JS task. The real running HUD
    // owns this data-state and may overwrite an asynchronous 260ms probe.
    const original=node.dataset.state;
    const transitionBefore=icon.style.getPropertyValue('transition');
    const transitionPriority=icon.style.getPropertyPriority('transition');
    const bounds=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}};
    const within=(parent,child)=>child.x>=parent.x-2&&child.y>=parent.y-2&&child.right<=parent.right+2&&child.bottom<=parent.bottom+2;
    const box=bounds(node),a=bounds(art),i=bounds(icon),textBox=bounds(state);
    icon.style.setProperty('transition','none','important');
    node.dataset.state='ready';
    void icon.offsetWidth;
    const ready={opacity:Number(getComputedStyle(icon).opacity)};
    node.dataset.state='active';
    void icon.offsetWidth;
    const active={opacity:Number(getComputedStyle(icon).opacity),stateColor:getComputedStyle(state).color};
    node.dataset.state='cd';
    void icon.offsetWidth;
    const cooling={opacity:Number(getComputedStyle(icon).opacity),
      cdOpacity:Number(getComputedStyle(cdn).opacity),
      stateColor:getComputedStyle(state).color};
    node.dataset.state=original;
    if(transitionBefore)icon.style.setProperty('transition',transitionBefore,transitionPriority);
    else icon.style.removeProperty('transition');
    return {found:true,imageLoaded:icon.complete&&icon.naturalWidth>0,
      naturalWidth:icon.naturalWidth,imageFit:getComputedStyle(icon).objectFit,
      imageBounds:within(a,i),imageClipped:getComputedStyle(art).overflow==='hidden',
      imageGeometry:{node:box,art:a,icon:i},originalLiveState:original,
      transitionRestored:icon.style.getPropertyValue('transition')===transitionBefore,
      imageArea:i.w>0&&i.h>0&&i.right>a.x+2&&i.x<a.right-2&&i.bottom>a.y+2&&i.y<a.bottom-2,
      stateBounds:within(box,textBox),
      stateFont:parseFloat(getComputedStyle(state).fontSize),
      overlayDisabled:[...art.querySelectorAll('.sk-mask,.sk-sweep')].every(e=>getComputedStyle(e).display==='none'),
      noRetiredRings:!art.querySelector('.apex-state-ring,.apex-state-shade'),
      ready,active,cooling};
  })()`);
  gate('R90-current-Gold-skill-art-states-actually-rendered',
    skillArtProbe?.found===true&&skillArtProbe.imageLoaded===true&&
    skillArtProbe.imageFit==='contain'&&
    // R90: the source image element itself must fit in Gold's approved well,
    // not merely overlap it while overflow:hidden hides the lost bitmap.
    skillArtProbe.imageBounds===true&&
    skillArtProbe.imageClipped===true&&skillArtProbe.imageArea===true&&
    skillArtProbe.stateBounds===true&&
    skillArtProbe.stateFont>=10&&
    skillArtProbe.overlayDisabled===true&&skillArtProbe.noRetiredRings===true&&
    skillArtProbe.transitionRestored===true&&
    skillArtProbe.ready?.opacity>.90&&skillArtProbe.active?.opacity>.90&&
    skillArtProbe.cooling?.opacity<.48&&skillArtProbe.cooling?.opacity>.20&&
    skillArtProbe.cooling?.cdOpacity>.9,
    skillArtProbe);
  // Capture visually inspectable evidence of the actual image-only treatment.
  // Restore the live gameplay state immediately after each screenshot.
  const artVisualSelector='#battleHudHost #p1Side .skill';
  await evaluate(`(() => {
    const el=document.querySelector('#battleHudHost #p1Side .skill');
    const art=el?.querySelector('.sk-art');
    if(!el||!art)return;
    window.__APEX_R69_ART_RESTORE={
      el,art,state:el.dataset.state,
      progress:art.style.getPropertyValue('--apex-active-progress'),
      shade:art.style.getPropertyValue('--apex-cd-shade')
    };
    el.dataset.state='active';
    art.style.setProperty('--apex-active-progress','.65');
  })()`);
  await sleep(190);
  report.evidence.push(await screenshot('r69-skill-image-active'));
  await evaluate(`(() => {
    const s=window.__APEX_R69_ART_RESTORE;if(!s)return;
    s.el.dataset.state='cd';
    s.art.style.setProperty('--apex-cd-shade','.82');
  })()`);
  await sleep(190);
  report.evidence.push(await screenshot('r69-skill-image-cooldown'));
  await evaluate(`(() => {
    const s=window.__APEX_R69_ART_RESTORE;if(!s)return;
    s.el.dataset.state=s.state;
    for(const [key,v] of [['--apex-active-progress',s.progress],['--apex-cd-shade',s.shade]]){
      if(v)s.art.style.setProperty(key,v);else s.art.style.removeProperty(key);
    }
    delete window.__APEX_R69_ART_RESTORE;
  })()`);
  // The Door canvas MUST be viewport-sized when visible and MUST leave the
  // compositor after DONE. Measuring CSS rects of display:none after DONE
  // produces 0x0 by design; still enforce full native backing resolution.
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true,screenWidth:390,screenHeight:844});
  await sleep(260);
  const responsive=await evaluate(`(() => {
    const c=document.getElementById('apex-scene-transition');
    const r=c?.getBoundingClientRect(),visible=c&&getComputedStyle(c).display!=='none';
    const active=window.APEX_SCENE_TRANSITION?.active?.()||false;
    return {w:r?.width||0,h:r?.height||0,
      backingW:c?.width||0,backingH:c?.height||0,
      visible,active,ariaHidden:c?.getAttribute('aria-hidden')||'',
      state:document.body?.dataset?.apexSceneTransition||'',
      dpr:devicePixelRatio||1};
  })()`);
  gate('gold-transition-responsive-canvas-follows-portrait-viewport',
    responsive.backingW>=390*responsive.dpr&&responsive.backingH>=844*responsive.dpr&&
    (responsive.active
      ? responsive.visible&&Math.abs(responsive.w-390)<2&&Math.abs(responsive.h-844)<2
      : !responsive.visible&&responsive.ariaHidden==='true'&&responsive.state==='DONE'),
    responsive);

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
