import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
const url=process.env.APEX_APP_URL||'http://127.0.0.1:4173/';
const dir=path.resolve('docs/field-archive/candidate03');
fs.mkdirSync(dir,{recursive:true});
const views=[
 {name:'desktop',width:1440,height:900,deviceScaleFactor:1},
 {name:'tablet',width:768,height:1024,deviceScaleFactor:1},
 {name:'mobile',width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true},
 {name:'small-mobile',width:320,height:568,deviceScaleFactor:1,isMobile:true,hasTouch:true},
 {name:'landscape',width:844,height:390,deviceScaleFactor:1,isMobile:true,hasTouch:true}
];
const reports=[];
try{
 for(const v of views){
  const page=await browser.newPage();await page.setViewport(v);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  page.on('response',r=>{if(r.status()>=400&&/(pick_selected_large|ecobot|FieldArchiveC03|fieldArchiveC03)/.test(r.url()))errors.push('HTTP '+r.status()+':'+r.url())});
  try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:65000});
   await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
   await page.click('#apex-boot-start');
   await page.waitForFunction(()=>!document.getElementById('apex-boot-start')&&!window.APEX_SCENE_TRANSITION?.active?.(),{timeout:90000});
   await page.waitForSelector('#apexDictionaryOpen',{visible:true,timeout:30000});
   const locked=await page.$eval('#apexDictionaryOpen',el=>({disabled:el.disabled,locked:el.classList.contains('is-locked')}));
   assert.deepEqual(locked,{disabled:false,locked:false},'Gold Dictionary is not a real HOME entry');
   await page.$eval('#apexDictionaryOpen',el=>el.click());
   await page.waitForSelector('.fa3-shell',{visible:true,timeout:90000});
   await page.waitForFunction(()=>document.querySelector('.fa3-index-list button'),{timeout:40000});
   await page.waitForTimeout?.(350).catch?.(()=>{});
   const initial=await page.evaluate(()=>{
    const shell=document.querySelector('.fa3-shell'),controls=['.fa3-primary','.fa3-players','.fa3-center','.fa3-detail','.fa3-equip','.fa3-close'].map(s=>({selector:s,box:document.querySelector(s)?.getBoundingClientRect()?.toJSON()}));
    const doc=document.documentElement,rect=shell.getBoundingClientRect(),equip=document.querySelector('.fa3-equip').getBoundingClientRect();
    const top=equip.top,bottom=equip.bottom;
    return {viewport:{width:innerWidth,height:innerHeight},scrollY,book:{x:rect.x,y:rect.y,w:rect.width,h:rect.height},equip:{top,bottom},
       controlBoxes:controls,hasScroll:document.body.scrollHeight>innerHeight+3&&getComputedStyle(document.body).overflowY!=='hidden',
       originalSrc:document.querySelector('.fa3-hero-img')?.getAttribute('src'),title:document.querySelector('.fa3-record-top h3')?.textContent};
   });
   assert.equal(initial.title,'NEWBOT');
   assert.equal(initial.originalSrc,'/assets/gold-ui/heroes/newbot/pick_selected_large.webp','NEWBOT default must use approved Gold pick art');
   assert.equal(initial.hasScroll,false,'the page scrolls vertically');
   assert.ok(initial.equip.top>=0&&initial.equip.bottom<=v.height+1,'Equip below/above viewport '+JSON.stringify(initial.equip));
   // Geometric and hit-testing regression: short landscape used to hide the
   // second appearance below a decorative field-note. Every skin must be
   // directly clickable, fully above equip/status, and inside its panel.
   const skinReach=await page.evaluate(()=>{
     const detail=document.querySelector('.fa3-detail'),equipState=document.querySelector('.fa3-equip-state');
     return [...document.querySelectorAll('.fa3-skin')].map(el=>{
       const r=el.getBoundingClientRect(),cx=(r.left+r.right)/2,cy=(r.top+r.bottom)/2;
       return {label:el.textContent.trim().slice(0,30),
         hit:document.elementFromPoint(cx,cy)?.closest('.fa3-skin')===el,
         over:document.elementFromPoint(cx,cy)?.tagName+' / '+document.elementFromPoint(cx,cy)?.className,
         within:r.top>=detail.getBoundingClientRect().top-1 &&
                r.bottom<=equipState.getBoundingClientRect().top+1,
         equipStateTop:equipState.getBoundingClientRect().top,
         detailTop:detail.getBoundingClientRect().top,
         bounds:r.toJSON()};
     });
   });
   assert.equal(skinReach.length,2,'NEWBOT must expose exactly two registered appearances');
   assert.ok(skinReach.every(s=>s.hit&&s.within),'clipped or occluded appearance: '+JSON.stringify(skinReach));
   // R2 game-art quality contract: the hero circuit must exist on the actual
   // SKINS panel and each node must remain hit-testable in the viewport.
   const web=await page.evaluate(()=>{
    const buttons=[...document.querySelectorAll('.fa3-combat-web-compact .fa3-web-node')];
    return {length:buttons.length,rects:buttons.map(el=>{
      const r=el.getBoundingClientRect(),cx=(r.left+r.right)/2,cy=(r.top+r.bottom)/2;
      return {inScreen:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,
        hit:document.elementFromPoint(cx,cy)?.closest('.fa3-web-node')===el};
    }),readoutVisible:!!document.querySelector('.fa3-readout-embed')};
   });
   assert.equal(web.length,3,'PASSIVE / A1 / A2 spiderweb nodes missing');
   assert.ok(web.rects.every(x=>x.hit&&x.inScreen),'unusable ability web in '+v.name+': '+JSON.stringify(web));
   assert.deepEqual(errors,[],'browser runtime/asset errors');
   await page.screenshot({path:path.join(dir,v.name+'-newbot-original.jpg'),type:'jpeg',quality:85});
   await page.evaluate(()=>document.querySelector('.fa3-detail-tabs button:nth-child(2)').click());
   await page.waitForSelector('.fa3-combat-web:not(.fa3-combat-web-compact)');
   await page.evaluate(()=>document.querySelector('.fa3-combat-web:not(.fa3-combat-web-compact) .fa3-web-node-a2').click());
   const ability=await page.$eval('.fa3-combat-web:not(.fa3-combat-web-compact) .fa3-web-detail',e=>e.textContent);
   assert.ok(ability.includes('VIRTUAL ARMOR'),'A2 click did not update REAL NEWBOT skill info');
   await page.screenshot({path:path.join(dir,v.name+'-newbot-ability-web.jpg'),type:'jpeg',quality:85});
   await page.evaluate(()=>document.querySelector('.fa3-detail-tabs button:first-child').click());
   // IMPORTANT: live registered cosmetic, no fake prototype model.
   const eco=await page.evaluate(()=>[...document.querySelectorAll('.fa3-skin')].find(b=>b.textContent.includes('ECOBOT'))?.textContent);
   assert.ok(eco,'ECOBOT skin registration unavailable');
   await page.evaluate(()=>[...document.querySelectorAll('.fa3-skin')].find(b=>b.textContent.includes('ECOBOT')).click());
   await page.waitForFunction(()=>!!document.querySelector('.fa3-eco'),{timeout:30000});
   await page.screenshot({path:path.join(dir,v.name+'-ecobot.jpg'),type:'jpeg',quality:85});
   await page.click('.fa3-equip');
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('apexChaos.cosmeticLoadout.v1')));
   assert.equal(saved.p1.hero.ROBOT,'ecobot','Equip did not persist real P1 skin');
   await page.$eval('.fa3-players button:last-child',b=>b.click());
   let status=await page.$eval('.fa3-equip-state',e=>e.textContent);
   assert.ok(status.includes('ORIGINAL'),'P2 inherited P1 ECOBOT');
   await page.$eval('.fa3-primary button:last-child',b=>b.click());
   await page.waitForFunction(()=>document.querySelector('.fa3-record-top h3')?.textContent?.length>0,{timeout:10000});
   // Find RPG-7 through non-scrolling paging/index. On mobile the INDEX tab reveals this leaf.
   await page.$eval('.fa3-detail-tabs button:last-child',e=>e.click());
   await page.$eval('.fa3-index input',e=>{e.value='RPG';e.dispatchEvent(new Event('input',{bubbles:true}))});
   // React controlled input: use keyboard instead if input value not bound.
   await page.$eval('.fa3-index input',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}))});
   await page.focus('.fa3-index input');await page.keyboard.type('RPG');
   await page.waitForFunction(()=>!![...document.querySelectorAll('.fa3-index-list button')].find(x=>x.textContent.includes('RPG-7')),{timeout:25000});
   await page.evaluate(()=>[...document.querySelectorAll('.fa3-index-list button')].find(x=>x.textContent.includes('RPG-7')).click());
   await page.waitForFunction(()=>document.querySelector('.fa3-record-top h3')?.textContent==='RPG-7',{timeout:10000});
   const facts=await page.evaluate(()=>{document.querySelector('.fa3-detail-tabs button:nth-child(2)').click();return true});
   await page.waitForSelector('.fa3-stat-console:not(.fa3-stat-console-compact)');
   const words=await page.$eval('.fa3-stat-console:not(.fa3-stat-console-compact)',e=>e.textContent);
   assert.ok(['BLAST PEAK','161','PROJECTILE SPEED','420','TOP SPEED','990','BLAST RADIUS','126','ACCELERATION','760'].every(w=>words.includes(w)),
     'RPG-7 INFO must show the exact native weapon parameters (not invented DPS) '+words);
   await page.screenshot({path:path.join(dir,v.name+'-rpg-combat-stats.jpg'),type:'jpeg',quality:85});
   const statsReadable=await page.evaluate(()=>{
    const body=document.querySelector('.fa3-detail').getBoundingClientRect();
    return [...document.querySelectorAll('.fa3-stat-console:not(.fa3-stat-console-compact) .fa3-metric')].map(el=>{
      const b=el.getBoundingClientRect(),x=(b.left+b.right)/2,y=(b.top+b.bottom)/2;
      return {name:el.textContent.slice(0,23),visible:b.top>=body.top-1&&b.bottom<=body.bottom+1,
        inViewport:b.top>=0&&b.bottom<=innerHeight+1,hit:!!document.elementFromPoint(x,y)?.closest('.fa3-stat-console')};
    });
   });
   assert.ok(statsReadable.length>=5&&statsReadable.every(s=>s.visible&&s.inViewport&&s.hit),
     'Weapon combat telemetry clipped in '+v.name+': '+JSON.stringify(statsReadable));
   await page.$eval('.fa3-detail-tabs button:first-child',e=>e.click());
   await page.evaluate(()=>[...document.querySelectorAll('.fa3-skin')].find(e=>e.textContent.includes('VUA HỀ')).click());
   await page.screenshot({path:path.join(dir,v.name+'-rpg-vua-he.jpg'),type:'jpeg',quality:85});
   await page.click('.fa3-equip');
   const receipt=await page.evaluate(()=>({loadout:JSON.parse(localStorage.getItem('apexChaos.cosmeticLoadout.v1')),equipped:document.querySelector('.fa3-equip-state').textContent,body:document.body.className,
    scrollY,viewport:{width:innerWidth,height:innerHeight},image:document.querySelector('.fa3-weapon-img')?.getAttribute('src'),
    shell:document.querySelector('.fa3-shell')?.getBoundingClientRect().toJSON()}));
   assert.equal(receipt.loadout.p2.weapon.RPG_7,'vua-he','P2 real RPG skin equip not persisted');
   assert.equal(receipt.loadout.p1.weapon?.RPG_7,undefined,'P1 weapon leaked from P2');
   assert.ok(receipt.image?.includes('/assets/skins/rocket-vua-he/launcher.png'),'Gold Vua Hề art not selected');
   assert.deepEqual(errors,[],'actual browser JS errors');
   await page.reload({waitUntil:'domcontentloaded',timeout:65000});
   await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
   await page.click('#apex-boot-start');
   await page.waitForFunction(()=>!document.getElementById('apex-boot-start')&&!window.APEX_SCENE_TRANSITION?.active?.(),{timeout:90000});
   await page.$eval('#apexDictionaryOpen',e=>e.click());
   await page.waitForSelector('.fa3-shell',{visible:true,timeout:90000});
   await page.$eval('.fa3-players button:last-child',e=>e.click());
   await page.$eval('.fa3-primary button:last-child',e=>e.click());
   await page.$eval('.fa3-detail-tabs button:last-child',e=>e.click());
   await page.focus('.fa3-index input');await page.keyboard.type('RPG');
   await page.waitForFunction(()=>!![...document.querySelectorAll('.fa3-index-list button')].find(x=>x.textContent.includes('RPG-7')),{timeout:20000});
   await page.evaluate(()=>[...document.querySelectorAll('.fa3-index-list button')].find(x=>x.textContent.includes('RPG-7')).click());
   const recovered=await page.$eval('.fa3-equip-state',el=>el.textContent);
   assert.ok(recovered.includes('VUA HỀ'),'persisted skin not restored on reload: '+recovered);
   reports.push({v:v.name,status:'PASS',initial,receipt:{equipped:receipt.equipped,image:receipt.image,restored:recovered},errors});
   console.log('FIELD ARCHIVE C03 CHROME PASS',v.name,'P1-ECOBOT P2-VUA-HE no-scroll, reload persisted');
  }catch(error){await page.screenshot({path:path.join(dir,v.name+'-FAIL.jpg'),fullPage:true,type:'jpeg',quality:80}).catch(()=>{});
   console.error('FIELD ARCHIVE C03 CHROME FAIL',v.name,String(error),errors);throw error;
  }finally{await page.close()}
 }
 fs.writeFileSync(path.join(dir,'qa-receipt.json'),JSON.stringify({status:'PASS',reports},null,2));
}finally{await browser.close()}
