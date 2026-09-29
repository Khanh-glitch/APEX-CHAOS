import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const REF_ZIP = path.join(ROOT, 'docs/hero-rework/post-playtest-2026-09-29/reference/APEX_HUNTER_SFX_GAME_READY.zip');
const OUT_DIR = path.join(ROOT, 'public/assets/hero-rework/hunter-v10/sfx');
const TMP_ZIP = path.join(ROOT, '.hunter-sfx-prep.tmp.zip');
const ARCHIVE_SHA = 'e1aedcd48f5dc136fbf12aeb95145f87a9fc2ea2ff92ecb6bf21fe2146845014';
const FILES = Object.freeze({
  'hunter_a1_charge_personal.mp3': 'a481406872ae4062fc426af296137804cd04c6380126363730f497dd0f52f511',
  'hunter_a1_clamp.mp3': 'bef29c9ef4b686fc4462ec97224798fc69545976fd64faae3eb5c7aa64fd1af6',
  'hunter_a1_deploy_mechanism.mp3': 'b38a31f5cbb833fb6339b307e6e9b49a17fc5298d8236da4b4f0a5ec4fbf8a8e',
  'hunter_a1_unfold_blade.mp3': '5b8e0fdc220386f4fae3b2e036fa2fc384e95b47ed36efb08464c02f70fd2b54',
  'hunter_a2_catch_flesh.mp3': '4d195cc24fffec6e972b1470a5fec0e25e87bc10b6814dd6e4bd25825a23791d',
  'hunter_a2_pounce_sweep.mp3': 'a0781b5f58df749f8e2c7c9ca636aeb2b73a4e7dcec236f0fa8fd6f660044270',
});
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
if (!fs.existsSync(REF_ZIP)) throw new Error(`Missing staged Hunter SFX archive: ${REF_ZIP}`);
const zip = fs.readFileSync(REF_ZIP);
if (sha256(zip) !== ARCHIVE_SHA) throw new Error(`Hunter SFX archive SHA mismatch: ${sha256(zip)}`);
fs.writeFileSync(TMP_ZIP, zip);
fs.mkdirSync(OUT_DIR, { recursive: true });
const un = spawnSync('unzip', ['-oq', TMP_ZIP, '-d', OUT_DIR], { stdio: 'inherit' });
try { fs.unlinkSync(TMP_ZIP); } catch {}
if (un.error || un.status !== 0) throw new Error('unzip failed; exact staged archive was preserved by hash check but could not be extracted');
for (const [name, expected] of Object.entries(FILES)) {
  const p = path.join(OUT_DIR, name);
  if (!fs.existsSync(p)) throw new Error(`Missing extracted Hunter SFX: ${name}`);
  const got = sha256(fs.readFileSync(p));
  if (got !== expected) throw new Error(`Hunter SFX SHA mismatch ${name}: ${got}`);
}
console.log(`Hunter SFX materialized: ${Object.keys(FILES).length} files -> ${path.relative(ROOT, OUT_DIR)}`);
console.log(`Archive SHA-256: ${ARCHIVE_SHA}`);
