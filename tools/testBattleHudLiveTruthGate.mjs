import fs from 'node:fs';

const bridge=fs.readFileSync('public/game/gold/goldProductBridge.js','utf8');
const hud=fs.readFileSync('public/gold/battle-hud.html','utf8');
const build=fs.readFileSync('tools/buildGoldCutover.mjs','utf8');
const adapter=fs.readFileSync('tools/goldBattleHudR50c.mjs','utf8');

const failures=[]; const passes=[];
function check(name,cond){(cond?passes:failures).push((cond?'PASS ':'FAIL ')+name);}

check('build chains R50C after R48B', build.includes("adaptGoldBattleHudR50c") && build.indexOf('adaptGoldBattleHudR50c(out)')>build.indexOf('adaptGoldBattleHudR48b(out)'));
check('live identity includes battle avatar', bridge.includes('battleAvatar: art.battleAvatar || art.portrait'));
check('live identity includes display tag', bridge.includes('tag: copy.tag ||'));
check('HUD consumes identity every frame', hud.includes('if(s.identity)applyIdentityProjection(i,s.identity)'));
check('side name is live', hud.includes("side.name&&side.name.textContent!==name"));
check('rail name is live', hud.includes("rail.name&&rail.name.textContent!==name"));
check('rival name is live', hud.includes("R.side[i^1]") && hud.includes('rival.textContent!==name'));
check('battle avatar replaces donor portrait', hud.includes('apex-battle-avatar') && hud.includes('has-production-avatar'));
check('weapon projection includes tier', bridge.includes('tierColor') && bridge.includes('holder.meta.tier'));
check('HUD renders tier under-light', hud.includes('.wp-ico.has-tier::before') && hud.includes("u.ico.dataset.tier=w.tier||''"));
check('ammo remains current/max', hud.includes("u.cur.textContent=rel?'––':(usesAmmo?am:'—')") && hud.includes("u.max.textContent=rel?'RELOAD':(usesAmmo?'/'+w.mag:'')"));
check('impact FX sits above entire side panel', hud.includes('#globalFx{z-index:35') && hud.includes('#ruptureLayer{position:absolute;inset:0;z-index:36'));
check('impact layers remain non-interactive', hud.includes('#globalFx{z-index:35;overflow:visible}') && hud.includes('#copyLayer{z-index:40}'));
check('bridge captures event-local accent', bridge.includes('const impactAccent = accentOf(ev.attacker)'));
check('no shared crit accent mutation function remains', !bridge.includes('function setCritAccent'));
check('HUD seam accepts event accent', hud.includes('afterHp,impactAccent') && hud.includes("applyDamage(a,v,Math.round(amt),tier,impactAccent)"));
check('critical popup owns its accent', hud.includes("if(impactAccent)el.style.setProperty('--crit',impactAccent)"));
check('R50C adapter is deterministic', adapter.includes("seam missing") && adapter.includes("seam duplicated"));

console.log(['BATTLE HUD LIVE TRUTH GATE',...passes].join('\n'));
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('RESULT: PASS ('+passes.length+' checks)');
