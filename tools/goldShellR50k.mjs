// R50K — deterministic Gold shell adapter for Mechanical Door V4.
// Input contract: R50J-generated shell. Output contract: boot and navigational
// HUD/UI surface changes are readiness-gated by the Scene Transition Coordinator.
// Battle is deliberately excluded: combat owns its own lazy-load/activation
// lifecycle and must never wait behind the Mechanical Door.
// The owner Gold door owns motion/timing; this adapter owns only route wiring.
//
// R51 correction slice — this adapter is the LAST writer for the whole Battle
// lifecycle region, so it is also the ONE owner of the Battle readiness law:
// production READY + first truth frame BEFORE the compositor is revealed, and
// the Gold battle's own 430 ms shutter reveal (the Door has no Battle route).
// The superseded R49D shell patches that targeted this same region are no
// longer emitted by the generator; duplicating them here was exactly how the
// reveal order silently regressed on the R50K cutover.

function replaceRangeOnce(src, start, end, replacement, label) {
  const a = src.indexOf(start);
  if (a < 0) throw new Error(`R50K ${label}: start seam missing`);
  if (src.indexOf(start, a + start.length) >= 0) throw new Error(`R50K ${label}: start seam duplicated`);
  const b = src.indexOf(end, a);
  if (b < 0) throw new Error(`R50K ${label}: end seam missing`);
  return src.slice(0, a) + replacement + src.slice(b);
}
function replaceOnce(src, needle, replacement, label) {
  const a = src.indexOf(needle);
  if (a < 0) throw new Error(`R50K ${label}: seam missing`);
  if (src.indexOf(needle, a + needle.length) >= 0) throw new Error(`R50K ${label}: seam duplicated`);
  return src.slice(0, a) + replacement + src.slice(a + needle.length);
}

// ── R52 / N3 — the ONE owner of the Battle entry lifecycle ──────────────────
// The owner's Gold rail transition (#battleTransition: two rail plates, seam,
// core) is the battle-entry transition. This region drives its canonical phase
// vocabulary (phase-lock -> phase-clamp -> phase-seam -> phase-open ->
// phase-handoff, is-bot / is-horizontal variants) and keeps the R51 readiness
// order that replaced the donor's own lifecycle: production READY + the first
// truth frame land BEFORE the compositor is revealed, and a failed start rolls
// the whole entry back instead of showing donor defaults.
// R54: the compositor is full-bleed from the moment it mounts, so the rails'
// opening IS the reveal - there is no second, centre-out reveal under it.
const BATTLE_ENTRY_REGION = `  let battleEntryToken=0;
  async function setBattleLive(){
    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('battle');
    const ready=APEX_GOLD.onBattleLive
      ? await Promise.resolve(APEX_GOLD.onBattleLive({mode:battleMode,p1:p1Hero,p2:p2Hero}))
      : false;
    if(ready!==true||!window.APEX_GOLD_HUD)return false;
    // Production projection is now authoritative. Mark the preview handoff
    // closed so no later HUD_READY/load callback can overwrite live
    // skill/weapon truth with donor defaults.
    battleHudConfig={...makeBattleConfig(true)};
    window.postMessage({type:'APEX_CHAOS_BATTLE_LIVE'},'*');
    return true;
  }
  function waitBattleHudMount(){
    return new Promise((resolve,reject)=>{
      battleHudReady=false;
      const ready=()=>{battleHudReady=true;sendBattleHudConfig();resolve(true);};
      battleHudFrame.onload=ready;
      try{APEX_GOLD.mountBattleHud(decodeBattleHud(),ready)}
      catch(error){reject(error)}
    });
  }
  // Identity is the donor law: the rails carry the match-up (names, accents,
  // BOT vs DUEL channel) and the rail orientation follows the real screen
  // aspect, never a fixed axis.
  function setTransitionIdentity(){
    if(!battleTransition)return;
    const bot=battleMode==='bot';
    const p1=heroPayload(p1Hero,'newbot');
    const p2=bot?heroPayload(botHeroId(),'newbot'):heroPayload(p2Hero,'newbot');
    battleTransition.style.setProperty('--p1',p1.accent||'#ff941f');
    battleTransition.style.setProperty('--p2',p2.accent||'#8bd8ff');
    battleTransition.querySelector('[data-bt-name="p1"]').textContent=p1.name;
    battleTransition.querySelector('[data-bt-name="p2"]').textContent=p2.name;
    battleTransition.querySelector('[data-bt-state="p1"]').textContent='COMBAT LOCK';
    battleTransition.querySelector('[data-bt-state="p2"]').textContent=bot?'TARGET ACQUIRED':'COMBAT LOCK';
    battleTransition.querySelector('[data-bt-kicker="p2"]').textContent=bot?'CPU // TARGET':'P2 // FIGHTER';
    battleTransition.querySelector('[data-bt-core]').textContent=bot?'SOLO COMBAT CHANNEL':'DUEL COMBAT CHANNEL';
    const horizontal=!bot&&matchMedia('(orientation:portrait)').matches;
    battleTransition.classList.toggle('is-horizontal',horizontal);
    battleTransition.classList.toggle('is-bot',bot);
    battleHudHost.classList.toggle('is-horizontal',horizontal);
  }
  function resetBattleTransitionVisuals(){
    if(!battleTransition)return;
    battleTransition.classList.remove('is-active','is-bot','is-horizontal','phase-lock','phase-clamp','phase-seam','phase-open','phase-handoff');
    battleTransition.setAttribute('aria-hidden','true');
    document.body.classList.remove('battle-transition-active');
  }
  function rollbackBattleEntry(){
    battleEntryToken+=1;
    document.body.classList.remove('battle-hud-open','battle-transition-active');
    battleHudHost.classList.remove('is-open','is-preloading','is-transitioning','is-reveal','is-horizontal');
    battleHudHost.setAttribute('aria-hidden','true');
    resetBattleTransitionVisuals();
    resumeParentRuntime();
    battleHudFrame.onload=null;
    APEX_GOLD.unmountBattleHud();
    battleHudConfig=null;
    battleHudReady=false;
    screen='fighter';
    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('fighter');
  }
  // ONE beat scheduler: donor beats at production tempo, collapsed to the
  // reduced-motion floor (24 ms) exactly like the authored source.
  function battleBeat(ms,token){
    return new Promise(resolve=>setTimeout(()=>resolve(token===battleEntryToken),reduced?Math.min(ms,24):ms));
  }
  async function launchBattleHud(){
    if(!battleMode||!battleHudHost||!battleHudFrame||screen==='transition'||screen==='battle')return;
    if(window.APEX_SCENE_TRANSITION?.active?.())return;
    screen='transition';
    // Battle is NOT a Mechanical Door route. It owns its own lifecycle and
    // lazy-loads only when LOCK IN actually requests combat. The entry beat is
    // a music-allowed scene surface; combat itself takes the music down.
    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('transition');
    const token=++battleEntryToken;
    battleHudConfig=makeBattleConfig(false);
    setTransitionIdentity();
    battleTransition.classList.add('is-active','phase-lock');
    battleTransition.setAttribute('aria-hidden','false');
    document.body.classList.add('battle-transition-active');
    try{
      const heroIds=[p1Hero,battleMode==='bot'?botHeroId():p2Hero].filter(Boolean);
      if(APEX_GOLD.prepareSurface)await APEX_GOLD.prepareSurface('battle',{heroIds});
      if(token!==battleEntryToken)return;
      if(!await battleBeat(180,token))return;
      battleTransition.classList.add('phase-clamp');
      if(!await battleBeat(240,token))return;
      battleHudHost.setAttribute('aria-hidden','false');
      battleHudHost.classList.add('is-preloading');
      await waitBattleHudMount();
      if(token!==battleEntryToken)return;
      sendBattleHudConfig();
      await window.APEX_SCENE_TRANSITION?.prepareElement?.(battleHudHost);
      if(token!==battleEntryToken)return;
      freezeParentRuntime();
      battleHudHost.classList.remove('is-preloading');
      battleHudHost.classList.add('is-transitioning');
      if(!await battleBeat(240,token))return;
      battleTransition.classList.add('phase-seam');
      // OWNER READY LAW: production must be live with the first truth frame
      // applied BEFORE the compositor is revealed. A failed start rolls the
      // entire entry back — donor defaults are never shown to the player.
      const liveReady=await setBattleLive();
      if(token!==battleEntryToken)return;
      if(liveReady!==true)throw new Error('Battle runtime did not report READY');
      // The reveal IS the authored beat, and the ONLY one: the Gold rails open
      // (430 ms CSS) onto a compositor that is already full-bleed and live
      // behind them. R54 removed the compositor's own centre-out clip, which
      // used to expand a black rectangle out of the middle of the screen one
      // beat behind the rails (owner report).
      battleTransition.classList.add('phase-open');
      battleHudHost.classList.add('is-reveal');
      if(!await battleBeat(430,token))return;
      document.body.classList.add('battle-hud-open');
      document.body.classList.remove('battle-transition-active');
      battleTransition.classList.add('phase-handoff');
      battleHudHost.classList.remove('is-transitioning','is-reveal','is-horizontal');
      battleHudHost.classList.add('is-open');
      screen='battle';
      if(!await battleBeat(210,token))return;
      resetBattleTransitionVisuals();
      battleHudHost.classList.add('is-open');
      battleHudHost.setAttribute('aria-hidden','false');
    }catch(error){
      if(token!==battleEntryToken)return;
      rollbackBattleEntry();
      console.warn('[battle-entry] failed',error);
    }
  }
  function cancelBattleTransition(){
    if(screen!=='transition')return false;
    rollbackBattleEntry();
    return true;
  }
  function closeBattleHud(){
    if(screen==='transition'){cancelBattleTransition();focusScreen('fighter');return}
    if(!battleHudHost?.classList.contains('is-open'))return;
    battleEntryToken+=1;
    battleHudHost.classList.remove('is-open','is-preloading','is-transitioning','is-reveal','is-horizontal');
    battleHudHost.setAttribute('aria-hidden','true');
    document.body.classList.remove('battle-hud-open','battle-transition-active');
    APEX_GOLD.exitBattle&&APEX_GOLD.exitBattle();
    resumeParentRuntime();
    battleHudFrame.onload=null;
    APEX_GOLD.unmountBattleHud();
    battleHudConfig=null;
    battleHudReady=false;
    screen='fighter';
    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('fighter');
    focusScreen('fighter');
  }
  addEventListener('message',e=>{
    const d=e.data;
    if(!d)return;
    if(d.type==='APEX_CHAOS_HUD_READY'){battleHudReady=true;sendBattleHudConfig();}
    else if(d.type==='APEX_CHAOS_BATTLE_EXIT')closeBattleHud();
  });

`;

export function adaptGoldShellR50k(input) {
  let out = String(input || '');

  // ── R52 / N3: the owner's Gold rail transition is KEPT ─────────────────
  // R50K deleted #battleTransition here and battle entry fell back to a bare
  // clip-path shutter, so the authored beat (two rail plates + seam + core)
  // disappeared from the product. The owner's own transition IS the battle
  // entry transition, so the CSS, the DOM and its node reference are restored
  // from the canonical source; only the dead phase token is dropped (the ONE
  // scheduler below owns the token now).
  out = replaceOnce(out, '  let battleTransitionToken=0;\n', '', 'dead legacy Battle transition token');

  out = replaceRangeOnce(
    out,
    "  function setScreen(next){",
    "  function uiFocusMove(){",
    "  function commitScreen(next){\n    screen=next;\n    APEX_GOLD.onSurface&&APEX_GOLD.onSurface(next);\n    stage.classList.remove('flow-transition','match-ready');\n    stage.classList.toggle('screen-mode',next==='mode');\n    stage.classList.toggle('screen-fighter',next==='fighter');\n    modeScreen.setAttribute('aria-hidden',next==='mode'?'false':'true');\n    fighterScreen.setAttribute('aria-hidden',next==='fighter'?'false':'true');\n    if(next!=='home'){stage.classList.remove('intent-story','intent-battle');stage.style.setProperty('--intent','0')}\n  }\n  function focusScreen(next){\n    if(next==='mode')modeCards[modeFocus]?.focus({preventScroll:true});\n    else if(next==='fighter')document.querySelector(`.rosterCard[data-hero=\\\"${activePlayer==='p1'?p1Hero:p2Hero}\\\"]`)?.focus({preventScroll:true});\n    else if(next==='home')battle.focus({preventScroll:true});\n  }\n  // R52 no-swallowed-steps law: while the Mechanical Door owns the screen, a\n  // doorless step intent is QUEUED (latest wins) and drained the moment the Door\n  // settles - never silently dropped. A pressed card must always land.\n  let queuedScreen=null, queuedScreenTimer=0;\n  function drainQueuedScreen(){\n    queuedScreenTimer=0;\n    const next=queuedScreen;\n    if(!next)return;\n    if(window.APEX_SCENE_TRANSITION?.active?.()){queuedScreenTimer=setTimeout(drainQueuedScreen,120);return;}\n    queuedScreen=null;\n    void setScreen(next);\n  }\n  function queueScreen(next){\n    queuedScreen=next;\n    if(!queuedScreenTimer)queuedScreenTimer=setTimeout(drainQueuedScreen,120);\n    return false;\n  }\n  async function setScreen(next){\n    if(next===screen)return true;\n    const tr=window.APEX_SCENE_TRANSITION;\n    if(tr?.active?.())return queueScreen(next);\n    const sceneHeroIds=()=>{\n      const ids=[p1Hero];\n      if(battleMode==='bot')ids.push(botHeroId());\n      else if(!p2Empty||p2HasPicked)ids.push(p2Hero);\n      return [...new Set(ids.filter(Boolean))];\n    };\n    const prepare=async()=>{\n      const heroIds=next==='fighter'?sceneHeroIds():[];\n      if(APEX_GOLD.prepareSurface)await APEX_GOLD.prepareSurface(next,{heroIds});\n      if(next==='mode')hydrateDeferredImages(modeScreen);\n      if(next==='fighter'){\n        if(!roster.childElementCount)buildRoster();\n        renderFighter();\n      }\n      // The visible Fighter composition includes world-stage art OUTSIDE the\n      // fighter section, so settle the actual stage rather than a UI sub-tree.\n      await tr?.prepareElement?.(stage);\n    };\n    // R51 route policy: Home, Mode and Fighter Pick are screens of ONE\n    // Gold shell surface. Each already owns its authored screen transition,\n    // so they never engage the Mechanical Door. The Door is a SCENE\n    // authority (boot and the Lucky Draw bay) — Mechanical Door V4 has no shortcut/cancel path.\n    await prepare();\n    commitScreen(next);\n    focusScreen(next);\n    return true;\n  }\n\n",
    'Home/Mode/Fighter scene coordinator'
  );

  // ── R54: the Home AC readout is production economy, not a constant ────────
  // The canonical shell prints "350 AC" (the historical START_CREDITS). The real
  // balance lives in the ONE meta authority, whose single save() path announces
  // every change as `apex:credits`. This readout follows that truth on boot, on
  // every mutation, on returning to the product menu and on tab re-focus - and
  // it only ever rewrites the visible text node, so the corner bracket, the mark
  // and the layout are untouched.
  out = replaceOnce(
    out,
    '</body>',
    `<script id="apex-ac-readout">
(()=>{
  const node=document.querySelector('[data-apex-ac]');
  if(!node)return;
  const format=(n)=>Number(n).toLocaleString('en-US')+' AC';
  function syncApexAcReadout(){
    try{
      const meta=window.APEX_ARSENAL_META;
      const credits=meta&&typeof meta.credits==='function'?meta.credits():null;
      if(credits==null)return;
      const text=format(credits);
      if(node.textContent!==text)node.textContent=text;
      node.setAttribute('data-apex-ac-value',String(credits));
    }catch(error){/* a readout must never break Home */}
  }
  syncApexAcReadout();
  window.addEventListener('apex:credits',syncApexAcReadout);
  window.addEventListener('apex:product-menu',syncApexAcReadout);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) syncApexAcReadout(); });
  window.addEventListener('focus',syncApexAcReadout);
  document.addEventListener('DOMContentLoaded',syncApexAcReadout);
})();
</script>
</body>`,
    'live AC readout',
  );

  out = replaceOnce(
    out,
    "setTimeout(()=>{if(!roster.childElementCount)buildRoster();renderFighter();setScreen('fighter')},360);",
    "setTimeout(()=>{if(!roster.childElementCount)buildRoster();renderFighter();void setScreen('fighter')},360);",
    'Mode→Fighter async route'
  );

  out = replaceRangeOnce(
    out,
    "  function setBattleLive(){",
    "  function skillMarkup(id,player){",
    BATTLE_ENTRY_REGION,
    'Battle entry lifecycle (owner Gold rail transition, R51 readiness order)'
  );

  out = replaceRangeOnce(
    out,
    "  function back(){",
    "  requestAnimationFrame(()=>requestAnimationFrame(()=>{stage.classList.add('ready')}));",
    "  function back(){\n    uiSfx('ui.back.cancel');\n    if(screen==='fighter'){\n      if(stage.classList.contains('match-ready')){stage.classList.remove('match-ready');if(battleMode==='bot')p1Locked=false;else{p2Locked=false;activePlayer=p1Locked?'p2':'p1'}renderFighter();return}\n      void setScreen('mode'); return;\n    }\n    if(screen==='mode'){stage.classList.remove('mode-committing');modeCards.forEach(c=>c.classList.remove('is-selected','is-committing'));void setScreen('home')}\n  }\n\n  function moveHero(delta){\n    const current=activePlayer==='p1'?p1Hero:p2Hero; const i=HERO_ORDER.indexOf(current); selectHero(HERO_ORDER[(i+delta+HERO_ORDER.length)%HERO_ORDER.length]);\n    setTimeout(()=>document.querySelector(`.rosterCard[data-hero=\\\"${activePlayer==='p1'?p1Hero:p2Hero}\\\"]`)?.focus({preventScroll:true}),0);\n  }\n\n  function navigateGoldShell(target,opts={}){\n    const next=String(target||'').toLowerCase();\n    if(screen==='transition'||screen==='battle')return false;\n    if(next==='home'){\n      stage.classList.remove('mode-committing','match-ready');modeCards.forEach(c=>c.classList.remove('is-selected','is-committing'));void setScreen('home');return true;\n    }\n    if(next==='mode'){void setScreen('mode');return true;}\n    if(next==='fighter'){\n      const mode=String(opts.mode||battleMode||'local').toLowerCase()==='bot'?'bot':'local';\n      stage.classList.remove('mode-committing');modeCards.forEach(c=>c.classList.remove('is-selected','is-committing'));\n      void (async()=>{if(screen!=='mode'&&!(await setScreen('mode')))return;chooseMode(mode)})();\n      return true;\n    }\n    return false;\n  }\n  window.APEX_GOLD_SHELL_NAVIGATE=navigateGoldShell;\n  const pendingGoldNav=window.__apexPendingGoldNavigation;\n  if(pendingGoldNav){delete window.__apexPendingGoldNavigation;queueMicrotask(()=>navigateGoldShell(pendingGoldNav.target,pendingGoldNav.options||{}));}\n\n  battle.addEventListener('click',()=>{uiSfx('ui.screen.transition');void setScreen('mode')});\n  lockIn.addEventListener('click',lockCurrent);\n  APEX_GOLD.onSurface&&APEX_GOLD.onSurface('home');\n\n  addEventListener('keydown',e=>{\n    if(e.metaKey||e.ctrlKey||e.altKey)return; const k=e.key.toLowerCase();\n    if(window.APEX_SCENE_TRANSITION?.active?.()){e.preventDefault();return}\n    if(k==='escape'){if(screen==='transition'){e.preventDefault();return}if(screen==='battle'){void closeBattleHud();e.preventDefault();return}if(screen!=='home'){back();e.preventDefault()}return}\n    if(screen==='mode'){\n      if(k==='arrowup'||k==='arrowleft'){setModeFocus(modeFocus-1);modeCards[modeFocus].focus();e.preventDefault()}\n      else if(k==='arrowdown'||k==='arrowright'){setModeFocus(modeFocus+1);modeCards[modeFocus].focus();e.preventDefault()}\n      else if(k==='enter'||k===' '){chooseMode(modeCards[modeFocus].dataset.mode);e.preventDefault()}\n      return;\n    }\n    if(screen==='fighter'){\n      if(k==='arrowleft'){moveHero(-1);e.preventDefault()} else if(k==='arrowright'){moveHero(1);e.preventDefault()} else if(k==='enter'||k===' '){lockCurrent();e.preventDefault()}\n    }\n  });\n\n",
    'Gold navigation serialization'
  );

  out = replaceRangeOnce(
    out,
    "  function openLucky(){",
    "  window.addEventListener('beforeunload'",
    "  function ensureLuckyReady(){\n    if(loaded){\n      handLuckyProductionApi();\n      return Promise.resolve(true);\n    }\n    return new Promise((resolve,reject)=>{\n      try{\n        const onLoad=()=>{handLuckyProductionApi();resolve(true)};\n        frame.addEventListener('load',onLoad,{once:true});\n        frame.addEventListener('error',()=>reject(new Error('Lucky Draw failed to load')),{once:true});\n        frame.src=buildLuckyDonorURL();\n        loaded=true;\n      }catch(error){reject(error)}\n    });\n  }\n  async function openLucky(){\n    const tr=window.APEX_SCENE_TRANSITION;\n    // Owner law: a scene intent is never dropped. If the Door is mid-\n    // transaction the coordinator QUEUES this request (latest intent wins).\n    const prepare=async()=>{\n      if(APEX_GOLD.prepareSurface)await APEX_GOLD.prepareSurface('lucky');\n      await ensureLuckyReady();\n      // Same-origin donor: wait for its real image decode/font/layout state,\n      // not merely the iframe load event, before the door may open.\n      const doc=frame.contentDocument;\n      if(doc?.documentElement)await tr?.prepareElement?.(doc.documentElement);\n      await tr?.prepareElement?.(host);\n    };\n    const commit=()=>{\n      host.classList.add('is-open');host.setAttribute('aria-hidden','false');\n      APEX_GOLD.onSurface&&APEX_GOLD.onSurface('lucky');\n      window.apexShellSfx&&window.apexShellSfx('lucky.draw.enter_bay');\n    };\n    if(!tr?.run){try{await prepare();commit()}catch(err){console.error('[APEX Lucky Draw] donor load failed',err)}return}\n    const result=await tr.run({\n      name:'home->lucky',\n      source:()=>document.getElementById('stage'),\n      target:()=>host,\n      prepare,\n      commit,\n      rollback:()=>{},\n    });\n    if(result?.ok===false)console.error('[APEX Lucky Draw] transition recovered.',result.error);\n  }\n  async function closeLucky(){\n    const tr=window.APEX_SCENE_TRANSITION;\n    // Same law in the closing direction: BACK pressed while the bay is still\n    // moving is queued, never swallowed (this is the Lucky-Draw-is-stuck\n    // report — the player had no input left that could dismiss the bay).\n    const commit=()=>{\n      host.classList.remove('is-open');host.setAttribute('aria-hidden','true');\n      APEX_GOLD.onSurface&&APEX_GOLD.onSurface('home');\n    };\n    if(!tr?.run){commit();openBtn?.focus?.({preventScroll:true});return}\n    await tr.run({\n      name:'lucky->home',\n      source:()=>host,\n      target:()=>document.getElementById('stage'),\n      prepare:async()=>{\n        if(APEX_GOLD.prepareSurface)await APEX_GOLD.prepareSurface('home');\n        await tr.prepareElement(document.getElementById('stage'));\n      },\n      commit,\n      rollback:()=>{},\n    });\n    openBtn?.focus?.({preventScroll:true});\n  }\n  openBtn?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();void openLucky();});\n  window.addEventListener('message',e=>{if(e?.data?.type==='APEX_CHAOS_LUCKY_DRAW_EXIT')void closeLucky();});\n  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&host.classList.contains('is-open')){e.preventDefault();void closeLucky();}},true);\n",
    'Lucky Draw coordinator'
  );

  out = replaceOnce(
    out,
    "  function moveHero(delta){",
    "  // OWNER LAW (R52, fewer forced steps in the Free Battle flow): a tap on the\n  // backdrop leaves the current step. There is exactly ONE exit route \u2014 the same\n  // back() / closeBattleHud() the keyboard already uses \u2014 so a tap can never\n  // invent a new destination. Guards keep it intentional: a short still tap\n  // (<=420ms, <=12px), never on an interactive element, never while the Door or\n  // the authored flow transition is running, never while the Lucky donor is\n  // open, and in battle ONLY once the result stamp is published (no mid-match\n  // exit hazard).\n  let tapOutsideStart=null;\n  addEventListener('pointerdown',e=>{tapOutsideStart={x:e.clientX,y:e.clientY,ts:e.timeStamp,now:performance.now(),id:e.pointerId};},{passive:true});\n  addEventListener('pointerup',e=>{\n    const start=tapOutsideStart;tapOutsideStart=null;\n    if(!start||e.pointerId!==start.id)return;\n    const held=(Number.isFinite(e.timeStamp)&&e.timeStamp>=start.ts)?e.timeStamp-start.ts:performance.now()-start.now;\n    if(held>420)return;\n    if(Math.abs(e.clientX-start.x)>12||Math.abs(e.clientY-start.y)>12)return;\n    if(window.APEX_SCENE_TRANSITION?.active?.())return;\n    if(stage.classList.contains('flow-transition'))return;\n    if(document.getElementById('luckyDonorHost')?.classList.contains('is-open'))return;\n    const el=e.target;\n    if(el&&el.closest&&el.closest('button,a,input,select,textarea,label,[role=\"button\"],[data-arsenal-act],.cta,.modeCard,.rosterCard,.lockIn,.skill,.weapon,.wp-swap,.wp-ico'))return;\n    if(screen==='mode'||screen==='fighter'){back();return;}\n    if(screen==='battle'&&document.body.classList.contains('battle-result'))void closeBattleHud();\n  },{passive:true});\n\n  function moveHero(delta){",
    'tap-outside exit (fewer forced steps)'
  );

  out = replaceOnce(
    out,
    "      await tr?.prepareElement?.(stage);",
    "      // R52 STEP-WEIGHT LAW (the owner's \"no forced steps\"): Home, Mode and\n      // Fighter are doorless screens of ONE surface, so one step must cost ONE\n      // settle - not a full-raster re-decode of every world-stage image. The\n      // destination's own media is already owned by the awaited\n      // APEX_GOLD.prepareSurface() requirement set (fetch + decode, intent\n      // 'required'), so verify the destination panel's media here and then\n      // settle the actual stage (fonts + two painted frames). Boot already uses\n      // the same verifyImages:false contract for exactly this reason.\n      const surfaceRoot=next==='mode'?modeScreen:(next==='fighter'?fighterScreen:null);\n      if(surfaceRoot){try{await tr?.prepareElement?.(surfaceRoot);}catch(_){}}\n      // The visible Fighter composition includes world-stage art OUTSIDE the\n      // fighter section, so settle the actual stage rather than a UI sub-tree.\n      await tr?.prepareElement?.(stage,{verifyImages:false});",
    'doorless step-weight law (one settle per step)'
  );

  const forbidden = [
    // R52 / N3: #battleTransition is RESTORED as the battle-entry transition
    // (owner law), so it is no longer a forbidden seam. What must never come
    // back is a SECOND authority for the same beat.
    "let battleTransitionToken=0;",
    "function transitionSound(",
    // R51 route policy: screen swaps inside the shell never re-arm the Door.
    "name:`${screen}->${next}`",
    "function uiFocusMove(){  function uiFocusMove(){",
    "addEventListener('message',e=>{  addEventListener('message',e=>{",
    "window.APEX_GOLD_SHELL_NAVIGATE=navigateGoldShell;  window.APEX_GOLD_SHELL_NAVIGATE=navigateGoldShell;",
    "openBtn?.addEventListener('click',e=>{  openBtn?.addEventListener('click',e=>{",
    "name:'fighter->battle'",
    "name:'battle->fighter'",
  ];
  for (const token of forbidden) {
    if (out.includes(token)) throw new Error('R50K superseded/duplicate shell seam survived: ' + token.slice(0, 48));
  }

  const required = [
    "window.APEX_SCENE_TRANSITION",
    // The screen router itself is doorless by policy (R51); see forbidden[].
    "R51 route policy",
    "Battle is NOT a Mechanical Door route",
    // R52 / N3: the battle-entry beat is the owner's Gold rail transition,
    // driven by this adapter (identity + phase vocabulary + rail geometry).
    'id="battleTransition" aria-hidden="true"',
    "function setTransitionIdentity(){",
    "battleTransition.classList.add('is-active','phase-lock')",
    "battleTransition.classList.add('phase-clamp')",
    "battleTransition.classList.add('phase-seam')",
    "battleTransition.classList.add('phase-open')",
    "battleTransition.classList.add('phase-handoff')",
    "SOLO COMBAT CHANNEL",
    "DUEL COMBAT CHANNEL",
    "battleBeat(430,token)",
    "name:'home->lucky'",
    "name:'lucky->home'",
    "APEX_GOLD.prepareSurface",
    "Battle runtime did not report READY",
    "Mechanical Door V4 has no shortcut/cancel path",
    "if(window.APEX_SCENE_TRANSITION?.active?.()){e.preventDefault();return}",
    // R51 Battle readiness law (this adapter is the last writer of the region).
    "const liveReady=await setBattleLive();",
    "if(liveReady!==true)throw new Error('Battle runtime did not report READY')",
    "Production projection is now authoritative",
    "APEX_GOLD.onSurface&&APEX_GOLD.onSurface('transition')",
    "let battleEntryToken=0;",
    // R52 fewer-forced-steps law (this adapter owns the navigation region).
    "let tapOutsideStart=null;",
    "if(held>420)return;",
    "e.timeStamp>=start.ts",
    "if(screen==='mode'||screen==='fighter'){back();return;}",
    "document.body.classList.contains('battle-result')",
    // R52 step-weight law (doorless hops settle once, without re-decoding world art).
    "const surfaceRoot=next==='mode'?modeScreen:(next==='fighter'?fighterScreen:null);",
    "await tr?.prepareElement?.(stage,{verifyImages:false})",
    // R52 no-swallowed-steps law (doorless steps queue behind the Door).
    "let queuedScreen=null, queuedScreenTimer=0;",
    "function drainQueuedScreen(){",
    "return queueScreen(next);",
  ];
  for (const token of required) {
    if (!out.includes(token)) throw new Error('R50K shell invariant missing: ' + token);
  }
  return out;
}
