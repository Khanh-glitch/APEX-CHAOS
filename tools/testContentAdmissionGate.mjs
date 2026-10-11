#!/usr/bin/env node
// APEX CHAOS CP4 — content admission (read-only; fail closed).
// Not a second gameplay registry. This file freezes the accepted BASELINE IDs
// and verifies declarations for ANY additions found in the REAL game registries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { bootHarness } from './lib/crystalaHarness.mjs';

const EXPECTED_HEROES = Object.freeze([
  'ROBOT','CRYSTAL','MAGNET','BLACK_HOLE','MATH_V2','ICE',
  'RUBBER','HUNTER','TIME','MIRROR','SLIME','SNIPER'
]);
const EXPECTED_WEAPONS = Object.freeze([
  'PISTOL','SMG','SHOTGUN','SNIPER','GLOCK_17','BERETTA_93R',
  'DESERT_DEAGLE','MAGNUM_500','SZECSEI_FUCHS','TEC_9',
  'MAC_10','P90','AK_47','M16','ZBROYAR_Z15',
  'ZBROYAR_Z15_S1','ZBROYAR_Z15_S2','ZBROYAR_Z15_S3',
  'M249_SAW','MBR','MBR2','MOSSBERG_500','SAWED_OFF',
  'JACKHAMMER','FLARE_GUN','TACTICAL_CROSSBOW',
  'STEEL_BALL_LAUNCHER','COMBAT_BOOMERANG','RPG_7',
  'FLAMETHROWER','PLASMA_SPLITTER','SHRAPNEL_MINE_LAUNCHER',
  'GRENADE','SABRE','BATTLE_AXE','DAGGER','SPEAR',
  'SPIKED_CLUB','STORMBREAKER','SWIRL_SHIELD','TOWER_SHIELD'
]);
const VALID_ID = /^[A-Z][A-Z0-9_]*$/;
const allowedStages = ['development','candidate','approved'];
const allowedExecutorTypes = ['gun-family','v43-special','equipment'];
const interactions = ['reflect','magnet','mirror','freeze','capture','T6'];
const choices = ['allowed','denied','not-applicable','requires-review'];
const isRecord = x => x && typeof x === 'object' && !Array.isArray(x);
const H = await bootHarness(), w=H.win;
const live = {
  cfg:w.APEX_ARSENAL_CONFIG,
  reg:w.APEX_HERO_REWORK_REGISTRY,
  mech:w.APEX_HERO_REWORK_MECHANICS,
  surface:w.APEX_PRODUCT_SURFACE,
};
function inspect(manifest, {cfg,reg,mech,surface}) {
  const issues=[];
  const issue=(key,msg)=>issues.push(key+': '+msg);
  if (!isRecord(manifest) || manifest.schemaVersion!==1
    || !Array.isArray(manifest.heroes) || !Array.isArray(manifest.weapons))
    return ['manifest schemaVersion=1, heroes[] and weapons[] required'];
  const heroIds=Object.keys(reg.HEROES), weaponIds=Array.from(cfg.P0_WEAPON_IDS);
  const heroBase=new Set(EXPECTED_HEROES), weaponBase=new Set(EXPECTED_WEAPONS);
  for (const id of heroBase) if(!heroIds.includes(id)) issue(id,'legacy hero removed');
  for (const id of weaponBase) if(!weaponIds.includes(id)) issue(id,'legacy equipment removed');
  for (const [tag,ids] of [['heroes',heroIds],['weapons',weaponIds]])
    if(new Set(ids).size!==ids.length)issue(tag,'duplicate live registry IDs');
  const newHeroes=heroIds.filter(id=>!heroBase.has(id));
  const newWeapons=weaponIds.filter(id=>!weaponBase.has(id));
  const verifyIndex=(kind,records,added)=>{
    const seen=new Set();
    for(const r of records){
      if(!isRecord(r)||typeof r.id!=='string'||!VALID_ID.test(r.id)){
        issue(kind,'invalid extension ID');continue;
      }
      if(seen.has(r.id))issue(r.id,'duplicate declaration');
      seen.add(r.id);
      if(!added.includes(r.id))issue(r.id,'stale/undeployed declaration; not a new live ID');
    }
    for(const id of added)if(!seen.has(id))issue(id,'new live ID lacks admission declaration');
  };
  verifyIndex('heroes',manifest.heroes,newHeroes);
  verifyIndex('weapons',manifest.weapons,newWeapons);
  const validateFileList=(r,kind)=>{
    if(!Array.isArray(r[kind])||r[kind].length===0){
      issue(r.id,kind+' must be nonempty');return;
    }
    for(const p of r[kind]){
      if(typeof p!=='string'||p.includes('..')||p.startsWith('/')||!p.startsWith(kind==='tests'?'tools/':'public/assets/')
        || !fs.existsSync(p))issue(r.id,'missing/unsafe '+kind+' path: '+p);
      if(kind==='tests' && !String(p).endsWith('.mjs'))issue(r.id,'test must be .mjs');
    }
  };
  const basics=r=>{
    if(!allowedStages.includes(r.releaseStage))issue(r.id,'invalid releaseStage');
    validateFileList(r,'tests');
    validateFileList(r,'assets');
    if(r.releaseStage==='approved'
      && (!(typeof r.ownerApprovalDocument==='string')||!r.ownerApprovalDocument.startsWith('docs/')
        ||r.ownerApprovalDocument.includes('..')||!fs.existsSync(r.ownerApprovalDocument)))
      issue(r.id,'approved content needs verifiable owner review document');
  };
  for(const r of manifest.heroes){
    if(!isRecord(r)||!VALID_ID.test(r.id||''))continue;
    basics(r);
    const def=reg.HEROES[r.id];
    if(!def){issue(r.id,'missing hero definition');continue;}
    const skillIds=['PASSIVE','A1','A2'].map(slot=>def.skills?.[slot]?.mechanicId);
    for(const id of skillIds)if(!id||!mech.EXECUTORS[id])issue(r.id,'missing mechanic executor '+id);
    if(!Array.isArray(r.projectileFamilies)||!r.projectileFamilies.length)
      issue(r.id,'must declare produced projectile families (or ["none"])');
    if(!isRecord(r.interactions))issue(r.id,'missing hero interaction declaration');
    else for(const a of interactions)if(!choices.includes(r.interactions[a]))
      issue(r.id,'missing decision for '+a);
    if(!Array.isArray(r.localizationKeys)||!r.localizationKeys.length)
      issue(r.id,'missing language keys for both VIE/ENG copy review');
    if(surface.isPublicPlayableFighter(r.id) && r.releaseStage!=='approved')
      issue(r.id,'unexpected public playable hero without approved release');
  }
  for(const r of manifest.weapons){
    if(!isRecord(r)||!VALID_ID.test(r.id||''))continue;
    basics(r);
    const spec=cfg.WEAPONS[r.id];
    if(!spec){issue(r.id,'missing Arsenal weapon config');continue;}
    if(!allowedExecutorTypes.includes(r.executorType))issue(r.id,'unapproved executor type');
    if(r.damageAuthority!=='aqDamage')issue(r.id,'must use native aqDamage authority');
    const gun=cfg.GUN_REGISTRY.find(e=>e.id===r.id);
    const special=cfg.V43_WEAPONS[r.id];
    if(r.executorType==='gun-family'
      && (!gun||!cfg.GUN_FAMILIES[gun.family]))issue(r.id,'missing conventional family executor');
    if(r.executorType==='v43-special'){
      if(!special)issue(r.id,'missing V43 special config');
      else if(!Array.isArray(special.reflectableKinds)||!Array.isArray(special.magnetizableKinds)
        ||!special.kind)issue(r.id,'V43 capability kinds must be declared in canonical config');
    }
    if(!isRecord(r.interactions))issue(r.id,'missing weapon interaction declaration');
    else for(const a of interactions)if(!choices.includes(r.interactions[a]))
      issue(r.id,'missing decision for '+a);
    const tier=cfg.tierOf(r.id);
    if((tier==='T1'||tier==='T2')&&r.questExposure!=='inherited-auto')
      issue(r.id,'T1/T2 already enter Quest by tier; declare inherited-auto or change route in a reviewed patch');
    if(tier!=='T1'&&tier!=='T2'&&r.questExposure!=='not-auto')
      issue(r.id,'must declare not-auto for tier '+tier);
  }
  return issues;
}
const path='docs/architecture/content-admission/extensions.json';
const manifest=JSON.parse(fs.readFileSync(path,'utf8'));
const issues=inspect(manifest,live);
assert.deepEqual(issues,[],'live content admission failed');

// Negative / mutation testing ensures the gate is not ceremonial.
const withNew={...live,cfg:{...live.cfg,P0_WEAPON_IDS:[...live.cfg.P0_WEAPON_IDS,'NEW_GUN']}};
assert.ok(inspect(manifest,withNew).some(e=>e.includes('NEW_GUN')&&e.includes('lacks admission')),
  'must reject undeclared new weapon');
const withHero={...live,reg:{...live.reg,HEROES:{...live.reg.HEROES,NEW_HERO:{skills:{}}}}};
assert.ok(inspect(manifest,withHero).some(e=>e.includes('NEW_HERO')&&e.includes('lacks admission')),
  'must reject undeclared new hero');
const newGun={
  id:'NEW_GUN',releaseStage:'development',executorType:'gun-family',
  damageAuthority:'WRONG',questExposure:'not-auto',
  tests:['tools/testContentAdmissionGate.mjs'],
  assets:['public/assets/arsenal/v43/FLARE_GUN.webp'],
  interactions:Object.fromEntries(interactions.map(i=>[i,'requires-review']))
};
const pretendCfg={...live.cfg,P0_WEAPON_IDS:[...live.cfg.P0_WEAPON_IDS,'NEW_GUN'],
  WEAPONS:{...live.cfg.WEAPONS,NEW_GUN:{family:'SEMI'}},
  GUN_REGISTRY:[...live.cfg.GUN_REGISTRY,{id:'NEW_GUN',family:'SEMI'}],
  tierOf:id=>id==='NEW_GUN'?'T2':live.cfg.tierOf(id)};
const negative=inspect({...manifest,weapons:[newGun]},{...live,cfg:pretendCfg});
assert.ok(negative.some(e=>e.includes('native aqDamage authority')),'must reject alternate damage');
assert.ok(negative.some(e=>e.includes('T1/T2 already enter Quest')),'must reject silent Quest exposure');
const withoutTests=inspect({...manifest,weapons:[{...newGun,
  damageAuthority:'aqDamage',questExposure:'inherited-auto',tests:[]}]},{...live,cfg:pretendCfg});
assert.ok(withoutTests.some(e=>e.includes('tests must be nonempty')),'must reject missing proof');

// Every declared regression script must run and pass (none for canonical baseline).
const scripts=new Set([...manifest.heroes,...manifest.weapons].flatMap(e=>e.tests||[]));
for(const test of scripts){
  const out=spawnSync(process.execPath,[test],{encoding:'utf8',timeout:180000,stdio:'pipe'});
  if(out.status!==0){
    console.error((out.stdout||'').slice(-2000),(out.stderr||'').slice(-2000));
    throw Error('content-specific real test failed: '+test+' status='+out.status);
  }
}
console.log('CP4 CONTENT ADMISSION PASS: '+EXPECTED_HEROES.length+' canonical heroes, '
  +EXPECTED_WEAPONS.length+' canonical weapons; '+scripts.size+' extension tests; 5 fail-closed assertions');
process.exit(0);
