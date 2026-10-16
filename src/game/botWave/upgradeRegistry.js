// Rules and upgrade systems consume BOXE_WAVE; nothing is hardcoded by upgrade ID in UI.
// Registry is extensible via createWaveUpgradePool, with unique IDs and dependency tests.
import {BOXE_WAVE} from '../boxe/boxeConfig.js';

const BASE_UPGRADES=Object.freeze([
 {id:'unlock-jab-finisher',tier:'rare',kind:'unlock',slot:'J',goldKey:'1',requires:[],rank:1},
 {id:'unlock-rocket-proc',tier:'rare',kind:'unlock',slot:'J',goldKey:'2',requires:[],rank:0},
 {id:'unlock-uppercut-finisher',tier:'epic',kind:'unlock',slot:'J',goldKey:'3',requires:['unlock-jab-finisher'],rank:2},
 {id:'unlock-counter',tier:'rare',kind:'unlock',slot:'K',goldKey:'9',requires:['unlock-uppercut-finisher'],rank:3},
 {id:'unlock-phantom',tier:'epic',kind:'unlock',slot:'U',goldKey:'5',requires:['unlock-counter'],rank:4},
 {id:'unlock-ultimate',tier:'legendary',kind:'unlock',slot:'I',goldKey:'0',requires:['unlock-phantom'],rank:5},
 {id:'vitality',tier:'common',kind:'stat',stat:'maxHP',step:0.08,maxStacks:12},
 {id:'fist-force',tier:'common',kind:'stat',stat:'meleeDamage',step:0.10,maxStacks:12},
 {id:'attack-tempo',tier:'common',kind:'stat',stat:'punchRecovery',step:0.08,maxStacks:10},
 {id:'dash-recovery',tier:'common',kind:'stat',stat:'dashCooldown',step:0.06,maxStacks:10},
 {id:'mobility',tier:'common',kind:'stat',stat:'moveSpeed',step:0.07,maxStacks:8},
 {id:'guard-duration',tier:'rare',kind:'stat',stat:'guardWindow',step:0.12,maxStacks:8},
 {id:'stun-effect',tier:'rare',kind:'stat',stat:'waveStun',step:0.07,maxStacks:8},
 {id:'xp-gain',tier:'rare',kind:'stat',stat:'xpMultiplier',step:0.12,maxStacks:6},
 {id:'lifesteal',tier:'epic',kind:'stat',stat:'onKillHeal',step:0.04,maxStacks:5},
 {id:'critical',tier:'epic',kind:'stat',stat:'waveCritChance',step:0.04,maxStacks:5},
 {id:'thunder-trail',tier:'legendary',kind:'stat',stat:'waveElectricImpact',step:1,maxStacks:2},
]);
export const RARITY_WEIGHTS=Object.freeze({common:60,rare:26,epic:11,legendary:3});
export const WAVE_UPGRADES=BASE_UPGRADES;
export function createWaveUpgradePool(extra=[]){
 const pool=[...BASE_UPGRADES,...extra].map(x=>Object.freeze({...x,requires:Object.freeze([...(x.requires||[])])}));
 if(new Set(pool.map(x=>x.id)).size!==pool.length)throw Error('DUPLICATE_UPGRADE_IDS');
 for(const c of pool){
  if(!c.id||!c.tier||!RARITY_WEIGHTS[c.tier])throw Error('INVALID_UPGRADE '+c.id);
  if((c.requires||[]).some(req=>!pool.some(x=>x.id===req)))throw Error('MISSING_REQUIREMENT '+c.id);
 }
 return Object.freeze(pool);
}
export function upgradeState(){return {level:1,xp:0,totalXp:0,owned:new Set(),stacks:{},pending:null,pendingLevelUps:0,offerSerial:0};}
export function isCardEligible(c,s){
 if(c.kind==='unlock')return !s.owned.has(c.id)&&c.requires.every(req=>s.owned.has(req));
 return (s.stacks[c.id]||0)<c.maxStacks&&(c.requires||[]).every(req=>s.owned.has(req));
}
function seededRng(seed){
 let x=(Number(seed)>>>0)||0x92a7f1e3;
 return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return ((x>>>0)+0.5)/4294967296;};
}
export function offerThreeCards(state,{seed=1,pool=WAVE_UPGRADES}={}){
 if(state.pending)throw Error('UNRESOLVED_THREE_CARD_OFFER');
 if(state.pendingLevelUps<=0)throw Error('NO_LEVEL_UP_PENDING');
 const eligible=pool.filter(c=>isCardEligible(c,state));
 if(eligible.length<3)throw Error('UPGRADE_POOL_EXHAUSTED');
 const rand=seededRng((seed ^ Math.imul(state.level,0x9e3779b1) ^ Math.imul(state.offerSerial+1,0x85ebca6b))>>>0);
 const candidates=[...eligible],offer=[];
 for(let i=0;i<3;i++){
  const weight=c=>RARITY_WEIGHTS[c.tier];
  const total=candidates.reduce((s,c)=>s+weight(c),0);
  let r=rand()*total,index=candidates.length-1;
  for(let k=0;k<candidates.length;k++){r-=weight(candidates[k]);if(r<0){index=k;break}}
  offer.push(candidates.splice(index,1)[0]);
 }
 state.pending=offer.map(c=>c.id);
 state.offerSerial++;
 return offer;
}
export function chooseCard(state,cardId,{pool=WAVE_UPGRADES}={}){
 if(!state.pending||!state.pending.includes(cardId))throw Error('CARD_NOT_OFFERED');
 const card=pool.find(c=>c.id===cardId);
 if(!card||!isCardEligible(card,state))throw Error('CARD_INVALID_NOW');
 if(card.kind==='unlock')state.owned.add(card.id);
 else state.stacks[card.id]=(state.stacks[card.id]||0)+1;
 state.pending=null;
 if(!(state.pendingLevelUps>0))throw Error('LEVEL_UP_ACCOUNTING_INVALID');
 state.pendingLevelUps--;
 return card;
}
export function unlockedKeys(state){
 const keys=['J','K','L'];
 if(state.owned.has('unlock-phantom'))keys.push('U');
 if(state.owned.has('unlock-ultimate'))keys.push('I');
 return keys;
}
export function enabledGoldSkills(state){
 return [...BOXE_WAVE.goldUpgradeOrder.filter(x=>state.owned.has(x.id)).map(x=>x.goldKey),...(state.owned.has('unlock-rocket-proc')?['2']:[])];
}
// Exp thresholds are tunable game config: no XP is awarded by this pure module.
// The authoritative killed-enemy handler must dedupe killId and award XP once.
export const DEFAULT_XP_CURVE=Object.freeze({base:60,growth:1.20});
export function xpForNextLevel(level,curve=DEFAULT_XP_CURVE){return Math.ceil(curve.base*Math.pow(curve.growth,Math.max(0,level-1)));}
export function recordAuthorizedKill(state,{killId,xp},seenKills){
 if(!killId||!Number.isFinite(xp)||xp<0)throw Error('INVALID_KILL_XP');
 if(seenKills.has(killId))return {accepted:false,leveled:false};
 seenKills.add(killId);state.xp+=xp;state.totalXp+=xp;
 let levels=0;
 while(state.xp>=xpForNextLevel(state.level)){state.xp-=xpForNextLevel(state.level);state.level++;levels++;}
 state.pendingLevelUps+=levels;
 return {accepted:true,levels};
}
export const WAVE_BOSS_SET=new Set(BOXE_WAVE.bossesAt);
export function waveDescriptor(number,registry){
 if(!Number.isInteger(number)||number<1)throw Error('INVALID_WAVE');
 const boss=number%BOXE_WAVE.chapterLength===0;
 const ids=Object.keys(registry||{}).filter(id=>registry[id].minWave<=number &&(!registry[id].maxWave||registry[id].maxWave>=number)&&!!registry[id].boss===boss);
 return {wave:number,boss,candidates:ids,spawnEdges:['north','south','east','west']};
}
export const DEFAULT_ROBOTS=Object.freeze({
 scout:{minWave:1,boss:false,behavior:'strafe-shoot',xp:15},
 bruiser:{minWave:3,boss:false,behavior:'aggressive-pursuit',xp:30},
 sentinel:{minWave:6,boss:false,behavior:'ranged-barrage',xp:45},
 bossAlpha:{minWave:5,maxWave:5,boss:true,behavior:'multi-phase',xp:220},
 bossOmega:{minWave:10,maxWave:10,boss:true,behavior:'multi-phase',xp:440},
 bossEndless:{minWave:11,boss:true,behavior:'endless-multi-phase',xp:550}
});
