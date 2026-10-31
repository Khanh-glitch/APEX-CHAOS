// Release-blocking real Chrome validation on the EXACT extracted itch ZIP.
// Runs inside /html/apex/ iframe: origin-root URLs are intentionally 404.
// Never substitutes source/dev preview for packaged bytes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { startNestedServer } from './issue105/nestedServer.mjs';

const require = createRequire(import.meta.url);
const puppeteer = require('./probe/node_modules/puppeteer-core');
const executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const output = path.resolve('reports/owner-itch-qa');
fs.mkdirSync(output, { recursive:true });
assert.ok(fs.existsSync('dist-itch-html5/index.html'), 'extracted ZIP missing index.html');
const index = fs.readFileSync('dist-itch-html5/index.html','utf8');
assert.match(index, /src="\.\/assets\//, 'bundled JS must NOT be origin-root');
assert.match(index, /href="\.\/assets\//, 'bundled CSS must NOT be origin-root');

const server = await startNestedServer();
const browser = await puppeteer.launch({
  executablePath, headless:true,
  args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required'],
});
const audit = [];
try {
  for (const size of [
    {name:'desktop',width:1440,height:900,mobile:false},
    {name:'phone',width:390,height:844,mobile:true},
  ]) {
    const page = await browser.newPage();
    const errors = [], http = [];
    page.on('pageerror',error=>errors.push('PAGE '+String(error)));
    page.on('console',msg=>{
      if(msg.type()==='error') errors.push('CONSOLE '+msg.text().slice(0,250));
    });
    page.on('requestfailed',request=>errors.push('NETWORK '+request.url()+' '+request.failure()?.errorText));
    page.on('response',response=>{
      if(response.status()>=400) http.push(response.status()+' '+response.url());
    });
    await page.setViewport({
      width:size.width,height:size.height,
      deviceScaleFactor:1,isMobile:size.mobile,hasTouch:size.mobile,
    });
    const response = await page.goto(server.url+'/',{waitUntil:'domcontentloaded',timeout:60000});
    assert.equal(response.status(),200,'itch wrapper available');
    const iframe = await page.waitForSelector('#itch-game-drop',{timeout:30000});
    const game = await iframe.contentFrame();
    assert.ok(game,'the iframe must have a real browsing context');
    await game.waitForSelector('#apex-boot-start',{visible:true,timeout:120000});
    await page.screenshot({path:path.join(output,size.name+'-01-start.png')});
    await game.$eval('#apex-boot-start',button=>button.click());
    await game.waitForSelector('#freeBattle',{visible:true,timeout:90000});
    await game.waitForFunction(
      ()=>document.body?.dataset?.apexSceneTransition==='DONE',
      {timeout:90000});
    const boot = await game.evaluate(()=>({
      goldMounted:!!document.querySelector('#gold-shell-host #stage'),
      freeBattle:!!document.querySelector('#freeBattle'),
      ownerShortcut:window.APEX_OWNER_TOOLS?.version,
      docUrl:location.pathname,
      base:document.baseURI,
    }));
    assert.equal(boot.goldMounted,true,'real Gold Home must mount');
    assert.match(boot.docUrl,/^\/html\/apex\//,'nested path retained');
    assert.equal(boot.ownerShortcut,'owner-playtest-capture-v1',
      'owner shortcut installed before Home');
    await page.screenshot({path:path.join(output,size.name+'-02-home.png')});

    if(size.name==='desktop'){
      // Dispatch the exact key chord into the nested game window.
      await game.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{
        code:'F8',key:'F8',ctrlKey:true,shiftKey:true,bubbles:true})));
      const dialog = await game.waitForSelector('#apex-owner-password-panel',
        {visible:true,timeout:10000});
      assert.ok(dialog,'F8 opens password dialog in the packaged game');
      await game.$eval('#apex-owner-password-panel input',el=>{el.value='bad';});
      await game.$eval('#apex-owner-password-panel form',el=>el.requestSubmit());
      assert.equal(await game.evaluate(()=>window.APEX_OWNER_TOOLS.isPlaytestActive()),false,
        'incorrect password must not unlock');
      await game.$eval('#apex-owner-password-panel input',el=>{el.value='500509';});
      await game.$eval('#apex-owner-password-panel form',el=>el.requestSubmit());
      await game.waitForFunction(
        ()=>window.APEX_OWNER_TOOLS?.isPlaytestActive()===true
          && document.querySelector('#stage')?.classList.contains('screen-fighter'),
        {timeout:90000});
      const roster = await game.evaluate(()=>({
        playable:window.APEX_ARSENAL_META?.playableRoster?.()||[],
        goldCards:[...document.querySelectorAll('.rosterCard')].filter(e=>!e.classList.contains('is-locked')).length,
      }));
      assert.ok(roster.goldCards>=8,'Owner F8 must open eight playable Gold fighter cards: '+JSON.stringify(roster));
      await page.screenshot({path:path.join(output,size.name+'-03-owner-fighter.png')});
    } else {
      // The public BOT route must still work without admin authentication.
      await game.$eval('#freeBattle',el=>el.click());
      await game.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-mode'),{timeout:30000});
      await game.$eval('.modeCard[data-mode="bot"]',el=>el.click());
      await game.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-fighter'),{timeout:40000});
      await page.screenshot({path:path.join(output,size.name+'-03-fighter.png')});
    }

    // Drive the authentic Gold picker -> integrated battle, no mock engine/HUD.
    const fighterMode = await game.evaluate(()=>document.querySelector('#stage')?.classList.contains('fighter-bot'));
    assert.equal(fighterMode,true,'Gold fighter screen must display BOT selection');
    await game.waitForSelector('#lockIn',{visible:true,timeout:20000});
    await game.$eval('#lockIn',el=>el.click());
    await game.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('fighter-active-p2')
      ||document.querySelector('#battleHudHost')?.classList.contains('is-open'),{timeout:40000});
    if(!(await game.evaluate(()=>document.querySelector('#battleHudHost')?.classList.contains('is-open')))){
      await game.$eval('#lockIn',el=>el.click());
    }
    await game.waitForFunction(()=>document.querySelector('#battleHudHost')?.classList.contains('is-open')
      && window.APEX_ARSENAL?.state?.active===true
      && window.APEX_ARSENAL?.state?.battleMode==='BOT',{timeout:100000});
    await page.screenshot({path:path.join(output,size.name+'-04-live-bot.png')});
    const live = await game.evaluate(()=>({
      hud:document.querySelector('#battleHudHost')?.className,
      battleMode:window.APEX_ARSENAL?.state?.battleMode,
      fighters:(window.fighters||[]).slice(0,2).map(x=>x?.name),
      art:document.querySelector('#battleHudHost canvas')?.width||null,
    }));
    assert.ok(live.fighters.length>=2,'real BOT gameplay must spawn fighters');
    assert.deepEqual(http,[],'NO 404/5xx from actual packaged ZIP');
    assert.deepEqual(server.serverErrors,[],'NO escaped /assets or missing nested first-party files');
    assert.deepEqual(errors,[],'NO uncaught JS / blocking console/network errors');
    audit.push({viewport:size.name,boot,live,errors,http});
    await page.close();
  }
  fs.writeFileSync(path.join(output,'receipt.json'),
    JSON.stringify({pass:true,buildSha:fs.readFileSync('dist-itch-html5/ITCH_GUEST_BUILD_SHA.txt','utf8').trim(),audit},null,2));
  console.log('PASS EXACT EXTRACTED ITCH ZIP: nested Chrome START -> HOME -> BOT Fighter Pick -> LIVE Gold HUD on desktop + phone, 0 JS errors, 0 HTTP 4xx/5xx, 0 escaped paths');
} finally {
  await browser.close();
  await server.close();
}
