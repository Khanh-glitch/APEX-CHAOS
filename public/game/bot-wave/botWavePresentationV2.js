/* BOT WAVE R2 — standalone cinematic interface. We MOVE live Gold
 * controls and meters without cloning/removing their IDs or event handlers.
 * The owner Gold character/glove/VFX/audio engine is not touched.
 */
(function(window){
'use strict';
const doc=window.document;
if(window.APEX_BOT_WAVE_INTERFACE_V2)return;
const VERSION='owner-release-r13-ring-command';
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
// R13: every cluster beat must survive as one glanceable phrase in the top
// spine. These names are presentation law only; campaign numbers and spawn
// order remain owned by waveCampaign/pilot telemetry.
const BEATS=Object.freeze([
 Object.freeze({id:'farm',name:'DAWN HARVEST',verb:'HARVEST',hint:'Chain K.O. · bank XP · keep moving',accent:'#8dffb2'}),
 Object.freeze({id:'teach',name:'FIRST LESSON',verb:'READ GUNS',hint:'Learn each muzzle before it learns you',accent:'#8fe8ff'}),
 Object.freeze({id:'teach',name:'CROSS LESSON',verb:'SPLIT ANGLES',hint:'Never stand between two firing lanes',accent:'#8fe8ff'}),
 Object.freeze({id:'mix',name:'BROKEN CHORUS',verb:'CUT CROSSFIRE',hint:'Break one lane and rotate through it',accent:'#ffbb71'}),
 Object.freeze({id:'mix',name:'IRON WEATHER',verb:'OWN CENTER',hint:'Guard to buy time, dash to spend it',accent:'#ff9b57'}),
 Object.freeze({id:'spike',name:'REDLINE',verb:'SURVIVE',hint:'Spend mobility before you spend HP',accent:'#ff4057'}),
 Object.freeze({id:'power',name:'GOLD HARVEST',verb:'FEED BUILD',hint:'Hunt fast K.O. chains and green light',accent:'#ffe1a1'}),
 Object.freeze({id:'crescendo',name:'RISING FURNACE',verb:'TURN PRESSURE',hint:'Counter the lane that commits first',accent:'#ff7048'}),
 Object.freeze({id:'crescendo',name:'APEX STORM',verb:'NO SAFE LANE',hint:'Every gate is live—keep orbiting',accent:'#ff5964'}),
 Object.freeze({id:'boss',name:'LAST BELL',verb:'BREAK GUARDIAN',hint:'Boss at center · escorts are fuel',accent:'#ffc36b'})
]);
const PATTERN_LABEL=Object.freeze({front:'FRONT GATE',flank:'TWIN FLANKS',cross:'CROSS LANES',pincer:'PINCER','four-edge':'FOUR GATES'});
const FAMILY_SHORT=Object.freeze({SEMI:'SEMI',AUTO:'AUTO',BURST:'BURST',SHOTGUN:'SHOT',PRECISION:'SNIPER',AUTOSHOT:'A-SHOT',GRENADE:'NADE',MELEE:'MELEE',SHIELD:'SHIELD',SPECIAL:'SPECIAL'});
const FAMILY_COLORS=Object.freeze({SEMI:'#ffbb71',AUTO:'#ff8a4d',BURST:'#ffc36b',SHOTGUN:'#ff5964',PRECISION:'#8fe8ff',AUTOSHOT:'#ff7048',GRENADE:'#8dffb2',MELEE:'#ffe1a1',SHIELD:'#c9a7ff',SPECIAL:'#f6a6ff'});
const FAMILY_GLYPHS=Object.freeze({SEMI:'◆',AUTO:'▲',BURST:'⬢',SHOTGUN:'✦',PRECISION:'◎',AUTOSHOT:'⬣',GRENADE:'●',MELEE:'✕',SHIELD:'⛨',SPECIAL:'✧'});
const ARENA_RADIUS=920;
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:min));
const formatInt=value=>Math.round(Number(value)||0).toLocaleString('en-US');
function setText(target,text){if(target&&target.textContent!==text)target.textContent=text;}
function xpThreshold(pilot,level){
 const safeLevel=Math.max(1,Math.floor(Number(level)||1));
 try{const value=Number(pilot?.xpNeeded?.(safeLevel));if(Number.isFinite(value)&&value>0)return value;}catch(_){/* Presentation falls back to the pilot's published curve. */}
 return Math.ceil(70*Math.pow(1.16,safeLevel-1));
}
const distanceLabel=value=>Math.max(1,Math.round((Number(value)||0)/10))+'m';
const familyColor=family=>FAMILY_COLORS[family]||'#ff8a4d';
const familyGlyph=family=>FAMILY_GLYPHS[family]||'▲';
function beatForWave(wave){return BEATS[(Math.max(1,wave||1)-1)%10]||BEATS[0];}
function nextWavePlan(pilot,wave){
 try{return pilot?.planWave?.(wave)?.plan||pilot?.planWave?.(wave)||null;}catch(_){return null;}
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
 // R13 breaks the old three-panel composition instead of decorating it:
 // a fused vitality reactor at top-left, one horizontal wave spine across
 // the top edge, and a true arena minimap at top-right. Native Gold nodes
 // are moved—not cloned—so IDs, handlers and refresh seams remain intact.
 const deck=node('div','bw-command-deck');
 deck.id='bw-interface-v2';
 deck.dataset.gold='intact';
 deck.dataset.revision=VERSION;
 deck.dataset.paused='false';
 const top=node('header','bw-top');
 const hero=node('section','bw-hero');
 hero.setAttribute('aria-label','BOXE status');
 const levelCore=node('div','bw-level-core');
 levelCore.id='bw-level-core';
 levelCore.setAttribute('aria-label','Cấp độ và kinh nghiệm của BOXE');
 levelCore.innerHTML='<small>LV</small><strong id="bw-level-value">1</strong><span id="bw-xp-ring-label">0 / 70 XP</span><b class="bw-momentum" id="bw-momentum" data-rank="D" title="Momentum">D</b>';
 const heroLabel=node('div','bw-hero-label');
 heroLabel.innerHTML='<strong>BOXE</strong><span class="bw-momentum-copy" id="bw-momentum-copy">MOMENTUM · OPENING</span>';
 const hpCopy=left.querySelector('#w-hp')?.closest('.w-small');
 hpCopy?.classList.add('bw-native-hp-copy');
 const levelCopy=left.querySelector('#w-level')?.closest('.w-small');
 levelCopy?.classList.add('bw-native-level-copy');
 const furyLine=left.querySelector('.w-fury-line');
 furyLine?.classList.add('bw-native-fury-copy');
 const hpMeter=left.querySelector('.hp-r2'),furyMeter=left.querySelector('.fury-r2');
 const vitalStack=node('div','bw-vital-stack');
 vitalStack.id='bw-vital-stack';
 if(hpMeter)vitalStack.append(hpMeter);
 if(furyMeter)vitalStack.append(furyMeter);
 left.append(vitalStack);
 pause.classList.add('bw-pause-trigger');
 pause.type='button';
 pause.innerHTML='<span></span><span></span>';
 pause.setAttribute('aria-label','Mở menu tạm dừng BOT WAVE');
 pause.title='Tạm dừng';
 hero.append(levelCore,heroLabel,left,pause);
 decor(hero,'bw-ignition','<i></i><i></i><i></i><i></i><i></i><i></i><i></i>');
 const center=node('section','bw-encounter bw-wave-spine');
 center.setAttribute('aria-label','Tình hình trận BOT WAVE');
 const waveCore=node('div','bw-wave-core');
 const chapter=node('small','bw-chapter');
 chapter.id='bw-chapter';
 chapter.textContent='CLUSTER 01 · 1/10';
 const waveNumber=node('strong','bw-wave-number','WAVE 01');
 waveCore.append(chapter,waveNumber);
 const beatCard=node('div','bw-beat-card bw-beat-inline');
 beatCard.id='bw-beat-card';
 beatCard.innerHTML='<span class="bw-beat-kicker">CLUSTER BEAT</span><strong id="bw-beat-name">DAWN HARVEST</strong><span class="bw-beat-verb" id="bw-beat-verb">HARVEST</span><small id="bw-beat-hint">Chain K.O. · bank XP · keep moving</small>';
 const wave=node('div','bw-wave-line');
 wave.innerHTML='<span class="bw-witness">SURVIVE</span>';
 const oracle=node('aside','bw-oracle');
 oracle.id='bw-oracle';
 oracle.setAttribute('aria-label','Dự báo wave tiếp theo');
 oracle.innerHTML='<span class="bw-oracle-kicker">NEXT</span><strong id="bw-oracle-title">WAVE 02 · FIRST LESSON</strong><span id="bw-oracle-detail">READ GUNS</span><small id="bw-oracle-families">HOSTILE MIX SYNCING</small>';
 const pressure=node('div','bw-pressure');
 pressure.innerHTML='<span>PRESSURE</span><strong id="bw-pressure-label">STANDBY</strong><i id="bw-pressure-fill"></i>';
 const centerSegment=node('div','bw-beat-markers');
 centerSegment.id='bw-beat-markers';
 for(let i=0;i<10;i++){const segment=node('i');segment.setAttribute('aria-label','Wave trong cụm '+(i+1));centerSegment.append(segment);}
 center.append(waveCore,beatCard,wave,pressure,centerSegment,oracle);
 decor(pressure,'bw-pressure-ticks','<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>');
 const threat=node('section','bw-minimap');
 threat.id='bw-minimap';
 threat.setAttribute('aria-label','Bản đồ arena BOT WAVE');
 const minimapHead=node('div','bw-minimap-head');
 minimapHead.innerHTML='<span>RING MAP</span><strong id="bw-minimap-mode">LIVE</strong>';
 const minimapCanvas=node('canvas','bw-minimap-canvas');
 minimapCanvas.id='bw-minimap-canvas';
 minimapCanvas.setAttribute('aria-hidden','true');
 const minimapFoot=node('div','bw-minimap-foot');
 const nativeCount=right.querySelector('#w-count');
 if(nativeCount)minimapFoot.append(nativeCount);
 const minimapNext=node('span','bw-minimap-next','GATE SYNC');
 minimapNext.id='bw-minimap-next';
 minimapFoot.append(minimapNext);
 threat.append(minimapHead,minimapCanvas,minimapFoot);
 const dataVault=node('div','bw-data-vault');
 dataVault.hidden=true;
 dataVault.setAttribute('aria-hidden','true');
 dataVault.append(right);
 top.append(hero,center,threat);
 const lower=node('footer','bw-bottom');
 const move=node('div','bw-movement');
 const moveLabel=node('div','bw-joystick-caption','MOVE / EVADE');
 move.append(stick,moveLabel);
 const skill=node('div','bw-skill-deck bw-skill-fan');
 skill.setAttribute('aria-label','Kỹ năng chiến đấu của BOXE');
 // Native J/K/L/U/I controls keep their key labels and ability states, but
 // the old rectangular deck is gone: the fan hugs the bottom-right corner.
 skill.append(actions);
 installActionGlyphs(actions);
 lower.append(move,skill);
 status.classList.add('bw-event-ticker');
 const spatial=node('div','bw-spatial-layer');
 spatial.id='bw-spatial-layer';
 spatial.setAttribute('aria-hidden','true');
 const peripheral=node('div','bw-peripheral');
 const damageWedge=node('div','bw-damage-wedge');
 const healHalo=node('div','bw-heal-halo');
 spatial.append(peripheral,damageWedge,healHalo);
 const spatialMarkers=[];
 for(let i=0;i<9;i++){
  const marker=node('div','bw-spatial-marker');
  marker.innerHTML='<i class="bw-marker-arrow"></i><b class="bw-marker-badge"></b><span class="bw-marker-copy"><strong></strong><small></small></span><em class="bw-marker-meter"><i></i></em>';
  spatial.append(marker);spatialMarkers.push(marker);
 }
 const pauseMenu=node('div','bw-pause-menu');
 pauseMenu.id='bw-pause-menu';
 pauseMenu.hidden=true;
 pauseMenu.setAttribute('role','dialog');
 pauseMenu.setAttribute('aria-modal','true');
 pauseMenu.setAttribute('aria-labelledby','bw-pause-title');
 pauseMenu.innerHTML='<section class="bw-pause-card">'
  +'<header class="bw-pause-head"><span>RING COMMAND // BX-07</span><strong id="bw-pause-title">TẠM DỪNG</strong><small id="bw-pause-summary">WAVE 01 · CLUSTER 01 · LV 1</small></header>'
  +'<div class="bw-pause-stats"><div><small>K.O.</small><strong id="bw-pause-kills">0</strong></div><div><small>SÁT THƯƠNG</small><strong id="bw-pause-damage">0</strong></div><div><small>THỜI GIAN</small><strong id="bw-pause-time">00:00</strong></div><div><small>THẺ BUILD</small><strong id="bw-pause-cards-count">0</strong></div></div>'
  +'<nav class="bw-pause-actions" aria-label="Tùy chọn tạm dừng">'
  +'<button type="button" data-pause-action="resume" class="is-primary"><strong>TIẾP TỤC</strong><small>Quay lại sàn đấu</small></button>'
  +'<button type="button" data-pause-action="save-exit"><strong>LƯU & THOÁT</strong><small id="bw-pause-save-copy">Lưu tại đầu wave hiện tại</small></button>'
  +'<button type="button" data-pause-action="replay-wave"><strong>CHƠI LẠI WAVE</strong><small>Dùng snapshot đầu wave</small></button>'
  +'<button type="button" data-pause-action="replay-cluster"><strong>CHƠI LẠI CỤM 10</strong><small>Khôi phục build lúc vào cụm</small></button>'
  +'<button type="button" data-pause-action="restart-run" class="is-danger"><strong>CHƠI LẠI TỪ ĐẦU</strong><small>Xóa run và bắt đầu Wave 01</small></button>'
  +'</nav>'
  +'<div class="bw-pause-build-wrap"><span>BUILD HIỆN TẠI</span><div class="bw-pause-build" id="bw-pause-build"><em>CHƯA CÓ THẺ</em></div></div>'
  +'<p class="bw-pause-note" id="bw-pause-note">Tiến độ được lưu ở đầu mỗi wave. Thoát giữa wave vẫn giữ nguyên snapshot gần nhất.</p>'
  +'</section>';
 deck.append(spatial,top,lower,status,pauseMenu,dataVault);
 decor(deck,'bw-atmosphere','<i class="bw-corner is-tl"></i><i class="bw-corner is-tr"></i><i class="bw-corner is-bl"></i><i class="bw-corner is-br"></i>');
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
 const bossPanel=stage?.querySelector('#r2-boss-panel');
 const tool=stage?.querySelector('#arena-experience-tools');
 if(tool){tool.hidden=true;tool.setAttribute('aria-hidden','true');}
 // HUD truth: 10-wave cluster beats, live pressure budget, wave identity.
 let lastChapter='',lastPressure='',lastBeat=-1,lastGuardState='',lastRank='',lastMomentumText='',readyFlashTimer=0;
 let forecastCacheWave=-1,forecastCache=null,spatialFrame=0,lastSpatialAt=0;
 let lastVitalsSignature='',lastPauseSignature='',pauseMenuOpen=false,pauseConfirmAction='',pauseConfirmTimer=0;
 const beatName=beatCard.querySelector('#bw-beat-name'),beatVerb=beatCard.querySelector('#bw-beat-verb'),
  beatHint=beatCard.querySelector('#bw-beat-hint'),beatKicker=beatCard.querySelector('.bw-beat-kicker'),
  oracleTitle=oracle.querySelector('#bw-oracle-title'),oracleDetail=oracle.querySelector('#bw-oracle-detail'),
  oracleFamilies=oracle.querySelector('#bw-oracle-families'),momentum=hero.querySelector('#bw-momentum'),
  momentumCopy=hero.querySelector('#bw-momentum-copy'),levelValue=hero.querySelector('#bw-level-value'),
  xpRingLabel=hero.querySelector('#bw-xp-ring-label'),minimapMode=threat.querySelector('#bw-minimap-mode'),
  pauseSummary=pauseMenu.querySelector('#bw-pause-summary'),pauseKills=pauseMenu.querySelector('#bw-pause-kills'),
  pauseDamage=pauseMenu.querySelector('#bw-pause-damage'),pauseTime=pauseMenu.querySelector('#bw-pause-time'),
  pauseCardsCount=pauseMenu.querySelector('#bw-pause-cards-count'),pauseBuild=pauseMenu.querySelector('#bw-pause-build'),
  pauseNote=pauseMenu.querySelector('#bw-pause-note'),pauseSaveCopy=pauseMenu.querySelector('#bw-pause-save-copy');
 const pauseButtons=[...pauseMenu.querySelectorAll('[data-pause-action]')];
 for(const button of pauseButtons)button.dataset.label=button.querySelector('strong')?.textContent||'';
 const prefersReducedMotion=!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const resetPauseConfirm=()=>{
  pauseConfirmAction='';
  if(pauseConfirmTimer)window.clearTimeout(pauseConfirmTimer);
  pauseConfirmTimer=0;
  for(const button of pauseButtons){
   button.classList.remove('is-confirming');
   const label=button.querySelector('strong');if(label&&button.dataset.label)label.textContent=button.dataset.label;
  }
 };
 const updatePauseMenu=()=>{
  const pilot=window.BOXE_WAVE_PILOT,s=pilot?.state||{},wave=Math.max(1,Number(s.wave)||1);
  const cluster=Math.floor((wave-1)/10)+1,level=Math.max(1,Number(s.level)||1);
  const stacks=s.stacks&&typeof s.stacks==='object'?Object.entries(s.stacks).filter(([,count])=>Number(count)>0):[];
  const cardTotal=stacks.reduce((sum,[,count])=>sum+(Number(count)||0),0);
  const signature=[wave,level,s.kills||0,Math.round(s.waveDamageDealt||0),Math.floor(s.aliveTime||0),cardTotal,
   s.waveSnapshot?.wave||0,s.clusterSnapshot?.wave||0].join(':');
  setText(pauseSummary,'WAVE '+String(wave).padStart(2,'0')+' · CLUSTER '+String(cluster).padStart(2,'0')+' · LV '+level);
  setText(pauseKills,formatInt(s.kills));
  setText(pauseDamage,formatInt(s.waveDamageDealt));
  const alive=Math.max(0,Math.floor(Number(s.aliveTime)||0));
  setText(pauseTime,String(Math.floor(alive/60)).padStart(2,'0')+':'+String(alive%60).padStart(2,'0'));
  setText(pauseCardsCount,String(cardTotal));
  const savedWave=Number(s.waveSnapshot?.wave)||0,clusterWave=Number(s.clusterSnapshot?.wave)||0;
  setText(pauseSaveCopy,savedWave?'Đã khóa snapshot đầu Wave '+String(savedWave).padStart(2,'0'):'Chưa có snapshot để lưu');
  for(const button of pauseButtons){
   const action=button.dataset.pauseAction;
   button.disabled=action==='save-exit'? !savedWave : action==='replay-wave'? !savedWave : action==='replay-cluster'? !clusterWave : false;
  }
  const replayWaveButton=pauseButtons.find(button=>button.dataset.pauseAction==='replay-wave');
  if(replayWaveButton){
   replayWaveButton.dataset.label=s.autoNextWave&&savedWave?'VÀO WAVE '+String(savedWave).padStart(2,'0'):'CHƠI LẠI WAVE';
   if(pauseConfirmAction!=='replay-wave')setText(replayWaveButton.querySelector('strong'),replayWaveButton.dataset.label);
   setText(replayWaveButton.querySelector('small'),s.autoNextWave?'Bắt đầu ngay từ snapshot wave kế tiếp':'Dùng snapshot đầu wave');
  }
  if(!pauseConfirmAction)setText(pauseNote,savedWave?
   'Thoát lúc này sẽ tiếp tục từ đầu Wave '+savedWave+'. Nếu thua trong cụm, snapshot cụm ở Wave '+clusterWave+' vẫn được giữ nguyên.':
   'Hãy bắt đầu wave đầu tiên để tạo snapshot. Từ thời điểm đó, thoát game không làm mất tiến độ.');
  if(signature===lastPauseSignature)return;
  lastPauseSignature=signature;
  if(!stacks.length){pauseBuild.innerHTML='<em>CHƯA CÓ THẺ</em>';return;}
  pauseBuild.replaceChildren(...stacks.sort((a,b)=>(Number(b[1])||0)-(Number(a[1])||0)||a[0].localeCompare(b[0])).map(([id,count])=>{
   const chip=node('span','bw-pause-chip',String(id).replaceAll('_',' ').toUpperCase()+(Number(count)>1?' ×'+count:''));
   return chip;
  }));
 };
 const syncPauseMenu=()=>{
  const pilot=window.BOXE_WAVE_PILOT,s=pilot?.state||{},modalOpen=!!doc.getElementById('wave-modal')&&!doc.getElementById('wave-modal').hidden;
  const shouldOpen=!!window.handLab?.paused&&['combat','intermission'].includes(s.phase)&&!modalOpen;
  deck.dataset.paused=shouldOpen?'true':'false';
  pause.disabled=modalOpen||!['combat','intermission'].includes(s.phase);
  if(shouldOpen===pauseMenuOpen){if(shouldOpen)updatePauseMenu();return;}
  pauseMenuOpen=shouldOpen;pauseMenu.hidden=!shouldOpen;
  deck.classList.toggle('bw-is-paused',shouldOpen);
  if(shouldOpen){resetPauseConfirm();updatePauseMenu();pauseButtons[0]?.focus?.();}
  else{resetPauseConfirm();if(doc.activeElement&&pauseMenu.contains(doc.activeElement))pause.focus?.();}
 };
 const setPauseFromInterface=open=>{
  const pilot=window.BOXE_WAVE_PILOT;
  if(typeof pilot?.setPaused==='function')pilot.setPaused(!!open);
  else if(window.handLab)window.handLab.paused=!!open;
  syncPauseMenu();
 };
 pause.onclick=event=>{event.preventDefault();setPauseFromInterface(!window.handLab?.paused);};
 pauseMenu.addEventListener('click',event=>{if(event.target===pauseMenu)setPauseFromInterface(false);});
 for(const button of pauseButtons)button.addEventListener('click',()=>{
  const action=button.dataset.pauseAction,pilot=window.BOXE_WAVE_PILOT;
  if(action==='resume'){setPauseFromInterface(false);return;}
  if(action==='save-exit'){
   const result=pilot?.saveAndExit?.();
   if(!result?.saved)setText(pauseNote,'Chưa thể lưu vì snapshot đầu wave chưa tồn tại. Hãy vào wave trước khi thoát.');
   return;
  }
  if(pauseConfirmAction!==action){
   resetPauseConfirm();pauseConfirmAction=action;button.classList.add('is-confirming');
   const label=button.querySelector('strong');if(label)label.textContent='ẤN LẦN NỮA ĐỂ XÁC NHẬN';
   setText(pauseNote,action==='restart-run'?'Hành động này xóa toàn bộ run hiện tại và snapshot đã lưu.':
    action==='replay-cluster'?'Toàn bộ thẻ và tiến triển kiếm được trong cụm hiện tại sẽ bị thu hồi.':
    'Wave hiện tại sẽ bắt đầu lại từ snapshot đầu wave.');
   pauseConfirmTimer=window.setTimeout(()=>{resetPauseConfirm();updatePauseMenu();},3400);
   return;
  }
  resetPauseConfirm();pauseMenuOpen=false;pauseMenu.hidden=true;deck.classList.remove('bw-is-paused');
  if(action==='replay-wave')pilot?.replayWave?.();
  else if(action==='replay-cluster')pilot?.replayCluster?.();
  else if(action==='restart-run')pilot?.restartRun?.();
  syncPauseMenu();
 });
 window.addEventListener('keydown',event=>{
  if(event.code!=='Escape'||event.repeat)return;
  const phase=window.BOXE_WAVE_PILOT?.state?.phase;
  if(!['combat','intermission'].includes(phase))return;
  event.preventDefault();setPauseFromInterface(!window.handLab?.paused);
 });
 const drawMinimap=(lab,s,live)=>{
  const size=minimapCanvas.clientWidth||0;
  if(!size||!lab?.player)return;
  let ctx=null;
  try{ctx=minimapCanvas.getContext('2d');}catch(_){return;}
  if(!ctx)return;
  const dpr=Math.min(2,window.devicePixelRatio||1),pixels=Math.max(2,Math.round(size*dpr));
  if(minimapCanvas.width!==pixels||minimapCanvas.height!==pixels){minimapCanvas.width=pixels;minimapCanvas.height=pixels;}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);
  const cx=size/2,cy=size/2,radius=size/2-8,scale=radius/ARENA_RADIUS,time=Number(lab.time)||0;
  const px=x=>cx+(Number(x)||0)*scale,py=y=>cy+(Number(y)||0)*scale;
  const bg=ctx.createRadialGradient(cx,cy,radius*.08,cx,cy,radius);
  bg.addColorStop(0,'#1b2835');bg.addColorStop(.62,'#101925');bg.addColorStop(1,'#070b12');
  ctx.fillStyle=bg;ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.clip();
  ctx.strokeStyle='rgba(143,232,255,.13)';ctx.lineWidth=1;
  for(const ring of [.32,.58,.84]){ctx.beginPath();ctx.arc(cx,cy,radius*ring,0,Math.PI*2);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(cx-radius,cy);ctx.lineTo(cx+radius,cy);ctx.moveTo(cx,cy-radius);ctx.lineTo(cx,cy+radius);ctx.stroke();
  const quadrant=[0,0,0,0],edges=['top','right','bottom','left'];
  for(const q of s.queue||[]){const i=edges.indexOf(q.edge);if(i>=0)quadrant[i]+=.35+(Number(q.pressure)||0)/260+(q.boss?1.3:0);}
  for(const e of live){const i=Math.abs(e.y||0)>Math.abs(e.x||0)?((e.y||0)<0?0:2):((e.x||0)<0?3:1);quadrant[i]+=.25+(Number(e.wavePressure)||0)/300+(e.waveBoss?1.2:0);}
  const maxQuadrant=Math.max(1,...quadrant);
  ctx.lineCap='round';
  for(let i=0;i<4;i++){
   const load=quadrant[i]/maxQuadrant,center=-Math.PI/2+i*Math.PI/2,span=.22+load*.72;
   ctx.strokeStyle=i===2&&live.some(e=>e.waveBoss)?'rgba(255,89,100,.88)':'rgba(255,187,113,'+(0.18+load*.58)+')';
   ctx.lineWidth=3+load*3;ctx.beginPath();ctx.arc(cx,cy,radius-3,center-span/2,center+span/2);ctx.stroke();
  }
  const cam=lab.cam||lab.player,zoom=Math.max(.1,Number(lab.camZoom)||.875);
  const halfW=(Number(lab.w)||size)/(2*zoom),halfH=(Number(lab.h)||size)/(2*zoom);
  ctx.strokeStyle='rgba(255,243,220,.34)';ctx.lineWidth=1;
  ctx.strokeRect(px((cam.x||0)-halfW),py((cam.y||0)-halfH),halfW*2*scale,halfH*2*scale);
  if(!prefersReducedMotion){
   const sweep=time*.72%(Math.PI*2);
   ctx.fillStyle='rgba(143,232,255,.07)';ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,radius,sweep,sweep+.62);ctx.closePath();ctx.fill();
   ctx.strokeStyle='rgba(143,232,255,.32)';ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(sweep)*radius,cy+Math.sin(sweep)*radius);ctx.stroke();
  }
  const diamond=(x,y,r,fill,stroke)=>{
   ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();
   if(fill){ctx.fillStyle=fill;ctx.fill();}
   if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
  };
  (s.queue||[]).forEach((q,index)=>{const p=spawnPoint(q);diamond(px(p.x),py(p.y),index?2.4:4,index?'':'rgba(143,232,255,.9)',index?'rgba(143,232,255,.42)':'#dff8ff');});
  for(const pack of s.healthPacks||[]){
   const x=px(pack.x),y=py(pack.y);ctx.strokeStyle='#8dffb2';ctx.lineWidth=2;
   ctx.beginPath();ctx.moveTo(x-4,y);ctx.lineTo(x+4,y);ctx.moveTo(x,y-4);ctx.lineTo(x,y+4);ctx.stroke();
  }
  for(const e of live){
   const x=px(e.x),y=py(e.y),color=familyColor(e.waveFamily);
   if(e.waveBoss){ctx.strokeStyle='rgba(255,195,107,.75)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,7+Math.sin(time*6)*1.1,0,Math.PI*2);ctx.stroke();}
   diamond(x,y,e.waveBoss?5.5:3.4,color,'rgba(255,243,220,.86)');
  }
  const player=lab.player,angle=Number.isFinite(player.aim)?player.aim:(Number(player.bodyAngle)||0);
  ctx.save();ctx.translate(px(player.x),py(player.y));ctx.rotate(angle);
  ctx.fillStyle='#fff3dc';ctx.strokeStyle='#ff9b57';ctx.lineWidth=1.4;
  ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-5,-4.5);ctx.lineTo(-2.5,0);ctx.lineTo(-5,4.5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  ctx.strokeStyle='rgba(255,207,139,.34)';ctx.beginPath();ctx.arc(px(player.x),py(player.y),8+Math.sin(time*3.2)*1.2,0,Math.PI*2);ctx.stroke();
  ctx.restore();
  ctx.strokeStyle='rgba(255,207,139,.62)';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='rgba(255,231,194,.78)';ctx.font='600 7px "JetBrains Mono",monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('N',cx,9);ctx.fillText('S',cx,size-9);ctx.fillText('W',9,cy);ctx.fillText('E',size-9,cy);
 };
 const updateSpatial=()=>{
  const pilot=window.BOXE_WAVE_PILOT,lab=window.handLab,s=pilot?.state||{},player=lab?.player;
  if(!pilot||!lab||!player){
   for(const marker of spatialMarkers)marker.style.opacity='0';
   damageWedge.style.opacity='0';healHalo.style.opacity='0';peripheral.style.opacity='0';return;
  }
  const width=spatial.clientWidth||window.innerWidth||lab.w||960,height=spatial.clientHeight||window.innerHeight||lab.h||540;
  const frame=refreshScreenFrame(spatial),frameRight=frame.left+(frame.width||width),frameBottom=frame.top+(frame.height||height);
  const layerRect=spatial.getBoundingClientRect?.(),panelRects=[];
  if(layerRect)for(const el of [hero,center,threat,move,skill,bossPanel]){
   const rect=el?.getBoundingClientRect?.();
   if(rect&&rect.width>0&&rect.height>0)panelRects.push({
    left:rect.left-layerRect.left-7,top:rect.top-layerRect.top-7,
    right:rect.right-layerRect.left+7,bottom:rect.bottom-layerRect.top+7});
  }
  const pointInPanel=point=>panelRects.some(rect=>point.x>=rect.left&&point.x<=rect.right&&point.y>=rect.top&&point.y<=rect.bottom);
  const avoidPanels=point=>{
   const result={x:point.x,y:point.y};
   for(let pass=0;pass<3;pass++)for(const rect of panelRects){
    if(result.x<rect.left||result.x>rect.right||result.y<rect.top||result.y>rect.bottom)continue;
    const exits=[result.x-rect.left,rect.right-result.x,result.y-rect.top,rect.bottom-result.y];
    const side=exits.indexOf(Math.min(...exits));
    if(side===0)result.x=rect.left-4;else if(side===1)result.x=rect.right+4;
    else if(side===2)result.y=rect.top-4;else result.y=rect.bottom+4;
   }
   return result;
  };
  const safe={left:frame.left+62,top:frame.top+38,right:Math.max(frame.left+120,frameRight-62),bottom:Math.max(frame.top+90,frameBottom-38)};
  const playerPoint=worldToScreen(player.x||0,player.y||0);
  const isOffscreen=point=>point.x<frame.left+2||point.x>frameRight-2||point.y<frame.top+2||point.y>frameBottom-2;
  const live=(lab.enemies||[]).filter(e=>!e.dead&&e.waveGunId);
  const entries=[];
  const push=(kind,x,y,main,detail,glyph,family='',options={})=>{
   const point=worldToScreen(x||0,y||0),offscreen=isOffscreen(point),occluded=!offscreen&&pointInPanel(point);
   if(!offscreen&&!occluded&&!options.force)return;
   entries.push({kind,point,main,detail,glyph,family,offscreen,occluded,
    distance:Math.hypot((x||0)-(player.x||0),(y||0)-(player.y||0)),
    meter:Number.isFinite(options.meter)?clamp(options.meter):null,count:Math.max(1,options.count||1)});
  };
  const boss=live.find(e=>e.waveBoss);
  if(boss)push('boss',boss.x,boss.y,boss.waveGunId||'GUARDIAN','BOSS · '+distanceLabel(Math.hypot((boss.x||0)-(player.x||0),(boss.y||0)-(player.y||0)))+' · '+formatInt(boss.hp)+' HP','♛',boss.waveFamily||'',{meter:boss.maxHp?boss.hp/boss.maxHp:null});
  const pack=s.healthPacks?.[0];
  if(pack){
   const remains=Math.max(0,(Number(pack.expiresAt)||0)-(Number(lab.time)||0));
   push('heal',pack.x,pack.y,'+10% HP',distanceLabel(Math.hypot((pack.x||0)-(player.x||0),(pack.y||0)-(player.y||0)))+(remains?' · '+remains.toFixed(1)+'s':''),'+','',{force:true,meter:remains?remains/8:null});
  }
  const next=s.queue?.[0];
  if(next&&s.phase==='combat'){
   const charge=1-clamp((Number(s.spawnT)||0)/Math.max(.18,Number(s.spawnInterval)||.37));
   if(charge>=.18){
    const point=spawnPoint(next);
    push('gate',point.x,point.y,next.gun||'HOSTILE',(next.edge||'gate').toUpperCase()+' GATE · '+((Number(s.spawnT)||0)>0?Math.max(0,Number(s.spawnT)||0).toFixed(1)+'s':'HOLD'),'◆',next.family||'',{meter:charge});
   }
  }
  const hostileCandidates=live.filter(e=>e!==boss).map(e=>{
   const point=worldToScreen(e.x||0,e.y||0),distance=Math.hypot((e.x||0)-(player.x||0),(e.y||0)-(player.y||0));
   const angle=Math.atan2((e.y||0)-(player.y||0),(e.x||0)-(player.x||0));
   const sector=((Math.round(angle/(Math.PI/6))%12)+12)%12;
   const score=(Number(e.wavePressure)||0)+3600/Math.max(160,distance)+(e.waveFamily==='PRECISION'?18:0);
   return {e,point,distance,sector,score,hidden:isOffscreen(point)||pointInPanel(point)};
  }).filter(item=>item.hidden);
  const hostileGroups=new Map();
  for(const item of hostileCandidates){
   if(!hostileGroups.has(item.sector))hostileGroups.set(item.sector,[]);
   hostileGroups.get(item.sector).push(item);
  }
  [...hostileGroups.values()].map(group=>group.sort((a,b)=>b.score-a.score)[0])
   .sort((a,b)=>b.score-a.score).slice(0,5).forEach(item=>{
    const group=hostileGroups.get(item.sector)||[item],e=item.e;
    push('hostile',e.x,e.y,(e.waveGunId||'HOSTILE')+(group.length>1?' +'+(group.length-1):''),
     (FAMILY_SHORT[e.waveFamily]||e.waveFamily||'HOSTILE')+' · '+distanceLabel(item.distance),
     familyGlyph(e.waveFamily),e.waveFamily||'',{force:true,count:group.length,meter:e.maxHp?e.hp/e.maxHp:null});
   });
  spatialMarkers.forEach((marker,index)=>{
   const entry=entries[index];
   if(!entry){marker.style.opacity='0';marker.className='bw-spatial-marker';marker.style.transform='translate3d(-300px,-300px,0)';return;}
   const markerHalfW=clamp(42+entry.main.length*3.2,54,88);
   let point=avoidPanels({
    x:clamp(entry.point.x,Math.max(safe.left,frame.left+markerHalfW+8),Math.min(safe.right,frameRight-markerHalfW-8)),
    y:clamp(entry.point.y,safe.top,safe.bottom)});
   point={x:clamp(point.x,frame.left+24,frameRight-24),y:clamp(point.y,frame.top+20,frameBottom-20)};
   const angle=Math.atan2(entry.point.y-playerPoint.y,entry.point.x-playerPoint.x)*180/Math.PI;
   const scale=entry.kind==='boss'?1.08:entry.offscreen?clamp(1.08-entry.distance/2800,.84,1.08):.82;
   marker.className='bw-spatial-marker is-visible is-'+entry.kind+(entry.offscreen?' is-offscreen':entry.occluded?' is-occluded':' is-onscreen');
   marker.dataset.family=entry.family||'';
   marker.dataset.count=entry.count>1?'+'+(entry.count-1):'';
   marker.style.opacity=entry.offscreen?'1':'.92';
   marker.style.transform='translate3d('+point.x.toFixed(1)+'px,'+point.y.toFixed(1)+'px,0) translate(-50%,-50%) scale('+scale.toFixed(2)+')';
   marker.style.setProperty('--bw-marker-angle',angle.toFixed(1)+'deg');
   const arrowRadians=angle*Math.PI/180,arrowHalfH=entry.kind==='boss'?23:19;
   marker.style.setProperty('--bw-marker-arrow-x',(Math.cos(arrowRadians)*(markerHalfW+7)).toFixed(1)+'px');
   marker.style.setProperty('--bw-marker-arrow-y',(Math.sin(arrowRadians)*(arrowHalfH+7)).toFixed(1)+'px');
   setText(marker.querySelector('.bw-marker-badge'),entry.glyph);
   setText(marker.querySelector('.bw-marker-copy strong'),entry.main);
   setText(marker.querySelector('.bw-marker-copy small'),entry.detail);
   const meter=marker.querySelector('.bw-marker-meter'),fill=meter?.querySelector('i');
   if(meter)meter.style.opacity=entry.meter==null?'0':'1';
   if(fill)fill.style.width=Math.round((entry.meter||0)*100)+'%';
  });
  drawMinimap(lab,s,live);
  const hpPct=player.maxHp?clamp(player.hp/player.maxHp):1;
  peripheral.style.opacity=String(player.hp>0&&hpPct<=.35?.32+.68*(1-hpPct/.35):0);
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
  const newChapter='CLUSTER '+String(cluster).padStart(2,'0')+' · '+(beat+1)+'/10';
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
  const text=s.autoNextWave?'NEXT '+Math.max(1,Math.ceil(s.nextWaveT||0))+'s':
   active+' LIVE · '+queued+' IN · '+Math.round(activePressure)+'/'+Math.round(budget);
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
  const level=Math.max(1,Math.floor(Number(s.level)||1)),xpNeed=xpThreshold(pilot,level),xpPct=clamp((Number(s.xp)||0)/Math.max(1,xpNeed));
  const furyPct=s.empowered?1:clamp((Number(s.passiveProgress)||0)/300),ignited=!!s.empowered||!!s.passiveReady||furyPct>=.999;
  const vitalsSignature=[level,Math.floor(Number(s.xp)||0),xpNeed,Math.round(furyPct*100),ignited?'hot':'cold'].join(':');
  if(vitalsSignature!==lastVitalsSignature){
   lastVitalsSignature=vitalsSignature;
   levelCore.style.setProperty('--bw-xp',xpPct.toFixed(3));
   hero.style.setProperty('--bw-fury',furyPct.toFixed(3));
   setText(levelValue,String(level));
   const xpCopy=formatInt(s.xp)+' / '+formatInt(xpNeed)+' XP';
   setText(xpRingLabel,xpCopy.length<=12?xpCopy:Math.round(xpPct*100)+'% XP');
  }
  hero.classList.toggle('bw-is-ignited',ignited);
  hero.dataset.furyState=s.empowered?'empowered':ignited?'ready':furyPct>=.66?'surging':furyPct>=.33?'warming':'cold';
  deck.style.setProperty('--bw-low-hp',(player.hp>0&&hpPct<=.35?1-hpPct/.35:0).toFixed(3));
  const kills=Number(s.waveKills)||0,dealt=Number(s.waveDamageDealt)||0,taken=Number(s.waveDamageReceived)||0;
  const totalHostiles=kills+active+queued,progress=totalHostiles?kills/totalHostiles:(breather&&n?1:0);
  const momentumScore=clamp(progress*.38+Math.min(.28,dealt/3800)+hpPct*.18+(s.empowered?.16:0)-Math.min(.3,taken/1300));
  const rank=momentumScore>=.82?'S':momentumScore>=.62?'A':momentumScore>=.42?'B':momentumScore>=.22?'C':'D';
  const momentumText='MOMENTUM · '+(breather?'WAVE SEALED':rank==='S'?'APEX FORM':rank==='A'?'SURGING':rank==='B'?'CONTROL':rank==='C'?'BUILDING':'UNDER FIRE');
  if(momentum&&(rank!==lastRank||momentumText!==lastMomentumText)){
   momentum.dataset.rank=rank;setText(momentum,rank);
   momentum.title=momentumText;setText(momentumCopy,momentumText);
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
  const nextGate=s.queue?.[0];
  threat.dataset.intelMode=live.length||queued?'live':'forecast';
  setText(minimapMode,bossLive?'BOSS':breather?'NEXT GATE':danger>=.82?'RED ZONE':'LIVE');
  setText(minimapNext,nextGate?
   (nextGate.edge||'gate').toUpperCase()+' · '+(nextGate.gun||'HOSTILE')+' · '+((Number(s.spawnT)||0)>0?Math.max(0,Number(s.spawnT)||0).toFixed(1)+'s':'HOLD'):
   breather?'WAVE '+String(forecastWave).padStart(2,'0')+' · '+Math.max(1,Math.ceil(s.nextWaveT||0))+'s':
   active?'ARENA LIVE':'GATES QUIET');
  const guardState=s.guardHeld?'held':(s.guardCdT>0?'cooling':'ready');
  deck.dataset.guard=guardState;
  if(lastGuardState==='cooling'&&guardState==='ready'){
   const guardButton=actions.querySelector('[data-act="K"]');
   if(guardButton){guardButton.classList.add('bw-ready-flash');
    if(readyFlashTimer)window.clearTimeout(readyFlashTimer);
    readyFlashTimer=window.setTimeout(()=>guardButton.classList.remove('bw-ready-flash'),520);}
  }
  lastGuardState=guardState;
  status.dataset.kind=(Number(s.waveToastT)>0&&s.waveToast)?'toast':'hint';
  syncPauseMenu();
  updateSpatial();
 };
 const spatialLoop=timestamp=>{
  if(!lastSpatialAt||timestamp-lastSpatialAt>=33){try{updateSpatial();}catch(_){}lastSpatialAt=timestamp;}
  spatialFrame=window.requestAnimationFrame(spatialLoop);
 };
 update();
 if(typeof window.requestAnimationFrame==='function')spatialFrame=window.requestAnimationFrame(spatialLoop);
 refresh=window.setInterval(update,90);
 window.addEventListener('pagehide',()=>{if(refresh)clearInterval(refresh);if(spatialFrame)window.cancelAnimationFrame?.(spatialFrame);if(readyFlashTimer)clearTimeout(readyFlashTimer);if(pauseConfirmTimer)clearTimeout(pauseConfirmTimer);},{once:true});
 installed=true;
 window.APEX_BOT_WAVE_INTERFACE_V2=Object.freeze({installed:true,version:VERSION,
  openPauseMenu:()=>setPauseFromInterface(true),closePauseMenu:()=>setPauseFromInterface(false),
  togglePauseMenu:()=>setPauseFromInterface(!window.handLab?.paused)});
 doc.documentElement.dataset.botWavePresentation='gold-v2';
 return true;
}
if(!install()){
 const watch=new MutationObserver(()=>{if(install())watch.disconnect()});
 watch.observe(doc.documentElement,{subtree:true,childList:true});
 window.setTimeout(()=>watch.disconnect(),25000);
}
})(window);
