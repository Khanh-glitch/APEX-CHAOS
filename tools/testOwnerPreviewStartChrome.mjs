// CP5 owner preview START diagnosis: real deployed URL, real Android UA.
// Does not mutate game state; physical START click only after a visible,
// hit-testable button has actually been painted in the destination document.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const url=process.env.APEX_PREVIEW_URL||'https://deploy-preview-62--apexchaos.netlify.app/';
const chromePath=process.env.CHROME_PATH;
if(!chromePath)throw Error('CHROME_PATH is required');
const out=process.env.APEX_EVIDENCE_DIR||'/tmp/apex-preview-start';
fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:chromePath,headless:true,
  args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required']});
const mobileUA='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const cases=[
  {id:'desktop',ua:null,viewport:{width:1440,height:900}},
  {id:'android',ua:mobileUA,viewport:{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}},
];
const snap=()=>`(() => {
  const outer=document;
  const frame=outer.getElementById('gold-document');
  let child=outer;
  try{if(frame?.contentDocument)child=frame.contentDocument}catch(_){}
  const start=child.getElementById('apex-boot-start');
  const img=start?.querySelector('img');
  let geom=null;
  if(start){
    const r=start.getBoundingClientRect(),s=child.defaultView.getComputedStyle(start);
    const cx=r.left+r.width/2,cy=r.top+r.height/2;
    const hit=child.elementFromPoint(cx,cy);
    geom={x:r.x,y:r.y,width:r.width,height:r.height,opacity:s.opacity,display:s.display,
      visibility:s.visibility,zIndex:s.zIndex,hitWithin:hit===start||start.contains(hit)};
  }
  return {
    outerUrl:outer.URL,innerUrl:child.URL,usesViewportIframe:!!frame,
    frameSrc:frame?.src||null,bootError:child.body?.dataset?.apexBootError||null,
    engineReady:!!child.defaultView?.__apexEngineReady,
    goldMounted:child.getElementById('gold-shell-host')?.dataset?.apexGoldMounted||null,
    shellChildren:child.getElementById('gold-shell-host')?.children.length||0,
    stagePresent:!!child.getElementById('stage'),
    homeGeometryInstalled:!!child.defaultView?.__apexHomeGeometryGuard,
    shellNavigateInstalled:typeof child.defaultView?.APEX_GOLD_SHELL_NAVIGATE==='function',
    windowShellReady:!!child.defaultView?.APEX_GOLD?.prepareSurface,
    bridgeReady:!!child.defaultView?.APEX_GOLD,
    audioSfx:child.defaultView?.apexUiSfx?.state?.()||null,
    assets:(()=>{
      const state=child.defaultView?.apexProductAssets?.state?.();if(!state)return null;
      return {scopes:state.scopes,inflight:state.inflight,
        pending:state.records.filter(r=>r.state!=='READY'&&r.state!=='FETCHED')
          .map(r=>({url:r.url,state:r.state,error:r.error})).slice(0,20),
        ready:state.records.filter(r=>r.state==='READY'||r.state==='FETCHED').length,
        total:state.records.length};
    })(),
    scripts:[...child.querySelectorAll('script[src]')].slice(-15).map(s=>({
      src:s.getAttribute('src'),ready:s.dataset.apexLoaded||null,parent:s.parentElement?.id||s.parentElement?.tagName||null
    })),
    scene:child.body?.dataset?.apexSceneTransition||null,
    startPresent:!!start,geom,
    startImage:img?{src:img.currentSrc||img.src,complete:img.complete,naturalWidth:img.naturalWidth}:null,
    themeError:child.defaultView?.__apexBootThemeError||null
  };
})()`;
let failed=0;
try{
 for(const test of cases){
  const page=await browser.newPage(),errors=[],failedRequests=[],warnings=[];
  try{
    if(test.ua)await page.setUserAgent(test.ua);
    await page.setViewport(test.viewport);
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')warnings.push(m.text().slice(0,1200))});
    page.on('requestfailed',req=>failedRequests.push({url:req.url(),reason:req.failure()?.errorText||''}));
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
    let observation=null;
    for(let i=0;i<24;i++){
      observation=await page.evaluate(snap()).catch(e=>({probeError:String(e)}));
      if(observation?.startPresent||observation?.bootError)break;
      await new Promise(r=>setTimeout(r,500));
    }
    console.log('[PREVIEW START] '+test.id+' '+JSON.stringify({observation,errors,warnings,failedRequests}));
    fs.writeFileSync(path.join(out,test.id+'-diagnostics.json'),
      JSON.stringify({observation,errors,failedRequests},null,2));
    await page.screenshot({path:path.join(out,test.id+'-before.png')});
    assert.ok(observation?.startPresent,test.id+' missing START button: '+JSON.stringify(observation));
    assert.ok(observation.geom?.width>50&&observation.geom?.height>20,
      test.id+' START has no usable layout: '+JSON.stringify(observation.geom));
    assert.equal(observation.geom?.visibility,'visible',test.id+' START hidden');
    assert.ok(+observation.geom?.opacity>=.95,test.id+' START transparent');
    assert.ok(observation.geom?.hitWithin,test.id+' START blocked by another element');
    assert.ok(observation.startImage?.naturalWidth>0,test.id+' START artwork failed to decode');

    const frames=page.frames();
    const child=observation.usesViewportIframe
      ? frames.find(f=>f.url()===observation.innerUrl)
      : page.mainFrame();
    assert.ok(child,test.id+' child game frame unavailable');
    await child.click('#apex-boot-start');
    await page.waitForFunction((isMobile)=>{
      const doc=isMobile?document.getElementById('gold-document')?.contentDocument:document;
      return doc?.body?.dataset?.apexSceneTransition==='DONE' &&
        !doc.getElementById('apex-boot-start');
    },{timeout:35000},observation.usesViewportIframe);
    console.log('[PREVIEW START] PASS '+test.id+' real START -> Home');
    await page.screenshot({path:path.join(out,test.id+'-after.png')});
  }catch(error){
    failed++;console.error('[PREVIEW START] FAIL '+test.id+': '+String(error?.stack||error));
    try{await page.screenshot({path:path.join(out,test.id+'-error.png')});}catch(_){}
  }finally{await page.close()}
 }
}finally{await browser.close()}
if(failed)process.exit(1);
console.log('[PREVIEW START] all actual deployed desktop/Android entrypoints PASS');
