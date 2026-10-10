/* Quest 01 — owner-authored enemy abilities, mounted into native Fighter combat.
 * One state instance per Arsenal battle, no global timers or fake HP changes.
 * LV2: each distinct new physical contact = one real Fighter.takeDamage(50).
 * LV3: 1s visible stationary charge, 6000-world-unit/s physical swept blue
 * projectile, 100 real Fighter damage and 2s stun ON accepted hit only.
 */
(function installQuestEnemyAbilities(root){
  'use strict';
  if(root.APEX_QUEST_ENEMY_ABILITIES)return;
  function create({core,log}={}){
    if(!core?.firstProjectileHit||!core?.enemySpecies)
      throw new Error('Quest enemy ability requires genuine collision core');
    const casters=new Map(),rays=[],impacts=[];
    let visualClock=0;
    let shots=0,hits=0,bumps=0,closed=false;
    const lifetime=0.23;
    const spec=core.enemySpecies('sentinel')?.laser;
    const isActive=(f,actors)=>!!(f&&f.hp>0&&actors.includes(f));
    const stopped=(f)=>!f||f.hp<=0||f.hasStatus?.('stun')||f.hasStatus?.('freeze')||
      f.hasStatus?.('abilityDisabled');
    function onContactEnter(a,b){
      if(closed||!a||!b||a.questTeam===b.questTeam)return 0;
      let applied=0;
      for(const [from,to] of [[a,b],[b,a]]){
        if(from.questSpecies!=='reaver'||from.hp<=0||to.hp<=0)continue;
        if(!core.enemySpecies('reaver')||typeof to.takeDamage!=='function')continue;
        const before=to.hp;
        to.takeDamage(core.enemySpecies('reaver').contactDamage,from,'quest-reaver-contact');
        if(to.hp<before){applied++;bumps++;impacts.push({x:to.x,y:to.y,dx:to.x-from.x,dy:to.y-from.y,age:0,kind:'claw'});if(impacts.length>18)impacts.shift();}
      }
      return applied;
    }
    function release(f,c){
      if(f?.data?.questSentinelLock===true){
        f.data.positionLocked=false;
        delete f.data.questSentinelLock;
      }
      if(c)c.charge=0;
    }
    function tick(dt,actors){
      if(closed||!(dt>0)||!Array.isArray(actors))return;
      visualClock+=dt;for(let i=impacts.length-1;i>=0;i--){impacts[i].age+=dt;if(impacts[i].age>.36)impacts.splice(i,1);}
      for(let i=rays.length-1;i>=0;i--){
        const ray=rays[i];
        if(ray.done){
          ray.fade-=dt;
          if(ray.fade<=0)rays.splice(i,1);
          continue;
        }
        if(!isActive(ray.owner,actors)){rays.splice(i,1);continue;}
        const start={x:ray.x,y:ray.y};
        const travel=Math.min(ray.remaining,6000*dt);
        const end={x:ray.x+ray.dx*travel,y:ray.y+ray.dy*travel};
        const contact=core.firstProjectileHit({
          owner:ray.owner,actors,from:start,to:end,projectileRadius:7,
          bodyRadiusScale:0.78
        });
        if(contact){
          ray.x=contact.x;ray.y=contact.y;
          const target=contact.actor,before=target.hp;
          target.takeDamage?.(spec.damage,ray.owner,'quest-sentinel-blue-laser');
          if(target.hp<before){
            // Only a genuine accepted physical hit stuns; immune targets do
            // not receive an invented status-only success.
            target.applyStatus?.('stun',spec.stunSeconds,{source:ray.owner});
            hits++;impacts.push({x:target.x,y:target.y,dx:ray.dx,dy:ray.dy,age:0,kind:'arc'});if(impacts.length>18)impacts.shift();
            log?.('QUEST_SENTINEL_LASER_HIT',ray.owner.questId+' -> '+target.questId);
          }
          ray.done=true;ray.fade=lifetime;continue;
        }
        ray.x=end.x;ray.y=end.y;ray.remaining-=travel;
        // The ray is a physical projectile, not an arena-wide hitscan.
        if(ray.remaining<=0||ray.x<0||ray.x>1000||ray.y<0||ray.y>1000){
          ray.done=true;ray.fade=lifetime;
        }
      }
      for(const f of actors){
        if(f?.questSpecies!=='sentinel')continue;
        let c=casters.get(f.questId);
        if(!c){c={owner:f,charge:0,cooldown:0,lockedTarget:null};casters.set(f.questId,c);}
        c.owner=f;
        if(f.hp<=0){release(f,c);continue;}
        if(stopped(f)){release(f,c);continue;}
        if(c.charge>0){
          c.charge-=dt;
          if(c.charge>0)continue;
          const target=core.nearestEnemy(f,actors);
          release(f,c);
          c.cooldown=spec.cooldownSeconds;
          if(!target)continue;
          const optic=root.APEX_QUEST_V12_RIG?.opticWorld?.(f)||{x:f.x,y:f.y};
          const dist=Math.hypot(target.x-optic.x,target.y-optic.y);
          const dx=dist>1e-6?(target.x-optic.x)/dist:1;
          const dy=dist>1e-6?(target.y-optic.y)/dist:0;
          rays.push({owner:f,originX:optic.x,originY:optic.y,x:optic.x,y:optic.y,
            dx,dy,remaining:1400,done:false,fade:0});
          shots++;
          log?.('QUEST_SENTINEL_LASER_FIRE',f.questId);
          continue;
        }
        c.cooldown=Math.max(0,c.cooldown-dt);
        if(c.cooldown>0)continue;
        const target=core.nearestEnemy(f,actors);
        if(!target||Math.hypot(target.x-f.x,target.y-f.y)>950)continue;
        c.charge=spec.chargeSeconds;
        c.lockedTarget=target.questId;
        if(f.data){f.data.positionLocked=true;f.data.questSentinelLock=true;}
        log?.('QUEST_SENTINEL_CHARGE',f.questId);
      }
      // When the entire wave changes, stale status cannot survive by ID.
      for(const [id,c] of casters)
        if(!actors.includes(c.owner)){release(c.owner,c);casters.delete(id);}
    }
    // Transcribed from the owner's uploaded FANTASY_WEAPON_LAB_V4_1_FIXED:
    // cyan 3-ring charge, 14 deterministic convergence motes and bright core.
    // Source ART ASSETS are deliberately ignored. Native Sentinel's animated
    // optic socket is the sole placement authority.
    function drawGoldLabLaserCharge(ctx,x,y,t,clock){
      const TAU=Math.PI*2,k=.68;
      const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
      const lerp=(a,b,u)=>a+(b-a)*u;
      const easeOut=u=>1-Math.pow(1-u,3);
      const compress=clamp((t-.76)/.24,0,1),shell=1-easeOut(compress);
      ctx.save();ctx.translate(x,y);ctx.scale(k,k);
      ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
      const outerR=lerp(28,44,t)*(.94+.06*Math.sin(clock*11));
      const rg=ctx.createRadialGradient(0,0,0,0,0,outerR*1.35);
      rg.addColorStop(0,'rgba(255,255,255,'+(.34+.42*t)+')');
      rg.addColorStop(.13,'rgba(164,246,255,'+(.28+.34*t)+')');
      rg.addColorStop(.34,'rgba(48,208,255,'+(.18+.25*t)+')');
      rg.addColorStop(.70,'rgba(0,109,255,'+(.08+.14*t)+')');
      rg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=rg;ctx.beginPath();ctx.arc(0,0,outerR*1.35,0,TAU);ctx.fill();
      const base=lerp(31,46,t)*lerp(1,.58,compress);
      for(let i=0;i<3;i++){
        const r=base-i*5.5,rot=clock*(2.2+i*.72)+(i*2.1);
        const sweep=Math.PI*lerp(.72,1.18,t);
        ctx.strokeStyle=i===0
          ?'rgba(126,235,255,'+((.38+.18*t)*shell)+')'
          :'rgba(34,167,255,'+((.24+.11*t)*shell)+')';
        ctx.lineWidth=i===0?1.45:1;
        ctx.beginPath();ctx.ellipse(0,0,r,r*.52,rot,rot,rot+sweep);ctx.stroke();
        ctx.beginPath();ctx.ellipse(0,0,r*.82,r*.42,-rot*.7,rot+Math.PI,rot+Math.PI+sweep*.82);ctx.stroke();
      }
      for(let i=0;i<14;i++){
        const seed=i*2.3999632297,u=(t*1.45+i/14)%1,eased=u*u;
        const start=52+(i%4)*6,r=lerp(start,5,eased);
        const a=seed-clock*(.55+(i%3)*.13);
        const sx=Math.cos(a)*r,sy=Math.sin(a)*r*.58;
        const before=Math.min(start,r+10+eased*8);
        const alpha=(.16+.54*eased)*t;
        ctx.strokeStyle='rgba(120,235,255,'+alpha+')';ctx.lineWidth=.7+eased*.75;
        ctx.beginPath();ctx.moveTo(Math.cos(a+.05)*before,Math.sin(a+.05)*before*.58);
        ctx.lineTo(sx,sy);ctx.stroke();
        ctx.fillStyle='rgba(235,254,255,'+(alpha*.86)+')';
        ctx.beginPath();ctx.arc(sx,sy,.8+eased*1.25,0,TAU);ctx.fill();
      }
      const r=lerp(5.5,12.5,t)*lerp(1,.72,compress);
      const cg=ctx.createRadialGradient(0,0,0,0,0,r*2.4);
      cg.addColorStop(0,'rgba(255,255,255,'+(.88+.10*t)+')');
      cg.addColorStop(.28,'rgba(170,249,255,'+(.72+.20*t)+')');
      cg.addColorStop(.62,'rgba(41,198,255,'+(.26+.26*t)+')');
      cg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=cg;ctx.beginPath();ctx.arc(0,0,r*2.4,0,TAU);ctx.fill();
      if(compress>0){
        ctx.strokeStyle='rgba(255,255,255,'+(compress*.74)+')';ctx.lineWidth=1.3;
        ctx.beginPath();ctx.arc(0,0,lerp(26,10,compress),0,TAU);ctx.stroke();
      }
      ctx.restore();
    }
    // Render-only: charge is driven by the actual one-second timer, laser
    // by its actual swept projectile, sparks by accepted Fighter HP changes.
    // No particles/hit geometry have their own damage or timer authority.
    function draw(ctx,actors){
      if(closed||!ctx||!Array.isArray(actors))return;
      ctx.save();
      for(const c of casters.values()){
        const f=c.owner;
        if(!isActive(f,actors)||!(c.charge>0))continue;
        const target=actors.find(x=>x.questId===c.lockedTarget&&x.hp>0)
          ||core.nearestEnemy(f,actors);
        const t=Math.max(0,Math.min(1,1-c.charge/spec.chargeSeconds));
        const optic=root.APEX_QUEST_V12_RIG?.opticWorld?.(f)||{x:f.x,y:f.y};
        drawGoldLabLaserCharge(ctx,optic.x,optic.y,t,visualClock);
        const dir=target?Math.atan2(target.y-optic.y,target.x-optic.x):0;
        // Native lock-on telegraph stays readable but starts at the optic.
        ctx.save();ctx.translate(optic.x,optic.y);
        ctx.rotate(dir);
        const pulse=.5+.5*Math.sin(visualClock*28),r=20;
        // Three inward-locking, segmented cyan capacitors.
        for(let i=0;i<3;i++){
          const rr=r+(1-t)*26+i*9;
          ctx.strokeStyle=i===0?'rgba(220,250,255,.9)':'rgba(42,174,249,.62)';
          ctx.lineWidth=2.3+i*.4;ctx.beginPath();
          ctx.arc(0,0,rr,-.72+i*.17,.72-i*.17);ctx.stroke();
          ctx.beginPath();ctx.arc(0,0,rr,Math.PI-.72+i*.17,Math.PI+.72-i*.17);ctx.stroke();
        }
        ctx.globalAlpha=.3+.45*t;ctx.fillStyle='#70daff';
        for(let i=0;i<6;i++){
          const a=i*Math.PI/3+visualClock*.9,rr=r+23-t*18;
          ctx.beginPath();ctx.arc(Math.cos(a)*rr,Math.sin(a)*rr,1.6+1.3*t,0,Math.PI*2);ctx.fill();
        }
        if(target){
          const d=Math.hypot(target.x-optic.x,target.y-optic.y);
          ctx.strokeStyle='rgba(87,189,247,'+(.23+.36*t)+')';
          ctx.lineWidth=1.6+1.1*t;
          ctx.setLineDash([16,8]);ctx.lineDashOffset=-visualClock*30;
          ctx.beginPath();ctx.moveTo(r,0);ctx.lineTo(Math.min(d,1000),0);ctx.stroke();ctx.setLineDash([]);
          // Crosshair is locked to visual charge, not a second hit target.
          ctx.translate(d,0);ctx.globalAlpha=.35+.5*t;
          ctx.beginPath();ctx.arc(0,0,17-5*t,-Math.PI/3,Math.PI*1.35);ctx.stroke();
          ctx.beginPath();ctx.moveTo(-23,0);ctx.lineTo(-12,0);ctx.moveTo(12,0);ctx.lineTo(23,0);ctx.stroke();
        }
        ctx.restore();
        void pulse;
      }
      for(const ray of rays){
        const a=ray.done?Math.max(0,ray.fade/lifetime):1;
        if(a<=0)continue;
        // Dynamic source: never leave a detached beam behind a moving
        // Sentinel body. Destination remains the REAL swept projectile tip.
        const optic=root.APEX_QUEST_V12_RIG?.opticWorld?.(ray.owner);
        const x0=optic?.x??ray.originX,y0=optic?.y??ray.originY;
        const dx=ray.x-x0,dy=ray.y-y0;
        const length=Math.hypot(dx,dy);
        if(length<1)continue;
        const ux=dx/length,uy=dy/length;
        ctx.save();ctx.globalCompositeOperation='lighter';
        ctx.globalAlpha=a;ctx.lineCap='round';
        // Owner Lab V1: four additive beam passes 24/12/5/1.7px.
        for(const [width,color,alpha] of [
          [24,'0,91,255',.16],[12,'0,196,255',.34],
          [5,'83,235,255',.86],[1.7,'255,255,255',.98]]){
          ctx.strokeStyle='rgba('+color+','+(alpha*a)+')';
          ctx.lineWidth=width;ctx.beginPath();
          ctx.moveTo(x0,y0);ctx.lineTo(ray.x,ray.y);ctx.stroke();
        }
        // Finite traveling shards: follow actual beam segment only.
        for(let k=0;k<12;k++){
          const d=(k/12*length+visualClock*380) % Math.max(1,length);
          const wiggle=Math.sin(k*5.3+visualClock*31)*5;
          const x=x0+ux*d-uy*wiggle,y=y0+uy*d+ux*wiggle;
          ctx.beginPath();ctx.strokeStyle=k%2?'#b5f8ff':'#438bea';
          ctx.lineWidth=1.6;ctx.moveTo(x-ux*9,y-uy*9);ctx.lineTo(x+ux*5,y+uy*5);ctx.stroke();
        }
        ctx.restore();
      }
      for(const e of impacts){
        const t=e.age/.36,alpha=Math.max(0,1-t),r=e.kind==='claw'?25+t*35:18+t*46;
        ctx.save();ctx.translate(e.x,e.y);
        ctx.rotate(Math.atan2(e.dy,e.dx));
        ctx.globalAlpha=alpha;ctx.lineCap='round';
        if(e.kind==='claw'){
          for(let k=-1;k<=1;k++){
            ctx.strokeStyle=k===0?'#fff1d7':'#e7a25a';ctx.lineWidth=6*(1-t)+1;
            ctx.beginPath();ctx.moveTo(-r*.65,k*10-r*.2);
            ctx.quadraticCurveTo(0,k*6-r*.4,r*.85,k*13+r*.12);ctx.stroke();
          }
        }else{
          ctx.strokeStyle='#9ee8ff';ctx.lineWidth=5*(1-t)+1;
          ctx.beginPath();ctx.arc(0,0,r,-Math.PI*.72,Math.PI*.72);ctx.stroke();
          ctx.strokeStyle='#e1feff';ctx.lineWidth=2;
          for(let k=0;k<7;k++){const a=k*Math.PI*2/7;
            ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.45,Math.sin(a)*r*.45);
            ctx.lineTo(Math.cos(a)*r*1.35,Math.sin(a)*r*1.35);ctx.stroke();}
        }
        ctx.restore();
      }
      ctx.restore();
    }
    function close(){
      if(closed)return;
      for(const c of casters.values())release(c.owner,c);
      casters.clear();rays.length=0;impacts.length=0;closed=true;
    }
    return Object.freeze({
      tick,onContactEnter,draw,close,
      snapshot:()=>({shots,hits,bumps,charging:[...casters.values()]
        .filter(c=>c.charge>0).map(c=>c.owner.questId),rays:rays.length})
    });
  }
  root.APEX_QUEST_ENEMY_ABILITIES=Object.freeze({create});
  root.apexQuestEnemyAbilities='ready';
})(typeof window!=='undefined'?window:globalThis);
