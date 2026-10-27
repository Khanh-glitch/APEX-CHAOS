import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const html = fs.readFileSync(new URL('../public/bot-wave/game.html', import.meta.url), 'utf8');
const marker = "'src/game/post.ts': function(module,exports,require){";
const start = html.indexOf(marker);
assert.ok(start >= 0, 'embedded Gold Post module remains present');
const end = html.indexOf("\n},\n'src/", start);
assert.ok(end > start, 'embedded Gold Post module has a bounded source region');
const postSource = html.slice(start, end + 2);
const goldPostSha256 = '299d361529ea57a99af999bbfcf9e200beb73daf959587a81d3216c0096eb345';
assert.equal(crypto.createHash('sha256').update(postSource).digest('hex'), goldPostSha256,
  'Gold Post implementation, resolution, refraction, bloom, RGB split, radial, vignette and grain remain byte-identical');

const adapterStart = html.indexOf('const REFRACTION_COPY=');
const adapterEnd = html.indexOf('// Keep the existing low-cost update counter;', adapterStart);
assert.ok(adapterStart >= 0 && adapterEnd > adapterStart, 'lossless copy adapter is installed before perf instrumentation');
const adapter = html.slice(adapterStart, adapterEnd);
for (const contract of [
  'post.distort=function(w,h,dpr,o)',
  'nativeDistort(w,h,dpr,o)',
  "new URLSearchParams(location.search).get('refractionCopy')==='on'",
  'post.cpctx.drawImage=function(source,...args)',
  'nativeCopy(source,r.x,r.y,r.w,r.h,r.x,r.y,r.w,r.h)',
  'copied<pw*ph*.78',
  'return nativeCopy(source,0,0)',
  'stats.pixelsAvoided+=source.width*source.height-copied',
]) assert.ok(adapter.includes(contract), `refraction adapter contract: ${contract}`);

for (const signal of [
  "get('wavePerf')==='on'", 'if(PERF_DIAGNOSTICS_ENABLED){',
  'updateP50Ms:', 'updateP95Ms:', 'updateP99Ms:',
  'renderP50Ms:', 'renderP95Ms:', 'renderP99Ms:',
  'postP50Ms:', 'postP95Ms:', 'postP99Ms:',
  'frameGapP50Ms:', 'frameGapP95Ms:', 'frameGapP99Ms:',
  'inputQueueP95Ms:', 'longTaskMaxMs', 'gcSupported:false', 'gcDurationMs', 'jsHeapBytes:',
  'postSurfaceBytes:', 'enableCanvasPassProfiler', 'APEX_WAVE_REFRACTION_COPY',
]) assert.ok(html.includes(signal), `performance telemetry exposes ${signal}`);

console.log('BOT WAVE lossless render contract PASS: Gold Post SHA unchanged; refraction copy has full-frame fallback; update/render/post/input/frame/GC/memory instrumentation is present');
