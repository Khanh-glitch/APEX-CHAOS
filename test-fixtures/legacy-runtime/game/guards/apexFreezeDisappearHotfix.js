// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function FREEZE_DISAPPEAR_HOTFIX(){
  const FT = name => FighterTypes.find(f => f.name === name);
  const live = f => f && Number.isFinite(f.hp) && f.hp > 0;
  const teamOf2 = f => f ? (f.teamId ?? f.id) : null;
  const enemyOf2 = f => fighters.find(q => live(q) && teamOf2(q) !== teamOf2(f)) || fighters.find(q => q && q !== f) || null;
  function safeClamp(f){
    if(!f) return;
    if(!Number.isFinite(f.x) || !Number.isFinite(f.y)) { f.x = GAME_SIZE/2; f.y = GAME_SIZE/2; }
    if(!f.dir || !Number.isFinite(f.dir.x) || !Number.isFinite(f.dir.y)) f.dir = norm(rand(-1,1), rand(-1,1));
    f.x = clamp(f.x, f.radius || 40, GAME_SIZE - (f.radius || 40));
    f.y = clamp(f.y, f.radius || 40, GAME_SIZE - (f.radius || 40));
  }
  function safeProjectilesCap(){
    // Keep dead objects from lingering and prevent browser freeze from pathological summoner growth.
    for(let i=projectiles.length-1;i>=0;i--){
      const p=projectiles[i];
      if(!p || p.life<=0 || p.hp<=0 && ['puppet_effigy','straw_monster','slime_child'].includes(p.type)) projectiles.splice(i,1);
    }
    // No gameplay max for Puppet effigies in normal play, but prevent pathological frame-lock after very long wall bouncing.
    for(const owner of fighters){
      if(!owner || owner.name!=='PUPPET') continue;
      const effs=projectiles.filter(p=>p.type==='puppet_effigy'&&p.owner===owner&&p.hp>0&&p.life>0).sort((a,b)=>(a.order||0)-(b.order||0));
      if(effs.length>64){ for(const p of effs.slice(0, effs.length-64)) p.life=0; }
      const monsters=projectiles.filter(p=>p.type==='straw_monster'&&p.owner===owner&&p.hp>0&&p.life>0).sort((a,b)=>(a.order||0)-(b.order||0));
      if(monsters.length>8){ for(const p of monsters.slice(0, monsters.length-8)) p.life=0; }
    }
    for(const owner of fighters){
      if(!owner || owner.name!=='SLIME') continue;
      const kids=projectiles.filter(p=>p.type==='slime_child'&&p.owner===owner&&p.hp>0&&p.life>0).sort((a,b)=>(a.spawnTime||0)-(b.spawnTime||0));
      if(kids.length>10){ for(const p of kids.slice(0,kids.length-10)) p.life=0; }
    }
    if(projectiles.length>220){
      const keepScore = p => {
        if(!p) return -999;
        if(p.type==='puppet_effigy') return 5;
        if(p.type==='straw_monster') return 4;
        if(p.type==='slime_child') return 4;
        if(p.type==='gravity_well'||p.type==='crystal_cage'||p.type==='time_mark') return 3;
        return Math.min(2, p.life || 0);
      };
      projectiles.sort((a,b)=>keepScore(b)-keepScore(a));
      projectiles.length = 220;
      if(fighters[0]) floatingTexts.push(new FloatingText(500,70,'OBJECT GUARD 220','#d0c6ad'));
    }
  }

  // FLASH: standing/prep phase is NOT immune. Immunity is only active while traversing the Rage path or normal dash.
  const flash=FT('FLASH');
  if(flash){
    flash.update=function(f,e,dt){
      if(f.isRage){
        f.data.flashRage ||= {phase:'prep',t:1,path:null,hitIds:{},cooldown:0};
        const R=f.data.flashRage;
        if(R.phase==='cool'){
          f.data.dashTimer=0;
          if(f.statuses) delete f.statuses.immune;
          R.cooldown-=dt;
          if(R.cooldown<=0){R.phase='prep';R.t=1;R.path=null;R.hitIds={};}
          return;
        }
        if(R.phase==='prep'){
          f.data.positionLocked=true;
          f.data.dashTimer=0;
          if(f.statuses) delete f.statuses.immune;
          if(!R.path) R.path=buildFlashHotfixPath(f);
          R.t-=dt;
          if(R.t<=0){
            R.phase='run';R.t=2;R.hitIds={};R.len=hotfixPathLength(R.path);
            R.damage=lerp(8,18,clamp((R.len-850)/2200,0,1));
            floatingTexts.push(new FloatingText(f.x,f.y-f.radius-82,`RAGE DASH ${R.damage.toFixed(0)}`,'#fff06b'));
            playFighterSound(f,'skill');
          }
          return;
        }
        if(R.phase==='run'){
          f.data.positionLocked=true;
          f.data.dashTimer=.12;
          f.applyStatus('immune',.08,{source:f});
          R.t-=dt;
          const p=hotfixPointAlong(R.path,clamp(1-R.t/2,0,1));
          f.x=p.x; f.y=p.y; safeClamp(f);
          if(e && live(e) && dist(f.x,f.y,e.x,e.y)<f.radius+e.radius+20 && !R.hitIds[e.id]){
            R.hitIds[e.id]=true; e.takeDamage(scaledByMirror(f,R.damage),f,'flash-rage-zigzag'); spawnShockwave(e.x,e.y,'#fff06b',120);
          }
          if(R.t<=0){R.phase='cool';R.cooldown=.75;f.data.dashTimer=0; if(f.statuses) delete f.statuses.immune;}
          return;
        }
      }
      // Normal skill only: brief dash immunity remains valid.
      if(f.data.dashTimer>0){ f.data.dashTimer-=dt; f.applyStatus('immune',.08,{source:f}); if(f.data.dashTimer<=0){f.data.dashTimer=0;if(f.statuses)delete f.statuses.immune;} return; }
      f.data.cd=(f.data.cd||2)-abilityDt(f,dt);
      if(f.data.cd<=0 && e){ f.data.cd=6.5; f.data.dashTimer=.4; f.data.dashHitIds={}; f.setDir(e.x-f.x,e.y-f.y); playFighterSound(f,'skill'); }
    };
  }
  function buildFlashHotfixPath(f){
    const pts=[{x:f.x,y:f.y}];
    let x=f.x,y=f.y; let dir=norm(rand(-1,1),rand(-1,1));
    const target={x:rand(90,910),y:rand(90,910)};
    const segs=5+Math.floor(rand(0,4));
    for(let i=0;i<segs;i++){
      const toward=norm(target.x-x,target.y-y);
      dir=norm(dir.x*.65+toward.x*.35+rand(-.28,.28), dir.y*.65+toward.y*.35+rand(-.28,.28));
      let step=rand(260,640);
      let nx=x+dir.x*step, ny=y+dir.y*step;
      if(nx<45||nx>955){nx=clamp(nx,45,955); dir.x*=-1;}
      if(ny<45||ny>955){ny=clamp(ny,45,955); dir.y*=-1;}
      x=nx;y=ny;pts.push({x,y});
    }
    pts.push(target);
    return pts;
  }
  function hotfixPathLength(path){let L=0;for(let i=1;i<path.length;i++)L+=dist(path[i-1].x,path[i-1].y,path[i].x,path[i].y);return L||1;}
  function hotfixPointAlong(path,t){const L=hotfixPathLength(path);let need=L*t;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],d=dist(a.x,a.y,b.x,b.y)||1;if(need<=d)return{x:lerp(a.x,b.x,need/d),y:lerp(a.y,b.y,need/d)};need-=d;}return path[path.length-1];}

  // PUPPET: one actual wall impact = one effigy. Debounce continuous wall-contact frames without imposing normal gameplay max.
  const puppet=FT('PUPPET');
  if(puppet){
    puppet.init=function(f){f.data.wallHitStamp={};f.data.finalCardActive=false;f.data.finalCardDone=false;};
    puppet.onWallBounce=function(f,wall){
      f.data.wallHitStamp ||= {};
      const last=f.data.wallHitStamp[wall] || -999;
      if(matchClock-last<0.22) return;
      f.data.wallHitStamp[wall]=matchClock;
      spawnPuppetEffigyStable(f,wall);
    };
    puppet.update=function(f,e,dt){
      // Keep final-card owner inside arena and prevent stuck 1 HP after card expires.
      if(f.data.finalCardActive){
        f.data.cardTimer = Math.max(0,(f.data.cardTimer||5)-dt);
        if(f.data.cardTimer<=0 && !projectiles.some(p=>p.type==='puppet_card'&&p.owner===f&&p.life>0)) f.hp=0;
      }
    };
  }
  function spawnPuppetEffigyStable(owner,wall){
    const pos={x:owner.x,y:owner.y};
    if(wall==='left')pos.x=owner.radius; if(wall==='right')pos.x=GAME_SIZE-owner.radius;
    if(wall==='top')pos.y=owner.radius; if(wall==='bottom')pos.y=GAME_SIZE-owner.radius;
    const eff={type:'puppet_effigy',owner,x:pos.x,y:pos.y,radius:75,hp:10,life:Infinity,wall,order:matchClock+Math.random()*0.0001};
    projectiles.push(eff); floatingTexts.push(new FloatingText(pos.x,pos.y-85,'EFFIGY','#d7b27a'));
    const list=projectiles.filter(p=>p.type==='puppet_effigy'&&p.owner===owner&&p.wall===wall&&p.hp>0&&p.life>0).sort((a,b)=>(a.order||0)-(b.order||0));
    while(list.length>=5){
      const group=list.splice(0,5); group.forEach(p=>p.life=0);
      projectiles.push({type:'straw_monster',owner,x:pos.x,y:pos.y,radius:55,hp:30,life:60,maxLife:60,tick:0,order:matchClock});
      floatingTexts.push(new FloatingText(pos.x,pos.y-105,'STRAW MONSTER','#d7b27a'));
    }
  }
  // Replace final card helper safely if later code calls it.
  spawnPuppetFinalCard = function(owner){
    if(!owner || projectiles.some(p=>p.type==='puppet_card'&&p.owner===owner&&p.life>0)) return;
    owner.data.finalCardActive=true; owner.data.cardTimer=5;
    projectiles.push({type:'puppet_card',owner,x:owner.x,y:owner.y,vx:rand(-650,650)||420,vy:rand(-650,650)||-420,radius:50,w:75,h:20,life:5,maxLife:5,value:1,tick:0,hitCd:0});
  };

  // SLIME: stop runaway clone/body growth, but keep children and mitosis playable.
  const slime=FT('SLIME');
  if(slime){
    const slimeDraw=slime.draw;
    slime.init=function(f){f.data.childSpawnCd=0;f.data.cloneCd=1.4;f.data.slimeDmgWindow=[];f.data.shockDmgWindow=[];f.data.gelArmorTimer=0;f.data.gelArmorReduction=0;f.data.cloneDepth=f.data.cloneDepth||0;};
    slime.update=function(f,e,dt){
      f.data.childSpawnCd=Math.max(0,(f.data.childSpawnCd||0)-dt);
      f.data.cloneCd=Math.max(0,(f.data.cloneCd||0)-dt);
      f.data.gelArmorTimer=Math.max(0,(f.data.gelArmorTimer||0)-dt);
      if(f.data.gelArmorTimer<=0){f.data.gelArmorReduction=0;f.data.gelArmorStacks=0;}
      // prune windows so counters do not grow forever
      f.data.slimeDmgWindow=(f.data.slimeDmgWindow||[]).filter(x=>matchClock-x.t<=5);
      f.data.shockDmgWindow=(f.data.shockDmgWindow||[]).filter(x=>matchClock-x.t<=1);
      if((f.data.childSpawnCd||0)<=0){
        const sum=f.data.slimeDmgWindow.reduce((s,x)=>s+x.amount,0);
        if(sum>=4){ addStableSlimeChild(f,Math.random()*TAU,8,2.4); f.data.childSpawnCd=.6; f.data.slimeDmgWindow=[]; floatingTexts.push(new FloatingText(f.x,f.y-f.radius-82,'+SLIME CHILD','#caffbb')); }
      }
      const shock=f.data.shockDmgWindow.reduce((s,x)=>s+x.amount,0);
      const teamBodies=fighters.filter(q=>q&&q.name==='SLIME'&&teamOf2(q)===teamOf2(f)&&q.hp>0).length;
      if(shock>Math.max(10,f.hp*.20) && f.data.cloneCd<=0 && (f.data.cloneDepth||0)<2 && teamBodies<4){ splitStableSlime(f); f.data.shockDmgWindow=[]; f.data.cloneCd=3.0; }
    };
    slime.draw=function(ctx,f){ slimeDraw ? slimeDraw(ctx,f) : drawSketchBlob(ctx,f.radius,'#7be66f',12); const bodies=fighters.filter(q=>q&&q.name==='SLIME'&&teamOf2(q)===teamOf2(f)&&q.hp>0).length; if(bodies>1){ctx.fillStyle='#d6ffc8';ctx.font='900 13px monospace';ctx.textAlign='center';ctx.fillText('BODY '+bodies,0,f.radius+25);} };
  }
  function addStableSlimeChild(owner,angle,hp=8,damage=2.4){
    const kids=projectiles.filter(p=>p.type==='slime_child'&&p.owner===owner&&p.hp>0&&p.life>0);
    if(kids.length>=10) return;
    projectiles.push({type:'slime_child',owner,angle,radius:24,hp,life:5,maxLife:5,hitCd:{},blockCd:0,damageDone:0,damage,spawnTime:matchClock});
  }
  function splitStableSlime(f){
    const ft=FT('SLIME'); if(!ft) return;
    const hp=Math.max(8,f.hp);
    const bodies=fighters.filter(q=>q&&q.name==='SLIME'&&teamOf2(q)===teamOf2(f)&&q.hp>0);
    if(bodies.length>=4) return;
    const c=new Fighter(f.id,clamp(f.x+rand(-85,85),80,920),clamp(f.y+rand(-85,85),80,920),ft);
    c.teamId=teamOf2(f); c.hp=hp; c.maxHp=f.maxHp; c.data.cloneDepth=(f.data.cloneDepth||0)+1; c.dir=norm(rand(-1,1),rand(-1,1)); fighters.push(c);
    const kids=projectiles.filter(p=>p.type==='slime_child'&&p.owner===f&&p.hp>0&&p.life>0);
    kids.forEach(k=>addStableSlimeChild(c,Math.random()*TAU,Math.max(1,k.hp*.5),Math.max(.5,(k.damage||4)*.5)));
    floatingTexts.push(new FloatingText(f.x,f.y-f.radius-110,'MITOSIS','#caffbb')); spawnShockwave(f.x,f.y,'#7be66f',220);
  }

  // Wrap damage only for the missing Slime counters and Puppet final card, without changing other tĂ†Â°Ă¡Â»â€ºng.
  const oldTD = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage=function(amount,source=null,label='',statusDamage=false){
    if(!Number.isFinite(amount) || amount<=0) return;
    // HERO REWORK separation (docs/hero-rework/phase1/12): legacy SLIME
    // damage-window bookkeeping feeds the legacy spawn/clone kit — it must
    // never run on rework-shell bodies (type.arsenalShell, no-double-
    // execution law). Legacy FT('SLIME') encounters keep it.
    if(this.name==='SLIME' && !(this.type && this.type.arsenalShell) && source && source!==this && !statusDamage){
      this.data ||= {}; this.data.slimeDmgWindow ||= []; this.data.shockDmgWindow ||= [];
      this.data.slimeDmgWindow.push({t:matchClock,amount}); this.data.shockDmgWindow.push({t:matchClock,amount});
    }
    if(this.name==='PUPPET' && this.hp-amount<=0 && !this.data.finalCardActive && !statusDamage){
      this.hp=1; this.data.finalCardActive=true; this.data.cardTimer=5; spawnPuppetFinalCard(this); floatingTexts.push(new FloatingText(this.x,this.y-this.radius-90,'FINAL CARD','#f1d8a8')); return;
    }
    return oldTD.call(this,amount,source,label,statusDamage);
  };

  // Stabilize projectile updates and keep all objects on map / finite.
  const oldUP2=updateProjectiles;
  updateProjectiles=function(dt){
    safeProjectilesCap();
    // Manual pre-step for risky projectile types so they cannot stall the old updater.
    for(const p of projectiles){
      const owner=p.owner, enemy=owner?enemyOf2(owner):null;
      if(p.type==='puppet_card'){
        p.tick=(p.tick||0)+dt; p.hitCd=Math.max(0,(p.hitCd||0)-dt); if(p.tick>=1){p.tick=0;p.value=Math.ceil(rand(1,10));}
        p.x+=p.vx*dt; p.y+=p.vy*dt; if(p.x<25||p.x>975){p.vx*=-1;p.x=clamp(p.x,25,975);} if(p.y<25||p.y>975){p.vy*=-1;p.y=clamp(p.y,25,975);}
        if(enemy&&live(enemy)&&dist(p.x,p.y,enemy.x,enemy.y)<p.radius+enemy.radius&&p.hitCd<=0){p.hitCd=.35;enemy.takeDamage(p.value,owner,'puppet-final-card');}
        if(p.life<=dt && owner && live(owner) && enemy && live(enemy)) owner.hp=0;
      }
      if(p.type==='straw_monster' && owner && enemy && live(enemy)){
        p.tick=(p.tick||0)+dt; const n=norm(enemy.x-p.x,enemy.y-p.y); p.x=clamp(p.x+n.x*210*dt,55,945); p.y=clamp(p.y+n.y*210*dt,55,945);
        while(p.tick>=1){p.tick-=1;if(dist(p.x,p.y,enemy.x,enemy.y)<p.radius+enemy.radius+40)enemy.takeDamage(2,owner,'straw-monster');}
      }
    }
    oldUP2(dt);
    safeProjectilesCap();
  };

  const oldUpdate2=update;
  update=function(dt){
    oldUpdate2(dt);
    // Remove excessive dead Slime bodies and hard-clamp every fighter; prevents disappearing / NaN lock.
    for(const f of fighters) safeClamp(f);
    for(let i=fighters.length-1;i>=0;i--){
      const f=fighters[i];
      if(!f) fighters.splice(i,1);
      else if(i>1 && f.hp<=0) fighters.splice(i,1);
    }
    safeProjectilesCap();
  };
})();
