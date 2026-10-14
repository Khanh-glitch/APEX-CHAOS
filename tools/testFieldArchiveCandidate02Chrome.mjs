import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const out=path.resolve('docs/field-archive/candidate02');
fs.mkdirSync(out,{recursive:true});
const executablePath=process.env.CHROME_PATH||'/usr/bin/google-chrome';
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--enable-webgl']});
const results=[];
try{
 for(const v of [
  {label:'desktop',width:1440,height:900,deviceScaleFactor:1},
  {label:'mobile',width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true},
 ]){
  const page=await browser.newPage();
  await page.setViewport(v);
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('response',r=>{if(r.status()>=400&&/field-archive|launcher|RPG_7|home-robot-body/.test(r.url()))errors.push('HTTP '+r.status()+' '+r.url())});
  const response=await page.goto('http://127.0.0.1:4173/field-archive.html',{waitUntil:'networkidle2',timeout:60000});
  console.log('C02 INITIAL HTTP',v.label,response?.status(),page.url());
  await new Promise(r=>setTimeout(r,1500));
  const diagnostic=await page.evaluate(()=>({title:document.title,hasArchive:!!document.querySelector('.book'),hasModule:!!document.querySelector('script[type="module"]'),hookType:typeof window.__APEX_FIELD_ARCHIVE_QA__,scriptText:document.querySelector('script[type="module"]')?.textContent?.slice(0,150)}));
  console.log('C02 MODULE DIAGNOSTIC',v.label,diagnostic,'pageErrors',errors);
  if(errors.length||diagnostic.hookType!=='function'){
    await page.screenshot({path:path.join(out,'failure-'+v.label+'.jpg'),type:'jpeg',quality:78,fullPage:true});
    throw Error('C02 module was not executable: '+JSON.stringify({diagnostic,errors}));
  }
  await page.waitForFunction(()=>window.__APEX_FIELD_ARCHIVE_QA__?.().canvasRendered,{timeout:15000});
  await new Promise(r=>setTimeout(r,750));
  const initial=await page.evaluate(()=>{
   const q=window.__APEX_FIELD_ARCHIVE_QA__();
   const c=document.getElementById('heroCanvas'),ct=c.getContext('2d');
   const data=ct.getImageData(0,0,c.width,c.height).data;
   let opaque=0,minX=c.width,minY=c.height,maxX=0,maxY=0;
   for(let y=0;y<c.height;y+=8)for(let x=0;x<c.width;x+=8){
     const a=data[(y*c.width+x)*4+3];
     if(a>12){opaque++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
   }
   const kicker=document.querySelector('.kicker').getBoundingClientRect(),title=document.querySelector('.title').getBoundingClientRect();
   return {q,opaque,paintBounds:{x:minX,y:minY,width:maxX-minX,height:maxY-minY,ratio:(maxX-minX)/c.width},titleCollision:kicker.bottom>title.top+2,
     book:document.querySelector('.book').getBoundingClientRect().toJSON(),pageWidth:document.documentElement.scrollWidth,screenWidth:innerWidth};
  });
  assert.equal(initial.q.kind,'hero');
  assert.equal(initial.q.preview,'ecobot');
  assert.equal(initial.q.goldPrepared,true,'real Gold atlas not prepared');
  assert.equal(initial.q.renderError,'','real Gold painter failed');
  assert.ok(initial.opaque>20,'exact ECOBOT painter produced empty Canvas');
  assert.ok(initial.paintBounds.ratio>.33,'ECOBOT still too small inside right folio: '+JSON.stringify(initial.paintBounds));
  assert.equal(initial.titleCollision,false,'archive record kicker overlaps main title');
  assert.equal(initial.pageWidth<=initial.screenWidth+1,true,'horizontal layout clipped');
  await page.screenshot({path:path.join(out,'archive-'+v.label+'.jpg'),type:'jpeg',quality:82,fullPage:true});
  if(v.label==='mobile'){
    await page.locator('#jumpSkin').click();
    const jump=await page.evaluate(()=>{
      const bar=document.getElementById('cosmeticSelection').getBoundingClientRect();
      return {top:bar.top,bottom:bar.bottom,view:innerHeight,scrollY};
    });
    assert.ok(jump.scrollY>100&&jump.top>=0&&jump.bottom<=jump.view,
      'mobile SKINS jump did not reach usable cosmetic controls: '+JSON.stringify(jump));
    await page.evaluate(()=>scrollTo(0,0));
  }
  await page.locator('button[data-skin="default"]').click();
  const original=await page.evaluate(()=>({view:window.__APEX_FIELD_ARCHIVE_QA__(),imageReady:document.getElementById('originalHero').naturalWidth>0}));
  assert.equal(original.imageReady,true,'original Gold Home asset missing');
  await page.screenshot({path:path.join(out,'original-'+v.label+'.jpg'),type:'jpeg',quality:80,fullPage:true});
  await page.locator('button[data-type="weapon"]').click();
  await page.waitForSelector('#vuaHeWeapon');
  const weapon=await page.evaluate(()=>{
    const img=document.getElementById('vuaHeWeapon'),area=document.getElementById('artArea'),b=img.getBoundingClientRect(),a=area.getBoundingClientRect();
    return {q:window.__APEX_FIELD_ARCHIVE_QA__(),vuaHe:img.naturalWidth>0,
      original:document.getElementById('originalWeapon').naturalWidth>0,
      verticalCenterError:Math.abs((b.top+b.bottom)/2-(a.top+a.bottom)/2)/a.height};
  });
  assert.equal(weapon.q.preview,'vua-he');assert.equal(weapon.vuaHe,true,'Vua He source failed');assert.equal(weapon.original,true,'real RPG original image failed');
  assert.ok(weapon.verticalCenterError<.035,'actual RPG Gold art still pinned to upper edge: '+weapon.verticalCenterError);
  await page.screenshot({path:path.join(out,'rpg-'+v.label+'.jpg'),type:'jpeg',quality:80,fullPage:true});
  await page.locator('#equipBtn').click();
  let actual=await page.evaluate(()=>window.__APEX_FIELD_ARCHIVE_QA__());
  assert.equal(actual.equipped.p1.weapon,'vua-he');
  await page.locator('[data-side="p2"]').click();
  actual=await page.evaluate(()=>window.__APEX_FIELD_ARCHIVE_QA__());
  assert.equal(actual.equipped.p2.weapon,'default');
  assert.equal(actual.preview,'default');
  await page.locator('[data-type="hero"]').click();
  await page.locator('[data-skin="ecobot"]').click();
  await page.locator('#equipBtn').click();
  actual=await page.evaluate(()=>window.__APEX_FIELD_ARCHIVE_QA__());
  assert.equal(actual.equipped.p2.hero,'ecobot');
  assert.equal(actual.equipped.p1.hero,'default');
  assert.deepEqual(errors,[],'runtime/page asset errors');
  results.push({viewport:v.label,hero:initial,weapon:weapon.q,final:actual,errors});
  await page.close();
 }
 fs.writeFileSync(path.join(out,'qa-receipt.json'),JSON.stringify({status:'PASS',views:results},null,2)+'\n');
 console.log('FIELD ARCHIVE C02 ACTUAL GOLD + MOBILE + P1/P2 PASS',results.map(x=>({viewport:x.viewport,paintSamples:x.hero.opaque})));
}catch(error){
 fs.writeFileSync(path.join(out,'qa-failure.json'),JSON.stringify({error:String(error),stack:error?.stack,views:results},null,2));
 throw error;
}finally{await browser.close()}
