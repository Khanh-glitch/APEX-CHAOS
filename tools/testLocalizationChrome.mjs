// Real Blink smoke for VIE/ENG Golden HOME fonts, persistence and hit regions.
// This complements jsdom; it does not claim to emulate mobile Safari.
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {mkdir,writeFile} from 'node:fs/promises';
const CHROME=process.env.CHROME_PATH;
if(!CHROME)throw Error('CHROME_PATH is required for the localization browser gate');
const base=process.env.APEX_APP_URL||'http://127.0.0.1:5173/';
const port=9471;
const child=spawn(CHROME,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--remote-allow-origins=*','--remote-debugging-port='+port,'--user-data-dir=/tmp/apex-localization-'+process.pid,'about:blank'],{stdio:'ignore'});
let ws;let serial=0;const pending=new Map();
function cmd(method,params={}){
 const id=++serial;return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP '+method+' timeout'));},45000);
   pending.set(id,{resolve:x=>{clearTimeout(timer);resolve(x)},reject:e=>{clearTimeout(timer);reject(e)}});
   ws.send(JSON.stringify({id,method,params}));
 });
}
async function run(code){
 const r=await cmd('Runtime.evaluate',{expression:code,returnByValue:true,awaitPromise:true});
 if(r.exceptionDetails)throw Error(r.exceptionDetails.text||'Runtime.evaluate failed');
 return r.result?.value;
}
async function until(code,ms=40000){
 for(let i=0;i<ms/125;i++){
   if(await run(code).catch(()=>false))return true;
   await sleep(125);
 }
 return false;
}
async function capture(name){
 const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 await writeFile('docs/acceptance/localization/'+name+'.png',Buffer.from(shot.data,'base64'));
}
const checked=(ok,message,value)=>{
 console.log((ok?'PASS':'FAIL')+' localization chrome: '+message+' '+JSON.stringify(value??''));
 if(!ok)throw Error(message);
};
try{
 let target;
 for(let i=0;i<200;i++){
   try{
     const list=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());
     target=list.find(x=>x.type==='page');if(target)break;
   }catch{}
   await sleep(100);
 }
 if(!target)throw Error('Chrome CDP startup failed');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',event=>{
   const msg=JSON.parse(event.data),p=pending.get(msg.id);if(!p)return;
   pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);
 });
 await cmd('Page.enable');await cmd('Runtime.enable');
 await mkdir('docs/acceptance/localization',{recursive:true});
 for(const view of [{id:'desktop',w:1440,h:900},{id:'portrait',w:390,h:844}]){
   await cmd('Emulation.setDeviceMetricsOverride',{width:view.w,height:view.h,deviceScaleFactor:2,mobile:view.id==='portrait',screenWidth:view.w,screenHeight:view.h});
   await cmd('Page.navigate',{url:base});
   checked(await until("Boolean((window.__apexGoldFidelity?.child()||window).document.querySelector('#apex-boot-start'))"),view.id+' boot loads');
   await run("(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#apex-boot-start')?.click()})()");
   checked(await until("Boolean((window.__apexGoldFidelity?.child()||window).document.querySelector('#apex-language-select'))"),view.id+' language picker loads');
   checked(await until("(()=>{const w=window.__apexGoldFidelity?.child()||window;return w.document.querySelector('#stage')?.classList.contains('ready')})()"),view.id+' HOME ready');
   checked(await until("(()=>{const w=window.__apexGoldFidelity?.child()||window;return w.document.body?.dataset?.apexSceneTransition==='DONE'})()"),view.id+' transition fully opened');
   await sleep(200);
   const report=await run(`(()=>{
     const w=window.__apexGoldFidelity?.child()||window,d=w.document;
     const picker=d.querySelector('#apex-language-select');
     w.APEX_I18N.setLanguage('vie');
     const title=d.querySelector('.storyTitle'),button=d.querySelector('#continueStory .label');
     const range=d.createRange();range.selectNodeContents(title);const rect=range.getBoundingClientRect();
     const box=title.getBoundingClientRect(),cta=d.querySelector('#continueStory').getBoundingClientRect();
     const pickBox=picker.getBoundingClientRect();
     const covered=d.elementFromPoint(pickBox.x+pickBox.width/2,pickBox.y+pickBox.height/2);
     return {
       chosen:picker.value,persist:w.localStorage.getItem('apex-chaos.ui-language.v1'),
       title:title.innerText,cta:button.innerText,htmlLang:d.documentElement.lang,
       font:w.getComputedStyle(title).fontFamily,
       viewport:{width:w.innerWidth,height:w.innerHeight},
       withinTitle:rect.width<=w.innerWidth+3&&rect.right<=w.innerWidth+4,
       ctaWithin:button.getBoundingClientRect().width<=cta.width+3,
       pickerVisible:pickBox.width>20&&pickBox.y>=0&&pickBox.bottom<=w.innerHeight,
       pickerHit:Boolean(covered&&(covered===picker||covered.closest('#apex-language-picker'))),
       hitStack:d.elementsFromPoint(pickBox.x+pickBox.width/2,pickBox.y+pickBox.height/2).slice(0,8).map(e=>({tag:e.tagName,id:e.id,cls:typeof e.className==='string'?e.className.slice(0,70):'',z:w.getComputedStyle(e).zIndex,pointer:w.getComputedStyle(e).pointerEvents}))
     };
   })()`);
   checked(report.chosen==='vie'&&report.persist==='vie'&&report.htmlLang==='vi',view.id+' VIE state',report);
   checked(report.title.includes('NHỮNG KẺ')&&report.cta.includes('TIẾP TỤC'),view.id+' natural Home translations',report);
   checked(report.font.includes('Arial')||report.font.includes('Segoe UI'),view.id+' Unicode face fallback',report);
   checked(report.withinTitle&&report.ctaWithin&&report.pickerVisible&&report.pickerHit,view.id+' glyph bounds and selector hit target',report);
   await capture(view.id+'-vie');
   const restored=await run("(()=>{const w=window.__apexGoldFidelity?.child()||window;w.APEX_I18N.setLanguage('eng');return {label:w.document.querySelector('#freeBattle .label')?.textContent,persist:w.localStorage.getItem('apex-chaos.ui-language.v1')}})()");
   checked(restored.label==='FREE BATTLE'&&restored.persist==='eng',view.id+' restore ENG',restored);
   await capture(view.id+'-eng');
   // Exercise Gold's dynamically-authored Mode and Fighter surfaces, not only HOME.
   await run("(()=>{const w=window.__apexGoldFidelity?.child()||window;w.APEX_I18N.setLanguage('vie');w.document.querySelector('#freeBattle')?.click()})()");
   checked(await until("(()=>{const w=window.__apexGoldFidelity?.child()||window;return w.document.querySelector('#stage')?.classList.contains('screen-mode')})()"),view.id+' entered Mode Select');
   const modeText=await run("(()=>{const w=window.__apexGoldFidelity?.child()||window;return w.document.querySelector('.modeSelectScreen')?.innerText||''})()");
   checked(modeText.includes('CHỌN CHẾ ĐỘ'),view.id+' translated Mode Select',modeText.slice(0,250));
   await capture(view.id+'-mode-vie');
   await run("(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('.modeCard[data-mode=bot]')?.click()})()");
   checked(await until("(()=>{const w=window.__apexGoldFidelity?.child()||window;return w.document.querySelector('#stage')?.classList.contains('screen-fighter')})()"),view.id+' entered Fighter Select');
   const fighterText=await run("(()=>{const w=window.__apexGoldFidelity?.child()||window;return w.document.querySelector('.fighterSelectScreen')?.innerText||''})()");
   checked(fighterText.includes('CHỌN ĐẤU SĨ'),view.id+' translated Fighter Select',fighterText.slice(0,300));
   checked(fighterText.includes('NEWBOT')||fighterText.includes('HUNTER'),view.id+' preserved proper fighter names');
   await capture(view.id+'-fighter-vie');

   if(view.id==='desktop'){
     // Real production BOT path; this does not fabricate hit points,
     // skills, results or achievement receipts.
     await run("(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('.rosterCard[data-hero=newbot]')?.click();w.document.querySelector('#lockIn')?.click()})()");
     await sleep(450);
     await run("(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('.rosterCard[data-hero=newbot]')?.click();w.document.querySelector('#lockIn')?.click()})()");
     checked(await until("(()=>{const w=window.__apexGoldFidelity?.child()||window,d=w.document;return d.body.classList.contains('battle-hud-open')&&Boolean(d.querySelector('#battleHudFrame')?.contentDocument?.body)})()",70000),'live BOT battle loaded with authentic Gold HUD');
     checked(await until("(()=>{const w=window.__apexGoldFidelity?.child()||window,d=w.document;return d.querySelector('#battleHudFrame')?.contentDocument?.documentElement?.lang==='vi'})()",25000),'embedded Battle HUD inherited VIE locale');
     const hudProof=await run("(()=>{const w=window.__apexGoldFidelity?.child()||window,d=w.document.querySelector('#battleHudFrame').contentDocument,n=d.createElement('span');n.textContent='UNARMED';n.id='locale-test-probe';d.body.appendChild(n);return {lang:d.documentElement.lang,frameFont:d.getElementById('apex-locale-frame-font')?.textContent.includes('Arial')||false}})()");
     checked(hudProof.lang==='vi'&&hudProof.frameFont,'live Battle HUD received readable Vietnamese font',hudProof);
     checked(await until("(()=>{const w=window.__apexGoldFidelity?.child()||window,d=w.document.querySelector('#battleHudFrame').contentDocument;return d.getElementById('locale-test-probe')?.textContent==='TAY KHÔNG'})()"),'embedded Battle HUD dynamic text localized');
     await run("(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#battleHudFrame')?.contentDocument?.getElementById('locale-test-probe')?.remove()})()");
     await capture('desktop-live-battle-vie');
   }


   if(view.id==='desktop'){
     // Lucky Draw uses a second authored document. Boot the real HOME again
     // and follow its real route/transition instead of injecting a fake DOM.
     await cmd('Page.navigate',{url:base});
     checked(await until("Boolean((window.__apexGoldFidelity?.child()||window).document.querySelector('#apex-boot-start'))"),'Lucky HOME boot');
     await run("(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#apex-boot-start')?.click()})()");
     checked(await until("(()=>{const w=window.__apexGoldFidelity?.child()||window;return w.document.body?.dataset?.apexSceneTransition==='DONE'})()"),'Lucky HOME transition opened');
     checked(await run("(()=>{const w=window.__apexGoldFidelity?.child()||window;return w.APEX_I18N?.getLanguage?.()==='vie'})()"),'VIE setting survives navigation');
     await run("(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#openLuckyDraw')?.click()})()");
     checked(await until("(()=>{const w=window.__apexGoldFidelity?.child()||window;return w.document.querySelector('#luckyDonorHost')?.classList.contains('is-open')})()",70000),'real Lucky Draw route opened');
     checked(await until("(()=>{const w=window.__apexGoldFidelity?.child()||window;return Boolean(w.document.querySelector('#luckyDonorFrame')?.contentDocument?.querySelector('#stage .title strong'))})()"),'Lucky iframe document available');
     const lucky=await run("(()=>{const w=window.__apexGoldFidelity?.child()||window,f=w.document.querySelector('#luckyDonorFrame'),d=f.contentDocument;return {lang:d.documentElement.lang,title:d.querySelector('.title strong')?.textContent||'',drawer:d.querySelector('#infoD')?.textContent||'',font:d.defaultView.getComputedStyle(d.querySelector('.title strong')).fontFamily}})()");
     checked(lucky.lang==='vi'&&lucky.title.includes('QUAY MAY MẮN')&&lucky.drawer.includes('ĐẤU SĨ'), 'Lucky iframe translated and accent font active',lucky);
     await capture('desktop-lucky-vie');

     // Result Gold is a separate React document authored in Vietnamese.
     // Feed it an actual sealed native ledger, exactly like the independent
     // Gold acceptance harness, then audit the English-only rendered result.
     const resultSetup=await run(`(async()=>{
       const w=window.__apexGoldFidelity?.child()||window;
       w.APEX_I18N.setLanguage('eng');
       const scripts=['/game/arsenal/arsenalCWeaponSet.generated.js',
         '/game/results/ownerAwards.generated.js','/game/results/matchResultAuthority.js'];
       for(const src of scripts){
         if(w.document.querySelector('script[data-locale-fixture="'+src+'"]'))continue;
         await new Promise((resolve,reject)=>{
           const el=w.document.createElement('script');
           el.src=src;el.dataset.localeFixture=src;
           el.onload=resolve;el.onerror=()=>reject(new Error('script unavailable '+src));
           w.document.head.appendChild(el);
         });
       }
       const actors=[{id:1,name:'ROBOT',x:180,y:450,hp:1000,maxHp:1000},
         {id:2,name:'HUNTER',x:820,y:450,hp:1000,maxHp:1000}];
       const cfg={WEAPONS:{PISTOL:{family:'SEMI'}},tierOf:()=> 'T1'};
       const ledger=w.APEX_MATCH_RESULT_AUTHORITY.create({actors,mode:'BOT',startedAt:1720000000000,weaponConfig:cfg});
       ledger.onPickup(actors[0],'PISTOL');ledger.onPickup(actors[1],'PISTOL');
       ledger.onShot(actors[0],'PISTOL');actors[1].hp=400;
       ledger.onDamage(actors[1],actors[0],'arsenal-pistol',600);
       ledger.tick(1.2);ledger.onShot(actors[1],'PISTOL');actors[0].hp=880;
       ledger.onDamage(actors[0],actors[1],'arsenal-pistol',120);
       ledger.tick(.4);ledger.onShot(actors[0],'PISTOL');actors[1].hp=0;
       ledger.onDamage(actors[1],actors[0],'arsenal-pistol',400);
       w.__localizationResultProof=ledger.seal('P1');
       const frame=w.document.createElement('iframe');
       frame.id='localization-result-proof-frame';frame.src='/result-gold/index.html';
       frame.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483600;border:0';
       w.document.body.appendChild(frame);
       return {id:w.__localizationResultProof.meta.id,titles:w.APEX_RESULT_OWNER_CATALOG.length};
     })()`);
     checked(resultSetup.titles===47,'Result Gold native authority generated accepted 47 award options',resultSetup);
     checked(await until("(()=>{const w=window.__apexGoldFidelity?.child()||window;return !!w.document.querySelector('#localization-result-proof-frame')?.contentDocument?.querySelector('.ac-root')})()",40000),'Gold result iframe React booted');
     await run("(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#localization-result-proof-frame').contentWindow.postMessage({type:'APEX_RESULT_GOLD_PAYLOAD',match:w.__localizationResultProof},w.location.origin)})()");
     checked(await until("(()=>{const w=window.__apexGoldFidelity?.child()||window;return w.document.querySelector('#localization-result-proof-frame')?.contentDocument?.querySelectorAll('.hero').length===2})()",40000),'native match visible in Result Gold');
     await run("(()=>{const w=window.__apexGoldFidelity?.child()||window;w.document.querySelector('#localization-result-proof-frame')?.contentDocument?.querySelector('.skip')?.click()})()");
     await sleep(600);
     const resultProof=await run(`(()=>{
       const w=window.__apexGoldFidelity?.child()||window;
       const d=w.document.querySelector('#localization-result-proof-frame').contentDocument;
       const body=d.querySelector('.ac-root')||d.body;
       const visible=body.innerText||'';
       const attrs=[...body.querySelectorAll('[aria-label],[title]')].flatMap(e=>[e.getAttribute('aria-label'),e.getAttribute('title')]).filter(Boolean);
       const vietnamese=Array.from(new Set(visible.split('\\n').concat(attrs).filter(x=>/[À-ỹ]/u.test(x))));
       return {lang:d.documentElement.lang,heroes:d.querySelectorAll('.hero').length,vietnamese:vietnamese.slice(0,35),title:visible.slice(0,700)};
     })()`);
     checked(resultProof.lang==='en'&&resultProof.heroes===2,'Result Gold ENG state and true match survive frame localization',resultProof);
     checked(resultProof.vietnamese.length===0,'Result Gold has no untranslated Vietnamese user-visible copy in ENG',resultProof);
     await capture('desktop-result-gold-eng');

     await run("(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#localization-result-proof-frame').contentDocument;d.querySelector('.dock .btn--ghost')?.click()})()");
     checked(await until("(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#localization-result-proof-frame')?.contentDocument;return !!d?.querySelector('#commendation-archive[open]')})()",15000),'Result Gold archive opens in ENG');
     const archiveAudit=await run(`(()=>{
       const w=window.__apexGoldFidelity?.child()||window;
       const d=w.document.querySelector('#localization-result-proof-frame').contentDocument;
       const root=d.querySelector('#commendation-archive');
       const strings=(root.innerText||'').split('\\n');
       const attrs=[...root.querySelectorAll('[aria-label],[title]')].flatMap(e=>[e.getAttribute('aria-label'),e.getAttribute('title')]).filter(Boolean);
       return {vietnamese:Array.from(new Set(strings.concat(attrs).filter(x=>/[À-ỹ]/u.test(x)))).slice(0,45),preview:(root.innerText||'').slice(0,850)};
     })()`);
     checked(archiveAudit.vietnamese.length===0,'Gold result Archive and 47 condition entries are English only',archiveAudit);
     await capture('desktop-result-archive-eng');
     await run("(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#localization-result-proof-frame').contentDocument;d.querySelector('#commendation-archive .iconbtn--sq')?.click()})()");
     checked(await until("(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#localization-result-proof-frame')?.contentDocument;return !d?.querySelector('#commendation-archive[open]')})()",10000),'Archive can close without breaking layout');
     await run("(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#localization-result-proof-frame').contentDocument;d.querySelector('.chip')?.click()})()");
     checked(await until("(()=>{const w=window.__apexGoldFidelity?.child()||window;const d=w.document.querySelector('#localization-result-proof-frame')?.contentDocument;return !!d?.querySelector('#award-detail[open]')})()",10000),'Gold result first earned title details open');
     const detailsAudit=await run(`(()=>{
       const w=window.__apexGoldFidelity?.child()||window;
       const d=w.document.querySelector('#localization-result-proof-frame').contentDocument;
       const root=d.querySelector('#award-detail');
       const strings=(root.innerText||'').split('\\n');
       const attrs=[...root.querySelectorAll('[aria-label],[title]')].flatMap(e=>[e.getAttribute('aria-label'),e.getAttribute('title')]).filter(Boolean);
       return {vietnamese:Array.from(new Set(strings.concat(attrs).filter(x=>/[À-ỹ]/u.test(x)))).slice(0,45),preview:(root.innerText||'').slice(0,850)};
     })()`);
     checked(detailsAudit.vietnamese.length===0,'Gold detailed achievement rules and thresholds are English only',detailsAudit);
     await capture('desktop-award-details-eng');


   }


 }
 console.log('PASS localization desktop + portrait Chrome smoke');
}finally{
 try{ws?.close()}catch{}
 child.kill('SIGTERM');
}
