// Real drawIceComposite bridge: camera transform -> device-space clear/blit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frost = fs.readFileSync(path.join(root, 'public/game/hero-rework/frostGoldV1.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'public/game/hero-rework/frostPresentationRuntime.js'), 'utf8');
const b0 = frost.indexOf('    blitBounds(t, cvW, cvH, transform = null) {');
const b1 = frost.indexOf('    /**\n     * Normalised motion', b0);
assert.ok(b0 >= 0 && b1 > b0);
const Ice = vm.runInNewContext('class Ice {\n' + frost.slice(b0,b1) + '\n}\nIce');
const d0 = runtime.indexOf('function drawIceComposite(S, ctx, px) {');
const d1 = runtime.indexOf('\nfunction withGunScale(', d0);
assert.ok(d0 >= 0 && d1 > d0);
const draw = vm.runInNewContext(runtime.slice(d0,d1) + '\ndrawIceComposite', {
  g:{}, renderAudit:{iceRenders:0, frame:1}, noteRenderSource(){},
  currentIntegrity(){return null;}, performance:{now:()=>100},
  warnOnce(e){throw e;},
});
const ice = new Ice();
ice.nodes = [{x:1300,y:400,L:60,W:35,born:0,dead:false}]; ice.carves=[];
ice.render = ()=>true;
const clears=[], blits=[];
const ic={setTransform(){},clearRect:(...a)=>clears.push(a)};
const S={engine:{ice,t:1,iceCanvas:{width:1000,height:1000},iceCtx:ic}};
const stack=[];
const ctx={
  canvas:{width:1000,height:1000},globalAlpha:1,
  m:{a:1,b:0,c:0,d:1,e:-750,f:0},
  getTransform(){return {...this.m}},
  save(){stack.push({m:{...this.m},alpha:this.globalAlpha})},
  restore(){const s=stack.pop();this.m=s.m;this.globalAlpha=s.alpha},
  setTransform(a,b,c,d,e,f){this.m={a,b,c,d,e,f}},
  drawImage:(...a)=>blits.push(a),
};
const matrices = [
  {a:1,b:0,c:0,d:1,e:-750,f:0},
  {a:1,b:0,c:0,d:1,e:-720,f:0},
  {a:1,b:0,c:0,d:1,e:-200,f:0},
  {a:1.2,b:.25,c:-.25,d:1.2,e:-300,f:-70},
];
const xs=[1300,1310,500,620];
let previous=null;
for(let i=0;i<matrices.length;i++){
  ctx.m={...matrices[i]};
  ice.nodes[0].x=xs[i];
  const now=ice.blitBounds(1,1000,1000,matrices[i]);
  assert.ok(now, 'each camera must show some ice');
  const union=previous ? {
    x:Math.min(previous.x,now.x),y:Math.min(previous.y,now.y),
    right:Math.max(previous.x+previous.w,now.x+now.w),
    bottom:Math.max(previous.y+previous.h,now.y+now.h),
  } : {x:now.x,y:now.y,right:now.x+now.w,bottom:now.y+now.h};
  draw(S,ctx,1);
  assert.equal(clears.length,i+1,'one union clear per frame');
  assert.equal(blits.length,i+1,'one composite draw per frame');
  assert.equal(JSON.stringify(clears[i]),JSON.stringify([
    union.x,union.y,union.right-union.x,union.bottom-union.y]),
    'clear includes both old and new camera-space ice');
  assert.equal(JSON.stringify(blits[i].slice(1)),JSON.stringify([
    now.x,now.y,now.w,now.h,now.x,now.y,now.w,now.h]),
    'blit copies only transformed device-space bounds');
  assert.equal(JSON.stringify(ctx.m),JSON.stringify(matrices[i]),
    'host matrix is restored after ice');
  assert.equal(ctx.globalAlpha,1,'host alpha is restored after ice');
  previous=now;
}
console.log('P0 FROST composite camera PASS: moving, translated and zoomed camera clear/blit.');
