// Live Chromium audit of translated Home Missions + Field Archive controls.
// Chromium device metrics are emulated; this is not physical Safari/Android proof.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const CHROME=process.env.CHROME_PATH;
if(!CHROME)throw Error('CHROME_PATH is required for the RA-2 locale panels browser gate');
const base=process.env.APEX_APP_URL||'http://127.0.0.1:5173/';
const views=[
 {name:'desktop',width:1440,height:900,isMobile:false,hasTouch:false},
 {name:'mobile-portrait',width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2},
];
const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
await mkdir('docs/acceptance/ra2/evidence/localization',{recursive:true});
const check=(ok,message,details)=>{console.log((ok?'PASS':'FAIL')+' RA-2 locale panels: '+message+(details===undefined?'':' '+JSON.stringify(details)));assert.ok(ok,message)};
try{
 for(const view of views){
  const context=await browser.createBrowserContext();
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.setViewport({width:view.width,height:view.height,isMobile:view.isMobile,hasTouch:view.hasTouch,deviceScaleFactor:view.deviceScaleFactor||1});
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:70000});
   await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
   await page.click('#apex-boot-start');
   await page.waitForSelector('#freeBattle',{visible:true,timeout:60000});
   await page.waitForFunction(()=>document.body.dataset.apexSceneTransition==='DONE',{timeout:60000});
   await page.evaluate(()=>window.APEX_I18N?.setLanguage('vie'));
   await page.waitForFunction(()=>document.documentElement.lang==='vi',{timeout:10000});

   const missionEntry=await page.$eval('#apexMissionsOpen',e=>({label:e.getAttribute('aria-label'),visible:!!(e.getBoundingClientRect().width&&e.getBoundingClientRect().height)}));
   check(missionEntry.visible,'Missions route is visible '+view.name,missionEntry);
   check(missionEntry.label==='Nhiệm vụ và thành tích','Missions route aria-label is Vietnamese',missionEntry.label);
   await page.click('#apexMissionsOpen');
   await page.waitForSelector('.apex-progress-panel',{visible:true,timeout:15000});
   await page.waitForFunction(()=>document.querySelector('.apex-progress-panel')?.innerText.includes('HỢP ĐỒNG KHỞI ĐẦU'),{timeout:10000});
   const missions=await page.evaluate(()=>({
    title:document.querySelector('.apex-progress-title')?.textContent.trim(),
    dialogLabel:document.querySelector('.apex-progress-overlay')?.getAttribute('aria-label'),
    language:document.documentElement.lang,
    entryLabel:document.querySelector('#apexMissionsOpen')?.getAttribute('aria-label'),
    text:document.querySelector('.apex-progress-panel')?.innerText.slice(0,500),
   }));
   check(missions.title==='KHO TINH THÔNG','Missions title renders VIE '+view.name,missions);
   check(missions.entryLabel==='Nhiệm vụ và thành tích','Missions aria label remains localized while modal is open',missions.entryLabel);
   check(!missions.text.includes('Missions and Achievements'),'no English source aria phrase leaks into visible panel',missions.text);
   await page.screenshot({path:`docs/acceptance/ra2/evidence/localization/${view.name}-missions-vie.png`});
   await page.click('.apex-progress-tabs button:last-child');
   await page.waitForSelector('.apex-mastery-vault',{visible:true,timeout:10000});
   await page.waitForFunction(()=>document.querySelector('.apex-mastery-chapter-toggle')?.getAttribute('aria-expanded')==='true',{timeout:10000});
   const mastery=await page.evaluate(()=>{
    const medal=document.querySelector('.apex-mastery-medal');
    const equip=document.querySelector('.apex-mastery-equip');
    return {
     title:document.querySelector('.apex-progress-title')?.textContent.trim(),
     ecoLabel:document.querySelector('.apex-mastery-goal strong')?.textContent.trim(),
     ecoAria:document.querySelector('.apex-mastery-goal')?.getAttribute('aria-label'),
     tab:[...document.querySelectorAll('.apex-progress-tabs [role=tab]')].map(e=>({text:e.textContent.trim(),selected:e.getAttribute('aria-selected')})),
     empty:document.querySelector('.apex-mastery-recent')?.innerText,
     chapter:document.querySelector('.apex-mastery-chapter-toggle')?.innerText,
     medal:medal?{title:medal.title,aria:medal.getAttribute('aria-label'),text:medal.innerText}:null,
     equip:equip?{text:equip.innerText,disabled:equip.disabled}:null,
     rarityShapes:[...document.querySelectorAll('.apex-mastery-medal')].map(e=>e.getAttribute('data-rarity-shape')),
    };
   });
   check(mastery.title==='KHO TINH THÔNG','Mastery tab title renders VIE '+view.name,mastery.title);
   check(mastery.ecoLabel==='ECOBOT — LÕI TÁI CHẾ V17'&&mastery.ecoAria==='ECOBOT — LÕI TÁI CHẾ V17','Mastery ECOBOT name and aria label are localized '+view.name,mastery);
   check(mastery.tab[1]?.selected==='true'&&mastery.tab[0]?.selected==='false','Mastery tab selection semantics '+view.name,mastery.tab);
   check(mastery.empty?.includes('Chưa có thành tựu chiến đấu'),'Mastery empty/recent state renders VIE '+view.name,mastery.empty);
   check(mastery.medal?.aria.toLocaleLowerCase('vi').includes('đang khóa')&&mastery.medal?.aria.toLocaleLowerCase('vi').includes('huyền thoại'),'Mastery medal aria label includes VIE rarity/status '+view.name,mastery.medal);
   check(/[À-ỹ]/u.test(mastery.medal?.title||''),'Mastery medal title rule is VIE '+view.name,mastery.medal?.title);
   check(mastery.equip?.disabled===true,'locked skin equip remains disabled '+view.name,mastery.equip);
   check(new Set(mastery.rarityShapes).size>=2,'Mastery uses multiple rarity shapes '+view.name,mastery.rarityShapes);
   await page.click('.apex-mastery-chapter-toggle');
   await page.waitForFunction(()=>document.querySelector('.apex-mastery-chapter-toggle')?.getAttribute('aria-expanded')==='false',{timeout:10000});
   await page.click('.apex-mastery-chapter-toggle');
   await page.waitForFunction(()=>document.querySelector('.apex-mastery-chapter-toggle')?.getAttribute('aria-expanded')==='true',{timeout:10000});
   await page.screenshot({path:`docs/acceptance/ra2/evidence/localization/${view.name}-mastery-vie.png`});
   await page.evaluate(()=>window.APEX_I18N?.setLanguage('eng'));
   await page.waitForFunction(()=>document.querySelector('.apex-progress-title')?.textContent.trim()==='MASTERY VAULT',{timeout:10000});
   check(await page.$eval('.apex-mastery-medal',e=>e.title.includes('Deal at least 500 actual damage in one chain')),'Mastery rule title restores English '+view.name);
   check(await page.$eval('.apex-mastery-goal strong',e=>e.textContent.trim()==='ECOBOT — RECYCLE CORE V17'),'Mastery ECOBOT name restores English '+view.name);
   await page.evaluate(()=>window.APEX_I18N?.setLanguage('vie'));
   await page.waitForFunction(()=>document.querySelector('.apex-progress-title')?.textContent.trim()==='KHO TINH THÔNG',{timeout:10000});
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('.apex-progress-panel'),{timeout:10000});
   check(await page.evaluate(()=>document.activeElement?.id)==='apexMissionsOpen','Escape closes Missions and restores focus '+view.name);

   await page.click('#apexDictionaryOpen');
   await page.waitForSelector('.fa3-shell',{visible:true,timeout:60000});
   if(view.isMobile){
    await page.click('.fa3-detail-tabs button:last-child');
    await page.waitForFunction(()=>document.querySelector('.fa3-index')?.classList.contains('fa3-index-active'),{timeout:10000});
    await page.waitForFunction(()=>{const e=document.querySelector('.fa3-index-list button'),r=e?.getBoundingClientRect();return !!r&&r.width>0&&r.height>0},{timeout:15000});
    await page.screenshot({path:`docs/acceptance/ra2/evidence/localization/${view.name}-archive-index-vie.png`});
    await page.click('.fa3-index-list button:first-child');
    await page.waitForFunction(()=>!document.querySelector('.fa3-index')?.classList.contains('fa3-index-active'),{timeout:10000});
   }else await page.waitForSelector('.fa3-index-list button',{visible:true,timeout:30000});
   await page.waitForFunction(()=>document.querySelector('.fa3-primary')?.getAttribute('aria-label')==='Danh mục hồ sơ',{timeout:10000});
   const archive=await page.evaluate(()=>{
    const q=s=>document.querySelector(s);
    const attrs={
     category:q('.fa3-primary')?.getAttribute('aria-label'),
     loadout:q('.fa3-players')?.getAttribute('aria-label'),
     catalogue:q('.fa3-index')?.getAttribute('aria-label'),
     search:q('.fa3-index input')?.getAttribute('aria-label'),
     placeholder:q('.fa3-index input')?.getAttribute('placeholder'),
     previousPage:q('.fa3-pager button:first-child')?.getAttribute('aria-label'),
     nextPage:q('.fa3-pager button:last-child')?.getAttribute('aria-label'),
     previousRecord:q('.fa3-record-navigation button:first-child')?.getAttribute('aria-label'),
     nextRecord:q('.fa3-record-navigation button:last-child')?.getAttribute('aria-label'),
     details:q('.fa3-detail')?.getAttribute('aria-label'),
     tabs:q('.fa3-detail-tabs')?.getAttribute('aria-label'),
     close:q('.fa3-close')?.getAttribute('aria-label'),
     canvas:q('.fa3-eco')?.getAttribute('aria-label')||null,
     image:q('.fa3-artwork img')?.getAttribute('alt')||null,
     tooltips:[...document.querySelectorAll('.fa4-axis[title]')].map(e=>e.getAttribute('title')),
    };
    return {attrs,heading:q('#fa3-title')?.innerText.trim(),body:q('.fa3-shell')?.innerText.slice(0,700),language:document.documentElement.lang};
   });
   const expected={
    category:'Danh mục hồ sơ',loadout:'Chọn đội hình',catalogue:'Danh mục đấu sĩ và vũ khí',
    search:'Tìm trong kho hồ sơ',placeholder:'TÌM KIẾM...',previousPage:'Trang hồ sơ trước',
    nextPage:'Trang hồ sơ tiếp theo',previousRecord:'Hồ sơ trước',nextRecord:'Hồ sơ tiếp theo',
    details:'Ngoại hình và thông tin hồ sơ',tabs:'Chi tiết hồ sơ',close:'Đóng kho hồ sơ',
   };
   for(const [key,value] of Object.entries(expected))check(archive.attrs[key]===value,`Archive ${key} attribute is localized ${view.name}`,archive.attrs[key]);
   for(const tooltip of ['NỘI TẠI: CỬA SỔ BÙNG NỔ (GIÂY)','Chưa có bằng chứng cơ chế','A1: TỐC ĐỘ LƯỚT / THỜI GIAN LƯỚT TỐI ĐA','A2: GIÁP ẢO ROBOT','A1: BÁN KÍNH TIẾP CẬN / VŨ KHÍ TRÊN SÂN ĐÃ LỘ DIỆN'])
    check(archive.attrs.tooltips.includes(tooltip),`Archive combat tooltip is localized ${view.name}`,tooltip);
   check(archive.heading==='KHO HỒ SƠ','Archive title remains Vietnamese '+view.name,archive.heading);
   check(archive.body.includes('GIAO DIỆN / CHỌN & TRANG BỊ'),'Archive skin copy renders in Vietnamese '+view.name,archive.body.slice(0,300));
   check(archive.attrs.image===null||archive.attrs.image.includes('hình ảnh đã duyệt'),'Archive artwork alt is localized '+view.name,archive.attrs.image);
   await page.screenshot({path:`docs/acceptance/ra2/evidence/localization/${view.name}-archive-vie.png`});

   // Change language while Archive is mounted; React labels and mutation-based
   // localization must both restore the exact English UI/accessibility copy.
   await page.evaluate(()=>window.APEX_I18N?.setLanguage('eng'));
   await page.waitForFunction(()=>document.documentElement.lang==='en',{timeout:10000});
   await page.waitForFunction(()=>document.querySelector('.fa3-primary')?.getAttribute('aria-label')==='Archive category',{timeout:10000});
   const english=await page.evaluate(()=>({
    heading:document.querySelector('#fa3-title')?.innerText.trim(),
    category:document.querySelector('.fa3-primary')?.getAttribute('aria-label'),
    close:document.querySelector('.fa3-close')?.getAttribute('aria-label'),
    title:document.querySelector('.fa3-detail-heading')?.innerText.trim(),
    tooltips:[...document.querySelectorAll('.fa4-axis[title]')].map(e=>e.getAttribute('title')),
   }));
   check(english.heading==='THE FIELD ARCHIVE','Archive restores Gold English '+view.name,english);
   check(english.category==='Archive category','Archive aria-label restores English '+view.name,english.category);
   check(english.close==='Close archive','Archive close aria-label restores English '+view.name,english.close);
   check(english.tooltips.includes('PASSIVE: BURST WINDOW SEC'),'Archive title tooltip restores English '+view.name,english.tooltips);
   check(english.title.includes('SKINS / SELECT & EQUIP'),'Archive heading restores English '+view.name,english.title);
   await page.screenshot({path:`docs/acceptance/ra2/evidence/localization/${view.name}-archive-eng.png`});
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('.fa3-shell'),{timeout:10000});

   // Lucky Draw is a same-origin iframe with its own document language and
   // accessible names; wait through Mechanical Door V4 before measuring it.
   await page.evaluate(()=>window.APEX_I18N?.setLanguage('vie'));
   await page.waitForFunction(()=>document.documentElement.lang==='vi',{timeout:10000});
   await page.click('#openLuckyDraw');
   await page.waitForFunction(()=>document.querySelector('#luckyDonorHost')?.classList.contains('is-open'),{timeout:60000});
   await page.waitForFunction(()=>document.body.dataset.apexSceneTransition==='DONE',{timeout:60000});
   await page.waitForFunction(()=>document.querySelector('#luckyDonorFrame')?.contentDocument?.documentElement.lang==='vi',{timeout:15000});
   const drawVie=await page.evaluate(()=>{
    const frame=document.querySelector('#luckyDonorFrame'),d=frame.contentDocument;
    const labels=[...d.querySelectorAll('[aria-label]')].map(e=>e.getAttribute('aria-label'));
    return {title:frame.getAttribute('title'),lang:d.documentElement.lang,text:d.body.innerText.slice(0,1000),labels};
   });
   check(drawVie.lang==='vi','Lucky Draw iframe receives VIE locale '+view.name,drawVie.lang);
   check(drawVie.title==='APEX CHAOS · Vòng quay may mắn','Lucky Draw iframe title is localized '+view.name,drawVie.title);
   check(drawVie.labels.includes('APEX CHAOS · Vòng quay may mắn'),'Lucky Draw main aria-label is localized '+view.name,drawVie.labels[0]);
   check(drawVie.labels.includes('Bảng LED đấu sĩ'),'Lucky Draw LED aria-label is localized '+view.name,drawVie.labels[1]);
   check(drawVie.labels.includes('Quay một đấu sĩ, tốn 1000 AC')&&drawVie.labels.includes('Quay lại'),'Lucky Draw action aria labels are localized '+view.name,drawVie.labels);
   check(drawVie.text.includes('KHU QUAY THƯỞNG · ĐANG HOẠT ĐỘNG')&&drawVie.text.includes('ĐẤU SĨ CÓ THỂ NHẬN'),'Lucky Draw live copy renders VIE '+view.name,drawVie.text.slice(0,350));
   check(drawVie.text.includes('APEX CHAOS ⁄ SECTOR D')&&drawVie.text.includes('NEWBOT'),'Lucky Draw event/fighter identities stay invariant '+view.name);
   await page.screenshot({path:`docs/acceptance/ra2/evidence/localization/${view.name}-lucky-draw-vie.png`});
   await page.evaluate(()=>window.APEX_I18N?.setLanguage('eng'));
   await page.waitForFunction(()=>document.documentElement.lang==='en'&&document.querySelector('#luckyDonorFrame')?.contentDocument?.documentElement.lang==='en',{timeout:15000});
   const drawEng=await page.evaluate(()=>{
    const frame=document.querySelector('#luckyDonorFrame'),d=frame.contentDocument;
    return {title:frame.getAttribute('title'),lang:d.documentElement.lang,labels:[...d.querySelectorAll('[aria-label]')].map(e=>e.getAttribute('aria-label')),text:d.body.innerText.slice(0,500)};
   });
   check(drawEng.title==='APEX CHAOS Lucky Draw','Lucky Draw iframe title restores ENG '+view.name,drawEng.title);
   check(drawEng.labels.includes('APEX CHAOS Lucky Draw')&&drawEng.labels.includes('LED fighter wall'),'Lucky Draw accessible names restore ENG '+view.name,drawEng.labels.slice(0,3));
   check(drawEng.text.includes('DRAW BAY · ACTIVE')&&drawEng.text.includes('POSSIBLE FIGHTERS'),'Lucky Draw live copy restores ENG '+view.name,drawEng.text.slice(0,250));
   await page.screenshot({path:`docs/acceptance/ra2/evidence/localization/${view.name}-lucky-draw-eng.png`});
   await page.evaluate(()=>document.querySelector('#luckyDonorFrame')?.contentDocument?.querySelector('#backBtn')?.click());
   await page.waitForFunction(()=>!document.querySelector('#luckyDonorHost')?.classList.contains('is-open'),{timeout:60000});
   check(errors.length===0,'no uncaught browser errors '+view.name,errors);
  }finally{await page.close();await context.close();}
 }
}finally{await browser.close();}
console.log('RA-2 locale panels Chromium emulation PASS (Missions/Mastery/Archive/Lucky Draw VIE+ENG, aria, restore, focus, desktop + mobile)');
