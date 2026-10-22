// Owner-reported RA-2 blocker regression: real AchievementToast events over a
// live BOT battle HUD. This presentation-only fixture never writes mastery,
// awards, credits, equipment, or gameplay state.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const CHROME = process.env.CHROME_PATH;
if (!CHROME) throw new Error('CHROME_PATH is required');
const OUT = path.resolve(process.env.RA2_RELEASE_EVIDENCE_DIR || 'docs/acceptance/ra2/evidence/release-blocker/toast-regression');
const CASES = [
  { width:320, height:568, language:'eng' },
  { width:844, height:390, language:'eng' },
  { width:1024, height:768, language:'vie' },
  { width:1844, height:829, language:'vie' },
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await mkdir(OUT, { recursive:true });
const browser = await puppeteer.launch({ executablePath:CHROME, headless:true, args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'] });
const checks=[];
const check=(ok,name,detail)=>{checks.push({ok:!!ok,name,detail});console.log(`${ok?'PASS':'FAIL'} Toast blocker: ${name}${detail===undefined?'':` ${JSON.stringify(detail)}`}`)};

async function openLiveBattle(page, context, {width,height,language}) {
  await page.setViewport({width,height,deviceScaleFactor:1,isMobile:width<600,hasTouch:width<600});
  await page.evaluateOnNewDocument(()=>localStorage.setItem('apex.alpha.coach.v2',JSON.stringify({version:2,step:6,done:true,skipped:true,baselineBotMatches:0,baselineSealedMatches:0})));
  await page.goto(APP,{waitUntil:'domcontentloaded',timeout:65_000});
  await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90_000});
  await page.click('#apex-boot-start');
  await page.waitForSelector('#freeBattle',{visible:true,timeout:60_000});
  await page.waitForFunction(()=>document.body.dataset.apexSceneTransition==='DONE',{timeout:60_000});
  await page.evaluate((lang)=>window.APEX_I18N?.setLanguage?.(lang),language);
  await page.click('#freeBattle');
  await page.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-mode')&&document.body.dataset.apexSceneTransition==='DONE',{timeout:30_000});
  await page.waitForSelector('.modeCard[data-mode="bot"]',{visible:true,timeout:30_000});
  await page.click('.modeCard[data-mode="bot"]');
  await page.waitForFunction(()=>document.querySelector('#stage')?.classList.contains('screen-fighter')&&document.body.dataset.apexSceneTransition==='DONE',{timeout:30_000});
  await page.click('#lockIn'); await page.waitForSelector('.fighter-active-p2',{timeout:30_000});
  await page.click('#lockIn');
  await page.waitForSelector('#battleHudHost.is-open #p1Side .skill',{timeout:60_000});
  await page.waitForFunction(()=>window.APEX_ARSENAL?.state?.active===true&&String(window.APEX_ARSENAL?.state?.battleMode).toUpperCase()==='BOT',{timeout:30_000});
}

async function emit(page, {side,kind,provisional,language}) {
  await page.evaluate(({side,kind,provisional})=>{
    const at=Date.now()+Math.random()*1000;
    window.dispatchEvent(new CustomEvent(provisional?'apex:mastery-provisional':'apex:mastery-unlocked',{detail:{unlocks:[{
      achievementId:'steady-hand',heroId:side==='P1'?'ROBOT':'NEWBOT',ownerSide:side,ownerKind:kind,
      walletEligible:kind==='human',battleMode:'BOT',value:8,at,
    }]}}));
  },{side,kind,provisional,language});
  await page.waitForSelector(`.apex-achievement-toast[data-owner-side="${side}"][data-provisional="${provisional?'true':'false'}"]`,{timeout:12_000});
  await sleep(320);
  return page.evaluate(({side,language})=>{
    const toast=document.querySelector(`.apex-achievement-toast[data-owner-side="${side}"]`);
    if(!toast)return null;
    const box=toast.getBoundingClientRect();
    const selectors=[
      '#p1Side .skill','#p2Side .skill','#p1Side .skill .sk-name','#p2Side .skill .sk-name',
      '#p1Side .skill .sk-meter','#p2Side .skill .sk-meter','#p1Side .skill .sk-state','#p2Side .skill .sk-state',
      '#p1Side .weapon','#p2Side .weapon','#p1Rail','#p2Rail','#matchCenter','#arena','#arenaCanvas',
      '#apexFirstPlayGuide','#firstPlayGuide','.apex-first-play-guide','.first-play-guide','[data-apex-first-play-guide]'
    ];
    const nodes=[...new Set(selectors.flatMap((selector)=>{try{return [...document.querySelectorAll(selector)]}catch{return []}}))];
    const overlaps=(a,b)=>!!a&&!!b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    const style=getComputedStyle(toast);
    const blockers=nodes.map((el)=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{selector:el.id?`#${el.id}`:el.className?.baseVal||el.className||el.tagName,box:r.toJSON(),visible:s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.width>0&&r.height>0,overlap:overlaps(box,r)}}).filter((item)=>item.visible);
    const visible=style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0&&box.width>0&&box.height>0;
    return{
      ownerSide:toast.dataset.ownerSide,ownerKind:toast.dataset.ownerKind,provisional:toast.dataset.provisional,
      walletEligible:toast.dataset.walletEligible,role:toast.getAttribute('role'),ariaLive:toast.getAttribute('aria-live'),
      title:toast.querySelector('strong')?.textContent.trim(),text:toast.innerText.replace(/\\s+/g,' ').trim(),
      visible,opacity:style.opacity,box:box.toJSON(),overlaps:blockers.filter((item)=>item.overlap),blockers,
      valueText:[...toast.querySelectorAll('.apex-achievement-toast-meter em')].map((el)=>el.textContent.trim()),
      layoutSafe:toast.dataset.dockSafe||null,viewport:{width:innerWidth,height:innerHeight},language,
    };
  },{side,language});
}

try {
  const measurements=[];
  for(const config of CASES){
    const context=await browser.createBrowserContext();
    const page=await context.newPage();
    const errors=[];page.on('pageerror',(error)=>errors.push(String(error)));
    await openLiveBattle(page,context,config);
    const baseline=await page.evaluate(()=>({credits:window.APEX_ARSENAL_META?.credits?.(),mastery:JSON.stringify(window.APEX_ARSENAL_META?.getMastery?.()||{}),coach:window.APEX_LEARN_BY_PLAYING?.state?.()}));
    assert.equal(baseline.coach?.done,true,'real First Play guide stays closed during geometry probe');

    const p1Provisional=await emit(page,{side:'P1',kind:'human',provisional:true,language:config.language});
    const expectedTitle=config.language==='vie'?'Tay Súng Vững':'Steady Hand';
    check(p1Provisional.title===expectedTitle,`${config.language} ${config.width}x${config.height}: P1 steady-hand uses the selected locale`,p1Provisional);
    check(p1Provisional.role==='status'&&p1Provisional.ariaLive==='polite'&&p1Provisional.walletEligible==='true'
      &&p1Provisional.provisional==='true'&&p1Provisional.ownerSide==='P1',`${config.width}x${config.height}: P1 candidate retains its accessible provisional ownership semantics`,p1Provisional);
    check(p1Provisional.valueText.some((value)=>value.includes('8')&&value.includes('6')),`${config.width}x${config.height}: 8-of-6 event meter remains actual and readable`,p1Provisional.valueText);
    check(p1Provisional.visible?p1Provisional.overlaps.length===0:true,`${config.width}x${config.height}: visible P1 toast covers no skill, weapon, HP, arena, or tutorial lane`,p1Provisional.overlaps);
    const p1Shot=(config.width===844&&config.language==='eng')||(config.width===1844&&config.language==='vie');
    if(p1Shot)await page.screenshot({path:path.join(OUT,`steady-hand-${config.language}-p1-provisional-${config.width}x${config.height}.png`)});
    measurements.push(p1Provisional);
    await page.waitForFunction(()=>!document.querySelector('.apex-achievement-toast'),{timeout:9_000});

    const p2Provisional=await emit(page,{side:'P2',kind:'bot',provisional:true,language:config.language});
    check(p2Provisional.ownerSide==='P2'&&p2Provisional.ownerKind==='bot'&&p2Provisional.walletEligible==='false'
      &&p2Provisional.provisional==='true'&&p2Provisional.title===expectedTitle,`${config.width}x${config.height}: P2 BOT provisional is visibly and semantically distinct`,p2Provisional);
    check(p2Provisional.visible?p2Provisional.overlaps.length===0:true,`${config.width}x${config.height}: BOT toast covers no gameplay status`,p2Provisional.overlaps);
    measurements.push(p2Provisional);
    await page.waitForFunction(()=>!document.querySelector('.apex-achievement-toast'),{timeout:8_000});

    const p1Sealed=await emit(page,{side:'P1',kind:'human',provisional:false,language:config.language});
    check(p1Sealed.ownerSide==='P1'&&p1Sealed.ownerKind==='human'&&p1Sealed.walletEligible==='true'
      &&p1Sealed.provisional==='false'&&p1Sealed.title===expectedTitle,`${config.width}x${config.height}: sealed P1 toast retains its canonical state`,p1Sealed);
    check(p1Sealed.visible?p1Sealed.overlaps.length===0:true,`${config.width}x${config.height}: sealed toast covers no gameplay status`,p1Sealed.overlaps);
    if(config.width===320&&config.language==='eng')await page.screenshot({path:path.join(OUT,`steady-hand-eng-p1-sealed-${config.width}x${config.height}.png`)});
    measurements.push(p1Sealed);

    await page.waitForFunction(()=>!document.querySelector('.apex-achievement-toast'),{timeout:10_000});
    const ending=await page.evaluate(()=>({credits:window.APEX_ARSENAL_META?.credits?.(),mastery:JSON.stringify(window.APEX_ARSENAL_META?.getMastery?.()||{})}));
    check(ending.credits===baseline.credits&&ending.mastery===baseline.mastery,`${config.width}x${config.height}: feedback events do not mutate the wallet or mastery ledger`,ending);
    check(errors.length===0,`${config.width}x${config.height}: no browser errors`,errors);
    await context.close();
  }
  const report={cases:CASES,achievement:'steady-hand',actualEventValue:8,criterion:6,measurements,checks};
  await writeFile(path.join(OUT,'toast-layout-report.json'),JSON.stringify(report,null,2)+'\n');
  assert.ok(checks.every((item)=>item.ok),'all visible provisional/sealed P1/P2 toast states must clear the gameplay HUD');
} finally {
  await browser.close();
}
