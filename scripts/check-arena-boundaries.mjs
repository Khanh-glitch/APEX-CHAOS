import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const read = f => readFileSync(new URL(f, root), 'utf8');
const engine = read('public/apexEngine.js');
const method = engine.slice(engine.indexOf('    resolveWalls() {'), engine.indexOf('    draw(ctx) {', engine.indexOf('    resolveWalls() {')));
assert.ok(method.includes('evolutionInset'));
const context = {
  Math, GAME_SIZE:1000, gameState:'ARSENAL',
  window: {APEX_BEYOND_COMBAT:{isFreeBattleEligible:()=>true}, APEX_BEYOND_ARENA:{getWallInset:()=>76}},
  sawWallRage:{timer:0}, floatingTexts:[],
  norm:(x,y)=>{ const m=Math.hypot(x,y)||1; return {x:x/m,y:y/m}; },
};
vm.createContext(context);
const Fighter = vm.runInContext(`class Fighter { ${method} }; Fighter;`,context);
function mk(id,x,y,dx,dy){const f = new Fighter();Object.assign(f,{id,x,y,radius:75,dir:{x:dx,y:dy},data:{},type:{}});return f;}
const min=151,max=849;
for (let id of [1,2]) for(let p of [
  [120,500,-1,0],[880,500,1,0],[500,120,0,-1],[500,880,0,1],
  [105,110,-.8,-.6],[890,890,.8,.6],[130,860,-.8,.6],
]) {
  const f=mk(id,...p);
  let side=f.resolveWalls(); assert.ok(side, 'must hit visual wall');
  assert.ok(f.x>=min&&f.x<=max&&f.y>=min&&f.y<=max, 'body must stay inside playable floor');
  const before={x:f.x,y:f.y};
  for(let i=0;i<12;i++) {f.x+=f.dir.x*6; f.y+=f.dir.y*6; f.resolveWalls();}
  assert.ok(f.x>=min&&f.x<=max&&f.y>=min&&f.y<=max,'survives repeated collision');
  assert.ok(Math.hypot(f.x-before.x,f.y-before.y)>6, 'fighter should escape contact, not stay on wall');
}
context.gameState = 'MENU';
const legacy=mk(1,50,500,-1,0);legacy.resolveWalls();
assert.equal(legacy.x,75,'legacy mode must keep original wall');
context.gameState = 'ARSENAL'; context.window.APEX_BEYOND_COMBAT.isFreeBattleEligible=()=>false;
const quest=mk(2,40,500,-1,0);quest.resolveWalls();
assert.equal(quest.x,75,'ineligible modes must keep original physics');

const bridgeSrc=read('public/game/arsenal/apexBeyondArenaEngine.js');
const mock = {
 GAME_SIZE:1000, fighters:[], performance:{now:()=>1000},
 addEventListener(){}, dispatchEvent(){}, CustomEvent:class{},
 APEX_EVOLUTION_ARENAS:{catalog:()=>[{id:'scrap_foundry',name:'F',shortName:'F'}],getSelectedId:()=> 'scrap_foundry',setSelectedId(){},clearScars(){},initMatchArena(){},stepArenaMechanics(){},drawArenaFloor(){},runtime:()=>null,addScar(){}},
 APEX_BEYOND_COMBAT:{isFreeBattleEligible:()=>true},
};
mock.window=mock;
vm.runInNewContext(bridgeSrc,{window:mock,performance:mock.performance,CustomEvent:mock.CustomEvent,Math,console});
const api=mock.APEX_BEYOND_ARENA;
assert.equal(api.getWallInset(),76);
for(let id=1;id<=2;id++){
 const f=mk(id,id===1?20:970,id===1?970:20,id===1?-1:1,id===1?1:-1);f.hp=100;
 api.keepInsidePlayableFloor(f);
 assert.ok(f.x>=min&&f.x<=max&&f.y>=min&&f.y<=max);
}
const arena=read('public/game/evolution/apexEvolutionArenas.js');
assert.ok(!arena.includes('S - 120, 120, 120, S - 120]]) { c.beginPath()'), 'unneeded long diagonal decorator removed');
assert.ok(arena.includes('Math.abs((f.x - f.y)) < 56'),'Prism diagonal hazard mechanic retained');
assert.ok(arena.includes('wm = Number(g.APEX_BEYOND_ARENA?.getWallInset?.()) || 46'), 'wall VFX contact follows physics');
assert.ok(bridgeSrc.includes('stampSkid(x,y,angle=0,size=24) {}'), 'remove spurious cosmetic skid traces');
console.log('ARENA EDGE/CLEAN-FLOOR PASS: 2 fighters, 7 boundary approaches, 2 legacy-mode guards, hazard correction, functional Prism preserved.');
