// BOT WAVE combo + rocket law — production pilot/engine contract (F1).
//
// History: this file asserted beat tables from src/game/botWave/
// comboTimeline.js, a staging prototype. In production the Gold engine owns
// J-combo timing/animation and the pilot only schedules card-gated stages
// (jab flurry, rocket proc) on top. This contract now gates the production
// seams and asserts the pilot carries NO second beat table of its own.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const game = fs.readFileSync('public/bot-wave/game.html', 'utf8');
const pilotStart = game.indexOf('/* BOXE BOT WAVE pilot');
const pilot = game.slice(pilotStart);
assert.ok(pilot.length > 1000, 'pilot region not found');

// Rocket proc law: 7.5% per confirmed hit, one detached glove in flight.
assert.ok(pilot.includes('rocketChance:.075'), 'base rocket chance must be 7.5%');
assert.ok(pilot.includes("state.rocketChance=.075+.015*stacks('rocketPrimer')"),
  'rocketPrimer stacks must add +1.5pt each, derived not accumulated');
assert.ok(pilot.includes('engine.waveRocketRoll=function(source){'), 'rocket roll hook must live on the engine seam');
assert.ok(pilot.includes("if(!state.owned.has('rocket')||state.phase!=='combat')return false;"),
  'rocket requires the rocket card and combat phase');
assert.ok(pilot.includes("if(roll>=(state.rocketChance??.075)||state.rocketPending||this.hands.R.missing||(this.cds.get('rocket')||0)>0)return false;"),
  'roll must respect chance, single-flight pending, missing glove and cooldown');
assert.ok(pilot.includes('state.rocketPending=true;'), 'a proc must latch the single-flight flag');
assert.ok(pilot.includes('testRollRocket:(n=100)=>{let count=0;for(let i=0;i<n;i++)if(rng()<.075)count++;return count}'),
  'pilot test sampler must keep the 7.5% base threshold');

// Card-gated combo stages: jab flurry only exists once the jab card is owned,
// and scheduling stays inside the pilot combo flow on engine timings.
assert.ok(pilot.includes("state.comboFlow?.phase==='jab'"), 'jab flurry phase must exist in the pilot combo flow');
assert.ok(pilot.includes('comboFlow'), 'pilot combo flow state must exist');
const cardsStart = game.indexOf('const CARDS=');
const cardsText = game.slice(cardsStart, game.indexOf('\n];', cardsStart));
assert.ok(cardsText.includes("{id:'jab'") && cardsText.includes("{id:'uppercut'"), 'combo stage cards must exist');
assert.ok(cardsText.includes("requires:['jab']"), 'uppercut must require the jab card first (chain order)');
assert.ok(cardsText.includes("requires:['uppercut']"), 'counter must require uppercut (chain continues)');
assert.ok(!pilot.includes('GOLD_J_COMBO') && !pilot.includes('recoveryMs') && !pilot.includes('makeJComboBeats'),
  'pilot must not carry a second combo beat table — Gold engine owns J timing');
// Rocket glove flight/catch timing also belongs to the engine, not the pilot:
// the pilot must not fabricate a 5000ms outbound timer of its own.
assert.ok(!pilot.includes('outboundMs'), 'rocket flight timing must stay engine-owned');

// Anti-twin (F1).
assert.ok(!fs.existsSync('src/game/botWave/comboTimeline.js'), 'comboTimeline prototype twin must not return');
console.log('BOXE R4 COMBO PASS: production seams — 7.5% rocket per confirmed hit, single detached glove, card-gated jab->uppercut chain, engine owns beat timing');
