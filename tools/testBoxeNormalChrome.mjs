// BOXE native Battle acceptance: original APEX Gold Home -> Fighter Pick ->
// real Arsenal combat in Chrome. No mock damage, no second Gold game engine,
// no HUD artwork requirements (those remain owner-pending).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const CHROME=process.env.CHROME_PATH;
if(!CHROME)throw Error('CHROME_PATH required for native BOXE browser gate');
const url=process.env.APEX_APP_URL||'http://127.0.0.1:4173/';
const out=path.resolve('docs/boxe/normal-browser');
fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:[
 '--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
 '--autoplay-policy=no-user-gesture-required']});
const cases=[
 {id:'desktop-bot',mode:'bot',width:1440,height:900},
 {id:'mobile-local',mode:'local1v1',width:844,height:390,isMobile:true,hasTouch:true}
];
let failures=0;
try{
 for(const test of cases){
  const page=await browser.newPage();
  const errors=[],badAssets=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('response',r=>{if(r.url().includes('/assets/boxe-gold/')&&r.status()>=400)badAssets.push({url:r.url(),status:r.status()});});
  try{
   await page.setViewport({width:test.width,height:test.height,isMobile:!!test.isMobile,hasTouch:!!test.hasTouch,deviceScaleFactor:1});
   await page.goto(url+'?goldViewport=native',{waitUntil:'domcontentloaded',timeout:65000});
   await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
   await page.click('#apex-boot-start');
   await page.waitForFunction(()=>!document.getElementById('apex-boot-start')&&!window.APEX_SCENE_TRANSITION?.active?.(),{timeout:90000});
   await page.click('#freeBattle');
   await page.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-mode'),{timeout:30000});
   await page.$eval('.modeCard[data-mode="'+test.mode+'"]',e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-fighter'),{timeout:30000});
   const card=await page.waitForSelector('.rosterCard[data-hero="boxe"]',{visible:true,timeout:30000});
   assert.ok(card,'BOXE must be in canonical Fighter Pick');
   assert.equal(await page.$eval('.rosterCard[data-hero="boxe"]',e=>e.disabled),false,'BOXE must not be product-locked');
   await card.click();
   await page.waitForFunction(()=>document.querySelector('#p1Name')?.textContent.trim()==='BOXE',{timeout:12000});
   await page.$eval('#lockIn',e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('fighter-active-p2'),{timeout:16000});
   if(test.mode==='local1v1'){
    await page.$eval('.rosterCard[data-hero="boxe"]',e=>e.click());
    await page.waitForFunction(()=>document.querySelector('#p2Name')?.textContent.trim()==='BOXE',{timeout:10000});
   }
   await page.$eval('#lockIn',e=>e.click());
   await page.waitForFunction(()=>{
    const m=window.APEX_HERO_REWORK?.match;
    return !!m?.combatants?.some(x=>x?.heroId==='BOXE')&&
      window.APEX_ARSENAL?.state?.active===true;
   },{timeout:90000});
   await page.waitForFunction(()=>{
    const m=window.APEX_HERO_REWORK?.match;
    const art=window.APEX_BOXE_GOLD_PRESENTATION;
    if(!m||!art?.ready?.())return false;
    const f=(window.fighters||[]).filter(x=>x?.type?.__hrHero==='BOXE');
    return f.length>0&&f.every(x=>art.snapshot(x).exists&&art.snapshot(x).sprites);
   },{timeout:45000});
   const receipt=await page.evaluate(()=>{
    const m=window.APEX_HERO_REWORK.match;
    const f=(window.fighters||[]).filter(x=>x?.type?.__hrHero==='BOXE');
    return {
     mode:window.APEX_ARSENAL?.state?.battleMode||null,
     fighters:m.combatants.map(c=>c.heroId),boxeCount:f.length,
     originalGoldRenderer:window.APEX_BOXE_GOLD_PRESENTATION.version,
     sprites:f.map(x=>window.APEX_BOXE_GOLD_PRESENTATION.snapshot(x)),
     arenaCanvas:!!document.getElementById('game-canvas'),
     rosterCard:!!document.querySelector('.rosterCard[data-hero="boxe"]')
    };
   });
   if(test.mode==='local1v1')assert.equal(receipt.boxeCount,2,'two real local BOXE bodies');
   else assert.equal(receipt.boxeCount,1,'one real BOT Battle BOXE body');
   assert.equal(receipt.arenaCanvas,true);
   assert.deepEqual(badAssets,[],'missing BOXE Gold source PNGs');
   assert.deepEqual(errors,[],'browser JavaScript errors');
   await page.screenshot({path:path.join(out,test.id+'.png')});
   console.log('[BOXE NORMAL CHROME] PASS '+test.id+' '+JSON.stringify(receipt));
  }catch(e){
   failures++;
   console.error('[BOXE NORMAL CHROME] FAIL '+test.id+' '+String(e.stack||e)+'; errors='+JSON.stringify(errors)+'; assets='+JSON.stringify(badAssets));
   await page.screenshot({path:path.join(out,test.id+'-FAIL.png')}).catch(()=>{});
  }finally{await page.close();}
 }
}finally{await browser.close();}
if(failures)process.exit(1);
console.log('[BOXE NORMAL CHROME] both native Gold-to-Arsenal flows PASS');
// Admission also includes actual Archive and Gold Fighter Pick art decoding.
await import('./testBoxeDictionaryArtChrome.mjs');
