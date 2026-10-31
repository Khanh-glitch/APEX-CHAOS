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
      directUrl:box.querySelector('#apex-owner-record-direct-url')?.value,
      rel:link.rel,recording:window.APEX_OWNER_TOOLS.isRecording(),
      blocked:window.APEX_OWNER_TOOLS.isCaptureBlockedByPolicy()};
  });
  assert.equal(dialog.recording,false,'no false REC indicator in blocked itch embed');
  assert.equal(dialog.blocked,true);
  assert.equal(dialog.target,'_blank');
  assert.match(dialog.rel,/noopener/);
  const expectedStudio=new URL('portrait-studio.html',game.url()).href;
  assert.equal(dialog.href,expectedStudio,'direct link opens actual phone studio rather than desktop game');
  assert.equal(dialog.directUrl,expectedStudio,'selectable studio URL works if itch sandbox blocks popups');
  assert.match(dialog.text,/432 × 768/);
  await page.screenshot({path:path.join(output,'policy-denied-itch-f7-modal.png')});
  // The same hosted game is opened inside a top-level, same-origin STUDIO,
  // with a real 432×768 iframe viewport. Only that iframe can invoke F7.
  const standalone=await browser.newPage();
  await standalone.setViewport({width:1440,height:900});
  await standalone.goto(dialog.href,{waitUntil:'domcontentloaded',timeout:60000});
  const stage=await standalone.waitForSelector('#apex-portrait-stage',{timeout:15000});
  const phone=await stage.contentFrame();
  assert.ok(phone,'studio iframe exists');
  await phone.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
  const direct=await phone.evaluate(()=>({
    allowed:(document.permissionsPolicy||document.featurePolicy)?.allowsFeature?.('display-capture'),
    blocked:window.APEX_OWNER_TOOLS?.isCaptureBlockedByPolicy?.(),
    studio:window.APEX_OWNER_TOOLS?.isPortraitStudio?.(),
    dims:{w:window.innerWidth,h:window.innerHeight},
    top:window.top===window
  }));
  assert.equal(direct.allowed,true,'same-origin portrait studio iframe may ask for display-capture');
  assert.equal(direct.blocked,false);
  assert.equal(direct.studio,true);
  assert.deepEqual(direct.dims,{w:432,h:768},'phone breakpoint independent of laptop size');
  assert.equal(direct.top,false);
  const region=await standalone.evaluate(()=>window.APEX_PORTRAIT_STUDIO?.getCropRect());
  assert.ok(region && Math.abs(region.width/region.height-9/16)<0.001,
    'live phone frame rectangle stays exactly 9:16');
  await standalone.screenshot({path:path.join(output,'standalone-portrait-studio-1440x900.png')});
  assert.ok(region.left>=0&&region.top>=0&&region.left+region.width<=region.viewportWidth+1
    &&region.top+region.height<=region.viewportHeight+1,'phone region is visible and entirely inside the tab');
  await phone.$eval('#apex-boot-start',el=>el.click());
  await phone.waitForSelector('#freeBattle',{visible:true,timeout:90000});
  await phone.$eval('#freeBattle',el=>el.click());
  await phone.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-mode'),{timeout:30000});
  await phone.$eval('.modeCard[data-mode="bot"]',el=>el.click());
  await phone.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-fighter'),{timeout:40000});
  await standalone.screenshot({path:path.join(output,'portrait-studio-real-fighter-pick.png')});
  await phone.$eval('#lockIn',el=>el.click());
  await phone.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('fighter-active-p2')
    ||document.querySelector('#battleHudHost')?.classList.contains('is-open'),{timeout:45000});
  if(!(await phone.evaluate(()=>document.querySelector('#battleHudHost')?.classList.contains('is-open'))))
    await phone.$eval('#lockIn',el=>el.click());
  await phone.waitForFunction(()=>document.querySelector('#battleHudHost')?.classList.contains('is-open')
    &&window.APEX_ARSENAL?.state?.active&&window.APEX_ARSENAL?.state?.battleMode==='BOT',{timeout:100000});
  await standalone.screenshot({path:path.join(output,'portrait-studio-real-bot-hud.png')});
  // Deterministic test of the actual MediaRecorder source canvas: inject a
  // tab-sized synthetic capture (red everywhere, green ONLY within the real
  // phone iframe). F7 must crop to all-green 1080x1920. A whole-tab recording
  // would produce red pixels on the sides and fail this assertion.
  await phone.evaluate(()=>{
    const original=HTMLCanvasElement.prototype.captureStream;
    HTMLCanvasElement.prototype.captureStream=function(fps){
      const stream=original.call(this,fps);
      if(this.width===1080&&this.height===1920)window.__qaPortraitOutput=this;
      return stream;
    };
    const rect=window.parent.APEX_PORTRAIT_STUDIO.getCropRect();
    const src=document.createElement('canvas');
    src.width=rect.viewportWidth;src.height=rect.viewportHeight;
    const ctx=src.getContext('2d',{alpha:false});
    ctx.fillStyle='#f00000';ctx.fillRect(0,0,src.width,src.height);
    ctx.fillStyle='#00f000';ctx.fillRect(rect.left,rect.top,rect.width,rect.height);
    const stream=src.captureStream(30);
    const track=stream.getVideoTracks()[0];
    track.getSettings=()=>({displaySurface:'browser',width:src.width,height:src.height});
    Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{
      configurable:true,value:()=>Promise.resolve(stream)
    });
    window.__qaSyntheticSource=src;
  });
  await standalone.$eval('#apex-portrait-rec',el=>el.click());
  await phone.waitForFunction(()=>window.APEX_OWNER_TOOLS?.isRecording()===true,{timeout:12000});
  await phone.waitForFunction(()=>{
    const c=window.__qaPortraitOutput;
    if(!c)return false;
    const ctx=c.getContext('2d');
    const p=ctx.getImageData(540,960,1,1).data;
    return p[1]>160&&p[0]<90&&p[2]<90;
  },{timeout:12000});
  const outputAudit=await phone.evaluate(()=>{
    const c=window.__qaPortraitOutput;
    const ctx=c.getContext('2d');
    const sample=(x,y)=>[...ctx.getImageData(x,y,1,1).data];
    return {size:[c.width,c.height],pixels:{
      top:sample(16,16),center:sample(540,960),bottom:sample(1060,1900),
      left:sample(16,960),right:sample(1060,960)
    }};
  });
  assert.deepEqual(outputAudit.size,[1080,1920]);
  for(const [key,p] of Object.entries(outputAudit.pixels)){
    assert.ok(p[1]>160&&p[0]<90&&p[2]<90,
      'cropped '+key+' must be real phone pixels, not surrounding desktop: '+JSON.stringify(outputAudit));
  }
  await standalone.$eval('#apex-portrait-rec',el=>el.click());
  await phone.waitForFunction(()=>window.APEX_OWNER_TOOLS?.isRecording()===false,{timeout:12000});

  assert.deepEqual(nested.serverErrors,[],'no escaping asset requests in cross-origin policy scenario');
  fs.writeFileSync(path.join(output,'capture-policy-receipt.json'),
    JSON.stringify({pass:true,crossOriginIframe:policy,modal:dialog,standalone:direct,outputAudit},null,2));
  console.log('PASS ITCH PORTRAIT STUDIO: cross-origin itch iframe -> real 432x768 Gold BOT battle; synthetic tab capture cropped to ALL phone-only pixels across 1080x1920 MediaRecorder canvas; no desktop edges.');
} finally {
  if(browser) await browser.close();
  if(outer) await new Promise(ok=>outer.close(ok));
  await nested.close();
}
