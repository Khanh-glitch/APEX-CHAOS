import fs from 'node:fs';

const shell = fs.readFileSync('public/gold/shell.html', 'utf8');
const generator = fs.readFileSync('tools/buildGoldCutover.mjs', 'utf8');
const failures = [];
const passes = [];
function check(name, ok, detail = '') {
  (ok ? passes : failures).push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
}

check('R48A generated shell contains the dedicated adaptation style',
  shell.includes('id="r48a-fighter-pick-adaptation"'));
check('old hero retreats before new hero entrance completes',
  /\.worldHeroGhost\{animation:r48HeroRetreatP1 150ms/.test(shell)
  && /r48HeroEnterP1 220ms[^\n]*145ms both/.test(shell));
check('Frost orientation override applies identically to BOTH P1 and P2',
  /\.worldHeroSlot\.p1\[data-hero="frost"\] \.worldHeroAsset,\.worldHeroSlot\.p2\[data-hero="frost"\] \.worldHeroAsset\{[^}]*scale:-2\.5 2\.5!important/s.test(shell));
check('Frost is lowered under foreground while using the owner 2.5x fallback scale',
  /data-hero="frost"[^}]*transform:translateY\(14%\)!important;[^}]*scale:-2\.5 2\.5!important/s.test(shell));
check('Hunter selected art is reduced to 60 percent on both sides',
  /p1\[data-hero="hunter"\][^}]*transform:scale\(\.60\)!important/s.test(shell)
  && /p2\[data-hero="hunter"\][^}]*transform:scale\(\.60\)!important/s.test(shell));
check('Mirror has no static world placeholder remaining',
  !shell.includes('mirror-world-runtime-opponent-ghost.svg')
  && shell.includes('const WORLD_ART = {};'));
check('Mirror selected presentation derives only from an actually picked opponent',
  shell.includes('function mirrorOpponentHero(player)')
  && shell.includes('if(!p2HasPicked || p2Empty || p2Hero===\'mirror\') return null;')
  && shell.includes('if(!p1HasPicked || p1Hero===\'mirror\') return null;'));
check('Mirror uses opponent selected art and a darker reflection treatment',
  shell.includes("const sourceHero=renderId?HEROES[renderId]:null;")
  && shell.includes("img.classList.add('mirrorOpponentAsset')")
  && /mirrorOpponentAsset\{[^}]*brightness\(\.46\)/s.test(shell));
check('locked/artless cards no longer emit an empty image src',
  !shell.includes('<img src="${h.portrait||\'\'}"')
  && shell.includes('rosterLockedVisual')
  && shell.includes('<span class="rosterLock"'));
check('portrait load failure has a deliberate visual fallback',
  shell.includes("img.addEventListener('error',()=>")
  && shell.includes("b.classList.add('art-missing')"));
check('generator contains the same R48A adaptation authority',
  generator.includes('R48A owner Fighter Pick adaptation')
  && generator.includes('r48HeroRetreatP1')
  && generator.includes('mirrorOpponentHero(player)')
  && generator.includes('scale:-2.5 2.5!important'));

const out = ['GOLD FIGHTER PICK ADAPTATION GATE (R48A)', ...passes];
if (failures.length) {
  out.push('', ...failures, '', 'RESULT: FAIL (' + failures.length + ')');
  console.error(out.join('\n'));
  process.exit(1);
}
out.push('', 'RESULT: PASS (' + passes.length + ' checks)');
console.log(out.join('\n'));
