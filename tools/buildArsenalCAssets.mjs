// Arsenal V2 Checkpoint C — asset build pipeline.
// Rasterizes the reprocessed Senko gun family (graphite/steel + brass accents),
// authors bespoke grenade / casing / melee / shield sprites in the same flat
// fill + normalized outline language, and recolors the toon muzzle flashes to
// the warm amber family. Emits the runtime PNG set + manifest.
//
// Usage: node tools/buildArsenalCAssets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Resvg } = require('@resvg/resvg-js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(REPO, 'tools/arsenal-assets/source');
const OUT_WEAPONS = path.join(REPO, 'public/assets/arsenal/weapons/c');
const OUT_VFX = path.join(REPO, 'public/assets/arsenal/av/vfx/c');

// ---------------------------------------------------------------------------
// Color language (C1_STYLE_PROOF_PLAN §3): graphite/dark-steel bodies, steel
// edge highlights, warm brass accents, crisp near-black normalized outline.
// ---------------------------------------------------------------------------
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  const c = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0; let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s, l };
}
// Graphite/steel ramp for greys; brass ramp for warm hues; everything else is
// desaturated into the steel ramp (no stray hues in the gun family).
function remapColor(hex, warmMode = 'brass') {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  if (s >= 0.14 && h >= 10 && h <= 75) {
    if (warmMode === 'graphite') {
      // Tan-bodied source: the warm hue IS the body, fold into graphite ramp.
      if (l <= 0.30) return '#26292f';
      if (l <= 0.50) return '#34383f';
      if (l <= 0.70) return '#43484f';
      return '#565c66';
    }
    if (l <= 0.30) return '#55401c';
    if (l <= 0.50) return '#7d5f24';
    if (l <= 0.70) return '#a5822c';
    return '#c8a437';
  }
  if (l <= 0.14) return '#17181d';
  if (l <= 0.30) return '#26292f';
  if (l <= 0.45) return '#34383f';
  if (l <= 0.60) return '#43484f';
  if (l <= 0.75) return '#565c66';
  if (l <= 0.88) return '#6a717c';
  return '#7d8590';
}
function recolorSvg(svg, warmMode = 'brass') {
  return svg.replace(/(fill|stroke|stop-color)="(#[0-9a-fA-F]{6})"/g, (m, attr, hex) => {
    if (attr === 'stroke' && hex.toLowerCase() === '#000000') return m; // keep outline
    return `${attr}="${remapColor(hex, warmMode)}"`;
  });
}

// ---------------------------------------------------------------------------
// Gun rasters — one representative per gun class from the Senko v9 family.
// longSide = runtime draw long side at 1x; PNGs authored at 2x.
// ---------------------------------------------------------------------------
const GUNS = [
  { id: 'PISTOL',  file: 'colt.svg',             longSide: 145, muzzle: [0.985, 0.21], casing: [0.66, 0.30], warm: 'brass' },
  { id: 'SMG',     file: 'MP5.svg',              longSide: 145, muzzle: [0.985, 0.27], casing: [0.60, 0.34], warm: 'brass' },
  { id: 'SHOTGUN', file: 'SPAS 12.svg',          longSide: 165, muzzle: [0.990, 0.40], casing: [0.52, 0.34], warm: 'brass' },
  { id: 'SNIPER',  file: 'Snipex Alligator.svg', longSide: 185, muzzle: [0.995, 0.44], casing: [0.40, 0.40], warm: 'graphite' },
];

function rasterGun(gun) {
  const raw = fs.readFileSync(path.join(SRC, 'guns/senko-v9', gun.file), 'utf8');
  const svg = recolorSvg(raw, gun.warm || 'brass');
  const m = svg.match(/width="([\d.]+)"\s+height="([\d.]+)"/);
  const w = parseFloat(m[1]); const h = parseFloat(m[2]);
  const scale = (gun.longSide * 2) / Math.max(w, h);
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: Math.max(8, Math.round(w * scale)) } });
  const buf = Buffer.from(r.render().asPng());
  const out = path.join(OUT_WEAPONS, `${gun.id}.png`);
  fs.writeFileSync(out, buf);
  const outW = Math.round(w * scale); const outH = Math.round(h * scale);
  return { id: gun.id, file: `weapons/c/${gun.id}.png`, w: outW, h: outH, muzzle: gun.muzzle, casing: gun.casing };
}

// ---------------------------------------------------------------------------
// Bespoke vector authoring — same flat-fill + normalized-outline language.
// ---------------------------------------------------------------------------
const OUTLINE = '#0d0e12';
function sprite(w, h, fn) {
  const c = createCanvas(w, h);
  const x = c.getContext('2d');
  x.lineJoin = 'round';
  x.lineCap = 'round';
  fn(x, w, h);
  return c.toBuffer('image/png');
}
function shape(x, draw, fill, lw = 5) {
  x.beginPath();
  draw();
  x.closePath();
  x.fillStyle = fill;
  x.fill();
  x.strokeStyle = OUTLINE;
  x.lineWidth = lw;
  x.stroke();
}
function hl(x, draw, lw = 3) { // top-left light accent
  x.beginPath();
  draw();
  x.strokeStyle = 'rgba(255,255,255,0.16)';
  x.lineWidth = lw;
  x.stroke();
}

function drawGrenade(x) {
  // body
  shape(x, () => { x.ellipse(48, 62, 30, 34, 0, 0, Math.PI * 2); }, '#66784a');
  x.save();
  x.beginPath(); x.ellipse(48, 62, 28, 32, 0, 0, Math.PI * 2); x.clip();
  x.strokeStyle = '#3f4a2e'; x.lineWidth = 4;
  for (const gx of [-14, 0, 14]) {
    x.beginPath(); x.ellipse(48 + gx, 62, 6, 32, 0, -Math.PI / 2, Math.PI / 2); x.stroke();
  }
  x.restore();
  hl(x, () => { x.ellipse(38, 48, 14, 12, -0.5, Math.PI, Math.PI * 1.8); });
  // collar
  shape(x, () => { x.rect(38, 18, 20, 14); }, '#a5822c');
  // lever
  shape(x, () => { x.moveTo(58, 20); x.quadraticCurveTo(84, 30, 78, 62); x.lineTo(70, 60); x.quadraticCurveTo(74, 34, 56, 28); }, '#6a717c', 4);
  // ring
  x.beginPath(); x.arc(30, 16, 9, 0, Math.PI * 2);
  x.strokeStyle = OUTLINE; x.lineWidth = 5; x.stroke();
  x.beginPath(); x.arc(30, 16, 5, 0, Math.PI * 2);
  x.strokeStyle = '#8b919b'; x.lineWidth = 3; x.stroke();
}

function drawCasing(x) {
  shape(x, () => { x.rect(3, 8, 20, 12); }, '#c8a437', 3);
  x.beginPath(); x.ellipse(23, 14, 3.4, 6, 0, 0, Math.PI * 2);
  x.fillStyle = '#2e2310'; x.fill();
  x.strokeStyle = OUTLINE; x.lineWidth = 3; x.stroke();
  x.beginPath(); x.moveTo(6, 10.5); x.lineTo(19, 10.5);
  x.strokeStyle = 'rgba(255,244,200,0.5)'; x.lineWidth = 2.5; x.stroke();
  x.beginPath(); x.moveTo(5, 8); x.lineTo(5, 20);
  x.strokeStyle = '#7d5f24'; x.lineWidth = 2.5; x.stroke();
}

function drawSabre(x) {
  shape(x, () => { // curved blade, tip up
    x.moveTo(60, 6);
    x.quadraticCurveTo(96, 70, 88, 130);
    x.quadraticCurveTo(84, 176, 66, 202);
    x.lineTo(52, 198);
    x.quadraticCurveTo(64, 150, 62, 100);
    x.quadraticCurveTo(60, 48, 52, 14);
  }, '#aeb6c2');
  hl(x, () => { x.moveTo(58, 20); x.quadraticCurveTo(66, 90, 60, 160); });
  shape(x, () => { x.rect(38, 198, 48, 14); }, '#a5822c'); // guard
  shape(x, () => { x.rect(54, 212, 16, 58); }, '#2b2e33'); // grip
  x.beginPath(); x.arc(62, 278, 9, 0, Math.PI * 2); x.fillStyle = '#a5822c'; x.fill();
  x.strokeStyle = OUTLINE; x.lineWidth = 4; x.stroke();
}

function drawDagger(x) {
  shape(x, () => { x.moveTo(45, 6); x.quadraticCurveTo(66, 60, 58, 118); x.lineTo(45, 128); x.lineTo(32, 118); x.quadraticCurveTo(24, 60, 45, 6); }, '#aeb6c2');
  x.beginPath(); x.moveTo(45, 14); x.lineTo(45, 122);
  x.strokeStyle = '#5c646e'; x.lineWidth = 3; x.stroke();
  shape(x, () => { x.rect(25, 126, 40, 10); }, '#a5822c', 4);
  shape(x, () => { x.rect(38, 136, 14, 46); }, '#2b2e33', 4);
  x.beginPath(); x.arc(45, 188, 7, 0, Math.PI * 2); x.fillStyle = '#a5822c'; x.fill();
  x.strokeStyle = OUTLINE; x.lineWidth = 4; x.stroke();
}

function drawSpear(x) {
  shape(x, () => { x.moveTo(30, 6); x.quadraticCurveTo(44, 30, 36, 58); x.lineTo(30, 66); x.lineTo(24, 58); x.quadraticCurveTo(16, 30, 30, 6); }, '#aeb6c2', 4);
  shape(x, () => { x.rect(24, 66, 12, 10); }, '#a5822c', 4);
  shape(x, () => { x.rect(26, 76, 8, 292); }, '#3a3f46', 4);
  hl(x, () => { x.moveTo(28, 84); x.lineTo(28, 350); }, 2);
  shape(x, () => { x.rect(24, 368, 12, 10); }, '#565c66', 4);
}

function drawAxe(x) {
  shape(x, () => { x.rect(66, 26, 13, 274); }, '#3a3f46', 4); // haft
  hl(x, () => { x.moveTo(69, 34); x.lineTo(69, 290); }, 2);
  shape(x, () => { // head: top spike, convex cutting edge, dropped beard
    x.moveTo(79, 46);
    x.lineTo(98, 34);
    x.quadraticCurveTo(126, 42, 138, 62);
    x.quadraticCurveTo(144, 92, 138, 122);
    x.quadraticCurveTo(126, 144, 100, 150);
    x.lineTo(94, 166);
    x.lineTo(88, 132);
    x.lineTo(79, 126);
  }, '#aeb6c2');
  x.beginPath(); x.moveTo(135, 66); x.quadraticCurveTo(141, 92, 135, 118);
  x.strokeStyle = '#c8a437'; x.lineWidth = 6; x.stroke(); // brass edge
  hl(x, () => { x.moveTo(96, 44); x.quadraticCurveTo(120, 52, 130, 66); });
  shape(x, () => { x.moveTo(66, 52); x.lineTo(40, 62); x.lineTo(40, 92); x.lineTo(66, 100); }, '#33373d', 4); // poll
  shape(x, () => { x.rect(60, 104, 25, 12); }, '#a5822c', 4);
}

function drawClub(x) {
  shape(x, () => { x.moveTo(40, 10); x.quadraticCurveTo(76, 16, 74, 60); x.quadraticCurveTo(72, 120, 62, 200); x.lineTo(46, 200); x.quadraticCurveTo(36, 120, 34, 60); x.quadraticCurveTo(32, 16, 40, 10); }, '#33373d');
  const spikes = [[30, 40, -1], [78, 52, 1], [28, 90, -1], [74, 108, 1], [32, 146, -1], [70, 160, 1]];
  for (const [sx, sy, d] of spikes) {
    shape(x, () => { x.moveTo(sx, sy); x.lineTo(sx + 16 * d, sy + 8); x.lineTo(sx, sy + 18); }, '#8b919b', 4);
  }
  shape(x, () => { x.rect(42, 196, 24, 10); }, '#a5822c', 4);
  shape(x, () => { x.rect(46, 206, 16, 74); }, '#2b2e33', 4);
  hl(x, () => { x.moveTo(42, 22); x.quadraticCurveTo(38, 90, 46, 180); });
}

function drawSwirlShield(x) {
  x.beginPath(); x.arc(128, 128, 118, 0, Math.PI * 2);
  x.fillStyle = '#8fa2b3'; x.fill();
  x.strokeStyle = OUTLINE; x.lineWidth = 6; x.stroke();
  x.beginPath(); x.arc(128, 128, 96, 0, Math.PI * 2);
  x.fillStyle = '#4e5a66'; x.fill();
  x.strokeStyle = '#2c343c'; x.lineWidth = 4; x.stroke();
  x.beginPath(); // swirl emblem
  for (let a = 0; a < Math.PI * 4.4; a += 0.12) {
    const rr = 6 + a * 9.4;
    const px = 128 + Math.cos(a) * rr; const py = 128 + Math.sin(a) * rr;
    if (a === 0) x.moveTo(px, py); else x.lineTo(px, py);
  }
  x.strokeStyle = '#cfe2f0'; x.lineWidth = 9; x.stroke();
  x.beginPath(); x.arc(128, 128, 16, 0, Math.PI * 2);
  x.fillStyle = '#a5822c'; x.fill(); x.strokeStyle = OUTLINE; x.lineWidth = 4; x.stroke();
  for (const [rx, ry] of [[128, 26], [128, 230], [26, 128], [230, 128]]) {
    x.beginPath(); x.arc(rx, ry, 6, 0, Math.PI * 2);
    x.fillStyle = '#6a717c'; x.fill(); x.strokeStyle = OUTLINE; x.lineWidth = 3; x.stroke();
  }
  hl(x, () => { x.arc(128, 128, 108, Math.PI * 1.05, Math.PI * 1.6); }, 5);
}

function drawTowerShield(x) {
  shape(x, () => {
    x.moveTo(20, 26);
    x.quadraticCurveTo(85, 8, 150, 26);
    x.lineTo(146, 150);
    x.quadraticCurveTo(140, 226, 85, 282);
    x.quadraticCurveTo(30, 226, 24, 150);
  }, '#566270');
  x.beginPath(); x.moveTo(85, 18); x.lineTo(85, 272);
  x.strokeStyle = '#7d8b99'; x.lineWidth = 12; x.stroke(); // center ridge
  x.beginPath(); x.moveTo(85, 18); x.lineTo(85, 272);
  x.strokeStyle = OUTLINE; x.lineWidth = 3; x.stroke();
  x.beginPath(); x.moveTo(30, 90); x.quadraticCurveTo(85, 74, 140, 90);
  x.strokeStyle = '#39424c'; x.lineWidth = 6; x.stroke();
  x.beginPath(); x.moveTo(32, 170); x.quadraticCurveTo(85, 186, 138, 170);
  x.strokeStyle = '#39424c'; x.lineWidth = 6; x.stroke();
  for (const [rx, ry] of [[34, 40], [136, 40], [30, 130], [140, 130], [48, 220], [122, 220]]) {
    x.beginPath(); x.arc(rx, ry, 5, 0, Math.PI * 2);
    x.fillStyle = '#a5822c'; x.fill(); x.strokeStyle = OUTLINE; x.lineWidth = 3; x.stroke();
  }
  hl(x, () => { x.moveTo(30, 34); x.quadraticCurveTo(85, 16, 140, 34); }, 4);
  // re-stroke outer outline above ridge
  x.beginPath();
  x.moveTo(20, 26);
  x.quadraticCurveTo(85, 8, 150, 26);
  x.lineTo(146, 150);
  x.quadraticCurveTo(140, 226, 85, 282);
  x.quadraticCurveTo(30, 226, 24, 150);
  x.closePath();
  x.strokeStyle = OUTLINE; x.lineWidth = 6; x.stroke();
}

const BESPOKE = [
  { id: 'GRENADE',      w: 96,  h: 100, fn: drawGrenade },
  { id: 'CASING',       w: 28,  h: 28,  fn: drawCasing },
  { id: 'SABRE',        w: 120, h: 290, fn: drawSabre },
  { id: 'DAGGER',       w: 90,  h: 200, fn: drawDagger },
  { id: 'SPEAR',        w: 60,  h: 380, fn: drawSpear },
  { id: 'BATTLE_AXE',   w: 150, h: 310, fn: drawAxe },
  { id: 'SPIKED_CLUB',  w: 110, h: 290, fn: drawClub },
  { id: 'SWIRL_SHIELD', w: 256, h: 256, fn: drawSwirlShield },
  { id: 'TOWER_SHIELD', w: 170, h: 290, fn: drawTowerShield },
];

// ---------------------------------------------------------------------------
// Muzzle flash recolor — red/orange/yellow toon family -> rust/amber/warm-white.
// ---------------------------------------------------------------------------
function recolorFlash(srcFile, outName) {
  return loadImage(path.join(SRC, 'vfx/16-toon-muzzle-flash', srcFile)).then((img) => {
    const c = createCanvas(img.width, img.height);
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, img.width, img.height);
    const p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const a = p[i + 3];
      if (a === 0) continue;
      const { h, s, l } = rgbToHsl({ r: p[i], g: p[i + 1], b: p[i + 2] });
      let t;
      if (s < 0.18) t = [255, 233, 176]; // near-white core stays warm white
      else if (h >= 45 && h <= 80) t = l > 0.75 ? [255, 233, 176] : [240, 190, 90];
      else if (h >= 18 && h < 45) t = [217, 122, 38];
      else t = l > 0.72 ? [196, 106, 66] : [154, 52, 22];
      p[i] = t[0]; p[i + 1] = t[1]; p[i + 2] = t[2];
    }
    x.putImageData(d, 0, 0);
    fs.writeFileSync(path.join(OUT_VFX, outName), c.toBuffer('image/png'));
    return { file: `vfx/c/${outName}`, w: img.width, h: img.height };
  });
}

async function main() {
  fs.mkdirSync(OUT_WEAPONS, { recursive: true });
  fs.mkdirSync(OUT_VFX, { recursive: true });

  const manifest = { weapons: {}, muzzleFrames: [] };
  for (const gun of GUNS) {
    const meta = rasterGun(gun);
    manifest.weapons[meta.id] = meta;
  }
  for (const b of BESPOKE) {
    const buf = sprite(b.w, b.h, b.fn);
    fs.writeFileSync(path.join(OUT_WEAPONS, `${b.id}.png`), buf);
    manifest.weapons[b.id] = { id: b.id, file: `weapons/c/${b.id}.png`, w: b.w, h: b.h };
  }
  // Kenney (CC0) smoke/spark support layers, served from the AV root.
  const KENNEY_OUT = path.join(REPO, 'public/assets/arsenal/av/vfx/kenney');
  fs.mkdirSync(KENNEY_OUT, { recursive: true });
  for (const f of ['smoke_01.png', 'smoke_03.png', 'spark_05.png', 'spark_07.png', 'LICENSE.txt']) {
    fs.copyFileSync(path.join(SRC, 'vfx/kenney', f), path.join(KENNEY_OUT, f));
  }

  const flashSrc = ['m_1.png', 'm_4.png', 'm_5.png', 'm_8.png', 'm_9.png', 'm_12.png'];
  for (let i = 0; i < flashSrc.length; i++) {
    manifest.muzzleFrames.push(await recolorFlash(flashSrc[i], `muzzle_${i}.png`));
  }

  fs.writeFileSync(path.join(OUT_WEAPONS, 'arsenal_c_weapon_set.json'), JSON.stringify(manifest, null, 2));
  const js = `// GENERATED by tools/buildArsenalCAssets.mjs — do not edit by hand.\nwindow.APEX_ARSENAL_C_SET = ${JSON.stringify(manifest, null, 2)};\n`;
  fs.writeFileSync(path.join(REPO, 'public/game/arsenal/arsenalCWeaponSet.generated.js'), js);
  console.log('C asset set written:', Object.keys(manifest.weapons).length, 'weapons,', manifest.muzzleFrames.length, 'muzzle frames');
}
main().catch((e) => { console.error(e); process.exit(1); });
