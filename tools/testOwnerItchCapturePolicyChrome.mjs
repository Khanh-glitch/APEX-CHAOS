// Verify the exact itch ZIP when its page is embedded in a CROSS-ORIGIN
// frame whose parent did not delegate display-capture (the itch policy case).
// A same-origin nested harness cannot catch this: display-capture defaults
// to 'self' and therefore works there even when production itch denies it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {startNestedServer} from './issue105/nestedServer.mjs';

const require=createRequire(import.meta.url);
const puppeteer=require('./probe/node_modules/puppeteer-core');
const executablePath=process.env.CHROME_PATH||'/usr/bin/google-chrome';
const output=path.resolve('reports/owner-itch-qa');
fs.mkdirSync(output,{recursive:true});
const nested=await startNestedServer();
let outer;
let browser;
try {
  outer=http.createServer((req,res)=>{
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end('<!doctype html><html><body style="margin:0">'+
      '<iframe id="itch-game-drop" src="'+nested.url+'/html/apex/index.html" '+
      'allow="autoplay; fullscreen" style="border:0;width:100vw;height:100vh"></iframe></body></html>');
  });
  await new Promise(ok=>outer.listen(0,'127.0.0.1',ok));
  const outerUrl='http://127.0.0.1:'+outer.address().port+'/';
  assert.notEqual(new URL(outerUrl).origin,new URL(nested.url).origin);
  browser=await puppeteer.launch({
    executablePath,headless:true,
    args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
      '--autoplay-policy=no-user-gesture-required'],
  });
  const page=await browser.newPage();
  await page.setViewport({width:1440,height:900});
  await page.goto(outerUrl,{waitUntil:'domcontentloaded',timeout:60000});
  const iframe=await page.waitForSelector('#itch-game-drop',{timeout:30000});
  const game=await iframe.contentFrame();
  assert.ok(game,'cross-origin itch frame exists');
  await game.waitForSelector('#apex-boot-start',{visible:true,timeout:120000});
  const policy=await game.evaluate(()=>({
    denied:window.APEX_OWNER_TOOLS?.isCaptureBlockedByPolicy?.(),
    platformPolicy:(document.permissionsPolicy||document.featurePolicy)?.allowsFeature?.('display-capture'),
    embedded:window.parent!==window,
  }));
  assert.equal(policy.embedded,true);
  assert.equal(policy.platformPolicy,false,
    'real Chrome must block display-capture when cross-origin iframe does not delegate it');
  assert.equal(policy.denied,true,'owner F7 checks real permission policy');
  await game.$eval('#apex-boot-start',el=>el.click());
  await game.waitForSelector('#freeBattle',{visible:true,timeout:80000});
  await game.$eval('#freeBattle',el=>el.click());
  await game.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-mode'),{timeout:30000});
  await game.$eval('.modeCard[data-mode="bot"]',el=>el.click());
  await game.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-fighter'),{timeout:40000});
  await game.$eval('#lockIn',el=>el.click());
  await game.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('fighter-active-p2')
    || document.querySelector('#battleHudHost')?.classList.contains('is-open'),{timeout:45000});
  if(!(await game.evaluate(()=>document.querySelector('#battleHudHost')?.classList.contains('is-open')))){
    await game.$eval('#lockIn',el=>el.click());
  }
  await game.waitForFunction(()=>document.querySelector('#battleHudHost')?.classList.contains('is-open')
    && window.APEX_ARSENAL?.state?.active===true
    && window.APEX_ARSENAL?.state?.battleMode==='BOT',{timeout:100000});
  // Keyboard path never calls disallowed getDisplayMedia; it presents a real
  // user-activated external link and an explicit 'restart match' explanation.
  await game.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{
    code:'F7',key:'F7',shiftKey:true,ctrlKey:true,bubbles:true
  })));
  await game.waitForSelector('#apex-owner-standalone-recording',{visible:true,timeout:7000});
  const dialog=await game.evaluate(()=>{
    const box=document.getElementById('apex-owner-standalone-recording');
    const link=box.querySelector('a');
    return {text:box.textContent,href:link.href,target:link.target,
      rel:link.rel,recording:window.APEX_OWNER_TOOLS.isRecording(),
      blocked:window.APEX_OWNER_TOOLS.isCaptureBlockedByPolicy()};
  });
  assert.equal(dialog.recording,false,'no false REC indicator in blocked itch embed');
  assert.equal(dialog.blocked,true);
  assert.equal(dialog.target,'_blank');
  assert.match(dialog.rel,/noopener/);
  assert.equal(dialog.href,game.url(),'opens exact packaged game entry independent of parent iframe');
  assert.match(dialog.text,/tab độc lập/);
  await page.screenshot({path:path.join(output,'policy-denied-itch-f7-modal.png')});
  // This top-level page does not inherit the cross-origin parent's policy;
  // the browser can now request user permission. Headless Chrome cannot
  // stand in for an owner approving the live getDisplayMedia picker.
  const standalone=await browser.newPage();
  await standalone.goto(dialog.href,{waitUntil:'domcontentloaded',timeout:60000});
  await standalone.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
  const direct=await standalone.evaluate(()=>({
    allowed:(document.permissionsPolicy||document.featurePolicy)?.allowsFeature?.('display-capture'),
    blocked:window.APEX_OWNER_TOOLS?.isCaptureBlockedByPolicy?.(),
    top:window.top===window
  }));
  assert.equal(direct.allowed,true,'top-level HTML5 game may use display-capture');
  assert.equal(direct.blocked,false);
  assert.equal(direct.top,true);
  assert.deepEqual(nested.serverErrors,[],'no escaping asset requests in cross-origin policy scenario');
  fs.writeFileSync(path.join(output,'capture-policy-receipt.json'),
    JSON.stringify({pass:true,crossOriginIframe:policy,modal:dialog,standalone:direct},null,2));
  console.log('PASS ITCH DISPLAY-CAPTURE POLICY: cross-origin embed denies F7 safely, opens standalone entry; direct top-level may request capture.');
} finally {
  if(browser) await browser.close();
  if(outer) await new Promise(ok=>outer.close(ok));
  await nested.close();
}
