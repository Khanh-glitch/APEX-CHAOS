// Q1 — physically navigate Home → WAKE director → explicit CP04 preview → Home.
// Exercise desktop click and mobile touch, storage, reload and isolated combat.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const isMobile=process.argv.includes('--mobile');
const appUrl=process.env.APEX_APP_URL||'http://127.0.0.1:5173';
const endpoint=process.env.APEX_CDP_ENDPOINT||'http://127.0.0.1:9231';
const chromePath=process.env.CHROME_PATH||'google-chrome';
const evidenceDir=process.env.APEX_EVIDENCE_DIR||'/tmp/quest-q1-browser';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const chrome=process.env.APEX_CDP_ENDPOINT?null:spawn(chromePath,[
  '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
  '--no-sandbox','--remote-debugging-port=9231',isMobile?'--window-size=390,844':'--window-size=1365,768',
  '--user-data-dir='+path.join('/tmp',isMobile?'apex-quest-q1-mobile':'apex-quest-q1-cdp'),
  appUrl],{stdio:'ignore'});
let socket;
let serial=0;const pending=new Map();const gates=[], failures=[],browserConsole=[];
const gate=(label,pass,data)=>{
  gates.push({label,pass:!!pass,data});
  if(!pass)failures.push(label);
  console.log((pass?'PASS':'FAIL')+' '+label+' '+JSON.stringify(data));
};
async function connect(){
  let target;
  for(let i=0;i<120;i++){
    try{const arr=await fetch(endpoint+'/json/list').then(r=>r.json());
      target=arr.find(t=>t.type==='page');
      if(target)break;
    }catch(_){}
    await sleep(250);
  }
  if(!target)throw new Error('Chrome page endpoint unavailable');
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    socket.addEventListener('open',resolve,{once:true});
    socket.addEventListener('error',reject,{once:true});
  });
  socket.addEventListener('message',({data})=>{
    const msg=JSON.parse(data);
    if(msg.method==='Runtime.consoleAPICalled'||msg.method==='Runtime.exceptionThrown'){
      const v=msg.params||{};
      browserConsole.push({kind:msg.method,
        text:(v.args||[]).map(a=>a.value??a.description??'').join(' '),
        error:v.exceptionDetails?.exception?.description||''});
      if(browserConsole.length>80)browserConsole.shift();
    }
    if(!msg.id||!pending.has(msg.id))return;
    const p=pending.get(msg.id);pending.delete(msg.id);
    if(msg.error)p.reject(new Error(msg.error.message));
    else p.resolve(msg.result);
  });
}
function cmd(method,params={}){
  const id=++serial;
  socket.send(JSON.stringify({id,method,params}));
  return new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));
}
// A Gold navigation sometimes replaces the Chrome renderer target. The
// previous WebSocket can close on a perfectly valid Page.reload command.
// Reacquire a real page endpoint and runtime; never skip or synthesize any
// Quest action, Director save, damage or user click.
async function reloadAndReattach(){
  try{await cmd('Page.reload',{ignoreCache:true});}
  catch(e){
    if(!/Inspected target navigated or closed|WebSocket is not open|WebSocket closed/.test(String(e)))
      throw e;
  }
  await sleep(350);
  try{socket?.close();}catch(_){}
  for(const p of pending.values())p.reject(new Error('CDP page target replaced during Gold reload'));
  pending.clear();
  await connect();
  await cmd('Runtime.enable');
  await cmd('Page.enable');
}
async function evalPage(expression){
  const v=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
  if(v.exceptionDetails)throw new Error(v.exceptionDetails.exception?.description||v.exceptionDetails.text);
  return v.result.value;
}
async function poll(expression,predicate,attempts=240){
  let last;
  for(let i=0;i<attempts;i++){
    last=await evalPage(expression);
    if(predicate(last))return last;
    await sleep(125);
  }
  return last;
}
async function click(selector){
  const probe=JSON.stringify(selector);
  // Gold Quest chapter has a deliberately scrollable story panel. A real
  // user scrolls to controls below the fold before clicking. Keep CDP
  // physical pointer/touch for activation; never invoke element.click().
  await evalPage(`(()=>{const e=document.querySelector(${probe});e?.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});return !!e})()`);
  let p=await poll(`(()=>{
    const e=document.querySelector(${probe});
    if(!e)return {exists:false};
    const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
    const top=document.elementFromPoint(x,y);
    return {exists:true,x,y,w:r.width,h:r.height,enabled:!e.disabled,
      hit:top===e||e.contains(top),vis:getComputedStyle(e).visibility};
  })()`,v=>v?.exists&&v.hit&&v.enabled&&v.w>10&&v.h>10,90);
  if(!p?.hit||!p.enabled||p.w<10)throw new Error('Click target not physically hittable: '+selector+' '+JSON.stringify(p));
  if(isMobile){
    await cmd('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});
    await cmd('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
    // Desktop users hover before pressing. The authored Gold CTA animates
    // during pointerenter; hit-test and re-center AFTER hover, otherwise the
    // synthetic press may land on Free Battle behind a moving Continue CTA.
    await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});
    await sleep(85);
    const hovered=await poll(`(()=>{
      const e=document.querySelector(${probe});
      if(!e)return {exists:false};
      const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
      const top=document.elementFromPoint(x,y);
      return {exists:true,x,y,w:r.width,h:r.height,
        enabled:!e.disabled,hit:top===e||e.contains(top)};
    })()`,v=>v?.exists&&v.hit&&v.enabled&&v.w>10&&v.h>10,24);
    if(!hovered?.hit)throw new Error('Gold hover moved click target outside hitbox: '+selector+' '+JSON.stringify(hovered));
    await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:hovered.x,y:hovered.y});
    await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x:hovered.x,y:hovered.y,button:'left',clickCount:1});
    await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x:hovered.x,y:hovered.y,button:'left',clickCount:1});
    p={...p,hovered};
  }
  return p;
}
async function image(name){
  const r=await cmd('Page.captureScreenshot',{format:'png'});
  await writeFile(path.join(evidenceDir,name+(isMobile?'-mobile':'')+'.png'),Buffer.from(r.data,'base64'));
}
async function pressEscape(){
  await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
}
try{
  await mkdir(evidenceDir,{recursive:true});
  await connect();
  await cmd('Runtime.enable');await cmd('Page.enable');
  if(isMobile){
    await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true,
      screenOrientation:{type:'portraitPrimary',angle:0}});
    await cmd('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  }
  await cmd('Page.navigate',{url:appUrl});
  const boot=await poll(`(()=>({
    start:!!document.getElementById('apex-boot-start'),
    mounted:document.getElementById('gold-shell-host')?.dataset?.apexGoldMounted==='1',
    story:!!document.getElementById('continueStory')
  }))()`,v=>v?.start&&v.mounted&&v.story,320);
  gate('Home and START load',!!boot?.start&&boot.mounted&&boot.story,boot);
  if(!boot?.start)throw new Error('Boot START never ready');
  const pressed=await click('#apex-boot-start');
  gate('Physical START click',pressed.hit,pressed);
  const home=await poll(`(()=>({
    done:document.body.dataset.apexSceneTransition==='DONE',
    blackout:document.getElementById('apex-boot-blackout')?.hidden===true,
    story:!!document.getElementById('continueStory')
  }))()`,v=>v?.done&&v.blackout&&v.story,320);
  gate('Home visible after door',home?.done&&home?.blackout,home);
  await image('01-home-continue-story');
  const storyClick=await click('#continueStory');
  gate('Physical Continue Story click',storyClick.hit,storyClick);
  const wake=await poll(`(()=>({
    visible:document.getElementById('apexQuest01Stage')?.hidden===false,
    node:document.getElementById('apexQuest01Stage')?.dataset?.node,
    persisted:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,
    live:window.APEX_ARSENAL?.state?.questFirstWake===true,
    preview:!!document.getElementById('q1Preview'),
    noPublicAdvance:!window.APEX_QUEST01_DIRECTOR?.advance&&!window.APEX_QUEST01_DIRECTOR?.setCheckpoint
  }))()`,v=>v?.visible&&v?.node==='WAKE',100);
  gate('Continue Story opens actual WAKE checkpoint instead of E02',wake?.visible&&wake?.node==='WAKE'&&wake?.persisted==='WAKE'&&!wake?.live,wake);
  gate('Unfinished scenes cannot be marked complete from public API',wake?.noPublicAdvance===true&&wake?.preview===true,wake);
  await image('02-waKe-checkpoint');
  await pressEscape();
  const escaped=await poll(`(()=>({
    hidden:document.getElementById('apexQuest01Stage')?.hidden===true,
    checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId
  }))()`,v=>v?.hidden,80);
  gate('ESC closes Quest scene without changing checkpoint',escaped?.hidden&&escaped?.checkpoint==='WAKE',escaped);
  await click('#continueStory');
  const reopened=await poll(`(()=>({
    visible:document.getElementById('apexQuest01Stage')?.hidden===false,
    checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId
  }))()`,v=>v?.visible,80);
  gate('Continue Story resumes the same checkpoint',reopened?.visible&&reopened?.checkpoint==='WAKE',reopened);
  const previewClick=await click('#q1Preview');
  gate('Explicit CP04 preview is physically clickable',previewClick.hit,previewClick);
  const result=await poll(`(()=>({
    live:window.APEX_ARSENAL?.state?.questFirstWake===true,
    actors:(window.fighters||[]).map(f=>({id:f.questId,team:f.questTeam,hp:f.maxHp})),
    open:document.getElementById('battleHudHost')?.classList.contains('is-open')===true,
    canvas:document.getElementById('game-canvas')?.isConnected===true,
    devFlag:window.__APEX_QUEST_DEV===true
  }))()`,v=>v?.live&&v?.open&&v.actors?.length===4,420);
  gate('Preview still launches four REAL Quest Fighters',result?.live&&result?.actors?.length===4&&result?.open,result);
  gate('FIRST WAKE real team composition intact',JSON.stringify(result?.actors)===JSON.stringify([
    {id:'NEWBOT',team:'ALLY',hp:1000},
    {id:'SCRAP-A',team:'HOSTILE',hp:350},
    {id:'T.O.T',team:'ALLY',hp:1000},
    {id:'SCRAP-B',team:'HOSTILE',hp:350}]),result?.actors);
  gate('Dev override does not remain enabled',result?.devFlag===false,{devFlag:result?.devFlag});
  // Q3 actual Chrome gate — a static source or fallback silhouette is NOT a
  // substitute for two independently instantiated owner V12 spring rigs.
  const v12=await poll(`(()=>({
    registered:window.apexQuestV12Rig==='ready',
    draws:window.APEX_QUEST_V12_RIG?.stats?.draws||0,
    instances:window.APEX_QUEST_V12_RIG?.stats?.instances||0,
    failed:window.APEX_QUEST_V12_RIG?.stats?.failed||0,
    lastError:window.APEX_QUEST_V12_RIG?.stats?.lastError||null,
    donor:window.APEX_QUEST_V12_RIG?.sourceSha256||null,
    hostiles:(window.fighters||[]).filter(f=>f.questTeam==='HOSTILE').map(f=>f.questVisualId)
  }))()`,v=>v?.draws>=10&&v?.instances>=2,120);
  gate('Q3 actual V12 spring rigs draw both hostiles in real Chrome',
    v12?.registered&&v12?.instances>=2&&v12?.draws>=10&&v12?.failed===0
      &&v12?.donor==='3817ab8b0ab674af9573704f20173ff1edfae5e26598f843b1dd1ab422ff3685',v12);
  // Q3 semantic Gold HUD law: both SIDE bars summarize every independent
  // physical Quest HP pool; displaying the first actor's HP is false.
  const q3Teams=await poll(`(()=>{
    const host=document.getElementById('battleHudHost');
    const actors=window.fighters||[];
    const sum=team=>actors.filter(f=>f.questTeam===team).reduce((t,f)=>({
      hp:t.hp+Math.max(0,Number(f.hp)||0),max:t.max+Math.max(0,Number(f.maxHp)||0),
      count:t.count+1
    }),{hp:0,max:0,count:0});
    const read=i=>({hp:Number(host?.querySelector('#p'+i+'Rail .vr-cur')?.textContent),
      max:Number((host?.querySelector('#p'+i+'Rail .vr-max')?.textContent||'').replace(/[^0-9.]/g,''))});
    return {ally:sum('ALLY'),hostile:sum('HOSTILE'),left:read(1),right:read(2)};
  })()`,v=>v?.left?.max===v?.ally?.max&&v?.right?.max===v?.hostile?.max
       &&v?.left?.hp===Math.round(v?.ally?.hp)&&v?.right?.hp===Math.round(v?.hostile?.hp),120);
  gate('Q3 Gold two panels show real aggregate Quest HP without a fake shared health pool',
    q3Teams?.ally?.count===2&&q3Teams?.hostile?.count===2
     &&q3Teams?.left?.max===q3Teams.ally.max&&q3Teams.right.max===q3Teams.hostile.max
     &&q3Teams.left.hp===Math.round(q3Teams.ally.hp)
     &&q3Teams.right.hp===Math.round(q3Teams.hostile.hp),q3Teams);
  const q3Slots=await poll(`(()=>{
    const host=document.getElementById('battleHudHost');
    const teams=['ALLY','HOSTILE'];
    const sections=teams.map((team,i)=>{
      const expected=(window.fighters||[]).filter(f=>f.questTeam===team);
      const spans=[...(host?.querySelectorAll('#p'+(i+1)+'Rail .vr-quest-slots > span')||[])];
      return {team,expected:expected.map(f=>f.questId),actual:spans.map(s=>s.dataset.actor),
        ratios:spans.map(s=>Number(s.style.getPropertyValue('--qhp'))),
        correct:spans.length===expected.length&&spans.every((s,j)=>
          s.dataset.actor===expected[j].questId&&
          Math.abs(Number(s.style.getPropertyValue('--qhp'))-Math.max(0,expected[j].hp/expected[j].maxHp))<.002)};
    });
    return {quest:host?.querySelector('#hud')?.dataset.quest,sections,
      railCount:host?.querySelectorAll('#p1Rail,#p2Rail').length};
  })()`,v=>v?.quest==='1'&&v?.railCount===2&&v.sections?.every(s=>s.correct),120);
  gate('Q3 Gold keeps only two canonical bars with independent fixed actor HP slots',
    q3Slots?.quest==='1'&&q3Slots?.railCount===2
       &&q3Slots.sections?.every(s=>s.correct&&s.actual.length===2),q3Slots);
  // Do not render fake READY skills or the Gold hero avatar for blank
  // multi-actor Scrap NPCs; the real player J/K cards remain interactive.
  const q3NpcHud=await evalPage("(()=>{\n const host=document.getElementById('battleHudHost');\n const side=host?.querySelector('#p2Side'),own=host?.querySelector('#p1Side');\n const hidden=['.skills','.weapon','.portrait','.id-ctrl'].map(s=>{\n  const element=side?.querySelector(s);return {node:s,display:element?getComputedStyle(element).display:null};\n });\n const ownSkills=own?.querySelector('.skills');\n return {quest:host?.querySelector('#hud')?.dataset.quest,hidden,\n   playerSkills:ownSkills?getComputedStyle(ownSkills).display:null};\n})()");
  gate('Q3 NPC faction side has no invented A1 A2 READY or false hero avatar',
    q3NpcHud?.quest==='1'&&q3NpcHud.hidden.every(x=>x.display==='none')
      &&q3NpcHud.playerSkills!=='none',q3NpcHud);
  // Gold's FIVE originals: fifth white/amber OPERATOR now stands in for
  // T.O.T visually. This MUST instantiate, not fall back to a CP04 blob.
  // Repaint a real Scout four times on a scratch canvas with distinct actual
  // Fighter movement directions; read back the true resulting 2D matrix.
  // The physical directions change, while the V12 chassis stays upright.
  const q3sMotion=await evalPage("(()=>{\n  const rig=window.APEX_QUEST_V12_RIG;\n  const f=window.fighters||[];\n  const ally=f.find(x=>x.questId==='T.O.T');\n  const scout=f.find(x=>x.questId==='SCRAP-A');\n  const bulwark=f.find(x=>x.questId==='SCRAP-B');\n  if(!rig||!ally||!scout||!bulwark)return {ready:false};\n  const before=rig.stats.operatorDraws;\n  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1000;\n  const ctx=canvas.getContext('2d');\n  const samples=[];\n  const original={x:scout.dir.x,y:scout.dir.y};\n  for(const d of [[1,0],[-1,0],[0,-1],[0,1]]){\n    scout.setDir(d[0],d[1]);\n    scout.draw(ctx);\n    const v=rig.stats.facingByQuestId[scout.questId];\n    samples.push({movement:d,angle:v?.angle});\n  }\n  scout.setDir(original.x,original.y);\n  const same=samples.length===4&&samples.every(s=>Number.isFinite(s.angle)&&\n    Math.abs(Math.atan2(Math.sin(s.angle),Math.cos(s.angle-Math.PI/2)))<.015);\n  return {ready:true,allyVisual:ally.questVisualId,\n    operatorDraws:rig.stats.operatorDraws,wasOperatorDrawn:before>0||rig.stats.operatorDraws>0,\n    instances:rig.stats.instances,failed:rig.stats.failed,\n    scoutVisual:scout.questVisualId,bulwarkVisual:bulwark.questVisualId,\n    samples,fixed:same};\n})()");
  gate('Q3s Gold fifth OPERATOR actually renders for T.O.T without importing abilities',
    q3sMotion?.ready===true&&q3sMotion.allyVisual==='operator'
      &&q3sMotion.operatorDraws>0&&q3sMotion.instances>=3
      &&q3sMotion.failed===0,q3sMotion);
  gate('Q3s V12 Scout stays forward facing under four real movement headings',
    q3sMotion?.fixed===true&&q3sMotion.samples.length===4,q3sMotion);
  const q3sMinimal=await evalPage("(()=>{\n const host=document.getElementById('battleHudHost'),hud=host?.querySelector('#hud');\n const props=['.vr-sub','.id-sub','#p2Side .id-tag','#p2Rail .vr-tag'];\n const elements=props.map(s=>[...host.querySelectorAll(s)].map(x=>getComputedStyle(x).display));\n return {quest:hud?.dataset.quest,elements,p1Skill:getComputedStyle(host.querySelector('#p1Side .skills')).display,\n  enemyName:host.querySelector('#p2Side .id-name')?.textContent};\n})()");
  gate('Q3s Quest removes only Gold template copy and false P2 identifier',
    q3sMinimal?.quest==='1'&&q3sMinimal.elements.every(x=>x.every(d=>d==='none'))
      &&q3sMinimal.p1Skill!=='none'
      &&String(q3sMinimal.enemyName).includes('SCRAP'),q3sMinimal);
  // Real Chrome temporal evidence: sample multiple autonomous render frames,
  // not one static screenshot and not a forged presentation event.
  const q3tSamples=[];
  for(let i=0;i<9;i++){
    q3tSamples.push(await evalPage("(()=>{\n const rig=window.APEX_QUEST_V12_RIG,actors=window.fighters||[];\n return {time:window.APEX_ARSENAL?.state?.time,\n  actors:actors.map(f=>({id:f.questId,radius:f.radius,visual:f.questVisualId||null,\n    spr:rig?.inspect?.(f)||null}))};\n})()"));
    await sleep(110);
  }
  const q3tIdentifiers=['T.O.T','SCRAP-A','SCRAP-B'];
  const q3tTriples=q3tIdentifiers.map(id=>q3tSamples
    .map(frame=>frame?.actors?.find(f=>f.id===id)).filter(Boolean));
  const q3tSizing=q3tTriples.map((frames,i)=>({
    id:q3tIdentifiers[i],samples:frames.length,
    radii:[...new Set(frames.map(f=>f.radius))],
    scales:frames.map(f=>f.spr?.scaleFactor),
    drawable:frames.every(f=>f.spr?.scaleFactor===(i===0?.82:.77)&&f.spr?.scale>0)
  }));
  gate('Q3t actor scale is T.O.T 0.82 and Scouts 0.77 with unchanged physical radius',
    q3tSizing.every(g=>g.samples===9&&g.drawable&&g.radii.length===1)
    &&q3tSamples.every(frame=>frame.actors.find(f=>f.id==='NEWBOT')?.spr===null),
    {size:q3tSizing,unchangedNewbot:q3tSamples[0]?.actors?.find(f=>f.id==='NEWBOT')});
  const q3tMotion=q3tTriples.map((frames,i)=>{
    const poses=frames.map(f=>f.spr?.pose).filter(Boolean);
    const vals=poses.map(p=>[p.calTh0,p.calDx0,p.spin0,p.lagX]);
    const delta=Math.max(...vals.map(v=>Math.abs(v[0]-vals[0][0])
      +Math.abs(v[1]-vals[0][1])*.01+Math.abs(v[2]-vals[0][2])));
    const clocks=frames.map(f=>f.spr?.clock);
    const positions=frames.map(f=>f.spr?.position).filter(Boolean);
    const moved=positions.length?Math.hypot(
      positions.at(-1).x-positions[0].x,positions.at(-1).y-positions[0].y):0;
    return {id:q3tIdentifiers[i],sampleCount:frames.length,deltaSpring:delta,
      advancedClock:clocks.at(-1)>clocks[0]+.3,movedWorldUnits:moved,
      firstPose:poses[0],lastPose:poses.at(-1)};
  });
  gate('Q3t three donor spring rigs genuinely animate over 9 real Chrome frames',
    q3tMotion.every(m=>m.sampleCount===9&&m.advancedClock
      &&Number.isFinite(m.deltaSpring)&&m.deltaSpring>.002),q3tMotion);
  await image('03-cp04-preview-four-fighters');
  // Temporarily stop autonomous RAF simulation while exercising live PISTOL
  // collision on the same real Quest Fighters. A.step() below remains the
  // ONLY real physics authority for these fixture transactions; no damage is
  // assigned and no presentation event is synthesized. Restore before EXIT.
  const q3Freeze=await evalPage("(()=>{if(typeof window.update!=='function')return false;if(window.__q3NativeUpdate)return false;window.__q3NativeUpdate=window.update;window.update=function q3HoldAutonomousStep(){};return true})()");
  gate('Q3 Chrome fixture safely isolates physical bullets from ongoing RAF combat',q3Freeze===true,{paused:q3Freeze});
  // Q3: exercise a genuine Arsenal PISTOL collision, never direct HP mutation.
  const q3RealShot=await evalPage("(()=>{\n  const A=window.APEX_ARSENAL,W=A?.weaponApi,f=window.fighters||[];\n  const source=f.find(x=>x.questId==='NEWBOT');\n  const victim=f.find(x=>x.questId==='SCRAP-A');\n  const other=f.find(x=>x.questId==='SCRAP-B');\n  if(!A?.state?.questMultiActor||!source||!victim||!other||!W?.fireBullet)return {started:false};\n  f.forEach((x,i)=>{x.baseSpeed=0;x.data.__hrHoldBody=true;x.x=120+i*125;x.y=865;});\n  source.x=170;source.y=300;victim.x=590;victim.y=300;other.x=820;other.y=790;\n  A.state.spawnHeld=true;A.state.spawnTimer=1e6;A.state.slots=[];\n  f.forEach(x=>{x.statuses={};});\n  // This is a controlled live-projectile test within a previously active\n  // match. Drain OLD ordnance so an unrelated mid-flight bullet cannot damage\n  // an innocent ally during the exact controlled ballistic solver step.\n  // Only the browser fixture clears it; production Arena rules are unchanged.\n  if(!Array.isArray(window.projectiles))return {started:false,reason:'transient-projectiles-not-exposed'};\n  window.projectiles.length=0;\n  // Unarm the OTHER active NPCs through the actual Arsenal consume seam,\n  // preventing independent auto-fire during this isolated PISTOL solver step.\n  f.forEach(x=>W.consume(x,'q3-isolated-ballistics'));\n  const isolated=f.every(x=>!W.getHolder(x));\n  const rig=window.APEX_QUEST_V12_RIG;\n  const before={target:victim.hp,other:other.hp,targetMax:victim.maxHp,otherMax:other.maxHp,allies:f.filter(x=>x.questTeam==='ALLY').map(x=>x.hp),\n    hitEvents:rig?.inspect?.(victim)?.hitEvents||0};\n  W.fireBullet({owner:source,x:220,y:300,angle:0,speed:2600,damage:10,weapon:'PISTOL'});\n  A.step(.16);\n  // The exact donor consumes the REAL loss on its normal Fighter.draw path.\n  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1000;\n  victim.draw(canvas.getContext('2d'));\n  return {started:true,isolated,before,after:{target:victim.hp,other:other.hp,\n    allies:f.filter(x=>x.questTeam==='ALLY').map(x=>x.hp),\n    hitEvents:rig?.inspect?.(victim)?.hitEvents||0}};\n})()");
  gate('Q3 actual PISTOL damages only the aimed physical Scrap Bot',
    !!q3RealShot?.started&&q3RealShot.isolated===true
     &&q3RealShot.after.target<q3RealShot.before.target
    &&q3RealShot.after.other===q3RealShot.before.other
    &&JSON.stringify(q3RealShot.after.allies)===JSON.stringify(q3RealShot.before.allies),q3RealShot);
  gate('Q3t donor hit spring receives exactly one authentic Arsenal PISTOL collision',
    q3RealShot?.after?.hitEvents===q3RealShot?.before?.hitEvents+1
      &&q3RealShot.after.target<q3RealShot.before.target,
    {before:q3RealShot?.before?.hitEvents,after:q3RealShot?.after?.hitEvents,
      physicalDamage:q3RealShot?.before?.target-q3RealShot?.after?.target});
  const q3PostHit=await poll("(()=>{\n  const host=document.getElementById('battleHudHost'),f=window.fighters||[];\n  return ['ALLY','HOSTILE'].map((team,i)=>{\n    const actors=f.filter(x=>x.questTeam===team),rail=host?.querySelector('#p'+(i+1)+'Rail');\n    const segments=[...(rail?.querySelectorAll('.vr-quest-slots > span')||[])];\n    return {\n      team,hp:Math.round(actors.reduce((n,a)=>n+Math.max(0,a.hp),0)),\n      shown:Number(rail?.querySelector('.vr-cur')?.textContent),\n      max:actors.reduce((n,a)=>n+Math.max(0,a.maxHp),0),\n      maxShown:Number((rail?.querySelector('.vr-max')?.textContent||'').replace(/[^0-9.]/g,'')),\n      slots:segments.map(s=>({id:s.dataset.actor,value:(parseFloat(s.style.flexBasis)||0)/100})),\n      match:segments.length===actors.length&&segments.every((s,j)=>\n        s.dataset.actor===actors[j].questId&&\n        Math.abs((parseFloat(s.style.flexBasis)||0)/100-actors[j].hp/Math.max(1,actors.reduce((total,a)=>total+a.maxHp,0)))<.002)\n    };\n  });\n})()",
    v=>v?.length===2&&v.every(x=>x.match&&x.hp===x.shown&&x.max===x.maxShown),120);
  gate('Q3 Gold team totals and only damaged actor segment track real projectile HP',
    !!q3PostHit?.[1]?.slots?.[1]&&
       q3RealShot?.after?.target<q3RealShot?.before?.target
     // Fight history is authentic: either Scrap Bot may already be injured.
     // Exactly one controlled PISTOL hit means the other bot's ratio stays
     // equal to its PRE-SHOT real HP, not a fabricated full-health 100%.
     &&Math.abs(q3PostHit[1].slots[0].value-
       q3RealShot.after.target/(q3RealShot.before.targetMax+q3RealShot.before.otherMax))<.002
     &&Math.abs(q3PostHit[1].slots[1].value-
       q3RealShot.before.other/(q3RealShot.before.targetMax+q3RealShot.before.otherMax))<.002
     &&q3PostHit.every(x=>x.match&&x.hp===x.shown&&x.max===x.maxShown),
     {segments:q3PostHit,physical:q3RealShot});
  const q3RailGeometry=await evalPage("(()=>{\n  const h=document.getElementById('battleHudHost'),hud=h?.querySelector('#hud'),layout=hud?.dataset.layout;\n  const rails=[1,2].map(i=>{\n    const rail=h?.querySelector('#p'+i+'Rail'),hp=rail?.querySelector('.vr-hp'),label=rail?.querySelector('.vr-lbl');\n    const a=rail?.getBoundingClientRect(),b=hp?.getBoundingClientRect();\n    return {label:getComputedStyle(label).display,\n      fit:!!a&&!!b&&b.left>=a.left-1&&b.right<=a.right+1};\n  });\n  return {layout,quest:hud?.dataset.quest,rails};\n})()");
  gate('Q3 mobile Quest rail labels never overlap the actual HP numbers',
    q3RailGeometry?.quest==='1'&&q3RailGeometry.rails.every(x=>
      x.fit&&(q3RailGeometry.layout==='desk'||x.label==='none')),q3RailGeometry);
  await image('03b-cp04-after-real-hit');

  // The Gold Heavy burst uses wall-clock (performance.now), not the
  // simulated clock. Let any LEGIT earlier-match burst drain while the live
  // autonomous update is held; first CRIT below now has a clean 1.20s window.
  const q3Calm=await evalPage("(async()=>{await new Promise(r=>setTimeout(r,1400));return true})()");
  gate('Q3 real Heavy window drains without unrelated auto-combat hits',q3Calm===true,{calm:q3Calm});
  // Q3 Gold visual routing must accept physical striker id 4 / victim id 3,
  // not just legacy 1v1 id 1 and id 2. Spy on the Gold seam only; every
  // event below comes from swept PISTOL collisions in the real Arsenal engine.
  const q3CrossActorFx=await evalPage("(()=>{\n  const A=window.APEX_ARSENAL,W=A?.weaponApi,f=window.fighters||[];\n  const shooter=f.find(x=>x.questId==='SCRAP-B');\n  const target=f.find(x=>x.questId==='T.O.T');\n  const neighbor=f.find(x=>x.questId==='NEWBOT');\n  const seam=window.APEX_GOLD_HUD;\n  if(!A?.state?.questMultiActor||!shooter||!target||!neighbor||!W?.fireBullet||!seam?.hit)\n    return {started:false};\n  f.forEach((x,i)=>{x.baseSpeed=0;x.data.__hrHoldBody=true;x.x=100+i*125;x.y=890;});\n  shooter.x=825;shooter.y=500;target.x=310;target.y=500;\n  neighbor.x=160;neighbor.y=790;\n  A.state.spawnHeld=true;A.state.spawnTimer=1e6;A.state.slots=[];\n  f.forEach(x=>{x.statuses={};});\n  // This is a controlled live-projectile test within a previously active\n  // match. Drain OLD ordnance so an unrelated mid-flight bullet cannot damage\n  // an innocent ally during the exact controlled ballistic solver step.\n  // Only the browser fixture clears it; production Arena rules are unchanged.\n  if(!Array.isArray(window.projectiles))return {started:false,reason:'transient-projectiles-not-exposed'};\n  window.projectiles.length=0;\n  const before={target:target.hp,neighbor:neighbor.hp};\n  const hits=[],original=seam.hit;\n  seam.hit=function(a,v,amount,tier,afterHp,accent){\n    hits.push({a,v,amount,tier,afterHp,accent});\n    return original.apply(this,arguments);\n  };\n  try{\n    W.fireBullet({owner:shooter,x:770,y:500,angle:Math.PI,speed:2600,damage:10,weapon:'PISTOL',critical:true});\n    A.step(.2);\n    for(let i=0;i<3;i++)\n      W.fireBullet({owner:shooter,x:770,y:500,angle:Math.PI,speed:2600,damage:10,weapon:'PISTOL',critical:false});\n    A.step(.2);\n  }finally{seam.hit=original;}\n  return {started:true,before,after:{target:target.hp,neighbor:neighbor.hp},hits};\n})()");
  const q3GoldHits=(q3CrossActorFx?.hits||[]).filter(h=>h.a===1&&h.v===0);
  gate('Q3 physical Scrap-B to T.O.T critical reaches Gold from fighter id>2',
    q3CrossActorFx?.started===true
      &&q3CrossActorFx.after.target<q3CrossActorFx.before.target
      &&q3CrossActorFx.after.neighbor===q3CrossActorFx.before.neighbor
      &&q3GoldHits.some(h=>h.tier==='crit'&&h.amount>0),q3CrossActorFx);
  gate('Q3 per-victim Heavy fires once for real PISTOL burst from fighter id>2',
    q3GoldHits.filter(h=>h.tier==='heavy').length===1
      &&q3GoldHits.reduce((v,h)=>v+h.amount,0)>200
      &&Math.abs(q3CrossActorFx.before.target-q3CrossActorFx.after.target
        -q3GoldHits.reduce((v,h)=>v+h.amount,0))<.01,
    {hits:q3GoldHits,before:q3CrossActorFx?.before,after:q3CrossActorFx?.after});
  // Genuine gun recoil evidence: native Arsenal equips + advances a live
  // PISTOL; only native poseKick can produce holder.meta.pose.pulses.
  // The donor must observe those pulses and animate its own gunKick spring.
  // Q3v LIVE damage presentation regression. Earlier Q3u screenshots had
  // enormous CRITICAL/DEVASTATING labels covering the faction's own name.
  // Wait past the scheduled Gold crit/heavy callback (174 ms) and assert
  // the real physical hit did NOT create a duplicate side-panel stack.
  // The in-arena popup and combat shatter/flash remain.
  await sleep(250);
  const q3vDuplicateFx=await evalPage("(()=>{\n const host=document.getElementById('battleHudHost'),hud=host?.querySelector('#hud');\n const copy=host?.querySelector('#copyLayer');\n return {quest:hud?.dataset.quest,popups:host?.querySelectorAll('#arenaFx .dmg')?.length||0,duplicateLabels:copy?.querySelectorAll('.stamp.crit,.stamp.heavy,.bignum.c,.bignum.h')?.length||0};\n})()");
  gate('Q3v real Quest PISTOL crit/heavy has no duplicate label over faction HP',
    q3vDuplicateFx?.quest==='1'&&q3vDuplicateFx?.duplicateLabels===0,
    q3vDuplicateFx);

  const q3tNativeRecoil=await evalPage("(()=>{\n const A=window.APEX_ARSENAL,W=A?.weaponApi,rig=window.APEX_QUEST_V12_RIG,f=window.fighters||[];\n const shooter=f.find(x=>x.questId==='SCRAP-B'),target=f.find(x=>x.questId==='T.O.T');\n if(!A?.state?.questMultiActor||!W?.equip||!rig?.inspect||!shooter||!target)return {ready:false};\n shooter.x=585;shooter.y=500;target.x=320;target.y=500;\n if(!W.equip(shooter,'PISTOL'))return {ready:false,reason:'native-equip-failed'};\n const ctx=document.createElement('canvas').getContext('2d');\n shooter.draw(ctx);\n const initial=rig.inspect(shooter);\n let maxPulse=Number(W.getHolder(shooter)?.meta?.pose?.pulses)||0;\n let lastGunKick=initial?.pose?.gunKick||0;\n let maxDeltaGunKick=0;\n const reads=[];\n for(let i=0;i<17;i++){\n   A.step(.09);\n   shooter.draw(ctx);\n   const holder=W.getHolder(shooter);\n   maxPulse=Math.max(maxPulse,Number(holder?.meta?.pose?.pulses)||0);\n   const value=rig.inspect(shooter);\n   if(value){\n     maxDeltaGunKick=Math.max(maxDeltaGunKick,Math.abs(value.pose.gunKick-lastGunKick));\n     lastGunKick=value.pose.gunKick;\n     reads.push({step:i,recoilEvents:value.recoilEvents,kick:value.pose.gunKick});\n   }\n }\n const ending=rig.inspect(shooter);\n return {ready:true,maxNativeFirePulses:maxPulse,\n   before:initial?.recoilEvents,after:ending?.recoilEvents,\n   springKickChanged:maxDeltaGunKick,\n   modelScale:ending?.scaleFactor,\n   reads:reads.filter(x=>x.recoilEvents>initial.recoilEvents).slice(0,5)};\n})()");
  gate('Q3t native PISTOL fire pulses drive REAL V12 Bulwark recoil spring',
    q3tNativeRecoil?.ready===true
      &&q3tNativeRecoil.maxNativeFirePulses>0
      &&q3tNativeRecoil.after>q3tNativeRecoil.before
      &&q3tNativeRecoil.springKickChanged>.005
      &&q3tNativeRecoil.modelScale===.77,q3tNativeRecoil);
  // Q3u: capture the REAL draw transform of a native Arsenal PISTOL sprite.
  // The visible gun must follow its smaller Gold chassis, but Arsenal's
  // ballistic muzzle must remain unchanged; no fake holder/hitbox.
  // A missing or still-loading PISTOL PNG cannot prove a grip transform.
  // Use the actual authored asset and its normal async image cache.
  const q3uAsset=await evalPage("(async()=>{\n const AV=window.APEX_ARSENAL_AV;\n if(!AV?.preload||!AV?.weaponImage)return {ready:false,reason:'presentation API unavailable'};\n AV.preload({audio:false});\n if(!AV.weaponImage('PISTOL'))await AV.whenImagesReady(7000);\n const img=AV.weaponImage('PISTOL');\n return {ready:!!img,meta:AV.weaponMeta('PISTOL'),\n  image:img?{w:img.w,h:img.h}:null,\n  stats:{loaded:AV.stats.imagesLoaded,failed:AV.stats.imagesFailed,total:AV.imagesTotal()}};\n})()");
  gate('Q3u original PISTOL PNG is ready before sampling held-gun artwork',
    q3uAsset?.ready===true&&q3uAsset?.meta?.file?.endsWith('PISTOL.png')
      &&q3uAsset.image?.w>0,q3uAsset);
  const q3uGrip=await evalPage("(()=>{\n const A=window.APEX_ARSENAL,W=A?.weaponApi,AV=window.APEX_ARSENAL_AV,R=window.APEX_QUEST_V12_RIG;\n const actor=(window.fighters||[]).find(f=>f.questId==='SCRAP-B');\n if(!A?.state?.questMultiActor||!actor||!W?.equip||!AV?.drawEquippedWeapon||!R?.inspect)return {ready:false};\n if(!W.equip(actor,'PISTOL'))return {ready:false,reason:'real native equip failed'};\n const h=W.getHolder(actor);\n if(!h)return {ready:false,reason:'native holder absent'};\n h.meta.aimAngle=0;\n Object.assign(h.meta.pose,{localX:0,localY:0,recoil:0,rotKick:0,flourish:0,scaleX:1});\n const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1000;\n const ctx=canvas.getContext('2d');\n actor.draw(ctx); // Actual V12 rig scale, no mock visual.\n const rig=R.inspect(actor);\n const physicsBefore=W.worldAnchor(actor,'PISTOL','muzzle',0);\n const source=AV.weaponImage('PISTOL');\n const drawsBefore=AV.stats.equippedSpriteDraws;\n const proto=CanvasRenderingContext2D.prototype,originalDraw=proto.drawImage;\n let captured=null;\n try{\n   // Chamber Palette intentionally calls the true weapon artist on a\n   // 256x256 offscreen source canvas and returns UNDEFINED from its wrapper.\n   // Intercept only actual PISTOL pixels and restore the native prototype\n   // synchronously; never bypass palette effects or inject fake art.\n   proto.drawImage=function(...args){\n     const img=args[0],path=img?.src||'';\n     if(args.length===9&&typeof path==='string'&&path.includes('/weapons/c/PISTOL.png')){\n       const m=this.getTransform(),palette=this.canvas?.width===256&&this.canvas?.height===256;\n       captured={offset:m.e-(palette?128:actor.x),\n         sourceCanvas:{width:this.canvas.width,height:this.canvas.height},\n         sprite:{width:args[7],height:args[8]},\n         realImage:img.complete&&img.naturalWidth>0,\n         palette};\n     }\n     return originalDraw.apply(this,args);\n   };\n   AV.drawEquippedWeapon(ctx,actor,h);\n }finally{proto.drawImage=originalDraw;}\n const physicsAfter=W.worldAnchor(actor,'PISTOL','muzzle',0);\n return {ready:true,assetReady:!!source,holderId:h.weaponId,\n   rigFactor:rig?.scaleFactor,offset:captured?.offset,\n   expectedOffset:actor.radius*.78*.77,\n   drawCaptured:!!captured,\n   sourceCanvas:captured?.sourceCanvas,\n   sprite:captured?.sprite,\n   palette:captured?.palette,\n   realImage:captured?.realImage,\n   drawsBefore,drawsAfter:AV.stats.equippedSpriteDraws,\n   muzzleUnchanged:physicsBefore.x===physicsAfter.x&&physicsBefore.y===physicsAfter.y,\n   physicsDistance:Math.hypot(physicsBefore.x-actor.x,physicsBefore.y-actor.y)};\n})()");
  gate('Q3u Gold Scout PISTOL sprite follows owner-authored 77% grip',
    q3uGrip?.ready===true&&q3uGrip?.rigFactor===.77
       &&q3uGrip.drawCaptured===true&&q3uGrip.realImage===true
       &&Math.abs(q3uGrip.offset-q3uGrip.expectedOffset)<.05
       &&q3uGrip.drawsAfter>q3uGrip.drawsBefore
       &&q3uGrip.muzzleUnchanged===true
       &&q3uGrip.sprite?.width>0,q3uGrip);
  const q3Restored=await evalPage("(()=>{const old=window.__q3NativeUpdate;if(typeof old!=='function')return false;window.update=old;delete window.__q3NativeUpdate;return window.update===old})()");
  gate('Q3 fixture restores original engine RAF update before exiting Quest',q3Restored===true,{restored:q3Restored});
  // Q3u 3v4 is a protected loopback TEST fixture, never a story skip.
  // Within the already-mounted FIRST WAKE Gold Battle, launch the protected
  // 3v4 fixture so real seven-player sprites appear ON SCREEN, not behind Home.
  const q3uFixture=await evalPage("(()=>{\n if(!['localhost','127.0.0.1','::1'].includes(location.hostname))return {started:false,reason:'not loopback'};\n const previously=window.__APEX_TEST_MODE;\n try{\n   window.__APEX_TEST_MODE=true;\n   const started=window.__apexQuestTestRosterStart?.('3v4')===true;\n   return {started,fixture:window.APEX_ARSENAL?.state?.questTestFixture,\n     count:(window.fighters||[]).length,originalFlag:previously===true};\n }finally{\n   if(previously===undefined)delete window.__APEX_TEST_MODE;\n   else window.__APEX_TEST_MODE=previously;\n }\n})()");
  gate('Q3u private 3v4 Quest fixture starts without exposing a player story skip',
    q3uFixture?.started===true&&q3uFixture.fixture==='3v4'
       &&q3uFixture.count===7,q3uFixture);
  const q3uSeven=await poll("(()=>{\n const f=window.fighters||[],rig=window.APEX_QUEST_V12_RIG,A=window.APEX_ARSENAL;\n const specs=f.map(a=>({id:a.questId,kind:a.questVisualId||null,team:a.questTeam,\n   physicalRadius:a.radius,visual:rig?.inspect?.(a)||null}));\n const projection=window.APEX_GOLD_PROJECTION?.().state||{};\n const groups=projection.questTeams||[],sides=projection.sides||[];\n const host=document.getElementById('battleHudHost');\n const canvas=document.getElementById('game-canvas');\n const canvasRect=canvas?.getBoundingClientRect();\n const projected=['ALLY','HOSTILE'].map((team,i)=>{\n   const members=f.filter(a=>a.questTeam===team),g=groups[i]||[],side=sides[i]||{};\n   const hp=members.reduce((sum,a)=>sum+Math.max(0,a.hp),0);\n   const max=members.reduce((sum,a)=>sum+Math.max(0,a.maxHp),0);\n   const slots=[...(host?.querySelectorAll('#p'+(i+1)+'Rail .vr-quest-slots > span')||[])];\n   return {team,count:members.length,segmentIds:g.map(a=>a.id),\n     expectedIds:members.map(a=>a.questId),hp,max,\n     shownHp:side.hp,shownMax:side.maxHp,\n     domSlots:slots.map(a=>a.dataset.actor),\n     domMatch:slots.length===members.length&&slots.every((n,k)=>n.dataset.actor===members[k].questId),\n     match:g.length===members.length&&g.every((a,k)=>\n       a.id===members[k].questId&&a.hp===members[k].hp&&a.maxHp===members[k].maxHp)\n       &&side.hp===hp&&side.maxHp===max};\n });\n return {started:A?.state?.questTestFixture==='3v4',actors:specs,projected,\n   surface:{open:host?.classList.contains('is-open')===true,\n     canvasVisible:!!canvasRect&&canvasRect.width>100&&canvasRect.height>100},\n   errors:rig?.stats?.failed||0};\n})()",
    x=>x?.started&&x.actors?.length===7&&x.surface?.open&&x.surface?.canvasVisible
      &&x.projected?.[0]?.domMatch&&x.projected?.[1]?.domMatch
      &&['SCRAP-C','SCRAP-D'].every(id=>x.actors.find(a=>a.id===id)?.visual?.clock>0),120);
  const reaver=q3uSeven?.actors?.find(a=>a.id==='SCRAP-C');
  const sentinel=q3uSeven?.actors?.find(a=>a.id==='SCRAP-D');
  gate('Q3u 3v4 renders the REAL Reaver and Sentinel from Gold V12',
    reaver?.kind==='reaver'&&sentinel?.kind==='sentinel'
       &&reaver?.visual?.variant==='reaver'&&sentinel?.visual?.variant==='sentinel'
       &&reaver.visual.clock>0&&sentinel.visual.clock>0
       &&q3uSeven.errors===0,
    {reaver,sentinel,failures:q3uSeven?.errors});
  gate('Q3u Gold really mounts the seven-body Quest fight on the visible canvas',
    q3uSeven?.surface?.open===true&&q3uSeven?.surface?.canvasVisible===true,
    q3uSeven?.surface);
  gate('Q3u mounted Gold rails show 3+4 real independent Fighter HP segments',
    q3uSeven?.projected?.[0]?.count===3&&q3uSeven?.projected?.[1]?.count===4
      &&q3uSeven.projected.every(x=>x.match&&x.domMatch),q3uSeven?.projected);
  await image('06-q3u-seven-fighter-chrome');
  // Q3u small-viewports are real Chrome viewport reflows, not screenshots
  // resized in an image editor. Preserve the original 390×844 mobile
  // emulation after every audit so normal ESC/WAKE gates remain comparable.
  if(isMobile){
    const cases=[
      {name:'iphone-se',w:320,h:568,angle:0,orientation:'portraitPrimary',dpr:2},
      {name:'compact-phone',w:360,h:560,angle:0,orientation:'portraitPrimary',dpr:2},
      {name:'tablet-landscape',w:1024,h:768,angle:90,orientation:'landscapePrimary',dpr:2},
    ];
    for(const c of cases){
      await cmd('Emulation.setDeviceMetricsOverride',{
        width:c.w,height:c.h,deviceScaleFactor:c.dpr,mobile:true,
        screenOrientation:{type:c.orientation,angle:c.angle}});
      await sleep(350);
      const measured=await evalPage("(()=>{\n const h=document.getElementById('battleHudHost'),canvas=document.getElementById('game-canvas');\n const read=el=>{const r=el?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,w:r.width,h:r.height}:null};\n const bars=[read(h?.querySelector('#p1Rail')),read(h?.querySelector('#p2Rail'))];\n const arena=read(canvas);\n const w=window.innerWidth,hgt=window.innerHeight;\n const intersects=r=>!!r&&r.right>1&&r.left<w-1&&r.bottom>1&&r.top<hgt-1&&r.w>15&&r.h>6;\n const fullyInside=r=>intersects(r)&&r.left>=-2&&r.right<=w+2;\n return {viewport:{w,h:hgt},hudOpen:h?.classList.contains('is-open')===true,\n   bars,arena,visible:bars.every(intersects)&&intersects(arena),\n   railsInsideViewport:bars.every(fullyInside),questSlots:[1,2].map(i=>\n     h?.querySelectorAll('#p'+i+'Rail .vr-quest-slots > span')?.length||0)};\n})()");
      await image('07-q3u-'+c.name);
      gate('Q3u '+c.name+' keeps real 3v4 arena and both HP rails accessible',
        measured?.hudOpen===true&&measured?.visible===true
        &&measured?.railsInsideViewport===true
        &&measured.questSlots[0]===3&&measured.questSlots[1]===4,
        measured);
      // Q3v strictly audits two-axis containment and real content in mounted Gold.
      // No global CSS/grid changes; keep visual owner sign-off separate.
      const q3vVisual=await evalPage("(()=>{\n const host=document.getElementById('battleHudHost'),hud=host?.querySelector('#hud');\n const rect=el=>{const r=el?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null;};\n const view={width:innerWidth,height:innerHeight};\n const inside=(r,pad=2)=>!!r&&r.width>0&&r.height>0&&r.left>=-pad&&r.top>=-pad&&r.right<=view.width+pad&&r.bottom<=view.height+pad;\n const separated=(a,b,pad=1)=>!a||!b||a.right<=b.left+pad||b.right<=a.left+pad||a.bottom<=b.top+pad||b.bottom<=a.top+pad;\n const text=el=>{if(!el)return null;const st=getComputedStyle(el);return {value:el.textContent.trim(),visible:st.display!=='none'&&st.visibility!=='hidden',scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,font:st.fontFamily,size:st.fontSize,rect:rect(el),fits:el.scrollWidth<=el.clientWidth+1};};\n const center=rect(hud?.querySelector('#matchCenter'));\n const rails=[1,2].map(i=>{const el=hud?.querySelector('#p'+i+'Rail');const hp=el?.querySelector('.vr-hp');const current=el?.querySelector('.vr-cur');const max=el?.querySelector('.vr-max');const group=rect(hp);\n  return {side:i,rect:rect(el),hp:group,current:text(current),max:text(max),\n   digitsInside:inside(rect(current))&&inside(rect(max)),groupInside:inside(group),\n   noCenterCollision:separated(group,center),textFits:!!current&&!!max&&current.scrollWidth<=current.clientWidth+1&&max.scrollWidth<=max.clientWidth+1};\n });\n const sides=[1,2].map(i=>{const side=hud?.querySelector('#p'+i+'Side');const name=side?.querySelector('.id-name');return {side:i,rect:rect(side),name:text(name),\n   abilitiesVisible:!!side?.querySelector('.skills')&&getComputedStyle(side.querySelector('.skills')).display!=='none',\n   weaponVisible:!!side?.querySelector('.weapon')&&getComputedStyle(side.querySelector('.weapon')).display!=='none'};});\n const skillNames=[...(hud?.querySelectorAll('#p1Side .sk-name')||[])].map(el=>{const r=el?.getBoundingClientRect(),tile=el?.closest('.skill')?.getBoundingClientRect(),meter=el?.closest('.skill')?.querySelector('.sk-meter')?.getBoundingClientRect();return {...text(el),tile:rect(el?.closest('.skill')),insideTile:!!r&&!!tile&&r.left>=tile.left-2&&r.right<=tile.right+2&&r.top>=tile.top-2&&r.bottom<=tile.bottom+2&&(!meter||meter.bottom<=tile.bottom+2)};});\n const arena=rect(document.getElementById('game-canvas'));\n const railBounds=rails.every(r=>inside(r.rect));\n const arenaBounds=inside(arena);\n const hpReadable=rails.every(r=>r.digitsInside&&r.groupInside&&r.noCenterCollision&&r.textFits);\n const factionReadable=sides.every(r=>r.name?.visible&&r.name.fits&&inside(r.name.rect));\n return {viewport:view,layout:hud?.dataset.layout,size:hud?.dataset.size,quest:hud?.dataset.quest,\n  railBounds,arenaBounds,hpReadable,factionReadable,rails,sides,arena,center,skillNames,\n  requiresOwnerVisualReview:true};\n})()");
      await writeFile(path.join(evidenceDir,'q3v-'+c.name+'-readability.json'),
        JSON.stringify(q3vVisual,null,2));
      gate('Q3v '+c.name+' arena AND HP rails fully inside viewport',
        q3vVisual?.quest==='1'&&q3vVisual.railBounds&&q3vVisual.arenaBounds,
        {layout:q3vVisual?.layout,size:q3vVisual?.size,rails:q3vVisual?.rails?.map(x=>x.rect),
         arena:q3vVisual?.arena,viewport:q3vVisual?.viewport});
      gate('Q3v '+c.name+' physical HP digits do not crop or overlap timer',
        q3vVisual?.hpReadable===true,
        {rails:q3vVisual?.rails,center:q3vVisual?.center});
      gate('Q3v '+c.name+' faction names are visible and not ellipsized',
        q3vVisual?.factionReadable===true,
        {sides:q3vVisual?.sides});
      // Owner visual finding: the tablet 200px Quest panel cuts BOTH real
      // skill names to ellipses. Test the actual rendered name text, not
      // the skill tile's existence or an abstract fixture width.
      if(c.name==='iphone-se'||c.name==='compact-phone'){
        gate('Q3v '+c.name+' Quest J/K names AND READY meters fit inside the original cards',
          Array.isArray(q3vVisual?.skillNames)
          &&q3vVisual.skillNames.length===2
          &&q3vVisual.skillNames.every(x=>x.visible&&x.fits&&x.insideTile)
          &&q3vVisual.skillNames[0].value==='WEAPON DASH'
          &&q3vVisual.skillNames[1].value==='VIRTUAL ARMOR',
          {skills:q3vVisual?.skillNames});
      }
      if(c.name==='tablet-landscape'){
        gate('Q3v tablet Quest J/K show their FULL real names without ellipsis',
          Array.isArray(q3vVisual?.skillNames)
          &&q3vVisual.skillNames.length===2
          &&q3vVisual.skillNames.every(x=>x.visible&&x.fits)
          &&q3vVisual.skillNames[0].value==='WEAPON DASH'
          &&q3vVisual.skillNames[1].value==='VIRTUAL ARMOR',
          {skills:q3vVisual.skillNames});
      }
      // K label truncation, sparse tablet hierarchy and V12 art remain owner QA.

    }
    await cmd('Emulation.setDeviceMetricsOverride',{
      width:390,height:844,deviceScaleFactor:3,mobile:true,
      screenOrientation:{type:'portraitPrimary',angle:0}});
    await sleep(250);
  }

  await pressEscape();
  const after=await poll(`(()=>({
    battleOpen:document.getElementById('battleHudHost')?.classList.contains('is-open')===true,
    checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,
    state:window.gameState
  }))()`,v=>!v?.battleOpen&&v?.state!=='ARSENAL',150);
  gate('Exiting CP04 preview does NOT advance story checkpoint',!after?.battleOpen&&after?.checkpoint==='WAKE',after);
  await image('04-return-home');
  await cmd('Page.navigate',{url:appUrl});
  const bootAgain=await poll(`(()=>({
    start:!!document.getElementById('apex-boot-start'),
    mounted:document.getElementById('gold-shell-host')?.dataset?.apexGoldMounted==='1'
  }))()`,v=>v?.start&&v?.mounted,320);
  gate('Page reload restores START / Home',!!bootAgain?.start&&bootAgain?.mounted,bootAgain);
  await click('#apex-boot-start');
  await poll(`(()=>({done:document.body.dataset.apexSceneTransition==='DONE',blackout:document.getElementById('apex-boot-blackout')?.hidden===true}))()`,v=>v?.done&&v?.blackout,320);
  await click('#continueStory');
  const restored=await poll(`(()=>({
    visible:document.getElementById('apexQuest01Stage')?.hidden===false,
    node:document.getElementById('apexQuest01Stage')?.dataset?.node,
    checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId
  }))()`,v=>v?.visible,100);
  gate('Reloaded Continue Story resumes actual WAKE, not completed preview',restored?.node==='WAKE'&&restored?.checkpoint==='WAKE',restored);
  await image('05-reload-resumes-WAKE');
  // Q4A: physical Gold-shell click, not a hidden fixture behind Home.
  // Genuine Quest E01 must be NEWBOT versus T.O.T, with one authored
  // PISTOL telegraph in the same REAL Arsenal spawned-slot collection.
  await click('#q4ReflexPreview');
  const reflex=await poll(`(()=>{const A=window.APEX_ARSENAL,s=A?.state,h=document.getElementById('battleHudHost'),f=window.fighters||[];
    const hud=h?.querySelector('#hud');
    return {open:h?.classList.contains('is-open')===true,quest:!!s?.questReflex,
      roster:f.map(x=>({id:x.questId,team:x.questTeam,maxHp:x.maxHp})),
      phase:window.__apexQuestReflexRead?.()?.phase||null,
      receipts:window.__apexQuestReflexRead?.()?.receipts||[],
      locks:[...(hud?.querySelectorAll('#p1Side .skill')||[])].map(x=>({
        state:x.dataset.state,disabled:x.disabled,
        meter:x.querySelector('.sk-state')?.textContent?.trim()
      })),
      names:[hud?.querySelector('#p1Side .id-name')?.textContent?.trim(),
             hud?.querySelector('#p2Side .id-name')?.textContent?.trim()],
      questHud:hud?.dataset.quest,
      playerMeta:hud?.querySelector('#p1Side .id-ctrl')?getComputedStyle(hud.querySelector('#p1Side .id-ctrl')).display:null,
      scripted:(s?.slots||[]).filter(x=>x.questWeaponId==='PISTOL').map(x=>({id:x.id,phase:x.phase,weapon:x.weaponId})),
      story:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId};})()`,
    x=>x?.open&&x.quest&&x.questHud==='1'&&x.scripted?.length>=1,320);
  gate('Q4A physically clicked REFLEX opens LIVE Gold with real R1 PISTOL telegraph',
    reflex?.open&&reflex?.quest
    &&['R1_PISTOL','R2_PISTOL'].includes(reflex?.phase)
    &&(reflex.phase==='R1_PISTOL'||reflex.receipts?.some(x=>
      x.kind==='PISTOL_HIT'&&x.from==='NEWBOT'&&x.to==='T.O.T'))
    &&reflex?.roster?.length===2
    &&reflex.roster[0].id==='NEWBOT'&&reflex.roster[1].id==='T.O.T'
    &&reflex.scripted.length>=1&&reflex.story==='WAKE',reflex);
  gate('Q4A REFLEX Gold displays T.O.T, never generic SCRAP or LOCAL meta',
    reflex?.names?.[0]==='NEWBOT'&&reflex?.names?.[1]==='T.O.T'
    &&reflex.playerMeta==='none',reflex);
  gate('Q4A before J the actual Quest J/K cards show LOCKED',
    ['R1_PISTOL','R2_PISTOL'].includes(reflex?.phase)
    &&reflex?.locks?.length===2
    &&reflex.locks.every(x=>x.state==='locked'&&x.disabled===true&&x.meter==='LOCKED'),
    reflex?.locks);
  // Q4A visual regression: the prior screenshot showed 0/1000 while
  // both genuine Fighters and bridge projection were 1000/1000.
  // Gate the ACTUAL RENDERED Gold digits and bar transforms, not only
  // the engine, an abstract JS state or an offscreen fixture.
  const q4HpTruth=await evalPage(`(()=>{
    const host=document.getElementById('battleHudHost');
    const projected=window.APEX_GOLD_PROJECTION?.()?.state?.sides||[];
    const actors=window.fighters||[];
    const rails=[host?.querySelector('#p1Rail'),host?.querySelector('#p2Rail')];
    return rails.map((rail,i)=>({
      actorHp:actors[i]?.hp,actorMax:actors[i]?.maxHp,
      projectedHp:projected[i]?.hp,projectedMax:projected[i]?.maxHp,
      rendered:rail?.querySelector('.vr-cur')?.textContent?.trim(),
      renderedMax:rail?.querySelector('.vr-max')?.textContent?.trim(),
      visibleFill:rail?.querySelector('.vr-fill')?.style.transform||''
    }));
  })()`);
  gate('Q4A real Gold rails numerically match live fighter HP and fill ratios',
    Array.isArray(q4HpTruth)&&q4HpTruth.length===2
    &&q4HpTruth.every(x=>{
      const fill=Number((x.visibleFill||'').slice(7,-1));
      const fillShape=(x.visibleFill||'').startsWith('scaleX(')&&x.visibleFill.endsWith(')');
      return Number.isFinite(x.actorHp)&&x.actorHp>0
        &&x.actorMax===1000
        &&x.projectedHp===x.actorHp&&x.projectedMax===x.actorMax
        &&Number(x.rendered)===Math.round(x.actorHp)
        &&x.renderedMax==='/1000'
        &&fillShape&&Number.isFinite(fill)&&Math.abs(fill-x.actorHp/x.actorMax)<0.001;
    }),q4HpTruth);
  await image('08-q4a-reflex-gold-real');
  // Q4C.4 RED-LAW: no rig release may be granted merely because E01 began.
  const deniedEarly=await evalPage(`(()=>{
    // The public Gold Story preview is NOT a Story-release authorization.
    // Test this unpublished engineering seam only on localhost with a
    // transient test capability, then always restore the original value.
    if(!['localhost','127.0.0.1','::1'].includes(location.hostname))
      return {ok:false,reason:'not-loopback'};
    const previous=window.__APEX_TEST_MODE;
    try{
      window.__APEX_TEST_MODE=true;
      return window.__apexQuestRivetPreviewRelease?.()||null;
    }finally{
      if(previous===undefined)delete window.__APEX_TEST_MODE;
      else window.__APEX_TEST_MODE=previous;
    }
  })()`);
  gate('Q4C4 real Gold rejects RIVET before R1/R2/J/K and HP gates',
    deniedEarly?.ok===false&&deniedEarly?.reason==='real-safe-hold-required',
    deniedEarly);

  // Q4B: keep the Gold scene ACTUALLY VISIBLE, then fast-forward only
  // canonical Arsenal physics and accepted HeroRework input. No fake HP,
  // direct projectile creation, position warp or checkpoint mutation.
  // Evidence includes a full-frame screenshot at the rescue hold.
  const q4bSoak=await evalPage(`(()=>{
    const A=window.APEX_ARSENAL,H=window.APEX_HERO_REWORK;
    const actors=window.fighters||[];
    if(!A?.state?.questReflex||actors.length!==2)return {ready:false};
    let j=false,k=false,jAttempts=0,kAttempts=0,frames=0;
    for(;frames<7100;frames++){
      A.step(.05);
      const phase=window.__apexQuestReflexRead?.()?.phase;
      if(phase==='J_CAST'&&frames%10===0){
        jAttempts++;j=H.pressAbility(actors[0],'A1',
          {side:'p1',source:'keyboard',key:'KeyJ'})?.ok===true||j;
      }
      if(phase==='K_CAST'&&frames%10===0){
        kAttempts++;k=H.pressAbility(actors[0],'A2',
          {side:'p1',source:'keyboard',key:'KeyK'})?.ok===true||k;
      }
      if(phase==='AWAIT_RIVET'||A.state.over)break;
    }
    A.step(.05); // arms the safe-hold transition without altering HP
    const before={hp:actors.map(f=>f.hp),time:A.state.time,
      pos:actors.map(f=>[f.x,f.y]),proj:window.projectiles.length};
    for(let t=0;t<80;t++)A.step(.05);
    const after={hp:actors.map(f=>f.hp),time:A.state.time,
      pos:actors.map(f=>[f.x,f.y]),proj:window.projectiles.length};
    return {ready:true,phase:window.__apexQuestReflexRead?.()?.phase,
      awaiting:window.__apexQuestReflexRead?.()?.awaitingRivet,
      complete:window.__apexQuestReflexRead?.()?.complete,
      j,k,jAttempts,kAttempts,frames,before,after,
      hold:A.state.questReflexHold,over:A.state.over,
      checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId};
  })()`);
  gate('Q4B real Chrome Gold reaches RIVET hold by organic Arsenal + accepted J/K',
    q4bSoak?.ready===true&&q4bSoak?.phase==='AWAIT_RIVET'
    &&q4bSoak?.j===true&&q4bSoak?.k===true
    &&q4bSoak?.awaiting===true&&q4bSoak?.complete===false
    &&q4bSoak?.over===null&&q4bSoak?.checkpoint==='WAKE'
    &&q4bSoak?.before?.hp?.every(h=>h>=250&&h<=500),q4bSoak);
  gate('Q4B rescued actors, clock and active projectiles settle safely on Gold',
    JSON.stringify(q4bSoak?.before)===JSON.stringify(q4bSoak?.after)
    &&q4bSoak?.before?.proj===0
    &&q4bSoak?.hold?.phase==='AWAIT_RIVET'
    &&Number.isInteger(q4bSoak?.hold?.interruptedProjectiles),q4bSoak);
  await sleep(350); // permit real Gold projection to present the frozen HP
  const q4bGold=await evalPage(`(()=>{
    const host=document.getElementById('battleHudHost');
    const hud=host?.querySelector('#hud'),f=window.fighters||[];
    const rows=[1,2].map((n,i)=>({
      actorHp:f[i]?.hp,readHp:Number(host?.querySelector('#p'+n+'Rail .vr-cur')?.textContent?.trim()),
      max:host?.querySelector('#p'+n+'Rail .vr-max')?.textContent?.trim()
    }));
    const abilities=[...(hud?.querySelectorAll('#p1Side .skill')||[])].map(el=>({
      locked:el.dataset.state==='locked',disabled:el.disabled,
      meter:el.querySelector('.sk-state')?.textContent?.trim()
    }));
    return {rows,abilities,visible:host?.classList.contains('is-open'),
      node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId};
  })()`);
  gate('Q4B full Gold rescue-hold frame shows true HP and LOCKED J/K, no fake checkpoint',
    q4bGold?.visible===true&&q4bGold?.node==='WAKE'
    &&q4bGold.rows?.length===2&&q4bGold.rows.every(r=>
      Number.isFinite(r.actorHp)&&r.actorHp>0
      &&r.readHp===Math.round(r.actorHp)&&r.max==='/1000')
    &&q4bGold.abilities?.length===2
    &&q4bGold.abilities.every(x=>x.locked&&x.disabled&&x.meter==='LOCKED'),
    q4bGold);
  await image('09-q4b-real-gold-rivet-hold');
  // Q4C.4: prove the real STORMBREAKER projectile is present in the
  // Gold-mounted *rendered* Chrome scene, not merely the native VM. The
  // preview is test-only: it does NOT create a rig character asset,
  // resolve story dialogue, hit either friend or advance WORKSHOP.
  const q4cKick=await evalPage(`(()=>{
    const A=window.APEX_ARSENAL,s=A?.state,actors=window.fighters||[];
    const before={hp:actors.map(f=>f.hp),time:s?.time,
      pos:actors.map(f=>[f.x,f.y]),
      slots:s?.slots?.map(x=>[x.id,x.phase])};
    // Q3U browser tests already exercise loopback-only test authority via
    // a temporary __APEX_TEST_MODE. Apply that same strict scope here.
    // No shipped Gold interaction can start the rig on its own.
    const previous=window.__APEX_TEST_MODE;
    let first,duplicate;
    try{
      if(!['localhost','127.0.0.1','::1'].includes(location.hostname))
        return {first:{ok:false,reason:'not-loopback'}};
      window.__APEX_TEST_MODE=true;
      first=window.__apexQuestRivetPreviewRelease?.();
      duplicate=window.__apexQuestRivetPreviewRelease?.();
    }finally{
      if(previous===undefined)delete window.__APEX_TEST_MODE;
      else window.__APEX_TEST_MODE=previous;
    }
    const holder=A?.weaponApi?.getHolder(s?.questRivetPreview?.operator);
    const premature=window.__apexQuestReflexTechnicalRead?.();
    return {first,duplicate,before,holder:holder?.weaponId,premature,
      liveRoster:actors.map(f=>f.questId),
      stage:window.__apexQuestReflexRead?.()?.phase,
      checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId};
  })()`);
  gate('Q4C4 exactly one authorized physical floor Stormbreaker (not thrown/equipped)',
    q4cKick?.first?.ok===true&&q4cKick?.first?.phase==='FLOOR_CHARGING'
    &&q4cKick?.duplicate?.ok===false
    &&q4cKick?.duplicate?.reason==='already-released'
    &&q4cKick?.holder!=='STORMBREAKER'
    &&q4cKick?.premature?.ready===false
    &&q4cKick?.premature?.reason==='gold-floor-lightning-incomplete'
    &&q4cKick?.liveRoster?.join(',')==='NEWBOT,T.O.T'
    &&q4cKick?.stage==='AWAIT_RIVET'&&q4cKick?.checkpoint==='WAKE',q4cKick);
  const q4cFlight=await evalPage(`(()=>{
    const A=window.APEX_ARSENAL,storm=window.APEX_ARSENAL_STORM;
    const art=window.APEX_ARSENAL_AV?.weaponImage?.('STORMBREAKER');
    let proj=null,frames=0;
    for(;frames<360;frames++){
      A?.step?.(.05);
      proj=(window.projectiles||[]).find(p=>p.questRivetSuppression===true);
      if(proj)break;
    }
    const visual=storm?.flightPresentationProbe?.();
    return {frames,proj:proj?{aq:proj.aq,type:proj.type,
      weapon:proj.weapon,owner:proj.owner?.questId,
      radius:proj.radius,x:proj.x,y:proj.y,vx:proj.vx,vy:proj.vy,
      maxFlight:proj.maxFlight}:null,
      visual:visual?{x:visual.x,y:visual.y,long:visual.long,
        ghostCount:visual.ghosts?.length,mirror:visual.mirror}:null,
      vfxOwner:storm?.ownsFlightSprite,
      artLoaded:!!(art?.img?.complete&&art?.img?.naturalWidth>0),
      hudVisible:document.getElementById('battleHudHost')?.classList.contains('is-open')===true,
      phase:A?.state?.questRivetPreview?.phase};
  })()`);
  gate('Q4C4 floor manifestation produces NO thrown projectile and preserves Gold HUD',
    q4cFlight?.proj===null
    &&q4cFlight?.hudVisible===true&&q4cFlight?.artLoaded===true
    &&q4cFlight?.phase==='SETTLED',q4cFlight);
  // Let rAF render the actual frame before capturing screenshot evidence.
  await sleep(30);
  await image('10-q4c-gold-real-stormbreaker-flight');
  const q4cSettle=await evalPage(`(()=>{
    const A=window.APEX_ARSENAL,s=A?.state,actors=window.fighters||[];
    for(let i=0;i<400&&s?.questRivetPreview?.phase!=='SETTLED';i++){
      A?.step?.(.05);
    }
    // Additional frames catch late projectiles and accidental second release.
    for(let i=0;i<40;i++)A?.step?.(.05);
    const after={hp:actors.map(f=>f.hp),time:s?.time,
      pos:actors.map(f=>[f.x,f.y]),
      slots:s?.slots?.map(x=>[x.id,x.phase])};
    return {after,phase:s?.questRivetPreview?.phase,
      settled:s?.questRivetPreview?.settled,peak:s?.questRivetPreview?.peakFlight,
      projectileCount:(window.projectiles||[]).length,
      hold:s?.questReflexHold?.phase,
      skills:[...(document.querySelectorAll('#battleHudHost #p1Side .skill')||[])]
        .map(x=>({locked:x.dataset.state==='locked',disabled:x.disabled})),
      stage:window.__apexQuestReflexRead?.()?.phase,
      checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,
      storyProgress:window.__apexQuestReflexRead?.()?.storyProgress,
      complete:window.__apexQuestReflexRead?.()?.complete,
      technical:window.__apexQuestReflexTechnicalRead?.(),
      storyBeats:window.__apexQuestStoryBeatsRead?.(),
      rigGround:s?.questRivetPreview?.aimPoint&&
        {x:s.questRivetPreview.aimPoint.x,y:s.questRivetPreview.aimPoint.y},
      over:s?.over||null};
  })()`);
  gate('Q4C4 real floor discharge >=3s and >=10 lightning frames, zero fake damage/save',
    q4cSettle?.phase==='SETTLED'&&q4cSettle?.settled===true
    &&q4cSettle?.projectileCount===0
    &&q4cSettle?.hold==='AWAIT_RIVET'
    &&JSON.stringify(q4cKick?.before?.hp)===JSON.stringify(q4cSettle?.after?.hp)
    &&JSON.stringify(q4cKick?.before?.pos)===JSON.stringify(q4cSettle?.after?.pos)
    &&q4cKick?.before?.time===q4cSettle?.after?.time
    &&q4cSettle?.skills?.length===2
    &&q4cSettle.skills.every(x=>x.locked&&x.disabled)
    &&q4cSettle?.stage==='AWAIT_RIVET'
    &&q4cSettle?.checkpoint==='WAKE'
    &&q4cSettle?.storyProgress===false&&q4cSettle?.complete===false
    &&q4cSettle?.technical?.ready===true
    &&q4cSettle?.technical?.phase==='FLOOR_DISCHARGED'
    &&q4cSettle?.technical?.groundImpact?.kind==='REAL_ARSENAL_FLOOR_SPAWN'
    &&q4cSettle?.technical?.electricFrames>=10
    &&q4cSettle?.technical?.peakBolts>0
    &&q4cSettle?.technical?.elapsed>=3
    &&q4cSettle?.storyBeats?.emitted?.join('|')===
      'E01_R1_IMPACT|E01_R2_IMPACT|E01_J_REVEAL|E01_K_REVEAL|E01_RIVET_HOLD|E01_RIVET_SUPPRESSION_TECH'
    &&q4cSettle.storyBeats.checkpointAuthorized===false
    &&q4cSettle.storyBeats.storyComplete===false
    &&q4cSettle.technical.kind==='E01_RIVET_TECHNICAL_PREVIEW'
    &&q4cSettle.technical.checkpointAuthorized===false
    &&q4cSettle.technical.storyComplete===false
    &&q4cSettle?.over===null,q4cSettle);
  await sleep(30);
  await image('11-q4c-gold-stormbreaker-safe-settle');

  await pressEscape();
  const afterReflex=await poll(`(()=>({
    opened:document.getElementById('battleHudHost')?.classList.contains('is-open')===true,
    checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,
    read:window.__apexQuestReflexRead?.(),
    technical:window.__apexQuestReflexTechnicalRead?.(),
    storyBeats:window.__apexQuestStoryBeatsRead?.(),
    active:window.APEX_ARSENAL?.state?.active}))()`,
    x=>x?.opened===false&&x.active===false,150);
  gate('Q4A REFLEX exit releases receipt and preserves real WAKE checkpoint',
    afterReflex?.opened===false&&afterReflex?.active===false
    &&afterReflex?.read==null
    &&afterReflex?.technical?.ready===false
    &&afterReflex?.technical?.reason==='no-active-reflex'
    &&afterReflex?.storyBeats==null
    &&afterReflex?.checkpoint==='WAKE',afterReflex);

  // Q4E3: separate OWNER-VISIBLE Story version of the genuine REFLEX.
  // The existing technical REFLEX preview above must remain untouched.
  await click('#continueStory');
  const storyButton=await evalPage("(()=>({button:!!document.getElementById('q4eStoryPreview'),checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId}))()");
  gate('Q4E3 Quest WAKE exposes opt-in story preview without progressing save',
    storyButton?.button===true&&storyButton?.checkpoint==='WAKE',storyButton);
  const q4eClick=await click('#q4eStoryPreview');
  gate('Q4E3 story version selected by real physical click',q4eClick.hit,q4eClick);
  const storyLive=await poll("(()=>({open:document.getElementById('battleHudHost')?.classList.contains('is-open'),quest:window.APEX_ARSENAL?.state?.questReflex,view:window.__apexQuestStoryViewRead?.(),actors:(window.fighters||[]).length}))()",
    v=>v?.open===true&&v?.quest===true&&v?.view?.active===false&&v?.actors===2,450);
  gate('Q4E3 Story preview uses same two actual Arsenal Fighters and mounts presentation',
    storyLive?.open===true&&storyLive.quest===true&&storyLive.actors===2
    &&storyLive.view?.active===false,storyLive);
  const firstImpact=await evalPage("(()=>{const A=window.APEX_ARSENAL;let n=0;for(;n<1800;n++){if(window.__apexQuestStoryViewRead?.()?.active)break;A.step(.05)}const v=window.__apexQuestStoryViewRead?.();const e=document.getElementById('apexQuestStoryView');const s=A.state;return {steps:n,view:v,phase:s.questReflexGate?.snapshot()?.phase,checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,pausedScene:e?.dataset.beat,canvas:[...e?.querySelectorAll('canvas')||[]].map(x=>({w:x.width,h:x.height})),hp:(window.fighters||[]).map(x=>x.hp),clock:s.time,pos:(window.fighters||[]).map(x=>[x.x,x.y])}})()");
  gate('Q4E3 first real R1 PISTOL hit pauses in cinematic story panel',
    firstImpact?.view?.active===true
    &&firstImpact?.view?.current==='E01_R1_IMPACT'
    &&firstImpact?.pausedScene==='E01_R1_IMPACT'
    &&firstImpact?.phase==='R2_PISTOL'
    &&firstImpact?.canvas?.length===2
    &&firstImpact.canvas.every(x=>x.w>0&&x.h>0)
    &&firstImpact?.checkpoint==='WAKE',firstImpact);
  await sleep(60);
  await image('12-q4e3-r1-real-impact-story-panel');
  const storyFreeze=await evalPage("(()=>{const A=window.APEX_ARSENAL;const f=window.fighters||[];const pre={hp:f.map(x=>x.hp),pos:f.map(x=>[x.x,x.y]),clock:A.state.time,slots:A.state.slots.map(x=>[x.id,x.phase])};for(let i=0;i<50;i++)A.step(.05);const post={hp:f.map(x=>x.hp),pos:f.map(x=>[x.x,x.y]),clock:A.state.time,slots:A.state.slots.map(x=>[x.id,x.phase])};return {pre,post,view:window.__apexQuestStoryViewRead?.()}})()");
  gate('Q4E3 story input lease freezes canonical HP, position, slots and clock',
    storyFreeze?.view?.active===true
    &&JSON.stringify(storyFreeze?.pre)===JSON.stringify(storyFreeze?.post),
    storyFreeze);
  const layouts=[
    {name:'phone-compact',w:360,h:640,angle:0,type:'portraitPrimary'},
    {name:'tablet-landscape',w:1024,h:768,angle:90,type:'landscapePrimary'}
  ];
  for(const l of layouts){
    await cmd('Emulation.setDeviceMetricsOverride',{width:l.w,height:l.h,
      deviceScaleFactor:2,mobile:true,
      screenOrientation:{type:l.type,angle:l.angle}});
    await sleep(95);
    const visual=await evalPage("(()=>{const e=document.getElementById('apexQuestStoryView'),body=e?.querySelector('.qs-body'),comic=e?.querySelector('.qs-comic'),footer=e?.querySelector('.qs-footer'),btn=e?.querySelector('.qs-controls button:not(.qs-skip)');const rect=x=>{const r=x?.getBoundingClientRect();return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};const inside=r=>r&&r.left>=-2&&r.top>=-2&&r.right<=innerWidth+2&&r.bottom<=innerHeight+2;return {viewport:[innerWidth,innerHeight],beat:e?.dataset.beat,body:rect(body),comic:rect(comic),footer:rect(footer),button:rect(btn),inside:[body,comic,footer,btn].every(x=>inside(rect(x))),overflow:document.documentElement.scrollWidth>innerWidth+3}})()");
    gate('Q4E3 '+l.name+' comic and Continue button remain viewport-contained',
      visual?.inside===true&&visual?.overflow===false
      &&visual?.beat==='E01_R1_IMPACT',visual);
    await image('13-q4e3-'+l.name+'-real-story-panel');
  }
  const continueClick=await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
  gate('Q4E3 physical Continue advances the story panel, not Story save',continueClick.hit,continueClick);
  const afterContinue=await evalPage("(()=>({view:window.__apexQuestStoryViewRead?.(),checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,phase:window.__apexQuestReflexRead?.()?.phase,live:window.APEX_ARSENAL?.state?.active}))()");
  gate('Q4E3 Continue releases R1 pause while preserving real R2 combat gate',
    afterContinue?.view?.active===false
    &&afterContinue.view.shown.join('|')==='E01_R1_IMPACT'
    &&afterContinue?.checkpoint==='WAKE'&&afterContinue?.live===true
    &&afterContinue?.phase==='R2_PISTOL',afterContinue);

  // Q4G: one FULL STORY-PREVIEW rescue, no prototype-only manual rig launch.
  // Every transition is earned by real Arsenal damage/casts and real clicks.
  const q4gR2=await evalPage("(()=>{const A=window.APEX_ARSENAL;let n=0;for(;n<2200;n++){A.step(.05);if(window.__apexQuestStoryViewRead?.()?.active)break;}return {steps:n,scene:window.__apexQuestStoryViewRead?.()?.current,phase:window.__apexQuestReflexRead?.()?.phase}})()");
  gate('Q4G real retaliatory R2 impact opens its own story scene',
    q4gR2?.scene==='E01_R2_IMPACT'&&q4gR2?.phase==='J_CAST',q4gR2);
  const r2Continue=await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
  gate('Q4G physical R2 scene Continue',r2Continue.hit,r2Continue);
  const jNotice=await evalPage("(()=>({scene:window.__apexQuestStoryViewRead?.()?.current,phase:window.__apexQuestReflexRead?.()?.phase}))()");
  gate('Q4G first routine reveal stays behind R2 impact',jNotice?.scene==='E01_J_REVEAL'&&jNotice?.phase==='J_CAST',jNotice);
  await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
  const q4gJ=await evalPage("(()=>{const A=window.APEX_ARSENAL,H=window.APEX_HERO_REWORK;let n=0,accepted=false;for(;n<1600;n++){A.step(.05);const phase=window.__apexQuestReflexRead?.()?.phase;if(phase==='J_CAST'&&n%10===0)accepted=H.pressAbility(window.fighters[0],'A1',{side:'p1',source:'keyboard',key:'KeyJ'})?.ok===true||accepted;if(window.__apexQuestStoryViewRead?.()?.active)break;}return {steps:n,accepted,scene:window.__apexQuestStoryViewRead?.()?.current,phase:window.__apexQuestReflexRead?.()?.phase}})()");
  gate('Q4G accepted real J cast unlocks next narrative K cue',
    q4gJ?.accepted===true&&q4gJ?.scene==='E01_K_REVEAL'&&q4gJ?.phase==='K_CAST',q4gJ);
  await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
  const q4gHold=await evalPage("(()=>{const A=window.APEX_ARSENAL,H=window.APEX_HERO_REWORK;let n=0,accepted=false;for(;n<6200;n++){A.step(.05);const phase=window.__apexQuestReflexRead?.()?.phase;if(phase==='K_CAST'&&n%10===0)accepted=H.pressAbility(window.fighters[0],'A2',{side:'p1',source:'keyboard',key:'KeyK'})?.ok===true||accepted;if(window.__apexQuestStoryViewRead?.()?.active)break;}const s=A.state;return {steps:n,kAccepted:accepted,scene:window.__apexQuestStoryViewRead?.()?.current,phase:window.__apexQuestReflexRead?.()?.phase,hp:window.fighters.map(f=>f.hp),rig:s.questRivetPreview?.phase||null,clock:s.time,checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId}})()");
  gate('Q4G real K + both HP thresholds reach guarded RIVET story hold',
    q4gHold?.kAccepted===true&&q4gHold?.scene==='E01_RIVET_HOLD'
    &&q4gHold?.phase==='AWAIT_RIVET'
    &&q4gHold.hp?.every(h=>h>=250&&h<=500)
    &&q4gHold?.rig==null&&q4gHold?.checkpoint==='WAKE',q4gHold);
  const holdClick=await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
  // CDP touchEnd is delivered asynchronously. Observe the result of the
  // PHYSICAL tap; do not direct-call any rescue function to fake success.
  const auto=await poll("(()=>({start:window.APEX_ARSENAL?.state?.questStoryRescueStart,phase:window.APEX_ARSENAL?.state?.questRivetPreview?.phase,view:window.__apexQuestStoryViewRead?.()}))()",
    v=>v?.start?.ok===true&&(v?.phase==='FLOOR_CHARGING'||v?.phase==='SETTLED')&&v?.view?.active===false,90);
  gate('Q4G physical Continue starts exactly one real Stormbreaker floor manifestation',
    holdClick.hit&&auto?.start?.ok===true&&['FLOOR_CHARGING','SETTLED'].includes(auto?.phase)
    &&auto?.view?.active===false,auto);
  const q4gGround=await evalPage("(()=>{const A=window.APEX_ARSENAL;let n=0;for(;n<450;n++){A.step(.05);if(window.__apexQuestStoryViewRead?.()?.active)break;}const rig=A.state.questRivetPreview,proof=window.__apexQuestReflexTechnicalRead?.();return {steps:n,scene:window.__apexQuestStoryViewRead?.()?.current,rig:rig?.phase,contact:rig?.groundImpact,proof,checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,hp:window.fighters.map(f=>f.hp),storySave:window.__apexQuestReflexRead?.()?.storyProgress,visualImpacts:window.APEX_ARSENAL_STORM?.stats?.impacts}})()");
  gate('Q4G grounded Stormbreaker electrifies for 3s, opens scene without HP/save mutation',
    q4gGround?.scene==='E01_RIVET_SUPPRESSION_TECH'
    &&q4gGround?.rig==='SETTLED'
    &&q4gGround?.contact?.kind==='REAL_ARSENAL_FLOOR_SPAWN'
    &&q4gGround?.proof?.ready===true
    &&q4gGround?.checkpoint==='WAKE'
    &&q4gGround?.storySave===false
    &&JSON.stringify(q4gGround?.hp)===JSON.stringify(q4gHold?.hp),q4gGround);
  await image('14-q4g-real-stormbreaker-ground-story');
  const groundClick=await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
  const workshop=await poll("(()=>({scene:window.__apexQuestStoryViewRead?.()?.current,shown:window.__apexQuestStoryViewRead?.()?.shown,workshop:window.APEX_ARSENAL?.state?.questWorkshopPreview,node:document.getElementById('apexQuestStoryView')?.dataset.beat,checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId}))()",
    v=>v?.scene==='WORKSHOP_ARRIVAL'&&v?.workshop===true,90);
  gate('Q4G verified ground cue triggers blackout WORKSHOP preview only',
    groundClick.hit&&workshop?.scene==='WORKSHOP_ARRIVAL'
    &&workshop?.node==='WORKSHOP_ARRIVAL'
    &&workshop?.workshop===true&&workshop?.checkpoint==='WAKE',workshop);
  await image('15-q4g-workshop-preview-blackout');
  await cmd('Emulation.setDeviceMetricsOverride',{width:360,height:640,
    deviceScaleFactor:2,mobile:true,screenOrientation:{type:'portraitPrimary',angle:0}});
  await sleep(80);
  const workshopMobile=await evalPage("(()=>{const e=document.getElementById('apexQuestStoryView'),footer=e?.querySelector('.qs-footer'),btn=e?.querySelector('.qs-controls button:not(.qs-skip)');const inside=x=>{const r=x?.getBoundingClientRect();return !!r&&r.left>=-2&&r.top>=-2&&r.right<=innerWidth+2&&r.bottom<=innerHeight+2};return {scene:e?.dataset.beat,inside:[footer,btn].every(inside),overflow:document.documentElement.scrollWidth>innerWidth+2}})()");
  gate('Q4G WORKSHOP blackout preview controls remain inside compact phone',
    workshopMobile?.scene==='WORKSHOP_ARRIVAL'
    &&workshopMobile?.inside===true&&workshopMobile?.overflow===false,workshopMobile);
  await image('16-q4g-workshop-phone');
  const workshopClick=await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
  const finalPreview=await poll("(()=>({view:window.__apexQuestStoryViewRead?.(),phase:window.__apexQuestReflexRead?.()?.phase,checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId}))()",
    v=>v?.view?.active===false,90);
  gate('Q4G finish preview leaves E01 safe-hold and does not forge Director save',
    workshopClick.hit&&finalPreview?.view?.active===false
    &&finalPreview?.phase==='AWAIT_RIVET'
    &&finalPreview?.checkpoint==='WAKE',finalPreview);
  await pressEscape();
  const afterStoryExit=await poll("(()=>({open:document.getElementById('battleHudHost')?.classList.contains('is-open'),view:window.__apexQuestStoryViewRead?.(),node:document.getElementById('apexQuestStoryView'),checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId}))()",
    x=>x?.open===false,150);
  gate('Q4E3 Exit destroys cinematic DOM and leaves WAKE save unmodified',
    afterStoryExit?.open===false&&afterStoryExit?.view==null
    &&afterStoryExit?.node==null&&afterStoryExit?.checkpoint==='WAKE',afterStoryExit);

  { // Q4H isolated lexical scope: prevent collisions with prior browser gates
  // Q4H: ACTUAL Quest opening/save lane, separate from non-saving previews.
  // Entry and ALL scene acknowledgements are native CDP mouse or touch.
  // Only production Arsenal shots/casts/Stormbreaker can authorize progress.
  await click('#continueStory');
  const q4hButton=await click('#q4hQuestPlay');
  const wake=await poll("(()=>({beat:window.__apexQuestStoryViewRead?.()?.current,phase:window.__apexQuestReflexRead?.()?.phase,node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,mode:window.APEX_ARSENAL?.state?.questStoryCompletion,hp:(window.fighters||[]).map(x=>x.hp)}))()",
    v=>v?.beat==='WAKE_OPEN'&&v?.node==='WAKE'&&v?.mode===true,150);
  gate('Q4H physical Quest START presents true fresh-match WAKE, no auto-advance',
    q4hButton.hit&&wake?.beat==='WAKE_OPEN'&&wake.phase==='R1_PISTOL'
    &&wake.node==='WAKE'&&wake.mode===true
    &&wake.hp?.length===2&&wake.hp.every(x=>x===1000),wake);
  const early=await evalPage("(()=>({invalid:window.APEX_QUEST01_DIRECTOR.acceptNativeBeat('WORKSHOP_ARRIVAL'),blocked:window.APEX_QUEST01_DIRECTOR.acceptNativeBeat('WAKE_OPEN'),node:window.APEX_QUEST01_DIRECTOR.checkpoint().checkpointId}))()");
  gate('Q4H deny checkpoint writes while any narrative panel owns input',
    early?.invalid?.ok===false&&early?.blocked?.ok===false&&early?.node==='WAKE',early);
  await image('17-q4h-live-wake-comic');
  await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
  const entered=await poll("(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,phase:window.__apexQuestReflexRead?.()?.phase,active:window.__apexQuestStoryViewRead?.()?.active,cues:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.completedCueIds}))()",
    v=>v?.node==='REFLEX'&&v?.active===false,100);
  gate('Q4H first true Story acknowledgement saves adjacent WAKE to REFLEX only',
    entered?.node==='REFLEX'&&entered?.phase==='R1_PISTOL'
    &&entered?.cues?.join('|')==='WAKE_OPEN',entered);
  const deniedRepeat=await evalPage("(()=>window.APEX_QUEST01_DIRECTOR?.acceptNativeBeat('WAKE_OPEN'))()");
  gate('Q4H repeated WAKE acknowledgement cannot grant a second checkpoint',
    deniedRepeat?.ok===false,deniedRepeat);
  const first=await evalPage("(()=>{const A=window.APEX_ARSENAL;let n=0;for(;n<2400;n++){A.step(.05);if(window.__apexQuestStoryViewRead?.()?.active)break;}return {steps:n,scene:window.__apexQuestStoryViewRead?.()?.current,phase:window.__apexQuestReflexRead?.()?.phase}})()");
  gate('Q4H REFLEX continues from genuine R1 PISTOL, not a Story timer',
    first?.scene==='E01_R1_IMPACT'&&first?.phase==='R2_PISTOL',first);
  await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
  await poll("window.__apexQuestStoryViewRead?.()?.active",v=>v===false,100);
  const second=await evalPage("(()=>{const A=window.APEX_ARSENAL;let n=0;for(;n<2400;n++){A.step(.05);if(window.__apexQuestStoryViewRead?.()?.active)break;}return {steps:n,scene:window.__apexQuestStoryViewRead?.()?.current,phase:window.__apexQuestReflexRead?.()?.phase}})()");
  gate('Q4H real T.O.T retaliation R2 gates actual J reveal',
    second?.scene==='E01_R2_IMPACT'&&second?.phase==='J_CAST',second);
  await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
  const jTitle=await poll("window.__apexQuestStoryViewRead?.()?.current",v=>v==='E01_J_REVEAL',100);
  gate('Q4H genuine R2 cue precedes J introduction',jTitle==='E01_J_REVEAL',{scene:jTitle});
  await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
  await poll("window.__apexQuestStoryViewRead?.()?.active",v=>v===false,100);
  const jCast=await evalPage("(()=>{const A=window.APEX_ARSENAL,H=window.APEX_HERO_REWORK;let n=0,cast=false;for(;n<1900;n++){A.step(.05);if(window.__apexQuestReflexRead?.()?.phase==='J_CAST'&&n%10===0)cast=H.pressAbility(window.fighters[0],'A1',{side:'p1',source:'keyboard',key:'KeyJ'})?.ok===true||cast;if(window.__apexQuestStoryViewRead?.()?.active)break;}return {steps:n,cast,scene:window.__apexQuestStoryViewRead?.()?.current,phase:window.__apexQuestReflexRead?.()?.phase}})()");
  gate('Q4H only actual HeroRework J Cast yields K reveal',
    jCast?.cast===true&&jCast?.scene==='E01_K_REVEAL'&&jCast?.phase==='K_CAST',jCast);
  await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
  await poll("window.__apexQuestStoryViewRead?.()?.active",v=>v===false,100);
  const kCast=await evalPage("(()=>{const A=window.APEX_ARSENAL,H=window.APEX_HERO_REWORK;let n=0,cast=false;for(;n<6800;n++){A.step(.05);if(window.__apexQuestReflexRead?.()?.phase==='K_CAST'&&n%10===0)cast=H.pressAbility(window.fighters[0],'A2',{side:'p1',source:'keyboard',key:'KeyK'})?.ok===true||cast;if(window.__apexQuestStoryViewRead?.()?.active)break;}return {steps:n,cast,scene:window.__apexQuestStoryViewRead?.()?.current,phase:window.__apexQuestReflexRead?.()?.phase,hp:(window.fighters||[]).map(x=>x.hp),node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId}})()");
  gate('Q4H native K and both actual <=500 HP earn RIVET entry, save stays REFLEX',
    kCast?.cast===true&&kCast?.scene==='E01_RIVET_HOLD'
    &&kCast?.phase==='AWAIT_RIVET'
    &&kCast.hp?.length===2&&kCast.hp.every(x=>x>=250&&x<=500)
    &&kCast?.node==='REFLEX',kCast);
  const deniedBefore=await evalPage("(()=>window.APEX_QUEST01_DIRECTOR?.acceptNativeBeat('WORKSHOP_ARRIVAL'))()");
  gate('Q4H prevent WORKSHOP save before actual Stormbreaker floor hit',
    deniedBefore?.ok===false,deniedBefore);
  await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
  const rig=await poll("(()=>({ok:window.APEX_ARSENAL?.state?.questStoryRescueStart?.ok,phase:window.APEX_ARSENAL?.state?.questRivetPreview?.phase}))()",
    v=>v?.ok===true&&['FLOOR_CHARGING','SETTLED'].includes(v.phase),100);
  gate('Q4H physical acknowledgment starts one genuine floor Stormbreaker',
    rig?.ok===true&&['FLOOR_CHARGING','SETTLED'].includes(rig.phase),rig);
  const struck=await evalPage("(()=>{const A=window.APEX_ARSENAL;let n=0;for(;n<550;n++){A.step(.05);if(window.__apexQuestStoryViewRead?.()?.active)break;}return {steps:n,scene:window.__apexQuestStoryViewRead?.()?.current,hit:A.state.questRivetPreview?.groundImpact,proof:window.__apexQuestReflexTechnicalRead?.(),node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,hp:(window.fighters||[]).map(x=>x.hp)}})()");
  gate('Q4H one physical floor manifestation/discharge is necessary, not a save trigger',
    struck?.scene==='E01_RIVET_SUPPRESSION_TECH'
    &&struck?.hit?.kind==='REAL_ARSENAL_FLOOR_SPAWN'
    &&struck?.proof?.ready===true&&struck?.node==='REFLEX'
    &&JSON.stringify(struck?.hp)===JSON.stringify(kCast?.hp),struck);
  await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
  const atWorkshop=await poll("(()=>({scene:window.__apexQuestStoryViewRead?.()?.current,node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId}))()",
    v=>v?.scene==='WORKSHOP_ARRIVAL',100);
  gate('Q4H WORKSHOP comic visible after grounded rescue, save still REFLEX',
    atWorkshop?.scene==='WORKSHOP_ARRIVAL'&&atWorkshop?.node==='REFLEX',atWorkshop);
  const deniedScene=await evalPage("(()=>window.APEX_QUEST01_DIRECTOR?.acceptNativeBeat('WORKSHOP_ARRIVAL'))()");
  gate('Q4H WORKSHOP cannot save while its required Story panel is open',
    deniedScene?.ok===false,deniedScene);
  await image('18-q4h-verified-workshop-pending-save');
  await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
  const saved=await poll("(()=>({checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint(),battleOpen:document.getElementById('battleHudHost')?.classList.contains('is-open'),stageOpen:document.getElementById('apexQuest01Stage')?.hidden===false,stage:document.getElementById('apexQuest01Stage')?.dataset.node}))()",
    v=>v?.checkpoint?.checkpointId==='WORKSHOP'&&v?.stageOpen===true&&v?.battleOpen===false,125);
  gate('Q4H physical WORKSHOP acknowledgement alone saves native REFLEX completion',
    saved?.checkpoint?.checkpointId==='WORKSHOP'
    &&saved?.checkpoint?.encounterId===null
    &&saved?.checkpoint?.completedCueIds?.length===8
    &&saved?.checkpoint?.completedCueIds?.[0]==='WAKE_OPEN'
    &&saved?.checkpoint?.completedCueIds?.at(-1)==='WORKSHOP_ARRIVAL'
    &&saved?.stage==='WORKSHOP'&&saved?.stageOpen===true
    &&saved?.battleOpen===false,saved);
  await image('19-q4h-real-workshop-saved');
  await reloadAndReattach();
  const reloaded=await poll("(()=>({id:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,cues:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.completedCueIds?.length,phase:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.phaseId,artifact:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.stormbreakerArtifactPhase}))()",
    v=>v?.id==='WORKSHOP',160);
  gate('Q4H real browser reload resumes signed WORKSHOP checkpoint, not a combat frame',
    reloaded?.id==='WORKSHOP'&&reloaded?.cues===8
    &&reloaded?.phase==='ENTRY'&&reloaded?.artifact==='SEALED',reloaded);
  }

  { // Q4I: real E02 2v2 outcome path, isolated from prior test locals.
  // Q4H deliberately reloaded the Gold document to verify persistent
  // WORKSHOP. Boot START is an actual re-entry door, not a removable
  // overlay: physically acknowledge it again before Continue Story.
  const returningBoot=await poll("(()=>({start:document.getElementById('apex-boot-start')?.getBoundingClientRect()?.width>0,checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,blackout:document.getElementById('apex-boot-blackout')?.hidden===true}))()",
    v=>v?.start===true&&v?.checkpoint==='WORKSHOP',320);
  gate('Q4I reload preserves WORKSHOP before new physical Gold boot',
    returningBoot?.start===true&&returningBoot?.checkpoint==='WORKSHOP',returningBoot);
  const returningStart=await click('#apex-boot-start');
  const returningHome=await poll("(()=>({done:document.body.dataset.apexSceneTransition==='DONE',blackout:document.getElementById('apex-boot-blackout')?.hidden===true,checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId}))()",
    v=>v?.done&&v?.blackout&&v?.checkpoint==='WORKSHOP',320);
  gate('Q4I physical boot START reopens Gold Home without resetting WORKSHOP',
    returningStart.hit&&returningHome?.done&&returningHome?.blackout
    &&returningHome?.checkpoint==='WORKSHOP',returningHome);
  // Gold's transition can report DONE while the input lease is still
  // finishing. Wait until that REAL lease releases before a trusted tap.
  const inputReady=await poll("(()=>({ready:window.APEX_SCENE_TRANSITION?.active?.()===false,done:document.body.dataset.apexSceneTransition==='DONE',blackout:document.getElementById('apex-boot-blackout')?.hidden===true}))()",
    v=>v?.ready&&v.done&&v.blackout,180);
  gate('Q4I entrance touch lease releases before Quest chapter action',
    inputReady?.ready===true,inputReady);
  // Assert boot START never falls through into a hidden Free Battle press.
  // This is actual Gold stage state, not a fabricated Quest routing event.
  const homeAfterBoot=await evalPage("(()=>({stageClass:document.getElementById('stage')?.className,mode:document.getElementById('stage')?.classList.contains('screen-mode')===true,fighter:document.getElementById('stage')?.classList.contains('screen-fighter')===true,ready:document.getElementById('stage')?.classList.contains('ready')===true}))()");
  gate('Q4I START pointer release cannot ghost-open Free Battle mode',
    homeAfterBoot?.ready&&homeAfterBoot.mode===false
      &&homeAfterBoot.fighter===false,homeAfterBoot);
    // Read-only capture-phase evidence of the real pointer event target.
  // Never preventDefault, redirect, .click() or invoke Quest functions.
  await evalPage("(()=>{window.__apexQuestHomeTapTrace=[];for(const kind of ['pointerdown','pointerup','click'])window.addEventListener(kind,e=>{const a=window.__apexQuestHomeTapTrace;if(a?.length<18)a.push({kind,id:e.target?.id||null,stage:document.getElementById('stage')?.className,ts:Math.round(performance.now())})},{capture:true});return true})()");
    const storyTap=await click('#continueStory');
  const stage=await poll("(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,exists:!!document.getElementById('q4iFirstWakePlay'),panel:document.getElementById('apexQuest01Stage')?.hidden===false,play:document.getElementById('q4iFirstWakePlay')?.hidden,opening:document.getElementById('q4hQuestPlay')?.hidden,transition:window.APEX_SCENE_TRANSITION?.active?.()===true,stageClass:document.getElementById('stage')?.className}))()",
    v=>v?.exists===true&&v.panel===true&&v.node==='WORKSHOP',160);
  gate('Q4I WORKSHOP exposes first real E02, not the retired REFLEX opening',
    storyTap.hit&&stage?.node==='WORKSHOP'&&stage?.exists===true
    &&stage?.panel===true&&stage?.play===false&&stage?.opening===true,
    {tap:storyTap,...stage,events:await evalPage("window.__apexQuestHomeTapTrace||[]")});
  if(!stage?.exists||stage?.panel!==true)
    throw new Error('Q4I Gold Home has not opened actual Quest Director: '+JSON.stringify(stage));
  const begin=await click('#q4iFirstWakePlay');
  let started=await poll("(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,active:window.APEX_ARSENAL?.state?.active,first:window.APEX_ARSENAL?.state?.questFirstWake,route:window.APEX_ARSENAL?.state?.questFirstWakeProgression,gold:window.__apexGoldBattleHosted===true,hud:document.getElementById('battleHudHost')?.classList.contains('is-open')===true,step:typeof window.APEX_ARSENAL?.step==='function',spawnReceipt:window.APEX_ARSENAL?.state?.questFirstWakeSpawnReceipt,roster:(window.fighters||[]).map(x=>({id:x.questId,team:x.questTeam,hp:x.hp}))}))()",
    v=>v?.node==='FIRST_WAKE'&&v?.route===true&&v?.active===true&&v.gold&&v.hud&&v.step,420);
  gate('Q4I Gold-owned entry authenticates actual HUD plus native 2v2',
    begin.hit&&started?.gold===true&&started?.hud===true&&started?.step===true
    &&started?.first===true&&started?.roster?.length===4
    &&started.roster.map(x=>x.id).join('|')==='NEWBOT|SCRAP-A|T.O.T|SCRAP-B'
    &&started.spawnReceipt?.map(x=>x.questId).join('|')==='NEWBOT|SCRAP-A|T.O.T|SCRAP-B'
    &&started.spawnReceipt.map(x=>x.hp).join('|')==='1000|350|1000|350'
    &&started.spawnReceipt.every((x,i)=>x.maxHp===x.hp
      &&started.roster[i].hp>=0&&started.roster[i].hp<=x.hp),started);
  if(!started?.step||!started?.hud)
    throw new Error('Q4I genuine Gold READY absent: '+JSON.stringify(started));
  const premature=await evalPage("(()=>window.APEX_QUEST01_DIRECTOR?.acceptNativeBeat('E02_FIRST_WAKE_CLEAR'))()");
  gate('Q4I cannot sign E02 win before real enemy KO or Story result',
    premature?.ok===false,premature);
  const organic=[];
  let complete=false;
  for(let turn=0;turn<5;turn++){
    const one=await evalPage("(()=>{const A=window.APEX_ARSENAL,Q=window.APEX_QUEST_MULTI_ACTOR_CORE;const f=window.fighters||[];let n=0;for(;n<7200;n++){A.step(.05);if(A.state.questOutcome||A.state.over)break;}return {frames:n,seconds:n*.05,outcome:A.state.questOutcome,over:A.state.over,canon:Q.firstWakeOutcome(f),actors:f.map(a=>({id:a.questId,team:a.questTeam,hp:a.hp,max:a.maxHp})),scene:A.state.questFirstWakeStoryView?.snapshot?.(),node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,winnerSide:A.state.winnerSide}})()");
    organic.push(one);
    if(one?.outcome==='COMPLETE'){
      gate('Q4I real 2v2 Arsenal outcome with both hostile KOs and living NEWBOT',
        one?.canon?.status==='COMPLETE'
        &&one?.over==='QUEST_FIRST_WAKE_COMPLETE'
        &&one?.actors?.filter(x=>x.team==='HOSTILE').length===2
        &&one.actors.filter(x=>x.team==='HOSTILE').every(x=>x.hp<=0)
        &&one.actors.find(x=>x.id==='NEWBOT')?.hp>0
        &&one?.scene?.active===true
        &&one?.scene?.current==='E02_FIRST_WAKE_CLEAR'
        &&one?.node==='FIRST_WAKE'&&one?.winnerSide==null,one);
      const deniedOpen=await evalPage("(()=>window.APEX_QUEST01_DIRECTOR?.acceptNativeBeat('E02_FIRST_WAKE_CLEAR'))()");
      gate('Q4I no E02 checkpoint save while winning Story frame is open',
        deniedOpen?.ok===false,deniedOpen);
      await image('20-q4i-first-wake-native-ko-result');
      await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
      const cleared=await poll("(()=>({checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint(),stage:document.getElementById('apexQuest01Stage')?.dataset.node,stageOpen:document.getElementById('apexQuest01Stage')?.hidden===false,battleOpen:document.getElementById('battleHudHost')?.classList.contains('is-open')}))()",
        v=>v?.checkpoint?.checkpointId==='SCRAP_SWARM'&&v?.stageOpen===true&&v?.battleOpen===false,160);
      gate('Q4I physical E02 victory acknowledgment saves SCRAP_SWARM, no match reward',
        cleared?.checkpoint?.checkpointId==='SCRAP_SWARM'
        &&cleared?.checkpoint?.encounterId==='E03'
        &&cleared?.checkpoint?.completedCueIds?.length===10
        &&cleared?.checkpoint?.completedCueIds?.at(-1)==='E02_FIRST_WAKE_CLEAR'
        &&cleared?.stage==='SCRAP_SWARM'&&cleared?.battleOpen===false,cleared);
      await image('21-q4i-scrap-swarm-checkpoint');
      complete=true;break;
    }
    if(one?.outcome!=='RETRY'||one?.scene?.current!=='E02_FIRST_WAKE_RETRY'
       ||one?.canon?.status!=='RETRY')break;
    gate('Q4I NEWBOT true KO offers retry without Story progression',
      one?.node==='FIRST_WAKE'
      &&one.actors.find(x=>x.id==='NEWBOT')?.hp<=0
      &&one?.scene?.active===true
      &&one?.over==='QUEST_FIRST_WAKE_RETRY',one);
    await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
    const again=await poll("(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,stage:document.getElementById('apexQuest01Stage')?.dataset.node,open:document.getElementById('apexQuest01Stage')?.hidden===false,battleOpen:document.getElementById('battleHudHost')?.classList.contains('is-open')===true,hosted:window.__apexGoldBattleHosted===true}))()",
      v=>v?.node==='FIRST_WAKE'&&v?.open===true&&v?.battleOpen===false&&v?.hosted===false,190);
    gate('Q4I retry waits for old Gold battle HUD to ACTUALLY close',
      again?.node==='FIRST_WAKE'&&again?.stage==='FIRST_WAKE'
      &&again?.battleOpen===false&&again?.hosted===false,again);
    await click('#q4iFirstWakePlay');
    started=await poll("(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,active:window.APEX_ARSENAL?.state?.active,route:window.APEX_ARSENAL?.state?.questFirstWakeProgression,over:window.APEX_ARSENAL?.state?.over,gold:window.__apexGoldBattleHosted===true,hud:document.getElementById('battleHudHost')?.classList.contains('is-open')===true,roster:(window.fighters||[]).map(x=>({id:x.questId,hp:x.hp}))}))()",
      v=>v?.active===true&&v?.route===true&&v.over==null
        &&v.gold===true&&v.hud===true&&v.roster?.length===4
        &&v.roster.map(x=>x.hp).join('|')==='1000|350|1000|350',350);
    gate('Q4I retry uses new fully-mounted Gold battle, never stale result',
      started?.active===true&&started?.gold===true&&started?.hud===true
      &&started?.over==null&&started?.roster?.length===4,started);
  }
  gate('Q4I at least one full natural two-vs-two match completed without synthetic HP',
    complete&&organic.length<=5,{complete,attempts:organic.map(x=>({frames:x?.frames,outcome:x?.outcome,node:x?.node,hp:x?.actors?.map(a=>a.hp)}))});
  if(complete){
    await reloadAndReattach();
    const restored=await poll("(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,cues:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.completedCueIds?.length}))()",
      x=>x?.node==='SCRAP_SWARM',160);
    gate('Q4I reload resumes real E03 checkpoint without replaying defeated E02',
      restored?.node==='SCRAP_SWARM'&&restored?.cues===10,restored);
    // Q5: navigate by physically using Gold; never sign a wave from a test
    // callback. Actual combat and actual NEWBOT defeat remain in Arsenal.
    const q5boot=await poll("(()=>({start:document.getElementById('apex-boot-start')?.getBoundingClientRect()?.width>0,node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId}))()",
      v=>v?.start&&v.node==='SCRAP_SWARM',320);
    gate('Q5 saved E03 has real Gold START gate',!!q5boot?.start,q5boot);
    await click('#apex-boot-start');
    const q5home=await poll("(()=>({done:document.body.dataset.apexSceneTransition==='DONE',hidden:document.getElementById('apex-boot-blackout')?.hidden===true}))()",
      v=>v?.done&&v.hidden,320);
    gate('Q5 physical START enters Gold Home',!!q5home?.done&&q5home.hidden,q5home);
    await click('#continueStory');
    const e03stage=await evalPage("(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,enabled:document.querySelector('#q5ScrapSwarmPlay')?.hidden===false}))()");
    gate('Q5 actual E03 visible in saved Director',e03stage?.enabled&&e03stage.node==='SCRAP_SWARM',e03stage);
    let completeE03=false;
    const attempts=[];
    for(let attempt=0;attempt<24;attempt++){
      await click('#q5ScrapSwarmPlay');
      const live=await poll("(()=>({gold:window.__apexGoldBattleHosted===true,open:document.getElementById('battleHudHost')?.classList.contains('is-open')===true,live:window.APEX_ARSENAL?.state?.questScrapSwarmProgression===true,wave:window.APEX_ARSENAL?.state?.questSwarmWave,actors:(window.fighters||[]).map(f=>({id:f.questId,hp:f.hp,max:f.maxHp,team:f.questTeam}))}))()",
        v=>v?.gold&&v.open&&v.live&&v.wave==='A',420);
      gate('Q5 authentic Gold-mounted E03 wave A entry '+attempt,
        live?.live&&live?.gold&&live?.open&&live?.actors?.length===4
        &&live.actors[0]?.id==='NEWBOT'&&live.actors.slice(1).every(a=>a.max===120),live);
      if(!live?.live||!live?.open){
        const diagnostics=await evalPage("(()=>({questReady:typeof window.__apexQuestScrapSwarmStoryStart,questCore:!!window.APEX_QUEST_MULTI_ACTOR_CORE,coreWave:window.APEX_QUEST_MULTI_ACTOR_CORE?.scrapSwarmRoster?.('A')?.length,shellType:window.APEX_ARSENAL_SHELLS?.typeFor?.('ROBOT')?.name,checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,goldHosted:window.__apexGoldBattleHosted===true,state:{active:window.APEX_ARSENAL?.state?.active,quest:window.APEX_ARSENAL?.state?.questScrapSwarmProgression},hud:document.getElementById('battleHudHost')?.className,stage:document.getElementById('apexQuest01Stage')?.hidden===false,body:document.body.className,errors:window.apexEarlyErrors?.slice?.(-6)}))()");
        gate('Q5 blocked Gold entry root-cause diagnostics',false,{diagnostics,console:browserConsole.slice(-22)});
        throw new Error('Q5 Gold-owned E03 boot failed');
      }
      if(attempt===0){
        const skip=await evalPage("(()=>window.APEX_QUEST01_DIRECTOR?.acceptNativeBeat('E03_SCRAP_SWARM_CLEAR'))()");
        gate('Q5 cannot skip either of two native waves',skip?.ok===false,skip);
      }
      const organic=await evalPage("(()=>{const A=window.APEX_ARSENAL, Q=window.APEX_QUEST_MULTI_ACTOR_CORE; const f=window.fighters; const n=f[0]; const W=A.weaponApi; let hAtWaveAEnd=null,slotsAtWaveAEnd=null,slotObjectsAtWaveAEnd=null; let steps=0;let first=null,seam=null;for(;steps<9600;steps++){if(steps%80===0){window.dispatchEvent(new KeyboardEvent('keydown',{key:'j',code:'KeyJ',bubbles:true}));}if(steps%200===0){window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',code:'KeyK',bubbles:true}));}A.step(.05);if(!first&&A.state.questSwarmPhase==='INTERLUDE'){hAtWaveAEnd=W.getHolder(n);slotsAtWaveAEnd=A.state.slots;slotObjectsAtWaveAEnd=A.state.slots.slice();first={wave:A.state.questSwarmWave,receipt:A.state.questSwarmWaveAReceipt,actors:f.map(a=>({id:a.questId,hp:a.hp})),player:n.hp,phase:A.state.questSwarmPhase,slotsCount:slotsAtWaveAEnd.length};}if(first&&!seam&&A.state.questSwarmWave==='B'){seam={playerSame:f[0]===n,hpAfter:n.hp,slotsSame:slotsAtWaveAEnd===A.state.slots&&slotObjectsAtWaveAEnd.every((slot,i)=>A.state.slots[i]===slot),holderSame:W.getHolder(n)===hAtWaveAEnd,roster:Q.validateScrapSwarmWave(f,'B'),receipt:A.state.questSwarmWaveAReceipt};}if(A.state.over)break;}return{steps,outcome:A.state.questOutcome,over:A.state.over,wave:A.state.questSwarmWave,phase:A.state.questSwarmPhase,first,seam,actors:f.map(a=>({id:a.questId,hp:a.hp,max:a.maxHp,team:a.questTeam})),view:A.state.questSwarmStoryView?.snapshot?.(),checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId}})()");
      attempts.push(organic);
      if(organic?.first)gate('Q5 real three-hostile KO launches interlude '+attempt,
        organic.first.wave==='A'&&organic.first.receipt?.length===3
        &&organic.first.receipt.every(f=>f.hp<=0),organic.first);
      if(organic?.seam)gate('Q5 wave B retains same NEWBOT, slots and holder object '+attempt,
        organic.seam.playerSame&&organic.seam.slotsSame&&organic.seam.holderSame
        &&organic.seam.roster?.ok===true
        &&organic.seam.receipt?.length===3,organic.seam);
      if(organic?.outcome==='COMPLETE'){
        gate('Q5 four REAL wave B KOs and living NEWBOT author result',
          organic?.wave==='B'&&organic?.seam?.roster?.ok===true
          &&organic?.first?.receipt?.length===3
          &&organic.actors[0]?.hp>0
          &&organic.actors.filter(a=>a.team==='HOSTILE').length===4
          &&organic.actors.filter(a=>a.team==='HOSTILE').every(a=>a.hp<=0)
          &&organic?.view?.active===true
          &&organic.view.current==='E03_SCRAP_SWARM_CLEAR'
          &&organic?.checkpoint==='SCRAP_SWARM',organic);
        const early=await evalPage("(()=>window.APEX_QUEST01_DIRECTOR?.acceptNativeBeat('E03_SCRAP_SWARM_CLEAR'))()");
        gate('Q5 win cannot save until its real result is acknowledged',
          early?.ok===false,early);
        await image('22-q5-e03-native-victory');
        await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
        const saved=await poll("(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,stage:document.getElementById('apexQuest01Stage')?.dataset.node,open:document.getElementById('apexQuest01Stage')?.hidden===false,battleOpen:document.getElementById('battleHudHost')?.classList.contains('is-open')}))()",
          v=>v?.node==='WEAPON_RAIN'&&v?.open&&v?.battleOpen===false,170);
        gate('Q5 real acknowledged result closes Gold and saves E04 WEAPON_RAIN',
          saved?.node==='WEAPON_RAIN'&&saved?.stage==='WEAPON_RAIN'
          &&saved?.battleOpen===false,saved);
        completeE03=true;break;
      }
      gate('Q5 natural NEWBOT defeat retries without chapter skip '+attempt,
        organic?.outcome==='RETRY'
        &&organic?.view?.active===true
        &&organic?.view?.current==='E03_SCRAP_SWARM_RETRY'
        &&organic?.checkpoint==='SCRAP_SWARM',organic);
      if(organic?.outcome!=='RETRY')break;
      await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
      const back=await poll("(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,open:document.getElementById('apexQuest01Stage')?.hidden===false,battleOpen:document.getElementById('battleHudHost')?.classList.contains('is-open')}))()",
        v=>v?.node==='SCRAP_SWARM'&&v.open&&v.battleOpen===false,150);
      gate('Q5 retry retains E03 checkpoint and closes Gold battle',back?.open&&back.node==='SCRAP_SWARM'&&back.battleOpen===false,back);
    }
    gate('Q5 true physical combat and J/K inputs win within 24 bounded natural seeds',
      completeE03,{complete:completeE03,attempts:attempts.map(o=>({steps:o?.steps,outcome:o?.outcome,first:!!o?.first,seam:!!o?.seam,hp:o?.actors?.map(x=>x.hp)}))});
    if(completeE03){
      await reloadAndReattach();
      const restoredE04=await poll("(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,cues:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.completedCueIds?.length}))()",
        v=>v?.node==='WEAPON_RAIN',160);
      gate('Q5 real reload restores E04 and exactly 11 authored cue IDs',
        restoredE04?.node==='WEAPON_RAIN'&&restoredE04.cues===11,restoredE04);

      // Q5p E04 — replayed physically from the SAVED E03 victory. The
      // Director never receives an injected test-only checkpoint.
      const e04start=await poll("(()=>({enabled:document.getElementById('apex-boot-start')?.getBoundingClientRect()?.width>0,checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId}))()",
        x=>x?.enabled&&x?.checkpoint==='WEAPON_RAIN',300);
      gate('E04 starts after genuine reload at WEAPON_RAIN',e04start?.enabled===true,e04start);
      await click('#apex-boot-start');
      await poll("(()=>document.body.dataset.apexSceneTransition==='DONE'&&document.getElementById('apex-boot-blackout')?.hidden===true)()",Boolean,300);
      await click('#continueStory');
      const stageE04=await evalPage("(()=>({id:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,play:document.getElementById('q5WeaponRainPlay')?.hidden===false}))()");
      gate('E04 saved chapter physically exposes Gold weapon rain',stageE04?.id==='WEAPON_RAIN'&&stageE04.play,stageE04);
      await image('23-e04-gold-chapter-opening');
      const attemptsE04=[];
      let clearE04=false;
      for(let trial=0;trial<12;trial++){
        await click('#q5WeaponRainPlay');
        const live=await poll("(()=>({gold:window.__apexGoldBattleHosted===true,hud:document.getElementById('battleHudHost')?.classList.contains('is-open')===true,active:window.APEX_ARSENAL?.state?.questWeaponRainProgression===true,roster:(window.fighters||[]).map(x=>({id:x.questId,maxHp:x.maxHp,hp:x.hp}))}))()",
          x=>x?.gold&&x?.hud&&x?.active,420);
        gate('E04 physical Gold weapon-rain battle ready '+trial,
          live?.gold&&live?.hud&&live?.active
          &&live?.roster?.map(x=>x.id).join('|')==='NEWBOT|RAIN-A|RAIN-B'
          &&live.roster.map(x=>x.maxHp).join('|')==='1000|180|160',live);
        if(!live?.active||!live?.hud)throw Error('E04 Gold true battle not live');
        if(trial===0){
          const denied=await evalPage("(()=>window.APEX_QUEST01_DIRECTOR?.acceptNativeBeat('E04_WEAPON_RAIN_CLEAR'))()");
          gate('E04 cannot claim win before authentic KO and final rain',denied?.ok===false,denied);
        }
        const one=await evalPage("(()=>{const A=window.APEX_ARSENAL,Q=window.APEX_QUEST_MULTI_ACTOR_CORE;let n=0,maxOffensive=0,gunFrames=0;let phases=[];let last='';const hero=window.fighters.find(x=>x.questId==='NEWBOT');for(;n<7800;n++){if(n%80===0)window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyJ',key:'j',bubbles:true}));if(n%200===0)window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyK',key:'k',bubbles:true}));A.step(.05);if(A.weaponApi.getHolder(hero))gunFrames++;const snap=A.state.questRainSequence?.snapshot?.();if(snap?.phase!==last){last=snap?.phase;phases.push({phase:last,time:A.state.time,attempted:snap?.attempted,accepted:snap?.accepted,rejected:snap?.rejected});}maxOffensive=Math.max(maxOffensive,(A.state.slots||[]).filter(x=>x.kind!=='HEAL'&&x.phase!=='REMOVED').length);if(A.state.over)break;}return{n,maxOffensive,gunUptimePct:Math.round(gunFrames/Math.max(1,n+1)*100),phases,rain:A.state.questRainSequence?.snapshot?.(),outcome:A.state.questOutcome,over:A.state.over,canonical:Q.weaponRainOutcome(window.fighters,A.state.questRainSequence?.snapshot?.()?.observed===true),roster:(window.fighters||[]).map(x=>({id:x.questId,team:x.questTeam,hp:x.hp,maxHp:x.maxHp})),view:A.state.questRainStoryView?.snapshot?.(),checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId}})()");
        attemptsE04.push(one);
        gate('E04 never exceeds five real offensive floor slots '+trial,one?.maxOffensive<=5,one?.maxOffensive);
        if(one?.outcome==='COMPLETE'){
          gate('E04 authentic two-hostile KO PLUS witnessed three-cap burst',
            one?.canonical?.status==='COMPLETE'
            &&one?.rain?.observed===true&&one.rain.attempted===3
            &&one.rain.accepted+one.rain.rejected===3
            &&one.roster?.filter(x=>x.team==='HOSTILE').length===2
            &&one.roster.filter(x=>x.team==='HOSTILE').every(x=>x.hp<=0)
            &&one.roster[0]?.hp>0
            &&one.view?.active===true
            &&one.view?.current==='E04_WEAPON_RAIN_CLEAR'
            &&one.checkpoint==='WEAPON_RAIN',one);
          const early=await evalPage("(()=>window.APEX_QUEST01_DIRECTOR?.acceptNativeBeat('E04_WEAPON_RAIN_CLEAR'))()");
          gate('E04 visible result cannot sign Director prematurely',early?.ok===false,early);
          await image('24-e04-native-two-ko-result');
          await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
          const saved=await poll("(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,chapter:document.getElementById('apexQuest01Stage')?.dataset.node,chapterVisible:document.getElementById('apexQuest01Stage')?.hidden===false,hudOpen:document.getElementById('battleHudHost')?.classList.contains('is-open')}))()",
            x=>x?.node==='CHARGE_THE_BREAKER'&&x.chapterVisible&&x.hudOpen===false,170);
          gate('E04 actual result acknowledgement closes Gold and saves E05',
            saved?.node==='CHARGE_THE_BREAKER'
            &&saved?.chapter==='CHARGE_THE_BREAKER'
            &&saved?.hudOpen===false,saved);
          clearE04=true;
          await image('25-e04-charge-the-breaker-checkpoint');
          break;
        }
        gate('E04 NEWBOT physical KO requires retry rather than checkpoint skip '+trial,
          one?.outcome==='RETRY'
          &&one?.view?.current==='E04_WEAPON_RAIN_RETRY'
          &&one?.view?.active===true
          &&one?.checkpoint==='WEAPON_RAIN',one);
        if(one?.outcome!=='RETRY')break;
        await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
        const ready=await poll("(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,stage:document.getElementById('apexQuest01Stage')?.hidden===false,closed:document.getElementById('battleHudHost')?.classList.contains('is-open')===false}))()",
          x=>x?.node==='WEAPON_RAIN'&&x?.stage&&x?.closed,170);
        gate('E04 retry fully closes Gold and returns saved chapter',ready?.node==='WEAPON_RAIN'&&ready.closed,ready);
      }
      gate('E04 at least one honest full Chrome victory without HP injection',
        clearE04,{victory:clearE04,attempts:attemptsE04.map(x=>({steps:x?.n,result:x?.outcome,phases:x?.phases,max:x?.maxOffensive,gunUptime:x?.gunUptimePct,hp:x?.roster?.map(y=>y.hp)}))});
      if(clearE04){
        await reloadAndReattach();
        const restoredE05=await poll("(()=>({node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,cues:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.completedCueIds?.length}))()",
          x=>x?.node==='CHARGE_THE_BREAKER',180);
        gate('E04 reload retains real E05 without replaying two defeated hostiles',
          restoredE05?.node==='CHARGE_THE_BREAKER'&&restoredE05.cues===12,restoredE05);
        const ready=await poll("(()=>({boot:document.getElementById('apex-boot-start')?.getBoundingClientRect()?.width>0,node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId}))()",
          x=>x?.boot&&x.node==='CHARGE_THE_BREAKER',300);
        gate('E05 saved Gold boot is legitimate after E04',ready?.boot===true,ready);
        await click('#apex-boot-start');
        await poll("(()=>document.body.dataset.apexSceneTransition==='DONE'&&document.getElementById('apex-boot-blackout')?.hidden===true)()",Boolean,300);
        await click('#continueStory');
        const chapter=await evalPage("(()=>({id:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,button:document.getElementById('q5BreakerChargePlay')?.hidden===false}))()");
        gate('E05 saved Director exposes physical impact accumulator',chapter?.id==='CHARGE_THE_BREAKER'&&chapter.button,chapter);
        await image('26-e05-charge-chapter');
        await click('#q5BreakerChargePlay');
        const real=await poll("(()=>({gold:window.__apexGoldBattleHosted===true,hud:document.getElementById('battleHudHost')?.classList.contains('is-open')===true,active:window.APEX_ARSENAL?.state?.questBreakerChargeProgression===true,actors:(window.fighters||[]).map(f=>({id:f.questId,team:f.questTeam,hp:f.hp,max:f.maxHp,world:f.questWorldObject}))}))()",
          x=>x?.gold&&x.hud&&x.active,420);
        gate('E05 real Gold/Arsenal world collider 1000 vs inert 6000',
          real?.gold===true&&real?.hud===true&&real?.active===true
          &&real.actors?.[0]?.id==='NEWBOT'&&real.actors?.[0]?.max===1000
          &&real.actors?.[1]?.id==='BREAKER-CORE'&&real.actors?.[1]?.max===6000
          &&real.actors?.[1]?.world===true&&real.actors?.[1]?.team==='TARGET',real);
        const tooEarly=await evalPage("(()=>window.APEX_QUEST01_DIRECTOR?.acceptNativeBeat('E05_BREAKER_CHARGE_CLEAR'))()");
        gate('E05 cannot skip 6000 actual weapon damage or relay',tooEarly?.ok===false,tooEarly);
        const actual=await evalPage("(()=>{const A=window.APEX_ARSENAL,Q=window.APEX_QUEST_MULTI_ACTOR_CORE,W=A.weaponApi,f=window.fighters,hero=f[0],target=f[1];let organicSteps=0,organicHits=0;const hp0=target.hp;let last=hp0,maxSlots=0;for(;organicSteps<18000&&target.hp>0;organicSteps++){if(organicSteps%80===0)window.dispatchEvent(new KeyboardEvent('keydown',{key:'j',code:'KeyJ',bubbles:true}));if(organicSteps%200===0)window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',code:'KeyK',bubbles:true}));A.step(.05);maxSlots=Math.max(maxSlots,A.state.slots.filter(s=>s.kind!=='HEAL'&&s.phase!=='REMOVED').length);if(target.hp<last)organicHits++;last=target.hp;if(A.state.over)break;}const organicDmg=hp0-target.hp;let assistedShots=0,assistedHits=0;while(target.hp>0&&assistedShots++<180){const before=target.hp;const p={x:target.x-400,y:target.y,angle:0,speed:2400,damage:15,owner:hero,weapon:'PISTOL'};W.fireBullet(p);for(let i=0;i<13;i++)A.step(.04);if(target.hp<before)assistedHits++;}let pulseSteps=0;while(!A.state.over&&pulseSteps++<500)A.step(.05);const pulse=A.state.questBreakerSequence?.snapshot?.();return{organicSteps,organicDmg,organicHits,assistedShots,assistedHits,pulseSteps,maxSlots,charge:Q.breakerChargeProgress(f),outcome:Q.breakerChargeOutcome(f,pulse?.pulseObserved),pulse,stateOutcome:A.state.questOutcome,over:A.state.over,view:A.state.questBreakerStoryView?.snapshot?.(),heroHp:hero.hp,targetHp:target.hp,checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId}})()");
        gate('E05 native simulation never permits >5 offensive slots',actual?.maxSlots<=5,actual?.maxSlots);
        gate('E05 accepts 6000 actual damage from existing combat physics, not HP setter',
          actual?.targetHp===0&&actual?.charge===1
          &&actual?.outcome?.status==='COMPLETE'
          &&actual?.pulse?.requested===3
          &&actual.pulse.accepted+actual.pulse.suppressed===3
          &&actual?.pulse?.pulseObserved===true
          &&actual?.stateOutcome==='COMPLETE'
          &&actual?.over==='QUEST_BREAKER_CHARGE_COMPLETE'
          &&actual?.view?.current==='E05_BREAKER_CHARGE_CLEAR'
          &&actual?.view?.active===true
          &&actual?.checkpoint==='CHARGE_THE_BREAKER',actual);
        const denied=await evalPage("(()=>window.APEX_QUEST01_DIRECTOR?.acceptNativeBeat('E05_BREAKER_CHARGE_CLEAR'))()");
        gate('E05 cannot save before result presentation acknowledgment',denied?.ok===false,denied);
        await image('27-e05-authentic-infrastructure-pulse-result');
        await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
        const saved=await poll("(()=>({id:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,stage:document.getElementById('apexQuest01Stage')?.dataset.node,open:document.getElementById('apexQuest01Stage')?.hidden===false,goldClosed:document.getElementById('battleHudHost')?.classList.contains('is-open')===false}))()",
          x=>x?.id==='BREACH_WAVES'&&x?.open&&x?.goldClosed,180);
        gate('E05 real acknowledged 6000 charge closes Gold and saves BREACH_WAVES',
          saved?.id==='BREACH_WAVES'&&saved?.stage==='BREACH_WAVES'
          &&saved?.goldClosed===true,saved);
        await image('28-e05-breach-checkpoint');
        await reloadAndReattach();
        const restored=await poll("(()=>({id:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,cues:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.completedCueIds?.length}))()",
          x=>x?.id==='BREACH_WAVES',180);
        gate('E05 persistent native checkpoint has 13 signed cues after reload',
          restored?.id==='BREACH_WAVES'&&restored.cues===13,restored);
        // B6j: continue through the REAL Gold chapter interface into E06.
        // Do not synthesize E06 victory, boss unlock, HP, or approval of kits.
        if(process.argv.includes('--verify-breach-entry')){
          const booted=await poll("(()=>({start:document.getElementById('apex-boot-start')?.getBoundingClientRect()?.width>0,node:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId}))()",
            x=>x?.start&&x.node==='BREACH_WAVES',300);
          gate('B6j physical Gold boot retains signed E06 checkpoint',booted?.start===true,booted);
          await click('#apex-boot-start');
          await poll("(()=>document.body.dataset.apexSceneTransition==='DONE'&&document.getElementById('apex-boot-blackout')?.hidden===true)()",Boolean,300);
          await click('#continueStory');
          const chapter=await poll("(()=>({id:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId,button:document.getElementById('q6BreachPlay')?.hidden===false,stage:document.getElementById('apexQuest01Stage')?.dataset.node}))()",
            x=>x?.id==='BREACH_WAVES'&&x?.button&&x?.stage==='BREACH_WAVES',150);
          gate('B6j E06 reachable through real Gold Quest stage button',
            chapter?.id==='BREACH_WAVES'&&chapter?.button&&chapter?.stage==='BREACH_WAVES',chapter);
          await image('29-e06-real-checkpoint-stage');
          const early=await evalPage("(()=>window.APEX_QUEST01_DIRECTOR?.acceptNativeBeat('E06_BREACH_CLEAR'))()");
          gate('B6j no E07 advancement by unsupported early E06 story beat',
            early?.ok===false,early);
          await click('#q6BreachPlay');
          const battle=await poll("(()=>({gold:window.__apexGoldBattleHosted===true,hud:document.getElementById('battleHudHost')?.classList.contains('is-open')===true,active:window.APEX_ARSENAL?.state?.questBreachProgression===true,roster:(window.fighters||[]).map(f=>({id:f.questId,team:f.questTeam,hp:f.hp,max:f.maxHp,kind:f.questSpecies,withdrawn:f.withdrawn===true})),wave:window.APEX_ARSENAL?.state?.questBreachLifecycle?.snapshot?.(),story:window.APEX_ARSENAL?.state?.questBreachStoryView?.snapshot?.()}))()",
            x=>x?.gold&&x?.hud&&x?.active&&x?.roster?.length===6,450);
          const allies=battle?.roster?.filter(f=>f.team==='ALLY')||[];
          const foes=battle?.roster?.filter(f=>f.team==='HOSTILE')||[];
          gate('B6j Gold mounted native 3 allies and exactly 3 real LV1 Scouts',
            battle?.gold&&battle?.hud&&battle?.active
            &&allies.map(a=>a.id).join('|')==='NEWBOT|T.O.T|RIVET'
            &&allies.every(a=>a.hp===1000&&!a.withdrawn)
            &&foes.length===3&&foes.every(f=>f.kind==='scout'&&f.hp===300)
            &&battle?.wave?.wave==='A'&&battle?.wave?.phase==='ACTIVE',
            {roster:battle?.roster,wave:battle?.wave});
          gate('B6j RIVET rig-lock story blocks the genuine simulation on entry',
            battle?.story?.active===true&&battle?.story?.current==='E06_RIG_LOCK',battle?.story);
          const paused=await evalPage("(()=>{const A=window.APEX_ARSENAL,t=A.state.time,h=window.fighters.map(f=>f.hp);A.step(.2);return{sameClock:A.state.time===t,sameHp:h.every((x,i)=>window.fighters[i].hp===x)}})()");
          gate('B6j cinematic intro cannot leak combat time or damage',
            paused?.sameClock===true&&paused?.sameHp===true,paused);
          await image('30-e06-rig-lock-real-gold');
          await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
          const live=await poll("(()=>({active:window.APEX_ARSENAL?.state?.questBreachProgression===true,story:window.APEX_ARSENAL?.state?.questBreachStoryView?.active?.()===true,phase:window.APEX_ARSENAL?.state?.questBreachLifecycle?.snapshot?.().phase}))()",
            x=>x?.active&&!x?.story&&x?.phase==='ACTIVE',80);
          const progressed=await evalPage("(()=>{const A=window.APEX_ARSENAL,t=A.state.time;A.step(.05);return{advanced:A.state.time>t,wave:A.state.questBreachLifecycle.snapshot().wave,cap:A.state.slots.filter(s=>s.kind!=='HEAL'&&s.phase!=='REMOVED').length,checkpoint:window.APEX_QUEST01_DIRECTOR.checkpoint().checkpointId}})()");
          gate('B6j true Arena engine resumes wave A and respects pickup cap',
            live?.active&&live?.phase==='ACTIVE'&&progressed?.advanced
            &&progressed?.wave==='A'&&progressed?.cap<=5,progressed);
          gate('B6j no fake E06 completion or E07 save on first frame',
            progressed?.checkpoint==='BREACH_WAVES',progressed);
          await image('31-e06-native-wave-a-gold');
          if(process.argv.includes('--verify-breach-three-waves')){
            // B6n ENGINE-INSTRUMENTED skill integration test:
            // the slot is born through real SPAWN.trySpawnSlot, then moved and
            // revealed for CI determinism. Real Arsenal.resolvePickups/equip
            // and Gold pressSkill own the actual holder transaction.
            const skills=await evalPage("(()=>{const A=window.APEX_ARSENAL,S=window.APEX_ARSENAL_SPAWN,G=window.APEX_GOLD,W=A.weaponApi,Q=A.state.questBreachCompanionSkills,roster=window.fighters,[n,t,r]=roster;const start={nWithdrawn:n.withdrawn,tWithdrawn:t.withdrawn,tx:t.x,ty:t.y};if(!Q||!S||!G||!W)return{ok:false,reason:'missing-native-entry'};n.withdrawn=true;A.state.slots=[];t.x=320;t.y=480;if(W.getHolder(t))W.consume(t,'b6n-probe-clear');const recipient=Q.currentRecipient();G.pressSkill(0,1,{source:'B6N_CHROME'});const primed=Q.snapshot().tot.phase;const slot=S.trySpawnSlot({forceFirearm:true});if(!slot)return{ok:false,reason:'native-slot-unavailable'};slot.phase='REVEALED';slot.weaponId='PISTOL';slot.kind='GUN';slot.x=t.x;slot.y=t.y;S.resolvePickups();const stored=Q.snapshot().tot,unarmed=W.getHolder(t)===null,slotRemoved=slot.phase==='REMOVED';G.pressSkill(0,1,{source:'B6N_CHROME'});const drawn=W.getHolder(t),after=Q.snapshot().tot;const sameGun=drawn?.weaponId==='PISTOL'&&drawn.shotsFired===0;const cooldown=after.kCooldown;W.consume(t,'b6n-probe-finished');t.x=start.tx;t.y=start.ty;n.withdrawn=true;t.withdrawn=true;const rivetOwner=Q.currentRecipient();G.pressSkill(0,1,{source:'B6N_CHROME'});const nativeArmor=Q.mitigate(r,100);n.withdrawn=start.nWithdrawn;t.withdrawn=start.tWithdrawn;A.state.slots=[];return{ok:true,recipient,primed,stored:stored.phase,storedGun:stored.storedWeapon,unarmed,slotRemoved,sameGun,after:after.phase,cooldown,rivetOwner,nativeArmor,survived:roster.slice(0,3).every(f=>f.hp>0),realSlotId:slot.id}})()");
            gate('B6n Gold touch K primes native T.O.T and stores true Arsenal floor gun',
              skills?.ok&&skills?.recipient==='T.O.T'&&skills?.primed==='CAPTURE'
              &&skills?.stored==='STORED'&&skills?.storedGun==='PISTOL'
              &&skills?.unarmed&&skills?.slotRemoved&&Number.isInteger(skills?.realSlotId),skills);
            gate('B6n Gold second K retrieves real pistol without firing or duplication',
              skills?.sameGun&&skills?.after==='READY'&&skills?.cooldown>0,skills);
            gate('B6n Gold touch priority activates original-stat RIVET armor when two withdrew',
              skills?.rivetOwner==='RIVET'&&Math.abs(skills?.nativeArmor-45)<1e-5
              &&skills?.survived,skills);
            await image('31b-e06-real-companion-skill-handoff');
            const intercept=await evalPage("(()=>{const A=window.APEX_ARSENAL,G=window.APEX_GOLD,Q=A.state.questBreachCompanionSkills;const [n,t,r,e]=window.fighters;const saved={nw:n.withdrawn,tw:t.withdrawn,rx:r.x,ry:r.y,ex:e.x,ey:e.y};n.withdrawn=t.withdrawn=true;r.x=400;r.y=500;e.x=750;e.y=500;G.pressSkill(0,0,{source:'B6N_CHROME_INTERCEPT'});const planted=Q.snapshot().rivet.phase;A.step(.025);const early=e.hasStatus('stun');e.x=490;e.y=500;A.step(.025);const hit=e.hasStatus('stun');const clamped=Q.snapshot().rivet.phase;const event=Q.snapshot().events.some(x=>x.kind==='PHYSICAL_INTERCEPT'&&x.victim===e.questId);if(e.statuses?.stun)e.statuses.stun.timer=0;n.withdrawn=saved.nw;t.withdrawn=saved.tw;r.x=saved.rx;r.y=saved.ry;e.x=saved.ex;e.y=saved.ey;return{planted,early,hit,clamped,event,live:A.state.active,save:window.APEX_QUEST01_DIRECTOR?.checkpoint?.()?.checkpointId}})()");
            gate('B6n real Rivet J waits for native enemy body to physically enter trap',
              intercept?.planted==='WAITING'&&!intercept?.early&&intercept?.hit
              &&intercept?.clamped==='CLAMPED'&&intercept?.event
              &&intercept?.live&&intercept?.save==='BREACH_WAVES',intercept);
            await image('31c-e06-real-rivet-interceptor');
          }
          if(process.argv.includes('--verify-breach-three-waves')){
            // ENGINE-INSTRUMENTED acceptance: projectiles and HP/KO authority
            // are real. Fighter positions are controlled to make CI reliable.
            // This is NOT a substitute for an unassisted owner balance test.
            const three=await evalPage("(()=>{const A=window.APEX_ARSENAL,W=A.weaponApi,roster=window.fighters,allies=roster.slice(0,3),hero=allies[0],data=[],shots=[];A.state.spawnHeld=true;A.state.spawnTimer=1e6;A.state.slots=[];const neutralize=()=>{for(let i=0;i<roster.length;i++){const f=roster[i];f.baseSpeed=0;f.data.__hrHoldBody=true;if(i<3){f.x=120;f.y=730+i*64}else{f.x=930;f.y=840;}}hero.x=145;hero.y=500;};const take=wave=>{const targets=roster.filter(f=>f.questTeam==='HOSTILE');for(const target of targets){neutralize();target.x=660;target.y=500;let fired=0,hits=0;while(target.hp>0&&fired++<50){const hp=target.hp;W.fireBullet({owner:hero,x:250,y:500,angle:0,speed:2800,damage:20,weapon:'PISTOL'});for(let k=0;k<9;k++)A.step(.025);if(target.hp<hp)hits++;}shots.push({wave,id:target.questId,hp:target.hp,maxHp:target.maxHp,fired,hits});}const snap=A.state.questBreachLifecycle.snapshot();data.push({wave,phase:snap.phase,complete:snap.completed,allies:allies.map(a=>({id:a.questId,hp:a.hp,withdrawn:a.withdrawn===true})),sameAllies:allies.every((a,i)=>roster[i]===a),actors:roster.length,slots:A.state.slots.filter(s=>s.kind!=='HEAL'&&s.phase!=='REMOVED').length});return snap;};neutralize();const A0=take('A');let B=false,C=false;for(let i=0;i<70;i++){A.step(.05);if(A.state.questBreachLifecycle.snapshot().wave==='B'){B=true;break;}}if(B){neutralize();take('B');}for(let i=0;i<70;i++){A.step(.05);if(A.state.questBreachLifecycle.snapshot().wave==='C'){C=true;break;}}if(C){neutralize();take('C');}const last=A.state.questBreachLifecycle.snapshot();return{advancedB:B,advancedC:C,shots,data,snapshot:last,outcome:A.state.questOutcome,over:A.state.over,scene:A.state.questBreachStoryView?.snapshot?.(),saved:window.APEX_QUEST01_DIRECTOR?.checkpoint?.()?.checkpointId};})()");
            gate('B6k Gold keeps ALL three ally Fighter identities through 3 authentic wave KO transactions',
              three?.advancedB&&three?.advancedC
              &&three?.data?.length===3
              &&three.data.every(d=>d.sameAllies&&d.allies.length===3)
              &&three.data.map(d=>d.actors).join('|')==='6|7|6',
              {waves:three?.data,advancedB:three?.advancedB,advancedC:three?.advancedC});
            gate('B6k ten real Arsenal projectile KOs yield three immutable wave receipts',
              three?.shots?.length===10&&three.shots.every(x=>x.hp===0&&x.hits>0)
              &&three?.snapshot?.phase==='COMPLETE'&&three?.snapshot?.completed===3
              &&three?.snapshot?.receipts?.length===3, 
              {shots:three?.shots,phase:three?.snapshot?.phase,receipts:three?.snapshot?.receipts});
            gate('B6k only earned final wave opens real story, no premature E07 checkpoint',
              three?.outcome==='COMPLETE'&&three?.over==='QUEST_BREACH_WAVES_COMPLETE'
              &&three?.scene?.active===true&&three?.scene?.current==='E06_BREACH_CLEAR'
              &&three?.saved==='BREACH_WAVES',
              {outcome:three?.outcome,over:three?.over,story:three?.scene,saved:three?.saved});
            await image('32-e06-real-ten-KO-result');
            const downstream=[
              'E06_RELAY_REPLY','E06_NETWORK_SCAN',
              'E06_RIG_RETURN','E06_OVERRIDE_BUILDUP'
            ];
            for(const cue of downstream){
              await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
              const actual=await poll("(()=>({current:window.APEX_ARSENAL?.state?.questBreachStoryView?.snapshot?.().current,save:window.APEX_QUEST01_DIRECTOR?.checkpoint?.()?.checkpointId,rig:window.APEX_ARSENAL?.state?.questBreachRig?.snapshot?.().phase}))()",
                x=>x?.current===cue&&x?.save==='BREACH_WAVES',120);
              gate('B6l canonical post-wave beat '+cue+' has no premature E07 save',
                actual?.current===cue&&actual?.save==='BREACH_WAVES',actual);
            }
            const beforeFinal=await evalPage("(()=>({phase:window.APEX_ARSENAL?.state?.questBreachRig?.snapshot?.().phase,stage:window.APEX_QUEST01_DIRECTOR?.checkpoint?.()?.checkpointId}))()");
            gate('B6l RIVET return is not prematurely certified as E07',
              beforeFinal?.phase==='RIVET_RETURNED'&&beforeFinal?.stage==='BREACH_WAVES',beforeFinal);
            await click('#apexQuestStoryView .qs-controls button:not(.qs-skip)');
            const done=await poll("(()=>({stage:window.APEX_QUEST01_DIRECTOR?.checkpoint?.()?.checkpointId,open:document.getElementById('apexQuest01Stage')?.hidden===false,hudClosed:document.getElementById('battleHudHost')?.classList.contains('is-open')===false}))()",
              x=>x?.stage==='BREACH_WAVES'&&x?.open&&x?.hudClosed,180);
            gate('B6k final cinematic acknowledgment closes old Gold surface without fabricating E07 progress',
              done?.stage==='BREACH_WAVES'&&done?.open&&done?.hudClosed,done);
            await image('33-e06-preview-back-to-chapter');
            await reloadAndReattach();
            const retained=await poll("(()=>window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId)()",
              x=>x==='BREACH_WAVES',180);
            gate('B6k reload preserves legitimately signed E06 checkpoint after preview',retained==='BREACH_WAVES',retained);
          }

        }
      }
    }
  }
  }


}catch(err){
  gate('Browser route execution',false,{error:String(err.stack||err)});
}finally{
  await writeFile(path.join(evidenceDir,'quest-q1-director-browser-report'+(isMobile?'-mobile':'')+'.json'),JSON.stringify({gates,failures},null,2));
  try{socket?.close();}catch(_){}
  chrome?.kill();
}
if(failures.length)process.exitCode=1;
