import assert from 'node:assert/strict';
import {BOXE_BATTLE,BOXE_WAVE} from '../src/game/boxe/boxeConfig.js';
import {boxeSkillDamage,createBoxeBattleController} from '../src/game/boxe/boxeCombatRules.js';
import {createWaveUpgradePool,offerThreeCards,chooseCard,upgradeState,unlockedKeys,
 enabledGoldSkills,recordAuthorizedKill,waveDescriptor,DEFAULT_ROBOTS} from '../src/game/botWave/upgradeRegistry.js';
assert.equal(BOXE_BATTLE.a1.baseDamage,0);assert.equal(BOXE_BATTLE.a2.baseDamage,0);
for(const skill of ['PUNCH','A1','A1_EMPOWERED','A2','GOLD_JAB','GOLD_COUNTER'])
 assert.equal(boxeSkillDamage({kind:skill,targetRemainingHP:900}),0,skill+' deals zero auto-battle HP');
assert.equal(boxeSkillDamage({kind:'A2_EMPOWERED_FINISHER',targetRemainingHP:500}),50);
assert.deepEqual(BOXE_WAVE.startingInputs,['J','K','L']);
assert.equal(BOXE_WAVE.rocketProc.perConfirmedPunchProbability,.075);
assert.equal(BOXE_WAVE.rocketProc.maxDetachedGloves,1);
assert.equal(BOXE_WAVE.rocketProc.flightMs,5000);
assert.deepEqual(BOXE_WAVE.bossesAt,[5,10]);
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
// First Gold launch is immediate. 2.000s / 85ms with 50ms impact clearance
// => precisely 23 legally hittable attacks. Catch can never cancel flurry.
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
ctrl.advance(5299);assert.equal(ctrl.snapshot().rocket.phase,'outbound');
const punches=has('boxe:flurry-punch-scheduled');
assert.equal(punches.length,23,'Flurry exact Gold timeline has 23 complete punches in 2s');
for(let i=0;i<punches.length;i++){
 assert.equal(punches[i].atMs,3102+i*85);
 assert.equal(punches[i].impactAtMs,punches[i].atMs+50);
 assert.ok(punches[i].impactAtMs<=5102);
}
assert.equal(has('boxe:flurry-finished').length,1);
assert.equal(has('boxe:flurry-finished')[0].punchCount,23); // cast 300 + 5000
ctrl.advance(5300);assert.equal(ctrl.snapshot().rocket.phase,'returning');
assert.equal(ctrl.rocketCatch(5400),true);
assert.equal(ctrl.snapshot().cooldowns.A1,15000,'cooldown begins only on physical catch');
assert.equal(has('arena:equip-queued-gun-request').length,0);
ctrl.setWeaponFireCycle(false,5401);
assert.equal(has('arena:equip-queued-gun-request').length,1);
assert.equal(has('arena:equip-queued-gun-request')[0].gunId,'PISTOL');
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
// Initial three-card semantics: ZERO auto-free grants, random choices do not
// imply automatic acquisition, finite cards have no duplicates in one offer.
const w=upgradeState();
assert.throws(()=>offerThreeCards(w,{seed:19}),/NO_LEVEL_UP_PENDING/);
const unlockedXP=new Set();
recordAuthorizedKill(w,{killId:'training-authorized-kill',xp:60},unlockedXP);
assert.equal(w.pendingLevelUps,1);
assert.deepEqual(unlockedKeys(w),['J','K','L']);assert.deepEqual(enabledGoldSkills(w),[]);
const o=offerThreeCards(w,{seed:19});
assert.equal(o.length,3);assert.equal(new Set(o.map(x=>x.id)).size,3);
assert.deepEqual(unlockedKeys(w),['J','K','L']);
assert.throws(()=>chooseCard(w,'unlock-ultimate'),/CARD_NOT_OFFERED/);
chooseCard(w,o[0].id);
assert.equal(w.pending,null);assert.equal(w.pendingLevelUps,0);
assert.ok(!w.owned.has('unlock-ultimate'));
assert.throws(()=>offerThreeCards({...w,pending:['x']},{seed:1}),/UNRESOLVED/);
// Explicit upgrade ordering is by SELECTED cards, never by reaching level.
const ranks=BOXE_WAVE.goldUpgradeOrder;
for(const entry of ranks){
 const cards=createWaveUpgradePool().filter(x=>x.kind==='unlock');
 const card=cards.find(x=>x.id===entry.id);
 assert.ok(card.requires.every(x=>w.owned.has(x))||card.requires.length>0||entry.rank===1);
 w.owned.add(entry.id);
}
assert.deepEqual(unlockedKeys(w),['J','K','L','U','I']);
assert.deepEqual(enabledGoldSkills(w),['1','3','9','5','0']);
assert.equal(ranks.at(-1).goldKey,'0');
assert.ok(!w.owned.has('unlock-rocket-proc'),'rocket remains independently card-gated');
assert.equal(createWaveUpgradePool().find(x=>x.id==='unlock-rocket-proc').goldKey,'2');
const kills=new Set(),s=upgradeState();
assert.equal(recordAuthorizedKill(s,{killId:'robot-42',xp:70},kills).accepted,true);
assert.equal(recordAuthorizedKill(s,{killId:'robot-42',xp:70},kills).accepted,false);
assert.equal(s.totalXp,70);
const chain=upgradeState(),chainKills=new Set();
const chainEvent=recordAuthorizedKill(chain,{killId:'wave-boss-unique',xp:1200},chainKills);
assert.ok(chainEvent.levels>=3);assert.equal(chain.pendingLevelUps,chainEvent.levels);
for(let i=0;i<chainEvent.levels;i++){
 const cards=offerThreeCards(chain,{seed:0xB0AE});
 assert.equal(cards.length,3);
 chooseCard(chain,cards[0].id);
}
assert.equal(chain.pendingLevelUps,0);
assert.equal(waveDescriptor(5,DEFAULT_ROBOTS).boss,true);
assert.deepEqual(waveDescriptor(10,DEFAULT_ROBOTS).candidates,['bossOmega']);
assert.deepEqual(waveDescriptor(15,DEFAULT_ROBOTS).candidates,['bossEndless']);
assert.equal(waveDescriptor(20,DEFAULT_ROBOTS).boss,true);
assert.equal(waveDescriptor(2,DEFAULT_ROBOTS).boss,false);
const ext={...DEFAULT_ROBOTS,'flying-mech':{minWave:2,boss:false}};
assert.ok(waveDescriptor(2,ext).candidates.includes('flying-mech'));
console.log('BOXE Owner R2 PASS: auto skills 0 damage; 10% finisher; 300/3s/x2; repeated stun/disarm; Gold rocket 5s; catch gun queue; BOT WAVE gated J/K/L, three random upgrade offers; wave 5/10 bosses; extension registry');

// Inspect C04 profile when fighter explicitly states damage 0: the keyword
// "hit" alone must not invent ability HP damage for BOXE.
const {heroProfile}=await import('../src/game/cosmetics/fieldArchiveProfiles.js');
const zeroHero={archiveProfile:{traits:{damage:0}},skills:{PASSIVE:{mechanicId:'hit_power',baseConfig:{damage:0}},A1:{mechanicId:'rocket_hit',baseConfig:{impactStunMs:500}},A2:{mechanicId:'block_and_hit',baseConfig:{duration:1}}}};
assert.equal(heroProfile(zeroHero).axes.find(x=>x.key==='damage').value,0);
console.log('C04 radar owner-defined zero damage override PASS');
