#!/usr/bin/env node
/**
 * Anti-patchwork property: registering a new ranged WEAPON definition must
 * make Magnet A1/A2 and arena emergency-supply logic understand its holder,
 * without adding a version-specific if/else, BUT never grant magnetism to
 * its unregistered projectile or ordinary bullet damage-family semantics.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bootHarness } from './lib/crystalaHarness.mjs';
import { BASE_WEAPON_IDS } from './lib/contentBaseline.mjs';

const {win}=await bootHarness(),cfg=win.APEX_ARSENAL_CONFIG;
const weapons=win.APEX_ARSENAL_WEAPONS,mag=win.APEX_MAGNET;
assert.ok(weapons && cfg && mag);
assert.equal(typeof cfg.isRangedEquipment,'function');
let scenarios=0;
for(const id of BASE_WEAPON_IDS){
  const expected=weapons[id]?.category==='ranged';
  assert.equal(cfg.isRangedEquipment(id),expected,'canonical equipment ID '+id);
  scenarios++;
}
for(const id of cfg.V43_SPECIAL_IDS){
  assert.equal(cfg.isRangedEquipment(id),true,id+' must count as real ranged equipment');
  assert.equal(mag.isEligibleFloorFirearm({phase:'REVEALED',kind:'WEAPON',weaponId:id}),true);
  assert.equal(cfg.isGun(id),false,id+' retains distinct conventional-gun executor/crit law');
  scenarios+=3;
}
for(const id of ['STORMBREAKER','SABRE','TOWER_SHIELD','SWIRL_SHIELD','GRENADE','MISSING']){
  assert.equal(cfg.isRangedEquipment(id),false,'never synthesize ranged category for '+id);
  assert.equal(mag.isEligibleFloorFirearm({phase:'REVEALED',kind:'WEAPON',weaponId:id}),false);
  scenarios+=2;
}
assert.equal(Object.isExtensible(weapons),true,
  'the admission contract must permit registering real future WEAPONS definitions');
const future='CONTENT_FUTURE_RANGED_PROBE';
assert.equal(weapons[future],undefined);
assert.equal(cfg.isRangedEquipment(future),false);
assert.equal(mag.isEligibleFloorFirearm({phase:'REVEALED',kind:'WEAPON',weaponId:future}),false);
try{
  weapons[future]={category:'ranged',family:'FUTURE_SPECIAL',testOnly:true};
  assert.equal(cfg.isRangedEquipment(future),true,
    'new ranged equipment inherits its category WITHOUT changing any hero code');
  const liveSlot={kind:'WEAPON',phase:'REVEALED',weaponId:future,x:430,y:450};
  assert.equal(mag.isEligibleFloorFirearm(liveSlot),true,
    'Magnet recognizes future holder by category, not V43 version name');
  assert.equal(mag.isEligibleFloorFirearm({...liveSlot,phase:'TELEGRAPH'}),false);
  assert.equal(cfg.isGun(future),false,
    'a future special does NOT become a conventional bullet-family gun');
  assert.equal(mag.isEligibleBullet({aq:true,type:'aq_bullet',
      weapon:future,life:1,x:500,y:500,vx:100,vy:0}),false,
    'accepting the holder cannot imply its projectile is metallic or conventional');
  assert.equal(mag.isEligibleBullet({aq:true,type:'aq_v43',kind:'plasma',
      weapon:future,phase:'flight',life:1,x:500,y:500,vx:100,vy:0}),false,
    'unregistered future projectile must fail closed');
  scenarios+=9;
}finally{
  delete weapons[future];
}
assert.equal(cfg.isRangedEquipment(future),false,'test fixture must clean up registry');
// A classifier's only input is the shared equipped-weapon definition.
// No version IDs or duplicated gun classification should reappear in consumers.
const magnetSource=fs.readFileSync('public/game/hero-rework/magnetGameplayRuntime.js','utf8');
const arenaSource=fs.readFileSync('public/game/modes/arsenalBattleRuntime.js','utf8');
assert.match(magnetSource,/cfg\?\.isRangedEquipment\?\.\(slot.weaponId\)/);
assert.match(arenaSource,/CFG\.isRangedEquipment\?\.\(id\)/);
assert.doesNotMatch(magnetSource.slice(
  magnetSource.indexOf('function isEligibleFloorFirearm'),
  magnetSource.indexOf('function isEligibleBullet')),
  /V43_WEAPONS|V43_SPECIAL_IDS|isFirearm\(/,
  'floor-holder classification cannot regress to projectile/executor families');
scenarios+=3;
console.log('EQUIPMENT SEMANTIC CONTRACT '+scenarios+'/'+scenarios+
  ' PASS (current roster + hypothetical future gun, no new hero patch)');
