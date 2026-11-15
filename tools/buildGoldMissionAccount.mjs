// Stage original owner Gold as a single, isolated HTML document into game assets.
// This preserves Gold's own Tailwind 4 renderer and animations instead of
// approximating them with new React markup or importing its fake game store.
import { spawnSync } from 'node:child_process';
import {execFileSync} from 'node:child_process';
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const project=resolve(root,'gold-mission-account');
const deps=resolve(project,'node_modules','vite','package.json');
const run=(cmd,args)=>{
  const r=spawnSync(cmd,args,{cwd:project,stdio:'inherit',shell:process.platform==='win32'});
  if(r.status!==0)throw new Error(`${cmd} ${args.join(' ')} failed (${r.status})`);
};
execFileSync('node',[resolve(root,'tools','verifyGoldSourceParity.mjs')],{stdio:'inherit'});
if(!existsSync(deps))run('npm',['ci','--no-audit','--no-fund']);
run('npm',['run','build']);
const destination=process.argv.includes('--dist')?'dist':'public';
const out=resolve(root,destination,'gold','mission-account.html');
mkdirSync(resolve(root,destination,'gold'),{recursive:true});
copyFileSync(resolve(project,'dist','index.html'),out);
console.log(`[gold] exact owner UI bundled at ${out}`);
