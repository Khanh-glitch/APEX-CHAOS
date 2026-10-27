import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createCanvas } from '@napi-rs/canvas';

const html = fs.readFileSync(new URL('../public/bot-wave/game.html', import.meta.url), 'utf8');
const moduleMarker = "'src/game/post.ts': function(module,exports,require){";
const moduleStart = html.indexOf(moduleMarker);
const moduleEnd = html.indexOf("\n},\n'src/", moduleStart);
assert.ok(moduleStart >= 0 && moduleEnd > moduleStart, 'embedded Post module is extractable');
const postModule = html.slice(moduleStart + moduleMarker.length, moduleEnd);
const postModuleFactory = new Function('module', 'exports', 'require', 'document', postModule);
const postExports = {};
postModuleFactory({ exports: postExports }, postExports, () => ({}), {
  createElement: () => createCanvas(2, 2),
});
const Post = postExports.Post;
assert.equal(typeof Post, 'function');

const adapterStart = html.indexOf('const REFRACTION_COPY=');
const adapterEnd = html.indexOf('// Keep the existing low-cost update counter;', adapterStart);
const adapterSource = html.slice(adapterStart, adapterEnd);
assert.ok(adapterStart >= 0 && adapterEnd > adapterStart, 'optimized refraction adapter is extractable');

let randomState = 0x91a2b3c4;
function random() {
  randomState ^= randomState << 13;
  randomState ^= randomState >>> 17;
  randomState ^= randomState << 5;
  return (randomState >>> 0) / 0x100000000;
}
function makeOptions(w, h, pass) {
  const shocks = Array.from({ length: 1 + (pass % 5) }, (_, i) => ({
    x: (random() * 1.1 - 0.05) * w,
    y: (random() * 1.1 - 0.05) * h,
    r: 12 + random() * Math.min(w, h) * 0.28,
    width: 7 + random() * 48,
    strength: 0.02 + random() * 0.35,
    squash: 0.35 + random() * 0.65,
  }));
  const heat = Array.from({ length: 1 + (pass % 14) }, () => ({
    x: random() * w,
    y: random() * h,
    w: 12 + random() * Math.min(160, w * 0.3),
    h: 12 + random() * Math.min(140, h * 0.35),
    heat: 0.23 + random() * 0.77,
  }));
  return { time: pass * 0.173, shocks, heat };
}
function paint(post, w, h, dpr, pass) {
  const ctx = post.begin(w, h, dpr);
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, pass % 2 ? '#315d79' : '#c98d45');
  gradient.addColorStop(0.5, '#24386c');
  gradient.addColorStop(1, '#080d13');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = '#ffcf69';
  ctx.lineWidth = 3.5;
  for (let k = 0; k < 70; k++) {
    ctx.beginPath();
    ctx.arc((k * 37 + pass * 19) % w, (k * 67 + pass * 31) % h, 3 + (k % 11), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function installOn(post) {
  const context = vm.createContext({
    engine: { post }, window: {},
    location: { search: '?refractionCopy=on' }, URLSearchParams,
    Math, Number, Array, Object,
  });
  vm.runInContext(adapterSource, context, { timeout: 3000 });
  return context.window.APEX_WAVE_REFRACTION_COPY;
}

const profiles = [
  { name: 'desktop', width: 1440, height: 900, dpr: 1 },
  { name: 'mobile-landscape-dpr2', width: 844, height: 390, dpr: 2 },
  { name: 'mobile-portrait-dpr3', width: 390, height: 844, dpr: 3 },
  { name: 'compact', width: 420, height: 280, dpr: 1 },
];
const report = [];
for (const profile of profiles) {
  const gold = new Post();
  const optimized = new Post();
  const copyStats = installOn(optimized);
  let changedChannels = 0;
  let maxChannelDiff = 0;
  let absoluteError = 0;
  let comparedChannels = 0;
  const passes = 12;
  for (let pass = 0; pass < passes; pass++) {
    const options = makeOptions(profile.width, profile.height, pass);
    paint(gold, profile.width, profile.height, profile.dpr, pass);
    paint(optimized, profile.width, profile.height, profile.dpr, pass);
    gold.distort(profile.width, profile.height, profile.dpr, options);
    optimized.distort(profile.width, profile.height, profile.dpr, options);
    const a = gold.sctx.getImageData(0, 0, gold.scene.width, gold.scene.height).data;
    const b = optimized.sctx.getImageData(0, 0, optimized.scene.width, optimized.scene.height).data;
    assert.equal(a.length, b.length);
    for (let i = 0; i < a.length; i++) {
      const diff = Math.abs(a[i] - b[i]);
      if (diff) changedChannels++;
      if (diff > maxChannelDiff) maxChannelDiff = diff;
      absoluteError += diff;
    }
    comparedChannels += a.length;
  }
  assert.equal(changedChannels, 0,
    `${profile.name}: lossless Gold refraction mismatch: changed=${changedChannels}, max=${maxChannelDiff}`);
  const stats = copyStats.snapshot();
  assert.ok(stats.partialFrames > 0, `${profile.name}: no optimized refraction frame was exercised`);
  report.push({
    profile: profile.name, logical: [profile.width, profile.height], dpr: profile.dpr,
    passes, changedChannels, maxChannelDiff,
    meanAbsoluteChannelDiff: absoluteError / comparedChannels,
    refractionCopy: stats,
  });
}
console.log(JSON.stringify({
  test: 'Gold Post implementation; deterministic Canvas2D pixel-by-pixel refraction copy parity',
  renderer: '@napi-rs/canvas (not a real browser/GPU)',
  profiles: report,
}, null, 2));
