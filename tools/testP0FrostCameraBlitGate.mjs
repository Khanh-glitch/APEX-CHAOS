// Camera-space dirty-rectangle regression for FROST's real Ice.blitBounds.
// Run: node tools/testP0FrostCameraBlitGate.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'public/game/hero-rework/frostGoldV1.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'public/game/hero-rework/frostPresentationRuntime.js'), 'utf8');
const start = source.indexOf('    blitBounds(t, cvW, cvH, transform = null) {');
const end = source.indexOf('    /**\n     * Normalised motion', start);
assert.ok(start >= 0 && end > start, 'real Frost ice bounds method found');
assert.match(runtime, /blitBounds\(e\.t, e\.iceCanvas\.width, e\.iceCanvas\.height, m\)/,
  'production composite must pass host canvas camera transform');
const Ice = vm.runInNewContext('class Ice {\n' + source.slice(start, end) + '\n}\nIce');
const ID = {a:1,b:0,c:0,d:1,e:0,f:0};
let seed = 3511783, cases = 0;
function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
for (let k = 0; k < 1400; k++) {
  const n = 1 + Math.floor(rnd() * 7);
  const ice = new Ice();
  ice.nodes = Array.from({length:n}, () => ({
    x:rnd()*1400-200, y:rnd()*1400-200, L:2+rnd()*120, W:2+rnd()*110, born:0, dead:false,
  }));
  ice.carves = k%3 ? [] : [{
    x:rnd()*1600-300,y:rnd()*1600-300,Rc:rnd()*80,off:rnd()*20,T:rnd()*30,born:0,dead:false,
  }];
  assert.equal(JSON.stringify(ice.blitBounds(1,1000,1000,ID)),
    JSON.stringify(ice.blitBounds(1,1000,1000)), 'identity camera parity '+k);
  const angle=(rnd()-.5)*Math.PI, z=.4+rnd()*2, ca=Math.cos(angle)*z, sa=Math.sin(angle)*z;
  const m={a:ca,b:sa,c:-sa,d:ca,e:rnd()*800-300,f:rnd()*800-300};
  const bbox=ice.blitBounds(1,1000,1000,m);
  const bound=[];
  for(const item of ice.nodes.concat(ice.carves)) {
    const r=item.L === undefined ? item.Rc+item.off+item.T+8 : Math.max(item.L,item.W)*1.9+6;
    const [x0,y0,x1,y1]=[item.x-r,item.y-r,item.x+r,item.y+r];
    for(const [x,y] of [[x0,y0],[x1,y0],[x0,y1],[x1,y1]])
      bound.push([m.a*x+m.c*y+m.e,m.b*x+m.d*y+m.f]);
  }
  const x0=Math.max(0,Math.min(...bound.map(p=>p[0])));
  const y0=Math.max(0,Math.min(...bound.map(p=>p[1])));
  const x1=Math.min(1000,Math.max(...bound.map(p=>p[0])));
  const y1=Math.min(1000,Math.max(...bound.map(p=>p[1])));
  if(x1>x0&&y1>y0) {
    assert.ok(bbox,'visible transformed ice must have bounds, case '+k);
    assert.ok(bbox.x<=x0&&bbox.y<=y0&&bbox.x+bbox.w>=x1&&bbox.y+bbox.h>=y1,
      'dirty rectangle must cover entire transformed ice, case '+k);
  }
  cases++;
}
const off=new Ice();
off.nodes=[{x:1300,y:400,L:30,W:20,born:0,dead:false}];off.carves=[];
assert.equal(off.blitBounds(1,1000,1000),null);
assert.ok(off.blitBounds(1,1000,1000,{...ID,e:-750}));
assert.equal(JSON.stringify(off.blitBounds(1,1000,1000,{...ID,a:NaN})),
  JSON.stringify({x:0,y:0,w:1000,h:1000}));
console.log('P0 FROST camera blit PASS: '+cases+' identity + '+cases+' transformed bounds.');
