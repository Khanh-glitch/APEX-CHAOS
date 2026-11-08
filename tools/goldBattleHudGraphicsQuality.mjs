// R-GFX-HUD: graphics-quality consumer for the Gold battle HUD.
// Source-owned; never edit only the generated HUD (buildGoldCutover.mjs
// regenerates public/gold/battle-hud.html from docs/gold-ui/current).
//
// WHY: the HUD document must project the ONE graphics-quality authority
// (public/game/core/graphicsQualityAuthority.js) onto #hud[data-gfx] so the
// in-document renderers and the acceptance/diagnostic suites can see the
// active mode without a second source of truth. The HUD never decides the
// mode: it adopts it from (a) this frame's own authority when the HUD is
// opened standalone, or (b) the same-origin parent shell mirror. Switching is
// applied immediately, with no reload and no HUD layout change - PERFORMANCE
// only removes duplicated render work, never HUD information.
//
// Insertion point: immediately before the handoff bridge, i.e. after every
// canonical HUD style/script, so the consumer boots with the donor DOM present
// and cannot be reordered by a later patch.
const STYLE_ID = 'apex-hud-graphics-quality-style';
const SCRIPT_ID = 'apex-hud-graphics-quality-script';

export function adaptGoldBattleHudGraphicsQuality(html) {
  if (typeof html !== 'string' || !html) {
    throw new Error('R-GFX-HUD: battle HUD source must be a non-empty string');
  }
  if (html.includes(STYLE_ID) || html.includes(SCRIPT_ID)) {
    throw new Error('R-GFX-HUD: graphics-quality block already present (double patch)');
  }
  const anchor = '<style id="apex-handoff-bridge-style">';
  const hits = html.split(anchor).length - 1;
  if (hits !== 1) {
    throw new Error(`R-GFX-HUD: expected exactly 1 handoff-bridge anchor, found ${hits}`);
  }
  const block = String.raw`<style id="apex-hud-graphics-quality-style">
/* Graphics-quality consumer inside the battle HUD document. The mode is NOT
 * decided here: it is adopted from the ONE authority (same-origin mirror from
 * the shell, or this frame's own authority when the HUD is opened standalone).
 * The only thing this file owns is the visual contract that follows a mode,
 * plus projecting the active mode onto #hud[data-gfx] for diagnostics and
 * tests. */
#hud[data-gfx="high"] { --apex-hud-gfx: "high"; }
#hud[data-gfx="performance"] .apex-vfx-heavy {
  /* Authored heavy-effect containers keep their layout; nothing is hidden. */
  will-change: auto;
  contain: layout paint;
}
</style>
<script id="apex-hud-graphics-quality-script">
(function apexHudGraphicsQualityConsumer(global){
  'use strict';
  if(global.APEX_HUD_GRAPHICS_QUALITY) return;
  var VERSION='apex-hud-graphics-1';
  var hud=null;
  function hudEl(){ return hud||(hud=document.getElementById('hud')); }
  function project(mode){
    var el=hudEl();
    if(el){ el.setAttribute('data-gfx',mode); el.dataset.gfxSource='authority'; }
    global.__APEX_HUD_QUALITY_MODE=mode;
    // Renderers inside this document may read the HUD projection without a
    // second authority. Kept as the plain string so a classic script needs no
    // object shape.
    return mode;
  }
  function localAuthority(){ return global.APEX_GRAPHICS_QUALITY||null; }
  var mode='high';
  function adopt(next,source){
    if(next!=='high'&&next!=='performance') return;
    mode=next;
    project(mode);
    try{
      global.dispatchEvent(new CustomEvent('apex-hud-graphics-quality',{detail:{mode:mode,source:source||'adopt'}}));
    }catch(e){}
  }
  // Boot: prefer the frame's own authority (it may already be a writer when the
  // HUD is opened directly), otherwise ask the parent shell for its mode.
  function boot(){
    var a=localAuthority();
    if(a&&typeof a.mode==='string'){ adopt(a.mode,'local-authority'); }
    else { project(mode); }
    try{
      if(global.parent&&global.parent!==global){
        global.parent.postMessage({type:'apex:graphics-quality-ask'},'*');
      }
    }catch(e){}
  }
  global.addEventListener('message',function(event){
    var data=event&&event.data;
    if(!data||typeof data!=='object') return;
    if(data.type==='apex:graphics-quality-mirror'||data.type==='apex:graphics-quality-state'){
      var next=data.detail&&data.detail.mode;
      if(next){ adopt(next,'parent-mirror'); }
    }
  });
  global.addEventListener('apex-graphics-quality',function(event){
    var next=event&&event.detail&&event.detail.mode;
    if(next) adopt(next,'local-event');
  });
  var api={
    version:VERSION,
    get mode(){return mode;},
    adopt:adopt,
    project:project,
    boot:boot,
    _test:{set:adopt}
  };
  try{Object.defineProperty(global,'APEX_HUD_GRAPHICS_QUALITY',{value:api,writable:false,configurable:true,enumerable:true});}
  catch(e){global.APEX_HUD_GRAPHICS_QUALITY=api;}
  boot();
  // The HUD donor boots before the shell may have mounted this frame's
  // authority; re-read once the document settles.
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }
})(typeof window!=='undefined'?window:globalThis);
</script>
`;
  const out = html.replace(anchor, block + '\n' + anchor);
  if (!out.includes(SCRIPT_ID)) {
    throw new Error('R-GFX-HUD: patch did not apply');
  }
  return out;
}
