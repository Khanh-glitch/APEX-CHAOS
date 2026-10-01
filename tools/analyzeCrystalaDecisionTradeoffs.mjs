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
    const mm={a,b,ct:HR.byCombatant(a),ctb:HR.byCombatant(b),t0:G.matchClock||0,damage:{a:0,b:0}};
    // Lab mode restores HP after each real transaction, so combatant damageTaken
    // intentionally reads 0. Measure the authoritative AQ labDamage delta around
    // each target's synchronous takeDamage call instead; mitigation/status/
    // reflection have already resolved by the time the inner wrapper increments it.
    for(const [fighter,key] of [[a,'a'],[b,'b']]){
      const prev=fighter.takeDamage;
      fighter.takeDamage=function(...args){
        const st=G.APEX_ARSENAL?.state, before=st?.labDamage||0;
        const out=prev.apply(this,args);
        const after=st?.labDamage||0;
        mm.damage[key]+=Math.max(0,after-before);
        return out;
      };
    }
    return mm;
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
  // V2 §1.1: WALL is castable with K off (HEXA path is not eligible without an
  // open Awakening decision window), and its only shard cost is BLADE L/R [0,1].
  // The old 5-shard threshold trick is gone — no shard busywork is needed.
  function prepare(mm,mode){
    if(mode==='DORMANT') return G.matchClock||0;
    if(mode==='WALL_EARLY'){
      // V2 gate 2: the early Wall — cast immediately with K OFF.
      const j=HR.pressAbility(mm.a,'A1'); if(!j.ok)throw new Error('early K-off Wall failed');
      return G.matchClock||0;
    }
    const castK=HR.pressAbility(mm.a,'A2');
    if(!castK.ok)throw new Error('K cast failed');
    const ks=CRY.inspect(mm.ct).k.startedAt;
    if(mode==='PRISON_EARLY'){
      const j=HR.pressAbility(mm.a,'A1'); if(!j.ok)throw new Error('early Prison failed');
    }else if(mode==='WALL_DELAYED'){
      // V2 routing clause 6: after the HEXA decision window closes the HEXA
      // path is not eligible and J falls back to the WALL while K is still on.
      atTime(ks+1.25);
      const j=HR.pressAbility(mm.a,'A1'); if(!j.ok)throw new Error('delayed Wall failed');
      const c=CRY.inspect(mm.ct).constructs[0];
      if(!c||c.kind!=='wall'||c.shardIds.join()!=='0,1')throw new Error('delayed Wall is not blades [0,1]: '+JSON.stringify(c));
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
    const mm=fresh();
    const ks=prepare(mm,mode);
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
      hpLossCrystal:mm.damage.a,
      hpLossOpponent:mm.damage.b,
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

  const modes=['DORMANT','K_ONLY','PRISON_EARLY','WALL_EARLY','WALL_DELAYED'];
  const pressures=['PRECISION','BURST','RAPID','POST_K'];
  const rows=[];
  for(const pressure of pressures)for(const mode of modes)rows.push(one(mode,pressure));
  // A broken control silently makes every defensive branch look perfect. Make
  // the probe self-validating: each scripted hostile pressure must damage a
  // dormant Crystal under the exact same real projectile path.
  for(const pressure of pressures){
    const control=rows.find(r=>r.pressure===pressure&&r.mode==='DORMANT');
    if(!control || !(control.hpLossCrystal>0)) throw new Error('invalid dormant damage control for '+pressure);
  }

  // V2 §1.1 routing clause 6 — the removed V1 pattern is replaced by a defined
  // fallback: J after the HEXA decision-window deadline must FALL BACK TO WALL
  // (blades [0,1]) while K itself remains active — succeed with the 8.0 s
  // cooldown, never fail-and-replay.
  const late=fresh();
  const lateKs=prepare(late,'K_ONLY');
  atTime(lateKs+1.25);
  const lateBefore=CRY.inspect(late.ct);
  const lateAttempt=HR.pressAbility(late.a,'A1');
  const lateAfter=CRY.inspect(late.ct);
  const lateWall=lateAfter.constructs[0];
  const lateProbe={
    at:(G.matchClock||0)-lateKs,
    kActive:lateBefore.k.active,
    decisionOpen:lateBefore.k.constructDecisionOpen,
    available:lateBefore.available,
    ok:!!lateAttempt.ok, reason:lateAttempt.reason||null,
    kind:lateWall?lateWall.kind:null,
    shardIds:lateWall?lateWall.shardIds:null,
    cd:HR.abilityController(late.ct).cooldownLeft('A1'),
    jCasts:lateAfter.k.jCasts,
  };
  if(!lateProbe.kActive || lateProbe.decisionOpen || !lateProbe.ok || lateProbe.kind!=='wall'
    || String(lateProbe.shardIds)!=='0,1' || lateProbe.cd<7.99 || lateProbe.jCasts!==1)
    throw new Error('late J wall-fallback gate failed: '+JSON.stringify(lateProbe));

  return {rows,lateProbe,revision:G.APEX_ARSENAL_RUNTIME_REVISION||null};
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
console.log('LATE_J_PROBE '+JSON.stringify(result.lateProbe));
console.log('PAGE_ERRORS '+JSON.stringify(errors));
await browser.close();
if(errors.length)process.exitCode=2;
