import fs from 'node:fs';

const hr=fs.readFileSync('public/game/hero-rework/heroReworkRuntime.js','utf8');
const bridge=fs.readFileSync('public/game/gold/goldProductBridge.js','utf8');
const failures=[]; const notes=[];
function check(name, cond){(cond?notes:failures).push((cond?'PASS ':'FAIL ')+name);}

check('combatant has side identity', hr.includes("side: idx === 0 ? 'p1' : 'p2'"));
check('combatant has stable combatantId', hr.includes("combatantId: idx === 0 ? 'p1' : 'p2'"));
check('Cast carries side', /AIL\.bus\.emit\('Cast',[^\n]+side: input\.side/.test(hr));
check('Cast carries combatantId', /AIL\.bus\.emit\('Cast',[^\n]+combatantId: input\.combatantId/.test(hr));
check('P1 J supplies explicit side', hr.includes("{ side: 'p1', source: 'keyboard', key: 'KeyJ' }"));
check('P1 K supplies explicit side', hr.includes("{ side: 'p1', source: 'keyboard', key: 'KeyK' }"));
check('P2 Digit keys supply explicit side', hr.includes("{ side: 'p2', source: 'keyboard', key: e.code }"));
check('P2 AI supplies explicit side', hr.includes("{ side: 'p2', source: 'ai' }"));
check('generic AbilityPress exists', hr.includes("AIL.bus.emit('AbilityPress', press)"));
check('legacy P1Press preserved', hr.includes("AIL.bus.emit('P1Press', press)"));
check('Gold cast routing prefers payload side', bridge.includes("payload.side === 'p2'") && bridge.includes("payload.side === 'p1'"));
check('hero match is fallback only', bridge.includes('Backward compatibility for old recorded events only'));
check('same-hero first-match loop no longer primary', !bridge.includes("if (!f || heroIdOf(f) !== hero) continue;"));

console.log(['SIDE-AWARE ABILITY ROUTING GATE',...notes].join('\n'));
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('RESULT: PASS ('+notes.length+' checks)');
