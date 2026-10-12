// Transport-only rebinding proof for authored Quest B05 shell overlay.
// The two revision tokens may change; authored DOM/Quest patch must not.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bindB05ShellRevision as bind} from './lib/goldB05PatchRevision.mjs';
const raw=fs.readFileSync('tools/goldB05Overlays/shell.html.patch','utf8');
const paths=['ui/uiSfxAuthority.js','gold/goldProductBridge.js'];
const sample=(rev)=>paths.map(p=>'<script src="/game/'+p+'?v='+rev+'"></script>').join('\n');
let passed=0;
const check=(name,fn)=>{try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}};
check('same-revision in-place is byte-identical',()=>{
 const rev='20261013-crystala-a1-sharedbreak-r1',matched=bind(raw,sample(rev));
 assert.equal(matched,raw);
});
check('future revision changes ONLY two URL tokens in patch context',()=>{
 const rev='20300101-future-content-r777';
 const out=bind(raw,sample(rev));
 assert.equal((out.match(new RegExp(rev,'g'))||[]).length,2);
 // Reversible only by restoring the original 2 URLs; no DOM/hunk changed.
 const orig=raw.match(/\/game\/ui\/uiSfxAuthority\.js\?v=([^"\s]+)/)?.[1];
 assert.ok(orig);
 assert.equal(out.replaceAll(rev,orig),raw);
});
check('missing script in generated shell denied',()=>assert.throws(()=>bind(raw,sample('x').replace('goldProductBridge.js','nope.js'))));
check('two inconsistent runtime revisions denied',()=>assert.throws(()=>bind(raw,sample('v1').replace('goldProductBridge.js?v=v1','goldProductBridge.js?v=v2'))));
check('duplicate generated URL denied',()=>assert.throws(()=>bind(raw,sample('v1')+'\n'+sample('v1'))));
check('missing authored script context denied',()=>assert.throws(()=>bind(raw.replace('goldProductBridge.js','notProductBridge.js'),sample('v1'))));
check('unrelated authored patch DOM is preserved',()=>{
 const x=bind(raw,sample('fresh-123'));
 for(const token of ['quest01Director.js','FIRST WAKE','ui.button.press']){
  assert.equal(raw.includes(token),x.includes(token),'unexpected altered '+token);
 }
});
console.log('B05 REVISION PATCH CONTRACT '+passed+'/'+passed+' PASS');
