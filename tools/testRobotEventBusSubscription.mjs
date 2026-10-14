// CP11 Robot integration law: presentation consumes the native AIL event bus
// instead of overriding bus.emit for every hero/weapon in the application.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('public/game/hero-rework/ailRuntime.js','utf8');
const scope={};
vm.runInNewContext(source,{window:scope,console,Math,Map,Set,WeakMap,Date,Object,Array,String,Number,Promise},
 {filename:'ailRuntime.js',timeout:10000});
const bus=scope.APEX_HERO_REWORK_AIL.bus;
const emitter=bus.emit,observer=[];
const off=bus.on('*',e=>observer.push(e));
const payload={hero:'ROBOT',fighterId:123,slotId:77};
const ev=bus.emit('RobotA1Lock',payload);
assert.equal(bus.emit,emitter,'observer must never replace global EventBus.emit');
assert.equal(Object.hasOwn(bus,'emit'),false,'native EventBus prototype must retain ownership');
assert.equal(ev.seq,1);assert.equal(ev.type,'RobotA1Lock');
assert.deepEqual(observer.map(x=>x.type),['RobotA1Lock']);
assert.equal(observer[0],ev,'presenter must receive exact canonical emitted event');
assert.equal(observer[0].payload,payload,'event payload ownership must not change');
off();
bus.emit('RobotA1NoWeapon',{hero:'ROBOT'});
assert.equal(observer.length,1,'unsubscription leaked events');
const robot=fs.readFileSync('public/game/hero-rework/robotPresentationRuntime.js','utf8');
assert.ok(robot.includes("AIL.bus.on('*', event=>"),
 'Robot must register with native AIL wildcard event contract');
assert.ok(!/AIL\.bus\.emit\s*=/.test(robot),
 'Robot must not monkey patch AIL emitter ever again');
assert.ok(robot.includes('__robotPresentationUnsubscribe = off'),
 'Robot must expose deterministic subscription ownership');
console.log('CP11 ROBOT EVENT BUS PASS: canonical emitter untouched, wildcard delivery, unsubscribe and real presenter subscription');
