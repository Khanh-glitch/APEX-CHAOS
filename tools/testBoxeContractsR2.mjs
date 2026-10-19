// BOXE contracts: Free Battle battle rules + BOT WAVE upgrade economy (F1).
// Proof level: EXECUTION of pilot functions extracted from game.html (qualifiedCards/threeCards/xpNeeded) + EXECUTION of the src Free Battle spec model (boxeCombatRules proves the model, not the Gold runtime) + SOURCE-CONTRACT seams (present/choose).
//
// History: the BOT WAVE half of this file tested
// src/game/botWave/upgradeRegistry.js and BOXE_WAVE (src/game/boxe/
// boxeConfig.js), an R2 staging prototype production never imported — it
// asserted boss waves 5/10 and a 60-XP curve while the shipped game runs
// cluster bosses every 10 waves and a 70-XP curve. Those twins are deleted.
// The BOT WAVE half now EXECUTES the production pilot functions
// (qualifiedCards/threeCards/xpNeeded extracted from the shipped
// public/bot-wave/game.html) instead of a parallel model. The Free Battle
// controller contract below is untouched.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {BOXE_BATTLE} from '../src/game/boxe/boxeConfig.js';
import {boxeSkillDamage,createBoxeBattleController} from '../src/game/boxe/boxeCombatRules.js';
assert.equal(BOXE_BATTLE.a1.baseDamage,0);assert.equal(BOXE_BATTLE.a2.baseDamage,0);
for(const skill of ['PUNCH','A1','A1_EMPOWERED','A2','GOLD_JAB','GOLD_COUNTER'])
 assert.equal(boxeSkillDamage({kind:skill,targetRemainingHP:900}),0,skill+' deals zero auto-battle HP');
assert.equal(boxeSkillDamage({kind:'A2_EMPOWERED_FINISHER',targetRemainingHP:500}),50);
// Former BOXE_WAVE input/rocket/boss assertions moved to the production
// contracts: testBoxeWaveInputs (J/K/L start, U/I card-locked),
// testBoxeComboR4 (7.5% rocket, single detached glove),
// testBoxeWaveDirector (boss closes each 10-wave cluster — no wave-5 boss).
const e=[],ctrl=createBoxeBattleController({emit:x=>e.push(x)});
const has=(type)=>e.filter(x=>x.type===type);
assert.equal(ctrl.recordRealDamage({direction:'outgoing',realizedHp:299,source:'owned-weapon'},0),false);
assert.equal(ctrl.recordRealDamage({direction:'outgoing',realizedHp:1,source:'owned-weapon'},100),true);
assert.equal(ctrl.snapshot().enhanced,true);
assert.equal(ctrl.snapshot().damageProgress,0);
assert.equal(ctrl.recordRealDamage({direction:'incoming',realizedHp:400,source:'opponent'},300),false);
assert.equal(ctrl.castA1(300),true);
assert.equal(ctrl.castA2(300),false,'A2 locked while A1 is detached');
assert.equal(ctrl.snapshot().cooldowns.A1,0,'A1 waits for catch');
ctrl.advance(1300);
assert.equal(ctrl.snapshot().cooldowns.A1,0);
ctrl.advance(3100);
assert.equal(ctrl.snapshot().enhanced,false);
assert.equal(ctrl.snapshot().cooldowns.A1,0,'heat cannot recover an unstarted cooldown');
ctrl.recordRealDamage({direction:'incoming',realizedHp:300,source:'opponent'},3101);
assert.equal(ctrl.snapshot().enhanced,true);
assert.equal(ctrl.rocketFighterHit({collisionId:'contact-A',opponentId:'FROST'},3102),true);
assert.equal(ctrl.rocketFighterHit({collisionId:'contact-A',opponentId:'FROST'},3103),false);
assert.equal(ctrl.rocketFighterHit({collisionId:'contact-B',opponentId:'FROST'},3104),true,'new real contact has the same physical result');
assert.equal(has('arena:disarm-request').filter(x=>x.source==='A1').length,0,'A1 may never disarm');
assert.equal(has('arena:stun-request').filter(x=>x.source==='A1').length,2);
assert.ok(has('arena:stun-request').filter(x=>x.source==='A1').every(x=>x.durationMs===350&&x.damage===0));
assert.equal(ctrl.flurryFighterHit({collisionId:'flurry-1',opponentId:'FROST'},3105),true);
assert.equal(ctrl.flurryFighterHit({collisionId:'flurry-1',opponentId:'FROST'},3106),false);
assert.equal(has('arena:stun-request').find(x=>x.source==='A1-FLURRY').durationMs,70);
assert.equal(has('boxe:flurry-start')[0].periodMs,85);
assert.equal(has('boxe:flurry-start')[0].bodyDash,false);
// The source Gold 2s jab window authorizes 24 beats at 85ms intervals.
 // The 24th impact settles 5ms after the 2s launch window; natural end
 // waits through that impact, whereas manual recall cancels immediately.
assert.equal(has('boxe:flurry-punch-scheduled').length,1);
const singlePunch=has('boxe:flurry-punch-scheduled')[0];
assert.equal(singlePunch.atMs,3102);
assert.equal(singlePunch.impactAtMs,3152);
assert.equal(singlePunch.damage,0);
assert.equal(ctrl.rocketGroundGunContact({gunId:'PISTOL'},3107),true);
assert.equal(ctrl.rocketGroundGunContact({gunId:'RPG7'},3108),false);
assert.equal(ctrl.snapshot().rocket.cargoId,null,'pending request is not a successful pickup');
assert.equal(ctrl.resolveGroundGunReservation({gunId:'PISTOL',accepted:true},3108),true);
assert.equal(ctrl.snapshot().rocket.cargoId,'PISTOL');
ctrl.setWeaponFireCycle(true,3109);
ctrl.advance(5299);assert.equal(ctrl.snapshot().rocket.phase,'returning',
 'both gloves automatically recall when the complete Gold flurry ends');
const punches=has('boxe:flurry-punch-scheduled');
assert.equal(punches.length,24,'all 24 Gold jab launches are preserved');
for(let i=0;i<punches.length;i++){
 assert.equal(punches[i].atMs,3102+i*85);
 assert.equal(punches[i].impactAtMs,punches[i].atMs+50);
 assert.ok(punches[i].impactAtMs<=5157,'final impact may settle 5ms after launch window');
}
assert.equal(has('boxe:flurry-finished').length,1);
assert.equal(has('boxe:flurry-finished')[0].punchCount,24);
assert.equal(has('boxe:flurry-finished')[0].reason,'completed');
ctrl.advance(5300);assert.equal(ctrl.snapshot().rocket.phase,'returning');
assert.equal(ctrl.rocketCatch(5400),true);
assert.equal(ctrl.snapshot().rocket.phase,'caught','first glove alone cannot close A1');
assert.equal(ctrl.snapshot().cooldowns.A1,0,'still waiting on second glove');
assert.equal(ctrl.secondaryCatch(5400),true);
assert.equal(ctrl.snapshot().cooldowns.A1,15000,'cooldown begins after BOTH physical catches');
assert.equal(has('arena:equip-queued-gun-request').length,0);
ctrl.setWeaponFireCycle(false,5401);
assert.equal(has('arena:equip-queued-gun-request').length,1);
assert.equal(has('arena:equip-queued-gun-request')[0].gunId,'PISTOL');
// Explicit owner cancel sacrifices future Gold strikes for earlier A2 access.
const manualEvents=[],manual=createBoxeBattleController({emit:x=>manualEvents.push(x)});
manual.recordRealDamage({direction:'incoming',realizedHp:300,source:'opponent'},0);
assert.equal(manual.castA1(1),true);
assert.equal(manual.rocketFighterHit({collisionId:'enhanced-contact',opponentId:'ROBOT'},100),true);
manual.advance(440);
const emittedBefore=manualEvents.filter(x=>x.type==='boxe:flurry-punch-scheduled').length;
assert.ok(emittedBefore>0&&emittedBefore<24);
assert.equal(manual.recallA1(441),true);
assert.equal(manual.snapshot().flurry,null);
assert.equal(manual.snapshot().rocket.phase,'returning');
assert.equal(manual.snapshot().secondary.phase,'returning');
manual.advance(1000);
assert.equal(manualEvents.filter(x=>x.type==='boxe:flurry-punch-scheduled').length,emittedBefore,
 'manual A1 cannot keep authorizing cancelled jabs');
assert.equal(manual.rocketCatch(1001),true);
assert.equal(manual.snapshot().cooldowns.A1,0,'A2 still locked until both gloves return');
assert.equal(manual.castA2(1001),false);
assert.equal(manual.secondaryCatch(1001),true);
assert.equal(manual.snapshot().cooldowns.A1,15000);
assert.equal(manual.castA2(1001),true,'ready A2 is accessible after both gloves return');
assert.ok(has('boxe:gold-rocket-catch')[0].physicalRecoil);
// Rejected floor pickup must not fabricate ownership or delayed Equip.
const earlyEvents=[],early=createBoxeBattleController({emit:x=>earlyEvents.push(x)});
assert.equal(early.castA1(0),true);
assert.equal(early.recallA1(400),true);
assert.equal(early.snapshot().rocket.phase,'returning');
assert.equal(early.snapshot().cooldowns.A1,0);
assert.equal(early.rocketCatch(600),true);
assert.equal(early.snapshot().cooldowns.A1,15000);
const rejectedEvents=[],rejected=createBoxeBattleController({emit:x=>rejectedEvents.push(x)});
assert.equal(rejected.castA1(0),true);
assert.equal(rejected.rocketGroundGunContact({gunId:'STOLEN_GUN'},100),true);
assert.equal(rejected.resolveGroundGunReservation({gunId:'STOLEN_GUN',accepted:false},101),true);
assert.equal(rejected.snapshot().rocket.cargoId,null);
rejected.advance(5000);rejected.rocketCatch(5100);
assert.equal(rejectedEvents.some(x=>x.type==='arena:equip-queued-gun-request'),false);
// separate A2 cases
const events2=[],a2=createBoxeBattleController({emit:x=>events2.push(x)});
a2.recordRealDamage({direction:'incoming',realizedHp:300,source:'opponent'},0);
assert.equal(a2.castA2(10),true);
assert.deepEqual(a2.interceptIncoming({opponentOwned:true,qualifyingDamage:900},100),{negated:true,preventedHP:900});
assert.equal(a2.recordRealDamage({direction:'incoming',realizedHp:0,source:'blocked'},100),false);
assert.equal(a2.snapshot().damageProgress,0);
assert.equal(a2.interceptIncoming({opponentOwned:true,qualifyingDamage:1},120).negated,false);
assert.equal(a2.counterContact({opponentId:'FROST',opponentRemainingHP:660,collisionId:'counter-1'},200),true);
const req=events2.filter(x=>x.type==='arena:damage-request');
assert.equal(req.length,1);assert.equal(req[0].amount,undefined,'no stale absolute HP damage');
assert.equal(req[0].formula,'FRACTION_OF_REMAINING_HP');
assert.equal(req[0].fractionRemaining,.1);
assert.equal(events2.filter(x=>x.type==='arena:stun-request').at(-1).durationMs,2000);
assert.equal(events2.filter(x=>x.type==='arena:disarm-request').length,1);
const e3=[],plain=createBoxeBattleController({emit:x=>e3.push(x)});
assert.equal(plain.castA2(0),true);
assert.equal(plain.interceptIncoming({opponentOwned:false,qualifyingDamage:100},1).negated,false);
plain.advance(1001);assert.equal(plain.snapshot().counterPhase,null);
assert.equal(e3.some(x=>x.type==='boxe:counter-lunge'),false);
assert.equal(e3.some(x=>x.type==='arena:damage-request'),false);
// BOT WAVE upgrade economy — executed from the shipped pilot, not modeled.
const game=fs.readFileSync('public/bot-wave/game.html','utf8');
const pilot=game.slice(game.indexOf('/* BOXE BOT WAVE pilot'));
const grab=(name)=>{const i=pilot.indexOf(name);assert.ok(i>=0,'pilot seam missing: '+name);
 let d=0,k=pilot.indexOf('{',i);for(;k<pilot.length;k++){if(pilot[k]==='{')d++;else if(pilot[k]==='}'){d--;if(!d)break}}
 return pilot.slice(i,k+1)};
const cardsStart=pilot.indexOf('const CARDS=');
const cardsExpr=pilot.slice(cardsStart+'const CARDS='.length,pilot.indexOf('\n];',cardsStart)+2);
const api=vm.runInNewContext(
 'const CARDS='+cardsExpr+';let seed=0xC0FFE42;'+grab('function rng()')
 +'let state={owned:new Set(),stacks:{},levelsPending:0,offer:null};'
 +grab('function xpNeeded')+grab('function qualifiedCards()')+grab('function threeCards()')
 +'({CARDS,xpNeeded,qualifiedCards,threeCards,setState(s){state=s},reseed(v){seed=v}})',{});
assert.equal(api.CARDS.length,20,'production pool is 20 cards');
assert.equal(new Set(api.CARDS.map(c=>c.id)).size,20,'card ids unique');
// Shipped XP curve (ceil(70*1.16^(L-1))) — the deleted prototype said 60 L1.
assert.deepEqual(JSON.parse(JSON.stringify(Array.from({length:10},(_,i)=>api.xpNeeded(i+1)))),[70,82,95,110,127,148,171,198,230,267]);
// Fresh run: requires-chain cards are filtered; unlocks are one-time owned.
const fresh=api.qualifiedCards().map(c=>c.id);
assert.deepEqual(JSON.parse(JSON.stringify(fresh)),['jab','rocket','vitality','fist','tempo','agility','guard','heal','knock','dash','sustain','armor','insight'],
 'fresh qualified pool excludes every requires-chain card');
// Golden weighted draw at the production default seed (F1 baseline).
assert.deepEqual(JSON.parse(JSON.stringify(api.threeCards().map(c=>c.id))),['agility','dash','vitality']);
for(let s=1;s<=200;s++){api.reseed(s);const draw=api.threeCards();
 assert.equal(draw.length,3);assert.equal(new Set(draw.map(c=>c.id)).size,3,'no duplicates in one offer');
 assert.ok(draw.every(c=>fresh.includes(c.id)),'offers only ever come from the qualified pool');}
// Ownership opens the next chain link; stack caps close a card.
api.setState({owned:new Set(['jab']),stacks:{armor:6},levelsPending:1,offer:null});
const afterJab=api.qualifiedCards().map(c=>c.id);
assert.ok(afterJab.includes('uppercut')&&afterJab.includes('overclock'),'jab ownership unlocks its chain');
assert.ok(!afterJab.includes('jab'),'owned unlock never re-offers');
assert.ok(!afterJab.includes('armor'),'armor maxes at 6 stacks');
assert.ok(!afterJab.includes('counter')&&!afterJab.includes('phantom')&&!afterJab.includes('ult'),'chain cannot skip links');
// Present/choose gating lives in the pilot control flow (UI-bound, so gated
// by exact source seams rather than executed).
assert.ok(pilot.includes('function presentCards(){if(state.offer||state.levelsPending<=0)return;'),'no offer without a pending level');
assert.ok(pilot.includes("function chooseCard(id){if(state.phase!=='upgrade'||!state.offer?.some(c=>c.id===id))return;"),
 'only an offered card can be chosen, only during the upgrade phase');
assert.ok(pilot.includes('state.offer=threeCards();'),'offers are the production weighted draw');
assert.ok(pilot.includes('state.levelsPending--;'),'choosing consumes exactly one pending level');
assert.ok(pilot.includes("const WAVE_UNLOCK_CARD_IDS=Object.freeze(['jab','rocket','uppercut','counter','phantom','ult']);"),
 'one-time unlock set is exactly the six chain/rocket cards');
// Anti-twin (F1): no second upgrade registry / wave config.
assert.ok(!fs.existsSync('src/game/botWave/upgradeRegistry.js'),'upgradeRegistry twin must not return');
assert.ok(!fs.readFileSync('src/game/boxe/boxeConfig.js','utf8').includes('export const BOXE_WAVE'),'BOXE_WAVE twin config must not return');
console.log('BOXE Owner R2 PASS: auto skills 0 damage; 10% finisher; 300/3s/x2; repeated stun/disarm; Gold rocket 5s; catch gun queue; BOT WAVE production economy — 20 cards, 70/1.16 XP, requires-chain, weighted 3-card offers, no free grants');
// Inspect C04 profile when fighter explicitly states damage 0: the keyword
// "hit" alone must not invent ability HP damage for BOXE.
const {heroProfile}=await import('../src/game/cosmetics/fieldArchiveProfiles.js');
const zeroHero={archiveProfile:{traits:{damage:0}},skills:{PASSIVE:{mechanicId:'hit_power',baseConfig:{damage:0}},A1:{mechanicId:'rocket_hit',baseConfig:{impactStunMs:500}},A2:{mechanicId:'block_and_hit',baseConfig:{duration:1}}}};
assert.equal(heroProfile(zeroHero).axes.find(x=>x.key==='damage').value,0);
console.log('C04 radar owner-defined zero damage override PASS');
