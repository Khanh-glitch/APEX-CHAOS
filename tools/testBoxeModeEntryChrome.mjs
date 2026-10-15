import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,
 args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
const output='docs/boxe/r5-browser';
fs.mkdirSync(output,{recursive:true});
const url=(process.env.APEX_APP_URL||'http://127.0.0.1:4173/').replace(/\/$/,'');
for(const view of [{name:'desktop',width:1440,height:900},{name:'landscape-phone',width:844,height:390}]){
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.setViewport({width:view.width,height:view.height,
   isMobile:view.name!=='desktop',hasTouch:view.name!=='desktop'});
  await page.goto(url+'/?goldViewport=native',{waitUntil:'domcontentloaded',timeout:65000});
  await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
  await page.click('#apex-boot-start');
  await page.waitForFunction(()=>!document.getElementById('apex-boot-start')&&!window.APEX_SCENE_TRANSITION?.active?.(),{timeout:90000});
  await page.waitForSelector('#botWaveEntry',{timeout:30000});
  // The legitimate product control must be mounted WITHOUT mutating the
  // Gold shell source (CP16 checks the immutable bytes).
  await page.$eval('#freeBattle',el=>el.click());
  await page.waitForSelector('#modeSelectScreen[aria-hidden="false"]',{timeout:15000}).catch(()=>{});
  await page.waitForFunction(()=>{
    const el=document.getElementById('botWaveEntry');
    if(!el)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return r.width>100&&r.height>35&&s.display!=='none'&&s.visibility!=='hidden';
  },{timeout:20000});
  await page.screenshot({path:path.join(output,view.name+'-mode-entry.png')});
  await page.$eval('#botWaveEntry',el=>el.click());
  await page.waitForFunction(()=>location.pathname==='/bot-wave/index.html',{timeout:30000});
  await page.waitForSelector('#wave',{timeout:10000});
  const status=await page.evaluate(()=>({
   pathname:location.pathname,
   hasFullFrame:document.querySelector('#wave')!==null,
   hasHome:document.querySelector('#return')!==null,
   assetNotice:document.querySelector('#info')?.textContent||''
  }));
  assert.equal(status.pathname,'/bot-wave/index.html');
  assert.equal(status.hasFullFrame,true);
  assert.equal(status.hasHome,true);
  assert.deepEqual(errors,[],'Browser errors '+JSON.stringify(errors));
  console.log('BOXE R5 mode launch PASS',view.name,status);
 }finally{await page.close();}
}
await browser.close();
