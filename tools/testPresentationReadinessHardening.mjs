// CP11 readiness contract (no game/Gold art changes). Simulates browser
// fetch, decode and hero provider completion while running the REAL loader.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {cosmetics} from '../src/game/cosmetics/cosmeticAuthority.js';

let mode='reject',decodeCalls=0,fetchCalls=0;
class FakeImage{
 complete=true;
 naturalWidth=64;
 set src(v){this.url=v;if(v)queueMicrotask(()=>this.onload?.());}
 decode(){decodeCalls++;return mode==='reject'?Promise.reject(Error('deliberately invalid atlas')):Promise.resolve();}
}
const scene={location:{href:'https://example.invalid/game/'},
  APEX_GOLD_ROSTER:{future:{portrait:'/assets/test/cp11-decode.png'}}};
const ctx=vm.createContext({
 window:scene,console,Promise,URL,AbortController,DOMException,
 performance:{now:()=>1000},
 fetch:async()=>{fetchCalls++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}},
 Image:FakeImage,queueMicrotask
});
vm.runInContext(fs.readFileSync('public/game/product/productAssetRuntime.js','utf8'),ctx,
 {filename:'productAssetRuntime.js',timeout:10000});
const assets=scene.apexProductAssets;
assert.ok(assets?.registerPresentation&&assets?.prepare);
let result=await Promise.allSettled([
 assets.prepare('fighter-hero',{heroIds:['future'],scope:'cp11-a'}),
 assets.prepare('fighter-hero',{heroIds:['future'],scope:'cp11-b'})
]);
assert.ok(result.every(x=>x.status==='rejected'&&/image decode failed/.test(String(x.reason))),
 'Concurrent decode rejection must NEVER report READY');
assert.equal(decodeCalls,1,'cached-complete/onload and concurrent callers decode once');
assert.equal(fetchCalls,1,'concurrent callers reuse fetched bytes');
const failed=assets.state().records.find(x=>x.path.includes('cp11-decode.png'));
assert.equal(failed?.state,'ERROR','failed decode must be recorded as ERROR');
mode='resolve';
const recovered=await assets.prepare('fighter-hero',{heroIds:['future'],scope:'cp11-b'});
assert.equal(recovered.ready,true,'decode must recover without reload after a failure');
assert.equal(decodeCalls,2,'retry decodes exactly once');
assert.equal(assets.state().records.find(x=>x.path.includes('cp11-decode.png')).state,'READY');

let providerMode=false,providerCalls=0;
assets.registerPresentation('future',async()=>{providerCalls++;return providerMode});
await assert.rejects(assets.preparePresentations(['future']),/not READY/);
assert.equal(assets.presentationReadiness().future.state,'ERROR',
 'resolved false is NOT a ready presentation');
providerMode=true;
const concurrent=await Promise.all(Array.from({length:8},()=>assets.preparePresentations(['future'])));
assert.ok(concurrent.every(x=>x.ready===true));
assert.equal(providerCalls,2,'eight overlapping calls dedupe a successful retry');
assert.equal(assets.presentationReadiness().future.state,'READY');
assert.equal((await assets.preparePresentations(['future'])).ready,true);
assert.equal(providerCalls,2,'already READY provider must not re-preprocess');

let skinMode=false,skinCalls=0;
cosmetics.register({kind:'hero',baseId:'CP11_PREPROCESS_CANARY',id:'candidate',
 prepare:async()=>{skinCalls++;return skinMode},render:{actor:()=>true}});
cosmetics.equip('p1','hero','CP11_PREPROCESS_CANARY','candidate');
await assert.rejects(cosmetics.ready([{side:'p1',heroId:'CP11_PREPROCESS_CANARY'}]),
 /Skin preprocess not READY/);
skinMode=true;
await cosmetics.ready([{side:'p1',heroId:'CP11_PREPROCESS_CANARY'}]);
assert.equal(skinCalls,2,'skin readiness retry is allowed after returned-false failure');
cosmetics.equip('p1','hero','CP11_PREPROCESS_CANARY','default');

console.log('CP11 READINESS PASS: cached-complete, decode failure, ERROR state, retry, concurrent provider, fail-closed cosmetic prepare');
