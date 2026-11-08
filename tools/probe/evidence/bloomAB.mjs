// bloomAB.mjs — A/B the SHIPPED composite() against the previous revision.
//
// IMPORTANT: crystalaGoldV6.js starts with
//     if (g.APEX_CRYSTALA_GOLD) return;
// so evaluating two revisions in one realm silently keeps the FIRST one. Each
// revision therefore gets its own page, and the two are timed in an interleaved
// order (A B B A) inside one browser session to cancel drift.
//
// Reports, per product region size: paid (flushed) composite cost for each
// revision, the speedup, and the pixel delta between them.
//
// Usage: DPR=3.5 REPS=5 OLD=/tmp/crystalaGoldV6.before.js bash boot.sh evidence/bloomAB.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../node_modules/', import.meta.url));
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const DPR = Number(process.env.DPR || 3.5);
const REPS = Number(process.env.REPS || 5);
const OLD = process.env.OLD || '/tmp/crystalaGoldV6.before.js';
const NEW = process.env.NEW || '/home/user/APEX-CHAOS/public/game/hero-rework/crystalaGoldV6.js';
const OUT = process.env.OUT || '/tmp/bloomAB.json';

const codeOld = fs.readFileSync(OLD, 'utf8');
const codeNew = fs.readFileSync(NEW, 'utf8');

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(), headless: true,
  protocolTimeout: 900000, args: [...chromium.args, '--no-sandbox'],
});

async function openWith(code) {
  const page = await browser.newPage();
  await page.setViewport({ width: 432, height: 768, deviceScaleFactor: DPR });
  await page.setContent('<!doctype html><html><body></body></html>');
  // addScriptTag, not page.evaluate: a string beginning with "(function(){" is
  // treated by puppeteer as a function to call, so the helper silently never
  // got installed. A real <script> tag has no such ambiguity.
  await page.addScriptTag({ content: code });
  const ok = await page.evaluate(() => !!globalThis.APEX_CRYSTALA_GOLD);
  if (!ok) throw new Error('module did not install');
  await page.addScriptTag({ content: runner });
  const ok2 = await page.evaluate(() => typeof window.__runRegions === 'function');
  if (!ok2) throw new Error('runner did not install');
  return page;
}

const runner = `
  (function(){
    const G = globalThis.APEX_CRYSTALA_GOLD;
    const mk = (w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
    const median=(a)=>{const s=a.slice().sort((x,y)=>x-y);return +s[Math.floor(s.length/2)].toFixed(2);};
    const REGIONS=[{n:'body',r:{x:280,y:260,w:400,h:440}},{n:'prison',r:{x:220,y:220,w:560,h:560}},{n:'wall',r:{x:50,y:50,w:900,h:900}}];
    function fillGeo(gx,w,h){
      gx.setTransform(1,0,0,1,0,0); gx.clearRect(0,0,w,h); gx.fillStyle='#ffb343';
      for(let i=0;i<26;i++){const a=(i/26)*Math.PI*2; gx.beginPath();
        gx.arc(w/2+Math.cos(a)*w*0.26,h/2+Math.sin(a)*h*0.26,w*0.05,0,Math.PI*2); gx.fill();}
      gx.fillStyle='#fff3c4'; gx.fillRect(w*0.42,h*0.42,w*0.16,h*0.16);
    }
    window.__runRegions = function(REPS){
      const out={};
      for(const {n,r} of REGIONS){
        const dst=mk(1000,1000);
        const dctx=dst.getContext('2d',{willReadFrequently:true});
        dctx.fillStyle='#101418'; dctx.fillRect(0,0,1000,1000);
        const flush=()=>{try{dctx.getImageData(0,0,1,1);}catch(e){}};
        function once(){
          const b=G.createBloomSystem({width:1000,height:1000,scale:0.5});
          b.ensure(r.w,r.h);
          const gx=b.begin(null,r);
          fillGeo(gx,Math.round(r.w*0.5),Math.round(r.h*0.5));
          b.composite(dctx,1000,1000,r);
        }
        once(); flush();               // warm + first-raster
        const paid=[], sub=[];
        for(let i=0;i<REPS;i++){
          const t0=performance.now(); once(); sub.push(performance.now()-t0);
          const t1=performance.now(); once(); flush(); paid.push(performance.now()-t1);
        }
        // Pixels for the equivalence test must come from a FRESH canvas. The
        // measurement canvas above has accumulated REPS*2 additive composites,
        // so its pixels sit against the clipping ceiling and a 1/255 sampling
        // difference there shows up as a 10-20/255 delta. Capture separately.
        const clean=mk(1000,1000);
        const cctx=clean.getContext('2d',{willReadFrequently:true});
        cctx.fillStyle='#101418'; cctx.fillRect(0,0,1000,1000);
        (function onceInto(ctx){
          const b=G.createBloomSystem({width:1000,height:1000,scale:0.5});
          b.ensure(r.w,r.h);
          const gx=b.begin(null,r);
          fillGeo(gx,Math.round(r.w*0.5),Math.round(r.h*0.5));
          b.composite(ctx,1000,1000,r);
        })(cctx);
        out[n]={px:r.w*r.h, submit:median(sub), paid:median(paid),
                pxData:Array.from(cctx.getImageData(r.x,r.y,r.w,r.h).data)};
      }
      return out;
    };
  })();
`;

const pageOld = await openWith(codeOld);
const pageNew = await openWith(codeNew);

// Interleaved ABBA, min of the two readings per version.
const runA = () => pageOld.evaluate((r) => window.__runRegions(r), REPS);
const runB = () => pageNew.evaluate((r) => window.__runRegions(r), REPS);
const a1 = await runA(), b1 = await runB(), b2 = await runB(), a2 = await runA();

function diff(a, b) {
  let max = 0, sum = 0, over2 = 0, n = 0;
  for (let i = 0; i < a.length; i += 4) for (let k = 0; k < 3; k++) {
    const d = Math.abs(a[i + k] - b[i + k]);
    if (d > max) max = d; sum += d; if (d > 2) over2++; n++;
  }
  return { maxDelta: max, meanDelta: +(sum / n).toFixed(3), over2Pct: +((over2 / n) * 100).toFixed(3) };
}
const report = { dpr: DPR, reps: REPS, regions: {} };
for (const n of Object.keys(a1)) {
  const beforePaid = Math.min(a1[n].paid, a2[n].paid);
  const afterPaid = Math.min(b1[n].paid, b2[n].paid);
  report.regions[n] = {
    px: a1[n].px,
    beforePaid, afterPaid,
    speedup: +(beforePaid / afterPaid).toFixed(2),
    beforeSubmit: a1[n].submit, afterSubmit: b1[n].submit,
    delta: diff(a1[n].pxData, b1[n].pxData),
  };
}
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log('\nregion   px        BEFORE ms  AFTER ms   speedup   maxΔ  meanΔ  >2/255%   verdict');
for (const [k, v] of Object.entries(report.regions)) {
  const verdict = v.delta.maxDelta <= 3 ? 'PIXEL-EQUIVALENT' : 'DIFFERENT';
  console.log('  ' + k.padEnd(7) + String(v.px).padStart(7) + String(v.beforePaid).padStart(11) +
    String(v.afterPaid).padStart(10) + (v.speedup + 'x').padStart(10) +
    String(v.delta.maxDelta).padStart(7) + String(v.delta.meanDelta).padStart(8) +
    String(v.delta.over2Pct).padStart(9) + '   ' + verdict);
}
await pageOld.close(); await pageNew.close(); await browser.close();
