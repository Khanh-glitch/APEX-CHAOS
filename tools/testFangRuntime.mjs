import { spawn } from 'node:child_process';

const endpoint = process.env.APEX_CDP_ENDPOINT || 'http://127.0.0.1:9226';
const appUrl = process.env.APEX_APP_URL || 'http://127.0.0.1:5173';
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let chrome = null;

if (!process.env.APEX_CDP_ENDPOINT) {
  chrome = spawn(chromePath, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9226',
    '--user-data-dir=' + process.cwd() + '\\.fang-chrome-profile',appUrl], {stdio:'ignore',detached:false});
}

async function pageTarget(){for(let i=0;i<80;i++){try{const list=await fetch(`${endpoint}/json/list`).then(r=>r.json());const t=list.find(x=>x.type==='page'&&x.url.includes('127.0.0.1:5173'));if(t)return t;}catch{}await sleep(250);}throw new Error('FANG CDP page did not become ready.');}
const target=await pageTarget();
const socket=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let serial=0;const pending=new Map();
socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(!m.id||!pending.has(m.id))return;const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);});
function command(method,params={}){const id=++serial;socket.send(JSON.stringify({id,method,params}));return new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}

try{
  await command('Runtime.enable');await command('Page.enable');await command('Page.navigate',{url:appUrl});await sleep(1500);
  for(let i=0;i<100;i++){if(await evaluate('Boolean(window.APEX_FANG&&window.apexFighterTypes)'))break;await sleep(200);if(i===99)throw new Error('FANG runtime was not exposed.');}
  await evaluate(`Promise.all([...Object.values(APEX_FANG.clips).flat(),...Object.values(APEX_FANG.images)].map(img=>img.complete&&img.naturalWidth?true:img.decode?.().catch(()=>false)))`);
  const report={};
  report.selfTest=await evaluate('APEX_FANG.selfTest()');
  report.assets=await evaluate(`(()=>({clips:Object.fromEntries(Object.entries(APEX_FANG.clips).map(([k,v])=>[k,v.filter(x=>x.complete&&x.naturalWidth).length])),images:Object.fromEntries(Object.entries(APEX_FANG.images).map(([k,v])=>[k,{w:v.naturalWidth,h:v.naturalHeight,src:v.src}]))}))()`);
  report.roster=await evaluate(`(()=>{goToSelect();const card=document.querySelector('#roster-grid [data-fighter="FANG"]');card?.click();syncSelectedFighterVfx();return{types:apexFighterTypes.filter(x=>x.name==='FANG').length,card:!!card,pick:getComputedStyle(card).backgroundImage,picked:document.querySelector('#p1-fighter-vfx')?.src||'',solo:(goToSoloSelect(),document.querySelectorAll('#solo-roster .solo-card[data-name="FANG"]').length),trial:(goToTrialSelect(),document.querySelectorAll('#trial-roster .solo-card[data-name="FANG"]').length),tam:(startTamChienMode(),document.querySelectorAll('#tam-chien-root [data-champion="FANG"]').length)}})()`);
  report.normal=await evaluate(`(()=>{const F=apexFighterTypes.find(x=>x.name==='FANG'),I=apexFighterTypes.find(x=>x.name==='ICE');startSpecificMatch(F,I,{countdown:false,trial:true});cancelAnimationFrame(reqId);reqId=0;const [f,e]=fighters,d=f.data.fang;e.baseSpeed=0;e.statuses.abilityDisabled={timer:99};f.x=200;f.y=500;e.x=850;e.y=500;f.setDir(1,0);d.visualDir={x:1,y:0};d.frame=1;d.frameElapsed=0;for(let i=0;i<13;i++){matchClock+=1/24;APEX_FANG.FangType.update(f,e,1/24+.000001);}return{hp:f.hp,maxHp:f.maxHp,frame:d.frame,state:d.state,speed:f.baseSpeed,pounceSpeed:APEX_FANG.constants.pounceSpeed}})()`);
  report.huntBoundary=await evaluate(`(()=>{const [f,e]=fighters,d=f.data.fang;d.state='NORMAL_LOOP';d.clip='normal';d.frame=3;d.frameElapsed=0;d.huntPending=true;const seq=[];for(let i=0;i<12;i++){matchClock+=1/24;APEX_FANG.FangType.update(f,e,1/24+.000001);seq.push(d.state+':'+d.frame);}return{seq,startSoundBoundary:seq.indexOf('HUNT_TRANSITION:2'),noEarly:seq.slice(0,10).every((x,i)=>x==='NORMAL_LOOP:'+(i+4))}})()`);
  report.pounce=await evaluate(`(()=>{const F=apexFighterTypes.find(x=>x.name==='FANG'),I=apexFighterTypes.find(x=>x.name==='ICE');startSpecificMatch(F,I,{countdown:false,trial:true});cancelAnimationFrame(reqId);reqId=0;const [f,e]=fighters,d=f.data.fang;e.hp=e.maxHp=1000;e.baseSpeed=0;e.statuses.abilityDisabled={timer:99};f.x=250;f.y=500;e.x=520;e.y=500;f.setDir(1,0);d.visualDir={x:1,y:0};d.state='HUNT_LOOP';d.clip='hunt';d.frame=9;d.frameElapsed=0;d.huntActive=true;const before=e.hp;for(let i=0;i<240;i++){matchClock+=1/120;APEX_FANG.FangType.update(f,e,1/120);}return{damage:before-e.hp,stack:d.stacks.length,action:d.action&&{recovering:d.action.recovering,freeze:d.action.freezeH20,hit:d.action.hit,animFps:d.action.animFps,frameElapsed:d.frameElapsed},state:d.state,frame:d.frame,x:f.x,opponentX:e.x,labels:f.damageLabels}})()`);
  report.thirdStackCloneBurst=await evaluate(`(()=>{const F=apexFighterTypes.find(x=>x.name==='FANG'),I=apexFighterTypes.find(x=>x.name==='ICE');startSpecificMatch(F,I,{countdown:false,trial:true});cancelAnimationFrame(reqId);reqId=0;const [f,e]=fighters,d=f.data.fang;e.hp=e.maxHp=1000;e.baseSpeed=0;e.statuses.abilityDisabled={timer:99};f.x=250;f.y=500;e.x=520;e.y=500;f.setDir(1,0);d.visualDir={x:1,y:0};d.stacks=[{expires:999},{expires:999}];d.stackVisualCount=2;d.state='HUNT_LOOP';d.clip='hunt';d.frame=9;d.frameElapsed=0;d.huntActive=true;const before=e.hp;let burst=0;for(let i=0;i<80;i++){matchClock+=1/120;APEX_FANG.FangType.update(f,e,1/120);burst=Math.max(burst,d.clones.length);}for(let i=0;i<120;i++){matchClock+=1/120;APEX_FANG.FangType.update(f,e,1/120);}return{damage:before-e.hp,stack:d.stacks.length,burstClones:burst,clonesAfter:d.clones.length,state:d.state,frame:d.frame,stun:!!e.statuses.stun,pending:d.pendingHowl}})()`);
  report.threeWolf=await evaluate(`(()=>{const F=apexFighterTypes.find(x=>x.name==='FANG'),I=apexFighterTypes.find(x=>x.name==='ICE');startSpecificMatch(F,I,{countdown:false,trial:true});cancelAnimationFrame(reqId);reqId=0;const [f,e]=fighters,d=f.data.fang;e.hp=500;e.maxHp=1000;e.baseSpeed=0;e.statuses.abilityDisabled={timer:99};f.x=250;f.y=500;e.x=520;e.y=500;f.setDir(1,0);d.visualDir={x:1,y:0};d.stacks=[];d.clones=[{id:91,kind:'moon',side:-1,x:210,y:420,hp:200,life:10,reserved:false,dead:false},{id:92,kind:'sun',side:1,x:210,y:580,hp:200,life:10,reserved:false,dead:false}];d.state='HUNT_LOOP';d.clip='hunt';d.frame=9;d.frameElapsed=0;d.huntActive=true;const before=e.hp;for(let i=0;i<240;i++){matchClock+=1/120;APEX_FANG.FangType.update(f,e,1/120);}return{damage:before-e.hp,clones:d.clones.length,trueDamage:f.damageLabels['fang-lunar-solar-true']||0,main:f.damageLabels['fang-hunting']||0,labels:f.damageLabels}})()`);
  report.cleanup=await evaluate(`(()=>{goToMenu();return{afterimages:APEX_FANG.state.afterimages.length,marks:APEX_FANG.state.marks.length,rings:APEX_FANG.state.rings.length,particles:APEX_FANG.state.particles.length}})()`);
  console.log(JSON.stringify(report,null,2));
}finally{try{socket.close();}catch{}if(chrome){chrome.kill();await sleep(250);}}
