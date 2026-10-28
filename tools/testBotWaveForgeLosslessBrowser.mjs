import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import puppeteer from 'puppeteer-core';
const baseline=fs.readFileSync('test-fixtures/bot-wave/forgeFireGold.js','utf8').replace(/\r\n/g,'\n');
assert.equal(crypto.createHash('sha256').update(baseline).digest('hex'),
 'ec7b16c8fd08836440d19b33169a87c2513018989f2d6092fd8ccce00d5b7b1d',
 'The cccc6ac Gold Forge oracle must remain immutable');
const source=fs.readFileSync('public/game/bot-wave/botWavePresentationV2.js','utf8').replace(/\r\n/g,'\n');
const start=source.indexOf('function createForgeFire('),end=source.indexOf('\nfunction install()',start);
const candidate=source.slice(start,end);
// Both branches must run the exact same shader, without compiler changes.
const shader=s=>s.match(/const fragmentSource=`([\s\S]*?)`;/)?.[1];
assert.equal(shader(candidate),shader(baseline));
const output=process.env.APEX_EVIDENCE_DIR||'reports/bot-wave-forge-lossless';
fs.mkdirSync(output,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 await page.goto('about:blank');
 const result=await page.evaluate(async(baseline,candidate)=>{
  let stamp=10000;
  const context={devicePixelRatio:1,performance:{now:()=>stamp}};
  const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(v)?v:min));
  const make=source=>{
   const glCanvas=document.createElement('canvas'),particles=document.createElement('canvas');
   for(const c of [glCanvas,particles]){
    c.style.width='320px';c.style.height='60px';document.body.append(c);
   }
   const factory=new Function('window','doc','clamp',source+';return createForgeFire;')(context,document,clamp);
   let seed=117;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
   const renderer=factory(glCanvas,particles,false),gl=glCanvas.getContext('webgl');
   if(renderer.mode!=='webgl-fbm-domain-warp')throw Error('WebGL unavailable');
   const original=gl.drawArrays.bind(gl);let draws=0,fragments=0;
   gl.drawArrays=function(...args){draws++;const box=gl.getParameter(gl.SCISSOR_BOX);
    fragments+=gl.isEnabled(gl.SCISSOR_TEST)?box[2]*box[3]:gl.drawingBufferWidth*gl.drawingBufferHeight;return original(...args);};
   return {renderer,gl,glCanvas,particles,stats:()=>({draws,fragments})};
  };
  const originalRandom=Math.random;
  const a=make(baseline),b=make(candidate);
  let cases=0,changedChannels=0,maxDiff=0,particleDifferences=0;
  const timings={baseline:[],candidate:[]};
  function render(branch,fury,hp){
   let seed=431+cases;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
   const start=performance.now();branch.renderer.render({fury,hp});branch.gl.finish();
   return performance.now()-start;
  }
  function pixels(branch){
   const gl=branch.gl,data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
   gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;
  }
  for(const dpr of [1,2]){
   context.devicePixelRatio=dpr;
   for(const fury of [0,.08,.09,.15,.3,.65,.999,1,0])for(const hp of [1,.18]){
    stamp+=33;
    const order=cases%2?[['candidate',b],['baseline',a]]:[['baseline',a],['candidate',b]];
    for(const [name,branch] of order)timings[name].push(render(branch,fury,hp));
    const x=pixels(a),y=pixels(b);
    if(x.length!==y.length)throw Error('Resolution changed');
    for(let i=0;i<x.length;i++){const diff=Math.abs(x[i]-y[i]);if(diff)changedChannels++;maxDiff=Math.max(maxDiff,diff);}
    const px=a.particles.getContext('2d').getImageData(0,0,a.particles.width,a.particles.height).data;
    const py=b.particles.getContext('2d').getImageData(0,0,b.particles.width,b.particles.height).data;
    for(let i=0;i<px.length;i++)if(px[i]!==py[i])particleDifferences++;
    cases++;
   }
  }
  // Decay to exactly zero, then measure idle fury with warmed GL contexts.
  const idle={baseline:[],candidate:[]};
  for(let i=0;i<120;i++){
   stamp+=50;render(a,0,1);render(b,0,1);
  }
  for(let i=0;i<20;i++){
   stamp+=33;
   for(const [name,branch] of i%2?[['candidate',b],['baseline',a]]:[['baseline',a],['candidate',b]])idle[name].push(render(branch,0,1));
  }
  Math.random=originalRandom;
  const median=v=>[...v].sort((a,b)=>a-b)[Math.floor(v.length/2)];
  return {cases,changedChannels,maxDiff,particleDifferences,shaderDraws:{baseline:a.stats(),candidate:b.stats()},
   idle:{baselineMedianMs:median(idle.baseline),candidateMedianMs:median(idle.candidate),samples:idle},
   userAgent:navigator.userAgent};
 },baseline,candidate);
 assert.equal(result.changedChannels,0,'Forge framebuffer must exactly match Gold');
 assert.equal(result.particleDifferences,0,'Forge particles must exactly match Gold');
 assert.ok(result.shaderDraws.candidate.fragments<result.shaderDraws.baseline.fragments);
 fs.writeFileSync(output+'/comparison.json',JSON.stringify({...result,baselineFixtureSha256:crypto.createHash('sha256').update(baseline).digest('hex')},null,2)+'\n');
 console.log('BOT WAVE FORGE CHROME PARITY PASS',JSON.stringify(result));
}finally{await browser.close();}
