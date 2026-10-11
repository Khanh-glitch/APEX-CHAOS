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

 }
 console.log('PASS localization desktop + portrait Chrome smoke');
}finally{
 try{ws?.close()}catch{}
 child.kill('SIGTERM');
}
