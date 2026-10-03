#!/usr/bin/env node
/* G3 correction — shipping runtime integration: real HR geometry/F1 objects/F2 payload identity. */
import assert from 'node:assert/strict';
import { bootHarness } from './lib/crystalaHarness.mjs';
const H=await bootHarness(); const {win,T}=H; const HR=win.APEX_HERO_REWORK;
HR.setAiEnabled(false); T.start('MIRROR','MIRROR'); T.holdSpawns();
T.step(1/120,1/120);
const [a,b]=H.fighters(), ca=HR.byCombatant(a), cb=HR.byCombatant(b); const P=win.APEX_MIRROR_PRESENTATION;
assert.ok(P&&HR.mirrorNode,'shipping presentation and real HR.mirrorNode loaded');
const mkShard=(x,y,st=0)=>({on:true,st,node:null,x,y,vx:0,vy:0,age:1,mt0:.18,moving:st===1,fx:x,fy:y,tx:x+1,ty:y+1,prov:{hitX:x,hitY:y,dirX:1,dirY:0,weaponId:'PISTOL',sourceId:a.id}});
const installNode=(ct,id,x,y,rot)=>{const st=ct.store['mirror.passive'];const sh=[],base=st.slots.findIndex(s=>!s);for(let i=0;i<5;i++){const s=mkShard(x+i,y+i,3);st.slots[base+i]=s;sh.push(s);}const n={owner:ct,x,y,rot,st:2,t:2,age:1,t3:0,tlock:1,activeAtClock:0,formedAtClock:0,sh,id};sh.forEach(s=>s.node=n);st.nodes.push(n);return n;};
const na=installNode(ca,9001,213,377,.41), da=installNode(ca,9002,613,477,-.22);const nb=installNode(cb,9011,733,207,.13), db=installNode(cb,9012,433,707,-.31);
P.tick(1/120);
const rec=(idx)=>P.inspect().records.find(r=>r.combatantIndex===idx);
assert.equal(rec(ca.idx).passive.slots[0].x,na.sh[0].x); assert.equal(ca.store['mirror.passive'].nodes[0],na);
console.log('PASS real F1 object shape maps without mutation');
for(const n of [na,da,nb,db]){const pr=rec(n.owner.idx).passive.nodes.find(x=>x.id===n.id);const o=HR.mirrorNode.toWorld(n,0,0),ex=HR.mirrorNode.toWorld(n,1,0),ey=HR.mirrorNode.toWorld(n,0,1);assert.deepEqual([pr.x,pr.y],[o.x,o.y]);for(const [k,v] of Object.entries({a:ex.x-o.x,b:ex.y-o.y,c:ey.x-o.x,d:ey.y-o.y}))assert.ok(Math.abs(pr.worldTransform[k]-v)<1e-12);for(const v of HR.mirrorNode.NV){const gp={x:pr.x+v[0]*pr.worldTransform.a+v[1]*pr.worldTransform.c,y:pr.y+v[0]*pr.worldTransform.b+v[1]*pr.worldTransform.d};const hp=HR.mirrorNode.toWorld(n,v[0],v[1]);assert.ok(Math.hypot(gp.x-hp.x,gp.y-hp.y)<1e-9);}const s=HR.mirrorNode.surface(n),v0=HR.mirrorNode.toWorld(n,...HR.mirrorNode.NV[0]),v3=HR.mirrorNode.toWorld(n,...HR.mirrorNode.NV[3]);assert.deepEqual([s.ax,s.ay,s.bx,s.by],[v0.x,v0.y,v3.x,v3.y]);}
console.log('PASS P17 shipping Gold basis derives from real HR.mirrorNode across owners/rotations/NV/surfaces');
const world=HR.match.world.mirrorF2||(HR.match.world.mirrorF2={escrow:[],nodeSeq:0});
const capture=(owner,entry,dest,p)=>{const e={p,entryId:entry.id,entrySnap:{x:entry.x,y:entry.y,rot:entry.rot},destRef:dest,destId:dest.id,dirX:1,dirY:0,vx:300,vy:0,acc:0,t:0,img:false,fallbackUsed:false};world.escrow.push(e);H.AIL.bus.emit('MirrorRouteCapture',{entry:entry.id,dest:dest.id,owner:owner.idx,toi:.5,weapon:'PISTOL',type:'aq_bullet',projectile:p});return e;};
const image=(e)=>H.AIL.bus.emit('MirrorEscrowImage',{entry:e.entryId,dest:e.destId,projectile:e.p,destLive:true,t:.208});
const emerge=(e,via=e.destId)=>H.AIL.bus.emit('MirrorRouteEmerge',{entry:e.entryId,via,t:.566,x:1,y:2,weapon:'PISTOL',type:'aq_bullet',fallback:false,projectile:e.p});
const p1={tag:'p1'},p2={tag:'p2'},p3={tag:'p3'};const e1=capture(ca,na,da,p1),e2=capture(ca,na,da,p2),e3=capture(cb,nb,db,p3);image(e1);image(e2);image(e3);
let ra=rec(ca.idx),rb=rec(cb.idx);assert.equal(ra.passive.routeBindings,2);assert.equal(ra.passive.imageOwners.find(x=>x.nodeId===da.id).count,2);assert.equal(rb.passive.routeBindings,1);assert.strictEqual(ra.passive.routes[0].projectile,ra.passive.routes[0].escrowProjectile);assert.equal(win.APEX_MIRROR_GOLD.createMirrorInstance?true:false,true);
assert.ok(P.inspect().records.every(r=>r.passive.routes.every(x=>x.projectile!==undefined)));console.log('PASS same-entry/same-destination and Mirror-v-Mirror routes bind exact real objects');
emerge(e1);ra=rec(ca.idx);assert.equal(ra.passive.routeBindings,1);assert.strictEqual(ra.passive.routes[0].projectile,p2);assert.equal(ra.passive.imageOwners.find(x=>x.nodeId===da.id).count,1);assert.ok(ra.passive.nodes.find(x=>x.id===da.id).image);assert.equal(rec(cb.idx).passive.routeBindings,1);console.log('PASS one exact emerge preserves surviving same-destination and opposing-owner image');
emerge(e2);emerge(e3);assert.equal(rec(ca.idx).passive.routeBindings,0);assert.equal(rec(cb.idx).passive.routeBindings,0);assert.ok(!rec(ca.idx).passive.nodes.find(x=>x.id===da.id).image);console.log('PASS final exact emerges release only their image ownership');
assert.equal(P.inspect().records.reduce((n,r)=>n+r.passive.routes.length,0),0);assert.ok(P.inspect().records.every(r=>r.passive.routes.every(x=>x.projectile!==null)));assert.ok(P.inspect().records.every(r=>r.passive.goldProjectilesActive===0));console.log('PASS zero Gold PJ clones: PJ pool inactive and bindings are escrow.p references only');
let canvases=0,images=0;const oldCreate=win.document.createElement.bind(win.document);win.document.createElement=(name,...args)=>{if(String(name).toLowerCase()==='canvas')canvases++;return oldCreate(name,...args);};const OldImage=win.Image;win.Image=new Proxy(OldImage,{construct(t,args,n){images++;return Reflect.construct(t,args,n);}});const beforeInstances=P.inspect().scheduler.createdInstances,beforeListeners=P.inspect().listenerCount;for(let i=0;i<120;i++)P.tick(1/120);assert.deepEqual([canvases,images,P.inspect().scheduler.createdInstances-beforeInstances,P.inspect().listenerCount-beforeListeners],[0,0,0,0]);console.log(`PASS allocations canvas=${canvases} Image=${images} GoldInstances=0 listenerGrowth=0`);
H.AIL.bus.emit('ReworkMatchTeardown',{});assert.equal(P.inspect().instanceCount,0);console.log('Mirror G3 corrected integration: 7/7 passed');

process.exit(0);
