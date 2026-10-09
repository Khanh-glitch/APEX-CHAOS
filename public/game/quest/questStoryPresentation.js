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
 // Q5 visual acceptance: the HUD/legacy K.O. belongs to an earlier scene.
 // Cover it completely; only these unaltered live-Arsenal stills are shown.
 '#apexQuestStoryView{place-items:center;background:radial-gradient(ellipse at 64% 24%,#302315,#06080b 62%,#030406);}',
 '#apexQuestStoryView::before{opacity:.19;mix-blend-mode:normal}',
 '#apexQuestStoryView .qs-body{max-height:96dvh;max-width:1140px;padding:clamp(12px,2vw,25px);}',
 '#apexQuestStoryView .qs-comic{height:clamp(190px,44dvh,480px);max-height:45dvh;grid-template-columns:1.35fr 1fr;}',
 '#apexQuestStoryView .qs-shot{border:1px solid #af8447;box-shadow:0 13px 46px #000b,0 0 0 1px #d9a24d20 inset;}',
 '#apexQuestStoryView .qs-shot canvas{object-fit:cover;filter:contrast(1.15) saturate(.92) brightness(.94)}',
 '#apexQuestStoryView .qs-shot--detail canvas{transform:none;filter:contrast(1.18) saturate(.74) brightness(.83)}',
 '#apexQuestStoryView .qs-chapter{font-size:clamp(27px,5vw,53px)}',
 '#apexQuestStoryView .qs-footer{background:linear-gradient(100deg,#242015,#0c1014 67%);border-left-color:#f0ae54;}',
 '#apexQuestStoryView .qs-controls button{transition:transform .16s,filter .16s;}',
 '#apexQuestStoryView .qs-controls button:hover{filter:brightness(1.12)}',
 '#apexQuestStoryView .qs-controls button:active{transform:scale(.98)}',
 '#apexQuestStoryView.qs-finale .qs-chapter{font-size:clamp(32px,6vw,66px)}',
 '#apexQuestStoryView.qs-finale .qs-comic{height:clamp(240px,49dvh,540px);max-height:50dvh;}',
 '#apexQuestStoryView.qs-finale .qs-footer{border-left-width:6px;box-shadow:0 15px 55px #000c}',
 '#apexQuestStoryView.qs-finale .qs-line{font-size:clamp(26px,4vw,49px);line-height:1.03}',
 '#apexQuestStoryView .qs-stats{margin:9px 0 0;color:#d3c9b6;font:800 12px/1.3 Bahnschrift,Arial,sans-serif;letter-spacing:.12em}',
 '@media(max-width:620px){#apexQuestStoryView .qs-body{padding:max(12px,env(safe-area-inset-top)) max(11px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(11px,env(safe-area-inset-left));max-height:96dvh}#apexQuestStoryView .qs-comic{height:clamp(158px,34dvh,315px);max-height:34dvh}#apexQuestStoryView.qs-finale .qs-comic{grid-template-columns:1fr;height:clamp(220px,43dvh,465px);max-height:43dvh}#apexQuestStoryView.qs-finale .qs-shot--detail{display:none}#apexQuestStoryView.qs-finale .qs-footer{gap:8px;padding:14px}#apexQuestStoryView.qs-finale .qs-line{font-size:clamp(25px,6.5vw,42px)}#apexQuestStoryView .qs-controls{justify-content:flex-end}#apexQuestStoryView button{min-width:92px}}',
 '@media(max-height:470px){#apexQuestStoryView .qs-body{max-height:100dvh;padding:5px 10px}#apexQuestStoryView.qs-finale .qs-comic{height:23dvh;max-height:23dvh;grid-template-columns:1.35fr 1fr}#apexQuestStoryView.qs-finale .qs-shot--detail{display:block}#apexQuestStoryView.qs-finale .qs-line{font-size:20px}}',
 '@media(prefers-reduced-motion:reduce){#apexQuestStoryView .qs-body,#apexQuestStoryView .qs-comic,#apexQuestStoryView.qs-workshop::after{animation:none}#apexQuestStoryView.qs-workshop::after{opacity:0}#apexQuestStoryView button{transition:none}}'
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
  E01_RIVET_SUPPRESSION_TECH:{title:'STORMBREAKER',left:'RIVET',right:'SCRAP BASIN',line:'GROUND SUPPRESSION',kicker:'STORMBREAKER // GROUND CONTACT'},
  WORKSHOP_ARRIVAL:{title:'THREE FAILURES',left:'NEWBOT',right:'T.O.T + RIVET',line:'NO VALID NETWORK ID',kicker:'WORKSHOP // NETWORK IDENTITIES'},
  E02_FIRST_WAKE_CLEAR:{title:'FIRST WAKE',left:'NEWBOT + T.O.T',right:'SCRAP BOTS',
    line:'THE PERIMETER HOLDS',kicker:'TWO SCOUTS DEFEATED · MORE CONTACTS AHEAD'},
  E02_FIRST_WAKE_RETRY:{title:'FIRST WAKE',left:'NEWBOT',right:'SCRAP BOTS',
    line:'NEWBOT DOWN',kicker:'RETRY // CHECKPOINT'},
  E03_SCRAP_SWARM_CLEAR:{title:'SCRAP SWARM',left:'NEWBOT',right:'SCRAP BASIN',
    line:'TWO WAVES STOPPED',kicker:'SEVEN HOSTILES DOWN · THE WEAPON CYCLE CHANGES'},
  E03_SCRAP_SWARM_RETRY:{title:'SCRAP SWARM',left:'NEWBOT',right:'SCRAP BASIN',
    line:'SIGNAL LOST',kicker:'NEWBOT KO · RETRY CHECKPOINT'},
  E04_WEAPON_RAIN_CLEAR:{title:'WEAPON RAIN',left:'NEWBOT',right:'TWO HOSTILES',
    line:'TWO HOSTILES DOWN',kicker:'IMPACT ACCUMULATOR · THE NEXT OBJECTIVE'},
  E04_WEAPON_RAIN_RETRY:{title:'WEAPON RAIN',left:'NEWBOT',right:'SCRAP BASIN',
    line:'SIGNAL LOST',kicker:'RETRY · CHECKPOINT PRESERVED'},
  E05_BREAKER_CHARGE_CLEAR:{title:'CHARGE THE BREAKER',left:'NEWBOT',right:'IMPACT ACCUMULATOR',
    line:'RELAY ANSWERS',kicker:'6000 ACCEPTED IMPACT · INFRASTRUCTURE PULSE SENT'},
  // These are UI/system captions, not newly invented canonical dialogue.
  E06_RIG_LOCK:{title:'BREACH WAVES',left:'NEWBOT + T.O.T',right:'RIVET',
    line:'RIG LOCK · FRONTLINE HANDOFF',kicker:'RIVET LEAVES THE CONTROL RIG · NO AUTOMATIC OPERATOR'},
  E06_BREACH_CLEAR:{title:'BREACH WAVES',left:'NEWBOT · T.O.T · RIVET',right:'SCRAP BASIN',
    line:'THREE WAVES HALTED',kicker:'SCRAP BASIN · THE RELAY ANSWERS'},
  E06_RELAY_REPLY:{title:'RELAY RESPONSE',left:'SCRAP BASIN',right:'DISTANT NETWORK',
    line:'SIGNAL OUTSIDE THE WORKSHOP',kicker:'THE RELAY ANSWERS FROM BEYOND THE RIG'},
  E06_NETWORK_SCAN:{title:'IDENTITY SCAN',left:'T.O.T · RIVET',right:'NEWBOT',
    line:'REGISTERED / NO VALID NETWORK ID',kicker:'T.O.T + RIVET: REGISTERED · NEWBOT: NO VALID NETWORK ID'},
  E06_RIG_RETURN:{title:'RIG CONNECTION',left:'RIVET',right:'CONTROL RIG',
    line:'RIVET RETURNS TO THE CABLE',kicker:'PASSIVE HOLD ENDS · RETURN TO THE RIG'},
  E06_OVERRIDE_BUILDUP:{title:'OVERRIDE',left:'RIVET',right:'UNKNOWN COMMAND',
    line:'CONTROL IS NOT HIS',kicker:'THE EXTERNAL SIGNAL FORCES A RECONNECTION'},
  E07_START:{title:'RIVET OVERRIDDEN',left:'NEWBOT',right:'RIVET',
    line:'Lùi lại.',kicker:'RIVET · LAST COMMAND BEFORE EXTERNAL CONTROL'},
  E07_RIVET_COMMAND_750:{title:'RIVET OVERRIDDEN',left:'NEWBOT',right:'CONTROL SIGNAL',
    line:'COMMAND INTERFERENCE',kicker:'RIVET · 750 HP · NATIVE IMPACT'},
  E07_RIVET_COMMAND_450:{title:'RIVET OVERRIDDEN',left:'RIVET',right:'NETWORK SIGNAL',
    line:'RESISTANCE CONTINUES',kicker:'RIVET · 450 HP · NATIVE IMPACT'},
  E07_RIVET_NONLETHAL_STOP:{title:'RIVET OVERRIDDEN',left:'NEWBOT',right:'RIVET',
    line:'STOPPED — NOT DESTROYED',kicker:'RIVET · 180 HP · PHYSICAL NONLETHAL STOP'},
  E07_RECOVERY:{title:'AFTER THE OVERRIDE',left:'NEWBOT',right:'RIVET',
    line:'THE RIG FALLS SILENT',kicker:'RIVET SURVIVES · RETURN TO THE WORKSHOP'},
  E07_RETRY:{title:'RIVET OVERRIDDEN',left:'NEWBOT',right:'RIVET',
    line:'SIGNAL LOST',kicker:'NEWBOT KO · CHECKPOINT PRESERVED'},
  E08_START:{title:'T.O.T · LAST CHOICE',left:'NEWBOT',right:'T.O.T',
    line:'TWO FRIENDS · OPPOSING COMMANDS',kicker:'E08 · REAL ARSENAL BOSS DUEL'},
  E08_STORMBREAKER_ELIGIBLE:{title:'THE ONE STORMBREAKER',left:'T.O.T',right:'NEWBOT',
    line:'700 HP · WEAPON AVAILABLE',kicker:'NATIVE DAMAGE GATE · SINGLE ARTIFACT'},
  E08_STORMBREAKER_RESOLVED:{title:'THE WEAPON RETURNS',left:'T.O.T',right:'STORMBREAKER',
    line:'ONE REAL RELEASE · CRADLE RETURN',kicker:'PHYSICAL HIT OR MISS RESOLVED'},
  E08_TOT_NONLETHAL_CHOICE:{title:'T.O.T · LAST CHOICE',left:'NEWBOT',right:'T.O.T',
    line:'120 HP · NOT A K.O.',kicker:'NATIVE NONLETHAL HOLD · T.O.T CHOOSES'},
  E08_RETRY:{title:'T.O.T · LAST CHOICE',left:'NEWBOT',right:'T.O.T',
    line:'SIGNAL LOST',kicker:'NEWBOT KO · CHECKPOINT PRESERVED'},
  E08_L02:{title:'T.O.T · LAST CHOICE',left:'NEWBOT',right:'SCRAP BASIN',line:"Chúng ta là bạn à?",kicker:'NEWBOT · OWNER-LOCKED L02'},
  E08_L03:{title:'T.O.T · LAST CHOICE',left:'T.O.T',right:'SCRAP BASIN',line:"Tôi nghĩ vậy.",kicker:'T.O.T · OWNER-LOCKED L03'},
  E08_L04:{title:'T.O.T · LAST CHOICE',left:'NEWBOT',right:'SCRAP BASIN',line:"Tôi không đánh nữa!",kicker:'NEWBOT · OWNER-LOCKED L04'},
  E08_L05:{title:'T.O.T · LAST CHOICE',left:'T.O.T',right:'SCRAP BASIN',line:"Cậu phải đánh.",kicker:'T.O.T · OWNER-LOCKED L05'},
  E08_L06:{title:'T.O.T · LAST CHOICE',left:'T.O.T',right:'SCRAP BASIN',line:"Nếu cậu dừng...",kicker:'T.O.T · OWNER-LOCKED L06'},
  E08_L07:{title:'T.O.T · LAST CHOICE',left:'T.O.T',right:'SCRAP BASIN',line:"...tôi sẽ không.",kicker:'T.O.T · OWNER-LOCKED L07'},
  E08_L08:{title:'T.O.T · LAST CHOICE',left:'T.O.T',right:'SCRAP BASIN',line:"Từ lúc tỉnh dậy đến giờ... tôi chưa từng chọn được mình có nhặt súng hay không.",kicker:'T.O.T · OWNER-LOCKED L08'},
  E08_L09:{title:'T.O.T · LAST CHOICE',left:'T.O.T',right:'SCRAP BASIN',line:"Nhưng tôi có thể chọn mình làm gì với nó.",kicker:'T.O.T · OWNER-LOCKED L09'},
  E08_L10:{title:'T.O.T · LAST CHOICE',left:'T.O.T',right:'SCRAP BASIN',line:"Đi.",kicker:'T.O.T · OWNER-LOCKED L10'},
  E08_L11:{title:'T.O.T · LAST CHOICE',left:'T.O.T',right:'SCRAP BASIN',line:"Cậu muốn biết mình là ai mà.",kicker:'T.O.T · OWNER-LOCKED L11'},
  E08_L12:{title:'T.O.T · LAST CHOICE',left:'T.O.T',right:'SCRAP BASIN',line:"Lần này...",kicker:'T.O.T · OWNER-LOCKED L12'},
  E08_L13:{title:'T.O.T · LAST CHOICE',left:'T.O.T',right:'SCRAP BASIN',line:"...tôi dừng được rồi.",kicker:'T.O.T · OWNER-LOCKED L13'},
  E06_BREACH_RETRY:{title:'BREACH WAVES',left:'THREE ALLIES',right:'SCRAP BASIN',
    line:'ALL THREE WITHDREW',kicker:'PHYSICAL RETREAT · CHECKPOINT PRESERVED'}
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
  function still(canvas,focus){
   const src=source();const ctx=canvas.getContext?.('2d');
   if(!src||!ctx||!src.width||!src.height)return false;
   canvas.width=src.width;canvas.height=src.height;
   const actors=Array.isArray(root.fighters)?root.fighters:[];
   const ally=actors.find(a=>a?.questId==='NEWBOT');
   const world=actors.find(a=>a?.questWorldObject===true);
   const target=focus==='ALLY'?ally
     :focus==='TARGET'?world
     :actors.find(a=>a?.questTeam==='HOSTILE'&&a.hp<=0)||
      actors.find(a=>a?.questTeam==='HOSTILE');
   // Compose two DIFFERENT authentic physical camera angles of the real
   // paused scene. Never generate characters, damage or a fake background.
   try{
     if(focus==='DUO'&&ally&&world
       &&Number.isFinite(ally.x)&&Number.isFinite(world.x)){
       // Include BOTH genuine actors in the mobile one-panel variant;
       // previously a 0% target was clipped at frame-right.
       const spreadX=Math.abs(ally.x-world.x)+220;
       const spreadY=Math.abs(ally.y-world.y)+220;
       const factor=Math.min(1,Math.max(.86,spreadX/src.width,spreadY/src.height));
       const sxSize=src.width*factor,sySize=src.height*factor;
       const midX=(ally.x+world.x)/2,midY=(ally.y+world.y)/2;
       const sx=Math.max(0,Math.min(src.width-sxSize,midX-sxSize/2));
       const sy=Math.max(0,Math.min(src.height-sySize,midY-sySize/2));
       ctx.drawImage(src,sx,sy,sxSize,sySize,0,0,canvas.width,canvas.height);
     }else if(target&&Number.isFinite(target.x)&&Number.isFinite(target.y)){
       const sxSize=src.width*(focus==='ALLY'?.67:.58);
       const sySize=src.height*(focus==='ALLY'?.67:.58);
       const sx=Math.max(0,Math.min(src.width-sxSize,target.x-sxSize/2));
       const sy=Math.max(0,Math.min(src.height-sySize,target.y-sySize/2));
       ctx.drawImage(src,sx,sy,sxSize,sySize,0,0,canvas.width,canvas.height);
     }else ctx.drawImage(src,0,0);
     return true;
   }catch(_){return false;}
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
   if(/_CLEAR$/.test(cue.id))layer.classList.add('qs-finale');
   if(cue.id==='WORKSHOP_ARRIVAL')layer.classList.add('qs-workshop');
   layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label','Quest story scene');
   const body=e('div','qs-body'),top=e('div','qs-top'),head=e('div','');
   head.append(e('div','qs-episode','QUEST 01 · THE ONES THROWN AWAY'),e('div','qs-chapter',meta.title));
   top.append(head,e('div','qs-marker','STORY · '+String(shown.length).padStart(2,'0')));
   const comic=e('div','qs-comic');
   for(const [i,name] of [meta.left,meta.right].entries()){
    const shot=e('div','qs-shot'+(i===1?' qs-shot--detail':''));
    const picture=e('canvas','');picture.setAttribute('aria-hidden','true');
    const focus=cue.id==='E05_BREAKER_CHARGE_CLEAR'
      ?(i===0?'DUO':'TARGET'):(i===0?'ALLY':'HOSTILE');
    still(picture,focus);
    shot.append(picture,e('div','qs-chip',name),e('span','qs-frame','0'+(i+1)));
    comic.appendChild(shot);
   }
   const footer=e('div','qs-footer'),words=e('div','');
   words.append(e('div','qs-kicker',meta.kicker),e('div','qs-line',meta.line));
   if(/_CLEAR$/.test(cue.id)){
     const roster=Array.isArray(root.fighters)?root.fighters:[];
     if(cue.id==='E05_BREAKER_CHARGE_CLEAR'){
       const accepted=root.APEX_QUEST_MULTI_ACTOR_CORE?.breakerAcceptedDamage?.(roster);
       const hero=roster.find(x=>x.questId==='NEWBOT');
       if(Number.isFinite(accepted)&&hero)
         words.append(e('div','qs-stats',Math.round(accepted).toLocaleString('en-US')+
           ' IMPACT · NEWBOT '+Math.round(hero.hp)+' HP'));
     }
     const hero=roster.find(f=>f?.questId==='NEWBOT');
     const state=root.APEX_ARSENAL?.state;
     const defeated=roster.filter(f=>f?.questTeam==='HOSTILE'&&f.hp<=0).length+
       (state?.questScrapSwarmProgression===true?(state.questSwarmWaveAReceipt?.length||0):0);
     if(hero&&Number.isFinite(hero.hp)&&defeated>0)
       words.append(e('div','qs-stats','NEWBOT  '+Math.max(0,Math.round(hero.hp))+
         ' / '+Math.round(hero.maxHp||1000)+' HP   ·   '+defeated+' HOSTILES DOWN'));
   }
   const controls=e('div','qs-controls'),skip=e('button','qs-skip','SKIP ›'),
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
