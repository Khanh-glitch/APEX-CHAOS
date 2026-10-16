/* BOT WAVE R2 — standalone cinematic interface. We MOVE live Gold
 * controls and meters without cloning/removing their IDs or event handlers.
 * The owner Gold character/glove/VFX/audio engine is not touched.
 */
(function(window){
'use strict';
const doc=window.document;
if(window.APEX_BOT_WAVE_INTERFACE_V2)return;
const VERSION='owner-release-r6';
// Existing BOXE baseline was x1.5; owner requests another +30% -> x1.95.
 // Arsenal's compressor/voice-density mix follows this shared mode policy.
 const AUDIO_MIX=Object.freeze({boxe:1.95,weapons:.36});
function installWaveAudioMix(){
 window.APEX_BOT_WAVE_AUDIO_MIX=AUDIO_MIX;
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
 const wave=node('div','bw-wave-line');
 wave.innerHTML='<span class="bw-witness">SURVIVE</span>';
 const pressure=node('div','bw-pressure');
 pressure.innerHTML='<span>HOSTILE PRESSURE</span><strong id="bw-pressure-label">STANDBY</strong><i id="bw-pressure-fill"></i>';
 center.append(pressure);
 const centerSegment=node('div','bw-beat-markers');
 centerSegment.id='bw-beat-markers';
 for(let i=0;i<5;i++){const segment=node('i');segment.setAttribute('aria-label','Nhịp '+(i+1));centerSegment.append(segment);}
 center.append(chapter,wave,centerSegment);
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
 // HUD truth: chapter, five dramatic beats, wave identity. No 10-wave cap.
 let lastChapter='',lastPressure='',lastBeat=-1;
 const update=()=>{
  const pilot=window.BOXE_WAVE_PILOT;
  if(!pilot)return;
  const s=pilot.state||{},n=Math.max(1,s.wave||1);
  const count=Math.floor((n-1)/5)+1,beat=(n-1)%5;
  const newChapter='CHAPTER '+String(count).padStart(2,'0')+'  //  ARSENAL SURVIVAL';
  if(newChapter!==lastChapter){chapter.textContent=newChapter;lastChapter=newChapter;}
  center.classList.toggle('bw-is-boss',beat===4);
  center.classList.toggle('bw-is-upgrade',s.phase==='upgrade');
  if(beat!==lastBeat){for(const [i,el] of [...centerSegment.children].entries()){
   el.classList.toggle('done',i<beat);el.classList.toggle('active',i===beat);
  }lastBeat=beat;}
  const phase=doc.querySelector('.bw-witness');
  if(phase)phase.textContent=beat===4?'BOSS ROUND':s.phase==='combat'?'IN COMBAT':
   s.phase==='upgrade'?'UPGRADE':'SURVIVE';
  const active=window.handLab?.enemies?.filter(e=>!e.dead&&e.waveGunId).length||0;
  const queued=s.queue?.length||0;
  const cap=Math.max(1,s.softCap||5);
  const danger=Math.min(1,active/cap);
  const text=active+' ACTIVE  /  '+queued+' INBOUND';
  if(text!==lastPressure){pressure.querySelector('strong').textContent=text;lastPressure=text;}
  pressure.style.setProperty('--bw-pressure',danger.toFixed(3));
  center.classList.toggle('bw-under-pressure',active>=cap);
  hero.classList.toggle('bw-took-hit',left.classList.contains('r2-damaged'));
  deck.dataset.phase=s.phase||'intro';
 };
 update();
 refresh=window.setInterval(update,170);
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
