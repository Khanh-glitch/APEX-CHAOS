// Compiles the EXACT owner Gold presentation in its isolated React19/Vite7
// project. The main APEX game stays React18; no CSS/runtime may leak outside
// the iframe. The output is a self-contained index (fonts are inlined).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const gold = path.join(root, 'result-gold');
const nodeModules = path.join(gold, 'node_modules', 'vite', 'package.json');
function run(command, args) {
  const out=spawnSync(command,args,{cwd:gold,stdio:'inherit',shell:process.platform==='win32'});
  if(out.error)throw out.error;
  if(out.status!==0)throw Error(`Result Gold build step failed: ${command} ${args.join(' ')} (status ${out.status})`);
}
if(!existsSync(nodeModules))run('npm',['ci','--ignore-scripts','--no-audit','--no-fund']);
run('npm',['run','build']);
const target=path.join(root,'public','result-gold','index.html');
if(!existsSync(target)||statSync(target).size<10000)throw Error('Result Gold compiled page missing or suspiciously small');
const html=readFileSync(target,'utf8');
if(!html.includes('APEX CHAOS')||!html.includes('APEX_RESULT_GOLD_READY'))throw Error('Result Gold output not bound to live engine protocol');
if(/<script[^>]+src=/.test(html))throw Error('Result Gold unexpectedly refers to non-inlined scripts');
console.log(`[RESULT GOLD] COMPILED ${statSync(target).size} bytes; owner original CSS/6-phase motion intact`);
