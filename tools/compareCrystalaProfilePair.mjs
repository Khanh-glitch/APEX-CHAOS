// Comparable, same-browser, same-script RC5 vs candidate CRYSTALA draw timings.
// This is headless browser CPU / software compositor evidence only, not owner GPU FPS.
import fs from 'node:fs';
const [beforePath,afterPath]=process.argv.slice(2);
if(!beforePath||!afterPath)throw Error('Usage: node tools/compareCrystalaProfilePair.mjs before.json after.json');
const before=JSON.parse(fs.readFileSync(beforePath,'utf8'));
const after=JSON.parse(fs.readFileSync(afterPath,'utf8'));
if(before.pageErrors?.length||after.pageErrors?.length)
  throw Error('Browser exceptions: '+JSON.stringify({before:before.pageErrors,after:after.pageErrors}));
const a=new Map(after.profiles.map(p=>[p.label,p]));
const rows=[];
for(const p of before.profiles){
  const q=a.get(p.label);
  if(!q)throw Error('Missing matching current scenario '+p.label);
  const base=p.summary['frame.total'],newer=q.summary['frame.total'];
  const baseDraw=p.summary['draw.total'],newDraw=q.summary['draw.total'];
  const bBloom=p.summary['bloom.composite'],nBloom=q.summary['bloom.composite'];
  rows.push({scenario:p.label,
    oldFrameP50:+base.p50.toFixed(3),newFrameP50:+newer.p50.toFixed(3),
    oldFrameP95:+base.p95.toFixed(3),newFrameP95:+newer.p95.toFixed(3),
    oldDrawP95:+baseDraw.p95.toFixed(3),newDrawP95:+newDraw.p95.toFixed(3),
    oldBloomP95:+(bBloom?.p95||0).toFixed(3),newBloomP95:+(nBloom?.p95||0).toFixed(3),
    ratioP95:+(base.p95/Math.max(.001,newer.p95)).toFixed(3)});
}
if(rows.length<4)throw Error('Too few matching real Crystala scenarios');
const result={measurement:'production browser step+draw synchronous timed frames; NOT actual FPS, no physical GPU',
  oldRevision:before.revision,newRevision:after.revision,rows,
  newBloomSurfaceStats:after.bloomSurfaceStats||null};
console.log(JSON.stringify(result,null,2));
fs.writeFileSync('crystala-rc5-vs-candidate-perf.json',JSON.stringify(result,null,2)+'\n');
