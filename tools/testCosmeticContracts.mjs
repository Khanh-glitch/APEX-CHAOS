import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cosmetics } from '../src/game/cosmetics/cosmeticAuthority.js';

// Unique fixture IDs exist solely in the test. Neither hero nor weapon
// changes its registered gameplay definition, tier, damage or physics.
const weapon='FUTURE_ROCKET_SKIN_CONTRACT',hero='FUTURE_HERO_SKIN_CONTRACT';
let changes=0;
const dispose=cosmetics.subscribe(()=>changes++);
const snapshots=[];
const fakeCanvas={
  saves:0,restores:0,save(){this.saves++},restore(){this.restores++},
};
const skinA=cosmetics.register({
  kind:'weapon',baseId:weapon,id:'neon-a',label:'NEON A',
  render:{
    weapon:(_ctx,pose)=>{assert.ok(Object.isFrozen(pose));snapshots.push({kind:'held',pose});return true;},
    projectile:(_ctx,pose)=>{assert.ok(Object.isFrozen(pose));snapshots.push({kind:'travel',pose});return true;},
    blast:(_ctx,pose)=>{assert.ok(Object.isFrozen(pose));snapshots.push({kind:'impact',pose});return true;},
  },suppressBaseBlast:true
});
cosmetics.register({
  kind:'weapon',baseId:weapon,id:'neon-b',label:'NEON B',
  render:{blast:()=>true}
});
cosmetics.register({
  kind:'hero',baseId:hero,id:'hero-alt',label:'Hero Alternate',
  render:{actor:(_ctx,p)=>{snapshots.push({kind:'actor',pose:p});return true;}}
});
assert.equal(skinA.kind,'weapon');
assert.equal(cosmetics.variants('weapon',weapon).length,3);
assert.equal(cosmetics.variants('hero',hero).length,2);
assert.equal(cosmetics.selected('p1','weapon',weapon).id,'default');
assert.equal(cosmetics.selected('p2','weapon',weapon).id,'default');
assert.equal(cosmetics.equip('p1','weapon',weapon,'neon-a').ok,true);
assert.equal(cosmetics.equip('p2','weapon',weapon,'neon-b').ok,true);
assert.equal(cosmetics.equip('p1','hero',hero,'hero-alt').ok,true);
assert.equal(cosmetics.selected('p1','weapon',weapon).id,'neon-a');
assert.equal(cosmetics.selected('p2','weapon',weapon).id,'neon-b');
assert.equal(cosmetics.selected('p1','hero',hero).id,'hero-alt');
assert.equal(cosmetics.selected('p2','hero',hero).id,'default');
assert.equal(cosmetics.equip('p1','weapon',weapon,'unknown').ok,false);
assert.throws(()=>cosmetics.equip('p3','weapon',weapon,'default'),/Invalid cosmetic owner/);
assert.throws(()=>cosmetics.register({kind:'weapon',baseId:weapon,id:'bypass',damage:500}),/forbidden/);
assert.throws(()=>cosmetics.register({kind:'weapon',baseId:weapon,id:'neon-a'}),/Duplicate/);
assert.throws(()=>cosmetics.register({kind:'weapon',baseId:weapon,id:'bad-asset',assets:['https://evil.example/x.png']}),/first-party/);

const fighter1={id:1},fighter2={id:2};
const scope={fighters:[fighter1,fighter2]};
const p1=cosmetics.captureProjectile(fighter1,weapon,scope);
const p2=cosmetics.captureProjectile(fighter2,weapon,scope);
const neutral=cosmetics.captureProjectile({id:3},weapon,scope);
assert.ok(Object.isFrozen(p1));
assert.deepEqual([p1.skinId,p2.skinId,neutral.skinId],['neon-a','neon-b','default']);
// NEW hero bodies and clones use their canonical combatant membership,
// not a six-hero whitelist and not an arbitrary inferred player ID.
const cloneP1={id:'p1-echo'};
const cloneP2={id:'p2-echo'};
const ctP1={idx:0,anchor:fighter1,bodies:[fighter1,cloneP1]};
const ctP2={idx:1,anchor:fighter2,bodies:[fighter2,cloneP2]};
fighter1.__hrCombatant=ctP1;fighter2.__hrCombatant=ctP2;
cloneP1.__hrCombatant=ctP1;cloneP2.__hrCombatant=ctP2;
const combatScope={fighters:[fighter1,fighter2],
  APEX_HERO_REWORK:{byCombatant:body=>body?.__hrCombatant||null}};
assert.equal(cosmetics.captureProjectile(cloneP1,weapon,combatScope).skinId,'neon-a',
  'future summoned P1 body must inherit P1 cosmetic receipt');
assert.equal(cosmetics.captureProjectile(cloneP2,weapon,combatScope).skinId,'neon-b',
  'future summoned P2 body must inherit P2 cosmetic receipt');
// Promoted fighters may replace combatant.anchor while fighters[] retains the
// original retired engine slot. Membership still keeps the right skin.
ctP1.anchor=cloneP1;
assert.equal(cosmetics.captureProjectile(cloneP1,weapon,combatScope).skinId,'neon-a',
  'promoted anchor must not lose its cosmetic identity');
const thirdParty={__hrCombatant:{idx:0,anchor:{},bodies:[]}};
assert.equal(cosmetics.captureProjectile(thirdParty,weapon,combatScope).skinId,'default',
  'non-member body may not impersonate the P1 skin');
assert.equal(cosmetics.sideOf({id:'orphan'},combatScope),null);
assert.equal(cosmetics.sideOf({id:'invalid-index',__hrCombatant:{idx:6}},combatScope),null);

// One battle may contain two visually distinct copies of the SAME weapon and
// hero. Live catalogue edits must affect only the next match, not a held gun,
// hero body or reflected projectile already in motion.
assert.equal(cosmetics.matchActive(),false);
assert.equal(cosmetics.beginMatch(),true);
assert.equal(cosmetics.matchActive(),true);
assert.equal(cosmetics.beginMatch(),false,'repeated scene notification must not overwrite the receipt');
assert.equal(cosmetics.equip('p1','weapon',weapon,'neon-b').ok,true);
assert.equal(cosmetics.equip('p1','hero',hero,'default').ok,true);
assert.equal(cosmetics.selected('p1','weapon',weapon).id,'neon-b','future loadout must update');
assert.equal(cosmetics.capture('p1','weapon',weapon).skinId,'neon-a',
  'held weapon from live match must not change when selection changes');
assert.equal(cosmetics.captureProjectile(cloneP1,weapon,combatScope).skinId,'neon-a',
  'new projectile within existing match must use match appearance');
assert.equal(cosmetics.capture('p1','hero',hero).skinId,'hero-alt',
  'NEWBOT-like actor must retain its skin until exit');
assert.equal(cosmetics.capture('p2','weapon',weapon).skinId,'neon-b',
  'P2 snapshot remains independent');
assert.equal(cosmetics.endMatch(),true);
assert.equal(cosmetics.matchActive(),false);
assert.equal(cosmetics.capture('p1','weapon',weapon).skinId,'neon-b',
  'next match should pick up the newly-equipped appearance');
assert.equal(cosmetics.capture('p1','hero',hero).skinId,'default');
cosmetics.equip('p1','weapon',weapon,'neon-a');
cosmetics.equip('p1','hero',hero,'hero-alt');

const fired={cosmetic:p1,owner:fighter1,weapon,damage:161,blastRadius:130};
fired.owner=fighter2; // simulate reflecting / redirecting an existing carrier
assert.equal(fired.cosmetic.skinId,'neon-a');
const before=JSON.stringify({damage:fired.damage,blastRadius:fired.blastRadius,weapon:fired.weapon});
assert.equal(cosmetics.render('projectile',fakeCanvas,p1,{x:100,y:120,vx:400,vy:30,age:.7,life:.8,kind:'rocket'}),true);
assert.equal(cosmetics.render('projectile',fakeCanvas,p1,
  {x:100,y:120,vx:450,vy:0,maxLife:2,life:1.5,type:'aq_bullet'}),true);
assert.equal(snapshots.at(-1).pose.age,.5,
  'ordinary bullets need a monotonic cosmetic age without new gameplay timers');
assert.equal(snapshots.at(-1).pose.kind,'aq_bullet',
  'non-V43 projectiles must have a typed cosmetic render identity');
assert.equal(cosmetics.render('blast',fakeCanvas,p1,{x:400,y:420,life:.9,kind:'rocket'}),true);
assert.equal(cosmetics.render('weapon',fakeCanvas,p1,{width:155,height:50,kind:weapon}),true);
assert.equal(cosmetics.render('actor',fakeCanvas,cosmetics.capture('p1','hero',hero),{kind:hero}),true);
assert.equal(cosmetics.render('blast',fakeCanvas,p2,{x:400,y:420}),true);
assert.equal(cosmetics.render('blast',fakeCanvas,neutral,{x:400,y:420}),false);
assert.equal(cosmetics.suppressDefaultBlast(p1),true);
assert.equal(cosmetics.suppressDefaultBlast(p2),false);
assert.equal(cosmetics.suppressDefaultBlast(neutral),false);
assert.equal(fakeCanvas.saves,fakeCanvas.restores,'presentation save/restore imbalance');
assert.equal(JSON.stringify({damage:fired.damage,blastRadius:fired.blastRadius,weapon:fired.weapon}),before);
assert.ok(snapshots.every(s=>Object.isFrozen(s.pose)));
assert.ok(changes>=5);

// Real asset gate must not return READY if a selected image fails to decode.
cosmetics.register({kind:'hero',baseId:'FUTURE_ASSET_CANARY',id:'broken',assets:['/assets/test/future-missing.webp']});
const previousImage=globalThis.Image;
let rejected=false,downloads=0;
globalThis.Image=class FakeImage {
  set src(v){downloads++;setImmediate(()=>this.onerror?.(new Error('test decode rejected')))}
};
try{
  cosmetics.equip('p1','hero','FUTURE_ASSET_CANARY','broken');
  await cosmetics.ready([{side:'p1',heroId:'FUTURE_ASSET_CANARY'}]).then(
    ()=>{throw Error('readiness bypassed missing skin artwork')},
    e=>{rejected=/Skin asset failed/.test(String(e))}
  );
  assert.equal(rejected,true);
}finally{globalThis.Image=previousImage}
assert.equal(downloads,1,'missing asset attempted more than once during one load');

// The skin callback must consume the EXACT centrally decoded texture, never
// initialize its own image on its first visual cast or access other packs.
cosmetics.equip('p1','hero','FUTURE_ASSET_CANARY','default');
const decodedPath='/assets/test/future-ready.webp';
let reads=0, decodeCount=0, renderCount=0;
cosmetics.register({
  kind:'hero',baseId:'FUTURE_DECODE_CANARY',id:'decoded',assets:[decodedPath],
  render:{actor:(_ctx,_pose,resources)=>{
    renderCount++;
    assert.ok(Object.isFrozen(resources),'renderer asset accessor must be read-only');
    assert.equal(resources.get('/assets/test/not-owned.webp'),null,
      'a skin cannot read another pack asset');
    return resources.get(decodedPath)?.naturalWidth===64;
  }}
});
cosmetics.equip('p1','hero','FUTURE_DECODE_CANARY','decoded');
const decodedReceipt=cosmetics.capture('p1','hero','FUTURE_DECODE_CANARY');
assert.equal(cosmetics.render('actor',fakeCanvas,decodedReceipt,{kind:'FUTURE_DECODE_CANARY'}),false,
  'before READY a skin must fall back instead of making an opportunistic fetch');
globalThis.Image=class DecodedImage {
  naturalWidth=64;
  complete=true; // synchronous cache hit followed by a real async load event
  decode(){decodeCount++;return Promise.resolve()}
  set src(v){reads++;setImmediate(()=>this.onload?.())}
};
try{
  await Promise.all(Array.from({length:8},()=>cosmetics.ready([
    {side:'p1',heroId:'FUTURE_DECODE_CANARY'}
  ])));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(reads,1,'eight concurrent READY requests must use one image loader');
  assert.equal(decodeCount,1,
    'cached-complete plus later native load must still decode the same texture exactly once');
  assert.equal(cosmetics.render('actor',fakeCanvas,decodedReceipt,{kind:'FUTURE_DECODE_CANARY'}),true);
  assert.equal(reads,1,'rendering must reuse decoded artwork without fetching');
  await cosmetics.ready([{side:'p1',heroId:'FUTURE_DECODE_CANARY'}]);
  assert.equal(decodeCount,1,'re-entering a match must not re-decode a READY asset');
}finally{
  globalThis.Image=previousImage;
  cosmetics.equip('p1','hero','FUTURE_DECODE_CANARY','default');
}
assert.ok(renderCount>=2);
assert.equal(fakeCanvas.saves,fakeCanvas.restores,'canvas save/restore leaked after asset hooks');


// Static integration: a product menu and both physical carriers must use
// the exact cosmetic authority; never inject a separate skin gun/hero registry.
const file=p=>fs.readFileSync(p,'utf8');
const app=file('src/App.jsx'),product=file('src/game/productSurface.js');
const gun=file('public/game/arsenal/arsenalWeaponRuntime.js');
const bridge=file('public/game/gold/goldProductBridge.js');
const robot=file('public/game/hero-rework/robotPresentationRuntime.js');
const av=file('public/game/arsenal/arsenalPresentationRuntime.js');
assert.match(product,/surface\('cosmetic-locker',[^\n]*ACTIVE/);
assert.match(app,/CosmeticLocker/);
assert.match(gun,/captureProjectile\?\.\(f,id\)/);
assert.match(gun,/captureProjectile\?\.\(owner,weapon\)/);
assert.match(gun,/function v43SpawnChild\(parent,kind,angle,extra=/,
  'secondary physical projectiles need one generic source receipt');
assert.match(gun,/cosmetic:parent\.cosmetic\|\|null/,
  'child appearance must derive from original projectile, not current owner');
assert.match(gun,/v43SpawnChild\(p,'fragment'/);
assert.match(gun,/v43SpawnChild\(p,'plasma'/);
assert.match(gun,/if \(p\.type === 'aq_bullet'\)/);
assert.equal((gun.match(/APEX_COSMETICS\?\.render\?\.\('projectile'/g)||[]).length,1,
  'all physical projectile types must share ONE cosmetic dispatch');
assert.match(bridge,/await looks\.ready/);
assert.match(bridge,/APEX_COSMETICS\?\.beginMatch\?\.\(\)/,
  'cosmetic session must start at real battle authority');
assert.match(bridge,/APEX_COSMETICS\?\.endMatch\?\.\(\)/,
  'cosmetic session must be torn down at battle exit');
assert.match(robot,/cosmetic\?\.render\?\.\('actor'/);
assert.match(av,/suppressDefaultBlast/);
assert.match(av,/cosmetic:window\.APEX_COSMETICS/);
dispose();
console.log('COSMETIC CONTRACT PASS: two independent players, frozen projectile looks, original fallback, asset failure, UI, weapon and robot integration');
