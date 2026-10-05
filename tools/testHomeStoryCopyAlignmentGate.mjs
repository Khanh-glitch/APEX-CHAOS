// ---------------------------------------------------------------------------
// HOME STORY HIERARCHY — LEFT-EDGE GOLD CONTRACT.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const read = (rel) => readFileSync(join(REPO, rel), 'utf8');

let pass = 0;
const fails = [];
function ok(cond, label, detail) {
  if (cond) { pass += 1; return true; }
  fails.push(label + (detail === undefined ? '' : ` — ${detail}`));
  return false;
}

const CANON = read('docs/gold-ui/current/index.html');
const SHELL = read('public/gold/shell.html');
const GEN = read('tools/buildGoldCutover.mjs');
const STYLES = read('src/styles.css');

const ALIGN_RULE = 'section.story.e-story,section.story.e-story .quest,section.story.e-story .storyTitle,section.story.e-story .location,section.story.e-story .copy{text-align:left!important}';
const EDGE_RULE = 'section.story.e-story .location,section.story.e-story .copy{margin-left:0!important}';

ok(GEN.includes("id: 'SHL-S27'"), 'generator declares SHL-S27');
ok(GEN.includes('Home story hierarchy shares one Gold-authored left edge'),
  'SHL-S27 documents the unified left-edge law');
ok((SHELL.split(ALIGN_RULE).length - 1) === 1,
  'scoped left-align rule appears exactly once', String(SHELL.split(ALIGN_RULE).length - 1));
ok((SHELL.split(EDGE_RULE).length - 1) === 1,
  'scoped margin normalization appears exactly once', String(SHELL.split(EDGE_RULE).length - 1));
ok(!/section\.story\.e-story[^\n{]*\{[^}]*text-align\s*:\s*right/.test(SHELL),
  'Home story has no surviving right alignment');

const storyBlock = (src) => {
  const i = src.indexOf('<section class="story e-story"');
  if (i < 0) return null;
  const j = src.indexOf('</section>', i);
  return src.slice(i, j + '</section>'.length);
};
const canonBlock = storyBlock(CANON);
const shellBlock = storyBlock(SHELL);
ok(!!canonBlock, 'canonical Home story block exists');
ok(!!shellBlock, 'generated Home story block exists');
ok(canonBlock === shellBlock, 'semantic Home story markup remains byte-identical to canonical Gold');
if (shellBlock) {
  ok(shellBlock.includes('<div class="quest">QUEST 01</div>'), 'QUEST 01 preserved');
  ok(shellBlock.includes('<h1 class="storyTitle"><span>THE ONES</span><span>THROWN AWAY</span></h1>'),
    'story title hierarchy preserved');
  ok(shellBlock.includes('<div class="location">SCRAP BASIN</div>'), 'location preserved');
  ok(shellBlock.includes('<p class="copy">Discarded machines, forgotten by the world.<br>But here, in the Scrap Basin,<br>they move again.</p>'),
    'three-line story copy preserved');
}

const baseLocation = /(^|[\n;{])\s*\.location\s*\{([^}]*)\}/.exec(SHELL);
const baseCopy = /(^|[\n;{])\s*\.copy\s*\{([^}]*)\}/.exec(SHELL);
ok(!!baseLocation && baseLocation[2].includes('margin:14px 0 0 13px'),
  'canonical location rule stays intact below scoped override');
ok(!!baseCopy && baseCopy[2].includes('margin:20px 0 0 14px'),
  'canonical copy rule stays intact below scoped override');
ok((SHELL.match(/\.copy\{display:none\}/g) || []).length === 2,
  'both responsive copy-hide rules remain present');
ok(/p\s*\{\s*color:[^}]*text-align:\s*center/.test(STYLES),
  'legacy global centered paragraph rule remains and is explicitly defeated');
ok(ALIGN_RULE.includes('section.story.e-story .copy') && ALIGN_RULE.includes('!important'),
  'Gold selector explicitly outranks legacy paragraph alignment');

const total = pass + fails.length;
console.log(`\n[home-story-copy-alignment] ${pass}/${total} checks passed`);
if (fails.length) {
  console.log('FAILURES:');
  for (const f of fails) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('Home story QUEST/title/location/copy share one left-aligned Gold contract.');
process.exit(0);
