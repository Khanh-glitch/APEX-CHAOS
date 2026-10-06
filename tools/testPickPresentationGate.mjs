import fs from 'node:fs';

const shell=fs.readFileSync('public/gold/shell.html','utf8');
const build=fs.readFileSync('tools/buildGoldCutover.mjs','utf8');
const failures=[];const passes=[];
function check(name,cond){(cond?passes:failures).push((cond?'PASS ':'FAIL ')+name);}

const frost="frost:{scale:1.53,x:0,y:16}";
check('Frost presentation is data-owned', shell.includes(frost) && build.includes(frost));
check('Frost no longer hardcodes one facing', !shell.includes('frost:{scale:1.53,x:0,y:16,face:') && !build.includes('frost:{scale:1.53,x:0,y:16,face:'));
check('side defaults face inward', shell.includes("const face=Number.isFinite(p.face)?p.face:(player==='p2'?-1:1)"));
check('Frost scale is about 1.3x previous', Math.abs(1.53/(1.18)-1.2966)<0.01);
check('Frost anchor moves downward rather than upward', shell.includes('frost:{scale:1.53,x:0,y:16}'));
check('one world hero body is created', shell.includes("body.className='worldHeroBody'"));
check('full-art echo clone path absent', !shell.includes('ghost=prev.cloneNode(true)') && !shell.includes('echo=img.cloneNode()'));
check('secondary hero FX cannot duplicate full art', shell.includes('No duplicate image/echo layer'));
check('swap cancels stale animation', shell.includes("current.getAnimations?.().forEach(a=>a.cancel())"));
check('swap removes current before committing latest', shell.includes('current.remove();') && shell.includes('if(latest)commitWorldHero(container,latest,state)'));
check('presentation is not side-specific CSS scale hack', !shell.includes('.worldHeroSlot.p1[data-hero="frost"] .worldHeroAsset') && !shell.includes('.worldHeroSlot.p2[data-hero="frost"] .worldHeroAsset'));

// ── R57 OWNER LAW (2026-10-07): the A1/A2/PASSIVE display at fighter pick ──
// ONE language on every side: a ROLE mark (PASSIVE / A1 / A2) plus the ability
// name, with the accepted key cap only where a human owns that side (P1 J/K,
// Local P2 NUM1/NUM2 — the right-hand numpad pair; the CPU side has no key).
check('every pick chip carries the role mark and the name',
  shell.includes("return chip('PASSIVE',s[0],null)+chip('A1',s[1],0)+chip('A2',s[2],1);"));
check('the pick screen names the right-hand numpad pair for a human P2',
  shell.includes("const key=player==='p1'?['J','K']:(battleMode!=='bot'?['NUM1','NUM2']:null);"));
check('a CPU side advertises no human key',
  shell.includes('+(k==null||!key?'));
check('chip typography is one law, not a 5-8px stack',
  shell.includes('R57 OWNER LAW (2026-10-07) — the A1/A2/PASSIVE display at fighter pick')
  && /\.skillChip\{min-width:0;max-width:100%;gap:6px;font-size:clamp\(10px,\.78vw,12\.5px\)!important/.test(shell));

console.log(['PICK PRESENTATION GATE',...passes].join('\n'));
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('RESULT: PASS ('+passes.length+' checks)');
