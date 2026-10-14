import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
const url=process.env.APEX_APP_URL||'http://127.0.0.1:4173/';
const output=path.resolve('docs/field-archive/pick-quick-equip');
fs.mkdirSync(output,{recursive:true});
const reports=[];
try {
 for(const v of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844,isMobile:true,hasTouch:true}]){
  const page=await browser.newPage();
  await page.setViewport({...v,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:65000});
   await page.waitForSelector('#apex-boot-start',{visible:true,timeout:85000});
   await page.click('#apex-boot-start');
   await page.waitForFunction(()=>!document.getElementById('apex-boot-start')&&!window.APEX_SCENE_TRANSITION?.active?.(),{timeout:85000});
   await page.$eval('#freeBattle',e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-mode'),{timeout:40000});
   await page.$eval('.modeCard[data-mode="bot"]',e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-fighter'),{timeout:40000});
   await page.waitForSelector('.fa3-pick-equip-entry',{visible:true,timeout:15000});
   const button=await page.$eval('.fa3-pick-equip-entry',el=>{
    const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
    return {box:r.toJSON(),hit:document.elementFromPoint(x,y)?.closest('.fa3-pick-equip-entry')===el};
   });
   assert.ok(button.hit&&button.box.width>=25&&button.box.height>=12,'Gold Pick button not reachable '+JSON.stringify(button));
   await page.screenshot({path:path.join(output,v.name+'-pick.jpg'),type:'jpeg',quality:82});
   const preClick=await page.evaluate(()=>{
    const stage=document.getElementById('stage');
    const label=document.getElementById('p1Name')?.textContent?.trim();
    return {stage:stage?.className,p1Name:label,p2Name:document.getElementById('p2Name')?.textContent?.trim(),
      activeTransition:!!window.APEX_SCENE_TRANSITION?.active?.(),
      button:!!document.querySelector('.fa3-pick-equip-entry')};
   });
   console.log('C03 QUICK PICK BEFORE CLICK',v.name,preClick);
   await page.$eval('.fa3-pick-equip-entry',e=>e.click());
   try{await page.waitForSelector('.fa3-shell',{visible:true,timeout:18000});}
   catch(e){
    const post=await page.evaluate(()=>({
     stage:document.getElementById('stage')?.className,
     p1:document.getElementById('p1Name')?.textContent?.trim(),
     p2:document.getElementById('p2Name')?.textContent?.trim(),
     overlay:!!document.querySelector('.fa3-shell'),
     error:document.querySelector('.apex-skin-error')?.textContent?.trim(),
     button:document.querySelector('.fa3-pick-equip-entry')?.outerHTML?.slice(0,300),
     activeTransition:!!window.APEX_SCENE_TRANSITION?.active?.(),
    }));
    console.log('C03 QUICK PICK FAILED TO OPEN',v.name,post);
    throw e;
   }
   assert.equal(await page.$eval('.fa3-record-top h3',e=>e.textContent),'NEWBOT','Pick opener not on selected hero');
   assert.ok((await page.$eval('.fa3-players button[aria-pressed="true"]',e=>e.textContent)).includes('P1'));
   await page.evaluate(()=>[...document.querySelectorAll('.fa3-skin')].find(b=>b.textContent.includes('ECOBOT'))?.click());
   await page.$eval('.fa3-equip',e=>e.click());
   const equipped=await page.evaluate(()=>JSON.parse(localStorage.getItem('apexChaos.cosmeticLoadout.v1')));
   assert.equal(equipped.p1.hero.ROBOT,'ecobot','P1 pick-time Equip not written to real authority');
   await page.$eval('.fa3-close',e=>e.click());
   await page.waitForFunction(()=>!document.querySelector('.fa3-shell'));
   await page.$eval('.rosterCard[data-hero="hunter"]',e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#p1Name')?.textContent.trim()==='HUNTER',{timeout:13000});
   await page.$eval('.fa3-pick-equip-entry',e=>e.click());
   await page.waitForSelector('.fa3-shell',{visible:true,timeout:16000});
   assert.equal(await page.$eval('.fa3-record-top h3',e=>e.textContent),'HUNTER','Pick-time switch remains bound to previous hero');
   await page.$eval('.fa3-close',e=>e.click());
   await page.waitForFunction(()=>!document.querySelector('.fa3-shell'));
   await page.$eval('#lockIn',e=>e.click());
   await page.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('fighter-active-p2'),{timeout:20000});
   const cpuName=await page.$eval('#p2Name',e=>e.textContent.trim());
   await page.$eval('.fa3-pick-equip-entry',e=>e.click());
   await page.waitForSelector('.fa3-shell',{visible:true,timeout:15000});
   const p2=await page.evaluate(()=>({
    hero:document.querySelector('.fa3-record-top h3')?.textContent,
    side:document.querySelector('.fa3-players button[aria-pressed="true"]')?.textContent,
    original:document.querySelector('.fa3-equip-state')?.textContent
   }));
   assert.equal(p2.hero,cpuName,'Quick Equip BOT hero mismatch');
   assert.ok(p2.side.includes('P2')&&p2.original.includes('ORIGINAL'),'BOT P2 identity/skin leaked');
   assert.deepEqual(errors,[],'Pick Quick Equip browser errors');
   await page.screenshot({path:path.join(output,v.name+'-p2-archive.jpg'),type:'jpeg',quality:82});
   await page.$eval('.fa3-close',e=>e.click());
   reports.push({v:v.name,button,p1Skin:equipped.p1.hero.ROBOT,p2,p2Hero:cpuName});
   console.log('FIELD ARCHIVE PICK QUICK EQUIP PASS',v.name);
  }catch(e){
   await page.screenshot({path:path.join(output,v.name+'-FAIL.jpg'),type:'jpeg',quality:80}).catch(()=>{});
   throw Error('Quick Equip '+v.name+': '+String(e)+' page errors '+errors.join(';'));
  }finally{await page.close()}
 }
 fs.writeFileSync(path.join(output,'qa-receipt.json'),JSON.stringify({status:'PASS',reports},null,2)+'\n');
}finally{await browser.close()}
