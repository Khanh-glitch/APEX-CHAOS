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

check('a new hero outro cancels any still-running entry transform animation first',
  shell.includes("current.getAnimations?.().forEach(a=>a.cancel())"));

check('Fighter Pick A1/A2 labels resolve through the shared production skill-copy authority',
  shell.includes('function resolvedSkillCopy(id)')
  && shell.includes('const s=resolvedSkillCopy(id);')
  && shell.includes("typeof g.skillDisplay==='function'"));

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

check('Frost uses one hero-level scale/orientation authority, alpha-bottom grounded and mirrored per side',
  shell.includes('frost:{scale:1.53,x:0,nativeFacing:-1,groundLine:.965}')
  && shell.includes('const face=nativeFacing*desiredSideFacing')
  && shell.includes('function visualBottomRatio(img)')
  && shell.includes('function anchoredHeroY(img,p)')
  && shell.includes("applyHeroPresentation(img,target.renderId,target.id,target.player)")
  && shell.includes("setProperty('transform-origin','50% 68%','important')")
  // CP6 owner law: accepted scale stays 1.53; native art facing composes with
  // side-facing and vertical placement derives from visible alpha bottom.
  && !shell.includes('frost:{scale:1.53,x:0,y:16}')
  && !/data-hero="frost"[\s\S]{0,160}scale:-?2\.5/.test(shell));

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

const out = ['GOLD FIGHTER PICK ADAPTATION GATE (R49D root authority)', ...passes];
if (failures.length) {
  out.push('', ...failures, '', 'RESULT: FAIL (' + failures.length + ')');
  console.error(out.join('\n'));
  process.exit(1);
}
out.push('', 'RESULT: PASS (' + passes.length + ' checks)');
console.log(out.join('\n'));
