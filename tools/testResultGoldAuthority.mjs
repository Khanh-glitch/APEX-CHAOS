import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={window:{},console};context.globalThis=context.window;
vm.createContext(context);
for(const p of ['public/game/results/ownerAwards.generated.js','public/game/results/matchResultAuthority.js'])
  vm.runInContext(readFileSync(p,'utf8'),context,{filename:p,timeout:7000});
const scope=context.window;
const defs=scope.APEX_RESULT_OWNER_CATALOG;
assert.equal(defs.length,47,'47 owner-approved earnable definitions only');
assert.equal(new Set(defs.map(d=>d.id)).size,47);
assert.ok(!defs.some(d=>d.id==='bullet-storm'),'Owner dropped titles must not exist');
assert.ok(scope.APEX_MATCH_RESULT_AUTHORITY?.create);
function duel(name1='ROBOT',name2='ROBOT'){
 const f1={name:name1,x:200,y:500,hp:1000,maxHp:1000};
 const f2={name:name2,x:800,y:500,hp:1000,maxHp:1000};
 const C={WEAPONS:{PISTOL:{family:'SEMI'},GLOCK_17:{family:'SEMI'}},tierOf:()=> 'T1'};
 const ledger=scope.APEX_MATCH_RESULT_AUTHORITY.create({actors:[f1,f2],mode:'LOCAL',weaponConfig:C,startedAt:10000});
 return {f1,f2,ledger};
}
{
 const {f1,f2,ledger}=duel();
 f2.hp=700;ledger.onDamage(f2,f1,'arsenal-pistol',300,false,{x:700,y:500,vx:1,vy:0});
 f1.hp=880;ledger.onDamage(f1,f2,'arsenal-pistol',120,false,null);
 f2.hp=630;ledger.onDamage(f2,f1,'arsenal-pistol',70,false,null);
 ledger.onShot(f1,'PISTOL');ledger.onPickup(f1,'PISTOL');ledger.onCast(f1);
 ledger.tick(1/60);
 const res=ledger.seal('P1');
 assert.equal(res.players[0].outcome,'victory');
 assert.equal(res.players[1].outcome,'defeat');
 assert.equal(res.players[0].character.heroId,'NEWBOT');
 assert.equal(res.players[1].character.heroId,'NEWBOT');
 assert.equal(res.players[0].damage.dealt,370);
 assert.equal(res.players[1].damage.dealt,120);
 assert.equal(res.weaponOfTheBattle.weaponId,'PISTOL');
 assert.equal(res.weaponOfTheBattle.damage,490,'ONE weapon ID summed across both real sides');
 assert.equal(res.weapons.find(w=>w.id==='PISTOL').artSrc,'/assets/arsenal/weapons/c/PISTOL.png');
 assert.equal(res.weapons.find(w=>w.id==='PISTOL').stats.shotsFired,1);
 assert.equal(res.weapons.find(w=>w.id==='PISTOL').stats.shotsHit,3);
 assert.equal(res.players[0].damage.sources.find(s=>s.weaponId==='PISTOL').damage,370);
 assert.ok(res.players[0].awards.some(a=>a.achievementId==='first-blood'));
 assert.ok(!res.players[1].awards.some(a=>a.achievementId==='first-blood'));
 assert.equal(res,ledger.seal('P2'),'KO must seal exactly once, no duplicate awards');
 assert.equal(res.players[0].character.portraitSrc,'/assets/gold-ui/heroes/newbot/pick_selected_large.webp');
 assert.equal(res.players[0].stats.healing,0);
}
{
 const {f1,f2,ledger}=duel('MIRROR','ROBOT');
 ledger.tick(0.2);
 const res=ledger.seal('P2');
 assert.equal(res.weaponOfTheBattle.weaponId,'');
 assert.equal(res.weaponOfTheBattle.damage,0);
 assert.equal(res.players[0].awards.length,0,'no fabricated medals in no-damage match');
 assert.equal(res.players[0].character.portraitSrc,'/assets/gold-ui/heroes/mirror/pick_roster_cover.webp');
 assert.equal(res.players[1].outcome,'victory');
}
const battle=readFileSync('public/game/modes/arsenalBattleRuntime.js','utf8');
const bridge=readFileSync('public/game/gold/goldProductBridge.js','utf8');
const runtime=readFileSync('src/game/runtimeManifest.js','utf8');
assert.match(battle,/!AQ\.state\.questMultiActor&&!AQ\.state\.labMode/,'Quest/Lab never award Free Battle');
assert.match(battle,/state\.resultGold=state\.resultLedger\?\.seal\?\.\(winnerSide\)/);
assert.match(bridge,/const resolved=window\.APEX_ARSENAL\?\.state\?\.resultGold/);
assert.match(bridge,/event\.source!==resultFrame\.contentWindow/);
assert.match(bridge,/event\.origin!==window\.location\.origin/);
assert.match(bridge,/event\.data\.matchId===resultData\?\.meta\?\.id/);
assert.match(runtime,/matchResultAuthority\.js/);
const app=readFileSync('result-gold/src/App.tsx','utf8');
assert.match(app,/APEX_RESULT_GOLD_PAYLOAD/);
assert.doesNotMatch(app,/\bFIXTURE_MATCH\b/);
console.log('RESULT GOLD NATIVE CONTRACT PASS: 47 owner titles, 3 dropped, exact fighter identity, summed weapon, real damage, zero-damage, secure iframe and single-KO seal');
