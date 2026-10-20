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

const resources = '(?:assets/|game/|gold/|bot-wave/|favicon[.]ico|apexEngine[.]js|gold-fidelity-lab[.]html|gold-fidelity-profiles[.]mjs|sniper_cloak_(?:move_)?sprite[.]webp)';
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
    // Dynamic JS DOM URLs resolve relative to document.baseURI regardless of
    // script location. HTML/CSS references resolve relative to their own file.
    const base = isCSS || isHTML ? (depth ? '../'.repeat(depth) : './') : './';
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
const index = fs.readFileSync(path.join(OUTPUT, 'index.html'), 'utf8');
if (!/src="\.\/assets\//.test(index)) throw Error('index JS entrypoint must be relative');
if (!/href="\.\/assets\//.test(index)) throw Error('index CSS entrypoint must be relative');
for (const m of index.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g)) {
  if (!fs.existsSync(path.join(OUTPUT, m[1]))) throw Error('missing ZIP-root asset: ' + m[1]);
}
if (!fs.existsSync(path.join(OUTPUT, 'ITCH_GUEST_BUILD_SHA.txt'))) throw Error('missing build receipt');
console.log('ITCH PORTABILITY PASS: ' + scanned + ' text files scanned, ' + modifiedFiles
  + ' transformed, ' + replacements + ' URL literals made relative');
