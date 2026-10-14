import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const chrome=process.env.CHROME_PATH;
if(!chrome)throw Error('CHROME_PATH required');
const url=process.env.APEX_APP_URL||'http://127.0.0.1:4173/';
const browser=await puppeteer.launch({executablePath:chrome,headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
  '--autoplay-policy=no-user-gesture-required'
]});
const variants=[
  {name:'desktop',width:1440,height:900},
  {name:'mobile-android',width:390,height:844,isMobile:true,hasTouch:true,
    deviceScaleFactor:2,ua:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'},
];
let failed=0;
try{
 for(const test of variants){
  const page=await browser.newPage(),errors=[];
  try{
    await page.setViewport({width:test.width,height:test.height,isMobile:!!test.isMobile,
      hasTouch:!!test.hasTouch,deviceScaleFactor:test.deviceScaleFactor||1});
    if(test.ua)await page.setUserAgent(test.ua);
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:50000});
    // Android Gold Fidelity mounts the actual game into a SAME-ORIGIN iframe.
    // Exercise the actual destination document rather than the empty wrapper.
    await page.waitForFunction(()=>{
      const doc=document.getElementById('gold-document')?.contentDocument||document;
      return !!doc.getElementById('apex-boot-start');
    },{timeout:65000});
    const gameUrl=await page.evaluate(()=>
      (document.getElementById('gold-document')?.contentDocument||document).URL);
    const game=page.frames().find(f=>f.url()===gameUrl);
    assert.ok(game,'Gold game frame unavailable: '+gameUrl);
    const launcherHidden=await game.evaluate(()=>{
      const el=document.querySelector('.apex-skin-entry');
      if(!el)return true; // home launcher need not be mounted before START
      const css=getComputedStyle(el);
      return css.display==='none'||css.visibility==='hidden';
    });
    assert.equal(launcherHidden,true,'SKINS must not be clickable during boot START');
    await game.click('#apex-boot-start');
    await game.waitForSelector('.apex-skin-entry',{visible:true,timeout:45000});
    await game.click('.apex-skin-entry');
    await game.waitForSelector('#apex-cosmetics-title',{visible:true,timeout:20000});
    const heroCount=await game.$$eval('.apex-cosmetics-item',x=>x.length);
    assert.equal(heroCount,6,'Fighter category must show every current playable hero');
    await game.click('.apex-cosmetics-sides button:nth-child(2)');
    const p2=await game.$eval('.apex-cosmetics-loaded',x=>x.textContent);
    assert.match(p2,/02/,'P2 loadout independent category');
    await game.click('.apex-cosmetics-tabs button:nth-child(2)');
    await game.waitForFunction(()=>document.querySelectorAll('.apex-cosmetics-item').length>10,
      {timeout:10000});
    const weapons=await game.$$eval('.apex-cosmetics-item',nodes=>nodes.map(n=>n.innerText));
    assert.ok(weapons.some(x=>x.includes('RPG')),'RPG_7 must be discoverable from live gun config');
    const searchInput=await game.$('#apex-cosmetics-search');
    assert.ok(searchInput,'Skin search not mounted in the active Gold game frame');
    await searchInput.click();
    await searchInput.type('RPG');
    const searchProbe=await game.evaluate(()=>({
      value:document.querySelector('#apex-cosmetics-search')?.value,
      items:[...document.querySelectorAll('.apex-cosmetics-item')].map(e=>e.innerText).slice(0,12),
      category:document.querySelector('[role=tab][aria-selected=true]')?.textContent
    }));
    console.log('COSMETIC SEARCH '+test.name+' '+JSON.stringify(searchProbe));
    assert.equal(searchProbe.value,'RPG','real keyboard search input did not receive keys');
    assert.ok(searchProbe.items.length>0 && searchProbe.items.length<weapons.length &&
      searchProbe.items.every(e=>/RPG/i.test(e)),
      'real search should narrow to RPG family: '+JSON.stringify(searchProbe));
    const current=await game.$eval('.apex-cosmetics-item',e=>e.innerText);
    assert.match(current,/RPG/i);
    await game.click('.apex-cosmetics-item');
    assert.equal(await game.$eval('.apex-cosmetics-skin.selected',e=>e.innerText.includes('ORIGINAL')),true);
    await game.evaluate(()=>{
      window.APEX_COSMETICS.register({
        kind:'weapon',baseId:'RPG_7',id:'qa-alt',label:'QA ALT',
        detail:'Read-only synthetic skin manifest for UI regression',render:{projectile:()=>false}
      });
    });
    await game.waitForFunction(()=>document.querySelectorAll('.apex-cosmetics-skin').length>=3,
      {timeout:10000});
    await game.evaluate(()=>{const node=[...document.querySelectorAll('.apex-cosmetics-skin')].find(el=>el.innerText.includes('QA ALT'));if(!node)throw Error('QA ALT skin entry missing');node.click()});
    assert.equal(await game.$eval('.apex-cosmetics-skin.selected strong',n=>n.textContent),'QA ALT');
    const sideProof=await game.evaluate(()=>({
      p2:window.APEX_COSMETICS.selected('p2','weapon','RPG_7').id,
      p1:window.APEX_COSMETICS.selected('p1','weapon','RPG_7').id,
      stored:JSON.parse(localStorage.getItem('apexChaos.cosmeticLoadout.v1'))?.p2?.weapon?.RPG_7
    }));
    assert.deepEqual(sideProof,{p2:'qa-alt',p1:'default',stored:'qa-alt'},
      'synthetic P2 visual selection must not mutate P1 and must persist');
    await game.click('.apex-cosmetics-close');
    await game.waitForSelector('.apex-skin-entry',{visible:true});
    await game.click('.apex-skin-entry');
    await game.waitForSelector('#apex-cosmetics-title',{visible:true});
    assert.equal(await game.evaluate(()=>window.APEX_COSMETICS.selected('p2','weapon','RPG_7').id),'qa-alt');
    // Full process reload: the loadout is restored from persistent storage
    // BEFORE the asynchronous cosmetic pack has registered. Unavailable skins
    // must display ORIGINAL temporarily without deleting the saved choice;
    // registering the same pack must reactivate P2 independently of P1.
    await page.reload({waitUntil:'domcontentloaded',timeout:50000});
    await page.waitForFunction(()=>{
      const doc=document.getElementById('gold-document')?.contentDocument||document;
      return !!doc.getElementById('apex-boot-start')
        && !!doc.defaultView?.APEX_COSMETICS;
    },{timeout:85000});
    const nextURL=await page.evaluate(()=>
      (document.getElementById('gold-document')?.contentDocument||document).URL);
    const resumed=page.frames().find(f=>f.url()===nextURL);
    assert.ok(resumed,'Cold-reload game frame missing: '+nextURL);
    const beforePack=await resumed.evaluate(()=>{
      const C=window.APEX_COSMETICS;
      return {
        storage:JSON.parse(localStorage.getItem('apexChaos.cosmeticLoadout.v1'))?.p2?.weapon?.RPG_7,
        effectiveP1:C.selected('p1','weapon','RPG_7').id,
        effectiveP2:C.selected('p2','weapon','RPG_7').id
      };
    });
    assert.deepEqual(beforePack,{storage:'qa-alt',effectiveP1:'default',effectiveP2:'default'},
      'Cold boot must preserve unavailable cosmetic intent but fail closed to ORIGINAL');
    const afterPack=await resumed.evaluate(()=>{
      const C=window.APEX_COSMETICS;
      C.register({
        kind:'weapon',baseId:'RPG_7',id:'qa-alt',label:'QA ALT',
        detail:'Read-only synthetic skin manifest for reload regression',
        render:{projectile:()=>false}
      });
      return {
        p1:C.selected('p1','weapon','RPG_7').id,
        p2:C.selected('p2','weapon','RPG_7').id,
        stored:JSON.parse(localStorage.getItem('apexChaos.cosmeticLoadout.v1'))?.p2?.weapon?.RPG_7
      };
    });
    assert.deepEqual(afterPack,{p1:'default',p2:'qa-alt',stored:'qa-alt'},
      'Late registration must restore exactly the previously selected P2 skin');
    await resumed.click('#apex-boot-start');
    await resumed.waitForSelector('.apex-skin-entry',{visible:true,timeout:45000});
    await resumed.click('.apex-skin-entry');
    await resumed.waitForSelector('#apex-cosmetics-title',{visible:true,timeout:20000});
    await resumed.click('.apex-cosmetics-sides button:nth-child(2)');
    await resumed.click('.apex-cosmetics-tabs button:nth-child(2)');
    await resumed.waitForFunction(()=>document.querySelectorAll('.apex-cosmetics-item').length>10,
      {timeout:12000});
    const resumedChoice=await resumed.evaluate(()=>({
      p2:window.APEX_COSMETICS.selected('p2','weapon','RPG_7').id,
      items:[...document.querySelectorAll('.apex-cosmetics-item')].filter(el=>
        el.innerText.includes('RPG')).map(el=>el.innerText),
    }));
    assert.equal(resumedChoice.p2,'qa-alt');
    assert.ok(resumedChoice.items.some(x=>x.includes('QA ALT')),
      'Cosmetic locker must reflect restored P2 selection after cold reload');
    assert.equal(errors.length,0,'unexpected browser exceptions: '+errors.join(', '));
    console.log('PASS COSMETIC LOCKER '+test.name+' '+JSON.stringify({heroCount,weaponCount:weapons.length,sideProof}));
  }catch(err){
    failed++;console.error('FAIL COSMETIC LOCKER '+test.name+' '+String(err?.stack||err));
    const diagnosis=await page.evaluate(()=>{
      const d=document.getElementById('gold-document')?.contentDocument||document;
      return {url:d.URL,stage:d.querySelector('#stage')?.className,
        title:d.querySelector('#apex-cosmetics-title')?.textContent,
        search:d.querySelector('#apex-cosmetics-search')?.value,
        tab:d.querySelector('[role=tab][aria-selected=true]')?.textContent,
        entries:[...d.querySelectorAll('.apex-cosmetics-item')].slice(0,10).map(e=>e.innerText),
        errors:window.__apexEngineLoadError||null};
    }).catch(e=>({error:String(e)}));
    console.error('COSMETIC FAILURE DIAGNOSTICS '+test.name+' '+JSON.stringify(diagnosis));
  }finally{await page.close()}
 }
}finally{await browser.close()}
if(failed)process.exit(1);
console.log('COSMETIC LOCKER CHROME desktop/mobile PASS');
