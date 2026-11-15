// Safety gate after RC1 worsened recording stutter on owner hardware.
// Keep the original r5 video recorder EXACTLY unchanged until measured profiling
// justifies an isolated, GPU-validated change. This is source parity, NOT fps proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const source='src/game/ownerPlaytestCapture.js';
const sha=execFileSync('git',['hash-object',source],{encoding:'utf8'}).trim();
assert.equal(sha,'3ad72b2ae977d0e6017b1fd129f22431968f7208',
  'recording code must be byte-identical to release r5 (RC1 frame-loop change rejected)');
const capture=fs.readFileSync(source,'utf8');
const studio=fs.readFileSync('public/portrait-studio.html','utf8');
assert.match(capture,/const W = 1080, H = 1920/,'output remains 1080x1920');
assert.match(capture,/canvas\.captureStream\(30\)/,'30fps recording target unchanged');
assert.match(capture,/videoBitsPerSecond:22000000/,'video bitrate unchanged');
assert.match(capture,/audioBitsPerSecond:256000/,'tab audio bitrate unchanged');
assert.match(capture,/requestAnimationFrame\(paint\)/,'original r5 RAF retained');
assert.match(capture,/ctx\.fillRect\(0,0,W,H\)/,'original r5 opaque clearing preserved');
assert.match(capture,/ctx\.drawImage\(video,crop\.sx,crop\.sy,crop\.sw,crop\.sh,0,0,W,H\)/,'original exact 9:16 crop retained');
assert.match(capture,/const tabAudio=display\.getAudioTracks\(\)/,'original tab audio captured');
assert.match(capture,/output\.addTrack\(audio\.clone\(\)\)/,'original tab audio pass-through retained');
assert.match(studio,/width:432px;height:768px/,'true phone gameplay viewport retained');
console.log('PASS RC2 recorder matches r5 byte-for-byte; 1080x1920/30fps/22Mbps/audio intact (no GPU performance claim)');
