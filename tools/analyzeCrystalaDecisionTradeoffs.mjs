// CRYSTALA decision-tradeoff probe — deterministic production-browser analysis.
// Non-balance-authority: measures the live laws so design decisions are evidence-led.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const APP=process.env.APEX_APP_URL||'http://127.0.0.1:4173';
const CHROME=process.env.CHROME_PATH;
if(!CHROME)throw new Error('CHROME_PATH is required');
const OUT=path.resolve('docs/hero-rework/crystala-v1/perf');
fs.mkdirSync(OUT,{recursive:true});

const browser=await puppeteer.launch({
  executablePath:CHROME,headless:true,
  args:['--headless=new','--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--window-size=1440,1080'],
  defaultViewport:{width:1440,height:1080},
});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.goto(APP,{waitUntil:'load',timeout:30000});
await page.waitForFunction(()=>typeof window.__apexEnsureDeferredRuntimes==='function',{timeout:30000});
await page.evaluate(async()=>{await window.__apexEnsureDeferredRuntimes('arsenalQuest');});

const result=await page.evaluate(()=>{
  const G=window, DT=1/60;
  if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0;}
  const HR=G.APEX_HERO_REWORK, CRY=G.APEX_CRYSTAL, CFG=G.APEX_ARSENAL_CONFIG;
  if(!HR||!CRY||!CFG)throw new Error('Crystala production runtime unavailable');

  const clone=x=>JSON.parse(JSON.stringify(x));
  function stopRaf(){if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0;}}
  function fresh(){
    if(G.APEX_ARSENAL?.state?.active)G.exitArsenalQuestMode();
    G.startArsenalQuestMode('CRYSTAL','ROBOT');stopRaf();
    if(G.APEX_ARSENAL?.state)G.APEX_ARSENAL.state.labMode=true;
    HR.setAiEnabled?.(false);
    const a=G.fighters[0],b=G.fighters[1];
    a.baseSpeed=0;b.baseSpeed=0;a.x=180;a.y=500;a.setDir(1,0);b.x=820;b.y=500;b.setDir(-1,0);
    for(let i=0;i<3;i++)G.APEX_ARSENAL.step(DT);
    return {a,b,ct:HR.byCombatant(a),t0:G.matchClock||0};
  }
  function step(n=1){for(let i=0;i<n;i++)G.APEX_ARSENAL.step(DT);}
  function stepUntil(fn,maxSec){for(let i=0;i<Math.ceil(maxSec/DT);i++){if(fn())return i*DT;step(1);}return null;}
  function atTime(t){stepUntil(()=>((G.matchClock||0)>=t-1e-9),10);}
  function fire(mm,id,opts={}){
    const spec=CFG.WEAPONS[id]||{};
    const speed=opts.speed||spec.bulletSpeed||2600;
    const damage=opts.damage??spec.damagePerShot??spec.damage??spec.damagePerPellet??4.5;
    const y=opts.y??mm.b.y, ty=opts.ty??mm.a.y;
    G.APEX_ARSENAL.weaponApi.fireBullet({
      owner:mm.b,x:opts.x??mm.b.x,y,angle:Math.atan2(ty-y,mm.a.x-(opts.x??mm.b.x)),
      speed,damage,radius:spec.bulletRadius||7,life:opts.life||spec.bulletLife||1,weapon:id,color:'#fff'
    });
  }
  function forceWallThreshold(mm){
    fire(mm,'PISTOL',{damage:0.001});
    const seen=stepUntil(()=>CRY.inspect(mm.ct)?.available<6,0.25);
    if(seen==null)throw new Error('could not create 5-shard Wall threshold');
  }
  function prepare(mm,mode){
    const castK=HR.pressAbility(mm.a,'A2');
    if(!castK.ok)throw new Error('K cast failed');
    const ks=CRY.inspect(mm.ct).k.startedAt;
    if(mode==='PRISON_EARLY'){
      const j=HR.pressAbility(mm.a,'A1'); if(!j.ok)throw new Error('early Prison failed');
    }else if(mode==='WALL_EARLY'){
      forceWallThreshold(mm);
      const j=HR.pressAbility(mm.a,'A1'); if(!j.ok)throw new Error('early Wall failed');
    }else if(mode==='WALL_LATE'){
      atTime(ks+1.95);
      forceWallThreshold(mm);
      const j=HR.pressAbility(mm.a,'A1'); if(!j.ok)throw new Error('late Wall failed');
    }
    return ks;
  }
  function pressure(mm,kind,start){
    atTime(start);
    if(kind==='PRECISION'){
      fire(mm,'SNIPER'); step(24);
      atTime(start+0.82); fire(mm,'SNIPER'); step(30);
    }else if(kind==='BURST'){
      for(let i=0;i<8;i++)fire(mm,'SHOTGUN',{y:mm.b.y+(i-3.5)*2.2,ty:mm.a.y});
      step(40);
    }else if(kind==='RAPID'){
      for(let i=0;i<10;i++){fire(mm,'P90',{y:mm.b.y+(i%2?2:-2)});step(4);}
      step(35);
    }
  }
  function one(mode,kind){
    const mm=fresh(),hpA0=mm.a.hp,hpB0=mm.b.hp,ks=prepare(mm,mode);
    // Live-window scripts start after normal Gold construct closure; POST_K
    // intentionally starts after Awakening has ended to expose free conversion.
    const start=kind==='POST_K'?ks+3.0:ks+1.0;
    if(kind==='POST_K'){
      atTime(start);
      fire(mm,'M16');step(20);fire(mm,'M16');step(30);
    }else pressure(mm,kind,start);
    // Let reflected legs resolve and constructs finish enough to record outcomes.
    atTime(Math.max((G.matchClock||0)+0.1,ks+5.6));
    const ins=CRY.inspect(mm.ct),tele=clone(ins.telemetry);
    return {
      mode,pressure:kind,
      hpLossCrystal:Math.max(0,hpA0-mm.a.hp),
      hpLossOpponent:Math.max(0,hpB0-mm.b.hp),
      k:ins.k,available:ins.available,
      constructs:ins.constructs,
      summary:{
        intercepts:tele.intercepts,overflowHits:tele.overflowHits,
        preventedDamage:tele.preventedDamage,reflectedDamage:tele.reflectedDamage,
        constructReflects:tele.constructReflects,wallCasts:tele.wallCasts,prisonCasts:tele.prisonCasts,
      },
      decisionWindows:tele.decisionWindows,
      constructDecisions:tele.constructDecisions,
    };
  }

  const modes=['K_ONLY','PRISON_EARLY','WALL_EARLY','WALL_LATE'];
  const pressures=['PRECISION','BURST','RAPID','POST_K'];
  const rows=[];
  for(const pressure of pressures)for(const mode of modes)rows.push(one(mode,pressure));
  return {rows,revision:G.APEX_ARSENAL_RUNTIME_REVISION||null};
});

result.pageErrors=errors;result.generatedAt=new Date().toISOString();
const out=path.join(OUT,'crystala-decision-tradeoffs.json');
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
for(const r of result.rows){
  const d=r.constructDecisions?.[0];
  console.log('CRYSTALA_DECISION '+JSON.stringify({
    pressure:r.pressure,mode:r.mode,hpLossCrystal:+r.hpLossCrystal.toFixed(2),hpLossOpponent:+r.hpLossOpponent.toFixed(2),
    intercepts:r.summary.intercepts,prevented:+r.summary.preventedDamage.toFixed(2),
    constructReflects:r.summary.constructReflects,kind:d?.kind||null,
    jAt:d?+d.sinceKStart.toFixed(3):null,kRemainingAtJ:d?+d.kRemaining.toFixed(3):null,
    blocked:d?+d.blockedProjectileDamage.toFixed(2):0,reflectedRealized:d?+d.reflectedDamageRealized.toFixed(2):0,
    endReason:d?.endReason||null,solidLife:d?.solidLifeRealized?+d.solidLifeRealized.toFixed(3):0,
  }));
}
console.log('PAGE_ERRORS '+JSON.stringify(errors));
await browser.close();
if(errors.length)process.exitCode=2;
