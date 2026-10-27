// Acceptance of the ACTUAL newest-Gold itch artifact under a strict CDN subpath.
// Uses installed Chrome's native DevTools WebSocket; no Vite SPA 404 fallback.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const root=path.resolve('dist-itch-html5');
const reportDir=path.resolve('reports/latest-gold-itch');
fs.mkdirSync(reportDir,{recursive:true});
const mount='/html/apex/';
const bad=[],exceptions=[],results=[],external=[];
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
 '.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp',
 '.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.woff':'font/woff',
 '.ogg':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
 let raw;
 try{raw=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 if(!raw.startsWith(mount)||raw.includes('..')){bad.push('escaped root: '+raw);res.writeHead(404);res.end();return;}
 let sub=raw.slice(mount.length);
 if(!sub||sub.endsWith('/'))sub+='index.html';
 const filename=path.resolve(root,sub);
 if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){
  bad.push('missing file: '+raw);res.writeHead(404);res.end();return;
 }
 res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream'});
 fs.createReadStream(filename).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const profile=path.join('/tmp','apex-latest-itch-cdp-'+process.pid);
const chrome=spawn(process.env.CHROME_PATH||'google-chrome',[
 '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
 '--hide-scrollbars','--no-first-run','--no-default-browser-check','--remote-allow-origins=*',
 '--remote-debugging-port=9357','--user-data-dir='+profile,'about:blank'
],{stdio:'ignore'});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ws,nextId=0;
const pending=new Map();
const send=(method,params={})=>new Promise((resolve,reject)=>{
 const id=++nextId, t=setTimeout(()=>{pending.delete(id);reject(new Error(method+' timed out'))},60000);
 pending.set(id,{resolve:v=>{clearTimeout(t);resolve(v)},reject:e=>{clearTimeout(t);reject(e)}});
 ws.send(JSON.stringify({id,method,params}));
});
const inspect=async js=>{
 const response=await send('Runtime.evaluate',{expression:js,returnByValue:true,awaitPromise:true});
 if(response.exceptionDetails)throw new Error('Chrome evaluation failed: '+(response.exceptionDetails.exception?.description||response.exceptionDetails.text));
 return response.result?.value;
};
const navigate=async(p,filename)=>{
 const url=origin+mount+filename;
 await send('Page.navigate',{url});
 await pause(9000);
 const data=await inspect('(()=>({url:location.href,title:document.title,root:document.querySelector("#root")?.children.length||0,text:(document.body?.innerText||"").slice(0,200),html:document.documentElement.outerHTML.length}))()');
 const pic=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 fs.writeFileSync(path.join(reportDir,p+'.png'),Buffer.from(pic.data,'base64'));
 results.push({profile:p,...data});
 assert.ok(data.url.startsWith(origin+mount),p+' left itch directory '+data.url);
 assert.ok(data.root>0 && data.html>2000,p+' failed product boot '+JSON.stringify(data));
 return data;
};
try{
 let target;
 for(let i=0;i<100;i++){
  try{const x=await fetch('http://127.0.0.1:9357/json/list');const js=await x.json();target=js.find(t=>t.type==='page');if(target)break}catch{}
  await pause(200);
 }
 assert.ok(target,'Chrome DevTools target never available');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no});
 ws.onmessage=e=>{
  let m;try{m=JSON.parse(e.data)}catch{return}
  if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}
  if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params?.exceptionDetails?.exception?.description||m.params?.exceptionDetails?.text);
  if(m.method==='Network.responseReceived'){
    const response=m.params?.response,u=response?.url||'';
    if(response?.status>=400)bad.push(response.status+' '+u);
    if(/^https?:/.test(u)&&!u.startsWith(origin))external.push(u);
  }
 };
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 const desktop=await navigate('desktop','index.html');
 assert.match(desktop.title,/APEX CHAOS/i,'latest Gold brand missing on desktop');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await send('Network.setUserAgentOverride',{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
 const mobile=await navigate('mobile','index.html');
 assert.match(mobile.title,/APEX CHAOS/i,'mobile must use latest production entry, not old Gold Lab');
 await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:2,mobile:true});
 await send('Page.navigate',{url:origin+mount+'bot-wave/index.html'});
 let wave=null;
 for(let i=0;i<90;i++){
  await pause(400);
  wave=await inspect('(()=>{const f=document.querySelector("#wave");try{return {wrapper:!!f,visible:!!f&&!f.hidden,backend:f?.contentWindow?.handLab?.fluid?._pressureBackend||null,pilot:!!f?.contentWindow?.BOXE_WAVE_PILOT,skin:!!f?.contentDocument?.getElementById("bw-interface-v2"),url:f?.src}}catch(e){return {error:String(e)}}})()').catch(()=>null);
  if(wave?.backend==='wasm-exact-14-iter'&&wave.visible&&wave.skin)break;
 }
 const shot=await send('Page.captureScreenshot',{format:'png'});
 fs.writeFileSync(path.join(reportDir,'bot-wave.png'),Buffer.from(shot.data,'base64'));
 results.push({profile:'bot-wave',...wave});
 assert.ok(wave?.visible&&wave?.pilot&&wave?.skin,'latest BOT WAVE HUD not live: '+JSON.stringify(wave));
 assert.equal(wave.backend,'wasm-exact-14-iter','WASM optimization not active on newest Gold');
 assert.deepEqual(bad,[],'Missing/escaped itch assets: '+JSON.stringify(bad.slice(0,25)));
 assert.deepEqual(exceptions,[],'Unhandled Chrome errors: '+JSON.stringify(exceptions.slice(0,15)));
 // Remote resources are not used to "patch" missing first-party local assets.
 console.log('LATEST GOLD ITCH BROWSER PASS',JSON.stringify({results,external:external.slice(0,12)}));
}catch(e){console.error('LATEST GOLD ITCH BROWSER FAIL',String(e),{results,bad:bad.slice(0,30),exceptions:exceptions.slice(0,30),external:external.slice(0,20)});throw e}
finally{
 fs.writeFileSync(path.join(reportDir,'acceptance.json'),JSON.stringify({results,bad,exceptions,external},null,2));
 try{ws?.close()}catch{}
 chrome.kill('SIGKILL');
 await new Promise(resolve=>server.close(resolve));
}
