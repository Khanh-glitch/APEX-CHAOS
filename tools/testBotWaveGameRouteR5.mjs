// BOT WAVE route + Sticky J contract (F1).
// Proof level: SOURCE-CONTRACT (route seams + VM-evaluated pilot constants; the seconds law is re-derived here, runtime sticky behavior is proven by tools/testBotWaveBrowserInputLock.mjs).
//
// History: the sticky half of this file unit-tested
// src/game/botWave/stickyJAssist.js, a staging prototype. The shipped
// implementation (requestStickyJ/advanceStickyJ in the
// public/bot-wave/game.html pilot) carries the same constants but richer
// gating (basicCd/dashT/leap/comboFlow, cancel-on-target-loss). The
// prototype is deleted; the constants and pilot behavior are gated here.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getProductSurface,canLaunchProductSurface,listProductSurfaces} from '../src/game/productSurface.js';
assert.equal(getProductSurface('bot-wave').route,'wave');
assert.equal(getProductSurface('bot-wave').preview,true);
assert.equal(canLaunchProductSurface('bot-wave'),true);
// ACTIVE surface count tracks the product graph truth (see
// testArsenalProductGraph): Alpha polish activated missions,
// achievements and account-profile, so 6 -> 9.
assert.equal(listProductSurfaces().filter(x=>x.availability==='ACTIVE').length,9);
const app=fs.readFileSync('src/App.jsx','utf8');
assert.ok(app.includes("history.pushState({apexWave:true}") &&
 app.includes("name:'bot-wave-enter'")&&app.includes("name:'bot-wave-return'"),
 'BOT WAVE must use native Mechanical Door both ways and retain Home');
assert.ok(fs.readFileSync('src/App.jsx','utf8').includes("stage.appendChild(entry)"));
const wrapper=fs.readFileSync('public/bot-wave/index.html','utf8');
assert.ok(wrapper.includes('iframe[hidden]{display:none!important}'),'BOT WAVE old arena flash risk');
assert.ok(wrapper.includes("!doc.getElementById('bw-interface-v2')"),'must wait for V2 before reveal');
const audioMix=fs.readFileSync('public/game/bot-wave/botWavePresentationV2.js','utf8');
assert.ok(audioMix.includes('boxe:1.95,weapons:.14'),'BOT WAVE Gold x1.95 / swarm-aware Arsenal gun base x.14 required');
assert.ok(fs.readFileSync('public/bot-wave/index.html','utf8').includes("frame.src='/bot-wave/game.html'"));
assert.ok(app.includes("frame.src='/bot-wave/game.html'"),'single direct Gold iframe not mounted');
assert.ok(!app.includes("window.top.location.assign(target)"),'hard navigation must not bypass transition');
assert.ok(fs.existsSync('src/game/botWave/wavePreviewEntry.css'));
// Sticky J: evaluate the shipped constants and gate the pilot execution.
const gameSrc=fs.readFileSync('public/bot-wave/game.html','utf8');
const pilot=gameSrc.slice(gameSrc.indexOf('/* BOXE BOT WAVE pilot'));
const stickyDecl=pilot.slice(pilot.indexOf('const WAVE_STICKY_ASSIST='));
const WAVE_STICKY_ASSIST=vm.runInNewContext('('+stickyDecl.slice(stickyDecl.indexOf('Object.freeze(')+('Object.freeze(').length,stickyDecl.indexOf(');'))+')',{});
assert.deepEqual(JSON.parse(JSON.stringify(WAVE_STICKY_ASSIST)),{minGap:190,maxGap:370,desiredDistance:157,maxDashSeconds:.17,nominalDashSpeed:1250,requiresNativeDashReady:true});
const {minGap,maxGap,desiredDistance,maxDashSeconds,nominalDashSpeed}=WAVE_STICKY_ASSIST;
const pilotSeconds=(d)=>d<=minGap||d>maxGap?null:Math.min(maxDashSeconds,Math.max(.045,(d-desiredDistance)/nominalDashSpeed));
assert.ok(pilotSeconds(275)>0.09&&pilotSeconds(275)<0.10,'275 gap gives a ~0.094s assisted dash');
assert.equal(pilotSeconds(190),null,'gap at minGap must not engage (already punchable)');
assert.equal(pilotSeconds(371),null,'gap beyond maxGap must not engage');
assert.ok(pilotSeconds(370)<=.17,'dash duration capped at 0.17s');
assert.ok(pilot.includes('if(!target||p.basicCd>0||p.dashCd>0||p.dashT>0||engine.leap||state.comboFlow)return false;'),
 'sticky must refuse while punch/dash busy, leaping, or mid combo');
assert.ok(pilot.includes('if(d<=WAVE_STICKY_ASSIST.minGap||d>WAVE_STICKY_ASSIST.maxGap)return false;'),
 'sticky gap window must use the shared constants');
assert.ok(pilot.includes('Math.max(.045,(d-WAVE_STICKY_ASSIST.desiredDistance)/WAVE_STICKY_ASSIST.nominalDashSpeed)'),
 'sticky duration formula must use the shared constants with the 0.045 floor');
assert.ok(pilot.includes('engine.dash(); // Must use the SAME Gold L dash and its VFX/SFX/cooldown.'),
 'sticky must consume the native Gold L dash, never a fake dash');
assert.ok(pilot.includes('state.stickyEngage={targetId:target.id,until:engine.time+t+.05,angle:a};'),
 'sticky engagement must track the native target');
assert.ok(pilot.includes('state.stickyEngage=null;p.dashT=0;state.stickyStats.cancelled++'),
 'lost target / non-combat / pause must cancel and zero dash velocity timer');
assert.ok(pilot.includes('// Stop at punchable range: stop VELOCITY, never snap character POSITION.'),
 'sticky must stop at 157 by velocity, never teleport');
assert.ok(!fs.existsSync('src/game/botWave/stickyJAssist.js'),'stickyJAssist twin must not return');
assert.equal(WAVE_STICKY_ASSIST.requiresNativeDashReady,true);
const path='public/bot-wave/game.html';
if(fs.existsSync(path)){
 const game=fs.readFileSync(path,'utf8');
 for(const t of ['WAVE_STICKY_ASSIST','waveGunCue','APEX_GUN_ART','waveRocketRoll'])assert.ok(game.includes(t),t);
 console.log('BOXE R5 Gold runtime is installed, now requires native browser Gold QA.');
}else console.log('BOXE R5 Product Preview entrance PASS; owner Gold binary gate pending (game.html missing).');
console.log('Gold J short-range assisted L-dash planner PASS');
