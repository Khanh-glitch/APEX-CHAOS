#!/usr/bin/env node
// APEX CHAOS CP4 — content admission (read-only; fail closed).
// Not a second gameplay registry. This file freezes the accepted BASELINE IDs
// and verifies declarations for ANY additions found in the REAL game registries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { bootHarness } from './lib/crystalaHarness.mjs';
import { BASE_HERO_IDS, BASE_WEAPON_IDS } from './lib/contentBaseline.mjs';
import { COPY, translateCopy } from '../src/game/localeCatalog.js';

const EXPECTED_HEROES=BASE_HERO_IDS;
const EXPECTED_WEAPONS=BASE_WEAPON_IDS;
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
  // Detect new definitions that never reached the actual pickup registry.
  for(const e of (cfg.GUN_REGISTRY||[]))
    if(!weaponIds.includes(e.id))issue(e.id,'registered gun absent from P0 pickup pool');
  for(const id of Object.keys(cfg.V43_WEAPONS||{}))
    if(!weaponIds.includes(id))issue(id,'special defined but absent from P0 pickup pool');
  const newHeroCount=heroIds.filter(id=>!heroBase.has(id)).length;
  if(newHeroCount && typeof reg.validateRegistry==='function'){
    const verdict=reg.validateRegistry();
    if(!verdict.ok)issue('hero-registry','production validator rejects extensions; CP5 revision cutover required');
  }
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
    // Mandatory executable evidence, not just an unverified tests[] label.
    for(const kind of ['combat','interactions','teardown']){
      const test=r.proofTests?.[kind];
      if(typeof test!=='string'||!r.tests?.includes(test)||!test.startsWith('tools/')
        ||test.includes('..')||!fs.existsSync(test)){
        issue(r.id,'missing runnable proofTests.'+kind);
      }else{
        const source=fs.readFileSync(test,'utf8');
        if(!source.includes('bootHarness') || !source.includes('APEX_ARSENAL'))
          issue(r.id,'proofTests.'+kind+' must drive real Arsenal through bootHarness');
        if(!source.includes(r.id))
          issue(r.id,'proofTests.'+kind+' never references the new content ID');
        if(kind==='teardown' && !source.includes('exitArsenalBattleMode'))
          issue(r.id,'proofTests.teardown must exercise a real battle exit/rematch');
      }
    }
    // Source-copy localisation is keyed by *English text*, not symbolic IDs.
    // Require real, executable VIE translation in the shipping catalog.
    if(!Array.isArray(r.localizedCopy)||!r.localizedCopy.length)
      issue(r.id,'localizedCopy requires at least one EN/VIE source-copy pair');
    else for(const pair of r.localizedCopy){
      if(!isRecord(pair)||typeof pair.en!=='string'||typeof pair.vi!=='string'
        ||!pair.en.trim()||!pair.vi.trim()||pair.en===pair.vi
        ||COPY[pair.en]!==pair.vi||translateCopy(pair.en,'vie')!==pair.vi)
        issue(r.id,'EN/VIE pair must exist in live localeCatalog');
    }
    if(r.releaseStage==='approved' && Object.values(r.interactions||{}).includes('requires-review'))
      issue(r.id,'approved content cannot retain unresolved interaction rules');
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
    if(!tier)issue(r.id,'missing live tier definition');
    if((tier==='T1'||tier==='T2')&&!cfg.BY_TIER?.[tier]?.includes(r.id))
      issue(r.id,'declared Quest tier missing from actual BY_TIER pool');
    if(r.executorType==='v43-special' && !cfg.V43_SPECIAL_IDS?.includes(r.id))
      issue(r.id,'special is absent from canonical special ID list');
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

// CP5.4 REAL Registry canary: append a test-only 13th record, verify the
// original 12/36 remain a required subset and malformed extensions fail.
// This is NOT a new playable Fighter, executor, art asset or production ID.
{
  const id='CP5_CANARY_HERO';
  const heroes=live.reg.HEROES;
  const before=Object.keys(heroes);
  assert.equal(before.length,EXPECTED_HEROES.length,'fixture assumes original roster');
  const base=heroes.ROBOT;
  try {
    heroes[id]={...base,id,displayName:'CP5 Canary (test only)'};
    const v=live.reg.validateRegistry();
    assert.equal(v.ok,true,'13th well-formed canary rejected: '+v.errors.slice(0,3).join('; '));
    assert.equal(v.heroCount,13);
    assert.equal(v.skillCount,39);
    assert.deepEqual(Object.keys(heroes).slice(0,12),before,
      'original insertion order changed');
    assert.equal(live.reg.resolveHeroId(id),id,'registered extension ID must resolve');
    assert.equal(live.reg.displayNameFor(id),'CP5 Canary (test only)');
    assert.equal(live.surface.isPublicPlayableFighter(id),false,
      'new registry identity must remain product-locked');
    assert.deepEqual(live.reg.resolveSkillLevel(id,'A1',1),
      live.reg.resolveSkillLevel('ROBOT','A1',1),
      'test canary must inherit deterministic Lv1 configuration');
    // Even if the registry shape is valid, the CP4 admission contract must
    // still reject this undeclared hero until art/tests/locale/executor exist.
    const admission=inspect(manifest,live);
    assert.ok(admission.some(x=>x.includes(id)&&x.includes('lacks admission')),
      'registry extension must not bypass CP4 admission');
    heroes[id]={...base,id,skills:{...base.skills,A2:undefined}};
    const bad=live.reg.validateRegistry();
    assert.equal(bad.ok,false,'malformed 13th hero was accepted');
    assert.ok(bad.errors.some(x=>x.includes(id+'.A2')),
      'malformed extension must identify its missing skill');
  } finally { delete heroes[id]; }
  assert.deepEqual(Object.keys(heroes),before,'canary leaked into production registry');
  assert.equal(live.reg.validateRegistry().ok,true,'base registry damaged by fixture');
  console.log('CP5 HERO REGISTRY CANARY PASS: baseline 12/36, extension 13/39, invalid extension denied');
}

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
  tests:['tools/testContentInteractionBaseline.mjs'],
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

// Fail closed when the ledger claims VIE/ENG text that has no real catalog entry.
const badLocale=inspect({...manifest,weapons:[{...newGun,
  damageAuthority:'aqDamage',questExposure:'inherited-auto',
  proofTests:{combat:newGun.tests[0],interactions:newGun.tests[0],teardown:newGun.tests[0]},
  localizedCopy:[{en:'THIS IS NOT IN THE CATALOG',vi:'BẢN DỊCH GIẢ'}]}]},{...live,cfg:pretendCfg});
assert.ok(badLocale.some(e=>e.includes('EN/VIE pair must exist')),'must reject fake localisation');
// Special definitions not admitted to real spawn pool are never valid.
const omitted=inspect(manifest,{...live,cfg:{...live.cfg,
  GUN_REGISTRY:[...live.cfg.GUN_REGISTRY,{id:'SECRET_GUN',family:'SEMI'}]}});
assert.ok(omitted.some(e=>e.includes('SECRET_GUN')&&e.includes('absent from P0')),
  'must reject invisible special or conventional gun definitions');
// Declare all three runnable proofs, not a single arbitrary file.
assert.ok(withoutTests.some(e=>e.includes('missing runnable proofTests.')),
  'must reject content without category-specific evidence');
// Existing baseline smoke scripts must not be re-used as fake new-ID evidence.
assert.ok(badLocale.some(e=>e.includes('never references the new content ID')),
  'must reject proof script that never mentions the new weapon');

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
  +EXPECTED_WEAPONS.length+' canonical weapons; '+scripts.size+' extension tests; 9 fail-closed assertions');
process.exit(0);
