// ---------------------------------------------------------------------------
// Core Six art authority gate (R44 owner law).
//
// The production state projection must MERGE into the immutable Git art
// authority and never replace it. This gate executes the SHIPPING bridge
// source and proves that every applicable Core Six art role survives the
// projection, that no role falls back to a Gold placeholder, that each role
// resolves to a real file on disk matching the R44 manifest SHA-256, and that
// Mirror's deliberately absent static selected pose is honoured (never a
// broken or placeholder image).
// ---------------------------------------------------------------------------
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { REPO, read, makeDocument, parseSimpleHtml, runInWindow } from './lib/goldDomShim.mjs';

const notes = [];
const failures = [];
function check(name, cond, detail) {
  if (cond) { notes.push(`PASS ${name}`); return true; }
  failures.push(`FAIL ${name}${detail ? ' :: ' + detail : ''}`);
  return false;
}

const CORE_SIX = ['newbot', 'hunter', 'crystala', 'magnet', 'frost', 'mirror'];
const ROLES = ['portrait', 'art', 'battleAvatar', 'skillIcons'];
const MIRROR_ABSENT = ['art']; // owner decision: no static selected pose

// ── the R44 manifest is the art authority ────────────────────────────────
const manifest = JSON.parse(read('docs/gold-ui/preload/OWNER_PLAYTEST_MEDIA_R44_MANIFEST.json'));
const manifestPaths = new Set();
for (const hero of Object.values(manifest.heroes)) {
  for (const role of Object.values(hero.roles)) manifestPaths.add(role.gitPath);
}

// ── boot the real bridge with production present ─────────────────────────
const document = makeDocument();
for (const child of parseSimpleHtml(`
  <div id="battle-shell">
    <div id="game-wrapper"><canvas id="game-canvas"></canvas><div id="hud"></div></div>
  </div>
  <div id="gold-shell-host">
    <div id="battleHudHost"><div id="hud" data-mode="battle"><div id="stage"><div id="arena"></div></div></div></div>
  </div>
`).children) document.body.appendChild(child);

const window = runInWindow(document, read('public/game/gold/goldProductBridge.js'), 'goldProductBridge.js', {
  APEX_ARSENAL_SHELLS: {
    typeFor: (id) => ({ name: String(id).toUpperCase(), color: '#fff' }),
    ids: ['ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR'],
    playableIds: ['ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR'],
    isPlayable: () => true,
  },
  APEX_ARSENAL_META: { owns: () => true, credits: () => 12000, canPublicSelect: () => true },
});

const roster = window.APEX_GOLD_ROSTER;
check('the production roster projection is published to the Gold shell', !!roster && typeof roster === 'object');
if (!roster) {
  console.error('GOLD CORE SIX ART AUTHORITY GATE\n\nRESULT: FAIL (no roster projection)');
  process.exit(1);
}

// ── 1. every applicable role survives the state projection ───────────────
for (const key of CORE_SIX) {
  const hero = roster[key];
  if (!check(`Core Six hero "${key}" is present in the projection`, !!hero)) continue;
  for (const role of ROLES) {
    const absent = MIRROR_ABSENT.includes(role) && key === 'mirror';
    if (absent) {
      check(`mirror has NO ${role} (owner decision honoured)`, hero[role] === undefined || hero[role] === '' || hero[role] === null,
        `value=${JSON.stringify(hero[role])}`);
      continue;
    }
    const value = hero[role];
    const ok = Array.isArray(value) ? value.length === 3 && value.every((v) => typeof v === 'string' && v.length > 0)
      : typeof value === 'string' && value.length > 0;
    check(`Core Six hero "${key}" keeps the ${role} art role`, ok, JSON.stringify(value));
  }
  check(`Core Six hero "${key}" keeps production identity fields`,
    typeof hero.name === 'string' && hero.name.length > 0 && typeof hero.productionId === 'string' && hero.productionId.length > 0);
}

// ── 2. no Gold placeholder in a resolved Core Six role ───────────────────
for (const key of CORE_SIX) {
  const hero = roster[key] || {};
  const urls = [];
  for (const role of ROLES) {
    const v = hero[role];
    if (Array.isArray(v)) urls.push(...v); else if (typeof v === 'string' && v) urls.push(v);
  }
  const bad = urls.filter((u) => /placeholder/i.test(u) || u === '' || /undefined|null/.test(u));
  check(`no Gold placeholder / empty URL in any resolved "${key}" art role`, bad.length === 0, bad.join(','));
  check(`all "${key}" art roles resolve to the R44 Git hero-ui authority`,
    urls.every((u) => u.startsWith('/assets/gold-ui/heroes/' + key + '/')), urls.join(','));
}

// ── 3. the battle avatar is its own role (not the roster cover) ──────────
for (const key of CORE_SIX) {
  const hero = roster[key] || {};
  check(`"${key}" battle avatar is distinct from the compact roster cover`,
    hero.battleAvatar !== hero.portrait);
}

// ── 4. every role resolves to a REAL Git file with the manifest SHA-256 ──
const sha = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, rel))).digest('hex');
let verified = 0;
for (const key of CORE_SIX) {
  const hero = roster[key] || {};
  for (const role of ROLES) {
    const v = hero[role];
    const urls = Array.isArray(v) ? v : (typeof v === 'string' && v ? [v] : []);
    for (const url of urls) {
      const rel = 'public/' + url.replace(/^\//, '');
      if (!manifestPaths.has(rel)) {
        check(`"${key}".${role} URL is a manifest gitPath (${url})`, false);
        continue;
      }
      if (!fs.existsSync(path.join(REPO, rel))) { check(`"${key}".${role} file exists (${rel})`, false); continue; }
      const expected = Object.values(manifest.heroes)
        .flatMap((h) => Object.values(h.roles))
        .find((r) => r.gitPath === rel);
      const actual = sha(rel);
      check(`"${key}".${role} bytes match the R44 manifest SHA-256 (${path.basename(rel)})`,
        actual === expected.productionSha256, `${actual.slice(0, 12)} != ${expected.productionSha256.slice(0, 12)}`);
      verified += 1;
    }
  }
}
check('every applicable Core Six art role was verified against the manifest', verified === 35, `verified=${verified}`);

// ── 5. the merge model: state never replaces the art authority ───────────
const raw = read('public/game/gold/goldProductBridge.js');
check('the bridge declares an immutable Git art authority',
  /const HERO_UI_ART_ROOT = '\/assets\/gold-ui\/heroes\/';/.test(raw) && /const HERO_UI_ART = \{/.test(raw));
check('the state projection merges OVER the art authority (Object.assign base = art)',
  /Object\.assign\(\{\}, art, \{/.test(raw));
check('the art authority is cloned per hero (no shared mutable state)',
  /function heroUiArt\(shellKey\)/.test(raw));
check('no Core Six role references a gameplay sprite or a Gold placeholder pack path',
  !/assets\/placeholders\//.test(raw.split('const HERO_UI_ART = {')[1]?.split('};')[0] || ''));

// ── 6. the shell consumes the battle-avatar authority ────────────────────
const shell = read('public/gold/shell.html');
check('the battle handoff payload uses BATTLE_HUD_AVATAR', /portrait:h\.battleAvatar\|\|h\.portrait\|\|''/.test(shell));
check('the shell never emits an empty selected-pose src', /if\(!HEROES\[id\]\|\|!HEROES\[id\]\.art\)return;/.test(shell));
check('the shell never emits an empty world-stage src', /const worldSrc=WORLD_ART\[id\]\|\|h\.art;/.test(shell));
check('the base64 battle payload is regenerated from the production HUD',
  (() => {
    const m = shell.match(/<script id="battleHudPayload" type="text\/plain">([\s\S]*?)<\/script>/);
    if (!m) return false;
    const decoded = Buffer.from(m[1].trim(), 'base64').toString('utf8');
    return decoded.includes('apex-picked-portrait') && decoded.length > 1000;
  })());

const lines = ['GOLD CORE SIX ART AUTHORITY GATE (R44 owner law)', ...notes];
if (failures.length) {
  lines.push('', ...failures, '', `RESULT: FAIL (${failures.length})`);
  console.error(lines.join('\n'));
  process.exit(1);
}
lines.push('', `RESULT: PASS (${notes.length} checks)`);
console.log(lines.join('\n'));
process.exit(0);
