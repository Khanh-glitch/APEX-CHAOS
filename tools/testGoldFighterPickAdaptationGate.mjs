import fs from 'node:fs';

const shell = fs.readFileSync('public/gold/shell.html', 'utf8');
const generator = fs.readFileSync('tools/buildGoldCutover.mjs', 'utf8');
const failures = [];
const passes = [];
function check(name, ok, detail = '') {
  (ok ? passes : failures).push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
}

check('R49 uses one Fighter Pick presentation authority',
  shell.includes('id="r49-fighter-presentation-authority"')
  && shell.includes('const HERO_PRESENTATION=Object.freeze')
  && shell.includes('const worldHeroSwapState=new WeakMap()'));

check('hero swap is sequential: current exits, is removed, then latest pending hero mounts',
  shell.includes('state.swapping=true;')
  && shell.includes('current.remove();')
  && shell.includes('if(latest)commitWorldHero(container,latest,state);')
  && shell.indexOf('current.remove();') < shell.indexOf('if(latest)commitWorldHero(container,latest,state);'));

check('rapid selection coalesces to the latest pending hero instead of stacking full-art nodes',
  shell.includes('state.pending=target;')
  && shell.includes('if(state.swapping)return;')
  && shell.includes('const latest=state.pending;'));

check('no cloned full-art ghost/echo path survives',
  !shell.includes('ghost=prev.cloneNode(true)')
  && !shell.includes('echo=img.cloneNode()')
  && shell.includes('.worldHeroGhost,.worldHeroFxAsset{display:none!important}'));

check('one slot geometry law is shared by every hero and both sides',
  shell.includes("container.style.setProperty('top','7vh','important')")
  && shell.includes("container.style.setProperty('bottom','15.5vh','important')")
  && shell.includes("container.style.setProperty('width','50.5vw','important')")
  && shell.includes("container.style.setProperty('left','-4.6vw','important')")
  && shell.includes("container.style.setProperty('right','-4.6vw','important')"));

check('Hunter physical scale comes from the one authority, not side-specific CSS',
  shell.includes('hunter:{scale:.62,x:0,y:5}')
  && !/r49-fighter-presentation-authority[\s\S]*data-hero="hunter"[\s\S]*transform:scale/.test(shell));

check('Frost uses one hero-level orientation for BOTH sides and is grounded lower',
  shell.includes('frost:{scale:1.18,x:0,y:12,face:-1}')
  && shell.includes("const face=Number.isFinite(p.face)?p.face:(player==='p2'?-1:1)")
  && shell.includes("applyHeroPresentation(img,target.renderId,target.id,target.player)"));

check('Mirror has no static selected-large placeholder and waits for a real opponent pick',
  !shell.includes('mirror-world-runtime-opponent-ghost.svg')
  && shell.includes('function mirrorOpponentHero(player)')
  && shell.includes("if(!p2HasPicked || p2Empty || p2Hero==='mirror') return null;")
  && shell.includes("if(!p1HasPicked || p1Hero==='mirror') return null;"));

check('Mirror reuses the copied opponent presentation scale and only darkens presentation',
  shell.includes("const renderId=id==='mirror'?mirrorSource:id;")
  && shell.includes('const p=presentationFor(renderId,player);')
  && shell.includes("if(requestedId==='mirror')")
  && shell.includes("brightness(.47) saturate(.62)"));

check('locked/artless cards never emit an empty image and retain intentional lock treatment',
  !shell.includes('<img src="${h.portrait||\'\'}"')
  && shell.includes('rosterLockedVisual')
  && shell.includes('<span class="rosterLock"'));

check('portrait load failure has a deliberate visual fallback',
  shell.includes("img.addEventListener('error',()=>")
  && shell.includes("b.classList.add('art-missing')"));

check('generator re-applies R49 root authority after historical R48A intermediate patches',
  generator.includes('R49 root correction: single Pick presentation + READY battle reveal')
  && generator.includes('R49 duplicate hero-art path survived')
  && generator.includes('const HERO_PRESENTATION=Object.freeze')
  && generator.includes('r49-fighter-presentation-authority'));

const out = ['GOLD FIGHTER PICK ADAPTATION GATE (R49 root authority)', ...passes];
if (failures.length) {
  out.push('', ...failures, '', 'RESULT: FAIL (' + failures.length + ')');
  console.error(out.join('\n'));
  process.exit(1);
}
out.push('', 'RESULT: PASS (' + passes.length + ' checks)');
console.log(out.join('\n'));
