// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function apexIceVisualIntegration(){
  try {
    const ICE_ASSET_MANIFEST = {
      mainStatic: 'assets/ice_v1/normalized/iceMainStatic.webp',
      fingerGunPose: 'assets/ice_v1/normalized/iceFingerGunPose.webp',
      laneStartSegment: 'assets/ice_v1/normalized/iceLaneStartSegment.webp',
      shardProjectile: 'assets/ice_v1/normalized/iceShardProjectile.webp',
      frozenText: 'assets/ice_v1/normalized/frozenText.webp',
      iceBlockOverlay: 'assets/ice_v1/normalized/iceBlockOverlay.webp',
      fullArenaFrozenOverlay: 'assets/ice_v1/normalized/fullArenaFrozenOverlay.webp',
      iceAgeText: 'assets/ice_v1/normalized/iceAgeText.webp'
    };
    const ICE_ASSETS = {};
    const ICE_AUDIO_MANIFEST = {
      castHaki: 'assets/ice_v1/audio/cast_haki.mp3',
      castFreeze: 'assets/ice_v1/audio/cast_freeze_hq.mp3',
      iceAgeCall: 'assets/ice_v1/audio/ice_age_call.mp3',
      ambientWind: 'assets/ice_v1/audio/ambient_wind.mp3',
      ambientIceCrack: 'assets/ice_v1/audio/ambient_ice_crack.mp3',
      ambientFreezeCrack: 'assets/ice_v1/audio/ambient_freeze_crack.mp3',
      freezeTarget: 'assets/ice_v1/audio/freeze_target.mp3',
      iceDartFly: 'assets/ice_v1/audio/ice_dart_fly.mp3',
      iceDartHit: 'assets/ice_v1/audio/ice_dart_hit.mp3'
    };
    const ICE_AUDIO = {};
    const ICE_AUDIO_STATE = {ambient:false,fadeStart:0,fadeDuration:1.5,pendingFreezeAt:0,castHakiStopAt:0};
    const ICE_VISUAL_EVENTS = [];
    const seenIceProjectiles = new WeakSet();
    const heardIceDartHits = new WeakSet();
    const bodyForwardOffset = Math.PI / 2;
    const shardForwardOffset = 2.42;
    const fingerTipAnchor = {x:-0.121, y:0.172};
    let lastIceClock = 0;
    let iceAgeWindup = null;

    function iceRealNowMs() {
      if (Number.isFinite(window.__apexIceTestNowMs)) return window.__apexIceTestNowMs;
      if (typeof navigator!=='undefined' && /html-tournament-harness/i.test(navigator.userAgent||'')) return iceNow()*1000;
      return performance.now();
    }

    function iceNow() {
      return typeof matchClock === 'number' && isFinite(matchClock) ? matchClock : performance.now()/1000;
    }
    function iceEase(t) {
      t = clamp(t,0,1);
      return t*t*(3-2*t);
    }
    function iceAngleDelta(a,b) {
      return Math.atan2(Math.sin(a-b),Math.cos(a-b));
    }
    function iceLerpAngle(a,b,t) {
      return a + iceAngleDelta(b,a)*clamp(t,0,1);
    }
    function loadIceAssets() {
      let pending = 0;
      for (const [role,src] of Object.entries(ICE_ASSET_MANIFEST)) {
        const img = new Image();
        ICE_ASSETS[role] = img;
        pending++;
        img.onload = () => { img.ready=true; if (--pending<=0) window.apexIceVisualReady=true; };
        img.onerror = () => { img.failed=true; if (--pending<=0) window.apexIceVisualReady=true; };
        img.src = src;
      }
      if (!pending) window.apexIceVisualReady=true;
      return ICE_ASSETS;
    }
    function loadIceAudio() {
      if (typeof Audio !== 'function') return ICE_AUDIO;
      for (const [role,src] of Object.entries(ICE_AUDIO_MANIFEST)) {
        const audio = new Audio(src);
        audio.preload = 'auto';
        ICE_AUDIO[role] = audio;
      }
      return ICE_AUDIO;
    }
    function playIceAudio(role,volume=1,loop=false,startAt=0) {
      if (window.__apexMuteIceAudio) return null;
      const audio=ICE_AUDIO[role];
      if (!audio) return null;
      try {
        audio.pause(); audio.currentTime=Math.max(0,startAt||0); audio.loop=loop; audio.volume=clamp(volume,0,1);
        const promise=audio.play();
        if (promise && promise.catch) promise.catch(()=>{});
      } catch (_) {}
      return audio;
    }
    function playIceCastAudio() {
      playIceAudio('castHaki',.82,false,.34);
      playIceAudio('castFreeze',.88,false);
      ICE_AUDIO_STATE.pendingFreezeAt=0;
      ICE_AUDIO_STATE.castHakiStopAt=iceRealNowMs()+1180;
    }
    function playIceAgeCall() { playIceAudio('iceAgeCall',.96,false); }
    function startIceAgeAmbient() {
      ICE_AUDIO_STATE.ambient=true; ICE_AUDIO_STATE.fadeStart=0;
      playIceAudio('ambientWind',.30,true);
      playIceAudio('ambientIceCrack',.22,true);
      playIceAudio('ambientFreezeCrack',.17,true);
    }
    function beginIceAgeAmbientFade() {
      if (!ICE_AUDIO_STATE.ambient || ICE_AUDIO_STATE.fadeStart) return;
      ICE_AUDIO_STATE.fadeStart=iceRealNowMs();
    }
    function updateIceAudio() {
      if (ICE_AUDIO_STATE.pendingFreezeAt && iceRealNowMs()>=ICE_AUDIO_STATE.pendingFreezeAt) {
        ICE_AUDIO_STATE.pendingFreezeAt=0;
        playIceAudio('castFreeze',.88,false);
      }
      if (ICE_AUDIO_STATE.castHakiStopAt) {
        const audio=ICE_AUDIO.castHaki;
        const left=ICE_AUDIO_STATE.castHakiStopAt-iceRealNowMs();
        if (audio && left<160 && left>0) audio.volume=.82*clamp(left/160,0,1);
        if (audio && left<=0) { try { audio.pause(); audio.currentTime=0; } catch (_) {} ICE_AUDIO_STATE.castHakiStopAt=0; }
      }
      if (!ICE_AUDIO_STATE.fadeStart) return;
      const t=clamp((iceRealNowMs()-ICE_AUDIO_STATE.fadeStart)/(ICE_AUDIO_STATE.fadeDuration*1000),0,1);
      const volumes={ambientWind:.30,ambientIceCrack:.22,ambientFreezeCrack:.17};
      for (const [role,base] of Object.entries(volumes)) {
        const audio=ICE_AUDIO[role];
        if (!audio) continue;
        audio.volume=base*(1-t);
        if (t>=1) { audio.pause(); audio.loop=false; audio.currentTime=0; }
      }
      if (t>=1) { ICE_AUDIO_STATE.ambient=false; ICE_AUDIO_STATE.fadeStart=0; }
    }
    function iceAssetReady(role) {
      const img=ICE_ASSETS[role];
      return !!(img && img.ready && !img.failed && img.naturalWidth>0);
    }
    function enemyOfIce(f) {
      return (fighters||[]).find(q=>q && q!==f && q.hp>0) || null;
    }
    function getIceVisualState(f,dt) {
      f.visual ||= {};
      const v=f.visual.ice || (f.visual.ice={});
      const frozenVisual=f.data && f.data.iceDrawLocked || f.hasStatus && (f.hasStatus('freeze') || f.hasStatus('stun'));
      const pausedVisual=typeof timeScale==='number' && timeScale<.12;
      if ((frozenVisual || pausedVisual) && v.facingAngle!==undefined) return v;
      const enemy=enemyOfIce(f);
      const target=v.shotAngle!==undefined && (v.shotUntil||0)>iceNow()
        ? v.shotAngle
        : enemy ? Math.atan2(enemy.y-f.y,enemy.x-f.x) : Math.atan2(f.dir.y,f.dir.x);
      if (v.facingAngle===undefined) v.facingAngle=target;
      v.facingAngle=iceLerpAngle(v.facingAngle,target,Math.min(1,(dt||1/60)*11));
      return v;
    }
    function iceBodyScale(f,role) {
      const img=ICE_ASSETS[role];
      if (!img || !img.naturalWidth) return 1;
      return (f.radius*2.92)/Math.max(img.naturalWidth,img.naturalHeight);
    }
    function drawIceAssetCentered(ctx,role,scale,alpha) {
      const img=ICE_ASSETS[role];
      if (!iceAssetReady(role)) return false;
      ctx.save();
      ctx.globalAlpha*=alpha===undefined?1:alpha;
      ctx.imageSmoothingEnabled=true;
      ctx.drawImage(img,-img.naturalWidth*scale/2,-img.naturalHeight*scale/2,img.naturalWidth*scale,img.naturalHeight*scale);
      ctx.restore();
      return true;
    }
    function getIceFingerTipAnchor(f) {
      const role='fingerGunPose';
      const img=ICE_ASSETS[role];
      const scale=iceBodyScale(f,role);
      const lx=fingerTipAnchor.x*(img?.naturalWidth||1093)*scale;
      const ly=fingerTipAnchor.y*(img?.naturalHeight||1028)*scale;
      const v=getIceVisualState(f,1/60);
      const rot=v.facingAngle-bodyForwardOffset;
      return {
        x:f.x+Math.cos(rot)*lx-Math.sin(rot)*ly,
        y:f.y+Math.sin(rot)*lx+Math.cos(rot)*ly
      };
    }
    function drawIceChampion(ctx,f,baseDraw) {
      const now=iceNow();
      const v=getIceVisualState(f,1/60);
      const firing=(v.shotUntil||0)>now;
      const role=firing && iceAssetReady('fingerGunPose')?'fingerGunPose':'mainStatic';
      const baseAngle=Math.atan2(f.dir.y,f.dir.x);
      const localRotation=v.facingAngle-baseAngle-bodyForwardOffset;
      ctx.save();
      ctx.rotate(localRotation);
      ctx.translate(0,Math.sin(now*3.7+f.id)*1.15);
      const ok=drawIceAssetCentered(ctx,role,iceBodyScale(f,role),1);
      ctx.restore();
      if (!ok && baseDraw) baseDraw(ctx,f);
    }
    function drawIceLane(ctx,p) {
      if (!iceAssetReady('laneStartSegment')) return false;
      const img=ICE_ASSETS.laneStartSegment;
      const dx=p.x2-p.x1,dy=p.y2-p.y1;
      const length=Math.hypot(dx,dy);
      if (!(length>0)) return true;
      const width=(p.halfWidth||0)*2;
      const lifeAlpha=clamp((p.life||0)/Math.max(.001,p.maxLife||p.life||1),0,1);
      ctx.save();
      ctx.beginPath(); ctx.rect(0,0,GAME_SIZE,GAME_SIZE); ctx.clip();
      ctx.translate(p.x1,p.y1);
      ctx.rotate(Math.atan2(dy,dx));
      ctx.globalAlpha=.48*lifeAlpha;
      ctx.imageSmoothingEnabled=true;
      const visualLength=length+Math.max(240,width*.72);
      ctx.drawImage(img,0,-width/2,visualLength,width);
      ctx.restore();
      return true;
    }
    function drawIceShardProjectile(ctx,p) {
      if (!iceAssetReady('shardProjectile')) return false;
      const img=ICE_ASSETS.shardProjectile;
      const age=Math.max(0,iceNow()-(p.visualIceStart||iceNow()));
      const blend=iceEase(age/.22);
      const x=lerp(p.visualIceSpawnX===undefined?p.x:p.visualIceSpawnX,p.x,blend);
      const y=lerp(p.visualIceSpawnY===undefined?p.y:p.visualIceSpawnY,p.y,blend);
      const face=p.phase==='stage'&&Number.isFinite(p.stageAngle)?p.stageAngle:Math.atan2(p.vy||0,p.vx||1);
      const angle=face-shardForwardOffset;
      const scale=44/Math.max(img.naturalWidth,img.naturalHeight);
      ctx.save();
      ctx.translate(x,y); ctx.rotate(angle);
      ctx.globalAlpha=clamp((p.life||0)/.14,0,1);
      ctx.shadowColor='rgba(80,205,255,.55)'; ctx.shadowBlur=6;
      ctx.drawImage(img,-img.naturalWidth*scale/2,-img.naturalHeight*scale/2,img.naturalWidth*scale,img.naturalHeight*scale);
      ctx.restore();
      return true;
    }
    function triggerIceVisualEvent(type,data={}) {
      const ev={type,start:iceNow(),realStart:iceRealNowMs()/1000,...data};
      if (type==='iceAge') ev.duration=data.duration||1.25;
      ICE_VISUAL_EVENTS.push(ev);
      return ev;
    }
    function activeIceAgeEvent() {
      const now=iceRealNowMs()/1000;
      for (let i=ICE_VISUAL_EVENTS.length-1;i>=0;i--) {
        const ev=ICE_VISUAL_EVENTS[i];
        if (ev.type==='iceAge' && now-(ev.realStart||0)<ev.duration) return ev;
      }
      return null;
    }
    function activeIceAgeField() {
      return (projectiles||[]).find(p=>p && p.type==='ice_age_field' && p.owner && p.owner.name==='ICE' && !(owner.type&&owner.type.__hrHero==='ICE') && p.life>0) || null;
    }
    function drawFullArenaFrozenOverlay(ctx) {
      const ev=activeIceAgeEvent();
      const field=activeIceAgeField();
      if (!ev && !field) return false;
      const age=ev ? iceRealNowMs()/1000-(ev.realStart||0) : .3;
      const enter=ev ? iceEase(age/.13) : 1;
      const fieldExit=field ? iceEase((field.life||0)/.35) : 1;
      const exit=field ? fieldExit : (ev ? 1-iceEase((age-(ev.duration-.26))/.26) : 1);
      ctx.save();
      ctx.beginPath(); ctx.rect(0,0,GAME_SIZE,GAME_SIZE); ctx.clip();
      if (iceAssetReady('fullArenaFrozenOverlay')) {
        const img=ICE_ASSETS.fullArenaFrozenOverlay;
        const overscan=135;
        ctx.globalAlpha=.56*enter*exit;
        ctx.drawImage(img,-overscan,-overscan,GAME_SIZE+overscan*2,GAME_SIZE+overscan*2);
      } else {
        ctx.globalAlpha=.24*enter*exit;
        ctx.fillStyle='#8cecff'; ctx.fillRect(0,0,GAME_SIZE,GAME_SIZE);
        ctx.globalAlpha=.42*enter*exit; ctx.strokeStyle='#e8fcff'; ctx.lineWidth=4;
        for (let i=0;i<18;i++) {
          const a=i*2.399, r=GAME_SIZE*.72;
          ctx.beginPath(); ctx.moveTo(GAME_SIZE/2,GAME_SIZE/2);
          ctx.lineTo(GAME_SIZE/2+Math.cos(a)*r,GAME_SIZE/2+Math.sin(a)*r); ctx.stroke();
        }
      }
      ctx.restore();
      return true;
    }
    function drawIceAgeTextImage(ctx,owner) {
      const ev=activeIceAgeEvent();
      if (!ev) return;
      if (!owner || owner.name!=='ICE' || (ev.ownerId!==undefined && ev.ownerId!==owner.id)) return;
      const age=iceRealNowMs()/1000-(ev.realStart||0);
      const enter=iceEase(age/.14);
      const exit=1-iceEase((age-(ev.duration-.28))/.28);
      const bump=age<.18?lerp(.80,1.06,iceEase(age/.18)):lerp(1.06,1,iceEase((age-.18)/.18));
      ctx.save();
      ctx.translate(owner.x,owner.y-owner.radius-76);
      ctx.scale(bump,bump);
      ctx.globalAlpha=enter*exit;
      if (iceAssetReady('iceAgeText')) {
        const img=ICE_ASSETS.iceAgeText;
        const w=158,h=w*img.naturalHeight/img.naturalWidth;
        ctx.drawImage(img,-w/2,-h/2,w,h);
      } else {
        ctx.fillStyle='#8cecff'; ctx.strokeStyle='#08354f'; ctx.lineWidth=10;
        ctx.font="900 34px 'Segoe UI'"; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.strokeText('ICE AGE',0,0); ctx.fillText('ICE AGE',0,0);
      }
      ctx.restore();
    }
    function iceAgeDurationFor(f) {
      const missing=clamp((f.maxHp-f.hp)/Math.max(1,f.maxHp),0,1);
      return 5.65+missing*4.6;
    }
    function startIceAgeWindup(f) {
      if (!f || f.name!=='ICE' || f.data.iceAgeWindup || activeIceAgeField()) return;
      const now=iceRealNowMs();
      f.data.iceAgeCasts=(f.data.iceAgeCasts||0)+1;
      f.data.iceAgeWindup=true;
      f.data.iceAgeCd=99;
      f.data.iceAgeFieldDuration=iceAgeDurationFor(f);
      iceAgeWindup={
        ownerId:f.id,
        endMs:now+1050,
        previousTimeScale:timeScale,
        positions:(fighters||[]).filter(Boolean).map(q=>({id:q.id,x:q.x,y:q.y,dirX:q.dir.x,dirY:q.dir.y}))
      };
      timeScale=Math.min(timeScale,.06);
      playIceCastAudio();
      playIceAgeCall();
      triggerIceVisualEvent('iceAge',{ownerId:f.id,duration:1.3});
      triggerFlash(125,225,255,.16);
    }
    function finishIceAgeWindup() {
      if (!iceAgeWindup) return;
      const windup=iceAgeWindup;
      const owner=(fighters||[]).find(f=>f && f.id===windup.ownerId && f.name==='ICE' && !(f.type&&f.type.__hrHero==='ICE'));
      iceAgeWindup=null;
      timeScale=Number.isFinite(windup.previousTimeScale)?windup.previousTimeScale:1;
      if (!owner || owner.hp<=0 || gameState!=='PLAYING') return;
      owner.data.iceAgeWindup=false;
      const duration=owner.data.iceAgeFieldDuration||iceAgeDurationFor(owner);
      owner.data.iceAgeCd=6.1;
      projectiles.push({
        type:'ice_age_field',owner,life:duration,maxLife:duration,
        enemyInside:0,dmgTick:0,freezeTriggered:false
      });
      startIceAgeAmbient();
      emitParticles(owner.x,owner.y,'#bff7ff',42,420,6,.8,'square');
      spawnShockwave(owner.x,owner.y,'#8deaff',260);
    }
    function maintainIceAgeWindup() {
      if (!iceAgeWindup) return;
      for (const snap of iceAgeWindup.positions) {
        const f=(fighters||[]).find(q=>q && q.id===snap.id);
        if (!f) continue;
        f.x=snap.x; f.y=snap.y; f.dir.x=snap.dirX; f.dir.y=snap.dirY;
        f.data.positionLocked=true;
      }
      if (iceRealNowMs()>=iceAgeWindup.endMs) finishIceAgeWindup();
    }
    function updateIceAgeFields(dt) {
      let hasField=false;
      for (const p of projectiles||[]) {
        if (!p || p.type!=='ice_age_field' || p.life<=0 || !p.owner) continue;
        hasField=true;
        const owner=p.owner;
        const foe=(fighters||[]).find(f=>f && f!==owner && f.hp>0);
        owner.applyStatus('speed',.24,{mult:1.35});
        if (!foe) continue;
        foe.applyStatus('slow',.24,{mult:.35});
        p.enemyInside=(p.enemyInside||0)+dt;
        p.dmgTick=(p.dmgTick||0)+dt;
        while (p.dmgTick>=1) {
          p.dmgTick-=1;
          foe.takeDamage(7.3,owner,'ice-age-field',true);
        }
        if (!p.freezeTriggered && p.enemyInside>=1.75) {
          p.freezeTriggered=true;
          foe.applyStatus('freeze',1.6,{source:owner,dartTotal:22});
          foe.applyStatus('frostMark',6.0,{source:owner});
        }
      }
      if (!hasField && ICE_AUDIO_STATE.ambient) beginIceAgeAmbientFade();
    }
    function iceProjectileSlowMult(p) {
      if (!p || p.x===undefined || p.y===undefined || p.vx===undefined || p.vy===undefined) return 1;
      if (p.type==='ice_lane' || p.type==='ice_age_field') return 1;
      let mult=1;
      const field=activeIceAgeField();
      if (field) mult=Math.min(mult,.38);
      for (const lane of projectiles||[]) {
        if (!lane || lane.type!=='ice_lane' || !lane.owner || lane.owner.name!=='ICE' || lane.life<=0) continue;
        const radius=p.radius||10;
        if (distToSegment(p.x,p.y,lane.x1,lane.y1,lane.x2,lane.y2) <= (lane.halfWidth||0)+radius) {
          mult=Math.min(mult,.46);
        }
      }
      if (p.type==='ice_dart') mult=Math.max(mult,.82);
      return mult;
    }
    function applyIceProjectileSlow(before) {
      if (!before || !(projectiles||[]).length) return;
      for (const p of projectiles||[]) {
        const mult=iceProjectileSlowMult(p);
        if (mult>=.999) continue;
        const b=before.get(p);
        if (!b || !Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        p.x=b.x+(p.x-b.x)*mult;
        p.y=b.y+(p.y-b.y)*mult;
        p.visualIceSlow=.16;
      }
    }
    function iceFreezeVisual(target) {
      target.visual ||= {};
      return target.visual.iceFrozen || (target.visual.iceFrozen={active:false,start:-999,end:-999,sourceId:null});
    }
    function isIceFreeze(target) {
      const s=target && target.statuses && target.statuses.freeze;
      return !!(s && s.timer>0 && s.source && s.source.name==='ICE');
    }
    function drawFrozenTargetOverlay(ctx,target) {
      const v=iceFreezeVisual(target);
      const now=iceNow();
      const active=isIceFreeze(target);
      const ending=!active && now-v.end<.24;
      if (!active && !ending) return;
      const age=active?now-v.start:now-v.end;
      const pop=active?lerp(.65,1,iceEase(age/.16)):1+iceEase(age/.24)*.10;
      const alpha=active?(.78+.05*Math.sin(now*5+target.id)):(1-iceEase(age/.24))*.78;
      ctx.save();
      ctx.translate(target.x,target.y);
      ctx.scale(pop,pop);
      if (iceAssetReady('iceBlockOverlay')) {
        const img=ICE_ASSETS.iceBlockOverlay;
        const h=target.radius*3.12,w=h*img.naturalWidth/img.naturalHeight;
        ctx.globalAlpha=alpha;
        ctx.drawImage(img,-w/2,-h*.53,w,h);
      } else {
        ctx.globalAlpha=alpha*.72; ctx.fillStyle='rgba(90,205,245,.48)'; ctx.strokeStyle='#d9fbff'; ctx.lineWidth=6;
        ctx.beginPath(); ctx.moveTo(0,-target.radius*1.55); ctx.lineTo(target.radius*1.12,-target.radius*.72); ctx.lineTo(target.radius*1.2,target.radius*1.38); ctx.lineTo(-target.radius*1.2,target.radius*1.38); ctx.lineTo(-target.radius*1.12,-target.radius*.72); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      if (active) drawFrozenTextImage(ctx,target,v);
    }
    function drawFrozenTextImage(ctx,target,v) {
      const age=iceNow()-v.start;
      if (age>.9) return;
      const enter=iceEase(age/.12),exit=1-iceEase((age-.62)/.28);
      const rise=iceEase(age/.9)*18;
      ctx.save();
      ctx.translate(target.x,target.y-target.radius-62-rise);
      ctx.globalAlpha=enter*exit;
      const scale=age<.16?lerp(.72,1.08,iceEase(age/.16)):lerp(1.08,1,iceEase((age-.16)/.14));
      ctx.scale(scale,scale);
      if (iceAssetReady('frozenText')) {
        const img=ICE_ASSETS.frozenText;
        const w=target.radius*2.9,h=w*img.naturalHeight/img.naturalWidth;
        ctx.drawImage(img,-w/2,-h/2,w,h);
      } else {
        ctx.fillStyle='#9cecff'; ctx.strokeStyle='#07334d'; ctx.lineWidth=7;
        ctx.font="900 38px 'Segoe UI'"; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.strokeText('FROZEN',0,0); ctx.fillText('FROZEN',0,0);
      }
      ctx.restore();
    }
    function noteIceProjectile(p) {
      if (!p || seenIceProjectiles.has(p)) return;
      if (p.type!=='ice_lane' && p.type!=='ice_dart') return;
      seenIceProjectiles.add(p);
      const owner=p.owner;
      if (!owner || owner.name!=='ICE') return;
      owner.visual ||= {};
      const v=owner.visual.ice || (owner.visual.ice={});
      if (p.type==='ice_lane') {
        v.shotAngle=Math.atan2(p.y2-p.y1,p.x2-p.x1);
        v.shotUntil=Math.max(v.shotUntil||0,iceNow()+.42);
        playIceCastAudio();
      } else {
        const target=(fighters||[]).find(f=>f && f.id===p.targetId);
        v.shotAngle=target?Math.atan2(target.y-owner.y,target.x-owner.x):Math.atan2(p.vy||0,p.vx||1);
        v.shotUntil=Math.max(v.shotUntil||0,iceNow()+.36);
        p.life=Math.max(p.life||0,1.35);
        p.maxLife=Math.max(p.maxLife||0,1.35);
        playIceAudio('iceDartFly',.24,false);
        const tip=getIceFingerTipAnchor(owner);
        p.visualIceSpawnX=tip.x; p.visualIceSpawnY=tip.y; p.visualIceStart=iceNow();
      }
    }
    function updateIceDartHitAudio() {
      for (const p of projectiles||[]) {
        if (!p || p.type!=='ice_dart' || !p.owner || p.owner.name!=='ICE' || heardIceDartHits.has(p)) continue;
        if ((p.life||0)>0) continue;
        const target=(fighters||[]).find(f=>f && f.id===p.targetId);
        if (!target || dist(p.x,p.y,target.x,target.y)<=target.radius+38) {
          heardIceDartHits.add(p);
          playIceAudio('iceDartHit',.42,false);
        }
      }
    }
    function updateIceVisuals() {
      const now=iceNow();
      if (now<lastIceClock) {
        ICE_VISUAL_EVENTS.length=0;
        iceAgeWindup=null;
        for (const audio of Object.values(ICE_AUDIO)) { try { audio.pause(); audio.currentTime=0; } catch (_) {} }
        ICE_AUDIO_STATE.ambient=false; ICE_AUDIO_STATE.fadeStart=0; ICE_AUDIO_STATE.pendingFreezeAt=0; ICE_AUDIO_STATE.castHakiStopAt=0;
      }
      lastIceClock=now;
      for (const p of projectiles||[]) noteIceProjectile(p);
      for (const f of fighters||[]) {
        if (!f) continue;
        const v=iceFreezeVisual(f);
        const active=isIceFreeze(f);
        if (active && !v.active) { v.active=true; v.start=now; v.sourceId=f.statuses.freeze.source.id; }
        if (!active && v.active) { v.active=false; v.end=now; }
      }
      for (let i=ICE_VISUAL_EVENTS.length-1;i>=0;i--) {
        const ev=ICE_VISUAL_EVENTS[i];
        const age=ev.type==='iceAge' ? iceRealNowMs()/1000-(ev.realStart||0) : now-ev.start;
        if (age>(ev.duration||1)+.1) ICE_VISUAL_EVENTS.splice(i,1);
      }
    }

    loadIceAssets();
    loadIceAudio();
    const iceType=FighterTypes.find(t=>t && t.name==='ICE');
    if (iceType && !iceType.__iceAssetVisualPatched) {
      const oldIceInit=iceType.init;
      iceType.init=function(f) {
        if (oldIceInit) oldIceInit(f);
        f.data.iceAgeCasts=0;
        f.data.iceAgeCd=0;
        f.data.iceAgeWindup=false;
        f.data.iceAgeFieldDuration=0;
        delete f.data.rageTouches;
      };
      const oldIceUpdate=iceType.update;
      iceType.update=function(f,e,dt) {
        if (f.data.iceAgeWindup) return;
        if (f.isRage) {
          if (activeIceAgeField()) return;
          f.data.iceAgeCd=Math.max(0,(f.data.iceAgeCd||0)-abilityDt(f,dt));
          if (f.data.iceAgeCd<=0) startIceAgeWindup(f);
          return;
        }
        if (oldIceUpdate) oldIceUpdate(f,e,dt);
      };
      const oldIceDraw=iceType.draw;
      iceType.draw=function(ctx,f){ drawIceChampion(ctx,f,oldIceDraw); };
      iceType.onCollide=function(){ return false; };
      iceType.onRage=function(f){ f.data.iceAgeCd=0; startIceAgeWindup(f); };
      iceType.desc='Frost lane and a missing-health-scaled global ICE AGE';
      iceType.__iceAssetVisualPatched=true;
    }
    if (!Fighter.prototype.__iceFreezeApplyPatched) {
      const oldApplyStatusIceVisual=Fighter.prototype.applyStatus;
      Fighter.prototype.applyStatus=function(name,duration,data={}) {
        const wasFrozen=name==='freeze' && this.hasStatus && this.hasStatus('freeze');
        const result=oldApplyStatusIceVisual.call(this,name,duration,data);
        if (name==='freeze' && data && data.source && data.source.name==='ICE' && !(this.type&&this.type.__hrHero==='ICE') && this.hasStatus('freeze') && !wasFrozen) {
          const v=iceFreezeVisual(this); v.active=true; v.start=iceNow(); v.end=-999; v.sourceId=data.source.id;
          playIceAudio('freezeTarget',.62,false);
        }
        return result;
      };
      Fighter.prototype.__iceFreezeApplyPatched=true;
    }
    if (!Fighter.prototype.__iceAgeGuardDamagePatched) {
      const oldTakeDamageIceAgeGuard=Fighter.prototype.takeDamage;
      Fighter.prototype.takeDamage=function(amount,source=null,label='',statusDamage=false) {
        if (this.name==='ICE' && !(this.type&&this.type.__hrHero==='ICE') && source && source!==this && amount>0) {
          const field=activeIceAgeField();
          if ((this.data?.iceAgeWindup || (field && field.owner===this)) && !statusDamage) {
            amount*=.29;
            label=(label||'direct')+'-ice-age-guard';
          }
        }
        return oldTakeDamageIceAgeGuard.call(this,amount,source,label,statusDamage);
      };
      Fighter.prototype.__iceAgeGuardDamagePatched=true;
    }
    if (!window.__apexIceVisualUpdatePatched) {
      const oldUpdateProjectilesIceVisual=updateProjectiles;
      updateProjectiles=function(dt) {
        const iceSlowBefore=new Map();
        for (const p of projectiles||[]) {
          if (p && p.x!==undefined && p.y!==undefined && p.vx!==undefined && p.vy!==undefined) iceSlowBefore.set(p,{x:p.x,y:p.y});
        }
        updateIceAgeFields(dt);
        oldUpdateProjectilesIceVisual(dt);
        applyIceProjectileSlow(iceSlowBefore);
        updateIceDartHitAudio();
        updateIceVisuals();
        updateIceAudio();
      };
      window.updateProjectiles=updateProjectiles;
      window.__apexIceVisualUpdatePatched=true;
    }
    if (!window.__apexIceAgeCinematicPatched) {
      const oldHandleCollisionsIceAge=handleCollisions;
      handleCollisions=function(dt) {
        if (iceAgeWindup) return;
        return oldHandleCollisionsIceAge(dt);
      };
      window.handleCollisions=handleCollisions;
      const oldUpdateIceAge=update;
      update=function(dt) {
        const result=oldUpdateIceAge(dt);
        maintainIceAgeWindup();
        return result;
      };
      window.update=update;
      window.__apexIceAgeCinematicPatched=true;
    }
    if (!window.__apexIceProjectileDrawPatched) {
      const oldDrawProjectilesIceVisual=drawProjectiles;
      drawProjectiles=function(ctx) {
        for (const p of projectiles) if (p && p.type==='ice_lane' && p.owner && p.owner.name==='ICE' && !(owner.type&&owner.type.__hrHero==='ICE') && iceAssetReady('laneStartSegment')) drawIceLane(ctx,p);
        const hidden=[];
        for (const p of projectiles) {
          const laneReady=p && p.type==='ice_lane' && iceAssetReady('laneStartSegment');
          const dartReady=p && p.type==='ice_dart' && iceAssetReady('shardProjectile');
          if (p && p.owner && p.owner.name==='ICE' && !(owner.type&&owner.type.__hrHero==='ICE') && (laneReady||dartReady)) {
            hidden.push([p,p.type]); p.type='__ice_asset_draw';
          }
        }
        oldDrawProjectilesIceVisual(ctx);
        for (const [p,type] of hidden) p.type=type;
        for (const p of projectiles) if (p && p.type==='ice_dart' && p.owner && p.owner.name==='ICE' && !(owner.type&&owner.type.__hrHero==='ICE') && iceAssetReady('shardProjectile')) drawIceShardProjectile(ctx,p);
      };
      window.drawProjectiles=drawProjectiles;
      window.__apexIceProjectileDrawPatched=true;
    }
    if (!window.__apexIceAgeFloorLayerPatched) {
      const oldDrawBackgroundIceVisual=drawBackground;
      drawBackground=function(ctx) {
        oldDrawBackgroundIceVisual(ctx);
        drawFullArenaFrozenOverlay(ctx);
      };
      window.drawBackground=drawBackground;
      window.__apexIceAgeFloorLayerPatched=true;
    }
    if (!Fighter.prototype.__iceFrozenOverlayPatched) {
      const oldFighterDrawIceVisual=Fighter.prototype.draw;
      Fighter.prototype.draw=function(ctx) {
        const iceFrozen=isIceFreeze(this);
        const freezeStatus=iceFrozen?this.statuses.freeze:null;
        if (freezeStatus) { this.data.iceDrawLocked=true; delete this.statuses.freeze; }
        ctx.save();
        try {
          if (iceFrozen) ctx.globalAlpha*=.72;
          oldFighterDrawIceVisual.call(this,ctx);
        } finally {
          ctx.restore();
          if (freezeStatus) { this.statuses.freeze=freezeStatus; this.data.iceDrawLocked=false; }
        }
        drawFrozenTargetOverlay(ctx,this);
        if (this.name==='ICE') drawIceAgeTextImage(ctx,this);
      };
      Fighter.prototype.__iceFrozenOverlayPatched=true;
    }

    window.ICE_ASSET_MANIFEST=ICE_ASSET_MANIFEST;
    window.ICE_AUDIO_MANIFEST=ICE_AUDIO_MANIFEST;
    window.apexIceVisualAssets=ICE_ASSETS;
    window.apexIceAudio=ICE_AUDIO;
    window.apexIceVisualEvents=ICE_VISUAL_EVENTS;
    window.loadIceAssets=loadIceAssets;
    window.drawIceChampion=drawIceChampion;
    window.drawIceFingerGunPose=drawIceChampion;
    window.getIceFingerTipAnchor=getIceFingerTipAnchor;
    window.drawIceLane=drawIceLane;
    window.drawIceShardProjectile=drawIceShardProjectile;
    window.drawFrozenTargetOverlay=drawFrozenTargetOverlay;
    window.drawFrozenTextImage=drawFrozenTextImage;
    window.drawIceAgeTextImage=drawIceAgeTextImage;
    window.drawFullArenaFrozenOverlay=drawFullArenaFrozenOverlay;
    window.triggerIceVisualEvent=triggerIceVisualEvent;
    window.startIceAgeWindup=startIceAgeWindup;
    window.apexIceAgeDurationFor=iceAgeDurationFor;
    console.info('[Apex Chaos] ICE visual, audio, and Rage ICE AGE integrated',ICE_ASSET_MANIFEST,ICE_AUDIO_MANIFEST);
  } catch (err) {
    window.apexIceVisualError={message:err&&err.message,stack:err&&err.stack};
    console.error('[Apex Chaos] ICE visual integration failed',err);
  }
})();
