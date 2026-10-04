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

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GOLD_DIR = path.join(REPO, 'docs', 'gold-ui', 'current');
const PRELOAD_DIR = path.join(REPO, 'docs', 'gold-ui', 'preload');
const FONT_SRC = path.join(REPO, 'tools', 'gold-cutover', 'fonts');
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
    {
      id: 'HUD-H26',
      why: 'donor Escape handler: install once + only while this mount is still connected',
      find: /  document\.addEventListener\('keydown',e=>\{\n    if\(e\.key==='Escape'\)\{\n      e\.preventDefault\(\);e\.stopImmediatePropagation\(\);\n      parent\.postMessage\(\{type:'APEX_CHAOS_BATTLE_EXIT'\},'\*'\);\n    \}\n  \},true\);/,
      replace: (
        `  if(!document.__apexGoldHudExitKey){\n` +
        `    document.__apexGoldHudExitKey=true;\n` +
        `    const exitRoot=document.currentScript||null;\n` +
        `    document.addEventListener('keydown',e=>{\n` +
        `      if(e.key!=='Escape')return;\n` +
        `      if(exitRoot&&!exitRoot.isConnected)return;\n` +
        `      if(!exitRoot&&!document.body.classList.contains('battle-hud-open'))return;\n` +
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
        ` const dt=Math.min(.05,(now-__apexLast)/1000);__apexLast=now;\n` +
        ` try{APEX_GOLD_HUD.tick(dt,now);}catch(err){}\n` +
        ` requestAnimationFrame(frame);\n` +
        `}\n` +
        `applyViewport();\n` +
        `requestAnimationFrame(frame);\n`
      ),
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
  out = out.replace('</head>', `${seam}</head>`);
  if (!out.includes(seam)) throw new Error('patch HUD-H15 (production seam) could not be inserted');
  log('  patch HUD-H15 (battle-hud): production seam installed');
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
          const art = luckyPlaceholderArt(hero.display, accent);
          return `  { key:'${hero.shellKey}', id:'${hero.productionId}', col:'${accent}', tag:'${hero.tag}',\n` +
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
    // ── S1: production bridge script, loaded before the canonical shell
    // script so roster/mode hooks exist at canonical script evaluation.
    {
      id: 'SHL-S1',
      why: 'install production bridge before the canonical shell script',
      find: /<script>\n\(\(\) => \{\n  'use strict';\n  const stage = document\.getElementById\('stage'\);/,
      replace: (
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
      id: 'SHL-S3',
      why: 'srcdoc iframe mount replaced by same-document canonical mount (arena canvas must occupy the authored arena slot)',
      find: /    battleHudFrame\.srcdoc=decodeBattleHud\(\);/,
      replace: '    APEX_GOLD.mountBattleHud(decodeBattleHud(),()=>{battleHudReady=true;sendBattleHudConfig();});',
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
    {
      id: 'SHL-S13',
      why: 'fighter selection respects production ownership (economy gate)',
      find: /  function selectHero\(id\)\{\n    if\(screen!=='fighter'\) return;\n/,
      replace: (
        `  function selectHero(id){\n` +
        `    if(screen!=='fighter') return;\n` +
        `    if(window.APEX_GOLD_LOCKED&&window.APEX_GOLD_LOCKED(id))return;\n`
      ),
    },
    {
      id: 'SHL-S14',
      why: 'roster cards render the production locked state',
      find: /      b\.addEventListener\('click',\(\)=>selectHero\(id\)\);/,
      replace: (
        `      if(window.APEX_GOLD_LOCKED&&window.APEX_GOLD_LOCKED(id))b.classList.add('is-locked');\n` +
        `      b.addEventListener('click',()=>selectHero(id));`
      ),
    },
  ];

  let out = applyPatches(shell, patches, 'shell');

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

  const outputs = new Map(); // relpath -> content buffer
  const assetRoot = path.join(GOLD_DIR, 'assets');
  const walk = (dir, base = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else outputs.set(`assets/${rel}`, read(full));
    }
  };
  walk(assetRoot);
  log(`assets staged: ${outputs.size} files (byte-for-byte from canonical pack)`);

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
  assetLines.push('export const GOLD_SHELL_URL = \'/gold/shell.html\';');
  assetLines.push('export const GOLD_LUCKY_DRAW_URL = \'/gold/lucky-draw.html\';');
  assetLines.push('export const GOLD_BATTLE_HUD_URL = \'/gold/battle-hud.html\';');
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
