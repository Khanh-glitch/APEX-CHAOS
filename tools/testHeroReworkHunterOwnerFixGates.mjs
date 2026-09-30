// Focused source gates for the 2026-09-30 Hunter owner-playtest patch.
import fs from 'node:fs';
const mech=fs.readFileSync('public/game/hero-rework/heroMechanicsRuntime.js','utf8');
const world=fs.readFileSync('public/game/hero-rework/heroReworkRuntime.js','utf8');
const gold=fs.readFileSync('public/game/hero-rework/hunterGoldV10.js','utf8');
const pres=fs.readFileSync('public/game/hero-rework/hunterPresentationRuntime.js','utf8');
const crystalPres=fs.readFileSync('public/game/hero-rework/crystalaPresentationRuntime.js','utf8');
const manifest=fs.readFileSync('src/game/runtimeManifest.js','utf8');
const checks={
  'A1-immediate-cast-origin':/origin:\{x:a\.x,y:a\.y\},trapId:null/.test(mech)&&/const snare=ctx\.api\.spawnSnare\(\{owner:ctx\.combatant,x:a\.x,y:a\.y/.test(mech),
  'A1-single-spawn-fallback':/if\(motion\.plant&&!c\.planted\)/.test(mech),
  'A1-visible-radius-only':/dist\(b\.x,b\.y,s\.x,s\.y\)<=s\.radius\)/.test(world)&&!/s\.radius\+b\.radius\*\.4/.test(world),
  'A1-exit-away':/a\.setDir\(-c\.axis\.x,-c\.axis\.y\)/.test(mech),
  'A1-gold-spring-world-displacement':/const offset=\(s\.castBaseX-s\.h\.x\.x\)\*s\.scale/.test(pres)&&/const off=motion\.offset\|\|0/.test(mech)&&/c\.origin\.x-c\.axis\.x\*off/.test(mech)&&!/recoilBudget/.test(pres),
  'trap-front-pass-survives-crystal-wrapper':/api\.renderPostWorld=postWorld/.test(pres)&&/bypassedPrevDraw&&g\.APEX_HUNTER_PRESENTATION\?\.renderPostWorld/.test(crystalPres),
  'A2-firearm-disarm':/held\.def\.category==='ranged'/.test(mech)&&/W\.consume\(hit,'hunter-a2-disarm'\)/.test(mech)&&/HunterA2Disarm/.test(mech),
  'A2-zero-direct-damage':/directDamage:0,swept:true/.test(mech),
  'movement-smear-removed':!/directional smear along the true velocity/.test(gold)&&/high-speed echo history above remains the sole movement afterimage/.test(gold),
  // Revision lineage: the Hunter owner-fix revision, or any later CRYSTALA revision that descends from it
  // (prep/a/b/c). The Hunter behaviour gates above are unchanged and still enforce the owner-fix itself.
  'runtime-cache-bust':/APEX_ARSENAL_RUNTIME_REVISION = '20260930-(hunter-ownerfix-r1|crystala-[a-z0-9-]+)'/.test(manifest),
};
let fail=0;for(const [name,pass] of Object.entries(checks)){console.log(`[${pass?'PASS':'FAIL'}] ${name}`);if(!pass)fail++;}
console.log(`[HUNTER OWNER FIX GATES] ${Object.keys(checks).length-fail}/${Object.keys(checks).length}`);
process.exit(fail?1:0);
