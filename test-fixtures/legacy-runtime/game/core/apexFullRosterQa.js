// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function fullRosterQAPatch(){
    const FT = name => FighterTypes.find(f => f.name === name);
    const live = f => f && f.hp > 0;
    const teamOf = f => f ? (f.teamId ?? f.id) : null;
    const enemyOf = f => fighters.find(q => live(q) && teamOf(q) !== teamOf(f)) || fighters.find(q => q && q !== f) || null;
    const clampFighter = f => {
        if (!f) return;
        f.x = clamp(f.x, f.radius, GAME_SIZE - f.radius);
        f.y = clamp(f.y, f.radius, GAME_SIZE - f.radius);
        if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) { f.x = GAME_SIZE/2; f.y = GAME_SIZE/2; f.setDir(rand(-1,1), rand(-1,1)); }
    };

    // Return Magnet to the older stable field behavior: shell position clamp while shield remains real.
    const magnet = FT('MAGNET');
    if (magnet) {
        magnet.update = function(f,e,dt){
            f.data.cd -= abilityDt(f,dt);
            if (f.data.cd <= 0) {
                f.data.cd = 6.6;
                f.data.fieldTimer = 3.1;
                projectiles.push({type:'magnet_field',owner:f,radius:310,life:3.1,maxLife:3.1,hitCd:{},inside:{},slamCd:0});
                playFighterSound(f,'skill');
            }
            if (f.data.fieldTimer > 0) {
                f.data.fieldTimer -= dt;
                const shell = 310;
                if (f.x < shell) { f.x = shell; f.setDir(1, f.dir.y); }
                if (f.x > GAME_SIZE - shell) { f.x = GAME_SIZE - shell; f.setDir(-1, f.dir.y); }
                if (f.y < shell) { f.y = shell; f.setDir(f.dir.x, 1); }
                if (f.y > GAME_SIZE - shell) { f.y = GAME_SIZE - shell; f.setDir(f.dir.x, -1); }
            }
        };
    }

    // Sniper: rebuild from old 4-nest behavior, then add only requested deltas.
    const sniper = FT('SNIPER');
    if (sniper) {
        sniper.init = f => { f.data.cd=2.0; f.data.aim=0; f.data.aimMax=0; f.data.reload=0; f.data.rageCd=0; f.data.hiddenReload=false; f.data.nests=[{x:95,y:95},{x:905,y:95},{x:95,y:905},{x:905,y:905}]; };
        sniper.update = function(f,e,dt){
            if (!e) return;
            if (f.isRage) {
                f.data.positionLocked = true;
                if ((f.data.reload || 0) > 0) {
                    f.data.reload -= dt;
                    f.data.hiddenReload = true;
                    f.applyStatus('immune', .10, {source:f});
                    if (f.data.reload <= 0) {
                        const best = f.data.nests.reduce((a,b)=>dist(b.x,b.y,e.x,e.y)>dist(a.x,a.y,e.x,e.y)?b:a,f.data.nests[0]);
                        f.x = best.x; f.y = best.y;
                        f.data.aim = 3; f.data.aimMax = 3; f.data.hiddenReload = false;
                        floatingTexts.push(new FloatingText(f.x, f.y-f.radius-70, 'AIMING', '#ff8b8b'));
                    }
                    return;
                }
                if (f.data.aim > 0) {
                    f.data.hiddenReload = false;
                    f.data.aim -= dt;
                    f.setDir(e.x-f.x, e.y-f.y);
                    if (dist(f.x,f.y,e.x,e.y) < 300 && (f.data.aimMax - f.data.aim) > .45) {
                        f.data.aim = 0;
                        f.data.reload = 3;
                        floatingTexts.push(new FloatingText(f.x, f.y-f.radius-70, 'RELOAD RELOCATE', '#ff8b8b'));
                        return;
                    }
                    if (f.data.aim <= 0) {
                        const ratio = clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE), 0, 1);
                        const dmg = 30 * ratio;
                        projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45});
                        e.takeDamage(scaledByMirror(f,dmg), f, 'sniper-shot');
                        f.data.reload = 3;
                        playFighterSound(f,'skill');
                    }
                    return;
                }
                f.data.reload = 3;
                return;
            }
            f.data.hiddenReload = false;
            if (f.data.aim > 0) {
                f.data.positionLocked = true;
                f.data.aim -= dt;
                f.setDir(e.x-f.x, e.y-f.y);
                if (f.data.aim <= 0) {
                    const dir = norm(e.x-f.x, e.y-f.y);
                    const ratio = clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE), 0, 1);
                    const dmg = 30 * ratio;
                    projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45});
                    e.takeDamage(scaledByMirror(f,dmg), f, 'sniper-shot');
                    f.x = clamp(f.x - dir.x*150, f.radius, GAME_SIZE-f.radius);
                    f.y = clamp(f.y - dir.y*150, f.radius, GAME_SIZE-f.radius);
                    f.data.cd = 8;
                    playFighterSound(f,'skill');
                }
                return;
            }
            f.data.cd -= abilityDt(f,dt);
            if (f.data.cd <= 0) {
                const ratio = clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1);
                f.data.aim = Math.max(1.2, 0.55 + 1.35*ratio);
                f.data.aimMax = f.data.aim;
                floatingTexts.push(new FloatingText(f.x, f.y-f.radius-70, 'LOCK ON', '#ff8b8b'));
            }
        };
    }

    // Team-aware collisions for Slime clones and future multi-body fighters. Same-team bodies do not damage each other.
    handleCollisions = function(dt){
        for (let i=0;i<fighters.length;i++) for (let j=i+1;j<fighters.length;j++) {
            const a=fighters[i], b=fighters[j];
            if (!live(a) || !live(b)) continue;
            const sameTeam = teamOf(a) === teamOf(b);
            const dx=b.x-a.x, dy=b.y-a.y; const d=Math.hypot(dx,dy)||1;
            const magnetShell = !sameTeam && ((a.name==='MAGNET' && a.data.fieldTimer>0) ? {mag:a, other:b} : (b.name==='MAGNET' && b.data.fieldTimer>0) ? {mag:b, other:a} : null);
            if (magnetShell) {
                const md = dist(magnetShell.mag.x, magnetShell.mag.y, magnetShell.other.x, magnetShell.other.y);
                const shellD = 310 + magnetShell.other.radius;
                if (md < shellD) {
                    const n = norm(magnetShell.other.x-magnetShell.mag.x, magnetShell.other.y-magnetShell.mag.y);
                    magnetShell.other.x = clamp(magnetShell.mag.x + n.x * shellD, magnetShell.other.radius, GAME_SIZE-magnetShell.other.radius);
                    magnetShell.other.y = clamp(magnetShell.mag.y + n.y * shellD, magnetShell.other.radius, GAME_SIZE-magnetShell.other.radius);
                    magnetShell.other.dir = reflectDir(magnetShell.other.dir, n.x, n.y);
                    magnetShell.other.applyStatus('push', .16, {x:n.x,y:n.y,strength:520});
                    continue;
                }
            }
            const minD=a.radius+b.radius;
            if (d < minD) {
                const nx=dx/d, ny=dy/d, overlap=minD-d;
                a.x-=nx*overlap*.5; a.y-=ny*overlap*.5; b.x+=nx*overlap*.5; b.y+=ny*overlap*.5;
                clampFighter(a); clampFighter(b);
                if (sameTeam) continue;
                const aPierce=a.name==='FLASH'&&a.data.dashTimer>0;
                const bPierce=b.name==='FLASH'&&b.data.dashTimer>0;
                if (!aPierce && !bPierce) { a.dir=reflectDir(a.dir,-nx,-ny); b.dir=reflectDir(b.dir,nx,ny); }
                if(!a.hasStatus('abilityDisabled')&&a.type.onCollide)a.type.onCollide(a,b,dt,{x:nx,y:ny});
                if(!b.hasStatus('abilityDisabled')&&b.type.onCollide)b.type.onCollide(b,a,dt,{x:-nx,y:-ny});
                mirrorStolenCollide(a,b,dt,{x:nx,y:ny}); mirrorStolenCollide(b,a,dt,{x:-nx,y:-ny});
            }
        }
    };

    update = function(dt){
        if (hitStop > 0) { hitStop -= dt; dt *= 0.1; }
        if (gameState !== 'PLAYING') return;
        matchClock += dt;
        if (sawWallRage.timer > 0) sawWallRage.timer = Math.max(0, sawWallRage.timer - dt);
        if (fighters[0]) fighters[0].teamId ??= fighters[0].id;
        if (fighters[1]) fighters[1].teamId ??= fighters[1].id;
        for (const f of fighters.slice()) if (live(f)) f.update(dt, enemyOf(f));
        handleCollisions(dt);
        updateProjectiles(dt);
        for (const f of fighters) clampFighter(f);
        for (let i=particles.length-1;i>=0;i--) { particles[i].update(dt); if(particles[i].life<=0)particles.splice(i,1); }
        for (let i=floatingTexts.length-1;i>=0;i--) { floatingTexts[i].update(dt); if(floatingTexts[i].life<=0)floatingTexts.splice(i,1); }
        for (let i=shockwaves.length-1;i>=0;i--) { const s=shockwaves[i]; s.r+=420*dt; s.alpha=Math.max(0,1-s.r/s.maxR); if(s.alpha<=0)shockwaves.splice(i,1); }
        if (arenaFlash.a > 0) arenaFlash.a=Math.max(0,arenaFlash.a-dt*1.6); if(cameraShake>0)cameraShake=Math.max(0,cameraShake-dt*22); cameraZoom=lerp(cameraZoom,1,dt*2);
        const t1=fighters[0]?teamOf(fighters[0]):1, t2=fighters[1]?teamOf(fighters[1]):2;
        const alive1=fighters.some(f=>live(f)&&teamOf(f)===t1), alive2=fighters.some(f=>live(f)&&teamOf(f)===t2);
        if (!alive1 || !alive2) endMatch();
    };

    const oldDraw = draw;
    draw = function(){
        window.__apexRenderFrame = (window.__apexRenderFrame || 0) + 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = 'none';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        try {
            const shakeX=rand(-cameraShake,cameraShake), shakeY=rand(-cameraShake,cameraShake);
            ctx.translate(GAME_SIZE/2+shakeX,GAME_SIZE/2+shakeY); ctx.scale(cameraZoom,cameraZoom); ctx.translate(-GAME_SIZE/2,-GAME_SIZE/2);
            drawBackground(ctx); drawProjectiles(ctx);
            for (const f of fighters) if (f && f.hasStatus && f.hasStatus('scent')) { const lost=(f.maxHp-f.hp)/f.maxHp; const rr=Math.max(120,1000*lost); ctx.save(); ctx.globalAlpha=.18; ctx.fillStyle='#ff2020'; ctx.strokeStyle='#ff4d4d'; ctx.lineWidth=5; ctx.setLineDash([20,14]); ctx.beginPath(); ctx.arc(f.x,f.y,rr,0,TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle='#ffd0d0'; ctx.font='900 18px monospace'; ctx.textAlign='center'; ctx.fillText('BLOOD SCENT',f.x,f.y-rr-12); ctx.restore(); }
            // Effective production renderer: the Full Roster QA draw replaces
            // the original engine draw. Keep arena deformation at its narrow
            // world seam without moving this renderer's established top-layer
            // particle/shockwave phases.
            if (window.APEX_HERO_REWORK?.renderArenaWorldEffects) {
                window.APEX_HERO_REWORK.renderArenaWorldEffects(ctx, {
                    stage: 'after-world-before-fighters',
                    background: true, projectiles: true, scent: true,
                    particles: false, fighters: false,
                });
            }
            for (const f of fighters) if (live(f)) f.draw(ctx);
            for (const f of fighters) if (f && f.name==='SNIPER' && f.data && f.data.aim>0) { const enemy=enemyOf(f); if(enemy){ctx.save(); ctx.globalAlpha=.9; ctx.strokeStyle='rgba(255,45,45,.95)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(f.x,f.y); ctx.lineTo(enemy.x,enemy.y); ctx.stroke(); ctx.restore();}}
            for(const p of particles){ if(p && typeof p.draw === 'function') p.draw(ctx); }
            for(const sw of shockwaves){
                if(!sw) continue;
                if(typeof sw.draw === 'function') sw.draw(ctx);
                else {
                    ctx.save();
                    ctx.globalAlpha = Number.isFinite(sw.alpha) ? sw.alpha : 0.7;
                    ctx.strokeStyle = sw.color || '#ffffff';
                    ctx.lineWidth = 7;
                    ctx.beginPath();
                    ctx.arc(sw.x || 0, sw.y || 0, Math.max(1, sw.r || 10), 0, TAU);
                    ctx.stroke();
                    ctx.restore();
                }
            }
            for(const t of floatingTexts){ if(t && typeof t.draw === 'function') t.draw(ctx); }
            if (typeof window.__apexTopLayerDraw === 'function') window.__apexTopLayerDraw(ctx);
            if(calcOverlay)drawCalcOverlay(ctx); if(arenaFlash.a>0){ctx.fillStyle=`rgba(${arenaFlash.r},${arenaFlash.g},${arenaFlash.b},${arenaFlash.a})`;ctx.fillRect(0,0,GAME_SIZE,GAME_SIZE);}
        } finally {
            ctx.restore();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            ctx.filter = 'none';
        }
        updateHUD();
    };

    updateHUD = function(){
        if (!fighters[0] || !fighters[1]) return;
        const bases=[fighters[0],fighters[1]];
        for(let i=0;i<2;i++){
            const base=bases[i], tid=teamOf(base);
            const members=fighters.filter(f=>f && teamOf(f)===tid && f.hp>0);
            const hp=members.reduce((s,f)=>s+f.hp,0), max=members.reduce((s,f)=>s+f.maxHp,0)||base.maxHp;
            const pct=clamp(hp/max*100,0,100);
            document.getElementById(`p${i+1}-hp`).style.width = `${pct}%`;
            document.getElementById(`p${i+1}-hp-text`).innerText = `${hp.toFixed(1)} / ${max.toFixed(0)}${members.length>1?' | bodies '+members.length:''}`;
            const rageEl=document.getElementById(`p${i+1}-rage`); rageEl.style.opacity = base.isRage ? 1 : 0; rageEl.style.display = base.isRage ? 'block' : 'none';
        }
    };
})();
