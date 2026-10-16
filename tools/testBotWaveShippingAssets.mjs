import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {botWaveShippingAssetRefs,nativeWaveWeaponAssetRefs} from './botWaveShippingAssetRefs.mjs';
const native=nativeWaveWeaponAssetRefs();
assert.equal(native.length,41,'Every native equipment identity needs a delivered sprite');
assert.equal(new Set(native).size,41);
const sound='/assets/arsenal/av/sfx/guns/cz.mp3';
const sample="WAVE_STICKY_ASSIST APEX_GUN_ART waveGunCue '"+sound+"'";
const refs=botWaveShippingAssetRefs(sample);
assert.deepEqual(refs.filter(p=>p.includes('/assets/arsenal/')&&!p.includes('/av/')),native);
assert.ok(refs.includes(sound));
assert.equal(refs.length,42);
assert.throws(()=>botWaveShippingAssetRefs('window.BASE=1'),/RUNTIME_NOT_INTACT/);
const root='public';
for(const asset of refs)assert.ok(fs.existsSync(path.join(root,asset.slice(1))),'Missing native asset '+asset);
const actual='public/bot-wave/game.html';
if(fs.existsSync(actual)){
 const all=botWaveShippingAssetRefs(fs.readFileSync(actual,'utf8'));
 assert.ok(all.length>=51,'all 41 sprite dependencies and 10 audio refs required');
 for(const asset of all)assert.ok(fs.existsSync(path.join(root,asset.slice(1))),'Missing runtime asset '+asset);
 console.log('BOT WAVE native armory shipping PASS: '+all.length+' 41-weapon art/SFX dependencies');
}
