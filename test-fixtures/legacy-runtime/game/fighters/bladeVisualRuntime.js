// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function bladeVisualIntegration(){
  try {
    const BLADE_ASSET_MANIFEST = {
      bladeMainNormal:{src:'assets/blade_v1/normalized/bladeMainNormal.webp',pivot:[730.44,717.24],bodyBox:[87,75,1148,1183]},
      bladeMainRage:{src:'assets/blade_v1/normalized/bladeMainRage.webp',pivot:[643.36,700.06],bodyBox:[93,144,1158,1061]},
      bladeCastNormal16:{src:'assets/blade_v1/normalized/bladeCastNormal16.webp',cols:4,rows:4,frames:16},
      bladeCastRage16:{src:'assets/blade_v1/normalized/bladeCastRage16.webp',cols:4,rows:4,frames:16},
      bladeWaveNormal16:{src:'assets/blade_v1/normalized/bladeWaveNormal16.webp',cols:4,rows:4,frames:16},
      bladeWaveRage16:{src:'assets/blade_v1/normalized/bladeWaveRage16.webp',cols:4,rows:4,frames:16},
      bladeWeakX16:{src:'assets/blade_v1/normalized/bladeWeakX16.webp',cols:4,rows:4,frames:16},
      bladeWeakText:{src:'assets/blade_v1/normalized/bladeWeakText.webp'}
    };
    const ASSETS = {};
    const bladeVisualEvents = [];
    const BLADE_DEBUG = false;

    function loadBladeAssets(){
      for (const [role, meta] of Object.entries(BLADE_ASSET_MANIFEST)) {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => { meta.loaded = true; meta.width = img.naturalWidth || img.width; meta.height = img.naturalHeight || img.height; };
        img.onerror = () => { meta.failed = true; console.warn('[BLADE visuals] asset load failed', role, meta.src); };
        img.src = meta.src;
        ASSETS[role] = img;
      }
      return ASSETS;
    }
    function prepareBladeAssetManifest(){ return BLADE_ASSET_MANIFEST; }
    function chromaKeyBladeGreen(img){ return img; }

    function getBladeVisualState(f, dt){
      if (!f.visualBlade) {
        f.visualBlade = {
          spinAngle: Math.random() * TAU,
          spinSpeed: 1.18,
          lastX: f.x,
          lastY: f.y,
          lastClock: matchClock || 0,
          lastWallBounceTime: -99,
          castStart: -99,
          castWall: null,
          castNormal: null,
          castProjectileAngle: 0,
          castAngles: [],
          castRage: false,
          lastRage: !!f.isRage,
          rageMix: f.isRage ? 1 : 0,
          weakProcEvents: [],
          waveVisualEvents: [],
          auraWisps: [],
          auraEmit: 0
        };
      }
      const v = f.visualBlade;
      const now = matchClock || 0;
      if (dt === undefined || dt === null) dt = Math.min(0.05, Math.max(0, now - (v.lastClock || now))) || 1/60;
      v.lastClock = now;
      updateBladeSpin(f, dt);
      const rageTarget = f.isRage ? 1 : 0;
      const fade = dt / 0.26;
      v.rageMix += (rageTarget - v.rageMix) * clamp(fade, 0, 1);
      v.lastRage = !!f.isRage;
      v.auraEmit += dt;
      const emitEvery = f.isRage ? 0.075 : 0.095;
      while (v.auraEmit >= emitEvery) {
        v.auraEmit -= emitEvery;
        const sign = Math.sign(v.spinSpeed || 1);
        v.auraWisps.push({
          a: v.spinAngle + rand(-0.28,0.28),
          r: f.radius * rand(0.72,1.18),
          age: 0,
          life: rand(0.16, f.isRage ? 0.34 : 0.28),
          sign,
          rage: !!f.isRage
        });
      }
      for (const w of v.auraWisps) w.age += dt;
      v.auraWisps = v.auraWisps.filter(w => w.age < w.life).slice(-14);
      v.lastX = f.x;
      v.lastY = f.y;
      return v;
    }

    function updateBladeSpin(f, dt){
      const v = f.visualBlade;
      const target = f.isRage ? 1.55 : 1.18;
      v.spinSpeed += (target - v.spinSpeed) * clamp(dt * 5, 0, 1);
      v.spinAngle = (v.spinAngle + v.spinSpeed * dt) % TAU;
    }

    function bladeDrawImageAtPivot(ctx, role, f, alpha){
      const meta = BLADE_ASSET_MANIFEST[role], img = ASSETS[role];
      if (!meta || !meta.loaded || !img || !meta.pivot || !meta.bodyBox) return false;
      const box = meta.bodyBox;
      const bodyLong = Math.max(1, Math.max(box[2]-box[0], box[3]-box[1]));
      const scale = (f.radius * 2.42) / bodyLong;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.drawImage(img, -meta.pivot[0]*scale, -meta.pivot[1]*scale, img.width*scale, img.height*scale);
      ctx.restore();
      return true;
    }

    function drawBladeBody(ctx, f, dt){
      const v = getBladeVisualState(f, dt);
      const dirA = Math.atan2(f.dir.y, f.dir.x);
      ctx.save();
      ctx.rotate(v.spinAngle - dirA);
      const mix = clamp(v.rageMix, 0, 1);
      const normalOk = bladeDrawImageAtPivot(ctx, 'bladeMainNormal', f, 0.94 * (1 - mix));
      const rageOk = bladeDrawImageAtPivot(ctx, 'bladeMainRage', f, 0.96 * mix);
      if (!normalOk && !rageOk && window.__bladeOldDraw) window.__bladeOldDraw(ctx, f);
      ctx.restore();
      ctx.save();
      ctx.rotate(v.spinAngle - dirA);
      ctx.globalAlpha = f.isRage ? 0.75 : 0.48;
      ctx.shadowColor = f.isRage ? '#ff3030' : '#ff5a4d';
      ctx.shadowBlur = f.isRage ? 20 : 12;
      ctx.fillStyle = f.isRage ? '#ff3030' : '#ff4a42';
      ctx.beginPath();
      ctx.arc(0,0,f.radius*(f.isRage?.18:.13),0,TAU);
      ctx.fill();
      ctx.restore();
    }

    function drawBladeDirectionalAura(ctx, f, dt){
      const v = getBladeVisualState(f, dt);
      const dirA = Math.atan2(f.dir.y, f.dir.x);
      ctx.save();
      ctx.rotate(-dirA);
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      for (const w of v.auraWisps) {
        const q = clamp(w.age / Math.max(0.001, w.life), 0, 1);
        const alpha = (1 - q) * (w.rage ? 0.30 : 0.18);
        const red = w.rage ? 255 : 235;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = `rgba(${red},${w.rage ? 44 : 66},${w.rage ? 38 : 58},1)`;
        ctx.lineWidth = f.radius * (w.rage ? 0.070 : 0.048) * (1 - q * .45);
        ctx.beginPath();
        for (let i=0;i<5;i++) {
          const a = w.a - w.sign * (i * 0.14 + q * 0.55);
          const rr = w.r + f.radius * (0.11 * i + 0.05 * Math.sin(i + matchClock * 5));
          const x = Math.cos(a) * rr;
          const y = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(x,y); else ctx.quadraticCurveTo(x*0.96,y*0.96,x,y);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }

    function triggerBladeWallCast(f, wall, waveAngles){
      if (!f || f.name !== 'BLADE') return;
      const v = getBladeVisualState(f, 0);
      const normals = {left:{x:1,y:0}, right:{x:-1,y:0}, top:{x:0,y:1}, bottom:{x:0,y:-1}};
      v.lastWallBounceTime = matchClock || 0;
      v.castStart = matchClock || 0;
      v.castDuration = 0.52;
      v.castWall = wall || null;
      v.castNormal = normals[wall] || null;
      v.castAngles = (waveAngles && waveAngles.length ? waveAngles : [Math.atan2(GAME_SIZE/2-f.y, GAME_SIZE/2-f.x)]).slice(0,3);
      v.castProjectileAngle = v.castAngles[0];
      v.castSpin = v.spinAngle;
      v.castRage = !!f.isRage;
      v.waveVisualEvents.push({t:matchClock||0, angles:v.castAngles.slice(), rage:!!f.isRage});
      const contact = {x:f.x,y:f.y};
      if (wall === 'left') contact.x = f.radius;
      if (wall === 'right') contact.x = GAME_SIZE - f.radius;
      if (wall === 'top') contact.y = f.radius;
      if (wall === 'bottom') contact.y = GAME_SIZE - f.radius;
      emitParticles(contact.x, contact.y, f.isRage ? '#ff3030' : '#f4fbff', f.isRage ? 18 : 12, 320, 4, .24, 'square');
    }

    function bladeDrawSheetFrame(ctx, role, frameIndex, dx, dy, w, h, alpha=1, angle=0){
      const meta = BLADE_ASSET_MANIFEST[role], img = ASSETS[role];
      if (!meta || !meta.loaded || !img) return false;
      const cols = meta.cols || 4, rows = meta.rows || 4;
      const cw = img.width / cols, ch = img.height / rows;
      const frame = Math.max(0, Math.min((meta.frames || 16) - 1, frameIndex | 0));
      const sx = (frame % cols) * cw, sy = Math.floor(frame / cols) * ch;
      ctx.save();
      ctx.rotate(angle);
      ctx.globalAlpha *= alpha;
      ctx.drawImage(img, sx, sy, cw, ch, dx, dy, w, h);
      ctx.restore();
      return true;
    }

    function drawBladeCastAnimation(ctx, f, dt){
      const v = getBladeVisualState(f, dt);
      if (v.castStart < 0) return;
      const age = (matchClock || 0) - v.castStart;
      const dur = v.castDuration || .52;
      if (age < 0 || age > dur) return;
      const progress = clamp(age / dur, 0, 1);
      const frame = Math.min(15, Math.floor(progress * 16));
      const dirA = Math.atan2(f.dir.y, f.dir.x);
      const role = v.castRage && BLADE_ASSET_MANIFEST.bladeCastRage16.loaded ? 'bladeCastRage16' : 'bladeCastNormal16';
      const alpha = progress < .78 ? 0.86 : (1 - progress) / .22 * .86;
      const angles = v.castRage && v.castAngles.length > 1 ? v.castAngles : [v.castProjectileAngle];
      for (const a of angles) {
        ctx.save();
        ctx.rotate(a - dirA);
        if (v.castRage) {
          ctx.globalAlpha = 0.38 * (1 - progress * .35);
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = '#ff3030';
          ctx.lineWidth = f.radius * .14;
          ctx.beginPath();
          ctx.arc(f.radius*.25, 0, f.radius*(1.0 + progress*.9), -0.55, 0.55);
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
        bladeDrawSheetFrame(ctx, role, frame, -f.radius*1.48, -f.radius*1.48, f.radius*2.96, f.radius*2.96, alpha);
        ctx.restore();
      }
    }

    function bladeWaveFrameFloat(p){
      const age = Math.max(0, (p.maxLife || 1) - (p.life || 0));
      if (age < 0.12) return clamp(age / 0.12 * 4, 0, 3.99);
      if ((p.life || 0) < 0.22) return 12 + clamp((0.22 - (p.life || 0)) / 0.22 * 4, 0, 3.99);
      return 4 + (((age - 0.12) * 30) % 8);
    }

    function drawBladeWaveFrameSmooth(ctx, role, frameFloat, x, y, w, h, alpha){
      const f0 = Math.floor(frameFloat) % 16;
      const f1 = frameFloat >= 4 && frameFloat < 12 ? (f0 === 11 ? 4 : f0 + 1) : (f0 + 1) % 16;
      const t = frameFloat - Math.floor(frameFloat);
      const a1 = alpha * clamp(t, 0, 1);
      const a0 = alpha - a1;
      const ok0 = bladeDrawSheetFrame(ctx, role, f0, x, y, w, h, a0);
      const ok1 = a1 > 0.01 ? bladeDrawSheetFrame(ctx, role, f1, x, y, w, h, a1) : true;
      return ok0 && ok1;
    }

    function drawBladeWaveFallback(ctx, p){
      const length = p.length || 320, halfWidth = p.halfWidth || 160;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy || 0, p.vx || 1));
      ctx.globalAlpha = .82;
      ctx.fillStyle = p.visualBladeRage ? 'rgba(255,58,58,.26)' : 'rgba(230,246,255,.32)';
      ctx.beginPath();
      ctx.ellipse(-length*.35,0,length*.55,halfWidth*.95,0,-.82,.82);
      ctx.fill();
      ctx.strokeStyle = p.visualBladeRage ? '#ff6262' : '#f4fbff';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(-length*.30,0,halfWidth*.75,-.65,.65);
      ctx.stroke();
      ctx.restore();
    }

    function drawBladeWaveProjectile(ctx, p, dt){
      if (!p || p.type !== 'blade_wave') return;
      const rage = !!p.visualBladeRage;
      const role = rage ? 'bladeWaveRage16' : 'bladeWaveNormal16';
      const length = Math.max(80, p.length || 320);
      const halfWidth = Math.max(40, p.halfWidth || 160);
      const visualW = length * 1.02;
      const visualH = halfWidth * 1.55;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy || 0, p.vx || 1));
      const alpha = clamp((p.life || 0) / Math.max(0.001, p.maxLife || 1), 0, 1);
      ctx.globalCompositeOperation = 'lighter';
      drawBladeWaveFrameSmooth(ctx, role, bladeWaveFrameFloat(p) - 0.55, -visualW - length * .08, -visualH/2, visualW, visualH, 0.18 * Math.min(1, alpha * 1.25));
      drawBladeWaveFrameSmooth(ctx, role, bladeWaveFrameFloat(p) - 0.28, -visualW - length * .035, -visualH/2, visualW, visualH, 0.26 * Math.min(1, alpha * 1.25));
      ctx.globalCompositeOperation = 'source-over';
      const ok = drawBladeWaveFrameSmooth(ctx, role, bladeWaveFrameFloat(p), -visualW, -visualH/2, visualW, visualH, 0.90 * Math.min(1, alpha * 1.25));
      if (!ok) {
        ctx.restore();
        drawBladeWaveFallback(ctx, p);
        return;
      }
      if (BLADE_DEBUG) {
        ctx.globalAlpha = .28;
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 3;
        ctx.strokeRect(-length, -halfWidth, length, halfWidth*2);
      }
      ctx.restore();
    }

    function drawBladeWeakX(ctx, event, dt){
      if (!event) return;
      const target = fighters.find(f => f && f.id === event.targetId);
      if (target && target.hp <= 0) { event.done = true; return; }
      const x = target ? target.x : event.x, y = target ? target.y : event.y;
      const radius = target ? target.radius : (event.radius || 75);
      event.x = x; event.y = y;
      const age = (matchClock || 0) - event.start;
      const progress = clamp(age / event.duration, 0, 1);
      const frame = Math.min(15, Math.floor(progress * 16));
      const grow = progress < .55 ? smoothstep(progress/.55) : 1;
      const alpha = progress < .72 ? 1 : clamp((1-progress)/.28, 0, 1);
      const size = radius * lerp(0.55, 2.8, grow);
      if (!bladeDrawSheetFrame(ctx, 'bladeWeakX16', frame, x-size/2, y-size/2, size, size, alpha)) {
        ctx.save();
        ctx.translate(x,y);
        ctx.rotate(event.angle || -.55);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#ff3030';
        ctx.lineWidth = radius * .16;
        ctx.beginPath();
        ctx.moveTo(-size*.35,-size*.35); ctx.lineTo(size*.35,size*.35);
        ctx.moveTo(size*.35,-size*.35); ctx.lineTo(-size*.35,size*.35);
        ctx.stroke();
        ctx.restore();
      }
      if (progress >= 1) event.done = true;
    }

    function drawBladeWeakText(ctx, target, dt, event){
      if (!target || target.hp <= 0 || !event) return;
      const age = (matchClock || 0) - event.start;
      const dur = event.textDuration || .92;
      if (age > dur) return;
      const progress = clamp(age / dur, 0, 1);
      const pop = progress < .18 ? lerp(.55,1.08,smoothstep(progress/.18)) : lerp(1.08,.92,smoothstep((progress-.18)/.82));
      const alpha = progress < .72 ? 1 : clamp((1-progress)/.28, 0, 1);
      const img = ASSETS.bladeWeakText, meta = BLADE_ASSET_MANIFEST.bladeWeakText;
      const y = target.y - target.radius - 54 - 10*Math.sin(progress*Math.PI);
      const w = target.radius * 2.9 * pop;
      const h = w * ((meta.height || 607) / Math.max(1, meta.width || 1248));
      ctx.save();
      ctx.globalAlpha = alpha;
      if (meta.loaded && img) {
        ctx.drawImage(img, target.x - w/2, y - h/2, w, h);
      } else {
        ctx.font = `900 ${Math.round(target.radius*.45*pop)}px monospace`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#130303';
        ctx.fillStyle = '#ff3030';
        ctx.strokeText('WEAK', target.x, y);
        ctx.fillText('WEAK', target.x, y);
      }
      ctx.restore();
    }

    function drawBladeVisualDebug(ctx, f){
      if (!BLADE_DEBUG || !f) return;
      ctx.save();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    function drawBladeWeakOverlaysForTarget(ctx, target){
      for (const ev of bladeVisualEvents) {
        if (!ev || ev.type !== 'weakX' || ev.targetId !== target.id || ev.done) continue;
        drawBladeWeakX(ctx, ev, 0);
        drawBladeWeakText(ctx, target, 0, ev);
      }
    }

    loadBladeAssets();
    prepareBladeAssetManifest();

    const bladeType = FighterTypes.find(t => t && t.name === 'BLADE');
    if (bladeType) {
      const oldBladeDraw = bladeType.draw;
      window.__bladeOldDraw = oldBladeDraw;
      bladeType.draw = function(ctx, f){
        const dt = f.visualBlade ? Math.min(0.05, Math.max(0, (matchClock||0) - (f.visualBlade.lastClock || matchClock || 0))) : 1/60;
        drawBladeDirectionalAura(ctx, f, dt);
        drawBladeBody(ctx, f, dt);
        drawBladeVisualDebug(ctx, f);
      };

      const oldBladeWallBounce = bladeType.onWallBounce;
      bladeType.onWallBounce = function(f, wall){
        if (!f || f.name !== 'BLADE') return oldBladeWallBounce && oldBladeWallBounce.call(this, f, wall);
        getBladeVisualState(f, 0);
        const before = projectiles.length;
        const result = oldBladeWallBounce && oldBladeWallBounce.call(this, f, wall);
        const spawned = projectiles.slice(before).filter(p => p && p.type === 'blade_wave' && p.owner === f);
        for (const p of spawned) {
          p.visualBladeRage = !!f.isRage;
          p.visualStartTime = matchClock || 0;
          p.visualBladeAsset = p.visualBladeRage ? 'bladeWaveRage16' : 'bladeWaveNormal16';
        }
        return result;
      };
    }

    const oldRedSlash = redSlash;
    redSlash = function(target, owner){
      const result = oldRedSlash(target, owner);
      if (owner && owner.name === 'BLADE' && target) {
        bladeVisualEvents.push({
          type:'weakX',
          targetId:target.id,
          x:target.x,
          y:target.y,
          radius:target.radius,
          start:matchClock || 0,
          duration:.62,
          textDuration:.95,
          sourceId:owner.id,
          angle:rand(-.8,.8)
        });
      }
      return result;
    };
    window.redSlash = redSlash;

    const oldUpdateProjectilesBladeVisual = updateProjectiles;
    updateProjectiles = function(dt){
      oldUpdateProjectilesBladeVisual(dt);
      const now = matchClock || 0;
      for (const p of projectiles) {
        if (p && p.type === 'blade_wave' && p.owner && p.owner.name === 'BLADE' && p.visualStartTime === undefined) {
          p.visualBladeRage = !!p.owner.isRage;
          p.visualStartTime = now - Math.max(0, (p.maxLife || 0) - (p.life || 0));
          p.visualBladeAsset = p.visualBladeRage ? 'bladeWaveRage16' : 'bladeWaveNormal16';
        }
      }
      for (const ev of bladeVisualEvents) {
        if (ev && ev.type === 'weakX') {
          const target = fighters.find(f => f && f.id === ev.targetId);
          if (target) { ev.x = target.x; ev.y = target.y; ev.radius = target.radius; if (target.hp <= 0) ev.done = true; }
          if (now - ev.start > ev.duration + .18) ev.done = true;
        }
      }
      for (let i=bladeVisualEvents.length-1;i>=0;i--) if (bladeVisualEvents[i].done) bladeVisualEvents.splice(i,1);
    };
    window.updateProjectiles = updateProjectiles;

    const oldDrawProjectilesBladeVisual = drawProjectiles;
    drawProjectiles = function(ctx){
      oldDrawProjectilesBladeVisual(ctx);
    };
    window.drawProjectiles = drawProjectiles;

    if (!Fighter.prototype.__bladeVisualOverlayPatched) {
      const oldFighterDrawBladeVisual = Fighter.prototype.draw;
      Fighter.prototype.draw = function(ctx){
        oldFighterDrawBladeVisual.call(this, ctx);
        if (bladeVisualEvents.length) drawBladeWeakOverlaysForTarget(ctx, this);
      };
      Fighter.prototype.__bladeVisualOverlayPatched = true;
    }

    window.BLADE_ASSET_MANIFEST = BLADE_ASSET_MANIFEST;
    window.apexBladeVisualAssets = ASSETS;
    window.apexBladeVisualEvents = bladeVisualEvents;
    window.loadBladeAssets = loadBladeAssets;
    window.prepareBladeAssetManifest = prepareBladeAssetManifest;
    window.chromaKeyBladeGreen = chromaKeyBladeGreen;
    window.getBladeVisualState = getBladeVisualState;
    window.updateBladeSpin = updateBladeSpin;
    window.drawBladeBody = drawBladeBody;
    window.drawBladeDirectionalAura = drawBladeDirectionalAura;
    window.triggerBladeWallCast = triggerBladeWallCast;
    window.drawBladeCastAnimation = drawBladeCastAnimation;
    window.drawBladeWaveProjectile = drawBladeWaveProjectile;
    window.drawBladeWeakX = drawBladeWeakX;
    window.drawBladeWeakText = drawBladeWeakText;
    window.drawBladeVisualDebug = drawBladeVisualDebug;
    console.info('[Apex Chaos] BLADE visual assets integrated', BLADE_ASSET_MANIFEST);
  } catch (err) {
    window.apexBladeVisualError = {message: err && err.message, stack: err && err.stack};
    console.error('[Apex Chaos] BLADE visual integration failed', err);
  }
})();
