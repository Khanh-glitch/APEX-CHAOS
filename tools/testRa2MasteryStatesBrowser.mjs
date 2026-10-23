// RA-2 Mastery state acceptance using an isolated, explicitly seeded Chromium
// profile. The seed models validated sealed mastery data; no production/test
// profile or economy authority is changed. One Starter Contract claim is
// performed only in this disposable profile, then reload/idempotency is proved.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {CP3_NEWBOT_ACHIEVEMENT_IDS,cp3EntitledProfile} from './cp3MasteryFixture.mjs';

const CHROME=process.env.CHROME_PATH;
const BASE=process.env.APEX_APP_URL||'http://127.0.0.1:5173/';
if(!CHROME)throw Error('CHROME_PATH is required');
const OUT='docs/acceptance/ra2/evidence/mastery';await mkdir(OUT,{recursive:true});
const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
const context=await browser.createBrowserContext();
const checks=[],errors=[];
const check=(ok,name,detail)=>{checks.push({ok,name,detail});console.log((ok?'PASS':'FAIL')+' RA-2 Mastery: '+name+(detail===undefined?'':' '+JSON.stringify(detail)));assert.ok(ok,name)};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
 const profile=cp3EntitledProfile({credits:350,progression:{botMatches:1,botWins:1,localMatches:0,claimedIds:[]}});
 profile.mastery.recent=CP3_NEWBOT_ACHIEVEMENT_IDS.slice(0,12).map((achievementId,index)=>({heroId:'NEWBOT',achievementId,at:Date.now()-index*60000}));
 await page.evaluateOnNewDocument(serialized=>{if(window.location.origin!=='null'&&window.name!=='ra2-mastery-seed-applied'){localStorage.setItem('apexChaos.arsenalMeta.v1',serialized);window.name='ra2-mastery-seed-applied'}},JSON.stringify(profile));
 await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:70000});
 await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});await page.click('#apex-boot-start');
 await page.waitForSelector('#freeBattle',{visible:true,timeout:60000});await page.click('#freeBattle');
 await page.waitForFunction(()=>document.body.dataset.apexSceneTransition==='DONE',{timeout:60000});
 await page.waitForFunction(()=>window.APEX_ARSENAL_META&&window.APEX_PROGRESSION_CENTER,{timeout:45000});
 const seeded=await page.evaluate(()=>({credits:window.APEX_ARSENAL_META.credits(),progress:window.APEX_ARSENAL_META.getState().progression,mastery:window.APEX_ARSENAL_META.getMastery(),entitlement:window.APEX_ARSENAL_META.skinProgress('hero','ROBOT','ecobot')}));
 check(seeded.credits===350&&seeded.mastery.earned.NEWBOT&&Object.keys(seeded.mastery.earned.NEWBOT).length===42,'isolated progressed/earned profile sanitizes with full NEWBOT mastery', {credits:seeded.credits,earned:Object.keys(seeded.mastery.earned.NEWBOT||{}).length});
 check(seeded.entitlement?.entitled===true&&seeded.entitlement.current===42&&seeded.entitlement.target===42,'valid ECOBOT entitlement comes from the actual mastery gate',seeded.entitlement);
 check(seeded.mastery.recent.length===12,'recent history fixture retains 12 valid unique unlocks',seeded.mastery.recent.length);
 await page.evaluate(()=>window.APEX_I18N.setLanguage('vie'));await page.waitForFunction(()=>document.documentElement.lang==='vi',{timeout:10000});
 await page.click('#apexMissionsOpen');await page.waitForSelector('.apex-progress-panel',{visible:true,timeout:15000});
 await page.click('.apex-progress-tabs button:last-child');await page.waitForSelector('.apex-mastery-vault',{visible:true,timeout:10000});
 await page.waitForFunction(()=>document.querySelectorAll('.apex-mastery-recent-chip').length===8,{timeout:10000});
 const recentStart=await page.evaluate(()=>({count:document.querySelectorAll('.apex-mastery-recent-chip').length,button:document.querySelector('.apex-mastery-view-all')?.innerText.trim()||'',title:document.querySelector('#apex-mastery-recent-title')?.innerText.trim()}));
 check(recentStart.count===8&&recentStart.button==='XEM TẤT CẢ'&&recentStart.title==='MỞ KHÓA GẦN ĐÂY','VIE recent section truncates overflow to eight and offers localized VIEW ALL',recentStart);
 await page.click('.apex-mastery-view-all');await page.waitForFunction(()=>document.querySelectorAll('.apex-mastery-recent-chip').length===12,{timeout:10000});
 const recentAll=await page.evaluate(()=>({count:document.querySelectorAll('.apex-mastery-recent-chip').length,button:document.querySelector('.apex-mastery-view-all')?.innerText.trim()||'',names:[...document.querySelectorAll('.apex-mastery-recent-chip b')].map(e=>e.textContent.trim()),dates:[...document.querySelectorAll('.apex-mastery-recent-chip small')].map(e=>e.textContent.trim())}));
 check(recentAll.count===12&&!recentAll.button,'VIE VIEW ALL exposes all 12 entries and removes overflow control',recentAll);
 await page.screenshot({path:`${OUT}/recent-overflow-vie.png`});
 const terminal=await page.$('.apex-mastery-terminal');await terminal.evaluate(e=>e.scrollIntoView({block:'center'}));
 const ecoBefore=await page.evaluate(()=>({name:document.querySelector('.apex-mastery-terminal h3')?.textContent.trim(),progress:document.querySelector('.apex-mastery-terminal strong')?.textContent.trim(),button:document.querySelector('.apex-mastery-terminal .apex-mastery-equip')?{text:document.querySelector('.apex-mastery-terminal .apex-mastery-equip').innerText.trim(),disabled:document.querySelector('.apex-mastery-terminal .apex-mastery-equip').disabled}:null,entitled:window.APEX_ARSENAL_META.skinProgress('hero','ROBOT','ecobot').entitled,selected:window.APEX_ARSENAL_COSMETICS?.selected?.('p1','hero','ROBOT')?.id||null}));
 check(ecoBefore.name==='ECOBOT — LÕI TÁI CHẾ V17'&&ecoBefore.progress==='42/42'&&ecoBefore.entitled&&ecoBefore.button?.text==='TRANG BỊ CHO P1'&&!ecoBefore.button.disabled,'VIE earned ECOBOT presents a valid enabled equip action',ecoBefore);
 await page.screenshot({path:`${OUT}/ecobot-entitled-vie.png`});
 await page.click('.apex-mastery-terminal .apex-mastery-equip');await wait(160);
 const equippedVie=await page.evaluate(()=>({button:document.querySelector('.apex-mastery-terminal .apex-mastery-equip')?.innerText.trim(),disabled:document.querySelector('.apex-mastery-terminal .apex-mastery-equip')?.disabled,message:document.querySelector('.apex-progress-feedback')?.innerText.trim(),credits:window.APEX_ARSENAL_META.credits(),skin:window.APEX_ARSENAL_META.skinEntitlement('hero','ROBOT','ecobot')}));
 check(equippedVie.button==='ĐANG TRANG BỊ'&&equippedVie.disabled&&equippedVie.message==='ĐÃ TRANG BỊ SKIN CHO P1'&&equippedVie.credits===350&&equippedVie.skin,'VIE equip succeeds, becomes disabled/equipped, and does not alter AC or entitlement',equippedVie);
 await page.screenshot({path:`${OUT}/ecobot-equipped-vie.png`});
 await page.evaluate(()=>window.APEX_I18N.setLanguage('eng'));await page.waitForFunction(()=>document.documentElement.lang==='en'&&document.querySelector('.apex-mastery-terminal .apex-mastery-equip')?.innerText.trim()==='EQUIPPED',{timeout:12000});
 check(await page.$eval('.apex-mastery-terminal .apex-mastery-equip',e=>e.disabled),'ENG equipped state remains non-actionable');
 const engRecent=await page.evaluate(()=>({title:document.querySelector('#apex-mastery-recent-title')?.innerText.trim(),count:document.querySelectorAll('.apex-mastery-recent-chip').length}));
 check(engRecent.title==='RECENT UNLOCKS'&&engRecent.count===12,'ENG restores recent history label while retaining expanded overflow',engRecent);
 await page.screenshot({path:`${OUT}/recent-overflow-eng.png`});
 // Mission claims are tested through the real contract API. First inject a
 // deterministic refusal from that API to exercise the UI error state without
 // touching the ledger; then restore the real API and claim once.
 await page.click('.apex-progress-tabs button:first-child');await page.waitForSelector('.apex-progress-row',{visible:true,timeout:10000});
 const initialClaims=await page.evaluate(()=>({credits:window.APEX_ARSENAL_META.credits(),buttons:[...document.querySelectorAll('.apex-progress-claim')].map(e=>({text:e.innerText.trim(),disabled:e.disabled})),claimed:window.APEX_ARSENAL_META.getState().progression.claimedIds}));
 check(initialClaims.credits===350&&initialClaims.buttons[0].text==='CLAIM +100'&&!initialClaims.buttons[0].disabled&&initialClaims.claimed.length===0,'ENG progressed contract is claim-ready at unchanged initial balance',initialClaims);
 await page.evaluate(()=>{const m=window.APEX_ARSENAL_META;window.__ra2ClaimReal=m.claimProgressReward;m.claimProgressReward=id=>id==='first-bot'?{ok:false,reason:'test-error'}:window.__ra2ClaimReal(id)});
 await page.click('.apex-progress-claim:first-of-type').catch(async()=>page.$eval('.apex-progress-claim',e=>e.click()));await wait(80);
 const claimError=await page.evaluate(()=>({message:document.querySelector('.apex-progress-feedback')?.innerText.trim(),credits:window.APEX_ARSENAL_META.credits(),claimed:window.APEX_ARSENAL_META.getState().progression.claimedIds}));
 check(claimError.message==='UNABLE TO CLAIM: test-error'&&claimError.credits===350&&claimError.claimed.length===0,'ENG claim error is announced without wallet/profile mutation',claimError);
 await page.evaluate(()=>{window.APEX_ARSENAL_META.claimProgressReward=window.__ra2ClaimReal});
 await page.click('.apex-progress-claim:first-of-type').catch(async()=>page.$eval('.apex-progress-claim',e=>e.click()));await wait(120);
 const claimSuccess=await page.evaluate(()=>({message:document.querySelector('.apex-progress-feedback')?.innerText.trim(),credits:window.APEX_ARSENAL_META.credits(),claimed:window.APEX_ARSENAL_META.getState().progression.claimedIds,button:{text:document.querySelector('.apex-progress-claim')?.innerText.trim(),disabled:document.querySelector('.apex-progress-claim')?.disabled}}));
 check(claimSuccess.message==='REWARD CLAIMED'&&claimSuccess.credits===450&&claimSuccess.claimed.includes('first-bot')&&claimSuccess.button.text==='CLAIMED'&&claimSuccess.button.disabled,'ENG real claim commits once in the disposable profile and marks the row claimed',claimSuccess);
 await page.screenshot({path:`${OUT}/claim-success-eng.png`});
 await page.reload({waitUntil:'domcontentloaded',timeout:70000});await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});await page.click('#apex-boot-start');await page.waitForSelector('#freeBattle',{visible:true,timeout:60000});await page.click('#freeBattle');await page.waitForFunction(()=>document.body.dataset.apexSceneTransition==='DONE',{timeout:60000});await page.waitForFunction(()=>window.APEX_ARSENAL_META,{timeout:30000});
 const reload=await page.evaluate(()=>({credits:window.APEX_ARSENAL_META.credits(),claimed:window.APEX_ARSENAL_META.getState().progression.claimedIds,entitled:window.APEX_ARSENAL_META.skinEntitlement('hero','ROBOT','ecobot'),selected:window.APEX_ARSENAL_META.getState().lastSelectedP1}));
 check(reload.credits===450&&reload.claimed.includes('first-bot')&&reload.entitled===true,'reload persists claimed receipt, earned ECOBOT entitlement and balance exactly once',reload);
 const duplicate=await page.evaluate(()=>{const m=window.APEX_ARSENAL_META,before=m.credits(),result=m.claimProgressReward('first-bot');return{result,before,after:m.credits()}});
 check(duplicate.result.ok===false&&duplicate.result.reason==='already-claimed'&&duplicate.before===duplicate.after,'duplicate claim after reload is idempotently rejected',duplicate);
 await page.evaluate(()=>window.APEX_I18N.setLanguage('vie'));await page.waitForFunction(()=>document.documentElement.lang==='vi',{timeout:10000});
 await page.click('#apexMissionsOpen');await page.waitForSelector('.apex-progress-panel',{visible:true,timeout:15000});
 const claimedVie=await page.evaluate(()=>({balance:document.querySelector('.apex-progress-balance b')?.innerText.trim(),button:document.querySelector('.apex-progress-claim')?.innerText.trim(),disabled:document.querySelector('.apex-progress-claim')?.disabled}));
 check(claimedVie.button==='ĐÃ NHẬN'&&claimedVie.disabled,'reload-rendered VIE claim state is translated and disabled',claimedVie);
 check(errors.length===0,'no uncaught browser errors in Mastery/claim audit',errors);
 const report={base:BASE,checks:checks.length,failures:checks.filter(x=>!x.ok),seed:{earnedAchievementCount:CP3_NEWBOT_ACHIEVEMENT_IDS.length,recentCount:profile.mastery.recent.length,startingCredits:350,isolatedDisposableContext:true},results:{seeded, recentStart,recentAll,ecoBefore,equippedVie,engRecent,initialClaims,claimError,claimSuccess,reload,duplicate,claimedVie},browserErrors:errors,limitation:'Chromium desktop emulation. Earned mastery fixture and one mission claim are confined to a disposable browser profile; no gameplay/economy authority was changed.'};
 await writeFile(`${OUT}/progressed-entitled-profile-audit.json`,JSON.stringify(report,null,2)+'\n');
 console.log('RA-2 Mastery earned/entitled/recent-overflow/claim/equip audit PASS.');
}finally{await context.close();await browser.close();}
