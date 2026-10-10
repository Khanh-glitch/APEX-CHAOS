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
          const dist=Math.hypot(target.x-f.x,target.y-f.y);
          const dx=dist>1e-6?(target.x-f.x)/dist:1;
          const dy=dist>1e-6?(target.y-f.y)/dist:0;
          rays.push({owner:f,originX:f.x,originY:f.y,x:f.x,y:f.y,
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
        const pulse=.5+.5*Math.sin(visualClock*28),r=(f.radius||70)+13;
        ctx.save();ctx.translate(f.x,f.y);
        const dir=target?Math.atan2(target.y-f.y,target.x-f.x):0;
        ctx.rotate(dir);
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
          const d=Math.hypot(target.x-f.x,target.y-f.y);
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
        const x0=ray.originX,y0=ray.originY,dx=ray.x-x0,dy=ray.y-y0;
        const length=Math.hypot(dx,dy);
        if(length<1)continue;
        const ux=dx/length,uy=dy/length;
        ctx.save();ctx.globalAlpha=.9*a;ctx.lineCap='round';
        ctx.strokeStyle='#2773b3';ctx.lineWidth=18;ctx.shadowColor='#1da3ff';ctx.shadowBlur=13;
        ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(ray.x,ray.y);ctx.stroke();
        ctx.shadowBlur=0;ctx.strokeStyle='#68cbff';ctx.lineWidth=8;
        ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(ray.x,ray.y);ctx.stroke();
        ctx.strokeStyle='#f4feff';ctx.lineWidth=2.8;
        ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(ray.x,ray.y);ctx.stroke();
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
