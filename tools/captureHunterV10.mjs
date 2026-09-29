import fs from'node:fs';import path from'node:path';import{createRequire}from'node:module';import puppeteer from'puppeteer-core';import chromium,{inflate}from'@sparticuz/chromium';
const require=createRequire(import.meta.url);await inflate(path.join(path.dirname(path.dirname(require.resolve('@sparticuz/chromium'))),'bin/al2023.tar.br'));process.env.LD_LIBRARY_PATH='/tmp/al2023/lib:'+(process.env.LD_LIBRARY_PATH||'');
const OUT='docs/hero-rework/hunter-v1.1/evidence';const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});const errors=[];
try{const page=await browser.newPage();await page.setViewport({width:1440,height:1000});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')console.log('BROWSER',m.text());});await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.APEX_HUNTER_PRESENTATION?.ready,{timeout:60000});
await page.evaluate(()=>{
 const draw=window.draw;window.draw=()=>{};window.update=()=>{};
 window.Q={draw,setup(){if(APEX_ARSENAL.state?.active)exitArsenalQuestMode();APEX_HERO_REWORK.setAiEnabled(false);startArsenalQuestMode('HUNTER','ICE');const s=APEX_ARSENAL.state;s.slots=[];s.spawnHeld=true;s.spawnTimer=1e6;s.unarmedFastConsumed=true;this.a=fighters[0];this.b=fighters[1];this.a.x=400;this.a.y=500;this.b.x=850;this.b.y=200;this.a.setDir(1,0);this.b.setDir(0,1);this.ct=APEX_HERO_REWORK.byCombatant(this.a);this.ctl=APEX_HERO_REWORK.abilityController(this.ct);},step(n=1){for(let i=0;i<n;i++)APEX_ARSENAL.step(1/60);APEX_COMBAT_HUD.sync();cameraShake=0;this.draw();},cast(slot){return this.ctl.tryCast(slot,'p1');},snap(){return{body:{x:this.a.x,y:this.a.y},skills:structuredClone(Object.fromEntries(['A1','A2'].map(k=>[k,{charges:this.ct.skills[k].charges,rechargeLeft:this.ct.skills[k].rechargeLeft,cd:this.ctl.cooldownLeft(k)}]))),rig:APEX_HUNTER_PRESENTATION.inspect(this.a),traps:APEX_HERO_REWORK.match.world.snares.map(t=>({id:t.id,x:t.x,y:t.y,phase:t.phase,t:t.phaseTime,pose:t.visual?._rt?.arms.map(a=>a.root.y)})),cache:{...APEX_HUNTER_PRESENTATION.cacheStats}}}};Q.setup();Q.step();
});
const results=await page.evaluate(()=>{
 const results={},hr=APEX_HERO_REWORK,world=()=>hr.match.world;
 function check(name,ok,data){results[name]={pass:!!ok,data};}
 Q.setup();const charge=[Q.ct.skills.A1.charges],axes=[];let unchanged=true;
 for(let i=0;i<3;i++){Q.a.x=i===1?600:400;Q.a.y=250+i*230;Q.a.setDir(i===1?-1:1,0);Q.b.x=900;Q.b.y=100;Q.b.setDir(0,1);Q.step(2);const before=Q.a.x,r=Q.cast('A1'),left=Q.ct.skills.A1.rechargeLeft,n=Q.ct.skills.A1.charges;const fail=Q.cast('A1');unchanged&&=!fail.ok&&Q.ct.skills.A1.charges===n&&Q.ct.skills.A1.rechargeLeft===left;Q.step(48);axes.push({dir:i===1?-1:1,dx:Q.a.x-before});charge.push(Q.ct.skills.A1.charges);}
 const three=Q.snap();check('A1-three-charges-no-extra-lock',charge.join(',')==='3,2,1,0'&&three.traps.length===3&&unchanged,{charge,three});
 check('A1-opposite-physical-recoil',axes[0].dx<0&&axes[1].dx>0,axes);
 check('V10-independent-state-shared-materials',world().snares.every((s,i,a)=>a.every((t,j)=>i===j||s.visual._rt!==t.visual._rt))&&APEX_HUNTER_PRESENTATION.cacheStats.derivations===7,APEX_HUNTER_PRESENTATION.cacheStats);
 const next=Q.ct.skills.A1.rechargeLeft;Q.step(Math.ceil((next+.02)*60));const one=Q.ct.skills.A1.charges;Q.step(390);const two=Q.ct.skills.A1.charges;Q.step(390);const full=Q.ct.skills.A1.charges;
 check('A1-sequential-recharge-cleanup',one===1&&two===2&&full===3&&Q.ct.skills.A1.rechargeLeft===0&&world().snares.length===0,{next,one,two,full,traps:world().snares.length});
 Q.setup();Q.cast('A1');Q.step(60);const trap=world().snares[0],phases=[trap.phase];Q.b.x=trap.x;Q.b.y=trap.y-90;Q.b.setDir(0,1);for(let i=0;i<180;i++){Q.step();if(world().snares.includes(trap)&&phases.at(-1)!==trap.phase)phases.push(trap.phase);}
 check('V10-trigger-root-lifecycle',phases.join(',')==='armed,tension,snap,pin,release'&&trap.consumed&&trap.triggeredAt!=null&&world().snares.length===0,{phases,root:trap.rootDuration});
 Q.setup();Q.a.x=200;Q.a.y=500;Q.b.x=800;Q.b.y=500;Q.b.setDir(0,1);const hp=Q.b.hp;Q.cast('A2');Q.step(9);const held=Q.a.x===200;const path=[];let turned=false;
 for(let i=0;i<35;i++){if(i===5){Q.b.setDir(0,-1);turned=true;}const x=Q.a.x,y=Q.a.y;Q.step();path.push({x:Q.a.x,y:Q.a.y,step:Math.hypot(Q.a.x-x,Q.a.y-y)});if(hr.AIL.StatusResolver.has(Q.b,'WEAK'))break;}
 const weak=hr.AIL.StatusResolver.remaining(Q.b,'WEAK'),hit=hr.AIL.bus.ring.filter(e=>e.type==='PounceWeak').at(-1);
 check('A2-prelaunch-live-chase-swept-zero-damage',held&&turned&&weak>2.9&&weak<=3&&Q.b.hp===hp&&hit?.payload.swept&&path.every(p=>p.step<45),{held,path,weak,hpBefore:hp,hpAfter:Q.b.hp,event:hit});
 check('WEAK-law',hr.AIL.STATUS_LAWS.WEAK.duration===3&&hr.AIL.StatusResolver.incomingMult(Q.b)===1.25,hr.AIL.STATUS_LAWS.WEAK);
 let seed=1;while(hr.AIL.makeSeededRng(seed)()>=.24)seed++;
 function incoming(weapon='PISTOL'){const mark=hr.AIL.bus.seq,old=hr.AIL.bus.ring.filter(e=>e.type==='HunterDodge').length;Q.a.x=400;Q.a.y=500;Q.a.setDir(1,0);APEX_ARSENAL.weaponApi.fireBullet({owner:Q.b,x:Q.a.x-100,y:Q.a.y,angle:0,speed:6000,damage:1,weapon});Q.step();return hr.AIL.bus.ring.filter(e=>e.type==='HunterDodge').length-old;}
 hr.setSeed(seed);const dodge=incoming();hr.setSeed(seed);const lock=incoming();Q.step(30);hr.setSeed(seed);const t6=incoming('STORMBREAKER');hr.setSeed(1);const rejected=incoming();
 check('passive-valid-proc-lockout-T6',dodge===1&&lock===0&&t6===0&&rejected===0&&Q.ct.skills.PASSIVE.cfg.dodgeChance===.24,{seed,dodge,lock,t6,rejected,config:Q.ct.skills.PASSIVE.cfg});
 Q.setup();hr.setSeed(seed);const invalid=incoming();check('passive-no-prey-no-proc',invalid===0,{invalid});
 Q.setup();Q.a.x=150;Q.a.y=150;Q.b.x=850;Q.b.y=850;Q.cast('A2');Q.step(11);for(let i=0;i<35;i++){Q.b.x=Q.a.x<500?900:100;Q.b.y=Q.a.y<500?900:100;Q.step();}const missed=!hr.AIL.StatusResolver.has(Q.b,'WEAK')&&!Q.ct.store['hunter.pounce_weak'].pounce;
 check('A2-exceptional-escape-no-fake-catch',missed&&APEX_HUNTER_PRESENTATION.inspect(Q.a).phase!=='CATCH',{pose:APEX_HUNTER_PRESENTATION.inspect(Q.a),weak:hr.AIL.StatusResolver.remaining(Q.b,'WEAK')});
 Q.setup();check('match-reset',Q.ct.skills.A1.charges===3&&world().snares.length===0,{charges:Q.ct.skills.A1.charges,traps:world().snares.length});
 return results;
});
console.log(JSON.stringify(results,null,2));
fs.writeFileSync(`${OUT}/hunter-gates.json`,JSON.stringify({results,errors,browser:await browser.version()},null,2));
if(Object.values(results).some(r=>!r.pass)||errors.length)throw Error('Hunter gate failure');
await page.evaluate(()=>{Q.setup();Q.cast('A1');Q.step(60);});await page.screenshot({path:`${OUT}/armed.png`});
}finally{await browser.close();}
