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

export function adaptGoldShellR50k(input) {
  let out = String(input || '');

  // Remove the superseded bespoke Battle transition. Mechanical Door V4 owns
  // boot + navigational HUD/UI transitions only; Battle has no Door route.
  out = replaceRangeOnce(out, '\n#battleTransition{', '\n</style>', '', 'legacy Battle transition CSS');
  out = replaceRangeOnce(out, '<div id="battleTransition" aria-hidden="true">', '<div id="battleHudHost" aria-hidden="true">', '', 'legacy Battle transition DOM');
  out = replaceOnce(out, "  const battleTransition=document.getElementById('battleTransition');\n", '', 'legacy Battle transition node');
  out = replaceOnce(out, '  let battleTransitionToken=0;\n', '', 'legacy Battle transition token');

  out = replaceRangeOnce(
    out,
    "  function setScreen(next){",
    "  function uiFocusMove(){",
    "  function commitScreen(next){\n    screen=next;\n    APEX_GOLD.onSurface&&APEX_GOLD.onSurface(next);\n    stage.classList.remove('flow-transition','match-ready');\n    stage.classList.toggle('screen-mode',next==='mode');\n    stage.classList.toggle('screen-fighter',next==='fighter');\n    modeScreen.setAttribute('aria-hidden',next==='mode'?'false':'true');\n    fighterScreen.setAttribute('aria-hidden',next==='fighter'?'false':'true');\n    if(next!=='home'){stage.classList.remove('intent-story','intent-battle');stage.style.setProperty('--intent','0')}\n  }\n  function focusScreen(next){\n    if(next==='mode')modeCards[modeFocus]?.focus({preventScroll:true});\n    else if(next==='fighter')document.querySelector(`.rosterCard[data-hero=\\\"${activePlayer==='p1'?p1Hero:p2Hero}\\\"]`)?.focus({preventScroll:true});\n    else if(next==='home')battle.focus({preventScroll:true});\n  }\n  // R52 no-swallowed-steps law: while the Mechanical Door owns the screen, a\n  // doorless step intent is QUEUED (latest wins) and drained the moment the Door\n  // settles - never silently dropped. A pressed card must always land.\n  let queuedScreen=null, queuedScreenTimer=0;\n  function drainQueuedScreen(){\n    queuedScreenTimer=0;\n    const next=queuedScreen;\n    if(!next)return;\n    if(window.APEX_SCENE_TRANSITION?.active?.()){queuedScreenTimer=setTimeout(drainQueuedScreen,120);return;}\n    queuedScreen=null;\n    void setScreen(next);\n  }\n  function queueScreen(next){\n    queuedScreen=next;\n    if(!queuedScreenTimer)queuedScreenTimer=setTimeout(drainQueuedScreen,120);\n    return false;\n  }\n  async function setScreen(next){\n    if(next===screen)return true;\n    const tr=window.APEX_SCENE_TRANSITION;\n    if(tr?.active?.())return queueScreen(next);\n    const sceneHeroIds=()=>{\n      const ids=[p1Hero];\n      if(battleMode==='bot')ids.push(botHeroId());\n      else if(!p2Empty||p2HasPicked)ids.push(p2Hero);\n      return [...new Set(ids.filter(Boolean))];\n    };\n    const prepare=async()=>{\n      const heroIds=next==='fighter'?sceneHeroIds():[];\n      if(APEX_GOLD.prepareSurface)await APEX_GOLD.prepareSurface(next,{heroIds});\n      if(next==='mode')hydrateDeferredImages(modeScreen);\n      if(next==='fighter'){\n        if(!roster.childElementCount)buildRoster();\n        renderFighter();\n      }\n      // The visible Fighter composition includes world-stage art OUTSIDE the\n      // fighter section, so settle the actual stage rather than a UI sub-tree.\n      await tr?.prepareElement?.(stage);\n    };\n    // R51 route policy: Home, Mode and Fighter Pick are screens of ONE\n    // Gold shell surface. Each already owns its authored screen transition,\n    // so they never engage the Mechanical Door. The Door is a SCENE\n    // authority (boot and the Lucky Draw bay) — Mechanical Door V4 has no shortcut/cancel path.\n    await prepare();\n    commitScreen(next);\n    focusScreen(next);\n    return true;\n  }\n\n",
    'Home/Mode/Fighter scene coordinator'
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
    "  let battleEntryToken=0;\n  async function setBattleLive(){\n    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('battle');\n    const ready=APEX_GOLD.onBattleLive\n      ? await Promise.resolve(APEX_GOLD.onBattleLive({mode:battleMode,p1:p1Hero,p2:p2Hero}))\n      : false;\n    if(ready!==true||!window.APEX_GOLD_HUD)return false;\n    // Production projection is now authoritative. Mark the preview handoff\n    // closed so no later HUD_READY/load callback can overwrite live\n    // skill/weapon truth with donor defaults.\n    battleHudConfig={...makeBattleConfig(true)};\n    window.postMessage({type:'APEX_CHAOS_BATTLE_LIVE'},'*');\n    return true;\n  }\n  function waitBattleHudMount(){\n    return new Promise((resolve,reject)=>{\n      battleHudReady=false;\n      const ready=()=>{battleHudReady=true;sendBattleHudConfig();resolve(true);};\n      battleHudFrame.onload=ready;\n      try{APEX_GOLD.mountBattleHud(decodeBattleHud(),ready)}\n      catch(error){reject(error)}\n    });\n  }\n  function rollbackBattleEntry(){\n    battleEntryToken+=1;\n    document.body.classList.remove('battle-hud-open','battle-transition-active');\n    battleHudHost.classList.remove('is-open','is-preloading','is-transitioning','is-reveal','is-horizontal');\n    battleHudHost.setAttribute('aria-hidden','true');\n    resumeParentRuntime();\n    battleHudFrame.onload=null;\n    APEX_GOLD.unmountBattleHud();\n    battleHudConfig=null;\n    battleHudReady=false;\n    screen='fighter';\n    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('fighter');\n  }\n  async function launchBattleHud(){\n    if(!battleMode||!battleHudHost||!battleHudFrame||screen==='transition'||screen==='battle')return;\n    if(window.APEX_SCENE_TRANSITION?.active?.())return;\n    screen='transition';\n    // Battle is NOT a Mechanical Door route. It owns its own lifecycle and\n    // lazy-loads only when LOCK IN actually requests combat. The entry beat is\n    // a music-allowed scene surface; combat itself takes the music down.\n    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('transition');\n    const token=++battleEntryToken;\n    battleHudConfig=makeBattleConfig(false);\n    try{\n      const heroIds=[p1Hero,battleMode==='bot'?botHeroId():p2Hero].filter(Boolean);\n      if(APEX_GOLD.prepareSurface)await APEX_GOLD.prepareSurface('battle',{heroIds});\n      if(token!==battleEntryToken)return;\n      battleHudHost.setAttribute('aria-hidden','false');\n      battleHudHost.classList.add('is-preloading');\n      await waitBattleHudMount();\n      if(token!==battleEntryToken)return;\n      sendBattleHudConfig();\n      await window.APEX_SCENE_TRANSITION?.prepareElement?.(battleHudHost);\n      if(token!==battleEntryToken)return;\n\n      freezeParentRuntime();\n      // OWNER READY LAW: production must be live with the first truth frame\n      // applied BEFORE the compositor is revealed. A failed start rolls the\n      // entire entry back — donor defaults are never shown to the player.\n      const liveReady=await setBattleLive();\n      if(token!==battleEntryToken)return;\n      if(liveReady!==true)throw new Error('Battle runtime did not report READY');\n      // Gold Battle owns its authored 430 ms shutter reveal. The Door owns boot\n      // and the Lucky Draw bay only, so this beat never engages the coordinator.\n      battleHudHost.classList.toggle('is-horizontal',(battleHudHost.clientWidth||0)>(battleHudHost.clientHeight||0));\n      battleHudHost.classList.remove('is-preloading');\n      battleHudHost.classList.add('is-transitioning');\n      document.body.classList.add('battle-transition-active');\n      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));\n      if(token!==battleEntryToken)return;\n      battleHudHost.classList.add('is-reveal');\n      await new Promise(r=>setTimeout(r,430));\n      if(token!==battleEntryToken)return;\n      battleHudHost.classList.remove('is-transitioning','is-reveal','is-horizontal');\n      battleHudHost.classList.add('is-open');\n      document.body.classList.remove('battle-transition-active');\n      document.body.classList.add('battle-hud-open');\n      screen='battle';\n    }catch(error){\n      if(token!==battleEntryToken)return;\n      rollbackBattleEntry();\n      console.warn('[battle-entry] failed',error);\n    }\n  }\n  function cancelBattleTransition(){\n    if(screen!=='transition')return false;\n    rollbackBattleEntry();\n    return true;\n  }\n  function closeBattleHud(){\n    if(screen==='transition'){cancelBattleTransition();focusScreen('fighter');return}\n    if(!battleHudHost?.classList.contains('is-open'))return;\n    battleEntryToken+=1;\n    battleHudHost.classList.remove('is-open','is-preloading','is-transitioning','is-reveal','is-horizontal');\n    battleHudHost.setAttribute('aria-hidden','true');\n    document.body.classList.remove('battle-hud-open','battle-transition-active');\n    APEX_GOLD.exitBattle&&APEX_GOLD.exitBattle();\n    resumeParentRuntime();\n    battleHudFrame.onload=null;\n    APEX_GOLD.unmountBattleHud();\n    battleHudConfig=null;\n    battleHudReady=false;\n    screen='fighter';\n    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('fighter');\n    focusScreen('fighter');\n  }\n  addEventListener('message',e=>{\n    const d=e.data;\n    if(!d)return;\n    if(d.type==='APEX_CHAOS_HUD_READY'){battleHudReady=true;sendBattleHudConfig();}\n    else if(d.type==='APEX_CHAOS_BATTLE_EXIT')closeBattleHud();\n  });\n\n",
    'Battle lifecycle decoupled from Mechanical Door'
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
    "#battleTransition",
    // R51 route policy: screen swaps inside the shell never re-arm the Door.
    "name:`${screen}->${next}`",
    "id=\"battleTransition\"",
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
