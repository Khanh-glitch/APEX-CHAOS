/* Quest Q4E3 — cinematic-story presentation. Quest-only, opt-in.
 * Uses true live Arsenal canvas stills; NEVER manufactures combat art/hits,
 * story completion, actor dialogue, saves, or cooldown changes.
 * Every cue is owned by the real Q4E receipt queue, not by a timer.
 */
(function installQuestStoryPresentation(root){
 'use strict';
 if(root.APEX_QUEST_STORY_PRESENTATION)return;
 const STYLE=[
 '#apexQuestStoryView{position:fixed;inset:0;z-index:11000;display:grid;place-items:end center;color:#f4eee1;isolation:isolate;font-family:Bahnschrift,"Arial Narrow",Arial,sans-serif;overflow:hidden;background:linear-gradient(0deg,#030506e8 0%,#05070ad1 34%,#05070a88 100%);pointer-events:auto}',
 '#apexQuestStoryView[hidden]{display:none!important}',
 '#apexQuestStoryView::before{content:"";pointer-events:none;position:absolute;inset:0;opacity:.43;background:repeating-linear-gradient(0deg,transparent 0,transparent 3px,#ffffff08 4px);mix-blend-mode:screen}',
 '#apexQuestStoryView .qs-body{position:relative;width:min(1120px,100%);max-height:100%;padding:clamp(12px,2.3vw,32px) max(14px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom));display:grid;grid-template-rows:auto minmax(100px,1fr) auto;gap:clamp(9px,1.7vh,20px);animation:qsFade .42s ease-out both}',
 '@keyframes qsFade{from{opacity:.2}to{opacity:1}}',
 '#apexQuestStoryView .qs-top{display:flex;align-items:end;justify-content:space-between;gap:14px;padding:0 2px}',
 '#apexQuestStoryView .qs-episode{font:900 clamp(10px,1vw,12px)/1.1 Arial,sans-serif;letter-spacing:.27em;color:#e8a855}',
 '#apexQuestStoryView .qs-chapter{margin-top:6px;font:900 clamp(22px,4vw,40px)/.9 Impact,"Arial Narrow",sans-serif;letter-spacing:.04em;text-transform:uppercase}',
 '#apexQuestStoryView .qs-marker{font:700 11px/1.2 Arial,sans-serif;letter-spacing:.2em;color:#b6b0a4;text-align:right}',
 '#apexQuestStoryView .qs-comic{min-height:0;display:grid;grid-template-columns:1.6fr 1fr;gap:clamp(5px,1vw,12px);height:clamp(138px,42vh,435px);max-height:42dvh;animation:qsArtRise .42s cubic-bezier(.16,.88,.25,1) both}',
 '@keyframes qsArtRise{from{transform:translateY(20px) scale(.99)}to{transform:translateY(0) scale(1)}}',
 '#apexQuestStoryView .qs-shot{min-width:0;min-height:0;position:relative;overflow:hidden;border:1px solid #ac7d45;background:radial-gradient(circle at 55% 70%,#38312a,#080c10 70%);box-shadow:0 4px 28px #000b;clip-path:polygon(0 0,100% 0,100% 96%,97% 100%,0 100%)}',
 '#apexQuestStoryView .qs-shot canvas{width:100%;height:100%;object-fit:cover;filter:contrast(1.16) saturate(.8) brightness(.77);display:block}',
 '#apexQuestStoryView .qs-shot--detail canvas{transform:scale(1.6) rotate(-1deg);filter:contrast(1.25) saturate(.6) brightness(.9)}',
 '#apexQuestStoryView .qs-shot:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#0007,transparent 35%,#030506cc);pointer-events:none}',
 '#apexQuestStoryView .qs-shot::before{content:"";position:absolute;z-index:2;top:0;left:0;width:38%;height:3px;background:#ffaf45;box-shadow:0 0 16px #ed9c35}',
 '#apexQuestStoryView .qs-chip{position:absolute;z-index:4;bottom:10px;left:12px;font:900 clamp(15px,2vw,26px)/1 Impact,"Arial Narrow",sans-serif;letter-spacing:.1em;text-shadow:0 2px 12px #000}',
 '#apexQuestStoryView .qs-frame{font:800 10px Arial,sans-serif;letter-spacing:.15em;position:absolute;z-index:4;right:9px;top:10px;color:#f1c990}',
 '#apexQuestStoryView.qs-workshop{background:#010204}',
 '#apexQuestStoryView.qs-workshop::after{content:"";position:absolute;z-index:10;inset:0;background:#000;pointer-events:none;animation:qsBlackout .95s ease-out both}',
 '@keyframes qsBlackout{0%,42%{opacity:1}100%{opacity:0}}',
 '#apexQuestStoryView .qs-footer{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;padding:clamp(12px,2.2vw,26px);background:linear-gradient(105deg,#18191dec,#0b0e12ef);border:1px solid #62543e;border-left:4px solid #d79541;box-shadow:0 8px 32px #0008}',
 '#apexQuestStoryView .qs-kicker{font:800 10px Arial,sans-serif;letter-spacing:.23em;color:#e0a653;margin-bottom:7px}',
 '#apexQuestStoryView .qs-line{font:800 clamp(18px,3.1vw,36px)/1.12 Impact,"Arial Narrow",sans-serif;letter-spacing:.035em;overflow-wrap:anywhere;max-width:55ch}',
 '#apexQuestStoryView .qs-controls{display:flex;align-items:center;gap:8px}',
 '#apexQuestStoryView button{font:800 12px Arial,sans-serif;letter-spacing:.09em;min-height:48px;min-width:104px;padding:10px 16px;border:1px solid #bb905b;background:#bd8640;color:#070707;cursor:pointer;touch-action:manipulation}',
 '#apexQuestStoryView button.qs-skip{color:#d4c5ac;border-color:#665c4c;background:#171c21}',
 '#apexQuestStoryView button:focus-visible{outline:3px solid #f8d29c;outline-offset:3px}',
 '@media(max-width:620px){#apexQuestStoryView .qs-body{width:100%;padding:12px max(10px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));gap:9px}#apexQuestStoryView .qs-comic{height:clamp(125px,30dvh,310px);max-height:30dvh;grid-template-columns:1.3fr .8fr}#apexQuestStoryView .qs-footer{grid-template-columns:1fr;gap:12px;padding:14px}#apexQuestStoryView .qs-controls{justify-content:flex-end}#apexQuestStoryView button{min-height:44px;min-width:98px}#apexQuestStoryView .qs-chip{font-size:15px}}',
 '@media(max-height:470px){#apexQuestStoryView .qs-body{grid-template-rows:auto minmax(68px,1fr) auto;padding:7px max(9px,env(safe-area-inset-right)) 7px max(9px,env(safe-area-inset-left));gap:6px}#apexQuestStoryView .qs-comic{height:24dvh;max-height:24dvh}#apexQuestStoryView .qs-footer{padding:9px;gap:8px}#apexQuestStoryView .qs-chapter{font-size:21px}#apexQuestStoryView .qs-line{font-size:18px}#apexQuestStoryView button{min-height:37px}}',
 '@media(prefers-reduced-motion:reduce){#apexQuestStoryView .qs-body,#apexQuestStoryView .qs-comic,#apexQuestStoryView.qs-workshop::after{animation:none}#apexQuestStoryView.qs-workshop::after{opacity:0}}'
 ].join('\n');
 const LABEL=Object.freeze({
  // Canon only: SCRAP BASIN is the approved disposal site. No invented
  // RIVET dialogue, new network exposition or false combat receipt.
  WAKE_OPEN:{title:'WAKE',left:'NEWBOT',right:'SCRAP BASIN',
    line:'SCRAP BASIN',kicker:'THE ONES THROWN AWAY'},
  E01_R1_IMPACT:{title:'REFLEX',left:'NEWBOT',right:'T.O.T',line:'FIRST IMPACT',kicker:'PISTOL // CONTACT'},
  E01_R2_IMPACT:{title:'REFLEX',left:'T.O.T',right:'NEWBOT',line:'RETURN FIRE',kicker:'PISTOL // RETALIATION'},
  E01_J_REVEAL:{title:'UNKNOWN ROUTINE',left:'NEWBOT',right:'A1',line:'UNKNOWN ROUTINE — J',kicker:'ROUTINE DETECTED'},
  E01_K_REVEAL:{title:'SECOND ROUTINE',left:'NEWBOT',right:'A2',line:'K',kicker:'NEW COMMAND'},
  E01_RIVET_HOLD:{title:'REFLEX',left:'NEWBOT',right:'T.O.T',line:'COMBAT INTERRUPTED',kicker:'BOTH FIGHTERS // HOLD'},
  E01_RIVET_SUPPRESSION_TECH:{title:'STORMBREAKER',left:'RIVET',right:'SCRAP BASIN',line:'GROUND SUPPRESSION',kicker:'REAL FLOOR CONTACT // 0 ALLY DAMAGE'},
  WORKSHOP_ARRIVAL:{title:'THREE FAILURES',left:'NEWBOT',right:'T.O.T + RIVET',line:'NO VALID NETWORK ID',kicker:'WORKSHOP // NETWORK IDENTITIES'},
  E02_FIRST_WAKE_CLEAR:{title:'FIRST WAKE',left:'NEWBOT + T.O.T',right:'SCRAP BOTS',
    line:'SURVIVED',kicker:'TWO HOSTILES // KO CONFIRMED'},
  E02_FIRST_WAKE_RETRY:{title:'FIRST WAKE',left:'NEWBOT',right:'SCRAP BOTS',
    line:'NEWBOT DOWN',kicker:'RETRY // CHECKPOINT'},
  E03_SCRAP_SWARM_CLEAR:{title:'SCRAP SWARM',left:'NEWBOT',right:'SCRAP BASIN',
    line:'SEVEN CONTACTS CLEARED',kicker:'WAVE 02 / 02 · REAL KO VERIFIED'},
  E03_SCRAP_SWARM_RETRY:{title:'SCRAP SWARM',left:'NEWBOT',right:'SCRAP BASIN',
    line:'SIGNAL LOST',kicker:'NEWBOT KO · RETRY CHECKPOINT'}
 });
 const singleton={style:null};
 function ensureStyle(doc){
  if(doc.getElementById('apexQuestStoryViewStyle'))return;
  const el=doc.createElement('style');el.id='apexQuestStoryViewStyle';el.textContent=STYLE;doc.head.appendChild(el);singleton.style=el;
 }
 function create(options={}){
  const doc=options.document||root.document;
  if(!doc?.body||!doc.createElement) return Object.freeze({
   offer:()=>false,active:()=>false,next:()=>false,skip:()=>false,
   close:()=>{},snapshot:()=>({active:false,closed:true})
  });
  ensureStyle(doc);
  let host=null,activeId=null,closed=false,previousFocus=null;
  const shown=[],skipped=[];
  const advance=typeof options.onAdvance==='function'?options.onAdvance:()=>{};
  const e=(type,cls,txt)=>{const x=doc.createElement(type);if(cls)x.className=cls;if(txt)x.textContent=txt;return x};
  const source=()=>doc.getElementById('game-canvas');
  function still(canvas){
   const src=source();const ctx=canvas.getContext?.('2d');
   if(!src||!ctx||!src.width||!src.height)return false;
   canvas.width=src.width;canvas.height=src.height;
   try{ctx.drawImage(src,0,0);return true;}catch(_){return false;}
  }
  function keyDown(ev){
   if(!activeId)return;
   // The entire scene owns input until acknowledgement. J/K, Escape to
   // battle exit and all other hotkeys must not reach the combat executor.
   if(ev.key==='Tab')return;
   ev.preventDefault();ev.stopImmediatePropagation?.();
   if(ev.key==='Escape')skip();
   else if(ev.key==='Enter'||ev.key===' ')next();
  }
  function createUI(cue){
   const meta=LABEL[cue.id];if(!meta)return null;
   const layer=e('section','','');layer.id='apexQuestStoryView';layer.dataset.beat=cue.id;
   if(cue.id==='WORKSHOP_ARRIVAL')layer.classList.add('qs-workshop');
   layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label','Quest story scene');
   const body=e('div','qs-body'),top=e('div','qs-top'),head=e('div','');
   head.append(e('div','qs-episode','QUEST 01 · THE ONES THROWN AWAY'),e('div','qs-chapter',meta.title));
   top.append(head,e('div','qs-marker','STORY · '+String(shown.length).padStart(2,'0')));
   const comic=e('div','qs-comic');
   for(const [i,name] of [meta.left,meta.right].entries()){
    const shot=e('div','qs-shot'+(i===1?' qs-shot--detail':''));
    const picture=e('canvas','');picture.setAttribute('aria-hidden','true');still(picture);
    shot.append(picture,e('div','qs-chip',name),e('span','qs-frame','0'+(i+1)));
    comic.appendChild(shot);
   }
   const footer=e('div','qs-footer'),words=e('div','');
   words.append(e('div','qs-kicker',meta.kicker),e('div','qs-line',meta.line));
   const controls=e('div','qs-controls'),skip=e('button','qs-skip','SKIP BEAT'),
    cont=e('button','','CONTINUE ›');
   skip.type=cont.type='button';skip.addEventListener('click',()=>finish(true));
   cont.addEventListener('click',()=>finish(false));
   controls.append(skip,cont);footer.append(words,controls);body.append(top,comic,footer);layer.append(body);
   return {layer,cont};
  }
  function finish(wasSkipped){
   if(!activeId||closed)return false;
   const old=activeId;activeId=null;
   if(wasSkipped)skipped.push(old);
   doc.removeEventListener('keydown',keyDown,true);
   host?.remove();host=null;
   try{if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}catch(_){}
   previousFocus=null;
   // The callback may show the next already-proven queued scene.
   advance(old,wasSkipped);
   return true;
  }
  function offer(cue){
   if(closed||activeId||!cue?.id||!LABEL[cue.id])return false;
   activeId=cue.id;shown.push(cue.id);
   previousFocus=doc.activeElement;
   const ui=createUI(cue);if(!ui){activeId=null;return false;}
   host=ui.layer;doc.body.appendChild(host);
   doc.addEventListener('keydown',keyDown,true);
   ui.cont.focus({preventScroll:true});return true;
  }
  function close(){
   if(closed)return;closed=true;activeId=null;
   doc.removeEventListener('keydown',keyDown,true);
   host?.remove();host=null;previousFocus=null;
  }
  return Object.freeze({offer,active:()=>activeId!==null,next:()=>finish(false),
   skip:()=>finish(true),close,snapshot:()=>Object.freeze({
    active:activeId!==null,current:activeId,shown:shown.slice(),skipped:skipped.slice(),closed
   })});
 }
 root.APEX_QUEST_STORY_PRESENTATION=Object.freeze({create});
 root.apexQuestStoryPresentation='ready';
})(typeof window!=='undefined'?window:globalThis);
