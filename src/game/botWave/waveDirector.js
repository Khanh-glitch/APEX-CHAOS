// Pure deterministic wave/director orchestration. No VFX, HP or enemy AI
// rewrites here. Canonical runtime adapter validates each death and applies
// spawn requests. Neither BOXE nor BOT WAVE is public while Gold is absent.
import {BOXE_WAVE} from '../boxe/boxeConfig.js';
import {getWaveLoadout,makeWaveEnemyEquipment} from './apexGunLoadouts.js';
import {DEFAULT_ROBOTS,WAVE_UPGRADES,upgradeState,recordAuthorizedKill,
 waveDescriptor,offerThreeCards,chooseCard,unlockedKeys,enabledGoldSkills}
 from './upgradeRegistry.js';

const makeRng=seed=>{let s=(seed>>>0)||0x2d1c9e3b;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};};
const EDGES=Object.freeze(['north','east','south','west']);
export const WAVE_PROVISIONAL_TUNING=Object.freeze({
 baselineNonBossCount:6,additionalPerWave:2,maxEnemiesInWave:48,
 hpScalePerWave:1.035,damageScalePerWave:1
});
// Game process owns actual enemy HP, spawn/despawn and timing. A Wave Director
// only outputs a deterministic schedule with identities, profiles and edges.
export function buildWavePlan(wave,{seed=1,registry=DEFAULT_ROBOTS,tuning=WAVE_PROVISIONAL_TUNING}={}){
 const desc=waveDescriptor(wave,registry);
 const arsenal=getWaveLoadout(wave,{seed});
 const rng=makeRng((seed^Math.imul(wave,0x9e3779b1))>>>0);
 const support=Object.keys(registry).filter(id=>!registry[id].boss&&registry[id].minWave<=wave&&(!registry[id].maxWave||registry[id].maxWave>=wave));
 if(!support.length)throw Error('NO_REGISTERED_ENEMY_FOR_WAVE_'+wave);
 const bosses=desc.boss?desc.candidates:[];
 if(desc.boss&&!bosses.length)throw Error('NO_REGISTERED_BOSS_FOR_WAVE_'+wave);
 const weaponIds=[...arsenal.composition];if(arsenal.bossGun)weaponIds.push(arsenal.bossGun);
 const enemies=weaponIds.map((gunId,i)=>{
  const boss=!!arsenal.bossGun&&i===weaponIds.length-1;
  const archetypeId=boss?bosses[Math.floor(rng()*bosses.length)]:support[Math.floor(rng()*support.length)];
  return Object.freeze({
   id:'wave-'+wave+'-enemy-'+i,archetypeId,edge:EDGES[i%EDGES.length],boss,gunId,
   edgeFraction:.08+.84*rng(),equipment:makeWaveEnemyEquipment(gunId,wave,{boss}),
   hpMultiplier:+Math.min(2.6,Math.pow(tuning.hpScalePerWave,wave-1)).toFixed(4),
   attackMultiplier:arsenal.damageScalar,xp:registry[archetypeId].xp
  });
 });
 if(enemies.some(e=>!Number.isFinite(e.xp)||e.xp<0))throw Error('ENEMY_WITHOUT_XP');
 return Object.freeze({wave,boss:desc.boss,enemies:Object.freeze(enemies),
  pressureEstimate:arsenal.pressureEstimate,concurrentLimit:arsenal.concurrentLimit,
  gunComposition:arsenal.composition,reloadPolicy:arsenal.reloadPolicy,terrain:'landscape-arena'});

}
export function createBotWaveDirector({seed=1,registry=DEFAULT_ROBOTS,upgrades=WAVE_UPGRADES,onEvent=()=>{}}={}){
 const state={status:'ready',wave:0,plan:null,live:new Map(),seenKills:new Set(),progress:upgradeState(),endless:false};
 const notify=(type,payload={})=>onEvent({type,wave:state.wave,...payload});
 function startWave(){
  if(state.progress.pending||state.progress.pendingLevelUps>0)throw Error('SELECT_LEVEL_UP_CARDS_FIRST');
  if(state.status!=='ready'&&state.status!=='cleared')throw Error('WAVE_NOT_READY');
  // Owner CP2: no hard chapter-clear gate at wave 10 or any finite wave.
  // Every fifth wave is a milestone, not an ending.
  const plan=buildWavePlan(state.wave+1,{seed,registry});
  state.wave=plan.wave;state.plan=plan;state.live=new Map(plan.enemies.map(e=>[e.id,e]));
  state.endless=state.wave>10;
  state.status='in-wave';
  notify('wave:spawn-plan',{boss:plan.boss,enemies:plan.enemies});
  return plan;
 }
 function verifiedDeath(enemyInstanceId){
  // Called only after the real engine emits a verified unique death receipt.
  if(state.status!=='in-wave'&&state.status!=='level-up')return {accepted:false,reason:'WAVE_NOT_RUNNING'};
  const enemy=state.live.get(enemyInstanceId);
  if(!enemy)return {accepted:false,reason:'UNKNOWN_OR_ALREADY_KILLED'};
  state.live.delete(enemyInstanceId);
  const result=recordAuthorizedKill(state.progress,{killId:enemyInstanceId,xp:enemy.xp},state.seenKills);
  notify('wave:enemy-defeated',{enemyId:enemy.id,archetypeId:enemy.archetypeId,xp:enemy.xp,levels:result.levels});
  if(state.live.size===0){
   state.status='cleared';
   notify('wave:cleared',{wave:state.wave});
  }
  if(state.progress.pendingLevelUps>0){
   state.status='level-up';
   notify('wave:level-up',{pendingChoices:state.progress.pendingLevelUps});
  }
  return {accepted:true,levels:result.levels,remaining:state.live.size};
 }
 function offerLevelUp(){
  if(state.status!=='level-up'||state.progress.pendingLevelUps<=0)throw Error('NOT_WAITING_FOR_LEVEL_UP');
  const cards=offerThreeCards(state.progress,{seed,pool:upgrades});
  notify('wave:upgrade-offer',{ids:cards.map(c=>c.id),choices:3});return cards;
 }
 function selectLevelUp(cardId){
  if(state.status!=='level-up')throw Error('NOT_WAITING_FOR_LEVEL_UP');
  const card=chooseCard(state.progress,cardId,{pool:upgrades});
  notify('wave:upgrade-chosen',{id:card.id,unlockedKeys:unlockedKeys(state.progress),activeGoldKeys:enabledGoldSkills(state.progress)});
  if(state.progress.pendingLevelUps===0){
   state.status=state.live.size?'in-wave':'cleared';
   notify('wave:level-up-resumed');
  }
  return card;
 }
 function beginEndless(){
  // Backward-compatible no-op: continuing is intrinsic, not a user-granted
  // feature unlocked at a fixed chapter boundary.
  if(state.status!=='cleared')throw Error('COMPLETE_CURRENT_WAVE_FIRST');
  state.endless=true;notify('wave:continuation-confirmed');
 }
 function snapshot(){
  return {status:state.status,wave:state.wave,alive:state.live.size,level:state.progress.level,
   xp:state.progress.xp,totalXp:state.progress.totalXp,pendingLevelUps:state.progress.pendingLevelUps,
   pendingCards:state.progress.pending?[...state.progress.pending]:null,
   activeKeys:unlockedKeys(state.progress),activeGoldKeys:enabledGoldSkills(state.progress),
   endless:state.endless};
 }
 return {startWave,verifiedDeath,offerLevelUp,selectLevelUp,beginEndless,snapshot};
}
