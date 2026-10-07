// ---------------------------------------------------------------------------
// R51 scene route policy gate (owner law, 2026-10-05).
//
// Locks the SHIPPING artifact (`public/gold/shell.html`) and the tools that
// produce it:
//
//   1. Home -> Free Battle -> Fighter Pick -> Battle NEVER engage the
//      Mechanical Door. Each hop owns its own authored transition. The Door is
//      a SCENE authority only: boot + the Lucky Draw bay.
//   2. Lucky Draw goes through ONE SFX seam (window.apexShellSfx) instead of
//      the block-local uiSfx helper that does not exist in its script block.
//   3. The battle HUD handoff guards the seam before setMode (the bridge
//      deletes the seam on unmount, so a late message must not throw).
//   4. The shipped battle payload is byte-identical to public/gold/battle-hud.html
//      and still carries the owner-feedback features (production avatar, FX
//      composited above the side panels, weapon tier glow, held-skill state,
//      ammo x/y markers, enlarged weapon block).
//   5. The build pipeline keeps the two R50K shipping guards: the fail-closed
//      dist HTML-reference guard and the shell-runtime derivation in the audit.
// ---------------------------------------------------------------------------
import fs from 'node:fs';

const shell = fs.readFileSync('public/gold/shell.html', 'utf8');
const hud = fs.readFileSync('public/gold/battle-hud.html', 'utf8');
const adapter = fs.readFileSync('tools/goldShellR50k.mjs', 'utf8');
const prune = fs.readFileSync('tools/pruneShippingDist.mjs', 'utf8');
const audit = fs.readFileSync('tools/assetAudit.mjs', 'utf8');

const notes = [];
const failures = [];
function check(name, cond, detail) {
  (cond ? notes : failures).push((cond ? 'PASS ' : 'FAIL ') + name + (detail && !cond ? ' :: ' + detail : ''));
}

// ── 0. script blocks (classic scripts do NOT share lexical scope) ─────────
const blocks = [];
for (const m of shell.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
  blocks.push({ start: m.index, body: m[1] });
}
check('the Gold shell has multiple classic script blocks', blocks.length >= 3, `blocks=${blocks.length}`);

// ── 1. route policy: the three hops are doorless ──────────────────────────
const setScreenStart = shell.indexOf('async function setScreen(next){');
const setScreenEnd = shell.indexOf('function uiFocusMove', setScreenStart);
const setScreen = setScreenStart >= 0 && setScreenEnd > setScreenStart ? shell.slice(setScreenStart, setScreenEnd) : '';
check('the shipping shell declares setScreen', setScreen.length > 0);
check('setScreen commits the destination screen directly', /commitScreen\(next\);/.test(setScreen) && /focusScreen\(next\);/.test(setScreen));
check('setScreen never runs a Mechanical Door transaction', !/tr\.run\(|APEX_SCENE_TRANSITION\?\.run\(/.test(setScreen));
check('the R50K adapter (last writer of that region) encodes the same doorless setScreen',
  /async function setScreen\(next\)\{/.test(adapter) && !/async function setScreen\(next\)\{[\s\S]{0,1400}?tr\.run\(/.test(adapter));

const doorCalls = [...shell.matchAll(/name:'([a-z>-]+)'/g)].map((m) => m[1]).sort();
check('the Door only owns the Lucky Draw bay and boot',
  doorCalls.length === 2 && doorCalls[0] === 'home->lucky' && doorCalls[1] === 'lucky->home',
  doorCalls.join(','));
check('no Battle/Fighter/Mode door route exists in the shipping shell',
  !/name:'(?:fighter->battle|battle->fighter|home->mode|mode->fighter|fighter->home)'/.test(shell));
check('the adapter FORBIDS the generic screen door route and the retired battle routes',
  adapter.includes('name:`${screen}->${next}`')
  && adapter.includes("name:'fighter->battle'")
  && adapter.includes("name:'battle->fighter'"));
check('the shipping shell contains no door call outside the Lucky bay',
  !/name:`\$\{screen\}->\$\{next\}`/.test(shell));

// ── 2. Lucky Draw: ONE SFX seam ───────────────────────────────────────────
const defBlock = blocks.find((b) => /function uiSfx\(key\)\{/.test(b.body));
check('exactly one block defines the shell uiSfx helper', blocks.filter((b) => /function uiSfx\(key\)\{/.test(b.body)).length === 1);
check('the defining block publishes the ONE window seam',
  !!defBlock && /window\.apexShellSfx=uiSfx;/.test(defBlock.body));
check('the Lucky Draw bay announces through the window seam',
  shell.includes("window.apexShellSfx&&window.apexShellSfx('lucky.draw.enter_bay')"));
const bareOutside = blocks
  .filter((b) => b !== defBlock)
  .flatMap((b) => [...b.body.matchAll(/(?<![\w.])uiSfx\(/g)])
  .map((m) => m[0]);
check('no other script block calls the block-local uiSfx helper', bareOutside.length === 0,
  `calls=${bareOutside.length}`);
check('the Lucky Draw bay closes through the Door (open/close pair)', /name:'home->lucky'/.test(shell) && /name:'lucky->home'/.test(shell));

check('bottom-route press stays dark, lightly glows, and keeps its label visible',
  shell.includes('id="r59-bottom-route-press-law"')
  && shell.includes('.route:not(.is-locked):active{')
  && shell.includes('background:linear-gradient(180deg,rgba(34,35,38,.88),rgba(14,15,18,.94))!important')
  && shell.includes('box-shadow:inset 0 0 0 1px rgba(255,148,31,.24),0 0 16px rgba(255,148,31,.15)!important')
  && shell.includes('.route:not(.is-locked):active span{')
  && shell.includes('opacity:1!important;visibility:visible!important'));
check('R50K owns the same bottom-route press rule so rebuild cannot regress it',
  adapter.includes("'bottom-route press law'")
  && adapter.includes('r59-bottom-route-press-law'));

// ── 3. battle HUD seam guard + payload identity ──────────────────────────
check('the HUD guards the seam before setMode (bridge deletes it on unmount)',
  /if\(window\.APEX_GOLD_HUD\)window\.APEX_GOLD_HUD\.setMode\(/.test(hud));
const payloadMatch = shell.match(/<script id="battleHudPayload" type="text\/plain">([\s\S]*?)<\/script>/);
check('the shell embeds the battle HUD payload', !!payloadMatch);
if (payloadMatch) {
  const decoded = Buffer.from(payloadMatch[1].trim(), 'base64');
  check('the shipped payload is byte-identical to public/gold/battle-hud.html',
    decoded.equals(Buffer.from(hud, 'utf8')),
    `payload=${decoded.length} file=${Buffer.byteLength(hud)}`);
  const t = decoded.toString('utf8');
  check('payload: production battle avatar slot (owner feedback 1)', t.includes('apex-battle-avatar') && t.includes('has-production-avatar'));
  check('payload: weapon tier glow under the gun art (feedback 12)', t.includes('.wp-ico.has-tier') || t.includes('has-tier'));
  check('payload: held-skill press model (feedback 15)', t.includes('.skill.is-held') && t.includes('activeSkillPointers'));
  check('payload: ammo x/y markers (feedback 5)', t.includes('wp-cur') && t.includes('wp-max'));
  check('payload: enlarged weapon block (feedback 6/13)', /--wpIW:clamp\(108px/.test(t));
  const chrome = t.match(/#p1Side,#p2Side,#versusRail,#matchCenter\{[^}]*z-index:(\d+)/);
  const fx = t.match(/#globalFx\{[^}]*z-index:(\d+)/);
  const rupture = t.match(/#ruptureLayer\{[^}]*z-index:(\d+)/);
  check('payload: Critical/Heavy FX composited ABOVE the side/skill panels (feedback 2)',
    !!chrome && !!fx && !!rupture && Number(fx[1]) > Number(chrome[1]) && Number(rupture[1]) > Number(chrome[1]),
    `chrome=${chrome && chrome[1]} fx=${fx && fx[1]} rupture=${rupture && rupture[1]}`);
  check('payload: both HUD families exist (feedback 10)',
    (t.match(/data-mode="1p"/g) || []).length > 0 && (t.match(/data-mode="2p"/g) || []).length > 0);
}

// ── 4. build pipeline guards ─────────────────────────────────────────────
check('prune keeps the fail-closed shipped-HTML reference guard',
  prune.includes('dist pruning removed files referenced by shipped HTML')
  && prune.includes('function shippedHtmlDocs')
  && prune.includes('Inline <script>/<style> bodies'));
check('the audit derives shell-loaded runtimes into the current graph',
  /shellRuntimeScriptPaths/.test(audit));
check('the audit keeps the UI SFX runtime authority',
  /UI_SFX_RUNTIMES/.test(audit));

console.log(['R51 SCENE ROUTE POLICY GATE (owner law: Door = boot + Lucky only)', ...notes].join('\n'));
if (failures.length) {
  console.error('\n' + failures.join('\n'));
  console.error(`\nRESULT: FAIL (${failures.length})`);
  process.exit(1);
}
console.log(`\nRESULT: PASS (${notes.length} checks)`);
