// RA-2 full Field Archive dossier audit. Chromium emulation only; no economy writes.
// Traverses every visible fighter/weapon record, ENG/VIE, skins + INFO, dynamic
// title/aria/alt values, every ability button, and weapon spec pages. The only
// synthetic stimulus is component-local image.onerror to verify its fallback.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const CHROME=process.env.CHROME_PATH;
const BASE=process.env.APEX_APP_URL||'http://127.0.0.1:5173/';
if(!CHROME)throw Error('CHROME_PATH is required');
const OUT='docs/acceptance/ra2/evidence/archive';
await mkdir(OUT,{recursive:true});
const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
const checks=[];const errors=[];
const check=(ok,name,detail)=>{checks.push({ok,name,detail});console.log((ok?'PASS':'FAIL')+' RA-2 Archive: '+name+(detail===undefined?'':' '+JSON.stringify(detail)));assert.ok(ok,name)};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const context=await browser.createBrowserContext();
try{
 const page=await context.newPage();
 page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)));
 await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
 await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:70000});
 await page.waitForSelector('#apex-boot-start',{visible:true,timeout:90000});
 await page.click('#apex-boot-start');
 await page.waitForSelector('#freeBattle',{visible:true,timeout:60000});
 await page.click('#freeBattle');
 await page.waitForFunction(()=>document.body.dataset.apexSceneTransition==='DONE',{timeout:60000});
 await page.waitForFunction(()=>window.APEX_I18N&&document.documentElement.lang==='en',{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#apexDictionaryOpen'),{timeout:30000});
 await page.click('#apexDictionaryOpen');
 await page.waitForSelector('.fa3-shell',{visible:true,timeout:45000});
 await page.waitForFunction(()=>document.querySelectorAll('.fa3-index-list button').length>0,{timeout:30000});
 const loading=await page.evaluate(()=>({ready:document.querySelector('.fa3-artwork')?.dataset.visualReady,progress:document.querySelector('.fa3-visual-progress')?.innerText||'',statuses:[...document.querySelectorAll('.fa3-artwork [role=status]')].map(e=>e.innerText)}));
 await page.screenshot({path:`${OUT}/loading-eng.png`});
 check(!!loading.progress||loading.ready==='false'||loading.ready==='true','Archive loading/decoded state exposed',loading);
 const inv={eng:{hero:[],weapon:[]},vie:{hero:[],weapon:[]},summary:{},observations:{loading,untranslatedPairs:[],fallbacks:[],empty:{},imageError:{}},browserErrors:errors};
 const language=async lang=>{
  await page.evaluate(v=>window.APEX_I18N.setLanguage(v),lang);
  await page.waitForFunction(v=>document.documentElement.lang===(v==='vie'?'vi':'en'),{timeout:10000},lang);
  await wait(180);
 };
 const snapshot=()=>page.evaluate(()=>{
  const root=document.querySelector('.fa3-shell');
  const path=e=>{const parts=[];for(let n=e;n&&n!==root;n=n.parentElement){let i=1;for(let p=n.previousElementSibling;p;p=p.previousElementSibling)if(p.tagName===n.tagName)i++;parts.unshift(`${n.tagName.toLowerCase()}:nth-of-type(${i})`)}return parts.join('>')||'root'};
  const fields=[];
  for(const e of root.querySelectorAll('[aria-label],[title],[alt],[placeholder]'))for(const a of ['aria-label','title','alt','placeholder']){const v=e.getAttribute(a);if(v)fields.push({key:`${path(e)}@${a}`,type:'attribute',value:v})}
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;const ord=new Map();while(node=walker.nextNode()){const value=node.nodeValue.trim();if(!value)continue;const k=path(node.parentElement);const n=ord.get(k)||0;ord.set(k,n+1);fields.push({key:`${k}#text${n}`,type:'text',value})}
  const attrs=fields.filter(f=>f.type==='attribute').map(f=>({key:f.key,aria:f.key.endsWith('@aria-label')?f.value:null,title:f.key.endsWith('@title')?f.value:null,alt:f.key.endsWith('@alt')?f.value:null,placeholder:f.key.endsWith('@placeholder')?f.value:null}));
  const text=fields.filter(f=>f.type==='text').map(f=>({key:f.key,text:f.value}));
  return {lang:document.documentElement.lang,heading:document.querySelector('#fa3-title')?.innerText.trim(),record:document.querySelector('.fa3-record-top h3')?.innerText.trim(),counter:document.querySelector('.fa3-record-top small')?.innerText.trim(),family:document.querySelector('.fa3-record-stamp')?.innerText.trim(),view:document.querySelector('.fa3-detail-heading')?.innerText.trim(),body:root.innerText,attrs,text,fields};
 });
 const firstImage=await page.$eval('.fa3-artwork img',e=>({src:e.src,alt:e.alt})).catch(()=>null);
 check(!!firstImage,'representative central approved art element is present',firstImage);
 if(firstImage){
  await page.evaluate(()=>document.querySelector('.fa3-artwork img')?.dispatchEvent(new Event('error')));await wait(120);
  const errEng=await page.evaluate(()=>({text:document.querySelector('.fa3-art-missing')?.innerText||'',role:document.querySelector('.fa3-art-missing')?.getAttribute('role')||''}));
  await page.screenshot({path:`${OUT}/image-error-eng.png`});
  await language('vie');
  const errVie=await page.evaluate(()=>({text:document.querySelector('.fa3-art-missing')?.innerText||'',role:document.querySelector('.fa3-art-missing')?.getAttribute('role')||''}));
  await page.screenshot({path:`${OUT}/image-error-vie.png`});
  const expectedError=await page.evaluate(values=>values.map(s=>window.APEX_I18N.translate(s)),['VISUAL RECORD UNAVAILABLE','Approved image could not be decoded']);
  inv.observations.imageError={eng:errEng,vie:errVie,src:firstImage.src,expectedError};
  check(errEng.role==='status'&&errEng.text.includes('VISUAL RECORD UNAVAILABLE'),'Archive image error has a status fallback',errEng);
  check(errVie.role==='status'&&errVie.text.includes(expectedError[0])&&errVie.text.includes(expectedError[1]),'Archive image error fallback is fully localized in VIE',inv.observations.imageError);
  await language('eng');
 }
 const auditLocalePair=async(kind,recordIndex)=>{
  const eng=[];
  await language('eng');
  await page.click('.fa3-detail-tabs button[role=tab][aria-selected="false"]:nth-child(2)').catch(async()=>page.click('.fa3-detail-tabs button:nth-child(2)'));
  await wait(100);
  // Full INFO surface. Read every registered skill and every weapon spec page.
  if(kind==='hero'){
   const skills=await page.$$('.fa4-skill-portrait');
   const skillStates=[];
   for(let i=0;i<skills.length;i++){
    await page.$eval(`.fa4-skill-portrait:nth-child(${i+1})`,e=>e.click());await wait(45);
    skillStates.push(await snapshot());
   }
   if(skillStates.length)eng.push(...skillStates);
  }else{
   for(let p=0;p<8;p++){
    eng.push(await snapshot());
    const next=await page.$('.fa4-spec-pages button:last-child:not(:disabled)');
    if(!next)break;await next.click();await wait(60);
   }
   while(await page.$('.fa4-spec-pages button:first-child:not(:disabled)')){await page.click('.fa4-spec-pages button:first-child');await wait(45)}
  }
  if(!eng.length)eng.push(await snapshot());
  await language('vie');
  const vie=[];
  if(kind==='hero'){
   const skills=await page.$$('.fa4-skill-portrait');
   for(let i=0;i<skills.length;i++){
    await page.$eval(`.fa4-skill-portrait:nth-child(${i+1})`,e=>e.click());await wait(45);
    vie.push(await snapshot());
   }
  }else{
   for(let p=0;p<eng.length;p++){
    vie.push(await snapshot());
    const next=await page.$('.fa4-spec-pages button:last-child:not(:disabled)');
    if(next&&p<eng.length-1){await next.click();await wait(60)}
   }
  }
  // Compare stable DOM paths for authored text and accessibility attributes.
  const pairN=Math.min(eng.length,vie.length);
  for(let i=0;i<pairN;i++){
   const src=eng[i],dst=vie[i],dest=new Map(dst.fields.map(f=>[f.key,f.value]));
   const sources=src.fields.map(f=>f.value);
   const expected=await page.evaluate(values=>values.map(value=>window.APEX_I18N.translate(value)),sources);
   for(let j=0;j<src.fields.length;j++){
    const field=src.fields[j],actual=dest.get(field.key),translated=expected[j];
    if(actual!==undefined&&translated!==field.value&&translated!==actual)inv.observations.untranslatedPairs.push({kind,recordIndex,skillOrPage:i,key:field.key,type:field.type,source:field.value,expected:translated,actual});
   }
  }
  // Return to skin tab and leave the dossier localized in VIE for collection.
  await page.click('.fa3-detail-tabs button:first-child');await wait(80);
  return {eng,vie};
 };
 const scanKind=async kind=>{
  await language('eng');
  if(kind==='weapon')await page.click('.fa3-primary button:nth-child(2)');else await page.click('.fa3-primary button:nth-child(1)');
  await page.waitForFunction(k=>document.querySelector('.fa3-record-stamp')?.innerText===(k==='hero'?'FIGHTER':'WEAPON'),{timeout:10000},kind);
  await wait(180);
  const total=Number((await page.$eval('.fa3-index-head span',e=>e.textContent.trim()))||0);
  check(total>0,`${kind} archive catalog count available`,total);
  const records=[];
  for(let index=0;index<total;index++){
   await language('eng');
   const base=await snapshot();
   const skinVariants=[],skinPreviewStates=[];
   for(let pg=0;pg<10;pg++){
    const sk=await page.evaluate(()=>({text:document.querySelector('.fa3-appear')?.innerText||'',items:[...document.querySelectorAll('.fa3-skin-list button')].map(e=>({text:e.innerText.trim(),pressed:e.getAttribute('aria-pressed'),label:e.querySelector('.fa3-skin-name b')?.textContent.trim(),detail:e.querySelector('.fa3-skin-name small')?.textContent.trim(),alt:e.querySelector('img')?.alt??null,title:e.getAttribute('title')})),pages:document.querySelector('.fa3-skin-pager span')?.innerText||null}));
    skinVariants.push(...sk.items);
    for(let i=0;i<sk.items.length;i++){
     await page.$eval(`.fa3-skin-list button:nth-child(${i+1})`,e=>e.click());await wait(45);
     skinPreviewStates.push(await page.evaluate(()=>({label:document.querySelector('.fa3-skin-list button[aria-pressed="true"] .fa3-skin-name b')?.textContent.trim(),lock:document.querySelector('.fa3-skin-lock')?.innerText.trim()||'',equip:document.querySelector('.fa3-equip')?{text:document.querySelector('.fa3-equip').innerText.trim(),disabled:document.querySelector('.fa3-equip').disabled}:null,artAlt:document.querySelector('.fa3-artwork img')?.alt||null,artStatus:document.querySelector('.fa3-visual-progress')?.innerText||''})));
    }
    const next=await page.$('.fa3-skin-pager button:last-child:not(:disabled)');if(!next)break;await next.click();await wait(60);
   }
   // Reset to first skin page; collect complete INFO and dynamic tooltips.
   const firstPage=await page.$('.fa3-skin-pager button:first-child:not(:disabled)');if(firstPage){while(await page.$('.fa3-skin-pager button:first-child:not(:disabled)')){await page.click('.fa3-skin-pager button:first-child');await wait(35)}}
   const {eng,vie}=await auditLocalePair(kind,index);
   const evidence=await page.evaluate(()=>({
    image:document.querySelector('.fa3-artwork img')?{src:document.querySelector('.fa3-artwork img').getAttribute('src'),alt:document.querySelector('.fa3-artwork img').alt,naturalWidth:document.querySelector('.fa3-artwork img').naturalWidth,ready:document.querySelector('.fa3-artwork')?.dataset.visualReady}:null,
    statuses:[...document.querySelectorAll('.fa3-artwork [role=status]')].map(e=>e.innerText.trim()),
    axes:[...document.querySelectorAll('.fa4-axis')].map(e=>({label:e.querySelector('span')?.textContent.trim(),value:e.querySelector('b')?.textContent.trim(),title:e.title})),
    skillButtons:[...document.querySelectorAll('.fa4-skill-portrait')].map(e=>({name:e.getAttribute('aria-label'),title:e.title,pressed:e.getAttribute('aria-pressed')})),
    info:document.querySelector('.fa4-readout')?.innerText||'',
   }));
   if(evidence.image?.naturalWidth===0&&evidence.image.src)inv.observations.fallbacks.push({kind,index,name:base.record,reason:'image still pending or failed at capture'});
   records.push({index,name:base.record,counter:base.counter,family:base.family,skinVariants,skinPreviewStates,engInfo:eng.map(x=>({view:x.view,body:x.body,attrs:x.attrs,text:x.text,fields:x.fields})),vieInfo:vie.map(x=>({view:x.view,body:x.body,attrs:x.attrs,text:x.text,fields:x.fields})),evidence});
   if(index===0&&kind==='hero')await page.screenshot({path:`${OUT}/fighter-info-vie.png`});
   if(index===0&&kind==='weapon')await page.screenshot({path:`${OUT}/weapon-info-vie.png`});
   if(index<total-1){await page.click('.fa3-record-navigation button:last-child');await wait(100);}
  }
  check(records.length===total,`${kind} dossier traversal covers every visible record`,{total,scanned:records.length});
  inv.eng[kind]=records.map(r=>({name:r.name,counter:r.counter,info:r.engInfo}));inv.vie[kind]=records.map(r=>({name:r.name,counter:r.counter,info:r.vieInfo}));
  inv.summary[kind]={total,records:records.map(r=>({name:r.name,family:r.family,variants:r.skinVariants.length,abilityButtonCount:r.evidence.skillButtons.length,axisCount:r.evidence.axes.length,specPages:Math.max(r.engInfo.length,r.vieInfo.length)}))};
 };
 await scanKind('hero');
 await scanKind('weapon');
 // Empty-search branch is a real view state, in both locales, with no catalog mutation.
 await language('vie');
 const search=await page.$('input[aria-label]');
 await page.click('input[type=search]');
 await page.type('input[type=search]','__ra2_no_matching_record__');
 await wait(180);
 const emptyVie=await page.evaluate(()=>({text:document.querySelector('.fa3-no-results')?.innerText||'',shown:document.querySelectorAll('.fa3-index-list button').length,attrs:[...document.querySelectorAll('.fa3-no-results[aria-label],.fa3-no-results[title]')].map(e=>({aria:e.getAttribute('aria-label'),title:e.title}))}));
 inv.observations.empty.vie=emptyVie;await page.screenshot({path:`${OUT}/empty-vie.png`});
 check(emptyVie.shown===0&&!!emptyVie.text,'Archive empty search state renders',emptyVie);
 const emptyExpected=await page.evaluate(s=>window.APEX_I18N.translate(s),'No matching records.');
 check(emptyExpected===emptyVie.text||!emptyExpected,'Archive empty-state translation is source/catalog consistent',{source:'No matching records.',expected:emptyExpected,actual:emptyVie.text});
 await language('eng');
 const emptyEng=await page.evaluate(()=>document.querySelector('.fa3-no-results')?.innerText||'');
 inv.observations.empty.eng=emptyEng;
 check(emptyEng==='No matching records.','Archive empty state restores ENG exactly',emptyEng);
 await page.click('input[type=search]');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await wait(180);
 check(errors.length===0,'Archive audit has no uncaught browser errors',errors);
 const report={base:BASE,checks:checks.length,failures:checks.filter(x=>!x.ok),counts:{heroes:inv.summary.hero?.total,weapons:inv.summary.weapon?.total},summary:inv.summary,inventory:{eng:inv.eng,vie:inv.vie},observations:inv.observations,limitation:'Chromium desktop emulation only; this is not physical Safari/Android proof or hosted-preview receipt.'};
 await writeFile(`${OUT}/all-dossiers-dom-audit.json`,JSON.stringify(report,null,2)+'\n');
 check(inv.observations.untranslatedPairs.length===0,'every curated dynamic dossier label matches its live VIE translation',inv.observations.untranslatedPairs.slice(0,12));
 check(inv.summary.hero.total===14,'all 14 visible fighter records covered',inv.summary.hero.total);
 check(inv.summary.weapon.total>0,'weapon records covered',inv.summary.weapon.total);
 console.log('RA-2 full Field Archive dossier audit complete. Report:',`${OUT}/all-dossiers-dom-audit.json`);
}finally{await context.close();await browser.close();}
