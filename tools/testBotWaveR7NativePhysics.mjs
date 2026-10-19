import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('public/game/bot-wave/nativeArsenalGoldBridge.js','utf8');
const win={};
vm.runInNewContext(source,{window:win,globalThis:win,Math,console},{timeout:1500});
const guns={PISTOL:{shots:3,damagePerShot:4.5},SHOTGUN:{shots:2,pellets:8,damagePerPellet:3.6}};
const records=Object.keys(guns).map((id,ordinal)=>({id,ordinal,
 family:id==='SHOTGUN'?'SHOTGUN':'SEMI',role:'fire',spec:guns[id]}));
const campaign={indexNative:()=>({records,allWeaponIds:Object.keys(guns)})};
for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[.6,.8]]){
 const player={id:12,x:0,y:0,vx:7,vy:-4,r:30,hp:1000};
 const engine={player,fx:{flash(){}},material:{dust(){}},
  damagePlayer(amount,fromAngle){
   player.hp-=amount;player.vx+=Math.cos(fromAngle)*260;player.vy+=Math.sin(fromAngle)*260;
  }};
 const armory=win.APEX_BOT_WAVE_NATIVE_BRIDGE.createArmory({engine,config:{WEAPONS:guns},campaign});
 assert.strictEqual(armory.weapons.PISTOL.native,guns.PISTOL,'Native Arsenal spec reference changed');
 assert.equal(armory.weapons.SHOTGUN.mag,2,'Two native shotgun volleys required');
 const proxy=win.fighters[0],sourceActor={x:1000+300*dx,y:1000+300*dy};
 proxy.takeDamage(31.5,sourceActor,'arsenal-pistol');
 assert.equal(player.hp,968.5,'Damage must not be scaled again by Wave adapter');
 assert.ok(Math.abs(player.vx-7)<1e-7&&Math.abs(player.vy+4)<1e-7,'Gold recoil double applied');
 proxy.applyStatus('push',.18,{x:-dx,y:-dy,strength:120});
 assert.ok(Math.abs(player.vx-(7-21.6*dx))<1e-7&&Math.abs(player.vy-(-4-21.6*dy))<1e-7,
  'Native push must drive BOXE away from attacking gun');
}
const wave=fs.readFileSync('public/bot-wave/game.html','utf8');
const plan=fs.readFileSync('public/game/bot-wave/waveCampaign.js','utf8');
assert.ok(wave.includes('CAMPAIGN.survival.startingHP')&&plan.includes('startingHP:1000')&&plan.includes('baseKillHealFraction:.005'));
assert.ok(plan.includes('gunDamageScalar:1,gunCadenceScalar:1,gunProjectileSpeedScalar:1'));
const ui=fs.readFileSync('public/game/bot-wave/botWavePresentationV2.js','utf8');
const home=fs.readFileSync('src/App.jsx','utf8');
assert.ok(ui.includes('boxe:1.95,weapons:.14')&&!ui.includes('bw-action-art')&&
 home.includes('class="apex-wave-entry-art"')&&
 home.includes('/assets/dictionary/heroes/boxe/avatar.png'),
 'The transparent BOXE avatar must belong to Home event entry, not J/K/L/U/I keys');
const av=fs.readFileSync('public/game/arsenal/arsenalPresentationRuntime.js','utf8');
assert.ok(av.includes('createDynamicsCompressor')&&av.includes('if(released)return'));
console.log('PASS BOT WAVE R7 native knockback on five directions, exact HP amount, source Arsenal shells and Gold audio headroom');
