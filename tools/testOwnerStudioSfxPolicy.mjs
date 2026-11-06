// Static + executable sound gate: portrait mode suppresses ONLY legacy
// synthesized pitched tones. The default game still owns its original sound,
// including all asset-backed curated, UI, weapon and music cue libraries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sfx=fs.readFileSync('public/game/core/apexBattleSfxRuntime.js','utf8');
const authority=fs.readFileSync('public/game/heroes/coreSixCuratedSfxAuthority.js','utf8');
const ui=fs.readFileSync('public/game/ui/uiSfxAuthority.js','utf8');
const music=fs.readFileSync('public/game/product/productMusicAuthority.js','utf8');
const boxe=fs.readFileSync('public/game/hero-rework/boxeSfxAuthority.js','utf8');
const boxeGold=fs.readFileSync('public/game/hero-rework/boxeGoldLibrary.js','utf8');
const shuri=fs.readFileSync('public/game/hero-rework/shuriGoldLibrary.js','utf8');
assert.match(sfx,/window\.APEX_OWNER_TOOLS\?\.isPortraitStudio\?\.\(\)/);
assert.match(authority,/new AudioCtor\(ROOT \+ spec\.file\)/,'curated hero clip playback preserved');
assert.match(ui,/new AudioCtor\(url\)/,'authored UI SFX playback preserved');
assert.match(music,/forward_drive_theme\.ogg/,'authored soundtrack preserved');
for(const [name,source,expected] of [
 ['BOXE SFX',boxe,2],['BOXE Gold',boxeGold,1],['SHURI Gold',shuri,1]
]) {
 const count=(source.match(/APEX_OWNER_TOOLS\?\.isPortraitStudio\?\.\(\)/g)||[]).length;
 assert.ok(count>=expected,name+' must suppress all known procedural tone/noise paths in studio');
}

let oscillators=0, noises=0;
const param={setValueAtTime(){},exponentialRampToValueAtTime(){}};
const ctx={
 currentTime:0,sampleRate:44100,state:'running',
 createBuffer(_channels,n){return {getChannelData:()=>new Float32Array(n)};},
 createBufferSource(){noises++;return {connect(){},start(){},stop(){}};},
 createBiquadFilter(){return {type:'bandpass',frequency:param,Q:param,connect(){}};},
 createOscillator(){
   oscillators++;
   return {frequency:param,connect(){},start(){},stop(){},type:'sine'};
 },
 createGain(){return {gain:param,connect(){}};}
};
const window={__apexStatsSilent:false,APEX_OWNER_TOOLS:{isPortraitStudio:()=>false}};
const environment={window,audioCtx:ctx,battleAudioMaster:{connect(){}}};
vm.createContext(environment);
vm.runInContext(sfx,environment);
const invoke=()=>vm.runInContext("playTone(440,600,.1,'sine',.04);playNoise(.1,.02)",environment);
invoke();
assert.equal(oscillators,1,'ordinary battle audio must retain its original tone');
assert.equal(noises,1,'ordinary battle audio must retain its original synth noise');
window.APEX_OWNER_TOOLS.isPortraitStudio=()=>true;
invoke();
assert.equal(oscillators,1,'portrait studio mutes synthetic beep without disabling game audio assets');
assert.equal(noises,1,'portrait studio must also mute synth noise');
window.APEX_OWNER_TOOLS.isPortraitStudio=()=>false;
invoke();
assert.equal(oscillators,2,'normal game remains unmodified by studio capture mode');
assert.equal(noises,2,'normal game synth noise is unaffected outside studio');
console.log('PASS authored sound policy: ordinary sound unchanged; all known portrait synth paths excluded; curated asset libraries intact');
