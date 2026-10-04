// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function apexNinjaVisualIntegration(){
  try {
    const NINJA_ASSET_MANIFEST = {
      mainStatic: 'assets/ninja_v1/normalized/ninjaMainStatic.webp',
      throwReleasedStatic: 'assets/ninja_v1/normalized/ninjaThrowReleasedStatic.webp',
      airPalmStatic: 'assets/ninja_v1/normalized/ninjaAirPalmStatic.webp',
      electricBallGrow16: 'assets/ninja_v1/normalized/electricBallGrow16.webp',
      shurikenStatic: 'assets/ninja_v1/normalized/shurikenStatic.webp',
      kunaiStatic: 'assets/ninja_v1/normalized/kunaiStatic.webp',
      rageAura: null
    };
    const NINJA_AUDIO_MANIFEST = {
      teleport: 'assets/ninja_v1/audio/teleport.mp3',
      skill: 'assets/ninja_v1/audio/rasengan.mp3',
      shurikenThrow: 'assets/ninja_v1/audio/shuriken_throw.mp3',
      shurikenHitBody: 'assets/ninja_v1/audio/shuriken_hit_body.mp3',
      shurikenHitWall: 'assets/ninja_v1/audio/shuriken_hit_wall.mp3',
      kunaiThrowSkill: 'assets/ninja_v1/audio/kunai_throw_skill.mp3',
      kunaiCatch: 'assets/ninja_v1/audio/kunai_catch.mp3',
      kunaiWallBounce: 'assets/ninja_v1/audio/kunai_wall_bounce.mp3'
    };
    const ASSETS = {};
    const NINJA_EVENTS = [];
    const seenProjectiles = new WeakSet();
    const NINJA_AUDIO = {
      teleport: new Audio(NINJA_AUDIO_MANIFEST.teleport),
      skill: new Audio(NINJA_AUDIO_MANIFEST.skill),
      shurikenThrow: new Audio(NINJA_AUDIO_MANIFEST.shurikenThrow),
      shurikenHitBody: new Audio(NINJA_AUDIO_MANIFEST.shurikenHitBody),
      shurikenHitWall: new Audio(NINJA_AUDIO_MANIFEST.shurikenHitWall),
      kunaiThrowSkill: new Audio(NINJA_AUDIO_MANIFEST.kunaiThrowSkill),
      kunaiCatch: new Audio(NINJA_AUDIO_MANIFEST.kunaiCatch),
      kunaiWallBounce: new Audio(NINJA_AUDIO_MANIFEST.kunaiWallBounce),
      ownerId: null, token: 0, withSkill: false, skillStarted: false,
      skillStartAt: null, fadeStart: null, fadePendingAt: null, fadeDuration: 1.45, peakHold: 2.5, skillVolume: .75
    };
    NINJA_AUDIO.teleport.preload = 'auto';
    NINJA_AUDIO.skill.preload = 'auto';
    NINJA_AUDIO.shurikenThrow.preload = 'auto';
    NINJA_AUDIO.shurikenHitBody.preload = 'auto';
    NINJA_AUDIO.shurikenHitWall.preload = 'auto';
    NINJA_AUDIO.kunaiThrowSkill.preload = 'auto';
    NINJA_AUDIO.kunaiCatch.preload = 'auto';
    NINJA_AUDIO.kunaiWallBounce.preload = 'auto';
    NINJA_AUDIO.skill.loop = true;
    const bodyForwardOffset = Math.PI / 2; // source sprites face toward local +Y; game facing uses +X.
    const handAnchor = {x:-0.06, y:0.18};
    const airPalmAnchor = {x:0.255, y:0.185};

    function loadNinjaAssets() {
      let pending = 0;
      for (const [key, src] of Object.entries(NINJA_ASSET_MANIFEST)) {
        if (!src) continue;
        const img = new Image();
        ASSETS[key] = img;
        pending++;
        img.onload = () => { img.ready = true; if (--pending <= 0) window.apexNinjaVisualReady = true; };
        img.onerror = () => { img.failed = true; if (--pending <= 0) window.apexNinjaVisualReady = true; };
        img.src = src;
      }
      if (!pending) window.apexNinjaVisualReady = true;
      return ASSETS;
    }

    function stopNinjaAudio() {
      NINJA_AUDIO.teleport.pause();
      NINJA_AUDIO.skill.pause();
      try { NINJA_AUDIO.teleport.currentTime = 0; NINJA_AUDIO.skill.currentTime = 0; } catch (err) {}
      NINJA_AUDIO.skill.volume = NINJA_AUDIO.skillVolume;
      NINJA_AUDIO.ownerId = null;
      NINJA_AUDIO.withSkill = false;
      NINJA_AUDIO.skillStarted = false;
      NINJA_AUDIO.skillStartAt = null;
      NINJA_AUDIO.fadeStart = null;
      NINJA_AUDIO.fadePendingAt = null;
    }

    function playNinjaShurikenAudio(kind) {
      const role = kind === 'hitBody' ? 'shurikenHitBody' : kind === 'hitWall' ? 'shurikenHitWall' : 'shurikenThrow';
      const audio = NINJA_AUDIO[role];
      if (!audio) return;
      const volume = role === 'shurikenThrow' ? .38 : role === 'shurikenHitBody' ? .66 : .58;
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = volume;
        const promise = audio.play();
        if (promise && promise.catch) promise.catch(() => {});
      } catch (err) {}
    }

    function playNinjaKunaiAudio(kind) {
      const role = kind === 'catch' ? 'kunaiCatch' : kind === 'bounce' ? 'kunaiWallBounce' : 'kunaiThrowSkill';
      const audio = NINJA_AUDIO[role];
      if (!audio) return;
      const volume = role === 'kunaiThrowSkill' ? .72 : role === 'kunaiCatch' ? .62 : .54;
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = volume;
        const promise = audio.play();
        if (promise && promise.catch) promise.catch(() => {});
      } catch (err) {}
    }

    function startNinjaSkillAudio(token) {
      if (token !== NINJA_AUDIO.token || !NINJA_AUDIO.withSkill || NINJA_AUDIO.fadeStart !== null) return;
      if (NINJA_AUDIO.skillStarted) return;
      NINJA_AUDIO.skill.pause();
      try { NINJA_AUDIO.skill.currentTime = 0; } catch (err) {}
      NINJA_AUDIO.skill.volume = NINJA_AUDIO.skillVolume;
      NINJA_AUDIO.skill.loop = true;
      NINJA_AUDIO.skillStarted = true;
      const promise = NINJA_AUDIO.skill.play();
      if (promise && promise.catch) promise.catch(() => {});
    }

    function playNinjaTeleportAudio(owner, withSkill = true) {
      NINJA_AUDIO.token++;
      const token = NINJA_AUDIO.token;
      NINJA_AUDIO.ownerId = owner && owner.id;
      NINJA_AUDIO.withSkill = !!withSkill;
      NINJA_AUDIO.skillStarted = false;
      NINJA_AUDIO.skillStartAt = withSkill ? performance.now()/1000 + .34 : null;
      NINJA_AUDIO.fadeStart = null;
      NINJA_AUDIO.fadePendingAt = null;
      NINJA_AUDIO.skill.pause();
      try { NINJA_AUDIO.skill.currentTime = 0; } catch (err) {}
      NINJA_AUDIO.teleport.pause();
      try { NINJA_AUDIO.teleport.currentTime = 0; } catch (err) {}
      NINJA_AUDIO.teleport.volume = .92;
      NINJA_AUDIO.teleport.onended = () => startNinjaSkillAudio(token);
      const promise = NINJA_AUDIO.teleport.play();
      if (promise && promise.catch) promise.catch(() => { if (withSkill) startNinjaSkillAudio(token); });
    }

    function fadeNinjaSkillAudio(owner) {
      if (owner && NINJA_AUDIO.ownerId !== null && NINJA_AUDIO.ownerId !== owner.id) return;
      if (NINJA_AUDIO.withSkill && !NINJA_AUDIO.skillStarted) startNinjaSkillAudio(NINJA_AUDIO.token);
      NINJA_AUDIO.fadePendingAt = performance.now() / 1000 + NINJA_AUDIO.peakHold;
    }

    function updateNinjaAudio() {
      const now = performance.now()/1000;
      if (NINJA_AUDIO.skillStartAt !== null && now >= NINJA_AUDIO.skillStartAt) {
        NINJA_AUDIO.skillStartAt = null;
        startNinjaSkillAudio(NINJA_AUDIO.token);
      }
      if (NINJA_AUDIO.fadePendingAt !== null && now >= NINJA_AUDIO.fadePendingAt) {
        NINJA_AUDIO.fadeStart = now;
        NINJA_AUDIO.fadePendingAt = null;
        NINJA_AUDIO.skill.loop = false;
      }
      if (NINJA_AUDIO.fadeStart === null) return;
      const t = clamp((now - NINJA_AUDIO.fadeStart) / NINJA_AUDIO.fadeDuration, 0, 1);
      NINJA_AUDIO.skill.volume = Math.max(0, NINJA_AUDIO.skillVolume * (1-t) * (1-t));
      if (t >= 1) {
        NINJA_AUDIO.skill.pause();
        try { NINJA_AUDIO.skill.currentTime = 0; } catch (err) {}
        NINJA_AUDIO.skill.volume = NINJA_AUDIO.skillVolume;
        NINJA_AUDIO.skillStarted = false;
        NINJA_AUDIO.fadeStart = null;
        NINJA_AUDIO.fadePendingAt = null;
        NINJA_AUDIO.withSkill = false;
      }
    }

    function ninjaNow() { return (typeof matchClock === 'number' && isFinite(matchClock)) ? matchClock : performance.now() / 1000; }
    function angleDelta(a,b) { return Math.atan2(Math.sin(a-b), Math.cos(a-b)); }
    function lerpAngle(a,b,t) { return a + angleDelta(b,a) * clamp(t,0,1); }
    function enemyOfNinja(f) { return (fighters || []).find(e => e && e !== f && e.hp > 0); }
    function imgReady(key) { const img = ASSETS[key]; return img && img.ready && !img.failed && img.naturalWidth > 0; }

    function getNinjaVisualState(f, dt) {
      f.visual = f.visual || {};
      const v = f.visual.ninja || (f.visual.ninja = {});
      const frozenVisual = f.data && f.data.iceDrawLocked || f.hasStatus && (f.hasStatus('freeze') || f.hasStatus('stun'));
      const pausedVisual = typeof timeScale === 'number' && timeScale < .12;
      if ((frozenVisual || pausedVisual) && v.facingAngle !== undefined) {
        v.throwStart = -999;
        v.kunaiThrowStart = -999;
        v.lastUpdate = ninjaNow();
        return v;
      }
      const now = ninjaNow();
      if (v.throwStart && now - v.throwStart > .5) v.throwStart = -999;
      if (v.kunaiThrowStart && now - v.kunaiThrowStart > .65) v.kunaiThrowStart = -999;
      if (v.arrivalStart && now - v.arrivalStart > 1.1) v.arrivalStart = -999;
      const e = enemyOfNinja(f);
      const targetAngle = e ? Math.atan2(e.y - f.y, e.x - f.x) : Math.atan2(f.dir.y, f.dir.x);
      if (v.facingAngle === undefined) v.facingAngle = targetAngle;
      v.facingAngle = lerpAngle(v.facingAngle, targetAngle, Math.min(1, (dt || 0.016) * 12));
      v.lastUpdate = ninjaNow();
      return v;
    }

    function getNinjaFacingAngle(f) {
      return (f.visual && f.visual.ninja && f.visual.ninja.facingAngle !== undefined)
        ? f.visual.ninja.facingAngle
        : Math.atan2(f.dir.y, f.dir.x);
    }

    function ninjaSpriteScale(f, key) {
      const img = ASSETS[key];
      if (!img || !img.naturalWidth) return 1;
      const bodyLong = Math.max(img.naturalWidth, img.naturalHeight);
      return (f.radius * (key === 'airPalmStatic' ? 3.18 : 2.78)) / bodyLong;
    }

    function drawImageCentered(ctx, key, scale, alpha) {
      const img = ASSETS[key];
      if (!img || !img.ready || img.failed) return false;
      ctx.save();
      ctx.globalAlpha *= alpha === undefined ? 1 : alpha;
      ctx.drawImage(img, -img.naturalWidth * scale / 2, -img.naturalHeight * scale / 2, img.naturalWidth * scale, img.naturalHeight * scale);
      ctx.restore();
      return true;
    }

    function getNinjaHandAnchor(f, key, anchor) {
      const img = ASSETS[key || 'mainStatic'];
      const scale = ninjaSpriteScale(f, key || 'mainStatic');
      const x = (anchor || handAnchor).x * (img ? img.naturalWidth : 900) * scale;
      const y = (anchor || handAnchor).y * (img ? img.naturalHeight : 850) * scale;
      const facing = getNinjaFacingAngle(f) - bodyForwardOffset;
      return {
        x: f.x + Math.cos(facing) * x - Math.sin(facing) * y,
        y: f.y + Math.sin(facing) * x + Math.cos(facing) * y
      };
    }

    function drawNinjaRageAura(ctx, f, pulse) {
      ctx.save();
      const t = ninjaNow() * 5;
      ctx.globalCompositeOperation = 'lighter';
      for (let i=0;i<5;i++) {
        const a = -Math.PI/2 + (i-2)*0.36 + Math.sin(t+i)*0.08;
        const len = f.radius * (1.35 + i*.08 + pulse*.18);
        ctx.globalAlpha = 0.18 + pulse*.08;
        ctx.fillStyle = i === 2 ? 'rgba(255,190,70,.80)' : 'rgba(255,92,26,.62)';
        ctx.beginPath();
        ctx.moveTo(Math.cos(a)*f.radius*.45, Math.sin(a)*f.radius*.45);
        ctx.quadraticCurveTo(Math.cos(a)*len*.85, Math.sin(a)*len*.85 - f.radius*.18, Math.cos(a)*len*1.22, Math.sin(a)*len*1.22);
        ctx.quadraticCurveTo(Math.cos(a+.2)*len*.82, Math.sin(a+.2)*len*.82, Math.cos(a+.36)*f.radius*.55, Math.sin(a+.36)*f.radius*.55);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,166,48,.55)';
      ctx.lineWidth = 4;
      ctx.globalAlpha = .42;
      ctx.beginPath();
      ctx.arc(0,0,f.radius*1.38 + Math.sin(t)*4,0,TAU);
      ctx.stroke();
      ctx.restore();
    }

    function drawNinjaNormalThrow(ctx, f, dt, baseDraw) {
      const v = getNinjaVisualState(f, dt);
      const age = v.throwStart ? ninjaNow() - v.throwStart : 999;
      const mainKey = (age > .075 && age < .255 && imgReady('throwReleasedStatic')) ? 'throwReleasedStatic' : 'mainStatic';
      const scale = ninjaSpriteScale(f, mainKey);
      const ok = drawImageCentered(ctx, mainKey, scale, 1);
      if (!ok && baseDraw) baseDraw(ctx, f);
      if (age < .18 && imgReady('shurikenStatic')) {
        const img = ASSETS.shurikenStatic;
        const s = (f.radius * .48) / Math.max(img.naturalWidth, img.naturalHeight);
        const hx = (handAnchor.x * (ASSETS.mainStatic?.naturalWidth || 900) * ninjaSpriteScale(f, 'mainStatic'));
        const hy = (handAnchor.y * (ASSETS.mainStatic?.naturalHeight || 850) * ninjaSpriteScale(f, 'mainStatic'));
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(ninjaNow()*26);
        ctx.globalAlpha = 1 - clamp(age/.18,0,1);
        ctx.drawImage(img, -img.naturalWidth*s/2, -img.naturalHeight*s/2, img.naturalWidth*s, img.naturalHeight*s);
        ctx.restore();
      }
    }

    function drawNinjaElectricBall(ctx, f, progress, alpha, targetLocal, explosionProgress) {
      const key = 'electricBallGrow16';
      const p = clamp(progress,0,1);
      const boom = smoothstep(clamp(explosionProgress || 0,0,1));
      const frame = Math.max(0, Math.min(15, Math.floor(p * 16)));
      const img = ASSETS[key];
      const scaleBody = ninjaSpriteScale(f, 'airPalmStatic');
      const iw = (ASSETS.airPalmStatic?.naturalWidth || 1082) * scaleBody;
      const ih = (ASSETS.airPalmStatic?.naturalHeight || 950) * scaleBody;
      const handX = airPalmAnchor.x * iw;
      const handY = airPalmAnchor.y * ih;
      const fly = targetLocal ? smoothstep(clamp((p-.48)/.34,0,1)) : 0;
      const lx = lerp(handX, targetLocal ? targetLocal.x : handX, fly);
      const ly = lerp(handY, targetLocal ? targetLocal.y : handY, fly);
      ctx.save();
      ctx.translate(lx, ly);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= alpha === undefined ? 1 : clamp(alpha,0,1);
      if (img && img.ready && !img.failed) {
        const cellW = img.naturalWidth / 4, cellH = img.naturalHeight / 4;
        const sx = (frame % 4) * cellW, sy = Math.floor(frame / 4) * cellH;
        const size = f.radius * lerp(.58, 2.75, smoothstep(p)) * (1 + boom*.72);
        ctx.shadowColor = '#7ee8ff';
        ctx.shadowBlur = 18;
        ctx.globalAlpha *= .98;
        ctx.drawImage(img, sx, sy, cellW, cellH, -size, -size, size*2, size*2);
        ctx.globalAlpha *= .62;
        ctx.drawImage(img, sx, sy, cellW, cellH, -size*.72, -size*.72, size*1.44, size*1.44);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = Math.min(1, ctx.globalAlpha + .18);
        ctx.strokeStyle = 'rgba(235,252,255,.92)';
        ctx.lineWidth = Math.max(3, f.radius*.08);
        ctx.beginPath();
        ctx.arc(0,0,size*.48,0,TAU);
        ctx.stroke();
        if (boom > 0) {
          ctx.globalAlpha = Math.max(.18, (1-boom)*.78);
          ctx.strokeStyle = 'rgba(225,250,255,.95)';
          ctx.lineWidth = Math.max(5, f.radius*.12);
          ctx.beginPath();
          ctx.arc(0,0,size*(.52+boom*.42),0,TAU);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(74,196,255,.72)';
          ctx.lineWidth = Math.max(3, f.radius*.07);
          ctx.beginPath();
          ctx.arc(0,0,size*(.72+boom*.58),0,TAU);
          ctx.stroke();
        }
      } else {
        const r = f.radius * lerp(.35, 2.15, smoothstep(p)) * (1 + boom*.72);
        ctx.fillStyle = 'rgba(104,216,255,.72)';
        ctx.strokeStyle = '#e8fbff';
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      return {x:f.x + lx, y:f.y + ly};
    }

    function activeTeleportFor(f) {
      const now = ninjaNow();
      for (let i=NINJA_EVENTS.length-1;i>=0;i--) {
        const ev = NINJA_EVENTS[i];
        if (ev.ownerId === f.id && now - ev.start < ev.duration) return ev;
      }
      return null;
    }

    function drawNinjaBody(ctx, f, dt, baseDraw) {
      const v = getNinjaVisualState(f, dt);
      const ev = activeTeleportFor(f);
      const baseRot = Math.atan2(f.dir.y, f.dir.x);
      const localRot = getNinjaFacingAngle(f) - baseRot - bodyForwardOffset;
      const pulse = .5 + .5*Math.sin(ninjaNow()*7 + f.id);
      ctx.save();
      ctx.rotate(localRot);
      ctx.translate(0, Math.sin(ninjaNow()*4.2 + f.id) * 1.3);
      if (f.isRage) drawNinjaRageAura(ctx, f, pulse);
      if (ev && ev.kind === 'strike') {
        const age = ninjaNow() - ev.start;
        const arrive = clamp((age-.08)/.24,0,1);
        ctx.globalAlpha *= .38 + arrive*.62;
        const ok = drawImageCentered(ctx, 'airPalmStatic', ninjaSpriteScale(f, 'airPalmStatic'), 1);
        if (!ok && baseDraw) baseDraw(ctx, f);
        const ballProgress = clamp(age / .58, 0, 1);
        const explosionProgress = clamp((age-.34)/.88,0,1);
        const target = fighters.find(t => t && t.id === ev.targetId);
        let targetLocal = null;
        if (target) {
          const totalRot = getNinjaFacingAngle(f) - bodyForwardOffset;
          const dx = target.x - f.x, dy = target.y - f.y;
          targetLocal = {
            x: Math.cos(-totalRot)*dx - Math.sin(-totalRot)*dy,
            y: Math.sin(-totalRot)*dx + Math.cos(-totalRot)*dy
          };
        }
        const ballAlpha = clamp(1 - Math.max(0,age-1.22)/.34,0,1);
        drawNinjaElectricBall(ctx, f, ballProgress, ballAlpha, targetLocal, explosionProgress);
      } else {
        const arriveAlpha = ev ? clamp((ninjaNow()-ev.start)/.22, .25, 1) : 1;
        ctx.globalAlpha *= arriveAlpha;
        drawNinjaNormalThrow(ctx, f, dt, baseDraw);
      }
      ctx.restore();
    }

    function drawNinjaFallbackStar(ctx, p) {
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate((p.angle || 0) + ninjaNow()*18);
      for(let i=0;i<4;i++){ctx.rotate(Math.PI/2); drawPolygon(ctx,[[0,0],[22,-6],[12,6]],'#dff9ff','#0b1820',2);}
      ctx.restore();
    }

    function drawNinjaShurikenProjectile(ctx, p) {
      const img = ASSETS.shurikenStatic;
      if (!img || !img.ready || img.failed) return drawNinjaFallbackStar(ctx,p);
      const speedAngle = Math.atan2(p.vy || 0, p.vx || 1);
      const spin = (p.angle || 0) + ninjaNow()*18;
      const scale = ((p.radius || 12) * 3.05) / Math.max(img.naturalWidth, img.naturalHeight);
      ctx.translate(p.x,p.y);
      ctx.rotate(speedAngle + spin);
      ctx.drawImage(img, -img.naturalWidth*scale/2, -img.naturalHeight*scale/2, img.naturalWidth*scale, img.naturalHeight*scale);
    }

    function drawNinjaKunaiProjectile(ctx, p) {
      const img = ASSETS.kunaiStatic;
      if (!img || !img.ready || img.failed) {
        ctx.translate(p.x,p.y); ctx.rotate(Math.atan2(p.vy||0,p.vx||1));
        drawPolygon(ctx,[[-34,-8],[12,-8],[34,0],[12,8],[-34,8],[-24,0]],'#c7f7ff','#09202a',4);
        ctx.strokeStyle='#79d8ff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(-42,0,8,0,TAU);ctx.stroke();
        return;
      }
      const angle = Math.atan2(p.vy || 0, p.vx || 1);
      p.visualAngle = p.visualAngle === undefined ? angle : lerpAngle(p.visualAngle, angle, .38);
      const scale = ((p.radius || 16) * 5.15) / Math.max(img.naturalWidth, img.naturalHeight);
      ctx.translate(p.x,p.y);
      ctx.rotate(p.visualAngle - Math.PI/2);
      ctx.drawImage(img, -img.naturalWidth*scale/2, -img.naturalHeight*scale/2, img.naturalWidth*scale, img.naturalHeight*scale);
    }

    function drawNinjaStrikeProjectile(ctx, p) {
      const age = (p.maxCustomLife || 1) - (p.customLife || 0);
      ctx.translate(p.x,p.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= clamp(1-age/.92,.12,.8);
      ctx.strokeStyle = p.owner && p.owner.isRage ? 'rgba(255,142,38,.75)' : 'rgba(121,216,255,.75)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0,0,34 + age*190,0,TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(230,250,255,.65)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0,0,18 + Math.sin(age*28)*5,0,TAU);
      ctx.stroke();
    }

    function triggerNinjaTeleportVanish(owner, from, to, kind, targetId, rage) {
      if (!owner || !from || !to) return;
      NINJA_EVENTS.push({
        type:'teleport', ownerId:owner.id, targetId,
        fromX:from.x, fromY:from.y, toX:to.x, toY:to.y,
        start:ninjaNow(), duration: kind === 'endpoint' ? .52 : 1.58,
        kind:kind || 'strike', rage:!!rage,
        facing:getNinjaFacingAngle(owner), radius:owner.radius || 42
      });
    }

    function triggerNinjaTeleportArrival(owner, to, kind) {
      if (owner && owner.visual && owner.visual.ninja) owner.visual.ninja.arrivalStart = ninjaNow();
    }

    function activeNinjaVisualOwner(ev) {
      if (!ev) return null;
      return (fighters || []).find(f => f && f.id === ev.ownerId && f.name === 'NINJA' && f.hp > 0) || null;
    }

    function drawNinjaTeleportTear(ctx, ev) {
      if (!activeNinjaVisualOwner(ev)) return;
      const age = ninjaNow() - ev.start;
      if (age < -0.05) return;
      const oldA = clamp(1 - age/.32, 0, 1);
      const newA = clamp((age-.06)/.28, 0, 1) * clamp(1 - Math.max(0,age-.72)/.22, 0, 1);
      const colors = ev.rage ? ['#79d8ff','#fff7df','#ff8a26'] : ['#79d8ff','#e8fbff','#2cc8ff'];
      function afterimage(x,y,alpha,key,tearDir) {
        const img = ASSETS[key || 'mainStatic'];
        if (!img || !img.ready || img.failed || alpha <= 0) return;
        const bodyLong = Math.max(img.naturalWidth, img.naturalHeight);
        const scale = ((ev.radius || 42) * ((key === 'airPalmStatic') ? 3.18 : 2.78)) / bodyLong;
        ctx.save();
        ctx.translate(x,y);
        ctx.rotate((ev.facing || 0) - bodyForwardOffset);
        ctx.globalCompositeOperation = 'lighter';
        for (let i=0;i<7;i++) {
          const sliceY = -img.naturalHeight/2 + i*img.naturalHeight/7;
          const sliceH = img.naturalHeight/7 + 2;
          const tear = tearDir * (10 + i*5) * (1-alpha) + Math.sin(age*50+i)*5;
          ctx.globalAlpha = alpha * (.09 + i*.018);
          ctx.drawImage(img, 0, sliceY+img.naturalHeight/2, img.naturalWidth, sliceH, -img.naturalWidth*scale/2 + tear, sliceY*scale, img.naturalWidth*scale, sliceH*scale);
        }
        ctx.globalAlpha = alpha * .32;
        ctx.drawImage(img, -img.naturalWidth*scale/2, -img.naturalHeight*scale/2, img.naturalWidth*scale, img.naturalHeight*scale);
        ctx.restore();
      }
      function streaks(x,y,alpha,dir) {
        if (alpha <= 0) return;
        ctx.save();
        ctx.translate(x,y);
        ctx.globalCompositeOperation = 'lighter';
        for (let i=0;i<18;i++) {
          const seed = Math.sin((i+1)*47.13 + ev.start*13);
          const yy = (i-8.5)*7 + Math.sin(age*38+i)*5;
          const len = 36 + Math.abs(seed)*78;
          const jitter = Math.sin(age*78+i*2.1)*5;
          ctx.globalAlpha = alpha * (.16 + .035*i);
          ctx.strokeStyle = colors[i%colors.length];
          ctx.lineWidth = 2 + (i%4);
          ctx.beginPath();
          ctx.moveTo(-len*.5 + jitter, yy);
          ctx.lineTo(len*.5*dir + jitter + Math.sin(i)*12, yy + Math.cos(i*1.7)*11);
          ctx.stroke();
        }
        ctx.restore();
      }
      afterimage(ev.fromX, ev.fromY, oldA, 'mainStatic', -1);
      afterimage(ev.toX, ev.toY, newA, ev.kind === 'strike' ? 'airPalmStatic' : 'mainStatic', 1);
      streaks(ev.fromX, ev.fromY, oldA, -1);
      streaks(ev.toX, ev.toY, newA, 1);
      if (newA > 0) {
        ctx.save();
        ctx.translate(ev.toX, ev.toY);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = newA*.55;
        ctx.fillStyle = ev.rage ? 'rgba(255,136,34,.35)' : 'rgba(121,216,255,.36)';
        ctx.beginPath(); ctx.arc(0,0,22 + newA*34,0,TAU); ctx.fill();
        ctx.restore();
      }
    }

    function updateNinjaVisuals(dt, before) {
      const now = ninjaNow();
      const blockedStatuses = ['slow','push','burn','poison','freeze','bleed','stun','weak','brittle','scent','abilityDisabled','silenceCurse','hexBurn','rapidPunch','disease','paintRed','paintBlue','paintYellow','innerTrauma','mathGraphContact','mathFormulaContact'];
      for (const f of fighters || []) {
        if (f && f.name === 'NINJA' && f.data && (f.data.ninjaImmuneUntil || 0) > matchClock && f.statuses) {
          for (const key of blockedStatuses) delete f.statuses[key];
          f.data.wallInteractionBlocked = true;
        }
      }
      for (const p of projectiles) {
        if (!p || !p.owner || p.owner.name !== 'NINJA' || seenProjectiles.has(p)) continue;
        seenProjectiles.add(p);
        const owner = p.owner;
        const v = getNinjaVisualState(owner, dt);
        if (p.type === 'ninja_shuriken') {
          p.visualStart = now;
          v.throwStart = now;
          v.facingAngle = Math.atan2(p.vy || 0, p.vx || 1);
          p.visualHandStart = getNinjaHandAnchor(owner, 'mainStatic', handAnchor);
        }
        if (p.type === 'ninja_kunai') {
          p.visualStart = now;
          p.visualAngle = Math.atan2(p.vy || 0, p.vx || 1);
          v.kunaiThrowStart = now;
          v.facingAngle = p.visualAngle;
        }
        if (p.type === 'ninja_strike') {
          const b = before && before.get(owner.id);
          const from = b ? {x:b.x, y:b.y} : {x:owner.x, y:owner.y};
          const to = {x:p.x, y:p.y};
          triggerNinjaTeleportVanish(owner, from, to, 'strike', p.targetId, owner.isRage);
          triggerNinjaTeleportArrival(owner, to, 'strike');
          v.facingAngle = Math.atan2((enemyOfNinja(owner)?.y || owner.y) - owner.y, (enemyOfNinja(owner)?.x || owner.x+1) - owner.x);
        }
      }
      if (before) {
        for (const f of fighters || []) {
          if (!f || f.name !== 'NINJA') continue;
          const b = before.get(f.id);
          if (!b) continue;
          const jumped = dist(b.x,b.y,f.x,f.y) > Math.max(70, f.radius*1.7);
          const teleportsUp = (f.data.teleports || 0) > (b.teleports || 0);
          const recentStrike = NINJA_EVENTS.some(ev => ev.ownerId === f.id && ev.kind === 'strike' && now - ev.start < .08);
          if (jumped && teleportsUp && !recentStrike) {
            playNinjaTeleportAudio(f, false);
            triggerNinjaTeleportVanish(f, {x:b.x,y:b.y}, {x:f.x,y:f.y}, 'endpoint', undefined, f.isRage);
            triggerNinjaTeleportArrival(f, {x:f.x,y:f.y}, 'endpoint');
          }
        }
      }
      for (let i=NINJA_EVENTS.length-1;i>=0;i--) {
        const ev = NINJA_EVENTS[i];
        const age = now - ev.start;
        if (!activeNinjaVisualOwner(ev) || age < -0.05 || age > ev.duration + .08) NINJA_EVENTS.splice(i,1);
      }
      updateNinjaAudio();
    }

    loadNinjaAssets();

    const ninjaType = FighterTypes.find(f => f && f.name === 'NINJA');
    if (ninjaType && !ninjaType.__ninjaVisualPatched) {
      const oldNinjaDraw = ninjaType.draw;
      ninjaType.draw = function(ctx, f) { drawNinjaBody(ctx, f, 1/60, oldNinjaDraw); };
      ninjaType.__ninjaVisualPatched = true;
    }

    if (!window.__apexNinjaVisualUpdatePatched) {
      window.__apexNinjaVisualUpdatePatched = true;
      const oldUpdateProjectilesNinjaVisual = updateProjectiles;
      updateProjectiles = function(dt) {
        const before = new Map();
        for (const f of fighters || []) if (f && f.name === 'NINJA') before.set(f.id, {x:f.x, y:f.y, teleports:f.data && f.data.teleports || 0});
        oldUpdateProjectilesNinjaVisual(dt);
        updateNinjaVisuals(dt, before);
      };
      window.updateProjectiles = updateProjectiles;
    }

    if (!window.__apexNinjaVisualDrawPatched) {
      window.__apexNinjaVisualDrawPatched = true;
      const oldDrawProjectilesNinjaVisual = drawProjectiles;
      drawProjectiles = function(ctx) {
        oldDrawProjectilesNinjaVisual(ctx);
        for (let i=NINJA_EVENTS.length-1;i>=0;i--) {
          const ev = NINJA_EVENTS[i];
          const age = ninjaNow() - ev.start;
          if (!activeNinjaVisualOwner(ev) || age < -0.05 || age > ev.duration + .08) {
            NINJA_EVENTS.splice(i,1);
            continue;
          }
          drawNinjaTeleportTear(ctx, ev);
        }
      };
      window.drawProjectiles = drawProjectiles;
    }

    window.NINJA_ASSET_MANIFEST = NINJA_ASSET_MANIFEST;
    window.NINJA_AUDIO_MANIFEST = NINJA_AUDIO_MANIFEST;
    window.apexNinjaVisualAssets = ASSETS;
    window.apexNinjaVisualEvents = NINJA_EVENTS;
    window.loadNinjaAssets = loadNinjaAssets;
    window.drawNinjaBody = drawNinjaBody;
    window.getNinjaFacingAngle = getNinjaFacingAngle;
    window.getNinjaHandAnchor = getNinjaHandAnchor;
    window.drawNinjaNormalThrow = drawNinjaNormalThrow;
    window.drawNinjaShurikenProjectile = drawNinjaShurikenProjectile;
    window.drawNinjaKunaiProjectile = drawNinjaKunaiProjectile;
    window.drawNinjaStrikeProjectile = drawNinjaStrikeProjectile;
    window.triggerNinjaTeleportVanish = triggerNinjaTeleportVanish;
    window.triggerNinjaTeleportArrival = triggerNinjaTeleportArrival;
    window.drawNinjaElectricBall = drawNinjaElectricBall;
    window.drawNinjaRageAura = drawNinjaRageAura;
    window.drawNinjaTeleportTear = drawNinjaTeleportTear;
    window.playNinjaTeleportAudio = playNinjaTeleportAudio;
    window.playNinjaShurikenAudio = playNinjaShurikenAudio;
    window.playNinjaKunaiAudio = playNinjaKunaiAudio;
    window.fadeNinjaSkillAudio = fadeNinjaSkillAudio;
    window.stopNinjaAudio = stopNinjaAudio;
    console.info('[Apex Chaos] NINJA visual assets integrated', NINJA_ASSET_MANIFEST);
  } catch (err) {
    window.apexNinjaVisualError = {message: err && err.message, stack: err && err.stack};
    console.error('[Apex Chaos] NINJA visual integration failed', err);
  }
})();
