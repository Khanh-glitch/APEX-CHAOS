// Genuine shipping arsenalConfig.js owner keyboard handler VM integration test.
// No fake UI launcher or monkey-patched weapon resolver.
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
const ctx=vm.createContext({window,document,console,setTimeout,clearTimeout});
vm.runInContext(fs.readFileSync('public/game/arsenal/arsenalConfig.js','utf8'),ctx);
const owner=window.APEX_ARSENAL_OWNER_TEST, AQ=window.APEX_ARSENAL;
assert.equal(owner.active,false,'must default OFF');
assert.equal(owner.catalog.length,39);
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
fire('keydown',event('F8',{ctrlKey:true,shiftKey:true}));
assert.equal(owner.active,true);assert.deepEqual(calls,['openBotPick']);
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
console.log('PASS OWNER BOT KEYBOARD: off by default, true 39-ID catalog, normal Gold bot pick, Shift release, local-mode isolation, deactivation');
