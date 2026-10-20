// Genuine shipping arsenalConfig.js owner keyboard handler VM integration test.
// No fake UI launcher or monkey-patched weapon resolver.
//
// A1.4 contract: Ctrl+Shift+F8 is an interface, NOT authorization. The flow
// below proves (1) a user without the Admin authority is DENIED — the real
// production denial also proven in Chrome by testSkillDetailsBrowser — and
// (2) with an authorized Admin authority present (the seam implemented by
// src/game/adminAuthority.js in production) the original catalogue/spawn
// mechanics behave exactly as before.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const events=new Map(),calls=[];
const listeners=(type)=>events.get(type)||[];
const window={
  addEventListener(type,fn){events.set(type,[...listeners(type),fn]);},
  APEX_ARSENAL_META:{openBotPick(){calls.push('openBotPick');return true;}}
};
const stubNode=()=>({
  style:{}, children:[], setAttribute(){},remove(){},
  appendChild(x){this.children.push(x);},replaceChildren(...x){this.children=x;},
  getAttribute(){return null;},textContent:''
});
const element=stubNode();
const document={body:{appendChild(){}},getElementById(){return element;},
  createElement(){return stubNode();}};
const ctx=vm.createContext({window,document,console,setTimeout:()=>1,clearTimeout:()=>{}});
vm.runInContext(fs.readFileSync('public/game/arsenal/arsenalConfig.js','utf8'),ctx);
const owner=window.APEX_ARSENAL_OWNER_TEST, AQ=window.APEX_ARSENAL;
assert.equal(owner.active,false,'must default OFF');
assert.equal(owner.catalog.length,41);
assert.equal(owner.idForNumber(40),'SWIRL_SHIELD');
assert.equal(owner.idForNumber(41),'TOWER_SHIELD');
assert.equal(owner.idForNumber(25),'FLARE_GUN');
assert.equal(owner.idForNumber(26),'TACTICAL_CROSSBOW');
assert.equal(owner.idForNumber(27),'STEEL_BALL_LAUNCHER');
assert.equal(owner.idForNumber(28),'COMBAT_BOOMERANG');
assert.equal(owner.idForNumber(29),'RPG_7');
assert.equal(owner.idForNumber(30),'FLAMETHROWER');
assert.equal(owner.idForNumber(31),'PLASMA_SPLITTER');
assert.equal(owner.idForNumber(32),'SHRAPNEL_MINE_LAUNCHER');
const event=(code,flags={})=>({code,repeat:false,target:null,
  preventDefault(){},stopPropagation(){},...flags});
const fire=(type,e)=>listeners(type).forEach(fn=>fn(e));
// (1) No Admin authority: the shortcut must grant nothing.
fire('keydown',event('F8',{ctrlKey:true,shiftKey:true}));
assert.equal(owner.active,false,'A1: F8 without admin authorization must stay OFF');
assert.deepEqual(calls,[],'A1: denial must not open the bot pick');
// (2) Authorized Admin authority at the one seam: full original behaviour.
let session=false;
window.APEX_ADMIN_AUTHORITY={
  canEnterAdminTestMode:()=>true,
  isAdminTestSessionActive:()=>session,
  setAdminTestSession:(on)=>{session=on===true;return session===on;},
};
fire('keydown',event('F8',{ctrlKey:true,shiftKey:true}));
assert.equal(owner.active,true);assert.deepEqual(calls,['openBotPick']);
assert.equal(session,true,'authority session mirrors owner-test activation');
AQ.state={active:true,battleMode:'BOT',labMode:false,spawnTimer:4.5};
fire('keydown',event('ShiftLeft',{shiftKey:true}));
fire('keydown',event('Digit3',{shiftKey:true}));
fire('keydown',event('Digit1',{shiftKey:true}));
assert.equal(owner.selectedWeaponId,null,'selection must be committed ONLY on Shift release');
fire('keyup',event('ShiftLeft'));
assert.equal(owner.selectedWeaponId,'PLASMA_SPLITTER');
assert.ok(AQ.state.spawnTimer<=.45,'native next spawn should be expedited');
AQ.state.spawnTimer=4.5;
AQ.state.battleMode='LOCAL';
fire('keydown',event('ShiftLeft',{shiftKey:true}));
fire('keydown',event('Digit2',{shiftKey:true}));
fire('keydown',event('Digit9',{shiftKey:true}));
fire('keyup',event('ShiftLeft'));
assert.equal(owner.selectedWeaponId,'PLASMA_SPLITTER','must not override normal local battle');
assert.equal(AQ.state.spawnTimer,4.5);
AQ.state.active=false;
fire('keydown',event('F8',{ctrlKey:true,shiftKey:true}));
assert.equal(owner.active,false,'shortcut toggles OFF');
assert.equal(owner.selectedWeaponId,null,'stale forced weapon cleared');
assert.equal(session,false,'authority session closes with owner-test');
console.log('PASS OWNER BOT KEYBOARD (A1): F8 denied without admin authority; authorized path keeps off-by-default, true 41-ID catalog, normal Gold bot pick, Shift release, local-mode isolation, deactivation');
