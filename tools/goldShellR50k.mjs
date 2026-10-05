// R50K — deterministic Gold shell adapter for Mechanical Door V4.
// Input contract: R50J-generated shell. Output contract: every public surface
// transition is readiness-gated by the one Scene Transition Coordinator.
// The owner Gold door owns motion/timing; this adapter owns only route wiring.

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

  out = replaceRangeOnce(
    out,
    "  function setScreen(next){",
    "  function uiFocusMove(){",
    "  function commitScreen(next){\n    screen=next;\n    APEX_GOLD.onSurface&&APEX_GOLD.onSurface(next);\n    stage.classList.remove('flow-transition','match-ready');\n    stage.classList.toggle('screen-mode',next==='mode');\n    stage.classList.toggle('screen-fighter',next==='fighter');\n    modeScreen.setAttribute('aria-hidden',next==='mode'?'false':'true');\n    fighterScreen.setAttribute('aria-hidden',next==='fighter'?'false':'true');\n    if(next!=='home'){stage.classList.remove('intent-story','intent-battle');stage.style.setProperty('--intent','0')}\n  }\n  function focusScreen(next){\n    if(next==='mode')modeCards[modeFocus]?.focus({preventScroll:true});\n    else if(next==='fighter')document.querySelector(`.rosterCard[data-hero=\"${activePlayer==='p1'?p1Hero:p2Hero}\"]`)?.focus({preventScroll:true});\n    else if(next==='home')battle.focus({preventScroll:true});\n  }\n  async function setScreen(next){\n    if(next===screen)return true;\n    const tr=window.APEX_SCENE_TRANSITION;\n    if(tr?.active?.())return false;\n    const destination=next==='mode'?modeScreen:(next==='fighter'?fighterScreen:stage);\n    const prepare=async()=>{\n      if(next==='mode')hydrateDeferredImages(modeScreen);\n      if(next==='fighter'){\n        if(!roster.childElementCount)buildRoster();\n        renderFighter();\n      }\n      await tr?.prepareElement?.(destination);\n    };\n    if(!tr?.run){\n      await prepare();\n      commitScreen(next);\n      focusScreen(next);\n      return true;\n    }\n    const result=await tr.run({\n      name:`${screen}->${next}`,\n      source:()=>stage,\n      target:()=>stage,\n      prepare,\n      commit:()=>commitScreen(next),\n      rollback:()=>{},\n    });\n    if(result?.ok!==false)focusScreen(next);\n    return result?.ok!==false;\n  }\n\n",
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
    "  async function setBattleLive(){",
    "  function skillMarkup(id,player){",
    "  async function setBattleLive(){\n    const ready=APEX_GOLD.onBattleLive\n      ? await Promise.resolve(APEX_GOLD.onBattleLive({mode:battleMode,p1:p1Hero,p2:p2Hero}))\n      : false;\n    if(ready!==true||!window.APEX_GOLD_HUD)return false;\n    battleHudConfig={...makeBattleConfig(true)};\n    window.postMessage({type:'APEX_CHAOS_BATTLE_LIVE'},'*');\n    return true;\n  }\n  function waitBattleHudMount(){\n    return new Promise((resolve,reject)=>{\n      battleHudReady=false;\n      const ready=()=>{battleHudReady=true;sendBattleHudConfig();resolve(true);};\n      battleHudFrame.onload=ready;\n      try{APEX_GOLD.mountBattleHud(decodeBattleHud(),ready)}\n      catch(error){reject(error)}\n    });\n  }\n  function rollbackBattleEntry(){\n    document.body.classList.remove('battle-hud-open','battle-transition-active');\n    battleHudHost.classList.remove('is-open','is-preloading','is-transitioning','is-reveal','is-horizontal');\n    battleHudHost.setAttribute('aria-hidden','true');\n    resumeParentRuntime();\n    battleHudFrame.onload=null;\n    APEX_GOLD.unmountBattleHud();\n    battleHudConfig=null;\n    battleHudReady=false;\n    screen='fighter';\n    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('fighter');\n  }\n  async function launchBattleHud(){\n    if(!battleMode||!battleHudHost||!battleHudFrame||screen==='transition'||screen==='battle')return;\n    const tr=window.APEX_SCENE_TRANSITION;\n    if(tr?.active?.())return;\n    screen='transition';\n    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('transition');\n    battleHudConfig=makeBattleConfig(false);\n    const prepare=async()=>{\n      battleHudHost.setAttribute('aria-hidden','false');\n      battleHudHost.classList.add('is-preloading');\n      await waitBattleHudMount();\n      sendBattleHudConfig();\n      await tr?.prepareElement?.(battleHudHost);\n    };\n    if(!tr?.run){\n      try{\n        await prepare();\n        freezeParentRuntime();\n        battleHudHost.classList.remove('is-preloading');\n        battleHudHost.classList.add('is-open');\n        document.body.classList.add('battle-hud-open');\n        screen='battle';APEX_GOLD.onSurface&&APEX_GOLD.onSurface('battle');\n        if(await setBattleLive()!==true)throw new Error('Battle runtime did not report READY');\n      }catch(error){rollbackBattleEntry();console.warn('[battle-entry] failed',error)}\n      return;\n    }\n    const result=await tr.run({\n      name:'fighter->battle',\n      source:()=>stage,\n      target:()=>battleHudHost,\n      prepare,\n      commit:()=>{\n        freezeParentRuntime();\n        battleHudHost.classList.remove('is-preloading','is-transitioning','is-reveal','is-horizontal');\n        battleHudHost.classList.add('is-open');\n        document.body.classList.add('battle-hud-open');\n        screen='battle';\n        APEX_GOLD.onSurface&&APEX_GOLD.onSurface('battle');\n      },\n      readyGate:async()=>{\n        if(await setBattleLive()!==true)throw new Error('Battle runtime did not report READY');\n      },\n      rollback:rollbackBattleEntry,\n    });\n    if(result?.ok===false)console.warn('[battle-entry] Mechanical Door recovered to Fighter Pick.',result.error);\n  }\n  function cancelBattleTransition(){\n    // Mechanical Door V4 has no shortcut/cancel path. Once close begins, the\n    // causal sequence must finish or recover through the coordinator rollback.\n    return false;\n  }\n  async function closeBattleHud(){\n    if(window.APEX_SCENE_TRANSITION?.active?.())return;\n    if(!battleHudHost?.classList.contains('is-open'))return;\n    const tr=window.APEX_SCENE_TRANSITION;\n    const commit=()=>{\n      battleHudHost.classList.remove('is-open','is-preloading','is-transitioning','is-reveal','is-horizontal');\n      battleHudHost.setAttribute('aria-hidden','true');\n      document.body.classList.remove('battle-hud-open','battle-transition-active');\n      APEX_GOLD.exitBattle&&APEX_GOLD.exitBattle();\n      resumeParentRuntime();\n      battleHudFrame.onload=null;\n      APEX_GOLD.unmountBattleHud();\n      battleHudConfig=null;\n      battleHudReady=false;\n      screen='fighter';\n      APEX_GOLD.onSurface&&APEX_GOLD.onSurface('fighter');\n    };\n    if(!tr?.run){commit();focusScreen('fighter');return}\n    await tr.run({\n      name:'battle->fighter',\n      source:()=>battleHudHost,\n      target:()=>stage,\n      prepare:()=>tr.prepareElement(stage),\n      commit,\n      rollback:()=>{},\n    });\n    focusScreen('fighter');\n  }\n  addEventListener('message',e=>{\n    const d=e.data;\n    if(!d)return;\n    if(d.type==='APEX_CHAOS_HUD_READY'){battleHudReady=true;sendBattleHudConfig();}\n    else if(d.type==='APEX_CHAOS_BATTLE_EXIT')closeBattleHud();\n  });\n\n",
    'Battle entry/exit coordinator'
  );

  out = replaceRangeOnce(
    out,
    "  function back(){",
    "  requestAnimationFrame(()=>requestAnimationFrame(()=>{stage.classList.add('ready')}));",
    "  function back(){\n    uiSfx('ui.back.cancel');\n    if(screen==='fighter'){\n      if(stage.classList.contains('match-ready')){stage.classList.remove('match-ready');if(battleMode==='bot')p1Locked=false;else{p2Locked=false;activePlayer=p1Locked?'p2':'p1'}renderFighter();return}\n      void setScreen('mode'); return;\n    }\n    if(screen==='mode'){stage.classList.remove('mode-committing');modeCards.forEach(c=>c.classList.remove('is-selected','is-committing'));void setScreen('home')}\n  }\n\n  function moveHero(delta){\n    const current=activePlayer==='p1'?p1Hero:p2Hero; const i=HERO_ORDER.indexOf(current); selectHero(HERO_ORDER[(i+delta+HERO_ORDER.length)%HERO_ORDER.length]);\n    setTimeout(()=>document.querySelector(`.rosterCard[data-hero=\"${activePlayer==='p1'?p1Hero:p2Hero}\"]`)?.focus({preventScroll:true}),0);\n  }\n\n  function navigateGoldShell(target,opts={}){\n    const next=String(target||'').toLowerCase();\n    if(screen==='transition'||screen==='battle'||window.APEX_SCENE_TRANSITION?.active?.())return false;\n    if(next==='home'){\n      stage.classList.remove('mode-committing','match-ready');modeCards.forEach(c=>c.classList.remove('is-selected','is-committing'));void setScreen('home');return true;\n    }\n    if(next==='mode'){void setScreen('mode');return true;}\n    if(next==='fighter'){\n      const mode=String(opts.mode||battleMode||'local').toLowerCase()==='bot'?'bot':'local';\n      stage.classList.remove('mode-committing');modeCards.forEach(c=>c.classList.remove('is-selected','is-committing'));\n      void (async()=>{if(screen!=='mode'&&!(await setScreen('mode')))return;chooseMode(mode)})();\n      return true;\n    }\n    return false;\n  }\n  window.APEX_GOLD_SHELL_NAVIGATE=navigateGoldShell;\n  const pendingGoldNav=window.__apexPendingGoldNavigation;\n  if(pendingGoldNav){delete window.__apexPendingGoldNavigation;queueMicrotask(()=>navigateGoldShell(pendingGoldNav.target,pendingGoldNav.options||{}));}\n\n  battle.addEventListener('click',()=>{uiSfx('ui.screen.transition');void setScreen('mode')});\n  lockIn.addEventListener('click',lockCurrent);\n  APEX_GOLD.onSurface&&APEX_GOLD.onSurface('home');\n\n  addEventListener('keydown',e=>{\n    if(e.metaKey||e.ctrlKey||e.altKey)return; const k=e.key.toLowerCase();\n    if(window.APEX_SCENE_TRANSITION?.active?.()){e.preventDefault();return}\n    if(k==='escape'){if(screen==='transition'){e.preventDefault();return}if(screen==='battle'){void closeBattleHud();e.preventDefault();return}if(screen!=='home'){back();e.preventDefault()}return}\n    if(screen==='mode'){\n      if(k==='arrowup'||k==='arrowleft'){setModeFocus(modeFocus-1);modeCards[modeFocus].focus();e.preventDefault()}\n      else if(k==='arrowdown'||k==='arrowright'){setModeFocus(modeFocus+1);modeCards[modeFocus].focus();e.preventDefault()}\n      else if(k==='enter'||k===' '){chooseMode(modeCards[modeFocus].dataset.mode);e.preventDefault()}\n      return;\n    }\n    if(screen==='fighter'){\n      if(k==='arrowleft'){moveHero(-1);e.preventDefault()} else if(k==='arrowright'){moveHero(1);e.preventDefault()} else if(k==='enter'||k===' '){lockCurrent();e.preventDefault()}\n    }\n  });\n\n",
    'Gold navigation serialization'
  );

  out = replaceRangeOnce(
    out,
    "  function openLucky(){",
    "  window.addEventListener('beforeunload'",
    "  function ensureLuckyReady(){\n    if(loaded){\n      handLuckyProductionApi();\n      return Promise.resolve(true);\n    }\n    return new Promise((resolve,reject)=>{\n      try{\n        const onLoad=()=>{handLuckyProductionApi();resolve(true)};\n        frame.addEventListener('load',onLoad,{once:true});\n        frame.addEventListener('error',()=>reject(new Error('Lucky Draw failed to load')),{once:true});\n        frame.src=buildLuckyDonorURL();\n        loaded=true;\n      }catch(error){reject(error)}\n    });\n  }\n  async function openLucky(){\n    const tr=window.APEX_SCENE_TRANSITION;\n    if(tr?.active?.())return;\n    const prepare=async()=>{\n      await ensureLuckyReady();\n      await tr?.prepareElement?.(host);\n    };\n    const commit=()=>{\n      host.classList.add('is-open');host.setAttribute('aria-hidden','false');\n      APEX_GOLD.onSurface&&APEX_GOLD.onSurface('lucky');\n      uiSfx('lucky.draw.enter_bay');\n    };\n    if(!tr?.run){try{await prepare();commit()}catch(err){console.error('[APEX Lucky Draw] donor load failed',err)}return}\n    const result=await tr.run({\n      name:'home->lucky',\n      source:()=>document.getElementById('stage'),\n      target:()=>host,\n      prepare,\n      commit,\n      rollback:()=>{},\n    });\n    if(result?.ok===false)console.error('[APEX Lucky Draw] transition recovered.',result.error);\n  }\n  async function closeLucky(){\n    const tr=window.APEX_SCENE_TRANSITION;\n    if(tr?.active?.())return;\n    const commit=()=>{\n      host.classList.remove('is-open');host.setAttribute('aria-hidden','true');\n      APEX_GOLD.onSurface&&APEX_GOLD.onSurface('home');\n    };\n    if(!tr?.run){commit();openBtn?.focus?.({preventScroll:true});return}\n    await tr.run({\n      name:'lucky->home',\n      source:()=>host,\n      target:()=>document.getElementById('stage'),\n      prepare:()=>tr.prepareElement(document.getElementById('stage')),\n      commit,\n      rollback:()=>{},\n    });\n    openBtn?.focus?.({preventScroll:true});\n  }\n  openBtn?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();void openLucky();});\n  window.addEventListener('message',e=>{if(e?.data?.type==='APEX_CHAOS_LUCKY_DRAW_EXIT')void closeLucky();});\n  window.addEventListener('keydown',e=>{if(window.APEX_SCENE_TRANSITION?.active?.()){e.preventDefault();return}if(e.key==='Escape'&&host.classList.contains('is-open')){e.preventDefault();void closeLucky();}},true);\n",
    'Lucky Draw coordinator'
  );

  const forbidden = [
    "function uiFocusMove(){  function uiFocusMove(){",
    "addEventListener('message',e=>{  addEventListener('message',e=>{",
    "window.APEX_GOLD_SHELL_NAVIGATE=navigateGoldShell;  window.APEX_GOLD_SHELL_NAVIGATE=navigateGoldShell;",
    "openBtn?.addEventListener('click',e=>{  openBtn?.addEventListener('click',e=>{",
  ];
  for (const token of forbidden) {
    if (out.includes(token)) throw new Error('R50K duplicate shell seam survived: ' + token.slice(0, 48));
  }

  const required = [
    "window.APEX_SCENE_TRANSITION",
    "name:`${screen}->${next}`",
    "name:'fighter->battle'",
    "name:'battle->fighter'",
    "name:'home->lucky'",
    "name:'lucky->home'",
    "Battle runtime did not report READY",
    "Mechanical Door V4 has no shortcut/cancel path",
    "if(window.APEX_SCENE_TRANSITION?.active?.()){e.preventDefault();return}",
  ];
  for (const token of required) {
    if (!out.includes(token)) throw new Error('R50K shell invariant missing: ' + token);
  }
  return out;
}
