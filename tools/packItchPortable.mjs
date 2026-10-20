// Package a true relative-path HTML5 ZIP for itch.io (served under /html/<id>/).
// The Cloudflare preview stays untouched in dist/. This copy rewrites only
// first-party root-relative public resource URLs in HTML, JS and CSS.
// Never modify external URLs, backend endpoints, JSON saves or binary assets.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = path.join(ROOT, 'dist');
const OUTPUT = path.join(ROOT, 'dist-itch-html5');
if (!fs.existsSync(path.join(INPUT,'index.html'))) throw Error('missing built dist/index.html');
fs.rmSync(OUTPUT,{recursive:true,force:true});
fs.cpSync(INPUT,OUTPUT,{recursive:true});

const resource = '(?:assets/|game/|gold/|bot-wave/|favicon\\.ico\\b|apexEngine\\.js\\b|gold-fidelity-lab\\.html\\b|gold-fidelity-profiles\\.mjs\\b|sniper_cloak_(?:move_)?sprite\\.webp\\b)';
const exact = new RegExp('([\\"\\'\\x60])\\/('+resource+')','g');
const tag = new RegExp('(=(?:\\\\"|\\\'|\\x60))\\/('+resource+')','g');
const bareCss = new RegExp('(url\\(\\s*)\\/('+resource+')','gi');
const rootRef = new RegExp('([\\"\\'\\x60])\\/('+resource+')','g');
const urls = [];
let modifiedFiles=0,replacements=0,scanned=0;
function walk(dir){
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,item.name);
    if(item.isDirectory()){walk(full);continue;}
    if(!/\\.(?:html|css|js|mjs)$/i.test(item.name))continue;
    scanned++;
    const rel=path.relative(OUTPUT,full).replaceAll('\\\\','/');
    const depth=rel.split('/').length-1;
    // URLs inserted via JS resolve against the DOCUMENT, not the JS file,
    // while CSS url() resolves against the CSS file. HTML uses its file dir.
    const js=documentType(rel)==='js';
    const base=(js?'./':(depth?'../'.repeat(depth):'./'));
    const cssBase=depth?'../'.repeat(depth):'./';
    let text=fs.readFileSync(full,'utf8'),old=text;
    text=text.replace(exact,(_,q,r)=>{replacements++;return q+base+r;});
    text=text.replace(tag,(_,q,r)=>{replacements++;return q+base+r;});
    text=text.replace(bareCss,(_,q,r)=>{replacements++;return q+cssBase+r;});
    // The mobile landing page explicitly used location.origin, which ignores
    // itch's nested base path even if the resource path was made relative.
    text=text.replace(/new URL\\((['\"\\x60])\\.\\/gold-fidelity-lab\\.html\\1,\\s*location\\.origin\\)/g,
      (_,q)=>'new URL('+q+'./gold-fidelity-lab.html'+q+', location.href)');
    if(text!==old){fs.writeFileSync(full,text);modifiedFiles++;}
    // Any first-party root-relative resource left in executable texts is
    // a release blocker; accidental Cloudflare-root assumptions are forbidden.
    const remaining=text.match(rootRef);
    if(remaining) urls.push(rel+': '+remaining.slice(0,3).join(', '));
  }
}
function documentType(file) {return /\\.css$/i.test(file)?'css':/\\.html$/i.test(file)?'html':'js';}
walk(OUTPUT);
if(urls.length)throw Error('ITCH ROOT-ABSOLUTE RESOURCES: '+urls.slice(0,15).join(' | '));
const index=fs.readFileSync(path.join(OUTPUT,'index.html'),'utf8');
if(!/src="\\.\\/assets\\//.test(index))throw Error('itch index entry script is not relative');
if(!/href="\\.\\/assets\\//.test(index))throw Error('itch entry stylesheet is not relative');
// Check that relative entry files exist as ZIP-root files, NOT CDN assets.
for(const match of index.matchAll(/(?:src|href)="\\.\\/([^"?#]+)"/g)){
  if(!fs.existsSync(path.join(OUTPUT,match[1])))throw Error('missing relative itch entry: '+match[1]);
}
if(!fs.existsSync(path.join(OUTPUT,'ITCH_GUEST_BUILD_SHA.txt')))throw Error('itch build SHA missing');
console.log('ITCH HTML5 PORTABILITY PASS: '+scanned+' HTML/JS/CSS checked, '+modifiedFiles+' transformed, '+replacements+' URLs relative');
console.log('HTML5 ZIP root: '+OUTPUT);
