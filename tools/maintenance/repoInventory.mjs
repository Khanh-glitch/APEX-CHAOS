// Inventory-only audit; never edits or removes tracked files.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8',maxBuffer:15_000_000}).split('\0').filter(Boolean);
const candidates=['docs/acceptance/','docs/arsenal-quest/','docs/hero-rework/','evidence/','.github/workflows/','BLACK_HOLE_VFX_ENGINE.zip','public/assets/control_map/'];
const sources=files.filter(p=>
  /^(src\/|tools\/|scripts\/|gold-mission-account\/|result-gold\/|\.github\/workflows\/)/.test(p)
  && /\.(?:js|jsx|ts|tsx|mjs|cjs|json|ya?ml|html)$/.test(p)
  && fs.existsSync(p)
);
const refs={};
for(const prefix of candidates) refs[prefix]=[];
const byRoot={};
for(const p of files){
  const root=p.split('/')[0];
  const r=byRoot[root]||{files:0,bytes:0};
  r.files++;
  if(fs.existsSync(p)) r.bytes+=fs.statSync(p).size;
  byRoot[root]=r;
}
for(const p of sources){
  const s=fs.readFileSync(p,'utf8');
  const lines=s.split(/\r?\n/);
  for(const prefix of candidates){
    const hit=[];
    for(let i=0;i<lines.length;i++){
      if(lines[i].includes(prefix)){
        if(hit.length<8)hit.push(i+1);
      }
    }
    if(hit.length) refs[prefix].push({path:p,lines:hit});
  }
}
const workflows=files.filter(p=>p.startsWith('.github/workflows/')&&p.endsWith('.yml')).map(p=>{
 const s=fs.readFileSync(p,'utf8');
 const head=(s.match(/^name:\s*(.+)/m)||[])[1]||'';
 const trigger=(s.match(/^on:\s*\n([\s\S]*?)(?=^(?:permissions|jobs|env|concurrency|defaults):)/m)||[])[1]||'';
 return {path:p,name:head,mainPush:/\bpush:[\s\S]*?(?:branches:|-\s*main)/.test(trigger)&&/(?:-\s*main\b|\[\s*['"]?main\b)/.test(trigger),pullRequest:/\bpull_request:/.test(trigger),dispatch:/\bworkflow_dispatch:/.test(trigger),trigger:trigger.trim().slice(0,320)};
});
const extensions={};
for(const p of files.filter(p=>p.startsWith('docs/')||p.startsWith('evidence/'))){
 const e=path.extname(p).toLowerCase()||'(none)';
 const x=extensions[e]||{files:0,bytes:0};
 x.files++;if(fs.existsSync(p))x.bytes+=fs.statSync(p).size;
 extensions[e]=x;
}
const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),trackedFiles:files.length,byRoot,refs,workflows,docExtensions:extensions};
fs.mkdirSync('reports',{recursive:true});
fs.writeFileSync('reports/repo-hygiene-inventory.json',JSON.stringify(report,null,2)+'\n');
console.log('REPO INVENTORY: '+report.trackedFiles+' files; '+workflows.length+' workflows');
for(const [key,v] of Object.entries(byRoot).sort((a,b)=>b[1].bytes-a[1].bytes).slice(0,9)){
 console.log(key+': '+v.files+' files, '+(v.bytes/1048576).toFixed(1)+' MiB');
}
for(const [key,v] of Object.entries(refs))console.log('REF '+key+': '+v.length+' source/workflow files '+v.slice(0,8).map(x=>x.path).join(', '));
console.log('MAIN-PUSH-WORKFLOWS '+workflows.filter(x=>x.mainPush).map(x=>x.path).join(', '));
