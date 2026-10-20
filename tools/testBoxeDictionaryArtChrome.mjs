// Real user-facing BOXE Dictionary and Fighter Pick art gate.
// Unlike contract-only tests this checks decoded, visible images in Chromium.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const chrome=process.env.CHROME_PATH;
if(!chrome)throw Error('CHROME_PATH is required');
const browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
const url=process.env.APEX_APP_URL||'http://127.0.0.1:4173/';
const dir=path.resolve('docs/boxe/dictionary-art-chrome');
fs.mkdirSync(dir,{recursive:true});
const roster=['NEWBOT','HUNTER','CRYSTALA','MAGNET','FROST','MIRROR','BOXE'];
const views=[{name:'desktop',width:1440,height:900},{name:'mobile-landscape',width:844,height:390,isMobile:true,hasTouch:true}];
const results=[];
try {
 for(const view of views){
  const page=await browser.newPage();
  const errors=[],badAssets=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('response',r=>{if(r.status()>=400&&/\/assets\/(dictionary|gold-ui)\/heroes\//.test(r.url()))badAssets.push({status:r.status(),url:r.url()})});
  try{
   await page.setViewport({...view,deviceScaleFactor:1});
   // A1 production economy: a fresh profile owns NEWBOT only (proven by the
   // A1 gates), so the BOXE Fighter Pick card is locked for it. This art
   // gate must actually SELECT BOXE, so its fixture is a legitimate saved
   // profile that already owns him — the state a real player reaches via
   // Lucky Draw/Shop. (Dictionary browsing above needs no ownership.)
   await page.evaluateOnNewDocument(()=>{
    localStorage.setItem('apexChaos.arsenalMeta.v1',JSON.stringify({
     version:1,credits:425,ownedFighters:['ROBOT','BOXE'],
     lastSelectedP1:'ROBOT',lastSelectedP2:'ROBOT',totalSpins:1,
     unlockedAt:{ROBOT:0,BOXE:1},arenaPaletteId:null,claimedMatchIds:[],
    }));
   });
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:65000});
   await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
   await page.click('#apex-boot-start');
   await page.waitForFunction(()=>!document.getElementById('apex-boot-start')&&!window.APEX_SCENE_TRANSITION?.active?.(),{timeout:90000});
   await page.waitForSelector('#apexDictionaryOpen',{visible:true,timeout:30000});
   await page.$eval('#apexDictionaryOpen',el=>el.click());
   await page.waitForSelector('.fa3-shell',{visible:true,timeout:90000});
   await page.waitForFunction(()=>document.querySelector('.fa3-record-top h3')?.textContent==='NEWBOT',{timeout:40000});
   await page.evaluate(()=>[...document.querySelectorAll('.fa3-detail-tabs button')].find(b=>b.textContent.trim()==='INFO')?.click());
   for(let i=0;i<roster.length;i++){
    const name=roster[i];
    await page.waitForFunction(expected=>document.querySelector('.fa3-record-top h3')?.textContent?.trim()===expected,{timeout:25000},name);
    await page.waitForFunction(()=>{
     const icons=[...document.querySelectorAll('.fa4-readout:not(.fa4-compact) .fa4-skill-portrait img')];
     const art=document.querySelector('.fa3-hero-img');
     return icons.length===3&&icons.every(im=>im.complete&&im.naturalWidth>0&&im.naturalHeight>0)
       &&art?.complete&&art.naturalWidth>0&&getComputedStyle(art).opacity!=='0';
    },{timeout:35000});
    const data=await page.evaluate(()=>({
     hero:document.querySelector('.fa3-record-top h3')?.textContent?.trim(),
     art:document.querySelector('.fa3-hero-img')?.getAttribute('src'),
     icons:[...document.querySelectorAll('.fa4-readout:not(.fa4-compact) .fa4-skill-portrait img')].map(im=>({src:im.getAttribute('src'),w:im.naturalWidth,h:im.naturalHeight})),
     slots:[...document.querySelectorAll('.fa4-readout:not(.fa4-compact) .fa4-skill-portrait')].map(x=>x.getAttribute('aria-label'))
    }));
    assert.equal(data.hero,name);
    assert.equal(data.icons.length,3,name+' missing skill icon');
    assert.equal(data.slots.length,3,name+' missing skill buttons');
    if(name==='BOXE'){
     assert.equal(data.art,'/assets/dictionary/heroes/boxe/standing.png');
     assert.deepEqual(data.icons.map(x=>x.src),['/assets/dictionary/heroes/boxe/passive.png','/assets/dictionary/heroes/boxe/a1.png','/assets/dictionary/heroes/boxe/a2.png']);
     await page.screenshot({path:path.join(dir,view.name+'-boxe-dictionary.png')});
    }
    results.push({view:view.name,...data});
    if(i+1<roster.length)await page.$eval('.fa3-record-navigation button:last-of-type',el=>el.click());
   }
   await page.$eval('.fa3-close',el=>el.click());
   await page.waitForFunction(()=>!document.querySelector('.fa3-shell'),{timeout:12000});
   await page.$eval('#freeBattle',el=>el.click());
   await page.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-mode'),{timeout:30000});
   await page.$eval('.modeCard[data-mode="bot"]',el=>el.click());
   await page.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-fighter'),{timeout:30000});
   await page.waitForSelector('.rosterCard[data-hero="boxe"]',{visible:true,timeout:20000});
   await page.$eval('.rosterCard[data-hero="boxe"]',el=>el.click());
   await page.waitForFunction(()=>document.querySelector('#p1Name')?.textContent?.trim()==='BOXE',{timeout:20000});
   const pick=await page.evaluate(async()=>{
    const r=window.APEX_GOLD_ROSTER?.boxe||null;
    if(!r)return null;
    const src=[r.portrait,r.art,r.battleAvatar,...(r.skillIcons||[])];
    const decoded=await Promise.all(src.map(url=>new Promise(resolve=>{
     const image=new Image();image.onload=()=>resolve({url,w:image.naturalWidth,h:image.naturalHeight});image.onerror=()=>resolve({url,w:0,h:0});image.src=url;
    })));
    return {decoded,roster:document.querySelector('.rosterCard[data-hero="boxe"]')?.outerHTML.slice(0,140)};
   });
   assert.ok(pick,'BOXE missing Gold Fighter Pick roster');
   assert.equal(pick.decoded.length,6,'BOXE missing Gold presentation roles');
   assert.ok(pick.decoded.every(x=>x.w>0&&x.h>0),'BOXE Fighter Pick/HUD artwork decode failure: '+JSON.stringify(pick.decoded));
   assert.deepEqual(errors,[],'browser JavaScript errors');
   assert.deepEqual(badAssets,[],'asset HTTP failures');
   await page.screenshot({path:path.join(dir,view.name+'-boxe-fighter-pick.png')});
   results.push({view:view.name,screen:'fighter-pick',assets:pick.decoded});
   console.log('BOXE DICTIONARY + FIGHTER PICK REAL IMAGE PASS',view.name,results.filter(x=>x.view===view.name).length);
  }catch(e){
   await page.screenshot({path:path.join(dir,view.name+'-FAIL.png')}).catch(()=>{});
   console.error('BOXE DICTIONARY ART FAIL',view.name,String(e.stack||e),JSON.stringify({errors,badAssets}));
   throw e;
  }finally{await page.close()}
 }
 fs.writeFileSync(path.join(dir,'receipt.json'),JSON.stringify({status:'PASS',results},null,2));
}finally{await browser.close()}
