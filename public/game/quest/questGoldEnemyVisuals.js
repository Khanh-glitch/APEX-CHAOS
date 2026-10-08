/* CP04 Gold V12 visual bridge — QUEST-ONLY.
 * Visual palette/physical silhouette is ported from the owner's standalone
 * APEX_CHAOS_QUEST1_DEEPER_WEAPON_GRIP_V12.html, not the prototype combat.
 * Note: this is a lightweight real-canvas adaptation of Scout/Bulwark
 * geometry, NOT a pixel-perfect transplant of the complete V12 spring rig.
 * The actual Arsenal Fighter is the ONLY position/HP/equipment owner.
 */
(function installQuestGoldEnemyVisuals(root) {
  'use strict';
  if (root.APEX_QUEST_GOLD_ENEMIES) return;
  const V12 = Object.freeze({
    scout: {
      base:'#b0602e',light:'#e09a5a',dark:'#5b2c17',metal:'#5d646b',
      metalDark:'#2a2d31',metalLight:'#9aa3ab',accent:'#e8a21a',
      accent2:'#ffd36a',glow:'#ffa000'
    },
    bulwark: {
      base:'#6f7f90',light:'#a9b9c9',dark:'#34414e',metal:'#4a525a',
      metalDark:'#20252b',metalLight:'#9aa6b2',accent:'#f2b705',
      accent2:'#ffd84a',glow:'#ff3b30'
    },
    reaver: {
      base:'#a8242b',light:'#d9535a',dark:'#4b0f14',metal:'#3b3f46',
      metalDark:'#17181c',metalLight:'#8b919a',accent:'#ff7a1a',
      accent2:'#ffb347',glow:'#ff3b1f'
    },
    sentinel: {
      base:'#4f6f90',light:'#8fb4d6',dark:'#223347',metal:'#58626e',
      metalDark:'#1a2129',metalLight:'#a7b4c2',accent:'#31e0ff',
      accent2:'#a8f3ff',glow:'#35e8ff'
    },
    // Owner-selected Gold fifth chassis: white/amber OPERATOR is a TEMPORARY
    // art stand-in for T.O.T. No copied OPERATOR combat/skills.
    operator: {
      base:'#e8e2d2',light:'#ffffff',dark:'#8c8573',metal:'#3a3d42',
      metalDark:'#141518',metalLight:'#a9adb3',accent:'#f0a31a',
      accent2:'#ffd27a',glow:'#ffb02e'
    }
  });
  const path = (c,points,fill,stroke='#14181d',width=3) => {
    c.beginPath();
    for(let i=0;i<points.length;i++){
      const [x,y]=points[i];
      if(i) c.lineTo(x,y); else c.moveTo(x,y);
    }
    c.closePath();
    c.fillStyle=fill; c.fill();
    if(stroke){ c.strokeStyle=stroke; c.lineWidth=width; c.stroke(); }
  };
  const bolt = (c,x,y,r,p) => {
    c.beginPath();c.arc(x,y,r,0,Math.PI*2);
    c.fillStyle=p.metalDark;c.fill();
    c.strokeStyle=p.metalLight;c.lineWidth=2;c.stroke();
    c.beginPath();c.moveTo(x-r*.45,y+r*.3);c.lineTo(x+r*.45,y-r*.3);c.stroke();
  };
  const arm = (c,side,p,v,phase,armed) => {
    c.save();c.scale(1,side);
    c.translate(0, -44);c.rotate((side===1?1:-1)*phase);
    path(c,[[-25,-12],[4,-20],[28,-8],[28,40],[15,49],[-15,36]],p.metal);
    path(c,[[-18,24],[19,21],[27,42],[9,63],[-23,50]],p.base);
    bolt(c,2,10,8,p);
    if(v==='reaver') {
      path(c,[[-31,52],[-7,70],[-13,94],[-43,71]],p.light);
      path(c,[[15,52],[35,72],[14,92],[6,75]],p.accent);
    } else if(v==='bulwark') {
      path(c,[[-31,17],[15,13],[35,49],[18,69],[-25,56]],p.light);
      path(c,[[-26,30],[13,26],[22,44],[-18,48]],p.metalDark);
    } else {
      path(c,[[-19,55],[9,61],[1,86],[-17,82]],p.metalLight);
    }
    if(armed){
      c.strokeStyle=p.accent2;c.lineWidth=2;
      c.beginPath();c.moveTo(-8,22);c.lineTo(10,30);c.stroke();
    }
    c.restore();
  };
  function draw(c,f) {
    if(!f || !V12[f.questVisualId]) return false;
    // Exact-owner V12 is the preferred per-fighter visual; preserve this CP04
    // palette silhouette only as an observable compatibility fallback.
    if(root.APEX_QUEST_V12_RIG?.draw?.(c,f)) {
      // Preserve CP04's existing count for ANY real Gold-family body draw;
      // the V12 adapter separately counts exact owner-rig frames.
      root.__apexQuestGoldDraws = (root.__apexQuestGoldDraws || 0) + 1;
      return true;
    }
    const v=f.questVisualId,p=V12[v];
    const now=Number(root.APEX_ARSENAL?.state?.time||0);
    const phi=Math.sin(now*(v==='scout'?4.3:v==='reaver'?3.8:2.6)+(f.id||0));
    const armed=!!root.APEX_ARSENAL?.weaponApi?.getHolder?.(f);
    c.save();
    // CP04 fallback also faces forward rather than inheriting the physical
    // auto-movement heading from Fighter.draw; gameplay movement is untouched.
    const dirX=Number.isFinite(f.dir?.x)?f.dir.x:1;
    const dirY=Number.isFinite(f.dir?.y)?f.dir.y:0;
    c.rotate(-Math.atan2(dirY,dirX));
    const scale=Math.max(.4,Math.min(1.1,(f.radius||75)/76));
    c.scale(scale,scale);
    c.shadowColor=p.glow;c.shadowBlur=5;
    // Heel runners/rotors, mirrored in local frame, no fabricated world motion.
    for(const side of [-1,1]){
      c.save();c.scale(1,side);
      path(c,[[-42,-32],[-19,-42],[30,-36],[41,-21],[43,35],[22,46],[-30,36]],p.metalDark);
      path(c,[[20,-39],[46,-25],[52,31],[24,45]],p.metal);
      path(c,[[33,-13],[42,-4],[43,22],[30,26]],p.light);
      c.restore();
    }
    arm(c,-1,p,v,phi*.06,armed);arm(c,1,p,v,-phi*.06,armed);
    // Gold V12 plate family: upper angular shell, dark bite seam, core.
    const body=v==='bulwark'
      ? [[-49,-39],[48,-39],[62,-5],[48,57],[-49,57],[-60,-5]]
      : v==='reaver'
      ? [[-28,-57],[40,-42],[55,6],[24,59],[-43,46],[-58,-10]]
      : v==='sentinel'
      ? [[0,-65],[55,-20],[45,45],[0,62],[-49,45],[-57,-20]]
      : [[-40,-42],[40,-42],[53,-7],[36,58],[-38,58],[-51,-8]];
    path(c,body,p.metalDark);
    path(c,body.map(([x,y])=>[x*.81,y*.78+1]),p.base);
    if(v==='scout') {
      path(c,[[-47,-20],[48,-20],[38,-4],[-39,-4]],'#15161a');
      path(c,[[-36,-40],[-17,-51],[-6,-37]],p.dark);
      path(c,[[36,-40],[17,-51],[6,-37]],p.dark);
    } else if(v==='bulwark') {
      path(c,[[-45,-51],[45,-51],[53,-23],[-53,-23]],p.light);
      path(c,[[-40,7],[39,7],[31,43],[-32,43]],p.metal);
    } else if(v==='reaver') {
      path(c,[[-48,-38],[-68,-56],[-67,-9],[-44,-3]],p.dark);
      path(c,[[48,-38],[69,-56],[67,-9],[44,-3]],p.dark);
    } else {
      path(c,[[0,-65],[24,-28],[0,-4],[-24,-28]],p.light);
      path(c,[[-46,-22],[-23,-38],[-9,-15],[-29,7]],p.dark);
      path(c,[[46,-22],[23,-38],[9,-15],[29,7]],p.dark);
    }
    path(c,[[-39,-13],[37,-13],[28,5],[-30,5]],p.metalDark);
    c.beginPath();c.arc(0,26,14,0,Math.PI*2);c.fillStyle='#151a1f';c.fill();
    c.beginPath();c.arc(0,26,9+Math.sin(now*3.1)*.7,0,Math.PI*2);c.fillStyle=p.glow;c.fill();
    c.shadowBlur=0;
    for(const side of [-1,1]){
      bolt(c,side*30,39,3,p);bolt(c,side*32,-32,3,p);
    }
    // Actual HP source only. No synthetic armor or power indicators.
    c.restore();
    // Diagnostic only: counts REAL world-canvas enemy draws for the headless
    // acceptance harness. Does not feed simulation or collision.
    root.__apexQuestGoldDraws = (root.__apexQuestGoldDraws || 0) + 1;
    return true;
  }
  root.APEX_QUEST_GOLD_ENEMIES=Object.freeze({ draw, palettes:V12 });
  root.apexQuestGoldEnemyVisuals='ready';
})(typeof window !== 'undefined' ? window : globalThis);
