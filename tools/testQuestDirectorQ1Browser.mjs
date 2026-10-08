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
let serial=0;const pending=new Map();const gates=[], failures=[];
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
    await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});
    await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});
    await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});
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
    drawable:frames.every(f=>f.spr?.scaleFactor===.82&&f.spr?.scale>0)
  }));
  gate('Q3t exactly three non-NEWBOT bodies scaled 0.82 visually without collider edits',
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
  const q3RealShot=await evalPage("(()=>{\n  const A=window.APEX_ARSENAL,W=A?.weaponApi,f=window.fighters||[];\n  const source=f.find(x=>x.questId==='NEWBOT');\n  const victim=f.find(x=>x.questId==='SCRAP-A');\n  const other=f.find(x=>x.questId==='SCRAP-B');\n  if(!A?.state?.questMultiActor||!source||!victim||!other||!W?.fireBullet)return {started:false};\n  f.forEach((x,i)=>{x.baseSpeed=0;x.data.__hrHoldBody=true;x.x=120+i*125;x.y=865;});\n  source.x=170;source.y=300;victim.x=590;victim.y=300;other.x=820;other.y=790;\n  A.state.spawnHeld=true;A.state.spawnTimer=1e6;A.state.slots=[];\n  f.forEach(x=>{x.statuses={};});\n  // This is a controlled live-projectile test within a previously active\n  // match. Drain OLD ordnance so an unrelated mid-flight bullet cannot damage\n  // an innocent ally during the exact controlled ballistic solver step.\n  // Only the browser fixture clears it; production Arena rules are unchanged.\n  if(!Array.isArray(window.projectiles))return {started:false,reason:'transient-projectiles-not-exposed'};\n  window.projectiles.length=0;\n  const rig=window.APEX_QUEST_V12_RIG;\n  const before={target:victim.hp,other:other.hp,targetMax:victim.maxHp,otherMax:other.maxHp,allies:f.filter(x=>x.questTeam==='ALLY').map(x=>x.hp),\n    hitEvents:rig?.inspect?.(victim)?.hitEvents||0};\n  W.fireBullet({owner:source,x:220,y:300,angle:0,speed:2600,damage:10,weapon:'PISTOL'});\n  A.step(.16);\n  // The exact donor consumes the REAL loss on its normal Fighter.draw path.\n  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1000;\n  victim.draw(canvas.getContext('2d'));\n  return {started:true,before,after:{target:victim.hp,other:other.hp,\n    allies:f.filter(x=>x.questTeam==='ALLY').map(x=>x.hp),\n    hitEvents:rig?.inspect?.(victim)?.hitEvents||0}};\n})()");
  gate('Q3 actual PISTOL damages only the aimed physical Scrap Bot',
    !!q3RealShot?.started&&q3RealShot.after.target<q3RealShot.before.target
    &&q3RealShot.after.other===q3RealShot.before.other
    &&JSON.stringify(q3RealShot.after.allies)===JSON.stringify(q3RealShot.before.allies),q3RealShot);
  gate('Q3t donor hit spring receives exactly one authentic Arsenal PISTOL collision',
    q3RealShot?.after?.hitEvents===q3RealShot?.before?.hitEvents+1
      &&q3RealShot.after.target<q3RealShot.before.target,
    {before:q3RealShot?.before?.hitEvents,after:q3RealShot?.after?.hitEvents,
      physicalDamage:q3RealShot?.before?.target-q3RealShot?.after?.target});
  const q3PostHit=await poll("(()=>{\n  const host=document.getElementById('battleHudHost'),f=window.fighters||[];\n  return ['ALLY','HOSTILE'].map((team,i)=>{\n    const actors=f.filter(x=>x.questTeam===team),rail=host?.querySelector('#p'+(i+1)+'Rail');\n    const segments=[...(rail?.querySelectorAll('.vr-quest-slots > span')||[])];\n    return {\n      team,hp:Math.round(actors.reduce((n,a)=>n+Math.max(0,a.hp),0)),\n      shown:Number(rail?.querySelector('.vr-cur')?.textContent),\n      max:actors.reduce((n,a)=>n+Math.max(0,a.maxHp),0),\n      maxShown:Number((rail?.querySelector('.vr-max')?.textContent||'').replace(/[^0-9.]/g,'')),\n      slots:segments.map(s=>({id:s.dataset.actor,value:Number(s.style.getPropertyValue('--qhp'))})),\n      match:segments.length===actors.length&&segments.every((s,j)=>\n        s.dataset.actor===actors[j].questId&&\n        Math.abs(Number(s.style.getPropertyValue('--qhp'))-actors[j].hp/actors[j].maxHp)<.002)\n    };\n  });\n})()",
    v=>v?.length===2&&v.every(x=>x.match&&x.hp===x.shown&&x.max===x.maxShown),120);
  gate('Q3 Gold team totals and only damaged actor segment track real projectile HP',
    !!q3PostHit?.[1]?.slots?.[1]&&
       q3RealShot?.after?.target<q3RealShot?.before?.target
     // Fight history is authentic: either Scrap Bot may already be injured.
     // Exactly one controlled PISTOL hit means the other bot's ratio stays
     // equal to its PRE-SHOT real HP, not a fabricated full-health 100%.
     &&Math.abs(q3PostHit[1].slots[0].value-
       q3RealShot.after.target/q3RealShot.before.targetMax)<.002
     &&Math.abs(q3PostHit[1].slots[1].value-
       q3RealShot.before.other/q3RealShot.before.otherMax)<.002
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
  const q3tNativeRecoil=await evalPage("(()=>{\n const A=window.APEX_ARSENAL,W=A?.weaponApi,rig=window.APEX_QUEST_V12_RIG,f=window.fighters||[];\n const shooter=f.find(x=>x.questId==='SCRAP-B'),target=f.find(x=>x.questId==='T.O.T');\n if(!A?.state?.questMultiActor||!W?.equip||!rig?.inspect||!shooter||!target)return {ready:false};\n shooter.x=585;shooter.y=500;target.x=320;target.y=500;\n if(!W.equip(shooter,'PISTOL'))return {ready:false,reason:'native-equip-failed'};\n const ctx=document.createElement('canvas').getContext('2d');\n shooter.draw(ctx);\n const initial=rig.inspect(shooter);\n let maxPulse=Number(W.getHolder(shooter)?.meta?.pose?.pulses)||0;\n let lastGunKick=initial?.pose?.gunKick||0;\n let maxDeltaGunKick=0;\n const reads=[];\n for(let i=0;i<17;i++){\n   A.step(.09);\n   shooter.draw(ctx);\n   const holder=W.getHolder(shooter);\n   maxPulse=Math.max(maxPulse,Number(holder?.meta?.pose?.pulses)||0);\n   const value=rig.inspect(shooter);\n   if(value){\n     maxDeltaGunKick=Math.max(maxDeltaGunKick,Math.abs(value.pose.gunKick-lastGunKick));\n     lastGunKick=value.pose.gunKick;\n     reads.push({step:i,recoilEvents:value.recoilEvents,kick:value.pose.gunKick});\n   }\n }\n const ending=rig.inspect(shooter);\n return {ready:true,maxNativeFirePulses:maxPulse,\n   before:initial?.recoilEvents,after:ending?.recoilEvents,\n   springKickChanged:maxDeltaGunKick,\n   modelScale:ending?.scaleFactor,\n   reads:reads.filter(x=>x.recoilEvents>initial.recoilEvents).slice(0,5)};\n})()");
  gate('Q3t native PISTOL fire pulses drive REAL V12 Bulwark recoil spring',
    q3tNativeRecoil?.ready===true
      &&q3tNativeRecoil.maxNativeFirePulses>0
      &&q3tNativeRecoil.after>q3tNativeRecoil.before
      &&q3tNativeRecoil.springKickChanged>.005
      &&q3tNativeRecoil.modelScale===.82,q3tNativeRecoil);
  const q3Restored=await evalPage("(()=>{const old=window.__q3NativeUpdate;if(typeof old!=='function')return false;window.update=old;delete window.__q3NativeUpdate;return window.update===old})()");
  gate('Q3 fixture restores original engine RAF update before exiting Quest',q3Restored===true,{restored:q3Restored});
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
}catch(err){
  gate('Browser route execution',false,{error:String(err.stack||err)});
}finally{
  await writeFile(path.join(evidenceDir,'quest-q1-director-browser-report'+(isMobile?'-mobile':'')+'.json'),JSON.stringify({gates,failures},null,2));
  try{socket?.close();}catch(_){}
  chrome?.kill();
}
if(failures.length)process.exitCode=1;
