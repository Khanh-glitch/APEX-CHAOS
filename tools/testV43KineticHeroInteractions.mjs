// Regression guard: Magnet A2 distinguishes material objects from energy.
// Runs the actual shipping runtime, not a rewritten classifier.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const specials={
 TACTICAL_CROSSBOW:{tier:'T2',magnetizableKinds:['bolt']},
 STEEL_BALL_LAUNCHER:{tier:'T2',magnetizableKinds:['ball']},
 COMBAT_BOOMERANG:{tier:'T2',magnetizableKinds:['boomerang']},
 RPG_7:{tier:'T3',magnetizableKinds:['rocket']},
 SHRAPNEL_MINE_LAUNCHER:{tier:'T4',magnetizableKinds:['mine','fragment']},
 FLAMETHROWER:{tier:'T3',magnetizableKinds:[]},
 FLARE_GUN:{tier:'T2',magnetizableKinds:[]},
 PLASMA_SPLITTER:{tier:'T4',magnetizableKinds:[]}
};
const root={APEX_ARSENAL_CONFIG:{isGun:id=>id==='PISTOL',V43_WEAPONS:specials}};
const ctx=vm.createContext({window:root,globalThis:root,console});
vm.runInContext(fs.readFileSync('public/game/hero-rework/magnetGameplayRuntime.js','utf8'),ctx);
const A=root.APEX_MAGNET;
assert.equal(typeof A?.isEligibleBullet,'function','actual Magnet contract missing');
const proj=(kind,weapon,type='aq_v43',more={})=>({aq:true,type,kind,weapon,life:1,...more});
const tests=[
 ['ordinary pistol',proj('shot','PISTOL','aq_bullet'),true],
 ['crossbow bolt',proj('bolt','TACTICAL_CROSSBOW'),true],
 ['steel ball',proj('ball','STEEL_BALL_LAUNCHER'),true],
 ['RPG rocket',proj('rocket','RPG_7'),true],
 ['actual boomerang',proj('boomerang','COMBAT_BOOMERANG'),true],
 ['metal mine fragment',proj('fragment','SHRAPNEL_MINE_LAUNCHER'),true],
 ['flying metal mine',proj('mine','SHRAPNEL_MINE_LAUNCHER','aq_v43',{phase:'flight'}),true],
 ['armed stationary mine',proj('mine','SHRAPNEL_MINE_LAUNCHER','aq_v43',{phase:'armed'}),false],
 ['flamethrower',proj('flame','FLAMETHROWER'),false],
 ['flare thermal shot',proj('flare','FLARE_GUN'),false],
 ['burn status',proj('burn','FLARE_GUN'),false],
 ['plasma core',proj('plasma-core','PLASMA_SPLITTER'),false],
 ['plasma shard',proj('plasma','PLASMA_SPLITTER'),false],
 ['immune Stormbreaker',proj('shot','STORMBREAKER','aq_bullet'),false],
 ['expired rocket',proj('rocket','RPG_7','aq_v43',{life:0}),false],
 ['crystal-held rocket',proj('rocket','RPG_7','aq_v43',{__hr:{cryHold:true}}),false],
 ['untrusted projectile',proj('rocket','RPG_7','aq_v43',{aq:false}),false]
];
for(const [name,projectile,expected] of tests){
 const got=A.isEligibleBullet(projectile);
 assert.equal(got,expected,name);
 console.log('PASS MAGNET KINETIC '+name);
}
const cfg=fs.readFileSync('public/game/arsenal/arsenalConfig.js','utf8');
for(const [id,spec] of Object.entries(specials)){
 const i=cfg.indexOf(id+':Object.freeze(');
 assert.ok(i>=0,'registry must define '+id);
 const record=cfg.slice(i,i+630).replace(/\s+/g,'');
 const serialized="magnetizableKinds:["+spec.magnetizableKinds.map(x=>"'"+x+"'").join(',')+"]";
 assert.ok(record.includes(serialized),'actual registry kinetic policy drift: '+id);
}
const c=fs.readFileSync('public/game/hero-rework/crystalGameplayRuntime.js','utf8');
assert.match(c,/p\?\.type==='aq_v43'/,'Crystala remains V43-aware');
assert.match(c,/p\.type!=='aq_bullet'&&!v43/,'Crystala threat gate must allow specials');
const spawn=fs.readFileSync('public/game/arsenal/arsenalSpawnRuntime.js','utf8');
assert.match(spawn,/CFG\.BY_TIER\?\.T1/);
assert.match(spawn,/CFG\.BY_TIER\?\.T2/);
assert.doesNotMatch(spawn,/const questWeaponPool\s*=\s*\[[^\]]*FLARE_GUN/);
const weapons=fs.readFileSync('public/game/arsenal/arsenalWeaponRuntime.js','utf8');
assert.match(weapons,/function v43Splash\(p,peak,radius\)/);
assert.match(weapons,/const factor=v43min\(1-d\/range,0,1\)/);
assert.match(weapons,/v43Deal\(p,f,peak\*factor,\{/);
assert.match(weapons,/function v43Deal\(p,target,amount,opts=\{\}\)/);
// Same physical boomerang in hand and in flight — never a tiny fallback V.
assert.match(weapons,/boomerang:'COMBAT_BOOMERANG'/);
assert.match(weapons,/p\.kind==='boomerang'\?c\.worldWidth/);
assert.ok(fs.existsSync('public/assets/arsenal/v43/COMBAT_BOOMERANG.webp'),
  'boomerang flight must load the actual delivered art');
console.log('V43 INTERACTION CONTRACT PASS '+tests.length+' kinetic/energy cases + Crystal + auto-Quest T1/T2 + radial AoE');
