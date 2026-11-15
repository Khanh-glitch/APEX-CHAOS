// RA-2 audit-only Result Gold ENG/VIE parity against a real sealed ledger.
// This is live Chromium DOM verification; it does not alter Result presentation.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const CHROME=process.env.CHROME_PATH;
const BASE=process.env.APEX_APP_URL||'http://127.0.0.1:5173/';
if(!CHROME)throw Error('CHROME_PATH is required');
const OUT='docs/acceptance/ra2/evidence/result';
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
await mkdir(OUT,{recursive:true});
const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
const pass=(name,detail)=>console.log('PASS RA-2 Result locale: '+name+(detail===undefined?'':' '+JSON.stringify(detail)));
const fail=(name,detail)=>{console.error('FAIL RA-2 Result locale: '+name+' '+JSON.stringify(detail));assert.fail(name)};
const W=()=>window.__apexGoldFidelity?.child()||window;
const textAudit=`(()=>{const d=document.querySelector('#ra2-result-locale-frame')?.contentDocument;if(!d)return null;const root=d.querySelector('.ac-root')||d.body;const text=(root.innerText||'').trim();const attrs=[...root.querySelectorAll('[aria-label],[title],[alt]')].flatMap(e=>['aria-label','title','alt'].map(a=>e.getAttribute(a))).filter(Boolean);return{lang:d.documentElement.lang,text,attrs,heroes:[...d.querySelectorAll('.hero__char b')].map(e=>e.textContent.trim()),done:!!d.querySelector('.ac-run.is-done'),visible:text.slice(0,2800)}})()`;
try{
 const page=await browser.newPage();
 await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:70000});
 await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
 await page.click('#apex-boot-start');
 await page.waitForSelector('#freeBattle',{visible:true,timeout:60000});
 await page.waitForFunction(()=>window.APEX_I18N||window.__apexGoldFidelity?.child()?.APEX_I18N,{timeout:30000});
 const setup=await page.evaluate(async()=>{
  const w=window.__apexGoldFidelity?.child()||window;
  if(!w.APEX_I18N||!w.APEX_MATCH_RESULT_AUTHORITY){
   const scripts=['/game/arsenal/arsenalConfig.js','/game/arsenal/arsenalCWeaponSet.generated.js','/game/results/ownerAwards.generated.js','/game/results/matchResultAuthority.js'];
   for(const src of scripts){if(w.document.querySelector(`script[data-ra2-result="${src}"]`))continue;await new Promise((resolve,reject)=>{const e=w.document.createElement('script');e.src=src;e.dataset.ra2Result=src;e.onload=resolve;e.onerror=()=>reject(new Error('Unable to load '+src));w.document.head.appendChild(e)});}
  }
  w.APEX_I18N.setLanguage('eng');
  const actors=[{id:1,name:'SHURI',x:180,y:450,hp:1000,maxHp:1000},{id:2,name:'NEWBOT',x:820,y:450,hp:1000,maxHp:1000}];
  const ledger=w.APEX_MATCH_RESULT_AUTHORITY.create({actors,mode:'BOT',startedAt:1720000000000,weaponConfig:w.APEX_ARSENAL_CONFIG});
  ledger.onPickup(actors[0],'PISTOL');ledger.onPickup(actors[1],'PISTOL');ledger.onShot(actors[0],'PISTOL');actors[1].hp=0;ledger.onDamage(actors[1],actors[0],'arsenal-pistol',1000);
  const match=ledger.seal('P1');
  const frame=w.document.createElement('iframe');frame.id='ra2-result-locale-frame';frame.src='/result-gold/index.html';frame.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483600;border:0';w.document.body.appendChild(frame);
  return {id:match.meta.id,players:match.players.map(p=>p.character.name),weaponCount:match.weapons.length};
 });
 pass('native result ledger sealed; frame attached',setup);
 await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;return !!w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('.ac-root')},{timeout:45000});
 await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;const f=w.document.querySelector('#ra2-result-locale-frame');const actors=[{id:1,name:'SHURI',x:180,y:450,hp:1000,maxHp:1000},{id:2,name:'NEWBOT',x:820,y:450,hp:1000,maxHp:1000}];const ledger=w.APEX_MATCH_RESULT_AUTHORITY.create({actors,mode:'BOT',startedAt:1720000000000,weaponConfig:w.APEX_ARSENAL_CONFIG});ledger.onPickup(actors[0],'PISTOL');ledger.onShot(actors[0],'PISTOL');actors[1].hp=0;ledger.onDamage(actors[1],actors[0],'arsenal-pistol',1000);const match=ledger.seal('P1');f.contentWindow.postMessage({type:'APEX_RESULT_GOLD_PAYLOAD',match},w.location.origin);});
 await page.waitForFunction(()=>window.__apexGoldFidelity?.child()?.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelectorAll('.hero').length===2||window.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelectorAll('.hero').length===2,{timeout:45000});
 await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('.skip')?.click()});
 await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;return !!w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('.ac-run.is-done')},{timeout:20000});
 await sleep(600);
 const english=await page.evaluate(textAudit);
 if(!english||english.lang!=='en'||!english.done||english.heroes.length!==2)fail('English state has native result and two fighters',english);
 if(!english.visible.includes('MATCH REPORT')||!english.visible.includes('TOP CONTRIBUTOR'))fail('known Result chrome is translated to ENG',english.visible);
 if(english.visible.includes('BÁO CÁO TRẬN ĐẤU')||english.visible.includes('ĐÓNG GÓP CAO NHẤT'))fail('known Vietnamese chrome does not leak into ENG',english.visible);
 pass('ENG state, native result and known chrome', {lang:english.lang,heroes:english.heroes,visible:english.visible.slice(0,500)});
 await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;w.APEX_I18N.setLanguage('vie')});
 await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#ra2-result-locale-frame')?.contentDocument;return d?.documentElement.lang==='vi'&&d.body.innerText.includes('BÁO CÁO TRẬN ĐẤU')},{timeout:20000});
 const vietnamese=await page.evaluate(textAudit);
 if(!vietnamese||vietnamese.lang!=='vi'||!vietnamese.visible.includes('BÁO CÁO TRẬN ĐẤU')||!vietnamese.visible.includes('ĐÓNG GÓP CAO NHẤT'))fail('VIE state localizes known Result chrome',vietnamese);
 if(!vietnamese.attrs.includes('Người chơi 1: P1 — chiến thắng')||vietnamese.attrs.some(value=>/^Player 1: .*— chiến thắng$/.test(value)))fail('VIE player outcome accessible name is wholly Vietnamese while P1 identity remains invariant',vietnamese.attrs);
 pass('VIE state and known chrome', {lang:vietnamese.lang,heroes:vietnamese.heroes,visible:vietnamese.visible.slice(0,500)});
 await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('.dock .btn--ghost')?.click()});
 await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;return !!w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('#commendation-archive[open]')},{timeout:15000});
 const archiveVIE=await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#ra2-result-locale-frame').contentDocument;const root=d.querySelector('#commendation-archive');return{lang:d.documentElement.lang,text:root.innerText,attrs:[...root.querySelectorAll('[aria-label],[title]')].flatMap(e=>[e.getAttribute('aria-label'),e.getAttribute('title')]).filter(Boolean)}});
 if(archiveVIE.lang!=='vi'||!archiveVIE.text.toLocaleUpperCase('vi').includes('HỒ SƠ DANH HIỆU')||!archiveVIE.attrs.includes('Đóng hồ sơ'))fail('VIE Result award archive headings and accessible close name localize',archiveVIE);
 pass('VIE award archive chrome', {text:archiveVIE.text.slice(0,500),attrs:archiveVIE.attrs.slice(0,8)});
 await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('#archive-tab-codex')?.click()});
 await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;return w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('#archive-tab-codex')?.getAttribute('aria-selected')==='true'},{timeout:10000});
 const codexVIE=await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#ra2-result-locale-frame').contentDocument;const root=d.querySelector('.codex');return{lang:d.documentElement.lang,text:root?.innerText||'',locked:root?.querySelectorAll('.cell.is-locked').length||0,lockedText:root?.querySelector('.cell.is-locked .cell__lock')?.textContent.trim()||''}});
 if(codexVIE.lang!=='vi'||codexVIE.locked<1||codexVIE.lockedText.toLocaleUpperCase('vi')!=='CHƯA AI ĐẠT'||/NOT EARNED/u.test(codexVIE.text))fail('VIE Result Codex exposes localized locked copy and no ENG leak',codexVIE);
 pass('VIE achievement Codex and locked state',{locked:codexVIE.locked,lockedText:codexVIE.lockedText});
 await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('#commendation-archive .iconbtn--sq')?.click()});
 await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;return !w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('#commendation-archive[open]')},{timeout:10000});
 await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('.chip')?.click()});
 await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;return !!w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('#award-detail[open]')},{timeout:10000});
 const detailVIE=await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#ra2-result-locale-frame').contentDocument;const root=d.querySelector('#award-detail');return{lang:d.documentElement.lang,text:root.innerText,attrs:[...root.querySelectorAll('[aria-label],[title]')].flatMap(e=>[e.getAttribute('aria-label'),e.getAttribute('title')]).filter(Boolean)}});
 if(detailVIE.lang!=='vi'||!detailVIE.attrs.includes('Đóng chi tiết danh hiệu'))fail('VIE Result achievement detail accessible chrome localizes',detailVIE);
 pass('VIE achievement detail chrome', {text:detailVIE.text.slice(0,500),attrs:detailVIE.attrs.slice(0,8)});
 await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('#award-detail .iconbtn--sq')?.click()});
 await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;return !w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('#award-detail[open]')},{timeout:10000});
 await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;w.APEX_I18N.setLanguage('eng')});
 await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#ra2-result-locale-frame')?.contentDocument;return d?.documentElement.lang==='en'&&d.body.innerText.includes('MATCH REPORT')},{timeout:20000});
 const restored=await page.evaluate(textAudit);
 if(!restored||!restored.visible.includes('MATCH REPORT')||restored.visible.includes('BÁO CÁO TRẬN ĐẤU')||!restored.attrs.includes('Player 1: P1 — victory'))fail('ENG restoration restores known Result chrome and outcome aria-label',restored);
 pass('ENG restoration', {lang:restored.lang,heroes:restored.heroes});
 await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('.dock .btn--ghost')?.click()});
 await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;return !!w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('#commendation-archive[open]')},{timeout:15000});
 const archiveENG=await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#ra2-result-locale-frame').contentDocument;const root=d.querySelector('#commendation-archive');const text=root.innerText;const attrs=[...root.querySelectorAll('[aria-label],[title]')].flatMap(e=>[e.getAttribute('aria-label'),e.getAttribute('title')]).filter(Boolean);return{lang:d.documentElement.lang,text,attrs,vietnamese:[...new Set(text.split('\\n').concat(attrs).filter(value=>/[À-ỹ]/u.test(value)))]}});
 if(archiveENG.lang!=='en'||archiveENG.vietnamese.length)fail('ENG award archive has no VIE strings in visible text or accessibility attributes',archiveENG);
 pass('ENG award archive chrome and attributes', {text:archiveENG.text.slice(0,420),attrs:archiveENG.attrs.slice(0,8)});
 await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('#archive-tab-codex')?.click()});
 await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;return w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('#archive-tab-codex')?.getAttribute('aria-selected')==='true'},{timeout:10000});
 const codexENG=await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#ra2-result-locale-frame').contentDocument;const root=d.querySelector('.codex');return{lang:d.documentElement.lang,text:root?.innerText||'',locked:root?.querySelectorAll('.cell.is-locked').length||0,lockedText:root?.querySelector('.cell.is-locked .cell__lock')?.textContent.trim()||''}});
 if(codexENG.lang!=='en'||codexENG.lockedText.toUpperCase()!=='NOT EARNED'||codexENG.locked<1||/[À-ỹ]/u.test(codexENG.text+codexENG.lockedText))fail('ENG Result Codex exposes translated locked copy and no VIE leak',codexENG);
 pass('ENG achievement Codex and locked state', {locked:codexENG.locked,text:codexENG.text.slice(0,350)});
 await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('#commendation-archive .iconbtn--sq')?.click()});
 await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;return !w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('#commendation-archive[open]')},{timeout:10000});
 await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('.chip')?.click()});
 await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;return !!w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('#award-detail[open]')},{timeout:10000});
 const detailENG=await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#ra2-result-locale-frame').contentDocument;const root=d.querySelector('#award-detail');const text=root.innerText;const attrs=[...root.querySelectorAll('[aria-label],[title]')].flatMap(e=>[e.getAttribute('aria-label'),e.getAttribute('title')]).filter(Boolean);return{lang:d.documentElement.lang,text,attrs,vietnamese:[...new Set(text.split('\\n').concat(attrs).filter(value=>/[À-ỹ]/u.test(value)))]}});
 if(detailENG.lang!=='en'||detailENG.vietnamese.length)fail('ENG Result award detail has no VIE strings in visible text or attributes',detailENG);
 pass('ENG achievement detail', {text:detailENG.text.slice(0,420),attrs:detailENG.attrs.slice(0,8)});
 // Close the detail/archive sheets before the responsive Result-state captures.
 await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('#award-detail .iconbtn--sq')?.click();w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('#commendation-archive .iconbtn--sq')?.click()});
 await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#ra2-result-locale-frame')?.contentDocument;return d&&!d.querySelector('#award-detail[open]')&&!d.querySelector('#commendation-archive[open]')},{timeout:10000});
 const layoutLocales=[];
 for(const view of [{name:'portrait',width:390,height:844},{name:'landscape',width:844,height:390}]){
  await page.setViewport({width:view.width,height:view.height,deviceScaleFactor:1});
  for(const locale of [{id:'eng',code:'eng',lang:'en',title:'MATCH REPORT',content:'TOTAL DAMAGE DEALT',opposite:'BÁO CÁO TRẬN ĐẤU',oppositeContent:'TỔNG SÁT THƯƠNG GÂY RA'},{id:'vie',code:'vie',lang:'vi',title:'BÁO CÁO TRẬN ĐẤU',content:'TỔNG SÁT THƯƠNG GÂY RA',opposite:'MATCH REPORT',oppositeContent:'TOTAL DAMAGE DEALT'}]){
   await page.evaluate(code=>{const w=window.__apexGoldFidelity?.child()||window;w.APEX_I18N.setLanguage(code)},locale.code);
   await page.waitForFunction(lang=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#ra2-result-locale-frame')?.contentDocument;return d?.documentElement.lang===lang},{timeout:20000},locale.lang);
   await sleep(350);
   const snapshot=await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#ra2-result-locale-frame')?.contentDocument;const root=d?.querySelector('.ac-root'),stage=d?.querySelector('.ac-stage');const r=stage?.getBoundingClientRect(),cue=root?.querySelector('.ac-scroll-hint');return{lang:d?.documentElement.lang,title:root?.innerText.includes('MATCH REPORT')?'MATCH REPORT':root?.innerText.includes('BÁO CÁO TRẬN ĐẤU')?'BÁO CÁO TRẬN ĐẤU':'',text:root?.innerText.slice(0,700)||'',viewport:{width:d?.documentElement.clientWidth,height:d?.documentElement.clientHeight,scrollWidth:d?.documentElement.scrollWidth},scroll:root?{clientHeight:root.clientHeight,scrollHeight:root.scrollHeight,overflowY:getComputedStyle(root).overflowY}:null,scrollCue:cue?.innerText.trim()||'',stage:r?{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null,heroes:[...d?.querySelectorAll('.hero__char b')||[]].map(e=>e.textContent.trim()),done:!!d?.querySelector('.ac-run.is-done'),placeholders:d?[...d.querySelectorAll('.art-tag')].map(e=>e.textContent.trim()):[]}});
   const horizontalBounds=!!snapshot.stage&&snapshot.stage.x>=-3&&snapshot.stage.right<=view.width+3&&snapshot.viewport.scrollWidth<=view.width+2;
   const expectedScrollCue=locale.code==='vie'?'CUỘN XUỐNG ĐỂ TIẾP TỤC':'SCROLL DOWN FOR CONTINUE';
   const fit=view.name==='landscape'
     ? horizontalBounds&&snapshot.scroll?.clientHeight===view.height&&snapshot.scroll.scrollHeight>snapshot.scroll.clientHeight&&snapshot.scroll.overflowY==='auto'&&snapshot.scrollCue===expectedScrollCue
     : horizontalBounds&&snapshot.stage.y>=-3&&snapshot.stage.bottom<=view.height+3;
   const localized=snapshot.lang===locale.lang&&snapshot.text.includes(locale.content)&&!snapshot.text.includes(locale.oppositeContent)&&!snapshot.text.includes(locale.opposite)&&snapshot.heroes.length===2&&snapshot.done&&snapshot.placeholders.length===0;
   if(!fit||!localized)fail(`${view.name} ${locale.id} preserves Result bounds, real heroes and locale`,{fit,localized,snapshot});
   else pass(`${view.name} ${locale.id} Result state and viewport bounds`,{lang:snapshot.lang,heroes:snapshot.heroes,viewport:snapshot.viewport,scroll:snapshot.scroll,scrollCue:snapshot.scrollCue,stage:snapshot.stage});
   await page.screenshot({path:`${OUT}/result-locale-${locale.id}-${view.name}.png`});
   layoutLocales.push({view:view.name,locale:locale.id,fit,localized,snapshot,screenshot:`${OUT}/result-locale-${locale.id}-${view.name}.png`});
  }
 }
 // Real zero-damage/no-weapon match: exercise the Result's authored empty
 // weapon branch, verify no invented art/medal appears, and check its ENG/VIE
 // copy on the narrow portrait layout.
 await page.setViewport({width:390,height:844,deviceScaleFactor:1});
 await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;w.APEX_I18N.setLanguage('eng')});
 const emptyReceipt=await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;const actors=[{id:1,name:'SHURI',x:180,y:450,hp:1000,maxHp:1000},{id:2,name:'NEWBOT',x:820,y:450,hp:1000,maxHp:1000}];const ledger=w.APEX_MATCH_RESULT_AUTHORITY.create({actors,mode:'LOCAL',startedAt:1720000010000,weaponConfig:w.APEX_ARSENAL_CONFIG});const match=ledger.seal('P1');w.document.querySelector('#ra2-result-locale-frame').contentWindow.postMessage({type:'APEX_RESULT_GOLD_PAYLOAD',match},w.location.origin);return{id:match.meta.id,weapons:match.weapons.length,weaponOfTheBattle:match.weaponOfTheBattle,damage:match.players.map(p=>p.damage.dealt),awards:match.players.map(p=>p.awards.length)}});
 await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#ra2-result-locale-frame')?.contentDocument;return !!d?.querySelector('.weapon__dais .art-tag')&&!d.querySelector('.weapon__dais img')},{timeout:15000});
 await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('.skip')?.click()});
 await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;return !!w.document.querySelector('#ra2-result-locale-frame')?.contentDocument?.querySelector('.ac-run.is-done')},{timeout:15000});
 await sleep(400);
 const emptyENG=await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#ra2-result-locale-frame').contentDocument;return{lang:d.documentElement.lang,text:d.querySelector('.weapon')?.innerText||'',title:d.querySelector('.weapon__name')?.innerText||'',images:d.querySelectorAll('.weapon__dais img').length,placeholders:[...d.querySelectorAll('.weapon__dais .art-tag')].map(e=>e.innerText.trim()),awards:[...d.querySelectorAll('.racktab em')].map(e=>e.innerText.trim())}});
 if(emptyReceipt.weapons!==0||emptyReceipt.weaponOfTheBattle.weaponId!==''||emptyReceipt.damage.some(Boolean)||emptyENG.lang!=='en'||emptyENG.title!=='NO STANDOUT WEAPON'||emptyENG.images!==0||emptyENG.placeholders[0]!=='No weapon damage dealt'||JSON.stringify(emptyENG.awards)!==JSON.stringify(emptyReceipt.awards.map(String)))fail('ENG zero-data Result presents localized no-weapon fallback, exact authority award counts and no invented art/damage',{emptyReceipt,emptyENG});
 else pass('ENG zero-data Result: no weapon art or damage invented; native award counts and empty copy match authority', {emptyReceipt,emptyENG});
 await page.screenshot({path:`${OUT}/result-zero-data-eng.png`});
 await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;w.APEX_I18N.setLanguage('vie')});
 await page.waitForFunction(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#ra2-result-locale-frame')?.contentDocument;return d?.documentElement.lang==='vi'&&d.querySelector('.weapon__name')?.innerText.includes('KHÔNG CÓ VŨ KHÍ NỔI BẬT')},{timeout:15000});
 await sleep(350);
 const emptyVIE=await page.evaluate(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#ra2-result-locale-frame').contentDocument;return{lang:d.documentElement.lang,text:d.querySelector('.weapon')?.innerText||'',title:d.querySelector('.weapon__name')?.innerText||'',images:d.querySelectorAll('.weapon__dais img').length,placeholders:[...d.querySelectorAll('.weapon__dais .art-tag')].map(e=>e.innerText.trim()),awards:[...d.querySelectorAll('.racktab em')].map(e=>e.innerText.trim())}});
 if(emptyVIE.lang!=='vi'||emptyVIE.title!=='KHÔNG CÓ VŨ KHÍ NỔI BẬT'||emptyVIE.images!==0||emptyVIE.placeholders[0]!=='Không có sát thương từ vũ khí'||JSON.stringify(emptyVIE.awards)!==JSON.stringify(emptyReceipt.awards.map(String))||emptyVIE.text.includes('NO STANDOUT WEAPON'))fail('VIE zero-data Result presents localized no-weapon fallback, exact authority award counts and no invented art/damage',emptyVIE);
 else pass('VIE zero-data Result keeps localized no-weapon fallback and authority award counts',emptyVIE);
 await page.screenshot({path:`${OUT}/result-zero-data-vie.png`});
 const report={base:BASE,setup,english,vietnamese,archiveVIE,codexVIE,detailVIE,restored,archiveENG,codexENG,detailENG,layoutLocales,emptyState:{receipt:emptyReceipt,eng:emptyENG,vie:emptyVIE},browserErrors:errors,browserMode:'Chromium desktop/mobile viewport emulation; no physical-device validation'};
 await writeFile(`${OUT}/locale-dom-audit.json`,JSON.stringify(report,null,2)+'\n');
 if(errors.length)fail('no uncaught browser errors',errors);
 console.log('RA-2 Result locale audit PASS (ENG/VIE/ENG restore; native sealed ledger; Chromium desktop)');
}finally{await browser.close();}
