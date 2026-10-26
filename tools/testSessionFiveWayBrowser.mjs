// Five real, production-owned sessions — never a mock wallet, clone Lucky wheel
// or substitute Archive panel. Chrome acceptance across Gold iframe + donor +
// Field Archive. Also asserts no overlapping modal/long press hijack.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchBrowser,openApp,wait} from './issue105/harness.mjs';
const output='reports/five-session-navigation';
await mkdir(output,{recursive:true});
const sizes=[[390,844,true],[844,390,true],[1440,900,false]];
const browser=await launchBrowser();
async function until(page,test,why,timeout=33000,...args){
 try{await page.waitForFunction(test,{timeout},...args);}
 catch(e){throw new Error(why+': '+String(e));}
}
async function gold(page,index){
 await until(page,()=>document.querySelector('.apex-gold-direct-host iframe')?.contentDocument?.querySelector('main h1'),"Gold iframe admission");
 await until(page,i=>{
  const doc=document.querySelector('.apex-gold-direct-host iframe')?.contentDocument;
  const head=doc?.querySelector('main h1')?.textContent||'';
  const tab=doc?.querySelector('[role=tab][aria-selected=true]')?.textContent||'';
  return i===2?/ACCOUNT|TÀI KHOẢN/.test(head):i===1?/MASTERY|TINH THÔNG/.test(tab):/MISSIONS|NHIỆM VỤ/.test(head)&&/CONTRACTS|HỢP ĐỒNG/.test(tab);
 },'Gold section '+index,15000,index);
}
async function swipeGold(page,direction){
 const f=await (await page.$('.apex-gold-direct-host iframe')).contentFrame();
 await f.evaluate(dir=>{
  const root=document.querySelector('main');
  const width=document.documentElement.clientWidth;
  const fire=(name,x,y)=>root.dispatchEvent(new PointerEvent(name,{bubbles:true,cancelable:true,isPrimary:true,pointerType:'touch',pointerId:37,button:0,buttons:name==='pointerup'?0:1,clientX:x,clientY:y}));
  fire('pointerdown',dir==='left'?width*.78:width*.22,145);
  fire('pointerup',dir==='left'?width*.22:width*.78,145);
 },direction);
}
async function lucky(page){
 await until(page,()=>document.querySelector('#luckyDonorHost.is-open #luckyDonorFrame')?.contentDocument?.getElementById('backBtn'),'original Lucky donor open',45000);
 await until(page,()=>document.querySelector('#luckyDonorFrame')?.contentDocument?.documentElement.dataset.apexSectionSwipeReady==='1',
  'native Lucky iframe gesture binding ready',5000);
}
async function archive(page){
 try{
  await until(page,()=>!!document.querySelector('.fa3-overlay.apex-cosmetics-overlay .fa3-shell'),'actual Field Archive open',12000);
 }catch(e){
  const diag=await page.evaluate(()=>({
   donorOpen:document.getElementById('luckyDonorHost')?.classList.contains('is-open'),
   donorStage:document.getElementById('luckyDonorFrame')?.contentDocument?.getElementById('stage')?.dataset.busy,
   ready:document.getElementById('luckyDonorFrame')?.contentDocument?.documentElement.dataset.apexSectionSwipeReady,
   navigator:document.querySelector('.apex-session-interchange')?.dataset.sessionIndex,
   goldOverlay:!!document.querySelector('.apex-gold-direct-host'),
   archiveOverlay:!!document.querySelector('.fa3-overlay'),
   stageClasses:document.getElementById('stage')?.className,
   goldMounted:document.body.classList.contains('apex-gold-mounted'),
   transitionActive:window.APEX_SCENE_TRANSITION?.active?.(),
   waveActive:document.body.classList.contains('apex-bot-wave-active'),
  }));
  console.error('FIVE SESSION ARCHIVE DEBUG',JSON.stringify(diag));
  throw e;
 }
}
async function swipeLucky(page,dir){
 const f=await (await page.$('#luckyDonorFrame')).contentFrame();
 await f.evaluate(d=>{
  const stage=document.querySelector('#stage'),width=innerWidth;
  const emit=(event,x)=>stage.dispatchEvent(new PointerEvent(event,{bubbles:true,cancelable:true,isPrimary:true,pointerId:101,pointerType:'touch',button:0,buttons:event==='pointerup'?0:1,clientX:x,clientY:Math.max(170,innerHeight*.44)}));
  emit('pointerdown',d==='left'?width*.76:width*.23);
  emit('pointerup',d==='left'?width*.23:width*.76);
 },dir);
}
async function swipeArchive(page,dir){
 await page.evaluate(d=>{
  const center=document.querySelector('.fa3-center'),w=innerWidth;
  const emit=(event,x)=>center.dispatchEvent(new PointerEvent(event,{bubbles:true,cancelable:true,isPrimary:true,pointerId:105,pointerType:'touch',button:0,buttons:event==='pointerup'?0:1,clientX:x,clientY:Math.max(120,innerHeight*.44)}));
  emit('pointerdown',d==='left'?w*.76:w*.23);
  emit('pointerup',d==='left'?w*.23:w*.76);
 },dir);
}
try{
 for(const [width,height,mobile] of sizes){
  const {page,context,errors}=await openApp(browser,{width,height,mobile,storage:{'apex.alpha.tutorial.v1':'off'}});
  try{
   page.on('console',m=>{if(/apex-section-nav/.test(m.text()))console.log('FIVE SESSION ROUTE',m.text());});
   const original=await page.evaluate(()=>window.APEX_ARSENAL_META?.getState?.()?.credits);
   await page.click('#apexMissionsOpen');
   await gold(page,0);
   const first=await page.evaluate(()=>({
    guide:!!document.querySelector('.apex-gold-direct-host iframe')?.contentDocument?.querySelector('[data-testid="gold-swipe-coach"]'),
    dots:document.querySelector('.apex-gold-direct-host iframe')?.contentDocument?.querySelectorAll('.gold-section-position span').length,
    persisted:document.querySelector('.apex-gold-direct-host iframe')?.contentWindow?.localStorage?.getItem('apex.gold.sections.swipe.v2')
   }));
   assert.ok(first.guide&&first.dots===5&&first.persisted==='seen','five-section lesson missing');
   await swipeGold(page,'left');
   await gold(page,1);
   await wait(920);
   await swipeGold(page,'left');
   await gold(page,2);
   await wait(920);
   await swipeGold(page,'left');
   await lucky(page);
   assert.equal(await page.evaluate(()=>!!document.querySelector('.apex-gold-direct-host')),false,'Gold iframe left over Lucky');
   const wallet=await page.evaluate(()=>({
    actual:window.APEX_ARSENAL_META?.getState?.()?.credits,
    donor:!!document.getElementById('luckyDonorFrame')?.contentWindow?.APEX_ARSENAL_META,
    index:document.querySelector('.apex-session-interchange')?.dataset.sessionIndex,
   }));
   assert.equal(wallet.actual,original,'cross-screen swipe mutated canonical AC');
   assert.ok(wallet.donor,'real Lucky iframe lost game authority');
   assert.equal(wallet.index,'3','global section indicator out of sync on Lucky');
   await page.screenshot({path:`${output}/${width}x${height}-lucky.png`});

   await swipeLucky(page,'left');
   await archive(page);
   assert.equal(await page.evaluate(()=>document.querySelector('#luckyDonorHost')?.classList.contains('is-open')),false,
    'Lucky still showing underneath Archive');
   assert.equal(await page.evaluate(()=>document.querySelector('.apex-session-interchange')?.dataset.sessionIndex),'4');
   assert.ok(await page.$('.fa3-record-navigation button'),'original Field Archive records replaced');
   await page.screenshot({path:`${output}/${width}x${height}-archive.png`});

   await swipeArchive(page,'right');
   await lucky(page);
   await swipeLucky(page,'right');
   await gold(page,2);
   await page.evaluate(()=>window.__APEX_GOLD_BRIDGE__?.close?.());
   await until(page,()=>!document.querySelector('.apex-gold-direct-host'),'return to Home');
   assert.equal(await page.evaluate(()=>window.APEX_ARSENAL_META?.getState?.()?.credits),original,'cross-surface AC changed');
   assert.deepEqual(errors,[],`Browser errors ${width}x${height}: ${errors.join('; ')}`);
   console.log('FIVE SESSION NAV PASS',width,height,JSON.stringify({first,wallet,credits:original}));
  }finally{await context.close();}
 }
}finally{await browser.close();}
