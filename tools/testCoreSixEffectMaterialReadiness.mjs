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

// Rendering proof, not just downloaded files: the Gold armed trap must
// actually issue color draw calls for each of the THREE independent blades.
const bladeKeys=['blade0','blade1','blade2'];
// Canvas's native drawImage boundary can change JS wrapper identity for
// derived images. Their immutable pixel dimensions survive that boundary.
const bladeDimensions=new Map(bladeKeys.map(key=>[
  `${a.root[key].color.width}x${a.root[key].color.height}`,key
]));
assert.equal(bladeDimensions.size,3,'all three Gold blade art parts need distinct dimensions');
const hunterCanvas=win.document.createElement('canvas');
hunterCanvas.width=hunterCanvas.height=1000;
const hunterCtx=hunterCanvas.getContext('2d');
const originalHunterDraw=hunterCtx.drawImage.bind(hunterCtx);
const drawnBlades=new Set();
const observedDraws=[];
const patchedDrawImage=(img,...args)=>{
  const shape=`${img?.width||0}x${img?.height||0}`;
  const blade=bladeDimensions.get(shape);
  if(blade) drawnBlades.add(blade);
  observedDraws.push({shape,blade:blade||null});
  return originalHunterDraw(img,...args);
};
hunterCtx.drawImage=patchedDrawImage;
const trap={tr:{on:true,x:500,y:500,phase:'unfold',t:0,lift:{x:0}},_rtImgs:a.root};
for(let i=0;i<50;i++){
  trap.tr.t+=(1/60);
  trap.tr.phase=trap.tr.t<0.62?'unfold':'armed';
  GOLDH.rtUpdate(trap,1/60);
}
GOLDH.rtDraw(trap,hunterCtx,null,'front');
assert.deepEqual([...drawnBlades].sort(),bladeKeys,
  'Gold trap front pass must draw all 3 blade dimensions, not just load assets');
assert.equal(observedDraws.length,6,
  'Gold front pass must render each of the three blades once in shadow and color');

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
  const before=frost.inspect(ice);
  assert.ok(before?.engineReady && before.ready && before.engineCount>=1,
    'Frost first live match must have a complete Gold engine BEFORE A1');
  const cast=win.APEX_HERO_REWORK.pressAbility(ice,'A1');
  assert.equal(cast.ok,true,'Frost real first A1 must cast without late art loading');
  T.step(1/60);
  assert.ok(frost.inspect(ice)?.engineReady,'Frost must stay material-ready during first A1 frame');
  win.exitArsenalBattleMode();
}
assert.equal(GOLDF.cacheStats.loadCalls,1,'rematch must not decode Frost art again');

// Actual Crystala A2 -> A1: six independently grown Gold edges are rendered
// on every front/back pass. This must NEVER be a synthetic injected construct.
T.start('CRYSTAL','HUNTER');
T.holdSpawns();
const [crystalBody,targetBody]=H.fighters();
crystalBody.baseSpeed=targetBody.baseSpeed=0;
crystalBody.x=150;crystalBody.y=500;targetBody.x=700;targetBody.y=500;
crystalBody.setDir(1,0);targetBody.setDir(-1,0);
T.step(0.2);
const crystalCt=win.APEX_HERO_REWORK.byCombatant(crystalBody);
assert.ok(crystalCt?.heroId==='CRYSTAL','real Crystala fighter must own the cast');
const awaken=win.APEX_HERO_REWORK.pressAbility(crystalBody,'A2');
assert.equal(awaken.ok,true,'real Crystala awakening required to create Hexa');
T.step(0.1);
const castPrison=win.APEX_HERO_REWORK.pressAbility(crystalBody,'A1');
assert.equal(castPrison.ok,true,'real Crystala A1 Hexa must succeed');
const rig=win.APEX_CRYSTAL.rigOf(crystalCt);
const cons=rig?.constructs.find(c=>c.kind==='prison');
assert.ok(cons?.prison,'Hexa has to exist on the real gameplay-owned Gold rig');
const prison=cons.prison;
assert.equal(prison.edges.length,6,'real Hexa must have exactly six edges');
T.step(1.05,1/60); // Gold closure and all six independently grown cell chains
assert.ok(prison.edges.every(e=>e.wallGeom?.segs?.length===13),
  'each actual Hexa edge must own its complete 13 Gold facet cells');
assert.ok(prison.edges.every(e=>e.grown || e.gA >= 0.98 || e.gB >= 0.98),
  'six Hexa walls must reach full visual growth after Gold closure');

const originalPrisonDraw=GOLDC.drawPrison;
const seen=[];
try{
  GOLDC.drawPrison=(ctx,obj,emissive,front)=>{
    assert.equal(obj,prison,'renderer must use the real ongoing Hexa construct');
    assert.equal(obj.edges.length,6);
    seen.push(front);
    // Render its real Gold geometry, not merely a spy or a mocked return.
    return originalPrisonDraw(ctx,obj,emissive,front);
  };
  for(let i=0;i<3;i++){
    cry.renderWorldConstructsAndFx(win.ctx,false,false);
    cry.renderWorldConstructsAndFx(win.ctx,false,true);
    T.step(1/60);
  }
}finally{
  GOLDC.drawPrison=originalPrisonDraw;
  win.exitArsenalBattleMode();
}
assert.deepEqual(seen,[false,true,false,true,false,true],
  'real Hexa six-edge Gold renderer must not be suppressed by a cached half-image');

console.log('CORE SIX FIRST-SKILL MATERIAL + HEXA REAL CAST GATE PASS: 3 Hunter sickle blades drawn, 9 Frost layers ready across 2 first casts, 6 real Hexa edges across 3 frames');
process.exit(0);
