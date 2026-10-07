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
  'A1-gold-spring-world-displacement':/s\.a1Motion=\{x:G\.core\.spring\(340\),px:340,offset:0,goldT:0,timeScale:1,dilate:0\}/.test(pres)&&/G\.core\.springRatio\(m\.x,G\.core\.clamp\(m\.px-55,130,1150\),\.6,\.34,dt\)/.test(pres)&&/m\.offset=\(340-m\.x\.x\)\*s\.scale/.test(pres)&&/const off=motion\.offset\|\|0/.test(mech)&&/c\.origin\.x-c\.axis\.x\*off/.test(mech)&&!/castBaseX/.test(pres),
  'A1-shorter-post-recoil-lock':/s\.h\.mode==='a1'&&s\.h\.t>=\.62/.test(pres),
  'trap-front-pass-survives-crystal-wrapper':/api\.renderPostWorld=postWorld/.test(pres)&&/bypassedPrevDraw\s*&&\s*g\.APEX_HUNTER_PRESENTATION\?\.renderPostWorld/.test(crystalPres),
  'A2-firearm-disarm':/held\.def\.category==='ranged'/.test(mech)&&/W\.consume\(hit,'hunter-a2-disarm'\)/.test(mech)&&/HunterA2Disarm/.test(mech),
  'A2-zero-direct-damage':/directDamage:0,swept:true/.test(mech),
  'movement-smear-removed':!/directional smear along the true velocity/.test(gold)&&/high-speed echo history above remains the sole movement afterimage/.test(gold),
  // Cache-bust law is structural, never pinned to one historical product revision.
  // The dedicated runtime-revision gate proves the revision/lock/hash lineage.
  'runtime-cache-bust':/APEX_ARSENAL_RUNTIME_REVISION = '[^']+'/.test(manifest)
    && /hunterGoldV10\.js\?v=' \+ APEX_ARSENAL_RUNTIME_REVISION/.test(manifest)
    && /hunterPresentationRuntime\.js\?v=' \+ APEX_ARSENAL_RUNTIME_REVISION/.test(manifest),
};
let fail=0;for(const [name,pass] of Object.entries(checks)){console.log(`[${pass?'PASS':'FAIL'}] ${name}`);if(!pass)fail++;}
console.log(`[HUNTER OWNER FIX GATES] ${Object.keys(checks).length-fail}/${Object.keys(checks).length}`);
process.exit(fail?1:0);
