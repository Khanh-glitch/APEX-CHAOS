// B8qb independent Gold source authority audit.
// This MUST NOT replace / skip the original Product Acceptance browser
// R62/R65/R68 gates. A canonical-source match is not an owner playtest.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const root='docs/gold-ui/current/donors/battle-hud/index.html';
const donor=readFileSync(root,'utf8');
const product=readFileSync('public/gold/battle-hud.html','utf8');
const coord=readFileSync('src/game/sceneTransitionCoordinator.js','utf8');
const test=readFileSync('tools/testGoldCutoverBrowser.mjs','utf8');
let checks=0;
function verify(label,cond,details){
 assert.ok(cond,label+(details?' : '+details:''));
 console.log('PASS B8qb '+label);checks++;
}
function rule(css,selector){
 const p=css.indexOf(selector+'{');
 assert.ok(p>=0,'selector absent '+selector);
 const from=p+selector.length+1;
 const end=css.indexOf('}',from);
 assert.ok(end>=0,'CSS rule unclosed '+selector);
 return css.slice(from,end).replace(/\s+/g,' ').trim();
}
const selector='#hud[data-layout="port"][data-mode="1p"] #p1Side';
const skillSelector='#hud[data-layout="port"][data-mode="1p"] #p1Side .skills';
const donorSide=rule(donor,selector);
const liveSide=rule(product,selector);
const donorSkills=rule(donor,skillSelector);
const liveSkills=rule(product,skillSelector);
const normalizeAreas=s=>(s.match(/grid-template-areas:\s*([^;]+)/)||[])[1]?.replace(/\s+/g,' ')||'';
verify('owner donor has two-row identity/weapon above skills',
 normalizeAreas(donorSide)==='"id wp" "sk sk"');
verify('shipping Gold retains canonical owner portrait solo grid topology',
 normalizeAreas(liveSide)===normalizeAreas(donorSide));
verify('owner donor explicitly uses TWO flexible sibling skill columns',
 /grid-template-columns:\s*1fr\s+1fr/.test(donorSkills));
verify('shipping Gold preserves same two-column design',
 /grid-template-columns:\s*1fr\s+1fr/.test(liveSkills));
verify('owner donor does NOT require firearm between two square skills',
 !/grid-template-areas:\s*"s1 wp s2"/.test(donorSide));
verify('R62 physical iPad geometry and true touch target gates are preserved',
 test.includes("gate('R62-iPad-owner-Gold-portrait-BOT-dock-geometry'")&&
 test.includes("gate('R62-iPad-owner-Gold-portrait-BOT-real-skill-hit-targets'")&&
 test.includes("portraitTablet?.skillHits?.every(Boolean)===true")&&
 !test.includes("gate('R62-iPad-portrait-BOT-near-square-thumb-controls'"));
verify('R68 real loaded art and cooldown state gate survives R70 removal',
 test.includes("gate('R68-art-state-is-bounded-and-actually-rendered'")&&
 test.includes('skillArtProbe.imageLoaded===true')&&
 test.includes('skillArtProbe.cooling?.opacity<.48')&&
 test.includes('skillArtProbe.overlayDisabled===true'));
verify('owner R70 clean production skill image is implemented',
 product.includes('/* R70 skill image: no progress ring, glow, or animated cover; preserve timers and states. */')&&
 product.includes('#hud .skill .sk-art>.sk-mask,')&&
 product.includes('#hud .skill .sk-art>.sk-sweep{display:none!important}'));
verify('Door deliberately leaves viewport when idle and enters during transition',
 coord.includes("canvas.style.display = 'none'")&&
 coord.includes("canvas.style.display = 'block'")&&
 coord.includes("canvas.setAttribute('aria-hidden', 'true')"));
verify('Door backing + visible-active/hidden-DONE behavior are both enforced',
 test.includes("gate('gold-transition-responsive-canvas-follows-portrait-viewport'")&&
 test.includes('responsive.backingW>=390*responsive.dpr')&&
 test.includes("responsive.ariaHidden==='true'"));
console.log('B8qb canonical-source audit: '+checks+' / '+checks+' PASS');
console.log('IMPORTANT: real Product Acceptance CI remains independent; passing geometry and art probes cannot replace owner visual acceptance.');
