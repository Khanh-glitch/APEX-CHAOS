// Strict semantic and allocation-proxy check for the real production V43
// enemy selection. This logic runs in weapon physics across all fighters.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
const source=fs.readFileSync('public/game/arsenal/arsenalWeaponRuntime.js','utf8');
const pos=source.indexOf('  function v43Enemies(owner){');
const end=source.indexOf('  // All collision consumers',pos);
assert.ok(pos>0&&end>pos,'Production enemy query must be found');
const sourceFn=source.slice(pos,end);
function compiled(source){
  const ctx=vm.createContext({AQ:{state:{}},fighters:[],window:{APEX_QUEST_MULTI_ACTOR_CORE:{livingEnemies:()=>[]}}});
  const fn=vm.runInContext(source+'; v43Enemies',ctx);
  return {ctx,fn};
}
const old=compiled(`function v43Enemies(owner){
  const list=AQ.state?.questMultiActor===true
    ?window.APEX_QUEST_MULTI_ACTOR_CORE?.livingEnemies?.(owner,fighters)
    :fighters.filter(f=>f&&f!==owner&&f.hp>0);
  return (list||[]).filter(f=>f&&f.hp>0&&f.withdrawn!==true
    &&(!AQ.state?.questMultiActor||f.questTeam!==owner?.questTeam));
}`);
const cur=compiled(sourceFn);
const all=[null,undefined, ...Array.from({length:85},(_,i)=>({
  id:i,hp:[100,0,-5,NaN,undefined,1][i%6],
  withdrawn:i%7===0,questTeam:i%3,
}))];
const runs=[];
for(const mode of [false,true,1,null]){
  for(let offset=0;offset<all.length;offset+=7){
    const fighters=[...all.slice(offset),...all.slice(0,offset)];
    const owner=fighters.find(x=>x?.hp>0) || undefined;
    const quest=fighters.filter((_,i)=>i%3!==0);
    for(const fixture of [old,cur]){
      fixture.ctx.AQ.state.questMultiActor=mode;
      fixture.ctx.fighters=fighters;
      fixture.ctx.window.APEX_QUEST_MULTI_ACTOR_CORE.livingEnemies=()=>quest;
    }
    const a=Array.from(old.fn(owner)),b=Array.from(cur.fn(owner));
    assert.deepEqual(b.map(x=>x.id),a.map(x=>x.id),'same ordered combatants for '+mode+' '+offset);
    runs.push([owner,mode,fighters,quest]);
  }
}
const fixture=all.filter(x=>x&&x.hp>0);
for(const f of [old,cur]){f.ctx.AQ.state.questMultiActor=false;f.ctx.fighters=fixture;}
const run=(f)=>{let n=0;const t0=performance.now();for(let i=0;i<150000;i++)n+=f.fn(fixture[i%fixture.length]).length;return {ms:performance.now()-t0,n};};
run(old);run(cur);
const before=run(old),after=run(cur);
assert.equal(after.n,before.n);
console.log(JSON.stringify({test:'V43 real production eligibility',cases:runs.length,orderedParity:'PASS',beforeMs:+before.ms.toFixed(2),afterMs:+after.ms.toFixed(2),ratio:+(before.ms/after.ms).toFixed(2),note:'CPU microbench only; not GPU/game FPS'}));
