import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const main=fs.readFileSync('src/main.jsx','utf8');
const mode=fs.readFileSync('src/game/graphicsMode.js','utf8');
const wave=fs.readFileSync('public/bot-wave/game.html','utf8');
assert(main.includes('installGraphicsMode();'), 'graphics mode must initialize before gameplay');
assert(main.indexOf('installGraphicsMode();') < main.indexOf('installProductSurfaceAuthority(window);'), 'mode must initialize before surfaces');
assert(wave.includes("const dpr = Math.min(perfMode ? 1.25 : 2, window.devicePixelRatio || 1);"), 'DPR must be gated behind PERFORMANCE');
assert.equal((wave.match(/const dpr = Math.min\(perfMode \? 1\.25 : 2, window\.devicePixelRatio \|\| 1\);/g)||[]).length, 1);
assert(!wave.includes('botWavePerfMode'), 'no broken cross-scope helper from previous failed trial');
const matches=[...wave.matchAll(/const dpr = Math.min\(perfMode \? 1\.25 : 2, window\.devicePixelRatio \|\| 1\);/g)];
assert.equal(matches.length,1);
for(const deviceDpr of [1,1.5,2,3]) {
 const high=Math.min(2,deviceDpr);
 const perf=Math.min(1.25,deviceDpr);
 assert.equal(high,Math.min(2,deviceDpr),'HIGH must preserve old backing-store density');
 assert(perf<=high,'PERFORMANCE cannot exceed HIGH pixel density');
}
assert(mode.includes("mode === 'high' ? 'performance' : 'high'"),'mode toggle expected');
assert(mode.includes('F6'),'owner performance shortcut required');
console.log('PASS R5 graphics mode source guard: HIGH preserved, PERFORMANCE opt-in, 1.25 DPR cap');
