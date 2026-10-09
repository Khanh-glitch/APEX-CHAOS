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
    const casters=new Map(),rays=[];
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
        if(to.hp<before){applied++;bumps++;}
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
            hits++;
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
    function draw(ctx,actors){
      if(closed||!ctx||!Array.isArray(actors))return;
      ctx.save();
      for(const c of casters.values()){
        const f=c.owner;
        if(!isActive(f,actors)||!(c.charge>0))continue;
        const target=actors.find(x=>x.questId===c.lockedTarget&&x.hp>0)
          ||core.nearestEnemy(f,actors);
        const progress=1-c.charge/spec.chargeSeconds;
        ctx.save();ctx.globalAlpha=.35+.5*progress;
        ctx.lineWidth=2.5;ctx.strokeStyle='#4fbdf2';
        if(target){
          ctx.setLineDash([7,9]);
          ctx.beginPath();ctx.moveTo(f.x,f.y);
          ctx.lineTo(target.x,target.y);ctx.stroke();ctx.setLineDash([]);
        }
        ctx.beginPath();ctx.arc(f.x,f.y,Math.max(10,f.radius*.76)+16*progress,0,Math.PI*2);
        ctx.lineWidth=3+progress*3;ctx.strokeStyle='#97ecff';ctx.stroke();
        ctx.restore();
      }
      for(const ray of rays){
        ctx.save();
        ctx.globalAlpha=ray.done?Math.max(0,ray.fade/lifetime):.93;
        ctx.strokeStyle='#53bfff';ctx.lineWidth=12;ctx.shadowColor='#4bc7ff';ctx.shadowBlur=18;
        ctx.beginPath();ctx.moveTo(ray.originX,ray.originY);ctx.lineTo(ray.x,ray.y);ctx.stroke();
        ctx.strokeStyle='#e4faff';ctx.lineWidth=3;ctx.shadowBlur=6;
        ctx.beginPath();ctx.moveTo(ray.originX,ray.originY);ctx.lineTo(ray.x,ray.y);ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
    function close(){
      if(closed)return;
      for(const c of casters.values())release(c.owner,c);
      casters.clear();rays.length=0;closed=true;
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
