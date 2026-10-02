#!/usr/bin/env node
// MAGNET V1 — deterministic Slice-A gameplay gates.
// Authority: docs/hero-rework/magnet-v1/00_MAGNET_IMPLEMENTATION_AUTHORITY.md
import { bootHarness } from './lib/crystalaHarness.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';

const H = await bootHarness();
const { win, T } = H;
const report = { gates: {}, failures: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}
function close(a, b, eps = 1e-6) { return Math.abs(a - b) <= eps; }
function sha(data) { return crypto.createHash('sha256').update(data).digest('hex'); }

const HR = win.APEX_HERO_REWORK;
const MAG = win.APEX_MAGNET;
const REG = win.APEX_HERO_REWORK_REGISTRY;
const W = win.APEX_ARSENAL.weaponApi;
HR.setAiEnabled(false);
win.APEX_ARSENAL.combatRng = () => 0.5;

const fatal = (H.loadErrors || []).filter((e) => /magnet|hero-rework|arsenal|apexEngine/.test(String(e.file)));
gate('M00.1-runtime-load', !!MAG && fatal.length === 0, fatal.length ? fatal : MAG && MAG.version);
try {
  const a1 = REG.HEROES.MAGNET.skills.A1.baseConfig;
  const a2 = REG.HEROES.MAGNET.skills.A2.baseConfig;
  const p = REG.HEROES.MAGNET.skills.PASSIVE.baseConfig;
  gate('M00.2-locked-registry',
    a1.cooldown === 11 && a1.gameplayDuration === 1 && a1.gunAccelerationMin === 1400
    && a1.gunAccelerationMax === 2400 && a1.gunSpeedCap === 900
    && a1.bulletRadius === 480 && a1.bulletAcceleration === 14000
    && a2.cooldown === 13 && a2.duration === 1.8 && a2.radius === 225
    && a2.bodyAcceleration === 2200 && a2.bodyRadialSpeedCap === 650
    && a2.gunAcceleration === 3000 && a2.gunSpeedCap === 950
    && a2.bulletAcceleration === 18000 && p.ownedProjectileVelocityBonus === 0.18,
    { a1, a2, passive: p });
} catch (e) { gate('M00.2-locked-registry', false, String(e)); }

try {
  const base = '5411906a741f87d637ee20535c82e96b866d4ab2';
  const files = ['public/game/hero-rework/heroMechanicsRuntime.js', 'public/game/hero-rework/heroRegistry.js'];
  const mirrorSlices = files.map((file) => {
    const slice = (text) => {
      const start = text.indexOf('* 10. MIRROR');
      const end = text.indexOf('* 11. SLIME', start);
      return start >= 0 && end > start ? text.slice(start, end) : '';
    };
    const current = slice(fs.readFileSync(file, 'utf8'));
    const oldText = execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' });
    const old = slice(oldText);
    return { file, current: sha(current), baseline: sha(old), nonempty: !!current && !!old };
  });
  gate('M00.3-mirror-gameplay-byte-frozen', mirrorSlices.every((x) => x.nonempty && x.current === x.baseline), mirrorSlices);
} catch (e) { gate('M00.3-mirror-gameplay-byte-frozen', false, String(e)); }

function start(p2 = 'MIRROR') {
  T.start('MAGNET', p2); T.holdSpawns();
  const [a, b] = H.fighters();
  a.baseSpeed = 0; b.baseSpeed = 0;
  a.x = 150; a.y = 500; b.x = 850; b.y = 500;
  a.setDir(1, 0); b.setDir(-1, 0);
  return { a, b, ct: HR.byCombatant(a), ctl: HR.abilityController(HR.byCombatant(a)) };
}

try {
  const o = start();
  const res = HR.pressAbility(o.a, 'A1');
  const state0 = MAG.inspect(win.matchClock);
  T.step(0.99);
  const active99 = MAG.inspect(win.matchClock).fields[0].a1Active;
  T.step(0.02);
  const active101 = MAG.inspect(win.matchClock).fields[0].a1Active;
  gate('M01.1-a1-immediate-exact-window', res.ok && state0.fields[0].a1Active && active99 && !active101,
    { result: res, cooldown: o.ctl.cooldownLeft('A1') });
} catch (e) { gate('M01.1-a1-immediate-exact-window', false, String(e)); }

try {
  const o = start();
  const a1 = HR.pressAbility(o.a, 'A1');
  const a2During = HR.pressAbility(o.a, 'A2');
  T.step(1.01);
  const a2After = HR.pressAbility(o.a, 'A2');
  gate('M01.2-mutual-exclusion-force-window-only', a1.ok && !a2During.ok && a2After.ok,
    { a1, a2During, a2After });
} catch (e) { gate('M01.2-mutual-exclusion-force-window-only', false, String(e)); }

try {
  const o = start();
  HR.pressAbility(o.a, 'A1');
  const id = T.pushSlot({ x: 500, y: 500, phase: 'REVEALED', kind: 'WEAPON', weaponId: 'PISTOL' });
  const slot = win.APEX_ARSENAL.state.slots.find((s) => s.id === id);
  const x0 = slot.x;
  T.step(1 / 60);
  const snap = MAG.inspect(win.matchClock).floorFirearms.find((x) => x.slot === slot);
  gate('M02.1-all-and-late-revealed-floor-firearms', slot.x < x0 && !!snap && snap.integrations === 1,
    { dx: slot.x - x0, integrations: snap && snap.integrations });
} catch (e) { gate('M02.1-all-and-late-revealed-floor-firearms', false, String(e)); }

try {
  const o = start();
  HR.pressAbility(o.a, 'A1');
  const id = T.pushSlot({ x: o.a.x, y: o.a.y, phase: 'REVEALED', kind: 'WEAPON', weaponId: 'PISTOL' });
  T.step(1 / 60);
  const slot = win.APEX_ARSENAL.state.slots.find((s) => s.id === id);
  const holder = W.getHolder(o.a);
  gate('M02.2-canonical-unarmed-pickup-priority', (!slot || slot.phase === 'REMOVED') && holder && holder.weaponId === 'PISTOL',
    { phase: slot && slot.phase, weapon: holder && holder.weaponId });
} catch (e) { gate('M02.2-canonical-unarmed-pickup-priority', false, String(e)); }

try {
  const o = start();
  o.a.x = 0;
  HR.pressAbility(o.a, 'A1');
  const id = T.pushSlot({ x: 18, y: 500, phase: 'REVEALED', kind: 'WEAPON', weaponId: 'PISTOL' });
  const slot = win.APEX_ARSENAL.state.slots.find((s) => s.id === id);
  MAG.stepWorld(0.1, { now: win.matchClock, slots: [slot], bodies: [], gameSize: 1000 });
  const snap = MAG.inspect(win.matchClock).floorFirearms.find((x) => x.slot === slot);
  gate('M02.3-radius16-wall-restitution', slot.x === 16 && snap.vx > 0,
    { x: slot.x, vx: snap.vx });
} catch (e) { gate('M02.3-radius16-wall-restitution', false, String(e)); }

try {
  const o = start();
  HR.pressAbility(o.a, 'A1');
  const p = { aq: true, type: 'aq_bullet', weapon: 'PISTOL', life: 2, owner: o.b,
    x: 390, y: 500, vx: 0, vy: 1000, damage: 40, critical: true,
    __hr: { provenance: 'mirror-copy', payload: { chill: true } } };
  const semantic = JSON.stringify({ owner: p.owner.id, damage: p.damage, critical: p.critical, hr: p.__hr });
  MAG.stepProjectiles(1 / 60, [p], HR.byCombatant, win.matchClock);
  const after = JSON.stringify({ owner: p.owner.id, damage: p.damage, critical: p.critical, hr: p.__hr });
  gate('M03.1-a1-hostile-bullet-force-semantics', p.vx < 0 && Math.hypot(p.vx, p.vy) <= 1100 + 1e-6 && semantic === after,
    { vx: p.vx, speed: Math.hypot(p.vx, p.vy), semanticStable: semantic === after });
  const own = { ...p, owner: o.a, x: 390, vx: 0, vy: 1000, __hr: {} };
  MAG.stepProjectiles(1 / 60, [own], HR.byCombatant, win.matchClock);
  gate('M03.2-own-bullet-unaffected', own.vx === 0 && own.vy === 1000, { vx: own.vx, vy: own.vy });
} catch (e) { gate('M03.1-a1-hostile-bullet-force-semantics', false, String(e)); }

try {
  const o = start();
  HR.pressAbility(o.a, 'A1');
  const held = { aq: true, type: 'aq_bullet', weapon: 'PISTOL', life: 2, owner: o.b,
    x: 300, y: 500, vx: 0, vy: 800, __hr: { cryHold: { shardId: 1 } } };
  const t6 = { aq: true, type: 'aq_bullet', weapon: 'STORMBREAKER', life: 2, owner: o.b,
    x: 300, y: 500, vx: 0, vy: 800, __hr: {} };
  MAG.stepProjectiles(1 / 60, [held, t6], HR.byCombatant, win.matchClock);
  gate('M03.3-crystal-held-and-t6-immune', held.vx === 0 && held.vy === 800 && t6.vx === 0 && t6.vy === 800,
    { held: [held.vx, held.vy], t6: [t6.vx, t6.vy] });
} catch (e) { gate('M03.3-crystal-held-and-t6-immune', false, String(e)); }

try {
  const o = start();
  const spec = { owner: o.a, x: 150, y: 500, angle: 0, speed: 1000, damage: 10, weapon: 'PISTOL' };
  const tag = HR.onFireBullet(spec);
  const t6 = { owner: o.a, x: 150, y: 500, angle: 0, speed: 1000, damage: 10, weapon: 'STORMBREAKER' };
  HR.onFireBullet(t6);
  gate('M04.1-passive-live-spec-exact-once', close(spec.speed, 1180) && tag.magnetBoosted === true && t6.speed === 1000,
    { firearm: spec.speed, t6: t6.speed, tag });
} catch (e) { gate('M04.1-passive-live-spec-exact-once', false, String(e)); }

try {
  const o = start();
  const res = HR.pressAbility(o.a, 'A2');
  o.b.x = o.a.x + 100; o.b.y = o.a.y;
  const x0 = o.b.x;
  T.step(0.1, 0.1);
  const st = MAG.inspect(win.matchClock).bodies.find((x) => x.body === o.b);
  const active179 = (() => { T.step(1.69); return MAG.inspect(win.matchClock).fields[0].a2Active; })();
  T.step(0.02);
  const active181 = MAG.inspect(win.matchClock).fields[0].a2Active;
  // H-PHYS2 §28 SUPERSEDED ASSERTION: the bound was `st.vx <= 650`
  // (bodyRadialSpeedCap) under the old linear radial-SPEED-target body law.
  // H-PHYS2 §1/§6 replace that law with one continuous nonlinear field, and
  // §14 requires a 2200 px/s inbound pounce to be turned before the 150px
  // body envelope. A 650 px/s outward bound is mathematically incapable of
  // that (650 against 2200 inbound leaves 1550 px/s of net closing speed), so
  // the cap is now the single owner rating. Every other assertion in this
  // gate -- cast ok, outward displacement, positive outward velocity and the
  // 1.80s A2 window -- is unchanged.
  gate('M05.1-a2-continuous-field-body-force-and-window', res.ok && o.b.x > x0 && st.vx > 0 && st.vx <= 3500 && active179 && !active181,
    { dx: o.b.x - x0, vx: st && st.vx, active179, active181 });
} catch (e) { gate('M05.1-a2-continuous-field-body-force-and-window', false, String(e)); }

try {
  T.start('MAGNET', 'MAGNET'); T.holdSpawns();
  const [a, b] = H.fighters();
  a.baseSpeed = 0; b.baseSpeed = 0;
  a.x = 200; a.y = 500; b.x = 800; b.y = 500;
  HR.pressAbility(a, 'A1'); HR.pressAbility(b, 'A1');
  const id = T.pushSlot({ x: 400, y: 500, phase: 'REVEALED', kind: 'WEAPON', weaponId: 'PISTOL' });
  T.step(1 / 60);
  const slot = win.APEX_ARSENAL.state.slots.find((s) => s.id === id);
  const st = MAG.inspect(win.matchClock).floorFirearms.find((x) => x.slot === slot);
  gate('M06.1-magnet-forces-sum-before-one-integration', !!st && st.integrations === 1 && st.vx > 0,
    { integrations: st && st.integrations, vx: st && st.vx });
} catch (e) { gate('M06.1-magnet-forces-sum-before-one-integration', false, String(e)); }

try {
  const o = start();
  HR.pressAbility(o.a, 'A1');
  const slots = [
    { id: 101, x: 250, y: 500, phase: 'REVEALED', kind: 'WEAPON', weaponId: 'PISTOL' },
    { id: 102, x: 650, y: 500, phase: 'REVEALED', kind: 'WEAPON', weaponId: 'PISTOL' },
    { id: 103, x: 1000, y: 500, phase: 'REVEALED', kind: 'WEAPON', weaponId: 'PISTOL' },
    { id: 104, x: 500, y: 600, phase: 'REVEALED', kind: 'WEAPON', weaponId: 'STORMBREAKER' },
  ];
  MAG.stepWorld(.01, { now: win.matchClock, slots, bodies: [], gameSize: 2000 });
  let snap = MAG.inspect(win.matchClock), states = snap.floorFirearms;
  const speed = (slot) => { const q=states.find((x)=>x.slot===slot);return q&&Math.hypot(q.vx,q.vy); };
  const near=speed(slots[0]),mid=speed(slots[1]),far=speed(slots[2]);
  const farState=states.find((x)=>x.slot===slots[2]),before=farState.vx;
  MAG.stepWorld(.2, { now: win.matchClock+2, slots, bodies: [], gameSize: 2000 });
  snap=MAG.inspect(win.matchClock+2);const after=snap.floorFirearms.find((x)=>x.slot===slots[2]).vx;
  gate('M02.4-all-no-radius-distance-law-t6',states.length===3&&near<mid&&mid<far&&close(near,15.4285714286,1e-6)&&close(far,24,1e-6)&&!states.some((x)=>x.slot===slots[3]),{near,mid,far,count:states.length});
  gate('M02.5-post-field-coast-drag',close(after,before*Math.exp(-1.8*.2),1e-6),{before,after});
} catch (e) { gate('M02.4-all-no-radius-distance-law-t6', false, String(e)); }

try {
  const o=start();HR.pressAbility(o.a,'A1');
  const make=(d)=>({aq:true,type:'aq_bullet',weapon:'PISTOL',life:2,owner:o.b,x:o.a.x+d,y:o.a.y,vx:0,vy:1000,damage:20,__hr:{chill:true}});
  const p479=make(479),p481=make(481),p240=make(240);
  MAG.stepProjectiles(.01,[p479,p481,p240],HR.byCombatant,win.matchClock);
  gate('M03.4-a1-radius-and-quadratic-law',p479.vx<0&&p481.vx===0&&close(p240.vx,-35,1e-9),{v479:p479.vx,v481:p481.vx,v240:p240.vx});
  const capBullet=make(1);
  MAG.stepProjectiles(.1,[capBullet],HR.byCombatant,win.matchClock);
  gate('M03.5-launch-speed-cap-1p10',close(Math.hypot(capBullet.vx,capBullet.vy),1100,1e-6),{speed:Math.hypot(capBullet.vx,capBullet.vy)});
} catch(e){gate('M03.4-a1-radius-and-quadratic-law',false,String(e));}

try {
  const o=start();HR.pressAbility(o.a,'A2');o.b.x=o.a.x+100;o.b.y=o.a.y;
  const gun={id:201,x:o.a.x+100,y:o.a.y+80,phase:'REVEALED',kind:'WEAPON',weaponId:'PISTOL',frostToken:'keep'};
  const t6={id:202,x:o.a.x+80,y:o.a.y,phase:'REVEALED',kind:'WEAPON',weaponId:'STORMBREAKER'};
  MAG.stepWorld(.1,{now:win.matchClock,slots:[gun,t6],bodies:[o.b],combatantOfBody:HR.byCombatant,gameSize:1000,pickupEligible:()=>false});
  const bullet={aq:true,type:'aq_bullet',weapon:'PISTOL',life:2,owner:o.b,x:o.a.x+100,y:o.a.y,vx:0,vy:1000,damage:33,__hr:{rubberDebt:44}};
  MAG.stepProjectiles(.1,[bullet],HR.byCombatant,win.matchClock);
  const snap=MAG.inspect(win.matchClock),gs=snap.floorFirearms.find((x)=>x.slot===gun),bs=snap.bodies.find((x)=>x.body===o.b);
  // H-PHYS2 §28 SUPERSEDED ASSERTION: `bs.vx<=650` -> `<=3500`, same reason as
  // M05.1 (legacy bodyRadialSpeedCap vs the one owner rating). The floor-gun
  // bound (<=950), the bullet speed cap, damage, rubberDebt preservation and
  // T6 exclusion are all unchanged.
  gate('M06.2-a2-body-gun-bullet-law',gs.vx>0&&gs.vy>0&&Math.hypot(gs.vx,gs.vy)<=950&&bs.vx>0&&bs.vx<=3500&&bullet.vx>0&&Math.hypot(bullet.vx,bullet.vy)<=1100+1e-6&&bullet.damage===33&&bullet.__hr.rubberDebt===44&&!snap.floorFirearms.some((x)=>x.slot===t6),{gun:[gs.vx,gs.vy],body:bs.vx,bullet:[bullet.vx,bullet.vy]});
} catch(e){gate('M06.2-a2-body-gun-bullet-law',false,String(e));}

try {
  const o=start();HR.pressAbility(o.a,'A1');o.a.x=0;
  const armed={id:333,x:200,y:500,hp:100,radius:50,armed:true},gun={id:301,x:250,y:500,phase:'REVEALED',kind:'WEAPON',weaponId:'PISTOL'};
  MAG.stepWorld(.1,{now:win.matchClock,slots:[gun],bodies:[armed],combatantOfBody:()=>({idx:9}),pickupEligible:()=>false,gameSize:1000});
  const first=MAG.inspect(win.matchClock).floorFirearms[0],hp=armed.hp;
  MAG.stepWorld(.01,{now:win.matchClock,slots:[gun],bodies:[armed],combatantOfBody:()=>({idx:9}),pickupEligible:()=>false,gameSize:1000});
  const second=MAG.inspect(win.matchClock).floorFirearms[0];
  gate('M05.1-armed-contact-enter-deflection-only',first.vx>0&&armed.hp===hp&&second.integrations===2&&Number.isFinite(second.vx),{firstV:first.vx,secondV:second.vx,hp:armed.hp});
} catch(e){gate('M05.1-armed-contact-enter-deflection-only',false,String(e));}

try {
  T.start('MAGNET','MAGNET');T.holdSpawns();const [a,b]=H.fighters();a.baseSpeed=b.baseSpeed=0;a.x=200;a.y=500;b.x=800;b.y=500;
  HR.pressAbility(a,'A1');HR.pressAbility(b,'A2');
  const slot={id:401,x:650,y:500,phase:'REVEALED',kind:'WEAPON',weaponId:'PISTOL'};
  MAG.stepWorld(1/60,{now:win.matchClock,slots:[slot],bodies:[],gameSize:1000});
  const st=MAG.inspect(win.matchClock).floorFirearms[0];
  gate('M06.3-a1-plus-a2-compose-once',st.integrations===1&&Number.isFinite(st.vx),{integrations:st.integrations,vx:st.vx});
} catch(e){gate('M06.3-a1-plus-a2-compose-once',false,String(e));}

try {
  const o=start();W.equip(o.a,'PISTOL');const copied=HR.pressAbility(o.b,'A1'),held=W.getHolder(o.b);
  const spec={owner:o.b,x:o.b.x,y:o.b.y,angle:0,speed:1000,damage:10,weapon:'PISTOL'};const tag=HR.onFireBullet(spec);
  gate('M10.1-mirror-copy-fresh-no-passive-inheritance',copied.ok&&held&&held.weaponId==='PISTOL'&&spec.speed===1000&&!(tag&&tag.magnetBoosted),{copied,weapon:held&&held.weaponId,speed:spec.speed,tag});
} catch(e){gate('M10.1-mirror-copy-fresh-no-passive-inheritance',false,String(e));}

try {
  const o=start();HR.pressAbility(o.a,'A1');const old={ax:o.a.x,bx:o.b.x};const swap=HR.pressAbility(o.b,'A2');T.step(.27);
  const slot={id:501,x:o.a.x-150,y:o.a.y,phase:'REVEALED',kind:'WEAPON',weaponId:'PISTOL'},x0=o.a.x-150;
  MAG.stepWorld(.05,{now:win.matchClock,slots:[slot],bodies:[],gameSize:1000});
  gate('M10.2-mirror-swap-relocates-live-field-center',swap.ok&&Math.abs(o.a.x-old.bx)<2&&Math.abs(o.b.x-old.ax)<2&&slot.x>x0,{old,now:{ax:o.a.x,bx:o.b.x},gunDx:slot.x-x0});
} catch(e){gate('M10.2-mirror-swap-relocates-live-field-center',false,String(e));}

try {
  const o=start();HR.pressAbility(o.a,'A2');W.equip(o.b,'STORMBREAKER');o.b.x=o.a.x+100;o.b.y=o.a.y;const x0=o.b.x;
  MAG.stepWorld(.1,{now:win.matchClock,slots:[],bodies:[o.b],combatantOfBody:HR.byCombatant,gameSize:1000});
  gate('M08.1-t6-holder-body-still-pushable',o.b.x>x0,{dx:o.b.x-x0,weapon:W.getHolder(o.b)?.weaponId});
} catch(e){gate('M08.1-t6-holder-body-still-pushable',false,String(e));}

try {
  // Regression for the owner-observed Magnet/Robot tangle: build legitimate
  // A2 body momentum, relocate the field across Robot, then stress exact
  // anchor contact. External motion must enter before canonical collision, so
  // no post-solve sidecar integration can recreate overlap.
  const o=start();o.a.x=500;o.a.y=500;o.b.x=600;o.b.y=500;
  HR.pressAbility(o.a,'A2');
  for(let i=0;i<168;i++){T.step(1/120,1/120);o.a.x=o.b.x-150;o.a.y=o.b.y;}
  o.a.x=700;o.a.y=500;o.b.x=550;o.b.y=500;
  let maxPenetration=0;
  for(let i=0;i<60;i++){T.step(1/120,1/120);maxPenetration=Math.max(maxPenetration,Math.max(0,o.a.radius+o.b.radius-Math.hypot(o.b.x-o.a.x,o.b.y-o.a.y)));}
  gate('M06.4-a2-body-motion-enters-canonical-collision-solve',maxPenetration<1e-6,{maxPenetration});
} catch(e){gate('M06.4-a2-body-motion-enters-canonical-collision-solve',false,String(e));}

try {
  const source = fs.readFileSync('public/game/hero-rework/magnetGameplayRuntime.js', 'utf8');
  gate('M07.1-trajectory-only-source-law',
    !/applyStatus\s*\(|aqDamage\s*\(|\.damage\s*[+*/-]?=(?!=)|\.owner\s*=(?!=)/.test(source),
    'no damage/status/ownership mutation');
  win.exitArsenalQuestMode();
  const inspect = MAG.inspect(win.matchClock);
  gate('M07.2-teardown-clears-runtime', inspect.fields.length === 0 && inspect.floorFirearms.length === 0
    && inspect.bodies.length === 0 && inspect.projectileInfluence.length === 0 && inspect.worldStepCount === 0,
    { fields: inspect.fields.length, guns: inspect.floorFirearms.length, bodies: inspect.bodies.length });
} catch (e) { gate('M07.2-teardown-clears-runtime', false, String(e)); }

const passed = Object.keys(report.gates).length - report.failures.length;
console.log(`\n[MAGNET V1 GAMEPLAY] ${passed}/${Object.keys(report.gates).length} gates passed`);
if (report.failures.length) console.error(`FAILURES: ${report.failures.join(', ')}`);
process.exit(report.failures.length ? 1 : 0);
