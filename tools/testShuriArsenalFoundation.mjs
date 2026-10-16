// SHURI admission: guard shared Arsenal classification and holder lifecycle
// against future weapons/hero integrations. Deliberately no special game loop.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const identity=fs.readFileSync('public/game/arsenal/arsenalIdentityRuntime.js','utf8');
const runtime=fs.readFileSync('public/game/arsenal/arsenalWeaponRuntime.js','utf8');
const V43={
  RPG_7:{tier:'T3',kind:'rocket',family:'SPECIAL'},
  FLARE_GUN:{tier:'T2',kind:'flare',family:'SPECIAL'},
  TACTICAL_CROSSBOW:{tier:'T2',kind:'bolt',family:'SPECIAL'},
  STEEL_BALL_LAUNCHER:{tier:'T2',kind:'ball',family:'SPECIAL'},
  COMBAT_BOOMERANG:{tier:'T2',kind:'boomerang',family:'SPECIAL'},
  FLAMETHROWER:{tier:'T3',kind:'flame',family:'SPECIAL'},
  PLASMA_SPLITTER:{tier:'T4',kind:'plasma',family:'SPECIAL'},
  SHRAPNEL_MINE_LAUNCHER:{tier:'T4',kind:'mine',family:'SPECIAL'}
};
const ids=['PISTOL','SNIPER','GRENADE','DAGGER','SABRE','BATTLE_AXE','SPEAR','SPIKED_CLUB','STORMBREAKER','SWIRL_SHIELD','TOWER_SHIELD',...Object.keys(V43)];
const WEAPONS=Object.fromEntries(ids.map(id=>[id,{tier:null,worldRoles:null}]));
const cfg={
 WEAPONS, V43_WEAPONS:V43,V43_SPECIAL_IDS:Object.keys(V43),
 GUN_REGISTRY:[{id:'PISTOL'},{id:'SNIPER'}],
 MELEE_WEAPON_IDS:['DAGGER','SABRE','BATTLE_AXE','SPEAR','SPIKED_CLUB'],
 THROWN_MELEE:{},
 STORMBREAKER:{throwSpeed:1350},
};
const context={window:{APEX_ARSENAL_CONFIG:cfg},console,Math,Object,Array};
vm.runInNewContext(identity,context,{filename:'arsenalIdentityRuntime.js'});
for(const id of ['PISTOL','SNIPER','RPG_7','FLAMETHROWER','PLASMA_SPLITTER','TACTICAL_CROSSBOW','SHRAPNEL_MINE_LAUNCHER','STEEL_BALL_LAUNCHER','FLARE_GUN']){
 assert.equal(cfg.isGunOrLauncher(id),true,id+' should be eligible');
 assert.equal(cfg.isMountableFloorGun({weaponId:id,kind:'WEAPON',phase:'REVEALED'}),true,id+' floor');
}
for(const id of ['COMBAT_BOOMERANG','GRENADE','DAGGER','SABRE','BATTLE_AXE','SPEAR','SPIKED_CLUB','STORMBREAKER','SWIRL_SHIELD','TOWER_SHIELD']){
 assert.equal(cfg.isGunOrLauncher(id),false,id+' must not be eligible');
}
assert.equal(cfg.isMountableFloorGun({weaponId:'PISTOL',kind:'WEAPON',phase:'TELEGRAPH'}),false);
assert.equal(cfg.isMountableFloorGun({weaponId:'PISTOL',kind:'HEAL',phase:'REVEALED'}),false);
assert.equal(cfg.isMountableFloorGun({weaponId:'PISTOL',kind:'WEAPON',phase:'REVEALED',heroInteractionImmune:true}),false);
assert.equal(cfg.isGunOrLauncher('UNKNOWN'),false);
// The shared lifecycle event must be wired to standard disposal AND alternate
// boomerang retrieval, but must not grant Scrap directly within Arsenal.
assert.match(runtime,/emit\('ArsenalHolderEnded'/);
assert.match(runtime,/reason: 'boomerang-retrieved', completion: true/);
assert.match(runtime,/completion: \['sequence-complete','shot-fired','blast-resolved'\]\.includes\(reason\)/);
assert.doesNotMatch(runtime,/grantScrap|shuriScrap\s*\+=/i);
console.log('SHURI CP1 Arsenal capability & lifecycle contract PASS');
