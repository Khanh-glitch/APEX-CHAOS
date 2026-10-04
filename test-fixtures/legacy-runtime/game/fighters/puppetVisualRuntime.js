// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function puppetVisualAssetIntegration(){
  try {
    const BASE = 'assets/puppet_v1/normalized/';
    const PUPPET_ASSET_MANIFEST = {
      puppetMainStatic: BASE + 'puppet_main_static.webp',
      strawMonsterStatic: BASE + 'straw_monster_static.webp',
      puppetDissolve16: BASE + 'puppet_dissolve_16.webp',
      puppetRageStatic: BASE + 'puppet_rage_static.webp',
      strawMonsterAttack16: BASE + 'straw_monster_attack_16.webp',
      effigyWall4: BASE + 'effigy_wall_4.webp',
      transferLink16: BASE + 'transfer_link_16.webp',
      finalCardLaunch16: null,
      finalCardValues: null
    };
    const ASSETS = {};
    const visualLog = {
      source: 'assets/puppet_v1/normalized/manifest.json',
      roles: Object.assign({}, PUPPET_ASSET_MANIFEST),
      fallbacks: { puppetCard: 'procedural gold-purple cursed card; no final-card asset was present' }
    };
    const puppetVisualEvents = [];
    const nowMs = () => performance.now();
    const easeOut = t => 1 - Math.pow(1 - clamp(t,0,1), 3);
    const easeInOut = t => t < .5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2;
    function asset(role){ return ASSETS[role]; }
    function imageW(img){ return img ? (img.naturalWidth || img.width || 0) : 0; }
    function imageH(img){ return img ? (img.naturalHeight || img.height || 0) : 0; }
    function ready(role){ const a = asset(role); return !!(a && a.ready && a.img && imageW(a.img) > 0 && imageH(a.img) > 0); }
    function transparentizeDarkBackground(img, role){
      try {
        const w = imageW(img), h = imageH(img);
        if (!w || !h) return img;
        const scratch = document.createElement('canvas');
        scratch.width = w; scratch.height = h;
        const sctx = scratch.getContext('2d');
        sctx.drawImage(img,0,0,w,h);
        const data = sctx.getImageData(0,0,w,h);
        const px = data.data;
        for (let i=0;i<px.length;i+=4) {
          const r=px[i], g=px[i+1], b=px[i+2], a=px[i+3];
          const max=Math.max(r,g,b), min=Math.min(r,g,b), chroma=max-min;
          if (a > 0 && (max < 16 || (max < 38 && chroma < 9))) px[i+3] = 0;
          else if (a > 0 && max < 58 && chroma < 10) px[i+3] = Math.min(a, Math.max(0, (max-38)/20) * a);
        }
        sctx.putImageData(data,0,0);
        scratch.__puppetProcessedCanvas = true;
        return scratch;
      } catch (err) {
        visualLog.fallbacks[role] = 'dark-background alpha processing skipped: ' + (err && err.name ? err.name : 'pixel read blocked');
        return img;
      }
    }
    function loadPuppetAssets(){
      // CP6: chunked onload preprocessing (see arcade/musician runtimes) —
      // one asset per idle slot instead of a coalesced main-thread stall.
      const prepQueue = [];
      let prepDraining = false;
      const drainPrep = () => {
        if (prepDraining) return;
        prepDraining = true;
        const step = () => {
          const task = prepQueue.shift();
          if (task) { try { task(); } catch (err) {} }
          if (prepQueue.length) {
            if (typeof requestIdleCallback === 'function') requestIdleCallback(step, { timeout: 200 });
            else setTimeout(step, 0);
          } else prepDraining = false;
        };
        if (typeof requestIdleCallback === 'function') requestIdleCallback(step, { timeout: 200 });
        else setTimeout(step, 0);
      };
      for (const [role, src] of Object.entries(PUPPET_ASSET_MANIFEST)) {
        if (!src) { ASSETS[role] = {role, src:null, loaded:false, failed:true, ready:false, fallback:true}; continue; }
        const img = new Image();
        const rec = ASSETS[role] = {role, src, img, loaded:false, failed:false, ready:false};
        img.onload = () => {
          prepQueue.push(() => {
            rec.loaded = true;
            rec.img = transparentizeDarkBackground(img, role);
            rec.ready = true;
            rec.w = imageW(rec.img);
            rec.h = imageH(rec.img);
          });
          drainPrep();
        };
        img.onerror = () => { rec.failed = true; rec.ready = false; rec.error = 'load failed'; };
        img.src = src;
      }
    }
    function drawAsset(ctx, role, x, y, w, h, alpha=1, opts={}){
      if (!ready(role)) return false;
      ctx.save();
      ctx.globalAlpha *= alpha;
      if (opts.blend) ctx.globalCompositeOperation = opts.blend;
      if (opts.rotation) { ctx.translate(x,y); ctx.rotate(opts.rotation); x=0; y=0; }
      ctx.drawImage(asset(role).img, x-w/2, y-h/2, w, h);
      ctx.restore();
      return true;
    }
    function drawGridFrame(ctx, role, frame, x, y, w, h, alpha=1, opts={}){
      if (!ready(role)) return false;
      const img = asset(role).img;
      const fw = imageW(img) / 4, fh = imageH(img) / 4;
      const idx = clamp(Math.floor(frame),0,15);
      const sx = (idx % 4) * fw, sy = Math.floor(idx / 4) * fh;
      ctx.save();
      ctx.globalAlpha *= alpha;
      if (opts.blend) ctx.globalCompositeOperation = opts.blend;
      if (opts.rotation) { ctx.translate(x,y); ctx.rotate(opts.rotation); x=0; y=0; }
      ctx.drawImage(img, sx, sy, fw, fh, x-w/2, y-h/2, w, h);
      ctx.restore();
      return true;
    }
    function drawEffigyCrop(ctx, wall, x, y, w, h, alpha=1){
      if (!ready('effigyWall4')) return false;
      const img = asset('effigyWall4').img;
      const cw = imageW(img) / 2, ch = imageH(img) / 2;
      const map = {top:[0,0], right:[1,0], bottom:[0,1], left:[1,1]};
      const q = map[wall] || map.top;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.drawImage(img, q[0]*cw, q[1]*ch, cw, ch, x-w/2, y-h/2, w, h);
      ctx.restore();
      return true;
    }
    function puppetWorldSource(f){
      if (!f) return {x:0,y:0};
      return {x:f.x + (f.dir?.x||0)*8, y:f.y - Math.max(10, (f.radius||70)*.18)};
    }
    function effigyWorldAnchor(p){
      const r = p.radius || 70;
      let x = p.x, y = p.y;
      if (p.wall === 'top') y += r * .42;
      if (p.wall === 'bottom') y -= r * .42;
      if (p.wall === 'left') x += r * .42;
      if (p.wall === 'right') x -= r * .42;
      return {x,y};
    }
    function enemyOfPuppetVisual(owner){
      if (!owner) return null;
      return fighters.find(f => f && f !== owner && f.hp > 0 && ((f.teamId ?? f.id) !== (owner.teamId ?? owner.id))) ||
             fighters.find(f => f && f !== owner && f.hp > 0) ||
             null;
    }
    function setEffigyVisualPosition(p){
      const sideInset = Math.max(68, (p.radius||75) * .9);
      const verticalInset = Math.max(118, (p.radius||75) * 1.55);
      if (p.wall === 'top') p.y = verticalInset;
      if (p.wall === 'bottom') p.y = GAME_SIZE - verticalInset;
      if (p.wall === 'left') p.x = sideInset;
      if (p.wall === 'right') p.x = GAME_SIZE - sideInset;
      p.x = clamp(p.x, sideInset, GAME_SIZE - sideInset);
      p.y = clamp(p.y, verticalInset, GAME_SIZE - verticalInset);
    }
    function traceCracks(ctx, x, y, w, h, seed, severity){
      const count = Math.ceil(2 + severity * 7);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = severity > .55 ? 'rgba(151,255,142,.92)' : 'rgba(208,108,255,.78)';
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.6 + severity * 1.7;
      let s = Math.sin((seed||1)*9973) * 9999;
      const rnd = () => { s = Math.sin(s + 12.9898) * 43758.5453; return s - Math.floor(s); };
      for (let i=0;i<count;i++) {
        const ox = (rnd()-.5) * w * .44, oy = (rnd()-.5) * h * .46;
        ctx.beginPath();
        ctx.moveTo(x+ox, y+oy);
        const len = (10 + rnd()*22) * (1+severity);
        const ang = rnd()*TAU;
        ctx.lineTo(x+ox+Math.cos(ang)*len, y+oy+Math.sin(ang)*len);
        if (rnd()>.45) ctx.lineTo(x+ox+Math.cos(ang+.9)*(len*.55), y+oy+Math.sin(ang+.9)*(len*.55));
        ctx.stroke();
      }
      ctx.restore();
    }
    function drawFallbackPuppet(ctx, f, oldDraw){
      if (oldDraw) return oldDraw(ctx,f);
      drawPolygon(ctx,[[-42,-62],[42,-62],[56,42],[0,72],[-56,42]],'#4b2d1c','#d7b27a',5);
      ctx.fillStyle='#f1d8a8';ctx.font='900 15px serif';ctx.textAlign='center';ctx.fillText('PUPPET',0,12);
    }
    function drawPuppetBody(ctx, f, oldDraw){
      const angle = Math.atan2(f.dir?.y || 0, f.dir?.x || 1);
      ctx.save();
      ctx.rotate(-angle);
      const t = nowMs() * .001;
      const bob = Math.sin(t*3.2 + (f.id||0)) * 2.4;
      const r = f.radius || 72;
      const size = r * 3.05;
      const dying = f.hp <= 0 && !(f.data && f.data.finalCardActive);
      if (dying) {
        f.visual ||= {};
        f.visual.puppetDefeatStart ||= nowMs();
        const elapsed = nowMs() - f.visual.puppetDefeatStart;
        const frame = Math.min(15, Math.floor(elapsed / 62));
        if (drawGridFrame(ctx, 'puppetDissolve16', frame, 0, bob, size*1.25, size*1.25, Math.max(0,1-elapsed/1000), {blend:'lighter'})) {
          ctx.restore();
          return;
        }
      }
      if (!drawAsset(ctx, 'puppetMainStatic', 0, bob, size, size, 1)) {
        ctx.restore();
        drawFallbackPuppet(ctx, f, oldDraw);
        return;
      }
      const sourcePulse = f.visual && f.visual.puppetSourcePulse ? Math.max(0, 1 - (nowMs() - f.visual.puppetSourcePulse) / 420) : 0;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .22 + .18*Math.sin(t*5.1) + sourcePulse*.65;
      ctx.fillStyle = sourcePulse > 0 ? '#d370ff' : '#8fff86';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 22 + sourcePulse*24;
      ctx.beginPath();
      ctx.ellipse(0, -r*.18 + bob, r*.33 + sourcePulse*10, r*.18 + sourcePulse*5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      if (f.data && f.data.finalCardActive) {
        f.visual ||= {};
        f.visual.finalCardStart ||= nowMs();
        const timer = f.data.cardTimer ?? 5;
        const flash = Math.max(0, 1 - (nowMs() - f.visual.finalCardStart) / 700);
        const a = clamp(.28 + timer/5*.32 + flash*.35, .2, .95);
        drawAsset(ctx, 'puppetRageStatic', 0, bob, size*1.1, size*1.1, a, {blend:'lighter'});
        ctx.save();
        ctx.globalCompositeOperation='lighter';
        ctx.strokeStyle='rgba(187,93,255,.75)';
        ctx.lineWidth=3 + flash*4;
        ctx.setLineDash([10,10]);
        ctx.lineDashOffset = -nowMs()/38;
        ctx.beginPath();
        ctx.arc(0,bob,r*1.25 + flash*18,0,TAU);
        ctx.stroke();
        ctx.restore();
      } else if (f.visual) {
        f.visual.finalCardStart = 0;
      }
      ctx.restore();
    }
    function drawPuppetEffigy(ctx, p){
      p.visualSpawnMs ||= nowMs();
      setEffigyVisualPosition(p);
      const age = (nowMs() - p.visualSpawnMs) / 1000;
      const hpRatio = clamp((p.hp ?? 7) / (p.maxHp || 7), 0, 1);
      const r = p.radius || 75;
      const size = r * 1.42;
      const flicker = hpRatio < .35 ? .84 + Math.sin(nowMs()/35 + (p.order||0))* .16 : 1;
      const alpha = clamp(flicker * (p.life === Infinity ? 1 : Math.min(1, (p.life||1)/.28)), .12, 1);
      if (!drawEffigyCrop(ctx, p.wall, p.x, p.y, size, size, alpha)) {
        ctx.save();
        ctx.globalAlpha = alpha*.86;
        drawPolygon(ctx,[[p.x-35,p.y-46],[p.x+35,p.y-46],[p.x+42,p.y+36],[p.x,p.y+56],[p.x-42,p.y+36]],'#6b4428','#d7b27a',4);
        ctx.restore();
      }
      if (age < .35) {
        const k = age/.35;
        ctx.save();
        ctx.globalCompositeOperation='lighter';
        ctx.globalAlpha=(1-k)*.82;
        ctx.strokeStyle='#88ff8e';
        ctx.lineWidth=5;
        ctx.beginPath();
        ctx.arc(p.x,p.y, size*.25 + k*size*.42,0,TAU);
        ctx.stroke();
        ctx.strokeStyle='#b66cff';
        ctx.setLineDash([8,7]);
        ctx.lineDashOffset = -nowMs()/28;
        ctx.beginPath();
        ctx.arc(p.x,p.y, size*.45 + k*size*.2,0,TAU);
        ctx.stroke();
        ctx.restore();
      }
      if (hpRatio < .72) {
        traceCracks(ctx, p.x, p.y, size, size, p.order || p.x*3+p.y, 1-hpRatio);
      }
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha = .35 + (1-hpRatio)*.45;
      ctx.strokeStyle = hpRatio > .5 ? 'rgba(122,255,152,.75)' : 'rgba(218,90,255,.88)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x,p.y,size*.48, -Math.PI/2, -Math.PI/2 + TAU*hpRatio);
      ctx.stroke();
      ctx.restore();
    }
    function curvePoint(a,b,c,t){
      const mt = 1-t;
      return {x:mt*mt*a.x + 2*mt*t*b.x + t*t*c.x, y:mt*mt*a.y + 2*mt*t*b.y + t*t*c.y};
    }
    function findLinkTarget(p){
      if (p.targetEffigy && p.targetEffigy.life > 0) return p.targetEffigy;
      if (p.targetOrder !== undefined) {
        const exact = projectiles.find(q=>q.type==='puppet_effigy' && q.owner===p.owner && q.order===p.targetOrder);
        if (exact) return exact;
      }
      let best = null, bd = Infinity;
      for (const q of projectiles) {
        if (!q || q.type !== 'puppet_effigy' || q.owner !== p.owner || q.hp <= 0 || q.life <= 0) continue;
        const d = dist(q.x,q.y,p.x2||q.x,p.y2||q.y);
        if (d < bd) { best = q; bd = d; }
      }
      return best;
    }
    function drawPuppetTransferLinkDynamic(ctx, p){
      const owner = p.owner;
      const target = findLinkTarget(p);
      const src = owner ? puppetWorldSource(owner) : {x:p.x1,y:p.y1};
      const dst = target ? effigyWorldAnchor(target) : {x:p.x2,y:p.y2};
      const life = Math.max(0, p.life ?? .01), max = Math.max(.01, p.maxLife || .42);
      const u = clamp(1 - life/max, 0, 1);
      const alpha = Math.sin(Math.PI*u) * .95 + .05;
      const dx = dst.x-src.x, dy = dst.y-src.y;
      const len = Math.max(1, Math.hypot(dx,dy));
      const nx = -dy/len, ny = dx/len;
      const sag = Math.min(70, len*.14) * Math.sin(nowMs()/72 + len*.017);
      const control = {x:(src.x+dst.x)/2 + nx*sag, y:(src.y+dst.y)/2 + ny*sag - 20};
      const extend = u < .5 ? easeOut(u/.5) : 1;
      const fade = u > .76 ? 1 - (u-.76)/.24 : 1;
      const end = curvePoint(src, control, dst, extend);
      ctx.save();
      ctx.globalAlpha *= alpha * fade;
      ctx.globalCompositeOperation='lighter';
      const grad = ctx.createLinearGradient(src.x,src.y,dst.x,dst.y);
      grad.addColorStop(0,'rgba(213,72,255,.98)');
      grad.addColorStop(.55,'rgba(153,102,255,.9)');
      grad.addColorStop(1,'rgba(119,255,142,.98)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 7;
      ctx.shadowColor = '#9b52ff';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(src.x,src.y);
      ctx.quadraticCurveTo(control.x,control.y,end.x,end.y);
      ctx.stroke();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = 'rgba(230,255,222,.95)';
      ctx.setLineDash([11,9]);
      ctx.lineDashOffset = -nowMs()/24;
      ctx.beginPath();
      ctx.moveTo(src.x,src.y);
      ctx.quadraticCurveTo(control.x,control.y,end.x,end.y);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i=0;i<16;i++) {
        const tt = (i/15) * extend;
        const q = curvePoint(src, control, dst, tt);
        const pulse = Math.sin(nowMs()/62 + i*.9);
        ctx.fillStyle = i < 8 ? 'rgba(221,82,255,.9)' : 'rgba(133,255,141,.9)';
        ctx.beginPath();
        ctx.arc(q.x + nx*pulse*2.2, q.y + ny*pulse*2.2, 2.2 + (pulse+1)*.9, 0, TAU);
        ctx.fill();
      }
      const ep = u < .25 ? 0 : u < .5 ? 5 : u < .75 ? 10 : 15;
      drawGridFrame(ctx, 'transferLink16', ep, src.x, src.y, 52, 52, .65, {blend:'lighter'});
      if (extend > .94) drawGridFrame(ctx, 'transferLink16', 15, dst.x, dst.y, 58, 58, .75, {blend:'lighter'});
      if (owner) { owner.visual ||= {}; owner.visual.puppetSourcePulse = nowMs(); }
      if (target && u > .46 && u < .82) {
        target.visualHitMs = nowMs();
        ctx.fillStyle='rgba(128,255,143,.25)';
        ctx.beginPath();
        ctx.arc(dst.x,dst.y,28 + Math.sin(nowMs()/31)*5,0,TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    function recordPuppetMergeVisual(p){
      if (!p || p.visualMergeRecorded) return;
      p.visualMergeRecorded = true;
      p.visualSpawnMs = nowMs();
      const r = Math.max(46,p.radius||55);
      const from = [];
      const wall = p.wall || (p.x < 100 ? 'left' : p.x > 900 ? 'right' : p.y < 100 ? 'top' : p.y > 900 ? 'bottom' : 'top');
      for (let i=0;i<5;i++) {
        const offset = (i-2) * r*.75;
        from.push({
          x: wall==='left'||wall==='right' ? p.x : clamp(p.x+offset,60,940),
          y: wall==='top'||wall==='bottom' ? p.y : clamp(p.y+offset,60,940)
        });
      }
      puppetVisualEvents.push({type:'puppet_merge', x:p.x, y:p.y, from, start:nowMs(), life:.85, maxLife:.85});
    }
    function drawPuppetVisualEvents(ctx){
      for (let i=puppetVisualEvents.length-1;i>=0;i--) {
        const ev = puppetVisualEvents[i];
        const age = (nowMs() - ev.start) / 1000;
        const u = clamp(age / ev.maxLife, 0, 1);
        if (u >= 1) { puppetVisualEvents.splice(i,1); continue; }
        if (ev.type === 'puppet_merge') {
          ctx.save();
          ctx.globalCompositeOperation='lighter';
          ctx.globalAlpha = 1-u;
          for (const pt of ev.from) {
            const x = lerp(pt.x, ev.x, easeInOut(u));
            const y = lerp(pt.y, ev.y, easeInOut(u));
            const grad = ctx.createLinearGradient(pt.x,pt.y,ev.x,ev.y);
            grad.addColorStop(0,'rgba(125,255,143,.15)');
            grad.addColorStop(1,'rgba(210,90,255,.92)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([7,9]);
            ctx.lineDashOffset = -nowMs()/26;
            ctx.beginPath();
            ctx.moveTo(pt.x,pt.y);
            ctx.quadraticCurveTo((pt.x+ev.x)/2, (pt.y+ev.y)/2-34, x,y);
            ctx.stroke();
            ctx.fillStyle = '#9cff9e';
            ctx.beginPath();
            ctx.arc(x,y,5*(1-u)+1,0,TAU);
            ctx.fill();
          }
          ctx.restore();
        }
      }
    }
    function drawStrawMonster(ctx, p){
      recordPuppetMergeVisual(p);
      const age = (nowMs() - (p.visualSpawnMs || nowMs())) / 1000;
      const scaleIn = p.visualSpawnMs ? lerp(.35,1,easeOut(Math.min(1,age/.75))) : 1;
      const attackElapsed = p.visualAttackStart ? (nowMs() - p.visualAttackStart) / 1000 : 999;
      const attackActive = attackElapsed >= 0 && attackElapsed <= .82;
      const target = enemyOfPuppetVisual(p.owner);
      const n = target ? norm(target.x-p.x,target.y-p.y) : {x:0,y:0};
      const lean = clamp(n.x,-1,1) * Math.PI/90;
      const bob = Math.sin(nowMs()/250 + (p.order||0))*3;
      const size = (p.radius||55) * (attackActive ? 4.25 : 3.65) * scaleIn;
      ctx.save();
      ctx.translate(p.x,p.y+bob);
      ctx.rotate(lean);
      if (attackActive && ready('strawMonsterAttack16')) {
        const frame = clamp(Math.floor(attackElapsed/.82*16),0,15);
        drawGridFrame(ctx, 'strawMonsterAttack16', frame, 0, 0, size*1.18, size*1.18, 1, {blend: frame>=8&&frame<=11 ? 'lighter' : null});
      } else if (!drawAsset(ctx, 'strawMonsterStatic', 0, 0, size, size, 1)) {
        drawPolygon(ctx,[[-55,-65],[55,-60],[60,55],[0,80],[-60,55]],'#7d5a2f','#f0cf92',6);
        ctx.fillStyle='#27180b';ctx.font='900 15px serif';ctx.textAlign='center';ctx.fillText('STRAW',0,4);
      }
      ctx.restore();
      if ((p.visualImpactMs||0) && nowMs()-p.visualImpactMs < 240) {
        const k = (nowMs()-p.visualImpactMs)/240;
        ctx.save();
        ctx.globalCompositeOperation='lighter';
        ctx.globalAlpha=1-k;
        ctx.strokeStyle='#c56cff';
        ctx.lineWidth=8;
        ctx.beginPath();
        ctx.arc(p.x,p.y,(p.radius||55)*(1.1+k*1.8),0,TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
    function drawPuppetCard(ctx, p){
      if (p.visualLastValue !== p.value) {
        p.visualLastValue = p.value;
        p.visualValuePulseMs = nowMs();
      }
      const pulse = p.visualValuePulseMs ? Math.max(0, 1 - (nowMs()-p.visualValuePulseMs)/330) : 0;
      const hitPulse = Math.max(0, (p.hitCd||0) / .35);
      const angle = Math.atan2(p.vy||0,p.vx||1) * .12 + Math.sin(nowMs()/210)*.08;
      const w = (p.radius||50)*1.08*(1+pulse*.14), h = (p.radius||50)*1.42*(1+pulse*.14);
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(angle);
      ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=.5;
      ctx.fillStyle='#873dff';
      ctx.shadowColor='#c65cff';
      ctx.shadowBlur=24;
      ctx.beginPath();
      ctx.ellipse(-w*.18,h*.18,w*.65,h*.78,0,0,TAU);
      ctx.fill();
      ctx.globalCompositeOperation='source-over';
      const grad = ctx.createLinearGradient(0,-h/2,0,h/2);
      grad.addColorStop(0,'#ffe18d');
      grad.addColorStop(.18,'#fff6cc');
      grad.addColorStop(.55,'#8b34dd');
      grad.addColorStop(1,'#30104a');
      ctx.fillStyle=grad;
      ctx.strokeStyle='#ffe768';
      ctx.lineWidth=5;
      ctx.shadowColor='#b247ff';
      ctx.shadowBlur=16+pulse*18;
      roundRectPath(ctx,-w/2,-h/2,w,h,10);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur=0;
      ctx.strokeStyle='#321047';
      ctx.lineWidth=3;
      roundRectPath(ctx,-w*.36,-h*.32,w*.72,h*.64,7);
      ctx.stroke();
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.font='900 '+Math.round(h*.46)+'px Impact, sans-serif';
      ctx.lineWidth=6;
      ctx.strokeStyle='#1c0827';
      ctx.fillStyle='#fff4a4';
      ctx.strokeText(String(p.value||1),0,0);
      ctx.fillText(String(p.value||1),0,0);
      if (hitPulse > .05) {
        ctx.globalCompositeOperation='lighter';
        ctx.globalAlpha=hitPulse;
        ctx.strokeStyle='#fff09b';
        ctx.lineWidth=8;
        ctx.beginPath();
        ctx.arc(0,0,w*(.7+hitPulse*.45),0,TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
    function roundRectPath(ctx,x,y,w,h,r){
      r = Math.min(r,w/2,h/2);
      ctx.beginPath();
      ctx.moveTo(x+r,y);
      ctx.lineTo(x+w-r,y);
      ctx.quadraticCurveTo(x+w,y,x+w,y+r);
      ctx.lineTo(x+w,y+h-r);
      ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
      ctx.lineTo(x+r,y+h);
      ctx.quadraticCurveTo(x,y+h,x,y+h-r);
      ctx.lineTo(x,y+r);
      ctx.quadraticCurveTo(x,y,x+r,y);
      ctx.closePath();
    }
    function drawPuppetProjectileLayer(ctx){
      drawPuppetVisualEvents(ctx);
      for (const p of projectiles) {
        if (!p) continue;
        if (p.type === 'puppet_transfer_link') drawPuppetTransferLinkDynamic(ctx,p);
      }
      for (const p of projectiles) {
        if (!p) continue;
        if (p.type === 'puppet_effigy') drawPuppetEffigy(ctx,p);
        else if (p.type === 'straw_monster') drawStrawMonster(ctx,p);
        else if (p.type === 'puppet_card') drawPuppetCard(ctx,p);
      }
    }
    function triggerPuppetVisualEvent(owner, kind, payload){
      if (!owner) return;
      owner.visual ||= {};
      if (kind === 'transfer') owner.visual.puppetSourcePulse = nowMs();
      if (kind === 'finalCard') owner.visual.finalCardStart = nowMs();
      if (payload && payload.type === 'merge') puppetVisualEvents.push(payload);
    }
    function recordPuppetVisualUpdateMetadata(dt){
      for (const p of projectiles) {
        if (!p) continue;
        if (p.type === 'straw_monster') {
          const owner = p.owner, enemy = enemyOfPuppetVisual(owner);
          const inRange = enemy && enemy.hp > 0 && dist(p.x,p.y,enemy.x,enemy.y) < (p.radius||55) + enemy.radius + 40;
          if (inRange && (p.tick||0) >= .55 && (!p.visualAttackStart || nowMs()-p.visualAttackStart > 900)) {
            p.visualAttackStart = nowMs() - Math.max(0, ((p.tick||0)-.55) * 1000);
          }
          if (p.visualLastTick !== undefined && (p.tick||0) < p.visualLastTick && inRange) {
            p.visualImpactMs = nowMs();
            p.visualAttackStart = nowMs() - 500;
          }
          p.visualLastTick = p.tick || 0;
        }
        if (p.type === 'puppet_card' && p.visualLastValue !== p.value) {
          p.visualLastValue = p.value;
          p.visualValuePulseMs = nowMs();
        }
        if (p.type === 'puppet_transfer_link' && p.owner) {
          const target = findLinkTarget(p);
          if (target) { p.targetEffigy = target; p.targetOrder = target.order; }
          p.owner.visual ||= {};
          p.owner.visual.puppetSourcePulse = nowMs();
        }
      }
    }
    loadPuppetAssets();
    const puppetType = FighterTypes.find(t => t && t.name === 'PUPPET');
    if (puppetType && !puppetType.__puppetAssetDrawPatched) {
      puppetType.__puppetAssetDrawPatched = true;
      const oldPuppetDraw = puppetType.draw;
      puppetType.draw = function(ctx, f){ drawPuppetBody(ctx, f, oldPuppetDraw); };
    }
    if (!window.__puppetVisualUpdatePatched) {
      window.__puppetVisualUpdatePatched = true;
      const oldUpdateProjectilesPuppetVisual = updateProjectiles;
      updateProjectiles = function(dt){
        recordPuppetVisualUpdateMetadata(dt);
        oldUpdateProjectilesPuppetVisual(dt);
        recordPuppetVisualUpdateMetadata(dt);
      };
      window.updateProjectiles = updateProjectiles;
    }
    if (!window.__puppetProjectileVisualPatched) {
      window.__puppetProjectileVisualPatched = true;
      const oldDrawProjectilesPuppetVisual = drawProjectiles;
      drawProjectiles = function(ctx) {
        const hidden = [];
        for (const p of projectiles) {
          if (p && (p.type === 'puppet_effigy' || p.type === 'puppet_transfer_link' || p.type === 'straw_monster' || p.type === 'puppet_card')) {
            hidden.push([p,p.type]);
            p.type = '__puppet_asset_draw';
          }
        }
        oldDrawProjectilesPuppetVisual(ctx);
        for (const pair of hidden) pair[0].type = pair[1];
        drawPuppetProjectileLayer(ctx);
      };
      window.drawProjectiles = drawProjectiles;
    }
    window.PUPPET_ASSET_MANIFEST = PUPPET_ASSET_MANIFEST;
    window.apexPuppetVisualAssets = ASSETS;
    window.apexPuppetVisualAssetLog = visualLog;
    window.triggerPuppetVisualEvent = triggerPuppetVisualEvent;
    window.recordPuppetMergeVisual = recordPuppetMergeVisual;
    console.info('[Apex Chaos] PUPPET visual assets integrated', visualLog);
  } catch (err) {
    window.apexPuppetVisualError = {message: err && err.message, stack: err && err.stack};
    console.error('[Apex Chaos] PUPPET visual integration failed', err);
  }
})();
