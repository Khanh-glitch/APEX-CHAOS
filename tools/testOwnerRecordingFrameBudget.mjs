// Source-level regression for the owner recording pipeline.
// A hardware GPU + actual tab audio test remains required for performance acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const capture=fs.readFileSync('src/game/ownerPlaytestCapture.js','utf8');
const studio=fs.readFileSync('public/portrait-studio.html','utf8');
assert.match(capture,/const W = 1080, H = 1920/,'output remains 1080x1920');
assert.match(capture,/canvas\.captureStream\(30\)/,'30fps recording target unchanged');
assert.match(capture,/videoBitsPerSecond:22000000/,'video bitrate unchanged');
assert.match(capture,/audioBitsPerSecond:256000/,'tab audio bitrate unchanged');
assert.match(capture,/video\.requestVideoFrameCallback\(paint\)/,'render only on new video frame when supported');
assert.match(capture,/video\.cancelVideoFrameCallback\(item\.frame\)/,'stop recording cancels the video callback');
assert.match(capture,/requestAnimationFrame\(paint\)/,'fallback retained for older browsers');
assert.match(capture,/ctx\.drawImage\(video,crop\.sx,crop\.sy,crop\.sw,crop\.sh,0,0,W,H\)/,'same exact 9:16 crop');
assert.doesNotMatch(capture,/ctx\.fillRect\(0,0,W,H\)/,'no redundant full-frame clear during capture');
assert.match(capture,/const tabAudio=display\.getAudioTracks\(\)/,'only selected-tab audio gets captured');
assert.match(capture,/output\.addTrack\(audio\.clone\(\)\)/,'existing asset audio retained');
assert.match(studio,/width:432px;height:768px/,'phone gameplay viewport unchanged');
console.log('PASS owner recording frame budget: source-frame callback/fallback, no redundant clear, 1080x1920/30fps/22Mbps/audio policy preserved');
