import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const hud = read('public/gold/battle-hud.html');
const bridge = read('public/game/gold/goldProductBridge.js');
const shell = read('public/gold/shell.html');
const generator = read('tools/buildGoldCutover.mjs');
const adapter = read('tools/goldBattleHudR48b.mjs');

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
