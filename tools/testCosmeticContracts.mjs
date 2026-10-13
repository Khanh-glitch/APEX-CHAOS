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
const fired={cosmetic:p1,owner:fighter1,weapon,damage:161,blastRadius:130};
fired.owner=fighter2; // simulate reflecting / redirecting an existing carrier
assert.equal(fired.cosmetic.skinId,'neon-a');
const before=JSON.stringify({damage:fired.damage,blastRadius:fired.blastRadius,weapon:fired.weapon});
assert.equal(cosmetics.render('projectile',fakeCanvas,p1,{x:100,y:120,vx:400,vy:30,age:.7,life:.8,kind:'rocket'}),true);
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
assert.match(bridge,/await looks\.ready/);
assert.match(robot,/cosmetic\?\.render\?\.\('actor'/);
assert.match(av,/suppressDefaultBlast/);
assert.match(av,/cosmetic:window\.APEX_COSMETICS/);
dispose();
console.log('COSMETIC CONTRACT PASS: two independent players, frozen projectile looks, original fallback, asset failure, UI, weapon and robot integration');
