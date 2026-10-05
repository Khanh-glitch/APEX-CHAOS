import fs from 'node:fs';

const battle=fs.readFileSync('public/game/modes/arsenalBattleRuntime.js','utf8');
const bridge=fs.readFileSync('public/game/gold/goldProductBridge.js','utf8');
const meta=fs.readFileSync('public/game/arsenal/arsenalMetaRuntime.js','utf8');
const failures=[];const passes=[];
function check(name,cond){(cond?passes:failures).push((cond?'PASS ':'FAIL ')+name);}

check('battle state owns winnerSide', battle.includes('winnerSide: null'));
check('KO assigns winner side by fighter reference', battle.includes("const winnerSide = winner === fighters[0] ? 'P1' : 'P2'"));
check('KO persists winner side before legacy name', battle.indexOf('state.winnerSide = winnerSide') < battle.indexOf('state.over = winner.name'));
check('reward consumes winner side', battle.includes('awardBattleResult?.(winnerSide, state)'));
check('debug exposes winner side', battle.includes('winnerSide: state.winnerSide || null'));
check('Gold reads winner side first', bridge.includes("state && state.winnerSide === 'P1' ? 0") && bridge.includes("state && state.winnerSide === 'P2' ? 1"));
check('legacy name fallback rejects ambiguity', bridge.includes('if (matches.length === 1) winnerIdx = matches[0]'));
check('Gold no longer uses findIndex by fighter name for winner', !bridge.includes("fighters.findIndex((f) => f && String(f.name) === over)"));
check('economy reward is side-authoritative', meta.includes("const won = winnerSide === 'P1'"));

console.log(['BATTLE OUTCOME SIDE GATE',...passes].join('\n'));
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('RESULT: PASS ('+passes.length+' checks)');
