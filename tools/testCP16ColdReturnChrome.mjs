// CP16: real Chrome cold, cached reload and history-return smoke on production build.
// Does not bypass transition, Gold shell import, external scripts or runtime READY.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const chromePath=process.env.CHROME_PATH;
assert.ok(chromePath,'CHROME_PATH required');
const url=process.env.APEX_APP_URL||'http://127.0.0.1:4173/';
const revision=fs.readFileSync('src/game/runtimeManifest.js','utf8')
  .match(/APEX_ARSENAL_RUNTIME_REVISION\s*=\s*'([^']+)'/)[1];
const evidenceDir=process.env.APEX_CP16_EVIDENCE_DIR||'/tmp/cp16-cache-browser';
fs.mkdirSync(evidenceDir,{recursive:true});
const browser=await puppeteer.launch({executablePath:chromePath,headless:true,
  args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required']});
const tests=[
  {name:'desktop',viewport:{width:1440,height:900}},
  {name:'android',viewport:{width:390,height:844,isMobile:true,hasTouch:true,
    deviceScaleFactor:2}}
];
try{
 for(const test of tests){
  const page=await browser.newPage();
  const requests=[],errors=[],badResponses=[];
  try{
   await page.setViewport(test.viewport);
   page.on('pageerror',err=>errors.push(String(err)));
   page.on('request',req=>{
    const parsed=new URL(req.url());
    if(parsed.pathname==='/gold/shell.html' ||
      parsed.pathname==='/game/ui/uiSfxAuthority.js' ||
      parsed.pathname==='/game/gold/goldProductBridge.js'){
      requests.push({pathname:parsed.pathname,revision:parsed.searchParams.get('v')});
    }
   });
   page.on('response',res=>{
    const pathname=new URL(res.url()).pathname;
    if(['/gold/shell.html','/game/ui/uiSfxAuthority.js',
      '/game/gold/goldProductBridge.js'].includes(pathname) && res.status()>=400)
      badResponses.push(pathname+':'+res.status());
   });
   async function verify(phase){
    await page.waitForFunction(()=>!!document.querySelector('#gold-shell-host #stage') &&
      document.getElementById('gold-shell-host')?.dataset.apexGoldMounted==='1' &&
      !!document.getElementById('apex-boot-start') &&
      typeof window.__apexEnsureDeferredRuntimes==='function',
      {timeout:100000});
    const proof=await page.evaluate(()=>{
      const entries=[...document.querySelectorAll('script[src]')]
        .filter(x=>/\/game\/(?:ui\/uiSfxAuthority|gold\/goldProductBridge)\.js/.test(x.src))
        .map(x=>({path:new URL(x.src).pathname,v:new URL(x.src).searchParams.get('v'),
          loaded:x.dataset.apexLoaded}));
      return {home:!!document.querySelector('#freeBattle'),
        gold:document.getElementById('gold-shell-host')?.dataset.apexGoldMounted,
        scripts:entries,boot:!!document.getElementById('apex-boot-start')};
    });
    assert.equal(proof.gold,'1',phase+' Gold mount incomplete');
    assert.equal(proof.home,true,phase+' Home DOM missing');
    for(const script of ['ui/uiSfxAuthority.js','gold/goldProductBridge.js']){
      const matches=proof.scripts.filter(x=>x.path==='/game/'+script);
      assert.equal(matches.length,1,phase+' '+script+' duplicated/missing');
      assert.equal(matches[0].v,revision,phase+' '+script+' has stale revision');
      assert.equal(matches[0].loaded,'true',phase+' '+script+' script not loaded');
    }
    const receipt={phase,proof,requestCount:requests.length,exceptions:errors};
    console.log('CP16 BROWSER '+test.name+' '+JSON.stringify(receipt));
    return receipt;
   }
   await page.setCacheEnabled(false);
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
   const cold=await verify('cold');
   // Exercise a real START before the browser begins its return cycle.
   await page.click('#apex-boot-start');
   await page.waitForFunction(()=>!document.getElementById('apex-boot-start') &&
     typeof window.APEX_GOLD_SHELL_NAVIGATE==='function' &&
     !window.APEX_SCENE_TRANSITION?.active?.(),{timeout:100000});
   await page.screenshot({path:path.join(evidenceDir,test.name+'-cold-home.png')});
   await page.setCacheEnabled(true);
   await page.reload({waitUntil:'domcontentloaded',timeout:60000});
   const warm=await verify('cached-reload');
   await page.goto('about:blank',{waitUntil:'load'});
   await page.goBack({waitUntil:'domcontentloaded',timeout:60000});
   const returned=await verify('history-return');
   await page.screenshot({path:path.join(evidenceDir,test.name+'-return-boot.png')});
   assert.ok(requests.some(r=>r.pathname==='/gold/shell.html'),
     'real Gold shell request never observed');
   assert.ok(requests.every(r=>r.revision===revision),
     'network loaded a mixed-revision Gold script or shell: '+JSON.stringify(requests));
   assert.deepEqual(badResponses,[],'bad transport response');
   assert.deepEqual(errors,[],'runtime page error');
   fs.writeFileSync(path.join(evidenceDir,test.name+'-receipt.json'),
     JSON.stringify({revision,cold,warm,returned,requests,badResponses,errors},null,2)+'\n');
   console.log('CP16 COLD/RETURN PASS '+test.name+' rev='+revision);
  } finally {await page.close();}
 }
} finally {await browser.close();}
console.log('CP16 REAL CHROME COLD/RETURN 2/2 PASS');