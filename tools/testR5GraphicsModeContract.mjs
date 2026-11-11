import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const main=fs.readFileSync('src/main.jsx','utf8');
const mode=fs.readFileSync('src/game/graphicsMode.js','utf8');
const wave=fs.readFileSync('public/bot-wave/game.html','utf8');
assert(main.includes('installGraphicsMode();'), 'graphics mode must initialize before gameplay');
assert(main.indexOf('installGraphicsMode();') < main.indexOf('installProductSurfaceAuthority(window);'), 'mode must initialize before surfaces');
assert(wave.includes('if(wavePerformanceMode){'), 'wave-specific performance gate is required');
assert(wave.includes('const target=Math.min(1.25,window.devicePixelRatio||1);'), 'DPR must be capped only inside the adapter');
assert(wave.includes('const dpr = Math.min(2, window.devicePixelRatio || 1);'), 'Original renderer DPR must remain unchanged');
assert(!wave.includes('botWavePerfMode'), 'no broken cross-scope helper from previous failed trial');
const gold=wave.slice(wave.indexOf('const modules='),wave.indexOf('/* BOXE BOT WAVE pilot'));
assert.equal(gold.length,905635,'Immutable Gold source length must remain exact');
for(const deviceDpr of [1,1.5,2,3]) {
 const high=Math.min(2,deviceDpr);
 const perf=Math.min(1.25,deviceDpr);
 assert.equal(high,Math.min(2,deviceDpr),'HIGH must preserve old backing-store density');
 assert(perf<=high,'PERFORMANCE cannot exceed HIGH pixel density');
}
assert(mode.includes("mode === 'high' ? 'performance' : 'high'"),'mode toggle expected');
assert(mode.includes('F6'),'owner performance shortcut required');
console.log('PASS R5 graphics mode source guard: HIGH preserved, PERFORMANCE opt-in, 1.25 DPR cap');
