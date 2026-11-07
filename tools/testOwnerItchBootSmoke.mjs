// Acceptance: run the exact dist-itch-html5 package beneath /html/apex/,
// where itch.io hosts uploaded ZIP roots. Fail on 404, JS boot exceptions,
// missing boot UI or nonfunctional Portrait Studio iframe.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('dist-itch-html5');
const chromePath=process.env.CHROME_PATH;
if(!chromePath)throw Error('CHROME_PATH is required');
const port=Number(process.env.OWNER_ITCH_TEST_PORT||4189);
const cdpPort=Number(process.env.OWNER_ITCH_CDP_PORT||9490);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
const requests=[];
const server=createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let rel=pathname.startsWith('/html/apex/')?pathname.slice('/html/apex/'.length):null;
  if(rel===null){res.writeHead(404);res.end('Outside itch game root');requests.push('404 '+pathname);return;}
  if(!rel||rel.endsWith('/'))rel+='index.html';
  const file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()){
    requests.push('404 '+pathname);res.writeHead(404);res.end('Not Found');return;
  }
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(port,'127.0.0.1',r));
const chrome=spawn(chromePath,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--remote-allow-origins=*','--remote-debugging-port='+cdpPort,'--user-data-dir=/tmp/apex-itch-smoke-'+process.pid,'about:blank'],{stdio:'ignore'});
let ws=null,id=0;
const pending=new Map(),exceptions=[];
const failAfter=()=>{for(const p of pending.values())p.reject(new Error('CDP disconnected'));pending.clear()};
async function httpJson(p){const r=await fetch('http://127.0.0.1:'+cdpPort+p);return r.json();}
function cmd(method,params={}){
  return new Promise((resolve,reject)=>{
    const key=++id,timeout=setTimeout(()=>{pending.delete(key);reject(Error('CDP timeout '+method));},20000);
    pending.set(key,{resolve:v=>{clearTimeout(timeout);resolve(v)},reject:e=>{clearTimeout(timeout);reject(e)}});
    ws.send(JSON.stringify({id:key,method,params}));
  });
}
const expr=async code=>{
  const r=await cmd('Runtime.evaluate',{expression:code,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.text+' '+(r.exceptionDetails.exception?.description||''));
  return r.result?.value;
};
const wait=async(code,label,ms=45000)=>{
  const start=Date.now();while(Date.now()-start<ms){
    try{const value=await expr(code);if(value)return value;}catch{}
    await sleep(250);
  }throw Error('Timeout '+label);
};
try{
  for(let j=0;j<100;j++){try{await httpJson('/json/version');break}catch{await sleep(150);if(j===99)throw Error('Chrome failed to start')}}
  const targets=await httpJson('/json/list');
  ws=new WebSocket(targets.find(x=>x.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=event=>{
    const m=JSON.parse(event.data);
    if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}
    if(m.method==='Runtime.exceptionThrown')exceptions.push(String(m.params?.exceptionDetails?.exception?.description||m.params?.exceptionDetails?.text||'').slice(0,300));
  };
  ws.onclose=failAfter;
  await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Network.enable');
  const base='http://127.0.0.1:'+port+'/html/apex/';
  await cmd('Page.navigate',{url:base+'index.html'});
  await wait("!!document.querySelector('#apex-boot-start')",'game boot button',60000);
  await expr("document.querySelector('#apex-boot-start').click();true");
  await wait("!!document.querySelector('#freeBattle')",'game Home UI',60000);
  console.log('PASS: packaged itch game booted and reached Home under /html/apex/');
  if(requests.length)throw Error('Game 404: '+requests.slice(0,10).join(', '));
  if(exceptions.length)throw Error('Game JavaScript exception: '+exceptions.slice(0,3).join('; '));
  await cmd('Page.navigate',{url:base+'portrait-studio.html'});
  await wait("!!document.querySelector('#apex-portrait-stage')",'Portrait Studio document',30000);
  await wait("(()=>{const f=document.querySelector('#apex-portrait-stage');try{return f.contentDocument?.querySelector('#apex-boot-start')!==null}catch{return false}})()",'Portrait Studio game boot',60000);
  const portrait=await expr("(()=>{const f=document.querySelector('#apex-portrait-stage');return {width:f.clientWidth,height:f.clientHeight,src:new URL(f.getAttribute('src'),location.href).pathname,loaded:!!f.contentDocument.querySelector('#apex-boot-start')}})()");
  if(portrait.width!==432||portrait.height!==768||!portrait.loaded||portrait.src!=='/html/apex/index.html')throw Error('Invalid Portrait Studio: '+JSON.stringify(portrait));
  if(requests.length)throw Error('Nested studio 404: '+requests.slice(0,10).join(', '));
  if(exceptions.length)throw Error('Studio JavaScript exception: '+exceptions.slice(0,3).join('; '));
  console.log('PASS: Portrait Studio loads 432x768 real game iframe; no 404/JS exception');
}catch(err){console.error('FAIL: owner itch boot smoke',err);process.exitCode=1}
finally{try{ws?.close()}catch{};chrome.kill('SIGKILL');await new Promise(r=>server.close(r))}
