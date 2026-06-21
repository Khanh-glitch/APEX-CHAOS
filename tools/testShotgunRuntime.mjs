const endpoint = process.env.APEX_CDP_ENDPOINT || 'http://127.0.0.1:9223';
import { writeFile } from 'node:fs/promises';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function pageTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch(`${endpoint}/json/list`).then(response => response.json());
      const target = targets.find(item => item.type === 'page' && item.url.includes('127.0.0.1:5173'));
      if (target) return target;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome CDP page did not become ready.');
}

const target = await pageTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once:true });
  socket.addEventListener('error', reject, { once:true });
});

let serial = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function command(method, params = {}) {
  const id = ++serial;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {
    expression,
    returnByValue:true,
    awaitPromise:true,
    userGesture:true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

await command('Runtime.enable');
await command('Page.enable');
await command('Page.reload', { ignoreCache:true });
await sleep(1500);
for (let attempt = 0; attempt < 80; attempt += 1) {
  if (await evaluate('Boolean(window.APEX_SHOTGUN && window.apexFighterTypes)')) break;
  await sleep(250);
  if (attempt === 79) throw new Error('SHOTGUN runtime was not exposed.');
}

const report = {};
report.selfTest = await evaluate('window.APEX_SHOTGUN.selfTest()');
report.roster = await evaluate(`({
  total:window.apexFighterTypes.filter(ft=>ft.name==='SHOTGUN').length,
  featured:[...document.querySelectorAll('[data-fighter="SHOTGUN"]')].length,
  type:window.apexFighterTypes.find(ft=>ft.name==='SHOTGUN')?.id
})`);
report.modeRosters = await evaluate(`(()=>{
  window.goToSoloSelect();const solo=document.querySelectorAll('#solo-roster .solo-card[data-name="SHOTGUN"]').length;
  window.goToTrialSelect();const trial=document.querySelectorAll('#trial-roster .solo-card[data-name="SHOTGUN"]').length;
  window.startTamChienMode();const tam=document.querySelectorAll('#tam-chien-root [data-champion="SHOTGUN"]').length;
  window.goToMenu();return {solo,trial,tam};
})()`);
report.assets = await evaluate(`Object.fromEntries(Object.entries(window.APEX_SHOTGUN.images).map(([key,img])=>[key,{complete:img.complete,width:img.naturalWidth,height:img.naturalHeight}]))`);
report.audio = await evaluate(`Promise.all(Object.entries(window.APEX_SHOTGUN.audioFiles).map(async([key,src])=>{const res=await fetch(src,{cache:'force-cache'});const buf=await res.arrayBuffer();return [key,{ok:res.ok,bytes:buf.byteLength,src}];})).then(Object.fromEntries)`);
report.assetAlpha = await evaluate(`(()=>{const sample=(img,x,y)=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d');g.drawImage(img,0,0);return g.getImageData(x,y,1,1).data[3];};const I=window.APEX_SHOTGUN.images;return {ringCenter:sample(I.ring0,Math.floor(I.ring0.naturalWidth/2),Math.floor(I.ring0.naturalHeight/2)),ringTopHole:sample(I.ring5,Math.floor(I.ring5.naturalWidth/2),Math.floor(I.ring5.naturalHeight*.175)),hookCorner:sample(I.hookHead,0,0),muzzleCorner:sample(I.muzzle,0,0),bodyHandGap:sample(I.body,290,570),pickedArmpit:sample(I.picked,624,530),pickBackground:getComputedStyle(document.querySelector('[data-fighter="SHOTGUN"]')).backgroundImage};})()`);
report.soloMechanics = await evaluate(`(()=>{
  const make=(side,x)=>({name:'SHOTGUN',side,x,y:188,dx:side===1?1:-1,dy:0,radius:28,hp:100,maxHp:100,dead:false,data:{},color:'#ff6238'});
  const p=make(1,200),e={...make(2,550),name:'ICE'},st={w:1000,h:375,p1:p,p2:e,clock:1,projectiles:[],texts:[],winner:null};
  const hookUsed=window.APEX_SHOTGUN.soloHook(st,p),hookStartX=p.x;st.clock+=.75;window.APEX_SHOTGUN.soloAdvanceMotion(st,p);const hookState={used:hookUsed,charge:p.data.shotgun.hook,shells:p.data.shotgun.shells,moved:p.x>hookStartX,cable:st.projectiles.some(q=>q.shotgunCable)};
  p.x=500;e.x=610;p.data.shotgun.reload=3;p.data.shotgun.shells=0;p.data.shotgun.counter=1;st.clock=2;
  const counterUsed=window.APEX_SHOTGUN.soloCounter(st,p,e),counterState={used:counterUsed,shells:p.data.shotgun.shells,reload:p.data.shotgun.reload,hook:p.data.shotgun.hook,counter:p.data.shotgun.counter};
  p.x=400;e.x=520;p.hp=1;e.hp=100;p.data.shotgun.shells=2;p.data.shotgun.reload=0;p.data.shotgun.rngState=1;
  window.APEX_SHOTGUN.soloFire(st,p,false);const rageState={shells:p.data.shotgun.shells,reload:p.data.shotgun.reload,enemyLost:100-e.hp};
  clearTimeout(p.data.shotgun.reloadTimer);return {hookState,counterState,rageState};
})()`);

await evaluate(`(()=>{
  const shotgun=window.apexFighterTypes.find(ft=>ft.name==='SHOTGUN');
  const ice=window.apexFighterTypes.find(ft=>ft.name==='ICE');
  window.startSpecificMatch(shotgun,ice,{countdown:false,tournament:false,trial:true});
  const [s,e]=window.fighters;e.statuses.abilityDisabled={timer:99,max:99,source:s};
  s.x=400;s.y=500;e.x=520;e.y=500;s.setDir(1,0);e.setDir(-1,0);
  const st=s.data.shotgun;st.shells=6;st.nextShotReadyTime=999;st.pendingSecond=null;st.pendingHook=null;
  return true;
})()`);
report.initial = await evaluate(`(()=>{const f=window.fighters[0],s=f.data.shotgun;return {hp:f.hp,maxHp:f.maxHp,shells:s.shells,maxShells:s.maxShells,hook:s.hookBreachCharge,counter:s.counterBlastCharge,reload:s.isLongReloading};})()`);
report.visualAim = await evaluate(`(()=>{const [s,e]=window.fighters,st=s.data.shotgun;s.x=400;s.y=500;e.x=650;e.y=500;s.setDir(0,1);st.nextShotReadyTime=999;st.hookSequence=null;st.shotLockUntil=-Infinity;st.visualDir={x:0,y:1};s.type.update(s,e,1/60);return {moveDir:{x:s.dir.x,y:s.dir.y},visualDir:st.visualDir,keptMovement:Math.abs(s.dir.x)<1e-6&&Math.abs(s.dir.y-1)<1e-6,aimed:st.visualDir.x>.95&&Math.abs(st.visualDir.y)<.05};})()`);

report.fullPellet = await evaluate(`(()=>{
  const [s,e]=window.fighters,st=s.data.shotgun;e.hp=e.maxHp;e.statuses={abilityDisabled:{timer:99,max:99,source:s}};e.data.shotgunHardStun=null;e.data.shotgunHardStunImmunityUntil=0;
  s.x=400;s.y=500;e.x=520;e.y=500;st.shells=6;st.isLongReloading=false;st.pendingSecond=null;st.rngState=0xffffffff;
  const before=e.hp,texts=window.floatingTexts.length;window.APEX_SHOTGUN.fireCycle(s,e,'qa-full',false,1);
  const movingFx=window.APEX_SHOTGUN.vfx.find(q=>q.type==='streaks');
  return {before,after:e.hp,damage:before-e.hp,stun:e.statuses.stun?.timer||0,shells:st.shells,labels:s.damageLabels,pelletTexts:window.floatingTexts.length-texts,shotLocked:st.shotLockUntil>window.matchClock&&st.shotAnchor?.x===s.x,ringFrom:st.ringRotationFrom,ringTo:st.ringRotationTo,ringHold:st.ringAnimStart>window.matchClock,movingPellets:!!movingFx&&movingFx.travelTime>0};
})()`);

await evaluate(`(()=>{
  const [s,e]=window.fighters,st=s.data.shotgun;e.hp=e.maxHp;e.statuses={abilityDisabled:{timer:99,max:99,source:s}};e.data.shotgunHardStun=null;e.data.shotgunHardStunImmunityUntil=0;
  s.x=720;s.y=500;e.x=920;e.y=500;st.shells=6;st.isLongReloading=false;st.pendingSecond=null;st.nextShotReadyTime=999;
  window.APEX_SHOTGUN.fireCycle(s,e,'qa-wall',false,1);return true;
})()`);
await evaluate(`(()=>{for(let i=0;i<20;i++)window.update(1/60);return true;})()`);
report.wallHit = await evaluate(`(()=>{const [s,e]=window.fighters;return {hp:e.hp,stun:e.statuses.stun?.timer||0,immunity:e.data.shotgunHardStunImmunityUntil||0,wallLabel:s.damageLabels['shotgun-wall-hit']||0,x:e.x};})()`);
await evaluate(`(()=>{for(let i=0;i<120;i++)window.update(1/60);return true;})()`);
report.stunImmunity = await evaluate(`(()=>{
  const [s,e]=window.fighters,st=s.data.shotgun;s.x=400;s.y=500;e.x=520;e.y=500;e.hp=e.maxHp;st.shells=6;st.isLongReloading=false;st.pendingSecond=null;st.nextShotReadyTime=999;
  const immunityBefore=e.data.shotgunHardStunImmunityUntil-window.matchClock,before=e.hp;window.APEX_SHOTGUN.fireCycle(s,e,'qa-immunity',false,1);
  return {immunityBefore,damage:before-e.hp,stun:e.statuses.stun?.timer||0,active:!!e.data.shotgunHardStun};
})()`);

report.hook = await evaluate(`(()=>{
  const [s,e]=window.fighters,st=s.data.shotgun;s.statuses={};e.statuses={abilityDisabled:{timer:99,max:99,source:s}};s.x=300;s.y=500;e.x=700;e.y=500;e.hp=e.maxHp;
  delete e.data.shotgunKnockback;st.counterMotion=null;st.hookSequence=null;st.shells=6;st.isLongReloading=false;st.hookBreachCharge=1;st.hookCheckPending=true;st.pumpReadyTime=window.matchClock;st.nextShotReadyTime=999;st.pendingHook=null;st.pendingSecond=null;st.shotLockUntil=-Infinity;st.shotAnchor=null;e.data.shotgunHardStun=null;e.data.shotgunHardStunImmunityUntil=0;
  const beforeDist=Math.hypot(e.x-s.x,e.y-s.y);window.update(1/60);for(let i=0;i<35;i++)window.update(1/60);const pullDist=Math.hypot(e.x-s.x,e.y-s.y);for(let i=0;i<45;i++)window.update(1/60);
  return {charge:st.hookBreachCharge,shells:st.shells,beforeDist,pullDist,afterDist:Math.hypot(e.x-s.x,e.y-s.y),pending:!!st.hookSequence,enemyLost:e.maxHp-e.hp};
})()`);

report.nonPiercing = await evaluate(`(()=>{
  const [s,e]=window.fighters;s.x=200;s.y=500;e.x=650;e.y=500;e.hp=e.maxHp;s.setDir(1,0);
  const summon={type:'qa_targetable',targetable:true,owner:e,x:400,y:500,radius:105,hp:1000,life:99};window.projectiles.push(summon);
  const before=e.hp;window.APEX_SHOTGUN.resolveBatch(s,{x:1,y:0},1,'qa-nonpierce');
  window.projectiles.splice(window.projectiles.indexOf(summon),1);
  return {championDamage:before-e.hp,summonDamage:1000-summon.hp};
})()`);

report.engineerMerge = await evaluate(`(()=>{
  const shotgun=window.apexFighterTypes.find(ft=>ft.name==='SHOTGUN'),engineer=window.apexFighterTypes.find(ft=>ft.name==='ENGINEER');
  window.startSpecificMatch(shotgun,engineer,{countdown:false,tournament:false,trial:true});
  const [s,e]=window.fighters,d=window.APEX_ENGINEER.ownerData(e);s.x=200;s.y=500;e.x=700;e.y=500;e.statuses.abilityDisabled={timer:99,max:99,source:s};
  const structure={id:99001,owner:e,kind:'turret',state:'merging',x:400,y:500,radius:52,blockRadius:52,hp:100,maxHp:100,mergeId:'qa-merge',mergeTimer:3,mergeDuration:3,dead:false};
  d.structures.push(structure);d.mergeIds['qa-merge']={id:'qa-merge',resultKind:'turret',timer:3,duration:3,x:400,y:500,ingredients:[structure]};
  window.APEX_SHOTGUN.resolveBatch(s,{x:1,y:0},1,'qa-merge');
  return {cancelled:!d.mergeIds['qa-merge'],mergeId:structure.mergeId||null,hp:structure.hp};
})()`);

await evaluate(`(()=>{
  const shotgun=window.apexFighterTypes.find(ft=>ft.name==='SHOTGUN'),ice=window.apexFighterTypes.find(ft=>ft.name==='ICE');
  window.startSpecificMatch(shotgun,ice,{countdown:false,tournament:false,trial:true});
  const [s,e]=window.fighters;e.statuses.abilityDisabled={timer:99,max:99,source:s};return true;
})()`);

report.counter = await evaluate(`(()=>{
  const [s,e]=window.fighters,st=s.data.shotgun;s.statuses={};s.hp=700;s.x=500;s.y=500;e.x=610;e.y=500;st.shells=1;st.counterBlastCharge=1;st.counterGuardUntil=-1;st.isLongReloading=true;st.longReloadRemaining=3;
  const before=s.hp;s.takeDamage(20,e,'qa-counter',false);s.applyStatus('stun',1,{source:e});for(let i=0;i<15;i++)window.update(1/60);
  return {before,after:s.hp,negated:s.hp===before,attachedBlocked:!s.hasStatus('stun'),shells:st.shells,hook:st.hookBreachCharge,counter:st.counterBlastCharge,reloading:st.isLongReloading,x:s.x,spinning:st.gunSpinUntil>window.matchClock};
})()`);

await evaluate(`(()=>{
  const [s,e]=window.fighters,st=s.data.shotgun;s.statuses={};s.hp=1;s.maxHp=1000;s.x=400;s.y=500;e.x=520;e.y=500;e.hp=e.maxHp;e.statuses={abilityDisabled:{timer:99,max:99,source:s}};
  st.shells=2;st.isLongReloading=false;st.rngState=1;st.pendingSecond=null;st.nextShotReadyTime=999;
  window.APEX_SHOTGUN.fireCycle(s,e,'qa-double',true,1);return true;
})()`);
await evaluate(`(()=>{for(let i=0;i<30;i++)window.update(1/60);return true;})()`);
report.doubleShot = await evaluate(`(()=>{const [s,e]=window.fighters,st=s.data.shotgun;return {shells:st.shells,reloading:st.isLongReloading,pending:!!st.pendingSecond,enemyLost:e.maxHp-e.hp,chance:window.APEX_SHOTGUN.rageChance(s)};})()`);

await evaluate(`(()=>{const [s,e]=window.fighters,st=s.data.shotgun;s.statuses={};s.hp=800;st.shells=1;st.isLongReloading=false;st.pendingSecond=null;st.nextShotReadyTime=999;e.x=850;e.y=500;s.x=200;s.y=500;window.APEX_SHOTGUN.fireCycle(s,e,'qa-reload',false,1);return true;})()`);
const reloadBefore = await evaluate('window.fighters[0].data.shotgun.longReloadRemaining');
await evaluate(`(()=>{const [s,e]=window.fighters;s.applyStatus('stun',1,{source:e});return true;})()`);
await evaluate(`(()=>{for(let i=0;i<30;i++)window.update(1/60);return true;})()`);
const reloadDuring = await evaluate('window.fighters[0].data.shotgun.longReloadRemaining');
await evaluate(`(()=>{for(let i=0;i<60;i++)window.update(1/60);return true;})()`);
await evaluate(`(()=>{for(let i=0;i<30;i++)window.update(1/60);return true;})()`);
const reloadAfter = await evaluate('window.fighters[0].data.shotgun.longReloadRemaining');
report.reloadPause = { before:reloadBefore, during:reloadDuring, after:reloadAfter, pausedDelta:reloadBefore-reloadDuring, resumedDelta:reloadDuring-reloadAfter };
report.reloadComplete = await evaluate(`(()=>{
  const f=window.fighters[0],st=f.data.shotgun;f.statuses={};st.shells=0;st.isLongReloading=true;st.longReloadRemaining=.02;st.hookBreachCharge=0;st.counterBlastCharge=0;
  for(let i=0;i<2;i++)window.update(1/60);
  return {shells:st.shells,reloading:st.isLongReloading,remaining:st.longReloadRemaining,hook:st.hookBreachCharge,counter:st.counterBlastCharge};
})()`);

report.dynamicCooling = await evaluate(`(()=>{
  const S=window.apexFighterTypes.find(ft=>ft.name==='SHOTGUN'),I=window.apexFighterTypes.find(ft=>ft.name==='ICE');
  const start=heat=>{window.startSpecificMatch(S,I,{countdown:false,tournament:false,trial:true});const [s,e]=window.fighters;e.statuses.abilityDisabled={timer:99};e.baseSpeed=0;const st=s.data.shotgun;st.heatPct=heat;window.APEX_SHOTGUN.startCooling(s);return {s,st,duration:st.coolingDuration,active:st.coolingActive};};
  const full=start(100),fullDuration=full.duration;
  const half=start(50),halfDuration=half.duration;window.matchClock=half.st.coolingStart+half.duration/2;window.update(0);const halfHeat=half.st.heatPct;
  window.matchClock=half.st.coolingStart+half.duration;window.update(0);const halfComplete=!half.st.coolingActive&&half.st.heatPct===0;
  const quarter=start(25),quarterDuration=quarter.duration;
  const zero=start(0);
  return {fullDuration,halfDuration,quarterDuration,halfHeat,halfComplete,zeroActive:zero.st.coolingActive,max:window.APEX_SHOTGUN.constants.COOLING_TIME_AT_FULL_HEAT};
})()`);

report.earlyErrors = await evaluate('window.apexEarlyErrors || []');
report.consoleContract = await evaluate(`({gameState:window.gameState,shotgunCount:window.fighters.filter(f=>f.name==='SHOTGUN').length,vfx:window.APEX_SHOTGUN.vfx.length})`);

const assertions = {
  selfTest:report.selfTest.ok === true,
  roster:report.roster.total === 1 && report.roster.featured >= 1 && report.roster.type === 'shotgun',
  modeRosters:report.modeRosters.solo >= 1 && report.modeRosters.trial >= 1 && report.modeRosters.tam >= 1,
  assets:Object.values(report.assets).every(asset => asset.complete && asset.width > 0 && asset.height > 0),
  audio:Object.values(report.audio).every(asset => asset.ok && asset.bytes > 1000),
  assetAlpha:report.assetAlpha.ringCenter === 0 && report.assetAlpha.ringTopHole === 0 && report.assetAlpha.hookCorner === 0 && report.assetAlpha.muzzleCorner === 0 && report.assetAlpha.bodyHandGap < 16 && report.assetAlpha.pickedArmpit < 16 && report.assetAlpha.pickBackground.includes('pick_button.webp'),
  soloMechanics:report.soloMechanics.hookState.used && report.soloMechanics.hookState.charge === 0 && report.soloMechanics.hookState.shells === 5 && report.soloMechanics.hookState.moved && report.soloMechanics.hookState.cable && report.soloMechanics.counterState.used && report.soloMechanics.counterState.shells === 6 && report.soloMechanics.counterState.reload === 0 && report.soloMechanics.counterState.hook === 1 && report.soloMechanics.counterState.counter === 1 && report.soloMechanics.rageState.shells === 0 && report.soloMechanics.rageState.reload === 7 && report.soloMechanics.rageState.enemyLost > 0,
  initial:report.initial.hp === 1000 && report.initial.shells === 6 && report.initial.hook === 1 && report.initial.counter === 1,
  visualAim:report.visualAim.keptMovement && report.visualAim.aimed,
  fullPellet:report.fullPellet.damage >= 37 && report.fullPellet.damage <= 38.5 && report.fullPellet.stun > .9 && report.fullPellet.shells === 5 && report.fullPellet.pelletTexts === 0 && report.fullPellet.shotLocked && report.fullPellet.ringFrom === 0 && Math.abs(report.fullPellet.ringTo+Math.PI/3)<1e-6 && report.fullPellet.ringHold && report.fullPellet.movingPellets,
  wallHit:report.wallHit.wallLabel >= 35 && report.wallHit.stun > 1.4,
  stunImmunity:report.stunImmunity.immunityBefore > 0 && report.stunImmunity.damage > 30 && report.stunImmunity.stun === 0 && !report.stunImmunity.active,
  hook:report.hook.charge === 0 && report.hook.shells === 5 && !report.hook.pending && report.hook.pullDist < report.hook.beforeDist && report.hook.enemyLost > 30,
  nonPiercing:report.nonPiercing.championDamage === 0 && report.nonPiercing.summonDamage > 30,
  engineerMerge:report.engineerMerge.cancelled && report.engineerMerge.mergeId === null && report.engineerMerge.hp < 100,
  counter:report.counter.negated && report.counter.attachedBlocked && report.counter.shells === 6 && report.counter.hook === 1 && report.counter.counter === 1 && !report.counter.reloading && report.counter.x<500 && report.counter.spinning,
  doubleShot:report.doubleShot.shells === 0 && report.doubleShot.reloading && !report.doubleShot.pending && report.doubleShot.enemyLost > 38,
  reloadPause:Math.abs(report.reloadPause.pausedDelta) < .04 && report.reloadPause.resumedDelta > .35,
  reloadComplete:report.reloadComplete.shells === 6 && !report.reloadComplete.reloading && report.reloadComplete.remaining === 0 && report.reloadComplete.hook === 1 && report.reloadComplete.counter === 1,
  dynamicCooling:report.dynamicCooling.max===15&&Math.abs(report.dynamicCooling.fullDuration-15)<.001&&Math.abs(report.dynamicCooling.halfDuration-7.5)<.001&&Math.abs(report.dynamicCooling.quarterDuration-3.75)<.001&&Math.abs(report.dynamicCooling.halfHeat-25)<.01&&report.dynamicCooling.halfComplete&&!report.dynamicCooling.zeroActive,
  noEarlyErrors:report.earlyErrors.length === 0,
};
report.assertions = assertions;
report.ok = Object.values(assertions).every(Boolean);
if (process.env.APEX_CAPTURE) {
  await evaluate(`(()=>{
    const shotgun=window.apexFighterTypes.find(ft=>ft.name==='SHOTGUN'),ice=window.apexFighterTypes.find(ft=>ft.name==='ICE');
    window.startSpecificMatch(shotgun,ice,{countdown:false,tournament:false,trial:true});
    const [s,e]=window.fighters;s.x=330;s.y=520;e.x=700;e.y=470;s.setDir(1,-.1);e.setDir(-1,.1);e.statuses.abilityDisabled={timer:99,max:99,source:s};
    const st=s.data.shotgun;st.shells=3;st.nextShotReadyTime=999;st.isLongReloading=false;st.pendingSecond=null;st.pendingHook=null;
    window.updateHUD(true);return true;
  })()`);
  await evaluate(`(()=>{for(let i=0;i<2;i++)window.update(1/60);return true;})()`);
  await sleep(300);
  const canvasData = await evaluate(`document.getElementById('game-canvas').toDataURL('image/png')`);
  await writeFile('shotgun-runtime-preview.png', Buffer.from(canvasData.split(',')[1],'base64'));
  const hookData = await evaluate(`(()=>{const [s,e]=window.fighters,st=s.data.shotgun;s.x=300;s.y=500;e.x=700;e.y=500;s.statuses={};e.statuses={abilityDisabled:{timer:99,max:99,source:s}};st.shells=6;st.hookBreachCharge=1;st.hookCheckPending=true;st.pumpReadyTime=window.matchClock;st.nextShotReadyTime=999;st.hookSequence=null;window.update(1/60);for(let i=0;i<4;i++)window.update(1/60);window.draw();return document.getElementById('game-canvas').toDataURL('image/png');})()`);
  await writeFile('shotgun-hook-preview.png', Buffer.from(hookData.split(',')[1],'base64'));
  const fireData = await evaluate(`(()=>{const [s,e]=window.fighters,st=s.data.shotgun;s.x=330;s.y=520;e.x=650;e.y=520;s.statuses={};e.statuses={abilityDisabled:{timer:99,max:99,source:s}};st.shells=6;st.isLongReloading=false;st.pendingSecond=null;st.nextShotReadyTime=999;st.ringRotation=0;st.ringRotationFrom=0;st.ringRotationTo=0;window.APEX_SHOTGUN.fireCycle(s,e,'qa-vfx',false,1);window.APEX_SHOTGUN.updateVfx(.06);window.draw();return document.getElementById('game-canvas').toDataURL('image/png');})()`);
  await writeFile('shotgun-fire-preview.png', Buffer.from(fireData.split(',')[1],'base64'));
  const ringData = await evaluate(`(()=>{for(let i=0;i<18;i++)window.update(1/60);window.draw();return document.getElementById('game-canvas').toDataURL('image/png');})()`);
  await writeFile('shotgun-ring-rotated-preview.png', Buffer.from(ringData.split(',')[1],'base64'));
  report.capture = ['shotgun-runtime-preview.png','shotgun-hook-preview.png','shotgun-fire-preview.png','shotgun-ring-rotated-preview.png'];
}
console.log(JSON.stringify(report,null,2));
socket.close();
if (!report.ok) process.exitCode = 1;
