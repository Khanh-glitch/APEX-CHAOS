// Authentic itch.io HTML5 gallery capture. No DOM substitutions, forced
// currencies, fabricated gameplay or synthetic effects.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {startNestedServer} from './issue105/nestedServer.mjs';
const require=createRequire(import.meta.url);
const puppeteer=require('./probe/node_modules/puppeteer-core');
const OUT=path.resolve('reports/itch-gallery-candidates');
await mkdir(OUT,{recursive:true});
const server=await startNestedServer();
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const note=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function shoot(page,name){
  await wait(450);
  await page.screenshot({path:path.join(OUT,name+'.png'),type:'png',captureBeyondViewport:false});
  note.push({name,url:page.url(),time:new Date().toISOString()});
  console.log('CAPTURE',name);
}
async function prepare({width=1600,height=900}={}){
 const page=await browser.newPage();
 await page.setViewport({width,height,deviceScaleFactor:1,isMobile:width<600,hasTouch:width<600});
 const errs=[];
 page.on('pageerror',e=>errs.push('page:'+String(e).slice(0,260)));
 page.on('response',r=>{if(r.status()>=400&&r.url().includes('/html/'))errs.push(r.status()+' '+r.url().slice(0,140))});
 await page.goto(server.url+'/',{waitUntil:'domcontentloaded',timeout:90000});
 const iframe=await page.waitForSelector('#itch-game-drop',{timeout:30000});
 const game=await iframe.contentFrame();
 await game.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
 await game.evaluate(()=>document.querySelector('#apex-boot-start')?.click());
 await game.waitForSelector('#freeBattle',{visible:true,timeout:60000});
 await game.waitForFunction(()=>document.body.dataset.apexSceneTransition==='DONE',{timeout:120000});
 await game.waitForSelector('.apex-tutorial-ask-no',{visible:true,timeout:10000}).catch(()=>{});
 await game.evaluate(()=>{
   // An actual player choosing NO dismisses the first-run question
   // without hiding/mutating any authored UI for the marketing capture.
   document.querySelector('.apex-tutorial-ask-no')?.click();
   document.querySelector('.apex-guide-close:not(.apex-coach-skip)')?.click();
   document.querySelector('.apex-coach-skip')?.click();
   document.querySelector('.apex-help-close')?.click();
 });
 await wait(900);
 return {page,game,errs};
}
async function goldCapture(game,page){
 await game.evaluate(()=>document.querySelector('#apexMissionsOpen')?.click());
 await game.waitForSelector('.apex-gold-direct-host iframe',{timeout:25000});
 let f=await(await game.$('.apex-gold-direct-host iframe')).contentFrame();
 await f.waitForFunction(()=>document.querySelector('main h1')?.textContent?.trim()==='MISSIONS',{timeout:20000});
 await wait(650);
 await shoot(page,'04-missions');
 await game.evaluate(()=>window.APEX_PROGRESSION_CENTER?.open('mastery'));
 await game.waitForFunction(()=>document.querySelector('.apex-gold-direct-host iframe')?.src.includes('tab=mastery'),{timeout:20000});
 f=await(await game.$('.apex-gold-direct-host iframe')).contentFrame();
 await f.waitForSelector('.gold-tier-summary',{timeout:20000});
 await wait(900);
 await shoot(page,'05-mastery');
 await game.evaluate(()=>window.APEX_ACCOUNT_CENTER?.open());
 await game.waitForFunction(()=>document.querySelector('.apex-gold-direct-host iframe')?.src.includes('screen=account'),{timeout:20000});
 f=await(await game.$('.apex-gold-direct-host iframe')).contentFrame();
 await f.waitForFunction(()=>/ACCOUNT|TÀI KHOẢN/.test(document.querySelector('main h1')?.textContent||''),{timeout:20000});
 await wait(1100);
 await shoot(page,'06-account');
 await game.evaluate(()=>window.APEX_ACCOUNT_CENTER?.close());
 await game.waitForFunction(()=>!document.querySelector('.apex-gold-direct-host'),{timeout:15000});
}
async function combatCapture(game,page){
 await game.evaluate(()=>document.querySelector('#freeBattle')?.click());
 await game.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-mode')&&document.body.dataset.apexSceneTransition==='DONE',{timeout:40000});
 await wait(1150);
 await shoot(page,'02-mode-select');
 await game.evaluate(()=>document.querySelector('.modeCard[data-mode="bot"]')?.click());
 await game.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-fighter')&&document.body.dataset.apexSceneTransition==='DONE',{timeout:50000});
 await wait(1200);
 await shoot(page,'03-fighter-select-newbot');
 const hero=await game.evaluate(()=>!!document.querySelector('.rosterCard[data-hero="HUNTER"]'));
 if(hero){
  await game.evaluate(()=>document.querySelector('.rosterCard[data-hero="HUNTER"]')?.click());
  await wait(1100);
  await shoot(page,'03b-fighter-select-hunter');
 }
 await game.evaluate(()=>document.querySelector('#lockIn')?.click());
 await game.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('fighter-p1-locked')||document.querySelector('#battleHudHost')?.classList.contains('is-open'),{timeout:30000});
 if(!(await game.$('#battleHudHost.is-open'))){
  await game.evaluate(()=>document.querySelector('#lockIn')?.click());
 }
 await game.waitForSelector('#battleHudHost.is-open #p1Side .skill[data-i="0"]',{timeout:90000});
 await game.waitForFunction(()=>window.APEX_ARSENAL?.state?.active===true,{timeout:45000});
 await wait(1300);
 await shoot(page,'07-live-combat-start');
 for(let i=0;i<4;i++){
   await game.evaluate(()=>{
     const hud=window.APEX_GOLD_HUD||window.APEX_GOLD_BRIDGE;
     const hr=window.APEX_HERO_REWORK;
     const p1=window.fighters?.[0];
     for(const [slot,n] of [['A1',0],['A2',1]]){
       if(hr?.observeAbilityCastability?.(p1,slot)?.castable)hud?.pressSkill?.(0,n,{source:'player'});
     }
   });
   await wait(1150);
   await shoot(page,'08-live-combat-'+(i+1));
 }
}

async function captureLocalOrPhone({mode,width,height,tag,play}) {
 const {page,game,errs}=await prepare({width,height});
 try {
  await game.evaluate(()=>document.querySelector('#freeBattle')?.click());
  await game.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-mode') && document.body.dataset.apexSceneTransition==='DONE',{timeout:45000});
  await wait(850);
  const modes=await game.evaluate(()=>[...document.querySelectorAll('.modeCard')].map(x=>({mode:x.dataset.mode,title:x.textContent?.trim()?.slice(0,120)})));
  console.log('MODE OPTIONS',tag,JSON.stringify(modes));
  // Only the actual supported mode control may be used. Never fake a mode.
  const selected=await game.evaluate(m=>{
   const cards=[...document.querySelectorAll('.modeCard')];
   const el=cards.find(c=>String(c.dataset.mode||'').toLowerCase()===m)
      ||cards.find(c=>m==='local'&&/local|2\s*players/i.test(c.textContent||''));
   if(!el)return null;
   const picked={mode:el.dataset.mode,text:el.textContent?.trim()?.slice(0,100)};
   el.click();return picked;
  },mode);
  if(!selected)throw Error('No actual mode button for '+mode+': '+JSON.stringify(modes));
  await game.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-fighter')&&document.body.dataset.apexSceneTransition==='DONE',{timeout:60000});
  await wait(1100);
  await shoot(page,tag+'-fighter-select');
  if(!play)return;
  await game.evaluate(()=>document.querySelector('#lockIn')?.click());
  await game.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('fighter-p1-locked')||document.querySelector('#battleHudHost')?.classList.contains('is-open'),{timeout:40000});
  if(!(await game.$('#battleHudHost.is-open'))){
    await wait(450);
    await game.evaluate(()=>document.querySelector('#lockIn')?.click());
  }
  await game.waitForSelector('#battleHudHost.is-open #p1Side .skill[data-i="0"]',{timeout:90000});
  await game.waitForFunction(()=>window.APEX_ARSENAL?.state?.active===true,{timeout:45000});
  const actualMode=await game.evaluate(()=>window.APEX_ARSENAL?.state?.battleMode);
  console.log('BATTLE MODE',tag,JSON.stringify({requested:mode,selected,actualMode}));
  // Check the UI really entered the requested match mode.
  if(mode==='bot' && String(actualMode).toUpperCase()!=='BOT')throw Error('BOT mislabeled: '+actualMode);
  if(mode==='local' && String(actualMode).toUpperCase()==='BOT')throw Error('Local mislabeled: '+actualMode);
  await wait(650);
  for(let n=0;n<6;n++) {
   if(n>0)await game.evaluate(()=>{
     const hud=window.APEX_GOLD_HUD||window.APEX_GOLD_BRIDGE;
     const hr=window.APEX_HERO_REWORK;
     const p1=window.fighters?.[0];
     if(!hud||!hr||!p1)return;
     for(const [slot,i] of [['A1',0],['A2',1]]) {
       if(hr.observeAbilityCastability?.(p1,slot)?.castable)hud.pressSkill?.(0,i,{source:'player'});
     }
   });
   await wait(770);
   await shoot(page,tag+'-battle-'+String(n+1).padStart(2,'0'));
  }
  console.log('CAPTURED REAL',tag,'mode',actualMode,'viewport',width,height);
 }catch(e){console.error('ADDITIONAL_CAPTURE_FAILED',tag,String(e));note.push({error:tag+': '+String(e)});}
 finally{
  console.log('ADDITIONAL_BROWSER_ERRORS',tag,JSON.stringify(errs.slice(0,12)));
  await page.close();
 }
}

try{
 const {page,game,errs}=await prepare();
 await shoot(page,'01-home');
 try{await goldCapture(game,page);}catch(e){console.error('GOLD_CAPTURE_FAILED',String(e));note.push({error:'Gold: '+String(e)})}
 try{await combatCapture(game,page);}catch(e){console.error('COMBAT_CAPTURE_FAILED',String(e));note.push({error:'Combat: '+String(e)})}
 await captureLocalOrPhone({mode:'local',width:1600,height:900,tag:'09-local-desktop',play:false});
 await captureLocalOrPhone({mode:'bot',width:390,height:844,tag:'10-bot-phone',play:true});
 await captureLocalOrPhone({mode:'local',width:390,height:844,tag:'11-local-phone',play:true});
 console.log('BROWSER_ERRORS',JSON.stringify(errs.slice(0,25)));
 console.log('SERVER_ERRORS',JSON.stringify(server.serverErrors.slice(0,25)));
 await writeFile(path.join(OUT,'capture-report.json'),JSON.stringify({note,errs,serverErrors:server.serverErrors},null,2));
 await page.close();
}finally{await browser.close();await server.close();}
