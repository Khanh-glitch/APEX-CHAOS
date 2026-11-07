import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseOwnerRecordingCodec, createOwnerRecordingCanvasStream, tryOwnerRegionCapture } from '../src/game/ownerPlaytestCapture.js';

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

test('AVC is chosen instead of software-heavy VP9 when MediaRecorder accepts it',async () => {
  assert.equal(await chooseOwnerRecordingCodec(candidates,supports,undefined),candidates[2]);
  assert.equal(await chooseOwnerRecordingCodec(candidates,supports,hints(()=>({supported:true,powerEfficient:false}))),candidates[2]);
  assert.equal(await chooseOwnerRecordingCodec(candidates,supports,hints(()=>({supported:true,powerEfficient:true}))),candidates[2]);
});

test('explicit AVC unsupported signal keeps proven VP9 fallback',async () => {
  const selected=await chooseOwnerRecordingCodec(candidates,supports,hints(mime=>({
    supported:!mime.includes('avc1'),powerEfficient:false
  })));
  assert.equal(selected,candidates[0]);
});

test('MediaCapabilities exceptions cannot disable a supported encoder',async () => {
  assert.equal(await chooseOwnerRecordingCodec(candidates,supports,{
    encodingInfo:async()=>{throw Error('unimplemented')}
  }),candidates[2]);
});

test('AVC not supported by MediaRecorder retains old codec order',async () => {
  assert.equal(await chooseOwnerRecordingCodec(candidates,type=>!type.includes('mp4'),undefined),candidates[0]);
});

test('no supported codec fails closed',async () => {
  assert.equal(await chooseOwnerRecordingCodec(candidates,()=>false,undefined),null);
});

test('manual frame source requests one encode per new drawn frame',()=>{
  let calls=0,manualSettings=[];
  const manual={requestFrame:()=>{calls++}};
  const canvas={captureStream:fps=>{
    manualSettings.push(fps);
    return {getVideoTracks:()=>[manual],getTracks:()=>[manual]};
  }};
  const source=createOwnerRecordingCanvasStream(canvas);
  assert.equal(source.mode,'source-frame-driven');
  assert.deepEqual(manualSettings,[0]);
  source.frame();source.frame();
  assert.equal(calls,2);
});

test('manual unsupported fallback keeps fixed 30Hz stream',()=>{
  let stops=0;
  const canvas={captureStream:fps=>({
    getVideoTracks:()=>[{}],
    getTracks:()=>[{stop:()=>{stops++}}],
    fps
  })};
  const source=createOwnerRecordingCanvasStream(canvas);
  assert.equal(source.mode,'fixed-fps-fallback');
  assert.equal(source.stream.fps,30);
  assert.equal(stops,1);
  source.frame();
});

test('region capture requests exact iframe, does not resize or rewrite art',async()=>{
  const iframe={id:'apex-portrait-stage'};
  const target={crop:'phone-iframe'};
  let actual=null,created=null;
  const track={getSettings:()=>({displaySurface:'browser'}),cropTo:async t=>{actual=t}};
  const api={fromElement:async el=>{created=el;return target}};
  assert.equal(await tryOwnerRegionCapture(track,iframe,api),true);
  assert.equal(created,iframe);
  assert.equal(actual,target);
});

test('unsupported or non-tab capture falls back without cropping',async()=>{
  let called=0;
  const api={fromElement:async()=>{called++;return {}}};
  assert.equal(await tryOwnerRegionCapture({getSettings:()=>({displaySurface:'monitor'}),cropTo:async()=>{}},{},api),false);
  assert.equal(await tryOwnerRegionCapture({getSettings:()=>({displaySurface:'browser'})},{},api),false);
  assert.equal(called,0);
});

test('region API rejection propagates so caller safely uses the manual path',async()=>{
  await assert.rejects(()=>tryOwnerRegionCapture({
    getSettings:()=>({displaySurface:'browser'}),
    cropTo:async()=>{throw Error('crop unavailable')}
  },{}, {fromElement:async()=>({})}),/crop unavailable/);
});

