// Production-browser synchronous game step+draw proxy for all four
// problematic heroes. Uses ACTUAL native combat runtimes and Gold VFX.
// This is not wall-clock FPS and not a replacement for owner's hardware GPU.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
const url=process.env.APEX_APP_URL||'http://127.0.0.1:4173';
const chrome=process.env.CHROME_PATH;
const out=process.env.APEX_PROFILE_FILE||'four-hero-frame-profile.json';
if(!chrome)throw Error('CHROME_PATH missing');
const browser=await puppeteer.launch({executablePath:chrome,headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-setuid-sandbox','--window-size=1440,1080'],
  defaultViewport:{width:1440,height:1080}});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error'&&!/net::ERR_/.test(m.text()))errors.push(m.text().slice(0,300));});
let result;
try{
  await page.goto(url,{waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>typeof window.__apexEnsureDeferredRuntimes==='function',{timeout:40000});
  await page.evaluate(async()=>{await window.__apexEnsureDeferredRuntimes('arsenalProduct');window.__APEX_TEST_MODE=true});
  result=await page.evaluate(()=>{
    const G=window;
    const scenes=[
      ['BOXE','ICE'],
      ['SHURI','ICE'],
      ['CRYSTAL','BOXE'],
      ['ICE','CRYSTAL'],
    ];
    const stats=a=>{
      const s=a.slice().sort((a,b)=>a-b),q=p=>s[Math.min(s.length-1,Math.floor((s.length-1)*p))];
      return {n:s.length,p50:q(.5),p95:q(.95),max:s[s.length-1],mean:s.reduce((a,b)=>a+b,0)/s.length};
    };
    const rows=[];
    function one(a,b){
      if(typeof reqId!=='undefined' && reqId){cancelAnimationFrame(reqId);reqId=0;}
      if(G.APEX_ARSENAL?.state?.active)G.exitArsenalBattleMode();
      G.APEX_HERO_REWORK?.setSeed?.(4242);
      G.startArsenalBattleMode(a,b,{testFixture:true});
      if(typeof reqId!=='undefined' && reqId){cancelAnimationFrame(reqId);reqId=0;}
      if(!G.APEX_ARSENAL?.state?.active)throw Error('Battle inactive: '+a+'/'+b);
      G.APEX_ARSENAL.state.labMode=true;
      G.APEX_HERO_REWORK?.setAiEnabled?.(false);
      const fighters=G.fighters.slice(0,2);
      if(fighters.length<2)throw Error('Battle did not spawn fighters '+a+'/'+b);
      const [f0,f1]=fighters;
      f0.baseSpeed=0;f1.baseSpeed=0;
      f0.x=220;f0.y=500;f1.x=790;f1.y=500;
      f0.setDir(1,0);f1.setDir(-1,0);
      const warm=25, count=100;
      const step=[],draw=[],frame=[],cast=[];
      for(let i=0;i<warm+count;i++){
        if(i===warm){
          for(const f of fighters)for(const key of ['A1','A2']){
            try{
              const r=G.APEX_HERO_REWORK?.pressAbility?.(f,key);
              cast.push({hero:f.__hrCombatant?.heroId||f.name,skill:key,ok:!!r?.ok});
            }catch(e){cast.push({hero:f.name,skill:key,error:String(e).slice(0,140)})}
          }
        }
        const t0=performance.now();
        G.APEX_ARSENAL.step(1/60);
        const t1=performance.now();
        G.draw();
        const t2=performance.now();
        if(i>=warm){step.push(t1-t0);draw.push(t2-t1);frame.push(t2-t0);}
      }
      rows.push({matchup:[a,b],step:stats(step),draw:stats(draw),frame:stats(frame),cast});
    }
    for(const [a,b] of scenes)one(a,b);
    return {kind:'synchronous real browser step+draw PROXY, not encoded FPS nor physical GPU',rows};
  });
}finally{await browser.close();}
result.pageErrors=errors;
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
for(const row of result.rows)console.log(JSON.stringify({
  matchup:row.matchup,frameP50:+row.frame.p50.toFixed(3),
  frameP95:+row.frame.p95.toFixed(3),drawP95:+row.draw.p95.toFixed(3),cast:row.cast
}));
if(errors.length)throw Error('Browser exceptions: '+errors.slice(0,5).join('; '));
console.log('PROFILE_SAVED '+out);
