#!/usr/bin/env node
// Canonical donor-vs-production trace parity. Unlike the legacy motion trace,
// this harness executes MAGNET_FINAL_DONOR_MAX.html itself and compares its
// six-part transforms with the shipping Gold module under matched stimuli.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { bootHarness } from './lib/crystalaHarness.mjs';

const REPO=process.cwd(),DT=1/120,IDS=['core','spine','polL','polR','lobeL','lobeR'];
const donorPath='docs/hero-rework/magnet-v1/gold/MAGNET_FINAL_DONOR_MAX.html';
const donor=fs.readFileSync(donorPath,'utf8');
const donorSha=(await import('node:crypto')).createHash('sha256').update(donor).digest('hex');
if(donorSha!=='468f7b2aa34588c2c52bf23fb5202c507ff5d584d423ea9f1a9232d751247d8b')throw new Error(`canonical donor hash drift: ${donorSha}`);

const requireBrowser=createRequire('/tmp/magnet-browser-deps/noop.js');
const puppeteer=requireBrowser('puppeteer-core');
const chromiumModule=requireBrowser('@sparticuz/chromium'),chromium=chromiumModule.default;
const chromiumRoot=path.dirname(path.dirname(requireBrowser.resolve('@sparticuz/chromium')));
await chromiumModule.inflate(path.join(chromiumRoot,'bin','al2023.tar.br'));
process.env.LD_LIBRARY_PATH='/tmp/al2023/lib:'+(process.env.LD_LIBRARY_PATH||'');
let html=donor;
const marker="'use strict';\nconst TAU=";
if(!html.includes(marker))throw new Error('canonical main-script marker missing');
html=html.replace(marker,"'use strict';\nlet __paritySeed=0x12345678;Math.random=()=>{__paritySeed^=__paritySeed<<13;__paritySeed^=__paritySeed>>>17;__paritySeed^=__paritySeed<<5;return(__paritySeed>>>0)/0x100000000;};\nconst TAU=");
const boot=`reset();\nrequestAnimationFrame(frame);\nbootAsset().catch(e=>{console.warn(e);showGate();});`;
if(!html.includes(boot))throw new Error('canonical boot marker missing');
html=html.replace(boot,`reset();\n/* parity harness owns deterministic stepping; raster boot is unnecessary */`);
const debug="window.MAGNET_DEBUG={hero,opp,guns,bullets,A1,A2,RIG,G,castA1,castA2,passiveShot,get asset(){return ASSET;}};";
if(!html.includes(debug))throw new Error('canonical debug marker missing');
html=html.replace(debug,"window.MAGNET_DEBUG={hero,opp,A1,A2,RIG,G,keys,idle,castA1,castA2,passiveShot,step,reset,wallImpact,bulletHitResponse,get guns(){return guns;},get bullets(){return bullets;},get simT(){return simT;},setSeed(v){__paritySeed=v>>>0;},get asset(){return ASSET;}};");

const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
const page=await browser.newPage();
await page.setContent(html,{waitUntil:'domcontentloaded',timeout:120000});
const canonical=await page.evaluate(({DT,IDS})=>{
  const D=window.MAGNET_DEBUG,copy=()=>Object.fromEntries(IDS.map(id=>{const p=D.RIG[id];return[id,{x:p.x,y:p.y,r:p.r,sx:p.sx,sy:p.sy}];}));
  const sample=(tick)=>({tick,t:D.simT,rig:copy(),root:{x:D.hero.x,y:D.hero.y,vx:D.hero.vx,vy:D.hero.vy,ax:D.hero.ax,ay:D.hero.ay},a1:{t:D.A1.t,tx:D.A1.tx,ty:D.A1.ty},a2:{t:D.A2.t}});
  const run=(n,trace)=>{for(let i=0;i<n;i++){D.step(DT);trace.push(sample(trace.length));}};
  const scenarios={};
  D.keys.clear();D.reset();D.keys.add('d');let tr=[];run(120,tr);D.keys.delete('d');run(80,tr);scenarios.locomotion=tr;
  D.keys.clear();D.reset();D.keys.add('d');tr=[];run(80,tr);D.keys.delete('d');D.keys.add('a');run(80,tr);scenarios.hardReverse=tr;
  D.keys.clear();D.reset();D.hero.x=250;D.hero.y=500;D.keys.add('a');tr=[];run(100,tr);D.keys.delete('a');run(80,tr);scenarios.wall=tr;
  D.keys.clear();D.reset();D.castA1();tr=[];run(200,tr);scenarios.a1=tr;
  D.keys.clear();D.reset();D.castA2();tr=[];run(280,tr);scenarios.a2=tr;
  D.keys.clear();D.reset();D.hero.armed=true;D.hero.gun={type:{sp:1000,n:'RIFLE'}};D.passiveShot();tr=[];run(160,tr);scenarios.passive=tr;
  D.keys.clear();D.reset();D.setSeed(0xd37a40f7);D.idle.next=2.2;tr=[];run(720,tr);scenarios.idle=tr;
  return scenarios;
},{DT,IDS});
await browser.close();

const H=await bootHarness(),{win,T}=H,HR=win.APEX_HERO_REWORK,GOLD=win.APEX_MAGNET_GOLD;
T.start('MAGNET','MIRROR');T.holdSpawns();HR.setAiEnabled(false);
const fighter=H.fighters()[0],ct=HR.byCombatant(fighter);fighter.baseSpeed=0;
const rig=()=>{const r=GOLD.inspect(ct).state.rig;return Object.fromEntries(IDS.map(id=>[id,{x:r[id].x,y:r[id].y,r:r[id].r,sx:r[id].sx,sy:r[id].sy}]));};
function reset(x=450,y=690){GOLD.teardown(ct);fighter.x=x;fighter.y=y;GOLD.updateFrame(ct,DT,{root:{before:{x,y},after:{x,y},radius:fighter.radius}});}
function runShipping(phases,total,extraAt){
  const trace=[];let x=fighter.x,y=fighter.y;
  for(let tick=0;tick<total;tick++){
    const phase=phases.find(q=>tick>=q.from&&tick<q.to)||{vx:0,vy:0};
    const before={x,y};x=Math.max(fighter.radius,Math.min(1000-fighter.radius,x+(phase.vx||0)*DT));y=Math.max(fighter.radius,Math.min(1000-fighter.radius,y+(phase.vy||0)*DT));fighter.x=x;fighter.y=y;
    const extra=extraAt?extraAt(tick):{};GOLD.updateFrame(ct,DT,{...extra,root:{before,after:{x,y},radius:fighter.radius}});
    trace.push({tick,t:(tick+1)*DT,rig:rig(),root:{x,y,vx:phase.vx||0,vy:phase.vy||0}});
  }
  return trace;
}
const production={};
reset();production.locomotion=runShipping([{from:0,to:120,vx:450,vy:0}],200);
reset();production.hardReverse=runShipping([{from:0,to:80,vx:450,vy:0},{from:80,to:160,vx:-450,vy:0}],160);
reset(229,500);production.wall=runShipping([{from:0,to:100,vx:-450,vy:0}],180);
reset();GOLD.cue(ct,'a1',{x:-120,y:80});production.a1=runShipping([],200,tick=>({a1Target:{x:canonical.a1[tick]?.a1.tx||0,y:canonical.a1[tick]?.a1.ty||0}}));
reset();GOLD.cue(ct,'a2');production.a2=runShipping([],280);
reset();GOLD.cue(ct,'passive',{angle:0,x:450,y:690});production.passive=runShipping([],153);
reset();production.idle=runShipping([],720);

function partDelta(a,b){const dx=a.x-b.x,dy=a.y-b.y,dr=(a.r-b.r)*80,dsx=(a.sx-b.sx)*80,dsy=(a.sy-b.sy)*80;return Math.hypot(dx,dy,dr,dsx,dsy);}
function metrics(a,b,shift=0){
  const n=Math.min(a.length,b.length-shift),parts={};let total=0,count=0,max=0;
  for(const id of IDS){let sum2=0,peakA=0,peakB=0,peakAtA=0,peakAtB=0,pmax=0;for(let i=0;i<n;i++){const pa=a[i].rig[id],pb=b[i+shift].rig[id],d=partDelta(pa,pb);sum2+=d*d;pmax=Math.max(pmax,d);const ma=partDelta(pa,{x:0,y:0,r:0,sx:1,sy:1}),mb=partDelta(pb,{x:0,y:0,r:0,sx:1,sy:1});if(ma>peakA){peakA=ma;peakAtA=i*DT;}if(mb>peakB){peakB=mb;peakAtB=i*DT;}}parts[id]={rmse:Math.sqrt(sum2/Math.max(1,n)),max:pmax,peakProduction:peakA,peakCanonical:peakB,peakRatio:peakB?peakA/peakB:null,peakTimeDelta:peakAtA-peakAtB};total+=sum2;count+=n;max=Math.max(max,pmax);}return{samples:n,rmse:Math.sqrt(total/Math.max(1,count)),max,parts};
}
const comparisons={
  locomotion:metrics(production.locomotion,canonical.locomotion),
  hardReverse:metrics(production.hardReverse,canonical.hardReverse),
  wall:metrics(production.wall,canonical.wall),
  a1:metrics(production.a1,canonical.a1),
  a2:metrics(production.a2,canonical.a2),
  // Production sees the actual emission, 55 ms after canonical PREP begins.
  passiveFromEmission:metrics(production.passive,canonical.passive,7),
  idle:metrics(production.idle,canonical.idle),
};
const tolerances={skillRmse:0.85,locomotionRmse:1.25,peakRatio:[.72,1.28],peakTime:0.085};
const checks={
  'canonical-donor-hash':donorSha==='468f7b2aa34588c2c52bf23fb5202c507ff5d584d423ea9f1a9232d751247d8b',
  'a1-trace-parity':comparisons.a1.rmse<=tolerances.skillRmse,
  'a2-trace-parity':comparisons.a2.rmse<=tolerances.skillRmse,
  'passive-emission-trace-parity':comparisons.passiveFromEmission.rmse<=tolerances.skillRmse,
  'locomotion-trace-parity':comparisons.locomotion.rmse<=tolerances.locomotionRmse,
  'hard-reverse-trace-parity':comparisons.hardReverse.rmse<=tolerances.locomotionRmse,
  'wall-trace-parity':comparisons.wall.rmse<=tolerances.locomotionRmse,
  'idle-trace-parity':comparisons.idle.rmse<=tolerances.locomotionRmse,
};
const report={generatedAt:new Date().toISOString(),donor:{path:donorPath,sha256:donorSha},tolerances,checks,comparisons,traces:{canonical,production}};
const reportPath=process.env.MAGNET_GOLD_PARITY_REPORT||'docs/hero-rework/magnet-v1/evidence/canonical-gold-parity.json';fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
for(const[name,ok]of Object.entries(checks))console.log(`${ok?'PASS':'FAIL'}  ${name}${comparisons[name.split('-')[0]]?` — rmse=${comparisons[name.split('-')[0]].rmse.toFixed(4)}`:''}`);
console.log(JSON.stringify(Object.fromEntries(Object.entries(comparisons).map(([k,v])=>[k,{rmse:v.rmse,max:v.max,parts:v.parts}])),null,2));
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);console.log(`\n[MAGNET CANONICAL GOLD PARITY] ${failed.length?'FAIL':'PASS'}`);if(failed.length)console.error(`FAILURES: ${failed.join(', ')}`);
win.exitArsenalQuestMode();process.exit(failed.length?1:0);
