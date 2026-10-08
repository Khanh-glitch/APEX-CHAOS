// R82 static architecture contract, deliberately not a visual acceptance test.
// Run: node tools/testR82HomeLayoutLab.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const main=readFileSync('src/main.jsx','utf8');
const lab=readFileSync('src/game/homeLayoutLab.js','utf8');
const shell=readFileSync('public/gold/shell.html','utf8');
const generator=readFileSync('tools/buildGoldCutover.mjs','utf8');
assert.match(main,/import '\.\/game\/homeLayoutLab\.js';/);
assert.match(lab,/get\('apexLayoutLab'\) === 'home'/);
assert.match(lab,/Math\.min\(width \/ REF_W, height \/ REF_H\)/);
assert.match(lab,/classList\.toggle\(CLASS, active\)/);
assert.match(lab,/#stage:not\(\.screen-mode\):not\(\.screen-fighter\):not\(\.screen-battle\)/);
assert.ok(!shell.includes('apex-r82-home-layout-lab-only'),'R82 may not change shipping Gold');
assert.ok(!generator.includes('apex-r82-home-layout-lab-only'),'R82 may not change Gold generator');
const aspect=550/857;
for (const [w,h] of [[550,857],[360,560],[320,498],[393,613]]) {
 const scale=Math.min(w/550,h/857);
 const x=(w-550*scale)/2,y=(h-857*scale)/2;
 assert.ok(scale>0 && x>=-1e-8 && y>=-1e-8);
 assert.ok(Math.abs(w/h-aspect)<.012);
 const storyY=y+370.224*scale, actionsY=y+575.047*scale;
 assert.ok(actionsY>storyY,'reference order must remain');
}
console.log('PASS R82: opt-in source isolation, invariant scaling mathematics, no Gold source modification (static only)');
