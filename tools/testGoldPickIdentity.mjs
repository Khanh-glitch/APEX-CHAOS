import assert from 'node:assert/strict';
import {PRODUCT_ROSTER} from '../src/game/productSurface.js';
import {resolveGoldPickHeroId} from '../src/game/cosmetics/goldPickIdentity.js';

const alias={ROBOT:'NEWBOT',CRYSTAL:'CRYSTALA',ICE:'FROST'};
const definitions=Object.fromEntries(PRODUCT_ROSTER.playableIds.map(id=>[id,{name:id,displayName:alias[id]||id}]));
const roster=Object.fromEntries(PRODUCT_ROSTER.visibleIds.map(id=>{
 const key=(alias[id]||id).toLowerCase();
 return [key,{productionId:id,name:alias[id]||id}];
}));
for(const id of PRODUCT_ROSTER.playableIds){
 for(const label of [id,definitions[id].displayName,definitions[id].displayName.toLowerCase()]){
  assert.equal(resolveGoldPickHeroId(label,{goldRoster:roster,registry:definitions}),id, label);
 }
 assert.equal(resolveGoldPickHeroId(id,{registry:definitions}),id,'registry fallback '+id);
}
assert.equal(resolveGoldPickHeroId('SHURI',{goldRoster:roster,registry:definitions}),'SHURI');
for(const id of PRODUCT_ROSTER.lockedIds){
 assert.equal(resolveGoldPickHeroId(id,{goldRoster:roster,registry:definitions}),null,'locked '+id);
}
for(const label of ['', 'AWAITING FIGHTER', 'INVALID', 'SHURIX']){
 assert.equal(resolveGoldPickHeroId(label,{goldRoster:roster,registry:definitions}),null,label);
}
assert.equal(resolveGoldPickHeroId('FROST',{goldRoster:roster,registry:definitions}),'ICE');
assert.equal(resolveGoldPickHeroId('CRYSTALA',{goldRoster:roster,registry:definitions}),'CRYSTAL');
assert.equal(resolveGoldPickHeroId('NEWBOT',{goldRoster:roster,registry:definitions}),'ROBOT');
console.log('Gold Pick Identity: all playable, aliases, SHURI, locked and invalid labels covered');
