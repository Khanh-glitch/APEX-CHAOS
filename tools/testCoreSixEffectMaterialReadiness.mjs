#!/usr/bin/env node
// Real-runtime regression: material readiness is a battle readiness condition
// for Hunter ROOT blades and Frost layered breath/ice art. Gold remains the
// geometry/presentation authority, not the test fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bootHarness } from './lib/crystalaHarness.mjs';

const H=await bootHarness(),{win,T}=H;
const hunter=win.APEX_HUNTER_PRESENTATION;
const frost=win.APEX_FROST_PRESENTATION;
const GOLDH=win.APEX_HUNTER_GOLD;
const GOLDF=win.APEX_FROST_GOLD;
const cry=win.APEX_CRYSTALA_PRESENTATION;
const GOLDC=win.APEX_CRYSTALA_GOLD;
assert.ok(hunter && frost && cry,'all three actual battle presentations must be installed');
assert.equal(typeof hunter.whenReady?.then,'function','Hunter must expose a real material gate');
assert.equal(typeof frost.whenReady?.then,'function','Frost must expose a real material gate');
await Promise.all([hunter.whenReady,frost.whenReady]);
assert.equal(hunter.ready,true,'Hunter cannot signal ready before trap materials');
assert.equal(frost.ready,true,'Frost cannot signal ready before nine decoded layers');

const a=await GOLDH.load();
for(const key of ['core','root0','root1','root2','blade0','blade1','blade2']){
  assert.ok(a.root[key]?.color,'ROOT blade/source material missing: '+key);
  assert.ok(a.root[key].color.width>0&&a.root[key].color.height>0,'empty material: '+key);
}
assert.equal(GOLDF.cacheStats.loadCalls,1,'Frost Gold image decode must be one module-wide load');

const loaderSource=fs.readFileSync('src/game/runtimeLoader.js','utf8');
assert.match(loaderSource,/await Promise\.all\(materialGates\)/,'battle readiness must wait for art');
assert.match(loaderSource,/APEX_HUNTER_PRESENTATION\?\.whenReady/);
assert.match(loaderSource,/APEX_FROST_PRESENTATION\?\.whenReady/);

// Real match: a prewarmed ICE engine must have art before its FIRST action.
// A second match must reuse the same completed mipmaps (no decode race).
for(let i=0;i<2;i++){
  T.start('ICE','HUNTER');
  T.holdSpawns();
  T.step(1/60);
  const [ice]=H.fighters();
  assert.ok(frost.ready&&hunter.ready,'art readiness cannot regress on rematch');
  assert.ok(ice && ice.hp>0);
  win.exitArsenalBattleMode();
}
assert.equal(GOLDF.cacheStats.loadCalls,1,'rematch must not decode Frost art again');

// Hexa Prison: render the six live edges on BOTH back and front passes,
// including on repeated frames after the parent reports a stable construct.
// A cached one-frame snapshot can hide independently late-growing walls.
T.start('CRYSTAL','HUNTER');
T.holdSpawns();
T.step(1/60);
const ct=win.APEX_HERO_REWORK.match.combatants.find(x=>x.heroId==='CRYSTAL');
assert.ok(ct,'real Crystal combatant');
const state=win.APEX_CRYSTAL.stateOf(ct);
assert.ok(state?.rig?.constructs,'real Crystala Gold rig');
const pris={solid:true,collapsed:false,pulse:-1,cx:500,cy:500,R:135,
  edges:Array.from({length:6},()=>({
    grown:true,dead:false,collapsing:false,lit:0,gA:1,gB:0,both:false,
    a:{x:400,y:400},b:{x:600,y:600},
    wallGeom:{segs:[{dead:false,lit:0,stress:0,grow:1}]},
  }))};
const cons={kind:'prison',prison:pris};
state.rig.constructs.push(cons);
const original=GOLDC.drawPrison;
const seen=[];
try{
  GOLDC.drawPrison=(ctx,obj,emissive,front)=>{
    assert.equal(obj,pris,'must render actual active Gold construct');
    assert.equal(obj.edges.length,6);
    seen.push(front);
  };
  for(let i=0;i<3;i++){
    cry.renderWorldConstructsAndFx(win.ctx,false,false);
    cry.renderWorldConstructsAndFx(win.ctx,false,true);
  }
}finally{
  GOLDC.drawPrison=original;
  state.rig.constructs.pop();
  win.exitArsenalBattleMode();
}
assert.deepEqual(seen,[false,true,false,true,false,true],
  'Hexa edges must never be replaced by stale half-front/half-back raster');
console.log('CORE SIX FIRST-SKILL MATERIAL + HEXA LIVE EDGE GATE PASS: 7 Hunter pieces, 9 Frost layers, 3 prison frames, 2 rematches');
process.exit(0);
