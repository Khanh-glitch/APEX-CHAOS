// ---------------------------------------------------------------------------
// Owner playtest r44, item 7 gate — HOME STORY-COPY RIGHT ALIGNMENT.
//
// Proves that the Home story copy is right-aligned ONLY inside the authored
// story-copy block, that the three authored lines / line breaks / text /
// typography / hierarchy are untouched, and that nothing else in the product
// drifted to right-aligned. The rule must be emitted by the generator
// (tools/buildGoldCutover.mjs patch SHL-S27), never hand-edited into the
// generated output.
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

const SCOPED_RULE = 'section.story.e-story .copy{text-align:right}';

// ── 1. the generator owns the fix ──────────────────────────────────────────
ok(GEN.includes("id: 'SHL-S27'"), 'the generator declares patch SHL-S27 (Home story-copy alignment)');
ok(GEN.includes('Home story copy right-aligned inside the authored story-copy block only'),
  'the patch documents its intent');

// ── 2. the scoped rule is present exactly once in the generated shell ──────
ok((SHELL.match(new RegExp(SCOPED_RULE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length === 1,
  'the scoped right-align rule appears exactly once in public/gold/shell.html',
  String(SHELL.split(SCOPED_RULE).length - 1));
ok(SHELL.includes('section.story.e-story::before'), 'the rule is anchored on the authored story clean-override block');

// The rule must be SCOPED — a bare/global right-align would be a regression.
ok(!/(^|[,\n{])\s*\.copy\s*\{[^}]*text-align\s*:\s*right/.test(SHELL),
  'no bare/unscoped .copy right-align rule exists');
ok(!/(^|[,\n{])\s*p\s*\{[^}]*text-align\s*:\s*right/.test(SHELL),
  'no global p right-align rule exists');

// ── 3. the authored story-copy block is byte-identical to canonical ────────
const storyBlock = (src) => {
  const i = src.indexOf('<section class="story e-story"');
  if (i < 0) return null;
  const j = src.indexOf('</section>', i);
  return src.slice(i, j + '</section>'.length);
};
const canonBlock = storyBlock(CANON);
const shellBlock = storyBlock(SHELL);
ok(!!canonBlock, 'the authored Home story-copy block exists in canonical Gold');
ok(!!shellBlock, 'the authored Home story-copy block exists in the generated shell');
ok(canonBlock === shellBlock, 'the whole authored story section is byte-identical (no hand-editing)');
if (canonBlock && shellBlock) {
  ok(canonBlock.includes('<p class="copy">Discarded machines, forgotten by the world.<br>But here, in the Scrap Basin,<br>they move again.</p>'),
    'the exact three <br>-separated lines are preserved');
  ok((canonBlock.match(/<br>/g) || []).length === 2,
    'both authored line breaks preserved (three lines of copy)',
    String((canonBlock.match(/<br>/g) || []).length));
  ok((canonBlock.split('<br>').length) === 3, 'the authored copy is exactly three lines');
  ok(canonBlock.includes('<div class="quest">QUEST 01</div>'), 'the authored QUEST label is preserved');
  ok(canonBlock.includes('<h1 class="storyTitle"><span>THE ONES</span><span>THROWN AWAY</span></h1>'),
    'the authored two-line story title hierarchy is preserved');
  ok(canonBlock.includes('<div class="location">SCRAP BASIN</div>'), 'the authored location label is preserved');
  ok(!canonBlock.includes('style='), 'no inline style was injected into the authored block');
}

// ── 4. base .copy typography is untouched ──────────────────────────────────
const copyRule = /(^|[\n;{])\s*\.copy\s*\{([^}]*)\}/.exec(SHELL);
ok(!!copyRule, 'the base .copy typography rule still exists');
if (copyRule) {
  ok(!/text-align/.test(copyRule[2]), 'the base .copy rule gained no text-align (it inherits alignment)',
    copyRule[2].trim().slice(0, 80));
  ok(copyRule[2].includes('margin:20px 0 0 14px'), 'the base .copy margin is unchanged');
  ok(/max-width:380px/.test(copyRule[2]), 'the base .copy max-width is unchanged');
}

// ── 5. the authored responsive portrait behaviour is preserved ─────────────
ok((SHELL.match(/\.copy\{display:none\}/g) || []).length === 2,
  'both authored .copy responsive hide rules are preserved',
  String((SHELL.match(/\.copy\{display:none\}/g) || []).length));
function enclosingMedia(src, idx) {
  // Find the nearest preceding @media, then walk forward counting braces to
  // confirm that idx really falls inside that block.
  const re = /@media/g;
  let best = -1;
  let m;
  while ((m = re.exec(src))) { if (m.index < idx) best = m.index; else break; }
  if (best < 0) return null;
  let depth = 0;
  for (let i = best; i < src.length; i += 1) {
    const c = src[i];
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return idx < i ? src.slice(best, i).split('{')[0].trim() : null;
    }
  }
  return null;
}
const hideMatches = [...SHELL.matchAll(/\.copy\{display:none\}/g)];
ok(hideMatches.length === 2, 'both authored .copy responsive hide rules are present',
  String(hideMatches.length));
for (const m of hideMatches) {
  const media = enclosingMedia(SHELL, m.index || 0);
  ok(!!media, `each .copy hide rule stays inside a media query (at ${m.index})`, String(media));
}

// ── 6. exactly one new right-align, and nothing else drifted ───────────────
ok(SHELL.split('text-align:right').length - 1 === CANON.split('text-align:right').length - 1 + 1,
  'the generated shell gained exactly ONE text-align:right (the scoped story rule)',
  `canonical=${CANON.split('text-align:right').length - 1} generated=${SHELL.split('text-align:right').length - 1}`);

// ── 7. the legacy centred portrait CSS is untouched and not the Gold shell ─
const legacyP = /p\s*\{\s*color:[^}]*text-align:\s*center/.test(STYLES);
ok(legacyP, 'the pre-existing legacy p{text-align:center} rule still exists in src/styles.css');
ok(!/p\s*\{\s*text-align:center/.test(SHELL),
  'no p{text-align:center} was introduced into the Gold shell');
const legacyIdx = STYLES.indexOf('p { color: #b9b09d; text-align: center;');
ok(legacyIdx > -1, 'the exact legacy centred p rule is still present in src/styles.css');
// NOTE (root cause): the legacy `@media (orientation: portrait)` block that
// precedes it CLOSES at line 1050, so this `p` rule is TOP-LEVEL in the legacy
// stylesheet and therefore centres EVERY <p> — including the Gold story copy —
// in every orientation. That is exactly the drift the owner reported. The Gold
// fix must therefore win on SPECIFICITY, not on cascade order.
ok(enclosingMedia(STYLES, legacyIdx) === null,
  'the legacy centred rule is confirmed top-level (its enclosing media query closed early) — the Gold rule must win on specificity');
ok(!/e-story|section\.story/.test(STYLES.slice(0, legacyIdx)),
  'the legacy rule is not scoped to the Gold story block');

// Specificity of the authored fix must beat the global legacy `p` rule.
function specificity(sel) {
  const ids = (sel.match(/#[\w-]+/g) || []).length;
  const classes = (sel.match(/\.[\w-]+/g) || []).length;
  const els = (sel.replace(/[.#][\w-]+/g, '').match(/\b[a-zA-Z][\w-]*/g) || []).length;
  return ids * 100 + classes * 10 + els;
}
const SCOPED_SEL = 'section.story.e-story .copy';
ok(specificity(SCOPED_SEL) > specificity('p'),
  `the scoped rule outranks the global legacy p rule (${specificity(SCOPED_SEL)} > ${specificity('p')})`,
  `${specificity(SCOPED_SEL)} vs ${specificity('p')}`);
ok(new RegExp(`${SCOPED_SEL.replace(/\./g, '\\.')}\\s*\\{`).test(SHELL),
  'the scoped rule is emitted verbatim as a selector in the generated shell');

// ── 8. the story block is not re-aligned by any runtime writer ─────────────
for (const f of ['src/App.jsx', 'public/game/gold/goldProductBridge.js', 'src/styles.css']) {
  const src = read(f);
  ok(!/\.copy['"]?\s*\)?\.style\.(textAlign|cssText)\s*=/.test(src),
    `${f} does not write an inline alignment onto .copy`);
  ok(!/querySelector(All)?\(['"]\.copy['"]\)/.test(src),
    `${f} does not select .copy at runtime`);
}

// ── report ────────────────────────────────────────────────────────────────
const total = pass + fails.length;
console.log(`\n[home-story-copy-alignment] ${pass}/${total} checks passed`);
if (fails.length) {
  console.log('FAILURES:');
  for (const f of fails) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('Home story copy is right-aligned ONLY inside the authored story-copy block');
console.log('(generator patch SHL-S27); the three authored lines, line breaks, text,');
console.log('typography, hierarchy and responsive portrait behaviour are byte-identical;');
console.log('no other rule in the product drifted to right-aligned.');
process.exit(0);
