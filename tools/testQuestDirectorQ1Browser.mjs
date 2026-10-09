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
      &&q3tNativeRecoil.modelScale===.82,q3tNativeRecoil);
  // Q3u: capture the REAL draw transform of a native Arsenal PISTOL sprite.
  // The visible gun must follow its smaller Gold chassis, but Arsenal's
  // ballistic muzzle must remain unchanged; no fake holder/hitbox.
  // A missing or still-loading PISTOL PNG cannot prove a grip transform.
  // Use the actual authored asset and its normal async image cache.
  const q3uAsset=await evalPage("(async()=>{\n const AV=window.APEX_ARSENAL_AV;\n if(!AV?.preload||!AV?.weaponImage)return {ready:false,reason:'presentation API unavailable'};\n AV.preload({audio:false});\n if(!AV.weaponImage('PISTOL'))await AV.whenImagesReady(7000);\n const img=AV.weaponImage('PISTOL');\n return {ready:!!img,meta:AV.weaponMeta('PISTOL'),\n  image:img?{w:img.w,h:img.h}:null,\n  stats:{loaded:AV.stats.imagesLoaded,failed:AV.stats.imagesFailed,total:AV.imagesTotal()}};\n})()");
  gate('Q3u original PISTOL PNG is ready before sampling held-gun artwork',
    q3uAsset?.ready===true&&q3uAsset?.meta?.file?.endsWith('PISTOL.png')
      &&q3uAsset.image?.w>0,q3uAsset);
  const q3uGrip=await evalPage("(()=>{\n const A=window.APEX_ARSENAL,W=A?.weaponApi,AV=window.APEX_ARSENAL_AV,R=window.APEX_QUEST_V12_RIG;\n const actor=(window.fighters||[]).find(f=>f.questId==='SCRAP-B');\n if(!A?.state?.questMultiActor||!actor||!W?.equip||!AV?.drawEquippedWeapon||!R?.inspect)return {ready:false};\n if(!W.equip(actor,'PISTOL'))return {ready:false,reason:'real native equip failed'};\n const h=W.getHolder(actor);\n if(!h)return {ready:false,reason:'native holder absent'};\n h.meta.aimAngle=0;\n Object.assign(h.meta.pose,{localX:0,localY:0,recoil:0,rotKick:0,flourish:0,scaleX:1});\n const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1000;\n const ctx=canvas.getContext('2d');\n actor.draw(ctx); // Actual V12 rig scale, no mock visual.\n const rig=R.inspect(actor);\n const physicsBefore=W.worldAnchor(actor,'PISTOL','muzzle',0);\n const source=AV.weaponImage('PISTOL');\n const drawsBefore=AV.stats.equippedSpriteDraws;\n const proto=CanvasRenderingContext2D.prototype,originalDraw=proto.drawImage;\n let captured=null;\n try{\n   // Chamber Palette intentionally calls the true weapon artist on a\n   // 256x256 offscreen source canvas and returns UNDEFINED from its wrapper.\n   // Intercept only actual PISTOL pixels and restore the native prototype\n   // synchronously; never bypass palette effects or inject fake art.\n   proto.drawImage=function(...args){\n     const img=args[0],path=img?.src||'';\n     if(args.length===9&&typeof path==='string'&&path.includes('/weapons/c/PISTOL.png')){\n       const m=this.getTransform(),palette=this.canvas?.width===256&&this.canvas?.height===256;\n       captured={offset:m.e-(palette?128:actor.x),\n         sourceCanvas:{width:this.canvas.width,height:this.canvas.height},\n         sprite:{width:args[7],height:args[8]},\n         realImage:img.complete&&img.naturalWidth>0,\n         palette};\n     }\n     return originalDraw.apply(this,args);\n   };\n   AV.drawEquippedWeapon(ctx,actor,h);\n }finally{proto.drawImage=originalDraw;}\n const physicsAfter=W.worldAnchor(actor,'PISTOL','muzzle',0);\n return {ready:true,assetReady:!!source,holderId:h.weaponId,\n   rigFactor:rig?.scaleFactor,offset:captured?.offset,\n   expectedOffset:actor.radius*.78*.82,\n   drawCaptured:!!captured,\n   sourceCanvas:captured?.sourceCanvas,\n   sprite:captured?.sprite,\n   palette:captured?.palette,\n   realImage:captured?.realImage,\n   drawsBefore,drawsAfter:AV.stats.equippedSpriteDraws,\n   muzzleUnchanged:physicsBefore.x===physicsAfter.x&&physicsBefore.y===physicsAfter.y,\n   physicsDistance:Math.hypot(physicsBefore.x-actor.x,physicsBefore.y-actor.y)};\n})()");
  gate('Q3u real offscreen Gold PISTOL sprite follows compact 82% grip',
    q3uGrip?.ready===true&&q3uGrip?.rigFactor===.82
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
  gate('Q4C4 Gold starts exactly one RIVET authentic Arsenal equip after proven hold',
    q4cKick?.first?.ok===true&&q4cKick?.duplicate?.ok===false
    &&q4cKick?.duplicate?.reason==='already-released'
    &&q4cKick?.holder==='STORMBREAKER'
    &&q4cKick?.premature?.ready===false
    &&q4cKick?.premature?.reason==='preview-not-settled'
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
  gate('Q4C4 physical Gold displays real flying Stormbreaker and V9 VFX owner',
    q4cFlight?.proj?.aq===true&&q4cFlight?.proj?.type==='aq_thrown'
    &&q4cFlight?.proj?.weapon==='STORMBREAKER'
    &&q4cFlight?.proj?.owner==='RIVET'
    &&q4cFlight?.proj?.maxFlight>0
    &&q4cFlight?.visual?.ghostCount===3
    &&q4cFlight?.vfxOwner===true
    &&q4cFlight?.artLoaded===true
    &&q4cFlight?.hudVisible===true&&q4cFlight?.phase==='FLIGHT',q4cFlight);
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
      over:s?.over||null};
  })()`);
  gate('Q4C4 Stormbreaker naturally resolves with no HP/time/slot/cast/save drift',
    q4cSettle?.phase==='SETTLED'&&q4cSettle?.settled===true
    &&q4cSettle?.peak===1&&q4cSettle?.projectileCount===0
    &&q4cSettle?.hold==='AWAIT_RIVET'
    &&JSON.stringify(q4cKick?.before)===JSON.stringify(q4cSettle?.after)
    &&q4cSettle?.skills?.length===2
    &&q4cSettle.skills.every(x=>x.locked&&x.disabled)
    &&q4cSettle?.stage==='AWAIT_RIVET'
    &&q4cSettle?.checkpoint==='WAKE'
    &&q4cSettle?.storyProgress===false&&q4cSettle?.complete===false
    &&q4cSettle?.technical?.ready===true
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
  await pressEscape();
  const afterStoryExit=await poll("(()=>({open:document.getElementById('battleHudHost')?.classList.contains('is-open'),view:window.__apexQuestStoryViewRead?.(),node:document.getElementById('apexQuestStoryView'),checkpoint:window.APEX_QUEST01_DIRECTOR?.checkpoint()?.checkpointId}))()",
    x=>x?.open===false,150);
  gate('Q4E3 Exit destroys cinematic DOM and leaves WAKE save unmodified',
    afterStoryExit?.open===false&&afterStoryExit?.view==null
    &&afterStoryExit?.node==null&&afterStoryExit?.checkpoint==='WAKE',afterStoryExit);


}catch(err){
  gate('Browser route execution',false,{error:String(err.stack||err)});
}finally{
  await writeFile(path.join(evidenceDir,'quest-q1-director-browser-report'+(isMobile?'-mobile':'')+'.json'),JSON.stringify({gates,failures},null,2));
  try{socket?.close();}catch(_){}
  chrome?.kill();
}
if(failures.length)process.exitCode=1;
