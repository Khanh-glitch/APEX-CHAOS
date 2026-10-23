// Repackage dist/ so HTML5 runs under itch.io's nested /html/<id>/ path.
// This intentionally produces a COPY: Cloudflare staging build is unchanged.
// Only first-party root-relative URL LITERALS are translated; never rewrite
// external URLs, Auth requests, save files, images, video, JSON, or binaries.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = path.join(ROOT, 'dist');
const OUTPUT = path.join(ROOT, 'dist-itch-html5');
if (!fs.existsSync(path.join(INPUT, 'index.html'))) throw Error('dist/index.html missing');
fs.rmSync(OUTPUT, { recursive: true, force: true });
fs.cpSync(INPUT, OUTPUT, { recursive: true });

const resources = '(?:assets/|game/|gold/|result-gold/|bot-wave/|favicon[.]ico|apexEngine[.]js|gold-fidelity-lab[.]html|gold-fidelity-profiles[.]mjs|sniper_cloak_(?:move_)?sprite[.]webp)';
const quoted = new RegExp("([\\x22\\x27\\x60])/(" + resources + ")", 'g');
const cssBare = new RegExp("(url\\(\\s*)/(" + resources + ")", 'gi');
let scanned = 0, modifiedFiles = 0, replacements = 0;
const unexpected = [];
function rewrite(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { rewrite(full); continue; }
    if (!/\.(html|css|js|mjs)$/i.test(entry.name)) continue;
    scanned++;
    const rel = path.relative(OUTPUT, full).replaceAll('\\', '/');
    const depth = rel.split('/').length - 1;
    const isCSS = /\.css$/i.test(rel);
    const isHTML = /\.html$/i.test(rel);
    // URL resolution law (RC nested-Chrome proof): HTML/CSS references
    // resolve relative to their own file. Dynamic JS URLs resolve against
    // document.baseURI — and the Gold mount retargets <base> to <app>/gold/
    // for the whole session, so public-runtime literals must step OUT of
    // the gold directory ('../') to reach the app root. The Vite bundle is
    // the exception: src resolves product URLs through the app-root
    // authority (apexAppUrl), which expects the './' spelling. The dev
    // fidelity lab is its own root document and also keeps './'.
    const isBundle = rel.startsWith('assets/');
    const isLab = rel === 'gold-fidelity-profiles.mjs';
    // Boot-critical runtimes that build asset URLs BEFORE the Gold mount
    // inserts <base> (nested server-log proof): the product asset
    // preloader gates START on Home art, and the music authority preloads
    // the boot theme. '../' would escape the app root for them.
    const isPreBaseBoot = rel === 'game/product/productAssetRuntime.js'
      || rel === 'game/product/productMusicAuthority.js';
    const base = isCSS || isHTML
      ? (depth ? '../'.repeat(depth) : './')
      : (isBundle || isLab || isPreBaseBoot ? './' : '../');
    const cssBase = depth ? '../'.repeat(depth) : './';
    let code = fs.readFileSync(full, 'utf8');
    const old = code;
    code = code.replace(quoted, (_,q,p) => { replacements++; return q+base+p; });
    code = code.replace(cssBare, (_,q,p) => { replacements++; return q+cssBase+p; });
    // Root-based mobile redirect was authored for Pages; keep it in this
    // nested game's directory when served by itch.io.
    code = code.replace(/new URL\((["'])\.\/gold-fidelity-lab\.html\1,\s*location\.origin\)/g,
      (_,q) => 'new URL(' + q + './gold-fidelity-lab.html' + q + ', location.href)');
    if (code !== old) { fs.writeFileSync(full, code); modifiedFiles++; }
    const residual = code.match(quoted);
    if (residual) unexpected.push(rel + ': ' + residual.slice(0,3).join(', '));
  }
}
rewrite(OUTPUT);
if (unexpected.length) throw Error('Unconverted itch-root URL: ' + unexpected.slice(0,10).join(' | '));

// Post-base canaries (RC audit): the generic '../' law above must have
// rewritten the known post-base public runtimes. If a canary spelling is
// absent, packaging fails loudly instead of shipping silent 404s.
const postBaseCanaries = [
  // UI SFX authority executes as a Gold shell script (post-base context).
  { file: 'game/ui/uiSfxAuthority.js', mustContain: "const ROOT = '../assets/audio/ui-sfx/';" },
  // CP4: the Result iframe fallback literal must step out of the Gold base
  // to <app>/result-gold/ instead of escaping to the origin root (404).
  { file: 'game/gold/goldProductBridge.js', mustContain: "return '../result-gold/index.html';" },
];
for (const canary of postBaseCanaries) {
  const code = fs.readFileSync(path.join(OUTPUT, canary.file), 'utf8');
  if (!code.includes(canary.mustContain)) {
    throw Error('post-base itch canary missing in ' + canary.file + ': ' + canary.mustContain);
  }
}

// Asserted copy-only transforms for dual-context resolvers:
// productAssetRuntime normalizes every URL against window.location (the
// entry document). Its OWN surface lists are entry-spelled ('./gold/...'),
// but post-base producers (Gold bridge roster art) hand it gold-spelled
// '../assets/...' strings, which would escape the app root. In the itch
// copy its resolver therefore honors the spelling law: '../' resolves
// against document.baseURI (the Gold base, exactly like DOM img.src),
// everything else against the entry location as canonical. The canonical
// dist keeps the original single-base resolver; the durable source fix
// (bridge emitting absolute app-root URLs) is tracked as post-Alpha debt.
const copyTransforms = [
  {
    file: 'game/product/productAssetRuntime.js',
    from: 'try { return new URL(String(input), window.location.href).href; }',
    to: "try { const __s = String(input); return new URL(__s, __s.startsWith('../') ? document.baseURI : window.location.href).href; }",
  },
  {
    // AV presentation treats '/…' manifest paths as already-rooted and
    // prefixes everything else with AV_ROOT. The generic pass turns those
    // manifest paths into '../…' in this copy, so the rooted test must
    // recognize that spelling too or every weapon/VFX URL doubles its
    // 'assets/arsenal' segment (nested-Chrome server-log proof).
    file: 'game/arsenal/arsenalPresentationRuntime.js',
    from: "rel.startsWith('/') ? rel : AV_ROOT + rel",
    to: "(rel.startsWith('/') || rel.startsWith('../')) ? rel : AV_ROOT + rel",
  },
];
for (const transform of copyTransforms) {
  const target = path.join(OUTPUT, transform.file);
  const code = fs.readFileSync(target, 'utf8');
  if (!code.includes(transform.from)) {
    throw Error('itch copy transform found no target in ' + transform.file + ': ' + transform.from);
  }
  fs.writeFileSync(target, code.replaceAll(transform.from, transform.to));
}

// Audio warm-bank literals live in the Vite bundle (generated from
// src/game/audioWarmBanks.generated.js) but are FETCHED by the engine's
// apexWarmAudioUrls after the Gold <base> exists, so in this copy they
// follow the public-runtime '../' spelling. Scoped to audio extensions:
// bundle product URLs resolved through apexAppUrl must keep './'.
{
  const bundleDir = path.join(OUTPUT, 'assets');
  const audioLiteral = /(["'])\.\/assets\/([^"']+\.(?:mp3|ogg|wav|m4a))\1/gi;
  let warmed = 0;
  for (const name of fs.readdirSync(bundleDir)) {
    if (!name.endsWith('.js')) continue;
    const target = path.join(bundleDir, name);
    const code = fs.readFileSync(target, 'utf8');
    const hits = code.match(audioLiteral);
    if (hits) {
      warmed += hits.length;
      fs.writeFileSync(target, code.replace(audioLiteral, '$1../assets/$2$1'));
    }
  }
  if (!warmed) throw Error('itch warm-bank transform found no bundle audio literals');
}
const indexPath = path.join(OUTPUT, 'index.html');
let index = fs.readFileSync(indexPath, 'utf8');
if (!/src="\.\/assets\//.test(index)) throw Error('index JS entrypoint must be relative');
if (!/href="\.\/assets\//.test(index)) throw Error('index CSS entrypoint must be relative');
for (const m of index.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g)) {
  if (!fs.existsSync(path.join(OUTPUT, m[1]))) throw Error('missing ZIP-root asset: ' + m[1]);
}
// Pin entry <head> <link href> elements (e.g. ./gold/assets/gold/favicon-r72-owner.png)
// to their resolved entry-directory URLs BEFORE goldShellLoader inserts <base href="./gold/">;
// otherwise Chromium re-resolves relative <link rel="icon"> on head mutation to ./gold/gold/... (404).
if (!index.includes('</head>')) throw Error('index.html missing </head>');
index = index.replace(
  '</head>',
  '  <script>for(const l of document.querySelectorAll("link[href]"))l.setAttribute("href",l.href);</script>\n  </head>',
);
fs.writeFileSync(indexPath, index);
if (!fs.existsSync(path.join(OUTPUT, 'ITCH_GUEST_BUILD_SHA.txt'))) throw Error('missing build receipt');
console.log('ITCH PORTABILITY PASS: ' + scanned + ' text files scanned, ' + modifiedFiles
  + ' transformed, ' + replacements + ' URL literals made relative');
