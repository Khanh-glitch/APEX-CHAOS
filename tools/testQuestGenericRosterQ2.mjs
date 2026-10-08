// Q2 selector/roster policy laws — pure; no fake combat assertions.
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../public/game/quest/questMultiActorCore.js',import.meta.url),'utf8');
const root={};vm.runInNewContext(code,{window:root,console,Math,Number,Object,Array,Set});
const Q=root.APEX_QUEST_MULTI_ACTOR_CORE;
let pass=0,fail=0;
function gate(name,ok,detail=''){console.log((ok?'PASS':'FAIL')+' Q2 '+name+(detail?' '+detail:''));if(ok)pass++;else fail++;}
const build=(spec)=>spec.map((x,i)=>({...x,id:i+1,maxHp:x.hp,radius:26}));
for(const [id,allies,hostiles] of [['1v2',1,2],['2v2',2,2],['3v4',3,4]]){
  const spec=Q.fixtureRoster(id),f=build(spec),q=Q.validateRoster(f);
  gate(id+' valid role counts',q.ok&&q.allies===allies&&q.hostiles===hostiles&&q.count===allies+hostiles);
  gate(id+' no friendly fire eligible',f.every(a=>Q.livingEnemies(a,f).every(x=>a.questTeam!==x.questTeam)));
  gate(id+' team independent target count',Q.livingEnemies(f[0],f).length===hostiles&&Q.livingEnemies(f[1],f).length===allies);
  gate(id+' active initial outcome',Q.teamsOutcome(f).status==='ACTIVE');
  for(const x of f)if(x.questTeam==='HOSTILE')x.hp=0;
  gate(id+' all hostile KO complete',Q.teamsOutcome(f).status==='COMPLETE');
  f[0].hp=0;gate(id+' protagonist KO beats victory',Q.teamsOutcome(f).status==='RETRY');
  gate(id+' original fixtures immutable',JSON.stringify(Q.fixtureRoster(id))===JSON.stringify(spec));
}
gate('unknown preset rejected',Q.fixtureRoster('4v99')===null);
const dup=build(Q.fixtureRoster('3v4'));dup[6].questId=dup[5].questId;
gate('duplicate story identity rejected',Q.validateRoster(dup).reason==='duplicate-quest-id');
const dupPhys=build(Q.fixtureRoster('3v4'));dupPhys[6].id=dupPhys[0].id;
gate('duplicate physical identity rejected',Q.validateRoster(dupPhys).reason==='duplicate-physical-id');
const badTeam=build(Q.fixtureRoster('2v2'));badTeam[0].questTeam='HOSTILE';
gate('player on wrong side rejected',Q.validateRoster(badTeam).reason==='missing-newbot');
const invalidHp=build(Q.fixtureRoster('2v2'));invalidHp[0].hp=1001;
gate('invalid hp rejected',Q.validateRoster(invalidHp).reason==='invalid-actor');
const behind=build(Q.fixtureRoster('3v4'));
behind.forEach((a,i)=>{a.x=100+i*80;a.y=300});
const shot=Q.firstProjectileHit({owner:behind[0],actors:behind,from:{x:100,y:300},to:{x:900,y:300},projectileRadius:4});
gate('earliest swept hostile ignores interposed allies',shot?.actor?.questId==='SCRAP-A',shot?.actor?.questId);
const body=build(Q.fixtureRoster('3v4')),slot={x:body[4].x,y:body[4].y};
const pickup=Q.closestEligiblePickup(slot,body,()=>45,(a)=>a.questTeam==='ALLY');
gate('real pickup eligibility delegates to caller',pickup===body[4]);
console.log('Quest Q2 core '+pass+' PASS / '+fail+' FAIL');if(fail)process.exitCode=1;
