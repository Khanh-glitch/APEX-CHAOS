// Build-time bridge only. Never load or parse authority HTML during gameplay.
import fs from 'node:fs';import crypto from 'node:crypto';import {parse} from '@babel/parser';
const path='docs/hero-rework/hunter-v1.1/reference/HUNTER_GOLD_V10_EXACT_ROOT_TRAP.html',bytes=fs.readFileSync(path);
if(bytes.length!==3671159||crypto.createHash('sha256').update(bytes).digest('hex')!=='447cf549cceb955459eda4b74ef5a561c77fc2f574252783bc7921663578ae65')throw Error('Gold identity mismatch');
let s=bytes.toString().split('<script>')[1].split('</script>')[0];s=s.slice(0,s.indexOf("const canvas = document.getElementById('stage');"));
const dir='public/assets/hero-rework/hunter-v10';fs.mkdirSync(dir,{recursive:true});let n=0;
s=s.replace(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g,(_,data)=>{const i=n++;const name=`part-${i}.png`;fs.writeFileSync(`${dir}/${name}`,Buffer.from(data,'base64'));return i<5?`/assets/hero-rework/hunter-v10/${name}`:`/assets/hero-rework/hunter-v10/clean/${name}`;}); // body art stays on the immutable originals; only ROOT-trap parts use clean derivatives
const ast=parse(s),cuts=[];
const remove=new Set('init key reset step updateAuto updatePrey stagedDamage updateTrap trapSnap trapContact startProjectile updateProjectile projectileGroundHit startDodge updDodge updateCamera trapRootXf trapArmXf trapArmSkin trapJoint render blob drawArena drawPrey drawTrap drawProjectile drawDistortion grade'.split(' '));
function walk(o){if(!o||typeof o!=='object')return;if(o.type==='ClassDeclaration'&&o.id?.name==='Stage')for(const m of o.body.body)if(remove.has(m.key.name))cuts.push([m.start,m.end]);for(const [k,v] of Object.entries(o))if(!['loc','start','end'].includes(k))if(Array.isArray(v))v.forEach(walk);else walk(v);}walk(ast);for(const[a,b]of cuts.sort((a,b)=>b[0]-a[0]))s=s.slice(0,a)+s.slice(b);
// No demo asset loading, scene setup, camera, prey AI, or fake projectiles.
s=s.replace(/    (trap_\w+|prey): "[^"]+",\n/g,'');
s=s.replace(/const __oldInit=Stage.prototype.init;[\s\S]*?\/\/ ---- SAFE PASSIVE/, '// ---- SAFE PASSIVE');
s=s.replace(/Stage.prototype.startProjectile=function\(\)\{[\s\S]*?Stage.prototype.startDodge=function/, 'Stage.prototype.startDodge=function');
s=s.replace('Math.random()', 'visualRandom()'); // replaced globally below for PIN only
s=s.replaceAll('Math.random()', 'visualRandom()');
// World coordinates are supplied by APEX, not a horizontal staged floor.
const start=s.indexOf('class Stage {'),end=s.indexOf('exports.Stage = Stage;');s=s.slice(0,start)+s.slice(start,end).replaceAll('GROUND','this.ground')+s.slice(end);
s=s.replace('this.cv = cv;', 'this.cv = cv; this.ground = 596;');
// POST-PLAYTEST 2026-09-29: 40% trap footprint anchor; the real visible world
// footprint is measured at runtime by the presentation (trapWorldRadius).
s=s.replace('function rtScale(st){return .43;}', 'function rtScale(st){return .172;}');
s=s.replace(/        const stand = this.tr.on \? 300 : 470;[\s\S]*?springTo\)\(h.y, this.ground - H_FOOT, 0.4, dt\);/, '        // Native APEX locomotion owns position; idle only articulates the rig.');
s=s.replace('(0, core_1.clamp)(h.px - 55, 130, WW - 130)', 'h.px - 55');
s=s.replace('const tx = h.px + 46;', 'const tx = h.px;');
// A1 plant crossing must not be skipped by a production timestep straddling PLANT.
s=s.replace("        h.phase = 'RECOVER';\n        const k = (0, core_1.smoothstep)(PLANT, REC, t);", "        if (!this.tr.on) this.plantTrap();\n        h.phase = 'RECOVER';\n        const k = (0, core_1.smoothstep)(PLANT, REC, t);");
// APEX, not the authored path endpoint, launches and catches.
let a=s.indexOf('        if (!A.dist) {\n            // LAUNCH'),b=s.indexOf('        // ---- travel ----',a);s=s.slice(0,a)+'        if (!A.dist) return;\n'+s.slice(b);
s=s.replace('if (!A.corrected && A.trav / A.total > 0.46)', 'if (false)');
s=s.replace('if (A.trav >= A.total || d < A.speed * dt * 1.2)', 'if (this.contactPending)');
// Cache immutable decode/material work once for the entire module session.
s=s.replace('function rtDeriveLayers(im){','function rtDeriveLayers(im){\n cacheStats.derivations++;');
s=s.replace('function rtLoadImages(){','function rtLoadImages(){\n if(rootPromise)return rootPromise;\n cacheStats.rootLoads++;');
s=s.replace('  return Promise.all(Object.entries(ROOT_TRAP_ART)', '  return rootPromise=Promise.all(Object.entries(ROOT_TRAP_ART)');
s=s.replace('im.onerror=()=>res();','im.onerror=()=>{throw Error("Hunter V10 art failed: "+src);};');
// POST-PLAYTEST 2026-09-29: normal ARMED is mechanical and energy-silent.
s=s.replace("rtSetPose(R,RT_POSE.open);R.coreTarget=1;R.slotTarget=.4;R.edge=.08;R.tension=0;R.sweepAmt=.35;R.sweepDir=1;R.sweepT=0;R.armedT=0;",
 "rtSetPose(R,RT_POSE.open);R.coreTarget=1;R.slotTarget=0;R.edge=0;R.tension=0;R.sweepAmt=0;R.sweepDir=1;R.sweepT=-1;R.armedT=0;");
s=s.replace("R.armedT+=dt;R.slotTarget=.34+.08*Math.sin(R.armedT*2.2);R.edge=.08;R.tension=0;\n    if(R.sweepT>=0){R.sweepT+=dt/.9;if(R.sweepT>1)R.sweepT=-1;}\n    if(R.armedT>1.8&&R.sweepT<0){R.sweepT=0;R.armedT=.96;R.sweepDir=1;R.sweepAmt=.35;}",
 "R.armedT+=dt;R.slotTarget=0;R.edge=0;R.tension=0;R.sweepT=-1;");
// Derivative re-audit: thinner/softer shadow underlay, calmer glow so the
// opaque dark-green fringe no longer reads as amplified halo.
s=s.replace('for(let it=0;it<3;it++){const nd=dil.slice();','for(let it=0;it<1;it++){const nd=dil.slice();');
s=s.replace('hd.data[o+3]=255;','hd.data[o+3]=150;');
s=s.replace('(L-70)/140','(L-95)/140');
// Echoes: high-speed only, denser close, shorter-lived.
s=s.replace('if (sp > 55) {\n            this.pushEcho(0.16);','if (sp > 240) {\n            this.pushEcho(0.11);');
s=s.replace('if (this.echoes.length > 13)','if (this.echoes.length > 16)');
s=s.replace('const age = (0, core_1.clamp01)(e.t / 0.24);','const age = (0, core_1.clamp01)(e.t / 0.14);');
s+=`\nconst rig=__require('hunter/rig'),core=__require('hunter/core');
let bodyPromise,rootPromise,visualSeed=0x7a118;const cacheStats={derivations:0,rootLoads:0,bodyLoads:0};
function visualRandom(){visualSeed=(Math.imul(1664525,visualSeed)+1013904223)>>>0;return visualSeed/4294967296;}
async function load(){if(!bodyPromise){cacheStats.bodyLoads++;bodyPromise=rig.loadArt().then(art=>({art,glow:Object.fromEntries(Object.entries(art).map(([k,v])=>[k,rig.makeGlow(v,'rgba(190,255,110,1)',7)]))}));}const [body,root]=await Promise.all([bodyPromise,rtLoadImages()]);return {...body,root};}
// POST-PLAYTEST 2026-09-29: the persistent aura clone is removed; motion
// truth is the high-speed echo history only.
Stage.prototype.drawAura=function(){};Stage.prototype.updateAura=function(){};
window.APEX_HUNTER_GOLD={Stage,rig,core,load,rtUpdate,rtDraw,rtScale,cacheStats};window.apexHunterGoldV10='ready';\n`;
s=s.replace(/^[ \t]+$/gm,'');
fs.writeFileSync('public/game/hero-rework/hunterGoldV10.js','// Generated from hash-verified V10 by tools/bridgeHunterGoldV10.mjs.\n(function(){\n'+s+'\n})();\n');
// Remove source parts used only by the stripped standalone demo.
for(const i of[5,6,7,8,9])fs.unlinkSync(`${dir}/part-${i}.png`);
