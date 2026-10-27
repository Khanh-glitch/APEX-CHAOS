// True browser smoke test for itch.io CDN's nested /html/<id>/ hosting.
// Unlike root-Vite QA, it returns a real 404 for every escaped root URL.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer-core';
process.env.AWS_EXECUTION_ENV ||= 'AWS_Lambda_nodejs22.x';
const { default: chromium } = await import('@sparticuz/chromium');
const root = path.resolve('reports/itch-nested');
const base = '/html/123456/';
const mime = { '.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript',
 '.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp',
 '.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.mp3':'audio/mpeg',
 '.ogg':'audio/ogg','.wav':'audio/wav','.ico':'image/x-icon' };
fs.mkdirSync('reports/itch-browser-qa',{recursive:true});
const notFound=[], failures=[], pageErrors=[];
const server=http.createServer((req,res)=>{
 const uri = new URL(req.url,'http://localhost');
 const pathname=decodeURIComponent(uri.pathname);
 if (!pathname.startsWith(base) || pathname.includes('..')) {
   notFound.push({url:pathname,reason:'escaped itch subpath'});
   res.writeHead(404);res.end('outside itch package');return;
 }
 const name=pathname.slice(1);
 const candidate=path.join(root,name);
 if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
   notFound.push({url:pathname,reason:'missing packaged asset'});
   res.writeHead(404);res.end('not packaged');return;
 }
 res.writeHead(200,{'Content-Type':mime[path.extname(candidate)]||'application/octet-stream'});
 fs.createReadStream(candidate).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port, origin='http://127.0.0.1:'+port;
let browser;
const stats=[];
try {
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH || await chromium.executablePath(),
   headless:true,args:[...chromium.args.filter(a=>a!=='--single-process'),'--no-sandbox','--disable-setuid-sandbox']});
 const drive=async(name,viewport,ua=null)=>{
   const page=await browser.newPage();
   await page.setViewport(viewport);
   if(ua)await page.setUserAgent(ua);
   page.on('pageerror',e=>pageErrors.push({profile:name,error:String(e)}));
   page.on('requestfailed',r=>failures.push({profile:name,url:r.url(),failure:r.failure()?.errorText}));
   await page.goto(origin+base+'index.html',{waitUntil:'domcontentloaded',timeout:60000});
   await new Promise(r=>setTimeout(r,11000));
   const url=page.url;
   const deepest=page.frames().find(f=>f.url().includes('goldViewport=native')) || page.mainFrame();
   const state=await deepest.evaluate(()=>({
     url:location.href, rootChildren:document.querySelector('#root')?.children.length||0,
     textLength:(document.body?.innerText||'').trim().length,
     mainScriptLoaded:!!document.querySelector('script[src*="assets/index-"]'),
     base:window.__APEX_ITCH_ROOT__||null,
   })).catch(e=>({error:String(e)}));
   await page.screenshot({path:'reports/itch-browser-qa/'+name+'.png'});
   assert.ok(url.includes(base),name+' escaped itch folder: '+url);
   assert.ok(state.rootChildren>0 && state.textLength>35,
     name+' WHITE SCREEN or app not mounted: '+JSON.stringify(state));
   assert.equal(state.base,base,name+' wrong global CDN subpath base');
   stats.push({profile:name,url,app:state});
   await page.close();
 };
 await drive('desktop',{width:1440,height:900,deviceScaleFactor:1});
 await drive('mobile',{width:844,height:390,deviceScaleFactor:2,isMobile:true,hasTouch:true},
   'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
 const wave=await browser.newPage();
 await wave.setViewport({width:844,height:390,deviceScaleFactor:2,isMobile:true,hasTouch:true});
 wave.on('pageerror',e=>pageErrors.push({profile:'bot-wave',error:String(e)}));
 wave.on('requestfailed',r=>failures.push({profile:'bot-wave',url:r.url(),failure:r.failure()?.errorText}));
 await wave.goto(origin+base+'bot-wave/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 await wave.waitForFunction(()=>!document.getElementById('wave').hidden,{timeout:60000});
 const frame=wave.frames().find(f=>f.url().includes('/bot-wave/game.html'));
 assert.ok(frame,'BOT WAVE game frame missing');
 const state=await frame.evaluate(async()=>{
    await window.handLab.fluid._pressureWasmReady;
    return {phase:window.BOXE_WAVE_PILOT?.state?.phase, backend:window.handLab.fluid._pressureBackend,
     v2:window.APEX_BOT_WAVE_INTERFACE_V2?.installed};
 });
 assert.equal(state.backend,'wasm-exact-14-iter','WASM backend inactive on itch subpath');
 assert.equal(state.v2,true,'Gold wrapper not installed on itch subpath');
 await wave.screenshot({path:'reports/itch-browser-qa/bot-wave.png'});
 stats.push({profile:'bot-wave',state});
 await wave.close();
 // Any 404 is a real product bug (no Vite fallback in this harness).
 assert.deepEqual(notFound,[],'Subpath asset 404s: '+JSON.stringify(notFound.slice(0,20)));
 // Chrome media autoplay errors can happen until a user clicks; failed HTTP
 // requests are not allowed in otherwise static, offline-shippable game.
 const outside=failures.filter(x=>x.url.startsWith(origin) && !x.url.includes(base));
 assert.deepEqual(outside,[],'Requests outside itch directory');
 assert.deepEqual(pageErrors,[],'Runtime browser exceptions');
 console.log('ITCH NESTED BROWSER ACCEPTANCE PASS',JSON.stringify(stats));
} catch(e) {
 console.error('ITCH NESTED BROWSER ACCEPTANCE FAILED',e);
 console.error('HTTP 404',JSON.stringify(notFound.slice(0,50)));
 console.error('PAGE ERRORS',JSON.stringify(pageErrors.slice(0,30)));
 throw e;
} finally {
 fs.writeFileSync('reports/itch-browser-qa/acceptance.json',JSON.stringify({stats,notFound,failures,pageErrors},null,2));
 await browser?.close().catch(()=>{});
 await new Promise(resolve=>server.close(resolve));
}