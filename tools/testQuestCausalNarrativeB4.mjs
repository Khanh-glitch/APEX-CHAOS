import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const text=fs.readFileSync(new URL('../public/game/quest/quest01Director.js',import.meta.url),'utf8');
const vmModule={exports:{}},sandbox={window:{},module:vmModule,Date,Math,Number,Object,Array,Set,JSON};
vm.runInNewContext(text,sandbox);
const {NODES,STORY_CONTEXT}=vmModule.exports;
let checks=0;const gate=(name,truth)=>{assert.ok(truth,name);console.log('PASS B4b '+name);checks++};
const playable=['WAKE','REFLEX','WORKSHOP','FIRST_WAKE','SCRAP_SWARM','WEAPON_RAIN','CHARGE_THE_BREAKER'];
gate('Every implemented opening stage has a WHY THIS CHAPTER context',
 playable.every(id=>STORY_CONTEXT[id]?.length>=55));
gate('Locked final bosses and OUTSIDE do not leak provisional narrative',
 !STORY_CONTEXT.BREACH_WAVES&&!STORY_CONTEXT.RIVET_OVERRIDDEN
 &&!STORY_CONTEXT.TOT_LAST_CHOICE&&!STORY_CONTEXT.OUTSIDE);
gate('Neither the visible stage sequence nor signed encounter order changed',
 NODES.map(x=>x.id).join('|')===
 ['WAKE','REFLEX','WORKSHOP','FIRST_WAKE','SCRAP_SWARM','WEAPON_RAIN',
 'CHARGE_THE_BREAKER','BREACH_WAVES','RIVET_OVERRIDDEN','TOT_LAST_CHOICE','OUTSIDE'].join('|'));
gate('Cause/source text never adds a fictitious dialogue quotation',
 Object.values(STORY_CONTEXT).every(s=>!s.includes('“')&&!s.includes('”')&&!s.includes('Tôi:')));
gate('Causal presentation uses textContent (not HTML injection)',
 text.includes("el.querySelector('#q1Context').textContent=chapterContext"));
const screen=fs.readFileSync(new URL('../public/game/quest/questStoryPresentation.js',import.meta.url),'utf8');
gate('E02 result foreshadows new contacts without changing native cue ID',
 screen.includes("E02_FIRST_WAKE_CLEAR:{")&&screen.includes('MORE CONTACTS AHEAD'));
gate('E03 two-wave result leads toward the next weapon objective',
 screen.includes("E03_SCRAP_SWARM_CLEAR:{")&&screen.includes('THE WEAPON CYCLE CHANGES'));
gate('E04 result leads to the actual inert charge objective',
 screen.includes("E04_WEAPON_RAIN_CLEAR:{")&&screen.includes('IMPACT ACCUMULATOR · THE NEXT OBJECTIVE'));
gate('E05 result describes a real pulse, not a made-up victory',
 screen.includes("E05_BREAKER_CHARGE_CLEAR:{")&&screen.includes('INFRASTRUCTURE PULSE SENT'));
console.log('B4b causal chapter signposts '+checks+' PASS / 0 FAIL');
