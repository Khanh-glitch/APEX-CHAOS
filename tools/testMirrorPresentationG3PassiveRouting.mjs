#!/usr/bin/env node
/* G3 — real F1 state / F2 escrow-event presentation adapter gates. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const listeners = new Map();
const bus = {
  on(type, fn) { const a = listeners.get(type) || []; a.push(fn); listeners.set(type, a); return () => a.splice(a.indexOf(fn), 1); },
  emit(type, payload = {}) { for (const fn of (listeners.get(type) || []).slice()) fn({ type, payload }); },
};
const blankShard = () => ({ on:false, st:0, x:0, y:0, vx:0, vy:0, age:0, fx:0, fy:0, tx:0, ty:0, mt0:0, moving:false });
const blankNode = () => ({ on:false, st:0, x:0, y:0, rot:0, t:0, age:0, tlock:-1, t3:0, fill:0, fold:0, sh:[],
  img:{on:false,k:0,t:0,d:1,ang:0,dx:1,dy:0,pw:1}, rp:[{t:9,x:0,y:0},{t:9,x:0,y:0},{t:9,x:0,y:0}], sw:[] });
let drawShards = 0, drawNodes = 0, instancesMade = 0;
function goldInstance() {
  const SH = Array.from({length:16}, blankShard), ND = Array.from({length:4}, blankNode);
  return { SH, ND, PJ:Array.from({length:16},()=>({on:false})), A1:{on:false}, A2:{on:false,res:0},
    enableExternalTruth(){return true;}, clearExternalTruth(){return true;}, syncExternalTruth(){return true;}, stepExternalPresentation(){return true;},
    externalAudit(){return {enabled:true};}, beginExternalA1(){return true;}, beginExternalA2(){return true;}, endExternalA1(){return true;}, endExternalA2(){return true;},
    applyExternalExchange(){return true;}, markExternalA1Whiff(){return true;}, weaponArt(){return null;}, setWeaponArt(){return null;},
    drawFreeShard(){drawShards++;}, drawNodeBody(){drawNodes++;}, drawA1World(){}, drawResidue(){},
    nodeRipple(n,x,y){ n.rp[0] = {t:0,x:x-n.x,y:y-n.y}; },
  };
}
const HR = { match:null, byCombatant(b){return b.__ct;}, mirrorNode:null };
const context = { console, Math, Map, Set, Array, Object, Number, Float32Array,
  APEX_HERO_REWORK:HR, APEX_HERO_REWORK_AIL:{bus}, APEX_MIRROR_GOLD:{createMirrorInstance(){instancesMade++; return goldInstance();}} };
context.globalThis = context;
vm.runInNewContext(fs.readFileSync('public/game/hero-rework/mirrorPresentationRuntime.js','utf8'), context);
const api = context.APEX_MIRROR_PRESENTATION;
const body = (id,x,y) => ({id,x,y,hp:100,data:{},dir:{x:1,y:0},__hrFrameStart:{x,y}});
const ct = (idx,id='MIRROR') => { const anchor=body(idx+1,100+idx*300,200); const c={idx,heroId:id,anchor,facade:false,store:{}}; anchor.__ct=c; return c; };
const m0=ct(0), m1=ct(1); HR.match={combatants:[m0,m1],world:{mirrorF2:{escrow:[],nodeSeq:0}}};
const passive = (c) => c.store['mirror.passive']={slots:Array(16).fill(null),nodes:[],scanT:0};
const p0=passive(m0), p1=passive(m1);
bus.emit('ReworkMatchInstall',{});
const run=()=>api.tick(1/120);
let pass=0; const gate=(name,fn)=>{fn(); pass++; console.log(`PASS ${name}`);};
const shard=(x,y,st=0)=>({on:true,st,node:null,x,y,vx:4,vy:5,age:1,fx:x-1,fy:y-1,tx:x+2,ty:y+3,mt0:.18,moving:st===1,prov:{hitX:x-4,hitY:y-5,dirX:0,dirY:1,weaponId:'AK'}});
const node=(id,x,y,rot,st=1,slots=[])=>({id,owner:m0,x,y,rot,st,t:.8,age:.2,t3:0,tlock:.6,sh:slots});
p0.slots[3]=shard(123,234); run();
gate('G3-01 one FREE slot -> one proxy',()=>assert.equal(api.inspect().records[0].passive.visibleSlots,1));
p0.slots[3]=null; run(); gate('G3-02 empty slot off',()=>assert.equal(api.inspect().records[0].passive.slots[3].on,false));
p0.slots[4]=shard(222,333,1); run(); gate('G3-03 assembling exact coordinates',()=>{const s=api.inspect().records[0].passive.slots[4];assert.equal(`${s.i},${s.on},${s.st},${s.x},${s.y}`,'4,true,1,222,333');});
const five=[0,1,2,3,4].map((i)=>shard(300+i,400+i,1)); five.forEach((s,i)=>p0.slots[i]=s); p0.nodes=[node(10,302,402,.2,1,five)]; five.forEach(s=>s.node=p0.nodes[0]); run();
gate('G3-04 five slots map one node without gameplay mutation',()=>{assert.equal(api.inspect().records[0].passive.nodes[0].shards,5);assert.equal(p0.nodes.length,1);});
gate('G3-05 real state controls FORMING/ACTIVE/FOLD',()=>{for(const st of [1,2,3]){p0.nodes[0].st=st;run();assert.equal(api.inspect().records[0].passive.nodes[0].st,st);}});
p0.nodes=[node(10,100,100,0,2,[]),node(11,200,200,.2,2,[]),node(12,300,300,-.2,3,[])];run();
gate('G3-06 three nodes independent',()=>assert.equal(api.inspect().records[0].passive.visibleNodes,3));
gate('G3-07 no synthetic fourth gameplay node',()=>assert.equal(p0.nodes.length,3));
p1.slots[0]=shard(777,888);p1.nodes=[{...node(21,700,700,.1,2,[]),owner:m1}];run();
gate('G3-08 Mirror-v-Mirror isolation',()=>{const r=api.inspect().records;assert.equal(r[0].passive.slots[0].x,300);assert.equal(r[1].passive.slots[0].x,777);});
gate('G3-09 P17 adapter requires shared authority',()=>{const source=fs.readFileSync('public/game/hero-rework/mirrorPresentationRuntime.js','utf8');const gold=fs.readFileSync('public/game/hero-rework/mirrorGoldV1.js','utf8');assert.match(source,/HR && HR\.mirrorNode/);assert.match(source,/geometry\.toWorld\(node, 1, 0\)/);assert.match(gold,/n\.worldTransform/);});
const projectile={id:'same',x:0};
bus.emit('MirrorRoutePreview',{owner:0,node:10,dest:11});gate('G3-10 preview response stays WORLD',()=>assert.equal(projectile.id,'same'));
bus.emit('MirrorRouteLocal',{owner:0,node:10});gate('G3-11 local stays WORLD',()=>assert.equal(projectile.id,'same'));
const escrow={p:projectile,entryId:10,destId:11,destRef:p0.nodes[1],dirX:1,dirY:0,vx:90,vy:0,t:0,img:false};HR.match.world.mirrorF2.escrow.push(escrow);
bus.emit('MirrorRouteCapture',{owner:0,entry:10,dest:11,projectile});gate('G3-12 capture binds real identity',()=>assert.equal(api.inspect().records[0].passive.routeBindings,1));
bus.emit('MirrorEscrowImage',{entry:10,dest:11,projectile,t:.208333});gate('G3-13 real image event enables image',()=>assert.ok(api.inspect().records[0].passive.nodes.some(n=>n.id===11&&n.image)));
gate('G3-14 no independent .208 clock',()=>assert.ok(!fs.readFileSync('public/game/hero-rework/mirrorPresentationRuntime.js','utf8').includes('0.208')));
bus.emit('MirrorRouteEmerge',{entry:10,via:11,projectile,t:.566667,x:220,y:200});gate('G3-15 real emerge ends visual',()=>assert.equal(api.inspect().records[0].passive.routeBindings,0));
gate('G3-16 no independent .566 clock',()=>assert.ok(!fs.readFileSync('public/game/hero-rework/mirrorPresentationRuntime.js','utf8').includes('0.566')));
gate('G3-17 same projectile object returns',()=>assert.equal(escrow.p,projectile));
const fallback={p:projectile,entryId:10,destId:11,destRef:null,dirX:1,dirY:0,vx:90,vy:0};HR.match.world.mirrorF2.escrow=[fallback];bus.emit('MirrorRouteCapture',{owner:0,entry:10,dest:11,projectile});bus.emit('MirrorRouteEmerge',{entry:10,via:'entry-fallback',fallback:true,projectile});
gate('G3-18 fallback consumed once',()=>assert.equal(api.inspect().records[0].passive.routeBindings,0));
gate('G3-19 no visual retarget',()=>assert.ok(!api.inspect().records[0].passive.nodeBindings.includes(999)));
gate('G3-20 escrow projectile has no Gold projectile clone',()=>assert.equal(api.inspect().records[0].passive.routeBindings,0));
gate('G3-21 emergence restores one real object',()=>assert.equal(projectile.id,'same'));
const before=instancesMade;for(let i=0;i<20;i++)run();gate('G3-22 no per-frame Gold allocation',()=>assert.equal(instancesMade,before));
bus.emit('ReworkMatchTeardown',{});gate('G3-23 teardown clears mappings',()=>assert.equal(api.inspect().instanceCount,0));
gate('G3-24 A1/A2 bridge API retained',()=>{assert.equal(typeof api.renderArenaWorldEffects,'function');assert.equal(api.fixedStep,1/120);});
assert.equal(pass,24);console.log(`Mirror G3 passive/routing presentation: ${pass}/24 passed`);
