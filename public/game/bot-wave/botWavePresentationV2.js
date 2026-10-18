/* BOT WAVE R2 — standalone cinematic interface. We MOVE live Gold
 * controls and meters without cloning/removing their IDs or event handlers.
 * The owner Gold character/glove/VFX/audio engine is not touched.
 */
(function(window){
'use strict';
const doc=window.document;
if(window.APEX_BOT_WAVE_INTERFACE_V2)return;
const VERSION='owner-release-r10-seamless-hud';
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
 heroLabel.innerHTML='<span class="bw-eyebrow">APEX  /  THE LAST ROUND</span><strong>BOXE</strong><span class="bw-subtitle">THE FIST OF DAWN</span>';
 const portrait=node('img','bw-portrait');
 portrait.src='/assets/dictionary/heroes/boxe/avatar.png';
 portrait.alt='BOXE';
 portrait.decoding='async';
 hero.append(portrait,heroLabel,left);
 const center=node('section','bw-encounter');
 center.setAttribute('aria-label','Tình hình trận BOT WAVE');
 const chapter=node('div','bw-chapter');
 chapter.id='bw-chapter';
 chapter.textContent='CHAPTER 01  //  ARSENAL SURVIVAL';
 const waveNumber=node('div','bw-wave-number','WAVE 01');
 const wave=node('div','bw-wave-line');
 wave.innerHTML='<span class="bw-witness">SURVIVE</span>';
 const pressure=node('div','bw-pressure');
 pressure.innerHTML='<span>HOSTILE PRESSURE</span><strong id="bw-pressure-label">STANDBY</strong><i id="bw-pressure-fill"></i>';
 // The meter sits BELOW the wave identity instead of stealing the headline.
 const centerSegment=node('div','bw-beat-markers');
 centerSegment.id='bw-beat-markers';
 for(let i=0;i<10;i++){const segment=node('i');segment.setAttribute('aria-label','Wave trong cụm '+(i+1));centerSegment.append(segment);}
 center.append(chapter,waveNumber,wave,pressure,centerSegment);
 const threat=node('section','bw-threat');
 threat.setAttribute('aria-label','Trang bị và kẻ địch');
 const threatEyebrow=node('div','bw-threat-eyebrow','HOSTILE CONTACT  //  ROBOT UNITS');
 threat.append(threatEyebrow,right);
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
 const interfaceControls=node('div','bw-interface-controls');
 interfaceControls.append(pause,status);
 lower.append(move,skill,interfaceControls);
 deck.append(top,lower);
 hud.replaceChildren(deck);
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
 const oldTrack=stage?.querySelector('#arena-round-track');
 if(oldTrack){oldTrack.setAttribute('aria-hidden','true');oldTrack.hidden=true;}
 const tool=stage?.querySelector('#arena-experience-tools');
 if(tool){tool.hidden=true;tool.setAttribute('aria-hidden','true');}
 // HUD truth: 10-wave cluster beats, live pressure budget, wave identity.
 let lastChapter='',lastPressure='',lastBeat=-1;
 const update=()=>{
  const pilot=window.BOXE_WAVE_PILOT;
  if(!pilot)return;
  const s=pilot.state||{},n=Math.max(1,s.wave||1);
  const cluster=Math.floor((n-1)/10)+1,beat=(n-1)%10,bossBeat=beat===9;
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
  const enemies=window.handLab?.enemies||[];
  const live=enemies.filter(e=>!e.dead&&e.waveGunId);
  const active=live.length;
  const queued=s.queue?.length||0;
  const activePressure=live.reduce((sum,e)=>sum+(Number(e.wavePressure)||0),0);
  const budget=Math.max(1,Number(s.pressureBudget)||260);
  const danger=s.autoNextWave?0:Math.min(1,activePressure/budget||active/Math.max(1,s.softCap||5));
  const text=s.autoNextWave?'NEXT IN '+Math.max(1,Math.ceil(s.nextWaveT||0))+'s':
   active+' ACTIVE  /  '+queued+' INBOUND  /  '+Math.round(activePressure)+'/'+Math.round(budget);
  if(text!==lastPressure){pressure.querySelector('strong').textContent=text;lastPressure=text;}
  pressure.style.setProperty('--bw-pressure',danger.toFixed(3));
  center.classList.toggle('bw-under-pressure',danger>=.82);
  hero.classList.toggle('bw-took-hit',left.classList.contains('r2-damaged'));
  hero.classList.toggle('bw-is-low',left.classList.contains('is-low'));
  deck.dataset.phase=s.autoNextWave?'wave-clear':(s.phase||'intro');
  deck.dataset.guard=s.guardHeld?'held':(s.guardCdT>0?'cooling':'ready');
 };
 update();
 refresh=window.setInterval(update,90);
 window.addEventListener('pagehide',()=>{if(refresh)clearInterval(refresh);},{once:true});
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
