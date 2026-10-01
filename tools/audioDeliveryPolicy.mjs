// Audio 2B — runtime audio delivery policy (single authority).
//
// Separates DELIVERY FORMAT from RUNTIME PLAYBACK REPRESENTATION so a future
// optimizer run can never regress the audio architecture:
//
//   HOT_LATENCY_SFX   compressed (mp3) or retained WAV delivery -> fetched and
//                     decodeAudioData()'d into cached AudioBuffers by the
//                     Arsenal AV runtime preload (APEX_ARSENAL_AV) BEFORE
//                     first gameplay use. Trigger = AudioBufferSourceNode.
//                     start() on an already-ready buffer: zero fetch, zero
//                     decode. Files explicitly listed in `retainWav` are
//                     intentionally WAV at runtime (latency/quality audits)
//                     and must NEVER be auto-converted by the optimizer.
//   WARM_GAMEPLAY_SFX compressed delivery; prefetched into the HTTP cache by
//                     the tiered loader (apexWarmAudioUrls) the moment the
//                     owning runtime group loads. Played via HTMLAudioElement
//                     pools or runtime fetch+decode paths.
//   COLD_RARE_SFX     compressed + lazy: fetched only when the content
//                     becomes relevant (Lab-only / rare encounter audio).
//   LONG_STREAM_AUDIO BGM + long ambience: compressed, streamed via
//                     HTMLAudioElement. NEVER decoded into AudioBuffers.
//   SOURCE_MASTER     provenance masters (masters/, */source/ dirs): never
//                     converted, never delivered.
//
// Classification is derived from the same reference map the asset audit
// computes (tools/assetAudit.mjs calls classifyAudio below).
export const AUDIO_DELIVERY_POLICY = {
  HOT_LATENCY_SFX: {
    delivery: 'mp3 (or retained runtime WAV per retainWav list)',
    runtime: 'AudioBuffer predecode via APEX_ARSENAL_AV preload + AudioBufferSourceNode playback',
    // AV bank = every audio file referenced by the Arsenal presentation
    // runtime's AUDIO config + casing/shell pools (its own preload decodes
    // exactly these).
    authorityFiles: ['public/game/arsenal/arsenalPresentationRuntime.js'],
    // Intentionally retained runtime WAVs. Empty today; any file added here is
    // protected from automatic (re)conversion by optimizeRuntimeAssets.mjs.
    retainWav: [],
  },
  WARM_GAMEPLAY_SFX: {
    delivery: 'mp3',
    runtime: 'HTTP-cache prefetch at runtime-group load (apexWarmAudioUrls) + HTMLAudioElement pools',
    authorityFiles: ['public/game/fighters/', 'public/game/modes/', 'public/game/arsenal/'],
  },
  COLD_RARE_SFX: {
    delivery: 'mp3 lazy',
    runtime: 'fetched on first relevance (Lab / rare content)',
  },
  LONG_STREAM_AUDIO: {
    delivery: 'mp3/ogg streamed',
    runtime: 'HTMLAudioElement streaming; never decoded to AudioBuffer',
    // Genuinely long media that must stream. Matched by basename below.
    streams: ['menu_bgm.mp3', 'possession-ambience.mp3'],
  },
  SOURCE_MASTER: {
    delivery: 'never delivered',
    runtime: 'provenance only (masters/ tree, */source/ dirs, wav-with-mp3-sibling masters)',
  },
};

const LONG_STREAMS = new Set(AUDIO_DELIVERY_POLICY.LONG_STREAM_AUDIO.streams);
const HOT_AUTHORITY = AUDIO_DELIVERY_POLICY.HOT_LATENCY_SFX.authorityFiles;
const WARM_AUTHORITY_PREFIXES = AUDIO_DELIVERY_POLICY.WARM_GAMEPLAY_SFX.authorityFiles;

export function classifyAudio(asset) {
  // asset = { path, type, classification, shipRefs: [{file, match}] } from the audit
  const base = asset.path.split('/').pop();
  if (asset.classification === 'SOURCE_MASTER_PROVENANCE_ONLY') return 'SOURCE_MASTER';
  if (LONG_STREAMS.has(base)) return 'LONG_STREAM_AUDIO';
  if (asset.shipRefs.some((r) => HOT_AUTHORITY.includes(r.file))) return 'HOT_LATENCY_SFX';
  if (asset.shipRefs.some((r) => WARM_AUTHORITY_PREFIXES.some((p) => r.file.startsWith(p)))) {
    return 'WARM_GAMEPLAY_SFX';
  }
  if (asset.classification === 'SHIPPING_HOT' || asset.classification === 'SHIPPING_LAZY') {
    return 'COLD_RARE_SFX';
  }
  return null; // non-shipping audio keeps its LEGACY classification only
}

export function isProtectedRuntimeWav(publicPath) {
  return AUDIO_DELIVERY_POLICY.HOT_LATENCY_SFX.retainWav.includes(publicPath);
}
