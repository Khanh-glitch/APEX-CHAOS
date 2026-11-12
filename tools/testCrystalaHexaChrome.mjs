// Real Chrome software-renderer smoke for CRYSTALA K/A2 -> J/A1 HEXA.
// Checks both fighter orders and captures the actual running game; these are
// runtime/visual checks, NOT hardware-GPU FPS claims.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const puppeteer=require('./probe/node_modules/puppeteer-core');
const out='reports/crystala-hexa-chrome';
fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_PATH,headless:true,
 args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
  '--autoplay-policy=no-user-gesture-required'],
 defaultViewport:{width:1440,height:900}
});
const results=[];
try{
 for(const heroes of [['CRYSTAL','FROST'],['FROST','CRYSTAL']]){
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(process.env.APEX_APP_URL||'http://127.0.0.1:4173',{
   waitUntil:'domcontentloaded',timeout:65000
  });
  await page.waitForFunction(()=>typeof window.__apexEnsureDeferredRuntimes==='function',{
   timeout:100000
  });
  const stat=await page.evaluate(async ([a,b])=>{
   await window.__apexEnsureDeferredRuntimes('arsenalProduct');
   window.__APEX_TEST_MODE=true;
   const G=window;
   if(G.APEX_ARSENAL?.state?.active)G.exitArsenalBattleMode();
   G.startArsenalBattleMode(a,b,{testFixture:true});
   if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0;}
   const crystal=G.fighters[a==='CRYSTAL'?0:1];
   if(G.APEX_HERO_REWORK?.setAiEnabled)G.APEX_HERO_REWORK.setAiEnabled(false);
   for(const f of G.fighters){f.baseSpeed=0;f.hp=Math.max(5000,f.hp);f.maxHp=Math.max(5000,f.maxHp);}
   G.fighters[0].x=250;G.fighters[0].y=500;
   G.fighters[1].x=750;G.fighters[1].y=500;
   const tick=(count)=>{for(let i=0;i<count;i++){G.APEX_ARSENAL.step(1/60);G.draw();}};
   tick(5);
   const k=G.APEX_HERO_REWORK.pressAbility(crystal,'A2');
   const j=G.APEX_HERO_REWORK.pressAbility(crystal,'A1');
   tick(65);
   const ct=G.APEX_HERO_REWORK.byCombatant(crystal);
   const state=G.APEX_CRYSTAL.stateOf(ct);
   const cons=state?.rig?.constructs?.map(c=>c.kind)||[];
   return {heroes:[a,b],kOk:!!k?.ok,kReason:k?.reason||null,
     jOk:!!j?.ok,jReason:j?.reason||null,constructs:cons,
     bloomReady:typeof G.APEX_CRYSTALA_PRESENTATION?.runBloomPass==='function',
     canvasWidth:G.canvas?.width,canvasHeight:G.canvas?.height};
  },heroes);
  await page.screenshot({path:out+'/'+heroes.join('-')+'.png'});
  results.push({...stat,errors});
  assert(stat.bloomReady,'CRYSTALA bloom integration unavailable');
  assert(stat.kOk,'K Awakening cast failed: '+stat.kReason);
  assert(stat.jOk,'J HEXA cast failed: '+stat.jReason);
  assert(stat.constructs.includes('prison'),'HEXA Prison was not created');
  assert.deepEqual(errors,[],'Uncaught exceptions '+heroes.join(' vs '));
  await page.close();
 }
 fs.writeFileSync(out+'/receipt.json',JSON.stringify(results,null,2));
 console.log('PASS Chrome CRYSTALA K->J HEXA both fighter slots; 0 page errors',JSON.stringify(results));
}finally{await browser.close();}
