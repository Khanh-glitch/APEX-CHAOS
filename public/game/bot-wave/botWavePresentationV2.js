/* BOT WAVE R2 — standalone cinematic interface. We MOVE live Gold
 * controls and meters without cloning/removing their IDs or event handlers.
 * The owner Gold character/glove/VFX/audio engine is not touched.
 */
(function(window){
'use strict';
const doc=window.document;
if(window.APEX_BOT_WAVE_INTERFACE_V2)return;
const VERSION='owner-release-r12-living-ring-interface';
// Existing BOXE baseline was x1.5; owner requests another +30% -> x1.95.
 // Arsenal's compressor/voice-density mix follows this shared mode policy.
 const AUDIO_MIX=Object.freeze({boxe:1.95,weapons:.14,gunFloor:.12});
function installWaveAudioMix(){
 window.APEX_BOT_WAVE_AUDIO_MIX=AUDIO_MIX;
 // Testable game-only policy; the actual per-shot gain is recorded by native AV.
 window.APEX_BOT_WAVE_AUDIO_POLICY=Object.freeze({mode:'native-swarm',revision:VERSION,
   gunBase:AUDIO_MIX.weapons,gunFloor:AUDIO_MIX.gunFloor,
   snapshots:()=>({mix:window.APEX_ARSENAL_AV?.stats?.waveMix||null,
     recentVoice:window.APEX_ARSENAL_AV?.stats?.lastVoice||null,
     decoded:window.APEX_ARSENAL_AV?.audioStatus?.().decoded||0})});
 const director=window.BOXE_SFX?.audio;
 if(!director)return;
 const apply=()=>{
  if(!director.master?.gain)return;
  // Preserve the 1.95x owner gain while guarding peaks from stacked Gold
  // impact samples. This is output dynamics only: no source SFX mutation.
  const ctx=director.audioCtx;
  if(ctx?.createDynamicsCompressor&&!director.__apexWaveLimiter){
   const limiter=ctx.createDynamicsCompressor();
   limiter.threshold.value=-10;limiter.knee.value=12;limiter.ratio.value=3;
   limiter.attack.value=.004;limiter.release.value=.19;
   director.master.disconnect();director.master.connect(limiter);limiter.connect(ctx.destination);
   Object.defineProperty(director,'__apexWaveLimiter',{value:limiter});
  }
  director.master.gain.value=director.globalGain*.54*AUDIO_MIX.boxe;
 };
 if(!director.__apexWaveMixed){
  const setup=director.setup.bind(director),gain=director.gain.bind(director);
  director.setup=function(...args){const r=setup(...args);apply();return r;};
  director.gain=function(...args){const r=gain(...args);apply();return r;};
  Object.defineProperty(director,'__apexWaveMixed',{value:true});
 }
 apply();
}
let installed=false,refresh=null;
function node(tag,cls,text){
 const el=doc.createElement(tag);
 if(cls)el.className=cls;
 if(text!==undefined)el.textContent=text;
 return el;
}
function decor(parent,cls,html){
 if(!parent||parent.querySelector('.'+cls.split(' ')[0]))return null;
 const el=node('div',cls);
 el.setAttribute('aria-hidden','true');
 if(html)el.innerHTML=html;
 parent.append(el);
 return el;
}
const ACTION_GLYPHS=Object.freeze({
 J:'<svg viewBox="0 0 24 24"><path d="M12 2.5 14.2 8.8 20.8 6.7 16.4 12 20.8 17.3 14.2 15.2 12 21.5 9.8 15.2 3.2 17.3 7.6 12 3.2 6.7 9.8 8.8Z"/></svg>',
 K:'<svg viewBox="0 0 24 24"><path d="M12 3 19 5.2v5.7c0 4.8-2.9 8-7 10.1C7.9 18.9 5 15.7 5 10.9V5.2Z"/><path d="M8.7 11.7 11 14l4.4-4.7"/></svg>',
 L:'<svg viewBox="0 0 24 24"><path d="M4 5.5 10.5 12 4 18.5"/><path d="M11.5 5.5 18 12l-6.5 6.5"/><path d="M18.5 5.5 21 12l-2.5 6.5" opacity=".55"/></svg>',
 U:'<svg viewBox="0 0 24 24"><path d="M7 20v-8.2a5 5 0 0 1 10 0V20l-2.5-2.3L12 20l-2.5-2.3Z"/><circle cx="9.6" cy="11" r=".7" fill="currentColor"/><circle cx="14.4" cy="11" r=".7" fill="currentColor"/></svg>',
 I:'<svg viewBox="0 0 24 24"><path d="M4 18.5 3.2 7 8 10.7 12 4l4 6.7L20.8 7 20 18.5Z"/><path d="M5 21h14"/></svg>'
});
function installActionGlyphs(actions){
 for(const button of actions.querySelectorAll('[data-act]')){
  const glyph=ACTION_GLYPHS[button.dataset.act];
  if(!glyph||button.querySelector('.bw-action-glyph'))continue;
  const holder=node('span','bw-action-glyph');
  holder.setAttribute('aria-hidden','true');
  holder.innerHTML=glyph;
  button.prepend(holder);
 }
}
// R12: every cluster beat is a readable chapter of one rising ritual.
// These names are presentation law only; campaign numbers and spawn order
// remain owned by waveCampaign/pilot telemetry.
const BEATS=Object.freeze([
 Object.freeze({id:'farm',name:'DAWN HARVEST',verb:'HARVEST THE RING',hint:'Chain K.O. · bank XP · keep moving',accent:'#8dffb2'}),
 Object.freeze({id:'teach',name:'FIRST LESSON',verb:'READ THE NEW GUNS',hint:'Learn each muzzle before it learns you',accent:'#8fe8ff'}),
 Object.freeze({id:'teach',name:'CROSSED LESSONS',verb:'SPLIT THE ANGLES',hint:'Never stand between two firing lanes',accent:'#8fe8ff'}),
 Object.freeze({id:'mix',name:'BROKEN CHORUS',verb:'CUT THE CROSSFIRE',hint:'Break one lane and rotate through it',accent:'#ffbb71'}),
 Object.freeze({id:'mix',name:'IRON WEATHER',verb:'OWN THE CENTER',hint:'Guard to buy time, dash to spend it',accent:'#ff9b57'}),
 Object.freeze({id:'spike',name:'REDLINE',verb:'SURVIVE THE SURGE',hint:'Spend mobility before you spend HP',accent:'#ff4057'}),
 Object.freeze({id:'power',name:'GOLDEN HARVEST',verb:'FEED THE BUILD',hint:'Hunt fast K.O. chains and green light',accent:'#ffe1a1'}),
 Object.freeze({id:'crescendo',name:'RISING FURNACE',verb:'TURN THE PRESSURE',hint:'Counter the lane that commits first',accent:'#ff7048'}),
 Object.freeze({id:'crescendo',name:'APEX STORM',verb:'LEAVE NO SAFE LANE',hint:'Every gate is live—keep orbiting',accent:'#ff5964'}),
 Object.freeze({id:'boss',name:'THE LAST BELL',verb:'BREAK THE GUARDIAN',hint:'Boss at center · escorts are fuel',accent:'#ffc36b'})
]);
const PATTERN_LABEL=Object.freeze({front:'FRONT GATE',flank:'TWIN FLANKS',cross:'CROSS LANES',pincer:'PINCER','four-edge':'FOUR GATES'});
const FAMILY_SHORT=Object.freeze({SEMI:'SEMI',AUTO:'AUTO',BURST:'BURST',SHOTGUN:'SHOT',PRECISION:'SNIPER',AUTOSHOT:'A-SHOT',GRENADE:'NADE',MELEE:'MELEE',SHIELD:'SHIELD',SPECIAL:'SPECIAL'});
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:min));
const formatInt=value=>Math.round(Number(value)||0).toLocaleString('en-US');
function setText(target,text){if(target&&target.textContent!==text)target.textContent=text;}
function beatForWave(wave){return BEATS[(Math.max(1,wave||1)-1)%10]||BEATS[0];}
function nextWavePlan(pilot,wave){
 try{return pilot?.planWave?.(wave)?.plan||pilot?.planWave?.(wave)||null;}catch(_){return null;}
}
function familyCounts(state,live){
 const counts=new Map();
 const add=(family,amount=1)=>{if(family)counts.set(family,(counts.get(family)||0)+amount);};
 for(const enemy of live||[])add(enemy.waveFamily);
 for(const queued of state?.queue||[])add(queued.family);
 return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
}
function spawnPoint(entry){
 const lane=Number.isFinite(entry?.edgeFraction)?entry.edgeFraction:.5,spread=lane*2-1;
 if(entry?.edge==='bottom')return{x:spread*660,y:590};
 if(entry?.edge==='left')return{x:-760,y:spread*510};
 if(entry?.edge==='right')return{x:760,y:spread*510};
 return{x:spread*660,y:-590};
}
let screenFrame={left:0,top:0,width:0,height:0};
function refreshScreenFrame(layer){
 const lab=window.handLab,canvas=lab?.canvas;
 const canvasRect=canvas?.getBoundingClientRect?.(),layerRect=layer?.getBoundingClientRect?.();
 if(canvasRect&&layerRect&&canvasRect.width>0&&canvasRect.height>0){
  screenFrame={left:canvasRect.left-layerRect.left,top:canvasRect.top-layerRect.top,
   width:canvasRect.width,height:canvasRect.height};
 }else if(lab?.w&&lab?.h)screenFrame={left:0,top:0,width:lab.w,height:lab.h};
 return screenFrame;
}
function worldToScreen(x,y){
 const lab=window.handLab;
 if(typeof lab?.toScreen==='function'){
  const point=lab.toScreen(x,y);
  if(Number.isFinite(point?.x)&&Number.isFinite(point?.y))
   return{x:screenFrame.left+point.x,y:screenFrame.top+point.y};
 }
 const player=lab?.player||{x:0,y:0},zoom=lab?.camZoom||1;
 const width=screenFrame.width||lab?.w||window.innerWidth||960;
 const height=screenFrame.height||lab?.h||window.innerHeight||540;
 return{x:screenFrame.left+width/2+(x-(lab?.cam?.x??player.x))*zoom,
  y:screenFrame.top+height/2+(y-(lab?.cam?.y??player.y))*zoom};
}
function install(){
 if(installed)return true;
 installWaveAudioMix();
 const hud=doc.getElementById('wave-hud');
 const modal=doc.querySelector('#wave-modal .w-dialog');
 const stage=doc.getElementById('arena-experience-hud');
 const essential=[hud,modal,hud?.querySelector('.w-left'),hud?.querySelector('.w-right'),
   hud?.querySelector('.w-actions'),hud?.querySelector('#wave-stick'),hud?.querySelector('#wave-status'),
   hud?.querySelector('#resume-wave'),doc.getElementById('w-go')];
 if(essential.some(x=>!x))return false;
 const [, , left,right,actions,stick,status,pause]=essential;
 // Previously these were five detached HUD rectangles and a 10-step
 // debug bar. Build a coherent command deck, with encounter hierarchy and
 // clear player/weapon identities, while preserving functional DOM nodes.
 const deck=node('div','bw-command-deck');
 deck.id='bw-interface-v2';
 deck.dataset.gold='intact';
 deck.dataset.revision=VERSION;
 const top=node('header','bw-top');
 const hero=node('section','bw-hero');
 hero.setAttribute('aria-label','BOXE status');
 const heroLabel=node('div','bw-hero-label');
 heroLabel.innerHTML='<span class="bw-eyebrow">APEX  /  THE LAST ROUND</span><strong>BOXE</strong><span class="bw-subtitle">THE FIST OF DAWN</span><span class="bw-momentum" id="bw-momentum" data-rank="C"><b>C</b><small>MOMENTUM · OPENING</small></span>';
 const portrait=node('img','bw-portrait');
 portrait.src='/assets/dictionary/heroes/boxe/avatar.png';
 portrait.alt='BOXE';
 portrait.decoding='async';
 hero.append(portrait,heroLabel,left);
 decor(hero,'bw-status-lights','<i></i><i></i><i></i>');
 decor(hero,'bw-panel-serial','BX-07 // DAWN LINK');
 const center=node('section','bw-encounter');
 center.setAttribute('aria-label','Tình hình trận BOT WAVE');
 const chapter=node('div','bw-chapter');
 chapter.id='bw-chapter';
 chapter.textContent='CHAPTER 01  //  ARSENAL SURVIVAL';
 const waveNumber=node('div','bw-wave-number','WAVE 01');
 const wave=node('div','bw-wave-line');
 wave.innerHTML='<span class="bw-witness">SURVIVE</span>';
 const beatCard=node('div','bw-beat-card');
 beatCard.id='bw-beat-card';
 beatCard.innerHTML='<span class="bw-beat-kicker">CLUSTER BEAT</span><strong id="bw-beat-name">DAWN HARVEST</strong><span class="bw-beat-verb" id="bw-beat-verb">HARVEST THE RING</span><small id="bw-beat-hint">Chain K.O. · bank XP · keep moving</small>';
 const oracle=node('aside','bw-oracle');
 oracle.id='bw-oracle';
 oracle.setAttribute('aria-label','Dự báo wave tiếp theo');
 oracle.innerHTML='<span class="bw-oracle-kicker">NEXT GATE ORACLE</span><strong id="bw-oracle-title">WAVE 02 · FIRST LESSON</strong><span id="bw-oracle-detail">READ THE NEW GUNS</span><small id="bw-oracle-families">HOSTILE MIX SYNCING</small>';
 const pressure=node('div','bw-pressure');
 pressure.innerHTML='<span>HOSTILE PRESSURE</span><strong id="bw-pressure-label">STANDBY</strong><i id="bw-pressure-fill"></i>';
 // The meter sits BELOW the wave identity instead of stealing the headline.
 const centerSegment=node('div','bw-beat-markers');
 centerSegment.id='bw-beat-markers';
 for(let i=0;i<10;i++){const segment=node('i');segment.setAttribute('aria-label','Wave trong cụm '+(i+1));centerSegment.append(segment);}
 center.append(chapter,waveNumber,wave,beatCard,oracle,pressure,centerSegment);
 decor(center,'bw-encounter-crest','<i></i>');
 decor(pressure,'bw-pressure-ticks','<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>');
 const threat=node('section','bw-threat');
 threat.setAttribute('aria-label','Trang bị và kẻ địch');
 const threatEyebrow=node('div','bw-threat-eyebrow','HOSTILE CONTACT  //  ROBOT UNITS');
 const constellation=node('div','bw-constellation');
 constellation.id='bw-constellation';
 constellation.setAttribute('aria-label','Họ vũ khí đang áp sát');
 for(let i=0;i<5;i++){const cell=node('span','bw-family-cell');cell.innerHTML='<b>—</b><small>0</small><i></i>';constellation.append(cell);}
 const telemetry=node('dl','bw-telemetry');
 telemetry.id='bw-telemetry';
 telemetry.innerHTML='<div><dt>GATE</dt><dd id="bw-telemetry-gate">SYNCING</dd></div><div><dt>PATTERN</dt><dd id="bw-telemetry-pattern">FRONT GATE</dd></div><div><dt>WAVE</dt><dd id="bw-telemetry-wave">0 K.O. · 0 DMG</dd></div>';
 threat.append(threatEyebrow,right,constellation,telemetry);
 const radar=decor(threat,'bw-radar','<i></i>');
 const radarDots=[];
 if(radar)for(let i=0;i<8;i++){const dot=node('b','bw-radar-dot');dot.setAttribute('aria-hidden','true');radar.append(dot);radarDots.push(dot);}
 decor(threat,'bw-panel-serial','THREAT INTEL // 41');
 top.append(hero,center,threat);
 const lower=node('footer','bw-bottom');
 const move=node('div','bw-movement');
 const moveLabel=node('div','bw-joystick-caption','MOVE  /  EVADE');
 move.append(stick,moveLabel);
 const skill=node('div','bw-skill-deck');
 const skillTitle=node('div','bw-skill-caption','BOXE  //  COMBAT ABILITIES');
 // Native J/K/L/U/I controls keep their key labels and ability states.
 // BOXE character art belongs to the *Home entry*, not combat controls.
 skill.append(skillTitle,actions);
 installActionGlyphs(actions);
 decor(skill,'bw-deck-rail','<i></i><i></i><i></i><i></i><i></i>');
 const interfaceControls=node('div','bw-interface-controls');
 interfaceControls.append(pause,status);
 lower.append(move,skill,interfaceControls);
 const spatial=node('div','bw-spatial-layer');
 spatial.id='bw-spatial-layer';
 spatial.setAttribute('aria-hidden','true');
 const damageWedge=node('div','bw-damage-wedge');
 const healHalo=node('div','bw-heal-halo');
 spatial.append(damageWedge,healHalo);
 const spatialMarkers=[];
 for(let i=0;i<10;i++){const marker=node('div','bw-spatial-marker');marker.innerHTML='<b></b><span></span>';spatial.append(marker);spatialMarkers.push(marker);}
 deck.append(spatial,top,lower);
 decor(deck,'bw-atmosphere','<i class="bw-corner is-tl"></i><i class="bw-corner is-tr"></i><i class="bw-corner is-bl"></i><i class="bw-corner is-br"></i><i class="bw-top-rail"></i><i class="bw-bottom-rail"></i>');
 hud.replaceChildren(deck);
 // The arena floor is prerendered once, so rebuild it after the shipped
 // Vietnamese faces actually arrive; otherwise its APEX/DEPLOY lettering can
 // be permanently baked with a platform fallback from the first frame.
 const refreshArenaType=(attempt=0)=>{
  if(!doc.fonts?.load)return;
  Promise.allSettled([
   doc.fonts.load('700 32px "ApexVietCondensed"','APEX'),
   doc.fonts.load('700 32px "Oswald"','APEX'),
   doc.fonts.load('600 12px "JetBrains Mono"','DEPLOY 01')
  ]).then(results=>{
   const loaded=results.reduce((sum,result)=>sum+(result.status==='fulfilled'?result.value.length:0),0);
   const stage=window.BOXE_ARENA_EXPERIENCE?.stage;
   if(stage&&loaded>=2){stage.base=null;return;}
   if(attempt<15)window.setTimeout(()=>refreshArenaType(attempt+1),250);
  });
 };
 refreshArenaType();
 // A cinematic chapter-opening screen, not a black dialog with 3 web cards.
 // Existing dialog title, card nodes and NEXT button stay direct children;
 // native Gold upgrade selection and modal report insertion keep working.
 if(!modal.querySelector('.bw-cover')){
  const art=node('aside','bw-cover');
  const image=node('img','bw-cover-art');
  image.src='/assets/dictionary/heroes/boxe/cover.png';
  image.alt='BOXE — The Fist of Dawn';
  image.decoding='async';
  const frame=node('div','bw-cover-frame');
  frame.innerHTML='<span>APEX  /  SPECIAL OPERATIONS</span><strong>THE LAST<br>ROUND</strong><small>UNLIMITED ARSENAL · BOXE</small>';
  art.append(image,frame);
  modal.prepend(art);
 }
 if(!modal.querySelector('.bw-dialog-kicker')){
  const kicker=node('div','bw-dialog-kicker');
  kicker.textContent='BOT WAVE  //  SURVIVAL PROTOCOL';
  modal.insertBefore(kicker,doc.getElementById('w-title'));
 }
 decor(modal,'bw-dialog-ornaments','<i class="is-tl"></i><i class="is-tr"></i><i class="is-bl"></i><i class="is-br"></i>');
 decor(modal,'bw-dialog-seal','APEX // LAST ROUND // 07');
 const oldTrack=stage?.querySelector('#arena-round-track');
 if(oldTrack){oldTrack.setAttribute('aria-hidden','true');oldTrack.hidden=true;}
 const tool=stage?.querySelector('#arena-experience-tools');
 if(tool){tool.hidden=true;tool.setAttribute('aria-hidden','true');}
 // HUD truth: 10-wave cluster beats, live pressure budget, wave identity.
 let lastChapter='',lastPressure='',lastBeat=-1,lastGuardState='',lastRank='',lastMomentumText='',readyFlashTimer=0;
 let forecastCacheWave=-1,forecastCache=null,spatialFrame=0,lastSpatialAt=0;
 const beatName=beatCard.querySelector('#bw-beat-name'),beatVerb=beatCard.querySelector('#bw-beat-verb'),
  beatHint=beatCard.querySelector('#bw-beat-hint'),beatKicker=beatCard.querySelector('.bw-beat-kicker'),
  oracleTitle=oracle.querySelector('#bw-oracle-title'),oracleDetail=oracle.querySelector('#bw-oracle-detail'),
  oracleFamilies=oracle.querySelector('#bw-oracle-families'),momentum=hero.querySelector('#bw-momentum'),
  telemetryGate=telemetry.querySelector('#bw-telemetry-gate'),telemetryPattern=telemetry.querySelector('#bw-telemetry-pattern'),
  telemetryWave=telemetry.querySelector('#bw-telemetry-wave');
 const updateSpatial=()=>{
  const pilot=window.BOXE_WAVE_PILOT,lab=window.handLab,s=pilot?.state||{},player=lab?.player;
  if(!pilot||!lab||!player){for(const marker of spatialMarkers)marker.style.opacity='0';damageWedge.style.opacity='0';healHalo.style.opacity='0';return;}
  const width=spatial.clientWidth||window.innerWidth||lab.w||960,height=spatial.clientHeight||window.innerHeight||lab.h||540;
  const frame=refreshScreenFrame(spatial),frameRight=frame.left+(frame.width||width),frameBottom=frame.top+(frame.height||height);
  const layerRect=spatial.getBoundingClientRect?.(),topRect=top.getBoundingClientRect?.(),lowerRect=lower.getBoundingClientRect?.();
  const panelTop=layerRect&&topRect?topRect.bottom-layerRect.top+8:(height<560?84:118);
  const panelBottom=layerRect&&lowerRect?lowerRect.top-layerRect.top-8:height-(height<560?82:112);
  const safe={left:Math.max(20,frame.left+16),top:Math.max(panelTop,frame.top+16),
   right:Math.min(Math.max(120,width-20),frameRight-16),bottom:Math.min(Math.max(panelTop+40,panelBottom),frameBottom-16)};
  const playerPoint=worldToScreen(player.x||0,player.y||0);
  const hiddenByHud=point=>point.x<safe.left||point.x>safe.right||point.y<safe.top||point.y>safe.bottom;
  const live=(lab.enemies||[]).filter(e=>!e.dead&&e.waveGunId);
  const entries=[];
  const push=(kind,x,y,label,glyph,family='',force=false)=>{
   const point=worldToScreen(x||0,y||0),hidden=hiddenByHud(point);
   if(!force&&!hidden)return;
   entries.push({kind,point,label,glyph,family,hidden});
  };
  const boss=live.find(e=>e.waveBoss);
  if(boss)push('boss',boss.x,boss.y,(boss.waveGunId||'GUARDIAN')+' · '+formatInt(boss.hp),'♛',boss.waveFamily||'');
  const pack=s.healthPacks?.[0];
  if(pack)push('heal',pack.x,pack.y,'+10% HP','+', '',true);
  const next=s.queue?.[0];
  if(next&&s.phase==='combat'){
   const charge=1-clamp((Number(s.spawnT)||0)/Math.max(.18,Number(s.spawnInterval)||.37));
   if(charge>=.28){const point=spawnPoint(next);push('gate',point.x,point.y,(next.edge||'gate').toUpperCase()+' · '+(next.gun||'HOSTILE'),'◆',next.family||'',charge>=.72);}
  }
  live.filter(e=>e!==boss).map(e=>({e,point:worldToScreen(e.x||0,e.y||0),
   distance:Math.hypot((e.x||0)-(player.x||0),(e.y||0)-(player.y||0))}))
   .filter(item=>hiddenByHud(item.point))
   .sort((a,b)=>(Number(b.e.wavePressure)||0)-(Number(a.e.wavePressure)||0)||a.distance-b.distance)
   .slice(0,6).forEach(({e})=>push('hostile',e.x,e.y,e.waveGunId||'HOSTILE','▲',e.waveFamily||'',true));
  spatialMarkers.forEach((marker,index)=>{
   const entry=entries[index];
   if(!entry){marker.style.opacity='0';marker.className='bw-spatial-marker';return;}
   const x=clamp(entry.point.x,safe.left,safe.right),y=clamp(entry.point.y,safe.top,safe.bottom);
   const angle=Math.atan2(entry.point.y-playerPoint.y,entry.point.x-playerPoint.x)*180/Math.PI;
   marker.className='bw-spatial-marker is-visible is-'+entry.kind+(entry.hidden?' is-offscreen':' is-onscreen');
   marker.dataset.family=entry.family||'';
   marker.style.left=x+'px';marker.style.top=y+'px';marker.style.opacity='1';
   marker.style.setProperty('--bw-marker-angle',angle.toFixed(1)+'deg');
   setText(marker.querySelector('b'),entry.glyph);
   setText(marker.querySelector('span'),entry.label);
  });
  const now=Number(lab.time)||0,damageAge=now-(Number(s.lastDamageAt)||-9),healAge=now-(Number(s.lastHealAt)||-9);
  if(damageAge>=0&&damageAge<.9&&player.hp>0){
   const strength=clamp(.35+(Number(s.lastDamageAmount)||0)/Math.max(1,player.maxHp||1000)*4,0,1);
   damageWedge.style.left=playerPoint.x+'px';damageWedge.style.top=playerPoint.y+'px';
   damageWedge.style.opacity=String((1-damageAge/.9)*strength);
   damageWedge.style.transform='translate(-50%,-50%) rotate('+((Number(s.lastDamageAngle)||0)*180/Math.PI).toFixed(1)+'deg) scale('+(0.8+strength*.45).toFixed(2)+')';
  }else damageWedge.style.opacity='0';
  if(healAge>=0&&healAge<1.35&&player.hp>0){
   healHalo.style.left=playerPoint.x+'px';healHalo.style.top=playerPoint.y+'px';
   healHalo.style.opacity=String((1-healAge/1.35)*.9);
   healHalo.style.transform='translate(-50%,-50%) scale('+(0.72+healAge*.55).toFixed(2)+')';
  }else healHalo.style.opacity='0';
 };
 const update=()=>{
  const pilot=window.BOXE_WAVE_PILOT;
  if(!pilot)return;
  const s=pilot.state||{},lab=window.handLab||{},player=lab.player||{},n=Math.max(1,s.wave||1);
  const cluster=Math.floor((n-1)/10)+1,beat=Number.isInteger(s.hudBeatIndex)?clamp(s.hudBeatIndex,0,9):(n-1)%10,
   beatInfo=BEATS[beat]||beatForWave(n),bossBeat=beat===9;
  const newChapter='CLUSTER '+String(cluster).padStart(2,'0')+'  //  WAVE '+(beat+1)+'/10';
  if(newChapter!==lastChapter){chapter.textContent=newChapter;lastChapter=newChapter;}
  waveNumber.textContent='WAVE '+String(n).padStart(2,'0');
  center.classList.toggle('bw-is-boss',bossBeat);
  center.classList.toggle('bw-is-upgrade',s.phase==='upgrade');
  center.classList.toggle('bw-is-clear',!!s.autoNextWave);
  const beatKey=beat+(s.autoNextWave?100:0);
  if(beatKey!==lastBeat){for(const [i,el] of [...centerSegment.children].entries()){
   el.classList.toggle('done',i<beat||!!s.autoNextWave&&i<=beat);el.classList.toggle('active',i===beat&&!s.autoNextWave);
  }lastBeat=beatKey;}
  const phase=wave.querySelector('.bw-witness');
  if(phase)phase.textContent=s.autoNextWave?'WAVE CLEAR':bossBeat?'BOSS ROUND':s.phase==='combat'?'IN COMBAT':
   s.phase==='upgrade'?'UPGRADE':s.phase==='gameover'?'BOXE DOWN':'READY';
  setText(beatKicker,s.autoNextWave?'BEAT SEALED':'CLUSTER BEAT');
  setText(beatName,beatInfo.name);setText(beatVerb,beatInfo.verb);setText(beatHint,beatInfo.hint);
  beatCard.dataset.beat=beatInfo.id;center.dataset.beat=beatInfo.id;deck.dataset.beat=beatInfo.id;
  deck.style.setProperty('--bw-beat-accent',beatInfo.accent);
  const enemies=lab.enemies||[];
  const live=enemies.filter(e=>!e.dead&&e.waveGunId);
  const active=live.length,bossLive=live.some(e=>e.waveBoss);
  const queued=s.queue?.length||0;
  const activePressure=live.reduce((sum,e)=>sum+(Number(e.wavePressure)||0),0);
  const queuedPressure=(s.queue||[]).reduce((sum,e)=>sum+(Number(e.pressure)||0),0);
  const budget=Math.max(1,Number(s.pressureBudget)||260);
  const danger=s.autoNextWave?0:Math.min(1,activePressure/budget||active/Math.max(1,s.softCap||5));
  const text=s.autoNextWave?'NEXT IN '+Math.max(1,Math.ceil(s.nextWaveT||0))+'s':
   active+' ACTIVE  /  '+queued+' INBOUND  /  '+Math.round(activePressure)+'/'+Math.round(budget);
  if(text!==lastPressure){pressure.querySelector('strong').textContent=text;lastPressure=text;}
  pressure.style.setProperty('--bw-pressure',danger.toFixed(3));
  pressure.style.setProperty('--bw-inbound-pressure',clamp(queuedPressure/Math.max(1,activePressure+queuedPressure)).toFixed(3));
  center.classList.toggle('bw-under-pressure',danger>=.82);
  center.dataset.danger=danger>=.82?'critical':danger>=.55?'high':danger>=.28?'rising':'calm';
  threat.dataset.danger=center.dataset.danger;
  const hpPct=player.maxHp?clamp(player.hp/player.maxHp):1;
  const breather=!!s.autoNextWave||s.phase==='intermission';
  const focus=breather?'breather':(s.phase==='upgrade'||s.phase==='gameover'||s.phase==='intro')?'cinematic':
   hpPct<=.35&&player.hp>0?'danger':(danger>=.68||active>=5||bossLive)?'hot':'combat';
  deck.dataset.focus=focus;deck.dataset.phase=s.autoNextWave?'wave-clear':(s.phase||'intro');deck.dataset.danger=center.dataset.danger;
  hero.classList.toggle('bw-took-hit',left.classList.contains('r2-damaged'));
  hero.classList.toggle('bw-is-low',left.classList.contains('is-low'));
  hero.classList.toggle('bw-is-hot',left.classList.contains('r2-hot'));
  const kills=Number(s.waveKills)||0,dealt=Number(s.waveDamageDealt)||0,taken=Number(s.waveDamageReceived)||0;
  const totalHostiles=kills+active+queued,progress=totalHostiles?kills/totalHostiles:(breather&&n?1:0);
  const momentumScore=clamp(progress*.38+Math.min(.28,dealt/3800)+hpPct*.18+(s.empowered?.16:0)-Math.min(.3,taken/1300));
  const rank=momentumScore>=.82?'S':momentumScore>=.62?'A':momentumScore>=.42?'B':momentumScore>=.22?'C':'D';
  const momentumText='MOMENTUM · '+(breather?'WAVE SEALED':rank==='S'?'APEX FORM':rank==='A'?'SURGING':rank==='B'?'CONTROL':rank==='C'?'BUILDING':'UNDER FIRE');
  if(momentum&&(rank!==lastRank||momentumText!==lastMomentumText)){
   momentum.dataset.rank=rank;setText(momentum.querySelector('b'),rank);
   setText(momentum.querySelector('small'),momentumText);
   lastRank=rank;lastMomentumText=momentumText;
  }
  const forecastWave=breather?(Number(s.wave)||0)+1:n;
  if(forecastWave!==forecastCacheWave){forecastCache=nextWavePlan(pilot,forecastWave);if(forecastCache)forecastCacheWave=forecastWave;}
  const forecastBeat=beatForWave(forecastWave);
  const forecastCounts=new Map();
  for(const entry of forecastCache?.composition||[])forecastCounts.set(entry.family,(forecastCounts.get(entry.family)||0)+1);
  const forecastFamilies=[...forecastCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3)
   .map(([family,count])=>(FAMILY_SHORT[family]||family)+' ×'+count).join(' · ');
  const forecastNew=(forecastCache?.newWeapons||[]).slice(0,2).join(' + ');
  setText(oracleTitle,'WAVE '+String(forecastWave).padStart(2,'0')+' · '+forecastBeat.name);
  setText(oracleDetail,forecastBeat.verb+' · '+(PATTERN_LABEL[forecastCache?.pattern]||PATTERN_LABEL[forecastBeat.pattern]||'GATES SYNCING'));
  setText(oracleFamilies,(forecastFamilies||'HOSTILE MIX SYNCING')+(forecastNew?' · NEW '+forecastNew:''));
  oracle.classList.toggle('is-open',focus==='breather');
  oracle.dataset.beat=forecastBeat.id;
  let counts=familyCounts(s,live),countMode='live';
  if(!counts.length&&forecastCache?.composition?.length){counts=[...forecastCounts.entries()].sort((a,b)=>b[1]-a[1]);countMode='forecast';}
  threat.dataset.intelMode=countMode;
  const countTotal=counts.reduce((sum,[,count])=>sum+count,0)||1;
  [...constellation.children].forEach((cell,index)=>{
   const [family,count]=counts[index]||['',0];
   cell.dataset.family=family;cell.classList.toggle('is-hot',count/countTotal>=.34);
   setText(cell.querySelector('b'),family?(FAMILY_SHORT[family]||family):'—');
   setText(cell.querySelector('small'),String(count));
   const bar=cell.querySelector('i');if(bar)bar.style.width=Math.round(count/countTotal*100)+'%';
  });
  const nextGate=s.queue?.[0];
  setText(telemetryGate,nextGate?(nextGate.edge||'gate').toUpperCase()+' · '+Math.max(0,Number(s.spawnT)||0).toFixed(1)+'s':
   breather?'WAVE '+String(forecastWave).padStart(2,'0')+' · '+Math.max(1,Math.ceil(s.nextWaveT||0))+'s':active?'ARENA LIVE':'GATES QUIET');
  setText(telemetryPattern,PATTERN_LABEL[breather?forecastCache?.pattern:(s.hudPattern||forecastCache?.pattern)]||'GATES SYNCING');
  setText(telemetryWave,kills+' K.O. · '+formatInt(dealt)+' DMG');
  if(radarDots.length){
   const sorted=[...live].sort((a,b)=>((b.waveBoss?1:0)-(a.waveBoss?1:0))||(Number(b.wavePressure)||0)-(Number(a.wavePressure)||0)).slice(0,radarDots.length);
   radarDots.forEach((dot,index)=>{
    const enemy=sorted[index];
    if(!enemy){dot.style.opacity='0';return;}
    dot.classList.toggle('is-boss',!!enemy.waveBoss);dot.dataset.family=enemy.waveFamily||'';
    dot.style.left=(50+clamp(((enemy.x||0)-(player.x||0))/1600,-.46,.46)*100)+'%';
    dot.style.top=(50+clamp(((enemy.y||0)-(player.y||0))/1300,-.46,.46)*100)+'%';
    dot.style.opacity='1';
   });
  }
  const currentPlan=forecastCacheWave===n?forecastCache:nextWavePlan(pilot,n);
  if(currentPlan?.composition){
   const byWeapon=new Map(currentPlan.composition.map(entry=>[entry.weaponId,entry]));
   for(const chip of right.querySelectorAll('#w-arsenal span')){
    const entry=byWeapon.get(chip.textContent.trim());
    if(entry){chip.dataset.family=entry.family||'';chip.dataset.role=entry.role||'';chip.title=(entry.family||'')+' · '+(entry.role||'');}
   }
  }
  const guardState=s.guardHeld?'held':(s.guardCdT>0?'cooling':'ready');
  deck.dataset.guard=guardState;
  if(lastGuardState==='cooling'&&guardState==='ready'){
   const guardButton=actions.querySelector('[data-act="K"]');
   if(guardButton){guardButton.classList.add('bw-ready-flash');
    if(readyFlashTimer)window.clearTimeout(readyFlashTimer);
    readyFlashTimer=window.setTimeout(()=>guardButton.classList.remove('bw-ready-flash'),520);}
  }
  lastGuardState=guardState;
  updateSpatial();
 };
 const spatialLoop=timestamp=>{
  if(!lastSpatialAt||timestamp-lastSpatialAt>=33){try{updateSpatial();}catch(_){}lastSpatialAt=timestamp;}
  spatialFrame=window.requestAnimationFrame(spatialLoop);
 };
 update();
 if(typeof window.requestAnimationFrame==='function')spatialFrame=window.requestAnimationFrame(spatialLoop);
 refresh=window.setInterval(update,90);
 window.addEventListener('pagehide',()=>{if(refresh)clearInterval(refresh);if(spatialFrame)window.cancelAnimationFrame?.(spatialFrame);if(readyFlashTimer)clearTimeout(readyFlashTimer);},{once:true});
 installed=true;
 window.APEX_BOT_WAVE_INTERFACE_V2=Object.freeze({installed:true,version:VERSION});
 doc.documentElement.dataset.botWavePresentation='gold-v2';
 return true;
}
if(!install()){
 const watch=new MutationObserver(()=>{if(install())watch.disconnect()});
 watch.observe(doc.documentElement,{subtree:true,childList:true});
 window.setTimeout(()=>watch.disconnect(),25000);
}
})(window);
