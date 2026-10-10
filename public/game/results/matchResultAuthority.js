/* Owner B8 + V43: actual Free Battle match ledger.
 * All damage, shots, pickups, heals, casts and KO originate in the ONE
 * native Arsenal transaction. No simulation, no fake awards, no synthetic KO.
 * Quest, Lab and dummy matches never receive a result screen. */
(function installMatchResultAuthority(root){
'use strict';
if(root.APEX_MATCH_RESULT_AUTHORITY)return;
const catalog=root.APEX_RESULT_OWNER_CATALOG||[];
const finite=n=>Number.isFinite(n);
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const heroId=f=>({ROBOT:'NEWBOT',ICE:'FROST',CRYSTAL:'CRYSTALA'}[String(f?.name||'').toUpperCase()]||String(f?.name||'').toUpperCase());
const heroSlug=id=>({NEWBOT:'newbot',CRYSTALA:'crystala',FROST:'frost'}[id]||id.toLowerCase());
const accent={NEWBOT:'#ff941f',HUNTER:'#96ca2d',CRYSTALA:'#a066f0',MAGNET:'#c7c5e9',FROST:'#7ee8ff',MIRROR:'#e9e5df'};
const rgb=s=>{const h=(s||'#aaaaaa').replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)).join(' ')};
function create({actors,mode,startedAt=Date.now(),weaponConfig}={}){
 if(!Array.isArray(actors)||actors.length!==2||!['BOT','LOCAL'].includes(mode))
   throw Error('Result ledger requires two genuine Free Battle Fighters');
 let live=true,elapsed=0,sealed=null,firstBlood=false;
 const tracks=actors.map((f,i)=>({
   f,index:i,id:'P'+(i+1),hero:heroId(f),dealt:0,taken:0,healing:0,blocked:0,
   shots:0,hits:0,critHits:0,hitStreak:0,maxStreak:0,critMax:0,
   casts:0,pickups:0,sourceMap:new Map(),weapons:new Set(),familyDamage:new Map(),
   hitsTimeline:[],maxHit:0,longDamage:0,closeDamage:0,
   minHp:100,damageAtLow:0,secondsLow:0,distance:0,
   lastX:f.x,lastY:f.y,lastDamageAt:0,lastShotAt:-1,
   noDamageTime:0,maxNoDamage:0,ricochets:0,trapHits:0,
   healsFromDanger:0,followups:0,damageWindow:0,maxBurst1:0,maxBurst3:0,
   maxLostLead:0,comebackDeficit:0,skillDamage:0,swapFast:0,lastPickupAt:null,
   kills:0,earlyHit:0,firstBlood:false
 }));
 const track=f=>tracks.find(t=>t.f===f)||null;
 function now(){return elapsed}
 function onDamage(victim,source,label,actual,critical=false,impact=null){
   if(!live||!finite(actual)||actual<=0)return;
   const v=track(victim),a=track(source);
   if(v){v.taken+=actual;v.minHp=Math.min(v.minHp,100*victim.hp/Math.max(1,victim.maxHp));v.lastDamageAt=now()}
   if(!a||a===v)return;
   const weapon=String(label||'').startsWith('arsenal-');
   const id=weapon?String(label).slice(8).toUpperCase().replaceAll('-','_'):String(label||'SKILL');
   const key=(weapon?'W:':'S:')+id;
   const record=a.sourceMap.get(key)||{id:key,label:id,kind:weapon?'weapon':'skill',weaponId:weapon?id:undefined,damage:0};
   record.damage+=actual;a.sourceMap.set(key,record);a.dealt+=actual;
   if(!weapon)a.skillDamage+=actual;
   const family=weaponConfig?.WEAPONS?.[id]?.family||((weaponConfig?.MELEE_WEAPON_IDS||[]).includes(id)?'MELEE':null);
   if(family)a.familyDamage.set(family,(a.familyDamage.get(family)||0)+actual);
   a.maxHit=Math.max(a.maxHit,actual);
   if(critical)a.critHits++;
   if(weapon){a.hits++;a.hitStreak++;a.maxStreak=Math.max(a.maxStreak,a.hitStreak)}
   const d=Math.hypot(source.x-victim.x,source.y-victim.y);
   if(d>=500)a.longDamage+=actual;if(d<=240)a.closeDamage+=actual;
   if(source.hp/Math.max(1,source.maxHp)<=.25)a.damageAtLow+=actual;
   a.hitsTimeline.push({t:now(),damage:actual,weapon:id});
   while(a.hitsTimeline.length>250)a.hitsTimeline.shift();
   for(const win of [1.2,3]){
     let amt=0;for(let i=a.hitsTimeline.length-1;i>=0;i--){const x=a.hitsTimeline[i];if(now()-x.t>win)break;amt+=x.damage}
     if(win===1.2)a.maxBurst1=Math.max(a.maxBurst1,amt);else a.maxBurst3=Math.max(a.maxBurst3,amt);
   }
   if(!firstBlood){firstBlood=true;a.firstBlood=true}
   if(v&&victim.hp<=0)a.kills++;
 }
 function onShot(f,weaponId){const x=track(f);if(!live||!x)return;x.shots++;x.lastShotAt=now();x.lastWeapon=weaponId}
 function onMiss(f){const x=track(f);if(x&&live)x.hitStreak=0}
 function onPickup(f,weaponId){const x=track(f);if(!live||!x)return; x.pickups++;x.weapons.add(String(weaponId));
   if(x.lastPickupAt!==null&&now()-x.lastPickupAt<=2)x.swapFast++;x.lastPickupAt=now()}
 function onHeal(f,actual){const x=track(f);if(!live||!x||!(actual>0))return;x.healing+=actual;
   if(f.hp/Math.max(1,f.maxHp)<=.25+actual/Math.max(1,f.maxHp))x.healsFromDanger+=actual}
 function onCast(f){const x=track(f);if(x&&live)x.casts++}
 function onRicochet(f){const x=track(f);if(x&&live)x.ricochets++}
 function onBlocked(f,n){const x=track(f);if(x&&live&&n>0)x.blocked+=n}
 function tick(dt){if(!live||!(dt>0)||!finite(dt))return;elapsed+=dt;
   for(const t of tracks){if(t.f?.hp==null)continue;
     const d=Math.hypot(t.f.x-t.lastX,t.f.y-t.lastY);
     t.distance+=Math.min(d,2000*dt);t.lastX=t.f.x;t.lastY=t.f.y;
     const hp=t.f.hp/Math.max(1,t.f.maxHp)*100;t.minHp=Math.min(t.minHp,hp);
     if(hp<=10)t.secondsLow+=dt;
     if(t.dealt===0)t.noDamageTime+=dt;
     if(t.taken>0&&elapsed-t.lastDamageAt>t.maxNoDamage)t.maxNoDamage=elapsed-t.lastDamageAt;
     const o=tracks[1-t.index];
     const deficit=Math.max(0,(o.f.hp/Math.max(1,o.f.maxHp)-t.f.hp/Math.max(1,t.f.maxHp))*1000);
     t.comebackDeficit=Math.max(t.comebackDeficit,deficit);
   }}
 function observed(t,def,winner){const h=t.f.hp/Math.max(1,t.f.maxHp)*100;
   const generic={
     damage:t.dealt,hit:t.maxHit,window:3,gap:1.2,ratio:t.taken>0?t.dealt/t.taken:0,ming:t.dealt,
     accuracy:t.shots>0?100*t.hits/t.shots:0,shots:t.shots,crit:t.hits>0?100*t.critHits/t.hits:0,
     hits:t.hits,distance:t.distance,streak:t.maxStreak,delay:t.swapFast>0?0:Infinity,
     count:t.swapFast,weapons:t.weapons.size,healing:t.healing,blocked:t.blocked,
     hp:h,duration:elapsed,taken:t.taken,pickups:t.pickups,danger:t.healsFromDanger>0?t.minHp:Infinity,
     heal:t.healsFromDanger,seconds:t.secondsLow,deficit:t.comebackDeficit,
     travel:t.distance,casts:t.casts,speed:elapsed>0?t.distance/elapsed:0,
     followups:t.followups,chains:0,window2:0,time:elapsed,sources:t.sourceMap.size,
     cycles:0,traps:0,refreshes:0
   };
   // No metric is fabricated. Unsupported measures never pass a predicate.
   const unsupported=new Set(['fate-hand','trickster','combo-artist','signature-newbot',
     'signature-hunter','signature-crystala','signature-magnet','signature-frost','signature-mirror']);
   if(unsupported.has(def.id))return null;
   if(def.id==='first-blood')return t.firstBlood?{__event:1}:null;
   if(def.id==='final-round')return null; // lacks final-ammo accepted-hit event
   if(def.id==='executioner')generic.hp=Math.min(generic.hp,100); // actual final HP only
   if(def.id==='overkill')generic.hit=t.maxHit;
   if(def.id==='burst-king')generic.damage=t.maxBurst3;
   if(def.id==='no-escape')generic.damage=t.maxBurst1;
   if(def.id==='eagle-eye')generic.damage=t.longDamage;
   if(def.id==='point-blank')generic.damage=t.closeDamage;
   if(def.id==='mastery-shotgun')generic.damage=t.familyDamage.get('SHOTGUN')||0;
   if(def.id==='mastery-auto')generic.damage=t.familyDamage.get('AUTO')||0;
   if(def.id==='mastery-burst')generic.damage=t.familyDamage.get('BURST')||0;
   if(def.id==='mastery-precision')generic.damage=t.familyDamage.get('PRECISION')||0;
   if(def.id==='mastery-semi')generic.damage=t.familyDamage.get('SEMI')||0;
   if(def.id==='mastery-melee')generic.damage=t.familyDamage.get('MELEE')||0;
   if(def.id==='untouchable')generic.duration=elapsed;
   if(def.id==='pacifist')generic.seconds=t.noDamageTime;
   if(def.id==='adrenaline')generic.damage=t.damageAtLow;
   if(def.id==='clutch')return null; // last 30s hit window not yet signed
   if(def.id==='never-surrender')return null; // last HP comeback authority absent
   if(def.id==='chaos-bringer')return null; // source diversity window not signed
   if(['last-stand','comeback'].includes(def.id)&&!winner)return null;
   return generic;
 }
 function seal(winnerSide){
   if(sealed)return sealed;if(!live)return null;
   const wi=winnerSide==='P1'?0:winnerSide==='P2'?1:-1;
   if(wi<0)return null;
   live=false;
   const cfg=weaponConfig||{};const weapons=[];
   for(const id of new Set(tracks.flatMap(t=>[...t.weapons,...[...t.sourceMap.values()].filter(x=>x.kind==='weapon').map(x=>x.weaponId)]))){
     if(!id)continue;
     const spec=cfg.WEAPONS?.[id]||{};
     const fam=String(spec.family||'SEMI');
     const known=['SHOTGUN','AUTO','BURST','PRECISION','SEMI'].includes(fam)?fam:'SEMI';
     const category=known==='SHOTGUN'?'shotgun':known==='AUTO'?'smg':known==='PRECISION'?'marksman':'railgun';
     const art=(cfg.V43_WEAPONS&&cfg.V43_WEAPONS[id])?'/assets/arsenal/v43/'+id+'.webp':undefined;
     weapons.push({id,name:id.replaceAll('_',' '),weaponClass:category,classLabel:fam,
       tierLabel:cfg.tierOf?.(id)||'T1',tagline:'APEX ARSENAL',ownerId:tracks[0].id,
       silhouette:'generic',artSrc:art,stats:{shotsFired:0,shotsHit:0,bestHit:0}});
   }
   const players=tracks.map((t,i)=>{
     const slug=heroSlug(t.hero),color=accent[t.hero]||'#dddddd';
     const list=[...t.sourceMap.values()];
     const awards=[];
     for(const def of catalog){if(def.heroId&&def.heroId!==t.hero)continue;
       const obs=observed(t,def,i===wi);if(!obs)continue;
       if(!def.params.length){if(obs.__event)awards.push({achievementId:def.id,value:1,observedParams:{}});continue}
       if(def.params.some(p=>!finite(obs[p.key])||(p.compare==='gte'?obs[p.key]<p.value:obs[p.key]>p.value)))continue;
       const m={};for(const p of def.params)m[p.key]=obs[p.key];
       awards.push({achievementId:def.id,value:m[def.params[0].key],observedParams:m});
     }
     return {id:t.id,slot:i+1,handle:'P'+(i+1),level:1,rankTitle:'CORE SIX',
       outcome:i===wi?'victory':'defeat',accent:color,accentRgb:rgb(color),
       character:{name:t.hero,className:'APEX FIGHTER',tagline:'',artKind:'generic',
         heroId:t.hero,portraitSrc:'/assets/gold-ui/heroes/'+slug+'/'+(t.hero==='MIRROR'?'pick_roster_cover.webp':'pick_selected_large.webp')},
       damage:{dealt:t.dealt,taken:t.taken,sources:list},stats:{
         accuracy:t.shots>0?Math.round(t.hits/t.shots*100):0,
         critRate:t.hits>0?Math.round(t.critHits/t.hits*100):0,
         healing:t.healing,skillCasts:t.casts},awards};
   });
   const ranked=new Map();
   for(const p of players)for(const s of p.damage.sources){if(s.kind!=='weapon')continue;
     let o=ranked.get(s.weaponId)||{weaponId:s.weaponId,ownerId:p.id,damage:0,own:0};
     o.damage+=s.damage;if(s.damage>o.own){o.own=s.damage;o.ownerId=p.id}ranked.set(s.weaponId,o)}
   const best=[...ranked.values()].sort((a,b)=>b.damage-a.damage||a.weaponId.localeCompare(b.weaponId))[0];
   const result={meta:{id:'match-'+startedAt+'-'+Math.round(elapsed*1000),map:'APEX ARENA',
       mode:mode==='BOT'?'BOT BATTLE':'LOCAL 1V1',season:'APEX CHAOS',
       durationSec:Math.round(elapsed),playedAt:new Date(startedAt).toISOString()},
     players,weapons,weaponOfTheBattle:best?{weaponId:best.weaponId,ownerId:best.ownerId,damage:best.damage}
       :{weaponId:'',ownerId:'',damage:0}};
   sealed=Object.freeze(result);return sealed;
 }
 return Object.freeze({onDamage,onShot,onMiss,onPickup,onHeal,onCast,onRicochet,onBlocked,tick,seal,
   snapshot:()=>({live,elapsed,players:tracks.map(t=>({id:t.id,dealt:t.dealt,shots:t.shots,pickups:t.pickups}))})});
}
root.APEX_MATCH_RESULT_AUTHORITY=Object.freeze({create});
root.apexMatchResultAuthority='ready';
})(typeof window!=='undefined'?window:globalThis);
