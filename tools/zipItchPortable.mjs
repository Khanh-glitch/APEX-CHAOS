// Package dist-itch-html5/ into the ZIP the owner uploads to itch.io.
//
// Contract (itch.io HTML5 rule): index.html must sit at the ARCHIVE ROOT, so
// the archive is built straight from the folder, not from a parent directory.
// The ZIP is content-addressed by the build SHA and accompanied by a receipt so
// "which build is on itch?" is answerable from the artifact, not from memory.
//
// Usage: node tools/zipItchPortable.mjs [--out <dir>]
// Env:   ZIP_OUT  output directory (default: dist-itch)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'dist-itch-html5');
const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const OUT = path.resolve(ROOT, outIdx >= 0 ? argv[outIdx + 1] : (process.env.ZIP_OUT || 'dist-itch'));

function fail(msg) { console.error('[ITCH ZIP] FAIL: ' + msg); process.exit(1); }

if (!fs.existsSync(path.join(SRC, 'index.html'))) fail('dist-itch-html5/index.html missing — run tools/packItchPortable.mjs first');
const shaFile = path.join(SRC, 'ITCH_GUEST_BUILD_SHA.txt');
if (!fs.existsSync(shaFile)) fail('dist-itch-html5/ITCH_GUEST_BUILD_SHA.txt missing — write it from `git rev-parse HEAD` before packing');
const sha = fs.readFileSync(shaFile, 'utf8').trim();
if (!/^[0-9a-f]{7,40}$/.test(sha)) fail('ITCH_GUEST_BUILD_SHA.txt must be a 7-40 char hex git SHA, got: ' + JSON.stringify(sha));

// ---------------------------------------------------------------- zip writer --
// Store-only would double the download; deflate the text, store what is already
// compressed (png/webp/mp3/ogg/woff2/zip) since re-deflating those only costs CPU.
const STORE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp3', '.ogg', '.wav',
  '.mp4', '.webm', '.woff2', '.woff', '.zip', '.br', '.gz']);

function dosTime(d) {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

function walk(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = base ? base + '/' + entry.name : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, rel));
    else if (entry.isFile()) out.push({ rel, full });
  }
  return out;
}

const files = walk(SRC);
if (!files.some((f) => f.rel === 'index.html')) fail('index.html is not at the archive root');

const chunks = [];
const central = [];
let offset = 0;
let stored = 0, deflated = 0;

for (const f of files) {
  const data = fs.readFileSync(f.full);
  const nameBuf = Buffer.from(f.rel, 'utf8');
  const ext = path.extname(f.rel).toLowerCase();
  const { time, date } = dosTime(fs.statSync(f.full).mtime);
  const crc = zlib.crc32 ? zlib.crc32(data) : (() => {
    let c = ~0;
    for (let i = 0; i < data.length; i += 1) c = (c >>> 8) ^ CRC_TABLE[(c ^ data[i]) & 0xff];
    return ~c >>> 0;
  })();

  let method = 0;
  let body = data;
  if (!STORE_EXT.has(ext) && data.length > 256) {
    const packed = zlib.deflateRawSync(data, { level: 9 });
    if (packed.length < data.length) { method = 8; body = packed; }
  }
  if (method === 8) deflated += 1; else stored += 1;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);            // version needed
  local.writeUInt16LE(0x0800, 6);        // UTF-8 names
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(date, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);            // extra
  chunks.push(local, nameBuf, body);

  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4);               // version made by
  cd.writeUInt16LE(20, 6);               // version needed
  cd.writeUInt16LE(0x0800, 8);
  cd.writeUInt16LE(method, 10);
  cd.writeUInt16LE(time, 12);
  cd.writeUInt16LE(date, 14);
  cd.writeUInt32LE(crc, 16);
  cd.writeUInt32LE(body.length, 20);
  cd.writeUInt32LE(data.length, 24);
  cd.writeUInt16LE(nameBuf.length, 28);
  cd.writeUInt16LE(0, 30);               // extra
  cd.writeUInt16LE(0, 32);               // comment
  cd.writeUInt16LE(0, 34);               // disk
  cd.writeUInt16LE(0, 36);               // internal attrs
  cd.writeUInt32LE(0o644 << 16, 38);     // external attrs
  cd.writeUInt32LE(offset, 42);
  central.push(cd, nameBuf);

  offset += local.length + nameBuf.length + body.length;
}

const cdBuf = Buffer.concat(central);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(cdBuf.length, 12);
eocd.writeUInt32LE(offset, 16);
eocd.writeUInt16LE(0, 20);

fs.mkdirSync(OUT, { recursive: true });
const zipName = `apex-chaos-itch-${sha.slice(0, 7)}.zip`;
const zipPath = path.join(OUT, zipName);
const zipBuf = Buffer.concat([...chunks, cdBuf, eocd]);
fs.writeFileSync(zipPath, zipBuf);

// Deterministic digest of the ARCHIVE CONTENTS (sorted name + sha256), so the
// receipt identifies the payload even if ZIP timestamps differ between builds.
const h = crypto.createHash('sha256');
for (const f of files) h.update(f.rel).update('\0').update(fs.readFileSync(f.full)).update('\n');
const contentSha = h.digest('hex');

const receipt = {
  schema: 'apex-itch-zip-receipt/1',
  createdAt: new Date().toISOString(),
  buildSha: sha,
  zip: { name: zipName, bytes: zipBuf.length, sha256: crypto.createHash('sha256').update(zipBuf).digest('hex') },
  content: { files: files.length, bytes: files.reduce((s, f) => s + fs.statSync(f.full).size, 0), sha256: contentSha },
  compression: { deflated, stored },
  entry: 'index.html at archive root (itch.io HTML5 contract)',
};
fs.writeFileSync(path.join(OUT, 'itch-zip-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');

console.log(`[ITCH ZIP] ${zipName}`);
console.log(`  files      ${files.length} (${deflated} deflated, ${stored} stored)`);
console.log(`  size       ${(zipBuf.length / 1048576).toFixed(1)} MB`);
console.log(`  build      ${sha}`);
console.log(`  content    ${contentSha.slice(0, 16)}…`);
console.log(`  receipt    ${path.relative(ROOT, path.join(OUT, 'itch-zip-receipt.json'))}`);
