// ---------------------------------------------------------------------------
// Gold tab favicon gate — owner APEX mark is tab-only and generator-owned.
// ---------------------------------------------------------------------------
import fs from 'node:fs';

const shell = fs.readFileSync('public/gold/shell.html', 'utf8');
const generator = fs.readFileSync('tools/buildGoldCutover.mjs', 'utf8');
const sourceIcon = fs.readFileSync('tools/gold-cutover/assets/favicon-r72-owner.png');
const publicIcon = fs.readFileSync('public/gold/assets/gold/favicon-r72-owner.png');
const entryHtml = fs.readFileSync('index.html', 'utf8');
const shipping = fs.readFileSync('src/game/goldAssetManifest.js', 'utf8');

const failures = [];
const notes = [];
function check(name, cond, detail) {
  if (cond) { notes.push(`PASS ${name}`); return; }
  failures.push(`FAIL ${name}${detail ? ' :: ' + detail : ''}`);
}

const newLink = '<link rel="icon" type="image/png" href="assets/gold/favicon-r72-owner.png?v=r72">';
const oldLink = '<link rel="icon" type="image/png" href="assets/gold/favicon-apex-chaos.png">';
const profileAvatar = '<img class="avatarGameIcon" src="assets/gold/favicon-apex-chaos.png"';

check('new tab favicon link exists exactly once', shell.split(newLink).length - 1 === 1);
check('old tab favicon link is gone', !shell.includes(oldLink));
check('profile avatar remains on the old avatar asset', shell.includes(profileAvatar));
check('owner tab favicon source/public bytes match', sourceIcon.equals(publicIcon));
check('root tab favicon uses R72 PNG', entryHtml.includes('href="/gold/assets/gold/favicon-r72-owner.png?v=r72"'));
check('owner tab favicon is a PNG', sourceIcon.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
check('generator declares SHL-S0 favicon patch', generator.includes("id: 'SHL-S0'"));
check('generator stages favicon production overlay',
  generator.includes("outputs.set('assets/gold/favicon-r72-owner.png', read(TAB_FAVICON_R72_SRC))"));
check('shipping manifest registers new favicon',
  shipping.includes("'/gold/assets/gold/favicon-r72-owner.png'"));

const lines = ['GOLD TAB FAVICON GATE', ...notes];
if (failures.length) {
  lines.push('', ...failures, '', `RESULT: FAIL (${failures.length})`);
  console.error(lines.join('\n'));
  process.exit(1);
}
lines.push('', `RESULT: PASS (${notes.length} checks)`);
console.log(lines.join('\n'));
