// D5 owner-law cutover: real Crystala suite against baseline and candidate.
// Preserves ALL old failures visibly. Fails CI if candidate adds even one
// new Crystala failure. Owner-authorized V05 reflects the new unified A1 law.
// Always restores the candidate runtime file on this ephemeral CI checkout.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
const baseline='2590beee79b9447fa3639870b6de6801428b7f42';
const source='public/game/hero-rework/crystalGameplayRuntime.js';
const candidate=fs.readFileSync(source);
const legacy=execFileSync('git',['show',baseline+':'+source]);
const parse=(s)=>[...s.matchAll(/^FAIL\s{2}([^\s]+)/gm)].map(x=>x[1]).sort();
function run(which,body){
  fs.writeFileSync(source,body);
  const test=spawnSync(process.execPath,['tools/testCrystalaGameplayGates.mjs'],{
    encoding:'utf8',maxBuffer:4*1024*1024,timeout:160000
  });
  const output=(test.stdout||'')+'\n'+(test.stderr||'');
  if(test.error)throw test.error;
  const failures=parse(output);
  const summary=output.match(/\[CRYSTALA GAMEPLAY GATES\]\s+(\d+\/\d+)/)?.[1]||'NO-SUMMARY';
  console.log(which+' full Crystala source: '+summary+'; exit='+test.status);
  console.log(which+' FAILURES:',failures.join(', ')||'(none)');
  assert.notEqual(summary,'NO-SUMMARY',which+' harness did not finish');
  return failures;
}
let prev,next;
try{prev=run('BASELINE/main',legacy);next=run('CANDIDATE/D5',candidate);}
finally{fs.writeFileSync(source,candidate);}
const newlyFailing=next.filter(name=>!prev.includes(name));
assert.deepEqual(newlyFailing,[],'new failures beyond existing main baseline');
assert.ok(prev.some(x=>x.startsWith('V05-')),'baseline expected old HEXA reflects lethal strike');
assert.ok(!next.some(x=>x.startsWith('V05-')),'owner-updated V05 must pass on candidate');
assert.ok(!next.some(x=>x.startsWith('R07-')),'candidate runtime revision gate must pass');
console.log('D5 Crystala baseline-diff PASS: no NEW regressions; inherited failures remain documented:',next.join(', ')||'(none)');
