// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function SLIME_BODY_CAP_PATCH(){
  const oldUpdateCap = update;
  update = function(dt){
    oldUpdateCap(dt);
    try {
      const teams = new Map();
      for (const f of fighters || []) if (f && f.name === 'SLIME' && f.hp > 0) {
        const tid = f.teamId ?? f.id;
        if (!teams.has(tid)) teams.set(tid, []);
        teams.get(tid).push(f);
      }
      for (const [, arr] of teams) {
        arr.sort((a,b)=>(a.data?.cloneDepth||0)-(b.data?.cloneDepth||0) || b.hp-a.hp);
        for (const extra of arr.slice(4)) extra.hp = 0;
      }
      for (let i=fighters.length-1;i>=2;i--) if (!fighters[i] || fighters[i].hp <= 0) fighters.splice(i,1);
    } catch(e) { console.error('[Slime body cap recovered]', e); }
  };
})();
