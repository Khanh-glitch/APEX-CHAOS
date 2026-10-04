// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function APEX_SHOTGUN_LATE_BINDER(){
  if (window.__apexShotgunLateBinder) return;
  const S=window.APEX_SHOTGUN;
  if (!S) return;
  window.__apexShotgunLateBinder=true;
  const hideBattleText=()=>false;
  function withoutBattleText(ctx,fn){
    if(!hideBattleText())return fn();
    const fill=ctx.fillText,stroke=ctx.strokeText;ctx.fillText=()=>{};ctx.strokeText=()=>{};
    try{return fn();}finally{ctx.fillText=fill;ctx.strokeText=stroke;}
  }
  const previousUpdateShotgunLate=update;
  update=function(dt){const result=previousUpdateShotgunLate(dt);if(gameState==='SOLO'){const st=window.__solo375;if(st){S.soloAdvanceMotion?.(st,st.p1);S.soloAdvanceMotion?.(st,st.p2);}}S.updateVfx(dt);return result;};
  const previousDrawShotgunLate=drawProjectiles;
  drawProjectiles=function(ctx){const result=withoutBattleText(ctx,()=>previousDrawShotgunLate(ctx));S.drawVfx(ctx);return result;};
  const previousFighterDrawShotgunLate=Fighter.prototype.draw;
  Fighter.prototype.draw=function(ctx){return withoutBattleText(ctx,()=>previousFighterDrawShotgunLate.call(this,ctx));};
  window.update=update;
  window.drawProjectiles=drawProjectiles;
})();
