// Read-only cleanup dependency audit. Does not modify tracked files.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8',maxBuffer:15e6}).split('\0').filter(Boolean);
const types=['.png','.jpg','.jpeg','.webp','.webm','.mp4','.zip','.json'];
const inOldDocs=p=>p.startsWith('docs/hero-rework/')||p.startsWith('docs/audit/')||p.startsWith('docs/owner-locks/')||p.startsWith('docs/stormbreaker/');
const categories=p=>{
 if(p.startsWith('docs/hero-rework/')){
  if(p.includes('/evidence/')||p.includes('/evidence-browser/')||p.includes('/proofs/')||p.includes('/robot-visual-cleanup-diagnostic/'))return 'hero-old-evidence';
  if(p.match(/\.(png|jpe?g|webp|webm|mp4|zip)$/i))return 'hero-reference-media';
  return 'hero-text-and-gold-source';
 }
 if(p.startsWith('docs/audit/'))return 'audit-historical';
 if(p.startsWith('docs/owner-locks/'))return 'owner-authority';
 if(p.startsWith('docs/stormbreaker/'))return 'stormbreaker-reference';
 return 'other';
};
const candidates=files.filter(inOldDocs);
const scanFiles=files.filter(p=>/^(src\/|tools\/|scripts\/|public\/game\/|public\/apexEngine\.js|\.github\/workflows\/|gold-mission-account\/|result-gold\/|package\.json|vite\.config)/.test(p)&&/\.(?:m?js|jsx|ts|tsx|html|json|yaml|yml|cjs)$/.test(p)&&fs.existsSync(p));
const txt=scanFiles.map(p=>({path:p,text:fs.readFileSync(p,'utf8')}));
const byCategory={};const highRefs=[];const lowRefs=[];const outsideReferences=[];
for(const p of candidates){
 const cat=categories(p),len=fs.statSync(p).size;
 const item=byCategory[cat]??={count:0,bytes:0,referenced:0,references:[]};
 item.count++;item.bytes+=len;
 const prefix=p.split('/').slice(0,-1).join('/')+'/';
 const basename=path.basename(p);
 const exact=[];
 for(const x of txt){if(x.text.includes(p)||x.text.includes('/'+p)){exact.push(x.path)}}
 if(exact.length){item.referenced++;item.references.push({p,by:exact.slice(0,7)});highRefs.push({p,category:cat,by:exact.slice(0,7)})}
 else if(len>500000||p.includes('golden')){lowRefs.push({p,cat,bytes:len})}
}
for(const cat of Object.keys(byCategory)){let c=byCategory[cat];c.MiB=+(c.bytes/1048576).toFixed(2);c.sampleReferences=c.references.slice(0,20);delete c.references}

const toolRoot=files.filter(p=>/^tools\/[^/]+\.(?:mjs|js|cjs|sh)$/.test(p));
const references=[];
for(const p of toolRoot){
 const base=path.basename(p);
 const named=[];
 for(const s of txt){if(s.path===p)continue;if(s.text.includes(p)||s.text.includes(base))named.push(s.path)}
 references.push({path:p,refs:named.slice(0,10)});
}
const unusedRootTools=references.filter(x=>x.refs.length===0);
console.log('TOOLS_ROOT',toolRoot.length,'UNREFERENCED_TOOLS_ROOT',unusedRootTools.length);
console.log('UNREFERENCED_TOOLS_LIST',JSON.stringify(unusedRootTools));

const report={unusedRootTools,scannedFiles:scanFiles.length,docsFiles:candidates.length,byCategory,highRefs,lowRefs};
fs.mkdirSync('reports',{recursive:true});
fs.writeFileSync('reports/cleanup-r2-audit.json',JSON.stringify(report,null,2)+'\n');
console.log('CANDIDATES',candidates.length,'SOURCE_FILES_SCANNED',scanFiles.length);
for(const [name,d] of Object.entries(byCategory))console.log('CATEGORY',name,JSON.stringify(d).slice(0,2000));
console.log('EXACT_REFS',JSON.stringify(highRefs.slice(0,60)));
console.log('LARGE_UNREFERENCED',JSON.stringify(lowRefs.filter(x=>x.bytes>1048576).slice(0,30)));
