// Derive cleaned ROOT-trap parts from the immutable originals.
// Strategy (owner authority 2026-09-29 §4.3): alpha/shape semantics only —
// NO hue/chroma keying, NO cropping. Build a core mask from high-alpha object
// pixels, dilate it a few px, feather narrowly, and suppress only low-alpha
// halo pixels that lie OUTSIDE the dilated core. Originals are the rollback
// source and are never modified.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const SRC = 'public/assets/hero-rework/hunter-v10';
const OUT = path.join(SRC, 'clean');
fs.mkdirSync(OUT, { recursive: true });

const CORE_ALPHA = 140;   // meaningful object pixels
const HALO_ALPHA = 90;    // low-alpha fringe candidate
const DILATE = 2;         // px core dilation
const parts = [10, 11, 12, 13, 14, 15, 16];

for (const i of parts) {
  const img = await loadImage(fs.readFileSync(path.join(SRC, `part-${i}.png`)));
  const w = img.width, h = img.height;
  const cv = createCanvas(w, h);
  const c = cv.getContext('2d');
  c.drawImage(img, 0, 0);
  const data = c.getImageData(0, 0, w, h);
  const a = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) a[p] = data.data[p * 4 + 3];
  // core mask
  let core = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) core[p] = a[p] >= CORE_ALPHA ? 1 : 0;
  // dilate DILATE passes (8-neighborhood)
  for (let d = 0; d < DILATE; d++) {
    const next = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (core[p]) { next[p] = 1; continue; }
      let on = 0;
      for (let dy = -1; dy <= 1 && !on; dy++) for (let dx = -1; dx <= 1 && !on; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (core[ny * w + nx]) on = 1;
      }
      next[p] = on;
    }
    core = next;
  }
  // suppress low-alpha halo outside the dilated core; keep everything else,
  // including anti-aliased edge pixels adjacent to the core.
  let removed = 0;
  for (let p = 0; p < w * h; p++) {
    if (!core[p] && a[p] > 0 && a[p] < HALO_ALPHA) { data.data[p * 4 + 3] = 0; removed++; }
  }
  c.putImageData(data, 0, 0);
  fs.writeFileSync(path.join(OUT, `part-${i}.png`), cv.toBuffer('image/png'));
  console.log(`clean part-${i}: ${w}x${h}, halo pixels suppressed=${removed}`);
}
console.log('cleaned derivatives written to', OUT);
