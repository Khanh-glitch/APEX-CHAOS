// RA-2 Lucky Draw full-state browser audit. Every economy mutation is confined
// to separate disposable Chromium contexts seeded through the production wallet.
// The real spinner/authority is used for success; refusal/error branches use
// deterministic provider responses and prove zero wallet/ownership mutations.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {cp3EntitledProfile} from './cp3MasteryFixture.mjs';

const CHROME=process.env.CHROME_PATH;
const BASE=process.env.APEX_APP_URL||'http://127.0.0.1:5173/';
if(!CHROME)throw Error('CHROME_PATH is required');
const OUT='docs/acceptance/ra2/evidence/lucky-draw';await mkdir(OUT,{recursive:true});
const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
const checks=[],errors=[];const reports={};
const check=(ok,name,detail)=>{checks.push({ok,name,detail});console.log((ok?'PASS':'FAIL')+' RA-2 Lucky Draw: '+name+(detail===undefined?'':' '+JSON.stringify(detail)));assert.ok(ok,name)};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function boot(profile){
 const context=await browser.createBrowserContext();const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)));
 await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
 await page.evaluateOnNewDocument(serialized=>{if(window.location.origin!=='null'&&window.name!=='ra2-draw-seed-applied'){localStorage.setItem('apexChaos.arsenalMeta.v1',serialized);window.name='ra2-draw-seed-applied'}},JSON.stringify(profile));
 await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:70000});await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});await page.click('#apex-boot-start');await page.waitForSelector('#freeBattle',{visible:true,timeout:60000});await page.click('#freeBattle');await page.waitForFunction(()=>document.body.dataset.apexSceneTransition==='DONE',{timeout:60000});await page.waitForFunction(()=>window.APEX_ARSENAL_META&&window.APEX_I18N,{timeout:45000});
 return {context,page};
}
async function openDraw(page,lang){
 await page.evaluate(l=>window.APEX_I18N.setLanguage(l),lang);await page.waitForFunction(l=>document.documentElement.lang===(l==='vie'?'vi':'en'),{timeout:10000},lang);
 await page.click('#openLuckyDraw');await page.waitForFunction(()=>document.querySelector('#luckyDonorHost')?.classList.contains('is-open'),{timeout:60000});await page.waitForFunction(()=>document.body.dataset.apexSceneTransition==='DONE',{timeout:60000});
 await page.waitForFunction(()=>document.querySelector('#luckyDonorFrame')?.contentDocument?.querySelector('#stage[data-state]'),{timeout:20000});
 const donorUrl=await page.$eval('#luckyDonorFrame',el=>el.contentWindow?.location?.href||el.src);
 let frame=null;
 for(let attempt=0;attempt<40&&!frame;attempt++){
  frame=page.frames().find(f=>f.url()===donorUrl||f.url().includes('/gold/lucky-draw.html'))||null;
  if(!frame)await wait(50);
 }
 if(!frame)throw Error(`Lucky Draw iframe not found: ${JSON.stringify({donorUrl,src:await page.$eval('#luckyDonorFrame',el=>el.src),frames:page.frames().map(f=>f.url())})}`);
 await frame.waitForFunction(l=>document.documentElement.lang===(l==='vie'?'vi':'en'),{timeout:15000},lang);
 return frame;
}
async function wallet(page){return page.evaluate(()=>{const m=window.APEX_ARSENAL_META,s=m.getState();return{credits:m.credits(),totalSpins:s.totalSpins,owned:[...s.ownedFighters],locked:m.poolLocked()}})}
async function refusalCase({id,credits,lang,reason,need,expected,shot}){
 const profile=cp3EntitledProfile({credits,progression:{botMatches:0,botWins:0,localMatches:0,claimedIds:[]}});
 const {context,page}=await boot(profile);
 try{
  const frame=await openDraw(page,lang);
  const before=await wallet(page);
  if(reason){await page.evaluate(({reason,need})=>{const m=window.APEX_ARSENAL_META;m.__ra2Spin=m.spin;m.spin=()=>({ok:false,reason,...(need===undefined?{}:{need})})},{reason,need})}
  await frame.click('#btn1');await wait(220);
  await frame.waitForFunction(()=>{const e=document.querySelector('#poolTag');return e&&getComputedStyle(e).opacity!=='0'&&e.textContent.trim().length>0},{timeout:5000}).catch(()=>{});
  await wait(450);
  const visible=await frame.evaluate(()=>({tag:document.querySelector('#poolTag')?.innerText.trim()||'',lang:document.documentElement.lang,busy:document.querySelector('#stage')?.dataset.busy,state:document.querySelector('#stage')?.dataset.state}));
  const after=await wallet(page);
  check(visible.tag===expected,`${id} state exposes localized status copy`,visible);
  check(JSON.stringify(before)===JSON.stringify(after),`${id} refusal does not change AC, ownership, pool or draw count`,{before,after});
  await page.screenshot({path:`${OUT}/${shot}.png`});
  reports[id]={before,visible,after};
 }finally{await context.close()}
}
try{
 await refusalCase({id:'insufficient-vie',credits:100,lang:'vie',expected:'CẦN 250 AC',shot:'insufficient-vie'});
 await refusalCase({id:'pending-response-vie',credits:350,lang:'vie',reason:'spinning',expected:'LƯỢT QUAY ĐANG XỬ LÝ',shot:'pending-response-vie'});
 await refusalCase({id:'error-response-vie',credits:350,lang:'vie',reason:'test-error',expected:'HIỆN KHÔNG THỂ QUAY',shot:'error-vie'});
 await refusalCase({id:'insufficient-eng',credits:100,lang:'eng',expected:'NEED 250 AC',shot:'insufficient-eng'});
 await refusalCase({id:'pending-response-eng',credits:350,lang:'eng',reason:'spinning',expected:'DRAW PENDING',shot:'pending-response-eng'});
 await refusalCase({id:'error-response-eng',credits:350,lang:'eng',reason:'test-error',expected:'DRAW UNAVAILABLE',shot:'error-eng'});
 // Real production spin in an isolated 350-AC profile, with an injected RNG
 // argument to the actual authority for deterministic winner selection.
 const profile=cp3EntitledProfile({credits:350,progression:{botMatches:0,botWins:0,localMatches:0,claimedIds:[]}});
 const {context,page}=await boot(profile);
 try{
  const frame=await openDraw(page,'vie');
  const before=await wallet(page);check(before.credits===350&&before.totalSpins===0&&before.owned.length===1,'success fixture starts with one owned fighter and exactly one draw balance',before);
  await page.evaluate(()=>{const m=window.APEX_ARSENAL_META;m.__ra2Spin=m.spin;m.spin=()=>m.__ra2Spin(()=>0)});
  await frame.click('#btn1');
  await frame.waitForFunction(()=>document.querySelector('#stage')?.dataset.busy==='1',{timeout:5000});
  const pending=await frame.evaluate(()=>({busy:document.querySelector('#stage')?.dataset.busy,state:document.querySelector('#stage')?.dataset.state,drawLabel:document.querySelector('#btn1')?.innerText.trim(),buttonAria:document.querySelector('#btn1')?.getAttribute('aria-label')}));
  const afterDebit=await wallet(page);
  check(pending.busy==='1'&&['roll','decel','near','lock'].includes(pending.state),'real draw enters pending animation state',pending);
  check(afterDebit.credits===0&&afterDebit.totalSpins===1&&afterDebit.owned.includes('HUNTER'),'real spin atomically debits once and persists its deterministic result',afterDebit);
  await page.screenshot({path:`${OUT}/pending-vie.png`});
  await frame.click('#btn1');await wait(160);
  const duplicateAttempt=await wallet(page);
  check(duplicateAttempt.totalSpins===1&&duplicateAttempt.credits===0&&duplicateAttempt.owned.filter(x=>x==='HUNTER').length===1,'second input during pending animation is ignored without another draw',duplicateAttempt);
  await frame.waitForFunction(()=>document.querySelector('#stage')?.dataset.busy==='0'&&document.querySelector('#stage')?.dataset.state==='settle',{timeout:30000});
  const success=await frame.evaluate(()=>({state:document.querySelector('#stage')?.dataset.state,busy:document.querySelector('#stage')?.dataset.busy,winner:document.querySelector('.hero-slot[style*="opacity: 1"] img')?.alt||document.querySelector('#tagN')?.textContent.trim(),tag:document.querySelector('#tagN')?.innerText.trim(),lang:document.documentElement.lang}));
  const afterSuccess=await wallet(page);
  check(success.state==='settle'&&success.busy==='0'&&success.lang==='vi'&&(success.winner==='HUNTER'||success.tag==='HUNTER'),'VIE draw completes and reveals the awarded fighter',success);
  check(afterSuccess.credits===0&&afterSuccess.totalSpins===1&&afterSuccess.owned.includes('HUNTER'),'success leaves the authority ledger at the exact expected balance/ownership',afterSuccess);
  await page.screenshot({path:`${OUT}/success-vie.png`});
  reports.success={before,pending,afterDebit,duplicateAttempt,success,afterSuccess};
  // Reload is real, then we reopen in ENG and verify persisted receipt, pool,
  // translated labels and balance. No second draw is performed.
  await page.reload({waitUntil:'domcontentloaded',timeout:70000});await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});await page.click('#apex-boot-start');await page.waitForSelector('#freeBattle',{visible:true,timeout:60000});await page.click('#freeBattle');await page.waitForFunction(()=>document.body.dataset.apexSceneTransition==='DONE',{timeout:60000});await page.waitForFunction(()=>window.APEX_ARSENAL_META,{timeout:30000});
  const reloadedWallet=await wallet(page);check(reloadedWallet.credits===0&&reloadedWallet.totalSpins===1&&reloadedWallet.owned.includes('HUNTER'),'reload retains the successful draw exactly once',reloadedWallet);
  const frameENG=await openDraw(page,'eng');
  const reloadENG=await frameENG.evaluate(()=>({lang:document.documentElement.lang,title:document.querySelector('#stage')?.getAttribute('aria-label'),poolCount:document.querySelector('#poolCount')?.innerText.trim(),drawLabel:document.querySelector('#btn1')?.getAttribute('aria-label'),possible:document.querySelector('#infoD')?.innerText.trim(),locked:window.APEX_ARSENAL_META?.poolLocked?.()||[],winnerStillLocked:(window.APEX_ARSENAL_META?.poolLocked?.()||[]).includes('HUNTER')}));
  check(reloadENG.lang==='en'&&reloadENG.title==='APEX CHAOS Lucky Draw'&&reloadENG.drawLabel==='Draw one fighter, cost 350'&&reloadENG.poolCount==='06'&&!reloadENG.winnerStillLocked,'ENG reload restores donor copy and syncs the production six-fighter pool after HUNTER unlock',reloadENG);
  const status=await page.evaluate(()=>({credits:window.APEX_ARSENAL_META.credits(),owned:window.APEX_ARSENAL_META.getState().ownedFighters,totalSpins:window.APEX_ARSENAL_META.getState().totalSpins}));
  check(status.credits===0&&status.totalSpins===1&&status.owned.includes('HUNTER'),'ENG reload surface retains the same production authority values',status);
  await page.screenshot({path:`${OUT}/reload-eng.png`});
  reports.reload={wallet:reloadedWallet,donor:reloadENG,authority:status};
 }finally{await context.close()}
 // Independent ENG success transaction, likewise isolated and deterministic.
 const engProfile=cp3EntitledProfile({credits:350,progression:{botMatches:0,botWins:0,localMatches:0,claimedIds:[]}});
 const engRun=await boot(engProfile);
 try{
  const frame=await openDraw(engRun.page,'eng');
  await engRun.page.evaluate(()=>{const m=window.APEX_ARSENAL_META;m.__ra2Spin=m.spin;m.spin=()=>m.__ra2Spin(()=>0)});
  await frame.click('#btn1');await frame.waitForFunction(()=>document.querySelector('#stage')?.dataset.busy==='1',{timeout:5000});
  const pending=await frame.evaluate(()=>({lang:document.documentElement.lang,busy:document.querySelector('#stage')?.dataset.busy,state:document.querySelector('#stage')?.dataset.state}));
  await frame.waitForFunction(()=>document.querySelector('#stage')?.dataset.busy==='0'&&document.querySelector('#stage')?.dataset.state==='settle',{timeout:30000});
  const final=await engRun.page.evaluate(()=>({credits:window.APEX_ARSENAL_META.credits(),totalSpins:window.APEX_ARSENAL_META.getState().totalSpins,owned:window.APEX_ARSENAL_META.getState().ownedFighters}));
  check(pending.lang==='en'&&pending.busy==='1'&&['roll','decel','near','lock'].includes(pending.state),'ENG success enters the pending animation state',pending);
  check(final.credits===0&&final.totalSpins===1&&final.owned.includes('HUNTER'),'ENG success commits once to the isolated production wallet',final);
  await engRun.page.screenshot({path:`${OUT}/success-eng.png`});reports.successEng={pending,final};
 }finally{await engRun.context.close()}
 check(errors.length===0,'no uncaught browser errors in Lucky Draw state audit',errors);
 const report={base:BASE,checks:checks.length,failures:checks.filter(x=>!x.ok),cases:reports,browserErrors:errors,limitation:'Chromium desktop emulation. All ledger-changing operations were isolated in disposable browser contexts; production code changes are presentation localization/error-copy only.'};
 await writeFile(`${OUT}/lucky-draw-states-audit.json`,JSON.stringify(report,null,2)+'\n');
 console.log('RA-2 Lucky Draw insufficient/pending/error/success/reload audit PASS.');
}finally{await browser.close()}
