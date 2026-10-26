// Owner Gold account/mission gesture navigation — real shipping iframe in Chromium.
// Verifies an explicit Back, three-section swipe path, one-time hand guide,
// vertical/input gesture isolation and pixel bounds across desktop and phone.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchBrowser,openApp,wait} from './issue105/harness.mjs';

const output='reports/owner-gold-swipe-evidence';
await mkdir(output,{recursive:true});
const sizes=[[390,844,true],[844,390,true],[1440,900,false]];
const browser=await launchBrowser();
async function embedded(page){
 const f=await page.$('.apex-gold-direct-host iframe');
 assert.ok(f,'Gold iframe not present');
 const frame=await f.contentFrame();
 assert.ok(frame,'Gold iframe not same-origin');
 await frame.waitForSelector('main h1',{timeout:20000});
 return frame;
}
async function selectIndex(frame,index){
 await frame.waitForFunction((i)=>{
  const title=document.querySelector('main h1')?.textContent||'';
  const tab=document.querySelector('[role="tab"][aria-selected="true"]')?.textContent||'';
  return i===2?(/ACCOUNT|TÀI KHOẢN/.test(title)):i===1?(/MASTERY|TINH THÔNG/.test(tab)):(/MISSIONS|NHIỆM VỤ/.test(title)&&/CONTRACTS|HỢP ĐỒNG/.test(tab));
 },{timeout:10000},index);
}
async function gesture(frame,startX,endX,startY=160,endY=startY,type='touch'){
 await frame.evaluate(({startX,endX,startY,endY,type})=>{
  const main=document.querySelector('main');
  if(!main)throw Error('Missing Gold swipe main');
  const fire=(name,x,y)=>main.dispatchEvent(new PointerEvent(name,{
   bubbles:true,cancelable:true,isPrimary:true,pointerId:55,pointerType:type,
   button:0,buttons:name==='pointerup'?0:1,clientX:x,clientY:y
  }));
  fire('pointerdown',startX,startY);fire('pointerup',endX,endY);
 },{startX,endX,startY,endY,type});
}
try{
 for(const [width,height,mobile] of sizes){
  const {page,context,errors}=await openApp(browser,{width,height,mobile,storage:{'apex.alpha.tutorial.v1':'off'}});
  try{
   await page.click('#apexMissionsOpen');
   let frame=await embedded(page);
   await selectIndex(frame,0);
   const first=await frame.evaluate(()=>({
    guide:!!document.querySelector('[data-testid="gold-swipe-coach"]'),
    hand:!!document.querySelector('.gold-swipe-coach-hand'),
    key:localStorage.getItem('apex.gold.sections.swipe.v1'),
    back:document.querySelector('.gold-session-back')?.getBoundingClientRect().toJSON(),
    width:document.documentElement.clientWidth,
    overflow:document.documentElement.scrollWidth>innerWidth+2,
    oldToggle:document.querySelectorAll('nav').length
   }));
   assert.ok(first.guide&&first.hand,'first-entry animated hand swipe coach not shown');
   assert.equal(first.key,'seen','hint must persist once-only on same origin');
   assert.ok(first.back?.width>=44&&first.back?.height>=44,'Back touch target below 44px');
   assert.ok(first.back.x>=0&&first.back.right<=width+1,'Back off-screen');
   assert.equal(first.oldToggle,0,'old Account/Mission top navigation must not return');
   assert.equal(first.overflow,false,'Gold horizontal overflow in initial section');
   await page.screenshot({path:`${output}/${width}x${height}-tutorial.png`});

   // The guide is informative, not a blocking full-screen layer.
   // Exercise a true Chrome finger gesture in mobile viewports, not only
   // JavaScript-dispatched PointerEvents, including an intermediate move.
   if(mobile){
    const y=158;
    await page.touchscreen.touchStart(Math.round(width*.72),y);
    await page.touchscreen.touchMove(Math.round(width*.48),y+1);
    await page.touchscreen.touchMove(Math.round(width*.24),y+1);
    await page.touchscreen.touchEnd();
   }else await gesture(frame,width*.72,width*.24);
   await selectIndex(frame,1);
   await wait(550); // screenshot the settled Gold page, never its cinematic wipe
   await page.screenshot({path:`${output}/${width}x${height}-mastery.png`});
   await wait(900);
   await gesture(frame,width*.72,width*.24);
   await selectIndex(frame,2);
   await wait(550);
   await page.screenshot({path:`${output}/${width}x${height}-account.png`});
   await wait(900);
   await gesture(frame,width*.24,width*.72);
   await selectIndex(frame,1);
   await wait(900);
   await gesture(frame,width*.24,width*.72);
   await selectIndex(frame,0);

   // Vertical scrolling must not navigate, nor should an editing field
   // initiate a scene change even on a long lateral drag.
   await wait(900);
   await gesture(frame,width*.51,width*.54,140,330);
   await selectIndex(frame,0);
   await frame.evaluate(()=>{
    const input=document.createElement('input');
    input.id='gold-test-name-field';document.querySelector('main')?.prepend(input);
    input.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,isPrimary:true,pointerId:77,pointerType:'touch',clientX:300,clientY:160}));
    input.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,isPrimary:true,pointerId:77,pointerType:'touch',clientX:80,clientY:160}));
    input.remove();
   });
   await selectIndex(frame,0);
   const final=await frame.evaluate(()=>({
    overflow:document.documentElement.scrollWidth>innerWidth+2,
    selected:[...document.querySelectorAll('.gold-section-position span')].findIndex(x=>x.classList.contains('is-current')),
    hand:!!document.querySelector('.gold-swipe-coach-hand')
   }));
   assert.equal(final.selected,0,'section dots not synced after reverse swipes');
   assert.equal(final.overflow,false,'Gold horizontal overflow after navigation');

   // Explicit button closes the entire modal and restores the Home entry.
   await frame.click('.gold-session-back');
   await page.waitForFunction(()=>!document.querySelector('.apex-gold-direct-host'),{timeout:10000});
   await page.evaluate(()=>window.APEX_ACCOUNT_CENTER?.open());
   frame=await embedded(page);
   await selectIndex(frame,2);
   assert.equal(await frame.evaluate(()=>!!document.querySelector('[data-testid="gold-swipe-coach"]')),false,
    'one-time gesture lesson unexpectedly replayed after reopening Account');
   await frame.click('.gold-session-back');
   await page.waitForFunction(()=>!document.querySelector('.apex-gold-direct-host'),{timeout:10000});

   assert.deepEqual(errors,[],`Unexpected browser exceptions: ${errors.join(' | ')}`);
   console.log('GOLD SWIPE/BACK PASS',width,height,JSON.stringify({first,final}));
  }finally{await context.close();}
 }
}finally{await browser.close();}
