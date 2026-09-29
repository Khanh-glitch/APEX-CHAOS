import fs from'node:fs';import path from'node:path';import{createRequire}from'node:module';import puppeteer from'puppeteer-core';import chromium,{inflate}from'@sparticuz/chromium';
const require=createRequire(import.meta.url);await inflate(path.join(path.dirname(path.dirname(require.resolve('@sparticuz/chromium'))),'bin/al2023.tar.br'));process.env.LD_LIBRARY_PATH='/tmp/al2023/lib:'+(process.env.LD_LIBRARY_PATH||'');
const OUT='docs/hero-rework/hunter-v1.1/evidence';const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});const errors=[];
try{const page=await browser.newPage();await page.setViewport({width:1440,height:1000});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')console.log('BROWSER',m.text());});await page.goto('http://127.0.0.1:4173',{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>window.APEX_HUNTER_PRESENTATION?.ready,{timeout:60000});await page.evaluate(()=>window.APEX_ARSENAL_AV&&window.APEX_ARSENAL_AV.warmAudio());
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
 Q.setup();Q.cast('A1');Q.step(60);const trap=world().snares[0],phases=[trap.phase];let weakAtTrigger=0;Q.b.x=trap.x;Q.b.y=trap.y-90;Q.b.setDir(0,1);for(let i=0;i<180;i++){Q.step();if(world().snares.includes(trap)&&phases.at(-1)!==trap.phase){phases.push(trap.phase);if(trap.phase==='tension')weakAtTrigger=hr.match.api.weakRemaining(hr.byCombatant(Q.b));}}
 check('V10-trigger-root-lifecycle',phases.join(',')==='armed,tension,snap,pin,release'&&trap.consumed&&trap.triggeredAt!=null&&world().snares.length===0,{phases,root:trap.rootDuration});
 check('A1-trigger-applies-root+weak',trap.rootDuration===1.25&&weakAtTrigger>0.9&&weakAtTrigger<=1,{weakAtTrigger,root:trap.rootDuration});
 Q.setup();Q.a.x=200;Q.a.y=500;Q.b.x=800;Q.b.y=500;Q.b.setDir(0,1);const hp=Q.b.hp;Q.cast('A2');Q.step(9);const held=Q.a.x===200;const path=[];let turned=false;
 for(let i=0;i<35;i++){if(i===5){Q.b.setDir(0,-1);turned=true;}const x=Q.a.x,y=Q.a.y;Q.step();path.push({x:Q.a.x,y:Q.a.y,step:Math.hypot(Q.a.x-x,Q.a.y-y)});if(hr.AIL.StatusResolver.has(Q.b,'WEAK'))break;}
 const stun=hr.AIL.StatusResolver.remaining(Q.b,'STUN'),weakCt=hr.match.api.weakRemaining(hr.byCombatant(Q.b)),hit=hr.AIL.bus.ring.filter(e=>e.type==='PounceWeak').at(-1);
 check('A2-prelaunch-live-chase-swept-zero-damage',held&&turned&&stun>1.9&&stun<=2&&weakCt>0.9&&weakCt<=1&&Q.b.hp===hp&&hit?.payload.swept&&path.every(p=>p.step<45),{held,path,stun,weakCt,hpBefore:hp,hpAfter:Q.b.hp,event:hit});
 check('WEAK-law',hr.AIL.STATUS_LAWS.WEAK.duration===1.0&&hr.AIL.STATUS_LAWS.WEAK.mirrorOnly===true&&!hr.AIL.StatusResolver.incomingMult,hr.AIL.STATUS_LAWS.WEAK);
 Q.setup();Q.a.x=400;Q.a.y=500;Q.b.x=600;Q.b.y=500;
 const en=hr.byCombatant(Q.b);
 const dealt=(victim,src,amt)=>{const h0=victim.hp;victim.takeDamage(amt,src,'arsenal-PISTOL');return h0-victim.hp;};
 const base=dealt(Q.b,Q.a,100);
 const neutralBefore=dealt(Q.b,null,100);
 hr.match.api.applyWeakCombatant(en,1.0);
 const weakIn=dealt(Q.b,Q.a,100);
 const neutralDuring=dealt(Q.b,null,100);
 hr.match.api.applyWeakCombatant(en,1.0);
 const refreshed=dealt(Q.b,Q.a,100);
 check('weak-hunter-x125-refresh-not-stack',Math.abs(weakIn/base-1.25)<1e-6&&Math.abs(refreshed/base-1.25)<1e-6,{base,weakIn,refreshed});
 check('weak-neutral-not-amplified',Math.abs(neutralDuring-neutralBefore)<1e-6&&Math.abs(neutralDuring-100)<1e-6,{neutralBefore,neutralDuring});
 Q.step(90); // > 1.0s: weak fully expired
 const baseOut=dealt(Q.a,Q.b,100);
 hr.match.api.applyWeakCombatant(en,1.0);
 const weakOut=dealt(Q.a,Q.b,100);
 check('weak-outgoing-x075-once',Math.abs(weakOut/baseOut-0.75)<1e-6,{baseOut,weakOut});
 Q.step(90);
 Q.setup();Q.cast('A1');Q.step(60);const tr=world().snares[0];Q.b.x=tr.x;Q.b.y=tr.y-90;Q.b.setDir(0,1);Q.step(30);
 const hx=Q.a.x;APEX_ARSENAL.weaponApi.fireBullet({owner:Q.b,x:Q.a.x-100,y:Q.a.y,angle:0,speed:6000,damage:1,weapon:'PISTOL'});Q.step();
 check('no-old-passive-dodge',Math.abs(Q.a.x-hx)<50&&hr.AIL.bus.ring.filter(e=>e.type==='HunterDodge').length===0,{x:Q.a.x,hx,delta:Q.a.x-hx});
 Q.setup();
 if(APEX_ARSENAL.state?.active)exitArsenalQuestMode();startArsenalQuestMode('HUNTER','SLIME');const ss=APEX_ARSENAL.state;ss.slots=[];ss.spawnHeld=true;ss.spawnTimer=1e6;ss.unarmedFastConsumed=true;
 const sa=fighters[0],sb=fighters[1];sa.x=300;sa.y=500;sb.x=700;sb.y=500;Q.a=sa;Q.b=sb;Q.ct=hr.byCombatant(sa);Q.ctl=hr.abilityController(Q.ct);
 for(let i=0;i<5;i++)APEX_ARSENAL.step(1/60);
 hr.match.api.applyWeakCombatant(hr.byCombatant(sb),1.0);
 const sCtl=hr.abilityController(hr.byCombatant(sb));const splitCast=sCtl.tryCast('A1','gates');
 for(let i=0;i<10;i++)APEX_ARSENAL.step(1/60);
 const slimeCt=hr.byCombatant(sb),child=slimeCt.bodies.find(x=>x&&x!==sb&&x.hp>0);
 const childWeak=child?hr.AIL.StatusResolver.remaining(child,'WEAK'):0;
 const ctWeak=hr.match.api.weakRemaining(slimeCt);
 const childBase=child?dealt(child,sa,50):0;
 for(let i=0;i<90;i++)APEX_ARSENAL.step(1/60); // weak expires on the child too
 const childAfter=child&&child.hp>0?dealt(child,sa,50):0;
 check('weak-slime-combatant-inheritance',!!splitCast&&!!child&&childWeak>0&&childWeak<=ctWeak&&childAfter>0&&Math.abs(childBase/childAfter-1.25)<1e-6,{splitCast:!!splitCast,childWeak,ctWeak,childBase,childAfter});
 Q.setup();
 Q.setup();Q.a.x=150;Q.a.y=150;Q.b.x=850;Q.b.y=850;Q.cast('A2');Q.step(11);for(let i=0;i<35;i++){Q.b.x=Q.a.x<500?900:100;Q.b.y=Q.a.y<500?900:100;Q.step();}const missed=!hr.AIL.StatusResolver.has(Q.b,'WEAK')&&!Q.ct.store['hunter.pounce_weak'].pounce;
 check('A2-exceptional-escape-no-fake-catch',missed&&APEX_HUNTER_PRESENTATION.inspect(Q.a).phase!=='CATCH',{pose:APEX_HUNTER_PRESENTATION.inspect(Q.a),weak:hr.AIL.StatusResolver.remaining(Q.b,'WEAK')});
 Q.setup();check('match-reset',Q.ct.skills.A1.charges===3&&world().snares.length===0,{charges:Q.ct.skills.A1.charges,traps:world().snares.length});
 // ---- CHECKPOINT C gates ----
 check('C-trap-40pct-anchor',Math.abs(APEX_HUNTER_GOLD.rtScale()/.43-0.4)<1e-9&&APEX_HUNTER_PRESENTATION.trapWorldRadius>=24&&APEX_HUNTER_PRESENTATION.trapWorldRadius<=110,{rt:APEX_HUNTER_GOLD.rtScale(),r:APEX_HUNTER_PRESENTATION.trapWorldRadius,measure:APEX_HUNTER_PRESENTATION.trapMeasure});
 Q.setup();Q.a.x=500;Q.a.y=500;Q.a.setDir(1,0);Q.cast('A1');Q.step(48);const trC=world().snares[0];const R=APEX_HUNTER_PRESENTATION.trapWorldRadius;
 Q.b.x=trC.x;Q.b.y=trC.y-R-Q.b.radius*.4-14;Q.b.setDir(0,1);let outTriggered=false;for(let i=0;i<90;i++){Q.b.x=trC.x;Q.b.y=trC.y-R-Q.b.radius*.4-14;Q.step();if(trC.triggeredAt!=null)outTriggered=true;}
 Q.b.x=trC.x;Q.b.y=trC.y-R*.5;Q.b.setDir(0,1);let inTriggered=false;for(let i=0;i<90;i++){Q.b.x=trC.x;Q.b.y=trC.y-R*.5;Q.step();if(trC.triggeredAt!=null)inTriggered=true;}
 check('C-footprint-trigger-match',!outTriggered&&inTriggered,{R,outTriggered,inTriggered,trapR:trC.radius});
 Q.setup();Q.cast('A1');Q.step(72);const trA=world().snares[0];const rtA=trA.visual&&trA.visual._rt;
 check('C-armed-energy-silent',rtA&&rtA.edge===0&&rtA.slotTarget===0&&rtA.sweepT<0,{edge:rtA&&rtA.edge,slot:rtA&&rtA.slotTarget,sweep:rtA&&rtA.sweepT});
 const B=APEX_HUNTER_PRESENTATION.recoilBudget();
 function recoilCast(px,py,dx,dy){Q.setup();Q.a.x=px;Q.a.y=py;Q.a.setDir(dx,dy);const ox=Q.a.x,oy=Q.a.y;Q.cast('A1');let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;for(let i=0;i<120;i++){Q.step();mnx=Math.min(mnx,Q.a.x);mxx=Math.max(mxx,Q.a.x);mny=Math.min(mny,Q.a.y);mxy=Math.max(mxy,Q.a.y);const mm=APEX_HUNTER_PRESENTATION.inspect(Q.a).mode;if(mm==='idle'&&i>20)break;}return{ox,oy,mnx,mxx,mny,mxy,x:Q.a.x,y:Q.a.y};}
 const r1=recoilCast(500,500,1,0),r2=recoilCast(850,500,-1,0),r3=recoilCast(500,500,0,1),r4=recoilCast(500,500,0.7071,0.7071);
 const d1=r1.ox-r1.mnx,d2=r2.mxx-r2.ox,d3=r3.oy-r3.mny,d4=Math.hypot(r4.ox-r4.mnx,r4.oy-r4.mny);
 check('C-recoil-finite-all-directions',d1>0.4*B&&d1<=B*1.05&&d2>0&&d2<=B*1.05&&r2.x<=960&&d3>0.4*B&&d3<=B*1.05&&d4>0.3*B&&d4<=B*1.5&&[r1,r2,r3,r4].every(r=>r.x>=40&&r.x<=960&&r.y>=40&&r.y<=960),{B,d1,d2,d3,d4});
 Q.setup();Q.a.x=200;Q.a.y=500;Q.b.x=800;Q.b.y=500;Q.b.setDir(0,1);Q.cast('A2');let holdEcho=0,holdAura=0;for(let i=0;i<6;i++){Q.step();const pr=APEX_HUNTER_PRESENTATION.inspect(Q.a);holdEcho=Math.max(holdEcho,pr.echoes);holdAura=Math.max(holdAura,pr.aura);}
 check('C-no-persistent-aura',holdAura===0&&holdEcho===0,{holdAura,holdEcho});
 Q.setup();Q.a.x=200;Q.a.y=500;Q.b.x=800;Q.b.y=500;Q.b.setDir(0,1);Q.cast('A2');Q.step(12);let echoMax=0;for(let i=0;i<20;i++){Q.step();echoMax=Math.max(echoMax,APEX_HUNTER_PRESENTATION.inspect(Q.a).echoes);}
 check('C-echoes-highspeed-only',echoMax>0,{echoMax});
 Q.setup();Q.a.x=200;Q.a.y=500;Q.b.x=800;Q.b.y=500;Q.b.setDir(0,1);Q.cast('A2');let sawWeak=0;for(let i=0;i<40;i++){Q.step();sawWeak=Math.max(sawWeak,APEX_HUNTER_PRESENTATION.inspect(Q.a).weak);}Q.step(90);const weakGone=APEX_HUNTER_PRESENTATION.inspect(Q.a).weak;
 check('C-weak-visual-bound-to-status',sawWeak>0&&weakGone===0,{sawWeak,weakGone});
 Q.setup();const mE=window.APEX_ARSENAL_AV.hunterSfxLog.length;Q.a.x=200;Q.a.y=200;Q.b.x=850;Q.b.y=800;Q.cast('A1');let trS=null;for(let i=0;i<410;i++){Q.a.x=200;Q.a.y=200;Q.b.x=850;Q.b.y=800;Q.step();if(i===48)trS=world().snares[0];} // expiry without trigger, bodies pinned away
 const logExp=window.APEX_ARSENAL_AV.hunterSfxLog.slice(mE).map(e=>e.rel.split('/').pop());
 check('C-sfx-no-clamp-on-expiry',trS.triggeredAt==null&&!logExp.includes('hunter_a1_clamp.mp3')&&logExp.includes('hunter_a1_deploy_mechanism.mp3'),{logExp});
 Q.setup();const m0=window.APEX_ARSENAL_AV.hunterSfxLog.length;Q.a.x=150;Q.a.y=150;Q.b.x=850;Q.b.y=850;Q.cast('A2');Q.step(11);for(let i=0;i<35;i++){Q.b.x=Q.a.x<500?900:100;Q.b.y=Q.a.y<500?900:100;Q.step();}
 const logMiss=window.APEX_ARSENAL_AV.hunterSfxLog.slice(m0).map(e=>e.rel.split('/').pop());
 check('C-sfx-no-catch-on-miss',!logMiss.includes('hunter_a2_catch_flesh.mp3')&&logMiss.includes('hunter_a2_pounce_sweep.mp3'),{logMiss});
 Q.setup();const m1=window.APEX_ARSENAL_AV.hunterSfxLog.length;Q.a.x=400;Q.a.y=500;Q.cast('A1');
 for(let i=0;i<72;i++){Q.b.x=900;Q.b.y=900;Q.step();} // hold prey away until ARMED so the unfold cue is legal
 const trF=world().snares[0];Q.b.x=trF.x;Q.b.y=trF.y-40;Q.b.setDir(0,1);for(let i=0;i<120;i++){Q.b.x=trF.x;Q.b.y=trF.y-40;Q.step();if(trF.triggeredAt!=null)break;}
 Q.step(18);Q.b.x=trF.x;Q.b.y=trF.y-60;Q.b.setDir(0,1);Q.cast('A2');Q.step(60);
 const logHit=window.APEX_ARSENAL_AV.hunterSfxLog.slice(m1).map(e=>e.rel.split('/').pop());
 check('C-sfx-semantic-chain',logHit.includes('hunter_a1_charge_personal.mp3')&&logHit.includes('hunter_a1_deploy_mechanism.mp3')&&logHit.includes('hunter_a1_unfold_blade.mp3')&&logHit.includes('hunter_a1_clamp.mp3')&&logHit.includes('hunter_a2_pounce_sweep.mp3')&&logHit.includes('hunter_a2_catch_flesh.mp3'),{logHit});
 return results;
});
console.log(JSON.stringify(results,null,2));
fs.writeFileSync(`${OUT}/hunter-gates.json`,JSON.stringify({results,errors,browser:await browser.version()},null,2));
if(Object.values(results).some(r=>!r.pass)||errors.length)throw Error('Hunter gate failure');
await page.evaluate(()=>{Q.setup();Q.cast('A1');Q.step(60);});await page.screenshot({path:`${OUT}/armed.png`});
}finally{await browser.close();}
