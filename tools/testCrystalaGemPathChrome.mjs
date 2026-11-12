// Browser Canvas2D A/B: the same CRYSTALA Gold HEXA cage from R5 and
// the path-reuse candidate; screenshot pixels must match exactly.
// Chromium here may use software rendering: never call this a GPU FPS test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const puppeteer=require('./probe/node_modules/puppeteer-core');
const original=execFileSync('git',['show',
 '485a75637e985415945662c2a6016eb898932612:public/game/hero-rework/crystalaGoldV6.js'],{encoding:'utf8'});
const optimized=fs.readFileSync('public/game/hero-rework/crystalaGoldV6.js','utf8');
const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_PATH,headless:true,
 args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'],
 defaultViewport:{width:900,height:800}
});
const take=async(code)=>{
 const page=await browser.newPage();
 try{
  await page.goto('about:blank');
  return await page.evaluate(code=>{
   new Function('window','globalThis',code)(window,window);
   const G=window.APEX_CRYSTALA_GOLD;
   const rig=G.createRig({seed:145,visual:false});
   rig.setBody(250,315,0,0);
   for(let i=0;i<60;i++)rig.advance(1/60);
   rig.awaken(1,1);
   const {prison}=rig.castPrison({cx:490,cy:330,R:135,seed:34});
   for(let i=0;i<150;i++)rig.advance(1/60);
   const cv=document.createElement('canvas');cv.width=760;cv.height=680;
   const ctx=cv.getContext('2d',{willReadFrequently:true});
   const draw=()=>{
    ctx.clearRect(0,0,760,680);
    G.drawPrison(ctx,prison,false,false);
    G.drawPrison(ctx,prison,false,true);
    G.drawPrison(ctx,prison,true,false);
    G.drawPrison(ctx,prison,true,true);
   };
   for(let i=0;i<12;i++)draw();
   const rgba=Array.from(ctx.getImageData(0,0,760,680).data);
   const samples=[];
   for(let round=0;round<7;round++){
    let start=performance.now();
    for(let i=0;i<55;i++)draw();
    samples.push((performance.now()-start)/55);
   }
   samples.sort((a,b)=>a-b);
   return {ms:samples[3],samples,rgba};
  },code);
 }finally{await page.close();}
};
try{
 const a=await take(original),b=await take(optimized);
 assert.deepEqual(b.rgba,a.rgba,'Gold visual pixels mismatch in real Chrome');
 const gain=100*(a.ms-b.ms)/a.ms;
 const result={referenceMs:a.ms,optimizedMs:b.ms,improvementPct:gain,
   originalSamples:a.samples,optimizedSamples:b.samples,
   sha256:crypto.createHash('sha256').update(Buffer.from(a.rgba)).digest('hex')};
 fs.mkdirSync('reports/crystala-hexa-chrome',{recursive:true});
 fs.writeFileSync('reports/crystala-hexa-chrome/canvas-a-b.json',JSON.stringify(result,null,2));
 console.log('CHROME GOLD HEXA A/B '+JSON.stringify(result));
 assert(gain>0,'No Chrome Canvas2D improvement; do not ship');
}finally{await browser.close();}
