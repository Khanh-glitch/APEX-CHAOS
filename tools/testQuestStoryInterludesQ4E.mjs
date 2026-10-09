// Pure Q4E narrative event authority, strict receipt and missing-dialogue tests.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const win={};vm.runInNewContext(readFileSync('public/game/quest/questStoryInterludes.js','utf8'),{window:win});
const Q=win.APEX_QUEST_STORY_BEATS;let count=0;
function ok(s,b){assert.ok(b,s);console.log('PASS Q4E '+s);count++;}
ok('eight authored scene types, zero forged actor dialogue',Q.scenes().length===8
 &&Q.scenes().every(s=>s.dialogue.length===0)
 &&new Set(Q.scenes().map(s=>s.id)).size===8
 &&Q.scene('E01_R1_IMPACT').type==='IN_ENGINE_HOLD');
const g=Q.create(),r1={kind:'PISTOL_HIT',from:'NEWBOT',to:'T.O.T',amount:20},
r2={kind:'PISTOL_HIT',from:'T.O.T',to:'NEWBOT',amount:25},
j={kind:'CAST',slot:'A1',seq:100},k={kind:'CAST',slot:'A2',seq:101};
const snap=(p,r,hpT=464.5)=>({active:true,phase:p,receipts:r,awaitingRivet:p==='AWAIT_RIVET',
 hp:{newbot:496,tot:hpT},storyProgress:false,complete:false});
ok('forged first hit direction rejected',g.observeReflex(snap('R2_PISTOL',[{...r1,from:'T.O.T'}])).accepted===false);
ok('R1 registers exactly one read-only impact hold',g.observeReflex(snap('R2_PISTOL',[r1])).accepted===true&&
 g.observeReflex(snap('R2_PISTOL',[r1])).accepted===true
 &&g.snapshot().emitted.join(',')==='E01_R1_IMPACT');
g.observeReflex(snap('J_CAST',[r1,r2]));
ok('R2 retaliation and exact J system cue',g.snapshot().emitted.join(',')==='E01_R1_IMPACT,E01_R2_IMPACT,E01_J_REVEAL'
 &&Q.scene('E01_J_REVEAL').text[0]==='UNKNOWN ROUTINE — J');
ok('rejected keydown cannot replace actual J Cast',
 g.observeReflex(snap('K_CAST',[r1,r2,{...j,kind:'keydown'}])).accepted===false);
g.observeReflex(snap('K_CAST',[r1,r2,j]));
ok('accepted J cast opens K prompt',g.snapshot().emitted.at(-1)==='E01_K_REVEAL');
g.observeReflex(snap('AWAIT_RIVET',[r1,r2,j,k],550));
ok('both HP real thresholds required before rescue hold',!g.snapshot().emitted.includes('E01_RIVET_HOLD'));
g.observeReflex(snap('AWAIT_RIVET',[r1,r2,j,k]));
ok('valid ordered receipts/HP permit hold only',g.snapshot().emitted.at(-1)==='E01_RIVET_HOLD');
const tech={ready:true,kind:'E01_RIVET_TECHNICAL_PREVIEW',phase:'FLOOR_DISCHARGED',
 checkpointAuthorized:false,storyComplete:false,weapon:'STORMBREAKER',operator:'RIVET'};
g.observeReflex(snap('AWAIT_RIVET',[r1,r2,j,k]),{...tech,checkpointAuthorized:true});
ok('forged permission cannot complete rescue cue',!g.snapshot().emitted.includes('E01_RIVET_SUPPRESSION_TECH'));
g.observeReflex(snap('AWAIT_RIVET',[r1,r2,j,k]),tech);
ok('real Q4D technical proof emits scene without completing Story',
 g.snapshot().emitted.at(-1)==='E01_RIVET_SUPPRESSION_TECH'
 &&!g.snapshot().storyComplete&&!g.snapshot().checkpointAuthorized
 &&!g.snapshot().emitted.includes('WORKSHOP_ARRIVAL'));
const len=g.snapshot().emitted.length;while(g.take()){}
ok('presentation drain never writes Story state',g.snapshot().emitted.length===len
 &&g.snapshot().pending.length===0&&!g.snapshot().checkpointAuthorized);
g.close();
ok('exit clears story cues and ignores stale session',g.take()==null
 &&g.observeReflex(snap('AWAIT_RIVET',[r1,r2,j,k]),tech).accepted===false
 &&g.snapshot().emitted.length===0&&Q.create().snapshot().emitted.length===0);
console.log('Q4E Story beats '+count+'/'+count+' PASS');
