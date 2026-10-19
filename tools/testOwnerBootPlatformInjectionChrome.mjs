// Reproduce Netlify's preview HTML injection without depending on Netlify
// assigning a deploy-preview to a stacked draft PR. The provider script
// appears in BOTH index and fetched Gold shell; its load on index happened
// before the Gold script replay. Waiting on that old load is the START deadlock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const chrome=process.env.CHROME_PATH;
if(!chrome)throw Error('CHROME_PATH required');
const origin=process.env.APEX_LOCAL_URL||'http://127.0.0.1:4173';
const dist=path.resolve('dist');
const injector='<div data-preview-injected><script src="/.netlify/scripts/cdp"></script></div>';
const target=(file)=>fs.readFileSync(path.join(dist,file),'utf8')
  .replace('</body>',injector+'</body>');
const browser=await puppeteer.launch({
 executablePath:chrome,headless:true,args:['--no-sandbox','--disable-setuid-sandbox',
 '--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']
});
try{
 const page=await browser.newPage();
 await page.setViewport({width:1440,height:900});
 const messages=[];
 page.on('pageerror',e=>messages.push('PAGE: '+String(e)));
 page.on('console',m=>{if(m.type()==='error'||m.type()==='warn')messages.push(m.text())});
 await page.setRequestInterception(true);
 page.on('request',req=>{
   const url=new URL(req.url());
   if(url.pathname==='/.netlify/scripts/cdp'){
     void req.respond({status:200,contentType:'text/javascript',
       body:'window.__previewProviderLoadCount=(window.__previewProviderLoadCount||0)+1;'});
   }else if(req.isNavigationRequest()&&url.pathname==='/'){
     void req.respond({status:200,contentType:'text/html; charset=utf-8',body:target('index.html')});
   }else if(url.pathname==='/gold/shell.html'){
     void req.respond({status:200,contentType:'text/html; charset=utf-8',body:target('gold/shell.html')});
   }else void req.continue();
 });
 await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:30000});
 try{
   await page.waitForFunction(()=>!!document.getElementById('apex-boot-start'),
      {timeout:55000,polling:250});
 }catch(e){
   const diag=await page.evaluate(()=>({
     scene:document.body.dataset.apexSceneTransition,
     mounted:document.getElementById('gold-shell-host')?.dataset.apexGoldMounted,
     provider:window.__previewProviderLoadCount,
     scripts:[...document.querySelectorAll('script[src]')].filter(s=>s.src.includes('/.netlify/')).map(s=>({src:s.src,loaded:s.dataset.apexLoaded||null}))
   }));
   throw Error('START boot blocked by injected preview script: '+JSON.stringify({diag,messages}));
 }
 const before=await page.evaluate(()=>{
   const btn=document.getElementById('apex-boot-start');
   const r=btn.getBoundingClientRect(),img=btn.querySelector('img');
   const point=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
   return {provider:window.__previewProviderLoadCount,mounted:document.getElementById('gold-shell-host')?.dataset.apexGoldMounted,
     imageReady:img?.naturalWidth>0,hit:point===btn||btn.contains(point),
     size:[r.width,r.height],scene:document.body.dataset.apexSceneTransition};
 });
 assert.equal(before.provider,1,'Netlify runtime must load once, without replay');
 assert.equal(before.mounted,'1','Home must be fully mounted before START');
 assert.ok(before.imageReady&&before.hit&&before.size[0]>40&&before.size[1]>18,
  'START art/hitbox must be visible: '+JSON.stringify(before));
 await page.click('#apex-boot-start');
 await page.waitForFunction(()=>
    document.body.dataset.apexSceneTransition==='DONE' &&
    !document.getElementById('apex-boot-start'),{timeout:30000});
 console.log('PASS preview-provider double-injection START -> Home '+JSON.stringify(before));
 await page.close();
}finally{await browser.close()}

// BOXE art acceptance is a real visual gate, not merely an asset-path assertion.
// Run only when BOXE is actually present in this source checkout.
if(fs.existsSync('public/assets/dictionary/heroes/boxe/standing.png')){
 await import('./testBoxeDictionaryArtChrome.mjs');
}
