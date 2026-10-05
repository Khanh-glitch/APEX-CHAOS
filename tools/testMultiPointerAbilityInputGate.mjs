import fs from 'node:fs';

const hud=fs.readFileSync('public/gold/battle-hud.html','utf8');
const bridge=fs.readFileSync('public/game/gold/goldProductBridge.js','utf8');
const hr=fs.readFileSync('public/game/hero-rework/heroReworkRuntime.js','utf8');
const adapter=fs.readFileSync('tools/goldBattleHudR50c.mjs','utf8');
const failures=[];const passes=[];
function check(name,cond){(cond?passes:failures).push((cond?'PASS ':'FAIL ')+name);}

check('skill touch does not cast on pointerdown', !hud.includes("if(sk){e.preventDefault();const pi=+sk.dataset.p-1;if(S.mode==='1p'&&pi===1)return;APEX_GOLD_HUD.pressSkill"));
check('pointerdown only opens held transaction', hud.includes("activeSkillPointers.set(e.pointerId,rec)") && hud.includes("sk.classList.add('is-held')"));
check('skill casts on release', hud.includes("pointerup',e=>finishSkillPointer(e,true)"));
check('cancel never casts', hud.includes("pointercancel',e=>finishSkillPointer(e,false)"));
check('lost capture cleans without cast', hud.includes("lostpointercapture',e=>{if(activeSkillPointers.has(e.pointerId))finishSkillPointer(e,false)"));
check('pointers are isolated by pointerId', hud.includes('const activeSkillPointers=new Map()') && hud.includes('activeSkillPointers.get(e.pointerId)'));
check('pointer capture keeps hold stable off-card', hud.includes('setPointerCapture(e.pointerId)') && hud.includes('releasePointerCapture(e.pointerId)'));
check('held visual persists only during pointer transaction', hud.includes('.skill.is-held') && hud.includes("rec.sk.classList.remove('is-held')"));
check('HUD forwards pointer metadata', hud.includes("bridge.pressSkill(pi,ai,input)") && hud.includes("pointerId:e.pointerId"));
check('bridge forces ownership from side index', bridge.includes("const side = pi === 1 ? 'p2' : 'p1'") && bridge.includes('meta.side = side'));
check('bridge passes pointer metadata to executor', bridge.includes("heroRework.pressAbility(fighters[pi], ai === 1 ? 'A2' : 'A1', meta)"));
check('executor remains side-aware', hr.includes('normalizeCastInput(ct, source)') && hr.includes('side: input.side'));
check('desktop keyboard laws remain independent', hr.includes("key: 'KeyJ'") && hr.includes("key: 'KeyK'") && hr.includes("key: e.code"));
check('adapter keeps generated HUD deterministic', adapter.includes('multi-pointer release-to-cast state machine') && adapter.includes('activeSkillPointers'));

console.log(['MULTI-POINTER ABILITY INPUT GATE',...passes].join('\n'));
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('RESULT: PASS ('+passes.length+' checks)');
