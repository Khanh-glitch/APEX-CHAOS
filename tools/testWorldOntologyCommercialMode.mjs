import assert from 'node:assert/strict';
import {resolveEffectiveContent as resolve} from './world-ontology/commercialModeContent.reference.mjs';
const equipment={id:'FUTURE_WEAPON',executorId:'native-bullet',
 gameplay:{family:'bullet',damage:12,interval:.2,ammo:5}};
const skinA={id:'FUTURE_WEAPON_GOLD',changes:{
 weaponSprite:'assets:gold',projectileSprite:'assets:goldshot',
 impactVfx:'assets:spark',sfxSet:'assets:goldSound'}};
const skinB={id:'FUTURE_WEAPON_CRYSTAL',changes:{
 weaponSprite:'assets:crystal',streamVfx:'assets:crystalStream'}};
const variant={id:'FUTURE_WEAPON_RAPID',baseId:equipment.id,
 executorId:'native-bullet',changes:[{field:'damage',value:14},{field:'interval',value:.12}]};
const regs={executors:{'native-bullet':{allowedFields:['damage','interval','ammo','family']}}};
const mode=variantPolicy=>({id:'FUTURE_MODE',variantPolicy});
let n=0;
function check(name,fn){try{fn();n++;console.log('PASS '+name);}catch(e){console.error('FAIL '+name);throw e;}}
check('base item works without mode and without commercial assets',()=>{
 const r=resolve({equipment});assert.equal(r.status,'allowed');
 assert.equal(r.gameplay.damage,12);assert.equal(r.gameplayVariantApplied,null);
});
check('visual and effect skins do not modify authoritative gameplay',()=>{
 const a=resolve({equipment,cosmetic:skinA}),b=resolve({equipment,cosmetic:skinB});
 assert.equal(a.status,'allowed');assert.equal(b.status,'allowed');
 assert.deepEqual(a.gameplay,b.gameplay);
 assert.equal(a.fingerprintInput,b.fingerprintInput);
 assert.notDeepEqual(a.presentation,b.presentation);
});
check('character model skin supported as pure presentation',()=>{
 const r=resolve({equipment,cosmetic:{id:'ALT_BODY',changes:{heroModel:'assets:model',animationSet:'assets:motion'}}});
 assert.equal(r.status,'allowed');
});
check('cannot smuggle damage through a cosmetic channel',()=>{
 const r=resolve({equipment,cosmetic:{id:'MALICIOUS',changes:{weaponSprite:'assets:gun',damage:20}}});
 assert.equal(r.status,'denied');assert.equal(r.channel,'damage');
});
check('cannot smuggle collision radius through a cosmetic channel',()=>{
 const r=resolve({equipment,cosmetic:{id:'MALICIOUS',changes:{collisionRadius:10}}});
 assert.equal(r.status,'denied');
});
check('cosmetic payload channel must have approved asset identity',()=>{
 const r=resolve({equipment,cosmetic:{id:'BAD_SKIN',changes:{impactVfx:{damage:100}}}});
 assert.equal(r.status,'denied');
});
check('commercial GameplayVariant requires registered executor contract',()=>{
 const r=resolve({equipment,gameplayVariant:variant,modePolicy:mode('allow')});
 assert.equal(r.status,'unresolved');
});
check('future mode can explicitly allow stat-changing mechanic variant',()=>{
 const r=resolve({equipment,gameplayVariant:variant,modePolicy:mode('allow'),registries:regs});
 assert.equal(r.status,'allowed');assert.equal(r.gameplay.damage,14);
 assert.equal(r.gameplay.interval,.12);assert.equal(r.gameplayVariantApplied,variant.id);
});
check('future mode can normalize gameplay variant to base values',()=>{
 const r=resolve({equipment,cosmetic:skinA,gameplayVariant:variant,
 modePolicy:mode('normalize'),registries:regs});
 assert.equal(r.status,'allowed');assert.equal(r.gameplay.damage,12);
 assert.equal(r.gameplay.interval,.2);assert.equal(r.gameplayVariantApplied,null);
 assert.deepEqual(r.presentation,skinA.changes);
 assert.equal(r.fingerprintInput,resolve({equipment}).fingerprintInput);
});
check('future mode can forbid power variants while ordinary skins remain valid',()=>{
 const r=resolve({equipment,gameplayVariant:variant,modePolicy:mode('deny'),registries:regs});
 assert.equal(r.status,'denied');
 assert.equal(resolve({equipment,cosmetic:skinA}).status,'allowed');
});
check('unknown mode policy never guesses paid balance rights',()=>{
 const r=resolve({equipment,gameplayVariant:variant,modePolicy:mode('ranked'),registries:regs});
 assert.equal(r.status,'unresolved');
});
check('variant with no mode cannot silently apply changes',()=>{
 const r=resolve({equipment,gameplayVariant:variant,registries:regs});
 assert.equal(r.status,'unresolved');
});
check('variant changing an unregistered field fails',()=>{
 const r=resolve({equipment,gameplayVariant:{...variant,
 changes:[{field:'ricochetNew',value:true}]},modePolicy:mode('allow'),registries:regs});
 assert.equal(r.status,'unresolved');
});
check('new mechanic can be admitted through new executor and contract',()=>{
 const reg={executors:{'arc-split-v1':{
   allowedFields:['damage','splitCount'],allowNewMechanicFields:['splitCount']
 }}};
 const v={...variant,executorId:'arc-split-v1',changes:[{field:'splitCount',value:3}]};
 const r=resolve({equipment,gameplayVariant:v,modePolicy:mode('allow'),registries:reg});
 assert.equal(r.status,'allowed');assert.equal(r.gameplay.splitCount,3);
 assert.equal(r.effectiveExecutorId,'arc-split-v1');
});
check('duplicate gameplay knob declarations are rejected',()=>{
 const v={...variant,changes:[{field:'damage',value:20},{field:'damage',value:30}]};
 assert.equal(resolve({equipment,gameplayVariant:v,modePolicy:mode('allow'),registries:regs}).status,'unresolved');
});
check('variant targeting another equipment identity rejected',()=>{
 const v={...variant,baseId:'OTHER'};
 assert.equal(resolve({equipment,gameplayVariant:v,modePolicy:mode('allow'),registries:regs}).status,'unresolved');
});
check('variant/skin cannot mutate source effective weapon definition',()=>{
 const old=JSON.stringify(equipment),s=JSON.stringify(skinA),v=JSON.stringify(variant);
 resolve({equipment,cosmetic:skinA,gameplayVariant:variant,modePolicy:mode('allow'),registries:regs});
 assert.equal(JSON.stringify(equipment),old);
 assert.equal(JSON.stringify(skinA),s);
 assert.equal(JSON.stringify(variant),v);
});
check('result gameplay and presentation are frozen snapshots',()=>{
 const r=resolve({equipment,cosmetic:skinA});
 assert.ok(Object.isFrozen(r.gameplay)&&Object.isFrozen(r.presentation));
});
check('marketplace entitlement is not part of fingerprint authority',()=>{
 const a=resolve({equipment,cosmetic:skinA}),b=resolve({equipment,cosmetic:skinB});
 assert.equal(a.fingerprintInput,b.fingerprintInput);
});
console.log('WORLD ONTOLOGY COMMERCIAL / FUTURE MODE REFERENCE: '+n+'/'+n+' PASS (NOT LIVE STORE OR GAMEPLAY)');
