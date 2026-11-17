// Read-only static closure: active CI/package tooling versus historic scripts.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const ls=execFileSync('git',['ls-files','-z'],{encoding:'utf8',maxBuffer:30000000}).split('\0').filter(Boolean);
const all=new Set(ls);
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const scripts=pkg.scripts||{};
const workflows=ls.filter(x=>x.startsWith('.github/workflows/')&&x.endsWith('.yml'));
const workflowText=workflows.map(x=>({path:x,txt:fs.readFileSync(x,'utf8')}));
const criticalScripts=new Set([
  'dev','dev:lan','build','preview','arsenal:sfx:materialize',
  'test:shipping-dist','test:runtime-revision','test:gold-direct-port',
  'test:arsenal:headless:product','test:hero-rework:headless','test:localization'
]);
const escapeRE=s=>s.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&');
const runRef=(txt,name)=>new RegExp('(pnpm|npm)(?:\\s+(?:run|exec))?\\s+'+escapeRE(name)+'(?=\\s|$|\\&|;|\\|)','m').test(txt);
for(const name of Object.keys(scripts))if(workflowText.some(x=>runRef(x.txt,name)))criticalScripts.add(name);
let before;
do{
 before=criticalScripts.size;
 for(const n of [...criticalScripts])for(const inner of Object.keys(scripts)){
  if(runRef(scripts[n]||'',inner))criticalScripts.add(inner);
 }
}while(before!==criticalScripts.size);
const roots=new Set();
const matchTools=t=>{
 for(const m of t.matchAll(/(?:tools|scripts)\/[\w./-]+\.(?:mjs|cjs|js|sh)/g)){
  if(all.has(m[0]))roots.add(m[0]);
 }
};
for(const {txt} of workflowText)matchTools(txt);
for(const n of criticalScripts)matchTools(scripts[n]||'');
for(const p of ls.filter(x=>x.startsWith('src/')&&/\.(?:js|jsx|ts|tsx)$/.test(x)))matchTools(fs.readFileSync(p,'utf8'));
const active=new Set(),reasons={};
function resolve(rel,src){
 const base=path.posix.normalize(path.posix.join(path.posix.dirname(src),rel.split('?')[0]));
 const variants=[base,base+'.mjs',base+'.js',base+'.cjs',base+'/index.mjs',base+'/index.js'];
 return variants.find(p=>all.has(p))||null;
}
const queue=[...roots];
for(const p of queue)reasons[p]='entrypoint';
while(queue.length){
 const p=queue.shift();
 if(active.has(p)||!all.has(p)||!/\.(?:mjs|js|cjs|sh)$/.test(p))continue;
 active.add(p);
 const txt=fs.readFileSync(p,'utf8');
 for(const m of txt.matchAll(/['"]((?:\.\/|\.\.\/)[^'"]+)['"]/g)){
  const next=resolve(m[1],p);
  if(next&&next.startsWith('tools/')&&!active.has(next)){
   if(!reasons[next])reasons[next]='relative:'+p;
   queue.push(next);
  }
 }
 for(const m of txt.matchAll(/(?:tools|scripts)\/[\w./-]+\.(?:mjs|cjs|js|sh)/g)){
  const next=m[0];
  if(all.has(next)&&next.startsWith('tools/')&&!active.has(next)){
   if(!reasons[next])reasons[next]='literal:'+p;
   queue.push(next);
  }
 }
}
const protectedPrefixes=['tools/probe/','tools/lib/','tools/gold-cutover/','tools/arsenal-assets/'];
for(const p of ls.filter(x=>protectedPrefixes.some(t=>x.startsWith(t))))active.add(p);
const trackedTools=ls.filter(x=>x.startsWith('tools/'));
const unused=trackedTools.filter(x=>!active.has(x)&&x!=='tools/maintenance/activeToolClosure.mjs');
const obsoleteScripts=Object.keys(scripts).filter(x=>!criticalScripts.has(x));
const report={revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workflows,activePackageScripts:[...criticalScripts].sort(),obsoletePackageScripts:obsoleteScripts,toolTotal:trackedTools.length,reachableToolFiles:[...active].filter(x=>x.startsWith('tools/')).sort(),retiredToolFiles:unused,protectedPrefixes,reasons};
fs.mkdirSync('reports',{recursive:true});
fs.writeFileSync('reports/active-tool-closure.json',JSON.stringify(report,null,2)+'\n');
console.log('SOURCE_TOOL_CLOSURE',JSON.stringify({totalTools:trackedTools.length,activeTools:report.reachableToolFiles.length,retiredTools:unused.length,packageScripts:Object.keys(scripts).length,activeScripts:criticalScripts.size,obsoleteScripts:obsoleteScripts.length}));
console.log('OBSOLETE_SCRIPTS',JSON.stringify(obsoleteScripts));
console.log('RETIRED_TOOL_SAMPLE',JSON.stringify(unused.slice(0,125)));
