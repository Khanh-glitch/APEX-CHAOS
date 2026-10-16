// Field Archive / canonical Hero Registry / BOXE Battle parity.
 // Fail on any skill value mismatch before a playtest artifact can ship.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {BOXE_BATTLE} from '../src/game/boxe/boxeConfig.js';
import {skillRecords} from '../src/game/cosmetics/fieldArchiveProfiles.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const scope={console};scope.globalThis=scope;
vm.runInNewContext(read('public/game/hero-rework/heroRegistry.js'),scope);
vm.runInNewContext(read('public/game/hero-rework/boxeBattleRuntime.js'),scope);
const REG=scope.APEX_HERO_REWORK_REGISTRY,H=REG.HEROES.BOXE;
const V=scope.APEX_BOXE_BATTLE.values;
assert.ok(REG.validateRegistry().ok);
const a=H.skills.A1.baseConfig,b=H.skills.A2.baseConfig,h=H.skills.PASSIVE.baseConfig;
const pairs=[
['heat threshold',h.damageThreshold,V.passiveThreshold],
['heat duration',h.enhancedSeconds,V.enhancedSeconds],
['heat recovery',h.cooldownRecoveryMultiplier,BOXE_BATTLE.passive.cooldownRecoveryMultiplier],
['A1 outbound duration',a.outboundSeconds,V.rocketOutboundSeconds],
['A1 outbound speed',a.flightSpeed,V.rocketSpeed],
['A1 return speed',a.returnSpeed,V.rocketReturnSpeed],
['A1 stun cap',a.impactStunSeconds,V.rocketStunSeconds],
['A1 stun semantic (ms)',a.impactStunSeconds*1000,BOXE_BATTLE.a1.impactStunMaxMs],
['A1 cooldown',a.cooldown*1000,BOXE_BATTLE.a1.cooldownMs],
['flurry duration',a.flurrySeconds,V.flurrySeconds],
['flurry duration semantic (ms)',a.flurrySeconds*1000,BOXE_BATTLE.a1.enhanced.durationMs],
['flurry interval',a.flurryInterval,V.flurryInterval],
['flurry period semantic (ms)',a.flurryInterval*1000,BOXE_BATTLE.a1.enhanced.punchPeriodMs],
['flurry punches',a.flurryPunches,V.flurryPunches],
['flurry punch semantic',a.flurryPunches,BOXE_BATTLE.a1.enhanced.punchCount],
['flurry stun cap',a.flurryHitStunSeconds,V.flurryHitStunSeconds],
['flurry stun semantic (ms)',a.flurryHitStunSeconds*1000,BOXE_BATTLE.a1.enhanced.impactStunMaxMs],
['heavy jab every',a.flurryHeavyEvery,V.flurryHeavyEvery],
['heavy push ratio',a.flurryHeavyPushRatio,V.flurryHeavyPushRatio],
['A1 carries floor gun',a.maxGroundGuns,BOXE_BATTLE.a1.maxGroundGuns],
['A1 disarm',a.disarmOnHit,BOXE_BATTLE.a1.disarm],
['A2 cooldown',b.cooldown*1000,BOXE_BATTLE.a2.cooldownMs],
['A2 guard',b.guardSeconds,V.counterGuardSeconds],
['A2 guard semantic',b.guardSeconds*1000,BOXE_BATTLE.a2.guardMs],
['A2 stun',b.counterStunSeconds,V.counterStunSeconds],
['A2 stun semantic',b.counterStunSeconds*1000,BOXE_BATTLE.a2.counterStunMs],
['A2 finisher',b.finisherFractionRemainingHP,V.finisherRemainingFraction],
['A2 finisher semantic',b.finisherFractionRemainingHP,BOXE_BATTLE.a2.enhanced.finisherFractionOfRemainingHP]
];
for(const [label,actual,expected] of pairs)
 assert.ok(Math.abs(Number(actual)-Number(expected))<1e-8, label+': registry '+actual+' != runtime/contract '+expected);
assert.equal(a.cooldownStarts,'after-both-gloves-caught');
assert.equal(a.manualFlurryCancel,'cancel-unplayed-and-recall-both');
assert.equal(a.naturalFlurryEnd,'recall-both');
assert.equal(BOXE_BATTLE.a1.enhanced.manualRecallCancelsRemaining,true);
assert.equal(BOXE_BATTLE.a1.enhanced.fullFlurryAutoRecallBoth,true);
assert.equal(BOXE_BATTLE.a1.enhanced.cooldownStartsAfterBothPhysicalCatches,true);
for(const slot of ['PASSIVE','A1','A2']){
 const d=H.skills[slot];
 assert.ok(d.displayName?.length>2,'missing '+slot+' title');
 assert.ok(d.archiveProfile?.description?.length>100,'missing '+slot+' mechanics');
 assert.ok(H.archiveProfile.skillArt?.[slot]?.startsWith('/assets/dictionary/heroes/boxe/'),
  'missing registered skill illustration '+slot);
}
assert.equal(skillRecords(H).length,3);
assert.equal(skillRecords(H)[1].name,'Fist Rocket');
const six={ROBOT:'newbot',HUNTER:'hunter',CRYSTAL:'crystala',
 MAGNET:'magnet',ICE:'frost',MIRROR:'mirror'};
for(const slug of Object.values(six))for(const ability of ['passive','a1','a2']){
 const p='public/assets/gold-ui/heroes/'+slug+'/skill_'+ability+'.webp';
 assert.ok(fs.existsSync(new URL('../'+p,import.meta.url)), 'missing Gold skill icon: '+p);
}
const archive=read('src/game/cosmetics/FieldArchiveCombatReadout.jsx');
assert.ok(archive.includes('skillArtwork(item,skill.slot)'),'Archive must use canonical art for all 3 slots');
assert.ok(archive.includes('GOLD_SKILL_ART'),'legacy skill art fallback lost');
console.log('PASS: Field Archive vs canonical BOXE runtime + semantic contract ('+pairs.length+' mechanics, six Gold trios)');
