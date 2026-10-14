// CP15 — execute the REAL runtime loader against an in-memory browser,
// exercising script load vs evaluate, mandatory READY, and priority/warmup.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const filename='src/game/runtimeLoader.js';
let loader=fs.readFileSync(filename,'utf8');
loader=loader.replace(/^import\s+\{[\s\S]*?\}\s+from\s+'[^']+';\s*/gm,'');
loader=loader.replace(/^export\s+(?=(?:async\s+)?function\s)/gm,'');
assert.ok(!/^import\s/m.test(loader)&&!/^export\s/m.test(loader),
 'Runtime loader fixture transpile must not alter function implementations');
const bootstrap=[
 "const ARSENAL_HUB_RUNTIMES=[];",
 "const MENU_INTERACTIVE_RUNTIMES=[];",
 "const PRODUCT_MUSIC_BOOT_RUNTIMES=[];",
 "const SELECT_RUNTIMES=[];",
 "const WARMUP_GROUP_SEQUENCE=[];",
 "const MODE_DEFERRED_RUNTIMES={arsenalProduct:window.__warmupTuples};",
 "const arsenalBattleRuntimesFor=()=>window.__battleTuples;",
 "const beginPerfSpan=()=>()=>{};",
 "const markBootPhase=()=>{};",
 "const AUDIO_WARM_BANKS={};",
 "const hintRuntimeSources=()=>{};",
 "const preloadRuntimeSources=()=>{};"
].join('\n');

function browser({rules={},warmup=[],battle=[]}={}){
 const history=[],nodes=[],winListeners=new Map();
 const baseURI='https://unit.apex.invalid/';
 const ruleFor=src=>rules[new URL(src,baseURI).pathname]||{};
 const win={__warmupTuples:warmup,__battleTuples:battle,
  addEventListener(type,fn){if(!winListeners.has(type))winListeners.set(type,new Set());winListeners.get(type).add(fn);},
  removeEventListener(type,fn){winListeners.get(type)?.delete(fn);}
 };
 const fireWindow=(type,payload)=>{for(const fn of [...(winListeners.get(type)||[])])fn(payload);};
 const doc={
  baseURI,
  querySelectorAll(){return nodes;},
  createElement(){
   const listeners=new Map(),node={
    src:'',dataset:{},async:true,
    getAttribute(name){return name==='src'?this.src:null;},
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
    removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
    emit(type){for(const fn of [...(listeners.get(type)||[])])fn({type,target:node});}
   };
   return node;
  },
  body:{appendChild(node){
   nodes.push(node);
   history.push(node.src);
   queueMicrotask(()=>{
    const rule=ruleFor(node.src);
    if(rule.networkFail){node.emit('error');return;}
    if(rule.unrelatedError)
      fireWindow('error',{filename:new URL('/unrelated.js',baseURI).href,message:'unrelated'});
    if(rule.evalError)
      fireWindow('error',{filename:new URL(node.src,baseURI).href,message:'synthetic evaluation failure'});
    if(rule.readyMarker)win[rule.readyMarker]='ready';
    node.emit('load'); // browser does this EVEN IF script evaluation threw
   });
   return node;
  }}
 };
 const context=vm.createContext({
  window:win,document:doc,URL,Promise,Map,Set,console,
  queueMicrotask,setTimeout,clearTimeout,performance:{now:()=>0}
 });
 vm.runInContext(bootstrap+'\n'+loader+
  '\nglobalThis.__cp15Loader={loadClassicRuntime,loadBattleGameRuntimes,loadDeferredGameRuntimes};',
  context,{filename,timeout:10000});
 return {api:context.__cp15Loader,win,history,nodes,winListeners};
}

const good=browser({rules:{'/arsenalConfig.js':{readyMarker:'apexArsenalConfig'}}});
const passA=good.api.loadClassicRuntime('/arsenalConfig.js','apexArsenalConfig');
const passB=good.api.loadClassicRuntime('/arsenalConfig.js','apexArsenalConfig');
assert.strictEqual(passA,passB,'concurrent same-URL callers must share a promise');
await Promise.all([passA,passB]);
assert.equal(good.history.length,1,'same URL cannot be inserted/evaluated twice');
assert.equal(good.nodes[0].dataset.apexLoaded,'true');
assert.equal(good.winListeners.get('error')?.size,0,'error observers leaked on successful script');
await good.api.loadClassicRuntime('/arsenalConfig.js','apexArsenalConfig');
assert.equal(good.history.length,1,'READY cache must not reinsert');

const missing=browser();
await assert.rejects(missing.api.loadClassicRuntime('/arsenalConfig.js','apexArsenalConfig'),
 /missing apexArsenalConfig=ready/);
assert.equal(missing.nodes[0].dataset.apexLoaded,undefined,'onload without READY cannot mark loaded');
assert.equal(missing.nodes[0].dataset.apexFailed,'true');
await assert.rejects(missing.api.loadClassicRuntime('/arsenalConfig.js','apexArsenalConfig'),
 /reload the page/);

const evaluated=browser({rules:{'/arsenalConfig.js':{
 readyMarker:'apexArsenalConfig',evalError:true
}}});
await assert.rejects(evaluated.api.loadClassicRuntime('/arsenalConfig.js','apexArsenalConfig'),
 /synthetic evaluation failure/);
assert.equal(evaluated.nodes[0].dataset.apexFailed,'true',
 'evaluation errors cannot hide behind successful fetch+ready');

const unrelated=browser({rules:{'/arsenalConfig.js':{
 readyMarker:'apexArsenalConfig',unrelatedError:true
}}});
await unrelated.api.loadClassicRuntime('/arsenalConfig.js','apexArsenalConfig');
assert.equal(unrelated.nodes[0].dataset.apexLoaded,'true',
 'an unrelated runtime error cannot poison this source');

const network=browser({rules:{'/arsenalConfig.js':{networkFail:true}}});
await assert.rejects(network.api.loadClassicRuntime('/arsenalConfig.js','apexArsenalConfig'),
 /network\/load error/);

const brokenQueue=browser({
 battle:[['/arsenalConfig.js','apexArsenalConfig'],['/ail.js','apexHeroReworkAil']],
 rules:{'/arsenalConfig.js':{evalError:true},'/ail.js':{readyMarker:'apexHeroReworkAil'}}
});
await assert.rejects(brokenQueue.api.loadBattleGameRuntimes(['frost']),
 /evaluation failure/);
assert.deepEqual(brokenQueue.history,['/arsenalConfig.js'],
 'a failed critical dependency must cancel every queued dependent script');
assert.equal(brokenQueue.win.__apexBattleRuntimeState?.ready,false,
 'Battle must not advertise READY after failure');
await assert.rejects(brokenQueue.api.loadBattleGameRuntimes(['frost']),
 /evaluation failure/);
assert.equal(brokenQueue.history.length,1,'broken document cannot retry partial globals');

const concurrent=browser({
 warmup:[['/arsenalConfig.js','apexArsenalConfig'],['/ail.js','apexHeroReworkAil']],
 battle:[['/arsenalConfig.js','apexArsenalConfig'],['/ail.js','apexHeroReworkAil'],
         ['/mechanics.js','apexHeroReworkMechanics']],
 rules:{
  '/arsenalConfig.js':{readyMarker:'apexArsenalConfig'},
  '/ail.js':{readyMarker:'apexHeroReworkAil'},
  '/mechanics.js':{readyMarker:'apexHeroReworkMechanics'}
 }
});
const bg=concurrent.api.loadDeferredGameRuntimes('arsenalProduct',{priority:false});
const active=concurrent.api.loadBattleGameRuntimes(['frost']);
await Promise.all([bg,active]);
assert.deepEqual(concurrent.history,
 ['/arsenalConfig.js','/ail.js','/mechanics.js'],
 'warmup/battle must evaluate each runtime once in dependency order');
assert.equal(concurrent.win.__apexBattleRuntimeState?.ready,true);
console.log('CP15 CLASSIC RUNTIME ADMISSION PASS: marker, onload+throw, wrong-source error, dedupe, fail-closed dependency queue, concurrent warmup/battle');
