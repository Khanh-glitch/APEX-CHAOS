import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const window={};
vm.runInNewContext(fs.readFileSync(new URL('../public/game/quest/questRivetThresholdAuthority.js',import.meta.url),'utf8'),
 {window,Number,Math,Object,Set,Array});
const Q=window.APEX_QUEST_RIVET_THRESHOLDS;
let total=0;const gate=(n,v)=>{assert.ok(v,n);total++;console.log('PASS B7a '+n);};
const rivet=()=>({questId:'RIVET',questTeam:'HOSTILE',hp:1000,maxHp:1000,
 takeDamage(n){this.hp=Math.max(0,this.hp-n);}});
const hero={questId:'NEWBOT',questTeam:'ALLY',hp:1000,maxHp:1000,takeDamage(){}};
const seen=[],g=Q.create({onCue:e=>seen.push(e)});
gate('noncombatant or wrong fighter not armed',!g.preflight(hero).ok&&!g.snapshot().started);
const f=rivet();gate('original physical RIVET full-health preflight',g.preflight(f).ok);
const apply=n=>{const p=g.beforeAccepted(f,n);assert.ok(p.ok,p.reason);const before=f.hp;f.takeDamage(p.allowed);const a=g.afterAccepted(f,before-f.hp);assert.ok(a.ok,a.reason);return a};
const a=apply(600);
gate('single real heavy damage crosses 750 then 450 in order',
 f.hp===400&&a.events.map(x=>x.threshold).join('|')==='750|450');
const b=apply(25);
gate('no duplicate one-shot crossing on unrelated accepted hit',
 f.hp===375&&b.events.length===0&&seen.length===2);
const c=apply(500);
gate('accepted hit cannot kill RIVET, settles at exact 180',
 f.hp===180&&c.stopped&&c.events.map(x=>x.threshold).join('|')==='180');
gate('three unique events signed in correct causal order',
 seen.map(x=>x.beat).join('|')==='E07_RIVET_COMMAND_750|E07_RIVET_COMMAND_450|E07_RIVET_NONLETHAL_STOP');
const d=g.beforeAccepted(f,99999);
gate('post-180 attack accepts zero and opens no pending damage transaction',
 d.ok&&d.allowed===0&&d.reason==='settled-nonlethal-stop'
 &&g.snapshot().pending===false&&g.clearZero()===false&&f.hp===180);
const repeatedStop=g.beforeAccepted(f,500);
gate('post-180 repeated hits cannot grant a second boss cue or KO',
 repeatedStop.ok&&repeatedStop.allowed===0
 &&g.snapshot().cues.length===3&&seen.length===3&&f.hp===180);
gate('one-time snapshot preserved, no E07 premature KO',
 g.snapshot().cues.length===3&&g.snapshot().stopped===true&&g.snapshot().observed===180);
g.close();
gate('closing prevents stray late damage/cue transactions',g.beforeAccepted(f,100).ok===false);
const hyper=Q.create(),i=rivet();hyper.preflight(i);
let o=hyper.beforeAccepted(i,1000);i.takeDamage(o.allowed);
let v=hyper.afterAccepted(i,820);
gate('single 1000HP→180HP transaction fires ALL THREE cues',
 o.allowed===820&&v.ok&&v.events.map(x=>x.threshold).join('|')==='750|450|180');
const invalid=Q.create(),g2=rivet();g2.hp=750;
gate('cannot start E07 from contaminated 750HP boss',invalid.preflight(g2).ok===false);
console.log('B7a actual damage threshold policy '+total+' PASS / 0 FAIL');
