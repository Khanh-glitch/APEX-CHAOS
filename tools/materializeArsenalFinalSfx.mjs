import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

const ROOT = process.cwd();
const ZIP_PATH = path.join(ROOT, 'tools/arsenal-assets/source/sfx/final-lock/APEX_C1_SFX_FINAL_LOCK.zip');
const OUT_ROOT = path.join(ROOT, 'public/assets/arsenal/av/sfx/c-final');
const AV_MANIFEST = path.join(ROOT, 'public/assets/arsenal/av/MANIFEST.csv');
const EXPECTED_ZIP_SHA256 = 'cd1181a6c2957cd93dfbb32f41ad540a6918ec7eee03d34218434c0a4604ffac';

const EXPECTED = {
  'BATTLE_AXE/axe_body.wav':'a1fde18b3403dd041f31c2e1db78752d90a357c3377bb26d5000cd1fdd132c9f',
  'BATTLE_AXE/axe_contact.wav':'f420de0f731577792f79daad296a94edae0a7d357700cd8c089c33c08c5da569',
  'BATTLE_AXE/axe_motion.wav':'d98089255950597a625ec519185188c0a342270069253f2eaf6ea05b4ecc3b64',
  'DAGGER/dagger_contact.wav':'339a8f85382ec911c44b027680a342a692dd3c44cebca133d09b96a3c77cf58b',
  'DAGGER/dagger_motion.wav':'b2683d38b3671fc7d78fbf6f70ad089fcf8b87c5ee9257c64feac2d9894a3e61',
  'GRENADE/grenade_core.wav':'2975fc904f7014d700a19def9258a187a18acaf5c9f43d96a48d6d96daad5334',
  'GRENADE/grenade_low.wav':'0d716ce2f1c1e30e73beb4a86809d15d5f0404a212f15ddccbdc5c123162a495',
  'PISTOL/pistol_mech_click.wav':'10157148f0513c08a8ced7201dbfcf494d4ac1a22be111e7a4b1cc7321397eb2',
  'SABRE/sabre_cut.wav':'ae5be6548ffc096da85b21419458d6d86628fc9a1ea955c6c12fddea127ebbc9',
  'SABRE/sabre_motion.wav':'410e752fba14b7b3641c324495b070534490f6e91bce8104817f7851a5ab87f2',
  'SHOTGUN/shotgun_rack_pull.wav':'2300c88373b2cc0f8dbf4a7cfcb00daaa932d50b032f3ba097b05e7bd69a53df',
  'SHOTGUN/shotgun_rack_push.wav':'5dd4fb0094822b6900e27ec5ead72286621652971e81d0de4d10244e0994d236',
  'SNIPER/sniper_bolt_lock.wav':'97d24d685f37a4854c5c1663973473657c668c852666c0b314a93dfe014d0800',
  'SNIPER/sniper_chamber.wav':'b547ea1ada142ca10a95da84a0a78c2501434b4c9a6037a9ad9e44642cd54e6b',
  'SPEAR/spear_impact.wav':'e97d7130696e770dc1a47a75017b7de7e58f2d29e470f99e4b5b455f811eea9b',
  'SPEAR/spear_motion.wav':'5239cda0ac22d6136ce4d2cd3fdfe5edd95177ece2e1e7e7b0407096b93545bf',
  'SPIKED_CLUB/club_body.wav':'a1fde18b3403dd041f31c2e1db78752d90a357c3377bb26d5000cd1fdd132c9f',
  'SPIKED_CLUB/club_swing.wav':'328aae0303d68638b4702063f7c56d8e87b53849813644e6f0eab5e9f4f2442b',
  'SWIRL_SHIELD/swirl_shield_block.wav':'f1ebfadc4c251bc62ebe1a8de182c47a84ac6420e898f99591d78ce3e3ac1f9a',
  'TOWER_SHIELD/tower_shield_block.wav':'f6ae7ccbd7c65daf65d48180b562d3bd4bf164aaf01b05fe19b42d2bd9da72b9'
};

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const zip = fs.readFileSync(ZIP_PATH);
if (sha256(zip) !== EXPECTED_ZIP_SHA256) throw new Error('final-lock ZIP integrity check failed');

function eocdOffset(buf) {
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error('ZIP EOCD not found');
}

const eocd = eocdOffset(zip);
const entryCount = zip.readUInt16LE(eocd + 10);
let cd = zip.readUInt32LE(eocd + 16);
const generated = [];
fs.mkdirSync(OUT_ROOT, { recursive: true });

for (let n = 0; n < entryCount; n++) {
  if (zip.readUInt32LE(cd) !== 0x02014b50) throw new Error('bad central directory entry');
  const method = zip.readUInt16LE(cd + 10);
  const compressedSize = zip.readUInt32LE(cd + 20);
  const filenameLen = zip.readUInt16LE(cd + 28);
  const extraLen = zip.readUInt16LE(cd + 30);
  const commentLen = zip.readUInt16LE(cd + 32);
  const localOffset = zip.readUInt32LE(cd + 42);
  const rawName = zip.subarray(cd + 46, cd + 46 + filenameLen).toString('utf8');
  const name = rawName.split(String.fromCharCode(92)).join('/');

  if (zip.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('bad local ZIP header');
  const lfNameLen = zip.readUInt16LE(localOffset + 26);
  const lfExtraLen = zip.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + lfNameLen + lfExtraLen;
  const packed = zip.subarray(dataStart, dataStart + compressedSize);
  let data;
  if (method === 8) data = inflateRawSync(packed);
  else if (method === 0) data = packed;
  else throw new Error('unsupported ZIP method ' + method);

  if (name.startsWith('runtime_wav/')) {
    const rel = name.slice('runtime_wav/'.length);
    if (!EXPECTED[rel]) throw new Error('unexpected runtime SFX: ' + rel);
    const actual = sha256(data);
    if (actual !== EXPECTED[rel]) throw new Error('runtime SFX integrity mismatch: ' + rel);
    const out = path.join(OUT_ROOT, ...rel.split('/'));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, data);
    generated.push({ rel, out, bytes:data.length, sha:actual });
  } else if (name.startsWith('metadata/')) {
    const rel = name.slice('metadata/'.length);
    if (!rel || rel.includes('..')) {
      cd += 46 + filenameLen + extraLen + commentLen;
      continue;
    }
    const out = path.join(OUT_ROOT, 'metadata', rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, data);
  }

  cd += 46 + filenameLen + extraLen + commentLen;
}

for (const rel of Object.keys(EXPECTED)) {
  if (!generated.some((x) => x.rel === rel)) throw new Error('missing runtime SFX: ' + rel);
}

const provenance = [
  '# Checkpoint C Final-Lock SFX',
  '',
  'Recovered from the owner-approved APEX_C1_SFX_FINAL_LOCK bundle.',
  '',
  '- Source selection and exact trims: `metadata/APEX_C1_FINAL_SFX_MAP.csv`',
  '- Runtime format: PCM16 WAV, 48 kHz, mono',
  '- Runtime files: 20',
  '- Bundle SHA-256: `' + EXPECTED_ZIP_SHA256 + '`',
  '- Gun-fire baseline remains the previously approved `cz / sks / shotty / mosin` set.',
  '- These files replace the old Kenney/RPG/scifi fallback layers for the weapon events covered by the final lock.',
  '- Full source masters stay outside Git. Only the approved trimmed runtime WAVs are materialized here.',
  '- Preserve the original source/Sonniss licensing records; do not treat these runtime extracts as a standalone sound library.',
  ''
].join('\n');
fs.writeFileSync(path.join(OUT_ROOT, 'PROVENANCE.md'), provenance);

let rows = fs.existsSync(AV_MANIFEST)
  ? fs.readFileSync(AV_MANIFEST, 'utf8').trimEnd().split(/\r?\n/)
  : ['path,bytes,sha256'];
rows = rows.filter((line, i) => i === 0 || !line.includes('/sfx/c-final/'));
for (const x of generated.sort((a,b) => a.rel.localeCompare(b.rel))) {
  const repoPath = path.relative(ROOT, x.out).split(path.sep).join('/');
  rows.push(repoPath + ',' + x.bytes + ',' + x.sha);
}
fs.writeFileSync(AV_MANIFEST, rows.join('\n') + '\n');
console.log('Materialized ' + generated.length + ' owner-approved final-lock SFX files.');
