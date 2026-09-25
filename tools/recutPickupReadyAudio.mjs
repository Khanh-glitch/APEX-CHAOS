import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import decodeAudio from 'audio-decode';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FEEL = path.join(ROOT, 'public/assets/arsenal/av/sfx/feel');

function writeWav(file, samples, sr) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((v * 32767) | 0, 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
}

function monoFromBuffer(ab) {
  const chs = ab.channelData || [];
  const ch0 = chs[0];
  if (!ch0) throw new Error('no channel');
  if (chs.length === 1) return { sr: ab.sampleRate, data: ch0 };
  const ch1 = chs[1];
  const data = new Float32Array(ch0.length);
  for (let i = 0; i < ch0.length; i++) data[i] = (ch0[i] + ch1[i]) * 0.5;
  return { sr: ab.sampleRate, data };
}

function onset(data, thrFrac = 0.035) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const thr = peak * thrFrac;
  let first = 0;
  for (let i = 0; i < data.length; i++) if (Math.abs(data[i]) >= thr) { first = i; break; }
  let last = data.length - 1;
  for (let i = data.length - 1; i >= 0; i--) if (Math.abs(data[i]) >= thr * 0.35) { last = i; break; }
  return { first, last, peak };
}

function slice(data, sr, t0, t1, fade = 0.004) {
  const a = Math.max(0, Math.floor(t0 * sr));
  const b = Math.min(data.length, Math.ceil(t1 * sr));
  const out = data.slice(a, b);
  const fn = Math.min(out.length, Math.floor(fade * sr));
  for (let i = 0; i < fn; i++) {
    out[i] *= i / fn;
    out[out.length - 1 - i] *= i / fn;
  }
  return out;
}

async function load(rel) {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  const ab = await decodeAudio(buf);
  return monoFromBuffer(ab);
}

const cuts = [];

async function cutFrom(sourceRel, destName, t0, t1, weapons) {
  const { sr, data } = await load(sourceRel);
  const win = data.subarray(Math.floor(t0 * sr), Math.ceil(t1 * sr));
  const o = onset(win);
  const start = t0 + o.first / sr - 0.008;
  const end = t0 + o.last / sr + 0.090;
  const samples = slice(data, sr, Math.max(0, start), end);
  writeWav(path.join(FEEL, destName), samples, sr);
  const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  cuts.push({
    derived_file: destName,
    source_file: sourceRel,
    start_sec: start.toFixed(3),
    end_sec: end.toFixed(3),
    duration_sec: (samples.length / sr).toFixed(3),
    peak_or_rms: 'peak=' + peak.toFixed(3),
    assigned_weapons: weapons,
  });
}

await cutFrom('public/assets/arsenal/av/sfx/source/sound-effect-recharge-gun.wav', 'pickup_pistol.wav', 0.00, 0.55, 'PISTOL|GLOCK_17|TEC_9|BERETTA_93R|DESERT_DEAGLE|MAGNUM_500');
await cutFrom('public/assets/shotgun_v1/audio/special_reloading_after_use_the_dash_skill.wav', 'pickup_shotgun.wav', 0.04, 0.55, 'SHOTGUN|MOSSBERG_500|SAWED_OFF|JACKHAMMER');
await cutFrom('public/assets/arsenal/av/sfx/c-final/SNIPER/sniper_chamber.wav', 'pickup_sniper.wav', 0.00, 0.92, 'SNIPER');

const rifle = 'public/assets/arsenal/av/sfx/source/Rifle Reload Sound Effect.mp3';
const rifleCuts = [
  ['rifle_take_01.wav', 15.90, 16.40, 'AK_47'],
  ['rifle_take_02.wav', 18.44, 18.78, 'SMG'],
  ['rifle_take_03.wav', 20.93, 21.32, 'M16'],
  ['rifle_take_04.wav', 21.32, 21.72, 'ZBROYAR_Z15|ZBROYAR_Z15_S1|ZBROYAR_Z15_S2|ZBROYAR_Z15_S3'],
  ['rifle_take_05.wav', 24.44, 24.82, 'MAC_10'],
  ['rifle_take_06.wav', 24.72, 25.05, 'unused_short_alt'],
  ['rifle_take_07.wav', 26.92, 27.38, 'MBR'],
  ['rifle_take_08.wav', 29.42, 29.90, 'MBR2'],
  ['rifle_take_09.wav', 31.95, 32.32, 'P90'],
  ['rifle_take_10.wav', 34.28, 34.68, 'M249_SAW'],
  ['rifle_take_11.wav', 34.67, 35.10, 'SZECSEI_FUCHS'],
];
for (const [name, a, b, w] of rifleCuts) await cutFrom(rifle, name, a, b, w);

const csv = ['derived_file,source_file,start_sec,end_sec,duration_sec,peak_or_rms,assigned_weapons',
  ...cuts.map((r) => [r.derived_file, r.source_file, r.start_sec, r.end_sec, r.duration_sec, r.peak_or_rms, r.assigned_weapons].join(','))];
// keep casing/shell rows from previous map
const prev = fs.readFileSync(path.join(ROOT, 'docs/arsenal-quest/GUN_PICKUP_AUDIO_CUT_MAP.csv'), 'utf8').trim().split('\n').slice(1);
for (const line of prev) {
  if (line.startsWith('casing_') || line.startsWith('shell_')) csv.push(line);
}
fs.writeFileSync(path.join(ROOT, 'docs/arsenal-quest/GUN_PICKUP_AUDIO_CUT_MAP.csv'), csv.join('\n') + '\n');
console.log(csv.join('\n'));
