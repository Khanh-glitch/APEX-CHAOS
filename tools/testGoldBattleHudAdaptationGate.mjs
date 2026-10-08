import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const hud = read('public/gold/battle-hud.html');
const bridge = read('public/game/gold/goldProductBridge.js');
const shell = read('public/gold/shell.html');
const generator = read('tools/buildGoldCutover.mjs');
const adapter = read('tools/goldBattleHudR48b.mjs');
const r55Adapter = read('tools/goldBattleHudR55.mjs');

const pass = [];
const fail = [];
function check(name, ok, detail = '') {
  (ok ? pass : fail).push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
}

function webpDimensions(p) {
  const b = fs.readFileSync(p);
  if (b.toString('ascii',0,4) !== 'RIFF' || b.toString('ascii',8,12) !== 'WEBP') return null;
  let off = 12;
  while (off + 8 <= b.length) {
    const type = b.toString('ascii',off,off+4);
    const len = b.readUInt32LE(off+4);
    const d = off + 8;
    if (type === 'VP8X' && d + 10 <= b.length) {
      return {w:1+b[d+4]+(b[d+5]<<8)+(b[d+6]<<16),h:1+b[d+7]+(b[d+8]<<8)+(b[d+9]<<16)};
    }
    if (type === 'VP8L' && d + 5 <= b.length && b[d] === 0x2f) {
      return {w:1+(((b[d+2]&0x3f)<<8)|b[d+1]),h:1+(((b[d+4]&0x0f)<<10)|(b[d+3]<<2)|((b[d+2]&0xc0)>>6))};
    }
    if (type === 'VP8 ' && d + 10 <= b.length) {
      for (let i=d;i<Math.min(d+20,b.length-6);i++) {
        if (b[i]===0x9d && b[i+1]===0x01 && b[i+2]===0x2a) {
          return {w:b.readUInt16LE(i+3)&0x3fff,h:b.readUInt16LE(i+5)&0x3fff};
        }
      }
    }
    off = d + len + (len & 1);
  }
  return null;
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

check('battle HUD renders the full production skill-state language',
  hud.includes("u.el.dataset.kind=a.kind||'cooldown'") &&
  hud.includes("txt='PRESS-CAST'") &&
  hud.includes("txt='ACTIVE '+activeSecs+'s'") &&
  hud.includes("txt='READY AGAIN'") &&
  hud.includes("txt='COOLDOWN '+secs+'s'") &&
  hud.includes("'READY · '+a.charges+'/'+a.max") &&
  hud.includes("prevSt==='cd'&&st==='ready'") &&
  hud.includes('readyPop(u,i,k)'));

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
check('Heavy shake moves the whole HUD composition, not only the victim panel',
  hud.slice(hud.indexOf('function fxHeavy'),hud.indexOf('function fxThunder')).includes('R.hud.animate('));
check('Critical/Heavy flash remains a global compositor layer',
  hud.includes('class="gfx-flash"') && hud.includes('#globalFx') && hud.includes("flash('crit',v") && hud.includes("flash('heavy',v"));


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

check('R60 Heavy reuses one sanitized DOM snapshot for independent Voronoi shards',
  hud.includes('const shardTemplate=makePanelSnapshot(panel.v,w,h);') &&
  hud.includes('const clone=shardTemplate.cloneNode(true);piece.appendChild(clone);') &&
  !hud.includes('const clone=makePanelSnapshot(panel.v,w,h);piece.appendChild(clone);') &&
  r55Adapter.includes("'Heavy shards reuse sanitized template'"));
check('R63 solo portrait iPad skill states use existing runtime authority',
 hud.includes('R63 skill readability: emphasize actual Gold runtime') &&
 ['cast','active','cd','ready'].every(state => hud.includes('#p1Side .skill[data-state="'+state+'"]')) &&
 hud.includes('const st=now<a.castUntil?\'cast\':activeRemaining>0?\'active\':a.charges>0?\'ready\':\'cd\''));
check('R62 simultaneous Crit/Heavy preserves all shards but mounts in one batch',
  hud.includes('const shardBatch=document.createDocumentFragment(),shardAnimations=[];') &&
  hud.includes('shardBatch.appendChild(piece);') &&
  hud.includes('group.appendChild(shardBatch);') &&
  hud.includes('shardAnimations.forEach(start=>start());') &&
  !hud.includes('piece.appendChild(clone);group.appendChild(piece);'));
check('R62 landscape/desk side backdrops follow real hero identity',
  hud.includes('hero-aware backdrop: portrait source is game-authoritative') &&
  hud.includes('art.classList.add(\'apex-hero-watermark\')') &&
  hud.includes("image.getAttribute('src')!==avatar") &&
  r55Adapter.includes("'hero-aware panel watermark projection'"));
check('R62 tablet BOT portrait dock keeps arena and Local untouched',
  hud.includes('R62 tablet portrait BOT: hero-control dock') &&
  hud.includes('grid-template-areas:"id id id" "s1 wp s2"') &&
  hud.includes('#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .skills{display:contents}') &&
  !hud.includes('#hud[data-layout="port"][data-size="tablet"][data-mode="2p"] #p1Side .skills{display:contents}'));
check('R61 compact Local does not reduce arena for panel fit',
 hud.includes('R61 compact Local: keep arena sizing') &&
 !hud.includes('--zoneMin:clamp(158px,24cqh,174px)') &&
 !hud.includes('R60 BOT landscape tablet:'));
check('R59/CP6 Frost keeps accepted scale with native-facing and visual ground authority',
  shell.includes('frost:{scale:1.53,x:0,nativeFacing:-1,groundLine:1.025}')
  && shell.includes('const face=nativeFacing*desiredSideFacing')
  && shell.includes('function visualBottomRatio(img)')
  && shell.includes('function anchoredHeroY(img,p)')
  && shell.includes("applyHeroPresentation(img,target.renderId,target.id,target.player)")
  && !shell.includes('frost:{scale:1.53,x:0,y:16}'));

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
check('Local tablet landscape gets wider side allocation and a taller weapon row',
  hud.includes('#hud[data-layout="land"][data-size="tablet"][data-mode="2p"]{--sideMin:clamp(236px,22cqw,260px);--localHpW:clamp(320px,36cqw,400px)}')
  && hud.includes('#hud[data-layout="land"][data-size="tablet"][data-mode="2p"] .side{--wpH:clamp(96px,14cqh,116px)}'));
check('Local tablet HP bar is shortened symmetrically without moving the full rail',
  hud.includes('#hud[data-layout="land"][data-size="tablet"][data-mode="2p"] #p1Rail .vr-bar,')
  && hud.includes('width:min(100%,var(--localHpW));justify-self:end')
  && hud.includes('#hud[data-layout="land"][data-size="tablet"][data-mode="2p"] #p2Rail .vr-bar,')
  && hud.includes('width:min(100%,var(--localHpW));justify-self:start'));
check('Local portrait tablet reserves a larger control zone and weapon row',
  hud.includes('#hud[data-layout="port"][data-size="tablet"][data-mode="2p"]{--zoneMin:clamp(198px,18cqh,216px)}')
  && hud.includes('#hud[data-layout="port"][data-size="tablet"][data-mode="2p"] .side{--wpH:clamp(92px,8.8cqh,112px)}'));
check('Local tablet allocation cannot leak into BOT geometry',
  !hud.includes('[data-size="tablet"][data-mode="1p"]{--sideMin:clamp(236px,22cqw,260px)')
  && !hud.includes('[data-size="tablet"][data-mode="1p"] .side{--wpH:clamp(96px,14cqh,116px)')
  && !hud.includes('[data-size="tablet"][data-mode="1p"]{--zoneMin:clamp(198px,18cqh,216px)'));
check('Local tablet fix does not use whole-HUD transform scaling',
  !/data-size="tablet"\]\[data-mode="2p"\][^{]*\{[^}]*transform\s*:\s*scale/i.test(hud));
check('BOT desk and landscape reserve weapon rows inside their own 1P grids',
  hud.includes('#hud[data-layout="desk"][data-mode="1p"] .side{--botWpH:clamp(72px,11cqh,104px);grid-template-rows:auto minmax(0,1fr) minmax(0,var(--botWpH))}')
  && hud.includes('#hud[data-layout="land"][data-mode="1p"] #p1Side{--botWpH:clamp(56px,12cqh,82px);grid-template-rows:auto minmax(0,1fr) minmax(0,var(--botWpH))}')
  && hud.includes('#hud[data-layout="land"][data-mode="1p"] #p2Side{--botWpH:clamp(52px,11cqh,76px);grid-template-rows:auto auto minmax(0,1fr) minmax(0,var(--botWpH))}'));
check('BOT weapon containment does not import Local geometry',
  hud.includes('#hud[data-layout="desk"][data-mode="1p"] .weapon,')
  && hud.includes('#hud[data-layout="land"][data-mode="1p"] .weapon{height:100%;max-height:var(--botWpH);align-self:end;overflow:visible;box-sizing:border-box}')
  && !hud.includes('#hud[data-layout="land"][data-mode="1p"] .weapon{position:relative;align-items:center;min-height:0;height:100%;max-height:var(--wpH)'));
check('portrait tablet BOT expands only the authored 1P strip/control allocation',
  hud.includes('#hud[data-layout="port"][data-size="tablet"][data-mode="1p"]{--stripH:64px;--p1Min:240px;')
  && hud.includes('#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p2Side{--porW:42px;--porH:42px;--thW:38px;--wpIW:52px;--amF:15px}')
  && hud.includes('#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p2Side .skills{height:50px}'));
check('C2 does not zoom skills or alter Local weapon-row authority',
  !/R59 C2[\s\S]*?transform\s*:\s*scale/.test(hud)
  && hud.includes('#hud[data-layout="land"][data-mode="2p"] .side{--wpH:')
  && hud.includes('#hud[data-layout="port"][data-mode="2p"] .side{--wpH:'));
const coreSix = ['newbot','hunter','crystala','magnet','frost','mirror'];
const coreSkillDims = coreSix.flatMap((hero) => ['a1','a2'].map((slot) => {
  const d = webpDimensions('public/assets/gold-ui/heroes/'+hero+'/skill_'+slot+'.webp');
  return {hero,slot,d};
}));
check('Core Six A1/A2 source media is square or near-square before CSS',
  coreSkillDims.every(({d}) => d && d.w > 0 && d.h > 0 && Math.abs(d.w/d.h - 1) <= 0.05),
  coreSkillDims.map(({hero,slot,d}) => hero+':'+slot+'='+(d?d.w+'x'+d.h:'missing')).join(', '));
check('BOT landscape tablet uses a square media well without changing tile geometry',
  hud.includes('#hud[data-layout="land"][data-size="tablet"][data-mode="1p"] .skill .sk-art{width:var(--artW);height:var(--artW);aspect-ratio:1/1;align-self:center;justify-self:start}')
  && hud.includes('#hud[data-layout="land"][data-size="tablet"][data-mode="1p"] .sk-art>.apex-skill-icon{width:100%;height:100%;object-fit:contain;object-position:center}'));
check('C3 is tablet-BOT scoped and does not globally square Local skill wells',
  !hud.includes('#hud[data-layout="land"][data-size="tablet"][data-mode="2p"] .skill .sk-art{width:var(--artW);height:var(--artW);aspect-ratio:1/1')
  && !hud.includes('#hud[data-layout="land"] .skill .sk-art{width:var(--artW);height:var(--artW);aspect-ratio:1/1'));
check('R55 adapter preserves the donor 1P family',
  !r55Adapter.includes('opens1p')
  && !r55Adapter.includes('delete the obsolete one-player panel family')
  && r55Adapter.includes('two different authored Gold compositions')
  && generator.includes("import { adaptGoldBattleHudR55 } from './goldBattleHudR55.mjs';")
  && generator.includes('out = adaptGoldBattleHudR55(out);'));

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
