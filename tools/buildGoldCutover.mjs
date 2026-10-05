#!/usr/bin/env node
// ---------------------------------------------------------------------------
// APEX CHAOS — Gold product cutover generator (canonical-preserving).
//
// Mechanically transforms the canonical Gold source pack
// (docs/gold-ui/current, owner authority, SHA-pinned) into the production
// shipping tree public/gold/. This is a SOURCE-PRESERVING transformation:
// canonical DOM/CSS/JS choreography is copied through; the only edits are the
// documented production patches listed in PATCH LAW below. The canonical
// sources remain the authority; this generator is the repeatable provenance
// path required by CANONICAL_CUTOVER_STRATEGY_RELOCK_2026-10-05 §11.
//
// PATCH LAW (every patch is asserted to match exactly once; a canonical drift
// fails the build loudly instead of silently producing a wrong surface):
//   HUD  — remove the LAB/demo simulator harness (preset scaler, #pbar, #lab,
//          demo input keys, demo arena sim loop, fake best-of-three reset);
//          replace the demo frame loop with the production pump seam; bind the
//          handoff bridge mode setter to the seam.
//   LUCKY— localize external font/CDN dependencies; remove the LAB preview
//          tooling; force the real-viewport fit path; bind draw/economy truth
//          to the production meta runtime.
//   SHELL— keep the embedded battle payload mechanism (byte-structure), but
//          embed the production-bridged HUD; mount the HUD in the main
//          document (canonical boundary relaxed ONLY so the live arena canvas
//          can occupy the authored arena slot, per relock §6); route the Lucky
//          Draw donor to the localized static file; owner M=music-mute law
//          supersedes the donor motion/parallax/reference diagnostics.
//
// Usage: node tools/buildGoldCutover.mjs [--check]
//   --check  verify outputs are up to date without writing.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { adaptGoldBattleHudR48b } from './goldBattleHudR48b.mjs';
import { adaptGoldBattleHudR50c } from './goldBattleHudR50c.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GOLD_DIR = path.join(REPO, 'docs', 'gold-ui', 'current');
const PRELOAD_DIR = path.join(REPO, 'docs', 'gold-ui', 'preload');
const FONT_SRC = path.join(REPO, 'tools', 'gold-cutover', 'fonts');
const TAB_FAVICON_SRC = path.join(REPO, 'tools', 'gold-cutover', 'assets', 'favicon-tab-apex.svg');
const NON_SHIPPING_GOLD_ASSETS = new Set([
  'gold/pick-reference-overlay.png',
  'gold/pick-hidden-gold-source.png',
]);
const OUT_DIR = path.join(REPO, 'public', 'gold');
const THEME_OUT = path.join(REPO, 'public', 'assets', 'audio', 'forward_drive_theme.ogg');
const CHECK = process.argv.includes('--check');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const read = (p) => fs.readFileSync(p);
const log = (...a) => console.log('[gold-cutover]', ...a);
let srcManifestContent = '';
const SRC_ASSET_MANIFEST = path.join(REPO, 'src', 'game', 'goldAssetManifest.js');

// ── authority hashes (docs/gold-ui/current/manifests + preload manifest) ────
const AUTHORITY = {
  battleHudDecodedSha256: '96766265665403fd00591eaaacfc97b7289e959cb47606b2df1dfc49b5bfc61d',
  // The pack's Lucky Draw donor: the standalone original (494d89…, recorded in
  // manifests/original-source.sha256) with ONLY the documented FIGHTERS.urlBase
  // art-slot replacement applied (manifests/asset-manifest.json notes).
  luckyDonorPackSha256: '1b1636510863c950b391bcdfb85c3995c5b917ed32e798f7642a79925eaabcb0',
  goldSourcePackZipSha256: '61ccb14849b62e0003ca47f3e665e691084ef4418102b9806ab1f03d96eed023',
  preloadZipSha256: '49d8d5bf448bce7ca6475388cdf640c338bc00250fbcb577dbc7962fcfd0180f',
  themeEncodedSha256: '15afd820d5ca061f374ea41ad425f795204cf2be0e1f03d641f9b1f85f6dfb9b',
};

function verifyAuthority() {
  const hud = read(path.join(GOLD_DIR, 'donors', 'battle-hud', 'index.html'));
  if (sha256(hud) !== AUTHORITY.battleHudDecodedSha256) {
    throw new Error('canonical battle HUD donor hash mismatch — docs/gold-ui is not the pinned authority');
  }
  const lucky = read(path.join(GOLD_DIR, 'donors', 'lucky-draw', 'index.html'));
  if (sha256(lucky) !== AUTHORITY.luckyDonorPackSha256) {
    throw new Error('canonical lucky draw donor hash mismatch — docs/gold-ui is not the pinned authority');
  }
  const packShaFile = read(path.join(REPO, 'docs', 'gold-ui', 'APEX_CHAOS_GOLD_SOURCE_PACK.zip.sha256'), 'utf8');
  if (!packShaFile.includes(AUTHORITY.goldSourcePackZipSha256)) {
    throw new Error('gold source pack recorded hash mismatch');
  }
  const preloadZip = read(path.join(PRELOAD_DIR, 'APEX_CHAOS_CORE_SIX_AV_THEME_PRELOAD.zip'));
  if (sha256(preloadZip) !== AUTHORITY.preloadZipSha256) {
    throw new Error('AV preload zip hash mismatch');
  }
  log('authority hashes verified (battle HUD donor, lucky donor, source pack record, AV preload zip)');
}

// ── patch engine ────────────────────────────────────────────────────────────
// Each patch: { id, why, find (string|RegExp), replace (string|fn) }
// Exactly one match required unless `all: true`.
function applyPatches(source, patches, label) {
  let out = source;
  for (const patch of patches) {
    const isRe = patch.find instanceof RegExp;
    const isFn = typeof patch.find === 'function';
    // Function finds resolve against the CURRENT text and keep patch authoring
    // free of regex-escaping ambiguity (deterministic, drift-loud).
    if (patch.lineFilter) {
      const before = out;
      out = out.split(String.fromCharCode(10)).filter(patch.lineFilter).join(String.fromCharCode(10));
      if (out === before) {
        throw new Error(`patch ${patch.id} (${label}) expected 1 match, found 0`);
      }
      log(`  patch ${patch.id} (${label}): ${patch.why}`);
      continue;
    }
    // A function find may resolve to a single needle OR an array of needles
    // (every needle must be present; each is removed/replaced).
    let matcher = isFn ? patch.find(out) : patch.find;
    let needles;
    if (isRe) needles = null;
    else if (Array.isArray(matcher)) needles = matcher.filter(Boolean);
    else needles = matcher ? [matcher] : [];
    let matches;
    if (isRe) {
      const re = patch.find.flags.includes('g') ? patch.find : new RegExp(patch.find.source, patch.find.flags + 'g');
      matches = [...out.matchAll(re)];
    } else {
      matches = [];
      for (const needle of needles) {
        const count = out.split(needle).length - 1;
        for (let i = 0; i < count; i++) matches.push(needle);
      }
    }
    const expected = patch.all ? '>=1' : '1';
    if ((patch.all && matches.length < 1) || (!patch.all && matches.length !== 1)) {
      throw new Error(`patch ${patch.id} (${label}) expected ${expected} match, found ${matches.length}`);
    }
    if (isRe) {
      out = out.replace(patch.find, patch.replace);
    } else if (patch.all) {
      for (const needle of needles) out = out.split(needle).join(patch.replace);
    } else {
      out = out.replace(needles[0], patch.replace);
    }
    log(`  patch ${patch.id} (${label}): ${patch.why}`);
  }
  return out;
}

// ── fonts (localized Google Fonts, byte-identical fontsource files) ─────────
const FONT_SPEC = [
  { family: 'Oswald', weights: [400, 500, 600, 700] },
  { family: 'Teko', weights: [500, 600] },
  { family: 'JetBrains Mono', weights: [400, 600] },
];

function buildFontsCss() {
  const blocks = [];
  for (const spec of FONT_SPEC) {
    for (const weight of spec.weights) {
      for (const subset of ['latin', 'latin-ext']) {
        const file = `${spec.family.toLowerCase().replace(/\s+/g, '-')}-${subset}-${weight}-normal.woff2`;
        const src = path.join(FONT_SRC, file);
        if (!fs.existsSync(src)) throw new Error(`missing vendored font ${file}`);
        const unicodeRange = subset === 'latin'
          ? 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
          : 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
        blocks.push(
          `/* ${spec.family}-${subset}-${weight}-normal */\n` +
          `@font-face {\n` +
          `  font-family: '${spec.family}';\n` +
          `  font-style: normal;\n` +
          `  font-display: swap;\n` +
          `  font-weight: ${weight};\n` +
          `  src: url(./fonts/${file}) format('woff2');\n` +
          `  unicode-range: ${unicodeRange};\n` +
          `}`,
        );
      }
    }
  }
  return `/* Localized Google Fonts subset for the Gold Lucky Draw donor.\n` +
    `   Font files are byte-identical Fontsource builds of Oswald/Teko/JetBrains Mono\n` +
    `   (same families, weights, subsets and metrics as the donor's Google Fonts link).\n` +
    `   Generated by tools/buildGoldCutover.mjs — do not hand-edit. */\n\n` +
    blocks.join('\n\n') + '\n';
}

// ── theme music (owner Forward Drive, repository encode) ────────────────────
function materializeTheme() {
  const tmp = fs.mkdtempSync(path.join(REO_TMP(), 'gold-theme-'));
  try {
    execFileSync('unzip', ['-o', '-q', path.join(PRELOAD_DIR, 'APEX_CHAOS_CORE_SIX_AV_THEME_PRELOAD.zip'), 'apex_av_preload/music/forward_drive_theme.ogg', '-d', tmp], { stdio: 'pipe' });
    const extracted = path.join(tmp, 'apex_av_preload', 'music', 'forward_drive_theme.ogg');
    const bytes = read(extracted);
    if (sha256(bytes) !== AUTHORITY.themeEncodedSha256) {
      throw new Error('theme ogg hash mismatch against AV_THEME_PRELOAD_MANIFEST.json');
    }
    if (!CHECK) {
      fs.mkdirSync(path.dirname(THEME_OUT), { recursive: true });
      fs.writeFileSync(THEME_OUT, bytes);
    }
    log(`theme forward_drive_theme.ogg materialized (${bytes.length} bytes, sha verified)`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
function REO_TMP() {
  const dir = path.join(REPO, '.gold-cutover-tmp');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── battle HUD donor → production (docs §8: harness removed, truth bridged) ─
function buildBattleHud() {
  const donor = read(path.join(GOLD_DIR, 'donors', 'battle-hud', 'index.html')).toString('utf8');

  const patches = [
    // ── H1: preview bar element (diagnostic tooling must not ship) ─────────
    {
      id: 'HUD-H1',
      why: 'remove LAB/preview bar element',
      find: /<div id="pbar"><span id="pbL"><\/span><span id="pbR">[\s\S]*?<\/span><\/div>\n/,
      replace: '',
    },
    // ── H2: LAB dialog element ─────────────────────────────────────────────
    {
      id: 'HUD-H2',
      why: 'remove HUD LAB dialog element',
      find: /<div id="lab" role="dialog"[\s\S]*?<\/div>\s*(?=<script>)/,
      replace: '',
    },
    // ── H3: toast element (demo-key notices only) ──────────────────────────
    {
      id: 'HUD-H3',
      why: 'remove demo toast element',
      find: /<div id="toast"><\/div>\n/,
      replace: '',
    },
    {
      id: 'HUD-H3b',
      why: 'remove LAB affordance title from the match center',
      find: /<div id="matchCenter" title="Tap for lab">/,
      replace: '<div id="matchCenter">',
    },
    // ── H4: preview/lab/toast CSS rules ────────────────────────────────────
    {
      id: 'HUD-H4',
      why: 'remove #pbar preview CSS',
      find: /^#pbar[^{]*\{[^}]*\}\n/gm,
      replace: '',
      all: true,
    },
    {
      id: 'HUD-H5',
      why: 'remove #lab LAB CSS',
      find: /^#lab[^{]*\{[^}]*\}\n/gm,
      replace: '',
      all: true,
    },
    {
      id: 'HUD-H6',
      why: 'remove #toast demo CSS',
      find: /^#toast[^{]*\{[^}]*\}\n/gm,
      replace: '',
      all: true,
    },
    // ── H7: applyViewport — real viewport fit path only (responsive law) ───
    {
      id: 'HUD-H7',
      why: 'replace preset whole-stage scaler with real-viewport fit composition',
      find: /function applyViewport\(\)\{[\s\S]*?\n\}\n(function resizeCanvas)/,
      replace: (
        `function applyViewport(){\n` +
        ` const W=innerWidth,H=innerHeight;\n` +
        ` Object.assign(S.viewport,{w:W,h:H,scale:1});\n` +
        ` const st=R.stage.style;st.width=W+'px';st.height=H+'px';st.transform='';\n` +
        ` const safe=['env(safe-area-inset-top,0px)','env(safe-area-inset-right,0px)','env(safe-area-inset-bottom,0px)','env(safe-area-inset-left,0px)'];\n` +
        ` ['--safeT','--safeR','--safeB','--safeL'].forEach((k,j)=>st.setProperty(k,safe[j]));\n` +
        ` const layout=H>W?'port':(W>=1000&&H>=560?'desk':'land');\n` +
        ` S.viewport.layout=layout;\n` +
        ` R.hud.dataset.layout=layout;R.hud.dataset.mode=S.mode;\n` +
        ` R.side[1].root.toggleAttribute('data-mirror',!(layout==='port'&&S.mode==='2p'));\n` +
        ` dockLocalRails();\n` +
        ` document.body.classList.remove('preview');\n` +
        ` R.frac.setAttribute('viewBox',\`0 0 \${W} \${H}\`);\n` +
        ` renderStatic();[0,1].forEach(i=>{R.side[i].wp.wi=-1;renderWeapon(i);});\n` +
        ` resizeCanvas();sizeFxCanvas();\n` +
        `}\n$1`
      ),
    },
    // ── H8: remove ARENA DEMO SIM section (fake fighters/bullets/AI/regen) ─
    {
      id: 'HUD-H8',
      why: 'remove donor arena demo simulation (covers/AI/update/draw/drawFighter); keep the canonical FX anchor store the surviving presentation functions read',
      find: /\/\* =+ ARENA DEMO SIM =+ \*\/[\s\S]*?(?=\/\* =+ ABILITIES \/ WEAPONS =+ \*\/)/,
      replace: [
        '/* ================= ARENA ANCHOR STORE (production truth) ================= */',
        '// Canonical FX anchors (popups/sweeps/flashes/streaks/thunder) mirror the',
        '// REAL production fighter positions fed by the seam (syncFighters). The',
        "// donor's fake simulation (covers, AI, regen, demo loop) is gone; this",
        '// store is presentation geometry only, never match truth.',
        'const G={f:[{x:250,y:520,vx:0,vy:0,tx:250,ty:520,aim:0,flash:0,jx:0,jy:0,dash:null},',
        '           {x:750,y:480,vx:0,vy:0,tx:750,ty:480,aim:Math.PI,flash:0,jx:0,jy:0,dash:null}],',
        '         b:[],sp:[],beams:[],walls:[],after:[],rings:[],thunder:[]};',
        '',
      ].join('\n'),
    },
    // ── H9: cast() — drop demo skillEffect arena FX (production VFX own it) ─
    {
      id: 'HUD-H9',
      why: 'donor demo skillEffect arena FX removed; real ability VFX are the accepted hero presentation runtimes',
      find: / streakTo\(pi,u\.el\);\n skillEffect\(pi,ai,now\);\n\}/,
      replace: ' streakTo(pi,u.el);\n}',
    },
    // ── H9b: thunder audio is production-owned (battle audio graph) ────────
    {
      id: 'HUD-H9b',
      why: 'donor synthesized thunder crack removed; battle audio is production-owned (visual lightning family unchanged)',
      find: /G\.thunder\.push\(\{bolt,t0:now,dur:330,a,v\}\);if\(G\.thunder\.length>2\)G\.thunder\.shift\(\);synthesizeThunder\(\);/,
      replace: 'G.thunder.push({bolt,t0:now,dur:330,a,v});if(G.thunder.length>2)G.thunder.shift();',
    },
    {
      id: 'HUD-H9c',
      why: 'remove the donor thunder synth function (unused after HUD-H9b)',
      find: /function synthesizeThunder\(\)\{[\s\S]*?\n\}\n/,
      replace: '',
    },
    // ── H10: ko() — drop fake best-of-three reset choreography ─────────────
    {
      id: 'HUD-H10',
      why: 'remove donor fake best-of-three auto-rematch reset (production result authority owns flow)',
      find: / setTimeout\(\(\)=>\{if\(S\.wins\[a\]>=2\)\{S\.wins=\[0,0\];S\.round=1;\}else S\.round\+\+;\n  S\.players\.forEach\(p=>\{p\.hp=p\.max;p\.ghost=p\.max;\}\);S\.timer=180;S\.timerAcc=0;S\.ko=false;resetGame\(\);renderAll\(\);\},1900\);\n/,
      replace: '',
    },
    // ── H16: production has no manual weapon swap (real pickup acquisition);
    // the weapon panel reflects the real equipped weapon only.
    {
      id: 'HUD-H16',
      why: 'remove donor manual weapon-swap control (production weapons are acquired by real pickup)',
      find: /   <button class="wp-swap" type="button" data-p="\$\{i\+1\}" aria-label="Swap weapon"><kbd>\$\{h\.swapKey\}<\/kbd><span class="wp-alt"><\/span><\/button>\n/,
      replace: '',
    },
    {
      id: 'HUD-H17',
      why: 'guard the alt-name readout after swap-control removal',
      find: /if\(u\.wi!==p\.wi\)\{u\.ico\.innerHTML=w\.icon;u\.name\.textContent=w\.name;u\.type\.textContent=w\.type;u\.alt\.textContent=alt\.name;/,
      replace: 'if(u.wi!==p.wi){u.ico.innerHTML=w.icon;u.name.textContent=w.name;u.type.textContent=w.type;if(u.alt)u.alt.textContent=alt.name;',
    },
    {
      id: 'HUD-H11',
      why: 'replace donor RESET/INPUT/DIAGNOSTICS harness with production input seam',
      // ── H11: remove RESET + INPUT + DIAGNOSTICS sections; install production input ─
      find: /\/\* =+ RESET =+ \*\/[\s\S]*?(?=let toastT=0;function toast\(t\))/,
      replace: (
        `/* ================= PRODUCTION INPUT (donor harness removed) ================= */\n` +
        `R.stage.addEventListener('pointerdown',e=>{\n` +
        ` const sk=e.target.closest('.skill');\n` +
        ` if(sk){e.preventDefault();const pi=+sk.dataset.p-1;if(S.mode==='1p'&&pi===1)return;APEX_GOLD_HUD.pressSkill(pi,+sk.dataset.i);return;}\n` +
        ` const sw=e.target.closest('.wp-swap');if(sw){e.preventDefault();const pi=+sw.dataset.p-1;if(S.mode==='1p'&&pi===1)return;APEX_GOLD_HUD.pressSwap(pi);return;}\n` +
        `});\n`
      ),
    },
    // ── H22: demo key-hint toast at boot (advertised removed demo keys) ────
    {
      id: 'HUD-H22',
      why: 'remove donor demo key-hint toast at boot',
      find: (src) => {
        const marker = "toast('V view";
        const i = src.indexOf(marker);
        if (i < 0) return null;
        const start = src.lastIndexOf(String.fromCharCode(10), i) + 1;
        const end = src.indexOf(String.fromCharCode(10), i) + 1;
        return src.slice(start, end);
      },
      replace: '',
    },
    {
      id: 'HUD-H23',
      why: 'remove the demo toast function (its element no longer ships)',
      find: (src) => { const marker = 'let toastT=0;function toast(t)'; const i = src.indexOf(marker); if (i < 0) return null; const end = src.indexOf(String.fromCharCode(10), i) + 1; return src.slice(i, end); },
      replace: '',
    },
    // ── H18: donor boot called the removed resetDemo — production pump boots ─
    {
      id: 'HUD-H18',
      why: 'boot line starts the production pump only (resetDemo no longer exists)',
      find: /resetDemo\(\);applyViewport\(\);requestAnimationFrame\(frame\);/,
      replace: 'applyViewport();requestAnimationFrame(frame);',
    },
    // ── H19: dead donor sim functions removed (unreferenced after patches) ──
    {
      id: 'HUD-H19',
      why: 'remove donor swapWeapon (no production swap command exists)',
      find: /function swapWeapon\(i\)\{[\s\S]*?\n\}\n\n(?=\/\* =+ DAMAGE \/ HEAL =+ \*\/)/,
      replace: '',
    },
    {
      id: 'HUD-H20',
      why: 'remove donor demo skillEffect (unreferenced after HUD-H9)',
      find: /function skillEffect\(pi,ai,now\)\{[\s\S]*?\n\}\n(?=function setStatus)/,
      replace: '',
    },
    {
      id: 'HUD-H21',
      why: 'remove the donor preview preset table (preview-only scaling)',
      find: /const PRESETS=\[[\s\S]*?\];\n/,
      replace: '',
    },
    // ── H12: remove the demo diagnostics block (runDiag + interval) ────────
    // ── H26: the donor's Escape handler is a document-level capture listener
    // that outlives the mount. The bridge unmounts by emptying the host, which
    // does NOT remove document-level listeners, so after the first battle
    // session the donor swallowed EVERY later Escape (stopImmediatePropagation)
    // and the shell's back/unlock navigation died; every remount added another
    // copy. Install it once, and only own the key while this HUD is the open
    // battle surface (the shell owns Escape on the transition/cancel path).
    // ── H27: timer truth — production owns ELAPSED time only ──────────────
    // The donor is authored as a countdown with best-of-three round/win pips.
    // Current production Arsenal has neither: AQ.state.time is elapsed time
    // (starts at 0, increases) and there is no round/win authority. Present
    // the truth: count UP, never urgent, no fabricated round, no fake pips.
    {
      id: 'HUD-H27a',
      why: 'renderTimer presents elapsed-time truth (never countdown-urgent) and suppresses round/win state without production authority',
      find: /function renderTimer\(\)\{\n const t=Math\.max\(0,Math\.ceil\(S\.timer\)\),s=([\s\S]*?)\n\}/,
      replace: (
        `function renderTimer(){\n` +
        ` // Production truth: elapsed time only. No countdown urgency, no\n` +
        ` // fabricated round number, no best-of-three win pips.\n` +
        ` const t=Math.max(0,Math.ceil(S.timer)),s=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');\n` +
        ` if(R.time.textContent!==s)R.time.textContent=s;\n` +
        ` R.time.classList.remove('urgent');\n` +
        ` document.querySelectorAll('.mc-view-time').forEach(el=>{if(el.textContent!==s)el.textContent=s;el.classList.remove('urgent');});\n` +
        ` if(S.roundAuthority){\n` +
        `   const rr='R'+S.round;R.roundEl.textContent=rr;\n` +
        `   document.querySelectorAll('.mc-view-round').forEach(el=>{if(el.textContent!==rr)el.textContent=rr;});\n` +
        `   document.querySelectorAll('.mc-pip').forEach(el=>{const [pi,n]=el.dataset.w.split('-').map(Number);el.classList.toggle('on',S.wins[pi]>n);});\n` +
        ` }else{\n` +
        `   R.roundEl.textContent='';\n` +
        `   document.querySelectorAll('.mc-view-round').forEach(el=>{el.textContent='';});\n` +
        `   document.querySelectorAll('.mc-pip').forEach(el=>{el.classList.remove('on');});\n` +
        ` }\n` +
        `}`
      ),
    },
    {
      id: 'HUD-H27c',
      why: 'hide the best-of-three round strip when production owns no round authority (composition preserved, no fabricated state)',
      find: /\.mc-round\{display:flex;align-items:center;gap:4px;font-size:var\(--mcRF\);letter-spacing:\.22em;color:var\(--mute\);line-height:1\}/,
      replace: (
        `.mc-round{display:flex;align-items:center;gap:4px;font-size:var(--mcRF);letter-spacing:.22em;color:var(--mute);line-height:1}\n` +
        `#hud[data-round-authority="0"] .mc-round{display:none}`
      ),
    },
    // ── H28: control labels come from the accepted production key law ──────
    {
      id: 'HUD-H28',
      why: 'replace donor demo control copy (LOCAL · U I E, manual W/E swap claims) with the accepted key law labels',
      find: / R\.side\[0\]\.ctrl\.textContent=desk\?'LOCAL · J K W':'LOCAL · TOUCH';\n R\.side\[1\]\.ctrl\.textContent=S\.mode==='1p'\?'CPU · THREAT':\(desk\?'LOCAL · U I E':'LOCAL · TOUCH'\);/,
      replace: (
        ` // Owner input law (production truth): P1 J/K, Local P2 Digit1/Digit2,\n` +
        ` // BOT P2 = CPU. No manual swap command exists in production, so no\n` +
        ` // swap key is ever advertised here.\n` +
        ` R.side[0].ctrl.textContent=desk?'LOCAL · J K':'LOCAL · TOUCH';\n` +
        ` R.side[1].ctrl.textContent=S.mode==='1p'?'CPU · THREAT':(desk?'LOCAL · 1 2':'LOCAL · TOUCH');`
      ),
    },
    {
      id: 'HUD-H26',
      why: 'donor Escape handler: install once + only while this mount is still connected',
      find: /  document\.addEventListener\('keydown',e=>\{\n    if\(e\.key==='Escape'\)\{\n      e\.preventDefault\(\);e\.stopImmediatePropagation\(\);\n      parent\.postMessage\(\{type:'APEX_CHAOS_BATTLE_EXIT'\},'\*'\);\n    \}\n  \},true\);/,
      replace: (
        `  if(!document.__apexGoldHudExitKey){\n` +
        `    document.__apexGoldHudExitKey=true;\n` +
        `    document.addEventListener('keydown',e=>{\n` +
        `      if(e.key!=='Escape')return;\n` +
        `      const host=document.getElementById('battleHudHost');\n` +
        `      if(!host||!host.classList.contains('is-open'))return;\n` +
        `      e.preventDefault();e.stopImmediatePropagation();\n` +
        `      parent.postMessage({type:'APEX_CHAOS_BATTLE_EXIT'},'*');\n` +
        `    },true);\n` +
        `  }\n`
      ),
    },
    {
      id: 'HUD-H25',
      why: 'remove the inert donor diagnostic + safe-area-visualizer elements',
      find: (src) => {
        const needles = [
          '<div id="diag"></div>',
          '<div id="safeViz"><i class="sv t"></i><i class="sv r"></i><i class="sv b"></i><i class="sv l"></i></div>',
        ];
        const missing = needles.filter((n) => !src.includes(n));
        return missing.length ? null : needles;
      },
      replace: '',
      all: true,
    },
    {
      id: 'HUD-H24',
      why: 'remove donor body.preview-only CSS scaffolding (never applies in production)',
      lineFilter: (l) => !l.startsWith('body.preview'),
    },
    {
      id: 'HUD-H12',
      why: 'remove donor diagnostics (T) block',
      find: /\/\* =+ DIAGNOSTICS \(T\) =+ \*\/[\s\S]*?(?=\/\* =+ LOOP =+ \*\/)/,
      replace: '',
    },
    // ── H13: replace the demo frame loop with the production pump ──────────
    {
      id: 'HUD-H13',
      why: 'demo frame loop replaced by production pump seam',
      find: /\/\* =+ LOOP =+ \*\/[\s\S]*?requestAnimationFrame\(frame\);\n\}/,
      replace: (
        `/* ================= PRODUCTION PUMP ================= */\n` +
        `let __apexLast=performance.now();\n` +
        `function frame(now){\n` +
        ` if(!R.stage||!R.stage.isConnected)return;\n` +
        ` const dt=Math.min(.05,(now-__apexLast)/1000);__apexLast=now;\n` +
        ` try{APEX_GOLD_HUD.tick(dt,now);}catch(err){}\n` +
        ` requestAnimationFrame(frame);\n` +
        `}\n`
      ),
    },
    // ── H30: hud.critical.warning fires on threshold ENTRY only ────────────
    // Owner law: the critical cue sounds when BOTH fighters drop to <= 500 HP,
    // on ENTRY only, with hysteresis so it cannot chatter at the boundary. It
    // plays through the ONE semantic UI-SFX authority (the battle HUD mounts
    // inline in the shell document, so the authority is the shell's own).
    {
      id: 'HUD-H30',
      why: 'hud.critical.warning plays on threshold entry only (both fighters <= 500 HP) with hysteresis',
      find: /function renderRail\(i\)\{/,
      replace: (
        `/* ---- critical-health cue: threshold ENTRY only, with hysteresis ---- */\n` +
        `const HUD_CRITICAL_HP=500;\n` +
        `const HUD_CRITICAL_RELEASE_HP=560;\n` +
        `let hudCriticalActive=false;\n` +
        `function hudCriticalCue(){\n` +
        `  if(!S.players)return;\n` +
        `  const a=S.players[0],b=S.players[1];\n` +
        `  if(!a||!b)return;\n` +
        `  // A KO'd fighter is not a critical-health state.\n` +
        `  if(S.ko||a.hp<=0||b.hp<=0){\n` +
        `    hudCriticalActive=false;\n` +
        `    return;\n` +
        `  }\n` +
        `  const bothLow=a.hp<=HUD_CRITICAL_HP&&b.hp<=HUD_CRITICAL_HP;\n` +
        `  const released=a.hp>HUD_CRITICAL_RELEASE_HP||b.hp>HUD_CRITICAL_RELEASE_HP;\n` +
        `  if(hudCriticalActive){\n` +
        `    if(released)hudCriticalActive=false;\n` +
        `    return;\n` +
        `  }\n` +
        `  if(bothLow){\n` +
        `    hudCriticalActive=true;\n` +
        `    try{\n` +
        `      const sfx=window.apexUiSfx;\n` +
        `      if(sfx&&typeof sfx.play==='function')sfx.play('hud.critical.warning');\n` +
        `    }catch(_){ }\n` +
        `  }\n` +
        `}\n` +
        `function renderRail(i){`
      ),
    },
    // ── H31: the cue is evaluated from the single HP write path ─────────────
    {
      id: 'HUD-H31',
      why: 'the critical cue is evaluated from renderRail, the single HP write path',
      find: / renderRival\(i\^1\);\n\}/,
      replace: `  renderRival(i^1);\n  hudCriticalCue();\n}`,
    },
    // ── H14: handoff bridge — mode setter binds to the production seam ─────
    {
      id: 'HUD-H14',
      why: 'handoff bridge setMode uses the production seam (demo M-key removed)',
      find: /    if\(hud\.dataset\.mode!==desired\)\{\n      window\.dispatchEvent\(new KeyboardEvent\('keydown',\{key:'m',code:'KeyM',bubbles:true\}\)\);\n    \}/,
      replace: `    if(hud.dataset.mode!==desired){\n      APEX_GOLD_HUD.setMode(desired);\n    }`,
    },
  ];

  let out = applyPatches(donor, patches, 'battle-hud');
// ── H29: the production seam projects REAL skill/timer truth ─────────────
// These patches apply to the seam string (not the donor): the seam is the
// only component allowed to speak for production skill state.
const seamPatches = [
    // ── H29: skill projection is production truth, Cast is visual only ─────
    {
      id: 'HUD-H29a',
      why: 'setSkill is a visual cast cue only (cooldown/charge authority stays with production)',
      find: /  seam\.setSkill=function setSkill\(pi,ai,patch\)\{\n    const a=S\.players\[pi\]&&S\.players\[pi\]\.abil\[ai\];if\(!a\|\|!patch\)return;\n    if\(Number\.isFinite\(patch\.cd\)\)a\.cd=Math\.max\(\.05,patch\.cd\);\n    a\.max=1;\n    a\.charges=0;\n    a\.next=performance\.now\(\)\+\(Number\.isFinite\(patch\.nextIn\)\?patch\.nextIn:a\.cd\)\*1000;\n    a\.castUntil=patch\.castUntil\?performance\.now\(\)\+380:0;\n  \};/,
      replace: (
        `  // Visual cue ONLY: the production combatant owns cooldown/charges and\n` +
        `  // projects them every frame (applyState). A Cast event must never\n` +
        `  // become cooldown authority.\n` +
        `  seam.setSkill=function setSkill(pi,ai,patch){\n` +
        `    const a=S.players[pi]&&S.players[pi].abil[ai];if(!a||!patch)return;\n` +
        `    a.castUntil=patch.castUntil?performance.now()+380:0;\n` +
        `  };`
      ),
    },
    {
      id: 'HUD-H29b',
      why: 'per-frame skill projection is authoritative: the donor never invents a charge/readiness transition of its own',
      find: /  seam\.tick=function tick\(dt,now\)\{\n    for\(let i=0;i<2;i\+\+\)\{\n      const p=S\.players\[i\];\n      if\(p\.ghost>p\.hp&&now>p\.hold\)\{p\.ghost=Math\.max\(p\.hp,p\.ghost-dt\*650\);renderRail\(i\);\}\n      else if\(p\.ghost<p\.hp\)\{p\.ghost=p\.hp;renderRail\(i\);\}\n/,
      replace: (
        `  seam.tick=function tick(dt,now){\n` +
        `    for(let i=0;i<2;i++){\n` +
        `      const p=S.players[i];\n` +
        `      if(p.ghost>p.hp&&now>p.hold){p.ghost=Math.max(p.hp,p.ghost-dt*650);renderRail(i);}\n` +
        `      else if(p.ghost<p.hp){p.ghost=p.hp;renderRail(i);}\n` +
        `      // Production truth owns skill readiness: while a projection is\n` +
        `      // active the donor must not auto-restore charges between frames.\n` +
        `      for(let k=0;k<2;k++){\n` +
        `        const a=p.abil[k];if(!a||!a.__truth)continue;\n` +
        `        if(a.next&&now>=a.next){\n` +
        `          if(a.charges<a.max){a.charges++;a.next=a.charges<a.max?a.next+a.cd*1000:0;}\n` +
        `          else a.next=0;\n` +
        `        }\n` +
        `      }\n`
      ),
    },
    {
      id: 'HUD-H29c',
      why: 'applyState records projected skill truth (and the round-authority flag) instead of inventing readiness',
      find: /          if\(Number\.isFinite\(sk\.cd\)\)a\.cd=Math\.max\(\.05,sk\.cd\);\n          if\(Number\.isFinite\(sk\.max\)\)a\.max=Math\.max\(1,sk\.max\);\n          if\(Number\.isFinite\(sk\.charges\)\)a\.charges=Math\.max\(0,sk\.charges\);\n          a\.next=Number\.isFinite\(sk\.nextIn\)\?now\+sk\.nextIn\*1000:0;\n          a\.castUntil=sk\.castUntil\?now\+380:0;/,
      replace: (
        `          if(Number.isFinite(sk.cd))a.cd=Math.max(.05,sk.cd);\n` +
        `          if(Number.isFinite(sk.max))a.max=Math.max(1,sk.max);\n` +
        `          if(Number.isFinite(sk.charges))a.charges=Math.max(0,Math.min(a.max,sk.charges));\n` +
        `          // nextIn is the REAL remaining time from production; the donor\n` +
        `          // only re-derives its own absolute deadline from it.\n` +
        `          a.next=Number.isFinite(sk.nextIn)&&sk.nextIn>0?now+sk.nextIn*1000:0;\n` +
        `          a.__truth=!!sk.truth;\n` +
        `          if(sk.castUntil)a.castUntil=now+380;`
      ),
    },
    {
      id: 'HUD-H29d',
      why: 'round authority flag drives the round strip + donor-side countdown suppression',
      find: /    if\(Number\.isFinite\(st\.round\)\)S\.round=st\.round;\n    if\(Array\.isArray\(st\.wins\)\)S\.wins=\[Number\(st\.wins\[0\]\)\|\|0,Number\(st\.wins\[1\]\)\|\|0\];/,
      replace: (
        `    // Timer truth: elapsed-time semantics unless production supplies a\n` +
        `    // countdown/round authority (current Arsenal does not).\n` +
        `    S.roundAuthority=st.roundAuthority===true;\n` +
        `    if(S.roundAuthority){\n` +
        `      if(Number.isFinite(st.round))S.round=st.round;\n` +
        `      if(Array.isArray(st.wins))S.wins=[Number(st.wins[0])||0,Number(st.wins[1])||0];\n` +
        `    }\n` +
        `    const hud=document.getElementById('hud');\n` +
        `    if(hud)hud.dataset.roundAuthority=S.roundAuthority?'1':'0';`
      ),
    },
];


    // ── H15: production seam — appended after the donor's main script, in the
    // canonical position (top-level const/function bindings of a classic script
    // are visible to later classic scripts in the same realm).
    const seam = `
<script>
/* ==========================================================================
   APEX CHAOS — Gold Battle HUD production seam.
   Generated by tools/buildGoldCutover.mjs (patch HUD-H15).
   This seam replaces the removed donor simulator callbacks with production
   truth: every canonical presentation function above (applyDamage/heal/cast/
   ko/renderRail/renderWeapon/renderSkills/renderTimer/applyViewport/...) is
   invoked with real production state/events. No donor demo truth survives.
   ========================================================================== */
(function apexGoldHudSeam(){
  'use strict';
  const seamVersion='gold-hud-seam-v1';
  const seam=window.APEX_GOLD_HUD||(window.APEX_GOLD_HUD={});
  if(seam.__installed===seamVersion)return;
  seam.__installed=seamVersion;
  seam.version=seamVersion;

  // Real fighter positions (production arena space, 0..1000) drive the
  // canonical FX anchor points (popups, sweeps, flashes, streaks).
  seam.syncFighters=function syncFighters(pos){
    if(!pos)return;
    for(let i=0;i<2;i++){
      const p=pos[i];if(!p)continue;
      G.f[i].x=clamp(Number(p.x)||0,0,1000);
      G.f[i].y=clamp(Number(p.y)||0,0,1000);
      if(Number.isFinite(p.aim))G.f[i].aim=Number(p.aim);
    }
  };

  seam.setMode=function setMode(mode){
    if(S.mode!==mode){S.mode=mode;applyViewport();}
  };
  seam.setLive=function setLive(live){S.paused=!live;};

  // Owner input law drives the canonical key hints: P1 J=A1/K=A2, Local 2P
  // Digit1/Digit2, BOT mode exposes P1 controls only (P2 is real CPU).
  function applyKeyLabels(i,labels){
    const u=R.side[i]&&R.side[i].skills;if(!u)return;
    for(let k=0;k<2&&k<u.length;k++){
      const el=u[k].el&&u[k].el.querySelector('.sk-key');
      if(el)el.textContent=(labels&&labels[k])||'';
    }
  }

  // Per-frame production projection -> canonical renderers.
  seam.applyState=function applyState(st){
    if(!st)return;
    const now=performance.now();
    if(Number.isFinite(st.timer))S.timer=st.timer;
    if(Number.isFinite(st.round))S.round=st.round;
    if(Array.isArray(st.wins))S.wins=[Number(st.wins[0])||0,Number(st.wins[1])||0];
    if(typeof st.ko==='boolean')S.ko=st.ko;
    for(let i=0;i<2;i++){
      const s=st.sides&&st.sides[i];if(!s)continue;
      const p=S.players[i];
      if(s.accent&&HEROES[i].accent!==s.accent)HEROES[i].accent=s.accent;
      if(Array.isArray(s.keyLabels))applyKeyLabels(i,s.keyLabels);
      if(Number.isFinite(s.hp)){
        const hp=Math.max(0,Number(s.hp));
        if(Math.abs(p.hp-hp)>0.01){
          if(hp<p.hp){p.ghost=Math.max(p.ghost,p.hp);p.hold=now+650;}
          p.hp=hp;renderRail(i);
        }
      }
      if(Number.isFinite(s.maxHp)&&s.maxHp>0&&p.max!==s.maxHp){p.max=s.maxHp;renderRail(i);}
      if(s.weapon){
        if(Number.isFinite(s.weapon.index))p.wi=0;
        const w=HEROES[i].weapons[0];
        if(w){
          if(s.weapon.name)w.name=s.weapon.name;
          if(s.weapon.type)w.type=s.weapon.type;
          if(Number.isFinite(s.weapon.mag)&&s.weapon.mag>0)w.mag=s.weapon.mag;
          if(Number.isFinite(s.weapon.ammo))p.ammo[0]=s.weapon.ammo;
        }
        p.reloadUntil=0;
        renderWeapon(i);
      }
      if(Array.isArray(s.skills)){
        for(let k=0;k<2&&k<s.skills.length;k++){
          const sk=s.skills[k],a=p.abil[k];if(!a||!sk)continue;
          if(sk.name){
            a.name=sk.name;
            const el=R.side[i].skills[k].el.querySelector('.sk-name');
            if(el&&el.textContent!==sk.name)el.textContent=sk.name;
          }
          if(Number.isFinite(sk.cd))a.cd=Math.max(.05,sk.cd);
          if(Number.isFinite(sk.max))a.max=Math.max(1,sk.max);
          if(Number.isFinite(sk.charges))a.charges=Math.max(0,sk.charges);
          a.next=Number.isFinite(sk.nextIn)?now+sk.nextIn*1000:0;
          a.castUntil=sk.castUntil?now+380:0;
        }
      }
    }
  };

  // Discrete production events -> canonical presentation (real values).
  seam.hit=function hit(a,v,amt,tier,afterHp){
    const p=S.players[v];if(!p)return;
    if(Number.isFinite(afterHp)){p.hp=Math.max(0,afterHp+Math.round(amt));}
    applyDamage(a,v,Math.round(amt),tier);
  };
  // Confirmed Stormbreaker damaging hit = Heavy family + Thunder family.
  seam.hitStorm=function hitStorm(a,v,amt,afterHp){
    const p=S.players[v];if(!p)return;
    if(Number.isFinite(afterHp)){p.hp=Math.max(0,afterHp+Math.round(amt));}
    applyDamage(a,v,Math.round(amt),'heavy');
    fxThunder(a,v,Math.round(amt));
  };
  seam.heal=function healEvent(v,amt,beforeHp){
    const p=S.players[v];if(!p)return;
    if(Number.isFinite(beforeHp))p.hp=Math.max(0,Math.min(p.max,beforeHp));
    heal(v,Math.round(amt));
  };
  seam.cast=function castEvent(pi,ai){
    cast(pi,ai,'production');
  };
  // Real ability cast telemetry (AIL 'Cast'): skill name + cooldown truth.
  seam.setSkill=function setSkill(pi,ai,patch){
    const a=S.players[pi]&&S.players[pi].abil[ai];if(!a||!patch)return;
    if(Number.isFinite(patch.cd))a.cd=Math.max(.05,patch.cd);
    a.max=1;
    a.charges=0;
    a.next=performance.now()+(Number.isFinite(patch.nextIn)?patch.nextIn:a.cd)*1000;
    a.castUntil=patch.castUntil?performance.now()+380:0;
  };
  seam.ko=function koEvent(a,v){
    ko(a,v);
  };
  seam.status=function statusEvent(i,txt,ms){setStatus(i,txt,ms);};
  seam.pressSkill=function pressSkill(pi,ai){
    const bridge=window.APEX_GOLD;
    if(bridge&&bridge.pressSkill)bridge.pressSkill(pi,ai);
  };
  seam.pressSwap=function pressSwap(pi){
    const bridge=window.APEX_GOLD;
    if(bridge&&bridge.pressSwap)bridge.pressSwap(pi);
  };

  // Canonical non-demo frame work only: skill cooldown rendering, ghost HP
  // decay (as authored in the donor update), thunder family animation.
  seam.tick=function tick(dt,now){
    for(let i=0;i<2;i++){
      const p=S.players[i];
      if(p.ghost>p.hp&&now>p.hold){p.ghost=Math.max(p.hp,p.ghost-dt*650);renderRail(i);}
      else if(p.ghost<p.hp){p.ghost=p.hp;renderRail(i);}
    }
    renderSkills(now);
    drawThunder(now);
  };
})();
</script>
`;
  const seamFinal = applyPatches(seam, seamPatches, 'battle-hud-seam');
  out = out.replace('</head>', `${seamFinal}</head>`);
  if (!out.includes(seamFinal)) throw new Error('patch HUD-H15 (production seam) could not be inserted');
  log('  patch HUD-H15 (battle-hud): production seam installed');

  // R48B: production-driven weapon/skill presentation + explicit compositor.
  // Deterministic adapter asserts every seam and refuses silent donor drift.
  out = adaptGoldBattleHudR48b(out);
  log('  R48B (battle-hud): production assets/semantics + combat FX compositor adapted');
  out = adaptGoldBattleHudR50c(out);
  log('  R50C (battle-hud): live identity/rarity + full-panel impact ownership adapted');
  return out;
}

// ── lucky draw donor → production ───────────────────────────────────────────
// Production roster (src/game/productSurface.js PLAYABLE_ROSTER_IDS) mapped to
// the Gold pack's canonical shell keys; display names from the hero registry.
const GOLD_HERO_ACCENTS = {
  ROBOT: '#ff941f', HUNTER: '#96ca2d', CRYSTAL: '#55bfff',
  MAGNET: '#c7c5e9', ICE: '#7ee8ff', MIRROR: '#e9e5df',
};
const LUCKY_ROSTER = [
  { shellKey: 'newbot', productionId: 'ROBOT', display: 'ROBOT', tag: 'APEX COMBAT FRAME' },
  { shellKey: 'hunter', productionId: 'HUNTER', display: 'HUNTER', tag: 'MANTIS ASSASSIN' },
  { shellKey: 'crystala', productionId: 'CRYSTAL', display: 'CRYSTALA', tag: 'ANCIENT CRYSTAL ENTITY' },
  { shellKey: 'magnet', productionId: 'MAGNET', display: 'MAGNET', tag: 'FIELD CONTROL UNIT' },
  { shellKey: 'frost', productionId: 'ICE', display: 'FROST', tag: 'CRYO EDGE UNIT' },
  { shellKey: 'mirror', productionId: 'MIRROR', display: 'MIRROR', tag: 'ECHO DUPLICATE' },
];

// The pack's Lucky Draw fighter art is an approved replaceable slot
// (placeholder contract). Heroes without pack art receive the same authored
// placeholder convention (560×720 data-URL SVG, accent border + name).
function luckyPlaceholderArt(name, accent) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="720" viewBox="0 0 560 720">` +
    `<rect width="560" height="720" fill="#080a0c"/>` +
    `<rect x="10" y="10" width="540" height="700" fill="none" stroke="${accent}" stroke-opacity=".45" stroke-width="3" stroke-dasharray="12 10"/>` +
    `<text x="280" y="342" text-anchor="middle" fill="${accent}" font-family="Arial" font-size="36" font-weight="700">${name}</text>` +
    `<text x="280" y="390" text-anchor="middle" fill="#d8dce0" fill-opacity=".55" font-family="Arial" font-size="18">LUCKY DRAW ART PLACEHOLDER</text>` +
    `</svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

function buildLuckyDonor() {
  const donor = read(path.join(GOLD_DIR, 'donors', 'lucky-draw', 'index.html')).toString('utf8');

  const patches = [
    // ── L1: localize external dependencies (no network at runtime) ─────────
    {
      id: 'LKY-L1',
      why: 'remove Tailwind browser CDN (donor CSS is self-contained)',
      find: /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@tailwindcss\/browser@4"><\/script>\n/,
      replace: '',
    },
    {
      id: 'LKY-L2',
      why: 'remove Google Fonts network links (localized via fonts.css)',
      find: /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n<link href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*" rel="stylesheet">\n/,
      replace: '<link rel="stylesheet" href="fonts.css">\n',
    },
    // ── L3: LAB preview tooling (panel, tab, viewport label) must not ship ─
    {
      id: 'LKY-L3',
      why: 'remove LAB panel + tab + preview label elements',
      find: /<div id="lab" hidden>[\s\S]*?<\/div>\n<div id="labTab"[^>]*>LAB<\/div>\n<div id="pvLabel"><\/div>\n/,
      replace: '',
    },
    // ── L4: production economy exposes one draw (350 AC); no ×10 bundle ────
    {
      id: 'LKY-L4',
      why: 'remove the donor ×10 draw bundle (production economy has a single draw)',
      find: /    <button class="draw d10" id="btn10" data-n="10" aria-label="Draw ten fighters, cost 1500">[\s\S]*?<\/button>\n/,
      replace: '',
    },
    {
      id: 'LKY-L5',
      why: 'single draw button carries the production cost (350 AC)',
      find: /aria-label="Draw one fighter, cost 160">\n      <i class="dk"><\/i><span class="dl"><span>DRAW <em>×1<\/em><\/span><span class="dc">◆ 160<\/span><\/span>/,
      replace: 'aria-label="Draw one fighter, cost 350">\n      <i class="dk"></i><span class="dl"><span>DRAW <em>×1</em></span><span class="dc">◆ 350</span></span>',
    },
    {
      id: 'LKY-L6',
      why: 'production currency label (Arsenal Credits)',
      find: /<b id="scrap">48,000<\/b><small>SCRAP<\/small>/,
      replace: '<b id="scrap">350</b><small>AC</small>',
    },
    // ── L6b: LAB/preview CSS rules are inert without their elements ─────────
    {
      id: 'LKY-L6b',
      why: 'remove LAB/preview CSS rules (elements removed by LKY-L3)',
      find: /#lab\{[^}]*\}\n#lab\[hidden\]\{[^}]*\}\n\.lab-row\{[^}]*\}\n\.lab-row b\{[^}]*\}\n\.lab-row em\{[^}]*\}\n#lab button\{[^}]*\}\n#lab button:hover\{[^}]*\}\n#lab button\[aria-pressed="true"\]\{[^}]*\}\n#labInfo\{[^}]*\}\n#labTab\{[^}]*\}\n#labTab:hover\{[^}]*\}\nbody\.labopen #labTab\{[^}]*\}\n#pvLabel\{[^}]*\}\n#pvLabel i\{[^}]*\}\nbody\.preview\.labopen #pvLabel\{[^}]*\}\n/,
      replace: '',
    },
    // ── L7: production roster + placeholder art (approved replaceable slot) ─
    {
      id: 'LKY-L7',
      why: 'donor pool replaced by the production Core Six roster (ids + display names + placeholder art convention)',
      find: /const FIGHTERS = \[\n[\s\S]*?\n\];\n/,
      replace: (() => {
        const entries = LUCKY_ROSTER.map((hero) => {
          const accent = GOLD_HERO_ACCENTS[hero.productionId] || '#c4a574';
          // Shipping fallback is already REAL Git art. The production roster
          // sync can replace/extend this list at runtime, so future fighters do
          // not require a Lucky-specific hardcoded mechanics path.
          const art = `/assets/gold-ui/heroes/${hero.shellKey}/${hero.shellKey === 'mirror' ? 'pick_roster_cover.webp' : 'pick_selected_large.webp'}`;
          return `  { key:'${hero.shellKey}', id:'${hero.productionId}', name:'${hero.display}', col:'${accent}', tag:'${hero.tag}',\n` +
            `     urlBase:"${art}", urlFx:null,\n` +
            `     hero:{scale:1.03,x:'0%',y:'0%'}, cover:{focusX:.50,focusY:.48,scale:1.04} }`;
        }).join(',\n');
        return `const FIGHTERS = [\n${entries},\n];\n`;
      })(),
    },
    {
      id: 'LKY-L8',
      why: 'draw result tag shows the production fighter display name',
      find: /function showTag\(w\)\{\n  const F = FIGHTERS\[w\];\n  \$\('#tagN'\)\.textContent = F\.id;\n  const extra = S\.mode === 10 \? ` · <i>×10 BEST<\/i>` : '';\n  \$\('#tagS'\)\.innerHTML = `CH \$\{pad2\(w \+ 1\)\} · <i>\$\{TIER\[F\.tier\]\}<\/i> · \$\{F\.tag\}\$\{extra\}`;/,
      replace: `function showTag(w){\n  const F = FIGHTERS[w];\n  $('#tagN').textContent = F.id;\n  $('#tagS').innerHTML = \`CH \${pad2(w + 1)} · <i>\${F.tag}</i>\`;`,
    },
    // ── L9: LAB scaler + diagnostics harness → production viewport/input ────
    {
      id: 'LKY-L9',
      why: 'replace LAB preset scaler, diagnostics, test buttons and demo keys with the real-viewport fit path and production input',
      find: /const btn1 = \$\('#btn1'\), btn10 = \$\('#btn10'\);\n[\s\S]*?toggleLab\(q\.has\('lab'\) \|\| !!LAB\.preset\);\n/,
      replace: (
        `/* ================= PRODUCTION VIEWPORT + INPUT ================= */\n` +
        `// Real viewport fit composition (responsive law): desk/land/port families\n` +
        `// from the real viewport plus env() safe areas. The donor LAB preset\n` +
        `// scaler was preview tooling and does not ship.\n` +
        `const layoutFor = (w, h) => (w < 760 ? 'port' : (h > w ? 'port' : (w >= 1000 && h >= 560 ? 'desk' : 'land')));\n` +
        `function applyView(){\n` +
        `  document.body.classList.remove('preview');\n` +
        `  stage.style.removeProperty('--pw'); stage.style.removeProperty('--ph');\n` +
        `  ['--sat','--sar','--sab','--sal'].forEach(k => stage.style.removeProperty(k));\n` +
        `  stage.style.transform = ''; wrap.style.cssText = '';\n` +
        `  S.scale = 1;\n` +
        `  const w = innerWidth, h = innerHeight;\n` +
        `  S.layout = layoutFor(w, h);\n` +
        `  stage.dataset.layout = S.layout;\n` +
        `  onStageResize();\n` +
        `}\n` +
        `function updateLabInfo(){}\n` +
        `function toggleLab(){}\n` +
        `const btn1 = $('#btn1');\n` +
        `function arm(on, n){\n` +
        `  S.armed = on && !S.busy; stage.dataset.arm = S.armed ? '1' : '0';\n` +
        `  stage.dataset.armb = on ? String(n) : '0';\n` +
        `}\n` +
        `[btn1].forEach(b => {\n` +
        `  const n = +b.dataset.n;\n` +
        `  b.addEventListener('pointerenter', () => arm(true, n));\n` +
        `  b.addEventListener('pointerleave', () => { arm(false, 0); b.dataset.press = '0'; });\n` +
        `  b.addEventListener('focus', () => arm(true, n));\n` +
        `  b.addEventListener('blur', () => { arm(false, 0); });\n` +
        `  b.addEventListener('pointerdown', () => { b.dataset.press = '1'; arm(true, n); });\n` +
        `  b.addEventListener('pointerup', () => { b.dataset.press = '0'; });\n` +
        `  b.addEventListener('click', () => { startDraw(n); stage.dataset.arm = '0'; S.armed = false; });\n` +
        `});\n` +
        `$('#backBtn').addEventListener('click', () => { shake($('#backBtn'), 3, 0, 160); if (window.parent !== window) window.parent.postMessage({type:'APEX_CHAOS_LUCKY_DRAW_EXIT'}, '*'); });\n` +
        `const openDrawer = () => { stage.dataset.drawer = '1'; };\n` +
        `$('#infoD').addEventListener('click', openDrawer); $('#infoM').addEventListener('click', openDrawer);\n` +
        `$('#drawerX').addEventListener('click', () => stage.dataset.drawer = '0');\n` +
        `// Pool drawer renders the production locked pool (draw truth).\n` +
        `$('#drawerList').innerHTML = FIGHTERS.filter(F => productionPoolIds().includes(F.id)).map((F, i) =>\n` +
        `  \`<div class="drow"><span class="n">\${pad2(i + 1)}</span><img src="\${F.urlBase}" alt=""><span>\${F.id}<small>\${F.tag}</small></span></div>\`).join('');\n` +
        `addEventListener('resize', applyView);\n` +
        `addEventListener('keydown', e => {\n` +
        `  if (e.target && e.target.tagName === 'INPUT') return;\n` +
        `  const k = e.key.toLowerCase();\n` +
        `  if (k === '1' || (k === ' ' && e.target === document.body)){ e.preventDefault(); startDraw(1); }\n` +
        `  else if (k === 'escape') stage.dataset.drawer = '0';\n` +
        `});\n` +
        `// Production truth on open: credits, pool, roster.\n` +
        `window.APEX_LUCKY_SYNC && window.APEX_LUCKY_SYNC();\n`
      ),
    },
    // ── L10: production economy/draw truth ─────────────────────────────────
    {
      id: 'LKY-L13',
      why: 'drop the dangling setPreset() boot call (its LAB function was removed with the donor LAB harness)',
      find: /\nsetPreset\(LAB\.preset\);/,
      replace: '',
    },
    {
      id: 'LKY-L14',
      why: 'inject the real #poolTag status node the production draw flow reports into (insufficient AC / ROSTER COMPLETE / DRAW UNAVAILABLE)',
      find: /<button class="info-d" id="infoD">POSSIBLE FIGHTERS <b id="poolCount">03<\/b><\/button>\n/,
      replace: (
        `<button class="info-d" id="infoD">POSSIBLE FIGHTERS <b id="poolCount">03</b></button>\n` +
        `  <div class="pool-tag" id="poolTag" role="status" aria-live="polite"></div>\n`
      ),
    },
    {
      id: 'LKY-L14b',
      why: 'style #poolTag in the donor HUD language (chip surface, HUD type scale, hidden until reported)',
      find: /.info-d\{display:none\}\n/,
      replace: (
        `.info-d{display:none}\n` +
        `.pool-tag{position:absolute;z-index:13;left:50%;bottom:calc(var(--ctl-b) + var(--ctl-h) + 2.2cqh);transform:translateX(-50%);\n` +
        `  display:flex;align-items:center;height:var(--hud-btn);padding:0 1.2em;background:rgba(14,12,10,.86);box-shadow:inset 0 0 0 1px var(--org-d);\n` +
        `  font-size:var(--fs-hud);letter-spacing:.18em;color:var(--org-h);white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .18s steps(3)}\n` +
        `.pool-tag[data-on="1"]{opacity:1}\n` +
        `#stage[data-layout="land"] .pool-tag{bottom:calc(var(--ctl-b) + var(--ctl-h) + 1.2cqh)}\n`
      ),
    },
    {
      id: 'LKY-L12',
      why: 'remove donor body.preview-only CSS scaffolding (never applies in production)',
      lineFilter: (l) => !l.startsWith('body.preview'),
    },
    {
      id: 'LKY-L10',
      why: 'draw cost/credits/result come from the production meta runtime',
      find: /function startDraw\(count\)\{[\s\S]*?\n\}\n/,
      replace: (
        `function startDraw(count){\n` +
        `  if (S.busy){ return; }\n` +
        `  const meta = window.APEX_ARSENAL_META;\n` +
        `  if (!meta || typeof meta.spin !== 'function'){ showPoolTag('DRAW UNAVAILABLE'); return; }\n` +
        `  const res = meta.spin();\n` +
        `  if (!res || res.ok !== true){\n` +
        `    if (res && res.reason === 'complete') showPoolTag('ROSTER COMPLETE');\n` +
        `    else showPoolTag('NEED ' + (res && res.need ? res.need : 350) + ' AC');\n` +
        `    return;\n` +
        `  }\n` +
        `  const winner = productionFighterIndex(res.name);\n` +
        `  if (winner < 0){ showPoolTag('DRAW UNAVAILABLE'); return; }\n` +
        `  S.scrap = typeof meta.credits === 'function' ? meta.credits() : S.scrap;\n` +
        `  const scrapEl = $('#scrap'); if (scrapEl) scrapEl.textContent = Number(S.scrap).toLocaleString('en-US');\n` +
        `  S.mode = count; S.results = [winner]; S.x10i = 0; S.skip = false;\n` +
        `  setBusy(true);\n` +
        `  buildTape(false);\n` +
        `  A.convOn = false; railR.dataset.conv = '0'; idxR.dataset.conv = '0';\n` +
        `  cells.forEach(c => c.dataset.win = '0');\n` +
        `  hideTag();\n` +
        `  stage.dataset.tint = '0';\n` +
        `  const m = M();\n` +
        `  worldJolt(count);\n` +
        `  startAccel(m.vmax, m.accelT, m.cruise);\n` +
        `  setState('roll');\n` +
        `}\n`
      ),
    },
    // ── L11: production pool/credits binding helpers + open sync ───────────
    {
      id: 'LKY-L11',
      why: 'bind roster/credits readouts and the pool drawer to production truth',
      find: /requestAnimationFrame\(\(\) => \{ const pc = document\.getElementById\('poolCount'\); if \(pc\) pc\.textContent = pad2\(POOL_N\(\)\); \}\);\n/,
      replace: (
        `requestAnimationFrame(() => { const pc = document.getElementById('poolCount'); if (pc) pc.textContent = pad2(POOL_N()); });\n` +
        `function productionFighterIndex(name){\n` +
        `  const id = String(name || '').toUpperCase();\n` +
        `  for (let i = 0; i < FIGHTERS.length; i++) if (FIGHTERS[i].id === id) return i;\n` +
        `  return -1;\n` +
        `}\n` +
        `function productionPoolIds(){\n` +
        `  const meta = window.APEX_ARSENAL_META;\n` +
        `  if (meta && typeof meta.poolLocked === 'function'){\n` +
        `    const pool = meta.poolLocked();\n` +
        `    if (Array.isArray(pool) && pool.length) return pool.map(n => String(n).toUpperCase());\n` +
        `  }\n` +
        `  return FIGHTERS.map(F => F.id);\n` +
        `}\n` +
        `function showPoolTag(text){\n` +
        `  const el = $('#poolTag'); if (!el) return;\n` +
        `  el.textContent = text; el.dataset.on = '1';\n` +
        `  clearTimeout(showPoolTag.__t);\n` +
        `  showPoolTag.__t = setTimeout(() => { el.dataset.on = '0'; }, 2200);\n` +
        `}\n` +
        `window.APEX_LUCKY_SYNC = function syncProductionState(){\n` +
        `  const meta = window.APEX_ARSENAL_META; if (!meta) return;\n` +
        `  const credits = typeof meta.credits === 'function' ? meta.credits() : S.scrap;\n` +
        `  S.scrap = Number(credits) || 0;\n` +
        `  const scrapEl = $('#scrap'); if (scrapEl) scrapEl.textContent = Number(S.scrap).toLocaleString('en-US');\n` +
        `  const pc = document.getElementById('poolCount'); if (pc) pc.textContent = pad2(POOL_N());\n` +
        `  const list = document.getElementById('drawerList');\n` +
        `  if (list){\n` +
        `    const pool = productionPoolIds();\n` +
        `    list.innerHTML = FIGHTERS.filter(F => pool.includes(F.id)).map((F, i) =>\n` +
        `      \`<div class="dr-row"><i style="background:\${F.col}"></i><b>\${F.id}</b><span>\${F.tag}</span></div>\`).join('');\n` +
        `  }\n` +
        `};\n`
      ),
    },
    // ── LKY-S1: the Lucky Draw plays the REAL Git UI-SFX cues ──────────────
    // The donor runs inside an iframe, so it must reach the ONE semantic UI-SFX
    // authority owned by the shell (window.parent) rather than build a second
    // manager. Every cue is a real Git cue from the 18-key pack.
    {
      id: 'LKY-S1',
      why: 'lucky draw cues resolve the ONE semantic UI-SFX authority (iframe-safe, no second manager)',
      find: /function rollFighter\(\(\{|function rollFighter\(\)\{/,
      replace: (
        `  // Owner law 2026-10-05: ONE semantic UI-SFX authority for the whole\n` +
        `  // product. The donor lives in an iframe, so it reaches the shell's\n` +
        `  // authority through window.parent and never builds a second manager.\n` +
        `  const LD_UI_SFX=()=>window.apexUiSfx||(window.parent&&window.parent.apexUiSfx)||null;\n` +
        `  function ldSfx(key){try{const s=LD_UI_SFX();if(s&&typeof s.play==='function')s.play(key);}catch(_){ }}\n` +
        `  function ldLoopStart(key){try{const s=LD_UI_SFX();if(s&&typeof s.startLoop==='function')s.startLoop(key);}catch(_){ }}\n` +
        `  function ldLoopStop(key){try{const s=LD_UI_SFX();if(s&&typeof s.stop==='function')s.stop(key);}catch(_){ }}\n` +
        `function rollFighter(){`
      ),
    },
    // ── LKY-S2: machine start + ONE continuous machine-run voice ───────────
    {
      id: 'LKY-S2',
      why: 'lucky draw machine start plays machine_start and the roll is ONE continuous machine_run voice',
      find: /  worldJolt\(count\);\n  startAccel\(m\.vmax, m\.accelT, m\.cruise\);\n  setState\('roll'\);/,
      replace: (
        `  worldJolt(count);\n` +
        `  ldSfx('lucky.draw.machine_start');\n` +
        `  // ONE continuous machine-run voice for the whole roll: starting an\n` +
        `  // already-running voice is a no-op, so it never restarts or stacks.\n` +
        `  ldLoopStart('lucky.draw.machine_run');\n` +
        `  startAccel(m.vmax, m.accelT, m.cruise);\n` +
        `  setState('roll');`
      ),
    },
    // ── LKY-S3: the reel stops on the final lock, then the charge builds ────
    {
      id: 'LKY-S3',
      why: 'the machine-run voice stops at the final lock and the reveal charge plays',
      find: /    S\.lastWinner = w; setState\('lock'\);\n    later\(S\.rm \? \.2 : \.42, reveal\);/,
      replace: (
        `    S.lastWinner = w; setState('lock');\n` +
        `    ldLoopStop('lucky.draw.machine_run');\n` +
        `    ldSfx('lucky.draw.reveal_charge');\n` +
        `    later(S.rm ? .2 : .42, reveal);`
      ),
    },
    // ── LKY-S4: the reward cue fires only on REAL reward visibility ────────
    {
      id: 'LKY-S4',
      why: 'lucky.reward.reveal plays only when the winning fighter is actually visible',
      find: /function reveal\(\)\{\n  const w = S\.lastWinner, m = M\(\), F = FIGHTERS\[w\];\n  setState\('reveal'\);/,
      replace: (
        `function reveal(){\n` +
        `  const w = S.lastWinner, m = M(), F = FIGHTERS[w];\n` +
        `  setState('reveal');\n` +
        `  // The reward is now genuinely on screen (the winning hero slot has\n` +
        `  // been populated and the reveal transition has started), so this is\n` +
        `  // the ONLY point the reward cue may fire.\n` +
        `  ldSfx('lucky.draw.reward_reveal');`
      ),
    },
    // ── R50I: roster/art comes from the same production presentation registry
    // as Fighter Pick. Economy ownership remains APEX_ARSENAL_META truth.
    {
      id: 'LKY-R50I-1',
      why: 'Lucky Draw runtime roster is registry-driven and can grow without per-hero Lucky code',
      find: /window\.APEX_LUCKY_SYNC = function syncProductionState\(\)\{[\s\S]*?\n\};\n/,
      replace: (
        `function productionLuckyRoster(){\n` +
        `  const direct = Array.isArray(window.APEX_GOLD_LUCKY_ROSTER) ? window.APEX_GOLD_LUCKY_ROSTER : null;\n` +
        `  if (direct && direct.length) return direct;\n` +
        `  try{\n` +
        `    const api = window.parent && window.parent.APEX_GOLD;\n` +
        `    if(api && typeof api.luckyRoster==='function') return api.luckyRoster() || [];\n` +
        `  }catch(_){ }\n` +
        `  return [];\n` +
        `}\n` +
        `function installFighterImage(F){\n` +
        `  F.imgBase = new Image(); F.imgBase.decoding='async'; F.imgBase.src = F.urlBase || '';\n` +
        `  F.imgFx = null;\n` +
        `  F.imgBase.onload = F.imgBase.onerror = () => scheduleCovers();\n` +
        `}\n` +
        `function syncProductionRoster(){\n` +
        `  const roster = productionLuckyRoster().filter(h => h && h.productionId && h.drawArt);\n` +
        `  if(!roster.length) return false;\n` +
        `  const sig = roster.map(h => [h.productionId,h.name,h.tag,h.accent,h.drawArt].join('|')).join('||');\n` +
        `  if(syncProductionRoster.sig===sig) return true;\n` +
        `  syncProductionRoster.sig=sig;\n` +
        `  const next = roster.map(h => ({\n` +
        `    key:String(h.shellKey||h.productionId).toLowerCase(), id:String(h.productionId).toUpperCase(),\n` +
        `    name:String(h.name||h.productionId).toUpperCase(), col:String(h.accent||'#8d8375'), tag:String(h.tag||''),\n` +
        `    urlBase:String(h.drawArt), urlFx:null, hero:{scale:1.03,x:'0%',y:'0%'}, cover:{focusX:.50,focusY:.48,scale:1.04}\n` +
        `  }));\n` +
        `  FIGHTERS.splice(0,FIGHTERS.length,...next);\n` +
        `  FIGHTERS.forEach(installFighterImage);\n` +
        `  if(typeof buildIdx==='function')buildIdx();\n` +
        `  scheduleCovers();\n` +
        `  return true;\n` +
        `}\n` +
        `window.APEX_LUCKY_SYNC = function syncProductionState(){\n` +
        `  syncProductionRoster();\n` +
        `  const meta = window.APEX_ARSENAL_META; if (!meta) return;\n` +
        `  const credits = typeof meta.credits === 'function' ? meta.credits() : S.scrap;\n` +
        `  S.scrap = Number(credits) || 0;\n` +
        `  const scrapEl = $('#scrap'); if (scrapEl) scrapEl.textContent = Number(S.scrap).toLocaleString('en-US');\n` +
        `  const pool = productionPoolIds();\n` +
        `  const pc = document.getElementById('poolCount'); if (pc) pc.textContent = pad2(pool.length);\n` +
        `  const list = document.getElementById('drawerList');\n` +
        `  if (list){\n` +
        `    list.innerHTML = FIGHTERS.filter(F => pool.includes(F.id)).map((F, i) =>\n` +
        `      \`<div class="drow"><span class="n">\${pad2(i+1)}</span><img src="\${F.urlBase}" alt=""><span>\${F.name||F.id}<small>\${F.tag}</small></span></div>\`).join('');\n` +
        `  }\n` +
        `};\n`
      ),
    },
    {
      id: 'LKY-R50I-2',
      why: 'LED reel keeps donor stripe treatment but renders production stand art as a black silhouette',
      find: /    g\.drawImage\(F\.imgBase, dx, dy, dw, dh\);\n    if \(F\.imgFx && F\.imgFx\.naturalWidth\) g\.drawImage\(F\.imgFx, dx, dy, dw, dh\);/,
      replace: (
        `    // Preserve the donor striped card/background, but identity on the\n` +
        `    // moving reel is an authored black silhouette cut from the SAME\n` +
        `    // production art that will be revealed after lock.\n` +
        `    g.save();\n` +
        `    g.globalAlpha=.94;\n` +
        `    g.filter='brightness(0) saturate(0)';\n` +
        `    g.drawImage(F.imgBase, dx, dy, dw, dh);\n` +
        `    g.filter='none';\n` +
        `    g.restore();`
      ),
    },
    {
      id: 'LKY-R50I-3',
      why: 'Lucky Draw labels display fighter identity names while production IDs remain spin/pool keys',
      find: /else if \(\$\('#plM'\)\.textContent !== FIGHTERS\[on\]\.id\) \$\('#plM'\)\.textContent = FIGHTERS\[on\]\.id;/,
      replace: `else if ($('#plM').textContent !== (FIGHTERS[on].name||FIGHTERS[on].id)) $('#plM').textContent = FIGHTERS[on].name||FIGHTERS[on].id;`,
    },
    {
      id: 'LKY-R50I-4',
      why: 'reward tag displays canonical fighter name, not storage id',
      find: /  \$\('#tagN'\)\.textContent = F\.id;/,
      replace: `  $('#tagN').textContent = F.name||F.id;`,
    },
  ];

  let out = applyPatches(donor, patches, 'lucky-draw');
  return out;
}

// ── shell → production ──────────────────────────────────────────────────────
function buildShell(hudProductionHtml) {
  const shell = read(path.join(GOLD_DIR, 'index.html')).toString('utf8');
  const REVISION = (() => {
    const manifest = read(path.join(REPO, 'src', 'game', 'runtimeManifest.js')).toString('utf8');
    const m = manifest.match(/APEX_ARSENAL_RUNTIME_REVISION\s*=\s*'([^']+)'/);
    if (!m) throw new Error('runtime revision constant not found');
    return m[1];
  })();

  const patches = [
    // ── S0: tab favicon is a production-only owner asset. Keep the canonical
    // profile avatar on its existing source; only the browser-tab icon changes.
    {
      id: 'SHL-S0',
      why: 'owner-provided APEX mark replaces only the browser tab favicon',
      find: '<link rel="icon" type="image/png" href="assets/gold/favicon-apex-chaos.png">',
      replace: '<link rel="icon" type="image/svg+xml" href="assets/gold/favicon-tab-apex.svg">',
    },
    {
      id: 'SHL-S0a',
      why: 'Mode art has no src until the user enters Mode',
      find: /<img src="assets\/gold\/(mode-(?:solo|local)\.webp)" alt="" draggable="false">/g,
      replace: '<img data-apex-src="assets/gold/$1" alt="" draggable="false">',
      all: true,
    },
    {
      id: 'SHL-S0b',
      why: 'Gold-Lab/reference-only Pick images are not part of production DOM',
      find: /\n  <img id="refOverlay" src="assets\/gold\/pick-reference-overlay\.png" alt="" aria-hidden="true" draggable="false">\n  <img src="assets\/gold\/pick-hidden-gold-source\.png" alt="" hidden aria-hidden="true">/,
      replace: '',
    },
    // ── S1: production bridge script, loaded before the canonical shell
    // script so roster/mode hooks exist at canonical script evaluation.
    {
      id: 'SHL-S1',
      why: 'install production bridge before the canonical shell script',
      find: /<script>\n\(\(\) => \{\n  'use strict';\n  const stage = document\.getElementById\('stage'\);/,
      replace: (
        `<script src="/game/ui/uiSfxAuthority.js?v=${REVISION}"></script>\n` +
        `<script src="/game/gold/goldProductBridge.js?v=${REVISION}"></script>\n` +
        `<script>\n(() => {\n  'use strict';\n  const stage = document.getElementById('stage');`
      ),
    },
    // ── S2: roster data comes from production (same HEROES contract) ───────
    {
      id: 'SHL-S2',
      why: 'HEROES resolved from the production roster bridge when present',
      find: /  const HEROES = (\{[\s\S]*?\});\n  const WORLD_ART/,
      replace: '  const HEROES = (window.APEX_GOLD_ROSTER || $1);\n  const WORLD_ART',
    },
    // ── S3: battle HUD mounts in the main document (live arena slot law) ───
    {
      id: 'SHL-S2a',
      why: 'production Fighter Pick world-stage consumes real selected-large art; Mirror alone keeps its runtime-derived special slot',
      find: /  const WORLD_ART = \{"hunter":"assets\/placeholders\/pick\/pose\/hunter-world\.svg","frost":"assets\/placeholders\/pick\/pose\/frost-world\.svg","mirror":"assets\/placeholders\/pick\/pose\/mirror-world-runtime-opponent-ghost\.svg"\};/,
      replace: '  const WORLD_ART = {"mirror":"assets/placeholders/pick/pose/mirror-world-runtime-opponent-ghost.svg"};',
    },
    {
      id: 'SHL-S3',
      why: 'srcdoc iframe mount replaced by same-document canonical mount (arena canvas must occupy the authored arena slot)',
      find: /    battleHudFrame\.srcdoc=decodeBattleHud\(\);/,
      replace: '    APEX_GOLD.mountBattleHud(decodeBattleHud(),()=>{battleHudReady=true;sendBattleHudConfig();});',
    },
    {
      id: 'SHL-S3a',
      why: 'mark the canonical shell stage so live Battle can suppress only the outgoing Home/Mode/Pick tree',
      find: '<main id="stage" aria-label="APEX CHAOS Home">',
      replace: '<main id="stage" data-apex-shell-stage="true" aria-label="APEX CHAOS Home">',
    },
    {
      id: 'SHL-S3b',
      why: 'same-document Battle donor also owns #stage; scope compositor suppression to the marked shell stage only',
      find: 'body.battle-hud-open #stage{visibility:hidden!important;pointer-events:none!important;content-visibility:hidden!important;contain:strict!important}',
      replace: 'body.battle-hud-open [data-apex-shell-stage="true"]{visibility:hidden!important;pointer-events:none!important;content-visibility:hidden!important;contain:strict!important}',
    },
    {
      id: 'SHL-S4',
      why: 'handoff postMessage targets the main window (same-document mount)',
      find: /battleHudFrame\.contentWindow\.postMessage\(battleHudConfig,'\*'\);/,
      replace: "window.postMessage(battleHudConfig,'*');\n    APEX_GOLD.onHandoff&&APEX_GOLD.onHandoff(battleHudConfig);",
    },
    {
      id: 'SHL-S5',
      why: 'handoff LIVE postMessage targets the main window',
      find: /battleHudFrame\.contentWindow\.postMessage\(\{type:'APEX_CHAOS_BATTLE_LIVE'\},'\*'\);/,
      replace: "window.postMessage({type:'APEX_CHAOS_BATTLE_LIVE'},'*');",
    },
    {
      id: 'SHL-S6',
      why: 'battle exit unmounts the production-mounted HUD',
      find: /battleHudFrame\.src='about:blank';/g,
      replace: 'APEX_GOLD.unmountBattleHud();',
      all: true,
    },
    // ── S7: production match start at the authored handoff beat ────────────
    {
      id: 'SHL-S7',
      why: 'real production match starts when the Gold transition reaches live',
      find: /  function setBattleLive\(\)\{\n    if\(!battleHudFrame\?\.contentWindow\)return;/,
      replace: (
        `  function setBattleLive(){\n` +
        `    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('battle');\n` +
        `    APEX_GOLD.onBattleLive&&APEX_GOLD.onBattleLive({mode:battleMode,p1:p1Hero,p2:p2Hero});\n` +
        `    if(!window.APEX_GOLD_HUD)return;`
      ),
    },
    {
      id: 'SHL-S8',
      why: 'mode selection notifies production (BOT/LOCAL profile)',
      find: /    battleMode=mode;\n/,
      replace: '    battleMode=mode;\n    APEX_GOLD.onMode&&APEX_GOLD.onMode(mode);\n',
    },
    // ── S9: owner music-key law + diagnostic affordances must not ship ─────
    {
      id: 'SHL-S9',
      why: 'remove shell M motion / P parallax / R reference-overlay diagnostics (owner M = music mute)',
      find: /    if\(k==='r'\)\{stage\.classList\.toggle\('ref-on'\);e\.preventDefault\(\);return\}\n    if\(k==='m'\)\{motion=!motion;syncModes\(\);e\.preventDefault\(\);return\}\n    if\(k==='p'\)\{parallax=!parallax;if\(!parallax\)\{tx=ty=0;cx=cy=0;stage\.style\.setProperty\('--mx','0'\);stage\.style\.setProperty\('--my','0'\)\}syncModes\(\);e\.preventDefault\(\);return\}\n/,
      replace: '',
    },
    // ── S10: Lucky Draw donor is the localized static production file ──────
    {
      id: 'SHL-S10',
      why: 'lucky donor blob payload replaced by the localized static donor (iframe boundary preserved)',
      find: /  function buildLuckyDonorURL\(\)\{\n    if\(donorObjectUrl\) return donorObjectUrl;\n    const comma=DONOR\.indexOf\(','\);\n    const b64=comma>=0\?DONOR\.slice\(comma\+1\):DONOR;\n    const bin=atob\(b64\);\n    const bytes=new Uint8Array\(bin\.length\);\n    const CHUNK=0x8000;\n    for\(let i=0;i<bin\.length;i\+=CHUNK\)\{\n      const end=Math\.min\(i\+CHUNK,bin\.length\);\n      for\(let j=i;j<end;j\+\+\) bytes\[j\]=bin\.charCodeAt\(j\);\n    \}\n    donorObjectUrl=URL\.createObjectURL\(new Blob\(\[bytes\],\{type:'text\/html;charset=utf-8'\}\)\);\n    return donorObjectUrl;\n  \}/,
      replace: "  function buildLuckyDonorURL(){\n    return '/gold/lucky-draw.html';\n  }",
    },
    {
      id: 'SHL-S11',
      why: 'drop the embedded base64 lucky donor payload (static file is authority)',
      find: /  const DONOR='data:text\/html;base64,[^']*';\n/,
      replace: '',
    },
    // ── S15: Quest/Shop/Upgrade/Dictionary/Missions/Account are lightly
    // locked extension points: visible, disabled/dimmed, never deleted.
    {
      id: 'SHL-S15',
      why: 'non-draw routes render as visible disabled locked extension points',
      find: /  <nav class="routes e-routes" aria-label="Main routes">\n    <button class="route" type="button" aria-label="Fighter Shop">/,
      replace: (
        `  <nav class="routes e-routes" aria-label="Main routes">\n` +
        `    <button class="route is-locked" type="button" aria-label="Fighter Shop (locked)" disabled><span class="notice"></span>`
      ),
    },
    {
      id: 'SHL-S16',
      why: 'locked routes: Upgrade',
      find: /<button class="route" type="button" aria-label="Upgrade">/,
      replace: '<button class="route is-locked" type="button" aria-label="Upgrade (locked)" disabled><span class="notice"></span>',
    },
    {
      id: 'SHL-S17',
      why: 'locked routes: Dictionary',
      find: /<button class="route" type="button" aria-label="Dictionary">/,
      replace: '<button class="route is-locked" type="button" aria-label="Dictionary (locked)" disabled><span class="notice"></span>',
    },
    {
      id: 'SHL-S18',
      why: 'locked routes: Missions (quests)',
      find: /<button class="route" type="button" aria-label="Missions">/,
      replace: '<button class="route is-locked" type="button" aria-label="Missions (locked)" disabled><span class="notice"></span>',
    },
    {
      id: 'SHL-S19',
      why: 'locked routes: Account',
      find: /<button class="route" type="button" aria-label="Account">/,
      replace: '<button class="route is-locked" type="button" aria-label="Account (locked)" disabled><span class="notice"></span>',
    },
    {
      id: 'SHL-S20',
      why: 'locked route styling (dimmed, non-interactive)',
      find: /\.route:not\(:last-child\)::after\{content:/,
      replace: '.route.is-locked{color:rgba(235,228,218,.34);cursor:not-allowed;filter:saturate(.4)}.route.is-locked svg{opacity:.5}\n.route:not(:last-child)::after{',
    },
    // ── S21: the Lucky Draw donor runs in its own document (the iframe
    // boundary is canonical for the draw). Hand it the REAL production economy
    // API on load, and re-sync credits/pool from production on every open: the
    // draw spends production AC against the canonical save, never donor scrap.
    // Same-origin object hand-off; the meta runtime keeps the parent's save.
    {
      id: 'SHL-S21',
      why: 'lucky iframe receives the production economy API and re-syncs on open',
      find: /  function openLucky\(\)\{\n    if\(!loaded\)\{\n      try\{\n        frame\.src=buildLuckyDonorURL\(\);\n        loaded=true;\n      \}catch\(err\)\{\n        console\.error\('\[APEX Lucky Draw\] donor load failed',err\);\n        return;\n      \}\n    \}\n    host\.classList\.add\('is-open'\);host\.setAttribute\('aria-hidden','false'\);\n  \}/,
      replace: (
        `  function handLuckyProductionApi(){\n` +
        `    try{\n` +
        `      const w=frame.contentWindow;\n` +
        `      if(!w)return;\n` +
        `      if(!w.APEX_ARSENAL_META&&window.APEX_ARSENAL_META)w.APEX_ARSENAL_META=window.APEX_ARSENAL_META;\n` +
        `      if(window.APEX_GOLD&&typeof window.APEX_GOLD.luckyRoster==='function')w.APEX_GOLD_LUCKY_ROSTER=window.APEX_GOLD.luckyRoster();\n` +
        `      if(typeof w.APEX_LUCKY_SYNC==='function')w.APEX_LUCKY_SYNC();\n` +
        `    }catch(err){/* the donor reports the draw unavailable; never break the shell */}\n` +
        `  }\n` +
        `  function openLucky(){\n` +
        `    if(!loaded){\n` +
        `      try{\n` +
        `        frame.src=buildLuckyDonorURL();\n` +
        `        loaded=true;\n` +
        `        frame.addEventListener('load',handLuckyProductionApi);\n` +
        `      }catch(err){\n` +
        `        console.error('[APEX Lucky Draw] donor load failed',err);\n` +
        `        return;\n` +
        `      }\n` +
        `    }else{\n` +
        `      handLuckyProductionApi();\n` +
        `    }\n` +
        `    host.classList.add('is-open');host.setAttribute('aria-hidden','false');\n` +
        `  }`
      ),
    },
    // ── S40: entering the Lucky Draw bay plays the real enter_bay cue ──────
    {
      id: 'SHL-S40',
      why: 'entering the Lucky Draw bay plays the real lucky.draw.enter_bay cue',
      find: /    host\.classList\.add\('is-open'\);host\.setAttribute\('aria-hidden','false'\);\n  \}/,
      replace: (
        `    host.classList.add('is-open');host.setAttribute('aria-hidden','false');\n` +
        `    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('lucky');\n` +
        `    uiSfx('lucky.draw.enter_bay');\n` +
        `  }`
      ),
    },
    // ── S41: focus movement plays the DEBOUNCED real focus-move cue ────────
    // Rapid keyboard/pointer focus changes must produce a single cue, never one
    // per event. The authority debounces this key itself.
    {
      id: 'SHL-S41',
      why: 'mode/fighter focus movement plays the debounced real ui.focus.move cue',
      find: /  function setModeFocus\(index\)\{\n    modeFocus=\(index\+modeCards\.length\)%modeCards\.length;/,
      replace: (
        `  function uiFocusMove(){try{const sfx=window.apexUiSfx;if(sfx&&typeof sfx.focusMove==='function')sfx.focusMove('ui.focus.move');}catch(_){}}\n` +
        `  function setModeFocus(index){\n` +
        `    if(index!==modeFocus)uiFocusMove();\n` +
        `    modeFocus=(index+modeCards.length)%modeCards.length;`
      ),
    },
    // ── S42: roster focus movement also plays the debounced focus-move cue ──
    {
      id: 'SHL-S42',
      why: 'fighter roster focus movement plays the debounced real ui.focus.move cue',
      find: /  function selectHero\(id\)\{\n    if\(screen!=='fighter'\) return;/,
      replace: (
        `  function selectHero(id){\n` +
        `    if(screen!=='fighter') return;\n` +
        `    uiFocusMove();`
      ),
    },
    // ── S46: the primary Home CTA is a real button press ───────────────────
    {
      id: 'SHL-S46',
      why: 'the primary Home CTA press plays the real ui.button.press cue',
      find: /  const story = document\.getElementById\('continueStory'\);/,
      replace: (
        `  const story = document.getElementById('continueStory');\n` +
        `  story?.addEventListener('click',()=>uiSfx('ui.button.press'));`
      ),
    },
    // ── S47: an ACCEPTED selection confirms the option ─────────────────────
    // Distinct from the light press cue: the press is tactile feedback, this
    // fires only when the selection is actually accepted into the active
    // player's slot (never on the rejected path above).
    {
      id: 'SHL-S47',
      why: 'an accepted hero selection plays the real ui.option.confirm cue',
      find: /    renderFighter\(\);\n    if\(motion\)\{stage\.classList\.remove\('hero-switch-impact'\)/,
      replace: (
        `    uiSfx('ui.option.confirm');\n` +
        `    renderFighter();\n` +
        `    if(motion){stage.classList.remove('hero-switch-impact')`
      ),
    },
    // ── S48: both fighters locked = match ready (BOT path) ─────────────────
    {
      id: 'SHL-S48',
      why: 'the BOT match-ready handoff plays the real fighter.match_ready cue',
      find: /handoffBanner\.textContent='BATTLE HANDOFF READY';launchBattleHud\(\)/,
      replace: (
        `handoffBanner.textContent='BATTLE HANDOFF READY';\n` +
        `      uiSfx('fighter.match_ready');\n` +
        `      launchBattleHud()`
      ),
    },
    // ── S49: both fighters locked = match ready (local 1v1 path) ───────────
    {
      id: 'SHL-S49',
      why: 'the local 1v1 match-ready handoff plays the real fighter.match_ready cue',
      find: /handoffBanner\.textContent='BOTH FIGHTERS LOCKED';launchBattleHud\(\)/,
      replace: (
        `handoffBanner.textContent='BOTH FIGHTERS LOCKED';\n` +
        `    uiSfx('fighter.match_ready');\n` +
        `    launchBattleHud()`
      ),
    },
    // ── S43: back/cancel plays the real back cue ───────────────────────────
    {
      id: 'SHL-S43',
      why: 'back/cancel plays the real ui.back.cancel cue',
      find: /  function back\(\)\{\n    if\(screen==='fighter'\)\{/,
      replace: (
        `  function back(){\n` +
        `    uiSfx('ui.back.cancel');\n` +
        `    if(screen==='fighter'){`
      ),
    },
    // ── S22: BOT OPPONENT = ONE TRUTH (2026-10-05 correction slice) ─────────
    // The presentation, the battle-entry transition, the HUD handoff and the
    // actually spawned fighter must all show the SAME BOT production identity.
    // The production CPU identity is the single authority; the shell derives
    // its presentation from it and never hardcodes a second one.
    {
      id: 'SHL-S22a',
      why: 'shell derives the BOT opponent presentation identity from production (single truth)',
      find: /  function makeBattleConfig\(live=false\)\{/,
      replace: (
        `  // BOT opponent identity: ONE truth, read from production. Presentation,\n` +
        `  // transition, handoff and the spawned fighter all use this value.\n` +
        `  function botHeroId(){\n` +
        `    try{\n` +
        `      const g=window.APEX_GOLD;\n` +
        `      if(g&&typeof g.botOpponentProductionId==='function'){\n` +
        `        const id=g.botOpponentProductionId();\n` +
        `        if(id&&HEROES[id])return id;\n` +
        `      }\n` +
        `    }catch(_){}\n` +
        `    return 'newbot';\n` +
        `  }\n` +
        `  function makeBattleConfig(live=false){`
      ),
    },
    {
      id: 'SHL-S22b',
      why: 'battle handoff + transition identity stop hardcoding a second BOT identity',
      all: true,
      find: "bot?heroPayload('frost','newbot')",
      replace: "bot?heroPayload(botHeroId(),'newbot')",
    },
    // ── S23: roster order derives from production authority (no hard cap) ───
    // Every production-visible fighter appears: the playable Core Six are
    // selectable, production-visible future fighters are locked extension
    // points. Nothing is silently omitted.
    {
      id: 'SHL-S23a',
      why: 'roster order derives from the production-visible authority instead of a hardcoded six-card list',
      find: /  const HERO_ORDER = \[.*?\];/,
      replace: (
        `  const HERO_ORDER = (function productionRosterOrder(){\n` +
        `    const base=['newbot','hunter','crystala','magnet','frost','mirror'];\n` +
        `    try{\n` +
        `      const g=window.APEX_GOLD;\n` +
        `      const order=g&&typeof g.rosterOrder==='function'?g.rosterOrder():null;\n` +
        `      if(Array.isArray(order)&&order.length){\n` +
        `        const seen=new Set(); const out=[];\n` +
        `        order.concat(base,Object.keys(HEROES)).forEach(id=>{if(id&&!seen.has(id)){seen.add(id);out.push(id)}});\n` +
        `        return out;\n` +
        `      }\n` +
        `    }catch(_){}\n` +
        `    return base;\n` +
        `  })();`
      ),
    },
    {
      id: 'SHL-S23b',
      why: 'roster cards render the production-visible roster, with future fighters as locked extension points',
      find: /  function buildRoster\(\)\{\n    roster\.innerHTML='';\n    HERO_ORDER\.forEach\(\(id,idx\)=>\{\n      const h=HEROES\[id\]; const b=document\.createElement\('button'\); b\.type='button'; b\.className='rosterCard'; b\.dataset\.hero=id; b\.setAttribute\('aria-label',h\.name\);\n/,
      replace: (
        `  // Playability is production authority; a visible-but-not-playable\n` +
        `  // fighter is a locked extension point, never fake playable mechanics.\n` +
        `  function heroIsPlayable(id){\n` +
        `    try{\n` +
        `      const g=window.APEX_GOLD;\n` +
        `      if(g&&typeof g.isPlayable==='function')return g.isPlayable(id);\n` +
        `    }catch(_){}\n` +
        `    return true;\n` +
        `  }\n` +
        `  function buildRoster(){\n` +
        `    roster.innerHTML='';\n` +
        `    HERO_ORDER.forEach((id,idx)=>{\n` +
        `      const h=HEROES[id]||{}; const playable=heroIsPlayable(id); const b=document.createElement('button'); b.type='button'; b.className='rosterCard'+(playable?'':' is-locked'); b.dataset.hero=id; b.setAttribute('aria-label',h.name||id);\n`
      ),
    },
    {
      id: 'SHL-S23c',
      why: 'locked roster cards are visibly non-selectable extension points (composition preserved)',
      find: /      b\.innerHTML=`<span class="rosterMarker p1">P1<\/span><span class="rosterMarker p2">P2<\/span><img src="\$\{h\.portrait\}" alt="" draggable="false"><span class="rosterName">\$\{h\.name\}<\/span>`;/,
      replace: (
        `      b.innerHTML=\`<span class=\"rosterMarker p1\">P1</span><span class=\"rosterMarker p2\">P2</span><img src=\"\${h.portrait||''}\" alt=\"\" draggable=\"false\"><span class=\"rosterName\">\${h.name||id}</span>\`+(playable?'':'<span class=\"rosterLock\">LOCKED</span>');\n` +
        `      if(!playable){b.disabled=true;b.title='LOCKED — EXTENSION POINT';}`
      ),
    },
    {
      id: 'SHL-S23d',
      why: 'locked roster card styling',
      find: /\n\.rosterCard\.p1-selected\{border-color:rgba\(255,148,31,\.92\);/,
      replace: (
        `.rosterCard.is-locked{opacity:.42;filter:grayscale(.7)}.rosterCard.is-locked .rosterLock{position:absolute;left:0;right:0;bottom:6px;font-size:9px;letter-spacing:.18em;color:#ffb45a;text-align:center}\n` +
        `.rosterCard.p1-selected{`
      ),
    },
    {
      id: 'SHL-S13',
      why: 'fighter selection respects production ownership (economy gate)',
      find: /  function selectHero\(id\)\{\n    if\(screen!=='fighter'\) return;\n/,
      replace: (
        `  function selectHero(id){\n` +
        `    if(screen!=='fighter') return;\n` +
        `    // A hero that is not selectable is a real REJECTED action: it has its\n` +
        `    // own cue, and it must not fall through to the press/focus cues.\n` +
        `    if(window.APEX_GOLD_LOCKED&&window.APEX_GOLD_LOCKED(id)){uiSfx('ui.action.rejected');return;}\n`
      ),
    },
    {
      id: 'SHL-S14',
      why: 'roster cards render the production locked state',
      find: /      b\.addEventListener\('click',\(\)=>selectHero\(id\)\);/,
      replace: (
        `      if(window.APEX_GOLD_LOCKED&&window.APEX_GOLD_LOCKED(id))b.classList.add('is-locked');\n` +
        `      b.addEventListener('click',()=>{uiSfx('ui.button.press');selectHero(id)});`
      ),
    },
    // ── S24: battle HUD portrait uses the R44 BATTLE_HUD_AVATAR authority ──
    // The roster cover is the compact presentation; the per-side battle HUD
    // portrait must come from the immutable Git art authority.
    {
      id: 'SHL-S24',
      why: 'battle handoff portrait uses the BATTLE_HUD_AVATAR Git authority',
      find: /portrait:h\.portrait\|\|''/,
      replace: "portrait:h.battleAvatar||h.portrait||''",
    },
    // ── S25: no broken/placeholder image for a hero without a static pose ───
    // Mirror deliberately has NO pick_selected_large (owner decision).
    {
      id: 'SHL-S25',
      why: 'selected-pose art skips heroes with no static selected pose (mirror)',
      find: /    const img=new Image\(\); img\.className='heroAsset'/,
      replace: (
        `    if(!HEROES[id]||!HEROES[id].art)return;\n` +
        `    const img=new Image(); img.className='heroAsset'`
      ),
    },
    // ── S26: world-stage fallback never resolves to an empty src ────────────
    // ── S27: Home story copy is RIGHT-aligned (accepted Gold) ─────────────
    // Scoped to the authored Home story-copy block ONLY (the exact three
    // <br>-separated lines). Line breaks, text, typography, hierarchy and the
    // authored responsive behaviour (.copy{display:none}) are untouched, and
    // no other UI text is globally right-aligned.
    // ── S30: the synthetic UI oscillator authority is REMOVED ─────────────
    // uiThud() synthesised triangle+square oscillators through its own
    // AudioContext (one context, but a second synthetic SFX authority). Owner
    // law: every UI cue is a REAL Git cue played through the ONE semantic
    // UI-SFX authority. No synthetic oscillator survives in the product shell.
    {
      id: 'SHL-S30',
      why: 'synthetic UI oscillator authority (uiThud) removed in favour of the real Git UI-SFX pack',
      find: /  let uiAudio=null;\n  function uiThud\(power=1\)\{[\s\S]*?\n  \}\n/,
      replace: (
        `  // Owner law 2026-10-05: no synthetic oscillator authority. Every UI\n` +
        `  // cue is a real Git cue through the ONE semantic UI-SFX authority\n` +
        `  // (public/game/ui/uiSfxAuthority.js) — one cached element per key.\n` +
        `  function uiSfx(key){try{const sfx=window.apexUiSfx;if(sfx&&typeof sfx.play==='function')sfx.play(key);}catch(_){}}\n`
      ),
    },
    // Mode→Fighter Pick is an authored screen transition.
    {
      id: 'SHL-S31',
      why: 'mode commit plays the real ui.screen.transition cue (Mode -> Fighter Pick)',
      find: /    uiThud\(1\);/,
      replace: `    uiSfx('ui.screen.transition');`,
    },
    // Fighter lock-in has its own real cue (ui.button.press must not stack under it).
    {
      id: 'SHL-S32',
      why: 'fighter lock-in plays the real fighter.lock_in cue',
      find: /uiThud\(\.88\);/,
      replace: `uiSfx('fighter.lock_in');`,
    },
    // ── S39: Home -> Mode plays the real ui.screen.transition cue ──────────
    {
      id: 'SHL-S39',
      why: 'Home -> Mode plays the real ui.screen.transition cue',
      find: /  battle\.addEventListener\('click',\(\)=>setScreen\('mode'\)\);/,
      replace: (
        `  battle.addEventListener('click',()=>{uiSfx('ui.screen.transition');setScreen('mode')});`
      ),
    },
    // ── S33: battle-entry transition retimed to a readable beat ────────────
    // The owner reported an "extremely brief" beat. The six authored phases are
    // re-timed to ≈1.65 s (still well short of a loading screen) while every
    // phase keeps its place, the is-reveal beat keeps >= the 430 ms authored
    // CSS transition, and prefers-reduced-motion still collapses to 24 ms.
    {
      id: 'SHL-S33',
      why: 'battle-entry transition retimed from 1.17 s to a readable 1.65 s',
      find: /    if\(!await transitionDelay\(110,token\)\)return;/,
      replace: `    if(!await transitionDelay(180,token))return;`,
    },
    {
      id: 'SHL-S34',
      why: 'battle-entry transition retiming: clamp -> freeze beat',
      find: /    if\(!await transitionDelay\(155,token\)\)return;/,
      replace: `    if(!await transitionDelay(240,token))return;`,
    },
    {
      id: 'SHL-S35',
      why: 'battle-entry transition retiming: freeze -> seam beat',
      find: /    if\(!await transitionDelay\(150,token\)\)return;\n    battleTransition\.classList\.add\('phase-seam'\);/,
      replace: (
        `    if(!await transitionDelay(240,token))return;\n` +
        `    battleTransition.classList.add('phase-seam');`
      ),
    },
    {
      id: 'SHL-S36',
      why: 'battle-entry transition retiming: seam -> open beat',
      find: /    if\(!await transitionDelay\(170,token\)\)return;/,
      replace: `    if(!await transitionDelay(260,token))return;`,
    },
    {
      id: 'SHL-S37',
      why: 'battle-entry transition retiming: is-reveal beat (>= the authored 430 ms CSS transition)',
      find: /    if\(!await transitionDelay\(430,token\)\)return;/,
      replace: `    if(!await transitionDelay(520,token))return;`,
    },
    {
      id: 'SHL-S38',
      why: 'battle-entry transition retiming: open -> live beat',
      find: /    if\(!await transitionDelay\(150,token\)\)return;\n    resetBattleTransitionVisuals\(\);/,
      replace: (
        `    if(!await transitionDelay(210,token))return;\n` +
        `    resetBattleTransitionVisuals();`
      ),
    },
    // ── S28: real Git transition SFX replace the synthetic oscillator ──────
    // The seal-phase beep was a short-lived TRIANGLE oscillator (240→640 Hz,
    // 140 ms) — the "strange triangular/noise beat" the owner reported. The
    // whole synthetic oscillator authority is removed and the three authored
    // battle-transition phases now play the REAL Git cues through the ONE
    // semantic UI-SFX authority: lock_impact on phase-lock, clamp_rail on
    // phase-clamp, seam_open on phase-seam. No oscillator, no per-frame
    // retrigger, no second AudioContext.
    {
      id: 'SHL-S28',
      why: 'synthetic oscillator transition SFX replaced by the real Git battle-transition cues',
      find: /  function transitionSound\(kind\)\{[\s\S]*?\n  \}\n/,
      replace: (
        `  const TRANSITION_SFX={'lock':'battle.transition.lock_impact','rail':'battle.transition.clamp_rail','seal':'battle.transition.seam_open'};\n` +
        `  const transitionSfxPlayed=new Set();\n` +
        `  function transitionSound(kind){\n` +
        `    try{\n` +
        `      const key=TRANSITION_SFX[kind];if(!key)return;\n` +
        `      // Each authored phase cue fires exactly once per transition.\n` +
        `      if(transitionSfxPlayed.has(key))return;\n` +
        `      transitionSfxPlayed.add(key);\n` +
        `      const sfx=window.apexUiSfx;\n` +
        `      if(sfx&&typeof sfx.play==='function')sfx.play(key);\n` +
        `    }catch(_){ }\n` +
        `  }\n`
      ),
    },
    // ── S29: the once-per-transition cue set resets when a transition starts ─
    {
      id: 'SHL-S29',
      why: 'transition SFX fire exactly once per transition (reset on launch)',
      find: /    screen='transition';\n    battleHudReady=false;\n    battleHudConfig=makeBattleConfig\(false\);/,
      replace: (
        `    screen='transition';\n` +
        `    battleHudReady=false;\n` +
        `    transitionSfxPlayed.clear();\n` +
        `    battleHudConfig=makeBattleConfig(false);`
      ),
    },
    {
      id: 'SHL-S27',
      why: 'Home story hierarchy shares one Gold-authored left edge and defeats legacy global paragraph centering',
      find: /section\.story\.e-story::before,\nsection\.story\.e-story::after\{content:none!important;display:none!important;background:none!important;box-shadow:none!important;backdrop-filter:none!important\}/,
      replace: (matched) => (\n        `${matched}\\n` +\n        `section.story.e-story,section.story.e-story .quest,section.story.e-story .storyTitle,section.story.e-story .location,section.story.e-story .copy{text-align:left!important}\\n` +\n        `section.story.e-story .location,section.story.e-story .copy{margin-left:0!important}`\n      ),
    },
    {
      id: 'SHL-S26',
      why: 'world-stage consumes production PICK_SELECTED_LARGE for every static Core Six hero; Mirror preserves the runtime-derived ghost slot',
      find: (src) => {
        const needle = [
          "    if(id==='newbot'){",
          "      const source=document.querySelector('#stage > .heroWrap');",
          "      if(source){",
          "        const clone=source.cloneNode(true); clone.classList.remove('e-bot'); clone.removeAttribute('aria-hidden'); body.appendChild(clone);",
          "      }",
          "    }else{",
          "      const img=new Image(); img.className='worldHeroAsset'; img.alt=''; img.draggable=false; img.src=WORLD_ART[id]||h.art;",
          "      if(WORLD_ART[id]) img.classList.add('is-cutout');",
          "      body.appendChild(img);",
          "      if(id==='hunter'||id==='frost'||id==='mirror'){",
          "        const echo=img.cloneNode(); echo.className='worldHeroFxAsset '+id; body.appendChild(echo);",
          "      }",
          "      if(id==='magnet') body.insertAdjacentHTML('beforeend','<span class=\"magnetOrbit ringA\"></span><span class=\"magnetOrbit ringB\"></span>');",
          "      if(id==='crystala') body.insertAdjacentHTML('beforeend','<span class=\"crystalPulse\"></span>');",
          "    }",
          "    container.appendChild(body);",
        ].join('\n');
        return src.includes(needle) ? needle : null;
      },
      replace: (
        `    {\n` +
        `      const worldSrc=id==='mirror'?WORLD_ART.mirror:h?.art;\n` +
        `      if(!worldSrc)return;\n` +
        `      const img=new Image(); img.className='worldHeroAsset'; img.alt=''; img.draggable=false; img.src=worldSrc;\n` +
        `      if(id==='mirror'&&WORLD_ART.mirror) img.classList.add('is-cutout');\n` +
        `      body.appendChild(img);\n` +
        `      if(id==='hunter'||id==='frost'||id==='mirror'){\n` +
        `        const echo=img.cloneNode(); echo.className='worldHeroFxAsset '+id; body.appendChild(echo);\n` +
        `      }\n` +
        `      if(id==='magnet') body.insertAdjacentHTML('beforeend','<span class=\"magnetOrbit ringA\"></span><span class=\"magnetOrbit ringB\"></span>');\n` +
        `      if(id==='crystala') body.insertAdjacentHTML('beforeend','<span class=\"crystalPulse\"></span>');\n` +
        `    }\n` +
        `    container.appendChild(body);`
      ),
    },
    // ── R46A: surface + battle-exit ownership is explicit and singular ─────
    {
      id: 'SHL-S50',
      why: 'Home/Mode/Fighter screen changes notify the ONE product music surface authority',
      find: /    screen=next; stage\.classList\.toggle\('screen-mode',next==='mode'\);/,
      replace: "    screen=next; APEX_GOLD.onSurface&&APEX_GOLD.onSurface(next); stage.classList.toggle('screen-mode',next==='mode');",
    },
    {
      id: 'SHL-S51',
      why: 'battle transition explicitly owns the transition music surface',
      find: /    screen='transition';\n    battleHudReady=false;\n    transitionSfxPlayed\.clear\(\);/,
      replace: (
        `    screen='transition';\n` +
        `    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('transition');\n` +
        `    battleHudReady=false;\n` +
        `    transitionSfxPlayed.clear();`
      ),
    },
    {
      id: 'SHL-S52',
      why: 'cancelling battle transition returns music ownership to Fighter Pick',
      find: /  function cancelBattleTransition\(\)\{[\s\S]*?\n  \}(?=\n  function closeBattleHud)/,
      replace: (matched) => matched.replace(
        "    screen='fighter';",
        "    screen='fighter';\n    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('fighter');"
      ),
    },
    {
      id: 'SHL-S53',
      why: 'closing a live Gold battle tears down the engine without opening legacy menu, then returns to Fighter Pick',
      find: /  function closeBattleHud\(\)\{[\s\S]*?\n  \}(?=\n  addEventListener\('message')/,
      replace: (matched) => matched
        .replace(
          "    resumeParentRuntime();",
          "    APEX_GOLD.exitBattle&&APEX_GOLD.exitBattle();\n    resumeParentRuntime();"
        )
        .replace(
          "    screen='fighter';",
          "    screen='fighter';\n    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('fighter');"
        ),
    },
    {
      id: 'SHL-S54',
      why: 'Gold shell boot announces Home without materializing Fighter Pick assets',
      find: /  buildRoster\(\); renderFighter\(\);/,
      replace: "  APEX_GOLD.onSurface&&APEX_GOLD.onSurface('home');",
    },
    {
      id: 'SHL-S55',
      why: 'closing Lucky Draw returns the theme to Home without resetting its playhead',
      find: /  function closeLucky\(\)\{host\.classList\.remove\('is-open'\);host\.setAttribute\('aria-hidden','true'\);openBtn\?\.focus\?\.\(\{preventScroll:true\}\);\}/,
      replace: (
        `  function closeLucky(){\n` +
        `    host.classList.remove('is-open');host.setAttribute('aria-hidden','true');\n` +
        `    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('home');\n` +
        `    openBtn?.focus?.({preventScroll:true});\n` +
        `  }`
      ),
    },
  ];

  let out = applyPatches(shell, patches, 'shell');
  // ── R48A owner Fighter Pick adaptation ─────────────────────────────────
  // This is a deterministic post-patch on the generated shell so the Gold
  // canonical source remains immutable while shipping behaviour follows owner
  // feedback. Every replacement asserts its source seam before mutation.
  const r48ReplaceOnce = (needle, replacement, label) => {
    const i = out.indexOf(needle);
    if (i < 0 || out.indexOf(needle, i + needle.length) >= 0) throw new Error(`R48A ${label} seam mismatch`);
    out = out.slice(0, i) + replacement + out.slice(i + needle.length);
  };
  r48ReplaceOnce("  const WORLD_ART = {\"mirror\":\"assets/placeholders/pick/pose/mirror-world-runtime-opponent-ghost.svg\"};", "  const WORLD_ART = {};", 'Mirror placeholder');
  r48ReplaceOnce("  let p1Hero='newbot', p2Hero='newbot', p1Locked=false, p2Locked=false, p2Empty=true, transitionTimer=0;", "  let p1Hero='newbot', p2Hero='newbot', p1Locked=false, p2Locked=false, p2Empty=true, p1HasPicked=false, p2HasPicked=false, transitionTimer=0;", 'pick state');
  {
    const re = /  function renderWorldHero\(container,id,player\)\{[\s\S]*?\n  \}(?=\n\n  function renderSide\(side,id,player,locked\))/;
    if (!re.test(out)) throw new Error('R48A renderWorldHero seam mismatch');
    out = out.replace(re, "  function mirrorOpponentHero(player){\n    if(battleMode==='bot') return null;\n    if(player==='p1'){\n      if(!p2HasPicked || p2Empty || p2Hero==='mirror') return null;\n      return p2Hero;\n    }\n    if(!p1HasPicked || p1Hero==='mirror') return null;\n    return p1Hero;\n  }\n\n  function renderWorldHero(container,id,player){\n    const h=HEROES[id];\n    const mirrorSource=id==='mirror'?mirrorOpponentHero(player):null;\n    const renderId=id==='mirror'?mirrorSource:id;\n    const sourceHero=renderId?HEROES[renderId]:null;\n    const nextKey=id==='mirror'?('mirror:'+(renderId||'empty')):id;\n    const oldKey=container.dataset.renderKey||container.dataset.hero||'';\n    const changed=oldKey!==nextKey;\n    let ghost=null;\n    if(changed&&motion){\n      const prev=container.querySelector('.worldHeroBody');\n      if(prev){ghost=prev.cloneNode(true);ghost.classList.add('worldHeroGhost');ghost.dataset.oldHero=container.dataset.hero||'';}\n    }\n    container.style.setProperty('--heroTint',h?.accent||'#ff941f');\n    container.dataset.hero=id;\n    container.dataset.renderKey=nextKey;\n    container.innerHTML='';\n    if(ghost){container.appendChild(ghost);setTimeout(()=>ghost.remove(),260)}\n    if(!renderId || !sourceHero?.art){\n      if(changed&&motion){container.classList.remove('is-changing');setTimeout(()=>container.classList.remove('is-changing'),360);}\n      return;\n    }\n    const body=document.createElement('div'); body.className='worldHeroBody';\n    const img=new Image(); img.className='worldHeroAsset'; img.alt=''; img.draggable=false; img.src=sourceHero.art;\n    if(id==='mirror') img.classList.add('mirrorOpponentAsset');\n    body.appendChild(img);\n    if(id==='hunter'||id==='frost'){const echo=img.cloneNode(); echo.className='worldHeroFxAsset '+id; body.appendChild(echo);}\n    if(id==='magnet') body.insertAdjacentHTML('beforeend','<span class=\"magnetOrbit ringA\"></span><span class=\"magnetOrbit ringB\"></span>');\n    if(id==='crystala') body.insertAdjacentHTML('beforeend','<span class=\"crystalPulse\"></span>');\n    container.appendChild(body);\n    if(changed&&motion){container.classList.remove('is-changing'); void container.offsetWidth; container.classList.add('is-changing');setTimeout(()=>container.classList.remove('is-changing'),380);}\n  }");
  }
  {
    const re = /  function buildRoster\(\)\{[\s\S]*?\n  \}(?=\n\n  function renderFighter\(\))/;
    if (!re.test(out)) throw new Error('R48A buildRoster seam mismatch');
    out = out.replace(re, "  function buildRoster(){\n    roster.innerHTML='';\n    HERO_ORDER.forEach((id,idx)=>{\n      const h=HEROES[id]||{};\n      const playable=heroIsPlayable(id);\n      const lockedByAuthority=!!(window.APEX_GOLD_LOCKED&&window.APEX_GOLD_LOCKED(id));\n      const locked=!playable||lockedByAuthority;\n      const b=document.createElement('button');\n      b.type='button';\n      b.className='rosterCard'+(locked?' is-locked':'');\n      b.dataset.hero=id;\n      b.setAttribute('aria-label',h.name||id);\n      const portrait=h.portrait\n        ? `<img src=\"${h.portrait}\" alt=\"\" draggable=\"false\">`\n        : '<span class=\"rosterLockedVisual\" aria-hidden=\"true\"></span>';\n      b.innerHTML=`<span class=\"rosterMarker p1\">P1</span><span class=\"rosterMarker p2\">P2</span>${portrait}<span class=\"rosterName\">${h.name||id}</span>`+(locked?'<span class=\"rosterLock\" aria-hidden=\"true\"><i></i><b>LOCKED</b></span>':'');\n      if(!playable){b.disabled=true;b.title='LOCKED — EXTENSION POINT';}\n      const img=b.querySelector('img');\n      if(img)img.addEventListener('error',()=>{\n        img.remove();\n        if(!b.querySelector('.rosterLockedVisual'))b.insertAdjacentHTML('afterbegin','<span class=\"rosterLockedVisual\" aria-hidden=\"true\"></span>');\n        b.classList.add('art-missing');\n      },{once:true});\n      b.addEventListener('click',()=>{uiSfx('ui.button.press');selectHero(id)});\n      b.addEventListener('pointerenter',()=>{ if(screen==='fighter' && !p1Locked && activePlayer==='p1'){} });\n      roster.appendChild(b);\n    });\n  }");
  }
  r48ReplaceOnce("    activePlayer='p1'; p1Locked=false; p2Locked=false; p1Hero='newbot'; p2Hero='newbot'; p2Empty=mode!=='bot';", "    activePlayer='p1'; p1Locked=false; p2Locked=false; p1Hero='newbot'; p2Hero='newbot'; p2Empty=mode!=='bot'; p1HasPicked=false; p2HasPicked=false;", 'mode reset');
  r48ReplaceOnce("    if(battleMode==='bot'){if(p1Locked)return;p1Hero=id;activePlayer='p1'}\n    else if(activePlayer==='p1'&&!p1Locked)p1Hero=id; else if(activePlayer==='p2'&&!p2Locked){p2Hero=id;p2Empty=false} else return;", "    if(battleMode==='bot'){if(p1Locked)return;p1Hero=id;p1HasPicked=true;activePlayer='p1'}\n    else if(activePlayer==='p1'&&!p1Locked){p1Hero=id;p1HasPicked=true} else if(activePlayer==='p2'&&!p2Locked){p2Hero=id;p2Empty=false;p2HasPicked=true} else return;", 'selectHero picked');
  r48ReplaceOnce("      if(!p1Locked){p1Locked=true;renderFighter();stage.classList.add('match-ready');handoffBanner.textContent='BATTLE HANDOFF READY';", "      if(!p1Locked){p1HasPicked=true;p1Locked=true;renderFighter();stage.classList.add('match-ready');handoffBanner.textContent='BATTLE HANDOFF READY';", 'BOT lock picked');
  r48ReplaceOnce("    if(activePlayer==='p1'&&!p1Locked){p1Locked=true;activePlayer='p2';p2Hero='newbot';p2Empty=false;renderFighter();", "    if(activePlayer==='p1'&&!p1Locked){p1HasPicked=true;p1Locked=true;activePlayer='p2';p2Hero='newbot';p2Empty=false;p2HasPicked=false;renderFighter();", 'P1 lock picked');
  r48ReplaceOnce("    if(activePlayer==='p2'&&!p2Locked){p2Locked=true;renderFighter();stage.classList.add('match-ready');handoffBanner.textContent='BOTH FIGHTERS LOCKED';", "    if(activePlayer==='p2'&&!p2Locked){p2HasPicked=true;p2Locked=true;renderFighter();stage.classList.add('match-ready');handoffBanner.textContent='BOTH FIGHTERS LOCKED';", 'P2 lock picked');
  r48ReplaceOnce("</head>", "<style id=\"r48a-fighter-pick-adaptation\">\n.worldHeroGhost{animation:r48HeroRetreatP1 150ms cubic-bezier(.28,.02,.5,1) both!important}\n.worldHeroSlot.p2 .worldHeroGhost{animation-name:r48HeroRetreatP2!important}\n.worldHeroSlot.is-changing>.worldHeroBody{animation:r48HeroEnterP1 220ms cubic-bezier(.12,.9,.18,1) 145ms both!important}\n.worldHeroSlot.p2.is-changing>.worldHeroBody{animation-name:r48HeroEnterP2!important}\n@keyframes r48HeroRetreatP1{0%{opacity:1;transform:none;filter:brightness(.9) saturate(.86)}100%{opacity:0;transform:translate3d(-2.8vw,4px,0) scale(.82);filter:brightness(.45) saturate(.34) blur(1px)}}\n@keyframes r48HeroRetreatP2{0%{opacity:1;transform:none;filter:brightness(.9) saturate(.86)}100%{opacity:0;transform:translate3d(2.8vw,4px,0) scale(.82);filter:brightness(.45) saturate(.34) blur(1px)}}\n@keyframes r48HeroEnterP1{0%{opacity:0;transform:translate3d(-3.2vw,3px,0) scale(.84);filter:brightness(.56) saturate(.48)}68%{opacity:1;transform:translate3d(.45vw,-1px,0) scale(1.008);filter:brightness(1.05) saturate(1)}100%{opacity:1;transform:none;filter:none}}\n@keyframes r48HeroEnterP2{0%{opacity:0;transform:translate3d(3.2vw,3px,0) scale(.84);filter:brightness(.56) saturate(.48)}68%{opacity:1;transform:translate3d(-.45vw,-1px,0) scale(1.008);filter:brightness(1.05) saturate(1)}100%{opacity:1;transform:none;filter:none}}\n.worldHeroSlot.p1[data-hero=\"hunter\"] .worldHeroAsset{transform:scale(.60)!important;scale:1 1!important;transform-origin:50% 58%!important}\n.worldHeroSlot.p2[data-hero=\"hunter\"] .worldHeroAsset{transform:scale(.60)!important;scale:-1 1!important;transform-origin:50% 58%!important}\n.worldHeroSlot.p1[data-hero=\"hunter\"] .worldHeroFxAsset{scale:.60 .60!important}\n.worldHeroSlot.p2[data-hero=\"hunter\"] .worldHeroFxAsset{scale:-.60 .60!important}\n.worldHeroSlot.p1[data-hero=\"frost\"] .worldHeroAsset,.worldHeroSlot.p2[data-hero=\"frost\"] .worldHeroAsset{transform:translateY(14%)!important;scale:-2.5 2.5!important;transform-origin:50% 72%!important;object-position:50% 66%!important}\n.worldHeroSlot.p1[data-hero=\"frost\"] .worldHeroFxAsset,.worldHeroSlot.p2[data-hero=\"frost\"] .worldHeroFxAsset{translate:0 14%!important;scale:-2.5 2.5!important;transform-origin:50% 72%!important}\n.worldHeroSlot[data-hero=\"mirror\"] .mirrorOpponentAsset{opacity:.82!important;filter:brightness(.46) saturate(.62) contrast(1.16) drop-shadow(0 24px 32px rgba(0,0,0,.72))!important}\n.worldHeroSlot.p2[data-hero=\"mirror\"] .mirrorOpponentAsset{scale:-1 1!important}\n.rosterCard.is-locked{position:relative;overflow:hidden;filter:grayscale(.78) brightness(.64)!important}\n.rosterCard.is-locked img{opacity:.22!important}\n.rosterLockedVisual{position:absolute;inset:0 0 30%;display:grid;place-items:center;background:linear-gradient(135deg,rgba(255,255,255,.025),transparent 45%),repeating-linear-gradient(135deg,rgba(255,255,255,.035) 0 7px,transparent 7px 14px)}\n.rosterLock{position:absolute!important;inset:0!important;display:grid!important;place-items:center!important;align-content:center!important;gap:9px!important;background:linear-gradient(180deg,rgba(4,5,7,.12),rgba(4,5,7,.76))!important;color:#d5c28d!important;text-align:center!important;pointer-events:none}\n.rosterLock i{position:relative;display:block;width:25px;height:20px;border:2px solid currentColor;border-radius:3px;box-shadow:0 0 14px rgba(213,194,141,.12)}\n.rosterLock i::before{content:\"\";position:absolute;left:50%;top:-14px;width:14px;height:14px;translate:-50% 0;border:2px solid currentColor;border-bottom:0;border-radius:9px 9px 0 0}\n.rosterLock i::after{content:\"\";position:absolute;left:50%;top:6px;width:3px;height:7px;translate:-50% 0;background:currentColor;border-radius:2px}\n.rosterLock b{font-size:8px;font-weight:800;letter-spacing:.22em}\n.rosterCard.art-missing:not(.is-locked) .rosterLockedVisual{opacity:.32}\n</style>\n</head>", 'style append');

  // ── R49 root correction: single Pick presentation + READY battle reveal ─
  const r49ReplaceOnce = (needle, replacement, label) => {
    const i = out.indexOf(needle);
    if (i < 0 || out.indexOf(needle, i + needle.length) >= 0) throw new Error(`R49 ${label} seam mismatch`);
    out = out.slice(0, i) + replacement + out.slice(i + needle.length);
  };
  {
    const re = /  function renderWorldHero\(container,id,player\)\{[\s\S]*?\n  \}(?=\n\n  function renderSide\(side,id,player,locked\))/;
    if (!re.test(out)) throw new Error('R49 renderWorldHero seam mismatch');
    out = out.replace(re, "  const HERO_PRESENTATION=Object.freeze({\n    newbot:{scale:.94,x:0,y:3},\n    hunter:{scale:.62,x:0,y:5},\n    crystala:{scale:.90,x:0,y:4},\n    magnet:{scale:.92,x:0,y:4},\n    frost:{scale:1.53,x:0,y:16},\n  });\n  const worldHeroSwapState=new WeakMap();\n\n  function presentationFor(renderId,player){\n    const p=HERO_PRESENTATION[renderId]||{scale:.94,x:0,y:4};\n    const face=Number.isFinite(p.face)?p.face:(player==='p2'?-1:1);\n    return {scale:p.scale||1,x:p.x||0,y:p.y||0,face};\n  }\n\n  function applyWorldSlotGeometry(container,player){\n    container.style.setProperty('top','7vh','important');\n    container.style.setProperty('bottom','15.5vh','important');\n    container.style.setProperty('width','50.5vw','important');\n    if(player==='p1'){\n      container.style.setProperty('left','-4.6vw','important');\n      container.style.setProperty('right','auto','important');\n    }else{\n      container.style.setProperty('right','-4.6vw','important');\n      container.style.setProperty('left','auto','important');\n    }\n  }\n\n  function applyHeroPresentation(img,renderId,requestedId,player){\n    const p=presentationFor(renderId,player);\n    img.style.setProperty('width','100%','important');\n    img.style.setProperty('height','100%','important');\n    img.style.setProperty('left','0','important');\n    img.style.setProperty('top','0','important');\n    img.style.setProperty('object-position','50% 50%','important');\n    img.style.setProperty('transform-origin','50% 68%','important');\n    img.style.setProperty('scale','1 1','important');\n    img.style.setProperty('translate','none','important');\n    img.style.setProperty('transform','translate3d('+p.x+'%,'+p.y+'%,0) scale('+(p.face*p.scale)+','+p.scale+')','important');\n    if(requestedId==='mirror'){\n      img.style.setProperty('opacity','.84','important');\n      img.style.setProperty('filter','brightness(.47) saturate(.62) contrast(1.14) drop-shadow(0 24px 32px rgba(0,0,0,.72))','important');\n    }\n  }\n\n  function createWorldHeroBody(target){\n    if(!target.renderId||!target.sourceHero?.art)return null;\n    const body=document.createElement('div');\n    body.className='worldHeroBody';\n    const img=new Image();\n    img.className='worldHeroAsset';\n    img.alt='';img.draggable=false;img.src=target.sourceHero.art;\n    if(target.id==='mirror')img.classList.add('mirrorOpponentAsset');\n    applyHeroPresentation(img,target.renderId,target.id,target.player);\n    body.appendChild(img);\n    // No duplicate image/echo layer. Secondary identity effects must be\n    // geometry/code effects, never a translucent clone of the full hero art.\n    if(target.id==='magnet')body.insertAdjacentHTML('beforeend','<span class=\"magnetOrbit ringA\"></span><span class=\"magnetOrbit ringB\"></span>');\n    if(target.id==='crystala')body.insertAdjacentHTML('beforeend','<span class=\"crystalPulse\"></span>');\n    return body;\n  }\n\n  function commitWorldHero(container,target,state){\n    container.innerHTML='';\n    applyWorldSlotGeometry(container,target.player);\n    container.style.setProperty('--heroTint',target.hero?.accent||'#ff941f');\n    container.dataset.hero=target.id;\n    container.dataset.renderKey=target.nextKey;\n    state.currentKey=target.nextKey;\n    const body=createWorldHeroBody(target);\n    if(!body)return;\n    container.appendChild(body);\n    if(motion&&typeof body.animate==='function'){\n      const dir=target.player==='p1'?-1:1;\n      body.animate([\n        {opacity:0,transform:'translate3d('+(dir*3.0)+'vw,3px,0) scale(.88)',filter:'brightness(.62) saturate(.58)'},\n        {opacity:1,transform:'translate3d(0,0,0) scale(1)',filter:'none'}\n      ],{duration:185,easing:'cubic-bezier(.12,.88,.18,1)'});\n    }\n  }\n\n  function renderWorldHero(container,id,player){\n    const h=HEROES[id];\n    const mirrorSource=id==='mirror'?mirrorOpponentHero(player):null;\n    const renderId=id==='mirror'?mirrorSource:id;\n    const sourceHero=renderId?HEROES[renderId]:null;\n    const nextKey=id==='mirror'?('mirror:'+(renderId||'empty')):id;\n    let state=worldHeroSwapState.get(container);\n    if(!state){state={currentKey:container.dataset.renderKey||'',swapping:false,pending:null};worldHeroSwapState.set(container,state);}\n    const target={id,player,hero:h,renderId,sourceHero,nextKey};\n    state.pending=target;\n    applyWorldSlotGeometry(container,player);\n\n    if(!state.swapping&&state.currentKey===nextKey)return;\n    const current=container.querySelector(':scope > .worldHeroBody');\n    if(!current||!motion){\n      state.swapping=false;\n      commitWorldHero(container,state.pending,state);\n      state.pending=null;\n      return;\n    }\n    if(state.swapping)return;\n\n    state.swapping=true;\n    const dir=player==='p1'?-1:1;\n    const finish=()=>{\n      if(!state.swapping)return;\n      state.swapping=false;\n      const latest=state.pending;\n      state.pending=null;\n      current.remove();\n      if(latest)commitWorldHero(container,latest,state);\n    };\n    if(typeof current.animate==='function'){\n      try{\n        const anim=current.animate([\n          {opacity:1,transform:'translate3d(0,0,0) scale(1)',filter:'none'},\n          {opacity:0,transform:'translate3d('+(dir*3.0)+'vw,4px,0) scale(.84)',filter:'brightness(.48) saturate(.38)'}\n        ],{duration:125,easing:'cubic-bezier(.28,.02,.5,1)'});\n        Promise.resolve(anim.finished).then(finish).catch(finish);\n      }catch(_){setTimeout(finish,125);}\n    }else setTimeout(finish,125);\n  }");
  }
  {
    const re = /<style id="r48a-fighter-pick-adaptation">[\s\S]*?<\/style>\s*/;
    if (!re.test(out)) throw new Error('R49 R48A style block missing');
    out = out.replace(re, "<style id=\"r49-fighter-presentation-authority\">\n/* ONE presentation authority: no duplicate full-art echoes and no CSS hero transform stack. */\n.worldHeroGhost,.worldHeroFxAsset{display:none!important}\n.rosterCard.is-locked{position:relative;overflow:hidden;filter:grayscale(.78) brightness(.64)!important}\n.rosterCard.is-locked img{opacity:.22!important}\n.rosterLockedVisual{position:absolute;inset:0 0 30%;display:grid;place-items:center;background:linear-gradient(135deg,rgba(255,255,255,.025),transparent 45%),repeating-linear-gradient(135deg,rgba(255,255,255,.035) 0 7px,transparent 7px 14px)}\n.rosterLock{position:absolute!important;inset:0!important;display:grid!important;place-items:center!important;align-content:center!important;gap:9px!important;background:linear-gradient(180deg,rgba(4,5,7,.12),rgba(4,5,7,.76))!important;color:#d5c28d!important;text-align:center!important;pointer-events:none}\n.rosterLock i{position:relative;display:block;width:25px;height:20px;border:2px solid currentColor;border-radius:3px;box-shadow:0 0 14px rgba(213,194,141,.12)}\n.rosterLock i::before{content:\"\";position:absolute;left:50%;top:-14px;width:14px;height:14px;translate:-50% 0;border:2px solid currentColor;border-bottom:0;border-radius:9px 9px 0 0}\n.rosterLock i::after{content:\"\";position:absolute;left:50%;top:6px;width:3px;height:7px;translate:-50% 0;background:currentColor;border-radius:2px}\n.rosterLock b{font-size:8px;font-weight:800;letter-spacing:.22em}\n.rosterCard.art-missing:not(.is-locked) .rosterLockedVisual{opacity:.32}\n</style>\n");
  }
  r49ReplaceOnce("  function setBattleLive(){\n    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('battle');\n    APEX_GOLD.onBattleLive&&APEX_GOLD.onBattleLive({mode:battleMode,p1:p1Hero,p2:p2Hero});\n    if(!window.APEX_GOLD_HUD)return;\n    battleHudConfig={...makeBattleConfig(true)};\n    sendBattleHudConfig();\n    window.postMessage({type:'APEX_CHAOS_BATTLE_LIVE'},'*');\n  }", "  async function setBattleLive(){\n    APEX_GOLD.onSurface&&APEX_GOLD.onSurface('battle');\n    const ready=APEX_GOLD.onBattleLive\n      ? await Promise.resolve(APEX_GOLD.onBattleLive({mode:battleMode,p1:p1Hero,p2:p2Hero}))\n      : false;\n    if(ready!==true||!window.APEX_GOLD_HUD)return false;\n    battleHudConfig={...makeBattleConfig(true)};\n    sendBattleHudConfig();\n    window.postMessage({type:'APEX_CHAOS_BATTLE_LIVE'},'*');\n    return true;\n  }", 'setBattleLive readiness');
  r49ReplaceOnce("    if(!await transitionDelay(260,token))return;\n    battleTransition.classList.add('phase-open');\n    battleHudHost.classList.add('is-reveal');\n\n    if(!await transitionDelay(520,token))return;\n    document.body.classList.add('battle-hud-open');\n    document.body.classList.remove('battle-transition-active');\n    battleHudHost.classList.remove('is-transitioning','is-reveal','is-horizontal');\n    battleHudHost.classList.add('is-open');\n    battleTransition.classList.add('phase-handoff');\n    setBattleLive();\n    screen='battle';", "    if(!await transitionDelay(260,token))return;\n    battleTransition.classList.add('phase-open');\n    battleHudHost.classList.add('is-reveal');\n\n    // Start production behind the still-opaque transition. Reveal only after\n    // both the cinematic minimum and real runtime READY have completed.\n    const cinematicReady=transitionDelay(520,token);\n    const liveReady=await setBattleLive();\n    if(!await cinematicReady)return;\n    if(token!==battleTransitionToken)return;\n    if(liveReady!==true){\n      cancelBattleTransition();\n      return;\n    }\n    document.body.classList.add('battle-hud-open');\n    document.body.classList.remove('battle-transition-active');\n    battleHudHost.classList.remove('is-transitioning','is-reveal','is-horizontal');\n    battleHudHost.classList.add('is-open');\n    battleTransition.classList.add('phase-handoff');\n    screen='battle';", 'battle reveal readiness');
  if (out.includes('ghost=prev.cloneNode(true)') || out.includes('echo=img.cloneNode()')) throw new Error('R49 duplicate hero-art path survived');
  log('  R49 (shell): single hero presentation authority + production READY battle reveal');

  // ── R49D: production skill-copy ownership + no live donor overwrite ─────
  r49ReplaceOnce(
    "  function heroPayload(id,fallback){\n    const h=HEROES[id]||HEROES[fallback]||{};\n    return {id,name:h.name||String(id||'FIGHTER').toUpperCase(),tag:h.tag||'FIGHTER',portrait:h.battleAvatar||h.portrait||'',skills:(SKILLS[id]||['PASSIVE','A1','A2']).slice(),accent:h.accent||'#ff941f'};\n  }",
    "  function resolvedSkillCopy(id){\n    const fallback=(SKILLS[id]||['PASSIVE','A1','A2']).slice();\n    try{\n      const g=window.APEX_GOLD;\n      if(g&&typeof g.skillDisplay==='function')return g.skillDisplay(id,fallback);\n    }catch(_){}\n    return fallback;\n  }\n  function heroPayload(id,fallback){\n    const h=HEROES[id]||HEROES[fallback]||{};\n    return {id,name:h.name||String(id||'FIGHTER').toUpperCase(),tag:h.tag||'FIGHTER',portrait:h.battleAvatar||h.portrait||'',skills:resolvedSkillCopy(id),accent:h.accent||'#ff941f'};\n  }",
    'shared skill display'
  );
  r49ReplaceOnce(
    "  function sendBattleHudConfig(){\n    if(!battleHudConfig||!battleHudFrame?.contentWindow)return;\n    window.postMessage(battleHudConfig,'*');\n    APEX_GOLD.onHandoff&&APEX_GOLD.onHandoff(battleHudConfig);\n  }",
    "  function sendBattleHudConfig(){\n    if(!battleHudConfig||battleHudConfig.live===true||!battleHudFrame?.contentWindow)return;\n    window.postMessage(battleHudConfig,'*');\n    APEX_GOLD.onHandoff&&APEX_GOLD.onHandoff(battleHudConfig);\n  }",
    'preview-only battle handoff'
  );
  r49ReplaceOnce(
    "    if(ready!==true||!window.APEX_GOLD_HUD)return false;\n    battleHudConfig={...makeBattleConfig(true)};\n    sendBattleHudConfig();\n    window.postMessage({type:'APEX_CHAOS_BATTLE_LIVE'},'*');\n    return true;",
    "    if(ready!==true||!window.APEX_GOLD_HUD)return false;\n    // Production projection is now authoritative. Mark preview handoff closed\n    // so no later HUD_READY/load callback can overwrite live skill/weapon truth.\n    battleHudConfig={...makeBattleConfig(true)};\n    window.postMessage({type:'APEX_CHAOS_BATTLE_LIVE'},'*');\n    return true;",
    'no live donor overwrite'
  );
  r49ReplaceOnce(
    "  function skillMarkup(id,player){\n    const s=SKILLS[id]||['PASSIVE','A1','A2'];",
    "  function skillMarkup(id,player){\n    const s=resolvedSkillCopy(id);",
    'Pick skill display'
  );
  r49ReplaceOnce(
    "    state.swapping=true;\n    const dir=player==='p1'?-1:1;",
    "    state.swapping=true;\n    try{current.getAnimations?.().forEach(a=>a.cancel())}catch(_){}\n    const dir=player==='p1'?-1:1;",
    'hero animation stack cancellation'
  );
  log('  R49D (shell): shared skill truth + preview/live handoff boundary hardened');


  // ── R50A: asset intent — hidden/inactive surfaces never cause eager bytes.
  r49ReplaceOnce(
    "  function setScreen(next){\n    clearTimeout(transitionTimer); stage.classList.add('flow-transition'); stage.classList.remove('match-ready');",
    "  function hydrateDeferredImages(root){\n    if(!root)return;\n    root.querySelectorAll('img[data-apex-src]').forEach(img=>{\n      if(img.getAttribute('src'))return;\n      const src=img.getAttribute('data-apex-src');\n      if(src)img.setAttribute('src',src);\n    });\n  }\n\n  function setScreen(next){\n    if(next==='mode')hydrateDeferredImages(modeScreen);\n    clearTimeout(transitionTimer); stage.classList.add('flow-transition'); stage.classList.remove('match-ready');",
    'deferred Mode image hydration'
  );
  r49ReplaceOnce(
    "    setTimeout(()=>{renderFighter();setScreen('fighter')},360);",
    "    setTimeout(()=>{if(!roster.childElementCount)buildRoster();renderFighter();setScreen('fighter')},360);",
    'intent-time Fighter roster materialization'
  );
  log('  R50A (shell): Mode/Pick media are route-intent only');


  // ── S12: embed the production-bridged battle HUD payload (same canonical
  // base64 payload mechanism, so loading/transition timing does not drift).
  const payloadB64 = Buffer.from(hudProductionHtml, 'utf8').toString('base64');
  const payloadRe = /(<script id="battleHudPayload" type="text\/plain">)([\s\S]*?)(<\/script>)/;
  const payloadMatch = out.match(payloadRe);
  if (!payloadMatch) throw new Error('patch SHL-S12 could not find the battle HUD payload script');
  out = out.replace(payloadRe, `$1${payloadB64}$3`);
  log('  patch SHL-S12 (shell): production-bridged battle HUD payload embedded (canonical base64 mechanism preserved)');
  return out;
}

// ── assets / fonts / theme / manifest ───────────────────────────────────────
function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

function buildManifest(files) {
  return `${JSON.stringify({
    generator: 'tools/buildGoldCutover.mjs',
    canonicalAuthority: 'docs/gold-ui/current (owner Gold source pack, SHA-pinned)',
    runtimeRevision: (() => {
      const manifest = read(path.join(REPO, 'src', 'game', 'runtimeManifest.js')).toString('utf8');
      return manifest.match(/APEX_ARSENAL_RUNTIME_REVISION\s*=\s*'([^']+)'/)[1];
    })(),
    files,
  }, null, 2)}\n`;
}

function main() {
  verifyAuthority();
  materializeTheme();
  srcManifestContent = '';

  // Single revision read for the whole build (used by the shell bridge URL and
  // the Gold surface URLs) — deterministic, no timestamps anywhere.
  const REVISION = (() => {
    const manifest = read(path.join(REPO, 'src', 'game', 'runtimeManifest.js')).toString('utf8');
    const m = manifest.match(/APEX_ARSENAL_RUNTIME_REVISION\s*=\s*'([^']+)'/);
    if (!m) throw new Error('runtime revision constant not found');
    return m[1];
  })();

  const outputs = new Map(); // relpath -> content buffer
  const assetRoot = path.join(GOLD_DIR, 'assets');
  const walk = (dir, base = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else if (!NON_SHIPPING_GOLD_ASSETS.has(rel)) outputs.set(`assets/${rel}`, read(full));
    }
  };
  walk(assetRoot);
  log(`assets staged: ${outputs.size} files (byte-for-byte from canonical pack)`);
  // Production-only owner favicon stays outside the SHA-pinned canonical donor
  // pack, then joins the generated shipping tree through this explicit overlay.
  outputs.set('assets/gold/favicon-tab-apex.svg', read(TAB_FAVICON_SRC));
  log('owner tab favicon staged (production overlay; canonical profile avatar untouched)');

  for (const file of fs.readdirSync(FONT_SRC)) {
    outputs.set(`fonts/${file}`, read(path.join(FONT_SRC, file)));
  }
  outputs.set('fonts.css', Buffer.from(buildFontsCss(), 'utf8'));
  log(`fonts staged: ${fs.readdirSync(FONT_SRC).length} woff2 + fonts.css`);

  outputs.set('battle-hud.html', Buffer.from(buildBattleHud(), 'utf8'));
  log('battle-hud.html built (production-bridged donor)');
  outputs.set('lucky-draw.html', Buffer.from(buildLuckyDonor(), 'utf8'));
  log('lucky-draw.html built (localized + production-bridged donor)');
  outputs.set('shell.html', Buffer.from(buildShell(outputs.get('battle-hud.html').toString('utf8')), 'utf8'));
  log('shell.html built (canonical shell + production patches)');

  const manifestFiles = {};
  for (const [rel, buf] of [...outputs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    manifestFiles[rel] = { bytes: buf.length, sha256: sha256(buf) };
  }
  manifestFiles['../assets/audio/forward_drive_theme.ogg'] = {
    bytes: fs.statSync(THEME_OUT).size,
    sha256: AUTHORITY.themeEncodedSha256,
    note: 'owner Forward Drive theme, repository Ogg Opus encode (AV preload)',
  };
  outputs.set('manifest.json', Buffer.from(buildManifest(manifestFiles), 'utf8'));

  // Shipping classification manifest (written into src/, not public/gold).
  const assetLines = [
    '// ---------------------------------------------------------------------------',
    '// Generated by tools/buildGoldCutover.mjs — do not hand-edit.',
    '// Every Gold product artifact under public/gold/ is shipping production',
    '// code (the Gold surfaces are the product UI). This module makes those',
    '// references explicit so tools/assetAudit.mjs classifies them',
    '// SHIPPING_LAZY (route-intent assets), never LEGACY_NON_SHIPPING.',
    '// ---------------------------------------------------------------------------',
    'export const GOLD_SHIPPING_ASSETS = Object.freeze([',
  ];
  for (const rel of [...outputs.keys()].sort()) {
    assetLines.push(`  '/gold/${rel}',`);
  }
  assetLines.push("  '/assets/audio/forward_drive_theme.ogg',");
  assetLines.push(']);');
  assetLines.push('');
  // Cache identity: the Gold shell / Lucky Draw / battle HUD URLs carry the
  // runtime revision so a prior Gold cutover can never be served from a stale
  // browser cache during verification (2026-10-05 correction slice).
  assetLines.push(`export const GOLD_SHELL_URL = '/gold/shell.html?v=${REVISION}';`);
  assetLines.push(`export const GOLD_LUCKY_DRAW_URL = '/gold/lucky-draw.html?v=${REVISION}';`);
  assetLines.push(`export const GOLD_BATTLE_HUD_URL = '/gold/battle-hud.html?v=${REVISION}';`);
  assetLines.push('');
  srcManifestContent = assetLines.join('\n');

  if (CHECK) {
    let drift = 0;
    for (const [rel, buf] of outputs) {
      const target = path.join(OUT_DIR, rel);
      if (!fs.existsSync(target) || !read(target).equals(buf)) {
        console.error(`[gold-cutover] DRIFT: ${rel}`);
        drift++;
      }
    }
    if (fs.existsSync(SRC_ASSET_MANIFEST)) {
      if (read(SRC_ASSET_MANIFEST).toString('utf8') !== srcManifestContent) {
        console.error('[gold-cutover] DRIFT: src/game/goldAssetManifest.js');
        drift++;
      }
    } else {
      console.error('[gold-cutover] DRIFT: src/game/goldAssetManifest.js (missing)');
      drift++;
    }
    if (drift) {
      console.error(`[gold-cutover] CHECK FAILED (${drift} drifted files)`);
      process.exit(1);
    }
    log(`CHECK OK — ${outputs.size} generated files match public/gold`);
    return;
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  for (const [rel, buf] of outputs) {
    const target = path.join(OUT_DIR, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buf);
  }
  fs.mkdirSync(path.dirname(SRC_ASSET_MANIFEST), { recursive: true });
  fs.writeFileSync(SRC_ASSET_MANIFEST, srcManifestContent);
  fs.rmSync(path.join(REPO, '.gold-cutover-tmp'), { recursive: true, force: true });
  log(`WROTE ${outputs.size} files to public/gold (+ theme ogg, + src/game/goldAssetManifest.js, + provenance manifest.json)`);
}

main();
