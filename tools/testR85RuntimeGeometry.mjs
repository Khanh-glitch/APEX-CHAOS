import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeStartLift } from '../src/game/bootStartViewportGuard.js';
import { solveShortPortraitPick } from '../src/game/shortPortraitPickSolver.js';

assert.equal(computeStartLift({unshiftedBottom:809.57,visibleBottom:857}),0);
assert.equal(computeStartLift({unshiftedBottom:521.96,visibleBottom:545}),0);
assert.equal(computeStartLift({unshiftedBottom:521.96,visibleBottom:490}),44);
assert.equal(computeStartLift({unshiftedBottom:411.37,visibleBottom:390}),34);
assert.equal(computeStartLift({unshiftedBottom:100,visibleBottom:NaN}),0);
for (const [w,h] of [[361,545],[320,498],[280,430]]) {
  const g=solveShortPortraitPick({width:w,height:h});
  assert.ok(g.deckBottom>=126 && g.deckBottom<=142);
  assert.ok(g.deckTop>0 && g.heroTop<g.deckTop);
}
assert.equal(solveShortPortraitPick({width:550,height:857}),null);
assert.equal(solveShortPortraitPick({width:844,height:390}),null);
const app=readFileSync('src/App.jsx','utf8');
const start=readFileSync('src/game/bootStartViewportGuard.js','utf8');
const pick=readFileSync('src/game/shortPortraitPickRuntime.js','utf8');
assert.match(app,/stopStartGuard = attachBootStartViewportGuard\(start\)/);
assert.match(app,/stopStartGuard\(\);\n\s*\/\/ Hide in the same trusted input event/);
assert.match(start,/button\.style\.translate/);
assert.doesNotMatch(start,/button\.style\.transform/);
assert.match(pick,/get\('apexPickLab'\) === '1'/);
assert.match(pick,/restore\(\)/);
console.log('PASS R85 START visualViewport math and Pick numeric solver isolation');
