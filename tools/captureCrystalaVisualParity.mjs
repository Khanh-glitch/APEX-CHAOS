// CRYSTALA V1 — High-fidelity visual parity capture tool
// Generates the 9 owner-approved visual evidence snapshots in docs/hero-rework/crystala-v1/evidence/
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCanvas, Path2D } = require('@napi-rs/canvas');

const OUT_DIR = path.join(process.cwd(), 'docs', 'hero-rework', 'crystala-v1', 'evidence');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const goldV6Code = fs.readFileSync('public/game/hero-rework/crystalaGoldV6.js', 'utf8');
const globalScope = { console, Math, Float32Array, Uint8Array, Object, Array, Infinity, isFinite, Path2D, __createCanvas: createCanvas };
globalScope.document = {
  createElement(tag) {
    if (tag === 'canvas') return createCanvas(300, 150);
    return {};
  }
};
globalScope.window = globalScope; globalScope.globalThis = globalScope;
const fn = new Function('window', 'globalThis', goldV6Code);
fn(globalScope, globalScope);
const G = globalScope.APEX_CRYSTALA_GOLD;

function createFloor(w = 1000, h = 1000) {
  const cv = createCanvas(w, h);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#181224';
  ctx.fillRect(0, 0, w, h);
  // Grid lines matching APEX arena
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  return { cv, ctx };
}

console.log('Generating CRYSTALA V1 visual parity snapshots...');

// 1. crystala-01-dormant-silhouette.png
{
  const { cv, ctx } = createFloor();
  const rig = G.createRig({ seed: 101, visual: true });
  rig.setBody(500, 500, 0, 0);
  for (let i = 0; i < 60; i++) rig.advance(1/60);
  for (const s of rig.stones) { if (s.depth < 0) { G.drawTrail(ctx, s, 1); G.drawStone(ctx, s, 1, false); } }
  G.drawCrystala(ctx, rig.hero, false, 1);
  for (const s of rig.stones) { if (s.depth >= 0) { G.drawTrail(ctx, s, 1); G.drawStone(ctx, s, 1, false); } }
  fs.writeFileSync(path.join(OUT_DIR, 'crystala-01-dormant-silhouette.png'), cv.toBuffer('image/png'));
  console.log('✓ crystala-01-dormant-silhouette.png');
}

// 2. crystala-02-awake-luminous.png
{
  const { cv, ctx } = createFloor();
  const rig = G.createRig({ seed: 102, visual: true });
  rig.setBody(500, 500, 0, 0);
  rig.awaken(1.0, 1.0);
  for (let i = 0; i < 40; i++) rig.advance(1/60);
  for (const s of rig.stones) s.energy = 0.8;
  const bloom = G.createBloomSystem({ width: 1000, height: 1000, scale: 0.5 });
  const gx = bloom.begin();
  for (const s of rig.stones) { if (s.depth < 0) { G.drawTrail(ctx, s, 1); G.drawStone(ctx, s, 1, false); } }
  G.drawCrystala(ctx, rig.hero, false, 1);
  for (const s of rig.stones) { if (s.depth >= 0) { G.drawTrail(ctx, s, 1); G.drawStone(ctx, s, 1, false); } }
  for (const s of rig.stones) G.drawStone(gx, s, 1, true);
  G.drawCrystala(gx, rig.hero, true, 1);
  bloom.composite(ctx, 1000, 1000);
  G.drawEyeAccent(ctx, rig.hero, 1);
  fs.writeFileSync(path.join(OUT_DIR, 'crystala-02-awake-luminous.png'), cv.toBuffer('image/png'));
  console.log('✓ crystala-02-awake-luminous.png');
}

// 3. crystala-03-intercept-refraction.png
{
  const { cv, ctx } = createFloor();
  const rig = G.createRig({ seed: 103, visual: true });
  rig.setBody(500, 500, 0, 0);
  rig.awaken(1.0, 0.8);
  for (let i = 0; i < 30; i++) rig.advance(1/60);
  const st = rig.stones[0];
  st.x = 680; st.y = 480; st.energy = 1.0;
  rig.refract(0, { x: 750, y: 480 }, { x: 300, y: 520 }, 7);
  st.internal.t = 0.08;
  const bloom = G.createBloomSystem({ width: 1000, height: 1000, scale: 0.5 });
  const gx = bloom.begin();
  for (const s of rig.stones) { G.drawTrail(ctx, s, 1); G.drawStone(ctx, s, 1, false); }
  G.drawCrystala(ctx, rig.hero, false, 1);
  for (const s of rig.stones) G.drawStone(gx, s, 1, true);
  G.drawCrystala(gx, rig.hero, true, 1);
  bloom.composite(ctx, 1000, 1000);
  G.drawEyeAccent(ctx, rig.hero, 1);
  fs.writeFileSync(path.join(OUT_DIR, 'crystala-03-intercept-refraction.png'), cv.toBuffer('image/png'));
  console.log('✓ crystala-03-intercept-refraction.png');
}

// 4. crystala-04-recoil-banking-return.png
{
  const { cv, ctx } = createFloor();
  const rig = G.createRig({ seed: 104, visual: true });
  rig.setBody(450, 500, 0, 0);
  rig.awaken(0.7, 0.5);
  for (let i = 0; i < 30; i++) rig.advance(1/60);
  const st = rig.stones[1];
  rig.recoilKick(1, { x: 800, y: 500 });
  st.energy = 0.9; st.recoil = 0.8;
  for (let i = 0; i < 15; i++) rig.advance(1/60);
  for (let i = 0; i < 20; i++) rig.spawnDust(st.x, st.y, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, 1.2, 1.5, 0.85);
  const bloom = G.createBloomSystem({ width: 1000, height: 1000, scale: 0.5 });
  const gx = bloom.begin();
  for (const s of rig.stones) { G.drawTrail(ctx, s, 1); G.drawStone(ctx, s, 1, false); }
  G.drawCrystala(ctx, rig.hero, false, 1);
  if (rig.fx) G.drawDust(ctx, rig.fx.dust, 1);
  for (const s of rig.stones) G.drawStone(gx, s, 1, true);
  G.drawCrystala(gx, rig.hero, true, 1);
  bloom.composite(ctx, 1000, 1000);
  fs.writeFileSync(path.join(OUT_DIR, 'crystala-04-recoil-banking-return.png'), cv.toBuffer('image/png'));
  console.log('✓ crystala-04-recoil-banking-return.png');
}

// 5. crystala-05-wall-growth-seam-lock.png
{
  const { cv, ctx } = createFloor();
  const rig = G.createRig({ seed: 105, visual: true });
  rig.setBody(350, 500, 0, 0);
  const wPlan = rig.planWall([0, 1, 2, 3, 4, 5], { x: 600, y: 390 }, { x: 600, y: 610 });
  const wCons = rig.castWall({ a0: { x: 600, y: 390 }, a1: { x: 600, y: 610 }, pair: wPlan.pair, seed: 105 });
  for (let i = 0; i < 50; i++) rig.advance(1/60);
  const bloom = G.createBloomSystem({ width: 1000, height: 1000, scale: 0.5 });
  const gx = bloom.begin();
  G.drawWall(ctx, wCons.geom, false);
  for (const s of rig.stones) { G.drawTrail(ctx, s, 1); G.drawStone(ctx, s, 1, false); }
  G.drawCrystala(ctx, rig.hero, false, 1);
  G.drawWall(gx, wCons.geom, true);
  for (const s of rig.stones) G.drawStone(gx, s, 1, true);
  G.drawCrystala(gx, rig.hero, true, 1);
  bloom.composite(ctx, 1000, 1000);
  fs.writeFileSync(path.join(OUT_DIR, 'crystala-05-wall-growth-seam-lock.png'), cv.toBuffer('image/png'));
  console.log('✓ crystala-05-wall-growth-seam-lock.png');
}

// 6. crystala-06-wall-impact-cracks.png
{
  const { cv, ctx } = createFloor();
  const rig = G.createRig({ seed: 106, visual: true });
  rig.setBody(350, 500, 0, 0);
  const wPlan = rig.planWall([0, 1, 2, 3, 4, 5], { x: 600, y: 390 }, { x: 600, y: 610 });
  const wCons = rig.castWall({ a0: { x: 600, y: 390 }, a1: { x: 600, y: 610 }, pair: wPlan.pair, seed: 106 });
  for (let i = 0; i < 80; i++) rig.advance(1/60);
  rig.wallHit(wCons.geom, { x: 600, y: 480 }, 45);
  rig.wallHit(wCons.geom, { x: 600, y: 530 }, 35);
  for (let i = 0; i < 5; i++) rig.advance(1/60);
  const bloom = G.createBloomSystem({ width: 1000, height: 1000, scale: 0.5 });
  const gx = bloom.begin();
  G.drawWall(ctx, wCons.geom, false);
  for (const s of rig.stones) { G.drawTrail(ctx, s, 1); G.drawStone(ctx, s, 1, false); }
  G.drawCrystala(ctx, rig.hero, false, 1);
  if (rig.fx) { G.drawDebris(ctx, rig.fx.debris, 1); G.drawDust(ctx, rig.fx.dust, 1); }
  G.drawWall(gx, wCons.geom, true);
  for (const s of rig.stones) G.drawStone(gx, s, 1, true);
  G.drawCrystala(gx, rig.hero, true, 1);
  bloom.composite(ctx, 1000, 1000);
  fs.writeFileSync(path.join(OUT_DIR, 'crystala-06-wall-impact-cracks.png'), cv.toBuffer('image/png'));
  console.log('✓ crystala-06-wall-impact-cracks.png');
}

// 7. crystala-07-prison-burst-encircle.png
{
  const { cv, ctx } = createFloor();
  const rig = G.createRig({ seed: 107, visual: true });
  rig.setBody(350, 500, 0, 0);
  const pCons = rig.castPrison({ cx: 650, cy: 500, R: 135, seed: 107 });
  for (let i = 0; i < 35; i++) rig.advance(1/60);
  const bloom = G.createBloomSystem({ width: 1000, height: 1000, scale: 0.5 });
  const gx = bloom.begin();
  G.drawPrison(ctx, pCons.prison, false, false);
  G.drawPrison(ctx, pCons.prison, false, true);
  for (const s of rig.stones) { G.drawTrail(ctx, s, 1); G.drawStone(ctx, s, 1, false); }
  G.drawCrystala(ctx, rig.hero, false, 1);
  G.drawPrison(gx, pCons.prison, true, false);
  G.drawPrison(gx, pCons.prison, true, true);
  for (const s of rig.stones) G.drawStone(gx, s, 1, true);
  G.drawCrystala(gx, rig.hero, true, 1);
  bloom.composite(ctx, 1000, 1000);
  fs.writeFileSync(path.join(OUT_DIR, 'crystala-07-prison-burst-encircle.png'), cv.toBuffer('image/png'));
  console.log('✓ crystala-07-prison-burst-encircle.png');
}

// 8. crystala-08-prison-chain-closure.png
{
  const { cv, ctx } = createFloor();
  const rig = G.createRig({ seed: 108, visual: true });
  rig.setBody(350, 500, 0, 0);
  const pCons = rig.castPrison({ cx: 650, cy: 500, R: 135, seed: 108 });
  for (let i = 0; i < 80; i++) rig.advance(1/60);
  const bloom = G.createBloomSystem({ width: 1000, height: 1000, scale: 0.5 });
  const gx = bloom.begin();
  G.drawPrison(ctx, pCons.prison, false, false);
  G.drawPrison(ctx, pCons.prison, false, true);
  for (const s of rig.stones) { G.drawTrail(ctx, s, 1); G.drawStone(ctx, s, 1, false); }
  G.drawCrystala(ctx, rig.hero, false, 1);
  G.drawPrison(gx, pCons.prison, true, false);
  G.drawPrison(gx, pCons.prison, true, true);
  for (const s of rig.stones) G.drawStone(gx, s, 1, true);
  G.drawCrystala(gx, rig.hero, true, 1);
  bloom.composite(ctx, 1000, 1000);
  fs.writeFileSync(path.join(OUT_DIR, 'crystala-08-prison-chain-closure.png'), cv.toBuffer('image/png'));
  console.log('✓ crystala-08-prison-chain-closure.png');
}

// 9. crystala-09-bloom-readability.png
{
  const { cv, ctx } = createFloor();
  const rig = G.createRig({ seed: 109, visual: true });
  rig.setBody(450, 500, 0, 0);
  rig.awaken(1.0, 1.0);
  const wPlan = rig.planWall([0, 1, 2, 3, 4, 5], { x: 700, y: 390 }, { x: 700, y: 610 });
  const wCons = rig.castWall({ a0: { x: 700, y: 390 }, a1: { x: 700, y: 610 }, pair: wPlan.pair, seed: 109 });
  for (let i = 0; i < 70; i++) rig.advance(1/60);
  for (let i = 0; i < 25; i++) rig.spawnDust(500, 500, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, 1.5, 1.8, 0.9);
  const bloom = G.createBloomSystem({ width: 1000, height: 1000, scale: 0.5 });
  const gx = bloom.begin();
  G.drawWall(ctx, wCons.geom, false);
  for (const s of rig.stones) { G.drawTrail(ctx, s, 1); G.drawStone(ctx, s, 1, false); }
  G.drawCrystala(ctx, rig.hero, false, 1);
  if (rig.fx) G.drawDust(ctx, rig.fx.dust, 1);
  G.drawWall(gx, wCons.geom, true);
  for (const s of rig.stones) G.drawStone(gx, s, 1, true);
  G.drawCrystala(gx, rig.hero, true, 1);
  bloom.composite(ctx, 1000, 1000);
  G.drawEyeAccent(ctx, rig.hero, 1);
  fs.writeFileSync(path.join(OUT_DIR, 'crystala-09-bloom-readability.png'), cv.toBuffer('image/png'));
  console.log('✓ crystala-09-bloom-readability.png');
}

console.log('All 9 visual parity snapshots generated successfully.');
