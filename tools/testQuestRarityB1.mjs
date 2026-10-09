import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const s=fs.readFileSync(new URL('../public/game/arsenal/arsenalSpawnRuntime.js',import.meta.url),'utf8');
const extract=(a,b)=>s.slice(s.indexOf(a),s.indexOf(b));
const source=extract('  const isQuestWeaponContext=','  function trySpawnSlot(')
  +'\n'+extract('  function weightFor(', '  function revealSlot(');
const cfg={
  BY_TIER:{T1:['PISTOL','GLOCK_17'],T2:['SMG','SABRE'],
    T3:['SNIPER'],T6:['STORMBREAKER']},
  OFFENSIVE_WEAPON_IDS:['PISTOL','GLOCK_17','SMG','SABRE','SNIPER','STORMBREAKER'],
  GUN_REGISTRY:[{id:'PISTOL'},{id:'GLOCK_17'},{id:'SMG'},{id:'SNIPER'}],
  tierOf:(id)=>({'PISTOL':'T1','GLOCK_17':'T1','SMG':'T2','SABRE':'T2','SNIPER':'T3','STORMBREAKER':'T6'})[id]||null,
  isOffensive:(id)=>['PISTOL','GLOCK_17','SMG','SABRE','SNIPER','STORMBREAKER'].includes(id),
  isGun:(id)=>['PISTOL','GLOCK_17','SMG','SNIPER'].includes(id),
  selectOffensiveWeapon:()=>({id:'STORMBREAKER'})
};
const AQ={state:{questMultiActor:true}};
const ctx={CFG:cfg,AQ,Math,window:{},Number};
vm.runInNewContext(source+'\nwindow.pick=selectSpawnWeapon;window.fire=selectFirearmWeapon;',ctx);
const pick=ctx.window.pick,fire=ctx.window.fire;
let n=0;const gate=(name,v)=>{assert.ok(v,name);n++;console.log('PASS B1 '+name)};
gate('Quest all hundreds of normal slots are white or green',
  Array.from({length:800},(_,i)=>cfg.tierOf(pick(()=>i/800))).every(t=>t==='T1'||t==='T2'));
gate('Quest forced firearm never exceeds green',
  Array.from({length:800},(_,i)=>cfg.tierOf(fire(()=>i/800))).every(t=>t==='T1'||t==='T2'));
gate('Quest excludes non-gun from emergency firearm',Array.from({length:80},
  (_,i)=>fire(()=>i/80)).every(id=>cfg.isGun(id)));
AQ.state={questMultiActor:false,questReflex:false};
gate('Free Battle original T6 selection left unchanged',pick(()=>0.7)==='STORMBREAKER');
gate('physical reveal keeps T1/T2 barrier for ordinary Quest weapons',
  s.includes("if(isQuestWeaponContext()&&!slot.questNarrativeOnly")
  &&/&&\s*!questTierAllowed\(slot\.weaponId\)\)/.test(s));
gate('only E01 safe hold may create narrative Stormbreaker T6 exception',
  s.includes("state.questReflexHold?.phase==='AWAIT_RIVET'")
  &&s.includes("opts?.questStage==='E01_GROUND_SUPPRESSION'")
  &&s.includes("opts?.questWeaponId==='STORMBREAKER'")
  &&s.includes("questNarrativeOnly:!!forcedStoryStorm"));
gate('Quest narrative T6 cannot be physically picked up by any fighter',
  (s.match(/if\(slot\.questNarrativeOnly===true\)continue;/g)||[]).length>=2);

gate('Quest auto-counter cannot create untiered shield',
  s.includes("state.questReflex!==true&&state.questMultiActor!==true"));
console.log('B1 Quest rarity '+n+' PASS / 0 FAIL');
