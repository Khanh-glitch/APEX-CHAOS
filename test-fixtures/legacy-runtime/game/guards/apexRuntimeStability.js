// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function GLOBAL_RUNTIME_STABILITY_GUARD(){
  let updateErrors = 0, drawErrors = 0;
  const rawUpdateStable = update;
  const rawDrawStable = draw;
  function stableClean() {
    try {
      for (const f of fighters || []) {
        if (!f) continue;
        if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) { f.x = GAME_SIZE/2; f.y = GAME_SIZE/2; }
        if (!Number.isFinite(f.hp)) f.hp = Math.max(1, f.maxHp || 100);
        const r = f.radius || 40;
        f.x = clamp(f.x, r, GAME_SIZE-r); f.y = clamp(f.y, r, GAME_SIZE-r);
        if (!f.dir || !Number.isFinite(f.dir.x) || !Number.isFinite(f.dir.y)) f.dir = norm(rand(-1,1), rand(-1,1));
      }
      // Absolute safety cap: Slime mitosis must be visible but cannot create endless live bodies.
      const slimeTeams = new Map();
      for (const f of fighters || []) if (f && f.name === 'SLIME' && f.hp > 0) {
        const tid = f.teamId ?? f.id;
        if (!slimeTeams.has(tid)) slimeTeams.set(tid, []);
        slimeTeams.get(tid).push(f);
      }
      for (const [, arr] of slimeTeams) {
        arr.sort((a,b)=>(a.data?.cloneDepth||0)-(b.data?.cloneDepth||0) || b.hp-a.hp);
        for (const extra of arr.slice(4)) extra.hp = 0;
      }
      for (let i=fighters.length-1;i>=2;i--) if (!fighters[i] || fighters[i].hp <= 0) fighters.splice(i,1);
      for (let i=projectiles.length-1;i>=0;i--) {
        const p=projectiles[i];
        if(!p || p.life<=0 || p.hp<=0 || (p.x!==undefined && (!Number.isFinite(p.x)||!Number.isFinite(p.y)))) projectiles.splice(i,1);
      }
      if (projectiles.length > 180) projectiles.splice(0, projectiles.length - 180);
      if (particles.length > 350) particles.splice(0, particles.length - 350);
      if (floatingTexts.length > 120) floatingTexts.splice(0, floatingTexts.length - 120);
      if (shockwaves.length > 80) shockwaves.splice(0, shockwaves.length - 80);
    } catch (_) {}
  }
  update = function(dt){
    try {
      rawUpdateStable(Math.min(0.033, Math.max(0, dt || 0)));
    } catch (err) {
      updateErrors++;
      console.error('[Apex runtime update recovered]', err);
      stableClean();
    }
  };
  draw = function(){
    try {
      rawDrawStable();
    } catch (err) {
      drawErrors++;
      console.error('[Apex runtime draw recovered]', err);
      try {
        ctx.setTransform && ctx.setTransform(1,0,0,1,0,0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = 'none';
        updateHUD();
      } catch (_) {}
      stableClean();
    }
  };
})();
