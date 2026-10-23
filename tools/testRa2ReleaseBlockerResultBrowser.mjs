// Owner-reported RA-2 blocker regression: exact sealed BOT Result (1:18,
// SHURI victory / NEWBOT defeat, STORMBREAKER, 1,448 vs 992, 21 vs 17).
// Every award and weapon is produced by the native Result ledger; no payload
// fields are edited after seal. Screenshots are full Chromium viewports.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const CHROME = process.env.CHROME_PATH;
if (!CHROME) throw new Error('CHROME_PATH is required');
const OUT = path.resolve(process.env.RA2_RELEASE_EVIDENCE_DIR || 'docs/acceptance/ra2/evidence/release-blocker/result-regression');
const VIEWPORTS = [[1844,829],[1440,900],[1560,992],[844,390],[390,844]];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await mkdir(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const checks = [];
const check = (ok, name, detail) => { checks.push({ ok: !!ok, name, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} Result blocker: ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`); };
const appWindow = 'window.__apexGoldFidelity?.child() || window';

async function measure(viewport, language, phase) {
  return page.evaluate(({ viewport, language, phase }) => {
    const w = window.__apexGoldFidelity?.child() || window;
    const d = w.document.querySelector('#ra2-release-blocker-result')?.contentDocument;
    if (!d) return { viewport, language, phase, missingFrame: true };
    const rect = (element) => {
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
    };
    const intersects = (a, b) => !!a && !!b && a.x < b.right - 1 && a.right > b.x + 1 && a.y < b.bottom - 1 && a.bottom > b.y + 1;
    const visible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && element.getClientRects().length > 0;
    };
    const images = [...d.querySelectorAll('.hero__img,.wart--img')].map((image) => ({
      src: image.currentSrc || image.src,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      decoded: image.complete && image.naturalWidth > 0,
      style: { display:getComputedStyle(image).display, opacity:getComputedStyle(image).opacity,
        visibility:getComputedStyle(image).visibility, transform:getComputedStyle(image).transform },
      box: rect(image),
    }));
    const weaponArt = d.querySelector('.wart--img');
    const artBox = rect(weaponArt);
    const daisBox = rect(d.querySelector('.weapon__dais'));
    // The approved hover-tilt is a 3D transform; its axis-aligned DOM box can
    // extend a few pixels beyond the untransformed dais without painted art
    // escaping. Actual weapon/text intersections below remain zero-tolerance.
    const artContained = !!artBox && !!daisBox && artBox.width > 0 && artBox.height > 0
      && artBox.x >= daisBox.x - 5 && artBox.right <= daisBox.right + 5
      && artBox.y >= daisBox.y - 5 && artBox.bottom <= daisBox.bottom + 5;
    const artVsTextSelectors = ['.weapon__title','.weapon__name','.weapon__class','.weapon__dmg','.weapon__facts','.weapon__owner'];
    const artVsText = artVsTextSelectors.flatMap((selector) => [...d.querySelectorAll(selector)]
      .filter(visible).map((element) => ({ selector, text:element.innerText.trim(), box:rect(element), overlap:intersects(artBox,rect(element)) })));
    // Verdicts use intentionally stacked letters and an aria/text duplicate;
    // their scrollWidth is not a clipping signal. Keep visible identity, score,
    // damage-gap and weapon-copy lanes in the overflow check.
    const textSelectors = ['.hero__who','.hero__char','.hero__stats dd','.clash__num','.clash__mid','.weapon__title','.weapon__name .mask > span','.weapon__class','.weapon__dmg-num','.weapon__unit','.weapon__owner b'];
    const textBoxes = textSelectors.flatMap((selector) => [...d.querySelectorAll(selector)].filter(visible)
      .map((element) => ({ selector, text:element.innerText.trim(), box:rect(element), scrollWidth:element.scrollWidth, clientWidth:element.clientWidth })));
    const pairwiseTextOverlaps = [];
    for (let i=0;i<textBoxes.length;i++) for (let j=i+1;j<textBoxes.length;j++) {
      if (textBoxes[i].selector === textBoxes[j].selector) continue;
      if (intersects(textBoxes[i].box,textBoxes[j].box)) pairwiseTextOverlaps.push([textBoxes[i],textBoxes[j]]);
    }
    const playerImages = images.filter((image) => /shuri\/standing\.webp|newbot\/pick_selected_large\.webp/i.test(image.src));
    const heroText = [...d.querySelectorAll('.hero__who,.hero__char,.hero__verdict')].filter(visible).map((e) => rect(e));
    const portraitTextOverlaps = images.slice(0,2).map((image) => heroText.some((box) => intersects(image.box,box)));
    const root = d.querySelector('.ac-root');
    const result = {
      viewport, language:d.documentElement.lang, phase, run:d.querySelector('.ac-run')?.className,
      duration:d.querySelector('.topbar')?.innerText.match(/\d+:\d+/)?.[0] || null,
      scoreText:[...d.querySelectorAll('.clash__num')].map((el)=>el.innerText.replace(/\s+/g,' ').trim()),
      awardCounts:[...d.querySelectorAll('.rack__count')].map((el)=>el.textContent.trim()),
      images, playerImages, portraitTextOverlaps, weaponDais:daisBox, weaponArtContained:artContained,
      artVsText, pairwiseTextOverlaps, textOverflow:textBoxes.filter((item)=>item.scrollWidth>item.clientWidth+1),
      rootScroll:{clientWidth:root?.clientWidth,scrollWidth:root?.scrollWidth,clientHeight:root?.clientHeight,scrollHeight:root?.scrollHeight,scrollTop:root?.scrollTop},
      sourceWeapon:weaponArt?.currentSrc || weaponArt?.src || '', placeholders:[...d.querySelectorAll('.art-tag')].filter(visible).map((el)=>el.textContent.trim()),
    };
    return result;
  }, { viewport, language, phase });
}

try {
  await page.setViewport({ width: VIEWPORTS[0][0], height: VIEWPORTS[0][1], deviceScaleFactor: 1, isMobile: false, hasTouch: true });
  await page.goto(APP, { waitUntil:'domcontentloaded', timeout:70_000 });
  await page.waitForSelector('#apex-boot-start', { visible:true, timeout:90_000 });
  await page.click('#apex-boot-start');
  await page.waitForSelector('#freeBattle', { visible:true, timeout:60_000 });
  await page.click('#freeBattle');
  await page.waitForFunction(() => document.body.dataset.apexSceneTransition === 'DONE', { timeout:60_000 });
  await page.waitForFunction(() => { const w=window.__apexGoldFidelity?.child()||window; return w.APEX_I18N && w.APEX_ARSENAL_CONFIG; }, { timeout:45_000 });
  const sealed = await page.evaluate(async () => {
    const w = window.__apexGoldFidelity?.child() || window;
    w.APEX_I18N.setLanguage('eng');
    if (!w.APEX_MATCH_RESULT_AUTHORITY) {
      for (const src of ['/game/arsenal/arsenalConfig.js','/game/arsenal/arsenalCWeaponSet.generated.js','/game/results/ownerAwards.generated.js','/game/results/matchResultAuthority.js']) {
        await new Promise((resolve,reject) => { const script=w.document.createElement('script'); script.src=src; script.onload=resolve; script.onerror=()=>reject(new Error(`failed to load ${src}`)); w.document.head.appendChild(script); });
      }
    }
    const cfg=w.APEX_ARSENAL_CONFIG;
    const family=(name)=>Object.keys(cfg.WEAPONS).find((id)=>cfg.WEAPONS[id].family===name);
    const ids={ storm:'STORMBREAKER', pistol:family('SEMI'), shotgun:family('SHOTGUN'), auto:family('AUTO'), burst:family('BURST'), precision:family('PRECISION'), melee:(cfg.MELEE_WEAPON_IDS||[]).find((id)=>id!=='STORMBREAKER') };
    const p1={id:1,name:'SHURI',x:0,y:450,hp:5500,maxHp:50000,vx:200,vy:0};
    const p2={id:2,name:'NEWBOT',x:1000,y:450,hp:1448,maxHp:3000,vx:-200,vy:0};
    const ledger=w.APEX_MATCH_RESULT_AUTHORITY.create({actors:[p1,p2],mode:'BOT',startedAt:1720000000000,weaponConfig:cfg});
    p1.x=600; p2.x=1600; ledger.tick(72);
    const hit=(attacker,victim,id,amount,final=false)=>{ victim.hp=Math.max(0,victim.hp-amount); ledger.onDamage(victim,attacker,'arsenal-'+id.toLowerCase().replaceAll('_','-'),amount,false,null,final?{final:true}:null); };
    const pistol=(attacker,victim,parts,pickEach=false)=>{ for(let i=0;i<10;i++)ledger.onShot(attacker,ids.pistol); for(let i=10-parts.length;i>0;i--)ledger.onMiss(attacker); for(const amount of parts){if(pickEach)ledger.onPickup(attacker,ids.pistol);hit(attacker,victim,ids.pistol,amount);} };
    ledger.onPickup(p1,ids.pistol); pistol(p1,p2,Array(5).fill(32));
    hit(p1,p2,ids.shotgun,300); hit(p1,p2,ids.auto,220); hit(p1,p2,ids.burst,1); hit(p1,p2,ids.precision,1); hit(p1,p2,ids.melee,1); hit(p1,p2,ids.storm,465);
    ledger.tick(1); ledger.tick(5);
    pistol(p2,p1,Array(5).fill(32),true);
    for(const [id,amount] of [[ids.shotgun,300],[ids.auto,220],[ids.storm,309],[ids.burst,1],[ids.precision,1],[ids.melee,1]]){ledger.onPickup(p2,id);hit(p2,p1,id,amount);}
    ledger.onBlocked(p1,250); ledger.onBlocked(p2,250); ledger.onPickup(p1,ids.storm); hit(p1,p2,ids.storm,300,true);
    const match=ledger.seal('P1');
    const iframe=w.document.createElement('iframe'); iframe.id='ra2-release-blocker-result'; iframe.src='/result-gold/index.html';
    iframe.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483600;border:0'; w.document.body.appendChild(iframe);
    w.__ra2ReleaseBlockerMatch=match;
    return {duration:match.meta.durationSec,scores:match.players.map((p)=>p.damage.dealt),outcomes:match.players.map((p)=>p.outcome),awards:match.players.map((p)=>p.awards.length),weapon:match.weaponOfTheBattle.weaponId,id:match.meta.id,actors:match.players.map((p)=>p.character.name)};
  });
  check(sealed.duration===78 && JSON.stringify(sealed.scores)==='[1448,992]' && JSON.stringify(sealed.outcomes)==='["victory","defeat"]'
    && JSON.stringify(sealed.awards)==='[21,17]' && sealed.weapon==='STORMBREAKER' && JSON.stringify(sealed.actors)==='["SHURI","NEWBOT"]',
    'native sealed fixture exactly matches owner Result scenario', sealed);
  await page.waitForFunction(() => {const w=window.__apexGoldFidelity?.child()||window;return !!w.document.querySelector('#ra2-release-blocker-result')?.contentDocument?.querySelector('.ac-root');},{timeout:45_000});
  await page.evaluate(() => {const w=window.__apexGoldFidelity?.child()||window;const frame=w.document.querySelector('#ra2-release-blocker-result');frame.contentWindow.postMessage({type:'APEX_RESULT_GOLD_PAYLOAD',match:w.__ra2ReleaseBlockerMatch},w.location.origin);});
  await page.waitForFunction(() => {const w=window.__apexGoldFidelity?.child()||window;return w.document.querySelector('#ra2-release-blocker-result')?.contentDocument?.querySelectorAll('.hero').length===2;},{timeout:45_000});

  const early=await measure({width:1844,height:829},'eng','early');
  await page.screenshot({path:path.join(OUT,'dense-native-21v17-eng-1844x829-early.png')});
  check(!early.missingFrame && early.images.length===3 && early.images.every((image)=>image.decoded)
    && /STORMBREAKER\.webp$/i.test(early.sourceWeapon), 'early phase loads the two real portraits and canonical STORMBREAKER art', early.images);
  await page.evaluate(() => {const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#ra2-release-blocker-result').contentDocument.querySelector('.skip')?.click();});
  await page.waitForFunction(() => {const w=window.__apexGoldFidelity?.child()||window;return w.document.querySelector('#ra2-release-blocker-result')?.contentDocument?.querySelector('.ac-run.is-done');},{timeout:20_000});
  await page.screenshot({path:path.join(OUT,'dense-native-21v17-eng-1844x829-postskip.png')});
  await sleep(1800);

  const runSettled = async (language,width,height) => {
    await page.evaluate((lang)=>{const app=window.__apexGoldFidelity?.child()||window;app.APEX_I18N.setLanguage(lang);const root=app.document.querySelector('#ra2-release-blocker-result')?.contentDocument?.querySelector('.ac-root');if(root)root.scrollTop=0;},language);
    await page.waitForFunction((lang)=>{const app=window.__apexGoldFidelity?.child()||window;return app.document.querySelector('#ra2-release-blocker-result')?.contentDocument?.documentElement.lang===(lang==='vie'?'vi':'en');},{timeout:20_000},language);
    await page.setViewport({width,height,deviceScaleFactor:1,isMobile:false,hasTouch:true});
    await page.evaluate(()=>{const app=window.__apexGoldFidelity?.child()||window;const root=app.document.querySelector('#ra2-release-blocker-result')?.contentDocument?.querySelector('.ac-root');if(root)root.scrollTop=0;});
    await sleep(350);
    const result=await measure({width,height},language,'post-settle');
    await page.screenshot({path:path.join(OUT,`dense-native-21v17-${language}-${width}x${height}-settled.png`)});
    const expectedPortraits=['/assets/dictionary/heroes/shuri/standing.webp','/assets/gold-ui/heroes/newbot/pick_selected_large.webp'];
    const portraitSources=result.images.slice(0,2).map((image)=>image.src.split('?')[0]);
    const portraitsPresent=result.playerImages.length===2 && result.playerImages.every((image)=>image.decoded && image.box?.width>0 && image.box?.height>0)
      && expectedPortraits.every((src)=>portraitSources.some((actual)=>actual.endsWith(src)));
    const weaponPresent=result.images[2]?.decoded && /STORMBREAKER\.webp$/i.test(result.images[2]?.src||'')
      && result.images[2]?.box?.width>0 && result.images[2]?.box?.height>0;
    check(portraitsPresent,`${language} ${width}x${height}: real SHURI and NEWBOT portraits are painted at non-zero size`,result.playerImages);
    check(weaponPresent,`${language} ${width}x${height}: declared STORMBREAKER art is loaded and painted`,result.images[2]);
    check(result.weaponArtContained,`${language} ${width}x${height}: weapon art stays inside its authored dais`,{art:result.images[2]?.box,dais:result.weaponDais});
    check(result.artVsText.every((item)=>!item.overlap),`${language} ${width}x${height}: canonical weapon art does not cover weapon names, damage, gap or contributor labels`,result.artVsText.filter((item)=>item.overlap));
    check(result.portraitTextOverlaps.every((overlap)=>!overlap),`${language} ${width}x${height}: approved hero portraits do not cover identity or verdict copy`,result.portraitTextOverlaps);
    check(result.textOverflow.length===0,`${language} ${width}x${height}: important Result labels do not clip within their authored lanes`,result.textOverflow);
    const ownerValuesVisible=result.scoreText.some((value)=>value.includes('1,448'))&&result.scoreText.some((value)=>value.includes('992'))
      &&result.awardCounts.includes('21')&&result.awardCounts.includes('17')
      &&((width>=1180&&result.duration==='1:18')||(width<1180));
    check(ownerValuesVisible,`${language} ${width}x${height}: sealed owner values remain visible and unchanged wherever authored copy is shown`,{scoreText:result.scoreText,awardCounts:result.awardCounts,duration:result.duration});
    check(result.rootScroll.scrollWidth<=result.rootScroll.clientWidth+1,`${language} ${width}x${height}: no horizontal Result overflow`,result.rootScroll);
    return result;
  };

  const matrix=[];
  for (const language of ['eng','vie']) for (const [width,height] of VIEWPORTS) matrix.push(await runSettled(language,width,height));

  // Short-landscape interaction regression. The Gold Result stays unchanged:
  // prove its own scroll container is discoverable and its real CONTINUE
  // button is reachable/activatable through mouse, touch, and keyboard.
  await page.setViewport({width:844,height:390,deviceScaleFactor:1,isMobile:false,hasTouch:true});
  await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;w.APEX_I18N.setLanguage('eng');const root=w.document.querySelector('#ra2-release-blocker-result')?.contentDocument?.querySelector('.ac-root');if(root)root.scrollTop=0;});
  await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;return w.document.querySelector('#ra2-release-blocker-result')?.contentDocument?.documentElement.lang==='en';},{timeout:15_000});
  await sleep(220);
  const shortFrame=await page.$('#ra2-release-blocker-result');
  const shortGold=await shortFrame.contentFrame();
  await shortGold.evaluate(()=>{
    const parent=window.parent;
    parent.__ra2ContinueCaptures=[];
    const original=parent.postMessage.bind(parent);
    parent.__ra2OriginalPostMessage=original;
    parent.postMessage=(message,targetOrigin)=>{
      if(message?.type==='APEX_RESULT_GOLD_CONTINUE'){
        parent.__ra2ContinueCaptures.push({message,targetOrigin});
        return;
      }
      return original(message,targetOrigin);
    };
  });
  const readContinue=()=>shortGold.evaluate(()=>{
    const d=document;
    const root=d.querySelector('.ac-root');
    const button=d.querySelector('.dock .btn--primary');
    if(!root||!button)return {missingRoot:!root,missingButton:!button};
    const r=button.getBoundingClientRect(),rr=root.getBoundingClientRect(),cs=getComputedStyle(root),bs=getComputedStyle(button);
    const cueElement=d.querySelector('.ac-scroll-hint'),cueStyle=cueElement?getComputedStyle(cueElement):null,cueBox=cueElement?.getBoundingClientRect();
    return {label:button.innerText.replace(/\s+/g,' ').trim(),disabled:button.disabled,
      scrollCue:{text:cueElement?.textContent.trim()||'',position:cueStyle?.position||'',height:cueStyle?.height||'',display:cueStyle?.display||'none',
        visible:!!cueElement&&cueElement.getClientRects().length>0&&cueBox?.bottom<=innerHeight&&cueBox?.top>=0},
      root:{clientWidth:root.clientWidth,scrollWidth:root.scrollWidth,clientHeight:root.clientHeight,scrollHeight:root.scrollHeight,scrollTop:root.scrollTop,
        overflowY:cs.overflowY,scrollbarWidth:cs.scrollbarWidth,scrollbarColor:cs.scrollbarColor,box:{left:rr.left,top:rr.top,right:rr.right,bottom:rr.bottom}},
      button:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,
        visible:bs.display!=='none'&&bs.visibility!=='hidden'&&Number(bs.opacity)>0&&r.width>0&&r.height>0,
        inViewport:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight},
      focused:d.activeElement===button};
  });
  const initialContinue=await readContinue();
  check(!initialContinue.missingRoot&&!initialContinue.missingButton&&initialContinue.root.overflowY==='auto'
    &&initialContinue.root.clientHeight===390&&initialContinue.root.scrollHeight>initialContinue.root.clientHeight
    &&initialContinue.root.scrollbarWidth==='thin'&&initialContinue.root.scrollbarColor.includes('244, 196, 48')
    &&initialContinue.scrollCue.text==='SCROLL DOWN FOR CONTINUE'&&initialContinue.scrollCue.position==='fixed'
    &&initialContinue.scrollCue.display!=='none'&&initialContinue.scrollCue.visible,
    '844x390 exposes real vertical overflow, a styled scrollbar and a visible scroll-to-continue cue',initialContinue);
  check(initialContinue.disabled===false&&initialContinue.button.visible,
    'short-landscape CONTINUE is present, enabled and painted in the Gold result',initialContinue);
  await page.screenshot({path:path.join(OUT,'short-landscape-844x390-result-at-scroll-start.png')});

  const scrollWithWheel=async()=>{
    await shortGold.evaluate(()=>{const root=document.querySelector('.ac-root');if(root)root.scrollTop=0;});
    for(let i=0;i<10;i++){
      await page.mouse.move(420,300);
      await page.mouse.wheel({deltaY:220});
      await sleep(90);
      const state=await readContinue();
      if(state.button?.inViewport&&!state.button?.disabled)break;
    }
    return readContinue();
  };
  const mouseReached=await scrollWithWheel();
  check(mouseReached.root.scrollTop>0&&mouseReached.button.inViewport&&!mouseReached.disabled,
    'mouse wheel discovers the short-landscape scroll path and brings CONTINUE into view',mouseReached);
  await page.screenshot({path:path.join(OUT,'short-landscape-844x390-result-continue-reached.png')});
  await page.mouse.click((mouseReached.button.left+mouseReached.button.right)/2,(mouseReached.button.top+mouseReached.button.bottom)/2);
  await page.waitForFunction(()=>window.__ra2ContinueCaptures?.length===1,{timeout:8_000}).catch(()=>{});
  const mouseActivation=await page.evaluate(()=>window.__ra2ContinueCaptures?.[0]||null);
  check(mouseActivation?.message?.type==='APEX_RESULT_GOLD_CONTINUE'&&mouseActivation.message.matchId===sealed.id,
    'mouse activation posts the actual sealed match CONTINUE action',mouseActivation);

  await shortGold.evaluate(()=>{const root=document.querySelector('.ac-root');if(root)root.scrollTop=0;});
  for(let i=0;i<10;i++){
    await page.touchscreen.touchStart(420,320);
    await page.touchscreen.touchMove(420,90);
    await page.touchscreen.touchEnd();
    await sleep(100);
    const state=await readContinue();
    if(state.button?.inViewport&&!state.disabled)break;
  }
  const touchReached=await readContinue();
  check(touchReached.root.scrollTop>0&&touchReached.button.inViewport&&!touchReached.disabled,
    'touch swipe discovers the short-landscape scroll path and reaches CONTINUE',touchReached);
  await page.touchscreen.tap((touchReached.button.left+touchReached.button.right)/2,(touchReached.button.top+touchReached.button.bottom)/2);
  await page.waitForFunction(()=>window.__ra2ContinueCaptures?.length===2,{timeout:8_000}).catch(()=>{});
  const touchActivation=await page.evaluate(()=>window.__ra2ContinueCaptures?.[1]||null);
  check(touchActivation?.message?.type==='APEX_RESULT_GOLD_CONTINUE'&&touchActivation.message.matchId===sealed.id,
    'touch activation posts the actual sealed match CONTINUE action',touchActivation);

  await shortGold.evaluate(()=>{const root=document.querySelector('.ac-root');if(root)root.scrollTop=0;const first=[...root.querySelectorAll('button:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])')].find(el=>el.getClientRects().length);first?.focus();});
  let keyboardReached=null;
  for(let i=0;i<160;i++){
    await page.keyboard.press('Tab');
    keyboardReached=await readContinue();
    if(keyboardReached.focused)break;
  }
  check(!!keyboardReached?.focused&&keyboardReached.button.inViewport&&keyboardReached.root.scrollTop>0&&!keyboardReached.disabled,
    'keyboard Tab traversal scrolls the Result to the enabled CONTINUE control',keyboardReached);
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.__ra2ContinueCaptures?.length===3,{timeout:8_000}).catch(()=>{});
  const keyboardActivation=await page.evaluate(()=>window.__ra2ContinueCaptures?.[2]||null);
  check(keyboardActivation?.message?.type==='APEX_RESULT_GOLD_CONTINUE'&&keyboardActivation.message.matchId===sealed.id,
    'keyboard Enter activates the actual sealed match CONTINUE action',keyboardActivation);
  const shortLandscape={initial:initialContinue,mouseReached,mouseActivation,touchReached,touchActivation,keyboardReached,keyboardActivation,
    captures:await page.evaluate(()=>window.__ra2ContinueCaptures||[])};
  await page.evaluate(()=>{if(window.__ra2OriginalPostMessage)window.postMessage=window.__ra2OriginalPostMessage;delete window.__ra2OriginalPostMessage;});

  check(errors.length===0,'no uncaught browser errors',errors);
  const report={sealedFixture:sealed,viewports:VIEWPORTS,languages:['eng','vie'],phases:['early','post-skip','post-settle'],early,shortLandscape,checks,measurements:matrix,browserErrors:errors};
  await writeFile(path.join(OUT,'result-overlap-report.json'),JSON.stringify(report,null,2)+'\n');
  assert.ok(checks.every((item)=>item.ok),'owner Result art and short-landscape CONTINUE checks must pass');
} finally {
  await browser.close();
}
