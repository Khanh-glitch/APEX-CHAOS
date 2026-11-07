import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseOwnerRecordingCodec } from '../src/game/ownerPlaytestCapture.js';

const candidates = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/webm'
];
const supports = () => true;
const hints = result => ({encodingInfo: async ({video,type}) => {
  assert.equal(type,'record');
  assert.equal(video.width,1080);
  assert.equal(video.height,1920);
  assert.equal(video.bitrate,22000000);
  assert.equal(video.framerate,30);
  return result(video.contentType);
}});

test('legacy codec priority stays unchanged without reliable power evidence',async () => {
  assert.equal(await chooseOwnerRecordingCodec(candidates,supports,undefined),candidates[0]);
  assert.equal(await chooseOwnerRecordingCodec(candidates,supports,hints(()=>({supported:true,powerEfficient:true}))),candidates[0]);
  assert.equal(await chooseOwnerRecordingCodec(candidates,supports,hints(()=>({supported:true,powerEfficient:false}))),candidates[0]);
});

test('falls back safely when capabilities reject',async () => {
  assert.equal(await chooseOwnerRecordingCodec(candidates,supports,{encodingInfo:async()=>{throw Error('unsupported codec');}}),candidates[0]);
});

test('selects supported efficient encoder only if original is reported inefficient',async () => {
  const chosen=await chooseOwnerRecordingCodec(candidates,supports,hints(mime => ({
    supported:true,powerEfficient:mime.includes('avc1')
  })));
  assert.equal(chosen,candidates[2]);
});

test('never selects a codec MediaRecorder rejects',async () => {
  const chosen=await chooseOwnerRecordingCodec(candidates,type=>!type.includes('mp4'),hints(mime => ({
    supported:true,powerEfficient:mime.includes('avc1')
  })));
  assert.equal(chosen,candidates[0]);
});

test('no codec support fails closed',async () => {
  assert.equal(await chooseOwnerRecordingCodec(candidates,()=>false,hints(()=>({supported:true,powerEfficient:true}))),null);
});
