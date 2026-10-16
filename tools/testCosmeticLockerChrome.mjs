import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
if(!process.env.CHROME_PATH)throw Error('CHROME_PATH required');
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
const start=process.env.APEX_APP_URL||'http://127.0.0.1:4173/';
const testCases=[{name:'desktop',width:1440,height:900},{name:'mobile-android',width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2,ua:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'}];
let fails=0;
async function gameFrame(page){
 await page.waitForFunction(()=>!!(document.getElementById('gold-document')?.contentDocument||document).getElementById('apex-boot-start'),{timeout:90000});
 const url=await page.evaluate(()=>(document.getElementById('gold-document')?.contentDocument||document).URL);
 const frame=page.frames().find(f=>f.url()===url);
 assert.ok(frame,'actual Gold game frame absent '+url);return frame;
}
async function openArchive(frame){
 await frame.click('#apex-boot-start');
 await frame.waitForSelector('.apex-skin-entry',{visible:true,timeout:55000});
 await frame.click('.apex-skin-entry');
 await frame.waitForSelector('#fa3-title',{visible:true,timeout:50000});
}
async function chooseWeapon(frame){
 await frame.$eval('.fa3-primary button:last-child',e=>e.click());
 await frame.waitForFunction(()=>!!window.APEX_ARSENAL_CONFIG?.WEAPONS&&Object.keys(window.APEX_ARSENAL_CONFIG.WEAPONS).length>10,{timeout:22000});
 // Mobile-only overlay, harmless on desktop; no scrolling in either.
 await frame.$eval('.fa3-detail-tabs button:last-child',e=>e.click());
 await frame.focus('.fa3-index input');
 await frame.$eval('.fa3-index input',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}))});
 await frame.type('.fa3-index input','RPG');
 await frame.waitForFunction(()=>[...document.querySelectorAll('.fa3-index-list button')].some(e=>e.textContent.includes('RPG-7')),{timeout:15000});
 const matches=await frame.evaluate(()=>[...document.querySelectorAll('.fa3-index-list button')].map(x=>x.textContent));
 assert.ok(matches.length>=1&&matches.every(x=>/RPG/i.test(x)), 'RPG weapon search did not narrow catalog');
 await frame.evaluate(()=>[...document.querySelectorAll('.fa3-index-list button')].find(x=>x.textContent.includes('RPG-7'))?.click());
 await frame.waitForFunction(()=>document.querySelector('.fa3-record-top h3')?.textContent==='RPG-7',{timeout:15000});
 await frame.$eval('.fa3-detail-tabs button:first-child',e=>e.click());
 return matches;
}
try{
 for(const v of testCases){
  // Desktop and Android must start in isolated browser profiles; the
  // synthetic 'qa-alt' storage from one case must not pre-equip the other.
  const context=await browser.createBrowserContext();
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.setViewport({width:v.width,height:v.height,isMobile:!!v.isMobile,hasTouch:!!v.hasTouch,deviceScaleFactor:v.deviceScaleFactor||1});
   if(v.ua)await page.setUserAgent(v.ua);
   await page.goto(start,{waitUntil:'domcontentloaded',timeout:70000});
   const game=await gameFrame(page);
   const hidden=await game.evaluate(()=>{
    const el=document.querySelector('.apex-skin-entry');if(!el)return true;
    const css=getComputedStyle(el);return css.visibility==='hidden'||css.display==='none';
   });
   assert.equal(hidden,true,'Archive entry visible before START');
   await openArchive(game);
   const names=await game.$$eval('.fa3-index-list button',els=>els.map(e=>e.textContent.trim()));
   // A viewport-locked mobile folio intentionally pages the six fighters
   // into three per page. The registry truth remains SIX; avoid demanding a
   // vertically scrolling six-row index on a 390px phone.
   const count=await game.$eval('.fa3-index-head',e=>e.textContent);
   assert.match(count,/07 FILES/,'Six original fighters plus BOXE must exist in registry');
   assert.equal(names.length,v.width<540?3:6,'first no-scroll fighter folio retains six-per-page desktop / three-per-page mobile capacity');
   await game.$eval('.fa3-players button:last-child',e=>e.click());
   const side=await game.$eval('.fa3-equip-state',e=>e.textContent);
   assert.match(side,/PLAYER 02/,'P2 owner not selected');
   const matches=await chooseWeapon(game);
   const before=await game.evaluate(()=>window.APEX_COSMETICS.selected('p2','weapon','RPG_7').id);
   assert.equal(before,'default');
   await game.evaluate(()=>window.APEX_COSMETICS.register({
    kind:'weapon',baseId:'RPG_7',id:'qa-alt',label:'QA ALT',
    detail:'QA-only owner skin',render:{projectile:()=>false}
   }));
   // Two default skins were ALREADY visible. Wait for the third registered
   // pack to appear in the pagination control; otherwise a fast desktop can
   // attempt to click before React's subscribe notification finishes painting.
   await game.waitForSelector('.fa3-skin-pager button:last-child',{visible:true,timeout:15000});
   await game.$eval('.fa3-skin-pager button:last-child',e=>e.click());
   await game.waitForFunction(()=>[...document.querySelectorAll('.fa3-skin')].some(e=>e.textContent.includes('QA ALT')),{timeout:10000});
   await game.evaluate(()=>[...document.querySelectorAll('.fa3-skin')].find(e=>e.textContent.includes('QA ALT')).click());
   const still=await game.evaluate(()=>window.APEX_COSMETICS.selected('p2','weapon','RPG_7').id);
   assert.equal(still,'default','PREVIEW alone must never equip skin');
   await game.$eval('.fa3-equip',e=>e.click());
   const proof=await game.evaluate(()=>({
    p1:window.APEX_COSMETICS.selected('p1','weapon','RPG_7').id,
    p2:window.APEX_COSMETICS.selected('p2','weapon','RPG_7').id,
    stored:JSON.parse(localStorage.getItem('apexChaos.cosmeticLoadout.v1'))?.p2?.weapon?.RPG_7
   }));
   assert.deepEqual(proof,{p1:'default',p2:'qa-alt',stored:'qa-alt'},'P2 equip/write isolated and persistent');
   await game.$eval('.fa3-close',e=>e.click());
   await game.waitForSelector('.apex-skin-entry',{visible:true,timeout:15000});
   await game.$eval('.apex-skin-entry',e=>e.click());
   await game.waitForSelector('#fa3-title',{visible:true,timeout:30000});
   assert.equal(await game.evaluate(()=>window.APEX_COSMETICS.selected('p2','weapon','RPG_7').id),'qa-alt');
   // New process: registered synthetic pack is absent until runtime re-registers.
   await page.reload({waitUntil:'domcontentloaded',timeout:70000});
   const next=await gameFrame(page);
   await next.waitForFunction(()=>!!window.APEX_COSMETICS,{timeout:20000});
   const cold=await next.evaluate(()=>{
    const C=window.APEX_COSMETICS;
    return {
     storage:JSON.parse(localStorage.getItem('apexChaos.cosmeticLoadout.v1'))?.p2?.weapon?.RPG_7,
     p1:C.selected('p1','weapon','RPG_7').id,p2:C.selected('p2','weapon','RPG_7').id
    };
   });
   assert.deepEqual(cold,{storage:'qa-alt',p1:'default',p2:'default'},'Cold boot must fail closed without losing cosmetic intent');
   const registered=await next.evaluate(()=>{
    const C=window.APEX_COSMETICS;
    C.register({kind:'weapon',baseId:'RPG_7',id:'qa-alt',label:'QA ALT',detail:'Re-registration QA',render:{projectile:()=>false}});
    return {
     p1:C.selected('p1','weapon','RPG_7').id,p2:C.selected('p2','weapon','RPG_7').id,
     stored:JSON.parse(localStorage.getItem('apexChaos.cosmeticLoadout.v1'))?.p2?.weapon?.RPG_7
    };
   });
   assert.deepEqual(registered,{p1:'default',p2:'qa-alt',stored:'qa-alt'},'Late registration must restore saved skin only to P2');
   await openArchive(next);
   await next.$eval('.fa3-players button:last-child',e=>e.click());
   await chooseWeapon(next);
   const restored=await next.$eval('.fa3-equip-state',e=>e.textContent);
   assert.ok(restored.includes('QA ALT'),'Field Archive does not show rehydrated P2 choice: '+restored);
   assert.deepEqual(errors,[],'runtime errors');
   console.log('PASS FIELD ARCHIVE COSMETIC '+v.name+' '+JSON.stringify({heroCount:names.length,foundWeapons:matches.length,proof,restored}));
  }catch(e){fails++;console.error('FAIL FIELD ARCHIVE COSMETIC '+v.name,String(e?.stack||e),errors);
   const diag=await page.evaluate(()=>({url:location.href,hasArchive:!!document.querySelector('.fa3-shell'),stage:document.querySelector('#stage')?.className})).catch(()=>({}));
   console.error('DIAGNOSTIC',diag);
  }finally{await page.close();await context.close()}
 }
}finally{await browser.close()}
if(fails)process.exit(1);
console.log('FIELD ARCHIVE COSMETIC CONTRACT Chrome desktop/Android PASS');
