import fs from 'node:fs';
import crypto from 'node:crypto';

const runtime=fs.readFileSync('src/game/runtimeManifest.js','utf8');
const urls=fs.readFileSync('src/game/goldAssetManifest.js','utf8');
const manifest=JSON.parse(fs.readFileSync('public/gold/manifest.json','utf8'));
const m=runtime.match(/APEX_ARSENAL_RUNTIME_REVISION\s*=\s*'([^']+)'/);
if(!m) throw new Error('runtime revision missing');
const revision=m[1];
const failures=[];const passes=[];
function check(name,cond){(cond?passes:failures).push((cond?'PASS ':'FAIL ')+name);}
function digest(path){const buf=fs.readFileSync(path);return {bytes:buf.length,sha256:crypto.createHash('sha256').update(buf).digest('hex')};}

check('Gold manifest revision matches runtime authority', manifest.runtimeRevision===revision);
check('Gold shell URL carries current revision', urls.includes(`/gold/shell.html?v=${revision}`));
const shell=fs.readFileSync('public/gold/shell.html','utf8');
const questSource=fs.readFileSync('public/game/quest/quest01Director.js','utf8');
check('Quest script URL matches fixed-ROBOT director',
  shell.includes('/game/quest/quest01Director.js?v=20261010-quest-fixed-robot-02')
  &&runtime.includes('/game/quest/quest01Director.js?v=20261010-quest-fixed-robot-02'));
check('Quest UI has no hero picker',
  !/q1HeroCards|populateQuestHeroPicker|__apexQuestHeroChoice/.test(questSource));
check('Gold Lucky URL carries current revision', urls.includes(`/gold/lucky-draw.html?v=${revision}`));
check('Gold HUD URL carries current revision', urls.includes(`/gold/battle-hud.html?v=${revision}`));
check('Gold transition URL carries current revision', urls.includes(`/gold/transition/mechanical-door-v4.gold.js?v=${revision}`));
check('Mechanical Door is classified as shipping', urls.includes("'/gold/transition/mechanical-door-v4.gold.js'"));

for(const name of ['battle-hud.html','lucky-draw.html','shell.html','transition/mechanical-door-v4.gold.js']){
  const actual=digest(`public/gold/${name}`), expected=manifest.files[name];
  check(`${name} bytes match manifest`, !!expected && actual.bytes===expected.bytes);
  check(`${name} sha256 matches manifest`, !!expected && actual.sha256===expected.sha256);
}
check('Mechanical Door Gold hash is pinned',
  manifest.files['transition/mechanical-door-v4.gold.js']?.sha256==='6d338906e477c13fa42cd6727be7c41bdd0c5b66e12fc140e3836c7858ce0dd2');
check('non-shipping Pick reference files are absent from manifest',
  !manifest.files['assets/gold/pick-reference-overlay.png'] && !manifest.files['assets/gold/pick-hidden-gold-source.png']);

console.log(['GOLD REVISION INTEGRITY GATE',...passes].join('\n'));
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('RESULT: PASS ('+passes.length+' checks)');
