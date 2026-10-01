#!/usr/bin/env node
// One-shot canonical MAGNET Gold asset baker.
// Executes the locked donor's own segmentation/material pipeline with a seeded
// cosmetic inpaint RNG, then serializes immutable battle-runtime PNG layers.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const GOLD = path.join(ROOT, 'docs/hero-rework/magnet-v1/gold/MAGNET_FINAL_DONOR_MAX.html');
const OUT = path.join(ROOT, 'public/assets/magnet_v1/gold');
const EXPECTED = '468f7b2aa34588c2c52bf23fb5202c507ff5d584d423ea9f1a9232d751247d8b';
const html = fs.readFileSync(GOLD, 'utf8');
const hash = crypto.createHash('sha256').update(html).digest('hex');
if (hash !== EXPECTED) throw new Error(`canonical Gold hash mismatch: ${hash}`);

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const canvasPkg = require('@napi-rs/canvas');
const { createCanvas, loadImage } = canvasPkg;
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
const win = dom.window;
win.ImageData = canvasPkg.ImageData;
win.Path2D = canvasPkg.Path2D;
win.requestAnimationFrame = () => 0;
win.cancelAnimationFrame = () => {};

// The Gold uses Math.random only for hidden-surface texture and demo cosmetics.
// Pin it so the immutable derivation is reproducible byte-for-byte.
let seed = 0x4d41474e;
win.Math.random = () => {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return (seed >>> 0) / 0x100000000;
};

const realCanvases = new WeakMap();
function realCanvasFor(el) {
  let out = realCanvases.get(el);
  const w = el.width || 300, h = el.height || 150;
  if (!out || out.width !== w || out.height !== h) {
    out = createCanvas(w, h);
    realCanvases.set(el, out);
  }
  return out;
}
win.HTMLCanvasElement.prototype.getContext = function getContext(type) {
  if (type && type !== '2d') return null;
  const target = realCanvasFor(this).getContext('2d');
  return new Proxy(target, {
    get(obj, prop) {
      const value = Reflect.get(obj, prop, obj);
      if (prop === 'drawImage' && typeof value === 'function') {
        return (image, ...args) => value.call(obj,
          image && (image.__realImage || realCanvases.get(image)) || image, ...args);
      }
      return typeof value === 'function' ? value.bind(obj) : value;
    },
    set(obj, prop, value) { return Reflect.set(obj, prop, value, obj); },
  });
};
class BakeImage {
  constructor() { this.onload = null; this.onerror = null; this.naturalWidth = 0; this.naturalHeight = 0; }
  set src(value) {
    this._src = value;
    loadImage(value).then((image) => {
      this.__realImage = image;
      this.width = this.naturalWidth = image.width;
      this.height = this.naturalHeight = image.height;
      if (this.onload) this.onload();
    }).catch((error) => { if (this.onerror) this.onerror(error); });
  }
  get src() { return this._src; }
}
win.Image = BakeImage;

const scripts = [...win.document.querySelectorAll('script')]
  .filter((s) => !s.id && s.textContent.includes('MAGNET — donor-max'));
if (scripts.length !== 1) throw new Error(`expected one canonical executable script, got ${scripts.length}`);
win.eval(scripts[0].textContent);

const deadline = Date.now() + 120000;
while (!(win.MAGNET_DEBUG && win.MAGNET_DEBUG.asset)) {
  if (Date.now() > deadline) throw new Error('canonical Gold asset derivation timed out');
  await new Promise((resolve) => setTimeout(resolve, 25));
}

fs.mkdirSync(OUT, { recursive: true });
for (const name of fs.readdirSync(OUT)) if (/^(core|spine|polL|polR|lobeL|lobeR)-/.test(name)) fs.unlinkSync(path.join(OUT, name));
const metadata = {
  schema: 1,
  source: 'docs/hero-rework/magnet-v1/gold/MAGNET_FINAL_DONOR_MAX.html',
  sourceSha256: EXPECTED,
  sourceBytes: fs.statSync(GOLD).size,
  derivation: 'canonical-buildAssets-seeded-inpaint',
  seed: '0x4d41474e',
  sourceSize: 1254,
  origin: { x: 627, y: 610 },
  worldScale: 170 / 1020,
  levels: [0.5, 0.25],
  parts: {},
};
const pivots = { core: [627, 640], spine: [627, 660], polL: [470, 820], polR: [784, 820], lobeL: [250, 830], lobeR: [1004, 830] };
function writeLayer(file, canvasEl) {
  const bytes = realCanvasFor(canvasEl).toBuffer('image/png');
  fs.writeFileSync(path.join(OUT, file), bytes);
  return { file, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}
for (const [id, part] of Object.entries(win.MAGNET_DEBUG.asset.parts)) {
  const record = { ox: part.ox, oy: part.oy, width: part.w, height: part.h, pivot: pivots[id], levels: [] };
  part.lv.forEach((level, index) => {
    const tag = index === 0 ? 'half' : 'quarter';
    const levelRecord = { scale: metadata.levels[index], base: writeLayer(`${id}-${tag}-base.png`, level.base), channels: {} };
    for (const [channel, layers] of Object.entries(level.ch)) {
      levelRecord.channels[channel] = {
        gold: writeLayer(`${id}-${tag}-${channel}-gold.png`, layers.gold),
        dim: writeLayer(`${id}-${tag}-${channel}-dim.png`, layers.dim),
        glow: writeLayer(`${id}-${tag}-${channel}-glow.png`, layers.glow),
      };
    }
    record.levels.push(levelRecord);
  });
  metadata.parts[id] = record;
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(`[MAGNET GOLD BAKE] ${Object.keys(metadata.parts).length} parts -> ${path.relative(ROOT, OUT)}`);
console.log(`[MAGNET GOLD BAKE] source ${metadata.sourceBytes} bytes ${EXPECTED}`);
process.exit(0);
