// APEX CHAOS — Core Six AV + Theme preload materializer.
//
// Authority: docs/gold-ui/preload/README_AV_THEME_PRELOAD.md
//            docs/gold-ui/preload/AV_THEME_PRELOAD_MANIFEST.json
//
// This tool exists so production NEVER loads ZIP contents at runtime and never
// forks the accepted VFX engines:
//
//   1. verify the preload archive SHA-256 against the documented value;
//   2. verify every archive entry against the embedded MANIFEST.json;
//   3. verify that each hero VFX authority file still exists in the checkout at
//      the pinned git blob SHA (reuse, do not fork — no copy is performed);
//   4. materialize ONLY the compact, pre-cut runtime clips + theme to stable
//      public paths. Source/reference WAV masters are never written to public/.
//
// Idempotent: a run with unchanged inputs changes no bytes.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inflateRawSync } from 'node:zlib';

const ROOT = process.cwd();
const PRELOAD_DIR = path.join(ROOT, 'docs/gold-ui/preload');
const ARCHIVE = path.join(PRELOAD_DIR, 'APEX_CHAOS_CORE_SIX_AV_THEME_PRELOAD.zip');
const ARCHIVE_SHA256 = '49d8d5bf448bce7ca6475388cdf640c338bc00250fbcb577dbc7962fcfd0180f';
const PREFIX = 'apex_av_preload/';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// ── Stable production destinations ───────────────────────────────────────────
// Theme is product-owned (not hero-scoped) and lives beside the existing menu
// BGM so the single HTMLMediaElement seam keeps one asset root.
const THEME_OUT = 'public/assets/music/forward_drive_theme.ogg';

// Hero SFX sit under the same hero-rework asset root as the already-accepted
// Robot/Hunter production SFX.
const HERO_SFX_ROOT = {
  CRYSTALA: 'public/assets/hero-rework/crystala-v1/sfx',
  MAGNET: 'public/assets/hero-rework/magnet-v1/sfx',
  FROST: 'public/assets/hero-rework/frost-v1/sfx',
  MIRROR: 'public/assets/hero-rework/mirror-v1/sfx',
};

// Clips that the pack marks OFF BY DEFAULT are still compact pre-cut runtime
// clips, so they are materialized to a quarantined `optional/` subdir and are
// explicitly NOT wired by the semantic SFX policy. Owner playtest can enable
// them without a second materialization pass.
const OPTIONAL_SUFFIX = '_optional.mp3';

function fail(msg) {
  console.error(`[core-six-av-preload] FAIL: ${msg}`);
  process.exit(1);
}

// ── Minimal ZIP reader (store + deflate) — no runtime dependency ─────────────
function readZipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) fail('ZIP EOCD not found');
  const count = buf.readUInt16LE(eocd + 10);
  let cd = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(cd) !== 0x02014b50) fail('bad central directory entry');
    const method = buf.readUInt16LE(cd + 10);
    const cSize = buf.readUInt32LE(cd + 20);
    const uSize = buf.readUInt32LE(cd + 24);
    const nameLen = buf.readUInt16LE(cd + 28);
    const extraLen = buf.readUInt16LE(cd + 30);
    const commentLen = buf.readUInt16LE(cd + 32);
    const lho = buf.readUInt32LE(cd + 42);
    const name = buf.slice(cd + 46, cd + 46 + nameLen).toString('utf8');
    const lNameLen = buf.readUInt16LE(lho + 26);
    const lExtraLen = buf.readUInt16LE(lho + 28);
    const dataStart = lho + 30 + lNameLen + lExtraLen;
    entries.push({ name, method, cSize, uSize, data: buf.slice(dataStart, dataStart + cSize) });
    cd += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function inflate(entry) {
  if (entry.method === 0) return entry.data;
  if (entry.method === 8) return inflateRawSync(entry.data);
  fail(`unsupported ZIP method ${entry.method} for ${entry.name}`);
}

// ── 1/2. archive + per-entry integrity ──────────────────────────────────────
const archiveBuf = fs.readFileSync(ARCHIVE);
const actualArchiveHash = sha256(archiveBuf);
if (actualArchiveHash !== ARCHIVE_SHA256) {
  fail(`archive SHA-256 mismatch\n  expected ${ARCHIVE_SHA256}\n  actual   ${actualArchiveHash}`);
}

const entries = readZipEntries(archiveBuf);
const byName = new Map(entries.map((e) => [e.name, e]));
const manifestEntry = byName.get(PREFIX + 'MANIFEST.json');
if (!manifestEntry) fail('MANIFEST.json missing from preload archive');
const manifest = JSON.parse(inflate(manifestEntry).toString('utf8'));

const listed = new Map(manifest.files.map((f) => [f.path, f]));
let verifiedEntries = 0;
for (const file of manifest.files) {
  const entry = byName.get(PREFIX + file.path);
  if (!entry) fail(`archive missing documented file ${file.path}`);
  const raw = inflate(entry);
  const actual = sha256(raw);
  if (actual !== file.sha256) fail(`${file.path} SHA-256 mismatch: ${actual}`);
  if (raw.length !== file.bytes) fail(`${file.path} byte length mismatch: ${raw.length}`);
  verifiedEntries++;
}

// ── 3. VFX authority parity — reuse in place, never fork ─────────────────────
function gitBlobSha(relPath) {
  try {
    return execFileSync('git', ['hash-object', relPath], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (error) {
    return null;
  }
}

const vfxReport = [];
for (const entry of entries) {
  if (!entry.name.endsWith('VFX/VFX_AUTHORITY_MANIFEST.json')) continue;
  const hero = entry.name.split('/')[2];
  const doc = JSON.parse(inflate(entry).toString('utf8'));
  const files = doc.files || [];
  for (const f of files) {
    const abs = path.join(ROOT, f.path);
    if (!fs.existsSync(abs)) {
      vfxReport.push({ hero, path: f.path, status: 'MISSING', required: !!f.required });
      continue;
    }
    const blob = gitBlobSha(f.path);
    const expected = f.blob_sha || f.blobSha || null;
    vfxReport.push({
      hero,
      path: f.path,
      status: expected == null ? 'PRESENT_UNPINNED' : (blob === expected ? 'BLOB_MATCH' : 'BLOB_DRIFT'),
      expectedBlob: expected,
      actualBlob: blob,
      required: !!f.required,
    });
  }
  for (const dep of doc.dependency_dirs || []) {
    const abs = path.join(ROOT, dep.path);
    vfxReport.push({
      hero,
      path: dep.path,
      status: fs.existsSync(abs) ? 'DIR_PRESENT' : 'DIR_MISSING',
      required: true,
    });
  }
}

// ── Recorded cutover drift ───────────────────────────────────────────────────
// The preload pins VFX-authority files by git blob SHA to catch FORKING or
// redesigning an accepted Gold engine. The Core Six SFX law, however,
// explicitly requires triggering from seams that live INSIDE two of those
// files (Magnet's `inspect().captureEvents` / Gold `a2capture`, and the single
// Mirror passive-shard authority). Those are additive presentation seams, not
// forks, so their post-cutover blobs are recorded here WITH the reason and the
// exact accepted hash.
//
// This is not a bypass: any FURTHER unrecorded change to these files still
// fails the check, so a real fork cannot slip through by hiding behind this
// allowlist.
const RECORDED_CUTOVER_DRIFT = Object.freeze({
  'public/game/hero-rework/heroReworkRuntime.js': Object.freeze({
    acceptedBlobSha: 'b348e67388aa56863cd06491610c52e153fa06ad',
    reason: 'ONE additive bus emit (MirrorPassiveShardProc) inside mirrorShardProc, '
      + 'the single passive-shard authority, so one realized proc yields at most one '
      + 'shard-drop accent. No Mirror VFX, routing or gameplay logic changed.',
  }),
  'public/game/hero-rework/magnetPresentationRuntime.js': Object.freeze({
    acceptedBlobSha: '526b7e105f753483fb418b22d8e30f8b2798c4de',
    reason: 'ONE additive SFX dispatch at the real A2 bullet-capture/redirection '
      + 'seam the pack names (captureEvents / Gold a2capture). No Magnet Gold VFX '
      + 'or field behavior changed.',
  }),
});

for (const entry of vfxReport) {
  const recorded = RECORDED_CUTOVER_DRIFT[entry.path];
  if (entry.status !== 'BLOB_DRIFT' || !recorded) continue;
  if (entry.actualBlob === recorded.acceptedBlobSha) {
    entry.status = 'BLOB_DRIFT_RECORDED';
    entry.reason = recorded.reason;
  }
}

const drift = vfxReport.filter((r) => r.status === 'BLOB_DRIFT' || r.status === 'MISSING' || r.status === 'DIR_MISSING');
if (drift.length) {
  for (const d of drift) {
    console.error(`  ${d.hero}: ${d.path} -> ${d.status}` + (d.expectedBlob ? ` (expected ${d.expectedBlob}, actual ${d.actualBlob})` : ''));
  }
  fail('VFX authority parity check failed — do not fork; reconcile the shipping runtimes first');
}

// ── 4. materialize compact runtime clips + theme ────────────────────────────
const written = [];
let skippedUnchanged = 0;

function writeStable(relOut, raw) {
  const abs = path.join(ROOT, relOut);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (fs.existsSync(abs) && sha256(fs.readFileSync(abs)) === sha256(raw)) {
    skippedUnchanged++;
    return false;
  }
  fs.writeFileSync(abs, raw);
  return true;
}

for (const file of manifest.files) {
  const raw = inflate(byName.get(PREFIX + file.path));
  const name = path.posix.basename(file.path);

  // Theme
  if (file.path === 'music/forward_drive_theme.ogg') {
    if (writeStable(THEME_OUT, raw)) written.push(THEME_OUT);
    continue;
  }

  // Hero SFX only. Everything else (README/MANIFEST/VFX authority docs) is
  // documentation and stays in docs/gold-ui/preload.
  const sfxMatch = /^heroes\/([A-Z]+)\/SFX\/([^/]+\.mp3)$/.exec(file.path);
  if (!sfxMatch) continue;
  const hero = sfxMatch[1];
  const root = HERO_SFX_ROOT[hero];
  if (!root) fail(`no destination root for hero ${hero}`);
  const isOptional = name.endsWith(OPTIONAL_SUFFIX);
  const relOut = `${root}/${isOptional ? 'optional/' : ''}${name}`;
  if (writeStable(relOut, raw)) written.push(relOut);
}

// ── report ──────────────────────────────────────────────────────────────────
const summary = {
  tool: 'tools/materializeCoreSixAvPreload.mjs',
  archive: 'docs/gold-ui/preload/APEX_CHAOS_CORE_SIX_AV_THEME_PRELOAD.zip',
  archiveSha256: actualArchiveHash,
  entriesVerified: verifiedEntries,
  entriesDocumented: manifest.files.length,
  vfxAuthorityFiles: vfxReport.length,
  vfxBlobMatch: vfxReport.filter((r) => r.status === 'BLOB_MATCH').length,
  vfxRecordedCutoverDrift: vfxReport.filter((r) => r.status === 'BLOB_DRIFT_RECORDED').map((r) => r.path),
  written,
  skippedUnchanged,
  theme: THEME_OUT,
};
console.log(JSON.stringify(summary, null, 2));

if (summary.entriesVerified !== summary.entriesDocumented) fail('not all documented entries verified');
if (written.length === 0 && skippedUnchanged === 0) fail('nothing materialized — archive contains no runtime clips');

export { summary };
