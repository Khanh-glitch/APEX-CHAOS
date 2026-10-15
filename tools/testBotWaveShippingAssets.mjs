import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {APEX_WAVE_GUNS} from '../src/game/botWave/apexGunLoadouts.js';
import {botWaveShippingAssetRefs} from './botWaveShippingAssetRefs.mjs';
const sound='/assets/arsenal/av/sfx/guns/cz.mp3';
const sample="WAVE_STICKY_ASSIST APEX_GUN_ART waveGunCue '" +sound+"'";
const refs=botWaveShippingAssetRefs(sample);
const ids=Object.keys(APEX_WAVE_GUNS);
assert.deepEqual(refs.filter(p=>p.startsWith('/assets/arsenal/weapons/c/')),
 ids.map(id=>'/assets/arsenal/weapons/c/'+id+'.png').sort());
assert.ok(refs.includes(sound));
assert.equal(refs.length,ids.length+1);
assert.throws(()=>botWaveShippingAssetRefs('window.BASE=1'),/RUNTIME_NOT_INTACT/);
const root='public';
for(const asset of refs)assert.ok(fs.existsSync(path.join(root,asset.slice(1))),'Missing native asset '+asset);
const actual='public/bot-wave/game.html';
if(fs.existsSync(actual)){
 const all=botWaveShippingAssetRefs(fs.readFileSync(actual,'utf8'));
 assert.ok(all.length>=ids.length+10,'all 5 sprites and 10 audio assets must be derived');
 for(const asset of all)assert.ok(fs.existsSync(path.join(root,asset.slice(1))),'Missing runtime asset '+asset);
 console.log('BOT WAVE R5 Gold imported: '+all.length+' real shipping audio/sprite dependencies recognized');
}else console.log('BOT WAVE R5 Gold pending binary import; native asset dependency index passed preflight');
