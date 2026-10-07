import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const hud = read('public/gold/battle-hud.html');
const bridge = read('public/game/gold/goldProductBridge.js');
const shell = read('public/gold/shell.html');
const generator = read('tools/buildGoldCutover.mjs');
const adapter = read('tools/goldBattleHudR48b.mjs');
const r55 = read('tools/goldBattleHudR55.mjs');

const pass = [];
const fail = [];
function check(name, ok, detail = '') {
  (ok ? pass : fail).push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
}

check('weapon projection exposes real Arsenal asset URL',
  bridge.includes("const meta = av && typeof av.weaponMeta === 'function' ? av.weaponMeta(weaponId) : null;") &&
  bridge.includes("asset = '/assets/arsenal/' + String(meta.file).replace(/^\\/+/, '');"));

check('weapon projection distinguishes ammo vs non-ammo weapons',
  bridge.includes('const usesAmmo = shots > 0;') &&
  bridge.includes("mag: usesAmmo ? shots : 0") &&
  bridge.includes("usesAmmo,"));

// R51: the UNARMED fallback is a real object with extra production fields
// (tier/tierColor/reloading/alt), so the old exact-literal assertion was
// measuring the field list instead of the law. The law is: an unarmed fighter
// never reports a magazine, and the HUD renders a real `x/y` only for weapons
// that actually consume ammo.
const unarmedLiteral = bridge.match(/\|\|\s*\{ id: 'UNARMED',([^}]*)\}/);
const unarmedFields = unarmedLiteral ? unarmedLiteral[1] : '';
check('unarmed HUD truth is not a fake one-round magazine',
  !!unarmedLiteral
  && /name: 'UNARMED'/.test(unarmedFields)
  && /usesAmmo: false/.test(unarmedFields)
  && /(^|[^\w])mag: 0,/.test(unarmedFields)
  && /(^|[^\w])ammo: 0,/.test(unarmedFields)
  && /asset: ''/.test(unarmedFields)
  && bridge.includes('const usesAmmo = shots > 0;')
  && bridge.includes('mag: usesAmmo ? shots : 0')
  && bridge.includes('ammo: usesAmmo ? Math.max(0, shots - fired) : 0')
  && /am\+'\/'\+w\.mag/.test(hud)
  && /usesAmmo\?am:'—'/.test(hud),
  unarmedFields ? unarmedFields.trim().slice(0, 120) : 'UNARMED fallback missing');

check('charge skills expose recharge progress while one charge remains playable',
  bridge.includes("nextIn = charges < maxCharges ? Math.max(0, Number(s.rechargeLeft) || 0) : 0;") &&
  !bridge.includes("nextIn = charges > 0 ? 0 : (Number(s.rechargeLeft) || 0);"));

check('skill projection carries semantic kind/duration/icon/description',
  bridge.includes('function heroSkillMeta(heroId, slot)') &&
  bridge.includes('kind,') &&
  bridge.includes('duration: meta.duration') &&
  bridge.includes('icon: meta.icon') &&
  bridge.includes('desc: skillSemantic('));

check('skill copy maps Core Six A1/A2 identity instead of generic A1/A2 labels',
  ['WEAPON DASH','VIRTUAL ARMOR','TRAP DEPLOY','DASH / STRIKE','MAGNETIC ATTRACTION','MAGNETIC REPEL','FROST BREATH','FROST RUSH','MIRROR ARSENAL','MIRROR EXCHANGE']
    .every((t) => bridge.includes(t)));

check('Pick preview and live HUD share the same bridge skill display mapping',
  bridge.includes('BRIDGE.skillDisplay = function skillDisplay')
  && shell.includes('function resolvedSkillCopy(id)')
  && shell.includes("typeof g.skillDisplay==='function'"));

check('battle HUD replaces donor weapon glyph with production image when available',
  hud.includes("img.className='apex-weapon-asset'") &&
  hud.includes("img.src=w.asset") &&
  hud.includes(".wp-ico>.apex-weapon-asset"));

check('battle HUD replaces donor skill glyph with production skill icon',
  hud.includes("img.className='apex-skill-icon'") &&
  hud.includes("u.art.classList.add('has-production-icon')") &&
  hud.includes('.sk-art.has-production-icon>svg{display:none}'));

check('battle HUD renders cooldown, charge/recharge and active-duration semantics separately',
  hud.includes("u.el.dataset.kind=a.kind||'cooldown'") &&
  hud.includes("txt='ACTIVE '+activeSecs+'s'") &&
  hud.includes("a.charges+'/'+a.max+' · '+secs+'s'"));

check('skill state is visually legible without zooming or reflowing tiles',
  hud.includes('R59 SKILL-STATE LEGIBILITY')
  && hud.includes('#hud .skill[data-state="cd"] .sk-mask')
  && hud.includes('#hud .skill[data-state="active"] .sk-state')
  && hud.includes('#hud .skill[data-state="active"] .sk-bar')
  && hud.includes('@keyframes apexSkillActivePulse')
  && !/skill\[data-state="(?:cd|active)"\][^}]*transform:scale/.test(hud));

check('donor no longer auto-completes production cooldown/charge state',
  hud.includes('Production projection is the ONLY cooldown/charge authority.') &&
  !hud.includes("if(a.next&&now>=a.next){a.charges++;"));

check('hero accent reaches rails, skill panels and HUD tokens',
  hud.includes('HEROES[i].accent=s.accent;ACC[i]=s.accent;') &&
  hud.includes("R.stage.style.setProperty('--'+key,s.accent)") &&
  hud.includes("R.side[i].root.style.setProperty('--acc',s.accent)") &&
  hud.includes("R.rail[i].root.style.setProperty('--acc',s.accent)"));

// R51: the FX compositor law changed with the owner's "Crit/Heavy must cover the
// FULL panel, including the skill slots" feedback. The shipping HUD composites
// arena(1) < HUD chrome(30) < globalFx(35) < ruptureLayer(36) with every FX
// layer pointer-events:none, so this gate asserts the ORDER (numbers, not a
// frozen literal) plus the input-transparency that keeps skills tappable.
function zIndexFor(selector) {
  const re = new RegExp(selector.replace(/[#[\]()*+?^$|\\]/g, '\\$&') + '\\{([^}]*)\\}', 'g');
  let m, found = NaN;
  while ((m = re.exec(hud))) {
    const z = m[1].match(/z-index:\s*(-?\d+)/);
    if (z) found = Number(z[1]);
  }
  return found;
}
const zArena = zIndexFor('#arenaZone');
const zChrome = zIndexFor('#p1Side,#p2Side,#versusRail,#matchCenter');
const zFx = zIndexFor('#globalFx');
const zRupture = zIndexFor('#ruptureLayer');
check('critical/heavy FX are explicitly composited arena < HUD chrome < FX < rupture',
  Number.isFinite(zArena) && Number.isFinite(zChrome) && Number.isFinite(zFx) && Number.isFinite(zRupture)
  && zArena < zChrome && zChrome < zFx && zFx <= zRupture,
  `arena=${zArena} chrome=${zChrome} fx=${zFx} rupture=${zRupture}`);
check('critical/heavy FX cover the full panel without stealing input',
  hud.includes('if(R.fx&&R.hud&&R.fx.parentElement!==R.hud)R.hud.appendChild(R.fx);')
  && /#copyLayer,#globalFx\{position:absolute;inset:0;pointer-events:none/.test(hud)
  && /#globalFx\{z-index:\d+;overflow:visible\}/.test(hud)
  && /#ruptureLayer\{[^}]*pointer-events:none/.test(hud));

check('generator owns R48B through deterministic adapter',
  generator.includes("import { adaptGoldBattleHudR48b } from './goldBattleHudR48b.mjs';") &&
  generator.includes('out = adaptGoldBattleHudR48b(out);') &&
  adapter.includes('export function adaptGoldBattleHudR48b'));

const payload = shell.match(/<script id="battleHudPayload" type="text\/plain">([\s\S]*?)<\/script>/);
let decoded = '';
try { decoded = payload ? Buffer.from(payload[1], 'base64').toString('utf8') : ''; } catch (_) {}
check('shipping shell embeds the exact shipping Battle HUD bytes',
  !!payload && decoded === hud,
  payload ? ('decoded=' + decoded.length + ' hud=' + hud.length) : 'payload missing');

check('R49/E1 Frost keeps one hero-level orientation/scale authority across both sides',
  shell.includes('frost:{scale:1.53,x:0,y:16}')
  && shell.includes("const face=Number.isFinite(p.face)?p.face:(player==='p2'?-1:1)")
  && shell.includes("applyHeroPresentation(img,target.renderId,target.id,target.player)")
  && !/frost:\{[^}]*face:/.test(shell));

check('R49 Mirror remains opponent-derived with no static selected-large placeholder',
  shell.includes('function mirrorOpponentHero(player)')
  && shell.includes("const renderId=id==='mirror'?mirrorSource:id;")
  && !shell.includes('mirror-world-runtime-opponent-ghost.svg'));

check('R49 battle reveal awaits production READY before exposing Gold HUD',
  shell.includes('async function setBattleLive()')
  && shell.includes('const liveReady=await setBattleLive();')
  && shell.includes('if(liveReady!==true)'));

// ── Owner law (R52): a Critical/Heavy hit affects the FULL panel ───────────
// The victim panel is cloned whole, but the clone is screen-blended, which is
// invisible over the ability tiles (they paint their own near-black background),
// so the two skill slots read as excluded from the hit. The impact therefore
// also stamps the tiles with the source accent for the burst window.
const r50c = read('tools/goldBattleHudR50c.mjs');
const cutover = read('tools/buildGoldCutover.mjs');
check('the impact rule reaches the ability tiles on EVERY layout',
  hud.includes('#hud .side.is-panel-hit .skill{background:linear-gradient(90deg,color-mix(in srgb,var(--hitAcc,#ff8a1e) 20%,#161b20),#0d1013)}')
  && hud.includes('#hud .side.is-panel-hit .skill::after{border-color:color-mix(in srgb,var(--hitAcc,#ff8a1e) 72%,transparent)}')
  && hud.includes('#hud .side.is-panel-hit .sk-art{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--hitAcc,#ff8a1e) 46%,transparent)}'));
check('the impact rule is written above the layout sections (id specificity)',
  /#hud \.side\.is-panel-hit/.test(hud) && !/(^|\n)\.side\.is-panel-hit \.skill\{/.test(hud));
check('the panel-hit window is driven by the transaction accent',
  hud.includes('function panelHitWindow(v,accent){')
  && hud.includes("root.style.setProperty('--hitAcc',accent||'#ff8a1e');root.classList.add('is-panel-hit');"));
check('the heavy burst passes its own accent into the panel law',
  hud.includes('const panel=panelRupture(v,token,impactAccent);R.ruptures[v]=panel;')
  && hud.includes('function panelRupture(v,token,accent){'));
check('the panel-hit window always ends (no stuck accent on the tiles)',
  hud.includes("R.hitTimers[v]=setTimeout(()=>root.classList.remove('is-panel-hit'),RM.matches?120:1120);")
  && hud.includes('hitTimers:[0,0]'));
check('reduced motion still collapses the panel-hit window',
  /RM\.matches\?120:1120/.test(hud));
check('the generator adapter owns the change (never hand-edited output)',
  r50c.includes('id: \'HUD-')
  || r50c.includes("'panel-wide impact law'")
  || r50c.includes('panelHitWindow(v,accent)'));
check('the R50C adapter still asserts the panel-hit invariant',
  r50c.includes("'is-panel-hit'") && r50c.includes("'--hitAcc'"));

// OWNER LAW (2026-10-07): a key badge is a key cap — it must fit its own text
// in BOTH directions (mirrored Local P2 renders direction:rtl) and must never
// let its clip-path eat a glyph (the P2 A2 badge painted as "UM 2").
check('key badges fit their own text (no display tracking, never clipped)',
  /\.sk-key\{letter-spacing:\.02em;white-space:nowrap;width:max-content\}/.test(hud));
check('the key-badge law is owned by the generator, never hand-edited',
  cutover.includes("id: 'HUD-H28b'"));

// R58 correction: BOT has its OWN canonical Gold composition.
const donor = read('docs/gold-ui/current/donors/battle-hud/index.html');
check('BOT keeps Gold portrait enemy-strip / arena / big-thumb-zone geometry',
  hud.includes('--stripH:48px;--p1Min:200px')
  && hud.includes('grid-template-areas:"id wp" "sk sk"')
  && hud.includes('grid-template-areas:"id wp sk"')
  && donor.includes('--stripH:48px;--p1Min:200px'));
check('BOT keeps Gold landscape asymmetric territories',
  hud.includes('--crW:156px')
  && hud.includes('#hud[data-layout="land"][data-mode="1p"] #p2Side{grid-template-rows:auto auto minmax(0,1fr) auto;'));
check('BOT keeps compact Gold CPU threat tiles, not Local-sized abilities',
  hud.includes('#hud[data-layout="desk"][data-mode="1p"] #p2Side .skills{align-self:start;grid-auto-rows:58px;margin-top:6px}')
  && hud.includes('#hud[data-layout="port"][data-mode="1p"] #p2Side .skill{grid-template-columns:var(--thW) auto;')
  && !hud.includes('R58 BOT = Gold HUD, not a second layout family'));
check('BOT production integration fits assets inside authored slots',
  hud.includes('#hud[data-mode="1p"] .wp-ico>.apex-weapon-asset,')
  && hud.includes('#hud[data-mode="1p"] .weapon{min-height:0;max-height:100%}'));
check('Local weapon-row correction is mode-scoped and cannot overwrite BOT',
  hud.includes('#hud[data-layout="land"][data-mode="2p"] .side{--wpH:')
  && hud.includes('#hud[data-layout="port"][data-mode="2p"] .side{--wpH:')
  && !hud.includes('#hud[data-layout="land"] .side{--wpH:')
  && !hud.includes('#hud[data-layout="port"] .side{--wpH:'));
check('R55 adapter preserves the donor 1P family',
  !r55.includes('opens1p')
  && !r55.includes('delete the obsolete one-player panel family')
  && r55.includes('two different authored Gold compositions'));

check('battle mode is live production truth, not a one-shot handoff',
  bridge.includes("mode: state && state.battleMode === 'BOT' ? '1p' : '2p'")
  && hud.includes("if(st.mode==='1p'||st.mode==='2p')seam.setMode(st.mode);")
  && r55.includes("'per-frame production mode authority'"));

check('tablet Local reallocates space toward weapon instead of whole-HUD scaling',
  hud.includes('--wpH:clamp(96px,15.5cqh,120px)')
  && hud.includes('--wpIW:clamp(112px,16cqh,140px)')
  && hud.includes('width:min(100%,430px)')
  && !hud.includes('transform:scale(.'));

check('tablet BOT keeps Gold geometry while skill media uses a square aspect well',
  hud.includes('#hud[data-layout="land"][data-size="tablet"][data-mode="1p"] .skill .sk-art')
  && hud.includes('width:var(--artW);height:var(--artW);aspect-ratio:1/1')
  && hud.includes('object-fit:contain'));

check('portrait tablet BOT grows its Gold enemy strip instead of clipping production media',
  hud.includes('--stripH:64px;--p1Min:240px')
  && hud.includes('--porW:42px;--porH:42px;--thW:38px;--wpIW:52px'));

console.log('GOLD BATTLE HUD ADAPTATION GATE (R49D + R48B production truth)');
for (const line of pass) console.log(line);
if (fail.length) {
  console.error('');
  for (const line of fail) console.error(line);
  console.error('');
  console.error('RESULT: FAIL (' + fail.length + ')');
  process.exit(1);
}
console.log('');
console.log('RESULT: PASS (' + pass.length + ' checks)');
