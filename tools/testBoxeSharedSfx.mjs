// Source-exact, selected-only SFX integration contract.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {arsenalBattleRuntimesFor} from '../src/game/runtimeManifest.js';
const wave=fs.readFileSync('public/bot-wave/game.html','utf8');
const game=fs.readFileSync('public/game/hero-rework/boxeSfxAuthority.js','utf8');
const view=fs.readFileSync('public/game/hero-rework/boxeGoldPresentationRuntime.js','utf8');
for(const label of ['BOXE_AUDIO_BANK','BOXE_FINAL_AUDIO_BANK']){
 const rx=new RegExp('const '+label+' = [^\\n]+');
 const waveSource=wave.match(rx)?.[0],gameSource=game.match(rx)?.[0];
 assert.ok(waveSource?.length>100000,'Missing Gold sound bank '+label);
 assert.equal(gameSource,waveSource,'BOXE sound samples drifted from BOT WAVE');
}
assert.match(game,/global\.battleAudioMaster \|\| a\.destination/);
assert.match(game,/apexRegisterBattleAudioSource/);
assert.match(view,/sound:false/,'Gold visual engine must not double-play SFX');
assert.match(view,/APEX_BOXE_SFX\?\.handle\(ev\)/);
for(const event of ['rocket-launch','rocket-impact','rocket-catch',
 'counter-guard','counter-contact','flurry-start','flurry-punch','enhanced'])
 assert.ok(game.includes('boxe:'+event),'Missing native BOXE cue '+event);
const paths=ids=>arsenalBattleRuntimesFor(ids).map(e=>e[0].split('?')[0]);
const auth='/game/hero-rework/boxeSfxAuthority.js';
assert.ok(paths(['BOXE','ROBOT']).includes(auth));
assert.ok(!paths(['ROBOT','HUNTER']).includes(auth));
const scope={console,performance:{now:()=>0},addEventListener(){},
 apexBattleAudioSessionInfo:()=>({active:false}),__apexStatsSilent:true};
scope.window=scope;
vm.runInNewContext(game,scope,{filename:'boxeSfxAuthority.js',timeout:3000});
assert.ok(scope.APEX_BOXE_SFX);
assert.equal(scope.APEX_BOXE_SFX.status().samples,0);
assert.equal(scope.APEX_BOXE_SFX.handle({type:'boxe:rocket-launch'}),undefined);
console.log('PASS BOXE V3 + Final source parity, unique native event bridge and audio-session guard');
