/* Quest 01 E08 — one native Stormbreaker slot/projectile/artifact.
 * The authority receives receipts ONLY from real Arsenal spawn, reveal,
 * pickup/equip, thrown projectile, and terminal physics exit. No synthetic
 * weapon ownership, no synthetic hit and no direct Fighter HP mutation.
 */
(function installTotNativeStorm(root){
'use strict';
if(root.APEX_QUEST_TOT_NATIVE_STORM)return;
function create({state,hero,tot,weaponApi,spawn,authority,onCue}={}){
 if(!state||hero?.questId!=='NEWBOT'||tot?.questId!=='T.O.T'
   ||tot?.questTeam!=='HOSTILE'||typeof spawn?.trySpawnSlot!=='function'
   ||typeof weaponApi?.getHolder!=='function'
   ||typeof authority?.create!=='function')throw Error('E08 real engine dependencies required');
 let alive=true,slot=null,projectile=null,cradle=null,spawned=false,returned=false;
 let approvedReceipt=null;
 const HERO_AFTER='__apexQuestAfterAcceptedDamage';
 const heroPriorAfter=hero[HERO_AFTER];
 if(typeof heroPriorAfter==='function')throw Error('E08 hero already owns native post-damage hook');
 const receipts=[],queue=[];
 const adapter=root.APEX_QUEST_TOT_DAMAGE_ADAPTER.create({
   authority,
   verifyNativeStorm:receipt=>alive&&receipt===approvedReceipt
     &&receipt?.artifactId===String(slot?.id)
     &&receipt.weaponId==='STORMBREAKER'&&receipt.ownerQuestId==='T.O.T',
   onCue:cue=>{receipts.push(cue);queue.push(cue.cue);onCue?.(cue);}
 });
 const bound=adapter.attach(hero,tot);
 if(!bound.ok){adapter.close();throw Error('E08 native boss attach: '+bound.reason);}
 // The engine calls this AFTER an actual accepted Fighter HP deduction,
 // inside the STORMBREAKER swept collision transaction. This is the unique
 // authoritative hit receipt, even if an AV/runtime layer later removes
 // the transient projectile before E08's normal post-collision callback.
 hero[HERO_AFTER]=function e08AcceptedStormHit(real,source,label){
   if(!alive||source!==tot||label!=='arsenal-stormbreaker'||!(real>0))return;
   if(!projectile||returned||!slot||slot.phase!=='REMOVED'
      ||projectile.type!=='aq_thrown'||projectile.state!=='flight'
      ||projectile.owner!==tot||projectile.weapon!=='STORMBREAKER'
      ||projectile.questTotArtifactId!==String(slot.id)
      ||!root.projectiles?.includes(projectile))
     throw Error('E08 accepted hit without original live single Stormbreaker');
   if(onResolve(projectile,'HIT')!==true)
     throw Error('E08 authentic accepted Stormbreaker damage denied by artifact phase');
 };
 function physical(event,extras={}){
   if(!alive||!slot)return {ok:false,reason:'no-live-native-slot'};
   approvedReceipt=Object.freeze({event,artifactId:String(slot.id),
     weaponId:'STORMBREAKER',ownerQuestId:'T.O.T',...extras});
   const result=adapter.physicalStorm(approvedReceipt);approvedReceipt=null;
   if(result?.ok)receipts.push(Object.freeze({native:event,slotId:slot.id,...extras}));
   return result;
 }
 function trySpawn(){
   if(!alive||spawned||adapter.snapshot().phase!==authority.PHASE.ELIGIBLE
      ||state.questTotProgression!==true||!state.active||state.over)return false;
   // The eligible boss finishes its existing holder through the shared
   // Arsenal consume path; the exceptional weapon still MUST be physically
   // collected from a revealed floor slot, never directly equipped.
   if(weaponApi.getHolder(tot))weaponApi.consume(tot,'e08-one-storm-handoff');
   slot=spawn.trySpawnSlot({questWeaponId:'STORMBREAKER',
     questStage:'E08_STORMBREAKER',questPickupOwner:'T.O.T',
     questPoint:{x:tot.x,y:tot.y}});
   if(!slot||slot.questStage!=='E08_STORMBREAKER')return false;
   spawned=true;return true;
 }
 function onReveal(actual){
   if(!alive||actual!==slot||actual.phase!=='REVEALED'
     ||actual.weaponId!=='STORMBREAKER')return false;
   return physical('SPAWN').ok===true;
 }
 function onPickup(f,actual,holder){
   if(!alive||actual!==slot||f!==tot
     ||actual.phase!=='PICKED_UP'||holder!==weaponApi.getHolder(tot)
     ||holder?.weaponId!=='STORMBREAKER')return false;
   return physical('PICKUP').ok===true;
 }
 function onThrow(f,p){
   if(!alive||f!==tot||projectile||!slot||!p
     ||p.owner!==tot||p.type!=='aq_thrown'||p.weapon!=='STORMBREAKER'
     ||adapter.snapshot().phase!==authority.PHASE.HELD)return false;
   projectile=p;p.questTotArtifactId=String(slot.id);
   // Bind the terminal receipt to THIS specific real projectile before
   // it enters collision processing. Native hit resolution must never rely
   // on a transient global AQ.state lookup *after* damage/VFX callbacks.
   // The closure still validates identity, phase and the same picked slot.
   p.questTotCommitResolution=(resolution)=>onResolve(p,resolution);
   receipts.push(Object.freeze({native:'THROW',slotId:slot.id,
     projectileType:p.type,speed:Math.hypot(p.vx,p.vy)}));
   return true;
 }
 function onResolve(p,resolution){
   if(!alive||p!==projectile||!['HIT','MISS','GROUND'].includes(resolution))return false;
   // The native accepted-damage hook can settle the actual hit before
   // the weapon's post-VFX callback runs. Repeated confirmation of the
   // SAME projectile+resolution is idempotent, never a second receipt.
   if(returned)return cradle?.resolution===resolution;
   if(p.weapon!=='STORMBREAKER'||p.type!=='aq_thrown'
     ||p.owner!==tot||p.questTotArtifactId!==String(slot.id))return false;
   // Move the SAME floor artifact back to its cradle only after the native
   // projectile has physically hit or exited. It can never be picked up twice.
   if(slot.phase!=='REMOVED')return false;
   if(state.slots.some(s=>s.id===slot.id&&s!==slot&&s.phase!=='REMOVED'))return false;
   state.slots=state.slots.filter(s=>s!==slot);
   returned=true;cradle=Object.freeze({slotId:slot.id,x:slot.x,y:slot.y,resolution});
   slot.phase='REVEALED';slot.questNarrativeOnly=true;
   slot.questStage='E08_CRADLE_RETURN';slot.revealedFor=0;
   state.slots.push(slot);
   const result=physical('RESOLVED',{returnedToCradle:true,resolution});
   if(result.ok)queue.push('E08_STORMBREAKER_RESOLVED');
   if(!result.ok){state.slots=state.slots.filter(s=>s!==slot);returned=false;cradle=null;}
   return result.ok===true;
 }
 function snapshot(){return Object.freeze({
   ...adapter.snapshot(),spawned,returned,slotId:slot?.id||null,
   slotPhase:slot?.phase||null,cradle,projectileReleased:!!projectile,
   projectileState:projectile?.state||null,
   projectileFlightTime:projectile?.flightTime??null,
   projectileLife:projectile?.life??null,
   projectilePos:projectile?{x:projectile.x,y:projectile.y}:null,
   projectileInWorld:!!(projectile&&root.projectiles?.includes(projectile)),
   projectileNative:projectile?.type==='aq_thrown'
      &&projectile?.questTotArtifactId===String(slot?.id),
   receipts:receipts.map(r=>({...r})),pendingScenes:queue.slice()
 });}
 function takeScene(){return queue.shift()||null;}
 function close(){if(!alive)return;alive=false;
   if(heroPriorAfter===undefined)delete hero[HERO_AFTER];else hero[HERO_AFTER]=heroPriorAfter;
   adapter.close();projectile=null;slot=null;queue.length=0;
 }
 return Object.freeze({trySpawn,onReveal,onPickup,onThrow,onResolve,
   snapshot,takeScene,close,adapter});
}
root.APEX_QUEST_TOT_NATIVE_STORM=Object.freeze({create});
root.apexQuestTotNativeStorm='ready';
})(typeof window!=='undefined'?window:globalThis);
