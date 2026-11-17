// Read-only deep shipping-source audit: records which tracked files survive
// the actual production build, with references from active source/tooling.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const paths=execFileSync('git',['ls-files','-z'],{encoding:'utf8',maxBuffer:20000000}).split('\0').filter(Boolean);
const activeSource=paths.filter(p=>(
/^(src\/|public\/game\/|public\/apexEngine\.js|public\/gold\/|tools\/|scripts\/|gold-mission-account\/|result-gold\/|\.github\/workflows\/)/.test(p)
)&&/\.(?:js|jsx|ts|tsx|mjs|cjs|json|css|html|ya?ml|sh)$/.test(p) && fs.existsSync(p));
const sources=activeSource.map(p=>({path:p,content:fs.readFileSync(p,'utf8')}));
const fileStats=(list)=>({count:list.length,MiB:+(list.reduce((sum,p)=>sum+(fs.statSync(p).size),0)/1048576).toFixed(2)});
const countRefs=(p)=>sources.filter(x=>x.content.includes(p)||x.content.includes('/'+p)).map(x=>x.path);
const docs=paths.filter(p=>p.startsWith('docs/'));
const masters=paths.filter(p=>p.startsWith('masters/'));
const trackedPublic=paths.filter(p=>p.startsWith('public/'));
const shipped=new Set();
function walk(dir,prefix=''){
 if(!fs.existsSync(dir))return;
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const rel=prefix?prefix+'/'+item.name:item.name;
  if(item.isDirectory())walk(path.join(dir,item.name),rel);
  else shipped.add(rel);
 }
}
walk('dist');
const nonShippingPublic=trackedPublic.filter(p=>!shipped.has(p.slice('public/'.length)));
const shippingPublic=trackedPublic.filter(p=>shipped.has(p.slice('public/'.length)));
const nonShippingGroups={};
for(const p of nonShippingPublic){
 const head=p.split('/').slice(0,4).join('/');
 const x=nonShippingGroups[head]??={count:0,bytes:0};x.count++;x.bytes+=fs.statSync(p).size;
}
const docDirs={};
for(const p of docs){
 const d=p.split('/').slice(0,3).join('/'),x=docDirs[d]??={count:0,bytes:0,refs:0};
 x.count++;x.bytes+=fs.statSync(p).size;
 if(countRefs(p).length)x.refs++;
}
const masterRefs=masters.filter(p=>countRefs(p).length).map(p=>({path:p,refs:countRefs(p).slice(0,7)}));
const docsRefs=docs.filter(p=>countRefs(p).length).map(p=>({path:p,refs:countRefs(p).slice(0,7)}));
const toolScripts=paths.filter(p=>/^tools\/[^/]+\.(?:mjs|js|cjs)$/.test(p));
const workflowFiles=paths.filter(p=>p.startsWith('.github/workflows/'));
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const entrySource=[
 {path:'package.json',content:JSON.stringify(pkg.scripts||{})},
 ...sources.filter(x=>x.path.startsWith('.github/workflows/')),
 ...sources.filter(x=>x.path.startsWith('src/')),
 ...sources.filter(x=>x.path.startsWith('scripts/'))
];
const toolRefs=toolScripts.map(p=>({path:p,refBy:entrySource.filter(x=>x.content.includes(p)||x.content.includes(path.basename(p))).map(x=>x.path)}));
const unreferencedTools=toolRefs.filter(x=>!x.refBy.length).map(x=>x.path);
const report={
 commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 sourceScanned:sources.length,tracked:paths.length,distFiles:shipped.size,
 masterStats:fileStats(masters),masterRefs,docsStats:fileStats(docs),
 docDirs:Object.entries(docDirs).map(([name,x])=>({name,...x,MiB:+(x.bytes/1048576).toFixed(2)})).sort((a,b)=>b.bytes-a.bytes),
 docsRefs,
 publicTracked:fileStats(trackedPublic),
 publicShipped:fileStats(shippingPublic),
 publicNonShipping:fileStats(nonShippingPublic),
 nonShippingPublic,
 nonShippingGroups:Object.entries(nonShippingGroups).map(([name,x])=>({name,...x,MiB:+(x.bytes/1048576).toFixed(2)})).sort((a,b)=>b.bytes-a.bytes),
 toolScripts:toolScripts.length,unreferencedTools,
};
fs.mkdirSync('reports',{recursive:true});
fs.writeFileSync('reports/hard-prune-audit.json',JSON.stringify(report,null,2)+'\n');
console.log('COUNTS',JSON.stringify({
  tracked:paths.length,distFiles:shipped.size,
  masters:report.masterStats,masterReferenced:masterRefs.length,
  docs:report.docsStats,docsReferenced:docsRefs.length,
  public:report.publicTracked,publicShipped:report.publicShipped,
  publicNonShipping:report.publicNonShipping,
  toolsRoot:toolScripts.length,toolsNotReferencedInEntrypoints:unreferencedTools.length
}));
console.log('NONSHIPPING_PUBLIC_GROUPS',JSON.stringify(report.nonShippingGroups.slice(0,55)));
console.log('MASTER_REFS',JSON.stringify(masterRefs.slice(0,120)));
console.log('DOC_GROUPS',JSON.stringify(report.docDirs.slice(0,45)));
console.log('DOC_REF_SUMMARY',JSON.stringify(docsRefs.slice(0,80)));
console.log('TOOLS_UNREFERENCED',JSON.stringify(unreferencedTools.slice(0,190)));
