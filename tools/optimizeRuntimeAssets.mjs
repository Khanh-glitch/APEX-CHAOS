// A5 — measured runtime asset delivery optimization.
//
// Driven by tools/assetAudit.mjs classification. Performs ONLY justified
// conversions:
//
//   * PNG -> WebP for SHIPPING_LAZY images >= 50KB ("small KB PNGs skip"),
//     plus the vfx/c smoke/spark template family so the runtime template
//     `vfx/c/smoke_${n}.png` stays extension-uniform. Lossless WebP wins when
//     it saves >= 15%; otherwise the repo-standard q92 lossy candidate
//     (convertAssetsToWebp.py conventions) is used when it saves >= 40%.
//     Quality metrics (max channel delta, RMSE) are recorded per file.
//   * WAV -> MP3 for every SHIPPING_LAZY wav (compressed audio delivery).
//     VBR -q:a 2 (~190kbps), original channels/sample rate, metadata
//     stripped. Verified: duration drift < 40ms, non-silent, smaller than
//     the master.
//
// Converted originals are preserved as provenance masters under masters/
// (outside public/, so they are no longer shipped bytes but stay in git).
// References in shipping code, public runtime scripts, and the test tooling
// are rewritten to the converted basenames; the public asset manifest is
// regenerated. A before/after report lands in reports/asset-optimization.json.
//
// Usage: node tools/optimizeRuntimeAssets.mjs [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isProtectedRuntimeWav, classifyAudio, AUDIO_DELIVERY_POLICY } from './audioDeliveryPolicy.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(REPO, 'public');
const MASTERS = path.join(REPO, 'masters');
const AUDIT = path.join(REPO, 'reports', 'asset-audit.json');
const OUT_REPORT = path.join(REPO, 'reports', 'asset-optimization.json');
const FFMPEG = path.join(REPO, 'node_modules', '.pnpm', '@ffmpeg-installer+ffmpeg@1.1.0', 'node_modules', '@ffmpeg-installer', 'linux-x64', 'ffmpeg');
const PNG_HELPER = path.join(REPO, 'tools', 'optimizePng.py');

const DRY_RUN = process.argv.includes('--dry-run');
const PNG_MIN_BYTES = 50 * 1024;
// Template family in arsenalPresentationRuntime.js — all four must convert
// together so `vfx/c/(smoke|spark)_${n}.png` becomes uniformly .webp.
const TEMPLATE_FAMILY = /^\/assets\/arsenal\/av\/vfx\/c\/(smoke|spark)_\d+\.png$/;

const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const lazy = audit.assets.filter((a) => a.classification === 'SHIPPING_LAZY');

const pngCandidates = lazy.filter((a) => a.path.endsWith('.png')
  && (a.bytes >= PNG_MIN_BYTES || TEMPLATE_FAMILY.test(a.path)));
// Audio 2B policy: intentionally retained runtime WAVs (HOT bank latency/
// quality audits) are never converted; long-stream media is never converted
// to anything that would tempt AudioBuffer decoding (it is already compressed
// delivery, so there is nothing to do).
const wavCandidates = lazy.filter((a) => a.path.endsWith('.wav') && !isProtectedRuntimeWav(a.path));

console.log(`PNG candidates: ${pngCandidates.length} (${(pngCandidates.reduce((s, a) => s + a.bytes, 0) / 1048576).toFixed(1)}MB)`);
console.log(`WAV candidates: ${wavCandidates.length} (${(wavCandidates.reduce((s, a) => s + a.bytes, 0) / 1048576).toFixed(1)}MB)`);

function publicToAbs(publicPath) {
  return path.join(PUBLIC, publicPath.replace(/^\//, ''));
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------
const pngResults = [];
const wavResults = [];

function convertPng(asset) {
  const src = publicToAbs(asset.path);
  const dst = src.replace(/\.png$/i, '.webp');
  const tmpLossless = dst.replace(/\.webp$/, '.lossless-tmp.webp');
  const tmpLossy = dst.replace(/\.webp$/, '.lossy-tmp.webp');
  const py = spawnSync('python3', [PNG_HELPER, src, tmpLossless, tmpLossy], { encoding: 'utf8' });
  if (py.status !== 0) throw new Error(`optimizePng.py failed for ${asset.path}: ${py.stderr}`);
  const metrics = JSON.parse(py.stdout);
  const losslessBytes = fs.statSync(tmpLossless).size;
  const lossyBytes = fs.statSync(tmpLossy).size;
  let mode = null;
  if (metrics.losslessOk && losslessBytes <= asset.bytes * 0.85) mode = 'lossless';
  else if (metrics.lossyOk && lossyBytes <= asset.bytes * 0.6) mode = 'lossy-q92';
  const chosenBytes = mode === 'lossless' ? losslessBytes : mode === 'lossy-q92' ? lossyBytes : null;
  if (mode) {
    fs.copyFileSync(mode === 'lossless' ? tmpLossless : tmpLossy, dst);
  }
  fs.rmSync(tmpLossless, { force: true });
  fs.rmSync(tmpLossy, { force: true });
  return {
    path: asset.path, beforeBytes: asset.bytes, afterBytes: chosenBytes, mode,
    maxChannelDelta: mode === 'lossy-q92' ? metrics.lossyMetrics.maxChannelDelta : 0,
    rmse: mode === 'lossy-q92' ? metrics.lossyMetrics.rmse : 0,
    losslessBytes, lossyBytes,
  };
}

function ffmpegStderr(args) {
  const r = spawnSync(FFMPEG, ['-hide_banner', ...args], { encoding: 'utf8' });
  return (r.stderr || '') + (r.stdout || '');
}

function probeDuration(file) {
  const out = ffmpegStderr(['-i', file, '-f', 'null', '-']);
  const m = out.match(/time=(\d+):(\d+):(\d+\.\d+)/);
  if (!m) return null;
  return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
}

function probeMeanVolume(file) {
  const out = ffmpegStderr(['-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  const m = out.match(/mean_volume:\s*(-?[\d.]+) dB/);
  return m ? parseFloat(m[1]) : null;
}

function convertWav(asset) {
  const src = publicToAbs(asset.path);
  const dst = src.replace(/\.wav$/i, '.mp3');
  try {
    const enc = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-q:a', '2', dst], { encoding: 'utf8' });
    if (enc.status !== 0) throw new Error(enc.stderr?.slice(0, 300));
  } catch (error) {
    return { path: asset.path, beforeBytes: asset.bytes, afterBytes: null, mode: 'failed', error: String(error.message).slice(0, 200) };
  }
  const afterBytes = fs.statSync(dst).size;
  const beforeDur = probeDuration(src);
  const afterDur = probeDuration(dst);
  const beforeVol = probeMeanVolume(src);
  const afterVol = probeMeanVolume(dst);
  const durationDriftMs = beforeDur != null && afterDur != null ? Math.abs(beforeDur - afterDur) * 1000 : null;
  const ok = afterBytes < asset.bytes
    && (durationDriftMs == null || durationDriftMs < 40)
    && afterVol != null && afterVol > -70
    && (beforeVol == null || afterVol > beforeVol - 6);
  if (!ok) {
    fs.rmSync(dst, { force: true });
    return { path: asset.path, beforeBytes: asset.bytes, afterBytes: null, mode: 'skipped', durationDriftMs, beforeVol, afterVol };
  }
  return { path: asset.path, beforeBytes: asset.bytes, afterBytes, mode: 'mp3-q2', durationDriftMs, beforeVol, afterVol };
}

if (!DRY_RUN) {
  for (const asset of pngCandidates) {
    pngResults.push(convertPng(asset));
    const r = pngResults[pngResults.length - 1];
    console.log(`[png] ${asset.path} ${r.mode} ${(r.beforeBytes / 1024).toFixed(0)}KB -> ${r.afterBytes ? (r.afterBytes / 1024).toFixed(0) + 'KB' : 'keep'}`);
  }
  for (const asset of wavCandidates) {
    wavResults.push(convertWav(asset));
    const r = wavResults[wavResults.length - 1];
    console.log(`[wav] ${asset.path} ${r.mode} ${(r.beforeBytes / 1024).toFixed(0)}KB -> ${r.afterBytes ? (r.afterBytes / 1024).toFixed(0) + 'KB' : 'keep'}`);
  }
}

// ---------------------------------------------------------------------------
// Master preservation + reference rewrite
// ---------------------------------------------------------------------------
function masterPathFor(publicPath, kind) {
  return path.join(MASTERS, kind, publicPath.replace(/^\//, ''));
}

const convertedPngs = pngResults.filter((r) => r.mode && r.mode !== 'skipped' && r.mode !== 'failed');
const convertedWavs = wavResults.filter((r) => r.mode === 'mp3-q2');

function toNewBase(publicPath) {
  return publicPath.replace(/\.png$/i, '.webp').replace(/\.wav$/i, '.mp3');
}

const consumerScanRoots = ['src', 'public/game', 'tools'];
const consumerRootFiles = fs.readdirSync(PUBLIC, { withFileTypes: true })
  .filter((e) => e.isFile() && /\.(js|json|html|css)$/i.test(e.name) && e.name !== 'asset-manifest.json')
  .map((e) => path.join(PUBLIC, e.name));

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const textFiles = [
  ...consumerScanRoots.flatMap((root) => walk(path.join(REPO, root))),
  ...consumerRootFiles,
].filter((f) => /\.(js|jsx|cjs|mjs|json|html|css|py)$/i.test(f) && !f.includes(path.join('tools', 'arsenal-assets')));

const refUpdates = [];
if (!DRY_RUN) {
  // Two-stage safe replacement:
  //   stage 1 — longest unambiguous path token (no other public asset path
  //             ends with it), covering path-form references like
  //             'vfx/explosion_pack_2/half/1.png';
  //   stage 2 — bare basename with word boundaries, covering short-form refs
  //             (test literals like endsWith('sks.wav')). Only applied when
  //             the basename is unique across public assets, so '1.png'
  //             never corrupts 'frame_001.png'.
  // Generator tools that WRITE png/wav bytes (buildArsenalCAssets,
  // materializeArsenalFinalSfx, recutPickupReadyAudio) are excluded: their
  // output names describe the bytes they emit, not delivery paths.
  const EXCLUDED_TOOLS = new Set([
    'tools/buildArsenalCAssets.mjs',
    'tools/materializeArsenalFinalSfx.mjs',
    'tools/recutPickupReadyAudio.mjs',
    'tools/prepareFangAssets.py',
    'tools/prepareShotgunAssets.py',
    'tools/prepareKatanaAssets.py',
    'tools/convertAssetsToWebp.py',
    'tools/assetAudit.mjs',
    'tools/optimizeRuntimeAssets.mjs',
    'tools/optimizePng.py',
  ]);
  const allPaths = audit.assets.map((a) => a.path);
  const safeToken = (publicPath) => {
    const segs = publicPath.split('/').filter(Boolean);
    let token = segs[segs.length - 1];
    const collides = (t) => allPaths.some((p) => p !== publicPath && (p.endsWith('/' + t) || p === '/' + t));
    while ((collides(token) || token.length < 8) && segs.length > 1) {
      segs.pop();
      token = `${segs[segs.length - 1]}/${token}`;
    }
    return token;
  };
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const tokenReplacements = [];
  const basenameReplacements = [];
  for (const r of [...convertedPngs, ...convertedWavs]) {
    const oldBase = path.basename(r.path);
    const newBase = path.basename(toNewBase(r.path));
    const token = safeToken(r.path);
    const newToken = token.slice(0, token.length - oldBase.length) + newBase;
    tokenReplacements.push([token, newToken]);
    if (allPaths.filter((p) => path.basename(p) === oldBase).length === 1) {
      basenameReplacements.push([new RegExp(`(?<![\\w-])${escapeRegex(oldBase)}(?![\\w-])`, 'g'), newBase]);
    } else {
      console.warn(`[refs] ambiguous basename skipped: ${oldBase}`);
    }
    // Preserve the master outside public/ delivery.
    const kind = r.path.endsWith('.png') ? 'images' : 'audio';
    const masterDst = masterPathFor(r.path, kind);
    fs.mkdirSync(path.dirname(masterDst), { recursive: true });
    fs.renameSync(publicToAbs(r.path), masterDst);
  }
  // Template family rewrite (arsenalPresentationRuntime.js builds paths as
  // `vfx/c/smoke_${n}.png` — every family member converted above).
  tokenReplacements.push(['smoke_${n}.png', 'smoke_${n}.webp']);
  tokenReplacements.push(['spark_${n}.png', 'spark_${n}.webp']);

  for (const file of textFiles) {
    const rel = path.relative(REPO, file).split(path.sep).join('/');
    if (EXCLUDED_TOOLS.has(rel)) continue;
    let text = fs.readFileSync(file, 'utf8');
    const before = text;
    for (const [from, to] of tokenReplacements) text = text.split(from).join(to);
    for (const [re, to] of basenameReplacements) text = text.replace(re, to);
    if (text !== before) {
      fs.writeFileSync(file, text);
      refUpdates.push(rel);
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
function sum(list, key) { return list.reduce((s, x) => s + (x[key] || 0), 0); }

const remainingLazy = audit.assets
  .filter((a) => a.classification === 'SHIPPING_LAZY' && !convertedPngs.some((c) => c.path === a.path) && !convertedWavs.some((c) => c.path === a.path));

const report = {
  generatedAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  images: {
    candidates: pngCandidates.length,
    converted: convertedPngs.length,
    beforeBytes: sum(convertedPngs, 'beforeBytes'),
    afterBytes: sum(convertedPngs, 'afterBytes'),
    skipped: pngResults.filter((r) => r.mode === 'skipped' || r.mode === null).length,
    files: pngResults,
  },
  audio: {
    candidates: wavCandidates.length,
    converted: convertedWavs.length,
    beforeBytes: sum(convertedWavs, 'beforeBytes'),
    afterBytes: sum(convertedWavs, 'afterBytes'),
    skippedOrFailed: wavResults.filter((r) => r.mode !== 'mp3-q2').length,
    files: wavResults,
  },
  referencesUpdated: refUpdates,
  mastersMoved: [...convertedPngs, ...convertedWavs].map((r) => ({ from: r.path, to: 'masters/' + (r.path.endsWith('.png') ? 'images/' : 'audio/') + r.path.replace(/^\//, '') })),
  hotPathBytes: audit.summary.hotPathBytes,
  audioPolicy: {
    policy: AUDIO_DELIVERY_POLICY,
    classes: audit.summary.audioDeliveryPolicy?.classes || null,
    retainedRuntimeWavs: AUDIO_DELIVERY_POLICY.HOT_LATENCY_SFX.retainWav,
    streams: AUDIO_DELIVERY_POLICY.LONG_STREAM_AUDIO.streams,
    convertedClasses: convertedWavs.map((r) => ({ path: r.path, audioClass: classifyAudio(r) })),
  },
  remainingLargestShippingLazy: remainingLazy.sort((a, b) => b.bytes - a.bytes).slice(0, 15).map((a) => ({ path: a.path, bytes: a.bytes })),
};

fs.mkdirSync(path.dirname(OUT_REPORT), { recursive: true });
fs.writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2));
console.log('\n=== SUMMARY ===');
console.log(JSON.stringify({
  imagesConverted: report.images.converted,
  imageBytes: `${(report.images.beforeBytes / 1048576).toFixed(2)}MB -> ${(report.images.afterBytes / 1048576).toFixed(2)}MB`,
  audioConverted: report.audio.converted,
  audioBytes: `${(report.audio.beforeBytes / 1048576).toFixed(2)}MB -> ${(report.audio.afterBytes / 1048576).toFixed(2)}MB`,
  referencesUpdated: refUpdates.length,
  report: OUT_REPORT,
}, null, 2));
