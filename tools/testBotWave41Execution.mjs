// Real 41-weapon execution audit, not merely a registry or wave-label check.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const win={addEventListener(){},removeEventListener(){}},doc={getElementById(){return null},addEventListener(){},querySelector(){return null}};
win.window=win;win.document=doc;
const context=vm.createContext({window:win,document:doc,console,Math,Date,setTimeout(){return 0},clearTimeout(){}});
for(const path of [
 'public/game/arsenal/arsenalConfig.js',
 'public/game/bot-wave/waveCampaign.js',
 'public/game/bot-wave/armoryRuntime.js'
])vm.runInContext(fs.readFileSync(path,'utf8'),context,{filename:path,timeout:2000});
const config=win.APEX_ARSENAL_CONFIG,campaign=win.APEX_BOT_WAVE_CAMPAIGN;
let totalDamage=0,shots=0,fx=0;
const silent=()=>{fx++};
const engine={
 time:0,player:{x:130,y:0,r:29},projs:[],
 damagePlayer(amount){assert.ok(Number.isFinite(amount)&&amount>=0,'invalid damage '+amount);totalDamage+=amount},
 fx:{flash:silent,streakCone:silent},material:{dust:silent},
 fire:{column:silent}
};
const armory=win.APEX_BOT_WAVE_ARMORY.createArmory({engine,config,campaign,cue:()=>shots++,rand:()=>.5});
const indexed=campaign.indexNative(config);
assert.equal(indexed.records.length,41);
const hitType=new Map();
for(const {id,family} of indexed.records){
 const g=armory.weapons[id];
 assert.ok(g,'missing weapon executor '+id);
 engine.player.x=family==='MELEE'||family==='SHIELD'?90:Math.min(g.range*.5,190);
 engine.player.y=0;
 const foe={id:'qa-'+id,waveGunId:id,x:0,y:0,r:30,angle:0,
  waveFireT:0,waveAmmo:g.mag,waveReloadT:0,dead:false};
 const baseline={damage:totalDamage,projectiles:engine.projs.length,
  special:armory.snapshot().projectiles,shield:foe.waveShieldUntil||0,shots};
 armory.fire(foe,.03);
 assert.equal(shots,baseline.shots+1,'no native attack cue '+id);
 assert.ok(foe.waveAmmo<g.mag,'no magazine consumption '+id);
 assert.ok(foe.waveReloadT>0||foe.waveFireT>0,'no reload/cadence '+id);
 for(const pr of engine.projs.slice(baseline.projectiles))
  for(const key of ['x','y','vx','vy','waveDamage'])assert.ok(Number.isFinite(pr[key]),'bad '+key+' from '+id);
 if(family==='SHIELD')assert.ok(foe.waveShieldUntil>engine.time,'shield fails to activate '+id);
 else if(family==='MELEE')assert.ok(totalDamage>baseline.damage||armory.snapshot().projectiles>baseline.special,'no melee effect '+id);
 else if(family==='SPECIAL')assert.ok(totalDamage>baseline.damage||armory.snapshot().projectiles>baseline.special,'special gun inert '+id);
 else assert.ok(engine.projs.length>baseline.projectiles,'native firearm silent '+id);
 armory.update(.016);
 hitType.set(id,family);
 armory.reset();engine.projs.length=0;
}
assert.equal(hitType.size,41);
for(const id of config.V43_SPECIAL_IDS)assert.equal(hitType.get(id),'SPECIAL');
assert.equal(hitType.get('TOWER_SHIELD'),'SHIELD');
assert.equal(hitType.get('STORMBREAKER'),'MELEE');
console.log('BOT WAVE 41/41 execution PASS: real attack or shield event, finite projectile damage, native cadence/reload, eight V43 special behaviors');
