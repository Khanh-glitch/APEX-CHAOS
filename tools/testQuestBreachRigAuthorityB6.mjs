import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root={};root.window=root;
vm.runInNewContext(readFileSync('public/game/quest/questBreachRigAuthority.js','utf8'),root);
const waves=[['A',3],['B',4],['C',3]];
const policy={ORDER:waves.map(w=>w[0]),resolveWave:id=>({hostiles:Array.from({length:waves.find(w=>w[0]===id)[1]})}),
 waveOutcome:(a,id)=>({status:a.length===3+waves.find(w=>w[0]===id)[1]&&a.slice(3).every(f=>f.hp===0)?'COMPLETE':'ACTIVE'})};
const newF=(id,team,hp=1000)=>({questId:id,questTeam:team,hp,maxHp:hp,withdrawn:false});
const allies=['NEWBOT','T.O.T','RIVET'].map(id=>newF(id,'ALLY'));
const roster=(n,dead=false)=>[...allies,...Array.from({length:n},(_,i)=>{const f=newF('ENEMY-'+i,'HOSTILE',300);if(dead)f.hp=0;return f;})];
const rig=root.APEX_QUEST_BREACH_RIG.create(policy);
const ok=(a,label)=>{assert.ok(a,label);console.log('PASS '+label);};
ok(!rig.acknowledgeBeat('E06_NETWORK_SCAN').ok,'no scan before physical victory');
ok(!rig.acknowledgeLock(roster(2)).ok,'reject incorrect native opening roster');
ok(rig.acknowledgeLock(roster(3)).ok,'real trio enters passive-rig front line');
ok(rig.snapshot().receipts[0].detail.automaticFire===false,'rig cannot fire automatically');
ok(!rig.acknowledgeLock(roster(3)).ok,'rig lock single-use');
ok(!rig.acceptNativeWaveClear(roster(3),null).ok,'no fabricated early victory');
const signed={snapshot:()=>({wave:'C',phase:'COMPLETE',completed:3,receipts:waves.map(([wave,n])=>({
 wave,physicalKOs:Array.from({length:n},(_,i)=>({id:wave+i,hp:0,maxHp:300})),
 allies:allies.map(x=>({id:x.questId,hp:x.hp,maxHp:x.maxHp}))
}))})};
ok(!rig.acceptNativeWaveClear(roster(3,true),signed).ok,'reject final wave wrong size');
ok(!rig.acceptNativeWaveClear([...allies.map(a=>({...a})),...roster(3,true).slice(3)],signed).ok,'reject replaced ally instances');
ok(!rig.acceptNativeWaveClear(roster(3,true),{snapshot:()=>({...signed.snapshot(),completed:2})}).ok,'reject incomplete wave ledger');
ok(rig.acceptNativeWaveClear(roster(3,true),signed).ok,'only three genuinely signed waves advance');
ok(!rig.acceptNativeWaveClear(roster(3,true),signed).ok,'double progression refused');
ok(!rig.acknowledgeBeat('E06_RIG_RETURN').ok,'no skipped relay or scan');
for(const cue of ['E06_RELAY_REPLY','E06_NETWORK_SCAN','E06_RIG_RETURN','E06_OVERRIDE_BUILDUP'])
 ok(rig.acknowledgeBeat(cue).ok,'ordered story '+cue);
ok(rig.snapshot().readyForE07,'ready state is non-saving');
rig.close();ok(!rig.acknowledgeBeat('E06_RELAY_REPLY').ok,'closed encounter cannot advance');
