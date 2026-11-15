// Release blocker for portrait recording: every SHIPPED gameplay audio clip
// must be present and byte-identical in the exact extracted itch ZIP. This
// audits existing authoring paths; no alternate beeps or generated substitutes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {AUDIO_WARM_BANKS} from '../src/game/audioWarmBanks.generated.js';
const source=path.resolve('public');
const dist=path.resolve('dist-itch-html5');
const report=JSON.parse(fs.readFileSync('reports/asset-audit.json','utf8'));
const formats=new Set(['.mp3','.ogg','.m4a','.aac','.wav','.flac']);
const included=report.assets.filter(e=>
  ['SHIPPING_HOT','SHIPPING_LAZY'].includes(e.classification)
  &&formats.has(path.extname(e.path).toLowerCase())
);
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.ok(included.length>=60,'audio shipping inventory unexpectedly low');
let bytes=0;
for(const asset of included){
  const rel=String(asset.path).replace(/^\/+/,'');
  const a=path.join(source,rel),b=path.join(dist,rel);
  assert.ok(fs.existsSync(a),'source audio missing: '+rel);
  assert.ok(fs.existsSync(b),'portable itch ZIP omitted audio: '+rel);
  assert.equal(sha(b),sha(a),'audio must be byte-identical; do not reencode: '+rel);
  bytes+=fs.statSync(b).size;
}
const warm=[...new Set(Object.values(AUDIO_WARM_BANKS).flat())];
assert.ok(warm.length>=20,'warm bank unexpectedly empty');
for(const url of warm){
  const rel=url.replace(/^\/+/,'');
  assert.ok(fs.existsSync(path.join(dist,rel)),'warm-bank URL unavailable in itch: '+url);
}
for(const rel of [
 'assets/audio/forward_drive_theme.ogg',
 'assets/audio/ui-sfx/01_UI_CORE/ui_button_press.ogg',
 'assets/audio/ui-sfx/05_HUD_STATE/hud_critical_warning.ogg'
]) assert.ok(fs.existsSync(path.join(dist,rel)),'core SFX/music missing: '+rel);
const receipt={pass:true,shippedAudioFiles:included.length,warmBankUrls:warm.length,
  verifiedBytes:bytes,policy:'shipping-only; identical authored audio; no synthesized replacements'};
fs.mkdirSync('reports/owner-itch-qa',{recursive:true});
fs.writeFileSync('reports/owner-itch-qa/audio-assets-receipt.json',JSON.stringify(receipt,null,2));
console.log('PASS AUDIO ASSET COMPLETENESS',receipt);
