// Latest Gold portable ZIP browser gate; reuse repository's canonical nested itch harness.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {startNestedServer} from './issue105/nestedServer.mjs';
const require=createRequire(import.meta.url);
const puppeteer=require('./probe/node_modules/puppeteer-core');
const CHROME_PATH=process.env.CHROME_PATH;
assert.ok(CHROME_PATH, 'System Chrome is required');
fs.mkdirSync('reports/latest-gold-itch',{recursive:true});
const server=await startNestedServer();
const browser=await puppeteer.launch({executablePath:CHROME_PATH,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
const result=[],exceptions=[];
try{
  for(const {name,width,height} of [{name:'desktop',width:1440,height:900},{name:'phone',width:390,height:844}]){
    const page=await browser.newPage();
    page.on('pageerror',e=>exceptions.push({surface:name,error:String(e)}));
    await page.setViewport({width,height,isMobile:width<600,hasTouch:width<600,deviceScaleFactor:width<600?2:1});
    const resp=await page.goto(server.url+'/',{waitUntil:'domcontentloaded',timeout:60000});
    assert.equal(resp.status(),200, name+' itch wrapper');
    const iframe=await page.waitForSelector('#itch-game-drop',{timeout:30000});
    const game=await iframe.contentFrame();
    assert.ok(game,name+' native game iframe missing');
    await game.waitForSelector('#apex-boot-start',{visible:true,timeout:120000});
    await game.evaluate(()=>document.querySelector('#apex-boot-start').click());
    await game.waitForSelector('#apexMissionsOpen',{timeout:90000});
    const state=await game.evaluate(()=>({
      title:document.title,mission:!!document.querySelector('#apexMissionsOpen'),
      pathname:location.pathname,bodyChars:document.body?.innerText?.length||0
    }));
    assert.match(state.title,/APEX CHAOS/i);
    assert.ok(state.pathname.startsWith('/html/apex/'));
    await page.screenshot({path:'reports/latest-gold-itch/'+name+'.png'});
    result.push({surface:name,...state});
    await page.close();
  }
  const page=await browser.newPage();
  page.on('pageerror',e=>exceptions.push({surface:'bot-wave',error:String(e)}));
  await page.setViewport({width:844,height:390,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const resp=await page.goto(server.url+'/html/apex/bot-wave/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(resp.status(),200,'Current Gold BOT WAVE entry');
  const iframe=await page.waitForSelector('#wave:not([hidden])',{timeout:120000});
  const game=await iframe.contentFrame();
  assert.ok(game,'BOT WAVE game frame missing');
  await game.waitForFunction(()=>window.handLab?.fluid?._pressureBackend==='wasm-exact-14-iter' &&
     !!window.BOXE_WAVE_PILOT && window.APEX_BOT_WAVE_INTERFACE_V2?.installed===true,{timeout:90000});
  const state=await game.evaluate(()=>({
    backend:window.handLab.fluid._pressureBackend,pilot:!!window.BOXE_WAVE_PILOT,
    goldHud:window.APEX_BOT_WAVE_INTERFACE_V2.installed,
    joystick:!!document.querySelector('#wave-hud #wave-stick'),phase:window.BOXE_WAVE_PILOT.state?.phase,
    pathname:location.pathname
  }));
  assert.ok(state.joystick && state.goldHud);
  await page.screenshot({path:'reports/latest-gold-itch/bot-wave.png'});
  result.push({surface:'bot-wave',...state});
  await page.close();
  assert.deepEqual(server.serverErrors,[],'No first-party itch 404 or escaped root requests');
  assert.deepEqual(exceptions,[],'No unhandled Chrome page exceptions');
  console.log('LATEST GOLD ITCH NESTED BROWSER PASS',JSON.stringify(result));
}finally{
  fs.writeFileSync('reports/latest-gold-itch/acceptance.json',JSON.stringify({result,serverErrors:server.serverErrors,exceptions},null,2));
  await browser.close();await server.close();
}
