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
check('Gold Lucky URL carries current revision', urls.includes(`/gold/lucky-draw.html?v=${revision}`));
check('Gold HUD URL carries current revision', urls.includes(`/gold/battle-hud.html?v=${revision}`));
for(const name of ['battle-hud.html','lucky-draw.html','shell.html']){
  const actual=digest(`public/gold/${name}`), expected=manifest.files[name];
  check(`${name} bytes match manifest`, !!expected && actual.bytes===expected.bytes);
  check(`${name} sha256 matches manifest`, !!expected && actual.sha256===expected.sha256);
}

console.log(['GOLD REVISION INTEGRITY GATE',...passes].join('\n'));
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('RESULT: PASS ('+passes.length+' checks)');
