// Classification ONLY — this script never replaces or weakens the original
// product acceptance gate. A PASS here means that no NEW Battle HUD failure
// appeared. The raw HUD adaptation gate remains FAIL until its real owner
// requirements are restored in source-owned adapters and browser acceptance.
import { spawnSync } from 'node:child_process';

const expected = [
  'R65 artwork-level state and geometric hero motifs replace portrait watermark',
  'R63 solo portrait iPad skill states use existing runtime authority',
  'R62 tablet BOT portrait dock keeps arena and Local untouched',
];
const run = spawnSync(process.execPath, ['tools/testGoldBattleHudAdaptationGate.mjs'],
  { encoding:'utf8', timeout:90_000, maxBuffer: 8 * 1024 * 1024 });
if(run.error)throw run.error;
const log = [run.stdout,run.stderr].filter(Boolean).join('\n');
const current = [...log.matchAll(/^FAIL ([^\r\n]+)/gm)].map(m=>m[1].trim());
console.log('UNMODIFIED HUD ADAPTATION GATE: exit='+run.status);
console.log(JSON.stringify({knownUnresolved:expected,actualFailures:current},null,2));
const unexpected = current.filter(f=>!expected.includes(f));
const resolved = expected.filter(f=>!current.includes(f));
if(unexpected.length){
  console.error('NEW REGRESSION(S), no release or HUD merge allowed:',unexpected);
  process.exitCode=1;
} else if(current.length===0 && run.status===0){
  console.log('Original HUD gate is now fully PASS; remove this temporary inventory.');
} else if(current.length===expected.length && run.status!==0){
  console.log('CLASSIFIED ONLY: Original HUD gate still FAILS 3 acceptance invariants. '+ 
    'R90 must NOT claim these requirements are fixed.');
} else {
  console.error('Unexpected HUD gate result; inspect raw gate, do not silently whitelist.');
  console.error('Exit='+run.status+' resolved='+JSON.stringify(resolved));
  process.exitCode=1;
}
