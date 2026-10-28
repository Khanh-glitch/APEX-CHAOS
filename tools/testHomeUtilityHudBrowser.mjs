// Real Chrome acceptance for the owner's HOME screenshot regression:
// oversized '?' floating on top of wallet, unreadable 12k demo balance,
// broad LANG panel, and blue text selection while dragging/swiping.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchBrowser,openApp,wait} from './issue105/harness.mjs';
const evidence='reports/home-utility-fix';
await mkdir(evidence,{recursive:true});
const browser=await launchBrowser();
const results=[];
const KEY='apexChaos.arsenalMeta.v1';
const legacy={version:1,credits:12000,ownedFighters:['ROBOT','HUNTER'],
  unlockedAt:{ROBOT:0,HUNTER:0},totalSpins:0};
function overlaps(a,b){
 return a&&b&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>2 &&
  Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
}
try{
 for(const [width,height,mobile] of [[390,844,true],[844,390,true],[1440,900,false],[522,320,true]]){
  const {page,context,errors}=await openApp(browser,{
    width,height,mobile,seed:legacy,storage:{'apex.alpha.tutorial.v1':'off'}});
  try{
   await page.waitForSelector('#apex-language-picker #apex-guide-open',{timeout:30000});
   await wait(250);
   const d=await page.evaluate(()=>{
    const el=sel=>document.querySelector(sel);
    const rect=sel=>el(sel)?.getBoundingClientRect()?.toJSON()||null;
    const root=el('#root'),picker=el('#apex-language-picker'),help=el('#apex-guide-open');
    return {
     viewport:[innerWidth,innerHeight],
     credits:window.APEX_ARSENAL_META?.credits?.(),
     rawCredits:JSON.parse(localStorage.getItem('apexChaos.arsenalMeta.v1')||'null')?.credits,
     backupCredits:JSON.parse(localStorage.getItem('apexChaos.arsenalMeta.v1.legacyDemoWalletBackup.20261028')||'null')?.credits,
     walletLabel:el('[data-apex-ac]')?.textContent,
     wallet:rect('#gold-shell-host #stage .ac'),
     acMark:rect('#gold-shell-host #stage .acMark'),
     picker:rect('#apex-language-picker'),
     help:rect('#apex-guide-open'),
     helpParent:help?.parentElement?.id,
     helpLabel:help?.textContent,
     pickerCaption:getComputedStyle(el('#apex-language-picker .apex-language-caption')).display,
     actionUserSelect:getComputedStyle(el('#freeBattle')).userSelect,
     rootUserSelect:getComputedStyle(root).userSelect,
     helpCount:document.querySelectorAll('#apex-guide-open').length
    };
   });
   assert.equal(d.credits,350,'Untouched 12k legacy demo wallet was not retired');
   assert.equal(d.rawCredits,350,'LocalStorage canonical wallet not migrated');
   assert.equal(d.backupCredits,12000,'Original wallet recovery backup not written');
   assert.equal(d.walletLabel,'350 AC','Home AC readout disagrees with single economy authority');
   assert.equal(d.helpCount,1,'Only one Help control may be mounted');
   assert.equal(d.helpParent,'apex-language-picker','Floating Help is still outside language utility');
   assert.equal(d.helpLabel,'HELP','Oversized question-mark widget still present');
   assert.equal(d.pickerCaption,'none','Decorative LANG caption still consumes space');
   assert.ok(d.wallet&&d.picker&&d.help&&d.acMark,JSON.stringify(d));
   assert.equal(overlaps(d.help,d.wallet),false,'HELP overlaps currency wallet');
   assert.equal(overlaps(d.help,d.acMark),false,'HELP covers AC coin');
   assert.equal(overlaps(d.picker,d.wallet),false,'Language control overlaps currency wallet');
   assert.ok(d.picker.width<=176 && d.picker.right<=width+1 && d.picker.left>=0,
     'Language utility clips or consumes too much space: '+JSON.stringify(d));
   assert.ok(d.help.width>=44&&d.help.height>=44,'Help touch target is too small');
   assert.equal(d.actionUserSelect,'none','Game button labels still select on drag');
   assert.equal(d.rootUserSelect,'none','Game root permits blue text selection');
   // Text-input UX must remain intact despite kiosk selection rules.
   const input=await page.evaluate(()=>{
    const box=document.createElement('input');
    box.value='owner input';box.style.position='fixed';box.style.left='1px';
    document.querySelector('#root').appendChild(box);
    const mode=getComputedStyle(box).userSelect;box.remove();return mode;
   });
   assert.equal(input,'text','Native editable text was accidentally blocked');
   await page.screenshot({path:`${evidence}/home-${width}x${height}.png`});
   await page.click('#apex-guide-open');
   await page.waitForSelector('#apex-tutorial-toggle',{timeout:5000});
   await page.keyboard.press('Escape');
   assert.deepEqual(errors,[],'HOME has browser exceptions: '+JSON.stringify(errors));
   results.push({width,height,credits:d.credits,backup:d.backupCredits,
      helpInLanguagePicker:d.helpParent,pickerWidth:d.picker.width,selectionDisabled:true});
  }finally{await context.close();}
 }
 // A valid 12k wallet with real match progress must remain 12k.
 const valid={...legacy,progression:{botMatches:1,botWins:1,localMatches:0,claimedIds:[]}};
 const {page,context}=await openApp(browser,{width:844,height:390,mobile:true,
   seed:valid,storage:{'apex.alpha.tutorial.v1':'off'}});
 try{
  assert.equal(await page.evaluate(()=>window.APEX_ARSENAL_META?.credits()),12000,
   'Real progressed balance was incorrectly reset');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key+'.legacyDemoWalletBackup.20261028'),KEY),null,
   'Real progressed wallet must not be labelled as demo');
 }finally{await context.close();}
 console.log('HOME HELP + WALLET + SELECTION REAL CHROME PASS',JSON.stringify(results));
} finally {await browser.close();}
